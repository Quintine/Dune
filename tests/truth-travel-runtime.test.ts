import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import {
  actTruthTravel as act, answerTruthTravel as answer, askTruthTravel as ask, bindTruthTravel as bind,
  completeTruthTravel as complete, createTruthTravelFixture as fixture, declareTruthTravel as declare,
  finishTruthTravel as finish, settleTruthTravel as settle, truthTravelClean as clean,
  truthTravelFact as fact, truthTravelGroup as group, truthTravelInventory as inventory,
  truthTravelMove as move, truthTravelPlayer as player, truthTravelPromise as promise,
  truthTravelShip as ship, type TruthTravelExpression, type TruthTravelStep,
} from './fixture-truth-travel';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physicalTruthOnce(game: Game, truth: string) {
  assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}
function nativeControls(game: Game) {
  return { turn: game.turn, phase: game.phase, active: game.active, order: game.order,
    movementRemaining: game.movementRemaining, storm: game.storm,
    response: game.response ?? null, decision: game.decision ?? null,
    phaseOpening: game.phaseOpening ?? null, pendingShipment: game.pendingShipment ?? null };
}
const progress = (game: Game, target: string) => game.travelPromises!.find(row => row.player === target)!.progress;

void test('native travel source freezes only the original Basic prefix before its one paid reserve shipment', () => {
  const f = fixture();
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.deck.length, 33);
  assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
  assert.equal(f.game.advanced, false); assert.deepEqual(f.game.expansions, []);
  assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.target);
  assert.equal(f.sourceCount, f.sourceActions.length); assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(f.actions, f.activeSource!.actions.slice(0, f.sourceCounts.shipment!));
  assert.deepEqual(f.activeSource!.actions[f.sourceActionCount], f.shipmentStep);
  assert.equal(f.sourceCounts.inherited, f.sourceCount + 1);
  assert.deepEqual(player(f.game, f.target).forces, { 'arrakeen:10': 10 });
  assert.equal(player(f.game, f.target).reserves, 10); assert.equal(player(f.game, f.target).shipped, false);
  assert.equal(player(f.game, f.target).moved, 0); assert.equal(f.game.truthHistory?.length ?? 0, 0);
  assert.equal(f.game.travelPromises?.length ?? 0, 0); assert.equal(f.game.truthtrance ?? null, null);
  assert.deepEqual(inventory(f.game), f.originalCards); assert.equal(f.originalCards.length, 33);
  assert.equal(f.setup.deck.filter(card => card.effect === 'truthtrance').length, 2);
  assert.equal(f.game.players.flatMap(player => player.hand).filter(card => card.effect === 'truthtrance').length, 1,
    'Only one original Truthtrance has actually been dealt in this source; an undrawn copy is not a second owned answer');
});

void test('native AND Yes requires the original shipment and a distinct actual ground move before own end', () => {
  const f = fixture(), source = structuredClone(f.game), beforeSpice = player(f.game, f.target).spice;
  const bound = bind(f); let game = bound.game;
  assert.deepEqual(f.game, source); assert.deepEqual(nativeControls(game), nativeControls(source));
  assert.deepEqual(promise(game, f.target).mixed, f.mixed); assert.deepEqual(progress(game, f.target), []);
  physicalTruthOnce(game, f.truth); rejected(game, f.target, f.currentEnd);
  game = settle(act(game, f.target, f.shipmentAction));
  assert.equal(player(game, f.target).spice, beforeSpice - f.shipmentCost);
  assert.equal(player(game, f.target).reserves, 9); assert.equal(player(game, f.target).forces['polar_sink:0'], 1);
  assert.deepEqual(progress(game, f.target), []); assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, f.currentEnd);
  game = settle(act(game, f.target, f.firstMove));
  assert.equal(player(game, f.target).forces['imperial_basin:9'], 1);
  assert.equal(player(game, f.target).forces['arrakeen:10'], 9);
  assert.deepEqual(progress(game, f.target), [{ territory: 'imperial_basin', maximum: 1 }]);
  assert.equal(promise(game, f.target).fulfilled, true); assert.ok(!promise(game, f.target).released);
  game = finish(game, f.target); physicalTruthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native OR Yes retains both legal manual routes without selecting a fixed branch', () => {
  const f = fixture(), mixed = group('or', ship(), move()), bound = bind(f, 'yes', mixed).game;
  for (const action of [f.shipmentAction, f.firstMove]) {
    let game = settle(act(bound, f.target, action));
    assert.equal(promise(game, f.target).fulfilled, true);
    assert.deepEqual(promise(game, f.target).mixed, mixed);
    assert.equal(player(game, f.target).moved, action.type === 'move' ? 1 : 0);
    if (action.type === 'move') assert.equal(player(game, f.target).reserves, 10);
    game = finish(game, f.target); physicalTruthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('native No to AND retains either true component and settles only at the respondent actual end', () => {
  const f = fixture(), bound = bind(f, 'no').game;
  for (const action of [f.shipmentAction, f.firstMove]) {
    let game = settle(act(bound, f.target, action));
    assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target).released);
    if (action.type === 'ship') rejected(game, f.target, f.firstMove);
    else rejected(game, f.target, f.shipmentAction);
    game = finish(game, f.target);
    assert.equal(promise(game, f.target).fulfilled, true); assert.ok(!promise(game, f.target).released);
    physicalTruthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('native whole OR No forbids either matching action while preserving nonmatching shipment and movement', () => {
  const f = fixture(), mixed = group('or', ship(), move()); let game = bind(f, 'no', mixed).game;
  rejected(game, f.target, f.shipmentAction); rejected(game, f.target, f.firstMove);
  game = settle(act(game, f.target, { ...f.shipmentAction, territory: 'carthag', sector: 11 }));
  assert.equal(player(game, f.target).forces['carthag:11'], 1); assert.deepEqual(progress(game, f.target), []);
  game = settle(act(game, f.target, f.secondMove));
  assert.equal(player(game, f.target).forces['carthag:11'], 2); assert.ok(!promise(game, f.target).fulfilled);
  game = finish(game, f.target); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native shipment leaves describe the same one future original shipment rather than independent events', () => {
  const f = fixture(), mixed = group('and', ship(), ship('arrakeen'));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthTravelAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'no');
  game = settle(act(game, f.target, f.shipmentAction));
  assert.equal(player(game, f.target).shipped, true); assert.equal(player(game, f.target).reserves, 9);
  game = finish(game, f.target); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native shipment into a named destination contributes no physical ground movement progress', () => {
  const f = fixture(), mixed = group('and', ship('imperial_basin'), move());
  let game = bind(f, 'yes', mixed).game;
  game = settle(act(game, f.target, { ...f.shipmentAction, territory: 'imperial_basin', sector: 9 }));
  assert.equal(player(game, f.target).forces['imperial_basin:9'], 1);
  assert.deepEqual(progress(game, f.target), []); assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, f.currentEnd); game = settle(act(game, f.target, f.firstMove));
  assert.equal(player(game, f.target).forces['imperial_basin:9'], 2);
  assert.deepEqual(progress(game, f.target), [{ territory: 'imperial_basin', maximum: 1 }]);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

void test('native future shipment excludes the original shipment already completed before the answer', () => {
  const f = fixture({ window: 'shipped' }); assert.equal(player(f.game, f.target).shipped, true);
  assert.equal(f.sourceCount, f.sourceCounts.inherited);
  const impossible = group('and', ship(), ship('polar_sink', 1));
  const asked = ask(declare(f).game, f.asker, f.target, impossible);
  assert.deepEqual(viewGame(asked, f.target).truthTravelAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const mixed = group('or', ship(), move()); let game = bind(f, 'yes', mixed).game;
  assert.ok(!promise(game, f.target).fulfilled); assert.deepEqual(progress(game, f.target), []);
  rejected(game, f.target, f.currentEnd); game = settle(act(game, f.target, f.firstMove));
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

void test('native smaller repeated Hajr groups retain the maximum move rather than their accumulated force total', () => {
  const f = fixture(), mixed = group('and', ship(), move('imperial_basin', 2));
  let game = bind(f, 'no', mixed).game;
  game = settle(act(game, f.target, f.shipmentAction));
  game = settle(act(game, f.target, f.firstMove)); game = settle(act(game, f.target, f.hajrAction!));
  game = settle(act(game, f.target, f.sameDestinationMove));
  assert.equal(player(game, f.target).forces['imperial_basin:9'], 2);
  assert.equal(player(game, f.target).moved, 2);
  assert.deepEqual(progress(game, f.target), [{ territory: 'imperial_basin', maximum: 1 }]);
  assert.ok(!promise(game, f.target).fulfilled); game = finish(game, f.target);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native voluntary spending or consuming the last move cannot erase an accepted travel Yes', () => {
  const f = fixture({ hajr: false }); let game = bind(f).game;
  rejected(game, f.target, { type: 'bribe', target: f.asker, amount: player(game, f.target).spice - 1 });
  game = settle(act(game, f.target, f.shipmentAction));
  rejected(game, f.target, f.secondMove); rejected(game, f.target, f.currentEnd);
  assert.ok(!promise(game, f.target).released); game = settle(act(game, f.target, f.firstMove));
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

void test('native nonqualifying move remains legal when the genuinely held Hajr preserves the missing route', () => {
  const f = fixture(); let game = bind(f).game;
  game = settle(act(game, f.target, f.shipmentAction)); game = settle(act(game, f.target, f.secondMove));
  assert.ok(!promise(game, f.target).fulfilled);
  const guide = viewGame(game, f.target).travelPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.hajr);
  game = complete(game, f.target); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).moved, 2); assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

void test('native mixed travel freezes the actual current-spice fact before an ordinary paid bribe', () => {
  const f = fixture(), mixed = group('and', fact(f.spiceFact), ship(), move());
  const beforeSpice = player(f.game, f.target).spice, beforeBribes = player(f.game, f.asker).bribes;
  assert.ok(beforeSpice >= 5); assert.equal(truthFactAnswer(player(f.game, f.target), f.spiceFact), 'yes');
  let game = bind(f, 'yes', mixed).game;
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  assert.equal(player(game, f.target).spice, beforeSpice - 3);
  assert.equal(player(game, f.asker).bribes, beforeBribes + 3);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  assert.ok(!promise(game, f.target).fulfilled); rejected(game, f.target, f.currentEnd);
  game = settle(act(game, f.target, f.shipmentAction)); game = settle(act(game, f.target, f.firstMove));
  assert.equal(player(game, f.target).spice, beforeSpice - 3 - f.shipmentCost);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(promise(game, f.target).mixed, mixed);
  assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

void test('native true held-card OR travel and false held-card AND travel settle without unnecessary actions', () => {
  const f = fixture();
  for (const [mixed, answerValue] of [
    [group('or', fact(f.hajrFact), ship(), move()), 'yes'],
    [group('and', fact(f.projectileFact), ship(), move()), 'no'],
  ] as const) {
    const asked = ask(declare(f).game, f.asker, f.target, mixed);
    assert.deepEqual(viewGame(asked, f.target).truthTravelAnswers, [answerValue]);
    const game = answer(asked, f.target, answerValue);
    assert.equal(promise(game, f.target).fulfilled, true); assert.equal(viewGame(game, f.target).travelPromiseGuide, null);
    assert.equal(player(game, f.target).shipped, false); assert.equal(player(game, f.target).moved, 0);
    assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
  }
});

void test('native waiting travel answer preserves the current owner queue until the respondent real shipment and move', () => {
  const f = fixture({ window: 'waiting' }); assert.equal(f.game.active, f.asker);
  assert.equal(f.sourceCount, f.actions.length); assert.equal(player(f.game, f.target).reserves, 20);
  assert.deepEqual(player(f.game, f.target).forces, {});
  const before = nativeControls(f.game); let game = bind(f).game;
  assert.deepEqual(nativeControls(game), before); assert.equal(viewGame(game, f.target).travelPromiseGuide, null);
  rejected(game, f.target, f.shipmentAction); rejected(game, f.target, f.firstMove);
  rejected(game, f.target, f.currentEnd);
  game = settle(act(game, f.asker, f.currentEnd));
  assert.equal(game.active, f.target); assert.ok(!promise(game, f.target).fulfilled);
  assert.deepEqual(progress(game, f.target), []);
  const beforeSpice = player(game, f.target).spice;
  game = settle(act(game, f.target, f.shipmentAction));
  assert.equal(player(game, f.target).spice, beforeSpice - f.shipmentCost);
  assert.equal(player(game, f.target).reserves, 19); assert.equal(player(game, f.target).forces['arrakeen:10'], 1);
  assert.deepEqual(progress(game, f.target), []); assert.ok(!promise(game, f.target).fulfilled);
  game = settle(act(game, f.target, f.firstMove)); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).forces['carthag:11'], 1);
  game = finish(game, f.target); physicalTruthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native travel authoring excludes earlier phases and a respondent whose own movement interval has closed', () => {
  const charity = fixture({ window: 'charity' }); assert.equal(charity.game.phase, 2);
  const declaredCharity = declare(charity);
  assert.ok(!viewGame(declaredCharity.game, charity.asker).truthTravelTargets.includes(charity.target));
  rejected(declaredCharity.game, charity.asker, charity.questionAction);
  assert.equal(declaredCharity.game.discard.filter(card => card.id === charity.truth).length, 0);
  const f = fixture(); let game = finish(f.game, f.target);
  assert.equal(game.active, f.asker); assert.ok(!game.movementRemaining?.includes(f.target));
  game = declare(f, game).game;
  assert.ok(!viewGame(game, f.asker).truthTravelTargets.includes(f.target)); rejected(game, f.asker, f.questionAction);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.truth)); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native travel projection keeps only the owner raw aggregate while exact next-step guides retain event authority', () => {
  const f = fixture(), declared = declare(f);
  assert.ok(viewGame(declared.game, f.asker).truthTravelTargets.includes(f.target));
  rejected(declared.game, f.target, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  const asked = ask(declared.game, f.asker, f.target, f.mixed);
  assert.equal(viewGame(asked, f.asker).truthTravelAnswers, null);
  assert.ok(viewGame(asked, f.target).truthTravelAnswers?.includes('yes'));
  rejected(asked, f.asker, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'yes');
  const own = viewGame(game, f.target), other = viewGame(game, f.asker), row = promise(game, f.target);
  const required = ['event', 'player', 'asker', 'turn', 'mixed', 'answer'];
  assert.ok(required.every(key => Object.keys(row).includes(key)));
  assert.ok(Object.keys(row).every(key => [...required, 'fulfilled', 'released'].includes(key)));
  assert.deepEqual(other.travelPromises, []); assert.equal(other.travelPromiseGuide, null);
  assert.deepEqual(own.truthHistory.at(-1)?.question, f.question);
  assert.deepEqual(own.travelPromises, [row]);
  const guide = own.travelPromiseGuide; assert.ok(guide);
  assert.equal(guide.event, row.event); assert.equal(guide.action.travelPromiseEvent, row.event);
  rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, travelPromiseEvent: 'stale-native-travel-event' });
  rejected(game, f.target, { ...guide.action, amount: Number(guide.action.amount) + 1 });
  const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, wire));
  assert.equal(promise(game, f.target).event, row.event); rejected(game, f.target, wire);
  game = complete(game, f.target); rejected(game, f.target, guide.action);
  physicalTruthOnce(game, f.truth); assert.deepEqual(inventory(finish(game, f.target)), f.originalCards);
});

void test('all four minimal profiles answer the raw travel question and perform its exact native completion', () => {
  const f = fixture(), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked); const actions: TruthTravelStep[] = [];
    const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    const before = structuredClone(answering), answerAction = botActions(answering).find(action => action.type === 'truthAnswer');
    assert.ok(answerAction, difficulty); assert.deepEqual(answering, before); assert.equal(answerAction.answer, 'yes', difficulty);
    assert.ok(answering.truthTravelAnswers?.includes('yes')); game = act(game, f.target, answerAction, actions);
    for (let count = 0; count < 12 && !promise(game, f.target).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const guide = view.travelPromiseGuide; assert.ok(guide, difficulty);
      const action = botActions(view).find(action => action.travelPromiseEvent === guide.event);
      assert.ok(action, difficulty); assert.deepEqual(action, guide.action);
      game = settle(act(game, f.target, action, actions), actions);
    }
    assert.equal(promise(game, f.target).fulfilled, true, difficulty);
    assert.ok(actions.some(step => step.action.type === 'ship'), difficulty);
    assert.ok(actions.some(step => step.action.type === 'move'), difficulty);
    assert.equal(player(game, f.target).moved, 1); assert.equal(player(game, f.target).reserves, 9);
    physicalTruthOnce(game, f.truth); assert.deepEqual(inventory(finish(game, f.target, actions)), f.originalCards);
  }
});

void test('native raw travel validates every leaf without consuming the physical card at a rejected Ask', () => {
  const f = fixture(), declared = declare(f), before = structuredClone(declared.game);
  const invalid: TruthTravelExpression[] = [
    group('or', fact(f.hajrFact), ship('not-a-territory'), move()),
    group('and', ship(), move('imperial_basin', 0)),
    group('and', ship('polar_sink', 21), move()),
  ];
  for (const mixed of invalid) rejected(declared.game, f.asker, { type: 'truthAsk', question: {
    kind: 'travel', target: f.target, turn: f.game.turn, mixed,
  } });
  assert.deepEqual(declared.game, before); assert.ok(clean(f.game));
  assert.ok(player(declared.game, f.asker).hand.some(card => card.id === f.truth));
  assert.deepEqual(inventory(declared.game), f.originalCards);
});
