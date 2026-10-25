import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { botGroundMoveAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { planetologistLeader } from '../game/planetologist-movement';
import { presenceAt } from '../game/force-presence';
import {
  actPlanetologistNoField as act, createPlanetologistNoFieldFixture as fixture,
  finishPlanetologistNoField as finish, movePlanetologistNoField as move,
  planetologistNoFieldInventory as inventory, planetologistNoFieldPhysical as physical,
  planetologistNoFieldPlayer as player, type PlanetologistNoFieldFixture,
} from './fixture-planetologist-no-field';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function source(f: PlanetologistNoFieldFixture) {
  assert.equal(f.game.status, 'playing'); assert.equal(f.game.advanced, f.advanced);
  assert.equal(f.game.turn, f.companions ? 2 : 1); assert.equal(f.game.phase, 5);
  assert.equal(f.game.active, f.actor);
  assert.deepEqual(f.game.expansions, ['choam']);
  assert.deepEqual(f.game.players.map(seat => seat.faction), ['richese', 'atreides', 'emperor']);
  assert.ok(f.game.leaderSkills);
  assert.ok(!f.game.homeworlds && !f.game.nexusCards && !f.game.techTokens &&
    !f.game.strongholdCards && !f.game.discoveryEnabled && !f.game.ecazTreachery);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.response ?? null, null);
  assert.equal(f.game.decision ?? null, null); assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  assert.ok(f.actions.some(step => step.action.type === 'moduleOption' && step.action.module === 'leaderSkills' && step.action.enabled === true));
  assert.ok(f.actions.some(step => step.action.type === 'start'));
  assert.ok(f.actions.some(step => step.actor === f.actor && step.action.type === 'leaderSkill' &&
    step.action.skill === 'planetologist' && step.action.leader === f.trainer));
  assert.equal(planetologistLeader(f.game, f.actor), f.trainer);
  assert.equal(player(f.game, f.actor).shipped, true); assert.equal(player(f.game, f.actor).moved, 0);
  assert.equal(player(f.game, f.actor).forces[f.source] ?? 0, f.companions);
  assert.equal(territory(f.sourceLocation.territory).type, 'rock');
  assert.equal(territory(f.target.territory).type, 'rock');
  assert.equal(player(f.game, f.actor).noField!.deployed!.tokenId, f.token.id);
  assert.equal(player(f.game, f.actor).noField!.lastShipped, f.token.id);
  assert.deepEqual(player(f.game, f.actor).noField!.deployed!.location, f.sourceLocation);
  assert.equal(player(f.game, f.actor).noField!.tokens.find(token => token.id === f.token.id)!.value, f.value);
  assert.equal(f.shipmentStep.action.type, 'ship');
  assert.equal(f.shipmentStep.action.noField, f.token.id);
  assert.equal(f.shipmentStep.action.territory, f.sourceLocation.territory);
  assert.equal(player(f.beforeShipment, f.actor).spice - player(f.game, f.actor).spice, 2);
  assert.equal(player(f.beforeShipment, f.actor).reserves, player(f.game, f.actor).reserves);
  const view = viewGame(f.game, f.actor), me = view.players.find(seat => seat.id === f.actor)!;
  assert.equal(groundMoveRouteDistance(view, me, f.source, f.targetLocation), 2);
  assert.equal(groundMoveRouteDistance(view, me, f.source, f.tooFarLocation), 3);
  assert.equal(botGroundMoveAllowed(view, me, f.source, f.targetLocation, 0), false);
  assert.equal(botGroundMoveAllowed(view, me, f.source, f.targetLocation, 0, 'range'), true);
  assert.equal(botGroundMoveAllowed(view, me, f.source, f.tooFarLocation, 0, 'range'), false);
  if (f.companions) {
    assert.ok(f.companionShipment);
    assert.equal(f.companionShipment.before.turn, 1);
    assert.equal(f.companionShipment.step.action.type, 'ship');
    assert.equal(f.companionShipment.step.action.amount, f.companions);
    assert.equal(player(f.companionShipment.after, f.actor).forces[f.source], f.companions);
    assert.equal(player(f.companionShipment.before, f.actor).reserves - player(f.companionShipment.after, f.actor).reserves, f.companions);
    assert.ok(f.actions.some(step => step.actor === f.actor && step.action.type === 'endMovement'));
  } else assert.equal(f.companionShipment, null);
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function moved(f: PlanetologistNoFieldFixture, game: Game) {
  const before = player(f.game, f.actor), after = player(game, f.actor);
  assert.deepEqual(after.noField!.tokens, f.originalNoField.tokens);
  assert.equal(after.noField!.lastShipped, f.originalNoField.lastShipped);
  assert.deepEqual(after.noField!.deployed, { ...f.originalNoField.deployed!, location: f.target });
  assert.notEqual(after.noFieldEvent, f.originalEvent);
  assert.equal(after.moved, before.moved + 1); assert.equal(after.shipped, true);
  assert.equal(after.reserves, before.reserves); assert.equal(after.tanks, before.tanks);
  assert.equal(after.spice, before.spice);
  assert.equal(after.forces[f.source] ?? 0, 0);
  assert.equal(after.forces[f.targetLocation] ?? 0, f.companions);
  assert.equal(presenceAt(after, f.target.territory), 1 + f.companions,
    'Every concealed denomination remains one marker beside only the actual selected counters');
  assert.equal(planetologistLeader(game, f.actor), f.trainer);
  assert.deepEqual(game.leaderSkills, f.game.leaderSkills);
  assert.deepEqual(after.leaders, before.leaders);
  assert.deepEqual(after.hand, before.hand);
  const observed = viewGame(game, f.observer).richeseNoField!;
  assert.equal(observed.private, null);
  assert.deepEqual(observed.public.deployed, { controller: f.actor, location: f.target, effectiveForces: 1 });
  assert.deepEqual(inventory(game), f.originalInventory);
}

for (const advanced of [false, true]) for (const value of [0, 3, 5] as const) for (const companions of [0, 1] as const) {
  void test(`public ${advanced ? 'Advanced' : 'Basic'} concealed${value} ${companions ? 'with a genuinely shipped companion' : 'marker-only'} moves distance two through its original Planetologist`, () => {
    const f = fixture({ advanced, value, companions }); source(f);
    rejected(f.game, f.actor, f.ordinary);
    rejected(f.game, f.actor, f.tooFarAction);
    const before = structuredClone(f.game);
    let game = move(f);
    assert.deepEqual(f.game, before);
    moved(f, game);
    if (!companions) assert.deepEqual(physical(game), f.originalPhysical,
      'Marker-only movement does not materialize any physical force, change a wallet or consume a card');
    rejected(game, f.actor, f.action);
    const relocated = structuredClone(player(game, f.actor).noField), newEvent = player(game, f.actor).noFieldEvent;
    const continuation: { actor: string; action: Action }[] = [];
    game = finish(f, game, continuation);
    assert.equal(game.turn, f.game.turn); assert.equal(game.phase, 7);
    assert.ok(continuation.some(step => step.actor === f.actor && step.action.type === 'endMovement'));
    moved(f, game);
    assert.deepEqual(player(game, f.actor).noField, relocated);
    assert.equal(player(game, f.actor).noFieldEvent, newEvent);
  });
}

void test('original Planetologist marker movement rejects foreign or stale selections and keeps unsupported route combinations fenced', () => {
  const f = fixture(); source(f);
  rejected(f.game, f.opponent, f.action);
  rejected(f.game, f.actor, { ...f.action, event: 'stale-native-marker-event' });
  const other = player(f.game, f.actor).noField!.tokens.find(token => token.id !== f.token.id)!;
  rejected(f.game, f.actor, { ...f.action, noField: other.id });
  rejected(f.game, f.actor, { ...f.action, forces: { 'arrakeen:10': 1 } });
  rejected(f.game, f.actor, { ...f.action, planetologist: 'gather' });
  rejected(f.game, f.actor, { ...f.action, planetologist: { leader: f.trainer, mode: 'range' } });
  rejected(f.game, f.actor, { ...f.action, discoveryFlight: { event: 'foreign-flight' } });
  rejected(f.game, f.actor, { ...f.action, ornithopterEvent: 'foreign-card-movement' });
  assert.deepEqual(physical(f.game), f.originalPhysical);
  assert.deepEqual(player(f.game, f.actor).noField, f.originalNoField);
  assert.equal(player(f.game, f.actor).noFieldEvent, f.originalEvent);
  assert.deepEqual(inventory(f.game), f.originalInventory);
});

void test('controlled eligibility supplements deny No-Field extra range after the native trainer is dead or captured', () => {
  const f = fixture(); source(f);
  // These deliberately controlled eligibility inputs do not claim a played
  // death/capture chronology; the public positive sources above remain intact.
  for (const state of ['dead', 'captured'] as const) {
    const controlled = structuredClone(f.game), leader = player(controlled, f.actor).leaders.find(disc => disc.id === f.trainer)!;
    if (state === 'dead') leader.dead = true;
    else leader.capturedBy = f.observer;
    assert.equal(planetologistLeader(controlled, f.actor), null);
    rejected(controlled, f.actor, f.action);
  }
  assert.deepEqual(physical(f.game), f.originalPhysical);
});

void test('all four minimal policies offer a legal boosted original No-Field move', () => {
  for (const advanced of [false, true]) for (const value of [0, 3, 5] as const) {
    const f = fixture({ advanced, value }); source(f);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(f.game, f.actor);
      view.players.find(seat => seat.id === f.actor)!.bot = difficulty;
      const candidates = botActions(view).filter(action => action.type === 'move' &&
        action.planetologist === 'range' && action.noField === f.token.id);
      assert.ok(candidates.length, `${difficulty} offers an actual boosted concealed${value} candidate`);
      const action = candidates[0];
      assert.equal(typeof action.territory, 'string');
      assert.equal(typeof action.sector, 'number');
      const destination = { territory: action.territory as string, sector: action.sector as number };
      assert.deepEqual(action.forces, {});
      assert.equal(action.event, f.originalEvent);
      const me = view.players.find(seat => seat.id === f.actor)!;
      assert.equal(groundMoveRouteDistance(view, me, f.source, `${destination.territory}:${destination.sector}`), 2);
      const game = act(f.game, f.actor, action), after = player(game, f.actor);
      assert.equal(after.noField!.deployed!.tokenId, f.token.id);
      assert.deepEqual(after.noField!.deployed!.location, destination);
      assert.equal(after.noField!.lastShipped, f.token.id);
      assert.equal(after.reserves, player(f.game, f.actor).reserves);
      assert.equal(after.spice, player(f.game, f.actor).spice);
      assert.deepEqual(after.forces, player(f.game, f.actor).forces);
      assert.equal(after.moved, 1);
      assert.deepEqual(inventory(game), f.originalInventory);
    }
  }
});
