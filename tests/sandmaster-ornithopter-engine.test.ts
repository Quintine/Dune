import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { splitLocation } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  quoteSandmasterMovement, sandmasterActionOrder, sandmasterCollectionPiles,
  sandmasterLeader, sandmasterRouteDistance, sandmasterShortestRoute, type SandmasterChoice,
} from '../game/sandmaster-movement';
import {
  actSandmasterOrnithopter as act, advanceSandmasterOrnithopter as advance,
  createSandmasterOrnithopterFixture as fixture, finishSandmasterOrnithopter as finish,
  moveSandmasterOrnithopter as move, sandmasterOrnithopterClean as clean,
  sandmasterOrnithopterDestination as destination, sandmasterOrnithopterInventory as inventory,
  sandmasterOrnithopterPlayer as player, sandmasterOrnithopterSecondAction as secondAction,
  sandmasterOrnithopterStocks as stocks, type SandmasterOrnithopterFixture,
} from './fixture-sandmaster-ornithopter';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
const ownView = (game: Game, actor: string) => viewGame(game, actor).players.find(seat => seat.id === actor)!;
const bonusLogs = (game: Game) => game.log.filter(entry => entry.text.includes('Sandmaster collected 1 spice while moving')).length;
function withBonus(f: SandmasterOrnithopterFixture, game: Game, bonus: number) {
  const expected = structuredClone(f.originalStocks);
  expected.find(seat => seat.id === f.actor)!.spice += bonus;
  assert.deepEqual(stocks(game), expected);
  assert.equal(bonusLogs(game) - f.originalSandmasterLogCount, bonus);
  assert.equal(game.spice[f.pile] ?? 0, f.pileBefore - bonus);
  for (const [key, amount] of Object.entries(f.originalPiles))
    if (key !== f.pile) assert.equal(game.spice[key], amount, 'Unselected entered piles are not additional compulsory income');
  assert.deepEqual(inventory(game), f.originalInventory);
}
function source(f: SandmasterOrnithopterFixture) {
  assert.equal(f.game.status, 'playing'); assert.equal(f.game.advanced, f.advanced);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.actor);
  assert.deepEqual(f.game.players.map(seat => seat.faction), ['emperor', 'richese', 'atreides']);
  assert.deepEqual(f.game.expansions, ['choam']); assert.ok(f.game.leaderSkills);
  assert.ok(!f.game.homeworlds && !f.game.nexusCards && !f.game.techTokens &&
    !f.game.strongholdCards && !f.game.discoveryEnabled && !f.game.ecazTreachery);
  assert.ok(clean(f.game)); assert.equal(sandmasterLeader(f.game, f.actor), f.trainer);
  assert.ok(f.actions.some(step => step.action.type === 'start'));
  assert.ok(f.actions.some(step => step.actor === f.actor && step.action.type === 'leaderSkill' &&
    step.action.skill === 'sandmaster' && step.action.leader === f.trainer));
  assert.ok(f.acquisition.steps.some(step => step.actor === f.actor && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.actor).spice - player(f.acquisition.after, f.actor).spice, 1);
  assert.ok(player(f.game, f.actor).hand.some(card => card.id === f.card));
  assert.equal(f.shipment.before.turn, 1); assert.equal(f.shipment.step.action.type, 'ship');
  assert.equal(f.shipment.step.action.amount, 4); assert.equal(f.shipment.step.action.elite, 0);
  assert.equal(player(f.shipment.before, f.actor).spice - player(f.shipment.after, f.actor).spice, 8);
  assert.equal(player(f.shipment.before, f.actor).reserves - player(f.shipment.after, f.actor).reserves, 4);
  assert.deepEqual(player(f.game, f.actor).forces, { [f.source]: 4 });
  assert.equal(player(f.game, f.actor).reserves, 16); assert.equal(player(f.game, f.actor).tanks, 0);
  assert.equal(player(f.game, f.actor).moved, 0); assert.equal(ownView(f.game, f.actor).movesAllowed, 1);
  assert.equal(f.game.ornithopter ?? null, null);
  assert.equal(f.beforeBlow.turn, 2); assert.equal(f.beforeBlow.phase, 0);
  assert.deepEqual(f.spiceOrder.after.map(card => JSON.stringify(card)).sort(), f.spiceOrder.original.map(card => JSON.stringify(card)).sort());
  assert.ok(f.blow.steps.some(step => step.action.type === 'ready' || step.action.type === 'stormDial'));
  assert.ok(f.blow.after.spiceDiscard.flat().some(card => JSON.stringify(card) === JSON.stringify(f.blow.card)));
  assert.equal(f.blow.after.spice[f.pile], (f.beforeBlow.spice[f.pile] ?? 0) + f.blow.card.amount);
  assert.equal(f.game.spice[f.pile], f.pileBefore); assert.ok(f.pileBefore >= 2);
  assert.equal(f.choice.routes[f.source][0], f.source);
  assert.equal(f.choice.routes[f.source].at(-1), f.targetLocation);
  assert.deepEqual(f.choice.collect, [f.pile]);
  assert.equal(sandmasterRouteDistance(f.game, f.route), f.mode === 'range3' ? 3 : 1);
  const view = viewGame(f.game, f.actor), order = sandmasterActionOrder(view, f.actor, f.action);
  assert.ok(order, 'The real held-card action has an owned Sandmaster order');
  assert.equal(order.range, f.mode === 'range3' ? 3 : 1);
  const quote = quoteSandmasterMovement(f.game, f.actor, order, f.choice);
  assert.deepEqual(quote.routes, f.choice.routes);
  assert.deepEqual(quote.piles, [{ key: f.pile, before: f.pileBefore }]);
  if (f.mode === 'range3') {
    const shortest = sandmasterShortestRoute(f.game, f.actor, f.source, f.targetLocation, 3); assert.ok(shortest);
    assert.ok(sandmasterRouteDistance(f.game, shortest) < 3,
      'The owned original choice deliberately retains a longer legal collecting route');
  }
  assert.equal(f.sourceActionCount, f.actions.length); assert.deepEqual(inventory(f.game), f.originalInventory);
}
function retired(f: SandmasterOrnithopterFixture, game: Game, movements: 1 | 2, bonus: number) {
  withBonus(f, game, bonus);
  assert.equal(player(game, f.actor).moved, movements);
  assert.equal(ownView(game, f.actor).movesAllowed, movements);
  assert.equal(player(game, f.actor).ornithopterExtraMoves ?? 0, movements - 1);
  assert.equal(game.ornithopter ?? null, null);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(game, f.actor).hand.some(card => card.id === f.card), false);
}

for (const advanced of [false, true]) for (const mode of ['range3', 'twoGroups'] as const) {
  void test(`public ${advanced ? 'Advanced' : 'Basic'} Sandmaster ${mode} collects from actual Spice blows once per accepted physical movement`, () => {
    const f = fixture({ advanced, mode }); source(f);
    const before = structuredClone(f.game);
    let game = move(f); assert.deepEqual(f.game, before);
    withBonus(f, game, 1);
    assert.equal(player(game, f.actor).forces[f.source], 2);
    assert.equal(player(game, f.actor).forces[f.targetLocation], 2);
    assert.equal(player(game, f.actor).moved, 1);
    if (mode === 'twoGroups') {
      assert.equal(game.ornithopter?.completed, 1);
      assert.deepEqual(game.ornithopter.cohort!.forces, { [f.source]: 2 });
      assert.equal(game.discard.some(card => card.id === f.card), false);
      assert.equal(player(game, f.actor).hand.some(card => card.id === f.card), false);
      rejected(game, f.actor, { type: 'move', forces: { [f.targetLocation]: 1 },
        ornithopterEvent: game.ornithopter.event, ...f.sourceLocation });
      const action = secondAction(f, game), order = sandmasterActionOrder(viewGame(game, f.actor), f.actor, action);
      assert.ok(order);
      const quote = quoteSandmasterMovement(game, f.actor, order, action.sandmaster);
      assert.deepEqual(quote.piles, [{ key: f.pile, before: f.pileBefore - 1 }], 'The second original cohort requotes the actual remaining spice');
      game = act(game, f.actor, action); game = advance(game, clean);
      assert.deepEqual(player(game, f.actor).forces, { [f.targetLocation]: 4 });
      retired(f, game, 2, 2);
    } else retired(f, game, 1, 1);
    rejected(game, f.actor, f.action);
    const bonus = bonusLogs(game), forces = structuredClone(player(game, f.actor).forces);
    const steps: { actor: string; action: Action }[] = [];
    game = finish(f, game, steps);
    assert.equal(game.phase, 7); assert.equal(game.turn, 2);
    assert.ok(steps.some(step => step.actor === f.actor && step.action.type === 'endMovement'));
    assert.equal(bonusLogs(game), bonus, 'Ordinary Collection does not repeat any movement bonus');
    assert.deepEqual(player(game, f.actor).forces, forces);
    assert.equal(player(game, f.actor).reserves, 16); assert.equal(player(game, f.actor).tanks, 0);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(inventory(game), f.originalInventory);
  });
}

void test('each actual card movement can independently decline Sandmaster without altering its original force route or disposal', () => {
  for (const advanced of [false, true]) for (const firstCollect of [false, true]) {
    const f = fixture({ advanced, mode: 'twoGroups' }); source(f);
    let game = move(f, structuredClone(f.game), [], firstCollect);
    withBonus(f, game, Number(firstCollect));
    game = act(game, f.actor, secondAction(f, game, !firstCollect)); game = advance(game, clean);
    retired(f, game, 2, 1);
    assert.deepEqual(player(game, f.actor).forces, { [f.pile]: 4 });
  }
  const f = fixture({ mode: 'range3' }); source(f);
  const game = move(f, structuredClone(f.game), [], false);
  retired(f, game, 1, 0);
  assert.equal(player(game, f.actor).forces[f.targetLocation], 2);
});

void test('invalid physical-flight Sandmaster routes and pile choices reject before card, board spice or original forces move', () => {
  const f = fixture({ mode: 'range3' }); source(f);
  rejected(f.game, f.observer, f.action);
  rejected(f.game, f.actor, { ...f.action, sandmaster: { routes: {}, collect: [f.pile] } });
  rejected(f.game, f.actor, { ...f.action, sandmaster: { routes: f.routes, collect: [f.pile, f.pile] } });
  rejected(f.game, f.actor, { ...f.action, sandmaster: { routes: f.routes, collect: [f.source] } });
  rejected(f.game, f.actor, { ...f.action, sandmaster: { routes: { [f.source]: [f.source, f.targetLocation] }, collect: [f.pile] } });
  rejected(f.game, f.actor, { ...f.action, ornithopterEvent: 'stale-card-flight' });
  const changed = structuredClone(f.game); changed.spice[f.pile] = 0;
  rejected(changed, f.actor, f.action); // Labelled changed-pile supplement; not a played source.
  assert.deepEqual(stocks(f.game), f.originalStocks);
  assert.deepEqual(f.game.spice, f.originalPiles);
  assert.ok(player(f.game, f.actor).hand.some(card => card.id === f.card));
  assert.deepEqual(inventory(f.game), f.originalInventory);
});

void test('early ending retains one committed Sandmaster payment and discards the abandoned second flight once', () => {
  const f = fixture({ mode: 'twoGroups' }); source(f);
  let game = move(f);
  game = act(game, f.actor, f.endMovement); game = advance(game, state => clean(state) && state.active !== f.actor);
  assert.equal(bonusLogs(game) - f.originalSandmasterLogCount, 1);
  assert.equal(player(game, f.actor).ornithopterExtraMoves ?? 0, 0);
  assert.equal(player(game, f.actor).moved, 1);
  assert.equal(player(game, f.actor).forces[f.source], 2);
  assert.equal(player(game, f.actor).forces[f.pile], 2);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  const bonus = bonusLogs(game); game = finish(f, game);
  assert.equal(game.phase, 7); assert.equal(bonusLogs(game), bonus);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('all four minimal profiles offer a collected original physical flight and its remaining original group', () => {
  for (const advanced of [false, true]) for (const mode of ['range3', 'twoGroups'] as const) {
    const f = fixture({ advanced, mode }); source(f);
    const sources = [f.game, ...(mode === 'twoGroups' ? [move(f)] : [])];
    for (const game of sources) for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game, f.actor); view.players.find(seat => seat.id === f.actor)!.bot = difficulty;
      const candidates = botActions(view).filter(action => {
        if (action.type !== 'move' || !action.sandmaster || typeof action.sandmaster !== 'object' || Array.isArray(action.sandmaster)) return false;
        const choice = action.sandmaster as Partial<SandmasterChoice>;
        return Array.isArray(choice.collect) && choice.collect.length > 0 &&
          (game.ornithopter ? action.ornithopterEvent === game.ornithopter.event
            : action.movementCard === f.card && action.ornithopter === mode);
      });
      assert.ok(candidates.length, `${difficulty} offers original ${mode}/${game.ornithopter ? 'second' : 'first'} Sandmaster collection`);
      const action = candidates[0], choice = action.sandmaster as SandmasterChoice;
      const offered = sandmasterCollectionPiles(game, choice.routes);
      assert.ok(choice.collect.every(key => offered[splitLocation(key).territory]?.includes(key)));
      const before = player(game, f.actor), moved = before.moved;
      let accepted = act(game, f.actor, action); accepted = advance(accepted, clean);
      assert.equal(player(accepted, f.actor).moved, moved + 1);
      assert.equal(player(accepted, f.actor).spice, before.spice + choice.collect.length);
      assert.equal(player(accepted, f.actor).reserves, before.reserves); assert.equal(player(accepted, f.actor).tanks, before.tanks);
      for (const key of choice.collect) assert.equal(accepted.spice[key] ?? 0, game.spice[key] - 1);
      assert.equal(typeof destination(action), 'string');
      assert.deepEqual(inventory(accepted), f.originalInventory);
    }
  }
});
