import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { leaderRevivalOptions } from '../game/revival';
import {
  advanceCapturedSkillSpecial, capturedSkillSpecialClean,
  capturedSkillSpecialInventory, capturedSkillSpecialPlayer as player,
  capturedSkillSpecialStock, createCapturedSkillSpecialRevivalFixture,
  type CapturedSkillSpecialStep,
} from './fixture-captured-skill-special-revival';

void test('native Emperor Special revives a different own dead disc without replacing the captive Skill Card', () => {
  const f = createCapturedSkillSpecialRevivalFixture();
  const before = structuredClone(f.game);
  const emperor = player(before, 'e');
  const dead = emperor.leaders.find(l => l.id === f.dead)!;
  const captive = emperor.leaders.find(l => l.id === f.captive)!;
  assert.equal(dead.dead, true);
  assert.equal(dead.deaths, 1);
  assert.equal(dead.capturedBy, undefined);
  assert.equal(captive.dead, false);
  assert.equal(captive.capturedBy, 'h');
  assert.equal(emperor.leaderRevived, false);
  assert.equal(emperor.revived, 0);
  assert.equal(emperor.specialKaramaUsed, undefined);
  assert.equal(before.turn, 2);
  assert.equal(before.phase, 4);
  assert.ok(capturedSkillSpecialClean(before));
  assert.equal(player(f.setup, 'h').forces['carthag:11'], 10);
  assert.equal(player(f.afterShipment, 'e').forces['carthag:11'], 2);
  assert.equal(player(f.afterShipment, 'e').spice, player(f.beforeShipment, 'e').spice - 2);
  assert.ok(f.actions.some(step => step.actor === 'h' && step.action.type === 'decision' && step.action.mode === 'keep'));

  const view = viewGame(before, 'e');
  const original = view.leaderSkills!.assignments.find(a => a.owner === 'e')!;
  assert.deepEqual(original, { skill: 'sandmaster', leader: f.captive, owner: 'e',
    controller: 'h', captured: true, faceUp: false });
  assert.equal(view.leaderSkills!.offer, null);
  assert.deepEqual(view.revival.leaders, leaderRevivalOptions(before, emperor).leaders,
    'Ordinary cycle eligibility remains native; Special uses the original dead roster, not a fabricated ordinary menu');
  assert.equal(view.players.find(p => p.id === 'e')!.leaders.find(l => l.id === f.dead)!.dead, true);
  assert.equal(view.players.find(p => p.id === 'e')!.leaders.find(l => l.id === f.captive)!.capturedBy, 'h');
  view.players.find(p => p.id === 'e')!.bot = 'Easy';
  const recommendations = botActions(view);
  assert.equal(recommendations.length, 1);
  assert.deepEqual(recommendations[0], f.action,
    'Existing Easy policy already selects the one legal printed Special; no policy strategy is introduced');

  assert.throws(() => applyAction(before, 'e', { ...f.action, leader: f.captive }), /dead leaders/);
  assert.throws(() => applyAction(before, 'e', { ...f.action, target: 'h' }), /own forces or leaders/);
  assert.throws(() => applyAction(f.beforeBattle, 'e', f.action), /during Revival/);
  assert.throws(() => applyAction(f.initial, 'e', f.action), /setup|advanced game|phase opening/i);
  assert.throws(() => applyAction(before, 'e', { ...f.action, card: f.weapon }), /Karama card in your hand/);
  assert.throws(() => applyAction(before, 'h', f.action), /Karama card in your hand/);
  assert.throws(() => applyAction(before, 'e', { ...f.action, amount: 1 }), /forces or one leader/);
  assert.deepEqual(f.game, before, 'Rejected selections cannot consume the original right or physical card');

  // This printed Special is immediate: it creates no generic paid-revival
  // stop/cancellation observer or second suffix. One real declaration is enough.
  const after = applyAction(before, 'e', recommendations[0]);
  const revived = player(after, 'e');
  assert.equal(revived.leaders.find(l => l.id === f.dead)!.dead, false);
  assert.equal(revived.leaders.find(l => l.id === f.dead)!.deaths, dead.deaths);
  assert.equal(revived.spice, emperor.spice, 'Full printed free revival never debits the leader strength');
  assert.equal(revived.specialKaramaUsed, true);
  assert.equal(revived.leaderRevived, emperor.leaderRevived);
  assert.equal(revived.revived, emperor.revived);
  assert.equal(revived.tanks, emperor.tanks);
  assert.equal(revived.reserves, emperor.reserves);
  assert.deepEqual(revived.forces, emperor.forces);
  assert.deepEqual(revived.elites, emperor.elites);
  assert.equal(revived.hand.filter(c => c.id === f.karama).length, 0);
  assert.equal(after.discard.filter(c => c.id === f.karama).length, 1);
  assert.deepEqual(capturedSkillSpecialStock(after), f.stock);
  assert.deepEqual(after.leaderSkills, before.leaderSkills,
    'One unique original assignment and unchanged physical all14 deck: no replacement offer or draw');
  assert.deepEqual(revived.leaders.find(l => l.id === f.captive), captive);
  assert.deepEqual(viewGame(after, 'e').leaderSkills!.assignments.find(a => a.owner === 'e'), original);
  assert.equal(viewGame(after, 'e').leaderSkills!.offer, null);
  assert.equal(after.pendingRevival, undefined);
  assert.equal(after.response, null);
  assert.equal(after.decision, null);
  assert.equal(after.pendingTreacheryDiscard, undefined);
  assert.equal(after.phase, before.phase);
  assert.equal(after.turn, before.turn);
  const receipt = `Emperor used special Karama to revive ${dead.name} for free.`;
  assert.equal(after.log.filter(entry => entry.text === receipt).length, 1);
  capturedSkillSpecialInventory(after);
  assert.throws(() => applyAction(after, 'e', f.action), /already been used/);
  assert.throws(() => applyAction(after, 'e', { ...f.action, amount: 1, leader: undefined }), /already been used/);
  assert.equal(botActions(viewGame(after, 'e')).filter(a => a.type === 'card' && a.mode === 'special').length, 0);

  const suffix: CapturedSkillSpecialStep[] = [];
  const continued = advanceCapturedSkillSpecial(after,
    g => g.phase === 5 && capturedSkillSpecialClean(g), suffix);
  assert.equal(continued.turn, 2);
  assert.equal(continued.phase, 5);
  assert.ok(suffix.length > 0);
  assert.ok(suffix.every(step => step.action.type !== 'card'));
  assert.equal(continued.log.filter(entry => entry.text === receipt).length, 1);
  assert.equal(continued.discard.filter(c => c.id === f.karama).length, 1);
  assert.deepEqual(continued.leaderSkills, before.leaderSkills);
  assert.deepEqual(player(continued, 'e').leaders.find(l => l.id === f.captive), captive);
  assert.deepEqual(capturedSkillSpecialStock(continued), f.stock);
  capturedSkillSpecialInventory(continued);
});
