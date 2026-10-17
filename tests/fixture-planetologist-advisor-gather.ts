import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { gameTerritories, location } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { botGroundMoveAllowed } from '../game/bot-mobility';
import { createSelectedDeckSkillsSetup } from './fixture-selected-deck-skills';
import { nextHarassHomeworldStep, harassHomeworldClean } from './fixture-harass-homeworld';

export type AdvisorGatherStep = { actor: string; action: Action };
export const advisorGatherPlayer = (game: Game, actor = 'beneGesserit') => {
  const player = game.players.find(player => player.id === actor);
  assert.ok(player); return player;
};

/** Original normal lobby and native actions only. The lottery selects an actual
 * offered Planetologist; no counters, posture, money, phases or usage is staged.
 * The only conserved card input is one explicitly labelled original Karama. */
export function createPlanetologistAdvisorGatherFixture(options: { fresh?: boolean } = {}) {
  const setup = createSelectedDeckSkillsSetup({ advanced: true,
    factions: ['beneGesserit', 'emperor', 'atreides'], expansions: [], skill: 'planetologist' });
  let game = structuredClone(setup.afterSetup);
  const actions: AdvisorGatherStep[] = [...setup.actions], staging = [...setup.staging];
  const owner = 'beneGesserit', canceler = 'emperor', opponent = 'atreides';
  const targetTurn = options.fresh ? 1 : 2;
  const until = () => game.turn === targetTurn && game.phase === 5 && game.active === owner &&
    harassHomeworldClean(game) && (!options.fresh || advisorGatherPlayer(game).shipped);
  for (let count = 0; count < 600 && !until(); count++) {
    assert.equal(game.status, 'playing');
    let step: AdvisorGatherStep | null = null;
    const decision = !game.response && !game.phaseOpening ? game.decision : null;
    if (decision?.kind === 'advisor') {
      const accompany = game.turn === 1 && decision.shipment === canceler;
      step = { actor: decision.player, action: accompany
        ? { type: 'decision', accept: true, accompany: true, sector: 9, amount: 1 }
        : { type: 'decision', accept: false } };
    } else if (decision?.kind === 'advisorBattle') {
      step = { actor: decision.player, action: { type: 'decision', accept: false } };
    } else if (game.turn === 1 && game.phase === 5 && harassHomeworldClean(game)) {
      const actor = game.active!, player = advisorGatherPlayer(game, actor);
      if (actor === owner && !player.shipped)
        step = { actor, action: { type: 'ship', territory: 'carthag', sector: 11,
          amount: 1, elite: 0, allyPayment: 0 } };
      else if (actor === canceler && !player.shipped)
        step = { actor, action: { type: 'ship', territory: 'imperial_basin', sector: 9,
          amount: 1, elite: 0, allyPayment: 0 } };
      else if (actor === opponent && !player.moved) {
        const view = viewGame(game, actor), own = view.players.find(player => player.id === actor)!;
        let destination: { territory: string; sector: number } | null = null;
        for (const territory of gameTerritories(game)) {
          if (territory.type !== 'rock' || game.players.some(player => presenceAt(player, territory.id))) continue;
          const sector = territory.sectors.find(sector =>
            botGroundMoveAllowed(view, own, 'arrakeen:10', location(territory.id, sector), 0));
          if (sector !== undefined) { destination = { territory: territory.id, sector }; break; }
        }
        assert.ok(destination, 'The original Atreides army keeps one defender and moves nine to empty rock');
        step = { actor, action: { type: 'move', from: 'arrakeen:10', amount: 9, ...destination } };
      }
    }
    step ??= nextHarassHomeworldStep(game);
    assert.ok(step, `The native gather chronology needs a legal action at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    if (game.turn === 1 && step.action.type === 'stormDial')
      step.action.amount = options.fresh && step.actor === owner ? 2 : 0;
    actions.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  }
  assert.ok(until(), 'Reach the original BG movement turn with both physical source groups');
  const me = advisorGatherPlayer(game);
  assert.equal(me.forces['carthag:11'], 1);
  assert.equal(me.forces['imperial_basin:9'], 1);
  assert.equal(me.advisors?.imperial_basin.lockedTurn, 1);
  assert.equal(advisorGatherPlayer(game, opponent).forces['arrakeen:10'], 1);
  let karama = advisorGatherPlayer(game, canceler).hand.find(card => card.effect === 'karama');
  if (!karama) {
    const index = game.deck.findIndex(card => card.effect === 'karama');
    assert.ok(index >= 0, 'A conserved original Karama must remain in the ordinary deck');
    assert.ok(advisorGatherPlayer(game, canceler).hand.length < 4);
    karama = game.deck.splice(index, 1)[0];
    advisorGatherPlayer(game, canceler).hand.push(karama);
    staging.push(`Conserved ${karama.id}: original deck → Emperor hand; not a purchase or new card`);
  }
  const forces = { 'carthag:11': 1, 'imperial_basin:9': 1 };
  const action: Action = { type: 'move', planetologist: 'gather', fighters: true,
    forces, territory: 'arrakeen', sector: 10 };
  return { initial: setup.initial, afterSetup: setup.afterSetup, game, owner, canceler, opponent,
    forces, action, karama: karama.id, actions, staging };
}

/** The normal native response, including automatic passes, not a forced flip. */
export function allowPlanetologistAdvisorGather(game: Game): Game {
  let state = structuredClone(game);
  for (let count = 0; state.response && count < 12; count++) {
    assert.equal(state.response.kind, 'advisorFlip');
    const actor = state.players.find(player => !state.response!.passed.includes(player.id));
    assert.ok(actor);
    state = applyAction(state, actor.id, { type: 'passResponse' });
  }
  assert.equal(state.response, null);
  return state;
}
