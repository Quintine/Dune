// @dune-suite integration
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
const receipt = () => ({ operationId: randomUUID(), sessionToken: randomBytes(32).toString('hex') });
type Wire = {
  code: string;
  me: string;
  version: number;
  status: string;
  players: { id: string; faction: string; bot?: string; ready: boolean; hand?: unknown[] }[];
  twoPlayerControllers?: { controllers: { id: string; seats: string[] }[] } | null;
  controlledFactionSeats?: { id: string }[];
  error?: string;
};
async function request(path: string, body?: unknown, cookie?: string, selected?: string) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(selected ? { 'X-Dune-Seat': selected } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: await response.json() as Wire,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

void test('two-faction AI opponent starts with separate human credentials and no bot impersonation', async () => {
  const host = await request('/api/rooms', {
    name: 'Two-player AI host', faction: 'atreides', advanced: false, expansions: [], entry: receipt(),
  });
  assert.equal(host.status, 201, JSON.stringify(host.data));
  assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const enabled = await request(path, {
    version: host.data.version, action: { type: 'twoPlayerMode', enabled: true },
  }, host.cookie, host.data.me);
  assert.equal(enabled.status, 200, JSON.stringify(enabled.data));
  const second = await request(path, {
    type: 'addControlledFaction', version: enabled.data.version,
    name: 'Human second', faction: 'harkonnen', entry: receipt(),
  }, host.cookie, host.data.me);
  assert.equal(second.status, 200, JSON.stringify(second.data));
  assert.ok(second.cookie);
  const cookies = `${host.cookie}; ${second.cookie}`;
  const primary = await request(path, {
    version: second.data.version, action: { type: 'addBot', faction: 'emperor', difficulty: 'Medium' },
  }, cookies, host.data.me);
  assert.equal(primary.status, 200, JSON.stringify(primary.data));
  const bot = primary.data.players.find(player => player.faction === 'emperor' && player.bot === 'Medium');
  assert.ok(bot);
  const paired = await request(path, {
    version: primary.data.version,
    action: { type: 'addControlledBot', controller: bot.id, faction: 'guild', difficulty: 'Medium' },
  }, cookies, host.data.me);
  assert.equal(paired.status, 200, JSON.stringify(paired.data));
  const botSecond = paired.data.players.find(player => player.faction === 'guild' && player.bot === 'Medium');
  assert.ok(botSecond);
  assert.deepEqual(paired.data.twoPlayerControllers?.controllers.map(controller => controller.seats), [
    [host.data.me, second.data.me], [bot.id, botSecond.id],
  ]);
  assert.deepEqual(paired.data.controlledFactionSeats?.map(seat => seat.id), [host.data.me, second.data.me]);
  for (const botId of [bot.id, botSecond.id]) {
    const deniedRead = await request(path, undefined, cookies, botId);
    assert.equal(deniedRead.status, 409);
    const deniedAction = await request(path, {
      version: paired.data.version, action: { type: 'ready' },
    }, cookies, botId);
    assert.equal(deniedAction.status, 409);
  }
  const firstReady = await request(path, {
    version: paired.data.version, action: { type: 'ready' },
  }, cookies, host.data.me);
  assert.equal(firstReady.status, 200, JSON.stringify(firstReady.data));
  const secondReady = await request(path, {
    version: firstReady.data.version, action: { type: 'ready' },
  }, cookies, second.data.me);
  assert.equal(secondReady.status, 200, JSON.stringify(secondReady.data));
  assert.ok(secondReady.data.players.every(player => player.ready));
  const started = await request(path, {
    version: secondReady.data.version, action: { type: 'start' },
  }, cookies, host.data.me);
  assert.equal(started.status, 200, JSON.stringify(started.data));
  assert.ok(started.data.status === 'setup' || started.data.status === 'playing');
  for (const player of started.data.players)
    assert.equal(Object.hasOwn(player, 'hand'), player.id === host.data.me);
});
