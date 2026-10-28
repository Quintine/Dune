import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actTruthMovementNativeEarly as act,
  advanceTruthMovementNativeEarly as advance,
  createTruthMovementNativeEarlyFixture as fixture,
  truthMovementNativeEarlyClean as clean,
  truthMovementNativeEarlyInventory as inventory,
  truthMovementNativeEarlyPlayer as player,
} from './fixture-truth-movement-native-early';

/** Native Basic setup uses original unopened deal and Spice positions; the
 * shared fixture reaches clean Charity without a staged hand or promise. */
function bind(answer: 'yes' | 'no', withCancel = false) {
  const f = fixture({ roster: 'ixians-tleilaxu' });
  let game = structuredClone(f.game);
  let karama: string | undefined;
  if (withCancel) {
    // A controlled physical supplement moves one still-unopened Karama to the
    // Tleilaxu hand. This is only the optional cancellation cost: no wallet,
    // response, auction, bidder, pool or promise is installed.
    const index = game.deck.findIndex(card => card.effect === 'karama');
    assert.ok(index >= 0);
    const [card] = game.deck.splice(index, 1);
    karama = card.id;
    player(game, 'tleilaxu').hand.push(card);
    assert.deepEqual(inventory(game), f.originalCards);
  }
  game = act(game, f.asker, { type: 'card', card: f.truth });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(seat => !game.truthtrance!.passed.includes(seat.id));
    assert.ok(actor);
    game = act(game, actor.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  game = act(game, f.asker, { type: 'truthAsk', question: {
    kind: 'phaseBid', target: f.target, turn: game.turn, minimum: 4,
  } });
  assert.ok(viewGame(game, f.target).truthPhaseBidAnswers?.includes(answer));
  assert.equal(viewGame(game, f.asker).truthPhaseBidAnswers, null);
  for (const difficulty of DIFFICULTIES) {
    const target = viewGame(game, f.target);
    target.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const action = botActions(target)[0];
    assert.equal(action?.type, 'truthAnswer');
    assert.ok(target.truthPhaseBidAnswers!.includes(action.answer as 'yes' | 'no' | 'unknown'));
  }
  game = act(game, f.target, { type: 'truthAnswer', answer });
  assert.equal(game.truthtrance, null);
  assert.ok(game.phaseBidPromises?.some(row => row.player === f.target && row.answer === (answer === 'yes')));
  assert.deepEqual(inventory(game), f.originalCards);
  return { f, game, karama };
}

function ordinaryLot(source: Game, karama?: string) {
  let game: Game;
  if (karama) {
    game = advance(source, state => state.response?.kind === 'ixAuction' && !!state.ixAuction);
    assert.deepEqual(game.ixAuction!.cards, [], 'The real response precedes drawing the Ixian pool');
    game = act(game, 'tleilaxu', { type: 'card', card: karama, mode: 'cancel' });
  } else {
    // With no eligible counter the native Ixian response auto-allows, so it
    // can proceed directly to the real inspection decision in one action.
    game = advance(source, state => state.decision?.kind === 'ixAuction' && !state.response);
    const pool = game.ixAuction!.cards;
    assert.ok(pool.length > 1);
    const returned = pool[0].id, retained = pool.slice(1).map(card => card.id).sort();
    game = act(game, game.decision!.player, { type: 'decision', card: returned, position: 'bottom' });
    game = advance(game, state => clean(state) && !!state.auction);
    assert.deepEqual(game.ixAuctionKnown!.cards.map(card => card.id).sort(), retained);
    assert.ok(game.deck.some(card => card.id === returned));
    return game;
  }
  game = advance(game, state => clean(state) && !!state.auction);
  assert.equal(game.ixAuction ?? null, null);
  assert.equal(game.ixAuctionKnown ?? null, null, 'A canceled inspection grants no Ixian private pool');
  assert.equal(game.discard.filter(card => card.id === karama).length, 1);
  return game;
}

function toTarget(game: Game, target: string) {
  for (let n = 0; n < 20; n++) {
    if (clean(game) && game.auction?.active === target) return game;
    if (clean(game) && game.auction) game = act(game, game.auction.active, { type: 'passBid' });
    else game = advance(game, clean);
  }
  throw new Error('The original ordinary lot did not reach the promised bidder');
}

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before);
}

for (const canceled of [false, true]) {
  const source = canceled ? 'canceled Ixian inspection' : 'actual Ixian pool selection';
  void test(`Basic early phase-bid Yes survives ${source} and completes through the real ordinary bid`, () => {
    const { f, game: bound, karama } = bind('yes', canceled);
    let game = toTarget(ordinaryLot(bound, karama), f.target);
    const outstanding = viewGame(game, f.target).phaseBidPromises.find(row => row.minimum === 4);
    assert.ok(outstanding && !outstanding.fulfilled && !outstanding.released);
    reject(game, f.target, { type: 'passBid' });
    // A smaller bid may remain legal when an actual funded sale opens a later
    // lot; the phase promise does not force the current lot's threshold.
    const target = viewGame(game, f.target), guide = target.phaseBidPromiseGuide;
    assert.ok(guide); assert.equal(guide.action.type, 'bid');
    assert.equal(guide.action.amount, 4);
    for (const difficulty of DIFFICULTIES) {
      const bot = viewGame(game, f.target);
      bot.players.find(seat => seat.id === f.target)!.bot = difficulty;
      const action = botActions(bot)[0]; assert.ok(action);
      const trial = act(game, f.target, action);
      assert.ok(trial.phaseBidPromises?.some(row => row.player === f.target && row.fulfilled));
    }
    game = act(game, f.target, guide.action);
    assert.ok(game.phaseBidPromises?.some(row => row.player === f.target && row.fulfilled));
    assert.deepEqual(inventory(game), f.originalCards);
  });

  void test(`Basic early phase-bid No survives ${source} and constrains the real ordinary lot`, () => {
    const { f, game: bound, karama } = bind('no', canceled);
    let game = toTarget(ordinaryLot(bound, karama), f.target);
    reject(game, f.target, { type: 'bid', amount: 4, allyPayment: 0 });
    game = act(game, f.target, { type: 'passBid' });
    game = advance(game, state => state.phase > 3 && clean(state));
    assert.ok(game.phaseBidPromises?.some(row => row.player === f.target && !row.answer && row.fulfilled));
    assert.deepEqual(inventory(game), f.originalCards);
  });
}
