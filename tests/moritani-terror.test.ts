import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTerrorState,
  placeTerror,
  projectTerror,
  revealTerror,
  returnTerror,
  TERROR_COMMON_GAMEPLAY,
  TERROR_DEFINITIONS,
  TERROR_KINDS,
  TERROR_STRONGHOLDS,
  type TerrorState,
} from '../game/moritani-terror';

void test('six unique secret faces use opaque physical IDs and the supplied shuffle', () => {
  let calls = 0;
  const state = createTerrorState(() => {
    calls++;
    return 0;
  });
  assert.equal(calls, 5);
  assert.deepEqual(
    state.tokens.map((token) => token.id),
    ['terror-1', 'terror-2', 'terror-3', 'terror-4', 'terror-5', 'terror-6'],
  );
  assert.deepEqual(
    state.tokens.map((token) => token.kind).sort(),
    [...TERROR_KINDS].sort(),
  );
  assert.ok(
    state.tokens.every(
      (token) => token.status === 'available' && token.location === null,
    ),
  );
  assert.deepEqual(
    state,
    createTerrorState(() => 0),
  );
  assert.notDeepEqual(
    state.tokens.map((token) => token.kind),
    createTerrorState(() => 0.999).tokens.map((token) => token.kind),
  );
  state.tokens[0].status = 'removed';
  assert.equal(createTerrorState(() => 0).tokens[0].status, 'available');
  for (const draw of [-1, 1, Infinity, NaN])
    assert.throws(() => createTerrorState(() => draw), /random draws/);
});

void test('the public projection conceals supply IDs and every placed face while revealing spent faces', () => {
  const initial = createTerrorState(() => 0);
  assert.deepEqual(projectTerror(initial, false), { tokens: [] });
  const state: TerrorState = {
    placementTurn: 3,
    tokens: [
      { ...initial.tokens[0], status: 'placed', location: 'arrakeen' },
      { ...initial.tokens[1], status: 'removed', location: 'carthag' },
      { ...initial.tokens[2], kind: 'extortion', status: 'extortion' },
      ...initial.tokens.slice(3),
    ],
  };
  assert.deepEqual(projectTerror(state, false), {
    placementTurn: 3,
    tokens: [
      { id: 'terror-1', status: 'placed', location: 'arrakeen' },
      {
        id: 'terror-2',
        kind: state.tokens[1].kind,
        status: 'removed',
        location: null,
      },
      {
        id: 'terror-3',
        kind: 'extortion',
        status: 'extortion',
        location: null,
      },
    ],
  });
  const altered = structuredClone(state);
  altered.tokens[0].kind = 'assassination';
  altered.tokens[3].id = 'a-different-hidden-id';
  altered.tokens[3].kind = 'robbery';
  assert.deepEqual(projectTerror(altered, false), projectTerror(state, false));
});

void test('both projections clone data and exclude extra runtime fields', () => {
  const state = placeTerror(
    createTerrorState(() => 0),
    'terror-1',
    'arrakeen',
    1,
  );
  Object.assign(state, { secret: 'state secret' });
  Object.assign(state.tokens[0], { secret: 'token secret' });
  const owner = projectTerror(state, true);
  const publicView = projectTerror(state, false);
  assert.equal('secret' in owner, false);
  assert.equal('secret' in owner.tokens[0], false);
  assert.equal('secret' in publicView.tokens[0], false);
  assert.equal('kind' in publicView.tokens[0], false);
  owner.tokens[0].kind = 'assassination';
  owner.tokens[1].location = 'carthag';
  publicView.tokens[0].location = 'carthag';
  assert.equal(state.tokens[0].location, 'arrakeen');
  assert.equal(state.tokens[0].kind, 'atomics');
  assert.equal(state.tokens[1].location, null);
});

void test('placement accepts exactly the five ordinary strongholds without storm conditions', () => {
  assert.deepEqual(TERROR_STRONGHOLDS, [
    'arrakeen',
    'carthag',
    'sietch_tabr',
    'habbanya_ridge_sietch',
    'tueks_sietch',
  ]);
  const initial = createTerrorState(() => 0);
  for (const destination of TERROR_STRONGHOLDS) {
    const placed = placeTerror(initial, 'terror-1', destination, 1);
    assert.equal(placed.tokens[0].location, destination);
    assert.equal(placed.tokens[0].status, 'placed');
    assert.equal(placed.placementTurn, 1);
  }
  for (const destination of [
    'hms',
    'hidden_mobile_stronghold',
    'giedi_prime',
    'imperial_basin',
    'arrakeen:10',
    '',
  ]) {
    assert.throws(
      () => placeTerror(initial, 'terror-1', destination, 1),
      /five ordinary strongholds/,
    );
  }
  assert.ok(
    initial.tokens.every(
      (token) => token.status === 'available' && token.location === null,
    ),
  );
});

void test('relocation retains physical identity and face, spends one opportunity, and never mutates inputs', () => {
  const initial = createTerrorState(() => 0);
  const placed = placeTerror(initial, 'terror-1', 'arrakeen', 2);
  const before = structuredClone(placed);
  for (const turn of [1, 2])
    assert.throws(
      () => placeTerror(placed, 'terror-2', 'carthag', turn),
      /already been used/,
    );
  assert.throws(
    () => placeTerror(placed, 'terror-1', 'arrakeen', 3),
    /different stronghold/,
  );
  assert.throws(
    () => placeTerror(placed, 'terror-2', 'arrakeen', 3),
    /already contains/,
  );
  assert.deepEqual(placed, before);
  const moved = placeTerror(placed, 'terror-1', 'carthag', 3);
  assert.deepEqual(moved.tokens[0], {
    ...placed.tokens[0],
    location: 'carthag',
  });
  assert.equal(moved.placementTurn, 3);
  assert.deepEqual(placed, before);
  moved.tokens[1].status = 'removed';
  assert.equal(placed.tokens[1].status, 'available');
  assert.equal(initial.tokens[0].status, 'available');
});

void test('invalid turns and unavailable or ambiguous token selections leave custody untouched', () => {
  const state = createTerrorState(() => 0);
  const before = structuredClone(state);
  for (const turn of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => placeTerror(state, 'terror-1', 'arrakeen', turn),
      /valid turn/,
    );
  }
  assert.throws(
    () => placeTerror(state, 'unknown', 'arrakeen', 1),
    /Choose a Terror token/,
  );
  const duplicate = { tokens: [...state.tokens, { ...state.tokens[0] }] };
  assert.throws(
    () => placeTerror(duplicate, 'terror-1', 'arrakeen', 1),
    /Choose a Terror token/,
  );
  for (const status of ['removed', 'extortion'] as const) {
    const unavailable = structuredClone(state);
    unavailable.tokens[0].status = status;
    assert.throws(
      () => placeTerror(unavailable, 'terror-1', 'arrakeen', 1),
      /not available/,
    );
  }
  assert.deepEqual(state, before);
});

void test('six immutable component guides distinguish source verification from unfinished runtime effects', () => {
  assert.deepEqual(
    Object.keys(TERROR_DEFINITIONS).sort(),
    [...TERROR_KINDS].sort(),
  );
  assert.deepEqual(
    TERROR_KINDS.map((kind) => TERROR_DEFINITIONS[kind].name),
    [
      'Assassination',
      'Atomics',
      'Extortion',
      'Robbery',
      'Sabotage',
      'Sneak Attack',
    ],
  );
  assert.ok(Object.isFrozen(TERROR_DEFINITIONS));
  assert.ok(Object.isFrozen(TERROR_KINDS));
  assert.ok(Object.isFrozen(TERROR_STRONGHOLDS));
  assert.ok(Object.isFrozen(TERROR_COMMON_GAMEPLAY));
  for (const kind of TERROR_KINDS) {
    const definition = TERROR_DEFINITIONS[kind];
    assert.equal(definition.kind, kind);
    assert.equal(definition.quantity, 1);
    assert.ok(definition.summary.length > 30);
    assert.ok(definition.gameplay.length > TERROR_COMMON_GAMEPLAY.length);
    assert.ok(
      definition.gameplay.every(
        (paragraph) => paragraph.length > 30 && !/https?:\/\//.test(paragraph),
      ),
    );
    assert.equal(definition.verification.inventory, 'verified');
    assert.equal(definition.verification.sourceRules, 'verified');
    assert.equal(
      definition.verification.runtimeEffects,
      ['robbery', 'sabotage', 'assassination', 'sneakAttack'].includes(kind)
        ? 'partial'
        : 'not-implemented',
    );
    assert.equal(definition.verification.componentArtwork, 'not-verified');
    assert.ok(Object.isFrozen(definition));
    assert.ok(Object.isFrozen(definition.gameplay));
    assert.ok(Object.isFrozen(definition.verification));
    assert.ok(Object.isFrozen(definition.verification.unresolved));
  }
});

void test('revelation removes ordinary tokens and sets Extortion aside without changing other custody', () => {
  for (const kind of TERROR_KINDS) {
    const state = createTerrorState(() => 0);
    const token = state.tokens.find((candidate) => candidate.kind === kind)!;
    const placed = placeTerror(
      { ...state, supplyEpoch: 4 },
      token.id,
      'arrakeen',
      2,
    );
    const before = structuredClone(placed);
    const revealed = revealTerror(placed, token.id);
    assert.deepEqual(
      revealed.tokens.find((candidate) => candidate.id === token.id),
      {
        ...token,
        status: kind === 'extortion' ? 'extortion' : 'removed',
        location: null,
      },
    );
    assert.equal(revealed.placementTurn, 2);
    assert.equal(revealed.supplyEpoch, 4);
    assert.deepEqual(placed, before);
    assert.ok(
      revealed.tokens.every(
        (candidate, index) => candidate !== placed.tokens[index],
      ),
    );
    assert.throws(
      () => revealTerror(revealed, token.id),
      /placed Terror token/,
    );
  }
  const initial = createTerrorState(() => 0);
  assert.throws(
    () => revealTerror(initial, initial.tokens[0].id),
    /placed Terror token/,
  );
  assert.throws(() => revealTerror(initial, 'unknown'), /placed Terror token/);
  const placed = placeTerror(initial, initial.tokens[0].id, 'arrakeen', 1);
  assert.throws(
    () =>
      revealTerror(
        { tokens: [placed.tokens[0], placed.tokens[0]] },
        placed.tokens[0].id,
      ),
    /placed Terror token/,
  );
});

void test('return rotates the complete available supply and keeps unrelated public identities stable', () => {
  let state = createTerrorState(() => 0);
  const extortion = state.tokens.find((token) => token.kind === 'extortion')!;
  const robbery = state.tokens.find((token) => token.kind === 'robbery')!;
  const atomics = state.tokens.find((token) => token.kind === 'atomics')!;
  state = placeTerror(state, extortion.id, 'arrakeen', 1);
  state = revealTerror(state, extortion.id);
  state = placeTerror(state, robbery.id, 'carthag', 2);
  state = placeTerror(state, atomics.id, 'sietch_tabr', 3);
  state = revealTerror(state, atomics.id);
  const before = structuredClone(state);
  const result = returnTerror(state, extortion.id, () => 0);
  assert.deepEqual(state, before);
  assert.equal(result.supplyEpoch, 1);
  assert.equal(result.placementTurn, 3);
  const supply = result.tokens.filter((token) => token.status === 'available');
  assert.equal(supply.length, 4);
  assert.ok(
    supply.every(
      (token) =>
        token.location === null &&
        !state.tokens.some((old) => old.id === token.id),
    ),
  );
  assert.deepEqual(
    supply.map((token) => token.id),
    [
      'terror-supply-1-1',
      'terror-supply-1-2',
      'terror-supply-1-3',
      'terror-supply-1-4',
    ],
  );
  for (const id of [robbery.id, atomics.id])
    assert.deepEqual(
      result.tokens.find((token) => token.id === id),
      state.tokens.find((token) => token.id === id),
    );
  assert.equal('supplyEpoch' in projectTerror(result, true), false);
  assert.equal('supplyEpoch' in projectTerror(result, false), false);
  assert.deepEqual(
    projectTerror(result, false).tokens,
    projectTerror(state, false).tokens.filter(
      (token) => token.id !== extortion.id,
    ),
  );
  result.tokens[0].location = 'arrakeen';
  assert.deepEqual(state, before);
});

void test('fresh random supply slots break returned-face and previous array-position associations', () => {
  let state = createTerrorState(() => 0);
  const token = state.tokens.find(
    (candidate) => candidate.kind === 'extortion',
  )!;
  state = revealTerror(placeTerror(state, token.id, 'arrakeen', 1), token.id);
  const low = returnTerror(state, token.id, () => 0);
  const high = returnTerror(state, token.id, () => 0.999);
  assert.deepEqual(projectTerror(low, false), projectTerror(high, false));
  assert.deepEqual(
    low.tokens.map((candidate) => candidate.id),
    high.tokens.map((candidate) => candidate.id),
  );
  assert.notEqual(
    low.tokens.find((candidate) => candidate.kind === 'extortion')!.id,
    high.tokens.find((candidate) => candidate.kind === 'extortion')!.id,
  );
  assert.notDeepEqual(
    low.tokens.map((candidate) => candidate.kind),
    high.tokens.map((candidate) => candidate.kind),
  );
  const lowPlaced = placeTerror(low, low.tokens[0].id, 'carthag', 2);
  const highPlaced = placeTerror(high, high.tokens[0].id, 'carthag', 2);
  assert.notEqual(lowPlaced.tokens[0].kind, highPlaced.tokens[0].kind);
  assert.deepEqual(
    projectTerror(lowPlaced, false),
    projectTerror(highPlaced, false),
  );
  assert.equal(lowPlaced.supplyEpoch, 1);
  const returnedAgain = returnTerror(
    lowPlaced,
    lowPlaced.tokens[0].id,
    () => 0,
  );
  assert.equal(returnedAgain.supplyEpoch, 2);
  assert.ok(
    returnedAgain.tokens.every((candidate) =>
      candidate.id.startsWith('terror-supply-2-'),
    ),
  );
  assert.equal(returnedAgain.placementTurn, 2);
});

void test('invalid return custody, randomness, and epochs fail without mutating the state', () => {
  const initial = createTerrorState(() => 0);
  assert.throws(
    () => returnTerror(initial, initial.tokens[0].id, () => 0),
    /placed Terror token or revealed Extortion/,
  );
  assert.throws(
    () => returnTerror(initial, 'unknown', () => 0),
    /placed Terror token or revealed Extortion/,
  );
  const placed = placeTerror(initial, initial.tokens[0].id, 'arrakeen', 1);
  const removed = revealTerror(placed, placed.tokens[0].id);
  assert.throws(
    () => returnTerror(removed, removed.tokens[0].id, () => 0),
    /placed Terror token or revealed Extortion/,
  );
  assert.throws(
    () =>
      returnTerror(
        { tokens: [placed.tokens[0], placed.tokens[0]] },
        placed.tokens[0].id,
        () => 0,
      ),
    /placed Terror token or revealed Extortion/,
  );
  const before = structuredClone(placed);
  for (const value of [-1, 1, Infinity, NaN])
    assert.throws(
      () => returnTerror(placed, placed.tokens[0].id, () => value),
      /random draws/,
    );
  for (const supplyEpoch of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])
    assert.throws(
      () =>
        returnTerror({ ...placed, supplyEpoch }, placed.tokens[0].id, () => 0),
      /epoch is invalid/,
    );
  assert.deepEqual(placed, before);
  const reused = structuredClone(placed);
  reused.tokens[1].id = 'terror-supply-1-1';
  assert.throws(
    () => returnTerror(reused, reused.tokens[0].id, () => 0),
    /reuse an existing identity/,
  );
});
