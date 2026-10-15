import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  createSemutaShipmentPrice, reactSemutaShipmentPrice,
  semutaPurchasedShipment, allowSemutaPurchasedShipment,
} from './fixture-semuta-shipment-price';
import { passSemutaSpecialDiscards } from './fixture-semuta-emperor-share';

const player = (game: Game, actor: string) => game.players.find(p => p.id === actor)!;
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

for (const advanced of [false, true]) for (const homeworlds of [false, true])
  void test(`${advanced ? 'Advanced' : 'Basic'} ${homeworlds ? 'typed world' : 'reserve'} price survives Semuta claim or decline and pays only bank once`, () => {
    for (const claim of [false, true]) {
      const f = createSemutaShipmentPrice({ advanced, homeworlds });
      const beneficiary = player(f.game, f.beneficiary);
      const spice = beneficiary.spice, reserves = beneficiary.reserves;
      const guildSpice = player(f.game, f.guild).spice;
      assert.equal(f.game.karamaShipping, null);
      assert.equal(beneficiary.shipped, false);
      reject(f.game, f.beneficiary, { type: 'endMovement' });
      let game = reactSemutaShipmentPrice(f.game, claim);
      assert.equal(viewGame(game, f.beneficiary).karamaShipping!.owner, f.owner);
      assert.equal(player(game, f.holder).hand.some(card => card.id === f.karama), claim);
      assert.equal(player(game, f.holder).hand.some(card => card.id === f.semuta), !claim);
      assert.equal(player(game, f.beneficiary).spice, spice);
      assert.equal(player(game, f.beneficiary).reserves, reserves);
      const shipment = semutaPurchasedShipment(game, homeworlds);
      game = applyAction(game, f.beneficiary, shipment.action);
      game = allowSemutaPurchasedShipment(game);
      assert.equal(player(game, f.beneficiary).spice, spice - shipment.cost);
      assert.equal(player(game, f.beneficiary).reserves, reserves - 3);
      assert.equal(player(game, f.guild).spice, guildSpice);
      assert.equal(player(game, f.beneficiary).shipped, true);
      assert.equal(player(game, f.beneficiary).moved, 0);
      if (homeworlds) assert.deepEqual(game.homeworlds!.custody!.visitors[shipment.target][f.beneficiary], { normal: 3, elite: 0 });
      else assert.equal(player(game, f.beneficiary).forces[shipment.target], 3);
      assert.equal(game.karamaShipping, null);
      assert.equal(player(game, f.holder).hand.some(card => card.id === f.karama), claim);
      assert.equal(game.discard.filter(card => card.id === f.semuta).length, claim ? 1 : 0);
      reject(game, f.beneficiary, shipment.action);
    }
  });

for (const homeworlds of [false, true])
  void test(`the SAME recovered price card can stop ${homeworlds ? 'typed world' : 'reserve'} shipment without being refunded to its former owner`, () => {
    const f = createSemutaShipmentPrice({ homeworlds });
    let game = reactSemutaShipmentPrice(f.game, true);
    const original = structuredClone(player(game, f.beneficiary));
    const shipment = semutaPurchasedShipment(game, homeworlds);
    game = applyAction(game, f.beneficiary, shipment.action);
    game = applyAction(game, f.guild, { type: 'card', card: f.karama, mode: 'special' });
    assert.equal(player(game, f.beneficiary).shipped, false);
    game = passSemutaSpecialDiscards(game);
    const shipper = player(game, f.beneficiary);
    assert.equal(shipper.spice, original.spice);
    assert.equal(shipper.reserves, original.reserves);
    assert.deepEqual(shipper.forces, original.forces);
    assert.equal(shipper.shipped, true);
    assert.equal(shipper.moved, 0);
    assert.equal(player(game, f.owner).hand.some(card => card.id === f.karama), false);
    assert.equal(player(game, f.guild).hand.some(card => card.id === f.karama), false);
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
    assert.equal(game.karamaShipping, null);
    if (homeworlds) assert.equal(game.homeworlds!.custody!.visitors[shipment.target]?.[f.beneficiary], undefined);
    else assert.equal(shipper.forces[shipment.target] ?? 0, 0);
    game = applyAction(game, f.beneficiary, { type: 'endMovement' });
    assert.notEqual(game.active, f.beneficiary);
  });

void test('declining the price cost retains its existing exact-card refund when another physical card pays the stop', () => {
  for (const homeworlds of [false, true]) {
    const f = createSemutaShipmentPrice({ homeworlds });
    let game = reactSemutaShipmentPrice(f.game, false);
    // CONTROLLED second-card acquisition, not an original-action producer.
    // The original price and actual Guild stop still use distinct physical IDs.
    const at = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(at >= 0);
    const stop = game.deck.splice(at, 1)[0]; player(game, f.guild).hand.push(stop);
    const before = structuredClone(player(game, f.beneficiary));
    const shipment = semutaPurchasedShipment(game, homeworlds);
    game = applyAction(game, f.beneficiary, shipment.action);
    game = applyAction(game, f.guild, { type: 'card', card: stop.id, mode: 'special' });
    game = passSemutaSpecialDiscards(game);
    assert.equal(player(game, f.beneficiary).spice, before.spice);
    assert.equal(player(game, f.beneficiary).reserves, before.reserves);
    assert.equal(player(game, f.beneficiary).shipped, true);
    assert.equal(player(game, f.owner).hand.filter(card => card.id === f.karama).length, 1);
    assert.equal(game.discard.some(card => card.id === f.karama), false);
    assert.equal(game.discard.filter(card => card.id === stop.id).length, 1);
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.equal(game.karamaShipping, null);
  }
});

void test('wrong claimant and stale price-cost events cannot activate, duplicate or replace the original benefit', () => {
  const f = createSemutaShipmentPrice();
  const event = f.game.pendingTreacheryDiscard!.batch.event;
  reject(f.game, f.owner, { type: 'semutaCommit', event });
  reject(f.game, f.holder, { type: 'semutaCommit', event: 'old' });
  reject(f.game, f.owner, f.action);
  const game = reactSemutaShipmentPrice(f.game, true);
  reject(game, f.holder, { type: 'semutaCommit', event });
  reject(game, f.holder, { type: 'card', card: f.karama, mode: 'shipment', target: f.beneficiary });
  const shipment = semutaPurchasedShipment(game);
  const done = allowSemutaPurchasedShipment(applyAction(game, f.beneficiary, shipment.action));
  assert.equal(player(done, f.beneficiary).spice, 7);
  assert.equal(player(done, f.beneficiary).forces[shipment.target], 3);
});
