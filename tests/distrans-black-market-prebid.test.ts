import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actDistransPrebid, advanceDistransPrebid, createDistransPrebidFixture,
  distransPrebidClean, distransPrebidInventory, distransPrebidPlayer as player,
  distransPrebidPosition, type DistransPrebidStep,
} from './fixture-distrans-prebid';

/** The original Advanced public table actually sells Distrans to Guild for one
 * spice in the first cache auction. Continue through real phase actions to the
 * next turn; Richese offers its own originally dealt card in the native Black
 * Market. Only the underlying fixture's unopened card/Spice order and scalar
 * lotteries are selected. No played hand, price, auction or phase is installed. */
function source() {
  const f = createDistransPrebidFixture({ advanced: true });
  const actions: DistransPrebidStep[] = structuredClone(f.actions);
  let game = advanceDistransPrebid(f.game, state => state.turn === 2 && state.phase === 3 &&
    !state.response && !state.phaseOpening && !state.pendingTreacheryDiscard &&
    state.decision?.kind === 'richeseBlackMarket', actions);
  const beforeMarket = structuredClone(game);
  const seller = game.decision!.player;
  const physical = player(game, seller).hand[0]; assert.ok(physical);
  const declaration: Action = { type: 'decision', event: game.richeseBidding!.event,
    card: physical.id, method: 'normal', direction: 'clockwise' };
  game = actDistransPrebid(game, seller, declaration, actions);
  game = advanceDistransPrebid(game, state => distransPrebidClean(state) &&
    state.richeseAuction?.source === 'blackMarket' && state.richeseAuction.method === 'normal', actions);
  const lot = game.richeseAuction!;
  assert.equal(lot.cardId, physical.id);
  assert.equal(lot.bid, 0); assert.equal(lot.bidder, null);
  assert.deepEqual(lot.passed, []); assert.deepEqual(lot.acted, []);
  assert.ok(player(game, seller).hand.some(c => c.id === physical.id));
  assert.ok(player(game, f.holder).hand.some(c => c.id === f.card));
  assert.ok(player(game, f.holder).hand.some(c => c.id === f.give));
  assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
  return { ...f, game, actions, beforeMarket, seller, physical, declaration };
}
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => actDistransPrebid(game, actor, action));
  assert.deepEqual(game, before);
}

void test('genuine Advanced Black Market normal lot remains unbid through earned Distrans transfer', () => {
  const f = source(), before = structuredClone(f.game);
  assert.equal(f.beforeMarket.decision?.kind, 'richeseBlackMarket');
  assert.ok(f.acquisition.actions.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(viewGame(before, f.holder).distrans!.blocked, null);
  assert.ok(viewGame(before, f.holder).distrans!.choices.find(c => c.recipient === f.recipient)!.cards.some(c => c.id === f.give));
  let game = actDistransPrebid(f.game, f.holder, f.action);
  assert.deepEqual(f.game, before);
  game = advanceDistransPrebid(game, distransPrebidClean);
  assert.deepEqual(distransPrebidPosition(game), distransPrebidPosition(before));
  assert.deepEqual(player(game, f.holder).hand, player(before, f.holder).hand.filter(c => c.id !== f.card && c.id !== f.give));
  assert.deepEqual(player(game, f.recipient).hand, [...player(before, f.recipient).hand,
    player(before, f.holder).hand.find(c => c.id === f.give)!]);
  assert.ok(player(game, f.seller).hand.some(c => c.id === f.physical.id));
  assert.equal(game.discard.filter(c => c.id === f.card).length, 1);
  assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
  const lot = game.richeseAuction!, actor = lot.active!; assert.ok(actor);
  game = actDistransPrebid(game, actor, { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 });
  assert.equal(game.richeseAuction!.bid, 1);
  assert.equal(game.richeseAuction!.bidder, actor);
  assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
  rejected(game, f.holder, f.action);
});

for (const amount of [null, 1] as const) {
  void test(`genuine Advanced Black Market first ${amount === null ? 'pass' : 'bid'} closes Distrans before either card leaves custody`, () => {
    const f = source(), lot = f.game.richeseAuction!, actor = lot.active!; assert.ok(actor);
    const game = actDistransPrebid(f.game, actor, { type: 'richeseBid', event: lot.event, amount, allyPayment: 0 });
    assert.ok(game.richeseAuction);
    assert.ok(viewGame(game, f.holder).distrans!.blocked);
    rejected(game, f.holder, f.action);
    assert.ok(player(game, f.holder).hand.some(c => c.id === f.card));
    assert.ok(player(game, f.holder).hand.some(c => c.id === f.give));
    assert.ok(player(game, f.seller).hand.some(c => c.id === f.physical.id));
    assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
  });
}
