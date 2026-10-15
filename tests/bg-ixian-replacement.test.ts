import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { createOriginalBgIxianReplacement, allowBgIxianConversion } from './fixture-bg-ixian-replacement';
import { settleIxianReplacementFixture } from './fixture-nexus-ixian-replacement';

for (const use of ['purchase', 'auctionPayment'] as const) {
  void test(`native BG ${use} gives the exact purchased card its independent Ixian replacement without another fee`, () => {
    const f = createOriginalBgIxianReplacement(use);
    const game = allowBgIxianConversion(f.game);
    const offer = viewGame(game, f.buyer).nexusIxianReplacement;
    assert.ok(offer?.canUse);
    assert.equal(offer.purchased?.id, f.lot.id);
    assert.equal(game.pendingNexusIxianReplacement?.free, true);
    assert.equal(game.pendingNexusIxianReplacement?.amount, use === 'purchase' ? 0 : 2);
    const before = f.beforeCost.players.find(p => p.id === f.buyer)!;
    const emperorSpice = f.beforeCost.players.find(p => p.faction === 'emperor')!.spice;
    for (const replace of [false, true]) {
      const done = settleIxianReplacementFixture(applyAction(game, f.buyer,
        { type: replace ? 'nexusIxianReplacementUse' : 'nexusIxianReplacementPass', event: offer.event }));
      const owner = done.players.find(p => p.id === f.buyer)!;
      assert.equal(owner.spice, before.spice);
      assert.equal(done.players.find(p => p.faction === 'emperor')!.spice, emperorSpice);
      assert.equal(owner.hand.some(c => c.id === f.cost.id), false);
      assert.equal(done.discard.filter(c => c.id === f.cost.id).length, 1);
      assert.equal(owner.hand.some(c => c.id === f.lot.id), !replace);
      assert.equal(owner.hand.some(c => c.id === f.next.id), replace);
      assert.equal(done.discard.filter(c => c.id === f.lot.id).length, replace ? 1 : 0);
      assert.equal(done.nexusCards!.cards!.hands[f.buyer], replace ? null : 'ixians');
      assert.equal(done.nexusCards!.cards!.discard.filter(c => c === 'ixians').length, replace ? 1 : 0);
      assert.equal(done.nexusIxianReplacementHistory!.length, 2);
      assert.equal(done.nexusIxianReplacementHistory!.at(-1)!.source.card.id, f.lot.id);
      assert.equal(done.pendingKarama, null);
      assert.equal(done.pendingNexusIxianReplacement, null);
      assert.equal(done.auction!.index, f.beforeCost.auction!.index + 1);
    }
  });

  void test(`canceled native BG ${use} preserves the native unpurchased lot or funded payment`, () => {
    const f = createOriginalBgIxianReplacement(use);
    const parent = structuredClone(f.beforeCost);
    const owner = parent.players.find(p => p.id === f.buyer)!;
    const emperor = parent.players.find(p => p.faction === 'emperor')!;
    // CONTROLLED counter custody only: move the conserved unused starting
    // Karama to Emperor, leaving native auctions, wallets and Nexus untouched.
    const index = owner.hand.findIndex(c => c.effect === 'karama'); assert.ok(index >= 0);
    const counter = owner.hand.splice(index, 1)[0]; emperor.hand.push(counter);
    const balance = owner.spice;
    let game = applyAction(parent, f.buyer, f.action);
    assert.equal(game.response?.kind, 'worthlessKarama');
    assert.equal(game.pendingNexusIxianReplacement, null);
    game = applyAction(game, emperor.id, { type: 'card', card: counter.id, mode: 'cancel' });
    game = settleIxianReplacementFixture(game);
    if (use === 'purchase') {
      assert.equal(game.pendingNexusIxianReplacement, null);
      assert.equal(game.nexusIxianReplacementHistory!.length, 1);
      assert.equal(game.nexusCards!.cards!.hands[f.buyer], 'ixians');
      assert.equal(game.players.find(p => p.id === f.buyer)!.spice, balance);
      assert.equal(game.players.find(p => p.id === f.buyer)!.hand.some(c => c.id === f.lot.id), false);
      assert.equal(game.auction!.cards[game.auction!.index].id, f.lot.id);
    } else {
      // The native winning-bid fallback automatically pays a funded bid;
      // that real paid purchase, not the denied free benefit, earns the choice.
      const source = game.pendingNexusIxianReplacement!;
      assert.equal(source.free, false);
      assert.equal(source.amount, 2);
      assert.equal(source.card.id, f.lot.id);
      assert.equal(game.players.find(p => p.id === f.buyer)!.spice, balance - 2);
      game = settleIxianReplacementFixture(applyAction(game, f.buyer,
        { type: 'nexusIxianReplacementUse', event: source.event }));
      assert.equal(game.players.find(p => p.id === f.buyer)!.spice, balance - 2);
      assert.equal(game.players.find(p => p.faction === 'emperor')!.spice, emperor.spice + 2);
      assert.equal(game.players.find(p => p.id === f.buyer)!.hand.some(c => c.id === f.next.id), true);
      assert.equal(game.nexusCards!.cards!.hands[f.buyer], null);
    }
    assert.equal(game.discard.filter(c => c.id === f.cost.id).length, 1);
    assert.equal(game.discard.filter(c => c.id === counter.id).length, 1);
  });
}
