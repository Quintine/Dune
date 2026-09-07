import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, applyAction, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  quoteChoamStormOffer,
  ChoamStormQuoteError,
} from '../game/choam-storm-quote';
function actual() {
  let g = createGame('STORMQUOTE', newPlayer('c', 'CHOAM', 'choam'), true, [
    'choam',
  ]);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'BG', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 0,
    turn: 2,
    storm: 5,
    stormPending: 3,
    order: ['c', 'e', 'b'],
    deck: baseDeck(),
  });
  for (const p of g.players)
    Object.assign(p, { forces: {}, reserves: 20, hand: [], spice: 10 });
  g.players[0].forces = { 'red_chasm:7': 4 };
  g.players[0].reserves = 16;
  g.players[1].forces = { 'red_chasm:7': 3 };
  g.players[1].reserves = 17;
  function hold(who: number, name: string) {
    const index = g.deck.findIndex((c) => c.name === name);
    assert.ok(index >= 0);
    const card = g.deck.splice(index, 1)[0];
    g.players[who].hand.push(card);
    return card;
  }
  const jubba = hold(0, 'Jubba Cloak'),
    printed = hold(1, 'Karama'),
    bg = hold(2, 'Baliset');
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'choamStorm');
  g = applyAction(g, 'c', {
    type: 'card',
    mode: 'choam',
    card: jubba.id,
    territory: 'red_chasm',
  });
  assert.equal(g.response?.kind, 'choamWorthless');
  return { g, jubba, printed, bg };
}
void test('pure storm offer preserves public threat and protections without hidden-card dependence or random work', (t) => {
  const f = actual(),
    before = structuredClone(f.g);
  const rng = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('RNG');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('UUID');
  });
  const q = quoteChoamStormOffer(f.g);
  assert.deepEqual(q, {
    kind: 'decision',
    decision: {
      kind: 'choamStorm',
      player: 'c',
      territories: [{ territory: 'red_chasm', amount: 4, sectors: [7] }],
      protected: [],
    },
  });
  const empty = structuredClone(f.g);
  empty.discard.push(...empty.players[0].hand);
  empty.players[0].hand = [];
  assert.deepEqual(quoteChoamStormOffer(empty), q);
  assert.deepEqual(f.g, before);
  if (q.kind === 'decision') q.decision.territories[0].sectors.push(9);
  assert.deepEqual(f.g, before);
  assert.equal(rng.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});
void test('lost current threat and prior protection both stop at storm protection without moving casualties', () => {
  const { g } = actual();
  g.players[0].forces = {};
  g.players[0].reserves = 20;
  const before = structuredClone(g);
  assert.deepEqual(quoteChoamStormOffer(g), { kind: 'protection' });
  assert.deepEqual(g, before);
  g.players[0].forces = { 'red_chasm:7': 4 };
  g.players[0].reserves = 16;
  g.stormResolution!.choamProtected = ['red_chasm'];
  assert.deepEqual(quoteChoamStormOffer(g), { kind: 'protection' });
  assert.equal(g.players[1].tanks, 0);
});
void test('initial storm origin zero and full forty-sector traversal remain finite and preserve sector identities', () => {
  const { g } = actual();
  g.storm = 0;
  Object.assign(g.stormResolution!, { from: 0, distance: 40 });
  g.players[0].forces = { 'meridian:1': 2, 'cielago_north:3': 2 };
  const q = quoteChoamStormOffer(g);
  assert.equal(q.kind, 'decision');
  if (q.kind !== 'decision') throw Error('No decision');
  assert.deepEqual(
    q.decision.territories.map((x) => [x.territory, x.amount]),
    [
      ['cielago_north', 2],
      ['meridian', 2],
    ],
  );
  assert.equal(g.storm, 0);
  assert.equal(g.players[1].tanks, 0);
});
const corruptions: [string, (g: Game) => void][] = [
  [
    'null protections',
    (g) => {
      g.stormResolution!.choamProtected = null as never;
    },
  ],
  [
    'duplicate protections',
    (g) => {
      g.stormResolution!.choamProtected = ['red_chasm', 'red_chasm'];
    },
  ],
  [
    'alien protection',
    (g) => {
      g.stormResolution!.choamProtected = ['unknown'];
    },
  ],
  [
    'mismatched origin',
    (g) => {
      g.storm = 6;
    },
  ],
  [
    'traversal already begun',
    (g) => {
      g.stormResolution!.traversed = 1;
    },
  ],
  [
    'nonfinite distance',
    (g) => {
      g.stormResolution!.distance = Infinity;
    },
  ],
  [
    'bad typed affected force',
    (g) => {
      g.players[0].elites = {
        forces: { 'red_chasm:7': 5 },
        reserves: 0,
        tanks: 0,
        revived: 0,
      };
    },
  ],
];
for (const [name, mutate] of corruptions)
  void test(`malformed ${name} rejects without accepting printed or BG costs`, () => {
    const f = actual();
    mutate(f.g);
    const before = structuredClone(f.g);
    assert.throws(() => quoteChoamStormOffer(f.g), ChoamStormQuoteError);
    for (const [actor, card] of [
      ['e', f.printed],
      ['b', f.bg],
    ] as const) {
      assert.throws(() =>
        applyAction(f.g, actor, {
          type: 'card',
          mode: 'cancel',
          card: card.id,
        }),
      );
      assert.deepEqual(f.g, before);
      assert.equal(
        f.g.discard.some((c) => c.id === card.id),
        false,
      );
    }
  });
