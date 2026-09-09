import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEXUS_FACTIONS,
  createNexusCards,
  validateNexusCards,
  drawNexusCard,
  replaceNexusCard,
  discardNexusCard,
  nexusCardMode,
  projectNexusCards,
  type NexusState,
  type NexusPlayer,
} from '../game/nexus-cards';
import type { FactionId } from '../game/catalog';

const players: NexusPlayer[] = [
  { id: 'a', faction: 'atreides', ally: null },
  { id: 'g', faction: 'guild', ally: null },
];
const ordered = () => createNexusCards(players, () => 0.999);
function census(state: NexusState) {
  assert.deepEqual(
    [
      ...state.deck,
      ...state.discard,
      ...Object.values(state.hands).filter(
        (card): card is FactionId => card !== null,
      ),
    ].sort(),
    [...NEXUS_FACTIONS].sort(),
  );
  validateNexusCards(JSON.parse(JSON.stringify(state)) as NexusState, players);
}

void test('every setup contains all twelve physical faction cards independent of the two through six seated factions', () => {
  assert.equal(NEXUS_FACTIONS.length, 12);
  for (const count of [2, 3, 6]) {
    const seats = NEXUS_FACTIONS.slice(0, count).map((faction, i) => ({
      id: `seat-${i}`,
      faction,
    }));
    let calls = 0;
    const state = createNexusCards(seats, () => {
      calls++;
      return 0.999;
    });
    assert.equal(calls, 11);
    assert.deepEqual(state.deck, NEXUS_FACTIONS);
    assert.deepEqual(state.discard, []);
    assert.deepEqual(
      Object.values(state.hands),
      Array.from({ length: count }, () => null),
    );
    validateNexusCards(state, seats);
  }
  assert.notDeepEqual(createNexusCards(players, () => 0).deck, ordered().deck);
  assert.deepEqual(
    createNexusCards(players, () => 0),
    createNexusCards(players, () => 0),
  );
});

void test('one secret card is drawn from the top without extra randomness; own-faction draw remains optional to replace', () => {
  const initial = ordered();
  const before = JSON.stringify(initial);
  const state = drawNexusCard(initial, 'a', players, () => {
    throw new Error('A nonempty deck is not shuffled');
  });
  assert.equal(state.hands.a, 'atreides');
  assert.equal(
    nexusCardMode(state.hands.a!, 'atreides', ['atreides', 'guild']),
    'cunning',
  );
  assert.equal(state.deck.length, 11);
  assert.equal(state.discard.length, 0);
  assert.equal(JSON.stringify(initial), before);
  assert.throws(() => drawNexusCard(state, 'a', players, () => 0));
  assert.throws(() => replaceNexusCard(initial, 'a', players, () => 0));
  census(state);
});

void test('replacement discards before drawing and can draw the same physical card from a recycled discard pile', () => {
  const initial = drawNexusCard(ordered(), 'a', players, () => 0);
  const replaced = replaceNexusCard(initial, 'a', players, () => {
    throw new Error('Still a nonempty deck');
  });
  assert.equal(replaced.hands.a, 'harkonnen');
  assert.deepEqual(replaced.discard, ['atreides']);
  census(replaced);
  const exhausted = { ...initial, deck: [], discard: [...initial.deck] };
  census(exhausted);
  let calls = 0;
  // The just-discarded own card is the final element; the first Fisher-Yates
  // swap moves it to the top and remaining no-op swaps leave it there.
  const redrawn = replaceNexusCard(exhausted, 'a', players, () =>
    calls++ === 0 ? 0 : 0.999,
  );
  assert.equal(calls, 11);
  assert.equal(redrawn.hands.a, 'atreides');
  assert.equal(redrawn.discard.length, 0);
  assert.equal(redrawn.deck.length, 11);
  assert.deepEqual(exhausted.hands, initial.hands);
  census(redrawn);
});

void test('using or forfeiting a held card routes it to discard once; allied players cannot draw or replace', () => {
  const held = drawNexusCard(ordered(), 'a', players, () => 0);
  const allied: NexusPlayer[] = [
    { ...players[0], ally: 'g' },
    { ...players[1], ally: 'a' },
  ];
  let calls = 0;
  assert.throws(() =>
    drawNexusCard(ordered(), 'g', allied, () => {
      calls++;
      return 0;
    }),
  );
  assert.throws(() =>
    replaceNexusCard(held, 'a', allied, () => {
      calls++;
      return 0;
    }),
  );
  assert.equal(calls, 0);
  const forfeited = discardNexusCard(held, 'a', allied);
  assert.equal(forfeited.hands.a, null);
  assert.deepEqual(forfeited.discard, ['atreides']);
  assert.throws(() => discardNexusCard(forfeited, 'a', allied));
  assert.deepEqual(discardNexusCard(held, 'a', players), forfeited);
  census(forfeited);
});

void test('an empty deck recycles only discards, keeping another held identity outside the shuffle', () => {
  const held = drawNexusCard(ordered(), 'g', players, () => 0);
  const state = { ...held, deck: [], discard: [...held.deck] };
  let calls = 0;
  const drawn = drawNexusCard(state, 'a', players, () => {
    calls++;
    return 0.999;
  });
  assert.equal(calls, 10);
  assert.equal(drawn.hands.g, 'atreides');
  assert.equal(drawn.hands.a, 'harkonnen');
  assert.equal(drawn.discard.length, 0);
  assert.equal(drawn.deck.length, 10);
  census(drawn);
});

void test('all physical cards use Cunning for their faction, Betrayal for another seated faction and Secret Ally otherwise', () => {
  for (const card of NEXUS_FACTIONS) {
    const other = NEXUS_FACTIONS.find((faction) => faction !== card)!;
    assert.equal(nexusCardMode(card, card, [card, other]), 'cunning');
    assert.equal(nexusCardMode(card, other, [card, other]), 'betrayal');
    assert.equal(nexusCardMode(card, other, [other]), 'secretAlly');
  }
  for (const [card, own, seated] of [
    ['unknown', 'atreides', ['atreides']],
    ['guild', 'atreides', ['guild']],
    ['guild', 'atreides', ['atreides', 'atreides']],
    ['guild', 'unknown', ['unknown']],
  ] as const)
    assert.throws(() =>
      nexusCardMode(
        card as FactionId,
        own as FactionId,
        seated as readonly FactionId[],
      ),
    );
});

void test('malformed physical census, hand capacity, inherited dictionaries and changed seat keys reject unchanged', () => {
  const mutations: ((s: NexusState) => void)[] = [
    (s) => {
      s.deck.pop();
    },
    (s) => {
      s.discard.push(s.deck[0]);
    },
    (s) => {
      s.hands.a = s.deck[0];
    },
    (s) => {
      s.deck[0] = 'unknown' as FactionId;
    },
    (s) => {
      delete s.hands.g;
    },
    (s) => {
      s.hands.absent = null;
    },
    (s) => {
      s.version = 2 as 1;
    },
    (s) => {
      s.hands.a = [] as unknown as FactionId;
    },
    (s) => {
      s.hands = Object.create({ a: null, g: null }) as NexusState['hands'];
    },
    (s) => {
      Object.assign(s, { privateCard: 'guild' });
    },
  ];
  for (const mutate of mutations) {
    const state = ordered();
    mutate(state);
    const before = JSON.stringify(state);
    let calls = 0;
    assert.throws(() => validateNexusCards(state, players));
    assert.throws(() =>
      drawNexusCard(state, 'a', players, () => {
        calls++;
        return 0;
      }),
    );
    assert.equal(calls, 0);
    assert.equal(JSON.stringify(state), before);
  }
});

void test('unsafe or duplicate player identities reject before randomness and cannot pollute hand dictionaries', () => {
  for (const seats of [
    [],
    [players[0]],
    [...players, players[0]],
    [players[0], { ...players[1], faction: 'atreides' as const }],
    [players[0], { ...players[1], ally: 'missing' }],
    ...['__proto__', 'constructor', 'prototype', ''].map((id) => [
      { ...players[0], id },
      players[1],
    ]),
  ]) {
    let calls = 0;
    assert.throws(() =>
      createNexusCards(seats, () => {
        calls++;
        return 0;
      }),
    );
    assert.equal(calls, 0);
  }
  const state = ordered();
  assert.throws(() => drawNexusCard(state, '__proto__', players, () => 0));
  assert.equal(Object.getPrototypeOf(state.hands), Object.prototype);
  assert.equal(Object.hasOwn(Object.prototype, 'atreides'), false);
});

void test('invalid random draws fail on initialization or recycling without altering a committed card or consuming custody', () => {
  const held = drawNexusCard(ordered(), 'a', players, () => 0);
  const exhausted = { ...held, deck: [], discard: [...held.deck] };
  const before = JSON.stringify(exhausted);
  for (const value of [-0.1, 1, NaN, Infinity, -Infinity]) {
    assert.throws(() => createNexusCards(players, () => value), /random draws/);
    assert.throws(
      () => replaceNexusCard(exhausted, 'a', players, () => value),
      /random draws/,
    );
    assert.equal(JSON.stringify(exhausted), before);
  }
});

void test('private projection reveals only the caller’s card and public counts, and frozen inputs preserve independent JSON custody', () => {
  let state = drawNexusCard(ordered(), 'a', players, () => 0);
  state = drawNexusCard(state, 'g', players, () => 0);
  const privateView = projectNexusCards(state, 'a', players);
  assert.deepEqual(privateView, {
    card: 'atreides',
    deckCount: 10,
    discardCount: 0,
    held: { a: true, g: true },
  });
  const alternate = structuredClone(state);
  [alternate.hands.g, alternate.deck[0]] = [
    alternate.deck[0],
    alternate.hands.g!,
  ];
  alternate.deck.reverse();
  assert.deepEqual(projectNexusCards(alternate, 'a', players), privateView);
  assert.notDeepEqual(
    projectNexusCards(alternate, 'g', players),
    projectNexusCards(state, 'g', players),
  );
  assert.throws(() => projectNexusCards(state, 'observer-not-seated', players));
  for (const player of players)
    for (const field of ['hand', 'spice', 'traitors', 'battlePlan'])
      Object.defineProperty(player, field, {
        configurable: true,
        get() {
          throw new Error(`Private ${field}`);
        },
      });
  Object.freeze(state.deck);
  Object.freeze(state.discard);
  Object.freeze(state.hands);
  Object.freeze(state);
  const next = replaceNexusCard(state, 'a', players, () => 0);
  census(next);
  assert.notEqual(next.deck, state.deck);
  assert.notEqual(next.discard, state.discard);
  assert.notEqual(next.hands, state.hands);
  privateView.held.g = false;
  assert.equal(projectNexusCards(state, 'a', players).held.g, true);
});
