import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { choamPowerPlays } from '../game/choam-power-options';
import {
  allowSemutaNexusCunning, createSemutaNexusCunningProactive,
  gamePlayer, nextSemutaNexusCunningStep, reactSemutaNexusCunning,
  semutaNexusCunningInventory,
} from './fixture-semuta-nexus-cunning';

for (const advanced of [false, true]) for (const claim of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} original Cunning Kulon ${claim ? 'claim' : 'pass'} preserves private projectile fuel and grants one native move bonus`, () => {
    const f = createSemutaNexusCunningProactive('kulon', { advanced, fullHand: claim });
    assert.equal(f.setup.status, 'setup');
    assert.ok(Object.values(f.setup.nexusCards!.cards!.hands).every(card => card === null));
    assert.equal(f.afterFirstStorm.turn, 1); assert.equal(f.afterFirstStorm.phase, 1);
    assert.equal(f.drawBefore.turn, 2); assert.equal(f.drawBefore.phase, 1);
    assert.equal(f.drawBefore.nexusCards!.phase!.occurred, true);
    assert.equal(gamePlayer(f.drawBefore, f.target).ally, f.other);
    assert.equal(gamePlayer(f.drawBefore, f.other).ally, f.target);
    assert.equal(gamePlayer(f.drawBefore, f.owner).ally, null);
    assert.deepEqual([...f.drawBefore.nexusCards!.phase!.eligible].sort(), [f.owner, f.holder].sort());
    assert.equal(f.drawAfter.nexusCards!.phase!.stage, 'complete');
    assert.ok(f.drawAfter.nexusCards!.cards!.hands[f.owner]);
    assert.equal(f.drawAfter.nexusCards!.cards!.hands[f.holder], null);
    assert.equal(f.drawAfter.nexusCards!.cards!.deck.length, 11);
    assert.equal(f.game.active, f.owner); assert.equal(f.game.phase, 5);
    assert.equal(f.cost.kind, 'projectile');
    assert.throws(() => applyAction(f.game, f.owner, f.move!), /more than 1/);
    const wallets = f.game.players.map(p => p.spice), handBefore = gamePlayer(f.game, f.holder).hand.length;
    const declared = applyAction(f.game, f.owner, f.action);
    assert.ok(declared.response, 'The original printed Karama may prevent Cunning');
    assert.deepEqual(gamePlayer(declared, f.owner).hand.find(c => c.id === f.cost.id), f.cost);
    assert.equal(declared.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(declared.nexusCards!.cards!.discard.filter(c => c === 'choam').length, 1);
    assert.equal(declared.nexusChoamHistory!.at(-1)!.stage, 'pending');
    const pending = allowSemutaNexusCunning(declared);
    const fresh = pending.pendingTreacheryDiscard!;
    assert.equal(fresh.continuation.kind, 'choamKulonDiscard');
    assert.deepEqual(fresh.batch.entries, [{ card: f.cost, discardedBy: f.owner, publicFace: false }]);
    assert.equal(fresh.reaction?.stage, 'offer');
    assert.equal(pending.nexusChoamHistory!.length, 1);
    assert.equal(pending.nexusChoamHistory![0].stage, 'complete', 'Allowance retires the spent Nexus before Semuta reacts');
    assert.equal(pending.nexusChoamHistory![0].receipt.card, f.cost.id);
    assert.equal(pending.nexusChoamHistory![0].receipt.effect, 'kulon');
    assert.equal(pending.discard.filter(c => c.id === f.cost.id).length, 1);
    assert.deepEqual(viewGame(pending, f.holder).semutaReaction!.candidates, [], 'No cost inspection before committing Semuta');
    assert.equal(viewGame(pending, f.holder).semutaReaction!.canCommit, true);
    assert.throws(() => applyAction(pending, f.owner, f.move!));
    const done = reactSemutaNexusCunning(pending, f, claim);
    assert.equal(done.pendingTreacheryDiscard, null, 'The only foreign candidate completes directly at Commit');
    assert.equal(done.resolvedTreacheryDiscardSequence, fresh.sequence);
    assert.equal(done.active, f.owner); assert.equal(gamePlayer(done, f.owner).moved, 0);
    assert.equal(gamePlayer(done, f.holder).hand.length, handBefore);
    assert.equal(gamePlayer(done, f.holder).hand.some(c => c.id === f.semuta), !claim);
    assert.equal(done.discard.filter(c => c.id === f.semuta).length, Number(claim));
    assert.equal(done.discard.filter(c => c.id === f.cost.id).length, Number(!claim));
    assert.deepEqual(gamePlayer(done, f.holder).hand.find(c => c.id === f.cost.id), claim ? f.cost : undefined);
    assert.deepEqual(done.players.map(p => p.spice), wallets);
    assert.equal(done.nexusCards!.cards!.discard.filter(c => c === 'choam').length, 1);
    assert.equal(done.nexusChoamHistory!.length, 1);
    assert.throws(() => applyAction(done, f.owner, f.action));
    assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event: fresh.batch.event }));
    const moved = applyAction(done, f.owner, f.move!);
    assert.equal(gamePlayer(moved, f.owner).moved, 1);
    assert.equal(gamePlayer(moved, f.owner).forces[f.from], 1);
    assert.throws(() => applyAction(moved, f.owner, f.move!), /movement is not available/);
    assert.deepEqual(semutaNexusCunningInventory(moved), f.cards);
    if (claim) assert.equal(handBefore, handLimit(gamePlayer(f.game, f.holder)));
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} original closing Cunning Gamont ${claim ? 'claim' : 'pass'} returns one ${advanced && claim ? 'elite' : 'normal'} force before its original owner closes Mentat`, () => {
    const optional = advanced && claim;
    const f = createSemutaNexusCunningProactive('gamont', {
      advanced, elite: optional, fullHand: claim,
      costKind: optional ? 'special' : 'snooper',
      skills: optional, tech: optional, strongholds: optional,
    });
    const target = f.selection.target as string, beforeTarget = structuredClone(gamePlayer(f.game, target));
    const wallets = f.game.players.map(p => p.spice), hands = gamePlayer(f.game, f.holder).hand.length;
    assert.equal(f.cost.kind, optional ? 'special' : 'snooper');
    if (optional) {
      assert.equal(f.cost.effect, 'hajr');
      assert.equal(f.game.leaderSkills!.assignments.length, 4);
      assert.ok(Object.values(f.game.techTokens!).every(t => f.game.players.some(p => p.id === t.owner)));
      assert.equal(f.game.strongholdCards!.claimedTurn, 1);
    }
    assert.equal(f.game.phase, 8);
    assert.deepEqual(f.game.decision, { kind: 'choamMentat', player: f.owner });
    assert.equal(viewGame(f.game, f.target).mentatVictoryPending, true);
    const declared = applyAction(f.game, f.owner, f.action);
    assert.equal(declared.nexusCards!.cards!.hands[f.owner], null);
    assert.deepEqual(gamePlayer(declared, f.owner).hand.find(c => c.id === f.cost.id), f.cost);
    const pending = allowSemutaNexusCunning(declared), fresh = pending.pendingTreacheryDiscard!;
    assert.equal(fresh.continuation.kind, 'choamGamontDiscard');
    assert.deepEqual(fresh.batch.entries, [{ card: f.cost, discardedBy: f.owner, publicFace: false }]);
    assert.equal(gamePlayer(pending, target).forces[f.from], 1);
    assert.equal(gamePlayer(pending, target).reserves, beforeTarget.reserves);
    assert.equal(pending.status, 'playing'); assert.deepEqual(pending.winner, []);
    assert.equal(pending.nexusChoamHistory![0].stage, 'complete');
    assert.equal(pending.nexusChoamHistory![0].receipt.effect, 'gamont');
    assert.throws(() => applyAction(pending, f.owner, { type: 'decision', done: true }));
    if (optional) assert.equal(pending.strongholdCards!.claimedTurn, 1);
    const done = reactSemutaNexusCunning(pending, f, claim), returned = gamePlayer(done, target);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.equal(done.resolvedTreacheryDiscardSequence, fresh.sequence);
    assert.equal(returned.forces[f.from], undefined);
    assert.equal(returned.reserves, beforeTarget.reserves + 1);
    assert.equal(returned.tanks, beforeTarget.tanks);
    assert.equal(returned.battleLosses, beforeTarget.battleLosses);
    if (f.elite) {
      assert.equal(returned.elites!.forces[f.from], undefined);
      assert.equal(returned.elites!.reserves, beforeTarget.elites!.reserves + 1);
      assert.equal(returned.elites!.tanks, beforeTarget.elites!.tanks);
    }
    assert.equal(done.status, 'playing'); assert.equal(done.turn, 2); assert.deepEqual(done.winner, []);
    assert.deepEqual(done.decision, { kind: 'choamMentat', player: f.owner });
    assert.equal(done.choamMentatPending, true);
    assert.equal(gamePlayer(done, f.holder).hand.length, hands);
    assert.deepEqual(gamePlayer(done, f.holder).hand.find(c => c.id === f.cost.id), claim ? f.cost : undefined);
    assert.equal(done.discard.filter(c => c.id === f.cost.id).length, Number(!claim));
    assert.equal(done.discard.filter(c => c.id === f.semuta).length, Number(claim));
    assert.deepEqual(done.players.map(p => p.spice), wallets, 'Returning a force grants no spice or replayed Special fuel power');
    assert.equal(done.nexusCards!.cards!.discard.filter(c => c === 'choam').length, 1);
    assert.throws(() => applyAction(done, f.owner, f.action));
    assert.throws(() => applyAction(done, f.target, { type: 'decision', done: true }));
    if (optional) assert.equal(done.strongholdCards!.claimedTurn, 1);
    const closed = applyAction(done, f.owner, { type: 'decision', done: true });
    assert.equal(closed.turn, 3); assert.equal(closed.status, 'playing');
    assert.equal(gamePlayer(closed, target).reserves, returned.reserves, 'Closing cannot repeat the return');
    assert.equal(closed.nexusChoamHistory!.length, 1);
    if (optional) {
      assert.equal(closed.strongholdCards!.claimedTurn, 2);
      assert.equal(closed.strongholdCards!.owners.arrakeen, null, 'The returned sole force cannot claim Arrakeen');
    }
    assert.deepEqual(semutaNexusCunningInventory(closed), f.cards);
  });
}

for (const effect of ['kulon', 'gamont'] as const) void test(`Original printed Karama cancellation retains ${effect} fuel and spends Cunning without offering that fuel`, () => {
  const f = createSemutaNexusCunningProactive(effect);
  let game = applyAction(f.game, f.owner, f.action);
  game = applyAction(game, f.other, { type: 'card', card: f.karama, mode: 'cancel' });
  // A separately discarded printed Karama may have its own ordinary reaction.
  for (let n = 0; (game.pendingTreacheryDiscard || game.response) && n < 30; n++) {
    assert.ok(!game.pendingTreacheryDiscard?.batch.entries.some(e => e.card.id === f.cost.id));
    const step = nextSemutaNexusCunningStep(game);
    game = applyAction(game, step.actor, step.action);
  }
  assert.deepEqual(gamePlayer(game, f.owner).hand.find(c => c.id === f.cost.id), f.cost);
  assert.equal(game.discard.some(c => c.id === f.cost.id), false);
  assert.equal(gamePlayer(game, f.holder).hand.some(c => c.id === f.cost.id), false);
  assert.equal(gamePlayer(game, f.holder).hand.some(c => c.id === f.semuta), true);
  assert.equal(game.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(game.nexusCards!.cards!.discard.filter(c => c === 'choam').length, 1);
  assert.equal(game.nexusChoamHistory!.length, 1); assert.equal(game.nexusChoamHistory![0].stage, 'canceled');
  if (effect === 'kulon') {
    assert.throws(() => applyAction(game, f.owner, f.move!), /more than 1/);
  } else {
    assert.equal(gamePlayer(game, f.target).forces[f.from], 1);
    assert.deepEqual(game.decision, { kind: 'choamMentat', player: f.owner });
  }
  assert.throws(() => applyAction(game, f.owner, f.action));
  assert.deepEqual(semutaNexusCunningInventory(game), f.cards);
});

void test('Rivals cannot activate native Cunning and the Semuta profile cannot spend its Nexus on Kull', () => {
  const f = createSemutaNexusCunningProactive('kulon'), own = viewGame(f.game, f.owner);
  assert.throws(() => applyAction(f.game, f.holder, f.action));
  const kull = choamPowerPlays(own, 'kull').find(p => p.source === 'nexus')!;
  assert.throws(() => applyAction(f.game, f.owner,
    { type: 'card', mode: 'choam', card: kull.card.id, nexus: kull.event, effect: 'kull' }));
  assert.equal(f.game.nexusCards!.cards!.hands[f.owner], 'choam');
  assert.deepEqual(gamePlayer(f.game, f.owner).hand.find(c => c.id === f.cost.id), f.cost);
  assert.deepEqual(semutaNexusCunningInventory(f.game), f.cards);
});

void test('Minimal native Cunning and Semuta bot actions use the original cost and finish singleton commitment legally', () => {
  const f = createSemutaNexusCunningProactive('kulon');
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const own = viewGame(f.game, f.owner); own.players.find(p => p.id === f.owner)!.bot = difficulty;
    const action = botActions(own)[0]; assert.ok(action);
    assert.equal(action.card, f.cost.id); assert.equal(action.nexus, f.action.nexus); assert.equal(action.effect, 'kulon');
    const pending = allowSemutaNexusCunning(applyAction(f.game, f.owner, action));
    const richese = viewGame(pending, f.holder); richese.players.find(p => p.id === f.holder)!.bot = difficulty;
    const commit = botActions(richese)[0]; assert.ok(commit); assert.equal(commit.type, 'semutaCommit');
    const done = applyAction(pending, f.holder, commit);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.deepEqual(gamePlayer(done, f.holder).hand.find(c => c.id === f.cost.id), f.cost);
    const moved = applyAction(done, f.owner, f.move!);
    assert.equal(gamePlayer(moved, f.owner).forces[f.from], 1);
    assert.equal(gamePlayer(moved, f.owner).moved, 1);
    assert.deepEqual(semutaNexusCunningInventory(moved), f.cards);
  }
  let game: Game = allowSemutaNexusCunning(applyAction(f.game, f.owner, f.action));
  for (const player of game.players) {
    const own = viewGame(game, player.id); own.players.find(p => p.id === player.id)!.bot = 'Easy';
    const action = player.id === f.holder
      ? { type: 'semutaPass', event: game.pendingTreacheryDiscard!.batch.event }
      : botActions(own)[0];
    assert.equal(action?.type, 'semutaPass');
    game = applyAction(game, player.id, action!);
  }
  assert.equal(game.pendingTreacheryDiscard, null);
  const moved = applyAction(game, f.owner, f.move!);
  assert.equal(gamePlayer(moved, f.owner).forces[f.from], 1);
  assert.equal(gamePlayer(moved, f.owner).moved, 1);
  assert.deepEqual(semutaNexusCunningInventory(moved), f.cards);
});
