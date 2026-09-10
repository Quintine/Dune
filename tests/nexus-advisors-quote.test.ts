import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteNexusAdvisors,
  createNexusAdvisors,
  validateNexusAdvisors,
  type NexusAdvisorContext,
  type NexusAdvisorReceipt,
} from '../game/nexus-advisors';

const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function context(): NexusAdvisorContext {
  return {
    advanced: true,
    turn: 3,
    storm: 18,
    order: ['b', 'g', 'r'],
    players: [
      {
        id: 'b',
        faction: 'beneGesserit',
        ally: null,
        forces: { 'hagga_basin:12': 2, 'hagga_basin:13': 1, 'arrakeen:10': 2 },
        advisors: { hagga_basin: { lockedTurn: 2 }, arrakeen: {} },
      },
      {
        id: 'g',
        faction: 'guild',
        ally: null,
        forces: { 'hagga_basin:12': 1, 'arrakeen:10': 1 },
      },
      { id: 'r', faction: 'richese', ally: null, forces: {} },
    ],
  };
}
void test('one territory selection includes all physical advisor sectors and permits several territory groups as one immutable receipt', () => {
  const c = context(),
    before = reload(c),
    quote = quoteNexusAdvisors(c, 'b');
  assert.deepEqual(
    quote.territories
      .map((t) => [t.territory, t.count, t.blocked])
      .sort((one, two) => String(one[0]).localeCompare(String(two[0]))),
    [
      ['arrakeen', 2, null],
      ['hagga_basin', 3, null],
    ],
  );
  const receipt = createNexusAdvisors(c, 'b', 'advisor-1', [
    'hagga_basin',
    'arrakeen',
  ]);
  assert.deepEqual(receipt.selections[0], {
    territory: 'hagga_basin',
    count: 3,
    locations: [
      { location: 'hagga_basin:12', count: 2 },
      { location: 'hagga_basin:13', count: 1 },
    ],
    noField: null,
    stance: { lockedTurn: 2 },
  });
  assert.deepEqual(c, before);
  validateNexusAdvisors(reload(c), reload(receipt), true);
  receipt.selections[0].locations[0].count = 0;
  assert.deepEqual(c, before);
});
void test('Basic and automatically released lone advisors yield no choice; Homeworld stances are not selected', () => {
  const c = context();
  assert.deepEqual(quoteNexusAdvisors({ ...c, advanced: false }, 'b'), {
    territories: [],
  });
  c.players[1].forces = {};
  c.players[0].advisors!['homeworld:beneGesserit'] = {};
  assert.deepEqual(quoteNexusAdvisors(c, 'b'), { territories: [] });
  assert.throws(() =>
    createNexusAdvisors(c, 'b', 'x', ['homeworld:beneGesserit']),
  );
  assert.throws(() => quoteNexusAdvisors(c, 'g'));
});
void test('fresh advisor lock and storm interference expose explicit unresolved reasons while clear sectors remain usable', () => {
  const fresh = context();
  fresh.players[0].advisors!.hagga_basin.lockedTurn = 3;
  assert.match(
    quoteNexusAdvisors(fresh, 'b').territories.find(
      (t) => t.territory === 'hagga_basin',
    )!.blocked!,
    /same-turn.*unresolved/,
  );
  assert.throws(
    () => createNexusAdvisors(fresh, 'b', 'x', ['arrakeen', 'hagga_basin']),
    /unresolved/,
  );
  const storm = context();
  storm.storm = 10;
  assert.match(
    quoteNexusAdvisors(storm, 'b').territories.find(
      (t) => t.territory === 'arrakeen',
    )!.blocked!,
    /storm.*ruling/,
  );
  assert.equal(
    quoteNexusAdvisors(storm, 'b').territories.find(
      (t) => t.territory === 'hagga_basin',
    )!.blocked,
    null,
  );
});
void test('a storm separating hostile sectors blocks only the affected conversion rather than requiring battle contact everywhere', () => {
  const c = context();
  c.players[0].forces = { 'pasty_mesa:5': 2 };
  c.players[0].advisors = { pasty_mesa: {} };
  c.players[1].forces = { 'pasty_mesa:8': 1 };
  c.storm = 7;
  assert.match(quoteNexusAdvisors(c, 'b').territories[0].blocked!, /storm/);
  c.storm = 18;
  assert.equal(quoteNexusAdvisors(c, 'b').territories[0].blocked, null);
  c.players[0].forces = { 'polar_sink:0': 2 };
  c.players[0].advisors = { polar_sink: {} };
  c.players[1].forces = { 'polar_sink:0': 1 };
  assert.equal(quoteNexusAdvisors(c, 'b').territories[0].blocked, null);
});
void test('ordinary allied occupation and a third stronghold faction block conversion using public No-Field presence', () => {
  const allied = context();
  allied.players[0].ally = 'g';
  allied.players[1].ally = 'b';
  assert.ok(
    quoteNexusAdvisors(allied, 'b').territories.every((t) =>
      /ally/.test(t.blocked!),
    ),
  );
  const full = context();
  full.players[2].noField = {
    deployed: { location: { territory: 'arrakeen', sector: 10 } },
  };
  assert.match(
    quoteNexusAdvisors(full, 'b').territories.find(
      (t) => t.territory === 'arrakeen',
    )!.blocked!,
    /three occupying factions/,
  );
  assert.equal(
    quoteNexusAdvisors(full, 'b').territories.find(
      (t) => t.territory === 'hagga_basin',
    )!.blocked,
    null,
  );
});
void test('the established Ecaz shared occupancy identity is preserved for capacity and allied entry', () => {
  const c = context();
  c.players[1].faction = 'ecaz';
  c.players[0].ally = 'g';
  c.players[1].ally = 'b';
  c.players[2].forces = { 'arrakeen:10': 1 };
  assert.equal(
    quoteNexusAdvisors(c, 'b').territories.find(
      (t) => t.territory === 'arrakeen',
    )!.blocked,
    null,
  );
});
void test('public marker counts and locations are recorded without reading hidden No-Field denomination or other secrets', () => {
  const c = context();
  c.players[0].noField = {
    deployed: { location: { territory: 'hagga_basin', sector: 12 } },
  };
  for (const player of c.players)
    for (const key of ['hand', 'spice', 'traitors', 'leaders'])
      Object.defineProperty(player, key, {
        get() {
          throw Error('Private field accessed');
        },
      });
  const marker = c.players[0].noField!;
  for (const key of ['tokens', 'value', 'tokenId', 'lastShipped'])
    Object.defineProperty(marker, key, {
      get() {
        throw Error('Hidden marker accessed');
      },
    });
  Object.defineProperty(marker.deployed!, 'tokenId', {
    get() {
      throw Error('Hidden identity accessed');
    },
  });
  const receipt = createNexusAdvisors(c, 'b', 'private', ['hagga_basin']);
  assert.equal(receipt.selections[0].count, 4);
  assert.equal(receipt.selections[0].noField, 'hagga_basin:12');
  assert.equal(
    receipt.selections[0].locations.reduce((sum, g) => sum + g.count, 0),
    3,
  );
  validateNexusAdvisors(c, receipt, true);
  const changed = reload(c);
  changed.players[0].noField = null;
  changed.players[0].forces = {
    'hagga_basin:12': 3,
    'hagga_basin:13': 1,
    'arrakeen:10': 2,
  };
  assert.equal(
    quoteNexusAdvisors(changed, 'b').territories.find(
      (t) => t.territory === 'hagga_basin',
    )!.count,
    4,
  );
  assert.throws(() => validateNexusAdvisors(changed, receipt, true));
});
void test('empty, duplicate, foreign and malformed selections reject immutably and current settlement rechecks exact counts and legality', () => {
  const c = context(),
    before = reload(c);
  for (const selected of [
    [],
    ['arrakeen', 'arrakeen'],
    ['unknown'],
    ['arrakeen:10'],
  ])
    assert.throws(() => createNexusAdvisors(c, 'b', 'x', selected));
  assert.deepEqual(c, before);
  const receipt = createNexusAdvisors(c, 'b', 'x', ['arrakeen']);
  for (const change of [
    (g: NexusAdvisorContext) => {
      g.players[0].forces = { 'arrakeen:10': 1 };
    },
    (g: NexusAdvisorContext) => {
      delete g.players[0].advisors!.arrakeen;
    },
    (g: NexusAdvisorContext) => {
      g.players[0].advisors!.arrakeen.lockedTurn = 3;
    },
    (g: NexusAdvisorContext) => {
      g.players[2].forces = { 'arrakeen:10': 1 };
    },
    (g: NexusAdvisorContext) => {
      g.storm = 10;
    },
  ]) {
    const altered = reload(c);
    change(altered);
    assert.throws(() => validateNexusAdvisors(altered, receipt, true));
  }
});
void test('signed receipt detects altered counts, stances and ordering while completed history survives later movement and turns', () => {
  const c = context(),
    receipt = createNexusAdvisors(c, 'b', 'x', ['arrakeen', 'hagga_basin']);
  for (const change of [
    (r: NexusAdvisorReceipt) => {
      r.selections.reverse();
    },
    (r: NexusAdvisorReceipt) => {
      r.selections[0].count++;
    },
    (r: NexusAdvisorReceipt) => {
      r.selections[0].stance.lockedTurn = 1;
    },
    (r: NexusAdvisorReceipt) => {
      r.selections[1].locations.reverse();
    },
    (r: NexusAdvisorReceipt) => {
      r.owner = 'g';
    },
    (r: NexusAdvisorReceipt) => {
      r.turn++;
    },
  ]) {
    const bad = reload(receipt);
    change(bad);
    assert.throws(() => validateNexusAdvisors(c, bad, false));
  }
  const later = reload(c);
  later.turn++;
  later.players[0].forces = {};
  later.players[0].advisors = {};
  validateNexusAdvisors(later, receipt, false);
  assert.throws(() => validateNexusAdvisors(later, receipt, true));
});

void test('ordinary in-memory undefined lock metadata normalizes into the same saved stance without mutating its source', () => {
  const c = context();
  c.players[0].advisors!.arrakeen = { lockedTurn: undefined };
  const receipt = createNexusAdvisors(c, 'b', 'undefined-lock', ['arrakeen']);
  assert.deepEqual(receipt.selections[0].stance, {});
  assert.equal(
    Object.hasOwn(c.players[0].advisors!.arrakeen, 'lockedTurn'),
    true,
  );
  validateNexusAdvisors(c, receipt, true);
  validateNexusAdvisors(reload(c), reload(receipt), true);
});
