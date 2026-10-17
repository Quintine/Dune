import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { forceRevivalQuote } from '../game/revival';
import {
  assertIndependentSkillsRevivalInventory, createIndependentSkillsRevivalFixture,
  independentSkillsRevivalPlayer,
} from './fixture-independent-skills-revival';

const spiceOf = (game: Game, id: string): number =>
  independentSkillsRevivalPlayer(game, id).spice;

void test('the payer\'s prior free return and the real Recruits activation price the paid revival exactly', () => {
  const fixture = createIndependentSkillsRevivalFixture();
  // Ordinary caps and rates on the real turn-two Revival state.
  assert.deepEqual(fixture.pricing.ordinary, { limit: 3, freeRemaining: 1, forcesRemaining: 3 });
  // A genuine free return before the card is retained, never washed away.
  assert.deepEqual(fixture.pricing.priorReturn, { limit: 3, freeRemaining: 0, revived: 1, freeUsed: 1 });
  const beforeRecruits = independentSkillsRevivalPlayer(fixture.beforeRecruits, fixture.payer);
  assert.equal(beforeRecruits.reserves, 16);
  assert.equal(beforeRecruits.tanks, 4);
  assert.equal(spiceOf(fixture.beforeRecruits, fixture.payer), spiceOf(fixture.atRevival, fixture.payer),
    'A free return costs no spice');
  // The physical card is really played through the ordinary action.
  assert.equal(fixture.beforeMainRevival.recruits?.player, fixture.payer);
  assert.deepEqual(fixture.pricing.doubled, { limit: 7, freeRemaining: 1 });
  // The independent original price of the requested return, from the real state.
  const payer = independentSkillsRevivalPlayer(fixture.beforeMainRevival, fixture.payer);
  assert.deepEqual(forceRevivalQuote(fixture.beforeMainRevival, payer, fixture.pricing.revival.amount),
    { free: 1, normalCost: 6, cost: 6 });
  assert.deepEqual(fixture.pricing.revival, { amount: 4, free: 1, cost: 6 });
  // Without the card the ordinary cap refuses the same request on that state.
  const ordinaryOnly = structuredClone(fixture.atRevival);
  assert.throws(() => applyAction(ordinaryOnly, fixture.payer, { type: 'revive', amount: 4 }));
  // The payer's charge is exactly the quote and its counters move as quoted.
  const after = independentSkillsRevivalPlayer(fixture.afterRevival, fixture.payer);
  assert.equal(spiceOf(fixture.beforeMainRevival, fixture.payer) - after.spice, fixture.pricing.revival.cost);
  assert.equal(after.tanks, beforeRecruits.tanks - fixture.pricing.revival.amount);
  assert.equal(after.reserves, beforeRecruits.reserves + fixture.pricing.revival.amount);
  assert.equal(after.revived, 1 + fixture.pricing.revival.amount);
  assert.equal(after.freeForcesRevived, 1 + fixture.pricing.revival.free);
  assertIndependentSkillsRevivalInventory(fixture.afterRevival);
});

void test('the real revival leaves one unavailable Banker spice that the Mentat Pause credits exactly once', () => {
  const fixture = createIndependentSkillsRevivalFixture();
  const view = viewGame(fixture.afterRevival, fixture.owner).spiceBankerIncome!;
  assert.deepEqual(view.deferred, [{ owner: fixture.owner, amount: 1 }]);
  assert.deepEqual(view.usedThisPhase, [fixture.owner]);
  // Exactly one qualifying Bank payment was recorded, with its real legs.
  const granted = fixture.afterRevival.spiceBankerIncome!.sources.filter(source => source.grant);
  assert.equal(granted.length, 1);
  assert.equal(granted[0].source.kind, 'force-revival');
  assert.deepEqual(granted[0].source.bankLegs, [{ payer: fixture.payer, amount: fixture.pricing.revival.cost }]);
  assert.equal(granted[0].grant!.owner, fixture.owner);
  assert.equal(granted[0].grant!.amount, fixture.grant.deferred);
  // The spice is in front of the shield: the wallet cannot advance early.
  assert.equal(spiceOf(fixture.afterRevival, fixture.owner), spiceOf(fixture.beforeMainRevival, fixture.owner));
  assert.equal(spiceOf(fixture.atMentat2, fixture.owner), spiceOf(fixture.beforeMainRevival, fixture.owner));
  assert.deepEqual(viewGame(fixture.atMentat2, fixture.owner).spiceBankerIncome?.deferred,
    [{ owner: fixture.owner, amount: 1 }]);
  // The actual Mentat Pause pays it once and clears the ledger.
  assert.deepEqual(viewGame(fixture.afterMentat, fixture.owner).spiceBankerIncome?.deferred, []);
  assert.deepEqual(viewGame(fixture.afterMentat, fixture.owner).spiceBankerIncome?.usedThisPhase, []);
  assert.equal(spiceOf(fixture.afterMentat, fixture.owner) - spiceOf(fixture.atMentat2, fixture.owner),
    fixture.grant.deferred, 'Exactly the deferred spice arrives, once');
  assertIndependentSkillsRevivalInventory(fixture.afterMentat);
});

void test('a free-only or below-threshold real revival on the same state earns no Bank income', () => {
  const fixture = createIndependentSkillsRevivalFixture();
  for (const control of fixture.controls) {
    assert.ok(control.paid < 4, `${control.label}: the payer stays below the Bank threshold`);
    assert.equal(control.game.spiceBankerIncome!.sources.filter(source => source.grant).length, 0,
      `${control.label}: no Banker income may be earned`);
    assert.deepEqual(viewGame(control.game, fixture.owner).spiceBankerIncome?.deferred, []);
    assert.deepEqual(viewGame(control.game, fixture.owner).spiceBankerIncome?.usedThisPhase, []);
  }
  const freeOnly = fixture.controls.find(control => control.revivalAction.amount === 2)!;
  assert.equal(freeOnly.paid, 0);
  const returned = independentSkillsRevivalPlayer(freeOnly.game, fixture.payer);
  assert.equal(returned.tanks, 3);
  assert.equal(returned.freeForcesRevived, 2, 'Both returned forces really came from the doubled free rate');
  const below = fixture.controls.find(control => control.revivalAction.amount === 3)!;
  assert.equal(below.paid, 2);
  assert.equal(independentSkillsRevivalPlayer(below.game, fixture.payer).tanks, 2);
});

void test('the Advanced programme preserves real paid revival and deferred Banker collection', () => {
  const basic = createIndependentSkillsRevivalFixture();
  const advanced = createIndependentSkillsRevivalFixture({ advanced: true });
  // The covered revival and Banker mechanics are mode-independent.
  assert.deepEqual(advanced.pricing, basic.pricing);
  assert.deepEqual(advanced.grant, basic.grant);
  assert.deepEqual(advanced.physical, basic.physical);
  assert.equal(spiceOf(advanced.afterRevival, advanced.owner),
    spiceOf(advanced.beforeMainRevival, advanced.owner));
  assert.equal(spiceOf(advanced.afterMentat, advanced.owner) -
    spiceOf(advanced.atMentat2, advanced.owner), advanced.grant.deferred);
  assert.deepEqual(viewGame(advanced.afterMentat, advanced.owner).spiceBankerIncome?.deferred, []);
  assertIndependentSkillsRevivalInventory(advanced.afterMentat);
});
