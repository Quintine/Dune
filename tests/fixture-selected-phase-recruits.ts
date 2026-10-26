import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES, location } from '../game/board';
import { RECRUITS_CARD_ID, recruitsPlayAction } from '../game/recruits';
import {
  createMixedPhaseModulesFixture, MIXED_PHASE_NATIVE_FACTIONS,
  actMixedPhaseModules, mixedPhaseModulesClean, mixedPhaseModulesInventory,
  mixedPhaseModulesPlayer, nextMixedPhaseModules,
  type MixedPhaseModulesStep, type MixedPhaseModulesTransition,
} from './fixture-mixed-phase-modules';

export const actSelectedPhaseRecruits = actMixedPhaseModules;
export const selectedPhaseRecruitsClean = mixedPhaseModulesClean;
export const selectedPhaseRecruitsInventory = mixedPhaseModulesInventory;
export const selectedPhaseRecruitsPlayer = mixedPhaseModulesPlayer;
export type SelectedPhaseRecruitsStep = MixedPhaseModulesStep;
export type SelectedPhaseRecruitsTransition = MixedPhaseModulesTransition;

/** The actual Ixian inspection keeps Recruits in its original auction pool;
 * a real Mori bid1 buys that unopened first ordinary lot. All other native
 * choices retain the shared source driver and its physical phase accounting. */
export function nextSelectedPhaseRecruits(game: Game): SelectedPhaseRecruitsStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard && game.decision?.kind === 'ixAuction') {
    const returned = game.ixAuction!.cards.find(card => card.id !== RECRUITS_CARD_ID); assert.ok(returned);
    return { actor: game.decision.player,
      action: { type: 'decision', card: returned.id, position: 'bottom' } };
  }
  const auction = game.auction;
  if (selectedPhaseRecruitsClean(game) && auction?.cards[auction.index]?.id === RECRUITS_CARD_ID &&
    auction.active === 'moritani' && auction.bid === 0)
    return { actor: 'moritani', action: { type: 'bid', amount: 1 } };
  return nextMixedPhaseModules(game);
}
export function advanceSelectedPhaseRecruits(game: Game, until: (state: Game) => boolean,
  actions: SelectedPhaseRecruitsStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Recruits source ended before its next control');
    const step = nextSelectedPhaseRecruits(game);
    assert.ok(step, `Choose the actual native control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSelectedPhaseRecruits(game, step.actor, step.action, actions);
  }
  throw Error('The original selected-phase Recruits source did not reach its finite boundary');
}
export function finishSelectedPhaseRecruits(game: Game, actions: SelectedPhaseRecruitsStep[] = []): Game {
  return advanceSelectedPhaseRecruits(game, state => state.phase === 5 && selectedPhaseRecruitsClean(state), actions);
}

/** All six native seats and all three original family decks. Public independent
 * cards/Tech selections and optional Advanced Strongholds precede normal start.
 * The sole new lottery is the still-unopened remaining Recruits position before
 * the first ordinary auction. Actual inspection, bid/payment/acquisition,
 * shipment3, next Storm and phase progression supply the played source.
 * No played hand, force, wallet, Tanks, phase, queue or receipt is installed. */
export function createSelectedPhaseRecruitsFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false, owner = 'moritani', bankOwner = 'tleilaxu';
  const source = createMixedPhaseModulesFixture({ factions: MIXED_PHASE_NATIVE_FACTIONS,
    expansions: ['ix', 'choam', 'ecaz'], advanced, tech: true, strongholds: advanced, independent: true });
  let game = source.game;
  const actions = [...source.actions];
  const act = (actor: string, action: Action) => { game = actSelectedPhaseRecruits(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSelectedPhaseRecruits(game, until, actions); };
  const transition = (run: () => void): SelectedPhaseRecruitsTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  assert.equal(game.phase, 1); assert.ok(game.ecazTreachery && game.techTokens);
  const beforeAuctionOrder = structuredClone(game);
  const from = game.deck.findIndex(card => card.id === RECRUITS_CARD_ID); assert.ok(from >= 0,
    'The original scalar setup leaves physical Recruits undealt for this ordinary auction');
  const recruits = game.deck.splice(from, 1)[0]; game.deck.unshift(recruits);
  const unopenedAuctionOrder = { card: recruits.id, from, to: 0 };
  assert.deepEqual(selectedPhaseRecruitsInventory(game), source.originalInventory);
  let beforeBid: Game | undefined, bid: SelectedPhaseRecruitsStep | undefined, bidAt = -1;
  for (let count = 0; !selectedPhaseRecruitsPlayer(game, owner).hand.some(card => card.id === RECRUITS_CARD_ID) && count < 1000; count++) {
    const step = nextSelectedPhaseRecruits(game); assert.ok(step);
    if (step.actor === owner && step.action.type === 'bid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
      assert.equal(game.auction?.index, 0, 'Recruits is the actual first ordinary lot');
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquisition = { before: beforeBid, bid, steps: structuredClone(actions.slice(bidAt)), after: structuredClone(game) };
  assert.equal(selectedPhaseRecruitsPlayer(beforeBid, owner).spice - selectedPhaseRecruitsPlayer(game, owner).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && selectedPhaseRecruitsClean(state));
  const sector = game.storm % 18 + 1;
  const target = TERRITORIES.find(t => t.type === 'sand' && t.id !== 'imperial_basin' && t.sectors.includes(sector) &&
    game.players.every(player => !Object.entries(player.forces).some(([key, count]) => count > 0 && key.startsWith(`${t.id}:`))));
  assert.ok(target, 'A native empty desert lies in the next Storm traversal');
  const casualtyLocation = location(target.id, sector);
  const shipment = transition(() => {
    act(owner, { type: 'ship', territory: target.id, sector, amount: 3, elite: 0, allyPayment: 0 });
    reach(selectedPhaseRecruitsClean);
  });
  assert.equal(selectedPhaseRecruitsPlayer(game, owner).forces[casualtyLocation], 3);
  assert.equal(selectedPhaseRecruitsPlayer(shipment.before, owner).spice - selectedPhaseRecruitsPlayer(game, owner).spice, 6);
  reach(state => state.turn === 1 && state.phase === 8 && selectedPhaseRecruitsClean(state));
  const mentat = transition(() => {
    reach(state => state.turn === 2 && state.phase === 0 && state.stormPending !== null && selectedPhaseRecruitsClean(state));
  });
  assert.equal(game.stormMovementSource?.kind, advanced ? 'card' : 'dials');
  assert.equal(game.stormPending, advanced ? 1 : 2);
  const storm = transition(() => { reach(state => state.turn === 2 && state.phase === 1 && selectedPhaseRecruitsClean(state)); });
  assert.equal(selectedPhaseRecruitsPlayer(game, owner).forces[casualtyLocation], undefined);
  assert.equal(selectedPhaseRecruitsPlayer(game, owner).tanks, 3);
  reach(state => state.turn === 2 && state.phase === 4 && selectedPhaseRecruitsClean(state) &&
    (!state.revivalOrder || state.revivalOrder.remaining[0] === owner));
  const playAction = recruitsPlayAction(viewGame(game, owner).recruitsPreview); assert.ok(playAction);
  const revivalAction: Action = { type: 'revive', amount: 3, elite: 0 };
  assert.deepEqual(selectedPhaseRecruitsInventory(game), source.originalInventory);
  return { ...source, game, sourceGame: structuredClone(game), advanced, owner, bankOwner,
    card: RECRUITS_CARD_ID, playAction, revivalAction, beforeAuctionOrder, unopenedAuctionOrder,
    acquisition, shipment, mentat, storm, casualtyLocation,
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[], lottery: 'Original unopened deal/Spice/scalar choices from the shared native source, plus unopened Recruits first-lot order; actual Ix inspection returns a different physical card.' };
}
export type SelectedPhaseRecruitsFixture = ReturnType<typeof createSelectedPhaseRecruitsFixture>;

/** Original card use, normal three-counter return and exact final phase payout.
 * The source remains reusable before play for actual GameTable callbacks. */
export function completeSelectedPhaseRecruits(f: SelectedPhaseRecruitsFixture, state = f.game) {
  let game = state;
  const actions: SelectedPhaseRecruitsStep[] = [];
  const act = (actor: string, action: Action) => { game = actSelectedPhaseRecruits(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSelectedPhaseRecruits(game, until, actions); };
  const transition = (run: () => void): SelectedPhaseRecruitsTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  const play = transition(() => { act(f.owner, f.playAction); reach(selectedPhaseRecruitsClean); });
  const revival = transition(() => { act(f.owner, f.revivalAction); reach(selectedPhaseRecruitsClean); });
  reach(state => state.phase === 4 && selectedPhaseRecruitsClean(state) && (state.revivalOrder
    ? state.revivalOrder.remaining.length === 1 : state.ready.length === state.players.length - 1));
  const revivalPayout = transition(() => {
    const step = nextSelectedPhaseRecruits(game); assert.ok(step); act(step.actor, step.action);
    reach(state => state.phase === 5 && selectedPhaseRecruitsClean(state));
  });
  assert.deepEqual(selectedPhaseRecruitsInventory(game), f.originalInventory);
  return { game, play, revival, revivalPayout, actions, actionCount: actions.length };
}
