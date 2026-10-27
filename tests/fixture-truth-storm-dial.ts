import assert from 'node:assert/strict';
import { type Action, type Game } from '../game/engine';
import { actTruthMovement, createTruthMovementFixture, truthMovementInventory } from './fixture-truth-movement';

export const actTruthStormDial = actTruthMovement;

/** Genuine Basic setup and starting deal from the existing movement fixture.
 * Only unopened original cards were reordered for the original deal. This
 * source uses its actual post-setup, pre-first-dial state; no wallet, force,
 * response, dial, or card was installed or duplicated. */
export function createTruthStormDialFixture(value = 7) {
  const base = createTruthMovementFixture();
  const game = structuredClone(base.afterSetup);
  const { asker, target, truth } = base;
  assert.equal(game.status, 'playing'); assert.equal(game.phase, 0); assert.equal(game.turn, 1);
  assert.equal(game.advanced, false); assert.equal(game.stormPending, null);
  assert.deepEqual(new Set(game.stormDialers), new Set([asker, target]));
  assert.deepEqual(game.stormDials, {});
  assert.ok(game.players.find(player => player.id === asker)?.hand.some(card => card.id === truth));
  assert.deepEqual(truthMovementInventory(game), base.originalCards);
  const source = JSON.stringify(['stormDial', game.turn, target]);
  const mixed = { kind: 'action' as const, action: { kind: 'stormDial' as const, source, value } };
  return { base, game, asker, target, truth, source, value, mixed };
}
export type TruthStormDialFixture = ReturnType<typeof createTruthStormDialFixture>;

export function declareStormDialQuestion(f: TruthStormDialFixture, source: Game = f.game) {
  let game = actTruthStormDial(source, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const player = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id));
    assert.ok(player); game = actTruthStormDial(game, player.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return game;
}
export function askStormDial(game: Game, f: TruthStormDialFixture, mixed: unknown = f.mixed, target = f.target) {
  return actTruthStormDial(game, f.asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } } as Action);
}
export function bindStormDial(f: TruthStormDialFixture, answer: 'yes' | 'no', source: Game = f.game) {
  const declared = declareStormDialQuestion(f, source), asked = askStormDial(declared, f);
  const game = actTruthStormDial(asked, f.target, { type: 'truthAnswer', answer });
  return { declared, asked, game };
}

/** Controlled supplement: move the second original physical Truthtrance from
 * the unopened deck into the asker's existing hand. This preserves every card
 * identity and the native hand limit; it is not represented as an in-game sale
 * or transfer. Native queue, questions, answers and the dial are real actions. */
export function declareTwoStormDialQuestions(f: TruthStormDialFixture, source: Game = f.game) {
  let game = structuredClone(source);
  const owner = game.players.find(player => player.id === f.asker); assert.ok(owner);
  const index = game.deck.findIndex(card => card.effect === 'truthtrance' && card.id !== f.truth);
  assert.ok(index >= 0, 'The second physical Truthtrance must remain in the unopened deck');
  assert.ok(owner.hand.length < 4, 'The controlled extra card must fit the normal hand limit');
  const second = game.deck.splice(index, 1)[0]; owner.hand.push(second);
  assert.deepEqual(truthMovementInventory(game), f.base.originalCards);
  game = actTruthStormDial(game, f.asker, { type: 'card', card: f.truth, cards: [second.id] });
  while (game.truthtrance?.stage === 'priority') {
    const player = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id));
    assert.ok(player); game = actTruthStormDial(game, player.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, second: second.id };
}

/** Controlled physical location swap for this one card interaction: exchange
 * the target's original dealt card with the original unopened Weather card.
 * For the foreign-owner branch, move that same acquired Weather to the asker.
 * Neither setup adjustment is presented as an in-game transaction; every
 * original card remains in exactly one location and both hands stay legal. */
export function sourceWithStormWeather(f: TruthStormDialFixture, holder: 'target' | 'asker') {
  const game = structuredClone(f.game);
  const target = game.players.find(player => player.id === f.target); assert.ok(target?.hand.length);
  const asker = game.players.find(player => player.id === f.asker); assert.ok(asker);
  const index = game.deck.findIndex(card => card.effect === 'weather'); assert.ok(index >= 0);
  const weather = game.deck[index];
  [target.hand[0], game.deck[index]] = [weather, target.hand[0]];
  if (holder === 'asker') {
    assert.ok(asker.hand.length < 4);
    asker.hand.push(target.hand.splice(0, 1)[0]);
  }
  assert.deepEqual(truthMovementInventory(game), f.base.originalCards);
  return { game, weather: weather.id, player: holder === 'target' ? f.target : f.asker };
}
