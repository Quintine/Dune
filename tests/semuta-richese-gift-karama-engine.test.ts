import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaRicheseGiftKaramaFixture as fixture,
  actSemutaRicheseGiftKarama as act, passSemutaRicheseGiftKarama as pass,
  claimSemutaRicheseGiftKarama as claim, finishSemutaRicheseGiftKarama as finish,
  advanceSemutaRicheseGiftKarama as advance, semutaRicheseGiftKaramaClean as clean,
  semutaRicheseGiftKaramaInventory as inventory, semutaRicheseGiftKaramaPlayer as player,
  type SemutaRicheseGiftKaramaFixture,
} from './fixture-semuta-richese-gift-karama';

const resources = (game: Game) => ({ players: game.players.map(p => ({ id: p.id, spice: p.spice,
  reserves: p.reserves, tanks: p.tanks, forces: p.forces, elites: p.elites, moved: p.moved, shipped: p.shipped,
  ally: p.ally, revived: p.revived })), order: game.order, active: game.active, ready: game.ready,
  turn: game.turn, phase: game.phase, movementRemaining: game.movementRemaining });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaRicheseGiftKaramaFixture) {
  assert.equal(f.game.advanced, f.advanced); assert.equal(f.setup.advanced, f.advanced);
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(f.afterSetup, f.observer).hand.some(card => card.id === f.parentCounter));
  assert.notEqual(f.cost, f.parentCounter);
  for (const acquisition of [f.semutaPurchase, f.giftPurchase]) {
    assert.equal(acquisition.price, 1);
    const bids = acquisition.steps.filter(step => step.action.type === 'richeseBid');
    assert.equal(bids.length, f.game.players.length);
    assert.equal(bids.filter(step => step.actor === f.donor && step.action.amount === 1).length, 1);
    assert.ok(bids.filter(step => step.actor !== f.donor).every(step => step.action.amount === 0));
    assert.equal(player(acquisition.before, f.donor).spice - player(acquisition.after, f.donor).spice, 1);
    assert.ok(player(acquisition.after, f.donor).hand.some(card => card.id === acquisition.card));
  }
  assert.equal(f.alliance.before.nexus, true);
  assert.deepEqual(f.alliance.steps, [
    { actor: f.donor, action: { type: 'alliance', target: f.recipient } },
    { actor: f.recipient, action: { type: 'alliance', target: f.donor } },
  ]);
  assert.equal(player(f.game, f.donor).ally, f.recipient); assert.equal(player(f.game, f.recipient).ally, f.donor);
  assert.equal(f.game.response?.kind, 'richeseGift'); assert.equal(f.game.response?.recipient, f.recipient);
  assert.equal(f.game.pendingRicheseGift?.intent.cardId, f.gift);
  assert.deepEqual(f.game.pendingRicheseGift?.resume, f.originalParent);
  assert.equal(f.game.discard.some(card => card.id === f.cost), false);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.gift));
  assert.equal(player(f.game, f.recipient).hand.some(card => card.id === f.gift), false);
  assert.equal(f.sourceActionCount, f.actions.length); assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaRicheseGiftKaramaFixture) {
  const offered = act(structuredClone(f.game), f.spender, f.action), pending = offered.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaRicheseGiftDiscard');
  assert.deepEqual(pending.batch.entries.map(entry => entry.card.id), [f.cost]);
  assert.deepEqual(pending.batch.entries.map(entry => entry.discardedBy), [f.spender]);
  assert.equal(offered.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(player(offered, f.spender).hand.some(card => card.id === f.cost), false);
  assert.deepEqual(resources(offered), resources(f.game)); assert.deepEqual(inventory(offered), f.originalInventory);
  assert.ok(offered.pendingRicheseGift, 'Original prevention waits for the used physical cost reaction');
  assert.deepEqual(offered.pendingRicheseGift.intent, f.game.pendingRicheseGift!.intent);
  assert.deepEqual(offered.pendingRicheseGift.resume, f.originalParent);
  assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
  assert.equal(offered.richeseGiftBlocked?.cards.includes(f.gift) ?? false, false);
  return offered;
}
function prevented(game: Game, f: SemutaRicheseGiftKaramaFixture, claimed: boolean) {
  const done = finish(game);
  assert.ok(!done.pendingTreacheryDiscard); assert.ok(!done.pendingRicheseGift);
  assert.deepEqual(resources(done), resources(f.game)); assert.deepEqual(inventory(done), f.originalInventory);
  assert.equal(player(done, f.donor).hand.filter(card => card.id === f.gift).length, 1);
  assert.equal(player(done, f.recipient).hand.some(card => card.id === f.gift), false);
  assert.equal(player(done, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(done, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(done.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(done, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(done.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.ok(player(done, f.observer).hand.some(card => card.id === f.parentCounter));
  assert.deepEqual(done.richeseGiftBlocked, { turn: f.game.turn, phase: f.game.phase, cards: [f.gift] });
  assert.deepEqual(done.response, f.originalParent.response); assert.deepEqual(done.decision, f.originalParent.decision);
  assert.deepEqual(done.phaseOpening, f.originalParent.phaseOpening);
  assert.deepEqual(done.pendingKarama, f.originalParent.pendingKarama);
  assert.ok(viewGame(done, f.donor).richeseGift?.cards.some(card => card.id === f.gift));
  const preserved = structuredClone(done);
  const retry = applyAction(structuredClone(done), f.donor, f.giftAction);
  assert.equal(retry.response?.kind, 'richeseGift');
  assert.equal(retry.pendingRicheseGift?.intent.cardId, f.gift);
  assert.deepEqual(done, preserved);
  return done;
}

for (const advanced of [false, true]) for (const claimed of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} genuine paid Semuta ${claimed ? 'claims' : 'passes'} the original printed Karama before allied Richese gift prevention completes`, () => {
    const f = fixture({ advanced }); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const done = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    assert.equal(player(done, f.holder).hand.length, 3);
    reject(done, f.holder, { type: 'semutaCommit', event });
    reject(done, f.spender, f.action);
  },
);

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} native normal-one purchase fills Richese to four before the Semuta singleton exchange`, () => {
    const f = fixture({ advanced, fullHand: true }); nativeSource(f);
    const normalOrder = f.normalOrder; assert.ok(normalOrder);
    assert.ok(f.actions.some(step => step.actor === f.donor && step.action.type === 'bid' && step.action.amount === 1));
    assert.ok(player(f.afterFirstBidding, f.holder).hand.some(card => card.id === normalOrder.card));
    assert.equal(player(f.game, f.holder).hand.length, 4);
    const done = prevented(claim(open(f), f.holder), f, true);
    assert.equal(player(done, f.holder).hand.length, 4);
    assert.ok(player(done, f.holder).hand.some(card => card.id === normalOrder.card));
  },
);

for (const claimed of [false, true]) void test(
  `native pending cache-purchase Emperor income survives gift-cost Semuta ${claimed ? 'claim' : 'pass'} then settles once`, () => {
    const f = fixture({ advanced: true, parent: 'emperorIncome' }); nativeSource(f);
    assert.equal(f.originalParent.response?.kind, 'emperorIncome');
    assert.equal(f.beforeGift.currentAuctionSale?.amount ?? f.beforeGift.auction?.bid, 1);
    const offered = open(f), done = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    assert.equal(done.response?.kind, 'emperorIncome');
    const before = player(done, f.recipient).spice, remaining = advance(done, clean);
    assert.equal(player(remaining, f.recipient).spice, before + 1);
    assert.ok(!remaining.pendingRicheseGift); assert.ok(!remaining.pendingTreacheryDiscard);
    assert.equal(player(remaining, f.donor).hand.filter(card => card.id === f.gift).length, 1);
    assert.equal(player(remaining, f.recipient).hand.some(card => card.id === f.gift), false);
    assert.deepEqual(remaining.richeseGiftBlocked, done.richeseGiftBlocked);
    assert.deepEqual(inventory(remaining), f.originalInventory);
  },
);

void test('all four minimal profiles legally answer the exact original Richese-gift Karama discard in both rule bands', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass'); assert.equal(action.event, event);
      let done = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (done.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(done, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        done = act(done, f.holder, selected);
      } else if (done.pendingTreacheryDiscard) done = pass(done);
      prevented(done, f, claimed);
    }
  }
});

void test('the original fresh cost rejects stale, foreign and underlying gift replies without consuming another card', () => {
  const f = fixture(), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
  reject(offered, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
  reject(offered, f.spender, { type: 'semutaCommit', event });
  reject(offered, f.spender, f.action); reject(offered, f.donor, f.giftAction);
  const done = prevented(pass(offered), f, false);
  assert.equal(done.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(done.richeseGiftBlocked!.cards.filter(card => card === f.gift).length, 1);
  assert.ok(player(done, f.holder).hand.some(card => card.id === f.semuta));
});
