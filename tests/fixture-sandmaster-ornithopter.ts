import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { gameTerritories, location, splitLocation } from '../game/board';
import { groundMoveRouteDistance } from '../game/bot-mobility';
import { presenceAt } from '../game/force-presence';
import { sandmasterLeader, sandmasterRouteDistance, sandmasterShortestRoute, type SandmasterChoice } from '../game/sandmaster-movement';
import type { OrnithopterMode } from '../game/ornithopter';
import { createSelectedDeckSkillsSetup } from './fixture-selected-deck-skills';
import { nextChoamIndependentSkillsStep } from './fixture-choam-independent-skills';
import {
  actPlanetologistOrnithopter, planetologistOrnithopterClean, planetologistOrnithopterDestination,
  planetologistOrnithopterInventory, planetologistOrnithopterPlayer, planetologistOrnithopterStocks,
  type PlanetologistOrnithopterStep,
} from './fixture-planetologist-ornithopter';

export const SANDMASTER_ORNITHOPTER = 'richese-ornithopter';
export type SandmasterOrnithopterStep = PlanetologistOrnithopterStep;
export const actSandmasterOrnithopter = actPlanetologistOrnithopter;
export const sandmasterOrnithopterClean = planetologistOrnithopterClean;
export const sandmasterOrnithopterPlayer = planetologistOrnithopterPlayer;
export const sandmasterOrnithopterStocks = planetologistOrnithopterStocks;
export const sandmasterOrnithopterDestination = planetologistOrnithopterDestination;
export function sandmasterOrnithopterInventory(game: Game) {
  return { ...planetologistOrnithopterInventory(game),
    spice: [...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort() };
}
/** Real cache producer and original private bid; no hand/card substitution. */
export function nextSandmasterOrnithopterStep(game: Game): SandmasterOrnithopterStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'richeseCache' && game.richeseCache?.some(card => card.id === SANDMASTER_ORNITHOPTER))
      return { actor: decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: SANDMASTER_ORNITHOPTER, method: 'onceAround', direction: 'clockwise' } };
    if (!decision && game.richeseAuction?.cardId === SANDMASTER_ORNITHOPTER &&
        !game.richeseAuction.outcome && game.richeseAuction.active === 'emperor' && game.richeseAuction.bid === 0)
      return { actor: 'emperor', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  }
  return nextChoamIndependentSkillsStep(game);
}
export function advanceSandmasterOrnithopter(game: Game, until: (state: Game) => boolean,
  actions: SandmasterOrnithopterStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Sandmaster/card chronology ended before its owned boundary');
    const step = nextSandmasterOrnithopterStep(game);
    assert.ok(step, `Supply the real ${game.turn}/${game.phase}/${game.decision?.kind} control before continuing`);
    game = actSandmasterOrnithopter(game, step.actor, step.action, actions);
  }
  throw Error('The native Sandmaster/Ornithopter chronology did not reach its finite boundary');
}

/** A legal, deliberately chosen three-territory route through the real pile.
 * Prefer a destination with a shorter direct route to prove route retention. */
function rangeThreeRoute(game: Game, actor: string, source: string, pile: string) {
  const prefix = sandmasterShortestRoute(game, actor, source, pile, 1);
  if (!prefix || sandmasterRouteDistance(game, prefix) !== 1) return null;
  const view = viewGame(game, actor), me = view.players.find(player => player.id === actor)!;
  const candidates: { target: string; route: string[]; direct: number }[] = [];
  for (const place of gameTerritories(game)) {
    if (place.type !== 'rock' || place.id === splitLocation(source).territory ||
        place.id === splitLocation(pile).territory || game.players.some(player => presenceAt(player, place.id)) ||
        Object.entries(game.spice).some(([key, amount]) => amount > 0 && splitLocation(key).territory === place.id)) continue;
    for (const sector of place.sectors) {
      const target = location(place.id, sector), tail = sandmasterShortestRoute(game, actor, pile, target, 2);
      if (!tail || sandmasterRouteDistance(game, tail) !== 2) continue;
      const route = [...prefix, ...tail.slice(1)];
      if (new Set(route).size !== route.length || sandmasterRouteDistance(game, route) !== 3) continue;
      candidates.push({ target, route, direct: groundMoveRouteDistance(view, me, source, target) });
    }
  }
  return candidates.sort((a, b) => Number(b.direct < 3) - Number(a.direct < 3) || a.target.localeCompare(b.target))[0] ?? null;
}

/** Original public E/R/A, living native Sandmaster, actual cache1 purchase and
 * shipment4 for8. Only the still-unopened turn-two Spice order is selected;
 * its real blow creates the positive pile. No played stock or clock is installed. */
export function createSandmasterOrnithopterFixture(options: { advanced?: boolean; mode?: OrnithopterMode } = {}) {
  const advanced = options.advanced ?? false, mode = options.mode ?? 'twoGroups';
  const setup = createSelectedDeckSkillsSetup({ advanced, factions: ['emperor', 'richese', 'atreides'],
    expansions: ['choam'], skill: 'sandmaster' });
  const actor = setup.owner, actions: SandmasterOrnithopterStep[] = [...setup.actions];
  let game = structuredClone(setup.afterSetup);
  const act = (owner: string, action: Action) => { game = actSandmasterOrnithopter(game, owner, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSandmasterOrnithopter(game, until, actions); };
  const originalInventory = sandmasterOrnithopterInventory(game);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'richeseCache' &&
    !!state.richeseCache?.some(card => card.id === SANDMASTER_ORNITHOPTER));
  const beforeAcquisition = structuredClone(game), acquisitionStart = actions.length;
  reach(state => sandmasterOrnithopterClean(state) &&
    sandmasterOrnithopterPlayer(state, actor).hand.some(card => card.id === SANDMASTER_ORNITHOPTER));
  const acquisition = { before: beforeAcquisition, steps: structuredClone(actions.slice(acquisitionStart)), after: structuredClone(game) };
  assert.equal(sandmasterOrnithopterPlayer(beforeAcquisition, actor).spice - sandmasterOrnithopterPlayer(game, actor).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === actor && sandmasterOrnithopterClean(state));
  let selected: { source: string; card: Extract<Game['spiceDeck'][number], { territory: string }> } | null = null;
  for (const place of gameTerritories(game)) {
    if (place.type !== 'rock' || game.players.some(player => presenceAt(player, place.id)) ||
        Object.entries(game.spice).some(([key, amount]) => amount > 0 && splitLocation(key).territory === place.id)) continue;
    for (const sector of place.sectors) {
      if (sector < 7 || sector > 16 || sector === game.storm) continue;
      const source = location(place.id, sector);
      for (const card of game.spiceDeck) {
        if (!('territory' in card) || card.discovery || card.sector < 7 || card.sector > 16 ||
            card.territory === place.id || !sandmasterShortestRoute(game, actor, source, location(card.territory, card.sector), 1)) continue;
        const ranged = rangeThreeRoute(game, actor, source, location(card.territory, card.sector));
        if (!ranged || ranged.direct >= 3) continue;
        selected = { source, card: structuredClone(card) }; break;
      }
      if (selected) break;
    }
    if (selected) break;
  }
  assert.ok(selected, 'A real still-unopened positive Spice blow must be adjacent to an affordable safe rock source');
  const selectedCard = selected.card;
  const source = selected.source, sourceLocation = splitLocation(source), pile = location(selectedCard.territory, selectedCard.sector);
  const beforeShipment = structuredClone(game), shipmentStep: SandmasterOrnithopterStep = { actor,
    action: { type: 'ship', ...sourceLocation, amount: 4, elite: 0, allyPayment: 0 } };
  act(actor, shipmentStep.action); reach(sandmasterOrnithopterClean);
  const shipment = { before: beforeShipment, step: shipmentStep, after: structuredClone(game) };
  assert.equal(sandmasterOrnithopterPlayer(beforeShipment, actor).spice - sandmasterOrnithopterPlayer(game, actor).spice, 8);
  reach(state => state.turn === 2 && state.phase === 0 && sandmasterOrnithopterClean(state));
  const beforeBlow = structuredClone(game), spiceOriginal = structuredClone(game.spiceDeck);
  const at = game.spiceDeck.findIndex(card => JSON.stringify(card) === JSON.stringify(selectedCard));
  assert.ok(at >= 0, 'The selected printed Spice card is still unopened');
  const first = game.spiceDeck.splice(at, 1)[0];
  const front: Game['spiceDeck'] = [first];
  if (advanced) {
    const next = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery &&
      card.territory !== selectedCard.territory && card.territory !== sourceLocation.territory);
    assert.ok(next >= 0); front.push(game.spiceDeck.splice(next, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  const spiceOrder = { original: spiceOriginal, selected: structuredClone(front), after: structuredClone(game.spiceDeck) };
  assert.deepEqual(spiceOrder.after.map(card => JSON.stringify(card)).sort(), spiceOriginal.map(card => JSON.stringify(card)).sort());
  const blowStart = actions.length;
  reach(state => state.turn === 2 && state.phase === 2 && sandmasterOrnithopterClean(state));
  const blow = { before: beforeBlow, steps: structuredClone(actions.slice(blowStart)), after: structuredClone(game), card: selectedCard };
  assert.ok(game.spiceDiscard.flat().some(card => JSON.stringify(card) === JSON.stringify(selectedCard)));
  assert.equal(game.spice[pile], (beforeBlow.spice[pile] ?? 0) + selectedCard.amount,
    'The real printed Spice card creates this pile before any caller-owned flight');
  reach(state => state.turn === 2 && state.phase === 5 && state.active === actor && sandmasterOrnithopterClean(state));
  const trainer = sandmasterLeader(game, actor); assert.ok(trainer);
  assert.deepEqual(sandmasterOrnithopterPlayer(game, actor).forces, { [source]: 4 });
  assert.equal(sandmasterOrnithopterPlayer(game, actor).moved, 0);
  const ranged = rangeThreeRoute(game, actor, source, pile); assert.ok(ranged);
  const ordinaryRoute = sandmasterShortestRoute(game, actor, source, pile, 1); assert.ok(ordinaryRoute);
  const targetLocation = mode === 'range3' ? ranged.target : pile;
  const route = mode === 'range3' ? ranged.route : ordinaryRoute;
  const choice: SandmasterChoice = { routes: { [source]: route }, collect: [pile] };
  const action: Action = { type: 'move', forces: { [source]: 2 }, movementCard: SANDMASTER_ORNITHOPTER,
    ornithopter: mode, sandmaster: choice, ...splitLocation(targetLocation) };
  assert.deepEqual(sandmasterOrnithopterInventory(game), originalInventory);
  return { game, sourceGame: structuredClone(game), initial: setup.initial, started: setup.started,
    offered: setup.offered, afterSetup: setup.afterSetup, setup, actor, owner: actor, emperor: actor,
    richese: setup.seats.richese!, observer: setup.seats.atreides!, advanced, mode,
    card: SANDMASTER_ORNITHOPTER, trainer, source, sourceLocation, target: splitLocation(targetLocation), targetLocation,
    route: structuredClone(route), routes: structuredClone(choice.routes), choice, action,
    pile, pileBefore: game.spice[pile], originalPiles: structuredClone(game.spice),
    ranged, acquisition, shipment, beforeShipment, shipmentStep, afterShipment: shipment.after,
    beforeBlow, blow, spiceOrder, originalInventory, originalStocks: sandmasterOrnithopterStocks(game),
    originalSandmasterLogCount: game.log.filter(entry => entry.text.includes("Sandmaster collected 1 spice while moving")).length,
    actions, sourceActionCount: actions.length, endMovement: { type: 'endMovement' } satisfies Action,
    staging: [...setup.staging,
      'Original public Emperor/Richese/Atreides +choam/Leader Skills module, actual original Sandmaster offer/training and real cache Ornithopter1 sale. Four normal counters actually ship to empty non-city rock for8 and remain there across native turn progression. No played hand, force, wallet, leader, pile, phase or receipt is installed; Advanced remains preview evidence.',
      'Only original unopened setup lotteries and the still-unopened turn-two ordinary Spice order are selected. The actual printed Spice blow creates a positive pile adjacent to the real four-counter army; native Storm/Spice/Charity/Bidding/Revival controls reach the next original owned movement turn.',
      'Selected composition permits the printed moving-forces Sandmaster trigger during both physical card modes. Fixed card range remains3; each twoGroups action uses its own normal range and a distinct original cohort. One spice per entered territory resets per accepted movement under the existing explicit provisional interpretation; owner pile allocation stays provisional.',
      'The caller owns route collection, each actual movement, original residual cohort, card disposal and Collection continuation. A legal explicit three-territory route through the real pile may be longer than the shortest direct route. The twoGroups case uses two original two-counter subsets and may revisit the same still-positive pile for its separate second movement.',
    ] };
}
export type SandmasterOrnithopterFixture = ReturnType<typeof createSandmasterOrnithopterFixture>;
export function moveSandmasterOrnithopter(fixture: SandmasterOrnithopterFixture,
  game = structuredClone(fixture.game), actions: SandmasterOrnithopterStep[] = [], collect = true) {
  const action: Action = collect ? fixture.action : { ...fixture.action, sandmaster: { routes: fixture.choice.routes, collect: [] } };
  game = actSandmasterOrnithopter(game, fixture.actor, action, actions);
  return advanceSandmasterOrnithopter(game, sandmasterOrnithopterClean, actions);
}
export function sandmasterOrnithopterSecondAction(fixture: SandmasterOrnithopterFixture, game: Game, collect = true): Action {
  assert.equal(game.ornithopter?.mode, 'twoGroups'); assert.equal(game.ornithopter.completed, 1);
  assert.equal(sandmasterOrnithopterPlayer(game, fixture.actor).forces[fixture.source], 2);
  const route = sandmasterShortestRoute(game, fixture.actor, fixture.source, fixture.pile, 1); assert.ok(route);
  return { type: 'move', forces: { [fixture.source]: 2 }, ornithopterEvent: game.ornithopter.event,
    sandmaster: { routes: { [fixture.source]: route }, collect: collect ? [fixture.pile] : [] }, ...splitLocation(fixture.pile) };
}
export function finishSandmasterOrnithopter(fixture: SandmasterOrnithopterFixture, game: Game,
  actions: SandmasterOrnithopterStep[] = []) {
  return advanceSandmasterOrnithopter(game, state => state.turn === fixture.game.turn &&
    state.phase === 7 && sandmasterOrnithopterClean(state), actions);
}
