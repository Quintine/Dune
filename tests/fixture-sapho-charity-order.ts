import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { saphoCharityOrderEvent } from '../game/charity-order';
import { createSaphoRevivalOrderFixture, nextSaphoRevivalOrder, actSaphoRevivalOrder,
  saphoRevivalOrderInventory, saphoRevivalOrderStocks, saphoRevivalOrderPlayer,
  saphoRevivalOrderClean, createSaphoRevivalSemutaFixture, reactSaphoRevivalSemuta,
  REVIVAL_SAPHO, type SaphoRevivalOrderStep } from './fixture-sapho-revival-order';
import { createSaphoStartedMovementFixture } from './fixture-sapho-started-movement';

export type SaphoCharityOrderStep = SaphoRevivalOrderStep;
export const CHARITY_SAPHO = REVIVAL_SAPHO;
export const actSaphoCharityOrder = actSaphoRevivalOrder;
export const saphoCharityOrderInventory = saphoRevivalOrderInventory;
export const saphoCharityOrderStocks = saphoRevivalOrderStocks;
export const saphoCharityOrderPlayer = saphoRevivalOrderPlayer;
export const saphoCharityOrderClean = saphoRevivalOrderClean;
export const saphoCharityOrderReload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
export const nextSaphoCharityOrder = nextSaphoRevivalOrder;
export function advanceSaphoCharityOrder(game: Game, until: (state: Game) => boolean,
  actions: SaphoCharityOrderStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Sapho/Charity chronology ended before its requested boundary');
    const step = nextSaphoCharityOrder(game); assert.ok(step, 'Complete the current native control first');
    game = actSaphoCharityOrder(game, step.actor, step.action, actions);
  }
  throw Error('The original Sapho/Charity chronology did not reach its finite boundary');
}
export function finishSaphoCharityOrder(game: Game, actions: SaphoCharityOrderStep[] = []): Game {
  return advanceSaphoCharityOrder(game, state => state.phase !== 2, actions);
}
export function finishSaphoCharityTurn(game: Game, actions: SaphoCharityOrderStep[] = []): Game {
  const actor = game.charityOrder?.remaining[0]; assert.ok(actor);
  return actSaphoCharityOrder(game, actor, { type: 'ready' }, actions);
}
export function saphoCharityOrderAction(game: Game, mode: 'first' | 'last', owner = 'emperor'): Action {
  const option = viewGame(game, owner).saphoOptions.find(option => option.scope === 'charity' && option.mode === mode);
  assert.ok(option, `The actual unfinished Charity queue offers Sapho ${mode}`);
  return { type: 'card', card: CHARITY_SAPHO, scope: option.scope, event: option.event, mode: option.mode };
}
export function currentSaphoCharityEvent(game: Game): string {
  assert.ok(game.charityOrder);
  return saphoCharityOrderEvent({ turn: game.turn, order: game.order, players: game.players, ready: game.ready,
    claimed: game.players.filter(player => player.charityTurn === game.turn).map(player => player.id) }, game.charityOrder);
}
/** Actual ordinary prepayment empties the current purse, followed by its one
 * native claim. Neither a low purse nor a started marker is installed. */
export function claimSaphoCharityOrder(game: Game, actor = game.charityOrder?.remaining[0] ?? '',
  actions: SaphoCharityOrderStep[] = []) {
  const before = structuredClone(game), from = actions.length;
  const recipient = game.players.find(player => player.id !== actor && player.id === 'atreides')?.id ??
    game.players.find(player => player.id !== actor)?.id;
  assert.ok(recipient); const paid = saphoCharityOrderPlayer(game, actor).spice;
  if (paid) game = actSaphoCharityOrder(game, actor, { type: 'bribe', target: recipient, amount: paid }, actions);
  assert.equal(saphoCharityOrderPlayer(game, actor).spice, 0);
  game = actSaphoCharityOrder(game, actor, { type: 'charity' }, actions);
  assert.equal(saphoCharityOrderPlayer(game, actor).charityTurn, game.turn);
  assert.equal(saphoCharityOrderPlayer(game, actor).spice, 2);
  return { game, before, recipient, paid, steps: structuredClone(actions.slice(from)), actions };
}

/** Actual original cache1 acquisition is inherited unchanged. The Advanced
 * source continues its real first Revival and Movement without shipping, then
 * native Storm2 and dual Spice to current Charity. Basic uses the original
 * native started-Movement source, including its already paid Polar1 shipment.
 */
export function createSaphoCharityOrderFixture(options: { advanced?: boolean; started?: boolean } = {}) {
  const advanced = options.advanced ?? true, started = options.started ?? false;
  assert.ok(advanced || !started, 'The started ordered source belongs to Advanced Charity');
  const inherited = advanced ? createSaphoRevivalOrderFixture()
    : createSaphoStartedMovementFixture({ advanced: false });
  const inheritedActions = structuredClone(inherited.actions), actions = [...inheritedActions];
  let game = structuredClone(inherited.game);
  const continuationSpiceOrder = advanced ? [] : [0].map(position => {
    const from = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(from >= 0);
    const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  game = advanceSaphoCharityOrder(game,
    state => state.turn === 2 && state.phase === 2 && saphoCharityOrderClean(state), actions);
  const beforeClaim = structuredClone(game), owner = inherited.owner;
  const current = game.charityOrder?.remaining[0] ?? game.order[0]; assert.ok(current);
  if (advanced) {
    assert.equal(current, 'richese'); assert.equal(game.active, current);
    assert.equal(game.charityOrder?.version, 1);
    assert.deepEqual(game.charityOrder?.remaining, game.order);
  } else assert.equal(game.charityOrder ?? null, null);
  const claim = started ? claimSaphoCharityOrder(game, current, actions) : null;
  if (claim) game = claim.game;
  assert.ok(saphoCharityOrderPlayer(game, owner).hand.some(card => card.id === CHARITY_SAPHO));
  assert.deepEqual(saphoCharityOrderInventory(game), inherited.originalInventory);
  if (advanced) {
    assert.ok(viewGame(game, owner).saphoOptions.some(option => option.scope === 'charity' && option.mode === 'first'));
    assert.ok(viewGame(game, owner).saphoOptions.some(option => option.scope === 'charity' && option.mode === 'last'));
  }
  return { game, sourceGame: structuredClone(game), advanced, started, owner, current, card: CHARITY_SAPHO,
    inherited, beforeClaim, claim, acquisition: inherited.acquisition, continuationSpiceOrder,
    lobby: inherited.lobby, setup: inherited.setup, beforeStartingDeal: inherited.beforeStartingDeal,
    afterSetup: inherited.afterSetup, originalInventory: inherited.originalInventory,
    inheritedActions, continuation: structuredClone(actions.slice(inheritedActions.length)), actions,
    sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited: inheritedActions.length, acquisition: inherited.acquisition.steps.length,
      continuation: actions.length - inheritedActions.length, claim: claim?.steps.length ?? 0, source: actions.length },
    sourceDisclosure: `Actual public ${advanced ? 'Advanced preview' : 'Basic'} Richese/Atreides/Emperor/Guild setup with the native CHOAM/Richese deck. ` +
      'Emperor acquires the original physical Sapho through an actual cache auction bid1 and bank payment; no held-card exchange is staged. Only original unopened deal/land-Spice positions and scalar lotteries are selected. ' +
      (advanced ? 'Append original quiet Revival/Guild WAIT/Movement/Collection/Mentat and actual card Storm2 controls to the first original turn2 Charity frame. '
        : 'Retain the original paid Polar1 shipment, select one original unopened next land-Spice position, and append actual remaining turns, second dials and Charity controls. ') +
      (started ? 'Richese then really bribes away its actual full purse and claims ordinary Charity2; the accepted claim alone establishes its started current opportunity. ' : '') +
      'Counts derive from actual inherited and continuation action arrays. No purse, phase, queue, claim marker, hand, army or discard is installed.' };
}
export type SaphoCharityOrderFixture = ReturnType<typeof createSaphoCharityOrderFixture>;

/** Conserved frame-only UNIT supplement, not historical saved-game evidence. */
export function unstampedSaphoCharitySupplement(game: Game): Game {
  const old = saphoCharityOrderReload(game); delete old.charityOrder; return old;
}

/** CONTROLLED physical acquisition supplement inherited unchanged: Sapho and
 * Semuta were conserved into their original holders rather than bought. Start
 * at its actual turn2 Revival, then advance FORWARD through turn3 Charity.
 * No custody is reassigned here; only the next two original unopened land
 * Spice positions are selected before their actual later draws.
 */
export function createSaphoCharitySemutaFixture() {
  const inherited = createSaphoRevivalSemutaFixture();
  const inheritedActions = structuredClone(inherited.actions), actions = [...inheritedActions];
  let game = structuredClone(inherited.game);
  assert.equal(game.turn, 2); assert.equal(game.phase, 4);
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  game = advanceSaphoCharityOrder(game,
    state => state.turn === 3 && state.phase === 2 && saphoCharityOrderClean(state), actions);
  const option = viewGame(game, inherited.owner).saphoOptions.find(option => option.scope === 'charity'); assert.ok(option);
  assert.ok(option.mode === 'first' || option.mode === 'last');
  const action = saphoCharityOrderAction(game, option.mode, inherited.owner);
  assert.deepEqual(saphoCharityOrderInventory(game), inherited.originalInventory);
  return { game, sourceGame: structuredClone(game), owner: inherited.owner, holder: inherited.holder,
    current: game.charityOrder!.remaining[0], card: CHARITY_SAPHO, mode: option.mode, action,
    nativeAcquisition: false, inherited, spiceOrder, originalInventory: inherited.originalInventory,
    inheritedActions, continuation: structuredClone(actions.slice(inheritedActions.length)), actions,
    sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { inherited: inheritedActions.length, continuation: actions.length - inheritedActions.length,
      source: actions.length },
    staging: [...inherited.staging,
      'CONTROLLED acquisition remains inherited. Actual native turn2 Revival-to-turn3 Charity progression supplies the new scope; no rewind, hand, purse, queue, claim or live discard event is installed.'] };
}
export const reactSaphoCharitySemuta = reactSaphoRevivalSemuta;
