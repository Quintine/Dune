import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { initializeClassicNexusSkillsPaymentsSetup, nextClassicNexusSkillsPaymentsNativeStep } from './fixture-classic-nexus-skills-payments';

/** Original skill offers/setup and actual turn-two worm alliance. Conserved
 * starting counters are staged into reserves to isolate payment, not combat.
 * Wallets, alliances, clocks and payment records are never assigned. */
export function createBureaucratSplitThresholdFixture(advanced = false) {
  const lobby = createGame('BUREAUCRATTHRESHOLD', newPlayer('b', 'Bureaucrat', 'atreides'), advanced);
  for (const [id, faction] of [['p', 'harkonnen'], ['f', 'fremen'], ['e', 'emperor'], ['g', 'guild']] as const)
    joinGame(lobby, newPlayer(id, faction, faction));
  let game = initializeClassicNexusSkillsPaymentsSetup({ initial: lobby, skill: 'bureaucrat' });
  const actions: { actor: string; action: Action }[] = [];
  const step = () => {
    const next = nextClassicNexusSkillsPaymentsNativeStep(game);
    assert.ok(next, `Native payment setup/progression stalled at ${game.phase}/${game.setupStage}`);
    actions.push(next);
    game = applyAction(game, next.actor, next.action);
  };
  for (let n = 0; game.status === 'setup' && n < 240; n++) step();
  assert.equal(game.status, 'playing');
  assert.ok(game.leaderSkills!.assignments.some(a => a.owner === 'b' && a.skill === 'bureaucrat'));
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((a, b) => a + b, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((a, b) => a + b, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
  }
  const orderSpice = (kinds: ('land' | 'worm')[]) => {
    const front = kinds.map(kind => {
      const index = game.spiceDeck.findIndex(card => kind === 'land' ? 'territory' in card : 'worm' in card);
      assert.ok(index >= 0);
      return game.spiceDeck.splice(index, 1)[0];
    });
    game.spiceDeck.unshift(...front);
  };
  orderSpice(['land', 'land']);
  for (let n = 0; !(game.turn === 2 && game.phase === 1) && n < 1800; n++) step();
  assert.equal(game.turn, 2); assert.equal(game.phase, 1);
  orderSpice(['worm', 'land', 'land']);
  let allied = false;
  for (let n = 0; !(allied && game.phase === 3 && game.auction && !game.phaseOpening && !game.response && !game.decision) && n < 600; n++) {
    if (game.nexus && !game.phaseOpening && !game.response && !game.decision && !game.spiceWindow && !allied) {
      for (const [actor, target] of [['p', 'f'], ['f', 'p']]) {
        const action: Action = { type: 'alliance', target };
        actions.push({ actor, action }); game = applyAction(game, actor, action);
      }
      allied = true;
    } else step();
  }
  assert.ok(allied && game.auction);
  assert.equal(game.players.find(p => p.id === 'p')!.ally, 'f');
  assert.equal(game.players.find(p => p.id === 'f')!.ally, 'p');
  return { game, actions, payer: 'p', donor: 'f', trainer: 'b', guild: 'g', emperor: 'e' };
}

export function advanceBureaucratThresholdToMovement(state: Game, actor: string): Game {
  let game = state;
  for (let n = 0; !(game.phase === 5 && game.active === actor && !game.phaseOpening && !game.response && !game.decision) && n < 600; n++) {
    const next = nextClassicNexusSkillsPaymentsNativeStep(game);
    assert.ok(next, 'Native payment continuation stalled');
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.phase, 5); assert.equal(game.active, actor);
  return game;
}
