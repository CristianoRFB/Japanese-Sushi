import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { validTenantSlug } from '../../shared/tenancy.js';
import { requireTenantMembership } from './tenant-admin.js';

const options = {
  region: 'southamerica-east1', timeoutSeconds: 20, memory: '256MiB' as const,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};

const schema = z.object({ tenantId: z.string().refine(validTenantSlug) }).strict();

// Explicitly a RECENT ledger view, not a complete financial report.
// A paginated/exportable reconciliation with historical balances is still NEXT.
export const tenantGetRecentFinanceSummary = onCall(options, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const parsed = schema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Restaurante inválido.');
  const tenantId = parsed.data.tenantId;
  await requireTenantMembership(uid, tenantId, ['tenant_owner']);
  if ((await getAuth().getUser(uid)).disabled)
    throw new HttpsError('permission-denied', 'Conta desativada.');
  const db = getFirestore();
  const snapshot = await db.collection('tenants/' + tenantId + '/financeEntries')
    .orderBy('createdAt', 'desc').limit(100).get();
  const movements = snapshot.docs.map(doc => {
    const data = doc.data();
    if (data.tenantId !== tenantId ||
      !['REVENUE', 'REFUND'].includes(data.type) ||
      !Number.isSafeInteger(data.amountCents) ||
      (data.type === 'REVENUE' && data.amountCents <= 0) ||
      (data.type === 'REFUND' && data.amountCents >= 0)) {
      throw new HttpsError('data-loss', 'Lançamento financeiro inconsistente.');
    }
    return {
      id: doc.id, orderId: data.orderId,
      type: data.type as 'REVENUE' | 'REFUND',
      amountCents: data.amountCents as number,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    };
  });
  const revenueCents = movements.filter(m => m.type === 'REVENUE')
    .reduce((total, m) => total + m.amountCents, 0);
  const refundCents = movements.filter(m => m.type === 'REFUND')
    .reduce((total, m) => total + -m.amountCents, 0);
  if (!Number.isSafeInteger(revenueCents) || !Number.isSafeInteger(refundCents))
    throw new HttpsError('data-loss', 'Totais financeiros inválidos.');
  return {
    tenantId, scope: 'RECENT_100_ENTRIES', limit: 100,
    hasMore: snapshot.size === 100,
    revenueCents, refundCents, netCents: revenueCents - refundCents,
    movements,
  };
});
