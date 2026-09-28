import assert from 'node:assert/strict';
import test from 'node:test';
import { unitStore } from './fixture-nexus-room-store';
import { viewGame, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { wonEmperorNexusBankAuction } from './fixture-nexus-emperor-purchase';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
const rows = (store: ReturnType<typeof unitStore>) =>
  store.sqlite.prepare('SELECT state,version FROM rooms ORDER BY code').all();

async function fixture(t: test.TestContext, advanced: boolean) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Emperor purchase recovery', 'fremen', advanced, []);
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['atreides', 'harkonnen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const ids = auths.map(auth => auth.playerId) as [string, string, string];
  const g = wonEmperorNexusBankAuction(advanced, ids);
  g.code = code;
  g.version = (await store.rooms.readRoom(code)).version;
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(g), g.version, code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids, g };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
async function restored(f: Fixture, expected: Game) {
  const before = rows(f);
  for (const [i, token] of f.tokens.entries()) {
    const rooms = f.restart();
    const auth = await rooms.authenticate(f.code, token);
    const view = await rooms.readSeatView(f.code, auth);
    assert.deepEqual(view, viewGame(expected, f.ids[i]));
    assert.equal('nexusEmperorPurchaseHistory' in view, false);
    assert.equal('nexusEmperorPurchaseEvents' in view, false);
    if (i !== 1) assert.equal(view.nexusEmperorSecretAlly, null);
    for (const rival of view.players.filter(player => player.id !== f.ids[i])) {
      assert.equal('hand' in rival, false);
      assert.equal('spice' in rival, false);
    }
  }
  await f.restart().continueRoomAutomatic(f.code, clock);
  assert.deepEqual(rows(f), before);
}

void test('personally funded purchase survives SQLite restart without losing card or charging bid; stale replay does not commit', async t => {
  for (const advanced of [false, true]) {
    const f = await fixture(t, advanced);
    await restored(f, f.g);
    const initial = rows(f);
    const seats = f.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all();
    const offer = viewGame(f.g, f.ids[1]).nexusEmperorSecretAlly!;
    const action = { type: 'nexusEmperorPurchase', event: offer.event };
    for (const [i, malformed] of [[0, action], [1, { ...action, event: 'stale' }], [1, { ...action, price: 0 }]] as const)
      await assert.rejects(f.restart().act(f.code, f.auths[i], f.g.version, malformed, clock));
    assert.deepEqual(rows(f), initial);
    const lot = f.g.auction!.cards[f.g.auction!.index].id;
    await f.restart().act(f.code, f.auths[1], f.g.version, action, clock);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, f.g.version + 1);
    assert.equal(done.players[1].spice, f.g.players[1].spice);
    assert.equal(done.players[1].hand.filter(card => card.id === lot).length, 1);
    assert.equal(done.nexusEmperorPurchaseHistory?.length, 1);
    assert.deepEqual(done.nexusEmperorPurchaseEvents, [offer.event]);
    assert.equal(done.nexusCards!.cards!.hands[f.ids[1]], null);
    assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
    await restored(f, done);
    const saved = rows(f);
    await assert.rejects(f.restart().act(f.code, f.auths[1], f.g.version, action, clock), /table changed/);
    await assert.rejects(f.restart().act(f.code, f.auths[1], done.version, action, clock));
    assert.deepEqual(rows(f), saved);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(), seats);
    assert.deepEqual(f.writes.map(write => write.changes), [1]);
  }
});

void test('racing Emperor purchase and ordinary auction payment preserve one winner and one physical lot', async t => {
  const f = await fixture(t, true);
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
  const timer = setTimeout(release, 2000);
  const event = viewGame(f.g, f.ids[1]).nexusEmperorSecretAlly!.event;
  let outcomes: PromiseSettledResult<unknown>[];
  try {
    outcomes = await Promise.allSettled([
      f.restart().act(f.code, f.auths[1], f.g.version, { type: 'nexusEmperorPurchase', event }, clock),
      f.restart().act(f.code, f.auths[1], f.g.version, { type: 'decision', karama: false }, clock),
    ]);
  } finally {
    clearTimeout(timer);
    delete f.hooks.beforeWrite;
  }
  assert.equal(arrivals, 2);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  const done = await f.restart().readRoom(f.code);
  const lot = f.g.auction!.cards[f.g.auction!.index].id;
  assert.equal(done.version, f.g.version + 1);
  assert.equal(done.players[1].hand.filter(card => card.id === lot).length, 1);
  assert.equal(done.nexusEmperorPurchaseHistory?.length ?? 0, done.players[1].spice === f.g.players[1].spice ? 1 : 0);
  assert.deepEqual(f.writes.map(write => write.changes).sort((a, b) => a - b), [0, 1]);
  await restored(f, done);
});
