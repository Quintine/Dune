import type { Game } from './engine';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';

type HomeworldBenefitContext = Pick<
  Game,
  'advanced' | 'players' | 'homeworlds'
>;
export type HomeworldRevivalOpening = {
  turn: number;
  tleilaxu: { player: string; low: boolean };
};
export class HomeworldBenefitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HomeworldBenefitError';
  }
}

/** Current native population only. The caller owns benefit timing and all
 * ordinary eligibility; Salusa never supplies another low-population bonus. */
export function homeworldLowBonus(
  context: HomeworldBenefitContext,
  playerId: string,
): 0 | 1 {
  if (!context.homeworlds?.custody) return 0;
  return homeworldPopulations(
    homeworldContext(context),
    context.homeworlds.custody,
  ).some(
    (home) =>
      home.native === playerId &&
      home.card !== 'salusa_secundus' &&
      home.side === 'low',
  )
    ? 1
    : 0;
}

/** Keep the unresolved special-Karama overlap consistent in validation and
 * the public controls. This is a release boundary, not a rules exception. */
export function homeworldRevivalKaramaBlock(
  context: HomeworldBenefitContext,
  target: string,
): string | null {
  return homeworldLowBonus(context, target)
    ? 'Special Karama against a low-population Homeworld awaits the revival-overlap ruling.'
    : null;
}

/** Salusa's threshold counts Sardaukar at Salusa, not all Imperial reserves.
 * Its high advantage affects the faction's Sardaukar wherever they fight. */
export function homeworldSardaukarFreeSupport(
  context: HomeworldBenefitContext,
  playerId: string,
): boolean {
  if (!context.advanced || !context.homeworlds?.custody) return false;
  if (
    !context.players.some((p) => p.id === playerId && p.faction === 'emperor')
  )
    return false;
  return homeworldPopulations(
    homeworldContext(context),
    context.homeworlds.custody,
  ).some(
    (home) =>
      home.native === playerId &&
      home.card === 'salusa_secundus' &&
      home.side === 'high',
  );
}

/** Temporary release boundary: a population-changing return during combat
 * must not invalidate sealed dials/support or earlier binding answers. Use
 * public battle participation, never an opponent's hidden plan contents. */
export function homeworldSardaukarGholaBlock(
  context: HomeworldBenefitContext & Pick<Game, 'battle'>,
  playerId: string,
): string | null {
  if (
    !context.advanced ||
    !context.homeworlds?.custody ||
    !context.battle ||
    ![context.battle.attacker, context.battle.defender].includes(playerId) ||
    !context.players.some((p) => p.id === playerId && p.faction === 'emperor')
  )
    return null;
  return homeworldPopulations(
    homeworldContext(context),
    context.homeworlds.custody,
  ).some(
    (home) =>
      home.native === playerId &&
      home.card === 'salusa_secundus' &&
      home.population === 1,
  )
    ? 'Ghola raising Salusa to high population during the Emperor’s battle awaits its battle-support timing ruling.'
    : null;
}

const validTurn = (turn: unknown): turn is number =>
  typeof turn === 'number' && Number.isSafeInteger(turn) && turn > 0;

/** Capture before any revival-opening effect can change native population.
 * A saved receipt owns this phase's Tleilaxu free-revival income restriction. */
export function snapshotHomeworldRevival(
  context: HomeworldBenefitContext & Pick<Game, 'turn'>,
): HomeworldRevivalOpening | null {
  if (!context.homeworlds?.custody) return null;
  const tleilaxu = context.players.find(
    (player) => player.faction === 'tleilaxu',
  );
  if (!tleilaxu) return null;
  if (!validTurn(context.turn))
    throw new HomeworldBenefitError(
      'The Homeworld revival opening needs a valid current turn.',
    );
  return {
    turn: context.turn,
    tleilaxu: {
      player: tleilaxu.id,
      low: homeworldLowBonus(context, tleilaxu.id) === 1,
    },
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Read only the saved opening decision. Never infer a missing receipt from
 * current populations: earlier revivals may already have crossed a threshold.
 * This answers only the free-revival income gate, not Ghola purchase income. */
export function tleilaxuHomeworldFreeIncomeBlocked(
  context: HomeworldBenefitContext &
    Pick<Game, 'turn' | 'phase'> & {
      homeworldRevival?: HomeworldRevivalOpening | null;
    },
): boolean {
  if (context.phase !== 4 || !context.homeworlds) return false;
  const tleilaxu = context.players.filter(
    (player) => player.faction === 'tleilaxu',
  );
  if (!tleilaxu.length) return false;
  const receipt: unknown = context.homeworldRevival;
  if (
    tleilaxu.length !== 1 ||
    !validTurn(context.turn) ||
    !record(receipt) ||
    Object.keys(receipt).length !== 2 ||
    !Object.hasOwn(receipt, 'turn') ||
    !Object.hasOwn(receipt, 'tleilaxu') ||
    receipt.turn !== context.turn ||
    !record(receipt.tleilaxu) ||
    Object.keys(receipt.tleilaxu).length !== 2 ||
    !Object.hasOwn(receipt.tleilaxu, 'player') ||
    !Object.hasOwn(receipt.tleilaxu, 'low') ||
    typeof receipt.tleilaxu.player !== 'string' ||
    !receipt.tleilaxu.player.trim() ||
    receipt.tleilaxu.player !== tleilaxu[0].id ||
    typeof receipt.tleilaxu.low !== 'boolean'
  )
    throw new HomeworldBenefitError(
      'The current Tleilaxu Homeworld revival-opening receipt is missing, stale or malformed.',
    );
  return receipt.tleilaxu.low;
}
