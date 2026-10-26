import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import {
  actBankerNativePayment as act, advanceBankerNativePayments as advance,
  bankerEcazPlacementAction as placement, bankerKaitainAction as disposal,
  bankerNativePaymentClean as clean, bankerNativePaymentDeferred as deferred,
  bankerNativePaymentInventory as inventory, bankerNativePaymentPlayer as p,
  bankerNativePaymentReload as reload, createBankerNativePaymentsFixture as fixture,
  enterBankerEcazPlacement as enterPlacement, payBankerEcazPlacement as payPlacement,
  settleBankerNativePayment as settle, type BankerNativePaymentStep,
} from './fixture-banker-native-payments';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
const sources = (game: Game, kind: 'ambassador-placement' | 'kaitain-disposal') =>
  game.spiceBankerIncome!.sources.filter(row => row.source.kind === kind);
const grants = (game: Game) => game.spiceBankerIncome!.sources.filter(row => row.grant);
function payFour(game: Game, actions: BankerNativePaymentStep[] = []) {
  game = enterPlacement(game, actions);
  for (let cost = 1; cost <= 4; cost++) {
    assert.equal(placement(game).cost, cost);
    game = payPlacement(game, actions);
  }
  return game;
}

void test('native Banker payment source retains original preview training cards Worlds and actual one-spice purchase', () => {
  const f = fixture();
  assert.deepEqual(f.afterSetup.players.map(player => player.faction), ['guild', 'ecaz', 'emperor']);
  assert.equal(f.afterSetup.advanced, false);
  assert.equal(f.assignment.owner, 'guild');
  assert.ok(p(f.afterSetup, 'guild').leaders.some(leader => leader.id === f.assignment.leader && !leader.dead));
  assert.ok(f.setupChoiceSteps.some(step => step.actor === 'guild' && step.action.type === 'leaderSkill' && step.action.skill === 'spice-banker'));
  assert.equal(f.sourceCounts.ready, f.readySteps.length);
  assert.equal(f.sourceCounts.setupChoices, f.setupChoiceSteps.length);
  assert.equal(f.sourceCounts.setup, f.setupSteps.length);
  assert.equal(f.sourceCounts.source, f.actions.length);
  assert.equal(f.game.phase, 3); assert.ok(f.game.biddingEnd);
  assert.ok(f.invoices.length >= 1 && f.invoices.every(invoice => invoice.amount === 1));
  assert.ok(f.purchased.includes(f.karama));
  assert.ok(p(f.game, 'emperor').hand.some(card => card.id === f.karama));
  assert.equal(deferred(f.game), 0);
  assert.deepEqual(inventory(f.game), f.original);
  assert.equal(f.original.cards.length, f.offered.deck.length + f.offered.players.reduce((total, player) => total + player.hand.length, 0));
});

void test('one actual high-Kaitain two-card four-spice invoice earns one deferred Banker spice', () => {
  const f = fixture(), before = p(f.game, 'emperor').spice, owner = p(f.game, 'guild').spice;
  const game = settle(act(reload(f.game), 'emperor', disposal(f.game, f.disposalCards)));
  assert.equal(p(game, 'emperor').spice, before - 4);
  assert.equal(p(game, 'guild').spice, owner);
  assert.equal(deferred(game), 1);
  assert.equal(sources(game, 'kaitain-disposal').length, 1);
  assert.deepEqual(sources(game, 'kaitain-disposal')[0].source.bankLegs, [{ payer: 'emperor', amount: 4 }]);
  assert.equal(sources(game, 'kaitain-disposal')[0].grant?.owner, 'guild');
  for (const card of f.disposalCards) {
    assert.equal(p(game, 'emperor').hand.some(held => held.id === card), false);
    assert.equal(game.discard.filter(discarded => discarded.id === card).length, 1);
  }
  assert.deepEqual(inventory(game), f.original);
});

void test('two native Kaitain one-card payments of two never aggregate into a qualifying invoice', () => {
  const f = fixture(); let game = reload(f.game);
  const before = p(game, 'emperor').spice;
  for (const card of f.disposalCards) {
    game = settle(act(game, 'emperor', disposal(game, [card])));
    assert.equal(deferred(game), 0);
  }
  assert.equal(p(game, 'emperor').spice, before - 4);
  assert.deepEqual(sources(game, 'kaitain-disposal').map(row => row.source.bankLegs),
    [[{ payer: 'emperor', amount: 2 }], [{ payer: 'emperor', amount: 2 }]]);
  assert.equal(sources(game, 'kaitain-disposal').some(row => row.grant), false);
  assert.deepEqual(inventory(game), f.original);
});

void test('rejected wrong-owner duplicate-card and stale Kaitain selections never earn or replay income', () => {
  const f = fixture(), packet = disposal(f.game, f.disposalCards);
  reject(f.game, 'guild', packet);
  reject(f.game, 'emperor', { ...packet, event: 'stale-end-of-bidding' });
  reject(f.game, 'emperor', { ...packet, cards: [f.disposalCards[0], f.disposalCards[0]] });
  assert.equal(deferred(f.game), 0);
  const game = settle(act(reload(f.game), 'emperor', packet));
  reject(game, 'emperor', packet);
  assert.equal(deferred(game), 1);
  assert.equal(sources(game, 'kaitain-disposal').length, 1);
});

void test('original Ecaz placement invoices one two and three earn nothing before the accepted fourth pays four', () => {
  const f = fixture(); let game = enterPlacement(reload(f.game));
  const ecaz = p(game, 'ecaz').spice, owner = p(game, 'guild').spice;
  for (let cost = 1; cost <= 3; cost++) {
    assert.equal(placement(game).cost, cost);
    game = payPlacement(game);
    assert.equal(deferred(game), 0);
  }
  assert.equal(p(game, 'ecaz').spice, ecaz - 6);
  assert.equal(placement(game).cost, 4);
  game = payPlacement(game);
  assert.equal(p(game, 'ecaz').spice, ecaz - 10);
  assert.equal(p(game, 'guild').spice, owner);
  assert.equal(deferred(game), 1);
  assert.deepEqual(sources(game, 'ambassador-placement').map(row => row.source.bankLegs),
    [1, 2, 3, 4].map(amount => [{ payer: 'ecaz', amount }]));
  assert.equal(sources(game, 'ambassador-placement').filter(row => row.grant).length, 1);
  assert.equal(game.ecazAmbassadors!.tokens.filter(token => token.zone === 'placed').length, 4);
  assert.deepEqual(inventory(game), f.original);
});

void test('declared fourth Ambassador cost remains unpaid and unawarded until its actual native response finishes', () => {
  const f = fixture(); let game = enterPlacement(reload(f.game));
  for (let count = 0; count < 3; count++) game = payPlacement(game);
  const next = placement(game), before = p(game, 'ecaz').spice;
  const paidSources = sources(game, 'ambassador-placement').length;
  game = act(game, 'ecaz', next.action);
  assert.equal(game.response?.kind, 'ecazPlacement');
  assert.equal(game.pendingEcazPlacement?.cost, 4);
  assert.equal(p(game, 'ecaz').spice, before);
  assert.equal(deferred(game), 0);
  assert.equal(sources(game, 'ambassador-placement').length, paidSources);
  reject(game, 'ecaz', next.action);
  assert.equal(deferred(game), 0);
  game = settle(game);
  assert.equal(p(game, 'ecaz').spice, before - 4);
  assert.equal(deferred(game), 1);
});

void test('actual printed Karama cancellation of the fourth placement pays no four-spice invoice and grants no Banker reward', () => {
  const f = fixture(); let game = enterPlacement(reload(f.game));
  for (let count = 0; count < 3; count++) game = payPlacement(game);
  const next = placement(game), before = p(game, 'ecaz').spice;
  game = act(game, 'ecaz', next.action);
  assert.equal(game.response?.kind, 'ecazPlacement');
  assert.ok(p(game, 'emperor').hand.some(card => card.id === f.karama));
  game = settle(act(game, 'emperor', { type: 'card', card: f.karama, mode: 'cancel' }));
  assert.equal(p(game, 'ecaz').spice, before);
  assert.equal(deferred(game), 0);
  assert.equal(sources(game, 'ambassador-placement').length, 3);
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === next.token)?.zone, 'supply');
  assert.equal(game.ecazAmbassadors!.tokens.filter(token => token.zone === 'placed').length, 3);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  assert.deepEqual(inventory(game), f.original);
});

void test('a paid placement cannot be repeated through an obsolete physical token declaration', () => {
  const f = fixture(); let game = enterPlacement(reload(f.game));
  for (let count = 0; count < 3; count++) game = payPlacement(game);
  const packet = placement(game).action;
  game = settle(act(game, 'ecaz', packet));
  reject(game, 'ecaz', packet);
  assert.equal(deferred(game), 1);
  assert.equal(sources(game, 'ambassador-placement').length, 4);
});

void test('Ecaz owning the actual Banker never earns normal income from its own paid placements', () => {
  const f = fixture({ banker: 'ecaz' }); const game = payFour(reload(f.game));
  assert.equal(f.assignment.owner, 'ecaz');
  assert.equal(deferred(game, 'ecaz'), 0);
  assert.equal(sources(game, 'ambassador-placement').length, 4);
  assert.equal(sources(game, 'ambassador-placement').some(row => row.grant), false);
  assert.deepEqual(inventory(game), f.original);
});

void test('actual high-Ecaz poison-discard income funds a fifth placement but only one placement reward per phase', () => {
  const f = fixture({ poisonFunding: true });
  assert.ok(f.fundingCard && f.disposalCards.includes(f.fundingCard));
  assert.ok(p(f.game, 'emperor').hand.some(card => card.id === f.fundingCard && card.kind === 'poison'));
  const initial = p(f.game, 'ecaz').spice;
  let game = settle(act(reload(f.game), 'emperor', disposal(f.game, f.disposalCards)));
  assert.equal(p(game, 'ecaz').spice, initial + 3, 'The original high-Ecaz weapon-discard benefit funds the actual later cost');
  game = payFour(game);
  const before = p(game, 'ecaz').spice;
  assert.ok(before >= 5); assert.equal(placement(game).cost, 5);
  game = payPlacement(game);
  assert.equal(p(game, 'ecaz').spice, before - 5);
  assert.equal(sources(game, 'ambassador-placement').length, 5);
  assert.equal(sources(game, 'ambassador-placement').filter(row => row.grant).length, 1);
  assert.equal(deferred(game), 2, 'One phase-three disposal and one phase-four placement award remain distinct');
  assert.equal(game.ecazAmbassadors!.tokens.filter(token => token.zone === 'placed').length, 5);
  assert.deepEqual(inventory(game), f.original);
});

void test('one actual Kaitain invoice and the next phase placement earn two unavailable spice collected once at native Mentat', () => {
  const f = fixture(), owner = p(f.game, 'guild').spice;
  let game = settle(act(reload(f.game), 'emperor', disposal(f.game, f.disposalCards)));
  game = payFour(game);
  assert.equal(deferred(game), 2); assert.equal(p(game, 'guild').spice, owner);
  assert.equal(grants(game).length, 2);
  game = advance(game, state => state.phase === 8 && !state.phaseOpening);
  assert.equal(deferred(game), 0);
  assert.deepEqual(game.spiceBankerIncome!.collections.at(-1)?.credits, [{ owner: 'guild', amount: 2 }]);
  const wallet = p(game, 'guild').spice;
  const restored = reload(game);
  assert.equal(p(restored, 'guild').spice, wallet);
  assert.deepEqual(restored.spiceBankerIncome!.collections, game.spiceBankerIncome!.collections);
  assert.deepEqual(inventory(game), f.original);
});

void test('all four minimal profiles finish real Collection into the same mandatory native Mentat credits', () => {
  const f = fixture();
  let paid = settle(act(reload(f.game), 'emperor', disposal(f.game, f.disposalCards)));
  paid = payFour(paid);
  const beforeCollection = advance(paid, state => state.phase === 7 && clean(state));
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
    let game = reload(beforeCollection), accepted = 0;
    for (let count = 0; game.phase !== 8 && count < 30; count++) {
      let progressed = false;
      for (const player of game.players) {
        const own = viewGame(game, player.id);
        own.players.find(seat => seat.id === player.id)!.bot = difficulty;
        const action = botActions(own)[0];
        if (!action) continue;
        game = act(game, player.id, action); accepted++; progressed = true; break;
      }
      assert.ok(progressed, `${difficulty} finishes its actual native Collection controls`);
    }
    assert.ok(accepted > 0); assert.equal(game.phase, 8);
    assert.equal(deferred(game), 0);
    assert.deepEqual(game.spiceBankerIncome!.collections.at(-1)?.credits, [{ owner: 'guild', amount: 2 }]);
    assert.deepEqual(inventory(game), f.original);
  }
});
