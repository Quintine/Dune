import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { gameTerritories, location, splitLocation } from '../game/board';
import { presenceAt } from '../game/force-presence';
import {
  sandmasterCollectionPiles, sandmasterEnteredTerritories, sandmasterLeader,
  sandmasterRouteDistance, sandmasterShortestRoute, type SandmasterChoice,
} from '../game/sandmaster-movement';
import { skillOfferRolls } from './fixture-independent-card-modules';
import {
  advanceClassicDiscoverySkills, classicDiscoverySkillsClean, createClassicDiscoverySkillsFixture,
  revealClassicDiscoverySkills,
} from './fixture-discovery-classic-skills';
import {
  planetologistDiscoveryFlightInventory, planetologistDiscoveryFlightPhysical,
} from './fixture-planetologist-discovery-flight';

export type SandmasterDiscoveryFlightStep = { actor: string; action: Action };
export const sandmasterDiscoveryFlightClean = classicDiscoverySkillsClean;
export const sandmasterDiscoveryFlightInventory = planetologistDiscoveryFlightInventory;
export const sandmasterDiscoveryFlightPhysical = planetologistDiscoveryFlightPhysical;
export function sandmasterDiscoveryFlightPlayer(game: Game, actor = 'guild') {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
}
export function actSandmasterDiscoveryFlight(game: Game, actor: string, action: Action,
  actions: SandmasterDiscoveryFlightStep[] = []): Game {
  const next = applyAction(game, actor, action);
  actions.push({ actor, action: structuredClone(action) }); return next;
}
export function advanceSandmasterDiscoveryFlight(game: Game, until: (state: Game) => boolean,
  actions: SandmasterDiscoveryFlightStep[] = []): Game {
  return advanceClassicDiscoverySkills(game, until, actions);
}
/** Select the first original skill lottery, before any technique is trained. */
function originalOffers<T>(game: Game, run: () => T): T {
  const rolls = skillOfferRolls(game, { guild: 'sandmaster', emperor: 'killer-medic', harkonnen: 'prana-bindu-adept' });
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
/** Plan against the actual second Storm. Only one original still-unplayed
 * positive Spice Card is selected; it must fund a genuinely entered territory. */
function selectBlowRoute(game: Game, actor: string, source: string) {
  for (const place of gameTerritories(game)) {
    if (place.type !== 'rock' || game.players.some(player => presenceAt(player, place.id))) continue;
    for (const sector of place.sectors) {
      const targetLocation = location(place.id, sector), route = sandmasterShortestRoute(game, actor, source, targetLocation, 3);
      if (!route || sandmasterRouteDistance(game, route) !== 3) continue;
      const entered = sandmasterEnteredTerritories({ [source]: route });
      const card = game.spiceDeck.find(card => 'territory' in card && !card.discovery &&
        card.sector !== game.storm && entered.includes(card.territory));
      if (card && 'territory' in card) return { route, targetLocation, card: structuredClone(card), pile: location(card.territory, card.sector) };
    }
  }
  return null;
}

/** Public G/E/H Skills + Discoveries, actual Sandmaster offer/training and an
 * actual turn-one paid collector acquire the original token in Collection.
 * Native Storm and the next real Spice blow supply the later positive route.
 * Only original unopened lotteries/unplayed cards are selected. No played
 * token, army, wallet, trainer, phase, receipt or spice pile is installed. */
export function createSandmasterDiscoveryFlightFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false, actor = 'guild', observer = 'emperor', opponent = 'harkonnen';
  let game = createGame('SANDMASTERDISCOVERYFLIGHT', newPlayer(actor, 'Guild', 'guild'), advanced);
  joinGame(game, newPlayer(observer, 'Emperor', 'emperor'));
  joinGame(game, newPlayer(opponent, 'Harkonnen', 'harkonnen'));
  const actions: SandmasterDiscoveryFlightStep[] = [], initial = structuredClone(game);
  const act = (owner: string, action: Action) => { game = actSandmasterDiscoveryFlight(game, owner, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSandmasterDiscoveryFlight(game, until, actions); };
  act(actor, { type: 'moduleOption', module: 'leaderSkills', enabled: true });
  act(actor, { type: 'moduleOption', module: 'discoveries', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const ready = structuredClone(game);
  originalOffers(game, () => act(actor, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' }));
  const started = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.ok(game.leaderSkills && game.discoveries);
  const native = createClassicDiscoverySkillsFixture({ initial: game, skill: 'sandmaster', face: 'ornithopter', amount: 1 });
  actions.push(...native.actions.map(step => structuredClone(step)));
  // Retain the original successful deal and actions; never replay setup's RNG.
  game = native.game; const collection = structuredClone(game);
  const source = location(native.parent, native.parentSector), sourcePile = source;
  game = revealClassicDiscoverySkills(native, actions);
  const acquired = structuredClone(game), originalToken = structuredClone(game.discoveries!.tokens.find(token => token.id === native.token)!);
  assert.equal(originalToken.status, 'carried'); assert.equal(originalToken.owner, actor); assert.equal(originalToken.acquiredTurn, 1);
  reach(state => state.turn === 2 && state.phase === 1 && sandmasterDiscoveryFlightClean(state));
  const beforeBlowSelection = structuredClone(game), selected = selectBlowRoute(game, actor, source);
  assert.ok(selected, 'A real unplayed normal Spice Card must fund an entered territory on an exact-three route to empty rock');
  const index = game.spiceDeck.findIndex(card => JSON.stringify(card) === JSON.stringify(selected.card)); assert.ok(index >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(index, 1)[0]);
  if (advanced) {
    const second = game.spiceDeck.findIndex((card, index) => index > 0 && 'territory' in card && !card.discovery &&
      card.territory !== splitLocation(source).territory && card.territory !== selected.card.territory);
    assert.ok(second > 0); game.spiceDeck.splice(1, 0, game.spiceDeck.splice(second, 1)[0]);
  }
  const beforeBlow = structuredClone(game);
  reach(state => state.turn === 2 && state.phase === 5 && state.active === actor && sandmasterDiscoveryFlightClean(state));
  assert.ok(game.spice[selected.pile] > 0, 'The selected real next-turn Spice blow must remain available before movement');
  const beforeShipment = structuredClone(game), shipmentStep: SandmasterDiscoveryFlightStep = { actor,
    action: { type: 'ship', ...splitLocation(source), amount: 1, elite: 0, allyPayment: 0 } };
  act(actor, shipmentStep.action); reach(sandmasterDiscoveryFlightClean);
  const afterShipment = structuredClone(game), sourceCount = sandmasterDiscoveryFlightPlayer(game, actor).forces[source];
  assert.equal(sourceCount, 2);
  assert.equal(sandmasterDiscoveryFlightPlayer(beforeShipment, actor).spice - sandmasterDiscoveryFlightPlayer(game, actor).spice, 1);
  assert.equal(sandmasterDiscoveryFlightPlayer(beforeShipment, actor).reserves - sandmasterDiscoveryFlightPlayer(game, actor).reserves, 1);
  const trainer = sandmasterLeader(game, actor); assert.ok(trainer);
  const routes = { [source]: selected.route }, offeredPiles = sandmasterCollectionPiles(game, routes);
  const choice: SandmasterChoice = { routes, collect: Object.values(offeredPiles).map(piles => piles[0]) };
  assert.ok(choice.collect.includes(selected.pile)); assert.ok(!choice.collect.includes(sourcePile));
  const target = splitLocation(selected.targetLocation);
  const action: Action = { type: 'move', from: source, amount: sourceCount, elite: 0,
    discoveryOrnithopter: native.token, sandmaster: choice, ...target };
  const declineChoice: SandmasterChoice = { routes: structuredClone(routes), collect: [] };
  const declineAction: Action = { ...action, sandmaster: declineChoice };
  const ordinary: Action = { ...action }; delete ordinary.discoveryOrnithopter;
  const plainAction: Action = { ...action }; delete plainAction.sandmaster;
  const originalInventory = sandmasterDiscoveryFlightInventory(game);
  return { game, rawGame: structuredClone(game), sourceGame: structuredClone(game), advanced, actor, owner: actor,
    observer, opponent, trainer, leader: trainer, token: native.token, originalToken, acquiredTurn: originalToken.acquiredTurn!,
    initial, ready, started, offered: native.setup, collection, acquired, native,
    beforeBlowSelection, beforeBlow, blowCard: selected.card, beforeShipment, shipmentStep, afterShipment,
    source, sourcePile, sourceSpice: game.spice[sourcePile] ?? 0, sourceCount,
    route: selected.route, routes, target, targetLocation: selected.targetLocation,
    pile: selected.pile, piles: choice.collect, offeredPiles, choice, declineChoice, action, declineAction, ordinary, plainAction,
    originalInventory, originalPhysical: sandmasterDiscoveryFlightPhysical(game), originalSpice: structuredClone(game.spice),
    actions, publicActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original public G/E/H Basic/Advanced Skills + Discoveries module selections, readiness and start; original all14 offer lottery selects Sandmaster before actual private training. Advanced keeps its explicit preview start. No post-hoc setup replay occurs.',
      ...native.staging,
      'Actual turn-one one-force paid Guild shipment reaches the real Discovery parent. Actual inspect/reveal acquires the original physical Ornithopter on turn one; native Collection retains its actual source-spice result, which may be zero. Native Mentat, next Storm and the real phase-one opening follow.',
      'Only a still-unplayed ordinary Spice Card is reordered at that real second-turn Spice opening to fund a territory entered by the selected exact-three route; Advanced also puts a separate original ordinary card second. Actual native Spice resolution creates the positive pile. No spice, force, wallet, phase or token is installed.',
      'Actual turn-two paid one-force Guild shipment joins the original source counter. Stop before the fixed-three Discovery movement to empty rock; optional collection, one native movement/token consumption and the later Collection continuation remain caller-owned. This empty-rock route has no natural opposing movement-response frame.',
    ] };
}
export type SandmasterDiscoveryFlightFixture = ReturnType<typeof createSandmasterDiscoveryFlightFixture>;
export function finishSandmasterDiscoveryFlight(fixture: SandmasterDiscoveryFlightFixture, game: Game,
  actions: SandmasterDiscoveryFlightStep[] = []) {
  return advanceSandmasterDiscoveryFlight(game, state => state.turn === fixture.game.turn &&
    state.phase === 7 && sandmasterDiscoveryFlightClean(state), actions);
}
