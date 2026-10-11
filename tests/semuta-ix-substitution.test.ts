import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { semutaIxLoserDiscardFixture, semutaIxWinnerDiscardFixture,
  semutaIxPlayer, semutaIxInventory, semutaIxPhysical, semutaIxPassDiscard,
  semutaIxSubstitutionStep, semutaIxAllowResponses, type SemutaIxFixture } from './fixture-semuta-ix-substitution';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function assertCasualties(game: Game, f: SemutaIxFixture, substitute: boolean) {
  const ix = semutaIxPlayer(game, f.winner), emperor = semutaIxPlayer(game, f.loser);
  assert.deepEqual(ix.forces, { [f.location]: 2 });
  assert.equal(ix.elites!.forces[f.location] ?? 0, Number(substitute));
  assert.equal(ix.reserves, 17);
  assert.equal(ix.elites!.reserves, 6);
  assert.equal(ix.tanks, 1);
  assert.equal(ix.elites!.tanks, substitute ? 0 : 1);
  assert.equal(ix.battleLosses, 1, 'One casualty remains one casualty when its type is exchanged.');
  assert.deepEqual(emperor.forces, {});
  assert.equal(emperor.reserves, 15);
  assert.equal(emperor.tanks, 5);
  assert.equal(emperor.battleLosses, 5);
  assert.equal(game.lastBattleContext!.winner, f.winner);
  assert.equal(game.lastBattleContext!.result, 'normal');
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0), p.faction === 'ixians' ? 7 : 5);
  }
  assert.deepEqual(semutaIxInventory(game), f.cards);
}
function finishShieldCleanup(game: Game, f: SemutaIxFixture): Game {
  assert.equal(game.decision?.kind, 'battleCards');
  if (game.decision?.kind !== 'battleCards') throw new Error('Original winner cleanup was not restored.');
  assert.equal(game.decision.player, f.winner);
  assert.deepEqual(game.decision.cards, [f.shield]);
  game = applyAction(game, f.winner, { type: 'decision', discard: [f.shield] });
  if (game.pendingTreacheryDiscard) game = semutaIxPassDiscard(game);
  assert.equal(game.pendingTreacheryDiscard, null);
  assert.equal(game.pendingIxSubstitution, null);
  assert.equal(game.pendingWinnerDiscards, null);
  assert.equal(game.discard.filter(c => c.id === f.shield).length, 1);
  assert.equal(game.phase, 7);
  return game;
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';

  void test(`Semuta ${mode} reacts to actual loser discard before native Ix losses/substitution, then disposes Tooth once`, () => {
    const f = semutaIxLoserDiscardFixture(advanced), pending = f.game;
    // The former guard skipped this offer while the used winning Tooth was reserved.
    assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.equal(pending.pendingTreacheryDiscard!.continuation.kind, 'battleResolved');
    assert.equal(pending.pendingTreacheryDiscard!.batch.cause, 'battle:mandatory');
    assert.deepEqual(pending.pendingTreacheryDiscard!.batch.entries.map(e => e.card.id), [f.snooper]);
    assert.deepEqual(pending.pendingWinnerDiscards!.cards, [f.tooth]);
    assert.equal(pending.pendingIxSubstitution == null, true, 'Native substitution is staged only AFTER this reaction and winner losses.');
    assert.equal(semutaIxPlayer(pending, f.winner).forces[f.location], 3);
    assert.equal(semutaIxPlayer(pending, f.winner).tanks, 0);
    assert.equal(pending.discard.filter(c => c.id === f.snooper).length, 1);
    assert.equal(pending.discard.some(c => c.id === f.tooth), false);
    const event = pending.pendingTreacheryDiscard!.batch.event;
    const premature = semutaIxSubstitutionStep(f, true);
    assert.throws(() => applyAction(reload(pending), premature.actor, premature.action));
    assert.throws(() => applyAction(reload(pending), f.winner, { type: 'decision', decline: true }));
    for (const claim of [false, true]) for (const substitute of [false, true]) {
      let game = claim ? applyAction(reload(pending), f.holder, { type: 'semutaCommit', event })
        : semutaIxPassDiscard(reload(pending));
      assert.equal(game.decision?.kind, 'ixSubstitution');
      assert.equal(game.decision?.player, f.winner);
      assert.deepEqual(game.pendingIxSubstitution!.losses, { [f.location]: 1 });
      assert.deepEqual(game.pendingIxSubstitution!.cards, [f.shield]);
      assertCasualties(game, f, false);
      assert.equal(semutaIxPlayer(game, f.winner).hand.some(c => c.id === f.tooth), true);
      assert.equal(game.discard.some(c => c.id === f.tooth), false);
      assert.equal(semutaIxPlayer(game, f.holder).hand.some(c => c.id === f.snooper), claim);
      assert.throws(() => applyAction(reload(game), f.holder, { type: 'semutaCommit', event }));
      assert.throws(() => applyAction(reload(game), f.winner, { type: 'decision', sources: { [f.location]: 2 }, recover: { [f.location]: 2 } }));
      const step = semutaIxSubstitutionStep(f, substitute);
      game = applyAction(reload(game), step.actor, step.action);
      if (substitute) {
        assert.equal(game.response?.kind, 'ixSubstitution');
        assertCasualties(game, f, false);
        game = semutaIxAllowResponses(reload(game));
      }
      assertCasualties(game, f, substitute);
      assert.equal(game.pendingIxSubstitution, null);
      assert.equal(game.pendingWinnerDiscards, null);
      assert.equal(game.discard.filter(c => c.id === f.tooth).length, 1);
      // Finish any later neutral Tooth opportunity before optional Shield cleanup.
      if (game.pendingTreacheryDiscard) {
        assert.equal(game.pendingTreacheryDiscard.continuation.kind, 'winnerMandatoryDiscard');
        assert.deepEqual(game.pendingTreacheryDiscard.batch.entries.map(e => e.card.id), [f.tooth]);
        assert.throws(() => applyAction(reload(game), step.actor, step.action));
        if (claim) assert.throws(() => applyAction(reload(game), f.holder,
          { type: 'semutaCommit', event: game.pendingTreacheryDiscard!.batch.event }));
        game = semutaIxPassDiscard(reload(game));
      }
      assert.throws(() => applyAction(reload(game), step.actor, step.action));
      const physical = reload(game);
      assert.throws(() => applyAction(game, f.holder, { type: 'semutaPass', event }));
      assert.deepEqual(game, physical);
      game = finishShieldCleanup(reload(game), f);
      assertCasualties(game, f, substitute);
      assert.equal(semutaIxPlayer(game, f.holder).hand.some(c => c.id === f.snooper), claim);
      assert.equal(game.discard.filter(c => c.id === f.semuta).length, Number(claim));
      assert.throws(() => applyAction(reload(game), step.actor, step.action));
    }
  });

  void test(`Semuta ${mode} claims or passes used Tooth only after original substitution/decline and resumes shield cleanup`, () => {
    for (const substitute of [false, true]) {
      const f = semutaIxWinnerDiscardFixture(advanced, substitute), pending = f.game;
      assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
      assert.equal(pending.pendingTreacheryDiscard!.continuation.kind, 'winnerMandatoryDiscard');
      assertCasualties(pending, f, substitute);
      const event = pending.pendingTreacheryDiscard!.batch.event;
      for (const claim of [false, true]) {
        let game = claim ? applyAction(reload(pending), f.holder, { type: 'semutaCommit', event })
          : semutaIxPassDiscard(reload(pending));
        assert.deepEqual(semutaIxPhysical(game), semutaIxPhysical(pending), 'Semuta never replays support, bounty, losses or substitution.');
        assert.equal(semutaIxPlayer(game, f.holder).hand.some(c => c.id === f.tooth), claim);
        assert.equal(game.discard.filter(c => c.id === f.tooth).length, Number(!claim));
        assert.equal(game.discard.filter(c => c.id === f.snooper).length, 1);
        assert.equal(game.lastBattleContext!.winnerDiscards!.completed, true);
        game = finishShieldCleanup(reload(game), f);
        assertCasualties(game, f, substitute);
        assert.equal(semutaIxPlayer(game, f.holder).hand.some(c => c.id === f.tooth), claim);
        assert.equal(game.discard.filter(c => c.id === f.semuta).length, Number(claim));
        assert.throws(() => applyAction(reload(game), f.holder, { type: 'semutaCommit', event }));
        const step = semutaIxSubstitutionStep(f, true);
        assert.throws(() => applyAction(reload(game), step.actor, step.action));
      }
    }
  });

  void test(`Semuta ${mode} all four original bot profiles legally participate in fresh discard and typed Ix aftermath`, () => {
    const f = semutaIxLoserDiscardFixture(advanced);
    for (const profile of DIFFICULTIES) {
      let game = reload(f.game);
      for (const p of game.players) p.bot = profile;
      assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
      let sawIx = false;
      for (let step = 0; game.phase === 6 && step < 80; step++) {
        if (game.decision?.kind === 'ixSubstitution') sawIx = true;
        let next: Game | undefined;
        for (const p of game.players) {
          const action = botActions(viewGame(game, p.id))[0];
          if (action) { next = applyAction(reload(game), p.id, action); break; }
        }
        assert.ok(next, `${profile} must offer a legal native continuation.`);
        game = next;
      }
      assert.equal(sawIx, true);
      assert.equal(game.phase, 7);
      assert.equal(game.pendingIxSubstitution, null);
      assert.equal(game.pendingWinnerDiscards, null);
      assert.equal(semutaIxPlayer(game, f.winner).forces[f.location], 2);
      assert.equal(semutaIxPlayer(game, f.winner).tanks, 1);
      assert.equal(semutaIxPlayer(game, f.loser).tanks, 5);
      assert.deepEqual(semutaIxInventory(game), f.cards);
    }
  });
}
