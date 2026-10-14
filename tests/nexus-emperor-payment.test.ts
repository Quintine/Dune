import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck } from '../game/cards';
import type { Game } from '../game/engine';
import { createNexusCards, discardNexusCard } from '../game/nexus-cards';
import {
  createEmperorPaymentReceipt,
  emperorPaymentReceiptSignature,
  emperorPaymentSourceQuote,
  emperorPaymentUseBlock,
  requiredEmperorPaymentResponders,
  validateEmperorPaymentReceipt,
  type EmperorPaymentReceipt,
} from '../game/nexus-emperor-payment';

/** Pure helper inputs, not a staged runtime game or an engine-action fixture. */
function obligation(price = 8, spice = 8, prepaid = 0, committed = 0): Game {
  const players = [
    { id: 'emperor', faction: 'emperor' as const, ally: 'buyer', spice, hand: [] },
    { id: 'buyer', faction: 'atreides' as const, ally: 'emperor', spice: price, hand: [] },
    { id: 'first', faction: 'harkonnen' as const, ally: null, spice: 0, hand: [] },
    { id: 'owner', faction: 'guild' as const, ally: null, spice: 0, hand: [] },
    { id: 'allied', faction: 'fremen' as const, ally: 'partner', spice: 0, hand: [] },
    { id: 'partner', faction: 'beneGesserit' as const, ally: 'allied', spice: 0, hand: [] },
  ];
  const cards = createNexusCards(players, () => 0.5);
  for (const [owner, face] of [['first', 'harkonnen'], ['owner', 'emperor'], ['allied', 'atreides']] as const) {
    cards.deck.splice(cards.deck.indexOf(face), 1);
    cards.hands[owner] = face;
  }
  const deck = baseDeck();
  const card = deck.shift()!;
  return {
    status: 'playing', phase: 3, turn: 2, players,
    order: ['first', 'emperor', 'allied', 'owner', 'buyer', 'partner'],
    active: 'buyer', deck, discard: [],
    auction: { cards: [card], index: 0, bid: price, bidder: 'buyer',
      active: 'buyer', opener: 0, passed: ['first', 'owner', 'allied', 'partner', 'emperor'],
      allyPayment: committed },
    aid: prepaid ? { emperor: { recipient: 'buyer', amount: prepaid } } : {},
    currentAuctionSale: null, richeseAuction: null, decision: null, response: null,
    nexusCards: { cards, phase: null },
  } as unknown as Game;
}

function open(g: Game): EmperorPaymentReceipt {
  const receipt = createEmperorPaymentReceipt(g, 'original-obligation', requiredEmperorPaymentResponders(g));
  g.nexusEmperorPayment = { sequence: 1, current: receipt.event, completed: [] };
  g.pendingNexusEmperorPayment = { receipt };
  g.active = receipt.required[receipt.passed.length];
  g.decision = { kind: 'nexusEmperorPayment', player: g.active, event: receipt.event };
  return receipt;
}

function passFirst(g: Game, receipt: EmperorPaymentReceipt): EmperorPaymentReceipt {
  const next: EmperorPaymentReceipt = { ...receipt, passed: ['first'] };
  next.signature = emperorPaymentReceiptSignature(next);
  g.pendingNexusEmperorPayment = { receipt: next };
  g.active = 'owner';
  g.decision = { kind: 'nexusEmperorPayment', player: 'owner', event: next.event };
  return next;
}

void test('full price, not the buyer shortfall, determines native funding without mutation', () => {
  const g = obligation(8, 8);
  g.players.find(player => player.id === 'buyer')!.spice = 100;
  const before = structuredClone(g);
  const quote = emperorPaymentSourceQuote(g)!;
  assert.equal(quote.price, 8);
  assert.equal(quote.prepaid, 0);
  assert.equal(quote.missing, 8);
  assert.equal(quote.emperorSpice, 8);
  assert.equal(quote.blocked, null);
  assert.deepEqual(g, before);
  const receipt = passFirst(g, open(g));
  assert.equal(emperorPaymentUseBlock(g, receipt, 'owner'), null);
  assert.equal(g.players.find(player => player.id === 'emperor')!.spice, 8);
  assert.equal(g.auction!.bid, 8);
  assert.equal(g.auction!.allyPayment, 0);
});

void test('all matching prepaid aid counts, including more than the original committed split', () => {
  for (const [prepaid, committed, missing] of [[3, 0, 5], [3, 2, 5], [7, 7, 1]] as const) {
    const g = obligation(8, missing, prepaid, committed);
    const quote = emperorPaymentSourceQuote(g)!;
    assert.equal(quote.prepaid, prepaid);
    assert.equal(quote.missing, missing);
    assert.equal(quote.allyPayment, committed);
    assert.equal(quote.blocked, null);
    const receipt = passFirst(g, open(g));
    assert.equal(emperorPaymentUseBlock(g, receipt, 'owner'), null);
    assert.deepEqual(g.aid.emperor, { recipient: 'buyer', amount: prepaid });
  }
});

void test('full prepaid price and excess escrow require no extra funding or refund', () => {
  for (const prepaid of [8, 12]) {
    const g = obligation(8, 0, prepaid, 2);
    const quote = emperorPaymentSourceQuote(g)!;
    assert.equal(quote.prepaid, 8);
    assert.equal(quote.missing, 0);
    assert.ok(quote.blocked);
    const receipt = passFirst(g, open(g));
    assert.ok(emperorPaymentUseBlock(g, receipt, 'owner'));
    assert.equal(g.aid.emperor.amount, prepaid);
    assert.equal(receipt.aid.amount, prepaid);
  }
});

void test('native own spice must cover the entire missing price, never eventual income', () => {
  for (const [price, spice, prepaid] of [[8, 7, 0], [8, 4, 3], [100, 1, 50]] as const) {
    const g = obligation(price, spice, prepaid);
    const quote = emperorPaymentSourceQuote(g)!;
    assert.equal(quote.missing, price - prepaid);
    assert.ok(quote.blocked);
    const receipt = passFirst(g, open(g));
    assert.ok(emperorPaymentUseBlock(g, receipt, 'owner'));
    assert.equal(g.players.find(player => player.id === 'emperor')!.spice, spice);
  }
});

void test('safe-integer edge arithmetic subtracts credit without overflowing a wallet sum', () => {
  const g = obligation(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1, 1);
  const quote = emperorPaymentSourceQuote(g)!;
  assert.equal(quote.missing, Number.MAX_SAFE_INTEGER - 1);
  assert.equal(quote.blocked, null);
  const receipt = passFirst(g, open(g));
  assert.equal(emperorPaymentUseBlock(g, receipt, 'owner'), null);
});

void test('wrong-recipient escrow and lost committed credit cannot fund the original invoice', () => {
  const g = obligation(8, 8, 3);
  g.aid.emperor.recipient = 'first';
  assert.equal(emperorPaymentSourceQuote(g)!.prepaid, 0);
  assert.equal(emperorPaymentSourceQuote(g)!.missing, 8);
  assert.ok(emperorPaymentSourceQuote(g)!.blocked);
  const receipt = passFirst(g, open(g));
  assert.ok(emperorPaymentUseBlock(g, receipt, 'owner'));
  const lost = obligation(8, 8, 1, 2);
  assert.ok(emperorPaymentSourceQuote(lost)!.blocked);
  const lostReceipt = passFirst(lost, open(lost));
  assert.ok(emperorPaymentUseBlock(lost, lostReceipt, 'owner'));
});

void test('public storm roster excludes native Emperor, buyer, allies and empty holders independent of faces', () => {
  const g = obligation();
  assert.deepEqual(requiredEmperorPaymentResponders(g), ['first', 'owner']);
  const hands = g.nexusCards!.cards!.hands;
  [hands.first, hands.owner] = [hands.owner, hands.first];
  g.players.find(player => player.id === 'emperor')!.spice = 0;
  assert.deepEqual(requiredEmperorPaymentResponders(g), ['first', 'owner']);
  hands.first = null;
  assert.deepEqual(requiredEmperorPaymentResponders(g), ['owner']);
  g.order.reverse();
  hands.first = 'emperor';
  assert.deepEqual(requiredEmperorPaymentResponders(g), ['owner', 'first']);
});

void test('source clears outside the original positive normal mutual-allied obligation', () => {
  const changes: ((g: Game) => void)[] = [
    g => { g.phase = 4; },
    g => { g.auction = null; },
    g => { g.auction!.bid = 0; },
    g => { g.auction!.bidder = 'emperor'; },
    g => { g.players.find(player => player.id === 'emperor')!.ally = null; },
    g => { g.players.find(player => player.id === 'buyer')!.ally = null; },
    g => { g.currentAuctionSale = { origin: 'normal', winner: 'buyer', amount: 8, free: false, seller: null }; },
    g => { g.richeseAuction = {} as NonNullable<Game['richeseAuction']>; },
  ];
  for (const change of changes) {
    const g = obligation();
    change(g);
    assert.equal(emperorPaymentSourceQuote(g), null);
  }
});

void test('current lot cannot be already acquired or duplicate an unsold physical card', () => {
  for (const zone of ['hand', 'deck', 'discard', 'unsold'] as const) {
    const g = obligation();
    const card = g.auction!.cards[0];
    if (zone === 'hand') g.players[1].hand.push(card);
    else if (zone === 'unsold') g.auction!.cards.push(card);
    else g[zone].push(card);
    assert.equal(emperorPaymentSourceQuote(g), null);
  }
  const g = obligation();
  g.auction!.cards.unshift(g.auction!.cards[0]);
  g.auction!.index = 1;
  assert.ok(emperorPaymentSourceQuote(g));
});

void test('Use belongs only to the current exact physical holder and freezes the original event', () => {
  const g = obligation();
  const initial = open(g);
  assert.ok(emperorPaymentUseBlock(g, initial, 'owner'));
  assert.ok(emperorPaymentUseBlock(g, initial, 'first'));
  const receipt = passFirst(g, initial);
  assert.equal(emperorPaymentUseBlock(g, receipt, 'owner'), null);
  assert.ok(emperorPaymentUseBlock(g, initial, 'owner'));
  g.nexusEmperorPayment!.current = 'another-obligation';
  assert.ok(emperorPaymentUseBlock(g, receipt, 'owner'));
  g.nexusEmperorPayment!.current = receipt.event;
  g.decision = { kind: 'auctionPayment', player: 'buyer' };
  assert.ok(emperorPaymentUseBlock(g, receipt, 'owner'));
  g.decision = { kind: 'nexusEmperorPayment', player: 'owner', event: receipt.event };
  g.nexusCards!.cards = discardNexusCard(g.nexusCards!.cards!, 'owner', g.players);
  assert.ok(emperorPaymentUseBlock(g, receipt, 'owner'));
});

void test('original acknowledgement membership survives an earlier holder spending their card', () => {
  const g = obligation();
  const receipt = passFirst(g, open(g));
  g.nexusCards!.cards = discardNexusCard(g.nexusCards!.cards!, 'first', g.players);
  assert.deepEqual(requiredEmperorPaymentResponders(g), ['owner']);
  validateEmperorPaymentReceipt(g, receipt);
  assert.deepEqual(receipt.required, ['first', 'owner']);
  assert.equal(emperorPaymentUseBlock(g, receipt, 'owner'), null);
});

void test('snapshot is detached and pending validation rejects changes to each original source fact', () => {
  const changes: ((g: Game) => void)[] = [
    g => { g.auction!.bid++; },
    g => { g.auction!.cards[0] = g.deck.shift()!; },
    g => { g.auction!.cards.unshift(g.deck.shift()!); g.auction!.index = 1; },
    g => { g.auction!.bidder = 'first'; },
    g => { g.auction!.allyPayment = 1; },
    g => { g.aid.emperor.amount++; },
    g => { g.aid.emperor.recipient = 'first'; },
    g => { g.players.find(player => player.id === 'emperor')!.spice++; },
    g => { g.players.find(player => player.id === 'buyer')!.ally = null; },
  ];
  for (const change of changes) {
    const g = obligation(8, 8, 2);
    const receipt = open(g);
    const snapshot = structuredClone(receipt);
    change(g);
    assert.deepEqual(receipt, snapshot);
    assert.throws(() => validateEmperorPaymentReceipt(g, receipt));
    assert.ok(emperorPaymentUseBlock(g, receipt, 'first'));
  }
  const g = obligation();
  const required = requiredEmperorPaymentResponders(g);
  const receipt = createEmperorPaymentReceipt(g, 'original', required);
  required.reverse();
  assert.deepEqual(receipt.required, ['first', 'owner']);
});

void test('duplicate, reordered and incomplete acknowledgements and unsigned snapshots fail closed', () => {
  const g = obligation();
  const original = open(g);
  for (const changed of [
    { passed: ['first', 'first'] }, { passed: ['owner'] },
    { required: ['first', 'first'] }, { holders: ['first', 'first'] },
    { stage: 'passed' }, { stage: 'used', owner: 'owner' },
    { price: 0 }, { emperorSpice: -1 }, { phase: 4 },
    { aid: { recipient: null, amount: 1 } }, { extra: true },
  ]) {
    const receipt = { ...structuredClone(original), ...changed } as EmperorPaymentReceipt;
    receipt.signature = emperorPaymentReceiptSignature(receipt);
    assert.throws(() => validateEmperorPaymentReceipt(g, receipt));
  }
  const unsigned = structuredClone(original);
  unsigned.passed.push('first');
  assert.throws(() => validateEmperorPaymentReceipt(g, unsigned));
  const current = passFirst(g, original);
  g.pendingNexusEmperorPayment!.receipt.passed.push('first');
  assert.ok(emperorPaymentUseBlock(g, current, 'owner'));
});

void test('completed Use and allpass receipts validate history without requiring old wallets or custody', () => {
  for (const stage of ['used', 'passed'] as const) {
    const g = obligation(8, 5, 3, 2);
    const original = open(g);
    const receipt: EmperorPaymentReceipt = stage === 'used'
      ? { ...original, passed: ['first'], stage, owner: 'owner' }
      : { ...original, passed: ['first', 'owner'], stage, owner: null };
    receipt.signature = emperorPaymentReceiptSignature(receipt);
    validateEmperorPaymentReceipt(g, receipt);
    g.auction = null;
    g.aid = {};
    g.players.forEach(player => { player.spice = 0; player.ally = null; });
    g.nexusCards!.cards = discardNexusCard(g.nexusCards!.cards!, 'owner', g.players);
    g.turn++;
    g.phase = 1;
    g.order.reverse();
    validateEmperorPaymentReceipt(g, JSON.parse(JSON.stringify(receipt)) as EmperorPaymentReceipt);
    if (stage === 'used') {
      const unfunded = { ...receipt, emperorSpice: 4 };
      unfunded.signature = emperorPaymentReceiptSignature(unfunded);
      assert.throws(() => validateEmperorPaymentReceipt(g, unfunded));
    }
  }
});

void test('malformed price, split and escrow counts never produce an arithmetic entitlement', () => {
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    for (const field of ['price', 'split', 'spice', 'escrow'] as const) {
      const g = obligation(8, 8, 3);
      if (field === 'price') g.auction!.bid = invalid;
      else if (field === 'split') g.auction!.allyPayment = invalid;
      else if (field === 'spice') g.players[0].spice = invalid;
      else g.aid.emperor.amount = invalid;
      assert.equal(emperorPaymentSourceQuote(g), null);
    }
  }
});
