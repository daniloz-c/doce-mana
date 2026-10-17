const remote = require('../config/runtime').remote;
const db = remote ? null : require('../config/database');
const serialize = require('./serialize');
const run = (sql, values = []) => new Promise((resolve, reject) => db.run(sql, values, function(error) { error ? reject(error) : resolve(this); }));
const all = (sql, values = []) => new Promise((resolve, reject) => db.all(sql, values, (error, rows) => error ? reject(error) : resolve(rows)));
async function transaction(work) {
  return serialize(async () => {
    await run('BEGIN IMMEDIATE');
    try {
      const value = await work();
      await run('COMMIT');
      return value;
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  });
}
const Order = {
  create(input) {
    return transaction(async () => {
      const existing = await all('SELECT id, customer_id FROM orders WHERE reservation_token = ?', [input.request_id]);
      if (existing.length) {
        if (!input.customer_id || existing[0].customer_id !== input.customer_id) throw Object.assign(new Error('Token de pedido já utilizado por outro cliente'), { status: 409 });
        return this.getById(existing[0].id);
      }
      const items = [];
      for (const item of [...input.items].sort((a, b) => a.product_id - b.product_id)) {
        const updated = await run('UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1 AND stock_quantity >= ?', [item.quantity, item.product_id, item.quantity]);
        if (!updated.changes) throw Object.assign(new Error('Estoque insuficiente. Atualize a sacola.'), { status: 409 });
        const [product] = await all('SELECT * FROM products WHERE id = ?', [item.product_id]);
        items.push({ ...item, price: product.price });
      }
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const inserted = await run('INSERT INTO orders (customer_id, customer_email, customer_name, customer_phone, total_amount, reservation_token) VALUES (?, ?, ?, ?, ?, ?)', [input.customer_id || null, input.customer_email || null, input.customer_name, input.customer_phone, total, input.request_id]);
      for (const item of items) await run('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [inserted.lastID, item.product_id, item.quantity, item.price]);
      return this.getById(inserted.lastID);
    });
  },
  async getAll() {
    const rows = await all('SELECT * FROM orders ORDER BY created_at DESC');
    return Promise.all(rows.map(row => this.getById(row.id)));
  },
  async getById(id) {
    const [row] = await all('SELECT * FROM orders WHERE id = ?', [id]);
    if (!row) return null;
    row.items = await all('SELECT oi.*, p.name FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE order_id = ?', [id]);
    return row;
  },
  updateStatus(id, status) {
    return transaction(async () => {
      const order = await this.getById(id);
      if (!order) return { changes: 0 };
      if (order.status === status) return { changes: 1 };
      if (['cancelled', 'completed'].includes(order.status) || status === 'pending') throw Object.assign(new Error('Transição de status inválida'), { status: 409 });
      if (status === 'cancelled') {
        for (const item of order.items) await run('UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.product_id]);
      }
      return run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    });
  }
};
module.exports = remote ? require('./supabase').Order : Order;
