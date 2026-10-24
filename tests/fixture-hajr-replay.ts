import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { location } from '../game/board';
import { richeseCards } from '../game/richese-cards';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import {
  actOrnithopterHajr, ornithopterHajrClean, ornithopterHajrMove,
  ornithopterHajrPlayer, type OrnithopterHajrStep,
} from './fixture-ornithopter-hajr';

const canonicalBox = richeseCards().find(card => card.effect === 'nullentropyBox');
assert.ok(canonicalBox);
export const HAJR_REPLAY_BOX = canonicalBox.id;
export type HajrReplayStep = OrnithopterHajrStep;
export const hajrReplayPlayer = ornithopterHajrPlayer;
export const hajrReplayClean = ornithopterHajrClean;
export const actHajrReplay = actOrnithopterHajr;
export const hajrReplayMove = ornithopterHajrMove;

/** Only live original controls are consumed. The cache card is bought in its
 * ordinary native auction; the single Hajr is bought in the normal auction. */
export function nextHajrReplayStep(game: Game): HajrReplayStep | null {
  if (!game.response && !game.phaseOpening && game.decision) {
    const decision = game.decision;
    if (decision.kind === 'richeseCache') return { actor: decision.player, action: {
      type: 'decision', event: game.richeseBidding!.event, card: HAJR_REPLAY_BOX,
      method: 'onceAround', direction: 'clockwise',
    } };
    if (decision.kind === 'richeseUnbid') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  if (hajrReplayClean(game) && game.richeseAuction?.cardId === HAJR_REPLAY_BOX &&
    !game.richeseAuction.outcome && game.richeseAuction.active === 'emperor' && game.richeseAuction.bid === 0)
    return { actor: 'emperor', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  if (hajrReplayClean(game) && game.auction?.active === 'emperor' && game.auction.bid === 0 &&
    game.auction.cards[game.auction.index].effect === 'hajr')
    return { actor: 'emperor', action: { type: 'bid', amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceHajrReplay(game: Game, until: (state: Game) => boolean,
  actions: HajrReplayStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Hajr/Box programme ended before its next control');
    const next = nextHajrReplayStep(game); assert.ok(next, 'Finish the real owned Hajr/Box choice before continuing');
    game = actHajrReplay(game, next.actor, next.action, actions);
  }
  throw Error('The original Hajr/Box programme did not reach its finite boundary');
}

/** Genuine original host, setup, paid Box/Hajr lots and paid desert shipment.
 * Only unopened Hajr/Spice deck positions and scalar lotteries are selected.
 * No hand, wallet, force, phase or completed-effect receipt is installed. */
export function createHajrReplayFixture(options: { advanced?: boolean; truthForGuild?: boolean } = {}) {
  const advanced = options.advanced ?? false;
  let game = createGame('HAJRREPLAY', newPlayer('richese', 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: HajrReplayStep[] = [];
  const act = (actor: string, action: Action) => { game = actHajrReplay(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceHajrReplay(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  const startingDealSelection: { position: number; from: number; card: string }[] = [];
  let guildTruth: string | null = null;
  if (options.truthForGuild) {
    assert.equal(game.status, 'setup');
    assert.ok(game.players.every(player => player.hand.length === 0), 'Select only an unopened starting deal');
    const position = game.players.findIndex(player => player.id === 'guild');
    const from = game.deck.findIndex(card => card.effect === 'truthtrance');
    assert.ok(position >= 0 && from >= position);
    guildTruth = game.deck[from].id;
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    startingDealSelection.push({ position, from, card: guildTruth });
  }
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), front: Game['spiceDeck'] = [];
  if (guildTruth) assert.ok(hajrReplayPlayer(game, 'guild').hand.some(card => card.id === guildTruth));
  for (let count = 0; count < (advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  reach(state => state.phase === 2 && hajrReplayClean(state));
  const at = game.deck.findIndex(card => card.effect === 'hajr');
  assert.ok(at >= 0, 'The one original Hajr must still be undealt');
  const hajr = game.deck[at].id;
  game.deck.unshift(game.deck.splice(at, 1)[0]);
  const beforePurchases = structuredClone(game);
  reach(state => hajrReplayPlayer(state).hand.some(card => card.id === HAJR_REPLAY_BOX) &&
    hajrReplayPlayer(state).hand.some(card => card.id === hajr));
  const acquired = structuredClone(game);
  reach(state => state.phase === 5 && state.active === 'emperor' && hajrReplayClean(state));
  const beforeShipment = structuredClone(game), shipmentStep: HajrReplayStep = { actor: 'emperor', action: {
    type: 'ship', territory: 'imperial_basin', sector: 9, amount: 3, elite: advanced ? 2 : 0, allyPayment: 0,
  } };
  act(shipmentStep.actor, shipmentStep.action); reach(hajrReplayClean);
  return { game, lobby, setup, beforeStartingDeal, startingDealSelection, guildTruth,
    afterSetup, beforePurchases, acquired, beforeShipment, shipmentStep,
    afterShipment: structuredClone(game), hajr, box: HAJR_REPLAY_BOX, owner: 'emperor',
    source: 'imperial_basin:9', actions,
    staging: ['Original native setup and paid cache1/normal1 lots acquire Box and the single Hajr. An original paid3-counter desert shipment leaves the two-spice Box fee. Only unopened deck positions and scalar lotteries are selected.'] };
}
export type HajrReplayFixture = ReturnType<typeof createHajrReplayFixture>;

/** The real Box pays once and either exposes its actual private search or
 * automatically takes the only eligible discard, as the existing rule does. */
export function recoverHajrWithBox(game: Game, fixture: HajrReplayFixture, actions: HajrReplayStep[] = []) {
  assert.ok(game.discard.some(card => card.id === fixture.hajr));
  const before = structuredClone(game), step: HajrReplayStep = {
    actor: fixture.owner, action: { type: 'card', card: fixture.box },
  };
  game = actHajrReplay(game, step.actor, step.action, actions);
  const paid = structuredClone(game);
  let selectionStep: HajrReplayStep | null = null;
  if (game.pendingNullentropy) {
    const search = viewGame(game, fixture.owner).nullentropy?.search;
    assert.ok(search && search.cards.some(card => card.id === fixture.hajr), 'Select the genuinely discarded Hajr from the real paid owner view');
    selectionStep = { actor: fixture.owner,
      action: { type: 'decision', event: search.event, card: fixture.hajr } };
    game = actHajrReplay(game, selectionStep.actor, selectionStep.action, actions);
  }
  game = advanceHajrReplay(game, hajrReplayClean, actions);
  assert.ok(hajrReplayPlayer(game).hand.some(card => card.id === fixture.hajr));
  return { game, before, step, paid, selectionStep };
}

/** Basic: Hajr, move, Box, recovered Hajr, move, move. Advanced: move,
 * Hajr, Box, move, recovered Hajr, move. A Box action supplies no movement
 * and no Advanced timing opportunity; the second actual move opens that. */
export function completeHajrReplay(fixture: HajrReplayFixture) {
  let game = structuredClone(fixture.game);
  const actions: HajrReplayStep[] = [];
  const moves: { before: Game; step: HajrReplayStep; after: Game }[] = [];
  const play = () => {
    game = actHajrReplay(game, fixture.owner, { type: 'card', card: fixture.hajr }, actions);
    game = advanceHajrReplay(game, hajrReplayClean, actions);
  };
  const move = (from: string) => {
    const before = structuredClone(game), step: HajrReplayStep = {
      actor: fixture.owner, action: hajrReplayMove(game, from),
    };
    game = actHajrReplay(game, step.actor, step.action, actions);
    game = advanceHajrReplay(game, hajrReplayClean, actions);
    moves.push({ before, step, after: structuredClone(game) });
    return location(String(step.action.territory), Number(step.action.sector));
  };
  if (!game.advanced) play();
  const beforeFirstMove = structuredClone(game), firstDestination = move(fixture.source);
  if (game.advanced) play();
  const firstHajr = structuredClone(game), recovery = recoverHajrWithBox(game, fixture, actions);
  game = recovery.game;
  const recovered = structuredClone(game);
  let secondDestination = firstDestination;
  if (game.advanced) secondDestination = move(firstDestination);
  const beforeSecondHajr = structuredClone(game);
  play();
  const secondHajr = structuredClone(game);
  if (!game.advanced) secondDestination = move(firstDestination);
  const beforeThirdMove = structuredClone(game);
  move(secondDestination);
  const completed = structuredClone(game);
  game = actHajrReplay(game, fixture.owner, { type: 'endMovement' }, actions);
  return { game, completed, beforeFirstMove, firstHajr, recovery, recovered, beforeSecondHajr,
    secondHajr, beforeThirdMove, firstDestination, secondDestination, moves, actions };
}
