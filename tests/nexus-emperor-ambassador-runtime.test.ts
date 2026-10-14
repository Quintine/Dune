import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  createNexusEmperorAmbassadorFixture, finishNexusEmperorAmbassador,
  nexusEmperorAmbassadorCards, nexusEmperorAmbassadorInventory, nexusEmperorAmbassadorPlayer,
  nextNexusEmperorAmbassadorStep, stepNexusEmperorAmbassador,
} from './fixture-nexus-emperor-ambassador';

function rejectsUnchanged(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejection must precede spending, drawing and Ambassador continuation');
}

for (const advanced of [false, true]) for (const arrival of ['shipment', 'worm'] as const) void test(
  `${advanced ? 'Advanced' : 'Basic'} original ${arrival}: Pay 3 versus Use 0 purchases the same physical card exactly once`, () => {
    const f = createNexusEmperorAmbassadorFixture({ advanced, arrival });
    const before = structuredClone(f.game), own = nexusEmperorAmbassadorPlayer(before, f.buyer);
    assert.deepEqual(f.game.deck, f.chronology.entry.deck, 'Offering confirmation cannot reserve or draw a card');
    assert.deepEqual(f.game.discard, f.chronology.entry.discard);
    assert.equal(own.hand.length, nexusEmperorAmbassadorPlayer(f.chronology.entry, f.buyer).hand.length);
    if (arrival === 'shipment') assert.equal(f.game.active, f.entrant, 'The buyer does not replace the original movement actor');
    else assert.equal(f.game.pendingAmbassador!.resume, 'wormRide');
    const offer = viewGame(f.game, f.buyer).nexusEmperorAmbassadorPurchase!;
    assert.equal(offer.canUse, true); assert.equal(offer.blocked, null);
    for (const rival of f.game.players.filter(p => p.id !== f.buyer)) {
      const view = viewGame(f.game, rival.id);
      assert.equal(view.nexusEmperorAmbassadorPurchase, null);
      assert.equal(view.players.find(p => p.id === f.buyer)!.hand, undefined);
      assert.equal(JSON.stringify(view.ambassadorEntry).includes(f.card.id), false);
    }
    const outcomes = [false, true].map(use => {
      const action = { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use };
      let game = stepNexusEmperorAmbassador(f.game, { actor: f.buyer, action });
      game = finishNexusEmperorAmbassador(game);
      assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).spice, own.spice - (use ? 0 : 3));
      assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).hand.length, own.hand.length + 1,
        'Ecaz must not receive a fabricated native Harkonnen bonus');
      assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).hand.filter(c => c.id === f.card.id).length, 1);
      assert.deepEqual(game.deck, before.deck.slice(1));
      assert.deepEqual(game.discard, before.discard);
      assert.equal(game.nexusCards!.cards!.hands[f.buyer], use ? null : 'emperor');
      assert.equal(game.nexusCards!.cards!.discard.filter(c => c === 'emperor').length, use ? 1 : 0);
      assert.equal(game.response?.kind === 'emperorIncome', false);
      assert.equal(game.auction ?? null, null); assert.equal(game.currentAuctionSale ?? null, null);
      for (const rival of game.players.filter(p => p.id !== f.buyer))
        assert.equal(rival.spice, f.wallets[rival.id], 'No seller, subsidy, reimbursement or income is invented');
      assert.deepEqual(game.players.map(p => [p.id, p.forces, p.reserves, p.shipped, p.moved]),
        before.players.map(p => [p.id, p.forces, p.reserves, p.shipped, p.moved]));
      assert.deepEqual(game.movementRemaining, before.movementRemaining);
      assert.deepEqual(nexusEmperorAmbassadorCards(game), nexusEmperorAmbassadorCards(before));
      nexusEmperorAmbassadorInventory(game);
      if (use) {
        assert.equal(game.nexusEmperorPurchaseEvents!.filter(event => event === f.event).length, 1);
      } else assert.deepEqual(game.nexusEmperorPurchaseHistory ?? [], before.nexusEmperorPurchaseHistory ?? []);
      rejectsUnchanged(game, f.buyer, action);
      return game;
    });
    assert.deepEqual(f.game, before);
    assert.deepEqual(outcomes[0].decision, outcomes[1].decision);
    assert.deepEqual(outcomes[0].wormRides, outcomes[1].wormRides);
    if (arrival === 'shipment') {
      for (const game of outcomes) {
        assert.equal(game.active, f.entrant);
        const next = stepNexusEmperorAmbassador(game, { actor: f.entrant, action: { type: 'endMovement' } });
        assert.notEqual(next.active, f.entrant);
        assert.deepEqual(next.deck, game.deck, 'The original movement successor cannot repeat the purchase');
      }
    } else {
      const steps = outcomes.map(nextNexusEmperorAmbassadorStep);
      for (const [i, game] of outcomes.entries()) {
        const next = stepNexusEmperorAmbassador(game, steps[i]);
        assert.deepEqual(next.deck, game.deck);
        assert.equal(nexusEmperorAmbassadorPlayer(next, f.buyer).hand.length, own.hand.length + 1);
      }
    }
  },
);

void test('wrong actor, stale event, extra cost fields, coerced input and original-trigger replay are atomic refusals', () => {
  const f = createNexusEmperorAmbassadorFixture();
  for (const rival of f.game.players.filter(p => p.id !== f.buyer))
    rejectsUnchanged(f.game, rival.id, { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: true });
  for (const action of [
    { type: 'nexusEmperorAmbassadorPurchase', event: 'stale', use: true },
    { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: true, price: 0 },
    { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: false, allyPayment: 3 },
    { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: true, card: f.card.id },
    { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: true, cost: f.card.id },
    { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: 'true' },
    { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: 1 },
    { type: 'nexusEmperorAmbassadorPurchase', event: f.event },
    { type: 'decision', event: f.event, use: true },
    f.chronology.trigger.step.action,
  ]) rejectsUnchanged(f.game, f.buyer, action);
  nexusEmperorAmbassadorInventory(f.game);
});

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} irrelevant original Nexus draw still opens uniform buyer Pay, never Use`, () => {
    const f = createNexusEmperorAmbassadorFixture({ advanced, nexusCard: 'guild' });
    const offer = viewGame(f.game, f.buyer).nexusEmperorAmbassadorPurchase!;
    assert.equal(offer.canUse, false);
    rejectsUnchanged(f.game, f.buyer, { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: true });
    const game = finishNexusEmperorAmbassador(stepNexusEmperorAmbassador(f.game, { actor: f.buyer,
      action: { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: false } }));
    assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).spice, f.wallets[f.buyer] - 3);
    assert.equal(game.nexusCards!.cards!.hands[f.buyer], 'guild');
    assert.deepEqual(game.deck, f.game.deck.slice(1));
    assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).hand.filter(c => c.id === f.card.id).length, 1);
    nexusEmperorAmbassadorInventory(game);
  },
);

void test('actual setup-dealt Truthtrance suspends the original Ambassador confirmation and restores the same purchase', () => {
  const f = createNexusEmperorAmbassadorFixture({ truthtrance: true });
  const card = nexusEmperorAmbassadorPlayer(f.game, 'guild').hand.find(c => c.effect === 'truthtrance');
  assert.ok(card);
  assert.ok(nexusEmperorAmbassadorPlayer(f.chronology.afterSetup, 'guild').hand.some(c => c.id === card.id));
  let game = stepNexusEmperorAmbassador(f.game, { actor: 'guild', action: { type: 'card', card: card.id } });
  assert.equal(game.truthtrance!.stage, 'priority');
  rejectsUnchanged(game, f.buyer, { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: true });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(p => !game.truthtrance!.passed.includes(p.id))!.id;
    game = stepNexusEmperorAmbassador(game, { actor, action: { type: 'truthPass' } });
  }
  const name = nexusEmperorAmbassadorPlayer(game, f.buyer).hand[0].name;
  game = stepNexusEmperorAmbassador(game, { actor: 'guild', action: { type: 'truthAsk',
    question: { kind: 'fact', target: f.buyer, fact: { kind: 'hand', name } } } });
  assert.equal(viewGame(game, f.buyer).truthAnswer, 'yes');
  game = stepNexusEmperorAmbassador(game, { actor: f.buyer, action: { type: 'truthAnswer', answer: 'yes' } });
  assert.equal(game.truthtrance, null);
  assert.ok(game.decision?.kind === 'nexusEmperorAmbassadorPurchase');
  assert.deepEqual(game.deck, f.game.deck);
  assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).spice, f.wallets[f.buyer]);
  game = finishNexusEmperorAmbassador(stepNexusEmperorAmbassador(game, { actor: f.buyer,
    action: { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: true } }));
  assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).hand.filter(c => c.id === f.card.id).length, 1);
  assert.equal(game.discard.filter(c => c.id === card.id).length, 1);
  nexusEmperorAmbassadorInventory(game);
});

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} real later alliance gives native Harkonnen buyer Pay-only and one original bonus`, () => {
    const f = createNexusEmperorAmbassadorFixture({ advanced, buyer: 'harkonnen' });
    assert.equal(nexusEmperorAmbassadorPlayer(f.game, f.buyer).ally, f.owner);
    assert.equal(nexusEmperorAmbassadorPlayer(f.game, f.owner).ally, f.buyer);
    assert.equal(viewGame(f.game, f.buyer).nexusEmperorAmbassadorPurchase!.canUse, false);
    assert.equal(viewGame(f.game, f.owner).nexusEmperorAmbassadorPurchase, null);
    for (const actor of [f.owner, f.buyer])
      rejectsUnchanged(f.game, actor, { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: true });
    const hand = nexusEmperorAmbassadorPlayer(f.game, f.buyer).hand.length;
    let game = stepNexusEmperorAmbassador(f.game, { actor: f.buyer,
      action: { type: 'nexusEmperorAmbassadorPurchase', event: f.event, use: false } });
    const bonus = f.game.deck[1]; assert.ok(bonus);
    game = finishNexusEmperorAmbassador(game);
    assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).hand.length, hand + 2);
    assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).spice, f.wallets[f.buyer] - 3);
    assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).hand.filter(c => c.id === bonus.id).length, 1);
    assert.deepEqual(game.deck, f.game.deck.slice(2));
    assert.deepEqual(game.nexusCards!.cards, f.game.nexusCards!.cards,
      'The original paid purchase must not consume another card after native alliance disposal.');
    for (const rival of game.players.filter(p => p.id !== f.buyer)) assert.equal(rival.spice, f.wallets[rival.id]);
    assert.equal(game.auction ?? null, null); assert.equal(game.currentAuctionSale ?? null, null);
    nexusEmperorAmbassadorInventory(game);
  },
);

void test('original Easy policy resolves both actual native buyer entitlements without borrowing movement control', () => {
  for (const nexusCard of ['emperor', 'guild'] as const) {
    const f = createNexusEmperorAmbassadorFixture({ nexusCard });
    const view = viewGame(f.game, f.buyer);
    view.players.find(p => p.id === f.buyer)!.bot = 'Easy';
    const action = botActions(view)[0]; assert.ok(action);
    const game = finishNexusEmperorAmbassador(stepNexusEmperorAmbassador(f.game, { actor: f.buyer, action }));
    assert.equal(game.active, f.entrant);
    assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).spice,
      f.wallets[f.buyer] - (nexusCard === 'emperor' ? 0 : 3));
    assert.equal(game.nexusCards!.cards!.hands[f.buyer], nexusCard === 'emperor' ? null : 'guild');
    assert.equal(nexusEmperorAmbassadorPlayer(game, f.buyer).hand.filter(c => c.id === f.card.id).length, 1);
    nexusEmperorAmbassadorInventory(game);
  }
});
