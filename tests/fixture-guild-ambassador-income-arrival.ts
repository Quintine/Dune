import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import {
  advancePairedE3Nexus, createPairedE3NexusSetup, nextPairedE3NexusStep,
  pairedE3NexusClean, pairedE3NexusInventory, pairedE3NexusPlayer,
  pairedE3NexusReload, quietPairedE3NexusChoice, stepPairedE3Nexus,
  type PairedE3NexusStep, type PairedE3NexusTransition,
} from './fixture-paired-e3-nexus-modules';
import { orderE3NexusEcazSpice } from './fixture-e3-nexus-ecaz';
import { quietPlan } from './fixture-nexus-duke-capture';


/** Original Advanced Ecaz/Moritani/Guild, without optional physical modules.
 * The shared setup selects only original undealt entropy. Here the original
 * unplayed Treachery deck puts a Karama in the first real auction; Ecaz buys
 * that physical card for one spice. Only the conserved, unplayed Spice deck
 * is ordered for land blows on turn one and an actual Nexus on turn two.
 * No hand, wallet, army, leader, phase, alliance or response is staged.
 *
 * A one-force stronghold arrival has no rounded native-rate discount to
 * cancel (half/full both cost one). Larger native shipments retain the
 * separate prepayment rate window before this fixture's income path. */
export function createGuildAmbassadorIncomeArrival() {
  const setup = createPairedE3NexusSetup({ roster: ['ecaz', 'moritani', 'guild'],
    advanced: true, skills: false, homeworlds: false, discovery: false,
    tech: false, strongholds: false });
  const actions = setup.actions;
  const ecaz = setup.ecaz, entrant = setup.moritani;
  const guild = setup.afterSetup.players.find(p => p.faction === 'guild')!.id;
  let game = pairedE3NexusReload(setup.afterSetup);
  const karamaIndex = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karamaIndex >= 0);
  const karama = game.deck.splice(karamaIndex, 1)[0];
  game.deck.unshift(karama);
  orderE3NexusEcazSpice(game);
  game = advancePairedE3Nexus(game, s => s.phase === 3 && pairedE3NexusClean(s) &&
    s.auction?.active === ecaz && s.auction.index === 0, actions, quietPairedE3NexusChoice);
  const purchaseBefore = pairedE3NexusReload(game);
  const bid: PairedE3NexusStep = { actor: ecaz, action: { type: 'bid', amount: 1 } };
  game = stepPairedE3Nexus(game, bid, actions);
  game = advancePairedE3Nexus(game, s => pairedE3NexusPlayer(s, ecaz).hand.some(c => c.id === karama.id) &&
    pairedE3NexusClean(s), actions, quietPairedE3NexusChoice);
  const purchase = { before: purchaseBefore, step: bid, after: pairedE3NexusReload(game) };
  game = advancePairedE3Nexus(game, s => s.turn === 2 && s.phase === 1 && pairedE3NexusClean(s),
    actions, quietPairedE3NexusChoice);
  orderE3NexusEcazSpice(game, true);
  game = advancePairedE3Nexus(game, s => !!s.nexus && !s.spiceWindow && !s.spiceResolution &&
    pairedE3NexusClean(s), actions, quietPairedE3NexusChoice);
  const beforeAlliance = pairedE3NexusReload(game);
  for (const [actor, target] of [[entrant, guild], [guild, entrant]])
    game = stepPairedE3Nexus(game, { actor, action: { type: 'alliance', target } }, actions);
  const alliance = pairedE3NexusReload(game);
  const native = quietPlan(game);
  const token = native.token, destination = native.destination;
  const sector = territory(destination).sectors.find(s => s !== game.storm)!;
  assert.ok(Number.isInteger(sector));
  game = advancePairedE3Nexus(game, s => !s.response && !s.phaseOpening &&
    s.decision?.kind === 'ecazPlacement', actions, quietPairedE3NexusChoice);
  const placementBefore = pairedE3NexusReload(game);
  const place: PairedE3NexusStep = { actor: ecaz,
    action: { type: 'decision', token, territory: destination } };
  game = stepPairedE3Nexus(game, place, actions);
  game = advancePairedE3Nexus(game, s => !s.response &&
    s.ecazAmbassadors!.tokens.find(t => t.id === token)!.zone === 'placed',
    actions, quietPairedE3NexusChoice);
  const placement = { before: placementBefore, step: place, after: pairedE3NexusReload(game) };
  game = advancePairedE3Nexus(game, s => s.phase === 5 && s.active === entrant && pairedE3NexusClean(s),
    actions, quietPairedE3NexusChoice);
  const source = Object.entries(pairedE3NexusPlayer(game, entrant).forces)
    .find(([key, n]) => n > 0 && Number(key.split(':')[1]) !== game.storm &&
      key.split(':')[0] !== destination)?.[0];
  assert.ok(source, 'The native Moritani setup must retain an original on-board source');
  assert.equal(pairedE3NexusPlayer(game, entrant).ally, guild);
  assert.equal(pairedE3NexusPlayer(game, guild).ally, entrant);
  assert.equal(pairedE3NexusPlayer(game, ecaz).ally, null);
  assert.equal(game.ecazAmbassadors!.tokens.find(t => t.id === token)!.effect, 'ecaz');
  assert.ok(pairedE3NexusPlayer(game, ecaz).hand.some(c => c.id === karama.id));
  pairedE3NexusInventory(game);
  const action: Action = { type: 'guildShip', from: source, amount: 1, elite: 0,
    territory: destination, sector, allyPayment: 0 };
  return { ...setup, ecaz, entrant, guild, source, destination, sector,
    target: `${destination}:${sector}`, token, karama: karama.id, purchase,
    beforeAlliance, alliance, placement, beforeAction: pairedE3NexusReload(game),
    action, actions, provenance: [
      'Shared original undealt setup entropy; no played physical state assigned.',
      'Conserved unplayed Treachery deck: first original Karama auctioned and paid by Ecaz.',
      'Conserved unplayed Spice deck: turn-one land blows, turn-two native worm/Nexus.',
    ] };
}

/** Stop at the real income/counter window, after physical transport but before entry. */
export function declareGuildAmbassadorIncomeArrival(fixture: {
  beforeAction: Game; entrant: string; action: Action;
}): PairedE3NexusTransition {
  const before = pairedE3NexusReload(fixture.beforeAction);
  const step = { actor: fixture.entrant, action: fixture.action };
  const after = stepPairedE3Nexus(before, step);
  assert.equal(after.response?.kind, 'guildIncome');
  assert.equal(after.pendingArrivalReaction?.length, 1);
  assert.ok(!after.pendingAmbassador);
  return { before, step, after };
}

/** Pass the actual persisted income queue; do not synthesize or clear controls. */
export function allowGuildAmbassadorIncomeArrival(state: Game) {
  let game = pairedE3NexusReload(state);
  const actions: PairedE3NexusStep[] = [];
  for (let n = 0; game.response && n < 20; n++) {
    assert.equal(game.response.kind, 'guildIncome');
    const step = nextPairedE3NexusStep(game); assert.ok(step);
    assert.equal(step.action.type, 'passResponse');
    game = stepPairedE3Nexus(game, step, actions);
  }
  assert.equal(game.response, null);
  assert.equal(game.decision?.kind, 'ecazAmbassador');
  assert.equal(game.pendingAmbassador?.stage, 'offer');
  return { game, actions };
}

/** Spend the actual auctioned card through the original income cancellation. */
export function cancelGuildAmbassadorIncomeArrival(state: Game, actor: string, card: string) {
  const before = pairedE3NexusReload(state);
  assert.equal(before.response?.kind, 'guildIncome');
  const controls = viewGame(before, actor).responseControls;
  assert.ok(controls && !controls.hasPassed && controls.cancelCards.includes(card));
  const step: PairedE3NexusStep = { actor, action: { type: 'card', mode: 'cancel', card } };
  const after = stepPairedE3Nexus(before, step);
  assert.equal(after.response, null);
  assert.equal(after.decision?.kind, 'ecazAmbassador');
  assert.equal(after.pendingAmbassador?.stage, 'offer');
  return { before, step, after };
}

export function guildAmbassadorIncomeChoice(game: Game, trigger = true): PairedE3NexusStep {
  assert.equal(game.decision?.kind, 'ecazAmbassador');
  const entry = game.pendingAmbassador!;
  return { actor: game.decision.player, action: { type: 'decision', event: entry.event,
    ...(trigger ? { trigger: true, beneficiary: game.decision.player, choice: 'duke' } : { decline: true }) } };
}

/** A single original offer completion, then the original entrant's legal next action. */
export function completeGuildAmbassadorIncomeArrival(state: Game, trigger = true) {
  const before = pairedE3NexusReload(state), step = guildAmbassadorIncomeChoice(before, trigger);
  const after = stepPairedE3Nexus(before, step);
  assert.ok(pairedE3NexusClean(after));
  const continuation: PairedE3NexusStep = { actor: after.active!, action: { type: 'endMovement' } };
  return { before, step, after, continuation };
}

