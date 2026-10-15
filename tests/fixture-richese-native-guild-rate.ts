import assert from 'node:assert/strict';
import { viewGame, type Action } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { nexusCardAction } from '../game/nexus-card-options';
import { nexusRicheseAction, nexusRicheseQuote } from '../game/nexus-richese-options';
import { createGuildAmbassadorIncomeArrival } from './fixture-guild-ambassador-income-arrival';
import {
  advancePairedE3Nexus, pairedE3NexusClean, pairedE3NexusPlayer,
  pairedE3NexusReload, quietPairedE3NexusChoice, stepPairedE3Nexus,
} from './fixture-paired-e3-nexus-modules';
import { cancelNativeGuildRateModules } from './fixture-native-guild-rate-modules';

/** Original setup, real paid Ecaz Karama, real Ecaz/Moritani alliance and
 * Guild Nexus draw. Only conserved UNDEALT Spice/Nexus order is selected;
 * no played hand, wallet, army, phase or response is assigned. */
export function createRicheseNativeGuildRate(options: {
  poor?: boolean;
  priorCancellation?: boolean;
  purchased?: boolean;
  homeworlds?: boolean;
  destinationType?: 'sand' | 'stronghold';
} = {}) {
  const original = createGuildAmbassadorIncomeArrival({ homeworlds: !!options.homeworlds });
  const prefix = original.actions.findIndex(s => s.actor === original.entrant &&
    s.action.type === 'alliance' && s.action.target === original.guild);
  assert.ok(prefix >= 0);
  const actions = original.actions.slice(0, prefix);
  let game = pairedE3NexusReload(original.beforeAlliance);
  const cards = game.nexusCards!.cards!;
  assert.ok(Object.values(cards.hands).every(card => card === null));
  const at = cards.deck.indexOf('richese'); assert.ok(at >= 0);
  cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  for (const [actor, target] of [[original.ecaz, original.entrant], [original.entrant, original.ecaz]])
    game = stepPairedE3Nexus(game, { actor, action: { type: 'alliance', target } }, actions);
  game = advancePairedE3Nexus(game, state => state.nexusCards?.phase?.stage === 'drawing' &&
    pairedE3NexusClean(state), actions, quietPairedE3NexusChoice);
  assert.equal(pairedE3NexusPlayer(game, original.guild).ally, null);
  const draw = nexusCardAction(viewGame(game, original.guild), 'draw'); assert.ok(draw);
  game = stepPairedE3Nexus(game, { actor: original.guild, action: draw }, actions);
  assert.equal(game.nexusCards!.cards!.hands[original.guild], 'richese');
  game = advancePairedE3Nexus(game, state => state.phase === 5 && state.active === original.guild &&
    pairedE3NexusClean(state), actions, quietPairedE3NexusChoice);
  const source = pairedE3NexusReload(game);
  const destination = TERRITORIES.find(t => t.type === (options.destinationType ?? 'sand') &&
    t.sectors.some(sector => sector !== game.storm) &&
    game.players.every(player => presenceAt(player, t.id) === 0));
  assert.ok(destination);
  const sector = destination.sectors.find(s => s !== game.storm)!;
  if (options.poor || options.priorCancellation) {
    const excess = pairedE3NexusPlayer(game, original.guild).spice - 1;
    assert.ok(excess >= 0);
    if (excess) game = stepPairedE3Nexus(game, { actor: original.guild,
      action: { type: 'bribe', target: original.ecaz, amount: excess } }, actions);
  }
  if (options.priorCancellation) {
    game = stepPairedE3Nexus(game, { actor: original.guild,
      action: { type: 'ship', territory: destination.id, sector, amount: 1, elite: 0 } }, actions);
    if (game.decision?.kind === 'guildShipment') game = stepPairedE3Nexus(game,
      { actor: original.guild, action: { type: 'decision', allow: true } }, actions);
    const canceled = cancelNativeGuildRateModules(game, original.ecaz, original.karama);
    game = canceled.game; actions.push(...canceled.actions);
    assert.equal(pairedE3NexusPlayer(game, original.guild).shipped, false);
    assert.equal(game.nexusCards!.cards!.hands[original.guild], 'richese');
  }
  if (options.purchased) game = stepPairedE3Nexus(game, { actor: original.ecaz,
    action: { type: 'card', card: original.karama, mode: 'shipment', target: original.guild } }, actions);
  const view = viewGame(game, original.guild);
  const quote = nexusRicheseQuote(view, destination.id, 5); assert.ok(quote);
  const shipment: Action = { type: 'ship', territory: destination.id, sector,
    amount: 5, elite: 0, allyPayment: 0 };
  if (options.homeworlds) shipment.homeworldSources = { 'homeworld:guild': { normal: 5, elite: 0 } };
  const action = nexusRicheseAction(view, view.nexusRichese!.event, shipment); assert.ok(action);
  return { original, source, actions, beforeAction: pairedE3NexusReload(game), action, quote,
    guild: original.guild, canceler: original.ecaz, karama: original.karama,
    destination: destination.id, sector, target: `${destination.id}:${sector}`,
    provenance: [...original.provenance,
      'Conserved original undealt Richese Nexus moved to the next draw; no card identity invented.',
      'Actual Ecaz/Moritani alliance leaves Guild unallied; original Guild chooses its real Nexus draw.',
      'Actual quiet progression to Guild turn; optional bribe, prior rate cancellation or purchased price are real actions.'] };
}

export function declareRicheseNativeGuildRate(fixture: ReturnType<typeof createRicheseNativeGuildRate>) {
  let game = stepPairedE3Nexus(fixture.beforeAction, { actor: fixture.guild, action: fixture.action });
  if (game.decision?.kind === 'guildShipment') game = stepPairedE3Nexus(game,
    { actor: fixture.guild, action: { type: 'decision', allow: true } });
  return game;
}
