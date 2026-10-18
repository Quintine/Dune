import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

const canonicalCard = richeseCards().find(card => card.effect === 'juiceOfSapho'); assert.ok(canonicalCard);
export const CYCLIC_SAPHO = canonicalCard.id;
export type SaphoCyclicStep = { actor: string; action: Action };
export const saphoCyclicPlayer = (game: Game, actor = 'emperor') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const saphoCyclicClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.currentAuctionSale;
export function actSaphoCyclic(game: Game, actor: string, action: Action, actions: SaphoCyclicStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
export function nextSaphoCyclicStep(game: Game, fillHand = false): SaphoCyclicStep | null {
  if (!game.response && !game.phaseOpening) {
    if (game.decision?.kind === 'richeseCache' && game.richeseCache?.some(card => card.id === CYCLIC_SAPHO))
      return { actor: game.decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: CYCLIC_SAPHO, method: 'onceAround', direction: 'clockwise' } };
    if (game.decision?.kind === 'richeseUnbid') return { actor: game.decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  if (saphoCyclicClean(game) && game.richeseAuction?.cardId === CYCLIC_SAPHO &&
    !game.richeseAuction.outcome && game.richeseAuction.active === 'emperor' && game.richeseAuction.bid === 0)
    return { actor: 'emperor', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  if (fillHand && saphoCyclicClean(game) && game.auction?.active === 'emperor' && game.auction.bid === 0 &&
    saphoCyclicPlayer(game).hand.length < 4)
    return { actor: 'emperor', action: { type: 'bid', amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceSaphoCyclic(game: Game, until: (state: Game) => boolean,
  actions: SaphoCyclicStep[] = [], fillHand = false): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Sapho cyclic programme ended before its next owned lot');
    const step = nextSaphoCyclicStep(game, fillHand); assert.ok(step, 'Complete the original private plan before continuing');
    game = actSaphoCyclic(game, step.actor, step.action, actions);
  }
  throw Error('The original Sapho cyclic programme did not reach its finite boundary');
}
function orderLand(game: Game) {
  const front: Game['spiceDeck'] = [];
  for (let count = 0; count < (game.advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}

/** Original public host/setup and native cache1 purchase. Full-hand source
 * buys two further real normal lots; Black Market keeps the bought Sapho until
 * the next turn and offers Richese's genuinely dealt card using normal bidding.
 * Its holder chooses a vacant printed circle before readiness, leaving another
 * bidder before and after it at the original second-turn Storm boundary.
 * Only original scalar lotteries and unopened Spice positions are selected. */
export function createSaphoCyclicAuctionFixture(options: {
  advanced?: boolean; blackMarket?: boolean; fullHand?: boolean;
} = {}) {
  const advanced = options.advanced ?? false;
  assert.ok(!options.blackMarket || advanced, 'Native Black Market is Advanced-only');
  assert.ok(!options.blackMarket || !options.fullHand);
  let game = createGame('SAPHOCYCLICAUCTION', newPlayer('richese', 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['atreides', 'emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: SaphoCyclicStep[] = [];
  const act = (actor: string, action: Action) => { game = actSaphoCyclic(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSaphoCyclic(game, until, actions, options.fullHand); };
  if (options.blackMarket) act('emperor', { type: 'seatPosition', position: 5 });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  orderLand(game);
  reach(state => saphoCyclicPlayer(state).hand.some(card => card.id === CYCLIC_SAPHO));
  const acquired = structuredClone(game);
  let beforeBlackMarket: Game | null = null, blackMarketStep: SaphoCyclicStep | null = null;
  if (options.blackMarket) {
    reach(state => state.turn === 2 && state.phase === 1 && saphoCyclicClean(state));
    orderLand(game);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'richeseBlackMarket');
    const offered = saphoCyclicPlayer(game, 'richese').hand[0]; assert.ok(offered);
    assert.ok(saphoCyclicPlayer(afterSetup, 'richese').hand.some(card => card.id === offered.id),
      'The native seller offers its actual original starting card');
    beforeBlackMarket = structuredClone(game);
    blackMarketStep = { actor: 'richese', action: { type: 'decision', event: game.richeseBidding!.event,
      card: offered.id, method: 'normal' } };
    act(blackMarketStep.actor, blackMarketStep.action);
    reach(state => state.richeseAuction?.method === 'normal' && !state.richeseAuction.outcome && saphoCyclicClean(state));
  } else reach(state => !!state.auction && saphoCyclicClean(state) &&
    (!options.fullHand || saphoCyclicPlayer(state).hand.length === 4));
  const lot = saphoCyclicLot(game);
  return { game, lobby, setup, afterSetup, acquired, beforeBlackMarket, blackMarketStep,
    owner: 'emperor', challenger: 'atreides', seller: 'richese', card: CYCLIC_SAPHO, target: lot.card,
    kind: lot.kind, originalOpener: lot.opener, fullHand: options.fullHand ?? false,
    sourceActionCount: actions.length, actions,
    staging: ['Native host/setup and real cache1 purchase supply Sapho. Optional full-hand holdings are two actual normal1 purchases; Advanced Black Market uses an accepted Emperor circle5 lobby choice and offers the original seller-held card next turn. The native second Storm leaves meaningful first/last choices after a funded prior raise. Only unopened Spice positions/scalar lotteries are selected, with no postdeal custody, funds, phase, order or grant installed.'] };
}
export type SaphoCyclicAuctionFixture = ReturnType<typeof createSaphoCyclicAuctionFixture>;

/** Current public cyclic mechanics plus exact private source identity for the
 * original owner fixture; normal and Black Market retain their native engines. */
export function saphoCyclicLot(game: Game) {
  const black = game.richeseAuction;
  if (black?.method === 'normal') return { kind: 'blackMarket' as const, card: black.cardId,
    active: black.active!, bid: black.bid, bidder: black.bidder, passed: [...black.passed],
    opener: game.order.indexOf(black.order[0]), event: black.event, funding: structuredClone(game.richeseFunding) };
  const normal = game.auction; assert.ok(normal, 'An original cyclic lot must be open');
  return { kind: 'normal' as const, card: normal.cards[normal.index].id, active: normal.active,
    bid: normal.bid, bidder: normal.bidder, passed: [...normal.passed], opener: normal.opener,
    event: null, funding: normal.allyPayment ?? 0 };
}
export function saphoCyclicBid(game: Game, amount: number | null): SaphoCyclicStep {
  const lot = saphoCyclicLot(game);
  return { actor: lot.active, action: lot.kind === 'blackMarket'
    ? { type: 'richeseBid', event: lot.event!, amount, allyPayment: 0 }
    : amount === null ? { type: 'passBid' } : { type: 'bid', amount, allyPayment: 0 } };
}
export function saphoCyclicAction(game: Game, mode: 'first' | 'last'): Action {
  const option = viewGame(game, 'emperor').saphoOptions.find(option => option.scope === 'cyclicAuction' && option.mode === mode);
  assert.ok(option, `The actual owned cyclic lot needs a meaningful Sapho-${mode} option`);
  return { type: 'card', card: CYCLIC_SAPHO, ...option };
}

/** A funded prior raise survives Sapho. The holder raises2, a genuine rival
 * raises3 and the holder gets a normal cyclic wrap to raise4. Native payment
 * and the next original lot/control then complete without another Sapho use. */
export function completeSaphoCyclicAuction(fixture: SaphoCyclicAuctionFixture, mode: 'first' | 'last') {
  let game = structuredClone(fixture.game);
  const actions: SaphoCyclicStep[] = [], bids: { before: Game; step: SaphoCyclicStep; after: Game }[] = [];
  const bid = (amount: number | null) => {
    const before = structuredClone(game), step = saphoCyclicBid(game, amount);
    game = actSaphoCyclic(game, step.actor, step.action, actions);
    bids.push({ before, step, after: structuredClone(game) });
  };
  bid(1);
  const beforeSapho = structuredClone(game), action = saphoCyclicAction(game, mode);
  game = actSaphoCyclic(game, fixture.owner, action, actions);
  const ordered = structuredClone(game);
  let firstRaise = false, rivalRaise = false, lastRaise = false;
  for (let count = 0; count < 240; count++) {
    // A Black Market delivery precedes the original declaration/cache-first
    // programme. Its clean cache-bidding boundary is not the following normal
    // pool whose opener this programme must observe.
    const followingNormal = fixture.kind !== 'blackMarket' ||
      !!game.auction && !game.richeseAuction && game.richeseBidding?.stage === 'normal';
    if (followingNormal && saphoCyclicPlayer(game).hand.some(card => card.id === fixture.target) && saphoCyclicClean(game)) {
      assert.ok(firstRaise && rivalRaise && lastRaise, 'Original cyclic bidding must include the rival and holder wrap');
      return { game, beforeSapho, action, ordered, bids, actions, mode };
    }
    const live = game.auction?.cards[game.auction.index]?.id === fixture.target ||
      game.richeseAuction?.cardId === fixture.target && !game.richeseAuction.outcome;
    if (live && saphoCyclicClean(game)) {
      const lot = saphoCyclicLot(game);
      if (!firstRaise && lot.active === fixture.owner) { bid(2); firstRaise = true; }
      else if (firstRaise && !rivalRaise && lot.active === fixture.challenger) { bid(3); rivalRaise = true; }
      else if (rivalRaise && !lastRaise && lot.active === fixture.owner) { bid(4); lastRaise = true; }
      else bid(null);
    } else {
      const step = nextSaphoCyclicStep(game); assert.ok(step, 'Finish the real purchase continuation before its next lot');
      game = actSaphoCyclic(game, step.actor, step.action, actions);
    }
  }
  throw Error('The genuine Sapho cyclic lot did not settle its finite raise/pass programme');
}
