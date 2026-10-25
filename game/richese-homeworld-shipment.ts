import type { Game } from './engine';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';

type RicheseHomeworldContext = Pick<Game, 'advanced' | 'players' | 'homeworlds'>;
export type RicheseHomeworldForcesInput = {
  enabled: boolean;
  reserves: number;
  amount: number;
  smuggler?: boolean;
};
export type RicheseHomeworldForcesQuote = { paid: number; physical: number; priced: number };

export class RicheseHomeworldShipmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RicheseHomeworldShipmentError';
  }
}

/** The printed High Richese modifier applies in either rules band, using only
 * native counters currently at Richese rather than foreign visitors. */
export function richeseHomeworldShipmentEnabled(context: RicheseHomeworldContext, playerId: string): boolean {
  if (!context.homeworlds?.custody ||
    !context.players.some(player => player.id === playerId && player.faction === 'richese')) return false;
  return homeworldPopulations(homeworldContext(context), context.homeworlds.custody)
    .some(home => home.native === playerId && home.card === 'richese' && home.side === 'high');
}

const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 20;

/** One priced No-Field marker plus the selected paid physical reserve forces.
 * The concealed value never supplies counters or changes this invoice. */
export function quoteRicheseHomeworldForces(input: RicheseHomeworldForcesInput): RicheseHomeworldForcesQuote {
  const { enabled, reserves, amount, smuggler } = input;
  if (typeof enabled !== 'boolean' || !count(reserves) || !count(amount) ||
    (smuggler !== undefined && typeof smuggler !== 'boolean'))
    throw new RicheseHomeworldShipmentError('Choose zero to twenty physical reserve forces and a valid shipment source.');
  if (amount > 0 && !enabled)
    throw new RicheseHomeworldShipmentError('Paid forces alongside a No-Field require native Richese at High population.');
  const physical = amount + (smuggler ? 1 : 0);
  if (physical > reserves)
    throw new RicheseHomeworldShipmentError('The paid forces and any Smuggler force must fit the available physical reserves.');
  return { paid: amount, physical, priced: 1 + amount };
}
