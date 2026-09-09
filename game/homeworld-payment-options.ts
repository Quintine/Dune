import type { Action, GameView } from './engine';
import { quoteGuildPaymentRounding } from './homeworld-payment-income';
import { reserveShipmentCost, guildShipmentCost } from './shipment-price';
import { territory } from './board';

/** Own funding and public native population only; no donor balance or hidden card access. */
export function homeworldShipmentPaymentBlock(g: GameView, cost: number, allyPayment: number): string | null {
  const guild = g.players.find(p => p.faction === 'guild');
  const me = g.players.find(p => p.id === g.me)!;
  if (!guild || g.karamaShipping?.player === g.me ||
    !g.homeworlds?.worlds?.some(world => world.card === 'junction' && world.side === 'low')) return null;
  const contributions = [me.id === guild.id ? 0 : cost - allyPayment,
    me.ally === guild.id ? 0 : allyPayment];
  return quoteGuildPaymentRounding(contributions[0] + contributions[1], contributions).unambiguous
    ? null : 'Low Junction rounding for two odd allied contributions awaits a ruling. Choose a different payment split.';
}

export function botHomeworldShipmentPaymentAllowed(g: GameView, action: Action): boolean {
  if (!['ship', 'guildShip'].includes(action.type)) return true;
  if (!g.homeworlds?.worlds?.some(world => world.card === 'junction' && world.side === 'low')) return true;
  const me = g.players.find(p => p.id === g.me)!;
  const to = String(action.territory);
  const amount = action.noField ? 1 : Number(action.amount);
  const cost = action.type === 'ship'
    ? reserveShipmentCost({ faction: me.faction, halfRate: me.faction === 'guild' ||
      g.players.some(p => p.faction === 'guild' && p.id === me.ally) || g.karamaShipping?.player === me.id }, territory(to).type, amount)
    : guildShipmentCost(to === 'reserves' ? 'reserves' : territory(to).type, amount);
  const share = action.allyPayment === undefined ? Math.max(0, cost - (me.spice ?? 0)) : Number(action.allyPayment);
  return !homeworldShipmentPaymentBlock(g, cost, share);
}
