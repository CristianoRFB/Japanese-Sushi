import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { summarizeCashMovements, type CashMovementInput, type CashMovementType, type CashPaymentMethod } from '../../shared/cash.js';

if (!getApps().length) initializeApp();
const db = getFirestore();
const options = { region: 'southamerica-east1', enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true' };
const operator = (uid: string, email?: string) => ({ operatorUid: uid, operatorEmail: email ?? '' });
const money = z.number().int().min(0).max(100_000_000);

async function requireCashRole(uid?: string): Promise<{ uid: string; email?: string; role: 'admin' | 'staff' }> {
  if (!uid) throw new HttpsError('unauthenticated', 'Entre no painel para operar o caixa.');
  const user = (await db.doc(`users/${uid}`).get()).data();
  const role = user?.role as 'admin' | 'staff' | undefined;
  if (role !== 'admin' && role !== 'staff') throw new HttpsError('permission-denied', 'Você não possui permissão para realizar esta operação.');
  return { uid, email: user?.email as string | undefined, role };
}

function movementSignedAmount(type: CashMovementType, amountCents: number): number {
  return type === 'WITHDRAWAL' || type === 'REFUND' ? -amountCents : amountCents;
}

function setRegisterCounters(transaction: Transaction, ref: FirebaseFirestore.DocumentReference, movement: CashMovementInput) {
  const increment = (value: number) => FieldValue.increment(value);
  const fields: Record<string, unknown> = { lastMovementAt: FieldValue.serverTimestamp() };
  if (movement.type === 'SALE') {
    fields.salesCents = increment(movement.amountCents);
    if (movement.paymentMethod === 'CASH') { fields.cashSalesCents = increment(movement.amountCents); fields.expectedCashCents = increment(movement.amountCents); }
    if (movement.paymentMethod === 'PIX') fields.pixSalesCents = increment(movement.amountCents);
    if (movement.paymentMethod === 'CARD') fields.cardSalesCents = increment(movement.amountCents);
    if (movement.paymentMethod === 'OTHER') fields.otherSalesCents = increment(movement.amountCents);
  } else if (movement.type === 'REFUND') {
    fields.refundsCents = increment(movement.amountCents);
    if (movement.paymentMethod === 'CASH') fields.expectedCashCents = increment(-movement.amountCents);
  } else if (movement.type === 'WITHDRAWAL') {
    fields.withdrawalsCents = increment(movement.amountCents);
    fields.expectedCashCents = increment(-movement.amountCents);
  } else if (movement.type === 'DEPOSIT') {
    fields.depositsCents = increment(movement.amountCents);
    fields.expectedCashCents = increment(movement.amountCents);
  }
  transaction.update(ref, fields);
}

function movementData(registerId: string, input: CashMovementInput, actor: { uid: string; email?: string }, extra: Record<string, unknown> = {}) {
  return {
    registerId, type: input.type, amountCents: input.amountCents, signedAmountCents: movementSignedAmount(input.type, input.amountCents),
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}), ...operator(actor.uid, actor.email), ...extra,
    createdAt: FieldValue.serverTimestamp(),
  };
}

async function openRegisterInTransaction(transaction: Transaction, actor: { uid: string; email?: string }, openingBalanceCents: number, note?: string) {
  const openQuery = db.collection('cashRegisters').where('status', '==', 'OPEN').limit(1);
  const open = await transaction.get(openQuery);
  if (!open.empty) throw new HttpsError('already-exists', 'Já existe um caixa aberto.');
  const ref = db.collection('cashRegisters').doc();
  transaction.create(ref, {
    status: 'OPEN', openingBalanceCents, expectedCashCents: openingBalanceCents,
    salesCents: 0, refundsCents: 0, withdrawalsCents: 0, depositsCents: 0,
    cashSalesCents: 0, pixSalesCents: 0, cardSalesCents: 0, otherSalesCents: 0,
    openedAt: FieldValue.serverTimestamp(), ...operator(actor.uid, actor.email), ...(note ? { openingNote: note } : {}),
  });
  transaction.create(db.collection('cashMovements').doc(`OPENING-${ref.id}`), movementData(ref.id, { type: 'OPENING', amountCents: openingBalanceCents }, actor, { source: 'CASH_REGISTER' }));
  return ref.id;
}

export const openCash = onCall(options, async (request) => {
  const actor = await requireCashRole(request.auth?.uid);
  const parsed = z.object({ openingBalanceCents: money, note: z.string().trim().max(300).optional() }).safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Informe um saldo inicial válido.');
  const registerId = await db.runTransaction((transaction) => openRegisterInTransaction(transaction, actor, parsed.data.openingBalanceCents, parsed.data.note));
  return { registerId, message: 'Caixa aberto com sucesso.' };
});

const operationSchema = z.object({ operationId: z.uuid(), registerId: z.string().min(1).max(128), type: z.enum(['WITHDRAWAL', 'DEPOSIT']), amountCents: money.refine((value) => value > 0, 'Informe um valor maior que R$ 0,00.'), note: z.string().trim().min(2).max(300) });
export const recordCashMovement = onCall(options, async (request) => {
  const actor = await requireCashRole(request.auth?.uid);
  const parsed = operationSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.issues[0]?.message ?? 'Revise a movimentação.');
  const input = parsed.data;
  return db.runTransaction(async (transaction) => {
    const movementRef = db.doc(`cashMovements/${input.operationId}`);
    const existing = await transaction.get(movementRef);
    if (existing.exists) return { movementId: existing.id, idempotent: true };
    const registerRef = db.doc(`cashRegisters/${input.registerId}`);
    const register = await transaction.get(registerRef);
    if (!register.exists || register.data()?.status !== 'OPEN') throw new HttpsError('failed-precondition', 'Abra um caixa antes de salvar movimentações.');
    const movement: CashMovementInput = { type: input.type, amountCents: input.amountCents };
    transaction.create(movementRef, movementData(input.registerId, movement, actor, { note: input.note, source: 'CASH_REGISTER', idempotencyKey: input.operationId }));
    setRegisterCounters(transaction, registerRef, movement);
    return { movementId: movementRef.id, idempotent: false };
  });
});

function movementInput(snapshot: DocumentSnapshot): CashMovementInput {
  const data = snapshot.data() ?? {};
  return { type: data.type as CashMovementType, amountCents: Number(data.amountCents), paymentMethod: data.paymentMethod as CashPaymentMethod | undefined };
}

export const closeCash = onCall(options, async (request) => {
  const actor = await requireCashRole(request.auth?.uid);
  const parsed = z.object({ registerId: z.string().min(1).max(128), countedCashCents: money, note: z.string().trim().max(300).optional() }).safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Informe o valor contado em dinheiro.');
  const input = parsed.data;
  return db.runTransaction(async (transaction) => {
    const registerRef = db.doc(`cashRegisters/${input.registerId}`);
    const register = await transaction.get(registerRef);
    if (!register.exists || register.data()?.status !== 'OPEN') throw new HttpsError('failed-precondition', 'Não foi possível fechar o caixa. Não há caixa aberto.');
    const movements = await transaction.get(db.collection('cashMovements').where('registerId', '==', input.registerId));
    const data = register.data()!;
    const summary = summarizeCashMovements(Number(data.openingBalanceCents ?? 0), movements.docs.map(movementInput));
    const differenceCents = input.countedCashCents - summary.expectedCashCents;
    if (differenceCents !== 0 && !input.note) throw new HttpsError('invalid-argument', 'Informe uma observação para justificar a diferença.');
    const closedAt = FieldValue.serverTimestamp();
    transaction.update(registerRef, { status: 'CLOSED', closedAt, closedBy: actor.uid, closedByEmail: actor.email ?? '', countedCashCents: input.countedCashCents, differenceCents, summary, ...(input.note ? { closingNote: input.note } : {}) });
    transaction.create(db.collection('cashMovements').doc(`CLOSING-${input.registerId}`), movementData(input.registerId, { type: 'CLOSING', amountCents: 0 }, actor, { source: 'CASH_REGISTER', expectedCashCents: summary.expectedCashCents, countedCashCents: input.countedCashCents, differenceCents, ...(input.note ? { note: input.note } : {}) }));
    return { registerId: input.registerId, summary, countedCashCents: input.countedCashCents, differenceCents };
  });
});

export async function recordOrderSaleInTransaction(transaction: Transaction, orderId: string, order: { pricing: { totalCents: number }; payment: { method: CashPaymentMethod } }, actor: { uid: string; email?: string }) {
  const saleRef = db.doc(`cashMovements/SALE-${orderId}`);
  const existingSale = await transaction.get(saleRef);
  if (existingSale.exists) return existingSale.data()?.registerId as string;
  const open = await transaction.get(db.collection('cashRegisters').where('status', '==', 'OPEN').limit(1));
  if (open.empty) throw new HttpsError('failed-precondition', 'Abra o caixa antes de concluir um pedido pago.');
  const register = open.docs[0];
  const input: CashMovementInput = { type: 'SALE', amountCents: order.pricing.totalCents, paymentMethod: order.payment.method };
  transaction.create(saleRef, movementData(register.id, input, actor, { source: 'ORDER', orderId, idempotencyKey: `SALE-${orderId}` }));
  setRegisterCounters(transaction, register.ref, input);
  return register.id;
}

export async function recordOrderRefundInTransaction(transaction: Transaction, orderId: string, order: { pricing: { totalCents: number }; payment: { method: CashPaymentMethod } }, actor: { uid: string; email?: string }) {
  const saleRef = db.doc(`cashMovements/SALE-${orderId}`);
  const refundRef = db.doc(`cashMovements/REFUND-${orderId}`);
  const [sale, refund] = await Promise.all([transaction.get(saleRef), transaction.get(refundRef)]);
  if (!sale.exists || refund.exists) return sale.data()?.registerId as string | undefined;
  const open = await transaction.get(db.collection('cashRegisters').where('status', '==', 'OPEN').limit(1));
  if (open.empty) throw new HttpsError('failed-precondition', 'Abra o caixa para registrar o estorno.');
  const register = open.docs[0];
  const input: CashMovementInput = { type: 'REFUND', amountCents: order.pricing.totalCents, paymentMethod: order.payment.method };
  transaction.create(refundRef, movementData(register.id, input, actor, { source: 'ORDER', orderId, idempotencyKey: `REFUND-${orderId}`, reason: 'Cancelamento de pedido pago' }));
  setRegisterCounters(transaction, register.ref, input);
  return register.id;
}
