import test from 'node:test';
import assert from 'node:assert/strict';
import { adminBody, adminCookie, adminFailure, adminResponse, adminToken } from '../lib/admin-http';
import { AdminError } from '../db/admin-access';

const endpoint = 'http://localhost:3000/api/admin/session';
const request = (body: string, headers: Record<string, string> = {}) => new Request(endpoint, {
  method: 'POST', body, headers: { origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers },
});
void test('administrator mutations require exact configured origin and bounded JSON', async () => {
  assert.deepEqual(await adminBody(request('{"action":"logout"}')), { action: 'logout' });
  for (const headers of [{ origin: '' }, { origin: 'https://foreign.invalid' }, { 'sec-fetch-site': 'cross-site' }] as Record<string, string>[]) {
    await assert.rejects(adminBody(request('{}', headers)), (e: unknown) => e instanceof AdminError && e.status === 403);
  }
  await assert.rejects(adminBody(request('{}', { 'content-type': 'text/plain' })), (e: unknown) => e instanceof AdminError && e.status === 415);
  await assert.rejects(adminBody(request(' '.repeat(2049))), (e: unknown) => e instanceof AdminError && e.status === 413);
  await assert.rejects(adminBody(request('[]')), (e: unknown) => e instanceof AdminError && e.status === 400);
  await assert.rejects(adminBody(request('bad')), SyntaxError);
  assert.deepEqual(await adminBody(request('{}', { origin: 'https://dune.procrastination.games' }), 'https://dune.procrastination.games'), {});
  await assert.rejects(adminBody(request('{}', { 'x-forwarded-host': 'foreign.invalid', origin: 'https://foreign.invalid' })), AdminError);
});
void test('administrator cookies isolate room credentials and secure the configured HTTPS origin', () => {
  const token = 'a'.repeat(64);
  assert.equal(adminToken(new Request(endpoint, { headers: { cookie: `dune_ABCDEFGH=room-secret; dune_admin_session=${token}` } })), token);
  assert.equal(adminToken(new Request(endpoint, { headers: { cookie: 'dune_ABCDEFGH=room-secret' } })), undefined);
  const value = adminCookie(new Request(endpoint), token, 'https://dune.procrastination.games');
  for (const part of ['Path=/api/admin', 'HttpOnly', 'SameSite=Strict', 'Max-Age=28800', '; Secure']) assert.ok(value.includes(part));
  assert.ok(adminCookie(new Request(endpoint), '', 'https://dune.procrastination.games').includes('Max-Age=0'));
  assert.ok(!adminCookie(new Request(endpoint), token).includes('; Secure'));
});
void test('administrator responses are not cacheable and failures redact internal details', async () => {
  assert.equal(adminResponse({}).headers.get('cache-control'), 'no-store');
  assert.equal(adminResponse({}).headers.get('vary'), 'Cookie');
  const response = adminFailure(new Error('SECRET_DATABASE_OR_CREDENTIAL'));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('SECRET_DATABASE_OR_CREDENTIAL'));
  assert.equal(adminFailure(new AdminError('Not permitted.', 403)).status, 403);
});
