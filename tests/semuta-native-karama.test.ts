import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { semutaIxPlayer, semutaIxInventory, semutaIxPhysical } from './fixture-semuta-ix-substitution';
import { semutaMoritaniPlayer, semutaMoritaniInventory, semutaMoritaniResources } from './fixture-semuta-moritani-retention';
import {
  semutaNativeIxKaramaFixture, semutaNativeMoritaniKaramaFixture,
  semutaNativeKaramaPreCost, semutaNativeKaramaCost, semutaNativeKaramaCostStep,
  semutaNativeKaramaReact, semutaNativeKaramaRemainder,
  semutaNativeKaramaReload as reload, type SemutaNativeKaramaFixture,
} from './fixture-semuta-native-karama';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function assertCostPause(game: Game, before: Game, f: SemutaNativeKaramaFixture) {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending);
  assert.equal(pending.reaction?.stage, 'offer');
  assert.equal(pending.continuation.kind, 'karamaBattleDiscard');
  assert.equal(pending.batch.cause, `karama:${f.kind}`);
  assert.deepEqual(pending.batch.entries.map(entry => ({ id: entry.card.id, player: entry.discardedBy, publicFace: entry.publicFace })),
    [{ id: f.karama, player: f.spender, publicFace: true }]);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  assert.equal(game.players.find(p => p.id === f.spender)!.hand.some(card => card.id === f.karama), false);
  assert.equal(game.response, null, 'The old response is detached, not still open to another cancel or allow.');
  if (pending.continuation.kind !== 'karamaBattleDiscard')
    throw Error('The printed cost needs its exact typed cancellation continuation.');
  const continuation = pending.continuation;
  assert.equal(continuation.player, f.spender);
  assert.equal(continuation.card, f.karama);
  assert.equal(continuation.use.kind, 'cancel');
  assert.equal(continuation.use.response.kind, f.kind);
  assert.equal(continuation.use.response.owner, f.owner);
  assert.notEqual(f.owner, f.spender);
  assert.equal(game.phase, 6);
  const step = semutaNativeKaramaCostStep(f);
  rejected(game, step.actor, step.action);
  rejected(game, f.spender, { type: 'passResponse' });
}
function assertIxCounters(game: Game, f: SemutaNativeKaramaFixture) {
  assert.ok(f.ix);
  const ix = semutaIxPlayer(game, f.ix.winner), emperor = semutaIxPlayer(game, f.ix.loser);
  assert.deepEqual(ix.forces, { [f.ix.location]: 2 });
  assert.equal(ix.elites!.forces[f.ix.location] ?? 0, 0);
  assert.equal(ix.reserves, 17); assert.equal(ix.elites!.reserves, 6);
  assert.equal(ix.tanks, 1); assert.equal(ix.elites!.tanks, 1); assert.equal(ix.battleLosses, 1);
  assert.deepEqual(emperor.forces, {}); assert.equal(emperor.reserves, 15);
  assert.equal(emperor.tanks, 5); assert.equal(emperor.battleLosses, 5);
  const richese = semutaIxPlayer(game, f.holder);
  assert.deepEqual(richese.forces, {}); assert.equal(richese.reserves, 20); assert.equal(richese.tanks, 0);
  assert.equal(game.lastBattleContext!.winner, f.ix.winner);
  assert.equal(game.lastBattleContext!.result, 'normal');
  assert.deepEqual(semutaIxInventory(game), f.cards);
}
function assertMoritaniCounters(game: Game, f: SemutaNativeKaramaFixture) {
  assert.ok(f.moritani);
  const winner = semutaMoritaniPlayer(game, 'w'), loser = semutaMoritaniPlayer(game, 'l');
  assert.deepEqual(winner.forces, { 'arrakeen:10': 3 }); assert.equal(winner.reserves, 15);
  assert.equal(winner.tanks, 2); assert.equal(winner.battleLosses, 2);
  assert.deepEqual(loser.forces, {}); assert.equal(loser.reserves, 15);
  assert.equal(loser.tanks, 5); assert.equal(loser.battleLosses, 5);
  for (const id of ['r', 'm']) {
    const player = semutaMoritaniPlayer(game, id);
    assert.deepEqual(player.forces, {}); assert.equal(player.reserves, 20); assert.equal(player.tanks, 0);
  }
  assert.equal(winner.spice, semutaMoritaniPlayer(f.game, 'w').spice + f.moritani.loserStrength);
  for (const id of ['r', 'm', 'l']) assert.equal(semutaMoritaniPlayer(game, id).spice, semutaMoritaniPlayer(f.game, id).spice);
  assert.equal(loser.leaders.find(leader => leader.id === f.moritani!.loserLeader)!.dead, true);
  assert.equal(loser.hand.some(card => card.id === f.moritani!.unrelated), true);
  assert.equal(winner.hand.some(card => card.id === f.moritani!.winnerWeapon), true);
  assert.equal(winner.hand.some(card => card.id === f.moritani!.winnerDefense), true);
  assert.deepEqual(semutaMoritaniInventory(game), f.cards);
}

for (const advanced of [false, true]) for (const claim of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} Ix printed cancellation cost ${claim ? 'claim' : 'pass'} cannot restore the declared 1/1 substitution`, () => {
    const f = semutaNativeIxKaramaFixture(advanced); assert.ok(f.ix);
    assert.notEqual(f.holder, f.spender);
    const before = reload(semutaNativeKaramaPreCost(f));
    assert.equal(before.response?.kind, 'ixSubstitution'); assert.equal(before.response?.owner, f.ix.winner);
    assert.deepEqual(before.pendingIxSubstitution!.sources, { [f.ix.location]: 1 });
    assert.deepEqual(before.pendingIxSubstitution!.recover, { [f.ix.location]: 1 });
    const pending = reload(semutaNativeKaramaCost(before, f));
    assertCostPause(pending, before, f); assertIxCounters(pending, f);
    assert.deepEqual(pending.pendingIxSubstitution, before.pendingIxSubstitution);
    assert.deepEqual(pending.pendingWinnerDiscards, before.pendingWinnerDiscards);
    assert.equal(pending.discard.some(card => card.id === f.ix!.tooth), false);
    assert.equal(semutaIxPlayer(pending, f.owner).hand.some(card => card.id === f.ix!.tooth), true);
    const declaration: Action = { type: 'decision', sources: { [f.ix.location]: 1 }, recover: { [f.ix.location]: 1 } };
    rejected(pending, f.owner, declaration);
    const event = pending.pendingTreacheryDiscard!.batch.event;
    let game = reload(semutaNativeKaramaReact(reload(pending), f, claim));
    assert.equal(game.pendingIxSubstitution, null); assert.equal(game.pendingWinnerDiscards, null);
    assertIxCounters(game, f);
    assert.deepEqual(semutaIxPhysical(game), semutaIxPhysical(before));
    assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'winnerMandatoryDiscard');
    assert.deepEqual(game.pendingTreacheryDiscard!.batch.entries.map(entry => entry.card.id), [f.ix.tooth]);
    assert.equal(game.discard.filter(card => card.id === f.ix!.tooth).length, 1);
    assert.notEqual(game.pendingTreacheryDiscard!.batch.event, event);
    if (claim) rejected(game, f.holder, { type: 'semutaCommit', event: game.pendingTreacheryDiscard!.batch.event });
    rejected(game, f.holder, { type: 'semutaCommit', event });
    rejected(game, f.holder, { type: 'semutaPass', event });
    rejected(game, f.owner, declaration);
    game = semutaNativeKaramaRemainder(reload(game), f);
    assertIxCounters(game, f);
    assert.deepEqual(semutaIxPhysical(game), semutaIxPhysical(before));
    assert.equal(game.discard.filter(card => card.id === f.ix!.snooper).length, 1);
    assert.equal(game.discard.filter(card => card.id === f.ix!.tooth).length, 1);
    assert.equal(game.discard.filter(card => card.id === f.ix!.shield).length, 1);
    assert.equal(semutaIxPlayer(game, f.owner).hand.length, 0);
    assert.equal(semutaIxPlayer(game, f.holder).hand.some(card => card.id === f.karama), claim);
    assert.equal(game.discard.filter(card => card.id === f.karama).length, Number(!claim));
    assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claim));
    assert.equal(game.lastBattleContext!.winnerDiscards!.completed, true);
    rejected(game, f.owner, declaration);
    const cost = semutaNativeKaramaCostStep(f); rejected(game, cost.actor, cost.action);
    rejected(game, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
    rejected(game, f.holder, { type: 'semutaCommit', event });
  });
}

for (const spender of ['w', 'l'] as const) for (const holder of ['r', 'l'] as const)
  if (spender !== holder) for (const claim of [false, true]) {
  void test(`Basic allied retention canceled by ${spender}, cost ${claim ? 'claimed' : 'passed'} by ${holder}, never keeps the proposal or adds the cost to its played pool`, () => {
    const f = semutaNativeMoritaniKaramaFixture({ karamaHolder: spender, semutaHolder: holder }); assert.ok(f.moritani);
    const before = reload(semutaNativeKaramaPreCost(f));
    assert.equal(before.response?.kind, 'moritaniRetention'); assert.equal(before.response?.owner, 'm');
    assert.equal(before.moritaniRetention?.source, undefined); assert.equal(before.moritaniRetention?.keep, f.moritani.weapon);
    assert.deepEqual(before.moritaniRetention!.played, [f.moritani.weapon, f.moritani.defense]);
    const pending = reload(semutaNativeKaramaCost(before, f));
    assertCostPause(pending, before, f); assertMoritaniCounters(pending, f);
    assert.deepEqual(pending.moritaniRetention, before.moritaniRetention);
    for (const card of [f.moritani.weapon, f.moritani.defense]) {
      assert.equal(semutaMoritaniPlayer(pending, 'l').hand.some(held => held.id === card), true);
      assert.equal(pending.discard.some(held => held.id === card), false);
    }
    rejected(pending, 'l', { type: 'decision', keep: f.moritani.weapon });
    const event = pending.pendingTreacheryDiscard!.batch.event;
    let game = reload(semutaNativeKaramaReact(reload(pending), f, claim));
    assert.equal(game.moritaniRetention, null); assert.equal(game.response, null);
    assert.deepEqual(semutaMoritaniResources(game), semutaMoritaniResources(before));
    const later = game.pendingTreacheryDiscard; assert.ok(later);
    assert.equal(later.continuation.kind, 'battleCleanup');
    assert.equal(later.batch.cause, 'battle:moritani'); assert.notEqual(later.batch.event, event);
    assert.deepEqual(later.batch.entries.map(entry => entry.card.id), [f.moritani.weapon, f.moritani.defense]);
    if (later.continuation.kind !== 'battleCleanup') throw Error('Expected native Moritani cleanup.');
    assert.deepEqual(later.continuation.played, [f.moritani.weapon, f.moritani.defense]);
    assert.deepEqual(later.continuation.kept, []);
    assert.equal(later.batch.entries.some(entry => entry.card.id === f.karama), false);
    for (const card of [f.moritani.weapon, f.moritani.defense]) {
      assert.equal(semutaMoritaniPlayer(game, 'l').hand.some(held => held.id === card), false);
      assert.equal(game.discard.filter(held => held.id === card).length, 1);
    }
    if (claim) rejected(game, holder, { type: 'semutaCommit', event: later.batch.event });
    rejected(game, holder, { type: 'semutaCommit', event });
    rejected(game, holder, { type: 'semutaPass', event });
    rejected(game, 'l', { type: 'decision', keep: f.moritani.weapon });
    game = semutaNativeKaramaRemainder(reload(game), f);
    assertMoritaniCounters(game, f);
    assert.deepEqual(semutaMoritaniResources(game), semutaMoritaniResources(before));
    assert.equal(game.moritaniRetention, null); assert.equal(game.battle, null); assert.equal(game.decision, null);
    assert.equal(semutaMoritaniPlayer(game, holder).hand.some(card => card.id === f.karama), claim);
    assert.equal(game.discard.filter(card => card.id === f.karama).length, Number(!claim));
    assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claim));
    for (const card of [f.moritani.weapon, f.moritani.defense]) {
      assert.equal(game.discard.filter(held => held.id === card).length, 1);
      assert.equal(semutaMoritaniPlayer(game, 'l').hand.some(held => held.id === card), false);
    }
    rejected(game, holder, { type: 'card', card: f.karama, mode: 'cancel' });
    const cost = semutaNativeKaramaCostStep(f); rejected(game, cost.actor, cost.action);
    rejected(game, 'l', { type: 'decision', keep: f.moritani.weapon });
    rejected(game, holder, { type: 'semutaCommit', event });
  });
}

void test('All four profiles legally retire native printed costs and their original cancellation aftermath', () => {
  for (const f of [semutaNativeIxKaramaFixture(), semutaNativeIxKaramaFixture(true), semutaNativeMoritaniKaramaFixture({ semutaHolder: 'l' })]) {
    const before = reload(semutaNativeKaramaPreCost(f)), pending = reload(semutaNativeKaramaCost(before, f));
    for (const profile of DIFFICULTIES) {
      let game = reload(pending);
      for (const player of game.players) player.bot = profile;
      for (let count = 0; game.phase === 6 && count < 64; count++) {
        let next: Game | undefined;
        for (const player of game.players) {
          const action = botActions(viewGame(game, player.id))[0];
          if (action) { next = applyAction(reload(game), player.id, action); break; }
        }
        assert.ok(next, `${profile} must provide a legal original continuation.`);
        game = next;
      }
      assert.equal(game.phase, 7); assert.equal(game.pendingTreacheryDiscard, null);
      assert.equal(game.response, null); assert.equal(game.pendingIxSubstitution == null, true);
      assert.equal(game.moritaniRetention == null, true);
      if (f.kind === 'ixSubstitution') {
        assertIxCounters(game, f); assert.deepEqual(semutaIxPhysical(game), semutaIxPhysical(before));
      } else {
        assertMoritaniCounters(game, f); assert.deepEqual(semutaMoritaniResources(game), semutaMoritaniResources(before));
      }
    }
  }
});

for (const claim of [false, true]) void test(`Skill-trained Ix cancellation cost ${claim ? 'claim' : 'pass'} preserves the declared response while Semuta owns controls`, () => {
  const f = semutaNativeIxKaramaFixture(true, true); assert.ok(f.ix);
  const before = semutaNativeKaramaPreCost(f);
  assert.ok(before.pendingIxSubstitution?.receipt);
  const pending = semutaNativeKaramaCost(before, f);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.deepEqual(pending.pendingIxSubstitution!.sources, { [f.ix.location]: 1 });
  assert.deepEqual(pending.pendingIxSubstitution!.recover, { [f.ix.location]: 1 });
  for (const player of pending.players)
    assert.equal(viewGame(reload(pending), player.id).semutaReaction!.event, event);
  let game = semutaNativeKaramaReact(reload(pending), f, claim);
  assert.equal(game.pendingIxSubstitution, null);
  assert.equal(game.lastBattleContext!.ixSubstitution!.completed, true);
  assert.equal(game.pendingTreacheryDiscard!.continuation.kind, 'winnerMandatoryDiscard');
  game = semutaNativeKaramaRemainder(game, f);
  assert.equal(game.phase, 7);
  assert.equal(semutaIxPlayer(game, f.owner).forces[f.ix.location], 2);
  assert.equal(semutaIxPlayer(game, f.owner).elites!.forces[f.ix.location] ?? 0, 0);
  assert.equal(semutaIxPlayer(game, f.owner).elites!.tanks, 1);
  assert.equal(semutaIxPlayer(game, f.holder).hand.some(card => card.id === f.karama), claim);
  assert.deepEqual(semutaIxInventory(game), f.cards);
  for (const player of game.players) viewGame(reload(game), player.id);
  const cost = semutaNativeKaramaCostStep(f); rejected(game, cost.actor, cost.action);
  rejected(game, f.holder, { type: 'semutaCommit', event });
});
