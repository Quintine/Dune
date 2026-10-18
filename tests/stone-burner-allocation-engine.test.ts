import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import {
  ALLOCATION_MIRROR, ALLOCATION_STONE, actStoneBurnerAllocation, completeStoneBurnerAllocation,
  createStoneBurnerAllocationFixture, stoneBurnerAllocationPlayer as player,
  type StoneBurnerAllocationFixture,
} from './fixture-stone-burner-allocation';

function genuineSource(f: StoneBurnerAllocationFixture) {
  assert.equal(f.beforePlans.battle!.stoneAllocationVersion, 1);
  assert.ok(f.acquiredStone.players.find(seat => seat.id === f.owner)!.hand.some(card => card.id === ALLOCATION_STONE));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(f.shipments.length, 2);
  for (const shipment of f.shipments) {
    assert.equal(player(shipment.after, shipment.step.actor).reserves,
      player(shipment.before, shipment.step.actor).reserves - Number(shipment.step.action.amount));
    assert.equal(player(shipment.after, shipment.step.actor).spice,
      player(shipment.before, shipment.step.actor).spice - Number(shipment.step.action.amount),
      'Each real off-planet stronghold shipment pays its original printed cost');
  }
  assert.equal(player(f.beforePlans, f.owner).forces[f.location], 6);
  assert.equal(player(f.beforePlans, f.owner).elites!.forces[f.location], f.advanced ? f.ownElite : 2);
  assert.equal(f.beforePlans.battle!.plans[f.owner], undefined, 'The new allocation is not an early Battle Plan field');
  assert.equal(viewGame(f.revealed, f.owner).battle!.stoneAllocation, null,
    'Revealed weapon modes and actual traitor decisions precede the new count commitment');
}

void test('genuine Basic mixed Ix Stone commits either legal physical total before deciding the winner', () => {
  const f = createStoneBurnerAllocationFixture();
  genuineSource(f);
  assert.equal(f.game.decision?.kind, 'stoneAllocation');
  assert.equal(f.game.decision?.player, f.owner);
  const offer = viewGame(f.game, f.owner).battle!.stoneAllocation!;
  assert.deepEqual(offer.totals, [2, 5]);
  assert.equal(offer.selected, null);
  assert.equal(viewGame(f.game, f.opponent).battle!.stoneAllocation, null,
    'The other side receives no pending private commitment values');
  const before = player(f.game, f.owner), enemy = player(f.game, f.opponent);
  for (const total of offer.totals) {
    const { game, committed } = completeStoneBurnerAllocation(f, total), after = player(game, f.owner);
    assert.equal(committed.length, 1);
    assert.equal(committed[0].step.action.undialed, total);
    assert.equal(game.lastBattleContext!.winner, total === 5 ? f.owner : f.opponent);
    assert.equal(after.reserves, before.reserves, 'A count commitment neither spends nor returns a reserve counter');
    assert.equal(after.forces['hidden_mobile_stronghold:0'], before.forces['hidden_mobile_stronghold:0']);
    assert.equal(after.elites!.forces['hidden_mobile_stronghold:0'], before.elites!.forces['hidden_mobile_stronghold:0']);
    assert.equal(after.tanks, before.tanks + (total === 5 ? 1 : 6));
    assert.equal(after.elites!.tanks, before.elites!.tanks + (total === 5 ? 1 : 2));
    assert.equal(after.forces[f.location] ?? 0, total === 5 ? 5 : 0);
    assert.equal(after.elites!.forces[f.location] ?? 0, total === 5 ? 1 : 0);
    assert.equal(player(game, f.opponent).tanks, enemy.tanks + (total === 5 ? 4 : 1));
    assert.equal(game.discard.filter(card => card.id === ALLOCATION_STONE).length, total === 5 ? 0 : 1);
  }
});

void test('genuine Advanced mixed Sardaukar Stone retains three-or-five-counter alternatives and settles the selected physical result', () => {
  const f = createStoneBurnerAllocationFixture({ advanced: true });
  genuineSource(f);
  const offer = viewGame(f.game, f.owner).battle!.stoneAllocation!;
  assert.deepEqual(offer.totals, [1, 2, 3]);
  assert.equal(f.plans[0].action.dial, 3);
  assert.equal(f.plans[0].action.support, 1);
  const before = player(f.game, f.owner), enemy = player(f.game, f.opponent);
  for (const total of [1, 3]) {
    const { game } = completeStoneBurnerAllocation(f, total), after = player(game, f.owner);
    assert.equal(game.lastBattleContext!.winner, total === 3 ? f.owner : f.opponent);
    assert.equal(after.tanks, before.tanks + (total === 3 ? 3 : 6));
    assert.equal(after.elites!.tanks, before.elites!.tanks + 1);
    assert.equal(after.forces[f.location] ?? 0, total === 3 ? 3 : 0);
    assert.equal(after.elites!.forces[f.location] ?? 0, 0);
    assert.equal(player(game, f.opponent).tanks, enemy.tanks + (total === 3 ? 3 : 1));
    assert.equal(after.spice, before.spice - 1 + (total === 3 ? 2 : 0),
      'Original support is paid once, then the surviving city occupant earns its ordinary Collection income');
    for (const plan of f.plans)
      assert.equal(player(game, plan.actor).leaders.find(leader => leader.id === plan.action.leader)!.dead, false,
        'The genuinely selected ignore mode leaves leaders alive when no other weapon kills them');
  }
});

void test('normal and invariant-winner original mixed Ix battles keep their source-backed later typed casualty choice', () => {
  for (const comparison of ['normal', 'invariant'] as const) {
    const f = createStoneBurnerAllocationFixture({ comparison });
    genuineSource(f);
    assert.equal(f.game.decision?.kind, 'battleLosses');
    assert.equal(f.game.decision?.player, f.owner);
    assert.equal(viewGame(f.game, f.owner).battle?.stoneAllocation ?? null, null);
    assert.ok(f.actions.every(step => step.action.type !== 'decision' || step.action.undialed === undefined));
    const decision = f.game.decision!;
    assert.ok(decision.kind === 'battleLosses');
    const physical = decision.options.map(option => option.normal + option.elite);
    assert.deepEqual([...new Set(physical)].sort((a, b) => a - b), [1, 4]);
    for (const index of [0, decision.options.length - 1]) {
      const { game, committed } = completeStoneBurnerAllocation(f, undefined, index);
      assert.deepEqual(committed, []);
      assert.equal(game.lastBattleContext!.winner, f.owner);
      assert.equal(player(game, f.owner).tanks, player(f.game, f.owner).tanks + physical[index]);
      assert.equal(player(game, f.owner).forces[f.location], 6 - physical[index]);
    }
  }
});

void test('actual paid Stone and next-turn native unbid Mirror share the same count protocol without fabricating either held card', () => {
  const f = createStoneBurnerAllocationFixture({ mirror: true });
  genuineSource(f);
  assert.equal(f.acquiredMirror!.turn, 2);
  assert.ok(player(f.acquiredMirror!, f.opponent).hand.some(card => card.id === ALLOCATION_MIRROR));
  assert.ok(f.actions.some(step => step.actor === f.opponent && step.action.type === 'decision' && step.action.keep === true));
  const choices = f.actions.filter(step => step.action.type === 'decision' && step.action.mode === 'ignore');
  assert.equal(choices.length, 2);
  assert.ok(choices.some(step => step.actor === f.owner));
  assert.ok(choices.some(step => step.actor === f.opponent));
  const offer = viewGame(f.game, f.owner).battle!.stoneAllocation!;
  assert.deepEqual(offer.totals, [2, 5]);
  for (const total of offer.totals) {
    const { game } = completeStoneBurnerAllocation(f, total);
    assert.equal(game.lastBattleContext!.winner, total === 5 ? f.owner : f.opponent);
    assert.equal(game.discard.filter(card => card.id === ALLOCATION_STONE).length, total === 5 ? 0 : 1);
    assert.equal(game.discard.filter(card => card.id === ALLOCATION_MIRROR).length, total === 5 ? 1 : 0);
  }
});

void test('genuine two-sided mixed Stone counts stay sealed until both commit in either original seating order', () => {
  const queues: string[][] = [];
  for (const reverseSeats of [false, true]) {
    const f = createStoneBurnerAllocationFixture({ mixedOpponent: true, reverseSeats });
    genuineSource(f);
    const order = f.game.order.filter(actor => actor === f.owner || actor === f.opponent);
    queues.push(order);
    assert.equal(f.game.decision!.player, order[0]);
    assert.equal(f.game.battle!.attacker, order[0]);
    assert.deepEqual(viewGame(f.game, f.owner).battle!.stoneAllocation!.totals, [1, 2, 3]);
    assert.deepEqual(viewGame(f.game, f.opponent).battle!.stoneAllocation!.totals, [2, 3]);
    for (const selection of [{ emperor: 3, ixians: 2 }, { emperor: 1, ixians: 3 }]) {
      const { game, committed } = completeStoneBurnerAllocation(f, selection);
      assert.equal(committed.length, 2, 'Both original mixed sides commit even after a decisive first extreme');
      assert.deepEqual(committed.map(entry => entry.step.actor), order);
      const first = committed[0], waiting = first.after, next = order[1];
      assert.equal(waiting.decision?.kind, 'stoneAllocation');
      assert.equal(waiting.decision?.player, next);
      const own = viewGame(waiting, order[0]).battle!.stoneAllocation!, rival = viewGame(waiting, next).battle!.stoneAllocation!;
      assert.equal(own.selected, first.step.action.undialed);
      assert.equal(rival.selected, null);
      assert.deepEqual(Object.keys(rival).sort(), ['event', 'owner', 'player', 'selected', 'totals']);
      const messages = waiting.log.slice(first.before.log.length).map(entry => entry.text);
      assert.ok(messages.length > 0);
      assert.ok(messages.every(message => !/\d/.test(message)), 'The first public commitment message reveals no selected count');
      assert.deepEqual(player(waiting, f.owner).forces, player(f.game, f.owner).forces);
      assert.deepEqual(player(waiting, f.opponent).forces, player(f.game, f.opponent).forces);
      assert.equal(game.lastBattleContext!.winner, selection.emperor > selection.ixians ? f.owner : f.opponent);
      const completedMessages = game.log.slice(f.game.log.length).map(entry => entry.text);
      for (const actor of [f.owner, f.opponent])
        assert.ok(completedMessages.some(message => message.includes(`${player(game, actor).name} ${selection[actor as keyof typeof selection]} undialed`)),
          'Only the completed sealed queue publishes both original counts');
    }
  }
  assert.deepEqual(queues, [['emperor', 'ixians'], ['ixians', 'emperor']],
    'Actual reversed human joins change the original storm queue without a saved-order edit');
});

void test('all four minimal policies commit legal own counts from both sealed private views before original settlement', () => {
  const f = createStoneBurnerAllocationFixture({ mixedOpponent: true });
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    let game = structuredClone(f.game);
    const owners: string[] = [];
    for (let count = 0; count < 2; count++) {
      const decision = game.decision; assert.ok(decision?.kind === 'stoneAllocation');
      const view = viewGame(game, decision.player), offer = view.battle!.stoneAllocation!;
      view.players.find(player => player.id === decision.player)!.bot = difficulty;
      const action = botActions(view).find(action => action.type === 'decision' && action.event === offer.event &&
        typeof action.undialed === 'number'); assert.ok(action, `${difficulty} must answer its current owned count`);
      assert.ok(offer.totals.includes(Number(action.undialed)));
      assert.equal(offer.selected, null);
      owners.push(decision.player);
      game = actStoneBurnerAllocation(game, decision.player, action);
    }
    assert.deepEqual(owners, ['emperor', 'ixians']);
    const completed = completeStoneBurnerAllocation({ ...f, game });
    assert.ok([f.owner, f.opponent].includes(completed.game.lastBattleContext!.winner!));
  }
});

void test('a genuinely committed Stone total retains both later winner choices of ordinary and Sardaukar losses', () => {
  const f = createStoneBurnerAllocationFixture({ mixedOpponent: true, ownElite: 2 });
  genuineSource(f);
  assert.deepEqual(viewGame(f.game, f.owner).battle!.stoneAllocation!.totals, [2, 3, 4]);
  const selection = { emperor: 3, ixians: 2 }, first = completeStoneBurnerAllocation(f, selection);
  const later = first.committed.at(-1)!.after.decision;
  assert.ok(later?.kind === 'battleLosses');
  assert.equal(later.player, f.owner);
  assert.deepEqual(later.options.map(option => [option.normal, option.elite]), [[2, 1], [1, 2]]);
  const eliteLosses: number[] = [];
  for (const index of [0, later.options.length - 1]) {
    const { game } = completeStoneBurnerAllocation(f, selection, index), before = player(f.game, f.owner), after = player(game, f.owner);
    assert.equal(game.lastBattleContext!.winner, f.owner);
    assert.equal(after.tanks, before.tanks + 3);
    assert.equal(after.forces[f.location], 3);
    assert.equal(after.elites!.tanks, before.elites!.tanks + later.options[index].elite);
    eliteLosses.push(after.elites!.tanks - before.elites!.tanks);
  }
  assert.deepEqual(eliteLosses, [1, 2], 'The count commitment never preselects the winner’s typed physical loss mix');
});
