const db = require('../config/database');
const bcrypt = require('bcryptjs');

const Admin = {
  findByUsername(username) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM admin_users WHERE username = ? AND is_active = 1',
        [username],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  },

  verifyPassword(admin, password) {
    return new Promise((resolve, reject) => {
      if (!admin || !admin.password_hash) {
        resolve(false);
        return;
      }

      bcrypt.compare(password, admin.password_hash)
        .then(isValid => resolve(isValid))
        .catch(err => reject(err));
    });
  },

  create(username, password) {
    return new Promise((resolve, reject) => {
      bcrypt.hash(password, 10)
        .then(hash => {
          db.run(
            'INSERT INTO admin_users (username, password_hash, is_active, created_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP)',
            [username, hash],
            function(err) {
              if (err) reject(err);
              else resolve({ id: this.lastID, username, is_active: 1, created_at: new Date() });
            }
          );
        })
        .catch(reject);
    });
  },

  delete(id) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE admin_users SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
};

module.exports = Admin;