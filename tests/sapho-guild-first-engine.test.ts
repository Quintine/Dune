import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import {
  actSaphoGuildFirst, advanceSaphoGuildFirst, completeSaphoGuildFirst, createSaphoGuildFirstFixture,
  prepareSaphoGuildTake, saphoGuildFirstAction, saphoGuildFirstClean,
  saphoGuildFirstPlayer as player, type SaphoGuildFirstFixture,
} from './fixture-sapho-guild-first';

function source(f: SaphoGuildFirstFixture) {
  assert.equal(f.game.advanced, true);
  assert.equal(f.beforeStartingDeal.deck[1].id, f.counter);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.ok(player(f.afterSetup, f.canceler).hand.some(card => card.id === f.counter));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(player(f.game).hand.some(card => card.id === f.card));
  assert.equal(f.beforeGuildWait.decision?.kind, 'guildTiming');
  assert.ok(f.waits.every(wait => wait.step.actor === f.guild && wait.step.action.take === false));
  assert.equal(f.game.decision, null);
  assert.notEqual(f.game.active, f.guild);
  assert.notEqual(f.game.active, f.owner);
  assert.equal(f.game.guildTimingLocked, false);
  assert.ok(f.game.movementRemaining!.includes(f.guild));
  for (const actor of f.game.movementRemaining!) {
    assert.equal(player(f.game, actor).moved, 0);
    assert.equal(player(f.game, actor).shipped, false);
  }
  assert.equal(f.sourceActionCount, f.actions.length);
}
function settled(f: SaphoGuildFirstFixture, result: ReturnType<typeof completeSaphoGuildFirst>) {
  assert.equal(result.first.scope, 'movement');
  assert.equal(result.first.mode, 'first');
  assert.equal(result.reoffered.decision?.kind, 'guildTiming');
  if (result.reoffered.decision?.kind === 'guildTiming') assert.equal(result.reoffered.decision.next, f.owner);
  assert.deepEqual(result.reoffered.movementRemaining,
    [f.owner, ...f.game.movementRemaining!.filter(actor => actor !== f.owner)]);
  assert.deepEqual(result.reoffered.order, f.game.order);
  assert.equal(result.reoffered.saphoMovementLast ?? null, null);
  assert.equal(result.game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(result.game.order, f.game.order);
  assert.deepEqual(result.game.movementRemaining, []);
  const owner = result.turns.find(turn => turn.actor === f.owner)!, guild = result.turns.find(turn => turn.actor === f.guild)!;
  assert.ok(owner.shipment && guild.shipment);
  assert.equal(player(owner.before).spice - player(owner.afterShipment).spice, 2);
  assert.equal(player(owner.before).reserves - player(owner.afterShipment).reserves, 1);
  assert.equal(player(guild.before, f.guild).spice - player(guild.afterShipment, f.guild).spice, 1);
  assert.equal(player(guild.before, f.guild).reserves - player(guild.afterShipment, f.guild).reserves, 1);
  assert.equal(player(result.game).forces['imperial_basin:9'], 1);
  assert.equal(player(result.game, f.guild).forces['carthag:11'], 1);
  assert.equal(result.actions.filter(step => step.actor === f.owner && step.action.type === 'ship').length, 1);
  assert.equal(result.actions.filter(step => step.actor === f.guild && step.action.type === 'ship').length, 1);
  assert.equal(result.actions.filter(step => step.action.type === 'endMovement').length, result.turns.length);
}

void test('genuine paid Sapho first reopens Guild TAKE before its holder without changing the original non-Guild suffix', () => {
  const f = createSaphoGuildFirstFixture();
  source(f);
  const result = completeSaphoGuildFirst(f, true);
  settled(f, result);
  assert.equal(result.declaredGuild.response?.kind, 'guildTiming');
  assert.ok(viewGame(result.declaredGuild, f.canceler).responseControls!.cancelCards.includes(f.counter));
  assert.ok(result.actions.some(step => step.actor === f.canceler && step.action.type === 'passResponse'));
  assert.equal(result.afterGuildChoice.active, f.guild);
  assert.equal(result.afterGuildChoice.guildTimingGranted, true);
  assert.deepEqual(result.turns.map(turn => turn.actor), ['guild', 'emperor', 'richese', 'atreides']);
});

void test('genuine Guild WAIT after Sapho first lets the holder complete its paid turn before the original following actors', () => {
  const f = createSaphoGuildFirstFixture();
  source(f);
  const result = completeSaphoGuildFirst(f, false);
  settled(f, result);
  assert.equal(result.afterGuildChoice.active, f.owner);
  assert.deepEqual(result.turns.map(turn => turn.actor), ['emperor', 'richese', 'atreides', 'guild']);
  const ownTurn = result.turns[0];
  assert.equal(player(ownTurn.afterShipment, f.guild).spice - player(ownTurn.before, f.guild).spice, 2,
    'The originally unspent Guild receives the actual ordinary opposing shipment fee once');
});

void test('a genuinely completed paid native prefix remains finished when Sapho first reorders the later unstarted suffix', () => {
  const f = createSaphoGuildFirstFixture({ completedFirst: true });
  source(f);
  assert.ok(f.prefix);
  assert.equal(player(f.prefix!.before, 'richese').spice - player(f.prefix!.afterShipment, 'richese').spice, 2);
  assert.equal(player(f.game, 'richese').shipped, true);
  assert.equal(player(f.game, 'richese').forces['polar_sink:0'], 1);
  assert.equal(f.game.movementRemaining!.includes('richese'), false);
  const result = completeSaphoGuildFirst(f, false);
  settled(f, result);
  assert.deepEqual(result.turns.map(turn => turn.actor), ['emperor', 'atreides', 'guild']);
  assert.equal(result.actions.some(step => step.actor === 'richese' &&
    ['ship', 'move', 'endMovement'].includes(step.action.type)), false,
  'A completed player may still allow another faction response, without another movement turn');
  assert.equal(player(result.game, 'richese').forces['polar_sink:0'], 1);
  assert.equal(player(result.game, 'richese').shipped, true);
});

void test('real granted Guild TAKE protects its current turn while an actually canceled TAKE stays locked under Sapho first', () => {
  const f = createSaphoGuildFirstFixture();
  const granted = prepareSaphoGuildTake(f);
  assert.equal(granted.game.active, f.guild);
  assert.equal(granted.game.guildTimingGranted, true);
  assert.equal(viewGame(granted.game, f.owner).saphoOptions.some(option => option.scope === 'movement' && option.mode === 'first'), false);
  assert.throws(() => actSaphoGuildFirst(granted.game, f.owner, saphoGuildFirstAction(f.game)), /Sapho|opportunity|Guild|expired/i);
  assert.ok(player(granted.game).hand.some(card => card.id === f.card));
  let finished = actSaphoGuildFirst(granted.game, f.guild,
    { type: 'ship', territory: 'carthag', sector: 11, amount: 1, elite: 0, allyPayment: 0 });
  finished = advanceSaphoGuildFirst(finished, saphoGuildFirstClean);
  finished = actSaphoGuildFirst(finished, f.guild, { type: 'endMovement' });
  finished = advanceSaphoGuildFirst(finished, saphoGuildFirstClean);
  finished = actSaphoGuildFirst(finished, f.owner, saphoGuildFirstAction(finished));
  assert.equal(finished.active, f.owner);
  assert.equal(finished.decision, null);
  assert.equal(finished.movementRemaining!.includes(f.guild), false);
  assert.equal(player(finished, f.guild).forces['carthag:11'], 1);
  const canceled = prepareSaphoGuildTake(f, true);
  assert.equal(canceled.game.guildTimingLocked, true);
  assert.equal(canceled.game.discard.filter(card => card.id === f.counter).length, 1);
  const first = actSaphoGuildFirst(canceled.game, f.owner, saphoGuildFirstAction(canceled.game));
  assert.equal(first.active, f.owner);
  assert.equal(first.decision, null);
  assert.equal(first.guildTimingLocked, true);
  assert.ok(first.movementRemaining!.includes(f.guild), 'Cancellation keeps the native in-order turn without reviving flexible timing');
});

void test('all four minimal policies propose legal Sapho-first and renewed native Guild timing decisions from original views', () => {
  const f = createSaphoGuildFirstFixture();
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const holder = viewGame(f.game, f.owner);
    holder.players.find(player => player.id === f.owner)!.bot = difficulty;
    const first = botActions(holder).find(action => action.type === 'card' && action.card === f.card && action.scope === 'movement' && action.mode === 'first');
    assert.ok(first, `${difficulty} retains the actual meaningful first choice`);
    const renewed = actSaphoGuildFirst(structuredClone(f.game), f.owner, first);
    assert.equal(renewed.decision?.kind, 'guildTiming');
    const guild = viewGame(renewed, f.guild);
    guild.players.find(player => player.id === f.guild)!.bot = difficulty;
    const choice = botActions(guild).find(action => action.type === 'decision' && typeof action.take === 'boolean');
    assert.ok(choice, `${difficulty} answers the actual renewed native timing control`);
    const declared = actSaphoGuildFirst(renewed, f.guild, choice);
    const continued = advanceSaphoGuildFirst(declared, saphoGuildFirstClean);
    assert.equal(continued.active, choice.take ? f.guild : f.owner);
    assert.deepEqual(continued.order, f.game.order);
    assert.equal(player(continued).shipped, false);
    assert.equal(player(continued).moved, 0);
  }
});
