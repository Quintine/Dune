export type OrdinaryPayment = { recipient: string; amount: number };

/** Partition one cumulative obligation without duplicating a recipient's
 * deficit. Native income, timing and entitlement remain engine calculations. */
export function splitOrdinaryPayments(payments: readonly OrdinaryPayment[], available: number): {
  before: OrdinaryPayment[]; after: OrdinaryPayment[]; total: number;
} {
  if (!Number.isSafeInteger(available) || available < 0) throw new Error('Use a safe available payment budget.');
  let remaining = available, total = 0;
  const before: OrdinaryPayment[] = [], after: OrdinaryPayment[] = [];
  for (const payment of payments) {
    if (!payment.recipient || payment.recipient !== payment.recipient.trim() ||
      !Number.isSafeInteger(payment.amount) || payment.amount <= 0 || !Number.isSafeInteger(total + payment.amount))
      throw new Error('Use exact recipients and positive safe payment amounts.');
    total += payment.amount;
    const paid = Math.min(remaining, payment.amount);
    if (paid) before.push({ recipient: payment.recipient, amount: paid });
    if (paid < payment.amount) after.push({ recipient: payment.recipient, amount: payment.amount - paid });
    remaining -= paid;
  }
  return { before, after, total };
}
