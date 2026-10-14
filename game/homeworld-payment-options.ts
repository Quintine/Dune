import { nexusGuildSecretAllyQuote } from './nexus-guild-secret-ally-options';
import type { Action, GameView } from './engine';
import { nexusRicheseQuote } from './nexus-richese-options';


export function botHomeworldShipmentPaymentAllowed(g: GameView, action: Action): boolean {
  if (!['ship', 'guildShip'].includes(action.type)) return true;
  const to = String(action.territory);
  const amount = action.noField ? 1 : action.forces ? Object.values(action.forces as Record<string, number>).reduce((sum, n) => sum + n, 0) : Number(action.amount);
  if (action.revealedToken !== undefined) {
    const offer = g.nexusRicheseCunning;
    return action.noField !== undefined && !g.homeworlds && !!offer && !offer.blocked &&
      action.nexus === offer.event;
  }
  const guildSource = action.nexus !== undefined && action.nexus === g.nexusGuildSecretAlly?.event;
  const nexusQuote = action.nexus === undefined ? null : guildSource ? nexusGuildSecretAllyQuote(g, to, amount) : nexusRicheseQuote(g, to, amount);
  if (action.nexus !== undefined && (!nexusQuote || (!guildSource && (action.nexus !== g.nexusRichese?.event || action.type !== 'ship')) || action.noField !== undefined)) return false;
  return true;
}
