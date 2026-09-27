import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { leaderSkillBattle } from './leader-skill-battle-fixture';

function losingDiplomat(elite = false, territory = 'arrakeen', sector = 10, stage?: (game: Game) => void): Game {
  let game = leaderSkillBattle({ skill: 'diplomat', unsealed: true, hide: true, elite, territory, sector });
  stage?.(game);
  game = applyAction(game, 'a', { type: 'battlePlan', dial: 0, leader: 'emperor-0' });
  game = applyAction(game, 'd', { type: 'battlePlan', dial: 5, leader: 'guild-1' });
  game = applyAction(game, 'a', { type: 'traitorCall', call: false });
  return applyAction(game, 'd', { type: 'traitorCall', call: false });
}

void test('surviving skilled Diplomat retreats selected undialed ordinary and elite forces, then loses the remainder', () => {
  const pending = losingDiplomat(true);
  const decision = pending.decision;
  assert.equal(decision?.kind, 'diplomatRetreat');
  if (decision?.kind !== 'diplomatRetreat') return;
  assert.ok(decision.destinations[0].choices.some(choice => choice.normal === 2 && choice.elite === 2));
  const destination = decision.destinations[0].location;
  const restored = JSON.parse(JSON.stringify(pending)) as Game;
  assert.deepEqual(viewGame(restored, 'a').decision, decision);
  const resolved = applyAction(restored, 'a', {
    type: 'decision', event: decision.event, destination, normal: 2, elite: 2,
  });
  const owner = resolved.players.find(player => player.id === 'a')!;
  assert.equal(owner.forces[destination], 4);
  assert.equal(owner.elites?.forces[destination], 2);
  assert.equal(owner.forces['arrakeen:10'], undefined);
  assert.equal(owner.tanks, 1);
  assert.equal(owner.elites?.tanks, 0);
  assert.equal(resolved.phase, 7);
  assert.equal(resolved.battle, null);
  assert.equal(resolved.decision, null);
  assert.match(JSON.stringify(resolved.log), /retreated 2 normal and 2 elite/);
});

void test('Diplomat may retreat through another safe sector of its battle territory to a true adjacent territory', () => {
  const pending = losingDiplomat(false, 'imperial_basin', 9);
  const decision = pending.decision;
  assert.equal(decision?.kind, 'diplomatRetreat');
  if (decision?.kind !== 'diplomatRetreat') return;
  assert.ok(decision.destinations.some(option => option.location === 'arsunt:11'));
  const resolved = applyAction(pending, 'a', {
    type: 'decision', event: decision.event, destination: 'arsunt:11', normal: 2, elite: 0,
  });
  assert.equal(resolved.players[0].forces['arsunt:11'], 2);
  assert.equal(resolved.players[0].tanks, 3);
});

void test('split sectors cannot retreat counters from an origin blocked by the storm', () => {
  const pending = losingDiplomat(false, 'imperial_basin', 9, game => {
    game.players[0].forces = { 'imperial_basin:9': 2, 'imperial_basin:10': 3 };
    game.storm = 10;
  });
  const decision = pending.decision;
  assert.equal(decision?.kind, 'diplomatRetreat');
  if (decision?.kind !== 'diplomatRetreat') return;
  const exit = decision.destinations.find(option => option.location === 'oh_gap:9');
  if (!exit) throw new Error('Expected an adjacent retreat exit');
  assert.ok(exit.choices.some(choice => choice.normal === 2 && choice.elite === 0));
  assert.equal(exit.choices.some(choice => choice.normal === 3 && choice.elite === 0), false);
  assert.throws(() => applyAction(pending, 'a', {
    type: 'decision', event: decision.event, destination: exit.location, normal: 3, elite: 0,
  }));
  const resolved = applyAction(pending, 'a', {
    type: 'decision', event: decision.event, destination: exit.location, normal: 2, elite: 0,
  });
  assert.equal(resolved.players[0].forces['oh_gap:9'], 2);
  assert.equal(resolved.players[0].tanks, 3);
});

void test('a legacy battle without retreat version resolves without a retroactive choice', () => {
  const resolved = losingDiplomat(false, 'arrakeen', 10, game => {
    if (game.battle) delete game.battle.diplomatRetreatVersion;
  });
  assert.notEqual(resolved.decision?.kind, 'diplomatRetreat');
  assert.equal(resolved.players[0].forces['arrakeen:10'], undefined);
  assert.equal(resolved.players[0].tanks, 5);
  assert.equal(resolved.phase, 7);
});

void test('Diplomat retreat rejects stale or impossible destinations and counts without mutating the pending game', () => {
  const pending = losingDiplomat();
  const decision = pending.decision;
  assert.equal(decision?.kind, 'diplomatRetreat');
  if (decision?.kind !== 'diplomatRetreat') return;
  const before = JSON.stringify(pending);
  for (const action of [
    { type: 'decision', event: 'stale', destination: decision.destinations[0].location, normal: 1, elite: 0 },
    { type: 'decision', event: decision.event, destination: 'arrakeen:10', normal: 1, elite: 0 },
    { type: 'decision', event: decision.event, destination: decision.destinations[0].location, normal: 6, elite: 0 },
    { type: 'decision', event: decision.event, destination: null, normal: 1, elite: 0 },
  ]) {
    assert.throws(() => applyAction(pending, 'a', action));
    assert.equal(JSON.stringify(pending), before);
  }
  assert.throws(() => applyAction(pending, 'd', {
    type: 'decision', event: decision.event, destination: null, normal: 0, elite: 0,
  }));
  const declined = applyAction(pending, 'a', {
    type: 'decision', event: decision.event, destination: null, normal: 0, elite: 0,
  });
  assert.equal(declined.players[0].forces['arrakeen:10'], undefined);
  assert.equal(declined.players[0].tanks, 5);
  assert.equal(declined.phase, 7);
});

void test('a dead Diplomat has no retreat even when its faction loses', () => {
  let game = leaderSkillBattle({ skill: 'diplomat', unsealed: true, hide: true, weaponKills: true });
  const weapon = game.players[1].hand.find(card => card.kind === 'projectile')!;
  game = applyAction(game, 'a', { type: 'battlePlan', dial: 0, leader: 'emperor-0' });
  game = applyAction(game, 'd', { type: 'battlePlan', dial: 5, leader: 'guild-1', weapon: weapon.id });
  game = applyAction(game, 'a', { type: 'traitorCall', call: false });
  game = applyAction(game, 'd', { type: 'traitorCall', call: false });
  assert.notEqual(game.decision?.kind, 'diplomatRetreat');
  assert.equal(game.players[0].forces['arrakeen:10'], undefined);
});
