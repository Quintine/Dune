import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actTruthBid, createTruthBidFixture, nextTruthBid, truthBidClean, truthBidInventory, truthBidPlayer,
  type TruthBidStep,
} from './fixture-truth-bid';

export type TruthBribeStep = TruthBidStep;
export type TruthBribeTransition = { before: Game; steps: TruthBribeStep[]; after: Game };
export const actTruthBribe = actTruthBid;
export const truthBribeClean = truthBidClean;
export const truthBribeInventory = truthBidInventory;
export const truthBribePlayer = truthBidPlayer;
export const truthBribeBalances = (game: Game) => Object.fromEntries(game.players.map(player => [player.id, player.spice]));
export const truthBribeDeferred = (game: Game) => Object.fromEntries(game.players.map(player => [player.id, player.bribes]));

export function nextTruthBribe(game: Game): TruthBribeStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const view = viewGame(game, player.id);
    if (view.bribePromiseGuide) return { actor: player.id, action: view.bribePromiseGuide.action };
    if (view.bidPromiseGuide) return { actor: player.id, action: view.bidPromiseGuide.action };
    if (view.revivalPromiseGuide?.phase === game.phase) return { actor: player.id, action: view.revivalPromiseGuide.action };
  }
  return nextTruthBid(game);
}
export function advanceTruthBribe(game: Game, until: (state: Game) => boolean, actions: TruthBribeStep[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine bribe source ended before its native control');
    const next = nextTruthBribe(game); assert.ok(next, 'The original Truthtrance question and answer belong to their callers');
    game = actTruthBribe(game, next.actor, next.action, actions);
  }
  throw Error('The genuine bribe source did not reach its finite boundary');
}
export function settleTruthBribe(game: Game, actions: TruthBribeStep[] = []): Game {
  return advanceTruthBribe(game, truthBribeClean, actions);
}
export function finishTruthBribe(game: Game, actions: TruthBribeStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthBribe(game, state => state.turn === turn + 1 && state.phase === 0 && truthBribeClean(state), actions);
}

/** The original public H/A/E source supplies both physical Truthtrances and
 * ten actually available Emperor spice. No optional modules or alliances are
 * introduced. Phase7 is earned through real quiet phase actions and original
 * Collection, never a clock/wallet/army/hand/question/promise installation. */
export function createTruthBribeFixture(options: {
  advanced?: boolean; window?: 'waiting' | 'active'; recipient?: 'harkonnen' | 'atreides'; minimum?: number; phase?: 3 | 7;
} = {}) {
  const base = createTruthBidFixture({ advanced: options.advanced, window: options.window ?? 'waiting' });
  const recipient = options.recipient ?? base.asker, minimum = options.minimum ?? 3, phase = options.phase ?? 3;
  let game = structuredClone(base.game); const actions = structuredClone(base.sourceActions);
  if (phase === 7) game = advanceTruthBribe(game, state => state.phase === 7 && truthBribeClean(state), actions);
  assert.equal(game.phase, phase); assert.equal(truthBribePlayer(game, base.target).spice, 10);
  assert.equal(truthBribePlayer(game, recipient).ally, null);
  assert.deepEqual(truthBribeInventory(game), base.originalCards);
  const question = { kind: 'bribe' as const, target: base.target, turn: game.turn, recipient, minimum };
  return { ...base, game, sourceGame: structuredClone(game), base, recipient, minimum, phase, payer: base.target,
    question, questionAction: { type: 'truthAsk', question } as Action,
    bribeAction: { type: 'bribe', target: recipient, amount: minimum } as Action,
    originalBalances: truthBribeBalances(game), originalDeferred: truthBribeDeferred(game),
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[], sourceDisclosure: 'Genuine public original H/A/E base33 setup and ordinary auction; H holds both original Truthtrances, E its original Shield and10spice. Only inherited unopened deal/lot/Spice positions and scalar lotteries are selected. Phase7, if requested, follows actual native controls/Collection. Ordinary bribes debit the payer now and credit the named nonally only at actual Mentat. No played state or promise is installed.' };
}
export type TruthBribeFixture = ReturnType<typeof createTruthBribeFixture>;
type TruthBribeSource = { game: Game; asker: string; target: string; truths: string[] };
export function declareTruthBribe(f: TruthBribeSource, state = f.game, options: { copies?: 1 | 2 } = {}) {
  let game = state; const before = structuredClone(game), actions: TruthBribeStep[] = [];
  const declaration: Action = { type: 'card', card: f.truths[0], ...(options.copies === 2 ? { cards: [f.truths[1]] } : {}) };
  game = actTruthBribe(game, f.asker, declaration, actions);
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthBribe(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, declaration, actions, actionCount: actions.length };
}
export function askTruthBribe(game: Game, asker: string, target: string, recipient: string, minimum = 3,
  actions: TruthBribeStep[] = []): Game {
  return actTruthBribe(game, asker, { type: 'truthAsk', question: { kind: 'bribe', target, turn: game.turn, recipient, minimum } }, actions);
}
export function answerTruthBribe(game: Game, target: string, answer: 'yes' | 'no', actions: TruthBribeStep[] = []): Game {
  return actTruthBribe(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthBribe(f: TruthBribeFixture, answer: 'yes' | 'no' = 'yes', minimum = f.minimum,
  recipient = f.recipient, state = f.game) {
  const declared = declareTruthBribe(f, state), actions = [...declared.actions];
  const asked = askTruthBribe(declared.game, f.asker, f.target, recipient, minimum, actions);
  const game = answerTruthBribe(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}

/** Isolate deferred payment from ordinary Collection first, then enter the
 * actual Mentat that credits it. A final real turn boundary permits callers to
 * inspect the old No's expiration without installing a new clock. */
export function completeTruthBribe(f: TruthBribeFixture, state = f.game) {
  let game = state; const actions: TruthBribeStep[] = [];
  const transition = (until: (state: Game) => boolean): TruthBribeTransition => {
    const before = structuredClone(game), from = actions.length;
    game = advanceTruthBribe(game, until, actions);
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  const collection = transition(state => state.phase === 7 && truthBribeClean(state));
  const mentat = transition(state => state.phase === 8 && truthBribeClean(state));
  const nextTurn = transition(state => state.turn === f.game.turn + 1 && state.phase === 0 && truthBribeClean(state));
  assert.deepEqual(truthBribeInventory(game), f.originalCards);
  return { game, collection, mentat, nextTurn, actions, actionCount: actions.length };
}
