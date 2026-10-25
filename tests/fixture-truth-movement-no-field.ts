import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import type { NoFieldValue } from '../game/richese-no-field';
import {
  actTruthMovement, truthMovementClean, truthMovementInventory, truthMovementPlayer,
  type TruthMovementStep,
} from './fixture-truth-movement';
import { nextTruthMovementNativeEarlyStep } from './fixture-truth-movement-native-early';

export type TruthMovementNoFieldStep = TruthMovementStep;
export type TruthMovementNoFieldTransition = { before: Game; steps: TruthMovementStep[]; after: Game };
export const actTruthMovementNoField = actTruthMovement;
export const truthMovementNoFieldClean = truthMovementClean;
export const truthMovementNoFieldInventory = truthMovementInventory;
export const truthMovementNoFieldPlayer = (game: Game, actor = 'richese') => truthMovementPlayer(game, actor);
export { actTruthMovement, truthMovementClean, truthMovementInventory, truthMovementPlayer };

/** Real cache terms/pass/unbid controls only. The owned concealed revelation,
 * Truthtrance and shipped target's actual ground moves remain caller choices. */
export function nextTruthMovementNoFieldNativeStep(game: Game): TruthMovementStep | null {
  if (game.truthtrance) return null;
  if (game.phase === 5 && game.active === 'richese' && truthMovementPlayer(game, 'richese').shipped && truthMovementClean(game)) return null;
  return nextTruthMovementNativeEarlyStep(game, {
    position: 'first', method: 'onceAround', direction: 'clockwise', keepUnbid: false,
    card: 'richese-stone-burner',
  });
}
export function advanceTruthMovementNoField(game: Game, until: (state: Game) => boolean,
  actions: TruthMovementStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original No-Field movement source ended before its requested control');
    const next = nextTruthMovementNoFieldNativeStep(game);
    assert.ok(next, `Supply the original Truthtrance, reveal or movement choice at ${game.turn}/${game.phase}/${game.truthtrance?.stage ?? game.decision?.kind}`);
    game = actTruthMovement(game, next.actor, next.action, actions);
  }
  throw Error('The native No-Field movement source did not reach its finite boundary');
}

/** Public native Basic/Advanced Richese+Emperor, original E2 main35/cache10.
 * An original private marker really ships to Basin9 for one-marker price2.
 * Stop with the token concealed and no physical board forces materialized. */
export function createTruthMovementNoFieldFixture(options: { advanced?: boolean; value?: NoFieldValue } = {}) {
  const advanced = options.advanced ?? false, value = options.value ?? 5;
  const target = 'richese', asker = 'emperor', territory = 'imperial_basin', sector = 9, location = 'imperial_basin:9';
  let game = createGame('TRUTHMOVEMENTNOFIELD', newPlayer(target, 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer(asker, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthMovementStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthMovement(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthMovementNoField(game, until, actions); };
  const transition = (run: () => void): TruthMovementNoFieldTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['choam']);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalMainDeck = game.deck.map(card => card.id), originalCache = game.richeseCache!.map(card => card.id);
  assert.equal(originalMainDeck.length, 35); assert.equal(originalCache.length, 10);
  const originalCards = truthMovementInventory(game); assert.equal(originalCards.length, 45);
  const ordinary = game.deck.find(card => card.kind === 'projectile');
  const truthtrance = game.deck.find(card => card.effect === 'truthtrance'); assert.ok(ordinary && truthtrance);
  const deal = [ordinary.id, truthtrance.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), originalNoField = structuredClone(truthMovementPlayer(game, target).noField);
  assert.ok(originalNoField); assert.deepEqual(originalNoField.tokens.map(token => token.value).sort((a, b) => a - b), [0, 3, 5]);
  assert.equal(originalNoField.deployed, null); assert.equal(originalNoField.lastShipped, null);
  assert.deepEqual(truthMovementPlayer(game, target).hand.map(card => card.id), [ordinary.id]);
  assert.deepEqual(truthMovementPlayer(game, asker).hand.map(card => card.id), [truthtrance.id]);
  assert.deepEqual(truthMovementPlayer(game, target).forces, {}); assert.equal(truthMovementPlayer(game, target).reserves, 20);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  // Basic has no Black Market; both modes still enter their actual bidding
  // phase and then use the native cache/auction controls below.
  reach(state => state.turn === 1 && state.phase === 3);
  const bidding = transition(() => {
    reach(state => state.turn === 1 && state.phase === 5 && state.active === target && truthMovementClean(state));
  });
  const beforeShipment = structuredClone(game), before = truthMovementPlayer(game, target);
  const token = before.noField!.tokens.find(token => token.value === value); assert.ok(token);
  assert.equal(before.shipped, false); assert.equal(before.moved, 0);
  assert.deepEqual(before.hand.map(card => card.id), [ordinary.id]);
  const shipmentEvent = before.noFieldEvent; assert.ok(shipmentEvent);
  const shipmentStep: TruthMovementStep = { actor: target, action: {
    type: 'ship', noField: token.id, event: shipmentEvent, territory, sector, allyPayment: 0,
  } };
  const shipment = transition(() => { act(shipmentStep.actor, shipmentStep.action); reach(truthMovementClean); });
  const player = truthMovementPlayer(game, target), noFieldEvent = player.noFieldEvent; assert.ok(noFieldEvent);
  assert.equal(game.phase, 5); assert.equal(game.turn, 1); assert.equal(game.active, target);
  assert.equal(player.shipped, true); assert.equal(player.moved, 0);
  assert.deepEqual(player.forces, {}); assert.equal(player.reserves, 20); assert.equal(player.tanks, 0);
  assert.equal(before.spice - player.spice, 2);
  assert.equal(player.noField!.deployed!.tokenId, token.id); assert.equal(player.noField!.deployed!.controller, target);
  assert.deepEqual(player.noField!.deployed!.location, { territory, sector });
  assert.equal(player.noField!.lastShipped, token.id);
  assert.deepEqual(player.hand.map(card => card.id), [ordinary.id]);
  assert.ok(truthMovementPlayer(game, asker).hand.some(card => card.id === truthtrance.id));
  assert.deepEqual(truthMovementInventory(game), originalCards);
  const revealAction: Action = { type: 'revealNoField', event: noFieldEvent, token: token.id };
  const markerMove: Action = { type: 'move', forces: {}, noField: token.id, event: noFieldEvent,
    territory: 'arrakeen', sector: 10 };
  const matchingMove: Action | null = value ? { type: 'move', from: location, amount: value,
    territory: 'arrakeen', sector: 10 } : null;
  const claim = { kind: 'movement' as const, target, territory: 'arrakeen', minimum: Math.max(1, value) };
  const truthStep: TruthMovementStep = { actor: asker, action: { type: 'card', card: truthtrance.id } };
  const askStep: TruthMovementStep = { actor: asker, action: { type: 'truthAsk', question: claim } };
  return { game, source: structuredClone(game), initial, lobby, setup, beforeStartingDeal, afterSetup,
    bidding, beforeShipment, shipment: { ...shipment, step: shipmentStep }, shipmentStep, shipmentAction: shipmentStep.action,
    advanced, target, richese: target, asker, emperor: asker, targetCard: ordinary.id, hajr: null,
    truth: truthtrance.id, truthtrance: truthtrance.id, card: truthtrance.id,
    territory, sector, location, value, markerValue: value, token: token.id, tokenId: token.id,
    event: noFieldEvent, noFieldEvent, shipmentEvent, noField: structuredClone(player.noField),
    originalNoField, noFieldState: structuredClone(player.noField),
    revealAction, reveal: revealAction, revealStep: { actor: target, action: revealAction } satisfies TruthMovementStep,
    markerMove, matchingMove, claim, question: claim, truthStep, declarationStep: truthStep, askStep,
    deal, dealOrder, spiceOrder, originalCards, originalInventory: originalCards, originalMainDeck, originalCache, originalSpice,
    actions, steps: actions, sourceActionCount: actions.length, shipmentCost: 2,
    balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    staging: [
      `Actual public ${advanced ? 'Advanced preview' : 'Basic'} Richese/Emperor ready/start, selected native E2 main35 plus original cache10 and no optional module. Only original scalar shuffles, two unopened starting-deal positions and two original ordinary Spice positions are chosen.`,
      'Richese is actually dealt an ordinary projectile rather than Hajr; Emperor is actually dealt its original Truthtrance. Native private Traitor/setup controls create all three original No-Field identities, values and untouched twenty-force reserve pool; no card, token or hand is installed.',
      `Actually complete safe first Storm, native Spice (both blows in Advanced), Charity, ${advanced ? 'real Richese Black Market decline' : 'Basic bidding without a Black Market'}, first Once Around/cache terms, all original ordinary/cache bid passes, unbid cache retirement and Revival. Every original main/cache ID remains in its actual deck/cache/retired/hand/discard slot; there is no manufactured purchase or card acquisition.`,
      'During its real unused first turn Richese actually ships the selected original concealed marker to Basin9 for the ordinary one-marker two-spice price. All twenty original physical reserves remain; the marker has not become physical ground forces, and ordinary movement remains unused.',
      'Stop before any Truthtrance declaration or voluntary reveal. The returned revealNoField event/token, marker-only move and post-reveal physical move are original caller choices. Zero/three/five variants use the same native setup and actual shipment; no later reserve cap, force, phase, wallet, promise, preparation or receipt is installed.',
    ] };
}
export type TruthMovementNoFieldFixture = ReturnType<typeof createTruthMovementNoFieldFixture>;
