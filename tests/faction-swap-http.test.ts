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
  players: { id: string; faction: string; ready: boolean }[];
  factionSwap?: { event: string; from: string; to: string; fromFaction: string; toFaction: string } | null;
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

void test('faction swaps require the recipient seat credential and preserve controlled seat ownership', async () => {
  const host = await request('/api/rooms', { name: 'Swap host', faction: 'atreides', advanced: false, expansions: [], entry: receipt() });
  assert.equal(host.status, 201, JSON.stringify(host.data));
  assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const enabled = await request(path, { version: host.data.version, action: { type: 'twoPlayerMode', enabled: true } }, host.cookie, host.data.me);
  assert.equal(enabled.status, 200, JSON.stringify(enabled.data));
  const hostSecond = await request(path, { type: 'addControlledFaction', version: enabled.data.version, name: 'Host second', faction: 'harkonnen', entry: receipt() }, host.cookie, host.data.me);
  assert.equal(hostSecond.status, 200, JSON.stringify(hostSecond.data));
  assert.ok(hostSecond.cookie);
  const hostCookies = `${host.cookie}; ${hostSecond.cookie}`;
  const guest = await request(path, { type: 'join', name: 'Other person', faction: 'emperor', entry: receipt() });
  assert.equal(guest.status, 200, JSON.stringify(guest.data));
  assert.ok(guest.cookie);
  const guestSecond = await request(path, { type: 'addControlledFaction', version: guest.data.version, name: 'Other second', faction: 'fremen', entry: receipt() }, guest.cookie, guest.data.me);
  assert.equal(guestSecond.status, 200, JSON.stringify(guestSecond.data));
  assert.ok(guestSecond.cookie);
  const guestCookies = `${guest.cookie}; ${guestSecond.cookie}`;
  const seats = [
    { id: host.data.me, cookies: hostCookies }, { id: hostSecond.data.me, cookies: hostCookies },
    { id: guest.data.me, cookies: guestCookies }, { id: guestSecond.data.me, cookies: guestCookies },
  ];
  let latest = guestSecond.data;
  for (const seat of seats) {
    const ready = await request(path, { version: latest.version, action: { type: 'ready' } }, seat.cookies, seat.id);
    assert.equal(ready.status, 200, JSON.stringify(ready.data));
    latest = ready.data;
  }
  assert.ok(latest.players.every(player => player.ready));
  const initial = latest.players.map(({ id, faction, ready }) => ({ id, faction, ready }));
  const offered = await request(path, { version: latest.version, action: { type: 'factionSwapOffer', target: guest.data.me } }, hostCookies, host.data.me);
  assert.equal(offered.status, 200, JSON.stringify(offered.data));
  assert.ok(offered.data.factionSwap);
  const offer = offered.data.factionSwap;
  assert.deepEqual({ ...offer, event: '<event>' }, {
    event: '<event>', from: host.data.me, to: guest.data.me, fromFaction: 'atreides', toFaction: 'emperor',
  });
  assert.deepEqual(offered.data.players.map(({ id, faction, ready }) => ({ id, faction, ready })), initial);

  // A seat selector is not a credential; neither a forged selector nor another
  // authenticated seat is allowed to accept the recipient's offer.
  const response = { version: offered.data.version, action: { type: 'factionSwapRespond', event: offer.event, accept: true } };
  const forged = await request(path, response, hostCookies, guest.data.me);
  assert.equal(forged.status, 409, JSON.stringify(forged.data));
  const wrongSeat = await request(path, response, guestCookies, guestSecond.data.me);
  assert.equal(wrongSeat.status, 409, JSON.stringify(wrongSeat.data));
  const stillOffered = await request(path, undefined, guestCookies, guest.data.me);
  assert.equal(stillOffered.status, 200, JSON.stringify(stillOffered.data));
  assert.equal(stillOffered.data.version, offered.data.version);
  assert.deepEqual(stillOffered.data.factionSwap, offer);
  const accepted = await request(path, response, guestCookies, guest.data.me);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
  assert.ok(!accepted.data.factionSwap);
  assert.deepEqual(accepted.data.players.map(player => player.id), initial.map(player => player.id));
  assert.equal(accepted.data.players.find(player => player.id === host.data.me)?.faction, 'emperor');
  assert.equal(accepted.data.players.find(player => player.id === guest.data.me)?.faction, 'atreides');
  assert.equal(accepted.data.players.find(player => player.id === hostSecond.data.me)?.faction, 'harkonnen');
  assert.equal(accepted.data.players.find(player => player.id === guestSecond.data.me)?.faction, 'fremen');
  assert.ok(accepted.data.players.every(player => !player.ready));
  for (const seat of seats) {
    const view = await request(path, undefined, seat.cookies, seat.id);
    assert.equal(view.status, 200, JSON.stringify(view.data));
    assert.equal(view.data.me, seat.id);
    assert.ok(view.data.controlledFactionSeats?.some(own => own.id === seat.id));
  }

  // A single controller still switches to the other independently authenticated
  // seat to respond; declining does not alter the assignments or readiness.
  latest = accepted.data;
  for (const seat of seats) {
    const ready = await request(path, { version: latest.version, action: { type: 'ready' } }, seat.cookies, seat.id);
    assert.equal(ready.status, 200, JSON.stringify(ready.data));
    latest = ready.data;
  }
  const beforeDecline = latest.players.map(({ id, faction, ready }) => ({ id, faction, ready }));
  const secondOffer = await request(path, { version: latest.version, action: { type: 'factionSwapOffer', target: hostSecond.data.me } }, hostCookies, host.data.me);
  assert.equal(secondOffer.status, 200, JSON.stringify(secondOffer.data));
  assert.ok(secondOffer.data.factionSwap);
  const decline = { version: secondOffer.data.version, action: { type: 'factionSwapRespond', event: secondOffer.data.factionSwap.event, accept: false } };
  const missingCredential = await request(path, decline, host.cookie, hostSecond.data.me);
  assert.equal(missingCredential.status, 409, JSON.stringify(missingCredential.data));
  const declined = await request(path, decline, hostCookies, hostSecond.data.me);
  assert.equal(declined.status, 200, JSON.stringify(declined.data));
  assert.ok(!declined.data.factionSwap);
  assert.deepEqual(declined.data.players.map(({ id, faction, ready }) => ({ id, faction, ready })), beforeDecline);
});
