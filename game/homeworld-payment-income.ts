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

/** Split one already eligible payment. Contributor exclusions, payment-unit
 * classification and timing belong to the caller. This does not resolve how
 * multiple contributors define a payment for rounding purposes.
 * This quotes physical low population only, not occupation entitlements. */
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

/** Compare the unresolved transaction and contributor rounding interpretations.
 * The caller may accept agreement; divergence requires an explicit ruling. */
export function quoteGuildPaymentRounding(
  gross: number,
  contributions: number[],
): { transaction: number; contribution: number; unambiguous: boolean } {
  if (
    !Number.isSafeInteger(gross) ||
    gross < 0 ||
    !Array.isArray(contributions) ||
    contributions.length > 2 ||
    !Array.from(contributions).every(
      (amount) => Number.isSafeInteger(amount) && amount >= 0,
    )
  )
    throw new HomeworldCustodyError(
      'Guild rounding requires a nonnegative safe payment and at most two nonnegative safe contributions.',
    );
  const total = contributions.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(total) || total !== gross)
    throw new HomeworldCustodyError(
      'Guild contributions must sum to the original eligible payment.',
    );
  const transaction = Math.ceil(gross / 2);
  const contribution = contributions.reduce(
    (sum, amount) => sum + Math.ceil(amount / 2),
    0,
  );
  return {
    transaction,
    contribution,
    unambiguous: transaction === contribution,
  };
}
