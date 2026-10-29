import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { membershipDocumentId, validTenantSlug } from '../../shared/tenancy.js';
import { requireTenantMembership } from './tenant-admin.js';

const opts = {
  region: 'southamerica-east1', memory: '256MiB' as const, timeoutSeconds: 30,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};
const schema = z.object({
  tenantId: z.string().refine(validTenantSlug),
  orderId: z.string().regex(/^[A-Za-z0-9_-]{10,128}$/),
  reason: z.string().trim().min(8).max(300),
  confirmCashReturned: z.literal(true),
}).strict();

// This endpoint documents an ACTUAL cash refund attested by the restaurant
// owner. It does not move electronic funds, undo an external charge, or
// generate a fiscal refund. Payment providers and gateways are out of scope.
export const tenantRefundPickupCash = onCall(opts, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Dados do estorno inválidos.');
  const { tenantId, orderId, reason } = parsed.data;
  await requireTenantMembership(uid, tenantId, ['tenant_owner']);
  if ((await getAuth().getUser(uid)).disabled)
    throw new HttpsError('permission-denied', 'Conta desativada.');
  const db = getFirestore();
  const prefix = 'tenants/' + tenantId + '/';
  const tenantRef = db.doc('tenants/' + tenantId);
  const memberRef = db.doc('tenantMemberships/' + membershipDocumentId(tenantId, uid));
  const registerRef = db.doc(prefix + 'cashRegisters/current');
  const orderRef = db.doc(prefix + 'orders/' + orderId);
  const saleRef = db.doc(prefix + 'cashMovements/SALE_' + orderId);
  const originalLedgerRef = db.doc(prefix + 'financeEntries/SALE_' + orderId);
  const reversalRef = db.doc(prefix + 'cashMovements/REFUND_' + orderId);
  const reversalLedgerRef = db.doc(prefix + 'financeEntries/REFUND_' + orderId);
  const auditRef = db.collection('tenantAuditEvents').doc();

  return db.runTransaction(async tx => {
    // Read all documents before any write. All mutations commit atomically.
    const [tenant, member, register, order, sale, originalLedger, reversal, reversalLedger] =
      await Promise.all([
        tx.get(tenantRef), tx.get(memberRef), tx.get(registerRef), tx.get(orderRef),
        tx.get(saleRef), tx.get(originalLedgerRef), tx.get(reversalRef), tx.get(reversalLedgerRef),
      ]);
    const membership = member.data();
    if (tenant.data()?.status !== 'ACTIVE' || membership?.tenantId !== tenantId
      || membership.userUid !== uid || membership.role !== 'tenant_owner' || membership.active !== true)
      throw new HttpsError('permission-denied', 'Acesso ao caixa foi revogado.');
    if (!order.exists || order.data()?.tenantId !== tenantId)
      throw new HttpsError('not-found', 'Pedido não encontrado.');

    const raw = order.data()!;
    const amountCents = raw.pricing?.totalCents;
    if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 10_000_000)
      throw new HttpsError('data-loss', 'Preço do pedido inconsistente.');
    if (!sale.exists || !originalLedger.exists ||
      sale.data()?.tenantId !== tenantId || sale.data()?.orderId !== orderId ||
      sale.data()?.amountCents !== amountCents || sale.data()?.type !== 'SALE' ||
      originalLedger.data()?.tenantId !== tenantId || originalLedger.data()?.orderId !== orderId ||
      originalLedger.data()?.amountCents !== amountCents ||
      originalLedger.data()?.type !== 'REVENUE' || raw.payment?.method !== 'CASH')
      throw new HttpsError('failed-precondition', 'Venda presencial não conciliada.');

    if (reversal.exists || reversalLedger.exists) {
      if (!reversal.exists || !reversalLedger.exists ||
        raw.status !== 'REFUNDED' || raw.payment?.status !== 'REFUNDED' ||
        reversal.data()?.tenantId !== tenantId || reversal.data()?.orderId !== orderId ||
        reversal.data()?.amountCents !== -amountCents || reversal.data()?.reason !== reason ||
        reversalLedger.data()?.tenantId !== tenantId ||
        reversalLedger.data()?.orderId !== orderId ||
        reversalLedger.data()?.amountCents !== -amountCents)
        throw new HttpsError('already-exists', 'Estorno divergente ou incompleto.');
      return { orderId, amountCents, status: 'REFUNDED', idempotent: true };
    }
    if (raw.status !== 'COMPLETED' || raw.payment?.status !== 'PAID' ||
      raw.fulfillment?.mode !== 'PICKUP')
      throw new HttpsError('failed-precondition', 'Pedido não elegível para estorno em dinheiro.');

    const cash = register.data();
    if (cash?.tenantId !== tenantId || cash.status !== 'OPEN' || !cash.sessionId)
      throw new HttpsError('failed-precondition', 'Abra o caixa para registrar a saída de dinheiro.');
    const expectedCents = cash.expectedCashCents;
    if (!Number.isSafeInteger(expectedCents) || expectedCents < amountCents)
      throw new HttpsError('failed-precondition', 'Saldo esperado insuficiente para este estorno.');
    const now = FieldValue.serverTimestamp();
    tx.create(reversalRef, {
      tenantId, orderId, type: 'REFUND', amountCents: -amountCents,
      originalMovementId: sale.id, sessionId: cash.sessionId,
      actorUid: uid, reason, createdAt: now,
    });
    tx.create(reversalLedgerRef, {
      tenantId, orderId, type: 'REFUND', category: 'PICKUP_CASH_REFUND',
      source: 'CASH_MANUAL_ATTESTATION',
      originalLedgerId: originalLedger.id, amountCents: -amountCents,
      currency: 'BRL', sessionId: cash.sessionId,
      actorUid: uid, reason, createdAt: now,
    });
    tx.update(registerRef, {
      cashRefundsCents: FieldValue.increment(amountCents),
      refundCount: FieldValue.increment(1),
      expectedCashCents: FieldValue.increment(-amountCents),
      updatedAt: now,
    });
    tx.update(orderRef, {
      status: 'REFUNDED', updatedAt: now, refundedAt: now,
      'payment.status': 'REFUNDED', 'payment.refundedBy': uid,
      'payment.refundedAt': now, 'payment.refundReason': reason,
      statusHistory: FieldValue.arrayUnion({
        status: 'REFUNDED', actorUid: uid, actorRole: 'tenant_owner',
        reason, at: Timestamp.now(),
      }),
    });
    tx.create(auditRef, {
      tenantId, orderId, actorUid: uid,
      action: 'PICKUP_CASH_REFUNDED', amountCents,
      sessionId: cash.sessionId, occurredAt: now,
    });
    return { orderId, amountCents, status: 'REFUNDED', idempotent: false };
  });
});
