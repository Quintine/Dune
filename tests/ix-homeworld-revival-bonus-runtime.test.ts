import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { MOBILE_LOCATION } from '../game/board';
import { forceRevivalQuote } from '../game/revival';
import { quoteIxSuboidBonus } from '../game/ix-homeworld-revival';
import {
  createIxHomeworldRevivalBonusFixture as fixture,
  reviveIxHomeworldRevivalBonus as revive,
  ixHomeworldRevivalBonusPlayer as player,
  ixHomeworldRevivalBonusInventory as inventory,
  ixHomeworldRevivalBonusPopulation as population,
  ixHomeworldRevivalBonusNativeForces as nativeForces,
  finishIxHomeworldRevivalBonus as finish,
} from './fixture-ix-homeworld-revival-bonus';

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} actual paid Cyborg return adds two real Suboids beyond the ordinary three-force quota`, () => {
    const f = fixture({ advanced }), before = structuredClone(player(f.game, f.owner));
    const source = structuredClone(f.game), homeBefore = nativeForces(f.game, f.owner);
    assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 4);
    assert.equal(population(f.game, f.owner).population, 9);
    assert.equal(population(f.game, f.owner).side, 'high');
    assert.equal(before.tanks, 5); assert.equal(before.elites?.tanks, 1);
    assert.equal(f.afterBattle.lastBattleContext?.winner, f.opponent);
    assert.equal(player(f.afterBattle, f.opponent).tanks, 0);
    assert.equal(f.shipment.steps[0].action.type, 'ship');
    assert.ok(f.actions.some(step => step.action.type === 'homeworlds' && step.action.enabled === true));
    assert.ok(f.actions.some(step => step.action.type === 'start'));
    assert.equal(f.sourceActionCount, f.actions.length);
    assert.equal(viewGame(f.game, f.owner).revival.ixSuboidBonusEnabled, true);
    assert.equal(viewGame(f.game, f.opponent).revival.ixSuboidBonusEnabled, false);
    const quote = forceRevivalQuote(f.game, before, 3, 1, 0);
    assert.deepEqual(quote, { free: 1, normalCost: 5, cost: 5 });
    assert.equal(quoteIxSuboidBonus({ enabled: true, amount: 3, elite: 1, free: quote.free,
      freeElite: 0, normalTanks: before.tanks - before.elites!.tanks }), 2);
    const result = revive(f.game, f), after = player(result.game, f.owner);
    assert.deepEqual(f.game, source, 'The original source remains available for the other native branches');
    assert.equal(after.reserves, before.reserves + 5);
    assert.equal(after.elites?.reserves, before.elites!.reserves + 1);
    assert.equal(after.tanks, 0); assert.equal(after.elites?.tanks, 0);
    assert.equal(after.revived, 3, 'Only the declared three forces consume normal revival allowance');
    assert.equal(after.freeForcesRevived, 1, 'Additional Suboids do not consume the ordinary free quota');
    assert.equal(after.elites?.revived, 1);
    assert.equal(before.spice - after.spice, 5);
    assert.deepEqual(nativeForces(result.game, f.owner), { normal: homeBefore.normal + 4, elite: homeBefore.elite + 1 });
    assert.equal(after.forces[MOBILE_LOCATION], 6);
    assert.equal(after.elites?.forces[MOBILE_LOCATION], 3);
    assert.equal(viewGame(result.game, f.owner).revival.forcesRemaining, 0);
    assert.deepEqual(inventory(result.game), f.originalInventory);
    const movement = finish(result.game);
    assert.equal(movement.turn, 2); assert.equal(movement.phase, 5);
    assert.equal(player(movement, f.owner).reserves, after.reserves);
    assert.equal(player(movement, f.owner).tanks, 0);
    assert.deepEqual(inventory(movement), f.originalInventory);
  });
}

void test('an actual earlier free Suboid remains completed and the later paid Cyborg bonus uses no extra ordinary slots', () => {
  const f = fixture({ priorFree: true }), before = structuredClone(player(f.game, f.owner));
  assert.ok(f.priorFree);
  assert.equal(player(f.beforePriorFree, f.owner).tanks, 5);
  assert.equal(before.tanks, 4); assert.equal(before.revived, 1); assert.equal(before.freeForcesRevived, 1);
  const result = revive(f.game, f), after = player(result.game, f.owner);
  assert.equal(after.reserves - before.reserves, 4);
  assert.equal(after.elites!.reserves - before.elites!.reserves, 1);
  assert.equal(after.tanks, 0); assert.equal(after.elites?.tanks, 0);
  assert.equal(before.spice - after.spice, 5);
  assert.equal(after.revived, 3); assert.equal(after.freeForcesRevived, 1);
  assert.deepEqual(inventory(result.game), f.originalInventory);
});

void test('a genuine free Cyborg return gives no extra Suboids or paid invoice', () => {
  const f = fixture(), before = structuredClone(player(f.game, f.owner));
  const result = revive(f.game, f, f.freeCyborg), after = player(result.game, f.owner);
  assert.equal(after.reserves, before.reserves + 1);
  assert.equal(after.elites?.reserves, before.elites!.reserves + 1);
  assert.equal(after.tanks, 4); assert.equal(after.elites?.tanks, 0);
  assert.equal(after.spice, before.spice);
  assert.equal(after.revived, 1); assert.equal(after.freeForcesRevived, 1);
  assert.deepEqual(inventory(result.game), f.originalInventory);
});

void test('ordinary Suboid revivals create no bonus and a later paid Cyborg returns only the two still in Tanks', () => {
  const f = fixture(), before = structuredClone(player(f.game, f.owner));
  const suboids = revive(f.game, f, f.suboidAction).game;
  const middle = structuredClone(player(suboids, f.owner));
  assert.equal(middle.reserves, before.reserves + 2);
  assert.equal(middle.elites?.reserves, before.elites?.reserves);
  assert.equal(middle.tanks, 3); assert.equal(middle.elites?.tanks, 1);
  assert.equal(before.spice - middle.spice, 2);
  assert.equal(middle.revived, 2); assert.equal(middle.freeForcesRevived, 1);
  const paidCyborg: Action = { type: 'revive', amount: 1, elite: 1, freeElite: 0 };
  const result = revive(suboids, f, paidCyborg), after = player(result.game, f.owner);
  assert.equal(after.reserves - middle.reserves, 3);
  assert.equal(after.elites!.reserves - middle.elites!.reserves, 1);
  assert.equal(middle.spice - after.spice, 3);
  assert.equal(after.tanks, 0); assert.equal(after.revived, 3); assert.equal(after.freeForcesRevived, 1);
  assert.deepEqual(inventory(result.game), f.originalInventory);
});

void test('the original privately drafted Ghola returns its Cyborg without the paid-revival bonus or normal allowance use', () => {
  const f = fixture({ ghola: true }), before = structuredClone(player(f.game, f.owner));
  assert.ok(f.ghola && f.gholaAction);
  assert.equal(f.startingDraft.steps[0].action.card, f.ghola);
  assert.ok(before.hand.some(card => card.id === f.ghola));
  const result = revive(f.game, f, f.gholaAction), after = player(result.game, f.owner);
  assert.equal(after.reserves, before.reserves + 1);
  assert.equal(after.elites?.reserves, before.elites!.reserves + 1);
  assert.equal(after.tanks, 4); assert.equal(after.elites?.tanks, 0);
  assert.equal(after.spice, before.spice);
  assert.equal(after.revived, before.revived);
  assert.equal(after.freeForcesRevived, before.freeForcesRevived);
  assert.equal(after.hand.some(card => card.id === f.ghola), false);
  assert.equal(result.game.discard.filter(card => card.id === f.ghola).length, 1);
  assert.deepEqual(inventory(result.game), f.originalInventory);
});

void test('all four existing Basic profiles retain legal original revival choices without strategic tuning', () => {
  const f = fixture();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(f.game, f.owner); view.players.find(player => player.id === f.owner)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'revive');
    assert.ok(action, `${difficulty} proposes an ordinary revival from the genuine native source`);
    const result = revive(structuredClone(f.game), f, action);
    const before = player(f.game, f.owner), after = player(result.game, f.owner);
    assert.ok(after.tanks < before.tanks);
    assert.ok(after.spice >= 0 && after.spice <= before.spice);
    assert.ok(after.revived > before.revived && after.revived <= 3);
    assert.equal(population(result.game, f.owner).side, 'high');
    assert.deepEqual(inventory(result.game), f.originalInventory);
    assert.equal(finish(result.game).phase, 5);
  }
});
