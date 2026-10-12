import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { gameDistance, splitLocation } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { OrnithopterMode } from '../game/ornithopter';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { advanceSemutaHomeworldChoam, holdSemutaHomeworldChoamCard,
  reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { withoutSemutaHomeworldChoamMovementHolder } from './fixture-semuta-homeworld-choam-movement';
import { createSemutaHomeworldOrnithopterFixture, disposeSemutaHomeworldOrnithopter,
  finishSemutaHomeworldOrnithopter, semutaHomeworldOrnithopterResources as resources,
  semutaHomeworldOrnithopterStock as stock } from './fixture-semuta-homeworld-ornithopter';

function assertCounters(game: Game, original: Game) {
  for (const p of game.players) {
    const before = player(original, p.id);
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((n, x) => n + x, 0),
      before.reserves + before.tanks + Object.values(before.forces).reduce((n, x) => n + x, 0));
    if (p.elites && before.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((n, x) => n + x, 0),
        before.elites.reserves + before.elites.tanks + Object.values(before.elites.forces).reduce((n, x) => n + x, 0));
      for (const [key, count] of Object.entries(p.elites.forces)) assert.ok(count <= (p.forces[key] ?? 0));
    }
  }
  assert.deepEqual(game.homeworlds?.custody, original.homeworlds?.custody);
}
const paths: { mode: OrnithopterMode; early: boolean }[] = [
  { mode: 'range3', early: false }, { mode: 'twoGroups', early: false }, { mode: 'twoGroups', early: true },
];
for (const advanced of [false, true]) for (const { mode, early } of paths) {
  const label = `${advanced ? 'Advanced' : 'Basic'} Homeworld Ornithopter ${mode}${early ? ' early finish' : ''}`;
  for (const claim of [false, true]) void test(`${label}: ${claim ? 'claim' : 'pass'} retires once before the original arrival or turn continuation`, () => {
    const f = createSemutaHomeworldOrnithopterFixture(mode, advanced, early);
    const inventory = stock(f.beforeFirstMove), owner = player(f.afterShipment, f.owner);
    assert.equal(f.afterShipment.turn, 1);
    assert.equal(f.afterShipment.phase, 5);
    assert.equal(owner.spice, player(f.beforeShipment, f.owner).spice - f.amount * 2);
    assert.equal(owner.reserves, player(f.beforeShipment, f.owner).reserves - f.amount);
    assert.equal(owner.forces[f.origin], f.amount);
    assertCounters(f.afterShipment, f.setup);
    const distance = gameDistance(f.beforeFirstMove, f.origin, f.destination,
      key => splitLocation(key).sector === f.beforeFirstMove.storm);
    assert.equal(distance, mode === 'range3' ? 3 : 1);
    if (mode === 'range3') assert.throws(() => applyAction(f.beforeFirstMove, f.owner,
      { ...f.firstMove, movementCard: undefined, ornithopter: undefined }));
    if (mode === 'twoGroups') {
      assert.equal(player(f.game, f.owner).forces[f.destination], 1);
      assert.equal(player(f.game, f.owner).moved, 1);
      assert.equal(player(f.game, f.owner).hand.some(c => c.id === f.card), false);
      assert.equal(f.game.discard.some(c => c.id === f.card), false);
      assert.equal(viewGame(f.game, f.owner).ornithopter?.active?.remaining, 1);
      assert.deepEqual(viewGame(f.game, f.owner).ornithopter?.active?.cohort?.forces,
        early ? {} : { [f.origin]: 1 });
      assert.throws(() => applyAction(f.game, f.owner, { type: 'move', from: f.destination,
        amount: 1, elite: 0, ...splitLocation(f.origin), ornithopterEvent: f.game.ornithopter!.event }));
      assert.throws(() => applyAction(f.game, f.owner, { ...f.action, type: 'move',
        from: f.origin, amount: 1, ...splitLocation(f.secondDestination), ornithopterEvent: 'stale' }));
    }
    const uninterrupted = reactSemutaHomeworldChoam(disposeSemutaHomeworldOrnithopter(f,
      withoutSemutaHomeworldChoamMovementHolder(f.game, f.holder)), f.holder, false);
    const offered = disposeSemutaHomeworldOrnithopter(f);
    assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
    assert.equal(offered.discard.filter(c => c.id === f.card).length, 1);
    assert.equal(player(offered, f.owner).hand.some(c => c.id === f.card), false);
    assert.equal(player(offered, f.owner).moved, f.moves);
    assert.equal(player(offered, f.owner).forces[f.destination], 1);
    if (mode === 'twoGroups' && !early) assert.equal(player(offered, f.owner).forces[f.secondDestination], 1);
    assert.equal(player(offered, f.owner).forces[f.origin] ?? 0, 0);
    assert.equal(offered.active, f.owner, 'Retirement suspends the same original turn, not its successor');
    assert.deepEqual(offered.movementRemaining, f.game.movementRemaining);
    assert.deepEqual(stock(offered), inventory);
    assertCounters(offered, f.setup);
    assert.deepEqual(normalizeAutomaticGame(structuredClone(offered)), offered);
    const reloaded = normalizeAutomaticGame(JSON.parse(JSON.stringify(offered)));
    assert.deepEqual(resources(reloaded), resources(offered));
    assert.deepEqual(stock(reloaded), inventory);
    assert.equal(reloaded.active, offered.active);
    assert.deepEqual(reloaded.movementRemaining, offered.movementRemaining);
    for (const p of offered.players) assert.deepEqual(viewGame(reloaded, p.id), viewGame(offered, p.id));
    const frozen = resources(offered), event = offered.pendingTreacheryDiscard!.batch.event;
    assert.throws(() => applyAction(offered, f.owner, { type: 'endMovement' }));
    assert.throws(() => applyAction(offered, f.owner, f.action));
    const resumed = reactSemutaHomeworldChoam(JSON.parse(JSON.stringify(offered)), f.holder, claim);
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.deepEqual(resources(resumed), frozen, 'Resume cannot replay a paid shipment or ground move');
    assert.deepEqual(resources(resumed), resources(uninterrupted));
    assert.equal(resumed.active, uninterrupted.active);
    assert.deepEqual(resumed.movementRemaining, uninterrupted.movementRemaining);
    assert.equal(player(resumed, f.holder).hand.filter(c => c.id === f.card).length, claim ? 1 : 0);
    assert.equal(resumed.discard.filter(c => c.id === f.card).length, claim ? 0 : 1);
    assert.equal(resumed.discard.filter(c => c.id === SEMUTA_DRUG_ID).length, claim ? 1 : 0);
    assert.deepEqual(stock(resumed), inventory);
    assert.throws(() => applyAction(resumed, f.holder, { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(resumed, f.owner, f.firstMove));
    assert.throws(() => applyAction(resumed, f.owner, { type: 'move', from: f.destination,
      amount: 1, ...splitLocation(f.origin) }));
    const replay = structuredClone(resumed);
    replay.pendingTreacheryDiscard = structuredClone(offered.pendingTreacheryDiscard);
    assert.throws(() => normalizeAutomaticGame(replay));
    assert.deepEqual(normalizeAutomaticGame(structuredClone(resumed)), resumed);
    const completed = finishSemutaHomeworldOrnithopter(resumed);
    assert.equal(completed.turn, 1);
    assert.equal(completed.phase, 7);
    assert.equal(player(completed, f.owner).moved, f.moves);
    assert.equal(player(completed, f.owner).reserves, owner.reserves);
    assert.deepEqual(player(completed, f.owner).forces, player(offered, f.owner).forces);
    assert.deepEqual(stock(completed), inventory);
    assertCounters(completed, f.setup);
  });

  void test(`${label}: full-hand singleton entitlement is private and original forces cannot be borrowed by another player`, () => {
    const f = createSemutaHomeworldOrnithopterFixture(mode, advanced, early, true);
    assert.equal(player(f.game, f.holder).hand.length, handLimit(player(f.game, f.holder)));
    assert.throws(() => applyAction(f.game, f.holder, f.action));
    const offered = disposeSemutaHomeworldOrnithopter(f);
    const neutral = disposeSemutaHomeworldOrnithopter(f, withoutSemutaHomeworldChoamMovementHolder(f.game, f.holder));
    assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    const event = offered.pendingTreacheryDiscard!.batch.event;
    for (const p of offered.players.filter(p => p.id !== f.holder)) {
      assert.deepEqual(viewGame(offered, p.id), viewGame(neutral, p.id));
      assert.equal(viewGame(offered, p.id).semutaReaction?.canCommit, false);
      assert.throws(() => applyAction(offered, p.id, { type: 'semutaCommit', event }));
    }
    assert.throws(() => applyAction(offered, f.holder, { type: 'semutaCommit', event: 'stale' }));
    const claimed = reactSemutaHomeworldChoam(offered, f.holder, true);
    assert.equal(player(claimed, f.holder).hand.length, handLimit(player(claimed, f.holder)));
    assert.equal(player(claimed, f.holder).hand.some(c => c.id === f.card), true);
    assert.equal(player(claimed, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), false);
    const done = finishSemutaHomeworldOrnithopter(claimed);
    assert.equal(player(done, f.owner).moved, f.moves);
    assert.deepEqual(stock(done), stock(f.beforeFirstMove));
  });

  void test(`${label}: all four bot profiles legally claim or pass without a second shipment or repeated group`, () => {
    const f = createSemutaHomeworldOrnithopterFixture(mode, advanced, early);
    const offered = disposeSemutaHomeworldOrnithopter(f), frozen = resources(offered);
    for (const difficulty of DIFFICULTIES) {
      let game: Game = structuredClone(offered);
      const own = viewGame(game, f.holder);
      own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const action = botActions(own)[0];
      assert.ok(action);
      assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass');
      game = applyAction(game, f.holder, action);
      while (game.pendingTreacheryDiscard?.reaction?.stage === 'offer') {
        const pending = game.pendingTreacheryDiscard, reaction = pending.reaction;
        if (reaction?.stage !== 'offer') throw Error('Missing original retirement offer');
        const actor = game.players.find(p => !reaction.passed.includes(p.id))!.id;
        game = applyAction(game, actor, { type: 'semutaPass', event: pending.batch.event });
      }
      assert.equal(game.pendingTreacheryDiscard, null);
      assert.equal(player(game, f.holder).hand.some(c => c.id === f.card), action.type === 'semutaCommit');
      assert.deepEqual(resources(game), frozen);
      const done = finishSemutaHomeworldOrnithopter(game);
      assert.equal(player(done, f.owner).moved, f.moves);
      assert.deepEqual(stock(done), stock(f.beforeFirstMove));
      assertCounters(done, f.setup);
    }
  });
}

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} Homeworld original prior-move, Hajr and fixed maximum-three guards remain real`, () => {
  const f = createSemutaHomeworldOrnithopterFixture('range3', advanced);
  const before = structuredClone(f.beforeFirstMove);
  assert.throws(() => applyAction(before, f.owner, { ...f.firstMove, ...splitLocation(f.tooFarDestination) }));
  assert.deepEqual(before, f.beforeFirstMove);
  const moved = applyAction(before, f.owner, { ...f.firstMove, movementCard: undefined,
    ornithopter: undefined, ...splitLocation(f.secondDestination) });
  assert.equal(player(moved, f.owner).moved, 1);
  assert.equal(player(moved, f.owner).hand.some(c => c.id === f.card), true);
  assert.throws(() => applyAction(moved, f.owner, { ...f.firstMove, from: f.secondDestination,
    ...splitLocation(f.origin) }));
  const hajrGame = structuredClone(before);
  const hajr = holdSemutaHomeworldChoamCard(hajrGame, f.owner, 'Hajr');
  const played = applyAction(hajrGame, f.owner, { type: 'card', card: hajr });
  const allowed = advanceSemutaHomeworldChoam(played,
    g => !g.pendingTreacheryDiscard && !g.response && !g.decision && !g.phaseOpening);
  assert.equal(player(allowed, f.owner).moved, 0);
  assert.ok(allowed.hajr.includes(f.owner));
  assert.throws(() => applyAction(allowed, f.owner, f.firstMove));
  assert.equal(player(allowed, f.owner).hand.some(c => c.id === f.card), true);
  assertCounters(allowed, f.setup);
});
