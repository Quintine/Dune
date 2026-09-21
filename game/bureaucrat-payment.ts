import { basicExpansionLeaderSkillsProfile, noOtherLeaderSkillModules, type LeaderSkillProfile } from './leader-skill-profile';
export type BureaucratPaymentKind = 'auction' | 'shipment' | 'bribe';
export type BureaucratPaymentSource = {
  event: string;
  turn: number;
  phase: number;
  kind: BureaucratPaymentKind;
  payer: string;
  payee: string;
  amount: number;
  signature: string;
};
/** The one physical skill card's use survives death, redraw and controller changes. */
export type BureaucratPaymentUse = {
  event: string;
  owner: string;
  turn: number;
  phase: number;
  signature: string;
};
export type BureaucratPaymentView = {
  pending: null | {
    event: string;
    owner: string;
    payer: string;
    payee: string;
    amount: number;
    kind: BureaucratPaymentKind;
    redirect: 2;
  };
  usedThisPhase: boolean;
};
export class BureaucratPaymentError extends Error {}
export function bureaucratPaymentSignature(value: object): string {
  return JSON.stringify({ ...value, signature: undefined });
}
export function bureaucratPaymentModeSupported(game: LeaderSkillProfile): boolean {
  return noOtherLeaderSkillModules(game) &&
    (!game.expansions.length ||
      (game.expansions.length === 1 && game.expansions[0] === 'choam') ||
      basicExpansionLeaderSkillsProfile(game));
}
export function bureaucratUsed(
  used: readonly BureaucratPaymentUse[],
  turn: number,
  phase: number,
): boolean {
  return used.some((use) => use.turn === turn && use.phase === phase);
}
/** Caller supplies only a living face-up native trainer and actual player payees. */
export function quoteBureaucratPayment(input: {
  owner: string | null;
  payer: string;
  payee: string;
  amount: number;
  turn: number;
  phase: number;
  used: readonly BureaucratPaymentUse[];
}): { redirect: 2; income: number } | null {
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount < 0 ||
    !Number.isSafeInteger(input.turn) ||
    input.turn < 1 ||
    !Number.isSafeInteger(input.phase) ||
    input.phase < 0 ||
    input.phase > 8 ||
    !input.payer ||
    !input.payee
  )
    throw new BureaucratPaymentError(
      'Bureaucrat needs a valid actual player payment.',
    );
  return input.owner &&
    input.owner !== input.payer &&
    input.owner !== input.payee &&
    input.payer !== input.payee &&
    input.amount >= 5 &&
    !bureaucratUsed(input.used, input.turn, input.phase)
    ? { redirect: 2, income: input.amount - 2 }
    : null;
}
