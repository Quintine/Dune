import type { Game } from './engine';
import { location, validLocation } from './board';
import { HomeworldCustodyError } from './homeworld-custody';
import { validateHomeworldVictoryReturn } from './homeworld-victory-return';

export type CaladanArrivalContext = Pick<Game, 'status' | 'turn' | 'phase' | 'players' |
  'homeworlds' | 'lastBattleContext' | 'homeworldVictoryReinforcement'>;
export type CaladanArrivalDetails = {
  victoryEvent?: string;
  entrant: string;
  territory: string;
  sector: number;
  amount: number;
  elite: number;
  cause: string;
};

/** Validate the committed original addition, not the army after a reaction.
 * Atomics, alliances and other accepted effects may already have changed it. */
export function validateCaladanArrivalSource(g: CaladanArrivalContext, entry: CaladanArrivalDetails): void {
  validateHomeworldVictoryReturn(g);
  const frame = g.homeworldVictoryReinforcement;
  if (g.status !== 'playing' || g.phase !== 6 || !frame || frame.stage !== 'arrival' ||
    frame.turn !== g.turn || frame.phase !== g.phase || entry.victoryEvent !== frame.event ||
    entry.entrant !== frame.player || entry.cause !== 'caladanReinforcement' ||
    entry.amount !== 1 || entry.elite !== 0 || !validLocation(entry.territory, entry.sector) ||
    frame.destination !== location(entry.territory, entry.sector))
    throw new HomeworldCustodyError('The Caladan arrival has lost its original committed victory reinforcement.');
}

export function caladanOwnsTerrorEntry(g: CaladanArrivalContext, entry: CaladanArrivalDetails): boolean {
  try { validateCaladanArrivalSource(g, entry); return true; }
  catch (error) {
    if (error instanceof HomeworldCustodyError) return false;
    throw error;
  }
}
