import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  advanceNexusEmperorSeller, createNexusEmperorSellerFixture, nexusEmperorSellerCards,
  nexusEmperorSellerInventory, nexusEmperorSellerPlayer, nextNexusEmperorSellerStep,
  stepNexusEmperorSeller, type NexusEmperorSellerFixture,
} from './fixture-nexus-emperor-seller';

function rejectsUnchanged(game: Game, actor: string, action: Action): void {
  const original = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, original, 'Refusal must precede spending or native lot mutation');
}
function finishOriginalLot(f: NexusEmperorSellerFixture, game: Game): { game: Game; bonuses: number } {
  let bonuses = 0;
  let inBonus = false;
  for (let n = 0; n < 100; n++) {
    if (!game.richeseAuction && !game.currentAuctionSale) return { game, bonuses };
    const bonus = game.response?.kind === 'harkonnenBonus';
    if (bonus && !inBonus) bonuses++;
    inBonus = bonus;
    assert.ok(!game.decision, 'The original paid/free acquisition cannot reopen buyer confirmation');
    game = stepNexusEmperorSeller(game, nextNexusEmperorSellerStep(game));
  }
  throw Error(`Original ${f.source} acquisition did not reach its source successor`);
}
const scenarios = [
  { advanced: false, source: 'cache' as const },
  { advanced: true, source: 'cache' as const },
  { advanced: true, source: 'blackMarket' as const },
];

for (const scenario of scenarios) for (const use of [false, true]) void test(
  `${scenario.advanced ? 'Advanced' : 'Basic'} original ${scenario.source}: ${use ? 'retain spice without seller income' : 'ordinary paid seller income'} and native Harkonnen bonus once`, () => {
    const f = createNexusEmperorSellerFixture(scenario), original = structuredClone(f.game);
    const offer = viewGame(f.game, f.winner).nexusEmperorSellerPurchase!;
    assert.equal(offer.canUse, true); assert.equal(offer.blocked, null);
    for (const rival of f.game.players.filter(player => player.id !== f.winner))
      assert.equal(viewGame(f.game, rival.id).nexusEmperorSellerPurchase, null);
    const action = { type: 'nexusEmperorSellerPurchase', event: f.event, use };
    let game = stepNexusEmperorSeller(f.game, { actor: f.winner, action });
    assert.deepEqual(f.game, original);
    assert.equal(nexusEmperorSellerPlayer(game, f.winner).spice, f.wallets[f.winner] - (use ? 0 : f.price));
    assert.equal(nexusEmperorSellerPlayer(game, f.winner).hand.filter(card => card.id === f.card.id).length, 1);
    assert.equal(game.response?.kind, 'harkonnenBonus', 'The existing native bonus cancellation boundary must remain');
    assert.equal(game.currentAuctionSale!.origin, f.source);
    assert.equal(game.currentAuctionSale!.free, use);
    if (use) {
      assert.equal(game.currentAuctionSale!.richeseContribution, undefined);
      assert.equal(game.currentAuctionSale!.spiceBankerIncomePayment, undefined);
      assert.equal(game.currentAuctionSale!.bureaucratPayment, undefined);
      assert.equal(game.currentAuctionSale!.bureaucratPaymentEvent, undefined);
    }
    assert.equal(game.currentAuctionSale!.seller, f.seller);
    assert.equal(game.richeseAuction!.event, f.lot);
    assert.equal(game.richeseAuction!.cardId, f.card.id);
    assert.deepEqual(game.richeseAuction!.outcome, original.richeseAuction!.outcome);
    assert.equal(game.pendingNexusEmperorSellerPurchase, null);
    assert.equal(game.nexusCards!.cards!.hands[f.winner], use ? null : 'emperor');
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, use ? 1 : 0);
    assert.equal(nexusEmperorSellerPlayer(game, f.seller).spice, f.wallets[f.seller] + (use ? 0 : f.price));
    for (const rival of game.players.filter(player => player.id !== f.winner && player.id !== f.seller))
      assert.equal(rival.spice, f.wallets[rival.id], 'There is no bank-funded substitute income');
    const bonusCard = game.deck[0];
    assert.ok(bonusCard);
    const settled = finishOriginalLot(f, game);
    game = settled.game;
    assert.equal(settled.bonuses, 1);
    assert.equal(nexusEmperorSellerPlayer(game, f.winner).hand.length,
      nexusEmperorSellerPlayer(original, f.winner).hand.length + 2);
    assert.equal(nexusEmperorSellerPlayer(game, f.winner).hand.filter(card => card.id === bonusCard.id).length, 1);
    assert.equal(nexusEmperorSellerPlayer(game, f.winner).hand.filter(card => card.id === f.card.id).length, 1);
    if (f.source === 'cache') {
      assert.equal(game.richeseCache!.length, original.richeseCache!.length - 1);
      assert.ok(!game.richeseCache!.some(card => card.id === f.card.id));
      assert.equal(game.richeseBidding!.stage, 'normal');
      assert.ok(game.auction, 'The original reduced ordinary pool follows the first cache lot');
    } else {
      assert.equal(nexusEmperorSellerPlayer(game, f.seller).hand.length,
        nexusEmperorSellerPlayer(original, f.seller).hand.length - 1);
      assert.deepEqual(game.richeseCache, original.richeseCache);
      assert.equal(game.richeseBidding!.blackMarketSold, true);
      assert.equal(game.decision!.kind, 'richeseDeclaration');
    }
    assert.deepEqual(nexusEmperorSellerCards(game), f.originalCards);
    nexusEmperorSellerInventory(game);
    if (use) {
      const receipt = game.nexusEmperorPurchaseHistory!.at(-1)!;
      assert.ok('version' in receipt && receipt.version === 2);
      assert.equal(receipt.afterSpice, receipt.beforeSpice);
      assert.equal(game.nexusEmperorPurchaseEvents!.filter(event => event === f.event).length, 1);
    } else {
      assert.deepEqual(game.nexusEmperorPurchaseHistory ?? [], original.nexusEmperorPurchaseHistory ?? []);
      assert.deepEqual(game.nexusEmperorPurchaseEvents ?? [], original.nexusEmperorPurchaseEvents ?? []);
    }
    rejectsUnchanged(game, f.winner, action);
  },
);

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} genuine Richese self-cache purchase retains the original bank destination without bank money`, () => {
    const f = createNexusEmperorSellerFixture({ advanced, winnerFaction: 'richese' });
    const beforeHand = nexusEmperorSellerPlayer(f.game, f.winner).hand.length;
    const original = structuredClone(f.game);
    const game = stepNexusEmperorSeller(f.game, { actor: f.winner,
      action: { type: 'nexusEmperorSellerPurchase', event: f.event, use: true } });
    assert.deepEqual(f.game, original);
    for (const player of game.players) assert.equal(player.spice, f.wallets[player.id]);
    assert.equal(nexusEmperorSellerPlayer(game, f.winner).hand.length, beforeHand + 1);
    assert.equal(nexusEmperorSellerPlayer(game, f.winner).hand.filter(card => card.id === f.card.id).length, 1);
    assert.equal(game.richeseCache!.length, f.game.richeseCache!.length - 1);
    assert.equal(game.richeseBidding!.stage, 'normal');
    assert.equal(game.response?.kind === 'emperorIncome', false);
    assert.equal(game.response?.kind === 'harkonnenBonus', false);
    nexusEmperorSellerInventory(game);
  },
);

void test('original buyer rejects stale, foreign, malformed and dual-cost actions without spending or source movement', () => {
  const f = createNexusEmperorSellerFixture({ advanced: true, source: 'blackMarket' });
  for (const rival of f.game.players.filter(player => player.id !== f.winner))
    rejectsUnchanged(f.game, rival.id, { type: 'nexusEmperorSellerPurchase', event: f.event, use: true });
  for (const action of [
    { type: 'nexusEmperorSellerPurchase', event: 'stale', use: true },
    { type: 'nexusEmperorSellerPurchase', event: f.event, use: true, price: 0 },
    { type: 'nexusEmperorSellerPurchase', event: f.event, use: true, allyPayment: 1 },
    { type: 'nexusEmperorSellerPurchase', event: f.event, use: true, card: f.card.id },
    { type: 'nexusEmperorSellerPurchase', event: f.event, use: true, cost: f.card.id },
    { type: 'nexusEmperorSellerPurchase', event: f.event, use: 'true' },
    { type: 'nexusEmperorSellerPurchase', event: f.event },
    { type: 'decision', event: f.event, use: true },
    { type: 'nexusEmperorPurchase', event: f.event },
  ]) rejectsUnchanged(f.game, f.winner, action);
  assert.equal(f.game.nexusCards!.cards!.hands[f.winner], 'emperor');
  nexusEmperorSellerInventory(f.game);
});

void test('a real Emperor holder cannot commit a personally unaffordable native seller bid', () => {
  for (const scenario of scenarios) {
    const f = createNexusEmperorSellerFixture(scenario);
    const before = f.chronology.beforeWinnerBid;
    const ownSpice = nexusEmperorSellerPlayer(before, f.winner).spice;
    assert.equal(before.nexusCards!.cards!.hands[f.winner], 'emperor');
    rejectsUnchanged(before, f.winner, { type: 'richeseBid', event: f.lot, amount: ownSpice + 1 });
    assert.equal(nexusEmperorSellerPlayer(before, f.winner).spice, ownSpice);
    assert.equal(nexusEmperorSellerPlayer(before, f.winner).hand.some(card => card.id === f.card.id), false);
    nexusEmperorSellerInventory(before);
  }
});

void test('real irrelevant closing draw has the same public buyer Pay boundary, never an Emperor spend entitlement', () => {
  const f = createNexusEmperorSellerFixture({ nexusCard: 'guild' });
  assert.equal(f.game.decision!.kind, 'nexusEmperorSellerPurchase');
  assert.equal(f.game.decision!.player, f.winner);
  assert.equal(!!viewGame(f.game, f.winner).nexusEmperorSellerPurchase?.canUse, false);
  rejectsUnchanged(f.game, f.winner, { type: 'nexusEmperorSellerPurchase', event: f.event, use: true });
  const settled = finishOriginalLot(f, stepNexusEmperorSeller(f.game, { actor: f.winner,
    action: { type: 'nexusEmperorSellerPurchase', event: f.event, use: false } })).game;
  assert.equal(nexusEmperorSellerPlayer(settled, f.winner).spice, f.wallets[f.winner] - f.price);
  assert.equal(nexusEmperorSellerPlayer(settled, f.seller).spice, f.wallets[f.seller] + f.price);
  assert.equal(settled.nexusCards!.cards!.hands[f.winner], 'guild');
  nexusEmperorSellerInventory(settled);
});

void test('naturally setup-dealt Truthtrance suspends the original seller purchase and restores its exact event before Use', () => {
  const f = createNexusEmperorSellerFixture({ advanced: true, source: 'blackMarket', truthtrance: true });
  const card = nexusEmperorSellerPlayer(f.game, 'choam').hand.find(held => held.effect === 'truthtrance');
  assert.ok(card);
  assert.ok(nexusEmperorSellerPlayer(f.chronology.afterSetup, 'choam').hand.some(held => held.id === card.id));
  let game = stepNexusEmperorSeller(f.game, { actor: 'choam', action: { type: 'card', card: card.id } });
  assert.equal(game.truthtrance!.stage, 'priority');
  assert.equal(game.pendingNexusEmperorSellerPurchase!.event, f.event);
  rejectsUnchanged(game, f.winner, { type: 'nexusEmperorSellerPurchase', event: f.event, use: true });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id))!.id;
    game = stepNexusEmperorSeller(game, { actor, action: { type: 'truthPass' } });
  }
  const name = nexusEmperorSellerPlayer(game, f.winner).hand[0].name;
  game = stepNexusEmperorSeller(game, { actor: 'choam', action: { type: 'truthAsk',
    question: { kind: 'fact', target: f.winner, fact: { kind: 'hand', name } } } });
  assert.equal(viewGame(game, f.winner).truthAnswer, 'yes');
  game = stepNexusEmperorSeller(game, { actor: f.winner, action: { type: 'truthAnswer', answer: 'yes' } });
  assert.equal(game.truthtrance, null);
  assert.equal(game.decision!.kind, 'nexusEmperorSellerPurchase');
  assert.equal(game.decision!.event, f.event);
  assert.equal(game.pendingNexusEmperorSellerPurchase!.event, f.event);
  assert.equal(nexusEmperorSellerPlayer(game, f.winner).spice, f.wallets[f.winner]);
  assert.equal(game.discard.filter(held => held.id === card.id).length, 1);
  game = finishOriginalLot(f, stepNexusEmperorSeller(game, { actor: f.winner,
    action: { type: 'nexusEmperorSellerPurchase', event: f.event, use: true } })).game;
  assert.equal(nexusEmperorSellerPlayer(game, f.winner).spice, f.wallets[f.winner]);
  assert.equal(nexusEmperorSellerPlayer(game, f.seller).spice, f.wallets[f.seller]);
  nexusEmperorSellerInventory(game);
});

void test('minimal original Easy bot can legally resolve both genuine buyer entitlements', () => {
  for (const nexusCard of ['emperor', 'guild'] as const) {
    const f = createNexusEmperorSellerFixture({ nexusCard });
    const view = viewGame(f.game, f.winner);
    view.players.find(player => player.id === f.winner)!.bot = 'Easy';
    const action = botActions(view)[0];
    assert.ok(action, 'The actual paused buyer needs a legal bot continuation');
    const game = finishOriginalLot(f, stepNexusEmperorSeller(f.game, { actor: f.winner, action })).game;
    assert.equal(nexusEmperorSellerPlayer(game, f.winner).hand.filter(card => card.id === f.card.id).length, 1);
    assert.equal(nexusEmperorSellerPlayer(game, f.winner).spice, f.wallets[f.winner] - (nexusCard === 'emperor' ? 0 : f.price));
    assert.equal(nexusEmperorSellerPlayer(game, f.seller).spice, f.wallets[f.seller] + (nexusCard === 'emperor' ? 0 : f.price));
    nexusEmperorSellerInventory(game);
  }
});

void test('a retained original receipt remains historical through the next genuine turn and closing phases', () => {
  const f = createNexusEmperorSellerFixture();
  let game = finishOriginalLot(f, stepNexusEmperorSeller(f.game, { actor: f.winner,
    action: { type: 'nexusEmperorSellerPurchase', event: f.event, use: true } })).game;
  const receipt = structuredClone(game.nexusEmperorPurchaseHistory!.at(-1));
  game = advanceNexusEmperorSeller(game, state => state.turn === 3 && state.phase === 2 &&
    !state.phaseOpening && !state.response && !state.decision);
  assert.deepEqual(game.nexusEmperorPurchaseHistory!.at(-1), receipt);
  for (const player of game.players) assert.equal(viewGame(game, player.id).turn, 3);
  nexusEmperorSellerInventory(game);
});

for (const betrayal of ['pass', 'bank'] as const) {
  void test(`original Richese reaction ${betrayal} precedes price retention without inventing a later payment`, () => {
    const f = createNexusEmperorSellerFixture({ advanced: true, betrayal });
    const before = structuredClone(f.game.players);
    assert.equal(f.game.richeseBetrayal?.completed.at(-1)?.stage, betrayal === 'bank' ? 'used' : 'passed');
    const free = stepNexusEmperorSeller(f.game, { actor: f.winner,
      action: { type: 'nexusEmperorSellerPurchase', event: f.event, use: true } });
    for (const p of free.players) assert.equal(p.spice, before.find(old => old.id === p.id)!.spice);
    const settled = finishOriginalLot(f, free);
    assert.equal(settled.bonuses, 1);
    assert.equal(nexusEmperorSellerPlayer(settled.game, f.winner).hand.filter(card => card.id === f.card.id).length, 1);
    assert.equal(settled.game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
    assert.equal(settled.game.nexusCards!.cards!.discard.filter(card => card === 'richese').length,
      betrayal === 'bank' ? 1 : 0);
    nexusEmperorSellerInventory(settled.game);
  });
}

void test('Pay after original Richese bank diversion debits the buyer but pays no seller', () => {
  const f = createNexusEmperorSellerFixture({ advanced: true, source: 'blackMarket', betrayal: 'bank' });
  const paid = stepNexusEmperorSeller(f.game, { actor: f.winner,
    action: { type: 'nexusEmperorSellerPurchase', event: f.event, use: false } });
  assert.equal(nexusEmperorSellerPlayer(paid, f.winner).spice, f.wallets[f.winner] - f.price);
  assert.equal(nexusEmperorSellerPlayer(paid, f.seller).spice, f.wallets[f.seller]);
  assert.equal(paid.nexusCards!.cards!.hands[f.winner], 'emperor');
  const settled = finishOriginalLot(f, paid);
  assert.equal(settled.bonuses, 1);
  nexusEmperorSellerInventory(settled.game);
});

void test('original Richese self-purchase discard occurs before any Emperor Nexus disposal or acquisition', () => {
  const f = createNexusEmperorSellerFixture({ advanced: true, winnerFaction: 'richese', betrayal: 'before' });
  let game = f.game;
  while (game.pendingRicheseBetrayal) {
    const receipt = game.pendingRicheseBetrayal.receipt;
    const actor = receipt.required.find(id => !receipt.passed.includes(id))!;
    game = stepNexusEmperorSeller(game, { actor, action: {
      type: actor === 'guild' ? 'richeseBetrayalUse' : 'richeseBetrayalPass', event: receipt.event,
    } });
  }
  assert.equal(game.pendingNexusEmperorSellerPurchase ?? null, null);
  assert.equal(game.nexusCards!.cards!.hands[f.winner], 'emperor');
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
  assert.equal(nexusEmperorSellerPlayer(game, f.winner).hand.some(card => card.id === f.card.id), false);
  assert.equal(game.discard.filter(card => card.id === f.card.id).length, 1);
  for (const p of game.players) assert.equal(p.spice, f.wallets[p.id]);
  nexusEmperorSellerInventory(game);
});
