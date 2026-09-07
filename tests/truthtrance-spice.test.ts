import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  truthFactAnswer,
  truthQuestionText,
  type TruthFact,
  type TruthQuestion,
} from '../game/truthtrance';

function fixture(spice = 7) {
  const g = createGame('SPICETRUTH', newPlayer('a', 'Asker', 'atreides'));
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
  g.players[1].spice = spice;
  const held = new Set(g.players.flatMap((p) => p.traitors));
  g.traitorReserve = g.players
    .flatMap((p) => p.leaders.map((l) => l.id))
    .filter((id) => !held.has(id));
  hold(g, 'a', 'Truthtrance');
  hold(g, 'h', 'Truthtrance');
  hold(g, 'e', 'Shield');
  hold(g, 'h', 'Snooper');
  return g;
}
function hold(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((c) => c.name === name);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card.id;
}
function cards(g: Game) {
  return [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
}
function declared(g: Game) {
  return applyAction(g, 'a', {
    type: 'card',
    card: g.players[0].hand.find((c) => c.effect === 'truthtrance')!.id,
  });
}
function priority(state: Game) {
  let g = state;
  while (g.truthtrance?.stage === 'priority') {
    const p = g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!;
    g = applyAction(g, p.id, { type: 'truthPass' });
  }
  assert.equal(g.truthtrance?.stage, 'ask');
  return g;
}
function ask(g: Game, fact: TruthFact) {
  return applyAction(g, 'a', {
    type: 'truthAsk',
    question: { kind: 'fact', target: 'e', fact },
  });
}
function pending(g: Game, fact: TruthFact) {
  return ask(priority(declared(g)), fact);
}
function answer(g: Game, value: 'yes' | 'no' | 'unknown', id = 'e') {
  return applyAction(g, id, { type: 'truthAnswer', answer: value });
}
function rejectUnchanged(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
const spiceFact = (
  compare: 'eq' | 'gte' | 'lte',
  value: number,
): TruthFact => ({ kind: 'spice', compare, value });

void test('spice fact comparisons include zero, values above forty and the largest safe threshold through real declaration and answer', () => {
  for (const amount of [0, 1, 40, 41, 137])
    for (const value of [0, 1, 40, 41, 137, 1000000, Number.MAX_SAFE_INTEGER])
      for (const compare of ['eq', 'gte', 'lte'] as const) {
        const initial = fixture(amount);
        const fact = spiceFact(compare, value);
        const matches =
          compare === 'eq'
            ? amount === value
            : compare === 'gte'
              ? amount >= value
              : amount <= value;
        const expected = matches ? 'yes' : 'no';
        assert.equal(truthFactAnswer(initial.players[1], fact), expected);
        const g = pending(initial, fact);
        assert.equal(viewGame(g, 'e').truthAnswer, expected);
        const done = answer(g, expected);
        assert.equal(done.truthtrance, null);
        assert.equal(done.truthHistory!.at(-1)!.answer, expected);
        assert.deepEqual(done.truthHistory!.at(-1)!.question, {
          kind: 'fact',
          target: 'e',
          fact,
        });
        assert.equal(done.players[1].spice, amount);
        assert.equal(
          done.discard.filter((c) => c.effect === 'truthtrance').length,
          1,
        );
        assert.deepEqual(cards(done), cards(initial));
      }
});

void test('malformed spice thresholds and operators reject atomically even inside a short-circuiting combination', () => {
  const g = priority(declared(fixture()));
  const invalid = [
    ...[
      -1,
      -0.5,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
      NaN,
      Infinity,
      -Infinity,
      '7',
      null,
      undefined,
      true,
      [],
      {},
    ].map((value) => ({ kind: 'spice', compare: 'eq', value })),
    ...['gt', 'lt', 'equal', '', null, undefined, 1, true, {}, []].map(
      (compare) => ({ kind: 'spice', compare, value: 7 }),
    ),
  ];
  for (const fact of invalid)
    for (const payload of [
      fact,
      { kind: 'or', terms: [spiceFact('gte', 0), fact] },
    ])
      rejectUnchanged(g, 'a', {
        type: 'truthAsk',
        question: { kind: 'fact', target: 'e', fact: payload },
      });
  assert.equal(g.truthtrance?.stage, 'ask');
  assert.equal(g.discard.length, 0);
  assert.equal(g.truthtrance?.question, null);
});

void test('only the target receives the verified spice answer and false, unknown or wrong-seat submissions cannot consume Truthtrance', () => {
  for (const fact of [spiceFact('eq', 7), spiceFact('gte', 8)]) {
    const g = pending(fixture(), fact);
    const actual = truthFactAnswer(g.players[1], fact);
    assert.notEqual(actual, 'unknown');
    for (const id of ['a', 'h']) {
      const view = viewGame(g, id);
      assert.equal(view.truthAnswer, null);
      assert.equal(view.players.find((p) => p.id === 'e')!.spice, undefined);
      assert.deepEqual(view.truthHistory, []);
      rejectUnchanged(g, id, { type: 'truthAnswer', answer: actual });
    }
    rejectUnchanged(g, 'e', {
      type: 'truthAnswer',
      answer: actual === 'yes' ? 'no' : 'yes',
    });
    rejectUnchanged(g, 'e', { type: 'truthAnswer', answer: 'unknown' });
    const done = answer(JSON.parse(JSON.stringify(g)) as Game, actual);
    for (const p of done.players) {
      const view = viewGame(done, p.id);
      assert.equal(view.truthHistory.at(-1)!.answer, actual);
      assert.deepEqual(Object.keys(view.truthHistory.at(-1)!).sort(), [
        'answer',
        'asker',
        'phase',
        'question',
        'turn',
      ]);
    }
  }
});

void test('spice facts use current personal custody, excluding both outgoing and incoming ally escrow and unpaid bribes', () => {
  let g = fixture(12);
  g.phase = 5;
  g.active = 'e';
  g.movementRemaining = [...g.order];
  g.players[1].ally = 'h';
  g.players[2].ally = 'e';
  g = applyAction(g, 'e', { type: 'pledgeAid', amount: 5 });
  g = applyAction(g, 'h', { type: 'pledgeAid', amount: 9 });
  g = applyAction(g, 'a', { type: 'bribe', target: 'e', amount: 4 });
  assert.equal(g.players[1].spice, 7);
  assert.equal(g.aid.e.amount, 5);
  assert.equal(g.aid.h.amount, 9);
  assert.equal(g.players[1].bribes, 4);
  for (const [value, expected] of [
    [7, 'yes'],
    [12, 'no'],
    [16, 'no'],
    [20, 'no'],
  ] as const) {
    const asked = pending(g, spiceFact('eq', value));
    assert.equal(viewGame(asked, 'e').truthAnswer, expected);
    const done = answer(asked, expected);
    assert.equal(done.players[1].spice, 7);
    assert.deepEqual(done.aid, g.aid);
    assert.equal(done.players[1].bribes, 4);
  }
});

void test('a restored question validates the current answer-state balance instead of retaining an earlier computed answer', () => {
  const asked = pending(fixture(7), spiceFact('gte', 8));
  assert.equal(viewGame(asked, 'e').truthAnswer, 'no');
  const restored = JSON.parse(JSON.stringify(asked)) as Game;
  // Test another authoritative answer-state snapshot, conserving the total spice.
  // This does not authorize a player to spend or transfer through the Truthtrance overlay.
  restored.players[0].spice--;
  restored.players[1].spice++;
  assert.equal(viewGame(restored, 'e').truthAnswer, 'yes');
  rejectUnchanged(restored, 'e', { type: 'truthAnswer', answer: 'no' });
  const done = answer(restored, 'yes');
  assert.equal(done.truthHistory!.at(-1)!.answer, 'yes');
  assert.equal(done.players[1].spice, 8);
  assert.equal(asked.players[1].spice, 7);
  assert.deepEqual(cards(done), cards(asked));
});

void test('nested AND/OR combines spice, cards and unresolved legacy traitors with three-valued answers', () => {
  const initial = fixture(7);
  // This historical setup shape already dealt treachery before traitor choice; new staged setup never does so.
  initial.status = 'setup';
  initial.phase = 0;
  initial.turn = 1;
  initial.players[1].traitors = [];
  initial.players[1].traitorChoices = ['emperor-0', 'emperor-1'];
  initial.traitorReserve = initial.traitorReserve!.filter(
    (id) => !initial.players[1].traitorChoices.includes(id),
  );
  const unknown: TruthFact = { kind: 'traitor', leader: 'emperor-0' };
  const scenarios: [TruthFact, 'yes' | 'no' | 'unknown'][] = [
    [{ kind: 'and', terms: [spiceFact('eq', 0), unknown] }, 'no'],
    [{ kind: 'and', terms: [spiceFact('eq', 7), unknown] }, 'unknown'],
    [{ kind: 'or', terms: [spiceFact('gte', 7), unknown] }, 'yes'],
    [{ kind: 'or', terms: [spiceFact('gte', 8), unknown] }, 'unknown'],
    [
      {
        kind: 'and',
        terms: [
          { kind: 'hand', name: 'Shield' },
          { kind: 'or', terms: [unknown, spiceFact('lte', 7)] },
        ],
      },
      'yes',
    ],
    [
      {
        kind: 'or',
        terms: [
          { kind: 'hand', name: 'Lasgun' },
          { kind: 'and', terms: [unknown, spiceFact('lte', 7)] },
        ],
      },
      'unknown',
    ],
  ];
  for (const [fact, expected] of scenarios) {
    const asked = pending(initial, fact);
    assert.equal(viewGame(asked, 'e').truthAnswer, expected);
    assert.equal(viewGame(asked, 'a').truthAnswer, null);
    assert.equal(viewGame(asked, 'h').truthAnswer, null);
    const done = answer(asked, expected);
    assert.equal(done.truthHistory!.at(-1)!.answer, expected);
    assert.deepEqual(
      done.players[1].traitorChoices,
      initial.players[1].traitorChoices,
    );
    assert.deepEqual(cards(done), cards(initial));
    assert.equal(done.status, 'setup');
    if (expected === 'unknown') {
      assert.equal(done.truthtrance?.stage, 'unknown');
      assert.equal(done.discard.length, 0);
      const saved = applyAction(done, 'a', { type: 'truthSave' });
      assert.equal(saved.truthtrance, null);
      assert.equal(saved.discard.length, 0);
    } else assert.equal(done.discard.length, 1);
  }
});

void test('public OR result does not reveal which private spice or hand term matched', () => {
  const a = fixture(4);
  const b = structuredClone(a);
  b.players[1].spice = 12;
  b.deck.push(...b.players[1].hand.splice(0));
  hold(b, 'e', 'Snooper');
  const fact: TruthFact = {
    kind: 'or',
    terms: [spiceFact('gte', 10), { kind: 'hand', name: 'Shield' }],
  };
  const first = pending(a, fact),
    second = pending(b, fact);
  assert.equal(viewGame(first, 'e').truthAnswer, 'yes');
  assert.equal(viewGame(second, 'e').truthAnswer, 'yes');
  for (const observer of ['a', 'h']) {
    assert.deepEqual(viewGame(first, observer), viewGame(second, observer));
    assert.deepEqual(
      viewGame(answer(first, 'yes'), observer),
      viewGame(answer(second, 'yes'), observer),
    );
  }
});

void test('all four AI profiles answer legal spice facts from their own view without reacting to other hidden balances, cards or traitors', () => {
  for (const level of DIFFICULTIES)
    for (const fact of [
      spiceFact('eq', 7),
      spiceFact('lte', 6),
      spiceFact('gte', 0),
      spiceFact('eq', Number.MAX_SAFE_INTEGER),
    ]) {
      const initial = fixture();
      initial.players[1].bot = level;
      let g = declared(initial);
      // Eligible bots make their normal priority passes; the human holders keep their own choice.
      const targetPass = botActions(viewGame(g, 'e'));
      assert.deepEqual(targetPass, [{ type: 'truthPass' }]);
      g = applyAction(g, 'e', targetPass[0]);
      g = ask(priority(g), fact);
      const actual = truthFactAnswer(g.players[1], fact);
      const view = viewGame(g, 'e');
      const before = structuredClone(view);
      const actions = botActions(view);
      assert.deepEqual(view, before);
      assert.deepEqual(actions, [{ type: 'truthAnswer', answer: actual }]);
      for (const action of actions)
        assert.doesNotThrow(() => applyAction(g, 'e', action));
      assert.deepEqual(botActions(viewGame(g, 'h')), []);
      const changed = structuredClone(g);
      changed.players[0].spice = 999;
      changed.players[2].spice = 1;
      changed.players[0].traitors = ['atreides-1'];
      changed.traitorReserve = [
        ...changed.traitorReserve!.filter((id) => id !== 'atreides-1'),
        'atreides-0',
      ];
      const observer = changed.players[2];
      const snooper = observer.hand.findIndex((c) => c.name === 'Snooper');
      changed.deck.push(observer.hand.splice(snooper, 1)[0]);
      hold(changed, 'h', 'Maula Pistol');
      assert.deepEqual(viewGame(changed, 'e'), view);
      assert.deepEqual(botActions(viewGame(changed, 'e')), actions);
      const done = applyAction(changed, 'e', actions[0]);
      assert.equal(done.truthtrance, null);
      assert.equal(done.truthHistory!.at(-1)!.answer, actual);
    }
});

void test('a current-spice answer records a fact rather than forbidding a subsequent legal paid revival', () => {
  const initial = fixture(7);
  initial.players[1].tanks = 2;
  initial.players[1].reserves = 18;
  const asked = pending(initial, spiceFact('eq', 7));
  const done = answer(asked, 'yes');
  assert.equal(done.players[1].spice, 7);
  const paid = applyAction(done, 'e', { type: 'revive', amount: 2 });
  assert.equal(paid.players[1].spice, 5);
  assert.equal(paid.players[1].tanks, 0);
  assert.equal(paid.players[1].reserves, 20);
  assert.equal(paid.truthHistory!.at(-1)!.answer, 'yes');
  assert.deepEqual(paid.truthHistory!.at(-1)!.question, {
    kind: 'fact',
    target: 'e',
    fact: spiceFact('eq', 7),
  });
  assert.deepEqual(
    paid.battle?.truthPromises ?? [],
    done.battle?.truthPromises ?? [],
  );
  const q: TruthQuestion = {
    kind: 'fact',
    target: 'e',
    fact: spiceFact('gte', 41),
  };
  assert.match(
    truthQuestionText(q, () => 'unused'),
    /currently hold at least 41 spice/,
  );
  assert.deepEqual(cards(paid), cards(initial));
});
