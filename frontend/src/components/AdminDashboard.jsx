import { useState, useEffect } from 'react';
import { api } from '../api';
import { formatDate, formatPrice, getStockStatus } from '../utils';

function AdminDashboard({ onLogout }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stockDraft, setStockDraft] = useState({});
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editorOriginal, setEditorOriginal] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState('');
  async function mutate(action) {
    if (busy) return;
    setBusy(true);
    setError('');
    setFeedback('');
    try { await action(); const refreshed = await loadDashboardData(); if (refreshed) setFeedback('Alterações salvas com sucesso.'); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
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
  const [productFilter, setProductFilter] = useState('all');

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
      setError('');
      return true;
    } catch (error) {
      setError(error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleImageFileChange = async (file, targetSetter) => {
    if (!file || uploadingImage) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setUploadError('Use JPEG, PNG ou WebP de até 4MB.');
      return;
    }
    setUploadError('');
    setUploadingImage(true);
    try {
      const res = await api.uploadProductImage(file);
      targetSetter(prev => prev ? { ...prev, image_url: res.image_url } : prev);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLogout = async () => {
    if (busy || uploadingImage || (editorDirty && !window.confirm('Sair e descartar as alterações não salvas?'))) return;
    try {
      await api.logout();
      onLogout();
    } catch (error) {
      alert('Erro ao sair. Tente novamente.');
    }
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

  const editorDirty = !!editingProduct && JSON.stringify(editingProduct) !== editorOriginal;

  useEffect(() => {
    if (!editorDirty) return;
    const preventExit = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventExit);
    return () => window.removeEventListener('beforeunload', preventExit);
  }, [editorDirty]);

  function closeEditor() {
    if (busy || uploadingImage) return false;
    if (editorDirty && !window.confirm('Descartar as alterações não salvas?')) return false;
    setEditingProduct(null);
    setCreatingProduct(false);
    setUploadError('');
    return true;
  }

  function navigate(view) {
    if (editingProduct && !closeEditor()) return;
    setActiveView(view);
    setSearchTerm('');
    setFeedback('');
  }

  function openEditor(product = null) {
    const draft = product ? {
      id: product.id, name: product.name, category: product.category, price: product.price,
      description: product.description || '', image_url: product.image_url || '',
      stock_quantity: product.stock_quantity, is_active: Number(product.is_active)
    } : { name: '', category: '', price: '', description: '', image_url: '', stock_quantity: 0, is_active: 1 };
    setEditingProduct(draft);
    setEditorOriginal(JSON.stringify(draft));
    setCreatingProduct(!product);
    setUploadError('');
    setError('');
    setFeedback('');
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = productFilter === 'all'
      || (productFilter === 'inactive' && Number(product.is_active) !== 1)
      || (productFilter === 'available' && Number(product.is_active) === 1 && product.stock_quantity > 0)
      || (productFilter === 'out_of_stock' && Number(product.is_active) === 1 && product.stock_quantity <= 0)
      || (productFilter === 'low_stock' && Number(product.is_active) === 1 && product.stock_quantity > 0 && product.stock_quantity <= 3);
    return matchesSearch && matchesFilter && (categoryFilter === 'all' || product.category === categoryFilter);
  });

  const filteredOrders = orders.filter(order =>
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.includes(searchTerm.toLowerCase())
  );

  if (loading && products.length === 0 && orders.length === 0) {
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
          <h1>Doce Maná</h1>
          <p>Administração da loja</p>
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
          onClick={() => navigate('dashboard')}
          aria-current={activeView === 'dashboard' ? 'page' : undefined}
        >
          Dashboard
        </button>
        <button
          className={`nav-item ${activeView === 'products' ? 'active' : ''}`}
          onClick={() => navigate('products')}
          aria-current={activeView === 'products' ? 'page' : undefined}
        >
          Produtos
        </button>
        <button
          className={`nav-item ${activeView === 'orders' ? 'active' : ''}`}
          onClick={() => navigate('orders')}
          aria-current={activeView === 'orders' ? 'page' : undefined}
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
        {error && <p role="alert" className="admin-error">{error} <button className="admin-secondary" onClick={loadDashboardData}>Atualizar painel</button></p>}
        {feedback && <p role="status" className="admin-feedback">{feedback}</p>}
        {loading && <p role="status">Atualizando painel...</p>}
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
            <div className="admin-page-heading">
              <div><h2>{editingProduct ? (creatingProduct ? 'Novo produto' : editingProduct.name) : 'Produtos'}</h2><p>{editingProduct ? 'Organize os dados exibidos na loja.' : 'Gerencie preços, estoque e disponibilidade.'}</p></div>
              {!editingProduct && <button className="admin-primary" onClick={() => openEditor()}>+ Novo produto</button>}
            </div>
            {editingProduct ? (
              <section className="admin-editor" aria-label="Cadastro e edição de produto">
                <button type="button" className="admin-secondary" disabled={busy || uploadingImage} onClick={closeEditor}>Voltar para produtos</button>
                <form className="admin-editor-form" onSubmit={event => {
                  event.preventDefault();
                  mutate(async () => {
                    const payload = { name: editingProduct.name.trim(), category: editingProduct.category.trim(), price: Number(editingProduct.price), description: editingProduct.description, image_url: editingProduct.image_url, is_active: Number(editingProduct.is_active) };
                    if (creatingProduct) await api.createProduct({ ...payload, stock_quantity: 0 });
                    else await api.updateProduct(editingProduct.id, payload);
                    setEditingProduct(null);
                    setCreatingProduct(false);
                  });
                }}>
                  <fieldset disabled={busy || uploadingImage} className="admin-commercial-grid">
                    <label>Preço (R$)<input required type="number" min="0" step="0.01" value={editingProduct.price} onChange={event => setEditingProduct({ ...editingProduct, price: event.target.value })} /></label>
                    <label>Estoque atual<input readOnly value={`${editingProduct.stock_quantity} unidades`} /><small>{creatingProduct ? 'O produto será criado com estoque zero.' : 'Ajuste a quantidade na lista para proteger pedidos concorrentes.'}</small></label>
                    <label>Status de publicação<select value={editingProduct.is_active} onChange={event => setEditingProduct({ ...editingProduct, is_active: Number(event.target.value) })}><option value={1}>Ativo</option><option value={0}>Inativo</option></select><small>Produtos ativos sem estoque ficam esgotados.</small></label>
                  </fieldset>
                  <div className="admin-editor-columns">
                    <fieldset disabled={busy || uploadingImage} className="admin-form-card">
                      <legend>Informações do produto</legend>
                      <label>Nome do produto<input required maxLength={200} value={editingProduct.name} onChange={event => setEditingProduct({ ...editingProduct, name: event.target.value })} /></label>
                      <label>Categoria<input required list="admin-categories" value={editingProduct.category} onChange={event => setEditingProduct({ ...editingProduct, category: event.target.value })} /></label>
                      <datalist id="admin-categories">{[...new Set(products.map(product => product.category).filter(Boolean))].map(category => <option key={category} value={category} />)}</datalist>
                      <label>Descrição<textarea rows={6} value={editingProduct.description} onChange={event => setEditingProduct({ ...editingProduct, description: event.target.value })} /></label>
                    </fieldset>
                    <fieldset disabled={busy || uploadingImage} className="admin-form-card">
                      <legend>Foto do produto</legend>
                      <div className="admin-media-preview">{editingProduct.image_url ? <img src={editingProduct.image_url} alt={`Foto de ${editingProduct.name || 'novo produto'}`} /> : <p>Nenhuma foto selecionada</p>}</div>
                      <label>Selecionar imagem<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => handleImageFileChange(event.target.files[0], setEditingProduct)} /></label>
                      <small>JPEG, PNG ou WebP de até 4 MB.</small>
                      {editingProduct.image_url && <button type="button" className="admin-secondary" onClick={() => setEditingProduct({ ...editingProduct, image_url: '' })}>Remover foto</button>}
                    </fieldset>
                  </div>
                  {uploadingImage && <p role="status">Enviando imagem...</p>}
                  {uploadError && <p role="alert" className="admin-error">{uploadError}</p>}
                  <div className="admin-editor-actions"><span>{editorDirty ? 'Alterações não salvas' : 'Nenhuma alteração pendente'}</span><button type="button" className="admin-secondary" disabled={busy || uploadingImage} onClick={closeEditor}>Cancelar</button><button type="submit" className="admin-primary" disabled={busy || uploadingImage || (!creatingProduct && !editorDirty)}>{busy ? 'Salvando...' : creatingProduct ? 'Cadastrar produto' : 'Salvar alterações'}</button></div>
                </form>
              </section>
            ) : <>
              <div className="admin-toolbar">
                <label>Buscar produto
                  <input type="search" placeholder="Nome ou categoria..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
                </label>
                <label>Status e estoque
                  <select value={productFilter} onChange={event => setProductFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    <option value="available">Disponíveis</option>
                    <option value="out_of_stock">Esgotados</option>
                    <option value="low_stock">Estoque baixo</option>
                    <option value="inactive">Inativos</option>
                  </select>
                </label>
                <label>Categoria
                  <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                    <option value="all">Todas</option>
                    {[...new Set(products.map(product => product.category).filter(Boolean))].map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <button type="button" className="admin-secondary" onClick={() => { setSearchTerm(''); setProductFilter('all'); setCategoryFilter('all'); }}>Limpar filtros</button>
              </div>
              <details className="admin-more-actions">
                <summary>Mais ações</summary>
                <button type="button" disabled={busy} onClick={() => { if (window.confirm('Importar produtos ausentes do catálogo original com estoque zero? Produtos existentes não serão alterados.')) mutate(() => api.importCatalog()); }}>Importar catálogo original (estoque zero)</button>
              </details>
              <div className="admin-product-list">
                {filteredProducts.length === 0 ? (
                  <div className="empty-grid">Nenhum produto encontrado</div>
                ) : (
                  filteredProducts.map(product => {
                    const stockStatus = getStockStatus(product);
                    const stockValue = stockDraft[product.id] ?? String(product.stock_quantity);
                    const isActive = Number(product.is_active) === 1;

                    return (
                      <article key={product.id} className="admin-product-row">
                        <div className="admin-product-identity">
                          {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <div className="admin-product-placeholder" aria-hidden="true">Sem foto</div>}
                          <div><h3>{product.name}</h3><p>{product.category}</p></div>
                        </div>
                        <div className="admin-product-price"><small>Preço</small><strong>{formatPrice(product.price)}</strong></div>
                        <form className="admin-stock-form" onSubmit={event => {
                          event.preventDefault();
                          if (stockValue !== '' && Number.isInteger(Number(stockValue)) && Number(stockValue) >= 0 && Number(stockValue) <= 2147483647) mutate(async () => {
                            await api.updateStock(product.id, Number(stockValue), product.stock_quantity);
                            setStockDraft(current => { const next = { ...current }; delete next[product.id]; return next; });
                          });
                        }}>
                          <label>Estoque
                            <input type="number" min="0" step="1" max="2147483647" required aria-label={`Estoque de ${product.name}`} disabled={busy} value={stockValue} onChange={event => setStockDraft({ ...stockDraft, [product.id]: event.target.value })} />
                          </label>
                          <button type="submit" disabled={busy || Number(stockValue) === Number(product.stock_quantity)}>Salvar</button>
                        </form>
                        <div className="admin-product-state">
                          <span>{isActive ? 'Ativo' : 'Inativo'}</span>
                          <span className={`stock-badge ${stockStatus.color}`}>{stockStatus.label}</span>
                          <button type="button" disabled={busy} onClick={() => mutate(() => api.toggleProduct(product.id))}>{isActive ? 'Desativar' : 'Ativar'}</button>
                        </div>
                        <button type="button" disabled={busy} onClick={() => openEditor(product)}>Editar</button>
                      </article>
                    );
                  })
                )}
              </div>
            </>}
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