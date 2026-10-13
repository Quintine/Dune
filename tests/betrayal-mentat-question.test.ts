import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  betrayalMentatResources, betrayalMentatSeat, createBetrayalMentatQuestionFixture,
  prepareBetrayalMentatPlans, reloadBetrayalMentat,
} from './fixture-betrayal-mentat-question';

function rejectBetrayalMentat(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('native Betrayal Mentat exact weapon shows privately before original posture and accepts card-free native plans', () => {
  const fixture = createBetrayalMentatQuestionFixture();
  const { owner, target, observer, leader } = fixture;
  let game = reloadBetrayalMentat(fixture.battle);
  assert.equal(game.decision?.kind, 'mentatQuestion');
  assert.equal(game.decision?.player, owner);
  assert.equal(game.battle!.preparation, undefined);
  assert.equal(game.battle!.leaderSkillHidden, undefined);
  assert.equal(viewGame(game, owner).mentat.pending!.stage, 'name');
  const event = game.battle!.mentatQuestionEvent!;
  const resources = betrayalMentatResources(game);
  assert.deepEqual(resources, betrayalMentatResources(fixture.paid));
  assert.ok(fixture.shipmentGateEvents.length);
  const ask: Action = { type: 'decision', event, weapon: 'Crysknife' };
  rejectBetrayalMentat(game, target, ask);
  rejectBetrayalMentat(game, owner, { ...ask, event: 'stale' });
  game = applyAction(game, owner, ask);
  assert.equal(game.decision?.kind, 'mentatQuestion');
  assert.equal(game.decision?.player, target);
  assert.equal(game.battle!.preparation, undefined);
  const held = betrayalMentatSeat(game, target).hand;
  const weapon = held.find(card => card.name === 'Crysknife')!;
  const other = held.find(card => card.name === 'Snooper')!;
  assert.deepEqual(viewGame(game, target).mentat.pending!.cards,
    held.filter(card => card.name === 'Crysknife'));
  for (const id of [owner, observer, 'shipper'])
    assert.deepEqual(viewGame(game, id).mentat.pending!.cards, []);
  const show: Action = { type: 'decision', event, card: weapon.id };
  rejectBetrayalMentat(game, owner, show);
  rejectBetrayalMentat(game, target, { ...show, event: 'stale' });
  rejectBetrayalMentat(game, target, { ...show, card: other.id });
  game = applyAction(reloadBetrayalMentat(game), target, show);
  assert.equal(game.decision?.kind, 'leaderSkillVisibility');
  assert.equal(game.battle!.preparation, undefined);
  assert.deepEqual(betrayalMentatResources(game), resources);
  for (const id of [owner, target])
    assert.equal(viewGame(game, id).mentat.history[0].card.id, weapon.id);
  for (const id of [observer, 'shipper']) {
    assert.deepEqual(viewGame(game, id).mentat.history, []);
    assert.ok(!JSON.stringify(viewGame(game, id)).includes(weapon.id));
  }
  assert.ok(!JSON.stringify(game.log).includes(weapon.id));
  rejectBetrayalMentat(game, target, show);
  game = prepareBetrayalMentatPlans(game);
  assert.equal(game.decision, null);
  assert.equal(game.battle!.preparation, undefined);
  assert.equal(game.battle!.leaderSkillHidden![owner], true);
  assert.deepEqual(betrayalMentatResources(game), resources);
  const targetSkill = game.leaderSkills!.assignments.find(a => a.owner === target)!.leader;
  const targetLeader = betrayalMentatSeat(game, target).leaders.find(l =>
    !l.dead && !l.capturedBy && l.id !== targetSkill)!;
  game = applyAction(game, owner, { type: 'battlePlan', dial: 0, leader });
  game = applyAction(game, target, { type: 'battlePlan', dial: 0, leader: targetLeader.id });
  assert.equal(game.battle!.plans[owner].leader, leader);
  assert.equal(game.battle!.plans[target].leader, targetLeader.id);
  assert.equal(game.battle!.plans[target].weapon, null);
  assert.equal(game.battle!.plans[target].defense, null);
  assert.ok(betrayalMentatSeat(game, target).hand.some(card => card.id === weapon.id));
  assert.deepEqual(betrayalMentatResources(game), resources);
});

void test('native Betrayal absent weapon offers only actual held alternatives and retains the freely shown defense', () => {
  const fixture = createBetrayalMentatQuestionFixture();
  const { owner, target, observer } = fixture;
  const before = betrayalMentatResources(fixture.battle);
  let game = applyAction(reloadBetrayalMentat(fixture.battle), owner,
    { type: 'decision', event: fixture.battle.battle!.mentatQuestionEvent, weapon: 'Lasgun' });
  assert.equal(game.decision?.kind, 'mentatQuestion');
  assert.equal(game.decision?.player, target);
  const pending = viewGame(game, target).mentat.pending!;
  assert.deepEqual(pending.cards, betrayalMentatSeat(game, target).hand);
  const shown = pending.cards.find(card => card.name === 'Snooper')!;
  rejectBetrayalMentat(game, observer, { type: 'decision', event: pending.event, card: shown.id });
  rejectBetrayalMentat(game, target, { type: 'decision', event: pending.event, decline: true });
  rejectBetrayalMentat(game, target, { type: 'decision', event: pending.event, card: 'not-held' });
  game = applyAction(reloadBetrayalMentat(game), target,
    { type: 'decision', event: pending.event, card: shown.id });
  assert.equal(viewGame(game, owner).mentat.history[0].card.id, shown.id);
  assert.deepEqual(viewGame(game, observer).mentat.history, []);
  assert.deepEqual(betrayalMentatResources(game), before);
  game = prepareBetrayalMentatPlans(game);
  const targetSkill = game.leaderSkills!.assignments.find(a => a.owner === target)!.leader;
  const targetLeader = betrayalMentatSeat(game, target).leaders.find(l =>
    !l.dead && !l.capturedBy && l.id !== targetSkill)!;
  game = applyAction(game, owner, { type: 'battlePlan', dial: 0, leader: fixture.leader });
  game = applyAction(game, target, { type: 'battlePlan', dial: 0, leader: targetLeader.id });
  assert.equal(game.battle!.plans[target].defense, null);
  assert.ok(betrayalMentatSeat(game, target).hand.some(card => card.id === shown.id));
  assert.deepEqual(betrayalMentatResources(game), before);
});

void test('all four legal policies apply the composed private question and response through the original next battle preparation', () => {
  const fixture = createBetrayalMentatQuestionFixture();
  for (const difficulty of DIFFICULTIES) {
    let game = reloadBetrayalMentat(fixture.battle);
    const resources = betrayalMentatResources(game);
    const own = viewGame(game, fixture.owner);
    own.players.find(p => p.id === fixture.owner)!.bot = difficulty;
    assert.deepEqual(botActions(viewGame(game, fixture.target)), []);
    assert.deepEqual(botActions(viewGame(game, fixture.observer)), []);
    const ask = botActions(own)[0];
    assert.ok(own.mentat.pending!.weapons.includes(ask.weapon as string));
    game = applyAction(game, fixture.owner, ask);
    const target = viewGame(game, fixture.target);
    target.players.find(p => p.id === fixture.target)!.bot = difficulty;
    const show = botActions(target)[0];
    assert.ok(target.mentat.pending!.cards.some(card => card.id === show.card));
    game = applyAction(game, fixture.target, show);
    assert.equal(viewGame(game, fixture.owner).mentat.history.length, 1);
    assert.deepEqual(viewGame(game, fixture.observer).mentat.history, []);
    assert.equal(game.decision?.kind, 'leaderSkillVisibility');
    const actor = game.decision!.player;
    const posture = viewGame(game, actor);
    posture.players.find(p => p.id === actor)!.bot = difficulty;
    game = applyAction(game, actor, botActions(posture)[0]);
    game = prepareBetrayalMentatPlans(game);
    assert.equal(game.decision, null);
    assert.equal(game.battle!.preparation, undefined);
    assert.deepEqual(betrayalMentatResources(game), resources);
  }
});
