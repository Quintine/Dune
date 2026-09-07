import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderedOpportunityError,
  protectOrderedOpportunityLast,
  reorderOrderedOpportunity,
  validateOrderedOpportunity,
  type OrderedOpportunity,
} from '../game/ordered-opportunity';

function fixture(
  remaining = ['a', 'b', 'c', 'd'],
  completed: string[] = [],
): OrderedOpportunity {
  return {
    event: 'movement-turn-4',
    eligible: [...completed, ...remaining],
    remaining,
    completed,
    current: remaining[0] ?? null,
    currentStarted: false,
  };
}
function freeze(state: OrderedOpportunity) {
  Object.freeze(state.eligible);
  Object.freeze(state.remaining);
  Object.freeze(state.completed);
  return Object.freeze(state);
}
function move(
  state: OrderedOpportunity,
  player: string,
  position: 'first' | 'last',
) {
  return reorderOrderedOpportunity(state, {
    event: state.event,
    player,
    position,
  });
}
function permutations(values: string[]): string[][] {
  return values.length
    ? values.flatMap((value, index) =>
        permutations(values.filter((_, at) => at !== index)).map((tail) => [
          value,
          ...tail,
        ]),
      )
    : [[]];
}

void test('first and last reorder every unstarted position immutably and leave completed work intact', () => {
  const state = freeze(fixture(['a', 'b', 'c', 'd'], ['done']));
  for (const player of state.remaining) {
    for (const position of ['first', 'last'] as const) {
      const result = move(state, player, position);
      const rest = state.remaining.filter((id) => id !== player);
      assert.deepEqual(
        result.remaining,
        position === 'first' ? [player, ...rest] : [...rest, player],
      );
      assert.deepEqual(result.eligible, state.eligible);
      assert.deepEqual(result.completed, ['done']);
      assert.equal(result.event, state.event);
      assert.equal(result.currentStarted, false);
      assert.equal(result.current, result.remaining[0]);
      assert.notEqual(result, state);
      for (const key of ['remaining', 'completed', 'eligible'] as const)
        assert.notEqual(result[key], state[key]);
    }
  }
  assert.deepEqual(state, fixture(['a', 'b', 'c', 'd'], ['done']));
});

void test('every finite four-player ordering and completion boundary conserves participants and a started current unit', () => {
  let cases = 0;
  for (const order of permutations(['a', 'b', 'c', 'd'])) {
    for (
      let completedCount = 0;
      completedCount <= order.length;
      completedCount++
    ) {
      for (const started of [false, true]) {
        const remaining = order.slice(completedCount);
        if (started && !remaining.length) continue;
        const state = freeze({
          ...fixture(remaining, order.slice(0, completedCount)),
          currentStarted: started,
        });
        validateOrderedOpportunity(state);
        for (const player of remaining) {
          for (const position of ['first', 'last'] as const) {
            cases++;
            if (
              started &&
              player === state.current &&
              position === 'last' &&
              remaining.length > 1
            ) {
              assert.throws(
                () => move(state, player, position),
                /split a started opportunity/,
              );
              continue;
            }
            const result = move(state, player, position);
            validateOrderedOpportunity(result);
            assert.deepEqual(
              [...result.remaining].sort(),
              [...remaining].sort(),
            );
            assert.deepEqual(result.completed, state.completed);
            assert.deepEqual(result.eligible, state.eligible);
            assert.equal(result.currentStarted, started);
            if (started) assert.equal(result.current, state.current);
            const unstarted = result.remaining.slice(started ? 1 : 0);
            if (!(started && player === state.current))
              assert.equal(
                position === 'first' ? unstarted[0] : unstarted.at(-1),
                player,
              );
          }
        }
      }
    }
  }
  assert.equal(cases, 960);
});

void test('first targets the unstarted remainder without interrupting or splitting the locked current actor', () => {
  const state = freeze({ ...fixture(), currentStarted: true });
  assert.deepEqual(move(state, 'd', 'first').remaining, ['a', 'd', 'b', 'c']);
  assert.deepEqual(move(state, 'b', 'last').remaining, ['a', 'c', 'd', 'b']);
  assert.deepEqual(move(state, 'a', 'first'), state);
  assert.throws(() => move(state, 'a', 'last'), /unsupported/);
  assert.throws(
    () =>
      protectOrderedOpportunityLast(state, { event: state.event, player: 'a' }),
    /unsupported/,
  );
  const sole = freeze({
    ...fixture(['a'], ['b', 'c', 'd']),
    currentStarted: true,
  });
  assert.deepEqual(move(sole, 'a', 'last'), sole);
});

void test('protected last survives repeated Guild deferral and earlier Guild turns without overriding competing priority', () => {
  const initial = freeze(fixture(['sapho', 'a', 'guild', 'b']));
  const protectedState = protectOrderedOpportunityLast(initial, {
    event: initial.event,
    player: 'sapho',
  });
  assert.deepEqual(protectedState.remaining, ['a', 'guild', 'b', 'sapho']);
  assert.equal(protectedState.protectedLast, 'sapho');
  let state = move(protectedState, 'guild', 'last');
  assert.deepEqual(state.remaining, ['a', 'b', 'guild', 'sapho']);
  for (let i = 0; i < 4; i++) state = move(state, 'guild', 'last');
  assert.deepEqual(state.remaining, ['a', 'b', 'guild', 'sapho']);
  state = move(state, 'guild', 'first');
  assert.deepEqual(state.remaining, ['guild', 'a', 'b', 'sapho']);
  assert.deepEqual(move(state, 'guild', 'last').remaining, [
    'a',
    'b',
    'guild',
    'sapho',
  ]);
  const locked = { ...protectedState, currentStarted: true };
  assert.deepEqual(move(locked, 'guild', 'last').remaining, [
    'a',
    'b',
    'guild',
    'sapho',
  ]);
  assert.deepEqual(move(locked, 'guild', 'first').remaining, [
    'a',
    'guild',
    'b',
    'sapho',
  ]);
  assert.throws(() => move(protectedState, 'sapho', 'first'), /protected last/);
  assert.throws(
    () =>
      protectOrderedOpportunityLast(protectedState, {
        event: state.event,
        player: 'guild',
      }),
    /Competing/,
  );
  assert.deepEqual(
    protectOrderedOpportunityLast(protectedState, {
      event: state.event,
      player: 'sapho',
    }),
    protectedState,
  );
  assert.deepEqual(initial, fixture(['sapho', 'a', 'guild', 'b']));
});

void test('stale events, completed actors and ineligible IDs reject without resurrecting or granting an opportunity', () => {
  const state = freeze(fixture(['b', 'c'], ['a']));
  for (const position of ['first', 'last'] as const) {
    assert.throws(
      () =>
        reorderOrderedOpportunity(state, {
          event: 'old-event',
          player: 'b',
          position,
        }),
      /expired/,
    );
    assert.throws(() => move(state, 'a', position), /already completed/);
    assert.throws(() => move(state, 'observer', position), /not eligible/);
  }
  assert.throws(
    () =>
      protectOrderedOpportunityLast(state, { event: 'old-event', player: 'b' }),
    /expired/,
  );
  assert.throws(
    () =>
      protectOrderedOpportunityLast(state, { event: state.event, player: 'a' }),
    /already completed/,
  );
  const closed = freeze(fixture([], ['a', 'b', 'c']));
  validateOrderedOpportunity(closed);
  assert.throws(() => move(closed, 'a', 'first'), /already completed/);
  assert.deepEqual(state, fixture(['b', 'c'], ['a']));
});

void test('malformed serialized partitions, current markers and protected positions are rejected rather than repaired', () => {
  const state = fixture(['a', 'b'], ['done']);
  const corrupt: unknown[] = [
    null,
    {},
    { ...state, event: '' },
    { ...state, eligible: ['done', 'a', 'a'] },
    { ...state, remaining: ['a', 'a'] },
    { ...state, completed: ['done', 'done'] },
    { ...state, remaining: ['a'] },
    { ...state, remaining: ['a', 'other'] },
    { ...state, completed: ['a'] },
    { ...state, remaining: ['a', ''] },
    { ...state, current: 'b' },
    { ...state, current: null },
    { ...state, currentStarted: 'yes' },
    { ...fixture([], ['done']), currentStarted: true },
    { ...state, protectedLast: 'a' },
    { ...state, protectedLast: 'done' },
    { ...state, protectedLast: 'other' },
  ];
  for (const value of corrupt) {
    assert.throws(
      () => validateOrderedOpportunity(value as OrderedOpportunity),
      OrderedOpportunityError,
    );
    assert.throws(
      () =>
        reorderOrderedOpportunity(value as OrderedOpportunity, {
          event: state.event,
          player: 'a',
          position: 'first',
        }),
      OrderedOpportunityError,
    );
  }
  assert.throws(
    () =>
      reorderOrderedOpportunity(state, {
        event: state.event,
        player: 'a',
        position: 'middle' as 'first',
      }),
    /Choose first or last/,
  );
});

void test('JSON snapshots preserve scope and protection, and no-op results share no participant arrays', () => {
  const first = protectOrderedOpportunityLast(
    fixture(['a', 'guild', 'sapho']),
    { event: 'movement-turn-4', player: 'sapho' },
  );
  const saved: OrderedOpportunity = JSON.parse(
    JSON.stringify({ ...first, currentStarted: true }),
  );
  const restored = move(freeze(saved), 'guild', 'last');
  assert.deepEqual(restored, saved);
  assert.notEqual(restored.remaining, saved.remaining);
  assert.notEqual(restored.eligible, saved.eligible);
  assert.notEqual(restored.completed, saved.completed);
  assert.equal(restored.event, 'movement-turn-4');
  assert.equal(restored.protectedLast, 'sapho');
  assert.equal(restored.currentStarted, true);
});
