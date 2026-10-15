import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import type { Card } from '../game/cards';
import type { NoFieldValue } from '../game/richese-no-field';
import type { TruthFact } from '../game/truthtrance';
import {
  createHarassNoFieldFixture, type HarassNoFieldFixture,
} from './fixture-harass-no-field';
import {
  createNoFieldFullPlanFixture, type NoFieldFullPlanFixture,
} from './fixture-no-field-full-plan';

export type TruthtranceNoFieldOptions = {
  advanced?: boolean;
  marker?: NoFieldValue;
  reserves?: number;
  boundary?: 'beforeShipment' | 'afterShipment' | 'battle' | 'fullPlanOffer';
};
export type TruthtranceNoFieldFixture = {
  game: Game;
  owner: string;
  asker: string;
  opponent: string;
  observer: string;
  token: { id: string; value: NoFieldValue };
  truthCard: Card;
  staging: string[];
  harass: HarassNoFieldFixture | null;
  fullPlan: NoFieldFullPlanFixture | null;
};
export function truthtranceNoFieldPlayer(game: Game, actor: string) {
  const player = game.players.find(candidate => candidate.id === actor);
  assert.ok(player, `Missing original No-Field seat ${actor}`);
  return player;
}

/** Physical inventory at these settled native boundaries; no catalog is redealt. */
export function truthtranceNoFieldCards(game: Game) {
  return [
    ...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(player => player.hand),
  ].map(card => card.id).sort();
}

/** Conserved hand staging after genuine setup, never a replacement or invented card. */
export function stageNoFieldTruthtrance(game: Game, actor: string, staging: string[]): Card {
  const inventory = truthtranceNoFieldCards(game);
  const player = truthtranceNoFieldPlayer(game, actor);
  const held = player.hand.find(card => card.effect === 'truthtrance');
  if (held) return structuredClone(held);
  const source = [game.deck, ...game.players.filter(candidate => candidate.id !== actor).map(candidate => candidate.hand)]
    .find(cards => cards.some(card => card.effect === 'truthtrance'));
  assert.ok(source, 'Relocate an originally selected, unused physical Truthtrance');
  if (player.hand.length === 4) {
    const returned = player.hand.pop()!;
    game.deck.push(returned);
    staging.push(`After genuine setup: conserve ${returned.id} by returning it from ${actor}'s full hand to the original deck.`);
  }
  assert.ok(player.hand.length < 4);
  const card = source.splice(source.findIndex(candidate => candidate.effect === 'truthtrance'), 1)[0];
  player.hand.push(card);
  staging.push(`After genuine setup: conserve original physical Truthtrance ${card.id} by relocating it into ${actor}'s hand; no hand exceeds four.`);
  assert.deepEqual(truthtranceNoFieldCards(game), inventory);
  return structuredClone(card);
}

/** All windows and marker custody come from the original setup/shipment/battle actions. */
export function createTruthtranceNoFieldFixture(options: TruthtranceNoFieldOptions = {}): TruthtranceNoFieldFixture {
  const boundary = options.boundary ?? 'afterShipment';
  const harass = boundary === 'fullPlanOffer' ? null : createHarassNoFieldFixture({
    advanced: options.advanced ?? false, marker: options.marker, reserves: options.reserves,
  });
  if (boundary === 'fullPlanOffer') assert.notEqual(options.advanced, false, 'The native full-plan offer is Advanced');
  const fullPlan = boundary === 'fullPlanOffer' ? createNoFieldFullPlanFixture({
    marker: options.marker, reserves: options.reserves,
  }) : null;
  const native = harass ?? fullPlan!;
  const source = boundary === 'beforeShipment' ? native.beforeShipment
    : boundary === 'afterShipment' ? native.afterShipment : native.game;
  const game = structuredClone(source);
  const asker = fullPlan ? fullPlan.atreides : harass!.observer;
  const staging = [...native.staging];
  const truthCard = stageNoFieldTruthtrance(game, asker, staging);
  const inventory = truthtranceNoFieldCards(game);
  assert.equal(new Set(inventory).size, inventory.length);
  assert.deepEqual(inventory, truthtranceNoFieldCards(native.afterSetup));
  for (const player of game.players) {
    assert.ok(player.hand.length <= 4);
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, count) => sum + count, 0), 20);
  }
  return {
    game, owner: native.owner, asker, opponent: native.opponent, observer: native.observer,
    token: structuredClone(native.token), truthCard, staging, harass, fullPlan,
  };
}

export function noFieldTruthFact(value: NoFieldValue): TruthFact {
  return { kind: 'noFieldValue', value };
}
export function declareNoFieldTruthtrance(game: Game, asker: string): Game {
  const card = truthtranceNoFieldPlayer(game, asker).hand.find(candidate => candidate.effect === 'truthtrance');
  assert.ok(card);
  return applyAction(game, asker, { type: 'card', card: card.id });
}
export function passNoFieldTruthPriority(game: Game): Game {
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id));
    assert.ok(actor);
    game = applyAction(game, actor.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return game;
}
export function askNoFieldTruth(game: Game, asker: string, target: string, fact: TruthFact): Game {
  if (!game.truthtrance) game = passNoFieldTruthPriority(declareNoFieldTruthtrance(game, asker));
  assert.equal(game.truthtrance?.stage, 'ask');
  return applyAction(game, asker, { type: 'truthAsk', question: { kind: 'fact', target, fact } });
}
export function answerNoFieldTruth(game: Game, expected: 'yes' | 'no'): Game {
  const question = game.truthtrance?.question;
  assert.equal(game.truthtrance?.stage, 'answer');
  assert.ok(question?.kind === 'fact');
  assert.equal(viewGame(game, question.target).truthAnswer, expected);
  return applyAction(game, question.target, { type: 'truthAnswer', answer: expected });
}
export function rejectNoFieldTruthAction(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Everything observed must stay put, including live opportunities and prior shipment history. */
export function noFieldTruthObservation(game: Game) {
  return structuredClone({
    turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
    movementRemaining: game.movementRemaining, response: game.response, decision: game.decision,
    phaseOpening: game.phaseOpening, pendingShipment: game.pendingShipment, battle: game.battle,
    shipmentPromises: game.shipmentPromises, richeseAllyOpportunity: game.richeseAllyOpportunity,
    richeseAllyOffer: game.richeseAllyOffer,
    players: game.players.map(player => ({
      id: player.id, noField: player.noField, noFieldEvent: player.noFieldEvent,
      reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
      spice: player.spice, shipped: player.shipped, moved: player.moved, revived: player.revived,
    })),
  });
}

/** Finish the real public answer and its original physical discard, without driving the parent. */
export function finishNoFieldTruth(game: Game, expected: 'yes' | 'no'): Game {
  const before = structuredClone(game);
  const window = before.truthtrance!;
  assert.equal(window.queue.length, 1);
  assert.ok(window.question?.kind === 'fact');
  const consumed = window.queue[0];
  const card = truthtranceNoFieldPlayer(before, consumed.player).hand.find(candidate => candidate.id === consumed.card);
  assert.ok(card?.effect === 'truthtrance');
  const done = answerNoFieldTruth(game, expected);
  assert.equal(done.truthtrance, null);
  assert.ok(!done.pendingTreacheryDiscard);
  assert.deepEqual(noFieldTruthObservation(done), noFieldTruthObservation(before));
  assert.deepEqual(done.truthHistory, [...(before.truthHistory ?? []), {
    turn: before.turn, phase: before.phase, asker: consumed.player,
    question: window.question, answer: expected,
  }]);
  assert.deepEqual(done.deck, before.deck);
  assert.deepEqual(done.richeseCache, before.richeseCache);
  assert.deepEqual(done.richeseRemoved, before.richeseRemoved);
  assert.deepEqual(done.discard, [...before.discard, card]);
  for (const player of done.players) {
    const original = truthtranceNoFieldPlayer(before, player.id);
    assert.deepEqual(player.hand, original.hand.filter(candidate => candidate.id !== consumed.card));
  }
  assert.deepEqual(truthtranceNoFieldCards(done), truthtranceNoFieldCards(before));
  return done;
}
