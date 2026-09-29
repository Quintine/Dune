import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck } from '../game/cards';
import { createGame, joinGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { botSemutaActions } from '../game/bot-semuta';
import { richeseCards } from '../game/richese-cards';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';

const semuta = richeseCards().find((card) => card.id === SEMUTA_DRUG_ID)!;
const event = 'discard:3:6:19';

function offerView(): GameView {
  const g = createGame('BOTSEMUTA', newPlayer('owner', 'Owner', 'atreides'));
  joinGame(g, newPlayer('rival', 'Rival', 'fremen'));
  const v = viewGame(g, 'owner');
  v.status = 'playing';
  v.players.find((p) => p.id === 'owner')!.hand!.push(semuta);
  v.semutaReaction = {
    event,
    stage: 'offer',
    passed: false,
    canCommit: true,
    blocked: null,
    candidates: [],
  };
  return v;
}

function denyRivalPrivateFields(v: GameView) {
  const rival = v.players.find((p) => p.id === 'rival')!;
  for (const key of ['hand', 'traitors', 'faceDancers', 'spice'])
    Object.defineProperty(rival, key, {
      configurable: true,
      get() { throw new Error(`Read rival private ${key}`); },
    });
}

void test('all four difficulties commit using only their own card and the exact public event without mutating the projected view', () => {
  for (const difficulty of DIFFICULTIES) {
    const v = offerView();
    v.players.find((p) => p.id === v.me)!.bot = difficulty;
    const before = structuredClone(v);
    denyRivalPrivateFields(v);
    assert.deepEqual(botSemutaActions(v), [{ type: 'semutaCommit', event }]);
    const rival = v.players.find((p) => p.id === 'rival')!;
    for (const key of ['hand', 'traitors', 'faceDancers', 'spice'])
      Reflect.deleteProperty(rival, key);
    assert.deepEqual(v, before);
  }
});

void test('offer never inspects an uncommitted candidate or rival custody; unable or blocked seats pass once', () => {
  const v = offerView();
  const reaction = v.semutaReaction!;
  Object.defineProperty(reaction, 'candidates', {
    get() { throw new Error('Read unrevealed fresh cards'); },
  });
  denyRivalPrivateFields(v);
  assert.deepEqual(botSemutaActions(v), [{ type: 'semutaCommit', event }]);
  v.players.find((p) => p.id === v.me)!.hand!.length = 0;
  assert.deepEqual(botSemutaActions(v), [{ type: 'semutaPass', event }]);
  v.players.find((p) => p.id === v.me)!.hand!.push(semuta);
  reaction.blocked = 'No free hand slot';
  assert.deepEqual(botSemutaActions(v), [{ type: 'semutaPass', event }]);
  reaction.blocked = null;
  reaction.canCommit = false;
  assert.deepEqual(botSemutaActions(v), [{ type: 'semutaPass', event }]);
  reaction.passed = true;
  assert.deepEqual(botSemutaActions(v), []);
  v.semutaReaction = null;
  assert.deepEqual(botSemutaActions(v), []);
});

void test('all four difficulties select an exact projected candidate after commitment, never a guessed discard', () => {
  const [first, second] = baseDeck();
  for (const difficulty of DIFFICULTIES) {
    const v = offerView();
    v.players.find((p) => p.id === v.me)!.bot = difficulty;
    v.semutaReaction = {
      event,
      stage: 'select',
      passed: false,
      canCommit: false,
      blocked: null,
      candidates: [first, second],
    };
    const before = structuredClone(v);
    denyRivalPrivateFields(v);
    assert.deepEqual(botSemutaActions(v), [
      { type: 'semutaSelect', event, card: first.id },
    ]);
    const rival = v.players.find((p) => p.id === 'rival')!;
    for (const key of ['hand', 'traitors', 'faceDancers', 'spice'])
      Reflect.deleteProperty(rival, key);
    assert.deepEqual(v, before);
    v.semutaReaction.candidates = [second];
    assert.deepEqual(botSemutaActions(v), [
      { type: 'semutaSelect', event, card: second.id },
    ]);
    v.semutaReaction.candidates = [];
    assert.deepEqual(botSemutaActions(v), []); // Nonclaimants receive no faces.
  }
});
