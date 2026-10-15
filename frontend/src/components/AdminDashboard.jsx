import { useState, useEffect } from 'react';
import { api } from '../api';
import { formatDate, formatPrice, getStockStatus } from '../utils';

function AdminDashboard({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPixKeyModal, setShowPixKeyModal] = useState(false);
  const [currentPixKey, setCurrentPixKey] = useState('');
  const [newPixKey, setNewPixKey] = useState('');

  const [dashboardStats, setDashboardStats] = useState({
    productsCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    activeOrdersCount: 0,
    pendingOrdersCount: 0
  });

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const dashboardData = await api.getAdminDashboard();
      setDashboardStats(dashboardData);
      setProducts(dashboardData.allProducts || []);
      setOrders(dashboardData.orders || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    onLogout();
  };

  const handleUpdatePixKey = async () => {
    try {
      const result = await api.updatePixKey(newPixKey);
      if (result.success) {
        setCurrentPixKey(newPixKey);
        setShowPixKeyModal(false);
        alert('Chave Pix atualizada com sucesso!');
      }
    } catch (error) {
      alert('Erro ao atualizar chave Pix');
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const result = await api.updateOrderStatus(orderId, newStatus);

      if (result.success) {
        // Atualizar a lista de pedidos localmente
        setOrders(prev => prev.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        ));

        if (setSelectedOrder) {
          setSelectedOrder(prev => prev && prev.id === orderId ? { ...prev, status: newStatus } : prev);
        }

        alert('Status do pedido atualizado com sucesso!');
      }
    } catch (error) {
      alert('Erro ao atualizar status do pedido');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredOrders = orders.filter(order =>
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading-container">
          <p>Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-left">
          <h1>Painel Administrativo</h1>
          <p>Doce Maná - Gestão da Loja</p>
        </div>
        <button
          className="logout-button"
          onClick={handleLogout}
          aria-label="Sair do painel administrativo"
        >
          Sair
        </button>
      </header>

      <nav className="admin-nav">
        <button
          className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveView('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`nav-item ${activeView === 'products' ? 'active' : ''}`}
          onClick={() => setActiveView('products')}
        >
          Produtos
        </button>
        <button
          className={`nav-item ${activeView === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveView('orders')}
        >
          Pedidos
        </button>
        <button
          className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => setShowPixKeyModal(true)}
        >
          Configurações
        </button>
      </nav>

      <main className="admin-content">
        {activeView === 'dashboard' && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-value">{dashboardStats.productsCount}</div>
                <div className="stat-label">Total de Produtos</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⚠️</div>
                <div className="stat-value">{dashboardStats.lowStockCount}</div>
                <div className="stat-label">Estoque Baixo</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">🔴</div>
                <div className="stat-value">{dashboardStats.outOfStockCount}</div>
                <div className="stat-label">Esgotado</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-value">{dashboardStats.activeOrdersCount}</div>
                <div className="stat-label">Pedidos Ativos</div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-value">{dashboardStats.pendingOrdersCount}</div>
                <div className="stat-label">Pendentes</div>
              </div>
            </div>

            <section className="recent-orders">
              <h2>Pedidos Recentes</h2>
              <div className="orders-table">
                <div className="table-header">
                  <div>Cliente</div>
                  <div>Data</div>
                  <div>Total</div>
                  <div>Status</div>
                  <div>Ações</div>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="empty-table">Nenhum pedido encontrado</div>
                ) : (
                  filteredOrders.map(order => (
                    <div key={order.id} className="table-row">
                      <div>
                        <strong>{order.customer_name}</strong>
                        <small>{order.customer_phone}</small>
                      </div>
                      <div>{formatDate(order.created_at)}</div>
                      <div>{formatPrice(order.total_amount)}</div>
                      <select
                        value={order.status}
                        onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                        className="status-select"
                      >
                        <option value="pending">Pendente</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="cancelled">Cancelado</option>
                        <option value="completed">Concluído</option>
                      </select>
                      <button
                        className="view-details-button"
                        onClick={() => {
                          setSelectedOrder(order);
                          setActiveView('orders');
                        }}
                      >
                        Detalhes
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {activeView === 'products' && (
          <>
            <div className="products-header">
              <h2>Gerenciar Produtos</h2>
              <input
                type="text"
                placeholder="Buscar produto..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="products-grid">
              {filteredProducts.length === 0 ? (
                <div className="empty-grid">Nenhum produto encontrado</div>
              ) : (
                filteredProducts.map(product => {
                  const stockStatus = getStockStatus(product);

                  return (
                    <article key={product.id} className="product-card">
                      <div className={`product-image product-tone-${product.id % 4}`}>
                        {product.image_url ? (
                          <img
                            src={`${product.image_url}`}
                            alt={product.name}
                            loading="lazy"
                          />
                        ) : (
                          <div className="product-placeholder" aria-hidden="true">
                            <span>{product.category === 'Brownies' ? '🍫' : '🍓'}</span>
                            <i>{product.category === 'Brownies' ? '✳' : '♡'}</i>
                          </div>
                        )}
                        <span className={`stock-badge ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                      </div>

                      <div className="product-details">
                        <span className="product-category">{product.category}</span>
                        <h3>{product.name}</h3>
                        <p>{product.description}</p>
                      </div>

                      <div className="product-footer">
                        <div>
                          <strong>{formatPrice(product.price)}</strong>
                          <small>/ unidade</small>
                        </div>
                        <div>
                          {stockStatus.status !== 'available' && (
                            <button
                              type="button"
                              className="edit-stock-button"
                              onClick={() => alert(`Atualizar estoque do ${product.name}: ${product.stock_quantity || 0} unidades`)}
                            >
                              {stockStatus.status === 'out_of_stock' ? 'Restaurar' : 'Atualizar'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="status-activity-button"
                            onClick={() => alert(`Desativar/ativar: ${product.is_active ? 'Ativo' : 'Inativo'}`)}
                          >
                            {product.is_active ? 'Ativo' : 'Inativo'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeView === 'orders' && (
          <>
            <div className="orders-header">
              <h2>Gerenciar Pedidos</h2>
              <input
                type="text"
                placeholder="Buscar pedido..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {selectedOrder ? (
              <div className="order-details-panel">
                <button
                  className="back-button"
                  onClick={() => setSelectedOrder(null)}
                >
                  ← Voltar
                </button>

                <div className="order-detail-header">
                  <h2>Detalhes do Pedido #{selectedOrder.id}</h2>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleUpdateOrderStatus(selectedOrder.id, e.target.value)}
                    className="status-select"
                  >
                    <option value="pending">Pendente</option>
                    <option value="confirmed">Confirmado</option>
                    <option value="cancelled">Cancelado</option>
                    <option value="completed">Concluído</option>
                  </select>
                </div>

                <div className="order-details">
                  <div className="detail-group">
                    <h4>Cliente</h4>
                    <p><strong>Nome:</strong> {selectedOrder.customer_name}</p>
                    <p><strong>Telefone:</strong> {selectedOrder.customer_phone || 'Não informado'}</p>
                    <p><strong>Endereço:</strong> {selectedOrder.customer_address || 'Não informado'}</p>
                  </div>

                  <div className="detail-group">
                    <h4>Itens do Pedido</h4>
                    <ul>
                      {selectedOrder.items && selectedOrder.items.length > 0 ? (
                        selectedOrder.items.map(item => (
                          <li key={item.product_id}>
                            <strong>{item.name}</strong><br />
                            <small>{item.quantity}x</small> - {formatPrice(item.price * item.quantity)}
                          </li>
                        ))
                      ) : (
                        <p>Nenhum item</p>
                      )}
                    </ul>
                  </div>

                  <div className="detail-group">
                    <h4>Status do Pedido</h4>
                    <p>{selectedOrder.status === 'pending' ? 'Pendente' :
                      selectedOrder.status === 'confirmed' ? 'Confirmado em WhatsApp' :
                      selectedOrder.status === 'cancelled' ? 'Cancelado' :
                      'Concluído'}</p>
                    <small>Data: {formatDate(selectedOrder.created_at)}</small>
                  </div>

                  <div className="detail-group">
                    <h4>Total</h4>
                    <p>{formatPrice(selectedOrder.total_amount)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="orders-table-panel">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Cliente</th>
                      <th>Data</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-table">Nenhum pedido encontrado</td>
                      </tr>
                    ) : (
                      filteredOrders.map(order => (
                        <tr key={order.id}>
                          <td>#{order.id}</td>
                          <td>
                            <strong>{order.customer_name}</strong><br />
                            <small>{order.customer_phone || 'Sob consulta'}</small>
                          </td>
                          <td>{formatDate(order.created_at)}</td>
                          <td>{formatPrice(order.total_amount)}</td>
                          <td>
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                              className="status-select"
                            >
                              <option value="pending">Pendente</option>
                              <option value="confirmed">Confirmado</option>
                              <option value="cancelled">Cancelado</option>
                              <option value="completed">Concluído</option>
                            </select>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="view-details-button"
                            >
                              Detalhes
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {showPixKeyModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Configurações</h2>
              <button
                className="close-button"
                onClick={() => setShowPixKeyModal(false)}
                aria-label="Fechar modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label htmlFor="pix-key">Chave Pix</label>
                <input
                  type="text"
                  id="pix-key"
                  value={currentPixKey}
                  onChange={(e) => setCurrentPixKey(e.target.value)}
                  placeholder="Copia e cola sua chave Pix"
                />
                <small>Use o formato CPNJ, e-mail ou telefone</small>
              </div>

              {newPixKey && (
                <div className="form-group">
                  <label htmlFor="new-pix-key">Nova Chave Pix</label>
                  <input
                    type="text"
                    id="new-pix-key"
                    value={newPixKey}
                    onChange={(e) => setNewPixKey(e.target.value)}
                    placeholder="Digite a nova chave ao inserir abaixo"
                  />
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setShowPixKeyModal(false)}
                  disabled={!newPixKey}
                >
                  Salvar Nova Chave
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => handleUpdatePixKey()}
                  disabled={!newPixKey}
                >
                  Simular Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;