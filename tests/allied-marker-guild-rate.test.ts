import test from 'node:test';
import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import {
  alliedMarkerRatePlayer as player, createAlliedMarkerGuildRate, createAlliedMarkerGuildRateScene,
  declareAlliedMarkerGuildRate, passAlliedMarkerRateResponses, stepAlliedMarkerRate,
  type AlliedMarkerGuildRateFixture,
} from './fixture-allied-marker-guild-rate';

function conserve(g: Game) {
  for (const p of g.players)
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20);
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand)];
  assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
}
function uncommitted(f: AlliedMarkerGuildRateFixture, g: Game) {
  for (const id of [f.owner, f.recipient]) {
    const p = player(g, id), before = player(f.beforeAction, id);
    assert.equal(p.spice, before.spice);
    assert.equal(p.reserves, before.reserves);
    assert.deepEqual(p.forces, before.forces);
    assert.equal(p.shipped, before.shipped);
    assert.deepEqual(p.noField, before.noField);
    assert.equal(p.noFieldEvent, before.noFieldEvent);
  }
  conserve(g);
}
function settled(f: AlliedMarkerGuildRateFixture, before: Game, after: Game, cost: number,
  payer = f.payer) {
  const owner = player(after, f.owner), recipient = player(after, f.recipient);
  assert.equal(owner.spice, player(before, f.owner).spice - (payer === f.owner ? cost : 0));
  assert.equal(recipient.spice, player(before, f.recipient).spice - (payer === f.recipient ? cost : 0));
  assert.equal(owner.forces[f.priorSource], 3);
  assert.equal(owner.reserves, 17);
  assert.equal(owner.forces[f.target] ?? 0, 0);
  assert.equal(recipient.forces[f.target] ?? 0, f.amount);
  assert.equal(recipient.reserves, 20 - f.amount);
  assert.equal(recipient.shipped, true);
  assert.equal(owner.shipped, false);
  assert.equal(owner.noField!.lastShipped, f.token);
  assert.equal(owner.noField!.deployed, null);
  assert.deepEqual(owner.noField!.tokens, player(before, f.owner).noField!.tokens);
  assert.notEqual(owner.noFieldEvent, player(before, f.owner).noFieldEvent);
  assert.equal(recipient.noField, player(before, f.recipient).noField);
  assert.equal(after.pendingShipment, null);
  assert.equal(after.richeseAllyOffer, null);
  assert.equal(after.response, null);
  assert.equal(after.players.reduce((sum, p) => sum + p.spice, 0),
    before.players.reduce((sum, p) => sum + p.spice, 0) - cost,
    'The original Guild-recipient contract still pays the bank.');
  conserve(after);
}

for (const token of ['zero', 'five'] as const) {
  void test(`controlled allied ${token}: native cancellation charges one full-price marker, then materializes only Guild reserves`, () => {
    const f = createAlliedMarkerGuildRateScene({ token });
    assert.equal(f.accepted.response?.kind, 'richeseNoField');
    uncommitted(f, f.game);
    assert.deepEqual(player(f.game, f.owner).noField!.deployed, {
      tokenId: 'three', controller: f.owner, location: { territory: 'red_chasm', sector: 7 },
    });
    const pending = f.game.pendingShipment!;
    assert.equal(pending.player, f.recipient);
    assert.equal(pending.amount, f.amount);
    assert.equal(pending.cost, 1);
    assert.equal(pending.alliedNoField!.owner, f.owner);
    assert.equal(pending.alliedNoField!.recipient, f.recipient);
    assert.equal(pending.alliedNoField!.tokenId, token);
    assert.equal(pending.alliedNoField!.payer, f.recipient);
    const done = stepAlliedMarkerRate(f.game, f.cancel);
    settled(f, f.beforeAction, done, 2);
    assert.equal(done.discard.filter(c => c.id === f.karama).length, 1);
    assert.equal(player(done, f.observer).hand.some(c => c.id === f.karama), false);
    const beforeReplay = structuredClone(done);
    assert.throws(() => stepAlliedMarkerRate(done, f.cancel));
    assert.deepEqual(done, beforeReplay);
  });
}

void test('controlled Basic allied loan: allowing the native rate pays one bank spice and preserves actual five-force custody', () => {
  const f = createAlliedMarkerGuildRateScene({ advanced: false });
  const done = passAlliedMarkerRateResponses(f.game, 'guildRate');
  settled(f, f.beforeAction, done, 1);
  assert.ok(player(done, f.observer).hand.some(c => c.id === f.karama));
});

void test('controlled recipient poverty: cancellation releases token, wallets and army; ordinary full-price replacement remains legal', () => {
  const f = createAlliedMarkerGuildRateScene({ unaffordable: true });
  assert.equal(player(f.beforeAction, f.recipient).spice, 1);
  const released = stepAlliedMarkerRate(f.game, f.cancel);
  uncommitted(f, released);
  assert.equal(released.pendingShipment, null);
  assert.equal(released.response, null);
  assert.equal(viewGame(released, f.recipient).guildRateCanceled, true);
  assert.equal(released.discard.filter(c => c.id === f.karama).length, 1);
  const beforeInvalid = structuredClone(released);
  assert.throws(() => stepAlliedMarkerRate(released, { actor: f.recipient,
    action: { type: 'ship', amount: 1, territory: f.territory, sector: f.sector } }));
  assert.deepEqual(released, beforeInvalid);
  let done = stepAlliedMarkerRate(released, { actor: f.recipient,
    action: { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 } });
  if (done.decision?.kind === 'guildShipment') done = stepAlliedMarkerRate(done,
    { actor: f.recipient, action: { type: 'decision', allow: true } });
  assert.equal(done.response, null);
  assert.equal(done.pendingShipment, null);
  assert.equal(player(done, f.recipient).spice, 0);
  assert.equal(player(done, f.recipient).forces['arrakeen:10'], 1);
  assert.equal(player(done, f.recipient).reserves, 19);
  assert.equal(player(done, f.recipient).shipped, true);
  assert.deepEqual(player(done, f.owner).noField, player(f.beforeAction, f.owner).noField);
  assert.equal(player(done, f.owner).spice, 10);
  conserve(done);
});

void test('controlled supplier-funded half-price loan cannot enlarge lender approval; a new full-price offer needs new recipient consent', () => {
  const f = createAlliedMarkerGuildRateScene({ payer: 'supplier' });
  assert.equal(player(f.game, f.owner).spice, 10, 'Release must not depend on supplier poverty.');
  const released = stepAlliedMarkerRate(f.game, f.cancel);
  uncommitted(f, released);
  assert.equal(released.pendingShipment, null);
  assert.equal(viewGame(released, f.recipient).guildRateCanceled, true);
  assert.equal(released.discard.filter(c => c.id === f.karama).length, 1);
  const newOffer = stepAlliedMarkerRate(released, { actor: f.owner, action: f.action });
  assert.notEqual(newOffer.richeseAllyOffer!.event, f.offer.event);
  assert.equal(newOffer.richeseAllyOffer!.payer, f.owner);
  assert.equal(viewGame(newOffer, f.recipient).richeseNoField!.allyOffer!.cost, 2);
  uncommitted(f, newOffer);
  const declined = stepAlliedMarkerRate(newOffer, { actor: f.recipient,
    action: { type: 'decision', event: newOffer.richeseAllyOffer!.event, decline: true } });
  uncommitted(f, declined);
  const replacement = declareAlliedMarkerGuildRate(f, declined);
  assert.notEqual(replacement.game.response?.kind, 'guildRate');
  settled(f, f.beforeAction, replacement.game, 2);
  assert.equal(player(replacement.game, f.recipient).spice, 10, 'Never rewrite the original supplier payer.');
});

void test('controlled canceled native rate does not cancel a subsequently played independent Karama loan price', () => {
  const f = createAlliedMarkerGuildRateScene({ unaffordable: true, independentCard: true });
  const released = stepAlliedMarkerRate(f.game, f.cancel);
  uncommitted(f, released);
  assert.ok(f.independentKarama);
  const purchased = stepAlliedMarkerRate(released, { actor: f.observer,
    action: { type: 'card', mode: 'shipment', target: f.recipient, card: f.independentKarama } });
  assert.equal(viewGame(purchased, f.recipient).guildRateCanceled, true);
  assert.equal(purchased.karamaShipping?.player, f.recipient);
  assert.equal(purchased.karamaShipping?.card, f.independentKarama);
  assert.equal(purchased.discard.filter(c => c.id === f.independentKarama).length, 1);
  const replacement = declareAlliedMarkerGuildRate(f, purchased);
  assert.notEqual(replacement.game.response?.kind, 'guildRate');
  settled(f, f.beforeAction, replacement.game, 1);
  assert.equal(replacement.game.karamaShipping, null);
  assert.equal(replacement.game.discard.filter(c => c.id === f.karama).length, 1);
  assert.equal(replacement.game.discard.filter(c => c.id === f.independentKarama).length, 1);
});

void test('controlled already-active independent Karama price bypasses the native rate window without changing Guild-recipient bank payee', () => {
  const f = createAlliedMarkerGuildRate();
  const purchased = stepAlliedMarkerRate(f.beforeAction, { actor: f.observer,
    action: { type: 'card', mode: 'shipment', target: f.recipient, card: f.karama } });
  const done = declareAlliedMarkerGuildRate(f, purchased).game;
  assert.notEqual(done.response?.kind, 'guildRate');
  settled(f, f.beforeAction, done, 1);
  assert.equal(done.discard.filter(c => c.id === f.karama).length, 1);
});
