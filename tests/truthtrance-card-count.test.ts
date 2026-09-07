import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck } from '../game/cards';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { type TruthFact } from '../game/truthtrance';
import {
  parseCardCountFact,
  cardCountFactMatches,
  cardCountFactText,
  type CardCountFact,
} from '../game/truthtrance-card-count';

const names = [...new Set(baseDeck().map((card) => card.name))];

void test('named-card counts distinguish multiple physical copies and compare zero through large thresholds', () => {
  const shields = baseDeck().filter((card) => card.name === 'Shield');
  assert.equal(shields.length, 4);
  assert.equal(new Set(shields.map((card) => card.id)).size, 4);
  for (let held = 0; held <= shields.length; held++) {
    const hand = shields.slice(0, held);
    for (const value of [0, 1, 2, 3, 4, 5, 41, Number.MAX_SAFE_INTEGER])
      for (const compare of ['eq', 'gte', 'lte'] as const) {
        const fact = parseCardCountFact(
          { kind: 'handCount', name: 'Shield', compare, value },
          names,
        );
        assert.equal(
          cardCountFactMatches(hand, fact),
          compare === 'eq'
            ? held === value
            : compare === 'gte'
              ? held >= value
              : held <= value,
        );
      }
  }
});

void test('exact named custody excludes similarly named defenses and remains a current fact after a legal custody change', () => {
  const hand = [
    { id: 's1', name: 'Shield' },
    { id: 's2', name: 'Shield' },
    { id: 'ss', name: 'Shield Snooper' },
    { id: 'p', name: 'Portable Snooper' },
  ];
  const before = structuredClone(hand);
  const fact = parseCardCountFact(
    { kind: 'handCount', name: 'Shield', compare: 'gte', value: 2 },
    names,
  );
  assert.equal(cardCountFactMatches(hand, fact), true);
  assert.deepEqual(hand, before);
  assert.equal(cardCountFactMatches(hand.slice(1), fact), false);
  assert.equal(
    cardCountFactMatches([...hand, { id: 'unknown', name: 'shield' }], {
      ...fact,
      compare: 'eq',
    }),
    true,
  );
  assert.deepEqual(fact, {
    kind: 'handCount',
    name: 'Shield',
    compare: 'gte',
    value: 2,
  });
});

void test('parser normalizes facts and rejects malformed names, comparisons and nonintegral counts without mutation', () => {
  const valid = {
    kind: 'handCount',
    name: 'Shield',
    compare: 'eq',
    value: 2,
    secret: 'ignored',
  };
  const before = structuredClone(valid);
  assert.deepEqual(parseCardCountFact(valid, names), {
    kind: 'handCount',
    name: 'Shield',
    compare: 'eq',
    value: 2,
  });
  assert.deepEqual(valid, before);
  for (const value of [
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '2',
    null,
    undefined,
  ])
    assert.throws(
      () => parseCardCountFact({ ...valid, value }, names),
      /whole card count/,
    );
  for (const compare of ['gt', 'lt', '=', 1, null, undefined])
    assert.throws(
      () => parseCardCountFact({ ...valid, compare }, names),
      /Compare held cards/,
    );
  for (const name of ['shield', 'Not a card', '', 1, null, undefined])
    assert.throws(
      () => parseCardCountFact({ ...valid, name }, names),
      /known treachery/,
    );
  assert.throws(
    () => parseCardCountFact({ ...valid, kind: 'hand' }, names),
    /known treachery/,
  );
});

void test('question text states the selected current comparison and never adds hidden inventory', () => {
  assert.equal(
    cardCountFactText({
      kind: 'handCount',
      name: 'Shield',
      compare: 'gte',
      value: 2,
    }),
    'you currently hold at least 2 cards named Shield',
  );
  assert.equal(
    cardCountFactText({
      kind: 'handCount',
      name: 'Shield',
      compare: 'eq',
      value: 1,
    }),
    'you currently hold exactly 1 card named Shield',
  );
  assert.equal(
    cardCountFactText({
      kind: 'handCount',
      name: 'Shield',
      compare: 'lte',
      value: 0,
    }),
    'you currently hold at most 0 cards named Shield',
  );
});

function hold(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((c) => c.name === name);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card.id;
}
function fixture(shields = 2) {
  const g = createGame('COUNTTRUTH', newPlayer('a', 'Asker', 'atreides'));
  g.players.push(
    newPlayer('e', 'Target', 'emperor'),
    newPlayer('h', 'Observer', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 2,
    phase: 4,
    order: ['h', 'e', 'a'],
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.spice = 20;
    p.traitors = [p.leaders[0].id];
  }
  const selected = new Set(g.players.flatMap((p) => p.traitors));
  g.traitorReserve = g.players
    .flatMap((p) => p.leaders.map((l) => l.id))
    .filter((id) => !selected.has(id));
  hold(g, 'a', 'Truthtrance');
  hold(g, 'h', 'Truthtrance');
  hold(g, 'h', 'Snooper');
  for (let i = 0; i < shields; i++) hold(g, 'e', 'Shield');
  return g;
}
function priority(g: Game) {
  g = applyAction(g, 'a', { type: 'card', card: g.players[0].hand[0].id });
  for (let n = 0; n < 10 && g.truthtrance?.stage === 'priority'; n++)
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  assert.equal(g.truthtrance?.stage, 'ask');
  return g;
}
function ask(g: Game, fact: TruthFact) {
  return applyAction(g, 'a', {
    type: 'truthAsk',
    question: { kind: 'fact', target: 'e', fact },
  });
}
const countFact = (
  compare: CardCountFact['compare'],
  value: number,
): CardCountFact => ({ kind: 'handCount', name: 'Shield', compare, value });
const cardIds = (g: Game) =>
  [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();

void test('real Truthtrance count questions enforce truthful answers and discard exactly once across comparator boundaries', () => {
  for (let held = 0; held <= 4; held++)
    for (const value of [0, 1, 2, 4, 41])
      for (const compare of ['eq', 'gte', 'lte'] as const) {
        const initial = fixture(held);
        const originalCards = cardIds(initial);
        const fact = countFact(compare, value);
        const expected = cardCountFactMatches(initial.players[1].hand, fact)
          ? 'yes'
          : 'no';
        const g = ask(priority(initial), fact);
        assert.equal(viewGame(g, 'e').truthAnswer, expected);
        assert.equal(viewGame(g, 'a').truthAnswer, null);
        assert.equal(viewGame(g, 'h').truthAnswer, null);
        const before = structuredClone(g);
        for (const answer of [expected === 'yes' ? 'no' : 'yes', 'unknown'])
          assert.throws(() =>
            applyAction(g, 'e', { type: 'truthAnswer', answer }),
          );
        assert.throws(() =>
          applyAction(g, 'h', { type: 'truthAnswer', answer: expected }),
        );
        assert.deepEqual(g, before);
        const done = applyAction(JSON.parse(JSON.stringify(g)), 'e', {
          type: 'truthAnswer',
          answer: expected,
        });
        assert.equal(done.truthtrance, null);
        assert.equal(done.truthHistory!.at(-1)!.answer, expected);
        assert.deepEqual(done.truthHistory!.at(-1)!.question, {
          kind: 'fact',
          target: 'e',
          fact,
        });
        assert.deepEqual(cardIds(done), originalCards);
        assert.deepEqual(done.players[1].hand, initial.players[1].hand);
        assert.equal(
          done.discard.filter((c) => c.id === initial.players[0].hand[0].id)
            .length,
          1,
        );
        assert.throws(() =>
          applyAction(done, 'e', { type: 'truthAnswer', answer: expected }),
        );
      }
});

void test('engine rejects malformed count clauses atomically even when another OR clause already determines the answer', () => {
  const g = priority(fixture());
  const invalid = [
    { ...countFact('gte', 2), value: -1 },
    { ...countFact('gte', 2), value: 1.5 },
    { ...countFact('gte', 2), value: '2' },
    { ...countFact('gte', 2), compare: 'gt' },
    { ...countFact('gte', 2), name: 'not a card' },
  ];
  for (const leaf of invalid) {
    const before = structuredClone(g);
    assert.throws(() =>
      applyAction(g, 'a', {
        type: 'truthAsk',
        question: {
          kind: 'fact',
          target: 'e',
          fact: { kind: 'or', terms: [{ kind: 'hand', name: 'Shield' }, leaf] },
        },
      }),
    );
    assert.deepEqual(g, before);
  }
});

void test('composed current counts disclose only the aggregate answer and preserve unknown traitor semantics', () => {
  const initial = fixture();
  initial.players[1].traitorChoices = ['atreides-1'];
  initial.traitorReserve = initial.traitorReserve!.filter(
    (id) => id !== 'atreides-1',
  );
  const scenarios: [TruthFact, 'yes' | 'no' | 'unknown'][] = [
    [
      {
        kind: 'and',
        terms: [
          countFact('gte', 2),
          { kind: 'spice', compare: 'eq', value: 20 },
        ],
      },
      'yes',
    ],
    [
      {
        kind: 'and',
        terms: [countFact('gte', 3), { kind: 'traitor', leader: 'atreides-1' }],
      },
      'no',
    ],
    [
      {
        kind: 'and',
        terms: [countFact('eq', 2), { kind: 'traitor', leader: 'atreides-1' }],
      },
      'unknown',
    ],
    [
      {
        kind: 'or',
        terms: [countFact('eq', 2), { kind: 'traitor', leader: 'atreides-1' }],
      },
      'yes',
    ],
  ];
  for (const [fact, expected] of scenarios) {
    const g = ask(priority(initial), fact);
    assert.equal(viewGame(g, 'e').truthAnswer, expected);
    for (const id of ['a', 'h']) {
      const view = viewGame(g, id);
      assert.equal(view.truthAnswer, null);
      assert.equal(view.players.find((p) => p.id === 'e')!.hand, undefined);
      assert.equal(
        view.players.find((p) => p.id === 'e')!.traitorChoices,
        undefined,
      );
    }
    const done = applyAction(g, 'e', { type: 'truthAnswer', answer: expected });
    assert.equal(done.truthHistory!.at(-1)!.answer, expected);
  }
});

void test('all four AI profiles answer current card counts from target-only projections with foreign-hand noninterference', () => {
  for (const difficulty of DIFFICULTIES)
    for (const fact of [
      countFact('eq', 2),
      countFact('gte', 3),
      countFact('lte', 0),
      countFact('gte', 0),
    ]) {
      const initial = fixture();
      initial.players[1].bot = difficulty;
      const g = ask(priority(initial), fact);
      const view = viewGame(g, 'e');
      const snapshot = structuredClone(view);
      const expected = cardCountFactMatches(g.players[1].hand, fact)
        ? 'yes'
        : 'no';
      const actions = botActions(view);
      assert.deepEqual(view, snapshot);
      assert.deepEqual(actions, [{ type: 'truthAnswer', answer: expected }]);
      assert.deepEqual(botActions(viewGame(g, 'h')), []);
      const altered = structuredClone(g);
      const observer = altered.players[2];
      const snooperIndex = observer.hand.findIndex((c) => c.name === 'Snooper');
      altered.deck.push(observer.hand.splice(snooperIndex, 1)[0]);
      hold(altered, 'h', 'Gom Jabbar');
      altered.players[0].spice = 999;
      assert.deepEqual(viewGame(altered, 'e'), view);
      assert.deepEqual(botActions(viewGame(altered, 'e')), actions);
      for (const input of [g, altered]) {
        const done = applyAction(input, 'e', actions[0]);
        assert.equal(done.truthHistory!.at(-1)!.answer, expected);
        assert.equal(done.truthtrance, null);
      }
    }
});
