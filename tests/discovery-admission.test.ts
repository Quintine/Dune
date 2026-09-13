import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  createDiscoveryState,
  JACURUTU_SIETCH,
  type DiscoveryState,
} from '../game/discoveries';
import {
  quoteGuildAmbassadorShipment,
  GuildAmbassadorShipmentError,
} from '../game/guild-ambassador';
import {
  quoteFremenAmbassadorMove,
  FremenAmbassadorMoveError,
} from '../game/fremen-ambassador';
import {
  quoteJunctionTransport,
  type JunctionTransportContext,
} from '../game/junction-transport';
import {
  quoteGuildHomeworldShipment,
  type GuildHomeworldShipmentContext,
} from '../game/guild-homeworld-shipment';
import {
  HomeworldCustodyError,
  type HomeworldCustody,
} from '../game/homeworld-custody';
import { createRicheseNoField } from '../game/richese-no-field';
import {
  quoteNoFieldCancellation,
  NoFieldCancellationError,
} from '../game/karama-no-field-cancellation';
import { guildTransportQuote } from '../game/transport-quote';

const discoveryKey = `${JACURUTU_SIETCH}:0`;

function discoveries(revealed: boolean): DiscoveryState {
  const state = createDiscoveryState(() => 0);
  const token = state.tokens.find((entry) => entry.face === JACURUTU_SIETCH)!;
  Object.assign(token, {
    status: 'placed',
    territory: 'meridian',
    sector: 1,
    revealedTurn: revealed ? 2 : null,
  });
  return state;
}

function ambassadorGame(): Game {
  const g = createGame(
    'DISCOVERYADMISSION',
    newPlayer('p', 'Beneficiary', 'ecaz'),
    true,
  );
  g.players.push(
    newPlayer('q', 'Other', 'atreides'),
    newPlayer('r', 'Third', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 2,
    phase: 5,
    storm: 18,
    active: 'q',
    order: ['q', 'p', 'r'],
  });
  for (const player of g.players)
    Object.assign(player, { forces: {}, reserves: 20, hand: [] });
  return g;
}

void test('Ambassador shipments and relocations admit a Discovery location only after its public reveal', () => {
  const shipment: Action = {
    type: 'decision',
    event: 'ambassador-event',
    amount: 1,
    territory: JACURUTU_SIETCH,
    sector: 0,
  };
  const hiddenShipment = ambassadorGame();
  hiddenShipment.discoveries = discoveries(false);
  assert.throws(
    () => quoteGuildAmbassadorShipment(hiddenShipment, 'p', shipment),
    GuildAmbassadorShipmentError,
  );
  const publicShipment = ambassadorGame();
  publicShipment.discoveries = discoveries(true);
  assert.equal(
    quoteGuildAmbassadorShipment(publicShipment, 'p', shipment).territory,
    JACURUTU_SIETCH,
  );

  const relocation: Action = {
    type: 'decision',
    event: 'ambassador-event',
    forces: { 'wind_pass:14': 1 },
    territory: JACURUTU_SIETCH,
    sector: 0,
  };
  const hiddenMove = ambassadorGame();
  hiddenMove.players[0].forces = { 'wind_pass:14': 1 };
  hiddenMove.players[0].reserves = 19;
  hiddenMove.discoveries = discoveries(false);
  assert.throws(
    () => quoteFremenAmbassadorMove(hiddenMove, 'p', relocation),
    FremenAmbassadorMoveError,
  );
  const publicMove = ambassadorGame();
  publicMove.players[0].forces = { 'wind_pass:14': 1 };
  publicMove.players[0].reserves = 19;
  publicMove.discoveries = discoveries(true);
  assert.equal(
    quoteFremenAmbassadorMove(publicMove, 'p', relocation).to,
    JACURUTU_SIETCH,
  );
});

function junctionFixture(revealed: boolean): {
  context: JunctionTransportContext;
  custody: HomeworldCustody;
} {
  return {
    context: {
      advanced: true,
      storm: 12,
      discoveries: discoveries(revealed),
      players: [
        {
          id: 'g',
          faction: 'guild',
          reserves: 15,
          eliteReserves: 0,
          ally: null,
        },
        {
          id: 'e',
          faction: 'emperor',
          reserves: 12,
          eliteReserves: 3,
          ally: null,
        },
        {
          id: 'a',
          faction: 'atreides',
          reserves: 20,
          eliteReserves: 0,
          ally: null,
        },
      ],
      board: {
        e: {
          forces: { 'false_wall_south:4': 3 },
          eliteForces: { 'false_wall_south:4': 1 },
        },
      },
    },
    custody: {
      visitors: { 'homeworld:atreides': { e: { normal: 2, elite: 1 } } },
      salusa: { normal: 0, elite: 3 },
    },
  };
}

void test('Junction rejects a forged hidden Discovery destination and accepts its public projection', () => {
  const intent = {
    player: 'e',
    sponsor: 'g',
    destination: discoveryKey,
    rate: 'half' as const,
    sources: { 'false_wall_south:4': { normal: 2, elite: 1 } },
  };
  const hidden = junctionFixture(false);
  assert.throws(
    () => quoteJunctionTransport(hidden.context, hidden.custody, intent),
    HomeworldCustodyError,
  );
  const revealed = junctionFixture(true);
  assert.equal(
    quoteJunctionTransport(revealed.context, revealed.custody, intent)
      .destinationKind,
    'arrakis',
  );
});

function guildFixture(revealed: boolean): {
  context: GuildHomeworldShipmentContext;
  custody: HomeworldCustody;
} {
  return {
    context: {
      advanced: true,
      storm: 12,
      discoveries: discoveries(revealed),
      players: [
        {
          id: 'g',
          faction: 'guild',
          reserves: 13,
          eliteReserves: 0,
          ally: null,
        },
        {
          id: 'a',
          faction: 'atreides',
          reserves: 20,
          eliteReserves: 0,
          ally: null,
        },
      ],
      board: {
        g: {
          forces: { [discoveryKey]: 5 },
          eliteForces: {},
        },
      },
    },
    custody: {
      visitors: { 'homeworld:atreides': {} },
      salusa: null,
    },
  };
}

void test('Guild Homeworld transport rejects hidden-location custody and accepts the revealed source', () => {
  const intent = {
    player: 'g',
    destination: 'homeworld:atreides',
    sources: { [discoveryKey]: { normal: 2, elite: 0 } },
  };
  const hidden = guildFixture(false);
  assert.throws(
    () => quoteGuildHomeworldShipment(hidden.context, hidden.custody, intent),
    HomeworldCustodyError,
  );
  const revealed = guildFixture(true);
  assert.equal(
    quoteGuildHomeworldShipment(revealed.context, revealed.custody, intent)
      .origin,
    JACURUTU_SIETCH,
  );
});

void test('Guild transport preview uses the projected public reveal when validating its destination', () => {
  function preview(revealed: boolean) {
    const g = ambassadorGame();
    g.players[0].faction = 'guild';
    g.active = 'p';
    g.players[0].spice = 20;
    g.players[0].forces = { 'imperial_basin:10': 1 };
    g.players[0].reserves = 19;
    g.discoveryEnabled = true;
    g.discoveries = discoveries(revealed);
    return guildTransportQuote(viewGame(g, 'p'), {
      type: 'guildShip',
      from: 'imperial_basin:10',
      amount: 1,
      territory: JACURUTU_SIETCH,
      sector: 0,
    });
  }
  assert.ok(
    preview(false).unavailableReasons.includes(
      'Choose a sector belonging to the destination.',
    ),
  );
  assert.ok(
    !preview(true).unavailableReasons.includes(
      'Choose a sector belonging to the destination.',
    ),
  );
});

void test('No-Field cancellation cannot authenticate a declaration into an unrevealed Discovery location', () => {
  function declaration(revealed: boolean) {
    const g = createGame(
      'DISCOVERYNOFIELD',
      newPlayer('r', 'Richese', 'richese'),
      true,
    );
    Object.assign(g, {
      status: 'playing',
      phase: 5,
      turn: 2,
      active: 'r',
      discoveries: discoveries(revealed),
      pendingShipment: {
        turn: 2,
        player: 'r',
        territory: JACURUTU_SIETCH,
        sector: 0,
        amount: 1,
        elite: 0,
        cost: 0,
        allyPayment: 0,
        advisors: false,
        noField: { tokenId: 'opaque-zero', event: 'selection-2' },
      },
      response: { kind: 'richeseNoField', owner: 'r', passed: [] },
    });
    g.players[0].noField = createRicheseNoField([
      'opaque-zero',
      'opaque-three',
      'opaque-five',
    ]);
    g.players[0].noFieldEvent = 'selection-2';
    return g;
  }
  const hidden = declaration(false);
  assert.throws(
    () => quoteNoFieldCancellation(hidden, hidden.response!),
    NoFieldCancellationError,
  );
  const revealed = declaration(true);
  assert.deepEqual(quoteNoFieldCancellation(revealed, revealed.response!), {
    kind: 'own',
    player: 'r',
    blockedTurn: 2,
    pendingShipment: null,
  });
});
