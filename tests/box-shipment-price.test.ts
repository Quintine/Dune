import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actBoxShipmentPrice, allowBoxShipmentPrice, boxShipmentPriceInventory,
  boxShipmentPricePhysical, boxShipmentPricePlayer as player, createBoxShipmentPriceFixture,
  declareBoxShipmentPrice, finishBoxShipmentPrice, payBoxShipmentPrice,
  selectBoxShipmentPrice, stopBoxShipmentPrice, type BoxShipmentPriceFixture,
} from './fixture-box-shipment-price';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => actBoxShipmentPrice(game, actor, action));
  assert.deepEqual(game, before);
}
function originalSource(f: BoxShipmentPriceFixture) {
  assert.equal(f.game.status, 'playing');
  assert.equal(f.game.phase, 5);
  assert.equal(f.game.active, f.beneficiary);
  assert.equal(f.game.response ?? null, null);
  assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.pendingNullentropy ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(f.game.karamaShipping, f.originalGrant);
  assert.equal(f.game.karamaShipping!.card, f.karama);
  assert.equal(f.game.karamaShipping!.owner, f.creator);
  assert.equal(f.game.karamaShipping!.player, f.beneficiary);
  assert.equal(Object.hasOwn(f.game.karamaShipping!, 'costClaimed'), false);
  assert.notEqual(f.karama, f.stopKarama);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.box));
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.stopKarama));
  assert.ok(player(f.afterSetup, f.creator).hand.some(card => card.id === f.karama));
  assert.ok(f.acquisition.actions.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(f.priceAction.card, f.karama);
  assert.equal(f.priceAction.mode, 'shipment');
  assert.equal(f.game.discard.filter(card => card.id === f.karama).length, 1);
  assert.equal(f.game.discard.filter(card => card.id === f.alternative).length, f.otherCandidate ? 1 : 0);
  if (f.otherCandidate) {
    assert.ok(f.weather);
    assert.equal(f.weather.action.card, f.alternative);
    assert.equal(f.weather.action.amount, 0);
  } else assert.equal(f.weather, null);
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(boxShipmentPriceInventory(f.game), f.originalInventory);
}
function recovered(f: BoxShipmentPriceFixture, selected: string) {
  const paid = payBoxShipmentPrice(f);
  assert.equal(player(paid, f.holder).spice, player(f.game, f.holder).spice - f.boxFee);
  assert.deepEqual(paid.karamaShipping, f.originalGrant, 'Payment alone does not claim the original price cost');
  assert.ok(paid.pendingNullentropy);
  const search = viewGame(paid, f.holder).nullentropy!.search;
  assert.ok(search);
  assert.deepEqual(search.cards.map(card => card.id).sort(), [f.karama, f.alternative].sort());
  let game = selectBoxShipmentPrice(f, paid, selected);
  game = finishBoxShipmentPrice(f, game);
  assert.equal(player(game, f.holder).spice, player(f.game, f.holder).spice - f.boxFee);
  assert.ok(player(game, f.holder).hand.some(card => card.id === selected));
  assert.equal(game.discard.filter(card => card.id === f.box).length, 1);
  assert.equal(game.discard.at(-1)!.id, f.box);
  assert.equal(game.pendingNullentropy ?? null, null);
  assert.deepEqual(game.karamaShipping, { ...f.originalGrant, ...(selected === f.karama ? { costClaimed: true } : {}) });
  assert.deepEqual(boxShipmentPriceInventory(game), f.originalInventory);
  return { paid, game };
}

for (const advanced of [false, true]) {
  for (const selectedCost of [true, false]) {
    void test(`${advanced ? 'Advanced' : 'Basic'} genuine Box selects ${selectedCost ? 'active price cost' : 'other discard'} and preserves the real bank-paid shipment`, () => {
      const f = createBoxShipmentPriceFixture({ advanced });
      originalSource(f);
      if (!advanced) rejected(f.game, f.guild, { type: 'card', card: f.stopKarama, mode: 'special' });
      const selected = selectedCost ? f.karama : f.alternative;
      let { game } = recovered(f, selected);
      const before = structuredClone(player(game, f.beneficiary)), guildSpice = player(game, f.guild).spice;
      game = declareBoxShipmentPrice(f, game);
      if (advanced) {
        assert.equal(game.decision?.kind, 'guildShipment');
        assert.equal(player(game, f.beneficiary).spice, before.spice);
        assert.equal(player(game, f.beneficiary).reserves, before.reserves);
      }
      game = allowBoxShipmentPrice(f, game);
      game = finishBoxShipmentPrice(f, game);
      assert.equal(player(game, f.beneficiary).spice, before.spice - f.shipmentCost);
      assert.equal(player(game, f.beneficiary).reserves, before.reserves - f.amount);
      assert.equal(player(game, f.beneficiary).forces[f.target], f.amount);
      assert.equal(player(game, f.beneficiary).shipped, true);
      assert.equal(player(game, f.beneficiary).moved, 0);
      assert.equal(player(game, f.guild).spice, guildSpice, 'The purchased price pays the bank, without Guild income');
      assert.equal(game.karamaShipping, null);
      assert.equal(player(game, f.holder).hand.filter(card => card.id === selected).length, 1);
      rejected(game, f.beneficiary, f.shipment);
      assert.deepEqual(boxShipmentPriceInventory(game), f.originalInventory);
    });
  }

  if (advanced) void test('Advanced genuine Box recovery can spend the same price card for a Guild stop without a second refund', () => {
    const f = createBoxShipmentPriceFixture({ advanced });
    originalSource(f);
    let { game } = recovered(f, f.karama);
    const before = structuredClone(player(game, f.beneficiary)), guildSpice = player(game, f.guild).spice;
    game = declareBoxShipmentPrice(f, game);
    game = stopBoxShipmentPrice(f, game, f.karama);
    game = finishBoxShipmentPrice(f, game);
    assert.equal(player(game, f.beneficiary).spice, before.spice);
    assert.equal(player(game, f.beneficiary).reserves, before.reserves);
    assert.deepEqual(player(game, f.beneficiary).forces, before.forces);
    assert.equal(player(game, f.beneficiary).shipped, true);
    assert.equal(player(game, f.beneficiary).moved, 0);
    assert.equal(player(game, f.guild).spice, guildSpice);
    assert.equal(player(game, f.guild).specialKaramaUsed, true);
    assert.equal(player(game, f.creator).hand.some(card => card.id === f.karama), false);
    assert.equal(player(game, f.guild).hand.some(card => card.id === f.karama), false);
    assert.ok(player(game, f.guild).hand.some(card => card.id === f.stopKarama));
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(game.discard.filter(card => card.id === f.box).length, 1);
    assert.equal(game.karamaShipping, null);
    rejected(game, f.guild, { type: 'card', card: f.karama, mode: 'special' });
    game = actBoxShipmentPrice(game, f.beneficiary, { type: 'endMovement' });
    assert.notEqual(game.active, f.beneficiary);
    assert.deepEqual(boxShipmentPriceInventory(game), f.originalInventory);
  });

  if (advanced) void test('Advanced genuine Box search during Guild interception restores the original shipment before a same-card stop', () => {
    const f = createBoxShipmentPriceFixture({ advanced });
    originalSource(f);
    const declared = declareBoxShipmentPrice(f, structuredClone(f.game));
    assert.equal(declared.decision?.kind, 'guildShipment');
    const originalDecision = structuredClone(declared.decision), originalShipment = structuredClone(declared.pendingShipment);
    assert.ok(originalShipment);
    const originalShipper = structuredClone(player(declared, f.beneficiary));
    const paid = payBoxShipmentPrice(f, declared);
    assert.ok(paid.pendingNullentropy);
    assert.deepEqual(paid.pendingNullentropy.resume.decision, originalDecision);
    assert.deepEqual(paid.pendingShipment, originalShipment);
    assert.deepEqual(paid.karamaShipping, f.originalGrant);
    let game = selectBoxShipmentPrice(f, paid, f.karama);
    assert.deepEqual(game.decision, originalDecision);
    assert.deepEqual(game.pendingShipment, originalShipment);
    assert.deepEqual(game.karamaShipping, { ...f.originalGrant, costClaimed: true });
    assert.equal(player(game, f.holder).spice, player(f.game, f.holder).spice - f.boxFee);
    game = stopBoxShipmentPrice(f, game, f.karama);
    game = finishBoxShipmentPrice(f, game);
    assert.deepEqual(player(game, f.beneficiary).forces, originalShipper.forces);
    assert.equal(player(game, f.beneficiary).reserves, originalShipper.reserves);
    assert.equal(player(game, f.beneficiary).spice, originalShipper.spice);
    assert.equal(player(game, f.beneficiary).shipped, true);
    assert.equal(player(game, f.beneficiary).moved, 0);
    assert.equal(game.pendingShipment ?? null, null);
    assert.equal(game.karamaShipping, null);
    assert.equal(player(game, f.creator).hand.some(card => card.id === f.karama), false);
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(game.discard.filter(card => card.id === f.box).length, 1);
    assert.deepEqual(boxShipmentPriceInventory(game), f.originalInventory);
  });

  if (advanced) void test('Advanced genuine Box other-card selection leaves the unclaimed price cost refundable exactly once', () => {
    const f = createBoxShipmentPriceFixture({ advanced });
    originalSource(f);
    let { game } = recovered(f, f.alternative);
    const before = structuredClone(player(game, f.beneficiary));
    game = declareBoxShipmentPrice(f, game);
    game = stopBoxShipmentPrice(f, game, f.stopKarama);
    game = finishBoxShipmentPrice(f, game);
    assert.equal(player(game, f.beneficiary).spice, before.spice);
    assert.equal(player(game, f.beneficiary).reserves, before.reserves);
    assert.deepEqual(player(game, f.beneficiary).forces, before.forces);
    assert.equal(player(game, f.beneficiary).shipped, true);
    assert.equal(player(game, f.creator).hand.filter(card => card.id === f.karama).length, 1);
    assert.equal(game.discard.some(card => card.id === f.karama), false);
    assert.equal(game.discard.filter(card => card.id === f.stopKarama).length, 1);
    assert.equal(player(game, f.guild).hand.filter(card => card.id === f.alternative).length, 1);
    assert.equal(game.karamaShipping, null);
    rejected(game, f.guild, { type: 'card', card: f.stopKarama, mode: 'special' });
    assert.equal(player(game, f.creator).hand.filter(card => card.id === f.karama).length, 1);
    assert.deepEqual(boxShipmentPriceInventory(game), f.originalInventory);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} genuine sole-candidate Box automatically recovers and marks the original price cost`, () => {
    const f = createBoxShipmentPriceFixture({ advanced, otherCandidate: false });
    originalSource(f);
    assert.deepEqual(f.game.discard.map(card => card.id), [f.karama]);
    const game = finishBoxShipmentPrice(f, payBoxShipmentPrice(f));
    assert.equal(game.pendingNullentropy ?? null, null);
    assert.equal(game.decision ?? null, null);
    assert.equal(player(game, f.holder).spice, player(f.game, f.holder).spice - f.boxFee);
    assert.equal(player(game, f.holder).hand.filter(card => card.id === f.karama).length, 1);
    assert.deepEqual(game.karamaShipping, { ...f.originalGrant, costClaimed: true });
    assert.deepEqual(game.discard.map(card => card.id), [f.box]);
    assert.deepEqual(boxShipmentPriceInventory(game), f.originalInventory);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} genuine Box stale and foreign choices retain the paid search and charge its fee once`, () => {
    const f = createBoxShipmentPriceFixture({ advanced });
    originalSource(f);
    const paid = payBoxShipmentPrice(f), event = paid.pendingNullentropy!.event;
    rejected(paid, f.creator, { type: 'decision', event, card: f.karama });
    rejected(paid, f.holder, { type: 'decision', event: 'stale', card: f.karama });
    rejected(paid, f.holder, { type: 'decision', event, card: f.stopKarama });
    rejected(paid, f.holder, f.action);
    assert.deepEqual(paid.karamaShipping, f.originalGrant);
    assert.equal(player(paid, f.holder).spice, player(f.game, f.holder).spice - f.boxFee);
    const done = selectBoxShipmentPrice(f, paid, f.karama);
    rejected(done, f.holder, { type: 'decision', event, card: f.alternative });
    assert.equal(player(done, f.holder).spice, player(f.game, f.holder).spice - f.boxFee);
    assert.deepEqual(boxShipmentPriceInventory(done), f.originalInventory);
  });
}

void test('four existing profiles make a legal paid native Box selection while preserving the original purchased price', () => {
  for (const advanced of [false, true]) {
    const f = createBoxShipmentPriceFixture({ advanced }), paid = payBoxShipmentPrice(f);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(paid, f.holder);
      view.players.find(seat => seat.id === f.holder)!.bot = difficulty;
      const candidates = view.nullentropy!.search!.cards.map(card => card.id), action = botActions(view)[0];
      assert.ok(action, `${advanced}/${difficulty}`);
      assert.equal(action.type, 'decision');
      assert.equal(action.event, paid.pendingNullentropy!.event);
      assert.ok(candidates.includes(String(action.card)));
      const done = actBoxShipmentPrice(structuredClone(paid), f.holder, action);
      assert.equal(player(done, f.holder).spice, player(f.game, f.holder).spice - f.boxFee);
      assert.equal(done.karamaShipping!.owner, f.creator);
      assert.equal(done.karamaShipping!.player, f.beneficiary);
      assert.equal(done.karamaShipping!.costClaimed ?? false, action.card === f.karama);
      assert.deepEqual(boxShipmentPriceInventory(done), f.originalInventory);
      const before = boxShipmentPricePhysical(f.game), after = boxShipmentPricePhysical(done);
      assert.equal(after.active, before.active);
      assert.deepEqual(after.players.map(seat => ({ ...seat, spice: 0 })),
        before.players.map(seat => ({ ...seat, spice: 0 })));
    }
  }
});
