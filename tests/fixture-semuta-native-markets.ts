import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { quoteChoamSaleCancellation } from '../game/choam-sale-cancellation';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaRicheseCacheKarama, nextSemutaRicheseCacheKarama,
  semutaRicheseCacheKaramaClean, semutaRicheseCacheKaramaInventory, semutaRicheseCacheKaramaPlayer,
} from './fixture-semuta-richese-cache-karama';
import { passSemutaFremenGuildMovement, claimSemutaFremenGuildMovement } from './fixture-semuta-fremen-guild-movement';

export type SemutaNativeMarketsKind = 'choamSale' | 'richeseBlackMarket';
export type SemutaNativeMarketsStep = { actor: string; action: Action };
export const actSemutaNativeMarkets = actSemutaRicheseCacheKarama;
export const passSemutaNativeMarkets = passSemutaFremenGuildMovement;
export const claimSemutaNativeMarkets = claimSemutaFremenGuildMovement;
export const semutaNativeMarketsPlayer = semutaRicheseCacheKaramaPlayer;
export const semutaNativeMarketsInventory = semutaRicheseCacheKaramaInventory;
export const semutaNativeMarketsClean = semutaRicheseCacheKaramaClean;

/** Native no-spending programme; the selected market response/fresh batch stays
 * explicit. Original early markets are actually closed before cache acquisition. */
export function nextSemutaNativeMarkets(game: Game): SemutaNativeMarketsStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance ||
    ['choamSale', 'richeseBlackMarket'].includes(game.response?.kind ?? '')) return null;
  const step = nextSemutaRicheseCacheKarama(game);
  if (step?.action.type === 'stormDial' && game.turn === 1)
    return { actor: step.actor, action: { ...step.action, amount: 0 } };
  return step;
}
export function advanceSemutaNativeMarkets(game: Game, until: (state: Game) => boolean,
  actions: SemutaNativeMarketsStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaNativeMarkets(game); assert.ok(step, 'Choose the actual native market or fresh-discard response');
    game = actSemutaNativeMarkets(game, step.actor, step.action, actions);
  }
  throw Error('The genuine native-market programme did not reach its finite boundary');
}
export function allowSemutaNativeMarkets(game: Game, actions: SemutaNativeMarketsStep[] = []): Game {
  const kind = game.response?.kind; assert.ok(kind === 'choamSale' || kind === 'richeseBlackMarket');
  for (let count = 0; count < game.players.length && game.response?.kind === kind; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaNativeMarkets(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, kind); return game;
}
/** Finish only a positive sale's actual fresh discard, or the accepted original
 * Black Market's real zero bids. Keep the next CHOAM/compulsory-cache chooser. */
export function finishSemutaNativeMarkets(game: Game, kind: SemutaNativeMarketsKind,
  actions: SemutaNativeMarketsStep[] = []): Game {
  if (kind === 'choamSale' && game.pendingTreacheryDiscard) {
    assert.equal(game.pendingTreacheryDiscard.continuation.kind, 'choamSaleDiscard');
    assert.equal(game.pendingTreacheryDiscard.batch.cause, 'choamSale');
    game = passSemutaNativeMarkets(game, actions);
  }
  assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Resolve the original cancellation cost first');
  assert.notEqual(game.response?.kind, kind);
  if (kind === 'richeseBlackMarket') {
    const event = game.richeseAuction?.event;
    for (let count = 0; event && game.richeseAuction?.event === event && count < 12; count++) {
      const lot = game.richeseAuction;
      assert.equal(lot.source, 'blackMarket'); assert.equal(game.response ?? null, null);
      assert.equal(game.decision ?? null, null); assert.ok(lot.active); assert.equal(lot.bid, 0);
      game = actSemutaNativeMarkets(game, lot.active, { type: 'richeseBid', event, amount: null }, actions);
    }
    assert.equal(game.richeseAuction ?? null, null); assert.equal(game.decision?.kind, 'richeseDeclaration');
  } else {
    assert.equal(game.decision?.kind, 'choamMarket'); assert.equal(game.choamMarket?.sale, undefined);
  }
  return game;
}

/** Public Basic/original Advanced R/C/E source. Duplicate sales obtain their
 * witness by an actual paid normal auction, not a played hand assignment. */
export function createSemutaNativeMarketsFixture(options: {
  kind: SemutaNativeMarketsKind; advanced?: boolean; worthless?: boolean;
}) {
  const kind = options.kind, advanced = options.advanced ?? kind === 'richeseBlackMarket';
  const worthless = options.worthless ?? false;
  assert.ok(kind !== 'richeseBlackMarket' || advanced && !worthless);
  const richese = 'richese', holder = 'choam', spender = 'emperor', owner = kind === 'choamSale' ? holder : richese;
  let game = createGame('SEMUTANATIVEMARKETS', newPlayer(richese, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of [holder, spender] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaNativeMarketsStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaNativeMarkets(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaNativeMarkets(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
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
  const originalInventory = semutaNativeMarketsInventory(game); assert.equal(originalInventory.length, 45);
  assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const duplicate = game.deck.find(card => card.kind === 'shield' && !card.effect &&
    game.deck.some(other => other.id !== card.id && other.name === card.name)); assert.ok(duplicate);
  const twin = game.deck.find(card => card.id !== duplicate.id && card.name === duplicate.name); assert.ok(twin);
  const filler = game.deck.find(card => card.kind === 'projectile' && !card.effect); assert.ok(filler);
  const junk = worthless ? game.deck.find(card => card.kind === 'worthless') : null;
  if (worthless) assert.ok(junk);
  const saleCard = kind === 'choamSale' ? worthless ? junk!.id : duplicate.id : duplicate.id;
  const witness = kind === 'choamSale' && !worthless ? twin.id : undefined;
  const selected = kind === 'richeseBlackMarket' ? [duplicate.id, filler.id, printed.id]
    : [filler.id, saleCard, printed.id, ...(witness ? [witness] : [])];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, from, position };
  });
  const beforeStartingDeal = structuredClone(game), cost = printed.id;
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.slice(0, 3));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced ? kind === 'richeseBlackMarket' ? 4 : 2 : 1); position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      ['hagga_basin', 'rock_outcroppings', 'broken_land', 'oh_gap'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaNativeMarketsStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaNativeMarketsPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaNativeMarkets(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaNativeMarketsPlayer(beforeBid, holder).spice - semutaNativeMarketsPlayer(game, holder).spice, 1);
  assert.equal(semutaNativeMarketsPlayer(game, richese).spice - semutaNativeMarketsPlayer(beforeBid, richese).spice, 1);
  let normalPurchase: ReturnType<typeof transition> | null = null;
  if (witness) {
    reach(state => state.phase === 3 && semutaNativeMarketsClean(state) && !!state.auction &&
      state.auction.index === 0 && state.auction.active === holder && state.auction.bid === 0);
    assert.equal(game.auction!.cards[0].id, witness);
    normalPurchase = transition(() => {
      act(holder, { type: 'bid', amount: 1, allyPayment: 0 });
      reach(state => semutaNativeMarketsClean(state) && semutaNativeMarketsPlayer(state, holder).hand.some(card => card.id === witness));
    });
    assert.equal(semutaNativeMarketsPlayer(normalPurchase.before, holder).spice - semutaNativeMarketsPlayer(game, holder).spice, 1);
    assert.equal(semutaNativeMarketsPlayer(game, holder).hand.filter(card => card.id === witness).length, 1);
  }
  let nativeAction: Action;
  if (kind === 'choamSale') {
    reach(state => state.turn === 1 && state.phase === 3 && !state.response && !state.phaseOpening && state.decision?.kind === 'choamMarket');
    nativeAction = { type: 'decision', mode: 'sell', card: saleCard, ...(witness ? { witness } : {}) };
  } else {
    reach(state => state.turn === 2 && state.phase === 3 && !state.response && !state.phaseOpening && state.decision?.kind === 'richeseBlackMarket');
    nativeAction = { type: 'decision', event: game.richeseBidding!.event, card: saleCard,
      method: 'normal', direction: 'clockwise' };
  }
  const beforeDeclaration = structuredClone(game), declaration = transition(() => { act(owner, nativeAction); });
  assert.equal(game.response?.kind, kind); assert.equal(game.response?.owner, owner);
  assert.equal(game.decision ?? null, null); assert.equal(game.phaseOpening ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(semutaNativeMarketsPlayer(game, owner), semutaNativeMarketsPlayer(beforeDeclaration, owner));
  assert.ok(semutaNativeMarketsPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaNativeMarketsPlayer(game, spender).hand.some(card => card.id === cost));
  const source = structuredClone(game), originalResponse = structuredClone(game.response!);
  const originalMarket = structuredClone(game.choamMarket ?? null), originalLot = structuredClone(game.richeseAuction ?? null);
  const originalRound = structuredClone(game.richeseBidding ?? null), originalAuction = structuredClone(game.auction ?? null);
  const originalDeck = game.deck.map(card => card.id), originalCache = game.richeseCache!.map(card => card.id);
  const sale = structuredClone(game.choamMarket?.sale ?? null), price = kind === 'choamSale' ? worthless ? 2 : 3 : 0;
  const expected = kind === 'choamSale' ? quoteChoamSaleCancellation(game, game.response!) : null;
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  assert.deepEqual(semutaNativeMarketsInventory(game), originalInventory);
  return { game, source, beforeCost: source, kind, advanced, worthless, richese, holder, spender, owner,
    cost, semuta: SEMUTA_DRUG_ID, action, nativeAction, originalResponse,
    saleCard, witness, price, sale, originalMarket, originalLot, originalRound, originalAuction, originalDeck, originalCache, expected,
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, selected, dealOrder, originalSpice, spiceOrder,
    acquired, acquisition, normalPurchase, beforeDeclaration, declaration,
    originalInventory, actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Public Basic start or original Advanced Semuta initializer on a genuinely ready undealt R/C/E lobby, exact CHOAM and no optional modules. Only unopened original starting/next-normal-card/Spice positions and scalar lotteries are selected; original main35/cache10 remain physical. Emperor receives printed Karama and CHOAM buys original cache Semuta for1.',
      kind === 'richeseBlackMarket' ? 'Original first-turn phases finish through actual no-spending controls. At the genuine turn2 Advanced Black Market, Richese offers its actually dealt Shield using normal bidding. Stop at the original response with card still held, no bids/payment, and compulsory-cache accounting unresolved.' :
        witness ? 'CHOAM holds its actually dealt Shield. Its first real normal bid1 buys a second exact printed-name physical copy after cache Semuta. At the original closing Bidding market it declares the first card for3 with that genuinely acquired witness; neither card has moved or produced revenue.' :
          'CHOAM retains its actually dealt Worthless through earlier native markets. After real cache Semuta and original normal Bidding, it declares that original Worthless for2 at the closing market, with no witness or pre-applied discard/payout.',
      'Stop before the separate original printed cancellation cost. Denial preserves original held sale/Black Market card and revenue0, then resumes the next native market/declaration. Positive CHOAM sale honors its existing actual fresh-discard window; accepted Black Market finishes only real zero bids, not a fabricated outcome or purchase.',
    ] };
}
export type SemutaNativeMarketsFixture = ReturnType<typeof createSemutaNativeMarketsFixture>;
