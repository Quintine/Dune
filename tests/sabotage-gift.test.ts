import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteSabotageGift, quoteSabotageGiftDiscard, SabotageGiftError } from '../game/sabotage-gift';

const card = (id: string) => Object.freeze({ id, face: `face of ${id}` });

void test('a Sabotage gift transfers the same physical card without mutating either hand', () => {
  const given = card('gift'), held = card('keep'), existing = card('existing');
  const ownerHand = Object.freeze([given, held]), recipientHand = Object.freeze([existing]);
  const result = quoteSabotageGift({ ownerHand, recipientHand, cardId: given.id, handLimit: 2 });
  assert.equal(result.card, given);
  assert.deepEqual(result.ownerHand, [held]);
  assert.deepEqual(result.recipientHand, [existing, given]);
  assert.equal(result.overflow, 0);
  assert.deepEqual(ownerHand, [given, held]);
  assert.deepEqual(recipientHand, [existing]);
});

void test('a full recipient chooses any actual card, including the gift, to resolve one overflow', () => {
  const cards = [card('a'), card('b'), card('c'), card('d')];
  const given = card('gift');
  const gift = quoteSabotageGift({ ownerHand: [given], recipientHand: cards, cardId: given.id, handLimit: 4 });
  assert.equal(gift.overflow, 1);
  for (const choice of [cards[1], given]) {
    const before = [...gift.recipientHand];
    const discard = quoteSabotageGiftDiscard({ recipientHand: gift.recipientHand, cardId: choice.id, handLimit: 4 });
    assert.equal(discard.card, choice);
    assert.equal(discard.overflow, 0);
    assert.equal(discard.recipientHand.length, 4);
    assert.ok(!discard.recipientHand.some(held => held.id === choice.id));
    assert.deepEqual(gift.recipientHand, before);
  }
});

void test('gift quotes reject stale, duplicate and already-invalid physical hands', () => {
  const gift = card('gift'), other = card('other');
  for (const input of [
    { ownerHand: [gift], recipientHand: [other], cardId: 'missing', handLimit: 4 },
    { ownerHand: [gift, gift], recipientHand: [other], cardId: gift.id, handLimit: 4 },
    { ownerHand: [gift], recipientHand: [gift], cardId: gift.id, handLimit: 4 },
    { ownerHand: [gift], recipientHand: [other], cardId: gift.id, handLimit: 0 },
    { ownerHand: [gift], recipientHand: [other], cardId: gift.id, handLimit: -1 },
    { ownerHand: [gift], recipientHand: [other], cardId: ' gift ', handLimit: 4 },
  ]) assert.throws(() => quoteSabotageGift(input), SabotageGiftError);
});

void test('overflow resolution rejects a stale limit, unavailable card or duplicate custody', () => {
  const a = card('a'), b = card('b');
  for (const input of [
    { recipientHand: [a, b], cardId: a.id, handLimit: 2 },
    { recipientHand: [a, b], cardId: 'missing', handLimit: 1 },
    { recipientHand: [a, a], cardId: a.id, handLimit: 1 },
    { recipientHand: [a, b], cardId: a.id, handLimit: 0 },
  ]) assert.throws(() => quoteSabotageGiftDiscard(input), SabotageGiftError);
});
