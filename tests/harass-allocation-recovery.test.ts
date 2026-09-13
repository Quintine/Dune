import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { applyAction, viewGame, type Game } from '../game/engine';
import { unitStore } from './fixture-nexus-room-store';
import { harassWithdrawGame, harassCustody } from './fixture-harass-withdraw';
const clock = { now: () => 84000, sleep: async () => {} };
const rows = (sqlite: DatabaseSync) =>
  sqlite.prepare('SELECT * FROM rooms').all();
async function fixture(t: test.TestContext) {
  const f = unitStore();
  t.after(() => f.sqlite.close());
  const made = await f.rooms.createRoom('Harass allocation', 'emperor', true, [
    'ix',
  ]);
  const code = made.view.code;
  const tokens = [
    made.token,
    (await f.rooms.joinRoom(code, 'Atreides', 'atreides')).token!,
    (await f.rooms.joinRoom(code, 'Tleilaxu', 'tleilaxu')).token!,
  ];
  const auths = await Promise.all(
    tokens.map((token) => f.rooms.authenticate(code, token)),
  );
  const ids = auths.map((a) => a.playerId) as [string, string, string];
  let g = harassWithdrawGame({ advanced: true, normal: 3, elite: 1, ids });
  g.code = code;
  g.version = (await f.rooms.readRoom(code)).version;
  g = applyAction(g, ids[0], {
    type: 'battlePlan',
    dial: 2,
    support: 1,
    leader: 'emperor-0',
    defense: 'ecaz-harass-withdraw',
  });
  g = applyAction(g, ids[1], {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
  });
  harassCustody(g);
  f.sqlite
    .prepare('UPDATE rooms SET state=?, version=? WHERE code=?')
    .run(JSON.stringify(g), g.version, code);
  return { ...f, code, tokens, ids, auths, game: g };
}
void test('revealed allocation survives seat restoration; concurrent legal choices select once, with exact winner losses', async (t) => {
  const f = await fixture(t),
    beforeRows = rows(f.sqlite);
  for (const [index, token] of f.tokens.entries()) {
    const r = f.restart(),
      auth = await r.authenticate(f.code, token);
    assert.deepEqual(
      await r.readSeatView(f.code, auth),
      viewGame(f.game, f.ids[index]),
    );
  }
  assert.deepEqual(rows(f.sqlite), beforeRows);
  const rooms = f.restart(),
    auth = await rooms.authenticate(f.code, f.tokens[0]);
  let entered = 0,
    release!: () => void;
  const both = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.hooks.beforeWrite = async () => {
    if (++entered === 2) release();
    await both;
  };
  const choices = [
    { 'arrakeen:10': { normal: 0, elite: 1 } },
    { 'arrakeen:10': { normal: 2, elite: 0 } },
  ];
  const outcomes = await Promise.allSettled(
    choices.map((returns) =>
      rooms.act(
        f.code,
        auth,
        f.game.version,
        { type: 'decision', event: f.game.battle!.harassAllocation!.event, returns },
        clock,
      ),
    ),
  );
  f.hooks.beforeWrite = undefined;
  assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
  let g = await f.restart().readRoom(f.code);
  assert.equal(g.version, f.game.version + 1);
  const selected = g.battle!.harassAllocation!.selection!['arrakeen:10'];
  assert.equal(g.players[0].reserves, 16);
  assert.equal(g.decision, null);
  for (const [index, token] of f.tokens.entries()) {
    const r = f.restart(),
      a = await r.authenticate(f.code, token);
    assert.deepEqual(
      (await r.readSeatView(f.code, a)).battle!.harassAllocation!.selection,
      g.battle!.harassAllocation!.selection,
    );
    assert.deepEqual(
      await r.readSeatView(f.code, a),
      viewGame(g, f.ids[index]),
    );
  }
  const staleRows = rows(f.sqlite);
  await assert.rejects(() =>
    f
      .restart()
      .act(
        f.code,
        auth,
        f.game.version,
        {
          type: 'decision',
          event: f.game.battle!.harassAllocation!.event,
          returns: choices[0],
        },
        clock,
      ),
  );
  assert.deepEqual(rows(f.sqlite), staleRows);
  for (const index of [0, 1]) {
    const r = f.restart(),
      a = await r.authenticate(f.code, f.tokens[index]);
    await r.act(
      f.code,
      a,
      g.version,
      { type: 'traitorCall', call: false },
      clock,
    );
    g = await r.readRoom(f.code);
  }
  assert.equal(g.battle, null);
  assert.equal(g.players[0].reserves, 16 + selected.normal + selected.elite);
  assert.equal(g.players[0].tanks, 4 - selected.normal - selected.elite);
  assert.deepEqual(g.players[0].forces, {});
  assert.equal(g.players[0].elites!.reserves, 4 + selected.elite);
  harassCustody(g);
  assert.equal(
    g.log.filter(
      (e) =>
        e.text.includes('selected') &&
        e.text.includes('undialed forces for Harass'),
    ).length,
    1,
  );
  assert.equal(
    g.log.filter((e) => e.text.includes('used Harass & Withdraw to return'))
      .length,
    1,
  );
});
void test('lost or edited saved physical choice cannot normalize or write through authenticated room recovery', async (t) => {
  const f = await fixture(t);
  for (const edit of [
    (g: Game) => {
      g.decision = null;
    },
    (g: Game) => {
      delete g.battle!.harassAllocationEvent;
    },
    (g: Game) => {
      g.battle!.harassAllocation!.frame += 'changed';
    },
  ]) {
    const bad = structuredClone(f.game);
    edit(bad);
    f.sqlite
      .prepare('UPDATE rooms SET state=? WHERE code=?')
      .run(JSON.stringify(bad), f.code);
    const before = rows(f.sqlite);
    const r = f.restart();
    await assert.rejects(
      () => r.readSeatView(f.code, f.auths[0]),
      /withdraw|Harass/i,
    );
    await assert.rejects(
      () =>
        r.act(
          f.code,
          f.auths[0],
          bad.version,
          {
            type: 'decision',
            event: f.game.battle!.harassAllocation!.event,
            returns: { 'arrakeen:10': { normal: 2, elite: 0 } },
          },
          clock,
        ),
      /withdraw|Harass/i,
    );
    assert.deepEqual(rows(f.sqlite), before);
  }
});
