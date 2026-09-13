import { fighterCount } from './advisors';
import type { Card } from './cards';
import type { FactionId } from './catalog';
import type { ForcePresence } from './force-presence';
import { canUseAsKarama } from './karama';

export const SHRINE = 'shrine';

type ShrinePlayer = {
  id: string;
  faction: FactionId;
  advisors?: Record<string, { lockedTurn?: number }>;
} & ForcePresence;

type ShrineContext = {
  advanced: boolean;
  discoveries?: {
    tokens: readonly {
      face: string | null;
      status: string;
      revealedTurn: number | null;
    }[];
  } | null;
};

type ShrineBotContext = ShrineContext & {
  status: string;
  phase: number;
  truthtrance?: object | null;
  response?: object | null;
  decision?: object | null;
  phaseOpening?: object | null;
  automaticContinuationPending?: boolean;
  battle?: {
    attacker: string;
    defender: string;
    revealed: boolean;
  } | null;
};

/** Public board entitlement only. A private peek at Shrine does not activate it. */
export function occupiesRevealedShrine(
  context: ShrineContext,
  player: ShrinePlayer,
): boolean {
  const revealed = context.discoveries?.tokens.some(
    (token) =>
      token.face === SHRINE &&
      token.status === 'placed' &&
      Number.isSafeInteger(token.revealedTurn) &&
      (token.revealedTurn ?? 0) >= 1,
  );
  return !!revealed && fighterCount(player, SHRINE) > 0;
}

/** Printed identity remains unchanged; this answers only the card's role at use. */
export function canUseAsKaramaRole(
  context: ShrineContext,
  player: ShrinePlayer,
  card: Card,
): boolean {
  return (
    canUseAsKarama(context.advanced, player.faction, card) ||
    (card.effect === 'truthtrance' &&
      occupiesRevealedShrine(context, player))
  );
}

/** A committed conversion is recorded by the Truthtrance queue; this checks a new use. */
export function canUseAsTruthtranceRole(
  context: ShrineContext,
  player: ShrinePlayer,
  card: Card,
): boolean {
  return (
    card.effect === 'truthtrance' ||
    (card.effect === 'karama' && occupiesRevealedShrine(context, player))
  );
}

/** Bounded policy: a Shrine-occupying combatant may ask through the existing AI question path. */
export function shrineTruthtranceBotAction(
  context: ShrineBotContext,
  player: ShrinePlayer & { hand?: readonly Card[] },
) {
  const battle = context.battle;
  if (
    context.status !== 'playing' ||
    context.phase !== 6 ||
    !battle ||
    battle.revealed ||
    ![battle.attacker, battle.defender].includes(player.id) ||
    context.truthtrance ||
    context.response ||
    context.decision ||
    context.phaseOpening ||
    context.automaticContinuationPending ||
    !occupiesRevealedShrine(context, player)
  )
    return null;
  const card = player.hand?.find(
    (candidate) =>
      candidate.effect === 'karama' &&
      canUseAsTruthtranceRole(context, player, candidate),
  );
  return card
    ? {
        type: 'card',
        card: card.id,
        shrineTruthtrance: [card.id],
      }
    : null;
}
