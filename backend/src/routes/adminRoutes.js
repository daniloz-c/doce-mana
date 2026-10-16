const express = require('express');
const adminController = require('../controllers/adminController');
const auth = require('../auth');

const router = express.Router();

// Autenticação
router.post('/login', auth.login);
router.post('/logout', auth.logout);

// Rotas protegidas
router.use(auth.isAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Produtos
router.get('/products', adminController.getProducts);
router.get('/products/:id', adminController.getProduct);
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);
router.patch('/products/:id/stock', adminController.updateProductStock);
router.patch('/products/:id/toggle', adminController.toggleProductStatus);

// Pedidos
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrder);
router.patch('/orders/:id/status', adminController.updateOrderStatus);

// Configurações
router.get('/pix-key', adminController.getPixKey);
router.post('/pix-key', adminController.updatePixKey);

module.exports = router;