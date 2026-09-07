import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRemainingCohort,
  validateCohortSelection,
  type MovementCohort,
  type MovementMarker,
} from '../game/ornithopter';

void test('a multi-sector first group leaves independent ordinary and elite counts, including same-origin residual groups', () => {
  const all = { 'shield_wall:7': 4, 'shield_wall:8': 3, 'arrakeen:10': 2 };
  const elites = { 'shield_wall:7': 2, 'shield_wall:8': 1 };
  const selected = { 'shield_wall:7': 2, 'shield_wall:8': 1 };
  const typed = { 'shield_wall:7': 1 };
  const before = structuredClone({ all, elites, selected, typed });
  const remaining = createRemainingCohort(all, elites, selected, typed);
  assert.deepEqual(remaining, {
    forces: { 'shield_wall:7': 2, 'shield_wall:8': 2, 'arrakeen:10': 2 },
    elites: { 'shield_wall:7': 1, 'shield_wall:8': 1 },
  });
  assert.doesNotThrow(() =>
    validateCohortSelection(
      remaining,
      remaining.forces,
      remaining.elites,
      { 'shield_wall:7': 2, 'shield_wall:8': 1 },
      { 'shield_wall:7': 1, 'shield_wall:8': 1 },
    ),
  );
  assert.deepEqual({ all, elites, selected, typed }, before);
});

void test('first-group arrivals cannot enlarge a destination quota or become a second group at an empty original destination', () => {
  const remaining = createRemainingCohort(
    { origin: 4, destination: 2 },
    { origin: 1 },
    { origin: 3 },
    { origin: 1 },
  );
  const current = { origin: 1, destination: 5 },
    elites = { destination: 1 };
  assert.doesNotThrow(() =>
    validateCohortSelection(remaining, current, elites, { destination: 2 }, {}),
  );
  assert.throws(
    () =>
      validateCohortSelection(
        remaining,
        current,
        elites,
        { destination: 3 },
        {},
      ),
    /unmoved cohort/,
  );
  assert.throws(
    () =>
      validateCohortSelection(
        remaining,
        current,
        elites,
        { destination: 1 },
        { destination: 1 },
      ),
    /unmoved cohort/,
  );
  const empty = createRemainingCohort({ origin: 4 }, {}, { origin: 4 }, {});
  assert.throws(
    () =>
      validateCohortSelection(
        empty,
        { destination: 4 },
        {},
        { destination: 1 },
        {},
      ),
    /unmoved cohort/,
  );
});

void test('typed quotas reject ordinary-for-elite substitutions even when total force counts fit', () => {
  assert.throws(
    () => createRemainingCohort({ a: 3 }, { a: 2 }, { a: 2 }, {}),
    /ordinary or elite/,
  );
  assert.throws(
    () => createRemainingCohort({ a: 3 }, { a: 1 }, { a: 2 }, { a: 2 }),
    /ordinary or elite/,
  );
  const cohort = createRemainingCohort({ a: 4 }, { a: 2 }, { a: 1 }, {});
  assert.deepEqual(cohort, { forces: { a: 3 }, elites: { a: 2 } });
  assert.throws(
    () => validateCohortSelection(cohort, { a: 3 }, { a: 2 }, { a: 2 }, {}),
    /unmoved cohort/,
  );
  assert.throws(
    () => validateCohortSelection(cohort, { a: 3 }, {}, { a: 2 }, { a: 1 }),
    /current physical/,
  );
  assert.throws(
    () => validateCohortSelection(cohort, { a: 2 }, { a: 2 }, { a: 1 }, {}),
    /current physical/,
  );
});

void test('current losses limit remaining selections without increasing their original allowance', () => {
  const cohort = createRemainingCohort({ a: 5, b: 4 }, { b: 2 }, { a: 2 }, {});
  assert.throws(
    () =>
      validateCohortSelection(cohort, { a: 1, b: 4 }, { b: 2 }, { a: 2 }, {}),
    /current physical/,
  );
  assert.doesNotThrow(() =>
    validateCohortSelection(
      cohort,
      { a: 1, b: 3 },
      { b: 1 },
      { a: 1, b: 3 },
      { b: 1 },
    ),
  );
});

void test('marker selection binds exact identity, event and origin and cannot be reused with a new event', () => {
  const marker = {
    tokenId: 'opaque-id',
    event: 'before-move',
    from: 'shield_wall:8',
  };
  const unmoved = createRemainingCohort({ a: 1 }, {}, { a: 1 }, {}, marker);
  assert.deepEqual(unmoved, { forces: {}, elites: {}, noField: marker });
  assert.notEqual(unmoved.noField, marker);
  assert.doesNotThrow(() =>
    validateCohortSelection(unmoved, {}, {}, {}, {}, marker),
  );
  for (const changed of [
    { ...marker, event: 'new-event' },
    { ...marker, tokenId: 'another' },
    { ...marker, from: 'arrakeen:10' },
  ]) {
    assert.throws(
      () => validateCohortSelection(unmoved, {}, {}, {}, {}, changed),
      /not an unmoved/,
    );
    assert.throws(
      () => createRemainingCohort({}, {}, {}, {}, marker, changed),
      /not an unmoved/,
    );
  }
  const moved = createRemainingCohort(
    { a: 2 },
    {},
    { a: 1 },
    {},
    marker,
    marker,
  );
  assert.equal(moved.noField, undefined);
  for (const selected of [
    marker,
    { ...marker, event: 'after-move', from: 'arrakeen:10' },
  ])
    assert.throws(
      () => validateCohortSelection(moved, { a: 1 }, {}, {}, {}, selected),
      /not an unmoved/,
    );
});

void test('marker cohort calculation neither reads nor projects any hidden denomination', () => {
  for (const value of [0, 3, 5]) {
    const marker = {
      tokenId: 'same-opaque',
      event: 'same-event',
      from: 'polar_sink:0',
      value,
    };
    const expected = {
      forces: {},
      elites: {},
      noField: {
        tokenId: marker.tokenId,
        event: marker.event,
        from: marker.from,
      },
    };
    assert.deepEqual(createRemainingCohort({}, {}, {}, {}, marker), expected);
  }
  const marker = {
    tokenId: 'opaque',
    event: 'event',
    from: 'polar_sink:0',
    get value(): never {
      throw new Error('Hidden denomination read');
    },
  };
  const cohort = createRemainingCohort({}, {}, {}, {}, marker);
  assert.doesNotThrow(() =>
    validateCohortSelection(cohort, {}, {}, {}, {}, marker),
  );
  assert.equal(JSON.stringify(cohort).includes('value'), false);
});

void test('JSON-restored cohorts validate without mutation and outputs do not alias input records', () => {
  const forces = { a: 3, b: 0 },
    elites = { a: 1 },
    selected = { a: 1 },
    selectedElites = {};
  const cohort = createRemainingCohort(
    forces,
    elites,
    selected,
    selectedElites,
  );
  const restored: MovementCohort = JSON.parse(JSON.stringify(cohort));
  const before = structuredClone(restored);
  validateCohortSelection(restored, { a: 2 }, { a: 1 }, { a: 2 }, { a: 1 });
  assert.deepEqual(restored, before);
  cohort.forces.a = 99;
  cohort.elites.a = 99;
  assert.deepEqual(forces, { a: 3, b: 0 });
  assert.deepEqual(elites, { a: 1 });
  assert.deepEqual(selected, { a: 1 });
  assert.deepEqual(restored, { forces: { a: 2 }, elites: { a: 1 } });
});

void test('malformed counts, impossible typed pools and restored markers fail before mutation', () => {
  for (const count of [
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '1',
    undefined,
  ]) {
    const bad = { a: count } as Record<string, number>;
    assert.throws(() => createRemainingCohort(bad, {}, {}, {}), /safe integer/);
    assert.throws(
      () => createRemainingCohort({ a: 2 }, {}, bad, {}),
      /safe integer/,
    );
    assert.throws(
      () =>
        validateCohortSelection({ forces: bad, elites: {} }, {}, {}, {}, {}),
      /safe integer/,
    );
    assert.throws(
      () =>
        validateCohortSelection({ forces: {}, elites: {} }, bad, {}, {}, {}),
      /safe integer/,
    );
  }
  for (const bad of [null, [], 2])
    assert.throws(
      () =>
        createRemainingCohort(
          bad as unknown as Record<string, number>,
          {},
          {},
          {},
        ),
      /record/,
    );
  assert.throws(
    () =>
      createRemainingCohort({ a: Number.MAX_SAFE_INTEGER, b: 1 }, {}, {}, {}),
    /total/,
  );
  assert.throws(
    () => createRemainingCohort({ '': 1 }, {}, {}, {}),
    /named locations/,
  );
  assert.throws(
    () => createRemainingCohort({ a: 1 }, { a: 2 }, {}, {}),
    /elite count/,
  );
  assert.throws(
    () => createRemainingCohort({ a: 1 }, {}, { a: 1 }, { b: 1 }),
    /elite count/,
  );
  for (const marker of [
    null,
    {},
    { tokenId: 'id', event: '', from: 'a' },
    { tokenId: 'id', event: 'event', from: 1 },
  ]) {
    const invalid = marker as unknown as MovementMarker;
    assert.throws(
      () => createRemainingCohort({}, {}, {}, {}, invalid),
      /marker/,
    );
    assert.throws(
      () =>
        validateCohortSelection(
          { forces: {}, elites: {}, noField: invalid },
          {},
          {},
          {},
          {},
        ),
      /marker/,
    );
  }
});
