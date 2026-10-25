import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actTruthMovement } from './fixture-truth-movement';
import { nextTruthMovementNativeEarlyStep } from './fixture-truth-movement-native-early';
import { richeseNormalBetrayalInventory } from './fixture-richese-normal-betrayal';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type SemutaRicheseGiftKaramaStep = { actor: string; action: Action };
export const actSemutaRicheseGiftKarama = actTruthMovement;
export const semutaRicheseGiftKaramaInventory = richeseNormalBetrayalInventory;
export const semutaRicheseGiftKaramaPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
};
export const semutaRicheseGiftKaramaClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRicheseGift;
const GIFT = 'richese-distrans', DONOR = 'richese';

/** Original bidding and readiness controls. Fresh disposal, the gift itself
 * and the selected Karama cancellation remain explicit caller actions. */
export function nextSemutaRicheseGiftKaramaStep(game: Game, fullHand = false): SemutaRicheseGiftKaramaStep | null {
  if (game.pendingTreacheryDiscard || game.pendingRicheseGift || game.truthtrance) return null;
  if (!game.phaseOpening && !game.response) {
    const d = game.decision;
    if (d?.kind === 'richeseCache') {
      const selected = game.turn === 1 ? SEMUTA_DRUG_ID : GIFT;
      const card = game.richeseCache!.find(card => card.id === selected);
      assert.ok(card, `Original gift source needs ${selected}: ${JSON.stringify({ turn: game.turn, phase: game.phase,
        decision: d.kind, cache: game.richeseCache!.map(card => card.id),
        holders: game.players.map(p => ({ id: p.id, cards: p.hand.map(card => card.id) })) })}`);
      return { actor: d.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: card.id, method: 'silent' } };
    }
    if (d?.kind === 'auctionPayment') return { actor: d.player, action: { type: 'decision', karama: false } };
    if (!d && game.status === 'playing' && game.phase === 5)
      return { actor: game.active!, action: { type: 'endMovement' } };
  }
  if (semutaRicheseGiftKaramaClean(game)) {
    const lot = game.richeseAuction;
    if (lot && !lot.outcome) {
      // Once Around closes unbid before its owner acts after every rival passes.
      // Silent gives Richese an actual paid1 self-purchase while all rivals
      // submit their original zero bids, without a fictitious prior rival bid.
      assert.equal(lot.method, 'silent');
      const actor = lot.eligible.find(id => !Object.hasOwn(lot.sealed, id)); assert.ok(actor);
      return { actor, action: { type: 'richeseBid', event: lot.event, amount: actor === DONOR ? 1 : 0, allyPayment: 0 } };
    }
    if (fullHand && game.turn === 1 && game.auction?.active === DONOR && game.auction.bid === 0 &&
        semutaRicheseGiftKaramaPlayer(game, DONOR).hand.length < 3)
      return { actor: DONOR, action: { type: 'bid', amount: 1, allyPayment: 0 } };
  }
  return nextTruthMovementNativeEarlyStep(game, {
    position: 'first', method: 'silent', keepUnbid: false,
    card: game.richeseCache?.find(card => card.id === (game.turn === 1 ? SEMUTA_DRUG_ID : GIFT))?.id,
  });
}
export function advanceSemutaRicheseGiftKarama(game: Game, until: (state: Game) => boolean,
  actions: SemutaRicheseGiftKaramaStep[] = [], fullHand = false): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaRicheseGiftKaramaStep(game, fullHand);
    assert.ok(step, 'Resolve the actual fresh discard or gift before continuing');
    game = actSemutaRicheseGiftKarama(game, step.actor, step.action, actions);
  }
  throw Error('The original Semuta/Richese programme did not reach its finite boundary');
}

/** Pass only this current fresh batch; preserve any restored response parent. */
export function passSemutaRicheseGiftKarama(game: Game, actions: SemutaRicheseGiftKaramaStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaRicheseGiftKarama(game, actor.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaRicheseGiftKarama(game: Game, holder: string,
  actions: SemutaRicheseGiftKaramaStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event, card = pending.batch.entries[0].card.id;
  game = actSemutaRicheseGiftKarama(game, holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaRicheseGiftKarama(game, holder, { type: 'semutaSelect', event, card }, actions);
  return game;
}
/** The used-cost continuation completes the prevention itself. Do not allow
 * the gift or spend a restored parent response in this helper. */
export function finishSemutaRicheseGiftKarama(game: Game): Game {
  assert.ok(!game.pendingTreacheryDiscard, 'Choose the original fresh-discard reaction first');
  assert.ok(!game.pendingRicheseGift, 'The original gift prevention must finish before its parent resumes');
  return game;
}

/** Genuine native acquisitions/alliance. The only controls over physical stock
 * are unopened starting-card/main-deck/Spice positions and original lotteries.
 * No played hand, balance, army, alliance, phase or paused receipt is assigned. */
export function createSemutaRicheseGiftKaramaFixture(options: {
  advanced?: boolean; parent?: 'quiet' | 'emperorIncome'; fullHand?: boolean;
} = {}) {
  const advanced = options.advanced ?? false, parent = options.parent ?? 'quiet', fullHand = options.fullHand ?? false;
  const donor = DONOR, holder = donor, recipient = 'emperor', spender = 'atreides', observer = 'choam';
  let game = createGame('SEMUTARICHESEGIFTKARAMA', newPlayer(donor, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['choam', 'atreides', 'emperor'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: SemutaRicheseGiftKaramaStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaRicheseGiftKarama(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaRicheseGiftKarama(game, until, actions, fullHand); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'explicit-original-semuta-initializer' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => !p.hand.length));
  const originalInventory = semutaRicheseGiftKaramaInventory(game); assert.equal(originalInventory.length, 45);
  const karamas = game.deck.filter(card => card.effect === 'karama'); assert.equal(karamas.length, 2);
  const ordinary = game.deck.find(card => card.kind === 'projectile'), shield = game.deck.find(card => card.kind === 'shield');
  assert.ok(ordinary && shield);
  const deal = [ordinary.id, karamas[0].id, karamas[1].id, shield.id];
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card };
  });
  const beforeStartingDeal = structuredClone(game), cost = karamas[1].id, parentCounter = karamas[0].id;
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), deal);
  const spiceOrder: { turn: number; position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const order = (worm: boolean, position: number) => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && (worm
      ? 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper
      : 'territory' in card && !card.discovery)); assert.ok(from >= position);
    const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ turn: game.turn, position, from, card: structuredClone(card) });
  };
  order(false, 0); if (advanced) order(false, 1);
  reach(state => state.turn === 1 && state.phase === 2 && semutaRicheseGiftKaramaClean(state));
  let normalOrder: { card: string; from: number; before: Game; after: Game } | null = null;
  if (fullHand) {
    const before = structuredClone(game), from = game.deck.findIndex(card => card.kind === 'shield'); assert.ok(from >= 0);
    const card = game.deck.splice(from, 1)[0]; game.deck.unshift(card);
    normalOrder = { card: card.id, from, before, after: structuredClone(game) };
  }
  const buy = (card: string) => {
    const before = structuredClone(game), start = actions.length;
    reach(state => semutaRicheseGiftKaramaPlayer(state, donor).hand.some(candidate => candidate.id === card));
    assert.ok(actions.slice(start).some(step => step.actor === donor && step.action.type === 'richeseBid' && step.action.amount === 1));
    assert.equal(semutaRicheseGiftKaramaPlayer(before, donor).spice - semutaRicheseGiftKaramaPlayer(game, donor).spice, 1);
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game), card, price: 1 };
  };
  const semutaPurchase = buy(SEMUTA_DRUG_ID);
  reach(state => state.turn === 1 && state.phase === 4 && semutaRicheseGiftKaramaClean(state));
  const afterFirstBidding = structuredClone(game);
  assert.equal(semutaRicheseGiftKaramaPlayer(game, donor).hand.length, fullHand ? 3 : 2);
  if (normalOrder) assert.ok(semutaRicheseGiftKaramaPlayer(game, donor).hand.some(card => card.id === normalOrder.card));
  reach(state => state.turn === 2 && state.phase === 1 && semutaRicheseGiftKaramaClean(state) &&
    !state.nexus && !state.spiceWindow && !state.spiceResolution && !state.spiceSequence && !state.ready.length);
  const beforeWorm = structuredClone(game); order(true, 0); order(false, 1); if (advanced) order(false, 2);
  reach(state => state.nexus && semutaRicheseGiftKaramaClean(state) && !state.spiceWindow && !state.spiceResolution);
  const alliance = transition(() => {
    act(donor, { type: 'alliance', target: recipient }); act(recipient, { type: 'alliance', target: donor });
  });
  assert.equal(semutaRicheseGiftKaramaPlayer(game, donor).ally, recipient);
  assert.equal(semutaRicheseGiftKaramaPlayer(game, recipient).ally, donor);
  reach(state => state.turn === 2 && state.phase === 2 && semutaRicheseGiftKaramaClean(state));
  const giftPurchase = buy(GIFT);
  assert.equal(game.response?.kind, 'emperorIncome');
  assert.equal(game.currentAuctionSale?.amount ?? game.auction?.bid, 1);
  if (parent === 'quiet') reach(semutaRicheseGiftKaramaClean);
  assert.equal(semutaRicheseGiftKaramaPlayer(game, holder).hand.length, fullHand ? 4 : 3);
  assert.ok(semutaRicheseGiftKaramaPlayer(game, spender).hand.some(card => card.id === cost));
  assert.ok(semutaRicheseGiftKaramaPlayer(game, observer).hand.some(card => card.id === parentCounter));
  assert.ok(viewGame(game, donor).richeseGift?.cards.some(card => card.id === GIFT));
  const beforeGift = structuredClone(game), originalParent = { response: structuredClone(game.response),
    decision: structuredClone(game.decision), phaseOpening: structuredClone(game.phaseOpening), pendingKarama: structuredClone(game.pendingKarama) };
  const giftAction: Action = { type: 'richeseGift', card: GIFT }, giftDeclaration = transition(() => act(donor, giftAction));
  assert.equal(game.response?.kind, 'richeseGift'); assert.equal(game.response?.recipient, recipient);
  assert.equal(game.pendingRicheseGift?.intent.cardId, GIFT);
  assert.deepEqual(game.pendingRicheseGift?.resume, originalParent);
  assert.deepEqual(semutaRicheseGiftKaramaInventory(game), originalInventory);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' }, source = structuredClone(game);
  return { game, source, beforeCost: source, beforeGift, advanced, parent, fullHand,
    holder, donor, owner: donor, recipient, spender, observer, parentCounter,
    semuta: SEMUTA_DRUG_ID, cost, karama: cost, gift: GIFT, card: cost, action, giftAction,
    lobby, setup, initialization, beforeStartingDeal, afterSetup, dealOrder, spiceOrder,
    semutaPurchase, normalOrder, afterFirstBidding, beforeWorm, alliance, giftPurchase, giftDeclaration, originalParent,
    originalInventory, originalCards: originalInventory, actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Basic uses the real public bare Richese/CHOAM/Atreides/Emperor start. Advanced uses the existing explicit Semuta initializer on the original ready undealt lobby. Both retain original main35/cache10; no mode is converted after start.',
      'Only unopened original starting-card positions (one actual printed Karama each to Atreides/CHOAM), original land/Worm Spice positions and scalar lotteries are selected. Each actual Silent cache auction has a real Richese bid1 and original zero submissions from all other eligible seats: Richese pays1 for Semuta on turn1, forms a mutual Emperor alliance at the actual turn2 Worm, and separately pays1 for Distrans before declaring its original allied gift. This avoids native Once Around’s all-rivals-pass free-retention boundary.',
      fullHand ? 'The full4 branch selects one still-unopened normal Shield before turn1 Bidding and really bids/pays normal1 for it. Starting ordinary + actual Semuta + actual Shield + actual Distrans fill the native hand before the fresh cost; Semuta exchange frees its own slot.' : 'The ordinary source retains exactly its original starting card plus the two actual paid cache purchases.',
      parent === 'emperorIncome' ? 'The original paid-cache EmperorIncome1 remains pending when Richese declares the gift. The distinct originally dealt CHOAM Karama keeps that native parent cancellable after Atreides spends its own original printed Karama.' : 'The quiet branch actually passes the prior original cache-purchase income response before declaring the gift.',
      'Stop before the actual Atreides cancellation. No played card custody, wallet, force, alliance, clock, response, receipt or prevention outcome is installed; caller owns the printed cost and neutral fresh-discard claim/pass.',
    ] };
}
export type SemutaRicheseGiftKaramaFixture = ReturnType<typeof createSemutaRicheseGiftKaramaFixture>;
