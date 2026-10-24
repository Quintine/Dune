import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type FutureShipmentStep = { actor: string; action: Action };
export type FutureShipmentTransition = { before: Game; step: FutureShipmentStep; after: Game };
export const futureShipmentPlayer = (game: Game, actor = 'emperor') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const futureShipmentClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function actFutureShipment(game: Game, actor: string, action: Action, actions: FutureShipmentStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Real original decisions only. The owned programme supplies its questions,
 * answers, shipments and each deliberately selected Guild timing choice. */
export function nextFutureShipmentStep(game: Game): FutureShipmentStep | null {
  if (game.truthtrance) {
    if (game.truthtrance.stage !== 'priority') return null;
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'truthPass' } };
  }
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard && game.decision?.kind === 'guildTiming')
    return { actor: game.decision.player, action: { type: 'decision', take: false } };
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceFutureShipment(game: Game, until: (state: Game) => boolean, actions: FutureShipmentStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original future-shipment programme ended before its next control');
    const step = nextFutureShipmentStep(game); assert.ok(step, 'Choose the actual structured question and answer before advancing');
    game = actFutureShipment(game, step.actor, step.action, actions);
  }
  throw Error('The original future-shipment programme did not reach its finite boundary');
}

/** Original public Basic/Advanced classic setup deals selected unopened cards,
 * including the physical Truthtrance. Advanced starts with an actual Guild
 * WAIT, leaving the distinct respondent's original turn still ahead. No dealt
 * custody, armies, resources, phase, queue, timing flags or promises are staged. */
export function createFutureShipmentFixture(options: {
  advanced?: boolean; target?: 'emperor' | 'guild'; mixed?: boolean;
} = {}) {
  const target = options.target ?? 'emperor', advanced = options.advanced ?? target === 'guild';
  assert.ok(target !== 'guild' || advanced, 'The bounded future Guild programme uses its native Advanced timing');
  const mixed = options.mixed ?? target === 'guild';
  let game = createGame('TRUTHFUTURESHIPMENT', newPlayer('atreides', 'Atreides', 'atreides'), advanced);
  for (const faction of ['emperor', 'harkonnen', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: FutureShipmentStep[] = [];
  const act = (actor: string, action: Action) => { game = actFutureShipment(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceFutureShipment(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  const truth = game.deck.find(card => card.effect === 'truthtrance');
  const karama = game.deck.find(card => card.effect === 'karama');
  const filler = [game.deck.find(card => card.name === 'Baliset'),
    game.deck.find(card => card.kind === 'shield'), game.deck.find(card => card.kind === 'snooper')];
  assert.ok(truth && karama && filler.every(Boolean));
  const deal = [truth.id, filler[0]!.id, karama.id, filler[1]!.id, filler[2]!.id];
  for (const [position, id] of deal.entries()) {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
  }
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), front: Game['spiceDeck'] = [];
  assert.ok(futureShipmentPlayer(game, 'atreides').hand.some(card => card.id === truth.id));
  assert.ok(futureShipmentPlayer(game, 'harkonnen').hand.some(card => card.id === karama.id));
  for (let count = 0; count < (advanced ? 2 : 1); count++) {
    const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(index >= 0);
    front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  let initialWait: FutureShipmentTransition | null = null;
  if (advanced) {
    reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'guildTiming');
    const before = structuredClone(game), step: FutureShipmentStep = { actor: 'guild', action: { type: 'decision', take: false } };
    act(step.actor, step.action); reach(futureShipmentClean);
    initialWait = { before, step, after: structuredClone(game) };
  } else reach(state => state.phase === 5 && state.active === 'atreides' && futureShipmentClean(state));
  assert.equal(game.active, 'atreides');
  assert.notEqual(game.active, target);
  assert.ok(game.movementRemaining!.includes(target));
  assert.equal(futureShipmentPlayer(game, target).shipped, false);
  const question: TruthQuestion = mixed ? { kind: 'mixedShipment', target, mixed: { kind: 'and', terms: [
    { kind: 'shipment', territory: 'sietch_tabr', minimum: 3 },
    { kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 3 } },
  ] } } : { kind: 'shipment', target, territory: 'sietch_tabr', minimum: 3 };
  return { game, lobby, setup, beforeStartingDeal, afterSetup, initialWait, question,
    advanced, mixed, target, asker: 'atreides', guild: 'guild', counterHolder: 'harkonnen',
    card: truth.id, karama: karama.id, location: 'sietch_tabr:14', deal,
    sourceActionCount: actions.length, actions,
    staging: ['Only five unopened original starting-deal positions, unopened land Spice positions and scalar lotteries are selected. Public classic Basic/Advanced setup actually deals Truthtrance to Atreides and a distinct Karama to Harkonnen for genuine native response passes. Advanced begins with the real Guild WAIT. No postdeal holdings, resources, armies, clocks, movement queue, timing flags or promise receipts are assigned.'] };
}
export type FutureShipmentFixture = ReturnType<typeof createFutureShipmentFixture>;
export function askFutureShipment(fixture: FutureShipmentFixture) {
  const actions: FutureShipmentStep[] = [], before = structuredClone(fixture.game);
  const declaration: FutureShipmentStep = { actor: fixture.asker, action: { type: 'card', card: fixture.card } };
  let game = actFutureShipment(before, declaration.actor, declaration.action, actions);
  const opened = structuredClone(game);
  game = advanceFutureShipment(game, game => game.truthtrance?.stage === 'ask', actions);
  const beforeQuestion = structuredClone(game), question: FutureShipmentStep = { actor: fixture.asker,
    action: { type: 'truthAsk', question: fixture.question } };
  game = actFutureShipment(game, question.actor, question.action, actions);
  assert.equal(game.truthtrance?.stage, 'answer');
  return { game, before, declaration, opened, beforeQuestion, question, actions };
}
export function bindFutureShipment(fixture: FutureShipmentFixture) {
  const asked = askFutureShipment(fixture), actions = [...asked.actions];
  const answer: FutureShipmentStep = { actor: fixture.target, action: { type: 'truthAnswer', answer: 'yes' } };
  const game = actFutureShipment(asked.game, answer.actor, answer.action, actions);
  assert.equal(game.active, fixture.asker);
  assert.ok(futureShipmentClean(game));
  return { ...asked, asked: asked.game, game, answer, actions };
}

/** Keep the original promise throughout paid intervening turns. For a Guild
 * respondent, WAIT before Emperor is an actual new choice while still bound;
 * TAKE before Harkonnen then uses the original out-of-order timing response. */
export function startFutureShipmentTarget(fixture: FutureShipmentFixture, state: Game) {
  let game = structuredClone(state);
  const actions: FutureShipmentStep[] = [], prefixes: {
    before: Game; shipment: FutureShipmentStep; declared: Game; afterShipment: Game;
    end: FutureShipmentStep; afterEnd: Game;
  }[] = [], timing: { before: Game; step: FutureShipmentStep; declared: Game; after: Game }[] = [];
  const act = (actor: string, action: Action) => { game = actFutureShipment(game, actor, action, actions); };
  const settle = () => { game = advanceFutureShipment(game,
    game => futureShipmentClean(game) && !game.pendingShipment, actions); };
  const completePrefix = (actor: string, territory: string, sector: number) => {
    assert.equal(game.active, actor);
    const before = structuredClone(game), shipment: FutureShipmentStep = { actor,
      action: { type: 'ship', territory, sector, amount: 1, elite: 0, allyPayment: 0 } };
    act(shipment.actor, shipment.action);
    const declared = structuredClone(game); settle();
    const afterShipment = structuredClone(game), end: FutureShipmentStep = { actor, action: { type: 'endMovement' } };
    act(end.actor, end.action);
    prefixes.push({ before, shipment, declared, afterShipment, end, afterEnd: structuredClone(game) });
  };
  const chooseTiming = (take: boolean) => {
    assert.equal(game.decision?.kind, 'guildTiming');
    const before = structuredClone(game), step: FutureShipmentStep = { actor: fixture.guild,
      action: { type: 'decision', take } };
    act(step.actor, step.action);
    const declared = structuredClone(game); settle();
    timing.push({ before, step, declared, after: structuredClone(game) });
  };
  completePrefix(fixture.asker, 'imperial_basin', 9);
  if (fixture.advanced) chooseTiming(false);
  if (fixture.target === fixture.guild) {
    assert.equal(game.active, 'emperor');
    completePrefix('emperor', 'polar_sink', 0);
    chooseTiming(true);
  }
  assert.equal(game.active, fixture.target);
  assert.equal(futureShipmentPlayer(game, fixture.target).shipped, false);
  return { game, prefixes, timing, actions };
}
/** Execute only at the target's actual native turn, then explicitly finish it.
 * Delivery alone settles the promise; earlier payments and timing never do. */
export function completeFutureShipment(fixture: FutureShipmentFixture) {
  const binding = bindFutureShipment(fixture), started = startFutureShipmentTarget(fixture, binding.game);
  const actions = [...binding.actions, ...started.actions];
  let game = started.game;
  const beforeShipment = structuredClone(game), shipment: FutureShipmentStep = { actor: fixture.target, action: {
    type: 'ship', territory: 'sietch_tabr', sector: 14, amount: 3,
    elite: fixture.advanced && fixture.target === 'emperor' ? 1 : 0, allyPayment: 0,
  } };
  game = actFutureShipment(game, shipment.actor, shipment.action, actions);
  const declared = structuredClone(game);
  game = advanceFutureShipment(game, game => futureShipmentClean(game) && !game.pendingShipment, actions);
  const settled = structuredClone(game), end: FutureShipmentStep = { actor: fixture.target, action: { type: 'endMovement' } };
  game = actFutureShipment(game, end.actor, end.action, actions);
  return { game, binding, started, beforeShipment, shipment, declared, settled, end, actions };
}
