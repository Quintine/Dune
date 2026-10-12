import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  advanceBureaucratQualifyingSplit, createBureaucratQualifyingSplitSetup,
  type BureaucratQualifyingSplitStep,
} from './fixture-bureaucrat-qualifying-split';

export interface BureaucratQualifyingShipmentDeclaration {
  beforeAction: Game;
  payer: string;
  action: Action;
}

export function createBureaucratQualifyingShipmentFixture({
  advanced = false, primary = 5, donor = 3, ownerFunding = false,
}: { advanced?: boolean; primary?: number; donor?: number; ownerFunding?: boolean } = {}) {
  const setup = createBureaucratQualifyingSplitSetup(advanced);
  const allianceIndex = setup.actions.findIndex(step => step.action.type === 'alliance');
  const actions = ownerFunding ? setup.actions.slice(0, allianceIndex) : [...setup.actions];
  const staging = [...setup.staging];
  const donorId = ownerFunding ? setup.trainer : setup.donor;
  let game = structuredClone(ownerFunding ? setup.worm : setup.game);
  if (ownerFunding) {
    for (const [actor, target] of [[setup.payer, donorId], [donorId, setup.payer]]) {
      const action: Action = { type: 'alliance', target };
      actions.push({ actor, action });
      game = applyAction(game, actor, action);
    }
  }
  const alliance = ownerFunding ? structuredClone(game) : setup.alliance;
  game = advanceBureaucratQualifyingSplit(game, state => state.phase === 5 &&
    state.active === setup.payer && !state.phaseOpening && !state.response && !state.decision, actions);
  assert.equal(game.turn, 2);
  const sourceSetup = structuredClone(game);
  const sourceArmy = structuredClone(game.players.find(p => p.id === setup.payer)!);
  assert.equal(sourceArmy.reserves, 10);
  assert.deepEqual(sourceArmy.forces, { 'carthag:11': 10 });
  assert.ok(game.players.every(p => !p.forces['habbanya_ridge_sietch:17']));
  assert.equal(game.players.find(p => p.id === setup.donor)!.spice, 6);
  assert.equal(game.players.find(p => p.id === setup.guild)!.spice, advanced ? 6 : 5);

  // Keep the original singleton in physical custody so the original income
  // cancellation window is exercised, rather than manufacturing a response.
  const responder = game.players.find(p => p.id === setup.emperor)!;
  let karama = responder.hand.find(card => card.effect === 'karama');
  if (!karama) {
    const index = game.deck.findIndex(card => card.effect === 'karama');
    assert.ok(index >= 0);
    karama = game.deck.splice(index, 1)[0];
    responder.hand.push(karama);
    staging.push(`Conserved original ${karama.id}: undealt deck to Emperor hand for native income cancellation.`);
  }
  const beforePledge = structuredClone(game);
  const pledge: Action = { type: 'pledgeAid', amount: donor };
  actions.push({ actor: donorId, action: pledge });
  game = applyAction(game, donorId, pledge);
  const beforeAction = structuredClone(game);
  const amount = primary + donor;
  const action: Action = { type: 'ship', territory: 'habbanya_ridge_sietch', sector: 17, amount, allyPayment: donor };
  assert.equal(game.aid[donorId].amount, donor);
  return { ...setup, donor: donorId, alliance, game, sourceSetup, sourceArmy, beforePledge, pledge, beforeAction,
    action, primary, donorAmount: donor, amount, target: 'habbanya_ridge_sietch:17',
    karama, responder: responder.id, actions, staging };
}

/** Declare once; the original Guild interception, when present, commits it. */
export function declareBureaucratQualifyingShipment(
  fixture: BureaucratQualifyingShipmentDeclaration,
) {
  const actions: BureaucratQualifyingSplitStep[] = [];
  let game = applyAction(structuredClone(fixture.beforeAction), fixture.payer, fixture.action);
  actions.push({ actor: fixture.payer, action: fixture.action });
  const declared = structuredClone(game);
  if (game.decision?.kind === 'guildShipment') {
    const actor = game.decision.player;
    const action: Action = { type: 'decision', allow: true };
    actions.push({ actor, action });
    game = applyAction(game, actor, action);
  }
  return { game, declared, paid: structuredClone(game), actions };
}

/** Pass only original legal Karama responders; stop at the owner choice. */
export function allowBureaucratQualifyingShipmentIncome(state: Game) {
  let game = structuredClone(state);
  for (let n = 0; game.response?.kind === 'guildIncome' && n < 12; n++) {
    const actor = game.players.find(p => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    assert.ok(actor, 'The conserved Karama must retain its original income response');
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.notEqual(game.response?.kind, 'guildIncome');
  return game;
}
