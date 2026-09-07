import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireDuke,
  consumeDuke,
  createDukeVidal,
  DUKE_VIDAL_ID,
  DUKE_VIDAL_RULES,
  expireDuke,
  type DukeSource,
} from '../game/duke-vidal';
import { leaders } from '../game/cards';
import { traitorDeck } from '../game/traitors';

void test('Duke Vidal is one fresh Ecaz disc of strength six, separate from both native rosters and traitor inventories', () => {
  const duke = createDukeVidal();
  assert.deepEqual(duke, {
    leader: {
      id: 'duke-vidal',
      name: 'Duke Prad Vidal',
      faction: 'ecaz',
      strength: 6,
      dead: false,
      deaths: 0,
    },
    controller: null,
    acquiredTurn: null,
    source: null,
  });
  assert.equal(DUKE_VIDAL_ID, duke.leader.id);
  const ecaz = leaders('ecaz');
  const moritani = leaders('moritani');
  assert.equal(ecaz.length, 5);
  assert.equal(moritani.length, 5);
  assert.equal(
    traitorDeck([{ leaders: ecaz }, { leaders: moritani }], true).includes(
      DUKE_VIDAL_ID,
    ),
    false,
  );
  const changed = createDukeVidal();
  changed.leader.dead = true;
  changed.controller = 'm';
  assert.equal(createDukeVidal().leader.dead, false);
  assert.equal(createDukeVidal().controller, null);
});

void test('acquisition changes only explicit custody, preserving permanent identity and leader history', () => {
  const original = createDukeVidal();
  original.leader.deaths = 2;
  original.leader.usedAt = 'arrakeen';
  const before = structuredClone(original);
  for (const source of ['moritani', 'ecaz', 'ally'] as const) {
    const acquired = acquireDuke(original, 'holder-' + source, 3, source);
    assert.deepEqual(acquired.leader, original.leader);
    assert.notEqual(acquired.leader, original.leader);
    assert.equal(acquired.controller, 'holder-' + source);
    assert.equal(acquired.acquiredTurn, 3);
    assert.equal(acquired.source, source);
    acquired.leader.deaths++;
    assert.deepEqual(original, before);
  }
  const first = acquireDuke(original, 'ecaz-seat', 3, 'ecaz');
  const taken = acquireDuke(first, 'moritani-seat', 4, 'moritani');
  assert.equal(taken.controller, 'moritani-seat');
  assert.equal(taken.leader.faction, 'ecaz');
  assert.equal(taken.leader.id, DUKE_VIDAL_ID);
  assert.equal(first.controller, 'ecaz-seat');
});

void test('dead and unresolved captured or ghola custody reject acquisition without changing the disc', () => {
  for (const custody of ['dead', 'capturedBy', 'gholaBy'] as const) {
    const state = acquireDuke(createDukeVidal(), 'old-holder', 1, 'ecaz');
    if (custody === 'dead') state.leader.dead = true;
    else state.leader[custody] = 'other-seat';
    const before = structuredClone(state);
    for (const source of ['moritani', 'ecaz', 'ally'] as const)
      assert.throws(() => acquireDuke(state, 'new-holder', 2, source));
    assert.deepEqual(state, before);
  }
});

void test('invalid turns, empty controllers and unknown acquisition sources cannot create custody', () => {
  const state = createDukeVidal();
  const before = structuredClone(state);
  for (const turn of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => acquireDuke(state, 'm', turn, 'moritani'),
      /valid turn/,
    );
    assert.throws(() => expireDuke(state, turn), /valid turn/);
  }
  for (const controller of ['', '  '])
    assert.throws(
      () => acquireDuke(state, controller, 1, 'moritani'),
      /Choose a player/,
    );
  assert.throws(
    () => acquireDuke(state, 'm', 1, 'invented' as DukeSource),
    /valid source/,
  );
  assert.deepEqual(state, before);
});

void test('single-battle consumption releases custody while retaining alive or dead leader history', () => {
  for (const dead of [false, true]) {
    const state = acquireDuke(createDukeVidal(), 'm', 2, 'moritani');
    state.leader.dead = dead;
    state.leader.deaths = dead ? 2 : 1;
    state.leader.usedAt = 'carthag';
    const before = structuredClone(state);
    const consumed = consumeDuke(state);
    assert.equal(consumed.controller, null);
    assert.equal(consumed.acquiredTurn, null);
    assert.equal(consumed.source, null);
    assert.deepEqual(consumed.leader, state.leader);
    assert.deepEqual(state, before);
    assert.deepEqual(consumeDuke(consumed), consumed);
  }
});

void test('turn end releases only Moritani tenure and preserves Ecaz holdings and unresolved allied loans', () => {
  for (const source of ['moritani', 'ally', 'ecaz'] as const) {
    const state = acquireDuke(createDukeVidal(), 'holder', 4, source);
    const earlier = expireDuke(state, 3);
    assert.deepEqual(earlier, state);
    for (const turn of [4, 5]) {
      const expired = expireDuke(state, turn);
      assert.equal(expired.controller, source === 'moritani' ? null : 'holder');
      assert.equal(expired.acquiredTurn, source === 'moritani' ? null : 4);
      assert.equal(expired.source, source === 'moritani' ? null : source);
      assert.deepEqual(expired.leader, state.leader);
    }
    assert.equal(state.controller, 'holder');
  }
});

void test('turn end preserves dead, captured and ghola custody rather than inventing a return destination', () => {
  for (const custody of ['dead', 'capturedBy', 'gholaBy'] as const) {
    const state = acquireDuke(createDukeVidal(), 'm', 1, 'moritani');
    if (custody === 'dead') state.leader.dead = true;
    else state.leader[custody] = 'other-seat';
    state.leader.concealed = {
      captor: 'other-seat',
      controller: 'm',
      dead: false,
      deaths: 0,
    };
    const result = expireDuke(state, 2);
    assert.deepEqual(result, state);
    result.leader.concealed!.dead = true;
    assert.equal(state.leader.concealed.dead, false);
    assert.notEqual(result.leader, state.leader);
  }
  const initial = createDukeVidal();
  assert.deepEqual(expireDuke(initial, 1), initial);
});

void test('custody survives JSON persistence and permits a later eligible acquisition without creating another disc', () => {
  const held = acquireDuke(createDukeVidal(), 'm', 1, 'moritani');
  const released = consumeDuke(JSON.parse(JSON.stringify(held)));
  const reacquired = acquireDuke(
    JSON.parse(JSON.stringify(released)),
    'm',
    2,
    'moritani',
  );
  assert.equal(reacquired.leader.id, held.leader.id);
  assert.equal(reacquired.acquiredTurn, 2);
  assert.equal(released.controller, null);
  assert.equal(held.controller, 'm');
});

void test('immutable original gameplay guidance separates strength, revival cost and unfinished integrations', () => {
  assert.equal(DUKE_VIDAL_RULES.traitor, false);
  assert.equal(DUKE_VIDAL_RULES.strength, 6);
  assert.equal(DUKE_VIDAL_RULES.faction, 'ecaz');
  assert.ok(
    DUKE_VIDAL_RULES.gameplay.some((paragraph) =>
      paragraph.includes('five spice'),
    ),
  );
  assert.ok(
    DUKE_VIDAL_RULES.gameplay.some((paragraph) =>
      paragraph.includes('Only Ecaz'),
    ),
  );
  assert.ok(
    DUKE_VIDAL_RULES.gameplay.some((paragraph) => paragraph.includes('Karama')),
  );
  assert.ok(
    DUKE_VIDAL_RULES.gameplay.every(
      (paragraph) => !/https?:\/\//.test(paragraph),
    ),
  );
  assert.equal(DUKE_VIDAL_RULES.implementation.custody, 'implemented');
  assert.equal(DUKE_VIDAL_RULES.implementation.capture, 'not-implemented');
  assert.equal(DUKE_VIDAL_RULES.implementation.revival, 'not-implemented');
  assert.equal(DUKE_VIDAL_RULES.implementation.allyLoanReturn, 'unresolved');
  assert.ok(Object.isFrozen(DUKE_VIDAL_RULES));
  assert.ok(Object.isFrozen(DUKE_VIDAL_RULES.gameplay));
  assert.ok(Object.isFrozen(DUKE_VIDAL_RULES.implementation));
});
