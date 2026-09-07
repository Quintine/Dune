import { TECH_TOKENS, type TechId, type TechState } from './tech-tokens';

export class PhaseResourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhaseResourceError';
  }
}
function requireResources(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new PhaseResourceError(message);
}
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
export type ResourceSeat = { id: string; spice: number };
export type AidRefund = { player: string; amount: number; balance: number };
export type PhaseResourceContext = {
  phase: number;
  players: readonly ResourceSeat[];
  techTokens?: TechState | null;
  aid: Readonly<Record<string, { recipient: string; amount: number }>>;
};
/** Refunds return escrow to its donor. The recipient's current alliance, funds,
 * or continued eligibility is not needed to return that already committed spice. */
export function quoteAidRefunds(
  players: readonly ResourceSeat[],
  aid: PhaseResourceContext['aid'],
): AidRefund[] {
  requireResources(
    Array.isArray(players) &&
      new Set(players.map((p) => p.id)).size === players.length &&
      aid &&
      typeof aid === 'object' &&
      !Array.isArray(aid),
    'Phase completion needs distinct seated donors and an aid ledger.',
  );
  return Object.entries(aid).map(([id, credit]) => {
    const p = players.find((p) => p.id === id);
    requireResources(
      p &&
        whole(credit?.amount) &&
        whole(p.spice) &&
        whole(p.spice + credit.amount),
      'Phase completion needs valid seated aid refunds and balances.',
    );
    return {
      player: id,
      amount: credit.amount,
      balance: p.spice + credit.amount,
    };
  });
}
export type PhaseResourceQuote = {
  credits: (
    | {
        kind: 'tech';
        token: TechId;
        player: string;
        amount: number;
        balance: number;
      }
    | { kind: 'aid'; player: string; amount: number; balance: number }
  )[];
  tokenResets: TechId[];
  refunds: AidRefund[];
  clearAid: boolean;
  balances: Record<string, number>;
};
/** Current-phase token payouts precede escrow refunds. No phase is entered,
 * no token accrues income, and no already-settled phase prefix is replayed. */
export function quotePhaseResources(
  g: PhaseResourceContext,
): PhaseResourceQuote {
  requireResources(
    whole(g.phase) &&
      g.phase <= 8 &&
      Array.isArray(g.players) &&
      new Set(g.players.map((p) => p.id)).size === g.players.length &&
      g.players.every(
        (p) => typeof p.id === 'string' && !!p.id && whole(p.spice),
      ),
    'Phase resource settlement needs a current phase and valid player balances.',
  );
  const quote: PhaseResourceQuote = {
    credits: [],
    tokenResets: [],
    refunds: [],
    clearAid: [3, 5, 6].includes(g.phase),
    balances: Object.fromEntries(g.players.map((p) => [p.id, p.spice])),
  };
  if (g.techTokens)
    for (const rule of TECH_TOKENS) {
      if (rule.phase !== g.phase) continue;
      const token = g.techTokens[rule.id];
      requireResources(
        token &&
          typeof token === 'object' &&
          whole(token.spice) &&
          (token.owner === null || g.players.some((p) => p.id === token.owner)),
        'Current-phase technology income needs valid token custody and spice.',
      );
      if (!token.owner || !token.spice) continue;
      const balance = quote.balances[token.owner] + token.spice;
      requireResources(
        whole(balance),
        'Technology settlement would overflow the owner’s spice balance.',
      );
      quote.balances[token.owner] = balance;
      quote.credits.push({
        kind: 'tech',
        token: rule.id,
        player: token.owner,
        amount: token.spice,
        balance,
      });
      quote.tokenResets.push(rule.id);
    }
  if (quote.clearAid) {
    quote.refunds = quoteAidRefunds(
      g.players.map((p) => ({ id: p.id, spice: quote.balances[p.id] })),
      g.aid,
    );
    for (const refund of quote.refunds) {
      quote.credits.push({ kind: 'aid', ...refund });
      quote.balances[refund.player] = refund.balance;
    }
  }
  return quote;
}
