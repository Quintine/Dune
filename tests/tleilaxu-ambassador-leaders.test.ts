import assert from 'node:assert/strict';
import test from 'node:test';
import { leaders } from '../game/cards';
import { createDukeVidal, DUKE_VIDAL_ID } from '../game/duke-vidal';
import {
  tleilaxuAmbassadorLeaderChoices,
  tleilaxuAmbassadorLeaderSelection,
} from '../game/tleilaxu-ambassador-leaders';

function fixture(advanced = false, deaths = 1) {
  const player = { id: 'ec', faction: 'ecaz' as const, leaders: leaders('ecaz'), battleLosses: 0 };
  const context = {
    status: 'playing' as const, turn: 3, advanced,
    players: [player, { id: 'other', faction: 'emperor' as const, leaders: leaders('emperor'), battleLosses: 0 }],
    dukeVidal: createDukeVidal(),
  };
  context.dukeVidal.leader.dead = true;
  context.dukeVidal.leader.deaths = deaths;
  return { context, player };
}

// These are pure identity/custody inputs. Actual Ambassador acquisition, free
// return, cohort recording and native arrival continuation belong to engine tests.
void test('Basic and Advanced Ecaz receive the canonical shared Duke alternative with set-aside destination', () => {
  for (const advanced of [false, true]) {
    const { context, player } = fixture(advanced), before = structuredClone(context);
    assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, DUKE_VIDAL_ID), DUKE_VIDAL_ID);
    assert.deepEqual(tleilaxuAmbassadorLeaderChoices(context, player), [{
      id: DUKE_VIDAL_ID, name: 'Duke Prad Vidal', strength: 6, destination: 'setAside',
    }]);
    assert.deepEqual(context, before);
    assert.equal(player.leaders.length, 5, 'The shared disc is never appended to the native roster');
    assert.equal(context.dukeVidal.leader.dead, true, 'Quoting a choice does not revive or transfer the disc');
  }
});

void test('independent Duke permission preserves repeated deaths without extending ordinary Ambassador repeat returns', () => {
  for (const deaths of [2, 4]) {
    const { context, player } = fixture(false, deaths);
    const first = player.leaders[0], repeated = player.leaders[1];
    first.dead = true; first.deaths = 1;
    repeated.dead = true; repeated.deaths = 2;
    context.dukeVidal.controller = 'ec';
    context.dukeVidal.source = 'ecaz';
    context.dukeVidal.acquiredTurn = 1;
    context.dukeVidal.leader.usedAt = 'carthag';
    const before = structuredClone(context);
    assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, DUKE_VIDAL_ID), DUKE_VIDAL_ID);
    assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, first.id), first);
    assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, repeated.id), null);
    assert.deepEqual(tleilaxuAmbassadorLeaderChoices(context, player).map(choice => choice.id), [first.id, DUKE_VIDAL_ID]);
    assert.deepEqual(context, before);
    assert.equal(context.dukeVidal.leader.deaths, deaths);
  }
});

void test('a non-Ecaz beneficiary or unseated Ecaz identity cannot inherit shared Duke revival', () => {
  const { context, player } = fixture();
  for (const faction of ['moritani', 'tleilaxu', 'emperor'] as const) {
    const other = { id: 'other', faction, leaders: leaders(faction), battleLosses: 0 };
    assert.equal(tleilaxuAmbassadorLeaderSelection(context, other, DUKE_VIDAL_ID), null);
    assert.deepEqual(tleilaxuAmbassadorLeaderChoices(context, other), []);
  }
  const absent = { ...player, id: 'absent' };
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, absent, DUKE_VIDAL_ID), null);
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices(context, absent), []);
  assert.equal(tleilaxuAmbassadorLeaderSelection({ advanced: false }, player, DUKE_VIDAL_ID), null);
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices({ advanced: false }, player), []);
});

void test('living, unavailable and malformed Duke sources uniformly produce no exceptional choice', () => {
  const changes: ((value: ReturnType<typeof fixture>) => void)[] = [
    value => { value.context.dukeVidal.leader.dead = false; },
    value => { value.context.dukeVidal.leader.deaths = 0; },
    value => { value.context.dukeVidal.leader.deaths = 1.5; },
    value => { value.context.dukeVidal.leader.strength = 5; },
    value => { value.context.dukeVidal.leader.id = 'forged-disc'; },
    value => { value.context.dukeVidal.leader.capturedBy = 'other'; },
    value => { value.context.dukeVidal.leader.gholaBy = 'other'; },
    value => { value.context.dukeVidal.leader.concealed = {
      captor: 'other', controller: 'ec', dead: true, deaths: 1,
    }; },
    value => { value.context.dukeVidal.controller = 'absent'; },
    value => { value.context.dukeVidal.acquiredTurn = 2; },
    value => { value.player.leaders.push(structuredClone(value.context.dukeVidal.leader)); },
    value => { value.context.players[1].leaders.push(structuredClone(value.context.dukeVidal.leader)); },
  ];
  for (const change of changes) {
    const value = fixture(); change(value);
    const before = structuredClone(value.context);
    assert.equal(tleilaxuAmbassadorLeaderSelection(value.context, value.player, DUKE_VIDAL_ID), null);
    assert.deepEqual(tleilaxuAmbassadorLeaderChoices(value.context, value.player), []);
    assert.deepEqual(value.context, before);
  }
  const { context, player } = fixture();
  assert.equal(tleilaxuAmbassadorLeaderSelection({ ...context, dukeVidal: undefined }, player, DUKE_VIDAL_ID), null);
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices({ ...context, dukeVidal: undefined }, player), []);
});

void test('unsupported Advanced custody envelopes use the same no-option projection as missing source facts', () => {
  const { context, player } = fixture(true);
  const blocked = { ...context, players: [player,
    { id: 'h', faction: 'harkonnen' as const, leaders: leaders('harkonnen') }] };
  assert.equal(tleilaxuAmbassadorLeaderSelection(blocked, player, DUKE_VIDAL_ID), null);
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices(blocked, player), []);
  const incomplete = { advanced: true, status: 'playing' as const, turn: 3 };
  assert.equal(tleilaxuAmbassadorLeaderSelection(incomplete, player, DUKE_VIDAL_ID), null);
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices(incomplete, player), []);
});

void test('minimal ordinary contexts retain their actual own first-death leader and reject repeated or foreign custody', () => {
  const own = leaders('ecaz')[0], repeated = leaders('ecaz')[1], foreign = leaders('emperor')[0];
  const captive = leaders('ecaz')[2], ghola = leaders('ecaz')[3];
  for (const leader of [own, repeated, foreign, captive, ghola]) { leader.dead = true; leader.deaths = 1; }
  repeated.deaths = 2; captive.capturedBy = 'other'; ghola.gholaBy = 'other';
  const player = { faction: 'ecaz' as const, leaders: [own, repeated, foreign, captive, ghola], battleLosses: 0 };
  assert.equal(tleilaxuAmbassadorLeaderSelection({ advanced: false }, player, own.id), own);
  for (const leader of [repeated, foreign, captive, ghola])
    assert.equal(tleilaxuAmbassadorLeaderSelection({ advanced: false }, player, leader.id), null);
  assert.equal(tleilaxuAmbassadorLeaderSelection({ advanced: false }, player, 'unknown'), null);
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices({ advanced: false }, player), [
    { id: own.id, name: own.name, strength: own.strength },
  ]);
});

void test('minimal first-KH contexts keep their existing Advanced activation and revival-cycle boundaries', () => {
  const player = { faction: 'atreides' as const, leaders: [], battleLosses: 7,
    kwisatz: { dead: true, revivalCycle: 1 } };
  assert.equal(tleilaxuAmbassadorLeaderSelection({ advanced: true }, player, 'kwisatz'), 'kwisatz');
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices({ advanced: true }, player), [
    { id: 'kwisatz', name: 'Kwisatz Haderach', strength: 2 },
  ]);
  for (const unavailable of [
    { ...player, battleLosses: 6 },
    { ...player, kwisatz: { dead: false, revivalCycle: 1 } },
    { ...player, kwisatz: { dead: true, revivalCycle: 2 } },
  ]) {
    assert.equal(tleilaxuAmbassadorLeaderSelection({ advanced: true }, unavailable, 'kwisatz'), null);
    assert.deepEqual(tleilaxuAmbassadorLeaderChoices({ advanced: true }, unavailable), []);
  }
  assert.equal(tleilaxuAmbassadorLeaderSelection({ advanced: false }, player, 'kwisatz'), null);
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices({ advanced: false }, player), []);
  assert.equal(tleilaxuAmbassadorLeaderSelection({ advanced: true }, {
    ...player, kwisatz: { dead: true },
  }, 'kwisatz'), 'kwisatz', 'Legacy first-cycle KH records retain their default');
});
