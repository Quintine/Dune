import type { FactionId } from './catalog';

/** Ordinary reserve shipment; other transport powers have separate prices. */
export function reserveShipmentCost(
  player: { faction: FactionId; halfRate: boolean },
  territoryType: string,
  amount: number,
) {
  if (player.faction === 'fremen') return 0;
  const standard = amount * (territoryType === 'stronghold' ? 1 : 2);
  return player.halfRate ? Math.ceil(standard / 2) : standard;
}

/** Guild cross-planet transport and returns; Fremen southern reserves pay this
 * tariff too. Pass 'reserves' for a return, not a board territory type.
 */
export function guildShipmentCost(destinationType: string, amount: number) {
  return Math.ceil(
    (amount *
      (destinationType === 'reserves' || destinationType === 'stronghold'
        ? 1
        : 2)) /
      2,
  );
}

/** A pledge is already escrowed. Selecting a share never spends a donor's
 * unpledged balance or enlarges the contribution they authorized.
 */
export function shipmentPaymentBounds(
  cost: number,
  ownSpice: number,
  pledgedSpice: number,
) {
  return {
    minimum: Math.max(0, cost - ownSpice),
    maximum: Math.min(cost, pledgedSpice),
  };
}

/** November 2020 FAQ, Alliances: each contributor pays the Guild directly;
 * money contributed by the Guild itself goes to the bank. An independent
 * Karama shipment routes the entire payment to the bank.
 */
export function guildShipmentIncome(payment: {
  guild: string | undefined;
  shipper: string;
  ally: string | null;
  cost: number;
  allyPayment: number;
  bankOnly: boolean;
}) {
  if (!payment.guild || payment.bankOnly) return 0;
  return (
    (payment.shipper === payment.guild
      ? 0
      : payment.cost - payment.allyPayment) +
    (payment.ally === payment.guild ? 0 : payment.allyPayment)
  );
}
