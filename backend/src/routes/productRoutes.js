const express = require('express');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/', productController.getAllProducts);
router.get('/categories', productController.getCategories);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/:id', productController.getProductById);
router.use(require('../auth').isAdmin);
router.post('/', require('../controllers/inventoryController').validateProduct, productController.createProduct);
router.put('/:id', require('../controllers/inventoryController').validateProduct, productController.updateProduct);
router.delete('/:id', productController.deleteProduct);
router.post('/:id/decrement', productController.decrementProductStock);

module.exports = router;