import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { battleKaramaInventory, battleKaramaPlayer, finishBattleKarama, reloadBattleKarama,
  semutaBattleKaramaFixture, settleBattleKaramaCost, type SemutaBattleKaramaKind } from './fixture-semuta-battle-karama';

const kinds: SemutaBattleKaramaKind[] = ['capture', 'choamAudit', 'choamBattleIncome'];

function battleQuantities(game: Game) {
  return game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces,
    reserves: p.reserves, tanks: p.tanks, leaders: p.leaders }));
}

for (const kind of kinds) for (const claim of [false, true]) void test(
  `printed Karama canceling native ${kind} offers only its cost before ${claim ? 'claim' : 'all-seat pass'} and finishes once`, () => {
    const fixture = semutaBattleKaramaFixture(kind);
    const original = reloadBattleKarama(fixture.originalResponse);
    const native = reloadBattleKarama(original);
    delete native.semutaPreview;
    const nativeCanceled = applyAction(native, fixture.spender, fixture.cancel);
    const winner = battleKaramaPlayer(original, fixture.winner);
    const loser = battleKaramaPlayer(original, fixture.loser);
    assert.equal(winner.spice, 10 - 2 + fixture.bounty);
    assert.equal(loser.spice, kind === 'choamAudit' ? 11 : 10);
    assert.deepEqual(winner.forces, { 'arrakeen:10': 3 });
    assert.deepEqual(loser.forces, {});
    assert.equal(winner.tanks, 2);
    assert.equal(loser.tanks, 5);
    assert.equal(winner.reserves, 15);
    assert.equal(loser.reserves, 15);
    assert.equal(loser.leaders.find(l => l.id === fixture.loserLeader)!.dead, true);
    assert.equal(loser.leaders.find(l => l.id === fixture.loserLeader)!.deaths, 1);
    if (kind === 'capture') {
      assert.equal(fixture.nativeOffer.decision?.kind, 'captureOffer');
      assert.deepEqual(original.pendingCapture, { player: 'e', loser: 'a', territory: 'arrakeen' });
    } else if (kind === 'choamAudit') {
      assert.equal(fixture.nativeOffer.decision?.kind, 'choamAudit');
      assert.equal(original.pendingAuditor?.stage, 'response');
      assert.equal(original.pendingAuditor?.survived, false);
      assert.deepEqual(original.pendingAuditor?.usedCards, [fixture.weapon]);
      assert.deepEqual(battleKaramaPlayer(original, 'a').hand.map(c => c.id).sort(),
        [fixture.karama, fixture.privateCard].sort());
    } else assert.deepEqual(original.pendingChoamBattleIncome, { owner: 'e', amount: 1 });

    const pending = applyAction(original, fixture.spender, fixture.cancel);
    // This is the missing producer on the baseline: the cost used to skip Semuta entirely.
    assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'karamaBattleDiscard');
    assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    const receipt = pending.pendingTreacheryDiscard!;
    assert.equal(receipt.batch.cause, `karama:${kind}`);
    assert.equal(receipt.batch.entries.length, 1);
    assert.equal(receipt.batch.entries[0].card.id, fixture.karama);
    assert.equal(receipt.batch.entries[0].card.effect, 'karama');
    assert.equal(receipt.batch.entries[0].discardedBy, fixture.spender);
    assert.equal(receipt.batch.entries[0].publicFace, true);
    assert.equal(pending.discard.filter(c => c.id === fixture.karama).length, 1);
    assert.equal(battleKaramaPlayer(pending, fixture.spender).hand.some(c => c.id === fixture.karama), false);
    assert.equal(pending.response, null);
    assert.deepEqual(pending.pendingCapture, original.pendingCapture);
    assert.deepEqual(pending.pendingAuditor, original.pendingAuditor);
    assert.deepEqual(pending.pendingChoamBattleIncome, original.pendingChoamBattleIncome);
    assert.deepEqual(battleQuantities(pending), battleQuantities(original));
    assert.equal(pending.auditorInsight == null, true);
    assert.deepEqual(battleKaramaInventory(pending), fixture.inventory);
    assert.deepEqual(normalizeAutomaticGame(reloadBattleKarama(pending)), reloadBattleKarama(pending));
    assert.equal(viewGame(pending, fixture.holder).semutaReaction?.canCommit, true);
    for (const oldEvent of fixture.earlierEvents)
      assert.throws(() => applyAction(pending, fixture.holder, { type: 'semutaCommit', event: oldEvent }));
    assert.throws(() => applyAction(pending, fixture.spender, fixture.cancel));
    if (kind === 'capture') {
      assert.equal(pending.players.some(p => p.leaders.some(l => l.capturedBy || l.concealed)), false);
      assert.throws(() => applyAction(pending, 'e', { type: 'decision', mode: 'keep' }));
    } else if (kind === 'choamAudit') {
      assert.throws(() => applyAction(pending, 'a', { type: 'decision',
        event: original.pendingAuditor!.event, pay: false }));
    }

    const event = receipt.batch.event;
    // Save at the physically discarded, still-unsettled boundary; a neutral pass must not retire it.
    let saved = applyAction(reloadBattleKarama(pending), fixture.spender, { type: 'semutaPass', event });
    assert.equal(saved.pendingTreacheryDiscard?.batch.event, event);
    assert.deepEqual(battleQuantities(saved), battleQuantities(original));
    assert.throws(() => applyAction(saved, fixture.spender, { type: 'semutaPass', event }));
    saved = reloadBattleKarama(saved);
    let resumed: Game;
    if (claim) resumed = settleBattleKaramaCost(saved, true);
    else {
      resumed = saved;
      for (const seat of resumed.players.filter(p => p.id !== fixture.spender))
        resumed = applyAction(resumed, seat.id, { type: 'semutaPass', event });
    }
    resumed = reloadBattleKarama(resumed);
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.equal(resumed.pendingCapture == null, true);
    assert.equal(resumed.pendingAuditor == null, true);
    assert.equal(resumed.auditorInsight == null, true);
    assert.deepEqual(battleQuantities(resumed), battleQuantities(nativeCanceled));
    assert.equal(battleKaramaPlayer(resumed, fixture.holder).hand.filter(c => c.id === fixture.karama).length, Number(claim));
    assert.equal(resumed.discard.filter(c => c.id === fixture.karama).length, Number(!claim));
    assert.equal(resumed.discard.filter(c => c.id === fixture.semuta).length, Number(claim));
    assert.equal(battleKaramaPlayer(resumed, 'a').hand.some(c => c.id === fixture.privateCard), true);
    assert.deepEqual(battleKaramaInventory(resumed), fixture.inventory);
    assert.throws(() => applyAction(resumed, fixture.holder, { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(resumed, fixture.spender, fixture.cancel));
    if (kind === 'choamAudit') {
      assert.equal(resumed.pendingChoamBattleIncome, null);
      assert.equal(resumed.decision?.kind, 'choamMarket');
      assert.throws(() => applyAction(resumed, 'e', { type: 'decision',
        event: original.pendingAuditor!.event, audit: true }));
    } else if (kind === 'choamBattleIncome') {
      assert.equal(resumed.pendingChoamBattleIncome, null);
      assert.equal(resumed.decision?.kind, 'choamMarket');
    } else {
      assert.equal(resumed.phase, 7);
      assert.equal(resumed.players.some(p => p.leaders.some(l => l.capturedBy || l.concealed)), false);
      assert.throws(() => applyAction(resumed, 'e', { type: 'decision', mode: 'execute' }));
    }

    const finished = finishBattleKarama(resumed);
    assert.equal(finished.turn, 2);
    assert.equal(finished.pendingChoamBattleIncome == null, true);
    assert.equal(finished.auditorInsight == null, true);
    assert.equal(battleKaramaPlayer(finished, 'a').spice, kind === 'choamBattleIncome' ? 12 : 10);
    assert.equal(battleKaramaPlayer(finished, 'e').spice, kind === 'capture' ? 15 : kind === 'choamAudit' ? 11 : 10);
    assert.equal(battleKaramaPlayer(finished, 'r').spice, 10);
    assert.deepEqual(battleKaramaPlayer(finished, fixture.winner).forces, { 'arrakeen:10': 3 });
    assert.equal(battleKaramaPlayer(finished, fixture.winner).tanks, 2);
    assert.equal(battleKaramaPlayer(finished, fixture.loser).tanks, 5);
    assert.deepEqual(finished.players.map(p => p.leaders), original.players.map(p => p.leaders));
    assert.deepEqual(battleKaramaInventory(finished), fixture.inventory);
    for (const seat of finished.players)
      assert.equal(viewGame(finished, seat.id).auditorInsight == null, true);
    assert.throws(() => applyAction(finished, fixture.holder, { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(finished, 'e', { type: 'decision', done: true }));
    if (claim) assert.throws(() => applyAction(finished, fixture.holder, fixture.cancel),
      'acquiring the printed cost cannot reopen its original canceled effect');
  });

for (const kind of kinds) void test(`all four AI profiles legally participate in the native ${kind} cost receipt`, () => {
  const fixture = semutaBattleKaramaFixture(kind);
  const pending = applyAction(fixture.originalResponse, fixture.spender, fixture.cancel);
  const native = reloadBattleKarama(fixture.originalResponse);
  delete native.semutaPreview;
  const nativeCanceled = applyAction(native, fixture.spender, fixture.cancel);
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'karamaBattleDiscard');
  for (const profile of DIFFICULTIES) for (const id of ['a', 'r', 'e']) {
    const game = reloadBattleKarama(pending);
    battleKaramaPlayer(game, id).bot = profile;
    const action = botActions(viewGame(game, id))[0];
    assert.ok(action, `${profile} ${id} must have a neutral reaction action`);
    assert.ok(['semutaPass', 'semutaCommit'].includes(action.type));
    const after = applyAction(game, id, action);
    assert.deepEqual(battleKaramaInventory(after), fixture.inventory);
    assert.deepEqual(battleQuantities(after), battleQuantities(after.pendingTreacheryDiscard ? fixture.originalResponse : nativeCanceled));
  }
});
