import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import {
  createSemutaTupileFixture, reactSemutaTupile, semutaTupileCards,
  semutaTupileCleanupStep, semutaTupileForceTotals,
  type SemutaTupileFixture,
} from './fixture-semuta-tupile';
import { semutaEmperorPlayer as semutaTupilePlayer } from './fixture-semuta-emperor-share';

function assertOriginalDeparture(f: SemutaTupileFixture) {
  for (const id of [f.occupier, f.ally]) {
    const occupied = semutaTupilePlayer(f.beforeDeparture, id);
    assert.equal(occupied.hand.length, 5);
    assert.equal(handLimit(occupied), 5);
    assert.equal(handLimit(semutaTupilePlayer(f.game, id)), 4);
  }
  assert.equal(semutaTupilePlayer(f.occupied, f.occupier).ally, f.ally);
  assert.equal(semutaTupilePlayer(f.occupied, f.ally).ally, f.occupier);
  const lease = f.occupied.homeworldTupileState!.leases[f.occupied.homeworldTupileState!.current!];
  assert.deepEqual(lease.holders, [f.occupier, f.ally]);
  const source = f.occupied.homeworldOccupationHistory!.sources.find(row => row.event === lease.source.qualification)!;
  assert.ok(source);
  assert.notEqual(source.cause, 'setup');
  assert.equal(f.game.homeworldTupileState!.current, null);
  assert.deepEqual(f.game.homeworldTupileState!.leases[lease.id].lost, [f.occupier, f.ally]);
  assert.equal(semutaTupilePlayer(f.game, f.occupier).spice,
    semutaTupilePlayer(f.beforeDeparture, f.occupier).spice - 1);
  assert.equal(semutaTupilePlayer(f.game, f.occupier).reserves,
    semutaTupilePlayer(f.beforeDeparture, f.occupier).reserves + 1);
  assert.equal(semutaTupilePlayer(f.game, f.occupier).shipped, true);
  assert.equal(f.game.active, f.occupier);
  assert.equal(f.game.phase, 5);
  assert.deepEqual(semutaTupileCards(f.game), f.cards);
  assert.ok(semutaTupileForceTotals(f.game).every(row => row.total === 20));
}

function openOriginalCleanup(state: Game, actor: string, action: Parameters<typeof applyAction>[2]): Game {
  const selected = action.cards as string[], event = action.event as string;
  const cards = selected.map(id => semutaTupilePlayer(state, actor).hand.find(card => card.id === id)!);
  const pending = applyAction(state, actor, action);
  const batch = pending.pendingTreacheryDiscard!;
  assert.ok(batch, 'The selected original private cleanup cost must pause before its source suffix');
  assert.deepEqual(batch.batch.entries, cards.map(card => ({ card, discardedBy: actor, publicFace: false })));
  assert.equal(semutaTupilePlayer(pending, actor).hand.length, 4);
  assert.equal(pending.homeworldTupileState!.cleanups.find(row => row.event === event)!.status, 'pending');
  const holder = state.players.find(player => player.hand.some(card => card.id === SEMUTA_DRUG_ID))?.id;
  for (const seat of state.players) {
    const offer = viewGame(pending, seat.id).semutaReaction!;
    assert.deepEqual(offer.candidates, [], 'No private cleanup faces before commitment');
    assert.equal(offer.canCommit, seat.id === holder);
    assert.throws(() => applyAction(pending, seat.id, {
      type: 'semutaSelect', event: batch.batch.event, card: selected[0],
    }));
  }
  assert.throws(() => applyAction(pending, actor, action));
  assert.throws(() => applyAction(pending, state.active!, { type: 'endMovement' }));
  return pending;
}

for (const claimAt of [null, 'first', 'second'] as const) void test(
  `Advanced real Tupile departure: ${claimAt ? `claim ${claimAt}` : 'pass both'} original old-holder costs before native Movement`, () => {
    const f = createSemutaTupileFixture();
    assertOriginalDeparture(f);
    const first = openOriginalCleanup(f.game, f.owner, f.action);
    const firstEvent = first.pendingTreacheryDiscard!.batch.event;
    const firstCard = f.selected[0];
    assert.equal(viewGame(first, f.holder).semutaReaction!.canCommit, true);
    assert.throws(() => applyAction(first, f.owner, { type: 'semutaCommit', event: firstEvent }));
    let game = reactSemutaTupile(first, f.holder, claimAt === 'first');
    assert.equal(game.homeworldTupileState!.cleanups.find(row => row.event === f.event)!.status, 'completed');
    assert.equal(semutaTupilePlayer(game, f.holder).hand.some(card => card.id === firstCard), claimAt === 'first');
    assert.equal(semutaTupilePlayer(game, f.owner).hand.length, 4);
    assert.equal(handLimit(semutaTupilePlayer(game, f.owner)), 4);
    assert.equal(game.decision?.kind, 'homeworldTupileCleanup');
    const second = semutaTupileCleanupStep(game);
    assert.notEqual(second.actor, f.owner);
    assert.notEqual(second.action.event, f.event);
    assert.equal(semutaTupilePlayer(game, second.actor).hand.length, 5, 'Separate old holder has not paid yet');
    assert.throws(() => applyAction(game, f.owner, second.action));
    assert.throws(() => applyAction(game, f.owner, f.action));
    const secondCard = (second.action.cards as string[])[0];
    const secondBefore = game;
    if (claimAt === 'first') {
      game = applyAction(game, second.actor, second.action);
      // Semuta was spent on the first cost; the second ORIGINAL cleanup still
      // discards its own selected card, without creating a fake pair offer.
      if (game.pendingTreacheryDiscard) game = reactSemutaTupile(game, f.holder, false);
    } else {
      const secondPending = openOriginalCleanup(game, second.actor, second.action);
      assert.notEqual(secondPending.pendingTreacheryDiscard!.batch.event, firstEvent);
      assert.equal(secondPending.pendingTreacheryDiscard!.batch.entries.length, 1);
      assert.equal(secondPending.pendingTreacheryDiscard!.batch.entries[0].card.id, secondCard);
      game = reactSemutaTupile(secondPending, f.holder, claimAt === 'second');
    }
    assert.equal(semutaTupilePlayer(game, second.actor).hand.length, 4);
    assert.equal(semutaTupilePlayer(game, f.holder).hand.length, 4, 'Full Richese hand exchanges Semuta rather than gaining capacity');
    assert.equal(semutaTupilePlayer(game, f.holder).hand.some(card => card.id === secondCard), claimAt === 'second');
    for (const row of game.homeworldTupileState!.cleanups) assert.equal(row.status, 'completed');
    assert.equal(game.phase, 5);
    assert.equal(game.active, f.occupier);
    assert.deepEqual(game.movementRemaining, f.game.movementRemaining);
    assert.deepEqual(game.players.map(player => player.spice), f.game.players.map(player => player.spice));
    assert.deepEqual(semutaTupileForceTotals(game), semutaTupileForceTotals(f.game));
    assert.deepEqual(semutaTupileCards(game), f.cards);
    assert.equal(game.discard.filter(card => card.id === firstCard).length, Number(claimAt !== 'first'));
    assert.equal(game.discard.filter(card => card.id === secondCard).length, Number(claimAt !== 'second'));
    assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimAt !== null));
    assert.throws(() => applyAction(game, second.actor, second.action));
    assert.throws(() => applyAction(game, f.holder, { type: 'semutaCommit', event: firstEvent }));
    // The actual unused Movement suffix remains legal exactly once: departure
    // already paid and shipped, and neither cleanup can replay it.
    const suffix = applyAction(game, f.occupier, { type: 'endMovement' });
    assert.ok(!suffix.movementRemaining?.includes(f.occupier));
    assert.notEqual(suffix.active, f.occupier);
    assert.throws(() => applyAction(suffix, f.occupier, { type: 'endMovement' }));
    assert.equal(semutaTupilePlayer(suffix, f.occupier).spice, semutaTupilePlayer(secondBefore, f.occupier).spice);
    assert.deepEqual(semutaTupileCards(suffix), f.cards);
  },
);

void test('neutral Tupile passes keep the next old holder closed until the last seat acknowledges', () => {
  const f = createSemutaTupileFixture();
  let game = openOriginalCleanup(f.game, f.owner, f.action);
  const event = game.pendingTreacheryDiscard!.batch.event;
  for (const seat of game.players.filter(player => player.id !== f.holder)) {
    game = applyAction(game, seat.id, { type: 'semutaPass', event });
    assert.ok(game.pendingTreacheryDiscard);
    assert.equal(game.homeworldTupileState!.cleanups.find(row => row.event === f.event)!.status, 'pending');
    assert.throws(() => applyAction(game, seat.id, { type: 'semutaPass', event }));
  }
  game = applyAction(game, f.holder, { type: 'semutaPass', event });
  assert.equal(game.decision?.kind, 'homeworldTupileCleanup');
  assert.notEqual(game.decision!.player, f.owner);
});


void test('minimal legal bot settles both native Tupile cleanup owners and the full-hand Semuta claim', () => {
  const f = createSemutaTupileFixture();
  let game = f.game;
  for (let n = 0; (game.decision?.kind === 'homeworldTupileCleanup' || game.pendingTreacheryDiscard) && n < 24; n++) {
    const pending = game.pendingTreacheryDiscard;
    const actor = pending?.reaction?.stage === 'offer'
      ? f.holder
      : game.decision!.player;
    const view = viewGame(game, actor);
    view.players.find(player => player.id === actor)!.bot = 'Easy';
    const action = botActions(view)[0];
    assert.ok(action, 'Actual original cleanup / Semuta owner has a legal bot action');
    game = applyAction(game, actor, action);
    if (game.pendingTreacheryDiscard && !semutaTupilePlayer(game, f.holder).hand.some(card => card.id === f.semuta))
      game = reactSemutaTupile(game, f.holder, false);
  }
  assert.equal(game.pendingTreacheryDiscard, null);
  assert.equal(game.pendingHomeworldTupileCleanup, null);
  assert.equal(game.decision, null);
  assert.equal(game.active, f.occupier);
  assert.ok(game.homeworldTupileState!.cleanups.every(row => row.status === 'completed'));
  assert.equal(semutaTupilePlayer(game, f.holder).hand.length, 4);
  assert.deepEqual(semutaTupileCards(game), f.cards);
});
