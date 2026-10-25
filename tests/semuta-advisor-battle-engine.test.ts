import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { isAdvisor } from '../game/advisors';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import {
  createSemutaAdvisorBattleFixture as fixture, actSemutaAdvisorBattle as act,
  passSemutaAdvisorBattle as pass, claimSemutaAdvisorBattle as claim,
  allowSemutaAdvisorBattle as allow, finishSemutaAdvisorBattle as finish,
  semutaAdvisorBattlePlayer as player, semutaAdvisorBattleInventory as inventory,
  semutaAdvisorBattleTraitors as traitors, semutaAdvisorBattlePhysical as physical,
  type SemutaAdvisorBattleFixture,
} from './fixture-semuta-advisor-battle';

const balances = (game: Game) => Object.fromEntries(game.players.map(p => [p.id, p.spice]));
const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  order: game.order, lastBattle: game.lastBattle, movementRemaining: game.movementRemaining,
  storm: game.storm, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard });
const battleFacts = (game: Game) => {
  const b = game.lastBattleContext; assert.ok(b);
  return { event: b.event, turn: b.turn, territory: b.territory, combatants: b.combatants,
    winner: b.winner, result: b.result };
};
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorBattleFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeTraitorDeal.players.every(p => !p.hand.length && !p.traitorChoices.length && !p.traitors.length));
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(player(f.afterSetup, f.harkonnen).hand.length, 2);
  assert.ok(player(f.afterSetup, f.atreides).hand.some(card => card.id === f.shield));
  assert.equal(player(f.afterSetup, f.owner).forces[f.location], 1);
  assert.equal(player(f.afterSetup, f.atreides).forces[f.location], 10);
  assert.equal(player(f.afterSetup, f.harkonnen).forces['carthag:11'], 10);
  assert.equal(f.traitorScalars.length, f.originalTraitors.length - 1);
  assert.deepEqual(traitors(f.afterSetup), f.originalTraitors);
  if (f.mutualTraitors) {
    assert.ok(player(f.afterSetup, f.atreides).traitors.includes('harkonnen-3'));
    assert.ok(player(f.afterSetup, f.harkonnen).traitors.includes('atreides-0'));
  }
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.ok(f.atreidesDeparture.steps.some(step => step.actor === f.atreides && step.action.type === 'move' && step.action.amount === 9));
  assert.ok(f.harkonnenArrival.steps.some(step => step.actor === f.harkonnen && step.action.type === 'move' && step.action.amount === 1));
  assert.equal(player(f.beforeBattle, f.atreides).forces[f.location], 1);
  assert.equal(player(f.beforeBattle, f.harkonnen).forces[f.location], 1);
  assert.equal(player(f.beforeBattle, f.atreides).forces['imperial_basin:10'], 9);
  assert.equal(player(f.beforeBattle, f.harkonnen).forces['carthag:11'], 9);
  assert.equal(f.planSteps[0].action.dial, 0.5); assert.equal(f.planSteps[0].action.support, 0);
  assert.equal(f.planSteps[0].action.defense, f.shield); assert.equal(f.planSteps[1].action.weapon, null);
  assert.equal(f.revealed.battle?.revealed, true); assert.deepEqual(f.revealed.battle?.plans, f.originalPlans);
  assert.equal(f.voteSteps.length, 2); assert.deepEqual(new Set(f.voteSteps.map(step => step.actor)), new Set([f.atreides, f.harkonnen]));
  assert.ok(f.voteSteps.every(step => step.action.call === f.mutualTraitors));
  for (const disposal of f.disposals) {
    assert.deepEqual(disposal.before.pendingTreacheryDiscard?.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy })),
      [{ card: f.shield, by: f.atreides }]);
    assert.ok(disposal.steps.every(step => step.action.type === 'semutaPass'));
    assert.notEqual(disposal.after.pendingTreacheryDiscard?.batch.event, disposal.event);
  }
  assert.equal(f.disposals.length, Number(f.mutualTraitors));
  assert.equal(f.game.battle, null); assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.equal(f.game.pendingWinnerDiscards ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.phase, 6); assert.equal(f.game.turn, 1);
  assert.equal(f.game.response?.kind, 'advisorFlip'); assert.deepEqual(f.game.response, f.originalResponse);
  assert.equal(f.originalAutomaticSource.producer, 'battleLosses'); assert.equal(f.originalAutomaticSource.battle.event, f.event);
  assert.equal(f.originalAutomaticSource.battle.result, f.mutualTraitors ? 'mutualTraitors' : 'normal');
  assert.equal(f.originalAutomaticSource.battle.winner, f.winner);
  assert.deepEqual(f.game.pendingAutomaticAdvisorBattle, f.originalParent);
  assert.deepEqual(f.game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.equal(f.originalParent.resume?.kind, f.mutualTraitors ? 'aftermath' : 'winner');
  assert.equal(f.originalParent.signature, JSON.stringify(f.originalParent.resume));
  assert.equal(f.originalStance.aloneFlipHold, f.originalAutomaticSource.event);
  assert.equal(player(f.game, f.atreides).tanks, 1); assert.equal(player(f.game, f.harkonnen).tanks, 1);
  assert.equal(player(f.game, f.atreides).forces[f.location] ?? 0, 0);
  assert.equal(player(f.game, f.harkonnen).forces[f.location] ?? 0, 0);
  assert.equal(player(f.game, f.owner).forces[f.location], 1); assert.equal(isAdvisor(player(f.game, f.owner), f.territory), true);
  assert.equal(f.game.discard.filter(card => card.id === f.shield).length, Number(f.mutualTraitors));
  assert.equal(player(f.game, f.atreides).hand.some(card => card.id === f.shield), !f.mutualTraitors);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.deepEqual(traitors(f.game), f.originalTraitors); assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaAdvisorBattleFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Expected the original committed battle conversion cost');
  assert.equal(pending.batch.cause, 'karama:advisorFlip'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingAutomaticAdvisorBattle, f.originalParent);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.deepEqual(game.lastBattleContext, f.originalBattle); assert.equal(game.battle, null);
  assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalStance);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(balances(game), f.originalBalances);
  assert.deepEqual(clock(game), clock(f.game)); assert.equal(game.discard.filter(card => card.id === f.shield).length, Number(f.mutualTraitors));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function nativeOutcome(state: Game, f: SemutaAdvisorBattleFixture, canceled: boolean) {
  assert.equal(state.pendingAutomaticAdvisorBattle ?? null, null); assert.deepEqual(state.pendingAutomaticAdvisorFlips ?? [], []);
  assert.equal(state.response?.automaticAdvisorFlip ?? null, null); assert.equal(state.battle, null);
  assert.deepEqual(physical(state), f.originalPhysical); assert.deepEqual(battleFacts(state), battleFacts(f.game));
  assert.equal(isAdvisor(player(state, f.owner), f.territory), canceled);
  if (canceled) assert.deepEqual(player(state, f.owner).advisors?.[f.territory], f.originalStance);
  if (!f.mutualTraitors) {
    assert.deepEqual(state.decision, { kind: 'battleCards', player: f.atreides, territory: f.territory, cards: [f.shield] });
    assert.ok(player(state, f.atreides).hand.some(card => card.id === f.shield));
  }
  const cleanupSteps: { actor: string; action: Action }[] = [], game = finish(state, cleanupSteps);
  assert.equal(game.phase, 7); assert.equal(game.turn, 1); assert.equal(game.battle, null);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingWinnerDiscards ?? null, null);
  assert.equal(game.pendingAutomaticAdvisorBattle ?? null, null); assert.deepEqual(game.pendingAutomaticAdvisorFlips ?? [], []);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(battleFacts(game), battleFacts(f.game));
  assert.equal(isAdvisor(player(game, f.owner), f.territory), canceled);
  if (canceled) assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalStance);
  assert.equal(game.discard.filter(card => card.id === f.shield).length, Number(f.mutualTraitors));
  assert.equal(player(game, f.atreides).hand.some(card => card.id === f.shield), !f.mutualTraitors);
  const keepReplies = cleanupSteps.filter(step => step.actor === f.atreides && step.action.type === 'decision' && Array.isArray(step.action.discard));
  assert.equal(keepReplies.length, Number(!f.mutualTraitors));
  if (keepReplies.length) assert.deepEqual(keepReplies[0].action.discard, []);
  assert.ok(cleanupSteps.every(step => !['battlePlan', 'traitorCall', 'chooseBattle'].includes(step.action.type)));
  // Quote the actual resulting board at the already earned pre-Collection
  // balances. This is a read-only expectation, not an installed income source.
  const collection = quoteSpiceCollection({ ...game, spice: f.game.spice,
    players: game.players.map(p => ({ ...p, spice: f.originalBalances[p.id] })) });
  for (const receipt of collection.receipts) assert.equal(player(game, receipt.player).spice, receipt.balance);
  assert.deepEqual(game.spice, collection.spice);
  assert.equal(player(game, f.owner).spice, f.originalBalances[f.owner] + (canceled ? 0 : 2));
  assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(traitors(game), f.originalTraitors);
  for (const step of f.planSteps) reject(game, step.actor, step.action);
  return game;
}
function denied(state: Game, f: SemutaAdvisorBattleFixture, claimed: boolean) {
  const game = nativeOutcome(state, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); return game;
}

for (const mutualTraitors of [false, true]) for (const claimed of [false, true]) void test(
  `native ${mutualTraitors ? 'mutual Traitors' : 'unsupported winner'} battle conversion cost Semuta ${claimed ? 'claim' : 'pass'} preserves losses and resumes original cleanup once`, () => {
    const f = fixture({ mutualTraitors }); nativeSource(f); const offered = open(f);
    denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native committed battle conversion allowance flips the real surviving advisor before original cleanup and Collection', () => {
  for (const mutualTraitors of [false, true]) {
    const f = fixture({ mutualTraitors }); nativeSource(f); const game = nativeOutcome(allow(structuredClone(f.game)), f, false);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('native battle conversion cost rejects stale foreign disposal and underlying winner replies before cleanup', () => {
  for (const mutualTraitors of [false, true]) {
    const f = fixture({ mutualTraitors }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.atreides, { type: 'decision', discard: [] }); reject(game, f.owner, { type: 'passResponse' });
    for (const step of f.planSteps) reject(game, step.actor, step.action);
    for (const disposal of f.disposals) reject(game, f.holder, { type: 'semutaCommit', event: disposal.event });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('all four minimal profiles legally claim or pass native normal and mutual-Traitor battle conversion costs', () => {
  for (const mutualTraitors of [false, true]) {
    const f = fixture({ mutualTraitors }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const proposed = botActions(own)[0]; assert.ok(proposed, difficulty);
      assert.ok(proposed.type === 'semutaPass' || proposed.type === 'semutaCommit'); assert.equal(proposed.event, event);
      let game = act(structuredClone(offered), f.holder, proposed);
      const claimed = proposed.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      denied(game, f, claimed);
    }
  }
});
