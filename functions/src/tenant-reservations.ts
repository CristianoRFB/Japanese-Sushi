import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { validTenantSlug, membershipDocumentId } from '../../shared/tenancy.js';
import { requireTenantMembership } from './tenant-admin.js';

const options = {
  region: 'southamerica-east1', timeoutSeconds: 30, memory: '256MiB' as const,
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};
const tenantId = z.string().refine(validTenantSlug);
const reservationId = z.string().regex(/^[A-Za-z0-9_-]{10,128}$/);
const schema = z.object({
  tenantId, clientRequestId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^\d{10,13}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  people: z.number().int().min(1).max(30),
  notes: z.string().trim().max(500).default(''),
}).strict();
const idSchema = z.object({ tenantId, reservationId }).strict();

function parse<T>(s: z.ZodType<T>, data: unknown): T {
  const parsed = s.safeParse(data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Dados de reserva inválidos.');
  return parsed.data;
}
function todayInBrazil() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const find = (kind: string) => parts.find(p => p.type === kind)?.value || '';
  return find('year') + '-' + find('month') + '-' + find('day');
}
function validateDate(date: string): void {
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    throw new HttpsError('invalid-argument', 'Data inválida.');
  const today = todayInBrazil();
  const max = new Date(today + 'T00:00:00.000Z');
  max.setUTCDate(max.getUTCDate() + 365);
  if (date < today || date > max.toISOString().slice(0, 10))
    throw new HttpsError('invalid-argument', 'Data fora da janela de reservas.');
}

// Reserved for NEXT: Pro/Premium EntitlementService and feature gating.
// Until the plan enforcement exists, NO real restaurant can enable reservations
// simply by editing a tenant field. This is a core implementation/emulator gate.
function canAcceptReservation(tenant: FirebaseFirestore.DocumentData | undefined) {
  const local = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
  return local && tenant?.status === 'ACTIVE' && tenant?.reservationsEnabled === true
    && tenant?.migrationState !== 'EMULATOR_COPY_ONLY';
}
function requestHash(input: z.infer<typeof schema>): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
function ownReservation(data: FirebaseFirestore.DocumentData | undefined, uid: string, tenant: string) {
  return data?.ownerUid === uid && data?.tenantId === tenant;
}

export const tenantCreateReservation = onCall(options, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const input = parse(schema, request.data);
  validateDate(input.date);
  if ((await getAuth().getUser(uid)).disabled)
    throw new HttpsError('permission-denied', 'Conta desativada.');

  const db = getFirestore();
  const base = 'tenants/' + input.tenantId + '/';
  const requestRef = db.doc(base + 'reservationRequests/' + input.clientRequestId);
  const reservationRef = db.collection(base + 'reservations').doc();
  const tenantRef = db.doc('tenants/' + input.tenantId);
  const digest = requestHash(input);
  return await db.runTransaction(async tx => {
    const existing = await tx.get(requestRef);
    if (existing.exists) {
      if (existing.data()?.ownerUid !== uid || existing.data()?.requestHash !== digest)
        throw new HttpsError('already-exists', 'Tentativa de reserva já utilizada.');
      const prior = await tx.get(db.doc(base + 'reservations/' + existing.data()?.reservationId));
      if (!prior.exists || !ownReservation(prior.data(), uid, input.tenantId))
        throw new HttpsError('data-loss', 'Reserva idempotente inconsistente.');
      return { reservationId: prior.id, status: prior.data()?.status, idempotent: true };
    }
    const tenant = await tx.get(tenantRef);
    if (!canAcceptReservation(tenant.data()))
      throw new HttpsError('failed-precondition', 'Reservas indisponíveis neste restaurante.');
    const now = FieldValue.serverTimestamp();
    tx.create(reservationRef, {
      tenantId: input.tenantId, ownerUid: uid,
      name: input.name, phone: input.phone, date: input.date, time: input.time,
      people: input.people, notes: input.notes, status: 'REQUESTED',
      clientRequestId: input.clientRequestId,
      statusHistory: [{ status: 'REQUESTED', actor: 'customer', at: Timestamp.now() }],
      createdAt: now, updatedAt: now,
    });
    tx.create(requestRef, {
      tenantId: input.tenantId, ownerUid: uid, reservationId: reservationRef.id,
      requestHash: digest, createdAt: now,
    });
    return { reservationId: reservationRef.id, status: 'REQUESTED', idempotent: false };
  });
});

export const tenantGetMyReservation = onCall(options, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const input = parse(idSchema, request.data);
  if ((await getAuth().getUser(uid)).disabled)
    throw new HttpsError('permission-denied', 'Conta desativada.');
  const snap = await getFirestore().doc('tenants/' + input.tenantId + '/reservations/' + input.reservationId).get();
  if (!snap.exists || !ownReservation(snap.data(), uid, input.tenantId))
    throw new HttpsError('not-found', 'Reserva não encontrada.');
  const d = snap.data()!;
  return {
    reservationId: snap.id, status: d.status,
    name: d.name, date: d.date, time: d.time, people: d.people,
  };
});
export const tenantListReservations = onCall(options, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const input = parse(z.object({ tenantId }).strict(), request.data);
  await requireTenantMembership(uid, input.tenantId, ['tenant_owner', 'staff']);
  const snap = await getFirestore().collection('tenants/' + input.tenantId + '/reservations')
    .where('tenantId', '==', input.tenantId).limit(50).get();
  return { reservations: snap.docs.map(d => ({
    id: d.id, name: d.data().name, phone: d.data().phone,
    date: d.data().date, time: d.data().time,
    people: d.data().people, status: d.data().status, notes: d.data().notes,
  })).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)) };
});

const statusSchema = idSchema.extend({
  status: z.enum(['CONFIRMED', 'REFUSED', 'CANCELLED', 'COMPLETED']),
  reason: z.string().trim().max(300).default(''),
}).strict();
const transitions: Record<string, string[]> = {
  REQUESTED: ['CONFIRMED', 'REFUSED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
};
export const tenantSetReservationStatus = onCall(options, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const input = parse(statusSchema, request.data);
  const access = await requireTenantMembership(uid, input.tenantId, ['tenant_owner', 'staff']);
  const db = getFirestore();
  const tenantRef = db.doc('tenants/' + input.tenantId);
  const memberRef = db.doc('tenantMemberships/' + membershipDocumentId(input.tenantId, uid));
  const target = db.doc('tenants/' + input.tenantId + '/reservations/' + input.reservationId);
  const auditRef = db.collection('tenantAuditEvents').doc();
  return db.runTransaction(async tx => {
    const [tenant, member, reservation] = await Promise.all([
      tx.get(tenantRef), tx.get(memberRef), tx.get(target),
    ]);
    const m = member.data(), d = reservation.data();
    if (tenant.data()?.status !== 'ACTIVE' || m?.active !== true ||
      m.tenantId !== input.tenantId || m.userUid !== uid || m.role !== access.role)
      throw new HttpsError('permission-denied', 'Permissão revogada.');
    if (!reservation.exists || d?.tenantId !== input.tenantId)
      throw new HttpsError('not-found', 'Reserva não encontrada.');
    if (d.status === input.status)
      return { status: input.status, idempotent: true };
    if (!transitions[d.status]?.includes(input.status))
      throw new HttpsError('failed-precondition', 'Transição de reserva inválida.');
    if (input.status === 'CONFIRMED') {
      // Manual confirmation, NOT an availability/capacity claim. Staff must
      // validate capacity out-of-band until table capacity logic is implemented.
    }
    tx.update(target, {
      status: input.status, updatedAt: FieldValue.serverTimestamp(),
      statusHistory: FieldValue.arrayUnion({
        status: input.status, actorUid: uid, actorRole: access.role,
        at: Timestamp.now(), ...(input.reason && { reason: input.reason }),
      }),
    });
    tx.create(auditRef, {
      tenantId: input.tenantId, actorUid: uid, action: 'RESERVATION_STATUS_CHANGED',
      reservationId: input.reservationId, previousStatus: d.status,
      nextStatus: input.status, occurredAt: FieldValue.serverTimestamp(),
    });
    return { status: input.status, idempotent: false };
  });
});

export const tenantCancelMyReservation = onCall(options, async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sessão necessária.');
  const input = parse(idSchema, request.data);
  if ((await getAuth().getUser(uid)).disabled)
    throw new HttpsError('permission-denied', 'Conta desativada.');
  const db = getFirestore();
  const tenantRef = db.doc('tenants/' + input.tenantId);
  const target = db.doc('tenants/' + input.tenantId + '/reservations/' + input.reservationId);
  return db.runTransaction(async tx => {
    const [tenant, reservation] = await Promise.all([tx.get(tenantRef), tx.get(target)]);
    const d = reservation.data();
    if (tenant.data()?.status !== 'ACTIVE' || !reservation.exists || !ownReservation(d, uid, input.tenantId))
      throw new HttpsError('not-found', 'Reserva não encontrada.');
    if (d?.status === 'CANCELLED') return { status: 'CANCELLED', idempotent: true };
    if (d?.status !== 'REQUESTED' && d?.status !== 'CONFIRMED')
      throw new HttpsError('failed-precondition', 'Não é possível cancelar esta reserva.');
    tx.update(target, {
      status: 'CANCELLED', updatedAt: FieldValue.serverTimestamp(),
      statusHistory: FieldValue.arrayUnion({ status: 'CANCELLED', actor: 'customer', at: Timestamp.now() }),
    });
    return { status: 'CANCELLED', idempotent: false };
  });
});
