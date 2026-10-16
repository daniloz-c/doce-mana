const express = require('express');
const cors = require('cors');
const path = require('path');
const { randomBytes } = require('crypto');
const session = require('express-session');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const production = process.env.NODE_ENV === 'production';
if (production && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production');
}
const initDb = require('./config/initDb');
const db = require('./config/database');
const productRoutes = require('./routes/productRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const port = Number(process.env.PORT) || 3001;
const frontendPath = path.join(__dirname, '../../frontend/dist');
let server;

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 8 * 60 * 60 * 1000 }
}));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Doce Maná API ativa' });
});
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Rota não encontrada' }));
app.use(express.static(frontendPath));
app.use('/assets/img', express.static(path.join(__dirname, '../../assets/img')));
app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

async function start() {
  await initDb();
  server = app.listen(port, () => {
    console.log(`Doce Maná API listening on port ${port}`);
  });
  server.on('error', error => {
    console.error('Server error:', error.message);
    db.close(() => process.exit(1));
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
