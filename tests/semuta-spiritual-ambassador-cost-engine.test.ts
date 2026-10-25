import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { spiritualAdvisorMatchingKey } from '../game/spiritual-advisor';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaSpiritualAmbassadorCostFixture as fixture, actSemutaSpiritualAmbassadorCost as act,
  passSemutaSpiritualAmbassadorCost as pass, claimSemutaSpiritualAmbassadorCost as claim,
  allowSemutaSpiritualAmbassadorCost as allow, finishSemutaSpiritualAmbassadorCost as finish,
  semutaSpiritualAmbassadorCostPlayer as player, semutaSpiritualAmbassadorCostInventory as inventory,
  semutaSpiritualAmbassadorCostPhysical as physical, semutaSpiritualAmbassadorCostClean as clean,
  type SemutaSpiritualAmbassadorCostFixture,
} from './fixture-semuta-spiritual-ambassador-cost';

const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  order: game.order, movementRemaining: game.movementRemaining, storm: game.storm,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard });
const grantLogs = (game: Game, owner: string) => game.log.filter(entry =>
  entry.text.startsWith(`${player(game, owner).name} sent 1 free`));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaSpiritualAmbassadorCostFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.deepEqual(f.setup.expansions, ['choam', 'ecaz']);
  assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', 'ecaz', 'beneGesserit', 'atreides']);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(player => player.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(f.packet.scalars.length, 9); assert.ok(f.packetCreation && f.advisorSetup);
  const packetAfter = f.packetCreation.after.ecazAmbassadors!;
  assert.deepEqual(packetAfter.cohort.map(id => packetAfter.tokens.find(token => token.id === id)!.effect), f.packet.supply);
  assert.deepEqual(f.advisorSetup.steps[0].action, { type: 'advisorSetup', territory: f.territory, sector: f.sector });
  assert.equal(player(f.afterSetup, f.owner).forces[f.location], 1);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.territory), f.stage === 'shipping');
  assert.equal(f.acquisition.price, 1); assert.equal(f.acquisition.bid.actor, f.holder);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(player(f.placement.before, f.ecaz).spice - player(f.placement.after, f.ecaz).spice, 1);
  assert.ok(f.bgTurn.steps.some(step => step.actor === f.owner && step.action.type === 'endMovement'));
  assert.deepEqual(f.paidEntry.steps[0], { actor: f.entrant, action: f.paidShipmentAction });
  assert.equal(player(f.paidEntry.before, f.entrant).spice - player(f.paidEntry.after, f.entrant).spice, 1);
  assert.equal(player(f.game, f.entrant).forces['carthag:11'], 1); assert.equal(player(f.game, f.entrant).shipped, true);
  assert.equal(f.offer.pendingAmbassador?.stage, 'offer'); assert.equal(f.originalToken.effect, 'guild');
  assert.equal(f.originalToken.zone, 'used');
  assert.equal(f.trigger.after.pendingAmbassador?.beneficiary, f.shipper);
  assert.deepEqual(f.foreignShipment.steps[0], { actor: f.shipper, action: f.foreignShipmentAction });
  assert.equal(player(f.foreignShipment.before, f.shipper).spice, player(f.game, f.shipper).spice);
  assert.equal(player(f.foreignShipment.before, f.shipper).reserves - player(f.game, f.shipper).reserves, 1);
  assert.equal(player(f.game, f.shipper).forces[f.foreignLocation], 1);
  assert.equal(player(f.game, f.shipper).shipped, player(f.foreignShipment.before, f.shipper).shipped);
  assert.equal(player(f.game, f.shipper).moved, player(f.foreignShipment.before, f.shipper).moved);
  assert.deepEqual(f.beforeDeclaration.decision, f.originalChooser);
  assert.equal(f.originalChooser.shipment, f.shipper); assert.equal(f.originalChooser.destination, f.foreignLocation);
  assert.equal(f.originalChooser.ambassadorEvent, f.event);
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.nativeAction }]);
  assert.equal(f.shipping.response?.kind, 'advisor'); assert.equal(f.shipping.pendingSpiritualAdvisor?.stage, 'shipping');
  assert.deepEqual(physical(f.shipping), physical(f.beforeDeclaration));
  if (f.stage === 'matching') {
    assert.ok(f.shippingAllowance && f.shippingAllowance.steps.length > 0);
    assert.ok(f.shippingAllowance.steps.every(step => step.action.type === 'passResponse'));
    assert.equal(new Set(f.shippingAllowance.steps.map(step => step.actor)).size, f.shippingAllowance.steps.length);
    assert.equal(f.game.response?.advisors, false); assert.equal(f.game.response?.automaticAdvisorFlip ?? null, null);
  } else assert.equal(f.shippingAllowance, null);
  assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.entrant);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.response?.kind, f.stage === 'shipping' ? 'advisor' : 'advisorFlip');
  assert.deepEqual(f.game.response, f.originalResponse); assert.deepEqual(f.game.pendingSpiritualAdvisor, f.originalFrame);
  assert.equal(f.originalFrame.stage, f.stage); assert.deepEqual(f.originalFrame.decision, f.originalChooser);
  assert.deepEqual(f.originalFrame.source, f.originalSource); assert.deepEqual(f.originalFrame.denied, []);
  assert.equal(f.originalFrame.selection, JSON.stringify([f.originalSource, f.originalFrame.order]));
  assert.deepEqual(f.game.pendingAmbassador, f.originalAmbassador);
  assert.equal(f.originalAmbassador.shipmentReceipt?.next, 'advisor');
  assert.deepEqual(f.originalAmbassador.shipmentReceipt, f.originalForeignReceipt);
  assert.deepEqual(f.game.pendingArrivalReaction ?? null, f.originalQueue);
  assert.deepEqual(physical(f.game), physical(f.beforeDeclaration)); assert.equal(grantLogs(f.game, f.owner).length, 0);
  assert.equal(f.sourceActionCount, f.actions.length); assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaSpiritualAmbassadorCostFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending);
  assert.equal(pending.continuation.kind, f.stage === 'shipping' ? 'karamaTerminalDiscard' : 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaTerminalDiscard' && pending.continuation.kind !== 'karamaAdvisorFlipDiscard')
    throw Error('Use the original Guild-derived Spiritual cost');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.equal(pending.batch.cause, `karama:${f.originalResponse.kind}`);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingSpiritualAdvisor, f.originalFrame);
  assert.deepEqual(game.pendingAmbassador, f.originalAmbassador);
  assert.deepEqual(game.pendingArrivalReaction ?? null, f.originalQueue);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function denied(game: Game, f: SemutaSpiritualAmbassadorCostFixture, claimed: boolean) {
  game = finish(game); assert.equal(game.response ?? null, null); assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(grantLogs(game, f.owner).length, 0);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  if (f.stage === 'matching') {
    assert.deepEqual(game.decision, f.originalChooser); assert.equal(game.pendingSpiritualAdvisor?.stage, 'offer');
    assert.deepEqual(game.pendingAmbassador, f.originalAmbassador);
    assert.deepEqual(game.pendingArrivalReaction ?? null, f.originalQueue);
    assert.deepEqual(game.pendingSpiritualAdvisor?.denied, [spiritualAdvisorMatchingKey(f.originalSource)]);
    assert.equal(game.pendingSpiritualAdvisor?.source ?? null, null); assert.equal(game.pendingSpiritualAdvisor?.order ?? null, null);
    reject(game, f.owner, f.sink);
    const choices = viewGame(game, f.owner).spiritualAdvisorChoices; assert.ok(choices);
    assert.ok(choices.choices.filter(choice => !choice.accompany).every(choice => choice.blocked));
    assert.ok(choices.choices.some(choice => choice.accompany && !choice.blocked));
  } else {
    assert.equal(game.pendingSpiritualAdvisor ?? null, null); assert.equal(game.pendingAmbassador ?? null, null);
    assert.equal(game.decision ?? null, null); assert.equal(clean(game), true);
  }
  assert.deepEqual(inventory(game), f.originalInventory); reject(game, f.spender, f.action); return game;
}
function settled(game: Game, f: SemutaSpiritualAmbassadorCostFixture, placed: boolean, target = f.territory) {
  game = finish(game); assert.equal(clean(game), true);
  assert.equal(game.pendingSpiritualAdvisor ?? null, null); assert.equal(game.pendingAmbassador ?? null, null);
  assert.equal(game.pendingArrivalReaction?.length ?? 0, 0); assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.deepEqual(clock(game), clock(f.game)); assert.deepEqual(inventory(game), f.originalInventory);
  assert.equal(grantLogs(game, f.owner).length, Number(placed));
  const bg = player(game, f.owner), original = player(f.game, f.owner);
  assert.equal(bg.reserves, original.reserves - Number(placed)); assert.equal(bg.spice, original.spice);
  assert.equal(bg.shipped, original.shipped); assert.equal(bg.moved, original.moved); assert.equal(bg.tanks, original.tanks);
  assert.equal(bg.forces[f.location], original.forces[f.location] + Number(placed && target === f.territory));
  if (placed && target === f.foreignDestination && f.stage === 'matching') assert.equal(bg.forces[f.foreignLocation], 1);
  for (const seat of game.players.filter(seat => seat.id !== f.owner))
    assert.deepEqual(physical(game).find(player => player.id === seat.id), f.originalPhysical.find(player => player.id === seat.id));
  if (!placed) assert.deepEqual(physical(game), f.originalPhysical);
  else assert.equal(isAdvisor(bg, target), f.stage === 'shipping' || target === f.foreignDestination);
  assert.equal(player(game, f.shipper).forces[f.foreignLocation], 1);
  assert.equal(player(game, f.entrant).forces['carthag:11'], 1);
  assert.deepEqual(game.ecazAmbassadors!.tokens.find(token => token.id === f.token), f.originalToken);
  reject(game, f.owner, f.nativeAction); return game;
}

for (const stage of ['shipping', 'matching'] as const) for (const claimed of [false, true]) void test(
  `native Guild Ambassador Spiritual ${stage} Karama cost Semuta ${claimed ? 'claim' : 'pass'} preserves its committed grant and applies native denial once`, () => {
    const f = fixture({ stage }); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    let game = denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    if (stage === 'matching') game = act(game, f.owner, f.decline);
    settled(game, f, false);
  });

for (const stage of ['shipping', 'matching'] as const) void test(
  `native Guild Ambassador Spiritual ${stage} allowance places the real free packet once without another token or foreign shipment`, () => {
    const f = fixture({ stage }); nativeSource(f);
    const game = settled(allow(structuredClone(f.game)), f, true);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  });

void test('native Guild Ambassador Spiritual matching denial preserves the real legal accompaniment replacement for claim and pass', () => {
  for (const claimed of [false, true]) {
    const f = fixture({ stage: 'matching' }), offered = open(f);
    let game = denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    assert.ok(f.replacementAction); game = act(game, f.owner, f.replacementAction);
    if (game.response?.spiritualAdvisorSource) game = allow(game);
    settled(game, f, true, f.foreignDestination);
  }
});

void test('Guild-derived Spiritual costs reject stale and underlying controls while their exact original child stays parked', () => {
  for (const stage of ['shipping', 'matching'] as const) {
    const f = fixture({ stage }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, f.nativeAction); reject(game, f.owner, f.decline);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.entrant, { type: 'endMovement' });
    reject(game, f.shipper, f.foreignShipmentAction);
    assert.deepEqual(game.pendingAmbassador, f.originalAmbassador); assert.deepEqual(physical(game), f.originalPhysical);
    denied(pass(game), f, false);
  }
});

void test('changed Guild parent or Spiritual source rejects before cost and before a fresh Semuta answer', () => {
  for (const stage of ['shipping', 'matching'] as const) {
    const f = fixture({ stage });
    for (const changed of ['parent', 'source'] as const) {
      const game = structuredClone(f.game);
      if (changed === 'parent') game.pendingSpiritualAdvisor!.signature = 'different-original-parent';
      else game.response!.spiritualAdvisorSource = { ...f.originalSource, amount: 2 };
      reject(game, f.spender, f.action); assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    }
    const game = open(f); assert.ok(game.pendingAmbassador);
    game.pendingAmbassador.event = 'different-original-ambassador';
    reject(game, f.holder, { type: 'semutaCommit', event: game.pendingTreacheryDiscard!.batch.event });
  }
});

void test('all four minimal policies answer the actual Guild-derived Spiritual shipping and matching costs legally', () => {
  for (const stage of ['shipping', 'matching'] as const) {
    const f = fixture({ stage }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
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
      game = denied(game, f, claimed);
      if (stage === 'matching') game = act(game, f.owner, f.decline);
      settled(game, f, false);
    }
  }
});
