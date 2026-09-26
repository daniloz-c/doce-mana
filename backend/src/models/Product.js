const db = require('../config/database');

class Product {
  static getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM products WHERE is_active = 1 ORDER BY category, name', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getByCategory(category) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM products WHERE category = ? AND is_active = 1 ORDER BY name', [category], (err, rows) => {
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
      db.get('SELECT * FROM products WHERE id = ? AND is_active = 1', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static create(product) {
    return new Promise((resolve, reject) => {
      const { name, description, price, category, image_url } = product;
      db.run(
        'INSERT INTO products (name, description, price, category, image_url) VALUES (?, ?, ?, ?, ?)',
        [name, description, price, category, image_url],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...product });
        }
      );
    });
  }

  static update(id, product) {
    return new Promise((resolve, reject) => {
      const { name, description, price, category, image_url, is_active } = product;
      db.run(
        'UPDATE products SET name = ?, description = ?, price = ?, category = ?, image_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, description, price, category, image_url, is_active ? 1 : 0, id],
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
}

module.exports = Product;