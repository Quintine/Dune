import assert from 'node:assert/strict';
import { applyAction } from '../game/engine';
import { JACURUTU_SIETCH } from '../game/discoveries';
import { discoveryFixture, putDiscovery } from './fixture-discovery';

export function discoveryBattleBeforeFinalVote(
  advanced = false,
  ids: [string, string, string] = ['a', 'g', 'f'],
  attackerTraitor = false,
) {
  let game = discoveryFixture(advanced, ids);
  const attacker = game.players[0];
  const defender = game.players[1];
  const token = putDiscovery(game, 'jacurutu-sietch');
  token.revealedTurn = game.turn;
  for (const player of game.players) {
    player.forces = {};
    player.reserves = 20;
    player.tanks = 0;
    player.spice = 20;
    player.hand = [];
    player.traitors = [];
    for (const leader of player.leaders) leader.strength = 0;
  }
  attacker.forces[`${JACURUTU_SIETCH}:0`] = 5;
  attacker.reserves = 15;
  defender.forces[`${JACURUTU_SIETCH}:0`] = 5;
  defender.reserves = 15;
  attacker.leaders[0].strength = 5;
  defender.leaders[0].strength = 1;
  if (attackerTraitor) attacker.traitors = [defender.leaders[0].id];
  Object.assign(game, {
    phase: 6,
    active: attacker.id,
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
    battle: null,
    lastBattle: [],
    lastBattleContext: undefined,
    storm: 18,
  });
  game = applyAction(game, attacker.id, {
    type: 'chooseBattle',
    territory: JACURUTU_SIETCH,
    target: defender.id,
  });
  for (const id of [attacker.id, defender.id])
    if (game.battle?.preLeader && !game.battle.preLeader.ready.includes(id))
      game = applyAction(game, id, {
        type: 'battlePreparationReady',
        event: game.battle.event,
      });
  for (
    let step = 0;
    step < 30 && (game.response || game.battle?.preparation);
    step++
  ) {
    if (game.response)
      game = applyAction(
        game,
        game.players.find(
          (player) => !game.response!.passed.includes(player.id),
        )!.id,
        { type: 'passResponse' },
      );
    else
      game = applyAction(game, game.battle!.preparation!.owner, {
        type: 'declineBattlePower',
      });
  }
  assert.equal(game.response, null);
  assert.equal(game.battle?.preparation, undefined);
  if (game.decision?.kind === 'fullPlanOffer')
    game = applyAction(game, game.decision.player, {
      type: 'decision',
      decline: true,
    });
  game = applyAction(game, attacker.id, {
    type: 'battlePlan',
    dial: 1,
    support: advanced ? 1 : 0,
    leader: attacker.leaders[0].id,
  });
  game = applyAction(game, defender.id, {
    type: 'battlePlan',
    dial: 2,
    support: advanced ? 2 : 0,
    leader: defender.leaders[0].id,
  });
  game = applyAction(game, attacker.id, {
    type: 'traitorCall',
    call: attackerTraitor,
  });
  return { game, attacker: attacker.id, defender: defender.id };
}
