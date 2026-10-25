import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, initializeSemutaGameForAudit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { isAdvisor } from '../game/advisors';
import { homeworldGameIntegrity, homeworldTable } from '../game/homeworld-game';
import { spiritualAdvisorMatchingKey } from '../game/spiritual-advisor';
import { quoteAutomaticAdvisorFlips } from '../game/advisor-automatic-flip';
import {
  createSemutaSpiritualRevivalFixture as fixture, actSemutaSpiritualRevival as act,
  passSemutaSpiritualRevival as pass, claimSemutaSpiritualRevival as claim, allowSemutaSpiritualRevival as allow,
  finishSemutaSpiritualRevival as finish, semutaSpiritualRevivalPlayer as player,
  semutaSpiritualRevivalInventory as inventory, semutaSpiritualRevivalPhysical as physical,
  type SemutaSpiritualRevivalFixture,
} from './fixture-semuta-spiritual-revival';

const stages = ['shipping', 'matching', 'arrival'] as const;
const balances = (game: Game) => Object.fromEntries(game.players.map(p => [p.id, p.spice]));
const clock = (game: Game) => ({ turn: game.turn, phase: game.phase, active: game.active, ready: game.ready,
  order: game.order, movementRemaining: game.movementRemaining, storm: game.storm,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard });
const placements = (game: Game, bg: string) => game.log.filter(entry => entry.text.startsWith(`${player(game, bg).name} sent 1 free`));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaSpiritualRevivalFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.deepEqual(f.setup.expansions, ['choam', 'ix']); assert.equal(f.setup.homeworlds?.custody, null);
  assert.ok(f.afterSetup.homeworlds?.custody); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.enableHomeworlds.steps, [{ actor: f.game.host, action: { type: 'homeworlds', enabled: true } }]);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama' && !card.id.startsWith('ix-')));
  assert.equal(player(f.afterSetup, f.reviver).faceDancers?.length, 3);
  assert.equal(player(f.afterSetup, f.reviver).reserves, 20); assert.equal(player(f.afterSetup, f.reviver).tanks, 0);
  assert.deepEqual(f.advisorSetup.steps[0].action, { type: 'advisorSetup',
    territory: f.stage === 'matching' ? 'polar_sink' : 'arrakeen', sector: f.stage === 'matching' ? 0 : 10 });
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquired, f.holder).spice, 1);
  assert.equal(player(f.acquired, f.seller).spice - player(f.acquisition.before, f.seller).spice, 1);
  assert.deepEqual(f.firstStorm.steps.filter(step => step.action.type === 'stormDial').map(step => step.action.amount), [11, 0]);
  assert.equal(f.firstStorm.after.storm, 12); assert.deepEqual(f.shipment.steps[0], { actor: f.reviver, action: f.shipmentAction });
  assert.equal(player(f.shipment.before, f.reviver).spice - player(f.shipment.after, f.reviver).spice, 2);
  assert.equal(player(f.shipment.after, f.reviver).forces[f.casualtyLocation], 1);
  assert.deepEqual(f.firstSpiritualDecline.steps, [{ actor: f.owner, action: { type: 'decision', accept: false } }]);
  assert.equal(f.beforeStormMovement.storm, 12); assert.equal(f.beforeStormMovement.stormPending, 1);
  assert.equal(f.stormLoss.after.storm, 13); assert.equal(player(f.stormLoss.after, f.reviver).tanks, 1);
  assert.equal(player(f.beforeRequest, f.reviver).reserves, 19); assert.equal(player(f.beforeRequest, f.reviver).tanks, 1);
  assert.equal(player(f.beforeRequest, f.reviver).revived, 0);
  assert.equal(homeworldTable(f.beforeRequest)!.find(world => world.native === f.reviver)!.side, 'high');
  assert.deepEqual(f.freeRevive.steps[0], { actor: f.reviver, action: f.revivalAction });
  assert.equal(f.returned.homeworldRevivalReturn?.stage, 'choice'); assert.equal(f.returned.decision?.kind, 'homeworldRevivalDeployment');
  assert.equal(player(f.returned, f.reviver).tanks, 0); assert.equal(player(f.returned, f.reviver).reserves, 20);
  assert.equal(player(f.returned, f.reviver).revived, 1); assert.equal(player(f.returned, f.reviver).freeForcesRevived, 1);
  assert.equal(player(f.returned, f.reviver).spice, player(f.beforeRequest, f.reviver).spice);
  assert.deepEqual(f.send.steps[0], { actor: f.reviver, action: f.sendAction });
  assert.equal(player(f.game, f.reviver).forces[f.destination], 1); assert.equal(player(f.game, f.reviver).reserves, 19);
  assert.equal(f.originalReturn.stage, 'arrival'); assert.equal(f.originalReturn.source, 'normal');
  assert.equal(f.originalReturn.quote.kind, 'tleilax'); assert.deepEqual(f.originalReturn.group, { amount: 1, elite: 0, free: 1 });
  assert.equal(f.originalReturn.destination, f.destination); assert.equal(f.originalReturn.quote.beforePopulation, 19);
  assert.equal(f.originalReturn.quote.afterPopulation, 20); assert.equal(f.originalRetainedIncome?.kind, 'revivalIncome');
  assert.equal(f.originalRetainedIncome?.amount, 1); assert.equal(f.originalRetainedIncome?.owner, f.reviver);
  assert.equal(f.originalPendingRevival, null); assert.equal(f.game.pendingRevival ?? null, null);
  assert.equal(f.originalProgress.event, f.originalReturn.event); assert.equal(f.originalProgress.stage, 'arrival');
  assert.deepEqual(f.game.homeworldRevivalReturn, f.originalReturn); assert.deepEqual(f.game.homeworldRevivalProgress, f.originalProgress);
  assert.equal(f.originalChooser.revivalEvent, f.originalReturn.event); assert.equal(f.originalChooser.shipment, f.reviver);
  assert.equal(f.originalChooser.destination, f.destination); assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.nativeAction }]);
  assert.equal(f.originalSource.phase, 4); assert.equal(f.originalSource.revivalEvent, f.originalReturn.event);
  assert.equal(f.originalSource.owner, f.owner); assert.equal(f.originalSource.amount, 1);
  assert.equal(f.originalFrame.stage, f.stage); assert.deepEqual(f.originalFrame.source, f.originalSource);
  assert.equal(f.game.phase, 4); assert.equal(f.game.turn, 2); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.game.response?.kind, f.stage === 'shipping' ? 'advisor' : 'advisorFlip');
  assert.deepEqual(f.game.pendingArrivalReaction, f.originalArrival);
  assert.ok(f.originalArrival.some(arrival => arrival.entrant === f.reviver && arrival.cause === 'homeworldRevival' &&
    arrival.revivalArrival?.event === f.originalReturn.event));
  if (f.stage === 'arrival') {
    assert.ok(f.originalAutomaticSource?.producer === 'spiritualArrival');
    assert.deepEqual(f.originalAutomaticSource.spiritual, f.originalSource); assert.deepEqual(f.originalQueue, [f.originalAutomaticSource]);
    assert.deepEqual(f.originalDeposit, { key: f.location, before: 0 });
    assert.equal(player(f.game, f.owner).reserves, player(f.beforeDeclaration, f.owner).reserves - 1);
    assert.equal(player(f.game, f.owner).forces[f.location], 1); assert.equal(isAdvisor(player(f.game, f.owner), f.territory), true);
    assert.equal(player(f.game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
    assert.equal(placements(f.game, f.owner).length, 1);
  } else {
    assert.equal(f.originalDeposit, null); assert.deepEqual(f.originalQueue, []);
    assert.deepEqual(physical(f.game), physical(f.beforeDeclaration)); assert.equal(placements(f.game, f.owner).length, 0);
  }
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.originalInventory.length, 57); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length); homeworldGameIntegrity(f.game);
}
function open(f: SemutaSpiritualRevivalFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, f.stage === 'shipping' ? 'karamaTerminalDiscard' : 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaTerminalDiscard' && pending.continuation.kind !== 'karamaAdvisorFlipDiscard')
    throw Error('Expected the original Revival Spiritual cancellation cost');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.homeworldRevivalReturn, f.originalReturn); assert.deepEqual(game.homeworldRevivalProgress, f.originalProgress);
  assert.deepEqual(game.pendingSpiritualAdvisor, f.originalFrame); assert.deepEqual(game.pendingArrivalReaction, f.originalArrival);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips ?? [], f.originalQueue); assert.equal(game.pendingRevival ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(balances(game), f.originalBalances);
  assert.deepEqual(player(game, f.owner).advisors, f.originalStance); assert.deepEqual(clock(game), clock(f.game));
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true); assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function settled(state: Game, f: SemutaSpiritualRevivalFixture, granted: boolean, held = false, target = f.territory) {
  const game = finish(state); assert.equal(game.homeworldRevivalReturn?.stage, 'complete');
  assert.equal(game.homeworldRevivalProgress?.stage, 'complete'); assert.equal(game.homeworldRevivalReturn?.event, f.originalReturn.event);
  assert.equal(game.pendingSpiritualAdvisor ?? null, null); assert.equal(game.pendingRevival ?? null, null);
  assert.equal(game.pendingArrivalReaction?.length ?? 0, 0); assert.deepEqual(game.pendingAutomaticAdvisorFlips ?? [], []);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(clock(game), clock(f.game)); assert.equal(game.phase, 4); assert.equal(game.turn, 2);
  for (const p of game.players) assert.equal(p.spice, f.originalBalances[p.id] + Number(p.id === f.reviver));
  const reviver = player(game, f.reviver), before = player(f.game, f.reviver), bg = player(game, f.owner);
  assert.equal(reviver.forces[f.destination], 1); assert.equal(reviver.reserves, 19); assert.equal(reviver.tanks, 0);
  assert.equal(reviver.revived, 1); assert.equal(reviver.freeForcesRevived, 1);
  assert.equal(reviver.shipped, before.shipped); assert.equal(reviver.moved, before.moved);
  assert.equal(bg.spice, player(f.game, f.owner).spice); assert.equal(bg.shipped, player(f.game, f.owner).shipped);
  assert.equal(bg.moved, player(f.game, f.owner).moved); assert.equal(bg.revived, player(f.game, f.owner).revived);
  const newlyWithdrawn = Number(granted && f.stage !== 'arrival');
  assert.equal(bg.reserves, player(f.game, f.owner).reserves - newlyWithdrawn);
  assert.equal(placements(game, f.owner).length, Number(granted));
  if (granted) {
    const key = target === 'polar_sink' ? 'polar_sink:0' : f.destination;
    assert.equal(bg.forces[key], (player(f.beforeDeclaration, f.owner).forces[key] ?? 0) + 1);
    assert.equal(isAdvisor(bg, target), f.stage === 'arrival' ? held : target !== 'polar_sink');
  }
  if (!newlyWithdrawn) assert.deepEqual(physical(game), f.originalPhysical);
  if (held) assert.deepEqual(bg.advisors, f.originalStance);
  assert.deepEqual(quoteAutomaticAdvisorFlips(game), []); homeworldGameIntegrity(game);
  assert.deepEqual(inventory(game), f.originalInventory);
  reject(game, f.reviver, f.revivalAction); reject(game, f.reviver, f.sendAction); reject(game, f.owner, f.nativeAction);
  return game;
}
function denied(state: Game, f: SemutaSpiritualRevivalFixture, claimed: boolean) {
  let game = finish(state);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.response ?? null, null);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  if (f.stage === 'matching') {
    assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(balances(game), f.originalBalances);
    assert.deepEqual(game.homeworldRevivalReturn, f.originalReturn); assert.deepEqual(game.homeworldRevivalProgress, f.originalProgress);
    assert.deepEqual(game.decision, f.originalChooser); assert.equal(game.pendingSpiritualAdvisor?.stage, 'offer');
    assert.deepEqual(game.pendingSpiritualAdvisor?.denied, [spiritualAdvisorMatchingKey(f.originalSource)]);
    reject(game, f.owner, f.sink); assert.deepEqual(game.pendingArrivalReaction, f.originalArrival);
    game = act(game, f.owner, f.decline);
  }
  const done = settled(game, f, f.stage === 'arrival', f.stage === 'arrival'); reject(done, f.spender, f.action); return done;
}

for (const stage of stages) for (const claimed of [false, true]) void test(
  `native Revival SEND Spiritual ${stage} Karama cost Semuta ${claimed ? 'claim' : 'pass'} preserves the real return and finishes retained income once`, () => {
    const f = fixture({ stage }); nativeSource(f); const offered = open(f);
    denied(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
  },
);

for (const stage of stages) void test(`native Revival SEND Spiritual ${stage} allowance completes only the actual free grant and retained original income`, () => {
  const f = fixture({ stage }); nativeSource(f); const game = settled(allow(structuredClone(f.game)), f, true);
  assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
});

void test('native Revival SEND matching cost denial retains real accompaniment as an independent legal replacement', () => {
  for (const claimed of [false, true]) {
    const f = fixture({ stage: 'matching' }), offered = open(f);
    let game = finish(claimed ? claim(offered, f.holder) : pass(offered));
    assert.deepEqual(game.decision, f.originalChooser); assert.ok(f.replacementAction);
    game = act(game, f.owner, f.replacementAction);
    if (game.response?.spiritualAdvisorSource) game = allow(game);
    settled(game, f, true, false, 'arrakeen');
  }
});

void test('native Revival SEND Spiritual cost rejects stale foreign and underlying return or chooser actions', () => {
  for (const stage of stages) {
    const f = fixture({ stage }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.reviver, f.revivalAction); reject(game, f.reviver, f.sendAction);
    reject(game, f.owner, f.nativeAction); reject(game, f.owner, f.decline); reject(game, f.owner, { type: 'passResponse' });
    const done = denied(pass(game), f, false); reject(done, f.holder, { type: 'semutaCommit', event });
  }
});

void test('controlled changed original Revival SEND progress or Spiritual signature rejects before the native cost is spent', () => {
  for (const stage of stages) for (const changed of ['progress', 'spiritual'] as const) {
    const f = fixture({ stage }), game = structuredClone(f.game);
    // Explicit malformed-parent supplement; primary return, stock, casualty,
    // custody, hands and clocks are all earned through the original programme.
    if (changed === 'progress') game.homeworldRevivalProgress!.signature += ':changed';
    else game.pendingSpiritualAdvisor!.signature += ':changed';
    reject(game, f.spender, f.action); assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  }
});

void test('fresh undealt Tleilax Semuta World configuration negatives retain Basic and extra-deck admission gates without mutation', () => {
  const f = fixture();
  for (const variant of ['basic', 'extra-ecaz-deck'] as const) {
    // Configuration negatives on a captured genuinely ready undealt lobby,
    // not a played Basic-to-Advanced conversion or a claimed native programme.
    const config = structuredClone(f.lobby);
    assert.ok(config.players.every(p => p.hand.length === 0)); assert.notEqual(config.status, 'playing');
    if (variant === 'basic') config.advanced = false;
    else config.expansions.push('ecaz');
    const before = structuredClone(config);
    assert.throws(() => initializeSemutaGameForAudit(config)); assert.deepEqual(config, before);
  }
});

void test('all four minimal profiles legally claim or pass the three genuine Revival SEND Spiritual costs', () => {
  for (const stage of stages) {
    const f = fixture({ stage }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const proposed = botActions(own)[0]; assert.ok(proposed);
      assert.ok(proposed.type === 'semutaPass' || proposed.type === 'semutaCommit'); assert.equal(proposed.event, event);
      let game = act(structuredClone(offered), f.holder, proposed); const claimed = proposed.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost); game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      denied(game, f, claimed);
    }
  }
});
