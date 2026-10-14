import { FACTIONS, type FactionId } from './catalog';
import { handLimit, type Game } from './engine';
import { emperorNexusEvent } from './nexus-emperor-secret-ally';
import { nexusCardMode, validateNexusCards } from './nexus-cards';
import {
  pairedNexusModulesProfile, singleE1E2NexusProfile, mixedE1E2NexusProfile, mixedE3NexusProfile,
} from './nexus-module-profile';
import {
  pairedNexusLeaderSkillsProfile, singleE1E2NexusLeaderSkillsProfile,
  mixedE1E2NexusLeaderSkillsProfile, mixedE3NexusLeaderSkillsProfile,
} from './leader-skill-profile';
import type { RicheseAuction } from './richese-auction';
import { quoteRicheseSettlement, type RicheseSettlementQuote } from './richese-settlement';
import { quoteRicheseBetrayalInvoice } from './nexus-richese-betrayal';

export type EmperorNexusBankPurchase = {
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

export type EmperorNexusSellerPurchase = Omit<EmperorNexusBankPurchase, 'auctionIndex'> & {
  version: 2;
  origin: 'cache' | 'blackMarket';
  seller: string;
  round: string;
  lot: string;
};
export type EmperorNexusPurchase = EmperorNexusBankPurchase | EmperorNexusSellerPurchase;
export type EmperorNexusSellerPurchaseInput = {
  round: string;
  lot: RicheseAuction;
  quote: Extract<RicheseSettlementQuote, { kind: 'sold' }>;
  bank: boolean;
};

/** Original public source identity, never the cache/Black Market card face. */
export function emperorNexusSellerPurchaseEvent(
  turn: number, owner: string, sequence: number, round: string, lot: string,
  source: 'cache' | 'blackMarket', price: number,
): string {
  return JSON.stringify(['nexusEmperorSellerPurchase', turn, owner, sequence, round, lot, source, price]);
}

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
  if ('version' in record)
    return JSON.stringify([
      'emperorNexusSellerPurchase', record.version, record.kind, record.event,
      record.owner, record.turn, record.phase, record.sequence, record.faction,
      record.advanced, record.origin, record.seller, record.round, record.lot,
      record.price, record.card, record.beforeSpice, record.afterSpice,
    ]);
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
  if (plain(record) && 'version' in record) {
    if (
      !validContext ||
      Object.keys(record).sort().join(',') !==
        'advanced,afterSpice,beforeSpice,card,event,faction,kind,lot,origin,owner,phase,price,round,seller,sequence,signature,turn,version' ||
      record.version !== 2 || record.kind !== 'purchase' || record.phase !== 3 ||
      !whole(record.turn) || record.turn < 1 || record.turn > context.turn ||
      !whole(record.sequence) || !text(record.owner) || !text(record.card) ||
      !text(record.round) || !text(record.lot) || !text(record.seller) ||
      !['cache', 'blackMarket'].includes(record.origin) ||
      context.players.some(player => player.faction === 'emperor') ||
      context.players.find(player => player.id === record.seller)?.faction !== 'richese' ||
      context.players.find(player => player.id === record.owner)?.faction !== record.faction ||
      (record.origin === 'blackMarket' && (!record.advanced || record.seller === record.owner)) ||
      record.advanced !== context.advanced ||
      !whole(record.price) || record.price < 1 ||
      !whole(record.beforeSpice) || record.beforeSpice < record.price ||
      !whole(record.afterSpice) || record.afterSpice !== record.beforeSpice ||
      record.event !== emperorNexusSellerPurchaseEvent(
        record.turn, record.owner, record.sequence, record.round, record.lot, record.origin, record.price,
      ) ||
      record.signature !== signEmperorNexusPurchase(record)
    )
      throw new EmperorNexusPurchaseError(
        'Emperor Nexus seller purchase has lost its original source, buyer, price or retained spice.',
      );
    return;
  }
  if (
    !validContext ||
    !plain(record) ||
    !('auctionIndex' in record) ||
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

/** Reuse native Nexus profiles; the existing Richese Betrayal preview composes
 * only on its original bare paired CHOAM/Richese roster, not arbitrary overlays. */
export function emperorNexusSellerPurchaseModeSupported(g: Game): boolean {
  if (!g.nexusCards || g.players.some(p => p.faction === 'emperor') ||
    !g.players.some(p => p.faction === 'richese') || g.ecazTreachery || g.sandtrout)
    return false;
  if (pairedNexusModulesProfile(g) || singleE1E2NexusProfile(g) ||
    mixedE1E2NexusProfile(g) || mixedE3NexusProfile(g) ||
    (!!g.leaderSkills && (pairedNexusLeaderSkillsProfile(g) ||
      singleE1E2NexusLeaderSkillsProfile(g) || mixedE1E2NexusLeaderSkillsProfile(g) ||
      mixedE3NexusLeaderSkillsProfile(g)))) return true;
  return g.expansions.length === 1 && g.expansions[0] === 'choam' &&
    g.players.length >= 2 && g.players.length <= 6 &&
    new Set(g.players.map(p => p.faction)).size === g.players.length &&
    g.players.every(p => FACTIONS.some(f => f.id === p.faction &&
      (f.expansion === 'base' || f.expansion === 'choam'))) &&
    (!g.richeseBetrayalPreview || g.players.some(p => p.faction === 'choam')) &&
    !g.homeworlds && !g.leaderSkills && !g.discoveryEnabled && !g.discoveries &&
    !g.discoveryStash && !g.greatMaker && !g.techTokens && !g.strongholdCards &&
    !g.semutaPreview && !g.advancedPreview && !g.kullPreview && !g.nexusKullPreview &&
    !g.guildBetrayalPreview && !g.nexusIxianReplacementPreview &&
    !g.nexusIxianBetrayalPreview && !g.nexusHarkonnenBetrayalPreview;
}

/** Pre-acquisition proof only. The caller owns timing, overlays and mutation;
 * recompute native funding/capacity and the exact original physical source. */
export function quoteEmperorNexusSellerPurchase(
  g: Game, input: EmperorNexusSellerPurchaseInput, owner: string,
): { event: string; price: number; seller: string; source: 'cache' | 'blackMarket'; blocked: string | null } {
  try {
    if (!plain(input) || Object.keys(input).sort().join(',') !== 'bank,lot,quote,round' ||
      !text(input.round) || typeof input.bank !== 'boolean' ||
      !plain(input.lot) || !plain(input.quote) ||
      Object.keys(input.lot).sort().join(',') !==
        'acted,active,bid,bidder,cardId,eligible,event,method,order,outcome,owner,passed,sealed,source,tieOrder' ||
      Object.keys(input.quote).sort().join(',') !== 'allyPayment,amount,card,kind,ownPayment,winner' ||
      input.quote.kind !== 'sold' ||
      g.status !== 'playing' || g.phase !== 3 || !whole(g.turn) || g.turn < 1 ||
      (input.lot.source === 'blackMarket' && !g.advanced) ||
      !g.richeseBidding || g.richeseBidding.turn !== g.turn ||
      g.richeseBidding.stage !== 'lot' || g.richeseBidding.event !== input.round ||
      g.richeseBidding.owner !== input.lot.owner ||
      (input.lot.source === 'cache'
        ? !['first', 'last'].includes(String(g.richeseBidding.position))
        : g.richeseBidding.position !== null) ||
      !g.richeseAuction || JSON.stringify(input.lot) !== JSON.stringify(g.richeseAuction) ||
      g.auction || g.currentAuctionSale || input.quote.winner !== owner ||
      input.lot.active !== null || input.lot.bidder !== owner ||
      input.lot.bid !== input.quote.amount ||
      (input.bank && (owner === input.lot.owner || input.quote.amount < 1)))
      throw new EmperorNexusPurchaseError('Emperor Nexus purchase needs its unchanged original terminal Richese lot.');
    const buyer = g.players.find(p => p.id === owner),
      seller = g.players.find(p => p.id === input.lot.owner);
    if (!buyer || seller?.faction !== 'richese')
      throw new EmperorNexusPurchaseError('Emperor Nexus purchase lost its original buyer or Richese seller.');
    const funding = g.richeseFunding?.[owner];
    if (!plain(funding) || Object.keys(funding).sort().join(',') !== 'allyPayment,amount,donor' ||
      funding.donor !== (input.quote.allyPayment ? buyer.ally : null))
      throw new EmperorNexusPurchaseError('Emperor Nexus purchase lost its original funding commitment or donor.');
    const sourceCards = input.lot.source === 'cache' ? g.richeseCache ?? [] : seller.hand;
    const physicalCards = [
      ...g.players.flatMap(p => p.hand), ...g.deck, ...g.discard,
      ...(g.richeseCache ?? []), ...(g.richeseRemoved ?? []),
      ...(g.ixSetupCards ?? []), ...(g.ixAuction?.cards ?? []),
      ...(g.ornithopter ? [g.ornithopter.card] : []),
    ];
    // This shared native source proof checks exact card shape/face, unique
    // custody, cache identity and the Black Market self-purchase boundary.
    quoteRicheseBetrayalInvoice({
      players: g.players, lot: input.lot, quote: input.quote,
      donor: input.quote.allyPayment ? buyer.ally : null,
      originalRecipient: owner === seller.id
        ? g.players.find(p => p.faction === 'emperor')?.id ?? null : seller.id,
      sourceCards, physicalCards,
    });
    const native = quoteRicheseSettlement({
      lot: input.lot,
      owner: { id: seller.id, handCount: seller.hand.length, handLimit: handLimit(seller) },
      winner: { id: buyer.id, handCount: buyer.hand.length, handLimit: handLimit(buyer), spice: buyer.spice },
      card: sourceCards.find(c => c.id === input.lot.cardId),
      funding: g.richeseFunding?.[owner],
      allyCredit: buyer.ally && g.aid[buyer.ally]?.recipient === owner ? g.aid[buyer.ally] : null,
    });
    if (native.kind !== 'sold' || native.amount !== input.quote.amount ||
      native.winner !== input.quote.winner || native.ownPayment !== input.quote.ownPayment ||
      native.allyPayment !== input.quote.allyPayment)
      throw new EmperorNexusPurchaseError('Emperor Nexus purchase lost its exact original nominal price or funding split.');
    let blocked: string | null = null;
    if (!emperorNexusSellerPurchaseModeSupported(g))
      blocked = 'Emperor Nexus seller purchase requires a supported original Richese Nexus profile with Emperor absent.';
    else if (buyer.ally) blocked = 'Emperor Nexus Secret Ally requires an unallied buyer.';
    else if (!g.nexusCards?.cards) blocked = 'Hold the real Emperor Nexus card to retain your purchase price.';
    else {
      validateNexusCards(g.nexusCards.cards, g.players);
      if (g.nexusCards.cards.hands[owner] !== 'emperor' ||
        nexusCardMode('emperor', buyer.faction, g.players.map(p => p.faction)) !== 'secretAlly')
        blocked = 'Hold the real Emperor Nexus Secret Ally card to retain your purchase price.';
      else {
        try { quoteEmperorNexusPurchase(native.amount, buyer.spice, native.allyPayment); }
        catch (error) {
          if (!(error instanceof EmperorNexusPurchaseError)) throw error;
          blocked = error.message;
        }
      }
    }
    return {
      event: emperorNexusSellerPurchaseEvent(g.turn, owner, g.nexusEmperorPurchaseHistory?.length ?? 0,
        input.round, input.lot.event, input.lot.source, native.amount),
      price: native.amount, seller: seller.id, source: input.lot.source, blocked,
    };
  } catch (error) {
    if (error instanceof EmperorNexusPurchaseError) throw error;
    throw new EmperorNexusPurchaseError(error instanceof Error ? error.message : 'Malformed original Richese purchase.');
  }
}

/** Prepare consumed-source evidence before payment/card movement. It records
 * retained spice, not an actual paid invoice or a fabricated seller subsidy. */
export function createEmperorNexusSellerPurchase(
  g: Game, input: EmperorNexusSellerPurchaseInput,
): EmperorNexusSellerPurchase {
  if (!plain(input) || !plain(input.quote) || !text(input.quote.winner))
    throw new EmperorNexusPurchaseError('Emperor Nexus purchase needs its original sold source and buyer.');
  const quote = quoteEmperorNexusSellerPurchase(g, input, input.quote.winner);
  if (quote.blocked) throw new EmperorNexusPurchaseError(quote.blocked);
  const buyer = g.players.find(p => p.id === input.quote.winner)!;
  const receipt: EmperorNexusSellerPurchase = {
    version: 2, kind: 'purchase', event: quote.event, owner: buyer.id, turn: g.turn,
    phase: 3, sequence: g.nexusEmperorPurchaseHistory?.length ?? 0,
    faction: buyer.faction, advanced: g.advanced, origin: quote.source,
    seller: quote.seller, round: input.round, lot: input.lot.event,
    price: quote.price, card: input.quote.card.id,
    beforeSpice: buyer.spice, afterSpice: buyer.spice, signature: '',
  };
  receipt.signature = signEmperorNexusPurchase(receipt);
  validateEmperorNexusPurchase(g, receipt);
  return receipt;
}
