import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { location } from '../game/board';
import {
  HAJR_ORNITHOPTER, actOrnithopterHajr, advanceOrnithopterHajr, completeOrnithopterHajr,
  createOrnithopterHajrFixture, ornithopterHajrClean, ornithopterHajrMove,
  ornithopterHajrPlayer as player, playOrnithopterHajr, type OrnithopterHajrFixture,
} from './fixture-ornithopter-hajr';

const ownView = (game: Game) => viewGame(game, 'emperor').players.find(player => player.id === 'emperor')!;
function source(f: OrnithopterHajrFixture) {
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'bid' && step.action.amount === 1));
  assert.ok(player(f.game).hand.some(card => card.id === HAJR_ORNITHOPTER));
  assert.ok(player(f.game).hand.some(card => card.id === f.hajr));
  const shipment = f.shipments.find(shipment => shipment.step.actor === f.owner)!;
  assert.equal(player(shipment.before).spice - player(shipment.after).spice, Number(shipment.step.action.amount) * 2,
    'The real source is an originally funded desert shipment, not a staged board group');
  assert.equal(player(f.game).forces[f.source], Number(shipment.step.action.amount));
  assert.equal(ownView(f.game).moved, 0);
  assert.equal(ownView(f.game).movesAllowed, 1);
  assert.equal(ownView(f.game).hajrUsed, false);
  assert.equal(ownView(f.game).hajrAvailable, !f.game.advanced);
}
function settled(f: OrnithopterHajrFixture, completed: Game, moves: number) {
  assert.equal(player(completed).moved, moves);
  assert.equal(ownView(completed).movesAllowed, moves);
  assert.equal(ownView(completed).hajrUsed, true);
  assert.equal(ownView(completed).hajrAvailable, false);
  assert.equal(completed.ornithopter ?? null, null);
  assert.equal(completed.discard.filter(card => card.id === HAJR_ORNITHOPTER).length, 1);
  assert.equal(completed.discard.filter(card => card.id === f.hajr).length, 1);
  assert.equal(player(completed).reserves, player(f.game).reserves);
  assert.equal(player(completed).spice, player(f.game).spice);
  assert.equal(player(completed).tanks, player(f.game).tanks);
  assert.equal(Object.values(player(completed).forces).reduce((sum, count) => sum + count, 0),
    Object.values(player(f.game).forces).reduce((sum, count) => sum + count, 0));
  assert.throws(() => actOrnithopterHajr(completed, f.owner, { type: 'card', card: f.hajr }),
    'The consumed physical Hajr cannot be replayed to add a fourth move');
}

void test('genuine Basic paid Ornithopter composes with Hajr before, during or after two distinct card groups', () => {
  for (const timing of ['before', 'during', 'after'] as const) {
    const f = createOrnithopterHajrFixture();
    source(f);
    const result = completeOrnithopterHajr(f, { timing });
    assert.equal(result.moves.length, 3);
    assert.equal(player(result.first).moved, 1);
    assert.equal(result.first.ornithopter!.completed, 1);
    assert.equal(player(result.flightComplete).moved, 2);
    assert.equal(result.flightComplete.ornithopter ?? null, null);
    assert.equal(ownView(result.beforeExtra).movesAllowed, 3);
    assert.equal(result.moves[2].step.action.from, result.firstDestination,
      'The independent Hajr move may reuse the first card group after the flight ends');
    assert.equal(result.moves[2].step.action.ornithopterEvent, undefined);
    assert.notEqual(result.game.active, f.owner);
    settled(f, result.completed, 3);
  }
});

void test('genuine Advanced Hajr follows a completed typed card group and retains its later ordinary move', () => {
  const f = createOrnithopterHajrFixture({ advanced: true });
  source(f);
  assert.throws(() => actOrnithopterHajr(f.game, f.owner, { type: 'card', card: f.hajr }), /Force Movement|move|movement|immediately/i);
  const result = completeOrnithopterHajr(f, { timing: 'during' });
  assert.equal(ownView(result.first).hajrAvailable, true);
  assert.equal(result.moves[0].step.action.elite, 1);
  assert.equal(result.moves[1].step.action.elite, 1);
  assert.equal(result.moves[2].step.action.elite, 1);
  assert.equal(Object.values(player(result.completed).elites!.forces).reduce((sum, count) => sum + count, 0), 2);
  settled(f, result.completed, 3);
});

void test('a real ordinary move followed by Hajr grants a fresh two-group flight without retroactively counting that move', () => {
  for (const advanced of [false, true]) {
    const f = createOrnithopterHajrFixture({ advanced });
    source(f);
    const result = completeOrnithopterHajr(f, { timing: 'during', priorNormal: true });
    assert.equal(player(result.prior!).moved, 1);
    assert.equal(result.prior!.ornithopter ?? null, null);
    assert.equal(ownView(result.beforeFlight).movesAllowed, 2);
    assert.equal(result.first.ornithopter!.startingMove, 1);
    assert.equal(result.first.ornithopter!.completed, 1);
    assert.equal(player(result.first).moved, 2);
    assert.equal(result.moves[1].step.action.from,
      location(String(result.moves[0].step.action.territory), Number(result.moves[0].step.action.sector)),
      'Units moved by the earlier ordinary entitlement may join a new flight');
    assert.equal(result.moves.length, 3);
    settled(f, result.completed, 3);
  }
});

void test('a genuine range-three card flight replaces one entitlement while same-flight repeated groups remain illegal', () => {
  const f = createOrnithopterHajrFixture();
  source(f);
  const ranged = completeOrnithopterHajr(f, { mode: 'range3', timing: 'after' });
  assert.equal(ranged.moves.length, 2);
  assert.equal(player(ranged.flightComplete).moved, 1);
  settled(f, ranged.completed, 2);
  const firstMove = ornithopterHajrMove(f.game, f.source, { mode: 'twoGroups' });
  let game = actOrnithopterHajr(structuredClone(f.game), f.owner, firstMove);
  game = advanceOrnithopterHajr(game, ornithopterHajrClean);
  const firstDestination = location(String(firstMove.territory), Number(firstMove.sector));
  const repeated = ornithopterHajrMove(game, firstDestination);
  assert.throws(() => actOrnithopterHajr(game, f.owner, repeated), /cohort|unmoved|original|force/i);
  game = playOrnithopterHajr(game, f);
  game = actOrnithopterHajr(game, f.owner, ornithopterHajrMove(game, f.source));
  game = advanceOrnithopterHajr(game, ornithopterHajrClean);
  assert.equal(game.ornithopter ?? null, null);
  assert.equal(ownView(game).movesAllowed, 3);
  game = actOrnithopterHajr(game, f.owner, ornithopterHajrMove(game, firstDestination));
  game = advanceOrnithopterHajr(game, ornithopterHajrClean);
  settled(f, game, 3);
});

void test('a real Advanced Baliset pause preserves Hajr timing until an owner action closes it and the next group reopens it', () => {
  const f = createOrnithopterHajrFixture({ advanced: true, interruption: true, amount: 3 });
  source(f);
  assert.equal(player(f.game, 'choam').forces['oh_gap:9'], 1);
  assert.ok(player(f.game).spice >= 1, 'The smaller real shipment leaves its original bribe funding');
  const firstMove = ornithopterHajrMove(f.game, f.source, { mode: 'twoGroups', to: 'oh_gap:9' });
  let game = actOrnithopterHajr(structuredClone(f.game), f.owner, firstMove);
  assert.equal(game.decision?.kind, 'choamMovement');
  assert.equal(game.decision?.player, 'choam');
  assert.equal(player(game).moved, 0);
  assert.equal(game.ornithopter!.completed, 0);
  assert.throws(() => actOrnithopterHajr(game, f.owner, { type: 'card', card: f.hajr }));
  game = actOrnithopterHajr(game, 'choam', { type: 'decision', decline: true });
  game = advanceOrnithopterHajr(game, ornithopterHajrClean);
  assert.equal(player(game).moved, 1);
  assert.equal(ownView(game).hajrAvailable, true);
  game = actOrnithopterHajr(game, f.owner, { type: 'bribe', target: 'guild', amount: 1 });
  assert.equal(ownView(game).hajrAvailable, false);
  assert.throws(() => actOrnithopterHajr(game, f.owner, { type: 'card', card: f.hajr }), /Force Movement|move|movement|immediately/i);
  game = actOrnithopterHajr(game, f.owner, ornithopterHajrMove(game, f.source));
  game = advanceOrnithopterHajr(game, ornithopterHajrClean);
  assert.equal(player(game).moved, 2);
  assert.equal(ownView(game).hajrAvailable, true);
  game = playOrnithopterHajr(game, f);
  game = actOrnithopterHajr(game, f.owner, ornithopterHajrMove(game, 'oh_gap:9'));
  game = advanceOrnithopterHajr(game, ornithopterHajrClean);
  assert.equal(player(game).moved, 3);
  assert.equal(ownView(game).movesAllowed, 3);
  assert.equal(player(game).spice, player(f.game).spice - 1);
  assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  assert.equal(game.discard.filter(card => card.id === HAJR_ORNITHOPTER).length, 1);
});

void test('all four minimal policies retain legal second-flight and earned Hajr movement candidates from original pending views', () => {
  const f = createOrnithopterHajrFixture();
  let first = actOrnithopterHajr(structuredClone(f.game), f.owner,
    ornithopterHajrMove(f.game, f.source, { mode: 'twoGroups' }));
  first = advanceOrnithopterHajr(first, ornithopterHajrClean);
  first = playOrnithopterHajr(first, f);
  const complete = actOrnithopterHajr(first, f.owner, ornithopterHajrMove(first, f.source));
  const ready = advanceOrnithopterHajr(complete, ornithopterHajrClean);
  assert.equal(ownView(ready).movesAllowed, 3);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    for (const game of [first, ready]) {
      const view = viewGame(game, f.owner);
      view.players.find(player => player.id === f.owner)!.bot = difficulty;
      const action = botActions(view).find(action => action.type === 'move');
      assert.ok(action, `${difficulty} must keep an owned legal ${game.ornithopter ? 'second flight' : 'Hajr'} movement`);
      assert.equal(typeof action.ornithopterEvent === 'string', !!game.ornithopter);
      const moved = actOrnithopterHajr(structuredClone(game), f.owner, action);
      assert.ok(player(moved).moved === player(game).moved + 1 || moved.response || moved.decision,
        'Each real policy candidate completes its group or enters its original reaction');
    }
  }
});
