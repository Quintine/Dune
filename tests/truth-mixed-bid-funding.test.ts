import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import {
  actTruthMixedBid as act, advanceTruthMixedBid as advance, answerTruthMixedBid as answer,
  askTruthMixedBid as ask, bindTruthMixedBid as bind, continueTruthMixedBidLot as closeLot,
  createTruthMixedBidFixture as fixture, declareTruthMixedBid as declare, finishTruthMixedBid as finish,
  truthMixedBidClean as clean, truthMixedBidInventory as inventory, truthMixedBidPlayer as player,
  truthMixedBidPromise as promise,
} from './fixture-truth-mixed-bid';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}

void test('two original Truths combine scalar bid No six and mixed bid Yes four with one real five-spice declaration', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'bid', target: f.target,
    turn: game.turn, lot: game.auction!.index + 1, minimum: 6 } });
  game = answer(game, f.target, 'no'); assert.equal(game.truthtrance?.stage, 'ask');
  game = ask(game, f.asker, f.target, f.mixed);
  assert.deepEqual(viewGame(game, f.target).truthMixedBidAnswers, ['yes', 'no']); game = answer(game, f.target, 'yes');
  assert.equal(game.bidPromises?.length, 2); assert.equal(viewGame(game, f.target).bidPromises.length, 1);
  assert.equal(viewGame(game, f.target).bidPromises[0].minimum, 6);
  assert.notEqual(viewGame(game, f.target).bidPromises[0].event, promise(game).event);
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  rejected(game, f.target, { type: 'passBid' }); rejected(game, f.target, { type: 'bid', amount: 6 });
  game = act(game, f.target, { type: 'bid', amount: 5 }); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).spice, 10); game = closeLot(game);
  assert.equal(player(game, f.target).spice, 5); assert.equal(promise(game).released, false);
  assert.ok(game.bidPromises?.every(row => row.fulfilled || row.released));
  assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard)); assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original Truths preserve a prior nine-force shipment when a later mixed bid four would spend its shared funding', () => {
  const f = fixture(); let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'shipment', target: f.target,
    claim: { territory: 'arrakeen', minimum: 9 } } });
  assert.ok(viewGame(game, f.target).truthShipmentAnswers?.includes('yes')); game = answer(game, f.target, 'yes');
  assert.equal(game.truthtrance?.stage, 'ask'); game = ask(game, f.asker, f.target, f.mixed);
  assert.deepEqual(viewGame(game, f.target).truthMixedBidAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'no');
  rejected(game, f.target, { type: 'bid', amount: 4 }); game = act(game, f.target, { type: 'bid', amount: 1, allyPayment: 0 });
  game = closeLot(game); assert.equal(player(game, f.target).spice, 9);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no'); assert.equal(promise(game).fulfilled, true);
  game = finish(game); game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state));
  game = act(game, f.target, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 9, elite: 0, allyPayment: 0 });
  game = advance(game, clean); assert.equal(player(game, f.target).forces['arrakeen:10'], 9);
  assert.equal(player(game, f.target).spice, 0); assert.ok(game.shipmentPromises?.some(row => row.player === f.target && row.fulfilled));
  assert.equal(promise(game).fulfilled, true);
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed bid Yes retains four original spice while a real six-spice bribe is allowed', () => {
  const f = fixture({ window: 'waiting' }); let game = bind(f).game;
  rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 7 });
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 6 });
  assert.equal(player(game, f.target).spice, 4); assert.equal(player(game, f.asker).bribes, 6);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no'); assert.equal(promise(game).fulfilled, false);
  game = advance(game, state => state.auction?.active === f.target && clean(state));
  const guide = viewGame(game, f.target).bidPromiseGuide; assert.ok(guide); assert.equal(guide.action.amount, 4);
  game = act(game, f.target, guide.action); assert.equal(promise(game).fulfilled, true);
  game = closeLot(game); assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.asker).bribes, 6);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard));
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1); assert.deepEqual(inventory(game), f.originalCards);
});
