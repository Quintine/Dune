import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { location, splitLocation, territory } from '../game/board';
import { botGroundMoveAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { planetologistLeader } from '../game/planetologist-movement';
import { presenceAt } from '../game/force-presence';
import {
  actPlanetologistNoFieldGather as act, createPlanetologistNoFieldGatherFixture as fixture,
  finishPlanetologistNoFieldGather as finish, movePlanetologistNoFieldGather as move,
  planetologistNoFieldGatherInventory as inventory, planetologistNoFieldGatherPhysical as physical,
  planetologistNoFieldGatherPlayer as player, type PlanetologistNoFieldGatherFixture,
} from './fixture-planetologist-no-field-gather';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function source(f: PlanetologistNoFieldGatherFixture) {
  assert.equal(f.game.status, 'playing'); assert.equal(f.game.advanced, f.advanced);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.actor);
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
  assert.equal(f.physicalShipment.before.turn, 1);
  assert.equal(f.physicalShipment.step.action.type, 'ship');
  assert.equal(f.physicalShipment.step.action.amount, f.amount);
  assert.equal(player(f.physicalShipment.before, f.actor).spice - player(f.physicalShipment.after, f.actor).spice, f.amount * 2);
  assert.equal(player(f.physicalShipment.before, f.actor).reserves - player(f.physicalShipment.after, f.actor).reserves, f.amount);
  assert.equal(player(f.game, f.actor).forces[f.physicalSource], 1);
  assert.equal(player(f.game, f.actor).forces[f.markerSource] ?? 0, Number(f.withMarkerCompanion));
  assert.notEqual(f.sourceLocation.territory, f.physicalSourceLocation.territory);
  assert.equal(territory(f.sourceLocation.territory).type, 'rock');
  assert.equal(territory(f.physicalSourceLocation.territory).type, 'rock');
  assert.equal(territory(f.target.territory).type, 'rock');
  assert.equal(f.beforeShipment.turn, 2);
  assert.equal(f.shipmentStep.action.type, 'ship'); assert.equal(f.shipmentStep.action.noField, f.token.id);
  assert.equal(player(f.beforeShipment, f.actor).spice - player(f.game, f.actor).spice, 2);
  assert.equal(player(f.beforeShipment, f.actor).reserves, player(f.game, f.actor).reserves);
  assert.equal(player(f.game, f.actor).reserves, 20 - f.amount);
  assert.equal(player(f.game, f.actor).noField!.deployed!.tokenId, f.token.id);
  assert.equal(player(f.game, f.actor).noField!.lastShipped, f.token.id);
  assert.deepEqual(player(f.game, f.actor).noField!.deployed!.location, f.sourceLocation);
  assert.equal(player(f.game, f.actor).noField!.tokens.find(token => token.id === f.token.id)!.value, f.value);
  assert.equal(Object.hasOwn(f.action, 'origins'), false, 'The server normalizes marker-first origins from actual pieces');
  const view = viewGame(f.game, f.actor), me = view.players.find(seat => seat.id === f.actor)!;
  for (const from of [f.markerSource, f.physicalSource]) {
    assert.equal(groundMoveRouteDistance(view, me, from, f.targetLocation), 1);
    assert.equal(botGroundMoveAllowed(view, me, from, f.targetLocation, 0, 'gather'), true);
    assert.equal(botGroundMoveAllowed(view, me, from, f.tooFarLocation, 0, 'range'), true);
  }
  assert.ok([f.markerSource, f.physicalSource].some(from =>
    groundMoveRouteDistance(view, me, from, f.tooFarLocation) === 2 &&
    !botGroundMoveAllowed(view, me, from, f.tooFarLocation, 0, 'gather')));
  if (f.withMarkerCompanion) {
    assert.ok(f.splitMovement);
    assert.equal(f.splitMovement.before.turn, 1);
    assert.equal(f.splitMovement.step.action.type, 'move');
    assert.equal(f.splitMovement.step.action.planetologist, undefined);
    assert.equal(player(f.splitMovement.after, f.actor).moved, 1);
    assert.equal(player(f.splitMovement.after, f.actor).forces[f.physicalSource], 1);
    assert.equal(player(f.splitMovement.after, f.actor).forces[f.markerSource], 1);
    assert.equal(player(f.afterFirstPreparation, f.actor).spice, 1);
    assert.ok(f.charity);
    assert.equal(f.charity.before.turn, 2); assert.equal(f.charity.before.phase, 2);
    assert.equal(f.charity.step.actor, f.actor); assert.equal(f.charity.step.action.type, 'charity');
    assert.equal(player(f.charity.before, f.actor).spice, 1);
    assert.equal(player(f.charity.after, f.actor).spice, 2);
    assert.deepEqual(player(f.charity.before, f.actor).forces, player(f.charity.after, f.actor).forces);
    assert.equal(player(f.beforeShipment, f.actor).spice, 2, 'The played second-turn charity funds the marker shipment');
  } else { assert.equal(f.splitMovement, null); assert.equal(f.charity, null); }
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function moved(f: PlanetologistNoFieldGatherFixture, game: Game) {
  const before = player(f.game, f.actor), after = player(game, f.actor);
  assert.deepEqual(after.noField!.tokens, f.originalNoField.tokens);
  assert.equal(after.noField!.lastShipped, f.originalNoField.lastShipped);
  assert.deepEqual(after.noField!.deployed, { ...f.originalNoField.deployed!, location: f.target });
  assert.notEqual(after.noFieldEvent, f.originalEvent);
  assert.equal(after.moved, before.moved + 1); assert.equal(after.shipped, true);
  assert.equal(after.reserves, before.reserves); assert.equal(after.tanks, before.tanks);
  assert.equal(after.spice, before.spice);
  assert.equal(after.forces[f.physicalSource] ?? 0, 0); assert.equal(after.forces[f.markerSource] ?? 0, 0);
  assert.equal(after.forces[f.targetLocation], f.amount);
  assert.equal(presenceAt(after, f.target.territory), f.amount + 1,
    'Only the original selected counters and one concealed marker gather; no denomination materializes');
  assert.equal(planetologistLeader(game, f.actor), f.trainer);
  assert.deepEqual(game.leaderSkills, f.game.leaderSkills);
  assert.deepEqual(after.leaders, before.leaders); assert.deepEqual(after.hand, before.hand);
  const observed = viewGame(game, f.observer).richeseNoField!;
  assert.equal(observed.private, null);
  assert.deepEqual(observed.public.deployed, { controller: f.actor, location: f.target, effectiveForces: 1 });
  const chronicle = game.log.slice(f.game.log.length).find(entry => entry.text.includes('moved a concealed No-Field'));
  assert.ok(chronicle);
  assert.ok(chronicle.text.includes(`from ${territory(f.sourceLocation.territory).name} and ${territory(f.physicalSourceLocation.territory).name} to ${territory(f.target.territory).name}`),
    'The real chronicle identifies both normalized origins in their original marker-first order');
  assert.ok(chronicle.text.endsWith('Its value remains concealed.'));
  assert.deepEqual(inventory(game), f.originalInventory);
}

for (const advanced of [false, true]) for (const value of [0, 3, 5] as const) for (const withMarkerCompanion of [false, true]) {
  void test(`public ${advanced ? 'Advanced' : 'Basic'} concealed${value} ${withMarkerCompanion ? 'with an earned marker companion' : 'and a remote physical counter'} gathers two original origins once`, () => {
    const f = fixture({ advanced, value, withMarkerCompanion }); source(f);
    rejected(f.game, f.actor, f.tooFarAction);
    rejected(f.game, f.actor, { ...f.action, planetologist: 'range' });
    const ordinary: Action = { ...f.action }; delete ordinary.planetologist;
    rejected(f.game, f.actor, ordinary);
    const before = structuredClone(f.game);
    let game = move(f);
    assert.deepEqual(f.game, before); moved(f, game);
    const wallets = game.players.map(seat => seat.spice);
    assert.deepEqual(wallets, f.game.players.map(seat => seat.spice));
    rejected(game, f.actor, f.action);
    const relocated = structuredClone(player(game, f.actor).noField), event = player(game, f.actor).noFieldEvent;
    const continuation: { actor: string; action: Action }[] = [];
    game = finish(f, game, continuation);
    assert.equal(game.turn, 2); assert.equal(game.phase, 7);
    assert.ok(continuation.some(step => step.actor === f.actor && step.action.type === 'endMovement'));
    moved(f, game);
    assert.deepEqual(player(game, f.actor).noField, relocated);
    assert.equal(player(game, f.actor).noFieldEvent, event);
  });
}

void test('native marker gather rejects stale, foreign and malformed origin selections before moving either source', () => {
  const f = fixture({ withMarkerCompanion: true }); source(f);
  rejected(f.game, f.opponent, f.action);
  rejected(f.game, f.actor, { ...f.action, event: 'stale-native-marker-event' });
  const other = player(f.game, f.actor).noField!.tokens.find(token => token.id !== f.token.id)!;
  rejected(f.game, f.actor, { ...f.action, noField: other.id });
  rejected(f.game, f.actor, { ...f.action, forces: {} });
  rejected(f.game, f.actor, { ...f.action, forces: { [f.markerSource]: 1 } });
  const physicalOnly: Action = { ...f.action, forces: { [f.physicalSource]: 1 } };
  delete physicalOnly.noField; delete physicalOnly.event;
  rejected(f.game, f.actor, physicalOnly);
  rejected(f.game, f.actor, { ...f.action, origins: [f.sourceLocation.territory, f.physicalSourceLocation.territory] });
  rejected(f.game, f.actor, { ...f.action, forces: { ...f.forces, 'arrakeen:10': 1 } });
  rejected(f.game, f.actor, { ...f.action, discoveryFlight: { event: 'foreign-flight' } });
  rejected(f.game, f.actor, { ...f.action, ornithopterEvent: 'foreign-card-movement' });
  assert.deepEqual(physical(f.game), f.originalPhysical);
  assert.deepEqual(player(f.game, f.actor).noField, f.originalNoField);
  assert.equal(player(f.game, f.actor).noFieldEvent, f.originalEvent);
  assert.deepEqual(inventory(f.game), f.originalInventory);
});

void test('controlled eligibility and third-origin supplements cannot bypass the original gather bounds', () => {
  const f = fixture(); source(f);
  // These labelled controlled inputs do not claim played death/capture or a
  // third paid shipment. All twelve native positive sources above are unstaged.
  for (const state of ['dead', 'captured'] as const) {
    const controlled = structuredClone(f.game), leader = player(controlled, f.actor).leaders.find(disc => disc.id === f.trainer)!;
    if (state === 'dead') leader.dead = true;
    else leader.capturedBy = f.observer;
    assert.equal(planetologistLeader(controlled, f.actor), null);
    rejected(controlled, f.actor, f.action);
  }
  const three = structuredClone(f.game), owner = player(three, f.actor);
  owner.reserves--; owner.forces[f.tooFarLocation] = 1;
  assert.equal(owner.reserves + owner.tanks + Object.values(owner.forces).reduce((sum, count) => sum + count, 0), 20);
  rejected(three, f.actor, { ...f.action, forces: { ...f.forces, [f.tooFarLocation]: 1 } });
  assert.deepEqual(physical(f.game), f.originalPhysical);
});

void test('all four minimal profiles offer a legal original marker plus remote-counter gather', () => {
  for (const advanced of [false, true]) for (const value of [0, 3, 5] as const) {
    const f = fixture({ advanced, value }); source(f);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(f.game, f.actor);
      view.players.find(seat => seat.id === f.actor)!.bot = difficulty;
      const candidates = botActions(view).filter(action => action.type === 'move' &&
        action.planetologist === 'gather' && action.noField === f.token.id);
      assert.ok(candidates.length, `${difficulty} offers an actual concealed${value} two-origin gather`);
      const action = candidates[0];
      assert.equal(typeof action.territory, 'string'); assert.equal(typeof action.sector, 'number');
      const destination = { territory: action.territory as string, sector: action.sector as number };
      const destinationLocation = location(destination.territory, destination.sector);
      assert.deepEqual(action.forces, { [f.physicalSource]: 1 });
      assert.equal(Object.hasOwn(action, 'origins'), false); assert.equal(action.event, f.originalEvent);
      const me = view.players.find(seat => seat.id === f.actor)!;
      for (const from of [f.markerSource, f.physicalSource])
        assert.equal(botGroundMoveAllowed(view, me, from, destinationLocation, 0, 'gather'), true);
      const game = act(f.game, f.actor, action), after = player(game, f.actor);
      assert.equal(after.noField!.deployed!.tokenId, f.token.id);
      assert.deepEqual(after.noField!.deployed!.location, destination);
      assert.equal(after.noField!.lastShipped, f.token.id);
      assert.equal(after.reserves, player(f.game, f.actor).reserves);
      assert.equal(after.spice, player(f.game, f.actor).spice);
      assert.equal(after.forces[f.physicalSource] ?? 0, 0);
      assert.equal(after.forces[destinationLocation], 1);
      assert.equal(after.moved, 1);
      assert.deepEqual(inventory(game), f.originalInventory);
      assert.notEqual(splitLocation(f.physicalSource).territory, f.sourceLocation.territory);
    }
  }
});
