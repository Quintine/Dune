import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import {
  actFutureShipment, advanceFutureShipment, futureShipmentClean, futureShipmentPlayer,
  nextFutureShipmentStep, type FutureShipmentStep,
} from './fixture-truthtrance-future-shipment';

export type TruthtranceEarlyShipmentStep = FutureShipmentStep;
export const actTruthtranceEarlyShipment = actFutureShipment;
export const advanceTruthtranceEarlyShipment = advanceFutureShipment;
export const nextTruthtranceEarlyShipmentStep = nextFutureShipmentStep;
export const truthtranceEarlyShipmentClean = futureShipmentClean;
export const truthtranceEarlyShipmentPlayer = futureShipmentPlayer;

/** Genuine public Basic classic setup, original five-card deal and original
 * Storm/Spice controls. Stop at clean Charity BEFORE playing Truthtrance or
 * asking the new early question. Only unopened deck positions/scalar lotteries
 * are selected; no dealt card, force, wallet, clock or promise is installed. */
export function createTruthtranceEarlyShipmentFixture() {
  const asker = 'atreides', target = 'emperor', counterHolder = 'harkonnen';
  let game = createGame('TRUTHEARLYSHIPMENT', newPlayer(asker, 'Atreides', 'atreides'), false);
  for (const faction of ['emperor', 'harkonnen', 'guild'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const actions: TruthtranceEarlyShipmentStep[] = [];
  const act = (actor: string, action: Action) => {
    game = actTruthtranceEarlyShipment(game, actor, action, actions);
  };
  const reach = (until: Parameters<typeof advanceTruthtranceEarlyShipment>[1]) => {
    game = advanceTruthtranceEarlyShipment(game, until, actions);
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.deepEqual(game.expansions, []);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalTreachery = game.deck.map(card => card.id).sort();
  assert.equal(new Set(originalTreachery).size, originalTreachery.length);
  const truth = game.deck.find(card => card.effect === 'truthtrance');
  const karama = game.deck.find(card => card.effect === 'karama');
  const filler = [game.deck.find(card => card.name === 'Baliset'),
    game.deck.find(card => card.kind === 'shield'), game.deck.find(card => card.kind === 'snooper')];
  assert.ok(truth && karama && filler.every(Boolean));
  // The Harkonnen receives two original consecutive cards, all other seats one.
  const deal = [truth.id, filler[0]!.id, karama.id, filler[1]!.id, filler[2]!.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.ok(truthtranceEarlyShipmentPlayer(game, asker).hand.some(card => card.id === truth.id));
  assert.ok(truthtranceEarlyShipmentPlayer(game, counterHolder).hand.some(card => card.id === karama.id));
  assert.ok(truthtranceEarlyShipmentPlayer(game, target).hand.some(card => card.id === filler[0]!.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const beforeSpiceOrder = structuredClone(game);
  const from = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(from >= 0);
  const land = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.unshift(land);
  const spiceOrder = [{ position: 0, from, card: structuredClone(land) }];
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 2 && truthtranceEarlyShipmentClean(state));
  assert.equal(game.status, 'playing'); assert.equal(game.advanced, false);
  assert.deepEqual(game.ready, []); assert.equal(game.auction ?? null, null);
  assert.equal(game.truthtrance ?? null, null);
  const respondent = truthtranceEarlyShipmentPlayer(game, target);
  assert.equal(respondent.spice, 10); assert.equal(respondent.reserves, 20);
  assert.equal(respondent.tanks, 0); assert.deepEqual(respondent.forces, {});
  assert.equal(respondent.shipped, false); assert.equal(respondent.moved, 0);
  assert.ok(truthtranceEarlyShipmentPlayer(game, asker).hand.some(card => card.id === truth.id));
  assert.ok(truthtranceEarlyShipmentPlayer(game, counterHolder).hand.some(card => card.id === karama.id));
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
    .map(card => card.id).sort(), originalTreachery);
  const question: TruthQuestion = { kind: 'shipment', target, territory: 'carthag', minimum: 8 };
  const declarationStep: TruthtranceEarlyShipmentStep = { actor: asker,
    action: { type: 'card', card: truth.id } };
  const askStep: TruthtranceEarlyShipmentStep = { actor: asker, action: { type: 'truthAsk', question } };
  return { game, lobby, setup, beforeStartingDeal, afterSetup, beforeSpiceOrder, spiceOrder,
    deal, dealOrder, originalTreachery, originalSpice, asker, target, counterHolder, guild: 'guild',
    card: truth.id, karama: karama.id, question, declarationStep, askStep,
    territory: 'carthag', sector: 11, location: 'carthag:11', minimum: 8,
    advanced: false as const, sourceActionCount: actions.length, actions,
    staging: ['Only five unopened original starting-deal positions, one unopened ordinary land Spice position and original scalar lotteries are selected. Public Basic Atreides/Emperor/Harkonnen/Guild setup actually deals Truthtrance to Atreides, Baliset to Emperor, Karama and Shield to Harkonnen, and Snooper to Guild. Original traitor choices, Storm dials, Spice Blow and readiness reach clean turn-1 Charity before Bidding. Emperor retains its printed 10 spice, 20 reserve forces and unused shipment; the held physical Truthtrance and Karama are unchanged. The constructor stops before the Truthtrance declaration and proposed eight-force Carthag question. No postdeal hand, army, wallet, phase, turn, queue or promise is installed. The Fremen storm-loss source is outside this bounded programme.'] };
}
export type TruthtranceEarlyShipmentFixture = ReturnType<typeof createTruthtranceEarlyShipmentFixture>;
