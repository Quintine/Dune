import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type GameView,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';

function fixture() {
  const g = createGame('RICHESEACQUIRE', newPlayer('r', 'Richese', 'richese'));
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('f', 'Fremen', 'fremen'),
  );
  g.status = 'playing';
  g.advanced = true;
  g.phase = 2;
  g.turn = 2;
  g.order = ['r', 'e', 'f'];
  g.active = null;
  g.deck = baseDeck();
  g.richeseCache = richeseCards();
  for (const p of g.players) {
    p.hand = [];
    p.spice = 12;
    p.forces = {};
    p.traitors = [];
  }
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  g.players[0].hand.push(g.deck.splice(index, 1)[0]);
  return g;
}
function projected(g: Game, difficulty: Difficulty, id = 'r') {
  const v = viewGame(g, id);
  v.players.find((p) => p.id === id)!.bot = difficulty;
  return v;
}
function acquisition(v: GameView) {
  return botActions(v).find(
    (action) =>
      action.type === 'card' &&
      action.mode === 'special' &&
      typeof action.acquire === 'string',
  );
}

void test('all four profiles acquire only usable canonical Karama and settle once in the authoritative engine', () => {
  for (const difficulty of DIFFICULTIES) {
    const original = fixture();
    const view = projected(original, difficulty);
    const before = structuredClone(view);
    const action = acquisition(view);
    assert.deepEqual(view, before, 'policy does not mutate its view');
    assert.ok(action, difficulty);
    assert.equal(action.acquire, 'richese-karama');
    assert.equal(action.card, original.players[0].hand[0].id);
    let g = applyAction(original, 'r', action);
    for (let step = 0; g.response && step < 8; step++) {
      const responder = g.players
        .map((p) => ({
          id: p.id,
          action: botActions(projected(g, difficulty, p.id))[0],
        }))
        .find((p) => p.action);
      assert.ok(responder, 'income has a legal continuation');
      g = applyAction(g, responder.id, responder.action);
    }
    assert.equal(g.response, null, 'income completes finitely');
    assert.equal(g.players[0].spice, 9);
    assert.equal(g.players[1].spice, 15);
    assert.equal(g.players[0].specialKaramaUsed, true);
    assert.deepEqual(
      g.players[0].hand.map((c) => c.id),
      ['richese-karama'],
    );
    assert.equal(g.richeseCache!.length, 9);
    assert.equal(g.discard.filter((c) => c.id === action.card).length, 1);
    assert.equal(
      acquisition(projected(JSON.parse(JSON.stringify(g)), difficulty)),
      undefined,
    );
    assert.equal(original.players[0].spice, 12);
  }
});

void test('all profiles decline unavailable, used, basic, full-hand and low-budget purchases', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const change of [
      (g: Game) => {
        g.advanced = false;
      },
      (g: Game) => {
        g.players[0].specialKaramaUsed = true;
      },
      (g: Game) => {
        g.players[0].spice = 3;
      },
      (g: Game) => {
        g.players[0].hand.push(...g.deck.splice(0, 3));
      },
      (g: Game) => {
        g.players[0].hand = [];
      },
      (g: Game) => {
        g.richeseCache = g.richeseCache!.filter((c) => c.effect !== 'karama');
      },
    ]) {
      const g = fixture();
      change(g);
      assert.equal(
        acquisition(projected(g, difficulty)),
        undefined,
        difficulty,
      );
    }
    const v = projected(fixture(), difficulty);
    v.richeseSpecialKarama!.blocked = 'Resolve the pending operation first.';
    assert.equal(acquisition(v), undefined);
  }
});

void test('all profiles use only projected choices and reject a similarly named unsupported face', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    assert.equal(viewGame(g, 'e').richeseSpecialKarama, null);
    const v = projected(g, difficulty);
    const expected = acquisition(v);
    v.players.find((p) => p.id === 'e')!.spice = 1000;
    v.players.find((p) => p.id === 'f')!.hand = baseDeck();
    assert.deepEqual(
      acquisition(v),
      expected,
      'rival secret data does not inform selection',
    );
    v.richeseSpecialKarama!.cards = [
      { ...richeseCards().find((c) => c.effect === 'karama')!, id: 'impostor' },
    ];
    assert.equal(acquisition(v), undefined);
  }
});

void test('response, decision and Truthtrance controls retain priority over optional acquisition', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[2].hand.push(
      g.deck.splice(
        g.deck.findIndex((c) => c.effect === 'karama'),
        1,
      )[0],
    );
    const action = acquisition(projected(g, difficulty))!;
    const purchased = applyAction(g, 'r', action);
    assert.equal(purchased.response?.kind, 'richesePurchaseIncome');
    assert.equal(acquisition(projected(purchased, difficulty)), undefined);
    const blocker = projected(purchased, difficulty, 'f');
    assert.ok(
      botActions(blocker).some(
        (a) => a.type === 'passResponse' || a.mode === 'cancel',
      ),
    );
    const v = projected(fixture(), difficulty);
    v.decision = { kind: 'richeseDeclaration', player: 'r' };
    v.richeseBidding = {
      owner: 'r',
      event: 'special-test-declaration',
      stage: 'declaration',
      position: null,
      cache: [],
      normalCount: null,
      offerBlocked: null,
    };
    assert.equal(botActions(v)[0].type, 'decision');
    assert.equal(acquisition(v), undefined);
    v.decision = null;
    v.truthtrance = {
      stage: 'priority',
      passed: [],
      queue: [],
    } as unknown as NonNullable<GameView['truthtrance']>;
    assert.equal(botActions(v)[0].type, 'truthPass');
  }
});
