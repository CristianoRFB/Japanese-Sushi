import {
  deleteField,
  doc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';

import { getFirebaseClient } from '@/lib/firebase/client';
import { TEIKO_BRAND_ID } from '@/shared/domain';
import { cashAmountForPayment, isValidCashAmount, validateCashNote, type CashPaymentMethod } from '@/shared/cash-register';

function assertRequestId(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Identificador de operação inválido. Atualize a tela e tente novamente.');
  }
}

function todayInStore() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function openCashRegister(input: {
  initialBalanceCents: number;
  note?: string;
  clientRequestId: string;
  operatorUid: string;
  operatorEmail?: string;
}) {
  assertRequestId(input.clientRequestId);
  if (!isValidCashAmount(input.initialBalanceCents, true)) throw new Error('O fundo inicial precisa estar entre R$ 0,00 e R$ 100.000,00.');
  if (!validateCashNote(input.note ?? '')) throw new Error('A observação deve ter até 200 caracteres e não pode conter caracteres de controle.');
  const { db } = getFirebaseClient();
  const controlRef = doc(db, 'cashControl', 'main');
  const registerRef = doc(db, 'cashRegisters', input.clientRequestId);
  const movementRef = doc(db, 'cashMovements', `opening-${input.clientRequestId}`);
  return runTransaction(db, async (transaction) => {
    const [control, existing] = await Promise.all([transaction.get(controlRef), transaction.get(registerRef)]);
    if (existing.exists()) return existing.id;
    const openId = control.data()?.openRegisterId;
    if (typeof openId === 'string' && openId) {
      const openRef = doc(db, 'cashRegisters', openId);
      const open = await transaction.get(openRef);
      if (open.exists() && open.data().status === 'OPEN') throw new Error('Já existe um caixa aberto. Feche o turno atual antes de iniciar outro.');
    }
    const now = Timestamp.now();
    const openingDate = todayInStore();
    transaction.set(registerRef, {
      brandId: TEIKO_BRAND_ID,
      status: 'OPEN',
      operatorUid: input.operatorUid,
      operatorEmail: input.operatorEmail ?? null,
      openingDate,
      initialBalanceCents: input.initialBalanceCents,
      expectedCashCents: input.initialBalanceCents,
      note: input.note?.trim() || null,
      openedAt: now,
      updatedAt: now,
    });
    transaction.set(movementRef, {
      brandId: TEIKO_BRAND_ID,
      registerId: registerRef.id,
      type: 'OPENING',
      direction: 'IN',
      amountCents: input.initialBalanceCents,
      cashAmountCents: input.initialBalanceCents,
      operatorUid: input.operatorUid,
      operatorEmail: input.operatorEmail ?? null,
      note: input.note?.trim() || 'Fundo inicial',
      createdAt: now,
    });
    transaction.set(controlRef, { brandId: TEIKO_BRAND_ID, openRegisterId: registerRef.id, updatedAt: now });
    return registerRef.id;
  });
}

export async function recordCashMovement(input: {
  registerId: string;
  clientRequestId: string;
  operatorUid: string;
  operatorEmail?: string;
  type: 'WITHDRAWAL' | 'SUPPLY';
  amountCents: number;
  note: string;
}) {
  assertRequestId(input.clientRequestId);
  if (!isValidCashAmount(input.amountCents)) throw new Error('Informe um valor entre R$ 0,01 e R$ 100.000,00.');
  if (!validateCashNote(input.note, true)) throw new Error('Explique o motivo com pelo menos 3 caracteres e até 200 caracteres.');
  const { db } = getFirebaseClient();
  const registerRef = doc(db, 'cashRegisters', input.registerId);
  const controlRef = doc(db, 'cashControl', 'main');
  const movementRef = doc(db, 'cashMovements', input.clientRequestId);
  return runTransaction(db, async (transaction) => {
    const [control, register, existing] = await Promise.all([
      transaction.get(controlRef), transaction.get(registerRef), transaction.get(movementRef),
    ]);
    if (existing.exists()) return existing.id;
    if (control.data()?.openRegisterId !== input.registerId || !register.exists() || register.data().status !== 'OPEN') {
      throw new Error('O caixa foi fechado ou mudou de turno. Atualize a tela antes de registrar a movimentação.');
    }
    const cash = register.data().expectedCashCents;
    const delta = input.type === 'SUPPLY' ? input.amountCents : -input.amountCents;
    const expectedCashCents = cash + delta;
    if (!isValidCashAmount(expectedCashCents, true)) throw new Error('A sangria não pode deixar o caixa com saldo negativo.');
    const now = Timestamp.now();
    transaction.update(registerRef, { expectedCashCents, updatedAt: now, lastMovementAt: now });
    transaction.set(movementRef, {
      brandId: TEIKO_BRAND_ID,
      registerId: input.registerId,
      type: input.type,
      direction: input.type === 'SUPPLY' ? 'IN' : 'OUT',
      amountCents: input.amountCents,
      cashAmountCents: input.amountCents,
      operatorUid: input.operatorUid,
      operatorEmail: input.operatorEmail ?? null,
      note: input.note.trim(),
      createdAt: now,
    });
    return movementRef.id;
  });
}

export async function recordLocalSale(input: {
  registerId: string;
  clientRequestId: string;
  operatorUid: string;
  operatorEmail?: string;
  amountCents: number;
  paymentMethod: CashPaymentMethod;
  description: string;
  orderNumber?: string;
  note?: string;
}) {
  assertRequestId(input.clientRequestId);
  if (!isValidCashAmount(input.amountCents)) throw new Error('Informe um valor entre R$ 0,01 e R$ 100.000,00.');
  if (!['CASH', 'PIX', 'CARD', 'OTHER'].includes(input.paymentMethod)) throw new Error('Selecione uma forma de pagamento válida.');
  const description = input.description.trim();
  if (description.length < 2 || description.length > 120 || /\p{Cc}/u.test(description)) {
    throw new Error('A descrição deve ter entre 2 e 120 caracteres válidos.');
  }
  if (!validateCashNote(input.note ?? '')) throw new Error('A observação deve ter até 200 caracteres válidos.');
  const orderNumber = input.orderNumber?.trim() ?? '';
  if (orderNumber.length > 40) throw new Error('O número do pedido pode ter até 40 caracteres.');
  const { db } = getFirebaseClient();
  const registerRef = doc(db, 'cashRegisters', input.registerId);
  const controlRef = doc(db, 'cashControl', 'main');
  const movementRef = doc(db, 'cashMovements', input.clientRequestId);
  const financeRef = doc(db, 'financeEntries', `cash-${input.clientRequestId}`);
  return runTransaction(db, async (transaction) => {
    const [control, register, existing] = await Promise.all([
      transaction.get(controlRef), transaction.get(registerRef), transaction.get(movementRef),
    ]);
    if (existing.exists()) return existing.id;
    if (control.data()?.openRegisterId !== input.registerId || !register.exists() || register.data().status !== 'OPEN') {
      throw new Error('O caixa foi fechado ou mudou de turno. Atualize a tela antes de registrar a venda.');
    }
    const cashAmountCents = cashAmountForPayment(input.amountCents, input.paymentMethod);
    const expectedCashCents = register.data().expectedCashCents + cashAmountCents;
    if (!isValidCashAmount(expectedCashCents, true)) throw new Error('O saldo do caixa ultrapassou o limite permitido.');
    const now = Timestamp.now();
    const date = todayInStore();
    transaction.update(registerRef, { expectedCashCents, updatedAt: now, lastMovementAt: now });
    transaction.set(movementRef, {
      brandId: TEIKO_BRAND_ID,
      registerId: input.registerId,
      type: 'SALE',
      direction: 'IN',
      amountCents: input.amountCents,
      cashAmountCents,
      paymentMethod: input.paymentMethod,
      description,
      ...(orderNumber ? { orderNumber } : {}),
      operatorUid: input.operatorUid,
      operatorEmail: input.operatorEmail ?? null,
      note: input.note?.trim() || null,
      createdAt: now,
    });
    transaction.set(financeRef, {
      brandId: TEIKO_BRAND_ID,
      kind: 'INCOME',
      category: input.paymentMethod === 'CASH' ? 'Vendas de sushi' : `Vendas via ${input.paymentMethod === 'PIX' ? 'Pix' : input.paymentMethod === 'CARD' ? 'cartão' : 'outra forma'}`,
      description,
      amountCents: input.amountCents,
      date,
      status: 'PAID',
      ...(orderNumber ? { orderNumber } : {}),
      notes: input.note?.trim() || null,
      createdAt: now,
      updatedAt: now,
    });
    return movementRef.id;
  });
}

export async function closeCashRegister(input: {
  registerId: string;
  clientRequestId: string;
  operatorUid: string;
  operatorEmail?: string;
  countedCashCents: number;
  note?: string;
}) {
  assertRequestId(input.clientRequestId);
  if (!isValidCashAmount(input.countedCashCents, true)) throw new Error('O valor contado precisa estar entre R$ 0,00 e R$ 100.000,00.');
  if (!validateCashNote(input.note ?? '')) throw new Error('A observação deve ter até 200 caracteres válidos.');
  const { db } = getFirebaseClient();
  const registerRef = doc(db, 'cashRegisters', input.registerId);
  const controlRef = doc(db, 'cashControl', 'main');
  const movementRef = doc(db, 'cashMovements', `closing-${input.clientRequestId}`);
  return runTransaction(db, async (transaction) => {
    const [control, register, existing] = await Promise.all([
      transaction.get(controlRef), transaction.get(registerRef), transaction.get(movementRef),
    ]);
    if (existing.exists()) return registerRef.id;
    if (control.data()?.openRegisterId !== input.registerId || !register.exists() || register.data().status !== 'OPEN') {
      throw new Error('Este turno já foi fechado ou substituído. Atualize a tela para consultar o histórico.');
    }
    const expectedCashCents = register.data().expectedCashCents;
    const differenceCents = input.countedCashCents - expectedCashCents;
    const now = Timestamp.now();
    transaction.update(registerRef, {
      status: 'CLOSED',
      countedCashCents: input.countedCashCents,
      differenceCents,
      closingNote: input.note?.trim() || null,
      closingRequestId: input.clientRequestId,
      closedAt: now,
      updatedAt: now,
    });
    transaction.set(movementRef, {
      brandId: TEIKO_BRAND_ID,
      registerId: input.registerId,
      type: 'CLOSING',
      direction: 'OUT',
      amountCents: input.countedCashCents,
      cashAmountCents: 0,
      operatorUid: input.operatorUid,
      operatorEmail: input.operatorEmail ?? null,
      note: input.note?.trim() || 'Fechamento do turno',
      createdAt: now,
    });
    transaction.update(controlRef, { openRegisterId: deleteField(), updatedAt: now });
    return registerRef.id;
  });
}
