import test from 'node:test';
import assert from 'node:assert/strict';
import {
  strongholdProgress,
  VictoryProgressError,
} from '../game/victory-progress';
import type { BoardContext, BoardSeat } from '../game/board-resolution-quote';
import type { Game } from '../game/engine';
import { createTechTokens, TECH_TOKENS } from '../game/tech-tokens';
import { MOBILE_STRONGHOLD, MOBILE_LOCATION } from '../game/board';
type Context = BoardContext & Pick<Game, 'techTokens'>;
const keys = [
  'arrakeen:10',
  'carthag:11',
  'sietch_tabr:14',
  'habbanya_ridge_sietch:17',
];
function fixture(ally = true): Context {
  return {
    advanced: true,
    storm: 18,
    order: ['x', 'a', 'e'],
    players: [
      { id: 'e', faction: 'ecaz', ally: ally ? 'a' : null, forces: {} },
      { id: 'a', faction: 'atreides', ally: ally ? 'e' : null, forces: {} },
      { id: 'x', faction: 'emperor', ally: null, forces: {} },
    ],
  };
}
function seat(g: Context, id: string) {
  return g.players.find((p) => p.id === id)!;
}
function occupy(g: Context, id: string, locations: string[]) {
  seat(g, id).forces = Object.fromEntries(locations.map((k) => [k, 1]));
}
function row(g: Context, id = 'e') {
  return strongholdProgress(g).progress.find((p) => p.player === id)!;
}
function tech(g: Context, owners: (string | null)[]) {
  g.techTokens = createTechTokens();
  TECH_TOKENS.forEach((t, i) => (g.techTokens![t.id].owner = owners[i]));
}
void test('three genuinely joint Ecaz strongholds qualify in storm order with separate ordinary and Occupy thresholds', () => {
  for (const advanced of [true, false]) {
    const g = fixture();
    g.advanced = advanced;
    occupy(g, 'e', keys.slice(0, 3));
    occupy(g, 'a', keys.slice(0, 3));
    const result = strongholdProgress(g);
    assert.deepEqual(
      result.progress.map((p) => p.player),
      g.order,
    );
    assert.deepEqual(result.released, []);
    const ecaz = row(g);
    assert.deepEqual(ecaz.members, ['a', 'e']);
    assert.equal(ecaz.target, 4);
    assert.equal(ecaz.occupyTarget, 3);
    assert.equal(ecaz.strongholds.length, 3);
    assert.equal(ecaz.jointlyOccupied.length, 3);
    assert.equal(ecaz.qualifies, true);
    assert.deepEqual({ ...row(g, 'a'), player: 'e' }, ecaz);
  }
});
void test('three union sites with only two jointly occupied do not qualify, but four distributed alliance sites do', () => {
  const g = fixture();
  occupy(g, 'e', keys.slice(0, 3));
  occupy(g, 'a', keys.slice(0, 2));
  assert.equal(row(g).qualifies, false);
  assert.equal(row(g).jointlyOccupied.length, 2);
  occupy(g, 'a', [keys[3]]);
  assert.equal(row(g).qualifies, true);
  assert.equal(row(g).jointlyOccupied.length, 0);
});
void test('ordinary allies share their four-site victory union without acquiring an Ecaz joint threshold', () => {
  const g = fixture();
  seat(g, 'e').faction = 'guild';
  occupy(g, 'e', keys.slice(0, 2));
  occupy(g, 'a', keys.slice(2));
  assert.equal(row(g).target, 4);
  assert.equal(row(g).occupyTarget, null);
  assert.deepEqual(row(g).jointlyOccupied, []);
  assert.equal(row(g).qualifies, true);
});
void test('unallied target is three except in a two-player game', () => {
  const g = fixture(false);
  occupy(g, 'e', keys.slice(0, 3));
  assert.equal(row(g).target, 3);
  assert.equal(row(g).qualifies, true);
  g.players = g.players.filter((p) => p.id !== 'a');
  g.order = ['e', 'x'];
  assert.equal(row(g).target, 4);
  assert.equal(row(g).qualifies, false);
  occupy(g, 'e', keys);
  assert.equal(row(g).qualifies, true);
});
void test('technology requires one member to hold all three and never supplies a joint territory', () => {
  const g = fixture();
  occupy(g, 'e', keys.slice(0, 2));
  occupy(g, 'a', keys.slice(0, 2));
  tech(g, ['e', 'e', 'a']);
  assert.equal(row(g).techStronghold, false);
  tech(g, ['a', 'a', 'a']);
  assert.equal(row(g).techStronghold, true);
  assert.equal(row(g).qualifies, false);
  occupy(g, 'e', keys.slice(0, 3));
  assert.equal(row(g).qualifies, true);
  assert.equal(row(g).jointlyOccupied.length, 2);
  tech(g, ['x', 'x', 'x']);
  assert.equal(row(g).techStronghold, false);
});
void test('territory control ignores storm for survivors but any surviving enemy prevents joint control', () => {
  const g = fixture();
  g.storm = 10;
  occupy(g, 'e', keys.slice(0, 3));
  occupy(g, 'a', keys.slice(0, 3));
  assert.equal(row(g).qualifies, true);
  occupy(g, 'x', ['sietch_tabr:14']);
  assert.equal(row(g).strongholds.includes('sietch_tabr'), false);
  assert.equal(row(g).qualifies, false);
});
void test('BG advisors neither block control nor provide joint occupation; solo advisors are released without mutation', () => {
  const g = fixture();
  seat(g, 'a').faction = 'beneGesserit';
  occupy(g, 'e', keys.slice(0, 3));
  occupy(g, 'a', keys.slice(0, 3));
  seat(g, 'a').advisors = { arrakeen: {}, carthag: {}, sietch_tabr: {} };
  assert.equal(row(g).strongholds.length, 3);
  assert.deepEqual(row(g).jointlyOccupied, []);
  assert.equal(row(g).qualifies, false);
  const before = JSON.stringify(g);
  occupy(g, 'e', []);
  const input = JSON.stringify(g),
    result = strongholdProgress(g);
  assert.equal(result.released.length, 3);
  assert.equal(row(g, 'a').strongholds.length, 3);
  assert.equal(JSON.stringify(g), input);
  assert.notEqual(input, before);
});
void test('a concealed zero-value marker supplies public joint presence without exposing denomination', () => {
  const g = fixture();
  seat(g, 'a').faction = 'richese';
  occupy(g, 'e', keys.slice(0, 3));
  occupy(g, 'a', keys.slice(0, 2));
  seat(g, 'a').noField = {
    deployed: { location: { territory: 'sietch_tabr', sector: 14 } },
  };
  Object.defineProperty(seat(g, 'a').noField!.deployed, 'value', {
    get() {
      throw Error('Hidden denomination read');
    },
  });
  assert.equal(row(g).jointlyOccupied.length, 3);
  assert.equal(row(g).qualifies, true);
  seat(g, 'a').noField = null;
  assert.equal(row(g).qualifies, false);
});
void test('only a placed mobile stronghold counts and its pointer territory remains separate', () => {
  const g = fixture();
  occupy(g, 'e', [...keys.slice(0, 2), MOBILE_LOCATION]);
  occupy(g, 'a', [...keys.slice(0, 2), MOBILE_LOCATION]);
  assert.equal(row(g).jointlyOccupied.length, 2);
  assert.equal(row(g).qualifies, false);
  g.mobileStronghold = { location: 'hagga_basin:12' };
  assert.equal(row(g).jointlyOccupied.includes(MOBILE_STRONGHOLD), true);
  assert.equal(row(g).qualifies, true);
  occupy(g, 'x', ['hagga_basin:12']);
  assert.equal(row(g).qualifies, true);
});
void test('unknown or duplicate identities, asymmetric allies, invalid board/order and incomplete tech owners fail with the typed error', () => {
  const mutations: ((g: Context) => void)[] = [
    (g) => {
      seat(g, 'a').ally = null;
    },
    (g) => {
      seat(g, 'e').ally = 'missing';
    },
    (g) => {
      seat(g, 'x').faction = 'ecaz';
    },
    (g) => {
      seat(g, 'x').faction = 'unknown' as BoardSeat['faction'];
    },
    (g) => {
      seat(g, 'x').id = 'e';
    },
    (g) => {
      g.order = ['e', 'a'];
    },
    (g) => {
      g.storm = 19;
    },
    (g) => {
      seat(g, 'e').advisors = { arrakeen: null } as never;
    },
    (g) => {
      seat(g, 'e').advisors = { unknown: {} } as never;
    },
    (g) => {
      seat(g, 'e').forces = { 'arrakeen:99': 1 };
    },
    (g) => {
      seat(g, 'e').forces = { 'arrakeen:10': -1 };
    },
    (g) => {
      g.techTokens = {} as NonNullable<Context['techTokens']>;
    },
    (g) => {
      tech(g, ['e', 'missing', null]);
    },
    (g) => {
      tech(g, ['e', 'a', null]);
      delete (g.techTokens as Partial<NonNullable<Context['techTokens']>>)
        .axlotl;
    },
  ];
  for (const mutate of mutations) {
    const g = fixture();
    mutate(g);
    assert.throws(() => strongholdProgress(g), VictoryProgressError);
  }
});
void test('public projection ignores private prediction, cards, balances and tech income while returning detached progress', () => {
  const g = fixture();
  occupy(g, 'e', keys.slice(0, 3));
  occupy(g, 'a', keys.slice(0, 3));
  tech(g, ['e', 'e', 'e']);
  const original = JSON.stringify(g);
  for (const p of g.players)
    for (const key of ['hand', 'leaders', 'prediction', 'spice', 'traitors'])
      Object.defineProperty(p, key, {
        get() {
          throw Error('Private field ' + key);
        },
      });
  Object.defineProperty(g, 'prediction', {
    get() {
      throw Error('Prediction');
    },
  });
  for (const token of Object.values(g.techTokens!))
    Object.defineProperty(token, 'spice', {
      get() {
        throw Error('Tech amount irrelevant');
      },
    });
  const first = strongholdProgress(g),
    expected = structuredClone(first);
  first.progress[0].members.push('fake');
  first.progress[1].strongholds.length = 0;
  assert.deepEqual(strongholdProgress(g), expected);
  assert.ok(original.length > 0);
});
