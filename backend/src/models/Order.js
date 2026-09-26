const db = require('../config/database');

class Order {
  static create(order) {
    return new Promise((resolve, reject) => {
      const { customer_name, customer_phone, customer_address, total_amount, notes, items } = order;
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
          'INSERT INTO orders (customer_name, customer_phone, customer_address, total_amount, notes) VALUES (?, ?, ?, ?, ?)',
          [customer_name, customer_phone, customer_address, total_amount, notes],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            
            const orderId = this.lastID;
            
            const stmt = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
            
            let hasError = false;
            items.forEach(item => {
              if (hasError) return;
              stmt.run([orderId, item.product_id, item.quantity, item.price], (err) => {
                if (err) {
                  hasError = true;
                  db.run('ROLLBACK');
                  reject(err);
                }
              });
            });
            
            stmt.finalize();
            
            if (!hasError) {
              db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve({ id: orderId, ...order });
              });
            }
          }
        );
      });
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT o.*, 
               json_group_array(
                 json_object(
                   'product_id', oi.product_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'name', p.name
                 )
               ) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `, [], (err, rows) => {
        if (err) reject(err);
        else {
          const orders = rows.map(row => ({
            ...row,
            items: row.items ? JSON.parse(row.items).filter(i => i.product_id) : []
          }));
          resolve(orders);
        }
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT o.*, 
               json_group_array(
                 json_object(
                   'product_id', oi.product_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'name', p.name
                 )
               ) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.id = ?
        GROUP BY o.id
      `, [id], (err, row) => {
        if (err) reject(err);
        else if (row) {
          row.items = row.items ? JSON.parse(row.items).filter(i => i.product_id) : [];
          resolve(row);
        } else {
          resolve(null);
        }
      });
    });
  }

  static updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = Order;