import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { choamPowerPlays } from '../game/choam-power-options';
import {
  allowSemutaNexusCunning, gamePlayer, reactSemutaNexusCunning,
  semutaNexusCunningInventory,
} from './fixture-semuta-nexus-cunning';
import {
  cancelSemutaNexusCunningReactive, createSemutaNexusCunningReactive,
  quoteSemutaNexusCunningReactive, semutaNexusCunningReactiveBoard,
  type SemutaNexusCunningReactiveEffect, type SemutaNexusCunningReactiveFixture,
} from './fixture-semuta-nexus-cunning-reactive';

const holds = (game: Game, id: string, card: string) =>
  gamePlayer(game, id).hand.some(candidate => candidate.id === card);
const nexusSpent = (game: Game, owner: string) =>
  game.nexusCards?.cards?.discard.filter(id => id === 'choam').length === 1 &&
  game.nexusCards?.cards?.hands[owner] === null;
/** Declare the original private Cunning quote and resolve its ordinary response. */
function declareAndAllow(f: SemutaNexusCunningReactiveFixture) {
  const request = quoteSemutaNexusCunningReactive(f.game, f);
  const declared = applyAction(f.game, f.owner, request);
  return { request, declared, offered: allowSemutaNexusCunning(declared) };
}
function assertPrivateFuel(f: SemutaNexusCunningReactiveFixture, declared: Game, request: Action) {
  assert.equal(f.cost.kind, 'projectile');
  const pending = declared.pendingChoamWorthless;
  assert.equal(declared.response?.kind, 'choamWorthless');
  assert.equal(pending?.card, f.cost.id);
  assert.equal(pending?.nexusEvent, request.nexus);
  assert.equal(pending?.owner, f.owner);
  assert.equal(nexusSpent(declared, f.owner), true);
  // The other seats see neither the private cost list nor the chosen fuel.
  assert.equal(viewGame(declared, f.target).choamWorthless, null);
  assert.equal(viewGame(declared, f.other).choamWorthless, null);
  assert.equal(JSON.stringify(viewGame(declared, f.target)).includes(f.cost.id), false);
  assert.equal(viewGame(declared, f.holder).semutaReaction, null);
}

void test('reactive Baliset Cunning keeps canonical fuel private until Commit and stops the declared move', () => {
  const f = createSemutaNexusCunningReactive('baliset', { karama: true });
  const mover = gamePlayer(f.game, f.target);
  const source = Object.keys(mover.forces)[0];
  assert.equal(mover.forces[source], 2);
  assert.equal(mover.moved, 0);
  const plays = choamPowerPlays(viewGame(f.game, f.owner), 'baliset');
  const nexus = plays.find(play => play.source === 'nexus' && play.card.id === f.cost.id);
  assert.ok(nexus && !nexus.blocked);
  assert.equal(nexus.card.kind, 'projectile');
  assert.equal(plays.some(play => play.source === 'printed'), false);
  const { request, declared, offered } = declareAndAllow(f);
  assertPrivateFuel(f, declared, request);
  assert.equal(declared.pendingChoamWorthless?.movement, true);
  assert.equal(offered.response, null);
  assert.equal(offered.decision, null);
  assert.equal(offered.pendingChoamMove, null);
  assert.equal(offered.nexusChoamLast?.stage, 'complete');
  assert.equal(offered.pendingTreacheryDiscard?.batch.entries.length, 1);
  assert.equal(offered.pendingTreacheryDiscard?.batch.entries[0].card.id, f.cost.id);
  assert.equal(offered.pendingTreacheryDiscard?.batch.entries[0].publicFace, false);
  assert.equal(offered.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  // The private cost face remains unavailable before commitment.
  assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(viewGame(offered, f.holder).semutaReaction?.candidates, []);
  const cards = semutaNexusCunningInventory(offered);
  const claimed = reactSemutaNexusCunning(offered, f.start, true);
  const passed = reactSemutaNexusCunning(offered, f.start, false);
  for (const settled of [claimed, passed]) {
    assert.equal(settled.pendingTreacheryDiscard, null);
    assert.equal(settled.pendingChoamMove, null);
    assert.equal(settled.nexusChoamLast?.stage, 'complete');
    assert.deepEqual(settled.choamBaliset, [{ turn: settled.turn, player: f.target, territory: f.territory }]);
    assert.equal(viewGame(settled, f.target).balisetRestrictions.length, 1);
    assert.deepEqual(semutaNexusCunningInventory(settled), cards);
    // The stopped movement spends no force, movement allowance or spice.
    assert.deepEqual(semutaNexusCunningReactiveBoard(settled), semutaNexusCunningReactiveBoard(f.game));
    assert.equal(gamePlayer(settled, f.target).forces[source], 2);
    assert.equal(gamePlayer(settled, f.target).moved, 0);
    assert.equal(nexusSpent(settled, f.owner), true);
    assert.equal(holds(settled, f.owner, f.cost.id), false);
    assert.throws(() => applyAction(settled, f.target, f.parent), /Baliset prevents/);
    assert.throws(() => reactSemutaNexusCunning(settled, f.start, true));
  }
  // The single foreign claim takes the actual discarded fuel; the decline does not.
  assert.equal(holds(claimed, f.holder, f.cost.id), true);
  assert.equal(claimed.discard.some(card => card.id === f.semuta), true);
  assert.equal(holds(claimed, f.holder, f.semuta), false);
  assert.equal(passed.discard.some(card => card.id === f.cost.id), true);
  assert.equal(holds(passed, f.holder, f.semuta), true);
});

void test('reactive La La La Cunning stops the free revival and leaves tanks, allowances and payment untouched', () => {
  const f = createSemutaNexusCunningReactive('laLaLa', { karama: true });
  const target = gamePlayer(f.game, f.target);
  assert.equal(target.tanks, 3);
  assert.equal(target.reserves, 17);
  assert.ok(f.game.pendingRevival);
  const { request, declared, offered } = declareAndAllow(f);
  assertPrivateFuel(f, declared, request);
  assert.equal(declared.pendingChoamWorthless?.revival, true);
  assert.equal(declared.pendingChoamWorthless?.target, f.target);
  assert.equal(offered.nexusChoamLast?.stage, 'complete');
  assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(viewGame(offered, f.holder).semutaReaction?.candidates, []);
  const cards = semutaNexusCunningInventory(offered);
  const claimed = reactSemutaNexusCunning(offered, f.start, true);
  const passed = reactSemutaNexusCunning(offered, f.start, false);
  for (const settled of [claimed, passed]) {
    assert.equal(settled.pendingTreacheryDiscard, null);
    assert.equal(settled.pendingRevival, null);
    assert.equal(settled.decision, null);
    assert.equal(settled.nexusChoamLast?.stage, 'complete');
    assert.deepEqual(semutaNexusCunningReactiveBoard(settled), semutaNexusCunningReactiveBoard(f.game));
    assert.equal(viewGame(settled, f.target).revivalRules?.freeBlocked?.includes(f.target), true);
    assert.deepEqual(semutaNexusCunningInventory(settled), cards);
    assert.equal(nexusSpent(settled, f.owner), true);
    assert.throws(() => reactSemutaNexusCunning(settled, f.start, true));
    // The original parent continues once: the ordinary paid revival still works.
    const paid = applyAction(settled, f.target, { type: 'revive', amount: 2 });
    assert.equal(paid.response, null);
    assert.equal(gamePlayer(paid, f.target).spice, target.spice - 4);
    assert.equal(gamePlayer(paid, f.target).tanks, 1);
    assert.equal(gamePlayer(paid, f.target).reserves, 19);
    assert.equal(gamePlayer(paid, f.target).freeForcesRevived, 0);
  }
  assert.equal(holds(claimed, f.holder, f.cost.id), true);
  assert.equal(claimed.discard.some(card => card.id === f.semuta), true);
  assert.equal(passed.discard.some(card => card.id === f.cost.id), true);
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced card' : 'Basic dialed'} reactive Jubba Cunning protects forces in one crossed territory without protecting spice`, () => {
  const f = createSemutaNexusCunningReactive('jubba', { advanced, karama: true });
  const protectedKey = f.crossed.find(entry => entry.territory === f.territory)!.key;
  const otherKey = f.crossed.find(entry => entry.territory === f.otherTerritory)!.key;
  const owner = gamePlayer(f.game, f.owner);
  const target = gamePlayer(f.game, f.target);
  assert.equal(owner.forces[protectedKey], 3);
  assert.equal(owner.forces[otherKey], 3);
  assert.equal(target.forces[protectedKey], 2);
  assert.equal(target.forces[otherKey], 2);
  assert.equal(f.game.stormPending, f.distance);
  const { request, declared, offered } = declareAndAllow(f);
  assertPrivateFuel(f, declared, request);
  assert.equal(declared.pendingChoamWorthless?.storm, true);
  assert.equal(declared.pendingChoamWorthless?.location, f.territory);
  assert.equal(offered.nexusChoamLast?.stage, 'complete');
  assert.ok(offered.stormResolution, 'The real storm stays untraversed behind its cost offer');
  assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(viewGame(offered, f.holder).semutaReaction?.candidates, []);
  const cards = semutaNexusCunningInventory(offered);
  const claimed = reactSemutaNexusCunning(offered, f.start, true);
  const passed = reactSemutaNexusCunning(offered, f.start, false);
  const arrived = ((f.before.storm + f.distance - 1) % 18) + 1;
  for (const settled of [claimed, passed]) {
    assert.equal(settled.pendingTreacheryDiscard, null);
    assert.equal(settled.nexusChoamLast?.stage, 'complete');
    // The one protected territory is recorded and the real storm pauses for the
    // remaining original CHOAM choice rather than resolving early.
    assert.equal(settled.stormResolution?.choamProtected?.includes(f.territory!), true);
    const remaining = settled.decision?.kind === 'choamStorm'
      ? settled.decision.territories.map(entry => entry.territory) : [];
    assert.deepEqual(remaining, [f.otherTerritory]);
    const continued = settled.decision?.kind === 'choamStorm'
      ? applyAction(settled, f.owner, { type: 'decision', decline: true })
      : settled;
    assert.equal(continued.stormResolution, null);
    assert.equal(continued.storm, arrived);
    assert.equal(gamePlayer(continued, f.owner).forces[protectedKey], 3);
    assert.equal(gamePlayer(continued, f.owner).forces[otherKey], undefined);
    assert.equal(gamePlayer(continued, f.owner).tanks, 3);
    assert.equal(gamePlayer(continued, f.target).forces[protectedKey], undefined);
    assert.equal(gamePlayer(continued, f.target).forces[otherKey], undefined);
    assert.equal(gamePlayer(continued, f.target).tanks, 4);
    assert.equal(continued.spice[protectedKey], undefined, 'Jubba protects CHOAM forces, not spice under the storm');
    assert.equal(continued.spice[otherKey], undefined);
    assert.deepEqual(semutaNexusCunningInventory(continued), cards);
    assert.equal(nexusSpent(continued, f.owner), true);
    assert.throws(() => reactSemutaNexusCunning(settled, f.start, true));
  }
  assert.equal(holds(claimed, f.holder, f.cost.id), true);
  assert.equal(claimed.discard.some(card => card.id === f.semuta), true);
  assert.equal(passed.discard.some(card => card.id === f.cost.id), true);
});

void test('canceling reactive Cunning retains the canonical fuel and resumes its original parent without offering that fuel', () => {
  for (const effect of ['baliset', 'laLaLa', 'jubba'] as SemutaNexusCunningReactiveEffect[]) {
    const f = createSemutaNexusCunningReactive(effect, { karama: true });
    const request = quoteSemutaNexusCunningReactive(f.game, f);
    const declared = applyAction(f.game, f.owner, request);
    assert.equal(declared.pendingChoamWorthless?.nexusEvent, request.nexus);
    let canceled = cancelSemutaNexusCunningReactive(declared, f);
    for (let n = 0; canceled.pendingTreacheryDiscard && n < 30; n++) {
      assert.ok(!canceled.pendingTreacheryDiscard.batch.entries.some(entry => entry.card.id === f.cost.id));
      canceled = reactSemutaNexusCunning(canceled, f.start, false);
    }
    assert.equal(canceled.response, null);
    assert.equal(canceled.pendingChoamWorthless, null);
    assert.equal(canceled.nexusChoamLast?.stage, 'canceled');
    assert.equal(canceled.choamWorthlessBlocked?.cards.includes(f.cost.id), true);
    assert.equal(holds(canceled, f.owner, f.cost.id), true);
    assert.equal(canceled.discard.some(card => card.id === f.cost.id), false);
    assert.equal(nexusSpent(canceled, f.owner), true);
    assert.equal(choamPowerPlays(viewGame(canceled, f.owner), effect).some(play => play.source === 'nexus'), false);
    if (effect === 'baliset') {
      const moved = gamePlayer(canceled, f.target);
      assert.equal(moved.moved, 1);
      assert.equal(moved.forces[f.destination!], 1);
      assert.equal(moved.forces[f.origin!], 1);
      assert.equal(canceled.pendingChoamMove, null);
    } else if (effect === 'laLaLa') {
      const revived = gamePlayer(canceled, f.target);
      assert.equal(canceled.pendingRevival, null);
      assert.equal(revived.tanks, 1);
      assert.equal(revived.reserves, 19);
      assert.equal(revived.revived, 2);
      assert.equal(revived.spice, gamePlayer(f.game, f.target).spice);
    } else {
      const storm = canceled.decision?.kind === 'choamStorm' ? canceled.decision : null;
      assert.ok(storm, 'The prevented Jubba still leaves the original storm choice');
      const traversed = applyAction(canceled, f.owner, { type: 'decision', decline: true });
      assert.equal(traversed.stormResolution, null);
      const protectedKey = f.crossed.find(entry => entry.territory === f.territory)!.key;
      const otherKey = f.crossed.find(entry => entry.territory === f.otherTerritory)!.key;
      assert.equal(gamePlayer(traversed, f.owner).forces[protectedKey], undefined);
      assert.equal(gamePlayer(traversed, f.owner).forces[otherKey], undefined);
      assert.equal(gamePlayer(traversed, f.owner).tanks, 6);
      assert.equal(traversed.spice[protectedKey], undefined);
      assert.equal(traversed.spice[otherKey], undefined);
    }
  }
});
