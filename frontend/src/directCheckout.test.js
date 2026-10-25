import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDirectCheckout } from './directCheckout.js';

const mainSource = await readFile(new URL('./main.jsx', import.meta.url), 'utf8');

test('finalização cria link direto do WhatsApp com os itens e total', () => {
  const checkout = createDirectCheckout([
    { id: 7, name: 'Brownie', price: 8.5, quantity: 2 },
    { id: 9, name: 'Morango do amor', price: 12, quantity: 1 }
  ], 29);

  const url = new URL(checkout.url);
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/5547984572173');
  assert.match(url.searchParams.get('text'), /2x Brownie/);
  assert.match(url.searchParams.get('text'), /1x Morango do amor/);
  assert.match(url.searchParams.get('text'), /R\$\s*29,00/);
});

test('site não oferece login de cliente e finaliza direto pelo WhatsApp', () => {
  assert.doesNotMatch(mainSource, /Continuar com Google|Faça login para finalizar|Trocar conta/);
  assert.match(mainSource, /createDirectCheckout\(cartItems, cartTotal\)/);
});
