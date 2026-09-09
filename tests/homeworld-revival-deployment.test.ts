import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer } from '../game/engine';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  quoteHomeworldRevivalDeployment,
  type HomeworldRevivalDeploymentGroup,
  type HomeworldRevivalDeploymentSource,
} from '../game/homeworld-revival-deployment';

function fixture(
  faction: 'fremen' | 'tleilaxu' | 'emperor',
  reserves: number,
  advanced = true,
) {
  const players = [
    newPlayer('p', 'Native', faction),
    newPlayer('v', 'Visitor', 'harkonnen'),
  ];
  players[0].reserves = reserves;
  if (faction === 'fremen' || faction === 'emperor')
    players[0].elites = {
      reserves: 0,
      tanks: faction === 'fremen' ? 3 : 5,
      forces: {},
      revived: 0,
    };
  const context = { advanced, players };
  return {
    ...context,
    homeworlds: { custody: createHomeworldCustody(homeworldContext(context)) },
  };
}
function deposited(
  before: ReturnType<typeof fixture>,
  group: HomeworldRevivalDeploymentGroup,
) {
  const after = structuredClone(before);
  after.players[0].reserves += group.amount;
  if (after.players[0].elites) after.players[0].elites.reserves += group.elite;
  if (after.homeworlds.custody.salusa)
    after.homeworlds.custody.salusa.elite += group.elite;
  return after;
}

void test('high Southern Hemisphere returns only the newly revived Fedaykin subset for each supported revival source', () => {
  for (const advanced of [false, true])
    for (const source of ['normal', 'emperorExtra', 'ghola'] as const) {
      const before = fixture('fremen', 3, advanced);
      before.players[0].elites!.reserves = 1;
      const group = { amount: 4, elite: 2, free: source === 'normal' ? 2 : 0 };
      const after = deposited(before, group);
      assert.deepEqual(
        quoteHomeworldRevivalDeployment(before, after, 'p', source, group),
        {
          kind: 'fedaykin',
          normal: 0,
          elite: 2,
          beforePopulation: 3,
          afterPopulation: 7,
          blocked: null,
        },
      );
    }
});

void test('high Tleilax selects only actual normal Free-Revived forces from a mixed paid/free group', () => {
  for (const advanced of [false, true]) {
    const before = fixture('tleilaxu', 9, advanced);
    const group = { amount: 5, elite: 0, free: 2 };
    const after = deposited(before, group);
    assert.deepEqual(
      quoteHomeworldRevivalDeployment(before, after, 'p', 'normal', group),
      {
        kind: 'tleilax',
        normal: 2,
        elite: 0,
        beforePopulation: 9,
        afterPopulation: 14,
        blocked: null,
      },
    );
    for (const source of ['emperorExtra', 'ghola'] as const)
      assert.equal(
        quoteHomeworldRevivalDeployment(before, after, 'p', source, group),
        null,
      );
    assert.equal(
      quoteHomeworldRevivalDeployment(before, after, 'p', 'normal', {
        ...group,
        free: 0,
      }),
      null,
    );
  }
});

void test('reaching the high threshold returns an explicit unresolved block while remaining low grants nothing', () => {
  for (const [faction, start, elite] of [
    ['fremen', 2, 1],
    ['tleilaxu', 8, 0],
  ] as const) {
    const before = fixture(faction, start);
    const group = { amount: 1, elite, free: 1 };
    const result = quoteHomeworldRevivalDeployment(
      before,
      deposited(before, group),
      'p',
      'normal',
      group,
    )!;
    assert.ok(result);
    assert.equal(result.beforePopulation, start);
    assert.equal(result.afterPopulation, start + 1);
    assert.match(result.blocked!, /first reaches.*threshold.*timing ruling/);
    const low = fixture(faction, start - 1);
    assert.equal(
      quoteHomeworldRevivalDeployment(
        low,
        deposited(low, group),
        'p',
        'normal',
        group,
      ),
      null,
    );
  }
});

void test('normal-only Fremen returns and correctly routed Emperor deposits create no deployment permission', () => {
  for (const [faction, group] of [
    ['fremen', { amount: 2, elite: 0, free: 2 }],
    ['emperor', { amount: 3, elite: 2, free: 1 }],
  ] as const) {
    const before = fixture(faction, 5);
    assert.equal(
      quoteHomeworldRevivalDeployment(
        before,
        deposited(before, group),
        'p',
        'normal',
        group,
      ),
      null,
    );
  }
});

void test('foreign visitors cannot supply a native threshold or masquerade as the newly returned group', () => {
  const before = fixture('fremen', 1);
  before.players[1].reserves = 0;
  before.homeworlds.custody.visitors['homeworld:fremen'] = {
    v: { normal: 20, elite: 0 },
  };
  const group = { amount: 1, elite: 1, free: 1 };
  const after = deposited(before, group);
  assert.equal(
    quoteHomeworldRevivalDeployment(before, after, 'p', 'normal', group),
    null,
  );
  after.homeworlds.custody.visitors['homeworld:fremen'].v.normal--;
  after.players[1].reserves++;
  assert.throws(
    () => quoteHomeworldRevivalDeployment(before, after, 'p', 'normal', group),
    /original typed native reserve deposit/,
  );
});

void test('unchanged, mismatched and incorrectly typed deposits reject without changing either snapshot', () => {
  const before = fixture('fremen', 3);
  const group = { amount: 2, elite: 1, free: 1 };
  const edits: ((after: ReturnType<typeof fixture>) => void)[] = [
    (after) => {
      after.players[0].reserves--;
    },
    (after) => {
      after.players[0].elites!.reserves--;
    },
    (after) => {
      after.players[1].reserves--;
    },
    (after) => {
      after.players[0].faction = 'emperor';
    },
    (after) => {
      after.advanced = false;
    },
  ];
  for (const edit of edits) {
    const after = deposited(before, group);
    edit(after);
    const snapshots = structuredClone({ before, after });
    assert.throws(() =>
      quoteHomeworldRevivalDeployment(before, after, 'p', 'normal', group),
    );
    assert.deepEqual({ before, after }, snapshots);
  }
  assert.throws(
    () => quoteHomeworldRevivalDeployment(before, before, 'p', 'normal', group),
    /original typed native reserve deposit/,
  );
  assert.throws(() =>
    quoteHomeworldRevivalDeployment(
      before,
      deposited(before, group),
      'absent',
      'normal',
      group,
    ),
  );
});

void test('invalid source and physical group counts reject even when no deployment would be eligible', () => {
  const before = fixture('fremen', 3);
  const valid = { amount: 2, elite: 1, free: 1 };
  const after = deposited(before, valid);
  for (const group of [
    null,
    undefined,
    [],
    {},
    { ...valid, amount: 0 },
    { ...valid, amount: -1 },
    { ...valid, amount: 21 },
    { ...valid, amount: 0.5 },
    { ...valid, amount: Infinity },
    { ...valid, elite: -1 },
    { ...valid, elite: 3 },
    { ...valid, elite: NaN },
    { ...valid, free: -1 },
    { ...valid, free: 3 },
    { ...valid, free: 0.5 },
  ]) {
    const snapshots = structuredClone({ before, after });
    assert.throws(
      () =>
        quoteHomeworldRevivalDeployment(
          before,
          after,
          'p',
          'normal',
          group as HomeworldRevivalDeploymentGroup,
        ),
      /exact newly returned/,
    );
    assert.deepEqual({ before, after }, snapshots);
  }
  assert.throws(
    () =>
      quoteHomeworldRevivalDeployment(
        before,
        after,
        'p',
        'unknown' as HomeworldRevivalDeploymentSource,
        valid,
      ),
    /valid source/,
  );
});

void test('absent or uninitialized Homeworlds grant nothing and enabling or deleting custody mid-return rejects', () => {
  const before = fixture('fremen', 3);
  const group = { amount: 1, elite: 1, free: 1 };
  const after = deposited(before, group);
  for (const homeworlds of [undefined, null, { custody: null }]) {
    assert.equal(
      quoteHomeworldRevivalDeployment(
        { ...before, homeworlds },
        { ...after, homeworlds },
        'p',
        'normal',
        group,
      ),
      null,
    );
    assert.throws(
      () =>
        quoteHomeworldRevivalDeployment(
          before,
          { ...after, homeworlds },
          'p',
          'normal',
          group,
        ),
      /module cannot change/,
    );
    assert.throws(
      () =>
        quoteHomeworldRevivalDeployment(
          { ...before, homeworlds },
          after,
          'p',
          'normal',
          group,
        ),
      /module cannot change/,
    );
  }
});

void test('public typed deposit comparison tolerates property and player ordering without reading private state', () => {
  const before = fixture('fremen', 3);
  const group = { amount: 2, elite: 1, free: 1 };
  const after = deposited(before, group);
  after.players.reverse();
  const expected = quoteHomeworldRevivalDeployment(
    before,
    after,
    'p',
    'normal',
    group,
  );
  assert.deepEqual(
    quoteHomeworldRevivalDeployment(
      JSON.parse(JSON.stringify(before)),
      JSON.parse(JSON.stringify(after)),
      'p',
      'normal',
      group,
    ),
    expected,
  );
  for (const context of [before, after]) {
    for (const player of context.players) {
      for (const field of [
        'spice',
        'hand',
        'traitors',
        'prediction',
        'faceDancers',
        'forces',
        'tanks',
      ])
        Object.defineProperty(player, field, {
          get() {
            throw new Error(`private ${field}`);
          },
        });
      Object.freeze(player.elites);
      Object.freeze(player);
    }
    Object.freeze(context.players);
    Object.freeze(context.homeworlds.custody.salusa);
    Object.freeze(context.homeworlds.custody.visitors);
    Object.freeze(context.homeworlds.custody);
    Object.freeze(context.homeworlds);
    Object.freeze(context);
  }
  Object.freeze(group);
  assert.deepEqual(
    quoteHomeworldRevivalDeployment(before, after, 'p', 'normal', group),
    expected,
  );
});
