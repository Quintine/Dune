import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { spiceDeck, treacheryDeck } from '../game/cards';
import { viewGame, type Action, type Game } from '../game/engine';
import { CHEAP_HERO_TRAITOR, traitorDeck } from '../game/traitors';
import { truthFactAnswer } from '../game/truthtrance';
import { windowCardOpportunity } from '../game/window-card-play';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';
import {
  actTruthTurnAmal as act, advanceTruthTurnAmal as advance, answerTruthTurnAmal as answer,
  askTruthTurnAmal as ask, bindTruthTurnAmal as bind, closeTruthTurnAmal as close,
  createTruthTurnAmalFixture as fixture, declareTruthTurnAmal as declare, finishTruthTurnAmal as finish,
  nextTruthTurnAmalNative as nativeStep, settleTruthTurnAmal as settle,
  truthTurnAmalFact as fact, truthTurnAmalGroup as group, truthTurnAmalInventory as inventory,
  truthTurnAmalPayment as payment, truthTurnAmalPlay as play, truthTurnAmalPlayer as player,
  truthTurnAmalPromise as promise, truthTurnAmalQuiet as quiet, truthTurnAmalSpice as spice,
  truthTurnAmalTraitors as traitors, type TruthTurnAmalFixture, type TruthTurnAmalStep,
} from './fixture-truth-turn-amal';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTurnAmalFixture, copies: 1 | 2 = 1) {
  for (const truth of f.truths.slice(0, copies)) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
  assert.deepEqual(spice(game), f.originalSpice);
}
function receipt(game: Game, index = 0) {
  const stage = game.turnActionPromises![index].windowCards?.amal; assert.ok(stage); return stage;
}

void test('native Amal sources retain original selected-Ix inventories and real first Storm, Spice and Mentat openings', () => {
  for (const advanced of [false, true]) for (const phase of [0, 1, 8] as const) {
    const f = fixture({ phase, advanced }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(f.originalCards, treacheryDeck(['ix']).map(card => card.id).sort());
    assert.deepEqual(f.originalTraitors, traitorDeck(f.setup.players, true).sort()); assert.ok(f.originalTraitors.includes(CHEAP_HERO_TRAITOR));
    assert.equal(f.originalCards.length, 47); assert.equal(f.originalSpice.length, spiceDeck(true).length);
    assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
    assert.deepEqual(player(f.game, f.target).hand.map(card => card.id), [f.amal]);
    assert.equal(f.game.phase, phase); assert.equal(f.game.turn, 1); assert.ok(f.game.phaseOpening);
    assert.deepEqual(f.game.phaseOpening.passed, []);
    const collectionIncome = f.game.players.map(candidate => f.collection
      ? player(f.collection.after, candidate.id).spice - player(f.collection.before, candidate.id).spice : 0);
    assert.deepEqual(f.game.players.map(candidate => candidate.spice), f.afterSetup.players.map((candidate, index) => candidate.spice + collectionIncome[index]));
    if (phase === 8) {
      assert.ok(f.collection); assert.equal(f.collection.before.phase, 7); assert.ok(f.collection.before.phaseOpening);
      assert.equal(f.collection.after.phase, 7); assert.equal(f.collection.after.phaseOpening, null);
      assert.deepEqual(collectionIncome, advanced ? [2, 2, 0] : [0, 0, 0]);
      assert.equal(f.sourceCounts.actualCollection, f.collection.steps.length);
      assert.ok(f.collection.steps.some(step => step.action.type === 'ready'));
      assert.equal(player(f.collection.before, f.asker).forces['carthag:11'], 10);
      assert.equal(player(f.collection.before, f.observer).forces['arrakeen:10'], 10);
    }
    assert.equal(f.source, `phase-opening:1:${phase}`); assert.deepEqual(windowCardOpportunity(f.game, 'amal'), f.opportunity);
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceCounts.selected, f.sourceActions.length);
    assert.ok(f.sourceCounts.originalSetup <= f.sourceActionCount);
    if (phase > 0) assert.ok(f.sourceActions.some(step => step.action.type === 'ready'));
    assert.deepEqual(viewGame(f.game, f.target).amalCards, [f.amal]); assert.equal(viewGame(f.game, f.target).amalReady, true);
    assert.deepEqual(viewGame(f.game, f.asker).amalCards, []); assert.equal(f.game.turnActionPromises?.length ?? 0, 0);
    assert.deepEqual(inventory(f.game), f.originalCards); assert.deepEqual(traitors(f.game), f.originalTraitors);
    assert.deepEqual(spice(f.game), f.originalSpice);
  }
});

void test('native Amal AND payment quotes the real halving before payment and freezes the original spice fact', () => {
  for (const advanced of [false, true]) for (const phase of [0, 1] as const) {
    const f = fixture({ phase, advanced });
    const mixed = group('and', fact(f.spiceFact), play(f.source), payment(f.recipient));
    let game = bind(f, 'yes', mixed).game; rejected(game, f.target, f.payment);
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.amal);
    game = settle(act(game, f.target, guide.action));
    assert.deepEqual(game.players.map(candidate => candidate.spice), [5, 5, 5]); assert.ok(game.phaseOpening);
    assert.deepEqual(game.phaseOpening.passed, []); assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
    assert.equal(receipt(game).played, true); assert.ok(!promise(game, f.target).fulfilled); rejected(game, f.target, f.payment);
    game = close(game, f); game = act(game, f.target, f.payment);
    assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.recipient).bribes, 5);
    assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(promise(game, f.target).mixed, mixed);
    assert.equal(game.discard.filter(card => card.id === f.amal).length, 1); physical(game, f);
  }
  // Absolute five-versus-six funding uses the closing Mentat opening. Early
  // examples above prove an owned-current-purse path, not all future income.
  const closing = fixture({ phase: 8 }), impossible = group('and', play(closing.source), payment(closing.recipient, 6));
  const asked = ask(declare(closing).game, closing.asker, closing.target, impossible);
  assert.deepEqual(viewGame(asked, closing.target).truthTurnActionAnswers, ['no']);
  rejected(asked, closing.target, { type: 'truthAnswer', answer: 'yes' });
  let funded = bind(closing).game; funded = settle(act(funded, closing.target, closing.nativeAction));
  funded = close(funded, closing); funded = act(funded, closing.target, closing.payment);
  assert.equal(player(funded, closing.target).spice, 0); assert.equal(promise(funded, closing.target).fulfilled, true); physical(funded, closing);
});

void test('whole Amal OR payment Yes preserves printed halving or an ordinary payment after passing without halving', () => {
  const f = fixture(), mixed = group('or', play(f.source), payment(f.recipient));
  const bound = bind(f, 'yes', mixed).game;
  const played = settle(act(bound, f.target, f.nativeAction));
  assert.equal(promise(played, f.target).fulfilled, true); assert.equal(player(played, f.recipient).bribes, 0);
  assert.equal(player(played, f.target).spice, 5);
  let paid = act(bound, f.target, { type: 'ready' }); paid = close(paid, f);
  assert.equal(player(paid, f.target).spice, 10); assert.equal(receipt(paid).played, false);
  paid = act(paid, f.target, f.payment); assert.equal(player(paid, f.target).spice, 5);
  assert.equal(promise(paid, f.target).fulfilled, true); assert.ok(player(paid, f.target).hand.some(card => card.id === f.amal));
  physical(played, f); physical(paid, f);
});

void test('whole Amal AND payment No limits the real payment after cost but permits payment after the unplayed opening closes', () => {
  const f = fixture(); let played = bind(f, 'no').game;
  played = settle(act(played, f.target, f.nativeAction)); played = close(played, f);
  rejected(played, f.target, f.payment);
  played = act(played, f.target, { type: 'bribe', target: f.recipient, amount: 4 });
  rejected(played, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  assert.equal(receipt(played).played, true); assert.ok(!promise(played, f.target).released);
  played = finish(played); assert.equal(promise(played, f.target).fulfilled, true); physical(played, f);
  let paid = close(bind(f, 'no').game, f); assert.equal(receipt(paid).played, false);
  paid = act(paid, f.target, f.payment); assert.equal(player(paid, f.target).spice, 5);
  paid = finish(paid); assert.equal(promise(paid, f.target).fulfilled, true); physical(paid, f);
});

void test('whole Amal OR payment No preserves its cumulative payment cap through the original opening and current turn', () => {
  const f = fixture(), mixed = group('or', play(f.source), payment(f.recipient));
  let game = bind(f, 'no', mixed).game; rejected(game, f.target, f.nativeAction); rejected(game, f.target, f.payment);
  game = close(game, f); assert.deepEqual(receipt(game), { source: f.source, played: false, closed: true });
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 4 });
  rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native own opening Ready cannot evade a required Amal while foreign passes remain legal and the actual play resets them', () => {
  const f = fixture({ phase: 1 }); let game = bind(f, 'yes', play(f.source)).game;
  const view = viewGame(game, f.target); assert.equal(view.amalReady, true);
  assert.equal(view.turnActionGuide?.action.type, 'card'); assert.equal(view.turnActionGuide?.action.card, f.amal);
  rejected(game, f.target, { type: 'ready' });
  game = act(game, f.asker, { type: 'ready' }); game = act(game, f.observer, { type: 'ready' });
  assert.ok(game.phaseOpening?.passed.includes(f.asker) && game.phaseOpening.passed.includes(f.observer));
  rejected(game, f.target, { type: 'ready' }); game = settle(act(game, f.target, f.nativeAction));
  assert.deepEqual(game.phaseOpening?.passed, []); assert.equal(promise(game, f.target).fulfilled, true);
  game = close(game, f); assert.equal(game.phaseOpening, null); physical(game, f);
});

void test('definite Yes and No including constants reopen a real earlier own opening pass', () => {
  const f = fixture(), passed = act(f.game, f.target, { type: 'ready' }); assert.ok(passed.phaseOpening?.passed.includes(f.target));
  for (const [selected, mixed] of [
    ['yes', play(f.source)], ['no', play(f.source)],
    ['yes', group('or', fact(f.spiceFact), play(f.source))],
    ['no', group('and', fact({ kind: 'spice', compare: 'gte', value: 100 }), play(f.source))],
  ] as const) {
    const game = bind(f, selected, mixed, passed).game;
    assert.ok(game.phaseOpening); assert.equal(game.phaseOpening.passed.includes(f.target), false);
    assert.equal(windowCardOpportunity(game, 'amal')?.source, f.source); physical(game, f);
  }
});

void test('temporary Truthtrance priority and question stages preserve the original actual Amal opening without halving', () => {
  const f = fixture({ phase: 1 }), declared = declare(f);
  assert.ok(declared.game.phaseOpening); assert.equal(windowCardOpportunity(declared.game, 'amal')?.source, f.source);
  const asked = ask(declared.game, f.asker, f.target, f.mixed);
  assert.ok(asked.phaseOpening); assert.equal(windowCardOpportunity(asked, 'amal')?.source, f.source);
  assert.deepEqual(asked.players.map(candidate => candidate.spice), [10, 10, 10]);
  assert.equal(player(asked, f.target).hand.some(card => card.id === f.amal), true);
  const game = answer(asked, f.target, 'yes'); assert.deepEqual(game.players.map(candidate => candidate.spice), [10, 10, 10]);
  assert.equal(receipt(game).played, false); assert.deepEqual(game.phaseOpening?.passed, []); physical(game, f);
});

void test('a foreign actual Mentat Amal may release another respondent full-purse payment without vetoing the cost or last pass', () => {
  const f = fixture({ phase: 8 }), amount = player(f.game, f.observer).spice, mixed = payment(f.recipient, amount);
  const asked = ask(declare(f).game, f.asker, f.observer, mixed);
  let game = answer(asked, f.observer, 'yes'); const history = structuredClone(game.truthHistory!.at(-1));
  const purses = game.players.map(candidate => candidate.spice);
  game = settle(act(game, f.target, f.nativeAction));
  assert.deepEqual(game.players.map(candidate => candidate.spice), purses.map(value => Math.floor(value / 2)));
  assert.equal(promise(game, f.observer).released, true); assert.ok(!promise(game, f.observer).fulfilled);
  assert.deepEqual(game.truthHistory!.at(-1), history); assert.deepEqual(game.turnActionPromises![0].payments, []);
  game = act(game, f.asker, { type: 'ready' }); game = act(game, f.target, { type: 'ready' });
  game = act(game, f.observer, { type: 'ready' }); assert.equal(game.phaseOpening, null);
  assert.equal(promise(game, f.observer).released, true);
  assert.equal(game.discard.filter(card => card.id === f.amal).length, 1); physical(game, f);
});

void test('actual queued phase7 bribes arrive only after Mentat opening halving and fund nine rather than ten', () => {
  const f = fixture({ phase: 8, incoming: 4 }); assert.ok(f.incomingReceipt);
  assert.equal(f.sourceCounts.actualIncomingPayment, f.incomingReceipt.steps.length);
  assert.ok(f.incomingReceipt.steps.some(step => step.actor === f.asker && step.action.type === 'bribe' && step.action.amount === 4));
  assert.equal(player(f.game, f.target).spice, 10); assert.equal(player(f.game, f.target).bribes, 4);
  const impossible = group('and', play(f.source), payment(f.recipient, 10));
  const asked = ask(declare(f).game, f.asker, f.target, impossible);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
  const mixed = group('and', fact(f.spiceFact), play(f.source), payment(f.recipient, 9));
  let game = bind(f, 'yes', mixed).game; game = settle(act(game, f.target, f.nativeAction));
  assert.equal(player(game, f.target).spice, 5); assert.equal(player(game, f.target).bribes, 4);
  rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 9 });
  game = close(game, f); assert.equal(player(game, f.target).spice, 9); assert.equal(player(game, f.target).bribes, 0);
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'bribe'); assert.equal(guide.action.amount, 9); game = act(game, f.target, guide.action);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.recipient).bribes, 9);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('an original first-opening No cannot count or forbid the actual Amal promised by a second Truth in the next phase', () => {
  const f = fixture(), actions: TruthTurnAmalStep[] = [];
  let game = close(bind(f, 'no', play(f.source), f.game, 0, actions).game, f, actions);
  const earlier = structuredClone(receipt(game)); assert.equal(promise(game, f.target).fulfilled, true);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.amal));
  game = advance(game, state => state.phase === 1 && !!state.phaseOpening && quiet(state), actions, true);
  const next = windowCardOpportunity(game, 'amal'); assert.ok(next); assert.notEqual(next.source, f.source);
  game = bind(f, 'yes', play(next.source), game, 1, actions).game;
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide); assert.equal(guide.event, game.turnActionPromises![1].event);
  game = settle(act(game, f.target, guide.action, actions), actions);
  assert.equal(game.turnActionPromises![1].fulfilled, true); assert.equal(receipt(game, 1).played, true);
  assert.deepEqual(receipt(game), earlier); assert.equal(receipt(game).played, false);
  assert.deepEqual(game.players.map(candidate => candidate.spice), [5, 5, 5]);
  assert.equal(game.discard.filter(card => card.id === f.amal).length, 1); assert.ok(actions.length > f.sourceActionCount); physical(game, f, 2);
});

void test('exact Amal guides retain the original opening, physical owner and event while stale or late sources reject', () => {
  const f = fixture({ phase: 1 }), declared = declare(f);
  for (const source of ['phase-opening:1:0', 'phase-opening:2:1', `${f.source}:extra`])
    rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, mixed: play(source) } });
  rejected(declared.game, f.target, { type: 'truthAsk', question: f.question });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, mixed: { kind: 'action', action: {
    kind: 'windowCardPlay', effect: 'amal', source: f.source, amount: 5,
  } } } });
  let game = bind(f, 'yes', play(f.source)).game;
  const own = viewGame(game, f.target), guide = own.turnActionGuide; assert.ok(guide);
  assert.deepEqual(Object.keys(guide.action).sort(), ['type', 'card', 'turnActionPromiseEvent', 'turnActionPromisePhase'].sort());
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.amal);
  assert.equal(guide.event, promise(game, f.target).event); assert.equal(guide.action.turnActionPromiseEvent, guide.event);
  assert.equal(guide.action.turnActionPromisePhase, 1); assert.deepEqual(own.amalCards, [f.amal]); assert.equal(own.amalReady, true);
  assert.deepEqual(viewGame(game, f.asker).amalCards, []);
  assert.ok(Object.keys(promise(game, f.target)).every(key => ['event', 'player', 'asker', 'turn', 'mixed', 'answer', 'fulfilled', 'released'].includes(key)));
  rejected(game, f.target, { type: 'ready' }); rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, mode: 'special' });
  rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-amal-event' });
  rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 0 });
  const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, packet));
  rejected(game, f.target, packet); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  const closed = close(f.game, f); rejected(closed, f.target, f.nativeAction);
  const after = declare(f, closed); rejected(after.game, f.asker, { type: 'truthAsk', question: f.question });
});

void test('an actual bidding opening quote leaves the unopened auction pool untouched until real global passes initialize it', () => {
  const f = fixture({ phase: 1 }); let game = close(f.game, f); assert.equal(beforeIxSpiceDraw(game), true);
  orderIxSpiceCards(game, [{ territory: 'hagga_basin' }]);
  game = advance(game, state => state.phase === 3 && !!state.phaseOpening && quiet(state), [], true);
  assert.equal(game.auction, null); const deck = game.deck.map(card => card.id), current = windowCardOpportunity(game, 'amal'); assert.ok(current);
  const mixed = group('and', play(current.source), payment(f.recipient));
  game = bind(f, 'yes', mixed, game).game;
  assert.equal(game.auction, null); assert.deepEqual(game.deck.map(card => card.id), deck);
  assert.equal(player(game, f.target).spice, 10);
  game = settle(act(game, f.target, f.nativeAction)); assert.equal(game.auction, null); assert.deepEqual(game.deck.map(card => card.id), deck);
  game = close(game, { source: current.source }); assert.ok(game.auction); assert.ok(game.deck.length < deck.length);
  game = act(game, f.target, f.payment); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('all four minimal profiles execute real Amal before payment and pass a No through native opening Ready', () => {
  for (const phase of [0, 1] as const) {
    const f = fixture({ phase }), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthTurnAmalStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, difficulty);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 22 && !promise(game, f.target).fulfilled; count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        const guide = view.turnActionGuide;
        if (guide) {
          const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.event);
          assert.ok(action, `${phase}/${difficulty}`); assert.deepEqual(action, guide.action);
          game = act(game, f.target, action, actions);
        } else {
          const next = nativeStep(game); assert.ok(next, `${phase}/${difficulty}`); game = act(game, next.actor, next.action, actions);
        }
      }
      assert.equal(promise(game, f.target).fulfilled, true, `${phase}/${difficulty}`);
      const costAt = actions.findIndex(step => step.action.type === 'card' && step.action.card === f.amal);
      const payAt = actions.findIndex(step => step.actor === f.target && step.action.type === 'bribe');
      assert.ok(costAt >= 0 && payAt > costAt); assert.equal(player(game, f.target).spice, 0); physical(game, f);
      const no = bind(f, 'no', play(f.source)).game, view = viewGame(no, f.target);
      view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      assert.equal(view.amalReady, true); assert.deepEqual(view.amalCards, [f.amal]); rejected(no, f.target, f.nativeAction);
      const ready = botActions(view)[0]; assert.equal(ready.type, 'ready'); assert.deepEqual(ready, view.turnActionGuide?.action);
      const passed = act(no, f.target, ready), passedView = viewGame(passed, f.target);
      assert.equal(passedView.amalReady, false); assert.deepEqual(passedView.amalCards, []);
      const completed = close(passed, f);
      assert.equal(promise(completed, f.target).fulfilled, true); assert.equal(receipt(completed).played, false); physical(completed, f);
    }
  }
});
