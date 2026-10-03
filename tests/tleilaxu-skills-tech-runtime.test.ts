import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { validateLeaderSkills } from '../game/leader-skills';
import { quoteSukRescue } from '../game/suk-graduate';
import { ownedTech } from '../game/tech-tokens';
import { quoteSpiceBankerIncomeBattleEconomics } from './fixture-spice-banker-income';
import {
  createTleilaxuSkillsTechFixture, createTleilaxuSkillsTechRevivalFixture,
  advanceTleilaxuSkillsTechToPhase, settleTleilaxuSkillsTechRevival,
  tleilaxuSkillsTechPlayer as player, tleilaxuSkillsTechForces as at,
  type TleilaxuSkillsTechFixture,
} from './fixture-tleilaxu-skills-tech';

function custody(game: Game) {
  validateLeaderSkills(game.leaderSkills!, game.players);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0),
        p.faction === 'ixians' ? 7 : 5);
      for (const [key, count] of Object.entries(p.elites.forces)) assert.ok(count <= (p.forces[key] ?? 0));
    }
  }
}
function retainedReward(f: TleilaxuSkillsTechFixture, after: Game) {
  const before = player(f.faceDance, f.winner), winner = player(after, f.winner);
  assert.equal(after.lastBattleContext!.winner, f.winner);
  assert.equal(after.lastBattleContext!.event, f.faceDance.lastBattleContext!.event);
  assert.equal(after.lastBattleContext!.result, f.faceDance.lastBattleContext!.result);
  assert.deepEqual(after.techTokens, f.faceDance.techTokens, 'Replacement is not another win, token claim or Axlotl restoration.');
  assert.equal(after.techTokens!.axlotl.owner, f.winner);
  assert.deepEqual(winner.hand, before.hand, 'The original winner keeps its completed physical card outcome.');
  assert.equal(winner.spice, before.spice, 'Face Dance adds no bounty and claws back no earned spice.');
  assert.equal(winner.tanks, before.tanks, 'Replacement returns survivors rather than killing a second army.');
  assert.equal(winner.reserves, before.reserves + at(f.faceDance, f.winner, f.territory));
  assert.equal(at(after, f.winner, f.territory), 0);
  const leader = winner.leaders.find(l => l.id === f.winnerLeader)!;
  const original = before.leaders.find(l => l.id === f.winnerLeader)!;
  assert.equal(leader.dead, true);
  assert.equal(leader.deaths, original.deaths + (original.dead ? 0 : 1));
  assert.ok(!after.leaderSkills!.assignments.some(a => a.leader === f.winnerLeader));
  assert.equal(after.leaderSkills!.deck.filter(skill => skill === f.skill).length, 1, 'Native trainer death returns the physical skill once.');
  assert.equal(player(after, f.tleilaxu).faceDancers!.find(c => c.leader === f.winnerLeader)!.revealed, true);
  custody(after);
}

void test('native Guild/Ix winner earns actual losing Tleilaxu Axlotl after skill and card cleanup, before optional Face Dance', () => {
  for (const advanced of [false, true]) for (const winner of ['guild', 'ixians'] as const) {
    const f = createTleilaxuSkillsTechFixture({ advanced, winner });
    const quote = quoteSpiceBankerIncomeBattleEconomics(f.revealed, f.faceDance).resolution;
    assert.equal(quote.winner, f.winner);
    assert.deepEqual(quote.bounty, { player: f.winner, amount: player(f.revealed, f.tleilaxu).leaders.find(l => l.id === f.loserLeader)!.strength });
    assert.equal(f.beforePlans.techTokens!.axlotl.owner, f.tleilaxu);
    assert.equal(f.winnerCards.techTokens!.axlotl.owner, f.tleilaxu, 'Reward is still owed while the actual winner chooses cards.');
    assert.equal(f.skillChoice!.decision!.kind, 'sukRescue');
    assert.equal(f.skillChoice!.techTokens!.axlotl.owner, f.tleilaxu);
    assert.equal(f.winnerCards.lastBattleContext!.sukRescue!.completed, true);
    const ownPayment = quote.payments.find(p => p.player === f.winner)?.ownPayment ?? 0;
    assert.equal(player(f.faceDance, f.winner).spice, player(f.revealed, f.winner).spice - ownPayment + quote.bounty!.amount);
    assert.ok(player(f.faceDance, f.winner).hand.some(c => c.id === f.weapon));
    assert.ok(!player(f.faceDance, f.winner).hand.some(c => c.id === f.defense));
    assert.ok(f.faceDance.discard.some(c => c.id === f.defense));
    assert.ok(f.faceDance.discard.some(c => c.id === f.loserCard));
    assert.equal(player(f.faceDance, f.tleilaxu).leaders.find(l => l.id === f.loserLeader)!.dead, true);
    assert.equal(player(f.faceDance, f.tleilaxu).tanks, player(f.revealed, f.tleilaxu).tanks + 8);
    assert.equal(f.faceDance.decision!.kind, 'faceDance');
    assert.equal(f.faceDance.decision!.player, f.tleilaxu);
    assert.equal(f.faceDance.techTokens!.axlotl.owner, f.winner);
    const pending = f.skillChoice!.pendingSukRescue!, decision = f.skillChoice!.decision!;
    assert.equal(decision.kind, 'sukRescue');
    if (decision.kind !== 'sukRescue') throw new Error('Missing original Suk choice.');
    const selected = decision.options.reduce((best, option) => option.normal + option.elite > best.normal + best.elite ? option : best);
    const rescued = quoteSukRescue(pending.skill, pending.pool, pending.losses!, selected, !!pending.eliteOrigins);
    assert.equal(player(f.faceDance, f.winner).tanks, player(f.revealed, f.winner).tanks + rescued.tanks.normal + rescued.tanks.elite);
    assert.equal(at(f.faceDance, f.winner, f.territory), 8 - rescued.removed.reduce((sum, group) => sum + group.normal + group.elite, 0));
    retainedReward(f, applyAction(f.faceDance, f.tleilaxu, f.faceDanceAction));
  }
});

void test('original replacement controls permit zero, partial, board-only and mixed real-source forces without another reward', () => {
  const f = createTleilaxuSkillsTechFixture();
  const maximum = at(f.faceDance, f.winner, f.territory);
  const choices: Record<string, number>[] = [{}, { reserves: 1 }, { [f.boardSource]: 2 }, { reserves: maximum - 2, [f.boardSource]: 2 }];
  for (const sources of choices) {
    const after = applyAction(f.faceDance, f.tleilaxu, { type: 'decision', reveal: true, sources, sector: f.sector });
    retainedReward(f, after);
    const total = Object.values(sources).reduce((sum, count) => sum + count, 0);
    assert.equal(at(after, f.tleilaxu, f.territory), total);
    assert.equal(player(after, f.tleilaxu).reserves, player(f.faceDance, f.tleilaxu).reserves - (sources.reserves ?? 0));
    assert.equal(player(after, f.tleilaxu).forces[f.boardSource] ?? 0, 3 - (sources[f.boardSource] ?? 0));
  }
});

void test('Face Dance cap and physical source boundaries reject without consuming the matching card or genuine award', () => {
  const f = createTleilaxuSkillsTechFixture(), before = structuredClone(f.faceDance);
  const maximum = at(f.faceDance, f.winner, f.territory);
  for (const sources of [{ reserves: maximum + 1 }, { [f.boardSource]: 4 }, { reserves: -1 }, { reserves: 0.5 }]) {
    assert.throws(() => applyAction(f.faceDance, f.tleilaxu, { type: 'decision', reveal: true, sources, sector: f.sector }));
    assert.deepEqual(f.faceDance, before);
  }
  assert.throws(() => applyAction(f.faceDance, f.winner, f.faceDanceAction));
  assert.deepEqual(f.faceDance, before);
});

void test('declining replacement retains real Tech, native trainer and original completed card outcome', () => {
  const f = createTleilaxuSkillsTechFixture();
  const after = applyAction(f.faceDance, f.tleilaxu, { type: 'decision', reveal: false });
  assert.deepEqual(after.techTokens, f.faceDance.techTokens);
  assert.equal(after.lastBattleContext!.winner, f.winner);
  assert.equal(at(after, f.winner, f.territory), at(f.faceDance, f.winner, f.territory));
  assert.equal(player(after, f.winner).leaders.find(l => l.id === f.winnerLeader)!.dead, false);
  assert.ok(after.leaderSkills!.assignments.some(a => a.leader === f.winnerLeader && a.skill === f.skill));
  assert.equal(player(after, f.tleilaxu).faceDancers!.find(c => c.leader === f.winnerLeader)!.revealed, false);
  assert.deepEqual(player(after, f.winner).hand, player(f.faceDance, f.winner).hand);
  custody(after);
});

void test('already-killed native trainer returns its skill in the original battle; matching Face Dance gives no second death or bounty', () => {
  const f = createTleilaxuSkillsTechFixture({ winnerDies: true });
  const quote = quoteSpiceBankerIncomeBattleEconomics(f.revealed, f.faceDance).resolution;
  assert.equal(quote.winner, f.winner);
  assert.equal(f.skillChoice, null, 'A dead selected Suk trainer has no rescue entitlement.');
  const before = player(f.faceDance, f.winner).leaders.find(l => l.id === f.winnerLeader)!;
  assert.equal(before.dead, true); assert.equal(before.deaths, 1);
  assert.ok(!f.faceDance.leaderSkills!.assignments.some(a => a.leader === f.winnerLeader));
  assert.equal(f.faceDance.leaderSkills!.deck.filter(skill => skill === f.skill).length, 1);
  retainedReward(f, applyAction(f.faceDance, f.tleilaxu, f.faceDanceAction));
});

void test('native winner Rihani completes before card cleanup and Tech; replacement kills its trainer without rewriting exchange history', () => {
  const f = createTleilaxuSkillsTechFixture({ skill: 'rihani-decipherer' });
  assert.equal(f.skillChoice!.decision!.kind, 'rihani');
  assert.equal(f.skillChoice!.techTokens!.axlotl.owner, f.tleilaxu);
  assert.equal(f.winnerCards.lastBattleContext!.rihani!.completed, true);
  assert.equal(f.faceDance.lastBattleContext!.rihani!.faceDanceStarted, true);
  const after = applyAction(f.faceDance, f.tleilaxu, f.faceDanceAction);
  retainedReward(f, after);
  assert.deepEqual(after.rihaniHistory, f.faceDance.rihaniHistory);
});

void test('four original native policies replace the actual winner using legal sources after Axlotl was awarded', () => {
  const f = createTleilaxuSkillsTechFixture();
  for (const level of DIFFICULTIES) {
    const view = viewGame(f.faceDance, f.tleilaxu);
    view.players.find(p => p.id === f.tleilaxu)!.bot = level;
    const action = botActions(view).find(a => a.type === 'decision');
    assert.ok(action); assert.equal(action.reveal, true);
    const count = Object.values(action.sources as Record<string, number>).reduce((sum, n) => sum + n, 0);
    assert.equal(count, at(f.faceDance, f.winner, f.territory));
    const after = applyAction(f.faceDance, f.tleilaxu, action);
    retainedReward(f, after);
    assert.equal(at(after, f.tleilaxu, f.territory), count);
  }
});

void test('only-Tleilaxu real free revival excludes Axlotl; another faction real free revival accrues and pays exactly its owned-token count', () => {
  for (const anotherFaction of [false, true]) {
    const f = createTleilaxuSkillsTechRevivalFixture();
    let game = settleTleilaxuSkillsTechRevival(applyAction(f.game, f.tleilaxu, f.ownFreeAction));
    assert.equal(player(game, f.tleilaxu).tanks, 0);
    assert.equal(player(game, f.tleilaxu).freeForcesRevived, 1);
    assert.deepEqual(game.techTokens, f.game.techTokens, 'The native Tleilaxu-only free revival is not an Axlotl trigger.');
    if (anotherFaction) {
      game = settleTleilaxuSkillsTechRevival(applyAction(game, f.other, f.otherFreeAction));
      assert.equal(player(game, f.other).tanks, 0);
      assert.equal(player(game, f.other).freeForcesRevived, 1);
      assert.equal(game.techTokens!.axlotl.triggeredTurn, game.turn);
      assert.equal(game.techTokens!.axlotl.spice, ownedTech(game.techTokens, f.tleilaxu).length);
    }
    const before = player(game, f.tleilaxu).spice;
    const paid = advanceTleilaxuSkillsTechToPhase(game, 5);
    assert.equal(player(paid, f.tleilaxu).spice - before, anotherFaction ? ownedTech(game.techTokens, f.tleilaxu).length : 0);
    assert.equal(paid.techTokens!.axlotl.spice, 0);
    custody(paid);
  }
});

void test('real native foreign Ghola revival grants no new Tleilaxu skill and preserves its living native trainer', () => {
  const f = createTleilaxuSkillsTechRevivalFixture();
  const assignments = structuredClone(f.game.leaderSkills!.assignments);
  const after = settleTleilaxuSkillsTechRevival(applyAction(f.game, f.tleilaxu, f.foreignGholaAction));
  const foreign = after.players.flatMap(p => p.leaders).find(l => l.id === f.foreignLeader)!;
  assert.equal(foreign.dead, false); assert.equal(foreign.gholaBy, f.tleilaxu);
  assert.deepEqual(after.leaderSkills!.assignments, assignments);
  assert.equal(after.leaderSkills!.offers[f.tleilaxu], undefined);
  assert.equal(player(after, f.tleilaxu).leaders.find(l => l.id === f.nativeTrainer)!.dead, false);
  assert.ok(!after.leaderSkills!.assignments.some(a => a.leader === f.foreignLeader));
  assert.deepEqual(after.techTokens, f.game.techTokens, 'Foreign leader revival is not force free-revival Tech income.');
  custody(after);
});

void test('authenticated undealt lobby continuation retains exact original IDs/order without mutating or replacing seats', () => {
  const original = createTleilaxuSkillsTechFixture().initial;
  const before = structuredClone(original);
  const f = createTleilaxuSkillsTechFixture({ initial: original });
  assert.deepEqual(original, before);
  assert.deepEqual(f.initial, before);
  assert.deepEqual(f.afterSetup.players.map(p => ({ id: p.id, faction: p.faction })),
    original.players.map(p => ({ id: p.id, faction: p.faction })));
  assert.equal(f.winner, original.players.find(p => p.faction === 'guild')!.id);
  assert.equal(f.tleilaxu, original.players.find(p => p.faction === 'tleilaxu')!.id);
  assert.equal(f.faceDance.decision!.player, f.tleilaxu);
  retainedReward(f, applyAction(f.faceDance, f.tleilaxu, f.faceDanceAction));
});
