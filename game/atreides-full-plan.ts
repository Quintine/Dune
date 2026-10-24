import type { FactionId } from './catalog';
import type { Action, GameView } from './engine';

/** Timing needs only public commitment status, never the hidden plan contents. */
export type AtreidesFullPlanContext = {
  status: string;
  phase: number;
  advanced: boolean;
  owner: { id: string; faction: FactionId; specialKaramaUsed?: boolean };
  blocked?: string | null;
  battle: null | {
    attacker: string;
    defender: string;
    revealed: boolean;
    preparing: boolean;
    fullPlan: boolean;
  };
};

/** Supplied revised rules, physical p27 F: before Battle Plans are revealed.
 * The original offer is a convenience, not a deadline. A sealed plan stays fixed.
 * Voice/ordinary Prescience keep their existing preparation priority.
 */
export function quoteAtreidesFullPlan(context: AtreidesFullPlanContext) {
  const { owner, battle } = context;
  let blocked: string | null = null;
  if (!context.advanced) blocked = 'Special Karama powers require the Advanced game.';
  else if (owner.faction !== 'atreides') blocked = 'Only native Atreides may use this special Karama.';
  else if (context.status !== 'playing' || context.phase !== 6 || !battle)
    blocked = 'Use special prescience during a battle before plans are revealed.';
  else if (owner.specialKaramaUsed || battle.fullPlan)
    blocked = 'Your special Karama power has already been used this game.';
  else if (battle.revealed) blocked = 'The Battle Plans have already been revealed.';
  else if (battle.preparing)
    blocked = 'Finish battle preparation before using special prescience.';
  else if (context.blocked) blocked = context.blocked;
  return { blocked, targets: battle ? [battle.attacker, battle.defender] : [] };
}

/** Reuse the existing own/allied inspection preference, without strategy tuning. */
export function atreidesFullPlanAction(game: GameView): Action | null {
  const offer = game.atreidesFullPlan;
  if (!offer || offer.blocked || !offer.cards.length) return null;
  const me = game.players.find(player => player.id === game.me);
  if (!me) return null;
  const beneficiary = offer.targets.includes(me.id) ? me.id : me.ally;
  if (!beneficiary || !offer.targets.includes(beneficiary)) return null;
  const target = offer.targets.find(player => player !== beneficiary);
  return target ? { type: 'card', mode: 'special', card: offer.cards[0], target } : null;
}
