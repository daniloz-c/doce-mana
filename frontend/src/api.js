const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '/api';

class ApiClient {
  constructor() {
    this.session = JSON.parse(localStorage.getItem('adminSession') || 'null');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    if (this.session && this.session.adminId) {
      config.headers['X-Admin-Session'] = this.session.adminId;
    }

    try {
      const response = await fetch(url, config);

      if (response.status === 401 && endpoint.includes('/admin')) {
        localStorage.removeItem('adminSession');
        this.session = null;
        window.location.href = '/admin';
        throw new Error('Unauthorized');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Error occurred');
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Products
  async getProducts() {
    return this.request('/products');
  }

  async getProductsByCategory(category) {
    return this.request(`/category/${category}`);
  }

  async getProductById(id) {
    return this.request(`/products/${id}`);
  }

  async createProduct(product) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(product)
    });
  }

  async updateProduct(id, product) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product)
    });
  }

  async deleteProduct(id) {
    return this.request(`/products/${id}`, {
      method: 'DELETE'
    });
  }

  async getCategories() {
    return this.request('/categories');
  }

  // Cart
  async getCart() {
    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
    const products = await this.getProducts();
    const cartItems = products.data.filter(product => cart[product.id]);
    return cartItems.map(item => ({
      ...item,
      quantity: cart[item.id]
    }));
  }

  async addToCart(productId, quantity = 1) {
    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
    const newQuantity = (cart[productId] || 0) + quantity;

    if (newQuantity <= 0) {
      delete cart[productId];
    } else {
      cart[productId] = newQuantity;
    }

    localStorage.setItem('cart', JSON.stringify(cart));

    const cartItems = await this.getCart();
    return cartItems;
  }

  async updateCartQuantity(productId, quantity) {
    if (quantity <= 0) {
      return this.removeFromCart(productId);
    }

    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
    cart[productId] = quantity;
    localStorage.setItem('cart', JSON.stringify(cart));

    const cartItems = await this.getCart();
    return cartItems;
  }

  async removeFromCart(productId) {
    const cart = JSON.parse(localStorage.getItem('cart') || '{}');
    delete cart[productId];
    localStorage.setItem('cart', JSON.stringify(cart));

    const cartItems = await this.getCart();
    return cartItems;
  }

  // Orders
  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  }

  // Admin
  async login(username, password) {
    const data = await this.request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (data.success) {
      this.session = { adminId: 'admin_' + Date.now() };
      localStorage.setItem('adminSession', JSON.stringify(this.session));
    }

    return data;
  }

  async logout() {
    const data = await this.request('/admin/logout', {
      method: 'POST'
    });

    if (data.success) {
      localStorage.removeItem('adminSession');
      this.session = null;
    }

    return data;
  }

  async getAdminDashboard() {
    return this.request('/admin/dashboard');
  }

  async getAdminProducts() {
    return this.request('/admin/products');
  }

  async getAdminOrders() {
    return this.request('/admin/orders');
  }

  async updateOrderStatus(orderId, status) {
    return this.request(`/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  async getPixKey() {
    return this.request('/admin/pix-key');
  }

  async updatePixKey(key) {
    return this.request('/admin/pix-key', {
      method: 'POST',
      body: JSON.stringify({ pix_key: key })
    });
  }
}

export const api = new ApiClient();