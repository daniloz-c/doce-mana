import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './api.js';

test('resposta HTML e JSON inválido produzem erro claro', async () => {
  const original = globalThis.fetch;
  const log = console.error;
  console.error = () => {};
  try {
    globalThis.fetch = async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
    await assert.rejects(api.getAdminDashboard(), /resposta não JSON/);
    globalThis.fetch = async () => new Response('{', { headers: { 'content-type': 'application/json' } });
    await assert.rejects(api.getAdminDashboard(), /JSON inválido/);
    globalThis.fetch = async (url, options) => {
      assert.equal(options.credentials, 'include');
      assert.equal(options.headers.Authorization, undefined);
      return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } });
    };
    assert.equal((await api.login('test', 'test')).success, true);
  } finally { globalThis.fetch = original; console.error = log; }
});
