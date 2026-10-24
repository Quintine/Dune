import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import {
  createSemutaOrnithopterTerrorFixture as fixture, actSemutaOrnithopterTerror as act,
  semutaOrnithopterTerrorPlayer as player, semutaOrnithopterTerrorInventory as inventory,
  passSemutaOrnithopterTerror as pass, claimSemutaOrnithopterTerror as claim,
  type SemutaOrnithopterTerrorFixture,
} from './fixture-semuta-ornithopter-terror';

const balances = (game: Game) => Object.fromEntries(game.players.map(player => [player.id, player.spice]));
const moves = (game: Game) => game.log.filter(row => row.text.startsWith('Guild moved ')).length;
function physical(game: Game, f: SemutaOrnithopterTerrorFixture) {
  assert.equal(player(game, f.entrant).forces[f.location], 1);
  assert.equal(player(game, f.entrant).forces[f.origin] ?? 0, 0);
  assert.equal(player(game, f.entrant).forces['arrakeen:10'] ?? 0, f.mode === 'twoGroups' ? 1 : 0);
  assert.equal(player(game, f.entrant).moved, f.mode === 'twoGroups' ? 2 : 1);
  assert.equal(player(game, f.entrant).ornithopterExtraMoves ?? 0, f.mode === 'twoGroups' ? 1 : 0);
  assert.equal(game.ornithopter, null);
  for (const p of game.players)
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, amount) => sum + amount, 0), 20);
  assert.deepEqual(inventory(game), f.originalInventory);
  assert.deepEqual(balances(game), f.balances);
}
function start(f: SemutaOrnithopterTerrorFixture) {
  const game = act(f.game, f.entrant, f.move), pending = game.pendingTreacheryDiscard;
  assert.equal(pending?.continuation.kind, 'ornithopterDiscard');
  assert.equal(pending.reaction?.stage, 'offer');
  assert.ok(!game.pendingTerrorEntry, 'Original Terror arrival waits for the played-card discard');
  assert.equal(game.moritaniTerror!.tokens.find(token => token.id === f.token)!.status, 'placed');
  assert.equal(moves(game), moves(f.game), 'The committed movement log belongs to the original later arrival suffix');
  physical(game, f); return game;
}
function nativeDiscard(source: Game, f: SemutaOrnithopterTerrorFixture) {
  assert.equal(source.pendingTreacheryDiscard, null);
  assert.equal(source.pendingTerrorEntry?.stage, 'offer');
  assert.equal(source.pendingTerrorEntry.cause, 'movement');
  assert.equal(source.pendingTerrorEntry.token, f.token);
  assert.equal(source.decision?.player, f.owner);
  assert.equal(moves(source), moves(f.game) + 1);
  let game = act(source, f.owner, { type: 'decision', reveal: true });
  if (f.kind === 'robbery') {
    assert.equal(game.pendingTerrorEntry?.stage, 'robbery');
    const size = game.deck.length;
    assert.equal(size, f.game.deck.length);
    game = act(game, f.owner, { type: 'decision', choice: 'card' });
    assert.equal(game.pendingTerrorEntry?.stage, 'discard');
    assert.equal(player(game, f.owner).hand.length, 5);
    assert.ok(player(game, f.owner).hand.some(card => card.id === f.deckTop.id));
    assert.equal(game.deck.length, size - 1, 'Robbery performs its original top draw exactly once');
    game = act(game, f.owner, { type: 'decision', card: f.overflowDiscard });
  }
  const pending = game.pendingTreacheryDiscard;
  assert.equal(pending?.continuation.kind, 'terrorDiscard');
  assert.equal(pending.reaction?.stage, 'offer');
  assert.equal(pending.batch.entries.length, 1);
  assert.equal(pending.batch.entries[0].publicFace, false);
  assert.equal(pending.batch.entries[0].card.id, f.kind === 'sabotage' ? f.entrantCard : f.overflowDiscard);
  assert.equal(game.moritaniTerror!.tokens.find(token => token.id === f.token)!.status, 'removed');
  assert.equal(game.moritaniTerror!.tokens.filter(token => token.status === 'removed').length, 1);
  physical(game, f); return game;
}
function finish(source: Game, f: SemutaOrnithopterTerrorFixture, give = false) {
  let game = source;
  if (f.kind === 'sabotage') {
    assert.equal(game.pendingTerrorEntry?.stage, 'gift');
    assert.equal(game.decision?.player, f.owner);
    game = act(game, f.owner, give
      ? { type: 'decision', card: f.gift }
      : { type: 'decision', decline: true });
    if (give) assert.ok(player(game, f.entrant).hand.some(card => card.id === f.gift));
  }
  assert.ok(!game.pendingTerrorEntry);
  assert.equal(game.pendingTreacheryDiscard, null);
  assert.equal(game.decision, null); assert.equal(game.response, null);
  assert.equal(game.active, f.entrant);
  assert.equal(moves(game), moves(f.game) + 1);
  if (f.kind === 'robbery') {
    assert.equal(game.deck.length, f.game.deck.length - 1);
    assert.equal(player(game, f.owner).hand.length, 4);
  }
  physical(game, f);
  const before = structuredClone(game);
  assert.throws(() => act(game, f.owner, { type: 'decision', reveal: true }));
  assert.deepEqual(game, before, 'A completed native Terror effect cannot be revealed or applied again');
  return act(game, f.entrant, { type: 'endMovement' });
}

for (const kind of ['sabotage', 'robbery'] as const)
  for (const mode of ['range3', 'twoGroups'] as const)
    void test('native Basic ' + kind + ' follows ' + mode + ' Ornithopter discard before its own private Semuta claim', () => {
      const f = fixture({ kind, mode });
      assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, false);
      assert.equal(f.afterSetup.status, 'playing');
      let game = start(f);
      const firstEvent = game.pendingTreacheryDiscard!.batch.event;
      game = pass(game);
      assert.ok(player(game, f.claimant).hand.some(card => card.id === f.semuta));
      assert.ok(!player(game, f.claimant).hand.some(card => card.id === f.ornithopter));
      game = nativeDiscard(game, f);
      assert.notEqual(game.pendingTreacheryDiscard!.batch.event, firstEvent);
      assert.deepEqual(viewGame(game, f.claimant).semutaReaction!.candidates, [],
        'The private native discard is not inspected before committing Semuta');
      const wanted = kind === 'sabotage' ? f.entrantCard : f.overflowDiscard;
      game = claim(game, f.claimant, wanted);
      assert.ok(player(game, f.claimant).hand.some(card => card.id === wanted));
      assert.equal(player(game, f.claimant).hand.length, f.claimantHandSize);
      assert.equal(game.discard.filter(card => card.id === f.ornithopter).length, 1);
      assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
      game = finish(game, f, kind === 'sabotage');
      assert.deepEqual(inventory(game), f.originalInventory);
    });

for (const kind of ['sabotage', 'robbery'] as const)
  void test('claiming a full-hand ' + kind + ' entrant flight preserves native arrival without a second Semuta spend', () => {
    const f = fixture({ kind, mode: 'twoGroups', fullHand: true });
    let game = start(f);
    game = claim(game, f.claimant, f.ornithopter);
    assert.equal(player(game, f.claimant).hand.length, 4);
    assert.ok(player(game, f.claimant).hand.some(card => card.id === f.ornithopter));
    game = nativeDiscard(game, f);
    for (const p of game.players) assert.equal(viewGame(game, p.id).semutaReaction!.canCommit, false);
    game = pass(game);
    assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
    assert.ok(player(game, f.claimant).hand.some(card => card.id === f.ornithopter));
    game = finish(game, f);
    assert.deepEqual(inventory(game), f.originalInventory);
  });

void test('the retired Ornithopter fresh event cannot claim the following private Terror group', () => {
  const f = fixture(), first = start(f), stale = first.pendingTreacheryDiscard!.batch.event;
  const game = nativeDiscard(pass(first), f), before = structuredClone(game);
  assert.notEqual(game.pendingTreacheryDiscard!.batch.event, stale);
  assert.throws(() => act(game, f.claimant, { type: 'semutaCommit', event: stale }));
  assert.deepEqual(game, before);
  const selected = claim(game, f.claimant, f.entrantCard);
  assert.ok(player(selected, f.claimant).hand.some(card => card.id === f.entrantCard));
});

void test('full-hand recovery of the Robbery overflow keeps the already completed top draw and movement', () => {
  const f = fixture({ kind: 'robbery', fullHand: true });
  let game = nativeDiscard(pass(start(f)), f);
  const topAfterDraw = game.deck[0].id;
  assert.equal(player(game, f.owner).hand.length, 4);
  game = claim(game, f.claimant, f.overflowDiscard);
  assert.equal(player(game, f.claimant).hand.length, 4);
  assert.equal(game.deck[0].id, topAfterDraw);
  assert.ok(player(game, f.owner).hand.some(card => card.id === f.deckTop.id));
  game = finish(game, f);
  assert.deepEqual(inventory(game), f.originalInventory);
});
