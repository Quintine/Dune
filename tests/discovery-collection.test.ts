import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { baseDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import {
  createDiscoveryState,
  validateDiscoveryState,
  type DiscoveryLocationId,
} from '../game/discoveries';
import {
  CISTERN,
  ORGIZ_PROCESSING_STATION,
  quoteDiscoveryCollection,
} from '../game/discovery-collection';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  type Game,
} from '../game/engine';

type Seat = [id: string, faction: FactionId];

function fixture(
  advanced = false,
  seats: Seat[] = [
    ['a', 'atreides'],
    ['h', 'harkonnen'],
    ['g', 'guild'],
  ],
): Game {
  const [first, ...rest] = seats;
  const game = createGame(
    'DISCOVERYCOLLECTION',
    newPlayer(first[0], first[0], first[1]),
    advanced,
  );
  game.players.push(...rest.map(([id, faction]) => newPlayer(id, id, faction)));
  Object.assign(game, {
    status: 'playing',
    phase: 7,
    turn: 2,
    storm: 18,
    order: seats.map(([id]) => id),
    spice: {},
    discoveries: createDiscoveryState(() => 0),
  });
  for (const player of game.players) {
    player.forces = {};
    player.spice = 0;
  }
  return game;
}

function reveal(game: Game, id: DiscoveryLocationId) {
  const token = game.discoveries!.tokens.find((entry) => entry.face === id)!;
  const smuggler = token.type === 'smuggler';
  Object.assign(token, {
    status: 'placed',
    territory: smuggler ? 'pasty_mesa' : 'meridian',
    sector: smuggler ? 7 : 1,
    revealedTurn: 2,
  });
  validateDiscoveryState(game.discoveries!);
}

function composed(game: Game) {
  const ordinary = quoteSpiceCollection(game);
  return {
    ordinary,
    discovery: quoteDiscoveryCollection(game, ordinary),
  };
}

function balance(
  quote: ReturnType<typeof quoteDiscoveryCollection>,
  player: string,
) {
  return quote.receipts.find((receipt) => receipt.player === player)!.balance;
}

void test('a sole Cistern occupant receives two bank spice in Basic and Advanced without changing collection facts', () => {
  for (const advanced of [false, true]) {
    const game = fixture(advanced);
    reveal(game, CISTERN);
    game.players[0].forces = { [`${CISTERN}:0`]: 1 };
    game.players[0].spice = 4;
    const before = structuredClone(game);
    const { ordinary, discovery } = composed(game);
    assert.deepEqual(discovery.effects, [
      {
        kind: 'cistern',
        player: 'a',
        amount: 2,
        source: 'bank',
      },
    ]);
    assert.equal(
      balance(discovery, 'a'),
      balance({ ...discovery, receipts: ordinary.receipts }, 'a') + 2,
    );
    assert.deepEqual(
      discovery.receipts.map(({ player, collected, desert, strongholds }) => ({
        player,
        collected,
        desert,
        strongholds,
      })),
      ordinary.receipts.map(({ player, collected, desert, strongholds }) => ({
        player,
        collected,
        desert,
        strongholds,
      })),
    );
    assert.deepEqual(game, before);
  }
});

void test('Cistern follows Collection advisor releases and excludes remaining advisors', () => {
  const hidden = fixture(true);
  const hiddenToken = hidden.discoveries!.tokens.find(
    (entry) => entry.face === CISTERN,
  )!;
  Object.assign(hiddenToken, {
    status: 'placed',
    territory: 'meridian',
    sector: 1,
  });
  assert.deepEqual(composed(hidden).discovery.effects, []);

  const advisors = fixture(true, [
    ['b', 'beneGesserit'],
    ['h', 'harkonnen'],
  ]);
  reveal(advisors, CISTERN);
  advisors.players[0].forces = { [`${CISTERN}:0`]: 1 };
  advisors.players[0].advisors = { [CISTERN]: {} };
  const released = composed(advisors);
  assert.deepEqual(released.ordinary.released, [{ player: 'b', territory: CISTERN }]);
  assert.deepEqual(released.discovery.effects, [
    { kind: 'cistern', player: 'b', amount: 2, source: 'bank' },
  ]);
  advisors.players[1].forces = { [`${CISTERN}:0`]: 1 };
  const remainingAdvisor = composed(advisors);
  assert.deepEqual(remainingAdvisor.ordinary.released, []);
  assert.deepEqual(remainingAdvisor.discovery.effects, [
    { kind: 'cistern', player: 'h', amount: 2, source: 'bank' },
  ]);
});

void test('the bounded Orgiz quote transfers one spice from each uniquely collected observable board deposit', () => {
  const game = fixture();
  reveal(game, ORGIZ_PROCESSING_STATION);
  game.players[0].forces = {
    [`${ORGIZ_PROCESSING_STATION}:0`]: 1,
    'red_chasm:7': 1,
  };
  game.players[1].forces = { 'hagga_basin:12': 1 };
  game.players[2].forces = { 'cielago_south:2': 1 };
  game.spice = {
    'red_chasm:7': 2,
    'hagga_basin:12': 4,
    'cielago_south:2': 3,
  };
  const before = structuredClone(game);
  const { ordinary, discovery } = composed(game);
  assert.deepEqual(discovery.effects, [
    {
      kind: 'orgiz',
      player: 'a',
      from: 'g',
      location: 'cielago_south:2',
      amount: 1,
      source: 'player',
    },
    {
      kind: 'orgiz',
      player: 'a',
      from: 'h',
      location: 'hagga_basin:12',
      amount: 1,
      source: 'player',
    },
  ]);
  assert.equal(
    balance(discovery, 'a'),
    balance({ ...discovery, receipts: ordinary.receipts }, 'a') + 2,
  );
  assert.equal(
    balance(discovery, 'h'),
    balance({ ...discovery, receipts: ordinary.receipts }, 'h') - 1,
  );
  assert.equal(
    balance(discovery, 'g'),
    balance({ ...discovery, receipts: ordinary.receipts }, 'g') - 1,
  );
  assert.equal(
    discovery.receipts.reduce((sum, receipt) => sum + receipt.balance, 0),
    ordinary.receipts.reduce((sum, receipt) => sum + receipt.balance, 0),
  );
  assert.deepEqual(game, before);
  assert.deepEqual(quoteSpiceCollection(game), ordinary);
});

void test('one rival pays once per collected pile, not once per player or stacked spice amount', () => {
  const game = fixture();
  reveal(game, ORGIZ_PROCESSING_STATION);
  game.players[0].forces = { [`${ORGIZ_PROCESSING_STATION}:0`]: 1 };
  game.players[1].forces = { 'hagga_basin:12': 1, 'cielago_south:2': 1 };
  game.spice = { 'hagga_basin:12': 8, 'cielago_south:2': 2 };
  const { ordinary, discovery } = composed(game);
  assert.deepEqual(
    discovery.effects.filter(effect => effect.kind === 'orgiz')
      .map(effect => [effect.from, effect.location]),
    [['h', 'cielago_south:2'], ['h', 'hagga_basin:12']],
  );
  assert.equal(balance(discovery, 'a'), 2);
  assert.equal(balance(discovery, 'h'), balance({
    ...discovery, receipts: ordinary.receipts,
  }, 'h') - 2);
  assert.equal(ordinary.spice['hagga_basin:12'], 6);
});

void test('Orgiz does not transfer spice from its occupant to itself and ignores untouched deposits', () => {
  const game = fixture();
  reveal(game, ORGIZ_PROCESSING_STATION);
  game.players[0].forces = {
    [`${ORGIZ_PROCESSING_STATION}:0`]: 1,
    'red_chasm:7': 1,
  };
  game.players[1].forces = { 'hagga_basin:12': 1 };
  game.spice = {
    'red_chasm:7': 2,
    'hagga_basin:12': 2,
    'cielago_south:2': 6,
  };
  const { ordinary, discovery } = composed(game);
  assert.deepEqual(discovery.effects, [
    {
      kind: 'orgiz',
      player: 'a',
      from: 'h',
      location: 'hagga_basin:12',
      amount: 1,
      source: 'player',
    },
  ]);
  assert.equal(
    balance(discovery, 'a'),
    balance({ ...discovery, receipts: ordinary.receipts }, 'a') + 1,
  );
  assert.equal(discovery.receipts[0].collected, ordinary.receipts[0].collected);
  assert.equal(discovery.receipts[0].desert, ordinary.receipts[0].desert);
});

void test('Orgiz charges a collector whose advisors become fighters before Collection', () => {
  const game = fixture(true, [
    ['a', 'atreides'], ['b', 'beneGesserit'], ['h', 'harkonnen'],
  ]);
  reveal(game, ORGIZ_PROCESSING_STATION);
  game.players[0].forces = { [`${ORGIZ_PROCESSING_STATION}:0`]: 1 };
  game.players[1].forces = { 'hagga_basin:12': 1 };
  game.players[1].advisors = { hagga_basin: { lockedTurn: 1 } };
  game.spice = { 'hagga_basin:12': 2 };
  const ordinary = quoteSpiceCollection(game);
  assert.deepEqual(ordinary.released, [{ player: 'b', territory: 'hagga_basin' }]);
  const discovery = quoteDiscoveryCollection(game, ordinary);
  assert.deepEqual(discovery.effects, [{
    kind: 'orgiz', player: 'a', from: 'b', location: 'hagga_basin:12',
    amount: 1, source: 'player',
  }]);
  assert.equal(balance(discovery, 'a'), 1);
  assert.equal(balance(discovery, 'b'), 1);
});

void test('Orgiz withholds uncertain Ecaz shared theft while collecting an independent deposit', () => {
  const game = fixture(false, [
    ['e', 'ecaz'],
    ['a', 'atreides'],
    ['g', 'guild'],
  ]);
  reveal(game, ORGIZ_PROCESSING_STATION);
  game.players[0].ally = 'a';
  game.players[1].ally = 'e';
  game.players[0].forces = { 'hagga_basin:12': 1, 'red_chasm:7': 1 };
  game.players[1].forces = { 'hagga_basin:12': 1 };
  game.players[2].forces = { [`${ORGIZ_PROCESSING_STATION}:0`]: 1 };
  game.spice = { 'hagga_basin:12': 4, 'red_chasm:7': 2 };
  const ordinary = quoteSpiceCollection(game);
  assert.deepEqual(ordinary.shared, [
    { territory: 'hagga_basin', ecaz: 'e', ally: 'a', amount: 4 },
  ]);
  const before = structuredClone({ game, ordinary });
  const discovery = quoteDiscoveryCollection(game, ordinary);
  assert.deepEqual(discovery.effects, [{
    kind: 'orgiz', player: 'g', from: 'e', location: 'red_chasm:7',
    amount: 1, source: 'player',
  }]);
  assert.equal(balance(discovery, 'e'), 1);
  assert.equal(balance(discovery, 'g'), 1);
  assert.deepEqual({ game, ordinary }, before);
});

void test('two allied Orgiz occupants leave ordinary collection playable without uncertain theft', () => {
  const game = fixture(false, [
    ['e', 'ecaz'], ['a', 'atreides'], ['g', 'guild'],
  ]);
  game.discoveryEnabled = true;
  reveal(game, ORGIZ_PROCESSING_STATION);
  game.players[0].ally = 'a';
  game.players[1].ally = 'e';
  game.players[0].forces = { [`${ORGIZ_PROCESSING_STATION}:0`]: 1 };
  game.players[1].forces = { [`${ORGIZ_PROCESSING_STATION}:0`]: 1 };
  game.players[2].forces = { 'hagga_basin:12': 1 };
  game.players.forEach(player => {
    Object.assign(player, {
      hand: [], traitors: [], traitorChoices: [], shipped: true,
      moved: 1, reserves: 19,
    });
  });
  game.spice = { 'hagga_basin:12': 2 };
  const ordinary = quoteSpiceCollection(game);
  assert.deepEqual(quoteDiscoveryCollection(game, ordinary), {
    receipts: ordinary.receipts, effects: [],
  });
  Object.assign(game, {
    phase: 5, active: 'g', movementRemaining: ['g'], phaseOpening: null,
  });
  const collected = applyAction(game, 'g', { type: 'endMovement' });
  assert.equal(collected.phase, 7);
  assert.deepEqual(collected.players.map(player => player.spice), [0, 0, 2]);
  assert.equal(collected.spice['hagga_basin:12'], 0);
});

void test('a contested Cistern retains the unresolved bonus without blocking collection', () => {
  const game = fixture(false, [
    ['e', 'ecaz'],
    ['a', 'atreides'],
    ['g', 'guild'],
  ]);
  reveal(game, CISTERN);
  game.players[0].ally = 'a';
  game.players[1].ally = 'e';
  game.players[0].forces = { [`${CISTERN}:0`]: 1 };
  game.players[1].forces = { [`${CISTERN}:0`]: 1 };
  const ordinary = quoteSpiceCollection(game);
  const before = structuredClone({ game, ordinary });
  assert.deepEqual(quoteDiscoveryCollection(game, ordinary), {
    receipts: ordinary.receipts,
    effects: [],
  });
  assert.deepEqual({ game, ordinary }, before);
});

void test('the real collection phase credits Cistern once and preserves the receipt through JSON recovery', () => {
  const game = fixture(false);
  game.discoveryEnabled = true;
  reveal(game, CISTERN);
  Object.assign(game, {
    phase: 5,
    active: 'g',
    movementRemaining: ['g'],
    phaseOpening: null,
  });
  for (const player of game.players)
    Object.assign(player, {
      hand: [],
      traitors: [],
      traitorChoices: [],
      shipped: true,
      moved: 1,
      reserves: 20,
    });
  game.players[0].forces = { [`${CISTERN}:0`]: 1 };
  game.players[0].forces['red_chasm:7'] = 1;
  game.players[0].reserves = 18;
  game.players[0].spice = 4;
  game.spice = { 'red_chasm:7': 2 };

  const before = structuredClone(game);
  const ordinary = quoteSpiceCollection(game);
  assert.equal(
    ordinary.receipts.find((receipt) => receipt.player === 'a')!.balance,
    6,
  );
  let collected = applyAction(game, 'g', { type: 'endMovement' });
  assert.deepEqual(game, before);
  assert.equal(collected.phase, 7);
  assert.equal(collected.players.find((player) => player.id === 'a')!.spice, 8);
  assert.equal(collected.spice['red_chasm:7'], 0);
  assert.equal(
    collected.log.filter((entry) =>
      entry.text.includes(
        'received 2 spice from the bank for occupying Cistern',
      ),
    ).length,
    1,
  );

  collected = JSON.parse(JSON.stringify(collected)) as Game;
  assert.deepEqual(normalizeAutomaticGame(collected), collected);
  assert.equal(collected.players.find((player) => player.id === 'a')!.spice, 8);
  assert.equal(
    collected.log.filter((entry) => entry.automatic?.name === 'Cistern').length,
    1,
  );
});

void test('a revealed sole Orgiz occupant steals one from each rival collected deposit in Basic and Advanced', () => {
  for (const advanced of [false, true]) {
    const game = fixture(advanced);
    game.discoveryEnabled = true;
    reveal(game, ORGIZ_PROCESSING_STATION);
    Object.assign(game, {
      phase: 5,
      active: 'g',
      movementRemaining: ['g'],
      phaseOpening: null,
    });
    for (const player of game.players)
      Object.assign(player, {
        hand: [], traitors: [], traitorChoices: [], shipped: true,
        moved: 1, reserves: 20,
      });
    game.players[0].forces = { [`${ORGIZ_PROCESSING_STATION}:0`]: 1, 'red_chasm:7': 1 };
    game.players[0].reserves = 18;
    game.players[1].forces = { 'hagga_basin:12': 1 };
    game.players[1].reserves = 19;
    game.players[2].forces = { 'cielago_south:2': 1 };
    game.players[2].reserves = 19;
    game.spice = { 'red_chasm:7': 2, 'hagga_basin:12': 4, 'cielago_south:2': 3 };

    const before = structuredClone(game);
    const collected = applyAction(game, 'g', { type: 'endMovement' });
    assert.deepEqual(game, before);
    assert.equal(collected.phase, 7);
    assert.deepEqual(collected.players.map(player => player.spice), [4, 1, 1]);
    assert.equal(collected.spice['red_chasm:7'], 0);
    assert.equal(collected.spice['hagga_basin:12'], 2);
    assert.equal(collected.spice['cielago_south:2'], 1);
    assert.equal(
      collected.players.reduce((total, player) => total + player.spice, 0) +
        Object.values(collected.spice).reduce((total, spice) => total + spice, 0),
      9,
    );
    assert.equal(collected.log.filter(entry => entry.automatic?.name === 'Orgiz Processing Station').length, 2);
    const restored = JSON.parse(JSON.stringify(collected)) as Game;
    assert.deepEqual(normalizeAutomaticGame(restored), restored);
    assert.deepEqual(restored.players.map(player => player.spice), [4, 1, 1]);
  }
});

void test('a saved Ecaz response commits Cistern once only after the collection response resolves', () => {
  const game = createGame(
    'DISCOVERYECAZCOLLECTION',
    newPlayer('ec', 'Ecaz', 'ecaz'),
    true,
    ['ecaz'],
  );
  game.players.push(
    newPlayer('al', 'Ally', 'atreides'),
    newPlayer('en', 'Rival', 'emperor'),
  );
  Object.assign(game, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    order: ['ec', 'al', 'en'],
    active: 'en',
    movementRemaining: ['en'],
    phaseOpening: null,
    spice: {},
    deck: baseDeck(),
    discard: [],
    discoveryEnabled: true,
    discoveries: createDiscoveryState(() => 0),
  });
  reveal(game, CISTERN);
  for (const player of game.players)
    Object.assign(player, {
      spice: 10,
      hand: [],
      traitors: [],
      traitorChoices: [],
      forces: {},
      reserves: 20,
      shipped: true,
      moved: 1,
    });
  game.players[0].ally = 'al';
  game.players[1].ally = 'ec';
  game.players[0].allySinceTurn = 1;
  game.players[1].allySinceTurn = 1;
  game.players[0].forces = { 'arrakeen:10': 1 };
  game.players[1].forces = { 'arrakeen:10': 1 };
  game.players[2].forces = { [`${CISTERN}:0`]: 1 };
  for (const player of game.players) player.reserves = 19;
  const karama = game.deck.findIndex((card) => card.name === 'Karama');
  assert.ok(karama >= 0);
  game.players[2].hand.push(game.deck.splice(karama, 1)[0]);

  let collected = applyAction(game, 'en', { type: 'endMovement' });
  assert.equal(collected.response?.kind, 'ecazCollection');
  assert.equal(collected.players[2].spice, 10);
  assert.equal(
    collected.log.filter((entry) => entry.automatic?.name === 'Cistern').length,
    0,
  );

  collected = JSON.parse(JSON.stringify(collected)) as Game;
  for (let count = 0; collected.response && count < 10; count++) {
    const responder = collected.players.find(
      (player) => !collected.response!.passed.includes(player.id),
    )!;
    collected = applyAction(collected, responder.id, { type: 'passResponse' });
  }
  assert.equal(collected.response, null);
  assert.equal(collected.players[2].spice, 12);
  assert.equal(
    collected.log.filter((entry) => entry.automatic?.name === 'Cistern').length,
    1,
  );

  collected = JSON.parse(JSON.stringify(collected)) as Game;
  assert.deepEqual(normalizeAutomaticGame(collected), collected);
  assert.equal(collected.players[2].spice, 12);
  assert.equal(
    collected.log.filter((entry) => entry.automatic?.name === 'Cistern').length,
    1,
  );
});
