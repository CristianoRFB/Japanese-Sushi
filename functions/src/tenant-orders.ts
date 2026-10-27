import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { validTenantSlug } from '../../shared/tenancy.js';
import { priceTenantPickup, tenantPickupSchema } from './tenant-order-policy.js';

const options = {
  region: 'southamerica-east1', timeoutSeconds: 30, memory: '256MiB' as const,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};

export const createTenantPickupOrder = onCall(options, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para criar o pedido.');
  const parsed = tenantPickupSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Pedido inválido.');
  const input = parsed.data;
  if ((await getAuth().getUser(uid)).disabled)
    throw new HttpsError('permission-denied', 'Conta desativada.');

  const db = getFirestore();
  const prefix = 'tenants/' + input.tenantId + '/';
  const requestRef = db.doc(prefix + 'orderRequests/' + input.clientRequestId);
  const orderRef = db.collection(prefix + 'orders').doc();
  const tenantRef = db.doc('tenants/' + input.tenantId);
  const productIds = [...new Set(input.items.map(item => item.productId))];
  const productRefs = productIds.map(id => db.doc(prefix + 'products/' + id));
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');

  return await db.runTransaction(async tx => {
    const previous = await tx.get(requestRef);
    if (previous.exists) {
      if (previous.data()?.ownerUid !== uid || previous.data()?.requestHash !== requestHash)
        throw new HttpsError('already-exists', 'Chave de pedido já utilizada.');
      const prior = await tx.get(db.doc(prefix + 'orders/' + previous.data()?.orderId));
      if (!prior.exists || prior.data()?.ownerUid !== uid || prior.data()?.tenantId !== input.tenantId)
        throw new HttpsError('data-loss', 'Registro de pedido inconsistente.');
      return {
        orderId: prior.id, orderNumber: prior.data()?.orderNumber,
        totalCents: prior.data()?.pricing?.totalCents, status: prior.data()?.status,
        idempotent: true,
      };
    }
    const [tenantSnap, ...productSnaps] = await Promise.all([
      tx.get(tenantRef), ...productRefs.map(ref => tx.get(ref)),
    ]);
    const tenant = tenantSnap.data();
    // A newly created tenant must not begin taking orders without explicit
    // activation; migrated Teiko remains isolated and suspended.
    if (tenant?.status !== 'ACTIVE' || tenant.orderingEnabled !== true
      || tenant.migrationState === 'EMULATOR_COPY_ONLY')
      throw new HttpsError('failed-precondition', 'Pedidos indisponíveis para este restaurante.');
    const products = new Map(productSnaps.map(doc =>
      [doc.id, (doc.data() || {}) as Record<string, unknown>]));
    let quote;
    try {
      quote = priceTenantPickup(input.tenantId, input.items, products);
    } catch {
      throw new HttpsError('failed-precondition', 'Item indisponível ou inválido.');
    }
    if (quote.totalCents !== input.clientPreviewTotalCents)
      throw new HttpsError('failed-precondition', 'O preço mudou. Atualize o carrinho.');
    const orderNumber = '#S' + orderRef.id.slice(0, 10).toUpperCase();
    const order = {
      tenantId: input.tenantId, ownerUid: uid, clientRequestId: input.clientRequestId,
      orderNumber, customer: { name: input.customerName }, items: quote.items,
      fulfillment: { mode: 'PICKUP' }, payment: { method: 'AT_PICKUP', status: 'PENDING' },
      pricing: { subtotalCents: quote.totalCents, deliveryFeeCents: 0,
        totalCents: quote.totalCents, currency: 'BRL' },
      status: 'NEW', source: 'WEB',
      statusHistory: [{ status: 'NEW', at: Timestamp.now(), actor: 'customer' }],
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    };
    tx.create(orderRef, order);
    tx.create(requestRef, {
      tenantId: input.tenantId, ownerUid: uid, requestHash,
      orderId: orderRef.id, createdAt: FieldValue.serverTimestamp(),
    });
    return { orderId: orderRef.id, orderNumber, totalCents: quote.totalCents,
      status: 'NEW', idempotent: false };
  });
});

const readSchema = z.object({
  tenantId: z.string().refine(validTenantSlug),
  orderId: z.string().regex(/^[A-Za-z0-9_-]{10,128}$/),
}).strict();

export const getMyTenantOrder = onCall(options, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const parsed = readSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Pedido inválido.');
  if ((await getAuth().getUser(uid)).disabled)
    throw new HttpsError('permission-denied', 'Conta desativada.');
  const { tenantId, orderId } = parsed.data;
  const snap = await getFirestore().doc('tenants/' + tenantId + '/orders/' + orderId).get();
  if (!snap.exists || snap.data()?.tenantId !== tenantId || snap.data()?.ownerUid !== uid)
    throw new HttpsError('not-found', 'Pedido não encontrado.');
  const data = snap.data()!;
  return {
    orderId: snap.id, orderNumber: data.orderNumber, status: data.status,
    pricing: data.pricing, items: data.items,
    fulfillment: { mode: data.fulfillment.mode },
    createdAt: data.createdAt?.toDate?.().toISOString(),
  };
});
