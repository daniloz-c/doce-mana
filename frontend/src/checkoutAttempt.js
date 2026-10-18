export function resumeCheckout(saved, result, now = Date.now()) {
  return ['success', 'error'].includes(result) && Number.isFinite(saved.loginStartedAt) && now >= saved.loginStartedAt && now - saved.loginStartedAt < 600000;
}

export function shouldResumeCheckout(saved, result, now = Date.now()) {
  return saved.checkoutIntent === true && result === 'success' && resumeCheckout(saved, result, now);
}

export function saveCheckoutReceipt(order, customer, items, requestId, storage, navigate, onSaved) {
  const price = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const message = [`Pedido #${order.id} - ${customer.name}`, `Email: ${customer.email}`, ...order.items.map(item => `${item.quantity}x ${item.name} - ${price(item.price * item.quantity)}`), `Total: ${price(order.total_amount)}`].join('\n');
  const receipt = { id: order.id, url: `https://wa.me/5547984572173?text=${encodeURIComponent(message)}`, items };
  storage.setItem('doce-checkout', JSON.stringify({ cart: {}, requestId, pending: null, receipt, checkoutIntent: false }));
  onSaved(receipt);
  navigate(receipt.url);
}

export function createCheckoutAttempt(initial = null) {
  let pending = initial;
  return {
    get pending() { return pending; },
    begin(payload, items) {
      if (!pending) pending = structuredClone({ payload, items });
      return pending;
    },
    finish() { pending = null; },
    reject(error) {
      if ([400, 409].includes(error.status)) pending = null;
    }
  };
}
