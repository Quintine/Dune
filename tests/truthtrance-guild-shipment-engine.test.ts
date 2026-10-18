import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import {
  actTruthtranceGuildShipment, advanceTruthtranceGuildShipment, askTruthtranceGuildShipment,
  completeTruthtranceGuildShipment, createTruthtranceGuildShipmentFixture,
  truthtranceGuildShipmentClean, truthtranceGuildShipmentPlayer as player,
  type TruthtranceGuildShipmentFixture,
} from './fixture-truthtrance-guild-shipment';

function source(f: TruthtranceGuildShipmentFixture) {
  assert.equal(f.game.advanced, true);
  assert.deepEqual(f.game.expansions, []);
  assert.ok(!f.game.techTokens && !f.game.strongholdCards && !f.game.homeworlds && !f.game.nexusCards);
  assert.ok(!f.game.leaderSkills && !f.game.discoveryEnabled);
  assert.ok(f.actions.some(step => step.actor === f.game.host && step.action.type === 'start' && step.action.advancedPreview === true));
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 3).map(card => card.id), [f.card, f.rateKarama, f.guildKarama]);
  assert.ok(player(f.afterSetup, f.asker).hand.some(card => card.id === f.card && card.effect === 'truthtrance'));
  assert.ok(player(f.afterSetup, f.rateCanceler).hand.some(card => card.id === f.rateKarama));
  assert.ok(player(f.afterSetup, f.guild).hand.some(card => card.id === f.guildKarama));
  assert.notEqual(f.guildKarama, f.rateKarama);
  assert.equal(f.game.phase, 5);
  assert.equal(f.game.active, f.target);
  assert.equal(player(f.game, f.target).shipped, false);
  assert.equal(player(f.game, f.target).moved, 0);
  assert.equal(f.game.guildTimingLocked, false);
  assert.equal(viewGame(f.game, f.asker).truthShipmentSupported, true);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function bound(f: TruthtranceGuildShipmentFixture, result: ReturnType<typeof completeTruthtranceGuildShipment>) {
  assert.ok(viewGame(result.binding.asked, f.target).truthShipmentAnswers!.includes('yes'));
  assert.equal(result.binding.game.truthtrance, null);
  assert.equal(result.binding.game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(result.binding.game.shipmentPromises, [{
    turn: f.game.turn, player: f.target, asker: f.asker,
    territory: 'carthag', minimum: 3, answer: true,
  }]);
  assert.equal(result.declaration.game.decision?.kind, 'guildShipment');
  assert.equal(result.declaration.game.pendingShipment!.elite, f.target === 'emperor' ? 1 : 0);
  assert.deepEqual(result.declaration.game.players.map(player => ({ spice: player.spice, reserves: player.reserves,
    forces: player.forces, elites: player.elites })), result.binding.game.players.map(player => ({ spice: player.spice,
    reserves: player.reserves, forces: player.forces, elites: player.elites })));
  assert.equal(result.declaration.game.shipmentPromises![0].fulfilled, undefined);
  assert.equal(result.declaration.game.shipmentPromises![0].released, undefined);
  assert.equal(viewGame(result.declaration.game, f.target).shipmentCompletion, null,
    'The permission decision has no concurrently executable completion guide');
  assert.equal(result.settled.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(result.game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(result.settled, f.target).shipped, true);
  assert.equal(player(result.settled, f.target).moved, 0);
  assert.equal(result.settled.pendingShipment, null);
  assert.equal(result.game.movementRemaining!.includes(f.target), false);
  assert.equal(result.actions.filter(step => step.actor === f.target && step.action.type === 'ship').length, 1);
  assert.equal(result.actions.filter(step => step.actor === f.target && step.action.type === 'endMovement').length, 1);
}

void test('genuine Advanced Guild WAIT and allowance deliver the promised typed reserve shipment with one native payment and fulfillment', () => {
  const f = createTruthtranceGuildShipmentFixture(); source(f);
  assert.ok(f.completedPrefix);
  assert.equal(f.timing.length, 2);
  assert.ok(f.timing.every(choice => choice.step.action.take === false));
  const result = completeTruthtranceGuildShipment(f, 'allow'); bound(f, result);
  assert.equal(player(result.binding.game, f.target).spice - player(result.settled, f.target).spice, 3);
  assert.equal(player(result.settled, f.guild).spice - player(result.binding.game, f.guild).spice, 3);
  assert.equal(player(result.binding.game, f.target).reserves - player(result.settled, f.target).reserves, 3);
  assert.equal(player(result.binding.game, f.target).elites!.reserves - player(result.settled, f.target).elites!.reserves, 1);
  assert.equal(player(result.settled, f.target).forces[f.location], 3);
  assert.equal(player(result.settled, f.target).elites!.forces[f.location], 1);
  assert.equal(result.settled.shipmentPromises![0].fulfilled, true);
  assert.equal(result.settled.shipmentPromises![0].released, undefined);
  assert.equal(player(result.settled, f.guild).specialKaramaUsed, undefined);
  assert.equal(result.settled.discard.some(card => card.id === f.guildKarama), false);
});

void test('genuine Guild special Karama stop consumes the promised opportunity without payment or arrival and publicly releases the impossible positive', () => {
  const f = createTruthtranceGuildShipmentFixture(); source(f);
  const result = completeTruthtranceGuildShipment(f, 'stop'); bound(f, result);
  assert.deepEqual(result.settled.players.map(player => ({ spice: player.spice, reserves: player.reserves,
    forces: player.forces, elites: player.elites })), result.binding.game.players.map(player => ({ spice: player.spice,
    reserves: player.reserves, forces: player.forces, elites: player.elites })));
  assert.equal(player(result.settled, f.target).forces[f.location], undefined);
  assert.equal(player(result.settled, f.guild).specialKaramaUsed, true);
  assert.equal(result.settled.discard.filter(card => card.id === f.guildKarama).length, 1);
  assert.equal(result.settled.shipmentPromises![0].released, true);
  assert.equal(result.settled.shipmentPromises![0].fulfilled, undefined);
  assert.equal(viewGame(result.settled, f.asker).shipmentPromises[0].released, true);
  assert.ok(result.settled.log.slice(result.binding.game.log.length)
    .some(entry => /Truthtrance.*no longer binding|Truthtrance.*released/i.test(entry.text)));
  assert.throws(() => actTruthtranceGuildShipment(result.settled, f.target, result.declaration.step.action));
  assert.throws(() => actTruthtranceGuildShipment(result.settled, f.guild, result.choice.action));
});

void test('genuine Guild TAKE reserve promise survives an actual opposing Karama rate cancellation and pays the funded full tariff once', () => {
  const f = createTruthtranceGuildShipmentFixture({ target: 'guild' }); source(f);
  assert.equal(f.timing.length, 1);
  assert.equal(f.timing[0].step.action.take, true);
  assert.equal(f.timing[0].declared.response?.kind, 'guildTiming');
  assert.ok(f.actions.some(step => step.actor === f.rateCanceler && step.action.type === 'passResponse'));
  assert.equal(f.game.guildTimingGranted, true);
  const halfRate = completeTruthtranceGuildShipment(f, 'allow'); bound(f, halfRate);
  assert.equal(player(halfRate.binding.game, f.target).spice - player(halfRate.settled, f.target).spice, 2);
  assert.equal(player(halfRate.settled, f.target).forces[f.location], 3);
  assert.equal(halfRate.settled.shipmentPromises![0].fulfilled, true);
  assert.ok(player(halfRate.settled, f.rateCanceler).hand.some(card => card.id === f.rateKarama));
  const result = completeTruthtranceGuildShipment(f, 'cancelRate'); bound(f, result);
  assert.ok(result.rate);
  assert.equal(result.rate.before.response?.kind, 'guildRate');
  assert.equal(result.rate.before.pendingShipment!.cost, 2, 'The actual original declaration earns the native half price');
  assert.equal(viewGame(result.rate.before, f.target).shipmentCompletion, null);
  assert.ok(viewGame(result.rate.before, f.rateCanceler).responseControls!.cancelCards.includes(f.rateKarama));
  assert.equal(player(result.binding.game, f.target).spice - player(result.settled, f.target).spice, 3);
  assert.equal(player(result.binding.game, f.target).reserves - player(result.settled, f.target).reserves, 3);
  assert.equal(player(result.settled, f.target).forces[f.location], 3);
  assert.equal(result.settled.shipmentPromises![0].fulfilled, true);
  assert.equal(result.settled.shipmentPromises![0].released, undefined);
  assert.equal(result.settled.discard.filter(card => card.id === f.rateKarama).length, 1);
  assert.equal(player(result.settled, f.guild).specialKaramaUsed, undefined);
  assert.ok(player(result.settled, f.guild).hand.some(card => card.id === f.guildKarama));
});

void test('all four minimal profiles answer the real shipment question and use authoritative legal completion through native Guild permission', () => {
  const f = createTruthtranceGuildShipmentFixture(), asked = askTruthtranceGuildShipment(f);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const targetView = viewGame(asked.game, f.target);
    targetView.players.find(player => player.id === f.target)!.bot = difficulty;
    const answer = botActions(targetView).find(action => action.type === 'truthAnswer'); assert.ok(answer);
    assert.ok(answer.answer === 'yes' || answer.answer === 'no' || answer.answer === 'unknown');
    assert.ok(targetView.truthShipmentAnswers!.includes(answer.answer));
    assert.equal(answer.answer, 'yes', 'The original funded stronghold predicate remains an ordinary positive policy choice');
    let game = actTruthtranceGuildShipment(structuredClone(asked.game), f.target, answer);
    const promised = viewGame(game, f.target);
    promised.players.find(player => player.id === f.target)!.bot = difficulty;
    const shipment = botActions(promised).find(action => action.type === 'ship'); assert.ok(shipment);
    assert.equal(shipment.territory, 'carthag');
    assert.ok(Number(shipment.amount) >= 3);
    game = actTruthtranceGuildShipment(game, f.target, shipment);
    assert.equal(game.decision?.kind, 'guildShipment');
    const guildView = viewGame(game, f.guild);
    guildView.players.find(player => player.id === f.guild)!.bot = difficulty;
    const permission = botActions(guildView).find(action => action.type === 'decision' && action.allow === true ||
      action.type === 'card' && action.mode === 'special' && action.card === f.guildKarama); assert.ok(permission);
    game = actTruthtranceGuildShipment(game, f.guild, permission);
    game = advanceTruthtranceGuildShipment(game,
      game => truthtranceGuildShipmentClean(game) && !game.pendingShipment);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(game, f.target).shipped, true);
    assert.ok(game.shipmentPromises![0].fulfilled || game.shipmentPromises![0].released);
  }
});
