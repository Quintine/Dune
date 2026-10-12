import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { semutaGuildIncomeInventory } from './fixture-semuta-guild-income';
import { semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import {
  createSemutaHomeworldGuildIncomeFixture, semutaHomeworldGuildCounters,
  semutaHomeworldGuildPosition, type SemutaHomeworldGuildFixture,
} from './fixture-semuta-homeworld-guild-income';

function paidSource(f: SemutaHomeworldGuildFixture): Game {
  const paid = f.income, before = semutaEmperorPlayer(f.game, f.payer), after = semutaEmperorPlayer(paid, f.payer);
  assert.equal(f.cost, 5, 'Five genuine stronghold arrivals pay five, never a canceled price');
  assert.equal(f.nativeIncome, 3, 'Original physical-low Junction rounds native income up');
  assert.equal(after.spice, before.spice - 5);
  assert.equal(after.reserves, before.reserves - 5);
  assert.equal(after.forces[f.key], (before.forces[f.key] ?? 0) + 5);
  assert.equal(after.shipped, true);
  assert.equal(after.moved, before.moved);
  assert.equal(paid.active, f.payer);
  assert.deepEqual(paid.movementRemaining, f.game.movementRemaining);
  assert.equal(semutaEmperorPlayer(paid, f.owner).spice, semutaEmperorPlayer(f.game, f.owner).spice);
  assert.deepEqual(semutaGuildIncomeInventory(paid), semutaGuildIncomeInventory(f.setup));
  assert.ok(semutaHomeworldGuildCounters(paid).every(row => row.total === 20));
  return paid;
}

function costOpportunity(f: SemutaHomeworldGuildFixture, paid: Game): Game {
  assert.ok(viewGame(paid, f.canceller).responseControls!.cancelCards.includes(f.karama.id));
  assert.throws(() => applyAction(paid, f.payer, f.cancel), 'The payer cannot spend Emperor\'s foreign printed cost');
  const pending = applyAction(paid, f.canceller, f.cancel), discard = pending.pendingTreacheryDiscard;
  assert.ok(discard, 'Homeworld native income cancellation must offer its printed cost BEFORE settlement');
  assert.equal(discard.batch.cause, 'karama:guildIncome');
  assert.equal(discard.reaction?.stage, 'offer');
  assert.deepEqual(discard.batch.entries, [{ card: f.karama, discardedBy: f.canceller, publicFace: true }]);
  assert.deepEqual(semutaHomeworldGuildPosition(pending), semutaHomeworldGuildPosition(paid));
  assert.deepEqual(pending.homeworldOccupiedPercentageLedger, paid.homeworldOccupiedPercentageLedger,
    'No percentage admission or payout precedes the Semuta offer');
  assert.notEqual(pending.decision?.kind, 'homeworldOccupiedPercentage');
  assert.equal(semutaEmperorPlayer(pending, f.canceller).hand.some(card => card.id === f.karama.id), false);
  for (const seat of pending.players)
    assert.equal(viewGame(pending, seat.id).semutaReaction!.canCommit, seat.id === f.holder);
  assert.throws(() => applyAction(pending, f.payer, { type: 'endMovement' }));
  assert.throws(() => applyAction(pending, f.owner, { type: 'semutaCommit', event: discard.batch.event }));
  return pending;
}

function settleShare(f: SemutaHomeworldGuildFixture, state: Game, bot = false): Game {
  if (!f.allocation) {
    assert.notEqual(state.decision?.kind, 'homeworldOccupiedPercentage');
    return state;
  }
  const offer = viewGame(state, f.allocation.actor).homeworldOccupiedPercentage;
  assert.ok(offer);
  assert.equal(offer.owner, f.occupiedReceiver);
  assert.equal(offer.amount, 2, 'The printed occupied leg rounds the same original gross five DOWN');
  assert.equal(offer.minOwnAmount, 2);
  assert.equal(offer.maxOwnAmount, 2);
  assert.equal(state.decision?.kind, 'homeworldOccupiedPercentage');
  assert.equal(state.decision.player, f.allocation.actor);
  assert.equal(state.pendingHomeworldOccupiedPercentage!.source.kind, 'guild-shipping');
  const source = state.pendingHomeworldOccupiedPercentage!.source;
  assert.equal(source.amount, 5);
  assert.ok('payment' in source);
  assert.deepEqual(source.payment.contributions, [{ payer: f.payer, amount: 5 }]);
  assert.equal(source.payment.recipient, f.owner);
  const allocation: Action = { type: 'decision', event: offer.event, ownAmount: f.allocation.ownAmount };
  assert.throws(() => applyAction(state, f.owner, allocation), 'The native Guild does not own the printed occupied share');
  assert.throws(() => applyAction(state, f.allocation!.actor, { ...allocation, ownAmount: 1 }),
    'A sole occupier without an ally cannot leave its original share unallocated');
  assert.throws(() => applyAction(state, f.payer, { type: 'endMovement' }));
  const before = semutaEmperorPlayer(state, f.allocation.actor).spice;
  let action = allocation;
  if (bot) {
    const own = viewGame(state, f.allocation.actor);
    own.players.find(player => player.id === f.allocation!.actor)!.bot = 'Easy';
    const chosen = botActions(own)[0];
    assert.ok(chosen, 'The original occupied-percentage bot must provide a legal allocation');
    action = chosen;
  }
  const done = applyAction(state, f.allocation.actor, action);
  assert.equal(semutaEmperorPlayer(done, f.allocation.actor).spice, before + 2);
  assert.equal(done.homeworldOccupiedPercentageLedger!.receipts.filter(row => row.source.event === offer.event).length, 1);
  assert.equal(done.homeworldOccupiedPercentageLedger!.receipts.find(row => row.source.event === offer.event)!.status, 'settled');
  assert.deepEqual(done.homeworldOccupationHistory, state.homeworldOccupationHistory);
  assert.deepEqual(done.homeworlds, state.homeworlds);
  assert.throws(() => applyAction(done, f.allocation!.actor, allocation), 'The source is allocated once, not replayed');
  return done;
}

function finishCanceled(
  f: SemutaHomeworldGuildFixture, paid: Game, pending: Game, reacted: Game, claim: boolean, bot = false,
): Game {
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(reacted.resolvedTreacheryDiscardSequence, pending.pendingTreacheryDiscard!.sequence);
  const holder = semutaEmperorPlayer(reacted, f.holder);
  assert.equal(holder.hand.some(card => card.id === f.karama.id), claim);
  assert.equal(holder.hand.some(card => card.id === f.semuta), !claim);
  assert.equal(reacted.discard.filter(card => card.id === f.karama.id).length, Number(!claim));
  assert.equal(reacted.discard.filter(card => card.id === f.semuta).length, Number(claim));
  assert.deepEqual(semutaHomeworldGuildPosition(reacted), semutaHomeworldGuildPosition(paid));
  if (f.allocation) {
    const source = reacted.pendingHomeworldOccupiedPercentage!.source;
    assert.equal(source.kind, 'guild-shipping');
    assert.ok('nativeIncome' in source);
    assert.equal(source.nativeIncome, 'karama-canceled');
  }
  const done = settleShare(f, reacted, bot);
  assert.equal(semutaEmperorPlayer(done, f.owner).spice, semutaEmperorPlayer(f.game, f.owner).spice,
    'Original native credit is zero, not ceil three, while the occupied two survives');
  assert.equal(semutaEmperorPlayer(done, f.payer).spice, semutaEmperorPlayer(f.game, f.payer).spice - 5);
  assert.equal(semutaEmperorPlayer(done, f.payer).forces[f.key], 5);
  assert.equal(semutaEmperorPlayer(done, f.payer).reserves, semutaEmperorPlayer(f.game, f.payer).reserves - 5);
  assert.equal(semutaEmperorPlayer(done, f.payer).shipped, true);
  assert.deepEqual(done.homeworldOccupationHistory, paid.homeworldOccupationHistory);
  assert.deepEqual(done.homeworlds, paid.homeworlds);
  assert.deepEqual(semutaGuildIncomeInventory(done), semutaGuildIncomeInventory(f.setup));
  assert.ok(semutaHomeworldGuildCounters(done).every(row => row.total === 20));
  assert.throws(() => applyAction(done, f.payer, f.ship));
  assert.throws(() => applyAction(done, f.canceller, f.cancel));
  assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event }));
  const allowed = settleShare(f, applyAction(paid, f.canceller, { type: 'passResponse' }));
  assert.equal(semutaEmperorPlayer(allowed, f.owner).spice, semutaEmperorPlayer(f.game, f.owner).spice + 3,
    'Uncanceled original income is ceil three from exactly the same paid source');
  const originalMovement = applyAction(allowed, f.payer, { type: 'endMovement' });
  const canceledMovement = applyAction(done, f.payer, { type: 'endMovement' });
  assert.equal(canceledMovement.turn, originalMovement.turn);
  assert.equal(canceledMovement.phase, originalMovement.phase);
  assert.equal(canceledMovement.active, originalMovement.active);
  assert.deepEqual(canceledMovement.movementRemaining, originalMovement.movementRemaining);
  assert.deepEqual(canceledMovement.decision, originalMovement.decision);
  assert.deepEqual(canceledMovement.response, originalMovement.response);
  assert.ok(!canceledMovement.movementRemaining?.includes(f.payer));
  assert.equal(semutaEmperorPlayer(canceledMovement, f.payer).forces[f.key], 5);
  assert.equal(semutaEmperorPlayer(canceledMovement, f.owner).spice, semutaEmperorPlayer(f.game, f.owner).spice);
  return done;
}

for (const advanced of [false, true]) {
  for (const claim of [false, true]) void test(
    `${advanced ? 'Advanced' : 'Basic'} original low Junction income ${claim ? 'claim' : 'pass'} retains gross-five payment and native Movement`, () => {
      const f = createSemutaHomeworldGuildIncomeFixture({ advanced, fullHand: true });
      const paid = paidSource(f), pending = costOpportunity(f, paid), event = pending.pendingTreacheryDiscard!.batch.event;
      assert.equal(semutaEmperorPlayer(f.game, f.holder).hand.length, 4);
      let reacted = pending;
      if (claim) reacted = applyAction(reacted, f.holder, { type: 'semutaCommit', event });
      else for (const seat of pending.players) reacted = applyAction(reacted, seat.id, { type: 'semutaPass', event });
      const done = finishCanceled(f, paid, pending, reacted, claim);
      const held = semutaEmperorPlayer(f.game, f.holder);
      assert.equal(semutaEmperorPlayer(done, f.holder).hand.length, handLimit(held));
      assert.deepEqual(semutaEmperorPlayer(done, f.holder).hand.map(card => card.id).sort(),
        (claim ? [...held.hand.filter(card => card.id !== f.semuta).map(card => card.id), f.karama.id]
          : held.hand.map(card => card.id)).sort());
    },
  );
}

for (const claim of [false, true]) void test(
  `Advanced actual invaded Junction cost ${claim ? 'claim' : 'pass'} pauses before original owner allocation two and resumes paid Movement`, () => {
    const f = createSemutaHomeworldGuildIncomeFixture({ advanced: true, occupied: true, fullHand: true });
    assert.equal(f.beforeInvasion!.homeworlds!.custody!.visitors['homeworld:guild']?.r, undefined);
    assert.equal(f.occupied!.homeworlds!.custody!.visitors['homeworld:guild'].r.normal, 1);
    assert.ok(f.occupationActions.some(step => step.actor === f.occupiedReceiver && step.action.type === 'homeworldShip'));
    assert.ok(f.occupied!.homeworldOccupationHistory!.qualifications.some(row =>
      row.world === 'homeworld:guild' && row.player === f.occupiedReceiver && row.cause === 'sole'));
    const paid = paidSource(f), pending = costOpportunity(f, paid), event = pending.pendingTreacheryDiscard!.batch.event;
    let reacted = pending;
    if (claim) reacted = applyAction(reacted, f.holder, { type: 'semutaCommit', event });
    else {
      for (const actor of [f.owner, f.payer, f.canceller]) {
        reacted = applyAction(reacted, actor, { type: 'semutaPass', event });
        assert.equal(reacted.pendingTreacheryDiscard!.reaction!.stage, 'offer');
        assert.deepEqual(semutaHomeworldGuildPosition(reacted), semutaHomeworldGuildPosition(paid));
        assert.ok(!reacted.pendingHomeworldOccupiedPercentage);
      }
      reacted = applyAction(reacted, f.holder, { type: 'semutaPass', event });
    }
    const done = finishCanceled(f, paid, pending, reacted, claim);
    assert.equal(semutaEmperorPlayer(done, f.occupiedReceiver!).spice,
      semutaEmperorPlayer(paid, f.occupiedReceiver!).spice + 2);
    assert.equal(semutaEmperorPlayer(done, f.holder).hand.length, 4);
  },
);

void test('legal full-hand Semuta bot and original occupied owner bot finish canceled Junction income without replaying shipment', () => {
  const f = createSemutaHomeworldGuildIncomeFixture({ advanced: true, occupied: true, fullHand: true });
  const paid = paidSource(f), pending = costOpportunity(f, paid), own = viewGame(pending, f.holder);
  own.players.find(player => player.id === f.holder)!.bot = 'Easy';
  const action = botActions(own)[0];
  assert.ok(action);
  const reacted = applyAction(pending, f.holder, action);
  finishCanceled(f, paid, pending, reacted, true, true);
});
