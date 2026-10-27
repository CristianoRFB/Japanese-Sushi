import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { z } from 'zod';
import { driverPushTokenId, isPushAssignment, PUSH_TOKEN_LIMIT, safeDeliveryPushData, validFcmToken } from './driver-push-policy.js';

// Until F4, this product has one real tenant. Membership checks will replace brandId
// during CORE_FIRST tenant migration. Do not accept tenantId from the client.
const LEGACY_TENANT = 'teiko';
const region = 'southamerica-east1';
const enforceAppCheck = process.env.ENFORCE_APP_CHECK === 'true';
const tokenSchema = z.object({ token: z.string().min(40).max(4096) });

async function requireActiveDriver(uid: string | undefined) {
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login como motoboy.');
  const db = getFirestore();
  const [account, driver] = await Promise.all([
    db.doc('users/' + uid).get(),
    db.doc('deliveryDrivers/' + uid).get(),
  ]);
  if (account.data()?.active !== true || account.data()?.role !== 'driver'
    || account.data()?.brandId !== LEGACY_TENANT
    || driver.data()?.brandId !== LEGACY_TENANT || driver.data()?.enabled !== true) {
    throw new HttpsError('permission-denied', 'Motoboy inativo ou não autorizado.');
  }
  return db;
}

export const registerDriverPushToken = onCall(
  { region, timeoutSeconds: 15, memory: '256MiB', enforceAppCheck },
  async (request) => {
    const parsed = tokenSchema.safeParse(request.data);
    if (!parsed.success || !validFcmToken(parsed.data.token))
      throw new HttpsError('invalid-argument', 'Token de notificação inválido.');
    const uid = request.auth?.uid;
    const db = await requireActiveDriver(uid);
    const tokenId = driverPushTokenId(parsed.data.token);
    const existing = await db.collection('driverPushTokens').where('driverUid', '==', uid).get();
    const owned = existing.docs.some((doc) => doc.id === tokenId);
    // A token belonging to another uid cannot be overwritten.
    const tokenRef = db.doc('driverPushTokens/' + tokenId);
    const stored = await tokenRef.get();
    if (stored.exists && stored.data()?.driverUid !== uid)
      throw new HttpsError('permission-denied', 'Este dispositivo está associado a outra conta.');
    if (!owned && existing.size >= PUSH_TOKEN_LIMIT)
      throw new HttpsError('resource-exhausted', 'Limite de dispositivos atingido. Revogue um dispositivo antigo.');
    await tokenRef.set({
      token: parsed.data.token,
      driverUid: uid,
      tenantId: LEGACY_TENANT,
      updatedAt: FieldValue.serverTimestamp(),
      ...(stored.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    return { ok: true };
  },
);

export const revokeDriverPushToken = onCall(
  { region, timeoutSeconds: 15, memory: '256MiB', enforceAppCheck },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Faça login.');
    const parsed = tokenSchema.safeParse(request.data);
    if (!parsed.success || !validFcmToken(parsed.data.token))
      throw new HttpsError('invalid-argument', 'Token inválido.');
    const ref = getFirestore().doc('driverPushTokens/' + driverPushTokenId(parsed.data.token));
    const snap = await ref.get();
    if (snap.exists && snap.data()?.driverUid === request.auth.uid) await ref.delete();
    return { ok: true };
  },
);

// Delivery transactions remain the source of truth. This trigger is only a hint
// to inspect the authenticated portal; never include order/customer details.
export const notifyDriverOnAssignment = onDocumentWritten(
  { document: 'deliveries/{deliveryId}', region, retry: false },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    if (!isPushAssignment(before, after)) return;
    if (after?.brandId !== LEGACY_TENANT || !after.driverId) return;
    const db = getFirestore();
    const uid = String(after.driverId);
    const deliveryId = event.params.deliveryId;
    const eventRef = db.doc('driverPushDispatches/' + driverPushTokenId(event.id));
    try {
      await eventRef.create({
        tenantId: LEGACY_TENANT,
        driverUid: uid,
        deliveryId,
        state: 'PROCESSING',
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      // Duplicate Firestore event; avoid a second notification.
      if ((error as { code?: number }).code === 6) return;
      throw error;
    }

    const latest = await db.doc('deliveries/' + deliveryId).get();
    if (latest.data()?.status !== 'ASSIGNED' || latest.data()?.driverId !== uid) {
      await eventRef.update({ state: 'STALE', completedAt: FieldValue.serverTimestamp() });
      return;
    }
    try {
      await requireActiveDriver(uid);
    } catch {
      await eventRef.update({ state: 'INELIGIBLE', completedAt: FieldValue.serverTimestamp() });
      return;
    }
    const subscriptions = await db.collection('driverPushTokens').where('driverUid', '==', uid).get();
    const owned = subscriptions.docs.filter((doc) => doc.data().tenantId === LEGACY_TENANT
      && validFcmToken(doc.data().token)).slice(0, PUSH_TOKEN_LIMIT);
    if (owned.length === 0) {
      await eventRef.update({ state: 'NO_SUBSCRIPTIONS', completedAt: FieldValue.serverTimestamp() });
      return;
    }
    const info = safeDeliveryPushData(deliveryId);
    try {
      const result = await getMessaging().sendEachForMulticast({
        tokens: owned.map((doc) => String(doc.data().token)),
        data: { title: info.title, body: info.body, link: info.link },
        webpush: { headers: { TTL: '120', Urgency: 'high' } },
      });
      // Ignore invalid registration tokens, never log token values.
      await Promise.all(result.responses.map(async (item, index) => {
        if (!item.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(item.error?.code ?? '')) {
          await owned[index].ref.delete();
        }
      }));
      await eventRef.update({
        state: result.failureCount ? 'PARTIAL' : 'SENT',
        sentCount: result.successCount,
        failedCount: result.failureCount,
        completedAt: FieldValue.serverTimestamp(),
      });
    } catch (cause) {
      logger.error('Driver push dispatch failed', { deliveryId, eventId: event.id, reason: cause instanceof Error ? cause.message : 'unknown' });
      await eventRef.update({ state: 'FAILED', completedAt: FieldValue.serverTimestamp() });
      // In-app listener remains fallback. No retry loops sending duplicate pushes.
    }
  },
);
