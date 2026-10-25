import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaAdvisorHomeworldFixture as fixture, actSemutaAdvisorHomeworld as act,
  passSemutaAdvisorHomeworld as pass, claimSemutaAdvisorHomeworld as claim,
  allowSemutaAdvisorHomeworld as allow, finishSemutaAdvisorHomeworld as finish,
  semutaAdvisorHomeworldPlayer as player, semutaAdvisorHomeworldInventory as inventory,
  semutaAdvisorHomeworldPhysical as physical, type SemutaAdvisorHomeworldFixture,
} from './fixture-semuta-advisor-homeworld';

const transportLogs = (game: Game, f: SemutaAdvisorHomeworldFixture) => game.log.filter(row =>
  row.automatic?.name === (f.kind === 'native' ? 'Homeworld shipment' : 'Junction transport')).length;
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorHomeworldFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.equal(f.setup.homeworlds?.custody, null); assert.ok(f.afterSetup.homeworlds?.custody);
  assert.deepEqual(f.setup.expansions, ['choam']);
  assert.deepEqual(f.enableHomeworlds.steps, [{ actor: f.initial.host, action: { type: 'homeworlds', enabled: true } }]);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', 'beneGesserit', 'atreides', 'guild']);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'predict' && step.action.faction === 'atreides'));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'advisorSetup' &&
    step.action.territory === f.territory && step.action.sector === f.sector));
  assert.equal(player(f.afterSetup, f.owner).forces[f.from], 1);
  assert.equal(player(f.afterSetup, f.shipper).forces[f.from], f.amount);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.territory), true);
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(f.openingOffer.decision?.kind, 'advisorBattle');
  if (f.kind === 'junction') {
    assert.ok(f.bgEnd && f.offerStep && f.junctionOffer);
    assert.deepEqual(f.bgEnd.steps[0], { actor: f.owner, action: { type: 'endMovement' } });
    assert.equal(f.offerStep.actor, f.guild); assert.equal(f.offerStep.action.type, 'offerJunctionTransport');
    assert.equal(f.offerStep.action.rate, 'half'); assert.deepEqual(f.junctionOffer.steps, [f.offerStep]);
  } else assert.equal(f.junctionOffer, null);
  assert.equal(f.routeQuote.blocked, null); assert.deepEqual(f.routeQuote.action, f.nativeAction);
  assert.equal(f.transport.before.active, f.shipper); assert.equal(player(f.transport.before, f.shipper).shipped, false);
  assert.deepEqual(f.transport.steps[0], { actor: f.shipper, action: f.nativeAction });
  assert.equal(f.price, f.kind === 'native' ? 3 : 5);
  assert.equal(player(f.game, f.shipper).spice, player(f.transport.before, f.shipper).spice - f.price);
  assert.equal(player(f.game, f.shipper).forces[f.from], undefined);
  assert.equal(player(f.game, f.shipper).reserves, player(f.transport.before, f.shipper).reserves + f.amount);
  assert.equal(f.depositAfter.normal, f.depositBefore.normal + f.amount);
  assert.equal(f.depositAfter.elite, f.depositBefore.elite);
  assert.equal(f.depositAfter.normal + f.depositAfter.elite, 20);
  assert.equal(player(f.game, f.shipper).shipped, true); assert.equal(player(f.game, f.shipper).moved, 0);
  assert.equal(f.game.active, f.shipper); assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 5);
  assert.deepEqual(f.game.response, f.originalResponse);
  assert.ok(f.originalAutomaticSource.producer === 'homeworldTransport');
  assert.deepEqual(f.originalAutomaticSource.transport, f.originalParent.receipt);
  assert.deepEqual(f.originalQueue, [f.originalAutomaticSource]);
  assert.equal(f.originalParent.receipt.kind, f.kind); assert.equal(f.originalParent.receipt.player, f.shipper);
  assert.equal(f.originalParent.receipt.destination, f.destination);
  assert.equal(f.originalParent.receipt.amount, f.amount); assert.equal(f.originalParent.receipt.elite, 0);
  assert.deepEqual(f.originalParent.receipt.group, { [f.from]: f.amount });
  assert.ok(f.originalParent.sourceEvent.length > 0); assert.equal(f.originalParent.arrival, undefined);
  assert.equal(f.originalHeldStance.aloneFlipHold, f.originalAutomaticSource.event);
  assert.equal(transportLogs(f.game, f) - transportLogs(f.transport.before, f), 1);
  assert.deepEqual(physical(f.game), f.originalPhysical);
  assert.equal(f.sourceActionCount, f.actions.length); assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaAdvisorHomeworldFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, 'karama:advisorFlip');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the original native advisor-flip cost');
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(game.pendingAutomaticAdvisorHomeworldTransport, f.originalParent);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.deepEqual(game.pendingArrivalReaction ?? null, f.originalArrival);
  assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalHeldStance);
  assert.deepEqual(physical(game), f.originalPhysical);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function settled(game: Game, f: SemutaAdvisorHomeworldFixture, canceled: boolean) {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.equal(game.pendingAutomaticAdvisorHomeworldTransport, undefined); assert.equal(game.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(game.pendingArrivalReaction ?? null, null); assert.equal(game.pendingHomeworldShipment ?? null, null);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.phaseOpening ?? null, null); assert.deepEqual(physical(game), f.originalPhysical);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), canceled);
  if (canceled) assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalHeldStance);
  else assert.equal(player(game, f.owner).advisors?.[f.territory], undefined);
  const deposited = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find(world => world.id === f.destination)?.forces[f.shipper];
  assert.deepEqual(deposited, f.depositAfter);
  assert.equal(transportLogs(game, f), transportLogs(f.game, f));
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function prevented(game: Game, f: SemutaAdvisorHomeworldFixture, claimed: boolean) {
  game = settled(game, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed)); return game;
}
function closeOriginalTurn(game: Game, f: SemutaAdvisorHomeworldFixture, canceled: boolean) {
  const steps: { actor: string; action: Action }[] = [], shipper = structuredClone(player(game, f.shipper));
  const result = finish(game, steps);
  assert.deepEqual(steps, [{ actor: f.shipper, action: { type: 'endMovement' } }]);
  assert.ok(!result.movementRemaining?.includes(f.shipper));
  assert.equal(player(result, f.shipper).spice, shipper.spice);
  assert.deepEqual(player(result, f.shipper).forces, shipper.forces);
  assert.equal(player(result, f.shipper).reserves, shipper.reserves);
  assert.equal(player(result, f.shipper).moved, 0);
  assert.deepEqual(result.homeworlds!.custody, f.originalCustody);
  assert.equal(isAdvisor(player(result, f.owner), f.territory), canceled);
  assert.equal(result.pendingAutomaticAdvisorHomeworldTransport, undefined); assert.equal(result.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(transportLogs(result, f), transportLogs(f.game, f));
  assert.deepEqual(inventory(result), f.originalInventory); return result;
}

for (const kind of ['native', 'junction'] as const) for (const claimed of [false, true]) void test(
  `Advanced ${kind} Homeworld transport advisor conversion used cancellation cost ${claimed ? 'claim' : 'pass'} retains the paid typed return and resumes once`, () => {
    const f = fixture({ kind }); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    closeOriginalTurn(game, f, true);
  });

for (const kind of ['native', 'junction'] as const) void test(
  `Advanced ${kind} Homeworld transport conversion allowance flips only the stranded advisor after payment and typed deposit`, () => {
    const f = fixture({ kind }); nativeSource(f);
    const game = settled(allow(structuredClone(f.game)), f, false);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    closeOriginalTurn(game, f, false);
  });

for (const kind of ['native', 'junction'] as const) void test(
  `fresh ${kind} Homeworld conversion costs reject stale and underlying controls while typed return evidence stays parked`, () => {
    const f = fixture({ kind }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.spender, f.action); reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.shipper, f.nativeAction); reject(game, f.shipper, { type: 'endMovement' });
    assert.deepEqual(game.pendingAutomaticAdvisorHomeworldTransport, f.originalParent);
    assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
    assert.deepEqual(physical(game), f.originalPhysical); prevented(pass(game), f, false);
  });

void test('changed original Homeworld source rejects before cost and before a fresh Semuta answer', () => {
  const f = fixture({ kind: 'native' }), beforeCost = structuredClone(f.game);
  assert.ok(beforeCost.pendingAutomaticAdvisorHomeworldTransport);
  beforeCost.pendingAutomaticAdvisorHomeworldTransport.sourceEvent = 'different-original-source';
  reject(beforeCost, f.spender, f.action);
  assert.ok(player(beforeCost, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(beforeCost.discard.some(card => card.id === f.cost), false);
  const afterCost = open(f); assert.ok(afterCost.pendingAutomaticAdvisorHomeworldTransport);
  afterCost.pendingAutomaticAdvisorHomeworldTransport.sourceEvent = 'different-original-source';
  reject(afterCost, f.holder, { type: 'semutaCommit', event: afterCost.pendingTreacheryDiscard!.batch.event });
});

void test('all four minimal policies answer both actual typed Homeworld transport conversion costs legally', () => {
  for (const kind of ['native', 'junction'] as const) {
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
