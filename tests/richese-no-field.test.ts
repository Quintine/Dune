import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRicheseNoField,
  validateRicheseNoField,
  deployRicheseNoField,
  moveRicheseNoField,
  revealRicheseNoField,
  shipAlliedRicheseNoField,
  projectRicheseNoField,
  type RicheseNoField,
  type NoFieldValue,
  type NoFieldRevealCause,
} from '../game/richese-no-field';

const ids = ['opaque-a', 'opaque-b', 'opaque-c'];
const location = { territory: 'imperial_basin', sector: 10 };
const fresh = () => createRicheseNoField(ids);
function deployed(value: NoFieldValue = 5) {
  const state = fresh();
  const tokenId = state.tokens.find((token) => token.value === value)!.id;
  return deployRicheseNoField(state, {
    tokenId,
    controller: 'richese',
    location,
  });
}
function reveal(
  state: RicheseNoField,
  reserves = 20,
  cause: NoFieldRevealCause = 'voluntary',
) {
  return revealRicheseNoField(state, {
    tokenId: state.deployed!.tokenId,
    reserves,
    cause,
  });
}

void test('the model has exactly three distinct physical tokens zero/three/five outside force custody', () => {
  const state = fresh();
  assert.deepEqual(state.tokens, [
    { id: ids[0], value: 0 },
    { id: ids[1], value: 3 },
    { id: ids[2], value: 5 },
  ]);
  assert.equal(state.deployed, null);
  assert.equal(state.lastShipped, null);
  assert.deepEqual(projectRicheseNoField(state, false), {
    deployed: null,
    lastUsed: null,
  });
  assert.throws(() => createRicheseNoField(['x', 'y']), /three/);
  assert.throws(() => createRicheseNoField(['x', 'x', 'z']), /distinct/);
  assert.throws(() => createRicheseNoField(['x', '', 'z']), /identities/);
  assert.deepEqual(ids, ['opaque-a', 'opaque-b', 'opaque-c']);
});

void test('deserialized inventory, history and deployed references are validated before operations and projection', () => {
  const corruptions = [
    (s: RicheseNoField) => {
      s.tokens.pop();
    },
    (s: RicheseNoField) => {
      s.tokens[1].id = s.tokens[0].id;
    },
    (s: RicheseNoField) => {
      s.tokens[1].value = 0;
    },
    (s: RicheseNoField) => {
      s.tokens[0].value = 9 as NoFieldValue;
    },
    (s: RicheseNoField) => {
      s.lastShipped = 'missing';
    },
    (s: RicheseNoField) => {
      s.lastShipped = ids[0];
    },
    (s: RicheseNoField) => {
      s.deployed!.tokenId = 'missing';
    },
    (s: RicheseNoField) => {
      s.deployed!.controller = '';
    },
    (s: RicheseNoField) => {
      s.deployed!.location.sector = 19;
    },
    (s: RicheseNoField) => {
      delete (s as Partial<RicheseNoField>).deployed;
    },
  ];
  for (const corrupt of corruptions) {
    const state: RicheseNoField = JSON.parse(JSON.stringify(deployed()));
    corrupt(state);
    assert.throws(() => validateRicheseNoField(state));
    assert.throws(() => projectRicheseNoField(state, false));
    assert.throws(() => moveRicheseNoField(state, ids[2], location));
    assert.throws(() =>
      revealRicheseNoField(state, {
        tokenId: ids[2],
        reserves: 20,
        cause: 'battle',
      }),
    );
  }
});

void test('one deployed marker is enforced even when it represents zero forces', () => {
  for (const value of [0, 3, 5] as const) {
    const state = deployed(value);
    const snapshot = structuredClone(state);
    assert.throws(
      () =>
        deployRicheseNoField(state, {
          tokenId: ids[1],
          controller: 'ally',
          location,
        }),
      /existing/,
    );
    assert.throws(
      () =>
        shipAlliedRicheseNoField(
          state,
          { tokenId: ids[1], controller: 'ally', location },
          20,
        ),
      /existing/,
    );
    assert.deepEqual(state, snapshot);
    assert.equal(
      projectRicheseNoField(state, false).deployed!.effectiveForces,
      1,
    );
  }
});

void test('concealed public views are identical for all denominations and expose neither supply nor physical IDs', () => {
  const views = ([0, 3, 5] as const).map((value) =>
    projectRicheseNoField(deployed(value), false),
  );
  assert.deepEqual(views[0], views[1]);
  assert.deepEqual(views[1], views[2]);
  for (const view of views) {
    const json = JSON.stringify(view);
    for (const id of ids) assert.equal(json.includes(id), false);
    assert.equal('tokens' in view, false);
    assert.equal('private' in view, false);
    assert.equal(view.lastUsed, null);
  }
  const own = projectRicheseNoField(deployed(3), true);
  assert.equal(
    own.private.tokens.find(
      (token) => token.id === own.private.deployed!.tokenId,
    )!.value,
    3,
  );
});

void test('moving preserves hidden identity/history and exact sector without materializing reserves', () => {
  const state = deployed();
  const moved = moveRicheseNoField(state, ids[2], {
    territory: 'imperial_basin',
    sector: 9,
  });
  assert.equal(state.deployed!.location.sector, 10);
  assert.equal(moved.deployed!.location.sector, 9);
  assert.equal(moved.lastShipped, ids[2]);
  assert.deepEqual(moved.tokens, state.tokens);
  assert.equal(
    projectRicheseNoField(moved, false).deployed!.effectiveForces,
    1,
  );
  assert.throws(
    () => moveRicheseNoField(state, ids[0], location),
    /not deployed/,
  );
  for (const sector of [0, 19, 1.5, NaN, Infinity])
    assert.throws(
      () => moveRicheseNoField(state, ids[2], { ...location, sector }),
      /sector/,
    );
});

void test('every reveal cause returns capped physical materialization and the actual value without allocating casualties', () => {
  const causes: NoFieldRevealCause[] = [
    'voluntary',
    'battle',
    'storm',
    'worm',
    'gamont',
    'beforeAlly',
    'allyShipment',
  ];
  for (const cause of causes)
    for (const value of [0, 3, 5] as const)
      for (const reserves of [0, 1, 2, 3, 4, 5, 20]) {
        const state = deployed(value);
        const result = reveal(state, reserves, cause);
        assert.equal(result.forces, Math.min(value, reserves));
        assert.equal(result.value, value);
        assert.equal(result.cause, cause);
        assert.equal(result.controller, 'richese');
        assert.deepEqual(result.location, location);
        assert.equal(result.state.deployed, null);
        assert.equal(result.state.lastShipped, state.lastShipped);
        assert.deepEqual(result.state.tokens, state.tokens);
        assert.equal(
          projectRicheseNoField(result.state, false).lastUsed,
          value,
        );
        assert.ok(state.deployed);
        assert.equal('tanks' in result, false);
      }
});

void test('revealing returns component custody but cannot erase the consecutive-use restriction', () => {
  let state = reveal(deployed(5), 2, 'storm').state;
  assert.equal(projectRicheseNoField(state, false).lastUsed, 5);
  assert.throws(
    () =>
      deployRicheseNoField(state, {
        tokenId: ids[2],
        controller: 'richese',
        location,
      }),
    /twice/,
  );
  state = deployRicheseNoField(state, {
    tokenId: ids[0],
    controller: 'richese',
    location,
  });
  assert.equal(projectRicheseNoField(state, false).lastUsed, null);
  state = reveal(state).state;
  assert.equal(projectRicheseNoField(state, false).lastUsed, 0);
  state = deployRicheseNoField(state, {
    tokenId: ids[2],
    controller: 'richese',
    location,
  });
  assert.equal(state.lastShipped, ids[2]);
  assert.equal(state.tokens.length, 3);
});

void test('allied shipment reveals immediately from the ally reserves and shares the same last-shipped history', () => {
  let state = reveal(deployed(0), 20, 'beforeAlly').state;
  const result = shipAlliedRicheseNoField(
    state,
    { tokenId: ids[2], controller: 'ally', location },
    2,
  );
  assert.equal(result.forces, 2);
  assert.equal(result.controller, 'ally');
  assert.equal(result.cause, 'allyShipment');
  assert.equal(result.state.deployed, null);
  assert.equal(result.state.lastShipped, ids[2]);
  assert.equal(projectRicheseNoField(result.state, false).lastUsed, 5);
  state = result.state;
  assert.throws(
    () =>
      shipAlliedRicheseNoField(
        state,
        { tokenId: ids[2], controller: 'different-ally', location },
        20,
      ),
    /twice/,
  );
  assert.throws(
    () =>
      deployRicheseNoField(state, {
        tokenId: ids[2],
        controller: 'richese',
        location,
      }),
    /twice/,
  );
  const zero = shipAlliedRicheseNoField(
    state,
    { tokenId: ids[0], controller: 'ally', location },
    20,
  );
  assert.equal(zero.forces, 0);
  assert.equal(zero.state.lastShipped, ids[0]);
});

void test('failed allied materialization does not partially consume the selected token or rewrite history', () => {
  const state = reveal(deployed(0)).state;
  const exact = structuredClone(state);
  for (const reserves of [-1, NaN, 2.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(
      () =>
        shipAlliedRicheseNoField(
          state,
          { tokenId: ids[2], controller: 'ally', location },
          reserves,
        ),
      /reserves/,
    );
  assert.deepEqual(state, exact);
});

void test('repeated or wrong-token reveal fails while JSON restoration resumes the same physical marker', () => {
  const state = deployed(3);
  const saved = JSON.stringify(state);
  const loaded = JSON.parse(saved) as RicheseNoField;
  assert.throws(
    () =>
      revealRicheseNoField(loaded, {
        tokenId: ids[2],
        reserves: 20,
        cause: 'battle',
      }),
    /not deployed/,
  );
  const result = reveal(loaded, 2, 'battle');
  assert.equal(result.tokenId, ids[1]);
  assert.equal(result.forces, 2);
  assert.throws(
    () =>
      revealRicheseNoField(result.state, {
        tokenId: ids[1],
        reserves: 20,
        cause: 'battle',
      }),
    /not deployed/,
  );
  assert.equal(JSON.stringify(loaded), saved);
  assert.equal(JSON.stringify(state), saved);
  assert.deepEqual(
    projectRicheseNoField(JSON.parse(JSON.stringify(result.state)), true),
    projectRicheseNoField(result.state, true),
  );
});

void test('outputs and projections are independent clones and caller-provided placement data stays unchanged', () => {
  const initial = fresh();
  const placement = {
    tokenId: ids[2],
    controller: 'richese',
    location: { ...location },
  };
  const state = deployRicheseNoField(initial, placement);
  placement.location.sector = 2;
  assert.equal(state.deployed!.location.sector, 10);
  const own = projectRicheseNoField(state, true);
  own.private.tokens[0].id = 'changed';
  own.deployed!.location.sector = 3;
  assert.equal(state.tokens[0].id, ids[0]);
  assert.equal(state.deployed!.location.sector, 10);
  const result = reveal(state);
  result.location.sector = 4;
  result.state.tokens.reverse();
  assert.equal(state.deployed!.location.sector, 10);
  assert.equal(state.tokens[0].value, 0);
  assert.equal(initial.lastShipped, null);
});

void test('sparse inventory arrays cannot bypass physical token validation', () => {
  const sparseIds: string[] = [];
  sparseIds.length = 3;
  sparseIds[1] = 'opaque-b';
  sparseIds[2] = 'opaque-c';
  assert.throws(() => createRicheseNoField(sparseIds), /identities/);
  const sparseTokens = fresh();
  Reflect.deleteProperty(sparseTokens.tokens, '0');
  assert.equal(sparseTokens.tokens.length, 3);
  assert.throws(() => validateRicheseNoField(sparseTokens), /identities/);
  assert.throws(() => projectRicheseNoField(sparseTokens, false), /identities/);
  assert.throws(
    () =>
      deployRicheseNoField(sparseTokens, {
        tokenId: ids[2],
        controller: 'richese',
        location,
      }),
    /identities/,
  );
  const json = JSON.parse(JSON.stringify(sparseTokens));
  assert.throws(() => validateRicheseNoField(json), /identities/);
});

void test('Polar Sink uses the board sector-zero address without admitting off-planet containers', () => {
  const state = deployRicheseNoField(createRicheseNoField(ids), {
    tokenId: ids[1],
    controller: 'r',
    location: { territory: 'polar_sink', sector: 0 },
  });
  assert.deepEqual(projectRicheseNoField(state, false).deployed?.location, {
    territory: 'polar_sink',
    sector: 0,
  });
  const revealed = revealRicheseNoField(state, {
    tokenId: ids[1],
    reserves: 20,
    cause: 'voluntary',
  });
  assert.equal(revealed.forces, 3);
  assert.deepEqual(revealed.location, { territory: 'polar_sink', sector: 0 });
  for (const territory of ['reserves', 'homeworld'])
    assert.throws(
      () => moveRicheseNoField(state, ids[1], { territory, sector: 0 }),
      /sector/,
    );
});

void test('a concealed No-Field retains custody while moving into and out of the mobile stronghold sector', () => {
  for (const value of [0, 3, 5] as const) {
    const initial = deployed(value),
      before = structuredClone(initial);
    const token = initial.deployed!.tokenId;
    const moved = moveRicheseNoField(initial, token, {
      territory: 'hidden_mobile_stronghold',
      sector: 0,
    });
    assert.deepEqual(initial, before);
    validateRicheseNoField(JSON.parse(JSON.stringify(moved)));
    assert.equal(moved.lastShipped, initial.lastShipped);
    assert.deepEqual(moved.tokens, initial.tokens);
    assert.equal(
      projectRicheseNoField(moved, false).deployed?.effectiveForces,
      1,
    );
    assert.deepEqual(moveRicheseNoField(moved, token, location), initial);
    const revealed = revealRicheseNoField(moved, {
      tokenId: token,
      reserves: 20,
      cause: 'voluntary',
    });
    assert.equal(revealed.forces, value);
    assert.deepEqual(revealed.location, {
      territory: 'hidden_mobile_stronghold',
      sector: 0,
    });
  }
});
