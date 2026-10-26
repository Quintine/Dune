import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import { truthFactAnswer } from '../game/truthtrance';
import { completeTruthBribeExpression } from './fixture-truth-bribe-expression';
import {
  actTruthTurnAction as act, advanceTruthTurnAction as advance, answerTruthTurnAction as answer,
  askTruthTurnAction as ask, bindTruthTurnAction as bind, completeTruthTurnAction as complete,
  createTruthTurnActionFixture as fixture, declareTruthTurnAction as declare, finishTruthTurnAction as finish,
  settleTruthTurnAction as settle, truthTurnActionClean as clean, truthTurnActionFact as fact,
  truthTurnActionGroup as group, truthTurnActionInventory as inventory, truthTurnActionMove as move,
  truthTurnActionPayment as payment, truthTurnActionPlayer as player, truthTurnActionPromise as promise,
  truthTurnActionShip as ship, type TruthTurnActionFixture, type TruthTurnActionStep,
} from './fixture-truth-turn-action';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function truthOnce(game: Game, truth: string) {
  assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}
function nativeControls(game: Game) {
  return { turn: game.turn, phase: game.phase, active: game.active, order: game.order,
    movementRemaining: game.movementRemaining, storm: game.storm, response: game.response ?? null,
    decision: game.decision ?? null, phaseOpening: game.phaseOpening ?? null, pendingShipment: game.pendingShipment ?? null };
}
function scalarQuestion(f: TruthTurnActionFixture, recipient = f.recipient, minimum = 6): TruthQuestion {
  return { kind: 'bribe', target: f.target, turn: f.game.turn, recipient, minimum };
}
function bindQuestion(f: TruthTurnActionFixture, source: Game, copy: 0 | 1, question: TruthQuestion,
  response: 'yes' | 'no' = 'yes', actions: TruthTurnActionStep[] = []) {
  const opened = declare(f, source, copy, actions).game;
  const asked = act(opened, f.asker, { type: 'truthAsk', question }, actions);
  return answer(asked, f.target, response, actions);
}

void test('native turn-action source keeps two original Truths and the real active Atreides movement prefix', () => {
  const f = fixture(); assert.ok(f.orderSource);
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.deck.length, 33);
  assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
  assert.equal(f.setup.deck.filter(card => card.effect === 'truthtrance').length, 2);
  assert.deepEqual(player(f.afterSetup, f.asker).hand.map(card => card.id), f.truths);
  assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
  assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.target); assert.equal(f.target, 'atreides');
  assert.equal(f.recipient, 'emperor'); assert.equal(player(f.game, f.recipient).ally, null);
  assert.equal(f.sourceActionCount, 27); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.equal(f.sourceCount, f.actions.length);
  assert.equal(f.sourceCounts.inherited + f.sourceCounts.nativeContinuation, f.sourceCount);
  assert.deepEqual(f.sourceActions, f.orderSource.sourceActions);
  assert.equal(player(f.game, f.target).spice, 10); assert.equal(player(f.game, f.target).reserves, 10);
  assert.deepEqual(player(f.game, f.target).forces, { 'arrakeen:10': 10 });
  assert.equal(player(f.game, f.target).shipped, false); assert.equal(player(f.game, f.target).moved, 0);
  assert.equal(f.game.truthHistory?.length ?? 0, 0); assert.equal(f.game.turnActionPromises?.length ?? 0, 0);
  assert.deepEqual(inventory(f.game), f.originalCards); assert.equal(f.originalCards.length, 33);
});

void test('native AND Yes pays two real spice and separately ships and moves physical forces at original costs', () => {
  const f = fixture(), source = structuredClone(f.game), recipientSpice = player(f.game, f.recipient).spice;
  let game = bind(f).game;
  assert.deepEqual(f.game, source); assert.deepEqual(nativeControls(game), nativeControls(source));
  assert.deepEqual(promise(game, f.target).mixed, f.mixed); rejected(game, f.target, f.end);
  game = act(game, f.target, f.payment);
  assert.equal(player(game, f.target).spice, 8); assert.equal(player(game, f.recipient).spice, recipientSpice);
  assert.equal(player(game, f.recipient).bribes, 2); assert.ok(!promise(game, f.target).fulfilled);
  assert.deepEqual(game.turnActionPromises![0].payments, [{ recipient: f.recipient, amount: 2 }]);
  rejected(game, f.target, f.end); game = settle(act(game, f.target, f.shipment));
  assert.equal(player(game, f.target).spice, 6); assert.equal(player(game, f.target).reserves, 9);
  assert.equal(player(game, f.target).forces['polar_sink:0'], 1); assert.equal(player(game, f.target).moved, 0);
  assert.deepEqual(game.turnActionPromises![0].progress, []);
  assert.ok(!promise(game, f.target).fulfilled); rejected(game, f.target, f.end);
  game = settle(act(game, f.target, f.move));
  assert.equal(player(game, f.target).forces['arrakeen:10'], 9);
  assert.equal(player(game, f.target).forces['imperial_basin:9'], 1);
  assert.deepEqual(game.turnActionPromises![0].progress, [{ territory: 'imperial_basin', maximum: 1 }]);
  assert.equal(promise(game, f.target).fulfilled, true); assert.ok(!promise(game, f.target).released);
  game = settle(act(game, f.target, f.end)); truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native ordinary payments to one recipient sum while reserve shipment never supplies ground progress', () => {
  const f = fixture(), mixed = group('and', payment(f.recipient, 2), ship('imperial_basin'), move());
  let game = bind(f, 'yes', mixed).game;
  game = act(game, f.target, { ...f.payment, amount: 1 });
  game = settle(act(game, f.target, { ...f.shipment, territory: 'imperial_basin', sector: 9 }));
  assert.equal(player(game, f.recipient).bribes, 1); assert.equal(player(game, f.target).forces['imperial_basin:9'], 1);
  assert.equal(player(game, f.target).moved, 0); assert.ok(!promise(game, f.target).fulfilled);
  game = act(game, f.target, { ...f.payment, amount: 1 });
  assert.equal(player(game, f.recipient).bribes, 2); assert.ok(!promise(game, f.target).fulfilled);
  assert.deepEqual(game.turnActionPromises![0].payments, [{ recipient: f.recipient, amount: 2 }]);
  rejected(game, f.target, f.end); game = settle(act(game, f.target, f.move));
  assert.equal(player(game, f.target).forces['imperial_basin:9'], 2);
  assert.equal(promise(game, f.target).fulfilled, true); truthOnce(game, f.truth);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native repeated smaller Hajr groups retain one movement maximum rather than summed force arrivals', () => {
  const f = fixture({ source: 'hajr' }); assert.ok(f.hajrAction); assert.ok(f.hajrSource);
  const mixed = group('and', payment(f.recipient), ship(), move('imperial_basin', 2));
  let game = bind(f, 'no', mixed).game;
  game = act(game, f.target, f.payment); game = settle(act(game, f.target, f.shipment));
  game = settle(act(game, f.target, f.move)); game = settle(act(game, f.target, f.hajrAction));
  game = settle(act(game, f.target, f.move));
  assert.equal(player(game, f.target).moved, 2); assert.equal(player(game, f.target).forces['imperial_basin:9'], 2);
  assert.deepEqual(game.turnActionPromises![0].progress, [{ territory: 'imperial_basin', maximum: 1 }]);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target).released);
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true);
  truthOnce(game, f.truth); assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native OR Yes retains either manual payment or movement route without fixing its alternative', () => {
  const f = fixture(), mixed = group('or', payment(f.recipient), move()), bound = bind(f, 'yes', mixed).game;
  for (const action of [f.payment, f.move]) {
    let game = settle(act(bound, f.target, action));
    assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(promise(game, f.target).mixed, mixed);
    assert.equal(player(game, f.target).reserves, 10);
    assert.equal(player(game, f.target).moved, action.type === 'move' ? 1 : 0);
    assert.equal(player(game, f.recipient).bribes, action.type === 'bribe' ? 2 : 0);
    game = settle(act(game, f.target, f.end)); truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('native OR cumulative payments preserve both partial and full-purse payment routes alongside shipment', () => {
  const f = fixture(), mixed = group('or', payment(f.recipient, 10), ship());
  const bound = bind(f, 'yes', mixed).game;
  assert.equal(player(bound, f.target).spice, 10);
  const options = viewGame(bound, f.target).bribeOptions;
  assert.equal(options.blocked, null); assert.equal(options.available, 10);
  assert.equal(options.targets.find(target => target.id === f.recipient)?.maximum, 10);
  // Nine leaves one funded spice and nine progress: a final one-spice
  // payment still completes this OR, even when shipment is no longer funded.
  let partial = act(bound, f.target, { ...f.payment, amount: 9 });
  assert.equal(player(partial, f.target).spice, 1); assert.ok(!promise(partial, f.target).fulfilled);
  partial = act(partial, f.target, f.end);
  partial = act(partial, f.target, { ...f.payment, amount: 1 });
  assert.equal(promise(partial, f.target).fulfilled, true);
  assert.deepEqual(partial.turnActionPromises![0].payments, [{ recipient: f.recipient, amount: 10 }]);
  const paid = act(bound, f.target, { ...f.payment, amount: 10 });
  assert.equal(player(paid, f.target).spice, 0); assert.equal(player(paid, f.recipient).bribes, 10);
  assert.equal(player(paid, f.target).reserves, 10); assert.equal(player(paid, f.target).moved, 0);
  assert.equal(promise(paid, f.target).fulfilled, true); assert.ok(!promise(paid, f.target).released);
  const shipped = settle(act(bound, f.target, f.shipment));
  assert.equal(player(shipped, f.target).spice, 8); assert.equal(player(shipped, f.target).reserves, 9);
  assert.equal(player(shipped, f.target).forces['polar_sink:0'], 1);
  assert.equal(player(shipped, f.recipient).bribes, 0); assert.equal(promise(shipped, f.target).fulfilled, true);
  for (const state of [partial, paid, shipped]) { truthOnce(state, f.truth); assert.deepEqual(inventory(state), f.originalCards); }
});

void test('native payment OR movement Yes may close own transport then pay in late Mentat before Ready', () => {
  const f = fixture(), mixed = group('or', payment(f.recipient), move());
  let game = bind(f, 'yes', mixed).game;
  game = settle(act(game, f.target, f.end));
  assert.equal(player(game, f.target).moved, 0); assert.equal(player(game, f.target).reserves, 10);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target).released);
  game = advance(game, state => state.phase === 8 && clean(state), [], true);
  assert.ok(!promise(game, f.target).fulfilled); rejected(game, f.target, { type: 'ready' });
  game = act(game, f.target, f.payment); assert.equal(promise(game, f.target).fulfilled, true);
  game = act(game, f.target, { type: 'ready' }); assert.ok(game.ready.includes(f.target));
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native whole No keeps its payment cap after own transport closes and through actual current turn end', () => {
  const f = fixture(), mixed = group('or', payment(f.recipient), move());
  let game = bind(f, 'no', mixed).game;
  rejected(game, f.target, f.move); rejected(game, f.target, f.payment);
  game = act(game, f.target, { ...f.payment, amount: 1 }); game = settle(act(game, f.target, f.end));
  assert.ok(!promise(game, f.target).fulfilled);
  game = advance(game, state => state.phase === 8 && clean(state), [], true);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target).released);
  rejected(game, f.target, { ...f.payment, amount: 1 });
  game = finish(game); assert.equal(game.turn, 2); assert.equal(promise(game, f.target).fulfilled, true);
  const oldReceipt = structuredClone(game.turnActionPromises![0]);
  game = act(game, f.target, f.payment); assert.deepEqual(game.turnActionPromises![0], oldReceipt);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('controlled known Inflation Double rejects a late payment-only Yes and retains truthful No', () => {
  const f = fixture({ source: 'mentat' }), controlled = structuredClone(f.game);
  // Original played source and inventory; only the public timing token is a
  // controlled variant, not an asserted original CHOAM journey.
  controlled.inflation = { side: 'double', placedTurn: 0, updatedTurn: 0, flipped: false };
  const opened = declare(f, controlled).game;
  const asked = ask(opened, f.asker, f.target, f.mixed);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const game = answer(asked, f.target, 'no');
  assert.equal(viewGame(game, f.target).turnActionGuide?.action.type, 'ready');
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native current-spice facts freeze at the answer before real payments reduce the purse', () => {
  const f = fixture(), mixed = group('and', fact(f.spiceFact), payment(f.recipient), ship(), move());
  assert.equal(truthFactAnswer(player(f.game, f.target), f.spiceFact), 'yes');
  let game = bind(f, 'yes', mixed).game; game = act(game, f.target, f.payment);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no'); assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, f.end); game = settle(act(game, f.target, f.shipment));
  game = settle(act(game, f.target, f.move)); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(promise(game, f.target).mixed, mixed); truthOnce(game, f.truth);
  assert.deepEqual(inventory(game), f.originalCards);
});

for (const first of ['scalar', 'aggregate'] as const) void test(`two native Truths share one actual payment in ${first}-first acceptance order`, () => {
  const f = fixture(), mixed = group('and', payment(f.recipient, 6), ship(), move());
  const aggregate: TruthQuestion = { kind: 'turnActions', target: f.target, turn: f.game.turn, mixed };
  const questions = first === 'scalar' ? [scalarQuestion(f), aggregate] : [aggregate, scalarQuestion(f)];
  const actions: TruthTurnActionStep[] = [];
  let game = bindQuestion(f, f.game, 0, questions[0], 'yes', actions);
  const earlierHistory = structuredClone(game.truthHistory![0]);
  game = bindQuestion(f, game, 1, questions[1], 'yes', actions);
  assert.deepEqual(game.truthHistory![0], earlierHistory);
  game = act(game, f.target, { ...f.payment, amount: 6 }, actions);
  assert.equal(game.bribePromises![0].progress, 6); assert.equal(game.bribePromises![0].fulfilled, true);
  assert.equal(player(game, f.recipient).bribes, 6); assert.equal(player(game, f.target).spice, 4);
  assert.ok(!promise(game, f.target).fulfilled); game = settle(act(game, f.target, f.shipment, actions), actions);
  game = settle(act(game, f.target, f.move, actions), actions);
  assert.equal(player(game, f.target).spice, 2); assert.equal(promise(game, f.target).fulfilled, true);
  assert.ok(!game.bribePromises![0].released); assert.equal(game.truthHistory!.length, 2);
  assert.equal(actions.filter(step => step.action.type === 'bribe').length, 1);
  for (const truth of f.truths) truthOnce(game, truth); assert.deepEqual(inventory(game), f.originalCards);
});

for (const first of ['scalar', 'aggregate'] as const) void test(`two native Truths reject overbooking original cash in ${first}-first acceptance order`, () => {
  const f = fixture(), mixed = group('and', payment(f.asker, 1), ship(), move());
  const aggregate: TruthQuestion = { kind: 'turnActions', target: f.target, turn: f.game.turn, mixed };
  const scalar = scalarQuestion(f, f.recipient, 8);
  let game = bindQuestion(f, f.game, 0, first === 'scalar' ? scalar : aggregate);
  const history = structuredClone(game.truthHistory), earlier = structuredClone(first === 'scalar'
    ? game.bribePromises![0] : game.turnActionPromises![0]);
  game = act(declare(f, game, 1).game, f.asker, { type: 'truthAsk', question: first === 'scalar' ? aggregate : scalar });
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.deepEqual(game.truthHistory, history);
  assert.deepEqual(first === 'scalar' ? game.bribePromises![0] : game.turnActionPromises![0], earlier);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.truths[1]));
  assert.equal(player(game, f.target).spice, 10); assert.deepEqual(inventory(game), f.originalCards);
});

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} late Mentat payer fulfills before the receiver's next opening receipt`, () => {
  const f = fixture({ source: 'mentat', advanced }); assert.ok(f.mentatSource);
  assert.equal(f.sourceActionCount, advanced ? 35 : 32); assert.equal(f.sourceActionCount, f.sourceActions.length);
  let game = act(f.game, f.target, { type: 'ready' }); game = act(game, f.asker, { type: 'ready' });
  assert.equal(game.phase, 8); const recipientSpice = player(game, f.recipient).spice;
  game = bind(f, 'yes', f.mixed, game).game;
  assert.ok(!game.ready.includes(f.target)); assert.ok(game.ready.includes(f.asker));
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, f.payment);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(player(game, f.target).spice, 8);
  assert.equal(player(game, f.recipient).spice, recipientSpice); assert.equal(player(game, f.recipient).bribes, 2);
  const receipt = structuredClone(game.turnActionPromises![0].payments);
  game = act(game, f.target, { type: 'ready' });
  const result = completeTruthBribeExpression(f.mentatSource, game);
  assert.equal(result.nextTurn.after.turn, 2); assert.equal(result.nextTurn.after.phase, 0);
  assert.equal(player(result.nextTurn.after, f.recipient).bribes, 2);
  assert.equal(player(result.mentat.before, f.recipient).bribes, 2);
  assert.equal(player(result.mentat.after, f.recipient).bribes, 0);
  assert.equal(player(result.mentat.after, f.recipient).spice - player(result.mentat.before, f.recipient).spice, 2);
  assert.deepEqual(result.game.turnActionPromises![0].payments, receipt, 'Actual later income must not count the payer action twice');
  assert.equal(promise(result.game, f.target).fulfilled, true);
  truthOnce(result.game, f.truth); assert.deepEqual(inventory(result.game), f.originalCards);
});

void test('native turn-action raw projection and exact current-step guide preserve owner phase and event authority', () => {
  const f = fixture(), declared = declare(f);
  rejected(declared.game, f.target, { type: 'truthAsk', question: f.question });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  const asked = ask(declared.game, f.asker, f.target, f.mixed);
  rejected(asked, f.asker, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'yes');
  const row = promise(game, f.target), required = ['event', 'player', 'asker', 'turn', 'mixed', 'answer'];
  assert.ok(required.every(key => Object.keys(row).includes(key)));
  assert.ok(Object.keys(row).every(key => [...required, 'fulfilled', 'released'].includes(key)));
  assert.deepEqual(viewGame(game, f.target).truthHistory.at(-1)?.question, f.question);
  for (const actor of [f.asker, f.observer]) {
    assert.deepEqual(viewGame(game, actor).turnActionPromises, []); assert.equal(viewGame(game, actor).turnActionGuide, null);
  }
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.event, row.event); assert.equal(guide.action.turnActionPromiseEvent, row.event);
  assert.equal(guide.action.turnActionPromisePhase, game.phase);
  rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-native-turn-action-event' });
  rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 4 });
  rejected(game, f.target, { ...guide.action, amount: Number(guide.action.amount) + 1 });
  const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, wire));
  rejected(game, f.target, wire); game = complete(game, f.target); rejected(game, f.target, guide.action);
  assert.equal(promise(game, f.target).fulfilled, true); truthOnce(game, f.truth);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal profiles actually answer and perform the current native payment shipment and movement guides', () => {
  const f = fixture(), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked); const actions: TruthTurnActionStep[] = [];
    const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    const before = structuredClone(answering), answerAction = botActions(answering).find(action => action.type === 'truthAnswer');
    assert.ok(answerAction, difficulty); assert.deepEqual(answering, before); assert.equal(answerAction.answer, 'yes', difficulty);
    game = act(game, f.target, answerAction, actions);
    for (let count = 0; count < 12 && !promise(game, f.target).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const guide = view.turnActionGuide; assert.ok(guide, difficulty);
      const action = botActions(view).find(action => action.turnActionPromiseEvent === guide.event);
      assert.ok(action, difficulty); assert.deepEqual(action, guide.action);
      game = settle(act(game, f.target, action, actions), actions);
    }
    assert.equal(promise(game, f.target).fulfilled, true, difficulty);
    for (const kind of ['bribe', 'ship', 'move']) assert.ok(actions.some(step => step.action.type === kind), `${difficulty}: ${kind}`);
    assert.equal(player(game, f.target).spice, 6); assert.equal(player(game, f.target).reserves, 9);
    assert.equal(player(game, f.target).moved, 1); assert.equal(player(game, f.recipient).bribes, 2);
    truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
  }
});
