// Runs only against a disposable container and volume created by this command.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const image = process.argv[2];
if (!image) throw new Error('Usage: node tools/verify-container.mjs IMAGE');
const name = `dune-verify-${randomUUID()}`;
const volume = `${name}-data`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
let base;
async function ready() {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const result = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (result.ok) return;
    } catch { /* Startup includes all additive migrations. */ }
    await delay(1000);
  }
  throw new Error('Container did not become ready');
}
function start(publicOrigin = '') {
  docker('run', '-d', '--name', name, '--init', '--cap-drop=ALL',
    '--security-opt=no-new-privileges:true',
    '-p', '127.0.0.1::3000', '-v', `${volume}:/data`,
    '-e', `DUNE_PUBLIC_ORIGIN=${publicOrigin}`, image);
  base = `http://${docker('port', name, '3000/tcp')}`;
}
try {
  docker('volume', 'create', volume);
  start();
  await ready();
  const headers = { 'content-type': 'application/json', origin: base };
  const body = JSON.stringify({ name: 'Container verification', faction: 'atreides', advanced: false, expansions: [] });
  const create = await fetch(`${base}/api/rooms`, { method: 'POST', headers, body });
  assert.equal(create.status, 201, 'Mapped host/port must pass origin validation');
  const cookie = create.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const room = await create.json();
  const foreign = await fetch(`${base}/api/rooms`, {
    method: 'POST', headers: { ...headers, origin: 'http://foreign.invalid' }, body,
  });
  assert.equal(foreign.status, 403);
  async function restored() {
    const result = await fetch(`${base}/api/rooms/${room.code}`, { headers: { cookie } });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), room, 'Saved seat and room must survive replacement');
  }
  docker('restart', '--time', '60', name);
  await ready();
  await restored();
  docker('stop', '--time', '60', name);
  docker('rm', name);
  start();
  await ready();
  await restored();
  execFileSync('npm', ['run', 'test:integration'], {
    stdio: 'inherit', env: { ...process.env, DUNE_TEST_URL: base },
  });
  docker('stop', '--time', '60', name);
  docker('rm', name);
  const publicOrigin = 'https://dune.example.test';
  start(publicOrigin);
  await ready();
  await restored();
  const proxyCreate = await fetch(`${base}/api/rooms`, {
    method: 'POST', headers: { ...headers, origin: publicOrigin }, body,
  });
  assert.equal(proxyCreate.status, 201, 'HTTPS external origin must work over HTTP upstream');
  assert.ok(proxyCreate.headers.get('set-cookie')?.includes('; Secure'));
  const proxyCookie = proxyCreate.headers.get('set-cookie').split(';')[0];
  const proxyRoom = await proxyCreate.json();
  const join = await fetch(`${base}/api/rooms/${proxyRoom.code}`, {
    method: 'POST', headers: { ...headers, origin: publicOrigin },
    body: JSON.stringify({ type: 'join', name: 'Proxy peer', faction: 'emperor' }),
  });
  assert.equal(join.status, 200);
  assert.ok(join.headers.get('set-cookie')?.includes('; Secure'));
  const message = await fetch(`${base}/api/rooms/${proxyRoom.code}/messages`, {
    method: 'POST', headers: { ...headers, origin: publicOrigin, cookie: proxyCookie },
    body: JSON.stringify({ id: randomUUID(), recipientId: null, text: 'Proxy verification' }),
  });
  assert.equal(message.status, 200, 'Table discussion must work through HTTPS proxy');
  for (const path of ['/api/rooms', `/api/rooms/${proxyRoom.code}`, `/api/rooms/${proxyRoom.code}/control`, `/api/rooms/${proxyRoom.code}/messages`]) {
    const rejected = await fetch(base + path, {
      method: 'POST', headers: { ...headers, origin: 'https://foreign.invalid' }, body,
    });
    assert.equal(rejected.status, 403, path);
  }
  console.log('Container origin, restart, replacement, saved seat and HTTP integration checks passed.');
} catch (error) {
  try { console.error(docker('logs', name)); } catch { /* May not exist yet. */ }
  throw error;
} finally {
  // Names are unique to this invocation; never remove an existing application.
  try { docker('rm', '-f', name); } catch { /* Already removed or not created. */ }
  try { docker('volume', 'rm', volume); } catch { /* Failure remains visible. */ }
}
