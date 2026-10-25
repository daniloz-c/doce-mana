import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCart, saveCart } from './cartStorage.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    has: key => values.has(key),
    value: key => values.get(key)
  };
}

test('restaura o carrinho atual', () => {
  const session = storage({ 'doce-cart': JSON.stringify({ 7: 2 }) });
  assert.deepEqual(loadCart(session), { 7: 2 });
});

test('migra o carrinho legado do checkout sem perder itens', () => {
  const session = storage({ 'doce-checkout': JSON.stringify({ cart: { 9: 3 }, requestId: 'antigo' }) });
  assert.deepEqual(loadCart(session), { 9: 3 });
  saveCart(session, { 9: 3 });
  assert.deepEqual(JSON.parse(session.value('doce-cart')), { 9: 3 });
  assert.equal(session.has('doce-checkout'), false);
});

test('dados inválidos resultam em carrinho vazio', () => {
  assert.deepEqual(loadCart(storage({ 'doce-cart': '{' })), {});
  assert.deepEqual(loadCart(storage({ 'doce-checkout': JSON.stringify({ cart: null }) })), {});
});
