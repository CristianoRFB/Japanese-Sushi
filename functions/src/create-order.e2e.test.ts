import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

if (process.env.FIRESTORE_EMULATOR_PORT)
  process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${process.env.FIRESTORE_EMULATOR_PORT}`;
if (!getApps().length)
  initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'sushi-cbfd2',
  });
const db = getFirestore();
function emulatorBaseUrl(hostVariable: string, portVariable: string, fallbackPort: string) {
  const configuredPort = process.env[portVariable];
  if (configuredPort) return `http://127.0.0.1:${configuredPort}`;
  const configuredHost = process.env[hostVariable];
  return `http://${configuredHost || `127.0.0.1:${fallbackPort}`}`;
}

const functionsBaseUrl = emulatorBaseUrl(
  'FUNCTIONS_EMULATOR_HOST',
  'FUNCTIONS_EMULATOR_PORT',
  '5001',
);
const authBaseUrl = emulatorBaseUrl(
  'FIREBASE_AUTH_EMULATOR_HOST',
  'AUTH_EMULATOR_PORT',
  '9099',
);
const endpoint =
  `${functionsBaseUrl}/sushi-cbfd2/southamerica-east1/createOrder`;
const authEndpoint =
  `${authBaseUrl}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=owner-test-key`;
const basePayload = {
  unitId: 'santa-fe-do-sul',
  customer: { name: 'Cliente Teiko', whatsapp: '17999999999' },
  items: [
    { productId: 'simple', sizeId: 'unico', quantity: 1, selections: [] },
  ],
  fulfillment: { mode: 'PICKUP' },
  payment: { method: 'PIX', needsChange: false },
  clientPreviewTotalCents: 1800,
};
let idToken = '';

async function fetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });
  try {
    return { response, body: (await response.json()) as unknown };
  } catch {
    throw new Error(
      `E2E recebeu resposta não-JSON em ${url}: ${response.status}`,
    );
  }
}

async function call(data: unknown) {
  const { response, body } = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });
  return {
    status: response.status,
    body: body as {
      result?: Record<string, unknown>;
      error?: { message?: string };
    },
  };
}

beforeAll(async () => {
  const { response: authResponse, body: authBody } = await fetchJson(authEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!authResponse.ok || !(authBody as { idToken?: string }).idToken)
    throw new Error('Não foi possível criar a sessão anônima do E2E.');
  idToken = (authBody as { idToken: string }).idToken;
  await db.doc('storePublicConfig/main').set({
    brandId: 'teiko',
    storeName: 'Teiko Sushi',
    defaultUnitId: 'santa-fe-do-sul',
    units: [
      {
        id: 'santa-fe-do-sul',
        brandId: 'teiko',
        name: 'Teiko Sushi',
        city: 'Santa Fé do Sul/SP',
        active: true,
      },
    ],
    whatsappEnabled: false,
    orderingEnabled: true,
    enforceHours: false,
    timezone: 'America/Sao_Paulo',
    hours: [],
    fulfillmentModes: ['PICKUP'],
    paymentMethods: ['PIX'],
    deliveryConfig: { mode: 'NONE' },
    status: 'ACTIVE',
  });
  await db
    .doc('categories/teiko')
    .set({ brandId: 'teiko', name: 'Sushi', active: true, displayOrder: 1 });
  await db.doc('products/simple').set({
    brandId: 'teiko',
    name: 'Sushi simples',
    slug: 'simples',
    description: '',
    active: true,
    categoryId: 'teiko',
    productType: 'SIMPLE',
    displayOrder: 1,
    sizes: [
      {
        id: 'unico',
        label: 'Único',
        active: true,
        basePriceCents: 1800,
        displayOrder: 1,
      },
    ],
    modifierGroupIds: [],
    unitIds: ['santa-fe-do-sul'],
  });
}, 60_000);

const reservationEndpoint = `${functionsBaseUrl}/sushi-cbfd2/southamerica-east1/createReservation`;

describe('createReservation da Teiko', () => {
  it('persiste ownerUid, é idempotente e rejeita data inválida no servidor', async () => {
    const clientRequestId = crypto.randomUUID();
    const date = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const payload = { clientRequestId, unitId: 'santa-fe-do-sul',
      name: 'Cliente Teste', whatsapp: '17999999999', date, time: '19:00', people: 2 };
    const send = async (data: unknown) => {
      const { response, body } = await fetchJson(reservationEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ data }),
      });
      return { status: response.status, body: body as { result?: { reservationId?: string }, error?: { message?: string } } };
    };
    const first = await send(payload);
    const second = await send(payload);
    expect(first.status).toBe(200);
    expect(first.body.result?.reservationId).toBeTruthy();
    expect(second.body.result?.reservationId).toBe(first.body.result?.reservationId);
    const reservation = await db.doc('reservations/' + first.body.result?.reservationId).get();
    expect(reservation.data()?.ownerUid).toBeTruthy();
    expect(reservation.data()?.date).toBe(date);
    const invalid = await send({ ...payload, clientRequestId: crypto.randomUUID(), date: '2027-02-29' });
    expect(invalid.status).not.toBe(200);
  }, 45_000);
});

describe('createOrder da Teiko', () => {
  it('persiste um pedido e devolve o código público', async () => {
    const clientRequestId = crypto.randomUUID();
    const response = await call({ ...basePayload, clientRequestId });
    expect(response.status).toBe(200);
    expect(response.body.result?.orderNumber).toMatch(/^#T/);
    expect(response.body.result?.totalCents).toBe(1800);
    expect(
      (
        await db
          .collection('orders')
          .where('clientRequestId', '==', clientRequestId)
          .get()
      ).size,
    ).toBe(1);
  }, 30_000);
  it('é idempotente para retry com a mesma chave', async () => {
    const clientRequestId = crypto.randomUUID();
    const first = await call({ ...basePayload, clientRequestId });
    const second = await call({ ...basePayload, clientRequestId });
    expect(first.body.result?.publicCode).toBe(second.body.result?.publicCode);
    expect(second.body.result?.idempotent).toBe(true);
  }, 30_000);
  it('rejeita total adulterado', async () => {
    const response = await call({
      ...basePayload,
      clientRequestId: crypto.randomUUID(),
      clientPreviewTotalCents: 1,
    });
    expect(response.status).not.toBe(200);
    expect(response.body.error?.message).toMatch(/novo total/i);
  }, 30_000);
});


describe('createReservation: horários no servidor', () => {
  it('rejeita reservas quando o expediente é obrigatório e a loja não abre', async () => {
    const configRef = db.doc('storePublicConfig/main');
    await configRef.update({ enforceHours: true, hours: [] });
    try {
      const payload = {
        clientRequestId: crypto.randomUUID(), unitId: 'santa-fe-do-sul',
        name: 'Cliente Teste', whatsapp: '17999999999',
        date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        time: '19:00', people: 2,
      };
      const { response, body } = await fetchJson(
        functionsBaseUrl + '/sushi-cbfd2/southamerica-east1/createReservation',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + idToken },
          body: JSON.stringify({ data: payload }),
        },
      );
      expect(response.ok).toBe(false);
      expect(JSON.stringify(body)).toMatch(/horário|funcionamento/i);
    } finally {
      await configRef.update({ enforceHours: false });
    }
  }, 40_000);
});

describe('driver FCM opt-in — apenas motoboy autorizado', () => {
  it('registra e revoga token; cliente anônimo não pode se inscrever', async () => {
    const email = 'driver-' + crypto.randomUUID() + '@example.test';
    const { response: authResponse, body: authBody } = await fetchJson(authEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'emulator-only-strong-password', returnSecureToken: true }),
    });
    expect(authResponse.ok).toBe(true);
    const driverUid = (authBody as { localId?: string }).localId!;
    const driverToken = (authBody as { idToken?: string }).idToken!;
    await db.doc('users/' + driverUid).set({ role: 'driver', brandId: 'teiko', active: true });
    await db.doc('deliveryDrivers/' + driverUid).set({
      name: 'Motorista de teste', brandId: 'teiko', enabled: true, status: 'AVAILABLE',
    });
    const token = 'e2e_'.concat('T'.repeat(90));
    const payload = { token };
    const callPush = async (name: string, bearer: string) => fetchJson(
      functionsBaseUrl + '/sushi-cbfd2/southamerica-east1/' + name,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + bearer },
        body: JSON.stringify({ data: payload }),
      },
    );
    const rejected = await callPush('registerDriverPushToken', idToken);
    expect(rejected.response.ok).toBe(false);
    const registered = await callPush('registerDriverPushToken', driverToken);
    expect(registered.response.ok).toBe(true);
    const { createHash } = await import('node:crypto');
    const id = createHash('sha256').update(token).digest('hex');
    expect((await db.doc('driverPushTokens/' + id).get()).data()?.driverUid).toBe(driverUid);
    const revoked = await callPush('revokeDriverPushToken', driverToken);
    expect(revoked.response.ok).toBe(true);
    expect((await db.doc('driverPushTokens/' + id).get()).exists).toBe(false);
  }, 50_000);
});
