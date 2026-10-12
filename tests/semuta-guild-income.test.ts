import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  createSemutaGuildIncomeFixture, reactSemutaGuildIncome,
  semutaGuildIncomeInventory,
  semutaGuildIncomePosition, type SemutaGuildIncomeFixture,
} from './fixture-semuta-guild-income';
import { semutaEmperorPlayer as semutaGuildIncomePlayer } from './fixture-semuta-emperor-share';

function openPaid(f: SemutaGuildIncomeFixture): Game {
  const paid = f.income;
  const payerBefore = semutaGuildIncomePlayer(f.game, f.payer), payerAfter = semutaGuildIncomePlayer(paid, f.payer);
  assert.equal(f.cost, 6, 'Three ordinary sand arrivals pay full price, not the Guild half rate');
  assert.equal(payerAfter.spice, payerBefore.spice - f.cost);
  assert.equal(payerAfter.reserves, payerBefore.reserves - f.amount);
  assert.equal(payerAfter.forces[f.key], (payerBefore.forces[f.key] ?? 0) + f.amount);
  assert.equal(payerAfter.shipped, true);
  assert.equal(payerAfter.moved, payerBefore.moved);
  assert.equal(paid.active, f.payer);
  assert.deepEqual(paid.movementRemaining, f.game.movementRemaining);
  assert.equal(semutaGuildIncomePlayer(paid, f.owner).spice, semutaGuildIncomePlayer(f.game, f.owner).spice);
  return paid;
}
function openCost(f: SemutaGuildIncomeFixture, paid: Game): Game {
  assert.ok(viewGame(paid, f.canceller).responseControls!.cancelCards.includes(f.karama.id));
  assert.deepEqual(viewGame(paid, f.owner).responseControls!.cancelCards, [], 'Guild is income owner, not foreign canceller');
  assert.throws(() => applyAction(paid, f.payer, f.cancel),
    'The shipper cannot spend the foreign Emperor-controlled cost');
  const pending = applyAction(paid, f.canceller, f.cancel);
  const discard = pending.pendingTreacheryDiscard;
  assert.ok(discard, 'Printed Karama needs its immediate public Semuta opportunity');
  assert.equal(discard.batch.cause, 'karama:guildIncome');
  assert.deepEqual(discard.batch.entries, [{ card: f.karama, discardedBy: f.canceller, publicFace: true }]);
  assert.equal(discard.reaction?.stage, 'offer');
  assert.deepEqual(semutaGuildIncomePosition(pending), semutaGuildIncomePosition(paid));
  assert.equal(semutaGuildIncomePlayer(pending, f.canceller).hand.some(card => card.id === f.karama.id), false);
  for (const seat of pending.players) {
    const offer = viewGame(pending, seat.id).semutaReaction!;
    assert.equal(offer.canCommit, seat.id === f.holder);
  }
  assert.throws(() => applyAction(pending, f.payer, { type: 'endMovement' }));
  assert.throws(() => applyAction(pending, f.payer, { type: 'semutaCommit', event: discard.batch.event }));
  return pending;
}
function assertCompletion(f: SemutaGuildIncomeFixture, paid: Game, pending: Game, done: Game, claim: boolean): void {
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const holder = semutaGuildIncomePlayer(done, f.holder);
  assert.equal(holder.hand.some(card => card.id === f.karama.id), claim);
  assert.equal(holder.hand.some(card => card.id === f.semuta), !claim);
  assert.equal(done.discard.filter(card => card.id === f.karama.id).length, Number(!claim));
  assert.equal(done.discard.filter(card => card.id === f.semuta).length, Number(claim));
  assert.equal(done.resolvedTreacheryDiscardSequence, pending.pendingTreacheryDiscard!.sequence);
  assert.deepEqual(semutaGuildIncomePosition(done), semutaGuildIncomePosition(paid),
    'Canceling Guild income never refunds, reprices, re-ships, moves or advances the native owner');
  assert.deepEqual(semutaGuildIncomeInventory(done), semutaGuildIncomeInventory(f.setup));
  assert.throws(() => applyAction(done, f.payer, f.ship));
  assert.throws(() => applyAction(done, f.canceller, f.cancel));
  assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event }));
  // Compare the next native Movement scheduling with the original allowed
  // income branch. Only Guild's collected spice differs; no owner/suffix is invented.
  const allowed = applyAction(paid, f.canceller, { type: 'passResponse' });
  assert.equal(semutaGuildIncomePlayer(allowed, f.owner).spice,
    semutaGuildIncomePlayer(f.game, f.owner).spice + f.cost);
  const ordinarySuffix = applyAction(allowed, f.payer, { type: 'endMovement' });
  const canceledSuffix = applyAction(done, f.payer, { type: 'endMovement' });
  assert.equal(canceledSuffix.turn, ordinarySuffix.turn);
  assert.equal(canceledSuffix.phase, ordinarySuffix.phase);
  assert.equal(canceledSuffix.active, ordinarySuffix.active);
  assert.deepEqual(canceledSuffix.movementRemaining, ordinarySuffix.movementRemaining);
  assert.deepEqual(canceledSuffix.decision, ordinarySuffix.decision);
  assert.deepEqual(canceledSuffix.response, ordinarySuffix.response);
  assert.ok(!canceledSuffix.movementRemaining?.includes(f.payer));
  const payer = semutaGuildIncomePlayer(canceledSuffix, f.payer);
  assert.equal(payer.spice, semutaGuildIncomePlayer(f.game, f.payer).spice - f.cost);
  assert.equal(payer.reserves, semutaGuildIncomePlayer(f.game, f.payer).reserves - f.amount);
  assert.equal(payer.forces[f.key], f.amount);
  assert.equal(payer.shipped, true);
  assert.equal(semutaGuildIncomePlayer(canceledSuffix, f.owner).spice, semutaGuildIncomePlayer(f.game, f.owner).spice);
  assert.deepEqual(semutaGuildIncomeInventory(canceledSuffix), semutaGuildIncomeInventory(f.setup));
  for (const seat of canceledSuffix.players) viewGame(canceledSuffix, seat.id);
}

for (const advanced of [false, true]) {
  for (const claim of [false, true]) void test(
    `${advanced ? 'Advanced' : 'Basic'} native paid reserve shipment Semuta ${claim ? 'claims' : 'passes'} income-canceling Karama without refund or repeat arrival`, () => {
      const f = createSemutaGuildIncomeFixture({ advanced }), paid = openPaid(f), pending = openCost(f, paid);
      const done = reactSemutaGuildIncome(pending, f, claim);
      assertCompletion(f, paid, pending, done, claim);
    },
  );
  void test(`${advanced ? 'Advanced' : 'Basic'} full-hand Richese exchanges Semuta for the exact foreign Guild-income cost`, () => {
    const f = createSemutaGuildIncomeFixture({ advanced, fullHand: true });
    const held = semutaGuildIncomePlayer(f.game, f.holder);
    assert.equal(held.hand.length, handLimit(held));
    const paid = openPaid(f), pending = openCost(f, paid);
    assert.equal(viewGame(pending, f.holder).semutaReaction!.canCommit, true);
    const done = reactSemutaGuildIncome(pending, f, true);
    assert.equal(semutaGuildIncomePlayer(done, f.holder).hand.length, handLimit(held));
    assert.deepEqual(semutaGuildIncomePlayer(done, f.holder).hand.map(card => card.id).sort(),
      [...held.hand.filter(card => card.id !== f.semuta).map(card => card.id), f.karama.id].sort());
    assertCompletion(f, paid, pending, done, true);
  });
}

void test('native Guild-income denial waits through neutral passes and the original paid Movement stays owned', () => {
  const f = createSemutaGuildIncomeFixture(), paid = openPaid(f), pending = openCost(f, paid);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  let game = pending;
  for (const actor of [f.owner, f.payer, f.canceller]) {
    game = applyAction(game, actor, { type: 'semutaPass', event });
    assert.equal(game.pendingTreacheryDiscard!.reaction!.stage, 'offer');
    assert.deepEqual(semutaGuildIncomePosition(game), semutaGuildIncomePosition(paid));
    assert.equal(game.discard.filter(card => card.id === f.karama.id).length, 1);
  }
  game = applyAction(game, f.holder, { type: 'semutaPass', event });
  assertCompletion(f, paid, pending, game, false);
});

void test('legal Advanced Semuta bot finishes the full-hand Guild-income cancellation and resumes native Movement', () => {
  const f = createSemutaGuildIncomeFixture({ advanced: true, fullHand: true });
  const paid = openPaid(f), pending = openCost(f, paid);
  const own = viewGame(pending, f.holder);
  own.players.find(player => player.id === f.holder)!.bot = 'Easy';
  const action = botActions(own)[0];
  assert.ok(action);
  const done = applyAction(pending, f.holder, action);
  assertCompletion(f, paid, pending, done, true);
});
