import assert from 'node:assert/strict';
import { applyAction, createGame, handLimit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export const BASIC_TUPILE_WORLD = 'homeworld:choam';
export type BasicTupileStep = { actor: string; action: Action };
export const basicTupilePlayer = (game: Game, actor = 'guild') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const basicTupileClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function actBasicTupile(game: Game, actor: string, action: Action, actions: BasicTupileStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Native controls only; a cleanup and unsealed human plan remain owned
 * choices. Never spend native revival to rebuild the conquered world. */
export function nextBasicTupileStep(game: Game): BasicTupileStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'homeworldTupileCleanup') return null;
    if (decision?.kind === 'homeworldShipmentGuild') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, allow: true } };
    if (decision?.kind === 'homeworldDefense') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, use: false } };
    if (decision?.kind === 'homeworldRevivalDeployment' || decision?.kind === 'caladanReinforcement' ||
      decision?.kind === 'grummanCollection') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, decline: true } };
    if (game.biddingEnd) {
      const actor = game.biddingEnd.owners.find(actor => !game.biddingEnd!.ready.includes(actor));
      if (actor) return { actor, action: { type: 'biddingEnd', event: game.biddingEnd.event, mode: 'ready' } };
    }
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceBasicTupile(game: Game, until: (state: Game) => boolean, actions: BasicTupileStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Basic Tupile programme ended before its next control');
    const step = nextBasicTupileStep(game); assert.ok(step, 'Choose the actual owned Tupile cleanup or human Battle Plan explicitly');
    game = actBasicTupile(game, step.actor, step.action, actions);
  }
  throw Error('The original Basic Tupile programme did not reach its finite boundary');
}
function orderOriginalLand(game: Game) {
  const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(index >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(index, 1)[0]);
}
type BasicTupilePurchase = { before: Game; step: BasicTupileStep; declared: Game; card: string };
/** One-spice bids in original ordinary lots, never direct hand assignment. */
function buyUntil(game: Game, count: number, actions: BasicTupileStep[]) {
  const purchases: BasicTupilePurchase[] = [];
  for (let step = 0; step < 750; step++) {
    if (basicTupilePlayer(game).hand.length === count) return { game, purchases };
    let next: BasicTupileStep | null = null;
    if (basicTupileClean(game) && game.auction?.active === 'guild' && game.auction.bid === 0) {
      const before = structuredClone(game), card = game.auction.cards[game.auction.index].id;
      next = { actor: 'guild', action: { type: 'bid', amount: 1, allyPayment: 0 } };
      game = actBasicTupile(game, next.actor, next.action, actions);
      purchases.push({ before, step: next, declared: structuredClone(game), card }); continue;
    }
    next = nextBasicTupileStep(game); assert.ok(next, 'The actual ordinary auction needs its original next control');
    game = actBasicTupile(game, next.actor, next.action, actions);
  }
  throw Error('The original funded ordinary purchases did not reach their genuine hand size');
}

/** Public Basic Homeworld start; no development initializer or played-save
 * reflag. Three paid normal1 lots fill the original Guild hand to four. Real
 * Atreides shipment income funds the actual invasion and later paid return.
 * A native no-weapon battle creates sole Tupile control and its original slot.
 * Only unopened land Spice positions/scalar lotteries are controlled. */
export function createBasicTupileLifecycleFixture(options: { fifthCard?: boolean } = {}) {
  const fifthCard = options.fifthCard ?? true;
  let game = createGame('BASICTUPILELIFECYCLE', newPlayer('atreides', 'Atreides', 'atreides'), false, ['choam']);
  for (const faction of ['choam', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: BasicTupileStep[] = [];
  const act = (actor: string, action: Action) => { game = actBasicTupile(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceBasicTupile(game, until, actions); };
  act(game.host, { type: 'homeworlds', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  assert.equal(game.homeworldOccupationPreview, true);
  assert.equal(game.homeworldTupilePreview, true);
  const afterSetup = structuredClone(game);
  orderOriginalLand(game);
  reach(state => state.phase === 3 && !!state.auction && basicTupileClean(state));
  const beforeFirstAuction = structuredClone(game);
  const first = buyUntil(game, 4, actions); game = first.game;
  const purchases = [...first.purchases], filledFour = structuredClone(game);
  reach(state => state.phase === 5 && state.active === 'atreides' && basicTupileClean(state));
  const beforeIncome = structuredClone(game), nativeSources = nativeShipmentSources(viewGame(game, 'atreides'), 1, 0); assert.ok(nativeSources);
  const incomeShipment: BasicTupileStep = { actor: 'atreides', action: { type: 'ship',
    territory: 'imperial_basin', sector: 9, amount: 1, elite: 0, allyPayment: 0, homeworldSources: nativeSources } };
  act(incomeShipment.actor, incomeShipment.action); reach(basicTupileClean);
  const afterIncome = structuredClone(game);
  act('atreides', { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === 'guild' && basicTupileClean(state));
  const beforeInvasion = structuredClone(game);
  const invasionQuote = homeworldShipmentChoice(viewGame(game, 'guild'), BASIC_TUPILE_WORLD,
    { 'homeworld:guild': { normal: 2, elite: 0 } });
  assert.ok(invasionQuote.action, invasionQuote.blocked ?? 'The actual native Guild invasion must be available');
  const invasion: BasicTupileStep = { actor: 'guild', action: invasionQuote.action };
  act(invasion.actor, invasion.action); reach(game => basicTupileClean(game) && !game.pendingHomeworldShipment);
  const afterInvasion = structuredClone(game);
  act('guild', { type: 'endMovement' });
  reach(state => state.phase === 6 && !!state.active && basicTupileClean(state));
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices
    .find(choice => choice.territory === BASIC_TUPILE_WORLD); assert.ok(choice);
  const chooseBattle: BasicTupileStep = { actor: choice.chooser, action: { type: 'chooseBattle',
    territory: BASIC_TUPILE_WORLD, target: choice.chooser === 'guild' ? 'choam' : 'guild' } };
  act(chooseBattle.actor, chooseBattle.action);
  reach(state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed !== false && basicTupileClean(state));
  const battle = structuredClone(game);
  const winner = [...basicTupilePlayer(game, 'guild').leaders].filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => b.strength - a.strength)[0];
  const native = [...basicTupilePlayer(game, 'choam').leaders].filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(winner && native && winner.strength + 1 > native.strength);
  const plans: BasicTupileStep[] = [
    { actor: 'guild', action: { type: 'battlePlan', leader: winner.id, dial: 1, support: 0 } },
    { actor: 'choam', action: { type: 'battlePlan', leader: native.id, dial: 0, support: 0 } },
  ];
  for (const step of plans) act(step.actor, step.action);
  reach(state => !state.battle && basicTupileClean(state));
  const occupied = structuredClone(game);
  assert.equal(game.homeworlds!.custody!.visitors[BASIC_TUPILE_WORLD].guild.normal, 1);
  assert.equal(basicTupilePlayer(game, 'choam').reserves, 0);
  assert.equal(basicTupilePlayer(game).tupileHandSlot, true);
  assert.equal(handLimit(basicTupilePlayer(game)), 5);
  reach(state => state.turn === 2 && state.phase === 1 && basicTupileClean(state));
  orderOriginalLand(game);
  let beforeFifth: Game | null = null, acquiredFifth: Game | null = null;
  if (fifthCard) {
    reach(state => state.turn === 2 && state.phase === 3 && !!state.auction && basicTupileClean(state));
    beforeFifth = structuredClone(game);
    const fifth = buyUntil(game, 5, actions); game = fifth.game; purchases.push(...fifth.purchases);
    acquiredFifth = structuredClone(game);
  }
  reach(state => state.turn === 2 && state.phase === 5 && state.active === 'guild' && basicTupileClean(state));
  assert.equal(basicTupilePlayer(game).hand.length, fifthCard ? 5 : 4);
  assert.equal(game.homeworldTupileState!.leases.length, 1, 'Continuous original control across a turn grants no additional slot');
  return { game, lobby, setup, afterSetup, beforeFirstAuction, filledFour, purchases, beforeIncome, incomeShipment, afterIncome,
    beforeInvasion, invasionQuote, invasion, afterInvasion, beforeBattle, chooseBattle, battle, plans, occupied,
    beforeFifth, acquiredFifth, fifthCard, occupier: 'guild', native: 'choam', incomePayer: 'atreides',
    sourceActionCount: actions.length, actions,
    staging: ['Public Basic Atreides/CHOAM/Guild + original Homeworld selection/start, genuine paid auctions and shipments, and an actual low-dial native Homeworld battle provide every card, force and occupation observation. Only unopened land Spice positions and scalar lotteries are selected. No hand, resource, force, phase, alliance, lease or history is installed; this is not the conserved Semuta/Tupile fixture.'] };
}
export type BasicTupileLifecycleFixture = ReturnType<typeof createBasicTupileLifecycleFixture>;
export function departBasicTupile(fixture: BasicTupileLifecycleFixture) {
  const before = structuredClone(fixture.game), actions: BasicTupileStep[] = [];
  const quote = homeworldShipmentChoice(viewGame(before, fixture.occupier), 'homeworld:guild',
    { [BASIC_TUPILE_WORLD]: { normal: 1, elite: 0 } });
  assert.ok(quote.action, quote.blocked ?? 'The actual last Guild visitor must be able to return');
  const step: BasicTupileStep = { actor: fixture.occupier, action: quote.action };
  let game = actBasicTupile(before, step.actor, step.action, actions);
  game = advanceBasicTupile(game, game => game.decision?.kind === 'homeworldTupileCleanup' ||
    basicTupileClean(game) && !game.pendingHomeworldShipment, actions);
  return { game, before, quote, step, actions };
}
/** Complete only the original hand cleanup, retaining the occupier's current
 * movement turn and unused ordinary movement. No second shipment is issued. */
export function completeBasicTupileLifecycle(fixture: BasicTupileLifecycleFixture) {
  const departure = departBasicTupile(fixture), actions = [...departure.actions];
  let game = departure.game;
  const cleanups: { before: Game; step: BasicTupileStep; after: Game }[] = [];
  for (let count = 0; game.decision?.kind === 'homeworldTupileCleanup' && count < 3; count++) {
    const before = structuredClone(game), actor = game.decision.player;
    const offer = viewGame(game, actor).homeworldTupileCleanup; assert.ok(offer && !offer.blocked);
    const step: BasicTupileStep = { actor, action: { type: 'decision', event: offer.event,
      cards: offer.eligibleCards.slice(0, offer.excess) } };
    game = actBasicTupile(game, step.actor, step.action, actions);
    cleanups.push({ before, step, after: structuredClone(game) });
  }
  game = advanceBasicTupile(game, game => basicTupileClean(game) && !game.pendingHomeworldShipment, actions);
  return { game, departure, cleanups, actions };
}
