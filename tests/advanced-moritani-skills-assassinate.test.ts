import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  advancedNativePlayer as player,
  advancedNativeStep,
  advanceAdvancedNativeSkillsToPhase,
  assertAdvancedNativeCustody as custody,
  completedAdvancedNativeSkillsGame,
  openAdvancedNativeSkillBattle,
  rejectAdvancedNativeAction as reject,
  stageAdvancedNativeSkillBattle,
} from './fixture-advanced-native-skills';
import { assassinationPhysical } from './moritani-assassinate-fixture';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;

function assignment(game: Game, owner: string) {
  const trained = game.leaderSkills!.assignments.find(a => a.owner === owner);
  assert.ok(trained);
  return trained;
}

function untrained(game: Game, owner: string, strongest = false) {
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const candidates = game.players.find(p => p.id === owner)!.leaders
    .filter(l => !l.dead && !trained.has(l.id));
  candidates.sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength);
  assert.ok(candidates[0]);
  return candidates[0];
}

/** Only after genuine native setup: swap two existing physical identities,
 * following the original assassination fixture. Never manufacture a traitor. */
function holdPhysicalTraitor(game: Game, identity: string): void {
  const owner = player(game, 'moritani');
  const old = owner.traitors[0];
  assert.ok(old);
  if (old === identity) return;
  const holder = game.players.find(p => p.id !== owner.id && p.traitors.includes(identity));
  if (holder) holder.traitors[holder.traitors.indexOf(identity)] = old;
  else {
    const index = game.traitorReserve!.indexOf(identity);
    assert.ok(index >= 0, 'The requested physical native identity must still exist.');
    game.traitorReserve![index] = old;
  }
  owner.traitors[0] = identity;
}

/** All14 and the original assassination state come from the fresh production
 * initializer. Only board/card positions are controlled after native setup. */
function stagedGame(bankerIncome = false) {
  const native = completedAdvancedNativeSkillsGame({
    family: 'moritani', skillOwner: 'guild', requestedSkill: 'warmaster',
    opponents: ['guild', 'emperor'], bankerIncome,
  });
  assert.equal(assignment(native, player(native, 'guild').id).skill, 'warmaster');
  assert.ok(native.moritaniAssassinate);
  const game = stageAdvancedNativeSkillBattle(native,
    player(native, 'guild').id, player(native, 'moritani').id);
  game.spice['wind_pass:14'] = 0; // Isolate battle/assassination income from Collection.
  return game;
}

function stageCard(game: Game, owner: string, kind: 'worthless' | 'projectile'): string {
  const index = game.deck.findIndex(c => c.kind === kind);
  assert.ok(index >= 0, 'The conserved native deck must contain the staged card.');
  const [card] = game.deck.splice(index, 1);
  game.players.find(p => p.id === owner)!.hand.push(card);
  return card.id;
}

function resolvePlans(game: Game, normalCall = false): Game {
  game = applyAction(game, player(game, 'guild').id, { type: 'traitorCall', call: false });
  return applyAction(game, player(game, 'moritani').id, { type: 'traitorCall', call: normalCall });
}

function pendingAssassination(): { game: Game; target: string; card: string } {
  let game = stagedGame();
  const guild = player(game, 'guild').id;
  const moritani = player(game, 'moritani').id;
  const target = assignment(game, guild).leader;
  holdPhysicalTraitor(game, target);
  const card = stageCard(game, guild, 'worthless');
  const winningLeader = untrained(game, guild).id;
  const losingLeader = untrained(game, moritani).id;
  // The face-up trainer grants the different winning disc its normal +1.
  // The trainer itself remains an eligible original assassination target.
  game = openAdvancedNativeSkillBattle(game, guild, moritani, false);
  game = applyAction(game, guild, { type: 'battlePlan', leader: winningLeader, dial: 0, support: 0, weapon: card });
  game = applyAction(game, moritani, { type: 'battlePlan', leader: losingLeader, dial: 0, support: 0 });
  game = resolvePlans(game);
  assert.equal(game.lastBattleContext?.result, 'normal');
  assert.equal(game.lastBattleContext?.winner, guild);
  assert.equal(game.decision?.kind, 'moritaniAssassinate');
  return { game, target, card };
}

function choose(game: Game, card: string | null): Game {
  const decision = game.decision;
  assert.equal(decision?.kind, 'moritaniAssassinate');
  if (decision?.kind !== 'moritaniAssassinate') throw new Error('Expected original assassination choice.');
  return applyAction(game, decision.player, {
    type: 'decision', event: decision.event,
    ...(card === null ? { decline: true } : { card }),
  });
}

function finishCards(game: Game, discard: string[] = []): Game {
  for (let i = 0; (game.decision || game.response || game.pendingTreacheryDiscard || game.battle) && i < 100; i++) {
    if (game.decision?.kind === 'battleCards') {
      game = applyAction(game, game.decision.player, { type: 'decision', discard });
    } else game = advancedNativeStep(game);
  }
  assert.equal(game.battle, null);
  assert.equal(game.decision, null);
  return game;
}

void test('Advanced all14 assassination kills only the held native trainer, returns its skill once and resumes real winner-card cleanup before one private Mentat replacement', () => {
  const { game: pending, target, card } = pendingAssassination();
  const moritani = player(pending, 'moritani');
  const guild = player(pending, 'guild');
  const killed = guild.leaders.find(l => l.id === target)!;
  const ownTrainer = structuredClone(assignment(pending, moritani.id));
  const survivingAssignments = pending.leaderSkills!.assignments.filter(a => a.leader !== target);
  const inventory = assassinationPhysical(pending);
  const traitors = [...moritani.traitors];
  const reserve = [...pending.traitorReserve!];
  const event = pending.moritaniAssassinate!.opportunities.at(-1)!.event;
  const action: Action = { type: 'decision', event, card: target };
  assert.equal(pending.phase, 6);
  assert.ok(pending.moritaniAssassinateResume!.continuation.cards.includes(card));
  assert.equal(guild.leaders.find(l => l.id === pending.moritaniAssassinate!.opportunities.at(-1)!.opposingLeader)!.dead, false);
  assert.equal(viewGame(pending, moritani.id).moritaniAssassinate!.pending!.cards.find(c => c.card === target)!.bounty, killed.strength);
  assert.deepEqual(viewGame(pending, guild.id).moritaniAssassinate!.pending!.cards, []);
  reject(pending, guild.id, action);
  reject(pending, moritani.id, { ...action, event: 'stale' });

  let game = applyAction(reload(pending), moritani.id, action);
  const receipt = game.moritaniAssassinate!.opportunities.at(-1)!;
  const dead = player(game, 'guild').leaders.find(l => l.id === target)!;
  assert.equal(dead.dead, true);
  assert.equal(dead.deaths, killed.deaths + 1);
  assert.equal(dead.strength, killed.strength);
  assert.equal(receipt.bounty, killed.strength);
  assert.equal(receipt.stage, 'revealed');
  assert.equal(receipt.replacement, null);
  assert.equal(player(game, 'moritani').spice, moritani.spice + killed.strength);
  assert.equal(player(game, 'guild').spice, guild.spice);
  assert.deepEqual(game.leaderSkills!.assignments, survivingAssignments);
  assert.deepEqual(assignment(game, moritani.id), ownTrainer);
  assert.equal(game.leaderSkills!.deck.filter(s => s === 'warmaster').length, 1);
  assert.deepEqual(player(game, 'guild').leaders.filter(l => l.id !== target), guild.leaders.filter(l => l.id !== target));
  assert.deepEqual(player(game, 'moritani').traitors, traitors);
  assert.deepEqual(game.traitorReserve, reserve);
  assert.equal(game.moritaniAssassinateResume, undefined);
  assert.equal(game.decision?.kind, 'battleCards');
  assert.equal(game.decision?.player, guild.id);
  assert.equal(player(game, 'guild').hand.some(c => c.id === card), true);
  custody(game);
  reject(game, moritani.id, action);

  // Exercise the saved ORIGINAL winner cleanup rather than erasing the decision.
  game = finishCards(reload(game), [card]);
  assert.equal(player(game, 'guild').hand.some(c => c.id === card), false);
  assert.equal(game.discard.filter(c => c.id === card).length, 1);
  assert.deepEqual(assassinationPhysical(game), inventory);
  const replacement = game.traitorReserve![0];
  assert.ok(replacement && replacement !== target);
  game = advanceAdvancedNativeSkillsToPhase(reload(game), 8);
  const settled = game.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(settled.stage, 'replaced');
  assert.equal(settled.replacement, replacement);
  assert.deepEqual(game.traitorReserve, reserve.slice(1));
  assert.deepEqual(player(game, 'moritani').traitors, [...traitors.filter(c => c !== target), replacement]);
  assert.equal(game.players.flatMap(p => p.traitors).includes(target), false);
  assert.equal(game.traitorReserve!.includes(target), false);
  assert.equal(game.leaderSkills!.deck.filter(s => s === 'warmaster').length, 1);
  assert.deepEqual(assignment(game, moritani.id), ownTrainer);
  assert.equal(player(game, 'moritani').spice, moritani.spice + killed.strength);
  assert.deepEqual(assassinationPhysical(game), inventory);
  const rival = viewGame(reload(game), guild.id);
  assert.equal(rival.moritaniAssassinate!.history.at(-1)!.card, target);
  assert.equal(rival.moritaniAssassinate!.history.at(-1)!.stage, 'replaced');
  assert.equal('replacement' in rival.moritaniAssassinate!.history.at(-1)!, false);
  assert.equal('traitors' in rival.players.find(p => p.id === moritani.id)!, false);
  custody(game);
  reject(game, moritani.id, action);

  const turn = game.turn;
  for (let i = 0; game.turn === turn && i < 1000; i++) game = advancedNativeStep(game);
  assert.equal(game.turn, turn + 1);
  while (game.phase === 0 && game.status === 'playing') game = advancedNativeStep(game);
  // The original per-faction assassination does not expire on a new turn.
  game = stageAdvancedNativeSkillBattle(reload(game), guild.id, moritani.id);
  game.spice['wind_pass:14'] = 0;
  const winner = untrained(game, guild.id, true).id;
  const loser = untrained(game, moritani.id).id;
  game = openAdvancedNativeSkillBattle(game, guild.id, moritani.id);
  game = applyAction(game, guild.id, { type: 'battlePlan', leader: winner, dial: 0, support: 0 });
  game = applyAction(game, moritani.id, { type: 'battlePlan', leader: loser, dial: 0, support: 0 });
  game = resolvePlans(game);
  assert.equal(game.lastBattleContext?.result, 'normal');
  assert.equal(game.lastBattleContext?.winner, guild.id);
  assert.equal(game.moritaniAssassinate!.opportunities.length, 1);
  assert.equal(game.moritaniAssassinate!.opportunities[0].stage, 'replaced');
  assert.notEqual(game.decision?.kind, 'moritaniAssassinate');
  assert.equal(game.leaderSkills!.deck.filter(s => s === 'warmaster').length, 1);
  assert.deepEqual(assignment(game, moritani.id), ownTrainer);
  custody(finishCards(game));
});

void test('declining the original loss opportunity preserves the real trainer, skill, wallet and traitor through Mentat', () => {
  const { game: pending, target } = pendingAssassination();
  const skills = structuredClone(pending.leaderSkills);
  const moritani = player(pending, 'moritani');
  const trained = structuredClone(player(pending, 'guild').leaders.find(l => l.id === target)!);
  const held = [...moritani.traitors];
  const reserve = [...pending.traitorReserve!];
  let game = finishCards(choose(reload(pending), null));
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
  game = advanceAdvancedNativeSkillsToPhase(game, 8);
  assert.deepEqual(game.leaderSkills, skills);
  assert.deepEqual(player(game, 'guild').leaders.find(l => l.id === target), trained);
  assert.equal(player(game, 'moritani').spice, moritani.spice);
  assert.deepEqual(player(game, 'moritani').traitors, held);
  assert.deepEqual(game.traitorReserve, reserve);
  assert.deepEqual(viewGame(game, moritani.id).moritaniAssassinate!.history, []);
  custody(game);
});

void test('the surviving lower Warmaster wins a real loss, but the original source excludes that winning trained disc from assassination', () => {
  let game = stagedGame();
  const guild = player(game, 'guild').id;
  const moritani = player(game, 'moritani').id;
  const trainer = assignment(game, guild).leader;
  const trained = structuredClone(player(game, 'guild').leaders.find(l => l.id === trainer)!);
  holdPhysicalTraitor(game, trainer);
  const worthless = stageCard(game, guild, 'worthless');
  const loser = untrained(game, moritani, true);
  // Guild's printed 5 loses to 4+3; only the surviving lower +3 makes it win.
  assert.equal(trained.strength, 5);
  assert.equal(loser.strength, 4);
  const funds = player(game, 'moritani').spice;
  game = openAdvancedNativeSkillBattle(game, guild, moritani);
  game = applyAction(game, guild, { type: 'battlePlan', leader: trainer, dial: 0, support: 0, weapon: worthless });
  game = applyAction(game, moritani, { type: 'battlePlan', leader: loser.id, dial: 3, support: 3 });
  game = resolvePlans(game);
  assert.equal(game.lastBattleContext?.winner, guild);
  assert.equal(game.decision?.kind, 'moritaniAssassinate');
  const own = viewGame(reload(game), moritani).moritaniAssassinate!.pending!;
  assert.deepEqual(own.cards, []);
  reject(game, moritani, { type: 'decision', event: own.event, card: trainer });
  game = finishCards(choose(game, null));
  assert.equal(player(game, 'guild').leaders.find(l => l.id === trainer)!.dead, false);
  assert.equal(assignment(game, guild).skill, 'warmaster');
  assert.equal(game.leaderSkills!.deck.includes('warmaster'), false);
  assert.equal(player(game, 'moritani').spice, funds - 3);
  custody(game);
});

void test('weapon death removes the lower Warmaster bonus before scoring and prevents a spurious Moritani loss', () => {
  let game = stagedGame();
  const guild = player(game, 'guild').id;
  const moritani = player(game, 'moritani').id;
  const trainer = assignment(game, guild).leader;
  const printed = player(game, 'guild').leaders.find(l => l.id === trainer)!.strength;
  const ownTrainer = structuredClone(assignment(game, moritani));
  holdPhysicalTraitor(game, untrained(game, guild).id);
  const worthless = stageCard(game, guild, 'worthless');
  const weapon = stageCard(game, moritani, 'projectile');
  const attacker = untrained(game, moritani).id;
  const funds = player(game, 'moritani').spice;
  game = openAdvancedNativeSkillBattle(game, guild, moritani);
  game = applyAction(game, guild, { type: 'battlePlan', leader: trainer, dial: 0, support: 0, weapon: worthless });
  game = applyAction(game, moritani, { type: 'battlePlan', leader: attacker, dial: 0, support: 0, weapon });
  game = resolvePlans(game);
  // A dead skilled disc contributes neither printed 5 nor lower +3. If lower
  // strength were applied before survival, Guild would incorrectly win this.
  assert.equal(game.lastBattleContext?.result, 'normal');
  assert.equal(game.lastBattleContext?.winner, moritani);
  assert.equal(player(game, 'guild').leaders.find(l => l.id === trainer)!.dead, true);
  assert.equal(player(game, 'guild').leaders.find(l => l.id === trainer)!.deaths, 1);
  assert.equal(game.leaderSkills!.assignments.some(a => a.leader === trainer), false);
  assert.equal(game.leaderSkills!.deck.filter(s => s === 'warmaster').length, 1);
  assert.deepEqual(assignment(game, moritani), ownTrainer);
  assert.equal(player(game, 'moritani').spice, funds + printed);
  assert.deepEqual(game.moritaniAssassinate!.opportunities, []);
  assert.notEqual(game.decision?.kind, 'moritaniAssassinate');
  game = finishCards(reload(game), [weapon]);
  assert.equal(game.discard.filter(c => c.id === worthless).length, 1);
  assert.equal(game.discard.filter(c => c.id === weapon).length, 1);
  custody(game);
});

void test('an actual normal Moritani loss cannot assassinate when the winning trained disc was killed by the real weapon', () => {
  let game = stagedGame();
  const guild = player(game, 'guild').id;
  const moritani = player(game, 'moritani').id;
  const trainer = assignment(game, guild).leader;
  holdPhysicalTraitor(game, untrained(game, guild).id);
  const held = [...player(game, 'moritani').traitors];
  const funds = player(game, 'moritani').spice;
  const ownTrainer = structuredClone(assignment(game, moritani));
  const worthless = stageCard(game, guild, 'worthless');
  const weapon = stageCard(game, moritani, 'projectile');
  const attackingLeader = untrained(game, moritani).id;
  game = openAdvancedNativeSkillBattle(game, guild, moritani);
  game = applyAction(game, guild, { type: 'battlePlan', leader: trainer, dial: 4, support: 4, weapon: worthless });
  game = applyAction(game, moritani, { type: 'battlePlan', leader: attackingLeader, dial: 0, support: 0, weapon });
  game = resolvePlans(game);
  assert.equal(game.lastBattleContext?.result, 'normal');
  assert.equal(game.lastBattleContext?.winner, guild);
  assert.equal(player(game, 'guild').leaders.find(l => l.id === trainer)!.dead, true);
  assert.equal(player(game, 'guild').leaders.find(l => l.id === trainer)!.deaths, 1);
  assert.equal(game.leaderSkills!.assignments.some(a => a.leader === trainer), false);
  assert.equal(game.leaderSkills!.deck.filter(s => s === 'warmaster').length, 1);
  assert.deepEqual(assignment(game, moritani), ownTrainer);
  assert.deepEqual(game.moritaniAssassinate!.opportunities, []);
  assert.notEqual(game.decision?.kind, 'moritaniAssassinate');
  assert.deepEqual(player(game, 'moritani').traitors, held);
  assert.equal(player(game, 'moritani').spice, funds);
  game = finishCards(game, [worthless]);
  assert.equal(player(game, 'guild').tanks, 4);
  assert.equal(player(game, 'guild').forces['wind_pass:14'], 4);
  assert.equal(player(game, 'moritani').tanks, 8);
  assert.equal(game.discard.filter(c => c.id === weapon).length, 1);
  assert.equal(game.discard.filter(c => c.id === worthless).length, 1);
  custody(game);
});

void test('the fresh private Banker wrapper retains normal-traitor ENTIRE-GAME forfeiture through a later native turn loss', () => {
  let game = stagedGame(true);
  const guild = player(game, 'guild').id;
  const moritani = player(game, 'moritani').id;
  const trainer = assignment(game, guild).leader;
  const ownTrainer = structuredClone(assignment(game, moritani));
  holdPhysicalTraitor(game, trainer);
  const funds = player(game, 'moritani').spice;
  const printed = player(game, 'guild').leaders.find(l => l.id === trainer)!.strength;
  const held = [...player(game, 'moritani').traitors];
  const reserve = [...game.traitorReserve!];
  game = openAdvancedNativeSkillBattle(game, guild, moritani);
  game = applyAction(game, guild, { type: 'battlePlan', leader: trainer, dial: 0, support: 0 });
  game = applyAction(game, moritani, { type: 'battlePlan', leader: untrained(game, moritani).id, dial: 0, support: 0 });
  game = finishCards(resolvePlans(game, true));
  assert.equal(game.lastBattleContext?.result, 'traitor');
  assert.equal(game.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(game.moritaniAssassinateCallEvents!.length, 1);
  assert.equal(player(game, 'guild').leaders.find(l => l.id === trainer)!.dead, true);
  assert.equal(game.leaderSkills!.deck.filter(s => s === 'warmaster').length, 1);
  assert.deepEqual(assignment(game, moritani), ownTrainer);
  assert.equal(player(game, 'moritani').spice, funds + printed);
  assert.deepEqual(player(game, 'moritani').traitors, held);
  assert.deepEqual(game.traitorReserve, reserve);
  const turn = game.turn;
  for (let i = 0; game.turn === turn && i < 1000; i++) game = advancedNativeStep(game);
  assert.equal(game.turn, turn + 1);
  while (game.phase === 0 && game.status === 'playing') game = advancedNativeStep(game);
  assert.deepEqual(player(game, 'moritani').traitors, held);
  assert.deepEqual(game.traitorReserve, reserve);
  const emperor = player(game, 'emperor').id;
  // Explicit second conserved battle position, after an actual native turn
  // boundary. Never simulate expiry by assigning turn or resetting the guard.
  game = stageAdvancedNativeSkillBattle(reload(game), emperor, moritani);
  game.spice['wind_pass:14'] = 0;
  const winner = untrained(game, emperor, true).id;
  const loser = untrained(game, moritani).id;
  game = openAdvancedNativeSkillBattle(game, emperor, moritani);
  game = applyAction(game, emperor, { type: 'battlePlan', leader: winner, dial: 0, support: 0 });
  game = applyAction(game, moritani, { type: 'battlePlan', leader: loser, dial: 0, support: 0 });
  game = applyAction(game, emperor, { type: 'traitorCall', call: false });
  game = applyAction(game, moritani, { type: 'traitorCall', call: false });
  assert.equal(game.lastBattleContext?.result, 'normal');
  assert.equal(game.lastBattleContext?.winner, emperor);
  assert.equal(game.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(game.moritaniAssassinateCallEvents!.length, 1);
  assert.deepEqual(game.moritaniAssassinate!.opportunities, []);
  assert.notEqual(game.decision?.kind, 'moritaniAssassinate');
  custody(finishCards(game));
});

void test('every original policy can finish the current JSON assassination choice with real death, skill return and retained physical card', () => {
  const { game: pending, target } = pendingAssassination();
  const owner = player(pending, 'moritani');
  const strength = player(pending, 'guild').leaders.find(l => l.id === target)!.strength;
  for (const difficulty of DIFFICULTIES) {
    const current = reload(pending);
    const view = viewGame(current, owner.id);
    view.players.find(p => p.id === owner.id)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.ok(action, difficulty);
    const game = applyAction(current, owner.id, action);
    assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'revealed', difficulty);
    assert.equal(player(game, 'guild').leaders.find(l => l.id === target)!.dead, true);
    assert.equal(player(game, 'moritani').spice, owner.spice + strength);
    assert.equal(game.leaderSkills!.assignments.some(a => a.leader === target), false);
    assert.equal(game.leaderSkills!.deck.filter(s => s === 'warmaster').length, 1);
    assert.deepEqual(player(game, 'moritani').traitors, owner.traitors);
    assert.equal(game.decision?.kind, 'battleCards');
    custody(finishCards(game));
  }
});

void test('the winner finishes original Suk rescue and Rihani choice before Moritani can assassinate, without replaying casualties', () => {
  for (const skill of ['suk-graduate', 'rihani-decipherer'] as const) {
    const native = completedAdvancedNativeSkillsGame({
      family: 'moritani', skillOwner: 'emperor', requestedSkill: skill,
    });
    const winner = player(native, 'emperor').id, loser = player(native, 'moritani').id;
    let game = stageAdvancedNativeSkillBattle(native, winner, loser);
    game.spice['wind_pass:14'] = 0;
    const leader = assignment(game, winner).leader;
    const enemy = untrained(game, loser).id;
    const support = skill === 'suk-graduate' ? 5 : 1;
    const balance = player(game, 'emperor').spice;
    game = openAdvancedNativeSkillBattle(game, winner, loser);
    game = applyAction(game, winner, { type: 'battlePlan', leader, dial: support, support });
    game = applyAction(game, loser, { type: 'battlePlan', leader: enemy, dial: 0, support: 0 });
    game = applyAction(game, winner, { type: 'traitorCall', call: false });
    game = applyAction(game, loser, { type: 'traitorCall', call: false });
    assert.equal(game.lastBattleContext!.winner, winner);
    assert.equal(viewGame(game, loser).moritaniAssassinate!.pending, null);
    if (skill === 'suk-graduate') {
      assert.equal(game.decision?.kind, 'sukRescue');
      if (game.decision?.kind !== 'sukRescue') throw new Error('Original winner rescue must remain actionable.');
      const choice = game.decision.options.findIndex(o => o.normal === 3 && o.elite === 0 && o.kept?.key === 'wind_pass:14');
      assert.ok(choice >= 0);
      game = applyAction(reload(game), winner, { type: 'decision', event: game.decision.event, choice });
      assert.equal(player(game, 'emperor').forces['wind_pass:14'], 4);
      assert.equal(player(game, 'emperor').tanks, 2);
    } else {
      assert.equal(game.decision?.kind, 'rihani');
      if (game.decision?.kind !== 'rihani') throw new Error('Original winner Rihani choice must remain actionable.');
      const held = [...player(game, 'emperor').traitors];
      game = applyAction(reload(game), winner, { type: 'decision', event: game.decision.event, draw: false });
      assert.deepEqual(player(game, 'emperor').traitors, held);
      assert.equal(player(game, 'emperor').forces['wind_pass:14'], 7);
      assert.equal(player(game, 'emperor').tanks, 1);
    }
    assert.equal(game.decision?.kind, 'moritaniAssassinate');
    const forces = structuredClone(player(game, 'emperor').forces);
    const tanks = player(game, 'emperor').tanks;
    const reserves = player(game, 'emperor').reserves;
    game = finishCards(choose(reload(game), null));
    assert.deepEqual(player(game, 'emperor').forces, forces);
    assert.equal(player(game, 'emperor').tanks, tanks);
    assert.equal(player(game, 'emperor').reserves, reserves);
    assert.equal(player(game, 'emperor').spice, balance - support);
    custody(game);
  }
});
