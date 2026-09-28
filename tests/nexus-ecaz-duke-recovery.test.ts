import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { nexusEcazDukePosition } from './fixture-nexus-ecaz-duke';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
const rows = (store: ReturnType<typeof unitStore>) =>
  store.sqlite.prepare('SELECT state,version FROM rooms ORDER BY code').all();

async function fixture(t: test.TestContext, advanced: boolean) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const made = await store.rooms.createRoom('Ecaz Cunning recovery', 'ecaz', advanced, ['ecaz']);
  const code = made.view.code;
  const tokens = [made.token];
  for (const faction of ['moritani', 'fremen'] as const)
    tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
  const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
  const ids = auths.map(auth => auth.playerId) as [string, string, string];
  const { game, action } = nexusEcazDukePosition(advanced, ids);
  game.expansions = ['ecaz'];
  game.code = code;
  game.version = (await store.rooms.readRoom(code)).version;
  store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
    .run(JSON.stringify(game), game.version, code);
  store.writes.length = 0;
  return { ...store, code, tokens, auths, ids, game, action };
}

void test('Ecaz Cunning survives SQLite restart; rejected or concurrent replay cannot spend or duplicate Duke', async t => {
  for (const advanced of [false, true]) {
    const f = await fixture(t, advanced);
    const [owner, rival] = f.ids;
    for (const [i, token] of f.tokens.entries()) {
      const auth = await f.restart().authenticate(f.code, token);
      const view = await f.restart().readSeatView(f.code, auth);
      assert.deepEqual(view, viewGame(f.game, f.ids[i]));
      if (i) assert.equal(view.nexusEcazDuke, null);
      assert.equal('nexusEcazDukeHistory' in view, false);
    }
    const initial = rows(f);
    await assert.rejects(f.restart().act(f.code, f.auths[1], f.game.version, f.action, clock));
    await assert.rejects(f.restart().act(f.code, f.auths[0], f.game.version,
      { ...f.action, event: 'stale' }, clock));
    assert.deepEqual(rows(f), initial);
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    const timer = setTimeout(release, 2000);
    let outcomes: PromiseSettledResult<unknown>[];
    try {
      outcomes = await Promise.allSettled([
        f.restart().act(f.code, f.auths[0], f.game.version, f.action, clock),
        f.restart().act(f.code, f.auths[0], f.game.version, f.action, clock),
      ]);
    } finally {
      clearTimeout(timer);
      delete f.hooks.beforeWrite;
    }
    assert.equal(arrivals, 2);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    const done = await f.restart().readRoom(f.code);
    assert.equal(done.version, f.game.version + 1);
    assert.equal(done.dukeVidal!.controller, owner);
    assert.equal(done.dukeVidal!.source, 'ecazNexus');
    assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
    assert.deepEqual(done.nexusEcazDukeEvents, [f.action.event]);
    assert.equal(done.nexusEcazDukeHistory?.length, 1);
    assert.equal(viewGame(done, rival).nexusEcazDuke, null);
    const saved = rows(f);
    await assert.rejects(f.restart().act(f.code, f.auths[0], f.game.version, f.action, clock), /table changed/);
    await assert.rejects(f.restart().act(f.code, f.auths[0], done.version, f.action, clock));
    assert.deepEqual(rows(f), saved);
    for (const [i, token] of f.tokens.entries()) {
      const auth = await f.restart().authenticate(f.code, token);
      assert.deepEqual(await f.restart().readSeatView(f.code, auth), viewGame(done, f.ids[i]));
    }
    assert.deepEqual(f.writes.map(write => write.changes).sort((a, b) => a - b), [0, 1]);
  }
});
