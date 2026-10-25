import { nexusGuildSecretAllyQuote } from './nexus-guild-secret-ally-options';
import type { Action, GameView } from './engine';
import { nexusRicheseQuote } from './nexus-richese-options';
import { quoteRicheseHomeworldPair } from './richese-homeworld-shipment';
import { reserveShipmentCost } from './shipment-price';
import { territory } from './board';


export function botHomeworldShipmentPaymentAllowed(g: GameView, action: Action): boolean {
  if (!['ship', 'guildShip'].includes(action.type)) return true;
  const to = String(action.territory);
  const amount = action.noField ? 1 : action.forces ? Object.values(action.forces as Record<string, number>).reduce((sum, n) => sum + n, 0) : Number(action.amount);
  if (action.revealedToken !== undefined) {
    const offer = g.nexusRicheseCunning;
    const info = g.richeseNoField;
    const me = g.players.find(player => player.id === g.me);
    const revealed = info?.private?.tokens.find(token => token.id === action.revealedToken);
    const concealed = info?.private?.tokens.find(token => token.id === action.noField);
    const paid = action.noFieldReserves ?? 0;
    if (action.type !== 'ship' || !offer || offer.blocked || action.nexus !== offer.event ||
      info?.owner !== g.me || !me || !revealed || !concealed ||
      revealed.id === concealed.id || revealed.id === info.private?.lastShipped ||
      concealed.id === info.private?.lastShipped || action.allyPayment !== 0 ||
      typeof paid !== 'number' || (action.noFieldReserves !== undefined && paid <= 0)) return false;
    try {
      const group = quoteRicheseHomeworldPair({ enabled: !!info.homeworldForcesEnabled,
        reserves: me.reserves, amount: paid,
        revealedValue: revealed.value });
      return reserveShipmentCost({ faction: me.faction, halfRate: g.karamaShipping?.player === me.id },
        territory(to).type, group.priced) <= (me.spice ?? 0);
    } catch { return false; }
  }
  const guildSource = action.nexus !== undefined && action.nexus === g.nexusGuildSecretAlly?.event;
  const nexusQuote = action.nexus === undefined ? null : guildSource ? nexusGuildSecretAllyQuote(g, to, amount) : nexusRicheseQuote(g, to, amount);
  if (action.nexus !== undefined && (!nexusQuote || (!guildSource && (action.nexus !== g.nexusRichese?.event || action.type !== 'ship')) || action.noField !== undefined)) return false;
  return true;
}
