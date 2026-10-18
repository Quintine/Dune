import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  actKullPurpose, advanceKullPurpose, completeKullPurpose, createKullPurposeFixture,
  kullPurposeClean, kullPurposePlayer as player, kullPurposeShipmentAction,
  reachKullPurposeBaliset, type KullPurposeFixture,
} from './fixture-kull-purpose';

function source(f: KullPurposeFixture) {
  assert.equal(f.entry, 'initializeKullGameForAudit');
  assert.equal(f.setup.kullPreview, true);
  assert.ok(f.beforeInitialDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.beforeInitialDeal.deck.slice(0, 3).map(card => card.id), f.unopenedDeal.map(deal => deal.card));
  for (const deal of f.unopenedDeal)
    assert.ok(player(f.afterSetup, deal.actor).hand.some(card => card.id === deal.card));
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.ok(f.actions.some(step => step.actor === f.reactor && step.action.type === 'bid' && step.action.amount === 1));
  assert.ok(player(f.acquired, f.reactor).hand.some(card => card.id === f.baliset));
  assert.equal(player(f.beforeChoamShipment, f.reactor).spice - player(f.afterChoamShipment, f.reactor).spice, 1);
  assert.equal(player(f.game, f.reactor).forces[f.destination], 1);
  assert.equal(f.game.phase, 5);
  assert.equal(f.game.active, f.actor);
  assert.equal(player(f.game).shipped, false);
}
function restriction(f: KullPurposeFixture, programme: ReturnType<typeof reachKullPurposeBaliset>) {
  const { offered, restricted } = programme;
  const reaction = viewGame(offered, f.reactor).kullReaction!;
  assert.equal(reaction.scope, f.game.advanced ? 'effect' : 'phase');
  assert.match(reaction.effect, /shipment|price|discount/i);
  assert.ok(player(offered).hand.some(card => card.id === f.karama));
  assert.equal(offered.karamaShipping, null);
  assert.equal(restricted.pendingKull ?? null, null);
  assert.equal(restricted.karamaShipping, null);
  assert.equal(player(restricted).spice, player(f.game).spice);
  assert.equal(player(restricted).shipped, false);
  assert.equal(player(restricted).specialKaramaUsed, undefined);
  assert.ok(player(restricted).hand.some(card => card.id === f.karama));
  assert.equal(restricted.discard.some(card => card.id === f.karama), false);
  assert.equal(restricted.discard.filter(card => card.id === f.kull).length, 1);
  const receipt = restricted.kullRestrictions!.find(receipt => receipt.player === f.actor)!;
  assert.deepEqual(receipt, { player: f.actor, turn: restricted.turn, phase: 5,
    ...(f.game.advanced ? { purpose: 'shipment-price' } : {}) });
  const before = JSON.stringify(restricted);
  assert.throws(() => actKullPurpose(restricted, f.actor, kullPurposeShipmentAction(f)), /Kull Wahad/i);
  assert.equal(JSON.stringify(restricted), before, 'Repeating the blocked purpose stops before a fresh offer, card cost or funding change');
}

void test('genuine Advanced Kull blocks shipment-price while retained Karama cancels native Baliset in the same phase', () => {
  const f = createKullPurposeFixture();
  source(f);
  const result = completeKullPurpose(f);
  restriction(f, result);
  const own = viewGame(result.restricted, f.actor);
  assert.equal(own.karamaBlocked, null, 'A single-purpose restriction is not an all-purpose activation ban');
  const blocks = own.karamaPurposeBlocks;
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].purpose, 'shipment-price');
  assert.ok(blocks[0].label.length > 0 && blocks[0].message.length > 0);
  assert.equal(player(result.restricted).spice - player(result.shipped).spice, 2,
    'The denied price benefit does not alter the real one-counter desert shipment cost');
  assert.equal(player(result.shipped).forces[f.source], 1);
  assert.equal(player(result.shipped).elites!.forces[f.source], 1);
  assert.equal(player(result.beforeBaliset).moved, 0);
  assert.ok(viewGame(result.baliset, f.actor).responseControls!.cancelCards.includes(f.karama));
  assert.equal(result.differentOffer.turn, result.restricted.turn);
  assert.equal(result.differentOffer.phase, result.restricted.phase);
  assert.notEqual(result.differentOffer.pendingKull!.event, result.offered.pendingKull!.event);
  assert.equal(viewGame(result.differentOffer, f.reactor).kullReaction!.scope, 'effect');
  assert.ok(viewGame(result.differentOffer, f.reactor).kullReaction!.plays.every(play => play.card.id !== f.kull));
  const done: Game = result.completed;
  assert.equal(done.phase, 5);
  assert.equal(done.pendingKull ?? null, null);
  assert.equal(done.pendingChoamMove ?? null, null);
  assert.equal(done.pendingChoamWorthless ?? null, null);
  assert.deepEqual(done.kullRestrictions, result.restricted.kullRestrictions,
    'Declining the different-purpose opportunity adds no new restriction');
  assert.equal(player(done).moved, 1);
  assert.equal(player(done).forces[f.source] ?? 0, 0);
  assert.equal(player(done).forces[f.destination], 1);
  assert.equal(player(done).elites!.forces[f.destination], 1);
  assert.equal(done.discard.filter(card => card.id === f.karama).length, 1);
  assert.equal(done.discard.filter(card => card.id === f.kull).length, 1);
  assert.ok(player(done, f.reactor).hand.some(card => card.id === f.baliset),
    'Native prevention retains the canceled Baliset cost under the existing CHOAM policy');
  assert.deepEqual(result.game.movementRemaining, []);
  assert.equal(result.game.decision?.kind, 'choamMarket', 'Ending movement reaches the real CHOAM phase-end market');
});

void test('genuine Basic Kull retains the phase-wide policy at the same paid shipment and native Baliset opportunity', () => {
  const f = createKullPurposeFixture({ advanced: false });
  source(f);
  const programme = reachKullPurposeBaliset(f);
  restriction(f, programme);
  assert.ok(viewGame(programme.restricted, f.actor).karamaBlocked);
  assert.equal(viewGame(programme.restricted, f.actor).karamaPurposeBlocks.length, 0);
  assert.equal(viewGame(programme.baliset, f.actor).responseControls!.cancelCards.includes(f.karama), false);
  assert.throws(() => actKullPurpose(programme.baliset, f.actor,
    { type: 'card', mode: 'cancel', card: f.karama }), /Kull Wahad/i);
  const allowed = advanceKullPurpose(programme.game, kullPurposeClean);
  assert.equal(player(allowed).moved, 0);
  assert.equal(player(allowed).forces[f.source], 1);
  assert.ok(player(allowed).hand.some(card => card.id === f.karama));
  assert.equal(allowed.discard.filter(card => card.id === f.baliset).length, 1);
});

void test('all four minimal policies make a legal different-purpose response after original Advanced Kull success', () => {
  const f = createKullPurposeFixture();
  const programme = reachKullPurposeBaliset(f);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(programme.baliset, f.actor);
    view.players.find(player => player.id === f.actor)!.bot = difficulty;
    assert.ok(view.responseControls!.cancelCards.includes(f.karama));
    const action = botActions(view).find(action => action.type === 'passResponse' ||
      (action.type === 'card' && action.mode === 'cancel' && action.card === f.karama));
    assert.ok(action, `${difficulty} retains a legal native response without a blanket Karama filter`);
    let next = actKullPurpose(structuredClone(programme.game), f.actor, action);
    if (action.type === 'card') {
      const reaction = viewGame(next, f.reactor).kullReaction!;
      assert.ok(reaction);
      next = actKullPurpose(next, f.reactor, { type: 'kullDecision', event: reaction.event, decline: true });
      next = advanceKullPurpose(next, kullPurposeClean);
      assert.equal(player(next).moved, 1);
      assert.equal(next.discard.filter(card => card.id === f.karama).length, 1);
    } else {
      next = advanceKullPurpose(next, kullPurposeClean);
      assert.equal(player(next).moved, 0);
      assert.ok(player(next).hand.some(card => card.id === f.karama));
    }
  }
});
