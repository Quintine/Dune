import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { actTruthMovement, type TruthMovementStep } from './fixture-truth-movement';

export type TruthBidStep = TruthMovementStep;
export const actTruthBid = actTruthMovement;
export const truthBidPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const truthBidClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard;
export function truthBidInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original Treachery Card keeps one physical slot');
  return ids;
}
export function nextTruthBid(game: Game): TruthBidStep | null {
  if (game.truthtrance) return null;
  if (truthBidClean(game) && game.phase === 3 && game.auction) {
    const actor = game.auction.active, guide = viewGame(game, actor).bidPromiseGuide;
    return { actor, action: guide?.action ?? { type: 'passBid' } };
  }
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'auctionPayment' && game.auction &&
    game.auction.bid > truthBidPlayer(game, game.decision.player).spice)
    return null; // Caller owns the actual unfunded Karama payment choice.
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceTruthBid(game: Game, until: (state: Game) => boolean, actions: TruthBidStep[] = []): Game {
  for (let count = 0; count < 900; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original bid source ended before its owned control');
    const next = nextTruthBid(game); assert.ok(next, 'The original Truthtrance or unfunded Karama choice belongs to its caller');
    game = actTruthBid(game, next.actor, next.action, actions);
  }
  throw Error('The original bid source did not reach its finite boundary');
}
export function continueTruthBidLot(game: Game, actions: TruthBidStep[] = []): Game {
  assert.ok(game.auction); const turn = game.turn, lot = game.auction.index + 1;
  return advanceTruthBid(game, state => state.turn !== turn || state.phase !== 3 ||
    !state.auction || state.auction.index + 1 !== lot, actions);
}
export function finishTruthBid(game: Game, actions: TruthBidStep[] = []): Game {
  return advanceTruthBid(game, state => state.phase === 4 && truthBidClean(state), actions);
}

/** Public original H/A/E base33, Basic or Advanced preview. Only original
 * unopened starting-deal/lot/Spice positions and scalar lotteries are selected.
 * Harkonnen really receives both original consecutive Truthtrances, Atreides
 * Baliset and Emperor Shield (or original Karama). No dealt hand, purse, force,
 * auction, question, answer or promise is installed. */
export function createTruthBidFixture(options: {
  advanced?: boolean; window?: 'waiting' | 'active'; targetKarama?: boolean;
  firstLotEffect?: 'hajr';
} = {}) {
  const advanced = options.advanced ?? false, window = options.window ?? 'waiting';
  const asker = 'harkonnen', opponent = 'atreides', target = 'emperor';
  let game = createGame('TRUTHBIDSOURCE', newPlayer(asker, 'Harkonnen', 'harkonnen'), advanced);
  joinGame(game, newPlayer(opponent, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(target, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthBidStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthBid(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthBid(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(asker, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalCards = truthBidInventory(game); assert.equal(originalCards.length, 33);
  const truths = game.deck.filter(card => card.effect === 'truthtrance'); assert.equal(truths.length, 2);
  const filler = game.deck.find(card => card.name === 'Baliset');
  const targetCard = game.deck.find(card => options.targetKarama ? card.effect === 'karama' : card.kind === 'shield');
  const lotCards = [game.deck.find(card => options.firstLotEffect ? card.effect === options.firstLotEffect : card.kind === 'projectile'), game.deck.find(card => card.kind === 'poison'),
    game.deck.find(card => card.kind === 'snooper')];
  assert.ok(filler && targetCard && lotCards.every(Boolean));
  const deal = [truths[0].id, truths[1].id, filler.id, targetCard.id];
  const prefix = [...deal, ...lotCards.map(card => card!.id)];
  const dealOrder = prefix.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthBidPlayer(game, asker).hand.map(card => card.id), truths.map(card => card.id));
  assert.deepEqual(truthBidPlayer(game, opponent).hand.map(card => card.id), [filler.id]);
  assert.deepEqual(truthBidPlayer(game, target).hand.map(card => card.id), [targetCard.id]);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  reach(state => state.turn === 1 && state.phase === 3 && !!state.auction && truthBidClean(state));
  const beforePasses = structuredClone(game);
  if (window === 'active') reach(state => state.auction?.active === target && truthBidClean(state));
  assert.equal(game.auction!.index, 0); assert.equal(game.auction!.bid, 0);
  assert.equal(game.auction!.active, window === 'active' ? target : asker);
  assert.equal(truthBidPlayer(game, target).spice, 10); assert.equal(truthBidPlayer(game, opponent).spice, 10);
  assert.equal(viewGame(game, target).bidPromiseLot?.lot, 1);
  assert.deepEqual(truthBidInventory(game), originalCards);
  const question = { kind: 'bid' as const, target, turn: game.turn, lot: game.auction!.index + 1, minimum: 4 };
  return { game, sourceGame: structuredClone(game), initial, lobby, setup, beforeStartingDeal, afterSetup, beforePasses,
    advanced, window, asker, opponent, target, actor: asker, truth: truths[0].id, card: truths[0].id,
    truths: truths.map(card => card.id), targetCard: targetCard.id, karama: options.targetKarama ? targetCard.id : null,
    question, declarationAction: { type: 'card', card: truths[0].id } as Action,
    questionAction: { type: 'truthAsk', question } as Action,
    lotCard: game.auction!.cards[game.auction!.index].id, lotCards: lotCards.map(card => card!.id),
    deal, dealOrder, spiceOrder, originalSpice, originalCards, originalInventory: originalCards,
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[], sourceDisclosure: 'Genuine public H/A/E base33 setup. Only original unopened four-card starting deal, three ordinary lot positions, two ordinary Spice positions and scalar lotteries are selected. Harkonnen owns both physical Truthtrances; active Emperor additionally follows real H/A passes. No played hand, wallet, force, lot, Truthtrance or promise is installed.' };
}
export type TruthBidFixture = ReturnType<typeof createTruthBidFixture>;

export function declareTruthBid(f: TruthBidFixture, state = f.game, options: { copies?: 1 | 2 } = {}) {
  let game = state; const before = structuredClone(game), actions: TruthBidStep[] = [];
  const declaration: Action = { type: 'card', card: f.truths[0], ...(options.copies === 2 ? { cards: [f.truths[1]] } : {}) };
  game = actTruthBid(game, f.asker, declaration, actions);
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthBid(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, declaration, actions, actionCount: actions.length };
}
export function askTruthBid(game: Game, asker: string, target: string, minimum = 4, actions: TruthBidStep[] = []): Game {
  assert.ok(game.auction);
  return actTruthBid(game, asker, { type: 'truthAsk', question: {
    kind: 'bid', target, turn: game.turn, lot: game.auction.index + 1, minimum,
  } }, actions);
}
export function answerTruthBid(game: Game, target: string, answer: 'yes' | 'no', actions: TruthBidStep[] = []): Game {
  return actTruthBid(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthBid(f: TruthBidFixture, answer: 'yes' | 'no' = 'yes', minimum = 4, state = f.game) {
  const declared = declareTruthBid(f, state), actions = [...declared.actions];
  const asked = askTruthBid(declared.game, f.asker, f.target, minimum, actions);
  const game = answerTruthBid(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}
