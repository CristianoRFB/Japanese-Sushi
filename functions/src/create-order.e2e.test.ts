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
