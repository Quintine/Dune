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
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
function fixture() {
  const g = createGame(
    'BOXREVIEW',
    newPlayer('r', 'Richese', 'richese'),
    true,
    ['choam'],
  );
  g.players.push(
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('c', 'CHOAM', 'choam'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 3,
    turn: 2,
    active: 'a',
    order: ['r', 'a', 'c'],
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 10;
    p.forces = {};
  }
  hold(g, 'r', 'Nullentropy Box');
  for (const name of ['Shield', 'Maula Pistol', 'Lasgun', 'Baliset']) {
    const i = g.deck.findIndex((c) => c.name === name);
    g.discard.push(...g.deck.splice(i, 1));
  }
  return g;
}
function hold(g: Game, owner: string, name: string) {
  const source = g.richeseCache!.some((c) => c.name === name)
    ? g.richeseCache!
    : g.deck;
  const index = source.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const card = source.splice(index, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card.id;
}
const send = (g: Game, player: string, action: Action) =>
  applyAction(g, player, action);
const begin = (g: Game) =>
  send(g, 'r', { type: 'card', card: 'richese-nullentropy-box' });
const select = (g: Game, card = g.discard[0].id) =>
  send(g, 'r', { type: 'decision', event: g.pendingNullentropy!.event, card });
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const inventory = (g: Game) =>
  [
    ...g.deck,
    ...g.discard,
    ...g.richeseCache!,
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();

void test('paid Box search suspends exact response and phase opening through reload, then restores them without replaying income', () => {
  let g = fixture();
  hold(g, 'a', 'Karama');
  g.response = { kind: 'guildIncome', owner: 'c', amount: 3, passed: ['r'] };
  g.phaseOpening = { passed: ['r'], initialize: false };
  const parent = structuredClone({
    response: g.response,
    phaseOpening: g.phaseOpening,
  });
  const before = inventory(g);
  const pile = structuredClone(g.discard);
  const picked = pile[1].id;
  g = begin(g);
  assert.equal(g.players[0].spice, 8);
  assert.equal(g.response, null);
  assert.equal(g.phaseOpening, null);
  assert.equal(g.decision?.kind, 'nullentropy');
  assert.deepEqual(g.discard, pile);
  assert.deepEqual(g.pendingNullentropy!.resume.response, parent.response);
  assert.deepEqual(
    g.pendingNullentropy!.resume.phaseOpening,
    parent.phaseOpening,
  );
  const restored = reload(g);
  assert.deepEqual(normalizeAutomaticGame(restored), restored);
  g = select(restored, picked);
  assert.equal(g.pendingNullentropy, null);
  assert.deepEqual(g.response, parent.response);
  assert.deepEqual(g.phaseOpening, parent.phaseOpening);
  assert.equal(g.players[0].spice, 8);
  assert.equal(g.players[2].spice, 10);
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id),
    [picked],
  );
  assert.equal(g.discard.at(-1)!.id, 'richese-nullentropy-box');
  assert.deepEqual(inventory(g), before);
});

void test('search locks Truthtrance, early CHOAM cash-in, Distrans and gameplay passes while seat takeback remains usable', () => {
  let g = fixture();
  const truth = hold(g, 'a', 'Truthtrance');
  hold(g, 'c', 'Distrans');
  const give = hold(g, 'c', 'Snooper');
  g = begin(g);
  const actions: [string, Action][] = [
    ['a', { type: 'card', card: truth }],
    ['c', { type: 'card', mode: 'special', cards: [give] }],
    ['c', { type: 'card', card: 'richese-distrans', target: 'a', give }],
    ['r', { type: 'ready' }],
    ['a', { type: 'passResponse' }],
  ];
  for (const [actor, action] of actions) {
    const before = structuredClone(g);
    assert.throws(() => send(g, actor, action), /search|Nullentropy|Box/i);
    assert.deepEqual(g, before);
  }
  const pile = structuredClone(g.discard),
    pending = structuredClone(g.pendingNullentropy);
  g = send(g, 'r', { type: 'setAutopilot', difficulty: 'Hard' });
  assert.deepEqual(g.discard, pile);
  assert.deepEqual(g.pendingNullentropy, pending);
  assert.equal(g.players[0].spice, 8);
  g = send(g, 'r', { type: 'setAutopilot', difficulty: null });
  assert.deepEqual(g.pendingNullentropy, pending);
  assert.deepEqual(normalizeAutomaticGame(g), g);
});

void test('a suspended automatic Harkonnen bonus cannot recycle an empty-deck discard pile during inspection', () => {
  let g = fixture();
  g.players[1].faction = 'harkonnen';
  g.deck = [];
  g.response = { kind: 'harkonnenBonus', owner: 'a', passed: [] };
  // This is a legacy automatically-resolvable response; search must still hold it.
  g = begin(g);
  const before = reload(g);
  assert.equal(g.deck.length, 0);
  assert.equal(g.players[1].hand.length, 0);
  assert.deepEqual(normalizeAutomaticGame(before), before);
  assert.equal(viewGame(before, 'r').nullentropy!.search!.cards.length, 4);
  assert.equal(g.discard.length, 4);
});

void test('stale event or corrupted discard evidence cannot reveal candidates or consume randomness', (t) => {
  const opened = reload(begin(fixture()));
  let draws = 0;
  t.mock.method(crypto, 'getRandomValues', () => {
    draws++;
    throw new Error('Unexpected RNG');
  });
  const stale = structuredClone(opened);
  assert.throws(
    () =>
      send(stale, 'r', {
        type: 'decision',
        event: 'stale',
        card: stale.discard[0].id,
      }),
    /event|search|stale/i,
  );
  assert.deepEqual(stale, opened);
  for (const change of [
    (g: Game) => {
      g.discard[0].name = 'Corrupt face';
    },
    (g: Game) => {
      g.discard.reverse();
    },
    (g: Game) => {
      g.pendingNullentropy!.discardIds.pop();
    },
    (g: Game) => {
      g.players[0].hand = [];
    },
  ]) {
    const g = structuredClone(opened);
    change(g);
    const before = structuredClone(g);
    const view = viewGame(g, 'r');
    assert.ok(
      !view.nullentropy?.search || view.nullentropy.search.cards.length === 0,
    );
    assert.throws(
      () => select(g),
      /search|discard|Box|card|custody|changed|signature/i,
    );
    assert.deepEqual(g, before);
  }
  assert.equal(draws, 0);
});

void test('the two-spice fee cannot make a real Truthtrance support promise impossible or grant a failed paid peek', () => {
  let g = fixture();
  g.phase = 6;
  g.storm = 18;
  g.players[0].spice = 3;
  for (const p of g.players.slice(0, 2)) {
    p.forces = { 'arrakeen:10': 4 };
    p.reserves = 16;
  }
  g.battle = {
    territory: 'arrakeen',
    attacker: 'r',
    defender: 'a',
    prepared: true,
    plans: {},
    revealed: false,
    traitorCalls: {},
  };
  const truth = hold(g, 'a', 'Truthtrance');
  g = send(g, 'a', { type: 'card', card: truth });
  while (g.truthtrance!.stage === 'priority')
    g = send(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = send(g, 'a', {
    type: 'truthAsk',
    question: {
      kind: 'battlePlan',
      target: 'r',
      claim: { kind: 'support', compare: 'gte', value: 2 },
    },
  });
  g = send(g, 'r', { type: 'truthAnswer', answer: 'yes' });
  const before = structuredClone(g);
  assert.throws(() => begin(g), /promise|Truthtrance|truthful/i);
  assert.deepEqual(g, before);
  const view = viewGame(g, 'r').nullentropy!;
  assert.equal(view.search, null);
  assert.ok(view.blocked);
  assert.equal(g.players[0].spice, 3);
});

void test('a Box committed to a real pending Richese gift cannot start a paid search', () => {
  let g = fixture();
  g.players[0].ally = 'a';
  g.players[1].ally = 'r';
  hold(g, 'c', 'Karama');
  g = send(g, 'r', { type: 'richeseGift', card: 'richese-nullentropy-box' });
  assert.equal(g.response?.kind, 'richeseGift');
  const before = structuredClone(g);
  assert.throws(() => begin(g), /reserved|gift|committed/);
  assert.deepEqual(g, before);
  assert.equal(viewGame(g, 'r').nullentropy!.search, null);
});
