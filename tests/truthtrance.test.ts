import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  RuleError,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  truthFactAnswer,
  type TruthFact,
  type TruthQuestion,
} from '../game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';

function fixture() {
  const g = createGame('TRUTH22', newPlayer('a', 'Atreides', 'atreides'));
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
  );
  g.status = 'playing';
  g.phase = 4;
  g.turn = 2;
  g.order = ['e', 'h', 'a'];
  g.deck = baseDeck();
  g.players.forEach((p) => {
    p.hand = [];
    p.traitorChoices = [];
    p.traitors = [p.leaders[0].id];
  });
  hold(g, 'a', 'Truthtrance');
  hold(g, 'h', 'Truthtrance');
  hold(g, 'e', 'Shield');
  return g;
}
function hold(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((c) => c.name === name);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(card);
  return card.id;
}
function declare(g: Game, id = 'a') {
  return applyAction(g, id, {
    type: 'card',
    card: g.players
      .find((p) => p.id === id)!
      .hand.find((c) => c.effect === 'truthtrance')!.id,
  });
}
function priority(state: Game) {
  let g = state;
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  return g;
}
const fact: TruthQuestion = {
  kind: 'fact',
  target: 'e',
  fact: { kind: 'hand', name: 'Shield' },
};
const ask = (g: Game, question: TruthQuestion = fact, id = 'a') =>
  applyAction(g, id, { type: 'truthAsk', question });
const answer = (g: Game, value = 'yes', id = 'e') =>
  applyAction(g, id, { type: 'truthAnswer', answer: value });
const cards = (g: Game) =>
  [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();

void test('simultaneous declarations resolve by storm order, independent of network arrival', () => {
  const initial = fixture();
  let g = declare(initial);
  assert.equal(g.truthtrance!.stage, 'priority');
  g = priority(declare(g, 'h'));
  assert.deepEqual(
    g.truthtrance!.queue.map((q) => q.player),
    ['h', 'a'],
  );
  assert.equal(g.discard.length, 0);
  assert.throws(() => ask(g), /holder to ask/);
  g = answer(ask(g, fact, 'h'));
  assert.equal(g.truthtrance!.queue[0].player, 'a');
  assert.equal(g.truthtrance!.stage, 'ask');
  assert.equal(g.discard.length, 1);
  g = answer(ask(g));
  assert.equal(g.truthtrance, null);
  assert.equal(g.discard.length, 2);
  assert.deepEqual(cards(g), cards(initial));
  assert.equal(initial.discard.length, 0);
  assert.equal(initial.truthtrance, undefined);
});
void test('private fact answer is visible only to its target until publicly answered', () => {
  const g = ask(priority(declare(fixture())));
  for (const id of ['a', 'h']) {
    const v = viewGame(g, id);
    assert.equal(v.truthAnswer, null);
    assert.equal(v.players.find((p) => p.id === 'e')!.hand, undefined);
    assert.deepEqual(v.truthHistory, []);
    assert.equal(v.truthtrance!.question!.kind, 'fact');
  }
  assert.equal(viewGame(g, 'e').truthAnswer, 'yes');
  assert.throws(() => answer(g, 'no'), /truthfully/);
  assert.throws(() => answer(g, 'unknown'), /truthfully/);
  assert.throws(() => answer(g, 'yes', 'a'), /questioned player/);
  const done = answer(JSON.parse(JSON.stringify(g)));
  for (const p of done.players)
    assert.equal(viewGame(done, p.id).truthHistory[0].answer, 'yes');
  assert.equal(viewGame(done, 'a').players[1].hand, undefined);
});
void test('AND/OR answers reveal the combined fact rather than the matching private identity', () => {
  const g = fixture();
  g.players[1].traitors.push(CHEAP_HERO_TRAITOR);
  const yes: TruthFact = { kind: 'traitor', leader: CHEAP_HERO_TRAITOR };
  const no: TruthFact = { kind: 'hand', name: 'Lasgun' };
  assert.equal(
    truthFactAnswer(g.players[1], { kind: 'and', terms: [yes, no] }),
    'no',
  );
  assert.equal(
    truthFactAnswer(g.players[1], { kind: 'or', terms: [yes, no] }),
    'yes',
  );
  const asked = ask(priority(declare(g)), {
    kind: 'fact',
    target: 'e',
    fact: { kind: 'or', terms: [yes, no] },
  });
  const done = answer(asked);
  assert.equal(done.truthHistory![0].answer, 'yes');
  assert.deepEqual(Object.keys(done.truthHistory![0]).sort(), [
    'answer',
    'asker',
    'phase',
    'question',
    'turn',
  ]);
  assert.equal(viewGame(done, 'a').players[1].traitors, undefined);
});
void test('any-time question overlays and restores pending windows without reapplying effects', () => {
  for (const mode of [
    'opening',
    'response',
    'decision',
    'battle',
    'spice',
  ] as const) {
    const initial = fixture();
    if (mode === 'opening')
      initial.phaseOpening = { passed: ['e'], initialize: true };
    if (mode === 'response') {
      hold(initial, 'a', 'Karama');
      initial.response = { kind: 'emperorIncome', owner: 'e', passed: ['h'] };
      initial.auction = {
        cards: initial.deck.splice(0, 2),
        index: 0,
        bid: 3,
        bidder: 'a',
        active: 'h',
        passed: [],
        opener: 0,
      };
    }
    if (mode === 'decision') {
      initial.decision = {
        kind: 'handExchange',
        player: 'h',
        target: 'a',
        count: 1,
      };
      initial.pendingExchange = {
        response: { kind: 'harkonnenBonus', owner: 'h', passed: [] },
        decision: null,
      };
    }
    if (mode === 'battle') {
      initial.phase = 6;
      initial.battle = {
        territory: 'arrakeen',
        attacker: 'a',
        defender: 'e',
        prepared: true,
        plans: {
          e: {
            dial: 1,
            leader: initial.players[1].leaders[0].id,
            weapon: null,
            defense: initial.players[1].hand[0].id,
            support: 0,
          },
        },
        revealed: false,
        traitorCalls: {},
        preparation: { kind: 'prescience', owner: 'a', beneficiary: 'a' },
        voice: { target: 'e', kind: 'poison', must: false },
      };
    }
    if (mode === 'spice') {
      initial.phase = 1;
      initial.spiceWindow = {
        territory: 'red_chasm',
        sector: 7,
        amount: 8,
        harvested: false,
      };
      initial.ready = ['e'];
    }
    const before = structuredClone(initial);
    let g = ask(priority(declare(initial, 'a')));
    for (const action of [
      { type: 'ready' },
      { type: 'passResponse' },
      { type: 'decision' },
      { type: 'battlePlan', dial: 1 },
      { type: 'card', card: initial.players[2].hand[0].id },
      { type: 'card', mode: 'special', card: initial.players[2].hand[0].id },
    ])
      assert.throws(() => applyAction(g, 'h', action), RuleError);
    g = answer(JSON.parse(JSON.stringify(g)));
    for (const key of [
      'phaseOpening',
      'response',
      'decision',
      'pendingExchange',
      'auction',
      'battle',
      'spiceWindow',
      'ready',
      'phase',
      'turn',
      'active',
      'spice',
    ] as const)
      assert.deepEqual(g[key], before[key], `${mode}: ${key}`);
    assert.equal(g.players[1].spice, before.players[1].spice);
    assert.deepEqual(initial, before);
  }
});
void test('unknown answers permit a different question or save, without discarding the card', () => {
  const q: TruthQuestion = {
    kind: 'freeform',
    target: 'e',
    text: 'Will you win two battles this turn?',
    scope: 'fact',
  };
  let g = ask(priority(declare(fixture())), q);
  g = answer(g, 'unknown');
  assert.equal(g.truthtrance!.stage, 'unknown');
  assert.equal(g.discard.length, 0);
  assert.throws(
    () => applyAction(g, 'e', { type: 'truthSave' }),
    /can be saved/,
  );
  const saved = applyAction(JSON.parse(JSON.stringify(g)), 'a', {
    type: 'truthSave',
  });
  assert.equal(saved.truthtrance, null);
  assert.ok(saved.players[0].hand.some((c) => c.effect === 'truthtrance'));
  const retried = answer(ask(g));
  assert.equal(retried.truthHistory!.length, 2);
  assert.equal(retried.discard.length, 1);
  assert.throws(
    () =>
      applyAction(ask(priority(declare(fixture()))), 'a', {
        type: 'truthSave',
      }),
    /can be saved/,
  );
});
void test('freeform current-turn promises are public records with explicit turn scope', () => {
  const question: TruthQuestion = {
    kind: 'freeform',
    scope: 'currentTurn',
    target: 'e',
    text: 'Will you ship six or more forces to Carthag this turn?',
  };
  const g = answer(ask(priority(declare(fixture())), question), 'no');
  assert.equal(g.truthHistory![0].turn, 2);
  assert.deepEqual(g.truthHistory![0].question, question);
  for (const p of g.players)
    assert.deepEqual(viewGame(g, p.id).truthHistory, g.truthHistory);
});
void test('malformed questions, targets and forged answers cannot mutate authoritative state', () => {
  const g = priority(declare(fixture()));
  const before = JSON.stringify(g);
  const invalid: unknown[] = [
    null,
    {},
    { ...fact, target: 'a' },
    { ...fact, target: 'intruder' },
    { ...fact, fact: { kind: 'hand', name: '__proto__' } },
    { ...fact, fact: { kind: 'traitor', leader: 'missing' } },
    { ...fact, fact: { kind: 'and', terms: [] } },
    { ...fact, fact: { kind: 'or', terms: Array(9).fill(fact.fact) } },
    { kind: 'freeform', target: 'e', text: ' ', scope: 'fact' },
    { kind: 'freeform', target: 'e', text: 'x'.repeat(501), scope: 'fact' },
    { kind: 'freeform', target: 'e', text: 'Future?', scope: 'nextTurn' },
  ];
  let nested = fact.fact;
  for (let i = 0; i < 6; i++)
    nested = { kind: 'and', terms: [nested, fact.fact] };
  invalid.push({ ...fact, fact: nested });
  for (const question of invalid)
    assert.throws(
      () => applyAction(g, 'a', { type: 'truthAsk', question }),
      RuleError,
    );
  assert.equal(JSON.stringify(g), before);
  assert.throws(
    () => applyAction(ask(g), 'e', { type: 'truthAnswer', answer: true }),
    /Answer Yes/,
  );
  assert.throws(
    () => applyAction(fixture(), 'a', { type: 'truthAnswer', answer: 'yes' }),
    /no pending/,
  );
});
void test('unselected setup traitors are unknown and a Truthtrance does not finish setup prematurely', () => {
  const g = fixture();
  g.status = 'setup';
  g.players[1].traitors = [];
  g.players[1].traitorChoices = [g.players[1].leaders[1].id];
  const q: TruthQuestion = {
    kind: 'fact',
    target: 'e',
    fact: { kind: 'traitor', leader: g.players[1].leaders[0].id },
  };
  const pending = ask(priority(declare(g)), q);
  assert.equal(pending.status, 'setup');
  assert.equal(viewGame(pending, 'e').truthAnswer, 'unknown');
  const unknown = answer(pending, 'unknown');
  assert.equal(unknown.status, 'setup');
  const saved = applyAction(unknown, 'a', { type: 'truthSave' });
  assert.equal(saved.status, 'setup');
  assert.deepEqual(
    saved.players[1].traitorChoices,
    g.players[1].traitorChoices,
  );
});
void test('all AI levels pass priority and publish verified answers from their own private view', () => {
  for (const level of DIFFICULTIES) {
    const initial = fixture();
    initial.players[1].bot = level;
    initial.players[2].bot = level;
    let g = runBots(declare(initial));
    assert.equal(g.truthtrance!.stage, 'ask');
    g = ask(g);
    assert.deepEqual(botActions(viewGame(g, 'h')), []);
    assert.deepEqual(botActions(viewGame(g, 'e')), [
      { type: 'truthAnswer', answer: 'yes' },
    ]);
    const done = runBots(g, 1);
    assert.equal(done.truthtrance, null);
    assert.equal(done.truthHistory![0].answer, 'yes');
  }
});
void test('AI handles unparseable freeform questions honestly and can complete a declared question', () => {
  for (const level of DIFFICULTIES) {
    const initial = fixture();
    initial.players[1].bot = level;
    const q: TruthQuestion = {
      kind: 'freeform',
      target: 'e',
      scope: 'fact',
      text: 'Will you win two battles?',
    };
    const pending = ask(priority(declare(initial)), q);
    assert.throws(() => answer(pending, 'yes'), /cannot yet interpret/);
    const unknown = runBots(pending);
    assert.equal(unknown.truthtrance!.stage, 'unknown');
    assert.equal(unknown.discard.length, 0);
    const bot = fixture();
    bot.players[0].bot = level;
    let g = priority(declare(bot));
    const actions: Action[] = botActions(viewGame(g, 'a'));
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, 'truthAsk');
    g = applyAction(g, 'a', actions[0]);
    const target = g.truthtrance!.question!.target;
    const actual = viewGame(g, target).truthAnswer!;
    g = answer(g, actual, target);
    assert.equal(g.truthtrance, null);
  }
});
void test('truth windows do not bypass lobby or finished-game boundaries and cannot be redeclared after passing', () => {
  for (const status of ['lobby', 'finished'] as const) {
    const g = fixture();
    g.status = status;
    assert.throws(() => declare(g), RuleError);
  }
  let g = declare(fixture());
  assert.throws(() => declare(g), /already declared/);
  g = applyAction(g, 'h', { type: 'truthPass' });
  assert.throws(() => declare(g, 'h'), /already declared/);
  assert.throws(
    () => applyAction(g, 'h', { type: 'truthPass' }),
    /priority window/,
  );
});
void test('a holder can declare both physical Truthtrances with separate answers and disposal', () => {
  const initial = fixture();
  initial.players[0].hand.push(initial.players[2].hand.pop()!);
  const ids = initial.players[0].hand.map((c) => c.id);
  for (const extra of [
    [ids[0]],
    [initial.players[1].hand[0].id],
    ['forged'],
    'not-an-array',
  ])
    assert.throws(
      () =>
        applyAction(initial, 'a', { type: 'card', card: ids[0], cards: extra }),
      RuleError,
    );
  let g = priority(
    applyAction(initial, 'a', { type: 'card', card: ids[0], cards: [ids[1]] }),
  );
  assert.equal(g.truthtrance!.queue.length, 2);
  g = answer(ask(g));
  assert.equal(g.discard.length, 1);
  assert.equal(g.truthtrance!.queue[0].card, ids[1]);
  g = answer(
    ask(g, {
      kind: 'freeform',
      target: 'e',
      text: 'Will you win two battles?',
      scope: 'fact',
    }),
    'unknown',
  );
  g = applyAction(g, 'a', { type: 'truthSave' });
  assert.equal(g.truthtrance, null);
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id),
    [ids[1]],
  );
  assert.deepEqual(cards(g), cards(initial));
});
