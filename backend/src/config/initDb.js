const db = require('./database');
const run = sql => new Promise((resolve, reject) => db.run(sql, error => error ? reject(error) : resolve()));
async function initDb() {
  await run('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, category TEXT NOT NULL, image_url TEXT, stock_quantity INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  await run('CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, is_active INTEGER DEFAULT 1, token_version INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  const columns = await new Promise((resolve, reject) => db.all('PRAGMA table_info(admin_users)', (error, rows) => error ? reject(error) : resolve(rows)));
  if (!columns.some(column => column.name === 'token_version')) await run('ALTER TABLE admin_users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
  await run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT, customer_email TEXT, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_address TEXT, total_amount REAL NOT NULL, status TEXT DEFAULT 'pending', reservation_token TEXT UNIQUE, expires_at TEXT, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)");
  const orderColumns = await new Promise((resolve, reject) => db.all('PRAGMA table_info(orders)', (error, rows) => error ? reject(error) : resolve(rows)));
  if (!orderColumns.some(column => column.name === 'customer_id')) await run('ALTER TABLE orders ADD COLUMN customer_id TEXT');
  if (!orderColumns.some(column => column.name === 'customer_email')) await run('ALTER TABLE orders ADD COLUMN customer_email TEXT');
  await run('CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, price REAL NOT NULL)');
  await run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
}
if (require.main === module) initDb().then(() => db.close()).catch(() => { console.error('Falha ao inicializar banco'); db.close(); process.exitCode = 1; });
module.exports = initDb;
