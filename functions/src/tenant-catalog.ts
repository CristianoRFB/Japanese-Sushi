import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { membershipDocumentId, validTenantSlug } from '../../shared/tenancy.js';
import { requireTenantMembership } from './tenant-admin.js';

const opts = { region: 'southamerica-east1', timeoutSeconds: 20, memory: '256MiB' as const,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true' };
const idSchema = z.string().min(3).max(64).refine(validTenantSlug);
const categorySchema = z.object({
  tenantId: idSchema, categoryId: idSchema, name: z.string().trim().min(2).max(80),
}).strict();
const productSchema = z.object({
  tenantId: idSchema, productId: idSchema, categoryId: idSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).default(''),
  priceCents: z.number().int().min(1).max(10_000_000),
  active: z.boolean(),
}).strict();

function validated<T>(schema: z.ZodType<T>, payload: unknown) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Dados de catálogo inválidos.');
  return parsed.data;
}

async function tenantWriter(uid: string | undefined, tenantId: string) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  await requireTenantMembership(uid, tenantId, ['tenant_owner']);
  return { db: getFirestore(), memberRef: getFirestore().doc(
    'tenantMemberships/' + membershipDocumentId(tenantId, uid)), uid };
}
function assertActiveTenant(data: FirebaseFirestore.DocumentData | undefined,
  member: FirebaseFirestore.DocumentData | undefined, tenantId: string, uid: string) {
  if (data?.status !== 'ACTIVE' || member?.tenantId !== tenantId
    || member?.userUid !== uid || member?.role !== 'tenant_owner' || member?.active !== true)
    throw new HttpsError('permission-denied', 'Acesso revogado ou tenant suspenso.');
}

export const tenantUpsertCategory = onCall(opts, async (request) => {
  const input = validated(categorySchema, request.data);
  const { db, memberRef, uid } = await tenantWriter(request.auth?.uid, input.tenantId);
  const tenantRef = db.doc('tenants/' + input.tenantId);
  const categoryRef = db.doc('tenants/' + input.tenantId + '/categories/' + input.categoryId);
  const auditRef = db.collection('tenantAuditEvents').doc();
  let changed = false;
  await db.runTransaction(async (tx) => {
    const [tenant, membership, category] = await Promise.all([
      tx.get(tenantRef), tx.get(memberRef), tx.get(categoryRef),
    ]);
    assertActiveTenant(tenant.data(), membership.data(), input.tenantId, uid);
    if (category.exists && category.data()?.tenantId !== input.tenantId)
      throw new HttpsError('failed-precondition', 'Categoria pertencente a outro tenant.');
    if (category.data()?.name === input.name && category.data()?.active === true) return;
    tx.set(categoryRef, {
      tenantId: input.tenantId, name: input.name, active: true,
      displayOrder: category.data()?.displayOrder ?? 0,
      updatedAt: FieldValue.serverTimestamp(),
      ...(category.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    tx.create(auditRef, { tenantId: input.tenantId, actorUid: uid, action: 'CATEGORY_UPSERTED',
      objectId: input.categoryId, occurredAt: FieldValue.serverTimestamp() });
    changed = true;
  });
  return { categoryId: input.categoryId, updated: changed };
});

export const tenantUpsertSimpleProduct = onCall(opts, async (request) => {
  const input = validated(productSchema, request.data);
  const { db, memberRef, uid } = await tenantWriter(request.auth?.uid, input.tenantId);
  const tenantRef = db.doc('tenants/' + input.tenantId);
  const categoryRef = db.doc('tenants/' + input.tenantId + '/categories/' + input.categoryId);
  const productRef = db.doc('tenants/' + input.tenantId + '/products/' + input.productId);
  const auditRef = db.collection('tenantAuditEvents').doc();
  let changed = false;
  await db.runTransaction(async (tx) => {
    const [tenant, membership, category, product] = await Promise.all([
      tx.get(tenantRef), tx.get(memberRef), tx.get(categoryRef), tx.get(productRef),
    ]);
    assertActiveTenant(tenant.data(), membership.data(), input.tenantId, uid);
    if (!category.exists || category.data()?.tenantId !== input.tenantId || category.data()?.active !== true)
      throw new HttpsError('failed-precondition', 'Categoria inválida para este restaurante.');
    if (product.exists && product.data()?.tenantId !== input.tenantId)
      throw new HttpsError('failed-precondition', 'Produto pertence a outro tenant.');
    const current = product.data();
    if (current?.name === input.name && current.description === input.description
      && current.categoryId === input.categoryId && current.active === input.active
      && current.sizes?.[0]?.basePriceCents === input.priceCents) return;
    tx.set(productRef, {
      tenantId: input.tenantId, name: input.name, slug: input.productId,
      description: input.description, categoryId: input.categoryId, active: input.active,
      productType: 'SIMPLE', sizes: [{
        id: 'unico', label: 'Padrão', active: true, basePriceCents: input.priceCents, displayOrder: 0,
      }],
      modifierGroupIds: [], unitIds: [], displayOrder: current?.displayOrder ?? 0,
      updatedAt: FieldValue.serverTimestamp(),
      ...(product.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    tx.create(auditRef, { tenantId: input.tenantId, actorUid: uid, action: 'SIMPLE_PRODUCT_UPSERTED',
      objectId: input.productId, occurredAt: FieldValue.serverTimestamp() });
    changed = true;
  });
  return { productId: input.productId, updated: changed };
});


export const tenantGetManageCatalog = onCall(opts, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const input = validated(z.object({ tenantId: idSchema }).strict(), request.data);
  await requireTenantMembership(request.auth.uid, input.tenantId, ['tenant_owner', 'staff']);
  const db = getFirestore();
  const [cats, prods] = await Promise.all([
    db.collection('tenants/' + input.tenantId + '/categories').where('tenantId', '==', input.tenantId).limit(100).get(),
    db.collection('tenants/' + input.tenantId + '/products').where('tenantId', '==', input.tenantId).limit(100).get(),
  ]);
  return {
    categories: cats.docs.map((doc) => ({ id: doc.id, name: doc.data().name,
      active: doc.data().active === true })),
    products: prods.docs.map((doc) => ({ id: doc.id, name: doc.data().name,
      description: doc.data().description || '', categoryId: doc.data().categoryId,
      priceCents: Number(doc.data().sizes?.[0]?.basePriceCents || 0), active: doc.data().active === true })),
  };
});
