import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { createGame, newPlayer, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import {
  knowledgeFactAnswer, knowledgeFactText, parseKnowledgeFact, truthKnowledgeOf,
  PRESCIENCE_LEADER_NAMES,
} from '../game/truthtrance-knowledge';

function fixture() {
  const game = createGame('PRESTEST', newPlayer('a', 'Atreides', 'atreides'));
  const target = newPlayer('e', 'Emperor', 'emperor');
  const outsider = newPlayer('g', 'Guild', 'guild');
  game.players.push(target, outsider);
  game.phase = 6;
  const shield = baseDeck().find(card => card.name === 'Shield')!;
  target.hand.push(shield);
  game.battle = {
    territory: 'arrakeen', attacker: 'a', defender: 'e', plans: {}, revealed: false,
    traitorCalls: {}, prescience: { player: 'a', field: 'weapon', value: shield.id },
  } as NonNullable<Game['battle']>;
  return { game, owner: game.players[0], target, outsider, shield };
}

void test('Prescience questions validate public faces and normalize their input', () => {
  assert.ok(PRESCIENCE_LEADER_NAMES.includes('Hasimir Fenring'));
  assert.deepEqual(parseKnowledgeFact({ kind: 'presciencePeek', field: 'leader', name: 'Hasimir Fenring', extra: true }),
    { kind: 'presciencePeek', field: 'leader', name: 'Hasimir Fenring' });
  assert.deepEqual(parseKnowledgeFact({ kind: 'presciencePeek', field: 'dial', value: 2.5, extra: true }),
    { kind: 'presciencePeek', field: 'dial', value: 2.5 });
  for (const fact of [
    { kind: 'presciencePeek', field: 'leader', name: 'secret' },
    { kind: 'presciencePeek', field: 'weapon', name: 'secret' },
    { kind: 'presciencePeek', field: 'dial', value: -1 },
    { kind: 'presciencePeek', field: 'dial', value: Infinity },
    { kind: 'presciencePeek', field: 'anything', name: 'None' },
  ]) assert.throws(() => parseKnowledgeFact(fact));
  assert.match(knowledgeFactText({ kind: 'presciencePeek', field: 'dial', value: 2.5 }), /dial.*2.5/);
});

void test('only an entitled viewer answers from the answered live battle element', () => {
  const { game, owner, target, outsider, shield } = fixture();
  const fact = { kind: 'presciencePeek', field: 'weapon', name: shield.name } as const;
  const different = { kind: 'presciencePeek', field: 'weapon', name: 'None' } as const;
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf(game, owner)), 'yes');
  assert.equal(knowledgeFactAnswer(different, truthKnowledgeOf(game, owner)), 'no');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf(game, target)), 'yes');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf(game, outsider)), 'unknown');
  assert.equal(knowledgeFactAnswer({ kind: 'presciencePeek', field: 'defense', name: shield.name }, truthKnowledgeOf(game, owner)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...game, phase: 7 }, owner)), 'unknown');
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...game, battle: null }, owner)), 'unknown');
  const pending = { ...game.battle!, prescience: { player: 'a', field: 'weapon' as const } };
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...game, battle: pending }, owner)), 'unknown');
  const canceled = { ...game.battle!, prescience: undefined };
  assert.equal(knowledgeFactAnswer(fact, truthKnowledgeOf({ ...game, battle: canceled }, owner)), 'unknown');
});

void test('dial, leader, absent card and suppressed Ecaz card follow visible battle insight', () => {
  const { game, owner, target } = fixture();
  game.battle!.prescience = { player: 'a', field: 'dial', value: 2.5 };
  assert.equal(knowledgeFactAnswer({ kind: 'presciencePeek', field: 'dial', value: 2.5 }, truthKnowledgeOf(game, owner)), 'yes');
  game.battle!.prescience = { player: 'a', field: 'leader', value: target.leaders[0].id };
  assert.equal(knowledgeFactAnswer({ kind: 'presciencePeek', field: 'leader', name: target.leaders[0].name }, truthKnowledgeOf(game, owner)), 'yes');
  game.battle!.prescience = { player: 'a', field: 'defense', value: null };
  assert.equal(knowledgeFactAnswer({ kind: 'presciencePeek', field: 'defense', name: 'None' }, truthKnowledgeOf(game, owner)), 'yes');
  const harass = ecazTreacheryCards().find(card => card.effect === 'harassWithdraw')!;
  target.hand.push(harass);
  game.battle!.prescience = { player: 'a', field: 'defense', value: harass.id };
  const knowledge = truthKnowledgeOf(game, owner);
  assert.equal(knowledgeFactAnswer({ kind: 'presciencePeek', field: 'defense', name: 'None' }, knowledge), 'yes');
  assert.equal(knowledgeFactAnswer({ kind: 'presciencePeek', field: 'defense', name: harass.name }, knowledge), 'no');
  assert.equal(truthFactAnswer(owner, { kind: 'and', terms: [
    { kind: 'presciencePeek', field: 'defense', name: 'None' }, { kind: 'spice', compare: 'gte', value: 0 },
  ] }, knowledge), 'yes');
});

void test('non-entitled players never inspect the concealed answer', () => {
  const { game, outsider } = fixture();
  game.battle!.prescience = {
    player: 'a', field: 'weapon',
    get value(): never { throw new Error('Unentitled prescience access'); },
  };
  assert.equal(truthKnowledgeOf(game, outsider).presciencePeek, null);
});
