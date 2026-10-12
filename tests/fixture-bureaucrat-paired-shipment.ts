import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  advanceBureaucratPairedFunding, createBureaucratPairedFundingSetup,
  type BureaucratPairedFundingStep,
} from './fixture-bureaucrat-paired-funding';
import { holdPairedSkillsCard } from './fixture-paired-choam-nexus-skills';

export function createBureaucratPairedShipmentFixture({
  advanced = false, primary = 5, donor = 3, ownerFunding = false,
}: { advanced?: boolean; primary?: number; donor?: number; ownerFunding?: boolean } = {}) {
  const setup = createBureaucratPairedFundingSetup(advanced);
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
  game = advanceBureaucratPairedFunding(game, state => state.phase === 5 &&
    state.active === setup.payer && !state.phaseOpening && !state.response && !state.decision, actions);
  assert.equal(game.turn, 2);
  // Exact original six-seat prerequisite after native R/CHOAM auctions,
  // Nexus choices and Revival; no force, wallet or phase staging.
  assert.deepEqual(game.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves, forces: p.forces })), [
    { id: 'b', spice: 26, reserves: 20, forces: {} },
    { id: 'r', spice: 5, reserves: 20, forces: {} },
    { id: 'p', spice: advanced ? 9 : 7, reserves: 10, forces: { 'carthag:11': 10 } },
    { id: 'f', spice: 6, reserves: 10, forces: { 'sietch_tabr:14': 10 } },
    { id: 'e', spice: 10, reserves: 20, forces: {} },
    { id: 'g', spice: advanced ? 6 : 5, reserves: 15, forces: { 'tueks_sietch:5': 5 } },
  ]);
  assert.equal(game.players.find(p => p.id === setup.payer)!.ally, donorId);
  assert.equal(game.players.find(p => p.id === donorId)!.ally, setup.payer);
  const target = 'habbanya_ridge_sietch:17';
  assert.ok(game.players.every(p => !p.forces[target]));
  const sourceSetup = structuredClone(game);
  const karama = holdPairedSkillsCard(game, setup.emperor, card => card.effect === 'karama', staging);
  const beforePledge = structuredClone(game);
  const pledge: Action = { type: 'pledgeAid', amount: donor };
  actions.push({ actor: donorId, action: pledge });
  game = applyAction(game, donorId, pledge);
  assert.equal(game.aid[donorId].amount, donor);
  const beforeAction = structuredClone(game);
  const amount = primary + donor;
  const action: Action = { type: 'ship', territory: 'habbanya_ridge_sietch', sector: 17, amount, allyPayment: donor };
  return { ...setup, donor: donorId, alliance, game, sourceSetup, beforePledge, pledge, beforeAction,
    action, primary, donorAmount: donor, amount, target, karama, responder: setup.emperor, actions, staging };
}

/** Declare once. Only the original Guild interception commits the queued ship. */
export function declareBureaucratPairedShipment(fixture: { beforeAction: Game; payer: string; action: Action }) {
  const actions: BureaucratPairedFundingStep[] = [];
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

/** Allow the actual Karama window, never manufacture an income response. */
export function allowBureaucratPairedShipmentIncome(state: Game) {
  let game = structuredClone(state);
  for (let n = 0; game.response?.kind === 'guildIncome' && n < 12; n++) {
    const actor = game.players.find(p => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    assert.ok(actor, 'Original Karama custody must yield a legal income responder');
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.notEqual(game.response?.kind, 'guildIncome');
  return game;
}
