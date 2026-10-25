import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { fighterCount, isAdvisor } from '../game/advisors';
import { quoteAutomaticAdvisorFlips } from '../game/advisor-automatic-flip';
import {
  createSemutaSpiritualAmbassadorArrivalFixture as fixture, actSemutaSpiritualAmbassadorArrival as act,
  passSemutaSpiritualAmbassadorArrival as pass, claimSemutaSpiritualAmbassadorArrival as claim,
  allowSemutaSpiritualAmbassadorArrival as allow, finishSemutaSpiritualAmbassadorArrival as finish,
  advanceSemutaSpiritualAmbassadorArrival as advance, semutaSpiritualAmbassadorArrivalClean as clean,
  semutaSpiritualAmbassadorArrivalPlayer as player, semutaSpiritualAmbassadorArrivalInventory as inventory,
  semutaSpiritualAmbassadorArrivalPhysical as physical, type SemutaSpiritualAmbassadorArrivalFixture,
} from './fixture-semuta-spiritual-ambassador-arrival';

const spiritualLogs = (game: Game, owner: string) => game.log.filter(row => row.text.startsWith(`${player(game, owner).name} sent 1 free`));
const guildLogs = (game: Game) => game.log.filter(row => row.text.includes('for free through the Guild Ambassador. Their ordinary shipment'));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaSpiritualAmbassadorArrivalFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.deepEqual(f.setup.expansions, ['choam', 'ecaz']); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'ecaz', 'beneGesserit', 'atreides', 'emperor']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(c => c.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(c => c.id === f.cost && c.effect === 'karama'));
  assert.equal(f.packet.scalars.length, 9); assert.equal(f.packetCreation.steps.length, 1);
  assert.equal(f.advisorSetup.steps[0].action.type, 'advisorSetup');
  assert.equal(player(f.afterSetup, f.owner).forces['arrakeen:10'], 1); assert.equal(player(f.afterSetup, f.entrant).forces['arrakeen:10'], 10);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(player(f.placement.before, f.ecaz).spice - player(f.placement.after, f.ecaz).spice, 1);
  assert.ok(f.placement.steps.some(step => step.action.token === f.token));
  assert.deepEqual(f.entrantShipment.steps[0], { actor: f.entrant, action: f.paidAction });
  assert.equal(player(f.entrantShipment.before, f.entrant).spice - player(f.entrantShipment.after, f.entrant).spice, 1);
  assert.equal(player(f.game, f.entrant).forces['carthag:11'], 1); assert.equal(player(f.game, f.entrant).shipped, true);
  assert.deepEqual(f.ordinaryDecline.steps, [{ actor: f.owner, action: { type: 'decision', accept: false } }]);
  assert.equal(f.trigger.before.pendingAmbassador?.stage, 'offer'); assert.equal(f.trigger.after.pendingAmbassador?.stage, 'ship');
  assert.deepEqual(f.trigger.steps[0], { actor: f.ecaz, action: f.triggerAction });
  assert.equal(f.originalAmbassador.event, f.event); assert.equal(f.originalAmbassador.effect, 'guild');
  assert.equal(f.originalAmbassador.beneficiary, f.ecaz); assert.equal(f.originalAmbassador.entrant, f.entrant);
  assert.equal(f.game.ecazAmbassadors!.tokens.find(t => t.id === f.token)?.zone, 'used');
  assert.deepEqual(f.grant.steps[0], { actor: f.ecaz, action: f.grantAction });
  assert.equal(player(f.grant.before, f.ecaz).spice, player(f.grant.after, f.ecaz).spice);
  assert.equal(player(f.grant.before, f.ecaz).reserves - player(f.grant.after, f.ecaz).reserves, 1);
  assert.equal(player(f.grant.before, f.ecaz).shipped, player(f.grant.after, f.ecaz).shipped);
  assert.equal(player(f.grant.before, f.ecaz).moved, player(f.grant.after, f.ecaz).moved);
  assert.equal(player(f.game, f.ecaz).forces[f.guildLocation], 1);
  assert.equal(f.declaration.before.decision?.kind, 'advisor');
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.chooseAction }]);
  assert.equal(f.shippingResponse.kind, 'advisor'); assert.equal(f.shippingFrame.stage, 'shipping');
  assert.equal(player(f.declaration.after, f.owner).forces[f.location] ?? 0, 0);
  assert.equal(player(f.declaration.after, f.owner).reserves, player(f.declaration.before, f.owner).reserves);
  assert.ok(f.placed.steps.some(step => step.action.type === 'passResponse'));
  assert.ok(f.placed.steps.every(step => step.action.type === 'passResponse'));
  assert.equal(f.originalFrame.stage, 'arrival'); assert.equal(f.originalFrame.decision.ambassadorEvent, f.event);
  assert.equal(f.originalFrame.decision.shipment, f.ecaz); assert.equal(f.originalFrame.decision.destination, f.guildLocation);
  assert.deepEqual(f.originalFrame.source, f.originalSpiritualSource);
  assert.deepEqual(f.originalDeposit, { key: f.location, before: 0 });
  assert.equal(f.originalAmbassador.stage, 'arrival'); assert.equal(f.originalReceipt.next, 'advisor');
  assert.equal(f.originalReceipt.advisorArrival, undefined);
  assert.equal(f.originalReceipt.order.player, f.ecaz); assert.equal(f.originalReceipt.order.amount, 1);
  assert.equal(f.originalReceipt.order.territory, f.guildTerritory); assert.equal(f.originalReceipt.order.sector, f.guildSector);
  assert.equal(f.originalAutomaticSource.producer, 'spiritualArrival');
  assert.deepEqual(f.originalAutomaticSource.spiritual, f.originalSpiritualSource);
  assert.deepEqual(f.originalAutomaticSource.forces, { [f.location]: 1 });
  assert.deepEqual(f.originalQueue, [f.originalAutomaticSource]);
  assert.equal(player(f.game, f.owner).reserves, player(f.declaration.before, f.owner).reserves - 1);
  assert.equal(player(f.game, f.owner).advisors?.[f.territory]?.lockedTurn, 1);
  assert.equal(player(f.game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  assert.equal(spiritualLogs(f.game, f.owner).length, 1); assert.equal(guildLogs(f.game).length, 1);
  assert.equal(f.game.active, f.entrant); assert.equal(f.game.phase, 5); assert.equal(f.game.turn, 1);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null); assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaSpiritualAmbassadorArrivalFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the real Guild Spiritual-arrival conversion cost');
  assert.equal(pending.batch.cause, 'karama:advisorFlip'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingSpiritualAdvisor, f.originalFrame); assert.deepEqual(game.pendingAmbassador, f.originalParent);
  assert.deepEqual(game.pendingAmbassador?.shipmentReceipt, f.originalReceipt);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue); assert.deepEqual(game.pendingArrivalReaction ?? null, f.originalPaidQueue);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
  assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalLocks);
  assert.deepEqual(game.ecazAmbassadors, f.originalTokens); assert.deepEqual(game.deck, f.originalDeck);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(c => c.id === f.cost), false);
  assert.equal(game.discard.filter(c => c.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function settled(state: Game, f: SemutaSpiritualAmbassadorArrivalFixture, prevented: boolean) {
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingSpiritualAdvisor, undefined);
  assert.equal(game.pendingAmbassador ?? null, null); assert.equal(game.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(game.pendingArrivalReaction?.length ?? 0, 0); assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical, 'Original paid entry, Guild reserve and Spiritual deposit are never replayed');
  assert.equal(game.active, f.entrant); assert.equal(player(game, f.owner).forces[f.location], 1);
  assert.equal(player(game, f.ecaz).forces[f.guildLocation], 1); assert.equal(player(game, f.entrant).forces['carthag:11'], 1);
  assert.equal(isAdvisor(player(game, f.owner), 'arrakeen'), true);
  assert.equal(isAdvisor(player(game, f.owner), f.territory), prevented);
  assert.equal(fighterCount(player(game, f.owner), f.territory), prevented ? 0 : 1);
  if (prevented) {
    assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
    assert.deepEqual(player(game, f.owner).advisors?.[f.territory], f.originalLocks);
  } else assert.equal(player(game, f.owner).advisors?.[f.territory], undefined);
  assert.deepEqual(quoteAutomaticAdvisorFlips(game), []);
  assert.deepEqual(game.ecazAmbassadors, f.originalTokens); assert.deepEqual(game.deck, f.originalDeck);
  assert.equal(spiritualLogs(game, f.owner).length, 1); assert.equal(guildLogs(game).length, 1);
  assert.ok(steps.every(step => !['ship', 'move', 'card', 'endMovement'].includes(step.action.type)));
  reject(game, f.ecaz, f.triggerAction); reject(game, f.ecaz, f.grantAction); reject(game, f.owner, f.chooseAction);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function canceled(state: Game, f: SemutaSpiritualAmbassadorArrivalFixture, claimed: boolean) {
  const game = settled(state, f, true);
  assert.equal(player(game, f.holder).hand.filter(c => c.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(c => c.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(c => c.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(c => c.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); return game;
}
function continueMovement(state: Game, f: SemutaSpiritualAmbassadorArrivalFixture, prevented: boolean) {
  const steps: { actor: string; action: Action }[] = [];
  let game = act(state, f.entrant, { type: 'endMovement' }, steps);
  game = advance(game, g => g.phase >= 6 && g.phase <= 7 && clean(g), steps);
  assert.equal(steps.filter(step => step.actor === f.entrant && step.action.type === 'endMovement').length, 1);
  assert.ok(steps.every(step => !['ship', 'move', 'card'].includes(step.action.type)));
  assert.equal(game.pendingAmbassador ?? null, null); assert.equal(game.pendingSpiritualAdvisor, undefined);
  assert.equal(game.pendingAutomaticAdvisorFlips, undefined); assert.equal(spiritualLogs(game, f.owner).length, 1); assert.equal(guildLogs(game).length, 1);
  assert.equal(player(game, f.owner).forces[f.location], 1); assert.equal(player(game, f.ecaz).forces[f.guildLocation], 1);
  assert.equal(player(game, f.entrant).forces['carthag:11'], 1); assert.equal(isAdvisor(player(game, f.owner), f.territory), prevented);
  if (prevented) assert.equal(player(game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  assert.deepEqual(inventory(game), f.originalInventory);
}

for (const claimed of [false, true]) void test(
  `Advanced native Guild Ambassador Spiritual arrival cost Semuta ${claimed ? 'claim' : 'pass'} preserves committed child and outer parent then resumes once`, () => {
    const f = fixture(); nativeSource(f); const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = canceled(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event }); continueMovement(game, f, true);
  },
);

void test('native Guild Ambassador Spiritual allowance converts the placed Polar advisor before the original child and outer suffix finish', () => {
  const f = fixture(); nativeSource(f); const game = settled(allow(structuredClone(f.game)), f, false);
  assert.ok(player(game, f.spender).hand.some(c => c.id === f.cost)); assert.ok(player(game, f.holder).hand.some(c => c.id === f.semuta));
  continueMovement(game, f, false);
});

void test('fresh Guild Spiritual arrival cost rejects stale and underlying declarations while both original parents and deposit stay held', () => {
  const f = fixture(), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
  reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` }); reject(game, f.spender, { type: 'semutaCommit', event });
  reject(game, f.spender, f.action); reject(game, f.owner, { type: 'passResponse' }); reject(game, f.owner, f.chooseAction);
  reject(game, f.ecaz, f.grantAction); reject(game, f.ecaz, f.triggerAction); reject(game, f.entrant, f.paidAction);
  reject(game, f.entrant, { type: 'endMovement' });
  assert.deepEqual(game.pendingSpiritualAdvisor, f.originalFrame); assert.deepEqual(game.pendingAmbassador, f.originalAmbassador);
  assert.deepEqual(physical(game), f.originalPhysical); canceled(pass(game), f, false);
});

void test('controlled Guild Spiritual source deposit and Ambassador suffix mismatches reject before cost and fresh appropriation', () => {
  const f = fixture();
  // Deliberately invalid negative copies only; the genuine primary history
  // never installs a frame, source, token, force or parent continuation.
  const changes: ((game: Game) => void)[] = [
    game => { game.pendingSpiritualAdvisor!.signature += ':changed'; },
    game => { game.pendingSpiritualAdvisor!.source = { ...game.pendingSpiritualAdvisor!.source!, event: 'different-original-packet' }; },
    game => { game.pendingSpiritualAdvisor!.deposit = { ...game.pendingSpiritualAdvisor!.deposit!, before: 1 }; },
    game => { game.pendingAmbassador!.shipmentReceipt!.next = 'finish'; },
  ];
  for (const change of changes) {
    const beforeCost = structuredClone(f.game); change(beforeCost); reject(beforeCost, f.spender, f.action);
    assert.ok(player(beforeCost, f.spender).hand.some(c => c.id === f.cost));
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event; change(offered);
    reject(offered, f.holder, { type: 'semutaCommit', event }); assert.ok(player(offered, f.holder).hand.some(c => c.id === f.semuta));
    assert.equal(offered.discard.filter(c => c.id === f.cost).length, 1); assert.deepEqual(inventory(offered), f.originalInventory);
  }
});

void test('all four minimal profiles legally answer the actual Guild Ambassador Spiritual-arrival conversion cost', () => {
  const f = fixture(), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
  for (const difficulty of DIFFICULTIES) {
    const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
    const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
    assert.deepEqual(own, before); assert.ok(action.type === 'semutaPass' || action.type === 'semutaCommit'); assert.equal(action.event, event);
    let game = act(structuredClone(offered), f.holder, action); const claimed = action.type === 'semutaCommit';
    if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
      const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
      const selected = botActions(selecting)[0]; assert.ok(selected); assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
      game = act(game, f.holder, selected);
    } else if (game.pendingTreacheryDiscard) game = pass(game);
    canceled(game, f, claimed);
  }
});
