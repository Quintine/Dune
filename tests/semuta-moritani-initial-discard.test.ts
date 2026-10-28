import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  semutaMoritaniRetentionFixture,
  resolveSemutaMoritaniBattle,
  finishSemutaMoritaniWinner,
  chooseSemutaMoritaniRetention,
  passSemutaMoritaniDiscard,
  semutaMoritaniPlayer as player,
  semutaMoritaniInventory as inventory,
  semutaMoritaniResources as resources,
  semutaMoritaniReload as reload,
} from './fixture-semuta-moritani-retention';

function rejectWithoutMutation(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

for (const claim of [false, true]) {
  void test(`Semuta ${claim ? 'claims' : 'passes'} a losing allied Hero before Moritani retention`, () => {
    const fixture = semutaMoritaniRetentionFixture();
    // Controlled physical-card substitution: retain the same genuine Basic
    // Richese/Moritani roster and battle; move one existing Hero to the loser.
    const heroIndex = fixture.game.deck.findIndex(card => card.kind === 'hero');
    assert.notEqual(heroIndex, -1, 'A physical Cheap Hero must be available.');
    const [hero] = fixture.game.deck.splice(heroIndex, 1);
    player(fixture.game, 'l').hand.push(hero);
    fixture.loserLeader = hero.id;
    fixture.loserStrength = 0;
    assert.deepEqual(inventory(fixture.game), fixture.cards);

    const pending = resolveSemutaMoritaniBattle(fixture);
    const original = structuredClone(resources(pending));
    assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    const receipt = pending.pendingTreacheryDiscard!;
    assert.equal(receipt.batch.cause, 'battle:mandatory');
    assert.equal(receipt.continuation.kind, 'battleResolved');
    assert.deepEqual(receipt.batch.entries.map(entry => [entry.discardedBy, entry.card.id]), [['l', hero.id]]);
    assert.equal(pending.discard.filter(card => card.id === hero.id).length, 1);
    assert.equal(pending.moritaniRetention?.stage, 'choose');
    assert.deepEqual(pending.moritaniRetention!.played, [fixture.weapon, fixture.defense]);
    assert.deepEqual(pending.moritaniRetention!.eligible, [fixture.weapon, fixture.defense]);
    assert.equal(player(pending, 'l').hand.some(card => card.id === hero.id), false);
    const event = receipt.batch.event;
    for (const id of ['r', 'm', 'w', 'l'])
      assert.deepEqual(viewGame(reload(pending), id).semutaReaction?.candidates, []);
    rejectWithoutMutation(pending, 'l', { type: 'decision', keep: fixture.weapon });
    rejectWithoutMutation(pending, 'r', { type: 'semutaCommit', event: 'stale-event' });

    let resumed = claim
      ? applyAction(reload(pending), 'r', { type: 'semutaCommit', event })
      : passSemutaMoritaniDiscard(reload(pending));
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.equal(resumed.decision?.kind, 'battleCards');
    assert.deepEqual(resources(resumed), original);
    assert.equal(player(resumed, 'r').hand.some(card => card.id === hero.id), claim);
    assert.equal(resumed.discard.some(card => card.id === hero.id), !claim);
    assert.equal(resumed.discard.filter(card => card.id === fixture.semuta).length, Number(claim));
    assert.deepEqual(resumed.moritaniRetention, pending.moritaniRetention);

    resumed = finishSemutaMoritaniWinner(resumed);
    assert.equal(resumed.decision?.kind, 'moritaniRetention');
    rejectWithoutMutation(resumed, 'l', { type: 'decision', keep: hero.id });
    const later = chooseSemutaMoritaniRetention(resumed, fixture.weapon);
    assert.equal(later.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.equal(later.pendingTreacheryDiscard!.batch.cause, 'battle:moritani');
    assert.deepEqual(later.pendingTreacheryDiscard!.batch.entries.map(entry => entry.card.id), [fixture.defense]);
    const final = passSemutaMoritaniDiscard(later);
    assert.equal(final.moritaniRetention, null);
    assert.equal(final.pendingTreacheryDiscard, null);
    assert.equal(player(final, 'l').hand.some(card => card.id === fixture.weapon), true);
    assert.equal(final.discard.some(card => card.id === fixture.defense), true);
    assert.deepEqual(resources(final), original);
    assert.deepEqual(inventory(final), fixture.cards);
  });
}
