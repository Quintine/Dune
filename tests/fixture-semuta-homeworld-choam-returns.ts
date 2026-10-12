import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { choamPowerAction, choamPowerPlays } from '../game/choam-power-options';
import { biddingPhysicalIds } from './fixture-homeworld-occupied-bidding';
import { semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import {
  advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep,
  createSemutaHomeworldChoamSetup, holdSemutaHomeworldChoamCard,
} from './fixture-semuta-homeworld-choam';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldChoamReturnPower = 'laLaLa' | 'gamont';
export type SemutaHomeworldChoamReturnsFixture = {
  game: Game;
  setup: Game;
  owner: string;
  holder: string;
  target: string;
  card: string;
  power: SemutaHomeworldChoamReturnPower;
  action: Action;
  from: string;
  actions: RicheseSkillsTechStep[];
  originalCards: string[];
};

/** Original native setup, first Revival or closing Mentat, no assigned clocks,
 * wallets, Tanks, force positions or Homeworld custody. The selected Atreides
 * counter is still on its original starting board sector. Only the two physical
 * card positions (Semuta and the printed power) are conserved staging. */
export function createSemutaHomeworldChoamReturnsFixture(
  power: SemutaHomeworldChoamReturnPower, advanced = false,
): SemutaHomeworldChoamReturnsFixture {
  const native = createSemutaHomeworldChoamSetup(advanced);
  const { owner, holder, target, actions } = native;
  let game = native.game;
  const card = holdSemutaHomeworldChoamCard(game, owner,
    power === 'laLaLa' ? 'La La La' : 'Trip to Gamont');
  const setup = structuredClone(game);
  const originalCards = biddingPhysicalIds(game);
  const from = Object.keys(semutaEmperorPlayer(setup, target).forces)[0];
  assert.ok(from, 'The original Atreides setup has an on-board force');
  game = advanceSemutaHomeworldChoam(game, state => power === 'laLaLa'
    ? state.phase === 4 && !state.phaseOpening && !state.response && !state.decision && !state.pendingTreacheryDiscard
    : state.decision?.kind === 'choamMentat', actions);
  assert.equal(game.turn, setup.turn, 'Never advance to a replacement source turn');
  assert.equal(game.phase, power === 'laLaLa' ? 4 : 8);
  assert.deepEqual(semutaEmperorPlayer(game, target).forces,
    semutaEmperorPlayer(setup, target).forces, 'The recalled force is original, not a staged shipment or casualty');
  assert.deepEqual(biddingPhysicalIds(game), originalCards);
  if (power === 'gamont') {
    assert.equal(game.decision!.player, owner);
    assert.equal(game.choamMentatPending, true);
  }
  const view = viewGame(game, owner);
  const play = choamPowerPlays(view, power).find(play => play.source === 'printed' && play.card.id === card);
  assert.ok(play);
  const action = choamPowerAction(view, play, { target, ...(power === 'gamont' ? { from, elite: 0 } : {}) });
  assert.ok(action, 'The original private controls admit the printed power');
  return { game, setup, owner, holder, target, card, power, action, from, actions, originalCards };
}

/** Complete the real Karama response queue, stopping at the cost offer. */
export function playSemutaHomeworldChoamReturns(
  fixture: SemutaHomeworldChoamReturnsFixture, state = fixture.game,
): Game {
  let game = applySemutaHomeworldChoamStep(state, fixture.owner, fixture.action);
  for (let n = 0; game.response?.kind === 'choamWorthless' && n < game.players.length; n++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id))!.id;
    game = applyAction(game, actor, { type: 'passResponse' });
  }
  assert.notEqual(game.response?.kind, 'choamWorthless');
  return game;
}

export function semutaHomeworldChoamReturnsForces(game: Game) {
  const worlds = viewGame(game, game.host).homeworlds!.worlds!;
  return game.players.map(player => {
    const away = worlds.filter(home => home.native !== player.id)
      .map(home => home.forces[player.id]).filter(Boolean);
    return {
      id: player.id,
      total: player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0)
        + away.reduce((sum, group) => sum + group.normal + group.elite, 0),
      elite: (player.elites?.reserves ?? 0) + (player.elites?.tanks ?? 0)
        + Object.values(player.elites?.forces ?? {}).reduce((sum, n) => sum + n, 0)
        + away.reduce((sum, group) => sum + group.elite, 0),
    };
  });
}
