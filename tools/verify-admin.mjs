// Explicit operator-run HTTP acceptance. Use a dedicated QA administrator key:
// this signs out ALL sessions for that account. Never use a human operator's key.
// Uses new QA rooms only; operator/owner QA keys also exercise room lifecycle.
import assert from 'node:assert/strict';
import { readFile, mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRoomLifecycle } from './admin-lifecycle-verification.mjs';
import { verifyRoomCreation } from './admin-creation-verification.mjs';
import { verifyLobbyConfiguration } from './admin-lobby-verification.mjs';
import { verifyParticipantAi } from './admin-seat-ai-verification.mjs';
import { verifyRoomArchive } from './admin-archive-verification.mjs';
import { verifyRoomClosure } from './admin-closure-verification.mjs';
import { verifyRoomRemoval } from './admin-removal-verification.mjs';

const options = {};
for (let n = 2; n < process.argv.length; n += 2) {
  const flag = process.argv[n];
  if (!['--url', '--key-file', '--out', '--qa-account'].includes(flag) || options[flag] || !process.argv[n + 1]) throw new Error('Use --url ORIGIN --key-file PRIVATE_QA_FILE --qa-account ACCOUNT_UUID --out NEW_PRIVATE_DIRECTORY');
  options[flag] = process.argv[n + 1];
}
const url = new URL(options['--url']);
if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Provide an HTTP(S) origin.');
if (!options['--key-file'] || !isAbsolute(options['--out'] ?? '')) throw new Error('Provide a key file and absolute output directory.');
if (!/^[0-9a-f-]{36}$/.test(options['--qa-account'] ?? '')) throw new Error('Identify the dedicated QA account with --qa-account; all its sessions will be revoked.');
const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const out = resolve(await realpath(dirname(options['--out'])), relative(dirname(options['--out']), options['--out']));
const fromRoot = relative(root, out);
if (!fromRoot || (fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot))) throw new Error('Store evidence outside the checkout.');
await mkdir(out, { mode: 0o700 });
const key = (await readFile(options['--key-file'], 'utf8')).trim();
const base = url.origin;
const report = { origin: base, startedAt: new Date().toISOString(), passed: false, checks: [], room: null };
let session1, session2, adminId;
async function request(path, body, cookie, origin = base, expectedAdminId = adminId) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json', origin }), ...(cookie ? { cookie } : {}),
      ...(expectedAdminId && (path === '/api/admin/rooms' && body !== undefined || /^\/api\/admin\/rooms\/[^/]+\/(control|lobby|removal|closure|archive|seat-ai)$/.test(path)) ? { 'X-Dune-Admin-Id': expectedAdminId } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  report.lastRequest = { path, status: response.status };
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = null; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0], rawCookie: response.headers.get('set-cookie'), cache: response.headers.get('cache-control') };
}
try {
  const denied = await request('/api/admin/rooms');
  assert.equal(denied.status, 401); assert.equal(denied.cache, 'no-store');
  const login = await request('/api/admin/session', { action: 'login', key });
  assert.equal(login.status, 200); assert.ok(login.cookie);
  session1 = login.cookie;
  assert.equal(login.data.admin.id, options['--qa-account'], 'Use the explicitly designated QA account.');
  adminId = login.data.admin.id;
  for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Path=/api/admin']) assert.ok(login.rawCookie.includes(attribute));
  if (url.protocol === 'https:') assert.ok(login.rawCookie.includes('; Secure'));
  assert.equal((await request('/api/admin/session', undefined, session1)).data.admin.id, login.data.admin.id);
  report.checks.push('Authenticated identity and cookie attributes; anonymous denial');
  const second = await request('/api/admin/session', { action: 'login', key });
  assert.equal(second.status, 200); session2 = second.cookie;
  const name = 'Administration QA ' + Date.now();
  const created = await request('/api/rooms', { name, faction: 'atreides', advanced: false, expansions: [] });
  assert.equal(created.status, 201); report.room = created.data.code;
  const path = '/api/rooms/' + report.room;
  const before = (await request(path, undefined, created.cookie)).data;
  const directory = await request('/api/admin/rooms?q=' + report.room, undefined, session1);
  assert.equal(directory.status, 200); assert.equal(directory.data.total, 1);
  const room = directory.data.rooms[0];
  assert.equal(room.code, report.room); assert.equal(room.players[0].name, name);
  assert.deepEqual(Object.keys(room.players[0]).sort(), ['control', 'faction', 'id', 'name']);
  for (const field of ['state', 'log', 'hand', 'traitors', 'prediction', 'sessionHash', 'token', 'spice']) assert.ok(!Object.hasOwn(room, field));
  assert.deepEqual((await request(path, undefined, created.cookie)).data, before);
  assert.equal((await request('/api/admin/rooms', undefined, created.cookie)).status, 401);
  report.checks.push('QA room search, strict public roster, host denial, unchanged saved game');
  assert.equal((await request('/api/admin/session', { action: 'logoutAll' }, session1, 'https://foreign.invalid')).status, 403);
  assert.equal((await request('/api/admin/session', undefined, session1)).status, 200);
  assert.equal((await request('/api/admin/session', { action: 'logout' }, session1)).status, 200);
  assert.equal((await request('/api/admin/rooms', undefined, session1)).status, 401);
  assert.equal((await request('/api/admin/session', undefined, session2)).status, 200);
  const third = await request('/api/admin/session', { action: 'login', key });
  assert.equal(third.status, 200); session1 = third.cookie;
  assert.equal((await request('/api/admin/session', { action: 'logoutAll' }, session2)).status, 200);
  for (const cookie of [session1, session2]) assert.equal((await request('/api/admin/rooms', undefined, cookie)).status, 401);
  assert.deepEqual((await request(path, undefined, created.cookie)).data, before);
  report.checks.push('Foreign-origin denial; individual and all-session revocation; saved-seat continuity');
  if (['owner', 'operator'].includes(login.data.admin.role)) {
    const lifecycleSession = await request('/api/admin/session', { action: 'login', key });
    assert.equal(lifecycleSession.status, 200);
    session1 = lifecycleSession.cookie;
    await verifyRoomLifecycle(request, session1, report);
    await verifyRoomCreation(request, session1, report);
    await verifyLobbyConfiguration(request, session1, report);
    await verifyRoomRemoval(request, session1, report);
    await verifyRoomClosure(request, session1, report);
    await verifyRoomArchive(request, session1, report);
    await verifyParticipantAi(request, session1, report);
  }
  report.passed = true;
} catch (error) {
  // Do not serialize assertion payloads: failed authentication responses might contain credentials.
  report.failure = 'Administrator HTTP verification failed. Investigate the last completed check.';
  report.failureRequest ??= report.lastRequest;
  report.failureLocation = error instanceof Error ? error.stack?.split('\n').find(line => line.trim().startsWith('at ') && line.includes('verify-admin.mjs'))?.trim() : undefined;
  process.exitCode = 1;
} finally {
  for (const cookie of [session1, session2].filter(Boolean)) {
    try { await request('/api/admin/session', { action: 'logout' }, cookie); } catch { /* Report may already be incomplete; absolute expiry still applies. */ }
  }
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ passed: report.passed, completedChecks: report.checks.length, evidence: out }));
}
