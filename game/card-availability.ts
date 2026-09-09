import { fighterCount } from './advisors';
import { TERRITORIES } from './board';
import { harvesterAvailable, type Card } from './cards';
import type { FactionId } from './catalog';
import { choamSaleGholaTiming } from './choam-market-ghola';

export type OrdinaryCardEffect =
  | 'weather'
  | 'atomics'
  | 'hajr'
  | 'harvester'
  | 'ghola';
export type OrdinaryCardPlayer = {
  id: string;
  faction: FactionId;
  forces: Record<string, number>;
  advisors?: Record<string, { lockedTurn?: number }>;
  hand?: readonly Card[];
  movesAllowed?: number;
};
/** Only public state and the current viewer's own hand are inspected. */
export type OrdinaryCardState = {
  status: 'lobby' | 'setup' | 'playing' | 'finished';
  phase: number;
  active: string | null;
  me: string;
  truthtrance?: { stage: string } | null;
  phaseOpening?: { passed: readonly string[] } | null;
  response?: object | null;
  decision?: object | null;
  choamMarket?: { owner: string } | null;
  shieldWallDestroyed: boolean;
  spiceWindow?: {
    harvested: boolean;
    harvesters?: number;
    harvesterClosed?: boolean;
  } | null;
  players: readonly OrdinaryCardPlayer[];
};
export type OrdinaryCardSelection = { amount: unknown };
export type OrdinaryCardAvailability =
  | { available: true }
  | { available: false; reason: string };

/**
 * Pure ordinary-card validation: no actions, mutations, random draws, or hidden
 * opponent data. A null result leaves other card effects to their own validators.
 * Omit selection for a timing-only preview; pass it to validate Weather's dial.
 * This describes an ordinary {type:'card',card,...} activation, without a mode.
 */
export function ordinaryCardAvailability(
  state: OrdinaryCardState,
  cardId: string,
  selection?: OrdinaryCardSelection,
): OrdinaryCardAvailability | null {
  const blocked = (reason: string): OrdinaryCardAvailability => ({
    available: false,
    reason,
  });
  const own = state.players.find((p) => p.id === state.me);
  if (!own) return blocked('You are not seated at this table.');
  const card = own.hand?.find((c) => c.id === cardId);
  if (
    card &&
    !['weather', 'atomics', 'hajr', 'harvester', 'ghola'].includes(
      card.effect ?? '',
    )
  )
    return null;

  // Match the enclosing ordinary-card dispatcher gates in their existing order.
  if (state.status === 'finished') return blocked('This game has ended.');
  if (state.truthtrance)
    return blocked(
      state.truthtrance.stage === 'priority'
        ? 'Declare Truthtrance or pass its priority window first.'
        : 'Waiting for the questioned player to answer Truthtrance.',
    );
  if (state.phaseOpening) {
    if (state.status !== 'playing')
      return blocked('Phase opening requires an active game.');
    if (state.phaseOpening.passed.includes(state.me))
      return blocked('You have already passed the phase opening.');
    return blocked(
      'Play Amal or pass the phase opening before taking other actions.',
    );
  }
  if (state.response && !(card?.effect === 'ghola' && choamSaleGholaTiming(state)))
    return blocked('Resolve the Karama response window first.');
  if (state.decision)
    return blocked('Waiting for the player with the pending decision.');
  if (state.status === 'lobby')
    return blocked('That action is not available in the lobby.');
  if (state.status === 'setup')
    return blocked('Complete the starting choices.');
  if (!card || card.kind !== 'special')
    return blocked('Select a special card in your hand.');

  switch (card.effect as OrdinaryCardEffect) {
    case 'hajr':
      if (
        state.phase !== 5 ||
        state.active !== state.me ||
        own.movesAllowed !== 1
      )
        return blocked('Use Hajr during your movement.');
      break;
    case 'harvester':
      if (state.phase !== 1 || !harvesterAvailable(state.spiceWindow))
        return blocked(
          'Play Harvester immediately after a spice blow, before it is accepted.',
        );
      break;
    case 'weather':
      if (state.phase !== 0)
        return blocked('Play Weather Control before the storm moves.');
      if (
        selection &&
        (typeof selection.amount !== 'number' ||
          !Number.isSafeInteger(selection.amount) ||
          selection.amount < 0 ||
          selection.amount > 10)
      )
        return blocked('Storm movement must be an integer from 0 to 10.');
      break;
    case 'atomics':
      if (state.shieldWallDestroyed || state.phase !== 0)
        return blocked('Play Family Atomics before storm movement.');
      if (
        !TERRITORIES.some(
          (t) =>
            (t.id === 'shield_wall' || t.neighbors.includes('shield_wall')) &&
            fighterCount(own, t.id) > 0,
        )
      )
        return blocked('You need forces on or adjacent to the Shield Wall.');
      break;
  }
  return { available: true };
}
