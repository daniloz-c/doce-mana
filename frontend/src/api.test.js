import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './api.js';
import { createCheckoutAttempt, resumeCheckout, shouldResumeCheckout, saveCheckoutReceipt } from './checkoutAttempt.js';

test('retorno OAuth exige intenção local recente e não inicia pedido', () => {
  const saved = { cart: { 1: 2 }, loginStartedAt: 1000 };
  assert.equal(resumeCheckout(saved, 'success', 2000), true);
  assert.equal(resumeCheckout(saved, 'error', 2000), true);
  assert.equal(resumeCheckout({}, 'success', 2000), false);
  assert.equal(resumeCheckout(saved, 'success', 601000), false);
  assert.equal(resumeCheckout(saved, 'success', 999), false);
  assert.equal(resumeCheckout(saved, 'forged', 2000), false);
  assert.deepEqual(saved.cart, { 1: 2 });
  assert.equal(createCheckoutAttempt().pending, null);
});

test('retorno do login agenda checkout mesmo com identificador e tentativa preservados', () => {
  const saved = { cart: { 1: 2 }, requestId: 'original', checkoutIntent: true, loginStartedAt: 1000 };
  assert.equal(shouldResumeCheckout(saved, 'success', 2000), true);
  const pending = createCheckoutAttempt().begin({ request_id: saved.requestId, items: [{ product_id: 1, quantity: 2 }] }, [{ id: 1, quantity: 2 }]);
  assert.equal(shouldResumeCheckout({ ...saved, pending }, 'success', 2000), true);
  assert.equal(shouldResumeCheckout({ ...saved, checkoutIntent: false }, 'success', 2000), false);
  assert.equal(shouldResumeCheckout({ ...saved, checkoutIntent: undefined }, 'success', 2000), false);
  assert.equal(shouldResumeCheckout(saved, 'error', 2000), false);
  assert.equal(shouldResumeCheckout(saved, null, 2000), false);
  assert.equal(shouldResumeCheckout(saved, 'success', 601000), false);
  assert.equal(shouldResumeCheckout(saved, 'success', 999), false);
  assert.equal(saved.requestId, 'original');
});

test('recibo persistido antes de limpar tentativa e navegar ao WhatsApp', () => {
  const events = [];
  const order = { id: 42, items: [{ name: 'Brownie', quantity: 2, price: 5 }], total_amount: 10 };
  const customer = { name: 'Cliente Google', email: 'google@example.test' };
  const storage = { setItem(key, value) {
    assert.equal(key, 'doce-checkout');
    const saved = JSON.parse(value);
    assert.equal(saved.receipt.id, 42);
    assert.equal(saved.pending, null);
    assert.deepEqual(saved.cart, {});
    events.push('saved');
  } };
  saveCheckoutReceipt(order, customer, order.items, 'next', storage, url => {
    events.push('navigate');
    const target = new URL(url);
    assert.equal(target.hostname, 'wa.me');
    assert.match(target.searchParams.get('text'), /Pedido #42 - Cliente Google/);
    assert.match(target.searchParams.get('text'), /2x Brownie/);
    assert.doesNotMatch(target.searchParams.get('text'), /undefined|Telefone|CPF/);
  }, () => events.push('finish'));
  assert.deepEqual(events, ['saved', 'finish', 'navigate']);
  assert.throws(() => saveCheckoutReceipt(order, customer, [], 'next', { setItem() { throw new Error('storage'); } }, () => assert.fail('não navegar'), () => assert.fail('não limpar')), /storage/);
});

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
  const restored = createCheckoutAttempt(JSON.parse(JSON.stringify(attempt.pending)));
  restored.reject({ status: 401 });
  assert.equal(restored.begin({ request_id: 'new' }, []).payload.request_id, 'original');
  assert.equal(restored.pending.items[0].quantity, 2);
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

test('métodos de autenticação de cliente e upload de imagem', async () => {
  const original = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, ...options });
      return new Response(JSON.stringify({ success: true, url: 'https://example.com/oauth', image_url: 'https://img.test/pic.png' }), {
        headers: { 'content-type': 'application/json' }
      });
    };
    const session = await api.getCustomerSession();
    assert.equal(session.success, true);
    assert.equal(calls[0].url, '/api/customer/session');

    const loginRes = await api.loginCustomer();
    assert.equal(loginRes.url, 'https://example.com/oauth');
    assert.equal(calls[1].url, '/api/customer/login');

    const logoutRes = await api.logoutCustomer();
    assert.equal(logoutRes.success, true);
    assert.equal(calls[2].url, '/api/customer/logout');

    const uploadRes = await api.uploadProductImage(new Blob(['fake'], { type: 'image/png' }));
    assert.equal(uploadRes.image_url, 'https://img.test/pic.png');
    assert.equal(calls[3].url, '/api/admin/upload');
    assert.equal(calls[3].method, 'POST');
    assert.equal(api.loginCustomerWithPassword, undefined);
    assert.ok(calls.every(call => call.url !== '/api/orders'));
  } finally { globalThis.fetch = original; }
});
