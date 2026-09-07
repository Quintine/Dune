import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, applyAction, type Game } from '../game/engine';
import { baseDeck, spiceDeck } from '../game/cards';
import {
  quoteMovementPhaseStart,
  quoteAdvisorBattleOffer,
  MovementPhaseQuoteError,
} from '../game/movement-phase-quote';
import { createAmbassadors } from '../game/ecaz-ambassadors';
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function fixture(advanced = true) {
  const g = createGame(
    'MOVEMENTQUOTE',
    newPlayer('e', 'Emperor', 'emperor'),
    advanced,
  );
  g.players.push(newPlayer('b', 'BG', 'beneGesserit'));
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    order: ['e', 'b'],
    spiceDeck: spiceDeck(),
    spiceDiscard: [[], []],
  });
  for (const p of g.players)
    Object.assign(p, { forces: {}, hand: [], advisors: {}, spice: 20 });
  return g;
}
void test('every 2–6-player order initializes a detached complete movement queue', () => {
  for (let count = 2; count <= 6; count++) {
    const g = fixture(false);
    for (const faction of ['fremen', 'atreides', 'guild', 'harkonnen'] as const)
      if (g.players.length < count)
        g.players.push(newPlayer(faction, faction, faction));
    g.order = g.players.map((p) => p.id).reverse();
    const before = structuredClone(g);
    const q = quoteMovementPhaseStart(g);
    assert.equal(q.kind, 'initialize');
    if (q.kind === 'initialize') {
      assert.deepEqual(q.remaining, g.order);
      assert.equal(q.active, g.order[0]);
      assert.equal(q.decision, null);
      q.remaining.pop();
    }
    assert.deepEqual(g, before);
  }
});
void test('Ix opening validates only current seating and stops before piles, board or private state are read', () => {
  const g = fixture();
  for (const key of ['spiceDeck', 'spiceDiscard', 'storm'] as const)
    Object.defineProperty(g, key, {
      get() {
        throw new Error('past opening boundary');
      },
    });
  for (const p of g.players)
    for (const key of ['forces', 'hand', 'leaders'] as const)
      Object.defineProperty(p, key, {
        get() {
          throw new Error('past opening boundary');
        },
      });
  assert.deepEqual(quoteMovementPhaseStart(g, true), {
    kind: 'opening',
    phaseOpening: { passed: [], initialize: true },
  });
  g.order = ['e', 'e'];
  assert.throws(
    () => quoteMovementPhaseStart(g, true),
    MovementPhaseQuoteError,
  );
});
void test('advisor releases and current battle choice use existing public board positions without arrival effects', () => {
  const g = fixture();
  player(g, 'b').forces = {
    'arrakeen:10': 2,
    'carthag:11': 1,
    'sietch_tabr:14': 1,
  };
  player(g, 'b').advisors = {
    arrakeen: {},
    carthag: { lockedTurn: 2 },
    sietch_tabr: {},
    tueks_sietch: {},
  };
  player(g, 'e').forces = { 'arrakeen:10': 3, 'carthag:11': 2 };
  const before = structuredClone(g),
    offer = quoteAdvisorBattleOffer(g);
  assert.deepEqual(offer.territories, ['arrakeen']);
  assert.deepEqual(offer.released, [
    { player: 'b', territory: 'sietch_tabr' },
    { player: 'b', territory: 'tueks_sietch' },
  ]);
  const q = quoteMovementPhaseStart(g);
  assert.equal(q.kind, 'initialize');
  if (q.kind === 'initialize') {
    assert.deepEqual(q.decision, {
      kind: 'advisorBattle',
      player: 'b',
      territories: ['arrakeen'],
    });
    assert.equal(q.active, null);
  }
  assert.deepEqual(g, before);
  player(g, 'b').ally = 'e';
  player(g, 'e').ally = 'b';
  assert.deepEqual(quoteAdvisorBattleOffer(g).territories, []);
});
void test('advisor opportunity precedes Guild timing; otherwise Guild receives the exact next/following order', () => {
  const g = fixture();
  g.players.push(newPlayer('g', 'Guild', 'guild'));
  g.order = ['g', 'e', 'b'];
  let q = quoteMovementPhaseStart(g);
  assert.equal(q.kind, 'initialize');
  if (q.kind === 'initialize')
    assert.deepEqual(q.decision, {
      kind: 'guildTiming',
      player: 'g',
      next: 'g',
      following: 'e',
    });
  g.order = ['e', 'g', 'b'];
  q = quoteMovementPhaseStart(g);
  if (q.kind === 'initialize')
    assert.deepEqual(q.decision, {
      kind: 'guildTiming',
      player: 'g',
      next: 'e',
      following: 'e',
    });
  player(g, 'b').forces = { 'arrakeen:10': 1 };
  player(g, 'b').advisors = { arrakeen: {} };
  player(g, 'e').forces = { 'arrakeen:10': 1 };
  q = quoteMovementPhaseStart(g);
  if (q.kind === 'initialize') assert.equal(q.decision?.kind, 'advisorBattle');
  g.advanced = false;
  q = quoteMovementPhaseStart(g);
  if (q.kind === 'initialize') {
    assert.equal(q.decision, null);
    assert.equal(q.active, 'e');
  }
});
void test('Atreides refill is a pure source prerequisite without a sampled card or random draw', () => {
  const g = fixture();
  player(g, 'e').faction = 'atreides';
  g.spiceDeck = [];
  g.spiceDiscard = [
    [
      { worm: true, thumper: true },
      { worm: true, suppressed: true },
    ],
    [spiceDeck()[0]],
  ];
  const before = structuredClone(g),
    oldRandom = Math.random;
  try {
    Math.random = () => {
      throw new Error('quote must not sample');
    };
    const q = quoteMovementPhaseStart(g);
    assert.equal(q.kind, 'initialize');
    if (q.kind === 'initialize')
      assert.deepEqual(q.spice, { owner: 'e', refill: true, hasCards: true });
  } finally {
    Math.random = oldRandom;
  }
  assert.deepEqual(g, before);
  g.spiceDiscard = [[{ worm: true, thumper: true }], []];
  let q = quoteMovementPhaseStart(g);
  if (q.kind === 'initialize')
    assert.deepEqual(q.spice, { owner: 'e', refill: true, hasCards: false });
  g.spiceDeck = [spiceDeck()[0]];
  g.spiceDiscard = null as never;
  q = quoteMovementPhaseStart(g);
  if (q.kind === 'initialize')
    assert.deepEqual(q.spice, { owner: 'e', refill: false, hasCards: true });
});
void test('without Atreides, movement start never reads a spice pile or an opponent hand', () => {
  const g = fixture();
  for (const key of ['spiceDeck', 'spiceDiscard'] as const)
    Object.defineProperty(g, key, {
      get() {
        throw new Error('irrelevant pile');
      },
    });
  for (const p of g.players)
    Object.defineProperty(p, 'hand', {
      get() {
        throw new Error('private hand');
      },
    });
  const q = quoteMovementPhaseStart(g);
  assert.equal(q.kind, 'initialize');
  if (q.kind === 'initialize')
    assert.deepEqual(q.spice, { owner: null, refill: false, hasCards: false });
});
void test('malformed seating, current board, advisor owner and refill sources reject without mutation', () => {
  const base = fixture();
  player(base, 'e').faction = 'atreides';
  const cases: [string, (g: Game) => void][] = [
    [
      'duplicate order',
      (g) => {
        g.order = ['e', 'e'];
      },
    ],
    [
      'missing order',
      (g) => {
        g.order = ['e'];
      },
    ],
    [
      'unknown seat',
      (g) => {
        g.order = ['e', 'missing'];
      },
    ],
    [
      'wrong phase',
      (g) => {
        g.phase = 4;
      },
    ],
    [
      'zero turn',
      (g) => {
        g.turn = 0;
      },
    ],
    [
      'negative forces',
      (g) => {
        player(g, 'b').forces = { 'arrakeen:10': -1 };
      },
    ],
    [
      'unknown ally',
      (g) => {
        player(g, 'b').ally = 'missing';
      },
    ],
    [
      'invalid location',
      (g) => {
        player(g, 'e').forces = { 'arrakeen:9': 1 };
      },
    ],
    [
      'invalid spice deck',
      (g) => {
        g.spiceDeck = [{ territory: 'arrakeen', amount: 100, sector: 10 }];
      },
    ],
    [
      'invalid refill cardinality',
      (g) => {
        g.spiceDeck = [];
        g.spiceDiscard = [[]] as never;
      },
    ],
    [
      'invalid refill card',
      (g) => {
        g.spiceDeck = [];
        g.spiceDiscard = [[{ worm: false } as never], []];
      },
    ],
  ];
  for (const [label, mutate] of cases) {
    const g = structuredClone(base);
    mutate(g);
    const before = structuredClone(g);
    assert.throws(
      () => quoteMovementPhaseStart(g),
      MovementPhaseQuoteError,
      label,
    );
    assert.deepEqual(g, before, label);
  }
});
void test('real Ecaz completion initializes once with Atreides preview and advisor choice through JSON recovery', () => {
  let g = fixture();
  g.phase = 4;
  player(g, 'e').faction = 'ecaz';
  g.players.push(newPlayer('a', 'Atreides', 'atreides'));
  g.order = ['e', 'b', 'a'];
  g.ecazAmbassadors = createAmbassadors(() => 0);
  g.deck = baseDeck();
  const counter = g.deck.splice(
    g.deck.findIndex((c) => c.effect === 'karama'),
    1,
  )[0];
  player(g, 'e').hand = [counter];
  player(g, 'b').forces = { 'arrakeen:10': 1 };
  player(g, 'b').advisors = { arrakeen: {} };
  player(g, 'e').forces = { 'arrakeen:10': 1 };
  for (const p of g.players) {
    p.shipped = true;
    p.moved = 2;
  }
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'ecazPlacement');
  g = JSON.parse(JSON.stringify(g));
  const expected = quoteMovementPhaseStart({ ...g, phase: 5 });
  g = applyAction(g, 'e', { type: 'decision', decline: true });
  assert.equal(g.phase, 5);
  assert.equal(g.response?.kind, 'atreidesSpice');
  assert.equal(g.decision?.kind, 'advisorBattle');
  assert.equal(expected.kind, 'initialize');
  if (expected.kind === 'initialize') {
    assert.deepEqual(g.movementRemaining, expected.remaining);
    assert.deepEqual(g.decision, expected.decision);
  }
  assert.ok(g.players.every((p) => !p.shipped && p.moved === 0));
  assert.equal(g.pendingAmbassador ?? null, null);
  assert.equal(g.pendingTerrorEntry ?? null, null);
});
