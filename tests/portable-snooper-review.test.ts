import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, ixBattleCards } from '../game/cards';
import { richeseCards } from '../game/richese-cards';

const portable = 'richese-portable-snooper';
function fixture() {
  const g = createGame(
    'PORTABLEREVIEW',
    newPlayer('r', 'Richese', 'richese'),
    false,
    ['choam', 'ix'],
  );
  g.players.push(
    newPlayer('g', 'Guild', 'guild'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: 'r',
    order: ['r', 'g', 'e'],
    storm: 18,
    deck: [...baseDeck(), ...ixBattleCards()],
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
    p.traitors = [];
    for (const l of p.leaders) l.strength = 0;
  }
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 5 };
    p.reserves = 15;
  }
  hold(g, 'r', 'Portable Snooper');
  return g;
}
function hold(g: Game, id: string, name: string) {
  const source = g.richeseCache!.some((c) => c.name === name)
    ? g.richeseCache!
    : g.deck;
  const i = source.findIndex((c) => c.name === name);
  assert.ok(i >= 0, name);
  const c = source.splice(i, 1)[0];
  g.players.find((p) => p.id === id)!.hand.push(c);
  return c.id;
}
const send = (g: Game, id: string, a: Action) => applyAction(g, id, a);
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const start = (g: Game) =>
  send(g, 'r', { type: 'chooseBattle', territory: 'arrakeen', target: 'g' });
function ready(g: Game) {
  for (const id of ['r', 'g'])
    g = send(g, id, { type: 'battlePreparationReady', event: g.battle!.event });
  return g;
}
const plan = (g: Game, id: string, extra: Partial<Action> = {}) =>
  send(g, id, {
    type: 'battlePlan',
    dial: id === 'r' ? 3 : 1,
    leader: g.players.find((p) => p.id === id)!.leaders[0].id,
    ...extra,
  });
function reveal(
  g: Game,
  own: Partial<Action> = {},
  other: Partial<Action> = {},
) {
  g = ready(g);
  return plan(plan(g, 'r', own), 'g', other);
}
const late = (g: Game) =>
  send(g, 'r', {
    type: 'portableSnooper',
    card: portable,
    event: g.battle!.event,
  });
function finish(g: Game) {
  for (const id of ['r', 'g'])
    if (g.battle?.traitorCalls[id] === undefined)
      g = send(g, id, { type: 'traitorCall', call: false });
  return g;
}
function cleanup(g: Game) {
  for (
    let i = 0;
    g.decision &&
    ['battleCards', 'battleLosses', 'ixSubstitution'].includes(
      g.decision.kind,
    ) &&
    i < 5;
    i++
  )
    g = send(
      g,
      g.decision.player,
      g.decision.kind === 'battleCards'
        ? { type: 'decision', discard: [] }
        : g.decision.kind === 'battleLosses'
          ? { type: 'decision', choice: 0 }
          : { type: 'decision', amount: 0 },
    );
  return g;
}
const inventory = (g: Game) =>
  [
    ...g.deck,
    ...g.discard,
    ...g.richeseCache!,
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();

void test('ordinary and late Portable both protect and enter the normal winner retention choice without changing sealed commitments', () => {
  for (const normal of [true, false]) {
    let g = fixture();
    const weapon = hold(g, 'g', 'Chaumas');
    const before = inventory(g);
    g = reveal(start(g), normal ? { defense: portable } : {}, { weapon });
    const original = structuredClone(g.battle!.plans);
    if (!normal) g = late(reload(g));
    assert.deepEqual(g.battle!.plans, original);
    g = finish(g);
    assert.equal(g.players[0].leaders[0].dead, false);
    assert.equal(g.decision?.kind, 'battleCards');
    assert.ok(
      g.decision?.kind === 'battleCards' && g.decision.cards.includes(portable),
    );
    g = cleanup(reload(g));
    assert.ok(g.players[0].hand.some((c) => c.id === portable));
    assert.equal(
      g.discard.some((c) => c.id === portable),
      false,
    );
    assert.deepEqual(inventory(g), before);
  }
});

void test('a losing Moritani ally may retain the late physical Portable while the original lone Worthless is discarded once', () => {
  let g = fixture();
  g.players[2] = newPlayer('e', 'Moritani', 'moritani');
  g.players[2].ally = 'r';
  g.players[0].ally = 'e';
  const worthless = hold(g, 'r', 'Baliset'),
    weapon = hold(g, 'g', 'Chaumas'),
    before = inventory(g);
  g = reveal(start(g), { dial: 1, defense: worthless }, { dial: 3, weapon });
  const sealed = structuredClone(g.battle!.plans.r);
  g = late(g);
  assert.deepEqual(g.battle!.plans.r, sealed);
  g = cleanup(finish(g));
  assert.equal(g.decision?.kind, 'moritaniRetention');
  assert.deepEqual(
    g.moritaniRetention!.played.sort(),
    [portable, worthless].sort(),
  );
  assert.ok(g.moritaniRetention!.eligible.includes(portable));
  g = send(reload(g), 'r', { type: 'decision', keep: portable });
  assert.ok(g.players[0].hand.some((c) => c.id === portable));
  assert.equal(g.discard.filter((c) => c.id === worthless).length, 1);
  assert.deepEqual(inventory(g), before);
});

void test('real Voice sees Portable as compulsory original poison defense and forbids its late use when prohibited', () => {
  for (const must of [true, false]) {
    let g = fixture();
    g.players[2] = newPlayer('e', 'Bene Gesserit', 'beneGesserit');
    g.players[2].ally = 'g';
    g.players[1].ally = 'e';
    g = start(g);
    g = send(g, 'e', { type: 'voice', kind: 'snooper', must });
    g = ready(g);
    if (must) {
      assert.throws(() => plan(g, 'r'), /Voice/);
      g = plan(g, 'r', { defense: portable });
      assert.equal(g.battle!.plans.r.defense, portable);
    } else {
      assert.throws(() => plan(g, 'r', { defense: portable }), /Voice/);
      g = plan(plan(g, 'r'), 'g');
      const before = structuredClone(g);
      assert.throws(() => late(g), /Voice/);
      assert.deepEqual(g, before);
    }
  }
});

function ask(g: Game, name: string | null) {
  const card = hold(g, 'g', 'Truthtrance');
  g = send(g, 'g', { type: 'card', card });
  while (g.truthtrance!.stage === 'priority')
    g = send(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = send(g, 'g', {
    type: 'truthAsk',
    question: {
      kind: 'battlePlan',
      target: 'r',
      claim: { kind: 'defense', name },
    },
  });
  return send(g, 'r', { type: 'truthAnswer', answer: 'yes' });
}
void test('real Prescience and Truthtrance preserve an inspected empty original slot while a canonical-name promise supports normal Portable', () => {
  let g = fixture();
  g.players[2] = newPlayer('e', 'Atreides', 'atreides');
  g.players[2].ally = 'g';
  g.players[1].ally = 'e';
  g = start(g);
  g = send(g, 'e', { type: 'prescience', field: 'defense' });
  g = send(g, 'r', { type: 'prescienceAnswer', value: null });
  g = ask(g, null);
  g = reveal(g);
  const plans = structuredClone(g.battle!.plans),
    promises = structuredClone(g.battle!.truthPromises);
  g = late(reload(g));
  assert.deepEqual(g.battle!.plans, plans);
  assert.deepEqual(g.battle!.truthPromises, promises);
  assert.equal(g.battle!.prescience!.value, null);
  let ordinary = ask(start(fixture()), 'Portable Snooper');
  ordinary = ready(ordinary);
  assert.throws(() => plan(ordinary, 'r'), /Truthtrance/);
  ordinary = plan(ordinary, 'r', { defense: portable });
  assert.equal(ordinary.battle!.plans.r.defense, portable);
});

void test('late played card cannot be transferred by Distrans or Richese gift and corrupted saved custody cannot normalize or resolve', () => {
  let g = fixture();
  g.players[0].ally = 'e';
  g.players[2].ally = 'r';
  hold(g, 'r', 'Distrans');
  g = late(reveal(start(g)));
  const before = structuredClone(g);
  assert.throws(
    () =>
      send(g, 'r', {
        type: 'card',
        card: 'richese-distrans',
        give: portable,
        target: 'e',
      }),
    /reserved|played|committed/,
  );
  assert.throws(
    () => send(g, 'r', { type: 'richeseGift', card: portable }),
    /reserved|played|committed/,
  );
  assert.deepEqual(g, before);
  const corrupt = reload(g);
  corrupt.players[0].hand = corrupt.players[0].hand.filter(
    (c) => c.id !== portable,
  );
  assert.throws(() => normalizeAutomaticGame(corrupt), /missing/);
  assert.throws(() => finish(corrupt), /missing/);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
});

void test('Poison Tooth activation remains a genuine preceding choice and Portable never blocks its poison', () => {
  let g = fixture();
  const tooth = hold(g, 'g', 'Poison Tooth');
  g = reveal(start(g), {}, { weapon: tooth });
  assert.equal(g.decision?.kind, 'poisonTooth');
  assert.throws(() => late(g), /interaction|decision/);
  g = send(g, 'g', { type: 'decision', activate: true });
  g = late(g);
  g = finish(g);
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[1].leaders[0].dead, true);
  assert.equal(g.discard.filter((c) => c.id === tooth).length, 1);
  g = cleanup(g);
  assert.ok(g.players[0].hand.some((c) => c.id === portable));
});

void test('public reveal contains Portable only after use and an opponent declaration cannot bypass the owner opportunity', (t) => {
  let g = reveal(start(fixture()));
  t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('unexpected RNG');
  });
  assert.equal(viewGame(g, 'g').portableSnooper, null);
  assert.deepEqual(viewGame(g, 'g').battle!.lateDefense, {});
  assert.equal(viewGame(g, 'r').portableSnooper!.blocked, null);
  g = send(g, 'g', { type: 'traitorCall', call: false });
  assert.ok(g.battle);
  g = late(g);
  assert.equal(viewGame(g, 'g').battle!.lateDefense.r, portable);
  assert.ok(viewGame(g, 'g').battle!.cards.some((c) => c.id === portable));
  assert.throws(() => late(g), /already added/);
  let passed = reveal(start(fixture()));
  passed = send(passed, 'r', { type: 'traitorCall', call: false });
  assert.throws(() => late(passed), /closed/);
});
