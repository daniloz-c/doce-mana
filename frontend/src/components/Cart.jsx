import { useState, useEffect } from 'react';
import { api } from '../api';
import { formatPrice, getWhatsAppUrl, getStockStatus } from '../utils';

function Cart({ isOpen, onClose, items, setItems, onOrderSuccess }) {
  const [itemsFetched, setItemsFetched] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [pixKey, setPixKey] = useState('');

  useEffect(() => {
    const fetchCart = async () => {
      if (isOpen) {
        try {
          const cartItems = await api.getCart();
          setItems(cartItems);
          setItemsFetched(true);
        } catch (error) {
          console.error('Error fetching cart:', error);
        }
      }
    };

    fetchCart();
  }, [isOpen]);

  useEffect(() => {
    const fetchPixKey = async () => {
      try {
        const response = await api.getPixKey();
        setPixKey(response.pixKey);
      } catch (error) {
        console.error('Error fetching Pix Key:', error);
        setPixKey('0000'); // Fallback
      }
    };

    fetchPixKey();
  }, []);

  const updateQuantity = async (productId, quantity) => {
    try {
      const cartItem = await api.updateCartQuantity(productId, quantity);
      setItems(cartItem);
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const removeFromCart = async (productId) => {
    try {
      const cartItem = await api.removeFromCart(productId);
      setItems(cartItem);
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      setCheckoutError('Seu carrinho está vazio');
      return;
    }

    setIsCreatingOrder(true);
    setCheckoutError(null);
    setOrderSent(false);

    try {
      const itemsWithDetails = items.map(item => ({
        product_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }));

      const total = await items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const orderData = {
        customer_name: 'Cliente visiting',
        customer_phone: '', // O cliente preencherá no WhatsApp
        customer_address: '', // O cliente preencherá no WhatsApp
        total_amount: total,
        notes: '', // O cliente pode adicionar notas
        items: itemsWithDetails,
        pix_key: pixKey
      };

      const result = await api.createOrder(orderData);

      if (result.success) {
        localStorage.removeItem('cart');

        const message = result.order.pix_key || '';
        if (message) {
          window.open(getWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
          setOrderSent(true);
          onOrderSuccess?.();

          // Limpar carrinho após sucesso
          const cartItem = await api.getCart();
          setItems(cartItem);
        }
      }
    } catch (error) {
      setCheckoutError(error.message || 'Erro ao criar pedido');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const cartTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const stockCount = items.reduce((sum, item) => sum + item.stock_available, 0);

  if (!isOpen) return null;

  return (
    <div className="cart-backdrop" onClick={onClose}>
      <aside
        className="cart-drawer"
        onClick={(event) => event.stopPropagation()}
        aria-label="Sua sacola"
      >
        <div className="drawer-header">
          <div>
            <span className="eyebrow">seu momento doce</span>
            <h2>Minha sacola</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar sacola"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>

        {items.length ? (
          <>
            <div className="cart-items">
              {items.map((item) => {
                const stockStatus = getStockStatus(item);

                return (
                  <div className="cart-item" key={item.id}>
                    <div className="cart-item-emoji">{item.emoji || '💝'}</div>
                    <div className="cart-item-info">
                      <strong>{item.name}</strong>
                      <span>{formatPrice(item.price)} cada</span>
                      <div className="quantity-control">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          aria-label={`Remover uma unidade de ${item.name}`}
                          disabled={quantity => quantity > 0}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14" />
                          </svg>
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          aria-label={`Adicionar uma unidade de ${item.name}`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                      {stockStatus.status !== 'available' && (
                        <span className="stock-status" style={{ color: stockStatus.color }}>
                          {stockStatus.label}
                        </span>
                      )}
                    </div>
                    <strong className="cart-item-total">{formatPrice(item.price * item.quantity)}</strong>
                  </div>
                );
              })}
            </div>

            <div className="cart-summary">
              <div><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div>
              <small>Clique em finalizar para abrir o WhatsApp com seu pedido</small>
              <button
                type="button"
                className="button button-primary checkout-button"
                onClick={handleCheckout}
                disabled={isCreatingOrder}
              >
                {isCreatingOrder ? 'Processando...' : 'Finalizar pedido'}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>

              {orderSent && (
                <p className="order-note" role="status">
                  Seu pedido foi enviado para o WhatsApp. Se a nova aba não abriu, confira o bloqueador de pop-ups.
                </p>
              )}

              {checkoutError && (
                <p className="order-note" style={{ color: 'red' }} role="alert">
                  {checkoutError}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="empty-cart">
            <span>🍓</span>
            <h3>Sua sacola está esperando</h3>
            <p>Escolha um docinho para deixar o dia mais gostoso.</p>
            <button type="button" className="button button-primary" onClick={onClose}>
              Ver cardápio
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

export default Cart;