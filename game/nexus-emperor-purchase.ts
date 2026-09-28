import { FACTIONS, type FactionId } from './catalog';
import { emperorNexusEvent } from './nexus-emperor-secret-ally';

export type EmperorNexusPurchase = {
  kind: 'purchase';
  event: string;
  owner: string;
  turn: number;
  phase: 3;
  sequence: number;
  faction: FactionId;
  advanced: boolean;
  price: number;
  auctionIndex: number;
  card: string;
  beforeSpice: number;
  afterSpice: number;
  signature: string;
};

/** Bind an offer to its public auction position and final bid, never its hidden card face. */
export function emperorNexusPurchaseEvent(
  turn: number, owner: string, sequence: number, auctionIndex: number, price: number,
): string {
  return `${emperorNexusEvent(turn, 3, owner, sequence)}:${auctionIndex}:${price}`;
}

export class EmperorNexusPurchaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmperorNexusPurchaseError';
  }
}

/** Only a personally affordable, bank-paid winning bid can be reimbursed. */
export function quoteEmperorNexusPurchase(
  price: number,
  ownSpice: number,
  allyPayment: number,
): void {
  if (
    !Number.isSafeInteger(price) ||
    price < 1 ||
    !Number.isSafeInteger(ownSpice) ||
    ownSpice < price ||
    allyPayment !== 0
  )
    throw new EmperorNexusPurchaseError(
      'Emperor Nexus purchase requires a positive whole bid paid entirely from the winner\'s own spice.',
    );
}

/** Consistency signature, not cryptographic authentication; field order is fixed. */
export function signEmperorNexusPurchase(record: EmperorNexusPurchase): string {
  return JSON.stringify([
    'emperorNexusPurchase',
    record.kind,
    record.event,
    record.owner,
    record.turn,
    record.phase,
    record.sequence,
    record.faction,
    record.advanced,
    record.price,
    record.auctionIndex,
    record.card,
    record.beforeSpice,
    record.afterSpice,
  ]);
}

const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

/** Historical purchase evidence survives subsequent auctions and card transfers. */
export function validateEmperorNexusPurchase(
  context: {
    turn: number;
    advanced: boolean;
    players: readonly { id: string; faction: FactionId }[];
  },
  record: EmperorNexusPurchase,
): void {
  const validContext =
    context &&
    whole(context.turn) &&
    context.turn > 0 &&
    typeof context.advanced === 'boolean' &&
    Array.isArray(context.players) &&
    context.players.length > 0 &&
    context.players.every(
      (player) =>
        player &&
        text(player.id) &&
        FACTIONS.some((faction) => faction.id === player.faction),
    ) &&
    new Set(context.players.map((player) => player.id)).size ===
      context.players.length &&
    new Set(context.players.map((player) => player.faction)).size ===
      context.players.length;
  if (
    !validContext ||
    !plain(record) ||
    Object.keys(record).sort().join(',') !==
      'advanced,afterSpice,auctionIndex,beforeSpice,card,event,faction,kind,owner,phase,price,sequence,signature,turn' ||
    record.kind !== 'purchase' ||
    record.phase !== 3 ||
    !whole(record.turn) ||
    record.turn < 1 ||
    record.turn > context.turn ||
    !whole(record.sequence) ||
    !text(record.owner) ||
    !text(record.card) ||
    context.players.find((player) => player.id === record.owner)?.faction !==
      record.faction ||
    record.advanced !== context.advanced ||
    record.event !==
      emperorNexusPurchaseEvent(record.turn, record.owner, record.sequence, record.auctionIndex, record.price) ||
    !whole(record.auctionIndex) ||
    !whole(record.beforeSpice) ||
    !whole(record.afterSpice) ||
    !whole(record.price) ||
    record.price < 1 ||
    record.beforeSpice < record.price ||
    record.afterSpice !== record.beforeSpice ||
    record.signature !== signEmperorNexusPurchase(record)
  )
    throw new EmperorNexusPurchaseError(
      'Emperor Nexus purchase has lost its original bidder, paid price or full reimbursement.',
    );
}
