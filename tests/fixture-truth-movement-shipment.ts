import assert from 'node:assert/strict';
import { TERRITORIES, gameDistance, splitLocation } from '../game/board';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import {
  actTruthMovement, createTruthMovementFixture, truthMovementClean,
  truthMovementInventory, truthMovementPlayer, type TruthMovementStep,
} from './fixture-truth-movement';
import { createTruthMovementChoamFixture } from './fixture-truth-movement-choam';
import { createHajrReplayFixture } from './fixture-hajr-replay';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export const actTruthMovementShipment = actTruthMovement;
export const truthMovementShipmentClean = truthMovementClean;
export const truthMovementShipmentInventory = truthMovementInventory;
export const truthMovementShipmentPlayer = truthMovementPlayer;

/** A source fixture may continue past this snapshot for its own purpose. Keep
 * only its actual prefix before the named shipment, never count later actions
 * as part of this unopened shipment opportunity. */
function beforeShipmentActions(actions: TruthMovementStep[], step: TruthMovementStep) {
  const index = actions.findIndex(candidate => candidate.actor === step.actor &&
    JSON.stringify(candidate.action) === JSON.stringify(step.action));
  assert.ok(index >= 0, 'The source must contain its actual named shipment');
  return structuredClone(actions.slice(0, index));
}
function unopened(game: Game, target: string) {
  const player = truthMovementPlayer(game, target);
  assert.equal(game.status, 'playing'); assert.equal(game.advanced, false);
  assert.equal(game.phase, 5); assert.equal(game.active, target);
  assert.ok(truthMovementClean(game)); assert.equal(player.shipped, false);
  assert.equal(player.moved, 0); assert.equal(game.movementPromises, undefined);
}
function balances(game: Game) {
  return Object.fromEntries(game.players.map(player => [player.id, player.spice]));
}

/** Original public Basic Atreides/Emperor source before its first shipment.
 * Ten board forces cannot satisfy the eleven-force statement without a real
 * reserve arrival. No Truthtrance or suggested shipment/movement is played. */
export function createTruthMovementShipmentFixture(options: { hajr?: boolean } = {}) {
  const source = createTruthMovementFixture(options), game = structuredClone(source.beforeShipment);
  unopened(game, source.target);
  const player = truthMovementPlayer(game, source.target);
  assert.deepEqual(player.forces, { 'arrakeen:10': 10 }); assert.equal(player.reserves, 10);
  assert.ok(player.spice >= 1);
  const actions = beforeShipmentActions(source.actions, source.shipmentStep);
  assert.deepEqual(truthMovementInventory(game), source.originalCards);
  return {
    game, source, actions, sourceActionCount: actions.length,
    target: source.target, asker: source.asker, truth: source.truth, hajr: source.hajr,
    claim: { kind: 'movement' as const, target: source.target, territory: 'carthag', minimum: 11 },
    shipment: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    move: { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 11 } satisfies Action,
    shipmentCost: 1, originalCards: source.originalCards, balances: balances(game),
    staging: [
      'The original public Basic Atreides/Emperor starting-deal, ordinary Spice and native scalar selections are reused at their actual beforeShipment snapshot. The recorded action prefix ends before the original helper later ships to Polar Sink. Ten original Arrakeen forces and ten reserves remain untouched. The suggested one-spice Arrakeen shipment would create an eleven-force group for a later Carthag movement; neither action nor any question, answer or promise has been installed.',
    ],
  };
}

/** Genuine native CHOAM source before its paid city shipment and held Kulon.
 * The later source's actual shipment/Kulon actions are excluded from this prefix. */
export function createTruthMovementShipmentChoamFixture() {
  const source = createTruthMovementChoamFixture(), game = structuredClone(source.beforeShipment);
  unopened(game, source.target);
  const player = truthMovementPlayer(game, source.target);
  assert.equal(Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 0);
  assert.ok(player.hand.some(card => card.id === source.kulon)); assert.equal(game.choamMovement, undefined);
  const shipment: Action = { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 };
  const actions = beforeShipmentActions(source.actions, { actor: source.target, action: shipment });
  const destination = TERRITORIES.flatMap(t => t.sectors.map(sector => ({ territory: t.id, sector }))).find(to =>
    gameDistance(game, 'arrakeen:10', `${to.territory}:${to.sector}`, key => {
      const place = splitLocation(key); return place.sector !== 0 && place.sector === game.storm;
    }) === 4);
  assert.ok(destination);
  assert.deepEqual(truthMovementInventory(game), source.originalCards);
  return {
    game, source, actions, sourceActionCount: actions.length,
    target: source.target, asker: source.asker, truth: source.truth, kulon: source.kulon,
    claim: { kind: 'movement' as const, target: source.target, territory: destination.territory, minimum: 1 },
    shipment, shipmentCost: 1, destination, originalCards: source.originalCards, balances: balances(game),
    staging: [
      'Original native public Basic CHOAM/Emperor setup, unopened Kulon/Truthtrance deal, ordinary Spice positions and native scalar lotteries only. The actual beforeShipment snapshot has zero CHOAM board forces and its original held Kulon. The source action prefix excludes its later one-spice Arrakeen shipment and allowed Kulon. No hand, wallet, force, bonus, phase clock, question or receipt is installed. The suggested city shipment, native Kulon and four-step route remain real actions for the caller.',
    ],
  };
}

/** The original native paid cache/normal purchases leave Emperor entirely in
 * reserves with the real Box/Hajr, while Guild holds its original dealt Truth. */
export function createTruthMovementShipmentEmperorFixture() {
  const source = createHajrReplayFixture({ truthForGuild: true }), game = structuredClone(source.beforeShipment);
  const target = source.owner, asker = 'guild'; unopened(game, target);
  const truth = source.guildTruth; assert.ok(truth);
  const player = truthMovementPlayer(game, target);
  assert.equal(Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 0);
  assert.equal(player.reserves, 20);
  assert.ok(player.hand.some(card => card.id === source.box)); assert.ok(player.hand.some(card => card.id === source.hajr));
  const actions = beforeShipmentActions(source.actions, source.shipmentStep);
  const originalCards = truthMovementInventory(source.setup);
  assert.deepEqual(truthMovementInventory(game), originalCards);
  return {
    game, source, actions, sourceActionCount: actions.length, target, asker, truth,
    hajr: source.hajr, box: source.box,
    claim: { kind: 'movement' as const, target, territory: 'carthag', minimum: 1 },
    shipment: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    move: { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 1 } satisfies Action,
    shipmentCost: 1, originalCards, balances: balances(game),
    staging: [
      'Original public Basic Richese/Emperor/Guild setup, unopened original Guild Truthtrance deal, native Box1 and Hajr1 purchases, ordinary Spice positions and scalar lotteries only. The actual beforeShipment snapshot and action prefix stop before the helper later ships three Emperor forces to desert. Emperor retains all twenty original reserves, no board forces, the real bought Box/Hajr and its untouched remaining wallet. The proposed one-spice city shipment and subsequent movement are unplayed; no source hand, resource, force, phase or receipt is installed.',
    ],
  };
}

/** Public native Basic Guild/Emperor setup. Guild's printed five Tuek's forces
 * are retained; this source is not a zero-board replacement of native setup. */
export function createTruthMovementShipmentGuildFixture() {
  const target = 'guild', asker = 'emperor';
  let game = createGame('TRUTHMOVEMENTSHIPMENTGUILD', newPlayer(target, 'Spacing Guild', 'guild'), false);
  joinGame(game, newPlayer(asker, 'Emperor', 'emperor'));
  const actions: TruthMovementStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthMovement(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => {
    for (let count = 0; !until(game) && count < 600; count++) {
      const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
      act(next.actor, next.action);
    }
    assert.ok(until(game), 'The native Guild source must reach its original clean turn');
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start' });
  const setup = structuredClone(game), originalCards = truthMovementInventory(game);
  assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => player.hand.length === 0));
  const ordinary = game.deck.find(card => card.kind === 'projectile'), truth = game.deck.find(card => card.effect === 'truthtrance');
  assert.ok(ordinary && truth);
  const dealOrder = [ordinary.id, truth.id].map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game); reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthMovementPlayer(game, target).hand.map(card => card.id), [ordinary.id]);
  assert.deepEqual(truthMovementPlayer(game, asker).hand.map(card => card.id), [truth.id]);
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === target && truthMovementClean(state));
  unopened(game, target);
  const player = truthMovementPlayer(game, target);
  assert.deepEqual(player.forces, { 'tueks_sietch:5': 5 }); assert.equal(player.reserves, 15); assert.equal(player.spice, 5);
  assert.deepEqual(truthMovementInventory(game), originalCards);
  return {
    game, lobby, setup, beforeStartingDeal, afterSetup, dealOrder, spiceOrder,
    actions, sourceActionCount: actions.length, target, asker, truth: truth.id, ordinary: ordinary.id,
    originalCards, balances: balances(game),
    claim: { kind: 'movement' as const, target, territory: 'carthag', minimum: 1 },
    shipment: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    shipmentCost: 1,
    discountedShipment: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2, elite: 0, allyPayment: 0 } satisfies Action,
    discountedShipmentCost: 1, discountedShipmentFullCost: 2,
    move: { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 1 } satisfies Action,
    crossShipment: { type: 'guildShip', from: 'tueks_sietch:5', territory: 'arrakeen', sector: 10, amount: 2, elite: 0, allyPayment: 0 } satisfies Action,
    returnShipment: { type: 'guildShip', from: 'tueks_sietch:5', territory: 'reserves', amount: 2, elite: 0, allyPayment: 0 } satisfies Action,
    staging: [
      'Fresh public Basic Guild/Emperor create, join, ready and start retain the original33-card inventory. Only the unopened Guild projectile/Emperor Truthtrance deal, two ordinary unopened Spice positions and native scalar lotteries are selected. Actual setup and phases stop at the clean active Guild turn before any shipment, ground movement, question or answer. Guild retains its original five Tuek\'s Sietch forces, fifteen reserves and five spice; no board evacuation or installed hand, wallet, faction, clock or receipt occurs. The suggested city1 costs1 at both rounded rates and creates no discount; city2 costs1 at Guild rate versus2 at full price and can exercise the actual rate response. Native cross/return suggestions use the same original Tuek\'s group. No counter card is injected; an extra counter edge must disclose its own actual or conserved acquisition.',
    ],
  };
}
