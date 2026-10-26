import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer, type TruthQuestion } from '../game/truthtrance';
import { createTruthTurnActionFixture } from './fixture-truth-turn-action';
import {
  actTruthTurnCombat as act, advanceTruthTurnCombat as advance, answerTruthTurnCombat as answer,
  askTruthTurnCombat as ask, bindTruthTurnCombat as bind, createTruthTurnCombatFixture as fixture,
  declareTruthTurnCombat as declare, finishTruthTurnCombat as finish, finishTruthTurnCombatBattle as cleanup,
  nextTruthTurnCombatNative as nativeStep, revealTruthTurnCombat as reveal, settleTruthTurnCombat as settle,
  truthTurnCombatCall as call, truthTurnCombatClean as clean, truthTurnCombatFact as fact,
  truthTurnCombatGroup as group, truthTurnCombatInventory as inventory, truthTurnCombatPayment as payment,
  truthTurnCombatPlan as plan, truthTurnCombatPlayer as player, truthTurnCombatPromise as promise,
  truthTurnCombatTraitors as traitors, type TruthTurnCombatFixture, type TruthTurnCombatStep,
} from './fixture-truth-turn-combat';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTurnCombatFixture) {
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
}

void test('native combat adapters keep the original beforePlans and unsubmitted Traitor sources without installed played state', () => {
  for (const source of ['plan', 'traitor', 'noMatch', 'harkonnen'] as const) {
    const f = fixture({ source }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.equal(f.setup.deck.length, 33); assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceCounts.selected, f.sourceActionCount);
    assert.equal(f.sourceActionCount, source === 'plan' ? 24 : source === 'harkonnen' ? 72 : 26);
    assert.equal(f.originalCards.length, 33); assert.equal(f.game.advanced, false); assert.equal(f.game.nexusCards, undefined);
    assert.ok(player(f.game, f.asker).hand.some(card => card.id === f.truth));
    assert.ok(f.game.battle?.event); assert.equal(f.game.battle.event, f.event); assert.equal(f.game.battle.territory, f.territory);
    assert.equal(f.game.battle.revealed, source !== 'plan'); assert.deepEqual(f.game.battle.traitorCalls, {});
    assert.equal(f.game.turnActionPromises?.length ?? 0, 0);
    assert.deepEqual(inventory(f.game), f.originalCards); assert.deepEqual(traitors(f.game), f.originalTraitors);
    if (source === 'noMatch') {
      assert.notEqual(f.game.battle.plans[f.asker].leader, f.traitorHeld);
      assert.ok(player(f.game, f.target).traitors.includes(f.traitorHeld));
      assert.deepEqual(viewGame(f.game, f.target).battle!.traitorCallChoices, [false]);
    }
  }
});

void test('native plan AND payment freezes current spice and uses the exact originally held projectile through actual reveal', () => {
  const f = fixture(); assert.ok(f.projectilePlan && f.ordinary && f.planSource);
  assert.equal(player(f.planSource.beforeShipment, f.target).spice - player(f.game, f.target).spice, 1);
  assert.equal(player(f.game, f.target).spice, 9);
  const mixed = group('and', fact(f.spiceFact), plan(f.event, f.territory, f.weaponClaim), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game; game = act(game, f.target, f.payment);
  assert.equal(player(game, f.target).spice, 7); assert.equal(player(game, f.recipient).bribes, 2);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  rejected(game, f.target, f.targetPlan);
  const sealed = reveal(game, f, f.projectilePlan); game = sealed.game;
  assert.equal(sealed.afterTargetPlan.battle?.revealed, false);
  assert.equal(sealed.afterTargetPlan.turnActionPromises![0].combat?.plan?.closed, false);
  assert.equal(game.battle!.plans[f.target].weapon, f.ordinary);
  assert.equal(player(game, f.target).spice, 7, 'Original Basic zero-dial/zero-support plans add no invented spice charge');
  assert.deepEqual(game.turnActionPromises![0].combat?.plan?.values, [{ claim: f.weaponClaim, value: true }]);
  assert.equal(game.turnActionPromises![0].combat?.plan?.closed, true);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(promise(game, f.target).mixed, mixed);
  game = cleanup(game, f); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native plan OR payment preserves either manual exact-weapon plan or real payment route', () => {
  const f = fixture(); assert.ok(f.projectilePlan && f.ordinary);
  const mixed = group('or', plan(f.event, f.territory, f.weaponClaim), payment(f.recipient));
  const bound = bind(f, 'yes', mixed).game;
  let armed = reveal(bound, f, f.projectilePlan).game;
  assert.equal(promise(armed, f.target).fulfilled, true); assert.equal(player(armed, f.recipient).bribes, 0);
  let paid = act(bound, f.target, f.payment); assert.equal(promise(paid, f.target).fulfilled, true);
  paid = reveal(paid, f, f.targetPlan).game;
  assert.equal(paid.battle!.plans[f.target].weapon, null);
  assert.ok(player(paid, f.target).hand.some(card => card.id === f.ordinary));
  armed = cleanup(armed, f); paid = cleanup(paid, f);
  for (const state of [armed, paid]) { assert.equal(promise(state, f.target).fulfilled, true); physical(state, f); }
});

void test('native whole plan AND payment No retains both alternatives and rejects only completion of the exact predicate', () => {
  const f = fixture(); assert.ok(f.projectilePlan && f.ordinary);
  const mixed = group('and', plan(f.event, f.territory, f.weaponClaim), payment(f.recipient));
  for (const first of ['payment', 'plan'] as const) {
    let game = bind(f, 'no', mixed).game;
    if (first === 'payment') {
      game = act(game, f.target, f.payment); rejected(game, f.target, f.projectilePlan);
      game = reveal(game, f, f.targetPlan).game;
      assert.ok(player(game, f.target).hand.some(card => card.id === f.ordinary));
    } else {
      game = reveal(game, f, f.projectilePlan).game; rejected(game, f.target, f.payment);
      game = act(game, f.target, { ...f.payment, amount: 1 });
      rejected(game, f.target, { ...f.payment, amount: 1 });
    }
    assert.ok(!promise(game, f.target).released); game = cleanup(game, f); game = finish(game);
    assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('native false revealed plan receipt survives original battle cleanup while its payment OR remains due until late Mentat', () => {
  const f = fixture(), mixed = group('or', plan(f.event, f.territory, f.weaponClaim), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game; game = reveal(game, f, f.targetPlan).game;
  assert.deepEqual(game.turnActionPromises![0].combat?.plan?.values, [{ claim: f.weaponClaim, value: false }]);
  assert.ok(!promise(game, f.target).fulfilled); game = cleanup(game, f);
  assert.equal(game.battle, null); assert.ok(!promise(game, f.target).released);
  const receipt = structuredClone(game.turnActionPromises![0].combat);
  game = advance(game, state => state.phase === 8 && clean(state), [], true);
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, f.payment);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(game.turnActionPromises![0].combat, receipt);
  physical(game, f);
});

void test('native already submitted own plan is a fixed answer-time predicate without resubmitting or revealing a foreign plan', () => {
  const f = fixture(); assert.ok(f.projectilePlan);
  let game = act(f.game, f.target, f.projectilePlan); assert.equal(game.battle?.revealed, false);
  const fixed = structuredClone(game.battle!.plans[f.target]);
  game = bind(f, 'yes', f.mixed, game).game;
  assert.equal(game.turnActionPromises![0].combat?.plan?.closed, true);
  assert.deepEqual(game.turnActionPromises![0].combat?.plan?.values, [{ claim: f.weaponClaim, value: true }]);
  assert.ok(!promise(game, f.target).fulfilled); assert.equal(game.battle!.plans[f.asker], undefined);
  game = act(game, f.target, f.payment); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(game.battle!.plans[f.target], fixed); game = act(game, f.asker, f.ownPlan);
  assert.ok(game.battle?.revealed); game = cleanup(game, f); physical(game, f);
});

void test('native matching Reveal and Decline each combine with actual ordinary payment at the original Traitor declaration', () => {
  const f = fixture({ source: 'traitor' });
  for (const selected of [true, false]) {
    const mixed = group('and', call(f.event, f.territory, selected), payment(f.recipient));
    let game = bind(f, 'yes', mixed).game; game = act(game, f.target, f.payment);
    assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [selected]);
    rejected(game, f.target, { type: 'traitorCall', call: !selected });
    game = act(game, f.target, { type: 'traitorCall', call: selected });
    assert.equal(game.turnActionPromises![0].combat?.traitor?.closed, true);
    assert.equal(game.turnActionPromises![0].combat?.traitor?.call, selected);
    assert.equal(promise(game, f.target).fulfilled, true); game = cleanup(game, f);
    assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('native whole Reveal AND payment No keeps payment or the actual opposite declaration as independent alternatives', () => {
  const f = fixture({ source: 'traitor' }), mixed = group('and', call(f.event, f.territory), payment(f.recipient));
  for (const first of ['payment', 'reveal'] as const) {
    let game = bind(f, 'no', mixed).game;
    if (first === 'payment') {
      game = act(game, f.target, f.payment); rejected(game, f.target, f.reveal);
      game = act(game, f.target, f.decline);
    } else {
      game = act(game, f.target, f.reveal); rejected(game, f.target, f.payment);
      game = act(game, f.target, { ...f.payment, amount: 1 });
      rejected(game, f.target, { ...f.payment, amount: 1 });
    }
    assert.ok(!promise(game, f.target).released); game = cleanup(game, f); game = finish(game);
    assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('native genuinely unmatched opposing leader preserves a funded payment OR without inventing a Traitor identity', () => {
  const f = fixture({ source: 'noMatch' }), mixed = group('or', call(f.event, f.territory), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game;
  assert.deepEqual(viewGame(game, f.target).battle!.traitorCallChoices, [false]); rejected(game, f.target, f.reveal);
  game = act(game, f.target, f.decline); assert.ok(!promise(game, f.target).fulfilled);
  assert.equal(game.turnActionPromises![0].combat?.traitor?.call, false);
  game = cleanup(game, f); assert.ok(!promise(game, f.target).released);
  game = advance(game, state => state.phase === 8 && clean(state), [], true);
  game = act(game, f.target, f.payment); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native remote allied Harkonnen Reveal fulfills at declaration before its actually allowed or prevented effect', () => {
  const f = fixture({ source: 'harkonnen' }); assert.ok(f.karama);
  assert.equal(player(f.game, f.target).ally, f.beneficiary);
  assert.ok(![f.game.battle!.attacker, f.game.battle!.defender].includes(f.target));
  for (const prevented of [false, true]) {
    let game = bind(f).game; game = act(game, f.target, f.payment); game = act(game, f.target, f.reveal);
    assert.equal(game.response?.kind, 'harkonnenTraitor'); assert.equal(promise(game, f.target).fulfilled, true);
    assert.equal(game.turnActionPromises![0].combat?.traitor?.beneficiary, f.beneficiary);
    assert.equal(game.turnActionPromises![0].combat?.traitor?.call, true);
    const receipt = structuredClone(game.turnActionPromises![0].combat);
    if (prevented) game = act(game, f.asker, { type: 'card', card: f.karama, mode: 'cancel' });
    else game = settle(game);
    assert.equal(game.battle!.traitorCalls[f.target], !prevented);
    assert.deepEqual(game.turnActionPromises![0].combat, receipt); assert.equal(promise(game, f.target).fulfilled, true);
    game = cleanup(game, f); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('native current combat leaves and exact guides enforce event territory owner phase and original raw history', () => {
  for (const source of ['plan', 'traitor'] as const) {
    const f = fixture({ source }), declared = declare(f);
    const native = source === 'plan' ? plan(f.event, f.territory, f.weaponClaim) : call(f.event, f.territory);
    const stale = source === 'plan' ? plan('stale-combat', f.territory, f.weaponClaim) : call('stale-combat', f.territory);
    const wrongTerritory = source === 'plan' ? plan(f.event, 'carthag', f.weaponClaim) : call(f.event, 'carthag');
    for (const invalid of [stale, wrongTerritory]) rejected(declared.game, f.asker, { type: 'truthAsk', question: {
      ...f.question, mixed: group('or', payment(f.recipient), invalid),
    } });
    rejected(declared.game, f.target, { type: 'truthAsk', question: f.question });
    let game = answer(ask(declared.game, f.asker, f.target, group('and', native, payment(f.recipient))), f.target, 'yes');
    game = act(game, f.target, f.payment);
    const row = promise(game, f.target), allowed = ['event', 'player', 'asker', 'turn', 'mixed', 'answer', 'fulfilled', 'released'];
    assert.ok(Object.keys(row).every(key => allowed.includes(key)));
    assert.deepEqual(viewGame(game, f.asker).turnActionPromises, []); assert.equal(viewGame(game, f.asker).turnActionGuide, null);
    assert.deepEqual(viewGame(game, f.target).truthHistory.at(-1)?.question, f.question);
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
    assert.equal(guide.action.type, source === 'plan' ? 'battlePlan' : 'traitorCall');
    assert.equal(guide.event, row.event); assert.equal(guide.action.turnActionPromiseEvent, row.event);
    assert.equal(guide.action.turnActionPromisePhase, 6); rejected(game, f.asker, guide.action);
    rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-guide-event' });
    rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 5 });
    const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, wire);
    rejected(game, f.target, wire);
    if (source === 'plan') game = act(game, f.asker, f.ownPlan);
    assert.equal(promise(game, f.target).fulfilled, true); game = cleanup(game, f);
    rejected(game, f.target, wire); physical(game, f);
  }
});

void test('all four minimal profiles actually answer and use native plan or Traitor guides through combined fulfillment', () => {
  for (const source of ['plan', 'traitor'] as const) {
    const f = fixture({ source }), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthTurnCombatStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, difficulty);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 24 && !promise(game, f.target).fulfilled; count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        const guide = view.turnActionGuide;
        if (guide) {
          const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.event);
          assert.ok(action, `${source}/${difficulty}`); assert.deepEqual(action, guide.action);
          game = act(game, f.target, action, actions);
        } else if (source === 'plan' && game.battle?.plans[f.target] && !game.battle.plans[f.asker]) {
          game = act(game, f.asker, f.ownPlan, actions);
        } else {
          const next = nativeStep(game); assert.ok(next, `${source}/${difficulty}`);
          game = act(game, next.actor, next.action, actions);
        }
      }
      assert.equal(promise(game, f.target).fulfilled, true, `${source}/${difficulty}`);
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'bribe'));
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === (source === 'plan' ? 'battlePlan' : 'traitorCall')));
      game = cleanup(game, f); physical(game, f);
    }
  }
});

void test('two genuine Truths keep a later native plan candidate compatible with an already paid whole No', () => {
  // The inherited original H/A/E prefix really holds both Harkonnen Truths.
  // Actual A endMovement, E's paid reserve shipment and native battle controls
  // earn this battle. No second card, army, purse, battle or ledger is set.
  const f = createTruthTurnActionFixture(), actions = structuredClone(f.sourceActions);
  const originalTraitors = traitors(f.game), opponent = f.observer;
  let game = act(f.game, f.target, { type: 'endMovement' }, actions);
  game = advance(game, state => state.phase === 5 && state.active === opponent && clean(state), actions, true);
  const beforeShipment = player(game, opponent).spice;
  game = settle(act(game, opponent, { type: 'ship', territory: 'arrakeen', sector: 10,
    amount: 1, elite: 0, allyPayment: 0 }, actions), actions);
  assert.equal(player(game, opponent).spice, beforeShipment - 1);
  game = act(game, opponent, { type: 'endMovement' }, actions);
  game = advance(game, state => state.phase === 6 && !!state.active && !state.battle && clean(state), actions, true);
  const choice = viewGame(game, game.active!).battleChoices.find(candidate => candidate.territory === 'arrakeen' &&
    [candidate.attacker, candidate.defender].includes(f.target) && [candidate.attacker, candidate.defender].includes(opponent));
  assert.ok(choice);
  game = act(game, choice.chooser, { type: 'chooseBattle', territory: choice.territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker }, actions);
  game = advance(game, state => !!state.battle && clean(state) && !state.battle.preparation &&
    state.battle.preLeader?.closed !== false, actions, true);
  assert.ok(game.battle?.event); assert.equal(player(game, f.target).spice, 10);
  assert.deepEqual(player(game, f.asker).hand.map(card => card.id), f.truths);
  assert.ok(actions.length > f.sourceActionCount); assert.deepEqual(inventory(game), f.originalCards);
  const event = game.battle.event, territory = game.battle.territory;
  const dialClaim = { kind: 'dial', compare: 'gte', value: 1 } as const;
  const mixed = group('and', plan(event, territory, dialClaim), payment(f.asker));
  const open = (state: Game, card: string, question: TruthQuestion): Game => {
    let next = act(state, f.asker, { type: 'card', card }, actions);
    while (next.truthtrance?.stage === 'priority') {
      const actor = next.players.find(candidate => !next.truthtrance!.passed.includes(candidate.id)); assert.ok(actor);
      next = act(next, actor.id, { type: 'truthPass' }, actions);
    }
    return act(next, f.asker, { type: 'truthAsk', question }, actions);
  };
  game = open(game, f.truths[0], { kind: 'turnActions', target: f.target, turn: game.turn, mixed });
  game = answer(game, f.target, 'no', actions);
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 2 }, actions);
  const earlier = structuredClone(game.turnActionPromises![0]), earlierHistory = structuredClone(game.truthHistory![0]);
  assert.equal(player(game, f.target).spice, 8); assert.equal(game.bribePromises?.length ?? 0, 0);
  game = open(game, f.truths[1], { kind: 'battlePlan', target: f.target, territory, claim: dialClaim });
  assert.deepEqual(viewGame(game, f.target).truthBattleAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.deepEqual(game.turnActionPromises![0], earlier); assert.deepEqual(game.truthHistory![0], earlierHistory);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.truths[1]));
  game = answer(game, f.target, 'no', actions);
  for (const actor of [f.target, opponent]) {
    const leader = player(game, actor).leaders.find(disc => !disc.dead && !disc.usedAt); assert.ok(leader);
    game = act(game, actor, { type: 'battlePlan', leader: leader.id, dial: 0, support: 0,
      weapon: null, defense: null }, actions);
  }
  assert.ok(game.battle?.revealed); assert.equal(game.battle.plans[f.target].dial, 0);
  game = finish(game, actions);
  assert.equal(promise(game, f.target).fulfilled, true); assert.ok(!promise(game, f.target).released);
  assert.equal(game.truthHistory!.length, 2);
  for (const truth of f.truths) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), originalTraitors);
});
