const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
process.env.APP_ORIGIN = 'https://admin.example.test';
process.env.SUPABASE_URL = 'https://database.example.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-not-a-credential';
process.env.SUPABASE_ANON_KEY = 'test-only-anon-key';
const models = require('../src/models/supabase');
const admin = { id: 1, username: 'tester', token_version: 0, is_active: 1 };
models.Admin.findByUsername = async name => name === admin.username ? admin : null;
models.Admin.findById = async id => String(id) === '1' && admin.is_active ? admin : null;
models.Admin.verifyPassword = async (row, password) => password === 'test-password-only';
models.Admin.revoke = async () => { admin.token_version++; };
models.Product.getAll = async () => [];
models.Order.getAll = async () => [];
let server, base;
before(async () => {
  server = require('../src/app').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
const request = (path, options = {}) => fetch(base + path, options);
const mutate = (path, body, extra = {}) => request(path, { method: 'POST', headers: { origin: process.env.APP_ORIGIN, 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) });
const login = () => mutate('/api/admin/login', { username: 'tester', password: 'test-password-only' });
const signed = (payload = {}, options = {}) => jwt.sign({ version: admin.token_version, ...payload }, process.env.JWT_SECRET, { algorithm: 'HS256', subject: '1', issuer: 'doce-mana', audience: 'doce-mana-admin', expiresIn: '8h', ...options });
const dashboard = token => request('/api/admin/dashboard', { headers: { cookie: `__Host-doce_admin=${token}` } });
test('cookie seguro, sessão, logout persistente e replay rejeitado', async () => {
  const response = await login();
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(cookie.includes(flag));
  assert.ok(!cookie.includes('Domain='));
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal((await dashboard(token)).status, 200);
  const logout = await mutate('/api/admin/logout', {}, { cookie: cookie.split(';')[0] });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await dashboard(token)).status, 401);
});
test('JWT inválido, expirado, forjado, algoritmo e claims incorretos', async () => {
  const invalid = [
    'invalid', signed({}, { expiresIn: -1 }),
    jwt.sign({ version: admin.token_version }, 'different-secret', { subject: '1' }),
    signed({}, { algorithm: 'HS384' }), signed({}, { issuer: 'other' }),
    signed({}, { audience: 'other' }), signed({ version: -1 }),
    jwt.sign({ sub: '1', version: admin.token_version, iss: 'doce-mana', aud: 'doce-mana-admin' }, process.env.JWT_SECRET)
  ];
  for (const token of invalid) assert.equal((await dashboard(token)).status, 401);
  assert.equal((await request('/api/admin/dashboard', { headers: { authorization: `Bearer ${signed()}` } })).status, 401);
});
test('CSRF bloqueia login, logout e mutações sem origem ou cross-origin', async () => {
  for (const path of ['/api/admin/login', '/api/admin/logout', '/api/admin/products', '/api/products']) {
    assert.equal((await request(path, { method: 'POST' })).status, 403);
    assert.equal((await mutate(path, {}, { origin: 'https://evil.example.test' })).status, 403);
    assert.equal((await mutate(path, {}, { 'sec-fetch-site': 'cross-site' })).status, 403);
  }
  assert.equal((await mutate('/api/products', {})).status, 401);
});
test('credenciais e indisponibilidade do banco falham sem expor internos', async () => {
  assert.equal((await mutate('/api/admin/login', { username: 'tester', password: 'wrong' })).status, 401);
  const original = models.Admin.findById;
  models.Admin.findById = async () => { throw new Error('secret-internal'); };
  const response = await dashboard(signed());
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('secret-internal'));
  models.Admin.findById = original;
});
test('API 404 JSON, health, JSON inválido e SPA', async () => {
  assert.equal((await request('/api/health')).status, 200);
  const missing = await request('/api/not-found');
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).success, false);
  const malformed = await request('/api/admin/login', { method: 'POST', headers: { origin: process.env.APP_ORIGIN, 'content-type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  for (const path of ['/', '/admin', '/admin/products']) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
  }
});
test('configuração ausente retorna JSON útil', async () => {
  const secret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  const response = await request('/api/health');
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /JWT_SECRET/);
  process.env.JWT_SECRET = secret;
});
test('Vercel encaminha API antes de SPA e entrypoint não inicia listener', () => {
  const config = require('../../vercel.json');
  assert.equal(config.rewrites[0].source, '/api');
  assert.equal(config.rewrites[1].source, '/api/:path*');
  assert.equal(config.rewrites[1].destination, '/api/index');
  assert.equal(require('../../api/index'), require('../src/app'));
});
