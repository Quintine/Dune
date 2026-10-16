import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { harassHomeworldArrakisPool as pool } from './fixture-harass-homeworld-arrakis';
import {
  assertReinforcementsHomeworldArrakisInventory,
  createReinforcementsHomeworldArrakisFixture,
  finishReinforcementsHomeworldArrakisBattle,
  reinforcementsHomeworldArrakisClean,
  reinforcementsHomeworldArrakisPlayer as player,
  revealReinforcementsHomeworldArrakisBattle,
  sealReinforcementsHomeworldArrakisPlan,
  type ReinforcementsHomeworldArrakisFixture,
} from './fixture-reinforcements-homeworld-arrakis';

function assertDisposed(game: Game, fixture: ReinforcementsHomeworldArrakisFixture, harass: boolean): void {
  for (const id of harass ? [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD] : [REINFORCEMENTS_CARD]) {
    assert.equal(game.discard.filter(c => c.id === id).length, 1, 'Used physical utility cards discard even for the winner');
    assert.ok(!player(game, fixture.owner).hand.some(c => c.id === id));
  }
  assert.equal(game.battle, null);
  assert.ok(reinforcementsHomeworldArrakisClean(game));
  assertReinforcementsHomeworldArrakisInventory(game);
}

for (const advanced of [false, true]) {
  for (const slot of ['weapon', 'defense'] as const) {
    for (const outcome of ['winner', 'loser'] as const) {
      void test(`${advanced ? 'Advanced' : 'Basic'} Arrakis ${slot} ${outcome}: native fee is not dial, support or an army`, () => {
        const f = createReinforcementsHomeworldArrakisFixture({ advanced, slot, reserves: 'normal', outcome, harass: false });
        const before = player(f.game, f.owner);
        const revealed = revealReinforcementsHomeworldArrakisBattle(f);
        const done = finishReinforcementsHomeworldArrakisBattle(revealed,
          { losses: outcome === 'winner' ? { normal: 1, elite: 1 } : { normal: 3, elite: 0 } });
        const own = player(done, f.owner), other = player(done, f.opponent);
        assert.equal(done.lastBattleContext!.result, 'normal');
        assert.equal(done.lastBattleContext!.winner, outcome === 'winner' ? f.owner : f.opponent);
        assert.equal(own.reserves, 10, 'Thirteen original native reserves pay exactly three normal counters');
        assert.equal(own.elites!.reserves, 1);
        assert.equal(own.tanks, outcome === 'winner' ? 5 : 10, 'Fee3 plus the original two committed counters, or the original losing army7');
        assert.equal(own.elites!.tanks, outcome === 'winner' ? 1 : 4);
        assert.equal(own.battleLosses, own.tanks);
        assert.equal(own.forces[f.location] ?? 0, outcome === 'winner' ? 5 : 0);
        assert.equal(own.elites!.forces[f.location] ?? 0, outcome === 'winner' ? 3 : 0);
        const collection = advanced && done.phase >= 7 && outcome === 'winner' ? 1 : 0;
        assert.equal(own.spice, before.spice - (advanced ? 1 : 0) + collection, 'Only the original sealed support is charged; later stronghold Collection is separate');
        assert.equal(other.reserves, 13, 'The enemy native reserve pool never pays this fee');
        assert.equal(other.tanks, outcome === 'winner' ? 7 : 3);
        assert.equal(other.forces[f.location] ?? 0, outcome === 'winner' ? 0 : 4);
        assert.deepEqual(pool(done, f.owner, 'homeworld:emperor'), advanced
          ? { normal: 9, elite: 0 } : { normal: 9, elite: 1 });
        if (advanced) assert.deepEqual(pool(done, f.owner, 'homeworld:emperor:salusa'), { normal: 0, elite: 1 });
        assertDisposed(done, f, false);

        if (outcome === 'winner') {
          // The same physical armies, leaders and dial lose without precisely
          // the utility's +2: Bashar2 + dial2 =4, against Staban Tuek5.
          const plain = structuredClone(f.planActions[0]);
          plain.action.weapon = null; plain.action.defense = null;
          delete plain.action.reinforcementsSources;
          let control = sealReinforcementsHomeworldArrakisPlan(structuredClone(f.game), plain);
          control = sealReinforcementsHomeworldArrakisPlan(control, f.planActions[1]);
          control = finishReinforcementsHomeworldArrakisBattle(control);
          assert.equal(control.lastBattleContext!.winner, f.opponent);
          assert.equal(player(control, f.owner).reserves, 13);
          assert.equal(player(control, f.owner).tanks, 7);
          assertReinforcementsHomeworldArrakisInventory(control);
        }
      });
    }

    for (const reserves of ['mixed', 'elite'] as const) {
      void test(`${advanced ? 'Advanced' : 'Basic'} Arrakis ${slot}: real Fremen ${reserves} fee follows native normal-first custody`, () => {
        const f = createReinforcementsHomeworldArrakisFixture({ advanced, slot, reserves, outcome: 'winner', harass: false });
        const done = finishReinforcementsHomeworldArrakisBattle(revealReinforcementsHomeworldArrakisBattle(f),
          { losses: { normal: 2, elite: 0 } });
        const own = player(done, f.owner);
        assert.equal(done.lastBattleContext!.winner, f.owner);
        assert.equal(own.reserves, reserves === 'mixed' ? 1 : 0);
        assert.equal(own.elites!.reserves, reserves === 'mixed' ? 1 : 0);
        assert.equal(own.tanks, 5, 'Three native fee counters plus two original on-board normal casualties');
        assert.equal(own.elites!.tanks, reserves === 'mixed' ? 2 : 3);
        assert.equal(own.battleLosses, 5);
        assert.equal(own.forces[f.location], reserves === 'mixed' ? 14 : 15);
        assert.equal(own.elites!.forces[f.location] ?? 0, 0);
        assert.deepEqual(pool(done, f.owner, 'homeworld:fremen'), reserves === 'mixed'
          ? { normal: 0, elite: 1 } : { normal: 0, elite: 0 });
        assert.equal(player(done, f.opponent).reserves, player(f.game, f.opponent).reserves);
        assert.equal(player(done, f.opponent).tanks, 2);
        assertDisposed(done, f, false);
      });
    }

    void test(`${advanced ? 'Advanced' : 'Basic'} ${slot}: same-plan Harass returns cannot replace the original real Fedaykin fee`, () => {
      const f = createReinforcementsHomeworldArrakisFixture({ advanced, slot, reserves: 'elite', outcome: 'winner', harass: true });
      const revealed = revealReinforcementsHomeworldArrakisBattle(f);
      const returns = { [f.location]: { normal: 15, elite: 0 } };
      const done = finishReinforcementsHomeworldArrakisBattle(revealed, { returns });
      const own = player(done, f.owner);
      assert.equal(done.lastBattleContext!.winner, f.owner);
      assert.equal(own.reserves, 15, 'Three real native elites pay before fifteen real normals return');
      assert.equal(own.elites!.reserves, 0);
      assert.equal(own.tanks, 5);
      assert.equal(own.elites!.tanks, 3, 'Newly returned normal reserves cannot replace the sealed elite payment');
      assert.equal(own.battleLosses, 5);
      assert.equal(own.forces[f.location] ?? 0, 0);
      assert.deepEqual(pool(done, f.owner, 'homeworld:fremen'), { normal: 15, elite: 0 });
      assertDisposed(done, f, true);
    });
  }

  void test(`${advanced ? 'Advanced' : 'Basic'} same-plan Harass preserves the mixed native fee before returning normals`, () => {
    const f = createReinforcementsHomeworldArrakisFixture({ advanced, slot: 'defense', reserves: 'mixed', outcome: 'winner', harass: true });
    const done = finishReinforcementsHomeworldArrakisBattle(revealReinforcementsHomeworldArrakisBattle(f),
      { returns: { [f.location]: { normal: 14, elite: 0 } } });
    const own = player(done, f.owner);
    assert.equal(own.reserves, 15);
    assert.equal(own.elites!.reserves, 1);
    assert.equal(own.tanks, 5);
    assert.equal(own.elites!.tanks, 2);
    assert.deepEqual(pool(done, f.owner, 'homeworld:fremen'), { normal: 14, elite: 1 });
    assertDisposed(done, f, true);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} future Harass returns cannot fund two native reserves, and sources cannot bypass normal-first`, () => {
    const short = createReinforcementsHomeworldArrakisFixture({ advanced, slot: 'weapon', reserves: 'shortage', outcome: 'winner', harass: true });
    assert.equal(player(short.game, short.owner).reserves, 2);
    assert.equal(player(short.game, short.owner).elites!.reserves, 2);
    assert.equal(player(short.game, short.owner).forces[short.location], 18);
    assert.equal(player(short.game, short.owner).elites!.forces[short.location], 1, 'A real free shipment moved the eighth physical counter, one original Fedaykin');
    const before = structuredClone(short.game);
    assert.throws(() => applyAction(short.game, short.owner, short.planActions[0].action));
    assert.deepEqual(short.game, before, 'Underfunded physical utility commitment is atomic');
    const preview = viewGame(short.game, short.owner).battle!.reinforcements;
    assert.ok(preview?.blocked, 'A large possible later Harass return does not fund the current fee');
    assertReinforcementsHomeworldArrakisInventory(short.game);

    const mixed = createReinforcementsHomeworldArrakisFixture({ advanced, slot: 'defense', reserves: 'mixed', outcome: 'winner', harass: false });
    const mixedBefore = JSON.stringify(mixed.game);
    const wrong = structuredClone(mixed.planActions[0]);
    wrong.action.reinforcementsSources = { 'homeworld:fremen': { normal: 0, elite: 3 } };
    assert.throws(() => applyAction(mixed.game, mixed.owner, wrong.action), 'Three elites exist, but the one native normal must pay first');
    const foreign = structuredClone(mixed.planActions[0]);
    foreign.action.reinforcementsSources = { 'homeworld:guild': { normal: 1, elite: 2 } };
    assert.throws(() => applyAction(mixed.game, mixed.owner, foreign.action), 'An opposing World cannot fund the selected native fee');
    assert.equal(JSON.stringify(mixed.game), mixedBefore);
    assertReinforcementsHomeworldArrakisInventory(mixed.game);
  });

  for (const resolution of ['owner', 'opponent', 'both', 'explosion'] as const) {
    void test(`${advanced ? 'Advanced' : 'Basic'} Arrakis ${resolution}: revealed native fee and mandatory disposal survive exceptional outcomes`, () => {
      const f = createReinforcementsHomeworldArrakisFixture({ advanced, slot: 'weapon', reserves: 'normal',
        outcome: 'winner', harass: true, traitor: resolution === 'explosion' ? undefined : resolution,
        explosion: resolution === 'explosion' });
      const revealed = revealReinforcementsHomeworldArrakisBattle(f);
      const callers = resolution === 'both' ? [f.owner, f.opponent] : resolution === 'owner' ? [f.owner]
        : resolution === 'opponent' ? [f.opponent] : [];
      const done = finishReinforcementsHomeworldArrakisBattle(revealed,
        { callers, returns: { [f.location]: { normal: 2, elite: 3 } } });
      const canceled = resolution === 'opponent' || resolution === 'both';
      const own = player(done, f.owner);
      assert.equal(done.lastBattleContext!.result, resolution === 'both' ? 'mutualTraitors' : resolution === 'explosion' ? 'explosion' : 'traitor');
      assert.equal(done.lastBattleContext!.winner, resolution === 'owner' ? f.owner : resolution === 'opponent' ? f.opponent : null);
      assert.equal(own.reserves, canceled ? 10 : 15, 'Every revealed outcome pays the original native fee; only opposing Traitor cancels Harass returns');
      assert.equal(own.elites!.reserves, canceled ? 1 : 4);
      assert.equal(own.tanks, canceled ? 10 : resolution === 'owner' ? 3 : 5);
      assert.equal(own.elites!.tanks, canceled ? 4 : resolution === 'owner' ? 0 : 1);
      assert.equal(own.battleLosses, own.tanks);
      assert.equal(own.forces[f.location] ?? 0, resolution === 'owner' ? 2 : 0, 'Only the own-Traitor winner retains its original committed physical complement');
      assert.equal(own.elites!.forces[f.location] ?? 0, resolution === 'owner' ? 1 : 0);
      assert.deepEqual(pool(done, f.owner, 'homeworld:emperor'), advanced
        ? { normal: canceled ? 9 : 11, elite: 0 }
        : { normal: canceled ? 9 : 11, elite: canceled ? 1 : 4 });
      if (advanced) assert.deepEqual(pool(done, f.owner, 'homeworld:emperor:salusa'), { normal: 0, elite: canceled ? 1 : 4 });
      assertDisposed(done, f, true);
    });
  }
}
