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
  ];

  for (const table of tables) {
    await run(table);
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
    ['Morango do Amor Clássico', 'Morango fresco coberto com chocolate ao leite e granulado', 5.00, 'Morangos do Amor', '/assets/img/819236802_18102869321288729_8184103506698788233_n.jpg'],
    ['Morango do Amor Branco', 'Morango fresco coberto com chocolate branco e confeitos coloridos', 6.00, 'Morangos do Amor', '/assets/img/819524151_18102754568288729_4846377332151617293_n.jpg'],
    ['Morango do Amor Diet', 'Morango fresco coberto com chocolate diet e castanhas', 7.00, 'Morangos do Amor', null],
    ['Brownie Tradicional', 'Brownie de chocolate meio amargo com nozes', 8.00, 'Brownies', null],
    ['Brownie de Doce de Leite', 'Brownie de chocolate com recheio cremoso de doce de leite', 9.00, 'Brownies', null],
    ['Brownie de Nutella', 'Brownie de chocolate com generoso recheio de Nutella', 10.00, 'Brownies', null],
    ['Brigadeiro Gourmet', 'Brigadeiro de chocolate belga com granulado especial', 4.00, 'Doces Variados', null],
    ['Beijinho de Coco', 'Doce de coco fresco com cravo', 3.50, 'Doces Variados', null],
    ['Cajuzinho', 'Doce de amendoim com chocolate', 3.50, 'Doces Variados', null],
  ];

  const productInsert = `
        INSERT OR IGNORE INTO products (name, description, price, category, image_url) 
        VALUES (?, ?, ?, ?, ?)
      `;
  for (const product of products) {
    await run(productInsert, product);
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