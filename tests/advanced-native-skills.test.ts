import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  advancedNativePlayer as player, advancedNativeStep, advanceAdvancedNativeSkillsToPhase,
  assertAdvancedNativeCustody as custody, completeAdvancedNativeSkillsSetup,
  completedAdvancedNativeSkillsGame, createAdvancedNativeSkillBattle,
  finishAdvancedNativeSkillAftermath, initializeAdvancedNativeSkillsSetup,
  openAdvancedNativeSkillBattle, rejectAdvancedNativeAction as reject,
} from './fixture-advanced-native-skills';

function trainer(game: Game, actor: string): string {
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === actor);
  assert.ok(assignment);
  return assignment.leader;
}
function untrainedLeader(game: Game, actor: string): string {
  const p = game.players.find(p => p.id === actor)!;
  const leaders = p.leaders.filter(l => !l.dead && l.id !== trainer(game, actor) && l.id !== 'choam-auditor');
  leaders.sort((a, b) => a.strength - b.strength);
  assert.ok(leaders[0]);
  return leaders[0].id;
}
function resolvePlans(game: Game, actor: string, target: string): Game {
  game = applyAction(game, actor, { type: 'traitorCall', call: false });
  return applyAction(game, target, { type: 'traitorCall', call: false });
}

void test('Advanced native Ix typed support preserves paid cyborg casualties through skilled Suk and native substitution', () => {
  let game = createAdvancedNativeSkillBattle({ family: 'ixians', requestedSkill: 'suk-graduate' });
  const actor = player(game, 'ixians').id;
  const target = player(game, 'emperor').id;
  const funds = player(game, 'ixians').spice;
  game = openAdvancedNativeSkillBattle(game, actor, target);
  reject(game, actor, { type: 'battlePlan', dial: 5, support: 3, leader: trainer(game, actor) });
  game = applyAction(game, actor, { type: 'battlePlan', dial: 5, support: 1, leader: trainer(game, actor) });
  game = applyAction(game, target, { type: 'battlePlan', dial: 0, support: 0, leader: untrainedLeader(game, target) });
  game = resolvePlans(game, actor, target);
  if (game.decision?.kind === 'battleLosses') {
    const choice = game.decision.options.findIndex(o => o.normal === 4 && o.elite === 2);
    assert.ok(choice >= 0);
    game = applyAction(game, actor, { type: 'decision', choice });
  }
  assert.equal(player(game, 'ixians').spice, funds - 1);
  assert.equal(game.decision?.kind, 'sukRescue');
  if (game.decision?.kind !== 'sukRescue') throw new Error('Expected native Suk rescue');
  assert.deepEqual(game.pendingSukRescue!.losses, { normal: 4, elite: 2, paidNormal: 0, paidElite: 1 });
  const pending = game;
  const choice = game.decision.options.findIndex(o => o.normal === 1 && o.elite === 1 && o.kept?.kind === 'normal');
  assert.ok(choice >= 0);
  reject(game, target, { type: 'decision', event: game.decision.event, choice });
  game = applyAction(game, actor, { type: 'decision', event: game.decision.event, choice });
  assert.equal(player(game, 'ixians').forces['wind_pass:14'], 3);
  assert.equal(player(game, 'ixians').reserves, 13);
  assert.equal(player(game, 'ixians').tanks, 4);
  assert.equal(player(game, 'ixians').elites!.reserves, 6);
  assert.equal(player(game, 'ixians').elites!.tanks, 1);
  assert.equal(game.decision?.kind, 'ixSubstitution');
  reject(game, actor, { type: 'decision', sources: { 'wind_pass:14': 2 }, recover: { 'wind_pass:14': 2 } });
  game = applyAction(game, actor, { type: 'decision', sources: { 'wind_pass:14': 1 }, recover: { 'wind_pass:14': 1 } });
  game = finishAdvancedNativeSkillAftermath(game);
  assert.equal(player(game, 'ixians').elites!.tanks, 0);
  assert.equal(player(game, 'ixians').elites!.forces['wind_pass:14'], 1);
  assert.equal(player(game, 'ixians').tanks, 4);
  assert.equal(player(game, 'ixians').spice, funds - 1);
  custody(game);

  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(pending, actor);
    view.players.find(p => p.id === actor)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.ok(action, difficulty);
    const rescued = applyAction(pending, actor, action);
    assert.equal(rescued.pendingSukRescue, null);
    assert.equal(player(rescued, 'ixians').spice, funds - 1);
    custody(rescued);
  }
});

void test('Advanced CHOAM cannot train its original Auditor; a real native trainer still takes the physical skill', () => {
  const options = { family: 'choam' as const, requestedSkill: 'bureaucrat' as const };
  let game = initializeAdvancedNativeSkillsSetup(options);
  const actor = player(game, 'choam').id;
  const offer = game.leaderSkills!.offers[actor];
  reject(game, actor, { type: 'leaderSkill', event: offer.event, skill: 'bureaucrat', leader: 'choam-auditor' });
  const native = viewGame(game, actor).leaderSkills!.eligibleLeaders[0];
  assert.ok(native);
  game = applyAction(game, actor, { type: 'leaderSkill', event: offer.event, skill: 'bureaucrat', leader: native.id });
  assert.equal(game.leaderSkills!.assignments.find(a => a.owner === actor)!.leader, native.id);
  game = completeAdvancedNativeSkillsSetup(game, options);
  const auditor = player(game, 'choam').leaders.find(l => l.id === 'choam-auditor')!;
  assert.ok(auditor && !auditor.dead);
  custody(game);
});

void test('original Auditor paid revival returns that leader without drawing or replacing a skill', () => {
  let game = completedAdvancedNativeSkillsGame({ family: 'choam', requestedSkill: 'bureaucrat' });
  game = advanceAdvancedNativeSkillsToPhase(game, 4);
  const owner = player(game, 'choam');
  const auditor = owner.leaders.find(l => l.id === 'choam-auditor')!;
  assert.ok(auditor && !auditor.dead);
  // Controlled death position, preserving the original Auditor and trained leader.
  auditor.dead = true;
  auditor.deaths = 1;
  const funds = owner.spice;
  const skills = structuredClone(game.leaderSkills);
  const revival = viewGame(game, owner.id).revival.leaders.find(l => l.id === auditor.id);
  assert.ok(revival);
  assert.equal(revival.cost, 2);
  game = applyAction(game, owner.id, { type: 'reviveLeader', leader: auditor.id });
  for (let i = 0; (game.response || game.decision || game.pendingRevival) && i < 100; i++) game = advancedNativeStep(game);
  assert.equal(player(game, 'choam').leaders.find(l => l.id === auditor.id)!.dead, false);
  assert.equal(player(game, 'choam').spice, funds - 2);
  assert.equal(player(game, 'choam').leaderRevived, true);
  assert.deepEqual(game.leaderSkills, skills);
  reject(game, owner.id, { type: 'reviveLeader', leader: auditor.id });
  custody(game);
});

void test('Advanced CHOAM own paid support does not generate its own income and Smuggler collects actual battlefield spice', () => {
  let game = createAdvancedNativeSkillBattle({ family: 'choam', requestedSkill: 'smuggler' });
  const actor = player(game, 'choam').id;
  const target = player(game, 'emperor').id;
  const ownFunds = player(game, 'choam').spice;
  const enemyFunds = player(game, 'emperor').spice;
  const collected = Math.min(5, player(game, 'choam').leaders.find(l => l.id === trainer(game, actor))!.strength);
  game.spice['wind_pass:14'] = 5; // Explicit controlled battlefield-spice rule position.
  game = openAdvancedNativeSkillBattle(game, actor, target);
  reject(game, actor, { type: 'battlePlan', dial: 3, support: ownFunds + 1, leader: trainer(game, actor) });
  game = applyAction(game, actor, { type: 'battlePlan', dial: 3, support: 2, leader: trainer(game, actor) });
  game = applyAction(game, target, { type: 'battlePlan', dial: 2, support: 2, leader: untrainedLeader(game, target) });
  game = resolvePlans(game, actor, target);
  assert.equal(game.lastBattleContext?.smugglerCollection?.amount, collected);
  assert.equal(game.lastBattleContext?.smugglerCollection?.stage, 'collected');
  assert.equal(player(game, 'choam').spice, ownFunds - 2 + 1 + collected);
  assert.equal(game.spice['wind_pass:14'], 5 - collected);
  game = finishAdvancedNativeSkillAftermath(game);
  assert.equal(player(game, 'choam').tanks, 4);
  assert.equal(player(game, 'choam').forces['wind_pass:14'], 4);
  assert.equal(player(game, 'emperor').tanks, 8);
  assert.equal(player(game, 'emperor').spice, enemyFunds - 2);
  assert.equal(player(game, 'choam').spice, ownFunds - 2 + 1 + 5,
    'Original Collection collects the one spice left after the skilled leader, separately from support income.');
  assert.equal(game.spice['wind_pass:14'] ?? 0, 0);
  assert.equal(game.pendingChoamBattleIncome, null);
  assert.equal(game.battle, null);
  custody(game);
});

void test('CHOAM prepaid ally support consumes its original donor pool and excludes that share from native income', () => {
  let game = createAdvancedNativeSkillBattle({ family: 'choam', skillOwner: 'atreides', requestedSkill: 'smuggler' });
  const owner = player(game, 'atreides');
  const donor = player(game, 'choam');
  const enemy = player(game, 'emperor');
  // Controlled mutual-alliance rule position; real native wallets fund the pledge.
  owner.ally = donor.id;
  donor.ally = owner.id;
  const ownFunds = owner.spice;
  const donorFunds = donor.spice;
  const enemyFunds = enemy.spice;
  game = applyAction(game, owner.id, { type: 'chooseBattle', territory: 'wind_pass', target: enemy.id });
  while (game.decision?.kind === 'leaderSkillVisibility')
    game = applyAction(game, game.decision.player,
      { type: 'leaderSkillVisibility', event: game.decision.event, hide: true });
  assert.equal(game.decision?.kind, 'choamBattleFunding');
  reject(game, owner.id, { type: 'decision', amount: 2 });
  game = applyAction(game, donor.id, { type: 'decision', amount: 2 });
  assert.equal(player(game, 'choam').spice, donorFunds - 2);
  assert.equal(game.aid[donor.id].amount, 2);
  for (let i = 0; (game.response || game.decision || game.battle?.preparation) && i < 100; i++) {
    if (game.decision?.kind === 'leaderSkillVisibility')
      game = applyAction(game, game.decision.player, { type: 'leaderSkillVisibility', event: game.decision.event, hide: true });
    else game = advancedNativeStep(game);
  }
  reject(game, owner.id, { type: 'battlePlan', dial: 4, support: 4, allyPayment: 3, leader: trainer(game, owner.id) });
  game = applyAction(game, owner.id, { type: 'battlePlan', dial: 4, support: 4, allyPayment: 2, leader: trainer(game, owner.id) });
  game = applyAction(game, enemy.id, { type: 'battlePlan', dial: 2, support: 2, leader: untrainedLeader(game, enemy.id) });
  game = finishAdvancedNativeSkillAftermath(resolvePlans(game, owner.id, enemy.id));
  assert.equal(player(game, 'atreides').spice, ownFunds - 2);
  assert.equal(player(game, 'choam').spice, donorFunds - 2 + 2,
    'Income is floor((4 supported - 2 prepaid)/2) plus floor(2 opponent support/2).');
  assert.equal(player(game, 'emperor').spice, enemyFunds - 2);
  assert.equal(game.aid[donor.id]?.amount ?? 0, 0);
  assert.equal(player(game, 'atreides').forces['wind_pass:14'], 4);
  assert.equal(player(game, 'atreides').tanks, 4);
  assert.equal(player(game, 'emperor').tanks, 8);
  assert.equal(game.battle, null);
  custody(game);
});

void test('native CHOAM Bureaucrat redirects only another payer while its native Worthless power remains usable', () => {
  let game = createAdvancedNativeSkillBattle({ family: 'choam', requestedSkill: 'bureaucrat' });
  Object.assign(game, { phase: 5, active: player(game, 'choam').id });
  const owner = player(game, 'choam');
  const payer = player(game, 'emperor');
  const payee = player(game, 'atreides');
  const funds = payer.spice;
  const bribes = payee.bribes;
  game = applyAction(game, payer.id, { type: 'bribe', target: payee.id, amount: 5 });
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  assert.equal(game.decision?.player, owner.id);
  const event = game.bureaucratPaymentEvent;
  game = applyAction(game, owner.id, { type: 'decision', event, redirect: true });
  assert.equal(player(game, 'emperor').spice, funds - 5);
  assert.equal(player(game, 'atreides').bribes, bribes + 3);
  reject(game, owner.id, { type: 'decision', event, redirect: true });
  const index = game.deck.findIndex(c => c.name === 'Kulon');
  assert.ok(index >= 0);
  const kulon = game.deck.splice(index, 1)[0];
  player(game, 'choam').hand.push(kulon); // Conserved canonical native card staging.
  game = applyAction(game, owner.id, { type: 'card', mode: 'choam', card: kulon.id });
  for (let i = 0; (game.response || game.pendingTreacheryDiscard) && i < 100; i++) game = advancedNativeStep(game);
  assert.equal(game.choamMovement?.bonus, 1);
  assert.equal(player(game, 'choam').hand.some(c => c.id === kulon.id), false);
  assert.equal(game.discard.filter(c => c.id === kulon.id).length, 1);
  custody(game);
});

void test('Advanced native admission preserves Atreides Suk and foreign-ghola unresolved boundaries without mutation', () => {
  const options = { family: 'ixians' as const, skillOwner: 'atreides' as const, requestedSkill: 'suk-graduate' as const };
  let game = initializeAdvancedNativeSkillsSetup(options);
  while (game.decision?.kind === 'ixSetup') game = advancedNativeStep(game);
  const actor = player(game, 'atreides').id;
  const offer = game.leaderSkills!.offers[actor];
  const leader = viewGame(game, actor).leaderSkills!.eligibleLeaders[0].id;
  reject(game, actor, { type: 'leaderSkill', event: offer.event, skill: 'suk-graduate', leader }, /Suk Graduate is unavailable/);
  game = completeAdvancedNativeSkillsSetup(game, options);
  assert.ok(game.leaderSkills!.deck.includes('suk-graduate'));
  assert.notEqual(game.leaderSkills!.assignments.find(a => a.owner === actor)!.skill, 'suk-graduate');
  custody(game);
  // Controlled original foreign-ghola custody boundary: use an untrained foreign
  // leader, not a fabricated skill assignment or replacement deck.
  const foreign = player(game, 'emperor').leaders.find(l => l.id !== trainer(game, player(game, 'emperor').id))!;
  foreign.gholaBy = player(game, 'ixians').id;
  reject(game, actor, { type: 'ready' }, /foreign gholas/);
});

void test('captured native trainer blocks replacement revival, retaining the physical skill and Tanks leader', () => {
  let game = completedAdvancedNativeSkillsGame({ family: 'ixians', requestedSkill: 'warmaster', opponents: ['harkonnen', 'emperor'] });
  game = advanceAdvancedNativeSkillsToPhase(game, 4);
  const owner = player(game, 'ixians');
  const trained = owner.leaders.find(l => l.id === trainer(game, owner.id))!;
  trained.capturedBy = player(game, 'harkonnen').id;
  const dead = owner.leaders.find(l => l.id !== trained.id)!;
  for (const leader of owner.leaders) if (leader.id !== trained.id) {
    leader.dead = true;
    leader.deaths = 1;
  } // Controlled captured trainer and all other native leaders in Tanks.
  const skills = structuredClone(game.leaderSkills);
  reject(game, owner.id, { type: 'reviveLeader', leader: dead.id }, /replacement-skill ruling/);
  assert.equal(dead.dead, true);
  assert.equal(trained.capturedBy, player(game, 'harkonnen').id);
  assert.deepEqual(game.leaderSkills, skills);
  custody(game);
});
