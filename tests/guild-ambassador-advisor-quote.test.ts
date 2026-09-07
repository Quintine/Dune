import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Action, type Game } from '../game/engine';
import {
  quoteGuildAmbassadorAdvisor,
  quoteGuildAmbassadorShipment,
  GuildAmbassadorShipmentError,
  type GuildAmbassadorShipment,
} from '../game/guild-ambassador';

function fixture(advanced = true) {
  const g = createGame(
    'GUILD-ADVISOR',
    newPlayer('b', 'BG', 'beneGesserit'),
    advanced,
  );
  g.players.push(
    newPlayer('p', 'Ixians', 'ixians'),
    newPlayer('e', 'Ecaz', 'ecaz'),
    newPlayer('m', 'Moritani', 'moritani'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'm',
  });
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    if (p.elites) p.elites.forces = {};
  }
  g.players[1].forces = { 'hagga_basin:12': 2 };
  g.players[1].reserves = 18;
  const shipment: GuildAmbassadorShipment = {
    player: 'p',
    amount: 2,
    elite: 0,
    territory: 'hagga_basin',
    sector: 12,
    advisors: false,
    cost: 0,
    allyPayment: 0,
  };
  return { g, shipment };
}
const quote = (
  g: Game,
  s: GuildAmbassadorShipment,
  action: Partial<Action> = {},
) => quoteGuildAmbassadorAdvisor(g, 'b', s, { type: 'decision', ...action });

void test('advanced accompaniment uses the exact shipment territory with its original or selected sector', () => {
  const { g, shipment } = fixture();
  const before = JSON.stringify({ g, shipment });
  assert.deepEqual(quote(g, shipment, { accompany: true }), {
    player: 'b',
    territory: 'hagga_basin',
    sector: 12,
    amount: 1,
    elite: 0,
    advisors: true,
  });
  assert.equal(quote(g, shipment, { accompany: true, sector: 13 }).sector, 13);
  assert.equal(JSON.stringify({ g, shipment }), before);
});

void test('Basic accompaniment request and explicit non-accompaniment both grant Polar Sink only', () => {
  for (const advanced of [false, true]) {
    const { g, shipment } = fixture(advanced);
    for (const accompany of advanced
      ? [false, undefined]
      : [true, false, undefined])
      assert.deepEqual(quote(g, shipment, { accompany }), {
        player: 'b',
        territory: 'polar_sink',
        sector: 0,
        amount: 1,
        elite: 0,
        advisors: false,
      });
  }
});

void test('BG may accompany an Ixian HMS shipment but gains no direct HMS shipment entitlement', () => {
  const { g, shipment } = fixture();
  g.mobileStronghold = { location: 'hagga_basin:12' };
  Object.assign(shipment, { territory: 'hidden_mobile_stronghold', sector: 0 });
  g.players[1].forces = { 'hidden_mobile_stronghold:0': 2 };
  assert.deepEqual(quote(g, shipment, { accompany: true }), {
    player: 'b',
    territory: 'hidden_mobile_stronghold',
    sector: 0,
    amount: 1,
    elite: 0,
    advisors: true,
  });
  assert.throws(
    () =>
      quoteGuildAmbassadorShipment(g, 'b', {
        type: 'decision',
        territory: 'hidden_mobile_stronghold',
        sector: 0,
        amount: 1,
      }),
    GuildAmbassadorShipmentError,
  );
  g.players[1].faction = 'guild';
  assert.throws(
    () => quote(g, shipment, { accompany: true }),
    GuildAmbassadorShipmentError,
  );
});

void test('historical primary losses, changed alliances and reserves do not invalidate the BG quote', () => {
  const { g, shipment } = fixture();
  g.phase = 1;
  g.active = null;
  g.players[1].forces = {};
  g.players[1].reserves = 0;
  g.players[1].tanks = 20;
  g.players[1].ally = 'm';
  g.players[3].ally = 'p';
  const result = quote(g, shipment, { accompany: true });
  assert.equal(result.advisors, false); // Empty territory converts stance normally.
  assert.equal(result.amount, 1);
  assert.equal(result.territory, 'hagga_basin');
});

void test('current advisor/fighter stance and Ecaz shared occupation determine capacity without looking at cards', () => {
  const { g, shipment } = fixture();
  Object.assign(shipment, { territory: 'carthag', sector: 11 });
  g.players[1].forces = { 'carthag:11': 2 };
  g.players[3].forces = { 'carthag:11': 1 };
  assert.equal(quote(g, shipment, { accompany: true }).advisors, true);
  g.players[0].forces = { 'carthag:11': 1 }; // Existing fighters remain fighters.
  assert.throws(
    () => quote(g, shipment, { accompany: true }),
    GuildAmbassadorShipmentError,
  );
  g.players[0].advisors = { carthag: {} };
  assert.equal(quote(g, shipment, { accompany: true }).advisors, true);
  delete g.players[0].advisors;
  g.players[3].forces = {};
  g.players[2].forces = { 'carthag:11': 1 };
  g.players[0].ally = 'e';
  g.players[2].ally = 'b';
  assert.equal(quote(g, shipment, { accompany: true }).advisors, false);
});

void test('invalid BG/source identity and forged shipment shape reject without mutation', () => {
  const changes: ((g: Game, s: GuildAmbassadorShipment) => void)[] = [
    (g) => {
      g.players[0].faction = 'emperor';
    },
    (_, s) => {
      s.player = 'b';
    },
    (_, s) => {
      s.player = 'missing';
    },
    (g) => {
      g.players[1].faction = 'fremen';
    },
    (_, s) => {
      s.amount = 0;
    },
    (_, s) => {
      s.amount = 5;
    },
    (_, s) => {
      s.elite = 3;
    },
    (_, s) => {
      Object.assign(s, { cost: 1 });
    },
    (_, s) => {
      Object.assign(s, { allyPayment: 1 });
    },
    (_, s) => {
      Object.assign(s, { noField: { tokenId: 'hidden' } });
    },
  ];
  for (const change of changes) {
    const { g, shipment } = fixture();
    change(g, shipment);
    const before = JSON.stringify({ g, shipment });
    assert.throws(
      () => quote(g, shipment, { accompany: true }),
      GuildAmbassadorShipmentError,
    );
    assert.equal(JSON.stringify({ g, shipment }), before);
  }
});

void test('selection is exactly one ordinary force and cannot forge destination, marker or option types', () => {
  const { g, shipment } = fixture();
  const actions: Partial<Action>[] = [
    { accompany: 'yes' },
    { accompany: null },
    { sector: '13' },
    { sector: null },
    { sector: -1 },
    { sector: 1.5 },
    { sector: 19 },
    { accompany: true, sector: 11 },
    { accompany: true, territory: 'arrakeen' },
    { amount: 2 },
    { elite: 1 },
    { noField: {} },
    { alliedNoField: {} },
  ];
  const before = JSON.stringify(g);
  for (const action of actions)
    assert.throws(
      () => quote(g, shipment, action),
      GuildAmbassadorShipmentError,
    );
  assert.equal(JSON.stringify(g), before);
});

void test('current reserves, storm, HMS availability and safe resulting force arithmetic are revalidated', () => {
  const changes: ((g: Game, s: GuildAmbassadorShipment) => void)[] = [
    (g) => {
      g.players[0].reserves = 0;
    },
    (g) => {
      g.players[0].reserves = -1;
    },
    (g) => {
      g.storm = 12;
    },
    (g, s) => {
      Object.assign(s, { territory: 'hidden_mobile_stronghold', sector: 0 });
      g.mobileStronghold = { location: null };
    },
    (g) => {
      g.players[0].forces = { 'hagga_basin:12': Number.MAX_SAFE_INTEGER };
    },
  ];
  for (const change of changes) {
    const { g, shipment } = fixture();
    change(g, shipment);
    assert.throws(
      () => quote(g, shipment, { accompany: true }),
      GuildAmbassadorShipmentError,
    );
  }
});

void test('repeated JSON quotes do not use private cards, spice or randomness', () => {
  const { g, shipment } = fixture();
  const expected = quote(g, shipment, { accompany: true });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 0;
    p.traitors = [];
  }
  const before = JSON.stringify({ g, shipment });
  const random = Math.random;
  Math.random = () => {
    throw new Error('Unexpected randomness');
  };
  try {
    for (let i = 0; i < 5; i++)
      assert.deepEqual(
        quote(
          JSON.parse(JSON.stringify(g)),
          JSON.parse(JSON.stringify(shipment)),
          { accompany: true },
        ),
        expected,
      );
  } finally {
    Math.random = random;
  }
  assert.equal(JSON.stringify({ g, shipment }), before);
});
