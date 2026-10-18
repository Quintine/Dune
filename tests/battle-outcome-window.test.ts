import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBattleOutcomeWindow,
  validateBattleOutcomeWindow,
  readyBattleOutcomeWindow,
  reviseBattleOutcomeWindow,
  BattleOutcomeWindowError,
  type BattleOutcomeIdentity,
  type BattleOutcomeWindow,
} from '../game/battle-outcome-window';

const identity: BattleOutcomeIdentity = { event: 'original-battle-event', attacker: 'a', defender: 'd', turn: 3 };
const open = (revision = 2) => createBattleOutcomeWindow(identity, revision);

void test('a public final battle window closes only after both distinct combatants finish in either order', () => {
  for (const [first, second] of [['a', 'd'], ['d', 'a']]) {
    const state = open(), before = structuredClone(state);
    assert.equal(state.event, 'battleOutcome:["original-battle-event",3,2]');
    assert.equal(state.battle, identity.event);
    assert.deepEqual(state.ready, []);
    assert.equal(state.closed, false);
    validateBattleOutcomeWindow(state, identity, 2);
    Object.freeze(state.ready); Object.freeze(state);
    const one = readyBattleOutcomeWindow(state, identity, 2, first, state.event);
    assert.deepEqual(one.ready, [first]);
    assert.equal(one.closed, false);
    assert.notEqual(one.ready, state.ready);
    const both = readyBattleOutcomeWindow(one, identity, 2, second, one.event);
    assert.deepEqual(both.ready, [first, second]);
    assert.equal(both.closed, true);
    validateBattleOutcomeWindow(JSON.parse(JSON.stringify(both)), identity, 2);
    assert.deepEqual(state, before);
    assert.deepEqual(one.ready, [first]);
    assert.throws(() => readyBattleOutcomeWindow(both, identity, 2, first, both.event), /closed/);
  }
});

void test('a public Sapho revision clears both finished marks and invalidates the previous opportunity', () => {
  const original = open(), one = readyBattleOutcomeWindow(original, identity, 2, 'd', original.event);
  const revised = reviseBattleOutcomeWindow(one, identity, 2, 3);
  assert.equal(revised.event, 'battleOutcome:["original-battle-event",3,3]');
  assert.notEqual(revised.event, one.event);
  assert.deepEqual(revised.ready, []);
  assert.equal(revised.closed, false);
  assert.deepEqual(one.ready, ['d']);
  assert.throws(() => readyBattleOutcomeWindow(revised, identity, 3, 'a', one.event), /expired/);
  const first = readyBattleOutcomeWindow(revised, identity, 3, 'd', revised.event);
  assert.equal(first.closed, false, 'The player who previously finished must finish again');
  assert.equal(readyBattleOutcomeWindow(first, identity, 3, 'a', first.event).closed, true);
});

void test('stale, duplicate and noncombatant acknowledgements cannot consume a final battle opportunity', () => {
  const state = open(), one = readyBattleOutcomeWindow(state, identity, 2, 'a', state.event);
  const before = structuredClone(one);
  assert.throws(() => readyBattleOutcomeWindow(one, identity, 2, 'a', one.event), /already finished/);
  assert.throws(() => readyBattleOutcomeWindow(one, identity, 2, 'outsider', one.event), /combatant/);
  assert.throws(() => readyBattleOutcomeWindow(one, identity, 2, 'd', 'stale-event'), /expired/);
  assert.throws(() => readyBattleOutcomeWindow(one, identity, 1, 'd', one.event), /revision/);
  assert.throws(() => readyBattleOutcomeWindow(one, { ...identity, event: 'another-battle' }, 2, 'd', one.event));
  assert.deepEqual(one, before);
});

void test('original identity, exact window shape and public ready closure must agree', () => {
  const changes: ((state: BattleOutcomeWindow) => void)[] = [
    state => { state.battle = 'another-battle'; },
    state => { state.turn++; },
    state => { state.attacker = 'outsider'; },
    state => { state.defender = state.attacker; },
    state => { state.revision++; },
    state => { state.event = 'stale-event'; },
    state => { state.ready = ['a', 'a']; },
    state => { state.ready = ['outsider']; },
    state => { state.ready = ['a', 'd']; },
    state => { state.closed = true; },
    state => { Object.assign(state, { version: 2 }); },
    state => { Object.assign(state, { privateCard: 'unrelated' }); },
  ];
  for (const change of changes) {
    const state = open(); change(state);
    assert.throws(() => validateBattleOutcomeWindow(state, identity, 2), BattleOutcomeWindowError);
  }
  assert.throws(() => validateBattleOutcomeWindow(open(), {
    ...identity, attacker: identity.defender, defender: identity.attacker,
  }, 2), /combatants/);
  for (const invalid of [
    { ...identity, event: '' }, { ...identity, attacker: '' }, { ...identity, defender: 'a' },
    ...[0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(turn => ({ ...identity, turn })),
    { ...identity, extra: true },
  ]) assert.throws(() => createBattleOutcomeWindow(invalid as BattleOutcomeIdentity, 0), BattleOutcomeWindowError);
});

void test('revisions advance exactly once only while the original final window is open', () => {
  const state = open();
  for (const next of [-1, 0, 2, 4, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => reviseBattleOutcomeWindow(state, identity, 2, next), BattleOutcomeWindowError);
  assert.throws(() => reviseBattleOutcomeWindow(state, identity, 1, 2), /revision/);
  const one = readyBattleOutcomeWindow(state, identity, 2, 'a', state.event);
  const closed = readyBattleOutcomeWindow(one, identity, 2, 'd', state.event);
  assert.throws(() => reviseBattleOutcomeWindow(closed, identity, 2, 3), /closed/);
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => createBattleOutcomeWindow(identity, invalid), BattleOutcomeWindowError);
  const last = open(Number.MAX_SAFE_INTEGER);
  validateBattleOutcomeWindow(last, identity, Number.MAX_SAFE_INTEGER);
  assert.throws(() => reviseBattleOutcomeWindow(last, identity, Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER + 1), /exactly once/);
});
