import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card } from '../game/cards';
import { NEXUS_FACTIONS, type NexusPlayer, type NexusState } from '../game/nexus-cards';
import { richeseCards } from '../game/richese-cards';
import {
  createRicheseBetrayalReceipt, quoteRicheseNormalBetrayalInvoice,
  requiredRicheseBetrayalResponders, richeseBetrayalEligibility,
  richeseBetrayalEvent, richeseBetrayalVetoesPurchase,
  validateRicheseBetrayalCursor, validateRicheseBetrayalReceipt,
  RicheseBetrayalError, type RicheseBetrayalInvoice,
} from '../game/nexus-richese-betrayal';

const players: NexusPlayer[] = [
  { id: 'richese', faction: 'richese' },
  { id: 'holder', faction: 'fremen' },
  { id: 'emperor', faction: 'emperor' },
];
const ordinary: Card = { id: 'normal-weapon', name: 'Maula Pistol', kind: 'projectile' };
const other: Card = { id: 'other-auction-card', name: 'Shield', kind: 'shield' };
type NormalInput = Parameters<typeof quoteRicheseNormalBetrayalInvoice>[0];

function normalInput(card: Card = richeseCards()[0], allyPayment = 0): NormalInput {
  return {
    players: players.map(player => ({ ...player, ...(allyPayment ?
      player.id === 'richese' ? { ally: 'emperor' } :
      player.id === 'emperor' ? { ally: 'richese' } : {} : {}) })),
    auction: { cards: [{ ...other }, { ...card }], index: 1, bid: 5, bidder: 'richese',
      ...(allyPayment ? { allyPayment } : {}) },
    donor: allyPayment ? 'emperor' : null,
    originalRecipient: 'emperor', physicalCards: [{ ...other }, { ...card }],
  };
}
function usedReceipt(invoice: RicheseBetrayalInvoice) {
  return createRicheseBetrayalReceipt({ turn: 2, players }, {
    event: richeseBetrayalEvent(2, 1, 'round-2', 'lot-2'), turn: 2, sequence: 1,
    round: 'round-2', lot: 'lot-2', invoice,
    required: ['holder'], passed: [], stage: 'used', actor: 'holder', nexusDiscardIndex: 0,
  });
}
function reject(input: NormalInput) {
  const before = JSON.stringify(input);
  assert.throws(() => quoteRicheseNormalBetrayalInvoice(input), RicheseBetrayalError);
  assert.equal(JSON.stringify(input), before);
}

void test('ordinary Richese purchases bind the same invoice for either concealed card family', () => {
  for (const card of [richeseCards()[0], ordinary]) {
    const input = normalInput(card, 2);
    const before = JSON.stringify(input);
    const invoice = quoteRicheseNormalBetrayalInvoice(input);
    assert.deepEqual(invoice, {
      kind: 'purchase', target: 'richese', buyer: 'richese', source: 'normal',
      price: 5, ownPayment: 3, allyPayment: 2, donor: 'emperor',
      originalRecipient: 'emperor', card,
    });
    assert.equal(JSON.stringify(input), before);
    assert.notEqual(invoice.card, input.auction.cards[1]);
    assert.notEqual(invoice.card, input.physicalCards[1]);
    invoice.card.name = 'Changed output';
    assert.equal(JSON.stringify(input), before);
  }
  const bank = normalInput();
  bank.players = bank.players.filter(player => player.id !== 'emperor');
  bank.originalRecipient = null;
  assert.equal(quoteRicheseNormalBetrayalInvoice(bank).originalRecipient, null);
});

void test('normal source requires the actual native winner, a positive safe price and a current card index', () => {
  for (const index of [-1, 2, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const input = normalInput();
    input.auction.index = index;
    reject(input);
  }
  for (const bid of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const input = normalInput();
    input.auction.bid = bid;
    reject(input);
  }
  for (const bidder of [null, 'holder', 'unknown']) {
    const input = normalInput();
    input.auction.bidder = bidder;
    reject(input);
  }
  const noCards = normalInput();
  noCards.auction.cards = [];
  reject(noCards);
  const wrongRecipient = normalInput();
  wrongRecipient.originalRecipient = 'holder';
  reject(wrongRecipient);
  const missingEmperorPayment = normalInput();
  missingEmperorPayment.originalRecipient = null;
  reject(missingEmperorPayment);
});

void test('normal source binds one exact physical card without manufacturing or substituting its face', () => {
  const absent = normalInput();
  absent.physicalCards = absent.physicalCards.slice(0, -1);
  reject(absent);
  const duplicate = normalInput();
  duplicate.physicalCards = [...duplicate.physicalCards, { ...duplicate.auction.cards[1] }];
  reject(duplicate);
  const duplicatedLot = normalInput();
  duplicatedLot.auction.cards.push({ ...duplicatedLot.auction.cards[1] });
  reject(duplicatedLot);
  const substituted = normalInput();
  substituted.physicalCards[1].name = 'Different face with the same physical ID';
  reject(substituted);
  const malformed = normalInput();
  malformed.auction.cards[1] = { ...ordinary, kind: 'invalid' } as unknown as Card;
  reject(malformed);
});

void test('normal funding preserves the actual whole split and reciprocal donor', () => {
  for (const allyPayment of [0, 2, 5]) {
    const invoice = quoteRicheseNormalBetrayalInvoice(normalInput(ordinary, allyPayment));
    assert.equal(invoice.ownPayment, 5 - allyPayment);
    assert.equal(invoice.allyPayment, allyPayment);
  }
  for (const allyPayment of [-1, 6, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const input = normalInput();
    input.auction.allyPayment = allyPayment;
    reject(input);
  }
  const noDonor = normalInput(ordinary, 2);
  noDonor.donor = null;
  reject(noDonor);
  const extraDonor = normalInput();
  extraDonor.donor = 'emperor';
  reject(extraDonor);
  const unrelated = normalInput(ordinary, 2);
  unrelated.donor = 'holder';
  reject(unrelated);
  const unilateral = normalInput(ordinary, 2);
  unilateral.players = unilateral.players.map(player => player.id === 'emperor'
    ? { id: player.id, faction: player.faction } : player);
  reject(unilateral);
});

void test('concealed family does not determine the responder set or physical Nexus eligibility', () => {
  const cards: NexusState = {
    version: 1, deck: NEXUS_FACTIONS.filter(card => card !== 'richese'), discard: [],
    hands: { richese: null, holder: 'richese', emperor: null },
  };
  const before = JSON.stringify(cards);
  for (const card of [richeseCards()[0], ordinary]) {
    const input = normalInput(card);
    quoteRicheseNormalBetrayalInvoice(input);
    assert.deepEqual(requiredRicheseBetrayalResponders(input.players.map(player => ({
      ...player, nexusHeld: player.id === 'holder',
    }))), ['holder']);
    assert.equal(richeseBetrayalEligibility({ players: input.players, cards }, 'holder'), null);
  }
  assert.equal(JSON.stringify(cards), before);
});

void test('a committed normal miss is valid used history with the same physical Nexus cost', () => {
  for (const [card, vetoes] of [[richeseCards()[0], true], [ordinary, false]] as const) {
    const receipt = usedReceipt(quoteRicheseNormalBetrayalInvoice(normalInput(card)));
    assert.equal(richeseBetrayalVetoesPurchase(receipt.invoice), vetoes);
    assert.equal(receipt.stage, 'used');
    assert.equal(receipt.actor, 'holder');
    assert.equal(receipt.nexusDiscardIndex, 0);
    validateRicheseBetrayalReceipt({ turn: 3, players }, JSON.parse(JSON.stringify(receipt)));
    validateRicheseBetrayalCursor({ turn: 3, players }, {
      sequence: 1, current: null, completed: [receipt],
    }, null);
    const wrongCost = { ...receipt, nexusDiscardIndex: null };
    assert.throws(() => validateRicheseBetrayalReceipt({ turn: 3, players }, wrongCost), RicheseBetrayalError);
  }
});

void test('normal purchase history cannot become a normal sale or a hidden Black Market self-purchase', () => {
  const invoice = quoteRicheseNormalBetrayalInvoice(normalInput(ordinary));
  const invalid: RicheseBetrayalInvoice[] = [
    { ...invoice, kind: 'sale', buyer: 'emperor', originalRecipient: 'richese' },
    { ...invoice, source: 'blackMarket' },
    { ...invoice, source: 'cache' },
    { ...invoice, source: 'unknown' as RicheseBetrayalInvoice['source'] },
  ];
  for (const changed of invalid) {
    const before = JSON.stringify(changed);
    assert.throws(() => usedReceipt(changed), RicheseBetrayalError);
    assert.equal(JSON.stringify(changed), before);
  }
});

void test('old cache and Black Market receipt signature bytes and outcome meanings stay unchanged', () => {
  for (const source of ['cache', 'blackMarket'] as const) {
    const invoice: RicheseBetrayalInvoice = source === 'cache' ? {
      kind: 'purchase', target: 'richese', buyer: 'richese', source,
      price: 5, ownPayment: 5, allyPayment: 0, donor: null,
      originalRecipient: 'emperor', card: richeseCards()[0],
    } : {
      kind: 'sale', target: 'richese', buyer: 'emperor', source,
      price: 5, ownPayment: 5, allyPayment: 0, donor: null,
      originalRecipient: 'richese', card: { ...ordinary },
    };
    const receipt = usedReceipt(invoice);
    const event = JSON.stringify(['nexusRicheseBetrayal', 2, 1, 'round-2', 'lot-2']);
    assert.equal(receipt.signature, JSON.stringify([
      'richeseBetrayalReceipt', 1, event, 2, 1, 'round-2', 'lot-2',
      invoice.kind, 'richese', invoice.buyer, source, 5, 5, 0, null, invoice.originalRecipient,
      [invoice.card.id, invoice.card.name, invoice.card.kind, invoice.card.effect ?? null],
      ['holder'], [], 'used', 'holder', 0,
    ]));
    assert.equal(richeseBetrayalVetoesPurchase(receipt.invoice), source === 'cache');
  }
});
