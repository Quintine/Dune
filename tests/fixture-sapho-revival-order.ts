import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES, location } from '../game/board';
import { PLAYER_CIRCLE_SECTORS } from '../game/player-positions';
import { actAdvisorPreparation } from './fixture-advisor-preparation';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { saphoStartedMovementInventory } from './fixture-sapho-started-movement';
import { advancedRevivalOrderStocks } from './fixture-advanced-revival-order';
import { createSemutaHomeworldSaphoFixture } from './fixture-semuta-homeworld-sapho';
import { reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';

export const REVIVAL_SAPHO = 'richese-juice-of-sapho';
export type SaphoRevivalOrderStep = { actor: string; action: Action };
export type SaphoRevivalOrderTransition = { before: Game; steps: SaphoRevivalOrderStep[]; after: Game };
export const actSaphoRevivalOrder = actAdvisorPreparation;
export const saphoRevivalOrderInventory = saphoStartedMovementInventory;
export const saphoRevivalOrderStocks = advancedRevivalOrderStocks;
export const saphoRevivalOrderPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const saphoRevivalOrderClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.pendingRevival && !game.truthtrance && !game.pendingTreacheryDiscard;

/** Only native pending controls are consumed. No voluntary revival or Sapho
 * use is selected, and completed participants are never reintroduced. */
export function nextSaphoRevivalOrder(game: Game): SaphoRevivalOrderStep | null {
  if (saphoRevivalOrderClean(game) && game.status === 'playing' && game.turn === 1 &&
    game.phase === 0 && game.stormPending === null) {
    const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
    if (actor) {
      const position = game.playerPositions?.richese; assert.ok(position);
      const circle = PLAYER_CIRCLE_SECTORS[position - 1];
      // Stop two sectors before the actual Richese circle. The next original
      // card1 then stops one sector before it, preserving the same First Player.
      const destination = ((circle - 3 + 18) % 18) + 1;
      const distance = (destination - game.storm + 18) % 18;
      return { actor, action: { type: 'stormDial', amount: game.stormDialers.indexOf(actor) === 0 ? distance : 0 } };
    }
  }
  if (saphoRevivalOrderClean(game) && game.phase === 4 && game.revivalOrder?.remaining[0])
    return { actor: game.revivalOrder.remaining[0], action: { type: 'ready' } };
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard && game.decision) {
    const d = game.decision;
    if (d.kind === 'guildTiming') return { actor: d.player, action: { type: 'decision', take: false } };
    if (d.kind === 'revivalStop') return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d.kind === 'richeseCache') {
      const card = game.richeseCache?.find(card => card.id === REVIVAL_SAPHO) ?? game.richeseCache?.[0]; assert.ok(card);
      return { actor: d.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: card.id, method: 'onceAround', direction: 'clockwise' } };
    }
    if (d.kind === 'richeseUnbid') return { actor: d.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  const lot = game.richeseAuction;
  if (saphoRevivalOrderClean(game) && lot?.cardId === REVIVAL_SAPHO && !lot.outcome &&
    lot.active === 'emperor' && lot.bid === 0)
    return { actor: 'emperor', action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceSaphoRevivalOrder(game: Game, until: (state: Game) => boolean,
  actions: SaphoRevivalOrderStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Sapho/Revival source ended before its next control');
    const step = nextSaphoRevivalOrder(game);
    assert.ok(step, `Choose the original control at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSaphoRevivalOrder(game, step.actor, step.action, actions);
  }
  throw Error('The original Sapho/Revival source did not reach its finite boundary');
}
export function finishSaphoRevivalOrder(game: Game, actions: SaphoRevivalOrderStep[] = []): Game {
  return advanceSaphoRevivalOrder(game, state => state.phase === 5 && saphoRevivalOrderClean(state), actions);
}
export function saphoRevivalOrderAction(game: Game, mode: 'first' | 'last', owner = 'emperor'): Action {
  const option = viewGame(game, owner).saphoOptions.find(option => option.scope === 'revival' && option.mode === mode);
  assert.ok(option, `The original remaining Revival queue offers ${mode}`);
  return { type: 'card', card: REVIVAL_SAPHO, scope: option.scope, event: option.event, mode: option.mode };
}

/** Original public R/A/E/G +choam setup and actual cache1 purchase give Emperor
 * its one physical Sapho. started:true additionally earns a Richese normal1
 * desert shipment, next native card Storm death and actual free1 return.
 * Legal original first-Storm dials stop two sectors before Richese's circle,
 * retaining its first opportunity through the later original card1.
 * Only unopened starting-deal/Spice positions and scalar lotteries are chosen;
 * no played card, force, wallet, phase, queue or started flag is installed. */
export function createSaphoRevivalOrderFixture(options: { started?: boolean } = {}) {
  const owner = 'emperor', current = 'richese', started = options.started ?? false;
  let game = createGame('SAPHOREVIVALORDER', newPlayer(current, 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['atreides', 'emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SaphoRevivalOrderStep[] = [];
  const act = (actor: string, action: Action) => { game = actSaphoRevivalOrder(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSaphoRevivalOrder(game, until, actions); };
  const transition = (run: () => void): SaphoRevivalOrderTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game); assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = saphoRevivalOrderInventory(game); assert.equal(originalInventory.length, 45);
  const counterIndex = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(counterIndex >= 0);
  [game.deck[1], game.deck[counterIndex]] = [game.deck[counterIndex], game.deck[1]];
  const counter = game.deck[1].id, beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.ok(saphoRevivalOrderPlayer(game, 'atreides').hand.some(card => card.id === counter));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SaphoRevivalOrderStep | undefined, bidAt = -1;
  for (let count = 0; !saphoRevivalOrderPlayer(game, owner).hand.some(card => card.id === REVIVAL_SAPHO) && count < 900; count++) {
    const step = nextSaphoRevivalOrder(game); assert.ok(step);
    if (step.actor === owner && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquisition = { before: beforeBid, bid, steps: structuredClone(actions.slice(bidAt)), after: structuredClone(game) };
  assert.equal(saphoRevivalOrderPlayer(beforeBid, owner).spice - saphoRevivalOrderPlayer(game, owner).spice, 1);
  assert.equal(saphoRevivalOrderPlayer(game, current).spice - saphoRevivalOrderPlayer(beforeBid, current).spice, 1);
  reach(state => state.turn === 1 && state.phase === 4 && saphoRevivalOrderClean(state));
  const firstRevival = structuredClone(game);
  const richesePosition = game.playerPositions?.richese; assert.ok(richesePosition);
  const richeseCircle = PLAYER_CIRCLE_SECTORS[richesePosition - 1];
  assert.equal(game.storm, ((richeseCircle - 3 + 18) % 18) + 1);
  let shipment: SaphoRevivalOrderTransition | null = null, storm: SaphoRevivalOrderTransition | null = null;
  let revival: SaphoRevivalOrderTransition | null = null, casualtyLocation: string | null = null;
  if (started) {
    reach(state => state.turn === 1 && state.phase === 5 && state.active === current && saphoRevivalOrderClean(state));
    // The scoped scalar lottery keeps the original later Storm card at1.
    const sector = game.storm % 18 + 1;
    const target = TERRITORIES.find(t => t.type === 'sand' && t.id !== 'imperial_basin' && t.sectors.includes(sector) &&
      game.players.every(player => !Object.entries(player.forces).some(([key, count]) => count > 0 && key.startsWith(`${t.id}:`))));
    assert.ok(target, 'An original empty sand territory lies in the next Storm sector');
    casualtyLocation = location(target.id, sector);
    shipment = transition(() => {
      act(current, { type: 'ship', territory: target.id, sector, amount: 1, elite: 0, allyPayment: 0 });
      reach(saphoRevivalOrderClean);
    });
    assert.equal(saphoRevivalOrderPlayer(game, current).forces[casualtyLocation], 1);
    assert.equal(saphoRevivalOrderPlayer(shipment.before, current).spice - saphoRevivalOrderPlayer(game, current).spice, 2);
    reach(state => state.turn === 2 && state.phase === 0 && saphoRevivalOrderClean(state));
    assert.equal(game.stormMovementSource?.kind, 'card'); assert.equal(game.stormPending, 1);
    storm = transition(() => { reach(state => state.turn === 2 && state.phase === 1); });
    assert.equal(saphoRevivalOrderPlayer(game, current).forces[casualtyLocation], undefined);
    assert.equal(saphoRevivalOrderPlayer(game, current).tanks, 1);
    reach(state => state.turn === 2 && state.phase === 4 && saphoRevivalOrderClean(state));
    assert.equal(game.revivalOrder?.remaining[0], current);
    revival = transition(() => { act(current, { type: 'revive', amount: 1, elite: 0 }); reach(saphoRevivalOrderClean); });
    assert.equal(saphoRevivalOrderPlayer(game, current).tanks, 0);
    assert.equal(saphoRevivalOrderPlayer(game, current).revived, 1);
    assert.equal(game.revivalOrder?.started, true);
  }
  assert.equal(game.revivalOrder?.remaining[0], current);
  assert.deepEqual(saphoRevivalOrderInventory(game), originalInventory);
  assert.ok(viewGame(game, owner).saphoOptions.some(option => option.scope === 'revival' && option.mode === 'first'));
  assert.ok(viewGame(game, owner).saphoOptions.some(option => option.scope === 'revival' && option.mode === 'last'));
  return { game, sourceGame: structuredClone(game), owner, current, actor: current, card: REVIVAL_SAPHO,
    started, initial, lobby, setup, beforeStartingDeal, afterSetup, firstRevival, richeseCircle, acquisition,
    shipment, storm, revival, casualtyLocation, counter, originalInventory, originalSpice, spiceOrder,
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length, staging: [] as string[] };
}

/** CONTROLLED physical-card supplement only. The inherited opted-in Semuta
 * fixture conserves Sapho/Semuta between original zones; it does not earn their
 * acquisitions. Its later phase progression and new discard/claim are actual.
 * No added force, wallet, phase, queue or receipt is installed here. */
export function createSaphoRevivalSemutaFixture() {
  const inherited = createSemutaHomeworldSaphoFixture('movement', 'last', true);
  const actions = [...inherited.actions];
  const game = advanceSaphoRevivalOrder(inherited.game,
    state => state.turn === 2 && state.phase === 4 && saphoRevivalOrderClean(state), actions);
  const option = viewGame(game, inherited.owner).saphoOptions.find(option => option.scope === 'revival'); assert.ok(option);
  assert.ok(option.mode === 'first' || option.mode === 'last');
  const action = saphoRevivalOrderAction(game, option.mode, inherited.owner);
  return { game, sourceGame: structuredClone(game), owner: inherited.owner, holder: inherited.holder,
    current: game.revivalOrder!.remaining[0], card: REVIVAL_SAPHO, mode: option.mode, action,
    originalInventory: saphoRevivalOrderInventory(game), actions, sourceActionCount: actions.length,
    nativeAcquisition: false, staging: [...inherited.staging,
      'CONTROLLED conserved Sapho/Semuta acquisition remains supplemental. Actual original continuation reaches fresh Advanced turn-two Revival before the new card discard.'] };
}
export const reactSaphoRevivalSemuta = reactSemutaHomeworldChoam;
