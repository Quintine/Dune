import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createTruthtranceEarlyAdvancedShipmentFixture as fixture, actTruthtranceEarlyAdvancedShipment as act,
  advanceTruthtranceEarlyAdvancedShipment as advance, finishTruthtranceEarlyAdvancedShipment as finish,
  truthtranceEarlyAdvancedShipmentClean as clean, truthtranceEarlyAdvancedShipmentPlayer as player,
  truthtranceEarlyAdvancedShipmentInventory as inventory, truthtranceEarlyAdvancedShipmentPhysical as physical,
  type TruthtranceEarlyAdvancedShipmentFixture,
} from './fixture-truthtrance-early-advanced-shipment';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: TruthtranceEarlyAdvancedShipmentFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.deepEqual(f.setup.expansions, []);
  assert.ok(!f.setup.homeworlds && !f.setup.nexusCards && !f.setup.leaderSkills && !f.setup.techTokens &&
    !f.setup.strongholdCards && !f.setup.discoveryEnabled && !f.setup.ecazTreachery);
  assert.ok(f.actions.some(step => step.actor === f.lobby.host && step.action.type === 'start' && step.action.advancedPreview === true));
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(player => player.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.asker).hand.some(card => card.id === f.card && card.effect === 'truthtrance'));
  assert.ok(player(f.afterSetup, f.counterHolder).hand.some(card => card.id === f.karama && card.effect === 'karama'));
  assert.ok(player(f.afterSetup, f.target).hand.some(card => card.id === f.baliset && card.name === 'Baliset'));
  assert.equal(player(f.game, f.target).spice, 10); assert.equal(player(f.game, f.target).reserves, 20);
  assert.deepEqual(player(f.game, f.target).forces, {}); assert.equal(player(f.game, f.target).tanks, 0);
  assert.equal(player(f.game, f.target).shipped, false); assert.equal(player(f.game, f.target).moved, 0);
  assert.equal(f.game.turn, 1); assert.equal(f.game.phase, f.phaseNumber); assert.ok(clean(f.game));
  assert.equal(f.game.truthtrance ?? null, null); assert.equal(f.game.shipmentPromises, undefined);
  assert.equal(f.originalInventory.length, 33); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.deepEqual(physical(f.game), f.originalPhysical); assert.equal(f.sourceActionCount, f.actions.length);
  if (f.phase === 'storm') assert.deepEqual(f.game.stormDials, {});
  else {
    assert.equal(f.actions.filter(step => step.action.type === 'stormDial').length, 2);
    assert.equal(f.game.spiceSequence ?? null, null);
    assert.ok(f.game.spiceDiscard[0].some(card => 'territory' in card));
    assert.ok(f.game.spiceDiscard[1].some(card => 'territory' in card));
  }
}
function asked(f: TruthtranceEarlyAdvancedShipmentFixture) {
  const actions: { actor: string; action: Action }[] = [];
  let game = act(structuredClone(f.game), f.declarationStep.actor, f.declarationStep.action, actions);
  const declared = structuredClone(game);
  game = advance(game, state => state.truthtrance?.stage === 'ask', actions);
  assert.ok(viewGame(game, f.asker).truthShipmentTargets.includes(f.target));
  const beforeQuestion = structuredClone(game);
  game = act(game, f.askStep.actor, f.askStep.action, actions);
  assert.equal(game.truthtrance?.stage, 'answer');
  assert.ok(viewGame(game, f.target).truthShipmentAnswers?.includes('yes'));
  assert.ok(viewGame(game, f.target).truthShipmentAnswers?.includes('no'));
  return { game, declared, beforeQuestion, actions };
}
function bound(f: TruthtranceEarlyAdvancedShipmentFixture, answer: 'yes' | 'no' = 'yes') {
  const question = asked(f), game = act(question.game, f.target, { type: 'truthAnswer', answer }, question.actions);
  assert.equal(game.truthtrance ?? null, null); assert.equal(game.shipmentPromises?.length, 1);
  assert.equal(game.shipmentPromises![0].player, f.target);
  assert.equal(game.shipmentPromises![0].answer, answer === 'yes');
  assert.equal(game.shipmentPromises![0].released, undefined);
  assert.equal(game.shipmentPromises![0].fulfilled, undefined);
  assert.equal(game.phase, f.phaseNumber); assert.deepEqual(physical(game), f.originalPhysical);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const phase of ['storm', 'charity', 'bidding'] as const) void test(
  `public Advanced ${phase} Truthtrance binds an eight-force future shipment without granting an early action`, () => {
    const f = fixture({ phase }); nativeSource(f); const game = bound(f);
    const view = viewGame(game, f.target);
    assert.equal(view.shipmentCompletion, null); assert.equal(view.shipmentPreparation, null);
    reject(game, f.target, f.shipment); reject(game, f.target, { type: 'endMovement' });
    reject(game, f.target, f.bigBribe);
    assert.equal(game.shipmentPromises![0].released, undefined);
  });

for (const guildTake of [false, true]) void test(
  `public Advanced early shipment Yes retains purchase2 and native Guild ${guildTake ? 'TAKE' : 'WAIT'} through actual eight-force delivery`, () => {
    const f = fixture(); nativeSource(f); const game = bound(f);
    const completed = finish(f, game, { guildTake });
    reject(completed.purchase.before, f.target, f.bigBid);
    assert.equal(player(completed.purchase.before, f.target).spice, 10);
    assert.equal(player(completed.purchase.after, f.target).spice, 8);
    assert.ok(player(completed.purchase.after, f.target).hand.some(card => card.id === f.purchaseCard));
    assert.equal(completed.purchase.after.shipmentPromises![0].released, undefined);
    assert.ok(completed.timing.some(record => record.steps.some(step => step.actor === f.guild &&
      step.action.type === 'decision' && step.action.take === guildTake)));
    if (guildTake) {
      assert.equal(completed.guildTurn.length, 1);
      assert.deepEqual(completed.guildTurn[0].steps, [{ actor: f.guild, action: { type: 'endMovement' } }]);
    } else assert.equal(completed.guildTurn.length, 0);
    assert.equal(completed.beforeShipment.active, f.target);
    assert.equal(viewGame(completed.beforeShipment, f.target).shipmentCompletion?.actions.at(-1)?.amount, 8);
    assert.ok(completed.shipment.controls.some(control => control.decision?.kind === 'guildShipment'));
    assert.ok(completed.shipment.controls.some(control => control.response?.kind === 'guildIncome'));
    assert.equal(player(completed.delivered, f.guild).spice, player(completed.beforeShipment, f.guild).spice + 8);
    assert.equal(player(completed.delivered, f.target).spice, 0);
    assert.equal(player(completed.delivered, f.target).forces[f.location], 8);
    assert.equal(player(completed.delivered, f.target).reserves, 12);
    assert.equal(completed.delivered.shipmentPromises![0].fulfilled, true);
    assert.equal(completed.delivered.shipmentPromises![0].released, undefined);
    assert.ok(player(completed.game, f.counterHolder).hand.some(card => card.id === f.karama));
    assert.equal(completed.game.discard.filter(card => card.id === f.card).length, 1);
    reject(completed.delivered, f.target, f.shipment);
    assert.deepEqual(inventory(completed.game), f.originalInventory);
  });

void test('public Advanced early shipment No allows voluntary costs and a real smaller Carthag shipment', () => {
  const f = fixture({ phase: 'bidding' }); nativeSource(f); const game = bound(f, 'no');
  const voluntary = act(structuredClone(game), f.target, f.bigBribe);
  assert.equal(player(voluntary, f.target).spice, 7); assert.equal(voluntary.shipmentPromises![0].released, undefined);
  const completed = finish(f, game, { amount: 7, guildTake: true });
  reject(completed.beforeShipment, f.target, f.shipment);
  assert.equal(player(completed.delivered, f.target).forces[f.location], 7);
  assert.equal(player(completed.delivered, f.target).spice, 1);
  assert.equal(completed.delivered.shipmentPromises![0].fulfilled, true);
  assert.equal(completed.delivered.shipmentPromises![0].released, undefined);
  assert.deepEqual(inventory(completed.game), f.originalInventory);
});

void test('an actual first Storm releases an early Advanced shipment only after its current-board route becomes unavailable', () => {
  const f = fixture({ phase: 'storm' }); nativeSource(f); let game = bound(f);
  const initialStorm = game.storm, distance = (f.sector - initialStorm + 18) % 18;
  assert.ok(distance > 0 && distance <= 20); assert.equal(game.stormDialers.length, 2);
  for (const [index, actor] of game.stormDialers.entries())
    game = act(game, actor, { type: 'stormDial', amount: index === 0 ? distance : 0 });
  assert.equal(game.storm, initialStorm); assert.equal(game.stormPending, distance);
  assert.equal(game.shipmentPromises![0].released, undefined, 'Recorded future distance is not a future-board promise prediction');
  game = advance(game, state => state.phase === 2 && clean(state));
  assert.equal(game.storm, f.sector); assert.equal(game.shipmentPromises![0].released, true);
  const spent = act(game, f.target, f.bigBribe);
  assert.equal(player(spent, f.target).spice, 7);
  assert.deepEqual(inventory(spent), f.originalInventory);
});

void test('the genuine early Advanced Truth question rejects foreign and underlying replies before its native answer', () => {
  const f = fixture(), question = asked(f), game = question.game;
  reject(game, f.asker, { type: 'truthAnswer', answer: 'yes' });
  reject(game, f.target, { type: 'ready' }); reject(game, f.target, f.shipment);
  reject(game, f.target, f.bigBribe); reject(game, f.asker, f.askStep.action);
  const done = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  reject(done, f.target, { type: 'truthAnswer', answer: 'yes' });
  reject(done, f.asker, f.askStep.action);
  assert.deepEqual(physical(done), f.originalPhysical); assert.deepEqual(inventory(done), f.originalInventory);
});

void test('all four minimal policies participate legally in the actual early Advanced bid while retaining shipment funds', () => {
  const f = fixture(), boundGame = bound(f);
  const game = advance(boundGame, state => state.phase === 3 && clean(state) && state.auction?.active === f.target);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.target); view.players.find(player => player.id === f.target)!.bot = difficulty;
    const before = structuredClone(view), action = botActions(view)[0]; assert.ok(action, difficulty);
    assert.deepEqual(view, before);
    const done = act(structuredClone(game), f.target, action);
    assert.equal(done.shipmentPromises![0].released, undefined);
    assert.ok(player(done, f.target).spice >= 8);
    assert.deepEqual(inventory(done), f.originalInventory);
  }
});
