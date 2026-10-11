import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  semutaMoritaniRetentionFixture,
  resolveSemutaMoritaniBattle, finishSemutaMoritaniWinner, chooseSemutaMoritaniRetention,
  allowSemutaMoritaniResponse, claimSemutaMoritaniDiscard, passSemutaMoritaniDiscard,
  semutaMoritaniPlayer as player, semutaMoritaniInventory as inventory,
  semutaMoritaniResources as resources, semutaMoritaniReload as reload,
  semutaMoritaniPolicy, type SemutaMoritaniFixture,
} from './fixture-semuta-moritani-retention';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function retentionOffer(f: SemutaMoritaniFixture) {
  const game = finishSemutaMoritaniWinner(resolveSemutaMoritaniBattle(f));
  assert.equal(game.decision?.kind, 'moritaniRetention'); assert.equal(game.decision?.player, 'l');
  assert.equal(game.moritaniRetention?.owner, 'm'); assert.equal(game.moritaniRetention?.source, undefined);
  assert.deepEqual(game.moritaniRetention!.played, [f.weapon, f.defense]);
  assert.deepEqual(game.moritaniRetention!.eligible, [f.weapon, f.defense]);
  for (const actor of ['r', 'm', 'w']) {
    const view = viewGame(reload(game), actor);
    assert.equal(view.players.find(p => p.id === 'l')!.hand, undefined);
    assert.equal(JSON.stringify(view.moritaniRetention).includes(f.unrelated), false);
    assert.deepEqual(view.moritaniRetention?.played, [f.weapon, f.defense]);
  }
  rejected(game, 'm', { type: 'decision', keep: f.weapon });
  rejected(game, 'l', { type: 'decision', keep: f.unrelated });
  rejected(game, 'l', { type: 'decision', keep: [f.weapon, f.defense] });
  return game;
}
function finalQuantities(game: Game, f: SemutaMoritaniFixture, before: Game, keep: string | null, claimed: string | null, karamaSpent = false) {
  assert.equal(game.phase, 7); assert.equal(game.battle, null); assert.equal(game.moritaniRetention, null);
  assert.equal(game.pendingTreacheryDiscard, null); assert.equal(game.response, null);
  assert.equal(game.decision, null);
  assert.equal(player(game, 'w').tanks, 2); assert.deepEqual(player(game, 'w').forces, { 'arrakeen:10': 3 });
  assert.equal(player(game, 'l').tanks, 5); assert.deepEqual(player(game, 'l').forces, {});
  assert.equal(player(game, 'w').reserves, 15); assert.equal(player(game, 'l').reserves, 15);
  for (const id of ['r', 'm']) { assert.equal(player(game, id).tanks, 0); assert.equal(player(game, id).reserves, 20); }
  for (const id of ['r', 'm', 'l']) assert.equal(player(game, id).spice, player(f.game, id).spice);
  assert.equal(player(game, 'w').spice, player(f.game, 'w').spice + f.loserStrength);
  assert.equal(player(game, 'l').leaders.find(l => l.id === f.loserLeader)!.dead, true);
  assert.deepEqual(resources(game), resources(before), 'Reaction must not repeat combat losses, bounty, payment or leader death.');
  for (const card of [f.weapon, f.defense]) {
    assert.equal(player(game, 'l').hand.some(c => c.id === card), card === keep);
    assert.equal(player(game, 'r').hand.some(c => c.id === card), card === claimed);
    assert.equal(game.discard.some(c => c.id === card), card !== keep && card !== claimed);
  }
  assert.equal(player(game, 'l').hand.some(c => c.id === f.unrelated), true);
  assert.equal(player(game, 'r').hand.some(c => c.id === f.semuta), claimed === null);
  assert.equal(game.discard.filter(c => c.id === f.semuta).length, Number(claimed !== null));
  if (f.karama) assert.equal(game.discard.filter(c => c.id === f.karama).length, Number(karamaSpent));
  assert.deepEqual(inventory(game), f.cards);
}


for (const choice of ['weapon', 'defense', 'none'] as const) for (const claim of [false, true]) {
  void test(`Semuta ${claim ? 'claims' : 'passes'} completed Moritani discard after keeping ${choice}, without re-offering cleanup`, () => {
    const f = semutaMoritaniRetentionFixture(), offered = retentionOffer(f);
    const keep = choice === 'none' ? null : f[choice];
    let pending = chooseSemutaMoritaniRetention(reload(offered), keep);
    pending = allowSemutaMoritaniResponse(pending);
    assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    const receipt = pending.pendingTreacheryDiscard!, event = receipt.batch.event;
    assert.equal(receipt.batch.cause, 'battle:moritani'); assert.equal(receipt.continuation.kind, 'battleCleanup');
    if (receipt.continuation.kind !== 'battleCleanup') throw Error('Expected original typed battle cleanup.');
    assert.equal(receipt.continuation.source, 'moritani'); assert.equal(receipt.continuation.player, 'l');
    assert.deepEqual(receipt.continuation.kept, keep ? [keep] : []);
    assert.deepEqual(receipt.continuation.played, [f.weapon, f.defense]);
    assert.equal(receipt.continuation.retention?.owner, 'm');
    assert.equal(pending.moritaniRetention, null);
    const fresh = [f.weapon, f.defense].filter(card => card !== keep);
    assert.deepEqual(receipt.batch.entries.map(e => e.card.id), fresh);
    assert.equal(receipt.batch.entries.every(e => e.publicFace && e.discardedBy === 'l'), true);
    assert.equal(fresh.every(card => pending.discard.some(c => c.id === card)), true, 'Physical discard precedes the reaction.');
    for (const id of ['r', 'm', 'w', 'l']) assert.deepEqual(viewGame(reload(pending), id).semutaReaction?.candidates, []);
    rejected(pending, 'l', { type: 'decision', keep });
    rejected(pending, 'r', { type: 'semutaSelect', event, card: fresh[0] });
    let final: Game;
    if (claim) {
      let committed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
      if (fresh.length === 2) {
        assert.equal(committed.pendingTreacheryDiscard?.reaction?.stage, 'select');
        assert.deepEqual(viewGame(committed, 'r').semutaReaction!.candidates.map(c => c.id), fresh);
        for (const id of ['m', 'w', 'l']) assert.deepEqual(viewGame(committed, id).semutaReaction!.candidates, []);
        rejected(committed, 'm', { type: 'semutaSelect', event, card: fresh[0] });
        rejected(committed, 'r', { type: 'semutaSelect', event, card: f.unrelated });
        rejected(committed, 'r', { type: 'semutaPass', event });
        committed = applyAction(reload(committed), 'r', { type: 'semutaSelect', event, card: fresh[0] });
      }
      final = committed;
    } else final = passSemutaMoritaniDiscard(reload(pending));
    finalQuantities(final, f, pending, keep, claim ? fresh[0] : null);
    rejected(final, 'l', { type: 'decision', keep });
    rejected(final, 'r', { type: 'semutaCommit', event });
    rejected(final, 'r', { type: 'semutaSelect', event, card: fresh[0] });
    if (keep) {
      const committed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
      rejected(committed, 'r', { type: 'semutaSelect', event, card: keep });
      assert.equal(player(committed, 'l').hand.some(c => c.id === keep), true);
    }
  });
}

for (const holder of ['w', 'l'] as const) for (const cancel of [false, true]) {
  void test(`Original retention Karama response permits ${holder} to ${cancel ? 'cancel' : 'allow'} before Semuta sees the final batch`, () => {
    const f = semutaMoritaniRetentionFixture({ karamaHolder: holder }), offered = retentionOffer(f);
    const response = chooseSemutaMoritaniRetention(reload(offered), f.weapon);
    assert.equal(response.response?.kind, 'moritaniRetention'); assert.equal(response.response?.owner, 'm');
    assert.equal(viewGame(response, 'w').semutaReaction, null);
    assert.equal(viewGame(response, 'w').moritaniRetentionCard?.id, f.weapon);
    rejected(response, 'l', { type: 'card', card: f.weapon, mode: 'discard' });
    const settled = cancel
      ? applyAction(reload(response), holder, { type: 'card', card: f.karama!, mode: 'cancel' })
      : allowSemutaMoritaniResponse(reload(response));
    assert.equal(settled.pendingTreacheryDiscard?.batch.cause, 'battle:moritani');
    assert.equal(settled.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.deepEqual(settled.pendingTreacheryDiscard!.batch.entries.map(e => e.card.id), cancel ? [f.weapon, f.defense] : [f.defense]);
    const expected = cancel ? f.weapon : f.defense;
    const final = claimSemutaMoritaniDiscard(reload(settled), expected);
    finalQuantities(final, f, settled, cancel ? null : f.weapon, expected, cancel);
  });
}

void test('Moritani cannot cancel its own alliance power with its own unreserved Karama', () => {
  const f = semutaMoritaniRetentionFixture({ karamaHolder: 'm' }), offered = retentionOffer(f);
  const pending = chooseSemutaMoritaniRetention(offered, f.weapon);
  assert.equal(pending.response, null, 'Only the owner holds Karama: original automatic allowance applies.');
  assert.equal(pending.pendingTreacheryDiscard?.batch.cause, 'battle:moritani');
  rejected(pending, 'm', { type: 'card', card: f.karama!, mode: 'cancel' });
  const final = claimSemutaMoritaniDiscard(pending);
  finalQuantities(final, f, pending, f.weapon, f.defense);
  assert.equal(player(final, 'm').hand.some(c => c.id === f.karama), true);
});

void test('Winner optional fresh cleanup pauses with the later native retention choice still reserved', () => {
  const f = semutaMoritaniRetentionFixture();
  const pending = finishSemutaMoritaniWinner(resolveSemutaMoritaniBattle(f), [f.winnerWeapon]);
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.pendingTreacheryDiscard?.batch.cause, 'battle:winner');
  assert.equal(pending.moritaniRetention?.stage, 'choose');
  assert.equal(pending.moritaniRetention?.player, 'l');
  for (const claim of [false, true]) {
    const resumed = claim ? claimSemutaMoritaniDiscard(reload(pending)) : passSemutaMoritaniDiscard(reload(pending));
    assert.equal(resumed.decision?.kind, 'moritaniRetention');
    assert.deepEqual(resumed.moritaniRetention, pending.moritaniRetention);
    assert.deepEqual(resources(resumed), resources(pending));
    let final = chooseSemutaMoritaniRetention(resumed, f.weapon);
    if (claim) {
      assert.equal(final.pendingTreacheryDiscard?.reaction?.stage, 'offer');
      final = passSemutaMoritaniDiscard(final);
    } else final = claimSemutaMoritaniDiscard(final);
    assert.equal(final.phase, 7); assert.equal(final.moritaniRetention, null);
    assert.equal(player(final, 'r').hand.some(c => c.id === (claim ? f.winnerWeapon : f.defense)), true);
    assert.deepEqual(inventory(final), f.cards); assert.deepEqual(resources(final), resources(pending));
  }
});

void test('Winner compulsory Cheap Hero batch precedes optional cleanup and Moritani retention without replaying losses', () => {
  const f = semutaMoritaniRetentionFixture({ winnerMandatory: true }), pending = resolveSemutaMoritaniBattle(f);
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'winnerMandatoryDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.batch.cause, 'battle:winnerMandatory');
  assert.deepEqual(pending.pendingTreacheryDiscard!.batch.entries.map(e => e.card.id), [f.winnerHero]);
  assert.equal(pending.moritaniRetention?.stage, 'choose');
  for (const claim of [false, true]) {
    let resumed = claim ? claimSemutaMoritaniDiscard(reload(pending)) : passSemutaMoritaniDiscard(reload(pending));
    assert.equal(resumed.decision?.kind, 'battleCards');
    assert.deepEqual(resumed.moritaniRetention, pending.moritaniRetention);
    assert.deepEqual(resources(resumed), resources(pending));
    resumed = finishSemutaMoritaniWinner(resumed);
    assert.equal(resumed.decision?.kind, 'moritaniRetention');
    const discarded = chooseSemutaMoritaniRetention(resumed, f.weapon);
    assert.equal(discarded.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    const final = passSemutaMoritaniDiscard(discarded);
    assert.equal(final.phase, 7); assert.equal(final.moritaniRetention, null);
    assert.equal(player(final, 'r').hand.some(c => c.id === f.winnerHero), claim);
    assert.equal(final.discard.some(c => c.id === f.winnerHero), !claim);
    assert.deepEqual(resources(final), resources(pending)); assert.deepEqual(inventory(final), f.cards);
    assert.equal(player(final, 'w').tanks, 2); assert.equal(player(final, 'l').tanks, 5);
  }
});

void test('All four bot profiles participate legally in native retention and sole/multiple Semuta batches', () => {
  const f = semutaMoritaniRetentionFixture(), offered = retentionOffer(f);
  for (const profile of DIFFICULTIES) {
    const choice = semutaMoritaniPolicy(reload(offered), 'l', profile)[0]; assert.ok(choice);
    const chosen = applyAction(reload(offered), 'l', choice);
    assert.equal(chosen.moritaniRetention == null || chosen.moritaniRetention.stage === 'response', true);
    for (const keep of [f.weapon, null]) {
      let pending = chooseSemutaMoritaniRetention(reload(offered), keep);
      assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
      for (let step = 0; pending.pendingTreacheryDiscard && step < 8; step++) {
        const reaction = pending.pendingTreacheryDiscard.reaction; assert.ok(reaction);
        const actor = reaction.stage === 'select' ? reaction.player
          : pending.players.find(p => !reaction.passed.includes(p.id))!.id;
        const action = semutaMoritaniPolicy(reload(pending), actor, profile)[0]; assert.ok(action);
        pending = applyAction(reload(pending), actor, action);
      }
      assert.equal(pending.pendingTreacheryDiscard, null); assert.equal(pending.phase, 7);
      assert.deepEqual(inventory(pending), f.cards);
    }
  }
});

void test('Multiple discarded Moritani cards permit either exact fresh selection, never the unrelated hand card', () => {
  const f = semutaMoritaniRetentionFixture(), pending = chooseSemutaMoritaniRetention(retentionOffer(f), null);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  for (const card of [f.weapon, f.defense]) {
    const committed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
    assert.equal(committed.pendingTreacheryDiscard?.reaction?.stage, 'select');
    assert.deepEqual(resources(committed), resources(pending));
    const final = applyAction(reload(committed), 'r', { type: 'semutaSelect', event, card });
    finalQuantities(final, f, pending, null, card);
  }
});

void test('Defeated ally claiming the winner card cannot add it to its original retention pool', () => {
  const f = semutaMoritaniRetentionFixture({ semutaHolder: 'l' });
  const pending = finishSemutaMoritaniWinner(resolveSemutaMoritaniBattle(f), [f.winnerWeapon]);
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const resumed = applyAction(reload(pending), 'l', { type: 'semutaCommit', event });
  assert.equal(resumed.decision?.kind, 'moritaniRetention');
  assert.deepEqual(resumed.moritaniRetention!.played, [f.weapon, f.defense]);
  assert.deepEqual(resumed.moritaniRetention!.eligible, [f.weapon, f.defense]);
  assert.equal(player(resumed, 'l').hand.some(c => c.id === f.winnerWeapon), true);
  assert.equal(resumed.discard.filter(c => c.id === f.semuta).length, 1);
  assert.deepEqual(resources(resumed), resources(pending));
  rejected(resumed, 'l', { type: 'decision', keep: f.winnerWeapon });
  const discarded = chooseSemutaMoritaniRetention(reload(resumed), f.weapon);
  assert.deepEqual(discarded.pendingTreacheryDiscard!.batch.entries.map(e => e.card.id), [f.defense]);
  const final = passSemutaMoritaniDiscard(discarded);
  assert.equal(final.phase, 7); assert.equal(final.moritaniRetention, null);
  assert.deepEqual(player(final, 'l').hand.map(c => c.id).sort(), [f.unrelated, f.weapon, f.winnerWeapon].sort());
  assert.equal(final.discard.filter(c => c.id === f.semuta).length, 1);
  assert.equal(final.discard.filter(c => c.id === f.defense).length, 1);
  assert.deepEqual(inventory(final), f.cards); assert.deepEqual(resources(final), resources(pending));
  rejected(final, 'l', { type: 'decision', keep: f.weapon });
  rejected(final, 'l', { type: 'semutaCommit', event });
});
