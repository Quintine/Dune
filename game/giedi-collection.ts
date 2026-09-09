import {
  quoteGiediCollectionBonus,
  type HomeworldCollectionContext,
  type HomeworldCollectionSource,
} from './homeworld-collection';
import { HomeworldCustodyError } from './homeworld-custody';

export type GiediCollection = {
  turn: number;
  player: string;
  qualifying: number;
  awarded: boolean;
  signature: string;
};

function signature(receipt: Omit<GiediCollection, 'signature'>) {
  return JSON.stringify([
    receipt.turn,
    receipt.player,
    receipt.qualifying,
    receipt.awarded,
  ]);
}

/** A saved receipt records completed income, never an instruction to pay again.
 * Missing receipts remain compatible with older saves; do not reconstruct one
 * from present balances, forces or already-collected deposits. */
export function validateGiediCollection(
  context: HomeworldCollectionContext,
  turn: number,
  receipt: GiediCollection | undefined,
) {
  if (receipt === undefined) return;
  if (
    !receipt ||
    typeof receipt !== 'object' ||
    Array.isArray(receipt) ||
    Object.keys(receipt).sort().join(',') !==
      'awarded,player,qualifying,signature,turn' ||
    !context.homeworlds?.custody ||
    !context.players.some(
      (p) => p.id === receipt.player && p.faction === 'harkonnen',
    ) ||
    !Number.isSafeInteger(receipt.turn) ||
    receipt.turn < 1 ||
    receipt.turn > turn ||
    !Number.isSafeInteger(receipt.qualifying) ||
    receipt.qualifying < 0 ||
    typeof receipt.awarded !== 'boolean' ||
    (receipt.awarded && receipt.qualifying === 0) ||
    receipt.signature !== signature(receipt)
  )
    throw new HomeworldCustodyError(
      'The saved Giedi Prime collection receipt is invalid.',
    );
}

export function quoteGiediCollectionReceipt(
  context: HomeworldCollectionContext,
  turn: number,
  player: string,
  sources: HomeworldCollectionSource[],
  previous?: GiediCollection,
): { receipt: GiediCollection; amount: 0 | 2 } {
  validateGiediCollection(context, turn, previous);
  if (!Number.isSafeInteger(turn) || turn < 1 || !context.homeworlds?.custody)
    throw new HomeworldCustodyError(
      'Giedi Prime collection needs its Homeworld and current turn.',
    );
  const current = previous?.turn === turn ? previous : undefined;
  const quote = quoteGiediCollectionBonus(
    context,
    player,
    sources,
    current?.awarded ?? false,
  );
  const qualifying = (current?.qualifying ?? 0) + quote.qualifying;
  if (!Number.isSafeInteger(qualifying))
    throw new HomeworldCustodyError(
      'Giedi Prime collection receipts would overflow.',
    );
  const receipt = {
    turn,
    player,
    qualifying,
    awarded: (current?.awarded ?? false) || quote.amount > 0,
  };
  return {
    receipt: { ...receipt, signature: signature(receipt) },
    amount: quote.amount,
  };
}
