import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { nexusRicheseAction } from '../game/nexus-richese-options';
import { createRicheseNativeGuildRate, declareRicheseNativeGuildRate } from './fixture-richese-native-guild-rate';
import {
  allowNativeGuildRateModules, cancelNativeGuildRateModules,
  settleNativeGuildRateModules,
} from './fixture-native-guild-rate-modules';
import { pairedE3NexusPlayer, pairedE3NexusReload, stepPairedE3Nexus } from './fixture-paired-e3-nexus-modules';

function reject(game: Game, actor: string, action: Action) {
  const before = pairedE3NexusReload(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function spentOnce(game: Game, guild: string) {
  assert.equal(game.nexusCards!.cards!.hands[guild], null);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
}

for (const canceled of [false, true]) void test(`native Guild ${canceled ? 'cancellation' : 'allowance'} retains five actual Richese forces and one charged counter`, () => {
  const f = createRicheseNativeGuildRate();
  let game = declareRicheseNativeGuildRate(f);
  assert.equal(game.response?.kind, 'guildRate');
  assert.equal(pairedE3NexusPlayer(game, f.guild).reserves, 15);
  assert.equal(pairedE3NexusPlayer(game, f.guild).spice, 6);
  assert.equal(pairedE3NexusPlayer(game, f.guild).shipped, false);
  spentOnce(game, f.guild);
  assert.ok(viewGame(game, f.canceler).responseControls!.cancelCards.includes(f.karama));
  reject(game, f.guild, f.action);
  game = canceled ? cancelNativeGuildRateModules(game, f.canceler, f.karama).game
    : allowNativeGuildRateModules(game).game;
  game = settleNativeGuildRateModules(game).game;
  const owner = pairedE3NexusPlayer(game, f.guild);
  assert.equal(owner.spice, canceled ? 4 : 5);
  assert.equal(owner.reserves, 10);
  assert.equal(owner.forces[f.target], 5);
  assert.equal(owner.shipped, true);
  assert.equal(owner.moved, 0);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, canceled ? 1 : 0);
  assert.equal(pairedE3NexusPlayer(game, f.canceler).hand.some(card => card.id === f.karama), !canceled);
  spentOnce(game, f.guild);
  reject(game, f.guild, f.action);
  game = stepPairedE3Nexus(game, { actor: f.guild, action: { type: 'endMovement' } });
  assert.notEqual(game.active, f.guild);
  assert.equal(pairedE3NexusPlayer(game, f.guild).forces[f.target], 5);
});

void test('an unaffordable full one-counter fee ends the spent Nexus declaration without delivery, debt or a second card use', () => {
  const f = createRicheseNativeGuildRate({ poor: true });
  let game = declareRicheseNativeGuildRate(f);
  assert.equal(game.response?.kind, 'guildRate');
  game = cancelNativeGuildRateModules(game, f.canceler, f.karama).game;
  const owner = pairedE3NexusPlayer(game, f.guild);
  assert.equal(owner.spice, 1);
  assert.equal(owner.reserves, 15);
  assert.equal(owner.forces[f.target] ?? 0, 0);
  assert.equal(owner.shipped, false);
  assert.equal(owner.moved, 0);
  assert.equal(game.response, null);
  assert.equal(game.pendingShipment, null);
  spentOnce(game, f.guild);
  reject(game, f.guild, f.action);
  const destination = TERRITORIES.find(t => t.type === 'stronghold' &&
    t.sectors.some(s => s !== game.storm) && game.players.every(p => presenceAt(p, t.id) === 0));
  assert.ok(destination);
  const sector = destination.sectors.find(s => s !== game.storm)!;
  game = stepPairedE3Nexus(game, { actor: f.guild,
    action: { type: 'ship', territory: destination.id, sector, amount: 1, elite: 0 } });
  if (game.decision?.kind === 'guildShipment') game = stepPairedE3Nexus(game,
    { actor: f.guild, action: { type: 'decision', allow: true } });
  game = settleNativeGuildRateModules(game).game;
  assert.equal(pairedE3NexusPlayer(game, f.guild).spice, 0);
  assert.equal(pairedE3NexusPlayer(game, f.guild).reserves, 14);
  assert.equal(pairedE3NexusPlayer(game, f.guild).forces[`${destination.id}:${sector}`], 1);
  spentOnce(game, f.guild);
});

void test('earlier native cancellation quotes the held source at full price and keeps a legal one-spice alternative', () => {
  const f = createRicheseNativeGuildRate({ priorCancellation: true });
  assert.equal(f.quote.cost, 2);
  assert.equal(viewGame(f.beforeAction, f.guild).guildRateCanceled, true);
  assert.equal(pairedE3NexusPlayer(f.beforeAction, f.guild).spice, 1);
  reject(f.beforeAction, f.guild, f.action);
  const destination = TERRITORIES.find(t => t.type === 'stronghold' &&
    t.sectors.some(s => s !== f.beforeAction.storm) &&
    f.beforeAction.players.every(p => presenceAt(p, t.id) === 0));
  assert.ok(destination);
  const sector = destination.sectors.find(s => s !== f.beforeAction.storm)!;
  const view = viewGame(f.beforeAction, f.guild);
  const action = nexusRicheseAction(view, view.nexusRichese!.event,
    { type: 'ship', territory: destination.id, sector, amount: 5, elite: 0 });
  assert.ok(action);
  let game = declareRicheseNativeGuildRate({ ...f, action });
  game = settleNativeGuildRateModules(game).game;
  assert.equal(pairedE3NexusPlayer(game, f.guild).spice, 0);
  assert.equal(pairedE3NexusPlayer(game, f.guild).reserves, 10);
  assert.equal(pairedE3NexusPlayer(game, f.guild).forces[`${destination.id}:${sector}`], 5);
  spentOnce(game, f.guild);
});

void test('the independently purchased price remains one bank spice for the original five-force source', () => {
  const f = createRicheseNativeGuildRate({ purchased: true });
  let game = declareRicheseNativeGuildRate(f);
  assert.notEqual(game.response?.kind, 'guildRate');
  game = settleNativeGuildRateModules(game).game;
  assert.equal(pairedE3NexusPlayer(game, f.guild).spice, 5);
  assert.equal(pairedE3NexusPlayer(game, f.guild).reserves, 10);
  assert.equal(pairedE3NexusPlayer(game, f.guild).forces[f.target], 5);
  assert.equal(game.karamaShipping, null);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  spentOnce(game, f.guild);
});

void test('a rounded stronghold price with no actual discount has no native rate counter', () => {
  const f = createRicheseNativeGuildRate({ destinationType: 'stronghold' });
  assert.equal(f.quote.cost, 1);
  let game = declareRicheseNativeGuildRate(f);
  assert.notEqual(game.response?.kind, 'guildRate');
  game = settleNativeGuildRateModules(game).game;
  assert.equal(pairedE3NexusPlayer(game, f.guild).spice, 5);
  assert.equal(pairedE3NexusPlayer(game, f.guild).forces[f.target], 5);
  assert.ok(pairedE3NexusPlayer(game, f.canceler).hand.some(card => card.id === f.karama));
  spentOnce(game, f.guild);
});

void test('the native Junction withdrawal stays five physical counters while cancellation charges only one full counter', () => {
  const f = createRicheseNativeGuildRate({ homeworlds: true });
  reject(f.beforeAction, f.guild, { ...f.action,
    homeworldSources: { 'homeworld:ecaz': { normal: 5, elite: 0 } } });
  let game = declareRicheseNativeGuildRate(f);
  assert.equal(game.response?.kind, 'guildRate');
  game = cancelNativeGuildRateModules(game, f.canceler, f.karama).game;
  game = settleNativeGuildRateModules(game).game;
  assert.equal(pairedE3NexusPlayer(game, f.guild).spice, 4);
  assert.equal(pairedE3NexusPlayer(game, f.guild).reserves, 10);
  assert.equal(pairedE3NexusPlayer(game, f.guild).forces[f.target], 5);
  assert.equal(pairedE3NexusPlayer(game, f.guild).moved, 0);
  spentOnce(game, f.guild);
});
