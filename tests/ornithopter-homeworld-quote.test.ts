import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameView } from '../game/engine';
import { imperialFlightPools, imperialFlightCohort } from '../game/ornithopter-homeworld';
import { createRemainingCohort, validateCohortSelection, type MovementCohort } from '../game/ornithopter';
import { emperorHomeworldMoveAction, emperorHomeworldMoveActions } from '../game/homeworld-options';
import { homeworldForceGroups, type HomeworldCustody } from '../game/homeworld-custody';
import { homeworldPopulations } from '../game/homeworld-population';
import { quoteEmperorHomeworldMove, type EmperorHomeworldMove } from '../game/homeworld-emperor-move';
import { richeseCards } from '../game/richese-cards';

const card = richeseCards().find(candidate => candidate.effect === 'ornithopter')!;
const kaitain = 'homeworld:emperor', salusa = 'homeworld:emperor:salusa';
const order: EmperorHomeworldMove = { origin: kaitain, forces: { normal: 1, elite: 0 } };

/** Controlled public custody/view supplement, not an acquired-card gameplay
 * chronology. Actual native route quotes provide the typed World tables. */
function fixture(custody: HomeworldCustody = { salusa: { normal: 2, elite: 2 }, visitors: {} }) {
  const context = { advanced: true, players: [
    { id: 'e', faction: 'emperor' as const, reserves: 8, eliteReserves: 3 },
    { id: 'a', faction: 'atreides' as const, reserves: 18, eliteReserves: 0 },
  ] };
  const populations = homeworldPopulations(context, custody);
  const worlds = homeworldForceGroups(context, custody).map(world => ({ ...world,
    ...populations.find(population => population.location === world.id)! }));
  const view = { me: 'e', active: 'e', advanced: true, status: 'playing', phase: 5,
    homeworldMove: { event: 'current-native-world-event', remaining: 1, blocked: null },
    homeworlds: { worlds },
    players: context.players.map(player => ({ ...player, name: player.faction, ally: null,
      forces: player.id === 'e' ? { 'arrakeen:10': 2 } : {},
      elites: { reserves: player.eliteReserves, forces: player.id === 'e' ? { 'arrakeen:10': 1 } : {} },
      hand: player.id === 'e' ? [{ ...card }] : [], autopilot: null })),
    ornithopter: { card: { ...card }, blocked: null,
      modes: [{ mode: 'range3', blocked: null }, { mode: 'twoGroups', blocked: null }], active: null },
  } as unknown as GameView;
  return { context, custody, worlds, view };
}
function active(view: GameView, cohort: MovementCohort, aware = true) {
  view.ornithopter!.active = { event: 'actual-active-flight-event', mode: 'twoGroups', completed: 1,
    remaining: 1, cohort, ...(aware ? { homeworldCohort: true } : {}) };
  view.players.find(player => player.id === view.me)!.hand = [];
  view.homeworldMove!.remaining = 0;
}

void test('Imperial flight pools merge only actual native World types under canonical ID keys', () => {
  const f = fixture(), board = { 'arrakeen:10': 2 }, elite = { 'arrakeen:10': 1 };
  const before = structuredClone({ board, elite, worlds: f.worlds });
  const pools = imperialFlightPools(board, elite, f.worlds, 'e');
  assert.deepEqual(pools, { forces: { 'arrakeen:10': 2, [kaitain]: 4, [salusa]: 4 },
    elites: { 'arrakeen:10': 1, [kaitain]: 1, [salusa]: 2 } });
  assert.equal(Object.hasOwn(pools.forces, 'homeworld:atreides'), false);
  assert.equal(Object.hasOwn(pools.forces, `${kaitain}:0`), false);
  assert.deepEqual(imperialFlightPools(board, elite, [], 'e'), { forces: board, elites: elite });
  assert.deepEqual({ board, elite, worlds: f.worlds }, before);
});

void test('aware depleted quotas are cloned without regeneration while legacy board cohorts gain untouched current native Worlds', () => {
  const f = fixture(), cohort: MovementCohort = { forces: { 'arrakeen:10': 1 }, elites: {},
    noField: { tokenId: 'old-marker', event: 'old-event', from: 'arrakeen:10' } };
  const aware = imperialFlightCohort(cohort, true, f.worlds, 'e');
  assert.deepEqual(aware, cohort);
  assert.notEqual(aware.forces, cohort.forces);
  assert.notEqual(aware.noField, cohort.noField);
  const legacy = imperialFlightCohort(cohort, false, f.worlds, 'e');
  assert.equal(legacy.forces[kaitain], 4);
  assert.equal(legacy.elites[salusa], 2);
  assert.equal(legacy.forces['arrakeen:10'], 1);
  const current = imperialFlightPools({ 'arrakeen:10': 2 }, {}, f.worlds, 'e');
  assert.throws(() => validateCohortSelection(aware, current.forces, current.elites, { [kaitain]: 1 }, {}), /original unmoved/);
  assert.doesNotThrow(() => validateCohortSelection(legacy, current.forces, current.elites, { [kaitain]: 1 }, {}));
});

void test('ordinary Imperial packets stay unchanged and either held-card mode uses exactly the native route', () => {
  const f = fixture();
  const ordinary = { type: 'emperorHomeworldMove', event: f.view.homeworldMove!.event,
    origin: kaitain, normal: 1, elite: 0 };
  assert.deepEqual(emperorHomeworldMoveAction(f.view, order), ordinary);
  for (const mode of ['range3', 'twoGroups'] as const)
    assert.deepEqual(emperorHomeworldMoveAction(f.view, order, mode), { ...ordinary, movementCard: card.id, ornithopter: mode });
  const invalid = { origin: 'homeworld:atreides', forces: { normal: 1, elite: 0 } } as unknown as EmperorHomeworldMove;
  assert.equal(emperorHomeworldMoveAction(f.view, invalid, 'range3'), null);
  assert.equal(emperorHomeworldMoveAction(f.view, { ...order, forces: { normal: 4, elite: 0 } }, 'twoGroups'), null);
  assert.equal(emperorHomeworldMoveAction(f.view, { ...order, forces: { normal: 0, elite: 0 } }, 'range3'), null);
});

void test('a World first group cannot reuse arriving counters and a remaining group adds only its native flight event', () => {
  const f = fixture();
  const pools = imperialFlightPools({ 'arrakeen:10': 2 }, { 'arrakeen:10': 1 }, f.worlds, 'e');
  const cohort = createRemainingCohort(pools.forces, pools.elites, { [kaitain]: 1 }, {});
  const transferred = quoteEmperorHomeworldMove({ ...f.context, status: 'playing', phase: 5,
    currentPlayer: 'e', movesLeft: 1 }, f.custody, 'e', order);
  const after = fixture(transferred.state).view;
  active(after, cohort);
  const originalNormal = { origin: salusa, forces: { normal: 2, elite: 0 } } as const;
  assert.deepEqual(emperorHomeworldMoveAction(after, originalNormal), {
    type: 'emperorHomeworldMove', event: after.homeworldMove!.event, origin: salusa, normal: 2, elite: 0,
    ornithopterEvent: 'actual-active-flight-event',
  });
  assert.equal(emperorHomeworldMoveAction(after, { ...originalNormal, forces: { normal: 3, elite: 0 } }), null);
  assert.equal(emperorHomeworldMoveAction(after, originalNormal, 'range3'), null);
  after.ornithopter!.active!.event = '';
  assert.equal(emperorHomeworldMoveAction(after, originalNormal), null);
});

void test('continuation candidates honor original normal and elite quotas separately and support old board-only flights', () => {
  const f = fixture();
  active(f.view, { forces: { [kaitain]: 1 }, elites: { [kaitain]: 1 } });
  assert.equal(emperorHomeworldMoveAction(f.view, order), null);
  assert.ok(emperorHomeworldMoveAction(f.view, { ...order, forces: { normal: 0, elite: 1 } }));
  const actions = emperorHomeworldMoveActions(f.view);
  assert.ok(actions.length);
  assert.ok(actions.every(action => action.origin === kaitain && action.normal === 0 && action.elite === 1));
  const normal = fixture(); active(normal.view, { forces: { [kaitain]: 1 }, elites: {} });
  assert.equal(emperorHomeworldMoveAction(normal.view, { ...order, forces: { normal: 0, elite: 1 } }), null);
  const legacy = fixture(); active(legacy.view, { forces: { 'arrakeen:10': 1 }, elites: {} }, false);
  assert.ok(emperorHomeworldMoveAction(legacy.view, order));
  assert.ok(emperorHomeworldMoveActions(legacy.view).length);
});

void test('an uncompleted on-table flight can replace a prevented first ground group with native World movement before a cohort exists', () => {
  for (const mode of ['range3', 'twoGroups'] as const) {
    const f = fixture();
    f.view.players[0].hand = [];
    f.view.ornithopter!.active = { event: 'uncompleted-flight', mode, completed: 0,
      remaining: mode === 'twoGroups' ? 2 : 1, cohort: undefined };
    assert.deepEqual(emperorHomeworldMoveAction(f.view, order), {
      type: 'emperorHomeworldMove', event: f.view.homeworldMove!.event, origin: kaitain, normal: 1, elite: 0,
      ornithopterEvent: 'uncompleted-flight',
    });
    assert.ok(emperorHomeworldMoveActions(f.view).length);
    f.view.homeworldMove!.blocked = 'The original prevention response is pending.';
    assert.equal(emperorHomeworldMoveAction(f.view, order), null);
  }
});

void test('missing held physical card blocked mode wrong owner and native modal guards refuse new flight declarations', () => {
  const missing = fixture().view; missing.players[0].hand = [];
  assert.equal(emperorHomeworldMoveAction(missing, order, 'twoGroups'), null);
  assert.ok(emperorHomeworldMoveAction(missing, order));
  const mode = fixture().view; mode.ornithopter!.modes[0].blocked = 'Card is committed.';
  assert.equal(emperorHomeworldMoveAction(mode, order, 'range3'), null);
  assert.ok(emperorHomeworldMoveAction(mode, order, 'twoGroups'));
  const basic = fixture().view; basic.advanced = false;
  const foreign = fixture().view; foreign.active = 'a';
  const closed = fixture().view; closed.homeworldMove!.blocked = 'Finish the pending native interaction.';
  for (const view of [basic, foreign, closed]) {
    assert.equal(emperorHomeworldMoveAction(view, order, 'twoGroups'), null);
    assert.deepEqual(emperorHomeworldMoveActions(view), []);
  }
});
