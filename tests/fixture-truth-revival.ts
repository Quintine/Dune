import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { forceRevivalQuote } from '../game/revival';
import type { RevivalClaim } from '../game/revival-promises';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { actTruthBid, truthBidInventory, truthBidPlayer } from './fixture-truth-bid';

export type TruthRevivalStep = { actor: string; action: Action };
export type TruthRevivalTransition = { before: Game; steps: TruthRevivalStep[]; after: Game };
export const actTruthRevival = actTruthBid;
export const truthRevivalInventory = truthBidInventory;
export const truthRevivalPlayer = truthBidPlayer;
export const truthRevivalClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export function nextTruthRevival(game: Game): TruthRevivalStep | null {
  if (game.truthtrance) return null;
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'revivalStop')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  if (game.phase === 4 && truthRevivalClean(game)) {
    const actors = game.revivalOrder ? game.revivalOrder.remaining.slice(0, 1) : game.players.filter(player => !game.ready.includes(player.id)).map(player => player.id);
    for (const actor of actors) {
      const guide = viewGame(game, actor).revivalPromiseGuide;
      if (guide) return { actor, action: guide.action };
    }
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceTruthRevival(game: Game, until: (state: Game) => boolean, actions: TruthRevivalStep[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Revival source ended before its owned control');
    const next = nextTruthRevival(game); assert.ok(next, 'The original Truthtrance answer belongs to its caller');
    game = actTruthRevival(game, next.actor, next.action, actions);
  }
  throw Error('The original Revival source did not reach its finite boundary');
}
export function settleTruthRevival(game: Game, actions: TruthRevivalStep[] = []): Game {
  return advanceTruthRevival(game, truthRevivalClean, actions);
}
export function finishTruthRevival(game: Game, actions: TruthRevivalStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthRevival(game, state => state.turn === turn && state.phase === 5 && truthRevivalClean(state), actions);
}

/** Genuine public H/A/E base33; optional native Tleilaxu selects original Ix47
 * without optional modules. H receives both original Truthtrances. E really
 * pays6 to ship3 into next-Storm sector2, including one Sardaukar in Advanced.
 * The real next Storm destroys those counters before original turn2 Revival.
 * Only unopened deal/Spice positions and scalar lotteries are selected; no
 * played hand, purse, army, Tanks, clock, question or promise is installed. */
export function createTruthRevivalFixture(options: {
  advanced?: boolean; window?: 'active' | 'waiting'; targetGhola?: boolean; stopper?: boolean;
} = {}) {
  const advanced = options.advanced ?? false, window = options.window ?? 'active', stopper = options.stopper ?? false;
  assert.ok(!stopper || advanced, 'The native Tleilaxu special Karama witness uses its actual Advanced power');
  const asker = 'harkonnen', opponent = 'atreides', target = 'emperor';
  let game = createGame('TRUTHREVIVALSOURCE', newPlayer(asker, 'Harkonnen', 'harkonnen'), advanced, stopper ? ['ix'] : []);
  for (const faction of [opponent, target, ...(stopper ? ['tleilaxu' as const] : [])] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: TruthRevivalStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthRevival(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthRevival(game, until, actions); };
  const transition = (run: () => void): TruthRevivalTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(asker, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => !player.hand.length));
  const originalCards = truthRevivalInventory(game); assert.equal(originalCards.length, stopper ? 47 : 33);
  const truths = game.deck.filter(card => card.effect === 'truthtrance'); assert.equal(truths.length, 2);
  const filler = game.deck.find(card => card.name === 'Baliset');
  const targetCard = game.deck.find(card => options.targetGhola ? card.effect === 'ghola' : card.kind === 'shield');
  const karama = stopper ? game.deck.find(card => card.effect === 'karama') : null;
  assert.ok(filler && targetCard && (!stopper || karama));
  const deal = [truths[0].id, truths[1].id, filler.id, targetCard.id, ...(karama ? [karama.id] : [])];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthRevivalPlayer(game, asker).hand.map(card => card.id), truths.map(card => card.id));
  assert.ok(truthRevivalPlayer(game, target).hand.some(card => card.id === targetCard.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery && card.sector >= 7);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === target && truthRevivalClean(state));
  assert.equal(game.storm, 1);
  const sector = 2, destination = TERRITORIES.find(place => place.type === 'sand' && place.sectors.includes(sector) &&
    game.players.every(player => !Object.keys(player.forces).some(key => key.startsWith(`${place.id}:`))));
  assert.ok(destination);
  const location = `${destination.id}:${sector}`, elite = advanced ? 1 : 0;
  const shipmentAction: Action = { type: 'ship', territory: destination.id, sector, amount: 3, elite, allyPayment: 0 };
  const shipment = transition(() => { act(target, shipmentAction); reach(truthRevivalClean); });
  assert.equal(truthRevivalPlayer(game, target).spice, 4); assert.equal(truthRevivalPlayer(game, target).forces[location], 3);
  assert.equal(truthRevivalPlayer(game, target).elites?.forces[location] ?? 0, elite);
  const continuation = transition(() => {
    reach(state => state.turn === 2 && state.phase === 0 && truthRevivalClean(state) && state.stormPending !== null);
  });
  const storm = transition(() => { reach(state => state.turn === 2 && state.phase === 1 && truthRevivalClean(state)); });
  assert.equal(truthRevivalPlayer(game, target).forces[location], undefined);
  assert.equal(truthRevivalPlayer(game, target).tanks, 3);
  assert.equal(truthRevivalPlayer(game, target).elites?.tanks ?? 0, elite);
  const arrival = transition(() => { reach(state => state.turn === 2 && state.phase === 4 && truthRevivalClean(state)); });
  const opened = structuredClone(game);
  if (window === 'active' && game.revivalOrder) {
    assert.ok(game.revivalOrder.remaining.includes(target));
    reach(state => state.phase === 4 && truthRevivalClean(state) && state.revivalOrder?.remaining[0] === target);
  }
  const source = truthRevivalPlayer(game, target), quote = forceRevivalQuote(game, source, 3, elite);
  assert.equal(source.spice, 4); assert.equal(source.reserves, 17); assert.equal(source.revived, 0);
  assert.equal(source.freeForcesRevived ?? 0, 0); assert.equal(quote.free, 1); assert.equal(quote.cost, 4);
  assert.deepEqual(truthRevivalInventory(game), originalCards);
  const question = { kind: 'revival' as const, target, turn: game.turn, counter: 'total' as const, minimum: 3 };
  const special: Action | null = karama ? { type: 'card', card: karama.id, mode: 'special', target } : null;
  return { game, sourceGame: structuredClone(game), initial, lobby, setup, beforeStartingDeal, afterSetup,
    advanced, window, stopper: stopper ? 'tleilaxu' : null, asker, opponent, target, actor: asker,
    truths: truths.map(card => card.id), truth: truths[0].id, card: truths[0].id,
    ghola: options.targetGhola ? targetCard.id : null, karama: karama?.id ?? null, special,
    destination: destination.id, sector, location, elite, shipmentAction, shipment, continuation, storm, arrival, opened,
    quote, question, declarationAction: { type: 'card', card: truths[0].id } as Action,
    questionAction: { type: 'truthAsk', question } as Action, revivalAction: { type: 'revive', amount: 3, elite } as Action,
    originalCards, originalInventory: originalCards, originalSpice, deal, dealOrder, spiceOrder,
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[], sourceDisclosure: 'Original public H/A/E basic33 (or Advanced native Tleilaxu/Ix47) selects only unopened deals/ordinary Spice and scalar lotteries. Emperor actually ships3 for6, loses3 to the next native Storm and reaches original turn2 Revival with4 spice; Advanced casualties include1 Sardaukar. All ordinary returns, Truth declarations/answers and optional original Ghola/Tleilaxu Karama are caller actions, never installed state.' };
}
export type TruthRevivalFixture = ReturnType<typeof createTruthRevivalFixture>;

export function declareTruthRevival(f: TruthRevivalFixture, state = f.game, options: { copies?: 1 | 2 } = {}) {
  let game = state; const before = structuredClone(game), actions: TruthRevivalStep[] = [];
  const declaration: Action = { type: 'card', card: f.truths[0], ...(options.copies === 2 ? { cards: [f.truths[1]] } : {}) };
  game = actTruthRevival(game, f.asker, declaration, actions);
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthRevival(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, declaration, actions, actionCount: actions.length };
}
export function askTruthRevival(game: Game, asker: string, target: string, minimum = 3,
  counter: RevivalClaim['counter'] = 'total', actions: TruthRevivalStep[] = []): Game {
  return actTruthRevival(game, asker, { type: 'truthAsk', question: { kind: 'revival', target, turn: game.turn, counter, minimum } }, actions);
}
export function answerTruthRevival(game: Game, target: string, answer: 'yes' | 'no', actions: TruthRevivalStep[] = []): Game {
  return actTruthRevival(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthRevival(f: TruthRevivalFixture, answer: 'yes' | 'no' = 'yes', minimum = 3,
  counter: RevivalClaim['counter'] = 'total', state = f.game) {
  const declared = declareTruthRevival(f, state), actions = [...declared.actions];
  const asked = askTruthRevival(declared.game, f.asker, f.target, minimum, counter, actions);
  const game = answerTruthRevival(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}
