import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { spiceDeck, treacheryDeck } from '../game/cards';
import { stormSectorAfter } from '../game/disaster-rules';
import { viewGame, type Action, type Game } from '../game/engine';
import { CHEAP_HERO_TRAITOR, traitorDeck } from '../game/traitors';
import { truthFactAnswer } from '../game/truthtrance';
import { windowCardOpportunity } from '../game/window-card-play';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';
import {
  actTruthTurnThumper as act, advanceTruthTurnThumper as advance, answerTruthTurnThumper as answer,
  askTruthTurnThumper as ask, bindTruthTurnThumper as bind, closeTruthTurnThumper as close,
  createTruthTurnThumperFixture as fixture, declareTruthTurnThumper as declare, finishTruthTurnThumper as finish,
  nextTruthTurnThumperNative as nativeStep, settleTruthTurnThumper as settle,
  truthTurnThumperClean as clean, truthTurnThumperFact as fact, truthTurnThumperGroup as group,
  truthTurnThumperInventory as inventory, truthTurnThumperMove as move, truthTurnThumperPayment as payment,
  truthTurnThumperPlay as play, truthTurnThumperPlayer as player, truthTurnThumperPromise as promise,
  truthTurnThumperSpice as spice, truthTurnThumperTraitors as traitors,
  type TruthTurnThumperFixture, type TruthTurnThumperStep,
} from './fixture-truth-turn-thumper';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTurnThumperFixture, copies: 1 | 2 = 1) {
  for (const truth of f.truths.slice(0, copies)) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
  assert.deepEqual(spice(game), f.originalSpice);
}
function receipt(game: Game, index = 0) {
  const stage = game.turnActionPromises![index].windowCards?.thumper; assert.ok(stage); return stage;
}

void test('genuine Thumper sources keep the complete selected-Ix inventories and actual opening or earned-body chronology', () => {
  for (const options of [{}, { advanced: true }, { turn: 2 as const }, { turn: 2 as const, waitingSandtrout: true }]) {
    const f = fixture(options); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(f.originalCards, treacheryDeck(['ix']).map(card => card.id).sort());
    assert.deepEqual(f.originalTraitors, traitorDeck(f.setup.players, true).sort()); assert.ok(f.originalTraitors.includes(CHEAP_HERO_TRAITOR));
    assert.equal(f.originalCards.length, 47); assert.equal(f.originalSpice.length, spiceDeck(true).length);
    assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
    assert.deepEqual(player(f.game, f.target).hand.map(card => card.id), [f.thumper]);
    assert.equal(f.game.phase, 1); assert.equal(f.game.turn, f.turn); assert.equal(f.game.thumperWindowOpen, true);
    assert.deepEqual(f.game.ready, []); assert.equal(viewGame(f.game, f.target).beforeSpiceDraw, true);
    assert.deepEqual(windowCardOpportunity(f.game, 'thumper'), f.opportunity);
    assert.equal(f.source, `first-spice-reveal:${f.turn}`); assert.ok(f.sourceOpening.phaseOpening);
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceCounts.selected, f.sourceActions.length);
    assert.equal(f.sourceCounts.sourceOpening, f.sourceOpeningSteps.length);
    assert.ok(f.sourceOpeningSteps.filter(step => step.action.type === 'ready').length >= f.game.players.length);
    assert.deepEqual(viewGame(f.game, f.target).thumperCards, [f.thumper]);
    assert.deepEqual(viewGame(f.game, f.asker).thumperCards, []);
    if (f.turn === 2) {
      assert.ok(f.priorShipment && f.priorBlow); assert.equal(f.sourceCounts.priorShipment, f.priorShipment.steps.length);
      assert.equal(player(f.game, f.target).forces[f.previousLocation], 2); assert.equal(player(f.game, f.target).tanks, 0);
      assert.equal(player(f.game, f.target).spice, 10, 'Real shipment4 and native collection4 retain the original ten');
      assert.deepEqual(f.secondStormSteps.map(step => step.action.amount), [1, 1]);
      assert.equal(f.sourceCounts.secondStormDials, f.secondStormSteps.length);
      assert.equal(f.game.storm, stormSectorAfter(f.firstBeforeReveal.storm, 2));
      assert.equal(f.game.sandtrout, f.waitingSandtrout);
    }
    assert.equal(f.game.turnActionPromises?.length ?? 0, 0);
    assert.deepEqual(inventory(f.game), f.originalCards); assert.deepEqual(traitors(f.game), f.originalTraitors);
    assert.deepEqual(spice(f.game), f.originalSpice);
  }
});

void test('printed first-turn Thumper AND payment freezes facts and counts the real cost even when the encounter is ignored', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced }), mixed = group('and', fact(f.spiceFact), play(f.source), payment(f.recipient));
    let game = bind(f, 'yes', mixed).game; assert.deepEqual(receipt(game), { source: f.source, played: false, closed: false });
    game = act(game, f.target, f.payment); assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
    game = settle(act(game, f.target, f.nativeAction));
    assert.equal(game.discard.filter(card => card.id === f.thumper).length, 1);
    assert.equal(receipt(game).played, true); assert.equal(promise(game, f.target).fulfilled, true);
    assert.equal(player(game, f.target).spice, 8); assert.equal(player(game, f.recipient).bribes, 2);
    assert.equal(game.nexus, false); assert.equal(player(game, f.target).tanks, 0); assert.equal(game.thumperWindowOpen, false);
    assert.ok(game.log.some(entry => /first-turn worm rule ignores this Thumper/.test(entry.text)));
    assert.equal(game.spiceDiscard.flat().some(card => 'worm' in card && card.thumper), false);
    assert.equal(game.spiceWindow?.territory, f.previousTerritory); assert.equal(game.spiceWindow?.amount, 6);
    physical(game, f);
  }
});

void test('a real later Thumper kills the two genuinely shipped previous-pile counters before the next original land blow', () => {
  const f = fixture({ turn: 2 }); let game = bind(f).game;
  game = act(game, f.target, f.payment); const reserves = player(game, f.target).reserves;
  game = settle(act(game, f.target, f.nativeAction));
  assert.equal(player(game, f.target).forces[f.previousLocation] ?? 0, 0); assert.equal(player(game, f.target).tanks, 2);
  assert.equal(player(game, f.target).reserves, reserves); assert.equal(game.spice[f.previousLocation] ?? 0, 0);
  assert.equal(game.nexus, true); assert.equal(game.spiceWindow?.territory, 'broken_land'); assert.equal(game.spiceWindow?.amount, 8);
  assert.equal(receipt(game).played, true); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('earned waiting Sandtrout can suppress the real later Thumper while its printed cost still fulfills', () => {
  const f = fixture({ turn: 2, waitingSandtrout: true }); assert.equal(f.game.sandtrout, true);
  let game = bind(f, 'yes', play(f.source)).game; game = settle(act(game, f.target, f.nativeAction));
  assert.equal(game.sandtrout, false); assert.equal(game.nexus, false);
  assert.equal(player(game, f.target).forces[f.previousLocation], 2); assert.equal(player(game, f.target).tanks, 0);
  assert.equal(game.spiceWindow?.territory, 'broken_land'); assert.equal(game.spiceWindow?.amount, 16);
  assert.equal(receipt(game).played, true); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(game.discard.filter(card => card.id === f.thumper).length, 1); physical(game, f);
});

void test('whole Thumper OR payment Yes preserves the actual printed route and the manual payment route through normal reveal', () => {
  const f = fixture(), mixed = group('or', play(f.source), payment(f.recipient));
  const bound = bind(f, 'yes', mixed).game;
  const played = settle(act(bound, f.target, f.nativeAction));
  assert.equal(promise(played, f.target).fulfilled, true); assert.equal(player(played, f.recipient).bribes, 0);
  let paid = act(bound, f.target, f.payment); paid = close(paid, f);
  assert.equal(promise(paid, f.target).fulfilled, true); assert.equal(receipt(paid).played, false);
  assert.ok(player(paid, f.target).hand.some(card => card.id === f.thumper)); physical(played, f); physical(paid, f);
});

void test('whole Thumper AND payment No accepts either first action and guards only the actual completed predicate', () => {
  const f = fixture();
  for (const first of ['payment', 'card'] as const) {
    let game = bind(f, 'no').game;
    if (first === 'payment') { game = act(game, f.target, f.payment); rejected(game, f.target, f.nativeAction); }
    else {
      game = settle(act(game, f.target, f.nativeAction)); rejected(game, f.target, f.payment);
      game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
      rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
    }
    game = close(game, f); assert.ok(!promise(game, f.target).released);
    game = finish(game); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('whole Thumper OR payment No retains its real cumulative cap after the original first draw', () => {
  const f = fixture(), mixed = group('or', play(f.source), payment(f.recipient));
  let game = bind(f, 'no', mixed).game; rejected(game, f.target, f.nativeAction); rejected(game, f.target, f.payment);
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 }); game = close(game, f);
  assert.deepEqual(receipt(game), { source: f.source, played: false, closed: true });
  rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('a skipped first-reveal Thumper OR remains payable through actual late Mentat', () => {
  const f = fixture(), mixed = group('or', play(f.source), payment(f.recipient));
  let game = close(bind(f, 'yes', mixed).game, f);
  const evidence = structuredClone(receipt(game)); assert.deepEqual(evidence, { source: f.source, played: false, closed: true });
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(player(game, f.target).hand.some(card => card.id === f.thumper));
  game = advance(game, state => state.phase === 8 && clean(state), [], true);
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, f.payment);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(receipt(game), evidence); physical(game, f);
});

void test('definite Thumper answers reopen actual Ready and own acceptance cannot skip a required cost', () => {
  const f = fixture(), ready = act(f.game, f.target, { type: 'ready' }); assert.ok(ready.ready.includes(f.target));
  let game = bind(f, 'yes', play(f.source), ready).game;
  assert.equal(game.ready.includes(f.target), false); rejected(game, f.target, { type: 'ready' });
  game = act(game, f.asker, { type: 'ready' }); game = act(game, f.observer, { type: 'ready' });
  assert.equal(game.thumperWindowOpen, true); rejected(game, f.target, { type: 'ready' });
  game = settle(act(game, f.target, f.nativeAction)); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  const declined = bind(f, 'no', play(f.source), ready).game; assert.equal(declined.ready.includes(f.target), false);
  const completed = close(act(declined, f.target, { type: 'ready' }), f);
  assert.equal(promise(completed, f.target).fulfilled, true); assert.equal(receipt(completed).played, false); physical(completed, f);
  for (const [selected, mixed] of [
    ['yes', group('or', fact(f.spiceFact), play(f.source))],
    ['no', group('and', fact({ kind: 'spice', compare: 'gte', value: 100 }), play(f.source))],
  ] as const) {
    const answered = bind(f, selected, mixed, ready).game; assert.equal(answered.ready.includes(f.target), false); physical(answered, f);
  }
});

void test('real Amal opening and Truthtrance modal passes preserve the original first-reveal source', () => {
  const f = fixture(); let game = structuredClone(f.sourceOpening);
  while (game.phaseOpening || game.response) {
    assert.equal(windowCardOpportunity(game, 'thumper')?.source, f.source); assert.equal(game.thumperWindowOpen, true);
    const next = nativeStep(game); assert.ok(next); game = act(game, next.actor, next.action);
  }
  assert.equal(beforeIxSpiceDraw(game), true); assert.deepEqual(game.ready, []);
  const declared = declare(f, game); assert.equal(windowCardOpportunity(declared.game, 'thumper')?.source, f.source);
  const asked = ask(declared.game, f.asker, f.target, play(f.source));
  assert.equal(windowCardOpportunity(asked, 'thumper')?.source, f.source);
  game = answer(asked, f.target, 'yes'); game = settle(act(game, f.target, f.nativeAction));
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('exact Thumper guides reject stale source, owner and event while a real first reveal permanently closes that source', () => {
  const f = fixture(), declared = declare(f);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, mixed: play('first-spice-reveal:2') } });
  rejected(declared.game, f.target, { type: 'truthAsk', question: f.question });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, mixed: { kind: 'action', action: {
    kind: 'windowCardPlay', effect: 'thumper', source: f.source, worm: true,
  } } } });
  let game = bind(f).game; game = act(game, f.target, f.payment);
  const own = viewGame(game, f.target), guide = own.turnActionGuide; assert.ok(guide);
  assert.deepEqual(Object.keys(guide.action).sort(), ['type', 'card', 'turnActionPromiseEvent', 'turnActionPromisePhase'].sort());
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.thumper);
  assert.equal(guide.event, promise(game, f.target).event); assert.equal(guide.action.turnActionPromiseEvent, guide.event);
  assert.equal(guide.action.turnActionPromisePhase, 1); assert.deepEqual(own.thumperCards, [f.thumper]);
  assert.deepEqual(viewGame(game, f.asker).thumperCards, []);
  assert.ok(Object.keys(promise(game, f.target)).every(key => ['event', 'player', 'asker', 'turn', 'mixed', 'answer', 'fulfilled', 'released'].includes(key)));
  rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-thumper-event' });
  rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 0 });
  const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, packet));
  rejected(game, f.target, packet); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  const closed = close(f.game, f); assert.equal(closed.thumperWindowOpen, false);
  assert.equal(windowCardOpportunity(closed, 'thumper'), null); rejected(closed, f.target, f.nativeAction);
  const after = declare(f, closed);
  rejected(after.game, f.asker, { type: 'truthAsk', question: f.question });
});

void test('an original first-turn No does not forbid a later printed Thumper and second actual Truth in the next reveal window', () => {
  const f = fixture(), actions: TruthTurnThumperStep[] = [];
  let game = close(bind(f, 'no', play(f.source), f.game, 0, actions).game, f, actions);
  const earlier = structuredClone(receipt(game)); assert.equal(promise(game, f.target).fulfilled, true);
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), actions, true);
  game = settle(act(game, f.target, { type: 'ship', territory: f.previousTerritory, sector: f.previousSector,
    amount: 2, elite: 0, allyPayment: 0 }, actions), actions);
  game = act(game, f.target, { type: 'endMovement' }, actions);
  game = advance(game, state => state.turn === 2 && beforeIxSpiceDraw(state), actions, true);
  assert.deepEqual(actions.filter(step => step.action.type === 'stormDial').map(step => step.action.amount), [1, 1]);
  assert.equal(player(game, f.target).forces[f.previousLocation], 2); assert.equal(player(game, f.target).tanks, 0);
  orderIxSpiceCards(game, [{ territory: 'broken_land' }]);
  const next = windowCardOpportunity(game, 'thumper'); assert.ok(next); assert.notEqual(next.source, f.source);
  game = bind(f, 'yes', play(next.source), game, 1, actions).game;
  game = settle(act(game, f.target, f.nativeAction, actions), actions);
  assert.equal(game.turnActionPromises![1].fulfilled, true); assert.equal(receipt(game, 1).played, true);
  assert.deepEqual(receipt(game), earlier); assert.equal(receipt(game).played, false);
  assert.equal(player(game, f.target).tanks, 2); assert.equal(game.discard.filter(card => card.id === f.thumper).length, 1);
  assert.ok(actions.length > f.sourceActionCount); physical(game, f, 2);
});

void test('the earned three-counter move baseline is real but mandatory later Thumper cannot preserve it after paying the current purse', () => {
  const f = fixture({ turn: 2, bodyCount: 3 }), amount = player(f.game, f.target).spice;
  assert.ok(f.priorShipment); assert.equal(f.bodyCount, 3);
  assert.equal(player(f.priorShipment.before, f.target).spice - player(f.priorShipment.after, f.target).spice, 6);
  assert.equal(player(f.game, f.target).forces[f.previousLocation], 3); assert.equal(player(f.game, f.target).tanks, 0);
  assert.equal(amount, 10); assert.equal(f.sourceCounts.priorShipment, f.priorShipment.steps.length);
  const baseline = group('and', move('polar_sink', 3), payment(f.recipient, amount));
  let game = bind(f, 'yes', baseline).game; game = act(game, f.target, { type: 'bribe', target: f.recipient, amount });
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), [], true);
  assert.equal(player(game, f.target).forces[f.previousLocation], 3);
  game = settle(act(game, f.target, { type: 'move', from: f.previousLocation, territory: 'polar_sink', sector: 0, amount: 3 }));
  assert.equal(player(game, f.target).forces['polar_sink:0'], 3); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  let promised = bind(f, 'yes', baseline).game;
  promised = act(promised, f.target, { type: 'bribe', target: f.recipient, amount });
  rejected(promised, f.target, f.nativeAction);
  assert.equal(player(promised, f.target).forces[f.previousLocation], 3);
  const mixed = group('and', play(f.source), move('polar_sink', 3), payment(f.recipient, amount));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  let declined = answer(asked, f.target, 'no'); assert.equal(receipt(declined).played, false);
  declined = act(declined, f.target, { type: 'bribe', target: f.recipient, amount });
  declined = settle(act(declined, f.target, f.nativeAction));
  assert.equal(player(declined, f.target).forces[f.previousLocation] ?? 0, 0); assert.equal(player(declined, f.target).tanks, 3);
  assert.equal(receipt(declined).played, true); assert.ok(!promise(declined, f.target).released); physical(declined, f);
});

void test('waiting Sandtrout three-counter answers ignore the hidden next Spice Card while an actual later Worm releases the impossible remainder', () => {
  const f = fixture({ turn: 2, waitingSandtrout: true, bodyCount: 3 }), amount = player(f.game, f.target).spice;
  assert.ok(f.priorShipment); assert.equal(f.bodyCount, 3);
  assert.equal(player(f.priorShipment.before, f.target).spice - player(f.priorShipment.after, f.target).spice, 6);
  assert.equal(amount, 10); assert.equal(f.sourceCounts.priorShipment, f.priorShipment.steps.length);
  const mixed = group('and', play(f.source), move('polar_sink', 3), payment(f.recipient, amount));
  for (const next of ['land', 'worm'] as const) {
    const source = structuredClone(f.game);
    orderIxSpiceCards(source, [...(next === 'worm' ? ['worm' as const] : []), { territory: 'broken_land' }]);
    assert.deepEqual(spice(source), f.originalSpice); assert.equal(source.sandtrout, true);
    assert.equal(player(source, f.target).forces[f.previousLocation], 3); assert.equal(player(source, f.target).tanks, 0);
    const asked = ask(declare(f, source).game, f.asker, f.target, mixed);
    assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['yes', 'no'], next);
    let game = answer(asked, f.target, 'yes');
    game = act(game, f.target, { type: 'bribe', target: f.recipient, amount });
    assert.equal(player(game, f.target).spice, 0);
    const paid = structuredClone(game.turnActionPromises![0].payments), history = structuredClone(game.truthHistory!.at(-1));
    game = settle(act(game, f.target, f.nativeAction));
    assert.equal(receipt(game).played, true); assert.equal(game.discard.filter(card => card.id === f.thumper).length, 1);
    assert.equal(game.sandtrout, false); assert.deepEqual(game.turnActionPromises![0].payments, paid);
    assert.deepEqual(game.truthHistory!.at(-1), history);
    if (next === 'worm') {
      assert.equal(player(game, f.target).forces[f.previousLocation] ?? 0, 0); assert.equal(player(game, f.target).tanks, 3);
      assert.equal(promise(game, f.target).released, true); assert.ok(!promise(game, f.target).fulfilled);
    } else {
      assert.equal(player(game, f.target).forces[f.previousLocation], 3); assert.equal(player(game, f.target).tanks, 0);
      assert.ok(!promise(game, f.target).released); assert.ok(!promise(game, f.target).fulfilled);
      assert.equal(game.spiceWindow?.territory, 'broken_land'); assert.equal(game.spiceWindow?.amount, 16);
      game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), [], true);
      game = settle(act(game, f.target, { type: 'move', from: f.previousLocation, territory: 'polar_sink', sector: 0, amount: 3 }));
      assert.equal(player(game, f.target).forces['polar_sink:0'], 3); assert.equal(promise(game, f.target).fulfilled, true);
      assert.ok(!promise(game, f.target).released); assert.deepEqual(game.turnActionPromises![0].payments, paid);
      assert.deepEqual(game.truthHistory!.at(-1), history);
    }
    physical(game, f);
  }
});

void test('all four minimal profiles play actual first-turn Thumper guides and accept No with native first-reveal Ready', () => {
  const f = fixture(), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked); const actions: TruthTurnThumperStep[] = [];
    const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, difficulty);
    assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
    for (let count = 0; count < 18 && !promise(game, f.target).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const guide = view.turnActionGuide; assert.ok(guide, difficulty);
      const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.event);
      assert.ok(action, difficulty); assert.deepEqual(action, guide.action); game = act(game, f.target, action, actions);
    }
    assert.equal(promise(game, f.target).fulfilled, true, difficulty);
    assert.ok(actions.some(step => step.action.type === 'card' && step.action.card === f.thumper)); physical(game, f);
    const no = bind(f, 'no', play(f.source)).game, view = viewGame(no, f.target);
    view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    const ready = botActions(view)[0]; assert.equal(ready.type, 'ready'); assert.deepEqual(ready, view.turnActionGuide?.action);
    const completed = close(act(no, f.target, ready), f);
    assert.equal(promise(completed, f.target).fulfilled, true); assert.equal(receipt(completed).played, false); physical(completed, f);
  }
});
