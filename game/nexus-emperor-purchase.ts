import { FACTIONS, type FactionId } from './catalog';
import { handLimit, type Game, type Player } from './engine';
import { emperorNexusEvent, emperorNexusLegacyRevivalModeSupported } from './nexus-emperor-secret-ally';
import { nexusCardMode, validateNexusCards } from './nexus-cards';
import { validAmbassadorResume } from './ambassador-resume';
import { ambassadorPhaseAllowed } from './ambassador-phase';
import {
  pairedNexusModulesProfile, singleE1E2NexusProfile,
  mixedE1E2NexusProfile, mixedE3NexusProfile, standaloneE3NexusProfile, pairedE3NexusProfile,
} from './nexus-module-profile';
import {
  pairedNexusLeaderSkillsProfile,
  singleE1E2NexusLeaderSkillsProfile, mixedE1E2NexusLeaderSkillsProfile,
  mixedE3NexusLeaderSkillsProfile, standaloneE3NexusLeaderSkillsProfile,
  pairedE3NexusLeaderSkillsProfile,
} from './leader-skill-profile';
import type { RicheseAuction } from './richese-auction';
import { quoteRicheseSettlement, type RicheseSettlementQuote } from './richese-settlement';
import { quoteRicheseBetrayalInvoice } from './nexus-richese-betrayal';
import { RICHESE_CARD_DEFINITIONS, richeseCardDefinition } from './richese-cards';
import { nexusCoreProfile } from './faction-module-profile';

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
export type EmperorNexusAmbassadorPurchase = {
  version: 3;
  kind: 'purchase';
  event: string;
  owner: string;
  turn: number;
  /** Actual original entry phase, including source-bound Homeworld arrivals. */
  phase: number;
  sequence: number;
  faction: FactionId;
  advanced: boolean;
  origin: 'ambassador';
  price: 3;
  card: string;
  beforeSpice: number;
  afterSpice: number;
  signature: string;
  entry: string;
  token: string;
  entrant: string;
};
export type EmperorNexusSpecialPurchase = {
  version: 4;
  kind: 'purchase';
  event: string;
  owner: string;
  turn: number;
  phase: number;
  sequence: number;
  faction: 'richese';
  advanced: true;
  origin: 'specialKarama';
  price: 3;
  card: string;
  activation: string;
  beforeSpice: number;
  afterSpice: number;
  signature: string;
};
export type EmperorNexusPurchase =
  | EmperorNexusBankPurchase
  | EmperorNexusSellerPurchase
  | EmperorNexusAmbassadorPurchase
  | EmperorNexusSpecialPurchase;
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

/** Bind a retained price to the original consumed Ambassador entry and its
 * purchase sequence, never to the privately drawn card face. */
export function emperorNexusAmbassadorPurchaseEvent(
  turn: number, phase: number, owner: string, sequence: number, entry: string,
): string {
  return JSON.stringify(['nexusEmperorAmbassadorPurchase', turn, phase, owner, sequence, entry]);
}

/** Native once-per-game source identity; neither privately selected card face
 * belongs in the offer shown before the original special purchase commits. */
export function emperorNexusSpecialPurchaseEvent(
  turn: number, phase: number, owner: string, sequence: number,
): string {
  return JSON.stringify([
    'nexusEmperorSpecialPurchase', turn, phase, owner, sequence, 'richeseSpecialKarama',
  ]);
}

/** Consistency signature, not cryptographic authentication; field order is fixed. */
export function signEmperorNexusPurchase(record: EmperorNexusPurchase): string {
  if ('version' in record && record.version === 4)
    return JSON.stringify([
      'emperorNexusSpecialPurchase', record.version, record.kind, record.event,
      record.owner, record.turn, record.phase, record.sequence, record.faction,
      record.advanced, record.origin, record.price, record.card, record.activation,
      record.beforeSpice, record.afterSpice,
    ]);
  if ('version' in record && record.version === 3)
    return JSON.stringify([
      'emperorNexusAmbassadorPurchase', record.version, record.kind, record.event,
      record.owner, record.turn, record.phase, record.sequence, record.faction,
      record.advanced, record.origin, record.price, record.card, record.beforeSpice,
      record.afterSpice, record.entry, record.token, record.entrant,
    ]);
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
  if (plain(record) && 'version' in record && record.version === 4) {
    if (
      !validContext ||
      Object.keys(record).sort().join(',') !==
        'activation,advanced,afterSpice,beforeSpice,card,event,faction,kind,origin,owner,phase,price,sequence,signature,turn,version' ||
      record.kind !== 'purchase' || record.origin !== 'specialKarama' ||
      record.faction !== 'richese' || record.advanced !== true ||
      record.advanced !== context.advanced ||
      context.players.some(player => player.faction === 'emperor') ||
      context.players.find(player => player.id === record.owner)?.faction !== 'richese' ||
      !whole(record.turn) || record.turn < 1 || record.turn > context.turn ||
      !whole(record.phase) || record.phase < 1 || record.phase > 8 ||
      !whole(record.sequence) || !text(record.owner) ||
      !text(record.activation) || record.activation === record.card ||
      !RICHESE_CARD_DEFINITIONS.some(({ card }) => card.id === record.card) ||
      record.price !== 3 ||
      !whole(record.beforeSpice) || record.beforeSpice < record.price ||
      !whole(record.afterSpice) || record.afterSpice !== record.beforeSpice ||
      record.event !== emperorNexusSpecialPurchaseEvent(
        record.turn, record.phase, record.owner, record.sequence,
      ) ||
      record.signature !== signEmperorNexusPurchase(record)
    )
      throw new EmperorNexusPurchaseError(
        'Emperor Nexus special purchase has lost its original Richese source, activation, price or retained spice.',
      );
    return;
  }
  if (plain(record) && 'version' in record && record.version === 3) {
    if (
      !validContext ||
      Object.keys(record).sort().join(',') !==
        'advanced,afterSpice,beforeSpice,card,entrant,entry,event,faction,kind,origin,owner,phase,price,sequence,signature,token,turn,version' ||
      record.kind !== 'purchase' || record.origin !== 'ambassador' ||
      record.price !== 3 || !whole(record.phase) || record.phase < 1 || record.phase > 8 ||
      !whole(record.turn) || record.turn < 1 || record.turn > context.turn ||
      !whole(record.sequence) ||
      !text(record.owner) || !text(record.card) || !text(record.entry) ||
      !text(record.token) || !text(record.entrant) ||
      record.entrant === record.owner ||
      !context.players.some(player => player.id === record.entrant) ||
      context.players.find(player => player.id === record.owner)?.faction !== record.faction ||
      record.advanced !== context.advanced ||
      !whole(record.beforeSpice) || record.beforeSpice < record.price ||
      !whole(record.afterSpice) || record.afterSpice !== record.beforeSpice ||
      record.event !== emperorNexusAmbassadorPurchaseEvent(
        record.turn, record.phase, record.owner, record.sequence, record.entry,
      ) ||
      record.signature !== signEmperorNexusPurchase(record)
    )
      throw new EmperorNexusPurchaseError(
        'Emperor Nexus Ambassador purchase has lost its original trigger, buyer, price or retained spice.',
      );
    return;
  }
  if (plain(record) && 'version' in record && record.version === 2) {
    if (
      !validContext ||
      Object.keys(record).sort().join(',') !==
        'advanced,afterSpice,beforeSpice,card,event,faction,kind,lot,origin,owner,phase,price,round,seller,sequence,signature,turn,version' ||
      record.kind !== 'purchase' || record.phase !== 3 ||
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
    'version' in record ||
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


/** Genuine native Nexus envelopes only; the canonical native profiles own their
 * roster and delegated Discovery/Homeworld/Tech/Stronghold envelopes, and the
 * separately flagged preview aliases never open one. */
function nativeBankNexusProfile(g: Game): boolean {
  if (g.semutaPreview || g.advancedPreview || g.kullPreview || g.nexusKullPreview ||
    g.guildBetrayalPreview || g.richeseBetrayalPreview ||
    g.nexusIxianReplacementPreview || g.nexusIxianBetrayalPreview ||
    g.nexusHarkonnenBetrayalPreview) return false;
  if (g.leaderSkills)
    return pairedNexusLeaderSkillsProfile(g) || singleE1E2NexusLeaderSkillsProfile(g) ||
      mixedE1E2NexusLeaderSkillsProfile(g) || standaloneE3NexusLeaderSkillsProfile(g) ||
      pairedE3NexusLeaderSkillsProfile(g) || mixedE3NexusLeaderSkillsProfile(g);
  if (pairedNexusModulesProfile(g) || singleE1E2NexusProfile(g) ||
    mixedE1E2NexusProfile(g) || standaloneE3NexusProfile(g) ||
    pairedE3NexusProfile(g) || mixedE3NexusProfile(g)) return true;
  // Bare paired E1/E2 Nexus without Tech or Strongholds.
  if (g.techTokens || g.strongholdCards || g.discoveryEnabled || g.discoveries ||
    g.discoveryStash || g.greatMaker || g.players.length < 2 || g.players.length > 6)
    return false;
  for (let i = 0; i < g.players.length; i++)
    for (let j = 0; j < i; j++)
      if (g.players[j].faction === g.players[i].faction) return false;
  if (g.expansions.length !== 1 || !['ix', 'choam'].includes(g.expansions[0])) return false;
  const expansion = g.expansions[0];
  return g.players.every(p => FACTIONS.some(f => f.id === p.faction &&
    (f.expansion === 'base' || f.expansion === expansion))) &&
    g.players.filter(p => FACTIONS.some(f => f.id === p.faction && f.expansion === expansion)).length === 2;
}

/** Normal bank-auction admission only: a supported original native Nexus roster
 * with the Emperor absent, the concealed face and any buyer wallet or hand left
 * to the caller. */
export function emperorNexusBankPurchaseModeSupported(g: Game): boolean {
  if (nexusCoreProfile(g))
    return !g.players.some(p => p.faction === 'emperor') && !g.sandtrout;
  if (!g.nexusCards || g.players.some(p => p.faction === 'emperor') ||
    g.ecazTreachery || g.sandtrout) return false;
  return emperorNexusLegacyRevivalModeSupported(g) || nativeBankNexusProfile(g);
}

/** Reuse native Nexus profiles; the existing Richese Betrayal preview composes
 * only on its original bare paired CHOAM/Richese roster, not arbitrary overlays. */
export function emperorNexusSellerPurchaseModeSupported(g: Game): boolean {
  if (nexusCoreProfile(g))
    return !g.players.some(p => p.faction === 'emperor') && g.players.some(p => p.faction === 'richese');
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

/** Public Emperor-absent Ecaz envelope only, reusing the original E3 Nexus and
 * Skills profiles; it never inspects the concealed Nexus face or a hand. */
export function emperorNexusAmbassadorPurchaseModeSupported(g: Game): boolean {
  if (!g.nexusCards || g.ecazTreachery || g.sandtrout ||
    g.players.some(p => p.faction === 'emperor') ||
    !g.players.some(p => p.faction === 'ecaz')) return false;
  if (standaloneE3NexusProfile(g) || pairedE3NexusProfile(g) || mixedE3NexusProfile(g))
    return true;
  return !!g.leaderSkills && (standaloneE3NexusLeaderSkillsProfile(g) ||
    pairedE3NexusLeaderSkillsProfile(g) || mixedE3NexusLeaderSkillsProfile(g));
}

type AmbassadorPurchaseSource = {
  buyer: Player | null;
  entry: NonNullable<Game['pendingAmbassador']> | null;
  event: string;
  blocked: string | null;
};

/** Original consumed-token evidence plus the buyer's private eligibility. The
 * physical supply is skipped only for the card an already committed draw bound. */
function ambassadorPurchaseSource(g: Game, owner: string, supply: boolean): AmbassadorPurchaseSource {
  const entry = g.pendingAmbassador ?? null;
  const buyer = text(owner) ? g.players.find(p => p.id === owner) ?? null : null;
  const token = entry && g.ecazAmbassadors?.tokens.find(t => t.id === entry.token);
  const event = entry && text(entry.event) && text(owner)
    ? emperorNexusAmbassadorPurchaseEvent(g.turn, g.phase, owner,
      g.nexusEmperorPurchaseHistory?.length ?? 0, entry.event)
    : '';
  let blocked: string | null = null;
  if (!emperorNexusAmbassadorPurchaseModeSupported(g))
    blocked = 'Emperor Nexus Ambassador purchase requires a supported native Ecaz Nexus profile with Emperor absent.';
  else if (g.status !== 'playing')
    blocked = 'Emperor Nexus Ambassador purchase needs the original game still in progress.';
  else if (!entry || !text(entry.event) || !text(entry.token))
    blocked = 'The original Richese Ambassador trigger is no longer current.';
  else if (!buyer)
    blocked = 'Emperor Nexus Ambassador purchase lost its original purchaser.';
  else if (entry.effect !== 'richese')
    blocked = 'The original Richese Ambassador effect is no longer active.';
  else if (entry.beneficiary !== owner ||
    entry.owner !== g.players.find(p => p.faction === 'ecaz')?.id)
    blocked = 'The original Richese Ambassador purchase belongs to another Ecaz beneficiary.';
  else if (entry.turn !== g.turn || entry.phase !== g.phase || !ambassadorPhaseAllowed(g))
    blocked = 'The original Richese Ambassador trigger belongs to another turn or phase.';
  else if (!validAmbassadorResume(g, entry))
    blocked = 'The original Richese Ambassador trigger lost its recorded entry source.';
  else if (entry.entrant === owner || !g.players.some(p => p.id === entry.entrant))
    blocked = 'The original Richese Ambassador trigger lost its entering player.';
  else if (!token || !((token.effect === 'richese' && token.zone === 'used') ||
    (token.effect === 'beneGesserit' && token.zone === 'removed' &&
      entry.copyChoices.includes('richese'))))
    blocked = 'The original Richese Ambassador token is no longer consumed for this effect.';
  if (blocked) throw new EmperorNexusPurchaseError(blocked);
  if (buyer!.ally)
    blocked = 'Emperor Nexus Secret Ally requires an unallied buyer.';
  else if (!g.nexusCards?.cards)
    blocked = 'Hold the real Emperor Nexus Secret Ally card to retain your purchase price.';
  else {
    try {
      validateNexusCards(g.nexusCards.cards, g.players);
      if (g.nexusCards.cards.hands[owner] !== 'emperor' ||
        nexusCardMode('emperor', buyer!.faction, g.players.map(p => p.faction)) !== 'secretAlly')
        blocked = 'Hold the real Emperor Nexus Secret Ally card to retain your purchase price.';
      else if (buyer!.hand.length >= handLimit(buyer!))
        blocked = 'The Richese Ambassador purchase needs room in the buyer’s hand.';
      else if (!whole(buyer!.spice) || buyer!.spice < 3)
        blocked = 'The Richese Ambassador purchase needs the three-spice price held in the buyer’s own spice.';
      else if (supply && !g.deck.length && !g.discard.length)
        blocked = 'No Treachery Card is available for the Ambassador purchase.';
    } catch (error) {
      blocked = error instanceof Error ? error.message
        : 'Hold the real Emperor Nexus Secret Ally card to retain your purchase price.';
    }
  }
  return { buyer, entry, event, blocked };
}

/** Pre-commit proof only. Private room, spice, supply and Nexus face disable
 * Use without gating Pay; malformed original sources remain hard errors. */
export function quoteEmperorNexusAmbassadorPurchase(
  g: Game, owner: string,
): { event: string; price: 3; blocked: string | null } {
  const source = ambassadorPurchaseSource(g, owner, true);
  return { event: source.event, price: 3, blocked: source.blocked };
}

/** Bind the original purchase to the card the engine actually drew before the
 * buyer's hand changes. The draw already removed it from the deck, so absence
 * from the physical stock is valid; a duplicate or an undrawn card is not. */
export function createEmperorNexusAmbassadorPurchase(
  g: Game, owner: string, card: string,
): EmperorNexusAmbassadorPurchase {
  if (!text(owner) || !text(card))
    throw new EmperorNexusPurchaseError(
      'Emperor Nexus Ambassador purchase needs its original buyer and drawn Treachery Card.',
    );
  const source = ambassadorPurchaseSource(g, owner, false);
  if (source.blocked) throw new EmperorNexusPurchaseError(source.blocked);
  const buyer = source.buyer!, entry = source.entry!;
  const physical = [
    ...g.players.flatMap(p => p.hand), ...g.deck, ...g.discard,
    ...(g.richeseCache ?? []), ...(g.richeseRemoved ?? []),
    ...(g.ixSetupCards ?? []), ...(g.ixAuction?.cards ?? []),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
  ].filter(c => c.id === card);
  if (physical.length !== 0)
    throw new EmperorNexusPurchaseError(
      'Emperor Nexus Ambassador purchase lost its single physically drawn Treachery Card.',
    );
  const receipt: EmperorNexusAmbassadorPurchase = {
    version: 3, kind: 'purchase', event: source.event, owner: buyer.id,
    turn: g.turn, phase: g.phase, sequence: g.nexusEmperorPurchaseHistory?.length ?? 0,
    faction: buyer.faction, advanced: g.advanced, origin: 'ambassador', price: 3,
    card, beforeSpice: buyer.spice, afterSpice: buyer.spice, signature: '',
    entry: entry.event, token: entry.token, entrant: entry.entrant,
  };
  receipt.signature = signEmperorNexusPurchase(receipt);
  validateEmperorNexusPurchase(g, receipt);
  return receipt;
}

/** The original special-purchase validator owns timing, uncommitted spice,
 * capacity, once-per-game use and card roles. This is only Nexus entitlement. */
export function quoteEmperorNexusSpecialPurchase(
  g: Game, owner: string,
): { event: string; price: 3; blocked: string | null } {
  const buyer = text(owner) ? g.players.find(p => p.id === owner) : undefined;
  let blocked: string | null = null;
  if (!emperorNexusSellerPurchaseModeSupported(g))
    blocked = 'Emperor Nexus special purchase requires a supported native Richese Nexus profile with Emperor absent.';
  else if (g.status !== 'playing' || !whole(g.turn) || g.turn < 1 ||
    !whole(g.phase) || g.phase < 1 || g.phase > 8)
    blocked = 'Emperor Nexus special purchase needs the original game still in progress.';
  else if (!g.advanced || buyer?.faction !== 'richese')
    blocked = 'Only native Advanced Richese can retain its special Karama purchase price.';
  else if (buyer.ally)
    blocked = 'Emperor Nexus Secret Ally requires an unallied buyer.';
  else if (!g.nexusCards?.cards)
    blocked = 'Hold the real Emperor Nexus Secret Ally card to retain your purchase price.';
  else {
    try {
      validateNexusCards(g.nexusCards.cards, g.players);
      if (g.nexusCards.cards.hands[owner] !== 'emperor' ||
        nexusCardMode('emperor', buyer.faction, g.players.map(p => p.faction)) !== 'secretAlly')
        blocked = 'Hold the real Emperor Nexus Secret Ally card to retain your purchase price.';
      else if (!whole(buyer.spice) || buyer.spice < 3)
        blocked = 'The special Karama purchase needs the three-spice price held in Richese’s own spice.';
    } catch (error) {
      blocked = error instanceof Error ? error.message
        : 'Hold the real Emperor Nexus Secret Ally card to retain your purchase price.';
    }
  }
  return {
    event: emperorNexusSpecialPurchaseEvent(
      g.turn, g.phase, owner, g.nexusEmperorPurchaseHistory?.length ?? 0,
    ),
    price: 3, blocked,
  };
}

/** Called after original preparation, before either activation is discarded or
 * the cache card moves. Bind both exact physical cards without paying/refunding. */
export function createEmperorNexusSpecialPurchase(
  g: Game, owner: string, activation: string, acquire: string,
): EmperorNexusSpecialPurchase {
  const quote = quoteEmperorNexusSpecialPurchase(g, owner);
  if (quote.blocked) throw new EmperorNexusPurchaseError(quote.blocked);
  const buyer = g.players.find(p => p.id === owner)!;
  const chosen = g.richeseCache?.find(card => card.id === acquire);
  const physical = [
    ...g.players.flatMap(p => p.hand), ...g.deck, ...g.discard,
    ...(g.richeseCache ?? []), ...(g.richeseRemoved ?? []),
    ...(g.ixSetupCards ?? []), ...(g.ixAuction?.cards ?? []),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
  ];
  if (!text(activation) || !text(acquire) || activation === acquire ||
    !chosen || !richeseCardDefinition(chosen) ||
    buyer.hand.filter(card => card.id === activation).length !== 1 ||
    physical.filter(card => card.id === activation).length !== 1 ||
    physical.filter(card => card.id === acquire).length !== 1)
    throw new EmperorNexusPurchaseError(
      'Emperor Nexus special purchase needs one exact native cache card and its single held Karama activation.',
    );
  const receipt: EmperorNexusSpecialPurchase = {
    version: 4, kind: 'purchase', event: quote.event, owner: buyer.id,
    turn: g.turn, phase: g.phase, sequence: g.nexusEmperorPurchaseHistory?.length ?? 0,
    faction: 'richese', advanced: true, origin: 'specialKarama', price: 3,
    card: acquire, activation, beforeSpice: buyer.spice, afterSpice: buyer.spice,
    signature: '',
  };
  receipt.signature = signEmperorNexusPurchase(receipt);
  validateEmperorNexusPurchase(g, receipt);
  return receipt;
}
