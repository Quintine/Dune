import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card } from '../game/cards';
import { NEXUS_FACTIONS, type NexusPlayer, type NexusState } from '../game/nexus-cards';
import { createRicheseAuction, submitRicheseBid } from '../game/richese-auction';
import { richeseCards } from '../game/richese-cards';
import { quoteRicheseSettlement } from '../game/richese-settlement';
import {
  createRicheseBetrayalReceipt, quoteRicheseBetrayalInvoice,
  requiredRicheseBetrayalResponders, richeseBetrayalEligibility,
  richeseBetrayalEvent, validateRicheseBetrayalCursor, validateRicheseBetrayalReceipt,
  RicheseBetrayalError,
  type RicheseBetrayalReceipt,
} from '../game/nexus-richese-betrayal';

const players: NexusPlayer[] = [
  { id: 'seller', faction: 'richese' },
  { id: 'buyer', faction: 'atreides' },
  { id: 'holder', faction: 'fremen' },
  { id: 'emperor', faction: 'emperor' },
];
const context = { turn: 2, players };

function soldInput(source: 'cache' | 'blackMarket' = 'cache', self = false, allyPayment = 0) {
  const card: Card = source === 'cache' ? richeseCards()[0] : { id: 'base-weapon', name: 'Maula Pistol', kind: 'projectile' };
  const winner = self ? 'seller' : 'buyer';
  let lot = createRicheseAuction({
    event: 'lot-2', cardId: card.id, owner: 'seller', source, method: 'silent',
    eligible: ['buyer', 'seller'], order: ['buyer', 'seller'], tieOrder: ['buyer', 'seller'],
  });
  lot = submitRicheseBid(lot, { event: lot.event, actor: 'buyer', amount: self ? 0 : 5 }, 5);
  lot = submitRicheseBid(lot, { event: lot.event, actor: 'seller', amount: self ? 5 : 0 }, 5);
  const roster = allyPayment ? players.map(p => ({ ...p,
    ...(p.id === winner ? { ally: 'emperor' } : p.id === 'emperor' ? { ally: winner } : {}),
  })) : players;
  const quote = quoteRicheseSettlement({
    lot, owner: { id: 'seller', handCount: 0, handLimit: 4 },
    winner: { id: winner, handCount: 0, handLimit: 4, spice: 5 - allyPayment },
    card, funding: { amount: 5, allyPayment, donor: allyPayment ? 'emperor' : null },
    allyCredit: { amount: allyPayment },
  });
  assert.equal(quote.kind, 'sold');
  if (quote.kind !== 'sold') throw new Error('Fixture must produce a funded sold invoice.');
  return { players: roster, lot, quote, donor: allyPayment ? 'emperor' : null,
    originalRecipient: (self ? 'emperor' : 'seller') as string | null, sourceCards: [card], physicalCards: [card] };
}
function receipt(stage: 'pending' | 'passed' | 'used' = 'used'): RicheseBetrayalReceipt {
  return createRicheseBetrayalReceipt(context, {
    event: richeseBetrayalEvent(2, 1, 'round-2', 'lot-2'), turn: 2, sequence: 1,
    round: 'round-2', lot: 'lot-2', invoice: quoteRicheseBetrayalInvoice(soldInput()),
    required: ['holder', 'buyer'], passed: stage === 'passed' ? ['holder', 'buyer'] : ['buyer'],
    stage, actor: stage === 'used' ? 'holder' : null, nexusDiscardIndex: stage === 'used' ? 0 : null,
  });
}
function cardsFor(holderCard: typeof NEXUS_FACTIONS[number]): NexusState {
  return { version: 1, deck: NEXUS_FACTIONS.filter(card => card !== holderCard), discard: [],
    hands: { seller: null, buyer: null, holder: holderCard, emperor: null } };
}

void test('public self-cache invoice remains distinct from an income-bearing sale', () => {
  const self = quoteRicheseBetrayalInvoice(soldInput('cache', true));
  assert.equal(self.kind, 'purchase');
  assert.equal(self.buyer, self.target);
  assert.equal(self.originalRecipient, 'emperor');
  const sale = quoteRicheseBetrayalInvoice(soldInput('cache', false, 3));
  assert.equal(sale.kind, 'sale');
  assert.equal(sale.originalRecipient, sale.target);
  assert.equal(sale.price, 5);
  assert.equal(sale.ownPayment, 2);
  assert.equal(sale.allyPayment, 3);
  assert.equal(sale.donor, 'emperor');
  const bank = soldInput('cache', true);
  bank.players = bank.players.filter(p => p.id !== 'emperor');
  bank.originalRecipient = null;
  assert.equal(quoteRicheseBetrayalInvoice(bank).originalRecipient, null);
});

void test('concealed Black Market sale needs no Richese-family face but cannot become a self-purchase', () => {
  const input = soldInput('blackMarket');
  const invoice = quoteRicheseBetrayalInvoice(input);
  assert.equal(invoice.source, 'blackMarket');
  assert.equal(invoice.kind, 'sale');
  assert.equal(invoice.card.id, 'base-weapon');
  const self = structuredClone(input);
  self.lot.outcome = { kind: 'sold', winner: 'seller', amount: 5 };
  self.quote.winner = 'seller';
  assert.throws(() => quoteRicheseBetrayalInvoice(self), RicheseBetrayalError);
});

void test('quote rejects changed custody, substituted face, wrong invoice recipient or noncanonical cache', () => {
  const input = soldInput();
  const reject = (patch: Partial<typeof input>) => {
    const changed = { ...structuredClone(input), ...patch };
    const before = JSON.stringify(changed);
    assert.throws(() => quoteRicheseBetrayalInvoice(changed), RicheseBetrayalError);
    assert.equal(JSON.stringify(changed), before);
  };
  reject({ sourceCards: [] });
  reject({ physicalCards: [] });
  reject({ physicalCards: [input.quote.card, input.quote.card] });
  reject({ sourceCards: [{ ...input.quote.card, name: 'Wrong face' }] });
  reject({ originalRecipient: 'emperor' });
  reject({ donor: 'holder' });
  reject({ quote: { ...input.quote, ownPayment: 4 } });
  reject({ quote: { ...input.quote, amount: 6 } });
  const counterfeit = { ...input.quote.card, effect: 'counterfeit' };
  reject({ quote: { ...input.quote, card: counterfeit }, sourceCards: [counterfeit], physicalCards: [counterfeit] });
  reject({ lot: { ...input.lot, method: 'normal' } });
});

void test('exact contribution split binds a real reciprocal ally, not an unrelated funding donor', () => {
  const input = soldInput('blackMarket', false, 5);
  const invoice = quoteRicheseBetrayalInvoice(input);
  assert.equal(invoice.ownPayment, 0);
  assert.equal(invoice.allyPayment, invoice.price);
  const unrelated = { ...input, donor: 'holder' };
  assert.throws(() => quoteRicheseBetrayalInvoice(unrelated), /unallied contributor/);
  const overspend = { ...input, quote: { ...input.quote, ownPayment: 0, allyPayment: 6 } };
  assert.throws(() => quoteRicheseBetrayalInvoice(overspend), RicheseBetrayalError);
  const fractional = { ...input, quote: { ...input.quote, ownPayment: 0.5, allyPayment: 4.5 } };
  assert.throws(() => quoteRicheseBetrayalInvoice(fractional), RicheseBetrayalError);
});

void test('price boundaries preserve a whole positive invoice without overflow or zero-result reinterpretation', () => {
  for (const price of [1, Number.MAX_SAFE_INTEGER]) {
    const input = soldInput();
    input.lot.outcome = { kind: 'sold', winner: 'buyer', amount: price };
    input.quote.amount = price;
    input.quote.ownPayment = price;
    const invoice = quoteRicheseBetrayalInvoice(input);
    assert.equal(invoice.price, price);
    assert.equal(invoice.ownPayment, price);
  }
  for (const price of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const input = soldInput();
    input.lot.outcome = { kind: 'sold', winner: 'buyer', amount: price };
    input.quote.amount = price;
    input.quote.ownPayment = price;
    assert.throws(() => quoteRicheseBetrayalInvoice(input), RicheseBetrayalError);
  }
});

void test('neutral responders depend on public held-presence and alliances, not private identity', () => {
  const publicSeats = players.map(p => ({ ...p, nexusHeld: p.id === 'holder' || p.id === 'seller' }));
  assert.deepEqual(requiredRicheseBetrayalResponders(publicSeats), ['holder']);
  const relevant = cardsFor('richese');
  const unrelated = cardsFor('guild');
  assert.equal(richeseBetrayalEligibility({ players, cards: relevant }, 'holder'), null);
  assert.match(richeseBetrayalEligibility({ players, cards: unrelated }, 'holder')!, /real Richese Nexus/);
  // Both secret variants have identical held-presence and therefore neutral timing.
  for (const cards of [relevant, unrelated]) {
    assert.deepEqual(requiredRicheseBetrayalResponders(players.map(p => ({ ...p, nexusHeld: cards.hands[p.id] !== null }))), ['holder']);
  }
  const allied = players.map(p => ({ ...p,
    ...(p.id === 'holder' ? { ally: 'buyer' } : p.id === 'buyer' ? { ally: 'holder' } : {}),
  }));
  assert.deepEqual(requiredRicheseBetrayalResponders(allied.map(p => ({ ...p, nexusHeld: true }))), ['emperor']);
  assert.match(richeseBetrayalEligibility({ players: allied, cards: relevant }, 'holder')!, /allied player/);
  const native = cardsFor('richese');
  native.hands.holder = null;
  native.hands.seller = 'richese';
  assert.match(richeseBetrayalEligibility({ players, cards: native }, 'seller')!, /another faction/);
});

void test('physical singleton Nexus custody and actual native roster determine eligibility', () => {
  const cards = cardsFor('richese');
  const duplicate = structuredClone(cards);
  duplicate.deck.push('richese');
  const before = JSON.stringify(duplicate);
  assert.throws(() => richeseBetrayalEligibility({ players, cards: duplicate }, 'holder'), RicheseBetrayalError);
  assert.equal(JSON.stringify(duplicate), before);
  assert.throws(() => richeseBetrayalEligibility({ players: players.filter(p => p.id !== 'seller'), cards }, 'holder'), /native Richese/);
});

void test('completed history survives subsequent card custody and alliances, but preserves original invoice', () => {
  const record = receipt();
  const later = { turn: 8, players: players.map(p => ({ ...p,
    ...(p.id === 'holder' ? { ally: 'buyer' } : p.id === 'buyer' ? { ally: 'holder' } : {}),
  })) };
  // No current Treachery or Nexus zone is an input to intrinsic history validation.
  validateRicheseBetrayalReceipt(later, JSON.parse(JSON.stringify(record)) as RicheseBetrayalReceipt);
  assert.equal(record.invoice.originalRecipient, 'seller');
  assert.equal(record.invoice.price, 5);
  const changed = structuredClone(record);
  changed.invoice.originalRecipient = null;
  assert.throws(() => validateRicheseBetrayalReceipt(later, changed), RicheseBetrayalError);
  assert.throws(() => createRicheseBetrayalReceipt(later, { ...record, invoice: changed.invoice }), RicheseBetrayalError);
});

void test('receipt construction detaches accepted physical and acknowledgement evidence', () => {
  const input = receipt('pending');
  const saved = createRicheseBetrayalReceipt(context, input);
  input.invoice.card.name = 'Moved evidence';
  input.invoice.price = 99;
  input.required.push('emperor');
  input.passed.length = 0;
  assert.equal(saved.invoice.card.name, 'Ornithopter');
  assert.equal(saved.invoice.price, 5);
  assert.deepEqual(saved.required, ['holder', 'buyer']);
  assert.deepEqual(saved.passed, ['buyer']);
});

void test('lifecycle rejects extra keys, impossible histories, stale pending and a double spend', () => {
  const record = receipt();
  const invalid = (patch: Partial<RicheseBetrayalReceipt>) => {
    const input = { ...structuredClone(record), ...patch };
    const before = JSON.stringify(input);
    assert.throws(() => createRicheseBetrayalReceipt(context, input), RicheseBetrayalError);
    assert.equal(JSON.stringify(input), before);
  };
  invalid({ actor: 'buyer' });
  invalid({ actor: 'seller' });
  invalid({ nexusDiscardIndex: -1 });
  invalid({ sequence: 0 });
  invalid({ turn: 3 });
  invalid({ required: ['holder', 'holder'] });
  invalid({ passed: ['emperor'] });
  invalid({ stage: 'passed', actor: null, nexusDiscardIndex: null });
  invalid({ stage: 'pending', actor: null, nexusDiscardIndex: null, passed: ['holder', 'buyer'] });
  const extra = { ...record, rawAction: { type: 'bid' } };
  assert.throws(() => createRicheseBetrayalReceipt(context, extra), RicheseBetrayalError);
  assert.throws(() => validateRicheseBetrayalReceipt({ ...context, turn: 3 }, receipt('pending')), RicheseBetrayalError);
});

void test('independent cursor fails closed for deleted, orphaned, replayed or missing completed frames', () => {
  const pending = receipt('pending');
  const open = { sequence: 1, current: pending.event, completed: [] };
  validateRicheseBetrayalCursor(context, open, pending);
  assert.throws(() => validateRicheseBetrayalCursor(context, open, null), RicheseBetrayalError);
  assert.throws(() => validateRicheseBetrayalCursor(context, { ...open, current: null }, pending), RicheseBetrayalError);
  const completed = receipt('passed');
  const closed = { sequence: 1, current: null, completed: [completed] };
  validateRicheseBetrayalCursor(context, closed, null);
  assert.throws(() => validateRicheseBetrayalCursor(context, { ...closed, completed: [] }, null), RicheseBetrayalError);
  assert.throws(() => validateRicheseBetrayalCursor(context, { ...closed, completed: [pending] }, null), RicheseBetrayalError);
  assert.throws(() => validateRicheseBetrayalCursor(context, { sequence: 2, current: null, completed: [completed, completed] }, null), RicheseBetrayalError);
});
