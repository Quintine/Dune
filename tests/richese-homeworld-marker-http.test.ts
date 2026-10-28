// @dune-suite integration
import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { richeseHomeworldMarkerChoice } from '../game/homeworld-shipment-options';
import type { Action, GameView } from '../game/engine';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
async function request(path: string, cookie?: string, body?: unknown) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(15_000),
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0],
    data: await response.json() as GameView & { error?: string } };
}

/** All state belongs to the new QA room. The existing bot adapter proposes
 * legal actions from each participant's own authenticated view; no server
 * state, physical tokens, phases, hands or balances are staged. */
void test('authenticated Richese ships a concealed marker to a Homeworld without revealing its identity', async () => {
  const host = await request('/api/rooms', undefined, {
    name: 'Homeworld marker owner', faction: 'richese', advanced: false, expansions: ['choam'],
  });
  assert.equal(host.status, 201, JSON.stringify(host.data)); assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const peer = await request(path, undefined, { type: 'join', name: 'Homeworld marker opponent', faction: 'atreides' });
  assert.equal(peer.status, 200, JSON.stringify(peer.data)); assert.ok(peer.cookie);
  const seats = [{ cookie: host.cookie, id: host.data.me }, { cookie: peer.cookie, id: peer.data.me }];
  let view = peer.data;
  const act = async (cookie: string, action: Action) => {
    const next = await request(path, cookie, { version: view.version, action });
    assert.equal(next.status, 200, `Rejected ${action.type}: ${JSON.stringify(next.data)}`);
    view = next.data; return next.data;
  };
  await act(host.cookie, { type: 'homeworlds', enabled: true });
  for (const seat of seats) await act(seat.cookie, { type: 'ready' });
  await act(host.cookie, { type: 'start' });

  async function read(cookie: string): Promise<GameView> {
    const result = await request(path, cookie);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    view = result.data; return result.data;
  }
  async function advance(until: (owner: GameView) => boolean) {
    for (let count = 0; count < 300; count++) {
      const owner = await read(host.cookie!);
      if (until(owner)) return owner;
      assert.notEqual(owner.status, 'finished', 'The QA game ended before its marker shipment.');
      let proposed: { cookie: string; action: Action } | null = null;
      for (const seat of seats) {
        const current = await read(seat.cookie!);
        const local = structuredClone(current);
        const self = local.players.find(player => player.id === seat.id); assert.ok(self);
        self.bot = 'Easy'; // Local action adapter only; the server seat remains human.
        const actions = botActions(local);
        if (actions.length) { proposed = { cookie: seat.cookie!, action: actions[0] }; break; }
      }
      assert.ok(proposed, `No native continuation at ${owner.status}/${owner.phase}/${owner.decision?.kind ?? 'no decision'}.`);
      // During response windows pass rather than spending a physical Karama.
      if (view.response && !view.response.passed.includes(view.me)) proposed.action = { type: 'passResponse' };
      await act(proposed.cookie, proposed.action);
    }
    throw Error('The dedicated HTTP room did not reach its finite native marker boundary.');
  }

  const before = await advance(owner => owner.status === 'playing' && owner.phase === 5 && owner.active === owner.me &&
    !!owner.homeworldShipment && !owner.homeworldShipment.blocked && !!owner.richeseNoField?.canShip);
  const info = before.richeseNoField!; assert.ok(info.private);
  const token = info.private.tokens.find(candidate => candidate.id !== info.private!.lastShipped); assert.ok(token);
  const tokens = info.private.tokens.map(candidate => candidate.id);
  const payer = before.players.find(candidate => candidate.id === before.me)!;
  const originalSpice = payer.spice, originalReserves = payer.reserves;
  const quote = richeseHomeworldMarkerChoice(before, 'homeworld:atreides', token.id);
  assert.ok(quote.action, quote.blocked ?? 'The original private shipment should be available.');
  await act(host.cookie, quote.action);
  const settled = await advance(owner => owner.status === 'playing' && owner.phase === 5 &&
    !!owner.richeseNoField?.private?.deployed && owner.players.find(player => player.id === owner.me)?.shipped === true);
  const after = settled.players.find(candidate => candidate.id === settled.me)!;
  assert.equal(after.spice, originalSpice! - 1);
  assert.equal(after.reserves, originalReserves);
  assert.deepEqual(settled.richeseNoField!.private!.deployed!.location, { homeworld: 'homeworld:atreides' });
  const peerView = await read(peer.cookie);
  assert.equal(peerView.richeseNoField!.private, null);
  assert.deepEqual(peerView.richeseNoField!.public.deployed!.location, { homeworld: 'homeworld:atreides' });
  for (const id of tokens) assert.equal(JSON.stringify(peerView).includes(id), false, 'A foreign seat cannot see token IDs.');
});
