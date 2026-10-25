import assert from 'node:assert/strict';
import {
  createGame, initializeRicheseBetrayalGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { validateNexusCards } from '../game/nexus-cards';
import { richeseCardDefinition } from '../game/richese-cards';
import { actTruthMovement } from './fixture-truth-movement';
import { nextTruthMovementNativeEarlyStep } from './fixture-truth-movement-native-early';
import {
  richeseHomeworldShipmentNexusInventory,
} from './fixture-richese-homeworld-shipment';

export type RicheseNormalBetrayalStep = { actor: string; action: Action };
export type RicheseNormalBetrayalTransition = { before: Game; steps: RicheseNormalBetrayalStep[]; after: Game };
export const actRicheseNormalBetrayal = actTruthMovement;
export const richeseNormalBetrayalPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const richeseNormalBetrayalClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRicheseBetrayal;
export function richeseNormalBetrayalInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original main/cache face retains one physical location');
  return ids;
}
export const richeseNormalBetrayalNexusInventory = richeseHomeworldShipmentNexusInventory;

/** Actual native controls only. The original blind counter, current payment
 * chooser and closing Nexus draws stay caller-owned. */
export function nextRicheseNormalBetrayal(game: Game): RicheseNormalBetrayalStep | null {
  if (game.pendingRicheseBetrayal || game.truthtrance ||
      game.nexusCards?.phase?.stage === 'drawing') return null;
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'auctionPayment') return null;
    if (game.phase === 5 && !game.decision) return { actor: game.active!, action: { type: 'endMovement' } };
  }
  return nextTruthMovementNativeEarlyStep(game, {
    position: 'first', method: 'onceAround', direction: 'clockwise',
    keepUnbid: game.turn === 1 && game.richeseAuction?.cardId === 'richese-karama',
    card: game.richeseCache?.find(card => card.id === 'richese-karama')?.id ?? game.richeseCache?.[0]?.id,
  });
}
export function advanceRicheseNormalBetrayal(game: Game, until: (state: Game) => boolean,
  actions: RicheseNormalBetrayalStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    const next = nextRicheseNormalBetrayal(game);
    assert.ok(next, `Supply the original Nexus/bid/payment control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actRicheseNormalBetrayal(game, next.actor, next.action, actions);
  }
  throw Error('The original Richese normal-purchase programme did not reach its finite boundary');
}
export function passRicheseNormalBetrayal(game: Game, actions: RicheseNormalBetrayalStep[] = []): Game {
  const event = game.pendingRicheseBetrayal?.receipt.event; assert.ok(event);
  for (let count = 0; game.pendingRicheseBetrayal?.receipt.event === event && count < 12; count++) {
    const receipt = game.pendingRicheseBetrayal.receipt;
    const actor = receipt.required.find(id => !receipt.passed.includes(id)); assert.ok(actor);
    game = actRicheseNormalBetrayal(game, actor, { type: 'richeseBetrayalPass', event }, actions);
  }
  assert.notEqual(game.pendingRicheseBetrayal?.receipt.event, event); return game;
}
/** Finish the original post-payment responses, stopping at the next quiet lot.
 * This never chooses spice/Karama or acknowledges another Betrayal event. */
export function finishRicheseNormalBetrayal(game: Game, actions: RicheseNormalBetrayalStep[] = []): Game {
  return advanceRicheseNormalBetrayal(game, richeseNormalBetrayalClean, actions);
}
export function payRicheseNormalBetrayal(game: Game, fixture: { target: string; karama: string | null },
  karama = false, actions: RicheseNormalBetrayalStep[] = []): Game {
  if (game.decision?.kind === 'auctionPayment') {
    assert.equal(game.decision.player, fixture.target);
    assert.ok(!karama || fixture.karama);
    game = actRicheseNormalBetrayal(game, fixture.target,
      { type: 'decision', karama, ...(karama ? { card: fixture.karama! } : {}) }, actions);
  }
  return finishRicheseNormalBetrayal(game, actions);
}

/** Original audit admission, setup and two-turn chronology are genuine.
 * A single LABELLED controlled recycle moves the first native cache discard
 * to the still-unopened ordinary pool. No receipt, auction, resource or dealt
 * card is installed; real normal bids and passes earn the new interruption. */
export function createRicheseNormalBetrayalFixture(options: {
  advanced?: boolean; richeseCard?: boolean; karama?: boolean; holderNexus?: 'richese' | 'guild'; allyPayment?: 0 | 2;
} = {}) {
  const advanced = options.advanced ?? false, family = options.richeseCard ?? true;
  const withKarama = options.karama ?? true, allyPayment = options.allyPayment ?? 0, price = 3;
  const target = 'richese', holder = 'choam', emperor = 'emperor', atreides = 'atreides';
  const ally = allyPayment ? atreides : null, nexusFace = options.holderNexus ?? 'richese';
  let game = createGame('RICHESENORMALBETRAYAL', newPlayer(target, 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer(holder, 'CHOAM', 'choam'));
  joinGame(game, newPlayer(emperor, 'Emperor', 'emperor'));
  joinGame(game, newPlayer(atreides, 'Atreides', 'atreides'));
  const initial = structuredClone(game), actions: RicheseNormalBetrayalStep[] = [];
  const act = (actor: string, action: Action) => { game = actRicheseNormalBetrayal(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceRicheseNormalBetrayal(game, until, actions); };
  const transition = (run: () => void): RicheseNormalBetrayalTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  act(game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true });
  for (const seat of game.players) act(seat.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = initializeRicheseBetrayalGameForAudit(game);
  const initialization = { before: lobby, after: structuredClone(game) }, setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.richeseBetrayalPreview, true);
  assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  assert.ok(game.players.every(seat => !seat.hand.length));
  const originalInventory = richeseNormalBetrayalInventory(game);
  const originalNexusInventory = richeseNormalBetrayalNexusInventory(game);
  assert.equal(originalInventory.length, 45); assert.equal(originalNexusInventory.length, 12);
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 4); assert.equal(ordinary.length, 4);
  const selected = withKarama ? [karama, ...ordinary.slice(0, 3)] : ordinary;
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(seat => seat.hand.map(card => card.id)), selected.map(card => card.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { turn: number; position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const order = (worm: boolean, position: number) => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && (worm
      ? 'worm' in card && !card.greatMaker && !card.suppressed
      : 'territory' in card && !card.discovery && card.territory !== 'arrakeen'));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); spiceOrder.push({ turn: game.turn, position, from, card: structuredClone(card) });
  };
  order(false, 0); if (advanced) order(false, 1);
  reach(state => state.turn === 1 && state.phase === 2 && richeseNormalBetrayalClean(state));
  const firstNormalFrom = game.deck.findIndex(card => card.kind === 'shield'); assert.ok(firstNormalFrom >= 0);
  const firstNormalCard = game.deck.splice(firstNormalFrom, 1)[0]; game.deck.unshift(firstNormalCard);
  const firstNormalOrder = { position: 0, from: firstNormalFrom, card: firstNormalCard.id,
    timing: 'turn1-before-bidding', source: 'unopened-main' };
  assert.deepEqual(richeseNormalBetrayalInventory(game), originalInventory);
  reach(state => state.turn === 1 && state.phase === 3 && !!state.auction && richeseNormalBetrayalClean(state));
  assert.equal(game.auction!.cards[game.auction!.index].id, firstNormalCard.id);
  assert.ok(richeseNormalBetrayalPlayer(game, target).hand.some(card => card.id === 'richese-karama'));
  const beforeFirstPurchase = structuredClone(game), firstPurchaseStart = actions.length;
  for (let count = 0; game.decision?.kind !== 'auctionPayment' && count < 16; count++) {
    assert.ok(game.auction && !game.response && !game.pendingRicheseBetrayal);
    const actor = game.auction.active;
    act(actor, actor === target && game.auction.bidder !== target
      ? { type: 'bid', amount: 1, allyPayment: 0 } : { type: 'passBid' });
  }
  assert.equal(game.decision?.kind, 'auctionPayment'); assert.equal(game.decision?.player, target);
  act(target, { type: 'decision', karama: true, card: 'richese-karama' });
  reach(richeseNormalBetrayalClean);
  const firstPurchase: RicheseNormalBetrayalTransition = {
    before: beforeFirstPurchase, steps: structuredClone(actions.slice(firstPurchaseStart)), after: structuredClone(game),
  };
  reach(state => state.turn === 1 && state.phase === 4 && richeseNormalBetrayalClean(state));
  const afterFirstBidding = structuredClone(game);
  const recycled = game.discard.find(card => card.id === 'richese-karama'); assert.ok(recycled);
  assert.equal(game.richeseCache!.length, 9);
  reach(state => state.turn === 2 && state.phase === 1 && richeseNormalBetrayalClean(state) &&
    !state.nexus && !state.spiceWindow && !state.spiceResolution && !state.spiceSequence && !state.ready.length);
  const beforeWorm = structuredClone(game); order(true, 0); order(false, 1); if (advanced) order(false, 2);
  const beforeNexus = structuredClone(game);
  reach(state => state.nexus && richeseNormalBetrayalClean(state) && !state.spiceWindow && !state.spiceResolution);
  const alliance = transition(() => {
    const first = ally ? target : emperor;
    act(first, { type: 'alliance', target: atreides }); act(atreides, { type: 'alliance', target: first });
  });
  reach(state => state.nexusCards?.phase?.stage === 'drawing' && richeseNormalBetrayalClean(state));
  const nexusDraws: RicheseNormalBetrayalTransition[] = [], nexusOrder: { actor: string; from: number; card: string }[] = [];
  for (let count = 0; game.nexusCards?.phase?.stage === 'drawing' && count < 6; count++) {
    const phase = game.nexusCards.phase, actor = phase.eligible.find(id => !phase.done.includes(id)); assert.ok(actor);
    const face = actor === holder ? nexusFace : nexusFace === 'guild' ? 'fremen' : 'guild';
    const cards = game.nexusCards.cards!, from = cards.deck.indexOf(face); assert.ok(from >= 0);
    assert.equal(cards.hands[actor], null);
    cards.deck.unshift(cards.deck.splice(from, 1)[0]); nexusOrder.push({ actor, from, card: face });
    nexusDraws.push(transition(() => { act(actor, { type: 'nexusCardChoice', turn: game.turn,
      card: null, choice: 'draw', ownRedraws: 0 }); }));
  }
  assert.equal(game.nexusCards!.cards!.hands[holder], nexusFace);
  assert.equal(richeseNormalBetrayalPlayer(game, holder).ally, null);
  reach(state => state.turn === 2 && state.phase === 2 && richeseNormalBetrayalClean(state));
  const beforeRecycle = structuredClone(game);
  let card: string, recycledFrom: number;
  if (family) {
    recycledFrom = game.discard.findIndex(card => card.id === recycled.id); assert.ok(recycledFrom >= 0);
    game.deck.unshift(game.discard.splice(recycledFrom, 1)[0]); card = recycled.id;
  } else {
    recycledFrom = game.deck.findIndex(card => card.kind === 'shield'); assert.ok(recycledFrom >= 0);
    const ordinaryCard = game.deck.splice(recycledFrom, 1)[0]; game.deck.unshift(ordinaryCard); card = ordinaryCard.id;
  }
  const recycle = { before: beforeRecycle, after: structuredClone(game), card,
    from: family ? 'discard' : 'unopened-main', fromIndex: recycledFrom, to: 'unopened-main-top', controlled: true };
  assert.equal(!!richeseCardDefinition(game.deck[0]), family);
  assert.deepEqual(richeseNormalBetrayalInventory(game), originalInventory);
  let funding: RicheseNormalBetrayalTransition | null = null;
  reach(state => state.turn === 2 && state.phase === 3 && !!state.auction && richeseNormalBetrayalClean(state));
  assert.equal(game.auction!.cards[game.auction!.index].id, card);
  if (ally) funding = transition(() => { act(ally, { type: 'pledgeAid', amount: allyPayment }); });
  const beforeBids = structuredClone(game), biddingStart = actions.length;
  let beforeTrigger: Game | undefined, trigger: RicheseNormalBetrayalStep | undefined;
  for (let count = 0; !game.pendingRicheseBetrayal && count < 16; count++) {
    assert.ok(game.auction && !game.decision && !game.response, 'Native bids must open Betrayal before the payment chooser');
    const actor = game.auction.active;
    const action: Action = actor === target && game.auction.bidder !== target
      ? { type: 'bid', amount: price, allyPayment } : { type: 'passBid' };
    beforeTrigger = structuredClone(game); trigger = { actor, action };
    act(actor, action);
  }
  assert.ok(game.pendingRicheseBetrayal && beforeTrigger && trigger);
  const event = game.pendingRicheseBetrayal.receipt.event, source = structuredClone(game);
  assert.equal(game.pendingRicheseBetrayal.receipt.invoice.source, 'normal');
  assert.equal(game.pendingRicheseBetrayal.receipt.invoice.card.id, card);
  assert.equal(game.auction!.bidder, target); assert.equal(game.auction!.bid, price);
  assert.equal(game.decision, null); assert.ok(!game.currentAuctionSale);
  assert.deepEqual(richeseNormalBetrayalInventory(game), originalInventory);
  assert.deepEqual(richeseNormalBetrayalNexusInventory(game), originalNexusInventory);
  validateNexusCards(game.nexusCards!.cards!, game.players);
  return {
    game, source, beforePaymentChoice: source, initial, lobby, initialization, setup, beforeStartingDeal, afterSetup,
    firstPurchase, afterFirstBidding, beforeWorm, beforeNexus, alliance, nexusDraws, nexusOrder,
    beforeRecycle, recycle, funding, beforeBids, beforeTrigger, trigger,
    bidding: { before: beforeBids, steps: structuredClone(actions.slice(biddingStart)), after: source },
    target, buyer: target, richese: target, owner: target, holder, other: ally ? emperor : target,
    emperor, atreides, ally, price, allyPayment, family, advanced, card, recycledCard: recycled.id,
    karama: withKarama ? karama.id : null, holderNexus: nexusFace, event,
    useAction: { type: 'richeseBetrayalUse', event } as Action,
    passActions: game.pendingRicheseBetrayal.receipt.required.map(actor => ({ actor,
      action: { type: 'richeseBetrayalPass', event } as Action })),
    originalInventory, originalCards: originalInventory, originalNexusInventory, originalSpice, spiceOrder, dealOrder,
    firstNormalOrder,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Fresh original Richese Betrayal audit admission with Richese/CHOAM/Emperor/Atreides, original main35/cache10, all12 Nexus singletons and no other modules. Public Nexus lobby selection and readiness precede the existing explicit audit initializer; this is not a newly admitted public start. Only original unopened Treachery/Spice/Nexus positions and native scalar lotteries are selected for setup and the real worm/draw prefix. Original hands, native wallets, forces, clocks and all allowances follow actual setup/actions.',
      'Native first-turn cache auction selects Richese Karama; all four actual Once Around bidders pass, and Richese really keeps the unbid card. Cache decreases to nine. Before that Bidding phase deals the normal pool, select an actual still-unopened Shield at main-deck top, recorded separately as firstNormalOrder. Richese then really wins that first normal Shield lot for one and pays with the exact cache Karama at the original winning-bid payment chooser, putting the physical Richese card into normal discard without a spice debit. Thus karama:false does not acquire another Karama from its real purchase; karama:true retains its genuinely dealt starting one. This is the existing post-winning payment route, not proactive Karama purchase. Native Storm/Spice/Charity/auctions/Revival/movement/Mentat progress to a real second-turn worm. Emperor/Atreides actually ally by default; the aid branch instead earns Richese/Atreides alliance and an actual two-spice pledge. Unallied CHOAM actually draws its original Richese Nexus (or the explicitly selected irrelevant Guild singleton). No Nexus card is installed or duplicated.',
      family
        ? 'CONTROLLED RECYCLED ORDINARY SOURCE: before turn2 Bidding and before any normal auction/receipt exists, move the already-discarded original Richese Karama into the unopened main-deck top. Preserve every physical main/cache card and the genuinely decremented cache; this replaces a costly multi-turn exhaustion/reshuffle programme and is not claimed as earned deck recycling.'
        : 'ORDINARY MISS CONTROL: before turn2 Bidding, select one actual still-unopened ordinary Shield at the main-deck top. The previously spent Richese Karama stays in discard. No family inference is used to manufacture the later reaction window.',
      'Native turn2 cache passes/declined retention complete before the ordinary pool opens. Richese really bids three (with actual aid two only when requested); other native bidders pass. Stop at the engine-created neutral normal-purchase Betrayal window before any spice/Karama payment choice. No auction, paused receipt, wallet, alliance, dealt hand, invoice or sale is installed.',
    ],
  };
}
export type RicheseNormalBetrayalFixture = ReturnType<typeof createRicheseNormalBetrayalFixture>;
