import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHomeworldCustody,
  type HomeworldCustodyContext,
} from '../game/homeworld-custody';
import {
  createHomeworldOccupationHistory,
  observeHomeworldOccupation,
  validateHomeworldOccupationHistory,
  tupileOccupationStatus,
  type HomeworldOccupationHistory,
} from '../game/homeworld-occupation-history';

function fixture(advanced = false) {
  const context: HomeworldCustodyContext = {
    advanced,
    players: [
      { id: 'c', faction: 'choam', reserves: 10, eliteReserves: 0 },
      { id: 'a', faction: 'atreides', reserves: 10, eliteReserves: 0 },
      { id: 'h', faction: 'harkonnen', reserves: 10, eliteReserves: 0 },
      { id: 'e', faction: 'emperor', reserves: 10, eliteReserves: 5 },
    ],
  };
  const custody = createHomeworldCustody(context);
  const history = createHomeworldOccupationHistory(
    context,
    custody,
    1,
    'real-setup',
  );
  return { context, custody, history };
}
const reload = (
  history: HomeworldOccupationHistory,
): HomeworldOccupationHistory => JSON.parse(JSON.stringify(history));
function unchangedThrow<T>(state: T, work: () => unknown) {
  const before = structuredClone(state);
  assert.throws(work, /occupation|Homeworld|forces|custody|reserves/i);
  assert.deepEqual(state, before);
}

void test('only proven visitor-free setup establishes unoccupied Tupile; legacy unknown is never upgraded from current armies', () => {
  const { context, custody, history } = fixture();
  const before = structuredClone({ context, custody, history });
  assert.equal(tupileOccupationStatus(undefined, context, 1), 'unknown');
  assert.equal(tupileOccupationStatus(history, context, 1), 'unoccupied');
  assert.deepEqual(history.qualifications, []);
  let current = history;
  for (let n = 0; n < 30; n++)
    current = observeHomeworldOccupation(
      current,
      context,
      custody,
      1,
      'change',
      `idle-wrapper-${n}`,
    );
  assert.deepEqual(current, history);
  assert.notEqual(current, history);
  current.sources[0].event = 'mutated-return-value';
  assert.deepEqual({ context, custody, history }, before);
  custody.visitors['homeworld:choam'] = { a: { normal: 1, elite: 0 } };
  unchangedThrow(custody, () =>
    createHomeworldOccupationHistory(context, custody, 1, 'forged-setup'),
  );
  custody.visitors['homeworld:choam'] = {};
  unchangedThrow(custody, () =>
    createHomeworldOccupationHistory(
      context,
      custody,
      1,
      'empty-visitor-record',
    ),
  );
  unchangedThrow(history, () =>
    tupileOccupationStatus(
      null as unknown as HomeworldOccupationHistory,
      context,
      1,
    ),
  );
});

void test('mere invasion alongside natives does not qualify, but turn boundaries record every foreign faction without choosing a controller', () => {
  const { context, custody, history } = fixture();
  custody.visitors['homeworld:choam'] = {
    a: { normal: 2, elite: 0 },
    h: { normal: 1, elite: 0 },
  };
  const invaded = observeHomeworldOccupation(
    history,
    context,
    custody,
    1,
    'change',
    'shared-arrival',
  );
  assert.deepEqual(invaded.qualifications, []);
  assert.equal(tupileOccupationStatus(invaded, context, 1), 'unoccupied');
  const end = observeHomeworldOccupation(
    invaded,
    context,
    custody,
    1,
    'turnEnd',
    'turn-1-end',
  );
  assert.deepEqual(
    end.qualifications.map(({ world, player, turn, cause }) => ({
      world,
      player,
      turn,
      cause,
    })),
    [
      { world: 'homeworld:choam', player: 'a', turn: 1, cause: 'turnEnd' },
      { world: 'homeworld:choam', player: 'h', turn: 1, cause: 'turnEnd' },
    ],
  );
  const start = observeHomeworldOccupation(
    end,
    context,
    custody,
    2,
    'turnStart',
    'turn-2-start',
  );
  assert.equal(start.qualifications.length, 4);
  assert.deepEqual(
    start.qualifications
      .slice(2)
      .map((fact) => [fact.player, fact.turn, fact.cause]),
    [
      ['a', 2, 'turnStart'],
      ['h', 2, 'turnStart'],
    ],
  );
  assert.equal(tupileOccupationStatus(start, context, 2), 'unknown');
  assert.equal(
    start.snapshots.length,
    2,
    'unchanged boundary physical snapshot is shared',
  );
  assert.equal(start.sources.length, 4);
  assert.equal(Object.hasOwn(start, 'controller'), false);
  assert.equal(Object.hasOwn(start, 'income'), false);
  validateHomeworldOccupationHistory(reload(start), context, 2);
});

void test('separately committed loser elimination records the transient sole foreign winner even when winner casualties immediately empty Tupile', () => {
  const { context, custody, history } = fixture();
  custody.visitors['homeworld:choam'] = { a: { normal: 1, elite: 0 } };
  const invaded = observeHomeworldOccupation(
    history,
    context,
    custody,
    1,
    'change',
    'invasion',
  );
  const native = context.players.find((p) => p.id === 'c')!;
  native.reserves = 0;
  const winnerAlone = observeHomeworldOccupation(
    invaded,
    context,
    custody,
    1,
    'change',
    'battle-loser-removed',
  );
  assert.deepEqual(winnerAlone.qualifications, [
    {
      event: 'battle-loser-removed',
      world: 'homeworld:choam',
      player: 'a',
      faction: 'atreides',
      turn: 1,
      cause: 'sole',
    },
  ]);
  delete custody.visitors['homeworld:choam'];
  const winnerLost = observeHomeworldOccupation(
    reload(winnerAlone),
    context,
    custody,
    1,
    'change',
    'battle-winner-casualties',
  );
  assert.deepEqual(winnerLost.qualifications, winnerAlone.qualifications);
  assert.equal(tupileOccupationStatus(winnerLost, context, 1), 'unknown');
  native.reserves = 10;
  const restoredNative = observeHomeworldOccupation(
    winnerLost,
    context,
    custody,
    1,
    'change',
    'native-revival',
  );
  const nextTurn = observeHomeworldOccupation(
    restoredNative,
    context,
    custody,
    2,
    'turnStart',
    'next-turn',
  );
  assert.equal(
    tupileOccupationStatus(nextTurn, context, 2),
    'unknown',
    'no inferred occupation expiry',
  );
  assert.equal(nextTurn.qualifications.length, 1);
  validateHomeworldOccupationHistory(nextTurn, context, 2);
});

void test('one simultaneous casualty group creates no intermediate qualifier; typed armies at Kaitain and Salusa are separate worlds', () => {
  const { context, custody, history } = fixture(true);
  custody.visitors['homeworld:choam'] = { a: { normal: 1, elite: 0 } };
  const invaded = observeHomeworldOccupation(
    history,
    context,
    custody,
    1,
    'change',
    'arrive',
  );
  context.players.find((p) => p.id === 'c')!.reserves = 0;
  delete custody.visitors['homeworld:choam'];
  const destroyed = observeHomeworldOccupation(
    invaded,
    context,
    custody,
    1,
    'change',
    'simultaneous-explosion',
  );
  assert.deepEqual(destroyed.qualifications, []);
  assert.equal(tupileOccupationStatus(destroyed, context, 1), 'unoccupied');
  context.players.find((p) => p.id === 'e')!.reserves = 5;
  custody.visitors['homeworld:emperor'] = { a: { normal: 1, elite: 0 } };
  custody.visitors['homeworld:emperor:salusa'] = { h: { normal: 2, elite: 0 } };
  const kaitain = observeHomeworldOccupation(
    destroyed,
    context,
    custody,
    1,
    'change',
    'separate-imperial-worlds',
  );
  assert.deepEqual(
    kaitain.qualifications.map((q) => [q.world, q.player, q.cause]),
    [['homeworld:emperor', 'a', 'sole']],
  );
  const boundary = observeHomeworldOccupation(
    kaitain,
    context,
    custody,
    1,
    'turnEnd',
    'imperial-end',
  );
  assert.deepEqual(
    boundary.qualifications.slice(1).map((q) => [q.world, q.player, q.cause]),
    [
      ['homeworld:emperor', 'a', 'turnEnd'],
      ['homeworld:emperor:salusa', 'h', 'turnEnd'],
    ],
  );
  assert.equal(
    tupileOccupationStatus(boundary, context, 1),
    'unoccupied',
    'qualification elsewhere cannot remove CHOAM low advantage',
  );
  validateHomeworldOccupationHistory(boundary, context, 1);
});

void test('source events bind original turn, cause and exact public physical counts before replay or unchanged-snapshot suppression', () => {
  const { context, custody, history } = fixture();
  context.players.find((p) => p.id === 'c')!.reserves = 0;
  custody.visitors['homeworld:choam'] = { a: { normal: 1, elite: 0 } };
  const first = observeHomeworldOccupation(
    history,
    context,
    custody,
    1,
    'change',
    'sole-entry',
  );
  const replay = observeHomeworldOccupation(
    reload(first),
    context,
    custody,
    1,
    'change',
    'sole-entry',
  );
  assert.deepEqual(replay, first);
  assert.notEqual(replay, first);
  unchangedThrow(first, () =>
    observeHomeworldOccupation(
      first,
      context,
      custody,
      1,
      'turnEnd',
      'sole-entry',
    ),
  );
  unchangedThrow(first, () =>
    observeHomeworldOccupation(
      first,
      context,
      custody,
      2,
      'change',
      'sole-entry',
    ),
  );
  custody.visitors['homeworld:choam'].a.normal = 2;
  const second = observeHomeworldOccupation(
    first,
    context,
    custody,
    1,
    'change',
    'more-forces',
  );
  assert.equal(
    second.qualifications.length,
    1,
    'same world/player/turn/cause retains first qualification evidence',
  );
  unchangedThrow(second, () =>
    observeHomeworldOccupation(
      second,
      context,
      custody,
      1,
      'change',
      'sole-entry',
    ),
  );
  const unchanged = observeHomeworldOccupation(
    second,
    context,
    custody,
    1,
    'change',
    'new-wrapper-event',
  );
  assert.deepEqual(unchanged, second);
  const end = observeHomeworldOccupation(
    second,
    context,
    custody,
    2,
    'turnEnd',
    'later-boundary',
  );
  unchangedThrow(end, () =>
    observeHomeworldOccupation(end, context, custody, 1, 'change', 'backwards'),
  );
  unchangedThrow(end, () =>
    validateHomeworldOccupationHistory(end, context, 1),
  );
});

void test('saved qualifications, roster, event receipts and interned source snapshots reject corruption independently without mutation', () => {
  const { context, custody, history } = fixture();
  context.players.find((p) => p.id === 'c')!.reserves = 0;
  custody.visitors['homeworld:choam'] = { a: { normal: 1, elite: 0 } };
  const initial = observeHomeworldOccupation(
    history,
    context,
    custody,
    1,
    'change',
    'qualified',
  );
  const corruptions = [
    (h: HomeworldOccupationHistory) => {
      h.qualifications = [];
    },
    (h: HomeworldOccupationHistory) => {
      h.qualifications[0].player = 'h';
    },
    (h: HomeworldOccupationHistory) => {
      h.qualifications[0].world = 'homeworld:atreides';
    },
    (h: HomeworldOccupationHistory) => {
      h.sources[1].turn = 0;
    },
    (h: HomeworldOccupationHistory) => {
      h.sources[1].cause = 'setup';
    },
    (h: HomeworldOccupationHistory) => {
      h.sources[1].snapshot = 0;
    },
    (h: HomeworldOccupationHistory) => {
      h.sources[1].signature = '';
    },
    (h: HomeworldOccupationHistory) => {
      h.sources.push({ ...h.sources[1] });
    },
    (h: HomeworldOccupationHistory) => {
      h.snapshots.push(h.snapshots[0]);
    },
    (h: HomeworldOccupationHistory) => {
      h.snapshots[1] = '[]';
    },
    (h: HomeworldOccupationHistory) => {
      h.seats[0][0] = 'unseated';
    },
    (h: HomeworldOccupationHistory) => {
      h.signature = '';
    },
    (h: HomeworldOccupationHistory) => {
      Object.assign(h, { controller: 'a' });
    },
  ];
  for (const corrupt of corruptions) {
    const changed = reload(initial);
    corrupt(changed);
    unchangedThrow(changed, () =>
      validateHomeworldOccupationHistory(changed, context, 1),
    );
    unchangedThrow(changed, () =>
      observeHomeworldOccupation(
        changed,
        context,
        custody,
        1,
        'change',
        'must-not-adopt',
      ),
    );
    unchangedThrow(changed, () => tupileOccupationStatus(changed, context, 1));
  }
  const swapped = structuredClone(context);
  swapped.players.find((p) => p.id === 'a')!.faction = 'guild';
  unchangedThrow(initial, () =>
    validateHomeworldOccupationHistory(initial, swapped, 1),
  );
  const reordered = { ...context, players: [...context.players].reverse() };
  validateHomeworldOccupationHistory(initial, reordered, 1);
  assert.equal(tupileOccupationStatus(initial, reordered, 1), 'unknown');
});
