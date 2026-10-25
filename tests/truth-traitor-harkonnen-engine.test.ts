import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { nexusTraitorBotActions, nexusTraitorReturnAction } from '../game/nexus-traitor-options';
import { createTruthTraitorHarkonnenFixture as fixture, actTruthTraitorHarkonnen as act,
  advanceTruthTraitorHarkonnen as advance, truthTraitorHarkonnenClean as clean,
  truthTraitorHarkonnenInventory as inventory } from './fixture-truth-traitor-harkonnen';
import { askTruthTraitorDecision as ask } from './fixture-truth-traitor-decision';

for (const canceled of [false, true]) void test(`native allied Harkonnen declaration fulfills Yes before its ${canceled ? 'prevented' : 'allowed'} effect`, () => {
  const f = fixture(); let g = ask(f.game, f.asker, f.truth, f.target);
  assert.ok(viewGame(g, f.target).truthTraitorAnswers!.includes('yes'));
  g = act(g, f.target, { type: 'truthAnswer', answer: 'yes' });
  const promise = g.battle!.traitorDecisionPromises![0];
  assert.equal(promise.beneficiary, f.beneficiary); assert.equal(promise.player, f.target);
  g = act(g, f.target, { type: 'traitorCall', call: true });
  assert.equal(g.response?.kind, 'harkonnenTraitor');
  assert.equal(g.battle!.traitorDecisionPromises![0].fulfilled, true);
  if (canceled) g = act(g, f.asker, { type: 'card', card: f.karama, mode: 'cancel' });
  else g = advance(g, clean);
  assert.equal(g.battle!.traitorCalls[f.target], !canceled);
  assert.equal(g.battle!.traitorDecisionPromises![0].fulfilled, true);
  assert.ok(!g.battle!.traitorDecisionPromises![0].released);
  assert.deepEqual(inventory(g), f.originalCards);
});

void test('native Cunning return retains a promised matching identity through Truthtrance and permits another original choice', () => {
  const f = fixture({ kind: 'cunning' });
  const returnHeld = f.returnHeld; assert.ok(returnHeld);
  let g = ask(f.game, f.asker, f.truth, f.target);
  g = act(g, f.target, { type: 'truthAnswer', answer: 'yes' });
  const view = viewGame(g, f.target), pending = view.nexusTraitors!.pending!;
  assert.ok(pending.choices.find(choice => choice.id === f.traitorHeld)?.blocked);
  assert.equal(nexusTraitorReturnAction(view, pending.event, [f.traitorHeld]), null);
  const before = structuredClone(g);
  assert.throws(() => act(g, f.target, returnHeld)); assert.deepEqual(g, before);
  const safe = nexusTraitorBotActions(view)[0]; assert.ok(safe); assert.notDeepEqual(safe, returnHeld);
  g = act(g, f.target, safe);
  assert.equal(g.nexusTraitorPending, null);
  g = act(g, f.target, { type: 'traitorCall', call: true });
  assert.equal(g.battle!.traitorDecisionPromises![0].fulfilled, true);
  assert.deepEqual(inventory(g), f.originalCards);
});

void test('native Cunning may return the matching identity after No without evading that declaration choice', () => {
  const f = fixture({ kind: 'cunning' }); let g = ask(f.game, f.asker, f.truth, f.target);
  assert.ok(f.returnHeld);
  g = act(g, f.target, { type: 'truthAnswer', answer: 'no' });
  assert.ok(!viewGame(g, f.target).nexusTraitors!.pending!.choices.find(choice => choice.id === f.traitorHeld)?.blocked);
  g = act(g, f.target, f.returnHeld);
  g = act(g, f.target, { type: 'traitorCall', call: false });
  assert.equal(g.battle!.traitorDecisionPromises![0].fulfilled, true);
});

void test('native fulfilled declaration survives a later Cunning return of its original matching identity', () => {
  const f = fixture({ kind: 'cunning' });
  let g = ask(f.beforeCunning, f.asker, f.truth, f.target);
  g = act(g, f.target, { type: 'truthAnswer', answer: 'yes' });
  g = act(g, f.target, { type: 'traitorCall', call: true });
  assert.equal(g.battle!.traitorDecisionPromises![0].fulfilled, true);
  const offer = viewGame(g, f.target).nexusTraitors!.offer!; assert.ok(!offer.blocked);
  g = act(g, f.target, { type: 'nexusTraitorDraw', mode: 'cunning', event: offer.event });
  const pending = viewGame(g, f.target).nexusTraitors!.pending!;
  assert.ok(!pending.choices.find(choice => choice.id === f.traitorHeld)?.blocked);
  const returned = nexusTraitorReturnAction(viewGame(g, f.target), pending.event, [f.traitorHeld]); assert.ok(returned);
  g = act(g, f.target, returned);
  assert.equal(g.battle!.traitorCalls[f.target], true);
  assert.equal(g.battle!.traitorDecisionPromises![0].fulfilled, true);
});
