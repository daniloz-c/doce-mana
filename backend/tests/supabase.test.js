const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

function loadAdapter(t, { rpcResult = { data: null, error: null }, rowResult = { data: null, error: null } } = {}) {
  const sdkPath = require.resolve('@supabase/supabase-js');
  const adapterPath = require.resolve('../src/models/supabase');
  const sdk = require(sdkPath);
  const originalExports = require.cache[sdkPath].exports;
  const originalAdapter = require.cache[adapterPath];
  const originalEnv = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  const query = {};
  query.select = t.mock.fn(() => query);
  query.eq = t.mock.fn(() => query);
  query.maybeSingle = t.mock.fn(async () => rowResult);
  const client = {
    rpc: t.mock.fn(async () => rpcResult),
    from: t.mock.fn(() => query)
  };
  const createClient = t.mock.fn(() => client);
  t.after(() => {
    require.cache[sdkPath].exports = originalExports;
    delete require.cache[adapterPath];
    if (originalAdapter) require.cache[adapterPath] = originalAdapter;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.SUPABASE_URL = 'https://database.example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-not-a-credential';
  require.cache[sdkPath].exports = { ...sdk, createClient };
  delete require.cache[adapterPath];
  const models = require(adapterPath);
  require.cache[sdkPath].exports = originalExports;
  return { models, client, query, createClient };
}

const orderPayload = () => ({
  request_id: '8093128b-b830-4e3d-bbda-fb6fc9a32c45',
  customer_id: 'customer-test',
  customer_email: 'customer@example.test',
  customer_name: 'Cliente Google',
  customer_phone: null,
  items: [{ product_id: 7, quantity: 2 }]
});

const calls = fn => fn.mock.calls.map(call => call.arguments);

test('Supabase create_order envia telefone null e retorna pedido com itens e nomes', async t => {
  const row = {
    id: 42,
    ...orderPayload(),
    total_amount: 25,
    status: 'pending',
    order_items: [
      { id: 1, product_id: 7, quantity: 2, price: 12.5, products: { name: 'Brigadeiro' } },
      { id: 2, product_id: 8, quantity: 1, price: 0, products: null }
    ]
  };
  const { models, client, query, createClient } = loadAdapter(t, {
    rpcResult: { data: 42, error: null },
    rowResult: { data: row, error: null }
  });
  const payload = orderPayload();
  const original = structuredClone(payload);
  assert.equal(createClient.mock.callCount(), 0);
  const result = await models.Order.create(payload);
  assert.deepEqual(calls(client.rpc), [['create_order', { payload: original }]]);
  assert.equal(calls(client.rpc)[0][1].payload.customer_phone, null);
  assert.deepEqual(payload, original);
  assert.deepEqual(calls(client.from), [['orders']]);
  assert.deepEqual(calls(query.select), [['*,order_items(*,products(name))']]);
  assert.deepEqual(calls(query.eq), [['id', 42]]);
  assert.deepEqual(calls(query.maybeSingle), [[]]);
  assert.deepEqual(result, {
    ...row,
    items: [
      { id: 1, product_id: 7, quantity: 2, price: 12.5, name: 'Brigadeiro' },
      { id: 2, product_id: 8, quantity: 1, price: 0, name: undefined }
    ]
  });
  assert.strictEqual(models.getClient(), client);
  assert.deepEqual(calls(createClient), [[
    'https://database.example.test',
    'test-only-not-a-credential',
    { auth: { persistSession: false, autoRefreshToken: false } }
  ]]);
});

test('Supabase create_order traduz erros de ownership, estoque e persistência sem consultar pedido', async t => {
  for (const [message, expected] of [
    ['ownership mismatch', { message: 'Token de pedido já utilizado por outro cliente', status: 409 }],
    ['insufficient_stock', { message: 'Estoque insuficiente. Atualize a sacola.', status: 409 }],
    ['internal database details', { message: 'Persistência indisponível' }]
  ]) {
    await t.test(message, async t => {
      const { models, client } = loadAdapter(t, { rpcResult: { data: null, error: { message } } });
      const payload = orderPayload();
      await assert.rejects(models.Order.create(payload), error => {
        assert.equal(error.message, expected.message);
        assert.equal(error.status, expected.status);
        return true;
      });
      assert.deepEqual(calls(client.rpc), [['create_order', { payload }]]);
      assert.equal(client.from.mock.callCount(), 0);
    });
  }
});

test('Supabase create_order propaga erro de leitura após RPC bem-sucedida', async t => {
  const { models, client, query } = loadAdapter(t, {
    rpcResult: { data: 42, error: null },
    rowResult: { data: null, error: { message: 'private database details' } }
  });
  await assert.rejects(models.Order.create(orderPayload()), { message: 'Persistência indisponível' });
  assert.equal(client.rpc.mock.callCount(), 1);
  assert.deepEqual(calls(query.eq), [['id', 42]]);
  assert.equal(query.maybeSingle.mock.callCount(), 1);
});

test('Supabase getById retorna null para pedido inexistente', async t => {
  const { models, client, query } = loadAdapter(t);
  assert.equal(await models.Order.getById(404), null);
  assert.deepEqual(calls(client.from), [['orders']]);
  assert.deepEqual(calls(query.eq), [['id', 404]]);
  assert.equal(query.maybeSingle.mock.callCount(), 1);
  assert.equal(client.rpc.mock.callCount(), 0);
});

test('Supabase decrement_stock preserva sucesso e falta de estoque retornados pela RPC', async t => {
  for (const success of [true, false]) {
    await t.test(String(success), async t => {
      const { models, client } = loadAdapter(t, { rpcResult: { data: success, error: null } });
      assert.deepEqual(await models.Product.decrementStock('7', 2), { success, changes: success ? 1 : 0 });
      assert.deepEqual(calls(client.rpc), [['decrement_stock', { product: 7, amount: 2 }]]);
      assert.equal(client.from.mock.callCount(), 0);
    });
  }
});

test('Supabase set_order_status converte id e traduz transição inválida', async t => {
  for (const [rpcResult, expected] of [
    [{ data: 1, error: null }, { changes: 1 }],
    [{ data: 0, error: null }, { changes: 0 }],
    [{ data: null, error: { message: 'invalid_transition' } }, null]
  ]) {
    await t.test(expected ? `changes ${expected.changes}` : 'invalid_transition', async t => {
      const { models, client } = loadAdapter(t, { rpcResult });
      if (expected) assert.deepEqual(await models.Order.updateStatus('42', 'cancelled'), expected);
      else await assert.rejects(models.Order.updateStatus('42', 'cancelled'), { message: 'Transição de status inválida', status: 409 });
      assert.deepEqual(calls(client.rpc), [['set_order_status', { target: 42, new_status: 'cancelled' }]]);
      assert.equal(client.from.mock.callCount(), 0);
    });
  }
});

test('SQL: contrato estático permite telefone null e migra NOT NULL legado; não valida banco remoto', () => {
  const sql = readFileSync(path.join(__dirname, '../database/supabase.sql'), 'utf8')
    .replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '');
  const orders = sql.match(/create\s+table\s+if\s+not\s+exists\s+public\.orders\s*\(([\s\S]*?)\);/i);
  assert.ok(orders, 'DDL de orders deve existir');
  assert.match(orders[1], /\bcustomer_phone\s+text\s*[,\n]/i);
  assert.doesNotMatch(orders[1], /\bcustomer_phone\s+text\s+not\s+null/i);
  assert.match(sql, /\balter\s+table\s+public\.orders\s+alter\s+column\s+customer_phone\s+drop\s+not\s+null\s*;/i);
  const createOrder = sql.match(/create\s+or\s+replace\s+function\s+public\.create_order\(payload\s+jsonb\)[\s\S]*?\$\$;/i);
  assert.ok(createOrder, 'RPC create_order deve existir');
  assert.match(createOrder[0], /insert\s+into\s+orders\([^)]*\bcustomer_phone\b[^)]*\)\s*values\([^;]*payload\s*->>\s*'customer_phone'/i);
});
