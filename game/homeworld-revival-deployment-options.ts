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

function deploymentQuantities(g: GameView): { amounts: number[]; blocked: string | null } {
  const offer = g.homeworldRevivalDeployment;
  if (!offer || !Number.isSafeInteger(offer.normal) || !Number.isSafeInteger(offer.elite) ||
    offer.normal < 0 || offer.elite < 0 || offer.normal + offer.elite <= 0 || offer.normal + offer.elite > 20)
    return { amounts: [], blocked: 'The revived group is no longer available.' };
  const allocation = offer.allocation;
  if (allocation === undefined) return { amounts: [offer.normal + offer.elite], blocked: null };
  if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation) ||
    Object.keys(allocation).sort().join(',') !== 'kept,placed,remaining,total' || g.advanced || offer.kind !== 'fedaykin' || offer.normal !== 0 ||
    ![allocation.total, allocation.remaining, allocation.placed, allocation.kept].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 20) ||
    allocation.remaining <= 0 || allocation.total <= 0 || allocation.total !== allocation.remaining + allocation.placed + allocation.kept ||
    offer.elite !== allocation.remaining)
    return { amounts: [], blocked: 'The Southern revival allocation is no longer available.' };
  return { amounts: Array.from({ length: allocation.remaining }, (_, index) => index + 1), blocked: null };
}

/** Only the stamped native Basic allocation allows a partial placement. */
export function homeworldRevivalDeploymentQuantities(g: GameView): number[] {
  if (!homeworldRevivalDeploymentCanAct(g) || g.homeworldRevivalDeployment?.blocked) return [];
  return deploymentQuantities(g).amounts;
}

export function homeworldRevivalDeploymentChoice(
  g: GameView,
  destination: string,
  amount?: number,
): { blocked: string | null; action: Action | null } {
  const offer = g.homeworldRevivalDeployment;
  const target = offer?.destinations.find(
    (option) => option.id === destination,
  );
  const quantities = deploymentQuantities(g);
  const selected = amount === undefined ? quantities.amounts[0] : amount;
  let blocked: string | null = null;
  if (!homeworldRevivalDeploymentCanAct(g))
    blocked = 'Wait for the current choice to finish.';
  else if (offer!.blocked) blocked = offer!.blocked;
  else if (!target) blocked = 'Choose a current revival destination.';
  else if (target.blocked) blocked = target.blocked;
  else if (quantities.blocked) blocked = quantities.blocked;
  else if (selected === undefined || !quantities.amounts.includes(selected))
    blocked = 'Choose a current revived quantity.';
  return {
    blocked,
    action: blocked
      ? null
      : {
          type: 'decision',
          event: offer!.event,
          destination,
          amount: selected,
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
  const quantities = homeworldRevivalDeploymentQuantities(g);
  const choices = offer.destinations
    .flatMap((target) => quantities.map(amount => ({
      target,
      action: homeworldRevivalDeploymentChoice(g, target.id, amount).action,
    })))
    .filter((choice) => choice.action);
  const preferred = choices.find(
    ({ target }) =>
      target.territory &&
      strongholds.has(target.territory) &&
      occupied.has(target.territory),
  );
  const action = preferred?.action ?? choices[0]?.action;
  if (offer.allocation !== undefined) {
    const ordered = preferred ? [preferred, ...choices.filter(choice => choice !== preferred && choice.target.id === preferred.target.id),
      ...choices.filter(choice => choice.target.id !== preferred.target.id)] : choices;
    return [...ordered.flatMap(choice => choice.action ? [choice.action] : []), { type: 'decision', event: offer.event, decline: true }];
  }
  return [action ?? { type: 'decision', event: offer.event, decline: true }];
}
