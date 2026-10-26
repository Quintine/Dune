import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actTruthBid as act, advanceTruthBid as advance, answerTruthBid as answer,
  askTruthBid as ask, bindTruthBid as bind, continueTruthBidLot as closeLot,
  createTruthBidFixture as fixture, declareTruthBid as declare, finishTruthBid as finish,
  truthBidClean as clean, truthBidInventory as inventory, truthBidPlayer as player,
} from './fixture-truth-bid';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function current(game: Game, actor: string): Game {
  return advance(game, state => clean(state) && state.auction?.active === actor);
}

void test('two original Truth cards keep a prior shipment commitment funded when answering a later bid question', () => {
  const f = fixture();
  let game = declare(f, f.game, { copies: 2 }).game;
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'shipment', target: f.target, claim: { territory: 'arrakeen', minimum: 9 },
  } });
  assert.ok(viewGame(game, f.target).truthShipmentAnswers?.includes('yes'));
  game = answer(game, f.target, 'yes');
  assert.equal(game.truthtrance?.stage, 'ask');
  game = ask(game, f.asker, f.target, 4);
  assert.deepEqual(viewGame(game, f.target).truthBidAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(game, f.target, 'no');
  game = current(game, f.target);
  game = act(game, f.target, { type: 'bid', amount: 1, allyPayment: 0 });
  game = closeLot(game);
  assert.equal(player(game, f.target).spice, 9);
  game = finish(game);
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state));
  game = act(game, f.target, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 9, elite: 0, allyPayment: 0 });
  game = advance(game, clean);
  assert.equal(player(game, f.target).forces['arrakeen:10'], 9);
  assert.ok(game.shipmentPromises?.some(promise => promise.player === f.target && promise.fulfilled));
  assert.ok(game.bidPromises?.every(promise => promise.fulfilled));
  assert.deepEqual(inventory(game), f.originalCards);
});

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} current-lot Truth Yes requires a real new bid and preserves original payment`, () => {
  const f = fixture({ advanced, window: 'active' });
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.deepEqual(f.game.expansions, []); assert.deepEqual(f.staging, []);
  assert.equal(f.originalCards.length, 33); assert.equal(f.truths.length, 2);
  assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 4).map(card => card.id), f.deal);
  const before = structuredClone(f.game), bound = bind(f);
  assert.deepEqual(f.game, before);
  assert.equal(bound.game.truthtrance, null);
  assert.equal(bound.game.discard.filter(card => card.id === f.truth).length, 1);
  assert.equal(player(bound.game, f.asker).hand.filter(card => card.effect === 'truthtrance').length, 1);
  rejected(bound.game, f.target, { type: 'passBid' });
  rejected(bound.game, f.target, { type: 'bid', amount: 3 });
  const guide = viewGame(bound.game, f.target).bidPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'bid'); assert.equal(guide.action.amount, 4);
  const bid = act(bound.game, f.target, guide.action);
  assert.equal(bid.bidPromises!.find(promise => promise.player === f.target)!.fulfilled, true);
  assert.equal(player(bid, f.target).spice, 10, 'Declaring the bid does not pay its later invoice');
  const paid = closeLot(bid);
  assert.equal(player(paid, f.target).spice, 6);
  assert.equal(player(paid, f.target).hand.filter(card => card.id === f.lotCard).length, 1);
  assert.ok((paid.bidPromises ?? []).every(promise => promise.fulfilled || promise.released));
  assert.deepEqual(inventory(paid), f.originalCards);
  const done = finish(paid); assert.equal(done.phase, 4); assert.deepEqual(inventory(done), f.originalCards);
});

for (const lowerBid of [false, true]) void test(`native current-lot Truth No permits ${lowerBid ? 'a lower bid' : 'a pass'} and expires before the next ordinary lot`, () => {
  const f = fixture({ window: lowerBid ? 'active' : 'waiting' });
  let source = f.game;
  if (!lowerBid) {
    source = act(source, f.asker, { type: 'bid', amount: 1 });
    source = act(source, f.opponent, { type: 'passBid' });
  }
  const bound = bind(f, 'no', 4, source);
  rejected(bound.game, f.target, { type: 'bid', amount: 4 });
  const chosen = act(bound.game, f.target, lowerBid ? { type: 'bid', amount: 2 } : { type: 'passBid' });
  const next = chosen.auction?.index === 0 ? closeLot(chosen) : chosen;
  assert.equal(next.auction!.index, 1);
  assert.ok((next.bidPromises ?? []).every(promise => promise.fulfilled || promise.released));
  const ready = current(next, f.target);
  const accepted = act(ready, f.target, { type: 'bid', amount: 4 });
  assert.equal(accepted.auction!.bid, 4); assert.equal(accepted.auction!.bidder, f.target);
  assert.deepEqual(inventory(accepted), f.originalCards);
});

void test('native waiting bidder Yes is released by a real opposing ten-spice bid, with ordinary Emperor income later', () => {
  const f = fixture(), bound = bind(f);
  assert.equal(bound.game.auction!.active, f.asker);
  assert.equal(viewGame(bound.game, f.target).bidPromiseGuide, null);
  let game = act(bound.game, f.asker, { type: 'passBid' });
  assert.equal(game.auction!.active, f.opponent);
  game = act(game, f.opponent, { type: 'bid', amount: 10 });
  assert.equal(game.auction!.active, f.target);
  assert.equal(game.bidPromises!.find(promise => promise.player === f.target)!.released, true);
  game = act(game, f.target, { type: 'passBid' }); game = closeLot(game);
  assert.equal(player(game, f.opponent).spice, 0);
  assert.equal(player(game, f.target).spice, 20, 'Original Emperor auction income remains separate from its released declaration promise');
  assert.ok(player(game, f.opponent).hand.some(card => card.id === f.lotCard));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native bidder cannot bribe away the last Yes funding but may keep its real four-spice witness', () => {
  const f = fixture(), bound = bind(f);
  rejected(bound.game, f.target, { type: 'bribe', target: f.asker, amount: 7 });
  let game = act(bound.game, f.target, { type: 'bribe', target: f.asker, amount: 6 });
  assert.equal(player(game, f.target).spice, 4); assert.equal(player(game, f.asker).bribes, 6);
  game = current(game, f.target);
  const guide = viewGame(game, f.target).bidPromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action); game = closeLot(game);
  assert.equal(player(game, f.target).spice, 0); assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native earlier qualifying bid does not fulfill a Truth promise answered after a real outbid', () => {
  const f = fixture(); let game = f.game;
  for (const [actor, amount] of [[f.asker, 1], [f.opponent, 2], [f.target, 4], [f.asker, 5], [f.opponent, 6]] as const)
    game = act(game, actor, { type: 'bid', amount });
  assert.equal(game.auction!.active, f.target);
  game = bind(f, 'yes', 4, game).game;
  assert.equal(game.bidPromises!.find(promise => promise.player === f.target)!.fulfilled ?? false, false);
  rejected(game, f.target, { type: 'passBid' });
  const guide = viewGame(game, f.target).bidPromiseGuide; assert.ok(guide); assert.equal(guide.action.amount, 7);
  game = act(game, f.target, guide.action); assert.equal(game.bidPromises![0].fulfilled, true);
  game = closeLot(game); assert.equal(player(game, f.target).spice, 3);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native bid declaration fulfills Yes even when a different real bidder later wins and pays', () => {
  const f = fixture(); let game = act(f.game, f.asker, { type: 'bid', amount: 1 });
  game = act(game, f.opponent, { type: 'bid', amount: 2 });
  game = bind(f, 'yes', 4, game).game;
  game = act(game, f.target, { type: 'bid', amount: 4 }); assert.equal(game.bidPromises![0].fulfilled, true);
  game = act(game, f.asker, { type: 'bid', amount: 5 });
  game = act(game, f.opponent, { type: 'passBid' });
  game = act(game, f.target, { type: 'passBid' });
  game = advance(game, clean);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.lotCard));
  assert.ok(!player(game, f.target).hand.some(card => card.id === f.lotCard));
  assert.equal(player(game, f.asker).spice, 5); assert.equal(player(game, f.target).spice, 15);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two original queued Truthtrances combine No six with Yes four and each discard only once', () => {
  const f = fixture({ window: 'active' }), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, 6); game = answer(game, f.target, 'no');
  assert.equal(game.truthtrance!.stage, 'ask');
  game = ask(game, f.asker, f.target, 4); game = answer(game, f.target, 'yes');
  assert.equal(game.bidPromises!.length, 2);
  for (const card of f.truths) assert.equal(game.discard.filter(held => held.id === card).length, 1);
  rejected(game, f.target, { type: 'passBid' }); rejected(game, f.target, { type: 'bid', amount: 6 });
  game = act(game, f.target, { type: 'bid', amount: 5 }); game = closeLot(game);
  assert.equal(player(game, f.target).spice, 5);
  assert.ok((game.bidPromises ?? []).every(promise => promise.fulfilled || promise.released));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native question ownership, exact current-lot binding and stale guided callbacks retain original action boundaries', () => {
  const f = fixture({ window: 'active' }), declared = declare(f), question = f.question;
  rejected(declared.game, f.opponent, { type: 'truthAsk', question });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...question, lot: question.lot + 1 } });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...question, turn: question.turn + 1 } });
  let game = ask(declared.game, f.asker, f.target);
  assert.deepEqual(viewGame(game, f.target).truthBidAnswers, ['yes', 'no']);
  assert.equal(viewGame(game, f.opponent).truthBidAnswers, null);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' });
  game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).bidPromiseGuide; assert.ok(guide);
  assert.ok(guide.action.bidPromiseEvent);
  assert.ok(viewGame(game, f.target).bidPromises.every(promise => !Object.hasOwn(promise, 'source')));
  game = act(game, f.target, guide.action); game = closeLot(game); game = current(game, f.target);
  rejected(game, f.target, guide.action);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native already-passed and current-highest bidders cannot supply a new Truth bid opportunity', () => {
  const passed = fixture({ window: 'active' }), first = declare(passed);
  assert.ok(passed.game.auction!.passed.includes(passed.opponent));
  rejected(first.game, passed.asker, { type: 'truthAsk', question: { ...passed.question, target: passed.opponent } });
  const highest = fixture(); let game = highest.game;
  for (const [actor, amount] of [[highest.asker, 1], [highest.opponent, 2], [highest.target, 3]] as const)
    game = act(game, actor, { type: 'bid', amount });
  assert.equal(game.auction!.bidder, highest.target);
  game = declare(highest, game).game;
  rejected(game, highest.asker, { type: 'truthAsk', question: highest.question });
  assert.deepEqual(inventory(game), highest.originalCards);
});

void test('native actual Karama funds the promised overbid and its original free purchase consumes one card', () => {
  const f = fixture({ window: 'active', targetKarama: true }); let game = bind(f, 'yes', 11).game;
  const guide = viewGame(game, f.target).bidPromiseGuide; assert.ok(guide); assert.equal(guide.action.amount, 11);
  game = act(game, f.target, guide.action);
  game = advance(game, state => !state.response && state.decision?.kind === 'auctionPayment');
  assert.equal(game.auction!.bid, 11); assert.equal(player(game, f.target).spice, 10);
  game = act(game, f.target, { type: 'decision', karama: true, card: f.karama });
  assert.equal(player(game, f.target).spice, 10); assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard));
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal policies offer a legal native bid for the current answered Yes', () => {
  const f = fixture({ window: 'active' }), bound = bind(f).game;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(bound, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const offered = botActions(view).find(action => action.type === 'bid' && Number(action.amount) >= 4); assert.ok(offered, difficulty);
    const accepted = act(structuredClone(bound), f.target, offered);
    assert.equal(accepted.bidPromises![0].fulfilled, true); assert.deepEqual(inventory(accepted), f.originalCards);
  }
});
