import type { Game, Player } from './engine';
import { homeworldLowBonus } from './homeworld-benefits';

export type Inflation = {
  side: 'double' | 'cancel';
  placedTurn: number;
  updatedTurn: number;
  flipped: boolean;
};

/** The token changes charity starting the turn after placement. */
export function charityMultiplier(g: Pick<Game, 'turn' | 'inflation'>) {
  if (!g.inflation || g.turn <= g.inflation.placedTurn) return 1;
  return g.inflation.side === 'double' ? 2 : 0;
}

/** Separate ordinary funding from the Homeworld addition paid by the bank.
 * Inflation changes both eligible portions, never the ordinary wealth threshold.
 * This quote does not claim, pay, or resolve a Bene Gesserit power response. */
export function charityQuote(
  g: Pick<Game, 'advanced' | 'turn' | 'inflation' | 'players' | 'homeworlds'>,
  p: Pick<Player, 'id' | 'spice' | 'faction'>,
): { ordinary: number; homeworld: number; total: number } {
  const eligible =
    g.advanced && p.faction === 'beneGesserit' ? 2 : Math.max(0, 2 - p.spice);
  const multiplier = charityMultiplier(g);
  const ordinary = eligible * multiplier;
  const homeworld = eligible > 0 ? homeworldLowBonus(g, p.id) * multiplier : 0;
  return { ordinary, homeworld, total: ordinary + homeworld };
}

export function charityAmount(
  g: Pick<Game, 'advanced' | 'turn' | 'inflation' | 'players' | 'homeworlds'>,
  p: Pick<Player, 'id' | 'spice' | 'faction'>,
) {
  return charityQuote(g, p).total;
}

export function charityPayer(
  g: Pick<Game, 'players' | 'turn' | 'choamCharity'>,
) {
  return g.choamCharity?.turn === g.turn && !g.choamCharity.canceled
    ? g.players.find((p) => p.faction === 'choam')
    : undefined;
}
