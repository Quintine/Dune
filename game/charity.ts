import type { Game, Player } from './engine';

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

/** Inflation doubles the ordinary amount received, not the wealth threshold. */
export function charityAmount(
  g: Pick<Game, 'advanced' | 'turn' | 'inflation'>,
  p: Pick<Player, 'spice' | 'faction'>,
) {
  const amount =
    g.advanced && p.faction === 'beneGesserit' ? 2 : Math.max(0, 2 - p.spice);
  return amount * charityMultiplier(g);
}

export function charityPayer(
  g: Pick<Game, 'players' | 'turn' | 'choamCharity'>,
) {
  return g.choamCharity?.turn === g.turn && !g.choamCharity.canceled
    ? g.players.find((p) => p.faction === 'choam')
    : undefined;
}
