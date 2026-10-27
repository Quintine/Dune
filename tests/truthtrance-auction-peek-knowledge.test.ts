import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck } from '../game/cards';
import { createGame, newPlayer, type Auction } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { TRUTH_CARD_NAMES } from '../game/truthtrance-card-names';
import { knowledgeFactAnswer, knowledgeFactText, parseKnowledgeFact, truthKnowledgeOf } from '../game/truthtrance-knowledge';

void test('auction knowledge accepts canonical Treachery Card names and normalizes inputs', () => {
  for (const name of TRUTH_CARD_NAMES)
    assert.deepEqual(parseKnowledgeFact({ kind: 'auctionPeek', name, extra: true }), { kind: 'auctionPeek', name });
  for (const name of ['', 'a hidden card', null, 7, {}, ['Shield']])
    assert.throws(() => parseKnowledgeFact({ kind: 'auctionPeek', name }));
  assert.match(knowledgeFactText({ kind: 'auctionPeek', name: 'Shield' }), /auction card.*Shield/);
});

void test('only Atreides with an active successful ordinary-lot inspection can answer', () => {
  const game = createGame('LOTTEST', newPlayer('a', 'Atreides', 'atreides'));
  const owner = game.players[0];
  const other = newPlayer('b', 'Other', 'guild');
  const cards = baseDeck();
  const shield = cards.find(card => card.name === 'Shield')!;
  const otherCard = cards.find(card => card.name !== 'Shield')!;
  const auction: Auction = { cards: [shield, otherCard], index: 0, bid: 0, bidder: null,
    active: 'a', passed: [], opener: 0, peekKnown: true };
  game.phase = 3;
  game.auction = auction;
  const fact = { kind: 'auctionPeek', name: 'Shield' } as const;
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf(game, owner)), 'yes');
  assert.equal(knowledgeFactAnswer({ kind: 'auctionPeek', name: otherCard.name }, truthKnowledgeOf(game, owner)), 'no');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf(game, other)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...game, phase: 4 }, owner)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...game, auction: null }, owner)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...game, auction: { ...auction, peekKnown: false } }, owner)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...game, auction: { ...auction, index: 8 } }, owner)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact), 'unknown');
  const next = { ...game, auction: { ...auction, index: 1 } };
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf(next, owner)), 'no');
  assert.equal(knowledgeFactAnswer({ kind: 'auctionPeek', name: otherCard.name }, truthKnowledgeOf(next, owner)), 'yes');
});

void test('non-entitled callers cannot read private lot cards; compound questions expose only the aggregate', () => {
  const game = createGame('LOTTEST', newPlayer('a', 'Atreides', 'atreides'));
  const owner = game.players[0];
  const other = newPlayer('b', 'Other', 'guild');
  game.phase = 3;
  const shield = baseDeck().find(card => card.name === 'Shield')!;
  const lot: Auction = { cards: [shield], index: 0, bid: 0, bidder: null,
    active: 'a', passed: [], opener: 0, peekKnown: true };
  game.auction = lot;
  const hidden = { ...game, get auction(): never { throw new Error('Unentitled auction access'); } };
  assert.equal(truthKnowledgeOf(hidden, other).auctionPeek, null);
  hidden.phase = 4;
  assert.equal(truthKnowledgeOf(hidden, owner).auctionPeek, null);
  const uninspected = { ...lot, peekKnown: false, get cards(): never { throw new Error('Uninspected card access'); } };
  assert.equal(truthKnowledgeOf({ ...game, auction: uninspected }, owner).auctionPeek, null);
  const knowledge = truthKnowledgeOf(game, owner);
  const fact = { kind: 'auctionPeek', name: 'Shield' } as const;
  assert.equal(truthFactAnswer(owner, { kind: 'and', terms: [fact, { kind: 'spice', compare: 'gte', value: 0 }] }, knowledge), 'yes');
  assert.equal(truthFactAnswer(owner, { kind: 'or', terms: [fact, { kind: 'spice', compare: 'gte', value: 999 }] }, knowledge), 'yes');
});
