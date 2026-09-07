import test from 'node:test';
import assert from 'node:assert/strict';
import {
  presenceAt,
  presenceByLocation,
  type ForcePresence,
} from '../game/force-presence';
import {
  forceCount,
  fighterCount,
  settleAdvisors,
  arrivalAsAdvisor,
} from '../game/advisors';
import { createGame, newPlayer } from '../game/engine';
import {
  createRicheseNoField,
  deployRicheseNoField,
  projectRicheseNoField,
  revealRicheseNoField,
} from '../game/richese-no-field';

const markerLocation = { territory: 'imperial_basin', sector: 10 };
function token(value: 0 | 3 | 5) {
  const state = createRicheseNoField(['opaque-a', 'opaque-b', 'opaque-c']);
  return deployRicheseNoField(state, {
    tokenId: state.tokens.find((t) => t.value === value)!.id,
    controller: 'richese',
    location: markerLocation,
  });
}

void test('ordinary physical presence remains identical with absent, null or undeployed markers', () => {
  for (const noField of [undefined, null, { deployed: null }]) {
    const p: ForcePresence = {
      forces: {
        'imperial_basin:9': 2,
        'imperial_basin:10': 3,
        'arrakeen:10': 4,
      },
      noField,
    };
    assert.equal(presenceAt(p, 'imperial_basin'), 5);
    assert.equal(presenceAt(p, 'arrakeen'), 4);
    assert.equal(presenceAt(p, 'carthag'), 0);
    assert.deepEqual(presenceByLocation(p), p.forces);
  }
});

void test('all hidden denominations add exactly one and owner/public inputs produce the same result', () => {
  for (const value of [0, 3, 5] as const) {
    const noField = token(value);
    const forces = {
      'imperial_basin:9': 2,
      'imperial_basin:10': 3,
      'arrakeen:10': 4,
    };
    const own = { forces, noField, reserves: 0 };
    const publicPlayer = {
      forces,
      noField: projectRicheseNoField(noField, false),
    };
    for (const p of [own, publicPlayer]) {
      assert.equal(presenceAt(p, 'imperial_basin'), 6);
      assert.equal(presenceAt(p, 'arrakeen'), 4);
      assert.deepEqual(presenceByLocation(p), {
        'imperial_basin:9': 2,
        'imperial_basin:10': 4,
        'arrakeen:10': 4,
      });
      assert.equal(forceCount(p, 'imperial_basin'), 6);
      assert.equal(
        fighterCount(
          { ...p, faction: 'richese', advisors: {} },
          'imperial_basin',
        ),
        6,
      );
    }
    assert.deepEqual(own.forces, forces);
  }
});

void test('a marker alone creates one public location without inventing physical forces', () => {
  const forces: Record<string, number> = {};
  const p = { forces, noField: token(0) };
  assert.equal(presenceAt(p, 'imperial_basin'), 1);
  assert.deepEqual(presenceByLocation(p), { 'imperial_basin:10': 1 });
  assert.deepEqual(forces, {});
  assert.equal(
    Object.values(p.forces).reduce((sum, count) => sum + count, 0),
    0,
  );
});

void test('presence never inspects reserves, hidden token inventory, denomination or controller', () => {
  const forbidden = () => {
    throw new Error('Hidden field accessed');
  };
  const noField = {
    get tokens() {
      return forbidden();
    },
    get lastShipped() {
      return forbidden();
    },
    deployed: {
      get tokenId() {
        return forbidden();
      },
      get controller() {
        return forbidden();
      },
      get value() {
        return forbidden();
      },
      location: markerLocation,
    },
  };
  const p = {
    forces: { 'imperial_basin:9': 2 },
    noField,
    get reserves() {
      return forbidden();
    },
  };
  assert.equal(presenceAt(p, 'imperial_basin'), 3);
  assert.deepEqual(presenceByLocation(p), {
    'imperial_basin:9': 2,
    'imperial_basin:10': 1,
  });
});

void test('location maps and public JSON restoration preserve sectors without mutating either input', () => {
  const p = {
    forces: { 'imperial_basin:9': 2 },
    noField: projectRicheseNoField(token(3), false),
  };
  const before = JSON.stringify(p);
  const restored: ForcePresence = JSON.parse(before);
  const locations = presenceByLocation(restored);
  locations['imperial_basin:9'] = 20;
  locations['imperial_basin:10'] = 20;
  assert.equal(presenceAt(restored, 'imperial_basin'), 3);
  assert.equal(JSON.stringify(restored), before);
  assert.equal(JSON.stringify(p), before);
});

void test('after reveal only actual materialized units count and zero reveal removes marker-only presence', () => {
  for (const value of [0, 3, 5] as const) {
    const noField = token(value);
    const result = revealRicheseNoField(noField, {
      tokenId: noField.deployed!.tokenId,
      reserves: 2,
      cause: 'battle',
    });
    const p = {
      forces: { 'imperial_basin:10': result.forces },
      noField: result.state,
    };
    assert.equal(presenceAt(p, 'imperial_basin'), Math.min(value, 2));
    assert.equal(
      presenceByLocation(p)['imperial_basin:10'],
      Math.min(value, 2),
    );
  }
});

void test('Bene Gesserit advisor stance still suppresses fighters while force presence remains visible', () => {
  const p = {
    faction: 'beneGesserit' as const,
    forces: { 'imperial_basin:9': 2 },
    advisors: { imperial_basin: { lockedTurn: 2 } },
  };
  assert.equal(forceCount(p, 'imperial_basin'), 2);
  assert.equal(fighterCount(p, 'imperial_basin'), 0);
  assert.equal(fighterCount({ ...p, advisors: {} }, 'imperial_basin'), 2);
  // Presence is structural, while engine ownership separately ensures Richese
  // alone owns a No-Field inventory. Do not bypass stance for any marker shape.
  assert.equal(fighterCount({ ...p, noField: token(5) }, 'imperial_basin'), 0);
});

void test('zero No-Field presence preserves advisors and permits an accompanying advisor arrival', () => {
  const richese = newPlayer('r', 'Richese', 'richese');
  const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
  const g = createGame('PRESENCE', richese);
  g.players.push(bg);
  g.advanced = true;
  richese.forces = {};
  Object.assign(richese, { noField: token(0) });
  bg.forces = { 'imperial_basin:9': 1 };
  bg.advisors = { imperial_basin: { lockedTurn: 2 } };
  settleAdvisors(g);
  assert.deepEqual(bg.advisors?.imperial_basin, { lockedTurn: 2 });
  assert.equal(
    arrivalAsAdvisor(g, bg, 'imperial_basin', undefined, true),
    true,
  );
  bg.forces = {};
  bg.advisors = {};
  assert.equal(
    arrivalAsAdvisor(g, bg, 'imperial_basin', undefined, true),
    true,
  );
  const zero = (
    richese as typeof richese & { noField: ReturnType<typeof token> }
  ).noField;
  Object.assign(richese, {
    noField: revealRicheseNoField(zero, {
      tokenId: zero.deployed!.tokenId,
      reserves: 20,
      cause: 'voluntary',
    }).state,
  });
  bg.forces = { 'imperial_basin:9': 1 };
  bg.advisors = { imperial_basin: { lockedTurn: 2 } };
  settleAdvisors(g);
  assert.equal(bg.advisors?.imperial_basin, undefined);
  assert.equal(
    arrivalAsAdvisor(g, bg, 'imperial_basin', undefined, true),
    false,
  );
});
