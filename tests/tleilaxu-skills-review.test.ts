import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, type Action, type Game } from '../game/engine';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import {
  assertTleilaxuSkillsCustody as custody,
  completedTleilaxuSkillsGame,
  reloadTleilaxuSkillsGame as reload,
  rejectTleilaxuSkillsAction as reject,
  tleilaxuSkillsPlayer as player,
} from './tleilaxu-skills-fixture';

const act = (g: Game, owner: string, action: Action) => applyAction(reload(g), owner, action);

/** Conserved battle positions after genuine setup, with a second battle keeping phase 6 open. */
function stage(g: Game, owner = 't') {
  for (const p of g.players) {
    g.deck.push(...p.hand); p.hand = [];
    p.forces = [owner, 'e'].includes(p.id) ? { 'wind_pass:14': 6, 'carthag:11': 1 } : {};
    p.reserves = [owner, 'e'].includes(p.id) ? 13 : 20;
    p.tanks = 0; p.spice = 20;
  }
  Object.assign(g, { phase: 6, active: owner, storm: 18,
    order: [owner, 'e', ...g.players.map(p => p.id).filter(id => id !== owner && id !== 'e')],
    ready: [], decision: null, response: null, phaseOpening: null, spice: {} });
  return g;
}
function open(g: Game, owner = 't') {
  g = act(g, owner, { type: 'chooseBattle', territory: 'wind_pass', target: 'e' });
  for (let i = 0; i < 30; i++) {
    if (g.response) g = act(g, g.players.find(p => !g.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
    else if (g.decision?.kind === 'leaderSkillVisibility')
      g = act(g, g.decision.player, { type: 'leaderSkillVisibility', event: g.decision.event, hide: true });
    else if (g.battle?.preparation) g = act(g, g.battle.preparation.owner, { type: 'declineBattlePower' });
    else break;
  }
  assert.equal(g.decision, null); assert.equal(g.battle?.preparation, undefined);
  return g;
}
function resolve(g: Game, owner = 't') {
  g = act(g, owner, { type: 'traitorCall', call: false });
  return act(g, 'e', { type: 'traitorCall', call: false });
}
function assignPhysicalSkill(g: Game, owner: string, skill: LeaderSkillId) {
  const target = g.leaderSkills!.assignments.find(a => a.owner === owner)!;
  const previous = g.leaderSkills!.assignments.find(a => a.skill === skill);
  if (previous) [target.skill, previous.skill] = [previous.skill, target.skill];
  else {
    const index = g.leaderSkills!.deck.indexOf(skill);
    assert.ok(index >= 0);
    [target.skill, g.leaderSkills!.deck[index]] = [g.leaderSkills!.deck[index], target.skill];
  }
  custody(g);
}
function matchingFaceDancer(g: Game, target: string) {
  const dancers = player(g, 't').faceDancers!;
  if (dancers.some(card => card.leader === target)) return;
  const former = dancers[0].leader;
  const index = g.traitorReserve!.indexOf(target);
  if (index >= 0) g.traitorReserve![index] = former;
  else {
    const owner = g.players.find(p => p.traitors.includes(target));
    assert.ok(owner);
    owner.traitors[owner.traitors.indexOf(target)] = former;
  }
  dancers[0].leader = target;
}

void test('Zoal Smuggler copies the opposing disc without the surviving Mentat battle bonus', () => {
  let g = stage(completedTleilaxuSkillsGame({ requestedSkill: 'smuggler' }));
  // This swaps the two actual cards; it creates neither a duplicate nor a reduced deck.
  assignPhysicalSkill(g, 'e', 'mentat');
  const printed = player(g, 'e').leaders.find(leader => leader.id === 'emperor-0')!.strength;
  g.spice = { 'wind_pass:14': 9 };
  g = open(g);
  g = act(g, 't', { type: 'battlePlan', dial: 4, leader: 'tleilaxu-0' });
  assert.equal(g.battle!.smugglerCollection, undefined, 'A sealed first plan cannot inspect the opposing disc.');
  g = act(g, 'e', { type: 'battlePlan', dial: 0, leader: 'emperor-0' });
  assert.equal(g.battle!.smugglerCollection!.strength, printed);
  assert.equal(g.battle!.smugglerCollection!.amount, printed);
  g = resolve(g);
  assert.ok(g.log.some(entry => /Emperor gained 2 battle strength from Mentat/.test(entry.text)));
  assert.equal(g.lastBattleContext!.winner, 't');
  assert.equal(g.lastBattleContext!.smugglerCollection!.strength, printed);
  assert.equal(player(g, 't').spice, 20 + printed);
  assert.equal(g.spice['wind_pass:14'], 9 - printed);
  custody(g);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
});

void test('Rihani keeps live custody through winner cleanup then survives all-three Face Dancer replacement as immutable history', () => {
  let g = stage(completedTleilaxuSkillsGame({ requestedSkill: 'rihani-decipherer', skillOwner: 'atreides' }), 'a');
  matchingFaceDancer(g, 'atreides-0');
  // Two earlier reveals are explicitly staged; the current Face Dance triggers the native reset.
  for (const card of player(g, 't').faceDancers!) card.revealed = card.leader !== 'atreides-0';
  const index = g.deck.findIndex(card => card.kind === 'worthless');
  assert.ok(index >= 0);
  const worthless = g.deck.splice(index, 1)[0]; player(g, 'a').hand.push(worthless);
  custody(g);
  g = open(g, 'a');
  g = act(g, 'a', { type: 'battlePlan', dial: 4, leader: 'atreides-0', weapon: worthless.id });
  g = act(g, 'e', { type: 'battlePlan', dial: 0, leader: 'emperor-1' });
  g = resolve(g, 'a');
  const event = g.rihaniHistory!.at(-1)!.event;
  g = act(g, 'a', { type: 'decision', event, draw: false });
  assert.equal(g.decision?.kind, 'battleCards');
  assert.equal(g.lastBattleContext!.rihani!.faceDanceStarted, undefined);
  const shuffledEarly = reload(g);
  shuffledEarly.traitorReserve!.reverse();
  reject(shuffledEarly, 'a', { type: 'decision', discard: [] }, /current Traitor custody/);
  const prematureRelease = reload(g);
  prematureRelease.lastBattleContext!.rihani!.faceDanceStarted = true;
  reject(prematureRelease, 'a', { type: 'decision', discard: [] }, /obligation changed/);

  g = act(g, 'a', { type: 'decision', discard: [] });
  assert.equal(g.decision?.kind, 'faceDance');
  assert.equal(g.lastBattleContext!.rihani!.faceDanceStarted, true);
  const history = structuredClone(g.rihaniHistory);
  const unmarked = reload(g);
  delete unmarked.lastBattleContext!.rihani!.faceDanceStarted;
  reject(unmarked, 't', { type: 'decision', reveal: false }, /obligation changed/);
  const changedHistory = reload(g);
  changedHistory.rihaniHistory![0].peeked.reverse();
  reject(changedHistory, 't', { type: 'decision', reveal: false }, /receipt is invalid/);
  const duplicated = reload(g);
  duplicated.traitorReserve!.push(player(duplicated, 't').faceDancers![0].leader);
  reject(duplicated, 't', { type: 'decision', reveal: false }, /census/);

  g = act(g, 't', { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 14 });
  assert.equal(g.phase, 6);
  assert.equal(g.pendingFaceDance, null);
  assert.equal(player(g, 't').faceDancers!.length, 3);
  assert.ok(player(g, 't').faceDancers!.every(card => !card.revealed));
  assert.deepEqual(g.rihaniHistory, history);
  assert.equal(g.leaderSkills!.deck.filter(skill => skill === 'rihani-decipherer').length, 1);
  custody(g);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
});
