import assert from 'node:assert/strict';
import test from 'node:test';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { distransAuctionBlock } from '../game/distrans-timing';
import {
  actDistransPrebid, advanceDistransPrebid, distransPrebidClean,
  distransPrebidInventory, distransPrebidPlayer as player, distransPrebidPosition,
} from './fixture-distrans-prebid';
import { createDistransRichesePrebidFixture } from './fixture-distrans-richese-prebid';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => actDistransPrebid(game, actor, action));
  assert.deepEqual(game, before);
}
function firstSubmission(game: Game, amount?: number | null) {
  const lot = game.richeseAuction!;
  const actor = lot.method === 'silent'
    ? lot.order.find(id => lot.eligible.includes(id) && !Object.hasOwn(lot.sealed, id))!
    : lot.active!;
  assert.ok(actor);
  return { actor, action: { type: 'richeseBid', event: lot.event,
    amount: amount === undefined ? (lot.method === 'silent' ? 0 : null) : amount,
    allyPayment: 0 } as Action };
}

for (const advanced of [false, true]) for (const method of ['onceAround', 'silent'] as const) {
  const prefix = `${advanced ? 'Advanced' : 'Basic'} native ${method}`;
  void test(`${prefix} preserves the unbid original cache lot through a genuine Distrans transfer`, () => {
    const f = createDistransRichesePrebidFixture({ advanced, method });
    assert.equal(f.initial.status, 'lobby');
    assert.equal(f.acquisition.before.richeseCache!.some(card => card.id === f.card), true);
    assert.ok(f.acquisition.actions.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
    assert.equal(f.beforeDeclaration.turn, 2);
    assert.equal(f.beforeDeclaration.decision?.kind, 'richeseCache');
    const before = structuredClone(f.game);
    assert.equal(viewGame(before, f.holder).distrans!.blocked, null);
    assert.ok(viewGame(before, f.holder).distrans!.choices.find(c => c.recipient === f.recipient)!.cards.some(c => c.id === f.give));
    let game = actDistransPrebid(f.game, f.holder, f.action);
    assert.deepEqual(f.game, before);
    game = advanceDistransPrebid(game, distransPrebidClean);
    assert.deepEqual(distransPrebidPosition(game), distransPrebidPosition(before));
    assert.deepEqual(player(game, f.holder).hand, player(before, f.holder).hand.filter(c => c.id !== f.card && c.id !== f.give));
    assert.deepEqual(player(game, f.recipient).hand, [...player(before, f.recipient).hand,
      player(before, f.holder).hand.find(c => c.id === f.give)!]);
    assert.equal(game.discard.filter(c => c.id === f.card).length, 1);
    assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
    rejected(game, f.holder, f.action);
    const start = firstSubmission(game);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game, start.actor);
      view.players.find(p => p.id === start.actor)!.bot = difficulty;
      const action = botActions(view)[0];
      assert.equal(action?.type, 'richeseBid', `${difficulty} can act on the original lot`);
      const next = actDistransPrebid(game, start.actor, action);
      assert.ok(next.richeseAuction?.acted.includes(start.actor));
    }
    game = actDistransPrebid(game, start.actor, start.action);
    assert.ok(game.richeseAuction?.acted.includes(start.actor));
    assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
  });
  for (const first of method === 'silent' ? [0, 1] : [null, 1]) {
    void test(`${prefix} first ${first === null ? 'pass' : first === 0 ? 'sealed zero' : 'bid'} closes the Distrans window`, () => {
      const f = createDistransRichesePrebidFixture({ advanced, method });
      const start = firstSubmission(f.game, first);
      const game = actDistransPrebid(reload(f.game), start.actor, start.action);
      assert.ok(game.richeseAuction?.acted.includes(start.actor));
      assert.ok(viewGame(game, f.holder).distrans!.blocked);
      rejected(game, f.holder, f.action);
      assert.ok(player(game, f.holder).hand.some(c => c.id === f.card));
      assert.ok(player(game, f.holder).hand.some(c => c.id === f.give));
      assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
    });
  }
  void test(`${prefix} rejects a full recipient before spending either physical card`, () => {
    const f = createDistransRichesePrebidFixture({ advanced, method });
    // Controlled custody supplement: move real undealt deck cards into the
    // recipient hand. This is not claimed as an earned acquisition sequence.
    const game = structuredClone(f.game), recipient = player(game, f.recipient);
    while (recipient.hand.length < handLimit(recipient)) recipient.hand.push(game.deck.shift()!);
    assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
    const choice = viewGame(game, f.holder).distrans!.choices.find(c => c.recipient === f.recipient)!;
    assert.ok(choice.blocked);
    rejected(game, f.holder, f.action);
    assert.ok(player(game, f.holder).hand.some(c => c.id === f.card));
    assert.ok(player(game, f.holder).hand.some(c => c.id === f.give));
    assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
  });
  void test(`${prefix} fills the active recipient, automatically closes that bid and keeps an originally full donor ineligible`, () => {
    const f = createDistransRichesePrebidFixture({ advanced, method });
    // Controlled custody supplement: move only actual undealt deck cards to
    // hands. These are not claimed as earned purchases. The declaration and
    // transfer still use real actions and preserve the physical inventory.
    const staged = structuredClone(f.beforeDeclaration), donor = player(staged, f.holder);
    while (donor.hand.length < handLimit(donor)) {
      const card = staged.deck.shift(); assert.ok(card); donor.hand.push(card);
    }
    assert.deepEqual(distransPrebidInventory(staged), f.originalInventory);
    let game = actDistransPrebid(staged, staged.decision!.player, f.declaration);
    const lot = game.richeseAuction!;
    assert.ok(lot);
    assert.ok(!lot.eligible.includes(f.holder), 'The full donor was excluded at declaration');
    const recipientId = method === 'silent'
      ? lot.order.find(id => lot.eligible.includes(id) && id !== f.holder)!
      : lot.active!;
    assert.ok(recipientId && recipientId !== f.holder);
    const recipient = player(game, recipientId);
    while (recipient.hand.length < handLimit(recipient) - 1) {
      const card = game.deck.shift(); assert.ok(card); recipient.hand.push(card);
    }
    assert.equal(recipient.hand.length, handLimit(recipient) - 1);
    assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
    const originalLot = structuredClone(lot);
    const action: Action = { ...f.action, target: recipientId };
    const choice = viewGame(game, f.holder).distrans!.choices.find(c => c.recipient === recipientId)!;
    assert.ok(choice.cards.some(c => c.id === f.give));
    game = actDistransPrebid(game, f.holder, action);
    assert.equal(player(game, recipientId).hand.length, handLimit(recipient));
    assert.equal(player(game, f.holder).hand.length, handLimit(donor) - 2);
    assert.deepEqual(distransPrebidInventory(game), f.originalInventory);
    const next = game.richeseAuction!;
    assert.ok(next);
    assert.equal(next.event, originalLot.event);
    assert.equal(next.cardId, originalLot.cardId);
    assert.equal(next.source, originalLot.source);
    assert.deepEqual(next.order, originalLot.order);
    assert.deepEqual(next.eligible, originalLot.eligible);
    assert.deepEqual(next.tieOrder, originalLot.tieOrder);
    assert.ok(!next.eligible.includes(f.holder), 'Freeing space does not add a bidder to this lot');
    assert.ok(next.acted.includes(recipientId));
    if (method === 'silent') assert.equal(next.sealed[recipientId], 0);
    else assert.ok(next.passed.includes(recipientId));
    assert.ok(distransAuctionBlock(game), 'The automatic pass or zero closes the original window');
  });
}
