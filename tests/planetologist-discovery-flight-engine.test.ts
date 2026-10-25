import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { location, splitLocation } from '../game/board';
import { groundMoveRouteDistance } from '../game/bot-mobility';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { discoveryFlightMove } from '../game/discovery-flight-options';
import { planetologistLeader } from '../game/planetologist-movement';
import {
  actPlanetologistDiscoveryFlight as act,
  createPlanetologistDiscoveryFlightFixture as fixture,
  finishPlanetologistDiscoveryFlight as finish,
  planetologistDiscoveryFlightInventory as inventory,
  planetologistDiscoveryFlightPhysical as physical,
  planetologistDiscoveryFlightPlayer as player,
  type PlanetologistDiscoveryFlightFixture as Fixture,
  type PlanetologistDiscoveryFlightStep as Step,
} from './fixture-planetologist-discovery-flight';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function source(f: Fixture) {
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.ready.status, 'lobby'); assert.equal(f.started.status, 'setup');
  assert.equal(f.collection.status, 'playing'); assert.equal(f.game.status, 'playing');
  assert.equal(f.game.advanced, f.advanced); assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 5);
  assert.equal(f.game.active, f.actor); assert.equal(f.game.phaseOpening ?? null, null);
  assert.equal(f.game.response ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.deepEqual(f.game.expansions, []); assert.deepEqual(f.game.players.map(p => p.faction), ['guild', 'emperor', 'harkonnen']);
  assert.ok(f.game.leaderSkills && f.game.discoveryEnabled && f.game.discoveries);
  assert.ok(!f.game.homeworlds && !f.game.nexusCards && !f.game.techTokens && !f.game.strongholdCards && !f.game.ecazTreachery);
  assert.ok(f.actions.some(step => step.action.type === 'moduleOption' && step.action.module === 'leaderSkills'));
  assert.ok(f.actions.some(step => step.action.type === 'moduleOption' && step.action.module === 'discoveries'));
  assert.ok(f.actions.some(step => step.action.type === 'start' && (!f.advanced || step.action.advancedPreview === true)));
  assert.ok(f.actions.some(step => step.actor === f.actor && step.action.type === 'leaderSkill' &&
    step.action.skill === 'planetologist' && step.action.leader === f.trainer));
  assert.ok(f.actions.some(step => step.actor === f.actor && step.action.type === 'discovery' &&
    step.action.token === f.token && step.action.reveal === true));
  assert.equal(f.collection.turn, 1); assert.equal(f.collection.phase, 7);
  assert.equal(f.acquired.turn, 1); assert.equal(f.originalToken.acquiredTurn, 1); assert.equal(f.originalToken.revealedTurn, 1);
  assert.equal(f.originalToken.face, 'ornithopter'); assert.equal(f.originalToken.status, 'carried'); assert.equal(f.originalToken.owner, f.actor);
  assert.deepEqual(f.game.discoveries!.tokens.find(token => token.id === f.token), f.originalToken);
  assert.match(viewGame(f.acquired, f.actor).discoveryOrnithopter!.blocked!, /after/);
  assert.equal(viewGame(f.game, f.actor).discoveryOrnithopter!.blocked, null);
  assert.equal(viewGame(f.game, f.observer).discoveryOrnithopter, null);
  assert.equal(planetologistLeader(f.game, f.actor), f.trainer);
  assert.equal(player(f.game, f.actor).moved, 0); assert.equal(player(f.game, f.actor).shipped, true);
  assert.equal(player(f.game, f.actor).forces[f.first], 3); assert.equal(player(f.game, f.actor).forces[f.second], 1);
  assert.equal(player(f.game, f.actor).forces['tueks_sietch:5'], 5, 'The original off-route Guild garrison remains physical');
  assert.equal(f.beforeShipment.turn, 2); assert.equal(f.shipmentStep.action.type, 'ship'); assert.equal(f.shipmentStep.action.amount, 1);
  assert.equal(player(f.beforeShipment, f.actor).spice - player(f.afterShipment, f.actor).spice, 1);
  assert.equal(player(f.beforeShipment, f.actor).reserves - player(f.afterShipment, f.actor).reserves, 1);
  assert.notEqual(splitLocation(f.first).territory, splitLocation(f.second).territory);
  const view = viewGame(f.game, f.actor), me = view.players.find(p => p.id === f.actor)!;
  for (const from of f.sources) assert.equal(groundMoveRouteDistance(view, me, from, f.targetLocation), 3);
  assert.equal(groundMoveRouteDistance(view, me, f.first, f.rangeFourLocation), 4);
  assert.ok(f.sources.some(from => groundMoveRouteDistance(view, me, from, f.gatherTooFarLocation) === 4));
  assert.equal(Object.hasOwn(f.action, 'origins'), false); assert.equal(Object.hasOwn(f.action, 'discoveryFlight'), false);
  assert.equal(f.sourceActionCount, f.actions.length); assert.ok(f.sourceActionCount > 20);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.equal(f.originalInventory.treachery.length, 33);
  assert.equal(f.originalInventory.skills.length, 14); assert.equal(f.originalInventory.discoveries.length, 8);
}
function moved(f: Fixture, game: Game, action: Action) {
  const before = player(f.game, f.actor), after = player(game, f.actor);
  const forces = action.forces !== undefined ? action.forces as Record<string, number>
    : { [action.from as string]: action.amount as number };
  const destination = location(action.territory as string, action.sector as number);
  const expected = { ...before.forces };
  for (const [from, amount] of Object.entries(forces)) {
    expected[from] -= amount; if (!expected[from]) delete expected[from];
  }
  expected[destination] = (expected[destination] ?? 0) + Object.values(forces).reduce((sum, amount) => sum + amount, 0);
  assert.deepEqual(after.forces, expected);
  assert.equal(after.moved, before.moved + 1); assert.equal(after.shipped, before.shipped);
  assert.equal(after.reserves, before.reserves); assert.equal(after.tanks, before.tanks); assert.equal(after.spice, before.spice);
  assert.deepEqual(after.elites, before.elites); assert.deepEqual(after.leaders, before.leaders); assert.deepEqual(after.hand, before.hand);
  assert.deepEqual(game.leaderSkills, f.game.leaderSkills); assert.equal(planetologistLeader(game, f.actor), f.trainer);
  assert.deepEqual(game.players.filter(p => p.id !== f.actor), f.game.players.filter(p => p.id !== f.actor));
  const token = game.discoveries!.tokens.find(token => token.id === f.token)!;
  assert.equal(token.status, 'removed'); assert.equal(token.owner, null); assert.equal(token.acquiredTurn, 1);
  assert.equal(token.revealedTurn, 1); assert.equal(viewGame(game, f.actor).discoveryOrnithopter, null);
  assert.deepEqual(game.discoveries!.tokens.filter(token => token.id !== f.token),
    f.game.discoveries!.tokens.filter(token => token.id !== f.token));
  assert.deepEqual(inventory(game), f.originalInventory);
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced preview' : 'Basic';
  void test(`public ${band} Discovery plus Planetologist range stays fixed at three and consumes one token after the accepted movement`, () => {
    const f = fixture({ advanced }); source(f);
    rejected(f.game, f.actor, f.rangeFourAction);
    const ordinary = { ...f.rangeAction }; delete ordinary.discoveryOrnithopter;
    rejected(f.game, f.actor, ordinary);
    const quote = discoveryFlightMove(viewGame(f.game, f.actor), ordinary);
    assert.equal(quote.blocked, null); assert.deepEqual(quote.action, f.rangeAction);
    const game = act(f.game, f.actor, f.rangeAction); moved(f, game, f.rangeAction);
    rejected(game, f.actor, f.rangeAction); rejected(game, f.actor, f.action);
    const actions: Step[] = [], done = finish(f, game, actions);
    assert.equal(done.turn, 2); assert.equal(done.phase, 7);
    assert.ok(actions.some(step => step.actor === f.actor && step.action.type === 'endMovement'));
    assert.equal(player(done, f.actor).moved, 1); assert.equal(player(done, f.actor).forces[f.targetLocation], 1);
    assert.equal(done.discoveries!.tokens.find(token => token.id === f.token)!.status, 'removed');
    assert.deepEqual(inventory(done), f.originalInventory);
  });

  void test(`public ${band} Discovery plus Planetologist gathers both actual funded origins at fixed three as one ordinary action`, () => {
    const f = fixture({ advanced }); source(f);
    rejected(f.game, f.actor, f.gatherTooFarAction);
    const ordinary = { ...f.action }; delete ordinary.discoveryOrnithopter;
    rejected(f.game, f.actor, ordinary);
    const quote = discoveryFlightMove(viewGame(f.game, f.actor), ordinary);
    assert.equal(quote.blocked, null); assert.deepEqual(quote.action, f.action);
    const before = structuredClone(f.game), game = act(f.game, f.actor, f.action);
    assert.deepEqual(f.game, before); moved(f, game, f.action);
    assert.equal(player(game, f.actor).forces[f.first] ?? 0, 0); assert.equal(player(game, f.actor).forces[f.second] ?? 0, 0);
    assert.equal(player(game, f.actor).forces[f.targetLocation], 4);
    rejected(game, f.actor, f.action);
    const actions: Step[] = [], done = finish(f, game, actions);
    assert.equal(done.turn, 2); assert.equal(done.phase, 7); assert.equal(player(done, f.actor).moved, 1);
    assert.equal(player(done, f.actor).forces[f.targetLocation], 4);
    assert.ok(actions.some(step => step.actor === f.actor && step.action.type === 'endMovement'));
    assert.deepEqual(inventory(done), f.originalInventory);
  });
}

void test('the native acquired token rejects same-turn, stale, foreign, malformed and changed-source declarations without consuming it', () => {
  const f = fixture(); source(f);
  const sameTurn = discoveryFlightMove(viewGame(f.acquired, f.actor), f.rangeAction);
  assert.equal(sameTurn.action, null); assert.match(sameTurn.blocked!, /after/);
  rejected(f.acquired, f.actor, f.rangeAction);
  rejected(f.game, f.observer, f.action); rejected(f.game, f.opponent, f.action);
  for (const action of [
    { ...f.action, discoveryOrnithopter: 'discovery-token-99' },
    { ...f.action, discoveryOrnithopter: f.game.discoveries!.tokens.find(token => token.id !== f.token)!.id },
    { ...f.action, forces: { [f.first]: 4, [f.second]: 1 } },
    { ...f.action, forces: { [f.first]: 3 } },
    { ...f.action, forces: { [f.first]: 3, [f.second]: 1, 'tueks_sietch:5': 1 } },
    { ...f.action, forces: { [f.first]: -1, [f.second]: 1 } },
    { ...f.action, origins: f.sources.map(from => splitLocation(from).territory) },
    { ...f.action, discoveryFlight: { token: f.token } },
    { ...f.action, ornithopterEvent: 'stale-card-event' },
  ]) rejected(f.game, f.actor, action);
  assert.deepEqual(physical(f.game), f.originalPhysical);
  assert.deepEqual(f.game.discoveries!.tokens.find(token => token.id === f.token), f.originalToken);
});

void test('controlled eligibility and changed-source supplements cannot reuse the original native combined declaration', () => {
  const f = fixture(); source(f);
  // CONTROLLED supplements: these do not claim played trainer deaths/captures,
  // a new action receipt or casualties in the original positive chronology.
  for (const state of ['dead', 'captured'] as const) {
    const controlled = structuredClone(f.game), trainer = player(controlled, f.actor).leaders.find(disc => disc.id === f.trainer)!;
    if (state === 'dead') trainer.dead = true; else trainer.capturedBy = f.observer;
    assert.equal(planetologistLeader(controlled, f.actor), null); rejected(controlled, f.actor, f.action);
  }
  const changed = structuredClone(f.game), me = player(changed, f.actor);
  me.forces[f.first]--; me.tanks++;
  assert.equal(me.reserves + me.tanks + Object.values(me.forces).reduce((sum, amount) => sum + amount, 0), 20);
  rejected(changed, f.actor, f.action);
  assert.deepEqual(physical(f.game), f.originalPhysical); assert.deepEqual(inventory(f.game), f.originalInventory);
});

void test('all four minimal profiles offer legal fixed-three range and gather Discovery compositions at both native sources', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced }); source(f);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(f.game, f.actor); view.players.find(p => p.id === f.actor)!.bot = difficulty;
      const actions = botActions(view);
      for (const mode of ['range', 'gather'] as const) {
        const action = actions.find(action => action.type === 'move' && action.planetologist === mode && action.discoveryOrnithopter === f.token);
        assert.ok(action, `${difficulty} must offer the owned ${mode} Discovery composition`);
        assert.equal(Object.hasOwn(action, 'origins'), false); assert.equal(Object.hasOwn(action, 'discoveryFlight'), false);
        const game = act(f.game, f.actor, action); moved(f, game, action);
        assert.equal(player(game, f.actor).moved, 1);
      }
    }
  }
});
