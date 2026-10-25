import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { gameTerritories, location, splitLocation } from '../game/board';
import { botEntryAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { presenceAt } from '../game/force-presence';
import { planetologistLeader } from '../game/planetologist-movement';
import { validateDiscoveryState } from '../game/discoveries';
import { skillOfferRolls } from './fixture-independent-card-modules';
import { assertSelectedDeckSkillsInventory } from './fixture-selected-deck-skills';
import {
  advanceClassicDiscoverySkills, classicDiscoverySkillsClean, createClassicDiscoverySkillsFixture,
  revealClassicDiscoverySkills,
} from './fixture-discovery-classic-skills';

export type PlanetologistDiscoveryFlightStep = { actor: string; action: Action };
export const planetologistDiscoveryFlightClean = classicDiscoverySkillsClean;
export function planetologistDiscoveryFlightPlayer(game: Game, actor = 'guild') {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
}
export function planetologistDiscoveryFlightInventory(game: Game) {
  assertSelectedDeckSkillsInventory(game); validateDiscoveryState(game.discoveries!);
  return {
    treachery: [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
      ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])]
      .map(card => card.id).sort(),
    skills: [...game.leaderSkills!.deck, ...game.leaderSkills!.assignments.map(assignment => assignment.skill),
      ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards)].sort(),
    traitors: [...(game.traitorReserve ?? []), ...game.players.flatMap(player => player.traitors)].sort(),
    discoveries: game.discoveries!.tokens.map(token => ({ id: token.id, face: token.face, type: token.type }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    spice: [...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort(),
  };
}
export function planetologistDiscoveryFlightPhysical(game: Game) {
  return game.players.map(player => ({ id: player.id, spice: player.spice, reserves: player.reserves,
    tanks: player.tanks, forces: structuredClone(player.forces), elites: structuredClone(player.elites),
    leaders: structuredClone(player.leaders), hand: player.hand.map(card => card.id), moved: player.moved,
    shipped: player.shipped }));
}
export function actPlanetologistDiscoveryFlight(game: Game, actor: string, action: Action,
  actions: PlanetologistDiscoveryFlightStep[] = []): Game {
  const next = applyAction(game, actor, action);
  actions.push({ actor, action: structuredClone(action) }); return next;
}
export function advancePlanetologistDiscoveryFlight(game: Game, until: (state: Game) => boolean,
  actions: PlanetologistDiscoveryFlightStep[] = []): Game {
  return advanceClassicDiscoverySkills(game, until, actions);
}
/** Original unopened skill-offer lottery only; all other randomness stays native. */
function originalOffers<T>(game: Game, run: () => T): T {
  const rolls = skillOfferRolls(game, { guild: 'planetologist', emperor: 'killer-medic', harkonnen: 'prana-bindu-adept' });
  const original = crypto.getRandomValues.bind(crypto);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues'); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1 && cursor < rolls.length) array[0] = rolls[cursor++];
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function routes(game: Game, actor: string, first: string) {
  const view = viewGame(game, actor), me = view.players.find(player => player.id === actor)!;
  const rocks = gameTerritories(game).filter(place => place.type === 'rock' &&
    !game.players.some(player => presenceAt(player, place.id)))
    .flatMap(place => place.sectors.map(sector => location(place.id, sector)))
    .filter(key => splitLocation(key).sector !== game.storm);
  const targets = rocks.filter(target => groundMoveRouteDistance(view, me, first, target) === 3 &&
    botEntryAllowed(view, me, splitLocation(target).territory, splitLocation(target).sector, 'move', splitLocation(first).territory));
  const rangeFourLocation = rocks.find(target => groundMoveRouteDistance(view, me, first, target) === 4 &&
    botEntryAllowed(view, me, splitLocation(target).territory, splitLocation(target).sector, 'move', splitLocation(first).territory));
  if (!targets.length || !rangeFourLocation) return null;
  for (const targetLocation of targets) for (const second of rocks) {
    if (splitLocation(second).territory === splitLocation(first).territory ||
      splitLocation(second).territory === splitLocation(targetLocation).territory) continue;
    if (groundMoveRouteDistance(view, me, second, targetLocation) !== 3) continue;
    const gatherTooFarLocation = rocks.find(target => target !== second &&
      splitLocation(target).territory !== splitLocation(second).territory &&
      [first, second].every(from => groundMoveRouteDistance(view, me, from, target) <= 4) &&
      [first, second].some(from => groundMoveRouteDistance(view, me, from, target) === 4));
    if (gatherTooFarLocation) return { second, targetLocation, rangeFourLocation, gatherTooFarLocation };
  }
  return null;
}

/** Public Basic/Advanced G/E/H module, readiness and start controls precede the
 * actual all14 offers/training. Original Collection earns the physical token;
 * native next-turn chronology and a second funded shipment earn both sources.
 * Only unopened lotteries/unplayed Spice order are selected. No played force,
 * wallet, phase, card, token or receipt is installed. Advanced is preview proof. */
export function createPlanetologistDiscoveryFlightFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false, actor = 'guild', observer = 'emperor', opponent = 'harkonnen';
  let game = createGame('PLANETOLOGISTDISCOVERYFLIGHT', newPlayer(actor, 'Guild', 'guild'), advanced);
  joinGame(game, newPlayer(observer, 'Emperor', 'emperor'));
  joinGame(game, newPlayer(opponent, 'Harkonnen', 'harkonnen'));
  const actions: PlanetologistDiscoveryFlightStep[] = [], initial = structuredClone(game);
  const act = (owner: string, action: Action) => { game = actPlanetologistDiscoveryFlight(game, owner, action, actions); };
  act(actor, { type: 'moduleOption', module: 'leaderSkills', enabled: true });
  act(actor, { type: 'moduleOption', module: 'discoveries', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const ready = structuredClone(game);
  originalOffers(game, () => act(actor, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' }));
  const started = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.ok(game.leaderSkills && game.discoveries);
  const native = createClassicDiscoverySkillsFixture({ initial: game, skill: 'planetologist', face: 'ornithopter', amount: 3 });
  actions.push(...native.actions.map(step => structuredClone(step)));
  // Keep the actual completed chronology. Replaying setup would deal fresh
  // Traitors when the last technique is chosen, rather than retain this deal.
  assert.equal(native.game.status, 'playing');
  game = native.game; const collection = structuredClone(game);
  game = revealClassicDiscoverySkills(native, actions);
  const acquired = structuredClone(game), originalToken = structuredClone(game.discoveries!.tokens.find(token => token.id === native.token)!);
  assert.equal(originalToken.status, 'carried'); assert.equal(originalToken.owner, actor); assert.equal(originalToken.acquiredTurn, 1);
  const reach = (until: (state: Game) => boolean) => { game = advancePlanetologistDiscoveryFlight(game, until, actions); };
  reach(state => state.turn === 2 && state.phase === 5 && state.active === actor && planetologistDiscoveryFlightClean(state));
  const first = location(native.parent, native.parentSector), selected = routes(game, actor, first);
  assert.ok(selected, 'The real later board must offer two sources with one common fixed-three route and a four-route negative');
  const beforeShipment = structuredClone(game), shipmentStep: PlanetologistDiscoveryFlightStep = { actor,
    action: { type: 'ship', ...splitLocation(selected.second), amount: 1, elite: 0, allyPayment: 0 } };
  act(actor, shipmentStep.action); reach(planetologistDiscoveryFlightClean);
  const afterShipment = structuredClone(game);
  assert.equal(planetologistDiscoveryFlightPlayer(beforeShipment, actor).spice - planetologistDiscoveryFlightPlayer(game, actor).spice, 1);
  assert.equal(planetologistDiscoveryFlightPlayer(beforeShipment, actor).reserves - planetologistDiscoveryFlightPlayer(game, actor).reserves, 1);
  assert.equal(planetologistDiscoveryFlightPlayer(game, actor).forces[first], 3);
  assert.equal(planetologistDiscoveryFlightPlayer(game, actor).forces[selected.second], 1);
  const trainer = planetologistLeader(game, actor); assert.ok(trainer);
  const sources = [first, selected.second] as const, forces = { [first]: 3, [selected.second]: 1 };
  const target = splitLocation(selected.targetLocation), rangeFour = splitLocation(selected.rangeFourLocation);
  const gatherTooFar = splitLocation(selected.gatherTooFarLocation);
  const action: Action = { type: 'move', planetologist: 'gather', forces,
    discoveryOrnithopter: native.token, ...target };
  const rangeAction: Action = { type: 'move', planetologist: 'range', forces: { [first]: 1 },
    discoveryOrnithopter: native.token, ...target };
  const rangeFourAction: Action = { ...rangeAction, ...rangeFour };
  const gatherTooFarAction: Action = { ...action, ...gatherTooFar };
  const originalInventory = planetologistDiscoveryFlightInventory(game);
  return { game, rawGame: structuredClone(game), sourceGame: structuredClone(game), advanced, actor, owner: actor,
    observer, opponent, trainer, leader: trainer, token: native.token, originalToken, acquiredTurn: originalToken.acquiredTurn!,
    initial, ready, started, offered: native.setup, collection, acquired, native,
    beforeShipment, shipmentStep, afterShipment, first, second: selected.second, source: first, sources, forces,
    target, targetLocation: selected.targetLocation, rangeFour, rangeFourLocation: selected.rangeFourLocation,
    gatherTooFar, gatherTooFarLocation: selected.gatherTooFarLocation,
    action, gatherAction: action, rangeAction, rangeFourAction, gatherTooFarAction,
    originalInventory, originalPhysical: planetologistDiscoveryFlightPhysical(game),
    actions, publicActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original public G/E/H Basic/Advanced moduleOption Leader Skills + Discoveries, readiness and start, actual Treachery/Traitor deal and original private Planetologist offer/training. The original unopened all14 offer lottery alone selects the requested skill; Advanced retains its explicit preview start.',
      ...native.staging,
      'Actual turn-one paid Guild shipment sends three original reserves to the original Discovery parent. Actual Collection inspection/reveal acquires the original physical Ornithopter token on turn one; native Mentat, next Storm and phases reach turn-two owned movement without a clock or phase install.',
      'Actual turn-two one-force paid Guild shipment creates the second physical origin on empty rock. Both real origins have a common empty-rock destination exactly three territories away; the independent range-four and gather over-three negatives remain unplayed.',
      'The caller owns the actual Discovery + Planetologist range/gather commit. Fixed-three gather-as-one-action is a visibly provisional composition under the 14 October authority, not a joint publisher FAQ. No public origins or internal receipt is supplied.',
    ] };
}
export type PlanetologistDiscoveryFlightFixture = ReturnType<typeof createPlanetologistDiscoveryFlightFixture>;
export function finishPlanetologistDiscoveryFlight(fixture: PlanetologistDiscoveryFlightFixture, game: Game,
  actions: PlanetologistDiscoveryFlightStep[] = []) {
  return advancePlanetologistDiscoveryFlight(game, state => state.turn === fixture.game.turn &&
    state.phase === 7 && planetologistDiscoveryFlightClean(state), actions);
}
