import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  advancedNativePlayer as player, advancedNativeStep, assertAdvancedNativeCustody as custody,
  completedAdvancedNativeSkillsGame, finishAdvancedNativeSkillAftermath,
  initializeAdvancedNativeSkillsSetup, openAdvancedNativeSkillBattle,
  rejectAdvancedNativeAction as reject, stageAdvancedNativeSkillBattle,
} from './fixture-advanced-native-skills';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;
const trainer = (g: Game, id: string) => g.leaderSkills!.assignments.find(a => a.owner === id)!;
const untrained = (g: Game, id: string) => g.players.find(p => p.id === id)!.leaders
  .filter(l => !l.dead && l.id !== trainer(g, id).leader).sort((a, b) => b.strength - a.strength)[0].id;

/** Genuine full native setup, then explicitly conserved shipment/battle position.
 * Native ship creates the physical marker; no fabricated deployed token. */
function markerGame(value: 0 | 3 | 5, requestedSkill: 'suk-graduate' | 'mentat' | 'smuggler',
  rules: 'basic' | 'advanced' = 'advanced', reserves = 20, companion = false) {
  const initial = completedAdvancedNativeSkillsGame({ family: 'richese', requestedSkill, rules });
  const actor = player(initial, 'richese').id, target = player(initial, 'emperor').id;
  let game = stageAdvancedNativeSkillBattle(initial, actor, target);
  const owner = player(game, 'richese');
  owner.reserves += owner.forces['wind_pass:14'];
  owner.forces = {};
  owner.tanks += owner.reserves - reserves;
  owner.reserves = reserves;
  if (companion) {
    const enemy = player(game, 'emperor');
    enemy.reserves += enemy.forces['wind_pass:14'];
    enemy.forces = {};
  }
  owner.shipped = false; owner.moved = 0;
  Object.assign(game, { phase: 5, active: actor, ready: [], phaseOpening: null, response: null, decision: null });
  const token = owner.noField!.tokens.find(t => t.value === value)!;
  const before = owner.spice;
  game = applyAction(game, actor, { type: 'ship', noField: token.id, event: owner.noFieldEvent,
    territory: 'wind_pass', sector: 14, smuggler: companion });
  for (let n = 0; (game.response || game.decision) && n < 100; n++) game = advancedNativeStep(game);
  assert.equal(player(game, 'richese').spice, before - 2);
  assert.ok(player(game, 'richese').noField!.deployed);
  if (companion) {
    const enemy = player(game, 'emperor');
    enemy.reserves -= 8;
    enemy.forces['wind_pass:14'] = 8;
  } // Explicit later opposing position; the actual companion arrived in an empty territory.
  const beforeBattle = reload(game);
  Object.assign(game, { phase: 6, active: actor, ready: [], phaseOpening: null, response: null, decision: null });
  custody(game);
  return { game, beforeBattle, actor, target };
}

void test('native Basic and Advanced Richese retain source-ordered all14 and their separate original ten-card cache', () => {
  for (const rules of ['basic', 'advanced'] as const) {
    const offered = initializeAdvancedNativeSkillsSetup({ family: 'richese', requestedSkill: 'suk-graduate', rules });
    assert.equal(offered.setupStage, 'leaderSkills');
    assert.equal(offered.richeseCache!.length, 10);
    for (const seat of offered.players) assert.equal(seat.hand.length, 1);
    const physical = [...offered.leaderSkills!.deck, ...Object.values(offered.leaderSkills!.offers).flatMap(o => o.cards)];
    assert.deepEqual([...physical].sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
    const rival = offered.players.find(p => p.faction !== 'richese')!;
    const own = player(offered, 'richese');
    assert.deepEqual(viewGame(offered, rival.id).leaderSkills!.eligibleLeaders.map(l => l.id).sort(),
      rival.leaders.filter(l => !l.dead && !l.capturedBy && !l.gholaBy).map(l => l.id).sort());
    assert.equal(viewGame(offered, own.id).leaderSkills!.offer!.cards.includes('suk-graduate'), true);
    custody(completedAdvancedNativeSkillsGame({ family: 'richese', requestedSkill: 'suk-graduate', rules }));
  }
});

void test('scarce native No-Field five materializes only three after both plans and skilled Suk saves only real paid losses', () => {
  const staged = markerGame(5, 'suk-graduate', 'advanced', 3);
  let game = openAdvancedNativeSkillBattle(staged.game, staged.actor, staged.target);
  const trained = trainer(game, staged.actor).leader;
  reject(game, staged.actor, { type: 'battlePlan', dial: 4, support: 3, leader: trained });
  game = applyAction(game, staged.actor, { type: 'battlePlan', dial: 3, support: 3, leader: trained });
  assert.ok(player(game, 'richese').noField!.deployed);
  assert.equal(player(game, 'richese').forces['wind_pass:14'] ?? 0, 0);
  assert.equal(viewGame(game, staged.target).richeseNoField!.private, null);
  game = applyAction(game, staged.target, { type: 'battlePlan', dial: 0, support: 0, leader: untrained(game, staged.target) });
  assert.equal(player(game, 'richese').noField!.deployed, null);
  assert.equal(player(game, 'richese').forces['wind_pass:14'], 3);
  game = applyAction(game, staged.actor, { type: 'traitorCall', call: false });
  game = applyAction(game, staged.target, { type: 'traitorCall', call: false });
  assert.equal(game.decision?.kind, 'sukRescue');
  if (game.decision?.kind !== 'sukRescue') throw new Error('Native real casualties must retain skilled rescue.');
  const pending = game;
  const choice = game.decision.options.findIndex(o => o.normal === 3 && o.elite === 0 && o.kept?.key === 'wind_pass:14');
  assert.ok(choice >= 0);
  game = applyAction(reload(game), staged.actor, { type: 'decision', event: game.decision.event, choice });
  game = finishAdvancedNativeSkillAftermath(game);
  assert.equal(player(game, 'richese').forces['wind_pass:14'], 1);
  assert.equal(player(game, 'richese').reserves, 2);
  assert.equal(player(game, 'richese').tanks, 17);
  assert.equal(player(game, 'richese').spice, 0);
  custody(game);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(reload(pending), staged.actor);
    view.players.find(p => p.id === staged.actor)!.bot = difficulty;
    const rescued = applyAction(reload(pending), staged.actor, botActions(view)[0]);
    assert.equal(player(rescued, 'richese').tanks, 17);
    assert.equal(player(rescued, 'richese').spice, 0);
    custody(finishAdvancedNativeSkillAftermath(rescued));
  }
});

void test('normal native Suk returns one actual No-Field casualty under both rule-band support costs', () => {
  for (const rules of ['basic', 'advanced'] as const) {
    const staged = markerGame(3, 'suk-graduate', rules);
    let game = openAdvancedNativeSkillBattle(staged.game, staged.actor, staged.target, false);
    const balance = player(game, 'richese').spice;
    game = applyAction(game, staged.actor, { type: 'battlePlan', dial: 2, support: rules === 'advanced' ? 2 : 0,
      leader: untrained(game, staged.actor) });
    game = applyAction(game, staged.target, { type: 'battlePlan', dial: 0, support: 0, leader: untrained(game, staged.target) });
    game = applyAction(game, staged.actor, { type: 'traitorCall', call: false });
    game = applyAction(game, staged.target, { type: 'traitorCall', call: false });
    game = finishAdvancedNativeSkillAftermath(game);
    assert.equal(game.lastBattleContext!.winner, staged.actor);
    assert.equal(player(game, 'richese').forces['wind_pass:14'], 1);
    assert.equal(player(game, 'richese').reserves, 18);
    assert.equal(player(game, 'richese').tanks, 1);
    assert.equal(player(game, 'richese').spice, balance - (rules === 'advanced' ? 2 : 0));
    custody(game);
  }
});

void test('zero native No-Field retains an actual skilled leader battle and no phantom forces or support', () => {
  const staged = markerGame(0, 'mentat');
  let game = openAdvancedNativeSkillBattle(staged.game, staged.actor, staged.target);
  const trained = trainer(game, staged.actor).leader;
  const before = player(game, 'richese').spice;
  reject(game, staged.actor, { type: 'battlePlan', dial: 1, support: 0, leader: trained });
  game = applyAction(game, staged.actor, { type: 'battlePlan', dial: 0, support: 0, leader: trained });
  game = applyAction(game, staged.target, { type: 'battlePlan', dial: 0, support: 0, leader: untrained(game, staged.target) });
  game = applyAction(game, staged.actor, { type: 'traitorCall', call: false });
  game = applyAction(game, staged.target, { type: 'traitorCall', call: false });
  game = finishAdvancedNativeSkillAftermath(game);
  assert.equal(game.lastBattleContext!.winner, staged.actor);
  assert.equal(player(game, 'richese').reserves, 20);
  assert.equal(player(game, 'richese').tanks, 0);
  assert.equal(player(game, 'richese').forces['wind_pass:14'] ?? 0, 0);
  assert.equal(player(game, 'richese').spice, before);
  custody(game);
});

void test('original Smuggler companion remains physical and mixed No-Field battle stays guarded until voluntary native reveal', () => {
  const staged = markerGame(5, 'smuggler', 'advanced', 20, true);
  const owner = player(staged.game, 'richese');
  assert.equal(owner.reserves, 19);
  assert.equal(owner.forces['wind_pass:14'], 1);
  reject(staged.game, staged.actor, { type: 'chooseBattle', territory: 'wind_pass', target: staged.target });
  const token = owner.noField!.deployed!.tokenId;
  reject(staged.game, staged.actor, { type: 'revealNoField', token, event: owner.noFieldEvent });
  let game = applyAction(staged.beforeBattle, staged.actor, { type: 'revealNoField', token, event: owner.noFieldEvent });
  assert.equal(player(game, 'richese').forces['wind_pass:14'], 6);
  assert.equal(player(game, 'richese').reserves, 14);
  Object.assign(game, { phase: 6, active: staged.actor, ready: [], phaseOpening: null, response: null, decision: null });
  game = openAdvancedNativeSkillBattle(game, staged.actor, staged.target);
  game = applyAction(game, staged.actor, { type: 'battlePlan', dial: 0, support: 0, leader: untrained(game, staged.actor) });
  game = applyAction(game, staged.target, { type: 'battlePlan', dial: 0, support: 0, leader: untrained(game, staged.target) });
  game = applyAction(game, staged.actor, { type: 'traitorCall', call: false });
  game = applyAction(game, staged.target, { type: 'traitorCall', call: false });
  game = finishAdvancedNativeSkillAftermath(game);
  assert.equal(game.lastBattleContext!.winner, staged.target);
  assert.equal(player(game, 'richese').tanks, 6);
  assert.equal(player(game, 'richese').forces['wind_pass:14'] ?? 0, 0);
  assert.equal(player(game, 'richese').reserves, 14);
  custody(game);
});
