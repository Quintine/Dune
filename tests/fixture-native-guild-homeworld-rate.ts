import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { homeworldShipmentChoice, type HomeworldShipmentSources } from '../game/homeworld-shipment-options';
import { guildHomeworldShipmentChoice } from '../game/guild-homeworld-shipment-options';
import { junctionTransportChoice } from '../game/junction-transport-options';
import { createGuildAmbassadorIncomeArrival, passNativeGuildTransportPermission } from './fixture-guild-ambassador-income-arrival';
import {
  advancePairedE3Nexus, nextPairedE3NexusStep, pairedE3NexusClean,
  pairedE3NexusPlayer, pairedE3NexusReload, quietPairedE3NexusChoice,
  stepPairedE3Nexus, type PairedE3NexusStep,
} from './fixture-paired-e3-nexus-modules';
import {
  nexusGuildCunningFixture, originalGuildCunningTurn, nexusGuildCunningRequest,
  nexusGuildCunningAllow, holdGuildCunningCard,
} from './fixture-nexus-guild-cunning';

export type NativeGuildHomeworldRoute = 'world' | 'arrakisForeign' | 'return';

export interface NativeGuildHomeworldRateFixture {
  route: NativeGuildHomeworldRoute;
  source: string;
  destination: string;
  sources: HomeworldShipmentSources;
  guild: string;
  entrant: string;
  ecaz: string;
  karama: string;
  beforeAction: Game;
  action: Action;
}
/** Original printed setup, original purchased Karama, and actual progression
 * from Moritani's real turn to Guild's real turn. The shared fixture discloses
 * its conserved undealt entropy ordering. No played custody, funding, control,
 * phase or decision is assigned here. A return is Arrakis to native Junction. */
export function createNativeGuildHomeworldRate(route: NativeGuildHomeworldRoute = 'world',
  options: { unaffordable?: boolean } = {}) {
  const base = createGuildAmbassadorIncomeArrival({ homeworlds: true });
  const actions = [...base.actions];
  let game = advancePairedE3Nexus(base.beforeAction,
    g => g.phase === 5 && g.active === base.guild && pairedE3NexusClean(g),
    actions, quietPairedE3NexusChoice);
  const beforeFunding = pairedE3NexusReload(game);
  if (options.unaffordable) {
    const excess = pairedE3NexusPlayer(game, base.guild).spice - 1;
    assert.ok(excess >= 0);
    if (excess) game = stepPairedE3Nexus(game, { actor: base.guild,
      action: { type: 'bribe', target: base.ecaz, amount: excess } }, actions);
  }
  game = stepPairedE3Nexus(game, { actor: base.entrant,
    action: { type: 'pledgeAid', amount: 1 } }, actions);
  const p = pairedE3NexusPlayer(game, base.guild);
  const source = route === 'world' ? 'homeworld:guild' : Object.keys(p.forces)
    .find(key => p.forces[key] >= 3 && Number(key.split(':')[1]) !== game.storm);
  assert.ok(source, 'The original Guild retains three physical counters outside storm.');
  const destination = route === 'return' ? 'homeworld:guild' : 'homeworld:ecaz';
  const sources: HomeworldShipmentSources = { [source]: { normal: 3, elite: 0 } };
  const quote = route === 'world'
    ? homeworldShipmentChoice(viewGame(game, base.guild), destination, sources, 1)
    : guildHomeworldShipmentChoice(viewGame(game, base.guild), destination, sources, 1);
  assert.equal(quote.blocked, null);
  assert.equal(quote.cost, 2);
  assert.equal(quote.ownPayment, 1);
  assert.ok(quote.action);
  return { ...base, actions, route, source, destination, sources,
    beforeFunding, beforeAction: pairedE3NexusReload(game), action: quote.action,
    contributions: [{ payer: base.guild, amount: 1 }, { payer: base.entrant, amount: 1 }],
    provenance: [...base.provenance,
      'Actual quiet phase progression to the native Guild turn; original on-board and Junction pools retained.',
      'Moritani pledges one actual spice; optional Guild bribe reduces only its real available wallet.',
      'The owner-view canonical quote declares three normal counters and an explicit one-spice allied share.'] };
}

export function nativeGuildHomeworldAction(f: NativeGuildHomeworldRateFixture,
  game: Game, amount = 3, allyPayment = 1): Action {
  const sources = { [f.source]: { normal: amount, elite: 0 } };
  const view = viewGame(game, f.guild);
  const quote = f.route === 'world'
    ? homeworldShipmentChoice(view, f.destination, sources, allyPayment)
    : guildHomeworldShipmentChoice(view, f.destination, sources, allyPayment);
  assert.equal(quote.blocked, null);
  assert.ok(quote.action);
  return quote.action;
}

/** Retain the original Guild special-interception decision if physically
 * offered. It is distinct from the native rate's subsequent prepayment queue. */
export function declareNativeGuildHomeworldRate(f: NativeGuildHomeworldRateFixture) {
  const actions: PairedE3NexusStep[] = [];
  let game = stepPairedE3Nexus(f.beforeAction, { actor: f.guild, action: f.action }, actions);
  if (game.decision?.kind === 'homeworldShipmentGuild') {
    game = stepPairedE3Nexus(game, { actor: f.guild,
      action: { type: 'decision', event: game.decision.event, allow: true } }, actions);
  }
  const permission = passNativeGuildTransportPermission(game);
  game = permission.game; actions.push(...permission.actions);
  assert.equal(game.response?.kind, 'guildRate');
  assert.ok(viewGame(game, f.ecaz).responseControls?.cancelCards.includes(f.karama));
  return { game, actions };
}

/** Only pass the actual requested kind; never clear a queue or fabricate a seat. */
export function passNativeGuildHomeworldResponses(state: Game, kind: 'guildRate' | 'guildIncome') {
  const actions: PairedE3NexusStep[] = [];
  let game = pairedE3NexusReload(state);
  for (let n = 0; game.response?.kind === kind && n < 20; n++) {
    const step = nextPairedE3NexusStep(game);
    assert.ok(step);
    assert.equal(step.action.type, 'passResponse');
    game = stepPairedE3Nexus(game, step, actions);
  }
  assert.notEqual(game.response?.kind, kind);
  return { game, actions };
}

/** Export a real pending prepayment scene suitable for API/UI loading. */
export function createNativeGuildHomeworldRateScene(route: NativeGuildHomeworldRoute = 'world',
  options: { unaffordable?: boolean } = {}) {
  const fixture = createNativeGuildHomeworldRate(route, options);
  const offered = declareNativeGuildHomeworldRate(fixture);
  return { ...fixture, game: offered.game, declarationActions: offered.actions,
    cancel: { actor: fixture.ecaz, action: { type: 'card', mode: 'cancel', card: fixture.karama } as Action } };
}

/** Original immune Junction offer, not a staged immunity flag: Moritani first
 * loses its ordinary native alliance rate on a genuinely unaffordable six-force
 * cross-transport. Its untouched original army then accepts Junction's own
 * Homeworld return tariff while that cancellation marker remains active. */
export function createNativeImmuneJunctionRate(rate: 'half' | 'full' = 'half') {
  const base = createGuildAmbassadorIncomeArrival({ homeworlds: true });
  const actions = [...base.actions];
  const excess = pairedE3NexusPlayer(base.beforeAction, base.entrant).spice - 3;
  assert.ok(excess >= 0);
  let game = pairedE3NexusReload(base.beforeAction);
  if (excess) game = stepPairedE3Nexus(game, { actor: base.entrant,
    action: { type: 'bribe', target: base.ecaz, amount: excess } }, actions);
  game = stepPairedE3Nexus(game, { actor: base.entrant,
    action: { ...base.action, amount: 6 } }, actions);
  const permission = passNativeGuildTransportPermission(game);
  game = permission.game; actions.push(...permission.actions);
  assert.equal(game.response?.kind, 'guildRate');
  game = stepPairedE3Nexus(game, { actor: base.ecaz,
    action: { type: 'card', mode: 'cancel', card: base.karama } }, actions);
  assert.equal(viewGame(game, base.entrant).guildRateCanceled, true);
  assert.equal(pairedE3NexusPlayer(game, base.entrant).shipped, false);
  const released = pairedE3NexusReload(game);
  const sponsor = viewGame(game, base.guild).junctionTransport;
  assert.ok(sponsor?.canOffer);
  game = stepPairedE3Nexus(game, { actor: base.guild,
    action: { type: 'offerJunctionTransport', event: sponsor.offerEvent, rate } }, actions);
  const sources = { [base.source]: { normal: 3, elite: 0 } };
  const destination = 'homeworld:moritani';
  const quote = junctionTransportChoice(viewGame(game, base.entrant), destination, sources, 0);
  assert.equal(quote.blocked, null);
  assert.equal(quote.cost, rate === 'half' ? 2 : 3);
  assert.ok(quote.action);
  return { ...base, actions, rate, sources, destination, released,
    beforeAction: pairedE3NexusReload(game), action: quote.action,
    provenance: [...base.provenance,
      'Actual unaffordable six-force alliance-rate cancellation leaves the original Moritani pool untouched.',
      'Original high-population Guild offers an independent printed Junction half/full tariff.'] };
}

/** Explicitly controlled older fixture: its wallet/phase/army and conserved
 * Nexus identity swap are not original action-only provenance. First combined
 * turn, Cunning grant, optional bribe, second declaration and all rate choices
 * are actual actions. The observer's conserved Karama is dealt by the existing
 * controlled helper, not claimed as an original auction purchase. */
export function createControlledGuildCunningHomeworldRateScene(unaffordable = false) {
  const base = nexusGuildCunningFixture({ homeworlds: true });
  let game = originalGuildCunningTurn(base);
  const karama = holdGuildCunningCard(game, base.observer, 'karama').id;
  game = nexusGuildCunningAllow(stepPairedE3Nexus(game,
    { actor: base.owner, action: nexusGuildCunningRequest(base, game) }));
  const actions: PairedE3NexusStep[] = [];
  if (unaffordable) {
    const amount = pairedE3NexusPlayer(game, base.owner).spice - 2;
    assert.ok(amount >= 0);
    if (amount) game = stepPairedE3Nexus(game, { actor: base.owner,
      action: { type: 'bribe', target: base.observer, amount } }, actions);
  }
  const beforeAction = pairedE3NexusReload(game);
  const sources = { 'homeworld:guild': { normal: 3, elite: 0 } };
  const destination = 'homeworld:harkonnen';
  const choice = homeworldShipmentChoice(viewGame(game, base.owner), destination, sources, 0);
  assert.equal(choice.blocked, null);
  assert.ok(choice.action);
  game = stepPairedE3Nexus(game, { actor: base.owner, action: choice.action }, actions);
  if (game.decision?.kind === 'homeworldShipmentGuild')
    game = stepPairedE3Nexus(game, { actor: base.owner,
      action: { type: 'decision', event: game.decision.event, allow: true } }, actions);
  assert.equal(game.response?.kind, 'guildRate');
  return { ...base, game, beforeAction, sources, destination, actions, karama,
    action: choice.action,
    cancel: { actor: base.observer, action: { type: 'card', mode: 'cancel', card: karama } as Action },
    provenance: ['Controlled prior Nexus Guild fixture; physical hand acquisition is controlled, not auctioned.',
      'Actual completed first combined turn, actual Cunning, and actual second typed Homeworld declaration.'] };
}
