import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  actAdvancedRevivalOrder, advanceAdvancedRevivalOrder, advancedRevivalOrderClean,
  advancedRevivalOrderInventory, advancedRevivalOrderPlayer, advancedRevivalOrderStocks,
  createAdvancedRevivalOrderFixture, finishAdvancedRevivalOrder, passAdvancedRevivalOrder,
  reachAdvancedRevivalOrderActor,
} from './fixture-advanced-revival-order';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A refused order action changes no original outcome');
}
function current(game: Game) {
  const actor = game.revivalOrder?.remaining[0]; assert.ok(actor); return actor;
}

void test('public Advanced start earns the first Revival queue without replacing original physical state', () => {
  const f = createAdvancedRevivalOrderFixture();
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.afterSetup.status, 'playing'); assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 4);
  assert.equal(f.sourceActions.length, f.sourceActionCount); assert.ok(f.sourceActionCount > 15);
  assert.deepEqual(f.staging, []);
  assert.ok(f.game.revivalOrder);
  assert.deepEqual(f.game.revivalOrder, { version: 1, turn: 1,
    original: f.originalOrder, remaining: f.originalOrder, completed: [], started: false });
  assert.equal(f.game.active, current(f.game));
  assert.deepEqual(advancedRevivalOrderInventory(f.game), f.originalInventory);
  for (const player of f.game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20);
    assert.deepEqual(viewGame(f.game, player.id).revivalOrder, f.game.revivalOrder);
  }
  const view = viewGame(f.game, f.actor); assert.ok(view.revivalOrder);
  view.revivalOrder.remaining.reverse();
  assert.deepEqual(f.game.revivalOrder.remaining, f.originalOrder, 'Projected order is a separate public snapshot');
});

void test('native Advanced Revival rejects another participant return and finish before touching the source', () => {
  const f = createAdvancedRevivalOrderFixture();
  rejected(f.game, f.outOfTurn, { type: 'ready' });
  rejected(f.game, f.outOfTurn, { type: 'revive', amount: 1, elite: 0 });
  assert.equal(f.game.active, f.actor);
  assert.deepEqual(f.game.revivalOrder?.completed, []);
});

void test('native Advanced participants finish once in original order before Shipment opens', () => {
  const f = createAdvancedRevivalOrderFixture();
  let game = reload(f.game);
  for (let index = 0; index < f.originalOrder.length; index++) {
    const actor = f.originalOrder[index];
    assert.equal(current(game), actor); assert.equal(game.active, actor);
    const before = advancedRevivalOrderStocks(game);
    game = actAdvancedRevivalOrder(game, actor, { type: 'ready' });
    assert.deepEqual(advancedRevivalOrderStocks(game), before);
    if (index + 1 < f.originalOrder.length) {
      assert.equal(game.phase, 4);
      assert.deepEqual(game.revivalOrder?.original, f.originalOrder);
      assert.deepEqual(game.revivalOrder?.completed, f.originalOrder.slice(0, index + 1));
      assert.deepEqual(game.revivalOrder?.remaining, f.originalOrder.slice(index + 1));
      rejected(game, actor, { type: 'ready' });
      rejected(game, actor, { type: 'revive', amount: 1 });
    }
  }
  game = advanceAdvancedRevivalOrder(game, state => state.phase === 5 && advancedRevivalOrderClean(state));
  assert.equal(game.phase, 5);
  assert.deepEqual(advancedRevivalOrderInventory(game), f.originalInventory);
});

void test('native paid shipment and next Storm earn an ordered force return and separate Tleilaxu income', () => {
  const f = createAdvancedRevivalOrderFixture({ casualty: true });
  assert.ok(f.shipment && f.storm); assert.equal(f.game.turn, 2);
  assert.ok(f.shipment.steps.some(step => step.actor === f.owner && step.action.type === 'ship'));
  assert.equal(f.storm.before.stormMovementSource?.kind, 'card');
  assert.equal(f.storm.before.stormMovementSource?.turn, 2);
  assert.equal(f.storm.before.stormMovementSource?.distance, f.storm.before.stormPending);
  assert.ok(f.storm.steps.some(step => step.action.type === 'ready'));
  assert.ok(f.storm.steps.every(step => step.action.type !== 'stormDial'));
  assert.equal(advancedRevivalOrderPlayer(f.shipment.after, f.owner).forces[f.casualtyLocation], 1);
  assert.equal(advancedRevivalOrderPlayer(f.storm.after, f.owner).tanks, 1);
  let game = reachAdvancedRevivalOrderActor(f.game, f.owner);
  const before = structuredClone(game), original = [...game.revivalOrder!.original];
  const ownerBefore = advancedRevivalOrderPlayer(before, f.owner);
  const responderBefore = advancedRevivalOrderPlayer(before, f.responder);
  game = actAdvancedRevivalOrder(game, f.owner, f.revivalAction);
  game = advanceAdvancedRevivalOrder(game, state => advancedRevivalOrderClean(state) || state.response?.kind === 'revivalIncome');
  assert.equal(current(game), f.owner); assert.equal(game.active, f.owner);
  assert.equal(game.revivalOrder?.started, true);
  assert.notEqual(f.responder, current(game));
  // With no possible cancellation the original income settles automatically;
  // the test must not invent a mandatory acknowledgement or wait for it.
  if (game.response) {
    assert.equal(game.response.kind, 'revivalIncome');
    assert.equal(game.response.owner, f.responder); assert.equal(game.response.amount, 1);
    rejected(game, f.owner, { type: 'ready' });
    game = actAdvancedRevivalOrder(game, f.responder, { type: 'passResponse' });
    game = passAdvancedRevivalOrder(game);
  }
  game = advanceAdvancedRevivalOrder(game, advancedRevivalOrderClean);
  const ownerAfter = advancedRevivalOrderPlayer(game, f.owner);
  assert.equal(ownerAfter.tanks, 0); assert.equal(ownerAfter.reserves, ownerBefore.reserves + 1);
  assert.equal(ownerAfter.revived, 1); assert.equal(ownerAfter.freeForcesRevived, 1);
  assert.equal(ownerAfter.spice, ownerBefore.spice);
  assert.deepEqual(ownerAfter.elites, ownerBefore.elites, 'An ordinary return does not invent Sardaukar');
  assert.equal(advancedRevivalOrderPlayer(game, f.responder).spice, responderBefore.spice + 1);
  assert.deepEqual(game.revivalOrder?.original, original); assert.equal(current(game), f.owner);
  assert.deepEqual(advancedRevivalOrderInventory(game), f.originalInventory);
  game = actAdvancedRevivalOrder(game, f.owner, { type: 'ready' });
  if (game.phase === 4) assert.ok(!game.revivalOrder?.remaining.includes(f.owner));
  game = finishAdvancedRevivalOrder(game);
  assert.equal(game.phase, 5);
});

void test('native Tleilaxu grant remains legal outside its own ordered opportunity', () => {
  const f = createAdvancedRevivalOrderFixture();
  let game = reachAdvancedRevivalOrderActor(f.game, f.owner);
  const before = structuredClone(game);
  game = actAdvancedRevivalOrder(game, f.responder, { type: 'tleilaxuRevivalLimit', target: f.owner });
  assert.ok(game.revivalRules?.expanded.includes(f.owner));
  assert.deepEqual(game.revivalOrder, before.revivalOrder);
  assert.equal(game.active, f.owner);
  assert.deepEqual(advancedRevivalOrderStocks(game), advancedRevivalOrderStocks(before));
});

void test('public Basic Revival keeps concurrent readiness and has no Advanced order stamp', () => {
  const f = createAdvancedRevivalOrderFixture({ advanced: false });
  assert.equal(f.game.revivalOrder, undefined);
  assert.equal(viewGame(f.game, f.actor).revivalOrder, null);
  let game = actAdvancedRevivalOrder(f.game, f.outOfTurn, { type: 'ready' });
  assert.ok(game.ready.includes(f.outOfTurn)); assert.equal(game.phase, 4);
  game = finishAdvancedRevivalOrder(game);
  assert.equal(game.phase, 5); assert.equal(game.revivalOrder, undefined);
});

void test('controlled legacy-envelope supplement keeps an already opened unstamped Advanced Revival concurrent', () => {
  const f = createAdvancedRevivalOrderFixture();
  // Controlled format supplement only: physical cards/forces/wallets and phase
  // remain native. Remove the new envelope to model a pre-cutover open phase.
  const legacy = reload(f.game); delete legacy.revivalOrder; legacy.active = null;
  assert.equal(viewGame(legacy, f.outOfTurn).revivalOrder, null);
  let game = actAdvancedRevivalOrder(legacy, f.outOfTurn, { type: 'ready' });
  assert.equal(game.revivalOrder, undefined); assert.ok(game.ready.includes(f.outOfTurn));
  game = finishAdvancedRevivalOrder(game);
  assert.equal(game.phase, 5);
  game = advanceAdvancedRevivalOrder(game, state => state.turn === 2 && state.phase === 4 && advancedRevivalOrderClean(state));
  assert.equal(game.revivalOrder?.version, 1); assert.equal(game.revivalOrder?.turn, 2);
  assert.deepEqual(game.revivalOrder?.original, game.order);
});

void test('four minimal policies offer the current native Finish and no foreign ordinary return or Finish', () => {
  const f = createAdvancedRevivalOrderFixture();
  const ownActions = new Set(['ready', 'revive', 'reviveLeader', 'reviveKwisatz',
    'reviveForeignGhola', 'requestLeaderRevival', 'acceptLeaderRevival']);
  for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    for (const player of f.game.players) {
      const view = viewGame(f.game, player.id); view.players.find(seat => seat.id === player.id)!.bot = level;
      const candidates = botActions(view);
      if (player.id !== f.actor)
        assert.ok(candidates.every(action => !ownActions.has(action.type)), `${level} waits for ${player.id}'s own opportunity`);
      else {
        const finish = candidates.find(action => action.type === 'ready'); assert.ok(finish);
        assert.doesNotThrow(() => applyAction(f.game, player.id, finish));
      }
    }
  }
});

void test('controlled dead-disc supplement keeps requester actions current and the Tleilaxu quote out of turn', () => {
  const f = createAdvancedRevivalOrderFixture();
  let game = reachAdvancedRevivalOrderActor(f.game, f.owner);
  // Only this supplement stages prior disc deaths. No native death chronology
  // is claimed; queue, physical card custody, wallets and clocks stay original.
  const leader = advancedRevivalOrderPlayer(game, f.owner).leaders[0]; leader.dead = true; leader.deaths = 1;
  const foreign = advancedRevivalOrderPlayer(game, 'atreides').leaders[0]; foreign.dead = true; foreign.deaths = 1;
  rejected(game, 'atreides', { type: 'requestLeaderRevival', leader: foreign.id });
  rejected(game, 'atreides', { type: 'reviveLeader', leader: foreign.id });
  game = actAdvancedRevivalOrder(game, f.owner, { type: 'requestLeaderRevival', leader: leader.id });
  assert.equal(current(game), f.owner); assert.notEqual(f.responder, f.owner);
  game = actAdvancedRevivalOrder(game, f.responder, { type: 'quoteLeaderRevival', target: f.owner, amount: 0 });
  assert.equal(game.revivalRequests?.[f.owner]?.price, 0);
  game = actAdvancedRevivalOrder(game, f.owner, { type: 'acceptLeaderRevival' });
  game = advanceAdvancedRevivalOrder(game, advancedRevivalOrderClean);
  assert.equal(advancedRevivalOrderPlayer(game, f.owner).leaders.find(disc => disc.id === leader.id)?.dead, false);
  assert.equal(current(game), f.owner);
});

void test('controlled prevention supplement retains responder quotes and lets a prevented current requester finish', () => {
  const f = createAdvancedRevivalOrderFixture();
  let game = reachAdvancedRevivalOrderActor(f.game,f.owner);
  // Controlled prior death/prevention stamps supplement the played order;
  // neither a native death nor a physical Karama-use chronology is claimed.
  const leader = advancedRevivalOrderPlayer(game,f.owner).leaders[0];
  leader.dead = true; leader.deaths = 1;
  game = actAdvancedRevivalOrder(game,f.owner,{type:'requestLeaderRevival',leader:leader.id});
  game.revivalPrevention = {player:f.responder,turn:game.turn};
  for (const level of ['Easy','Medium','Hard','Brutal'] as const) {
    const view = viewGame(game,f.responder); view.players.find(p=>p.id===f.responder)!.bot=level;
    assert.equal(view.revival.prevented,true);
    const quote = botActions(view).find(action=>action.type==='quoteLeaderRevival'); assert.ok(quote);
    assert.equal(applyAction(game,f.responder,quote).active,f.owner);
  }
  game.revivalPrevention = {player:f.owner,turn:game.turn};
  for (const level of ['Easy','Medium','Hard','Brutal'] as const) {
    const view = viewGame(game,f.owner); view.players.find(p=>p.id===f.owner)!.bot=level;
    const finish = botActions(view).find(action=>action.type==='ready'); assert.ok(finish);
    const next=applyAction(game,f.owner,finish);
    assert.equal(next.revivalRequests?.[f.owner],undefined);
    assert.ok(next.phase!==4 || !next.revivalOrder?.remaining.includes(f.owner));
  }
});
