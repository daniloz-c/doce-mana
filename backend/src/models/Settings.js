const remote = require('../config/runtime').remote;
const db = remote ? null : require('../config/database');
module.exports = remote ? require('./supabase').Settings : {
  get() { return new Promise((resolve, reject) => db.get("SELECT value FROM settings WHERE key = 'pix_key'", (error, row) => error ? reject(error) : resolve(row?.value || ''))); },
  set(value) { return new Promise((resolve, reject) => db.run("INSERT INTO settings (key, value) VALUES ('pix_key', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [value], error => error ? reject(error) : resolve())); }
};
