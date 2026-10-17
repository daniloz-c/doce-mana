const express = require('express');
const path = require('path');
const runtime = require('./config/runtime');

const app = express();
app.disable('x-powered-by');
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const missing = runtime.validate();
  if (missing.length) return res.status(503).json({ success: false, message: `Configuração pendente: ${missing.join(', ')}` });
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use('/api', require('./auth').csrf);
app.get('/api/health', (req, res) => res.json({ success: true, message: 'Doce Maná API ativa' }));
app.post('/api/orders', require('./auth').csrf, require('./customerAuth').requireCustomer, require('./orderLimiter')(), require('./controllers/inventoryController').create);
app.get('/api/customer/callback', require('./customerAuth').callback);
app.get('/api/customer/session', require('./customerAuth').session);
app.post('/api/customer/login', require('./customerAuth').login);
app.post('/api/customer/logout', require('./customerAuth').logout);
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Rota não encontrada' }));
const frontend = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontend));
app.use('/assets/img', express.static(path.join(__dirname, '../../assets/img')));
app.get(['/admin', '/admin/*'], (req, res) => res.sendFile(path.join(frontend, 'index.html')));
app.use((error, req, res, next) => {
  res.status(error.type === 'entity.parse.failed' ? 400 : 500).json({ success: false, message: error.type === 'entity.parse.failed' ? 'JSON inválido' : 'Não foi possível processar a solicitação' });
});
module.exports = app;
