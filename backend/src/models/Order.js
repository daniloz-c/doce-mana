const db = require('../config/database');
const crypto = require('crypto');

class Order {
  static create(order) {
    return new Promise((resolve, reject) => {
      const { customer_name, customer_phone, customer_address, total_amount, notes, items, pix_key } = order;

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
            const reservationToken = crypto.randomBytes(16).toString('hex');
            const reservationExpires = Date.now() + 15 * 60 * 1000; // 15 minutos

            // Criar reservas de estoque
            const reservationStmt = db.prepare(
              'INSERT INTO stock_reservations (order_id, product_id, quantity, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING'
            );

            let hasError = false;
            items.forEach(item => {
              if (hasError) return;

              reservationStmt.run([orderId, item.product_id, item.quantity, new Date(reservationExpires)], (err) => {
                if (err) {
                  hasError = true;
                  db.run('ROLLBACK');
                  reject(err);
                }
              });
            });

            reservationStmt.finalize();

            if (!hasError) {
              db.run('COMMIT', (err) => {
                if (err) reject(err);
                else {
                  const order = {
                    id: orderId,
                    customer_name,
                    customer_phone,
                    customer_address,
                    total_amount,
                    notes,
                    status: 'pending',
                    reservation_token: reservationToken.startsWith('{') ? null : reservationToken,
                    pix_key,
                    items
                  };
                  resolve(order);
                }
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

  static expirePendingReservations() {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE stock_reservations sr
         SET released = 1
         WHERE EXISTS (
           SELECT 1 FROM orders o
           WHERE o.id = sr.order_id
           AND o.status = 'pending'
           AND sr.expires_at < datetime('now')
         )
         OR sr.expires_at < datetime('NOW - INTERVAL ' || 15 || ' minutes')`,
        [],
        function(err) {
          if (err) reject(err);
          else {
            resolve({ changes: this.changes });

            // Liberar estoque dos itens expirados
            db.serialize(() => {
              db.run('BEGIN TRANSACTION');

              const decrementStmt = db.prepare(
                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?'
              );

              db.run(
                `SELECT * FROM stock_reservations r
                 WHERE released = 1 AND order_id NOT IN (SELECT id FROM orders WHERE status = 'completed')`
              ).all((err, reservations) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }

                let hasError = false;
                reservations.forEach(res => {
                  if (hasError) return;

                  decrementStmt.run([res.quantity, res.product_id], (err) => {
                    if (err) {
                      hasError = true;
                      db.run('ROLLBACK');
                      reject(err);
                    }
                  });
                });

                decrementStmt.finalize();

                if (!hasError) {
                  db.run('COMMIT');
                }
              });
            });
          }
        }
      );
    });
  }
}

module.exports = Order;