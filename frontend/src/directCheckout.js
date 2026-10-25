const whatsappNumber = '5547984572173';

function formatPrice(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function createDirectCheckout(items, total) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Seu carrinho está vazio. Adicione produtos para fazer um pedido.');
  }

  const lines = items.map(item => `• ${item.quantity}x ${item.name} — ${formatPrice(item.price * item.quantity)}`);
  const message = [
    'Olá! Gostaria de fazer um pedido na Doce Maná. ♡',
    '',
    '*Resumo do pedido:*',
    ...lines,
    '',
    `*Total: ${formatPrice(total)}*`,
    '',
    'Gostaria de combinar o pagamento e a entrega ou retirada.'
  ].join('\n');

  return { url: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` };
}
