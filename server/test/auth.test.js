import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../src/app.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const origin = 'http://127.0.0.1:5173';
const issuer = 'https://phase-two-test.clerk.accounts.dev';
const publishableKey = `pk_test_${Buffer.from('phase-two-test.clerk.accounts.dev$').toString('base64')}`;
function token(overrides = {}, signingKey = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: issuer, sub: 'user_verified', sid: 'sess_test', azp: origin, iat: now, nbf: now - 10, exp: now + 300, ...overrides })).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${sign('RSA-SHA256', Buffer.from(body), signingKey).toString('base64url')}`;
}
async function request(t, { authorization, configured = true, suffix = '' } = {}) {
  const app = createApp({ configured, clerkOptions: { secretKey: "sk_test_not_a_real_key_for_offline_tests", publishableKey, jwtKey: publicKey.export({ type: 'spki', format: 'pem' }), authorizedParties: [origin] } });
  const server = await new Promise(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return fetch(`http://127.0.0.1:${server.address().port}/api/auth/me${suffix}`, { headers: { Accept: 'application/json', ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) }, redirect: 'manual' });
}
test('missing configuration denies access with 503', async t => { assert.equal((await request(t, { configured: false })).status, 503); });
test('signed-out request receives JSON 401', async t => { const r = await request(t); assert.equal(r.status, 401); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.deepEqual(await r.json(), { message: 'Please sign in to continue.' }); });
test('Clerk verifies a signed token and ignores a caller-supplied user ID', async t => { const r = await request(t, { authorization: token(), suffix: '?userId=attacker' }); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { userId: 'user_verified' }); });
for (const [name, value] of [ ['malformed', 'not-a-token'], ['expired', token({ exp: Math.floor(Date.now()/1000) - 60 })], ['wrong origin', token({ azp: 'https://untrusted.example' })], ['forged signature', token({}, generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey)] ]) {
  test(`${name} token is rejected`, async t => { const r = await request(t, { authorization: value }); assert.equal(r.status, 401); assert.deepEqual(await r.json(), { message: 'Please sign in to continue.' }); });
}

