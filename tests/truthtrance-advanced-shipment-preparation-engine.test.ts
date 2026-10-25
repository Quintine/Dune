import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { isAdvisor } from '../game/advisors';
import {
  createTruthtranceAdvancedShipmentPreparationFixture as fixture,
  askTruthtranceAdvancedShipmentPreparation as ask, actTruthtranceAdvancedShipmentPreparation as act,
  advanceTruthtranceAdvancedShipmentPreparation as advance, truthtranceAdvancedShipmentPreparationClean as clean,
  truthtranceAdvancedShipmentPreparationPlayer as player, truthtranceAdvancedShipmentPreparationInventory as inventory,
  type TruthtranceAdvancedShipmentPreparationFixture,
} from './fixture-truthtrance-advanced-shipment-preparation';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: TruthtranceAdvancedShipmentPreparationFixture) {
  assert.equal(f.initial.advanced, false); assert.notEqual(f.initial.status, 'playing');
  assert.deepEqual(f.rules.steps, [{ actor: f.asker, action: { type: 'rules', advanced: true } }]);
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.advancedPreview, true);
  assert.deepEqual(f.setup.expansions, []); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.equal(player(f.afterSetup, f.asker).hand[0].id, f.truthtrance);
  assert.ok(player(f.afterSetup, f.emperor).hand.some(card => card.id === f.karama && card.effect === 'karama'));
  assert.deepEqual(f.firstStorm.steps.filter(step => step.action.type === 'stormDial').map(step => step.action.amount), [11, 0]);
  assert.equal(f.firstStorm.after.storm, 12); assert.equal(f.game.advanced, true);
  assert.equal(f.game.truthtrance ?? null, null); assert.equal(f.game.shipmentPromises?.length ?? 0, 0);
  if (f.kind === 'bgCharity') {
    assert.ok(f.advisorSetup); assert.deepEqual(f.advisorSetup.steps[0].action, { type: 'advisorSetup', territory: 'arrakeen', sector: 10 });
    assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 2); assert.equal(f.counterHolder, f.emperor);
    assert.equal(player(f.game, f.target).spice, 5); assert.equal(player(f.game, f.target).reserves, 19);
    assert.equal(player(f.game, f.target).forces['arrakeen:10'], 1); assert.equal(isAdvisor(player(f.game, f.target), 'arrakeen'), true);
    assert.equal(player(f.game, f.asker).forces['arrakeen:10'], 10); assert.equal(f.targetKarama, null);
    assert.equal(player(f.game, f.target).hand.some(card => card.effect === 'karama'), false);
  } else {
    assert.ok(f.purchase && f.beforeBid && f.shipment && f.beforeStormMovement && f.stormLoss && f.guild);
    assert.deepEqual(f.purchase.steps[0], { actor: f.asker, action: { type: 'bid', amount: 4 } });
    assert.equal(player(f.purchase.before, f.emperor).spice, 10); assert.equal(player(f.purchase.after, f.emperor).spice, 14);
    assert.equal(player(f.purchase.after, f.asker).spice, 6);
    assert.ok(player(f.purchase.after, f.asker).hand.some(card => card.id === f.auctionCard));
    assert.deepEqual(f.shipment.steps[0], { actor: f.target,
      action: { type: 'ship', territory: 'hagga_basin', sector: 13, amount: 2, elite: 2, allyPayment: 0 } });
    assert.equal(player(f.shipment.before, f.target).spice - player(f.shipment.after, f.target).spice, 4);
    assert.equal(player(f.shipment.after, f.target).elites?.forces['hagga_basin:13'], 2);
    assert.equal(f.beforeStormMovement.storm, 12); assert.equal(f.beforeStormMovement.stormPending, 1);
    assert.equal(f.stormLoss.after.storm, 13); assert.equal(player(f.stormLoss.after, f.target).elites?.tanks, 2);
    assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 4);
    const p = player(f.game, f.target); assert.equal(p.spice, 10); assert.equal(p.reserves, 18); assert.equal(p.tanks, 2);
    assert.equal(p.elites?.reserves, 3); assert.equal(p.elites?.tanks, 2); assert.equal(p.elites?.revived, 0);
    assert.equal(p.revived, 0); assert.equal(p.freeForcesRevived, 0); assert.equal(f.targetKarama, f.karama);
  }
  assert.equal(f.originalInventory.length, 33); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function bound(f: TruthtranceAdvancedShipmentPreparationFixture, game = structuredClone(f.game)) {
  game = ask(game, f);
  assert.ok(viewGame(game, f.asker).truthShipmentTargets.includes(f.target));
  assert.deepEqual(viewGame(game, f.target).truthShipmentAnswers, ['yes', 'no']);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.equal(game.truthtrance ?? null, null); assert.equal(game.shipmentPromises?.length, 1);
  assert.equal(game.shipmentPromises![0].answer, true); assert.equal(game.shipmentPromises![0].released, undefined);
  return game;
}
function prepare(game: Game, f: TruthtranceAdvancedShipmentPreparationFixture, action?: Action) {
  const guide = viewGame(game, f.target).shipmentPreparation; assert.ok(guide?.actions.length);
  assert.equal(guide.actions[0].type, f.kind === 'bgCharity' ? 'charity' : 'revive');
  reject(game, f.target, { type: 'ready' });
  if (f.kind === 'elite') {
    assert.equal(guide.actions[0].amount, 1);
    reject(game, f.target, { type: 'revive', amount: 2, elite: 2, freeElite: 1 });
  }
  game = act(game, f.target, action ?? guide.actions[0]);
  if (f.kind === 'bgCharity') {
    assert.equal(game.response?.kind, 'bgCharity'); assert.equal(player(game, f.target).spice, 5);
  }
  game = advance(game, clean);
  assert.equal(viewGame(game, f.target).shipmentPreparation, null);
  assert.equal(game.shipmentPromises![0].released, undefined);
  if (f.kind === 'bgCharity') assert.equal(player(game, f.target).spice, 7);
  else {
    const p = player(game, f.target); assert.equal(p.spice, 10); assert.equal(p.reserves, 19); assert.equal(p.tanks, 1);
    assert.equal(p.elites?.reserves, 4); assert.equal(p.elites?.tanks, 1); assert.equal(p.elites?.revived, 1);
    assert.equal(p.revived, 1); assert.equal(p.freeForcesRevived, 1);
    reject(game, f.target, { type: 'revive', amount: 1, elite: 1, freeElite: 0 });
  }
  return game;
}
function ship(game: Game, f: TruthtranceAdvancedShipmentPreparationFixture) {
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state));
  assert.equal(game.shipmentPromises![0].released, undefined); assert.equal(game.shipmentPromises![0].fulfilled, undefined);
  const before = structuredClone(game), guildBefore = f.guild ? player(game, f.guild).spice : null;
  if (f.kind === 'elite') {
    const rate = viewGame(game, f.target).shipmentCompletion?.actions[0]; assert.ok(rate);
    assert.equal(rate.type, 'card'); assert.equal(rate.card, f.karama); assert.equal(rate.mode, 'shipment');
    assert.ok(f.rateAction); game = act(game, f.target, f.rateAction);
    assert.equal(player(game, f.target).spice, 10); assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  }
  const completion = viewGame(game, f.target).shipmentCompletion; assert.ok(completion);
  const shipment = completion.actions.find(action => action.type === 'ship'); assert.ok(shipment);
  assert.equal(shipment.amount, f.minimum); assert.equal(shipment.territory, f.territory);
  if (f.kind === 'elite') assert.equal(shipment.elite, 4);
  reject(game, f.target, { ...f.shipmentAction, amount: f.minimum - 1 });
  game = act(game, f.target, f.shipmentAction); game = advance(game, clean);
  const p = player(game, f.target); assert.equal(p.spice, 0); assert.equal(p.forces[f.location], f.minimum);
  assert.equal(player(before, f.target).spice - p.spice, f.kind === 'elite' ? 10 : 7);
  assert.equal(p.shipped, true); assert.equal(p.moved, 0); assert.equal(game.shipmentPromises![0].fulfilled, true);
  assert.equal(game.shipmentPromises![0].released, undefined);
  assert.equal(p.reserves, player(before, f.target).reserves - f.minimum);
  if (f.kind === 'elite') {
    assert.equal(p.elites?.forces[f.location], 4); assert.equal(p.elites?.reserves, 0); assert.equal(p.elites?.tanks, 1);
    assert.equal(player(game, f.guild!).spice, guildBefore, 'The real purchased rate sends its invoice to the bank');
  } else {
    assert.equal(p.forces['arrakeen:10'], 1); assert.equal(isAdvisor(p, 'arrakeen'), true); assert.equal(isAdvisor(p, 'carthag'), false);
    assert.equal(p.reserves, 12);
  }
  assert.deepEqual(inventory(game), f.originalInventory); reject(game, f.target, f.shipmentAction); return game;
}

void test('native Advanced wealthy BG Charity prepares and pays the real seven-counter city commitment', () => {
  const f = fixture({ kind: 'bgCharity' }); nativeSource(f); ship(prepare(bound(f), f), f);
});

void test('native Advanced original Emperor Karama prevents wealthy BG Charity and releases the otherwise impossible shipment once', () => {
  const f = fixture({ kind: 'bgCharity' }); nativeSource(f);
  let game = bound(f); reject(game, f.target, { type: 'ready' });
  game = act(game, f.target, f.charityAction); assert.equal(game.response?.kind, 'bgCharity');
  assert.equal(player(game, f.target).spice, 5); assert.ok(f.counterHolder);
  game = act(game, f.counterHolder, { type: 'card', card: f.karama, mode: 'cancel' }); game = advance(game, clean);
  assert.equal(player(game, f.target).spice, 5); assert.equal(game.shipmentPromises![0].released, true);
  assert.equal(game.shipmentPromises![0].fulfilled, undefined); assert.equal(viewGame(game, f.target).shipmentPreparation, null);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  const released = structuredClone(game.shipmentPromises); game = act(game, f.target, { type: 'ready' });
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state));
  reject(game, f.target, f.shipmentAction);
  game = act(game, f.target, { ...f.shipmentAction, amount: 5 }); game = advance(game, clean);
  assert.equal(player(game, f.target).forces[f.location], 5); assert.equal(player(game, f.target).spice, 0);
  assert.deepEqual(game.shipmentPromises, released); assert.deepEqual(inventory(game), f.originalInventory);
});

void test('native Advanced wealthy BG source cannot promise eight without an owned funding source', () => {
  const f = fixture({ kind: 'bgCharity' }), game = ask(structuredClone(f.game), f, 8);
  assert.deepEqual(viewGame(game, f.target).truthShipmentAnswers, ['no']);
  reject(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.doesNotThrow(() => act(game, f.target, { type: 'truthAnswer', answer: 'no' }));
});

void test('native Advanced elite-only Storm losses prepare exactly one Sardaukar then original Karama pays nineteen city counters', () => {
  const f = fixture({ kind: 'elite' }); nativeSource(f); ship(prepare(bound(f), f), f);
});

void test('native Advanced elite-only source cannot promise twenty or revive its second Sardaukar this turn', () => {
  const f = fixture({ kind: 'elite' }); nativeSource(f);
  const game = ask(structuredClone(f.game), f, 20); assert.deepEqual(viewGame(game, f.target).truthShipmentAnswers, ['no']);
  reject(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  reject(f.game, f.target, { type: 'revive', amount: 2, elite: 2, freeElite: 1 });
  const prepared = prepare(bound(f), f); assert.equal(player(prepared, f.target).elites?.revived, 1);
  reject(prepared, f.target, { type: 'revive', amount: 1, elite: 1 });
});

void test('a genuine earlier Advanced Ready is reopened by either required owned preparation answer', () => {
  for (const kind of ['bgCharity', 'elite'] as const) {
    const f = fixture({ kind }); let game = act(structuredClone(f.game), f.target, { type: 'ready' });
    assert.equal(game.ready.includes(f.target), true); game = bound(f, game);
    assert.equal(game.ready.includes(f.target), false); assert.ok(viewGame(game, f.target).shipmentPreparation?.actions.length);
    prepare(game, f);
  }
});

void test('native Advanced pending shipment questions reject foreign answers and premature shipment or phase skipping', () => {
  for (const kind of ['bgCharity', 'elite'] as const) {
    const f = fixture({ kind }), game = ask(structuredClone(f.game), f);
    reject(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); reject(game, f.target, f.shipmentAction);
    reject(game, f.target, { type: 'ready' }); reject(game, f.asker, f.askStep.action);
    const done = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    reject(done, f.target, { type: 'truthAnswer', answer: 'yes' }); assert.deepEqual(inventory(done), f.originalInventory);
  }
});

void test('all four minimal profiles choose legal original Advanced answers and execute the required owned preparation', () => {
  for (const kind of ['bgCharity', 'elite'] as const) {
    const f = fixture({ kind }), asked = ask(structuredClone(f.game), f), promised = bound(f);
    for (const difficulty of DIFFICULTIES) {
      const answering = viewGame(asked, f.target); answering.players.find(p => p.id === f.target)!.bot = difficulty;
      const answer = botActions(answering)[0]; assert.ok(answer); assert.equal(answer.type, 'truthAnswer');
      assert.ok(answer.answer === 'yes' || answer.answer === 'no'); assert.doesNotThrow(() => act(asked, f.target, answer));
      const own = viewGame(promised, f.target); own.players.find(p => p.id === f.target)!.bot = difficulty;
      const proposed = botActions(own)[0]; assert.ok(proposed);
      assert.equal(proposed.type, kind === 'bgCharity' ? 'charity' : 'revive');
      ship(prepare(structuredClone(promised), f, proposed), f);
    }
  }
});
