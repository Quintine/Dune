import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { createOriginalHarkonnenReplacement } from './fixture-harkonnen-ixian-replacement';
import { settleIxianReplacementFixture } from './fixture-nexus-ixian-replacement';

const player = (game: Game, id: string) => game.players.find(p => p.id === id)!;
function passIncome(state: Game): Game {
  let game = state;
  for (let n = 0; game.response?.kind === 'emperorIncome' && n < 10; n++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id))!;
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  return game;
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} Harkonnen replacement precedes one original cancelable purchase bonus`, () => {
    for (const replace of [false, true]) for (const cancelBonus of [false, true]) {
      const f = createOriginalHarkonnenReplacement(advanced);
      const source = f.game.pendingNexusIxianReplacement!;
      assert.equal(source.card.id, f.lot.id);
      assert.equal(player(f.game, 'h').hand.length, 3, 'No bonus is drawn before the replacement choice');
      assert.ok(viewGame(f.game, 'h').nexusIxianReplacement!.canUse);
      assert.equal(f.game.response, null);
      let game = applyAction(f.game, 'h', { type: replace ? 'nexusIxianReplacementUse' : 'nexusIxianReplacementPass', event: source.event });
      assert.equal(player(game, 'h').hand.some(c => c.id === f.lot.id), !replace);
      assert.equal(player(game, 'h').hand.some(c => c.id === f.next.id), replace);
      game = passIncome(game);
      assert.equal(game.response?.kind, 'harkonnenBonus');
      assert.equal(player(game, 'h').hand.length, 3);
      const bonus = replace ? f.afterNext : f.next;
      assert.ok(bonus);
      if (cancelBonus) {
        const counter = player(game, f.counter).hand.find(c => c.effect === 'karama')!;
        game = applyAction(game, f.counter, { type: 'card', card: counter.id, mode: 'cancel' });
      }
      game = settleIxianReplacementFixture(game);
      assert.equal(player(game, 'h').hand.length, cancelBonus ? 3 : 4);
      assert.equal(player(game, 'h').hand.some(c => c.id === bonus.id), !cancelBonus);
      assert.equal(player(game, 'h').spice, player(f.beforeBid, 'h').spice - 2);
      assert.equal(player(game, 'e').spice, player(f.beforeBid, 'e').spice + 2);
      assert.equal(game.nexusCards!.cards!.hands.h, replace ? null : 'ixians');
      assert.equal(game.nexusIxianReplacementHistory!.length, 2);
      assert.equal(game.nexusIxianReplacementHistory!.at(-1)!.source.card.id, f.lot.id);
      assert.equal(game.pendingNexusIxianReplacement, null);
    }
  });
}

void test('Harkonnen replacement at eight cards cannot manufacture a purchase-bonus slot', () => {
  for (const advanced of [false, true]) for (const replace of [false, true]) {
    const f = createOriginalHarkonnenReplacement(advanced);
    const parent = structuredClone(f.beforePurchase), owner = player(parent, 'h');
    // CONTROLLED capacity boundary: conserve original undealt cards into
    // Harkonnen custody without changing the actual auction, money or Nexus.
    while (owner.hand.length < 7) {
      const index = parent.deck.findIndex(c => c.effect !== 'karama'); assert.ok(index >= 0);
      owner.hand.push(parent.deck.splice(index, 1)[0]);
    }
    let game = applyAction(parent, f.actor, f.purchaseAction);
    assert.equal(player(game, 'h').hand.length, 8);
    const count = game.deck.length;
    const source = game.pendingNexusIxianReplacement!; assert.equal(source.card.id, f.lot.id);
    game = settleIxianReplacementFixture(applyAction(game, 'h',
      { type: replace ? 'nexusIxianReplacementUse' : 'nexusIxianReplacementPass', event: source.event }));
    assert.equal(player(game, 'h').hand.length, 8);
    assert.equal(game.deck.length, count - Number(replace));
    assert.equal(player(game, 'h').hand.some(c => c.id === f.lot.id), !replace);
    assert.equal(player(game, 'h').spice, owner.spice - 2);
    assert.equal(game.nexusIxianReplacementHistory!.length, 2);
  }
});
