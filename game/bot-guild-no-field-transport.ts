import { gameTerritories } from './board';
import type { Action, GameView } from './engine';
import { nexusGuildShipmentAvailable } from './nexus-guild-cunning-options';
import { nexusGuildSecretAllyAction, nexusGuildSecretAllyCanAct } from './nexus-guild-secret-ally-options';
import { guildTransportQuote } from './transport-quote';
import { isBoardNoFieldLocation } from './richese-no-field';

/** Minimal legal choices for the owned concealed marker, before auto-revelation.
 * The shared quotes own timing, entry, pricing and original source validation.
 */
export function guildNoFieldTransportActions(g: GameView): Action[] {
  const own = g.players.find(player => player.id === g.me);
  const inventory = g.richeseNoField;
  const marker = inventory?.owner === g.me ? inventory.private?.deployed : null;
  const publicMarker = inventory?.public.deployed;
  if (!own || own.shipped || !marker || !isBoardNoFieldLocation(marker.location) || marker.controller !== own.id || !publicMarker ||
    !isBoardNoFieldLocation(publicMarker.location) ||
    publicMarker.controller !== own.id || !inventory?.event ||
    !nexusGuildShipmentAvailable(g)) return [];
  const guild = g.players.find(player => player.faction === 'guild');
  const native = !!guild && own.ally === guild.id && guild.ally === own.id;
  const secret = nexusGuildSecretAllyCanAct(g);
  if (!native && !secret) return [];
  const origin = publicMarker.location.territory;
  const destinations = gameTerritories(g).flatMap(territory => territory.id === origin
    ? [] : territory.sectors.map(sector => ({ territory: territory.id, sector })));
  if (secret) destinations.push({ territory: 'reserves', sector: 0 });
  const actions: Action[] = [];
  for (const destination of destinations) {
    const packet: Action = { type: 'guildShip', noField: marker.tokenId, event: inventory.event,
      forces: {}, ...destination };
    const action = secret ? nexusGuildSecretAllyAction(g, g.nexusGuildSecretAlly!.event, packet) : packet;
    if (!action) continue;
    const quote = guildTransportQuote(g, action);
    if (!quote.unavailableReasons.length && quote.quote)
      actions.push({ ...action, allyPayment: quote.quote.pledgedPayment });
  }
  return actions;
}
