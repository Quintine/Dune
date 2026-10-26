import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import { nextSemutaGuildIncomeNativeStep } from './fixture-semuta-guild-income';

export const DISTRANS_PREBID_CARD = 'richese-distrans';
export type DistransPrebidStep = { actor: string; action: Action };
export type DistransPrebidCapacity = 'ordinary' | 'donorFull' | 'recipientLastSlot' | 'recipientFull';
export type DistransPrebidOptions = { advanced?: boolean; capacity?: DistransPrebidCapacity;
  truthFor?: readonly ('r' | 'a' | 'e')[] };

export function distransPrebidPlayer(game: Game, id: string) {
  const player = game.players.find(player => player.id === id);
  assert.ok(player, `Original Distrans seat ${id} must remain present`);
  return player;
}
export const distransPrebidClean = (game: Game): boolean =>
  !game.phaseOpening && !game.response && !game.decision && !game.truthtrance &&
  !game.pendingTreacheryDiscard && !game.pendingNullentropy;
export function distransPrebidUntouched(game: Game): boolean {
  const lot = game.auction;
  return game.status === 'playing' && game.phase === 3 && distransPrebidClean(game) &&
    !game.richeseAuction && !game.currentAuctionSale && !!lot &&
    !!lot.cards[lot.index] && lot.bid === 0 && lot.bidder === null &&
    lot.passed.length === 0 && (lot.allyPayment ?? 0) === 0;
}
/** Sold ordinary prefixes alias the delivered card; only unpaid pool entries
 * are physical custody. Cache offers remain in their original cache. */
export function distransPrebidInventory(game: Game): string[] {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original Treachery Card occupies one physical zone');
  return ids;
}
/** The native table, lot and physical resources excluding the two changed hands
 * and the used card's discard. No declaration, price or opening is replayed. */
export function distransPrebidPosition(game: Game) {
  return {
    status: game.status, turn: game.turn, phase: game.phase, active: game.active,
    order: game.order, ready: game.ready, auction: game.auction,
    richeseBidding: game.richeseBidding, richeseAuction: game.richeseAuction,
    currentAuctionSale: game.currentAuctionSale, richeseFunding: game.richeseFunding,
    deck: game.deck, richeseCache: game.richeseCache, richeseRemoved: game.richeseRemoved,
    response: game.response, decision: game.decision, phaseOpening: game.phaseOpening,
    players: game.players.map(player => ({ ...player, hand: undefined })),
  };
}
export function actDistransPrebid(game: Game, actor: string, action: Action,
  actions: DistransPrebidStep[] = []): Game {
  actions.push({ actor, action: structuredClone(action) });
  return withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
}
/** Real cache selection and one-spice Guild bid. Every other setup, response,
 * auction and phase action retains the existing neutral native policy. */
export function nextDistransPrebidStep(game: Game): DistransPrebidStep {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'richeseCache' &&
      game.richeseCache?.some(card => card.id === DISTRANS_PREBID_CARD))
      return { actor: decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: DISTRANS_PREBID_CARD, method: 'onceAround', direction: 'counterclockwise' } };
    if (!decision && game.richeseAuction?.cardId === DISTRANS_PREBID_CARD &&
      !game.richeseAuction.outcome && game.richeseAuction.active === 'g' && game.richeseAuction.bid === 0)
      return { actor: 'g', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  }
  return nextSemutaGuildIncomeNativeStep(game);
}
export function advanceDistransPrebid(game: Game, until: (game: Game) => boolean,
  actions: DistransPrebidStep[] = []): Game {
  for (let count = 0; count < 1500; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Distrans table ended before its requested boundary');
    const next = nextDistransPrebidStep(game);
    game = actDistransPrebid(game, next.actor, next.action, actions);
  }
  throw Error('The native Distrans programme did not reach its finite boundary');
}
/** Buy the actual current ordinary card for one spice, passing only live owners.
 * This may close a preceding lot; it never installs a hand, price or opener. */
export function buyDistransPrebidLot(game: Game, winner: string,
  actions: DistransPrebidStep[] = []) {
  assert.ok(distransPrebidUntouched(game));
  const before = structuredClone(game), start = actions.length, card = game.auction!.cards[game.auction!.index].id;
  assert.ok(distransPrebidPlayer(game, winner).hand.length < handLimit(distransPrebidPlayer(game, winner)));
  for (let count = 0; count < 200; count++) {
    if (distransPrebidPlayer(game, winner).hand.some(held => held.id === card) &&
      distransPrebidClean(game) && !game.currentAuctionSale)
      return { game, purchase: { before, card, winner, amount: 1,
        actions: structuredClone(actions.slice(start)), after: structuredClone(game) } };
    let next: DistransPrebidStep;
    if (distransPrebidClean(game) && game.auction && !game.currentAuctionSale) {
      const actor = game.auction.active;
      next = { actor, action: actor === winner && game.auction.bid === 0
        ? { type: 'bid', amount: 1, allyPayment: 0 } : { type: 'passBid' } };
    } else next = nextDistransPrebidStep(game);
    game = actDistransPrebid(game, next.actor, next.action, actions);
  }
  throw Error('The actual one-spice ordinary purchase did not finish');
}
/** Retire only the original now-bid lot and its real payment/response. Stop
 * at the next untouched lot or actual next phase, before another declaration. */
export function finishDistransPrebidLot(game: Game, turn: number, index: number,
  actions: DistransPrebidStep[] = []): Game {
  return advanceDistransPrebid(game, state => distransPrebidClean(state) && !state.currentAuctionSale &&
    (state.turn !== turn || state.phase !== 3 || !state.auction || state.auction.index !== index), actions);
}

/** Fresh public R/G/A/E start in Basic or explicit Advanced preview. Only the
 * unopened four-card starting deal, four unopened non-worm Spice positions and
 * scalar lotteries are selected. Guild really pays1 for canonical Distrans.
 * Optional capacities use actual one-spice ordinary purchases; the full target
 * retains its earned hand through native no-spend play into turn2. No played
 * hand, wallet, alliance, board, clock, lot, payment or bonus is installed. */
export function createDistransPrebidFixture(options: DistransPrebidOptions = {}) {
  const advanced = options.advanced ?? false, capacity = options.capacity ?? 'ordinary';
  let game = createGame('DISTRANSPREBID', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  for (const [id, name, faction] of [['g', 'Guild', 'guild'], ['a', 'Atreides', 'atreides'],
    ['e', 'Emperor', 'emperor']] as const) joinGame(game, newPlayer(id, name, faction));
  const actions: DistransPrebidStep[] = [];
  const act = (actor: string, action: Action) => { game = actDistransPrebid(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceDistransPrebid(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const initial = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  const truthFor = options.truthFor ?? [];
  assert.ok(truthFor.length <= 2 && new Set(truthFor).size === truthFor.length,
    'Select at most the two original unopened Truthtrance cards');
  const startingDealSelection: { actor: string; position: number; from: number; card: string }[] = [];
  for (const [actor, kind] of [['r', 'projectile'], ['g', 'shield'], ['a', 'poison'], ['e', 'snooper']] as const) {
    const position = game.players.findIndex(player => player.id === actor);
    const truth = truthFor.some(id => id === actor);
    const from = game.deck.findIndex((card, index) => index >= position && (truth ? card.effect === 'truthtrance' : card.kind === kind));
    assert.ok(from >= position, `The original ${actor} starting card remains unopened`);
    const card = game.deck[from].id;
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    startingDealSelection.push({ actor, position, from, card });
  }
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), originalInventory = distransPrebidInventory(game);
  assert.equal(originalInventory.length, 45);
  for (const { actor, card } of startingDealSelection)
    assert.ok(distransPrebidPlayer(game, actor).hand.some(held => held.id === card));
  const land: Game['spiceDeck'] = [];
  for (let count = 0; count < 4; count++) {
    const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
    assert.ok(index >= 0); land.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...land);
  const beforeStorm = structuredClone(game);
  reach(state => state.decision?.kind === 'richeseCache');
  const beforePurchase = structuredClone(game), acquisitionStart = actions.length;
  reach(state => distransPrebidPlayer(state, 'g').hand.some(card => card.id === DISTRANS_PREBID_CARD) &&
    distransPrebidUntouched(state));
  const acquired = structuredClone(game), acquisition = { before: beforePurchase,
    actions: structuredClone(actions.slice(acquisitionStart)), after: acquired };
  assert.ok(acquisition.actions.some(step => step.actor === 'g' && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(distransPrebidPlayer(game, 'g').spice, distransPrebidPlayer(beforePurchase, 'g').spice - 1);
  const firstLot = structuredClone(game);
  assert.equal(game.auction!.cards.length, 3);
  const thirdOpener = game.order[(game.auction!.opener + 2) % game.order.length];
  assert.notEqual(thirdOpener, 'g', 'The native third opener is a distinct transfer recipient');
  const recipient = capacity.startsWith('recipient') ? thirdOpener : 'a';
  const purchases: ReturnType<typeof buyDistransPrebidLot>['purchase'][] = [];
  const purchaseCount = capacity === 'recipientFull' ? 3 : capacity === 'ordinary' ? 0 : 2;
  for (let count = 0; count < purchaseCount; count++) {
    const result = buyDistransPrebidLot(game, capacity === 'donorFull' ? 'g' : recipient, actions);
    game = result.game; purchases.push(result.purchase);
  }
  if (capacity === 'recipientFull') reach(state => state.turn === 2 && distransPrebidUntouched(state));
  assert.ok(distransPrebidUntouched(game));
  if (capacity === 'donorFull') assert.equal(distransPrebidPlayer(game, 'g').hand.length, handLimit(distransPrebidPlayer(game, 'g')));
  if (capacity === 'recipientLastSlot') {
    assert.equal(game.auction!.active, recipient);
    assert.equal(game.active, recipient);
    assert.equal(distransPrebidPlayer(game, recipient).hand.length, handLimit(distransPrebidPlayer(game, recipient)) - 1);
  }
  if (capacity === 'recipientFull') assert.equal(distransPrebidPlayer(game, recipient).hand.length, handLimit(distransPrebidPlayer(game, recipient)));
  assert.deepEqual(distransPrebidInventory(game), originalInventory);
  const give = startingDealSelection.find(row => row.actor === 'g')!.card;
  const action: Action = { type: 'card', card: DISTRANS_PREBID_CARD, target: recipient, give };
  return { game, advanced, capacity, holder: 'g', donor: 'g', recipient, card: DISTRANS_PREBID_CARD, give, action,
    startingTruthSelection: startingDealSelection.filter(row => truthFor.some(id => id === row.actor)),
    initial, setup, beforeStartingDeal, startingDealSelection, afterSetup, beforeStorm,
    acquisition, acquired, firstLot, purchases, originalInventory, actions, sourceActionCount: actions.length,
    staging: ['Only unopened starting Treachery/Spice positions and scalar lotteries are selected. All cache/ordinary purchases, hands, prices, clocks and continuations are native public actions.'] };
}
export type DistransPrebidFixture = ReturnType<typeof createDistransPrebidFixture>;
export function playDistransPrebid(fixture: DistransPrebidFixture, game = structuredClone(fixture.game),
  actions: DistransPrebidStep[] = []): Game {
  return actDistransPrebid(game, fixture.holder, fixture.action, actions);
}
