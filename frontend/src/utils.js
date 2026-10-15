export function formatPrice(price) {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

export function truncateText(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function generateWhatsAppMessage(items, total, pixKey) {
  if (!items || items.length === 0) {
    return '';
  }

  const orderLines = items
    .map(
      (item) =>
        `• ${item.quantity}x ${item.name} — ${formatPrice(item.price * item.quantity)}`
    )
    .join('\n');

  return `Olá! Gostaria de fazer um pedido na Doce Maná. \n\n*Resumo do pedido:* \n\n${orderLines}\n\n*Total: ${formatPrice(total)}* \n\nChave Pix: ${pixKey} \n\nGostaria de combinar o pagamento e verificar as opções de entrega ou retirada. \n\nAguardo o retorno. Obrigado!`;
}

export function getWhatsAppNumber() {
  return process.env.VITE_WHATSAPP_NUMBER || '5547984572173';
}

export function getWhatsAppUrl(message) {
  const phoneNumber = getWhatsAppNumber();
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
}

export function formatDate(date) {
  return new Date(date).toLocaleString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getStockStatus(product) {
  if (!product || product.is_active === 0) {
    return { status: 'inactive', label: 'Indisponível', color: 'gray' };
  }

  if (!product.stock_quantity || product.stock_quantity <= 0) {
    return { status: 'out_of_stock', label: 'Esgotado', color: 'red' };
  }

  if (product.stock_quantity <= 3) {
    return { status: 'low_stock', label: 'Estoque Baixo', color: 'orange' };
  }

  return { status: 'available', label: 'Disponível', color: 'green' };
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone) {
  const phoneRegex = /^\d{10,11}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}