import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { isAdvisor } from '../game/advisors';
import {
  createSemutaAdvisorGamontFixture as fixture, actSemutaAdvisorGamont as act,
  passSemutaAdvisorGamont as pass, claimSemutaAdvisorGamont as claim,
  allowSemutaAdvisorGamont as allow, finishSemutaAdvisorGamont as finish,
  closeSemutaAdvisorGamont as close, semutaAdvisorGamontPlayer as player,
  semutaAdvisorGamontInventory as inventory, semutaAdvisorGamontPhysical as physical,
  semutaAdvisorGamontStrongholds as strongholds, type SemutaAdvisorGamontFixture,
} from './fixture-semuta-advisor-gamont';

const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  order: game.order, movementRemaining: game.movementRemaining, storm: game.storm,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard, choamMentatPending: game.choamMentatPending });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorGamontFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(player(f.afterSetup, f.holder).hand.some(card => card.id === f.gamont && card.name === 'Trip to Gamont'));
  assert.deepEqual(f.advisorSetup.steps[0].action, { type: 'advisorSetup', territory: 'arrakeen', sector: 10 });
  assert.equal(player(f.afterSetup, f.owner).forces[f.location], 1);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.territory), true);
  assert.equal(player(f.afterSetup, f.spender).forces[f.location], 10);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.equal(player(f.bgShipment.before, f.owner).spice - player(f.bgShipment.after, f.owner).spice, 2);
  assert.ok(f.bgShipment.steps.some(step => step.action.type === 'ship' && step.action.amount === 2));
  assert.ok(f.bgMovement.steps.some(step => step.action.type === 'move' && step.action.from === 'carthag:11' && step.action.amount === 1));
  assert.ok(f.outsiderDeparture.steps.some(step => step.actor === f.spender && step.action.type === 'move' && step.action.amount === 9));
  assert.equal(player(f.beforeGamont, f.spender).forces[f.location], 1);
  assert.equal(player(f.beforeGamont, f.spender).forces['imperial_basin:10'], 9);
  assert.equal(player(f.beforeGamont, f.owner).forces['carthag:11'], 1);
  assert.equal(player(f.beforeGamont, f.owner).forces['sietch_tabr:14'], 1);
  assert.equal(isAdvisor(player(f.beforeGamont, f.owner), f.territory), true);
  assert.equal(strongholds(f.beforeGamont, f.owner).length, 2);
  assert.equal(f.beforeGamont.decision?.kind ?? null, f.final ? 'choamMentat' : null);
  assert.equal(f.declaredGamont.response?.kind, 'choamWorthless');
  assert.equal(f.gamontHistory.steps[0].actor, f.holder); assert.deepEqual(f.gamontHistory.steps[0].action, f.gamontAction);
  assert.ok(f.gamontHistory.steps.some(step => step.actor === f.spender && step.action.type === 'passResponse'));
  for (const disposal of f.fuelDisposals) {
    assert.equal(disposal.before.pendingTreacheryDiscard?.continuation.kind, 'choamGamontDiscard');
    assert.equal(viewGame(disposal.before, f.holder).semutaReaction?.canCommit ?? false, false);
    assert.ok(disposal.steps.every(step => step.action.type === 'semutaPass'));
    assert.notEqual(disposal.after.pendingTreacheryDiscard?.batch.event, disposal.event);
  }
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.equal(player(f.game, f.holder).hand.some(card => card.id === f.gamont), false);
  assert.equal(f.game.discard.filter(card => card.id === f.gamont).length, 1);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta), 'Own fuel disposal never spends Semuta');
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost), 'The original Gamont counter was genuinely declined');
  assert.equal(player(f.game, f.spender).forces[f.location] ?? 0, 0);
  assert.equal(player(f.game, f.spender).reserves, player(f.beforeGamont, f.spender).reserves + 1);
  assert.equal(player(f.game, f.spender).tanks, player(f.beforeGamont, f.spender).tanks);
  assert.equal(f.game.response?.kind, 'advisorFlip'); assert.deepEqual(f.game.response, f.originalResponse);
  assert.equal(f.originalAutomaticSource.producer, 'gamont'); assert.equal(f.originalAutomaticSource.gamont.returned, true);
  assert.equal(f.originalAutomaticSource.gamont.mentat, f.final);
  assert.equal(f.originalAutomaticSource.gamont.player, f.holder); assert.equal(f.originalAutomaticSource.gamont.target, f.spender);
  assert.equal(f.originalParent.card, f.gamont); assert.deepEqual(f.originalParent.receipt, f.originalAutomaticSource.gamont);
  assert.deepEqual(f.game.pendingAutomaticAdvisorGamont, f.originalParent);
  assert.deepEqual(f.game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.equal(f.originalStance.aloneFlipHold, f.originalAutomaticSource.event);
  assert.equal(isAdvisor(player(f.game, f.owner), f.territory), true);
  assert.equal(strongholds(f.game, f.owner).length, 2);
  assert.equal(f.game.status, 'playing'); assert.deepEqual(f.game.winner, []);
  assert.equal(f.game.phase, 8); assert.equal(f.game.turn, 1); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaAdvisorGamontFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Expected the original Gamont conversion cost');
  assert.equal(pending.batch.cause, 'karama:advisorFlip'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingAutomaticAdvisorGamont, f.originalParent);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalStance);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(game.discard.filter(card => card.id === f.gamont).length, 1);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.status, 'playing'); assert.deepEqual(game.winner, []);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function nativeOutcome(state: Game, f: SemutaAdvisorGamontFixture, canceled: boolean) {
  const game = finish(state);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingAutomaticAdvisorGamont ?? null, null);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips ?? [], []); assert.equal(game.response ?? null, null);
  assert.deepEqual(game.decision, f.chooser); assert.deepEqual(clock(game), clock(f.game));
  assert.deepEqual(physical(game), f.originalPhysical);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), canceled);
  if (canceled) assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalStance);
  assert.equal(player(game, f.spender).forces[f.location] ?? 0, 0);
  assert.equal(player(game, f.spender).reserves, player(f.game, f.spender).reserves);
  assert.equal(game.discard.filter(card => card.id === f.gamont).length, 1);
  assert.equal(strongholds(game, f.owner).length, canceled ? 2 : 3);
  assert.equal(game.status, 'playing'); assert.deepEqual(game.winner, []);
  reject(game, f.holder, f.gamontAction);
  const closeSteps: { actor: string; action: Action }[] = [], completed = close(structuredClone(game), closeSteps);
  assert.ok(closeSteps.some(step => step.actor === f.holder && step.action.type === 'decision' && step.action.done === true));
  if (f.final) assert.deepEqual(closeSteps[0], { actor: f.confirmationActor, action: f.confirmationAction });
  else assert.ok(closeSteps.some(step => step.action.type === 'ready'));
  if (canceled) {
    assert.equal(completed.status, 'playing'); assert.equal(completed.turn, 2); assert.deepEqual(completed.winner, []);
  } else {
    assert.equal(completed.status, 'finished'); assert.equal(completed.turn, 1); assert.deepEqual(completed.winner, [f.owner]);
  }
  assert.equal(completed.discard.filter(card => card.id === f.gamont).length, 1);
  assert.equal(player(completed, f.spender).reserves, player(f.game, f.spender).reserves);
  assert.equal(player(completed, f.spender).tanks, player(f.game, f.spender).tanks);
  assert.equal(player(completed, f.spender).forces[f.location] ?? 0, 0);
  assert.deepEqual(inventory(completed), f.originalInventory); return game;
}
function denied(state: Game, f: SemutaAdvisorGamontFixture, claimed: boolean) {
  const game = nativeOutcome(state, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); return game;
}

for (const final of [false, true]) for (const claimed of [false, true]) void test(
  `native ${final ? 'final' : 'ordinary'} Gamont conversion cost Semuta ${claimed ? 'claim' : 'pass'} keeps the real return and resumes only original Mentat`, () => {
    const f = fixture({ final }); nativeSource(f); const offered = open(f);
    denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

void test('native Gamont conversion allowance earns the real third stronghold but waits for actual final confirmation', () => {
  for (const final of [false, true]) {
    const f = fixture({ final }); nativeSource(f); const game = nativeOutcome(allow(structuredClone(f.game)), f, false);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('native Gamont conversion cost rejects stale foreign fuel and underlying chooser replies before stance or victory', () => {
  for (const final of [false, true]) {
    const f = fixture({ final }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.holder, f.gamontAction); reject(game, f.holder, f.confirmationAction);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, { type: 'ready' });
    for (const disposal of f.fuelDisposals) reject(game, f.holder, { type: 'semutaCommit', event: disposal.event });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('all four minimal profiles legally claim or pass native ordinary and final Gamont conversion costs', () => {
  for (const final of [false, true]) {
    const f = fixture({ final }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
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
