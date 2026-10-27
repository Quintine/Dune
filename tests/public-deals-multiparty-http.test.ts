// @dune-suite integration
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import type { GameView } from '../game/engine';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
const entry = () => ({ operationId: randomUUID(), sessionToken: randomBytes(32).toString('hex') });
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
  return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0],
    data: await response.json() as GameView & { error?: string } };
}

void test('three-party deals require each authenticated faction seat and leave native play intact', async () => {
  const host = await request('/api/rooms', undefined, {
    name: 'Many-deal first', faction: 'atreides', advanced: false, expansions: [], entry: entry(),
  });
  assert.equal(host.status, 201, JSON.stringify(host.data));
  assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const enabled = await request(path, host.cookie, { version: host.data.version, action: { type: 'twoPlayerMode', enabled: true } }, host.data.me);
  assert.equal(enabled.status, 200, JSON.stringify(enabled.data));
  const hostSecond = await request(path, host.cookie, { type: 'addControlledFaction', version: enabled.data.version,
    name: 'Many-deal first', faction: 'emperor', entry: entry() }, host.data.me);
  assert.equal(hostSecond.status, 200, JSON.stringify(hostSecond.data));
  assert.ok(hostSecond.cookie);
  const hostCookies = `${host.cookie}; ${hostSecond.cookie}`;
  const guest = await request(path, undefined, { type: 'join', name: 'Many-deal second', faction: 'guild', entry: entry() });
  assert.equal(guest.status, 200, JSON.stringify(guest.data));
  assert.ok(guest.cookie);
  const guestSecond = await request(path, guest.cookie, { type: 'addControlledFaction', version: guest.data.version,
    name: 'Many-deal second', faction: 'harkonnen', entry: entry() }, guest.data.me);
  assert.equal(guestSecond.status, 200, JSON.stringify(guestSecond.data));
  assert.ok(guestSecond.cookie);
  const guestCookies = `${guest.cookie}; ${guestSecond.cookie}`;
  const seats = [
    { id: host.data.me, cookie: hostCookies }, { id: hostSecond.data.me, cookie: hostCookies },
    { id: guest.data.me, cookie: guestCookies }, { id: guestSecond.data.me, cookie: guestCookies },
  ];
  let view = guestSecond.data;
  const act = async (seat: typeof seats[number], action: object) => {
    const next = await request(path, seat.cookie, { version: view.version, action }, seat.id);
    assert.equal(next.status, 200, JSON.stringify(next.data));
    view = next.data;
  };
  for (const seat of seats) await act(seat, { type: 'ready' });
  await act(seats[0], { type: 'start' });
  for (const seat of seats) {
    const own = await request(path, seat.cookie, undefined, seat.id);
    assert.equal(own.status, 200, JSON.stringify(own.data));
    view = own.data;
    const choices = own.data.players.find(player => player.id === seat.id)?.traitorChoices;
    if (choices?.length) await act(seat, { type: 'traitor', leader: choices[0] });
  }
  assert.equal(view.status, 'playing');
  assert.equal(view.phase, 0);
  const baseline = { phase: view.phase, turn: view.turn, active: view.active, storm: view.storm,
    stormDialers: view.stormDialers, stormSubmitted: view.stormSubmitted,
    players: view.players.map(({ id, faction, ready }) => ({ id, faction, ready })),
    controllers: view.twoPlayerControllers };

  await act(seats[0], { type: 'dealOffer', targets: [seats[1].id, seats[2].id], terms: 'The three factions will share information.' });
  const offer = view.deals.at(-1);
  assert.ok(offer);
  assert.deepEqual(offer.participants, [seats[0].id, seats[1].id, seats[2].id]);
  assert.deepEqual(offer.acceptVotes, [seats[0].id]);
  assert.equal(offer.status, 'offered');
  for (const seat of seats) {
    const read = await request(path, seat.cookie, undefined, seat.id);
    assert.equal(read.status, 200, JSON.stringify(read.data));
    assert.deepEqual(read.data.deals.find(deal => deal.id === offer.id), offer);
  }

  const yes = { version: view.version, action: { type: 'dealRespond', deal: offer.id, accept: true } };
  // Another controller's seat selector is not a credential. The fourth seat
  // is authenticated but is not one of this agreement's participants.
  assert.equal((await request(path, hostCookies, yes, seats[2].id)).status, 409);
  assert.equal((await request(path, guestCookies, yes, seats[3].id)).status, 409);
  // The same controller's second faction still needs its own seat credential.
  assert.equal((await request(path, host.cookie, yes, seats[1].id)).status, 409);
  await act(seats[1], yes.action);
  assert.equal(view.deals.at(-1)?.status, 'offered');
  assert.deepEqual([...view.deals.at(-1)!.acceptVotes!].sort(), [seats[0].id, seats[1].id].sort());
  await act(seats[2], yes.action);
  assert.equal(view.deals.at(-1)?.status, 'active');

  await act(seats[2], { type: 'dealRelease', deal: offer.id, agree: true });
  await act(seats[1], { type: 'dealRelease', deal: offer.id, agree: true });
  assert.equal(view.deals.at(-1)?.status, 'active');
  await act(seats[0], { type: 'dealRelease', deal: offer.id, agree: true });
  assert.equal(view.deals.at(-1)?.status, 'released');
  const observer = await request(path, seats[3].cookie, undefined, seats[3].id);
  assert.equal(observer.status, 200, JSON.stringify(observer.data));
  assert.equal(observer.data.deals.find(deal => deal.id === offer.id)?.status, 'released');
  assert.deepEqual({ phase: observer.data.phase, turn: observer.data.turn, active: observer.data.active,
    storm: observer.data.storm, stormDialers: observer.data.stormDialers, stormSubmitted: observer.data.stormSubmitted,
    players: observer.data.players.map(({ id, faction, ready }) => ({ id, faction, ready })),
    controllers: observer.data.twoPlayerControllers }, baseline);
  const dialer = seats.find(seat => observer.data.stormDialers.includes(seat.id));
  assert.ok(dialer);
  view = observer.data;
  await act(dialer, { type: 'stormDial', amount: 0 });
  assert.ok(view.stormSubmitted.includes(dialer.id) || view.phase !== 0);
});
