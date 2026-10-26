import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actTruthRevivalEarly as act, advanceTruthRevivalEarly as advance, bindTruthRevivalEarly as bind,
  answerTruthRevivalEarly as answer, askTruthRevivalEarly as ask, declareTruthRevivalEarly as declare,
  completeTruthRevivalEarly as complete, createTruthRevivalEarlyFixture as fixture,
  finishTruthRevivalEarly as finish, settleTruthRevivalEarly as settle,
  truthRevivalEarlyClean as clean, truthRevivalEarlyInventory as inventory, truthRevivalEarlyPlayer as player,
} from './fixture-truth-revival-early';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
const promise = (game: Game, target: string) => game.revivalPromises!.find(promise => promise.player === target)!;

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced typed' : 'Basic'} post-Storm Truth Revival Yes survives actual Spice Charity and Bidding`, () => {
  const f = fixture({ advanced }); assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 1);
  assert.deepEqual(f.originalPostStorm, f.base.storm.after);
  assert.deepEqual(f.sourceActions, f.base.sourceActions.slice(0, f.postStormActionCount));
  assert.equal(f.sourceActionCount, f.sourceActions.length); assert.deepEqual(f.staging, []);
  assert.equal(player(f.game, f.target).tanks, 3); assert.equal(player(f.game, f.target).spice, 4);
  let game = bind(f).game; assert.equal(promise(game, f.target).progress, 0);
  assert.equal(viewGame(game, f.target).revivalPromiseGuide, null, 'Quiet Spice is not a fabricated owned guide opportunity');
  const actual = complete(f, game); game = actual.game;
  assert.ok(actual.actions.some(step => step.action.type === 'passBid'));
  assert.equal(game.phase, 4); assert.equal(promise(game, f.target).progress, 0);
  if (advanced) assert.equal(game.revivalOrder!.remaining[0], f.target);
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide); assert.equal(guide.phase, 4);
  game = settle(act(game, f.target, guide.action));
  assert.equal(promise(game, f.target).progress, 3); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).tanks, 0);
  assert.equal(player(game, f.target).freeForcesRevived, 1);
  assert.equal(player(game, f.target).elites?.revived ?? 0, advanced ? 1 : 0);
  assert.deepEqual(inventory(finish(game)), f.originalCards);
});

void test('native Storm-phase promise uses the next real Revival reset and excludes a prior-turn ordinary return', () => {
  const f = fixture({ phase: 0, phase0PriorReturn: true });
  assert.equal(f.game.turn, 3); assert.equal(f.game.phase, 0); assert.ok(f.priorReturn);
  assert.equal(player(f.game, f.target).tanks, 2); assert.equal(player(f.game, f.target).revived, 1);
  assert.equal(player(f.game, f.target).freeForcesRevived, 1);
  let game = bind(f).game; assert.equal(promise(game, f.target).progress, 0);
  game = complete(f, game).game;
  assert.equal(player(game, f.target).revived, 0); assert.equal(player(game, f.target).freeForcesRevived, 0);
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide); assert.equal(guide.action.amount, 2);
  game = act(game, f.target, guide.action);
  assert.equal(promise(game, f.target).progress, 2); assert.equal(player(game, f.target).spice, 2);
  assert.equal(player(game, f.target).freeForcesRevived, 1); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native Charity-funded early Yes requires its actual two-spice claim before owned readiness or spending', () => {
  const f = fixture({ phase: 2, poor: true }); assert.ok(f.funding);
  assert.equal(f.funding.steps[0].action.type, 'bribe'); assert.equal(player(f.game, f.target).spice, 0);
  assert.equal(player(f.game, f.asker).bribes, 4);
  let game = bind(f).game;
  rejected(game, f.target, { type: 'ready' });
  const charity = viewGame(game, f.target).revivalPromiseGuide; assert.ok(charity); assert.equal(charity.phase, 2);
  assert.equal(charity.action.type, 'charity'); game = act(game, f.target, charity.action);
  assert.equal(player(game, f.target).spice, 2); assert.equal(promise(game, f.target).progress, 0);
  rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 1 });
  game = advance(game, state => state.phase === 3 && clean(state) && state.auction?.active === f.target);
  rejected(game, f.target, { type: 'bid', amount: 1 });
  const bidGuide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(bidGuide); assert.equal(bidGuide.phase, 3);
  assert.equal(bidGuide.action.type, 'passBid'); game = act(game, f.target, bidGuide.action);
  game = complete(f, game).game;
  const returned = viewGame(game, f.target).revivalPromiseGuide; assert.ok(returned); assert.equal(returned.phase, 4);
  game = act(game, f.target, returned.action);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).tanks, 1);
  assert.equal(promise(game, f.target).progress, 2); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native early No remains binding through Bidding and limits the actual later ordinary return', () => {
  const f = fixture(); let game = bind(f, 'no', 2).game;
  game = complete(f, game).game;
  game = act(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  assert.equal(promise(game, f.target).progress, 1);
  rejected(game, f.target, { type: 'revive', amount: 1, elite: 0 });
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide); assert.equal(guide.action.type, 'ready');
  game = act(game, f.target, guide.action); game = finish(game);
  assert.equal(player(game, f.target).revived, 1); assert.equal(player(game, f.target).tanks, 2);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native early Yes reserves its paid return funding against a new owned auction bid', () => {
  const f = fixture({ phase: 3 }); let game = bind(f).game;
  game = advance(game, state => clean(state) && state.auction?.active === f.target);
  assert.equal(player(game, f.target).spice, 4);
  rejected(game, f.target, { type: 'bid', amount: 1 });
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide);
  assert.equal(guide.phase, 3); assert.equal(guide.action.type, 'passBid');
  game = act(game, f.target, guide.action); game = complete(f, game).game;
  assert.equal(player(game, f.target).spice, 4); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native existing winning bid and its real payment reserve the early Revival invoice once', () => {
  const f = fixture({ phase: 3 }); let game = f.game;
  game = advance(game, state => clean(state) && state.auction?.active === f.target);
  const card = game.auction!.cards[game.auction!.index].id;
  game = act(game, f.target, { type: 'bid', amount: 2 });
  assert.equal(game.auction!.bidder, f.target); assert.equal(player(game, f.target).spice, 4);
  game = bind(f, 'yes', 2, 'total', game).game;
  assert.equal(promise(game, f.target).progress, 0);
  game = complete(f, game).game;
  assert.equal(player(game, f.target).spice, 2); assert.ok(player(game, f.target).hand.some(held => held.id === card));
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide); assert.equal(guide.action.amount, 2);
  game = act(game, f.target, guide.action);
  assert.equal(player(game, f.target).spice, 0); assert.equal(promise(game, f.target).progress, 2);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native owned Karama auction-payment guide preserves the actual funds for the earlier Revival Yes', () => {
  const f = fixture({ phase: 3, targetKarama: true }); assert.ok(f.auctionKarama);
  let game = bind(f).game;
  game = advance(game, state => clean(state) && state.auction?.active === f.target);
  game = act(game, f.target, { type: 'bid', amount: 5 });
  assert.equal(player(game, f.target).spice, 4);
  game = advance(game, state => !state.response && !state.phaseOpening && state.decision?.kind === 'auctionPayment' && state.decision.player === f.target);
  const payment = viewGame(game, f.target).revivalPromiseGuide; assert.ok(payment); assert.equal(payment.phase, 3);
  assert.equal(payment.action.type, 'decision'); assert.equal(payment.action.karama, true);
  assert.equal(payment.action.card, f.auctionKarama);
  game = act(game, f.target, payment.action);
  assert.equal(player(game, f.target).spice, 4); assert.equal(promise(game, f.target).progress, 0);
  assert.equal(game.discard.filter(card => card.id === f.auctionKarama).length, 1);
  game = complete(f, game).game;
  const revival = viewGame(game, f.target).revivalPromiseGuide; assert.ok(revival); assert.equal(revival.phase, 4);
  game = act(game, f.target, revival.action);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).tanks, 0);
  assert.equal(promise(game, f.target).progress, 3); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native earlier-phase typed Yes releases only after a real later Tleilaxu prevention', () => {
  const f = fixture({ advanced: true, stopper: true }); let game = bind(f).game; assert.ok(f.stopper && f.special);
  game = complete(f, game).game;
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide);
  game = act(game, f.target, guide.action); assert.equal(game.decision?.kind, 'revivalStop');
  assert.equal(promise(game, f.target).progress, 0);
  game = settle(act(game, f.stopper, f.special));
  assert.equal(promise(game, f.target).released, true); assert.equal(promise(game, f.target).progress, 0);
  assert.equal(player(game, f.target).tanks, 3); assert.equal(player(game, f.target).spice, 4);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two genuine early Truth answers preserve both a funded bid and the later ordinary return', () => {
  const f = fixture({ phase: 3 }), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, 2); game = answer(game, f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'bid', target: f.target,
    turn: game.turn, lot: game.auction!.index + 1, minimum: 1 } });
  assert.ok(viewGame(game, f.target).truthBidAnswers!.includes('yes'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = advance(game, state => clean(state) && state.auction?.active === f.target);
  assert.notEqual(viewGame(game, f.target).revivalPromiseGuide?.action.type, 'passBid');
  const bid = viewGame(game, f.target).bidPromiseGuide; assert.ok(bid); assert.equal(bid.action.amount, 1);
  game = act(game, f.target, bid.action); game = complete(f, game).game;
  assert.equal(player(game, f.target).spice, 3); assert.equal(promise(game, f.target).progress, 0);
  const revival = viewGame(game, f.target).revivalPromiseGuide; assert.ok(revival); assert.equal(revival.action.amount, 2);
  game = act(game, f.target, revival.action);
  assert.equal(player(game, f.target).spice, 1); assert.equal(promise(game, f.target).progress, 2);
  assert.ok(game.bidPromises!.every(promise => promise.fulfilled || promise.released));
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a genuine early Revival Yes cannot also promise an unfunded ordinary bid', () => {
  const f = fixture({ phase: 3 }), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, 3); game = answer(game, f.target, 'yes');
  game = act(game, f.asker, { type: 'truthAsk', question: { kind: 'bid', target: f.target,
    turn: game.turn, lot: game.auction!.index + 1, minimum: 1 } });
  assert.deepEqual(viewGame(game, f.target).truthBidAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  assert.equal(promise(game, f.target).answer, true); assert.equal(game.bidPromises![0].answer, false);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('a genuine earlier bid Yes excludes an ordinary Revival Yes that would consume its last bid funding', () => {
  const f = fixture({ phase: 3 }), declared = declare(f, f.game, { copies: 2 });
  let game = act(declared.game, f.asker, { type: 'truthAsk', question: { kind: 'bid', target: f.target,
    turn: f.game.turn, lot: f.game.auction!.index + 1, minimum: 1 } });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = ask(game, f.asker, f.target, 3);
  assert.deepEqual(viewGame(game, f.target).truthRevivalAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(game, f.target, 'no');
  assert.equal(promise(game, f.target).answer, false); assert.equal(game.bidPromises![0].answer, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native early guide acts only for its real Charity owner and cannot replay in a later phase', () => {
  const f = fixture({ phase: 2, poor: true }); let game = bind(f).game;
  const guide = viewGame(game, f.target).revivalPromiseGuide; assert.ok(guide); assert.equal(guide.phase, 2);
  assert.equal(viewGame(game, f.asker).revivalPromiseGuide, null);
  rejected(game, f.asker, guide.action);
  game = act(game, f.target, guide.action); game = complete(f, game).game;
  rejected(game, f.target, guide.action); assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal policies submit the actual needed Charity before the early Revival return', () => {
  const f = fixture({ phase: 2, poor: true }), game = bind(f).game;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'charity'); assert.ok(action, difficulty);
    const accepted = act(structuredClone(game), f.target, action);
    assert.equal(player(accepted, f.target).spice, 2); assert.equal(promise(accepted, f.target).progress, 0);
    assert.deepEqual(inventory(accepted), f.originalCards);
  }
});
