import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { membershipDocumentId, validTenantSlug } from '../../shared/tenancy.js';
import { requireTenantMembership } from './tenant-admin.js';

const options = {
  region: 'southamerica-east1', memory: '256MiB' as const,
  timeoutSeconds: 20, enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};
const logoSchema = z.string().trim().max(500).refine(value => {
  if (!value) return true;
  if (value.startsWith('/brand/'))
    return /^\/brand\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp|svg)$/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname &&
      !url.username && !url.password && url.port === '' &&
      !/^localhost$|^127\.|^0\.0\.0\.0$|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
  } catch { return false; }
});
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const id = z.string().refine(validTenantSlug);
const updateSchema = z.object({
  tenantId: id,
  branding: z.object({
    displayName: z.string().trim().min(2).max(90),
    primaryColor: color,
    accentColor: color,
    logoUrl: logoSchema,
  }).strict(),
}).strict();

export const tenantGetBrandingSettings = onCall(options, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const parsed = z.object({ tenantId: id }).strict().safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Tenant inválido.');
  await requireTenantMembership(uid, parsed.data.tenantId, ['tenant_owner']);
  const data = (await getFirestore().doc('tenants/' + parsed.data.tenantId).get()).data();
  if (!data || data.status !== 'ACTIVE') throw new HttpsError('not-found', 'Tenant indisponível.');
  const branding = data.branding || {};
  return { tenantId: parsed.data.tenantId, branding: {
    displayName: String(branding.displayName || 'Restaurante'),
    primaryColor: /^#[0-9a-fA-F]{6}$/.test(branding.primaryColor) ? branding.primaryColor : '#b5232b',
    accentColor: /^#[0-9a-fA-F]{6}$/.test(branding.accentColor) ? branding.accentColor : '#111613',
    logoUrl: typeof branding.logoUrl === 'string' ? branding.logoUrl : '',
  } };
});

export const tenantUpdateBranding = onCall(options, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const parsed = updateSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Identidade visual inválida.');
  const input = parsed.data;
  if (input.tenantId === 'teiko') throw new HttpsError('failed-precondition', 'Teiko requer migração autorizada.');
  await requireTenantMembership(uid, input.tenantId, ['tenant_owner']);
  if ((await getAuth().getUser(uid)).disabled)
    throw new HttpsError('permission-denied', 'Conta desativada.');
  const db = getFirestore();
  const ref = db.doc('tenants/' + input.tenantId);
  const membershipRef = db.doc('tenantMemberships/' + membershipDocumentId(input.tenantId, uid));
  const auditRef = db.collection('tenantAuditEvents').doc();
  let updated = false;
  await db.runTransaction(async tx => {
    const [tenant, member] = await Promise.all([tx.get(ref), tx.get(membershipRef)]);
    const m = member.data();
    if (!tenant.exists || tenant.data()?.status !== 'ACTIVE' ||
      m?.tenantId !== input.tenantId || m.userUid !== uid ||
      m.active !== true || m.role !== 'tenant_owner')
      throw new HttpsError('permission-denied', 'Acesso revogado.');
    const before = tenant.data()?.branding || {};
    if (Object.keys(input.branding).every(key => before[key] === input.branding[key as keyof typeof input.branding]))
      return;
    tx.update(ref, { branding: input.branding, updatedAt: FieldValue.serverTimestamp() });
    tx.create(auditRef, {
      tenantId: input.tenantId, actorUid: uid, action: 'TENANT_BRANDING_UPDATED',
      occurredAt: FieldValue.serverTimestamp(),
      // Never include entire logo URL or private customer fields in audit logs.
    });
    updated = true;
  });
  return { updated, tenantId: input.tenantId };
});
