import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { membershipDocumentId, validTenantSlug, type TenantRole } from '../../shared/tenancy.js';

const region = 'southamerica-east1';
const enforceAppCheck = process.env.ENFORCE_APP_CHECK === 'true';
const options = { region, enforceAppCheck, timeoutSeconds: 20, memory: '256MiB' as const };
const slugSchema = z.string().min(3).max(64).refine(validTenantSlug);
const roleSchema = z.enum(['tenant_owner', 'staff', 'driver']);
const uidSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  return result.data;
}

async function requirePlatformOwner(request: CallableRequest) {
  const uid = request.auth?.uid;
  // The caller does not supply an owner UID. Token alone is not enough after
  // privileges are revoked: check the current Auth record on every mutation.
  if (!uid || request.auth?.token.platform_owner !== true)
    throw new HttpsError('permission-denied', 'Apenas Platform Owner.');
  const account = await getAuth().getUser(uid);
  if (account.disabled || account.customClaims?.platform_owner !== true)
    throw new HttpsError('permission-denied', 'Permissão revogada.');
  return uid;
}

const createSchema = z.object({
  slug: slugSchema,
  displayName: z.string().trim().min(2).max(90),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict();

export const platformCreateTenant = onCall(options, async (request) => {
  const actorUid = await requirePlatformOwner(request);
  const input = parse(createSchema, request.data);
  // Teiko is historical production data. It must be enrolled exclusively by
  // the separately approved idempotent migration, never via self-onboarding.
  if (input.slug === 'teiko')
    throw new HttpsError('failed-precondition', 'Teiko exige migração assistida.');
  const db = getFirestore();
  const ref = db.doc('tenants/' + input.slug);
  const audit = db.collection('platformAuditEvents').doc();
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists)
      throw new HttpsError('already-exists', 'Este identificador já está em uso.');
    tx.create(ref, {
      id: input.slug, slug: input.slug, status: 'ACTIVE',
      branding: { displayName: input.displayName, ...(input.primaryColor && { primaryColor: input.primaryColor }) },
      createdBy: actorUid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(audit, {
      action: 'TENANT_CREATED', actorUid, tenantId: input.slug,
      occurredAt: FieldValue.serverTimestamp(),
    });
  });
  return { tenantId: input.slug, status: 'ACTIVE' };
});

const stateSchema = z.object({ tenantId: slugSchema, status: z.enum(['ACTIVE', 'SUSPENDED']) }).strict();
export const platformSetTenantStatus = onCall(options, async (request) => {
  const actorUid = await requirePlatformOwner(request);
  const input = parse(stateSchema, request.data);
  const db = getFirestore();
  const ref = db.doc('tenants/' + input.tenantId);
  const audit = db.collection('platformAuditEvents').doc();
  let updated = false;
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new HttpsError('not-found', 'Tenant não encontrado.');
    const before = snapshot.data()?.status;
    if (before === input.status) return;
    if (before !== 'ACTIVE' && before !== 'SUSPENDED')
      throw new HttpsError('failed-precondition', 'Estado de tenant inválido.');
    tx.update(ref, { status: input.status, updatedAt: FieldValue.serverTimestamp() });
    tx.create(audit, {
      action: 'TENANT_STATUS_CHANGED', actorUid, tenantId: input.tenantId,
      previousStatus: before, nextStatus: input.status, occurredAt: FieldValue.serverTimestamp(),
    });
    updated = true;
  });
  return { updated, status: input.status };
});

const membershipSchema = z.object({
  tenantId: slugSchema, userUid: uidSchema, role: roleSchema, active: z.boolean(),
}).strict();
export const platformSetMembership = onCall(options, async (request) => {
  const actorUid = await requirePlatformOwner(request);
  const input = parse(membershipSchema, request.data);
  if (input.active) {
    const user = await getAuth().getUser(input.userUid);
    if (user.disabled) throw new HttpsError('failed-precondition', 'Usuário desativado.');
  }
  const db = getFirestore();
  const tenantRef = db.doc('tenants/' + input.tenantId);
  const ref = db.doc('tenantMemberships/' + membershipDocumentId(input.tenantId, input.userUid));
  const audit = db.collection('platformAuditEvents').doc();
  let updated = false;
  await db.runTransaction(async (tx) => {
    const [tenant, existing] = await Promise.all([tx.get(tenantRef), tx.get(ref)]);
    if (!tenant.exists) throw new HttpsError('not-found', 'Tenant não encontrado.');
    if (tenant.data()?.status !== 'ACTIVE' && input.active)
      throw new HttpsError('failed-precondition', 'Tenant suspenso.');
    const before = existing.data();
    if (before?.role === input.role && before?.active === input.active) return;
    tx.set(ref, {
      tenantId: input.tenantId, userUid: input.userUid, role: input.role, active: input.active,
      updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid,
      ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    tx.create(audit, {
      action: 'MEMBERSHIP_CHANGED', actorUid, tenantId: input.tenantId,
      targetUid: input.userUid, previousRole: before?.role ?? null,
      nextRole: input.role, previousActive: before?.active ?? null,
      nextActive: input.active, occurredAt: FieldValue.serverTimestamp(),
    });
    updated = true;
  });
  return { updated, tenantId: input.tenantId, userUid: input.userUid };
});

const accessSchema = z.object({ tenantId: slugSchema }).strict();
// Future domain callables should use the same trusted membership lookup,
// rather than trusting an arbitrary tenantId passed in a client payload.
export async function requireTenantMembership(uid: string, tenantId: string, allowed?: TenantRole[]) {
  const db = getFirestore();
  const [tenant, membership, account] = await Promise.all([
    db.doc('tenants/' + tenantId).get(),
    db.doc('tenantMemberships/' + membershipDocumentId(tenantId, uid)).get(),
    getAuth().getUser(uid),
  ]);
  const m = membership.data();
  if (account.disabled || tenant.data()?.status !== 'ACTIVE'
    || m?.tenantId !== tenantId || m.userUid !== uid || m.active !== true
    || !roleSchema.safeParse(m.role).success || (allowed && !allowed.includes(m.role))) {
    throw new HttpsError('permission-denied', 'Sem acesso a este tenant.');
  }
  return { tenantId, role: m.role as TenantRole };
}

export const getMyTenantAccess = onCall(options, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const input = parse(accessSchema, request.data);
  return await requireTenantMembership(request.auth.uid, input.tenantId);
});

// No callable to grant a platform_owner claim. That credential must be
// provisioned out-of-band by the verified Firebase project administrator.
