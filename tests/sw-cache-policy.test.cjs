const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');

const source = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8');

function setup({ offline = false } = {}) {
  const handlers = new Map();
  const stored = new Map([['/offline.html', 'OFFLINE_PUBLIC'], ['https://sushi.example/favicon.svg', 'CACHED_ICON']]);
  const cacheNames = new Set(['teiko-public-shell-v1', 'unrelated-cache']);
  const counters = { writes: 0, fetches: 0, claimed: false };
  const cache = {
    async addAll(paths) { assert.deepEqual(Array.from(paths), ['/offline.html', '/favicon.svg']); },
    async put() { counters.writes++; },
  };
  const fake = {
    URL,
    Set,
    Promise,
    self: {
      location: { origin: 'https://sushi.example' },
      addEventListener(name, cb) { handlers.set(name, cb); },
      skipWaiting() { return Promise.resolve(); },
      clients: { claim() { counters.claimed = true; return Promise.resolve(); } },
    },
    caches: {
      async open(name) { cacheNames.add(name); return cache; },
      async keys() { return [...cacheNames]; },
      async delete(name) { return cacheNames.delete(name); },
      async match(request) { return stored.get(typeof request === 'string' ? request : request.url); },
    },
    async fetch(request) {
      counters.fetches++;
      if (offline) throw new Error('network unreachable');
      return 'LIVE:' + request.url;
    },
    Response: { error: () => 'NETWORK_ERROR' },
  };
  runInNewContext(source, fake, { filename: 'public/sw.js' });
  function fire(name, props = {}) {
    let response;
    let awaited;
    const event = {
      ...props,
      respondWith(p) { response = Promise.resolve(p); },
      waitUntil(p) { awaited = Promise.resolve(p); },
    };
    handlers.get(name)(event);
    return { response, awaited };
  }
  return { fire, counters, cacheNames };
}

function request(path, mode = 'navigate', method = 'GET') {
  return { url: 'https://sushi.example' + path, mode, method };
}

test('instala somente assets públicos e remove cache antigo sem afetar terceiros', async () => {
  const { fire, cacheNames, counters } = setup();
  await fire('install').awaited;
  await fire('activate').awaited;
  assert.equal(cacheNames.has('teiko-public-shell-v1'), false);
  assert.equal(cacheNames.has('unrelated-cache'), true);
  assert.equal(cacheNames.has('sushi-public-shell-v2'), true);
  assert.equal(counters.claimed, true);
});

test('navegação online retorna resposta atual e NUNCA grava HTML no cache', async () => {
  const { fire, counters } = setup();
  const event = fire('fetch', { request: request('/teiko/admin/pedidos') });
  assert.equal(await event.response, 'LIVE:https://sushi.example/teiko/admin/pedidos');
  assert.equal(counters.writes, 0);
});

test('navegação offline só exibe página estática pública', async () => {
  const { fire } = setup({ offline: true });
  const response = await fire('fetch', { request: request('/beta-sushi/checkout') }).response;
  assert.equal(response, 'OFFLINE_PUBLIC');
});

test('requisições não navegáveis privadas não são interceptadas, mesmo offline', () => {
  const { fire } = setup({ offline: true });
  for (const path of ['/api/orders', '/teiko/admin/pedidos', '/beta-sushi/entregador', '/functions/createOrder']) {
    const event = fire('fetch', { request: request(path, 'cors') });
    assert.equal(event.response, undefined, path);
  }
});

test('favicon funciona offline e outros assets continuam network-only', async () => {
  const { fire } = setup({ offline: true });
  assert.equal(await fire('fetch', { request: request('/favicon.svg', 'same-origin') }).response, 'CACHED_ICON');
  assert.equal(fire('fetch', { request: request('/catalogo.json', 'same-origin') }).response, undefined);
});

test('POST e origens externas não são interceptados', () => {
  const { fire } = setup();
  assert.equal(fire('fetch', { request: request('/checkout', 'cors', 'POST') }).response, undefined);
  assert.equal(fire('fetch', { request: { url: 'https://api.example.com/data', mode: 'cors', method: 'GET' } }).response, undefined);
});
