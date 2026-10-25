import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { fighterCount, isAdvisor } from '../game/advisors';
import { quoteAutomaticAdvisorFlips } from '../game/advisor-automatic-flip';
import {
  createSemutaAdvisorAloneFixture as fixture, actSemutaAdvisorAlone as act,
  passSemutaAdvisorAlone as pass, claimSemutaAdvisorAlone as claim,
  allowSemutaAdvisorAlone as allow, finishSemutaAdvisorAlone as finish,
  advanceSemutaAdvisorAlone as advance, semutaAdvisorAloneClean as clean,
  semutaAdvisorAlonePlayer as player, semutaAdvisorAloneInventory as inventory,
  semutaAdvisorAlonePhysical as physical, type SemutaAdvisorAloneFixture,
} from './fixture-semuta-advisor-alone';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorAloneFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.deepEqual(f.setup.expansions, ['choam']); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'beneGesserit', 'atreides', 'emperor']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.setupChoices.steps.some(step => step.actor === f.owner && step.action.type === 'predict'));
  assert.ok(f.setupChoices.steps.some(step => step.actor === f.owner && step.action.type === 'advisorSetup' &&
    step.action.territory === f.territory && step.action.sector === f.sector));
  assert.equal(player(f.afterSetup, f.mover).forces[f.from], 10);
  assert.equal(player(f.afterSetup, f.owner).forces[f.from], 1);
  assert.ok(player(f.afterSetup, f.owner).advisors?.[f.territory]);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.ok(f.movementOpening.steps.some(step => step.actor === f.owner && step.action.type === 'decision' && step.action.accept === false));
  assert.deepEqual(f.departure.steps, [{ actor: f.mover, action: f.moveAction }]);
  assert.equal(player(f.departure.before, f.mover).forces[f.from], 10);
  assert.equal(player(f.departure.before, f.mover).moved, 0);
  assert.equal(player(f.departure.before, f.mover).shipped, false);
  assert.equal(player(f.game, f.mover).forces[f.from] ?? 0, 0); assert.equal(player(f.game, f.mover).forces[f.to], 10);
  assert.equal(player(f.game, f.mover).moved, 1); assert.equal(player(f.game, f.mover).shipped, true);
  assert.equal(f.game.active, f.mover); assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 5);
  assert.equal(f.originalAutomaticSource.producer, 'groundMovement');
  assert.equal(f.originalAutomaticSource.mover, f.mover); assert.equal(f.originalAutomaticSource.move, 1);
  assert.equal(f.originalAutomaticSource.owner, f.owner); assert.equal(f.originalAutomaticSource.territory, f.territory);
  assert.deepEqual(f.originalAutomaticSource.forces, { [f.from]: 1 });
  assert.deepEqual(f.originalQueue, [f.originalAutomaticSource]);
  assert.equal(player(f.game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  assert.equal(isAdvisor(player(f.game, f.owner), f.territory), true);
  assert.equal(fighterCount(player(f.game, f.owner), f.territory), 0);
  assert.equal(f.game.response?.kind, 'advisorFlip'); assert.deepEqual(f.game.response, f.originalResponse);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaAdvisorAloneFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the original mandatory ground flip cost');
  assert.equal(pending.batch.cause, 'karama:advisorFlip'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
  assert.deepEqual(physical(game), f.originalPhysical);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function settled(state: Game, f: SemutaAdvisorAloneFixture, prevented: boolean) {
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.response ?? null, null);
  assert.equal(game.pendingAutomaticAdvisorFlips, undefined); assert.equal(game.pendingArrivalReaction?.length ?? 0, 0);
  assert.deepEqual(physical(game), f.originalPhysical);
  assert.equal(game.active, f.originalMovement.active); assert.equal(player(game, f.mover).moved, f.originalMovement.moved);
  assert.equal(player(game, f.mover).shipped, f.originalMovement.shipped);
  assert.deepEqual(player(game, f.mover).forces, f.originalMovement.forces);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), prevented);
  assert.equal(fighterCount(player(game, f.owner), f.territory), prevented ? 0 : 1);
  if (prevented) {
    assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
    assert.equal(player(game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  } else assert.equal(player(game, f.owner).advisors?.[f.territory], undefined);
  assert.deepEqual(quoteAutomaticAdvisorFlips(game), [], 'The completed occurrence cannot reopen as another mandatory request');
  assert.ok(steps.every(step => !['move', 'ship', 'endMovement', 'card'].includes(step.action.type)));
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function canceled(state: Game, f: SemutaAdvisorAloneFixture, claimed: boolean) {
  const game = settled(state, f, true);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); reject(game, f.mover, f.moveAction);
  return game;
}
function continueMovement(state: Game, f: SemutaAdvisorAloneFixture, prevented: boolean) {
  const steps: { actor: string; action: Action }[] = [];
  let game = act(state, f.mover, { type: 'endMovement' }, steps);
  game = advance(game, current => current.phase >= 6 && current.phase <= 7 && clean(current), steps);
  assert.equal(steps.filter(step => step.actor === f.mover && step.action.type === 'endMovement').length, 1);
  assert.ok(steps.every(step => !['move', 'ship', 'card', 'prepareAdvisors'].includes(step.action.type)));
  assert.equal(game.pendingAutomaticAdvisorFlips, undefined); assert.equal(game.response?.automaticAdvisorFlip, undefined);
  assert.equal(player(game, f.mover).forces[f.to], 10); assert.equal(player(game, f.mover).forces[f.from] ?? 0, 0);
  assert.equal(player(game, f.mover).moved, 1); assert.equal(player(game, f.owner).forces[f.from], 1);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), prevented);
  if (prevented) assert.equal(player(game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const claimed of [false, true]) void test(
  `Advanced native ground-departure mandatory advisor conversion cost Semuta ${claimed ? 'claim' : 'pass'} preserves the real move and continuously-alone footprint hold`, () => {
    const f = fixture(); nativeSource(f); const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = canceled(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    continueMovement(game, f, true);
  },
);

void test('native mandatory ground conversion allowance turns the actual BG advisor into a fighter without replaying Atreides departure', () => {
  const f = fixture(); nativeSource(f); const game = settled(allow(structuredClone(f.game)), f, false);
  assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  continueMovement(game, f, false);
});

void test('fresh automatic ground-conversion cost rejects stale and underlying actions with the exact original queue still held', () => {
  const f = fixture(), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
  reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
  reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
  reject(game, f.owner, { type: 'passResponse' }); reject(game, f.mover, f.moveAction);
  reject(game, f.mover, { type: 'endMovement' }); reject(game, f.owner, { type: 'prepareAdvisors', territory: f.territory });
  reject(game, f.owner, { type: 'decision', accept: true });
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.deepEqual(player(game, f.owner).advisors, f.originalStance); assert.deepEqual(physical(game), f.originalPhysical);
  canceled(pass(game), f, false);
});

void test('all four minimal profiles legally answer the real ground-departure mandatory-conversion used cost', () => {
  const f = fixture(), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
  for (const difficulty of DIFFICULTIES) {
    const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
    const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
    assert.deepEqual(own, before); assert.ok(action.type === 'semutaPass' || action.type === 'semutaCommit');
    assert.equal(action.event, event);
    let game = act(structuredClone(offered), f.holder, action);
    const claimed = action.type === 'semutaCommit';
    if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
      const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
      const selected = botActions(selecting)[0]; assert.ok(selected);
      assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
      game = act(game, f.holder, selected);
    } else if (game.pendingTreacheryDiscard) game = pass(game);
    canceled(game, f, claimed);
  }
});
