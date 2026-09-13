import test from 'node:test';
import assert from 'node:assert/strict';
import { runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { baseDeck, spiceDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import {
  DISCOVERY_SPICE_CARDS,
  DISCOVERY_TOKENS,
  validateDiscoveryState,
} from '../game/discoveries';
import {
  applyAction,
  createGame,
  initializeDiscoveryGameForAudit,
  joinGame,
  newPlayer,
  type Game,
} from '../game/engine';

const ROSTER: [string, FactionId][] = [
  ['a', 'atreides'],
  ['h', 'harkonnen'],
  ['g', 'guild'],
  ['f', 'fremen'],
];

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;

function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let word = Math.imul(state ^ (state >>> 15), state | 1);
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61);
    return (word ^ (word >>> 14)) >>> 0;
  };
}

function withEngineSeed<T>(seed: number, run: () => T): T {
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
          `Discovery playthrough seed ${seed} supports only the engine Uint32Array RNG contract.`,
        );
      for (let index = 0; index < array.length; index++)
        array[index] = randomWord();
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
    return run();
  } finally {
    if (originalRandom)
      Object.defineProperty(cryptoObject, 'getRandomValues', originalRandom);
    else Reflect.deleteProperty(cryptoObject, 'getRandomValues');
    if (originalUuid)
      Object.defineProperty(cryptoObject, 'randomUUID', originalUuid);
    else Reflect.deleteProperty(cryptoObject, 'randomUUID');
  }
}

function discoveryLobby(advanced: boolean): Game {
  const [first, ...rest] = ROSTER;
  let game = createGame(
    'DISCOVERYPLAYTHROUGH',
    newPlayer(first[0], first[0], first[1]),
    advanced,
  );
  for (const [id, faction] of rest) joinGame(game, newPlayer(id, id, faction));
  for (const player of game.players)
    game = applyAction(game, player.id, { type: 'ready' });
  game.discoveryEnabled = true;
  return game;
}

function finishGame(initial: Game, seed: number): Game {
  let game = initial;
  for (let batch = 0; batch < 240 && game.status !== 'finished'; batch++) {
    game = runBots(reload(game));
    assert.ok(
      game.status === 'finished' || game.botsPending,
      `Discovery playthrough seed ${seed} stalled at turn ${game.turn}, phase ${game.phase}, setup ${game.setupStage ?? 'complete'}, decision ${game.decision?.kind ?? 'none'}.`,
    );
  }
  assert.equal(
    game.status,
    'finished',
    `Discovery playthrough seed ${seed} did not finish.`,
  );
  assert.ok(
    game.winner.length > 0,
    `Discovery playthrough seed ${seed} has no winner.`,
  );
  return reload(game);
}

function assertTreacheryInventory(game: Game, seed: number) {
  const cards = [
    ...game.deck,
    ...game.discard,
    ...game.players.flatMap((player) => player.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? []),
  ];
  const expected = baseDeck()
    .map((card) => card.id)
    .sort();
  assert.equal(
    cards.length,
    expected.length,
    `Treachery cards in seed ${seed}`,
  );
  assert.equal(
    new Set(cards.map((card) => card.id)).size,
    expected.length,
    `Distinct Treachery cards in seed ${seed}`,
  );
  assert.deepEqual(
    cards.map((card) => card.id).sort(),
    expected,
    `Treachery identities in seed ${seed}`,
  );
}

function assertForceInventory(game: Game, seed: number) {
  for (const player of game.players)
    assert.equal(
      player.reserves +
        player.tanks +
        Object.values(player.forces).reduce((sum, count) => sum + count, 0),
      20,
      `${player.id} force inventory in seed ${seed}`,
    );
}

function assertDiscoveryInventory(game: Game, seed: number) {
  validateDiscoveryState(game.discoveries!);
  assert.equal(
    game.discoveries!.tokens.length,
    DISCOVERY_TOKENS.length,
    `Discovery tokens in seed ${seed}`,
  );
  assert.deepEqual(
    game.discoveries!.tokens.map((token) => token.face).sort(),
    DISCOVERY_TOKENS.map((token) => token.id).sort(),
    `Discovery token faces in seed ${seed}`,
  );

  const physicalSpiceCards = [
    ...game.spiceDeck,
    ...game.spiceDiscard.flat(),
  ].filter((card) => !('worm' in card && card.thumper));
  assert.equal(
    physicalSpiceCards.length + Number(game.sandtrout),
    spiceDeck().length + 7,
    `Spice Card inventory in seed ${seed}`,
  );
  const discoveryCards = physicalSpiceCards.flatMap((card) =>
    'territory' in card && card.discovery ? [card.discovery] : [],
  );
  assert.deepEqual(
    discoveryCards.sort(),
    DISCOVERY_SPICE_CARDS.map((card) => card.discovery).sort(),
    `Discovery Spice Cards in seed ${seed}`,
  );
  assert.equal(
    physicalSpiceCards.filter((card) => 'worm' in card && card.greatMaker)
      .length,
    1,
    `Great Maker card in seed ${seed}`,
  );
}

for (const [advanced, seed] of [
  [false, 2026091303],
  [true, 2026091304],
] as const)
  void test(`genuine ${advanced ? 'Advanced' : 'Basic'} Discovery seed ${seed} completes through JSON bot batches with conserved pieces`, () =>
    withEngineSeed(seed, () => {
      const lobby = discoveryLobby(advanced);
      const publicBefore = structuredClone(lobby);
      assert.throws(() => applyAction(lobby, lobby.host, { type: 'start' }));
      assert.deepEqual(lobby, publicBefore);

      let game = initializeDiscoveryGameForAudit(lobby);
      game.players.forEach((player, index) => {
        player.bot = DIFFICULTIES[index];
      });
      assert.equal(game.status, 'setup');
      assert.equal(game.expansions.length, 0);
      assert.equal(game.discoveryEnabled, true);
      assert.equal(game.discoveries?.tokens.length, DISCOVERY_TOKENS.length);
      assert.equal(game.spiceDeck.length, spiceDeck().length + 7);

      game = finishGame(game, seed);
      assertTreacheryInventory(game, seed);
      assertForceInventory(game, seed);
      assertDiscoveryInventory(game, seed);
    }));
