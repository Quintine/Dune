import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createTruthtranceNativeFamilyPromisesFixture as fixture,
  actTruthtranceNativeFamilyPromises as act, advanceTruthtranceNativeFamilyPromises as advance,
  finishTruthtranceNativeFamilyPromises as finish, truthtranceNativeFamilyPromisesClean as clean,
  truthtranceNativeFamilyPromisesPlayer as player, truthtranceNativeFamilyPromisesInventory as inventory,
  truthtranceNativeFamilyPromisesPhysical as physical,
  type TruthtranceNativeFamilyPromisesFixture as Fixture, type TruthtranceNativeFamilyPromisesStep as Step,
} from './fixture-truthtrance-native-family-promises';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function source(f: Fixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced);
  assert.deepEqual(f.game.expansions, ['ecaz']);
  assert.deepEqual(f.game.players.map(p => p.faction), ['atreides', 'ecaz', 'moritani']);
  assert.equal(f.lobby.advanced, f.advanced);
  assert.deepEqual(f.start.action, f.advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  assert.ok(!f.game.homeworlds && !f.game.nexusCards && !f.game.leaderSkills && !f.game.techTokens &&
    !f.game.strongholdCards && !f.game.discoveryEnabled && !f.game.ecazTreachery);
  assert.ok(f.beforeStartingDeal.players.every(p => !p.hand.length));
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.deepEqual(f.ecazSetup, { actor: f.target, action: { type: 'ecazSetup', placements: { 'imperial_basin:10': 6 } } });
  assert.deepEqual(f.moritaniSetup, { actor: f.moritani, action: { type: 'decision', territory: 'oh_gap', sector: 9 } });
  assert.equal(player(f.game, f.target).spice, 12); assert.equal(player(f.game, f.target).reserves, 14);
  assert.deepEqual(player(f.game, f.target).forces, { 'imperial_basin:10': 6 });
  assert.equal(player(f.game, f.asker).forces['arrakeen:10'], 10);
  assert.deepEqual(player(f.game, f.moritani).forces, { 'oh_gap:9': 6 });
  assert.ok(player(f.game, f.asker).hand.some(card => card.id === f.truth));
  assert.equal(f.game.status, 'playing'); assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 2);
  assert.ok(clean(f.game)); assert.deepEqual(f.game.ready, []);
  assert.equal(f.game.shipmentPromises, undefined); assert.equal(f.game.movementPromises, undefined);
  assert.equal(f.originalCards.length, 33); assert.deepEqual(inventory(f.game), f.originalCards);
  assert.deepEqual(physical(f.game), f.physical); assert.equal(f.sourceActionCount, f.actions.length);
}
function asking(f: Fixture, actions: Step[] = []) {
  let game = act(structuredClone(f.game), f.declarationStep.actor, f.declarationStep.action, actions);
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(p => !game.truthtrance!.passed.includes(p.id)); assert.ok(actor);
    game = act(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  const view = viewGame(game, f.asker);
  assert.ok((f.kind === 'shipment' ? view.truthShipmentTargets : view.truthMovementTargets).includes(f.target));
  return game;
}
function asked(f: Fixture, actions: Step[] = []) {
  const game = act(asking(f, actions), f.asker, f.askStep.action, actions);
  const own = viewGame(game, f.target), answers = f.kind === 'shipment' ? own.truthShipmentAnswers : own.truthMovementAnswers;
  assert.ok(answers?.includes('yes')); assert.ok(answers?.includes('no'));
  assert.deepEqual(physical(game), f.physical); return game;
}
function promises(game: Game, f: Fixture) {
  return f.kind === 'shipment' ? game.shipmentPromises : game.movementPromises;
}
function bind(f: Fixture, answer: 'yes' | 'no' = 'yes', actions: Step[] = []) {
  const game = finish(act(asked(f, actions), f.target, { type: 'truthAnswer', answer }, actions), actions);
  assert.equal(game.phase, 2); assert.equal(game.turn, 1); assert.deepEqual(physical(game), f.physical);
  const entries = promises(game, f); assert.equal(entries?.length, 1);
  assert.equal(entries![0].answer, answer === 'yes'); assert.equal(entries![0].player, f.target);
  assert.equal(entries![0].fulfilled, undefined); assert.equal(entries![0].released, undefined);
  assert.equal(inventory(game).length, 33); assert.deepEqual(inventory(game), f.originalCards);
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.equal(viewGame(game, f.target).shipmentCompletion, null);
  reject(game, f.target, f.shipment); reject(game, f.target, f.move);
  reject(game, f.asker, f.askStep.action); reject(game, f.asker, f.declarationStep.action);
  return game;
}
function atMovement(game: Game, f: Fixture, actions: Step[] = []) {
  const next = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), actions);
  assert.equal(player(next, f.target).spice, 12); assert.equal(player(next, f.target).reserves, 14);
  assert.equal(player(next, f.target).forces['imperial_basin:10'], 6);
  assert.equal(player(next, f.target).shipped, false); assert.equal(player(next, f.target).moved, 0);
  assert.equal(promises(next, f)![0].fulfilled, undefined); assert.equal(promises(next, f)![0].released, undefined);
  assert.ok(actions.every(step => !['ship', 'move'].includes(step.action.type)), 'The native phase path installs no preparatory army');
  assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'decision' && step.action.decline === true),
    'The real optional Ecaz placement is declined rather than charging the promised shipment');
  assert.deepEqual(inventory(next), f.originalCards); return next;
}
function complete(game: Game, f: Fixture, action: Action = f.eventAction) {
  const before = structuredClone(game), actions: Step[] = [];
  game = finish(act(game, f.target, action, actions), actions);
  assert.equal(promises(game, f)!.length, 1); assert.equal(promises(game, f)![0].fulfilled, true);
  assert.equal(promises(game, f)![0].released, undefined); assert.equal(game.active, f.target); assert.equal(game.phase, 5);
  if (f.kind === 'shipment') {
    const amount = Number(action.amount), key = `${String(action.territory)}:${Number(action.sector)}`;
    assert.ok(amount >= 5); assert.equal(action.territory, 'carthag');
    assert.equal(player(game, f.target).forces[key], amount);
    assert.equal(player(before, f.target).reserves - player(game, f.target).reserves, amount);
    assert.equal(player(before, f.target).spice - player(game, f.target).spice, amount);
    assert.equal(player(game, f.target).forces['imperial_basin:10'], 6);
    assert.equal(player(game, f.target).shipped, true); assert.equal(player(game, f.target).moved, 0);
  } else {
    assert.equal(action.territory, 'arrakeen');
    assert.equal(player(game, f.target).forces['arrakeen:10'], 6);
    assert.equal(player(game, f.target).forces['imperial_basin:10'] ?? 0, 0);
    assert.equal(player(game, f.target).reserves, 14); assert.equal(player(game, f.target).spice, 12);
    assert.equal(player(game, f.target).moved, 1); assert.equal(player(game, f.asker).forces['arrakeen:10'], 10);
  }
  assert.deepEqual(player(game, f.moritani).forces, player(before, f.moritani).forces);
  assert.equal(actions.filter(step => step.actor === f.target && ['ship', 'move'].includes(step.action.type)).length, 1);
  reject(game, f.target, f.eventAction); assert.deepEqual(inventory(game), f.originalCards);
  return game;
}

for (const advanced of [false, true]) for (const kind of ['shipment', 'movement'] as const) {
  const label = `${advanced ? 'Advanced' : 'Basic'} native E3 ${kind}`;
  void test(`${label} promise binds at real Charity and fulfills only at its original physical event`, () => {
    const f = fixture({ advanced, kind }); source(f);
    const actions: Step[] = [], game = atMovement(bind(f), f, actions);
    reject(game, f.target, f.endMovement);
    const done = complete(game, f);
    assert.equal(game.shipmentPromises?.[0]?.fulfilled ?? game.movementPromises?.[0]?.fulfilled, undefined,
      'The original pre-event game remains unchanged');
    assert.equal(promises(done, f)![0].fulfilled, true);
  });

  void test(`${label} No stays bound through native phase controls and fulfills by actually ending the unused turn`, () => {
    const f = fixture({ advanced, kind }), actions: Step[] = [];
    const game = atMovement(bind(f, 'no'), f, actions);
    reject(game, f.target, f.eventAction);
    const done = act(game, f.target, f.endMovement);
    assert.equal(promises(done, f)![0].fulfilled, true); assert.equal(promises(done, f)![0].released, undefined);
    assert.deepEqual(player(done, f.target).forces, { 'imperial_basin:10': 6 });
    assert.equal(player(done, f.target).reserves, 14); assert.deepEqual(inventory(done), f.originalCards);
  });

  void test(`${label} rejects phony questions and early underlying actions without installing or spending their sources`, () => {
    const f = fixture({ advanced, kind }), window = asking(f);
    for (const question of [
      { ...f.question, target: 'unseated' }, { ...f.question, territory: 'invented_destination' },
      { ...f.question, minimum: 21 },
      ...(kind === 'movement' ? [{ ...f.question, futureIncome: 20 }] : []),
    ]) reject(window, f.asker, { type: 'truthAsk', question });
    reject(window, f.target, { type: 'truthAsk', question: f.question });
    reject(window, f.target, f.eventAction);
    assert.ok(player(window, f.asker).hand.some(card => card.id === f.truth));
    assert.equal(window.shipmentPromises, undefined); assert.equal(window.movementPromises, undefined);
    const answer = act(window, f.asker, f.askStep.action);
    reject(answer, f.asker, { type: 'truthAnswer', answer: 'yes' }); reject(answer, f.target, f.eventAction);
    assert.deepEqual(physical(answer), f.physical); assert.deepEqual(inventory(answer), f.originalCards);
  });

  void test(`all four minimal profiles legally answer and complete ${label} through the original native controls`, () => {
    const f = fixture({ advanced, kind }), answer = asked(f);
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(answer, f.target); own.players.find(p => p.id === f.target)!.bot = difficulty;
      const before = structuredClone(own), selected = botActions(own)[0]; assert.ok(selected, difficulty);
      assert.deepEqual(own, before); assert.deepEqual(selected, { type: 'truthAnswer', answer: 'yes' });
      let game = finish(act(structuredClone(answer), f.target, selected));
      game = advance(game, state => state.phase === 3 && clean(state) && state.auction?.active === f.target);
      const bidding = viewGame(game, f.target); bidding.players.find(p => p.id === f.target)!.bot = difficulty;
      const pass = botActions(bidding)[0]; assert.deepEqual(pass, { type: 'passBid' });
      game = act(game, f.target, pass);
      const phases: Step[] = [];
      game = atMovement(game, f, phases);
      const moving = viewGame(game, f.target); moving.players.find(p => p.id === f.target)!.bot = difficulty;
      const event = botActions(moving)[0]; assert.ok(event, difficulty); assert.equal(event.type, kind === 'shipment' ? 'ship' : 'move');
      complete(game, f, event);
    }
  });
}
