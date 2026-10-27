// @dune-suite integration
import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameView } from '../game/engine';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
async function request(path: string, cookie?: string, body?: unknown, selected?: string) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(selected ? { 'X-Dune-Seat': selected } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    data: await response.json() as GameView & { error?: string },
  };
}

void test('public deals use authenticated seats, persist for observers, and preserve normal gameplay', async () => {
  const host = await request('/api/rooms', undefined, {
    name: 'Deal host', faction: 'atreides', advanced: false, expansions: [],
  });
  assert.equal(host.status, 201); assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const guest = await request(path, undefined, { type: 'join', name: 'Deal recipient', faction: 'harkonnen' });
  assert.equal(guest.status, 200); assert.ok(guest.cookie);
  const observer = await request(path, undefined, { type: 'join', name: 'Deal observer', faction: 'emperor' });
  assert.equal(observer.status, 200); assert.ok(observer.cookie);
  const seats = [
    { id: host.data.me, cookie: host.cookie },
    { id: guest.data.me, cookie: guest.cookie },
    { id: observer.data.me, cookie: observer.cookie },
  ];
  let view = observer.data;
  const act = async (cookie: string, action: object) => {
    const next = await request(path, cookie, { version: view.version, action });
    assert.equal(next.status, 200, JSON.stringify(next.data));
    view = next.data;
  };
  for (const seat of seats) await act(seat.cookie, { type: 'ready' });
  await act(host.cookie, { type: 'start' });
  for (const seat of seats) {
    const own = await request(path, seat.cookie);
    assert.equal(own.status, 200);
    view = own.data;
    const choices = own.data.players.find(player => player.id === seat.id)?.traitorChoices;
    if (choices?.length) await act(seat.cookie, { type: 'traitor', leader: choices[0] });
  }
  assert.equal(view.status, 'playing');
  assert.equal(view.phase, 0);
  const baseline = {
    phase: view.phase, turn: view.turn, active: view.active, storm: view.storm,
    stormDialers: view.stormDialers, stormSubmitted: view.stormSubmitted,
    players: view.players.map(({ id, faction, ready }) => ({ id, faction, ready })),
  };

  await act(host.cookie, { type: 'dealOffer', target: guest.data.me, terms: 'I will not attack your forces this turn.' });
  const offer = view.deals.at(-1);
  assert.ok(offer);
  assert.equal(offer.status, 'offered');
  assert.equal(offer.from, host.data.me);
  assert.equal(offer.to, guest.data.me);
  for (const seat of seats) {
    const read = await request(path, seat.cookie);
    assert.equal(read.status, 200);
    assert.deepEqual(read.data.deals.find(deal => deal.id === offer.id), offer);
  }

  // The selected seat header is not a credential, and an authenticated
  // bystander cannot answer on the recipient's behalf.
  const accept = { version: view.version, action: { type: 'dealRespond', deal: offer.id, accept: true } };
  assert.equal((await request(path, host.cookie, accept, guest.data.me)).status, 409);
  assert.equal((await request(path, observer.cookie, accept)).status, 409);
  const unchanged = await request(path, guest.cookie);
  assert.equal(unchanged.status, 200);
  assert.equal(unchanged.data.version, view.version);
  assert.equal(unchanged.data.deals.find(deal => deal.id === offer.id)?.status, 'offered');
  await act(guest.cookie, accept.action);
  assert.equal(view.deals.find(deal => deal.id === offer.id)?.status, 'active');
  await act(host.cookie, { type: 'dealRelease', deal: offer.id, agree: true });
  assert.equal(view.deals.find(deal => deal.id === offer.id)?.status, 'active');
  await act(guest.cookie, { type: 'dealRelease', deal: offer.id, agree: true });
  assert.equal(view.deals.find(deal => deal.id === offer.id)?.status, 'released');
  const restored = await request(path, observer.cookie);
  assert.equal(restored.status, 200);
  assert.equal(restored.data.deals.find(deal => deal.id === offer.id)?.status, 'released');
  assert.deepEqual({
    phase: restored.data.phase, turn: restored.data.turn, active: restored.data.active, storm: restored.data.storm,
    stormDialers: restored.data.stormDialers, stormSubmitted: restored.data.stormSubmitted,
    players: restored.data.players.map(({ id, faction, ready }) => ({ id, faction, ready })),
  }, baseline);

  // A native storm dial still succeeds after the agreement lifecycle.
  const dialer = seats.find(seat => restored.data.stormDialers.includes(seat.id));
  assert.ok(dialer);
  view = restored.data;
  await act(dialer.cookie, { type: 'stormDial', amount: 0 });
  assert.ok(view.stormSubmitted.includes(dialer.id) || view.phase !== 0);
});
