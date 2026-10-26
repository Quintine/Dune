import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';
import { windowCardOpportunity, type WindowCardEffect } from '../game/window-card-play';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { truthTraitorDecisionTraitors } from './fixture-truth-traitor-decision';
import { actTruthTurnAction, truthTurnActionInventory, truthTurnActionPlayer,
  type TruthTurnActionStep } from './fixture-truth-turn-action';
import type { TruthTurnPowerLeaf } from './fixture-truth-turn-power';

export type TruthTurnWindowCardLeaf = TruthTurnPowerLeaf |
  { kind: 'cardPlay'; effect: 'hajr' } |
  { kind: 'windowCardPlay'; effect: WindowCardEffect; source: string };
export type TruthTurnWindowCardExpression = MixedActionExpression<TruthTurnWindowCardLeaf>;
export type TruthTurnWindowCardStep = TruthTurnActionStep;
export const actTruthTurnWindowCard = actTruthTurnAction;
export const truthTurnWindowCardPlayer = truthTurnActionPlayer;
export const truthTurnWindowCardInventory = truthTurnActionInventory;
export const truthTurnWindowCardTraitors = truthTraitorDecisionTraitors;
export const truthTurnWindowCardClean = (game: Game) => !game.truthtrance && !game.response && !game.phaseOpening &&
  !game.decision && !game.pendingTreacheryDiscard && !game.pendingRevival && !game.pendingShipment;
export const truthTurnWindowCardFact = (fact: TruthFact): TruthTurnWindowCardExpression => ({ kind: 'fact', fact });
export const truthTurnWindowCardPayment = (recipient: string, minimum = 2): TruthTurnWindowCardExpression =>
  ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
export const truthTurnWindowCardPlay = (effect: WindowCardEffect, source: string): TruthTurnWindowCardExpression =>
  ({ kind: 'action', action: { kind: 'windowCardPlay', effect, source } });
export const truthTurnWindowCardGroup = (kind: 'and' | 'or', ...terms: TruthTurnWindowCardExpression[]): TruthTurnWindowCardExpression =>
  ({ kind, terms });
export function nextTruthTurnWindowCardNative(game: Game): TruthTurnWindowCardStep | null {
  if (game.truthtrance) return null;
  return nextStrongholdFactionsNativeStep(game);
}
export function nextTruthTurnWindowCard(game: Game): TruthTurnWindowCardStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).turnActionGuide;
    if (guide) return { actor: player.id, action: guide.action };
  }
  return nextTruthTurnWindowCardNative(game);
}
export function advanceTruthTurnWindowCard(game: Game, until: (state: Game) => boolean,
  actions: TruthTurnWindowCardStep[] = [], nativeOnly = false): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original window-card source ended before its native boundary');
    const next = nativeOnly ? nextTruthTurnWindowCardNative(game) : nextTruthTurnWindowCard(game);
    assert.ok(next, 'Supply the original Truthtrance question or native private plan');
    game = actTruthTurnWindowCard(game, next.actor, next.action, actions);
  }
  throw Error('The genuine window-card chronology did not reach its finite boundary');
}
export function settleTruthTurnWindowCard(game: Game, actions: TruthTurnWindowCardStep[] = []): Game {
  return advanceTruthTurnWindowCard(game, truthTurnWindowCardClean, actions, true);
}

/** Genuine original Basic A/H/E base33. Only original unopened deal/Spice
 * positions and scalar lotteries are chosen. Atomics earns actual Shield Wall
 * casualties by paying for two original reserves during the preceding turn. */
export function createTruthTurnWindowCardFixture(options: {
  effect?: WindowCardEffect; window?: 'beforeDials' | 'afterReveal'; advanced?: boolean;
  pairedTruthAndHajr?: boolean;
} = {}) {
  const effect = options.effect ?? 'weather', window = options.window ?? 'beforeDials';
  const advanced = options.advanced ?? false;
  const pairedTruthAndHajr = options.pairedTruthAndHajr ?? false;
  assert.ok(!advanced || effect === 'harvester', 'This bounded Advanced adapter covers original dual Spice blows only');
  assert.ok(!pairedTruthAndHajr || effect === 'weather', 'The paired original Truth/Hajr deal belongs to this Weather source');
  const asker = 'atreides', target = 'harkonnen', observer = 'emperor', recipient = asker;
  let game = createGame('TRUTHTURNWINDOWCARD', newPlayer(asker, 'Atreides', 'atreides'), advanced);
  joinGame(game, newPlayer(target, 'Harkonnen', 'harkonnen'));
  joinGame(game, newPlayer(observer, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: TruthTurnWindowCardStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthTurnWindowCard(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthTurnWindowCard(game, until, actions, true); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup'); assert.equal(game.deck.length, 33);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalCards = truthTurnWindowCardInventory(game), originalTraitors = truthTurnWindowCardTraitors(game);
  const truth = game.deck.find(card => card.effect === 'truthtrance');
  const printed = game.deck.find(card => card.effect === effect);
  const filler = game.deck.find(card => pairedTruthAndHajr ? card.effect === 'hajr' : card.kind === 'projectile');
  const other = game.deck.find(card => pairedTruthAndHajr ? card.effect === 'truthtrance' && card.id !== truth?.id
    : effect === 'atomics' ? card.effect === 'weather' : card.kind === 'shield');
  assert.ok(truth && printed && filler && other);
  const deal = [truth.id, printed.id, filler.id, other.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game); reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthTurnWindowCardPlayer(game, asker).hand.map(card => card.id), [truth.id]);
  assert.deepEqual(truthTurnWindowCardPlayer(game, target).hand.map(card => card.id), [printed.id, filler.id]);
  assert.deepEqual(truthTurnWindowCardPlayer(game, observer).hand.map(card => card.id), [other.id]);
  assert.deepEqual(truthTurnWindowCardPlayer(game, target).forces, { 'carthag:11': 10 });
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  let spiceOrder: ReturnType<typeof orderIxSpiceCards> = [], beforeBlow: Game | null = null;
  let wallShipment: { before: Game; steps: TruthTurnWindowCardStep[]; after: Game } | null = null;
  let beforeSecondStorm: Game | null = null;
  if (effect !== 'weather') {
    reach(beforeIxSpiceDraw);
    const land = game.spiceDeck.filter(card => 'territory' in card && !card.discovery && card.sector !== game.storm)
      .slice(0, advanced ? 2 : 1);
    assert.equal(land.length, advanced ? 2 : 1);
    spiceOrder = orderIxSpiceCards(game, land.map(card => { assert.ok('territory' in card); return { territory: card.territory }; }));
    beforeBlow = structuredClone(game);
    if (effect === 'harvester') reach(state => !!state.spiceWindow && truthTurnWindowCardClean(state));
    else {
      reach(state => state.turn === 1 && state.phase === 5 && state.active === target && truthTurnWindowCardClean(state));
      const before = structuredClone(game), from = actions.length;
      act(target, { type: 'ship', territory: 'shield_wall', sector: 9, amount: 2, elite: 0, allyPayment: 0 });
      reach(truthTurnWindowCardClean);
      wallShipment = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
      assert.equal(truthTurnWindowCardPlayer(before, target).spice - truthTurnWindowCardPlayer(game, target).spice, 4);
      assert.equal(truthTurnWindowCardPlayer(game, target).forces['shield_wall:9'], 2);
      act(target, { type: 'endMovement' });
      reach(state => state.turn === 2 && state.phase === 0 && truthTurnWindowCardClean(state));
      beforeSecondStorm = structuredClone(game);
    }
  } else reach(state => state.phase === 0 && truthTurnWindowCardClean(state));
  const beforeDials = structuredClone(game), beforeDialsActions = structuredClone(actions);
  if (effect !== 'harvester' && window === 'afterReveal')
    reach(state => state.phase === 0 && state.stormPending !== null && truthTurnWindowCardClean(state));
  const opportunity = windowCardOpportunity(game, effect); assert.ok(opportunity);
  assert.equal(game.phase, effect === 'harvester' ? 1 : 0);
  if (effect !== 'harvester') assert.equal(game.stormCardWindowOpen, true);
  if (effect === 'atomics') {
    assert.ok(wallShipment); assert.equal(game.turn, 2); assert.equal(game.shieldWallDestroyed, false);
    assert.equal(truthTurnWindowCardPlayer(game, target).forces['shield_wall:9'], 2);
    assert.equal(truthTurnWindowCardPlayer(game, target).spice, 6);
  }
  assert.ok(truthTurnWindowCardPlayer(game, target).hand.some(card => card.id === printed.id));
  assert.deepEqual(truthTurnWindowCardInventory(game), originalCards);
  assert.deepEqual(truthTurnWindowCardTraitors(game), originalTraitors);
  const source = opportunity.source, nativeAction: Action = { type: 'card', card: printed.id,
    ...(effect === 'weather' ? { amount: 0 } : {}) };
  const mixed = truthTurnWindowCardGroup('and', truthTurnWindowCardPlay(effect, source), truthTurnWindowCardPayment(recipient));
  const question = { kind: 'turnActions', target, turn: game.turn, mixed } satisfies TruthQuestion;
  const spiceFact: TruthFact = { kind: 'spice', compare: 'eq', value: truthTurnWindowCardPlayer(game, target).spice };
  return { game, initial, lobby, setup, beforeStartingDeal, afterSetup, asker, target, observer, recipient,
    effect, source, opportunity, window, advanced, pairedTruthAndHajr,
    truth: truth.id, card: printed.id, filler: filler.id, foreignCard: other.id,
    hajr: pairedTruthAndHajr ? filler.id : null,
    nativeAction, payment: { type: 'bribe', target: recipient, amount: 2 } satisfies Action, mixed, question, spiceFact,
    originalCards, originalTraitors, originalSpice, dealOrder, spiceOrder, beforeBlow,
    beforeDials, beforeDialsActions, wallShipment, beforeSecondStorm,
    originalBlow: structuredClone(game.spiceWindow ?? null),
    actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { selected: actions.length, beforeDials: beforeDialsActions.length,
      actualWallShipment: wallShipment?.steps.length ?? 0 },
    sourceDisclosure: `Actual public ${advanced ? 'Advanced preview' : 'Basic'} Atreides/Harkonnen/Emperor base33 ready/start, native private Traitors and starting forces. ` +
      'Only original unopened starting Treachery positions, safe original unopened land Spice positions when used, and scalar lotteries are selected. ' +
      (pairedTruthAndHajr
        ? 'Atreides and Emperor each receive a different original Truthtrance; Harkonnen really receives original Weather Control and Hajr through its native two-card start. '
        : 'Atreides receives one original Truthtrance; Harkonnen really receives its printed role and a distinct original projectile through its native two-card start. ') +
      (effect === 'atomics' ? 'Harkonnen pays four spice for two original reserve counters on Shield Wall9, actually ends Movement and completes the first turn before original Storm2; those two real counters remain available for actual Atomics casualties. Emperor holds original Weather Control. '
        : effect === 'harvester' ? 'Complete original Storm1 and actually draw the selected original safe land Spice card; stop at its fresh native blow and original event. ' +
          (advanced ? 'The original second safe land card remains next for the actual Advanced second-blow continuation. ' : '')
          : 'Stop at original Storm1 before any dial or after the actual original dial reveal, before storm movement. ') +
      'Every count comes from its recorded action array. No hand, purse, army, phase, wall, spice, clock, printed play or promise is installed.',
  };
}
export type TruthTurnWindowCardFixture = ReturnType<typeof createTruthTurnWindowCardFixture>;
export function declareTruthTurnWindowCard(f: TruthTurnWindowCardFixture, source = f.game,
  actions: TruthTurnWindowCardStep[] = []) {
  let game = actTruthTurnWindowCard(source, f.asker, { type: 'card', card: f.truth }, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthTurnWindowCard(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask'); return { game, actions };
}
export function askTruthTurnWindowCard(game: Game, asker: string, target: string, mixed: TruthTurnWindowCardExpression,
  actions: TruthTurnWindowCardStep[] = []): Game {
  return actTruthTurnWindowCard(game, asker, { type: 'truthAsk', question: {
    kind: 'turnActions', target, turn: game.turn, mixed: structuredClone(mixed),
  } }, actions);
}
export function answerTruthTurnWindowCard(game: Game, target: string, answer: 'yes' | 'no' | 'unknown',
  actions: TruthTurnWindowCardStep[] = []): Game {
  return actTruthTurnWindowCard(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthTurnWindowCard(f: TruthTurnWindowCardFixture, answer: 'yes' | 'no' = 'yes', mixed = f.mixed,
  source = f.game, actions: TruthTurnWindowCardStep[] = []) {
  const declared = declareTruthTurnWindowCard(f, source, actions);
  const asked = askTruthTurnWindowCard(declared.game, f.asker, f.target, mixed, actions);
  return { game: answerTruthTurnWindowCard(asked, f.target, answer, actions), declared, asked, actions };
}
export function truthTurnWindowCardPromise(game: Game, target = game.turnActionPromises![0].player) {
  const row = viewGame(game, target).turnActionPromises.find(candidate => candidate.player === target); assert.ok(row); return row;
}
export function closeTruthTurnWindowCard(game: Game, f: TruthTurnWindowCardFixture,
  actions: TruthTurnWindowCardStep[] = []): Game {
  return advanceTruthTurnWindowCard(game,
    state => truthTurnWindowCardClean(state) && windowCardOpportunity(state, f.effect)?.source !== f.source, actions, true);
}
export function finishTruthTurnWindowCard(game: Game, actions: TruthTurnWindowCardStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthTurnWindowCard(game, state => state.turn === turn + 1 && state.phase === 0 && truthTurnWindowCardClean(state), actions);
}
