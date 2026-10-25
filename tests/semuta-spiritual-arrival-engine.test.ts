import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { fighterCount, isAdvisor } from '../game/advisors';
import { quoteAutomaticAdvisorFlips } from '../game/advisor-automatic-flip';
import {
  createSemutaSpiritualArrivalFixture as fixture, actSemutaSpiritualArrival as act,
  passSemutaSpiritualArrival as pass, claimSemutaSpiritualArrival as claim,
  allowSemutaSpiritualArrival as allow, finishSemutaSpiritualArrival as finish,
  advanceSemutaSpiritualArrival as advance, semutaSpiritualArrivalClean as clean,
  semutaSpiritualArrivalPlayer as player, semutaSpiritualArrivalInventory as inventory,
  semutaSpiritualArrivalPhysical as physical, type SemutaSpiritualArrivalFixture,
} from './fixture-semuta-spiritual-arrival';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
const placementLogs = (game: Game, owner: string) => game.log.filter(row => row.text.startsWith(`${player(game, owner).name} sent 1 free`));
function nativeSource(f: SemutaSpiritualArrivalFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.deepEqual(f.setup.expansions, ['choam']); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'beneGesserit', 'atreides', 'emperor']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.setupChoices.steps.some(step => step.actor === f.owner && step.action.type === 'advisorSetup' &&
    step.action.territory === 'arrakeen' && step.action.sector === 10));
  assert.equal(player(f.afterSetup, f.owner).forces['arrakeen:10'], 1);
  assert.equal(player(f.afterSetup, f.shipper).forces['arrakeen:10'], 10);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.deepEqual(f.shipment.steps[0], { actor: f.shipper, action: f.shipmentAction });
  assert.equal(player(f.shipment.before, f.shipper).spice - player(f.shipment.after, f.shipper).spice, 1);
  assert.equal(player(f.shipment.before, f.shipper).reserves - player(f.shipment.after, f.shipper).reserves, 1);
  assert.equal(player(f.game, f.shipper).forces[f.paidLocation], 1);
  assert.equal(player(f.game, f.shipper).shipped, true); assert.equal(player(f.game, f.shipper).moved, 0);
  assert.equal(f.declaration.before.decision?.kind, 'advisor');
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.chooseAction }]);
  assert.equal(f.shippingResponse.kind, 'advisor'); assert.deepEqual(f.shippingResponse.spiritualAdvisorSource, f.shippingSource);
  assert.equal(f.shippingFrame.stage, 'shipping'); assert.equal(player(f.declaration.after, f.owner).forces[f.location] ?? 0, 0);
  assert.equal(player(f.declaration.after, f.owner).reserves, player(f.declaration.before, f.owner).reserves);
  assert.ok(f.placed.steps.some(step => step.action.type === 'passResponse'));
  assert.ok(f.placed.steps.every(step => step.action.type === 'passResponse'), 'Only the actual distinct shipping counter is allowed');
  assert.equal(f.originalFrame.stage, 'arrival'); assert.equal(f.originalFrame.event, f.shippingSource.event);
  assert.deepEqual(f.originalFrame.source, f.shippingSource);
  assert.deepEqual(f.originalFrame.deposit, { key: f.location, before: 0 });
  assert.deepEqual(f.originalFrame.order, { player: f.owner, territory: f.territory, sector: 0, amount: 1, elite: 0, advisors: true });
  assert.deepEqual(Object.keys(f.shippingSource).sort(), ['amount', 'event', 'owner', 'phase', 'sector', 'territory', 'turn']);
  assert.equal(f.shippingSource.territory, 'polar_sink'); assert.equal(f.shippingSource.sector, 0);
  assert.equal(f.originalAutomaticSource.producer, 'spiritualArrival');
  assert.deepEqual(f.originalAutomaticSource.spiritual, f.shippingSource);
  assert.deepEqual(f.originalAutomaticSource.forces, { [f.location]: 1 });
  assert.deepEqual(f.originalQueue, [f.originalAutomaticSource]);
  assert.deepEqual(f.originalPaidParent, [{ entrant: f.shipper, territory: f.paidTerritory, sector: f.paidSector,
    amount: 1, elite: 0, cause: 'shipment', resume: 'none', turn: 1, phase: 5 }]);
  assert.equal(player(f.game, f.owner).reserves, player(f.declaration.before, f.owner).reserves - 1);
  assert.equal(player(f.game, f.owner).forces[f.location], 1);
  assert.equal(player(f.game, f.owner).advisors?.[f.territory]?.lockedTurn, 1);
  assert.equal(player(f.game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  assert.equal(isAdvisor(player(f.game, f.owner), f.territory), true);
  assert.equal(fighterCount(player(f.game, f.owner), f.territory), 0);
  assert.equal(placementLogs(f.game, f.owner).length, 1);
  assert.equal(f.game.phase, 5); assert.equal(f.game.turn, 1); assert.equal(f.game.active, f.shipper);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null); assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaSpiritualArrivalFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the original committed Spiritual conversion cost');
  assert.equal(pending.batch.cause, 'karama:advisorFlip'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingSpiritualAdvisor, f.originalFrame);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.deepEqual(game.pendingArrivalReaction, f.originalPaidParent);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
  assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalLocks);
  assert.deepEqual(game.deck, f.originalDeck); assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function settled(state: Game, f: SemutaSpiritualArrivalFixture, prevented: boolean) {
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingSpiritualAdvisor, undefined);
  assert.equal(game.pendingAutomaticAdvisorFlips, undefined); assert.equal(game.pendingArrivalReaction?.length ?? 0, 0);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical, 'Neither the real free grant nor the paid arrival is transferred or paid again');
  assert.equal(player(game, f.owner).reserves, player(f.declaration.before, f.owner).reserves - 1);
  assert.equal(player(game, f.owner).forces[f.location], 1);
  assert.equal(player(game, f.shipper).forces[f.paidLocation], 1);
  assert.equal(player(game, f.owner).forces['arrakeen:10'], 1); assert.equal(player(game, f.shipper).forces['arrakeen:10'], 10);
  assert.equal(isAdvisor(player(game, f.owner), 'arrakeen'), true);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), prevented);
  assert.equal(fighterCount(player(game, f.owner), f.territory), prevented ? 0 : 1);
  if (prevented) {
    assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
    assert.equal(player(game, f.owner).advisors?.[f.territory]?.lockedTurn, 1);
    assert.equal(player(game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  } else assert.equal(player(game, f.owner).advisors?.[f.territory], undefined);
  assert.deepEqual(quoteAutomaticAdvisorFlips(game), []); assert.equal(placementLogs(game, f.owner).length, 1);
  assert.ok(steps.every(step => !['card', 'ship', 'move', 'endMovement'].includes(step.action.type)));
  assert.deepEqual(game.deck, f.originalDeck); assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function canceled(state: Game, f: SemutaSpiritualArrivalFixture, claimed: boolean) {
  const game = settled(state, f, true);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); reject(game, f.owner, f.chooseAction); reject(game, f.shipper, f.shipmentAction); return game;
}
function continueMovement(state: Game, f: SemutaSpiritualArrivalFixture, prevented: boolean) {
  const steps: { actor: string; action: Action }[] = [];
  let game = act(state, f.shipper, { type: 'endMovement' }, steps);
  game = advance(game, current => current.phase >= 6 && current.phase <= 7 && clean(current), steps);
  assert.equal(steps.filter(step => step.actor === f.shipper && step.action.type === 'endMovement').length, 1);
  assert.ok(steps.every(step => !['ship', 'move', 'card'].includes(step.action.type)));
  assert.equal(game.pendingSpiritualAdvisor, undefined); assert.equal(game.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(game.pendingArrivalReaction?.length ?? 0, 0); assert.equal(placementLogs(game, f.owner).length, 1);
  assert.equal(player(game, f.owner).forces[f.location], 1); assert.equal(player(game, f.shipper).forces[f.paidLocation], 1);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), prevented);
  if (prevented) assert.equal(player(game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}

for (const claimed of [false, true]) void test(
  `Advanced native empty-Polar Spiritual arrival conversion cost Semuta ${claimed ? 'claim' : 'pass'} preserves the committed grant and paid parent then resumes once`, () => {
    const f = fixture(); nativeSource(f); const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = canceled(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    continueMovement(game, f, true);
  },
);

void test('native Spiritual arrival allowance converts the really placed Polar advisor before resuming the original paid entry', () => {
  const f = fixture(); nativeSource(f); const game = settled(allow(structuredClone(f.game)), f, false);
  assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  continueMovement(game, f, false);
});

void test('fresh Spiritual arrival cost rejects stale and underlying declarations while its exact source deposit and paid queue remain held', () => {
  const f = fixture(), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
  reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
  reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
  reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, f.chooseAction);
  reject(game, f.owner, { type: 'decision', accept: false }); reject(game, f.shipper, f.shipmentAction);
  reject(game, f.shipper, { type: 'endMovement' }); reject(game, f.owner, { type: 'prepareAdvisors', territory: f.territory });
  assert.deepEqual(game.pendingSpiritualAdvisor, f.originalFrame); assert.deepEqual(game.pendingArrivalReaction, f.originalPaidParent);
  assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalLocks); assert.deepEqual(physical(game), f.originalPhysical);
  canceled(pass(game), f, false);
});

void test('controlled Spiritual source deposit and paid-parent mismatches reject before cost or fresh Semuta appropriation', () => {
  const f = fixture();
  // These deliberately changed copies test source validation only. They are
  // separate negative controls, never the genuine fixture's native history.
  const changes: { name: string; change: (game: Game) => void }[] = [
    { name: 'source', change(game) {
      const frame = game.pendingSpiritualAdvisor!;
      frame.source = { ...frame.source!, event: `${frame.source!.event}:stale` };
    } },
    { name: 'deposit', change(game) {
      const frame = game.pendingSpiritualAdvisor!;
      frame.deposit = { ...frame.deposit!, before: frame.deposit!.before + 1 };
    } },
    { name: 'paid parent', change(game) {
      game.pendingArrivalReaction = game.pendingArrivalReaction!.map((entry, index) =>
        index === 0 ? { ...entry, amount: entry.amount + 1 } : entry);
    } },
  ];
  for (const { name, change } of changes) {
    const beforeCost = structuredClone(f.game); change(beforeCost);
    reject(beforeCost, f.spender, f.action);
    assert.ok(player(beforeCost, f.spender).hand.some(card => card.id === f.cost), name);
    assert.ok(player(beforeCost, f.holder).hand.some(card => card.id === f.semuta), name);
    assert.deepEqual(inventory(beforeCost), f.originalInventory);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event; change(offered);
    reject(offered, f.holder, { type: 'semutaCommit', event });
    assert.ok(player(offered, f.holder).hand.some(card => card.id === f.semuta), name);
    assert.equal(offered.discard.filter(card => card.id === f.cost).length, 1, name);
    assert.deepEqual(inventory(offered), f.originalInventory);
  }
});

void test('all four minimal profiles legally answer the real placed Spiritual arrival conversion cost', () => {
  const f = fixture(), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
  for (const difficulty of DIFFICULTIES) {
    const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
    const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
    assert.deepEqual(own, before); assert.ok(action.type === 'semutaPass' || action.type === 'semutaCommit'); assert.equal(action.event, event);
    let game = act(structuredClone(offered), f.holder, action); const claimed = action.type === 'semutaCommit';
    if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
      const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
      const selected = botActions(selecting)[0]; assert.ok(selected);
      assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost); game = act(game, f.holder, selected);
    } else if (game.pendingTreacheryDiscard) game = pass(game);
    canceled(game, f, claimed);
  }
});
