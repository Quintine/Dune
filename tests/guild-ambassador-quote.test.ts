import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game, type Action } from '../game/engine';
import { FACTIONS, type FactionId } from '../game/catalog';
import { MOBILE_STRONGHOLD, MOBILE_LOCATION, TERRITORIES } from '../game/board';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import {
  quoteGuildAmbassadorShipment as quote,
  guildAmbassadorShipments as domain,
  GuildAmbassadorShipmentError,
} from '../game/guild-ambassador';

function fixture(faction: FactionId = 'ecaz', advanced = true) {
  const g = createGame(
    'GUILDAMBQUOTE',
    newPlayer('p', 'Beneficiary', faction),
    advanced,
  );
  const others = FACTIONS.filter((f) => f.id !== faction);
  g.players.push(
    newPlayer('q', 'Other', others[0].id),
    newPlayer('r', 'Third', others[1].id),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 2,
    phase: 1,
    storm: 18,
    active: 'q',
    order: ['q', 'p', 'r'],
    movementRemaining: ['q', 'r'],
  });
  for (const p of g.players)
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      hand: [],
      spice: 0,
      elites: undefined,
    });
  return g;
}
const ship = (extra: Partial<Action> = {}): Action => ({
  type: 'decision',
  event: 'ambassador-event',
  amount: 4,
  territory: 'sietch_tabr',
  sector: 14,
  ...extra,
});
function rejected(g: Game, action: Action) {
  const before = structuredClone(g),
    a = structuredClone(action);
  assert.throws(() => quote(g, 'p', action), GuildAmbassadorShipmentError);
  assert.deepEqual(g, before);
  assert.deepEqual(action, a);
}
function marker(g: Game, owner: number, value: 0 | 3 | 5) {
  const p = g.players[owner];
  p.faction = 'richese';
  p.noField = deployRicheseNoField(createRicheseNoField(['n0', 'n3', 'n5']), {
    tokenId: `n${value}`,
    controller: p.id,
    location: { territory: 'sietch_tabr', sector: 14 },
  });
  p.noFieldEvent = 'marker-event';
}

void test('all twelve beneficiaries receive the same independent free physical reserve grant in Basic and Advanced', () => {
  for (const faction of FACTIONS)
    for (const advanced of [false, true]) {
      const g = fixture(faction.id, advanced);
      g.players[0].shipped = true;
      g.players[0].moved = 2;
      g.hajr = ['p'];
      g.aid = {};
      const before = structuredClone(g),
        a = ship(),
        beforeAction = structuredClone(a);
      assert.deepEqual(quote(g, 'p', a), {
        player: 'p',
        amount: 4,
        elite: 0,
        territory: 'sietch_tabr',
        sector: 14,
        advisors: false,
        cost: 0,
        allyPayment: 0,
      });
      assert.deepEqual(g, before);
      assert.deepEqual(a, beforeAction);
      assert.equal(domain(g, 'p').maximum, 4);
      g.phase = 5;
      assert.deepEqual(quote(g, 'p', a), quote(before, 'p', a));
    }
});
void test('reserve bounds admit one through four actual forces and zero reserves yield no destinations', () => {
  for (const reserves of [0, 1, 2, 3, 4, 20]) {
    const g = fixture();
    g.players[0].reserves = reserves;
    const d = domain(g, 'p');
    assert.equal(d.maximum, Math.min(reserves, 4));
    assert.equal(d.destinations.length === 0, reserves === 0);
    for (let n = 1; n <= Math.min(4, reserves); n++)
      assert.equal(quote(g, 'p', ship({ amount: n })).amount, n);
    rejected(g, ship({ amount: Math.min(4, reserves) + 1 }));
  }
  for (const amount of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '2',
    null,
    undefined,
  ])
    rejected(fixture(), ship({ amount }));
});
void test('typed reserve allocation selects the minimum required elites without adding them to physical amount', () => {
  for (const faction of ['fremen', 'emperor', 'ixians'] as const) {
    const g = fixture(faction);
    g.players[0].reserves = 4;
    g.players[0].elites = { reserves: 3, tanks: 0, revived: 0, forces: {} };
    assert.equal(quote(g, 'p', ship({ amount: 3 })).elite, 2);
    assert.equal(quote(g, 'p', ship({ amount: 3, elite: 3 })).elite, 3);
    assert.equal(quote(g, 'p', ship({ amount: 1 })).elite, 0);
    assert.equal(quote(g, 'p', ship({ amount: 4 })).elite, 3);
    for (const elite of [-1, 0, 1, 4, 1.5, NaN, Infinity, null, '2'])
      rejected(g, ship({ amount: 3, elite }));
    assert.equal(domain(g, 'p').eliteReserves, 3);
  }
  rejected(fixture(), ship({ elite: 1 }));
});
void test('storm blocks the chosen sector even for Fremen while other sectors in the territory remain usable', () => {
  const g = fixture('fremen');
  g.storm = 14;
  rejected(g, ship());
  assert.equal(
    quote(g, 'p', ship({ territory: 'wind_pass', sector: 15 })).cost,
    0,
  );
  rejected(g, ship({ territory: 'wind_pass', sector: 14 }));
  assert.ok(domain(g, 'p').destinations.every((d) => d.sector !== 14));
  assert.ok(
    domain(g, 'p').destinations.some(
      (d) => d.territory === 'wind_pass' && d.sector === 15,
    ),
  );
  for (const destination of [
    { territory: 'sietch_tabr', sector: 15 },
    { territory: 'homeworld', sector: 0 },
    { territory: 'discovery', sector: 0 },
    { territory: 'missing', sector: 2 },
  ])
    rejected(g, ship(destination));
});
void test('only Ixians can ship directly into a placed canonical mobile stronghold', () => {
  for (const faction of FACTIONS) {
    const g = fixture(faction.id);
    g.mobileStronghold = { location: 'wind_pass:14' };
    g.storm = 14;
    const a = ship({ territory: MOBILE_STRONGHOLD, sector: 0 });
    if (faction.id === 'ixians') {
      assert.equal(quote(g, 'p', a).territory, MOBILE_STRONGHOLD);
      assert.ok(
        domain(g, 'p').destinations.some(
          (d) => d.territory === MOBILE_STRONGHOLD,
        ),
      );
    } else {
      rejected(g, a);
      assert.ok(
        !domain(g, 'p').destinations.some(
          (d) => d.territory === MOBILE_STRONGHOLD,
        ),
      );
    }
  }
  const g = fixture('ixians');
  rejected(g, ship({ territory: MOBILE_STRONGHOLD, sector: 0 }));
  for (const pointer of [
    'wind_pass',
    MOBILE_LOCATION,
    'wind_pass:1',
    'unknown:0',
  ]) {
    g.mobileStronghold = { location: pointer };
    assert.throws(() => domain(g, 'p'), GuildAmbassadorShipmentError);
  }
});
void test('reciprocal Ecaz co-occupation counts one stronghold side in both beneficiary orientations', () => {
  for (const ecazBeneficiary of [false, true]) {
    const g = fixture(ecazBeneficiary ? 'ecaz' : 'fremen');
    g.players[1].faction = ecazBeneficiary ? 'fremen' : 'ecaz';
    g.players[0].ally = 'q';
    g.players[1].ally = 'p';
    g.players[1].forces = { 'sietch_tabr:14': 2 };
    g.players[2].forces = { 'sietch_tabr:14': 2 };
    assert.equal(quote(g, 'p', ship()).advisors, false);
    g.players[1].ally = null;
    rejected(g, ship());
  }
  const g = fixture('ecaz');
  g.players[1].forces = { 'sietch_tabr:14': 1 };
  g.players[2].forces = { 'sietch_tabr:14': 1 };
  rejected(g, ship());
});
void test('ordinary non-Ecaz alliance exclusion and Polar Sink exemption remain intact', () => {
  const g = fixture('fremen');
  g.players[0].ally = 'q';
  g.players[1].ally = 'p';
  g.players[1].forces = { 'red_chasm:7': 1, 'polar_sink:0': 1 };
  rejected(g, ship({ territory: 'red_chasm', sector: 7 }));
  assert.equal(
    quote(g, 'p', ship({ territory: 'polar_sink', sector: 0 })).advisors,
    false,
  );
});
void test('direct BG reserve shipment joins own advisors but otherwise arrives as fighters with no new stance choice', () => {
  const g = fixture('beneGesserit');
  g.players[1].forces = { 'sietch_tabr:14': 1 };
  assert.equal(quote(g, 'p', ship()).advisors, false);
  g.players[0].forces = { 'sietch_tabr:14': 1 };
  g.players[0].reserves = 19;
  g.players[0].advisors = { sietch_tabr: { lockedTurn: g.turn } };
  g.players[2].forces = { 'sietch_tabr:14': 1 };
  assert.equal(quote(g, 'p', ship()).advisors, true);
  assert.ok(
    domain(g, 'p').destinations.find((d) => d.territory === 'sietch_tabr')
      ?.advisors,
  );
  const basic = structuredClone(g);
  basic.advanced = false;
  rejected(basic, ship());
  delete g.players[0].forces['sietch_tabr:14'];
  rejected(g, ship());
});
void test('opponent No-Fields count one occupying faction without reading hidden denomination', () => {
  const outputs = [];
  for (const value of [0, 3, 5] as const) {
    const g = fixture('ecaz');
    marker(g, 1, value);
    g.players[2].forces = { 'sietch_tabr:14': 1 };
    rejected(g, ship());
    outputs.push(domain(g, 'p'));
  }
  assert.deepEqual(outputs[0], outputs[1]);
  assert.deepEqual(outputs[1], outputs[2]);
  for (const field of ['noField', 'alliedNoField'])
    for (const value of [true, false, null, 'token', {}])
      rejected(fixture('richese'), ship({ [field]: value }));
});
void test('private hands balances token identity and random sources are never consulted by quote or domain', () => {
  const g = fixture('ecaz');
  marker(g, 1, 3);
  const expected = domain(g, 'p'),
    expectedQuote = quote(g, 'p', ship({ territory: 'red_chasm', sector: 7 }));
  for (const player of g.players) {
    for (const key of ['hand', 'spice', 'traitors', 'traitorChoices'])
      Object.defineProperty(player, key, {
        get() {
          throw new Error(`private ${key}`);
        },
      });
  }
  const markerState = g.players[1].noField!;
  Object.defineProperty(markerState, 'tokens', {
    get() {
      throw new Error('private token inventory');
    },
  });
  for (const key of ['value', 'tokenId', 'controller'])
    Object.defineProperty(markerState.deployed!, key, {
      get() {
        throw new Error(`private marker ${key}`);
      },
    });
  for (const key of ['deck', 'discard', 'aid'])
    Object.defineProperty(g, key, {
      get() {
        throw new Error(`unneeded ${key}`);
      },
    });
  const random = Math.random;
  Math.random = () => {
    throw new Error('unexpected RNG');
  };
  try {
    assert.deepEqual(domain(g, 'p'), expected);
    assert.deepEqual(
      quote(g, 'p', ship({ territory: 'red_chasm', sector: 7 })),
      expectedQuote,
    );
  } finally {
    Math.random = random;
  }
});
void test('safe physical inventories and resulting totals reject malformed saved custody atomically', () => {
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      g.players[0].reserves = -1;
    },
    (g) => {
      g.players[0].reserves = NaN;
    },
    (g) => {
      g.players[0].elites = { reserves: 21, tanks: 0, revived: 0, forces: {} };
    },
    (g) => {
      g.players[1].forces = { 'unknown:0': 1 };
    },
    (g) => {
      g.players[1].forces = { 'wind_pass:14': -1 };
    },
    (g) => {
      g.players[1].elites = {
        reserves: 0,
        tanks: 0,
        revived: 0,
        forces: { 'wind_pass:14': 1 },
      };
    },
    (g) => {
      g.players[0].forces = { 'sietch_tabr:14': Number.MAX_SAFE_INTEGER };
    },
    (g) => {
      g.players[1].forces = {
        'wind_pass:14': Number.MAX_SAFE_INTEGER,
        'wind_pass:15': 1,
      };
    },
    (g) => {
      g.players[1].id = 'p';
    },
    (g) => {
      g.storm = 19;
    },
  ];
  for (const mutate of mutations) {
    const g = fixture();
    mutate(g);
    rejected(g, ship());
  }
});
void test('the finite domain has no duplicate destinations and every listed physical amount has an actual quote witness', () => {
  for (const faction of FACTIONS) {
    const g = fixture(faction.id);
    const d = domain(g, 'p');
    const before = structuredClone(g);
    assert.equal(
      new Set(d.destinations.map((t) => `${t.territory}:${t.sector}`)).size,
      d.destinations.length,
    );
    for (const destination of d.destinations)
      for (let amount = 1; amount <= d.maximum; amount++) {
        const result = quote(g, 'p', ship({ ...destination, amount }));
        assert.equal(result.advisors, destination.advisors);
        assert.equal(result.amount, amount);
      }
    assert.deepEqual(g, before);
    assert.ok(
      d.destinations.length <= TERRITORIES.flatMap((t) => t.sectors).length,
    );
    d.destinations.length = 0;
    assert.ok(domain(g, 'p').destinations.length > 0);
  }
});
