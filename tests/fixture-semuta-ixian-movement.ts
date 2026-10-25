import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { MOBILE_LOCATION, TERRITORIES, location, mobileRoutes, mobileRouteDistance, splitLocation } from '../game/board';
import { botGroundMoveAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { stormCardDistance } from '../game/storm-cards';
import {
  createSemutaIxianAuctionFixture, actSemutaIxianAuction, nextSemutaIxianAuctionStep,
  semutaIxianAuctionPlayer, semutaIxianAuctionInventory, type SemutaIxianAuctionStep,
} from './fixture-semuta-ixian-auction';

export type SemutaIxianMovementStep = SemutaIxianAuctionStep;
export type SemutaIxianMovementKind = 'ixMovement' | 'mobileStronghold';
export const actSemutaIxianMovement = actSemutaIxianAuction;
export const semutaIxianMovementPlayer = semutaIxianAuctionPlayer;
export const semutaIxianMovementInventory = semutaIxianAuctionInventory;
export const semutaIxianMovementClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingIxMove &&
  !game.pendingMobileMove && !game.pendingChoamMove;
export function semutaIxianMovementStorm(game: Game) {
  return { turn: game.turn, phase: game.phase, storm: game.storm, pending: game.stormPending,
    source: game.stormMovementSource, dialers: game.stormDialers, dials: game.stormDials,
    card: game.stormCard, known: game.stormCardKnown,
    revealedCards: game.log.flatMap(entry => { const distance = stormCardDistance(entry.component); return distance === null ? [] : [distance]; }),
    turnBeginnings: game.log.filter(entry => entry.text === `Turn ${game.turn} begins.`).length };
}
/** Never silently answer the tested movement counter, fresh disposal or native
 * next-turn HMS route chooser. Other original optional controls are declined. */
export function nextSemutaIxianMovementStep(game: Game): SemutaIxianMovementStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance ||
      game.response?.kind === 'ixMovement' || game.response?.kind === 'mobileStronghold') return null;
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'mobileStronghold' && !game.decision.placement)
    return null;
  return nextSemutaIxianAuctionStep(game);
}
export function advanceSemutaIxianMovement(game: Game, until: (state: Game) => boolean,
  actions: SemutaIxianMovementStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaIxianMovementStep(game);
    assert.ok(next, 'Choose the original movement/route or fresh reaction before continuing');
    game = actSemutaIxianMovement(game, next.actor, next.action, actions);
  }
  throw Error('The native Ixian movement programme did not reach its finite boundary');
}
export function passSemutaIxianMovement(game: Game, actions: SemutaIxianMovementStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaIxianMovement(game, actor.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaIxianMovement(game: Game, holder: string,
  actions: SemutaIxianMovementStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event, card = pending.batch.entries[0].card.id;
  game = actSemutaIxianMovement(game, holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaIxianMovement(game, holder, { type: 'semutaSelect', event, card }, actions);
  return game;
}
/** Finish only the current native allowance. HMS returns at the real newly
 * initialized Storm boundary; caller decides when to reveal/traverse it. */
export function allowSemutaIxianMovement(game: Game, actions: SemutaIxianMovementStep[] = []): Game {
  const kind = game.response?.kind; assert.ok(kind === 'ixMovement' || kind === 'mobileStronghold');
  for (let count = 0; game.response?.kind === kind && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaIxianMovement(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, kind);
  if (kind === 'ixMovement') game = advanceSemutaIxianMovement(game, semutaIxianMovementClean, actions);
  return game;
}

/** Fork the exact native paid-Semuta source before its unused auction counter,
 * then actually allow all original setup/Bidding/Revival controls. No card,
 * resource, force, phase, queue, route or pending movement is installed. */
export function createSemutaIxianMovementFixture(options: { kind?: SemutaIxianMovementKind; advanced?: boolean } = {}) {
  const kind = options.kind ?? 'ixMovement', advanced = options.advanced ?? false;
  const parent = createSemutaIxianAuctionFixture({ advanced });
  let game = structuredClone(parent.game);
  const actions: SemutaIxianMovementStep[] = structuredClone(parent.actions);
  const owner = parent.owner, holder = parent.holder, spender = parent.spender, cost = parent.cost;
  const act = (actor: string, action: Action) => { game = actSemutaIxianMovement(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaIxianMovement(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const originalPoint = game.mobileStronghold!.location; assert.equal(originalPoint, 'polar_sink:0');
  const source = 'polar_sink:0';
  let shipment: { before: Game; steps: SemutaIxianMovementStep[]; after: Game } | null = null;
  let replacement: Action | null = null, destination: string | null = null, replacementDestination: string | null = null;
  let route: string[] | null = null;
  let collection: { location: string; available: number; collected: number }[] = [];
  let nativeAction: Action;
  if (kind === 'ixMovement') {
    reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && semutaIxianMovementClean(state));
    shipment = transition(() => {
      act(owner, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 1, allyPayment: 0 });
      reach(semutaIxianMovementClean);
    });
    assert.equal(semutaIxianMovementPlayer(shipment.before, owner).spice - semutaIxianMovementPlayer(game, owner).spice, 2);
    assert.equal(semutaIxianMovementPlayer(game, owner).forces[source], 1);
    assert.equal(semutaIxianMovementPlayer(game, owner).elites!.forces[source], 1);
    assert.equal(semutaIxianMovementPlayer(game, owner).forces[MOBILE_LOCATION], 6);
    assert.equal(semutaIxianMovementPlayer(game, owner).moved, 0);
    const view = viewGame(game, owner), own = view.players.find(p => p.id === owner)!;
    const emptySand = TERRITORIES.filter(t => t.type === 'sand').flatMap(t => t.sectors.map(sector => location(t.id, sector)))
      .filter(key => splitLocation(key).sector !== game.storm && game.players.every(p => !(p.forces[key] > 0)));
    destination = emptySand.find(key => groundMoveRouteDistance(view, own, source, key) === 2 &&
      botGroundMoveAllowed(view, own, source, key, 1)) ?? null;
    replacementDestination = emptySand.find(key => groundMoveRouteDistance(view, own, source, key) === 1 &&
      botGroundMoveAllowed(view, own, source, key, 1)) ?? null;
    assert.ok(destination && replacementDestination, 'The actually shipped Cyborg has real two- and one-step destinations');
    nativeAction = { type: 'move', forces: { [source]: 1 }, eliteForces: { [source]: 1 }, ...splitLocation(destination) };
    replacement = { type: 'move', forces: { [source]: 1 }, eliteForces: { [source]: 1 }, ...splitLocation(replacementDestination) };
  } else {
    reach(state => state.turn === 2 && state.phase === 0 && !state.response && !state.phaseOpening &&
      state.decision?.kind === 'mobileStronghold' && !state.decision.placement);
    const passengers = semutaIxianMovementPlayer(game, owner).forces[MOBILE_LOCATION]; assert.equal(passengers, 6);
    // Prefer a genuinely positive prior blow beyond the next ordinary Storm's
    // maximum sector7, so post-Storm continuation can also inspect the same pile.
    route = mobileRoutes(game, 3).find(candidate => candidate.some(key => (game.spice[key] ?? 0) > 0) &&
      candidate.filter(key => (game.spice[key] ?? 0) > 0).every(key => splitLocation(key).sector > 7)) ?? null;
    assert.ok(route, `Native HMS needs a printed <=3 route over actual prior Spice: ${JSON.stringify(game.spice)}`);
    assert.ok(mobileRouteDistance(route) <= 3);
    collection = route.filter(key => (game.spice[key] ?? 0) > 0).map(key => ({ location: key,
      available: game.spice[key], collected: Math.min(game.spice[key], passengers * 2) }));
    assert.ok(collection.length && collection.reduce((sum, pile) => sum + pile.collected, 0) > 0);
    nativeAction = { type: 'decision', route, collect: true };
    destination = route.at(-1)!;
  }
  const beforeDeclaration = structuredClone(game), declaration = transition(() => act(owner, nativeAction));
  assert.equal(game.response?.kind, kind); assert.equal(game.response?.owner, owner);
  if (kind === 'ixMovement') {
    assert.ok(game.pendingIxMove); assert.equal(semutaIxianMovementPlayer(game, owner).moved, 0);
    assert.deepEqual(semutaIxianMovementPlayer(game, owner).forces, semutaIxianMovementPlayer(beforeDeclaration, owner).forces);
  } else {
    assert.deepEqual(game.pendingMobileMove?.route, route); assert.equal(game.pendingMobileMove?.collect, true);
    assert.equal(game.mobileStronghold!.location, originalPoint);
    assert.deepEqual(game.spice, beforeDeclaration.spice);
  }
  assert.ok(semutaIxianMovementPlayer(game, holder).hand.some(card => card.id === parent.semuta));
  assert.ok(semutaIxianMovementPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaIxianMovementInventory(game), parent.originalInventory);
  const gameSource = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source: gameSource, beforeCost: gameSource, kind, advanced, owner, holder, spender,
    cost, karama: cost, card: cost, semuta: parent.semuta, action, nativeAction, beforeDeclaration, declaration,
    pending: structuredClone(kind === 'ixMovement' ? game.pendingIxMove : game.pendingMobileMove),
    shipment, sourceLocation: source, destination, replacement, replacementDestination,
    originalPoint, route, collect: kind === 'mobileStronghold', collection,
    collectionAmount: collection.reduce((sum, pile) => sum + pile.collected, 0),
    stormBefore: structuredClone(semutaIxianMovementStorm(game)), parent,
    acquisition: parent.acquisition, acquired: parent.acquired, setup: parent.setup, afterSetup: parent.afterSetup,
    originalInventory: parent.originalInventory, originalCards: parent.originalInventory,
    inheritedActionCount: parent.sourceActionCount, actions, steps: actions, sourceActionCount: actions.length,
    staging: [...parent.staging,
      'Fork the original paid-cache source before its unused Karama counter, then actually allow the original Ix pool, optional Technology decline, Atreides inspection and native normal auctions/Revival. Originally dealt Atreides Karama and paid CHOAM Semuta remain held.',
      kind === 'ixMovement' ? 'Ix actually pays2 to ship one original Cyborg reserve to Polar Sink, then declares an empty two-step sand destination through its printed movement advantage. A distinct empty one-step native replacement is exposed; no move or counter is precompleted.' : `Every actual first-turn combined turn ends without moving the six original HMS passengers. Native first Collection leaves the actual prior Spice blow untouched. At the original second-turn HMS chooser, declare collect:true on the real printed route ${route!.join(' → ')} over ${collection.map(pile => `${pile.location}=${pile.available}`).join(', ')}. No Spice, route, force or income is installed.`,
      'Stop before the actual cancellation cost. Native ground denial keeps the current move unused; native HMS denial clears the route and begins the original Storm exactly once. A later Storm reveal/resolution is a legitimate suffix, not state that this source pretends frozen.',
    ] };
}
export type SemutaIxianMovementFixture = ReturnType<typeof createSemutaIxianMovementFixture>;
