import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

const sapho = richeseCards().find(card => card.effect === 'juiceOfSapho'); assert.ok(sapho);
export const EXTORTION_SAPHO = sapho.id;
export type SaphoExtortionStep = { actor: string; action: Action };
export const saphoExtortionPlayer = (game: Game, actor = 'emperor') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const saphoExtortionClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export const saphoExtortionPending = (game: Game) => !game.response && !game.phaseOpening &&
  !game.truthtrance && !game.pendingTreacheryDiscard && game.decision?.kind === 'moritaniExtortion';
export function actSaphoExtortion(game: Game, actor: string, action: Action,
  actions: SaphoExtortionStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Native optional controls are declined; the source programme owns every
 * Extortion reveal, placement and payment instead of inventing those choices. */
export function nextSaphoExtortionStep(game: Game): SaphoExtortionStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'moritaniTerror' || decision?.kind === 'moritaniExtortion') return null;
    if (decision?.kind === 'moritaniSetup') return { actor: decision.player,
      action: { type: 'decision', territory: 'carthag', sector: 11 } };
    if (decision?.kind === 'moritaniPlacement') return { actor: decision.player,
      action: { type: 'decision', decline: true } };
    if (decision?.kind === 'moritaniAssassinate') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'guildTiming') return { actor: decision.player,
      action: { type: 'decision', take: false } };
    if (decision?.kind === 'richeseCache') {
      const card = game.richeseCache!.find(card => card.id === EXTORTION_SAPHO) ?? game.richeseCache![0]; assert.ok(card);
      return { actor: decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: card.id, method: 'onceAround', direction: 'clockwise' } };
    }
    if (decision?.kind === 'richeseUnbid') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  const lot = game.richeseAuction;
  if (saphoExtortionClean(game) && lot?.cardId === EXTORTION_SAPHO && !lot.outcome &&
    lot.active === 'emperor' && lot.bid === 0)
    return { actor: 'emperor', action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceSaphoExtortion(game: Game, until: (state: Game) => boolean,
  actions: SaphoExtortionStep[] = []): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Extortion programme ended before its next control');
    const step = nextSaphoExtortionStep(game); assert.ok(step, 'Choose the actual owned Extortion control before advancing');
    game = actSaphoExtortion(game, step.actor, step.action, actions);
  }
  throw Error('The original Sapho/Extortion programme did not reach its finite boundary');
}
function orderOriginalLand(game: Game) {
  const front: Game['spiceDeck'] = [];
  for (let count = 0; count < (game.advanced ? 2 : 1); count++) {
    const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(index >= 0);
    front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}
export function saphoExtortionAnswer(game: Game, pay: boolean): SaphoExtortionStep {
  const decision = game.decision; assert.ok(decision?.kind === 'moritaniExtortion');
  return { actor: decision.player, action: { type: 'decision', event: decision.event, pay } };
}

/** Public original setup, actual paid cache1 Sapho, first native Mentat Terror
 * placement, paid foreign entry and reveal, then another actual placement
 * before bank5. The original seat/join order leaves four native payers; an
 * actual Atreides decline leaves the holder inside the unasked suffix.
 * Only unopened Spice positions and original scalar lotteries are controlled.
 * No dealt card, physical counter, wallet, clock, queue or receipt is installed. */
export function createSaphoExtortionFixture(options: { advanced?: boolean; priorDecline?: boolean } = {}) {
  const advanced = options.advanced ?? false;
  let game = createGame('SAPHOEXTORTION', newPlayer('richese', 'Richese', 'richese'), advanced, ['ecaz', 'choam']);
  for (const faction of ['atreides', 'guild', 'emperor', 'moritani'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const actions: SaphoExtortionStep[] = [];
  const act = (actor: string, action: Action) => { game = actSaphoExtortion(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSaphoExtortion(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  orderOriginalLand(game);
  reach(state => saphoExtortionPlayer(state).hand.some(card => card.id === EXTORTION_SAPHO));
  const acquired = structuredClone(game);
  reach(state => state.turn === 1 && !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniPlacement');
  const token = game.moritaniTerror!.tokens.find(token => token.kind === 'extortion' && token.status === 'available'); assert.ok(token);
  const beforePlacement = structuredClone(game), placement: SaphoExtortionStep = { actor: 'moritani', action: {
    type: 'decision', token: token.id, territory: 'habbanya_ridge_sietch',
  } };
  act(placement.actor, placement.action);
  reach(state => state.turn === 2 && state.phase === 1 && saphoExtortionClean(state));
  const placed = structuredClone(game);
  orderOriginalLand(game);
  reach(state => state.phase === 5 && state.active === 'emperor' && saphoExtortionClean(state));
  const beforeEntry = structuredClone(game), entry: SaphoExtortionStep = { actor: 'emperor', action: {
    type: 'ship', territory: 'habbanya_ridge_sietch', sector: 17, amount: 1, elite: 0, allyPayment: 0,
  } };
  act(entry.actor, entry.action);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniTerror');
  const offered = structuredClone(game), reveal: SaphoExtortionStep = { actor: 'moritani',
    action: { type: 'decision', reveal: true } };
  act(reveal.actor, reveal.action);
  reach(saphoExtortionClean);
  const revealed = structuredClone(game);
  reach(state => state.turn === 2 && !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniPlacement');
  const beforeMentatPlacement = structuredClone(game);
  const later = game.moritaniTerror!.tokens.find(token => token.kind === 'sabotage' && token.status === 'available'); assert.ok(later);
  const mentatPlacement: SaphoExtortionStep = { actor: 'moritani', action: {
    type: 'decision', token: later.id, territory: 'sietch_tabr',
  } };
  act(mentatPlacement.actor, mentatPlacement.action);
  reach(saphoExtortionPending);
  const collected = structuredClone(game), declines: { before: Game; step: SaphoExtortionStep; after: Game }[] = [];
  if (options.priorDecline !== false) {
    const before = structuredClone(game), step = saphoExtortionAnswer(game, false);
    assert.equal(step.actor, 'atreides', 'The original turn-two Storm/join order supplies the completed prefix');
    act(step.actor, step.action);
    declines.push({ before, step, after: structuredClone(game) });
  }
  const queue = game.moritaniExtortion!;
  assert.ok(queue.queue.slice(queue.cursor).includes('emperor'));
  assert.notEqual(queue.queue[queue.cursor], 'emperor');
  assert.notEqual(queue.queue.at(-1), 'emperor');
  return { game, lobby, setup, afterSetup, acquired, beforePlacement, placement, placed, beforeEntry, entry,
    offered, reveal, revealed, beforeMentatPlacement, mentatPlacement, collected, declines,
    owner: 'emperor', moritani: 'moritani', card: EXTORTION_SAPHO, token: token.id, laterToken: later.id,
    advanced, priorDecline: options.priorDecline !== false, sourceActionCount: actions.length, actions,
    staging: ['Only unopened land Spice positions and original scalar lotteries are selected. Public join order Richese/Atreides/Guild/Emperor/Moritani, original setup, actual cache1, initial native Extortion placement, paid foreign1 entry, revelation and later placement-before-bank5 create the real payer queue. No postdeal custody, counters, wallets, clocks, payer order or receipt is assigned.'] };
}
export type SaphoExtortionFixture = ReturnType<typeof createSaphoExtortionFixture>;
export function saphoExtortionAction(game: Game, mode: 'first' | 'last'): Action {
  const option = viewGame(game, 'emperor').saphoOptions.find(option => option.scope === 'extortion' && option.mode === mode);
  assert.ok(option, `The actual pending unasked suffix needs a meaningful Sapho-${mode} option`);
  return { type: 'card', card: EXTORTION_SAPHO, ...option };
}

/** Each answer uses the actual current native payer and current event. The
 * first real payment ends offers; an all-decline branch returns the real token
 * through the native hidden-supply rotation. */
export function completeSaphoExtortion(fixture: SaphoExtortionFixture, mode: 'first' | 'last', payOwner = false) {
  let game = structuredClone(fixture.game);
  const actions: SaphoExtortionStep[] = [], answers: { before: Game; step: SaphoExtortionStep; after: Game }[] = [];
  const previous = saphoExtortionAnswer(game, false), action = saphoExtortionAction(game, mode);
  game = actSaphoExtortion(game, fixture.owner, action, actions);
  const ordered = structuredClone(game);
  for (let count = 0; game.moritaniExtortion && count < fixture.game.players.length; count++) {
    assert.ok(saphoExtortionPending(game));
    const before = structuredClone(game), step = saphoExtortionAnswer(game, payOwner && game.decision!.player === fixture.owner);
    game = actSaphoExtortion(game, step.actor, step.action, actions);
    answers.push({ before, step, after: structuredClone(game) });
  }
  assert.equal(game.moritaniExtortion, undefined, 'The real Extortion obligation settles finitely');
  return { game, action, previous, ordered, answers, actions, mode, payOwner };
}
