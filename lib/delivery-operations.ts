import {
  arrayUnion, collection, deleteField, doc, runTransaction, Timestamp, type Transaction,
} from 'firebase/firestore';

import { getFirebaseClient } from '@/lib/firebase/client';
import { TEIKO_BRAND_ID } from '@/shared/domain';
import { isDeliveryCode, MAX_DELIVERY_CODE_ATTEMPTS, validateDeliveryAddress, validateDeliveryFailureReason, type DeliveryAddress, type DeliveryEventRole, type DeliveryRecord, type DeliveryStatus } from '@/shared/delivery';
import { isValidCashAmount } from '@/shared/cash-register';

function randomDeliveryCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 10_000).padStart(4, '0');
}

export async function hashDeliveryCode(code: string) {
  if (!isDeliveryCode(code)) throw new Error('Digite os 4 números informados pelo cliente.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function codeHash(code: string) { return hashDeliveryCode(code); }

function appendDeliveryEvent(
  db: ReturnType<typeof getFirebaseClient>['db'],
  transaction: Transaction,
  input: {
    deliveryId: string;
    orderId: string;
    driverId?: string;
    fromStatus?: DeliveryStatus;
    toStatus: DeliveryStatus;
    kind: string;
    actorUid: string;
    actorRole: DeliveryEventRole;
    reason?: string;
  },
) {
  const eventRef = doc(collection(db, 'deliveryEvents'));
  transaction.set(eventRef, {
    brandId: TEIKO_BRAND_ID,
    eventId: eventRef.id,
    ...input,
    occurredAt: Timestamp.now(),
  });
}

export async function assignReadyOrder(input: { orderId: string; driverId: string; actorUid: string }) {
  const { db } = getFirebaseClient();
  const orderRef = doc(db, 'orders', input.orderId);
  const deliveryRef = doc(db, 'deliveries', input.orderId);
  const driverRef = doc(db, 'deliveryDrivers', input.driverId);
  const customerCodeRef = doc(db, 'orderDeliveryCodes', input.orderId);
  const secretRef = doc(db, 'deliverySecrets', input.orderId);
  const receiptRef = doc(db, 'deliveryReceiptRequests', input.orderId);
  return runTransaction(db, async (transaction) => {
    const [orderSnap, deliverySnap, driverSnap, customerCodeSnap, secretSnap, receiptSnap] = await Promise.all([
      transaction.get(orderRef), transaction.get(deliveryRef), transaction.get(driverRef),
      transaction.get(customerCodeRef), transaction.get(secretRef), transaction.get(receiptRef),
    ]);
    if (!orderSnap.exists() || !driverSnap.exists()) throw new Error('Pedido ou motoboy não encontrado. Atualize a tela.');
    const order = orderSnap.data();
    const driver = driverSnap.data();
    const isRetry = deliverySnap.exists() && deliverySnap.data().status === 'DELIVERY_FAILED';
    const expectedOrderStatus = isRetry ? 'OUT_FOR_DELIVERY' : 'READY';
    if (order.brandId !== TEIKO_BRAND_ID || order.status !== expectedOrderStatus || order.fulfillment?.mode !== 'DELIVERY') {
      throw new Error('Atribua somente pedidos de delivery que já estejam prontos.');
    }
    if (driver.brandId !== TEIKO_BRAND_ID || driver.enabled !== true || driver.status !== 'AVAILABLE' || driver.currentDeliveryId) {
      throw new Error('Este motoboy está indisponível ou já tem uma corrida. Escolha outro.');
    }
    if (deliverySnap.exists() && !['READY_FOR_DELIVERY', 'DELIVERY_FAILED'].includes(deliverySnap.data().status)) {
      if (deliverySnap.data().driverId === input.driverId && deliverySnap.data().status === 'ASSIGNED') return { deliveryId: deliverySnap.id, idempotent: true };
      throw new Error('Este pedido já está atribuído ou em andamento. Atualize a central.');
    }
    const address = order.customer?.address as DeliveryAddress | undefined;
    if (!address || Object.keys(validateDeliveryAddress(address)).length > 0) {
      throw new Error('O endereço do pedido está incompleto. Peça ao cliente para corrigir antes de despachar.');
    }
    const totalCents = Number(order.pricing?.totalCents);
    if (!isValidCashAmount(totalCents)) throw new Error('O total do pedido precisa ser confirmado antes de atribuir a corrida.');
    const paymentMethod = order.payment?.method;
    if (!['PIX', 'CARD', 'CASH'].includes(paymentMethod)) throw new Error('A forma de pagamento deste pedido precisa ser revisada.');
    const previousDriverId = deliverySnap.exists() ? String(deliverySnap.data().driverId ?? '') : '';
    const previousDriverRef = previousDriverId && previousDriverId !== input.driverId
      ? doc(db, 'deliveryDrivers', previousDriverId)
      : null;
    const previousDriverSnap = previousDriverRef ? await transaction.get(previousDriverRef) : null;
    if (previousDriverSnap?.exists() && previousDriverSnap.data().currentDeliveryId === input.orderId) {
      transaction.update(previousDriverRef!, { status: 'AVAILABLE', currentDeliveryId: deleteField(), updatedAt: Timestamp.now() });
    }
    let code = customerCodeSnap.exists() ? String(customerCodeSnap.data().code ?? '') : '';
    if (!isDeliveryCode(code)) code = randomDeliveryCode();
    const finalHash = await codeHash(code);
    const now = Timestamp.now();
    if (isRetry && receiptSnap?.exists()) {
      if (!['PENDING', 'REJECTED'].includes(String(receiptSnap.data().status))) {
        throw new Error('A conferência anterior mudou de estado. Atualize a central antes de reatribuir.');
      }
      transaction.update(receiptRef, {
        status: 'REJECTED',
        driverId: input.driverId,
        attempts: 0,
        locked: false,
        reviewedAt: now,
        reviewedBy: input.actorUid,
      });
    }
    transaction.update(driverRef, { status: 'BUSY', currentDeliveryId: input.orderId, updatedAt: now });
    const record: Record<string, unknown> = {
      brandId: TEIKO_BRAND_ID,
      unitId: order.unitId,
      orderId: input.orderId,
      orderNumber: String(order.orderNumber ?? input.orderId).slice(0, 40),
      status: 'ASSIGNED',
      driverId: input.driverId,
      driverName: String(driver.name ?? 'Motoboy').slice(0, 80),
      customerName: String(order.customer?.name ?? 'Cliente').slice(0, 80),
      ...(order.customer?.whatsapp ? { customerWhatsapp: String(order.customer.whatsapp).slice(0, 24) } : {}),
      address: {
        street: String(address.street).trim().slice(0, 120),
        number: String(address.number).trim().slice(0, 20),
        ...(address.complement ? { complement: String(address.complement).trim().slice(0, 80) } : {}),
        neighborhood: String(address.neighborhood).trim().slice(0, 80),
        ...(address.reference ? { reference: String(address.reference).trim().slice(0, 120) } : {}),
      },
      totalCents,
      paymentMethod,
      updatedAt: now,
      assignedAt: now,
    };
    if (deliverySnap.exists()) transaction.update(deliveryRef, { ...record, failureReason: deleteField() });
    else transaction.set(deliveryRef, { ...record, createdAt: now });
    if (!customerCodeSnap.exists()) transaction.set(customerCodeRef, {
      brandId: TEIKO_BRAND_ID, orderId: input.orderId, ownerUid: order.ownerUid, code, createdAt: now,
    });
    if (!secretSnap.exists()) transaction.set(secretRef, {
      brandId: TEIKO_BRAND_ID, orderId: input.orderId, codeHash: finalHash, createdAt: now,
    });
    else if (secretSnap.data().codeHash !== finalHash) transaction.update(secretRef, { codeHash: finalHash });
    appendDeliveryEvent(db, transaction, {
      deliveryId: input.orderId,
      orderId: input.orderId,
      driverId: input.driverId,
      fromStatus: isRetry ? 'DELIVERY_FAILED' : 'READY_FOR_DELIVERY',
      toStatus: 'ASSIGNED',
      kind: isRetry ? 'REASSIGNED' : 'ASSIGNED',
      actorUid: input.actorUid,
      actorRole: 'admin',
    });
    return { deliveryId: input.orderId, idempotent: false };
  });
}

export async function cancelDelivery(input: { delivery: DeliveryRecord; actorUid: string; reason: string }) {
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 200) throw new Error('Informe um motivo com 3 a 200 caracteres.');
  const { db } = getFirebaseClient();
  const deliveryRef = doc(db, 'deliveries', input.delivery.id);
  const orderRef = doc(db, 'orders', input.delivery.orderId);
  const requestRef = doc(db, 'deliveryReceiptRequests', input.delivery.id);
  const driverRef = input.delivery.driverId ? doc(db, 'deliveryDrivers', input.delivery.driverId) : null;
  return runTransaction(db, async (transaction) => {
    const [deliverySnap, orderSnap, requestSnap, driverSnap] = await Promise.all([
      transaction.get(deliveryRef), transaction.get(orderRef), transaction.get(requestRef),
      driverRef ? transaction.get(driverRef) : Promise.resolve(null),
    ]);
    if (!deliverySnap.exists() || !orderSnap.exists()) throw new Error('A corrida ou o pedido não está mais disponível.');
    if (['DELIVERED', 'CANCELLED'].includes(deliverySnap.data().status)) throw new Error('Esta corrida já foi encerrada.');
    const now = Timestamp.now();
    transaction.update(deliveryRef, { status: 'CANCELLED', updatedAt: now, failureReason: reason });
    transaction.update(orderRef, {
      status: 'CANCELLED', cancelledAt: now, cancellationReason: reason, updatedAt: now,
      statusHistory: arrayUnion({ status: 'CANCELLED', at: now, actorUid: input.actorUid, actorRole: 'admin', reason }),
    });
    if (driverRef && driverSnap?.exists() && driverSnap.data().currentDeliveryId === input.delivery.id) {
      transaction.update(driverRef, { status: 'AVAILABLE', currentDeliveryId: deleteField(), updatedAt: now });
    }
    if (requestSnap?.exists() && requestSnap.data().status === 'PENDING') transaction.update(requestRef, { status: 'REJECTED', reviewedAt: now, reviewedBy: input.actorUid });
    appendDeliveryEvent(db, transaction, {
      deliveryId: input.delivery.id,
      orderId: input.delivery.orderId,
      driverId: input.delivery.driverId,
      fromStatus: deliverySnap.data().status as DeliveryStatus,
      toStatus: 'CANCELLED',
      kind: 'CANCELLED_BY_ADMIN',
      actorUid: input.actorUid,
      actorRole: 'admin',
      reason,
    });
  });
}

export async function reviewDeliveryReceipt(input: { deliveryId: string; actorUid: string; paymentConfirmed: boolean }) {
  if (input.paymentConfirmed !== true) throw new Error('Confirme o recebimento do pagamento antes de finalizar a entrega.');
  const { db } = getFirebaseClient();
  const deliveryRef = doc(db, 'deliveries', input.deliveryId);
  const orderRef = doc(db, 'orders', input.deliveryId);
  const requestRef = doc(db, 'deliveryReceiptRequests', input.deliveryId);
  const secretRef = doc(db, 'deliverySecrets', input.deliveryId);
  const controlRef = doc(db, 'cashControl', 'main');
  return runTransaction(db, async (transaction) => {
    const [deliverySnap, orderSnap, requestSnap, secretSnap, controlSnap] = await Promise.all([
      transaction.get(deliveryRef), transaction.get(orderRef), transaction.get(requestRef),
      transaction.get(secretRef), transaction.get(controlRef),
    ]);
    if (!deliverySnap.exists() || !orderSnap.exists() || !requestSnap.exists() || !secretSnap.exists()) throw new Error('A solicitação de recebimento está incompleta.');
    const delivery = deliverySnap.data();
    const order = orderSnap.data();
    const receipt = requestSnap.data();
    if (receipt.status === 'VERIFIED' && delivery.status === 'DELIVERED' && order.status === 'COMPLETED') return { verified: true, idempotent: true };
    if (receipt.status !== 'PENDING' || delivery.status !== 'ARRIVED' || order.status !== 'OUT_FOR_DELIVERY') throw new Error('O pedido ou o comprovante mudou de estado. Atualize a central.');
    const now = Timestamp.now();
    if (receipt.driverId !== delivery.driverId || !receipt.codeHash || receipt.codeHash !== secretSnap.data().codeHash) {
      const attempts = Number.isInteger(receipt.attempts) ? Number(receipt.attempts) : 0;
      const nextAttempts = Math.min(MAX_DELIVERY_CODE_ATTEMPTS, attempts + 1);
      transaction.update(requestRef, {
        status: 'REJECTED',
        attempts: nextAttempts,
        locked: nextAttempts >= MAX_DELIVERY_CODE_ATTEMPTS,
        reviewedAt: now,
        reviewedBy: input.actorUid,
      });
      appendDeliveryEvent(db, transaction, {
        deliveryId: input.deliveryId,
        orderId: input.deliveryId,
        driverId: delivery.driverId,
        toStatus: 'ARRIVED',
        kind: 'CODE_REJECTED',
        actorUid: input.actorUid,
        actorRole: 'admin',
        reason: 'Código ou pagamento não conferido.',
      });
      return { verified: false, idempotent: false };
    }
    const totalCents = Number(order.pricing?.totalCents);
    if (!isValidCashAmount(totalCents)) throw new Error('Confirme um valor maior que zero no pedido antes de finalizar a entrega.');
    const paymentMethod = order.payment?.method;
    if (!['PIX', 'CARD', 'CASH'].includes(paymentMethod)) throw new Error('A forma de pagamento do pedido precisa ser revisada.');
    let registerRef = null;
    let registerSnap = null;
    if (paymentMethod === 'CASH') {
      const registerId = String(controlSnap.data()?.openRegisterId ?? '');
      if (!registerId) throw new Error('Abra o caixa do turno para confirmar este recebimento em dinheiro.');
      registerRef = doc(db, 'cashRegisters', registerId);
      registerSnap = await transaction.get(registerRef);
      if (!registerSnap.exists() || registerSnap.data().status !== 'OPEN') throw new Error('O caixa atual está fechado. Abra um turno para registrar o recebimento em dinheiro.');
    }
    if (receipt.paymentConfirmed !== true) throw new Error('O motoboy ainda não confirmou o recebimento. Peça que confira antes de finalizar.');
    const driverRef = doc(db, 'deliveryDrivers', String(delivery.driverId));
    const driverSnap = await transaction.get(driverRef);
    if (!driverSnap.exists() || driverSnap.data().currentDeliveryId !== input.deliveryId) throw new Error('O motoboy não está mais vinculado a esta corrida.');
    if (registerRef && registerSnap) {
      const expected = Number(registerSnap.data().expectedCashCents);
      const updatedCash = expected + totalCents;
      if (!isValidCashAmount(updatedCash, true)) throw new Error('O caixa atingiu o limite de saldo permitido.');
      transaction.update(registerRef, { expectedCashCents: updatedCash, lastMovementAt: now, updatedAt: now });
      transaction.set(doc(db, 'cashMovements', `delivery-${input.deliveryId}`), {
        brandId: TEIKO_BRAND_ID, registerId: registerRef.id, type: 'SALE', direction: 'IN',
        amountCents: totalCents, cashAmountCents: totalCents, paymentMethod: 'CASH',
        description: `Pedido ${delivery.orderNumber}`, orderNumber: delivery.orderNumber,
        sourceOrderId: input.deliveryId, operatorUid: input.actorUid, createdAt: now,
      });
    }
    transaction.set(doc(db, 'financeEntries', input.deliveryId), {
      brandId: TEIKO_BRAND_ID, kind: 'INCOME', category: 'Delivery',
      description: `Pedido ${delivery.orderNumber}`, amountCents: totalCents,
      date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      status: 'PAID', orderNumber: delivery.orderNumber, sourceOrderId: input.deliveryId,
      createdAt: now, updatedAt: now,
    });
    transaction.update(requestRef, { status: 'VERIFIED', reviewedAt: now, reviewedBy: input.actorUid });
    transaction.update(deliveryRef, { status: 'DELIVERED', deliveredAt: now, updatedAt: now });
    transaction.update(orderRef, {
      status: 'COMPLETED', updatedAt: now,
      statusHistory: arrayUnion({ status: 'COMPLETED', at: now, actorUid: input.actorUid, actorRole: 'admin', reason: 'Recebimento confirmado pela equipe.' }),
    });
    transaction.update(driverRef, { status: 'AVAILABLE', currentDeliveryId: deleteField(), updatedAt: now });
    appendDeliveryEvent(db, transaction, {
      deliveryId: input.deliveryId,
      orderId: input.deliveryId,
      driverId: delivery.driverId,
      fromStatus: 'ARRIVED',
      toStatus: 'DELIVERED',
      kind: 'DELIVERY_VERIFIED',
      actorUid: input.actorUid,
      actorRole: 'admin',
      reason: 'Recebimento e código conferidos pela equipe.',
    });
    return { verified: true, idempotent: false };
  });
}

export async function setDriverAvailability(input: { driverId: string; available: boolean }) {
  const { db } = getFirebaseClient();
  const driverRef = doc(db, 'deliveryDrivers', input.driverId);
  return runTransaction(db, async (transaction) => {
    const driver = await transaction.get(driverRef);
    if (!driver.exists() || driver.data().enabled !== true) throw new Error('Este acesso está suspenso. Fale com a administração.');
    if (driver.data().currentDeliveryId) throw new Error('Conclua ou recuse a entrega atual antes de alterar sua disponibilidade.');
    transaction.update(driverRef, {
      status: input.available ? 'AVAILABLE' : 'OFFLINE',
      updatedAt: Timestamp.now(),
    });
  });
}

export async function respondToDelivery(input: { deliveryId: string; driverId: string; accept: boolean }) {
  const { db } = getFirebaseClient();
  const deliveryRef = doc(db, 'deliveries', input.deliveryId);
  const driverRef = doc(db, 'deliveryDrivers', input.driverId);
  return runTransaction(db, async (transaction) => {
    const [delivery, driver] = await Promise.all([transaction.get(deliveryRef), transaction.get(driverRef)]);
    if (!delivery.exists() || !driver.exists() || driver.data().enabled !== true) throw new Error('A corrida ou o acesso não está mais disponível.');
    if (delivery.data().status !== 'ASSIGNED' || delivery.data().driverId !== input.driverId || driver.data().currentDeliveryId !== input.deliveryId) {
      throw new Error('Esta corrida já mudou de estado. Atualize a página.');
    }
    const now = Timestamp.now();
    if (input.accept) {
      transaction.update(deliveryRef, { status: 'ACCEPTED', acceptedAt: now, updatedAt: now });
      appendDeliveryEvent(db, transaction, {
        deliveryId: input.deliveryId,
        orderId: input.deliveryId,
        driverId: input.driverId,
        fromStatus: 'ASSIGNED',
        toStatus: 'ACCEPTED',
        kind: 'ACCEPTED',
        actorUid: input.driverId,
        actorRole: 'driver',
      });
      return 'ACCEPTED' as const;
    }
    transaction.update(deliveryRef, {
      status: 'READY_FOR_DELIVERY',
      driverId: deleteField(),
      driverName: deleteField(),
      updatedAt: now,
    });
    transaction.update(driverRef, { status: 'AVAILABLE', currentDeliveryId: deleteField(), updatedAt: now });
    appendDeliveryEvent(db, transaction, {
      deliveryId: input.deliveryId,
      orderId: input.deliveryId,
      driverId: input.driverId,
      fromStatus: 'ASSIGNED',
      toStatus: 'READY_FOR_DELIVERY',
      kind: 'DECLINED',
      actorUid: input.driverId,
      actorRole: 'driver',
    });
    return 'READY_FOR_DELIVERY' as const;
  });
}

export async function advanceDriverDelivery(input: {
  deliveryId: string;
  driverId: string;
  next: 'PICKED_UP' | 'ON_THE_WAY' | 'ARRIVED' | 'DELIVERY_FAILED';
  reason?: string;
}) {
  const reason = input.reason?.trim() ?? '';
  if (input.next === 'DELIVERY_FAILED' && !validateDeliveryFailureReason(reason)) {
    throw new Error('Explique o problema com 3 a 200 caracteres, sem enviar apenas espaços.');
  }
  const { db } = getFirebaseClient();
  const deliveryRef = doc(db, 'deliveries', input.deliveryId);
  const driverRef = doc(db, 'deliveryDrivers', input.driverId);
  const orderRef = doc(db, 'orders', input.deliveryId);
  return runTransaction(db, async (transaction) => {
    const [delivery, driver, order] = await Promise.all([
      transaction.get(deliveryRef), transaction.get(driverRef),
      input.next === 'PICKED_UP' ? transaction.get(orderRef) : Promise.resolve(null),
    ]);
    if (!delivery.exists() || !driver.exists() || driver.data().currentDeliveryId !== input.deliveryId || delivery.data().driverId !== input.driverId) {
      throw new Error('Esta corrida não está mais vinculada à sua conta. Atualize a página.');
    }
    const from = String(delivery.data().status);
    const allowed: Record<typeof input.next, string[]> = {
      PICKED_UP: ['ACCEPTED'],
      ON_THE_WAY: ['PICKED_UP'],
      ARRIVED: ['ON_THE_WAY'],
      DELIVERY_FAILED: ['PICKED_UP', 'ON_THE_WAY', 'ARRIVED'],
    };
    if (!allowed[input.next].includes(from)) throw new Error('A etapa mudou. Atualize a página e confira a corrida.');
    const now = Timestamp.now();
    const timeField = {
      PICKED_UP: 'pickedUpAt',
      ON_THE_WAY: 'startedAt',
      ARRIVED: 'arrivedAt',
    } as const;
    if (input.next === 'PICKED_UP' && (!order?.exists() || !['READY', 'OUT_FOR_DELIVERY'].includes(String(order.data().status)))) throw new Error('O pedido não está pronto para retirada. Fale com a loja.');
    transaction.update(deliveryRef, {
      status: input.next,
      updatedAt: now,
      ...(input.next === 'DELIVERY_FAILED' ? {} : { [timeField[input.next]]: now }),
      ...(input.next === 'DELIVERY_FAILED' ? { failureReason: reason } : {}),
    });
    if (input.next === 'PICKED_UP' && order && order.exists() && order.data().status === 'READY') {
      transaction.update(orderRef, {
        status: 'OUT_FOR_DELIVERY',
        updatedAt: now,
        statusHistory: arrayUnion({ status: 'OUT_FOR_DELIVERY', at: now, actorUid: input.driverId, actorRole: 'driver' }),
      });
    } else if (input.next === 'DELIVERY_FAILED') {
      transaction.update(driverRef, { status: 'AVAILABLE', currentDeliveryId: deleteField(), updatedAt: now });
    }
    appendDeliveryEvent(db, transaction, {
      deliveryId: input.deliveryId,
      orderId: input.deliveryId,
      driverId: input.driverId,
      fromStatus: from as DeliveryStatus,
      toStatus: input.next,
      kind: input.next === 'DELIVERY_FAILED' ? 'DELIVERY_FAILED' : input.next,
      actorUid: input.driverId,
      actorRole: 'driver',
      ...(input.next === 'DELIVERY_FAILED' ? { reason } : {}),
    });
    return input.next;
  });
}

export async function submitDeliveryCode(input: { deliveryId: string; driverId: string; code: string; paymentConfirmed: boolean }) {
  const code = input.code.trim();
  const codeHash = await hashDeliveryCode(code);
  if (input.paymentConfirmed !== true) throw new Error('Confirme com o cliente que o pagamento foi recebido.');
  const { db } = getFirebaseClient();
  const deliveryRef = doc(db, 'deliveries', input.deliveryId);
  const driverRef = doc(db, 'deliveryDrivers', input.driverId);
  const requestRef = doc(db, 'deliveryReceiptRequests', input.deliveryId);
  return runTransaction(db, async (transaction) => {
    const [delivery, driver, request] = await Promise.all([
      transaction.get(deliveryRef), transaction.get(driverRef), transaction.get(requestRef),
    ]);
    if (!delivery.exists() || !driver.exists() || delivery.data().driverId !== input.driverId || driver.data().currentDeliveryId !== input.deliveryId) {
      throw new Error('Esta corrida não está mais vinculada à sua conta.');
    }
    if (delivery.data().status !== 'ARRIVED') throw new Error('Marque primeiro que chegou ao endereço.');
    const now = Timestamp.now();
    const receipt = {
      brandId: TEIKO_BRAND_ID,
      deliveryId: input.deliveryId,
      orderId: input.deliveryId,
      driverId: input.driverId,
      codeHash,
      paymentConfirmed: input.paymentConfirmed,
      status: 'PENDING',
      attempts: 0,
      locked: false,
      createdAt: now,
    };
    if (request.exists()) {
      if (request.data().status !== 'REJECTED' || request.data().driverId !== input.driverId) {
        throw new Error('Já existe uma conferência pendente para esta corrida. Aguarde a administração.');
      }
      if (request.data().locked === true || Number(request.data().attempts ?? 0) >= MAX_DELIVERY_CODE_ATTEMPTS) {
        throw new Error('O código foi bloqueado após tentativas inválidas. Peça à loja para reatribuir a corrida.');
      }
      transaction.update(requestRef, {
        status: 'PENDING', codeHash, createdAt: now,
        reviewedAt: deleteField(), reviewedBy: deleteField(),
      });
    } else transaction.set(requestRef, receipt);
    appendDeliveryEvent(db, transaction, {
      deliveryId: input.deliveryId,
      orderId: input.deliveryId,
      driverId: input.driverId,
      toStatus: 'ARRIVED',
      kind: 'RECEIPT_SUBMITTED',
      actorUid: input.driverId,
      actorRole: 'driver',
    });
    return { pendingReview: true };
  });
}
