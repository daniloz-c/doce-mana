const currentKey = 'doce-cart';
const legacyKey = 'doce-checkout';

function cartObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function loadCart(storage) {
  try {
    const current = storage.getItem(currentKey);
    if (current !== null) return cartObject(JSON.parse(current));
    const legacy = JSON.parse(storage.getItem(legacyKey) || 'null');
    return cartObject(legacy?.cart);
  } catch {
    return {};
  }
}

export function saveCart(storage, cart) {
  storage.setItem(currentKey, JSON.stringify(cartObject(cart)));
  storage.removeItem(legacyKey);
}
