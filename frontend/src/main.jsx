import { useState, useEffect, useRef } from 'react';
import { createCheckoutAttempt } from './checkoutAttempt';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { api } from './api';
import { createRoot } from 'react-dom/client';
import strawberryPhoto from '../../assets/img/819524151_18102754568288729_4846377332151617293_n.jpg';
import browniePhoto from '../../assets/img/819236802_18102869321288729_8184103506698788233_n.jpg';
import './styles.css';
import './admin.css';

const whatsappNumber = '5547984572173';
const instagramUrl = 'https://www.instagram.com/p/Ddo6dcLFd_c/?img_index=1';

function formatPrice(price) {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (name === 'bag') {
    return (
      <svg {...common}>
        <path d="M5 8h14l-1 12H6L5 8Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </svg>
    );
  }
  if (name === 'arrow') {
    return (
      <svg {...common}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    );
  }
  if (name === 'close') {
    return (
      <svg {...common}>
        <path d="m18 6-12 12M6 6l12 12" />
      </svg>
    );
  }
  if (name === 'plus') {
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (name === 'minus') {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
      </svg>
    );
  }
  if (name === 'heart') {
    return (
      <svg {...common}>
        <path d="M20.8 8.8c0 5.1-8.8 10-8.8 10s-8.8-4.9-8.8-10A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />
      </svg>
    );
  }
  return null;
}

function App() {
  const [products, setProducts] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [receipt, setReceipt] = useState(null);
  const attempt = useRef(createCheckoutAttempt());
  const sending = useRef(false);
  const pending = attempt.current.pending;
  async function refreshProducts() {
    try {
      const data = await api.getProducts();
      setProducts(data.products.map(product => ({ ...product, image_url: product.image_url || (product.category === 'Brownies' ? browniePhoto : product.category === 'Morangos do Amor' ? strawberryPhoto : null) })));
      setCatalogError('');
      setCart(current => attempt.current.pending ? current : Object.fromEntries(data.products.filter(p => current[p.id]).map(p => [p.id, Math.min(current[p.id], p.stock_quantity)])));
    } catch (error) {
      setCatalogError(error.message);
    } finally {
      setCatalogLoading(false);
    }
  }
  useEffect(() => {
    refreshProducts();
    const timer = setInterval(refreshProducts, 30000);
    window.addEventListener('focus', refreshProducts);
    return () => { clearInterval(timer); window.removeEventListener('focus', refreshProducts); };
  }, []);
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [cart, setCart] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  function changeQuantity(productId, amount) {
    if (sending.current || attempt.current.pending) return;
    setRequestId(crypto.randomUUID());
    setCart((currentCart) => {
      const quantity = Math.min((currentCart[productId] || 0) + amount, products.find(p => p.id === productId)?.stock_quantity || 0);
      const nextCart = { ...currentCart };
      if (quantity <= 0) {
        delete nextCart[productId];
      } else {
        nextCart[productId] = quantity;
      }
      return nextCart;
    });
    setOrderSent(false);
  }

  function handleAdminClick() {
    window.location.href = '/admin';
  }

  function closeModal() {
    setIsCartOpen(false);
  }

  function modal() {
    const message = 'Carrinho vazio - adicione produtos';
    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
    setOrderSent(true);
  }

  const cartItems = pending?.items || Object.keys(cart).map(productId => {
    const product = products.find(p => p.id === parseInt(productId));
    return product && cart[productId] ? { ...product, quantity: cart[productId] } : null;
  }).filter(Boolean);

  const cartTotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  async function checkout() {
    if (!attempt.current.pending && cartItems.length === 0) {
      alert('Seu carrinho está vazio. Adicione produtos para fazer um pedido.');
      return;
    }

    if (sending.current || (!attempt.current.pending && (!customerName.trim() || !customerPhone.trim()))) return;
    const snapshot = attempt.current.begin({ request_id: requestId, customer_name: customerName, customer_phone: customerPhone, items: cartItems.map(item => ({ product_id: item.id, quantity: item.quantity })) }, cartItems);
    sending.current = true;
    setSubmitting(true);
    try {
      const { order } = await api.createOrder(snapshot.payload);
      const message = [`Pedido #${order.id} - ${customerName}`, ...order.items.map(item => `${item.quantity}x ${item.name} - ${formatPrice(item.price * item.quantity)}`), `Total: ${formatPrice(order.total_amount)}`].join('\n');
      setReceipt({ id: order.id, url: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` });
      attempt.current.finish();
      setCart({});
      setRequestId(crypto.randomUUID());
      await refreshProducts();
    } catch (error) {
      alert(error.message);
      attempt.current.reject(error);
      if (!attempt.current.pending) { setRequestId(crypto.randomUUID()); await refreshProducts(); }
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="announcement">
        <span>Feito com carinho, do jeitinho que adoça o seu dia</span>
        <Icon name="heart" size={15} />
      </div>

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Doce Maná — início">
          <span className="brand-mark">dm</span>
          <span className="brand-name">
            doce maná<span>.</span>
            <small>doces feitos com amor</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="#inicio">Início</a>
          <a href="#cardapio">Nosso cardápio</a>
          {isAdmin && (
            <a href="#admin" onClick={(e) => { e.preventDefault(); setShowAdminLogin(true); }}>
              Painel Admin
            </a>
          )}
          {isAdmin && (
            <a href="#admin" onClick={(e) => { e.preventDefault(); handleAdminClick(); }}>
              Admin
            </a>
          )}
          <a href="#sobre">Nossa história</a>
        </nav>
        <button
          className="cart-button"
          type="button"
          onClick={() => setIsCartOpen(true)}
          aria-label={`Abrir sacola, ${Object.keys(cart).length} itens`}
        >
          <Icon name="bag" />
          <span className="cart-button-label">Minha sacola</span>
          <span className="cart-count">{Object.keys(cart).length}</span>
        </button>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-copy">
            <span className="eyebrow"><span /> um docinho muda tudo</span>
            <h1>Pequenos prazeres,<br />feitos com <em>amor.</em></h1>
            <p>
              Morangos do amor, brownies e outros docinhos artesanais para
              deixar qualquer momento mais gostoso.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#cardapio">
                Ver nosso cardápio <Icon name="arrow" size={18} />
              </a>
              <span className="made-note">
                <span className="made-note-icon">♡</span> Feito à mão, com carinho
              </span>
            </div>
            <div className="hero-proof">
              <span className="proof-stars" aria-label="5 estrelas">★★★★★</span>
              <span>Um carinho em forma de doce</span>
            </div>
          </div>
          <div className="hero-art" aria-label="Brownie recheado artesanal">
            <div className="hero-sticker">feito<br />com amor <span>♡</span></div>
            <img src={browniePhoto} alt="Brownies recheados de chocolate" />
            <div className="hero-caption">
              <span>da nossa cozinha</span>
              <strong>pra adoçar a sua vida</strong>
            </div>
            <span className="art-sparkle sparkle-one">✳</span>
            <span className="art-sparkle sparkle-two">✦</span>
          </div>
          <span className="hero-decoration decor-left">✳</span>
          <span className="hero-decoration decor-right">✿</span>
        </section>

        <section className="promise-strip" aria-label="Nossos cuidados">
          <div><span>♡</span><p>Feito à mão<small>com muito carinho</small></p></div>
          <div><span>✿</span><p>Ingredientes fresquinhos<small>qualidade em cada mordida</small></p></div>
          <div><span>☼</span><p>Doce do seu jeito<small>feito para compartilhar</small></p></div>
        </section>

        <section className="menu-section" id="cardapio">
          <div className="section-heading">
            <div>
              <span className="eyebrow">feito hoje, para você</span>
              <h2>Escolha seu <em>favorito</em></h2>
            </div>
            <p>Um pedacinho de felicidade<br />sempre cai bem.</p>
          </div>

          <section aria-label="Filtrar por categoria">
            <div className="category-list" role="tablist">
              <button
                key="Todos"
                type="button"
                role="tab"
                aria-selected={activeCategory === 'Todos'}
                className={`category-chip ${activeCategory === 'Todos' ? 'active' : ''}`}
                onClick={() => setActiveCategory('Todos')}
              >
                Todos
              </button>
              <button
                key="Morangos do Amor"
                type="button"
                role="tab"
                aria-selected={activeCategory === 'Morangos do Amor'}
                className={`category-chip ${activeCategory === 'Morangos do Amor' ? 'active' : ''}`}
                onClick={() => setActiveCategory('Morangos do Amor')}
              >
                Morangos do Amor
              </button>
              <button
                key="Brownies"
                type="button"
                role="tab"
                aria-selected={activeCategory === 'Brownies'}
                className={`category-chip ${activeCategory === 'Brownies' ? 'active' : ''}`}
                onClick={() => setActiveCategory('Brownies')}
              >
                Brownies
              </button>
              <button
                key="Doces Variados"
                type="button"
                role="tab"
                aria-selected={activeCategory === 'Doces Variados'}
                className={`category-chip ${activeCategory === 'Doces Variados' ? 'active' : ''}`}
                onClick={() => setActiveCategory('Doces Variados')}
              >
                Doces Variados
              </button>
            </div>
          </section>

          <section className="product-grid">
            {catalogLoading && <p role="status">Carregando cardápio...</p>}
            {catalogError && <p role="alert">{catalogError} <button onClick={refreshProducts}>Tentar novamente</button></p>}
            {!catalogLoading && !catalogError && products.length === 0 && <p>Nenhum produto disponível no momento.</p>}
            {products.filter(product => activeCategory === 'Todos' || product.category === activeCategory).map((product, index) => (
              <article className="product-card" key={product.id}>
                <div className={`product-image product-tone-${index % 4}`}>
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} loading="lazy" />
                  ) : (
                    <div className="product-placeholder" aria-hidden="true">
                      <span>{product.emoji}</span>
                      <i>{product.category === 'Brownies' ? '✳' : '♡'}</i>
                    </div>
                  )}
                  <button
                    type="button"
                    className={`quick-add ${cart[product.id] ? 'added' : ''}`}
                    onClick={() => changeQuantity(product.id, 1)}
                    aria-label={`Adicionar ${product.name} à sacola`}
                  >
                    <Icon name="plus" size={19} />
                  </button>
                </div>
                <div className="product-details">
                  <span className="product-category">{product.category}</span>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="product-footer">
                    <strong>{formatPrice(product.price)}</strong>
                    <button
                      type="button"
                      className="add-link"
                      onClick={() => changeQuantity(product.id, 1)}
                    >
                      {cart[product.id] ? `Na sacola (${cart[product.id]})` : 'Adicionar'}
                      <span>+</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
          <p className="menu-note">Todos os nossos docinhos são preparados fresquinhos, sob encomenda. ♡</p>
        </section>

        <section className="love-note" id="sobre">
          <div className="love-note-icon">♡</div>
          <div>
            <span className="eyebrow">um pouquinho da nossa história</span>
            <h2>Mais que um doce.<br /><em>Um gesto de carinho.</em></h2>
            <p>
              Na Doce Maná, cada receita é preparada com cuidado e ingredientes
              escolhidos com carinho. Porque os melhores momentos merecem um
              docinho especial.
            </p>
            <a href={instagramUrl} target="_blank" rel="noreferrer" className="text-link">
              Vem conhecer nosso Instagram <Icon name="arrow" size={17} />
            </a>
          </div>
          <div className="love-note-stamp"><span>feito<br />com amor</span><b>♡</b></div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#inicio">
          <span className="brand-mark">dm</span>
          <span className="brand-name">doce maná<span>.</span><small>doces feitos com amor</small></span>
        </a>
        <p>Feito com amor, adoçado com carinho. ♡</p>
        <a href={instagramUrl} target="_blank" rel="noreferrer">Instagram <Icon name="arrow" size={15} /></a>
      </footer>

      {Object.keys(cart).length > 0 && (
        <button
          type="button"
          className="mobile-cart-bar"
          onClick={() => setIsCartOpen(true)}
        >
          <span><Icon name="bag" size={19} /> Minha sacola · {Object.keys(cart).length} {Object.keys(cart).length === 1 ? 'item' : 'itens'}</span>
          <strong>{formatPrice(cartTotal)}</strong>
        </button>
      )}

      {isCartOpen && (
        <div className="cart-backdrop" onClick={closeModal}>
          <aside
            className="cart-drawer"
            aria-label="Sua sacola"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-header">
              <div><span className="eyebrow">seu momento doce</span><h2>Minha sacola</h2></div>
              <button
                className="icon-button"
                type="button"
                onClick={closeModal}
                aria-label="Fechar sacola"
              >
                <Icon name="close" />
              </button>
            </div>

            {receipt && <p role="status">Pedido #{receipt.id} registrado. <a href={receipt.url} target="_blank" rel="noreferrer">Enviar pedido pelo WhatsApp</a></p>}
            {Object.keys(cart).length === 0 ? (
              <div className="empty-cart">
                <span>🍓</span>
                <h3>Sua sacola está esperando</h3>
                <p>Escolha um docinho para deixar o dia mais gostoso.</p>
                <button type="button" className="button button-primary" onClick={closeModal}>Ver cardápio</button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cartItems.map(item => (
                    <div className="cart-item" key={item.id}>
                      <div className="cart-item-emoji">{item.emoji || '💝'}</div>
                      <div className="cart-item-info">
                        <strong>{item.name}</strong>
                        <span>{formatPrice(item.price)} cada</span>
                        <div className="quantity-control">
                          <button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`Remover uma unidade de ${item.name}`}>
                            <Icon name="minus" size={15} />
                          </button>
                          <span>{item.quantity}</span>
                          <button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`Adicionar uma unidade de ${item.name}`}>
                            <Icon name="plus" size={15} />
                          </button>
                        </div>
                      </div>
                      <strong className="cart-item-total">{formatPrice(item.price * item.quantity)}</strong>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div>
                  <small>Combinar entrega pelo WhatsApp ♡</small>
                  <label>Nome<input value={customerName} disabled={submitting || !!pending} onChange={e => setCustomerName(e.target.value)} maxLength={120} /></label>
                  <label>Telefone<input type="tel" value={customerPhone} disabled={submitting || !!pending} onChange={e => setCustomerPhone(e.target.value)} maxLength={30} /></label>
                  {pending && <p role="status">Tentativa pendente: itens e dados estão preservados. Reenvie para obter o resultado sem criar outro pedido. Não feche nem recarregue esta página.</p>}
                  <small>Registrar o pedido consome o estoque. Depois, envie a confirmação pelo WhatsApp.</small>
                  <button type="button" disabled={submitting || (!pending && (!!catalogError || !customerName.trim() || !customerPhone.trim()))} className="button button-primary checkout-button" onClick={checkout}>
                    {pending ? 'Consultar / reenviar mesma tentativa' : 'Pedir pelo WhatsApp'} <Icon name="arrow" size={18} />
                  </button>
                  {orderSent && <p className="order-note" role="status">Seu pedido foi preparado para enviar. Se a nova aba não abriu, confira o bloqueador de pop-ups.</p>}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {showAdminLogin && (
        <AdminLogin onLoginSuccess={() => { window.location.href = '/admin'; }} onLogout={() => setShowAdminLogin(false)} />
      )}

      {isAdmin && (
        <div className="admin-toolbar">
          <button
            className="admin-button"
            onClick={() => { setIsAdmin(false); setIsAdmin(false); window.location.href = '/admin'; }}
          >
            Sair do modo admin
          </button>
        </div>
      )}
    </>
  );
}

function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const expire = () => setAuthenticated(false);
    window.addEventListener('admin-session-expired', expire);
    let active = true;
    api.getAdminDashboard()
      .then(() => { if (active) setAuthenticated(true); })
      .catch(error => { if (active && error.status !== 401) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      window.removeEventListener('admin-session-expired', expire);
    };
  }, []);

  if (loading) return <div className="loading-container">Carregando painel...</div>;
  if (error) return <div className="form-error" role="alert">{error}</div>;
  return authenticated
    ? <AdminDashboard onLogout={() => setAuthenticated(false)} />
    : <AdminLogin onLoginSuccess={() => setAuthenticated(true)} onLogout={() => { window.location.href = '/'; }} />;
}

createRoot(document.getElementById('root')).render(
  /^\/admin(?:\/|$)/.test(window.location.pathname) ? <AdminPage /> : <App />
);