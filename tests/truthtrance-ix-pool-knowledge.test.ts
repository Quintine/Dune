import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck } from '../game/cards';
import { createGame, newPlayer } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { TRUTH_CARD_NAMES } from '../game/truthtrance-card-names';
import { knowledgeFactAnswer, knowledgeFactText, parseKnowledgeFact, truthKnowledgeOf } from '../game/truthtrance-knowledge';

void test('Ixian pool question accepts only canonical card names and describes the recorded group', () => {
  for (const name of TRUTH_CARD_NAMES)
    assert.deepEqual(parseKnowledgeFact({ kind: 'ixPoolPeek', name, extra: true }), { kind: 'ixPoolPeek', name });
  for (const name of ['', 'a hidden card', null, 7, {}, ['Shield']])
    assert.throws(() => parseKnowledgeFact({ kind: 'ixPoolPeek', name }));
  assert.match(knowledgeFactText({ kind: 'ixPoolPeek', name: 'Shield' }), /recorded Ixian auction group includes Shield/);
});

void test('only native Basic Ixians with the current recorded inspection can answer', () => {
  const game = createGame('IXKNOW', newPlayer('ix', 'Ixians', 'ixians'), false, ['ix']);
  const ix = game.players[0];
  const other = newPlayer('other', 'Other', 'atreides');
  const shield = baseDeck().find(card => card.name === 'Shield')!;
  const absent = TRUTH_CARD_NAMES.find(name => name !== shield.name)!;
  const yes = { kind: 'ixPoolPeek', name: shield.name } as const;
  const no = { kind: 'ixPoolPeek', name: absent } as const;
  game.phase = 3;
  game.ixAuctionKnown = { turn: game.turn, cards: [shield] };
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf(game, ix)), 'yes');
  assert.equal(knowledgeFactAnswer(no, truthKnowledgeOf(game, ix)), 'no');
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf(game, other)), 'unknown');
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf({ ...game, phase: 4 }, ix)), 'unknown');
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf({ ...game, advanced: true }, ix)), 'unknown');
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf({ ...game, ixAuctionKnown: null }, ix)), 'unknown');
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf({ ...game, ixAuctionKnown: { turn: game.turn - 1, cards: [shield] } }, ix)), 'unknown');
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf({ ...game, ixAuctionKnown: { turn: game.turn, cards: [shield], controller: 'other' } }, ix)), 'unknown');
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf({ ...game, ixAuctionKnown: { turn: game.turn, cards: [shield], controller: ix.id } }, ix)), 'yes');
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf({ ...game, homeworldOccupationPreview: true }, ix)), 'unknown');
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf({ ...game, homeworldOccupationPreview: true, ixAuctionKnown: { turn: game.turn, cards: [shield], controller: ix.id } }, ix)), 'yes');
  assert.equal(knowledgeFactAnswer(yes, truthKnowledgeOf({ ...game, homeworldOccupationPreview: true, ixAuctionKnown: { turn: game.turn, cards: [shield], controller: other.id } }, other)), 'unknown');
  assert.equal(knowledgeFactAnswer(yes), 'unknown');
});

void test('non-entitled targets do not inspect the private recorded group and compounds return only the answer', () => {
  const game = createGame('IXKNOW', newPlayer('ix', 'Ixians', 'ixians'), false, ['ix']);
  const ix = game.players[0];
  const other = newPlayer('other', 'Other', 'atreides');
  const shield = baseDeck().find(card => card.name === 'Shield')!;
  const hidden = { ...game, phase: 3, get ixAuctionKnown(): never { throw new Error('Unentitled pool access'); } };
  assert.equal(truthKnowledgeOf(hidden, other).ixPoolPeek, null);
  hidden.phase = 4;
  assert.equal(truthKnowledgeOf(hidden, ix).ixPoolPeek, null);
  game.phase = 3;
  game.ixAuctionKnown = { turn: game.turn, cards: [shield] };
  const fact = { kind: 'ixPoolPeek', name: shield.name } as const;
  const knowledge = truthKnowledgeOf(game, ix);
  assert.equal(truthFactAnswer(ix, { kind: 'and', terms: [fact, { kind: 'spice', compare: 'gte', value: 0 }] }, knowledge), 'yes');
  assert.equal(truthFactAnswer(ix, { kind: 'or', terms: [fact, { kind: 'spice', compare: 'gte', value: 999 }] }, knowledge), 'yes');
});
