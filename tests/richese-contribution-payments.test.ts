import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game, type Action } from '../game/engine';
import type { FactionId } from '../game/catalog';
import {
  initializeAdvancedNativeSkillsSetup, advancedNativePlayer, advancedNativeStep,
  advanceAdvancedNativeSkillsToPhase, rejectAdvancedNativeAction,
} from './fixture-advanced-native-skills';
import { advanceSpiceBankerIncomeToMentat } from './fixture-spice-banker-income';

type Options = {
  rules?: 'basic' | 'advanced'; source?: 'cache' | 'blackMarket';
  emperor?: boolean; buyer?: 'atreides' | 'emperor' | 'richese';
  banker?: boolean; counter?: boolean;
};
type NativeRichesePaymentFixture = {
  game: Game; seller: string; buyer: string; observer: string; counter?: string; card: string;
};
function choose(game: Game, values: Record<string, unknown>): Game {
  return applyAction(game, game.decision!.player, {
    type: 'decision', event: game.richeseBidding!.event, ...values,
  } as Action);
}
function allowOriginalResponses(state: Game): Game {
  let game = state;
  for (let i = 0; game.response && i < 100; i++) {
    const actor = game.players.find(p => p.id !== game.response!.owner && !game.response!.passed.includes(p.id));
    assert.ok(actor, 'The original counter window must retain an unpassed participant.');
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}
function prepare(options: Options = {}): NativeRichesePaymentFixture {
  const opponents: FactionId[] = ['atreides', 'beneGesserit'];
  if (options.emperor !== false) opponents.push('emperor');
  let game = initializeAdvancedNativeSkillsSetup({
    family: 'richese', rules: options.rules ?? 'advanced', opponents,
    requestedSkill: options.banker ? 'spice-banker' : 'suk-graduate',
    skillOwner: options.banker ? 'beneGesserit' : 'richese', bankerIncome: options.banker,
  });
  const skillOwner = advancedNativePlayer(game, options.banker ? 'beneGesserit' : 'richese').id;
  const requested = options.banker ? 'spice-banker' : 'suk-graduate';
  for (let i = 0; game.status === 'setup' && i < 200; i++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const own = viewGame(game, actor).leaderSkills!;
      const skill = actor === skillOwner ? requested :
        offer.cards.find(card => card !== 'bureaucrat' && !own.unavailableSkills?.[card]);
      assert.ok(skill && offer.cards.includes(skill));
      game = applyAction(game, actor, { type: 'leaderSkill', event: offer.event, skill, leader: own.eligibleLeaders[0].id });
    } else game = advancedNativeStep(game);
  } // Choose genuine alternate offers: unresolved Bureaucrat split funding is not this rule.
  game = advanceAdvancedNativeSkillsToPhase(game, 2);
  const seller = advancedNativePlayer(game, 'richese').id;
  const buyer = advancedNativePlayer(game, options.buyer ?? 'atreides').id;
  const observer = advancedNativePlayer(game, 'beneGesserit').id;
  // Explicit controlled alliance position after original all14/native setup;
  // wallets, force inventories, skills and original starting hands stay intact.
  if (buyer !== seller) {
    game.players.find(p => p.id === seller)!.ally = buyer;
    game.players.find(p => p.id === buyer)!.ally = seller;
  }
  let counter: string | undefined;
  if (options.counter) {
    const owner = game.players.find(p => p.id === observer)!;
    let card = owner.hand.find(c => c.effect === 'karama');
    if (!card) {
      const index = game.deck.findIndex(c => c.effect === 'karama');
      if (index >= 0) card = game.deck.splice(index, 1)[0];
      else {
        const holder = game.players.find(p => p.id !== observer && p.hand.some(c => c.effect === 'karama'))!;
        assert.ok(holder, 'Transfer an existing original physical Karama, never manufacture one.');
        card = holder.hand.splice(holder.hand.findIndex(c => c.effect === 'karama'), 1)[0];
      }
      owner.hand.push(card);
    }
    counter = card.id;
  }
  for (let i = 0; game.phase === 2 && i < 100; i++) game = advancedNativeStep(game);
  assert.equal(game.phase, 3);
  if (game.advanced) {
    assert.equal(game.decision?.kind, 'richeseBlackMarket');
    if (options.source === 'blackMarket') {
      const card = game.players.find(p => p.id === seller)!.hand[0];
      assert.ok(card);
      game = choose(game, { card: card.id, method: 'silent' });
    } else game = choose(game, { decline: true });
  }
  if (options.source !== 'blackMarket') {
    assert.equal(game.decision?.kind, 'richeseDeclaration');
    game = choose(game, { position: 'first' });
    game = allowOriginalResponses(game);
    game = choose(game, { card: game.richeseCache![0].id, method: 'silent' });
  }
  // Pass only the original pre-sale counter windows. Never substitute a receipt.
  game = allowOriginalResponses(game);
  assert.ok(game.richeseAuction && !game.richeseAuction.outcome);
  return { game, seller, buyer, observer, counter, card: game.richeseAuction.cardId };
}
function bid(game: Game, actor: string, amount: number, allyPayment = 0): Game {
  return applyAction(game, actor, { type: 'richeseBid', event: game.richeseAuction!.event, amount, allyPayment });
}
function purchase(fixture: NativeRichesePaymentFixture, donation = 4, price = 8): Game {
  let game = fixture.game;
  if (donation) game = applyAction(game, fixture.seller, { type: 'pledgeAid', amount: donation });
  game = bid(game, fixture.buyer, price, donation);
  if (donation) {
    rejectAdvancedNativeAction(game, fixture.seller, { type: 'pledgeAid', amount: donation - 1 }, /Ally funding/);
    rejectAdvancedNativeAction(game, fixture.buyer, {
      type: 'richeseBid', event: game.richeseAuction!.event, amount: 1,
    }, /already submitted/);
  }
  for (const actor of game.richeseAuction!.order)
    if (actor !== fixture.buyer) game = bid(game, actor, 0);
  return game;
}
function finishResponses(state: Game): Game {
  let game = state;
  for (let i = 0; (game.response || (game.decision && !['richeseDeclaration', 'richeseCache'].includes(game.decision.kind))) && i < 200; i++)
    game = advancedNativeStep(game);
  assert.equal(game.response, null);
  return game;
}
function balance(game: Game, actor: string): number { return game.players.find(p => p.id === actor)!.spice; }
function exactCard(game: Game, buyer: string, id: string): void {
  assert.equal(game.players.find(p => p.id === buyer)!.hand.filter(c => c.id === id).length, 1);
  const physical = [
    ...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? []), ...(game.ixAuction?.cards ?? []),
  ];
  assert.equal(physical.filter(c => c.id === id).length, 1);
}

for (const source of ['cache', 'blackMarket'] as const) {
  for (const mode of ['allow', 'cancel', 'emperorBuyer'] as const) {
    void test(`Advanced native ${source}: Richese 4 plus buyer 4, Emperor ${mode}, settles card/escrow once`, () => {
      const f = prepare({ source, counter: true, buyer: mode === 'emperorBuyer' ? 'emperor' : 'atreides' });
      const before = f.game;
      const emperor = advancedNativePlayer(before, 'emperor').id;
      let game = purchase(f);
      // Seller receives ONLY the non-Richese leg; donation is not refunded.
      assert.equal(balance(game, f.seller), balance(before, f.seller));
      assert.equal(balance(game, f.buyer), balance(before, f.buyer) - 4);
      assert.equal(balance(game, emperor), balance(before, emperor) - (f.buyer === emperor ? 4 : 0));
      assert.equal(game.aid[f.seller]?.amount ?? 0, 0);
      exactCard(game, f.buyer, f.card);
      assert.equal(game.response?.kind, 'emperorIncome');
      assert.equal(game.currentAuctionSale?.richeseContribution, 4);
      if (mode === 'cancel') game = applyAction(game, f.observer, { type: 'card', card: f.counter!, mode: 'cancel' });
      game = finishResponses(game);
      assert.equal(balance(game, f.seller), balance(before, f.seller));
      assert.equal(balance(game, f.buyer), balance(before, f.buyer) - 4 + (mode !== 'cancel' && f.buyer === emperor ? 4 : 0));
      assert.equal(balance(game, emperor), balance(before, emperor) - (f.buyer === emperor ? 4 : 0) + (mode === 'cancel' ? 0 : 4));
      assert.equal(game.aid[f.seller]?.amount ?? 0, 0);
      exactCard(game, f.buyer, f.card);
      if (mode === 'cancel') assert.equal(game.discard.filter(c => c.id === f.counter).length, 1);
      if (source === 'blackMarket') {
        assert.equal(game.decision?.kind, 'richeseDeclaration');
        assert.equal(game.richeseBidding?.blackMarketSold, true);
      } else assert.ok(game.auction);
    });
  }
}

void test('Basic native cache keeps its original publisher seller receipt, not an inferred Advanced contributor rule', () => {
  const f = prepare({ rules: 'basic', counter: true });
  let game = purchase(f);
  game = finishResponses(game);
  assert.equal(balance(game, f.seller), balance(f.game, f.seller) + 4);
  assert.equal(balance(game, f.buyer), balance(f.game, f.buyer) - 4);
  const emperor = advancedNativePlayer(game, 'emperor').id;
  assert.equal(balance(game, emperor), balance(f.game, emperor));
  assert.equal(game.aid[f.seller]?.amount ?? 0, 0);
  exactCard(game, f.buyer, f.card);
});

for (const rules of ['basic', 'advanced'] as const) {
  void test(`${rules} native Richese self-cache pays bank once, with no seller refund`, () => {
    const f = prepare({ rules, emperor: false, buyer: 'richese' });
    const game = finishResponses(purchase(f, 0, 4));
    assert.equal(balance(game, f.seller), balance(f.game, f.seller) - 4);
    exactCard(game, f.buyer, f.card);
  });
}

for (const source of ['cache', 'blackMarket'] as const) {
  void test(`Advanced native ${source}: only Richese bank-routed contribution qualifies separate Banker, deferred until native Mentat`, () => {
    const f = prepare({ source, emperor: false, banker: true });
    const ownerBalance = balance(f.game, f.observer);
    let game = finishResponses(purchase(f));
    assert.equal(balance(game, f.seller), balance(f.game, f.seller));
    assert.equal(balance(game, f.buyer), balance(f.game, f.buyer) - 4);
    assert.equal(balance(game, f.observer), ownerBalance);
    assert.deepEqual(viewGame(game, f.observer).spiceBankerIncome!.deferred, [{ owner: f.observer, amount: 1 }]);
    const grants = game.spiceBankerIncome!.sources.filter(row => row.grant);
    assert.equal(grants.length, 1);
    assert.deepEqual(grants[0].source.bankLegs, [{ payer: f.seller, amount: 4 }]);
    exactCard(game, f.buyer, f.card);
    // Native phase suffix, retaining cache-first when a Black Market sale ends.
    game = advanceAdvancedNativeSkillsToPhase(game, 7);
    const beforeMentat = balance(game, f.observer);
    rejectAdvancedNativeAction(game, f.observer, { type: 'bribe', target: f.buyer, amount: beforeMentat + 1 });
    game = advanceSpiceBankerIncomeToMentat(game);
    assert.equal(balance(game, f.observer), beforeMentat + 1);
    assert.deepEqual(viewGame(game, f.observer).spiceBankerIncome!.deferred, []);
    exactCard(game, f.buyer, f.card);
  });
}

void test('Advanced Emperor contribution cancellation qualifies Banker for donor leg only, not the unrelated buyer leg', () => {
  const f = prepare({ banker: true, counter: true });
  let game = purchase(f);
  assert.equal(game.response?.kind, 'emperorIncome');
  assert.deepEqual(viewGame(game, f.observer).spiceBankerIncome!.deferred, []);
  game = applyAction(game, f.observer, { type: 'card', card: f.counter!, mode: 'cancel' });
  game = finishResponses(game);
  assert.equal(balance(game, f.seller), balance(f.game, f.seller));
  assert.equal(balance(game, f.buyer), balance(f.game, f.buyer) - 4);
  assert.deepEqual(viewGame(game, f.observer).spiceBankerIncome!.deferred, [{ owner: f.observer, amount: 1 }]);
  assert.deepEqual(game.spiceBankerIncome!.sources.find(row => row.grant)!.source.bankLegs,
    [{ payer: f.seller, amount: 4 }]);
  exactCard(game, f.buyer, f.card);
});

void test('Advanced native bank contribution below four never combines unrelated buyer-to-seller payment for Banker', () => {
  const f = prepare({ banker: true, emperor: false });
  const game = finishResponses(purchase(f, 3, 8));
  assert.equal(balance(game, f.seller), balance(f.game, f.seller) + 2);
  assert.equal(balance(game, f.buyer), balance(f.game, f.buyer) - 5);
  assert.equal(balance(game, f.observer), balance(f.game, f.observer));
  assert.deepEqual(viewGame(game, f.observer).spiceBankerIncome!.deferred, []);
  assert.equal(game.spiceBankerIncome!.sources.some(row => row.grant), false);
  exactCard(game, f.buyer, f.card);
});

void test('Advanced native allowed Emperor contribution is faction income, never Banker bank income', () => {
  const f = prepare({ banker: true, counter: true });
  const game = finishResponses(purchase(f));
  const emperor = advancedNativePlayer(game, 'emperor').id;
  assert.equal(balance(game, emperor), balance(f.game, emperor) + 4);
  assert.equal(balance(game, f.seller), balance(f.game, f.seller));
  assert.deepEqual(viewGame(game, f.observer).spiceBankerIncome!.deferred, []);
  assert.equal(game.spiceBankerIncome!.sources.some(row => row.grant), false);
  exactCard(game, f.buyer, f.card);
});
