const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/', productController.getAllProducts);
router.get('/categories', productController.getCategories);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/:id', productController.getProductById);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);
router.post('/:id/decrement', productController.decrementProductStock);

module.exports = router;