import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Action, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import {
  quoteFremenAmbassadorMove as quote,
  fremenAmbassadorMovement as domain,
  FremenAmbassadorMoveError,
} from '../game/fremen-ambassador';
import { location, MOBILE_STRONGHOLD } from '../game/board';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';

function fixture(faction: FactionId = 'ecaz', advanced = false) {
  const g = createGame(
    'FREMAMBQUOTE',
    newPlayer('p', 'Beneficiary', faction),
    advanced,
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
    order: ['q', 'p', 'r'],
    active: 'q',
  });
  for (const p of g.players)
    Object.assign(p, { forces: {}, elites: undefined, hand: [], reserves: 20 });
  g.players[0].forces = { 'wind_pass:14': 4, 'wind_pass:15': 3 };
  return g;
}
function move(extra: Partial<Action> = {}): Action {
  return {
    type: 'decision',
    event: 'ambassador-event',
    forces: { 'wind_pass:14': 2 },
    territory: 'red_chasm',
    sector: 7,
    ...extra,
  };
}
function rejects(g: Game, a: Action, reason?: RegExp) {
  const before = structuredClone(g);
  assert.throws(() => quote(g, 'p', a), reason ?? FremenAmbassadorMoveError);
  assert.deepEqual(g, before);
}
function destination(g: Game, from: string, to: string, sector: number) {
  return domain(g, 'p')
    .sources.find((s) => s.territory === from)
    ?.destinations.find((d) => d.territory === to && d.sector === sector);
}
function marker(
  g: Game,
  value: 0 | 3 | 5 = 0,
  from = 'wind_pass',
  sector = 14,
) {
  const state = createRicheseNoField(['nf0', 'nf3', 'nf5']);
  const tokenId = state.tokens.find((t) => t.value === value)!.id;
  g.players[0].noField = deployRicheseNoField(state, {
    tokenId,
    controller: 'p',
    location: { territory: from, sector },
  });
  g.players[0].noFieldEvent = 'marker-event';
  return { tokenId, event: 'marker-event' };
}
void test('direct multi-sector relocation preserves all ordinary controls and typed force totals', () => {
  const g = fixture('ixians', true);
  g.players[0].elites = {
    reserves: 3,
    tanks: 0,
    revived: 0,
    forces: { 'wind_pass:14': 3, 'wind_pass:15': 1 },
  };
  g.players[0].moved = 2;
  g.players[0].shipped = true;
  g.hajr = ['p'];
  const a = move({
    forces: { 'wind_pass:14': 3, 'wind_pass:15': 2 },
    eliteForces: { 'wind_pass:14': 2, 'wind_pass:15': 1 },
  });
  const before = structuredClone(g),
    beforeAction = structuredClone(a);
  assert.deepEqual(quote(g, 'p', a), {
    player: 'p',
    group: [
      ['wind_pass:14', 3],
      ['wind_pass:15', 2],
    ],
    eliteGroup: { 'wind_pass:14': 2, 'wind_pass:15': 1 },
    elite: 3,
    origin: 'wind_pass',
    total: 5,
    to: 'red_chasm',
    sector: 7,
    advisors: false,
    wantsFighters: false,
  });
  assert.deepEqual(g, before);
  assert.deepEqual(a, beforeAction);
  assert.ok(
    destination(g, 'wind_pass', 'red_chasm', 7),
    'no normal adjacency or active-seat restriction',
  );
});
void test('elite minimum is canonical; extra elites are never added to physical count', () => {
  const g = fixture('fremen', true);
  g.players[0].elites = {
    reserves: 0,
    tanks: 0,
    revived: 0,
    forces: { 'wind_pass:14': 3 },
  };
  const selected = quote(g, 'p', move({ forces: { 'wind_pass:14': 3 } }));
  assert.equal(selected.elite, 2);
  assert.equal(selected.total, 3);
  for (const elite of [-1, 0, 1, 4, 1.5])
    rejects(
      g,
      move({
        forces: { 'wind_pass:14': 3 },
        eliteForces: { 'wind_pass:14': elite },
      }),
    );
  rejects(g, move({ eliteForces: { 'wind_pass:15': 1 } }));
});
for (const [name, action] of [
  ['empty', move({ forces: {} })],
  ['negative', move({ forces: { 'wind_pass:14': -1 } })],
  ['fractional', move({ forces: { 'wind_pass:14': 0.5 } })],
  ['unavailable', move({ forces: { 'wind_pass:14': 5 } })],
  ['invalid source', move({ forces: { 'wind_pass:8': 1 } })],
  ['invalid destination', move({ territory: 'arrakeen', sector: 11 })],
  ['unchanged source', move({ territory: 'wind_pass', sector: 14 })],
  [
    'mixed unchanged source',
    move({
      forces: { 'wind_pass:14': 1, 'wind_pass:15': 1 },
      territory: 'wind_pass',
      sector: 14,
    }),
  ],
] as const)
  void test(`invalid ${name} selection rejects without mutation`, () =>
    rejects(fixture(), action));
void test('different source territories cannot be combined', () => {
  const g = fixture();
  g.players[0].forces['carthag:11'] = 1;
  rejects(g, move({ forces: { 'wind_pass:14': 1, 'carthag:11': 1 } }));
});
void test('same-territory changed sectors are present even when another source sector is the destination', () => {
  const g = fixture();
  const a = move({ territory: 'wind_pass', sector: 15 });
  assert.equal(quote(g, 'p', a).origin, 'wind_pass');
  assert.ok(destination(g, 'wind_pass', 'wind_pass', 15));
  assert.ok(destination(g, 'wind_pass', 'wind_pass', 14));
});
void test('source and destination storms filter sectors, including partly covered territories, while sector zero remains clear', () => {
  const g = fixture();
  g.storm = 14;
  rejects(g, move(), /storm/);
  rejects(
    g,
    move({ forces: { 'wind_pass:15': 1 }, territory: 'wind_pass', sector: 14 }),
    /storm/,
  );
  assert.deepEqual(
    domain(g, 'p')
      .sources.find((s) => s.territory === 'wind_pass')!
      .sectors.map((s) => s.key),
    ['wind_pass:15'],
  );
  assert.ok(destination(g, 'wind_pass', 'wind_pass', 16));
  assert.equal(destination(g, 'wind_pass', 'wind_pass', 14), undefined);
  g.storm = 0;
  g.players[0].forces = { 'polar_sink:0': 2 };
  assert.ok(destination(g, 'polar_sink', 'red_chasm', 7));
  g.players[0].forces = { 'red_chasm:7': 2 };
  assert.ok(destination(g, 'red_chasm', 'polar_sink', 0));
});
void test('HMS exists only when placed; non-Ixians enter only from its pointing territory', () => {
  const g = fixture();
  rejects(g, move({ territory: MOBILE_STRONGHOLD, sector: 0 }));
  assert.equal(destination(g, 'wind_pass', MOBILE_STRONGHOLD, 0), undefined);
  g.mobileStronghold = { location: 'wind_pass:14' };
  assert.ok(destination(g, 'wind_pass', MOBILE_STRONGHOLD, 0));
  g.mobileStronghold.location = 'carthag:11';
  rejects(g, move({ territory: MOBILE_STRONGHOLD, sector: 0 }), /points/);
  g.players[0].faction = 'ixians';
  assert.ok(destination(g, 'wind_pass', MOBILE_STRONGHOLD, 0));
});
for (const value of [0, 3, 5] as const)
  void test(`No-Field ${value} relocates alone or with physical forces without exposing denomination`, () => {
    const g = fixture('richese');
    const selected = marker(g, value);
    const before = structuredClone(g);
    const a = move({ forces: {}, noField: selected });
    const result = quote(g, 'p', a);
    assert.equal(result.total, 1);
    assert.equal(result.elite, 0);
    assert.deepEqual(result.noField, { ...selected, from: 'wind_pass:14' });
    assert.ok(!JSON.stringify(result).includes('value'));
    assert.equal(quote(g, 'p', move({ noField: selected })).total, 3);
    assert.deepEqual(g, before);
    g.mobileStronghold = { location: 'wind_pass:14' };
    assert.equal(
      quote(g, 'p', { ...a, territory: MOBILE_STRONGHOLD, sector: 0 }).to,
      MOBILE_STRONGHOLD,
    );
    rejects(
      g,
      move({ noField: { ...selected, event: 'ambassador-event' } }),
      /current/,
    );
    rejects(
      g,
      move({ noField: selected, territory: 'wind_pass', sector: 14 }),
      /change/,
    );
  });
void test('marker-only sources are represented and storm markers cannot create sources', () => {
  const g = fixture('richese');
  g.players[0].forces = {};
  marker(g);
  assert.equal(domain(g, 'p').sources[0].sectors.length, 0);
  assert.deepEqual(domain(g, 'p').sources[0].marker, {
    tokenId: 'nf0',
    event: 'marker-event',
    sector: 14,
  });
  g.storm = 14;
  assert.deepEqual(domain(g, 'p'), { sources: [] });
});
void test('Ecaz and reciprocal ally may co-occupy and count as one faction for stronghold capacity', () => {
  const g = fixture();
  g.players[0].ally = 'q';
  g.players[1].ally = 'p';
  g.players[1].forces = { 'arrakeen:10': 2 };
  g.players[2].forces = { 'arrakeen:10': 2 };
  assert.doesNotThrow(() =>
    quote(g, 'p', move({ territory: 'arrakeen', sector: 10 })),
  );
  g.players[0].faction = 'guild';
  rejects(g, move({ territory: 'arrakeen', sector: 10 }), /ally/);
  g.players[0].faction = 'ecaz';
  g.players[1].ally = null;
  rejects(g, move({ territory: 'arrakeen', sector: 10 }), /reciprocal ally/);
});
void test('an already occupying Ecaz/allied pair counts as one opponent faction', () => {
  const g = fixture('guild');
  g.players[1].faction = 'ecaz';
  g.players[1].ally = 'r';
  g.players[2].ally = 'q';
  g.players[1].forces = { 'arrakeen:10': 2 };
  g.players[2].forces = { 'arrakeen:10': 2 };
  assert.doesNotThrow(() =>
    quote(g, 'p', move({ territory: 'arrakeen', sector: 10 })),
  );
  g.players[1].ally = null;
  g.players[2].ally = null;
  rejects(g, move({ territory: 'arrakeen', sector: 10 }), /three/);
});
void test('advisor stance avoids fighter capacity; optional flip has exact ordinary occupancy and lock limits', () => {
  const g = fixture('beneGesserit', true);
  g.players[0].advisors = { wind_pass: {} };
  g.players[1].forces = { 'arrakeen:10': 1 };
  g.players[2].forces = { 'arrakeen:10': 1 };
  const a = move({ territory: 'arrakeen', sector: 10 });
  assert.equal(quote(g, 'p', a).advisors, true);
  assert.equal(destination(g, 'wind_pass', 'arrakeen', 10)!.canFight, false);
  rejects(g, { ...a, fighters: true }, /three/);
  g.players[2].forces = {};
  assert.equal(destination(g, 'wind_pass', 'arrakeen', 10)!.canFight, true);
  assert.equal(quote(g, 'p', { ...a, fighters: true }).wantsFighters, true);
  g.phase = 1;
  assert.equal(
    quote(g, 'p', { ...a, fighters: true }).wantsFighters,
    true,
    'arrival choice is not limited to the ordinary movement phase',
  );
  g.players[0].advisors.wind_pass.lockedTurn = 2;
  assert.equal(quote(g, 'p', a).lockedTurn, 2);
  rejects(g, { ...a, fighters: true }, /flip/);
  assert.equal(destination(g, 'wind_pass', 'arrakeen', 10)!.canFight, false);
});
void test('advisors joining own fighters cannot evade a current-turn lock; empty destination becomes fighters', () => {
  const g = fixture('beneGesserit', true);
  g.players[0].advisors = { wind_pass: { lockedTurn: 2 } };
  g.players[0].forces['arrakeen:10'] = 1;
  g.players[1].forces = { 'arrakeen:10': 1 };
  rejects(g, move({ territory: 'arrakeen', sector: 10 }), /New advisors/);
  assert.equal(quote(g, 'p', move()).advisors, false);
});
void test('Ecaz Occupy permits an unlocked allied BG arrival flip while preserving advisor locks and own stance', () => {
  const g = fixture('beneGesserit', true);
  g.players[0].advisors = { wind_pass: {} };
  g.players[0].ally = 'q';
  g.players[1].faction = 'ecaz';
  g.players[1].ally = 'p';
  g.players[1].forces = { 'arrakeen:10': 2 };
  g.players[2].forces = { 'arrakeen:10': 1 };
  const a = move({ territory: 'arrakeen', sector: 10, fighters: true });
  assert.equal(quote(g, 'p', a).wantsFighters, true);
  assert.equal(destination(g, 'wind_pass', 'arrakeen', 10)!.canFight, true);
  g.players[0].advisors.wind_pass.lockedTurn = g.turn;
  rejects(g, a, /flip/);
  assert.equal(destination(g, 'wind_pass', 'arrakeen', 10)!.canFight, false);
  delete g.players[0].advisors.wind_pass.lockedTurn;
  g.players[0].forces['arrakeen:10'] = 1;
  g.players[0].advisors.arrakeen = {};
  rejects(g, a, /flip/);
});
void test('only current phase-five applied Baliset prevents entry, not same-territory movement or another phase', () => {
  const g = fixture();
  g.players[1].faction = 'choam';
  g.players[1].forces = { 'red_chasm:7': 1 };
  g.choamBaliset = [{ turn: 2, player: 'p', territory: 'red_chasm' }];
  rejects(g, move(), /Baliset/);
  assert.equal(destination(g, 'wind_pass', 'red_chasm', 7), undefined);
  g.phase = 1;
  assert.doesNotThrow(() => quote(g, 'p', move()));
  g.phase = 5;
  g.choamBaliset[0].turn = 1;
  assert.doesNotThrow(() => quote(g, 'p', move()));
  g.choamBaliset[0] = { turn: 2, player: 'p', territory: 'wind_pass' };
  g.players[1].forces = { 'wind_pass:14': 1 };
  assert.doesNotThrow(() =>
    quote(g, 'p', move({ territory: 'wind_pass', sector: 15 })),
  );
});
void test('every advertised destination has a valid minimum selection, including elite-only and marker-only witnesses', () => {
  for (const kind of ['physical', 'elite', 'marker'] as const) {
    const g = fixture(kind === 'marker' ? 'richese' : 'ixians', true);
    if (kind === 'elite')
      g.players[0].elites = {
        reserves: 0,
        tanks: 0,
        revived: 0,
        forces: { 'wind_pass:14': 4, 'wind_pass:15': 3 },
      };
    if (kind === 'marker') {
      g.players[0].forces = {};
      marker(g);
    }
    const snapshot = structuredClone(g),
      projected = domain(g, 'p');
    for (const source of projected.sources)
      for (const to of source.destinations) {
        const key = source.sectors.find(
          (s) => s.key !== location(to.territory, to.sector),
        )?.key;
        const a = move({
          territory: to.territory,
          sector: to.sector,
          forces: key ? { [key]: 1 } : {},
          ...(!key && source.marker
            ? {
                noField: {
                  tokenId: source.marker.tokenId,
                  event: source.marker.event,
                },
              }
            : {}),
        });
        assert.equal(quote(g, 'p', a).advisors, to.advisors);
        if (to.canFight)
          assert.equal(
            quote(g, 'p', { ...a, fighters: true }).wantsFighters,
            true,
          );
      }
    assert.deepEqual(g, snapshot);
  }
});
void test('private cards, balances, promises and No-Field denomination are not read by either pure API', (t) => {
  const g = fixture('richese');
  marker(g);
  const before = domain(g, 'p');
  t.mock.method(globalThis.crypto, 'randomUUID', () => {
    throw Error('Relocation sampled an event');
  });
  t.mock.method(globalThis.crypto, 'getRandomValues', () => {
    throw Error('Relocation sampled randomness');
  });
  for (const p of g.players)
    for (const key of ['hand', 'spice', 'traitors'])
      Object.defineProperty(p, key, {
        get() {
          throw Error('Private data read: ' + key);
        },
      });
  for (const key of [
    'deck',
    'shipmentPromises',
    'battlePromises',
    'truthtrance',
  ])
    Object.defineProperty(g, key, {
      get() {
        throw Error('Private data read: ' + key);
      },
    });
  Object.defineProperty(g.players[0].noField!, 'tokens', {
    get() {
      throw Error('Marker denomination read');
    },
  });
  assert.deepEqual(domain(g, 'p'), before);
  assert.equal(
    quote(
      g,
      'p',
      move({ forces: {}, noField: { tokenId: 'nf0', event: 'marker-event' } }),
    ).total,
    1,
  );
});
void test('malformed board, typed custody, absent ally and overflowing destination reject without mutation', () => {
  for (const corrupt of [
    (g: Game) => {
      g.players[0].forces['red_chasm:19'] = 1;
    },
    (g: Game) => {
      g.players[0].elites = {
        reserves: 0,
        tanks: 0,
        revived: 0,
        forces: { 'wind_pass:14': 5 },
      };
    },
    (g: Game) => {
      g.players[0].ally = 'missing';
    },
    (g: Game) => {
      g.players[0].forces['red_chasm:7'] = Number.MAX_SAFE_INTEGER;
    },
  ]) {
    const g = fixture();
    corrupt(g);
    rejects(g, move());
  }
});
