import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EmperorNexusPurchaseError,
  quoteEmperorNexusPurchase,
  emperorNexusPurchaseEvent,
  signEmperorNexusPurchase,
  validateEmperorNexusPurchase,
  type EmperorNexusPurchase,
} from '../game/nexus-emperor-purchase';
import { emperorNexusEvent } from '../game/nexus-emperor-secret-ally';

const context = {
  turn: 4,
  advanced: false,
  players: [
    { id: 'winner', faction: 'atreides' as const },
    { id: 'rival', faction: 'guild' as const },
  ],
};

function purchase(): EmperorNexusPurchase {
  const receipt: EmperorNexusPurchase = {
    kind: 'purchase',
    event: emperorNexusPurchaseEvent(3, 'winner', 2, 1, 4),
    owner: 'winner',
    turn: 3,
    phase: 3,
    sequence: 2,
    faction: 'atreides',
    advanced: false,
    price: 4,
    auctionIndex: 1,
    card: 'treachery-17',
    beforeSpice: 7,
    afterSpice: 7,
    signature: '',
  };
  receipt.signature = signEmperorNexusPurchase(receipt);
  return receipt;
}

void test('only a positive whole bid affordable personally and without ally contribution can be quoted', () => {
  assert.equal(quoteEmperorNexusPurchase(1, 1, 0), undefined);
  assert.equal(quoteEmperorNexusPurchase(5, 9, 0), undefined);
  assert.equal(quoteEmperorNexusPurchase(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0), undefined);
  for (const [price, ownSpice, allyPayment] of [
    [0, 10, 0], [-1, 10, 0], [1.5, 10, 0], [NaN, 10, 0],
    [Infinity, 10, 0], [Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1, 0],
    [5, 4, 0], [5, 4.5, 0], [5, -1, 0], [5, Infinity, 0],
    [5, 10, 1], [5, 10, -1], [5, 10, NaN],
  ]) {
    assert.throws(
      () => quoteEmperorNexusPurchase(price, ownSpice, allyPayment),
      EmperorNexusPurchaseError,
      `price=${price} own=${ownSpice} ally=${allyPayment}`,
    );
  }
});

void test('typed signatures are stable across property order and JSON reload; earlier turns remain valid', () => {
  const receipt = purchase();
  assert.equal(receipt.signature, signEmperorNexusPurchase({ ...receipt, signature: 'ignored' }));
  assert.equal(receipt.signature, signEmperorNexusPurchase({
    signature: '', afterSpice: 7, beforeSpice: 7, card: 'treachery-17', price: 4, auctionIndex: 1,
    advanced: false, faction: 'atreides', sequence: 2, phase: 3,
    turn: 3, owner: 'winner', event: receipt.event, kind: 'purchase',
  }));
  assert.doesNotThrow(() => validateEmperorNexusPurchase(context, JSON.parse(JSON.stringify(receipt))));
  assert.doesNotThrow(() => validateEmperorNexusPurchase({ ...context, advanced: true }, {
    ...receipt, advanced: true, signature: signEmperorNexusPurchase({ ...receipt, advanced: true }),
  }));
  const minimum = { ...receipt, price: 1, event: emperorNexusPurchaseEvent(3, 'winner', 2, 1, 1), beforeSpice: 1, afterSpice: 1 };
  minimum.signature = signEmperorNexusPurchase(minimum);
  assert.doesNotThrow(() => validateEmperorNexusPurchase(context, minimum));
});

void test('receipt fields and financial transitions cannot be changed after signing', () => {
  const receipt = purchase();
  const invalid = (patch: Partial<EmperorNexusPurchase>) =>
    assert.throws(
      () => validateEmperorNexusPurchase(context, { ...receipt, ...patch }),
      EmperorNexusPurchaseError,
    );
  invalid({ kind: 'revival' as never });
  invalid({ owner: 'rival' });
  invalid({ faction: 'guild' });
  invalid({ advanced: true });
  invalid({ turn: 4 });
  invalid({ phase: 4 as never });
  invalid({ sequence: 3 });
  invalid({ event: emperorNexusEvent(3, 4, 'winner', 2) });
  invalid({ price: 5 });
  invalid({ auctionIndex: 2 });
  invalid({ card: 'treachery-18' });
  invalid({ beforeSpice: 8 });
  invalid({ afterSpice: 6 });
  invalid({ signature: 'forged' });
});

void test('even re-signed invalid receipts reject future, nonauction, malformed, or non-reimbursed records', () => {
  const receipt = purchase();
  const invalid = (patch: Partial<EmperorNexusPurchase>) => {
    const changed = { ...receipt, ...patch };
    changed.signature = signEmperorNexusPurchase(changed);
    assert.throws(() => validateEmperorNexusPurchase(context, changed), EmperorNexusPurchaseError);
  };
  invalid({ turn: 5, event: emperorNexusEvent(5, 3, 'winner', 2) });
  invalid({ turn: 0, event: emperorNexusEvent(0, 3, 'winner', 2) });
  invalid({ phase: 4 as never, event: emperorNexusEvent(3, 4, 'winner', 2) });
  invalid({ sequence: -1, event: emperorNexusEvent(3, 3, 'winner', -1) });
  invalid({ sequence: Number.MAX_SAFE_INTEGER + 1, event: emperorNexusEvent(3, 3, 'winner', Number.MAX_SAFE_INTEGER + 1) });
  invalid({ price: 0 });
  invalid({ auctionIndex: -1 });
  invalid({ price: 8 });
  invalid({ price: 1.5 });
  invalid({ beforeSpice: 7.5, afterSpice: 7.5 });
  invalid({ afterSpice: 6 });
  invalid({ afterSpice: 11 });
  invalid({ card: ' ' });
  invalid({ beforeSpice: Number.MAX_SAFE_INTEGER + 1, afterSpice: Number.MAX_SAFE_INTEGER + 1 });
  invalid({ owner: ' ', event: emperorNexusEvent(3, 3, ' ', 2) });
  invalid({ owner: 'stranger', event: emperorNexusEvent(3, 3, 'stranger', 2) });
  invalid({ faction: 'guild' });
  invalid({ advanced: true });
  invalid({ extra: 'hidden' } as never);
  invalid({ price: undefined } as never);
  assert.throws(
    () => validateEmperorNexusPurchase(context, null as never),
    EmperorNexusPurchaseError,
  );
  assert.throws(
    () => validateEmperorNexusPurchase({ ...context, turn: 2 }, receipt),
    EmperorNexusPurchaseError,
  );
  assert.throws(
    () => validateEmperorNexusPurchase({ ...context, players: context.players.slice(1) }, receipt),
    EmperorNexusPurchaseError,
  );
  assert.throws(
    () => validateEmperorNexusPurchase({ ...context, players: [context.players[0], context.players[0]] }, receipt),
    EmperorNexusPurchaseError,
  );
});
