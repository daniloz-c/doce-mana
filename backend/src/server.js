require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const initDb = require('./config/initDb');
const db = require('./config/database');
const productRoutes = require('./routes/productRoutes');

const app = express();
const port = Number(process.env.PORT) || 3001;
let server;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Doce Maná API ativa' });
});
app.use('/api/products', productRoutes);

async function start() {
  await initDb();
  server = app.listen(port, () => {
    console.log(`Doce Maná API listening on port ${port}`);
  });
}

function shutdown() {
  if (!server) {
    db.close();
    return;
  }

  server.close(() => {
    db.close((error) => {
      if (error) {
        console.error('Error closing database:', error.message);
        process.exitCode = 1;
      }
    });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((error) => {
  console.error('Failed to start Doce Maná API:', error.message);
  db.close(() => process.exit(1));
});

module.exports = app;
