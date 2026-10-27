import type { Game } from './engine';
import { homeworldForceGroups } from './homeworld-custody';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';
import {
  quoteStableHomeworldOccupation,
  type StableHomeworldOccupationContext,
} from './homeworld-stable-occupation';

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

/** The Low Salusa penalty applies to free Sardaukar revival independently of
 * the revival source and its limits. An established occupation retains that
 * penalty after native repopulation until the original occupier leaves. */
export function homeworldSardaukarFreeRevivalBlock(
  context: HomeworldBenefitContext & StableHomeworldOccupationContext,
  playerId: string,
): string | null {
  if (
    !context.advanced ||
    !context.homeworlds?.custody ||
    !context.players.some((player) => player.id === playerId && player.faction === 'emperor')
  ) return null;

  const physical = homeworldContext(context);
  const salusa = homeworldPopulations(physical, context.homeworlds.custody).find(
    (home) => home.native === playerId && home.card === 'salusa_secundus',
  );
  if (!salusa) return null;
  const penalty = 'Salusa Secundus prohibits free Sardaukar revival while its low-population penalty applies.';
  if (salusa.side === 'low') return penalty;

  // Older profiles do not have the occupation history needed to distinguish
  // a retained occupier from an unqualified visitor. Do not infer either.
  if (!context.homeworldOccupationPreview) {
    const world = homeworldForceGroups(physical, context.homeworlds.custody).find(
      (home) => home.id === salusa.location,
    );
    if (world && Object.entries(world.forces).some(([id, forces]) =>
      id !== playerId && forces.normal + forces.elite > 0,
    )) return 'Salusa occupation eligibility requires the original Homeworld qualification history.';
    return null;
  }
  const occupation = quoteStableHomeworldOccupation(context, 'salusa_secundus');
  if (occupation.blocked) return occupation.blocked;
  return occupation.entitlement ? penalty : null;
}

/** One returned star crosses Salusa's current threshold during its native
 * player's battle. The caller still owns card timing and actual return count. */
export function homeworldSardaukarGholaCrossing(
  context: HomeworldBenefitContext & Pick<Game, 'battle'>,
  playerId: string,
): boolean {
  if (
    !context.advanced ||
    !context.homeworlds?.custody ||
    !context.battle ||
    ![context.battle.attacker, context.battle.defender].includes(playerId) ||
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
      home.population === 1,
  );
}

/** Current population can change before sealed plans. The caller renews
 * impossible inspections and enforces voluntary Truthtrance promises after
 * the physical return. Inspect submission presence, never hidden plan values. */
export function homeworldSardaukarGholaBlock(
  context: HomeworldBenefitContext & Pick<Game, 'battle'>,
  playerId: string,
): string | null {
  if (!homeworldSardaukarGholaCrossing(context, playerId)) return null;
  const battle = context.battle!;
  const committed = battle.revealed || Object.keys(battle.plans).length > 0;
  return committed
    ? 'Ghola raising Salusa to high population after a sealed plan is not yet supported. Finish this battle first.'
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
