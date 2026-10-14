import type { Game } from './engine';
import { HomeworldCustodyError } from './homeworld-custody';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';

export type HomeworldPaymentIncomeContext = Pick<
  Game,
  'advanced' | 'players' | 'homeworlds'
>;

export type HomeworldPaymentIncomeQuote = {
  gross: number;
  income: number;
  bank: number;
  low: boolean;
};

/** Split one whole eligible invoice, including all eligible contributors.
 * Contributor exclusions, payment-unit classification and timing belong to the
 * caller. This quotes physical low population only, not occupation entitlements. */
export function quoteHomeworldPaymentIncome(
  context: HomeworldPaymentIncomeContext,
  ownerId: string,
  kind: 'shipment' | 'treachery',
  gross: number,
): HomeworldPaymentIncomeQuote {
  if (!Number.isSafeInteger(gross) || gross < 0)
    throw new HomeworldCustodyError(
      'Homeworld payment income requires a nonnegative safe integer payment.',
    );
  if (kind !== 'shipment' && kind !== 'treachery')
    throw new HomeworldCustodyError('Unknown Homeworld payment income kind.');
  const faction = kind === 'shipment' ? 'guild' : 'emperor';
  const owner = context.players.find((player) => player.id === ownerId);
  if (!owner || owner.faction !== faction)
    throw new HomeworldCustodyError(
      `Only the ${faction === 'guild' ? 'Guild' : 'Emperor'} receives this payment income.`,
    );
  const card = kind === 'shipment' ? 'junction' : 'kaitain';
  const low = context.homeworlds?.custody
    ? homeworldPopulations(
        homeworldContext(context),
        context.homeworlds.custody,
      ).some(
        (home) =>
          home.native === ownerId && home.card === card && home.side === 'low',
      )
    : false;
  const income = low ? Math.ceil(gross / 2) : gross;
  return { gross, income, bank: gross - income, low };
}

/** Attribute the frozen final Bank remainder of one eligible player invoice.
 * Contributions retain declared primary/ally order. The caller excludes direct
 * Bank and self-payee legs and selects the first Bureaucrat-eligible payer;
 * bankRetained excludes that payer's flat diversion. */
export function quoteHomeworldBankPayment(
  contributions: readonly { payer: string; amount: number }[],
  bankRetained: number,
  diversion?: { payer: string; amount: 2 },
): { payer: string; amount: number }[] {
  if (!Array.isArray(contributions))
    throw new HomeworldCustodyError(
      'Homeworld Bank payment requires original payer contributions.',
    );
  const payers = new Set<string>();
  let total = 0;
  for (const leg of contributions) {
    if (
      !leg ||
      typeof leg.payer !== 'string' ||
      leg.payer.trim().length === 0 ||
      payers.has(leg.payer) ||
      !Number.isSafeInteger(leg.amount) ||
      leg.amount <= 0
    )
      throw new HomeworldCustodyError(
        'Homeworld Bank payment requires distinct payers with positive safe original contributions.',
      );
    payers.add(leg.payer);
    total += leg.amount;
    if (!Number.isSafeInteger(total))
      throw new HomeworldCustodyError(
        'Homeworld Bank payment contributions exceed a safe invoice total.',
      );
  }
  let diversionIndex = -1;
  if (diversion !== undefined) {
    if (
      !diversion ||
      diversion.amount !== 2 ||
      typeof diversion.payer !== 'string'
    )
      throw new HomeworldCustodyError(
        'Homeworld Bank diversion requires an original payer and exactly two spice.',
      );
    diversionIndex = contributions.findIndex(
      (leg) => leg.payer === diversion.payer,
    );
    if (diversionIndex < 0 || contributions[diversionIndex].amount < 5)
      throw new HomeworldCustodyError(
        'Homeworld Bank diversion requires a selected original contribution of at least five spice.',
      );
  }
  const remainingTotal = total - (diversionIndex < 0 ? 0 : 2);
  if (
    !Number.isSafeInteger(bankRetained) ||
    (bankRetained !== 0 &&
      bankRetained !== remainingTotal &&
      bankRetained !== Math.floor(remainingTotal / 2) &&
      bankRetained !== Math.ceil(remainingTotal / 2))
  )
    throw new HomeworldCustodyError(
      'Homeworld Bank remainder must match zero, full or whole-invoice half income.',
    );
  const partial = bankRetained > 0 && bankRetained < remainingTotal;
  let remainder = 0;
  if (partial) {
    let base = 0;
    for (let i = 0; i < contributions.length; i++) {
      const remaining = contributions[i].amount - (i === diversionIndex ? 2 : 0);
      base += Math.floor(remaining / 2);
    }
    remainder = bankRetained - base;
  }
  const bankLegs: { payer: string; amount: number }[] = [];
  for (let i = 0; i < contributions.length; i++) {
    const leg = contributions[i];
    const remaining = leg.amount - (i === diversionIndex ? 2 : 0);
    let amount = partial
      ? Math.floor(remaining / 2)
      : bankRetained === remainingTotal ? remaining : 0;
    if (remainder > 0) {
      const extra = Math.min(remainder, remaining - amount);
      amount += extra;
      remainder -= extra;
    }
    if (i === diversionIndex) amount += 2;
    if (amount > 0) bankLegs.push({ payer: leg.payer, amount });
  }
  return bankLegs;
}
