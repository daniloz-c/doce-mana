import { useMemo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import strawberryPhoto from '../../assets/img/819524151_18102754568288729_4846377332151617293_n.jpg';
import browniePhoto from '../../assets/img/819236802_18102869321288729_8184103506698788233_n.jpg';
import './styles.css';
import './admin.css';

const whatsappNumber = '5547984572173';
const instagramUrl = 'https://www.instagram.com/p/Ddo6dcLFd_c/?img_index=1';
window.demoProducts = [
  { id: 1, name: 'Morango do Amor Clássico', description: 'Morango fresquinho, chocolate ao leite e aquele crocante irresistível.', price: 5, category: 'Morangos do Amor', image: strawberryPhoto, tag: 'Queridinho', emoji: '🍓' },
  { id: 2, name: 'Morango do Amor Branco', description: 'Cobertura de chocolate branco para deixar tudo ainda mais especial.', price: 6, category: 'Morangos do Amor', image: strawberryPhoto, tag: 'Delicado', emoji: '🍓' },
  { id: 3, name: 'Morango do Amor Diet', description: 'Uma versão leve com chocolate diet e pedacinhos de castanha.', price: 7, category: 'Morangos do Amor', emoji: '🍓' },
  { id: 4, name: 'Brownie Tradicional', description: 'Chocolate meio amargo, casquinha por fora e maciez por dentro.', price: 8, category: 'Brownies', image: browniePhoto, tag: 'Feito à mão', emoji: '🍫' },
  { id: 5, name: 'Brownie de Doce de Leite', description: 'Brownie intenso com um recheio cremoso de doce de leite.', price: 9, category: 'Brownies', image: browniePhoto, emoji: '🍫' },
  { id: 6, name: 'Brownie de Nutella', description: 'Muito chocolate e um recheio generoso para adoçar seu dia.', price: 10, category: 'Brownies', image: browniePhoto, tag: 'Mais chocolatudo', emoji: '🍫' },
  { id: 7, name: 'Brigadeiro Gourmet', description: 'Brigadeiro macio de chocolate com granulado especial.', price: 4, category: 'Doces Variados', emoji: '🍬' },
  { id: 8, name: 'Beijinho de Coco', description: 'Coco fresquinho, sabor de festa e um toque de carinho.', price: 3.5, category: 'Doces Variados', emoji: '🥥' },
  { id: 9, name: 'Cajuzinho', description: 'Amendoim e chocolate na combinação que todo mundo ama.', price: 3.5, category: 'Doces Variados', emoji: '🥜' },
];

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
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [cart, setCart] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  function changeQuantity(productId, amount) {
    setCart((currentCart) => {
      const quantity = (currentCart[productId] || 0) + amount;
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
    const isConfirmed = confirm('Deseja entrar no painel administrativo? Use:\nUsuário: admin\nSenha: admin123');
    if (isConfirmed) {
      setIsAdmin(true);
      setShowAdminLogin(false);
    }
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

  const cartItems = Object.keys(cart).map(productId => {
    const product = window.demoProducts.find(p => p.id === parseInt(productId));
    return product && cart[productId] ? { ...product, quantity: cart[productId] } : null;
  }).filter(Boolean);

  const cartTotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  function checkout() {
    if (cartTotal === 0) {
      alert('Seu carrinho está vazio. Adicione produtos para fazer um pedido.');
      return;
    }

    const orderLines = cartItems
      .map(
        (item) =>
          `• ${item.quantity}x ${item.name} — ${formatPrice(item.price * item.quantity)}`,
      )
      .join('\n');

    const message = [
      'Oi! Gostaria de fazer um pedido na Doce Maná 🍓',
      '',
      orderLines,
      '',
      `Total: ${formatPrice(cartTotal)}`,
    ].join('\n');

    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
    setOrderSent(true);
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
            {window.demoProducts.map((product, index) => (
              <article className="product-card" key={product.id}>
                <div className={`product-image product-tone-${index % 4}`}>
                  {product.image ? (
                    <img src={product.image} alt={product.name} loading="lazy" />
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
                  <button type="button" className="button button-primary checkout-button" onClick={checkout}>
                    Pedir pelo WhatsApp <Icon name="arrow" size={18} />
                  </button>
                  {orderSent && <p className="order-note" role="status">Seu pedido foi preparado para enviar. Se a nova aba não abriu, confira o bloqueador de pop-ups.</p>}
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {showAdminLogin && (
        <AdminLoginView onClose={() => setShowAdminLogin(false)} onLogout={() => setIsAdmin(false)} />
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

function AdminLoginView({ onClose, onLogout }) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setShowPassword(false);

    const username = prompt('Digite seu usuário:');
    const password = showPassword ? prompt('Sua senha é: ') : null;

    if (!username || !password) {
      setIsLoading(false);
      return;
    }

    try {
      const success = confirm('Login simulado!\n\nUsuário: admin\nSenha: admin123\n\nAuto-confirmar entrada?');

      if (success) {
        onClose();
        onLogout();
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      alert('Erro ao fazer login');
    }
  };

  return (
    <div className="admin-login">
      <div className="login-container">
        <div className="login-header">
          <h1>Admin - Doce Maná</h1>
          <p>Acesse o painel administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Usuário</label>
            <input
              type="text"
              id="username"
              name="username"
              placeholder="Seu usuário"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              type="text"
              id="password"
              name="password"
              value={showPassword ? prompt('Digite sua senha (sou admin)') : ''}
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="button button-primary button-full"
            disabled={isLoading}
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="login-tips">
          <h4>Dicas</h4>
          <ul>
            <li>Usuário: <strong>admin</strong></li>
            <li>Senha: <strong>admin123</strong></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);