import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { beforeAll, describe, expect, it } from 'vitest';

if (!getApps().length)
  initializeApp({
    projectId: process.env.GCLOUD_PROJECT || 'sushi-cbfd2',
  });
const db = getFirestore();
const endpoint =
  'http://127.0.0.1:5001/sushi-cbfd2/southamerica-east1/createOrder';
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

async function call(data: unknown) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  return {
    status: response.status,
    body: (await response.json()) as {
      result?: Record<string, unknown>;
      error?: { message?: string };
    },
  };
}

beforeAll(async () => {
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
  });
  it('é idempotente para retry com a mesma chave', async () => {
    const clientRequestId = crypto.randomUUID();
    const first = await call({ ...basePayload, clientRequestId });
    const second = await call({ ...basePayload, clientRequestId });
    expect(first.body.result?.publicCode).toBe(second.body.result?.publicCode);
    expect(second.body.result?.idempotent).toBe(true);
  });
  it('rejeita total adulterado', async () => {
    const response = await call({
      ...basePayload,
      clientRequestId: crypto.randomUUID(),
      clientPreviewTotalCents: 1,
    });
    expect(response.status).not.toBe(200);
    expect(response.body.error?.message).toMatch(/novo total/i);
  });
});
