import type { Action, Game } from './engine';

export interface BribeOptions {
  available: number;
  incoming: number;
  blocked: string | null;
  targets: { id: string; maximum: number; limitation: string | null }[];
}

/** Mirror only the existing bribe timing gates; bribes are allowed out of turn. */
export function bribeTimingBlock(g: Game): string | null {
  if (g.status !== 'playing') return 'Bribes require a game in progress.';
  if (g.phase === 8) return 'Bribes cannot be made during Mentat Pause.';
  if (g.inflation?.side === 'double') return 'Bribes are prohibited while Inflation shows Double.';
  if (g.pendingTreacheryDiscard || g.pendingNullentropy || g.bureaucratPayments?.pending ||
      ['name', 'reveal'].includes(g.battle?.mentatQuestion?.stage ?? '') ||
      g.nexusCards?.phase?.stage === 'drawing' || g.truthtrance ||
      g.nexusTraitorExchanges?.some(exchange => exchange.stage === 'return') ||
      g.phaseOpening || g.response || g.decision)
    return 'Finish the current decision or response before paying a bribe.';
  return null;
}

/** Payment only removes spendable spice, so a preserved completion is monotonic. */
export function maximumBribe(available: number, preservesCommitments: (amount: number) => boolean): number {
  let low = 0, high = Math.max(0, Math.floor(available));
  while (low < high) {
    const amount = low + Math.ceil((high - low) / 2);
    if (preservesCommitments(amount)) low = amount;
    else high = amount - 1;
  }
  return low;
}

/** Client-side guard against a stale selection; the server revalidates every payment. */
export function bribeAction(options: BribeOptions, target: string, amount: number): Action | null {
  const recipient = options.targets.find(candidate => candidate.id === target);
  if (options.blocked || !recipient || !Number.isSafeInteger(amount) || amount < 1 || amount > recipient.maximum)
    return null;
  return { type: 'bribe', target, amount };
}
