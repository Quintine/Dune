import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actTruthMovement } from './fixture-truth-movement';
import { nextTruthMovementNativeEarlyStep } from './fixture-truth-movement-native-early';

export type SemutaRicheseCacheKaramaStep = { actor: string; action: Action };
export const actSemutaRicheseCacheKarama = actTruthMovement;
export const semutaRicheseCacheKaramaPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const semutaRicheseCacheKaramaClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function semutaRicheseCacheKaramaInventory(game: Game): string[] {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original main/cache card has one physical location');
  return ids;
}

/** Real native decisions only. Turn one buys the actual Semuta for one;
 * subsequent original lots receive passes rather than installed outcomes. */
export function nextSemutaRicheseCacheKarama(game: Game): SemutaRicheseCacheKaramaStep | null {
  if (game.truthtrance) return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'choamMarket' || game.decision?.kind === 'choamMentat')
      return { actor: game.decision.player, action: { type: 'decision', done: true } };
    if (!game.decision && game.biddingEnd) {
      const end = game.biddingEnd, actor = end.owners.find(id => !end.ready.includes(id));
      if (actor) return { actor, action: { type: 'biddingEnd', event: end.event, mode: 'ready' } };
    }
    if (!game.decision && game.phase === 5) return { actor: game.active!, action: { type: 'endMovement' } };
  }
  const lot = game.richeseAuction;
  if (semutaRicheseCacheKaramaClean(game) && game.turn === 1 && lot?.cardId === SEMUTA_DRUG_ID &&
      !lot.outcome && lot.active === 'choam' && lot.bid === 0)
    return { actor: 'choam', action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } };
  return nextTruthMovementNativeEarlyStep(game, {
    position: 'first', method: 'onceAround', direction: 'clockwise',
    card: game.richeseCache?.find(card => card.id === SEMUTA_DRUG_ID)?.id ?? game.richeseCache?.[0]?.id,
    keepUnbid: false,
  });
}
export function advanceSemutaRicheseCacheKarama(game: Game, until: (state: Game) => boolean,
  actions: SemutaRicheseCacheKaramaStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The native cache-cancellation source must reach its next control');
    const next = nextSemutaRicheseCacheKarama(game);
    assert.ok(next, `Supply the original owned control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaRicheseCacheKarama(game, next.actor, next.action, actions);
  }
  throw Error('The original Semuta/cache programme did not reach its finite boundary');
}

/** Public bare Basic start or the original Advanced Semuta preview. Only
 * unopened main/Spice positions and scoped scalar lotteries are selected.
 * Semuta is acquired through a real earlier paid cache1 auction. */
export function createSemutaRicheseCacheKaramaFixture(options: {
  advanced?: boolean; position?: 'first' | 'last'; blackMarket?: boolean;
} = {}) {
  const advanced = options.advanced ?? false, position = options.position ?? 'first';
  assert.ok(!options.blackMarket || advanced, 'Only the original Advanced rules offer Black Market');
  const owner = 'richese', holder = 'choam', spender = 'atreides', emperor = 'emperor';
  let game = createGame('SEMUTARICHESECACHEKARAMA', newPlayer(owner, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of [holder, spender, emperor] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaRicheseCacheKaramaStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaRicheseCacheKarama(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaRicheseCacheKarama(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = initializeSemutaGameForAudit(game);
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup, advanced };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced);
  assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaRicheseCacheKaramaInventory(game);
  assert.equal(originalInventory.length, 45); assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 3);
  assert.equal(ordinary.length, 3);
  const selected = [ordinary[0], ordinary[1], printed, ordinary[2]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), cost = printed.id;
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.ok(semutaRicheseCacheKaramaPlayer(game, spender).hand.some(card => card.id === cost));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const front: Game['spiceDeck'] = [], spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced ? 4 : 2); position++) {
    const from = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(from >= 0);
    const card = game.spiceDeck.splice(from, 1)[0]; front.push(card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  game.spiceDeck.unshift(...front);
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bidStep: SemutaRicheseCacheKaramaStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaRicheseCacheKaramaPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaRicheseCacheKarama(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bidStep = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bidStep && bidAt >= 0, 'The holder must buy Semuta through the original cache auction');
  const acquired = structuredClone(game), acquisition = {
    before: beforeBid, bid: bidStep, steps: structuredClone(actions.slice(bidAt)), after: acquired,
  };
  assert.equal(semutaRicheseCacheKaramaPlayer(beforeBid, holder).spice - semutaRicheseCacheKaramaPlayer(game, holder).spice, 1);
  assert.equal(semutaRicheseCacheKaramaPlayer(game, owner).spice - semutaRicheseCacheKaramaPlayer(beforeBid, owner).spice, 1);
  assert.equal(game.richeseCache!.length, 9);
  let blackMarketSale: { before: Game; steps: SemutaRicheseCacheKaramaStep[]; after: Game; card: string } | null = null;
  if (options.blackMarket) {
    reach(state => state.turn === 2 && state.phase === 3 && !state.response && !state.phaseOpening &&
      state.decision?.kind === 'richeseBlackMarket');
    const before = structuredClone(game), start = actions.length;
    const offered = semutaRicheseCacheKaramaPlayer(game, owner).hand.find(card => card.kind === 'projectile'); assert.ok(offered);
    act(owner, { type: 'decision', event: game.richeseBidding!.event, card: offered.id,
      method: 'onceAround', direction: 'clockwise' });
    for (let count = 0; game.decision?.kind !== 'richeseDeclaration' && count < 40; count++) {
      const lot = game.richeseAuction;
      const next = semutaRicheseCacheKaramaClean(game) && lot?.source === 'blackMarket' &&
        !lot.outcome && lot.active === emperor && lot.bid === 0
        ? { actor: emperor, action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } as Action }
        : nextSemutaRicheseCacheKarama(game);
      assert.ok(next); act(next.actor, next.action);
    }
    assert.equal(game.decision?.kind, 'richeseDeclaration');
    assert.ok(semutaRicheseCacheKaramaPlayer(game, emperor).hand.some(card => card.id === offered.id));
    assert.equal(semutaRicheseCacheKaramaPlayer(before, emperor).spice - semutaRicheseCacheKaramaPlayer(game, emperor).spice, 1);
    assert.equal(semutaRicheseCacheKaramaPlayer(game, owner).spice - semutaRicheseCacheKaramaPlayer(before, owner).spice, 1);
    blackMarketSale = { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game), card: offered.id };
  }
  reach(state => state.turn === 2 && state.phase === 3 && !state.response && !state.phaseOpening &&
    state.decision?.kind === 'richeseDeclaration');
  const beforeDeclaration = structuredClone(game), declarationStep: SemutaRicheseCacheKaramaStep = {
    actor: owner, action: { type: 'decision', event: game.richeseBidding!.event, position },
  };
  act(declarationStep.actor, declarationStep.action);
  assert.equal(game.response?.kind, 'richeseAuction'); assert.equal(game.response?.owner, owner);
  assert.equal(game.richeseBidding!.position, position);
  assert.equal(game.richeseBidding!.cacheCanceled, false);
  assert.equal(game.richeseBidding!.blackMarketSold, !!blackMarketSale);
  assert.equal(game.richeseBidding!.normalCountBeforeCache, 4 - Number(!!blackMarketSale));
  assert.equal(game.richeseBidding!.normalCount, 3 - Number(!!blackMarketSale));
  assert.ok(semutaRicheseCacheKaramaPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaRicheseCacheKaramaPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaRicheseCacheKaramaInventory(game), originalInventory);
  const source = structuredClone(game), cache = game.richeseCache!.map(card => card.id);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return {
    game, source, gameBeforeCost: source, action, owner, richese: owner, holder, spender, emperor,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, advanced, position,
    event: game.richeseBidding!.event, beforeCount: game.richeseBidding!.normalCountBeforeCache!,
    beforeNormalCount: game.richeseBidding!.normalCount!, cache, beforeCache: cache,
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, dealOrder, spiceOrder,
    beforeDeclaration, declaration: { before: beforeDeclaration, step: declarationStep, after: source },
    acquired, acquisition, blackMarketSale, originalInventory, inventory: originalInventory, originalSpice,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      advanced
        ? 'Original Advanced Semuta preview initializer acts only on the ready undealt Richese/CHOAM/Atreides/Emperor lobby, with original main35/cache10 and no optional modules. It is not a newly admitted public Advanced mode.'
        : 'Actual public bare Basic Richese ready/start initializes its existing Semuta preview before original setup; original main35/cache10 and no optional modules.',
      'Select four original unopened starting-card positions, including the printed main-deck Karama actually dealt to Atreides. Position only the first two Basic/four Advanced still-unplayed original land Spice Cards and scope scalar lotteries; no played card custody, wallet, force, phase, allowance or response is assigned.',
      'CHOAM actually buys the original Semuta in the first native Once Around cache auction for one spice paid once to Richese. Other original bids/pass responses, normal auctions, Revival and combined turns finish through native controls. First-turn Advanced Black Market is actually declined, never marked sold or cleared by assignment.',
      blackMarketSale
        ? 'At the real second-turn Advanced Black Market, Richese sells its original dealt projectile to Emperor for one through actual Once Around bids and native seller credit. That completed sale independently reduces the frozen ordinary count by one.'
        : 'The second-turn Advanced Black Market, when present, is also actually declined before declaration.',
      `At the real turn2 Bidding declaration, Richese chooses ${position}. Stop at its actual compulsory-cache response before Atreides spends the genuinely dealt printed Karama. The frozen before-cache count is ${4 - Number(!!blackMarketSale)}, the reduced ordinary count ${3 - Number(!!blackMarketSale)} and the original cache stock nine.`,
    ],
  };
}
export type SemutaRicheseCacheKaramaFixture = ReturnType<typeof createSemutaRicheseCacheKaramaFixture>;

export function claimSemutaRicheseCacheKarama(game: Game, fixture: Pick<SemutaRicheseCacheKaramaFixture, 'holder' | 'cost'>,
  actions: SemutaRicheseCacheKaramaStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.reaction?.stage === 'offer');
  const event = pending.batch.event;
  assert.deepEqual(pending.batch.entries.map(entry => entry.card.id), [fixture.cost]);
  game = actSemutaRicheseCacheKarama(game, fixture.holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.batch.event === event && game.pendingTreacheryDiscard.reaction?.stage === 'select')
    game = actSemutaRicheseCacheKarama(game, fixture.holder, { type: 'semutaSelect', event, card: fixture.cost }, actions);
  return game;
}
export function passSemutaRicheseCacheKarama(game: Game, actions: SemutaRicheseCacheKaramaStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.reaction?.stage === 'offer');
  const event = pending.batch.event;
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length + 1; count++) {
    const reaction = game.pendingTreacheryDiscard.reaction; assert.ok(reaction?.stage === 'offer');
    const player = game.players.find(player => !reaction.passed.includes(player.id)); assert.ok(player);
    game = actSemutaRicheseCacheKarama(game, player.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event);
  return game;
}
export function finishSemutaRicheseCacheKarama(game: Game, actions: SemutaRicheseCacheKaramaStep[] = []): Game {
  return advanceSemutaRicheseCacheKarama(game, state => state.phase === 3 &&
    state.richeseBidding?.stage === 'normal' && !!state.auction && semutaRicheseCacheKaramaClean(state), actions);
}
