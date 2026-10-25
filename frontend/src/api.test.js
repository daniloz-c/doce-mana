import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './api.js';
import { productIdFromUrl, productUrl, shareProduct } from './productShare.js';

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

test('upload de imagem usa a rota administrativa', async () => {
  const original = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, ...options });
      return new Response(JSON.stringify({ success: true, image_url: 'https://img.test/pic.png' }), {
        headers: { 'content-type': 'application/json' }
      });
    };
    const uploadRes = await api.uploadProductImage(new Blob(['fake'], { type: 'image/png' }));
    assert.equal(uploadRes.image_url, 'https://img.test/pic.png');
    assert.equal(calls[0].url, '/api/admin/upload');
    assert.equal(calls[0].method, 'POST');
  } finally { globalThis.fetch = original; }
});
