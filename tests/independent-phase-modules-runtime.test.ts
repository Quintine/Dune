import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { MOBILE_STRONGHOLD } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import {
  createMixedPhaseModulesFixture, createMixedPhaseModulesProgramme,
  mixedPhaseModulesClean, mixedPhaseModulesInventory, mixedPhaseModulesPlayer as player,
  type MixedPhaseModulesOptions,
} from './fixture-mixed-phase-modules';

function entry(options: MixedPhaseModulesOptions) {
  const f = createMixedPhaseModulesFixture({ ...options, independent: true });
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.initial.ecazTreachery, undefined);
  const selected = f.actions.findIndex(step => step.action.type === 'moduleOption' &&
    step.action.module === 'ecazTreachery' && step.action.enabled === true);
  const ready = f.actions.findIndex(step => step.action.type === 'ready');
  assert.ok(selected >= 0 && selected < ready);
  assert.equal(f.actions[selected].actor, f.initial.host);
  assert.equal(f.lobby.lobbyOptions?.ecazTreachery, true);
  assert.ok(f.lobby.players.every(seat => seat.ready));
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.ecazTreachery, true);
  assert.equal(f.game.status, 'playing'); assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 1);
  assert.equal(f.game.ecazTreachery, true); assert.equal(f.game.advanced, !!options.advanced);
  assert.equal(!!f.game.techTokens, !!options.tech); assert.equal(!!f.game.strongholdCards, !!options.strongholds);
  assert.deepEqual(f.game.expansions, options.expansions);
  assert.ok(!f.game.homeworlds && !f.game.leaderSkills && !f.game.nexusCards &&
    !f.game.discoveryEnabled && !f.game.semutaPreview);
  assert.equal(f.originalInventory.length, treacheryDeck(options.expansions).length + 3);
  assert.ok(ecazTreacheryCards().every(card => f.originalInventory.includes(card.id)));
  assert.deepEqual(mixedPhaseModulesInventory(f.game), f.originalInventory);
  assert.ok(f.afterSetup.players.every(seat => seat.hand.length > 0), 'Original native setup deals the actual starting cards');
  assert.equal(f.sourceActionCount, f.actions.length); assert.deepEqual(f.staging, []);
  return f;
}

void test('public Basic independent cards support paired E3 Tech and bare mixed Ecaz without incidental phase modules', () => {
  entry({ factions: ['ecaz', 'moritani', 'guild'], expansions: ['ecaz'], tech: true });
  entry({ factions: ['ecaz', 'ixians', 'tleilaxu'], expansions: ['ix', 'choam', 'ecaz'] });
});

void test('public Advanced independent cards support mixed Strongholds and classic-only unused selected decks with both phase modules', () => {
  entry({ factions: ['ecaz', 'choam', 'guild'], expansions: ['choam', 'ecaz'], advanced: true, strongholds: true });
  entry({ factions: ['atreides', 'emperor', 'guild'], expansions: ['ix', 'choam', 'ecaz'], advanced: true,
    tech: true, strongholds: true });
});

for (const advanced of [false, true]) void test(`public all-six independent-card ${advanced ? 'Advanced Tech and Strongholds' : 'Basic Tech'} preserves its earned phase payouts and physical cards`, () => {
  const f = createMixedPhaseModulesProgramme({ advanced, independent: true });
  assert.equal(f.independent, true); assert.equal(f.setup.ecazTreachery, true);
  assert.equal(f.setup.deck.length, 50); assert.equal(f.setup.richeseCache?.length, 10);
  assert.equal(f.originalInventory.length, 60);
  assert.equal(f.setup.techTokens?.heighliners.owner, 'ixians');
  assert.equal(f.setup.techTokens?.axlotl.owner, 'tleilaxu');
  assert.ok(f.actions.some(step => step.action.type === 'moduleOption' && step.action.module === 'ecazTreachery'));
  assert.ok(f.actions.some(step => step.actor === 'ixians' && step.action.type === 'decision' && typeof step.action.card === 'string'));
  assert.ok(f.afterSetup.players.every(seat => seat.hand.length > 0));
  assert.equal(player(f.choamShipment.after, 'choam').forces[f.choamLocation], 1);
  assert.equal(player(f.choamShipment.before, 'choam').spice - player(f.choamShipment.after, 'choam').spice, 1);
  assert.equal(player(f.moritaniShipment.after, 'moritani').forces[f.casualtyLocation], 1);
  assert.equal(player(f.moritaniShipment.before, 'moritani').spice - player(f.moritaniShipment.after, 'moritani').spice, 2);
  for (const receipt of [f.choamShipment, f.moritaniShipment]) {
    assert.equal(receipt.after.techTokens?.heighliners.spice, 1);
    assert.equal(receipt.after.techTokens?.heighliners.triggeredTurn, 1);
    assert.equal(player(receipt.after, 'ixians').spice, player(receipt.before, 'ixians').spice);
  }
  assert.equal(f.shipmentPayout.before.phase, 5); assert.equal(f.shipmentPayout.after.phase, 6);
  assert.equal(f.shipmentPayout.after.techTokens?.heighliners.spice, 0);
  assert.equal(player(f.shipmentPayout.after, 'ixians').spice - player(f.shipmentPayout.before, 'ixians').spice, 1);
  if (advanced) {
    assert.equal(f.mentat.before.strongholdCards?.claimedTurn, 0);
    assert.equal(f.mentat.after.strongholdCards?.claimedTurn, 1);
    assert.equal(f.mentat.after.strongholdCards?.owners.carthag, 'moritani');
    assert.equal(f.mentat.after.strongholdCards?.owners.sietch_tabr, 'choam');
    assert.equal(f.mentat.after.strongholdCards?.owners[MOBILE_STRONGHOLD], 'ixians');
  }
  assert.equal(f.storm.before.stormMovementSource?.kind, advanced ? 'card' : 'dials');
  assert.equal(f.storm.before.stormPending, advanced ? 1 : 2);
  assert.equal(player(f.storm.after, 'moritani').tanks, 1);
  assert.equal(player(f.storm.after, 'moritani').forces[f.casualtyLocation], undefined);
  assert.deepEqual(f.revival.steps[0], { actor: 'moritani', action: { type: 'revive', amount: 1, elite: 0 } });
  if (advanced) assert.equal(f.revival.before.revivalOrder?.remaining[0], 'moritani');
  assert.equal(player(f.revival.after, 'moritani').tanks, 0); assert.equal(player(f.revival.after, 'moritani').revived, 1);
  assert.equal(player(f.revival.after, 'moritani').spice, player(f.revival.before, 'moritani').spice);
  assert.equal(player(f.revival.after, 'tleilaxu').spice - player(f.revival.before, 'tleilaxu').spice, 1);
  assert.equal(f.revival.after.techTokens?.axlotl.spice, 1);
  assert.equal(f.revivalPayout.after.techTokens?.axlotl.spice, 0);
  assert.equal(player(f.revivalPayout.after, 'tleilaxu').spice - player(f.revivalPayout.before, 'tleilaxu').spice, 1);
  assert.equal(f.game.phase, 5); assert.equal(f.game.turn, 2); assert.ok(mixedPhaseModulesClean(f.game));
  assert.deepEqual(mixedPhaseModulesInventory(f.game), f.originalInventory); assert.deepEqual(f.staging, []);
  assert.ok(!f.game.homeworlds && !f.game.leaderSkills && !f.game.nexusCards && !f.game.discoveryEnabled);
  // Recruits acquisition and use have their own native lane. This programme
  // consumes original phase choices and never selects a new card effect.
  assert.ok(!f.actions.some(step => step.action.type === 'card' && step.action.card === 'ecaz-recruits'));
  if (advanced) {
    const actor = f.game.active; assert.ok(actor);
    const view = viewGame(f.game, actor); view.players.find(seat => seat.id === actor)!.bot = 'Easy';
    const candidate = botActions(view).find(action => action.type === 'endMovement'); assert.ok(candidate);
    assert.doesNotThrow(() => applyAction(f.game, actor, candidate));
  }
});
