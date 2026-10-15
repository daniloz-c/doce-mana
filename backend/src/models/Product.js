const db = require('../config/database');

class Product {
  static getAll(onlyActive = true) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM products';
      const params = [];

      if (onlyActive) {
        query += ' WHERE is_active = 1';
      }

      query += ' ORDER BY category, name';

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getByCategory(category, onlyActive = true) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM products WHERE category = ?';
      const params = [category];

      if (onlyActive) {
        query += ' AND is_active = 1';
      }

      query += ' ORDER BY name';

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getCategories() {
    return new Promise((resolve, reject) => {
      db.all('SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.category));
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static create(product) {
    return new Promise((resolve, reject) => {
      const { name, description, price, category, image_url, stock_quantity = 0 } = product;
      db.run(
        'INSERT INTO products (name, description, price, category, image_url, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description, price, category, image_url, stock_quantity],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...product });
        }
      );
    });
  }

  static update(id, product) {
    return new Promise((resolve, reject) => {
      const allowedFields = ['name', 'description', 'price', 'category', 'image_url', 'stock_quantity', 'is_active'];
      const updates = [];
      const values = [];

      Object.keys(product).forEach(key => {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = ?`);
          values.push(product[key]);
        }
      });

      if (updates.length === 0) {
        resolve({ changes: 0 });
        return;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      db.run(
        `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE products SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  static decrementStock(id, quantity) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?',
        [quantity, id, quantity],
        function(err) {
          if (err) reject(err);
          else resolve({ success: this.changes > 0, changes: this.changes });
        }
      );
    });
  }

  static incrementStock(id, quantity) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [quantity, id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = Product;