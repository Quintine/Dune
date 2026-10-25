import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { gameTerritories, location, splitLocation, territory } from '../game/board';
import { botEntryAllowed, botGroundMoveAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { presenceAt } from '../game/force-presence';
import { planetologistLeader } from '../game/planetologist-movement';
import type { NoFieldValue } from '../game/richese-no-field';
import { createSelectedDeckSkillsSetup, assertSelectedDeckSkillsInventory } from './fixture-selected-deck-skills';
import { nextChoamIndependentSkillsStep } from './fixture-choam-independent-skills';

export type PlanetologistNoFieldStep = { actor: string; action: Action };
export const planetologistNoFieldClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function planetologistNoFieldPlayer(game: Game, actor = 'richese') {
  const player = game.players.find(candidate => candidate.id === actor);
  assert.ok(player, `The original ${actor} seat must remain present`);
  return player;
}
export function planetologistNoFieldInventory(game: Game) {
  assertSelectedDeckSkillsInventory(game);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  return { treachery: cards.map(card => card.id).sort(),
    skills: [...game.leaderSkills!.deck, ...game.leaderSkills!.assignments.map(assignment => assignment.skill),
      ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards)].sort(),
    traitors: [...(game.traitorReserve ?? []), ...game.players.flatMap(player => player.traitors)].sort() };
}
/** The actual move spends no card, physical reserve or spice, including for0. */
export function planetologistNoFieldPhysical(game: Game) {
  return game.players.map(player => ({ id: player.id, spice: player.spice, reserves: player.reserves,
    tanks: player.tanks, forces: structuredClone(player.forces), elites: structuredClone(player.elites),
    leaders: structuredClone(player.leaders), hand: player.hand.map(card => card.id) }));
}
export function actPlanetologistNoField(game: Game, actor: string, action: Action,
  actions: PlanetologistNoFieldStep[] = []): Game {
  const next = applyAction(game, actor, action);
  actions.push({ actor, action: structuredClone(action) }); return next;
}
export function advancePlanetologistNoField(game: Game, until: (state: Game) => boolean,
  actions: PlanetologistNoFieldStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Planetologist/No-Field chronology ended before its owned boundary');
    const step = nextChoamIndependentSkillsStep(game);
    assert.ok(step, `Supply the real ${game.turn}/${game.phase}/${game.decision?.kind} control before continuing`);
    game = actPlanetologistNoField(game, step.actor, step.action, actions);
  }
  throw Error('The native Planetologist/No-Field chronology did not reach its finite boundary');
}

function destinations(game: Game, actor: string, source: string) {
  const view = viewGame(game, actor), me = view.players.find(player => player.id === actor)!;
  const emptyRocks = gameTerritories(game).filter(place => place.type === 'rock' &&
    place.id !== splitLocation(source).territory && !game.players.some(player => presenceAt(player, place.id)))
    .flatMap(place => place.sectors.map(sector => location(place.id, sector)));
  const targetLocation = emptyRocks.find(target => groundMoveRouteDistance(view, me, source, target) === 2 &&
    botGroundMoveAllowed(view, me, source, target, 0, 'range') && !botGroundMoveAllowed(view, me, source, target, 0));
  const tooFarLocation = emptyRocks.find(target => groundMoveRouteDistance(view, me, source, target) === 3 &&
    botEntryAllowed(view, me, splitLocation(target).territory, splitLocation(target).sector, 'move', splitLocation(source).territory));
  return targetLocation && tooFarLocation ? { targetLocation, tooFarLocation } : null;
}

/** Original public Basic/Advanced R/A/E +choam/Skills. The existing fixture selects only
 * initial unopened scalar/skill lotteries; every later step is a native action.
 * Optional companion1 is earned by an actual turn-one paid shipment, then the
 * original marker is really shipped beside it on turn two. No state is installed. */
export function createPlanetologistNoFieldFixture(options: { advanced?: boolean; value?: NoFieldValue; companions?: 0 | 1 } = {}) {
  const advanced = options.advanced ?? false, value = options.value ?? 5, companions = options.companions ?? 0;
  const setup = createSelectedDeckSkillsSetup({ advanced,
    factions: ['richese', 'atreides', 'emperor'], expansions: ['choam'], skill: 'planetologist' });
  const actor = setup.owner, actions: PlanetologistNoFieldStep[] = [...setup.actions];
  let game = structuredClone(setup.afterSetup);
  const act = (owner: string, action: Action) => { game = actPlanetologistNoField(game, owner, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advancePlanetologistNoField(game, until, actions); };
  const originalInventory = planetologistNoFieldInventory(game);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === actor && planetologistNoFieldClean(state));
  let source: string | null = null;
  for (const place of gameTerritories(game)) {
    if (place.type !== 'rock' || game.players.some(player => presenceAt(player, place.id))) continue;
    for (const sector of place.sectors) {
      if (sector < 6 || sector > 16 || sector === game.storm) continue;
      const candidate = location(place.id, sector);
      if (destinations(game, actor, candidate)) { source = candidate; break; }
    }
    if (source) break;
  }
  assert.ok(source, 'An empty non-city source must have ordinary legal distance-two and distance-three rock routes');
  const sourceLocation = splitLocation(source);
  let companionShipment: { before: Game; step: PlanetologistNoFieldStep; after: Game } | null = null;
  if (companions) {
    const before = structuredClone(game), step: PlanetologistNoFieldStep = { actor,
      action: { type: 'ship', ...sourceLocation, amount: companions, elite: 0, allyPayment: 0 } };
    act(actor, step.action); reach(planetologistNoFieldClean);
    companionShipment = { before, step, after: structuredClone(game) };
    reach(state => state.turn === 2 && state.phase === 5 && state.active === actor && planetologistNoFieldClean(state));
    assert.equal(planetologistNoFieldPlayer(game, actor).forces[source], companions,
      'The actual earlier shipment, rather than a staged pool, supplies the companion');
  }
  const me = planetologistNoFieldPlayer(game, actor), token = me.noField!.tokens.find(candidate => candidate.value === value);
  assert.ok(token); assert.equal(me.noField!.deployed, null);
  assert.ok(!me.forces['arrakeen:10'] && !me.forces['carthag:11'], 'No city ornithopter supplies the extra range');
  const beforeShipment = structuredClone(game), shipmentStep: PlanetologistNoFieldStep = { actor,
    action: { type: 'ship', noField: token.id, event: me.noFieldEvent, ...sourceLocation } };
  act(actor, shipmentStep.action); reach(planetologistNoFieldClean);
  const afterShipment = structuredClone(game), routes = destinations(game, actor, source);
  assert.ok(routes, 'The original post-shipment board retains the two bounded legal routes');
  assert.equal(planetologistNoFieldPlayer(beforeShipment, actor).spice - planetologistNoFieldPlayer(game, actor).spice, 2);
  assert.equal(planetologistNoFieldPlayer(game, actor).reserves, planetologistNoFieldPlayer(beforeShipment, actor).reserves);
  assert.equal(planetologistNoFieldPlayer(game, actor).moved, 0);
  assert.equal(planetologistNoFieldPlayer(game, actor).noField!.deployed!.tokenId, token.id);
  const trainer = planetologistLeader(game, actor); assert.ok(trainer);
  const target = splitLocation(routes.targetLocation), tooFar = splitLocation(routes.tooFarLocation);
  const forces = companions ? { [source]: companions } : {};
  const action: Action = { type: 'move', planetologist: 'range', forces, noField: token.id,
    event: planetologistNoFieldPlayer(game, actor).noFieldEvent, ...target };
  const ordinary: Action = { ...action }; delete ordinary.planetologist;
  const tooFarAction: Action = { ...action, ...tooFar };
  assert.equal(territory(sourceLocation.territory).type, 'rock');
  assert.deepEqual(planetologistNoFieldInventory(game), originalInventory);
  return { game, sourceGame: structuredClone(game), initial: setup.initial, started: setup.started,
    offered: setup.offered, afterSetup: setup.afterSetup, setup, actor, owner: actor, richese: actor,
    observer: setup.seats.emperor!, opponent: setup.seats.atreides!, advanced, value, token: structuredClone(token), trainer,
    source, sourceLocation, target, targetLocation: routes.targetLocation, tooFar, tooFarLocation: routes.tooFarLocation,
    action, ordinary, tooFarAction, companions, forces, companionShipment, beforeShipment, shipmentStep, afterShipment,
    originalInventory, originalPhysical: planetologistNoFieldPhysical(game),
    originalNoField: structuredClone(planetologistNoFieldPlayer(game, actor).noField!),
    originalEvent: planetologistNoFieldPlayer(game, actor).noFieldEvent!,
    endMovement: { type: 'endMovement' } satisfies Action,
    actions, sourceActionCount: actions.length,
    staging: [...setup.staging,
      'Original public Basic/Advanced Richese/Atreides/Emperor +choam/Leader Skills module, ready/start, original Treachery/Traitor deals and real private skill training. Only the existing original unopened skill/scalar lotteries are selected; no played card, force, wallet, leader, marker, phase or receipt is installed. Advanced remains preview evidence.',
      companions ? 'An actual first-turn paid one-force shipment creates the physical companion on empty non-city rock. Native end-turn, Storm, Spice, Charity, Bidding and Revival controls reach turn two, then an actual concealed No-Field shipment joins that same source.'
        : 'Native first Storm, Spice, Charity, Bidding and Revival controls reach the first Richese movement turn. An actual paid concealed0/3/5 shipment parks its original token on empty non-city rock without withdrawing physical reserves.',
      'Stop before the actual distance-two Planetologist range action. The same empty board offers a distance-three rejection without city ornithopters. Token movement, event rotation, one movement allowance and later end-turn continuation remain caller-owned outcomes.',
    ] };
}
export type PlanetologistNoFieldFixture = ReturnType<typeof createPlanetologistNoFieldFixture>;
export function movePlanetologistNoField(fixture: PlanetologistNoFieldFixture,
  game = structuredClone(fixture.game), actions: PlanetologistNoFieldStep[] = []) {
  return actPlanetologistNoField(game, fixture.actor, fixture.action, actions);
}
export function finishPlanetologistNoField(fixture: PlanetologistNoFieldFixture, game: Game,
  actions: PlanetologistNoFieldStep[] = []) {
  assert.equal(game.turn, fixture.game.turn);
  return advancePlanetologistNoField(game, state => state.turn === fixture.game.turn &&
    state.phase === 7 && planetologistNoFieldClean(state), actions);
}
