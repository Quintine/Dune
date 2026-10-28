import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { nativeShipmentSources } from '../game/homeworld-options';
import {
  GUILD_FIRST_SAPHO, actSaphoGuildFirst, nextSaphoGuildFirstStep,
  type SaphoGuildFirstStep,
} from './fixture-sapho-guild-first';
import { createSemutaHomeworldSaphoFixture } from './fixture-semuta-homeworld-sapho';
import { advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep } from './fixture-semuta-homeworld-choam';

export const STARTED_MOVEMENT_SAPHO = GUILD_FIRST_SAPHO;
export type SaphoStartedMovementStep = SaphoGuildFirstStep;
export const actSaphoStartedMovement = actSaphoGuildFirst;
export const nextSaphoStartedMovementStep = nextSaphoGuildFirstStep;
export const saphoStartedMovementPlayer = (game: Game, actor = 'emperor') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const saphoStartedMovementClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingShipment &&
  !game.pendingKarama && !game.currentAuctionSale;
/** Count physical zones once, excluding historical ordinary-auction aliases. */
export function saphoStartedMovementInventory(game: Game) {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length); return ids;
}
export function advanceSaphoStartedMovement(game: Game, until: (state: Game) => boolean,
  actions: SaphoStartedMovementStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSaphoStartedMovementStep(game); assert.ok(step, 'Complete the original owned control first');
    game = actSaphoStartedMovement(game, step.actor, step.action, actions);
  }
  throw Error('The native Sapho programme did not reach its finite boundary');
}

/** Original public Basic or Advanced setup, actual cache1 purchase and positive
 * shipment. Only unopened original deal/Spice ordering and original scalar
 * lotteries are selected; no played custody, resources, phase or queue is set. */
export function createSaphoStartedMovementFixture(options: { advanced?: boolean; guildTake?: boolean;
  truthFor?: readonly ('richese' | 'guild')[]; ownerBeforeAtreides?: boolean } = {}) {
  const advanced = options.advanced ?? false, guildTake = options.guildTake ?? false;
  assert.ok(!guildTake || advanced, 'Flexible Guild TAKE is an original Advanced rule');
  const owner = 'emperor', guild = 'guild', canceler = 'atreides';
  let game = createGame('SAPHOSTARTEDMOVEMENT', newPlayer('richese', 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['atreides', 'emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: SaphoStartedMovementStep[] = [];
  const act = (actor: string, action: Action) => { game = actSaphoStartedMovement(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSaphoStartedMovement(game, until, actions); };
  if (options.ownerBeforeAtreides) {
    act('atreides', { type: 'seatPosition', position: 5 });
    act(owner, { type: 'seatPosition', position: 2 });
    act('atreides', { type: 'seatPosition', position: 3 });
  }
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = saphoStartedMovementInventory(game); assert.equal(originalInventory.length, 45);
  const index = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(index >= 0);
  const counter = game.deck[index].id;
  [game.deck[1], game.deck[index]] = [game.deck[index], game.deck[1]];
  const truthFor = options.truthFor ?? [];
  assert.ok(truthFor.length <= 2 && new Set(truthFor).size === truthFor.length,
    'Select at most the two original unopened Truthtrance cards');
  const startingTruthSelection = truthFor.map(actor => {
    const position = game.players.findIndex(player => player.id === actor);
    const from = game.deck.findIndex((card, index) => index >= position && card.effect === 'truthtrance');
    assert.ok(position >= 0 && from >= position, 'The selected original Truth must remain in the unopened starting deal');
    const card = game.deck[from].id;
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { actor, position, from, card };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), front: Game['spiceDeck'] = [];
  assert.ok(saphoStartedMovementPlayer(game, canceler).hand.some(card => card.id === counter));
  for (const row of startingTruthSelection)
    assert.ok(saphoStartedMovementPlayer(game, row.actor).hand.some(card => card.id === row.card));
  const spiceInventory = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  for (let count = 0; count < (advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), spiceInventory);
  let beforeBid: Game | undefined, bidStep: SaphoStartedMovementStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !saphoStartedMovementPlayer(game, owner).hand.some(card => card.id === STARTED_MOVEMENT_SAPHO); count++) {
    const step = nextSaphoStartedMovementStep(game); assert.ok(step);
    if (step.actor === owner && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bidStep = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bidStep && bidAt >= 0);
  assert.ok(saphoStartedMovementPlayer(game, owner).hand.some(card => card.id === STARTED_MOVEMENT_SAPHO));
  const acquired = structuredClone(game), acquisition = {
    before: beforeBid, bid: bidStep, steps: structuredClone(actions.slice(bidAt)), after: acquired,
  };
  assert.equal(saphoStartedMovementPlayer(beforeBid, owner).spice - saphoStartedMovementPlayer(game, owner).spice, 1);
  assert.equal(saphoStartedMovementPlayer(game, 'richese').spice - saphoStartedMovementPlayer(beforeBid, 'richese').spice, 1);
  const timing: { before: Game; step: SaphoStartedMovementStep; declared: Game; after: Game }[] = [];
  if (advanced) {
    reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'guildTiming');
    const before = structuredClone(game), step: SaphoStartedMovementStep = { actor: guild,
      action: { type: 'decision', take: guildTake } };
    act(step.actor, step.action); const declared = structuredClone(game); reach(saphoStartedMovementClean);
    timing.push({ before, step, declared, after: structuredClone(game) });
  } else reach(state => state.phase === 5 && saphoStartedMovementClean(state));
  const beforeShipment = structuredClone(game), current = game.active; assert.ok(current && current !== owner);
  assert.equal(current, guildTake ? guild : 'richese');
  const step: SaphoStartedMovementStep = { actor: current,
    action: { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 } };
  const shipmentAt = actions.length;
  act(step.actor, step.action); const declared = structuredClone(game); reach(saphoStartedMovementClean);
  const shipment = { before: beforeShipment, step, declared,
    steps: structuredClone(actions.slice(shipmentAt)), after: structuredClone(game) };
  assert.equal(game.active, current); assert.equal(saphoStartedMovementPlayer(game, current).shipped, true);
  assert.equal(saphoStartedMovementPlayer(game, current).moved, 0);
  assert.equal(saphoStartedMovementPlayer(beforeShipment, current).spice - saphoStartedMovementPlayer(game, current).spice,
    current === guild ? 1 : 2);
  assert.equal(saphoStartedMovementPlayer(beforeShipment, current).reserves - saphoStartedMovementPlayer(game, current).reserves, 1);
  assert.equal(saphoStartedMovementPlayer(game, current).forces['polar_sink:0'], 1);
  assert.equal(saphoStartedMovementPlayer(game, owner).shipped, false);
  assert.equal(saphoStartedMovementPlayer(game, owner).moved, 0);
  assert.ok(saphoStartedMovementPlayer(game, canceler).hand.some(card => card.id === counter));
  assert.deepEqual(saphoStartedMovementInventory(game), originalInventory);
  const source = structuredClone(game);
  return { game, source, advanced, guildTake, owner, guild, canceler, counter, karama: counter,
    card: STARTED_MOVEMENT_SAPHO, current, actor: current, beforeShipment, shipment,
    lobby, setup, beforeStartingDeal, startingTruthSelection, afterSetup, acquired, acquisition, timing,
    originalInventory, originalCards: originalInventory, actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      ...(options.ownerBeforeAtreides ? ['The original lobby uses real seat-position actions to seat Emperor before Atreides; default seating is unchanged.'] : []),
      'Actual public ready/start (Advanced uses the original preview acknowledgement), original setup and paid cache1 purchase give Emperor the physical Sapho. Only an unopened original Atreides Karama deal position, one Basic/two Advanced original land Spice positions and scoped scalar lotteries are selected.',
      `The original ${advanced ? guildTake ? 'Guild TAKE' : 'Guild WAIT' : 'Basic in-order turn'} is followed by an actual one-force Polar Sink shipment costing ${current === guild ? 1 : 2}. The source stops after all original shipment responses settle, before Sapho or the current actor’s ground move/end. No dealt hand, balance, force, phase, queue, timing grant or pending receipt is installed.`,
    ] };
}
export type SaphoStartedMovementFixture = ReturnType<typeof createSaphoStartedMovementFixture>;

/** afterCurrent is projected explanation, never an action field. */
export function saphoStartedMovementAction(game: Game, mode: 'first' | 'last', owner = 'emperor'): Action {
  const option = viewGame(game, owner).saphoOptions.find(option => option.scope === 'movement' && option.mode === mode);
  assert.ok(option, `The actual waiting tail must offer Sapho ${mode}`);
  return { type: 'card', card: STARTED_MOVEMENT_SAPHO, scope: option.scope, event: option.event, mode: option.mode };
}

/** LABELLED supplemental source: the borrowed canonical fixture physically
 * conserves Sapho/Semuta custody rather than earning their acquisition. Its
 * setup, current shipment, subsequent card disposal and continuation are real.
 * No further card, resource, profile, phase or queue assignment is made here. */
export function createSaphoStartedSemutaFixture(advanced = false) {
  const inherited = createSemutaHomeworldSaphoFixture('movement', 'last', advanced);
  let game = structuredClone(inherited.game);
  const actions: SaphoStartedMovementStep[] = [];
  const beforeShipment = structuredClone(game), current = game.active; assert.ok(current && current !== inherited.owner);
  const sources = nativeShipmentSources(viewGame(game, current), 1, 0); assert.ok(sources);
  const step: SaphoStartedMovementStep = { actor: current, action: { type: 'ship', territory: 'polar_sink',
    sector: 0, amount: 1, elite: 0, homeworldSources: sources, allyPayment: 0 } };
  game = applySemutaHomeworldChoamStep(game, step.actor, step.action, actions);
  game = advanceSemutaHomeworldChoam(game, saphoStartedMovementClean, actions);
  assert.equal(game.active, current); assert.equal(saphoStartedMovementPlayer(game, current).shipped, true);
  assert.equal(saphoStartedMovementPlayer(beforeShipment, current).spice - saphoStartedMovementPlayer(game, current).spice, 2);
  const shipment = { before: beforeShipment, step, after: structuredClone(game), steps: structuredClone(actions) };
  const option = viewGame(game, inherited.owner).saphoOptions.find(option => option.scope === 'movement' && option.mode === 'last');
  assert.ok(option, 'The original owner changes last position in this waiting tail');
  const action: Action = { type: 'card', card: inherited.card, scope: option.scope, event: option.event, mode: option.mode };
  const originalInventory = saphoStartedMovementInventory(inherited.game);
  assert.deepEqual(saphoStartedMovementInventory(game), originalInventory);
  return { ...inherited, game, source: structuredClone(game), current, actor: current, action, event: option.event,
    advanced, beforeShipment, shipment, originalInventory,
    sourceActionCount: inherited.actions.length + actions.length, actions: [...inherited.actions, ...actions],
    nativeAcquisition: false,
    staging: [...inherited.staging,
      'Inherited CONTROLLED conserved Sapho/Semuta custody is supplemental, not a native purchase claim. This new branch actually pays two spice to ship one original Homeworld force to Polar Sink before queued LAST, with no added played-state assignments.'] };
}

/** Finish each actual combined turn once. Following Emperor/Guild turns make
 * real paid shipments; an already shipped current actor only completes its
 * original turn. Native Guild choices/response controls remain real actions. */
export function finishSaphoStartedMovement(state: Game, fixture: Pick<SaphoStartedMovementFixture, 'owner' | 'guild'>,
  options: { guildTake?: boolean; shipFollowing?: boolean } = {}, actions: SaphoStartedMovementStep[] = []) {
  let game = state;
  const turns: { actor: string; before: Game; shipment: SaphoStartedMovementStep | null;
    afterShipment: Game; end: SaphoStartedMovementStep; afterEnd: Game }[] = [];
  const timing: { before: Game; step: SaphoStartedMovementStep; declared: Game; after: Game }[] = [];
  const act = (actor: string, action: Action) => { game = actSaphoStartedMovement(game, actor, action, actions); };
  for (let count = 0; game.phase === 5 && count < 160; count++) {
    if (!saphoStartedMovementClean(game)) {
      if (!game.response && !game.phaseOpening && game.decision?.kind === 'guildTiming') {
        const before = structuredClone(game), step: SaphoStartedMovementStep = { actor: fixture.guild,
          action: { type: 'decision', take: options.guildTake ?? false } };
        act(step.actor, step.action); const declared = structuredClone(game);
        game = advanceSaphoStartedMovement(game, saphoStartedMovementClean, actions);
        timing.push({ before, step, declared, after: structuredClone(game) });
      } else {
        const step = nextSaphoStartedMovementStep(game); assert.ok(step); act(step.actor, step.action);
      }
      continue;
    }
    const actor = game.active; assert.ok(actor && !turns.some(turn => turn.actor === actor));
    const before = structuredClone(game);
    const shipment: SaphoStartedMovementStep | null = options.shipFollowing !== false &&
      (actor === fixture.owner || actor === fixture.guild) && !saphoStartedMovementPlayer(game, actor).shipped
      ? { actor, action: { type: 'ship', territory: actor === fixture.owner ? 'imperial_basin' : 'carthag',
        sector: actor === fixture.owner ? 9 : 11, amount: 1, elite: 0, allyPayment: 0 } } : null;
    if (shipment) {
      act(shipment.actor, shipment.action); game = advanceSaphoStartedMovement(game, saphoStartedMovementClean, actions);
    }
    const afterShipment = structuredClone(game), end: SaphoStartedMovementStep = { actor, action: { type: 'endMovement' } };
    act(end.actor, end.action); turns.push({ actor, before, shipment, afterShipment, end, afterEnd: structuredClone(game) });
  }
  assert.notEqual(game.phase, 5, 'Every original combined turn must finish finitely');
  return { game, turns, timing, actions };
}
