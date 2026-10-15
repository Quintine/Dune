import assert from 'node:assert/strict';
import { viewGame, type Action } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { junctionTransportChoice } from '../game/junction-transport-options';
import { createPurchasedHomeworldRate } from './fixture-purchased-homeworld-rate';
import { pairedE3NexusReload, stepPairedE3Nexus, type PairedE3NexusStep } from './fixture-paired-e3-nexus-modules';
import { holdGuildCunningCard } from './fixture-nexus-guild-cunning';

export type PurchasedJunctionRoute = 'world' | 'arrakisReturn' | 'nativeArrival';
/** Actual auctioned card and original Guild high offer in either order. No
 * played wallet/army/phase/response is assigned. Poverty is an actual bribe;
 * the optional native-denial SECOND physical card is explicitly controlled. */
export function createJunctionPurchasedPrice(options: {
  rate?: 'half' | 'full'; order?: 'cardFirst' | 'offerFirst';
  route?: PurchasedJunctionRoute; poor?: boolean; nativeDenied?: boolean;
} = {}) {
  const original = createPurchasedHomeworldRate('world');
  const shipper = original.shipper, guild = original.guild, cardOwner = original.ecaz;
  const order = options.order ?? 'cardFirst', rate = options.rate ?? 'full', route = options.route ?? 'world';
  const actions: PairedE3NexusStep[] = [];
  let game = pairedE3NexusReload(order === 'cardFirst' ? original.beforeAction : original.beforePurchase);
  const source = pairedE3NexusReload(game);
  if (options.poor) game = stepPairedE3Nexus(game, { actor: shipper,
    action: { type: 'bribe', target: cardOwner, amount: game.players.find(p => p.id === shipper)!.spice - 2 } }, actions);
  const offer = () => {
    const projected = viewGame(game, guild).junctionTransport!;
    assert.ok(projected.canOffer);
    game = stepPairedE3Nexus(game, { actor: guild,
      action: { type: 'offerJunctionTransport', event: projected.offerEvent, rate } }, actions);
  };
  if (order === 'offerFirst') {
    offer();
    game = stepPairedE3Nexus(game, { actor: cardOwner,
      action: { type: 'card', mode: 'shipment', card: original.karama, target: shipper } }, actions);
  }
  if (options.nativeDenied) {
    const second = holdGuildCunningCard(game, cardOwner, 'karama');
    game = stepPairedE3Nexus(game, { actor: shipper, action: { type: 'guildShip',
      from: 'polar_sink:0', territory: 'carthag', sector: 11, amount: 3, elite: 0, allyPayment: 0 } }, actions);
    assert.equal(game.response?.kind, 'guildTransportPermission');
    game = stepPairedE3Nexus(game, { actor: cardOwner,
      action: { type: 'card', mode: 'cancel', card: second.id } }, actions);
    assert.equal(viewGame(game, shipper).guildTransportCanceled, true);
  }
  if (order === 'cardFirst') offer();
  const sand = TERRITORIES.find(t => t.type === 'sand' && t.sectors.some(s => s !== game.storm) &&
    game.players.every(p => Object.keys(p.forces).every(key => key.split(':')[0] !== t.id)))!;
  assert.ok(sand);
  const origin = route === 'arrakisReturn' ? 'polar_sink:0' : 'homeworld:moritani';
  const destination = route === 'arrakisReturn' ? 'homeworld:moritani' : route === 'nativeArrival'
    ? `${sand.id}:${sand.sectors.find(s => s !== game.storm)!}` : 'homeworld:ecaz';
  const sources = { [origin]: { normal: 3, elite: 0 } };
  const quote = junctionTransportChoice(viewGame(game, shipper), destination, sources, 0);
  assert.equal(quote.forfeitPurchasedRate, true);
  return { original, source, beforeAction: pairedE3NexusReload(game), actions, shipper, guild,
    cardOwner, card: original.karama, rate, order, route, origin, destination, sources, quote,
    action: quote.action as Action | null,
    provenance: [...original.provenance,
      `Actual ${order} order; immutable ${rate} Junction offer, original typed ${route} group.`,
      ...(options.poor ? ['Actual bribe leaves beneficiary two available spice.'] : []),
      ...(options.nativeDenied ? ['CONTROLLED conserved second physical Karama; actual native permission denial, original purchased grant retained.'] : [])] };
}
