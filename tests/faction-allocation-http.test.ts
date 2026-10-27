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
  players: { id: string; faction: string; ready: boolean }[];
  factionDraft?: { event: string; order: { player: string; card: number }[]; picks: { player: string; faction: string }[] } | null;
  controlledFactionSeats?: { id: string; faction: string }[];
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
  return { status: response.status, data: await response.json() as Wire,
    cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

void test('two controllers draft with four independently authenticated faction seats', async () => {
  const host = await request('/api/rooms', { name: 'Draft host', faction: 'atreides', advanced: false, expansions: [], entry: receipt() });
  assert.equal(host.status, 201, JSON.stringify(host.data));
  assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const enabled = await request(path, { version: host.data.version, action: { type: 'twoPlayerMode', enabled: true } }, host.cookie, host.data.me);
  assert.equal(enabled.status, 200, JSON.stringify(enabled.data));
  const firstSecond = await request(path, { type: 'addControlledFaction', version: enabled.data.version, name: 'Host second', faction: 'harkonnen', entry: receipt() }, host.cookie, host.data.me);
  assert.equal(firstSecond.status, 200, JSON.stringify(firstSecond.data));
  assert.ok(firstSecond.cookie);
  const firstCookies = `${host.cookie}; ${firstSecond.cookie}`;
  const other = await request(path, { type: 'join', name: 'Other person', faction: 'emperor', entry: receipt() });
  assert.equal(other.status, 200, JSON.stringify(other.data));
  assert.ok(other.cookie);
  const otherSecond = await request(path, { type: 'addControlledFaction', version: other.data.version, name: 'Other second', faction: 'fremen', entry: receipt() }, other.cookie, other.data.me);
  assert.equal(otherSecond.status, 200, JSON.stringify(otherSecond.data));
  assert.ok(otherSecond.cookie);
  const otherCookies = `${other.cookie}; ${otherSecond.cookie}`;
  const seats = [
    { id: host.data.me, cookie: firstCookies },
    { id: firstSecond.data.me, cookie: firstCookies },
    { id: other.data.me, cookie: otherCookies },
    { id: otherSecond.data.me, cookie: otherCookies },
  ];
  const original = otherSecond.data.players.map(player => ({ id: player.id, faction: player.faction }));
  const opened = await request(path, { version: otherSecond.data.version, action: { type: 'factionAllocation', mode: 'draft' } }, firstCookies, host.data.me);
  assert.equal(opened.status, 200, JSON.stringify(opened.data));
  assert.ok(opened.data.factionDraft);
  assert.deepEqual(opened.data.players.map(player => ({ id: player.id, faction: player.faction })), original);
  const event = opened.data.factionDraft.event;
  const order = opened.data.factionDraft.order.map(item => item.player);
  assert.deepEqual(new Set(order), new Set(seats.map(seat => seat.id)));
  const deniedJoin = await request(path, { type: 'join', name: 'Late player', faction: 'guild', entry: receipt() });
  assert.equal(deniedJoin.status, 409, JSON.stringify(deniedJoin.data));
  assert.match(deniedJoin.data.error ?? '', /draft/i);
  assert.equal(deniedJoin.cookie, undefined);

  let latest = opened.data;
  const choices = ['guild', 'beneGesserit', 'fremen', 'emperor'];
  for (let index = 0; index < order.length; index++) {
    const seat = seats.find(candidate => candidate.id === order[index])!;
    // Switching is a selected-seat read using the matching HttpOnly credential.
    const selected = await request(path, undefined, seat.cookie, seat.id);
    assert.equal(selected.status, 200, JSON.stringify(selected.data));
    assert.equal(selected.data.me, seat.id);
    assert.equal(selected.data.version, latest.version);
    const pick = await request(path, { version: selected.data.version, action: {
      type: 'factionDraftPick', event, faction: choices[index],
    } }, seat.cookie, seat.id);
    assert.equal(pick.status, 200, JSON.stringify(pick.data));
    assert.equal(pick.data.me, seat.id);
    latest = pick.data;
    if (index < order.length - 1)
      assert.deepEqual(latest.players.map(player => ({ id: player.id, faction: player.faction })), original);
  }
  assert.ok(!latest.factionDraft);
  assert.deepEqual(latest.players.map(player => player.id), original.map(player => player.id));
  for (let index = 0; index < order.length; index++)
    assert.equal(latest.players.find(player => player.id === order[index])!.faction, choices[index]);
  for (const seat of seats) {
    const ready = await request(path, { version: latest.version, action: { type: 'ready' } }, seat.cookie, seat.id);
    assert.equal(ready.status, 200, JSON.stringify(ready.data));
    assert.equal(ready.data.me, seat.id);
    latest = ready.data;
  }
  assert.ok(latest.players.every(player => player.ready));
  const started = await request(path, { version: latest.version, action: { type: 'start' } }, firstCookies, host.data.me);
  assert.equal(started.status, 200, JSON.stringify(started.data));
  assert.ok(started.data.status === 'setup' || started.data.status === 'playing');
  assert.deepEqual(started.data.players.map(player => player.id), original.map(player => player.id));
  for (const seat of seats) {
    const view = await request(path, undefined, seat.cookie, seat.id);
    assert.equal(view.status, 200, JSON.stringify(view.data));
    assert.equal(view.data.me, seat.id);
    assert.ok(view.data.controlledFactionSeats?.some(own => own.id === seat.id));
  }
});
