import assert from 'node:assert/strict';
import test from 'node:test';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actDistransPrebid, advanceDistransPrebid, buyDistransPrebidLot, createDistransPrebidFixture,
  distransPrebidClean, distransPrebidInventory, distransPrebidPlayer as player,
  distransPrebidPosition, distransPrebidUntouched, finishDistransPrebidLot,
  playDistransPrebid, type DistransPrebidFixture, type DistransPrebidStep,
} from './fixture-distrans-prebid';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => actDistransPrebid(game, actor, action));
  assert.deepEqual(game, before, 'The rejected public action leaves the native table unchanged');
}
function source(fixture: DistransPrebidFixture) {
  const f = fixture;
  assert.equal(f.initial.status, 'lobby');
  assert.equal(f.setup.status, 'setup');
  assert.ok(f.setup.players.every(seat => seat.hand.length === 0));
  assert.equal(f.afterSetup.status, 'playing');
  assert.equal(f.afterSetup.turn, 1);
  assert.ok(f.afterSetup.players.every(seat => seat.hand.length === 1));
  for (const { actor, card } of f.startingDealSelection)
    assert.ok(player(f.afterSetup, actor).hand.some(held => held.id === card));
  assert.ok(player(f.afterSetup, f.holder).hand.some(held => held.id === f.give));
  assert.ok(!player(f.afterSetup, f.holder).hand.some(held => held.id === f.card));
  assert.ok(f.acquisition.before.richeseCache!.some(card => card.id === f.card));
  assert.ok(f.acquisition.actions.some(step => step.actor === f.holder &&
    step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquired, f.holder).spice, player(f.acquisition.before, f.holder).spice - 1);
  assert.ok(player(f.acquired, f.holder).hand.some(card => card.id === f.card));
  assert.equal(f.acquired.richeseCache!.some(card => card.id === f.card), false);
  assert.equal(f.firstLot.auction!.cards.length, 3);
  assert.ok(distransPrebidUntouched(f.firstLot));
  assert.ok(distransPrebidUntouched(f.game));
  assert.ok(distransPrebidClean(f.game));
  assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(distransPrebidInventory(f.game), f.originalInventory);
  assert.equal(f.actions.length, f.sourceActionCount);
  assert.equal(f.actions[4].action.type, 'start');
  assert.equal(f.actions[4].action.advancedPreview, f.advanced ? true : undefined);
  assert.ok(f.game.players.every(seat => seat.ally === null));
  for (const purchase of f.purchases) {
    assert.ok(purchase.actions.some(step => step.actor === purchase.winner &&
      step.action.type === 'bid' && step.action.amount === 1));
    assert.equal(player(purchase.after, purchase.winner).hand.filter(card => card.id === purchase.card).length, 1);
    assert.equal(player(purchase.after, purchase.winner).spice,
      player(purchase.before, purchase.winner).spice - 1);
  }
}
function transferred(f: DistransPrebidFixture, before: Game, after: Game, actions: DistransPrebidStep[] = []) {
  assert.deepEqual(distransPrebidPosition(after), distransPrebidPosition(before),
    'Transfer retains the original physical pool, index, opener, active owner, order and every wallet');
  assert.deepEqual(player(after, f.holder).hand,
    player(before, f.holder).hand.filter(card => card.id !== f.card && card.id !== f.give));
  const original = player(before, f.holder).hand.find(card => card.id === f.give)!;
  assert.deepEqual(player(after, f.recipient).hand, [...player(before, f.recipient).hand, original]);
  assert.deepEqual(after.discard, [...before.discard, player(before, f.holder).hand.find(card => card.id === f.card)!]);
  assert.equal(player(after, f.holder).hand.length, player(before, f.holder).hand.length - 2);
  assert.equal(player(after, f.recipient).hand.length, player(before, f.recipient).hand.length + 1);
  assert.equal(after.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(distransPrebidInventory(after), f.originalInventory);
  const from = actions.length;
  after = advanceDistransPrebid(after, distransPrebidClean, actions);
  assert.ok(actions.slice(from).every(step => step.action.type === 'semutaPass'),
    'Complete only the actual neutral fresh-discard controls before resuming this lot');
  assert.deepEqual(distransPrebidPosition(after), distransPrebidPosition(before));
  assert.ok(distransPrebidUntouched(after), 'The transfer does not count as the first bid or pass');
  return after;
}
function completeBid(game: Game, bidder: string, actions: DistransPrebidStep[] = []) {
  assert.ok(game.auction);
  const before = structuredClone(game), index = game.auction.index, turn = game.turn;
  const card = game.auction.cards[index].id;
  const done = finishDistransPrebidLot(game, turn, index, actions);
  assert.equal(player(done, bidder).hand.filter(held => held.id === card).length, 1);
  assert.equal(player(done, bidder).spice, player(before, bidder).spice - 1);
  assert.ok(!done.auction || done.auction.index !== index || done.turn !== turn || done.phase !== 3);
  assert.equal(done.currentAuctionSale ?? null, null);
  assert.ok(distransPrebidClean(done));
  return done;
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} genuine paid-cache Distrans transfers its original starting card before the first ordinary bid and completes that exact lot`, () => {
    const f = createDistransPrebidFixture({ advanced });
    source(f);
    const offered = viewGame(f.game, f.holder).distrans!;
    assert.equal(offered.blocked, null);
    assert.ok(offered.choices.find(choice => choice.recipient === f.recipient)!.cards.some(card => card.id === f.give));
    const before = structuredClone(f.game), actions: DistransPrebidStep[] = [];
    let game = playDistransPrebid(f, f.game, actions);
    assert.deepEqual(f.game, before);
    game = transferred(f, before, game, actions);
    rejected(game, f.holder, f.action);
    const bidder = game.auction!.active;
    game = actDistransPrebid(game, bidder, { type: 'bid', amount: 1, allyPayment: 0 }, actions);
    assert.equal(game.auction!.bid, 1);
    assert.equal(game.auction!.bidder, bidder);
    game = completeBid(game, bidder, actions);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
    assert.ok(actions.some(step => step.action.type === 'passBid'));
  });

  for (const opening of ['bid', 'passBid'] as const) {
    void test(`${mode} first real ${opening} closes Distrans until the next untouched ordinary lot`, () => {
      const f = createDistransPrebidFixture({ advanced });
      const actor = f.game.auction!.active;
      let game = actDistransPrebid(f.game, actor,
        opening === 'bid' ? { type: 'bid', amount: 1, allyPayment: 0 } : { type: 'passBid' });
      assert.equal(distransPrebidUntouched(game), false);
      assert.ok(viewGame(game, f.holder).distrans!.blocked);
      rejected(game, f.holder, f.action);
      let bidder = actor;
      if (opening === 'passBid') {
        assert.equal(game.auction!.bid, 0);
        assert.deepEqual(game.auction!.passed, [actor]);
        bidder = game.auction!.active;
        game = actDistransPrebid(game, bidder, { type: 'bid', amount: 1, allyPayment: 0 });
        rejected(game, f.holder, f.action);
      }
      game = completeBid(game, bidder);
      assert.equal(game.auction!.index, 1);
      assert.ok(distransPrebidUntouched(game));
      assert.equal(viewGame(game, f.holder).distrans!.blocked, null);
      const before = structuredClone(game);
      game = playDistransPrebid(f, game);
      game = transferred(f, before, game);
      rejected(game, f.holder, f.action);
      assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
    });
  }

  void test(`${mode} two genuine ordinary purchases fill the donor, whose two-card Distrans removal reopens real bidding capacity`, () => {
    const f = createDistransPrebidFixture({ advanced, capacity: 'donorFull' });
    source(f);
    assert.equal(f.purchases.length, 2);
    assert.equal(f.game.auction!.index, 2);
    assert.equal(player(f.game, f.holder).hand.length, handLimit(player(f.game, f.holder)));
    const before = structuredClone(f.game);
    let game = playDistransPrebid(f);
    game = transferred(f, before, game);
    assert.equal(player(game, f.holder).hand.length, 2);
    const purchased = buyDistransPrebidLot(game, f.holder);
    game = purchased.game;
    assert.equal(player(game, f.holder).hand.length, 3);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
  });

  void test(`${mode} a native last-slot active recipient keeps its opener, cannot bid when filled, can Pass, and all profiles finish the original lot`, () => {
    const f = createDistransPrebidFixture({ advanced, capacity: 'recipientLastSlot' });
    source(f);
    assert.equal(f.purchases.length, 2);
    assert.equal(f.game.auction!.index, 2);
    assert.equal(f.game.auction!.active, f.recipient);
    const before = structuredClone(f.game);
    const filled = transferred(f, before, playDistransPrebid(f));
    assert.equal(filled.auction!.active, f.recipient);
    assert.equal(filled.active, f.recipient);
    assert.equal(player(filled, f.recipient).hand.length, handLimit(player(filled, f.recipient)));
    rejected(filled, f.recipient, { type: 'bid', amount: 1, allyPayment: 0 });
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(filled, f.recipient);
      view.players.find(seat => seat.id === f.recipient)!.bot = difficulty;
      const choices = botActions(view);
      assert.ok(choices.length, `${difficulty} has an actual legal continuation`);
      assert.ok(choices.every(action => action.type !== 'bid'), `${difficulty} cannot raise with a full hand`);
      assert.equal(choices[0].type, 'passBid', `${difficulty} chooses the live Pass`);
      let game = actDistransPrebid(filled, f.recipient, choices[0]);
      assert.notEqual(game.auction!.active, f.recipient);
      assert.equal(game.auction!.bid, 0);
      assert.deepEqual(game.auction!.passed, [f.recipient]);
      const bidder = game.auction!.active, recipientSpice = player(game, f.recipient).spice;
      game = actDistransPrebid(game, bidder, { type: 'bid', amount: 1, allyPayment: 0 });
      game = completeBid(game, bidder);
      assert.equal(player(game, f.recipient).hand.length, handLimit(player(game, f.recipient)));
      // Emperor may receive the other buyer's ordinary payment, but the full
      // recipient never pays or gains a fifth physical card.
      assert.equal(player(game, f.recipient).spice,
        recipientSpice + Number(player(game, f.recipient).faction === 'emperor' && bidder !== f.recipient));
      assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
      assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
    }
  });

  void test(`${mode} an opponent's genuinely purchased full hand rejects Distrans at the native next-turn untouched lot`, () => {
    const f = createDistransPrebidFixture({ advanced, capacity: 'recipientFull' });
    source(f);
    assert.equal(f.purchases.length, 3);
    assert.equal(f.game.turn, 2);
    assert.equal(player(f.game, f.recipient).hand.length, handLimit(player(f.game, f.recipient)));
    const choice = viewGame(f.game, f.holder).distrans!.choices.find(choice => choice.recipient === f.recipient)!;
    assert.equal(choice.cards.length, 0);
    assert.ok(choice.blocked);
    rejected(f.game, f.holder, f.action);
    assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.card));
    assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.give));
    assert.equal(f.game.discard.some(card => card.id === f.card), false);
    assert.deepEqual(distransPrebidInventory(f.game), f.originalInventory);
  });

  void test(`${mode} genuine prebid source rejects self, absent targets and stale repeated custody atomically`, () => {
    const f = createDistransPrebidFixture({ advanced });
    rejected(f.game, f.holder, { ...f.action, target: f.holder });
    rejected(f.game, f.holder, { ...f.action, give: f.card });
    rejected(f.game, f.holder, { ...f.action, target: 'absent-seat' });
    rejected(f.game, f.holder, { ...f.action, give: player(f.game, f.recipient).hand[0].id });
    const game = transferred(f, f.game, playDistransPrebid(f));
    rejected(game, f.holder, f.action);
    assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
  });
}
