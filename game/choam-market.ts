import type { Card } from './cards';
export type ChoamMarket = {
  owner: string;
  resume: 'phase' | 'storm';
  blocked: string[];
  tradeAttempted?: boolean;
  sale?: { card: string; witness?: string; price: number };
  trade?: { ally: string; offered: string; returned?: string };
};
/** A duplicate is an exact printed card name, not merely the same battle role. */
export function saleOptions(hand: Card[], blocked: string[] = []) {
  return hand.flatMap((card) => {
    if (blocked.includes(card.id)) return [];
    const witness = hand.find(
      (other) => other.id !== card.id && other.name === card.name,
    );
    return [
      ...(witness ? [{ card: card.id, witness: witness.id, price: 3 }] : []),
      ...(card.kind === 'worthless'
        ? [{ card: card.id, witness: undefined, price: 2 }]
        : []),
    ];
  });
}

export function quoteSale(
  hand: Card[],
  cardId: unknown,
  witnessId: unknown,
  blocked: string[] = [],
) {
  const card = hand.find((c) => c.id === cardId && !blocked.includes(c.id));
  if (!card) return undefined;
  if (witnessId) {
    const witness = hand.find(
      (c) => c.id === witnessId && c.id !== card.id && c.name === card.name,
    );
    return witness
      ? { card: card.id, witness: witness.id, price: 3 }
      : undefined;
  }
  return card.kind === 'worthless'
    ? { card: card.id, witness: undefined, price: 2 }
    : undefined;
}
