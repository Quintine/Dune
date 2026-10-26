import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { BattlePowerClaim } from '../game/battle-power-question';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import {
  actTruthTurnPower as act, advanceTruthTurnPower as advance,
  askTruthTurnPower as ask, bindTruthTurnPower as bind, createTruthTurnPowerFixture as fixture,
  declareTruthTurnPower as declare, finishTruthTurnPower as finish, finishTruthTurnPowerBattle as cleanup,
  nextTruthTurnPowerNative as nativeStep, settleTruthTurnPower as settle,
  truthTurnPowerAction as power, truthTurnPowerClean as clean, truthTurnPowerFact as fact,
  truthTurnPowerGroup as group, truthTurnPowerInventory as inventory, truthTurnPowerPayment as payment,
  truthTurnPowerPlayer as player, truthTurnPowerPromise as promise, truthTurnPowerTraitors as traitors,
  type TruthTurnPowerFixture, type TruthTurnPowerStep,
} from './fixture-truth-turn-power';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTurnPowerFixture) {
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
}
function receipt(game: Game, f: TruthTurnPowerFixture) {
  const stage = game.turnActionPromises![0].combat?.powers?.[f.power]; assert.ok(stage); return stage;
}
const use = (f: TruthTurnPowerFixture, selected = true) => power(f.event, f.territory,
  { kind: f.power, use: selected });

void test('native own and remote power sources retain genuine original cards, native cash and action-array chronology', () => {
  for (const remote of [false, true]) for (const selected of ['voice', 'prescience'] as const) {
    const f = fixture({ power: selected, remote });
    assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.equal(f.setup.deck.length, 33); assert.equal(f.originalCards.length, 33);
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceCounts.selected, f.actions.length);
    assert.equal(f.sourceCounts.beforeVoice, f.beforeVoiceActions.length);
    assert.equal(f.sourceCounts.nativeKaramaPurchase, f.purchase.steps.length);
    assert.ok(f.purchase.steps.some(step => step.actor === f.asker && step.action.type === 'bid' && step.action.amount === 1));
    assert.ok(player(f.game, f.asker).hand.some(card => card.id === f.truth));
    assert.ok(player(f.game, f.asker).hand.some(card => card.id === f.karama));
    assert.equal(f.game.advanced, false); assert.equal(f.game.nexusCards, undefined);
    assert.equal(f.game.turn, remote ? 2 : 1); assert.equal(f.game.phase, 6);
    assert.equal(f.game.battle?.event, f.event); assert.equal(f.game.battle?.preparation?.owner, f.target);
    assert.equal(f.game.battle?.preparation?.beneficiary, f.beneficiary);
    assert.equal(f.game.battle?.preparation?.kind, selected);
    assert.equal(f.game.turnActionPromises?.length ?? 0, 0);
    if (remote) {
      assert.ok(f.beforeNexus?.nexus); assert.equal(f.nexusActions.filter(step => step.action.type === 'alliance').length, 2);
      assert.equal(player(f.game, f.target).ally, f.emperor); assert.notEqual(f.target, f.beneficiary);
    } else assert.equal(player(f.game, f.bg).spice, 4, 'The native BG Arrakeen reserve costs one real spice');
    assert.deepEqual(inventory(f.game), f.originalCards); assert.deepEqual(traitors(f.game), f.originalTraitors);
  }
});

void test('native exact Voice AND payment freezes the original spice fact and records actual declaration before its response', () => {
  const f = fixture(), mixed = group('and', fact(f.spiceFact), power(f.event, f.territory, f.claim), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game;
  assert.equal(receipt(game, f).closed, false); assert.equal(receipt(game, f).values, null);
  game = act(game, f.target, f.payment); assert.equal(player(game, f.target).spice, 2);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  rejected(game, f.target, { type: 'declineBattlePower' });
  rejected(game, f.target, { type: 'voice', kind: 'shield', must: true });
  game = act(game, f.target, f.nativeAction);
  assert.equal(game.response?.kind, 'voice'); assert.equal(receipt(game, f).closed, true);
  assert.deepEqual(receipt(game, f).values, [{ claim: f.claim, value: true }]);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(player(game, f.recipient).bribes, 2);
  game = cleanup(game, f); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native requested Prescience field AND payment fulfills at the request without requiring or exposing its hidden answer', () => {
  const f = fixture({ power: 'prescience' });
  let game = bind(f).game; game = act(game, f.target, f.payment);
  rejected(game, f.target, { type: 'declineBattlePower' });
  rejected(game, f.target, { type: 'prescience', field: 'weapon' });
  game = act(game, f.target, f.nativeAction);
  assert.equal(game.response?.kind, 'prescience'); assert.equal(game.battle?.preparation?.kind, 'prescienceAnswer');
  assert.equal(Object.hasOwn(game.battle!.prescience!, 'value'), false);
  assert.deepEqual(receipt(game, f).values, [{ claim: f.claim, value: true }]);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(player(game, f.target).spice, 8);
  game = cleanup(game, f); physical(game, f);
});

void test('native Voice OR payment preserves both manual routes without choosing a fixed branch', () => {
  const f = fixture(), mixed = group('or', power(f.event, f.territory, f.claim), payment(f.recipient));
  const bound = bind(f, 'yes', mixed).game;
  let voiced = act(bound, f.target, f.nativeAction);
  assert.equal(promise(voiced, f.target).fulfilled, true); assert.equal(player(voiced, f.recipient).bribes, 0);
  let paid = act(bound, f.target, f.payment);
  const terminal = structuredClone(receipt(paid, f));
  paid = act(paid, f.target, { type: 'declineBattlePower' });
  assert.deepEqual(receipt(paid, f), terminal, 'A later native choice does not rewrite an already fulfilled answer');
  assert.equal(promise(paid, f.target).fulfilled, true);
  voiced = cleanup(voiced, f); paid = cleanup(paid, f);
  physical(voiced, f); physical(paid, f);
});

void test('whole native use AND payment No permits either earlier action and caps only actual completion', () => {
  const f = fixture(), mixed = group('and', use(f), payment(f.recipient));
  for (const first of ['payment', 'voice'] as const) {
    let game = bind(f, 'no', mixed).game;
    if (first === 'payment') {
      game = act(game, f.target, f.payment); rejected(game, f.target, f.nativeAction);
      game = act(game, f.target, { type: 'declineBattlePower' });
    } else {
      game = settle(act(game, f.target, f.nativeAction)); rejected(game, f.target, f.payment);
      game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
      assert.equal(player(game, f.recipient).bribes, 1);
    }
    assert.ok(!promise(game, f.target).released); game = cleanup(game, f); game = finish(game);
    assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('same-decision Voice use and command are correlated while contradictory use and explicit Decline have no Yes', () => {
  const f = fixture(), command = power(f.event, f.territory, f.claim);
  const impossible = group('and', use(f), use(f, false));
  const asked = ask(declare(f).game, f.asker, f.target, impossible);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const mixed = group('and', use(f), command, payment(f.recipient));
  let game = bind(f, 'yes', mixed).game; game = act(game, f.target, f.payment);
  game = act(game, f.target, f.nativeAction);
  const values = receipt(game, f).values; assert.ok(values);
  assert.equal(values.length, 2); assert.ok(values.every(entry => entry.value));
  assert.equal(promise(game, f.target).fulfilled, true); game = cleanup(game, f); physical(game, f);
});

void test('one native Prescience request cannot satisfy two different fields but either exact OR field remains manual', () => {
  const f = fixture({ power: 'prescience' });
  const dial = power(f.event, f.territory, { kind: 'prescienceField', field: 'dial' });
  const weapon = power(f.event, f.territory, { kind: 'prescienceField', field: 'weapon' });
  const asked = ask(declare(f).game, f.asker, f.target, group('and', dial, weapon));
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
  const mixed = group('and', group('or', dial, weapon), payment(f.recipient));
  for (const field of ['dial', 'weapon'] as const) {
    let game = bind(f, 'yes', mixed).game; game = act(game, f.target, f.payment);
    game = act(game, f.target, { type: 'prescience', field });
    const values = receipt(game, f).values; assert.ok(values);
    assert.equal(values.filter(entry => entry.value).length, 1);
    assert.equal(promise(game, f.target).fulfilled, true); game = cleanup(game, f); physical(game, f);
  }
});

void test('native explicit Decline is a real future declaration for either power rather than an absent effect', () => {
  for (const selected of ['voice', 'prescience'] as const) {
    const f = fixture({ power: selected }), claim: BattlePowerClaim = { kind: selected, use: false };
    const mixed = group('and', power(f.event, f.territory, claim), payment(f.recipient));
    let game = bind(f, 'yes', mixed).game; game = act(game, f.target, f.payment);
    rejected(game, f.target, f.nativeAction); game = act(game, f.target, { type: 'declineBattlePower' });
    assert.deepEqual(receipt(game, f).values, [{ claim, value: true }]);
    assert.equal(receipt(game, f).closed, true); assert.equal(promise(game, f.target).fulfilled, true);
    game = cleanup(game, f); physical(game, f);
  }
});

void test('actual Voice and Prescience receipts survive later printed Karama prevention without counting a successful effect', () => {
  for (const selected of ['voice', 'prescience'] as const) {
    const f = fixture({ power: selected }); let game = bind(f).game;
    game = act(game, f.target, f.payment); game = act(game, f.target, f.nativeAction);
    const evidence = structuredClone(receipt(game, f)); assert.equal(game.response?.kind, selected);
    assert.equal(promise(game, f.target).fulfilled, true);
    game = act(game, f.asker, { type: 'card', card: f.karama, mode: 'cancel' });
    game = settle(game); assert.equal(game.battle?.[selected], undefined);
    assert.deepEqual(receipt(game, f), evidence); assert.equal(promise(game, f.target).fulfilled, true);
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    game = cleanup(game, f); assert.deepEqual(receipt(game, f), evidence); physical(game, f);
  }
});

void test('a declined native power leaves its payment OR alive after battle cleanup through late Mentat', () => {
  const f = fixture(), mixed = group('or', use(f), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game; game = act(game, f.target, { type: 'declineBattlePower' });
  assert.deepEqual(receipt(game, f).values, [{ claim: { kind: 'voice', use: true }, value: false }]);
  assert.ok(!promise(game, f.target).fulfilled); const evidence = structuredClone(receipt(game, f));
  game = cleanup(game, f); assert.equal(game.battle, null); assert.deepEqual(receipt(game, f), evidence);
  game = advance(game, state => state.phase === 8 && clean(state), [], true);
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, f.payment);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(receipt(game, f), evidence); physical(game, f);
});

void test('remote ordinary allies declare their own Voice or Prescience for the original allied beneficiary', () => {
  for (const selected of ['voice', 'prescience'] as const) {
    const f = fixture({ power: selected, remote: true }); let game = bind(f).game;
    assert.equal(receipt(game, f).beneficiary, f.emperor); assert.notEqual(f.target, f.emperor);
    assert.equal(receipt(game, f).target, f.asker); game = act(game, f.target, f.payment);
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, selected);
    rejected(game, f.beneficiary, guide.action); game = act(game, f.target, guide.action);
    assert.equal(promise(game, f.target).fulfilled, true); assert.equal(player(game, f.recipient).bribes, 2);
    game = cleanup(game, f); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('ordered native Prescience waits for the foreign Voice choice before exposing an executable field guide', () => {
  const f = fixture({ power: 'prescience', window: 'voice' });
  assert.equal(f.game.battle?.preparation?.owner, f.bg);
  let game = bind(f).game; game = act(game, f.target, f.payment);
  assert.equal(viewGame(game, f.target).turnActionGuide, null);
  rejected(game, f.target, f.nativeAction);
  game = act(game, f.bg, { type: 'declineBattlePower' });
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'prescience'); assert.equal(guide.action.field, 'dial');
  game = act(game, f.target, guide.action); assert.equal(promise(game, f.target).fulfilled, true);
  game = cleanup(game, f); physical(game, f);
});

void test('raw native power ownership and event markers reject stale questions, prior declarations and stale executable guides', () => {
  for (const selected of ['voice', 'prescience'] as const) {
    const f = fixture({ power: selected }), declared = declare(f);
    for (const mixed of [power('other-battle', f.territory, f.claim), power(f.event, 'carthag', f.claim)])
      rejected(declared.game, f.asker, { type: 'truthAsk', question: { kind: 'turnActions', target: f.target, turn: f.game.turn, mixed } });
    rejected(declared.game, f.asker, { type: 'truthAsk', question: {
      kind: 'turnActions', target: selected === 'voice' ? f.atreides : f.bg,
      turn: f.game.turn, mixed: power(f.event, f.territory, f.claim),
    } });
    rejected(declared.game, f.asker, { type: 'truthAsk', question: {
      kind: 'turnActions', target: f.target, turn: f.game.turn, mixed: { kind: 'action', action: {
        kind: 'battlePower', battle: f.event, territory: f.territory, claim: { ...f.claim, value: 0 },
      } },
    } });
    let prior = settle(act(f.game, f.target, f.nativeAction)); prior = declare(f, prior).game;
    rejected(prior, f.asker, { type: 'truthAsk', question: f.question });
    let game = bind(f).game; game = act(game, f.target, f.payment);
    const row = promise(game, f.target), guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
    assert.equal(guide.event, row.event); assert.equal(guide.action.turnActionPromiseEvent, row.event);
    assert.equal(guide.action.turnActionPromisePhase, 6);
    assert.ok(Object.keys(row).every(key => ['event', 'player', 'asker', 'turn', 'mixed', 'answer', 'fulfilled', 'released'].includes(key)));
    assert.deepEqual(viewGame(game, f.asker).turnActionPromises, []); assert.equal(viewGame(game, f.asker).turnActionGuide, null);
    rejected(game, f.asker, guide.action);
    rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-event' });
    rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 5 });
    const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, packet);
    rejected(game, f.target, packet); assert.equal(promise(game, f.target).fulfilled, true);
    game = cleanup(game, f); rejected(game, f.target, packet); physical(game, f);
  }
});

void test('all four minimal profiles answer and submit exact native Voice or Prescience guide packets through fulfillment', () => {
  for (const selected of ['voice', 'prescience'] as const) {
    const f = fixture({ power: selected }), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthTurnPowerStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, difficulty);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 24 && !promise(game, f.target).fulfilled; count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        const guide = view.turnActionGuide;
        if (guide) {
          const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.event);
          assert.ok(action, `${selected}/${difficulty}`); assert.deepEqual(action, guide.action);
          game = act(game, f.target, action, actions);
        } else {
          const next = nativeStep(game); assert.ok(next, `${selected}/${difficulty}`);
          game = act(game, next.actor, next.action, actions);
        }
      }
      assert.equal(promise(game, f.target).fulfilled, true, `${selected}/${difficulty}`);
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === selected));
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'bribe'));
      game = cleanup(game, f); physical(game, f);
    }
  }
});
