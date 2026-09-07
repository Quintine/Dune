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
  const g = createGame('BOXBOT', newPlayer('d', 'Donor', 'atreides'));
  g.players.push(newPlayer('a', 'Other', 'emperor'));
  g.status = 'playing';
  g.advanced = true;
  g.phase = 2;
  g.turn = 2;
  g.order = ['d', 'a'];
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
  }
  g.players[0].hand = [
    richeseCards().find((c) => c.effect === 'nullentropyBox')!,
  ];
  const deck = baseDeck();
  const weapon = deck.find((c) => c.kind === 'projectile')!;
  const karama = deck.find((c) => c.effect === 'karama')!;
  const unsupported = richeseCards().find((c) => c.effect === 'stoneBurner')!;
  g.discard = [unsupported, weapon, karama];
  g.deck = deck.filter(
    (c) => !g.discard.some((discarded) => discarded.id === c.id),
  );
  return g;
}
function projected(g: Game, difficulty: Difficulty) {
  const v = viewGame(g, 'd');
  v.players[0].bot = difficulty;
  return v;
}
const beginAction = (v: GameView) =>
  botActions(v).find(
    (a) => a.type === 'card' && a.card === 'richese-nullentropy-box',
  );
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

void test('all profiles pay once, resolve their private search using functional cards, and cannot replay after consumption', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(),
      before = projected(g, difficulty);
    assert.equal(before.nullentropy!.search, null);
    const start = beginAction(before);
    assert.ok(start, difficulty);
    assert.deepEqual(start, { type: 'card', card: 'richese-nullentropy-box' });
    const paid = applyAction(g, 'd', start);
    assert.equal(paid.players[0].spice, 8);
    assert.equal(paid.decision?.kind, 'nullentropy');
    assert.equal(viewGame(paid, 'a').nullentropy, null);
    const v = projected(reload(paid), difficulty),
      snapshot = structuredClone(v);
    const choice = botActions(v)[0];
    assert.deepEqual(v, snapshot);
    assert.equal(choice.type, 'decision');
    assert.equal(choice.event, v.nullentropy!.search!.event);
    assert.ok(v.nullentropy!.search!.cards.some((c) => c.id === choice.card));
    assert.notEqual(choice.card, 'richese-stone-burner');
    const finished = applyAction(paid, 'd', choice);
    assert.equal(finished.players[0].spice, 8);
    assert.deepEqual(
      finished.players[0].hand.map((c) => c.id),
      [choice.card],
    );
    assert.equal(finished.discard.at(-1)!.id, start.card);
    assert.equal(finished.discard.filter((c) => c.id === start.card).length, 1);
    assert.equal(finished.decision, null);
    assert.equal(
      beginAction(projected(reload(finished), difficulty)),
      undefined,
    );
    assert.throws(() => applyAction(finished, 'd', choice));
    assert.throws(() => applyAction(finished, 'd', start));
  }
});

void test('optional beginning uses only owner budget and availability, with no prepayment discard lookahead', () => {
  for (const [level, difficulty] of DIFFICULTIES.entries()) {
    const g = fixture(),
      v = projected(g, difficulty);
    const ordinary = beginAction(v);
    const changed = fixture();
    changed.discard = baseDeck()
      .filter((c) => c.kind === 'worthless')
      .slice(0, 2);
    assert.deepEqual(beginAction(projected(changed, difficulty)), ordinary);
    assert.equal(v.nullentropy!.search, null);
    assert.ok(!JSON.stringify(v.nullentropy).includes('Stone Burner'));
    v.players[0].spice = [5, 6, 7, 8][level] - 1;
    assert.equal(beginAction(v), undefined);
    v.players[0].spice++;
    assert.deepEqual(beginAction(v), ordinary);
    v.nullentropy!.blocked = 'Keep a pre-existing free hand slot.';
    assert.equal(beginAction(v), undefined);
    v.nullentropy = null;
    assert.equal(beginAction(v), undefined);
  }
});

void test('paid searches finish before unrelated optional actions and only their owner can choose', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    const paid = applyAction(g, 'd', beginAction(projected(g, difficulty))!);
    const v = projected(paid, difficulty);
    v.players[0].spice = 0;
    const choice = botActions(v)[0];
    assert.equal(choice.type, 'decision');
    assert.equal(choice.event, v.nullentropy!.search!.event);
    const other = viewGame(paid, 'a');
    other.players[1].bot = difficulty;
    assert.deepEqual(botActions(other), []);
    const missing = projected(paid, difficulty);
    missing.nullentropy!.search = null;
    assert.deepEqual(botActions(missing), []);
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
    const response = projected(g, difficulty);
    response.response = { kind: 'emperorIncome', owner: 'a', passed: [] };
    assert.equal(beginAction(response), undefined);
  }
});

void test('a sole eligible card settles automatically, with no inspection acknowledgement for the AI', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.discard = [g.discard[1]];
    const selected = g.discard[0].id;
    const finished = applyAction(
      g,
      'd',
      beginAction(projected(g, difficulty))!,
    );
    assert.equal(finished.decision, null);
    assert.equal(finished.players[0].spice, 8);
    assert.deepEqual(
      finished.players[0].hand.map((c) => c.id),
      [selected],
    );
    assert.equal(finished.discard.at(-1)!.id, 'richese-nullentropy-box');
    assert.equal(projected(finished, difficulty).nullentropy, null);
  }
});

void test('even a paid pile containing only unfinished non-Box faces has a finite legal selection', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.discard = richeseCards().filter((c) =>
      ['stoneBurner', 'semutaDrug'].includes(c.effect),
    );
    const paid = applyAction(g, 'd', beginAction(projected(g, difficulty))!);
    const choice = botActions(projected(paid, difficulty))[0];
    assert.ok(g.discard.some((c) => c.id === choice.card));
    const finished = applyAction(paid, 'd', choice);
    assert.equal(finished.decision, null);
    assert.equal(finished.players[0].hand[0].id, choice.card);
  }
});
