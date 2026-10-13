import { homeworldLeaderSkillsProfile, classicNexusLeaderSkillsProfile, classicTechLeaderSkillsProfile, mixedE1E2NexusLeaderSkillsProfile, mixedE3NexusLeaderSkillsProfile, nativeDiscoveryLeaderSkillsProfile, nativeExpansionLeaderSkillsProfile, nativeTechLeaderSkillsProfile, noOtherLeaderSkillModules, pairedE3NexusLeaderSkillsProfile, pairedNexusLeaderSkillsProfile, standaloneE3NexusLeaderSkillsProfile, strongholdLeaderSkillsProfile, type LeaderSkillProfile } from './leader-skill-profile';
import { classicDiscoveryLeaderSkillsProfile } from './discovery-module-profile';
export type BureaucratPaymentKind = 'auction' | 'shipment' | 'bribe' | 'revival';
export type BureaucratPaymentSource = {
  event: string;
  turn: number;
  phase: number;
  kind: BureaucratPaymentKind;
  payer: string;
  payee: string;
  amount: number;
  /** Exact internal allied-payer receipts; never projected as public shares. */
  contributions?: readonly { payer: string; amount: number }[];
  privateFunding?: true;
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
    payer: string | null;
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
  return (!game.homeworlds && game.expansions.length === 1 &&
    (game.expansions[0] === 'choam' || game.expansions[0] === 'ix') &&
    pairedNexusLeaderSkillsProfile(game)) ||
    mixedE3NexusLeaderSkillsProfile(game) || mixedE1E2NexusLeaderSkillsProfile(game) || pairedE3NexusLeaderSkillsProfile(game) ||
    (noOtherLeaderSkillModules(game) &&
    (!game.expansions.length ||
      (game.expansions.length === 1 && game.expansions[0] === 'choam') ||
      nativeExpansionLeaderSkillsProfile(game))) || homeworldLeaderSkillsProfile(game) || classicTechLeaderSkillsProfile(game) || nativeTechLeaderSkillsProfile(game) || strongholdLeaderSkillsProfile(game) || classicNexusLeaderSkillsProfile(game) || standaloneE3NexusLeaderSkillsProfile(game) || classicDiscoveryLeaderSkillsProfile(game) || nativeDiscoveryLeaderSkillsProfile(game);
}
export function bureaucratAlliedFundingModeSupported(game: LeaderSkillProfile): boolean {
  if (!bureaucratPaymentModeSupported(game)) return false;
  if (game.homeworlds) return homeworldLeaderSkillsProfile(game);
  if (game.expansions.length === 1 && (game.expansions[0] === 'ecaz' || game.expansions[0] === 'ix'))
    return pairedNexusLeaderSkillsProfile(game) || pairedE3NexusLeaderSkillsProfile(game);
  return !game.expansions.length || game.expansions.length === 1 && game.expansions[0] === 'choam';
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
  contributions?: readonly { payer: string; amount: number }[];
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
  let eligible = input.owner !== input.payer && input.payer !== input.payee &&
    input.amount >= 5;
  if (input.contributions) {
    let total = 0;
    eligible = false;
    for (let index = 0; index < input.contributions.length; index++) {
      const contribution = input.contributions[index];
      if (!contribution.payer || !Number.isSafeInteger(contribution.amount) ||
          contribution.amount <= 0)
        throw new BureaucratPaymentError('Bureaucrat needs distinct actual positive payer contributions.');
      for (let prior = 0; prior < index; prior++) {
        if (input.contributions[prior].payer === contribution.payer)
          throw new BureaucratPaymentError('Bureaucrat needs distinct actual positive payer contributions.');
      }
      total += contribution.amount;
      if (contribution.amount >= 5 && contribution.payer !== input.owner &&
          contribution.payer !== input.payee) eligible = true;
    }
    if (!Number.isSafeInteger(total) || total !== input.amount)
      throw new BureaucratPaymentError('Bureaucrat contributions must equal the actual recipient payment.');
  }
  return input.owner &&
    input.owner !== input.payee &&
    eligible &&
    !bureaucratUsed(input.used, input.turn, input.phase)
    ? { redirect: 2, income: input.amount - 2 }
    : null;
}
