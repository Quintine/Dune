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
  const g = createGame('RICHESEGIFTBOT', newPlayer('r', 'Richese', 'richese'));
  g.players.push(
    newPlayer('a', 'Ally', 'atreides'),
    newPlayer('o', 'Observer', 'emperor'),
  );
  g.status = 'playing';
  g.advanced = true;
  g.phase = 3;
  g.turn = 2;
  g.active = 'a';
  g.order = ['a', 'r', 'o'];
  g.players[0].ally = 'a';
  g.players[1].ally = 'r';
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
  }
  g.deck = baseDeck();
  g.richeseCache = richeseCards();
  const karama = g.richeseCache.find((c) => c.effect === 'karama')!;
  g.richeseCache = g.richeseCache.filter((c) => c.id !== karama.id);
  const filler = g.deck.filter((c) => c.kind === 'worthless').slice(0, 3);
  g.deck = g.deck.filter((c) => !filler.includes(c));
  g.players[0].hand = [karama, ...filler];
  g.auction = {
    cards: [g.deck.shift()!],
    index: 0,
    bid: 0,
    bidder: null,
    active: 'a',
    passed: [],
    opener: 0,
  };
  return g;
}
function projected(g: Game, difficulty: Difficulty) {
  const view = viewGame(g, 'r');
  view.players.find((p) => p.id === 'r')!.bot = difficulty;
  return view;
}
const giftAction = (view: GameView) =>
  botActions(view).find((a) => a.type === 'richeseGift');
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

void test('all profiles free a full bidding hand by gifting canonical Karama to an ally with fewer cards, exactly once', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    const view = projected(g, difficulty);
    const before = structuredClone(view);
    const action = giftAction(view);
    assert.deepEqual(view, before);
    assert.ok(action, difficulty);
    assert.equal(action.card, 'richese-karama');
    const next = applyAction(g, 'r', action);
    assert.equal(next.response, null);
    assert.equal(next.players[0].hand.length, 3);
    assert.deepEqual(
      next.players[1].hand.map((c) => c.id),
      ['richese-karama'],
    );
    assert.equal(
      next.discard.some((c) => c.id === action.card),
      false,
    );
    assert.equal(next.players[0].spice, 10);
    assert.equal(next.players[1].spice, 10);
    assert.deepEqual(next.auction, g.auction);
    assert.equal(giftAction(projected(reload(next), difficulty)), undefined);
    assert.throws(() => applyAction(next, 'r', action));
  }
});

void test('all profiles retain their card without public hand-space evidence or when the gift is unavailable', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const change of [
      (v: GameView) => {
        v.richeseGift!.blocked = 'Gift canceled this turn.';
      },
      (v: GameView) => {
        v.richeseGift!.cards = [];
      },
      (v: GameView) => {
        v.players[0].hand!.pop();
      },
      (v: GameView) => {
        v.players[1].handCount = undefined;
      },
      (v: GameView) => {
        v.players[1].handCount = v.players[1].handLimit;
      },
      (v: GameView) => {
        v.players[0].ally = null;
      },
      (v: GameView) => {
        v.richeseGift = null;
      },
      (v: GameView) => {
        v.phase = 2;
      },
    ]) {
      const v = projected(fixture(), difficulty);
      change(v);
      assert.equal(giftAction(v), undefined);
    }
  }
});

void test('gift policy uses strict eligible identities and never inspects an ally hand', () => {
  for (const difficulty of DIFFICULTIES) {
    const v = projected(fixture(), difficulty);
    assert.equal(v.players[1].hand, undefined);
    const action = giftAction(v);
    v.players[1].hand = baseDeck().slice(0, 4);
    assert.deepEqual(
      giftAction(v),
      action,
      'unentitled injected contents cannot change the policy',
    );
    v.richeseGift!.cards = richeseCards().filter((c) => c.effect !== 'karama');
    assert.equal(giftAction(v), undefined);
    v.richeseGift!.cards = [
      {
        ...richeseCards().find((c) => c.effect === 'karama')!,
        name: 'Wrong identity',
      },
    ];
    assert.equal(giftAction(v), undefined);
  }
});

void test('gift cancellation retains custody without an automatic retry, and Truthtrance and decisions take priority', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    const k = g.deck.find((c) => c.effect === 'karama')!;
    g.deck = g.deck.filter((c) => c.id !== k.id);
    g.players[2].hand.push(k);
    const pending = applyAction(g, 'r', giftAction(projected(g, difficulty))!);
    assert.equal(pending.response?.kind, 'richeseGift');
    assert.equal(giftAction(projected(pending, difficulty)), undefined);
    const canceled = applyAction(reload(pending), 'o', {
      type: 'card',
      card: k.id,
      mode: 'cancel',
    });
    assert.equal(
      canceled.players[0].hand.some((c) => c.id === 'richese-karama'),
      true,
    );
    assert.equal(canceled.players[1].hand.length, 0);
    assert.equal(giftAction(projected(canceled, difficulty)), undefined);
    const truth = projected(g, difficulty);
    truth.truthtrance = {
      stage: 'priority',
      queue: [],
      passed: [],
    } as unknown as NonNullable<GameView['truthtrance']>;
    assert.equal(botActions(truth)[0].type, 'truthPass');
    const decision = projected(g, difficulty);
    decision.decision = { kind: 'richeseDeclaration', player: 'a' };
    assert.deepEqual(botActions(decision), []);
  }
});
