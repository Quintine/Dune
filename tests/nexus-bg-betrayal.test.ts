import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { nexusTraitorInventory } from './fixture-nexus-traitors';
import { nexusBgBetrayalFixture } from './fixture-nexus-bg-betrayal';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const declare = (g: Game) => applyAction(g, 'p', { type: 'voice', kind: 'poison', must: false });
function rejected(g: Game, id: string, action: Action) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, id, action));
  assert.equal(JSON.stringify(g), before);
}

void test('every seat receives a Voice response with Nexus enabled, even without a hidden holder or Karama', () => {
  const g = declare(nexusBgBetrayalFixture());
  assert.equal(g.response?.kind, 'voice');
  assert.equal(g.response.owner, 'p');
  assert.equal(viewGame(g, 'r').nexusBgBetrayal?.event, g.battle!.event);
  for (const id of ['p', 'q']) {
    assert.equal(viewGame(g, id).nexusBgBetrayal, null);
    assert.equal('nexusBgBetrayalHistory' in viewGame(g, id), false);
  }
  let absent = declare(nexusBgBetrayalFixture(null));
  for (const id of ['p', 'q']) absent = applyAction(absent, id, { type: 'passResponse' });
  assert.equal(absent.response?.kind, 'voice');
  absent = applyAction(absent, 'r', { type: 'passResponse' });
  assert.equal(absent.response, null);
  const passed = applyAction(g, 'r', { type: 'passResponse' });
  rejected(passed, 'r', { type: 'nexusBgBetrayal', event: passed.battle!.event });
});

void test('Advanced Voice cancellation retains physical Fremen elite custody and subsequent Prescience timing', () => {
  const g = declare(nexusBgBetrayalFixture('r', true, 'atreides'));
  assert.equal(g.response?.kind, 'voice');
  const before = g.players[2].elites;
  const done = applyAction(g, 'r', { type: 'nexusBgBetrayal', event: g.battle!.event });
  assert.equal(done.battle!.voice, undefined);
  assert.equal(done.battle!.preparation?.kind, 'prescience');
  assert.equal(done.battle!.preparation?.owner, 'q');
  assert.deepEqual(done.players[2].elites, before);
  assert.equal(done.nexusBgBetrayalHistory?.length, 1);
  nexusTraitorInventory(done);
});

void test('a pending Harkonnen Nexus return suspends Voice Betrayal and restores it on completion', () => {
  let g = declare(nexusBgBetrayalFixture('r', false, 'harkonnen'));
  const offer = viewGame(g, 'q').nexusTraitors!.offer!;
  assert.equal(offer.mode, 'cunning');
  g = applyAction(g, 'q', { type: 'nexusTraitorDraw', event: offer.event, mode: offer.mode });
  assert.equal(viewGame(g, 'r').nexusBgBetrayal, null);
  rejected(g, 'r', { type: 'nexusBgBetrayal', event: g.battle!.event });
  const pending = viewGame(g, 'q').nexusTraitors!.pending!;
  g = applyAction(g, 'q', {
    type: 'nexusTraitorReturn', event: pending.event,
    cards: pending.choices.filter(card => card.drawn).map(card => card.id),
  });
  assert.equal(viewGame(g, 'r').nexusBgBetrayal?.event, g.battle!.event);
  const canceled = applyAction(g, 'r', { type: 'nexusBgBetrayal', event: g.battle!.event });
  assert.equal(canceled.battle!.voice, undefined);
  nexusTraitorInventory(canceled);
});

void test('one physical BG Nexus card cancels only the declared Voice, preserving plans and replay safety', () => {
  const initial = declare(nexusBgBetrayalFixture());
  const action = { type: 'nexusBgBetrayal', event: initial.battle!.event };
  rejected(initial, 'p', action);
  rejected(initial, 'q', action);
  rejected(initial, 'r', { ...action, event: 'old' });
  rejected(initial, 'r', { ...action, injected: true });
  const voice = initial.battle!.voice;
  assert.ok(voice);
  const after = applyAction(reload(initial), 'r', action);
  assert.equal(after.response, null);
  assert.equal(after.battle!.voice, undefined);
  assert.equal(after.battle!.plans.q, undefined);
  assert.equal(after.nexusCards!.cards!.hands.r, null);
  assert.equal(after.nexusCards!.cards!.discard.filter(card => card === 'beneGesserit').length, 1);
  assert.equal(after.nexusBgBetrayalHistory?.length, 1);
  rejected(after, 'r', action);
  assert.deepEqual(normalizeAutomaticGame(reload(after)), reload(after));
  nexusTraitorInventory(after);
});

void test('prevented Voice allows the otherwise forbidden physical poison plan', () => {
  const initial = nexusBgBetrayalFixture();
  const poison = initial.deck.find(card => card.kind === 'poison')!;
  initial.deck = initial.deck.filter(card => card.id !== poison.id);
  initial.players[1].hand.push(poison);
  const announced = declare(initial);
  let allowed = announced;
  for (const id of ['p', 'q', 'r'])
    allowed = applyAction(allowed, id, { type: 'passResponse' });
  const plan = { type: 'battlePlan', leader: 'guild-0', weapon: poison.id, dial: 0 };
  rejected(allowed, 'q', plan);
  const betrayed = applyAction(announced, 'r', { type: 'nexusBgBetrayal', event: announced.battle!.event });
  assert.equal(applyAction(betrayed, 'q', plan).battle!.plans.q.weapon, poison.id);
  assert.deepEqual(betrayed.players[1].hand, announced.players[1].hand);
});

void test('active Truthtrance suspends the private Voice reaction without consuming its card', () => {
  const initial = declare(nexusBgBetrayalFixture());
  const card = initial.deck.find(candidate => candidate.effect === 'truthtrance')!;
  initial.deck = initial.deck.filter(candidate => candidate.id !== card.id);
  initial.players[1].hand.push(card);
  let waiting = applyAction(initial, 'q', { type: 'card', card: card.id });
  assert.equal(waiting.truthtrance?.stage, 'priority');
  assert.equal(viewGame(waiting, 'r').nexusBgBetrayal, null);
  rejected(waiting, 'r', { type: 'nexusBgBetrayal', event: waiting.battle!.event });
  while (waiting.truthtrance?.stage === 'priority')
    waiting = applyAction(waiting, waiting.players.find(p => !waiting.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' });
  waiting = applyAction(waiting, 'q', { type: 'truthAsk', question: {
    kind: 'fact', target: 'p', fact: { kind: 'hand', name: 'Shield' },
  } });
  rejected(waiting, 'r', { type: 'nexusBgBetrayal', event: waiting.battle!.event });
  waiting = applyAction(waiting, 'p', { type: 'truthAnswer', answer: 'no' });
  assert.equal(viewGame(waiting, 'r').nexusBgBetrayal?.event, waiting.battle!.event);
});

void test('all bot profiles spend their private card or pass the uniform Voice response', () => {
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const g = declare(nexusBgBetrayalFixture());
    g.players[2].bot = difficulty;
    const action = botActions(viewGame(g, 'r'))[0];
    assert.equal(action?.type, 'nexusBgBetrayal');
    assert.equal(applyAction(g, 'r', action).battle!.voice, undefined);
    const absent = declare(nexusBgBetrayalFixture(null));
    absent.players[2].bot = difficulty;
    assert.equal(botActions(viewGame(absent, 'r'))[0]?.type, 'passResponse');
  }
});
