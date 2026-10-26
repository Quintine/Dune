import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { treacheryDeck } from '../game/cards';
import { viewGame, type Action, type Game } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { truthFactAnswer, type TruthQuestion } from '../game/truthtrance';
import {
  actTruthBoxPlay as act, advanceTruthBoxPlay as advance, answerTruthBoxPlay as answer,
  askTruthBoxPlay as ask, bindTruthBoxPlay as bind, chooseTruthBoxPlay as choose,
  createTruthBoxPlayFixture as fixture, declareTruthBoxPlay as declare, finishTruthBoxPlay as finish,
  nextTruthBoxPlayNative as nativeStep, settleTruthBoxPlay as settle, truthBoxPlayClean as clean,
  truthBoxPlayFact as fact, truthBoxPlayGroup as group, truthBoxPlayInventory as inventory,
  truthBoxPlayPayment as payment, truthBoxPlayPlayer as player, truthBoxPlayPromise as promise,
  truthBoxPlayShip as ship, truthBoxPlaySpice as spice, truthBoxPlayTraitors as traitors, truthBoxPlayUse as use,
  type TruthBoxPlayExpression, type TruthBoxPlayFixture, type TruthBoxPlayStep,
} from './fixture-truth-box-play';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthBoxPlayFixture) {
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(spice(game), f.originalSpice);
  assert.deepEqual(traitors(game), f.originalTraitors);
}
const raw = (f: TruthBoxPlayFixture, mixed: TruthBoxPlayExpression): TruthQuestion =>
  ({ kind: 'turnActions', target: f.target, turn: f.game.turn, mixed });
const pay = (game: Game, f: TruthBoxPlayFixture, amount: number, actions: TruthBoxPlayStep[] = []) =>
  act(game, f.target, { type: 'bribe', target: f.recipient, amount }, actions);
const stage = (game: Game, index = 0) => game.turnActionPromises![index].cardPlays?.nullentropyBox;

void test('printed Box sources preserve real cache and ordinary purchases, inventories and Basic Semuta chronology', () => {
  for (const advanced of [false, true]) for (const multiple of [false, true]) {
    const f = fixture({ advanced, multiple }); assert.equal(f.setup.status, 'setup');
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(f.originalCards, [...treacheryDeck(['choam']), ...richeseCards()].map(card => card.id).sort());
    assert.equal(f.sourceCounts.selected, f.actions.length); assert.equal(f.sourceActionCount, f.actions.length);
    assert.equal(f.sourceCounts.inherited + f.sourceCounts.nativeContinuation, f.sourceActionCount);
    assert.equal(f.sourceCounts.paidCacheBids, 1); assert.equal(f.sourceCounts.paidOrdinaryBids, 1);
    assert.equal(player(f.game, f.target).spice, multiple ? 6 : 8); assert.equal(!!f.game.semutaPreview, !advanced);
    assert.ok(player(f.game, f.target).hand.some(card => card.id === f.box));
    assert.equal(f.game.turnActionPromises?.length ?? 0, 0); assert.ok(!f.game.pendingNullentropy);
    assert.equal(f.game.discard.filter(card => card.id === f.hajr).length, multiple ? 1 : 0);
    if (multiple) {
      assert.ok(f.sourcePreparation); assert.equal(player(f.sourcePreparation.before, f.target).spice, 8);
      assert.equal(player(f.sourcePreparation.after, f.target).spice, 6);
      assert.ok(f.sourcePreparation.steps.some(step => step.action.type === 'ship' && step.action.amount === 1));
      assert.ok(f.sourcePreparation.steps.some(step => step.action.type === 'move'));
      assert.ok(f.sourcePreparation.steps.some(step => step.action.type === 'card' && step.action.card === f.hajr));
    }
    physical(f.game, f);
  }
});

void test('Basic printed Box AND payment and shipment share eight actual spice after declined Semuta with frozen facts', () => {
  const f = fixture(), mixed = group('and', fact(f.spiceFact), use(), payment(f.recipient, 4), ship());
  const actions: TruthBoxPlayStep[] = []; let game = bind(f, 'yes', raw(f, mixed), f.game, 0, actions).game;
  assert.equal(game.semutaPreview, true); game = settle(game, actions);
  assert.ok(actions.some(step => step.action.type === 'semutaPass'), 'The original fresh Truth cost completes actual declined Semuta controls');
  assert.deepEqual(game.discard.map(card => card.id), [f.truth]); assert.equal(viewGame(game, f.target).nullentropy?.search, null);
  game = pay(game, f, 4, actions); assert.equal(player(game, f.target).spice, 4);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  game = settle(act(game, f.target, f.shipment, actions), actions); assert.equal(player(game, f.target).spice, 2);
  assert.equal(player(game, f.target).forces['polar_sink:0'], 1); assert.equal(stage(game)?.played, false);
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.box);
  game = settle(act(game, f.target, guide.action, actions), actions);
  assert.equal(player(game, f.target).spice, 0); assert.equal(stage(game)?.played, true); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.pendingNullentropy, null, 'A sole actual eligible discard completes without a private selection');
  assert.ok(player(game, f.target).hand.some(card => card.id === f.truth)); assert.equal(game.discard.filter(card => card.id === f.box).length, 1);
  assert.equal(player(game, f.recipient).bribes, 4); assert.deepEqual(promise(game).mixed, mixed); physical(game, f);
});

void test('Advanced paid Box activation records before its real multi-choice selection and keeps modal priority over remaining payment', () => {
  const f = fixture({ advanced: true, multiple: true }); const mixed = group('and', use(), payment(f.recipient, 4));
  let game = bind(f, 'yes', raw(f, mixed)).game; assert.equal(game.discard.length, 2);
  assert.equal(viewGame(game, f.target).nullentropy?.search, null);
  game = act(game, f.target, f.boxAction); assert.equal(player(game, f.target).spice, 4);
  assert.equal(stage(game)?.played, true); assert.ok(!promise(game).fulfilled); assert.equal(game.decision?.kind, 'nullentropy');
  assert.equal(game.discard.filter(card => card.id === f.box).length, 0, 'The physical Box awaits its actual selection disposal');
  const search = viewGame(game, f.target).nullentropy?.search; assert.ok(search);
  assert.deepEqual(search.cards.map(card => card.id).sort(), [f.truth, f.hajr].sort());
  rejected(game, f.target, f.payment); rejected(game, f.target, f.end);
  rejected(game, f.asker, { type: 'decision', event: search.event, card: f.hajr });
  rejected(game, f.target, { type: 'decision', event: 'stale-paid-box', card: f.hajr });
  game = settle(choose(game, f.target, f.hajr)); assert.equal(player(game, f.target).spice, 4);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.hajr)); assert.equal(game.discard.filter(card => card.id === f.box).length, 1);
  game = pay(game, f, 4); assert.equal(player(game, f.target).spice, 0); assert.equal(promise(game).fulfilled, true);
  const receipt = structuredClone(game.turnActionPromises![0].cardPlays);
  game = settle(act(game, f.target, f.end)); assert.deepEqual(game.turnActionPromises![0].cardPlays, receipt); physical(game, f);
});

void test('whole OR permits either manual printed Box use or a later Mentat payment without selecting a fixed recovery branch', () => {
  const f = fixture({ advanced: true }), mixed = group('or', use(), payment(f.recipient));
  const bound = bind(f, 'yes', raw(f, mixed)).game;
  let played = settle(act(bound, f.target, f.boxAction));
  assert.equal(promise(played).fulfilled, true); assert.equal(player(played, f.recipient).bribes, 0);
  assert.equal(player(played, f.target).spice, 6); assert.equal(stage(played)?.played, true);
  let paid = settle(act(bound, f.target, f.end));
  paid = advance(paid, state => state.phase === 8 && clean(state), [], true);
  assert.ok(!promise(paid).fulfilled && !promise(paid).released); assert.equal(stage(paid)?.played, false);
  paid = pay(paid, f, 2); assert.equal(promise(paid).fulfilled, true);
  assert.ok(player(paid, f.target).hand.some(card => card.id === f.box)); assert.equal(player(paid, f.target).spice, 6);
  played = finish(played); assert.equal(stage(played)?.played, true); physical(played, f); physical(paid, f);
});

void test('whole AND No permits one actual alternative but rejects the payment or printed activation that would make both true', () => {
  const f = fixture({ advanced: true }), bound = bind(f, 'no').game;
  let played = settle(act(bound, f.target, f.boxAction)); assert.equal(stage(played)?.played, true);
  played = pay(played, f, 1); rejected(played, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  assert.equal(player(played, f.target).spice, 5); assert.ok(!promise(played).released);
  let paid = pay(bound, f, 2); rejected(paid, f.target, f.boxAction);
  assert.equal(stage(paid)?.played, false); assert.equal(player(paid, f.target).spice, 6);
  played = finish(played); paid = finish(paid);
  assert.equal(promise(played).fulfilled, true); assert.equal(promise(paid).fulfilled, true); physical(played, f); physical(paid, f);
});

void test('whole OR No retains its cumulative payment cap and rejects printed Box through the actual turn deadline', () => {
  const f = fixture({ advanced: true }), mixed = group('or', use(), payment(f.recipient));
  let game = bind(f, 'no', raw(f, mixed)).game; rejected(game, f.target, f.boxAction);
  assert.match(viewGame(game, f.target).nullentropy?.blocked ?? '', /whole Truthtrance/);
  game = pay(game, f, 1); game = advance(game, state => state.phase === 8 && clean(state), [], true);
  rejected(game, f.target, f.boxAction); rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  assert.ok(!promise(game).released); game = finish(game);
  assert.equal(promise(game).fulfilled, true); assert.equal(stage(game)?.played, false); assert.equal(stage(game)?.closed, true);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.box)); physical(game, f);
});

void test('the printed Box fee cannot be financed twice or by an unpaid hidden recovered-card effect', () => {
  const f = fixture({ advanced: true });
  for (const mixed of [group('and', use(), payment(f.recipient, 7)), group('and', use(), payment(f.recipient, 5), ship())]) {
    const asked = ask(declare(f).game, f.asker, raw(f, mixed)), before = structuredClone(asked);
    assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']); assert.deepEqual(asked, before);
    rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
    assert.equal(player(asked, f.target).spice, 8); assert.equal(viewGame(asked, f.target).nullentropy?.search, null);
  }
  physical(f.game, f);
});

void test('earlier physical Box activation and its recovered card do not satisfy a second original Truth future-play interval', () => {
  const f = fixture({ advanced: true }); let game = bind(f, 'yes', raw(f, use())).game;
  game = settle(act(game, f.target, f.boxAction)); assert.equal(promise(game).fulfilled, true);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.truth)); assert.equal(stage(game)?.played, true);
  const prior = structuredClone(game.turnActionPromises![0]), declared = declare(f, game, 1);
  const asked = ask(declared.game, declared.asker, raw(f, use()));
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']); rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(asked, f.target, 'no'); assert.deepEqual(game.turnActionPromises![0], prior);
  assert.equal(stage(game, 1)?.played, false); assert.equal(game.discard.filter(card => card.id === f.box).length, 1);
  assert.equal(player(game, f.target).spice, 6); game = finish(game);
  assert.equal(promise(game).fulfilled, true); assert.equal(stage(game, 1)?.played, false); physical(game, f);
});

void test('a definite late Box answer reopens actual own Ready and cannot expire its required paid activation', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced, late: true }), source = act(f.game, f.target, { type: 'ready' });
    assert.ok(source.ready.includes(f.target)); const actions: TruthBoxPlayStep[] = [];
    let game = bind(f, 'yes', raw(f, use()), source, 0, actions).game; game = settle(game, actions);
    assert.equal(game.ready.includes(f.target), false); rejected(game, f.target, { type: 'ready' });
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, 'card');
    assert.equal(guide.action.card, f.box); assert.equal(guide.action.turnActionPromisePhase, 8);
    game = settle(act(game, f.target, guide.action, actions), actions);
    assert.equal(promise(game).fulfilled, true); assert.equal(stage(game)?.played, true); assert.equal(player(game, f.target).spice, 6);
    assert.equal(!!game.semutaPreview, !advanced); physical(game, f);
  }
});

void test('exact printed Box guide envelopes reject stale owners and preselection, then native JSON selection spends only once', () => {
  const f = fixture({ advanced: true, multiple: true }); let game = bind(f, 'yes', raw(f, use())).game;
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.event, promise(game).event); assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.box);
  assert.equal(guide.action.turnActionPromiseEvent, promise(game).event); assert.equal(guide.action.turnActionPromisePhase, game.phase);
  rejected(game, f.asker, guide.action); rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-box-event' });
  rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 4 }); rejected(game, f.target, { ...guide.action, give: f.hajr });
  const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, packet);
  assert.equal(player(game, f.target).spice, 4); assert.equal(stage(game)?.played, true); assert.equal(promise(game).fulfilled, true);
  const search = viewGame(game, f.target).nullentropy?.search; assert.ok(search); rejected(game, f.target, packet);
  const selection: Action = JSON.parse(JSON.stringify({ type: 'decision', event: search.event, card: f.hajr }));
  game = settle(act(game, f.target, selection)); assert.equal(player(game, f.target).spice, 4);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.hajr)); rejected(game, f.target, selection); physical(game, f);
});

void test('all four minimal profiles perform real printed Box payment and native private selection in Basic and Advanced', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced, multiple: true }), declared = declare(f), asked = ask(declared.game, declared.asker, f.question);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthBoxPlayStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, `${advanced}/${difficulty}`);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 100 && (!promise(game).fulfilled || !clean(game)); count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        if (game.pendingNullentropy) {
          const search = view.nullentropy?.search; assert.ok(search);
          const choice = botActions(view).find(candidate => candidate.type === 'decision' && candidate.event === search.event);
          assert.ok(choice, `${advanced}/${difficulty}`); game = act(game, f.target, choice, actions);
        } else if (view.turnActionGuide) {
          const guide = view.turnActionGuide;
          const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.action.turnActionPromiseEvent);
          assert.ok(action, `${advanced}/${difficulty}`); assert.deepEqual(action, guide.action); game = act(game, f.target, action, actions);
        } else {
          const step = nativeStep(game); assert.ok(step, `${advanced}/${difficulty}`); game = act(game, step.actor, step.action, actions);
        }
      }
      assert.equal(promise(game).fulfilled, true); assert.ok(clean(game)); assert.equal(stage(game)?.played, true);
      assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'card' && step.action.card === f.box).length, 1);
      assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'decision' && typeof step.action.card === 'string').length, 1);
      assert.equal(game.discard.filter(card => card.id === f.box).length, 1); assert.equal(player(game, f.target).spice, 2);
      assert.equal(player(game, f.recipient).bribes, 2); assert.equal(!!game.semutaPreview, !advanced); physical(game, f);
    }
  }
});
