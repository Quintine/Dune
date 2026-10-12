import assert from 'node:assert/strict';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { choamPowerAction, choamPowerPlays } from '../game/choam-power-options';
import { advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep,
  holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import { createSemutaHomeworldChoamMovementFixture,
  allowSemutaHomeworldChoamMovement } from './fixture-semuta-homeworld-choam-movement';
import { moveSemutaEmperorCard, semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldChoamStormFixture = {
  setup: Game; beforeShipment: Game; afterShipment: Game; beforeWeather: Game;
  afterWeather: Game; game: Game; owner: string; holder: string; target: string;
  canceller: string; weatherOwner: string; weatherCard: string; retainedKulon: string;
  card: string; source: 'printed'; territory: string; origin: string;
  action: Action; weatherAction: Action; weatherAmount: number; shipment: Action;
  participants: string[]; actions: RicheseSkillsTechStep[]; staging: string[];
};
const clean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.pendingTreacheryDiscard;

/** Paid original reserves shipment, original first-turn suffix, then actual
 * Weather Control and native Storm readiness. No force or clock is assigned. */
export function createSemutaHomeworldChoamStormFixture(
  advanced = false, fullHolder = false,
): SemutaHomeworldChoamStormFixture {
  const prefix = createSemutaHomeworldChoamMovementFixture('kulon', advanced, false);
  let game = structuredClone(prefix.afterShipment);
  const actions = [...prefix.actions], staging = [...prefix.staging];
  const owner = prefix.owner, holder = prefix.holder;
  const weatherPlayer = game.players.find(player => player.faction === 'atreides');
  assert.ok(weatherPlayer, 'The original setup supplies the other Weather seat');
  const weatherOwner = weatherPlayer.id;
  assert.notEqual(weatherOwner, owner);
  const card = holdSemutaHomeworldChoamCard(game, owner, 'Jubba Cloak');
  const weatherCard = holdSemutaHomeworldChoamCard(game, weatherOwner, 'Weather Control');
  staging.push('Conserved original Jubba Cloak to CHOAM and Weather Control to Atreides; Kulon remains unplayed.');
  for (const player of game.players) assert.ok(player.hand.length <= handLimit(player));
  game = advanceSemutaHomeworldChoam(game,
    state => state.turn === 2 && state.phase === 0 && clean(state), actions);
  assert.equal(semutaEmperorPlayer(game, owner).forces[prefix.origin], 1);
  assert.ok(semutaEmperorPlayer(game, owner).hand.some(held => held.id === prefix.card));
  const beforeWeather = structuredClone(game);
  const amount = (7 - game.storm + 18) % 18;
  assert.ok(amount >= 0 && amount <= 10, 'Original Weather dial can reach the shipped counter');
  const weatherAction: Action = { type: 'card', card: weatherCard, amount };
  game = applySemutaHomeworldChoamStep(game, weatherOwner, weatherAction, actions);
  game = advanceSemutaHomeworldChoam(game, state => clean(state), actions);
  const afterWeather = structuredClone(game);
  assert.equal(game.stormPending, amount);
  assert.equal(game.stormMovementSource?.kind, 'weather');
  game = advanceSemutaHomeworldChoam(game,
    state => state.decision?.kind === 'choamStorm' && state.decision.player === owner, actions);
  assert.equal(game.turn, 2);
  assert.equal(game.phase, 0);
  assert.equal(game.storm, beforeWeather.storm);
  assert.equal(semutaEmperorPlayer(game, owner).forces[prefix.origin], 1);
  if (fullHolder) {
    const player = semutaEmperorPlayer(game, holder);
    while (player.hand.length < handLimit(player)) {
      assert.ok(game.deck[0]);
      moveSemutaEmperorCard(game, game.deck[0].id, holder);
    }
    staging.push('Conserved original undealt cards fill Richese to its native hand limit.');
  }
  const view = viewGame(game, owner);
  const printed = choamPowerPlays(view, 'jubba').find(play => play.source === 'printed' && play.card.id === card);
  assert.ok(printed);
  const territory = 'red_chasm';
  const action = choamPowerAction(view, printed, { territory });
  assert.ok(action);
  return { setup: prefix.setup, beforeShipment: prefix.beforeShipment,
    afterShipment: prefix.afterShipment, beforeWeather, afterWeather, game,
    owner, holder, target: owner, canceller: prefix.canceller, weatherOwner, weatherCard,
    retainedKulon: prefix.card, card, source: 'printed', territory, origin: prefix.origin,
    action, weatherAction, weatherAmount: amount, shipment: prefix.shipment,
    participants: game.players.map(player => player.id), actions, staging };
}

/** Declare the canonical printed power and pass only real Karama controls. */
export function disposeSemutaHomeworldChoamStorm(
  fixture: SemutaHomeworldChoamStormFixture, state = fixture.game,
  actions?: RicheseSkillsTechStep[],
): Game {
  return allowSemutaHomeworldChoamMovement(
    applySemutaHomeworldChoamStep(state, fixture.owner, fixture.action, actions), actions);
}

/** Finish the original Storm's CHOAM market and opening controls, not a new turn. */
export function finishSemutaHomeworldChoamStorm(
  state: Game, actions?: RicheseSkillsTechStep[],
): Game {
  const game = advanceSemutaHomeworldChoam(state,
    current => current.phase === 1 && clean(current), actions);
  assert.equal(game.turn, 2);
  return game;
}
