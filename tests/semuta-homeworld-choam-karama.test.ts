import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { advanceSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import {
  semutaHomeworldChoamMovementResources as resources,
  semutaHomeworldChoamMovementStock as stock,
  withoutSemutaHomeworldChoamMovementHolder,
} from './fixture-semuta-homeworld-choam-movement';
import { semutaHomeworldChoamReturnsForces } from './fixture-semuta-homeworld-choam-returns';
import {
  cancelSemutaHomeworldChoamKarama, createSemutaHomeworldChoamKaramaFixture,
  reactSemutaHomeworldChoamKarama, type SemutaHomeworldChoamKaramaFixture,
} from './fixture-semuta-homeworld-choam-karama';

function assertCancellation(f: SemutaHomeworldChoamKaramaFixture, done: Game, claim: boolean) {
  assert.ok(!done.pendingTreacheryDiscard);
  assert.ok(!done.response);
  assert.equal(done.turn, f.beforeDeclaration.turn);
  assert.equal(done.phase, f.beforeDeclaration.phase);
  assert.deepEqual(stock(done), stock(f.beforeDeclaration));
  assert.deepEqual(semutaHomeworldChoamReturnsForces(done), semutaHomeworldChoamReturnsForces(f.beforeDeclaration));
  assert.equal(player(done, f.owner).hand.filter(card => card.id === f.card).length, 1,
    'Canceled printed fuel stays with its original CHOAM owner');
  assert.equal(player(done, f.holder).hand.some(card => card.id === f.card), false);
  assert.equal(done.discard.some(card => card.id === f.card), false);
  assert.equal(player(done, f.canceller).hand.some(card => card.id === f.karama), false);
  assert.equal(player(done, f.holder).hand.some(card => card.id === f.karama), claim);
  assert.equal(player(done, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
  assert.equal(done.discard.filter(card => card.id === f.karama).length, Number(!claim));
  assert.equal(done.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, Number(claim));
  for (const seat of done.players) {
    assert.equal(seat.hand.length, player(f.beforeDeclaration, seat.id).hand.length - Number(seat.id === f.canceller),
      'Only Emperor loses a card; a claim is an exact one-for-one Semuta exchange');
    assert.equal(seat.spice, player(f.beforeDeclaration, seat.id).spice);
    assert.equal(seat.revived, player(f.beforeDeclaration, seat.id).revived);
    assert.equal(seat.freeForcesRevived, player(f.beforeDeclaration, seat.id).freeForcesRevived);
  }
  assert.throws(() => applyAction(done, f.canceller, f.cancelAction), 'Paid original Karama cannot cancel again');
  assert.throws(() => applyAction(done, f.owner, f.action), 'Retained printed fuel cannot replay this phase');
  if (claim) assert.throws(() => applyAction(done, f.holder, f.action),
    'Only Karama is recovered; Richese never acquires the canceled CHOAM power');

  if (f.power === 'baliset') {
    const movement = f.movement!;
    const declined = applyAction(f.beforeDeclaration, f.owner, { type: 'decision', decline: true });
    assert.deepEqual(resources(done), resources(declined),
      'Canceling Baliset commits exactly the original unmodified reactive move');
    assert.equal(player(done, f.target).moved, 1);
    assert.equal(player(done, f.target).forces[movement.origin], player(movement.beforeMove, f.target).forces[movement.origin] - 1);
    assert.equal(player(done, f.target).forces[movement.destination], 1);
    assert.ok(!done.pendingChoamMove);
    assert.deepEqual(viewGame(done, f.target).balisetRestrictions, []);
    assert.throws(() => applyAction(done, f.target, movement.move), 'The original move cannot resume twice');
    assert.equal(player(done, f.owner).reserves, player(movement.afterShipment, f.owner).reserves);
  } else {
    assert.deepEqual(resources(done), resources(f.beforeDeclaration),
      'Canceling a power never applies its original resources or counters');
    if (f.power === 'kulon') {
      assert.equal(viewGame(done, f.owner).choamMovementBonus, 0);
      assert.throws(() => applyAction(done, f.owner, f.movement!.move), 'Kulon cancellation gives no range-two bonus');
      assert.equal(player(done, f.owner).reserves, player(f.movement!.afterShipment, f.owner).reserves);
    } else if (f.power === 'laLaLa') {
      const before = viewGame(f.beforeDeclaration, f.target).revival;
      const after = viewGame(done, f.target).revival;
      assert.ok(before.freeRemaining > 0);
      assert.equal(after.freeRemaining, before.freeRemaining);
      assert.equal(after.freeBlocked, false);
      assert.equal(after.limit, before.limit);
      for (const seat of done.players)
        assert.equal(viewGame(done, seat.id).revival.freeRemaining, viewGame(f.beforeDeclaration, seat.id).revival.freeRemaining);
    } else {
      assert.deepEqual(viewGame(done, f.target).homeworlds!.worlds!.map(world => world.forces),
        viewGame(f.beforeDeclaration, f.target).homeworlds!.worlds!.map(world => world.forces));
      assert.equal(done.decision?.kind, 'choamMentat');
      assert.equal(done.decision!.player, f.owner);
      assert.equal(done.choamMentatPending, true);
      assert.equal(viewGame(done, f.target).mentatVictoryPending, true);
      assert.throws(() => applyAction(done, f.target, { type: 'decision', done: true }));
    }
  }
}

function consumeCancellationSuffix(f: SemutaHomeworldChoamKaramaFixture, state: Game) {
  const after = f.power === 'gamont'
    ? applyAction(state, f.owner, { type: 'decision', done: true })
    : advanceSemutaHomeworldChoam(state, game => game.phase > state.phase
      && !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard);
  assert.equal(after.status, 'playing');
  assert.equal(after.turn, state.turn + Number(f.power === 'gamont'));
  assert.deepEqual(stock(after), stock(state));
  assert.deepEqual(semutaHomeworldChoamReturnsForces(after), semutaHomeworldChoamReturnsForces(state));
  for (const seat of after.players) {
    const before = player(state, seat.id);
    assert.deepEqual(seat.forces, before.forces, 'Native suffix cannot run a canceled move or return a second time');
    assert.deepEqual(seat.elites, before.elites);
    assert.equal(seat.reserves, before.reserves);
    assert.equal(seat.tanks, before.tanks);
  }
  if (f.power === 'gamont') {
    assert.equal(after.phase, 0);
    assert.equal(after.choamMentatPending, false);
    assert.throws(() => applyAction(after, f.owner, { type: 'decision', done: true }),
      'The original CHOAM close is consumed exactly once');
  } else assert.ok(after.phase >= (f.power === 'laLaLa' ? 5 : 6));
}

for (const advanced of [false, true]) for (const power of ['kulon', 'baliset', 'laLaLa', 'gamont'] as const) {
  const label = `${advanced ? 'Advanced' : 'Basic'} Homeworld printed ${power} cancellation`;
  for (const claim of [false, true]) void test(`${label}: Semuta ${claim ? 'claims' : 'passes'} only original Emperor Karama before one native denial suffix`, () => {
    const f = createSemutaHomeworldChoamKaramaFixture(power, advanced);
    if (f.movement) {
      assert.equal(player(f.movement.afterShipment, f.owner).spice, player(f.movement.beforeShipment, f.owner).spice - 2);
      assert.equal(player(f.movement.afterShipment, f.owner).reserves, player(f.movement.beforeShipment, f.owner).reserves - 1);
    }
    const pending = cancelSemutaHomeworldChoamKarama(f);
    const cost = pending.pendingTreacheryDiscard;
    assert.ok(cost, 'Actual Karama spending pauses before printed denial and original continuation');
    assert.equal(pending.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(player(pending, f.owner).hand.some(card => card.id === f.card), true);
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    assert.deepEqual(resources(pending), resources(f.beforeDeclaration), 'Original move/return stays uncommitted during recovery');
    assert.deepEqual(stock(pending), stock(f.beforeDeclaration));
    assert.throws(() => applyAction(pending, f.canceller, f.cancelAction));
    assert.throws(() => applyAction(pending, f.owner, f.action));
    assert.throws(() => applyAction(pending, f.target, { type: 'ready' }));
    assert.throws(() => applyAction(pending, f.owner, { type: 'decision', done: true }));
    assert.throws(() => applyAction(pending, f.target, { type: 'semutaCommit', event: cost.batch.event }));
    if (f.movement) assert.throws(() => applyAction(pending, f.target, f.movement!.move));
    const done = reactSemutaHomeworldChoamKarama(structuredClone(pending), f.holder, claim);
    assertCancellation(f, done, claim);
    assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event: cost.batch.event }));
    assert.throws(() => applyAction(done, f.target, { type: 'semutaPass', event: cost.batch.event }));
    consumeCancellationSuffix(f, done);
  });

  void test(`${label}: actual entitlement is private and cancellation cost is a singleton exchange`, () => {
    const f = createSemutaHomeworldChoamKaramaFixture(power, advanced, power === 'kulon' || power === 'baliset');
    const pending = cancelSemutaHomeworldChoamKarama(f);
    const absent = withoutSemutaHomeworldChoamMovementHolder(f.game, f.holder);
    const neutral = cancelSemutaHomeworldChoamKarama(f, absent);
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    for (const seat of pending.players.filter(seat => seat.id !== f.holder)) {
      assert.deepEqual(viewGame(pending, seat.id), viewGame(neutral, seat.id));
      assert.equal(viewGame(pending, seat.id).semutaReaction?.canCommit, false);
      assert.throws(() => applyAction(pending, seat.id,
        { type: 'semutaCommit', event: pending.pendingTreacheryDiscard!.batch.event }));
    }
    const done = reactSemutaHomeworldChoamKarama(pending, f.holder, true);
    assertCancellation(f, done, true);
    if (f.movement) assert.equal(player(done, f.holder).hand.length, handLimit(player(done, f.holder)),
      'Printed Karama exchange remains legal at the native hand limit');
    const noHolder = reactSemutaHomeworldChoamKarama(neutral, f.holder, false);
    assert.equal(noHolder.discard.filter(card => card.id === f.karama).length, 1);
    assert.deepEqual(resources(noHolder), resources(done));
    consumeCancellationSuffix(f, done);
  });

  for (const difficulty of DIFFICULTIES) void test(`${difficulty} legally claims or passes ${label} then consumes original controls`, () => {
    const f = createSemutaHomeworldChoamKaramaFixture(power, advanced);
    let game = cancelSemutaHomeworldChoamKarama(f);
    const own = viewGame(game, f.holder);
    own.players.find(seat => seat.id === f.holder)!.bot = difficulty;
    const action = botActions(own)[0];
    assert.ok(action);
    assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass');
    game = applyAction(game, f.holder, action);
    if (game.pendingTreacheryDiscard) game = reactSemutaHomeworldChoamKarama(game, f.holder, false);
    assertCancellation(f, game, action.type === 'semutaCommit');
    if (power === 'gamont') {
      const closing = viewGame(game, f.owner);
      closing.players.find(seat => seat.id === f.owner)!.bot = difficulty;
      const close = botActions(closing)[0];
      assert.ok(close);
      const done = applyAction(game, f.owner, close);
      assert.equal(done.phase, 0);
      assert.equal(done.turn, game.turn + 1);
      assert.equal(done.choamMentatPending, false);
      assert.deepEqual(player(done, f.target).forces, player(game, f.target).forces);
      assert.deepEqual(done.homeworlds?.custody, game.homeworlds?.custody);
      assert.deepEqual(stock(done), stock(game));
    } else consumeCancellationSuffix(f, game);
  });
}
