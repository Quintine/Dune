import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { combatArmy, homeworldBattleLocation } from '../game/combat-location';
import type { NativeReserveSelections } from '../game/homeworld-native-reserves';
import { takeHarassCard } from './fixture-harass-withdraw';
import {
  REINFORCEMENTS_CARD, REINFORCEMENTS_KAITAIN as K, REINFORCEMENTS_SALUSA as S,
  advanceReinforcementsHomeworld, assertReinforcementsHomeworldCustody,
  createReinforcementsHomeworldFixture, finishReinforcementsHomeworldBattle,
  reinforcementsHomeworldClean, reinforcementsHomeworldPlayer as player,
  reinforcementsHomeworldPool as pool, reinforcementsHomeworldSources as sources,
  revealReinforcementsHomeworldBattle, sealReinforcementsHomeworldPlan,
  type ReinforcementsHomeworldFixture, type ReinforcementsHomeworldStep,
} from './fixture-reinforcements-homeworld';

function rejectsUnchanged(game: Game, actor: string, action: Action): void {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.equal(JSON.stringify(game), before, 'Rejected source or dial must not mutate custody, hand or sealed plans');
}
function assertFinished(game: Game, f: ReinforcementsHomeworldFixture): void {
  assert.equal(game.battle, null);
  assert.ok(!game.homeworldBattleLoss && !game.pendingTreacheryDiscard && reinforcementsHomeworldClean(game));
  assert.equal(game.lastBattleContext!.territory, f.location);
  assert.equal(game.discard.filter(c => c.id === REINFORCEMENTS_CARD).length, 1);
  assert.ok(!player(game, f.owner).hand.some(c => c.id === REINFORCEMENTS_CARD));
  assertReinforcementsHomeworldCustody(game);
}
function canonicalSources(allocation: NativeReserveSelections): string {
  return JSON.stringify(Object.entries(allocation).filter(([, n]) => n.normal + n.elite > 0)
    .sort(([a], [b]) => a.localeCompare(b)));
}

for (const advanced of [false, true]) for (const slot of ['weapon', 'defense'] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} visiting ${slot} pays three native normals, not its foreign army, on loss`, () => {
    const f = createReinforcementsHomeworldFixture({ advanced, slot });
    const preview = viewGame(f.game, f.owner).battle!.reinforcements!;
    assert.equal(preview.blocked, null);
    assert.equal(viewGame(f.game, f.opponent).battle!.reinforcements, null);
    assert.equal(viewGame(f.game, f.observer).battle!.reinforcements, null);
    let game = sealReinforcementsHomeworldPlan(f.game, f.planActions[0]);
    assert.equal(viewGame(game, f.opponent).battle!.plans[f.owner], undefined);
    assert.equal(viewGame(game, f.observer).battle!.plans[f.owner], undefined);
    assert.deepEqual(game.homeworlds, f.game.homeworlds, 'Sealing is not a premature reserve payment');
    game = sealReinforcementsHomeworldPlan(JSON.parse(JSON.stringify(game)) as Game, f.planActions[1]);
    assert.deepEqual(viewGame(game, f.owner).battle!.traitorVoters, [f.native]);
    rejectsUnchanged(game, f.visitor, { type: 'traitorCall', call: false });
    const actions: ReinforcementsHomeworldStep[] = [];
    const done = finishReinforcementsHomeworldBattle(game, { actions });
    const before = player(f.game, f.owner), after = player(done, f.owner);
    assert.equal(done.lastBattleContext!.winner, f.opponent);
    assert.equal(done.lastBattleContext!.result, 'normal');
    assert.equal(after.reserves, before.reserves - 3);
    assert.equal(after.elites!.reserves, before.elites!.reserves);
    assert.equal(after.tanks, before.tanks + 10, 'Three fee counters plus the seven actual invaders');
    assert.equal(after.elites!.tanks, before.elites!.tanks + 4);
    assert.equal(after.battleLosses, before.battleLosses + 10);
    assert.equal(after.spice, before.spice - (advanced ? 2 : 0), 'Only the original two supported physical normals cost spice');
    assert.deepEqual(pool(done, f.owner, K), advanced ? { normal: 7, elite: 0 } : { normal: 9, elite: 1 });
    if (advanced) assert.deepEqual(pool(done, f.owner, S), { normal: 2, elite: 1 });
    assert.deepEqual(combatArmy(done, f.owner, f.location), { normal: 0, elite: 0 });
    assert.deepEqual(actions.filter(s => s.action.type === 'traitorCall').map(s => s.actor), [f.native]);
    assert.equal(after.revived, before.revived); assert.equal(after.freeForcesRevived, before.freeForcesRevived);
    assertFinished(done, f);
  });
}

void test('actual Advanced native movement exposes all three legal fee allocations and each charges its chosen World after reload', () => {
  for (const salusaNormal of [0, 1, 2]) {
    const f = createReinforcementsHomeworldFixture({ advanced: true, sources: sources(salusaNormal) });
    const choices = viewGame(f.game, f.owner).battle!.reinforcements!.homeworldSources!;
    assert.deepEqual(choices.map(canonicalSources).sort(), [0, 1, 2].map(n => canonicalSources(sources(n))).sort());
    let game = sealReinforcementsHomeworldPlan(f.game, f.planActions[0]);
    game = sealReinforcementsHomeworldPlan(JSON.parse(JSON.stringify(game)) as Game, f.planActions[1]);
    const done = finishReinforcementsHomeworldBattle(game);
    assert.deepEqual(pool(done, f.owner, K), { normal: 7 + salusaNormal, elite: 0 });
    assert.deepEqual(pool(done, f.owner, S), { normal: 2 - salusaNormal, elite: 1 });
    assert.equal(player(done, f.owner).tanks, 10);
    assert.equal(player(done, f.owner).elites!.tanks, 4);
    assertFinished(done, f);
  }
});

void test('ambiguous missing, foreign, wrong-type, nonphysical and overdrawn native fee sources reject without changing a real battle', () => {
  const f = createReinforcementsHomeworldFixture({ advanced: true });
  const missing = { ...f.planActions[0].action }; delete missing.reinforcementsSources;
  rejectsUnchanged(f.game, f.owner, missing);
  for (const allocation of [
    {},
    { 'homeworld:guild': { normal: 3, elite: 0 } },
    { kaitain: { normal: 3, elite: 0 } },
    { [K]: { normal: 2, elite: 1 } },
    { [S]: { normal: 0, elite: 3 } },
    { [S]: { normal: 3, elite: 0 } },
    { [K]: { normal: 4, elite: 0 } },
    { [K]: { normal: 2, elite: 0 } },
    { [K]: { normal: 3 } },
    { [K]: { normal: '3', elite: 0 } },
    { [K]: { normal: 3, elite: 0, visitor: true } },
  ]) rejectsUnchanged(f.game, f.owner, { ...f.planActions[0].action, reinforcementsSources: allocation } as Action);
  rejectsUnchanged(f.game, f.owner, { ...f.planActions[0].action, weapon: null, defense: null });
  assert.equal(Object.keys(f.game.battle!.plans).length, 0);
  assertReinforcementsHomeworldCustody(f.game);
});

void test('a unique Basic World fee derives its exact source instead of demanding a redundant selector', () => {
  const f = createReinforcementsHomeworldFixture({ advanced: false });
  const action = { ...f.planActions[0].action }; delete action.reinforcementsSources;
  let game = sealReinforcementsHomeworldPlan(f.game, { actor: f.owner, action });
  game = sealReinforcementsHomeworldPlan(game, f.planActions[1]);
  const done = finishReinforcementsHomeworldBattle(game);
  assert.deepEqual(pool(done, f.owner, K), { normal: 9, elite: 1 });
  assertFinished(done, f);
});

for (const advanced of [false, true]) for (const role of ['visitor', 'native'] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} ${role} winner pays its physical dial separately and must discard Reinforcements`, () => {
    const f = createReinforcementsHomeworldFixture({ advanced, role, outcome: 'win', slot: 'weapon' });
    const before = player(f.game, f.owner);
    const done = finishReinforcementsHomeworldBattle(revealReinforcementsHomeworldBattle(f));
    const after = player(done, f.owner);
    assert.equal(done.lastBattleContext!.winner, f.owner);
    assert.equal(after.tanks, before.tanks + 5, 'Three native fee counters and two real dial casualties, no virtual bonus casualties');
    assert.equal(after.elites!.tanks, before.elites!.tanks);
    assert.equal(after.battleLosses, before.battleLosses + 5);
    if (role === 'visitor') assert.ok(done.log.slice(f.game.log.length).some(entry =>
      entry.text === `${before.name} received 2 spice from ${f.location}'s occupied bank award.`),
    'Completing the last visitor battle includes its actual occupied-World Collection award.');
    assert.equal(after.spice, before.spice - (advanced ? 2 : 0) + (role === 'visitor' ? 2 : 0));
    if (role === 'visitor') {
      assert.deepEqual(combatArmy(done, f.owner, f.location), { normal: 1, elite: 4 });
      assert.equal(after.reserves, before.reserves - 3);
    } else {
      assert.deepEqual(pool(done, f.owner, K), advanced ? { normal: 0, elite: 0 } : { normal: 10, elite: 5 });
      assert.equal(after.reserves, before.reserves - 5);
    }
    if (advanced) assert.deepEqual(pool(done, f.owner, S), pool(f.game, f.owner, S));
    assertFinished(done, f);
    const continued = advanceReinforcementsHomeworld(done, g => g.phase === 7 && reinforcementsHomeworldClean(g));
    assert.equal(continued.turn, f.game.turn);
    assertFinished(continued, f);
  });
}

void test('own-World fee removes its counters from dial/support availability, while a fee on the other native World does not', () => {
  const f = createReinforcementsHomeworldFixture({ advanced: true, role: 'native', nativeTransfer: 12 });
  assert.deepEqual(pool(f.game, f.owner, K), { normal: 3, elite: 0 });
  assert.deepEqual(pool(f.game, f.owner, S), { normal: 12, elite: 5 });
  rejectsUnchanged(f.game, f.owner, { ...f.planActions[0].action, dial: 1, support: 1 });
  rejectsUnchanged(f.game, f.owner, { ...f.planActions[0].action, dial: 0.5, support: 0 });
  const onWorld = sealReinforcementsHomeworldPlan(f.game, f.planActions[0]);
  assert.deepEqual(onWorld.homeworlds, f.game.homeworlds);
  const offWorld = sealReinforcementsHomeworldPlan(f.game, { actor: f.owner,
    action: { ...f.planActions[0].action, dial: 3, support: 3, reinforcementsSources: sources(3) } });
  const offDone = finishReinforcementsHomeworldBattle(
    sealReinforcementsHomeworldPlan(offWorld, f.planActions[1]));
  assert.equal(offDone.lastBattleContext!.winner, f.owner);
  assert.equal(player(offDone, f.owner).tanks, 6, 'The off-World fee leaves three real natives available to win and pay their dial');
  assert.deepEqual(pool(offDone, f.owner, K), { normal: 0, elite: 0 });
  assert.deepEqual(pool(offDone, f.owner, S), { normal: 9, elite: 5 });
  assertFinished(offDone, f);
  const done = finishReinforcementsHomeworldBattle(
    sealReinforcementsHomeworldPlan(onWorld, f.planActions[1]));
  assert.equal(player(done, f.owner).tanks, 3, 'No fee counter is destroyed a second time as a native loser');
  assert.deepEqual(pool(done, f.owner, K), { normal: 0, elite: 0 });
  assert.deepEqual(pool(done, f.owner, S), { normal: 12, elite: 5 });
  assertFinished(done, f);
});

void test('own-World loss retains original high-face strength, not a retroactive low-face bonus after its fee', () => {
  const f = createReinforcementsHomeworldFixture({ advanced: true, role: 'native' });
  assert.deepEqual(pool(f.game, f.owner, K), { normal: 5, elite: 0 });
  assert.equal(homeworldBattleLocation(f.game, K)!.side, 'high');
  assert.equal(homeworldBattleLocation(f.game, K)!.nativeBattleStrength, 2);
  const opposingLeader = player(f.game, f.opponent).leaders.find(l => l.strength === 3)!;
  const game = sealReinforcementsHomeworldPlan(
    sealReinforcementsHomeworldPlan(f.game, f.planActions[0]),
    { actor: f.opponent, action: { ...f.planActions[1].action, leader: opposingLeader.id, dial: 3.5, support: 2 } });
  // Emperor: original printed 2 + Bashar 2 + Reinforcements 2 = 6.
  // Guild: leader 3 + five normals with two support = 6.5.
  // Re-reading Kaitain's post-fee low face would illegally give Emperor 7.
  const done = finishReinforcementsHomeworldBattle(game);
  assert.equal(done.lastBattleContext!.winner, f.opponent);
  assert.equal(done.lastBattleContext!.result, 'normal');
  assert.equal(player(done, f.owner).tanks, 5, 'Three original fees and the two remaining physical natives');
  assert.equal(player(done, f.owner).elites!.tanks, 0);
  assert.deepEqual(pool(done, f.owner, K), { normal: 0, elite: 0 });
  assert.deepEqual(pool(done, f.owner, S), { normal: 10, elite: 5 });
  assertFinished(done, f);
});

for (const advanced of [false, true]) for (const role of ['visitor', 'native'] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} ${role} pays its original native fee on the sole native's genuine Traitor call`, () => {
    const f = createReinforcementsHomeworldFixture({ advanced, role, outcome: 'traitor' });
    const revealed = revealReinforcementsHomeworldBattle(f);
    assert.deepEqual(viewGame(revealed, f.owner).battle!.traitorVoters, [f.native]);
    rejectsUnchanged(revealed, f.visitor, { type: 'traitorCall', call: true });
    const actions: ReinforcementsHomeworldStep[] = [];
    const done = finishReinforcementsHomeworldBattle(revealed, { callers: [f.native], actions });
    assert.equal(done.lastBattleContext!.result, 'traitor');
    assert.equal(done.lastBattleContext!.winner, f.native);
    assert.equal(player(done, f.owner).tanks, role === 'visitor' ? 10 : 3);
    assert.equal(player(done, f.owner).elites!.tanks, role === 'visitor' ? 4 : 0);
    assert.equal(player(done, f.owner).reserves, player(f.game, f.owner).reserves - 3);
    assert.deepEqual(pool(done, f.owner, K), role === 'visitor'
      ? advanced ? { normal: 7, elite: 0 } : { normal: 9, elite: 1 }
      : advanced ? { normal: 2, elite: 0 } : { normal: 12, elite: 5 });
    if (advanced) assert.deepEqual(pool(done, f.owner, S), pool(f.game, f.owner, S));
    assert.deepEqual(actions.filter(s => s.action.type === 'traitorCall').map(s => s.actor), [f.native]);
    const betrayed = f.native === f.owner ? f.opponent : f.owner;
    assert.equal(player(done, betrayed).leaders.find(l => l.id === revealed.battle!.plans[betrayed].leader)!.dead, true);
    assertFinished(done, f);
  });
}

for (const advanced of [false, true]) for (const role of ['visitor', 'native'] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} ${role} explosion pays the fee first and preserves the native printed casualty exception`, () => {
    const f = createReinforcementsHomeworldFixture({ advanced, role, outcome: 'explosion' });
    const nativeBefore = combatArmy(f.game, f.native, f.location);
    const printed = homeworldBattleLocation(f.game, f.location)!.nativeBattleStrength;
    const revealed = revealReinforcementsHomeworldBattle(f);
    const own = revealed.battle!.plans[f.owner], other = revealed.battle!.plans[f.opponent];
    const done = finishReinforcementsHomeworldBattle(revealed, { explosionLosses: { normal: printed, elite: 0 } });
    assert.equal(done.lastBattleContext!.result, 'explosion');
    assert.equal(done.lastBattleContext!.winner, null);
    assert.equal(player(done, f.owner).tanks, role === 'visitor' ? 10 : 3 + printed);
    assert.equal(player(done, f.owner).elites!.tanks, role === 'visitor' ? 4 : 0);
    assert.deepEqual(combatArmy(done, f.native, f.location), {
      normal: nativeBefore.normal - printed - (role === 'native' ? 3 : 0), elite: nativeBefore.elite,
    });
    if (advanced) assert.deepEqual(pool(done, f.owner, S), pool(f.game, f.owner, S));
    for (const [actor, plan] of [[f.owner, own], [f.opponent, other]] as const)
      assert.equal(player(done, actor).leaders.find(l => l.id === plan.leader)!.dead, true);
    for (const id of [REINFORCEMENTS_CARD, own.weapon, other.defense])
      assert.equal(done.discard.filter(c => c.id === id).length, 1);
    assertFinished(done, f);
  });
}

void test('native Salusa explosion uses exact remaining Sardaukar custody after a split normal-first fee', () => {
  const f = createReinforcementsHomeworldFixture({ advanced: true, role: 'native', secondary: true,
    outcome: 'explosion', sources: sources(2) });
  assert.deepEqual(pool(f.game, f.owner, K), { normal: 13, elite: 0 });
  assert.deepEqual(pool(f.game, f.owner, S), { normal: 2, elite: 5 });
  assert.equal(homeworldBattleLocation(f.game, S)!.nativeBattleStrength, 3);
  const done = finishReinforcementsHomeworldBattle(revealReinforcementsHomeworldBattle(f), {
    explosionLosses: { normal: 0, elite: 3 },
  });
  assert.equal(done.lastBattleContext!.result, 'explosion');
  assert.equal(player(done, f.owner).reserves, player(f.game, f.owner).reserves - 6);
  assert.equal(player(done, f.owner).elites!.reserves, 2);
  assert.equal(player(done, f.owner).tanks, 6);
  assert.equal(player(done, f.owner).elites!.tanks, 3);
  assert.equal(player(done, f.owner).battleLosses, 6);
  assert.deepEqual(pool(done, f.owner, K), { normal: 12, elite: 0 });
  assert.deepEqual(pool(done, f.owner, S), { normal: 0, elite: 2 });
  assertFinished(done, f);
});

void test('a split fee crossing Kaitain low retains the original printed explosion losses', () => {
  const f = createReinforcementsHomeworldFixture({ advanced: true, role: 'native',
    outcome: 'explosion', sources: sources(2) });
  const done = finishReinforcementsHomeworldBattle(revealReinforcementsHomeworldBattle(f), {
    explosionLosses: { normal: 2, elite: 0 },
  });
  assert.equal(done.lastBattleContext!.result, 'explosion');
  assert.equal(player(done, f.owner).tanks, 5, 'Three reserve fees plus the original high-face two, not the later low-face three');
  assert.equal(player(done, f.owner).elites!.tanks, 0);
  assert.deepEqual(pool(done, f.owner, K), { normal: 2, elite: 0 });
  assert.deepEqual(pool(done, f.owner, S), { normal: 8, elite: 5 });
  assertFinished(done, f);
});

void test('a real named Reinforcements promise finds and executes the off-World fee needed for its fixed native dial', () => {
  const f = createReinforcementsHomeworldFixture({ advanced: true, role: 'native', nativeTransfer: 12 });
  let game = f.game;
  const truth = game.deck.find(card => card.effect === 'truthtrance'); assert.ok(truth);
  takeHarassCard(game, f.observer, truth.id);
  game = applyAction(game, f.observer, { type: 'card', card: truth.id });
  while (game.truthtrance!.stage === 'priority') {
    const actor = game.players.find(p => !game.truthtrance!.passed.includes(p.id))!.id;
    game = applyAction(game, actor, { type: 'truthPass' });
  }
  game = applyAction(game, f.observer, { type: 'truthAsk', question: {
    kind: 'battlePlan', target: f.owner, claim: { kind: 'and', terms: [
      { kind: 'weapon', name: 'Reinforcements' }, { kind: 'dial', compare: 'eq', value: 3 },
    ] },
  } });
  assert.ok(viewGame(game, f.owner).truthBattleAnswers!.includes('yes'));
  game = applyAction(game, f.owner, { type: 'truthAnswer', answer: 'yes' });
  const witness = viewGame(game, f.owner).battle!.compliantPlan; assert.ok(witness);
  rejectsUnchanged(game, f.owner, { type: 'battlePlan', ...witness, reinforcementsSources: sources(0) });
  game = applyAction(game, f.owner, { type: 'battlePlan', ...witness });
  game = sealReinforcementsHomeworldPlan(game, f.planActions[1]);
  const done = finishReinforcementsHomeworldBattle(game);
  assert.equal(done.lastBattleContext!.winner, f.owner);
  assert.equal(player(done, f.owner).tanks, 6);
  assert.equal(player(done, f.owner).spice, player(f.game, f.owner).spice - 3);
  assert.deepEqual(pool(done, f.owner, K), { normal: 0, elite: 0 });
  assert.deepEqual(pool(done, f.owner, S), { normal: 9, elite: 5 });
  assert.equal(done.discard.filter(card => card.id === truth.id).length, 1);
  assertFinished(done, f);
});
