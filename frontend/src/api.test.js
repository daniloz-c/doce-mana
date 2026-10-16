import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './api.js';
import { createCheckoutAttempt } from './checkoutAttempt.js';

test('resposta perdida preserva snapshot e chave até resultado definitivo', () => {
  const attempt = createCheckoutAttempt();
  const payload = { request_id: 'original', items: [{ product_id: 1, quantity: 2 }] };
  const snapshot = attempt.begin(payload, [{ id: 1, quantity: 2, price: 5 }]);
  payload.items[0].quantity = 99;
  for (const error of [new Error('network'), { status: 503 }, { status: 429 }]) {
    attempt.reject(error);
    assert.equal(attempt.begin({ request_id: 'duplicate', items: [] }, []), snapshot);
    assert.equal(attempt.pending.payload.request_id, 'original');
    assert.equal(attempt.pending.payload.items[0].quantity, 2);
    assert.equal(attempt.pending.items.length, 1);
  }
  attempt.finish();
  assert.equal(attempt.pending, null);
  for (const status of [400, 409]) {
    attempt.begin(payload, []);
    attempt.reject({ status });
    assert.equal(attempt.pending, null);
  }
});

test('importação explícita, ajuste com comparação e pedido usam a API', async () => {
  const original = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, ...options });
      return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } });
    };
    await api.importCatalog();
    await api.updateStock(7, 0, 4);
    await api.createOrder({ request_id: 'test', items: [{ product_id: 7, quantity: 1 }] });
    assert.equal(calls[0].url, '/api/admin/products/import');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(JSON.parse(calls[1].body), { stock_quantity: 0, expected_stock_quantity: 4 });
    assert.equal(calls[2].url, '/api/orders');
    assert.equal(JSON.parse(calls[2].body).items[0].quantity, 1);
  } finally { globalThis.fetch = original; }
});

test('resposta HTML e JSON inválido produzem erro claro', async () => {
  const original = globalThis.fetch;
  const log = console.error;
  console.error = () => {};
  try {
    globalThis.fetch = async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
    await assert.rejects(api.getAdminDashboard(), /resposta não JSON/);
    globalThis.fetch = async () => new Response('{', { headers: { 'content-type': 'application/json' } });
    await assert.rejects(api.getAdminDashboard(), /JSON inválido/);
    globalThis.fetch = async (url, options) => {
      assert.equal(options.credentials, 'include');
      assert.equal(options.headers.Authorization, undefined);
      return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } });
    };
    assert.equal((await api.login('test', 'test')).success, true);
  } finally { globalThis.fetch = original; console.error = log; }
});
