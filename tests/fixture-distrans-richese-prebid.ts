import assert from 'node:assert/strict';
import type { Action } from '../game/engine';
import {
  actDistransPrebid, advanceDistransPrebid, createDistransPrebidFixture,
  distransPrebidClean, distransPrebidInventory, distransPrebidPlayer,
  type DistransPrebidStep,
} from './fixture-distrans-prebid';

/** Original public Basic/Advanced table, with Guild's actual one-spice cache
 * purchase of Distrans and its original dealt gift card. Continue that native
 * table to turn two, then use Richese's real cache declaration; no played hand,
 * purse, phase, auction, lot or submission is installed. The underlying fixture
 * selects only unopened deal/Spice positions and native scalar lotteries. */
export function createDistransRichesePrebidFixture(options: {
  advanced?: boolean;
  method: 'onceAround' | 'silent';
}) {
  const original = createDistransPrebidFixture({ advanced: options.advanced });
  const actions: DistransPrebidStep[] = structuredClone(original.actions);
  let game = advanceDistransPrebid(original.game,
    state => state.turn === 2 && state.decision?.kind === 'richeseCache' &&
      !state.response && !state.phaseOpening && !state.pendingTreacheryDiscard,
    actions);
  const beforeDeclaration = structuredClone(game);
  const actor = game.decision!.player;
  const declaration: Action = { type: 'decision', event: game.richeseBidding!.event,
    card: game.richeseCache![0].id, method: options.method,
    ...(options.method === 'onceAround' ? { direction: 'counterclockwise' } : {}) };
  game = actDistransPrebid(game, actor, declaration, actions);
  assert.ok(distransPrebidClean(game));
  assert.ok(game.richeseAuction);
  assert.equal(game.richeseAuction.method, options.method);
  assert.equal(game.richeseAuction.outcome, null);
  assert.equal(game.richeseAuction.acted.length, 0);
  assert.equal(Object.keys(game.richeseAuction.sealed).length, 0);
  assert.ok(distransPrebidPlayer(game, original.holder).hand.some(card => card.id === original.card));
  assert.ok(distransPrebidPlayer(game, original.holder).hand.some(card => card.id === original.give));
  assert.deepEqual(distransPrebidInventory(game), original.originalInventory);
  return { ...original, game, actions, beforeDeclaration, declaration, method: options.method,
    sourceActionCount: actions.length,
    staging: [...original.staging, 'The turn-two cache offer and method use actual native actions after the earned Distrans purchase.'] };
}
