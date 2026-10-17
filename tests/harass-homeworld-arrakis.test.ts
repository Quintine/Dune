import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { casualtyOptions } from '../game/combat';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldPopulations } from '../game/homeworld-population';
import { homeworldSardaukarFreeSupport } from '../game/homeworld-benefits';
import {
  advanceHarassHomeworldArrakis, assertHarassHomeworldArrakisCustody,
  chooseHarassHomeworldArrakisAllocation, createHarassHomeworldArrakisFixture,
  finishHarassHomeworldArrakisBattle, harassHomeworldArrakisClean,
  harassHomeworldArrakisPlayer as player, harassHomeworldArrakisPool as pool,
  pendingHarassHomeworldArrakisAllocations, revealHarassHomeworldArrakisBattle,
  sealHarassHomeworldArrakisPlan, type HarassHomeworldArrakisStep,
} from './fixture-harass-homeworld-arrakis';

for (const advanced of [false, true]) {

  for (const outcome of ['winner', 'loser'] as const) {
    for (const slot of ['weapon', 'defense'] as const) {
      void test(`${advanced ? 'Advanced' : 'Basic'} ${outcome} ${slot}: every real typed return preserves its original commitment`, () => {
        const f = createHarassHomeworldArrakisFixture({ advanced, outcome, slot });
        const onePlan = sealHarassHomeworldArrakisPlan(f.game, f.planActions[0]);
        assert.equal(onePlan.battle!.harassAllocation, undefined);
        assert.equal(viewGame(onePlan, f.opponent).battle!.plans[f.owner], undefined);
        const revealed = sealHarassHomeworldArrakisPlan(onePlan, f.planActions[1]);
        assert.equal(revealed.battle!.revealed, true);
        assert.equal(revealed.decision?.kind, 'harassWithdraw');
        assert.equal(viewGame(revealed, f.opponent).battle!.harassAllocation, null);
        const offer = viewGame(revealed, f.owner).battle!.harassAllocation!;
        const allocations = pendingHarassHomeworldArrakisAllocations(revealed, f.owner);
        assert.ok(allocations.length >= 3, 'Actual physical Basic/Advanced alternatives remain after reveal');
        const sealedPlan = structuredClone(revealed.battle!.plans[f.owner]);
        const event = revealed.battle!.event;
        for (const returns of allocations) {
          const returned = returns[f.location];
          const committed = { normal: 3 - returned.normal, elite: 4 - returned.elite };
          assert.ok(casualtyOptions(offer.context.forces, offer.dial, offer.support)
            .some(c => c.normal === committed.normal && c.elite === committed.elite));
          let game = chooseHarassHomeworldArrakisAllocation(revealed, f.owner, returns);
          assert.deepEqual(game.battle!.plans[f.owner], sealedPlan);
          assert.equal(player(game, f.owner).reserves, 13, 'Selection alone does not return counters before Traitor calls');
          assert.deepEqual(game.homeworlds, revealed.homeworlds);
          game = advanceHarassHomeworldArrakis(game, g => g.lastBattleContext?.event === event);
          assert.equal(game.lastBattleContext!.winner, outcome === 'winner' ? f.owner : f.opponent);
          assert.equal(game.lastBattleContext!.result, 'normal');
          assert.equal(player(game, f.owner).spice, player(revealed, f.owner).spice - (advanced ? 1 : 0), 'Sealed support charged once, not from returned population');
          const opponentCollection = advanced && game.phase >= 7 && (player(game, f.opponent).forces[f.location] ?? 0) > 0 ? 1 : 0;
          assert.equal(player(game, f.opponent).spice, player(revealed, f.opponent).spice - (advanced && outcome === 'loser' ? 3 : 0) + opponentCollection);
          if (outcome === 'winner' && game.decision?.kind === 'battleLosses') {
            assert.deepEqual(game.decision.options.map(c => ({ normal: c.normal, elite: c.elite })), [committed], 'The selected Harass complement fixes winner losses');
          }
          game = finishHarassHomeworldArrakisBattle(game);
          const own = player(game, f.owner);
          assert.equal(own.reserves, 13 + returned.normal + returned.elite);
          assert.equal(own.elites!.reserves, 1 + returned.elite);
          assert.equal(own.tanks, committed.normal + committed.elite);
          assert.equal(own.elites!.tanks, committed.elite);
          assert.equal(own.battleLosses, committed.normal + committed.elite, 'Returns are not battle losses');
          assert.equal(own.forces[f.location] ?? 0, 0, 'Returned counters cannot survive as occupying board forces');
          assert.equal(own.elites!.forces[f.location] ?? 0, 0);
          const other = player(game, f.opponent);
          assert.equal(other.reserves, 13, 'Opponent never receives the Harass user’s returned forces');
          assert.equal(other.tanks, outcome === 'winner' ? 7 : 3);
          assert.equal(other.battleLosses, outcome === 'winner' ? 7 : 3);
          assert.equal(other.forces[f.location] ?? 0, outcome === 'winner' ? 0 : 4);
          assert.deepEqual(pool(game, f.owner, 'homeworld:emperor'), advanced
            ? { normal: 12 + returned.normal, elite: 0 }
            : { normal: 12 + returned.normal, elite: 1 + returned.elite });
          assert.deepEqual(game.homeworlds!.custody!.salusa, advanced ? { normal: 0, elite: 1 + returned.elite } : null);
          assert.deepEqual(game.homeworlds!.custody!.visitors, {});
          assert.equal(game.discard.filter(c => c.id === 'ecaz-harass-withdraw').length, 1);
          assert.ok(!own.hand.some(c => c.id === 'ecaz-harass-withdraw'));
          assert.equal(game.battle, null);
          assert.ok(harassHomeworldArrakisClean(game));
          assertHarassHomeworldArrakisCustody(game);
        }
      });
    }
  }

  for (const caller of ['opponent', 'owner', 'both'] as const) {
    void test(`${advanced ? 'Advanced' : 'Basic'} actual ${caller} Traitor call keeps native return and disposal precedence`, () => {
      const f = createHarassHomeworldArrakisFixture({ advanced, traitor: caller, outcome: 'loser' });
      const revealed = revealHarassHomeworldArrakisBattle(f);
      const returns = { [f.location]: { normal: 2, elite: 3 } };
      assert.ok(pendingHarassHomeworldArrakisAllocations(revealed, f.owner)
        .some(choice => JSON.stringify(choice) === JSON.stringify(returns)));
      const callers = caller === 'both' ? [f.owner, f.opponent] : [caller === 'owner' ? f.owner : f.opponent];
      const actions: HarassHomeworldArrakisStep[] = [];
      const game = finishHarassHomeworldArrakisBattle(revealed, { returns, callers }, actions);
      assert.equal(actions.filter(s => s.action.type === 'traitorCall' && s.action.call === true).length, callers.length);
      assert.equal(game.lastBattleContext!.result, caller === 'both' ? 'mutualTraitors' : 'traitor');
      assert.equal(game.lastBattleContext!.winner, caller === 'both' ? null : caller === 'owner' ? f.owner : f.opponent);
      const own = player(game, f.owner), canceled = caller !== 'owner';
      assert.equal(own.reserves, canceled ? 13 : 18);
      assert.equal(own.elites!.reserves, canceled ? 1 : 4);
      assert.equal(own.tanks, canceled ? 7 : 0);
      assert.equal(own.elites!.tanks, canceled ? 4 : 0);
      assert.equal(own.battleLosses, canceled ? 7 : 0);
      assert.equal(own.forces[f.location] ?? 0, canceled ? 0 : 2, 'Own Traitor winner keeps its committed counters, not its returned counters');
      assert.equal(own.elites!.forces[f.location] ?? 0, canceled ? 0 : 1);
      assert.deepEqual(pool(game, f.owner, 'homeworld:emperor'), advanced
        ? { normal: canceled ? 12 : 14, elite: 0 }
        : { normal: canceled ? 12 : 14, elite: canceled ? 1 : 4 });
      assert.deepEqual(game.homeworlds!.custody!.salusa, advanced ? { normal: 0, elite: canceled ? 1 : 4 } : null);
      const otherPlan = f.planActions[1].action;
      assert.equal(otherPlan.type, 'battlePlan');
      const bounty = player(revealed, f.opponent).leaders.find(l => l.id === otherPlan.leader)!.strength;
      const ownerCollection = advanced && game.phase >= 7 && (own.forces[f.location] ?? 0) > 0 ? 1 : 0;
      const paidSupport = advanced && caller !== 'owner' ? 1 : 0;
      assert.equal(own.spice, player(revealed, f.owner).spice + (caller === 'owner' ? bounty : 0) - paidSupport + ownerCollection,
        'Only the sole Traitor winner waives support; later Collection remains separate.');
      if (canceled) {
        const ownPlan = f.planActions[0].action;
        assert.equal(ownPlan.type, 'battlePlan');
        assert.equal(own.leaders.find(l => l.id === ownPlan.leader)!.dead, true);
      }
      assert.equal(game.discard.filter(c => c.id === 'ecaz-harass-withdraw').length, 1, 'After-use disposal also beats own-Traitor winner retention');
      assert.ok(!own.hand.some(c => c.id === 'ecaz-harass-withdraw'));
      assertHarassHomeworldArrakisCustody(game);
    });
  }
}

void test('Advanced Salusa low→high return does not retroactively rescore sealed support, and later native shipment uses the real reserves', () => {
  const f = createHarassHomeworldArrakisFixture({ advanced: true, outcome: 'winner' });
  const revealed = revealHarassHomeworldArrakisBattle(f);
  const offer = viewGame(revealed, f.owner).battle!.harassAllocation!;
  assert.equal(homeworldSardaukarFreeSupport(revealed, f.owner), false);
  assert.ok(casualtyOptions(offer.context.forces, 2, 1).some(c => c.normal === 1 && c.elite === 1));
  assert.ok(!casualtyOptions({ ...offer.context.forces, eliteFreeSupport: true }, 2, 1)
    .some(c => c.normal === 1 && c.elite === 1), 'Requoting against high Salusa would erase the sealed physical commitment');
  const game = finishHarassHomeworldArrakisBattle(revealed, { returns: { [f.location]: { normal: 2, elite: 3 } } });
  assert.equal(player(game, f.owner).tanks, 2);
  assert.equal(player(game, f.owner).elites!.tanks, 1);
  assert.equal(player(game, f.owner).spice, player(revealed, f.owner).spice - 1);
  assert.equal(homeworldSardaukarFreeSupport(game, f.owner), true);
  const salusa = homeworldPopulations(homeworldContext(game), game.homeworlds!.custody!)
    .find(h => h.location === 'homeworld:emperor:salusa')!;
  assert.equal(salusa.population, 4);
  assert.equal(salusa.side, 'high');
  let next = advanceHarassHomeworldArrakis(game,
    g => g.turn === 2 && g.phase === 5 && g.active === f.owner && harassHomeworldArrakisClean(g));
  assert.ok(viewGame(next, f.owner).homeworldMove, 'The native next movement control remains available');
  const before = structuredClone(next);
  // The next real Storm can cover the original battle sector. Polar Sink is a
  // legal storm-independent destination; the assertion here is native reserve use.
  const destination = 'polar_sink:0';
  next = applyAction(next, f.owner, { type: 'ship', territory: 'polar_sink',
    sector: 0, amount: 1, elite: 1, allyPayment: 0,
    homeworldSources: { 'homeworld:emperor:salusa': { normal: 0, elite: 1 } } });
  next = advanceHarassHomeworldArrakis(next, harassHomeworldArrakisClean);
  assert.equal(player(next, f.owner).reserves, player(before, f.owner).reserves - 1);
  assert.equal(player(next, f.owner).elites!.reserves, player(before, f.owner).elites!.reserves - 1);
  assert.deepEqual(pool(next, f.owner, 'homeworld:emperor'), pool(before, f.owner, 'homeworld:emperor'));
  assert.deepEqual(pool(next, f.owner, 'homeworld:emperor:salusa'), { normal: 0, elite: 3 });
  assert.equal(player(next, f.owner).forces[destination], 1);
  assert.equal(player(next, f.owner).elites!.forces[destination], 1);
  assert.equal(player(next, f.owner).tanks, player(before, f.owner).tanks);
  assertHarassHomeworldArrakisCustody(next);
});
