import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISCOVERY_LOCATION_IDS,
  JACURUTU_SIETCH,
  type DiscoveryLocationId,
} from '../game/discoveries';
import {
  MOBILE_LOCATION,
  TERRITORIES,
  distance,
  gameDistance,
  gameTerritories,
  location,
  territory,
  validGameLocation,
  validLocation,
  type MobileBoard,
} from '../game/board';
import {
  BoardResolutionError,
  quoteBattleBoard,
  type BoardContext,
} from '../game/board-resolution-quote';
import { territoryEntryBlock } from '../game/occupancy';
import { strongholdProgress } from '../game/victory-progress';
import { quoteVictory, type VictoryContext } from '../game/victory-quote';

const INSIDE_JACURUTU = location(JACURUTU_SIETCH, 0);

function boardWithLocation(
  face: DiscoveryLocationId | null = JACURUTU_SIETCH,
  revealedTurn: number | null = 2,
  parent = 'meridian',
  sector = 1,
): MobileBoard {
  return {
    discoveries: {
      tokens: [
        {
          face,
          status: 'placed',
          territory: parent,
          sector,
          revealedTurn,
        },
      ],
    },
  };
}

void test('all five location identities are static board addresses without mutating the printed territory list', () => {
  const printed = TERRITORIES.length;
  for (const id of DISCOVERY_LOCATION_IDS) {
    assert.equal(territory(id).id, id);
    assert.equal(territory(id).type, 'stronghold');
    assert.deepEqual(territory(id).sectors, [0]);
    assert.equal(validLocation(id, 0), true);
    assert.equal(validLocation(id, 1), false);
    assert.equal(
      TERRITORIES.some((entry) => entry.id === id),
      false,
    );
  }
  assert.equal(TERRITORIES.length, printed);
});

void test('only publicly revealed placed locations join a room board', () => {
  const hidden = boardWithLocation(JACURUTU_SIETCH, null);
  Object.defineProperty(hidden.discoveries!.tokens[0], 'known', {
    get() {
      throw new Error('Private Discovery knowledge was read.');
    },
  });
  assert.equal(
    gameTerritories(hidden).some((t) => t.id === JACURUTU_SIETCH),
    false,
  );
  assert.equal(validGameLocation(hidden, JACURUTU_SIETCH, 0), false);

  const redacted = boardWithLocation(null, 2);
  assert.equal(
    gameTerritories(redacted).some((t) => t.id === JACURUTU_SIETCH),
    false,
  );

  const revealed = boardWithLocation();
  assert.equal(
    gameTerritories(revealed).some((t) => t.id === JACURUTU_SIETCH),
    true,
  );
  assert.equal(validGameLocation(revealed, JACURUTU_SIETCH, 0), true);
  assert.equal(
    TERRITORIES.some((t) => t.id === JACURUTU_SIETCH),
    false,
  );
});

void test('a revealed location is one extra territory from every sector of its parent and remains a dead end', () => {
  const g = boardWithLocation();
  assert.equal(gameDistance(g, 'meridian:1', INSIDE_JACURUTU), 1);
  assert.equal(gameDistance(g, 'meridian:2', INSIDE_JACURUTU), 1);
  assert.equal(gameDistance(g, INSIDE_JACURUTU, 'meridian:1'), 1);
  assert.equal(gameDistance(g, INSIDE_JACURUTU, INSIDE_JACURUTU), 0);

  const outside = 'polar_sink:0';
  const throughParent = Math.min(
    distance(outside, 'meridian:1'),
    distance(outside, 'meridian:2'),
  );
  assert.equal(gameDistance(g, outside, INSIDE_JACURUTU), throughParent + 1);
  assert.equal(gameDistance(g, INSIDE_JACURUTU, outside), throughParent + 1);
  assert.equal(
    gameDistance(
      boardWithLocation(JACURUTU_SIETCH, null),
      INSIDE_JACURUTU,
      INSIDE_JACURUTU,
    ),
    Infinity,
  );
});

void test('storm obstruction applies outside a Discovery endpoint and existing mobile routes compose with it', () => {
  const g = {
    ...boardWithLocation(),
    mobileStronghold: { location: 'polar_sink:0' },
  };
  const stormOne = (key: string) => key.endsWith(':1');
  assert.equal(
    gameDistance(g, 'meridian:1', INSIDE_JACURUTU, stormOne),
    Infinity,
  );
  assert.equal(gameDistance(g, 'meridian:2', INSIDE_JACURUTU, stormOne), 1);
  assert.equal(gameDistance(g, INSIDE_JACURUTU, 'meridian:2', stormOne), 1);
  assert.equal(
    gameDistance(g, INSIDE_JACURUTU, INSIDE_JACURUTU, () => true),
    0,
  );
  assert.equal(
    gameDistance(g, MOBILE_LOCATION, INSIDE_JACURUTU),
    2 +
      Math.min(
        distance('polar_sink:0', 'meridian:1'),
        distance('polar_sink:0', 'meridian:2'),
      ),
  );
});

function battleBoard(revealedTurn: number | null): BoardContext {
  return {
    ...boardWithLocation(JACURUTU_SIETCH, revealedTurn),
    advanced: false,
    storm: 18,
    order: ['a', 'e'],
    players: [
      {
        id: 'a',
        faction: 'atreides',
        ally: null,
        forces: { [INSIDE_JACURUTU]: 1 },
      },
      {
        id: 'e',
        faction: 'emperor',
        ally: null,
        forces: { [INSIDE_JACURUTU]: 1 },
      },
    ],
  };
}

void test('public board resolution accepts revealed forces, rejects hidden-location forces and reuses stronghold occupancy', () => {
  assert.deepEqual(quoteBattleBoard(battleBoard(2)).battles, [
    { territory: JACURUTU_SIETCH, attacker: 'a', defender: 'e' },
  ]);
  assert.throws(
    () => quoteBattleBoard(battleBoard(null)),
    BoardResolutionError,
  );
  const nestedPointer = battleBoard(2);
  nestedPointer.mobileStronghold = { location: INSIDE_JACURUTU };
  assert.throws(() => quoteBattleBoard(nestedPointer), BoardResolutionError);

  const players = [
    {
      id: 'a',
      faction: 'atreides' as const,
      ally: null,
      forces: { [INSIDE_JACURUTU]: 1 },
    },
    {
      id: 'e',
      faction: 'emperor' as const,
      ally: null,
      forces: { [INSIDE_JACURUTU]: 1 },
    },
    { id: 'h', faction: 'harkonnen' as const, ally: null, forces: {} },
  ];
  assert.match(
    territoryEntryBlock(players, 'h', JACURUTU_SIETCH) ?? '',
    /three occupying factions/,
  );
});

type ProgressContext = Parameters<typeof strongholdProgress>[0];
function progressWith(face: DiscoveryLocationId): ProgressContext {
  const parent =
    face === 'orgiz-processing-station' ? 'plastic_basin' : 'meridian';
  const sector = face === 'orgiz-processing-station' ? 13 : 1;
  return {
    ...boardWithLocation(face, 2, parent, sector),
    advanced: false,
    storm: 18,
    order: ['a', 'e', 'h'],
    players: [
      {
        id: 'a',
        faction: 'atreides',
        ally: null,
        forces: {
          'arrakeen:10': 1,
          'carthag:11': 1,
          [location(face, 0)]: 1,
        },
      },
      { id: 'e', faction: 'emperor', ally: null, forces: {} },
      { id: 'h', faction: 'harkonnen', ally: null, forces: {} },
    ],
  };
}

void test('Jacurutu alone counts as a Discovery stronghold for normal and Ecaz victory progress', () => {
  for (const id of DISCOVERY_LOCATION_IDS) {
    const ordinary = progressWith(id);
    const row = strongholdProgress(ordinary).progress[0];
    assert.equal(row.strongholds.includes(id), id === JACURUTU_SIETCH, id);
    assert.equal(row.qualifies, id === JACURUTU_SIETCH, id);

    const ecaz = progressWith(id);
    ecaz.players[0].faction = 'ecaz';
    ecaz.players[0].ally = 'e';
    ecaz.players[1].ally = 'a';
    ecaz.players[1].forces = { ...ecaz.players[0].forces };
    const joint = strongholdProgress(ecaz).progress[0];
    assert.equal(
      joint.jointlyOccupied.includes(id),
      id === JACURUTU_SIETCH,
      id,
    );
    assert.equal(joint.qualifies, id === JACURUTU_SIETCH, id);
  }
});

function finalTurnWith(face: DiscoveryLocationId): VictoryContext {
  const progress = progressWith(face);
  progress.order = ['a', 'e'];
  progress.players = progress.players.slice(0, 2);
  progress.players[1].forces = {
    'sietch_tabr:14': 1,
    'tueks_sietch:5': 1,
  };
  return {
    ...progress,
    turn: 10,
    phase: 8,
    status: 'playing',
    winner: [],
    techTokens: null,
    strongholdCards: null,
  };
}

void test('final-turn hold scoring includes Jacurutu and excludes the other four locations', () => {
  assert.deepEqual(quoteVictory(finalTurnWith('cistern')).winner, ['a', 'e']);
  assert.deepEqual(quoteVictory(finalTurnWith(JACURUTU_SIETCH)).winner, ['a']);
});
