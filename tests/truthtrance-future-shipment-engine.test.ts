import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  actFutureShipment, advanceFutureShipment, askFutureShipment, completeFutureShipment,
  createFutureShipmentFixture, futureShipmentClean, futureShipmentPlayer as player,
  startFutureShipmentTarget, type FutureShipmentFixture,
} from './fixture-truthtrance-future-shipment';

const promise = (game: Game) => { assert.equal(game.shipmentPromises!.length, 1); return game.shipmentPromises![0]; };
function live(game: Game, target: string) {
  const held = promise(game);
  assert.equal(held.player, target);
  assert.equal(held.answer, true);
  assert.equal(held.fulfilled, undefined);
  assert.equal(held.released, undefined);
}
function source(f: FutureShipmentFixture) {
  assert.equal(f.game.advanced, f.advanced);
  assert.deepEqual(f.game.expansions, []);
  assert.ok(!f.game.techTokens && !f.game.strongholdCards && !f.game.homeworlds && !f.game.nexusCards &&
    !f.game.leaderSkills && !f.game.discoveryEnabled);
  assert.ok(f.actions.some(step => step.actor === f.game.host && step.action.type === 'start'));
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 5).map(card => card.id), f.deal);
  assert.ok(player(f.afterSetup, f.asker).hand.some(card => card.id === f.card && card.effect === 'truthtrance'));
  assert.ok(player(f.afterSetup, f.counterHolder).hand.some(card => card.id === f.karama && card.effect === 'karama'));
  assert.equal(player(f.afterSetup, f.counterHolder).hand.length, 2);
  assert.equal(f.game.phase, 5);
  assert.equal(f.game.active, f.asker);
  assert.notEqual(f.game.active, f.target);
  assert.ok(f.game.movementRemaining!.includes(f.target));
  assert.equal(player(f.game, f.target).shipped, false);
  assert.ok(viewGame(f.game, f.asker).truthShipmentTargets.includes(f.target));
  if (f.advanced) {
    assert.ok(f.initialWait);
    assert.equal(f.initialWait.step.action.take, false);
    assert.equal(f.initialWait.before.decision?.kind, 'guildTiming');
  }
  assert.equal(f.sourceActionCount, f.actions.length);
}
function completed(f: FutureShipmentFixture, result: ReturnType<typeof completeFutureShipment>) {
  assert.ok(viewGame(result.binding.asked, f.target).truthShipmentAnswers!.includes('yes'));
  live(result.binding.game, f.target);
  assert.equal(result.binding.game.active, f.asker);
  assert.equal(result.binding.game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(viewGame(result.binding.game, f.target).shipmentCompletion, null);
  assert.deepEqual(result.binding.game.movementRemaining, f.game.movementRemaining);
  assert.deepEqual(result.binding.game.order, f.game.order);
  for (const prefix of result.started.prefixes) {
    live(prefix.before, f.target); live(prefix.declared, f.target); live(prefix.afterShipment, f.target); live(prefix.afterEnd, f.target);
    assert.equal(player(prefix.before, prefix.shipment.actor).spice - player(prefix.afterShipment, prefix.shipment.actor).spice, 2);
    assert.equal(player(prefix.before, prefix.shipment.actor).reserves - player(prefix.afterShipment, prefix.shipment.actor).reserves, 1);
    assert.equal(prefix.afterEnd.movementRemaining!.includes(prefix.shipment.actor), false);
    assert.equal(viewGame(prefix.declared, f.target).shipmentCompletion, null);
  }
  for (const timing of result.started.timing) {
    live(timing.before, f.target); live(timing.declared, f.target); live(timing.after, f.target);
    assert.deepEqual(timing.before.order, timing.after.order);
  }
  live(result.beforeShipment, f.target);
  assert.equal(result.beforeShipment.active, f.target);
  assert.ok(viewGame(result.beforeShipment, f.target).shipmentCompletion);
  assert.throws(() => actFutureShipment(result.beforeShipment, f.target, { type: 'endMovement' }), /Truthtrance/i);
  assert.throws(() => actFutureShipment(result.beforeShipment, f.target,
    { ...result.shipment.action, amount: 2, elite: 0 }), /Truthtrance/i);
  const cost = f.target === f.guild ? 2 : 3;
  assert.equal(player(result.beforeShipment, f.target).spice - player(result.settled, f.target).spice, cost);
  assert.equal(player(result.beforeShipment, f.target).reserves - player(result.settled, f.target).reserves, 3);
  assert.equal(player(result.settled, f.target).forces[f.location], 3);
  assert.equal(player(result.settled, f.target).shipped, true);
  assert.equal(promise(result.settled).fulfilled, true);
  assert.equal(promise(result.settled).released, undefined);
  assert.equal(result.settled.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(result.game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(result.actions.filter(step => step.actor === f.target && step.action.type === 'ship').length, 1);
  assert.equal(result.game.movementRemaining!.includes(f.target), false);
  assert.deepEqual(result.game.order, f.game.order);
  assert.throws(() => actFutureShipment(result.settled, f.target, result.shipment.action));
}

for (const advanced of [false, true]) {
  void test(`genuine ${advanced ? 'Advanced' : 'Basic'} future Emperor promise survives another player's paid turn then fulfills its actual shipment once`, () => {
    const f = createFutureShipmentFixture({ advanced }); source(f);
    const result = completeFutureShipment(f); completed(f, result);
    assert.equal(result.started.prefixes.length, 1);
    assert.equal(result.started.prefixes[0].shipment.actor, f.asker);
    assert.equal(player(result.settled, f.asker).forces['imperial_basin:9'], 1);
    assert.equal(player(result.settled, f.guild).spice - player(result.beforeShipment, f.guild).spice, 3);
    assert.throws(() => actFutureShipment(result.binding.game, f.target, result.shipment.action));
    assert.throws(() => actFutureShipment(result.binding.game, f.target, { type: 'endMovement' }));
    if (advanced) {
      assert.equal(player(result.settled, f.target).elites!.forces[f.location], 1);
      assert.equal(player(result.beforeShipment, f.target).elites!.reserves - player(result.settled, f.target).elites!.reserves, 1);
      assert.equal(result.declared.decision?.kind, 'guildShipment');
      live(result.declared, f.target);
      assert.equal(viewGame(result.declared, f.target).shipmentCompletion, null);
      assert.deepEqual(result.started.timing.map(choice => choice.step.action.take), [false]);
    }
  });
}

void test('genuine future Guild mixed promise remains binding through WAIT and earlier paid turns before native TAKE and half-rate delivery', () => {
  const f = createFutureShipmentFixture({ target: 'guild', mixed: true }); source(f);
  const result = completeFutureShipment(f); completed(f, result);
  assert.equal(result.binding.asked.truthtrance!.question!.kind, 'mixedShipment');
  assert.ok(promise(result.binding.game).mixed);
  assert.deepEqual(result.started.prefixes.map(prefix => prefix.shipment.actor), ['atreides', 'emperor']);
  assert.deepEqual(result.started.timing.map(choice => choice.step.action.take), [false, true]);
  assert.equal(result.started.timing[0].after.active, 'emperor');
  assert.equal(result.started.timing[1].before.decision?.kind, 'guildTiming');
  if (result.started.timing[1].before.decision?.kind === 'guildTiming')
    assert.equal(result.started.timing[1].before.decision.next, 'harkonnen');
  assert.equal(result.started.timing[1].declared.response?.kind, 'guildTiming');
  assert.equal(result.started.timing[1].after.active, f.guild);
  assert.equal(result.started.timing[1].after.guildTimingGranted, true);
  assert.ok(result.started.actions.some(step => step.actor === f.counterHolder && step.action.type === 'passResponse'));
  assert.equal(player(result.beforeShipment, f.guild).spice - player(result.binding.game, f.guild).spice, 4);
  assert.equal(player(result.settled, 'emperor').forces['polar_sink:0'], 1);
  assert.equal(result.beforeShipment.movementRemaining!.includes('atreides'), false);
  assert.equal(result.beforeShipment.movementRemaining!.includes('emperor'), false);
  assert.ok(result.game.movementRemaining!.includes('harkonnen'));
  assert.equal(player(result.game, 'harkonnen').shipped, false);
  assert.equal(player(result.game, 'harkonnen').moved, 0);
});

void test('all four minimal profiles answer the actual future question without an early witness and ship legally only after the intervening native turn', () => {
  const f = createFutureShipmentFixture({ advanced: true }), asked = askFutureShipment(f);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const answerView = viewGame(asked.game, f.target);
    answerView.players.find(player => player.id === f.target)!.bot = difficulty;
    const answer = botActions(answerView).find(action => action.type === 'truthAnswer'); assert.ok(answer);
    assert.ok(answer.answer === 'yes');
    assert.ok(answerView.truthShipmentAnswers!.includes(answer.answer));
    const bound = actFutureShipment(structuredClone(asked.game), f.target, answer);
    live(bound, f.target);
    const waiting = viewGame(bound, f.target);
    waiting.players.find(player => player.id === f.target)!.bot = difficulty;
    assert.equal(waiting.shipmentCompletion, null);
    assert.equal(botActions(waiting).some(action => ['ship', 'guildShip', 'move', 'endMovement'].includes(action.type)), false);
    const started = startFutureShipmentTarget(f, bound), active = viewGame(started.game, f.target);
    active.players.find(player => player.id === f.target)!.bot = difficulty;
    const shipment = botActions(active).find(action => action.type === 'ship'); assert.ok(shipment);
    assert.equal(shipment.territory, 'sietch_tabr');
    assert.ok(Number(shipment.amount) >= 3);
    let game = actFutureShipment(started.game, f.target, shipment);
    game = advanceFutureShipment(game, game => futureShipmentClean(game) && !game.pendingShipment);
    assert.equal(promise(game).fulfilled, true);
    assert.equal(promise(game).released, undefined);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  }
});
