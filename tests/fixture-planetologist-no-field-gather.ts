import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { gameTerritories, location, splitLocation } from '../game/board';
import { botGroundMoveAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { presenceAt } from '../game/force-presence';
import { planetologistLeader } from '../game/planetologist-movement';
import type { NoFieldValue } from '../game/richese-no-field';
import { createSelectedDeckSkillsSetup } from './fixture-selected-deck-skills';
import {
  actPlanetologistNoField, advancePlanetologistNoField, planetologistNoFieldClean,
  planetologistNoFieldInventory, planetologistNoFieldPhysical, planetologistNoFieldPlayer,
  type PlanetologistNoFieldStep,
} from './fixture-planetologist-no-field';

export type PlanetologistNoFieldGatherStep = PlanetologistNoFieldStep;
export const actPlanetologistNoFieldGather = actPlanetologistNoField;
export const advancePlanetologistNoFieldGather = advancePlanetologistNoField;
export const planetologistNoFieldGatherClean = planetologistNoFieldClean;
export const planetologistNoFieldGatherInventory = planetologistNoFieldInventory;
export const planetologistNoFieldGatherPhysical = planetologistNoFieldPhysical;
export const planetologistNoFieldGatherPlayer = planetologistNoFieldPlayer;

function gatherRoutes(game: Game, actor: string, physicalSource: string, markerSource: string) {
  const view = viewGame(game, actor), me = view.players.find(player => player.id === actor)!;
  const fromTerritories = [physicalSource, markerSource].map(source => splitLocation(source).territory);
  const emptyRocks = gameTerritories(game).filter(place => place.type === 'rock' &&
    !fromTerritories.includes(place.id) && !game.players.some(player => presenceAt(player, place.id)))
    .flatMap(place => place.sectors.map(sector => location(place.id, sector)));
  const targetLocation = emptyRocks.find(target => [physicalSource, markerSource].every(source =>
    groundMoveRouteDistance(view, me, source, target) === 1 && botGroundMoveAllowed(view, me, source, target, 0, 'gather')));
  const tooFarLocation = emptyRocks.find(target => [physicalSource, markerSource].every(source =>
    botGroundMoveAllowed(view, me, source, target, 0, 'range')) && [physicalSource, markerSource].some(source =>
    groundMoveRouteDistance(view, me, source, target) === 2));
  return targetLocation && tooFarLocation ? { targetLocation, tooFarLocation } : null;
}

/** Genuine public R/A/E +choam/Skills. First-turn paid physical shipment and
 * optional ordinary split precede a real turn-two marker shipment to a second
 * origin. No played cards, counters, wallets, markers or phases are installed. */
export function createPlanetologistNoFieldGatherFixture(options: {
  advanced?: boolean; value?: NoFieldValue; withMarkerCompanion?: boolean;
} = {}) {
  const advanced = options.advanced ?? false, value = options.value ?? 5;
  const withMarkerCompanion = options.withMarkerCompanion ?? false;
  const setup = createSelectedDeckSkillsSetup({ advanced, factions: ['richese', 'atreides', 'emperor'],
    expansions: ['choam'], skill: 'planetologist' });
  const actor = setup.owner, actions: PlanetologistNoFieldGatherStep[] = [...setup.actions];
  let game = structuredClone(setup.afterSetup);
  const act = (owner: string, action: Action) => { game = actPlanetologistNoFieldGather(game, owner, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advancePlanetologistNoFieldGather(game, until, actions); };
  const originalInventory = planetologistNoFieldGatherInventory(game);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === actor && planetologistNoFieldGatherClean(state));
  const view = viewGame(game, actor), me = view.players.find(player => player.id === actor)!;
  const rocks = gameTerritories(game).filter(place => place.type === 'rock' &&
    !game.players.some(player => presenceAt(player, place.id)))
    .flatMap(place => place.sectors.filter(sector => sector >= 7 && sector <= 16 && sector !== game.storm)
      .map(sector => location(place.id, sector)));
  let geometry: { physicalSource: string; markerSource: string } | null = null;
  for (const physicalSource of rocks) {
    for (const markerSource of rocks) {
      if (splitLocation(physicalSource).territory === splitLocation(markerSource).territory ||
          groundMoveRouteDistance(view, me, physicalSource, markerSource) !== 1 ||
          !botGroundMoveAllowed(view, me, physicalSource, markerSource, 0) ||
          !gatherRoutes(game, actor, physicalSource, markerSource)) continue;
      geometry = { physicalSource, markerSource }; break;
    }
    if (geometry) break;
  }
  assert.ok(geometry, 'Choose two empty adjacent rock origins with a shared normal-range rock destination');
  const { physicalSource, markerSource } = geometry;
  const physicalSourceLocation = splitLocation(physicalSource), sourceLocation = splitLocation(markerSource);
  const amount = withMarkerCompanion ? 2 : 1;
  const beforePhysicalShipment = structuredClone(game), physicalShipmentStep: PlanetologistNoFieldGatherStep = { actor,
    action: { type: 'ship', ...physicalSourceLocation, amount, elite: 0, allyPayment: 0 } };
  act(actor, physicalShipmentStep.action); reach(planetologistNoFieldGatherClean);
  const physicalShipment = { before: beforePhysicalShipment, step: physicalShipmentStep, after: structuredClone(game) };
  assert.equal(planetologistNoFieldGatherPlayer(beforePhysicalShipment, actor).spice -
    planetologistNoFieldGatherPlayer(game, actor).spice, amount * 2);
  let splitMovement: { before: Game; step: PlanetologistNoFieldGatherStep; after: Game } | null = null;
  if (withMarkerCompanion) {
    const before = structuredClone(game), step: PlanetologistNoFieldGatherStep = { actor,
      action: { type: 'move', from: physicalSource, amount: 1, elite: 0, ...sourceLocation } };
    act(actor, step.action); reach(planetologistNoFieldGatherClean);
    splitMovement = { before, step, after: structuredClone(game) };
    assert.equal(planetologistNoFieldGatherPlayer(game, actor).forces[physicalSource], 1);
    assert.equal(planetologistNoFieldGatherPlayer(game, actor).forces[markerSource], 1);
  }
  const afterFirstPreparation = structuredClone(game);
  let charity: { before: Game; step: PlanetologistNoFieldGatherStep; after: Game } | null = null;
  if (withMarkerCompanion) {
    reach(state => state.turn === 2 && state.phase === 2 && planetologistNoFieldGatherClean(state));
    const before = structuredClone(game), step: PlanetologistNoFieldGatherStep = { actor, action: { type: 'charity' } };
    assert.equal(planetologistNoFieldGatherPlayer(game, actor).spice, 1);
    act(actor, step.action); reach(planetologistNoFieldGatherClean);
    charity = { before, step, after: structuredClone(game) };
    assert.equal(planetologistNoFieldGatherPlayer(game, actor).spice, 2);
  }
  reach(state => state.turn === 2 && state.phase === 5 && state.active === actor && planetologistNoFieldGatherClean(state));
  const current = planetologistNoFieldGatherPlayer(game, actor);
  assert.equal(current.forces[physicalSource], 1);
  assert.equal(current.forces[markerSource] ?? 0, Number(withMarkerCompanion));
  assert.equal(current.moved, 0); assert.equal(current.shipped, false);
  if (withMarkerCompanion) {
    assert.equal(planetologistNoFieldGatherPlayer(afterFirstPreparation, actor).spice, 1);
    assert.equal(current.spice, 2, 'Real next-turn charity funds the second paid shipment');
  }
  const token = current.noField!.tokens.find(candidate => candidate.value === value); assert.ok(token);
  assert.equal(current.noField!.deployed, null);
  const beforeShipment = structuredClone(game), shipmentStep: PlanetologistNoFieldGatherStep = { actor,
    action: { type: 'ship', noField: token.id, event: current.noFieldEvent, ...sourceLocation } };
  act(actor, shipmentStep.action); reach(planetologistNoFieldGatherClean);
  const afterShipment = structuredClone(game), routes = gatherRoutes(game, actor, physicalSource, markerSource);
  assert.ok(routes, 'The real second-turn board retains both normal gather routes and the non-stacking negative');
  assert.equal(planetologistNoFieldGatherPlayer(beforeShipment, actor).spice - planetologistNoFieldGatherPlayer(game, actor).spice, 2);
  assert.equal(planetologistNoFieldGatherPlayer(beforeShipment, actor).reserves, planetologistNoFieldGatherPlayer(game, actor).reserves);
  const trainer = planetologistLeader(game, actor); assert.ok(trainer);
  const forces: Record<string, number> = { [physicalSource]: 1, ...(withMarkerCompanion ? { [markerSource]: 1 } : {}) };
  const target = splitLocation(routes.targetLocation), tooFar = splitLocation(routes.tooFarLocation);
  const action: Action = { type: 'move', planetologist: 'gather', forces,
    noField: token.id, event: planetologistNoFieldGatherPlayer(game, actor).noFieldEvent, ...target };
  const tooFarAction: Action = { ...action, ...tooFar };
  assert.deepEqual(planetologistNoFieldGatherInventory(game), originalInventory);
  return { game, sourceGame: structuredClone(game), initial: setup.initial, started: setup.started,
    offered: setup.offered, afterSetup: setup.afterSetup, setup, actor, owner: actor, richese: actor,
    observer: setup.seats.emperor!, opponent: setup.seats.atreides!, advanced, value,
    token: structuredClone(token), trainer, source: markerSource, markerSource, physicalSource,
    sourceLocation, physicalSourceLocation, target, targetLocation: routes.targetLocation,
    tooFar, tooFarLocation: routes.tooFarLocation, tooFarAction, action, forces,
    withMarkerCompanion, companions: Number(withMarkerCompanion), amount,
    physicalShipment, normalShipment: physicalShipment, splitMovement, afterFirstPreparation, charity, charityClaim: charity,
    beforeShipment, shipmentStep, afterShipment, markerShipment: { before: beforeShipment, step: shipmentStep, after: afterShipment },
    originalInventory, originalPhysical: planetologistNoFieldGatherPhysical(game),
    originalNoField: structuredClone(planetologistNoFieldGatherPlayer(game, actor).noField!),
    originalEvent: planetologistNoFieldGatherPlayer(game, actor).noFieldEvent!,
    endMovement: { type: 'endMovement' } satisfies Action,
    actions, sourceActionCount: actions.length,
    staging: [...setup.staging,
      'Original public Basic/Advanced Richese/Atreides/Emperor +choam/Leader Skills setup and actual private Planetologist training. Only the existing original unopened skill/scalar lotteries are selected; no played card, force, wallet, leader, marker, clock or receipt is installed. Advanced remains preview evidence.',
      withMarkerCompanion ? 'Actual turn-one two-force shipment costs4. One real ordinary range-one movement leaves one physical counter at each adjacent rock origin. Native turn progression stops at actual turn-two Charity, where Richese explicitly claims its original charity action to raise wallet1 to2, funding the actual concealed-marker shipment beside its companion.'
        : 'Actual turn-one one-force shipment costs2 and remains at its rock origin. Native end-turn and second Storm/Spice/Charity/Bidding/Revival controls precede the actual turn-two concealed0/3/5 shipment to a different empty rock origin for2.',
      'Both real origins reach one shared empty rock destination using ordinary range1. Stop before the actual gather action; token/event, all selected physical counters, one current movement and original Collection continuation remain caller-owned outcomes. A separate range2 destination is illegal for gather because the +1 branch does not stack.',
    ] };
}
export type PlanetologistNoFieldGatherFixture = ReturnType<typeof createPlanetologistNoFieldGatherFixture>;
export function movePlanetologistNoFieldGather(fixture: PlanetologistNoFieldGatherFixture,
  game = structuredClone(fixture.game), actions: PlanetologistNoFieldGatherStep[] = []) {
  return actPlanetologistNoFieldGather(game, fixture.actor, fixture.action, actions);
}
export function finishPlanetologistNoFieldGather(fixture: PlanetologistNoFieldGatherFixture, game: Game,
  actions: PlanetologistNoFieldGatherStep[] = []) {
  assert.equal(game.turn, fixture.game.turn);
  return advancePlanetologistNoFieldGather(game, state => state.turn === fixture.game.turn &&
    state.phase === 7 && planetologistNoFieldGatherClean(state), actions);
}
