import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, newPlayer } from '../game/engine';
import { SPICE_CARDS } from '../game/cards';
import { truthFactAnswer } from '../game/truthtrance';
import {
  SPICE_PEEK_VALUES, knowledgeFactAnswer, knowledgeFactText,
  parseKnowledgeFact, truthKnowledgeOf,
} from '../game/truthtrance-knowledge';

void test('Spice knowledge questions accept only printed territories, worm and Sandtrout', () => {
  assert.deepEqual(SPICE_PEEK_VALUES, ['worm', 'sandtrout', ...SPICE_CARDS.map(([id]) => id)]);
  for (const value of SPICE_PEEK_VALUES)
    assert.deepEqual(parseKnowledgeFact({ kind: 'spicePeek', value, extra: 'discarded' }), { kind: 'spicePeek', value });
  for (const value of ['', 'arrakeen', 'unknown', 7, null, {}, ['worm']])
    assert.throws(() => parseKnowledgeFact({ kind: 'spicePeek', value }));
  assert.match(knowledgeFactText({ kind: 'spicePeek', value: 'worm' }), /sandworm/);
  assert.match(knowledgeFactText({ kind: 'spicePeek', value: 'hagga_basin' }), /Hagga Basin/);
});

void test('only the Atreides respondent with a current successful peek can answer', () => {
  const g = createGame('PEEKTEST', newPlayer('a', 'Atreides', 'atreides'));
  const atreides = g.players[0];
  const other = newPlayer('other', 'Other', 'guild');
  g.phase = 5;
  g.spicePeekKnown = true;
  const fact = { kind: 'spicePeek', value: 'hagga_basin' } as const;
  g.spiceDeck = [{ territory: 'hagga_basin', amount: 6, sector: 12 }];
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf(g, atreides)), 'yes');
  assert.equal(knowledgeFactAnswer({ kind: 'spicePeek', value: 'worm' }, truthKnowledgeOf(g, atreides)), 'no');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf(g, other)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...g, spicePeekKnown: false }, atreides)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...g, phase: 6 }, atreides)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...g, spiceDeck: [] }, atreides)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact), 'unknown');

  // Private deck access itself is fenced when this respondent is not entitled.
  const hidden = { ...g, get spiceDeck(): never { throw new Error('Private deck read'); } };
  assert.equal(truthKnowledgeOf(hidden, other).spicePeek, null);
  hidden.phase = 6;
  assert.equal(truthKnowledgeOf(hidden, atreides).spicePeek, null);
});

void test('worm, Sandtrout and discovery blows stay distinct and compose with other facts', () => {
  const g = createGame('PEEKTEST', newPlayer('a', 'Atreides', 'atreides'));
  const p = g.players[0];
  Object.assign(g, { phase: 5, spicePeekKnown: true, spiceDeck: [{ worm: true }] });
  const worm = { kind: 'spicePeek', value: 'worm' } as const;
  assert.equal(knowledgeFactAnswer(worm, truthKnowledgeOf(g, p)), 'yes');
  g.spiceDeck = [{ sandtrout: true }];
  assert.equal(knowledgeFactAnswer(worm, truthKnowledgeOf(g, p)), 'no');
  assert.equal(knowledgeFactAnswer({ kind: 'spicePeek', value: 'sandtrout' }, truthKnowledgeOf(g, p)), 'yes');
  g.spiceDeck = [{ territory: 'hagga_basin', amount: 6, sector: 12, discovery: 'discovery-hagga-basin' }];
  const knowledge = truthKnowledgeOf(g, p);
  const blow = { kind: 'spicePeek', value: 'hagga_basin' } as const;
  assert.equal(knowledgeFactAnswer(blow, knowledge), 'yes');
  assert.equal(truthFactAnswer(p, { kind: 'and', terms: [blow, { kind: 'spice', compare: 'gte', value: 0 }] }, knowledge), 'yes');
  assert.equal(truthFactAnswer(p, { kind: 'or', terms: [worm, { kind: 'spice', compare: 'gte', value: 0 }] }, knowledge), 'yes');
});
