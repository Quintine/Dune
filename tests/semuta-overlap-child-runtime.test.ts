import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { claimOverlapSemuta, passCurrentSemuta } from './fixture-semuta-arrival-overlap';
import { act, inventory, player, createSemutaOverlapChildFixture, openSemutaOverlapChild } from './fixture-semuta-overlap-child';

for (const claim of [false, true]) {
  void test(`Richese may ${claim ? 'claim' : 'pass'} a child Sabotage discard before the original overlap continues`, () => {
    const f = createSemutaOverlapChildFixture();
    let game = openSemutaOverlapChild(f);
    const before = structuredClone(game), hand = player(game, f.owner).hand.map(card => card.id);
    assert.equal(game.pendingArrivalOverlap?.stage, 'first');
    assert.equal(game.pendingTerrorEntry?.entrant, f.owner);
    game = act(game, f.moritani, { type: 'decision', reveal: true });
    const pending = game.pendingTreacheryDiscard; assert.ok(pending);
    assert.equal(pending.reaction?.stage, 'offer');
    assert.equal(pending.continuation.kind, 'terrorDiscard');
    assert.equal(pending.batch.entries.length, 1);
    const entry = pending.batch.entries[0], card = entry.card.id, event = pending.batch.event;
    assert.equal(entry.discardedBy, f.owner);
    assert.equal(entry.publicFace, false);
    assert.ok(hand.includes(card), 'Sabotage discards an original held physical card');
    assert.equal(player(game, f.owner).hand.length, hand.length - 1);
    assert.ok(game.pendingArrivalOverlap, 'The original overlap remains suspended');
    assert.deepEqual(viewGame(game, f.claimant).semutaReaction?.candidates, []);
    assert.equal(player(game, f.entrant).forces[f.location], 1);
    assert.equal(player(game, f.entrant).spice, player(before, f.entrant).spice);
    assert.deepEqual(inventory(game), f.originalInventory);

    game = claim ? claimOverlapSemuta(game, f.claimant, card) : passCurrentSemuta(game);
    assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event);
    assert.equal(player(game, f.claimant).hand.some(held => held.id === card), claim);
    assert.equal(player(game, f.claimant).hand.some(held => held.id === f.semuta), !claim);
    assert.equal(game.discard.some(discarded => discarded.id === card), !claim);
    assert.equal(game.discard.some(discarded => discarded.id === f.semuta), claim);
    assert.equal(game.moritaniTerror?.tokens.find(token => token.id === f.terrorToken)?.status, 'removed');
    if (game.pendingTerrorEntry?.stage === 'gift')
      game = act(game, f.moritani, { type: 'decision', decline: true });
    assert.equal(game.pendingArrivalOverlap, null, 'A consumed shared Terror is not offered again');
    assert.equal(game.pendingAmbassador, null);
    assert.equal(game.pendingTerrorEntry, null);
    assert.equal(player(game, f.entrant).forces[f.location], 1);
    assert.equal(player(game, f.owner).forces[f.location], 1);
    assert.equal(player(game, f.entrant).spice, player(before, f.entrant).spice);
    assert.deepEqual(inventory(game), f.originalInventory);
  });
}
