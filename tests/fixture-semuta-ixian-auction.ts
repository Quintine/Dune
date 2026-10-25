import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actTruthMovement } from './fixture-truth-movement';
import { nextTruthMovementNativeEarlyStep } from './fixture-truth-movement-native-early';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type SemutaIxianAuctionStep = { actor: string; action: Action };
export type SemutaIxianAuctionKind = 'ixAuction' | 'ixTechnology';
export const actSemutaIxianAuction = actTruthMovement;
export const semutaIxianAuctionPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const semutaIxianAuctionClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
/** Original physical zones only; inspected/known pool copies are receipts. */
export function semutaIxianAuctionInventory(game: Game) {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []), ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original main/cache card has one physical zone'); return ids;
}
/** The original source owns no automatic Semuta decision. Native pool return,
 * declined optional Technology, initial setup and cache bids remain real acts. */
export function nextSemutaIxianAuctionStep(game: Game, buyer = 'choam'): SemutaIxianAuctionStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance) return null;
  if (!game.response && !game.phaseOpening) {
    const d = game.decision;
    if (d?.kind === 'ixSetup') {
      const card = game.ixSetupCards?.find(card => card.kind === 'shield'); assert.ok(card);
      return { actor: d.player, action: { type: 'decision', card: card.id } };
    }
    if (d?.kind === 'ixAuction') {
      const card = game.ixAuction?.cards[0]; assert.ok(card);
      return { actor: d.player, action: { type: 'decision', card: card.id, position: 'bottom' } };
    }
    if (d?.kind === 'ixTechnology') return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d?.kind === 'choamMarket' || d?.kind === 'choamMentat')
      return { actor: d.player, action: { type: 'decision', done: true } };
    if (d?.kind === 'auctionPayment') return { actor: d.player, action: { type: 'decision', karama: false } };
    if (!d && game.phase === 5) return { actor: game.active!, action: { type: 'endMovement' } };
  }
  const lot = game.richeseAuction;
  if (semutaIxianAuctionClean(game) && lot?.cardId === SEMUTA_DRUG_ID && !lot.outcome &&
      lot.active === buyer && lot.bid === 0)
    return { actor: buyer, action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } };
  return nextTruthMovementNativeEarlyStep(game, {
    position: 'first', method: 'onceAround', direction: 'clockwise', keepUnbid: false,
    card: game.richeseCache?.find(card => card.id === SEMUTA_DRUG_ID)?.id ?? game.richeseCache?.[0]?.id,
  });
}
export function advanceSemutaIxianAuction(game: Game, until: (state: Game) => boolean,
  actions: SemutaIxianAuctionStep[] = [], buyer = 'choam'): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaIxianAuctionStep(game, buyer);
    assert.ok(next, 'Choose the actual original fresh-discard reaction before continuing');
    game = actSemutaIxianAuction(game, next.actor, next.action, actions);
  }
  throw Error('The native Ixian auction programme did not reach its finite boundary');
}
/** Original response acknowledgements only, one named opportunity at a time. */
export function allowSemutaIxianAuction(game: Game, kind: string,
  actions: SemutaIxianAuctionStep[] = []): Game {
  for (let count = 0; game.response?.kind === kind && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaIxianAuction(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, kind); return game;
}
export function passSemutaIxianAuction(game: Game, actions: SemutaIxianAuctionStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaIxianAuction(game, actor.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaIxianAuction(game: Game, holder: string,
  actions: SemutaIxianAuctionStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event, card = pending.batch.entries[0].card.id;
  game = actSemutaIxianAuction(game, holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaIxianAuction(game, holder, { type: 'semutaSelect', event, card }, actions);
  return game;
}
/** After prevention, decline only a fresh optional Technology offer and allow
 * the original Atreides peek. Stop before any normal bid; never replay Ix use. */
export function finishSemutaIxianAuction(game: Game, actions: SemutaIxianAuctionStep[] = []): Game {
  assert.ok(!game.pendingTreacheryDiscard, 'Answer the original cost reaction first');
  assert.ok(!['ixAuction', 'ixTechnology'].includes(game.response?.kind ?? ''), 'The original Ixian prevention must finish first');
  if (!game.response && game.decision?.kind === 'ixTechnology')
    game = actSemutaIxianAuction(game, game.decision.player, { type: 'decision', decline: true }, actions);
  if (game.response?.kind === 'atreidesAuction') game = allowSemutaIxianAuction(game, 'atreidesAuction', actions);
  assert.ok(semutaIxianAuctionClean(game)); return game;
}

/** Native public Basic start, or original Advanced Semuta initializer, then
 * actual Ix setup/Storm/HMS and paid first cache. No played custody, force,
 * wallet, phase, queue, response, pool or Technology receipt is installed. */
export function createSemutaIxianAuctionFixture(options: {
  advanced?: boolean; kind?: SemutaIxianAuctionKind; holder?: 'choam' | 'ixians';
} = {}) {
  const kind = options.kind ?? 'ixAuction', advanced = options.advanced ?? kind === 'ixTechnology';
  assert.ok(kind !== 'ixTechnology' || advanced, 'Native Technology is Advanced only');
  const owner = 'ixians', holder = options.holder ?? 'choam', spender = 'atreides', seller = 'richese', observer = 'emperor';
  let game = createGame('SEMUTAIXIANAUCTION', newPlayer(seller, 'Richese', 'richese'), advanced, ['choam', 'ix']);
  for (const faction of ['choam', 'ixians', 'atreides', 'emperor'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: SemutaIxianAuctionStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaIxianAuction(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaIxianAuction(game, until, actions, holder); };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'explicit-original-semuta-initializer' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => !p.hand.length));
  const originalInventory = semutaIxianAuctionInventory(game); assert.equal(originalInventory.length, 57);
  const karamas = game.deck.filter(card => card.effect === 'karama' && !card.id.startsWith('ix-'));
  assert.equal(karamas.length, 2);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 2);
  const shield = game.deck.find(card => card.kind === 'shield'); assert.equal(ordinary.length, 2); assert.ok(shield);
  // Ix actually selects its inspected Shield. The original max scalar lottery
  // leaves the four remaining inspected cards in their existing native order.
  const inspected = [ordinary[0].id, ordinary[1].id, shield.id, karamas[0].id, karamas[1].id];
  const dealOrder = inspected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = karamas[0].id, observerKarama = karamas[1].id;
  let ixSetup: { before: Game; step: SemutaIxianAuctionStep; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 150; count++) {
    const next = nextSemutaIxianAuctionStep(game, holder); assert.ok(next);
    const before = game.decision?.kind === 'ixSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) ixSetup = { before, step: structuredClone(next), after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(ixSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), inspected);
  assert.ok(semutaIxianAuctionPlayer(game, spender).hand.some(card => card.id === cost));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort(), front: Game['spiceDeck'] = [];
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced ? 2 : 1); position++) {
    const from = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(from >= 0);
    const card = game.spiceDeck.splice(from, 1)[0]; front.push(card); spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  game.spiceDeck.unshift(...front);
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaIxianAuctionStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaIxianAuctionPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaIxianAuctionStep(game, holder); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.ok(semutaIxianAuctionPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.equal(semutaIxianAuctionPlayer(beforeBid, holder).spice - semutaIxianAuctionPlayer(game, holder).spice, 1);
  assert.equal(semutaIxianAuctionPlayer(game, seller).spice - semutaIxianAuctionPlayer(beforeBid, seller).spice, 1);
  reach(state => state.response?.kind === 'ixAuction' && !state.phaseOpening && !state.pendingTreacheryDiscard);
  const beforePool = structuredClone(game), poolCount = game.ixAuction!.count;
  assert.equal(game.turn, 1); assert.deepEqual(game.ixAuction!.cards, []); assert.ok(poolCount > 0);
  assert.ok(!game.auction); assert.ok(game.mobileStronghold?.location);
  let poolSelection: { before: Game; steps: SemutaIxianAuctionStep[]; after: Game; card: string } | null = null;
  let technology: { before: Game; step: SemutaIxianAuctionStep; after: Game } | null = null;
  if (kind === 'ixTechnology') {
    const before = structuredClone(game), start = actions.length;
    game = allowSemutaIxianAuction(game, 'ixAuction', actions);
    assert.equal(game.decision?.kind, 'ixAuction');
    const returned = game.ixAuction!.cards[0]; assert.ok(returned);
    act(owner, { type: 'decision', card: returned.id, position: 'bottom' });
    assert.equal(game.decision?.kind, 'ixTechnology');
    poolSelection = { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game), card: returned.id };
    const selected = semutaIxianAuctionPlayer(game, owner).hand.find(card =>
      card.id === (holder === owner ? SEMUTA_DRUG_ID : shield.id)); assert.ok(selected);
    const declaration: SemutaIxianAuctionStep = { actor: owner, action: { type: 'decision', card: selected.id } };
    const beforeTechnology = structuredClone(game); act(declaration.actor, declaration.action);
    technology = { before: beforeTechnology, step: declaration, after: structuredClone(game) };
    assert.equal(game.response?.kind, 'ixTechnology'); assert.equal(game.ixTechnologyTurn, game.turn);
    assert.equal(game.pendingIxTechnology?.card, selected.id);
  }
  assert.equal(game.response?.kind, kind); assert.equal(game.response?.owner, owner);
  assert.ok(semutaIxianAuctionPlayer(game, spender).hand.some(card => card.id === cost));
  assert.ok(semutaIxianAuctionPlayer(game, observer).hand.some(card => card.id === observerKarama));
  assert.deepEqual(semutaIxianAuctionInventory(game), originalInventory);
  const source = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, kind, advanced, holder, spender, owner, ixians: owner, atreides: spender,
    observer, observerKarama, seller, cost, karama: cost, card: cost, semuta: SEMUTA_DRUG_ID, action,
    lobby, setup, initialization, beforeStartingDeal, afterSetup, inspected, dealOrder, ixSetup, spiceOrder,
    acquired, acquisition, beforePool, poolCount, poolSelection, technology,
    declaredCard: game.pendingIxTechnology?.card ?? null,
    selectedSemuta: kind === 'ixTechnology' && holder === owner,
    lotCard: game.auction?.cards[game.auction.index]?.id ?? null,
    originalInventory, originalCards: originalInventory, actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Actual Richese/CHOAM/Ixians/Atreides/Emperor setup uses the public bare Basic start or existing explicit Advanced Semuta initializer. Original ix+choam main47/cache10 and native setup forces/HMS remain intact; no Basic game is converted after start.',
      `Only original unopened setup-pool positions, land Spice positions and scalar lotteries are selected. Ix actually chooses the inspected Shield; its real remainder shuffle deals both original printed Karama cards to Atreides/Emperor. ${holder} really pays cache1 for Semuta before the native first ordinary Ixian pool opens.`,
      kind === 'ixAuction' ? 'Stop at the native undrawn pool response: frozen count, zero drawn cards, no auction and no private pool choice. The cancellation cost and subsequent ordinary draw remain undeclared.' : `Actually allow the original Ixian pool response, return one actual inspected card to the deck bottom, then declare the ${holder === owner ? 'genuinely acquired Semuta itself' : 'selected original Shield'} exchange through the native Technology chooser. Stop after its once-use is spent but before cancellation, exchange or Atreides inspection.`,
      'No played hand, wallet, army, phase, queue, receipt, pool result or once-use is assigned. Claim/pass must resolve the actual used printed cost before the original native prevention continues.',
    ] };
}
export type SemutaIxianAuctionFixture = ReturnType<typeof createSemutaIxianAuctionFixture>;
