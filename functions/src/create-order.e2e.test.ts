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

describe('resolvePublicTenant — seleção pública sem dados privilegiados', () => {
  it('mantém fallback Teiko e resolve Beta sem expor assinatura ou memberships', async () => {
    const call = async (slug: string) => fetchJson(
      functionsBaseUrl + '/sushi-cbfd2/southamerica-east1/resolvePublicTenant',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: { slug } }),
      },
    );
    const teiko = await call('teiko');
    expect(teiko.response.ok).toBe(true);
    expect((teiko.body as { result: { legacyFallback?: boolean } }).result.legacyFallback).toBe(true);
    await db.doc('tenants/beta-sushi').set({
      id: 'beta-sushi', slug: 'beta-sushi', status: 'ACTIVE',
      branding: { displayName: 'Beta de testes', primaryColor: '#123456', logoUrl: 'javascript:alert(1)' },
      planId: 'INTERNAL_SECRET', entitlementOverrides: { hidden: 'value' },
    });
    const beta = await call('beta-sushi');
    expect(beta.response.ok).toBe(true);
    const result = (beta.body as { result: Record<string, unknown> }).result;
    expect(result.id).toBe('beta-sushi');
    expect((result.branding as { displayName: string }).displayName).toBe('Beta de testes');
    expect((result.branding as { logoUrl?: string }).logoUrl).toBeUndefined();
    expect(result.orderingEnabled).toBe(false);
    await db.doc('tenants/beta-sushi').update({ orderingEnabled: true });
    const enabled = await call('beta-sushi');
    expect((enabled.body as { result: { orderingEnabled: boolean } }).result.orderingEnabled).toBe(true);
    await db.doc('tenants/beta-sushi').update({ migrationState: 'EMULATOR_COPY_ONLY' });
    const migrated = await call('beta-sushi');
    expect((migrated.body as { result: { orderingEnabled: boolean } }).result.orderingEnabled).toBe(false);
    await db.doc('tenants/beta-sushi').update({ migrationState: 'NONE' });
    expect(JSON.stringify(result)).not.toContain('INTERNAL_SECRET');
    const missing = await call('unknown-sushi');
    expect(missing.response.ok).toBe(false);
    await db.doc('tenants/beta-sushi').update({ status: 'SUSPENDED' });
    const suspended = await call('beta-sushi');
    expect((suspended.body as { result: { status: string } }).result.status).toBe('SUSPENDED');
    expect((suspended.body as { result: { orderingEnabled: boolean } }).result.orderingEnabled).toBe(false);
  }, 40_000);
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

describe('F4 tenant admin — claims, membership, suspensão e A×B', () => {
  it('só o Platform Owner provisionado no Auth pode alterar tenants e memberships', async () => {
    const { getAuth } = await import('firebase-admin/auth');
    const email = 'platform-' + crypto.randomUUID() + '@example.test';
    const password = 'strong-emulator-only-password';
    const { response, body } = await fetchJson(authEndpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    expect(response.ok).toBe(true);
    const uid = (body as { localId: string }).localId;
    const tokenBefore = (body as { idToken: string }).idToken;
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const a = 'e2e-a-' + suffix;
    const b = 'e2e-b-' + suffix;
    const callTenant = async (fn: string, token: string, data: unknown) => fetchJson(
      functionsBaseUrl + '/sushi-cbfd2/southamerica-east1/' + fn,
      { method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ data }) },
    );
    expect((await callTenant('platformCreateTenant', tokenBefore, { slug: a, displayName: 'Restaurante A' })).response.ok).toBe(false);
    await getAuth().setCustomUserClaims(uid, { platform_owner: true });
    const login = await fetchJson(
      authBaseUrl + '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=owner-test-key',
      { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }) },
    );
    const ownerToken = (login.body as { idToken: string }).idToken;
    expect(ownerToken).toBeTruthy();
    expect((await callTenant('platformCreateTenant', ownerToken, { slug: 'teiko', displayName: 'Teiko clone' })).response.ok).toBe(false);
    expect((await callTenant('platformCreateTenant', ownerToken, { slug: a, displayName: 'Restaurante A' })).response.ok).toBe(true);
    expect((await callTenant('platformCreateTenant', ownerToken, { slug: b, displayName: 'Restaurante B' })).response.ok).toBe(true);
    expect((await callTenant('platformCreateTenant', ownerToken, { slug: a, displayName: 'Duplicado' })).response.ok).toBe(false);

    const member = await fetchJson(authEndpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    const memberUid = (member.body as { localId: string }).localId;
    const memberToken = (member.body as { idToken: string }).idToken;
    const grant = { tenantId: a, userUid: memberUid, role: 'staff', active: true };
    expect((await callTenant('platformSetMembership', ownerToken, grant)).response.ok).toBe(true);
    expect((await callTenant('platformSetMembership', memberToken, { ...grant, role: 'tenant_owner' })).response.ok).toBe(false);
    const accessA = await callTenant('getMyTenantAccess', memberToken, { tenantId: a });
    expect(accessA.response.ok).toBe(true);
    expect((accessA.body as { result?: { role?: string } }).result?.role).toBe('staff');
    expect((await callTenant('getMyTenantAccess', memberToken, { tenantId: b })).response.ok).toBe(false);
    expect((await callTenant('platformSetTenantStatus', ownerToken, { tenantId: a, status: 'SUSPENDED' })).response.ok).toBe(true);
    expect((await callTenant('getMyTenantAccess', memberToken, { tenantId: a })).response.ok).toBe(false);
    expect((await callTenant('platformSetTenantStatus', ownerToken, { tenantId: a, status: 'ACTIVE' })).response.ok).toBe(true);
    expect((await callTenant('platformSetMembership', ownerToken, { ...grant, active: false })).response.ok).toBe(true);
    expect((await callTenant('getMyTenantAccess', memberToken, { tenantId: a })).response.ok).toBe(false);

    // Even a token issued when the claim was active loses authorization
    // immediately after revocation in the Auth record.
    await getAuth().setCustomUserClaims(uid, { platform_owner: false });
    expect((await callTenant('platformSetTenantStatus', ownerToken, { tenantId: b, status: 'SUSPENDED' })).response.ok).toBe(false);
    const audit = await db.collection('platformAuditEvents').where('tenantId', '==', a).get();
    expect(audit.size).toBeGreaterThan(2);
  }, 100_000);
});

describe('F4 catalog scoped writes — owner, revocation, product isolation', () => {
  it('grava catálogo simples somente no tenant próprio e respeita idempotência', async () => {
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const a = 'catalog-a-' + suffix;
    const b = 'catalog-b-' + suffix;
    const email = 'tenant-owner-' + suffix + '@example.test';
    const auth = await fetchJson(authEndpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'only-for-emulator', returnSecureToken: true }),
    });
    const token = (auth.body as { idToken: string }).idToken;
    const uid = (auth.body as { localId: string }).localId;
    await db.doc('tenants/' + a).set({ slug: a, status: 'ACTIVE' });
    await db.doc('tenants/' + b).set({ slug: b, status: 'ACTIVE' });
    await db.doc('tenantMemberships/' + a + '_' + uid).set({
      tenantId: a, userUid: uid, active: true, role: 'tenant_owner',
    });
    const callCat = async (name: string, payload: unknown) => fetchJson(
      functionsBaseUrl + '/sushi-cbfd2/southamerica-east1/' + name,
      { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ data: payload }) },
    );
    const category = { tenantId: a, categoryId: 'sushis', name: 'Sushis' };
    expect((await callCat('tenantUpsertCategory', category)).response.ok).toBe(true);
    const product = { tenantId: a, productId: 'salmao', categoryId: 'sushis',
      name: 'Sushi Salmão', description: 'Categoria de teste', priceCents: 1990, active: true };
    const beforeCatalog = await callCat('tenantGetManageCatalog', { tenantId: a });
    expect(beforeCatalog.response.ok).toBe(true);
    const first = await callCat('tenantUpsertSimpleProduct', product);
    expect(first.response.ok).toBe(true);
    const management = await callCat('tenantGetManageCatalog', { tenantId: a });
    const listed = (management.body as { result: { products: Array<{ id: string }> } }).result.products;
    expect(listed.some((x) => x.id === 'salmao')).toBe(true);
    const deniedList = await callCat('tenantGetManageCatalog', { tenantId: b });
    expect(deniedList.response.ok).toBe(false);
    const retry = await callCat('tenantUpsertSimpleProduct', product);
    expect(retry.response.ok).toBe(true);
    expect((retry.body as { result: { updated: boolean } }).result.updated).toBe(false);
    const snapshot = await db.doc('tenants/' + a + '/products/salmao').get();
    expect(snapshot.data()?.sizes?.[0]?.basePriceCents).toBe(1990);
    expect((await db.doc('tenants/' + b + '/products/salmao').get()).exists).toBe(false);
    expect((await callCat('tenantUpsertSimpleProduct', { ...product, tenantId: b })).response.ok).toBe(false);
    expect((await callCat('tenantUpsertSimpleProduct', { ...product, priceCents: -100 })).response.ok).toBe(false);
    await db.doc('tenantMemberships/' + a + '_' + uid).update({ active: false });
    expect((await callCat('tenantUpsertSimpleProduct', { ...product, priceCents: 1999 })).response.ok).toBe(false);
  }, 90_000);
});


describe('F4 tenant pickup order transaction and owner isolation', () => {
  it('gates ordering, recalculates prices, deduplicates requests, protects A x B', async () => {
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const a = 'order-a-' + suffix;
    const b = 'order-b-' + suffix;
    await db.doc('tenants/' + a).set({ slug: a, status: 'ACTIVE', orderingEnabled: false });
    await db.doc('tenants/' + b).set({ slug: b, status: 'ACTIVE', orderingEnabled: true });
    for (const [tenantId, price] of [[a, 1800], [b, 900]] as const) {
      await db.doc('tenants/' + tenantId + '/products/simple').set({
        tenantId, name: 'Sushi de teste', active: true, productType: 'SIMPLE',
        modifierGroupIds: [], sizes: [{ id: 'unico', active: true, basePriceCents: price }],
      });
    }
    const input = {
      tenantId: a, clientRequestId: crypto.randomUUID(), customerName: 'Cliente Teste',
      items: [{ productId: 'simple', quantity: 2 }], clientPreviewTotalCents: 3600,
    };
    const invoke = (name: string, data: unknown, bearer = idToken) => fetchJson(
      functionsBaseUrl + '/sushi-cbfd2/southamerica-east1/' + name,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + bearer },
        body: JSON.stringify({ data }),
      },
    );
    expect((await invoke('createTenantPickupOrder', input)).response.ok).toBe(false);
    await db.doc('tenants/' + a).update({ orderingEnabled: true });
    expect((await invoke('createTenantPickupOrder', { ...input, clientPreviewTotalCents: 1 })).response.ok).toBe(false);
    const results = await Promise.all([
      invoke('createTenantPickupOrder', input), invoke('createTenantPickupOrder', input),
    ]);
    expect(results.every(x => x.response.ok)).toBe(true);
    const first = (results[0].body as { result: { orderId: string; totalCents: number } }).result;
    const second = (results[1].body as { result: { orderId: string } }).result;
    expect(first.totalCents).toBe(3600);
    expect(first.orderId).toBe(second.orderId);
    expect((await db.collection('tenants/' + a + '/orders').get()).size).toBe(1);
    expect((await db.collection('tenants/' + b + '/orders').get()).size).toBe(0);
    expect((await invoke('createTenantPickupOrder', { ...input, items: [{ productId: 'simple', quantity: 1 }] })).response.ok).toBe(false);
    expect((await invoke('createTenantPickupOrder', { ...input, tenantId: b, clientRequestId: crypto.randomUUID() })).response.ok).toBe(false);
    const mine = await invoke('getMyTenantOrder', { tenantId: a, orderId: first.orderId });
    expect(mine.response.ok).toBe(true);
    expect((mine.body as { result: { pricing: { totalCents: number } } }).result.pricing.totalCents).toBe(3600);
    expect((await invoke('getMyTenantOrder', { tenantId: b, orderId: first.orderId })).response.ok).toBe(false);
    const other = await fetchJson(authEndpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    const otherToken = (other.body as { idToken: string }).idToken;
    expect((await invoke('getMyTenantOrder', { tenantId: a, orderId: first.orderId }, otherToken)).response.ok).toBe(false);
    await db.doc('tenants/' + a).update({ status: 'SUSPENDED' });
    expect((await invoke('createTenantPickupOrder', { ...input, clientRequestId: crypto.randomUUID() })).response.ok).toBe(false);
    // The customer does not lose access to historical data after suspension.
    expect((await invoke('getMyTenantOrder', { tenantId: a, orderId: first.orderId })).response.ok).toBe(true);
  }, 100_000);
});


describe('F4 pickup KDS tenant A/B security', () => {
  it('staff atualiza apenas o próprio tenant e não conclui pedido sem caixa/financeiro', async () => {
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const a = 'kds-a-' + suffix;
    const b = 'kds-b-' + suffix;
    await db.doc('tenants/' + a).set({ slug: a, status: 'ACTIVE', orderingEnabled: true });
    await db.doc('tenants/' + b).set({ slug: b, status: 'ACTIVE', orderingEnabled: true });
    await db.doc('tenants/' + a + '/products/simple').set({
      tenantId: a, name: 'Sushi de teste', active: true, productType: 'SIMPLE',
      modifierGroupIds: [], sizes: [{ id: 'unico', active: true, basePriceCents: 1700 }],
    });
    const invoke = (name: string, data: unknown, token: string) => fetchJson(
      functionsBaseUrl + '/sushi-cbfd2/southamerica-east1/' + name, {
        method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ data }),
      },
    );
    const orderResult = await invoke('createTenantPickupOrder', {
      tenantId: a, clientRequestId: crypto.randomUUID(), customerName: 'Cliente de teste',
      items: [{ productId: 'simple', quantity: 1 }], clientPreviewTotalCents: 1700,
    }, idToken);
    expect(orderResult.response.ok).toBe(true);
    const orderId = (orderResult.body as { result: { orderId: string } }).result.orderId;
    const auth = await fetchJson(authEndpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'staff-' + suffix + '@example.test',
        password: 'synthetic-emulator-password', returnSecureToken: true }),
    });
    const uid = (auth.body as { localId: string }).localId;
    const staffToken = (auth.body as { idToken: string }).idToken;
    await db.doc('tenantMemberships/' + a + '_' + uid).set({
      tenantId: a, userUid: uid, role: 'staff', active: true,
    });
    const list = await invoke('tenantListPickupOrders', { tenantId: a }, staffToken);
    expect(list.response.ok).toBe(true);
    expect((list.body as { result: { orders: Array<{ id: string }> } }).result.orders.some(x => x.id === orderId)).toBe(true);
    expect((await invoke('tenantListPickupOrders', { tenantId: b }, staffToken)).response.ok).toBe(false);
    const update = (tenantId: string, status: string) => invoke('tenantUpdatePickupStatus', {
      tenantId, orderId, status,
    }, staffToken);
    expect((await update(b, 'CONFIRMED')).response.ok).toBe(false);
    expect((await update(a, 'READY')).response.ok).toBe(false);
    expect((await update(a, 'CONFIRMED')).response.ok).toBe(true);
    expect((await update(a, 'PREPARING')).response.ok).toBe(true);
    expect((await update(a, 'READY')).response.ok).toBe(true);
    expect((await update(a, 'COMPLETED')).response.ok).toBe(false);
    expect((await db.doc('tenants/' + a + '/orders/' + orderId).get()).data()?.status).toBe('READY');
    await db.doc('tenantMemberships/' + a + '_' + uid).update({ active: false });
    expect((await update(a, 'CANCELLED')).response.ok).toBe(false);
  }, 100_000);
});


describe('F4 pickup cash settlement and tenant financial isolation', () => {
  it('keeps orders unsettled without cash register; settles once atomically; rejects cross-tenant, double posting and revoked membership', async () => {
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const a = 'cash-a-' + suffix, b = 'cash-b-' + suffix;
    const ownerEmail = 'cash-owner-' + suffix + '@example.test';
    const auth = await fetchJson(authEndpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail,
        password: 'synthetic-emulator-password', returnSecureToken: true }),
    });
    expect(auth.response.ok).toBe(true);
    const uid = (auth.body as { localId: string }).localId;
    const ownerToken = (auth.body as { idToken: string }).idToken;
    await db.doc('tenants/' + a).set({ slug: a, status: 'ACTIVE', orderingEnabled: true });
    await db.doc('tenants/' + b).set({ slug: b, status: 'ACTIVE', orderingEnabled: true });
    await db.doc('tenantMemberships/' + a + '_' + uid).set({
      tenantId: a, userUid: uid, role: 'tenant_owner', active: true,
    });
    await db.doc('tenants/' + a + '/products/simple').set({
      tenantId: a, name: 'Combo sintético', active: true, productType: 'SIMPLE',
      modifierGroupIds: [], sizes: [{ id: 'unico', active: true, basePriceCents: 2450 }],
    });
    const invoke = (name: string, data: unknown, bearer = ownerToken) => fetchJson(
      functionsBaseUrl + '/sushi-cbfd2/southamerica-east1/' + name, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + bearer },
        body: JSON.stringify({ data }),
      },
    );
    const create = await invoke('createTenantPickupOrder', {
      tenantId: a, clientRequestId: crypto.randomUUID(), customerName: 'Cliente Sintético',
      items: [{ productId: 'simple', quantity: 2 }], clientPreviewTotalCents: 4900,
    }, idToken);
    expect(create.response.ok).toBe(true);
    const orderId = (create.body as { result: { orderId: string } }).result.orderId;
    for (const status of ['CONFIRMED', 'PREPARING', 'READY']) {
      const progressed = await invoke('tenantUpdatePickupStatus', { tenantId: a, orderId, status });
      expect(progressed.response.ok).toBe(true);
    }
    const settlement = { tenantId: a, orderId, cashReceivedCents: 5000, confirmCashReceived: true };
    expect((await invoke('tenantSettlePickupCash', settlement)).response.ok).toBe(false);
    expect((await invoke('tenantOpenPickupCashRegister', { tenantId: b, openingFloatCents: 3000 })).response.ok).toBe(false);
    expect((await invoke('tenantOpenPickupCashRegister', { tenantId: a, openingFloatCents: 3000 })).response.ok).toBe(true);
    expect((await invoke('tenantOpenPickupCashRegister', { tenantId: a, openingFloatCents: 3000 })).response.ok).toBe(false);
    expect((await invoke('tenantSettlePickupCash', { ...settlement, cashReceivedCents: 4800 })).response.ok).toBe(false);
    expect((await invoke('tenantSettlePickupCash', { ...settlement, confirmCashReceived: false })).response.ok).toBe(false);
    expect((await invoke('tenantSettlePickupCash', { ...settlement, tenantId: b })).response.ok).toBe(false);
    const settled = await Promise.all([
      invoke('tenantSettlePickupCash', settlement),
      invoke('tenantSettlePickupCash', settlement),
    ]);
    expect(settled.every(x => x.response.ok)).toBe(true);
    const first = (settled[0].body as { result: { amountCents: number } }).result;
    expect(first.amountCents).toBe(4900);
    expect((await invoke('tenantSettlePickupCash', { ...settlement, cashReceivedCents: 6000 })).response.ok).toBe(false);
    const [order, register, movement, ledger] = await Promise.all([
      db.doc('tenants/' + a + '/orders/' + orderId).get(),
      db.doc('tenants/' + a + '/cashRegisters/current').get(),
      db.doc('tenants/' + a + '/cashMovements/SALE_' + orderId).get(),
      db.doc('tenants/' + a + '/financeEntries/SALE_' + orderId).get(),
    ]);
    expect(order.data()?.status).toBe('COMPLETED');
    expect(order.data()?.payment?.cashChangeCents).toBe(100);
    expect(register.data()?.expectedCashCents).toBe(7900);
    expect(register.data()?.salesCount).toBe(1);
    expect(movement.data()?.amountCents).toBe(4900);
    expect(ledger.data()?.amountCents).toBe(4900);
    expect((await db.collection('tenants/' + b + '/financeEntries').get()).empty).toBe(true);
    expect((await invoke('tenantUpdatePickupStatus', { tenantId: a, orderId, status: 'CANCELLED' })).response.ok).toBe(false);
    const close = await invoke('tenantClosePickupCashRegister', { tenantId: a, countedCashCents: 7850 });
    expect(close.response.ok).toBe(true);
    expect((close.body as { result: { varianceCents: number } }).result.varianceCents).toBe(-50);
    expect((await invoke('tenantClosePickupCashRegister', { tenantId: a, countedCashCents: 7850 })).response.ok).toBe(false);
    const historical = await db.doc('tenants/' + a + '/cashRegisterSessions/' + register.data()?.sessionId).get();
    expect(historical.data()?.status).toBe('CLOSED');
    expect(historical.data()?.cashSalesCents).toBe(4900);
    expect((await invoke('tenantSettlePickupCash', settlement)).response.ok).toBe(true);
    await db.doc('tenantMemberships/' + a + '_' + uid).update({ active: false });
    expect((await invoke('tenantOpenPickupCashRegister', { tenantId: a, openingFloatCents: 0 })).response.ok).toBe(false);
    expect((await invoke('tenantGetPickupCashRegister', { tenantId: b })).response.ok).toBe(false);
  }, 115_000);
});
