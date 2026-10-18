import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { location, splitLocation, TERRITORIES } from '../game/board';
import { botEntryAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { richeseCards } from '../game/richese-cards';
import type { OrnithopterMode } from '../game/ornithopter';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

const canonicalCard = richeseCards().find(card => card.effect === 'ornithopter');
assert.ok(canonicalCard);
export const ADVISOR_ORNITHOPTER = canonicalCard.id;
export type OrnithopterAdvisorStep = { actor: string; action: Action };
export const ornithopterAdvisorPlayer = (game: Game, actor = 'beneGesserit') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const ornithopterAdvisorClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function actOrnithopterAdvisor(game: Game, actor: string, action: Action,
  actions: OrnithopterAdvisorStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) });
  return next;
}
/** Actual native choices preserve the starting advisor stance. Accompaniment
 * is selected explicitly by the source programme, never invented by a driver. */
export function nextOrnithopterAdvisorStep(game: Game): OrnithopterAdvisorStep | null {
  if (!game.phaseOpening && !game.response) {
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'guild', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'forces' && !ornithopterAdvisorPlayer(game).advisorSetup)
      return { actor: 'beneGesserit', action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
    const decision = game.decision;
    if (decision?.kind === 'advisor' || decision?.kind === 'intrusion' || decision?.kind === 'advisorBattle')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'richeseCache') return { actor: decision.player, action: {
      type: 'decision', event: game.richeseBidding!.event, card: ADVISOR_ORNITHOPTER,
      method: 'onceAround', direction: 'clockwise',
    } };
    if (decision?.kind === 'richeseUnbid') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  if (ornithopterAdvisorClean(game) && game.richeseAuction?.cardId === ADVISOR_ORNITHOPTER &&
    !game.richeseAuction.outcome && game.richeseAuction.active === 'beneGesserit' && game.richeseAuction.bid === 0)
    return { actor: 'beneGesserit', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceOrnithopterAdvisor(game: Game, until: (state: Game) => boolean,
  actions: OrnithopterAdvisorStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original advisor Ornithopter programme ended before its next control');
    const step = nextOrnithopterAdvisorStep(game); assert.ok(step, 'Complete the original private plan before advancing');
    game = actOrnithopterAdvisor(game, step.actor, step.action, actions);
  }
  throw Error('The original advisor Ornithopter programme did not reach its finite boundary');
}

/** Genuine Advanced host/setup and paid native cache card. Native Atreides
 * occupies Arrakeen before BG chooses its original advisor placement. A real
 * Richese shipment there supplies one free accompanying advisor; a paid BG
 * shipment supplies the separate fighter. No dealt card, stance, clock,
 * money, force or completed receipt is installed. */
export function createOrnithopterAdvisorFixture(options: { fighterCity?: boolean } = {}) {
  let game = createGame('ORNITHOPTERADVISORS', newPlayer('richese', 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['atreides', 'beneGesserit', 'guild'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const actions: OrnithopterAdvisorStep[] = [];
  const act = (actor: string, action: Action) => { game = actOrnithopterAdvisor(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceOrnithopterAdvisor(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), front: Game['spiceDeck'] = [];
  for (let count = 0; count < 2; count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  reach(state => ornithopterAdvisorPlayer(state).hand.some(card => card.id === ADVISOR_ORNITHOPTER));
  const acquired = structuredClone(game);
  reach(state => state.phase === 5 && state.active === 'richese' && ornithopterAdvisorClean(state));
  const beforeForeignShipment = structuredClone(game), foreignShipment: OrnithopterAdvisorStep = {
    actor: 'richese', action: { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 },
  };
  act(foreignShipment.actor, foreignShipment.action);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'advisor');
  const beforeAccompaniment = structuredClone(game), accompany: OrnithopterAdvisorStep = {
    actor: 'beneGesserit', action: { type: 'decision', accept: true, accompany: true, sector: 10, amount: 1 },
  };
  act(accompany.actor, accompany.action); reach(ornithopterAdvisorClean);
  const afterAccompaniment = structuredClone(game);
  act('richese', { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === 'beneGesserit' && ornithopterAdvisorClean(state));
  const fighterSource = options.fighterCity ? 'carthag:11' : 'polar_sink:0';
  const beforeReinforcement = structuredClone(game), reinforcement: OrnithopterAdvisorStep = {
    actor: 'beneGesserit', action: { type: 'ship', ...splitLocation(fighterSource), amount: 1, elite: 0, allyPayment: 0 },
  };
  act(reinforcement.actor, reinforcement.action); reach(ornithopterAdvisorClean);
  return { game, lobby, setup, afterSetup, acquired, beforeForeignShipment, foreignShipment,
    beforeAccompaniment, accompany, afterAccompaniment, beforeReinforcement, reinforcement,
    afterReinforcement: structuredClone(game), owner: 'beneGesserit', card: ADVISOR_ORNITHOPTER,
    advisorSource: 'arrakeen:10', fighterSource, fighterCity: options.fighterCity ?? false,
    sourceActionCount: actions.length, actions,
    staging: ['Only original scalar lotteries and unopened first-turn Spice positions are selected. The original advisorSetup, cache1 purchase, paid foreign shipment, accepted free accompaniment and paid BG reinforcement provide all physical cards, forces, stances and funding.'] };
}
export type OrnithopterAdvisorFixture = ReturnType<typeof createOrnithopterAdvisorFixture>;

/** Choose an empty printed destination from the same advisor-aware route and
 * entry quotes as the controls. Empty arrival retains the native automatic
 * stance rule; the movement card does not force a fighter declaration. */
export function ornithopterAdvisorMove(game: Game, from: string, options: {
  range?: number; mode?: OrnithopterMode; to?: string;
} = {}): Action {
  const view = viewGame(game, 'beneGesserit'), own = view.players.find(player => player.id === view.me)!;
  assert.ok((own.forces[from] ?? 0) > 0);
  const range = options.range ?? 1, origin = splitLocation(from).territory;
  const to = options.to ?? TERRITORIES.filter(place => place.type === 'sand' || place.type === 'rock')
    .flatMap(place => place.sectors.map(sector => location(place.id, sector)))
    .find(key => {
      const target = splitLocation(key);
      return game.players.every(player => Object.entries(player.forces).every(([source, count]) =>
        count === 0 || splitLocation(source).territory !== target.territory)) &&
        botEntryAllowed(view, own, target.territory, target.sector, 'move', origin) &&
        groundMoveRouteDistance(view, own, from, key) === range;
    });
  assert.ok(to, `The original advisor programme needs an empty printed range-${range} destination`);
  const active = view.ornithopter?.active;
  return { type: 'move', from, amount: 1, elite: 0, ...splitLocation(to),
    ...(options.mode ? { movementCard: ADVISOR_ORNITHOPTER, ornithopter: options.mode }
      : active ? { ornithopterEvent: active.event } : {}) };
}

/** A normal two-group flight moves one original advisor and one original
 * fighter. The city variant moves the last fighter out first, so its second
 * advisor group must use newly recomputed ordinary range one. */
export function completeOrnithopterAdvisors(fixture: OrnithopterAdvisorFixture,
  mode: OrnithopterMode = 'twoGroups') {
  let game = structuredClone(fixture.game);
  const actions: OrnithopterAdvisorStep[] = [], moves: { before: Game; step: OrnithopterAdvisorStep; after: Game }[] = [];
  const move = (from: string, settings: Parameters<typeof ornithopterAdvisorMove>[2] = {}) => {
    const before = structuredClone(game), step: OrnithopterAdvisorStep = {
      actor: fixture.owner, action: ornithopterAdvisorMove(game, from, settings),
    };
    game = actOrnithopterAdvisor(game, step.actor, step.action, actions);
    game = advanceOrnithopterAdvisor(game, ornithopterAdvisorClean, actions);
    moves.push({ before, step, after: structuredClone(game) });
    return location(String(step.action.territory), Number(step.action.sector));
  };
  const firstSource = mode === 'twoGroups' && fixture.fighterCity ? fixture.fighterSource : fixture.advisorSource;
  const firstDestination = move(firstSource, { mode, range: mode === 'range3' || fixture.fighterCity ? 3 : 1 });
  const first = structuredClone(game);
  if (mode === 'twoGroups') move(fixture.fighterCity ? fixture.advisorSource : fixture.fighterSource);
  const completed = structuredClone(game);
  game = actOrnithopterAdvisor(game, fixture.owner, { type: 'endMovement' }, actions);
  return { game, completed, first, firstDestination, firstSource, moves, actions, mode };
}
