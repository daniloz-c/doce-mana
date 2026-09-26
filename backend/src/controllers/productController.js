const Product = require('../models/Product');

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.getAll();
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar produtos' });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const products = await Product.getByCategory(category);
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar produtos da categoria' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.getCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar categorias' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.getById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produto não encontrado' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar produto' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Erro ao criar produto' });
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
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar produto' });
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
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Erro ao remover produto' });
  }
};