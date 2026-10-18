import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type TruthtranceGuildShipmentStep = { actor: string; action: Action };
export const truthtranceGuildShipmentPlayer = (game: Game, actor = 'emperor') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const truthtranceGuildShipmentClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function actTruthtranceGuildShipment(game: Game, actor: string, action: Action,
  actions: TruthtranceGuildShipmentStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Only original native continuations. Questions, answers and shipment
 * declarations remain explicit; ordinary responses allow their declared effect. */
export function nextTruthtranceGuildShipmentStep(game: Game): TruthtranceGuildShipmentStep | null {
  if (game.truthtrance) {
    if (game.truthtrance.stage !== 'priority') return null;
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'truthPass' } };
  }
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'guildTiming') return { actor: decision.player,
      action: { type: 'decision', take: false } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceTruthtranceGuildShipment(game: Game, until: (state: Game) => boolean,
  actions: TruthtranceGuildShipmentStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Truthtrance/Guild programme ended before its next control');
    const step = nextTruthtranceGuildShipmentStep(game); assert.ok(step, 'Choose the original structured question and answer explicitly');
    game = actTruthtranceGuildShipment(game, step.actor, step.action, actions);
  }
  throw Error('The original Truthtrance/Guild programme did not reach its finite boundary');
}

/** The actual public Advanced classic start deals the selected unopened
 * Truthtrance to Atreides and distinct original Karamas to Emperor/Guild.
 * Native TAKE/WAIT controls create the current unused reserve shipment.
 * No postdeal card, resource, army, phase, timing flag or promise is installed. */
export function createTruthtranceGuildShipmentFixture(options: { target?: 'emperor' | 'guild' } = {}) {
  const target = options.target ?? 'emperor';
  let game = createGame('TRUTHGUILDSHIPMENT', newPlayer('atreides', 'Atreides', 'atreides'), true);
  for (const faction of ['emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: TruthtranceGuildShipmentStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthtranceGuildShipment(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthtranceGuildShipment(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  const truth = game.deck.find(card => card.effect === 'truthtrance');
  const karmas = game.deck.filter(card => card.effect === 'karama');
  assert.ok(truth && karmas.length === 2);
  const deal = [truth.id, karmas[0].id, karmas[1].id];
  for (const [position, id] of deal.entries()) {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
  }
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), front: Game['spiceDeck'] = [];
  assert.ok(truthtranceGuildShipmentPlayer(game, 'atreides').hand.some(card => card.id === truth.id));
  assert.ok(truthtranceGuildShipmentPlayer(game, 'emperor').hand.some(card => card.id === karmas[0].id));
  assert.ok(truthtranceGuildShipmentPlayer(game, 'guild').hand.some(card => card.id === karmas[1].id));
  for (let count = 0; count < 2; count++) {
    const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(index >= 0);
    front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'guildTiming');
  const timing: { before: Game; step: TruthtranceGuildShipmentStep; declared: Game; after: Game }[] = [];
  const chooseTiming = (take: boolean) => {
    assert.equal(game.decision?.kind, 'guildTiming');
    const before = structuredClone(game), step: TruthtranceGuildShipmentStep = { actor: 'guild', action: { type: 'decision', take } };
    act(step.actor, step.action);
    const declared = structuredClone(game);
    reach(truthtranceGuildShipmentClean);
    timing.push({ before, step, declared, after: structuredClone(game) });
  };
  chooseTiming(target === 'guild');
  let completedPrefix: { before: Game; step: TruthtranceGuildShipmentStep; after: Game } | null = null;
  if (target === 'emperor') {
    assert.equal(game.active, 'atreides');
    const before = structuredClone(game), step: TruthtranceGuildShipmentStep = { actor: 'atreides', action: { type: 'endMovement' } };
    act(step.actor, step.action);
    completedPrefix = { before, step, after: structuredClone(game) };
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'guildTiming');
    chooseTiming(false);
  }
  assert.equal(game.active, target);
  assert.equal(truthtranceGuildShipmentPlayer(game, target).shipped, false);
  assert.equal(truthtranceGuildShipmentPlayer(game, target).moved, 0);
  return { game, lobby, setup, beforeStartingDeal, afterSetup, timing, completedPrefix,
    asker: 'atreides', target, guild: 'guild', rateCanceler: 'emperor', card: truth.id,
    guildKarama: karmas[1].id, rateKarama: karmas[0].id, location: 'carthag:11',
    sourceActionCount: actions.length, actions,
    staging: ['Only the three unopened original starting-deal positions, original land Spice positions and scalar lotteries are selected. Public Advanced classic setup actually deals the physical Truthtrance and distinct Karamas; native Guild TAKE/WAIT and an optional explicit completed Atreides turn create the unused shipment. No expansions/modules or postdeal hands, resources, forces, clocks, timing flags or promise receipts are installed.'] };
}
export type TruthtranceGuildShipmentFixture = ReturnType<typeof createTruthtranceGuildShipmentFixture>;

export function askTruthtranceGuildShipment(fixture: TruthtranceGuildShipmentFixture) {
  const actions: TruthtranceGuildShipmentStep[] = [], before = structuredClone(fixture.game);
  const declaration: TruthtranceGuildShipmentStep = { actor: fixture.asker,
    action: { type: 'card', card: fixture.card } };
  let game = actTruthtranceGuildShipment(before, declaration.actor, declaration.action, actions);
  const opened = structuredClone(game);
  game = advanceTruthtranceGuildShipment(game, game => game.truthtrance?.stage === 'ask', actions);
  const beforeQuestion = structuredClone(game), question: TruthtranceGuildShipmentStep = { actor: fixture.asker, action: {
    type: 'truthAsk', question: { kind: 'shipment', target: fixture.target, territory: 'carthag', minimum: 3 },
  } };
  game = actTruthtranceGuildShipment(game, question.actor, question.action, actions);
  assert.equal(game.truthtrance?.stage, 'answer');
  return { game, before, declaration, opened, beforeQuestion, question, actions };
}
export function bindTruthtranceGuildShipment(fixture: TruthtranceGuildShipmentFixture) {
  const asked = askTruthtranceGuildShipment(fixture), actions = [...asked.actions];
  const answer: TruthtranceGuildShipmentStep = { actor: fixture.target, action: { type: 'truthAnswer', answer: 'yes' } };
  const game = actTruthtranceGuildShipment(asked.game, answer.actor, answer.action, actions);
  assert.ok(truthtranceGuildShipmentClean(game));
  return { ...asked, game, asked: asked.game, answer, actions };
}
export function declareTruthtranceGuildShipment(fixture: TruthtranceGuildShipmentFixture, state: Game) {
  const before = structuredClone(state), step: TruthtranceGuildShipmentStep = { actor: fixture.target, action: {
    type: 'ship', territory: 'carthag', sector: 11, amount: 3,
    elite: fixture.target === 'emperor' ? 1 : 0, allyPayment: 0,
  } }, actions: TruthtranceGuildShipmentStep[] = [];
  const game = actTruthtranceGuildShipment(before, step.actor, step.action, actions);
  assert.equal(game.decision?.kind, 'guildShipment');
  return { before, step, game, actions };
}

/** Resolve real permission, the printed Guild stop or an original opposing
 * Karama rate cancellation before native payment/arrival. Explicitly ending
 * the respondent's actual turn proves the settled promise no longer blocks it. */
export function completeTruthtranceGuildShipment(fixture: TruthtranceGuildShipmentFixture,
  mode: 'allow' | 'stop' | 'cancelRate' = 'allow') {
  const binding = bindTruthtranceGuildShipment(fixture), declaration = declareTruthtranceGuildShipment(fixture, binding.game);
  const actions = [...binding.actions, ...declaration.actions];
  let game = declaration.game;
  assert.ok(mode !== 'stop' || fixture.target !== fixture.guild, 'The bounded stop scene targets the opposing Emperor');
  assert.ok(mode !== 'cancelRate' || fixture.target === fixture.guild, 'The bounded repricing scene targets the native Guild');
  const choice: TruthtranceGuildShipmentStep = { actor: fixture.guild, action: mode === 'stop'
    ? { type: 'card', mode: 'special', card: fixture.guildKarama }
    : { type: 'decision', allow: true } };
  game = actTruthtranceGuildShipment(game, choice.actor, choice.action, actions);
  const afterPermission = structuredClone(game);
  let rate: { before: Game; step: TruthtranceGuildShipmentStep; after: Game } | null = null;
  if (mode === 'cancelRate') {
    assert.equal(game.response?.kind, 'guildRate');
    const before = structuredClone(game), step: TruthtranceGuildShipmentStep = { actor: fixture.rateCanceler,
      action: { type: 'card', mode: 'cancel', card: fixture.rateKarama } };
    game = actTruthtranceGuildShipment(game, step.actor, step.action, actions);
    rate = { before, step, after: structuredClone(game) };
  }
  game = advanceTruthtranceGuildShipment(game,
    game => truthtranceGuildShipmentClean(game) && !game.pendingShipment, actions);
  const settled = structuredClone(game), end: TruthtranceGuildShipmentStep = { actor: fixture.target, action: { type: 'endMovement' } };
  game = actTruthtranceGuildShipment(game, end.actor, end.action, actions);
  return { game, binding, declaration, choice, afterPermission, rate, settled, end, mode, actions };
}
