import assert from 'node:assert/strict';
import { applyAction, type Game } from '../game/engine';
import { leaderSkillBattle } from './leader-skill-battle-fixture';
import { validateLeaderSkills } from '../game/leader-skills';

export function smugglerBattle({ advanced = false, captured = false, amount = 8, hide = true, atreides = false } = {}) {
  const game = leaderSkillBattle({ skill: 'smuggler', territory: 'wind_pass', sector: 14,
    unsealed: true, advanced, captured, hide, atreides,
    ...(captured ? { capturedNativeSkill: 'sandmaster' as const } : {}) });
  game.spice = { 'wind_pass:14': amount };
  // Keep a separate unresolved battle so collection cannot advance the phase
  // before assertions about this battle's own receipt and income.
  for (const player of game.players) { player.forces['carthag:11'] = 1; player.reserves--; }
  return game;
}
export function setOtherSkill(game: Game, skill: 'sandmaster' | 'warmaster', owner = 'd') {
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === owner)!;
  const index = game.leaderSkills!.deck.indexOf(skill);
  assert.ok(index >= 0);
  [assignment.skill, game.leaderSkills!.deck[index]] = [skill, assignment.skill];
  validateLeaderSkills(game.leaderSkills!, game.players);
}
export function revealSmuggler(game: Game, { dial = 4, enemyDial = 0, weapon = null as string | null,
  defense = null as string | null, enemyWeapon = null as string | null, enemyLeader = 'guild-1', kwisatz = false } = {}) {
  const own = game.leaderSkills!.assignments.find(a => a.skill === 'smuggler')!;
  game = applyAction(game, 'a', { type: 'battlePlan', dial, support: game.advanced ? dial : 0,
    leader: own.leader, weapon, defense, kwisatz });
  return applyAction(game, 'd', { type: 'battlePlan', dial: enemyDial, support: game.advanced ? enemyDial : 0,
    leader: enemyLeader, weapon: enemyWeapon });
}
export function finishSmuggler(game: Game, ownCall = false, otherCall = false) {
  game = applyAction(game, 'a', { type: 'traitorCall', call: ownCall });
  return applyAction(game, 'd', { type: 'traitorCall', call: otherCall });
}
