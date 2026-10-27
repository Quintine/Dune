import assert from 'node:assert/strict';
import { type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact } from '../game/truthtrance';
import {
  actTruthTurnPower, createTruthTurnPowerFixture, truthTurnPowerInventory,
  truthTurnPowerPlayer, type TruthTurnPowerStep,
} from './fixture-truth-turn-power';

export type ResponseCancelLeaf = { kind: 'windowCardPlay'; effect: 'karamaBattleCancel'; source: string };
export type ResponseCancelExpression = MixedActionExpression<ResponseCancelLeaf>;
export const actResponseCancel = actTruthTurnPower;
export const responseCancelFact = (fact: TruthFact): ResponseCancelExpression => ({ kind: 'fact', fact });
export const responseCancelPlay = (source: string): ResponseCancelExpression => ({
  kind: 'action', action: { kind: 'windowCardPlay', effect: 'karamaBattleCancel', source },
});

/** Genuine Basic setup, shipment, battle and native power declarations are
 * inherited from the existing fixture. Two explicit controlled physical-card
 * swaps place the purchased Karama with the respondent and the other original
 * Karama with the asker. All cards remain present once; this does not claim
 * either controlled swap was a native sale or legal in-game transfer. */
export function createResponseCancelFixture(power: 'voice' | 'prescience') {
  const base = createTruthTurnPowerFixture({ power });
  let game = structuredClone(base.game);
  const owner = base.target, asker = base.asker;
  const target = power === 'voice' ? base.atreides : base.bg;
  assert.notEqual(owner, target); assert.notEqual(asker, target);
  const holder = truthTurnPowerPlayer(game, asker), respondent = truthTurnPowerPlayer(game, target);
  const bought = holder.hand.findIndex(card => card.id === base.karama);
  assert.ok(bought >= 0); assert.ok(respondent.hand.length);
  [holder.hand[bought], respondent.hand[0]] = [respondent.hand[0], holder.hand[bought]];
  const second = game.deck.findIndex(card => card.kind === 'special' && card.effect === 'karama');
  assert.ok(second >= 0, 'The second original Karama must be in the controlled unopened deck');
  const secondKarama = game.deck[second].id;
  [holder.hand[bought], game.deck[second]] = [game.deck[second], holder.hand[bought]];
  assert.deepEqual(truthTurnPowerInventory(game), base.originalCards);
  const beforeDeclaration = structuredClone(game);
  game = actTruthTurnPower(game, owner, base.nativeAction);
  assert.equal(game.response?.kind, power); assert.equal(game.response.owner, owner);
  assert.equal(game.battle?.event, base.event); assert.equal(game.battle.territory, base.territory);
  const source = JSON.stringify(['karamaBattleCancel', game.turn, base.event, base.territory, power, owner]);
  const mixed = responseCancelPlay(source);
  return { base, game, beforeDeclaration, asker, target, owner, power, source, mixed,
    truth: base.truth, karama: base.karama, secondKarama,
    cancel: { type: 'card', card: base.karama, mode: 'cancel' } satisfies Action,
    foreignCancel: { type: 'card', card: secondKarama, mode: 'cancel' } satisfies Action,
    sourceDisclosure: `${base.sourceDisclosure} The adapter uses controlled physical hand/deck swaps for ` +
      'two Karama cards, then makes the actual native power declaration and retains its real response.',
  };
}
export type ResponseCancelFixture = ReturnType<typeof createResponseCancelFixture>;

export function declareResponseCancel(f: ResponseCancelFixture, source: Game = f.game, actions: TruthTurnPowerStep[] = []) {
  let game = actTruthTurnPower(source, f.asker, { type: 'card', card: f.truth }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const player = game.players.find(candidate => !game.truthtrance!.passed.includes(candidate.id));
    assert.ok(player); game = actTruthTurnPower(game, player.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return game;
}
export function askResponseCancel(game: Game, f: ResponseCancelFixture, mixed = f.mixed) {
  return actTruthTurnPower(game, f.asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target: f.target, turn: game.turn, mixed: structuredClone(mixed),
  } });
}
export function bindResponseCancel(f: ResponseCancelFixture, answer: 'yes' | 'no', mixed = f.mixed) {
  const declared = declareResponseCancel(f), asked = askResponseCancel(declared, f, mixed);
  const game = actTruthTurnPower(asked, f.target, { type: 'truthAnswer', answer });
  return { declared, asked, game };
}
