import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaRicheseCacheKarama, nextSemutaRicheseCacheKarama,
  semutaRicheseCacheKaramaClean, semutaRicheseCacheKaramaInventory,
  semutaRicheseCacheKaramaPlayer,
} from './fixture-semuta-richese-cache-karama';

export type SemutaAuctionInspectionStep = { actor: string; action: Action };
export const actSemutaAuctionInspection = actSemutaRicheseCacheKarama;
export const nextSemutaAuctionInspection = nextSemutaRicheseCacheKarama;
export const semutaAuctionInspectionClean = semutaRicheseCacheKaramaClean;
export const semutaAuctionInspectionInventory = semutaRicheseCacheKaramaInventory;
export const semutaAuctionInspectionPlayer = semutaRicheseCacheKaramaPlayer;

export function advanceSemutaAuctionInspection(game: Game, until: (state: Game) => boolean,
  actions: SemutaAuctionInspectionStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The native inspection source must reach its next control');
    const next = nextSemutaAuctionInspection(game);
    assert.ok(next, `Supply the original owned control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaAuctionInspection(game, next.actor, next.action, actions);
  }
  throw Error('The original Semuta/inspection programme did not reach its finite boundary');
}

/** Real public Basic start or original undealt Advanced Semuta preview. A
 * printed Karama is genuinely dealt to Emperor; CHOAM buys Semuta in an earlier
 * cache1 auction. No played card, balance, force, clock or response is installed. */
export function createSemutaAuctionInspectionFixture(options: { advanced?: boolean; blackMarket?: boolean } = {}) {
  const advanced = options.advanced ?? false, blackMarket = options.blackMarket ?? false;
  assert.ok(!blackMarket || advanced, 'The original Black Market requires Advanced play');
  const richese = 'richese', holder = 'choam', owner = 'atreides', spender = 'emperor';
  let game = createGame('SEMUTAAUCTIONINSPECTION', newPlayer(richese, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of [holder, owner, spender] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAuctionInspectionStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAuctionInspection(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAuctionInspection(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'original-undealt-semuta-preview' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAuctionInspectionInventory(game);
  assert.equal(originalInventory.length, 45); assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 3); assert.equal(ordinary.length, 3);
  const selected = [...ordinary, printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), cost = printed.id;
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.ok(semutaAuctionInspectionPlayer(game, spender).hand.some(card => card.id === cost));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const front: Game['spiceDeck'] = [], spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced ? 4 : 2); position++) {
    const from = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(from >= 0);
    const card = game.spiceDeck.splice(from, 1)[0]; front.push(card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  game.spiceDeck.unshift(...front);
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bidStep: SemutaAuctionInspectionStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaAuctionInspectionPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaAuctionInspection(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bidStep = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bidStep && bidAt >= 0, 'The actual earlier cache auction must give CHOAM Semuta');
  const acquired = structuredClone(game), acquisition = {
    before: beforeBid, bid: bidStep, steps: structuredClone(actions.slice(bidAt)), after: acquired,
  };
  assert.equal(semutaAuctionInspectionPlayer(beforeBid, holder).spice - semutaAuctionInspectionPlayer(game, holder).spice, 1);
  assert.equal(semutaAuctionInspectionPlayer(game, richese).spice - semutaAuctionInspectionPlayer(beforeBid, richese).spice, 1);
  assert.equal(game.richeseCache!.length, 9);
  let beforeBlackMarket: Game | null = null, blackMarketStep: SemutaAuctionInspectionStep | null = null;
  if (blackMarket) {
    reach(state => state.turn === 2 && state.phase === 3 && !state.response && !state.phaseOpening &&
      state.decision?.kind === 'richeseBlackMarket');
    beforeBlackMarket = structuredClone(game);
    const selected = semutaAuctionInspectionPlayer(game, richese).hand.find(card => card.kind === 'projectile'); assert.ok(selected);
    blackMarketStep = { actor: richese, action: { type: 'decision', event: game.richeseBidding!.event,
      card: selected.id, method: 'normal', direction: 'clockwise' } };
    act(blackMarketStep.actor, blackMarketStep.action);
  }
  reach(state => state.turn === 2 && state.phase === 3 && state.response?.kind === 'atreidesAuction' &&
    (blackMarket ? state.richeseAuction?.source === 'blackMarket' : !!state.auction && !state.richeseAuction));
  assert.equal(game.response?.owner, owner);
  assert.ok(semutaAuctionInspectionPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaAuctionInspectionPlayer(game, spender).hand.some(card => card.id === cost));
  const origin = blackMarket ? 'blackMarket' as const : 'normal' as const;
  const originalLot = structuredClone(blackMarket ? game.richeseAuction! : game.auction!);
  const cards = blackMarket ? [game.richeseAuction!.cardId] : game.auction!.cards.map(card => card.id);
  const nextBidder = blackMarket ? game.richeseAuction!.active : game.auction!.active; assert.ok(nextBidder);
  assert.equal(blackMarket ? game.richesePeekKnown : game.auction!.peekKnown, false);
  assert.deepEqual(semutaAuctionInspectionInventory(game), originalInventory);
  const source = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return {
    game, source, gameBeforeCost: source, action, advanced, blackMarket, origin,
    holder, spender, owner, richese, cost, karama: cost, semuta: SEMUTA_DRUG_ID,
    originalLot, cards, count: cards.length, nextBidder, originalResponse: structuredClone(game.response),
    cache: game.richeseCache!.map(card => card.id), originalRound: structuredClone(game.richeseBidding),
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, dealOrder, spiceOrder,
    beforeBlackMarket, blackMarketStep, acquired, acquisition,
    originalInventory, inventory: originalInventory, originalSpice,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      advanced
        ? 'Existing Advanced Semuta initializer acts only on the ready undealt original R/C/A/E lobby; no new public entry or played preview flag is installed.'
        : 'Actual public bare Basic R/C/A/E ready/start initializes its existing Semuta preview before original setup.',
      'Select only four unopened original starting positions, including the printed main-deck Karama genuinely dealt to Emperor, and the first two Basic/four Advanced original land Spice positions. Scoped native scalar lotteries retain original physical components and all actual setup/action owners.',
      'CHOAM buys the original Semuta from the first native Once Around cache auction for one spice paid once to Richese. Original first-turn normal lots, Revival, combined turns and Mentat finish through native controls; no played hand, wallet, force, clock, auction or response is assigned.',
      blackMarket
        ? 'At the real second-turn Advanced Black Market, Richese offers its actual original dealt projectile using normal bidding. Stop at the real still-unseen Atreides inspection before bidding, payment, delivery or declaration. The offered card remains physically held by Richese.'
        : 'The actual second-turn compulsory cache auction completes through native pass/remove controls. Stop at the first real normal-pool Atreides inspection before any bid, peek, payment or acquisition.',
    ],
  };
}
export type SemutaAuctionInspectionFixture = ReturnType<typeof createSemutaAuctionInspectionFixture>;

export function passSemutaAuctionInspection(game: Game, actions: SemutaAuctionInspectionStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const player = game.players.find(player => !reaction.passed.includes(player.id)); assert.ok(player);
    game = actSemutaAuctionInspection(game, player.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaAuctionInspection(game: Game, fixture: Pick<SemutaAuctionInspectionFixture, 'holder' | 'cost'>,
  actions: SemutaAuctionInspectionStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event;
  assert.equal(pending.batch.entries[0].card.id, fixture.cost);
  game = actSemutaAuctionInspection(game, fixture.holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaAuctionInspection(game, fixture.holder, { type: 'semutaSelect', event, card: fixture.cost }, actions);
  return game;
}
/** The used-cost callback completes the native prevention itself. Do not bid,
 * reveal the card or consume a later response in this finish helper. */
export function finishSemutaAuctionInspection(game: Game): Game {
  assert.ok(!game.pendingTreacheryDiscard, 'Resolve the original fresh cost first');
  assert.notEqual(game.response?.kind, 'atreidesAuction', 'The original inspection prevention must complete once');
  return game;
}
