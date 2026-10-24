import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuditorLeader, leaders } from '../game/cards';
import type { Player } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { createDukeVidal, DUKE_VIDAL_ID } from '../game/duke-vidal';
import { quoteLeaderRevivalCohort } from '../game/revival';
import {
  tleilaxuAmbassadorLeaderChoices,
  tleilaxuAmbassadorLeaderOpening,
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

function cohortFixture(faction: FactionId = 'emperor', advanced = false) {
  const player: Pick<Player, 'id' | 'faction' | 'leaders' | 'kwisatz' | 'battleLosses' |
    'revivalCycle' | 'ecazRevivalCohort' | 'leaderRevived' | 'spice'> = {
    id: 'owner', faction, leaders: leaders(faction), battleLosses: 0,
    revivalCycle: 0, leaderRevived: false, spice: 0,
  };
  const context = {
    advanced, status: 'playing' as const, turn: 3, players: [player],
    dukeVidal: faction === 'ecaz' ? createDukeVidal() : undefined,
  };
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

void test('independent Duke permission preserves repeated deaths without inventing a sparse native cohort', () => {
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

void test('first-death grant remains immediate while only a real opened cohort is snapshotted', () => {
  for (const faction of ['emperor', 'ecaz'] as const) {
    const { context, player } = cohortFixture(faction);
    const first = player.leaders[0];
    first.dead = true; first.deaths = 1;
    const closed = structuredClone(context);
    assert.equal(quoteLeaderRevivalCohort(context, player).cycle, 0);
    assert.deepEqual(quoteLeaderRevivalCohort(context, player).leaders, []);
    assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, first.id), first);
    assert.equal(tleilaxuAmbassadorLeaderOpening(context, player), null);
    assert.deepEqual(context, closed, 'The immediate grant never opens a closed ordinary cohort');

    for (const leader of player.leaders) { leader.dead = true; leader.deaths = 1; }
    const opened = structuredClone(context);
    const opening = tleilaxuAmbassadorLeaderOpening(context, player);
    assert.equal(opening, 1);
    assert.deepEqual(quoteLeaderRevivalCohort(context, player).leaders, player.leaders.map(leader => leader.id));
    assert.deepEqual(context, opened, 'Quoting the all-five-first-dead opening does not record it');
    if (faction === 'emperor') {
      first.dead = false;
      assert.equal(quoteLeaderRevivalCohort(context, player).cycle, 0,
        'Clearing death before recording the actual opening would lose it');
      player.revivalCycle = opening!;
      assert.deepEqual(quoteLeaderRevivalCohort(context, player).leaders, player.leaders.slice(1).map(leader => leader.id));
    }
  }
});

void test('repeated native leaders wait for their own ordinary death cohort and then become choices', () => {
  const { context, player } = cohortFixture();
  player.revivalCycle = 1;
  for (const leader of player.leaders) { leader.dead = true; leader.deaths = 1; }
  const repeated = player.leaders[0];
  repeated.deaths = 2;
  assert.deepEqual(quoteLeaderRevivalCohort(context, player).leaders, player.leaders.slice(1).map(leader => leader.id));
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, repeated.id), null);
  assert.equal(tleilaxuAmbassadorLeaderOpening(context, player), 1);

  for (const leader of player.leaders) leader.deaths = 2;
  const before = structuredClone(context);
  assert.equal(quoteLeaderRevivalCohort(context, player).cycle, 2);
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices(context, player).map(choice => choice.id), player.leaders.map(leader => leader.id));
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, repeated.id), repeated);
  assert.equal(tleilaxuAmbassadorLeaderOpening(context, player), 2);
  assert.deepEqual(context, before);

  player.revivalCycle = 2;
  for (const leader of player.leaders.slice(1)) { leader.dead = false; leader.deaths = 1; }
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, repeated.id), repeated,
    'An already opened second cycle survives the other leaders returning alive');
});

void test('unavailable captured and foreign-ghola roster members retain the ordinary cohort exception', () => {
  const { context, player } = cohortFixture('atreides', true);
  const repeated = player.leaders[0];
  repeated.dead = true; repeated.deaths = 2;
  player.revivalCycle = 1;
  for (const leader of player.leaders.slice(1)) {
    leader.deaths = 1;
    leader.capturedBy = 'other';
  }
  delete player.leaders[4].capturedBy;
  player.leaders[4].gholaBy = 'other';
  assert.equal(quoteLeaderRevivalCohort(context, player).cycle, 2);
  assert.deepEqual(quoteLeaderRevivalCohort(context, player).leaders, [repeated.id]);
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, repeated.id), repeated);
  for (const leader of player.leaders.slice(1))
    assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, leader.id), null);
});

void test('Ambassador repeats ignore ordinary phase slot price and prevention without importing early service', () => {
  for (const faction of ['emperor', 'tleilaxu'] as const) {
    const { context, player } = cohortFixture(faction);
    player.revivalCycle = 2;
    player.leaderRevived = true;
    for (const leader of player.leaders) { leader.dead = true; leader.deaths = 2; }
    const expected = quoteLeaderRevivalCohort(context, player);
    for (const phase of [0, 2, 4, 5, 9]) {
      const gated = { ...context, phase, revivalPrevention: { turn: 3, player: player.id } };
      const before = structuredClone(gated);
      assert.deepEqual(quoteLeaderRevivalCohort(gated, player), expected);
      assert.equal(tleilaxuAmbassadorLeaderSelection(gated, player, player.leaders[0].id), player.leaders[0]);
      assert.equal(tleilaxuAmbassadorLeaderOpening(gated, player), 2);
      assert.equal(player.spice, 0);
      assert.equal(player.leaderRevived, true);
      assert.deepEqual(gated, before);
    }
    player.revivalCycle = 0;
    for (const leader of player.leaders.slice(1)) { leader.dead = false; leader.deaths = 0; }
    assert.deepEqual(quoteLeaderRevivalCohort(context, player).leaders, []);
    assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, player.leaders[0].id), null);
    assert.equal(tleilaxuAmbassadorLeaderOpening(context, player), null);
    assert.equal(quoteLeaderRevivalCohort(context, player, true).cycle, 1,
      'The explicit absent-faction card waiver remains available to its original caller');
    assert.deepEqual(quoteLeaderRevivalCohort(context, player, true).leaders, [],
      'Even an explicit first-opening waiver does not waive a second death');
  }
});

void test('opened native cohorts still reject foreign captured and foreign-ghola dead identities', () => {
  const { context, player } = cohortFixture();
  player.revivalCycle = 2;
  for (const leader of player.leaders) { leader.dead = true; leader.deaths = 2; }
  const captive = player.leaders[1], ghola = player.leaders[2];
  captive.capturedBy = 'other'; ghola.gholaBy = 'other';
  const foreign = leaders('harkonnen')[0];
  foreign.dead = true; foreign.deaths = 2;
  player.leaders[3] = foreign;
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices(context, player).map(choice => choice.id),
    [player.leaders[0].id, player.leaders[4].id]);
  for (const leader of [captive, ghola, foreign])
    assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, leader.id), null);
});

void test('Advanced Auditor repeated eligibility remains independent of the five ordinary CHOAM discs', () => {
  const { context, player } = cohortFixture('choam', true);
  const auditor = createAuditorLeader();
  auditor.dead = true; auditor.deaths = 4;
  player.leaders.push(auditor);
  const before = structuredClone(context);
  assert.equal(quoteLeaderRevivalCohort(context, player).cycle, 0);
  assert.deepEqual(quoteLeaderRevivalCohort(context, player).leaders, [auditor.id]);
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, auditor.id), auditor);
  assert.equal(tleilaxuAmbassadorLeaderOpening(context, player), null);
  assert.equal(tleilaxuAmbassadorLeaderSelection({ ...context, advanced: false }, player, auditor.id), null);
  assert.deepEqual(context, before);

  for (const leader of player.leaders.slice(0, 5)) { leader.dead = true; leader.deaths = 2; }
  auditor.dead = false;
  assert.equal(quoteLeaderRevivalCohort(context, player).cycle, 2);
  assert.deepEqual(quoteLeaderRevivalCohort(context, player).leaders, player.leaders.slice(0, 5).map(leader => leader.id));
  assert.equal(tleilaxuAmbassadorLeaderOpening(context, player), 2,
    'A living or more often killed Auditor neither opens nor delays the ordinary cycle');
});

void test('Ecaz repeated permission follows identity cohorts rather than native or Duke death-number equality', () => {
  const { context, player } = cohortFixture('ecaz');
  player.revivalCycle = 3;
  player.ecazRevivalCohort = { cycle: 3, returned: player.leaders.slice(0, 4).map(leader => leader.id) };
  for (const leader of player.leaders) { leader.dead = true; leader.deaths = 8; }
  const pending = player.leaders[4];
  pending.deaths = 2;
  context.dukeVidal!.leader.dead = true;
  context.dukeVidal!.leader.deaths = 7;
  const before = structuredClone(context);
  const quote = quoteLeaderRevivalCohort(context, player);
  assert.equal(quote.cycle, 3);
  assert.deepEqual(quote.leaders, [pending.id]);
  assert.equal(quote.dukeAvailable, true);
  assert.equal(quote.dukeBlocked, null);
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, pending.id), pending);
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, player.leaders[0].id), null);
  assert.deepEqual(tleilaxuAmbassadorLeaderChoices(context, player).map(choice => choice.id), [pending.id, DUKE_VIDAL_ID]);
  assert.equal(tleilaxuAmbassadorLeaderOpening(context, player), 3);
  assert.deepEqual(context, before);

  player.ecazRevivalCohort.returned.push(pending.id);
  assert.equal(quoteLeaderRevivalCohort(context, player).cycle, 4);
  assert.deepEqual(quoteLeaderRevivalCohort(context, player).leaders, player.leaders.map(leader => leader.id));
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, pending.id), pending);
  assert.equal(tleilaxuAmbassadorLeaderOpening(context, player), 4);
});

void test('KH repeats require their own marker to be met by an actual ordinary cohort', () => {
  const { context, player } = cohortFixture('atreides', true);
  player.battleLosses = 7;
  for (const leader of player.leaders) { leader.dead = true; leader.deaths = 2; }
  player.kwisatz = { dead: true, revivalCycle: 2 };
  assert.equal(quoteLeaderRevivalCohort(context, player).cycle, 2);
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, 'kwisatz'), 'kwisatz');
  player.kwisatz.revivalCycle = 3;
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, 'kwisatz'), null);
  player.kwisatz.revivalCycle = 1;
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, 'kwisatz'), 'kwisatz');
});

void test('missing ordinary cohort facts preserve first-death choices without inventing repeat permission', () => {
  const { context, player } = cohortFixture('ecaz');
  player.revivalCycle = 2;
  player.ecazRevivalCohort = { cycle: 2, returned: [] };
  for (const leader of player.leaders) { leader.dead = true; leader.deaths = 2; }
  const first = player.leaders[0], repeated = player.leaders[1];
  first.deaths = 1;
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, player, repeated.id), repeated,
    'The complete source actually permits this repeated identity');
  const contexts = [
    { advanced: false },
    { ...context, turn: undefined },
    { ...context, players: [] },
  ];
  for (const sparse of contexts) {
    assert.equal(tleilaxuAmbassadorLeaderSelection(sparse, player, first.id), first);
    assert.equal(tleilaxuAmbassadorLeaderSelection(sparse, player, repeated.id), null);
    assert.equal(tleilaxuAmbassadorLeaderOpening(sparse, player), null);
  }
  const legacy = { ...player, revivalCycle: undefined };
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, legacy, first.id), first);
  assert.equal(tleilaxuAmbassadorLeaderSelection(context, legacy, repeated.id), null);
  assert.equal(tleilaxuAmbassadorLeaderOpening(context, legacy), null);
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
