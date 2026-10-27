import assert from 'node:assert/strict';
import type { Action, Game } from '../game/engine';
import type { MovementExpression } from '../game/movement-expression-promises';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TurnActionLeaf } from '../game/turn-action-promises';
import {
  actTruthMovementExpression, createTruthMovementExpressionFixture,
  declareTruthMovementExpression, settleTruthMovementExpression,
  truthMovementExpressionInventory, truthMovementExpressionPlayer,
} from './fixture-truth-movement-expression';

export type MovementSectorQuestionKind = 'movement' | 'movementExpression' | 'mixedMovement' | 'travel' | 'turnActions';
export const actMovementSector = actTruthMovementExpression;
export const settleMovementSector = settleTruthMovementExpression;
export const movementSectorInventory = truthMovementExpressionInventory;
export const movementSectorPlayer = truthMovementExpressionPlayer;

/** Genuine Basic Atreides/Emperor setup and the original one-force Polar Sink
 * shipment. The starting Hajr and Truthtrance are original unopened selected
 * deal positions. This adapter chooses two unstormed printed Imperial Basin
 * sectors adjacent to the original Arrakeen army; it installs no hand, force,
 * wallet, timer, question, promise, progress or saved state. */
export function createTruthMovementSectorFixture() {
  const base = createTruthMovementExpressionFixture(), game = structuredClone(base.game);
  assert.equal(game.advanced, false); assert.equal(game.phase, 5); assert.equal(game.active, base.target);
  assert.ok(base.hajr && movementSectorPlayer(game, base.target).hand.some(card => card.id === base.hajr));
  const sectors = [9, 10, 11].filter(sector => sector !== game.storm);
  assert.ok(sectors.length >= 2);
  const [sector, alternative] = sectors;
  const move = (destination: number, amount = 1): Action => ({ type: 'move', from: 'arrakeen:10',
    territory: 'imperial_basin', sector: destination, amount });
  const leaf = (destination: number, minimum = 1): MovementExpression => ({ kind: 'move',
    territory: 'imperial_basin', sector: destination, minimum });
  const action = (destination: number, minimum = 1): MixedActionExpression<TurnActionLeaf> => ({
    kind: 'action', action: { kind: 'move', territory: 'imperial_basin', sector: destination, minimum },
  });
  const forceTotal = (state: Game) => {
    const player = movementSectorPlayer(state, base.target);
    return player.reserves + player.tanks + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0);
  };
  assert.deepEqual(movementSectorInventory(game), base.originalCards);
  return { base, game, target: base.target, asker: base.asker, truth: base.truth, hajr: base.hajr,
    sector, alternative, move, leaf, action, originalCards: base.originalCards, forceTotal,
    originalForces: forceTotal(game), disclosure: base.sourceDisclosure };
}
export type TruthMovementSectorFixture = ReturnType<typeof createTruthMovementSectorFixture>;

export function askMovementSector(game: Game, f: TruthMovementSectorFixture, kind: MovementSectorQuestionKind,
  grouped = false): Game {
  const exact = f.leaf(f.sector, grouped ? 2 : 1), other = f.leaf(f.alternative, 1);
  let question: Record<string, unknown>;
  if (kind === 'movement') {
    assert.equal(grouped, false);
    question = { kind, target: f.target, territory: 'imperial_basin', sector: f.sector, minimum: 1 };
  } else if (kind === 'movementExpression') {
    question = { kind, target: f.target, turn: game.turn,
      claim: grouped ? { kind: 'and', terms: [exact, other] } : exact };
  } else if (kind === 'mixedMovement') {
    const physicalHajr = movementSectorPlayer(game, f.target).hand.find(card => card.id === f.hajr);
    assert.ok(physicalHajr);
    const knownFact = { kind: 'fact', fact: { kind: 'hand', name: physicalHajr.name } };
    const selected = { kind: 'action', action: { territory: 'imperial_basin', sector: f.sector, minimum: grouped ? 2 : 1 } };
    const second = { kind: 'action', action: { territory: 'imperial_basin', sector: f.alternative, minimum: 1 } };
    question = { kind, target: f.target, turn: game.turn,
      mixed: { kind: 'and', terms: grouped ? [knownFact, selected, second] : [knownFact, selected] } };
  } else {
    question = { kind, target: f.target, turn: game.turn, mixed: grouped
      ? { kind: 'and', terms: [f.action(f.sector, 2), f.action(f.alternative)] }
      : f.action(f.sector) };
  }
  return actMovementSector(game, f.asker, { type: 'truthAsk', question } as Action);
}
export function bindMovementSector(f: TruthMovementSectorFixture, kind: MovementSectorQuestionKind,
  answer: 'yes' | 'no', grouped = false) {
  const declared = declareTruthMovementExpression(f.base, f.game).game;
  const asked = askMovementSector(declared, f, kind, grouped);
  const game = actMovementSector(asked, f.target, { type: 'truthAnswer', answer });
  return { declared, asked, game };
}
