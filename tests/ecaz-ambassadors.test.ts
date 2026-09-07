import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AMBASSADOR_EFFECTS,
  blockAmbassadorPlacement,
  canTriggerAmbassador,
  copiedAmbassadorEffects,
  createAmbassadors,
  destroyAmbassador,
  placeAmbassador,
  replenishAmbassadors,
  triggerAmbassador,
  validateAmbassadors,
  type AmbassadorState,
  type AmbassadorEffect,
  type AmbassadorEntryContext,
} from '../game/ecaz-ambassadors';

const create = () => createAmbassadors(() => 0);
const idFor = (state: AmbassadorState, effect: AmbassadorEffect) =>
  state.tokens.find((token) => token.effect === effect)!.id;
const reload = (state: AmbassadorState): AmbassadorState =>
  JSON.parse(JSON.stringify(state));
function place(
  state: AmbassadorState,
  id: string,
  turn = 1,
  destination = 'arrakeen',
  availableSpice = 100,
) {
  return placeAmbassador(state, id, {
    turn,
    availableSpice,
    destination: {
      id: destination,
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  });
}
function finishCohort(state: AmbassadorState, turn = 1) {
  let next = state;
  for (const id of state.cohort)
    next = triggerAmbassador(place(next, id, turn).state, id);
  return next;
}
function rejectUnchanged(state: AmbassadorState, action: () => unknown) {
  const before = structuredClone(state);
  assert.throws(action);
  assert.deepEqual(state, before);
}

void test('setup has eleven unique physical identities: reusable Ecaz plus a random five-token cohort', () => {
  const state = create();
  assert.equal(state.tokens.length, 11);
  assert.equal(new Set(state.tokens.map((t) => t.id)).size, 11);
  assert.equal(new Set(state.tokens.map((t) => t.effect)).size, 11);
  assert.equal(
    AMBASSADOR_EFFECTS.includes('moritani' as AmbassadorEffect),
    false,
  );
  assert.deepEqual([...AMBASSADOR_EFFECTS].sort(), [
    'atreides',
    'beneGesserit',
    'choam',
    'ecaz',
    'emperor',
    'fremen',
    'guild',
    'harkonnen',
    'ixians',
    'richese',
    'tleilaxu',
  ]);
  assert.equal(state.tokens.filter((t) => t.zone === 'supply').length, 6);
  assert.equal(state.tokens.filter((t) => t.zone === 'pool').length, 5);
  assert.equal(state.cohort.length, 5);
  assert.ok(!state.cohort.includes(idFor(state, 'ecaz')));
  assert.ok(state.tokens.every((t) => t.location === null));
  assert.equal(state.placement, null);
  assert.ok(Object.isFrozen(AMBASSADOR_EFFECTS));
  const different = createAmbassadors(() => 0.999);
  assert.notDeepEqual(different.cohort, state.cohort);
  assert.deepEqual(
    different.tokens.map((t) => [t.id, t.effect]),
    state.tokens.map((t) => [t.id, t.effect]),
  );
  assert.doesNotThrow(() => validateAmbassadors(reload(state)));
});

void test('placement pays incremental one-through-N costs, consumes supplied tokens and cannot relocate', () => {
  let state = create();
  const initial = structuredClone(state);
  for (let index = 0; index < 5; index++) {
    const result = place(
      state,
      state.cohort[index],
      1,
      `stronghold-${index}`,
      index + 1,
    );
    assert.equal(result.cost, index + 1);
    state = result.state;
  }
  assert.deepEqual(initial, create());
  assert.equal(state.placement?.count, 5);
  const placed = state.cohort[0];
  rejectUnchanged(state, () => place(state, placed, 1, 'other-stronghold'));
  rejectUnchanged(state, () =>
    place(state, idFor(state, 'ecaz'), 1, 'stronghold-0'),
  );
  rejectUnchanged(state, () =>
    place(state, idFor(state, 'ecaz'), 1, 'other-stronghold', 5),
  );
  const sixth = place(state, idFor(state, 'ecaz'), 1, 'other-stronghold', 6);
  assert.equal(sixth.cost, 6);
});

void test('placement respects explicit map/storm authorization and exact spice without inventing mobile permission', () => {
  const state = create();
  const token = state.cohort[0];
  for (const destination of [
    { id: 'arrakeen', stronghold: true, inStorm: true, allowed: true },
    { id: 'imperial_basin', stronghold: false, inStorm: false, allowed: true },
    {
      id: 'hidden_mobile_stronghold',
      stronghold: true,
      inStorm: false,
      allowed: false,
    },
    { id: '', stronghold: true, inStorm: false, allowed: true },
  ])
    rejectUnchanged(state, () =>
      placeAmbassador(state, token, {
        turn: 1,
        availableSpice: 10,
        destination,
      }),
    );
  for (const spice of [0, -1, 0.5, NaN, Infinity])
    rejectUnchanged(state, () => place(state, token, 1, 'arrakeen', spice));
  const pool = state.tokens.find((t) => t.zone === 'pool')!;
  rejectUnchanged(state, () => place(state, pool.id));
});

void test('turn-stamped blocking preserves spent placement count, rejects stale turns and resets on the next turn', () => {
  const first = place(create(), idFor(create(), 'ecaz'), 4).state;
  const blocked = blockAmbassadorPlacement(first, 4);
  assert.deepEqual(blocked.placement, { turn: 4, count: 1, blocked: true });
  assert.equal(first.placement?.blocked, false);
  rejectUnchanged(blocked, () =>
    place(blocked, blocked.cohort[0], 4, 'carthag'),
  );
  rejectUnchanged(blocked, () =>
    place(blocked, blocked.cohort[0], 3, 'carthag'),
  );
  rejectUnchanged(blocked, () => blockAmbassadorPlacement(blocked, 3));
  const next = place(reload(blocked), blocked.cohort[0], 5, 'carthag', 1);
  assert.equal(next.cost, 1);
  assert.deepEqual(next.state.placement, { turn: 5, count: 1, blocked: false });
  const newBlock = blockAmbassadorPlacement(first, 5);
  assert.deepEqual(newBlock.placement, { turn: 5, count: 0, blocked: true });
});

void test('storm or explosion destruction returns supply without completing the random cohort or refunding placement history', () => {
  let state = create();
  const id = state.cohort[0];
  state = place(state, id).state;
  const restored = destroyAmbassador(state, id);
  assert.equal(restored.tokens.find((t) => t.id === id)?.zone, 'supply');
  assert.equal(restored.tokens.find((t) => t.id === id)?.location, null);
  assert.deepEqual(restored.cohort, state.cohort);
  assert.deepEqual(restored.placement, state.placement);
  assert.equal(state.tokens.find((t) => t.id === id)?.zone, 'placed');
  rejectUnchanged(restored, () => replenishAmbassadors(restored, () => 0));
  rejectUnchanged(restored, () => destroyAmbassador(restored, id));
  const again = place(restored, id, 1, 'carthag');
  assert.equal(again.cost, 2);
});

void test('Ecaz triggers return to supply, ordinary cohort tokens become used, and Bene Gesserit becomes permanently removed', () => {
  let state = create();
  const ecaz = idFor(state, 'ecaz');
  const bg = idFor(state, 'beneGesserit');
  assert.ok(state.cohort.includes(bg));
  const originalCohort = [...state.cohort];
  for (let count = 0; count < 2; count++) {
    state = triggerAmbassador(place(state, ecaz).state, ecaz);
    assert.equal(state.tokens.find((t) => t.id === ecaz)?.zone, 'supply');
    assert.deepEqual(state.cohort, originalCohort);
  }
  state = triggerAmbassador(place(state, bg).state, bg);
  assert.equal(state.tokens.find((t) => t.id === bg)?.zone, 'removed');
  rejectUnchanged(state, () => triggerAmbassador(state, bg));
  const ordinary = state.cohort.find((id) => id !== bg)!;
  state = triggerAmbassador(place(state, ordinary).state, ordinary);
  assert.equal(state.tokens.find((t) => t.id === ordinary)?.zone, 'used');
  rejectUnchanged(state, () => place(state, ordinary));
  rejectUnchanged(state, () => replenishAmbassadors(state, () => 0));
});

void test('only five completed random triggers replenish, preserving removed BG, Ecaz placement, and physical identity across repeated JSON cycles', () => {
  let state = create();
  const ecaz = idFor(state, 'ecaz');
  const bg = idFor(state, 'beneGesserit');
  state = place(state, ecaz, 1, 'carthag').state;
  const identities = state.tokens.map((t) => [t.id, t.effect]);
  for (let turn = 1; turn <= 4; turn++) {
    state = finishCohort(state, turn);
    assert.ok(
      state.cohort.every((id) =>
        ['used', 'removed'].includes(
          state.tokens.find((t) => t.id === id)!.zone,
        ),
      ),
    );
    const before = structuredClone(state);
    const next = replenishAmbassadors(reload(state), () => 0);
    assert.deepEqual(state, before);
    assert.equal(next.cohort.length, 5);
    assert.ok(!next.cohort.includes(bg));
    assert.equal(next.tokens.find((t) => t.id === bg)?.zone, 'removed');
    assert.deepEqual(
      next.tokens.find((t) => t.id === ecaz),
      state.tokens.find((t) => t.id === ecaz),
    );
    assert.deepEqual(next.placement, state.placement);
    assert.deepEqual(
      next.tokens.map((t) => [t.id, t.effect]),
      identities,
    );
    assert.equal(next.tokens.filter((t) => t.zone === 'used').length, 0);
    rejectUnchanged(next, () => replenishAmbassadors(next, () => 0));
    state = next;
  }
});

void test('invalid random draws reject setup or replenishment without consuming existing custody', () => {
  for (const draw of [-0.01, 1, NaN, Infinity]) {
    assert.throws(() => createAmbassadors(() => draw));
    const state = finishCohort(create());
    rejectUnchanged(state, () => replenishAmbassadors(state, () => draw));
  }
  const state = finishCohort(create());
  let draws = 0;
  rejectUnchanged(state, () =>
    replenishAmbassadors(state, () => (++draws === 2 ? 1 : 0)),
  );
});

void test('malformed inventories, cohorts, zones and placement stamps fail validation', () => {
  const mutations: ((state: AmbassadorState) => void)[] = [
    (s) => {
      s.tokens.pop();
    },
    (s) => {
      s.tokens[1].id = s.tokens[0].id;
    },
    (s) => {
      s.tokens[1].effect = 'ecaz';
    },
    (s) => {
      s.cohort[0] = s.cohort[1];
    },
    (s) => {
      s.cohort[0] = idFor(s, 'ecaz');
    },
    (s) => {
      s.tokens.find((t) => t.id === s.cohort[0])!.zone = 'pool';
    },
    (s) => {
      s.tokens.find((t) => t.zone === 'pool')!.zone = 'supply';
    },
    (s) => {
      s.tokens[0].zone = 'used';
    },
    (s) => {
      s.tokens[0].location = 'arrakeen';
    },
    (s) => {
      s.tokens.find((t) => t.effect === 'beneGesserit')!.zone = 'used';
    },
    (s) => {
      s.placement = { turn: 0, count: 0, blocked: false };
    },
    (s) => {
      s.placement = { turn: 1, count: 0.5, blocked: false };
    },
  ];
  for (const mutate of mutations) {
    const state = create();
    mutate(state);
    rejectUnchanged(state, () => validateAmbassadors(state));
  }
});

void test('BG copy eligibility follows the original cohort through placement, destruction, use and permanent removal', () => {
  let state = create();
  const expected = ['atreides', 'ixians', 'richese', 'guild', 'tleilaxu'];
  assert.deepEqual(copiedAmbassadorEffects(state), expected);
  const bg = idFor(state, 'beneGesserit');
  const ordinary = state.cohort.find((id) => id !== bg)!;
  state = place(state, ordinary).state;
  assert.deepEqual(copiedAmbassadorEffects(state), expected);
  state = destroyAmbassador(state, ordinary);
  assert.deepEqual(copiedAmbassadorEffects(state), expected);
  state = triggerAmbassador(place(state, ordinary).state, ordinary);
  state = triggerAmbassador(place(state, bg).state, bg);
  assert.equal(state.tokens.find((token) => token.id === bg)?.zone, 'removed');
  assert.deepEqual(copiedAmbassadorEffects(reload(state)), expected);
  const before = structuredClone(state);
  const detached = copiedAmbassadorEffects(state);
  detached.pop();
  assert.deepEqual(state, before);
  assert.deepEqual(copiedAmbassadorEffects(state), expected);
});

void test('copy eligibility rejects malformed custody without changing input and changes only after a new cohort', () => {
  const initial = create();
  const malformed = reload(initial);
  malformed.cohort[0] = idFor(malformed, 'ecaz');
  rejectUnchanged(malformed, () => copiedAmbassadorEffects(malformed));
  const completed = finishCohort(initial);
  const before = structuredClone(completed);
  copiedAmbassadorEffects(completed);
  assert.deepEqual(completed, before);
  const next = replenishAmbassadors(completed, () => 0.999);
  assert.notDeepEqual(
    copiedAmbassadorEffects(next),
    copiedAmbassadorEffects(completed),
  );
  assert.ok(!copiedAmbassadorEffects(next).includes('ecaz'));
});

void test('Ambassador entry eligibility excludes owner, ally, advisors and the physical marker faction only', () => {
  const context: AmbassadorEntryContext = {
    owner: 'ecaz-seat',
    ally: 'ally-seat',
    entrant: 'visitor-seat',
    entrantFaction: 'harkonnen',
    advisors: false,
    effect: 'beneGesserit',
  };
  const before = structuredClone(context);
  assert.equal(canTriggerAmbassador(context), true);
  assert.equal(
    canTriggerAmbassador({ ...context, entrant: context.owner }),
    false,
  );
  assert.equal(
    canTriggerAmbassador({ ...context, entrant: context.ally! }),
    false,
  );
  assert.equal(canTriggerAmbassador({ ...context, advisors: true }), false);
  assert.equal(
    canTriggerAmbassador({ ...context, effect: 'harkonnen' }),
    false,
  );
  assert.equal(canTriggerAmbassador({ ...context, ally: null }), true);
  assert.equal(
    canTriggerAmbassador({ ...context, entrantFaction: 'moritani' }),
    true,
  );
  assert.deepEqual(context, before);
  // E3 p.15: Harkonnen can trigger BG, which may then copy Harkonnen's effect.
  const state = createAmbassadors(() => 0.999);
  assert.ok(copiedAmbassadorEffects(state).includes('harkonnen'));
  assert.equal(
    canTriggerAmbassador({ ...context, effect: 'beneGesserit' }),
    true,
  );
});
