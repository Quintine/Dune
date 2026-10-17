import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { combatArmy } from '../game/combat-location';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { harassHomeworldPool as pool, finishHarassHomeworldBattle } from './fixture-harass-homeworld';
import { advanceNativeWorldBattle } from './fixture-native-world-battle';
import {
  finishReinforcementsHomeworldBattle, revealReinforcementsHomeworldBattle,
} from './fixture-reinforcements-homeworld';
import {
  actWorldPhaseBattle, advanceWorldPhaseBattle, assertWorldPhaseBattleInventory,
  createWorldPhaseBattleFixture, createWorldPhaseOwnBattleFixture, createWorldPhaseVisitorBattleFixture,
  finishWorldPhaseBattle, revealWorldPhaseBattle, worldPhaseBattleClean,
  worldPhaseBattlePlayer as player, type WorldPhaseBattleFixture,
} from './fixture-world-phase-battle';

function assertCompletedUtilityBattle(game: Game, f: WorldPhaseBattleFixture): void {
  assert.equal(game.turn, 2);
  assert.equal(game.phase, 6, 'A second paid native conflict prevents Collection from hiding battle economics');
  assert.equal(game.battle, null);
  assert.ok(worldPhaseBattleClean(game));
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(game.lastBattleContext!.result, 'normal');
  for (const id of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD]) {
    assert.equal(game.discard.filter(card => card.id === id).length, 1);
    assert.ok(!player(game, f.owner).hand.some(card => card.id === id));
  }
  assert.deepEqual(combatArmy(game, f.observer, 'homeworld:guild'), { normal: 1, elite: 0 },
    'The original paid Emperor visitor remains outside Player.forces and native reserve totals');
  assert.equal(player(game, f.observer).reserves, 19);
  assert.deepEqual(pool(game, f.opponent, 'homeworld:guild'), { normal: 11, elite: 0 });
  assertWorldPhaseBattleInventory(game);
}

for (const support of [0, 1, 3]) {
  void test(`earned Arrakeen + original Tech: support ${support} pays only actual support, then exact native R/H custody`, () => {
    const f = createWorldPhaseBattleFixture({ support });
    assert.equal(f.beforeFirstMentat.strongholdCards!.owners.arrakeen, null);
    assert.equal(player(f.beforeFirstMentat, f.owner).forces[f.location], 10);
    assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, f.owner);
    assert.equal(f.afterFirstMentat.strongholdCards!.claimedTurn, 1);

    const ownShipment = f.shipments.find(s => s.step.actor === f.owner)!;
    const attack = f.shipments.find(s => s.step.actor === f.opponent)!;
    assert.equal(player(ownShipment.before, f.owner).spice - player(ownShipment.after, f.owner).spice, 4,
      'Four original Caladan counters pay their native four-spice invoice');
    assert.equal(player(attack.before, f.opponent).spice - player(attack.after, f.opponent).spice, 2,
      'Four original Guild invaders pay their real native half-price invoice');
    assert.deepEqual(pool(f.game, f.owner, 'homeworld:atreides'), { normal: 6, elite: 0 });
    assert.deepEqual(combatArmy(f.game, f.owner, f.game.battle!.territory), { normal: 14, elite: 0 });
    assert.equal(f.game.techTokens!.heighliners.owner, f.opponent);
    assert.equal(f.game.techTokens!.heighliners.spice, 0);

    const revealed = revealWorldPhaseBattle(f);
    assert.equal(player(revealed, f.owner).reserves, 6, 'Sealing and reveal do not prematurely spend counters');
    const done = finishWorldPhaseBattle(revealed, f);
    const committed = 6 - support;
    const returned = 14 - committed;
    assert.equal(player(done, f.owner).spice, player(f.game, f.owner).spice - Math.max(0, support - 2),
      'Arrakeen covers at most two actually selected support; it never mints personal spice');
    assert.equal(player(done, f.owner).tanks, 3 + committed,
      'Three off-World native fee counters plus only the physical committed Arrakeen complement die');
    assert.equal(player(done, f.owner).battleLosses, 3 + committed);
    assert.equal(player(done, f.owner).reserves, 3 + returned,
      'Original Caladan6 pays R3 before all undialed board counters return to that actual native pool');
    assert.deepEqual(pool(done, f.owner, 'homeworld:atreides'), { normal: 3 + returned, elite: 0 });
    assert.deepEqual(combatArmy(done, f.owner, f.game.battle!.territory), { normal: 0, elite: 0 });
    assert.equal(player(done, f.opponent).tanks, 4);
    assert.equal(player(done, f.opponent).spice, player(f.game, f.opponent).spice,
      'Winning does not retroactively redirect the former owner’s Heighliners income');
    assert.equal(done.techTokens!.heighliners.owner, f.owner, 'Original winner Tech transfer follows the actual Guild defeat');
    assert.equal(done.techTokens!.heighliners.spice, 0);
    assert.equal(viewGame(done, f.owner).homeworlds?.worlds?.find(w => w.native === f.owner)?.side, 'high');
    assertCompletedUtilityBattle(done, f);
  });
}

void test('Advanced earned Strongholds alone: utility fee cannot turn six native reserves into extra Arrakeen dial', () => {
  const f = createWorldPhaseBattleFixture({ tech: false, strongholds: true });
  const tooMany = structuredClone(f.plans[0].action);
  tooMany.dial = 8.5; tooMany.support = 2;
  assert.throws(() => applyAction(f.game, f.owner, tooMany),
    'Fifteen physical board commitments cannot borrow any of the six native reserves, even with R');
  const wrongSource = structuredClone(f.plans[0].action);
  wrongSource.reinforcementsSources = { 'homeworld:guild': { normal: 3, elite: 0 } };
  assert.throws(() => applyAction(f.game, f.owner, wrongSource), 'Only original native reserves can pay this fee');
  const done = finishWorldPhaseBattle(revealWorldPhaseBattle(f), f);
  assert.equal(player(done, f.owner).spice, player(f.game, f.owner).spice - 1);
  assert.equal(player(done, f.opponent).spice, player(f.game, f.opponent).spice,
    'No post-battle income may be fabricated when the Tech module is absent');
  assert.equal(player(done, f.owner).tanks, 6);
  assert.deepEqual(pool(done, f.owner, 'homeworld:atreides'), { normal: 14, elite: 0 });
  assertCompletedUtilityBattle(done, f);
});

void test('Basic Worlds + original Tech: native paid attack and R/H retain Basic forces and no support charge', () => {
  const f = createWorldPhaseBattleFixture({ advanced: false, tech: true, strongholds: false });
  const tooMany = structuredClone(f.plans[0].action); tooMany.dial = 15;
  assert.throws(() => applyAction(f.game, f.owner, tooMany), 'The native fee is never an additional Basic board army');
  const done = finishWorldPhaseBattle(revealWorldPhaseBattle(f), f);
  assert.equal(player(done, f.owner).spice, player(f.game, f.owner).spice, 'Basic pays no force support');
  assert.equal(player(done, f.owner).tanks, 6);
  assert.deepEqual(pool(done, f.owner, 'homeworld:atreides'), { normal: 14, elite: 0 });
  assert.equal(viewGame(done, f.owner).strongholdCards, null);
  assert.equal(done.techTokens!.heighliners.owner, f.owner);
  assertCompletedUtilityBattle(done, f);
});

void test('native current Caladan face: a surviving original army consumes the actual reinforcement decision', () => {
  const f = createWorldPhaseBattleFixture();
  const plans = structuredClone(f.plans);
  plans[0].action.weapon = null; plans[0].action.defense = null;
  delete plans[0].action.reinforcementsSources;
  let game = revealWorldPhaseBattle(f, plans);
  game = advanceWorldPhaseBattle(game, g => !g.response && !g.phaseOpening && g.decision?.kind === 'caladanReinforcement');
  assert.equal(game.decision!.player, f.owner);
  assert.equal(player(game, f.owner).reserves, 6);
  assert.equal(player(game, f.owner).tanks, 3);
  assert.equal(player(game, f.owner).forces[f.location], 11);
  const beforeSpice = player(game, f.owner).spice;
  const offer = viewGame(game, f.owner).caladanReinforcement!;
  const destination = offer.destinations.find(d => d.id === f.location && !d.blocked); assert.ok(destination);
  game = actWorldPhaseBattle(game, { actor: f.owner,
    action: { type: 'decision', event: offer.event, destination: destination.id } });
  game = advanceWorldPhaseBattle(game, g => !g.battle && worldPhaseBattleClean(g));
  assert.equal(player(game, f.owner).reserves, 5, 'Exactly one real Caladan normal counter leaves its native pool');
  assert.equal(player(game, f.owner).forces[f.location], 12);
  assert.equal(player(game, f.owner).tanks, 3);
  assert.equal(player(game, f.owner).spice, beforeSpice, 'The native reinforcement is not a second paid shipment');
  assert.equal(viewGame(game, f.owner).homeworlds?.worlds?.find(w => w.native === f.owner)?.side, 'low',
    'The actual native6→5 transfer immediately crosses the printed Caladan threshold');
  assert.equal(game.lastBattleContext!.caladanReinforcement!.completed, true);
  assert.equal(game.techTokens!.heighliners.owner, f.owner);
  assertWorldPhaseBattleInventory(game);
});

void test('own-World R: local fee counters are disjoint from dial, off-World normals pay physically, and H remains forbidden', () => {
  const f = createWorldPhaseOwnBattleFixture();
  assert.deepEqual(pool(f.game, f.owner, 'homeworld:emperor'), { normal: 5, elite: 0 });
  assert.deepEqual(pool(f.game, f.owner, 'homeworld:emperor:salusa'), { normal: 10, elite: 5 });
  assert.deepEqual(pool(f.game, f.opponent, f.location), { normal: 5, elite: 0 }, 'The original paid Guild invaders retain separate visitor custody');
  const local = structuredClone(f.planActions[0].action);
  local.dial = 3; local.support = 3;
  local.reinforcementsSources = { 'homeworld:emperor': { normal: 3, elite: 0 } };
  assert.throws(() => applyAction(f.game, f.owner, local), 'Kaitain5 cannot both pay its own three and dial three');
  const elite = structuredClone(f.planActions[0].action);
  elite.reinforcementsSources = { 'homeworld:emperor:salusa': { normal: 0, elite: 3 } };
  assert.throws(() => applyAction(f.game, f.owner, elite), 'Existing native normals must pay before any real Sardaukar');
  const forbidden = structuredClone(f.planActions[0].action); forbidden.weapon = HARASS_WITHDRAW_CARD;
  assert.throws(() => applyAction(f.game, f.owner, forbidden), 'An original H card in hand never permits own-World withdrawal');
  f.planActions[0].action.dial = 3; f.planActions[0].action.support = 3;
  const done = finishReinforcementsHomeworldBattle(revealReinforcementsHomeworldBattle(f));
  assert.equal(done.lastBattleContext!.winner, f.owner);
  assert.deepEqual(pool(done, f.owner, 'homeworld:emperor'), { normal: 2, elite: 0 });
  assert.deepEqual(pool(done, f.owner, 'homeworld:emperor:salusa'), { normal: 7, elite: 5 },
    'Exactly three original Salusa normals pay R; none of the five original Sardaukar substitutes');
  assert.equal(player(done, f.owner).reserves, 14);
  assert.equal(player(done, f.owner).tanks, 6);
  assert.equal(player(done, f.owner).elites!.tanks, 0);
  assert.equal(player(done, f.opponent).tanks, 5);
  assert.deepEqual(pool(done, f.opponent, f.location), { normal: 0, elite: 0 });
  assert.equal(done.discard.filter(c => c.id === REINFORCEMENTS_CARD).length, 1);
  assert.ok(player(done, f.owner).hand.some(c => c.id === HARASS_WITHDRAW_CARD), 'Rejected H was never used or discarded');
  assert.equal(viewGame(done, f.owner).homeworlds?.worlds?.find(w => w.id === f.location)?.side, 'low');
  assertWorldPhaseBattleInventory(done);
});

void test('foreign World R+H: original split normal fee precedes exact normal/elite deposits, never tanks or visitor reserves', () => {
  const f = createWorldPhaseVisitorBattleFixture();
  assert.deepEqual(pool(f.game, f.owner, 'homeworld:emperor'), { normal: 10, elite: 0 });
  assert.deepEqual(pool(f.game, f.owner, 'homeworld:emperor:salusa'), { normal: 2, elite: 1 });
  assert.deepEqual(pool(f.game, f.owner, f.location), { normal: 3, elite: 4 });
  const done = finishHarassHomeworldBattle(revealReinforcementsHomeworldBattle(f),
    { returns: { [f.location]: { normal: 2, elite: 3 } } });
  assert.equal(done.lastBattleContext!.winner, f.owner);
  assert.deepEqual(pool(done, f.owner, 'homeworld:emperor'), { normal: 11, elite: 0 }, 'Kaitain10 − fee1 + return2');
  assert.deepEqual(pool(done, f.owner, 'homeworld:emperor:salusa'), { normal: 0, elite: 4 }, 'Salusa2N1E − fee2N + return3E');
  assert.deepEqual(pool(done, f.owner, f.location), { normal: 0, elite: 0 });
  assert.equal(player(done, f.owner).reserves, 15);
  assert.equal(player(done, f.owner).elites!.reserves, 4);
  assert.equal(player(done, f.owner).tanks, 5, 'The fee3N and committed 1N1E die; the undialed 2N3E do not');
  assert.equal(player(done, f.owner).elites!.tanks, 1);
  assert.equal(player(done, f.opponent).reserves, 0);
  assert.equal(player(done, f.opponent).tanks, 15, 'Only the genuine native Junction army dies, not its original five board counters');
  assert.equal(player(done, f.opponent).forces['tueks_sietch:5'], 5);
  for (const id of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD]) assert.equal(done.discard.filter(c => c.id === id).length, 1);
  assert.equal(done.battle, null); assert.ok(worldPhaseBattleClean(done));
  assertWorldPhaseBattleInventory(done);
});

void test('all14 Emperor visitor chooses original typed H returns or committed-only Suk rescue after the same split normal fee', () => {
  const f = createWorldPhaseVisitorBattleFixture({ skills: true, skilled: true,
    training: { emperor: 'suk-graduate', guild: 'swordmaster-of-ginaz', atreides: 'sandmaster' } });
  assert.deepEqual(f.sources, {
    'homeworld:emperor': { normal: 1, elite: 0 }, 'homeworld:emperor:salusa': { normal: 2, elite: 0 },
  });
  assert.equal(viewGame(f.game, f.owner).battle!.strongholdEffects[f.owner], null,
    'Original unused modules never subsidize a foreign World');
  const trainer = f.planActions[0].action.leader;
  const untrained = player(f.game, f.owner).leaders.filter(l => !l.dead && !l.usedAt && l.id !== trainer)
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  assert.ok(untrained);
  f.planActions[0].action.leader = untrained.id;
  const withdrawn = finishHarassHomeworldBattle(revealReinforcementsHomeworldBattle(f),
    { returns: { [f.location]: { normal: 2, elite: 3 } } });
  assert.deepEqual(pool(withdrawn, f.owner, 'homeworld:emperor'), { normal: 11, elite: 0 });
  assert.deepEqual(pool(withdrawn, f.owner, 'homeworld:emperor:salusa'), { normal: 0, elite: 4 });
  assert.equal(player(withdrawn, f.owner).tanks, 5);
  assert.equal(player(withdrawn, f.owner).elites!.tanks, 1);
  assert.equal(withdrawn.lastBattleContext!.sukRescue, undefined,
    'A concealed native trainer used as a bluff grants neither normal nor skilled Suk rescue');
  assert.deepEqual(viewGame(f.game, f.owner).battle!.traitorVoters, [f.opponent]);
  assertWorldPhaseBattleInventory(withdrawn);

  // The real alternative keeps H in hand and lets the selected surviving disc
  // rescue only the two actually committed visitor casualties.
  f.planActions[0].action.defense = null;
  f.planActions[0].action.leader = trainer;
  let game = advanceNativeWorldBattle(revealReinforcementsHomeworldBattle(f), g => g.decision?.kind === 'sukRescue', [],
    { casualties: { normal: 1, elite: 1 } });
  assert.ok(game.decision?.kind === 'sukRescue');
  assert.deepEqual(game.pendingSukRescue!.pool, [{ key: f.location, normal: 3, elite: 4 }]);
  assert.deepEqual(game.pendingSukRescue!.losses, { normal: 1, elite: 1, paidNormal: 1, paidElite: 0 });
  assert.equal(player(game, f.owner).tanks, 3);
  assert.equal(player(game, f.owner).elites!.tanks, 0);
  assert.ok(game.decision.options.every(o => o.normal + o.elite <= 2), 'The original fee3N cannot enlarge the rescue');
  const choice = game.decision.options.findIndex(o => o.normal === 1 && o.elite === 1 && o.kept?.kind === 'normal');
  assert.ok(choice >= 0);
  const action = { type: 'decision', event: game.decision.event, choice };
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, f.owner, action), 'Two native homes need a sealed typed rescue allocation');
  assert.throws(() => applyAction(game, f.owner, { ...action,
    destinations: { [f.location]: { normal: 0, elite: 1 } } }), 'Foreign visitor custody is never a reserve return destination');
  assert.deepEqual(game, before);
  game = applyAction(game, f.owner, { ...action,
    destinations: { 'homeworld:emperor:salusa': { normal: 0, elite: 1 } } });
  game = finishReinforcementsHomeworldBattle(game);
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(game.lastBattleContext!.sukRescue!.physical!.source, 'visitor-homeworld');
  assert.deepEqual(game.lastBattleContext!.sukRescue!.physical!.destinations,
    { 'homeworld:emperor:salusa': { normal: 0, elite: 1 } });
  assert.deepEqual(pool(game, f.owner, 'homeworld:emperor'), { normal: 9, elite: 0 });
  assert.deepEqual(pool(game, f.owner, 'homeworld:emperor:salusa'), { normal: 0, elite: 2 });
  assert.deepEqual(pool(game, f.owner, f.location), { normal: 3, elite: 3 });
  assert.equal(player(game, f.owner).tanks, 3);
  assert.equal(player(game, f.owner).elites!.tanks, 0);
  assert.equal(player(game, f.owner).battleLosses, 5);
  assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice - 1,
    'Native Worlds cannot borrow Arrakeen support or refund the original paid support');
  assert.equal(game.discard.filter(c => c.id === REINFORCEMENTS_CARD).length, 1);
  assert.ok(player(game, f.owner).hand.some(c => c.id === HARASS_WITHDRAW_CARD));
  assertWorldPhaseBattleInventory(game);
});
