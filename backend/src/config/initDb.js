const bcrypt = require('bcryptjs');

const db = require('./database');

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, (error) => {
    if (error) reject(error);
    else resolve();
  });
});

const initDb = async () => {
  const tables = [
    `
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          category TEXT NOT NULL,
          image_url TEXT,
          stock_quantity INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    `
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    `
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          customer_address TEXT,
          total_amount REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          reservation_token TEXT UNIQUE,
          expires_at DATETIME,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    `
        CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          price REAL NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `,
    `
        CREATE TABLE IF NOT EXISTS admin_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
    `
        CREATE TABLE IF NOT EXISTS stock_reservations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME,
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `,
  ];

  for (const table of tables) {
    await run(table);
  }

  // Tentar adicionar stock_quantity se a tabela já existir sem ela
  try {
    await run('ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0');
  } catch (error) {
    // Ignora erro se a coluna já existir
  }

  // Tentar adicionar reservation_token se a tabela já existir sem ela
  try {
    await run('ALTER TABLE orders ADD COLUMN reservation_token TEXT');
  } catch (error) {
    // Ignora erro se a coluna já existir
  }

  // Tentar adicionar expires_at se a tabela já existir sem ela
  try {
    await run('ALTER TABLE orders ADD COLUMN expires_at DATETIME');
  } catch (error) {
    // Ignora erro se a coluna já existir
  }

  const categories = [
    ['Morangos do Amor', 'Morangos frescos cobertos com chocolate e confeitos'],
    ['Brownies', 'Brownies artesanais de diversos sabores'],
    ['Doces Variados', 'Outros doces artesanais'],
  ];
  for (const category of categories) {
    await run(
      'INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)',
      category,
    );
  }

  const products = [
    ['Morango do Amor Clássico', 'Morango fresco coberto com chocolate ao leite e granulado', 5.00, 'Morangos do Amor', '/assets/img/819236802_18102869321288729_8184103506698788233_n.jpg', 15],
    ['Morango do Amor Branco', 'Morango fresco coberto com chocolate branco e confeitos coloridos', 6.00, 'Morangos do Amor', '/assets/img/819524151_18102754568288729_4846377332151617293_n.jpg', 10],
    ['Morango do Amor Diet', 'Morango fresco coberto com chocolate diet e castanhas', 7.00, 'Morangos do Amor', null, 5],
    ['Brownie Tradicional', 'Brownie de chocolate meio amargo com nozes', 8.00, 'Brownies', null, 20],
    ['Brownie de Doce de Leite', 'Brownie de chocolate com recheio cremoso de doce de leite', 9.00, 'Brownies', null, 12],
    ['Brownie de Nutella', 'Brownie de chocolate com generoso recheio de Nutella', 10.00, 'Brownies', null, 8],
    ['Brigadeiro Gourmet', 'Brigadeiro de chocolate belga com granulado especial', 4.00, 'Doces Variados', null, 30],
    ['Beijinho de Coco', 'Doce de coco fresco com cravo', 3.50, 'Doces Variados', null, 25],
    ['Cajuzinho', 'Doce de amendoim com chocolate', 3.50, 'Doces Variados', null, 20],
  ];

  const productInsert = `
        INSERT INTO products (name, description, price, category, image_url, stock_quantity)
        SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = ?)
      `;
  for (const product of products) {
    await run(productInsert, [...product, product[0]]);
  }

  const existingAdmin = await new Promise((resolve, reject) => {
    db.get('SELECT id FROM admin_users LIMIT 1', (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });

  if (!existingAdmin) {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (
      !adminPassword ||
      adminPassword.length < 15 ||
      Buffer.byteLength(adminPassword, 'utf8') > 72 ||
      !/[A-Z]/.test(adminPassword) ||
      !/[a-z]/.test(adminPassword) ||
      !/[0-9]/.test(adminPassword) ||
      !/[^A-Za-z0-9\s]/.test(adminPassword) ||
      /\s/.test(adminPassword)
    ) {
      throw new Error('ADMIN_PASSWORD deve ter ao menos 15 caracteres, maiúsculas, minúsculas, números e símbolos, sem espaços e com até 72 bytes.');
    }
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await run(
      'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
      [adminUsername, passwordHash]
    );
  }

  console.log('Database initialized with sample data');
};

if (require.main === module) {
  initDb()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error initializing database:', error.message);
      process.exit(1);
    });
}

module.exports = initDb;