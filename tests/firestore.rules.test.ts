import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  updateDoc,
  setDoc,
  where,
  query,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let env: RulesTestEnvironment;
const testRunId = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
const config = {
  brandId: 'teiko',
  defaultUnitId: 'santa-fe-do-sul',
};

function orderData(ownerUid: string, status = 'NEW') {
  const now = Timestamp.now();
  return {
    brandId: 'teiko',
    ownerUid,
    clientRequestId: crypto.randomUUID(),
    publicCode: crypto.randomUUID().replace(/-/g, ''),
    orderNumber: '#TLOCAL01',
    createdAt: now,
    updatedAt: now,
    unitId: 'santa-fe-do-sul',
    customer: { name: 'Cliente Teiko', whatsapp: '5517999999999', address: { street: 'Rua 23', number: '624', neighborhood: 'Centro' } },
    items: [{ productId: 'simple', productName: 'Sushi', quantity: 1 }],
    fulfillment: { mode: 'PICKUP' },
    payment: { method: 'PIX', needsChange: false },
    pricing: {
      subtotalCents: 1800,
      deliveryFeeCents: 0,
      totalCents: 1800,
      currency: 'BRL',
      quoteType: 'CLIENT_PREVIEW',
    },
    status,
    customerApproval: 'NONE',
    source: 'WEB',
    notes: '',
    statusHistory: [{ status, at: now, actor: ownerUid }],
  };
}

function reservationData(ownerUid: string) {
  const now = Timestamp.now();
  return {
    brandId: 'teiko',
    ownerUid,
    clientRequestId: crypto.randomUUID(),
    unitId: 'santa-fe-do-sul',
    name: 'Cliente Teiko',
    whatsapp: '17999999999',
    date: '2026-12-10',
    time: '19:30',
    people: 2,
    notes: '',
    status: 'REQUESTED',
    createdAt: now,
    updatedAt: now,
    statusHistory: [{ status: 'REQUESTED', at: now, actor: 'customer' }],
  };
}

beforeAll(async () => {
  const [host, port] = (
    process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8180'
  ).split(':');
  env = await initializeTestEnvironment({
    projectId: 'sushi-cbfd2',
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
    },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'storePublicConfig', 'main'), config);
    await setDoc(doc(db, 'products', 'active'), {
      brandId: 'teiko',
      active: true,
      displayOrder: 1,
    });
    await setDoc(doc(db, 'users', 'admin-uid'), {
      brandId: 'teiko',
      role: 'admin',
      active: true,
    });
    await setDoc(doc(db, 'users', 'staff-uid'), {
      brandId: 'teiko',
      role: 'staff',
      active: true,
    });
    await setDoc(doc(db, 'promotions', 'active-promo'), {
      brandId: 'teiko',
      name: 'Oferta ativa',
      active: true,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startsAt: '2026-09-01',
      endsAt: '2026-09-30',
      productIds: [],
    });
    await setDoc(doc(db, 'promotions', 'paused-promo'), {
      brandId: 'teiko',
      name: 'Oferta pausada',
      active: false,
      discountType: 'FIXED',
      discountValue: 500,
      startsAt: '2026-09-01',
      endsAt: '2026-09-30',
      productIds: [],
    });
  });
}, 30_000);

afterAll(() => env.cleanup());

async function seedOrder(id: string, order: ReturnType<typeof orderData>) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'orders', id), order);
  });
}

describe('Firestore Rules Spark Teiko', () => {
  it('permite catálogo público, mas nega pedidos alheios e promoção de cliente', async () => {
    const publicDb = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, 'products', 'active')));
    await assertSucceeds(getDoc(doc(publicDb, 'storePublicConfig', 'main')));
    await assertFails(
      setDoc(doc(publicDb, 'products', 'hacked'), { active: true }),
    );

    const customerDb = env.authenticatedContext('customer-uid').firestore();
    const customerOrder = orderData('customer-uid');
    await seedOrder(`customer-order-${testRunId}`, customerOrder);
    await assertFails(
      setDoc(doc(customerDb, 'orders', `customer-order-${testRunId}`), customerOrder),
    );
    await assertSucceeds(getDoc(doc(customerDb, 'orders', `customer-order-${testRunId}`)));
    await assertSucceeds(
      getDocs(
        query(
          collection(customerDb, 'orders'),
          where('ownerUid', '==', 'customer-uid'),
          where('publicCode', '==', customerOrder.publicCode),
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext('other-uid').firestore(),
          'orders',
          `customer-order-${testRunId}`,
        ),
      ),
    );
    await assertFails(
      updateDoc(doc(customerDb, 'orders', `customer-order-${testRunId}`), {
        status: 'COMPLETED',
      }),
    );
    await assertFails(
      setDoc(doc(customerDb, 'users', 'customer-uid'), {
        brandId: 'teiko',
        role: 'admin',
        active: true,
      }),
    );
  });

  it('expõe somente promoções ativas ao cliente e restringe escrita ao admin', async () => {
    const publicDb = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, 'promotions', 'active-promo')));
    await assertFails(getDoc(doc(publicDb, 'promotions', 'paused-promo')));
    await assertFails(setDoc(doc(publicDb, 'promotions', 'hacked'), { brandId: 'teiko', active: true }));
    await assertSucceeds(setDoc(doc(env.authenticatedContext('admin-uid').firestore(), 'promotions', `created-${testRunId}`), {
      brandId: 'teiko', name: 'Nova oferta', active: true, discountType: 'FIXED', discountValue: 300,
      startsAt: '2026-09-01', endsAt: '2026-09-30', productIds: [],
    }));
  });

  it('restringe o caixa ao admin Teiko e valida lançamentos', async () => {
    const adminDb = env.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(setDoc(doc(adminDb, 'financeEntries', `sale-${testRunId}`), {
      brandId: 'teiko', kind: 'INCOME', category: 'Vendas de sushi', description: 'Combinado Teiko',
      amountCents: 4200, date: '2026-09-17', status: 'PAID',
    }));
    await assertFails(setDoc(doc(env.authenticatedContext('staff-uid').firestore(), 'financeEntries', `staff-${testRunId}`), {
      brandId: 'teiko', kind: 'EXPENSE', category: 'Insumos frescos', description: 'Salmão',
      amountCents: 12000, date: '2026-09-17', status: 'PAID',
    }));
    await assertFails(setDoc(doc(adminDb, 'financeEntries', `invalid-${testRunId}`), {
      brandId: 'teiko', kind: 'INCOME', category: 'Vendas de sushi', description: 'Valor inválido',
      amountCents: 0, date: '2026-09-17', status: 'PAID',
    }));
  });

  it('revoga sessão efetiva de usuário inativo e motoboy desativado', async () => {
    const inactiveUid = `inactive-${testRunId}`;
    const disabledDriverId = `disabled-driver-${testRunId}`;
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', inactiveUid), { brandId: 'teiko', role: 'admin', active: false });
      await setDoc(doc(db, 'financeEntries', `private-${testRunId}`), {
        brandId: 'teiko', kind: 'INCOME', category: 'Privado', description: 'Privado',
        amountCents: 100, date: '2026-09-17', status: 'PAID',
      });
      await setDoc(doc(db, 'users', disabledDriverId), { brandId: 'teiko', role: 'driver', active: true });
      await setDoc(doc(db, 'deliveryDrivers', disabledDriverId), {
        brandId: 'teiko', name: 'Motoboy Suspenso', email: 'suspenso@example.com', phone: '17999999999',
        enabled: false, status: 'OFFLINE',
      });
      await setDoc(doc(db, 'deliveries', `private-delivery-${testRunId}`), {
        brandId: 'teiko', unitId: 'santa-fe-do-sul', orderId: `private-delivery-${testRunId}`,
        orderNumber: '#TSECURE', status: 'ASSIGNED', driverId: disabledDriverId, driverName: 'Motoboy Suspenso',
        customerName: 'Cliente', address: { street: 'Rua 23', number: '1', neighborhood: 'Centro' },
        totalCents: 1800, paymentMethod: 'PIX', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), assignedAt: Timestamp.now(),
      });
    });
    await assertFails(getDoc(doc(env.authenticatedContext(inactiveUid).firestore(), 'financeEntries', `private-${testRunId}`)));
    const disabledDriverDb = env.authenticatedContext(disabledDriverId).firestore();
    await assertFails(getDoc(doc(disabledDriverDb, 'deliveries', `private-delivery-${testRunId}`)));
    await assertFails(updateDoc(doc(disabledDriverDb, 'deliveryDrivers', disabledDriverId), {
      status: 'AVAILABLE', updatedAt: Timestamp.now(),
    }));
  });

  it('permite staff operar status válido e bloqueia transição inválida', async () => {
    const staffDb = env.authenticatedContext('staff-uid').firestore();
    await assertSucceeds(
      getDocs(
        query(collection(staffDb, 'orders'), where('brandId', '==', 'teiko')),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(staffDb, 'orders', `customer-order-${testRunId}`), {
        status: 'CONFIRMED',
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: 'CONFIRMED',
          at: Timestamp.now(),
          actorUid: 'staff-uid',
        }),
      }),
    );
    await assertFails(
      updateDoc(doc(staffDb, 'orders', `customer-order-${testRunId}`), {
        status: 'COMPLETED',
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: 'COMPLETED',
          at: Timestamp.now(),
          actorUid: 'staff-uid',
        }),
      }),
    );
  });

  it('permite proposta de alteração pelo staff e decisão somente do cliente dono', async () => {
    const ownerDb = env.authenticatedContext('customer-edit-uid').firestore();
    const staffDb = env.authenticatedContext('staff-uid').firestore();
    const original = orderData('customer-edit-uid');
    await seedOrder(`edit-order-${testRunId}`, original);
    await assertFails(setDoc(doc(ownerDb, 'orders', `edit-order-${testRunId}`), original));
    const proposal = {
      state: 'PENDING',
      items: original.items,
      pricing: original.pricing,
      reason: 'A unidade propôs uma alteração.',
    };
    await assertSucceeds(
      updateDoc(doc(staffDb, 'orders', `edit-order-${testRunId}`), {
        customerApproval: 'PENDING',
        proposedChanges: proposal,
        editReason: proposal.reason,
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: 'NEW',
          kind: 'EDIT_PROPOSED',
          at: Timestamp.now(),
          actorUid: 'staff-uid',
        }),
      }),
    );
    await assertFails(
      updateDoc(doc(env.authenticatedContext('other-uid').firestore(), 'orders', `edit-order-${testRunId}`), {
        customerApproval: 'ACCEPTED',
        items: original.items,
        pricing: original.pricing,
        proposedChanges: { ...proposal, state: 'ACCEPTED' },
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({ status: 'NEW', kind: 'CUSTOMER_ACCEPTED_EDIT', at: Timestamp.now() }),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(ownerDb, 'orders', `edit-order-${testRunId}`), {
        customerApproval: 'ACCEPTED',
        items: original.items,
        pricing: original.pricing,
        proposedChanges: { ...proposal, state: 'ACCEPTED' },
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({ status: 'NEW', kind: 'CUSTOMER_ACCEPTED_EDIT', at: Timestamp.now() }),
      }),
    );
  });

  it('permite reserva própria e gestão administrativa', async () => {
    const customerDb = env.authenticatedContext('customer-uid').firestore();
    await assertSucceeds(
      setDoc(
        doc(customerDb, 'reservations', `reservation-${testRunId}`),
        reservationData('customer-uid'),
      ),
    );
    await assertSucceeds(
      getDoc(doc(customerDb, 'reservations', `reservation-${testRunId}`)),
    );
    await assertFails(
      getDoc(
        doc(
          env.authenticatedContext('other-uid').firestore(),
          'reservations',
          `reservation-${testRunId}`,
        ),
      ),
    );
    const adminDb = env.authenticatedContext('admin-uid').firestore();
    await assertSucceeds(
      updateDoc(doc(adminDb, 'reservations', `reservation-${testRunId}`), {
        tableId: 'table-1',
        updatedAt: Timestamp.now(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(adminDb, 'reservations', `reservation-${testRunId}`), {
        status: 'CONFIRMED',
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion({
          status: 'CONFIRMED',
          at: Timestamp.now(),
          actorUid: 'admin-uid',
        }),
      }),
    );
  });

  it('bloqueia reserva fora de 2026 e datas impossíveis', async () => {
    const customerDb = env.authenticatedContext('reservation-invalid-uid').firestore();
    await assertFails(
      setDoc(
        doc(customerDb, 'reservations', `reservation-2027-${testRunId}`),
        { ...reservationData('reservation-invalid-uid'), date: '2027-02-11' },
      ),
    );
    await assertFails(
      setDoc(
        doc(customerDb, 'reservations', `reservation-impossible-${testRunId}`),
        { ...reservationData('reservation-invalid-uid'), date: '2026-02-31' },
      ),
    );
  });

  it('bloqueia nome emoji, telefone inválido e texto excessivo mesmo com cliente modificado', async () => {
    const uid = 'input-' + testRunId;
    const customerDb = env.authenticatedContext(uid).firestore();
    const base = orderData(uid);
    await assertFails(setDoc(doc(customerDb, 'orders', 'emoji-' + testRunId), {
      ...base, customer: { ...base.customer, name: '😀 João' },
    }));
    await assertFails(setDoc(doc(customerDb, 'orders', 'phone-' + testRunId), {
      ...base, customer: { ...base.customer, whatsapp: '123' },
    }));
    await assertFails(setDoc(doc(customerDb, 'orders', 'notes-' + testRunId), {
      ...base, notes: 'x'.repeat(501),
    }));
    await assertFails(setDoc(doc(customerDb, 'orders', 'address-' + testRunId), {
      ...base,
      fulfillment: { mode: 'DELIVERY' },
      customer: { ...base.customer, address: { street: 'x', number: '', neighborhood: '!' } },
    }));
    await assertFails(setDoc(doc(customerDb, 'orders', 'name-apostrophe-' + testRunId), {
      ...base, customer: { ...base.customer, name: "D'Ávila" },
    }));
    await assertFails(setDoc(doc(customerDb, 'orders', 'name-japanese-' + testRunId), {
      ...base, customer: { ...base.customer, name: '山田太郎' },
    }));
  });

  it('mantém o fluxo de entrega restrito ao motoboy atribuído e ao cliente dono do código', async () => {
    const orderId = `delivery-order-${testRunId}`;
    const driverId = `driver-${testRunId}`;
    const order = {
      ...orderData(`customer-${testRunId}`, 'READY'),
      fulfillment: { mode: 'DELIVERY' },
      customer: { name: 'Cliente Teiko', whatsapp: '17999999999', address: { street: 'Rua 23', number: '624', neighborhood: 'Centro' } },
      payment: { method: 'CASH', needsChange: false },
    };
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'orders', orderId), order);
      await setDoc(doc(db, 'users', driverId), { brandId: 'teiko', role: 'driver', active: true });
      await setDoc(doc(db, 'deliveryDrivers', driverId), { brandId: 'teiko', name: 'João Motoboy', email: 'joao@example.com', phone: '17999999999', enabled: true, status: 'AVAILABLE' });
    });
    const adminDb = env.authenticatedContext('admin-uid').firestore();
    const now = Timestamp.now();
    const batch = writeBatch(adminDb);
    batch.update(doc(adminDb, 'deliveryDrivers', driverId), { status: 'BUSY', currentDeliveryId: orderId });
    batch.set(doc(adminDb, 'deliveries', orderId), {
      brandId: 'teiko', unitId: 'santa-fe-do-sul', orderId, orderNumber: '#TLOCAL01', status: 'ASSIGNED',
      driverId, driverName: 'João Motoboy', customerName: 'Cliente Teiko',
      address: { street: 'Rua 23', number: '624', neighborhood: 'Centro' }, totalCents: 1800,
      paymentMethod: 'CASH', createdAt: now, updatedAt: now, assignedAt: now,
    });
    batch.set(doc(adminDb, 'orderDeliveryCodes', orderId), { brandId: 'teiko', ownerUid: order.ownerUid, orderId, code: '0042', createdAt: now });
    batch.set(doc(adminDb, 'deliverySecrets', orderId), { brandId: 'teiko', orderId, codeHash: 'a'.repeat(64), createdAt: now });
    await assertSucceeds(batch.commit());

    const driverDb = env.authenticatedContext(driverId).firestore();
    const ownerDb = env.authenticatedContext(order.ownerUid).firestore();
    await assertSucceeds(getDoc(doc(ownerDb, 'deliveries', orderId)));
    await assertFails(getDoc(doc(env.authenticatedContext(`other-owner-${testRunId}`).firestore(), 'deliveries', orderId)));
    await assertSucceeds(getDoc(doc(driverDb, 'deliveries', orderId)));
    await assertFails(getDoc(doc(driverDb, 'deliverySecrets', orderId)));
    await assertSucceeds(updateDoc(doc(driverDb, 'deliveries', orderId), { status: 'ACCEPTED', acceptedAt: Timestamp.now(), updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(driverDb, 'deliveries', orderId), {
      driverId: `hijacked-${testRunId}`,
      driverName: 'Outro motoboy',
      status: 'PICKED_UP',
      pickedUpAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));

    const pickupBatch = writeBatch(driverDb);
    pickupBatch.update(doc(driverDb, 'deliveries', orderId), { status: 'PICKED_UP', pickedUpAt: Timestamp.now(), updatedAt: Timestamp.now() });
    pickupBatch.update(doc(driverDb, 'orders', orderId), {
      status: 'OUT_FOR_DELIVERY', updatedAt: Timestamp.now(),
      statusHistory: arrayUnion({ status: 'OUT_FOR_DELIVERY', at: Timestamp.now(), actorUid: driverId, actorRole: 'driver' }),
    });
    await assertSucceeds(pickupBatch.commit());
    await assertFails(updateDoc(doc(driverDb, 'deliveries', orderId), { status: 'DELIVERED', deliveredAt: Timestamp.now(), updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(driverDb, 'deliveries', orderId), {
      status: 'DELIVERY_FAILED', failureReason: 'Cliente ausente.', updatedAt: Timestamp.now(),
    }));
    await assertSucceeds(updateDoc(doc(driverDb, 'deliveries', orderId), {
      status: 'DELIVERY_FAILED', failedAt: Timestamp.now(), failureReason: 'Cliente ausente.', updatedAt: Timestamp.now(),
    }));
    await assertFails(updateDoc(doc(adminDb, 'deliveries', orderId), { status: 'CANCELLED', updatedAt: Timestamp.now() }));
    const cancelledAt = Timestamp.now();
    const cancellation = writeBatch(adminDb);
    cancellation.update(doc(adminDb, 'deliveries', orderId), { status: 'CANCELLED', failureReason: 'Cancelado pela loja.', updatedAt: cancelledAt });
    cancellation.update(doc(adminDb, 'orders', orderId), { status: 'CANCELLED', cancelledAt, cancellationReason: 'Cancelado pela loja.', updatedAt: cancelledAt, statusHistory: arrayUnion({ status: 'CANCELLED', at: cancelledAt, actorUid: 'admin-uid', actorRole: 'admin' }) });
    cancellation.update(doc(adminDb, 'deliveryDrivers', driverId), { status: 'AVAILABLE', currentDeliveryId: deleteField(), updatedAt: cancelledAt });
    await assertSucceeds(cancellation.commit());

    await assertSucceeds(getDoc(doc(ownerDb, 'orderDeliveryCodes', orderId)));
    await assertFails(getDoc(doc(env.authenticatedContext(`other-${testRunId}`).firestore(), 'orderDeliveryCodes', orderId)));
  });

  it('exige entrega ARRIVED para o código e aceita somente a fila individual do motoboy', async () => {
    const orderId = `receipt-order-${testRunId}`;
    const driverId = `receipt-driver-${testRunId}`;
    const now = Timestamp.now();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'orders', orderId), {
        ...orderData(`receipt-customer-${testRunId}`, 'OUT_FOR_DELIVERY'), fulfillment: { mode: 'DELIVERY' },
      });
      await setDoc(doc(db, 'users', driverId), { brandId: 'teiko', role: 'driver', active: true });
      await setDoc(doc(db, 'deliveryDrivers', driverId), { brandId: 'teiko', name: 'Motoboy', enabled: true, status: 'BUSY', currentDeliveryId: orderId });
      await setDoc(doc(db, 'deliveries', orderId), {
        brandId: 'teiko', unitId: 'santa-fe-do-sul', orderId, orderNumber: '#TLOCAL02', status: 'ARRIVED', driverId, driverName: 'Motoboy',
        customerName: 'Cliente', address: { street: 'Rua 23', number: '1', neighborhood: 'Centro' }, totalCents: 1800,
        paymentMethod: 'CASH', createdAt: now, updatedAt: now, assignedAt: now,
      });
    });
    const driverDb = env.authenticatedContext(driverId).firestore();
    await assertSucceeds(setDoc(doc(driverDb, 'deliveryReceiptRequests', orderId), {
      brandId: 'teiko', deliveryId: orderId, orderId, driverId, codeHash: 'b'.repeat(64), paymentConfirmed: true, status: 'PENDING', attempts: 0, locked: false, createdAt: now,
    }));
    await assertFails(setDoc(doc(driverDb, 'deliveryReceiptRequests', `other-${orderId}`), {
      brandId: 'teiko', deliveryId: `other-${orderId}`, orderId: `other-${orderId}`, driverId, codeHash: 'b'.repeat(64), paymentConfirmed: true, status: 'PENDING', attempts: 0, locked: false, createdAt: now,
    }));
    await assertSucceeds(getDoc(doc(driverDb, 'deliveryReceiptRequests', orderId)));

    const adminDb = env.authenticatedContext('admin-uid').firestore();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      if (attempt > 1) {
        await assertSucceeds(updateDoc(doc(driverDb, 'deliveryReceiptRequests', orderId), {
          status: 'PENDING', codeHash: `${String(attempt).repeat(64)}`.slice(0, 64), createdAt: Timestamp.now(),
          reviewedAt: deleteField(), reviewedBy: deleteField(),
        }));
      }
      await assertSucceeds(updateDoc(doc(adminDb, 'deliveryReceiptRequests', orderId), {
        status: 'REJECTED', attempts: attempt, locked: attempt === 5,
        reviewedAt: Timestamp.now(), reviewedBy: 'admin-uid',
      }));
    }
    await assertFails(updateDoc(doc(driverDb, 'deliveryReceiptRequests', orderId), {
      status: 'PENDING', codeHash: 'd'.repeat(64), createdAt: Timestamp.now(),
      reviewedAt: deleteField(), reviewedBy: deleteField(),
    }));
  });

  it('mantém a trilha de eventos de delivery somente para inclusão', async () => {
    const orderId = `event-order-${testRunId}`;
    const driverId = `event-driver-${testRunId}`;
    const now = Timestamp.now();
    const ownerUid = `event-owner-${testRunId}`;
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'orders', orderId), {
        ...orderData(ownerUid, 'OUT_FOR_DELIVERY'),
        fulfillment: { mode: 'DELIVERY' },
      });
      await setDoc(doc(db, 'users', driverId), { brandId: 'teiko', role: 'driver', active: true });
      await setDoc(doc(db, 'deliveryDrivers', driverId), {
        brandId: 'teiko', name: 'Motoboy Eventos', enabled: true, status: 'BUSY', currentDeliveryId: orderId,
      });
      await setDoc(doc(db, 'deliveries', orderId), {
        brandId: 'teiko', unitId: 'santa-fe-do-sul', orderId, orderNumber: '#TEVENT', status: 'ASSIGNED',
        driverId, driverName: 'Motoboy Eventos', customerName: 'Cliente Eventos',
        address: { street: 'Rua 23', number: '1', neighborhood: 'Centro' }, totalCents: 1800,
        paymentMethod: 'PIX', createdAt: now, updatedAt: now, assignedAt: now,
      });
    });
    const adminDb = env.authenticatedContext('admin-uid').firestore();
    const eventRef = doc(collection(adminDb, 'deliveryEvents'));
    const cancellation = writeBatch(adminDb);
    cancellation.update(doc(adminDb, 'deliveries', orderId), {
      status: 'CANCELLED', failureReason: 'Cancelado pela loja.', updatedAt: now,
    });
    cancellation.update(doc(adminDb, 'orders', orderId), {
      status: 'CANCELLED', cancelledAt: now, cancellationReason: 'Cancelado pela loja.', updatedAt: now,
      statusHistory: arrayUnion({ status: 'CANCELLED', at: now, actorUid: 'admin-uid', actorRole: 'admin' }),
    });
    cancellation.update(doc(adminDb, 'deliveryDrivers', driverId), {
      status: 'AVAILABLE', currentDeliveryId: deleteField(), updatedAt: now,
    });
    cancellation.set(eventRef, {
      eventId: eventRef.id, brandId: 'teiko', deliveryId: orderId, orderId, driverId,
      fromStatus: 'ASSIGNED', toStatus: 'CANCELLED', kind: 'CANCELLED_BY_ADMIN',
      actorUid: 'admin-uid', actorRole: 'admin', reason: 'Cancelado pela loja.', occurredAt: now,
    });
    await assertSucceeds(cancellation.commit());
    await assertFails(getDoc(doc(env.authenticatedContext(ownerUid).firestore(), 'deliveryEvents', eventRef.id)));
    await assertFails(updateDoc(doc(adminDb, 'deliveryEvents', eventRef.id), { kind: 'EDITADO' }));
    await assertFails(deleteDoc(doc(adminDb, 'deliveryEvents', eventRef.id)));
  });

  it('recupera uma entrega que falhou e permite que o novo motoboy envie outro código', async () => {
    const orderId = `retry-order-${testRunId}`;
    const previousDriverId = `previous-driver-${testRunId}`;
    const nextDriverId = `next-driver-${testRunId}`;
    const now = Timestamp.now();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'orders', orderId), {
        ...orderData(`retry-customer-${testRunId}`, 'OUT_FOR_DELIVERY'),
        fulfillment: { mode: 'DELIVERY' },
        customer: { name: 'D\'Ávila', whatsapp: '5517999999999', address: { street: 'Rua 23', number: '624', neighborhood: 'Centro' } },
      });
      for (const driverId of [previousDriverId, nextDriverId]) {
        await setDoc(doc(db, 'users', driverId), { brandId: 'teiko', role: 'driver', active: true });
        await setDoc(doc(db, 'deliveryDrivers', driverId), { brandId: 'teiko', name: 'Motoboy Teiko', email: `${driverId}@example.com`, phone: '17999999999', enabled: true, status: 'AVAILABLE' });
      }
      await setDoc(doc(db, 'deliveries', orderId), {
        brandId: 'teiko', unitId: 'santa-fe-do-sul', orderId, orderNumber: '#TLOCAL03', status: 'DELIVERY_FAILED',
        driverId: previousDriverId, driverName: 'Motoboy anterior', customerName: 'D\'Ávila',
        address: { street: 'Rua 23', number: '624', neighborhood: 'Centro' }, totalCents: 1800,
        paymentMethod: 'CASH', createdAt: now, updatedAt: now, assignedAt: now, failedAt: now, failureReason: 'Cliente não atendeu.',
      });
      await setDoc(doc(db, 'deliveryReceiptRequests', orderId), {
        brandId: 'teiko', deliveryId: orderId, orderId, driverId: previousDriverId,
        codeHash: 'b'.repeat(64), paymentConfirmed: true, status: 'PENDING', attempts: 0, locked: false, createdAt: now,
      });
    });

    const adminDb = env.authenticatedContext('admin-uid').firestore();
    const assignedAt = Timestamp.now();
    const reassign = writeBatch(adminDb);
    reassign.update(doc(adminDb, 'deliveryDrivers', nextDriverId), { status: 'BUSY', currentDeliveryId: orderId, updatedAt: assignedAt });
    reassign.update(doc(adminDb, 'deliveries', orderId), {
      status: 'ASSIGNED', driverId: nextDriverId, driverName: 'Novo motoboy', assignedAt, updatedAt: assignedAt,
      failedAt: deleteField(), failureReason: deleteField(),
    });
    reassign.update(doc(adminDb, 'deliveryReceiptRequests', orderId), { status: 'REJECTED', driverId: nextDriverId, attempts: 0, locked: false, reviewedAt: assignedAt, reviewedBy: 'admin-uid' });
    await assertSucceeds(reassign.commit());

    const nextDriverDb = env.authenticatedContext(nextDriverId).firestore();
    await assertSucceeds(updateDoc(doc(nextDriverDb, 'deliveries', orderId), { status: 'ACCEPTED', acceptedAt: Timestamp.now(), updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(doc(nextDriverDb, 'deliveries', orderId), { status: 'PICKED_UP', pickedUpAt: Timestamp.now(), updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(doc(nextDriverDb, 'deliveries', orderId), { status: 'ON_THE_WAY', startedAt: Timestamp.now(), updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(doc(nextDriverDb, 'deliveries', orderId), { status: 'ARRIVED', arrivedAt: Timestamp.now(), updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(doc(nextDriverDb, 'deliveryReceiptRequests', orderId), {
      status: 'PENDING', codeHash: 'c'.repeat(64), createdAt: Timestamp.now(),
      reviewedAt: deleteField(), reviewedBy: deleteField(),
    }));
    await assertFails(updateDoc(doc(env.authenticatedContext(previousDriverId).firestore(), 'deliveries', orderId), { status: 'ON_THE_WAY', updatedAt: Timestamp.now() }));
  });

  it('exige hash correto, pedido concluído e lançamento financeiro na confirmação final', async () => {
    const orderId = `final-order-${testRunId}`;
    const driverId = `final-driver-${testRunId}`;
    const now = Timestamp.now();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'orders', orderId), {
        ...orderData(`final-customer-${testRunId}`, 'OUT_FOR_DELIVERY'), fulfillment: { mode: 'DELIVERY' },
      });
      await setDoc(doc(db, 'users', driverId), { brandId: 'teiko', role: 'driver', active: true });
      await setDoc(doc(db, 'deliveryDrivers', driverId), { brandId: 'teiko', name: 'Motoboy Final', enabled: true, status: 'BUSY', currentDeliveryId: orderId });
      await setDoc(doc(db, 'deliveries', orderId), {
        brandId: 'teiko', unitId: 'santa-fe-do-sul', orderId, orderNumber: '#TFINAL', status: 'ARRIVED', driverId, driverName: 'Motoboy Final',
        customerName: 'Cliente Final', address: { street: 'Rua 23', number: '1', neighborhood: 'Centro' }, totalCents: 1800,
        paymentMethod: 'PIX', createdAt: now, updatedAt: now, assignedAt: now,
      });
      await setDoc(doc(db, 'deliverySecrets', orderId), { brandId: 'teiko', orderId, codeHash: 'c'.repeat(64), createdAt: now });
      await setDoc(doc(db, 'deliveryReceiptRequests', orderId), {
        brandId: 'teiko', deliveryId: orderId, orderId, driverId, codeHash: 'c'.repeat(64), paymentConfirmed: true,
        status: 'PENDING', attempts: 0, locked: false, createdAt: now,
      });
    });
    const adminDb = env.authenticatedContext('admin-uid').firestore();
    await assertFails(updateDoc(doc(adminDb, 'deliveryReceiptRequests', orderId), {
      status: 'VERIFIED', reviewedAt: Timestamp.now(), reviewedBy: 'admin-uid',
    }));
    const finishedAt = Timestamp.now();
    const finish = writeBatch(adminDb);
    finish.update(doc(adminDb, 'deliveryReceiptRequests', orderId), { status: 'VERIFIED', reviewedAt: finishedAt, reviewedBy: 'admin-uid' });
    finish.update(doc(adminDb, 'deliveries', orderId), { status: 'DELIVERED', deliveredAt: finishedAt, updatedAt: finishedAt });
    finish.update(doc(adminDb, 'orders', orderId), { status: 'COMPLETED', updatedAt: finishedAt, statusHistory: arrayUnion({ status: 'COMPLETED', at: finishedAt, actorUid: 'admin-uid', actorRole: 'admin' }) });
    finish.set(doc(adminDb, 'financeEntries', orderId), {
      brandId: 'teiko', kind: 'INCOME', category: 'Delivery', description: 'Pedido final', amountCents: 1800,
      date: '2026-10-07', status: 'PAID', sourceOrderId: orderId, createdAt: finishedAt, updatedAt: finishedAt,
    });
    await assertSucceeds(finish.commit());
  });

  it('registra abertura e venda no caixa atomicamente, sem expor dados a staff', async () => {
    const adminDb = env.authenticatedContext('admin-uid').firestore();
    const registerId = `register-${testRunId}`;
    const openedAt = Timestamp.now();
    const opening = writeBatch(adminDb);
    opening.set(doc(adminDb, 'cashRegisters', registerId), {
      brandId: 'teiko', status: 'OPEN', operatorUid: 'admin-uid', openingDate: '2026-09-24',
      initialBalanceCents: 5000, expectedCashCents: 5000, openedAt, updatedAt: openedAt,
    });
    opening.set(doc(adminDb, 'cashMovements', `opening-${registerId}`), {
      brandId: 'teiko', registerId, type: 'OPENING', direction: 'IN', amountCents: 5000, cashAmountCents: 5000,
      operatorUid: 'admin-uid', createdAt: openedAt,
    });
    opening.set(doc(adminDb, 'cashControl', 'main'), { brandId: 'teiko', openRegisterId: registerId, updatedAt: openedAt });
    await assertSucceeds(opening.commit());

    const soldAt = Timestamp.now();
    const sale = writeBatch(adminDb);
    sale.update(doc(adminDb, 'cashRegisters', registerId), { expectedCashCents: 6900, lastMovementAt: soldAt, updatedAt: soldAt });
    sale.set(doc(adminDb, 'cashMovements', `sale-${testRunId}`), {
      brandId: 'teiko', registerId, type: 'SALE', direction: 'IN', amountCents: 1900, cashAmountCents: 1900,
      paymentMethod: 'CASH', operatorUid: 'admin-uid', createdAt: soldAt,
    });
    await assertSucceeds(sale.commit());
    await assertFails(getDoc(doc(env.authenticatedContext('staff-uid').firestore(), 'cashRegisters', registerId)));
    await assertFails(setDoc(doc(adminDb, 'cashMovements', `bad-${testRunId}`), {
      brandId: 'teiko', registerId, type: 'SALE', direction: 'IN', amountCents: -5, cashAmountCents: -5,
      paymentMethod: 'CASH', operatorUid: 'admin-uid', createdAt: soldAt,
    }));
  });

  it('resolve disputas concorrentes de atribuição, aceite e conclusão sem duplicar a receita', async () => {
    const orderId = `concurrency-order-${testRunId}`;
    const firstDriverId = `concurrency-driver-a-${testRunId}`;
    const secondDriverId = `concurrency-driver-b-${testRunId}`;
    const now = Timestamp.now();
    const baseOrder = {
      ...orderData(`concurrency-customer-${testRunId}`, 'READY'),
      fulfillment: { mode: 'DELIVERY' },
    };
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'admin-two'), { brandId: 'teiko', role: 'admin', active: true });
      await setDoc(doc(db, 'orders', orderId), baseOrder);
      for (const driverId of [firstDriverId, secondDriverId]) {
        await setDoc(doc(db, 'users', driverId), { brandId: 'teiko', role: 'driver', active: true });
        await setDoc(doc(db, 'deliveryDrivers', driverId), {
          brandId: 'teiko', name: driverId, email: `${driverId}@example.com`, phone: '17999999999',
          enabled: true, status: 'AVAILABLE',
        });
      }
    });

    const firstAdminDb = env.authenticatedContext('admin-uid').firestore();
    const secondAdminDb = env.authenticatedContext('admin-two').firestore();
    const deliveryRef = doc(firstAdminDb, 'deliveries', orderId);
    const assign = async (db: typeof firstAdminDb, driverId: string, actorUid: string) => runTransaction(db, async (transaction) => {
      const orderRef = doc(db, 'orders', orderId);
      const driverRef = doc(db, 'deliveryDrivers', driverId);
      const [order, existing, driver] = await Promise.all([
        transaction.get(orderRef), transaction.get(doc(db, 'deliveries', orderId)), transaction.get(driverRef),
      ]);
      if (!order.exists() || existing.exists() || !driver.exists() || driver.data().status !== 'AVAILABLE') {
        throw new Error('A atribuição já foi resolvida por outra sessão.');
      }
      const assignedAt = Timestamp.now();
      transaction.set(doc(db, 'deliveries', orderId), {
        brandId: 'teiko', unitId: 'santa-fe-do-sul', orderId, orderNumber: '#TCONC', status: 'ASSIGNED',
        driverId, driverName: driver.data().name, customerName: 'Cliente Concorrente',
        address: { street: 'Rua 23', number: '624', neighborhood: 'Centro' }, totalCents: 1800,
        paymentMethod: 'PIX', createdAt: now, updatedAt: assignedAt, assignedAt,
      });
      transaction.update(driverRef, { status: 'BUSY', currentDeliveryId: orderId, updatedAt: assignedAt });
      transaction.set(doc(db, 'deliveryEvents', `${orderId}-${driverId}`), {
        eventId: `${orderId}-${driverId}`, brandId: 'teiko', deliveryId: orderId, orderId, driverId,
        toStatus: 'ASSIGNED', kind: 'ASSIGNED', actorUid, actorRole: 'admin', occurredAt: assignedAt,
      });
    });
    const assignmentResults = await Promise.allSettled([
      assign(firstAdminDb, firstDriverId, 'admin-uid'),
      assign(secondAdminDb, secondDriverId, 'admin-two'),
    ]);
    expect(assignmentResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(assignmentResults.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const assigned = await getDoc(deliveryRef);
    expect(assigned.data()?.status).toBe('ASSIGNED');
    const assignedDriverId = String(assigned.data()?.driverId);

    const driverDbA = env.authenticatedContext(assignedDriverId).firestore();
    const accept = (db: typeof driverDbA) => runTransaction(db, async (transaction) => {
      const current = await transaction.get(doc(db, 'deliveries', orderId));
      if (!current.exists() || current.data().status !== 'ASSIGNED') throw new Error('O aceite já foi registrado.');
      const acceptedAt = Timestamp.now();
      const eventId = crypto.randomUUID();
      transaction.update(doc(db, 'deliveries', orderId), { status: 'ACCEPTED', acceptedAt, updatedAt: acceptedAt });
      transaction.set(doc(db, 'deliveryEvents', eventId), {
        eventId, brandId: 'teiko', deliveryId: orderId, orderId, driverId: assignedDriverId,
        toStatus: 'ACCEPTED', kind: 'ACCEPTED', actorUid: assignedDriverId, actorRole: 'driver', occurredAt: acceptedAt,
      });
    });
    const acceptanceResults = await Promise.allSettled([accept(driverDbA), accept(env.authenticatedContext(assignedDriverId).firestore())]);
    expect(acceptanceResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(acceptanceResults.filter((result) => result.status === 'rejected')).toHaveLength(1);

    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, 'deliveries', orderId), {
        status: 'ARRIVED', acceptedAt: now, pickedUpAt: now, startedAt: now, arrivedAt: now, updatedAt: now,
      });
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'OUT_FOR_DELIVERY', updatedAt: now,
        statusHistory: arrayUnion({ status: 'OUT_FOR_DELIVERY', at: now, actorUid: assignedDriverId, actorRole: 'driver' }),
      });
      await setDoc(doc(db, 'deliverySecrets', orderId), {
        brandId: 'teiko', orderId, codeHash: 'c'.repeat(64), createdAt: now,
      });
      await setDoc(doc(db, 'deliveryReceiptRequests', orderId), {
        brandId: 'teiko', deliveryId: orderId, orderId, driverId: assignedDriverId, codeHash: 'c'.repeat(64),
        paymentConfirmed: true, status: 'PENDING', attempts: 0, locked: false, createdAt: now,
      });
    });
    const finalize = (db: typeof firstAdminDb, actorUid: string) => runTransaction(db, async (transaction) => {
      const receiptRef = doc(db, 'deliveryReceiptRequests', orderId);
      const receipt = await transaction.get(receiptRef);
      if (!receipt.exists() || receipt.data().status !== 'PENDING') throw new Error('A conclusão já foi registrada.');
      const finishedAt = Timestamp.now();
      transaction.update(receiptRef, { status: 'VERIFIED', reviewedAt: finishedAt, reviewedBy: actorUid });
      transaction.update(doc(db, 'deliveries', orderId), { status: 'DELIVERED', deliveredAt: finishedAt, updatedAt: finishedAt });
      transaction.update(doc(db, 'orders', orderId), {
        status: 'COMPLETED', updatedAt: finishedAt,
        statusHistory: arrayUnion({ status: 'COMPLETED', at: finishedAt, actorUid, actorRole: 'admin' }),
      });
      transaction.set(doc(db, 'financeEntries', orderId), {
        brandId: 'teiko', kind: 'INCOME', category: 'Delivery', description: 'Pedido concorrente', amountCents: 1800,
        date: '2026-10-09', status: 'PAID', sourceOrderId: orderId, createdAt: finishedAt, updatedAt: finishedAt,
      });
      transaction.update(doc(db, 'deliveryDrivers', assignedDriverId), { status: 'AVAILABLE', currentDeliveryId: deleteField(), updatedAt: finishedAt });
    });
    const finalResults = await Promise.allSettled([finalize(firstAdminDb, 'admin-uid'), finalize(secondAdminDb, 'admin-two')]);
    expect(finalResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(finalResults.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const finance = await getDoc(doc(firstAdminDb, 'financeEntries', orderId));
    expect(finance.exists()).toBe(true);
    expect(finance.data()?.sourceOrderId).toBe(orderId);
  });
});
