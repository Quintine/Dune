import assert from 'node:assert/strict';
import { applyAction, type Action, type Game } from '../game/engine';
import {
  assertChoamSkillsCustody,
  choamSkillsPlayer,
  completedChoamSkillsGame,
  reloadChoamSkillsGame,
} from './choam-skills-fixture';

export const actChoamGhola = (game: Game, owner: string, action: Action): Game =>
  reloadChoamSkillsGame(applyAction(reloadChoamSkillsGame(game), owner, action));

export function passChoamGholaResponses(game: Game): Game {
  for (let step = 0; game.response && step < 20; step++) {
    const player = game.players.find(candidate => !game.response!.passed.includes(candidate.id));
    assert.ok(player);
    game = actChoamGhola(game, player.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}

/** Genuine setup, conserved staged positions, then an actual lethal battle and phase-end sale. */
export function stagedMarketGhola(
  initial = completedChoamSkillsGame({ requestedSkill: 'warmaster' }),
  keepAssignedSkill = false,
) {
  let game = reloadChoamSkillsGame(initial);
  const owner = game.players.find(player => player.faction === 'choam')!.id;
  const opponent = game.players.find(player => player.faction === 'emperor')!.id;
  const assignment = game.leaderSkills!.assignments.find(candidate => candidate.owner === owner)!;
  assert.equal(assignment.skill, 'warmaster');
  const leader = keepAssignedSkill
    ? choamSkillsPlayer(game, owner).leaders.find(candidate => candidate.id !== assignment.leader)!.id
    : assignment.leader;
  const lostSkill = assignment.skill;
  for (const player of game.players) {
    game.deck.push(...player.hand);
    player.hand = [];
    player.forces = [owner, opponent].includes(player.id) ? { 'wind_pass:14': 8 } : {};
    player.reserves = [owner, opponent].includes(player.id) ? 12 : 20;
    player.tanks = 0;
    player.battleLosses = 0;
    player.spice = 20;
  }
  Object.assign(game, { phase: 6, active: owner, storm: 18, ready: [],
    order: [owner, opponent, ...game.players.map(player => player.id).filter(id => ![owner, opponent].includes(id))],
    decision: null, response: null, phaseOpening: null, spice: {} });
  const take = (id: string, predicate: (card: Game['deck'][number]) => boolean) => {
    const index = game.deck.findIndex(predicate);
    assert.ok(index >= 0);
    const card = game.deck.splice(index, 1)[0];
    choamSkillsPlayer(game, id).hand.push(card);
    return card.id;
  };
  const ghola = take(owner, card => card.effect === 'ghola');
  const sale = take(owner, card => card.kind === 'worthless');
  const poison = take(opponent, card => card.kind === 'poison');
  const karama = take(opponent, card => card.effect === 'karama');
  assertChoamSkillsCustody(game);
  game = actChoamGhola(game, owner, { type: 'chooseBattle', territory: 'wind_pass', target: opponent });
  for (let step = 0; step < 30; step++) {
    if (game.response) game = passChoamGholaResponses(game);
    else if (game.decision?.kind === 'leaderSkillVisibility')
      game = actChoamGhola(game, game.decision.player, { type: 'leaderSkillVisibility', event: game.decision.event, hide: true });
    else if (game.battle?.preparation)
      game = actChoamGhola(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
    else break;
  }
  assert.equal(game.decision, null);
  assert.equal(game.battle?.preparation, undefined);
  game = actChoamGhola(game, owner, { type: 'battlePlan', dial: 0, leader });
  const opponentLeader = choamSkillsPlayer(game, opponent).leaders.find(candidate =>
    !candidate.dead && !game.leaderSkills!.assignments.some(skill => skill.leader === candidate.id))!;
  game = actChoamGhola(game, opponent, { type: 'battlePlan', dial: 4, leader: opponentLeader.id, weapon: poison });
  game = actChoamGhola(game, owner, { type: 'traitorCall', call: false });
  game = actChoamGhola(game, opponent, { type: 'traitorCall', call: false });
  assert.equal(game.decision?.kind, 'battleCards');
  game = actChoamGhola(game, opponent, { type: 'decision', discard: [] });
  assert.equal(choamSkillsPlayer(game, owner).leaders.find(candidate => candidate.id === leader)!.dead, true);
  assert.equal(game.leaderSkills!.assignments.some(candidate => candidate.owner === owner), keepAssignedSkill);
  assert.equal(game.leaderSkills!.deck.filter(skill => skill === lostSkill).length, keepAssignedSkill ? 0 : 1);
  assert.equal(game.phase, 6);
  assert.equal(game.decision?.kind, 'choamMarket');
  game = actChoamGhola(game, owner, { type: 'decision', mode: 'sell', card: sale });
  assert.equal(game.response?.kind, 'choamSale');
  assertChoamSkillsCustody(game);
  return { game, owner, opponent, leader, ghola, sale, karama, lostSkill };
}
