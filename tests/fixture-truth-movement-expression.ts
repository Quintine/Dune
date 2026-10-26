import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { parseMovementExpression, type MovementExpression } from '../game/movement-expression-promises';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import {
  actTruthMovement, createTruthMovementFixture, truthMovementClean,
  truthMovementInventory, truthMovementPlayer, type TruthMovementStep,
} from './fixture-truth-movement';
import { createTruthMovementAdvancedFixture } from './fixture-truth-movement-advanced';

export type TruthMovementExpressionStep = TruthMovementStep;
export const actTruthMovementExpression = actTruthMovement;
export const truthMovementExpressionClean = truthMovementClean;
export const truthMovementExpressionInventory = truthMovementInventory;
export const truthMovementExpressionPlayer = truthMovementPlayer;

/** Every continuation uses the original native response/readiness controls.
 * A live grouped obligation uses the same exact action the player sees. */
export function nextTruthMovementExpression(game: Game): TruthMovementExpressionStep | null {
  if (game.truthtrance) return null;
  for (const player of game.players) {
    const guide = viewGame(game, player.id).movementExpressionPromiseGuide;
    if (guide?.phase === game.phase) return { actor: player.id, action: guide.action };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceTruthMovementExpression(game: Game, until: (state: Game) => boolean,
  actions: TruthMovementExpressionStep[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original grouped movement source ended before its requested control');
    const next = nextTruthMovementExpression(game);
    assert.ok(next, 'Supply the original grouped Truthtrance question or answer');
    game = actTruthMovementExpression(game, next.actor, next.action, actions);
  }
  throw Error('The original grouped movement source did not reach its finite boundary');
}
export function settleTruthMovementExpression(game: Game, actions: TruthMovementExpressionStep[] = []): Game {
  return advanceTruthMovementExpression(game, truthMovementExpressionClean, actions);
}
export function finishTruthMovementExpression(game: Game, target = game.players[0].id,
  actions: TruthMovementExpressionStep[] = []): Game {
  game = settleTruthMovementExpression(game, actions);
  assert.equal(game.phase, 5); assert.equal(game.active, target);
  game = actTruthMovementExpression(game, target, { type: 'endMovement' }, actions);
  game = settleTruthMovementExpression(game, actions);
  assert.ok(!game.movementRemaining?.includes(target), 'Only actual owner endMovement closes its interval');
  return game;
}
export function completeTruthMovementExpression(game: Game, target = game.players[0].id,
  actions: TruthMovementExpressionStep[] = []): Game {
  const live = () => game.movementExpressionPromises?.some(promise => promise.player === target &&
    promise.turn === game.turn && promise.answer && !promise.fulfilled && !promise.released);
  for (let count = 0; count < 12 && live(); count++) {
    game = settleTruthMovementExpression(game, actions);
    const guide = viewGame(game, target).movementExpressionPromiseGuide; assert.ok(guide);
    assert.equal(guide.phase, game.phase);
    game = settleTruthMovementExpression(actTruthMovementExpression(game, target, guide.action, actions), actions);
  }
  assert.ok(!live(), 'The exact native movement guide fulfills the accepted whole expression');
  return game;
}

/** Thin adapter over genuine public Basic/Advanced base33 starts. The optional
 * Charity source replays only the original setup prefix from its unopened deal,
 * selects the same still-unopened Spice cards, and stops at real phase2. */
export function createTruthMovementExpressionFixture(options: {
  advanced?: boolean; hajr?: boolean; window?: 'active' | 'charity'; claim?: MovementExpression;
} = {}) {
  const base = options.advanced
    ? createTruthMovementAdvancedFixture({ hajr: options.hajr })
    : createTruthMovementFixture({ hajr: options.hajr });
  const window = options.window ?? 'active';
  let game = structuredClone(base.game), actions = structuredClone(base.actions);
  let afterSetup = structuredClone(base.afterSetup), afterSetupActionCount: number | null = null;
  let spiceOrder = structuredClone(base.spiceOrder);
  if (window === 'charity') {
    const start = base.actions.findIndex(step => step.action.type === 'start'); assert.ok(start >= 0);
    actions = structuredClone(base.actions.slice(0, start + 1));
    game = advanceTruthMovementExpression(structuredClone(base.beforeStartingDeal),
      state => state.status === 'playing', actions);
    afterSetup = structuredClone(game); afterSetupActionCount = actions.length;
    spiceOrder = base.spiceOrder.map(({ position, card }) => {
      const from = game.spiceDeck.findIndex((candidate, index) => index >= position &&
        JSON.stringify(candidate) === JSON.stringify(card));
      assert.ok(from >= position, 'Choose the same original unopened ordinary Spice card');
      const selected = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, selected);
      return { position, from, card: structuredClone(selected) };
    });
    game = advanceTruthMovementExpression(game,
      state => state.turn === 1 && state.phase === 2 && truthMovementExpressionClean(state), actions);
    assert.equal(truthMovementExpressionPlayer(game, base.target).shipped, false);
    assert.equal(truthMovementExpressionPlayer(game, base.target).moved, 0);
    assert.deepEqual(truthMovementExpressionPlayer(game, base.target).forces, { 'arrakeen:10': 10 });
  }
  assert.equal(game.advanced, options.advanced ?? false); assert.deepEqual(game.expansions, []);
  assert.deepEqual(truthMovementExpressionInventory(game), base.originalCards);
  assert.ok(truthMovementExpressionPlayer(game, base.asker).hand.some(card => card.id === base.truth));
  assert.equal(game.movementExpressionPromises, undefined); assert.equal(game.truthtrance ?? null, null);
  const firstMove = { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 9, amount: 1 } satisfies Action;
  const secondMove = { type: 'move', from: 'arrakeen:10', territory: 'carthag', sector: 11, amount: 1 } satisfies Action;
  const claim = parseMovementExpression(options.claim ?? { kind: 'and', terms: [
    { kind: 'move', territory: 'imperial_basin', minimum: 1 },
    { kind: 'move', territory: 'carthag', minimum: 1 },
  ] });
  const question = { kind: 'movementExpression' as const, target: base.target, turn: game.turn, claim };
  return { ...base, base, game, source: structuredClone(game), window, claim, question,
    afterSetup, afterSetupActionCount, spiceOrder,
    actions, sourceActions: actions, sourceActionCount: actions.length, sourceCount: actions.length,
    sourceCounts: { inheritedActive: base.sourceActionCount, setup: afterSetupActionCount, selected: actions.length },
    firstMove, secondMove, sameDestinationMove: { ...firstMove },
    hajrAction: base.hajr ? { type: 'card', card: base.hajr } satisfies Action : null,
    declaration: { type: 'card', card: base.truth } satisfies Action,
    questionAction: { type: 'truthAsk', question } satisfies Action,
    sourceDisclosure: `${base.staging.join(' ')} This grouped adapter changes only the structured question. ${window === 'charity'
      ? 'Its recorded source excludes the original active-window suffix: the unopened deal is replayed, the same unopened Spice selection is preserved, and actual Storm/Spice controls stop at clean Charity.'
      : 'Its recorded source retains the exact original public setup, phase controls and paid one-force Polar Sink shipment.'} The future Imperial Basin9 and Carthag11 ground groups use the original Arrakeen10 army; Hajr remains the actually dealt physical card. No played clock, purse, hand, army, movement allowance, answer or progress is installed.` };
}
export type TruthMovementExpressionFixture = ReturnType<typeof createTruthMovementExpressionFixture>;

export function declareTruthMovementExpression(f: TruthMovementExpressionFixture, source = f.game) {
  const before = structuredClone(source), actions: TruthMovementExpressionStep[] = [];
  let game = actTruthMovementExpression(source, f.asker, f.declaration, actions);
  const opened = structuredClone(game);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthMovementExpression(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, opened, actions, actionCount: actions.length };
}
export function askTruthMovementExpression(game: Game, asker: string, target: string, claim: MovementExpression,
  actions: TruthMovementExpressionStep[] = []): Game {
  return actTruthMovementExpression(game, asker, { type: 'truthAsk', question: {
    kind: 'movementExpression', target, turn: game.turn, claim: parseMovementExpression(claim),
  } }, actions);
}
export function answerTruthMovementExpression(game: Game, target: string, answer: 'yes' | 'no',
  actions: TruthMovementExpressionStep[] = []): Game {
  return actTruthMovementExpression(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthMovementExpression(f: TruthMovementExpressionFixture, answer: 'yes' | 'no' = 'yes',
  claim = f.claim, source = f.game) {
  const declared = declareTruthMovementExpression(f, source), actions = [...declared.actions];
  const asked = askTruthMovementExpression(declared.game, f.asker, f.target, claim, actions);
  const game = answerTruthMovementExpression(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}
