import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { gameTerritories, location, splitLocation } from '../game/board';
import { botEntryAllowed, botGroundMoveAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { presenceAt } from '../game/force-presence';
import { planetologistLeader, type PlanetologistMoveMode } from '../game/planetologist-movement';
import type { OrnithopterMode } from '../game/ornithopter';
import { createSelectedDeckSkillsSetup } from './fixture-selected-deck-skills';
import { nextChoamIndependentSkillsStep } from './fixture-choam-independent-skills';

export const PLANETOLOGIST_ORNITHOPTER = 'richese-ornithopter';
export type PlanetologistOrnithopterStep = { actor: string; action: Action };
export type PlanetologistOrnithopterOptions = {
  advanced?: boolean;
  mode?: OrnithopterMode;
  planetologist?: PlanetologistMoveMode;
  secondPlanetologist?: PlanetologistMoveMode;
};
export const planetologistOrnithopterClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function planetologistOrnithopterPlayer(game: Game, actor = 'emperor') {
  const player = game.players.find(candidate => candidate.id === actor);
  assert.ok(player, `The original ${actor} seat must remain present`); return player;
}
/** Includes the original physical card's live played zone between groups. */
export function planetologistOrnithopterInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.ornithopter ? [game.ornithopter.card] : []),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  const treachery = cards.map(card => card.id).sort();
  assert.equal(new Set(treachery).size, treachery.length, 'Each original Treachery Card keeps one physical slot');
  return { treachery,
    skills: [...game.leaderSkills!.deck, ...game.leaderSkills!.assignments.map(assignment => assignment.skill),
      ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards)].sort(),
    traitors: [...(game.traitorReserve ?? []), ...game.players.flatMap(player => player.traitors)].sort() };
}
export function planetologistOrnithopterStocks(game: Game) {
  return game.players.map(player => ({ id: player.id, spice: player.spice, reserves: player.reserves,
    tanks: player.tanks, physical: Object.values(player.forces).reduce((sum, count) => sum + count, 0),
    eliteReserves: player.elites?.reserves ?? 0, eliteTanks: player.elites?.tanks ?? 0,
    elites: Object.values(player.elites?.forces ?? {}).reduce((sum, count) => sum + count, 0),
    leaders: structuredClone(player.leaders) }));
}
export function planetologistOrnithopterDestination(action: Action) {
  assert.equal(typeof action.territory, 'string'); assert.equal(typeof action.sector, 'number');
  return location(action.territory as string, action.sector as number);
}
export function actPlanetologistOrnithopter(game: Game, actor: string, action: Action,
  actions: PlanetologistOrnithopterStep[] = []) {
  const next = applyAction(game, actor, action);
  actions.push({ actor, action: structuredClone(action) }); return next;
}
function nextPlanetologistOrnithopterStep(game: Game): PlanetologistOrnithopterStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'richeseCache' && game.richeseCache?.some(card => card.id === PLANETOLOGIST_ORNITHOPTER))
      return { actor: decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: PLANETOLOGIST_ORNITHOPTER, method: 'onceAround', direction: 'clockwise' } };
    if (!decision && game.richeseAuction?.cardId === PLANETOLOGIST_ORNITHOPTER &&
        !game.richeseAuction.outcome && game.richeseAuction.active === 'emperor' && game.richeseAuction.bid === 0)
      return { actor: 'emperor', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  }
  return nextChoamIndependentSkillsStep(game);
}
export function advancePlanetologistOrnithopter(game: Game, until: (state: Game) => boolean,
  actions: PlanetologistOrnithopterStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Planetologist/card chronology ended before its owned boundary');
    const step = nextPlanetologistOrnithopterStep(game);
    assert.ok(step, `Supply the real ${game.turn}/${game.phase}/${game.decision?.kind} control before continuing`);
    game = actPlanetologistOrnithopter(game, step.actor, step.action, actions);
  }
  throw Error('The native Planetologist/Ornithopter chronology did not reach its finite boundary');
}

function destinations(game: Game, actor: string, origins: readonly string[], distance: number,
  empty = true, rocksOnly = true) {
  const view = viewGame(game, actor), me = view.players.find(player => player.id === actor)!;
  return gameTerritories(game).filter(place => (place.type === 'rock' || (!rocksOnly && place.type === 'sand')) &&
    !origins.some(source => splitLocation(source).territory === place.id) &&
    (!empty || !game.players.some(player => presenceAt(player, place.id))))
    .flatMap(place => place.sectors.map(sector => location(place.id, sector)))
    .filter(target => origins.every(source => botEntryAllowed(view, me, splitLocation(target).territory,
      splitLocation(target).sector, 'move', splitLocation(source).territory)))
    .filter(target => {
      const distances = origins.map(source => groundMoveRouteDistance(view, me, source, target));
      return distances.every(value => Number.isFinite(value) && value <= distance) && Math.max(...distances) === distance;
    });
}
function firstRoute(game: Game, actor: string, sourceA: string, sourceB: string,
  mode: OrnithopterMode, skill: PlanetologistMoveMode) {
  const origins = skill === 'gather' ? [sourceA, sourceB] : [sourceA];
  const range = mode === 'range3' ? 3 : skill === 'range' ? 2 : 1;
  const target = destinations(game, actor, origins, range)[0];
  const tooFar = destinations(game, actor, origins, range + 1, true, false)[0];
  return target && tooFar ? { target, tooFar } : null;
}

/** Original public E/R/A, real living trainer, paid cache1 purchase, original
 * funded shipment4 for8 and ordinary split2 earn A2/B2 on turn two. No held
 * card, force, wallet, clock, training assignment or flight is installed. */
export function createPlanetologistOrnithopterFixture(options: PlanetologistOrnithopterOptions = {}) {
  const advanced = options.advanced ?? false, mode = options.mode ?? 'twoGroups';
  const planetologist = options.planetologist ?? 'gather', secondPlanetologist = options.secondPlanetologist ?? planetologist;
  const setup = createSelectedDeckSkillsSetup({ advanced, factions: ['emperor', 'richese', 'atreides'],
    expansions: ['choam'], skill: 'planetologist' });
  const actor = setup.owner, actions: PlanetologistOrnithopterStep[] = [...setup.actions];
  let game = structuredClone(setup.afterSetup);
  const act = (owner: string, action: Action) => { game = actPlanetologistOrnithopter(game, owner, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advancePlanetologistOrnithopter(game, until, actions); };
  const originalInventory = planetologistOrnithopterInventory(game);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'richeseCache' &&
    !!state.richeseCache?.some(card => card.id === PLANETOLOGIST_ORNITHOPTER));
  const beforeAcquisition = structuredClone(game), acquisitionStart = actions.length;
  reach(state => planetologistOrnithopterClean(state) &&
    planetologistOrnithopterPlayer(state, actor).hand.some(card => card.id === PLANETOLOGIST_ORNITHOPTER));
  const acquisition = { before: beforeAcquisition, steps: structuredClone(actions.slice(acquisitionStart)), after: structuredClone(game) };
  assert.equal(planetologistOrnithopterPlayer(beforeAcquisition, actor).spice - planetologistOrnithopterPlayer(game, actor).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === actor && planetologistOrnithopterClean(state));
  const view = viewGame(game, actor), me = view.players.find(player => player.id === actor)!;
  const rocks = gameTerritories(game).filter(place => place.type === 'rock' &&
    !game.players.some(player => presenceAt(player, place.id)))
    .flatMap(place => place.sectors.filter(sector => sector >= 7 && sector <= 16 && sector !== game.storm)
      .map(sector => location(place.id, sector)));
  let geometry: { sourceA: string; sourceB: string } | null = null;
  for (const sourceA of rocks) {
    for (const sourceB of rocks) {
      if (splitLocation(sourceA).territory === splitLocation(sourceB).territory ||
          groundMoveRouteDistance(view, me, sourceA, sourceB) !== 1 || !botGroundMoveAllowed(view, me, sourceA, sourceB, 0) ||
          !firstRoute(game, actor, sourceA, sourceB, mode, planetologist) ||
          !destinations(game, actor, [sourceA, sourceB], 1).length) continue;
      geometry = { sourceA, sourceB }; break;
    }
    if (geometry) break;
  }
  assert.ok(geometry, 'Actual empty rock origins must support the selected card range and two-origin programme');
  const { sourceA, sourceB } = geometry;
  const beforeShipment = structuredClone(game), shipmentStep: PlanetologistOrnithopterStep = { actor,
    action: { type: 'ship', ...splitLocation(sourceA), amount: 4, elite: 0, allyPayment: 0 } };
  act(actor, shipmentStep.action); reach(planetologistOrnithopterClean);
  const shipment = { before: beforeShipment, step: shipmentStep, after: structuredClone(game) };
  assert.equal(planetologistOrnithopterPlayer(beforeShipment, actor).spice - planetologistOrnithopterPlayer(game, actor).spice, 8);
  const beforeSplit = structuredClone(game), splitStep: PlanetologistOrnithopterStep = { actor,
    action: { type: 'move', from: sourceA, amount: 2, elite: 0, ...splitLocation(sourceB) } };
  act(actor, splitStep.action); reach(planetologistOrnithopterClean);
  const splitMovement = { before: beforeSplit, step: splitStep, after: structuredClone(game) };
  reach(state => state.turn === 2 && state.phase === 5 && state.active === actor && planetologistOrnithopterClean(state));
  assert.equal(planetologistOrnithopterPlayer(game, actor).forces[sourceA], 2);
  assert.equal(planetologistOrnithopterPlayer(game, actor).forces[sourceB], 2);
  assert.equal(planetologistOrnithopterPlayer(game, actor).moved, 0);
  assert.ok(planetologistOrnithopterPlayer(game, actor).hand.some(card => card.id === PLANETOLOGIST_ORNITHOPTER));
  const routes = firstRoute(game, actor, sourceA, sourceB, mode, planetologist);
  assert.ok(routes, 'The real second-turn board retains its chosen bounded route');
  const trainer = planetologistLeader(game, actor); assert.ok(trainer);
  const forces: Record<string, number> = planetologist === 'gather' ? { [sourceA]: 1, [sourceB]: 1 } : { [sourceA]: 1 };
  const action: Action = { type: 'move', planetologist, forces, movementCard: PLANETOLOGIST_ORNITHOPTER,
    ornithopter: mode, ...splitLocation(routes.target) };
  const tooFarAction: Action = { ...action, ...splitLocation(routes.tooFar) };
  assert.deepEqual(planetologistOrnithopterInventory(game), originalInventory);
  return { game, sourceGame: structuredClone(game), initial: setup.initial, started: setup.started,
    offered: setup.offered, afterSetup: setup.afterSetup, setup, actor, owner: actor, emperor: actor,
    richese: setup.seats.richese!, observer: setup.seats.atreides!, advanced, mode, planetologist, secondPlanetologist,
    card: PLANETOLOGIST_ORNITHOPTER, trainer, source: sourceA, sourceA, sourceB,
    target: splitLocation(routes.target), targetLocation: routes.target, tooFarLocation: routes.tooFar,
    action, tooFarAction, forces, acquisition, shipment, beforeShipment, shipmentStep,
    afterShipment: shipment.after, splitMovement, originalInventory, originalStocks: planetologistOrnithopterStocks(game),
    actions, sourceActionCount: actions.length, endMovement: { type: 'endMovement' } satisfies Action,
    staging: [...setup.staging,
      'Original public Emperor/Richese/Atreides +choam/Leader Skills ready/start and actual living Emperor Planetologist training. Only original unopened setup skill/scalar lotteries are selected; no played hand, wallet, force, leader, phase or receipt is installed. Advanced remains preview evidence.',
      'The original Richese cache offers its actual physical Ornithopter through a real once-around auction. Emperor actually bids/pays1, then ships four normal counters to non-city rock for8 and makes an actual ordinary range-one split of two counters to adjacent rock. Native end-turn and later phase controls earn turn-two A2/B2 and retain the same purchased card.',
      'Selected provisional composition: each two-origin gather counts as one card movement. A fixed range3 applies to every gather origin and stays3 with the range alternative; the twoGroups mode uses current normal range with one chosen Planetologist alternative for each action. Original unmoved cohorts constrain both source maps and do not grow from merged first arrivals. This is not a retrieved combined publisher FAQ.',
      'Stop before the first flight declaration. Caller-owned actions commit first/second groups, their actual source maps, one original discard, movement credit and original Collection continuation.',
    ] };
}
export type PlanetologistOrnithopterFixture = ReturnType<typeof createPlanetologistOrnithopterFixture>;
export function movePlanetologistOrnithopter(fixture: PlanetologistOrnithopterFixture,
  game = structuredClone(fixture.game), actions: PlanetologistOrnithopterStep[] = []) {
  game = actPlanetologistOrnithopter(game, fixture.actor, fixture.action, actions);
  return advancePlanetologistOrnithopter(game, planetologistOrnithopterClean, actions);
}
export function planetologistOrnithopterSecondAction(fixture: PlanetologistOrnithopterFixture,
  game: Game, skill: PlanetologistMoveMode = fixture.secondPlanetologist): Action {
  assert.equal(game.ornithopter?.mode, 'twoGroups'); assert.equal(game.ornithopter.completed, 1);
  const forces: Record<string, number> = skill === 'gather'
    ? { [fixture.sourceA]: 1, [fixture.sourceB]: 1 }
    : { [fixture.planetologist === 'gather' ? fixture.sourceA : fixture.sourceB]: 1 };
  const origins = Object.keys(forces);
  const target = skill === 'gather' && fixture.planetologist === 'gather'
    ? fixture.targetLocation : destinations(game, fixture.actor, origins, skill === 'range' ? 2 : 1)[0];
  assert.ok(target, 'The actual remaining original cohort must have a legal second movement');
  return { type: 'move', planetologist: skill, forces, ornithopterEvent: game.ornithopter.event, ...splitLocation(target) };
}
export function finishPlanetologistOrnithopter(fixture: PlanetologistOrnithopterFixture, game: Game,
  actions: PlanetologistOrnithopterStep[] = []) {
  return advancePlanetologistOrnithopter(game, state => state.turn === fixture.game.turn &&
    state.phase === 7 && planetologistOrnithopterClean(state), actions);
}
