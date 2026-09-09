import type { Action, GameView } from './engine';
import type { TupileIntelligenceCategory } from './tupile-intelligence';

/** Eligibility is projected by the server. Never inspect hands or reconstruct
 * occupation history, card categories or balances in a client or bot. */
export function tupileIntelligenceCanAct(g: GameView): boolean {
  return !!(
    g.status === 'playing' &&
    g.tupileIntelligence?.owner === g.me &&
    !g.tupileIntelligence.blocked
  );
}

export function tupileIntelligenceChoice(
  g: GameView,
  target: string,
  category: TupileIntelligenceCategory,
): { blocked: string | null; action: Action | null } {
  const offer = g.tupileIntelligence;
  let blocked: string | null = null;
  if (!offer || offer.owner !== g.me || g.status !== 'playing')
    blocked = 'Tupile intelligence is not available to this seat.';
  else if (offer.blocked) blocked = offer.blocked;
  else if (category !== 'weapons' && category !== 'defenses')
    blocked = 'Choose the weapon count or defense count.';
  else {
    const targets = offer.targets.filter((candidate) => candidate.player === target);
    if (targets.length !== 1 || target === g.me)
      blocked = 'Choose a current opposing faction.';
    else blocked = targets[0].blocked;
  }
  return {
    blocked,
    action: blocked ? null : { type: 'tupileIntelligence', target, category },
  };
}

/** A deterministic legal request shared by every bot profile. Historical
 * answers never determine whether another faction is currently eligible. */
export function tupileIntelligenceActions(g: GameView): Action[] {
  if (!tupileIntelligenceCanAct(g)) return [];
  for (const target of g.tupileIntelligence!.targets) {
    const choice = tupileIntelligenceChoice(g, target.player, 'weapons');
    if (choice.action) return [choice.action];
  }
  return [];
}
