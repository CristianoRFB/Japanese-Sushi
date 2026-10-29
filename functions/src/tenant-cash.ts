import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { membershipDocumentId, validTenantSlug } from '../../shared/tenancy.js';
import { requireTenantMembership } from './tenant-admin.js';

const options = {
  region: 'southamerica-east1',
  memory: '256MiB' as const,
  timeoutSeconds: 30,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};
const tenantIdSchema = z.string().refine(validTenantSlug);
const registerSchema = z.object({ tenantId: tenantIdSchema }).strict();
const openSchema = registerSchema.extend({
  openingFloatCents: z.number().int().min(0).max(10_000_000),
}).strict();
const closeSchema = registerSchema.extend({
  countedCashCents: z.number().int().min(0).max(100_000_000),
}).strict();
const cashSaleSchema = registerSchema.extend({
  orderId: z.string().regex(/^[A-Za-z0-9_-]{10,128}$/),
  cashReceivedCents: z.number().int().min(1).max(20_000_000),
  confirmCashReceived: z.literal(true),
}).strict();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Dados de caixa inválidos.');
  return parsed.data;
}

async function authorize(uid: string | undefined, tenantId: string, ownerOnly = false) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const role = await requireTenantMembership(uid, tenantId,
    ownerOnly ? ['tenant_owner'] : ['tenant_owner', 'staff']);
  if ((await getAuth().getUser(uid)).disabled)
    throw new HttpsError('permission-denied', 'Usuário desativado.');
  return role;
}

// Rechecked INSIDE each transaction: Auth check outside transaction covers
// disabled accounts and tenant/member docs are read atomically with writes.
function authorizeTransaction(
  tenantId: string, uid: string, role: string,
  tenant: FirebaseFirestore.DocumentData | undefined,
  membership: FirebaseFirestore.DocumentData | undefined,
) {
  if (tenant?.status !== 'ACTIVE' || membership?.tenantId !== tenantId
    || membership.userUid !== uid || membership.active !== true
    || membership.role !== role) {
    throw new HttpsError('permission-denied', 'Permissão de caixa revogada.');
  }
}
function refs(tenantId: string, uid: string) {
  const db = getFirestore();
  return {
    db,
    tenantRef: db.doc('tenants/' + tenantId),
    membershipRef: db.doc('tenantMemberships/' + membershipDocumentId(tenantId, uid)),
    registerRef: db.doc('tenants/' + tenantId + '/cashRegisters/current'),
  };
}

export const tenantOpenPickupCashRegister = onCall(options, async request => {
  const { tenantId, openingFloatCents } = parse(openSchema, request.data);
  const uid = request.auth?.uid;
  const access = await authorize(uid, tenantId, true);
  const { db, tenantRef, membershipRef, registerRef } = refs(tenantId, uid!);
  const sessionRef = db.collection('tenants/' + tenantId + '/cashRegisterSessions').doc();
  const auditRef = db.collection('tenantAuditEvents').doc();
  await db.runTransaction(async tx => {
    const [tenant, membership, current, oldSession] = await Promise.all([
      tx.get(tenantRef), tx.get(membershipRef), tx.get(registerRef), tx.get(sessionRef),
    ]);
    authorizeTransaction(tenantId, uid!, access.role, tenant.data(), membership.data());
    if (current.data()?.status === 'OPEN')
      throw new HttpsError('failed-precondition', 'Já existe caixa aberto.');
    if (oldSession.exists) throw new HttpsError('already-exists', 'Sessão já existe.');
    const data = {
      tenantId, sessionId: sessionRef.id, status: 'OPEN',
      openingFloatCents, cashSalesCents: 0, salesCount: 0,
      cashRefundsCents: 0, refundCount: 0,
      expectedCashCents: openingFloatCents,
      openedBy: uid, openedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(registerRef, data);
    tx.create(sessionRef, {
      tenantId, status: 'OPEN', sessionId: sessionRef.id, openedBy: uid,
      openingFloatCents, openedAt: FieldValue.serverTimestamp(),
    });
    tx.create(auditRef, {
      tenantId, actorUid: uid, action: 'PICKUP_CASH_OPENED',
      sessionId: sessionRef.id, occurredAt: FieldValue.serverTimestamp(),
    });
  });
  return { sessionId: sessionRef.id, status: 'OPEN', openingFloatCents };
});

export const tenantGetPickupCashRegister = onCall(options, async request => {
  const { tenantId } = parse(registerSchema, request.data);
  await authorize(request.auth?.uid, tenantId);
  const snapshot = await getFirestore().doc('tenants/' + tenantId + '/cashRegisters/current').get();
  const data = snapshot.data();
  return !data || data.tenantId !== tenantId
    ? { status: 'NOT_OPENED' }
    : {
      status: data.status, sessionId: data.sessionId,
      openingFloatCents: data.openingFloatCents,
      expectedCashCents: data.expectedCashCents,
      cashSalesCents: data.cashSalesCents,
      salesCount: data.salesCount,
      cashRefundsCents: data.cashRefundsCents ?? 0,
      refundCount: data.refundCount ?? 0,
    };
});

export const tenantSettlePickupCash = onCall(options, async request => {
  const input = parse(cashSaleSchema, request.data);
  const uid = request.auth?.uid;
  const access = await authorize(uid, input.tenantId);
  const { db, tenantRef, membershipRef, registerRef } = refs(input.tenantId, uid!);
  const prefix = 'tenants/' + input.tenantId + '/';
  const orderRef = db.doc(prefix + 'orders/' + input.orderId);
  const movementRef = db.doc(prefix + 'cashMovements/SALE_' + input.orderId);
  const ledgerRef = db.doc(prefix + 'financeEntries/SALE_' + input.orderId);
  const auditRef = db.collection('tenantAuditEvents').doc();
  return db.runTransaction(async tx => {
    const [tenant, member, register, order, movement, ledger] = await Promise.all([
      tx.get(tenantRef), tx.get(membershipRef), tx.get(registerRef),
      tx.get(orderRef), tx.get(movementRef), tx.get(ledgerRef),
    ]);
    authorizeTransaction(input.tenantId, uid!, access.role, tenant.data(), member.data());
    if (!order.exists || order.data()?.tenantId !== input.tenantId)
      throw new HttpsError('not-found', 'Pedido não encontrado.');
    const raw = order.data()!;
    const amountCents = raw.pricing?.totalCents;
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 10_000_000)
      throw new HttpsError('data-loss', 'Preço persistido inválido.');
    if (movement.exists || ledger.exists) {
      if (!movement.exists || !ledger.exists || raw.status !== 'COMPLETED'
        || raw.payment?.status !== 'PAID'
        || raw.payment?.method !== 'CASH'
        || movement.data()?.tenantId !== input.tenantId
        || movement.data()?.orderId !== input.orderId
        || ledger.data()?.tenantId !== input.tenantId
        || ledger.data()?.orderId !== input.orderId
        || movement.data()?.cashReceivedCents !== input.cashReceivedCents
        || ledger.data()?.amountCents !== amountCents)
        throw new HttpsError('already-exists', 'Liquidação divergente ou incompleta.');
      return { orderId: input.orderId, amountCents, idempotent: true, status: 'COMPLETED' };
    }
    if (raw.status !== 'READY' || raw.fulfillment?.mode !== 'PICKUP'
      || raw.payment?.status !== 'PENDING' || raw.payment?.method !== 'AT_PICKUP')
      throw new HttpsError('failed-precondition', 'Pedido não elegível para recebimento em dinheiro.');
    if (register.data()?.tenantId !== input.tenantId
      || register.data()?.status !== 'OPEN' || !register.data()?.sessionId)
      throw new HttpsError('failed-precondition', 'Abra o caixa antes de receber.');
    if (input.cashReceivedCents < amountCents)
      throw new HttpsError('invalid-argument', 'Valor recebido inferior ao total.');
    const cashChangeCents = input.cashReceivedCents - amountCents;
    if (cashChangeCents > Number(register.data()?.expectedCashCents || 0)
      + input.cashReceivedCents)
      throw new HttpsError('failed-precondition', 'Troco indisponível.');
    const now = FieldValue.serverTimestamp();
    const movementData = {
      tenantId: input.tenantId, orderId: input.orderId,
      sessionId: register.data()!.sessionId, actorUid: uid,
      type: 'SALE', amountCents,
      cashReceivedCents: input.cashReceivedCents, cashChangeCents,
      createdAt: now,
    };
    tx.create(movementRef, movementData);
    tx.create(ledgerRef, {
      tenantId: input.tenantId, orderId: input.orderId, type: 'REVENUE',
      category: 'PICKUP_SALE', source: 'CASH_MANUAL_ATTESTATION',
      amountCents, currency: 'BRL',
      actorUid: uid, sessionId: register.data()!.sessionId, createdAt: now,
    });
    tx.update(registerRef, {
      cashSalesCents: FieldValue.increment(amountCents),
      expectedCashCents: FieldValue.increment(amountCents),
      salesCount: FieldValue.increment(1), updatedAt: now,
    });
    tx.update(orderRef, {
      status: 'COMPLETED', updatedAt: now, completedAt: now,
      payment: {
        method: 'CASH', status: 'PAID',
        cashReceivedCents: input.cashReceivedCents, cashChangeCents,
        attestedBy: uid, attestedAt: Timestamp.now(),
        sessionId: register.data()!.sessionId,
      },
      statusHistory: FieldValue.arrayUnion({
        status: 'COMPLETED', at: Timestamp.now(), actorUid: uid,
        actorRole: access.role, paymentMethod: 'CASH',
      }),
    });
    tx.create(auditRef, {
      tenantId: input.tenantId, actorUid: uid, action: 'PICKUP_CASH_RECEIVED',
      orderId: input.orderId, sessionId: register.data()!.sessionId,
      amountCents, occurredAt: now,
    });
    return {
      orderId: input.orderId, amountCents, cashChangeCents,
      idempotent: false, status: 'COMPLETED',
    };
  });
});

export const tenantClosePickupCashRegister = onCall(options, async request => {
  const { tenantId, countedCashCents } = parse(closeSchema, request.data);
  const uid = request.auth?.uid;
  const access = await authorize(uid, tenantId, true);
  const { db, tenantRef, membershipRef, registerRef } = refs(tenantId, uid!);
  const auditRef = db.collection('tenantAuditEvents').doc();
  return db.runTransaction(async tx => {
    const [tenant, member, register] = await Promise.all([
      tx.get(tenantRef), tx.get(membershipRef), tx.get(registerRef),
    ]);
    authorizeTransaction(tenantId, uid!, access.role, tenant.data(), member.data());
    const data = register.data();
    if (data?.status !== 'OPEN' || data.tenantId !== tenantId || !data.sessionId)
      throw new HttpsError('failed-precondition', 'Nenhum caixa aberto.');
    const sessionRef = db.doc('tenants/' + tenantId + '/cashRegisterSessions/' + data.sessionId);
    const session = await tx.get(sessionRef);
    if (!session.exists || session.data()?.status !== 'OPEN')
      throw new HttpsError('data-loss', 'Sessão de caixa inconsistente.');
    const varianceCents = countedCashCents - data.expectedCashCents;
    const close = {
      status: 'CLOSED', countedCashCents, varianceCents,
      closedBy: uid, closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.update(registerRef, close);
    tx.update(sessionRef, {
      ...close, cashSalesCents: data.cashSalesCents, salesCount: data.salesCount,
      cashRefundsCents: data.cashRefundsCents ?? 0,
      refundCount: data.refundCount ?? 0,
      expectedCashCents: data.expectedCashCents,
    });
    tx.create(auditRef, {
      tenantId, actorUid: uid, action: 'PICKUP_CASH_CLOSED',
      sessionId: data.sessionId, varianceCents, occurredAt: FieldValue.serverTimestamp(),
    });
    return {
      sessionId: data.sessionId, status: 'CLOSED',
      expectedCashCents: data.expectedCashCents, countedCashCents, varianceCents,
    };
  });
});
