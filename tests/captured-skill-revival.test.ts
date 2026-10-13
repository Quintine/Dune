import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  assertCapturedSkillInventory, capturedSkillPlayer, createCapturedSkillRevivalFixture,
} from './fixture-captured-skill-revival';

/** Program-level BEFORE. On the pre-cutover revision (HEAD before this change)
 * `tests/advanced-native-skills.test.ts` and `tests/leader-skills-capture.test.ts`
 * asserted that a faction whose original Leader Skill card was captured could not
 * revive a different own leader at all (`/replacement-skill ruling/`), and the
 * projected revival/Ghola controls hid every own-leader target. The ruling keeps
 * the original assignment with the living captive and lets others revive normally.
 * Physical p21 makes a replacement draw conditional on having no Skill Card;
 * `offerRevivedLeaderSkill` already suppresses that draw while an assignment exists. */
const retainedAssignment = (game: Game) =>
  viewGame(game, 'a').leaderSkills!.assignments.find(entry => entry.owner === 'a')!;
/** The captured original card stays one unique assignment owned by Atreides and
 * controlled by Harkonnen; only its top effect is unavailable to the captor. */
function assertRetainedCaptiveAssignment(game: Game, skill: string): void {
  const entry = retainedAssignment(game);
  assert.equal(entry.owner, 'a');
  assert.equal(entry.leader, 'atreides-1');
  assert.equal(entry.skill, skill);
  assert.equal(entry.controller, 'h');
  assert.equal(entry.captured, true);
  assert.equal(entry.faceUp, false);
}

void test('the ordinary paid revival of another own leader leaves the captured original skill card in place', () => {
  const fixture = createCapturedSkillRevivalFixture();
  const before = fixture.game;
  const view = viewGame(before, fixture.actor);
  const offered = view.revival.leaders.find(entry => entry.id === fixture.dead);
  assert.ok(offered, 'The real cycle must offer the untrained dead leader');
  assert.equal(offered.normalCost, fixture.deadCost);
  assert.equal(offered.cost, fixture.deadCost);
  assert.equal(offered.affordable, true);
  const viewIndex = view.players.findIndex(player => player.id === fixture.actor);
  view.players[viewIndex].bot = 'Easy';
  // The existing policy surfaces the real own-leader target. Its Revival-phase
  // priority keeps the paid/free revival actions ahead of the standalone Ghola
  // suggestion, so only the ordinary target is a policy recommendation here.
  assert.ok(botActions(view).some(action => action.type === 'reviveLeader' && action.leader === fixture.dead));
  const spice = capturedSkillPlayer(before, fixture.actor).spice;
  const deck = [...before.leaderSkills!.deck];
  const after = applyAction(before, fixture.actor, { type: 'reviveLeader', leader: fixture.dead });
  const revived = capturedSkillPlayer(after, fixture.actor).leaders.find(disc => disc.id === fixture.dead)!;
  assert.equal(revived.dead, false);
  assert.equal(revived.deaths, 1, 'The genuine death count survives the ordinary return');
  assert.equal(capturedSkillPlayer(after, fixture.actor).spice, spice - fixture.deadCost);
  assert.equal(capturedSkillPlayer(after, fixture.actor).leaders.find(disc => disc.id === 'atreides-2')!.dead, true);
  assert.equal(capturedSkillPlayer(after, fixture.actor).leaders.find(disc => disc.id === fixture.captive)!.capturedBy, 'h');
  assert.deepEqual([...after.leaderSkills!.deck], deck, 'No replacement Leader Skill card was drawn');
  assert.equal(after.leaderSkills!.offers[fixture.actor], undefined, 'No replacement offer was opened');
  assert.deepEqual(after.leaderSkills!.assignments, before.leaderSkills!.assignments);
  assertRetainedCaptiveAssignment(after, fixture.assignment.skill);
  assertCapturedSkillInventory(after);
});

void test('the held physical Ghola revives another own leader for free from the same captured state', () => {
  const fixture = createCapturedSkillRevivalFixture();
  const before = fixture.game;
  const spice = capturedSkillPlayer(before, fixture.actor).spice;
  const deck = [...before.leaderSkills!.deck];
  const after = applyAction(before, fixture.actor, { type: 'card', card: fixture.ghola, leader: fixture.dead });
  const revived = capturedSkillPlayer(after, fixture.actor).leaders.find(disc => disc.id === fixture.dead)!;
  assert.equal(revived.dead, false);
  assert.equal(capturedSkillPlayer(after, fixture.actor).spice, spice, 'Ghola spends no spice and no allowance');
  assert.equal(capturedSkillPlayer(after, fixture.actor).hand.some(card => card.id === fixture.ghola), false,
    'The physical Ghola card is consumed');
  assert.deepEqual([...after.leaderSkills!.deck], deck);
  assert.equal(after.leaderSkills!.offers[fixture.actor], undefined);
  assert.deepEqual(after.leaderSkills!.assignments, before.leaderSkills!.assignments);
  assertRetainedCaptiveAssignment(after, fixture.assignment.skill);
  assertCapturedSkillInventory(after);
});

void test('captive, wrong-actor, cross-phase, second-leader and consumed-Ghola attempts stay rejected', () => {
  const fixture = createCapturedSkillRevivalFixture();
  const before = fixture.game;
  const snapshot = structuredClone(before);
  // The living captive is not a revival target for its owner.
  assert.throws(() => applyAction(before, fixture.actor, { type: 'reviveLeader', leader: fixture.captive }));
  assert.deepEqual(before, snapshot);
  // Another faction cannot revive someone else's leader.
  assert.throws(() => applyAction(before, fixture.observer, { type: 'reviveLeader', leader: fixture.dead }));
  assert.deepEqual(before, snapshot);
  // A different phase cannot open the ordinary cycle.
  assert.throws(() => applyAction(fixture.afterSetup, fixture.actor, { type: 'reviveLeader', leader: fixture.dead }));
  assert.ok(fixture.afterSetup.phase !== 4);
  // One ordinary leader revival per phase; a second ordinary request is stale.
  const revived = applyAction(before, fixture.actor, { type: 'reviveLeader', leader: fixture.dead });
  const revivedSnapshot = structuredClone(revived);
  assert.throws(() => applyAction(revived, fixture.actor, { type: 'reviveLeader', leader: 'atreides-2' }));
  assert.deepEqual(revived, revivedSnapshot);
  // A consumed Ghola cannot revive again.
  const gholaGame = applyAction(before, fixture.actor, { type: 'card', card: fixture.ghola, leader: fixture.dead });
  assert.throws(() => applyAction(gholaGame, fixture.actor, { type: 'card', card: fixture.ghola, leader: 'atreides-2' }));
  assertCapturedSkillInventory(gholaGame);
});
