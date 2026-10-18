const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
delete process.env.VERCEL;
delete process.env.DB_PROVIDER;
test('catálogo explícito, estoque, concorrência, rollback e cancelamento', async () => {
  const db = require('../src/config/database');
  const Product = require('../src/models/Product');
  const Order = require('../src/models/Order');
  try {
    await require('../src/config/initDb')();
    assert.equal(await Product.importCatalog(), 9);
    assert.deepEqual(await Product.getAll(), []);
    const [product, other] = await Product.getAll(false);
    await Product.update(product.id, { stock_quantity: 2, price: 42 });
    assert.equal(await Product.importCatalog(), 0);
    assert.equal((await Product.getById(product.id)).price, 42);
    assert.equal((await Product.getById(product.id)).stock_quantity, 2);
    const input = () => ({ request_id: randomUUID(), customer_id: 'cust-1', customer_email: 'cust1@test.com', customer_name: 'Cliente', customer_phone: '47999999999', total_amount: 0, items: [{ product_id: product.id, quantity: 2 }] });
    const first = input();
    const results = await Promise.allSettled([Order.create(first), Order.create(input())]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
    const order = results[0].value;
    assert.equal(order.total_amount, 84);
    assert.equal(order.items.length, 1);
    assert.equal((await Order.create(first)).id, order.id);

    const stolenAttempt = { ...first, customer_id: 'other-cust' };
    await assert.rejects(Order.create(stolenAttempt), { status: 409 });

    assert.equal((await Product.getById(product.id)).stock_quantity, 0);
    assert.deepEqual(await Product.getAll(), []);
    assert.equal((await Product.update(product.id, { stock_quantity: 10, expected_stock_quantity: 2 })).changes, 0);
    assert.equal((await Product.getById(product.id)).stock_quantity, 0);
    await Promise.all([Order.updateStatus(order.id, 'cancelled'), Order.updateStatus(order.id, 'cancelled')]);
    assert.equal((await Product.getById(product.id)).stock_quantity, 2);
    await assert.rejects(Order.updateStatus(order.id, 'confirmed'), { status: 409 });
    const invalid = input();
    invalid.items.push({ product_id: other.id, quantity: 1 });
    await assert.rejects(Order.create(invalid), { status: 409 });
    assert.equal((await Product.getById(product.id)).stock_quantity, 2);
    assert.equal((await Order.getAll()).length, 1);
    await Product.delete(product.id);
    await assert.rejects(Order.create(input()), { status: 409 });
    const inactive = await Product.create({ name: 'Bolo de cenoura inativo', category: 'Bolos', price: 8, stock_quantity: 5, is_active: 0 });
    assert.equal((await Product.getById(inactive.id)).is_active, 0);
    assert.equal((await Product.getAll()).some(item => item.id === inactive.id), false);
    const active = await Product.create({ name: 'Bolo de cenoura ativo', category: 'Bolos', price: 8, stock_quantity: 1 });
    assert.equal((await Product.getById(active.id)).is_active, 1);
    assert.equal((await Product.getAll()).some(item => item.id === active.id), true);
  } finally { await new Promise(resolve => db.close(resolve)); }
});
test('validação rejeita quantidades inválidas e itens repetidos antes da persistência', async () => {
  const controller = require('../src/controllers/inventoryController');
  for (const items of [[{ product_id: 1, quantity: -1 }], [{ product_id: 1, quantity: 0.5 }], [{ product_id: 1, quantity: 1 }, { product_id: 1, quantity: 1 }], []]) {
    let status;
    await controller.create({ customer: { id: 'cust-1' }, body: { request_id: randomUUID(), customer_name: 'Cliente', customer_phone: '47999999999', items } }, { status(value) { status = value; return this; }, json() {} });
    assert.equal(status, 400);
  }
});
