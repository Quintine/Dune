import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card } from '../game/cards';
import type { NexusPlayer } from '../game/nexus-cards';
import { richeseCards } from '../game/richese-cards';
import {
  createRicheseBetrayalReceipt, quoteRicheseKaramaBetrayalInvoice,
  richeseBetrayalEvent, richeseBetrayalVetoesPurchase,
  validateRicheseBetrayalCursor, validateRicheseBetrayalReceipt,
  RicheseBetrayalError, type RicheseBetrayalInvoice,
} from '../game/nexus-richese-betrayal';

const players: NexusPlayer[] = [
  { id: 'richese', faction: 'richese' },
  { id: 'holder', faction: 'fremen' },
  { id: 'emperor', faction: 'emperor' },
];
const costCard: Card = { id: 'cost-karama', name: 'Karama', kind: 'special', effect: 'karama' };
const ordinary: Card = { id: 'normal-weapon', name: 'Maula Pistol', kind: 'projectile' };
const spare: Card = { id: 'spare-source', name: 'Shield', kind: 'shield' };
type KaramaInput = Parameters<typeof quoteRicheseKaramaBetrayalInvoice>[0];

function purchaseInput(source: KaramaInput['source'] = 'karama', card: Card = richeseCards()[0]): KaramaInput {
  return {
    players: players.map(player => ({ ...player })), owner: 'richese', source,
    card: { ...card }, costCard: { ...costCard }, ownerCards: [{ ...costCard }],
    sourceCards: [{ ...card }, { ...spare }],
    physicalCards: [{ ...costCard }, { ...card }, { ...spare }], originalRecipient: 'emperor',
  };
}
function usedReceipt(invoice: RicheseBetrayalInvoice) {
  return createRicheseBetrayalReceipt({ turn: 2, players }, {
    event: richeseBetrayalEvent(2, 1, 'round-2', 'lot-2'), turn: 2, sequence: 1,
    round: 'round-2', lot: 'lot-2', invoice, required: ['holder'], passed: [],
    stage: 'used', actor: 'holder', nexusDiscardIndex: 0,
  });
}
function reject(input: KaramaInput) {
  const before = JSON.stringify(input);
  assert.throws(() => quoteRicheseKaramaBetrayalInvoice(input), RicheseBetrayalError);
  assert.equal(JSON.stringify(input), before);
}

void test('pre-cost Karama invoices preserve the declared nominal price and clone the selected card', () => {
  for (const [source, price] of [['karama', 0], ['specialKarama', 3]] as const) {
    const input = purchaseInput(source);
    const before = JSON.stringify(input);
    const invoice = quoteRicheseKaramaBetrayalInvoice(input);
    assert.deepEqual(invoice, {
      kind: 'purchase', target: 'richese', buyer: 'richese', source,
      price, ownPayment: price, allyPayment: 0, donor: null,
      originalRecipient: 'emperor', card: input.card,
    });
    assert.equal(JSON.stringify(input), before);
    assert.notEqual(invoice.card, input.card);
    assert.notEqual(invoice.card, input.sourceCards[0]);
    invoice.card.name = 'Changed output';
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(input.ownerCards, [costCard]);
  }
});

void test('both nominal sources retain the original Emperor-or-bank recipient without creating a payment', () => {
  for (const source of ['karama', 'specialKarama'] as const) {
    const bank = purchaseInput(source);
    bank.players = bank.players.filter(player => player.id !== 'emperor');
    bank.originalRecipient = null;
    assert.equal(quoteRicheseKaramaBetrayalInvoice(bank).originalRecipient, null);
    const wrongRecipient = purchaseInput(source);
    wrongRecipient.originalRecipient = 'holder';
    reject(wrongRecipient);
    const missingEmperor = purchaseInput(source);
    missingEmperor.originalRecipient = null;
    reject(missingEmperor);
  }
});

void test('ordinary Karama admits either hidden family while special Karama binds a canonical cache card', () => {
  for (const [card, hit] of [[richeseCards()[0], true], [ordinary, false]] as const) {
    const input = purchaseInput('karama', card);
    const before = JSON.stringify(input);
    const invoice = quoteRicheseKaramaBetrayalInvoice(input);
    assert.equal(invoice.source, 'karama');
    assert.equal(invoice.price, 0);
    assert.equal(richeseBetrayalVetoesPurchase(invoice), hit);
    assert.equal(JSON.stringify(input), before);
  }
  assert.equal(richeseBetrayalVetoesPurchase(quoteRicheseKaramaBetrayalInvoice(purchaseInput('specialKarama'))), true);
  reject(purchaseInput('specialKarama', ordinary));
  reject(purchaseInput('specialKarama', { ...richeseCards()[0], name: 'Counterfeit Richese face' }));
});

void test('the cost stays held and distinct from one exact selected source card', () => {
  const sameCard = purchaseInput();
  sameCard.card = { ...sameCard.costCard };
  reject(sameCard);
  const noHeldCost = purchaseInput();
  noHeldCost.ownerCards = [];
  reject(noHeldCost);
  const duplicateHeldCost = purchaseInput();
  duplicateHeldCost.ownerCards = [costCard, { ...costCard }];
  reject(duplicateHeldCost);
  const substitutedCost = purchaseInput();
  substitutedCost.ownerCards = [{ ...costCard, name: 'Different held face' }];
  reject(substitutedCost);
  const noSource = purchaseInput();
  noSource.sourceCards = [spare];
  reject(noSource);
  const duplicateSource = purchaseInput();
  duplicateSource.sourceCards = [duplicateSource.card, { ...duplicateSource.card }];
  reject(duplicateSource);
  const substitutedSource = purchaseInput();
  substitutedSource.sourceCards = [{ ...substitutedSource.card, name: 'Different source face' }];
  reject(substitutedSource);
  for (const id of [costCard.id, richeseCards()[0].id]) {
    const absent = purchaseInput();
    absent.physicalCards = absent.physicalCards.filter(card => card.id !== id);
    reject(absent);
    const duplicated = purchaseInput();
    duplicated.physicalCards = [...duplicated.physicalCards, { ...duplicated.physicalCards.find(card => card.id === id)! }];
    reject(duplicated);
  }
});

void test('Karama purchase quotes reject foreign owners, wrong producer names and malformed physical faces', () => {
  for (const owner of ['', 'holder', 'unknown']) {
    const input = purchaseInput();
    input.owner = owner;
    reject(input);
  }
  const wrongSource = purchaseInput();
  wrongSource.source = 'normal' as KaramaInput['source'];
  reject(wrongSource);
  const malformedCost = purchaseInput();
  malformedCost.costCard = { ...costCard, kind: 'invalid' } as unknown as Card;
  reject(malformedCost);
  const malformedSource = purchaseInput();
  malformedSource.card = { ...ordinary, id: '' };
  reject(malformedSource);
});

void test('receipt validation keeps zero and three prices exclusive to their original Karama source', () => {
  for (const source of ['karama', 'specialKarama'] as const) {
    const invoice = quoteRicheseKaramaBetrayalInvoice(purchaseInput(source));
    const invalid: RicheseBetrayalInvoice[] = [
      ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, source === 'karama' ? 3 : 0].map(price => ({
        ...invoice, price, ownPayment: price,
      })),
      { ...invoice, kind: 'sale', buyer: 'holder', originalRecipient: 'richese' },
      { ...invoice, allyPayment: 1, ownPayment: invoice.price - 1, donor: 'emperor' },
    ];
    for (const changed of invalid) assert.throws(() => usedReceipt(changed), RicheseBetrayalError);
  }
  const legacyZero = { ...quoteRicheseKaramaBetrayalInvoice(purchaseInput()), source: 'normal' as const };
  assert.throws(() => usedReceipt(legacyZero), RicheseBetrayalError);
});

void test('a blind ordinary Karama miss remains valid used history with one committed Nexus cost', () => {
  for (const [card, hit] of [[richeseCards()[0], true], [ordinary, false]] as const) {
    const receipt = usedReceipt(quoteRicheseKaramaBetrayalInvoice(purchaseInput('karama', card)));
    assert.equal(receipt.stage, 'used');
    assert.equal(receipt.nexusDiscardIndex, 0);
    assert.equal(richeseBetrayalVetoesPurchase(receipt.invoice), hit);
    validateRicheseBetrayalReceipt({ turn: 3, players }, JSON.parse(JSON.stringify(receipt)));
    validateRicheseBetrayalCursor({ turn: 3, players }, {
      sequence: 1, current: null, completed: [receipt],
    }, null);
    assert.throws(() => validateRicheseBetrayalReceipt({ turn: 3, players }, {
      ...receipt, nexusDiscardIndex: null,
    }), RicheseBetrayalError);
  }
});

void test('all older source receipt bytes remain unchanged by the new Karama source names', () => {
  for (const source of ['cache', 'blackMarket', 'normal'] as const) {
    const invoice: RicheseBetrayalInvoice = source === 'blackMarket' ? {
      kind: 'sale', target: 'richese', buyer: 'emperor', source,
      price: 5, ownPayment: 5, allyPayment: 0, donor: null,
      originalRecipient: 'richese', card: { ...ordinary },
    } : {
      kind: 'purchase', target: 'richese', buyer: 'richese', source,
      price: 5, ownPayment: 5, allyPayment: 0, donor: null,
      originalRecipient: 'emperor', card: richeseCards()[0],
    };
    const receipt = usedReceipt(invoice);
    const event = JSON.stringify(['nexusRicheseBetrayal', 2, 1, 'round-2', 'lot-2']);
    assert.equal(receipt.signature, JSON.stringify([
      'richeseBetrayalReceipt', 1, event, 2, 1, 'round-2', 'lot-2',
      invoice.kind, 'richese', invoice.buyer, source, 5, 5, 0, null, invoice.originalRecipient,
      [invoice.card.id, invoice.card.name, invoice.card.kind, invoice.card.effect ?? null],
      ['holder'], [], 'used', 'holder', 0,
    ]));
  }
});
