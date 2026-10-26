import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { charityQuote } from '../game/charity';
import { spiceDeck, treacheryDeck } from '../game/cards';
import { viewGame, type Action, type Game } from '../game/engine';
import { CHEAP_HERO_TRAITOR, traitorDeck } from '../game/traitors';
import { truthFactAnswer, type TruthQuestion } from '../game/truthtrance';
import {
  actTruthChoamIncome as act, advanceTruthChoamIncome as advance, allowTruthChoamIncome as allow,
  answerTruthChoamIncome as answer, askTruthChoamIncome as ask, bindTruthChoamIncome as bind,
  createTruthChoamIncomeFixture as fixture, declareTruthChoamIncome as declare,
  nextTruthChoamIncomeNative as nativeStep, reachTruthChoamIncomeResponse as reachIncome,
  settleTruthChoamIncome as settle, truthChoamIncomeClean as clean,
  truthChoamIncomeGroup as group, truthChoamIncomeInventory as inventory,
  truthChoamIncomePayment as payment, truthChoamIncomePlayer as player,
  truthChoamIncomePromise as promise, truthChoamIncomeQuestion as question,
  truthChoamIncomeShip as ship, truthChoamIncomeSpice as spice, truthChoamIncomeTraitors as traitors,
  type TruthChoamIncomeFixture, type TruthChoamIncomeStep,
} from './fixture-truth-choam-income';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthChoamIncomeFixture, copies: 0 | 1 | 2 = 1) {
  for (const truth of f.truths.slice(0, copies)) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
  assert.deepEqual(spice(game), f.originalSpice);
}
const pay = (game: Game, f: TruthChoamIncomeFixture, amount: number, recipient = f.recipient,
  actions: TruthChoamIncomeStep[] = []) => act(game, f.target, { type: 'bribe', target: recipient, amount }, actions);

void test('native CHOAM income sources retain the original Ix deal, automatic receipt and distinct unused ordinary claim', () => {
  for (const options of [{}, { stage: 'afterIncome' as const }, { advanced: true }, { advanced: true, bg: true }] ) {
    const f = fixture(options); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(f.originalCards, treacheryDeck(['ix', 'choam']).map(card => card.id).sort()); assert.equal(f.originalCards.length, 47);
    assert.deepEqual(f.originalTraitors, traitorDeck(f.afterSetup.players, true).sort()); assert.ok(f.originalTraitors.includes(CHEAP_HERO_TRAITOR));
    assert.equal(f.originalSpice.length, spiceDeck(true).length); assert.equal(f.originalSpice.length, 22);
    assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
    assert.ok(player(f.game, f.observer).hand.some(card => card.id === f.karama));
    assert.deepEqual(player(f.game, f.target).hand.map(card => card.id), f.startingChoamCards);
    assert.equal(f.startCash, 2); assert.equal(f.incomeAmount, 2 * f.game.players.length);
    assert.equal(player(f.game, f.target).spice, f.startCash + (f.income ? f.incomeAmount : 0));
    assert.notEqual(player(f.game, f.target).charityTurn, f.game.turn);
    assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.sourceCounts.selected, f.actions.length);
    assert.equal(f.sourceCounts.beforeIncome, f.beforeIncomeActions.length); assert.equal(f.sourceCounts.actualIncomeResponse, f.income?.steps.length ?? 0);
    if (f.income) {
      assert.equal(f.income.before.response?.kind, 'choamCharity'); assert.ok(f.income.steps.every(step => step.action.type === 'passResponse'));
      assert.equal(player(f.income.before, f.target).spice, 2); assert.equal(player(f.income.after, f.target).spice, 2 + f.incomeAmount);
      assert.deepEqual(f.game.choamCharity, { turn: 1, canceled: false });
    } else assert.notEqual(f.game.choamCharity?.turn, f.game.turn);
    const asked = ask(declare(f).game, f.asker, question(f, 'bribe', f.maximum)), before = structuredClone(asked);
    assert.deepEqual(viewGame(asked, f.target).truthBribeAnswers, ['yes', 'no']);
    assert.deepEqual(asked, before, 'A quote never credits automatic income or stamps an ordinary claim'); physical(asked, f, 0);
  }
});

void test('allowed automatic CHOAM opening income funds whole, bare, grouped and mixed installments with frozen facts', () => {
  for (const kind of ['turnActions', 'bribe', 'bribeExpression', 'mixedBribe'] as const) {
    const f = fixture(), raw = question(f, kind); const actions: TruthChoamIncomeStep[] = [];
    let game = bind(f, 'yes', raw, f.game, 0, actions).game;
    const recipientCash = player(game, f.recipient).spice;
    game = pay(game, f, f.startCash, f.recipient, actions); assert.equal(player(game, f.target).spice, 0);
    assert.equal(player(game, f.recipient).spice, recipientCash); assert.equal(player(game, f.recipient).bribes, f.startCash);
    assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no'); assert.ok(!promise(game, kind).fulfilled);
    assert.notEqual(game.choamCharity?.turn, game.turn); assert.notEqual(player(game, f.target).charityTurn, game.turn);
    game = reachIncome(game, actions); assert.equal(game.response?.kind, 'choamCharity');
    rejected(game, f.target, f.charity); assert.equal(player(game, f.target).spice, 0);
    game = allow(game, actions); assert.equal(player(game, f.target).spice, f.incomeAmount);
    assert.deepEqual(game.choamCharity, { turn: 1, canceled: false }); assert.notEqual(player(game, f.target).charityTurn, game.turn);
    game = pay(game, f, f.incomeAmount, f.recipient, actions);
    assert.equal(promise(game, kind).fulfilled, true); assert.equal(player(game, f.target).spice, 0);
    assert.equal(player(game, f.recipient).spice, recipientCash); assert.equal(player(game, f.recipient).bribes, f.minimum);
    assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'bribe').length, 2);
    assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'charity').length, 0); physical(game, f);
  }
});

void test('the fixed CHOAM receipt and one ordinary Charity fund the maximum without sharing either marker twice', () => {
  const f = fixture(); const actions: TruthChoamIncomeStep[] = [];
  let game = bind(f, 'yes', question(f, 'turnActions', f.maximum), f.game, 0, actions).game;
  game = pay(game, f, f.startCash, f.recipient, actions); game = allow(reachIncome(game, actions), actions);
  game = pay(game, f, f.incomeAmount, f.recipient, actions); assert.equal(player(game, f.target).spice, 0);
  assert.equal(charityQuote(game, player(game, f.target)).total, 2); assert.notEqual(player(game, f.target).charityTurn, game.turn);
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, 'charity');
  assert.equal(guide.action.turnActionPromiseEvent, promise(game).event); assert.equal(guide.action.turnActionPromisePhase, 2);
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, guide.action, actions);
  assert.equal(player(game, f.target).spice, 2); assert.equal(player(game, f.target).charityTurn, game.turn);
  assert.deepEqual(game.choamCharity, { turn: 1, canceled: false });
  assert.equal(game.turnActionPromises![0].payments[0].amount, f.minimum, 'Neither automatic nor claimed income is itself a payment');
  game = pay(game, f, 2, f.recipient, actions); assert.equal(player(game, f.target).spice, 0);
  assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.recipient).bribes, f.maximum);
  assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'charity').length, 1);
  rejected(game, f.target, f.charity); physical(game, f);
});

void test('two original Truths cannot reserve the same automatic CHOAM income and ordinary claim for different recipients', () => {
  const f = fixture(); let game = bind(f, 'yes', question(f, 'bribe', f.maximum)).game;
  const earlier = structuredClone(game.bribePromises![0]), history = structuredClone(game.truthHistory![0]);
  const asked = ask(declare(f, game, 1).game, f.asker, question(f, 'bribe', 1, f.observer));
  assert.deepEqual(viewGame(asked, f.target).truthBribeAnswers, ['no']); rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(asked, f.target, 'no'); assert.deepEqual(game.bribePromises![0], earlier); assert.deepEqual(game.truthHistory![0], history);
  assert.equal(player(game, f.target).spice, f.startCash); assert.notEqual(game.choamCharity?.turn, game.turn);
  assert.notEqual(player(game, f.target).charityTurn, game.turn); physical(game, f, 2);
});

void test('real Karama cancellation releases a large fixed-income commitment while a current-cash plus ordinary-claim alternative survives', () => {
  for (const minimum of [10, 4]) {
    const f = fixture(); let game = bind(f, 'yes', question(f, 'turnActions', minimum)).game;
    game = pay(game, f, f.startCash); game = reachIncome(game);
    game = settle(act(game, f.observer, f.cancel));
    assert.deepEqual(game.choamCharity, { turn: 1, canceled: true }); assert.equal(player(game, f.target).spice, 0);
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(game.turnActionPromises![0].payments[0].amount, f.startCash);
    if (minimum === 10) { assert.equal(promise(game).released, true); assert.ok(!promise(game).fulfilled); }
    else {
      assert.ok(!promise(game).released); const claim = viewGame(game, f.target).turnActionGuide; assert.ok(claim);
      assert.equal(claim.action.type, 'charity'); game = act(game, f.target, claim.action); game = pay(game, f, 2);
      assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.recipient).bribes, 4);
    }
    physical(game, f);
  }
});

void test('already collected automatic income and claimed or expired ordinary Charity cannot be quoted a second time', () => {
  const f = fixture({ stage: 'afterIncome' });
  let asked = ask(declare(f).game, f.asker, question(f, 'bribe', f.maximum + 1));
  assert.deepEqual(viewGame(asked, f.target).truthBribeAnswers, ['no']);
  let game = pay(f.game, f, f.minimum); game = act(game, f.target, f.charity); game = pay(game, f, 2);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).charityTurn, game.turn);
  rejected(game, f.target, f.charity); asked = ask(declare(f, game).game, f.asker, question(f, 'bribe', 1));
  assert.deepEqual(viewGame(asked, f.target).truthBribeAnswers, ['no']); game = answer(asked, f.target, 'no'); physical(game, f);
  const expired = fixture({ stage: 'afterIncome' }); game = pay(expired.game, expired, expired.minimum);
  game = advance(game, state => state.phase === 3 && clean(state), [], true);
  assert.equal(player(game, expired.target).spice, 0); assert.notEqual(player(game, expired.target).charityTurn, game.turn);
  assert.deepEqual(game.choamCharity, { turn: 1, canceled: false }); rejected(game, expired.target, expired.charity);
  asked = ask(declare(expired, game).game, expired.asker, question(expired, 'bribe', 1));
  assert.deepEqual(viewGame(asked, expired.target).truthBribeAnswers, ['no']); game = answer(asked, expired.target, 'no'); physical(game, expired);
});

void test('payments and a later original shipment share the same single CHOAM receipt and ordinary claim', () => {
  const f = fixture();
  const unfunded: TruthQuestion = { kind: 'turnActions', target: f.target, turn: f.game.turn,
    mixed: group('and', payment(f.recipient, f.maximum - 1), ship()) };
  const asked = ask(declare(f).game, f.asker, unfunded);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']); rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const funded: TruthQuestion = { kind: 'turnActions', target: f.target, turn: f.game.turn,
    mixed: group('and', payment(f.recipient, f.minimum), ship()) };
  let game = bind(f, 'yes', funded).game; game = pay(game, f, f.startCash); game = allow(reachIncome(game));
  game = pay(game, f, f.incomeAmount); game = act(game, f.target, f.charity);
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), [], true);
  game = settle(act(game, f.target, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 }));
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).forces['polar_sink:0'], 1);
  assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.recipient).bribes, f.minimum);
  assert.equal(player(game, f.target).charityTurn, 1); assert.deepEqual(game.choamCharity, { turn: 1, canceled: false }); physical(game, f);
});

void test('an actual opposing ordinary claim debits CHOAM and releases a commitment beyond the remaining fixed income without veto', () => {
  const f = fixture({ stage: 'afterIncome' }); let game = bind(f, 'yes', question(f, 'bribe', f.maximum)).game;
  const opponentCash = player(game, f.observer).spice;
  game = act(game, f.observer, { type: 'bribe', target: f.recipient, amount: opponentCash });
  assert.equal(player(game, f.observer).spice, 0); assert.equal(player(game, f.target).spice, f.minimum);
  game = act(game, f.observer, f.charity);
  assert.equal(player(game, f.observer).spice, 2); assert.equal(player(game, f.target).spice, f.minimum - 2);
  assert.equal(player(game, f.observer).charityTurn, game.turn); assert.notEqual(player(game, f.target).charityTurn, game.turn);
  assert.equal(promise(game, 'bribe').released, true); assert.equal(game.bribePromises![0].progress, 0); physical(game, f);
});

void test('Advanced BG forced settlement after CHOAM passes last releases the fixed-income promise without attributing a voluntary debit', () => {
  const f = fixture({ advanced: true, bg: true }); assert.ok(f.bg);
  assert.ok(f.providerCard); assert.deepEqual(player(f.game, f.target).hand.map(card => card.id), [f.providerCard]);
  for (const kind of ['turnActions', 'bribe'] as const) {
    let game = bind(f, 'yes', question(f, kind, f.minimum), structuredClone(f.game)).game;
    game = pay(game, f, f.startCash); game = allow(reachIncome(game));
    assert.equal(player(game, f.target).spice, f.incomeAmount); assert.equal(player(game, f.bg).spice, 5);
    // CHOAM's current cash meets this fixed-income answer. Finish its actual
    // turn before BG acts; the closed ordinary claim cannot repair a later debit.
    while (game.charityOrder!.remaining[0] !== f.bg)
      game = act(game, game.charityOrder!.remaining[0], { type: 'ready' });
    game = act(game, f.bg, f.charity); assert.equal(game.response?.kind, 'bgCharity');
    assert.equal(player(game, f.target).spice, f.incomeAmount); assert.ok(!promise(game, kind).released);
    while (game.response?.kind === 'bgCharity') {
      const response = game.response;
      const actor = game.players.find(candidate => candidate.id !== f.target && candidate.id !== response.owner &&
        !response.passed.includes(candidate.id) && !!viewGame(game, candidate.id).responseControls?.cancelCards.length);
      if (!actor) break;
      game = act(game, actor.id, { type: 'passResponse' });
    }
    assert.equal(game.response?.kind, 'bgCharity'); assert.ok(!game.response.passed.includes(f.target));
    assert.ok(viewGame(game, f.target).responseControls?.cancelCards.includes(f.providerCard));
    game = act(game, f.target, { type: 'passResponse' });
    assert.equal(game.response, null); assert.equal(player(game, f.bg).spice, 7);
    assert.equal(player(game, f.target).spice, f.incomeAmount - 2); assert.equal(player(game, f.bg).charityTurn, game.turn);
    assert.notEqual(player(game, f.target).charityTurn, game.turn); assert.equal(promise(game, kind).released, true);
    assert.equal(kind === 'turnActions' ? game.turnActionPromises![0].payments[0].amount : game.bribePromises![0].progress, f.startCash);
    assert.ok(player(game, f.target).hand.some(card => card.id === f.providerCard)); physical(game, f);
  }
});

void test('actual Charity guides retain the original CHOAM promise event and owner through JSON without crediting income twice', () => {
  for (const kind of ['turnActions', 'bribe'] as const) {
    const f = fixture({ stage: 'afterIncome' }); let game = bind(f, 'yes', question(f, kind, f.maximum)).game;
    game = pay(game, f, f.minimum);
    const view = viewGame(game, f.target), guide = kind === 'turnActions' ? view.turnActionGuide : view.bribePromiseGuide;
    assert.ok(guide); assert.equal(guide.action.type, 'charity');
    assert.equal(kind === 'turnActions' ? guide.action.turnActionPromiseEvent : guide.action.bribePromiseEvent, promise(game, kind).event);
    rejected(game, f.asker, guide.action);
    rejected(game, f.target, kind === 'turnActions' ? { ...guide.action, turnActionPromiseEvent: 'stale-choam-income-event' }
      : { ...guide.action, bribePromiseEvent: 'stale-choam-income-event' });
    const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, packet); rejected(game, f.target, packet);
    assert.equal(player(game, f.target).spice, 2); assert.equal(player(game, f.target).charityTurn, game.turn);
    assert.deepEqual(game.choamCharity, { turn: 1, canceled: false });
    const next = viewGame(game, f.target), final = kind === 'turnActions' ? next.turnActionGuide : next.bribePromiseGuide;
    assert.ok(final); assert.equal(final.action.type, 'bribe'); assert.equal(final.action.amount, 2);
    game = act(game, f.target, final.action); assert.equal(promise(game, kind).fulfilled, true); physical(game, f);
  }
});

void test('all four minimal profiles await the real CHOAM response then use legal installments and one ordinary Charity', () => {
  for (const kind of ['turnActions', 'bribe'] as const) {
    const f = fixture(), asked = ask(declare(f).game, f.asker, question(f, kind, f.maximum));
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthChoamIncomeStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, `${kind}/${difficulty}`);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 160 && !promise(game, kind).fulfilled; count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        const guide = kind === 'turnActions' ? view.turnActionGuide : view.bribePromiseGuide;
        if (guide) {
          const action = botActions(view).find(candidate => kind === 'turnActions'
            ? candidate.turnActionPromiseEvent === guide.action.turnActionPromiseEvent
            : candidate.bribePromiseEvent === guide.action.bribePromiseEvent);
          assert.ok(action, `${kind}/${difficulty}`); assert.deepEqual(action, guide.action);
          if (action.type === 'charity') assert.equal(game.phase, 2);
          game = act(game, f.target, action, actions);
        } else {
          const step = nativeStep(game); assert.ok(step, `${kind}/${difficulty}`); game = act(game, step.actor, step.action, actions);
        }
      }
      assert.equal(promise(game, kind).fulfilled, true, `${kind}/${difficulty}`);
      assert.deepEqual(game.choamCharity, { turn: 1, canceled: false }); assert.equal(player(game, f.target).charityTurn, game.turn);
      assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'charity').length, 1);
      assert.ok(actions.filter(step => step.actor === f.target && step.action.type === 'bribe').length >= 3);
      assert.equal(player(game, f.recipient).bribes, f.maximum); assert.equal(player(game, f.target).spice, 0); physical(game, f);
    }
  }
});
