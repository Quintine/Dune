import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createRicheseKaramaBetrayalFixture as fixture,
  createRicheseJointKaramaBetrayalFixture as jointFixture,
  actRicheseKaramaBetrayal as act,
  commitRicheseKaramaBetrayal as commit,
  passRicheseKaramaBetrayal as pass,
  finishRicheseKaramaBetrayal as finish,
  richeseKaramaBetrayalPlayer as player,
  richeseKaramaBetrayalInventory as inventory,
  richeseKaramaBetrayalNexusInventory as nexusInventory,
  type RicheseKaramaBetrayalFixture,
} from './fixture-richese-karama-betrayal';

const wallets = (g: Game) => Object.fromEntries(g.players.map(p => [p.id, p.spice]));
function reject(g: Game, actor: string, action: Action) {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action)); assert.deepEqual(g, before);
}
function open(f: Pick<RicheseKaramaBetrayalFixture, 'game' | 'action' | 'target' | 'origin' | 'sourceKind' |
  'card' | 'karama' | 'holder' | 'originalInventory' | 'originalNexusInventory'>) {
  const g = commit(f.game, f).game, receipt = g.pendingRicheseBetrayal?.receipt; assert.ok(receipt);
  assert.equal(receipt.invoice.source, f.sourceKind); assert.equal(receipt.invoice.card.id, f.card);
  assert.equal(receipt.invoice.buyer, f.target); assert.equal(receipt.invoice.price, f.origin === 'ordinary' ? 0 : 3);
  assert.deepEqual(wallets(g), wallets(f.game));
  assert.ok(player(g, f.target).hand.some(card => card.id === f.karama));
  assert.equal(player(g, f.target).hand.some(card => card.id === f.card), false);
  assert.equal(g.discard.some(card => card.id === f.karama), false);
  assert.equal(!!player(g, f.target).specialKaramaUsed, false);
  assert.equal(g.nexusCards!.cards!.hands[f.holder], 'richese');
  assert.equal(viewGame(g, f.holder).richeseBetrayalReaction!.canUse, true);
  assert.deepEqual(inventory(g), f.originalInventory); assert.deepEqual(nexusInventory(g), f.originalNexusInventory);
  return { game: g, event: receipt.event, use: { type: 'richeseBetrayalUse', event: receipt.event } as Action };
}
function conserved(g: Game, f: Pick<RicheseKaramaBetrayalFixture, 'originalInventory' | 'originalNexusInventory'>) {
  assert.ok(!g.pendingRicheseBetrayal); assert.equal(g.richeseBetrayal!.current, null);
  assert.deepEqual(inventory(g), f.originalInventory); assert.deepEqual(nexusInventory(g), f.originalNexusInventory);
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} ordinary Karama Richese-family veto happens before its original physical cost`, () => {
    const f = fixture({ advanced }), pending = open(f), before = wallets(f.game), index = f.game.auction!.index;
    assert.equal(f.controlledRecycle, true); assert.notEqual(f.karama, f.card);
    assert.equal(f.sourceActionCount, f.actions.length);
    const done = finish(act(pending.game, f.holder, pending.use));
    assert.deepEqual(wallets(done), before);
    assert.ok(player(done, f.target).hand.some(card => card.id === f.karama));
    assert.equal(done.discard.some(card => card.id === f.karama), false);
    assert.equal(done.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(done, f.target).hand.some(card => card.id === f.card), false);
    assert.equal(done.nexusCards!.cards!.hands[f.holder], null);
    assert.equal(done.auction!.index, index + 1); assert.ok(!done.currentAuctionSale);
    assert.equal(done.richeseBetrayal!.completed.at(-1)!.stage, 'used'); conserved(done, f);
  });

  void test(`${mode} ordinary Karama MISS spends its Nexus then the actual Karama and acquires free once`, () => {
    const f = fixture({ advanced, richeseCard: false }), pending = open(f), before = wallets(f.game);
    const done = finish(act(pending.game, f.holder, pending.use));
    assert.deepEqual(wallets(done), before);
    assert.equal(done.nexusCards!.cards!.hands[f.holder], null);
    assert.equal(done.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(player(done, f.target).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(done.discard.some(card => card.id === f.card), false);
    assert.equal(!!player(done, f.target).specialKaramaUsed, false);
    assert.equal(done.richeseBetrayal!.completed.at(-1)!.stage, 'used'); conserved(done, f);
  });

  void test(`${mode} ordinary Karama all-pass retains the Nexus and completes its native free acquisition`, () => {
    const f = fixture({ advanced }), pending = open(f), before = wallets(f.game);
    const done = finish(pass(pending.game));
    assert.deepEqual(wallets(done), before);
    assert.equal(done.nexusCards!.cards!.hands[f.holder], 'richese');
    assert.equal(done.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(player(done, f.target).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(done.richeseBetrayal!.completed.at(-1)!.stage, 'passed'); conserved(done, f);
  });
}

void test('an actual competing ordinary bid is retained unpaid through the pre-cost Karama choice', () => {
  for (const use of [false, true]) {
    const f = fixture({ advanced: true, otherBidder: true }), pending = open(f), before = wallets(f.game);
    assert.equal(f.game.auction!.bidder, f.holder); assert.equal(f.game.auction!.bid, 1);
    const done = finish(use ? act(pending.game, f.holder, pending.use) : pass(pending.game));
    assert.deepEqual(wallets(done), before);
    assert.equal(player(done, f.target).hand.some(card => card.id === f.karama), use);
    assert.equal(player(done, f.target).hand.some(card => card.id === f.card), !use);
    assert.equal(player(done, f.holder).hand.some(card => card.id === f.card), false); conserved(done, f);
  }
});

void test('native private special veto discards only the selected cache face before Karama, spice and once-use costs', () => {
  const f = fixture({ origin: 'special' }), pending = open(f), before = wallets(f.game), cache = f.game.richeseCache!;
  assert.equal(f.game.phase, 2); assert.equal(f.controlledRecycle, false);
  const done = finish(act(pending.game, f.holder, pending.use));
  assert.deepEqual(wallets(done), before);
  assert.ok(player(done, f.target).hand.some(card => card.id === f.karama));
  assert.equal(!!player(done, f.target).specialKaramaUsed, false);
  assert.equal(done.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(done.richeseCache!.map(card => card.id), cache.filter(card => card.id !== f.card).map(card => card.id));
  assert.equal(done.discard.some(card => card.id === f.karama), false);
  assert.equal(done.nexusCards!.cards!.hands[f.holder], null);
  assert.ok(!done.pendingRichesePurchaseIncome); assert.ok(!done.currentAuctionSale); conserved(done, f);
});

void test('native private special all-pass pays three, disposes the original Karama and settles native Emperor income once', () => {
  const f = fixture({ origin: 'special' }), pending = open(f), before = wallets(f.game);
  const committed = pass(pending.game);
  assert.equal(player(committed, f.target).spice, before[f.target] - 3);
  assert.equal(player(committed, f.target).specialKaramaUsed, true);
  // Spending the only opposing Karama leaves no income cancellation actor;
  // native automatic response settlement has already credited the Emperor.
  assert.ok(!committed.response); assert.ok(!committed.pendingRichesePurchaseIncome);
  assert.equal(player(committed, f.emperor).spice, before[f.emperor] + 3);
  const done = finish(committed);
  assert.equal(player(done, f.target).spice, before[f.target] - 3);
  assert.equal(player(done, f.emperor).spice, before[f.emperor] + 3);
  assert.equal(done.discard.filter(card => card.id === f.karama).length, 1);
  assert.equal(player(done, f.target).hand.filter(card => card.id === f.card).length, 1);
  assert.equal(done.richeseCache!.length, f.game.richeseCache!.length - 1);
  assert.equal(done.nexusCards!.cards!.hands[f.holder], 'richese');
  assert.ok(!done.pendingRichesePurchaseIncome); conserved(done, f);
});

for (const use of [false, true]) void test(
  `native private special ${use ? 'veto' : 'allowance'} preserves the already pending ordinary Emperor income parent`, () => {
    const f = fixture({ origin: 'special', parent: 'emperorIncome' }), pending = open(f), before = wallets(f.game);
    assert.equal(f.game.response?.kind, 'emperorIncome');
    assert.equal(f.game.currentAuctionSale?.amount ?? f.game.auction?.bid, 3);
    assert.equal(player(f.game, f.target).spice, 4);
    const committed = use ? act(pending.game, f.holder, pending.use) : pass(pending.game);
    if (use) {
      assert.deepEqual(committed.response, f.originalResponse);
      assert.equal(player(committed, f.target).spice, 4);
      assert.ok(player(committed, f.target).hand.some(card => card.id === f.karama));
      assert.equal(!!player(committed, f.target).specialKaramaUsed, false);
    } else {
      // The preceding paid auction really acquired another Karama, so the
      // child income still has a cancellation actor and saves its parent.
      assert.equal(committed.response?.kind, 'richesePurchaseIncome');
      assert.equal(committed.response?.amount, 3);
      assert.deepEqual(committed.pendingRichesePurchaseIncome!.resume.response, f.originalResponse);
      assert.equal(player(committed, f.emperor).spice, before[f.emperor]);
      assert.equal(player(committed, f.target).spice, 1);
    }
    const done = finish(committed);
    assert.equal(player(done, f.emperor).spice, before[f.emperor] + (use ? 3 : 6));
    assert.equal(player(done, f.target).spice, use ? 4 : 1);
    assert.equal(player(done, f.target).hand.some(card => card.id === f.card), !use);
    assert.equal(done.discard.filter(card => card.id === f.karama).length, Number(!use));
    assert.ok(!done.pendingRichesePurchaseIncome); conserved(done, f);
  },
);

void test('all four existing counter policies act legally on both ordinary faces and the private special source', () => {
  for (const options of [{ richeseCard: true }, { richeseCard: false }, { origin: 'special' as const }]) {
    const f = fixture(options), pending = open(f);
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(pending.game, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.ok(action.type === 'richeseBetrayalPass' || action.type === 'richeseBetrayalUse');
      assert.equal(action.event, pending.event);
      const done = finish(act(pending.game, f.holder, action)); conserved(done, f);
    }
  }
});

void test('pre-cost Karama counters reject underlying resubmission and stale owner replies without changing physical costs', () => {
  for (const origin of ['ordinary', 'special'] as const) {
    const f = fixture({ origin }), pending = open(f);
    reject(pending.game, f.target, f.action);
    reject(pending.game, f.target, pending.use);
    reject(pending.game, f.holder, { ...pending.use, event: `${pending.event}:stale` });
    const done = finish(act(pending.game, f.holder, pending.use));
    reject(done, f.holder, pending.use);
    assert.ok(player(done, f.target).hand.some(card => card.id === f.karama));
    conserved(done, f);
  }
});

for (const use of [false, true]) void test(
  `native joint Emperor-Nexus private special ${use ? 'veto preserves both original costs' : 'allowance spends both costs and retains proved spice'}`, () => {
    const f = jointFixture(), before = wallets(f.game), pending = open(f);
    assert.equal(f.controlledRecycle, false); assert.equal(f.sourceActionCount, f.actions.length);
    assert.equal(f.game.players.some(player => player.faction === 'emperor'), false);
    assert.equal(f.game.nexusCards!.cards!.hands[f.target], 'emperor');
    assert.equal(f.game.nexusCards!.cards!.hands[f.holder], 'richese');
    if (f.costAcquisition) {
      assert.ok(f.costAcquisition.steps.some(step => step.actor === f.target && step.action.card === f.karama));
      assert.ok(f.costAcquisition.steps.some(step => step.actor === f.target && step.action.keep === true));
    }
    const historyBefore = f.game.nexusEmperorPurchaseHistory?.length ?? 0;
    const done = finish(use ? act(pending.game, f.holder, pending.use) : pass(pending.game));
    assert.deepEqual(wallets(done), before);
    assert.equal(player(done, f.target).hand.some(card => card.id === f.karama), use);
    assert.equal(done.discard.filter(card => card.id === f.karama).length, Number(!use));
    assert.equal(done.nexusCards!.cards!.hands[f.target], use ? 'emperor' : null);
    assert.equal(done.nexusCards!.cards!.hands[f.holder], use ? null : 'richese');
    assert.equal(player(done, f.target).hand.filter(card => card.id === f.card).length, Number(!use));
    assert.equal(done.discard.filter(card => card.id === f.card).length, Number(use));
    assert.equal(!!player(done, f.target).specialKaramaUsed, !use);
    assert.equal(done.nexusEmperorPurchaseHistory?.length ?? 0, historyBefore + Number(!use));
    assert.ok(!done.pendingRichesePurchaseIncome); conserved(done, f);
  },
);
