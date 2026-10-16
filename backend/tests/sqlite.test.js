const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
delete process.env.VERCEL;
delete process.env.DB_PROVIDER;
test('SQLite isolado: sem seed, bcrypt, CRUD, revogação e Pix persistente', async () => {
  const db = require('../src/config/database');
  try {
    await require('../src/config/initDb')();
    const Admin = require('../src/models/Admin');
    const Product = require('../src/models/Product');
    const Settings = require('../src/models/Settings');
    assert.equal(await Admin.findByUsername('admin'), null);
    await Admin.create('isolated', 'test-password-not-production');
    const admin = await Admin.findByUsername('isolated');
    assert.ok(await Admin.verifyPassword(admin, 'test-password-not-production'));
    assert.equal(admin.token_version, 0);
    await Admin.revoke(admin.id);
    assert.equal((await Admin.findById(admin.id)).token_version, 1);
    assert.deepEqual(await Product.getAll(), []);
    const product = await Product.create({ name: 'Teste', price: 2, category: 'Teste', stock_quantity: 5 });
    await Product.update(product.id, { stock_quantity: 3 });
    assert.equal((await Product.getById(product.id)).stock_quantity, 3);
    await Settings.set('test-pix');
    assert.equal(await Settings.get(), 'test-pix');
    await Product.delete(product.id);
    assert.deepEqual(await Product.getAll(), []);
  } finally { await new Promise(resolve => db.close(resolve)); }
});
