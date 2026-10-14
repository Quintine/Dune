import type { Game } from './engine';

export type EmperorPaymentSource = {
  auctionIndex: number;
  card: string;
  winner: string;
  price: number;
  emperor: string;
  ally: string;
  allyPayment: number;
  aid: { recipient: string | null; amount: number };
  emperorSpice: number;
};
export type EmperorPaymentQuote = EmperorPaymentSource & {
  prepaid: number;
  missing: number;
  blocked: string | null;
};
/** Original obligation and public acknowledgement snapshot, not a new bid or sale. */
export type EmperorPaymentReceipt = EmperorPaymentSource & {
  event: string;
  turn: number;
  phase: 3;
  order: string[];
  holders: string[];
  required: string[];
  /** Pass answers only; a Use owner is the next member of the original queue. */
  passed: string[];
  stage: 'pending' | 'passed' | 'used';
  owner: string | null;
  signature: string;
};

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);
function requirePayment(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

/** A visible conservative full-obligation policy, not a publisher timing ruling.
 * Prepaid matching Emperor aid is already out of their wallet. Reuse it before
 * taking only the missing credit from their own spice; never count future income.
 * The engine alone establishes that ordinary bidding has reached its winner. */
export function emperorPaymentSourceQuote(g: Game): EmperorPaymentQuote | null {
  const auction = g.auction;
  if (g.status !== 'playing' || g.phase !== 3 || !count(g.turn) || g.turn === 0 ||
      !auction || g.currentAuctionSale || g.richeseAuction ||
      !Array.isArray(auction.cards) || !count(auction.index) ||
      auction.index >= auction.cards.length || !count(auction.bid) || auction.bid === 0 ||
      !text(auction.cards[auction.index]?.id) || !text(auction.bidder)) return null;
  const winner = g.players.find(player => player.id === auction.bidder);
  const emperors = g.players.filter(player => player.faction === 'emperor');
  const emperor = emperors[0];
  if (!winner || emperors.length !== 1 || !emperor || winner.id === emperor.id ||
      winner.ally !== emperor.id || emperor.ally !== winner.id ||
      !count(emperor.spice)) return null;
  const allyPayment = auction.allyPayment ?? 0;
  if (!count(allyPayment) || allyPayment > auction.bid) return null;
  const credit = g.aid?.[emperor.id];
  if (credit && (!object(credit) || !text(credit.recipient) || !count(credit.amount))) return null;
  const card = auction.cards[auction.index].id;
  // Sold earlier entries are aliases, not physical custody. A still-unsold
  // duplicate or a card already acquired by a seat cannot be this original lot.
  for (let index = auction.index + 1; index < auction.cards.length; index++)
    if (auction.cards[index]?.id === card) return null;
  if (g.players.some(player => player.hand?.some(held => held.id === card)) ||
      g.deck?.some(held => held.id === card) || g.discard?.some(held => held.id === card)) return null;
  const prepaid = credit?.recipient === winner.id ? Math.min(credit.amount, auction.bid) : 0;
  const missing = auction.bid - prepaid;
  let blocked: string | null = null;
  if (credit && credit.amount > 0 && credit.recipient !== winner.id)
    blocked = 'The Emperor’s prepaid aid belongs to another recipient.';
  else if (allyPayment > prepaid)
    blocked = 'The original allied bid has lost its committed prepaid aid.';
  else if (missing === 0)
    blocked = 'The Emperor has already prepaid the full original price.';
  else if (emperor.spice < missing)
    blocked = 'The Emperor cannot cover the missing full-price funding from their own spice.';
  return {
    auctionIndex: auction.index, card, winner: winner.id, price: auction.bid,
    emperor: emperor.id, ally: winner.id, allyPayment,
    aid: { recipient: credit?.recipient ?? null, amount: credit?.amount ?? 0 },
    emperorSpice: emperor.spice, prepaid, missing, blocked,
  };
}

/** Public roster only: card identity, bidder hand and native wallet do not
 * determine who must acknowledge the original obligation. */
export function requiredEmperorPaymentResponders(g: Game): string[] {
  if (!g.nexusCards?.cards || !g.auction?.bidder ||
      !ids(g.order) || g.order.length !== g.players.length ||
      !ids(g.players.map(player => player.id)) ||
      !g.order.every(id => g.players.some(player => player.id === id))) return [];
  const emperors = g.players.filter(player => player.faction === 'emperor');
  if (emperors.length !== 1) return [];
  const emperor = emperors[0];
  const winner = g.players.find(player => player.id === g.auction!.bidder);
  if (!winner || winner.id === emperor.id || winner.ally !== emperor.id ||
      emperor.ally !== winner.id) return [];
  return g.order.filter(id => {
    const player = g.players.find(seat => seat.id === id)!;
    return id !== emperor.id && id !== winner.id && !player.ally &&
      !!g.nexusCards!.cards!.hands[id];
  });
}

export function emperorPaymentReceiptSignature(receipt: EmperorPaymentReceipt): string {
  return JSON.stringify(['nexusEmperorPaymentReceipt', receipt.event, receipt.turn,
    receipt.phase, receipt.auctionIndex, receipt.card, receipt.winner, receipt.price,
    receipt.emperor, receipt.ally, receipt.allyPayment, receipt.aid.recipient,
    receipt.aid.amount, receipt.emperorSpice, receipt.order, receipt.holders,
    receipt.required, receipt.passed, receipt.stage, receipt.owner]);
}

export function createEmperorPaymentReceipt(
  g: Game, event: string, required: readonly string[],
): EmperorPaymentReceipt {
  const quote = emperorPaymentSourceQuote(g);
  requirePayment(quote && text(event) && ids(required) && required.length > 0 &&
    sameIds(required, requiredEmperorPaymentResponders(g)),
  'Emperor payment needs the original ordinary winning obligation and public responders.');
  const receipt: EmperorPaymentReceipt = {
    event, turn: g.turn, phase: 3, auctionIndex: quote.auctionIndex,
    card: quote.card, winner: quote.winner, price: quote.price,
    emperor: quote.emperor, ally: quote.ally, allyPayment: quote.allyPayment,
    aid: { ...quote.aid }, emperorSpice: quote.emperorSpice,
    order: [...g.order],
    holders: g.order.filter(id => !!g.nexusCards!.cards!.hands[id]),
    required: [...required], passed: [], stage: 'pending', owner: null, signature: '',
  };
  receipt.signature = emperorPaymentReceiptSignature(receipt);
  return receipt;
}

function sameSource(receipt: EmperorPaymentReceipt, quote: EmperorPaymentQuote): boolean {
  return receipt.auctionIndex === quote.auctionIndex && receipt.card === quote.card &&
    receipt.winner === quote.winner && receipt.price === quote.price &&
    receipt.emperor === quote.emperor && receipt.ally === quote.ally &&
    receipt.allyPayment === quote.allyPayment &&
    receipt.aid.recipient === quote.aid.recipient && receipt.aid.amount === quote.aid.amount &&
    receipt.emperorSpice === quote.emperorSpice;
}

/** Pending receipts bind the actual original source. Completed history retains
 * its own original facts, not future wallets, alliances, or physical hand zones. */
export function validateEmperorPaymentReceipt(g: Game, receipt: EmperorPaymentReceipt): void {
  requirePayment(object(receipt) && Object.keys(receipt).sort().join(',') ===
    'aid,ally,allyPayment,auctionIndex,card,emperor,emperorSpice,event,holders,order,owner,passed,phase,price,required,signature,stage,turn,winner' &&
    text(receipt.event) && count(receipt.turn) && receipt.turn > 0 && receipt.turn <= g.turn &&
    receipt.phase === 3 && (receipt.turn < g.turn || g.phase >= 3) &&
    count(receipt.auctionIndex) && text(receipt.card) && text(receipt.winner) &&
    count(receipt.price) && receipt.price > 0 && text(receipt.emperor) &&
    receipt.emperor !== receipt.winner && receipt.ally === receipt.winner &&
    count(receipt.allyPayment) && receipt.allyPayment <= receipt.price &&
    object(receipt.aid) && Object.keys(receipt.aid).sort().join(',') === 'amount,recipient' &&
    count(receipt.aid.amount) && (receipt.aid.recipient === null
      ? receipt.aid.amount === 0 : text(receipt.aid.recipient) &&
        g.players.some(player => player.id === receipt.aid.recipient)) &&
    count(receipt.emperorSpice) && ids(receipt.order) && ids(receipt.holders) &&
    ids(receipt.required) && ids(receipt.passed) && receipt.required.length > 0 &&
    receipt.order.length === g.players.length &&
    receipt.order.every(id => g.players.some(player => player.id === id)) &&
    g.players.some(player => player.id === receipt.emperor && player.faction === 'emperor') &&
    receipt.order.includes(receipt.winner) &&
    sameIds(receipt.holders, receipt.order.filter(id => receipt.holders.includes(id))) &&
    sameIds(receipt.required, receipt.order.filter(id => receipt.required.includes(id))) &&
    receipt.required.every(id => receipt.holders.includes(id) &&
      id !== receipt.emperor && id !== receipt.winner) &&
    receipt.passed.length <= receipt.required.length &&
    receipt.passed.every((id, index) => id === receipt.required[index]) &&
    ((receipt.stage === 'pending' && receipt.owner === null && receipt.passed.length < receipt.required.length) ||
     (receipt.stage === 'passed' && receipt.owner === null && receipt.passed.length === receipt.required.length) ||
     (receipt.stage === 'used' && text(receipt.owner) &&
       receipt.owner === receipt.required[receipt.passed.length])) &&
    text(receipt.signature) && receipt.signature === emperorPaymentReceiptSignature(receipt),
  'Emperor payment lost its strict original obligation or ordered acknowledgements.');
  if (receipt.stage === 'pending') {
    const quote = emperorPaymentSourceQuote(g);
    requirePayment(receipt.turn === g.turn && quote && sameSource(receipt, quote) &&
      sameIds(receipt.order, g.order),
    'Emperor payment lost its original current auction, alliance, aid or native spice.');
  }
  if (receipt.stage === 'used') {
    const prepaid = receipt.aid.recipient === receipt.winner
      ? Math.min(receipt.aid.amount, receipt.price) : 0;
    requirePayment((receipt.aid.recipient === null || receipt.aid.recipient === receipt.winner ||
      receipt.aid.amount === 0) && receipt.allyPayment <= prepaid &&
      prepaid < receipt.price && receipt.emperorSpice >= receipt.price - prepaid,
    'Emperor payment Use lacks its original full-price funding.');
  }
}

/** Pure entitlement check. The engine spends the one physical card and commits
 * the additional credit only after this succeeds and its native checks pass. */
export function emperorPaymentUseBlock(
  g: Game, receipt: EmperorPaymentReceipt, owner: string,
): string | null {
  try { validateEmperorPaymentReceipt(g, receipt); }
  catch (error) { return error instanceof Error ? error.message : 'Invalid Emperor payment obligation.'; }
  const pending = g.pendingNexusEmperorPayment?.receipt;
  try {
    if (pending && pending !== receipt) validateEmperorPaymentReceipt(g, pending);
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid current Emperor payment obligation.';
  }
  if (receipt.stage !== 'pending' || g.nexusEmperorPayment?.current !== receipt.event ||
      !pending || pending.event !== receipt.event || pending.signature !== receipt.signature ||
      g.nexusEmperorPayment?.completed.some(completed => completed.event === receipt.event) ||
      receipt.required[receipt.passed.length] !== owner || g.active !== owner ||
      g.decision?.kind !== 'nexusEmperorPayment' || g.decision.player !== owner ||
      g.decision.event !== receipt.event)
    return 'Only the current original Emperor payment responder may use this obligation.';
  if (g.truthtrance || g.nexusTraitorExchanges?.some(exchange => exchange.stage === 'return') ||
      g.nexusCards?.phase?.stage === 'drawing' || g.response || g.pendingKarama)
    return 'Finish the current question, card return or response first.';
  const player = g.players.find(seat => seat.id === owner);
  if (!player || player.ally || owner === receipt.emperor || owner === receipt.winner ||
      g.nexusCards?.cards?.hands[owner] !== 'emperor')
    return 'Use requires your actual unallied Emperor Nexus Betrayal card.';
  const quote = emperorPaymentSourceQuote(g);
  if (!quote || !sameSource(receipt, quote)) return 'The original Emperor payment source changed.';
  return quote.blocked;
}
