import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaAdvisorTransportFixture as fixture, actSemutaAdvisorTransport as act,
  passSemutaAdvisorTransport as pass, claimSemutaAdvisorTransport as claim,
  allowSemutaAdvisorTransport as allow, finishSemutaAdvisorTransport as finish,
  semutaAdvisorTransportPlayer as player, semutaAdvisorTransportInventory as inventory,
  semutaAdvisorTransportPhysical as physical, type SemutaAdvisorTransportFixture,
} from './fixture-semuta-advisor-transport';

const transportLogs = (game: Game) => game.log.filter(row => row.text.includes('used Guild transport for 5 forces.')).length;
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorTransportFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', 'beneGesserit', 'atreides', 'guild']);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'predict' && step.action.faction === 'atreides'));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'advisorSetup' &&
    step.action.territory === f.territory && step.action.sector === f.sector));
  assert.equal(player(f.afterSetup, f.owner).forces[f.from], 1);
  assert.equal(player(f.afterSetup, f.guild).forces[f.from], 5);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.territory), true);
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.openingOffer.decision?.kind, 'advisorBattle');
  assert.ok(f.declinedPreparation.steps.some(step => step.actor === f.owner && step.action.type === 'decision' && step.action.accept === false));
  assert.equal(f.transport.before.active, f.guild); assert.equal(player(f.transport.before, f.guild).shipped, false);
  assert.deepEqual(f.transport.steps[0], { actor: f.guild, action: f.nativeAction });
  assert.ok(f.price > 0); assert.equal(f.transport.price, f.price);
  assert.equal(player(f.game, f.guild).spice, player(f.transport.before, f.guild).spice - f.price);
  assert.equal(player(f.game, f.guild).forces[f.from], undefined);
  if (f.kind === 'return') assert.equal(player(f.game, f.guild).reserves, player(f.transport.before, f.guild).reserves + 5);
  else assert.equal(player(f.game, f.guild).forces[f.to], 5);
  assert.equal(player(f.game, f.guild).shipped, true); assert.equal(player(f.game, f.guild).moved, 0);
  assert.equal(f.game.active, f.guild); assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 5);
  assert.deepEqual(f.game.response, f.originalResponse);
  assert.ok(f.originalAutomaticSource.producer === 'guildTransport');
  assert.deepEqual(f.originalAutomaticSource.transport, f.originalParent);
  assert.deepEqual(f.originalQueue, [f.originalAutomaticSource]);
  assert.equal(f.originalParent.player, f.guild); assert.equal(f.originalParent.origin, f.territory);
  assert.equal(f.originalParent.to, f.kind === 'return' ? 'reserves' : 'imperial_basin');
  assert.equal(f.originalParent.amount, 5); assert.equal(f.originalParent.elite, 0);
  assert.deepEqual(f.originalParent.group, { [f.from]: 5 });
  assert.equal(f.originalHeldStance.aloneFlipHold, f.originalAutomaticSource.event);
  assert.equal(transportLogs(f.game) - transportLogs(f.transport.before), 1);
  assert.deepEqual(physical(f.game), f.originalPhysical);
  assert.equal(f.sourceActionCount, f.actions.length); assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaAdvisorTransportFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, 'karama:advisorFlip');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the original native advisor-flip cost');
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(game.pendingAutomaticAdvisorTransport, f.originalParent);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.deepEqual(game.pendingArrivalReaction ?? null, f.originalArrival);
  assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalHeldStance);
  assert.deepEqual(physical(game), f.originalPhysical);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function settled(game: Game, f: SemutaAdvisorTransportFixture, canceled: boolean) {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.equal(game.pendingAutomaticAdvisorTransport, undefined); assert.equal(game.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(game.pendingArrivalReaction ?? null, null); assert.equal(game.pendingGuildTransport ?? null, null);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.phaseOpening ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), canceled);
  if (canceled) assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalHeldStance);
  else assert.equal(player(game, f.owner).advisors?.[f.territory], undefined);
  assert.equal(transportLogs(game), transportLogs(f.game));
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function prevented(game: Game, f: SemutaAdvisorTransportFixture, claimed: boolean) {
  game = settled(game, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  return game;
}
function closeOriginalTurn(game: Game, f: SemutaAdvisorTransportFixture, canceled: boolean) {
  const steps: { actor: string; action: Action }[] = [], guild = structuredClone(player(game, f.guild));
  const result = finish(game, steps);
  assert.deepEqual(steps, [{ actor: f.guild, action: { type: 'endMovement' } }]);
  assert.ok(!result.movementRemaining?.includes(f.guild));
  assert.equal(player(result, f.guild).spice, guild.spice);
  assert.deepEqual(player(result, f.guild).forces, guild.forces);
  assert.equal(player(result, f.guild).reserves, guild.reserves);
  assert.equal(player(result, f.guild).moved, 0);
  assert.equal(isAdvisor(player(result, f.owner), f.territory), canceled);
  assert.equal(result.pendingAutomaticAdvisorTransport, undefined); assert.equal(result.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(transportLogs(result), transportLogs(f.game));
  assert.deepEqual(inventory(result), f.originalInventory); return result;
}

for (const kind of ['cross', 'return'] as const) for (const claimed of [false, true]) void test(
  `Advanced native ${kind} transport advisor conversion used cancellation cost ${claimed ? 'claim' : 'pass'} retains the paid shipment and resumes its arrival once`, () => {
    const f = fixture({ kind }); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    closeOriginalTurn(game, f, true);
  });

for (const kind of ['cross', 'return'] as const) void test(
  `Advanced native ${kind} transport advisor conversion allowance flips only the stranded group after the original payment`, () => {
    const f = fixture({ kind }); nativeSource(f);
    const game = settled(allow(structuredClone(f.game)), f, false);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    closeOriginalTurn(game, f, false);
  });

for (const kind of ['cross', 'return'] as const) void test(
  `fresh ${kind} transport conversion costs reject stale and underlying controls while the committed parent stays parked`, () => {
    const f = fixture({ kind }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.spender, f.action); reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.guild, f.nativeAction); reject(game, f.guild, { type: 'endMovement' });
    assert.deepEqual(game.pendingAutomaticAdvisorTransport, f.originalParent);
    assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
    assert.deepEqual(physical(game), f.originalPhysical);
    prevented(pass(game), f, false);
  });

void test('changed committed transport evidence rejects before cost and before a fresh Semuta answer', () => {
  const f = fixture({ kind: 'cross' }), beforeCost = structuredClone(f.game);
  assert.ok(beforeCost.pendingAutomaticAdvisorTransport); beforeCost.pendingAutomaticAdvisorTransport.amount--;
  reject(beforeCost, f.spender, f.action);
  assert.ok(player(beforeCost, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(beforeCost.discard.some(card => card.id === f.cost), false);
  const afterCost = open(f); assert.ok(afterCost.pendingAutomaticAdvisorTransport);
  afterCost.pendingAutomaticAdvisorTransport.amount--;
  reject(afterCost, f.holder, { type: 'semutaCommit', event: afterCost.pendingTreacheryDiscard!.batch.event });
});

void test('all four minimal policies answer both actual committed transport conversion costs legally', () => {
  for (const kind of ['cross', 'return'] as const) {
    const f = fixture({ kind }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(player => player.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before);
      assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass'); assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const choosing = viewGame(game, f.holder); choosing.players.find(player => player.id === f.holder)!.bot = difficulty;
        const selected = botActions(choosing)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      closeOriginalTurn(prevented(game, f, claimed), f, true);
    }
  }
});
