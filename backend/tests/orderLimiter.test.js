const { test } = require('node:test');
const assert = require('node:assert/strict');
const createLimiter = require('../src/orderLimiter');
test('limite por endereço, Retry-After, expiração e capacidade limitada', () => {
  let time = 0;
  const limiter = createLimiter({ limit: 2, windowMs: 1000, maxKeys: 2, now: () => time });
  function request(ip) {
    const result = {};
    limiter({ ip, headers: { 'x-forwarded-for': Math.random().toString() } }, {
      set(key, value) { result[key] = value; },
      status(value) { result.status = value; return this; },
      json(value) { result.body = value; }
    }, () => { result.allowed = true; });
    return result;
  }
  assert.equal(request('a').allowed, true);
  assert.equal(request('a').allowed, true);
  assert.equal(request('a').status, 429);
  assert.equal(request('a')['Retry-After'], '1');
  assert.equal(request('b').allowed, true);
  assert.equal(request('c').status, 429);
  time = 1000;
  assert.equal(request('a').allowed, true);
  assert.equal(request('c').allowed, true);
});
