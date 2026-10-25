import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { fighterCount, isAdvisor } from '../game/advisors';
import { quoteAutomaticAdvisorFlips } from '../game/advisor-automatic-flip';
import {
  createSemutaAdvisorFaceDanceFixture as fixture, actSemutaAdvisorFaceDance as act,
  passSemutaAdvisorFaceDance as pass, claimSemutaAdvisorFaceDance as claim,
  allowSemutaAdvisorFaceDance as allow, finishSemutaAdvisorFaceDance as finish,
  semutaAdvisorFaceDancePlayer as player, semutaAdvisorFaceDanceInventory as inventory,
  semutaAdvisorFaceDancePhysical as physical, semutaAdvisorFaceDanceTraitors as traitors,
  type SemutaAdvisorFaceDanceFixture,
} from './fixture-semuta-advisor-face-dance';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorFaceDanceFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.deepEqual(f.setup.expansions, ['choam', 'ix']); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'beneGesserit', 'tleilaxu', 'atreides', 'emperor']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(f.advisorSetup.steps.length, 1); assert.equal(f.advisorSetup.steps[0].action.type, 'advisorSetup');
  assert.equal(player(f.afterSetup, f.owner).forces[f.location], 1);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.territory), true);
  assert.equal(player(f.afterSetup, f.winner).forces[f.location], 10);
  assert.equal(f.dancers.length, 3); assert.ok(f.dancers.every(card => !card.revealed));
  assert.ok(f.dancers.some(card => card.leader === f.winnerLeader));
  assert.deepEqual([...f.faceDancerDeal.order].sort(), [...f.faceDancerDeal.original].sort());
  assert.equal(f.faceDancerDeal.scalars.length, f.faceDancerDeal.original.length - 1);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.deepEqual(f.funding.steps, [
    { actor: f.winner, action: { type: 'bribe', target: f.tleilaxu, amount: 9 } },
    { actor: f.spender, action: { type: 'bribe', target: f.tleilaxu, amount: 10 } },
  ]);
  assert.equal(player(f.funding.after, f.tleilaxu).spice, player(f.funding.before, f.tleilaxu).spice);
  assert.equal(player(f.funding.after, f.tleilaxu).bribes, 19);
  assert.equal(player(f.fundingCollection.after, f.tleilaxu).spice - player(f.fundingCollection.before, f.tleilaxu).spice, 19);
  assert.equal(player(f.fundingCollection.after, f.tleilaxu).bribes, 0);
  assert.equal(f.shipment.before.turn, 2); assert.equal(f.shipment.before.phase, 5);
  assert.deepEqual(f.shipment.steps[0], { actor: f.tleilaxu,
    action: { type: 'ship', territory: f.territory, sector: f.sector, amount: 20, elite: 0, allyPayment: 0 } });
  assert.equal(player(f.shipment.before, f.tleilaxu).spice - player(f.shipment.after, f.tleilaxu).spice, 20);
  assert.equal(player(f.shipment.before, f.tleilaxu).reserves, 20);
  assert.equal(player(f.shipment.after, f.tleilaxu).reserves, 0);
  assert.equal(player(f.shipment.after, f.tleilaxu).forces[f.location], 20);
  assert.equal(f.planSteps.length, 2);
  assert.ok(f.planSteps.some(step => step.actor === f.winner && step.action.dial === 1 && step.action.support === 1));
  assert.ok(f.planSteps.some(step => step.actor === f.tleilaxu && step.action.dial === 0));
  assert.equal(f.cleanup.steps.filter(step => step.action.type === 'traitorCall' && step.action.call === false).length, 2);
  assert.equal(f.cleanup.steps.filter(step => step.action.type === 'battleOutcomeReady').length, 2);
  assert.equal(f.replacement.before.decision?.kind, 'faceDance');
  assert.equal(player(f.replacement.before, f.tleilaxu).reserves, 0);
  assert.equal(Object.values(player(f.replacement.before, f.tleilaxu).forces).reduce((sum, n) => sum + n, 0), 0);
  assert.equal(player(f.replacement.before, f.tleilaxu).tanks, 20,
    'All replacement stock is actually exhausted by the funded native battle');
  assert.equal(player(f.replacement.before, f.winner).forces[f.location], 9);
  assert.deepEqual(f.replacement.steps, [{ actor: f.tleilaxu, action: f.faceDanceAction }]);
  assert.equal(f.game.phase, 6); assert.equal(f.game.turn, 2); assert.equal(f.game.battle, null); assert.equal(f.game.pendingFaceDance, null);
  assert.equal(f.originalBattle.event, f.originalBattleContext.event); assert.equal(f.originalBattleContext.result, 'normal');
  assert.equal(f.originalBattleContext.winner, f.winner);
  assert.equal(f.originalAutomaticSource.producer, 'faceDance'); assert.deepEqual(f.originalAutomaticSource.faceDance, f.originalParent);
  assert.equal(f.originalParent.amount, 0); assert.deepEqual(f.originalParent.sources, {});
  assert.deepEqual(f.originalParent.returned, { [f.winner]: 9 });
  assert.deepEqual(f.originalAutomaticSource.forces, { [f.location]: 1 });
  assert.deepEqual(f.originalQueue, [f.originalAutomaticSource]);
  assert.equal(player(f.game, f.winner).reserves, player(f.replacement.before, f.winner).reserves + 9);
  const dead = player(f.game, f.winner).leaders.find(leader => leader.id === f.winnerLeader)!;
  const living = player(f.replacement.before, f.winner).leaders.find(leader => leader.id === f.winnerLeader)!;
  assert.equal(living.dead, false); assert.equal(dead.dead, true); assert.equal(dead.deaths, living.deaths + 1);
  assert.equal(player(f.game, f.tleilaxu).faceDancers!.find(card => card.leader === f.winnerLeader)?.revealed, true);
  assert.equal(player(f.game, f.tleilaxu).faceDancers!.filter(card => card.revealed).length, 1);
  assert.deepEqual(f.game.players.map(p => p.spice), f.replacement.before.players.map(p => p.spice), 'Face Dance supplies no invented bounty');
  assert.equal(player(f.game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  assert.ok(f.actions.every(step => step.action.type !== 'semutaCommit' && step.action.type !== 'semutaSelect'));
  assert.equal(f.originalInventory.length, 57); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.deepEqual(traitors(f.game), f.originalTraitors); assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaAdvisorFaceDanceFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the actual completed Face Dance conversion cost');
  assert.equal(pending.batch.cause, 'karama:advisorFlip'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.battle, null); assert.equal(game.pendingFaceDance, null);
  assert.deepEqual(game.lastBattleContext, f.originalBattleContext);
  assert.deepEqual(game.pendingAutomaticAdvisorFaceDance, f.originalParent);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
  assert.deepEqual(game.players.map(p => ({ id: p.id, spice: p.spice })), f.originalBalances);
  assert.deepEqual(player(game, f.tleilaxu).faceDancers, f.originalFaceDancers);
  assert.deepEqual(game.deck, f.originalDeck); assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(traitors(game), f.originalTraitors); return game;
}
function finished(state: Game, f: SemutaAdvisorFaceDanceFixture, prevented: boolean) {
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  assert.equal(game.phase, 7); assert.equal(game.turn, 2); assert.equal(game.battle, null); assert.equal(game.pendingFaceDance, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingAutomaticAdvisorFaceDance, undefined);
  assert.equal(game.pendingAutomaticAdvisorFlips, undefined); assert.deepEqual(game.lastBattleContext, f.originalBattleContext);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(player(game, f.tleilaxu).faceDancers, f.originalFaceDancers);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), prevented);
  assert.equal(fighterCount(player(game, f.owner), f.territory), prevented ? 0 : 1);
  if (prevented) assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
  else assert.equal(player(game, f.owner).advisors?.[f.territory], undefined);
  assert.equal(player(game, f.owner).spice, f.originalBalances.find(p => p.id === f.owner)!.spice + (prevented ? 0 : 2));
  assert.equal(player(game, f.tleilaxu).tanks, 20); assert.equal(player(game, f.tleilaxu).reserves, 0);
  assert.equal(player(game, f.winner).forces[f.location] ?? 0, 0);
  assert.deepEqual(quoteAutomaticAdvisorFlips(game), []); assert.deepEqual(game.deck, f.originalDeck);
  assert.ok(steps.every(step => !['ship', 'move', 'card', 'battlePlan', 'traitorCall', 'chooseBattle'].includes(step.action.type)));
  const later = game.log.slice(f.game.log.length);
  assert.equal(later.filter(row => row.text.includes('revealed a Face Dancer and replaced')).length, 0);
  assert.equal(later.filter(row => row.text.includes('drew three new Face Dancers')).length, 0);
  reject(game, f.tleilaxu, f.faceDanceAction);
  assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(traitors(game), f.originalTraitors); return game;
}
function canceled(state: Game, f: SemutaAdvisorFaceDanceFixture, claimed: boolean) {
  const game = finished(state, f, true);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); return game;
}

for (const claimed of [false, true]) void test(
  `Advanced native exhausted-stock Face Dance advisor conversion cost Semuta ${claimed ? 'claim' : 'pass'} preserves the real return and revealed Face Dancer then resumes cleanup once`, () => {
    const f = fixture(); nativeSource(f); const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = canceled(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
  },
);

void test('native exhausted-stock Face Dance allowance converts the surviving BG counter and collects its actual stronghold income once', () => {
  const f = fixture(); nativeSource(f); const game = finished(allow(structuredClone(f.game)), f, false);
  assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
});

void test('the genuine zero-stock source rejects a positive replacement and fresh cost rejects stale underlying replay', () => {
  const f = fixture();
  reject(f.replacement.before, f.tleilaxu, { ...f.faceDanceAction, sources: { reserves: 1 } });
  const game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
  reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
  reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
  reject(game, f.tleilaxu, f.faceDanceAction); reject(game, f.owner, { type: 'passResponse' });
  reject(game, f.winner, f.planSteps[0].action); reject(game, f.tleilaxu, f.planSteps[1].action);
  reject(game, f.owner, { type: 'prepareAdvisors', territory: f.territory });
  assert.deepEqual(game.pendingAutomaticAdvisorFaceDance, f.originalParent);
  assert.deepEqual(physical(game), f.originalPhysical); canceled(pass(game), f, false);
});

void test('all four minimal profiles legally answer the actual exhausted-stock Face Dance conversion used cost', () => {
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
