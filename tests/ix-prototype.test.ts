import test from 'node:test';
import assert from 'node:assert/strict';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { spiceDeck, treacheryDeck } from '../game/cards';
import { MOBILE_LOCATION } from '../game/board';
import type { FactionId } from '../game/catalog';
import {
  applyAction,
  createGame,
  initializeIxGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';

const ROSTER: [string, FactionId][] = [
  ['i', 'ixians'],
  ['t', 'tleilaxu'],
  ['a', 'atreides'],
  ['h', 'harkonnen'],
];

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;

function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let word = Math.imul(state ^ (state >>> 15), state | 1);
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
    return (word ^ (word >>> 14)) >>> 0;
  };
}

function withEngineSeed<T>(seed: number, fn: () => T): T {
  const cryptoObject = globalThis.crypto;
  const originalRandom = Object.getOwnPropertyDescriptor(
    cryptoObject,
    'getRandomValues',
  );
  const originalUuid = Object.getOwnPropertyDescriptor(
    cryptoObject,
    'randomUUID',
  );
  const randomWord = generator(seed);
  const uuidWord = generator(seed ^ 0xa5a5a5a5);
  Object.defineProperty(cryptoObject, 'getRandomValues', {
    configurable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      if (!(array instanceof Uint32Array))
        throw new Error(
          `Ix prototype seed ${seed} supports only the engine Uint32Array RNG contract.`,
        );
      for (let i = 0; i < array.length; i++) array[i] = randomWord();
      return array;
    },
  });
  Object.defineProperty(cryptoObject, 'randomUUID', {
    configurable: true,
    value: () => {
      const hex = Array.from({ length: 4 }, () =>
        uuidWord().toString(16).padStart(8, '0'),
      )
        .join('')
        .split('');
      hex[12] = '4';
      hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
      const id = hex.join('');
      return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    },
  });
  try {
    return fn();
  } finally {
    if (originalRandom)
      Object.defineProperty(cryptoObject, 'getRandomValues', originalRandom);
    else Reflect.deleteProperty(cryptoObject, 'getRandomValues');
    if (originalUuid)
      Object.defineProperty(cryptoObject, 'randomUUID', originalUuid);
    else Reflect.deleteProperty(cryptoObject, 'randomUUID');
  }
}

function lobby(advanced = false, roster = ROSTER): Game {
  const [first, ...rest] = roster;
  let g = createGame(
    'IXPROTOTYPE',
    newPlayer(first[0], first[0], first[1]),
    advanced,
    ['ix'],
  );
  for (const [id, faction] of rest) joinGame(g, newPlayer(id, id, faction));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}

function candidates(g: Game, id: string, difficulty: Difficulty) {
  const view = viewGame(g, id);
  view.players.find((p) => p.id === id)!.bot = difficulty;
  const before = structuredClone(view);
  const actions = botActions(view);
  assert.deepEqual(view, before);
  for (const action of actions)
    assert.doesNotThrow(
      () => applyAction(g, id, action),
      `${difficulty}/${g.setupStage}/${g.decision?.kind}/${id}: ${JSON.stringify(action)}`,
    );
  return actions;
}

function reachIxChoice(state: Game, difficulty: Difficulty): Game {
  let g = state;
  for (let step = 0; g.status === 'setup' && step < 24; step++) {
    if (g.decision?.kind === 'ixSetup') return g;
    let progressed = false;
    for (const p of g.players) {
      const actions = candidates(g, p.id, difficulty);
      if (!actions.length) continue;
      g = applyAction(g, p.id, actions[0]);
      progressed = true;
      break;
    }
    assert.ok(progressed, `Ix setup stalled at ${g.setupStage}.`);
  }
  assert.fail('Ix setup did not reach its private starting-card choice.');
}

function assertTreacheryInventory(g: Game) {
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.ixSetupCards ?? []),
    ...(g.ixAuction?.cards ?? []),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ];
  const expected = treacheryDeck(['ix'])
    .map((card) => card.id)
    .sort();
  assert.equal(cards.length, 47);
  assert.equal(new Set(cards.map((card) => card.id)).size, 47);
  assert.deepEqual(cards.map((card) => card.id).sort(), expected);
}

function assertSetupResult(g: Game) {
  assert.equal(g.status, 'playing');
  assert.equal(g.setupStage ?? null, null);
  assert.equal(g.ixSetupCards, null);
  assert.ok(g.phaseOpening);
  assert.deepEqual(g.expansions, ['ix']);
  assert.equal(g.players.find((p) => p.id === 'i')!.hand.length, 1);
  assert.equal(g.players.find((p) => p.id === 't')!.hand.length, 1);
  assert.equal(g.players.find((p) => p.id === 'a')!.hand.length, 1);
  assert.equal(g.players.find((p) => p.id === 'h')!.hand.length, 2);
  const ixians = g.players.find((p) => p.id === 'i')!;
  assert.equal(ixians.spice, 10);
  assert.equal(ixians.reserves, 14);
  assert.deepEqual(ixians.forces, { [MOBILE_LOCATION]: 6 });
  assert.equal(ixians.elites?.reserves, 4);
  assert.deepEqual(ixians.elites!.forces, { [MOBILE_LOCATION]: 3 });
  assert.equal(g.mobileStronghold?.location, null);
  const tleilaxu = g.players.find((p) => p.id === 't')!;
  assert.equal(tleilaxu.spice, 5);
  assert.equal(tleilaxu.reserves, 20);
  assert.deepEqual(tleilaxu.forces, {});
  assert.equal(tleilaxu.traitors.length, 0);
  assert.equal(tleilaxu.faceDancers?.length, 3);
  assert.equal(
    new Set(tleilaxu.faceDancers?.map((card) => card.leader)).size,
    3,
  );
  for (const owner of g.players) {
    const own = viewGame(g, owner.id).players.find((p) => p.id === owner.id)!;
    assert.deepEqual(own.hand, owner.hand);
    assert.deepEqual(own.traitors, owner.traitors);
    if (owner.id === 't') assert.deepEqual(own.faceDancers, owner.faceDancers);
    for (const observer of g.players.filter((p) => p.id !== owner.id)) {
      const hidden = viewGame(g, observer.id).players.find(
        (p) => p.id === owner.id,
      )!;
      assert.equal(hidden.hand, undefined);
      assert.equal(hidden.traitors, undefined);
      assert.equal(hidden.faceDancers, undefined);
    }
  }
  const traitors = [
    ...(g.traitorReserve ?? []),
    ...g.players.flatMap((p) => p.traitors),
    ...(tleilaxu.faceDancers ?? []).map((card) => card.leader),
  ];
  assert.equal(traitors.length, 21);
  assert.equal(new Set(traitors).size, 21);
  assertTreacheryInventory(g);
}

function rejectInitializer(g: Game, pattern?: RegExp) {
  const before = structuredClone(g);
  if (pattern) assert.throws(() => initializeIxGameForAudit(g), pattern);
  else assert.throws(() => initializeIxGameForAudit(g));
  assert.deepEqual(g, before);
}

function finishGame(initial: Game, seed: number): Game {
  let g = initial;
  for (let batch = 0; batch < 240 && g.status !== 'finished'; batch++) {
    g = runBots(reload(g));
    assert.ok(
      g.status === 'finished' || g.botsPending,
      `Ix prototype seed ${seed} stalled at turn ${g.turn}, phase ${g.phase}.`,
    );
  }
  assert.equal(g.status, 'finished', `Ix prototype seed ${seed}.`);
  assert.ok(g.winner.length > 0, `Ix prototype seed ${seed} has no winner.`);
  return g;
}

void test('all AI profiles complete genuine private Ix setup through JSON continuation', () => {
  for (const difficulty of DIFFICULTIES)
    for (const advanced of [false, true]) {
      const initial = lobby(advanced);
      const before = structuredClone(initial);
      let g = initializeIxGameForAudit(initial);
      assert.deepEqual(initial, before);
      assert.equal(g.status, 'setup');
      assert.equal(g.deck.length, 47);
      assert.equal(g.spiceDeck.length, 22);
      assert.equal(g.spiceDeck.filter((card) => 'sandtrout' in card).length, 1);
      assert.equal(g.spiceDeck.length, spiceDeck(true).length);
      assert.ok(g.players.every((p) => p.hand.length === 0));

      g = reachIxChoice(g, difficulty);
      assert.equal(g.ixSetupCards?.length, ROSTER.length);
      const ids = g.ixSetupCards!.map((card) => card.id);
      assert.deepEqual(viewGame(g, 'i').ixTechnology?.setup, g.ixSetupCards);
      for (const observer of ['t', 'a', 'h']) {
        const view = viewGame(g, observer);
        assert.equal(view.ixTechnology, null);
        const serialized = JSON.stringify(view);
        for (const id of ids) assert.equal(serialized.includes(id), false);
      }

      const rejected = structuredClone(g);
      assert.throws(() =>
        applyAction(g, 't', { type: 'decision', card: ids[0] }),
      );
      assert.deepEqual(g, rejected);
      assert.throws(() =>
        applyAction(g, 'i', { type: 'decision', card: 'missing-card' }),
      );
      assert.deepEqual(g, rejected);

      const restored = reload(g);
      const choice = candidates(restored, 'i', difficulty)[0];
      assert.equal(choice.type, 'decision');
      g = applyAction(restored, 'i', choice);
      assertSetupResult(g);
    }
});

for (const [advanced, seed] of [
  [false, 2026091301],
  [true, 2026091302],
] as const)
  void test(`genuine ${advanced ? 'Advanced' : 'Basic'} Ix prototype seed ${seed} completes with mixed AI and conserved pieces`, () =>
    withEngineSeed(seed, () => {
      let g = lobby(advanced);
      g.players.forEach((p, index) => {
        p.bot = DIFFICULTIES[index];
      });
      g = initializeIxGameForAudit(g);
      assert.equal(g.status, 'setup');
      assert.equal(g.deck.length, 47);
      assert.equal(g.spiceDeck.length, 22);
      g = finishGame(g, seed);
      assertTreacheryInventory(g);
      for (const p of g.players)
        assert.equal(
          p.reserves +
            p.tanks +
            Object.values(p.forces).reduce((sum, count) => sum + count, 0),
          20,
          `${p.id} in seed ${seed}`,
        );
      const spiceCards = [...g.spiceDeck, ...g.spiceDiscard.flat()].filter(
        (card) => !('worm' in card && card.thumper),
      );
      assert.equal(
        spiceCards.length + Number(g.sandtrout),
        22,
        `Spice deck in seed ${seed}`,
      );
      assert.equal(
        spiceCards.filter((card) => 'sandtrout' in card).length +
          Number(g.sandtrout),
        1,
        `Sandtrout in seed ${seed}`,
      );
    }));

void test('the Ix prototype keeps public gates and rejects unsupported or nonempty lobbies without mutation', () => {
  const publicLobby = lobby(false, [
    ['a', 'atreides'],
    ['h', 'harkonnen'],
  ]);
  const publicBefore = structuredClone(publicLobby);
  assert.throws(
    () => applyAction(publicLobby, publicLobby.host, { type: 'start' }),
    /Expansion rules are still being implemented/,
  );
  assert.deepEqual(publicLobby, publicBefore);

  const absent = createGame('NOIXPROTO', newPlayer('a', 'a', 'atreides'));
  absent.players.push(newPlayer('h', 'h', 'harkonnen'));
  absent.players.forEach((p) => (p.ready = true));
  rejectInitializer(absent, /requires exactly/);

  const combined = createGame(
    'COMBINEDPROTO',
    newPlayer('a', 'a', 'atreides'),
    false,
    ['ix', 'choam'],
  );
  combined.players.push(newPlayer('h', 'h', 'harkonnen'));
  combined.players.forEach((p) => (p.ready = true));
  rejectInitializer(combined, /requires exactly/);

  const unsupported = createGame(
    'FACTIONPROTO',
    newPlayer('c', 'c', 'choam'),
    false,
    ['ix'],
  );
  unsupported.players.push(newPlayer('a', 'a', 'atreides'));
  unsupported.players.forEach((p) => (p.ready = true));
  rejectInitializer(unsupported, /base, Ixian and Tleilaxu/);

  const moduleFactories: Array<[string, (g: Game) => Game]> = [
    [
      'tech',
      (g) => applyAction(g, g.host, { type: 'techTokens', enabled: true }),
    ],
    [
      'homeworld',
      (g) => applyAction(g, g.host, { type: 'homeworlds', enabled: true }),
    ],
    [
      'stronghold',
      (g) => applyAction(g, g.host, { type: 'strongholdCards', enabled: true }),
    ],
    ['nexus', (g) => ({ ...g, nexusCards: { cards: null, phase: null } })],
  ];
  for (const [name, enable] of moduleFactories) {
    let g = enable(lobby(name === 'stronghold'));
    for (const p of g.players)
      if (!p.ready) g = applyAction(g, p.id, { type: 'ready' });
    rejectInitializer(g, /without optional modules/);
  }

  const occupied = lobby();
  occupied.deck.push(treacheryDeck(['ix'])[0]);
  rejectInitializer(occupied, /cannot redeal/);

  const initialized = initializeIxGameForAudit(lobby());
  rejectInitializer(initialized, /fresh lobby/);
});
