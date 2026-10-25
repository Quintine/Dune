import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { isAdvisor } from '../game/advisors';
import { spiritualAdvisorMatchingKey } from '../game/spiritual-advisor';
import {
  createSemutaSpiritualCostFixture as fixture, actSemutaSpiritualCost as act,
  passSemutaSpiritualCost as pass, claimSemutaSpiritualCost as claim, allowSemutaSpiritualCost as allow,
  finishSemutaSpiritualCost as finish, semutaSpiritualCostPlayer as player,
  semutaSpiritualCostInventory as inventory, semutaSpiritualCostPhysical as physical,
  semutaSpiritualCostClean as clean, type SemutaSpiritualCostFixture,
} from './fixture-semuta-spiritual-cost';

const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  order: game.order, movementRemaining: game.movementRemaining, storm: game.storm,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard });
const grantLogs = (game: Game, owner: string) => game.log.filter(entry =>
  entry.text.startsWith(`${player(game, owner).name} sent 1 free`));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaSpiritualCostFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.deepEqual(f.advisorSetup.steps[0].action, { type: 'advisorSetup', territory: f.territory, sector: f.sector });
  assert.equal(player(f.afterSetup, f.owner).forces[f.location], 1);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.territory), f.stage === 'shipping');
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.ok(f.bgTurn.steps.some(step => step.actor === f.owner && step.action.type === 'endMovement'));
  assert.deepEqual(f.paidParent.steps[0], { actor: f.shipper, action: f.paidShipmentAction });
  assert.equal(player(f.paidParent.before, f.shipper).spice - player(f.game, f.shipper).spice, 1);
  assert.equal(player(f.game, f.shipper).reserves, player(f.paidParent.before, f.shipper).reserves - 1);
  assert.equal(player(f.game, f.shipper).forces[f.foreignLocation], f.stage === 'shipping' ? 11 : 1);
  assert.equal(player(f.game, f.shipper).shipped, true); assert.equal(player(f.game, f.shipper).moved, 0);
  assert.deepEqual(f.beforeDeclaration.decision, f.originalChooser);
  assert.equal(f.originalChooser.shipment, f.shipper); assert.equal(f.originalChooser.destination, f.foreignLocation);
  assert.equal(f.originalChooser.ambassadorEvent ?? null, null); assert.equal(f.originalChooser.revivalEvent ?? null, null);
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.nativeAction }]);
  assert.equal(f.shipping.response?.kind, 'advisor'); assert.equal(f.shipping.pendingSpiritualAdvisor?.stage, 'shipping');
  assert.deepEqual(physical(f.shipping), physical(f.beforeDeclaration));
  if (f.stage === 'matching') {
    assert.ok(f.shippingAllowance); assert.ok(f.shippingAllowance.steps.length > 0);
    assert.ok(f.shippingAllowance.steps.every(step => step.action.type === 'passResponse'));
    assert.equal(f.game.response?.advisors, false); assert.equal(f.game.response?.automaticAdvisorFlip ?? null, null);
  } else assert.equal(f.shippingAllowance, null);
  assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.shipper);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.response?.kind, f.stage === 'shipping' ? 'advisor' : 'advisorFlip');
  assert.deepEqual(f.game.response, f.originalResponse); assert.deepEqual(f.game.pendingSpiritualAdvisor, f.originalFrame);
  assert.equal(f.originalFrame.stage, f.stage); assert.deepEqual(f.originalFrame.decision, f.originalChooser);
  assert.deepEqual(f.originalFrame.source, f.originalSource); assert.deepEqual(f.originalFrame.denied, []);
  assert.equal(f.originalFrame.selection, JSON.stringify([f.originalSource, f.originalFrame.order]));
  assert.deepEqual(f.game.pendingArrivalReaction, f.originalParent); assert.ok(f.originalArrival);
  assert.equal(f.originalArrival.entrant, f.shipper); assert.equal(f.originalArrival.territory, f.foreignDestination);
  assert.equal(f.originalArrival.sector, f.foreignSector); assert.equal(f.originalArrival.amount, 1);
  assert.equal(f.game.pendingShipment ?? null, null); assert.equal(f.game.pendingAmbassador ?? null, null);
  assert.deepEqual(physical(f.game), physical(f.beforeDeclaration)); assert.equal(grantLogs(f.game, f.owner).length, 0);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaSpiritualCostFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending);
  assert.equal(pending.continuation.kind, f.stage === 'shipping' ? 'karamaTerminalDiscard' : 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaTerminalDiscard' && pending.continuation.kind !== 'karamaAdvisorFlipDiscard')
    throw Error('Expected this exact native Spiritual cancellation cost');
  assert.deepEqual(pending.batch.entries.map(entry => ({ id: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ id: f.cost, by: f.spender, face: true }]);
  assert.equal(pending.batch.cause, `karama:${f.originalResponse.kind}`);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingSpiritualAdvisor, f.originalFrame); assert.deepEqual(game.pendingArrivalReaction, f.originalParent);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function settled(game: Game, f: SemutaSpiritualCostFixture, placement: boolean, target = f.territory) {
  const done = finish(game); assert.equal(clean(done), true); assert.equal(done.pendingSpiritualAdvisor ?? null, null);
  assert.equal(done.pendingArrivalReaction?.length ?? 0, 0); assert.equal(done.pendingShipment ?? null, null);
  assert.deepEqual(clock(done), clock(f.game)); assert.deepEqual(inventory(done), f.originalInventory);
  assert.equal(grantLogs(done, f.owner).length, Number(placement));
  const bg = player(done, f.owner), original = player(f.game, f.owner);
  assert.equal(bg.reserves, original.reserves - Number(placement)); assert.equal(bg.spice, original.spice);
  assert.equal(bg.shipped, original.shipped); assert.equal(bg.moved, original.moved); assert.equal(bg.tanks, original.tanks);
  assert.equal(bg.forces[f.location], original.forces[f.location] + Number(placement && target === f.territory));
  if (placement && target === f.foreignDestination && f.stage === 'matching') assert.equal(bg.forces[f.foreignLocation], 1);
  for (const p of done.players.filter(p => p.id !== f.owner))
    assert.deepEqual(physical(done).find(seat => seat.id === p.id), f.originalPhysical.find(seat => seat.id === p.id));
  if (!placement) assert.deepEqual(physical(done), f.originalPhysical);
  else assert.equal(isAdvisor(bg, target), f.stage === 'shipping' || target === f.foreignDestination);
  assert.equal(player(done, f.shipper).forces[f.foreignLocation], f.stage === 'shipping' ? 11 : 1);
  reject(done, f.owner, f.nativeAction); return done;
}
function denied(state: Game, f: SemutaSpiritualCostFixture, claimed: boolean) {
  const game = finish(state); assert.equal(game.response ?? null, null); assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(grantLogs(game, f.owner).length, 0);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  if (f.stage === 'matching') {
    assert.deepEqual(game.decision, f.originalChooser); assert.equal(game.pendingSpiritualAdvisor?.stage, 'offer');
    assert.deepEqual(game.pendingArrivalReaction, f.originalParent);
    assert.deepEqual(game.pendingSpiritualAdvisor?.denied, [spiritualAdvisorMatchingKey(f.originalSource)]);
    assert.equal(game.pendingSpiritualAdvisor?.source ?? null, null); assert.equal(game.pendingSpiritualAdvisor?.order ?? null, null);
    reject(game, f.owner, f.sink);
    const choices = viewGame(game, f.owner).spiritualAdvisorChoices; assert.ok(choices);
    assert.ok(choices.choices.filter(choice => !choice.accompany).every(choice => choice.blocked));
    assert.ok(choices.choices.some(choice => choice.accompany && !choice.blocked));
  } else {
    assert.equal(game.pendingSpiritualAdvisor ?? null, null); assert.equal(game.decision ?? null, null);
    assert.equal(clean(game), true);
  }
  assert.deepEqual(inventory(game), f.originalInventory); reject(game, f.spender, f.action); return game;
}

for (const stage of ['shipping', 'matching'] as const) for (const claimed of [false, true]) void test(
  `native Spiritual ${stage} Karama cost Semuta ${claimed ? 'claim' : 'pass'} preserves the paid parent and applies original denial once`, () => {
    const f = fixture({ stage }); nativeSource(f); const offered = open(f);
    let game = denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    if (stage === 'matching') game = act(game, f.owner, f.decline);
    settled(game, f, false);
  },
);

for (const stage of ['shipping', 'matching'] as const) void test(
  `native Spiritual ${stage} allowance withdraws and places the original free packet once without another foreign payment`, () => {
    const f = fixture({ stage }); nativeSource(f); const game = settled(allow(structuredClone(f.game)), f, true);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  },
);

void test('native Spiritual matching denial retains the legal actual accompaniment replacement for claim and pass', () => {
  for (const claimed of [false, true]) {
    const f = fixture({ stage: 'matching' }), offered = open(f);
    let game = denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    assert.ok(f.replacementAction); game = act(game, f.owner, f.replacementAction);
    if (game.response?.spiritualAdvisorSource) game = allow(game);
    settled(game, f, true, f.foreignDestination);
  }
});

void test('native Spiritual cost rejects stale foreign and underlying original choices while the exact cost is offered', () => {
  for (const stage of ['shipping', 'matching'] as const) {
    const f = fixture({ stage }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, f.nativeAction); reject(game, f.owner, f.decline);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.shipper, { type: 'endMovement' });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('controlled Spiritual parent or exact source signature change rejects the original cost without spending it', () => {
  for (const stage of ['shipping', 'matching'] as const) for (const changed of ['parent', 'source'] as const) {
    const f = fixture({ stage }), game = structuredClone(f.game);
    // Explicit malformed-source supplement; primary source remains genuinely
    // earned. No played custody, physical group, wallet or clock is installed.
    if (changed === 'parent') game.pendingSpiritualAdvisor!.signature = 'changed-original-parent';
    else game.response!.spiritualAdvisorSource = { ...f.originalSource, amount: 2 };
    reject(game, f.spender, f.action); assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  }
});

void test('all four minimal profiles legally claim or pass actual Spiritual shipping and matching costs', () => {
  for (const stage of ['shipping', 'matching'] as const) {
    const f = fixture({ stage }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const proposed = botActions(own)[0]; assert.ok(proposed);
      assert.ok(proposed.type === 'semutaCommit' || proposed.type === 'semutaPass'); assert.equal(proposed.event, event);
      let game = act(structuredClone(offered), f.holder, proposed);
      const claimed = proposed.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      game = denied(game, f, claimed);
      if (stage === 'matching') game = act(game, f.owner, f.decline);
      settled(game, f, false);
    }
  }
});
