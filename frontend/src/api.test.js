import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './api.js';
import { productIdFromUrl, productUrl, shareProduct } from './productShare.js';
import { createCheckoutAttempt, resumeCheckout, shouldResumeCheckout, saveCheckoutReceipt } from './checkoutAttempt.js';

test('link individual mantém origem e remove parâmetros privados do checkout', () => {
  const url = productUrl('https://shop.example.test/?login=success&code=private#sacola', 7);
  assert.equal(url, 'https://shop.example.test/?produto=7');
  assert.equal(productIdFromUrl(url), 7);
  assert.equal(productUrl('http://localhost:5173/', 2), 'http://localhost:5173/?produto=2');
  for (const value of ['', '0', '-1', 'abc', '1.5', '9007199254740992']) {
    assert.equal(productIdFromUrl(`https://shop.example.test/?produto=${value}`), null);
  }
  assert.throws(() => productUrl('https://shop.example.test/', 0), /Produto inválido/);
});

test('compartilhamento nativo e cópia usam o link individual sem abrir checkout', async () => {
  const product = { id: 7, name: 'Brownie' };
  const href = 'https://shop.example.test/';
  const calls = [];
  assert.equal(await shareProduct(product, href, { share: async data => calls.push(data) }), 'Compartilhamento concluído.');
  assert.deepEqual(calls, [{ title: 'Brownie', text: 'Confira Brownie na Doce Maná', url: `${href}?produto=7` }]);
  const clipboard = { writeText: async url => calls.push(url) };
  assert.equal(await shareProduct(product, href, { clipboard }), 'Link copiado!');
  assert.equal(calls[1], `${href}?produto=7`);
  assert.equal(await shareProduct(product, href, { share: async () => { throw new Error('indisponível'); }, clipboard }), 'Link copiado!');
  const count = calls.length;
  assert.equal(await shareProduct(product, href, { share: async () => { throw Object.assign(new Error('cancelado'), { name: 'AbortError' }); }, clipboard }), '');
  assert.equal(calls.length, count);
  await assert.rejects(shareProduct(product, href, {}), /Copie o link/);
  await assert.rejects(shareProduct(product, href, { clipboard: { writeText: async () => { throw new Error('bloqueado'); } } }), /bloqueado/);
});

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

test('pedido sem telefone mantém a chave após 503 e navega somente depois do reenvio confirmado', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.error;
  const attempt = createCheckoutAttempt();
  const payload = { request_id: '12345678-1234-1234-1234-123456789abc', items: [{ product_id: 1, quantity: 2 }] };
  const snapshot = attempt.begin(payload, [{ id: 1, name: 'Brownie', quantity: 2, price: 5 }]);
  const calls = [];
  const events = [];
  const order = { id: 42, total_amount: 10, items: [{ name: 'Brownie', quantity: 2, price: 5 }] };
  console.error = () => {};
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/orders');
      assert.equal(options.credentials, 'include');
      calls.push(JSON.parse(options.body));
      return new Response(JSON.stringify(calls.length === 1
        ? { success: false, message: 'Não foi possível registrar o pedido. Tente novamente.' }
        : { success: true, order }), { status: calls.length === 1 ? 503 : 201, headers: { 'content-type': 'application/json' } });
    };
    await assert.rejects(api.createOrder(snapshot.payload), error => {
      assert.equal(error.status, 503);
      attempt.reject(error);
      return true;
    });
    assert.equal(attempt.pending, snapshot);
    assert.deepEqual(events, []);
    const retry = attempt.begin({ request_id: 'não-usar', items: [] }, []);
    const response = await api.createOrder(retry.payload);
    let saved;
    saveCheckoutReceipt(response.order, { name: 'Cliente', email: 'cliente@example.test' }, retry.items, 'next', {
      setItem(key, value) { saved = JSON.parse(value); events.push('saved'); }
    }, url => {
      assert.equal(url, saved.receipt.url);
      events.push('navigate');
    }, () => { attempt.finish(); events.push('finish'); });
    assert.deepEqual(calls, [payload, payload]);
    assert.equal(Object.hasOwn(calls[0], 'customer_phone'), false);
    assert.equal(attempt.pending, null);
    assert.equal(saved.checkoutIntent, false);
    assert.deepEqual(events, ['saved', 'finish', 'navigate']);
  } finally { globalThis.fetch = originalFetch; console.error = originalLog; }
});

test('erro definitivo de estoque libera tentativa e permite novo pedido', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.error;
  const attempt = createCheckoutAttempt();
  attempt.begin({ request_id: 'original', items: [{ product_id: 1, quantity: 2 }] }, []);
  console.error = () => {};
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: 'Estoque insuficiente. Atualize a sacola.' }), {
      status: 409, headers: { 'content-type': 'application/json' }
    });
    await assert.rejects(api.createOrder(attempt.pending.payload), error => {
      assert.equal(error.status, 409);
      assert.match(error.message, /Estoque insuficiente/);
      attempt.reject(error);
      return true;
    });
    assert.equal(attempt.pending, null);
    assert.equal(attempt.begin({ request_id: 'nova', items: [{ product_id: 1, quantity: 1 }] }, []).payload.request_id, 'nova');
  } finally { globalThis.fetch = originalFetch; console.error = originalLog; }
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
