import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, RuleError, viewGame } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { planetologistMoveDraft } from '../components/planetologist-movement';
import {
  advisorGatherPlayer, allowPlanetologistAdvisorGather, createPlanetologistAdvisorGatherFixture,
} from './fixture-planetologist-advisor-gather';

void test('a real mixed gather declares one native flip before either source moves, then arrives as fighters for one movement', () => {
  const f = createPlanetologistAdvisorGatherFixture();
  // Advisor first: simultaneous physical custody cannot depend on source order.
  const draft = planetologistMoveDraft(viewGame(f.game, f.owner), 'gather', 'arrakeen', 10,
    { 'imperial_basin:9': 1, 'carthag:11': 1 }, {});
  assert.equal(draft.blocked, null);
  assert.ok(draft.action);
  const before = advisorGatherPlayer(f.game), rival = advisorGatherPlayer(f.game, f.opponent);
  const pending = applyAction(f.game, f.owner, draft.action);
  const paused = advisorGatherPlayer(pending);
  assert.equal(pending.response?.kind, 'advisorFlip');
  assert.deepEqual(paused.forces, before.forces);
  assert.deepEqual(paused.advisors, before.advisors);
  assert.equal(paused.moved, before.moved);
  assert.equal(paused.shipped, before.shipped);
  assert.equal(paused.spice, before.spice);
  const done = allowPlanetologistAdvisorGather(pending), after = advisorGatherPlayer(done);
  assert.equal(after.forces['arrakeen:10'], 2);
  assert.equal(after.forces['carthag:11'] ?? 0, 0);
  assert.equal(after.forces['imperial_basin:9'] ?? 0, 0);
  assert.equal(isAdvisor(after, 'arrakeen'), false);
  assert.equal(after.moved, before.moved + 1);
  assert.equal(after.shipped, true);
  assert.equal(after.spice, before.spice);
  assert.equal(after.reserves, before.reserves);
  assert.equal(after.tanks, before.tanks);
  assert.deepEqual(advisorGatherPlayer(done, f.opponent).forces, rival.forces);
  assert.equal(advisorGatherPlayer(done, f.canceler).hand.filter(card => card.id === f.karama).length, 1,
    'Allowing the native flip does not spend the opponent’s physical counter.');
});

void test('one original Karama cancels the entire uncommitted mixed gather and a legal fighter-only replacement retains the movement', () => {
  const f = createPlanetologistAdvisorGatherFixture();
  const before = advisorGatherPlayer(f.game);
  const pending = applyAction(f.game, f.owner, f.action);
  const canceled = applyAction(pending, f.canceler, { type: 'card', card: f.karama, mode: 'cancel' });
  const stopped = advisorGatherPlayer(canceled);
  assert.deepEqual(stopped.forces, before.forces);
  assert.deepEqual(stopped.advisors, before.advisors);
  assert.equal(stopped.moved, before.moved);
  assert.equal(stopped.shipped, before.shipped);
  assert.equal(stopped.spice, before.spice);
  assert.equal(canceled.discard.filter(card => card.id === f.karama).length, 1);
  assert.ok(canceled.players.every(player => player.hand.every(card => card.id !== f.karama)));
  const snapshot = structuredClone(canceled);
  assert.throws(() => applyAction(canceled, f.owner, f.action), RuleError);
  assert.deepEqual(canceled, snapshot, 'An immediate repeated flip cannot bypass the spent Karama.');
  const retry = planetologistMoveDraft(viewGame(canceled, f.owner), 'gather', 'arrakeen', 10, f.forces, {});
  assert.equal(retry.action, null);
  const replacement = applyAction(canceled, f.owner, {
    type: 'move', from: 'carthag:11', amount: 1, territory: 'arrakeen', sector: 10,
  });
  const after = advisorGatherPlayer(replacement);
  assert.equal(after.forces['arrakeen:10'], 1);
  assert.equal(after.forces['imperial_basin:9'], 1);
  assert.equal(isAdvisor(after, 'imperial_basin'), true);
  assert.equal(isAdvisor(after, 'arrakeen'), false);
  assert.equal(after.moved, before.moved + 1);
  assert.equal(after.spice, before.spice);
  assert.equal(replacement.discard.filter(card => card.id === f.karama).length, 1);
});

void test('a genuine fresh accompanying advisor cannot use mixed gather to become a fighter during its arrival turn', () => {
  const f = createPlanetologistAdvisorGatherFixture({ fresh: true });
  const draft = planetologistMoveDraft(viewGame(f.game, f.owner), 'gather', 'arrakeen', 10, f.forces, {});
  assert.equal(draft.action, null);
  const snapshot = structuredClone(f.game);
  assert.throws(() => applyAction(f.game, f.owner, f.action), RuleError);
  assert.deepEqual(f.game, snapshot);
  assert.equal(advisorGatherPlayer(f.game).forces['imperial_basin:9'], 1);
  assert.equal(isAdvisor(advisorGatherPlayer(f.game), 'imperial_basin'), true);
  assert.equal(advisorGatherPlayer(f.game).moved, 0);
  assert.equal(advisorGatherPlayer(f.game, f.canceler).hand.filter(card => card.id === f.karama).length, 1);
});
