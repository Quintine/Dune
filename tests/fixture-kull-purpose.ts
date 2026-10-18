import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeKullGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type KullPurposeStep = { actor: string; action: Action };
export const kullPurposePlayer = (game: Game, actor = 'emperor') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const kullPurposeClean = (game: Game) => !game.pendingKull && !game.response &&
  !game.decision && !game.phaseOpening && !game.truthtrance && !game.pendingTreacheryDiscard;
export function actKullPurpose(game: Game, actor: string, action: Action, actions: KullPurposeStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) });
  return next;
}
/** Neutral native choices only. No card is granted and no optional power or
 * sealed plan is selected by this finite continuation driver. */
export function nextKullPurposeStep(game: Game): KullPurposeStep | null {
  if (game.pendingKull?.stage === 'offer') return { actor: game.pendingKull.player,
    action: { type: 'kullDecision', event: game.pendingKull.event, decline: true } };
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'choamMovement')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  if (kullPurposeClean(game) && game.auction?.active === 'choam' && game.auction.bid === 0 &&
    game.auction.cards[game.auction.index].name === 'Baliset')
    return { actor: 'choam', action: { type: 'bid', amount: 1, allyPayment: 0 } };
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceKullPurpose(game: Game, until: (state: Game) => boolean,
  actions: KullPurposeStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Kull purpose programme ended before its next control');
    const step = nextKullPurposeStep(game); assert.ok(step, 'Complete the real private Kull purpose choice before advancing');
    game = actKullPurpose(game, step.actor, step.action, actions);
  }
  throw Error('The original Kull purpose programme did not reach its finite boundary');
}

/** Explicit original Kull preview entry from a ready native lobby. The exact
 * initial deal is controlled while every card remains in the unopened deck:
 * CHOAM gets physical Kull and the two classic seats each get one physical
 * Karama. This is a selected deck order, not a naturally discovered random seed.
 * Baliset is subsequently bought in an actual ordinary auction. */
export function createKullPurposeFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? true;
  let game = createGame('KULLPURPOSE', newPlayer('choam', 'CHOAM', 'choam'), advanced, ['choam', 'ix']);
  for (const faction of ['emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: KullPurposeStep[] = [];
  const act = (actor: string, action: Action) => { game = actKullPurpose(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceKullPurpose(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeKullGameForAudit(game));
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0), 'Select only the unopened original starting deal');
  const front: Game['deck'] = [];
  for (const kind of ['kull', 'karama', 'karama']) {
    const at = game.deck.findIndex(card => kind === 'kull' ? card.id === 'ix-kull-wahad' : card.effect === 'karama');
    assert.ok(at >= 0); front.push(game.deck.splice(at, 1)[0]);
  }
  const unopenedDeal = front.map((card, index) => ({ actor: game.players[index].id, card: card.id }));
  game.deck.unshift(...front);
  const beforeInitialDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), karama = unopenedDeal[1].card, counter = unopenedDeal[2].card;
  assert.ok(kullPurposePlayer(game, 'choam').hand.some(card => card.id === 'ix-kull-wahad'));
  assert.ok(kullPurposePlayer(game).hand.some(card => card.id === karama));
  assert.ok(kullPurposePlayer(game, 'guild').hand.some(card => card.id === counter));
  const land: Game['spiceDeck'] = [];
  for (let count = 0; count < (advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    land.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...land);
  reach(state => state.phase === 2 && kullPurposeClean(state));
  const at = game.deck.findIndex(card => card.name === 'Baliset' && card.kind === 'worthless'); assert.ok(at >= 0);
  const baliset = game.deck[at].id;
  game.deck.unshift(game.deck.splice(at, 1)[0]);
  const beforePurchase = structuredClone(game);
  reach(state => kullPurposePlayer(state, 'choam').hand.some(card => card.id === baliset));
  const acquired = structuredClone(game);
  reach(state => state.phase === 5 && state.active === 'choam' && kullPurposeClean(state));
  const beforeChoamShipment = structuredClone(game), choamShipment: KullPurposeStep = {
    actor: 'choam', action: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 },
  };
  act(choamShipment.actor, choamShipment.action); reach(kullPurposeClean);
  const afterChoamShipment = structuredClone(game);
  act('choam', { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === 'emperor' && kullPurposeClean(state));
  return { game, lobby, setup, beforeInitialDeal, unopenedDeal, afterSetup, beforePurchase, acquired,
    beforeChoamShipment, choamShipment, afterChoamShipment, karama, counter, baliset, kull: 'ix-kull-wahad',
    actor: 'emperor', reactor: 'choam', source: 'imperial_basin:10', destination: 'arrakeen:10',
    entry: 'initializeKullGameForAudit' as const, sourceActionCount: actions.length, actions,
    staging: ['Exact original unopened starting deal and unopened Baliset/Spice positions are selected, with scalar lottery order. Every subsequent card, wallet and force comes from native setup, actual paid auction and actual paid shipment; no playing-state inventory or clock is installed.'] };
}
export type KullPurposeFixture = ReturnType<typeof createKullPurposeFixture>;
export const kullPurposeShipmentAction = (fixture: KullPurposeFixture): Action => ({
  type: 'card', mode: 'shipment', card: fixture.karama, target: fixture.actor,
});

/** Success prevents the original price attempt before cost. A normal funded
 * shipment and real ground move then produce CHOAM's native Baliset response. */
export function reachKullPurposeBaliset(fixture: KullPurposeFixture) {
  let game = structuredClone(fixture.game);
  const actions: KullPurposeStep[] = [];
  const act = (actor: string, action: Action) => { game = actKullPurpose(game, actor, action, actions); };
  act(fixture.actor, kullPurposeShipmentAction(fixture));
  const offered = structuredClone(game), reaction = viewGame(game, fixture.reactor).kullReaction;
  assert.ok(reaction && reaction.plays.some(play => play.source === 'printed' && play.card.id === fixture.kull && !play.blocked));
  act(fixture.reactor, { type: 'kullDecision', event: reaction.event, source: 'printed', card: fixture.kull });
  const declared = structuredClone(game);
  game = advanceKullPurpose(game, kullPurposeClean, actions);
  const restricted = structuredClone(game), shipmentStep: KullPurposeStep = { actor: fixture.actor, action: {
    type: 'ship', territory: 'imperial_basin', sector: 10, amount: 1, elite: game.advanced ? 1 : 0, allyPayment: 0,
  } };
  act(shipmentStep.actor, shipmentStep.action);
  game = advanceKullPurpose(game, kullPurposeClean, actions);
  const shipped = structuredClone(game), moveStep: KullPurposeStep = { actor: fixture.actor, action: {
    type: 'move', from: fixture.source, territory: 'arrakeen', sector: 10, amount: 1, elite: game.advanced ? 1 : 0,
  } };
  act(moveStep.actor, moveStep.action);
  const beforeBaliset = structuredClone(game);
  assert.equal(game.decision?.kind, 'choamMovement');
  act(fixture.reactor, { type: 'card', mode: 'choam', card: fixture.baliset, target: fixture.actor, territory: 'arrakeen' });
  const baliset = structuredClone(game);
  assert.equal(game.response?.kind, 'choamWorthless');
  assert.equal(game.response.intent, 'Baliset');
  return { game, offered, declared, restricted, shipped, shipmentStep, beforeBaliset, moveStep, baliset, actions };
}

/** The retained original Karama may cancel a different purpose in Advanced.
 * Its second neutral Kull offer is actually declined after the cost was spent;
 * the native Baliset cancellation resumes exactly the declared typed move. */
export function completeKullPurpose(fixture: KullPurposeFixture) {
  assert.equal(fixture.game.advanced, true, 'Basic retains its original whole-phase restriction');
  const programme = reachKullPurposeBaliset(fixture), actions = [...programme.actions];
  let game = actKullPurpose(programme.game, fixture.actor,
    { type: 'card', mode: 'cancel', card: fixture.karama }, actions);
  const differentOffer = structuredClone(game), reaction = viewGame(game, fixture.reactor).kullReaction;
  assert.ok(reaction && reaction.plays.every(play => play.card.id !== fixture.kull));
  game = actKullPurpose(game, fixture.reactor, { type: 'kullDecision', event: reaction.event, decline: true }, actions);
  game = advanceKullPurpose(game, kullPurposeClean, actions);
  const completed = structuredClone(game);
  game = actKullPurpose(game, fixture.actor, { type: 'endMovement' }, actions);
  return { ...programme, game, completed, differentOffer, actions };
}
