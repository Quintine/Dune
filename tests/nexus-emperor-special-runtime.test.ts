import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { quoteEmperorNexusSpecialPurchase } from '../game/nexus-emperor-purchase';
import { createNexusEmperorSellerFixture } from './fixture-nexus-emperor-seller';
import {
  advanceNexusEmperorSpecial, createNexusEmperorSpecialFixture, nexusEmperorSpecialCards,
  nexusEmperorSpecialClean, nexusEmperorSpecialInventory, nexusEmperorSpecialPlayer,
  nextNexusEmperorSpecialStep, stepNexusEmperorSpecial, type NexusEmperorSpecialFixture,
} from './fixture-nexus-emperor-special';

function purchase(f: NexusEmperorSpecialFixture, joint: boolean): Action {
  return { type: 'card', mode: 'special', card: f.activation, acquire: f.acquire,
    ...(joint ? { emperorNexus: true, nexusEvent: f.event } : {}) };
}
function rejectsUnchanged(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejection must precede either card disposal, payment or physical acquisition');
}
function assertPurchase(f: NexusEmperorSpecialFixture, game: Game, joint: boolean): void {
  const own = nexusEmperorSpecialPlayer(game, f.owner), before = nexusEmperorSpecialPlayer(f.game, f.owner);
  assert.equal(own.spice, f.wallets[f.owner] - (joint ? 0 : 3));
  for (const rival of game.players.filter(p => p.id !== f.owner)) assert.equal(rival.spice, f.wallets[rival.id]);
  assert.equal(own.hand.length, before.hand.length, 'One spent physical Karama opens exactly one native hand slot');
  assert.equal(own.hand.filter(c => c.id === f.acquire).length, 1);
  assert.equal(own.hand.some(c => c.id === f.activation), false);
  assert.equal(game.discard.filter(c => c.id === f.activation).length, 1);
  assert.ok(before.hand.filter(c => c.id !== f.activation).every(c => own.hand.some(held => held.id === c.id)));
  assert.equal(game.richeseCache!.length, f.game.richeseCache!.length - 1);
  assert.equal(game.richeseCache!.some(c => c.id === f.acquire), false);
  assert.equal(own.specialKaramaUsed, true);
  assert.equal(game.nexusCards!.cards!.hands[f.owner], joint ? null : 'emperor');
  assert.equal(game.nexusCards!.cards!.discard.filter(c => c === 'emperor').length, joint ? 1 : 0);
  assert.equal(game.pendingRichesePurchaseIncome ?? null, null);
  assert.equal(game.response?.kind === 'richesePurchaseIncome', false);
  assert.equal(game.response?.kind === 'harkonnenBonus', false);
  assert.deepEqual(game.auction, f.game.auction);
  assert.deepEqual(game.richeseAuction, f.game.richeseAuction);
  assert.deepEqual(game.currentAuctionSale, f.game.currentAuctionSale);
  assert.deepEqual(game.decision, f.game.decision);
  assert.deepEqual(game.response, f.game.response);
  assert.equal(game.active, f.game.active);
  assert.deepEqual(game.movementRemaining, f.game.movementRemaining);
  assert.deepEqual(game.players.map(p => [p.id, p.forces, p.reserves, p.shipped, p.moved]),
    f.game.players.map(p => [p.id, p.forces, p.reserves, p.shipped, p.moved]));
  assert.deepEqual(nexusEmperorSpecialCards(game), nexusEmperorSpecialCards(f.game));
  nexusEmperorSpecialInventory(game);
  if (joint) {
    assert.equal(game.nexusEmperorPurchaseEvents!.filter(event => event === f.event).length, 1);
  } else {
    assert.deepEqual(game.nexusEmperorPurchaseHistory ?? [], f.game.nexusEmperorPurchaseHistory ?? []);
    assert.deepEqual(game.nexusEmperorPurchaseEvents ?? [], f.game.nexusEmperorPurchaseEvents ?? []);
  }
}


for (const phase of [2, 4, 5] as const) void test(
  `original phase ${phase} owner action: Pay 3 versus Karama + Emperor Nexus keep 3, with the same native successor`, () => {
    const f = createNexusEmperorSpecialFixture({ phase }), original = structuredClone(f.game);
    const own = viewGame(f.game, f.owner).richeseSpecialKarama!;
    assert.equal(own.blocked, null); assert.equal(own.emperorNexus.canUse, true);
    assert.equal(own.emperorNexus.blocked, null);
    for (const rival of f.game.players.filter(p => p.id !== f.owner)) {
      const view = viewGame(f.game, rival.id);
      assert.equal(view.richeseSpecialKarama, null);
      assert.equal(view.players.find(p => p.id === f.owner)!.hand, undefined);
    }
    const outcomes = [false, true].map(joint => {
      const game = stepNexusEmperorSpecial(f.game, { actor: f.owner, action: purchase(f, joint) });
      assertPurchase(f, game, joint);
      rejectsUnchanged(game, f.owner, purchase(f, joint));
      const next = stepNexusEmperorSpecial(game, nextNexusEmperorSpecialStep(game));
      assert.equal(nexusEmperorSpecialPlayer(next, f.owner).hand.filter(c => c.id === f.acquire).length, 1);
      assert.equal(next.discard.filter(c => c.id === f.activation).length, 1);
      nexusEmperorSpecialInventory(next);
      return next;
    });
    assert.deepEqual(f.game, original);
    assert.equal(outcomes[0].active, outcomes[1].active);
    assert.deepEqual(outcomes[0].decision, outcomes[1].decision);
    assert.deepEqual(outcomes[0].movementRemaining, outcomes[1].movementRemaining);
  },
);

void test('wrong owner, stale or coerced fields and unpaired Nexus fields fail before either original cost', () => {
  const f = createNexusEmperorSpecialFixture(), valid = purchase(f, true);
  for (const rival of f.game.players.filter(p => p.id !== f.owner)) rejectsUnchanged(f.game, rival.id, valid);
  for (const action of [
    { ...valid, nexusEvent: 'stale' }, { ...valid, nexusEvent: 1 },
    { ...valid, nexusEvent: null }, { ...valid, nexusEvent: '' },
    { ...valid, emperorNexus: 'true' }, { ...valid, emperorNexus: 1 },
    { ...valid, emperorNexus: false }, { ...valid, emperorNexus: null },
    { type: 'card', mode: 'special', card: f.activation, acquire: f.acquire, emperorNexus: true },
    { type: 'card', mode: 'special', card: f.activation, acquire: f.acquire, nexusEvent: f.event },
    { ...valid, card: f.acquire }, { ...valid, acquire: f.activation },
    { type: 'nexusEmperorPurchase', event: f.event },
    { type: 'nexusEmperorSellerPurchase', event: f.event, use: true },
  ]) rejectsUnchanged(f.game, f.owner, action);
  const seller = createNexusEmperorSellerFixture({ advanced: true, winnerFaction: 'richese' });
  rejectsUnchanged(f.game, f.owner, { ...valid, nexusEvent: seller.event });
  nexusEmperorSpecialInventory(f.game);
});

void test('a real later phase invalidates the earlier joint quote without consuming the owner entitlement', () => {
  const f = createNexusEmperorSpecialFixture();
  const game = advanceNexusEmperorSpecial(f.game, g => g.turn === 2 && g.phase === 4 && nexusEmperorSpecialClean(g));
  assert.equal(game.nexusCards!.cards!.hands[f.owner], 'emperor');
  assert.ok(nexusEmperorSpecialPlayer(game, f.owner).hand.some(c => c.id === f.activation));
  rejectsUnchanged(game, f.owner, purchase(f, true));
  const event = viewGame(game, f.owner).richeseSpecialKarama!.emperorNexus.event;
  assert.notEqual(event, f.event);
  const next = stepNexusEmperorSpecial(game, { actor: f.owner, action: { ...purchase(f, true), nexusEvent: event } });
  assert.equal(nexusEmperorSpecialPlayer(next, f.owner).spice, nexusEmperorSpecialPlayer(game, f.owner).spice);
  assert.equal(next.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(nexusEmperorSpecialPlayer(next, f.owner).hand.filter(c => c.id === f.acquire).length, 1);
  nexusEmperorSpecialInventory(next);
});

void test('the physical cache card reserved in a real original lot cannot be acquired through the joint action', () => {
  const f = createNexusEmperorSpecialFixture();
  let game = advanceNexusEmperorSpecial(f.game, g => g.decision?.kind === 'richeseCache' && !g.phaseOpening && !g.response);
  game = stepNexusEmperorSpecial(game, { actor: f.owner, action: { type: 'decision',
    event: game.richeseBidding!.event, card: f.acquire, method: 'onceAround', direction: 'counterclockwise' } });
  game = advanceNexusEmperorSpecial(game, nexusEmperorSpecialClean);
  assert.equal(game.richeseAuction!.cardId, f.acquire);
  const event = quoteEmperorNexusSpecialPurchase(game, f.owner).event;
  rejectsUnchanged(game, f.owner, { ...purchase(f, true), nexusEvent: event });
  assert.equal(game.nexusCards!.cards!.hands[f.owner], 'emperor');
  assert.equal(game.discard.some(c => c.id === f.activation), false);
  assert.ok(game.richeseCache!.some(c => c.id === f.acquire));
  nexusEmperorSpecialInventory(game);
});

void test('the irrelevant real closing Guild draw preserves ordinary Pay 3 and never grants joint retention', () => {
  const f = createNexusEmperorSpecialFixture({ nexusCard: 'guild' });
  const own = viewGame(f.game, f.owner).richeseSpecialKarama!;
  assert.equal(own.blocked, null);
  assert.equal(own.emperorNexus.canUse, false);
  rejectsUnchanged(f.game, f.owner, purchase(f, true));
  const game = stepNexusEmperorSpecial(f.game, { actor: f.owner, action: purchase(f, false) });
  assert.equal(nexusEmperorSpecialPlayer(game, f.owner).spice, f.wallets[f.owner] - 3);
  assert.equal(game.nexusCards!.cards!.hands[f.owner], 'guild');
  assert.equal(game.nexusCards!.cards!.discard.filter(c => c === 'guild').length, 0);
  assert.equal(nexusEmperorSpecialPlayer(game, f.owner).hand.filter(c => c.id === f.acquire).length, 1);
  assert.equal(game.discard.filter(c => c.id === f.activation).length, 1);
  nexusEmperorSpecialInventory(game);
});

void test('genuine Basic setup and closing Emperor draw do not unlock the Advanced native special power', () => {
  const f = createNexusEmperorSpecialFixture({ advanced: false });
  assert.equal(f.game.nexusCards!.cards!.hands[f.owner], 'emperor');
  assert.equal(viewGame(f.game, f.owner).richeseSpecialKarama, null);
  for (const joint of [false, true]) rejectsUnchanged(f.game, f.owner, purchase(f, joint));
  nexusEmperorSpecialInventory(f.game);
});

for (const lastCache of [false, true]) void test(
  `native full-hand ${lastCache ? 'final-cache' : 'remaining-cache'} exchange uses genuine acquired cards, preserves original capacity and once-use`, () => {
    const f = createNexusEmperorSpecialFixture({ fullHand: true, lastCache });
    assert.equal(nexusEmperorSpecialPlayer(f.game, f.owner).hand.length, handLimit(nexusEmperorSpecialPlayer(f.game, f.owner)));
    if (lastCache) {
      assert.equal(f.game.richeseCache!.length, 1);
      assert.equal(f.game.richeseRemoved!.length, 8);
      for (const transition of f.chronology.cacheResolutions) {
        assert.equal(transition.after.richeseCache!.length, transition.before.richeseCache!.length - 1);
        assert.deepEqual(nexusEmperorSpecialCards(transition.after), nexusEmperorSpecialCards(transition.before));
      }
    }
    for (const joint of [false, true]) {
      const game = stepNexusEmperorSpecial(f.game, { actor: f.owner, action: purchase(f, joint) });
      assertPurchase(f, game, joint);
      assert.equal(nexusEmperorSpecialPlayer(game, f.owner).hand.length, handLimit(nexusEmperorSpecialPlayer(game, f.owner)));
      if (lastCache) assert.equal(game.richeseCache!.length, 0);
      rejectsUnchanged(game, f.owner, purchase(f, joint));
    }
  },
);

void test('projected Easy policy executes the actual native owner acquisition with only its own original entitlement', () => {
  for (const nexusCard of ['emperor', 'guild'] as const) {
    const f = createNexusEmperorSpecialFixture({ nexusCard, sellerIncome: true });
    const view = viewGame(f.game, f.owner);
    view.players.find(p => p.id === f.owner)!.bot = 'Easy';
    const action = botActions(view)[0]; assert.ok(action);
    const game = stepNexusEmperorSpecial(f.game, { actor: f.owner, action });
    assert.equal(nexusEmperorSpecialPlayer(game, f.owner).hand.filter(c => c.id === f.acquire).length, 1);
    assert.equal(game.discard.filter(c => c.id === f.activation).length, 1);
    assert.equal(nexusEmperorSpecialPlayer(game, f.owner).specialKaramaUsed, true);
    assert.equal(nexusEmperorSpecialPlayer(game, f.owner).spice, f.wallets[f.owner] - (nexusCard === 'emperor' ? 0 : 3));
    assert.equal(game.nexusCards!.cards!.hands[f.owner], nexusCard === 'emperor' ? null : 'guild');
    assert.equal(game.active, f.game.active);
    for (const rival of game.players.filter(p => p.id !== f.owner)) assert.equal(rival.spice, f.wallets[rival.id]);
    nexusEmperorSpecialInventory(game);
  }
});

void test('joint acquisition continues through the next actual turn without repeating either spend or acquisition', () => {
  const f = createNexusEmperorSpecialFixture();
  let game = stepNexusEmperorSpecial(f.game, { actor: f.owner, action: purchase(f, true) });
  game = advanceNexusEmperorSpecial(game, g => g.turn === 3 && g.phase === 2 && nexusEmperorSpecialClean(g));
  assert.equal(game.discard.filter(c => c.id === f.activation).length, 1);
  assert.equal(game.nexusCards!.cards!.discard.filter(c => c === 'emperor').length, 1);
  assert.equal(game.nexusEmperorPurchaseEvents!.filter(event => event === f.event).length, 1);
  assert.equal(nexusEmperorSpecialPlayer(game, f.owner).hand.filter(c => c.id === f.acquire).length, 1);
  assert.equal(nexusEmperorSpecialPlayer(game, f.owner).specialKaramaUsed, true);
  assert.equal(viewGame(game, f.owner).richeseSpecialKarama, null);
  nexusEmperorSpecialInventory(game);
});
