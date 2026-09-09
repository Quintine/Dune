import { gameTerritories, splitLocation } from './board';
import type { Action, GameView } from './engine';

/** Use the server's source-specific timing boundary for the selected group. */
export function homeworldRevivalActionBlock(g: GameView, action: Action): string | null {
  const me = g.players.find((player) => player.id === g.me);
  if (!me || action.leader) return null;
  const source = action.type === 'revive'
    ? 'normal'
    : action.type === 'card' && me.hand?.some((card) => card.id === action.card && card.effect === 'ghola')
      ? 'ghola'
      : null;
  if (!source) return null;
  const amount = action.amount === undefined && source === 'ghola'
    ? Math.min(5, me.tanks)
    : Number(action.amount);
  const elite = action.elite === undefined
    ? Math.max(0, amount - (me.tanks - (me.elites?.tanks ?? 0)))
    : Number(action.elite);
  return g.homeworldRevivalBlocks?.find((block) =>
    block.source === source && block.amount === amount && block.elite === elite)?.reason ?? null;
}

/** Consume the actor's projected destinations; never reconstruct eligibility
 * from reserves or another player's private state. */
export function homeworldRevivalDeploymentCanAct(g: GameView): boolean {
  return !!(
    g.status === 'playing' &&
    g.homeworldRevivalDeployment?.player === g.me &&
    g.decision?.kind === 'homeworldRevivalDeployment' &&
    g.decision.player === g.me &&
    g.decision.event === g.homeworldRevivalDeployment.event &&
    !g.response &&
    !g.truthtrance &&
    !g.phaseOpening &&
    !g.automaticContinuationPending
  );
}

export function homeworldRevivalDeploymentChoice(
  g: GameView,
  destination: string,
): { blocked: string | null; action: Action | null } {
  const offer = g.homeworldRevivalDeployment;
  const target = offer?.destinations.find(
    (option) => option.id === destination,
  );
  let blocked: string | null = null;
  if (!homeworldRevivalDeploymentCanAct(g))
    blocked = 'Wait for the current choice to finish.';
  else if (offer!.blocked) blocked = offer!.blocked;
  else if (!target) blocked = 'Choose a current revival destination.';
  else if (target.blocked) blocked = target.blocked;
  else if (
    !Number.isSafeInteger(offer!.normal) ||
    !Number.isSafeInteger(offer!.elite) ||
    offer!.normal < 0 ||
    offer!.elite < 0 ||
    offer!.normal + offer!.elite <= 0 ||
    offer!.normal + offer!.elite > 20
  )
    blocked = 'The revived group is no longer available.';
  return {
    blocked,
    action: blocked
      ? null
      : {
          type: 'decision',
          event: offer!.event,
          destination,
          amount: offer!.normal + offer!.elite,
        },
  };
}

/** All profiles share this legal fallback: reinforce an occupied stronghold,
 * otherwise use the first permitted destination, or leave the group at home. */
export function homeworldRevivalDeploymentActions(g: GameView): Action[] {
  if (!homeworldRevivalDeploymentCanAct(g)) return [];
  const offer = g.homeworldRevivalDeployment!;
  const me = g.players.find((player) => player.id === g.me);
  const strongholds = new Set(
    gameTerritories(g)
      .filter((territory) => territory.type === 'stronghold')
      .map((territory) => territory.id),
  );
  const occupied = new Set(
    Object.entries(me?.forces ?? {})
      .filter(([, count]) => count > 0)
      .map(([key]) => splitLocation(key).territory),
  );
  const choices = offer.destinations
    .map((target) => ({
      target,
      action: homeworldRevivalDeploymentChoice(g, target.id).action,
    }))
    .filter((choice) => choice.action);
  const preferred = choices.find(
    ({ target }) =>
      target.territory &&
      strongholds.has(target.territory) &&
      occupied.has(target.territory),
  );
  const action = preferred?.action ?? choices[0]?.action;
  return [action ?? { type: 'decision', event: offer.event, decline: true }];
}
