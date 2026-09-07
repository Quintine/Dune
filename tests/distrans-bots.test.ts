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
import type { FactionId } from '../game/catalog';

function fixture(ally: FactionId = 'choam', donor: FactionId = 'atreides') {
  const g = createGame('DISTRANSBOT', newPlayer('d', 'Donor', donor));
  g.players.push(
    newPlayer('a', 'Ally', ally),
    newPlayer('o', 'Other', 'fremen'),
  );
  g.status = 'playing';
  g.advanced = true;
  g.phase = 2;
  g.turn = 2;
  g.order = ['d', 'a', 'o'];
  g.players[0].ally = 'a';
  g.players[1].ally = 'd';
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
  }
  const deck = baseDeck();
  const worthless = deck.find((c) => c.kind === 'worthless')!;
  const weapons = deck.filter((c) => c.kind === 'projectile').slice(0, 2);
  const distrans = richeseCards().find((c) => c.effect === 'distrans')!;
  g.players[0].hand = [distrans, worthless, ...weapons];
  g.deck = deck.filter(
    (c) => !g.players[0].hand.some((held) => held.id === c.id),
  );
  return g;
}
function projected(g: Game, difficulty: Difficulty) {
  const v = viewGame(g, 'd');
  v.players[0].bot = difficulty;
  return v;
}
const command = (v: GameView) =>
  botActions(v).find((a) => a.type === 'card' && a.card === 'richese-distrans');

void test('all four profiles give a worthless card to BG or CHOAM ally with a single synchronous transfer and discard', () => {
  for (const difficulty of DIFFICULTIES)
    for (const ally of ['beneGesserit', 'choam'] as const) {
      const g = fixture(ally);
      const v = projected(g, difficulty),
        before = structuredClone(v);
      const action = command(v);
      assert.deepEqual(v, before);
      assert.ok(action, `${difficulty} -> ${ally}`);
      assert.equal(action.target, 'a');
      assert.equal(action.give, g.players[0].hand[1].id);
      const next = applyAction(g, 'd', action);
      assert.equal(next.players[0].hand.length, 2);
      assert.deepEqual(
        next.players[1].hand.map((c) => c.id),
        [action.give],
      );
      assert.deepEqual(
        next.discard.map((c) => c.id),
        ['richese-distrans'],
      );
      assert.equal(next.response, null);
      assert.equal(next.decision, null);
      assert.deepEqual(
        next.players.map((p) => p.spice),
        g.players.map((p) => p.spice),
      );
      assert.deepEqual(next.deck, g.deck);
      assert.equal(
        command(
          projected(JSON.parse(JSON.stringify(next)) as Game, difficulty),
        ),
        undefined,
      );
      assert.throws(() => applyAction(next, 'd', action));
    }
});

void test('a full donor can share a duplicate ordinary weapon, defense or usable Karama while retaining one', () => {
  for (const difficulty of DIFFICULTIES)
    for (const kind of [
      'projectile',
      'poison',
      'shield',
      'snooper',
      'karama',
    ]) {
      const g = fixture('emperor');
      const duplicates = baseDeck()
        .filter((c) =>
          kind === 'karama' ? c.effect === 'karama' : c.kind === kind,
        )
        .slice(0, 2);
      assert.equal(duplicates.length, 2);
      const filler = baseDeck().find((c) => c.kind === 'worthless')!;
      g.players[0].hand = [g.players[0].hand[0], ...duplicates, filler];
      g.deck = baseDeck().filter(
        (c) => !g.players[0].hand.some((held) => held.id === c.id),
      );
      const action = command(projected(g, difficulty));
      assert.ok(action, `${difficulty} ${kind}`);
      assert.equal(action.give, duplicates[0].id);
      const next = applyAction(g, 'd', action);
      assert.ok(next.players[0].hand.some((c) => c.id === duplicates[1].id));
      assert.equal(next.players[1].hand[0].id, duplicates[0].id);
    }
});

void test('policy does not infer recipient contents and never targets an opponent or unavailable projected choice', () => {
  for (const difficulty of DIFFICULTIES) {
    const v = projected(fixture(), difficulty);
    assert.equal(v.players[1].hand, undefined);
    assert.equal(v.players[1].handCount, undefined);
    const action = command(v);
    v.players[1].hand = richeseCards();
    v.players[1].spice = 999;
    assert.deepEqual(command(v), action);
    for (const change of [
      (view: GameView) => {
        view.distrans!.blocked = 'During a bid.';
      },
      (view: GameView) => {
        view.distrans!.choices.find((c) => c.recipient === 'a')!.blocked =
          'Full.';
      },
      (view: GameView) => {
        view.distrans!.choices.find((c) => c.recipient === 'a')!.cards = [];
      },
      (view: GameView) => {
        view.players[0].ally = null;
      },
      (view: GameView) => {
        view.distrans = null;
      },
    ]) {
      const blocked = projected(fixture(), difficulty);
      change(blocked);
      assert.equal(command(blocked), undefined);
    }
  }
});

void test('donors retain their own valuable worthless power and do not spend Distrans for a sole ordinary card or unsupported effect', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const donor of ['beneGesserit', 'choam'] as const) {
      const g = fixture(donor === 'choam' ? 'beneGesserit' : 'choam', donor);
      g.players[0].hand = g.players[0].hand.slice(0, 2);
      assert.equal(command(projected(g, difficulty)), undefined);
    }
    const g = fixture('emperor');
    g.players[0].hand.pop();
    assert.equal(command(projected(g, difficulty)), undefined);
    g.players[0].hand = [
      g.players[0].hand[0],
      ...richeseCards()
        .filter((c) => c.effect !== 'distrans' && c.effect !== 'karama')
        .slice(0, 3),
    ];
    assert.equal(command(projected(g, difficulty)), undefined);
  }
});

void test('Truthtrance, response and decision priority precede optional Distrans for every profile', () => {
  for (const difficulty of DIFFICULTIES) {
    const truth = projected(fixture(), difficulty);
    truth.truthtrance = {
      stage: 'priority',
      queue: [],
      passed: [],
    } as unknown as NonNullable<GameView['truthtrance']>;
    assert.equal(botActions(truth)[0].type, 'truthPass');
    const decision = projected(fixture(), difficulty);
    decision.decision = { kind: 'richeseDeclaration', player: 'a' };
    assert.deepEqual(botActions(decision), []);
    const response = projected(fixture(), difficulty);
    response.response = { kind: 'emperorIncome', owner: 'o', passed: [] };
    assert.equal(command(response), undefined);
  }
});
