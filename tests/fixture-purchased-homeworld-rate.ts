import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { homeworldShipmentChoice, type HomeworldShipmentSources } from '../game/homeworld-shipment-options';
import { guildHomeworldShipmentChoice } from '../game/guild-homeworld-shipment-options';
import { createGuildAmbassadorIncomeArrival, passNativeGuildTransportPermission } from './fixture-guild-ambassador-income-arrival';
import {
  createNativeGuildHomeworldRate, createNativeGuildHomeworldRateScene,
  type NativeGuildHomeworldRoute,
} from './fixture-native-guild-homeworld-rate';
import { holdGuildCunningCard } from './fixture-nexus-guild-cunning';
import {
  pairedE3NexusReload, stepPairedE3Nexus, type PairedE3NexusStep,
} from './fixture-paired-e3-nexus-modules';

export type PurchasedHomeworldRoute = 'world' | 'guildWorld' | 'arrakisForeign' | 'return';
export interface PurchasedHomeworldRateFixture {
  route: PurchasedHomeworldRoute;
  shipper: string;
  ecaz: string;
  guild: string;
  entrant: string;
  karama: string;
  source: string;
  destination: string;
  sources: HomeworldShipmentSources;
  allyPayment: number;
  beforePurchase: Game;
  beforeAction: Game;
  action: Action;
  actions: PairedE3NexusStep[];
  provenance: string[];
}

function purchase(base: {
  beforeAction: Game; ecaz: string; guild: string; entrant: string; karama: string;
  actions: PairedE3NexusStep[]; provenance: string[];
}, route: PurchasedHomeworldRoute, source: string, destination: string, allyPayment: number) {
  const actions = [...base.actions];
  const shipper = route === 'world' ? base.entrant : base.guild;
  const beforePurchase = pairedE3NexusReload(base.beforeAction);
  assert.equal(beforePurchase.active, shipper);
  assert.ok(beforePurchase.players.find(p => p.id === base.ecaz)!.hand.some(c => c.id === base.karama));
  const game = stepPairedE3Nexus(beforePurchase, { actor: base.ecaz,
    action: { type: 'card', mode: 'shipment', card: base.karama, target: shipper } }, actions);
  assert.deepEqual(game.karamaShipping, { player: shipper, owner: base.ecaz, card: base.karama });
  const sources = { [source]: { normal: 3, elite: 0 } };
  const view = viewGame(game, shipper);
  const quote = route === 'world' || route === 'guildWorld'
    ? homeworldShipmentChoice(view, destination, sources, allyPayment)
    : guildHomeworldShipmentChoice(view, destination, sources, allyPayment);
  assert.equal(quote.blocked, null);
  assert.equal(quote.cost, 2);
  assert.ok(quote.action);
  return { ...base, route, shipper, source, destination, sources, allyPayment,
    actions, beforePurchase, beforeAction: pairedE3NexusReload(game), action: quote.action,
    provenance: [...base.provenance,
      'Ecaz plays its actual held Karama in shipment mode for the active beneficiary; no card identity is transferred.',
      'The original typed three-normal-counter route and explicit approved share are quoted after the independent purchase.'],
  } satisfies PurchasedHomeworldRateFixture;
}

/** Original printed setup and auctioned Ecaz card from the native Homeworld
 * factory. No played hand, wallet, army, phase, grant or decision is assigned.
 * The shared factories disclose conserved undealt Treachery/Spice ordering. */
export function createPurchasedHomeworldRate(route: PurchasedHomeworldRoute = 'world') {
  if (route === 'world') {
    const base = createGuildAmbassadorIncomeArrival({ homeworlds: true });
    return purchase(base, route, 'homeworld:moritani', 'homeworld:ecaz', 0);
  }
  const nativeRoute: NativeGuildHomeworldRoute = route === 'guildWorld' ? 'world' : route;
  const base = createNativeGuildHomeworldRate(nativeRoute);
  return purchase(base, route, base.source, base.destination, 1);
}

/** Actual declaration; the original automatic stop policy may complete it immediately. */
export function declarePurchasedHomeworldRate(f: PurchasedHomeworldRateFixture) {
  const actions: PairedE3NexusStep[] = [];
  const game = stepPairedE3Nexus(f.beforeAction, { actor: f.shipper, action: f.action }, actions);
  assert.notEqual(game.response?.kind, 'guildRate');
  return { game, actions };
}

export function createPurchasedHomeworldRateScene(route: PurchasedHomeworldRoute = 'world') {
  const fixture = createPurchasedHomeworldRate(route);
  const declared = declarePurchasedHomeworldRate(fixture);
  return { ...fixture, game: declared.game, declarationActions: declared.actions,
    allow: declared.game.decision?.kind === 'homeworldShipmentGuild'
      ? { actor: fixture.guild, action: { type: 'decision',
        event: declared.game.decision.event, allow: true } as Action } : null };
}

/** Continue only actual Guild interception/permission controls, never a native rate or income. */
export function completePurchasedHomeworldRate(state: Game) {
  const actions: PairedE3NexusStep[] = [];
  let game = pairedE3NexusReload(state);
  if (game.decision?.kind === 'homeworldShipmentGuild')
    game = stepPairedE3Nexus(game, { actor: game.decision.player,
      action: { type: 'decision', event: game.decision.event, allow: true } }, actions);
  const permission = passNativeGuildTransportPermission(game);
  return { game: permission.game, actions: [...actions, ...permission.actions] };
}

/** Explicitly controlled SECOND card acquisition only: the first auctioned
 * Ecaz Karama really cancels an unaffordable native Guild return. The existing
 * controlled physical-card helper supplies a second Karama to Ecaz; its later
 * purchase and typed return are real actions. Not original action-only custody. */
export function createControlledPurchasedHomeworldCanceledRate() {
  const native = createNativeGuildHomeworldRateScene('return', { unaffordable: true });
  const actions = [...native.actions, ...native.declarationActions];
  let game = stepPairedE3Nexus(native.game, native.cancel, actions);
  assert.equal(viewGame(game, native.guild).guildRateCanceled, true);
  assert.ok(!game.pendingHomeworldShipment);
  assert.equal(game.players.find(p => p.id === native.guild)!.shipped, false);
  const karama = holdGuildCunningCard(game, native.ecaz, 'karama').id;
  game = pairedE3NexusReload(game);
  const fixture = purchase({ ...native, beforeAction: game, karama, actions,
    provenance: [...native.provenance,
      'CONTROLLED second physical Karama acquisition via the existing held-card helper; no original-auction claim for this second card.'],
  }, 'return', native.source, native.destination, 1);
  return { ...fixture, canceledKarama: native.karama };
}
