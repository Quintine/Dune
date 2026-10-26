import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import { actChoamCharityFunding, nextChoamCharityFundingStep,
  type ChoamCharityFundingStep } from './fixture-choam-charity-funding';

export type AdvancedCharityOrderStep = ChoamCharityFundingStep;
export const actAdvancedCharityOrder = actChoamCharityFunding;
export const advancedCharityOrderReload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
export const advancedCharityOrderPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const advancedCharityOrderClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.pendingTreacheryDiscard && !game.truthtrance;

export function advancedCharityOrderInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])]
    .map(card => card.id).sort();
  assert.deepEqual(cards, treacheryDeck(game.expansions).map(card => card.id).sort());
  const traitors = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices])].sort();
  if (traitors.length) assert.deepEqual(traitors, traitorDeck(game.players, false).sort());
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort();
  for (const player of game.players)
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
  return { cards, traitors, spice };
}

/** Setup, original counters and current Charity Finish only; no automatic claim. */
export function nextAdvancedCharityOrderStep(game: Game): AdvancedCharityOrderStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'atreides', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'forces' && game.advanced &&
      !advancedCharityOrderPlayer(game, 'beneGesserit').advisorSetup)
      return { actor: 'beneGesserit', action: { type: 'advisorSetup', territory: 'polar_sink', sector: 0 } };
    if (game.decision?.kind === 'advisorBattle')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.phase === 2 && !game.decision && game.charityOrder?.remaining.length)
      return { actor: game.charityOrder.remaining[0], action: { type: 'ready' } };
  }
  return nextChoamCharityFundingStep(game);
}
export function advanceAdvancedCharityOrder(game: Game, until: (state: Game) => boolean,
  actions: AdvancedCharityOrderStep[] = []): Game {
  for (let count = 0; count < 600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Charity chronology ended before its requested boundary');
    const next = nextAdvancedCharityOrderStep(game); assert.ok(next);
    game = actAdvancedCharityOrder(game, next.actor, next.action, actions);
  }
  throw Error('The original Charity programme did not reach its finite boundary');
}
export function passAdvancedCharityResponses(game: Game, actions: AdvancedCharityOrderStep[] = []): Game {
  for (let count = 0; game.response && count < 40; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvancedCharityOrder(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.equal(game.response ?? null, null); return game;
}
export function allowAdvancedCharityOpening(game: Game, actions: AdvancedCharityOrderStep[] = []): Game {
  assert.equal(game.response?.kind, 'choamCharity');
  game = passAdvancedCharityResponses(game, actions);
  return advanceAdvancedCharityOrder(game, state => state.phase === 2 && advancedCharityOrderClean(state), actions);
}
export function finishAdvancedCharityTurn(game: Game, actions: AdvancedCharityOrderStep[] = []): Game {
  const actor = game.charityOrder?.remaining[0]; assert.ok(actor);
  return actAdvancedCharityOrder(game, actor, { type: 'ready' }, actions);
}
export function finishAdvancedCharityPhase(game: Game, actions: AdvancedCharityOrderStep[] = []): Game {
  return advanceAdvancedCharityOrder(game, state => state.phase !== 2, actions);
}

/** Actual public CHOAM/BG/classic setup. Only original unopened starting-card
 * and land-Spice positions plus scalar lotteries are selected. A real phase1
 * bribe empties Atreides' purse; its recipient retains deferred incoming spice.
 * No purse, phase, order, readiness, claim, force or receipt is installed.
 */
export function createAdvancedCharityOrderFixture(options: { advanced?: boolean; lowBG?: boolean } = {}) {
  const advanced = options.advanced ?? true;
  let game = createGame('ADVANCEDCHARITYORDER', newPlayer('atreides', 'Atreides', 'atreides'), advanced, ['choam']);
  joinGame(game, newPlayer('beneGesserit', 'Bene Gesserit', 'beneGesserit'));
  joinGame(game, newPlayer('choam', 'CHOAM', 'choam'));
  const initial = structuredClone(game), actions: AdvancedCharityOrderStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvancedCharityOrder(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvancedCharityOrder(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => !player.hand.length));
  const karama = game.deck.find(card => card.effect === 'karama');
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 2);
  assert.ok(karama); assert.equal(ordinary.length, 2);
  const prefix = [karama, ...ordinary];
  const dealOrder = prefix.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), setupActions = structuredClone(actions);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), prefix.map(card => card.id));
  const original = advancedCharityOrderInventory(game);
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card); assert.ok(from >= position);
    const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  reach(state => state.phase === 1 && advancedCharityOrderClean(state));
  const beforeBribes = structuredClone(game), bribeFrom = actions.length;
  const low = ['atreides', ...(options.lowBG ? ['beneGesserit'] : [])];
  for (const actor of low) {
    const amount = advancedCharityOrderPlayer(game, actor).spice; assert.ok(amount > 0);
    act(actor, { type: 'bribe', target: 'choam', amount });
    assert.equal(advancedCharityOrderPlayer(game, actor).spice, 0);
  }
  const bribeActions = structuredClone(actions.slice(bribeFrom));
  reach(state => state.phase === 2 && state.response?.kind === 'choamCharity');
  assert.equal(advancedCharityOrderPlayer(game, 'choam').spice, 2);
  assert.equal(advancedCharityOrderPlayer(game, 'atreides').spice, 0);
  assert.ok(advancedCharityOrderPlayer(game, 'choam').bribes > 0);
  assert.deepEqual(advancedCharityOrderInventory(game), original);
  return { initial, lobby, setup, afterSetup, beforeBribes, beforeIncome: structuredClone(game), game,
    advanced, lowBG: options.lowBG ?? false, karama: karama.id, original,
    claimant: 'atreides', bg: 'beneGesserit', provider: 'choam', dealOrder, spiceOrder,
    actions, setupActions, bribeActions,
    sourceCounts: { setup: setupActions.length, bribes: bribeActions.length, source: actions.length },
    sourceDisclosure: 'Original public CHOAM/BeneGesserit/Atreides setup and native first Storm/Spice/closing controls. Advanced uses the explicit original preview start. Only original unopened starting-deal and land-Spice positions plus scalar lotteries selected. Real pre-Charity bribes create actual low claimants and deferred CHOAM incoming receipts; no money, order, phase, readiness or claim marker installed. Source stops at the original first CHOAM opening income response.' };
}

/** Explicit unstamped UNIT supplement; not claimed historical saved-game proof. */
export function unstampedAdvancedCharitySupplement(game: Game): Game {
  const old = advancedCharityOrderReload(game);
  delete old.charityOrder;
  return old;
}
