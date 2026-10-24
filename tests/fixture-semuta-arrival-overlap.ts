import assert from 'node:assert/strict';
import type { Action, Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import {
  actBasicSemutaAmbassador, basicSemutaAmbassadorClean,
  basicSemutaAmbassadorInventory, basicSemutaAmbassadorPlayer,
  createBasicSemutaAmbassadorFixture, nextBasicSemutaAmbassadorStep,
  type BasicSemutaAmbassadorEffect, type BasicSemutaAmbassadorStep,
} from './fixture-basic-semuta-ambassador';

export type SemutaArrivalOverlapOptions = {
  effect: BasicSemutaAmbassadorEffect;
  first: 'ambassador' | 'terror';
  arrival?: 'shipment' | 'movement';
  terror?: 'sabotage' | 'robbery';
  copied?: boolean;
  fullHand?: boolean;
};
export const actSemutaArrivalOverlap = actBasicSemutaAmbassador;
export const player = basicSemutaAmbassadorPlayer;
export const inventory = basicSemutaAmbassadorInventory;

/** Quiet native choices after the inherited turn-one prefix; token placement,
 * arrival and both reactions remain explicit caller actions. */
export function nextSemutaArrivalOverlapStep(game: Game): BasicSemutaAmbassadorStep | null {
  if (!game.response && !game.phaseOpening && game.decision) {
    const d = game.decision;
    if (d.kind === 'moritaniPlacement' || d.kind === 'moritaniTerror') return null;
    if (d.kind === 'richeseCache') {
      const card = game.richeseCache!.find(card => card.id !== SEMUTA_DRUG_ID); assert.ok(card);
      return { actor: d.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: card.id, method: 'onceAround', direction: 'counterclockwise' } };
    }
    if (d.kind === 'richeseUnbid') return { actor: d.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  return nextBasicSemutaAmbassadorStep(game);
}
export function advanceSemutaArrivalOverlap(game: Game, until: (state: Game) => boolean,
  actions: BasicSemutaAmbassadorStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaArrivalOverlapStep(game);
    assert.ok(step, `Supply the live native shared-entry choice: ${JSON.stringify({
      turn: game.turn, phase: game.phase, decision: game.decision, response: game.response?.kind,
    })}`);
    game = actSemutaArrivalOverlap(game, step.actor, step.action, actions);
  }
  throw Error('The original shared-entry programme exceeded its finite boundary');
}

/** Five genuine public Basic seats, original setup and cache purchase, real
 * turn-one marker placements, then a paid turn-two entry. No clock, order,
 * force, token or reaction receipt is installed. */
export function createSemutaArrivalOverlapFixture(options: SemutaArrivalOverlapOptions) {
  const original = createBasicSemutaAmbassadorFixture({ effect: options.effect,
    copied: options.copied, overlapOrder: options.first });
  const prefixEnd = original.actions.findIndex(step => step.actor === original.entrant && step.action.type === 'ship');
  assert.ok(prefixEnd >= 0);
  const prefixActions = structuredClone(original.actions.slice(0, prefixEnd));
  const branchActions: BasicSemutaAmbassadorStep[] = [];
  let game = structuredClone(original.beforeArrival);
  const originalInventory = inventory(game);
  const owner = original.owner, entrant = original.entrant, moritani = 'moritani', claimant = 'richese';
  const effect = options.effect, copied = !!options.copied;
  const terror = options.terror ?? 'sabotage', first = options.first;
  const arrival = options.arrival ?? 'shipment';
  const territory = original.territory, sector = original.sector;
  const act = (actor: string, action: Action) => {
    game = actSemutaArrivalOverlap(game, actor, action, branchActions);
  };
  const reach = (until: (state: Game) => boolean) => {
    game = advanceSemutaArrivalOverlap(game, until, branchActions);
  };
  // Abandon only the inherited unplayed branch, not an already submitted entry.
  act(entrant, { type: 'endMovement' });
  reach(state => state.turn === 1 && state.phase === 8 &&
    !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniPlacement');
  const beforeTerrorPlacement = structuredClone(game);
  const terrorToken = game.moritaniTerror!.tokens.find(token => token.kind === terror && token.status === 'available');
  assert.ok(terrorToken);
  const terrorPlacement: BasicSemutaAmbassadorStep = { actor: moritani,
    action: { type: 'decision', token: terrorToken.id, territory } };
  act(terrorPlacement.actor, terrorPlacement.action);
  reach(state => state.turn === 2 && state.phase === 5 && state.active === entrant &&
    basicSemutaAmbassadorClean(state));
  assert.equal(game.storm, 3, 'The first native zero dials and subsequent legal one dials retain the source route');
  assert.equal(game.order.indexOf(owner) < game.order.indexOf(moritani), first === 'ambassador');
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === original.token)!.location, territory);
  assert.equal(game.moritaniTerror!.tokens.find(token => token.id === terrorToken.id)!.location, territory);
  assert.ok(!player(game, entrant).shipped && player(game, entrant).moved === 0);
  const beforeStaging = structuredClone(game);
  const held = player(game, entrant).hand.findIndex(card => card.id === SEMUTA_DRUG_ID); assert.ok(held >= 0);
  player(game, claimant).hand.push(player(game, entrant).hand.splice(held, 1)[0]);
  const fill = (actor: string) => {
    while (player(game, actor).hand.length < 4) {
      const index = game.deck.findIndex(card => ['projectile', 'poison', 'shield', 'snooper', 'worthless'].includes(card.kind));
      assert.ok(index >= 0); player(game, actor).hand.push(game.deck.splice(index, 1)[0]);
    }
  };
  if (terror === 'robbery') fill(moritani);
  if (options.fullHand) fill(claimant);
  const beforeShipment = structuredClone(game);
  const shipment: BasicSemutaAmbassadorStep = { actor: entrant, action: { type: 'ship',
    territory: arrival === 'shipment' ? territory : 'habbanya_ridge_flat', sector,
    amount: 1, elite: 0, allyPayment: 0 } };
  let arrivalStep = shipment;
  if (arrival === 'movement') {
    act(shipment.actor, shipment.action); reach(basicSemutaAmbassadorClean);
    assert.equal(player(game, entrant).spice, player(beforeShipment, entrant).spice - 1);
    arrivalStep = { actor: entrant, action: { type: 'move', from: 'habbanya_ridge_flat:17',
      amount: 1, territory, sector } };
  }
  assert.deepEqual(inventory(game), originalInventory);
  const chosenCards = player(game, owner).hand.slice(0, effect === 'choam' ? 2 : 1).map(card => card.id);
  assert.equal(chosenCards.length, effect === 'choam' ? 2 : 1);
  const entrantCard = player(game, entrant).hand[0]; assert.ok(entrantCard);
  return { game, arrivalStep, effect, first, arrival, terror, copied,
    owner, beneficiary: owner, moritani, entrant, claimant,
    token: original.token, terrorToken: terrorToken.id, semuta: SEMUTA_DRUG_ID,
    territory, sector, location: territory + ':' + sector, chosenCards,
    entrantCard: entrantCard.id, overflowDiscard: player(game, moritani).hand[0].id,
    gift: player(game, moritani).hand[0].id, originalInventory,
    lobby: original.lobby, setup: original.setup, afterSetup: original.afterSetup,
    beforeTerrorPlacement, terrorPlacement, beforeStaging, beforeShipment, shipment,
    prefixActions, branchActions, actions: [...prefixActions, ...branchActions],
    sourceActions: prefixActions.length + branchActions.length,
    sourceActionCount: prefixActions.length + branchActions.length,
    balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    fullHand: !!options.fullHand,
    staging: [
      'Fresh five-seat Basic Ecaz/CHOAM/Richese/Guild/Moritani E2/E3 setup uses the original 35-card main deck and ten-card cache with no optional modules. Six unopened main-card positions, two unopened ordinary Spice positions and scalar lotteries are selected. Nine original Ambassador packet draws precede native Moritani token shuffling. Actual lobby circle choices create the requested owner order; no playing order is assigned.',
      'Guild actually buys original cache Semuta for one spice. Ecaz buys one ordinary card and pays one spice for its real turn-one Habbanya Ridge Sietch placement. The inherited unplayed turn-one Guild entry is omitted, Guild ends its turn, and the real native Mentat opportunity places the selected Terror at that same destination. Native subsequent one-plus-one Storm dials and quiet controls reach the original turn-two Guild movement turn.',
      'At that clean boundary, label the conserved prior transfer of the physical paid Semuta from Guild to Richese. Robbery additionally fills Moritani to its four-card limit from original ordinary deck cards; optional full-hand cases also fill Richese. These acquisitions are explicit staging, not played trades or auctions. No wallet, force, token, clock, alliance, discard, pending frame or receipt is installed. A movement branch really pays for its Ridge Flat reserve shipment before the caller-owned final move; a shipment branch leaves the actual paid destination entry to the caller.',
    ],
  };
}
export type SemutaArrivalOverlapFixture = ReturnType<typeof createSemutaArrivalOverlapFixture>;

/** Only the current event: continuing it must never also pass a later group. */
export function passCurrentSemuta(source: Game): Game {
  const pending = source.pendingTreacheryDiscard; assert.equal(pending?.reaction?.stage, 'offer');
  const event = pending!.batch.event; let game = source;
  for (const p of source.players) {
    const current = game.pendingTreacheryDiscard, reaction = current?.reaction;
    if (!current || current.batch.event !== event || reaction?.stage !== 'offer') break;
    if (!reaction.passed.includes(p.id))
      game = actSemutaArrivalOverlap(game, p.id, { type: 'semutaPass', event });
  }
  return game;
}
export function claimOverlapSemuta(source: Game, actor: string, card: string): Game {
  const event = source.pendingTreacheryDiscard!.batch.event;
  let game = actSemutaArrivalOverlap(source, actor, { type: 'semutaCommit', event });
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaArrivalOverlap(game, actor, { type: 'semutaSelect', event, card });
  return game;
}
export function openOverlapAmbassadorGrant(source: Game, f: SemutaArrivalOverlapFixture): Game {
  let game = source;
  if (!game.pendingArrivalOverlap) game = actSemutaArrivalOverlap(game, f.arrivalStep.actor, f.arrivalStep.action);
  assert.ok(game.pendingArrivalOverlap);
  if (game.pendingTerrorEntry?.stage === 'offer')
    game = actSemutaArrivalOverlap(game, f.moritani, { type: 'decision', decline: true });
  const entry = game.pendingAmbassador; assert.equal(entry?.stage, 'offer');
  game = actSemutaArrivalOverlap(game, f.owner, { type: 'decision', event: entry!.event,
    trigger: true, beneficiary: f.owner, choice: 'effect' });
  if (f.copied) game = actSemutaArrivalOverlap(game, f.owner,
    { type: 'decision', event: entry!.event, effect: f.effect });
  assert.equal(game.pendingAmbassador?.stage, 'cards'); return game;
}
export function openOverlapTerrorDiscard(source: Game, f: SemutaArrivalOverlapFixture): Game {
  assert.equal(source.pendingTerrorEntry?.stage, 'offer');
  let game = actSemutaArrivalOverlap(source, f.moritani, { type: 'decision', reveal: true });
  if (f.terror === 'robbery') {
    assert.equal(game.pendingTerrorEntry?.stage, 'robbery');
    game = actSemutaArrivalOverlap(game, f.moritani, { type: 'decision', choice: 'card' });
    assert.equal(game.pendingTerrorEntry?.stage, 'discard');
    game = actSemutaArrivalOverlap(game, f.moritani, { type: 'decision', card: f.overflowDiscard });
  }
  assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'terrorDiscard');
  return game;
}
export function finishOverlapTerror(source: Game, f: SemutaArrivalOverlapFixture, options: { give?: boolean } = {}): Game {
  if (f.terror !== 'sabotage') return source;
  assert.equal(source.pendingTerrorEntry?.stage, 'gift');
  return actSemutaArrivalOverlap(source, f.moritani, options.give
    ? { type: 'decision', card: f.gift } : { type: 'decision', decline: true });
}
