const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';
process.env.APP_ORIGIN = 'https://admin.example.test';
process.env.SUPABASE_URL = 'https://database.example.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-not-a-credential';
process.env.SUPABASE_ANON_KEY = 'anon-test-key';

const models = require('../src/models/supabase');
const admin = { id: 1, username: 'tester', token_version: 0, is_active: 1 };
models.Admin.findByUsername = async name => name === admin.username ? admin : null;
models.Admin.findById = async id => String(id) === '1' && admin.is_active ? admin : null;
models.Admin.verifyPassword = async (row, password) => password === 'test-password-only';
models.Admin.revoke = async () => { admin.token_version++; };
models.Product.getAll = async () => [];
models.Order.getAll = async () => [];

let mockUploadedFile = null;
const mockStorage = {
  from(bucket) {
    return {
      upload: async (path, buffer, opts) => {
        mockUploadedFile = { bucket, path, buffer, opts };
        return { data: { path }, error: null };
      },
      getPublicUrl: (path) => ({ data: { publicUrl: `https://database.example.test/storage/v1/object/public/${bucket}/${path}` } })
    };
  }
};

let mockUser = {
  id: 'customer-uuid-123',
  email: 'customer@example.com',
  app_metadata: { provider: 'google' },
  identities: [{ provider: 'google' }],
  user_metadata: { full_name: 'Cliente Google' }
};

const mockAuth = {
  signInWithOAuth: async ({ provider, options }) => {
    options.redirectTo;
    return { data: { url: 'https://database.example.test/auth/v1/authorize?provider=google' }, error: null };
  },
  exchangeCodeForSession: async (code) => {
    if (code === 'valid-code') {
      return { data: { session: { access_token: 'google-access-token', expires_in: 3600 } }, error: null };
    }
    return { data: {}, error: new Error('Invalid code') };
  },
  getUser: async (token) => {
    if (token === 'google-access-token') {
      return { data: { user: mockUser }, error: null };
    }
    return { data: { user: null }, error: new Error('Invalid token') };
  },
  admin: {
    signOut: async () => ({ error: null })
  }
};

models.getClient = () => ({
  storage: mockStorage,
  auth: mockAuth,
  from: models.table || (() => ({}))
});

const sdkPath = require.resolve('@supabase/supabase-js');
const sdk = require(sdkPath);
require.cache[sdkPath].exports = { ...sdk, createClient: (url, key, config) => ({ auth: {
  ...mockAuth,
  signInWithOAuth: async input => {
    config.auth.storage.setItem('customer-auth-code-verifier', 'test-verifier');
    return mockAuth.signInWithOAuth(input);
  },
  exchangeCodeForSession: async code => {
    assert.equal(config.auth.storage.getItem('customer-auth-code-verifier'), 'test-verifier');
    return mockAuth.exchangeCodeForSession(code);
  }
} }) };

let server, base;
before(async () => {
  server = require('../src/app').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

const adminCookie = () => {
  const token = jwt.sign({ version: admin.token_version }, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: '1', issuer: 'doce-mana', audience: 'doce-mana-admin', expiresIn: '8h'
  });
  return `__Host-doce_admin=${token}`;
};

test('Upload de imagem protegido por CSRF e isAdmin', async () => {
  const resNoAuth = await fetch(`${base}/api/admin/upload`, { method: 'POST' });
  assert.equal(resNoAuth.status, 403);

  const resCsrf = await fetch(`${base}/api/admin/upload`, {
    method: 'POST',
    headers: { origin: 'https://malicious.example.test' }
  });
  assert.equal(resCsrf.status, 403);

  const resUnauthorized = await fetch(`${base}/api/admin/upload`, {
    method: 'POST',
    headers: { origin: process.env.APP_ORIGIN }
  });
  assert.equal(resUnauthorized.status, 401);
});

test('Upload rejeita arquivos sem assinatura real de imagem (rejeita SVG e fake mime)', async () => {
  const boundary = '----WebKitFormBoundaryTest123';
  const bodySvg = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="malicious.svg"\r\nContent-Type: image/svg+xml\r\n\r\n<svg xmlns="http://www.w3.org/2000/svg"></svg>\r\n--${boundary}--\r\n`
  );

  const resSvg = await fetch(`${base}/api/admin/upload`, {
    method: 'POST',
    headers: {
      origin: process.env.APP_ORIGIN,
      cookie: adminCookie(),
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: bodySvg
  });
  assert.equal(resSvg.status, 400);
  const dataSvg = await resSvg.json();
  assert.match(dataSvg.message, /Formato inválido/);

  const fakeJpeg = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="fake.jpg"\r\nContent-Type: image/jpeg\r\n\r\nNOT_A_REAL_JPEG_MAGIC_BYTES\r\n--${boundary}--\r\n`
  );
  const resFake = await fetch(`${base}/api/admin/upload`, {
    method: 'POST',
    headers: {
      origin: process.env.APP_ORIGIN,
      cookie: adminCookie(),
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: fakeJpeg
  });
  assert.equal(resFake.status, 400);
});

test('Upload aceita JPEG/PNG/WebP válidos e persiste no storage', async () => {
  const boundary = '----WebKitFormBoundaryTest456';
  const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const bodyPng = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="valid.png"\r\nContent-Type: image/png\r\n\r\n`),
    validPngHeader,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const res = await fetch(`${base}/api/admin/upload`, {
    method: 'POST',
    headers: {
      origin: process.env.APP_ORIGIN,
      cookie: adminCookie(),
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: bodyPng
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.match(json.image_url, /https:\/\/database.example.test\/storage\/v1\/object\/public\/products\/products\//);
  assert.equal(mockUploadedFile.bucket, 'products');
});

test('Fluxo OAuth Google para cliente: login, callback com PKCE e sessão', async () => {
  const loginRes = await fetch(`${base}/api/customer/login`, {
    method: 'POST',
    headers: { origin: process.env.APP_ORIGIN }
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.match(loginData.url, /authorize\?provider=google/);
  const setCookie = loginRes.headers.get('set-cookie');
  assert.ok(setCookie.includes('__Host-doce_google_flow='));

  const cookies = loginRes.headers.getSetCookie().map(value => value.split(';')[0]);
  const stateToken = cookies.find(value => value.startsWith('__Host-doce_google_state=')).split('=')[1];
  const { state } = jwt.decode(stateToken);
  const callbackRes = await fetch(`${base}/api/customer/callback?code=valid-code&state=${state}`, {
    redirect: 'manual',
    headers: { cookie: cookies.join('; ') }
  });
  assert.equal(callbackRes.status, 302);
  assert.ok(callbackRes.headers.get('location').length > 0);

  const customerCookie = callbackRes.headers.get('set-cookie');
  assert.ok(customerCookie.includes('__Host-doce_customer='));
  const customerToken = customerCookie.split(';')[0].split('=')[1];

  const sessionRes = await fetch(`${base}/api/customer/session`, {
    headers: { cookie: `__Host-doce_customer=${customerToken}` }
  });
  assert.equal(sessionRes.status, 200);
  const sessionData = await sessionRes.json();
  assert.equal(sessionData.customer.id, 'customer-uuid-123');
  assert.equal(sessionData.customer.name, 'Cliente Google');
  assert.equal(sessionData.customer.email, 'customer@example.com');

  const adminAttemptRes = await fetch(`${base}/api/admin/dashboard`, {
    headers: { cookie: `__Host-doce_admin=${customerToken}` }
  });
  assert.equal(adminAttemptRes.status, 401);
});

test('Criação de pedidos exige cliente autenticado via Google', async () => {
  const unauthRes = await fetch(`${base}/api/orders`, {
    method: 'POST',
    headers: {
      origin: process.env.APP_ORIGIN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      request_id: '8093128b-b830-4e3d-bbda-fb6fc9a32c45',
      customer_name: 'Cliente Sem Login',
      customer_phone: '47999999999',
      items: [{ product_id: 1, quantity: 1 }]
    })
  });
  assert.equal(unauthRes.status, 401);
  const data = await unauthRes.json();
  assert.match(data.message, /Entre com Google/);
});

test('Pedido usa identidade do servidor e rejeita sessão admin ou provider diferente', async () => {
  const original = models.Order.create;
  let received;
  models.Order.create = async payload => { received = payload; return { id: 1, total_amount: 10, items: [] }; };
  const send = cookie => fetch(`${base}/api/orders`, { method: 'POST', headers: { origin: process.env.APP_ORIGIN, cookie, 'content-type': 'application/json' }, body: JSON.stringify({ request_id: '8093128b-b830-4e3d-bbda-fb6fc9a32c45', customer_id: 'attacker', customer_email: 'forged@test.com', customer_name: 'Cliente', customer_phone: '47999999999', items: [{ product_id: 1, quantity: 1 }] }) });
  try {
    assert.equal((await send(adminCookie())).status, 401);
    assert.equal((await send('__Host-doce_customer=google-access-token')).status, 201);
    assert.equal(received.customer_id, mockUser.id);
    assert.equal(received.customer_email, mockUser.email);
    mockUser.app_metadata.provider = 'email';
    assert.equal((await send('__Host-doce_customer=google-access-token')).status, 401);
  } finally { models.Order.create = original; mockUser.app_metadata.provider = 'google'; }
});

test('Callback rejeita state adulterado mesmo com PKCE válido', async () => {
  const login = await fetch(`${base}/api/customer/login`, { method: 'POST', headers: { origin: process.env.APP_ORIGIN } });
  const cookies = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const response = await fetch(`${base}/api/customer/callback?code=valid-code&state=forged`, { redirect: 'manual', headers: { cookie: cookies } });
  assert.equal(response.headers.get('location'), '/?login=error');
  assert.ok(!response.headers.get('set-cookie').includes('__Host-doce_customer='));
});

test('Upload rejeita excesso de tamanho e MIME divergente', async () => {
  for (const file of [new Blob([new Uint8Array(4 * 1024 * 1024 + 1)], { type: 'image/png' }), new Blob([Buffer.from([0xff, 0xd8, 0xff])], { type: 'image/png' })]) {
    const body = new FormData();
    body.append('image', file, 'photo.png');
    const response = await fetch(`${base}/api/admin/upload`, { method: 'POST', headers: { origin: process.env.APP_ORIGIN, cookie: adminCookie() }, body });
    assert.equal(response.status, 400);
  }
});

test('Callback inválido ou adulterado redireciona com erro sem open-redirect', async () => {
  const badCallback = await fetch(`${base}/api/customer/callback?code=invalid-code`, {
    redirect: 'manual'
  });
  assert.equal(badCallback.status, 302);
  assert.equal(badCallback.headers.get('location'), '/?login=error');
});
