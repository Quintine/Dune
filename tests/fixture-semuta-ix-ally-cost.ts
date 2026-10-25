import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import { actTruthMovement } from './fixture-truth-movement';
import {
  nextSemutaIxianAuctionStep, semutaIxianAuctionPlayer,
  semutaIxianAuctionInventory, semutaIxianAuctionClean,
  passSemutaIxianAuction, claimSemutaIxianAuction,
} from './fixture-semuta-ixian-auction';

export type SemutaIxAllyCostStep = { actor: string; action: Action };
export const actSemutaIxAllyCost = actTruthMovement;
export const semutaIxAllyCostPlayer = semutaIxianAuctionPlayer;
export const semutaIxAllyCostInventory = semutaIxianAuctionInventory;
export const semutaIxAllyCostClean = semutaIxianAuctionClean;
export const passSemutaIxAllyCost = passSemutaIxianAuction;
export const claimSemutaIxAllyCost = claimSemutaIxianAuction;

/** Consume only live controls. The real ally replacement request and paid bid
 * remain source-owned actions; fresh physical discards receive actual passes. */
export function nextSemutaIxAllyCost(game: Game): SemutaIxAllyCostStep | null {
  const pending = game.pendingTreacheryDiscard, reaction = pending?.reaction;
  if (pending) {
    if (reaction?.stage !== 'offer') return null;
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'semutaPass', event: pending.batch.event } };
  }
  if (!game.response && !game.phaseOpening) {
    const fremen = game.players.find(p => p.faction === 'fremen');
    if (game.status === 'setup' && game.setupStage === 'forces' && fremen?.reserves === 20 &&
      viewGame(game, fremen.id).setupPending.includes(fremen.id))
      return { actor: fremen.id, action: { type: 'fremenSetup', placements: { 'sietch_tabr:14': 10 } } };
    const d = game.decision;
    if (d?.kind === 'ixAllyCard') return null;
    if (d?.kind === 'wormRide' || d?.kind === 'wormPlacement')
      return { actor: d.player, action: { type: 'decision', accept: false } };
    if (d?.kind === 'wormProtection') return { actor: d.player, action: { type: 'decision', accept: true } };
  }
  return nextSemutaIxianAuctionStep(game);
}
export const nextSemutaIxAllyCostStep = nextSemutaIxAllyCost;
export function advanceSemutaIxAllyCost(game: Game, until: (state: Game) => boolean,
  actions: SemutaIxAllyCostStep[] = []): Game {
  for (let count = 0; count < 2600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaIxAllyCost(game);
    assert.ok(next, `Supply the actual Ixian ally purchase choice at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaIxAllyCost(game, next.actor, next.action, actions);
  }
  throw Error('The original paid Ixian ally source did not reach its finite boundary');
}
export function allowSemutaIxAllyCost(game: Game, actions: SemutaIxAllyCostStep[] = []): Game {
  assert.equal(game.response?.kind, 'ixAllyCard');
  for (let count = 0; game.response?.kind === 'ixAllyCard' && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaIxAllyCost(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, 'ixAllyCard'); return game;
}
/** Finish this paid sale only, including a real replacement-card discard
 * reaction if allowance opened one. Stop before the next actual bid. */
export function finishSemutaIxAllyCost(game: Game, actions: SemutaIxAllyCostStep[] = []): Game {
  return advanceSemutaIxAllyCost(game, state => !state.currentAuctionSale &&
    !state.pendingIxAlly && semutaIxAllyCostClean(state), actions);
}

/** Original R/C/I/F/G setup, cache1, actual worm Nexus pact and ordinary paid
 * auction. Neither the delivered card nor a replacement is installed. */
export function createSemutaIxAllyCostFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false;
  const richese = 'richese', holder = 'choam', owner = 'ixians', buyer = 'fremen', spender = 'guild';
  let game = createGame('SEMUTAIXALLYCOST', newPlayer(richese, 'Richese', 'richese'), advanced, ['choam', 'ix']);
  for (const faction of ['choam', 'ixians', 'fremen', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaIxAllyCostStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaIxAllyCost(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaIxAllyCost(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaIxAllyCostInventory(game); assert.equal(originalInventory.length, 57);
  const printed = game.deck.find(card => card.effect === 'karama' && !card.id.startsWith('ix-'));
  const shield = game.deck.find(card => card.kind === 'shield');
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 3);
  assert.ok(printed && shield); assert.equal(ordinary.length, 3);
  const selected = [ordinary[0], ordinary[1], shield, ordinary[2], printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card: card.id, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = printed.id;
  const setupChoices = transition(() => { reach(state => state.status === 'playing'); });
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.ok(semutaIxAllyCostPlayer(game, spender).hand.some(card => card.id === cost));
  assert.ok(semutaIxAllyCostPlayer(game, owner).hand.some(card => card.id === shield.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { turn: number; position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const orderSpice = (faces: string[]) => {
    for (let position = 0; position < faces.length; position++) {
      const face = faces[position], from = game.spiceDeck.findIndex((card, index) => index >= position &&
        (face === 'worm' ? 'worm' in card && !card.suppressed && !card.thumper && !card.greatMaker
          : 'territory' in card && card.territory === face && !card.discovery));
      assert.ok(from >= position, `Select an original unopened ${face} Spice Card`);
      const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
      spiceOrder.push({ turn: game.turn, position, from, card: structuredClone(card) });
    }
  };
  orderSpice(advanced ? ['funeral_plain', 'hagga_basin'] : ['funeral_plain']);
  let beforeBid: Game | undefined, bid: SemutaIxAllyCostStep | undefined, bidAt = -1;
  for (let count = 0; count < 1000 && !semutaIxAllyCostPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaIxAllyCost(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaIxAllyCostPlayer(beforeBid, holder).spice - semutaIxAllyCostPlayer(game, holder).spice, 1);
  reach(state => state.turn === 2 && state.phase === 1 && semutaIxAllyCostClean(state) &&
    !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
  orderSpice(['worm', 'the_great_flat', ...(advanced ? ['broken_land'] : [])]);
  reach(state => state.turn === 2 && state.phase === 1 && state.nexus && !state.spiceWindow &&
    !state.spiceResolution && semutaIxAllyCostClean(state));
  const alliance = transition(() => {
    act(owner, { type: 'alliance', target: buyer }); act(buyer, { type: 'alliance', target: owner });
  });
  assert.equal(semutaIxAllyCostPlayer(game, owner).ally, buyer);
  assert.equal(semutaIxAllyCostPlayer(game, buyer).ally, owner);
  const beforeBidding = structuredClone(game), biddingAt = actions.length;
  reach(state => state.turn === 2 && state.phase === 3 && !!state.auction &&
    state.auction.index === 0 && state.auction.active === buyer && semutaIxAllyCostClean(state));
  const pool = { before: beforeBidding, steps: structuredClone(actions.slice(biddingAt)), after: structuredClone(game) };
  let paymentBefore: Game | null = null, paymentAt = -1;
  const beforePurchase = structuredClone(game), purchaseAt = actions.length;
  const awaitingReplacement = (state: Game) => state.decision?.kind === 'ixAllyCard';
  act(buyer, { type: 'bid', amount: 1, allyPayment: 0 });
  for (let count = 0; !awaitingReplacement(game) && count < 100; count++) {
    const before = structuredClone(game), at = actions.length;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'auctionPayment') {
      assert.equal(game.decision.player, buyer); act(buyer, { type: 'decision', karama: false });
    } else {
      const next = nextSemutaIxAllyCost(game); assert.ok(next); act(next.actor, next.action);
    }
    if (awaitingReplacement(game)) { paymentBefore = before; paymentAt = at; }
  }
  assert.equal(game.decision?.kind, 'ixAllyCard');
  const purchase = { before: beforePurchase, steps: structuredClone(actions.slice(purchaseAt)), after: structuredClone(game) };
  assert.ok(paymentBefore && paymentAt >= 0);
  const payment = { before: paymentBefore, steps: structuredClone(actions.slice(paymentAt)), after: structuredClone(game) };
  assert.equal(semutaIxAllyCostPlayer(payment.before, buyer).spice - semutaIxAllyCostPlayer(game, buyer).spice, 1);
  assert.ok(game.pendingIxAlly && game.currentAuctionSale && game.auction);
  const deliveredCard = semutaIxAllyCostPlayer(game, buyer).hand.find(card => card.id === game.pendingIxAlly!.card);
  assert.ok(deliveredCard); assert.equal(game.currentAuctionSale.origin, 'normal');
  const requestAction: Action = { type: 'decision', accept: true };
  const request = transition(() => { act(buyer, requestAction); });
  assert.ok(game.response?.kind === 'ixAllyCard'); assert.equal(game.response.owner, owner);
  assert.equal(game.response.recipient, buyer); assert.equal(game.decision ?? null, null);
  assert.ok(game.deck[0]); assert.deepEqual(semutaIxAllyCostInventory(game), originalInventory);
  return { game, kind: 'ixAllyCard' as const, advanced, blackMarket: false as const,
    owner, holder, spender, buyer, recipient: buyer, richese, cost, karama: cost, semuta: SEMUTA_DRUG_ID,
    action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    originalResponse: structuredClone(game.response), originalPending: structuredClone(game.pendingIxAlly!),
    originalSale: structuredClone(game.currentAuctionSale!), originalAuction: structuredClone(game.auction!),
    originalDeck: structuredClone(game.deck), deliveredCard: structuredClone(deliveredCard), deliveredCardId: deliveredCard.id,
    replacementTop: structuredClone(game.deck[0]), requestAction, initial, lobby, setup, beforeStartingDeal,
    afterSetup, setupChoices, dealOrder, deal: selected.map(card => card.id), originalInventory, originalSpice, spiceOrder,
    acquisition, acquired, cache: acquisition, alliance, pact: alliance, pool, purchase, payment, request,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Original public Basic start or original undealt Advanced initializer for R/C/I/F/G with native CHOAM/Ix decks. Only unopened deal/Spice positions and scalar lotteries are selected. Native Ix chooses its inspected Shield; Guild receives the printed Karama; CHOAM actually pays cache1 for Semuta.',
      'Original first-turn movement is unused. A real turn2 worm over the empty Funeral pile opens Nexus; Ix and Fremen actually propose and accept their pact. Native HMS, pool-return, optional Technology decline and other original controls remain real actions.',
      'Fremen bids and pays one own spice for an actual ordinary auction card. There is no Emperor seat, so the printed payment goes to the Bank. The card is delivered into the buyer hand and native pendingIxAlly/currentAuctionSale remain; Fremen really requests replacement before the cancellation cost.',
      'No played hand, wallet, card, ally, force, clock, pool, purchase, pending control or replacement is installed. Cache replacement and absent-Ix Secret Ally are outside these ordinary native sources.',
    ] };
}
export type SemutaIxAllyCostFixture = ReturnType<typeof createSemutaIxAllyCostFixture>;
