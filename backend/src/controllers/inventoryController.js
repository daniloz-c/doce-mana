const Product = require('../models/Product');
const Order = require('../models/Order');
exports.create = async (req, res) => {
  if (!req.customer?.id) return res.status(401).json({ success: false, message: 'Entre com Google para finalizar o pedido' });
  const input = req.body;
  if (!input || typeof input.request_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.request_id) || !Array.isArray(input.items) || !input.items.length || input.items.length > 100 || input.items.some(item => !item || !Number.isSafeInteger(item.product_id) || item.product_id <= 0 || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100000) || new Set(input.items.map(item => item.product_id)).size !== input.items.length) {
    return res.status(400).json({ success: false, message: 'Dados do pedido inválidos' });
  }
  try {
    const payload = {
      ...input,
      customer_id: req.customer.id,
      customer_email: req.customer.email,
      customer_name: require('../customerAuth').publicCustomer(req.customer).name,
      customer_phone: null
    };
    const order = await Order.create(payload);
    res.status(201).json({ success: true, order: { id: order.id, total_amount: order.total_amount, items: order.items } });
  } catch (error) {
    res.status(error.status || 503).json({ success: false, message: error.status === 409 ? error.message : 'Não foi possível registrar o pedido. Tente novamente.' });
  }
};
exports.importCatalog = async (req, res) => {
  try {
    const imported = await Product.importCatalog();
    res.json({ success: true, imported });
  } catch {
    res.status(503).json({ success: false, message: 'Não foi possível importar o catálogo' });
  }
};
exports.validateProduct = (req, res, next) => {
  const p = req.body;
  if (!p || ('stock_quantity' in p && (!Number.isInteger(p.stock_quantity) || p.stock_quantity < 0 || p.stock_quantity > 2147483647)) || ('price' in p && (typeof p.price !== 'number' || !Number.isFinite(p.price) || p.price < 0)) || ['name', 'category'].some(key => key in p && (typeof p[key] !== 'string' || !p[key].trim())) || ('is_active' in p && ![0, 1].includes(p.is_active)) || (req.method === 'POST' && (!p.name || !p.category || p.price === undefined))) return res.status(400).json({ success: false, message: 'Produto inválido' });
  if (req.method === 'PUT' && 'stock_quantity' in p && (!Number.isInteger(p.expected_stock_quantity) || p.expected_stock_quantity < 0)) return res.status(400).json({ success: false, message: 'Informe o estoque anterior para evitar sobrescrever pedidos concorrentes' });
  next();
};
