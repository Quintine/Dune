import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { nativeShipmentSources } from '../game/homeworld-options';
import { createIndependentCardModulesFixture, type IndependentCardModulesOptions, type IndependentCardModulesStep } from './fixture-independent-card-modules';
import { nextPairedChoamSkillsStep } from './fixture-paired-choam-nexus-skills';
import { applyClassicDiscoveryNexusStep, withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type AtomicsModulesStep = IndependentCardModulesStep;
export type AtomicsModulesOptions = Pick<IndependentCardModulesOptions, 'advanced' | 'skills' | 'homeworlds' | 'tech' | 'strongholds' | 'expansions'>;
export const atomicsModulesPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const atomicsModulesClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingGuildBetrayal &&
  !game.pendingNexusIxianReplacement && !game.pendingNexusIxianBetrayal && !game.pendingNexusHarkonnenBetrayal;
export function actAtomicsModules(game: Game, actor: string, action: Action, actions?: AtomicsModulesStep[]): Game {
  return applyClassicDiscoveryNexusStep(game, { actor, action }, actions);
}
function nextAtomicsModules(game: Game): AtomicsModulesStep | null {
  if (game.pendingGuildBetrayal) {
    const pending = game.pendingGuildBetrayal, actor = pending.required.find(actor => !pending.passed.includes(actor)); assert.ok(actor);
    return { actor, action: { type: 'guildBetrayalPass', event: pending.invoice.event } };
  }
  if (game.pendingNexusIxianReplacement) return { actor: game.pendingNexusIxianReplacement.buyer,
    action: { type: 'nexusIxianReplacementPass', event: game.pendingNexusIxianReplacement.event } };
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'moritaniTerror' || decision?.kind === 'ecazAmbassador') return null;
    if (decision?.kind === 'moritaniPlacement' || decision?.kind === 'ecazPlacement')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision?.kind === 'guildTiming') return { actor: decision.player, action: { type: 'decision', take: false } };
    if (decision?.kind === 'advisor') return { actor: decision.player,
      action: { type: 'decision', accept: game.turn === 1 && decision.destination === 'carthag:11', amount: 1, accompany: true } };
    if (decision?.kind === 'intrusion') return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'homeworldDefense') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, use: false } };
    if (decision?.kind === 'homeworldRevivalDeployment' || decision?.kind === 'caladanReinforcement' || decision?.kind === 'grummanCollection')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'richeseUnbid') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
    if (decision?.kind === 'techToken') return { actor: decision.player, action: { type: 'decision', token: decision.choices[0] } };
  }
  return nextPairedChoamSkillsStep(game);
}
export function advanceAtomicsModules(game: Game, until: (state: Game) => boolean,
  actions: AtomicsModulesStep[] = []): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The actual Atomics programme ended before its control');
    const step = nextAtomicsModules(game); assert.ok(step, `Choose the original ${game.decision?.kind ?? 'sealed plan'}`);
    game = actAtomicsModules(game, step.actor, step.action, actions);
  }
  throw Error('The original module Atomics programme did not reach its requested boundary');
}
function orderOriginalBlow(game: Game, worm = false): void {
  const front: Game['spiceDeck'] = [];
  if (worm) {
    const index = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
    assert.ok(index >= 0); front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  for (let count = 0; count < (game.advanced ? 2 : 1); count++) {
    const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery && card.territory !== 'imperial_basin');
    assert.ok(index >= 0); front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}
/** Actual bank lots fill the owner's printed four slots, at one spice each.
 * No desired identity is put in a hand and no wallet is reassigned. */
function buyOriginalHand(game: Game, actor: string, actions: AtomicsModulesStep[]) {
  const bids: Array<{ before: Game; step: AtomicsModulesStep }> = [];
  for (let count = 0; count < 650; count++) {
    if (atomicsModulesPlayer(game, actor).hand.length === 4) return { game, bids };
    let step: AtomicsModulesStep | null = null;
    if (atomicsModulesClean(game) && game.auction && !game.richeseAuction &&
      game.auction.active === actor && game.auction.bid === 0) {
      step = { actor, action: { type: 'bid', amount: 1, allyPayment: 0 } };
      bids.push({ before: structuredClone(game), step: structuredClone(step) });
    }
    step ??= nextAtomicsModules(game); assert.ok(step, 'The original bank auction must expose its current bid');
    game = actAtomicsModules(game, step.actor, step.action, actions);
  }
  throw Error('The original bank lots did not fill the actual hand');
}
function shipNative(game: Game, actor: string, territory: string, sector: number, amount: number, elite: number,
  actions: AtomicsModulesStep[]) {
  const sources = game.homeworlds ? nativeShipmentSources(viewGame(game, actor), amount, elite) : undefined;
  assert.ok(!game.homeworlds || sources);
  const before = structuredClone(game), step: AtomicsModulesStep = { actor, action: { type: 'ship', territory, sector,
    amount, elite, allyPayment: 0, ...(sources ? { homeworldSources: sources } : {}) } };
  game = actAtomicsModules(game, step.actor, step.action, actions);
  return { before, step, game };
}
/** Original native setup, paid hand-filling auctions, real placements, a worm
 * alliance and closing draw. The paired route additionally earns its one BG
 * advisor through an original first-turn Guild shipment. */
function atomicsModulesProgramme(options: AtomicsModulesOptions, paired: boolean) {
  const factions: FactionId[] = paired
    ? ['moritani', 'ecaz', 'guild', 'emperor', 'beneGesserit'] : ['moritani', 'richese', 'guild', 'emperor'];
  const source = withClassicDiscoveryNexusLottery(() => createIndependentCardModulesFixture({ ...options,
    expansions: options.expansions ?? (paired ? ['ecaz'] : ['ecaz', 'choam']), factions,
    independent: true, nexus: true, tech: options.tech ?? false }));
  let game = structuredClone(source.game);
  const afterSetup = structuredClone(game), actions = [...source.steps], staging: string[] = [];
  const act = (actor: string, action: Action) => { game = actAtomicsModules(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAtomicsModules(game, until, actions); };
  orderOriginalBlow(game);
  reach(state => state.phase === 2 && atomicsModulesClean(state));
  const first = buyOriginalHand(game, 'moritani', actions); game = first.game;
  const purchases = [...first.bids];
  let firstShipment: { before: Game; step: AtomicsModulesStep; after: Game } | null = null;
  if (paired) {
    reach(state => state.phase === 5 && state.active === 'guild' && atomicsModulesClean(state));
    const advisorsBefore = atomicsModulesPlayer(game, 'beneGesserit').forces['carthag:11'] ?? 0;
    const shipment = shipNative(game, 'guild', 'carthag', 11, 1, 0, actions); game = shipment.game;
    reach(atomicsModulesClean);
    firstShipment = { before: shipment.before, step: shipment.step, after: structuredClone(game) };
    assert.equal(atomicsModulesPlayer(game, 'guild').forces['carthag:11'], 1);
    assert.equal(atomicsModulesPlayer(game, 'beneGesserit').forces['carthag:11'], advisorsBefore + 1);
    assert.ok(atomicsModulesPlayer(game, 'beneGesserit').advisors?.carthag);
  }
  reach(state => state.turn === 1 && !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniPlacement');
  const atomics = game.moritaniTerror!.tokens.find(token => token.kind === 'atomics' && token.status === 'available'); assert.ok(atomics);
  const beforePlacement = structuredClone(game);
  act('moritani', { type: 'decision', token: atomics.id, territory: 'carthag' });
  reach(state => state.turn === 2 && state.phase === 1 && atomicsModulesClean(state));
  orderOriginalBlow(game, true);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && atomicsModulesClean(state));
  const ally = paired ? 'ecaz' : 'guild', holder = paired ? 'emperor' : 'richese';
  const beforeAlliance = structuredClone(game);
  act('moritani', { type: 'alliance', target: ally }); act(ally, { type: 'alliance', target: 'moritani' });
  reach(state => state.nexusCards?.phase?.stage === 'drawing' && atomicsModulesClean(state));
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('tleilaxu'); assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  const beforeDraw = structuredClone(game), drawStep: AtomicsModulesStep = { actor: holder,
    action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[holder], choice: 'draw', ownRedraws: 0 } };
  act(drawStep.actor, drawStep.action);
  const afterDraw = structuredClone(game);
  reach(state => state.phase === 2 && atomicsModulesClean(state));
  const second = buyOriginalHand(game, ally, actions); game = second.game; purchases.push(...second.bids);
  // Ecaz places after Revival, before Shipment; the first-turn opportunity
  // preceded the original Guild accompaniment. Use the later earned opening
  // after the real worm alliance and bank purchases, while Atomics is already
  // on the board, rather than skipping the first Mentat in search of Ecaz.
  let ambassador: string | null = null;
  if (paired) {
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
    const token = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz' && token.zone === 'supply'); assert.ok(token);
    ambassador = token.id;
    act('ecaz', { type: 'decision', token: token.id, territory: 'carthag' });
  }
  staging.push('Only unopened original Spice and Nexus order is selected. Six paid one-spice bank bids fill the actual Moritani and activation-ally hands; no card, force, wallet or token is staged.');
  return { source, game, afterSetup, actions, staging, firstShipment, beforePlacement, atomics: atomics.id,
    ambassador, ally, holder, beforeAlliance, draw: { before: beforeDraw, step: drawStep, after: afterDraw }, purchases };
}

/** Concealed native Richese 3-marker uses its real paid shipment and Guild
 * acknowledgement. Atomics has not yet revealed/materialized or killed it. */
export function createNoFieldAtomicsModulesFixture(options: AtomicsModulesOptions = {}) {
  const programme = atomicsModulesProgramme(options, false), actions = programme.actions;
  let game = advanceAtomicsModules(programme.game, state => state.phase === 5 && state.active === 'richese' && atomicsModulesClean(state), actions);
  const richese = atomicsModulesPlayer(game, 'richese'), token = richese.noField!.tokens.find(token => token.value === 3); assert.ok(token);
  const beforeEntry = structuredClone(game), entry: AtomicsModulesStep = { actor: 'richese', action: { type: 'ship',
    noField: token.id, event: richese.noFieldEvent, territory: 'carthag', sector: 11, allyPayment: 0 } };
  game = actAtomicsModules(game, entry.actor, entry.action, actions);
  game = advanceAtomicsModules(game, state => !state.phaseOpening && !state.response && state.decision?.kind === 'moritaniTerror', actions);
  assert.ok(atomicsModulesPlayer(game, 'richese').noField!.deployed);
  return { ...programme, game, actions, beforeEntry, entry, noField: token.id };
}

/** Paired native Ambassador/Terror arrival queue with a real ordinary Guild
 * counter, real BG advisor and the Emperor's typed paid incoming army. */
export function createPairedAtomicsModulesFixture(options: AtomicsModulesOptions = {}) {
  const programme = atomicsModulesProgramme({ ...options, advanced: true }, true), actions = programme.actions;
  let game = advanceAtomicsModules(programme.game, state => state.phase === 5 && state.active === 'emperor' && atomicsModulesClean(state), actions);
  const arrival = shipNative(game, 'emperor', 'carthag', 11, 3, 2, actions); game = arrival.game;
  game = advanceAtomicsModules(game, state => !state.phaseOpening && !state.response && !!state.pendingArrivalOverlap, actions);
  return { ...programme, game, actions, beforeEntry: arrival.before, entry: arrival.step };
}
/** The live native arrival order chooses which original child is first. After
 * destruction, its surviving parent resumes once, without a second invoice. */
export function finishAtomicsModulesReveal(game: Game, actions: AtomicsModulesStep[] = []) {
  const seen: string[] = [];
  let beforeActivation: Game | null = null;
  for (let count = 0; count < 200; count++) {
    if (game.moritaniAtomics && !game.pendingArrivalOverlap && !game.pendingAmbassador && !game.pendingTerrorEntry && atomicsModulesClean(game)) {
      assert.ok(beforeActivation); return { game, beforeActivation, seen };
    }
    let step: AtomicsModulesStep | null = null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'ecazAmbassador') {
      seen.push('ambassador'); step = { actor: game.decision.player,
        action: { type: 'decision', event: game.pendingAmbassador!.event, decline: true } };
    }
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'moritaniTerror') {
      assert.equal(game.pendingTerrorEntry!.stage, 'offer');
      beforeActivation = structuredClone(game); seen.push('atomics');
      step = { actor: game.decision.player, action: { type: 'decision', reveal: true } };
    }
    step ??= nextAtomicsModules(game); assert.ok(step, 'The original arrival child needs its owned control');
    game = actAtomicsModules(game, step.actor, step.action, actions);
  }
  throw Error('The original Atomics reveal did not settle its native arrival queue');
}
export function openLaterAtomicsModulesNexus(game: Game, actions: AtomicsModulesStep[] = []): Game {
  const nextTurn = game.turn + 1;
  game = advanceAtomicsModules(game, state => state.turn === nextTurn && state.phase === 1 && atomicsModulesClean(state), actions);
  orderOriginalBlow(game, true);
  return advanceAtomicsModules(game, state => state.nexus && !state.spiceWindow && !state.spiceResolution && atomicsModulesClean(state), actions);
}

/** A later real Sneak Attack placement, followed by a permitted paid shipment
 * to a different territory and ordinary movement into Aftermath. No clocks,
 * counters, resources, movement flags or pending Terror frames are assigned. */
export function createAtomicsAftermathSneakContinuation(game: Game, actions: AtomicsModulesStep[] = []) {
  const activationTurn = game.turn;
  game = advanceAtomicsModules(game, state => state.turn === activationTurn && !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniPlacement', actions);
  const token = game.moritaniTerror!.tokens.find(token => token.kind === 'sneakAttack' && token.status === 'available'); assert.ok(token);
  game = actAtomicsModules(game, 'moritani', { type: 'decision', token: token.id, territory: 'carthag' }, actions);
  game = advanceAtomicsModules(game, state => state.turn === activationTurn + 1 && state.phase === 1 && atomicsModulesClean(state), actions);
  orderOriginalBlow(game);
  game = advanceAtomicsModules(game, state => state.phase === 5 && state.active === 'emperor' && atomicsModulesClean(state), actions);
  const blockedSources = game.homeworlds ? nativeShipmentSources(viewGame(game, 'emperor'), 1, 0) : undefined;
  assert.ok(!game.homeworlds || blockedSources);
  const beforeShipment = structuredClone(game), blockedShipment: Action = { type: 'ship', territory: 'carthag', sector: 11,
    amount: 1, elite: 0, allyPayment: 0, ...(blockedSources ? { homeworldSources: blockedSources } : {}) };
  const arrival = shipNative(game, 'emperor', 'imperial_basin', 11, 1, 0, actions); game = arrival.game;
  game = advanceAtomicsModules(game, atomicsModulesClean, actions);
  const beforeMove = structuredClone(game), movement: AtomicsModulesStep = { actor: 'emperor', action: { type: 'move',
    from: 'imperial_basin:11', amount: 1, territory: 'carthag', sector: 11 } };
  game = actAtomicsModules(game, movement.actor, movement.action, actions);
  game = advanceAtomicsModules(game, state => !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniTerror', actions);
  game = actAtomicsModules(game, 'moritani', { type: 'decision', reveal: true }, actions);
  game = advanceAtomicsModules(game, state => !state.response && !state.phaseOpening && state.pendingTerrorEntry?.stage === 'sneakAttack', actions);
  const beforeSneak = structuredClone(game);
  game = actAtomicsModules(game, 'moritani', { type: 'decision', amount: 1 }, actions);
  game = advanceAtomicsModules(game, atomicsModulesClean, actions);
  return { game, actions, beforeShipment, blockedShipment, beforeMove, movement, beforeSneak, token: token.id };
}
