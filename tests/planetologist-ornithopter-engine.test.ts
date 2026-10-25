import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { splitLocation, territory } from '../game/board';
import { groundMoveRouteDistance } from '../game/bot-mobility';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { planetologistLeader } from '../game/planetologist-movement';
import {
  actPlanetologistOrnithopter as act, advancePlanetologistOrnithopter as advance,
  createPlanetologistOrnithopterFixture as fixture, finishPlanetologistOrnithopter as finish,
  movePlanetologistOrnithopter as move, planetologistOrnithopterClean as clean,
  planetologistOrnithopterDestination as destination, planetologistOrnithopterInventory as inventory,
  planetologistOrnithopterPlayer as player, planetologistOrnithopterSecondAction as secondAction,
  planetologistOrnithopterStocks as stocks, type PlanetologistOrnithopterFixture,
} from './fixture-planetologist-ornithopter';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function ownView(game: Game, actor: string) { return viewGame(game, actor).players.find(seat => seat.id === actor)!; }
function selected(action: Action): Record<string, number> {
  assert.ok(action.forces && typeof action.forces === 'object' && !Array.isArray(action.forces));
  for (const count of Object.values(action.forces)) assert.equal(typeof count, 'number');
  return action.forces as Record<string, number>;
}
function expectedForces(game: Game, actor: string, action: Action) {
  const forces = structuredClone(player(game, actor).forces);
  for (const [key, count] of Object.entries(selected(action))) {
    forces[key] -= count; if (!forces[key]) delete forces[key];
  }
  const target = destination(action);
  forces[target] = (forces[target] ?? 0) + Object.values(selected(action)).reduce((sum, count) => sum + count, 0);
  return forces;
}
function source(f: PlanetologistOrnithopterFixture) {
  assert.equal(f.game.status, 'playing'); assert.equal(f.game.advanced, f.advanced);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.actor);
  assert.deepEqual(f.game.players.map(seat => seat.faction), ['emperor', 'richese', 'atreides']);
  assert.deepEqual(f.game.expansions, ['choam']); assert.ok(f.game.leaderSkills);
  assert.ok(!f.game.homeworlds && !f.game.nexusCards && !f.game.techTokens &&
    !f.game.strongholdCards && !f.game.discoveryEnabled && !f.game.ecazTreachery);
  assert.ok(clean(f.game));
  assert.equal(planetologistLeader(f.game, f.actor), f.trainer);
  assert.ok(f.actions.some(step => step.action.type === 'start'));
  assert.ok(f.actions.some(step => step.actor === f.actor && step.action.type === 'leaderSkill' &&
    step.action.skill === 'planetologist' && step.action.leader === f.trainer));
  assert.ok(f.acquisition.steps.some(step => step.actor === f.actor && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.actor).spice - player(f.acquisition.after, f.actor).spice, 1);
  assert.ok(player(f.acquisition.before, f.richese).spice < player(f.acquisition.after, f.richese).spice);
  assert.ok(player(f.game, f.actor).hand.some(card => card.id === f.card));
  assert.equal(f.shipment.before.turn, 1); assert.equal(f.shipment.step.action.type, 'ship');
  assert.equal(f.shipment.step.action.amount, 4); assert.equal(f.shipment.step.action.elite, 0);
  assert.equal(player(f.shipment.before, f.actor).spice - player(f.shipment.after, f.actor).spice, 8);
  assert.equal(player(f.shipment.before, f.actor).reserves - player(f.shipment.after, f.actor).reserves, 4);
  assert.equal(f.splitMovement.step.action.type, 'move'); assert.equal(f.splitMovement.step.action.amount, 2);
  assert.equal(f.splitMovement.step.action.planetologist, undefined);
  assert.equal(player(f.splitMovement.after, f.actor).moved, 1);
  assert.deepEqual(player(f.game, f.actor).forces, { [f.sourceA]: 2, [f.sourceB]: 2 });
  assert.equal(player(f.game, f.actor).reserves, 16); assert.equal(player(f.game, f.actor).tanks, 0);
  assert.equal(player(f.game, f.actor).moved, 0); assert.equal(ownView(f.game, f.actor).movesAllowed, 1);
  assert.equal(player(f.game, f.actor).ornithopterExtraMoves ?? 0, 0);
  assert.equal(f.game.ornithopter ?? null, null);
  assert.equal(territory(splitLocation(f.sourceA).territory).type, 'rock');
  assert.equal(territory(splitLocation(f.sourceB).territory).type, 'rock');
  assert.equal(Object.hasOwn(f.action, 'origins'), false);
  const view = viewGame(f.game, f.actor), me = view.players.find(seat => seat.id === f.actor)!;
  const origins = Object.keys(f.forces), distances = origins.map(from => groundMoveRouteDistance(view, me, from, f.targetLocation));
  const range = f.mode === 'range3' ? 3 : f.planetologist === 'range' ? 2 : 1;
  assert.equal(Math.max(...distances), range);
  assert.ok(distances.every(distance => distance <= range));
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function complete(f: PlanetologistOrnithopterFixture, game: Game, count: 1 | 2) {
  assert.equal(player(game, f.actor).moved, count);
  assert.equal(ownView(game, f.actor).movesAllowed, count);
  assert.equal(player(game, f.actor).ornithopterExtraMoves ?? 0, count - 1);
  assert.equal(game.ornithopter ?? null, null);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(game, f.actor).hand.filter(card => card.id === f.card).length, 0);
  assert.deepEqual(stocks(game), f.originalStocks);
  assert.deepEqual(game.leaderSkills, f.game.leaderSkills);
  assert.deepEqual(inventory(game), f.originalInventory);
}

for (const advanced of [false, true]) for (const planetologist of ['range', 'gather'] as const) {
  void test(`public ${advanced ? 'Advanced' : 'Basic'} physical range3 with Planetologist ${planetologist} stays capped at three and spends one movement`, () => {
    const f = fixture({ advanced, mode: 'range3', planetologist }); source(f);
    rejected(f.game, f.actor, f.tooFarAction);
    const before = structuredClone(f.game), expected = expectedForces(f.game, f.actor, f.action);
    let game = move(f); assert.deepEqual(f.game, before);
    assert.deepEqual(player(game, f.actor).forces, expected); complete(f, game, 1);
    rejected(game, f.actor, f.action);
    const counters = structuredClone(player(game, f.actor).forces), steps: { actor: string; action: Action }[] = [];
    game = finish(f, game, steps);
    assert.equal(game.phase, 7); assert.equal(game.turn, 2);
    assert.ok(steps.some(step => step.actor === f.actor && step.action.type === 'endMovement'));
    assert.deepEqual(player(game, f.actor).forces, counters);
    assert.equal(player(game, f.actor).spice, player(f.game, f.actor).spice);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(inventory(game), f.originalInventory);
  });
}

for (const advanced of [false, true]) for (const planetologist of ['range', 'gather'] as const)
  for (const secondPlanetologist of ['range', 'gather'] as const) {
    void test(`public ${advanced ? 'Advanced' : 'Basic'} twoGroups changes Planetologist ${planetologist} to ${secondPlanetologist} with distinct original cohorts`, () => {
      const f = fixture({ advanced, mode: 'twoGroups', planetologist, secondPlanetologist }); source(f);
      rejected(f.game, f.actor, f.tooFarAction);
      const firstExpected = expectedForces(f.game, f.actor, f.action);
      let game = move(f);
      assert.deepEqual(player(game, f.actor).forces, firstExpected);
      assert.equal(player(game, f.actor).moved, 1); assert.equal(ownView(game, f.actor).movesAllowed, 2);
      assert.equal(player(game, f.actor).ornithopterExtraMoves ?? 0, 0);
      assert.equal(game.ornithopter?.mode, 'twoGroups'); assert.equal(game.ornithopter.completed, 1);
      const expectedCohort = { [f.sourceA]: 2 - f.forces[f.sourceA], [f.sourceB]: 2 - (f.forces[f.sourceB] ?? 0) };
      assert.deepEqual(game.ornithopter.cohort!.forces, expectedCohort,
        'The first card group removes every selected origin map from the original cohort');
      assert.deepEqual(game.ornithopter.cohort!.elites, {});
      assert.equal(player(game, f.actor).hand.some(card => card.id === f.card), false);
      assert.equal(game.discard.some(card => card.id === f.card), false);
      assert.deepEqual(inventory(game), f.originalInventory);
      rejected(game, f.actor, { type: 'move', planetologist: 'range', forces: { [f.targetLocation]: 1 },
        ornithopterEvent: game.ornithopter.event, ...splitLocation(f.sourceA) });
      const action = secondAction(f, game), expected = expectedForces(game, f.actor, action);
      assert.equal(action.planetologist, secondPlanetologist);
      assert.equal(Object.hasOwn(action, 'origins'), false);
      rejected(game, f.actor, { ...action, ornithopterEvent: 'stale-card-event' });
      game = act(game, f.actor, action); game = advance(game, clean);
      assert.deepEqual(player(game, f.actor).forces, expected); complete(f, game, 2);
      if (planetologist === 'gather' && secondPlanetologist === 'gather')
        assert.deepEqual(player(game, f.actor).forces, { [f.targetLocation]: 4 },
          'The same-origin residual units may legitimately merge with the first gather without reusing its units');
      rejected(game, f.actor, action);
      const counters = structuredClone(player(game, f.actor).forces);
      game = finish(f, game);
      assert.equal(game.phase, 7); assert.equal(game.turn, 2);
      assert.deepEqual(player(game, f.actor).forces, counters);
      assert.equal(player(game, f.actor).spice, player(f.game, f.actor).spice);
      assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
      assert.deepEqual(inventory(game), f.originalInventory);
    });
  }

void test('original residual quotas survive merging a first card arrival into a later source stack', () => {
  const f = fixture({ mode: 'twoGroups', planetologist: 'range' }); source(f);
  const first: Action = { ...f.action, ...splitLocation(f.sourceB) };
  let game = act(f.game, f.actor, first); game = advance(game, clean);
  assert.equal(player(game, f.actor).forces[f.sourceB], 3);
  assert.equal(game.ornithopter!.cohort!.forces[f.sourceB], 2);
  const nativeSecond = secondAction(f, game, 'range');
  rejected(game, f.actor, { ...nativeSecond, forces: { [f.sourceB]: 3 } });
  const second: Action = { ...nativeSecond, forces: { [f.sourceB]: 2 } };
  game = act(game, f.actor, second); game = advance(game, clean);
  complete(f, game, 2);
  assert.equal(player(game, f.actor).forces[f.sourceB], 1, 'The first moved unit stays behind at its new location');
  assert.equal(player(game, f.actor).forces[destination(second)], 2);
});

void test('ending after one accepted gather discards the actual card without earning an abandoned second-group credit', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced, mode: 'twoGroups', planetologist: 'gather' }); source(f);
    let game = move(f);
    const counters = structuredClone(player(game, f.actor).forces);
    game = act(game, f.actor, f.endMovement); game = advance(game, state => clean(state) && state.active !== f.actor);
    assert.equal(game.ornithopter ?? null, null);
    assert.equal(player(game, f.actor).ornithopterExtraMoves ?? 0, 0);
    assert.equal(player(game, f.actor).moved, 1);
    assert.deepEqual(player(game, f.actor).forces, counters);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    game = finish(f, game);
    assert.equal(game.phase, 7); assert.deepEqual(player(game, f.actor).forces, counters);
    assert.deepEqual(inventory(game), f.originalInventory);
  }
});

void test('physical Planetologist declarations reject foreign, stale and untrained controlled selections before spending the original card', () => {
  const f = fixture({ mode: 'range3', planetologist: 'gather' }); source(f);
  rejected(f.game, f.observer, f.action);
  rejected(f.game, f.actor, { ...f.action, ornithopterEvent: 'foreign-card-event' });
  rejected(f.game, f.actor, { ...f.action, movementCard: 'foreign-card' });
  rejected(f.game, f.actor, { ...f.action, origins: [splitLocation(f.sourceA).territory, splitLocation(f.sourceB).territory] });
  rejected(f.game, f.actor, { ...f.action, planetologist: { mode: 'gather', leader: f.trainer } });
  // Controlled trainer inputs supplement the twelve genuine public programmes;
  // they are not claimed to be played casualty/capture histories.
  for (const state of ['dead', 'captured'] as const) {
    const controlled = structuredClone(f.game), leader = player(controlled, f.actor).leaders.find(disc => disc.id === f.trainer)!;
    if (state === 'dead') leader.dead = true;
    else leader.capturedBy = f.observer;
    assert.equal(planetologistLeader(controlled, f.actor), null);
    rejected(controlled, f.actor, f.action);
  }
  assert.deepEqual(stocks(f.game), f.originalStocks);
  assert.ok(player(f.game, f.actor).hand.some(card => card.id === f.card));
});

void test('all four minimal profiles offer physical card and current second-group Planetologist alternatives', () => {
  for (const advanced of [false, true]) for (const mode of ['range3', 'twoGroups'] as const)
    for (const planetologist of ['range', 'gather'] as const) {
      const f = fixture({ advanced, mode, planetologist }); source(f);
      const sources = [f.game, ...(mode === 'twoGroups' ? [move(f)] : [])];
      for (const game of sources) for (const difficulty of DIFFICULTIES) {
        const view = viewGame(game, f.actor); view.players.find(seat => seat.id === f.actor)!.bot = difficulty;
        const candidates = botActions(view).filter(action => action.type === 'move' && action.planetologist === planetologist &&
          (game.ornithopter ? action.ornithopterEvent === game.ornithopter.event
            : action.movementCard === f.card && action.ornithopter === mode));
        assert.ok(candidates.length, `${difficulty} offers ${mode}/${planetologist}/${game.ornithopter ? 'second' : 'initial'} movement`);
        const action = candidates[0], before = player(game, f.actor).moved;
        let accepted = act(game, f.actor, action); accepted = advance(accepted, clean);
        assert.equal(player(accepted, f.actor).moved, before + 1);
        assert.deepEqual(stocks(accepted), stocks(game));
        assert.deepEqual(inventory(accepted), f.originalInventory);
      }
    }
});
