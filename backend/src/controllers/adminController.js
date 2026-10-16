const Product = require('../models/Product');
const Order = require('../models/Order');

exports.getDashboard = async (req, res) => {
  try {
    const [productsCount, activeOrders, pendingOrders] = await Promise.all([
      Product.getAll(false),
      Order.getAll(),
      Order.getAll().then(orders => orders.filter(o => o.status === 'pending'))
    ]);

    const lowStockProducts = productsCount.filter(p => p.stock_quantity && p.stock_quantity <= 5);
    const outOfStockProducts = productsCount.filter(p => (!p.stock_quantity || p.stock_quantity <= 0) && p.is_active);

    res.json({
      success: true,
      productsCount: productsCount.length,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      activeOrdersCount: activeOrders.length,
      pendingOrdersCount: pendingOrders.length,
      allProducts: productsCount,
      orders: activeOrders
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, message: 'Erro ao carregar dashboard' });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.getAll(false);
    res.json({ success: true, products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar produtos' });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.getById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado' });
    }
    res.json({ success: true, product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar produto' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Product.update(id, req.body);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado' });
    }
    res.json({ success: true, message: 'Produto atualizado com sucesso' });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar produto' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar produto' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Product.delete(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado' });
    }
    res.json({ success: true, message: 'Produto removido com sucesso' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover produto' });
  }
};

exports.updateProductStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_quantity } = req.body;

    const product = await Product.getById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado' });
    }

    if (!Number.isSafeInteger(stock_quantity) || stock_quantity < 0) {
      return res.status(400).json({ success: false, message: 'Quantidade inválida' });
    }

    await Product.update(id, { stock_quantity: stock_quantity > 0 ? stock_quantity : 0, is_active: stock_quantity > 0 ? 1 : 0 });
    res.json({ success: true, message: 'Estoque atualizado com sucesso' });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar estoque' });
  }
};

exports.toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.getById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado' });
    }

    await Product.update(id, { is_active: product.is_active === 1 ? 0 : 1 });
    res.json({ success: true, message: 'Produto atualizado com sucesso' });
  } catch (error) {
    console.error('Toggle product status error:', error);
    res.status(500).json({ success: false, message: 'Erro ao toggle produto' });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.getAll();
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar pedidos' });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.getById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
    }
    res.json({ success: true, order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar pedido' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status inválido' });
    }

    const result = await Order.updateStatus(id, status);
    res.json({ success: true, message: 'Status atualizado com sucesso' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar status' });
  }
};

exports.getPixKey = async (req, res) => {
  try {
    const pixKey = await require('../models/Settings').get();
    res.json({ success: true, pixKey });
  } catch {
    res.status(503).json({ success: false, message: 'Configurações indisponíveis' });
  }
};

exports.updatePixKey = async (req, res) => {
  try {
    const { pix_key } = req.body;

    if (!pix_key || typeof pix_key !== 'string') {
      return res.status(400).json({ success: false, message: 'Chave Pix inválida' });
    }

    await require('../models/Settings').set(pix_key);
    res.json({ success: true, message: 'Chave Pix atualizada com sucesso' });
  } catch (error) {
    console.error('Update Pix key error:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar chave Pix' });
  }
};