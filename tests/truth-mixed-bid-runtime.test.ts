import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { truthKnowledgeOf } from '../game/truthtrance-knowledge';
import {
  actTruthMixedBid as act, advanceTruthMixedBid as advance, answerTruthMixedBid as answer,
  askTruthMixedBid as ask, bindTruthMixedBid as bind, continueTruthMixedBidLot as closeLot,
  createTruthMixedBidFixture as fixture, declareTruthMixedBid as declare, finishTruthMixedBid as finish,
  truthMixedBidClean as clean, truthMixedBidFact as fact, truthMixedBidGroup as group,
  truthMixedBidInventory as inventory, truthMixedBidMinimum as bid, truthMixedBidPlayer as player,
  truthMixedBidPromise as promise,
} from './fixture-truth-mixed-bid';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function current(game: Game, actor: string): Game {
  return advance(game, state => clean(state) && state.auction?.active === actor);
}
function truthOnce(game: Game, truth: string) {
  assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} mixed bid freezes ten spice before the actual declaration and original four-spice purchase`, () => {
  const f = fixture({ advanced }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.sourceActionCount, advanced ? 25 : 22); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.deepEqual(f.staging, []); assert.deepEqual(f.game.expansions, []); assert.equal(f.originalCards.length, 33);
  assert.equal(f.truths.length, 2); assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 4).map(card => card.id), f.deal);
  assert.deepEqual(player(f.afterSetup, f.asker).hand.map(card => card.id), f.truths);
  assert.equal(truthFactAnswer(player(f.game, f.target), f.spiceFact), 'yes');
  const source = structuredClone(f.game); let game = bind(f).game;
  assert.deepEqual(f.game, source); assert.equal(game.truthtrance, null); truthOnce(game, f.truth);
  assert.deepEqual(promise(game).mixed, f.mixed); assert.equal(promise(game).fulfilled, false);
  rejected(game, f.target, { type: 'passBid' }); rejected(game, f.target, { type: 'bid', amount: 3 });
  const guide = viewGame(game, f.target).bidPromiseGuide; assert.ok(guide); assert.equal(guide.action.amount, 4);
  assert.equal(guide.action.bidPromiseEvent, promise(game).event);
  game = act(game, f.target, guide.action); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).spice, 10, 'The accepted declaration fulfills before the original winning invoice');
  game = closeLot(game); assert.equal(player(game, f.target).spice, 6);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  assert.equal(player(game, f.target).hand.filter(card => card.id === f.lotCard).length, 1);
  truthOnce(game, f.truth); assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native true held Shield OR a future bid gives only Yes with no binding and leaves the actual bid legal', () => {
  const f = fixture(), mixed = group('or', fact(f.shieldFact), bid());
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBidAnswers, ['yes']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'no' }); let game = answer(asked, f.target, 'yes');
  assert.equal(promise(game).fulfilled, true); assert.equal(game.bidPromises?.length ?? 0, 0);
  assert.equal(viewGame(game, f.target).bidPromiseGuide, null); assert.deepEqual(promise(game).mixed, mixed);
  game = act(game, f.target, { type: 'bid', amount: 4 }); game = closeLot(game);
  assert.equal(player(game, f.target).spice, 6); assert.equal(promise(game).fulfilled, true);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native false held Hajr AND a future bid gives only No while the later qualifying declaration remains legal', () => {
  const f = fixture(), mixed = group('and', fact(f.hajrFact), bid());
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBidAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' }); let game = answer(asked, f.target, 'no');
  assert.equal(promise(game).fulfilled, true); assert.equal(game.bidPromises?.length ?? 0, 0);
  game = act(game, f.target, { type: 'bid', amount: 4 }); game = closeLot(game);
  assert.equal(player(game, f.target).spice, 6); assert.equal(promise(game).fulfilled, true);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native false Hajr OR future bid Yes requires a new accepted bid', () => {
  const f = fixture(); let game = bind(f, 'yes', group('or', fact(f.hajrFact), bid())).game;
  assert.equal(promise(game).fulfilled, false); rejected(game, f.target, { type: 'passBid' });
  rejected(game, f.target, { type: 'bid', amount: 3 }); game = act(game, f.target, { type: 'bid', amount: 4 });
  assert.equal(promise(game).fulfilled, true); game = closeLot(game); assert.equal(player(game, f.target).spice, 6);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native true Shield AND future bid No allows a lower bid and forbids every later qualifying declaration in that lot', () => {
  const f = fixture({ window: 'waiting' }); let game = act(f.game, f.asker, { type: 'bid', amount: 1 });
  game = act(game, f.opponent, { type: 'bid', amount: 2 });
  game = bind(f, 'no', group('and', fact(f.shieldFact), bid(6)), game).game;
  rejected(game, f.target, { type: 'bid', amount: 6 }); game = act(game, f.target, { type: 'bid', amount: 4 });
  assert.equal(promise(game).fulfilled, false); game = act(game, f.asker, { type: 'bid', amount: 5 });
  game = act(game, f.opponent, { type: 'passBid' }); rejected(game, f.target, { type: 'bid', amount: 6 });
  game = act(game, f.target, { type: 'passBid' }); game = advance(game, clean);
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  assert.equal(player(game, f.target).spice, 15); assert.equal(player(game, f.asker).spice, 5);
  assert.deepEqual(inventory(game), f.originalCards);
});

for (const answerValue of ['yes', 'no'] as const) void test(`native whole nested mixed bid ${answerValue} collapses AND maxima and OR minima to the same threshold`, () => {
  const f = fixture(), mixed = group('and', fact(f.shieldFact), group('or',
    group('and', bid(4), bid(7)), group('and', bid(3), bid(5))));
  let game = bind(f, answerValue, mixed).game; assert.deepEqual(promise(game).mixed, mixed);
  const guide = viewGame(game, f.target).bidPromiseGuide; assert.ok(guide);
  if (answerValue === 'yes') {
    assert.equal(guide.action.amount, 5); rejected(game, f.target, { type: 'bid', amount: 4 });
    game = act(game, f.target, guide.action); assert.equal(promise(game).fulfilled, true);
  } else {
    rejected(game, f.target, { type: 'bid', amount: 5 }); game = act(game, f.target, { type: 'bid', amount: 4 });
  }
  game = closeLot(game); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).spice, answerValue === 'yes' ? 5 : 6); assert.deepEqual(inventory(game), f.originalCards);
});

for (const answerValue of ['yes', 'no'] as const) void test(`native unknown forecast uses the conservative whole ${answerValue} mixed bid constraint`, () => {
  const f = fixture(), p = player(f.game, f.target); assert.equal(truthKnowledgeOf(f.game, p).stormForecast, null);
  assert.equal(truthFactAnswer(p, f.forecastFact, truthKnowledgeOf(f.game, p)), 'unknown');
  const mixed = group(answerValue === 'yes' ? 'or' : 'and', fact(f.forecastFact), bid());
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBidAnswers, [answerValue]);
  rejected(asked, f.target, { type: 'truthAnswer', answer: answerValue === 'yes' ? 'no' : 'yes' });
  let game = answer(asked, f.target, answerValue); assert.equal(promise(game).fulfilled, false);
  if (answerValue === 'yes') {
    rejected(game, f.target, { type: 'passBid' }); game = act(game, f.target, { type: 'bid', amount: 4 });
    assert.equal(promise(game).fulfilled, true); game = closeLot(game);
  } else {
    rejected(game, f.target, { type: 'bid', amount: 4 }); game = act(game, f.target, { type: 'bid', amount: 2 });
    if (game.auction?.index === 0) game = closeLot(game);
  }
  assert.equal(promise(game).fulfilled, true); truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native prior qualifying bid before a real outbid remains outside the newly answered mixed Yes', () => {
  const f = fixture({ window: 'waiting' }); let game = f.game;
  for (const [actor, amount] of [[f.asker, 1], [f.opponent, 2], [f.target, 4], [f.asker, 5], [f.opponent, 6]] as const)
    game = act(game, actor, { type: 'bid', amount });
  game = bind(f, 'yes', f.mixed, game).game; assert.equal(promise(game).fulfilled, false);
  rejected(game, f.target, { type: 'passBid' }); const guide = viewGame(game, f.target).bidPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.amount, 7); game = act(game, f.target, guide.action); assert.equal(promise(game).fulfilled, true);
  game = closeLot(game); assert.equal(player(game, f.target).spice, 3); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed bid question and guide retain exact owner turn lot event and JSON boundaries', () => {
  const f = fixture(), declared = declare(f);
  assert.ok(viewGame(declared.game, f.asker).truthMixedBidTargets.includes(f.target));
  rejected(declared.game, f.opponent, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, lot: f.question.lot + 1 } });
  let game = ask(declared.game, f.asker, f.target, f.mixed);
  assert.deepEqual(viewGame(game, f.target).truthMixedBidAnswers, ['yes', 'no']);
  assert.equal(viewGame(game, f.asker).truthMixedBidAnswers, null); assert.equal(viewGame(game, f.opponent).truthMixedBidAnswers, null);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).bidPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.bidPromiseEvent, promise(game).event); rejected(game, f.opponent, guide.action);
  rejected(game, f.target, { ...guide.action, bidPromiseEvent: 'stale-mixed-bid-event' });
  const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, wire);
  assert.equal(promise(game).fulfilled, true); rejected(game, f.target, wire);
  game = closeLot(game); game = current(game, f.target); rejected(game, f.target, wire);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed bid projection retains only owned raw aggregate and filters its native residual', () => {
  const f = fixture(), game = bind(f).game;
  for (const actor of [f.target, f.asker, f.opponent]) {
    const view = viewGame(game, actor); assert.deepEqual(view.bidPromises, []); assert.equal(view.truthMixedBidAnswers, null);
    assert.deepEqual(view.truthHistory.at(-1)?.question, f.question); assert.equal(view.truthHistory.at(-1)?.answer, 'yes');
    if (actor !== f.target) {
      assert.deepEqual(view.mixedBidPromises, []); assert.equal(view.bidPromiseGuide, null);
    } else {
      const row = promise(game);
      assert.deepEqual(Object.keys(row).sort(), ['answer', 'asker', 'event', 'fulfilled', 'lot', 'mixed', 'player', 'released', 'turn']);
      assert.equal(row.player, f.target); assert.equal(row.asker, f.asker); assert.equal(row.turn, f.game.turn);
      assert.equal(row.lot, f.question.lot); assert.equal(row.answer, true); assert.deepEqual(row.mixed, f.mixed);
      assert.equal(row.fulfilled, false); assert.equal(row.released, false);
      assert.equal(view.bidPromiseGuide?.action.bidPromiseEvent, row.event);
    }
  }
  assert.equal(game.bidPromises?.length, 1); assert.equal(game.bidPromises![0].event, promise(game).event);
});

void test('native waiting mixed Yes releases after a real opposing ten-spice raise and retains original Emperor income', () => {
  const f = fixture({ window: 'waiting' }); assert.equal(f.sourceActionCount, 20);
  let game = bind(f).game; assert.equal(game.auction!.active, f.asker); assert.equal(viewGame(game, f.target).bidPromiseGuide, null);
  game = act(game, f.asker, { type: 'passBid' }); game = act(game, f.opponent, { type: 'bid', amount: 10 });
  assert.equal(game.auction!.active, f.target); assert.equal(promise(game).released, true); assert.equal(promise(game).fulfilled, false);
  game = act(game, f.target, { type: 'passBid' }); game = closeLot(game);
  assert.equal(player(game, f.target).spice, 20); assert.equal(player(game, f.opponent).spice, 0);
  assert.ok(player(game, f.opponent).hand.some(card => card.id === f.lotCard)); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed No allows an actual lower purchase and does not reactivate in the next ordinary lot', () => {
  const f = fixture(); let game = bind(f, 'no').game;
  rejected(game, f.target, { type: 'bid', amount: 4 }); game = act(game, f.target, { type: 'bid', amount: 2 });
  if (game.auction?.index === 0) game = closeLot(game);
  assert.equal(game.auction!.index, 1); assert.equal(player(game, f.target).spice, 8);
  assert.equal(promise(game).fulfilled, true); assert.equal(viewGame(game, f.target).bidPromiseGuide, null);
  game = current(game, f.target); game = act(game, f.target, { type: 'bid', amount: 4 });
  assert.equal(game.auction!.bid, 4); assert.equal(game.auction!.bidder, f.target); assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native accepted mixed Yes is fulfilled even when a later opposing bidder wins and pays', () => {
  const f = fixture({ window: 'waiting' }); let game = act(f.game, f.asker, { type: 'bid', amount: 1 });
  game = act(game, f.opponent, { type: 'bid', amount: 2 }); game = bind(f, 'yes', f.mixed, game).game;
  game = act(game, f.target, { type: 'bid', amount: 4 }); assert.equal(promise(game).fulfilled, true);
  game = act(game, f.asker, { type: 'bid', amount: 5 }); game = act(game, f.opponent, { type: 'passBid' });
  game = act(game, f.target, { type: 'passBid' }); game = advance(game, clean);
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.lotCard));
  assert.ok(!player(game, f.target).hand.some(card => card.id === f.lotCard));
  assert.equal(player(game, f.asker).spice, 5); assert.equal(player(game, f.target).spice, 15);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native original Karama funds mixed eleven-spice Yes and settles its original free-purchase invoice', () => {
  const f = fixture({ targetKarama: true }); let game = bind(f, 'yes', group('and', fact(f.spiceFact), bid(11))).game;
  const guide = viewGame(game, f.target).bidPromiseGuide; assert.ok(guide); assert.equal(guide.action.amount, 11);
  game = act(game, f.target, guide.action); assert.equal(promise(game).fulfilled, true);
  game = advance(game, state => !state.response && state.decision?.kind === 'auctionPayment');
  assert.equal(game.auction!.bid, 11); assert.equal(player(game, f.target).spice, 10);
  game = act(game, f.target, { type: 'decision', karama: true, card: f.karama });
  assert.equal(player(game, f.target).spice, 10); assert.equal(promise(game).fulfilled, true);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard)); truthOnce(game, f.karama!);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native mixed action targets exclude already-passed and current-highest bidders', () => {
  const passed = fixture(), declared = declare(passed);
  assert.ok(passed.game.auction!.passed.includes(passed.opponent));
  assert.ok(!viewGame(declared.game, passed.asker).truthMixedBidTargets.includes(passed.opponent));
  rejected(declared.game, passed.asker, { type: 'truthAsk', question: { ...passed.question, target: passed.opponent } });
  const highest = fixture({ window: 'waiting' }); let game = highest.game;
  for (const [actor, amount] of [[highest.asker, 1], [highest.opponent, 2], [highest.target, 3]] as const)
    game = act(game, actor, { type: 'bid', amount });
  game = declare(highest, game).game; assert.ok(!viewGame(game, highest.asker).truthMixedBidTargets.includes(highest.target));
  rejected(game, highest.asker, highest.questionAction); assert.deepEqual(inventory(game), highest.originalCards);
});

void test('all four minimal policies answer and execute an exact legal mixed bid Yes guide', () => {
  const f = fixture(), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked); const answering = viewGame(game, f.target);
    answering.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const answerAction = botActions(answering).find(action => action.type === 'truthAnswer'); assert.ok(answerAction, difficulty);
    assert.equal(answerAction.answer, 'yes', difficulty); game = act(game, f.target, answerAction);
    const view = viewGame(game, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const guide = view.bidPromiseGuide; assert.ok(guide, difficulty);
    const offered = botActions(view).find(action => action.type === 'bid' && action.bidPromiseEvent === guide.action.bidPromiseEvent);
    assert.ok(offered, difficulty); assert.deepEqual(offered, guide.action); game = act(game, f.target, offered);
    assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.target).spice, 10);
    game = closeLot(game); assert.equal(player(game, f.target).spice, 6); truthOnce(game, f.truth);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});
