import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  createRicheseNormalBetrayalFixture,
  actRicheseNormalBetrayal,
  advanceRicheseNormalBetrayal,
  nextRicheseNormalBetrayal,
  passRicheseNormalBetrayal,
  finishRicheseNormalBetrayal,
  richeseNormalBetrayalClean,
  richeseNormalBetrayalPlayer,
  richeseNormalBetrayalInventory,
  richeseNormalBetrayalNexusInventory,
  type RicheseNormalBetrayalStep,
} from './fixture-richese-normal-betrayal';
import {
  createNexusEmperorSellerFixture, nextNexusEmperorSellerStep,
} from './fixture-nexus-emperor-seller';

export type RicheseKaramaBetrayalStep = RicheseNormalBetrayalStep;
export const actRicheseKaramaBetrayal = actRicheseNormalBetrayal;
export const nextRicheseKaramaBetrayal = nextRicheseNormalBetrayal;
export const advanceRicheseKaramaBetrayal = advanceRicheseNormalBetrayal;
export const passRicheseKaramaBetrayal = passRicheseNormalBetrayal;
export const finishRicheseKaramaBetrayal = finishRicheseNormalBetrayal;
export const richeseKaramaBetrayalClean = richeseNormalBetrayalClean;
export const richeseKaramaBetrayalPlayer = richeseNormalBetrayalPlayer;
export const richeseKaramaBetrayalInventory = richeseNormalBetrayalInventory;
export const richeseKaramaBetrayalNexusInventory = richeseNormalBetrayalNexusInventory;

export function commitRicheseKaramaBetrayal(game: Game, fixture: { target: string; action: Action },
  actions: RicheseKaramaBetrayalStep[] = []) {
  const before = structuredClone(game), start = actions.length;
  game = actRicheseKaramaBetrayal(game, fixture.target, fixture.action, actions);
  return { game, before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
}

/** Both inputs fork real earlier snapshots of the original source programme.
 * Ordinary uses its LABELLED recycled first normal lot before bids/cost.
 * Quiet special branches before any controlled recycle; its selected cache
 * card is still native original custody. No paused counter/cost is installed. */
export function createRicheseKaramaBetrayalFixture(options: {
  origin?: 'ordinary' | 'special'; advanced?: boolean; richeseCard?: boolean;
  parent?: 'quiet' | 'emperorIncome'; holderNexus?: 'richese' | 'guild'; otherBidder?: boolean;
} = {}) {
  const origin = options.origin ?? 'ordinary', parent = options.parent ?? 'quiet';
  const advanced = options.advanced ?? origin === 'special';
  assert.ok(origin !== 'special' || advanced, 'Native private Richese special Karama requires Advanced');
  assert.ok(parent === 'quiet' || origin === 'special', 'The incoming Emperor response belongs to the native special branch');
  const f = createRicheseNormalBetrayalFixture({ advanced, richeseCard: options.richeseCard,
    karama: true, holderNexus: options.holderNexus, allyPayment: parent === 'emperorIncome' ? 2 : 0 });
  assert.ok(f.karama);
  let game: Game, actions: RicheseKaramaBetrayalStep[];
  if (origin === 'ordinary') {
    game = structuredClone(f.beforeBids);
    actions = structuredClone(f.actions.slice(0, f.actions.length - f.bidding.steps.length));
    if (options.otherBidder) {
      for (let count = 0; game.auction!.active !== f.holder && count < game.players.length; count++)
        game = actRicheseKaramaBetrayal(game, game.auction!.active, { type: 'passBid' }, actions);
      assert.equal(game.auction!.active, f.holder);
      game = actRicheseKaramaBetrayal(game, f.holder, { type: 'bid', amount: 1, allyPayment: 0 }, actions);
    }
  } else if (parent === 'quiet') {
    // Fork the actual final Nexus draw. Repeating only its normal phase-opening
    // controls earns this branch's quiet Charity boundary and exact action log;
    // no later controlled main-deck recycle or normal bid belongs to this source.
    const lastDraw = f.nexusDraws.at(-1); assert.ok(lastDraw);
    const drawStep = lastDraw.steps.at(-1); assert.ok(drawStep);
    const drawAt = f.actions.findIndex(step => step.actor === drawStep.actor &&
      JSON.stringify(step.action) === JSON.stringify(drawStep.action)); assert.ok(drawAt >= 0);
    game = structuredClone(lastDraw.after);
    actions = structuredClone(f.actions.slice(0, drawAt + 1));
    game = advanceRicheseKaramaBetrayal(game, state => state.turn === 2 && state.phase === 2 &&
      richeseKaramaBetrayalClean(state), actions);
    assert.deepEqual(richeseKaramaBetrayalInventory(game), richeseKaramaBetrayalInventory(f.beforeRecycle));
    assert.deepEqual(game.players.map(player => ({ id: player.id, hand: player.hand, spice: player.spice })),
      f.beforeRecycle.players.map(player => ({ id: player.id, hand: player.hand, spice: player.spice })));
  } else {
    actions = structuredClone(f.actions);
    game = passRicheseKaramaBetrayal(structuredClone(f.game), actions);
    assert.equal(game.decision?.kind, 'auctionPayment');
    game = actRicheseKaramaBetrayal(game, f.target, { type: 'decision', karama: false }, actions);
    assert.equal(game.response?.kind, 'emperorIncome');
    assert.equal(game.currentAuctionSale?.amount ?? game.auction?.bid, 3);
    assert.equal(richeseKaramaBetrayalPlayer(game, f.target).spice, 4);
  }
  const cost = richeseKaramaBetrayalPlayer(game, f.target).hand.find(card => card.id === f.karama); assert.ok(cost);
  assert.equal(cost.effect, 'karama');
  assert.equal(richeseKaramaBetrayalPlayer(game, f.holder).ally, null);
  assert.equal(game.nexusCards!.cards!.hands[f.holder], options.holderNexus ?? 'richese');
  const chosen = origin === 'special'
    ? game.richeseCache!.find(card => card.id === 'richese-stone-burner')
    : game.auction!.cards[game.auction!.index];
  assert.ok(chosen); assert.notEqual(chosen.id, cost.id);
  if (origin === 'ordinary') {
    assert.equal(game.auction!.bid, options.otherBidder ? 1 : 0);
    assert.equal(game.auction!.bidder, options.otherBidder ? f.holder : null);
    assert.equal(chosen.id, f.card);
  } else {
    const offer = viewGame(game, f.target).richeseSpecialKarama;
    assert.ok(offer && !offer.blocked && offer.cards.some(card => card.id === chosen.id));
    assert.ok(!richeseKaramaBetrayalPlayer(game, f.target).specialKaramaUsed);
  }
  assert.ok(!game.pendingRicheseBetrayal);
  assert.deepEqual(richeseKaramaBetrayalInventory(game), f.originalInventory);
  assert.deepEqual(richeseKaramaBetrayalNexusInventory(game), f.originalNexusInventory);
  const action: Action = origin === 'ordinary'
    ? { type: 'card', mode: 'purchase', card: cost.id }
    : { type: 'card', mode: 'special', card: cost.id, acquire: chosen.id };
  const source = structuredClone(game);
  return {
    game, source, beforeCost: source, origin, sourceKind: origin === 'ordinary' ? 'karama' : 'specialKarama',
    parent, advanced, otherBidder: options.otherBidder ?? false,
    target: f.target, buyer: f.target, richese: f.target, owner: f.target,
    holder: f.holder, emperor: f.emperor, ally: f.ally,
    card: chosen.id, acquire: chosen.id, purchaseCard: structuredClone(chosen),
    karama: cost.id, costCard: structuredClone(cost), action, activationAction: action,
    originalResponse: structuredClone(game.response), originalDecision: structuredClone(game.decision),
    originalInventory: f.originalInventory, originalCards: f.originalInventory,
    originalNexusInventory: f.originalNexusInventory,
    controlledRecycle: origin === 'ordinary' || parent === 'emperorIncome',
    recycle: origin === 'ordinary' || parent === 'emperorIncome' ? f.recycle : null,
    parentFixture: f, actions, steps: actions, sourceActionCount: actions.length,
    producerActionCount: f.sourceActionCount,
    staging: [
      'Borrow the original Richese/CHOAM/Emperor/Atreides audit source with real main35/cache10, original base Karama dealt to Richese, actual cache Karama retention/first normal Shield purchase, later native Worm/alliance and actual CHOAM-held Richese Nexus. No dealt hand, wallet, alliance, force, phase, current reaction or Karama receipt is installed.',
      origin === 'ordinary'
        ? 'Ordinary Karama source forks exact beforeBids: the actual first normal lot has zero bid/no bidder by default; optional otherBidder really lets CHOAM bid one before the declaration. The original base cost Karama is still held. The same explicitly CONTROLLED original Richese-Karama discard-to-unopened-main recycle supplies the family target; ordinary MISS instead uses the existing selected unopened ordinary face. Native card mode purchase is still undeclared.'
        : parent === 'quiet'
          ? 'Private special source forks the actual final Nexus draw and completes only its original phase-opening controls to quiet Charity2, matching the earlier beforeRecycle physical hands/balances. No controlled main-deck recycle or later auction belongs to this source. The actual remaining Stone Burner cache card, three own spice and original base Karama remain unspent.'
          : 'Native parent source really passes the prior normal Betrayal and pays the actual three-spice winning bid using one own plus two actually pledged ally spice. It stops with Richese four spice and the original EmperorIncome3 still pending. That prior normal lot retains its explicitly controlled recycled target. The new private cache purchase is undeclared; its original response must survive either result.',
      'This four-seat branch does not claim a joint Emperor-Nexus special source: its original roster contains Emperor, while the existing joint-purchase profile explicitly requires Emperor absent. The separately exported canonical joint source retains its original Emperor-absent roster; no native card is swapped between these profiles.',
    ],
  };
}
export type RicheseKaramaBetrayalFixture = ReturnType<typeof createRicheseKaramaBetrayalFixture>;

/** Original Emperor-absent canonical roster. The actual Emperor Nexus and
 * Richese counter draw precede one native unbid-cache Karama retention. No
 * ordinary recycle, held-card exchange or resource staging supplies this case. */
export function createRicheseJointKaramaBetrayalFixture() {
  const f = createNexusEmperorSellerFixture({ advanced: true, winnerFaction: 'richese', betrayal: 'before' });
  const target = f.winner, holder = 'guild', draw = f.chronology.draw;
  const drawAt = f.actions.findIndex(step => step.actor === draw.step.actor &&
    JSON.stringify(step.action) === JSON.stringify(draw.step.action)); assert.ok(drawAt >= 0);
  let game = structuredClone(draw.after);
  const actions: RicheseKaramaBetrayalStep[] = structuredClone(f.actions.slice(0, drawAt + 1));
  const act = (actor: string, action: Action) => { game = actRicheseKaramaBetrayal(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => {
    for (let count = 0; count < 600 && !until(game); count++) {
      const d = game.decision;
      if (!game.response && !game.phaseOpening && d?.kind === 'richeseDeclaration')
        act(d.player, { type: 'decision', event: game.richeseBidding!.event, position: 'first' });
      else {
        const step = nextNexusEmperorSellerStep(game); act(step.actor, step.action);
      }
    }
    assert.ok(until(game), 'The actual joint-source prefix must reach its next native control');
  };
  assert.equal(game.nexusCards!.cards!.hands[target], 'emperor');
  assert.equal(game.nexusCards!.cards!.hands[holder], null);
  const cards = game.nexusCards!.cards!, from = cards.deck.indexOf('richese'); assert.ok(from >= 0);
  cards.deck.unshift(cards.deck.splice(from, 1)[0]);
  const beforeCounterDraw = structuredClone(game), counterDrawStart = actions.length;
  act(holder, { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 });
  const counterDraw = { before: beforeCounterDraw, steps: structuredClone(actions.slice(counterDrawStart)), after: structuredClone(game) };
  reach(state => state.turn === 2 && state.phase === 2 && richeseKaramaBetrayalClean(state));
  const afterClosingDraw = structuredClone(game);
  let cost = richeseKaramaBetrayalPlayer(game, target).hand.find(card => card.effect === 'karama');
  let costAcquisition: { before: Game; steps: RicheseKaramaBetrayalStep[]; after: Game } | null = null;
  if (!cost) {
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'richeseCache');
    const chosen = game.richeseCache!.find(card => card.id === 'richese-karama'); assert.ok(chosen);
    const before = structuredClone(game), start = actions.length;
    act(target, { type: 'decision', event: game.richeseBidding!.event, card: chosen.id,
      method: 'onceAround', direction: 'clockwise' });
    for (let count = 0; game.decision?.kind !== 'richeseUnbid' && count < 20; count++) {
      const lot = game.richeseAuction!; assert.ok(lot && lot.active && !game.response);
      act(lot.active, { type: 'richeseBid', event: lot.event, amount: null });
    }
    assert.equal(game.decision?.kind, 'richeseUnbid');
    act(target, { type: 'decision', event: game.richeseBidding!.event, keep: true });
    reach(richeseKaramaBetrayalClean);
    costAcquisition = { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
    cost = richeseKaramaBetrayalPlayer(game, target).hand.find(card => card.id === chosen.id); assert.ok(cost);
  }
  assert.ok(cost);
  assert.ok(!game.players.some(player => player.faction === 'emperor'));
  assert.equal(richeseKaramaBetrayalPlayer(game, target).ally, null);
  assert.equal(richeseKaramaBetrayalPlayer(game, holder).ally, null);
  assert.equal(game.nexusCards!.cards!.hands[target], 'emperor');
  assert.equal(game.nexusCards!.cards!.hands[holder], 'richese');
  const offer = viewGame(game, target).richeseSpecialKarama; assert.ok(offer && !offer.blocked);
  // The borrowed native first-turn driver already retains Stone Burner. Choose
  // another actual, presently eligible cache face rather than assuming it is
  // still in the cache after that real acquisition.
  const chosen = offer.cards.find(card => card.id !== cost.id); assert.ok(chosen);
  assert.ok(game.richeseCache!.some(card => card.id === chosen.id));
  assert.equal(offer.emperorNexus.blocked, null); assert.ok(offer.emperorNexus.event);
  const action: Action = { type: 'card', mode: 'special', card: cost.id, acquire: chosen.id,
    emperorNexus: true, nexusEvent: offer.emperorNexus.event };
  const source = structuredClone(game), originalInventory = f.originalCards;
  const originalNexusInventory = richeseKaramaBetrayalNexusInventory(game);
  assert.deepEqual(richeseKaramaBetrayalInventory(game), originalInventory);
  return {
    game, source, beforeCost: source, origin: 'special' as const, sourceKind: 'specialKarama' as const,
    advanced: true, parent: 'quiet' as const, jointEmperor: true,
    target, buyer: target, richese: target, owner: target, holder, emperor: null,
    card: chosen.id, acquire: chosen.id, purchaseCard: structuredClone(chosen),
    karama: cost.id, costCard: structuredClone(cost), action, activationAction: action,
    nexusEvent: offer.emperorNexus.event, beforeCounterDraw, counterDraw, afterClosingDraw, costAcquisition,
    originalResponse: structuredClone(game.response), originalDecision: structuredClone(game.decision),
    originalInventory, originalCards: originalInventory, originalNexusInventory,
    controlledRecycle: false, actions, steps: actions, sourceActionCount: actions.length,
    parentFixture: f,
    staging: [
      'Fork the exact original Richese/CHOAM/Harkonnen/Fremen/Guild canonical audit prefix after Richese actually draws Emperor Nexus at the second-turn worm. CHOAM/Fremen alliance is native; Richese and Guild remain unallied. Select only the still-unopened Richese Nexus draw for Guild, then finish actual closing/opening controls.',
      'If no original held Karama exists, declare the actual next cache Richese-Karama lot using Once Around; all original bidders pass and Richese really keeps that unbid cache card. Its original cache decreases and its real hand gains the physical cost. No dealt card, wallet, alliance, phase, Nexus or paused receipt is installed; no controlled recycled normal lot supplies this branch.',
      `Stop before declaring the native joint special action with its actual private Emperor Nexus event. The held Karama, held Emperor singleton, three own spice proof, selected remaining original cache card ${chosen.id} and once-use remain unspent. The original first-turn driver already retained Stone Burner through its real unbid choice; the live private special-purchase view selects this different eligible cache card. The distinct Guild-held Richese singleton supplies the real pre-cost counter.`,
    ],
  };
}
