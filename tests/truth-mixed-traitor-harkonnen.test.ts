import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { nexusTraitorBotActions, nexusTraitorDrawAction, nexusTraitorReturnAction } from '../game/nexus-traitor-options';
import { truthFactAnswer } from '../game/truthtrance';
import { truthTraitorHarkonnenNexusInventory } from './fixture-truth-traitor-harkonnen';
import {
  actTruthMixedTraitor as act, bindTruthMixedTraitor as bind,
  createTruthMixedTraitorHarkonnenFixture as fixture, finishTruthMixedTraitor as finish,
  settleTruthMixedTraitor as settle, truthMixedTraitorCall as call,
  truthMixedTraitorFact as fact, truthMixedTraitorGroup as group,
  truthMixedTraitorInventory as inventory, truthMixedTraitorPlayer as player,
  truthMixedTraitorPromise as promise, truthMixedTraitorTraitors as traitors, voteTruthMixedTraitor as vote,
} from './fixture-truth-mixed-traitor';

function rejected(game: Game, actor: string, candidate: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, candidate)); assert.deepEqual(game, before);
}
function sourceInventory(game: Game, f: ReturnType<typeof fixture>) {
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
  assert.deepEqual(truthTraitorHarkonnenNexusInventory(game), f.originalNexusInventory);
}

void test('native remote allied Harkonnen mixed Reveal fulfills before its actual allowed or prevented effect', () => {
  const f = fixture(); assert.equal(f.sourceActionCount, 72); assert.equal(f.sourceActionCount, f.base.sourceActionCount);
  assert.deepEqual(f.game, f.base.game); assert.equal(f.game.nexusCards, undefined);
  assert.equal(player(f.game, f.target).ally, f.beneficiary);
  assert.ok(![f.game.battle!.attacker, f.game.battle!.defender].includes(f.target));
  assert.ok(viewGame(f.game, f.target).battle!.traitorVoters.includes(f.target));
  for (const canceled of [false, true]) {
    let game = bind(f).game; const native = game.battle!.traitorDecisionPromises![0];
    assert.equal(native.beneficiary, f.beneficiary); assert.equal(native.player, f.target);
    assert.equal(native.event, promise(game).event); assert.equal(promise(game).fulfilled, false);
    for (const actor of game.players.map(seat => seat.id)) {
      const view = viewGame(game, actor); assert.deepEqual(view.battle!.ownTraitorPromises, []);
      assert.equal(view.mixedTraitorPromises.length, actor === f.target ? 1 : 0);
    }
    rejected(game, f.target, { type: 'traitorCall', call: false });
    game = vote(game, f.target, true); assert.equal(game.response?.kind, 'harkonnenTraitor');
    assert.equal(game.battle!.traitorDecisionPromises![0].fulfilled, true);
    assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
    if (canceled) game = act(game, f.asker, { type: 'card', card: f.karama, mode: 'cancel' });
    else game = settle(game);
    assert.equal(game.battle!.traitorCalls[f.target], !canceled);
    assert.equal(promise(game).fulfilled, true); assert.equal(game.battle!.traitorDecisionPromises![0].fulfilled, true);
    game = finish(game, f); assert.equal(game.battle, null); assert.equal(promise(game).fulfilled, true);
    assert.equal(promise(game).released, false); assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
    sourceInventory(game, f);
  }
});

void test('native mixed Reveal over the original pending Cunning return protects the matching identity and resumes the exact parent', () => {
  const f = fixture({ kind: 'cunning' }); assert.equal(f.sourceActionCount, 77);
  assert.equal(f.sourceActionCount, f.base.sourceActionCount); assert.deepEqual(f.game, f.base.game);
  assert.ok(f.returnHeld && f.returnDrawn); const parent = structuredClone(f.game.nexusTraitorParent);
  const pendingEvent = f.game.nexusTraitorPending; assert.ok(pendingEvent && parent);
  const before = structuredClone(f.game); let game = bind(f).game; assert.deepEqual(f.game, before);
  assert.equal(game.nexusTraitorPending, pendingEvent); assert.deepEqual(game.nexusTraitorParent, parent);
  assert.equal(promise(game).fulfilled, false); assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [true]);
  const view = viewGame(game, f.target), pending = view.nexusTraitors!.pending!;
  assert.equal(pending.event, pendingEvent); assert.ok(pending.choices.find(choice => choice.id === f.traitorHeld)?.blocked);
  assert.equal(nexusTraitorReturnAction(view, pending.event, [f.traitorHeld]), null);
  rejected(game, f.target, f.returnHeld);
  const safe = nexusTraitorBotActions(view)[0]; assert.ok(safe); assert.notDeepEqual(safe, f.returnHeld);
  game = act(game, f.target, safe); assert.equal(game.nexusTraitorPending, null); assert.equal(game.nexusTraitorParent, null);
  assert.equal(game.battle!.event, f.event); assert.equal(game.battle!.revealed, true);
  assert.deepEqual(game.battle!.plans, f.game.battle!.plans); assert.deepEqual(game.battle!.traitorCalls, {});
  assert.ok(player(game, f.target).traitors.includes(f.traitorHeld)); assert.equal(promise(game).fulfilled, false);
  game = vote(game, f.target, true); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.battle!.traitorDeclarations![f.target].identity, f.traitorHeld);
  game = finish(game, f); assert.equal(promise(game).fulfilled, true); sourceInventory(game, f);
});

void test('native mixed decline permits the matching Cunning return with frozen facts and remains binding through an actual new draw', () => {
  const f = fixture({ kind: 'cunning' }), mixed = group('and', fact(f.heldFact), call(true));
  assert.ok(f.returnHeld); let game = bind(f, 'no', mixed).game;
  assert.equal(truthFactAnswer(player(game, f.target), f.heldFact), 'yes');
  assert.ok(!viewGame(game, f.target).nexusTraitors!.pending!.choices.find(choice => choice.id === f.traitorHeld)?.blocked);
  game = act(game, f.target, f.returnHeld);
  assert.equal(truthFactAnswer(player(game, f.target), f.heldFact), 'no');
  assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [false]);
  assert.deepEqual(promise(game).mixed, mixed); assert.equal(promise(game).fulfilled, false); assert.equal(promise(game).released, false);
  game = vote(game, f.target, false); assert.equal(promise(game).fulfilled, true); sourceInventory(finish(game, f), f);

  // Separate real branch starts before the original Cunning draw. No draw,
  // return, native vote or ledger is installed to create this composition.
  game = bind(f, 'no', mixed, f.beforeCunning).game;
  const offer = viewGame(game, f.target).nexusTraitors!.offer!;
  const draw = nexusTraitorDrawAction(viewGame(game, f.target), offer.event, 'cunning'); assert.ok(draw);
  game = act(game, f.target, draw); assert.ok(game.nexusTraitorPending);
  const afterDraw = viewGame(game, f.target), pending = afterDraw.nexusTraitors!.pending!;
  const drawn = pending.choices.filter(choice => choice.drawn).map(choice => choice.id); assert.equal(drawn.length, 1);
  const returned = nexusTraitorReturnAction(afterDraw, pending.event, drawn); assert.ok(returned);
  game = act(game, f.target, returned); assert.ok(player(game, f.target).traitors.includes(f.traitorHeld));
  assert.equal(truthFactAnswer(player(game, f.target), f.heldFact), 'yes');
  assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [false]);
  rejected(game, f.target, { type: 'traitorCall', call: true });
  game = vote(game, f.target, false); assert.equal(promise(game).fulfilled, true); sourceInventory(finish(game, f), f);
});

void test('native fulfilled mixed Reveal permits a later actual Cunning return without retracting its receipt or reopening the vote', () => {
  const f = fixture({ kind: 'cunning', window: 'beforeCunning' });
  assert.equal(f.sourceActionCount, f.base.beforeCunningActionCount); assert.equal(f.sourceActionCount + 1, f.base.sourceActionCount);
  assert.equal(f.actions.at(-1)!.action.type, 'battlePlan'); assert.equal(f.game.nexusTraitorPending ?? null, null);
  let game = bind(f).game; game = vote(game, f.target, true);
  assert.equal(promise(game).fulfilled, true); assert.equal(game.battle!.traitorCalls[f.target], true);
  const receipt = structuredClone(game.battle!.traitorDeclarations![f.target]); assert.equal(receipt.identity, f.traitorHeld);
  const offer = viewGame(game, f.target).nexusTraitors!.offer!; assert.ok(!offer.blocked);
  const draw = nexusTraitorDrawAction(viewGame(game, f.target), offer.event, 'cunning'); assert.ok(draw);
  game = act(game, f.target, draw); const view = viewGame(game, f.target), pending = view.nexusTraitors!.pending!;
  assert.ok(!pending.choices.find(choice => choice.id === f.traitorHeld)?.blocked);
  const returned = nexusTraitorReturnAction(view, pending.event, [f.traitorHeld]); assert.ok(returned);
  game = act(game, f.target, returned); assert.ok(!player(game, f.target).traitors.includes(f.traitorHeld));
  assert.equal(game.battle!.traitorCalls[f.target], true); assert.deepEqual(game.battle!.traitorDeclarations![f.target], receipt);
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, []);
  assert.ok(!viewGame(game, f.asker).truthMixedTraitorTargets.includes(f.target));
  rejected(game, f.target, { type: 'traitorCall', call: true });
  game = finish(game, f); assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  sourceInventory(game, f);
});
