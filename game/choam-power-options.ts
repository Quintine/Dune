import { CHOAM_NEXUS_EFFECTS, type NexusChoamEffect } from './nexus-choam';
import type { Card } from './cards';
import type { Action, GameView } from './engine';

export type ChoamPowerEffect = NexusChoamEffect;
export type ChoamPowerPlay = {
  source: 'printed' | 'nexus';
  effect: ChoamPowerEffect;
  card: Card;
  event?: string;
  blocked: string | null;
};
export const CHOAM_POWER_NAMES = CHOAM_NEXUS_EFFECTS;
export const choamPowerKey = (play: ChoamPowerPlay) =>
  `${play.source}/${play.effect}/${play.card.id}/${play.event ?? ''}`;

/** Private server choices keep the physical cost separate from the effect. */
export function choamPowerPlays(
  game: GameView,
  effect: ChoamPowerEffect,
): ChoamPowerPlay[] {
  if (game.players.find((player) => player.id === game.me)?.faction !== 'choam')
    return [];
  const state = game.choamWorthless as
    | (NonNullable<GameView['choamWorthless']> & { plays?: ChoamPowerPlay[] })
    | null;
  if (!state) return [];
  // Older personalized fixtures retain the printed-only descriptor.
  const plays =
    state.plays ??
    state.cards
      .filter((card) => card.name === CHOAM_POWER_NAMES[effect])
      .map((card) => ({
        source: 'printed' as const,
        effect,
        card,
        blocked: null,
      }));
  return plays.filter((play) => play.effect === effect);
}

export function choamPowerAction(
  game: GameView,
  requested: ChoamPowerPlay,
  selection: Record<string, unknown> = {},
): Action | null {
  if (
    Object.keys(selection).some(
      (key) =>
        !['target', 'territory', 'from', 'elite', 'amount'].includes(key),
    )
  )
    return null;
  const owner = game.players.find((player) => player.id === game.me);
  if (
    owner?.faction !== 'choam' ||
    game.status !== 'playing' ||
    game.response ||
    game.truthtrance ||
    game.phaseOpening ||
    game.automaticContinuationPending ||
    game.nexusTraitors?.pending ||
    game.nexusCards?.waiting.length
  )
    return null;
  const play = choamPowerPlays(game, requested.effect).find(
    (candidate) => choamPowerKey(candidate) === choamPowerKey(requested),
  );
  if (!play || play.blocked || play.effect === 'kull') return null;
  const phases = { kulon: 5, laLaLa: 4, gamont: 8, baliset: 5, jubba: 0 };
  if (game.phase !== phases[play.effect]) return null;
  const decisions = {
    kulon: null,
    laLaLa: 'choamFreeRevival',
    gamont: 'choamMentat',
    baliset: 'choamMovement',
    jubba: 'choamStorm',
  };
  if (
    game.decision &&
    (game.decision.kind !== decisions[play.effect] ||
      game.decision.player !== game.me)
  )
    return null;
  if (play.effect === 'jubba' && game.decision?.kind !== 'choamStorm')
    return null;
  if (
    play.effect === 'kulon' &&
    (game.active !== game.me || (owner.moved ?? 0) >= (owner.movesAllowed ?? 1))
  )
    return null;
  if (
    play.source === 'nexus' &&
    (!play.event || owner.ally || game.nexusCards?.card !== 'choam')
  )
    return null;
  if (
    play.source === 'printed' &&
    (play.card.kind !== 'worthless' ||
      play.card.name !== CHOAM_POWER_NAMES[play.effect])
  )
    return null;
  return {
    ...selection,
    type: 'card',
    mode: 'choam',
    card: play.card.id,
    ...(play.source === 'nexus'
      ? { nexus: play.event, effect: play.effect }
      : {}),
  };
}

/** Preserve printed powers first, then choose the cheapest legal Nexus fuel. */
export function choamPowerBotPlay(
  game: GameView,
  effect: ChoamPowerEffect,
  value: (card: Card) => number,
): ChoamPowerPlay | undefined {
  return choamPowerPlays(game, effect)
    .filter((play) => choamPowerAction(game, play))
    .sort(
      (a, b) =>
        Number(a.source === 'nexus') - Number(b.source === 'nexus') ||
        value(a.card) - value(b.card) ||
        a.card.id.localeCompare(b.card.id),
    )[0];
}
