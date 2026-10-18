import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { gameDistance, location, splitLocation, TERRITORIES } from '../game/board';
import type { OrnithopterMode } from '../game/ornithopter';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export const HAJR_ORNITHOPTER = 'richese-ornithopter';
export type OrnithopterHajrStep = { actor: string; action: Action };
export type OrnithopterHajrOptions = { advanced?: boolean; interruption?: boolean; amount?: 3 | 4 };
export const ornithopterHajrPlayer = (game: Game, actor = 'emperor') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const ornithopterHajrClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function actOrnithopterHajr(game: Game, actor: string, action: Action,
  actions: OrnithopterHajrStep[] = []): Game {
  actions.push({ actor, action: structuredClone(action) });
  return withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
}
function nextOrnithopterHajrStep(game: Game): OrnithopterHajrStep | null {
  if (!game.response && !game.phaseOpening && game.decision) {
    const decision = game.decision;
    if (decision.kind === 'richeseCache') return { actor: decision.player, action: { type: 'decision',
      event: game.richeseBidding!.event, card: HAJR_ORNITHOPTER, method: 'onceAround', direction: 'clockwise' } };
    if (decision.kind === 'richeseUnbid') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
    if (decision.kind === 'choamMovement') return { actor: decision.player, action: { type: 'decision', decline: true } };
  }
  if (ornithopterHajrClean(game) && game.richeseAuction?.cardId === HAJR_ORNITHOPTER &&
    !game.richeseAuction.outcome && game.richeseAuction.active === 'emperor' && game.richeseAuction.bid === 0)
    return { actor: 'emperor', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  if (ornithopterHajrClean(game) && game.auction?.active === 'emperor' && game.auction.bid === 0 &&
    game.auction.cards[game.auction.index].effect === 'hajr')
    return { actor: 'emperor', action: { type: 'bid', amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceOrnithopterHajr(game: Game, until: (state: Game) => boolean,
  actions: OrnithopterHajrStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Ornithopter/Hajr programme ended before its next owned control');
    const step = nextOrnithopterHajrStep(game); assert.ok(step, 'Complete the real private plan before continuing');
    game = actOrnithopterHajr(game, step.actor, step.action, actions);
  }
  throw Error('The original Ornithopter/Hajr programme did not reach its finite boundary');
}

/** Original host, native cache/ordinary paid lots and actual reserve shipments.
 * An optional native CHOAM arrival interruption is funded before the pilot's
 * turn; no dealt card, board counter, wallet, clock or reaction is installed. */
export function createOrnithopterHajrFixture(options: OrnithopterHajrOptions = {}) {
  const advanced = options.advanced ?? false;
  let game = createGame('ORNITHOPTERHAJR', newPlayer('richese', 'Richese', 'richese'), advanced, ['choam']);
  const seats = options.interruption ? ['choam', 'emperor', 'guild'] as const : ['emperor', 'guild'] as const;
  for (const faction of seats) joinGame(game, newPlayer(faction, faction, faction));
  const actions: OrnithopterHajrStep[] = [];
  const act = (actor: string, action: Action) => { game = actOrnithopterHajr(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceOrnithopterHajr(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), front: Game['spiceDeck'] = [];
  for (let count = 0; count < (advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  reach(state => state.phase === 2 && ornithopterHajrClean(state));
  const at = game.deck.findIndex(card => card.effect === 'hajr'); assert.ok(at >= 0, 'The original Hajr must remain undealt');
  const hajr = game.deck[at].id; game.deck.unshift(game.deck.splice(at, 1)[0]);
  const beforePurchases = structuredClone(game);
  reach(state => ornithopterHajrPlayer(state).hand.some(card => card.id === HAJR_ORNITHOPTER) &&
    ornithopterHajrPlayer(state).hand.some(card => card.id === hajr));
  const acquired = structuredClone(game), shipments: { before: Game; step: OrnithopterHajrStep; after: Game }[] = [];
  const ship = (actor: string, to: string, sector: number, amount: number, elite = 0) => {
    const before = structuredClone(game), step: OrnithopterHajrStep = { actor,
      action: { type: 'ship', territory: to, sector, amount, elite, allyPayment: 0 } };
    act(actor, step.action); reach(ornithopterHajrClean);
    shipments.push({ before, step, after: structuredClone(game) });
  };
  if (options.interruption) {
    reach(state => state.phase === 5 && state.active === 'choam' && ornithopterHajrClean(state));
    ship('choam', 'oh_gap', 9, 1);
  }
  reach(state => state.phase === 5 && state.active === 'emperor' && ornithopterHajrClean(state));
  ship('emperor', 'imperial_basin', 9, options.amount ?? 4, advanced ? 2 : 0);
  return { game, lobby, setup, afterSetup, beforePurchases, acquired, hajr, actions, shipments,
    owner: 'emperor', source: 'imperial_basin:9', interruption: options.interruption ?? false,
    staging: ['Original native setup and paid cache/ordinary auction acquire both cards. Only unopened Hajr/Spice positions and scalar lotteries are selected; original funded shipments provide every physical source.'] };
}
export type OrnithopterHajrFixture = ReturnType<typeof createOrnithopterHajrFixture>;

/** Use current physical typed custody and real storm geography, without city
 * access or any staged speed bonus. A forced destination supports the genuine
 * native CHOAM interruption; other targets are empty printed sand or rock. */
export function ornithopterHajrMove(game: Game, from: string, options: {
  range?: number; mode?: OrnithopterMode; to?: string; elite?: number;
} = {}): Action {
  const own = ornithopterHajrPlayer(game), range = options.range ?? 1;
  assert.ok((own.forces[from] ?? 0) > 0);
  const to = options.to ?? TERRITORIES.filter(place => place.type === 'sand' || place.type === 'rock')
    .flatMap(place => place.sectors.map(sector => location(place.id, sector)))
    .find(to => game.players.every(player => Object.entries(player.forces).every(([key, count]) =>
      count === 0 || splitLocation(key).territory !== splitLocation(to).territory)) &&
      gameDistance(game, from, to, key => splitLocation(key).sector === game.storm) === range);
  assert.ok(to, `The original group needs an empty printed range-${range} destination`);
  const flight = viewGame(game, 'emperor').ornithopter?.active;
  return { type: 'move', from, amount: 1, elite: options.elite ?? ((own.elites?.forces[from] ?? 0) > 0 ? 1 : 0),
    ...splitLocation(to), ...(options.mode ? { movementCard: HAJR_ORNITHOPTER, ornithopter: options.mode }
      : flight ? { ornithopterEvent: flight.event } : {}) };
}
export function playOrnithopterHajr(game: Game, fixture: OrnithopterHajrFixture,
  actions: OrnithopterHajrStep[] = []): Game {
  game = actOrnithopterHajr(game, fixture.owner, { type: 'card', card: fixture.hajr }, actions);
  return advanceOrnithopterHajr(game, ornithopterHajrClean, actions);
}

/** Complete actual card groups then the independent Hajr continuation. Before
 * is Basic face timing; Advanced uses Hajr after a completed Force Movement.
 * A prior ordinary move is never reclassified as part of the later flight. */
export function completeOrnithopterHajr(fixture: OrnithopterHajrFixture, options: {
  mode?: OrnithopterMode; timing?: 'before' | 'during' | 'after'; priorNormal?: boolean;
} = {}) {
  const mode = options.mode ?? 'twoGroups', timing = options.timing ?? 'after';
  assert.ok(mode === 'twoGroups' || timing !== 'during', 'A one-group flight completes before another timing window');
  assert.ok(!fixture.game.advanced || timing !== 'before', 'Advanced Hajr follows an actual completed Force Movement');
  const actions: OrnithopterHajrStep[] = [], moves: { before: Game; step: OrnithopterHajrStep; after: Game }[] = [];
  let game = structuredClone(fixture.game), prior: Game | null = null, pendingArrival: Game | null = null;
  const move = (from: string, settings: Parameters<typeof ornithopterHajrMove>[2] = {}) => {
    const before = structuredClone(game), step: OrnithopterHajrStep = { actor: fixture.owner, action: ornithopterHajrMove(game, from, settings) };
    game = actOrnithopterHajr(game, step.actor, step.action, actions);
    if (game.decision?.kind === 'choamMovement') pendingArrival = structuredClone(game);
    game = advanceOrnithopterHajr(game, ornithopterHajrClean, actions);
    moves.push({ before, step, after: structuredClone(game) });
    return location(String(step.action.territory), Number(step.action.sector));
  };
  let firstSource = fixture.source;
  if (options.priorNormal) {
    firstSource = move(fixture.source); prior = structuredClone(game);
    game = playOrnithopterHajr(game, fixture, actions);
  } else if (timing === 'before') game = playOrnithopterHajr(game, fixture, actions);
  const beforeFlight = structuredClone(game), firstDestination = move(firstSource, {
    mode, range: mode === 'range3' ? 3 : 1,
    ...(fixture.interruption ? { to: 'oh_gap:9' } : {}),
  });
  const first = structuredClone(game);
  if (!options.priorNormal && timing === 'during') game = playOrnithopterHajr(game, fixture, actions);
  if (mode === 'twoGroups') move(fixture.source);
  const flightComplete = structuredClone(game);
  if (!options.priorNormal && timing === 'after') game = playOrnithopterHajr(game, fixture, actions);
  const beforeExtra = structuredClone(game);
  if (!options.priorNormal) move(firstDestination);
  const completed = structuredClone(game);
  game = actOrnithopterHajr(game, fixture.owner, { type: 'endMovement' }, actions);
  return { game, completed, prior, beforeFlight, first, flightComplete, beforeExtra, firstDestination,
    pendingArrival, moves, actions, mode, timing };
}
