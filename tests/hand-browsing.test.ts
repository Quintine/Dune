import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck, treacheryDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { browseHand } from '../game/hand-browsing';

const all = [...treacheryDeck(['ix', 'choam', 'ecaz']), ...richeseCards(), ...ecazTreacheryCards()];
const named = (name: string) => {
  const card = all.find(c => c.name === name);
  assert.ok(card, name);
  return card;
};

void test('name search keeps each matching physical card and treats input as literal text', () => {
  const shields = all.filter(c => c.name === 'Shield');
  assert.ok(shields.length > 1);
  assert.deepEqual(browseHand(shields, '  SHiELD  ', 'all', 'hand'), shields);
  assert.equal(new Set(browseHand(shields, 'shield', 'all', 'name').map(c => c.id)).size, shields.length);
  assert.deepEqual(browseHand(all, '.*', 'all', 'hand'), []);
  const accented: Card[] = [{ id: 'visible-accented', name: 'Épreuve', kind: 'special' }];
  assert.deepEqual(browseHand(accented, 'epreuve', 'all', 'hand'), accented);
});

void test('printed categories include canonical expansion identities without redefining battle roles', () => {
  const hand = ['Weirding Way', 'Chemistry', 'Stone Burner', 'Portable Snooper', 'Harass & Withdraw', 'Juice of Sapho'].map(named);
  assert.deepEqual(browseHand(hand, '', 'weapon', 'hand').map(c => c.name), ['Weirding Way', 'Stone Burner']);
  assert.deepEqual(browseHand(hand, '', 'defense', 'hand').map(c => c.name), ['Chemistry', 'Portable Snooper']);
  assert.deepEqual(browseHand(hand, '', 'special', 'hand').map(c => c.name), ['Harass & Withdraw', 'Juice of Sapho']);
  assert.deepEqual(browseHand(hand, 'snooper', 'weapon', 'name'), []);
  assert.equal(browseHand(hand, 'snooper', 'defense', 'name')[0].id, named('Portable Snooper').id);
});

void test('sorting changes a copied display list, preserves duplicate order, and can restore saved hand order', () => {
  const shields = baseDeck().filter(c => c.name === 'Shield');
  assert.ok(shields.length >= 2);
  const hand = Object.freeze([named('Harass & Withdraw'), shields[1], named('Lasgun'), shields[0]].map(c => Object.freeze({ ...c })));
  const before = JSON.stringify(hand);
  assert.deepEqual(browseHand(hand, '', 'all', 'name').map(c => c.name), ['Harass & Withdraw', 'Lasgun', 'Shield', 'Shield']);
  assert.deepEqual(browseHand(hand, '', 'all', 'category').map(c => c.name), ['Lasgun', 'Shield', 'Shield', 'Harass & Withdraw']);
  assert.deepEqual(browseHand(hand, '', 'defense', 'name').map(c => c.id), [shields[1].id, shields[0].id]);
  assert.deepEqual(browseHand(hand, '', 'all', 'hand'), hand);
  assert.equal(JSON.stringify(hand), before);
});

void test('current owned cards drive results after a draw, removal and JSON restore, with no cached private holdings', () => {
  const first = [named('Shield')];
  assert.deepEqual(browseHand(first, 'sapho', 'all', 'hand'), []);
  const acquired = [...first, named('Juice of Sapho')];
  assert.equal(browseHand(acquired, 'sapho', 'all', 'hand')[0].id, named('Juice of Sapho').id);
  const removed = acquired.filter(c => c.name !== 'Juice of Sapho');
  assert.deepEqual(browseHand(removed, 'sapho', 'all', 'hand'), []);
  assert.deepEqual(browseHand(JSON.parse(JSON.stringify(acquired)), 'sapho', 'all', 'name'), [named('Juice of Sapho')]);
  assert.deepEqual(browseHand([], '', 'all', 'category'), []);
});
