import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { windowCardOpportunity } from '../game/window-card-play';
import {
  actTruthTurnKarama as act, advanceTruthTurnKarama as advance, answerTruthTurnKarama as answer,
  askTruthTurnKarama as ask, bindTruthTurnKarama as bind, closeTruthTurnKaramaLot as close,
  createTruthTurnKaramaFixture as fixture, declareTruthTurnKarama as declare, finishTruthTurnKarama as finish,
  nextTruthTurnKaramaNative as nativeStep, reachTruthTurnKaramaInvoice as reachInvoice, settleTruthTurnKarama as settle,
  truthTurnKaramaBid as bid, truthTurnKaramaClean as clean, truthTurnKaramaFact as fact,
  truthTurnKaramaGroup as group, truthTurnKaramaInventory as inventory, truthTurnKaramaPayment as payment,
  truthTurnKaramaPlay as play, truthTurnKaramaPlayer as player, truthTurnKaramaPromise as promise,
  truthTurnKaramaTraitors as traitors, winTruthTurnKaramaBid as invoice,
  type TruthTurnKaramaFixture, type TruthTurnKaramaStep,
} from './fixture-truth-turn-karama';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTurnKaramaFixture, copies: 1 | 2 = 1) {
  for (const truth of f.truths.slice(0, copies)) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
}
function receipt(game: Game, index = 0) {
  const stage = game.turnActionPromises![index].windowCards?.karamaAuction; assert.ok(stage); return stage;
}

void test('native Karama sources preserve actual opening two Truths, original printed card and recorded bidder controls', () => {
  for (const advanced of [false, true]) for (const window of ['active', 'waiting'] as const) {
    const f = fixture({ advanced, window }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.equal(f.setup.deck.length, 33); assert.equal(f.originalCards.length, 33); assert.equal(f.originalTraitors.length, 15);
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
    assert.deepEqual(player(f.game, f.target).hand.map(card => card.id), [f.karama]);
    assert.equal(player(f.game, f.target).spice, 10); assert.equal(f.game.advanced, advanced);
    assert.equal(f.source, 'ordinary-auction:1:1'); assert.deepEqual(windowCardOpportunity(f.game, 'karamaAuction'), f.opportunity);
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceCounts.inherited, f.base.sourceActions.length);
    assert.equal(f.sourceCounts.nativeContinuation, 0); assert.equal(f.sourceCounts.selected, f.base.sourceActionCount);
    assert.equal(f.sourceActions.filter(step => step.action.type === 'passBid').length, window === 'active' ? 2 : 0);
    // The held Karama creates three genuine Atreides-inspection response passes.
    assert.equal(f.sourceActionCount, (advanced ? 26 : 23) + (window === 'active' ? 2 : 0));
    assert.equal(f.game.auction?.active, window === 'active' ? f.target : f.asker);
    assert.equal(f.game.turnActionPromises?.length ?? 0, 0);
    assert.deepEqual(inventory(f.game), f.originalCards); assert.deepEqual(traitors(f.game), f.originalTraitors);
  }
  const f = fixture({ liveOpponent: true }); assert.equal(f.sourceCounts.inherited, 23);
  assert.equal(f.sourceCounts.nativeContinuation, 2); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.equal(f.sourceActionCount, 25);
  assert.equal(f.game.auction?.bidder, f.asker); assert.equal(f.game.auction?.bid, 1);
  assert.equal(f.game.auction?.active, f.target); assert.equal(f.game.auction?.passed.includes(f.asker), false);
});

void test('a printed Karama purchase Yes grants the exact original lot for free and records one future physical cost', () => {
  for (const window of ['active', 'waiting'] as const) {
    const f = fixture({ window }); let game = bind(f, 'yes', play(f.source)).game;
    assert.deepEqual(receipt(game), { source: f.source, played: false, closed: false });
    const purse = player(game, f.target).spice; game = settle(act(game, f.target, f.purchase));
    assert.equal(player(game, f.target).spice, purse); assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard));
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(receipt(game).played, true); assert.equal(promise(game, f.target).fulfilled, true);
    assert.notEqual(windowCardOpportunity(game, 'karamaAuction')?.source, f.source); physical(game, f);
  }
});

void test('a real winning invoice can spend the original printed Karama without spice even for a native overbid', () => {
  const f = fixture(); let game = bind(f, 'yes', play(f.source)).game;
  game = invoice(game, f, 11); assert.equal(game.auction?.bid, 11); assert.equal(game.decision?.kind, 'auctionPayment');
  assert.equal(player(game, f.target).spice, 10); assert.equal(receipt(game).played, false);
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'decision'); assert.equal(guide.action.karama, true); assert.equal(guide.action.card, f.karama);
  game = settle(act(game, f.target, guide.action));
  assert.equal(player(game, f.target).spice, 10); assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard));
  assert.equal(receipt(game).played, true); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1); physical(game, f);
});

void test('No to this printed auction cost blocks immediate and invoice Karama while preserving the native spice payment', () => {
  const f = fixture(); let game = bind(f, 'no', play(f.source)).game;
  rejected(game, f.target, f.purchase); game = invoice(game, f);
  rejected(game, f.target, f.karamaPayment); game = settle(act(game, f.target, f.spicePayment));
  assert.equal(player(game, f.target).spice, 7); assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard));
  assert.ok(player(game, f.target).hand.some(card => card.id === f.karama));
  assert.deepEqual(receipt(game), { source: f.source, played: false, closed: true });
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('whole printed-auction OR payment Yes preserves either actual free purchase or ordinary paid spice route', () => {
  const f = fixture(), mixed = group('or', play(f.source), payment(f.recipient));
  const bound = bind(f, 'yes', mixed).game;
  const bought = settle(act(bound, f.target, f.purchase));
  assert.equal(promise(bought, f.target).fulfilled, true); assert.equal(player(bought, f.recipient).bribes, 0);
  let paid = act(bound, f.target, f.payment); assert.equal(promise(paid, f.target).fulfilled, true);
  paid = invoice(paid, f); paid = settle(act(paid, f.target, f.spicePayment));
  assert.equal(player(paid, f.target).spice, 5); assert.ok(player(paid, f.target).hand.some(card => card.id === f.karama));
  assert.equal(receipt(paid).played, false); physical(bought, f); physical(paid, f);
});

void test('whole printed-auction AND payment No caps only completion and survives a free purchase until actual turn end', () => {
  const f = fixture();
  let paid = bind(f, 'no').game; paid = act(paid, f.target, f.payment);
  rejected(paid, f.target, f.purchase); paid = invoice(paid, f); rejected(paid, f.target, f.karamaPayment);
  paid = settle(act(paid, f.target, f.spicePayment));
  assert.deepEqual(receipt(paid), { source: f.source, played: false, closed: true });
  assert.ok(!promise(paid, f.target).released); assert.ok(!promise(paid, f.target).fulfilled);
  assert.equal(paid.turnActionPromises![0].paymentClosed, false);
  paid = finish(paid); assert.equal(promise(paid, f.target).fulfilled, true); physical(paid, f);
  let bought = settle(act(bind(f, 'no').game, f.target, f.purchase));
  assert.equal(receipt(bought).played, true); rejected(bought, f.target, f.payment);
  bought = act(bought, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  rejected(bought, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  assert.ok(!promise(bought, f.target).fulfilled); bought = finish(bought);
  assert.equal(promise(bought, f.target).fulfilled, true); physical(bought, f);
});

void test('whole printed-auction OR payment No keeps its cumulative payment cap after the original lot closes', () => {
  const f = fixture(), mixed = group('or', play(f.source), payment(f.recipient));
  let game = bind(f, 'no', mixed).game; rejected(game, f.target, f.purchase); rejected(game, f.target, f.payment);
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 }); game = close(game, f);
  assert.equal(receipt(game).closed, true); assert.equal(receipt(game).played, false);
  rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  game = finish(game); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('one funded current purse can pay all ten and still fulfill printed Karama with a free original purchase', () => {
  const f = fixture(), mixed = group('and', fact(f.spiceFact), play(f.source), payment(f.recipient, 10));
  let game = bind(f, 'yes', mixed).game;
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 10 });
  assert.equal(player(game, f.target).spice, 0); assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.karama); assert.equal(guide.action.mode, 'purchase');
  game = settle(act(game, f.target, guide.action));
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.recipient).bribes, 10);
  assert.equal(promise(game, f.target).fulfilled, true); assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard));
  physical(game, f);
});

void test('a required future bid precedes printed purchase and still permits either immediate or winning-invoice native cost', () => {
  const f = fixture({ liveOpponent: true }), mixed = group('and', bid(f.lot), play(f.source), payment(f.recipient));
  for (const route of ['purchase', 'invoice'] as const) {
    const actions: TruthTurnKaramaStep[] = [];
    let game = bind(f, 'yes', mixed, f.game, 0, actions).game;
    rejected(game, f.target, f.purchase);
    game = act(game, f.target, f.payment, actions);
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'bid'); assert.equal(guide.action.amount, 3);
    game = act(game, f.target, guide.action, actions);
    assert.equal(game.turnActionPromises![0].preparation?.bid?.maximum, 3);
    assert.equal(game.auction?.active, f.asker); assert.equal(receipt(game).played, false);
    if (route === 'invoice') {
      game = act(game, f.asker, { type: 'passBid' }, actions); assert.equal(game.auction?.active, f.observer);
      game = reachInvoice(game, f, actions); assert.equal(game.auction?.bid, 3);
      assert.equal(game.decision?.kind, 'auctionPayment'); assert.equal(game.decision?.player, f.target);
      const paying = viewGame(game, f.target).turnActionGuide; assert.ok(paying);
      assert.equal(paying.action.type, 'decision'); assert.equal(paying.action.karama, true);
      assert.equal(paying.action.card, f.karama); game = act(game, f.target, paying.action, actions);
    } else game = act(game, f.target, f.purchase, actions);
    game = settle(game, actions); assert.equal(player(game, f.target).spice, 8);
    assert.equal(promise(game, f.target).fulfilled, true); assert.ok(player(game, f.target).hand.some(card => card.id === f.lotCard));
    const bidAt = actions.findIndex(step => step.actor === f.target && step.action.type === 'bid');
    const costAt = actions.findIndex(step => step.actor === f.target && (step.action.type === 'card' && step.action.card === f.karama ||
      step.action.type === 'decision' && step.action.karama === true));
    assert.ok(bidAt >= 0 && costAt > bidAt); physical(game, f);
  }
});

void test('two actual Truths reject bid ten plus pay ten when the earlier No forbids the only free Karama invoice', () => {
  const f = fixture(); let game = bind(f, 'no', play(f.source)).game;
  const earlier = structuredClone(game.turnActionPromises![0]), history = structuredClone(game.truthHistory![0]);
  const second = group('and', bid(f.lot, 10), payment(f.recipient, 10));
  const declared = declare(f, game, 1), asked = ask(declared.game, f.asker, f.target, second);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(asked, f.target, 'no'); assert.deepEqual(game.turnActionPromises![0], earlier);
  assert.deepEqual(game.truthHistory![0], history); assert.equal(player(game, f.target).spice, 10);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.karama)); physical(game, f, 2);
});

void test('an original first-lot No permits the actual printed Karama in a later lot without crediting the earlier receipt', () => {
  const f = fixture({ window: 'waiting' }); const actions: TruthTurnKaramaStep[] = [];
  let game = bind(f, 'no', play(f.source), f.game, 0, actions).game;
  const bidderPurse = player(game, f.asker).spice, emperorPurse = player(game, f.target).spice;
  game = act(game, f.asker, { type: 'bid', amount: 1, allyPayment: 0 }, actions);
  game = act(game, f.observer, { type: 'passBid' }, actions); game = act(game, f.target, { type: 'passBid' }, actions);
  // H holds no Karama: its native one-spice purchase is automatic. The named
  // boundary helper really completes Emperor income, H bonus and next-lot peek.
  game = close(game, f, actions); assert.equal(game.auction?.index, 1);
  assert.equal(player(game, f.asker).spice, bidderPurse - 1);
  assert.equal(player(game, f.target).spice, emperorPurse + 1);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.lotCard));
  assert.equal(promise(game, f.target).fulfilled, true); const evidence = structuredClone(receipt(game));
  assert.equal(evidence.played, false); assert.equal(evidence.closed, true);
  const next = windowCardOpportunity(game, 'karamaAuction'); assert.ok(next); assert.notEqual(next.source, f.source);
  const nextCard = game.auction!.cards[game.auction!.index].id, purse = player(game, f.target).spice;
  game = settle(act(game, f.target, f.purchase, actions), actions);
  assert.ok(player(game, f.target).hand.some(card => card.id === nextCard)); assert.equal(player(game, f.target).spice, purse);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, 1); assert.deepEqual(receipt(game), evidence);
  assert.ok(actions.some(step => step.actor === f.asker && step.action.type === 'bid'));
  physical(game, f);
});

void test('actual later Karama shipment is a different role and cannot fulfill an expired auction alternative', () => {
  const f = fixture(), mixed = group('or', play(f.source), payment(f.recipient));
  let game = close(bind(f, 'yes', mixed).game, f);
  assert.deepEqual(receipt(game), { source: f.source, played: false, closed: true });
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), [], true);
  game = act(game, f.target, { type: 'card', card: f.karama, mode: 'shipment', target: f.target });
  assert.ok(game.karamaShipping); assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
  assert.equal(receipt(game).played, false); assert.ok(!promise(game, f.target).fulfilled);
  const purse = player(game, f.target).spice;
  game = settle(act(game, f.target, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 }));
  assert.equal(player(game, f.target).spice, purse - 1, 'Native Karama halves the original two-spice desert tariff');
  assert.equal(player(game, f.target).forces['polar_sink:0'], 1);
  game = act(game, f.target, f.payment); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(receipt(game).played, false); physical(game, f);
});

void test('Karama guide packets retain original lot and physical card identity and reject stale sources or owners', () => {
  const f = fixture(), declared = declare(f);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { kind: 'turnActions', target: f.target,
    turn: f.game.turn, mixed: play(`${f.source}:stale`) } });
  rejected(declared.game, f.target, { type: 'truthAsk', question: f.question });
  let game = bind(f).game; game = act(game, f.target, f.payment);
  const row = promise(game, f.target), guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.karama); assert.equal(guide.action.mode, 'purchase');
  assert.equal(guide.event, row.event); assert.equal(guide.action.turnActionPromiseEvent, row.event);
  assert.equal(guide.action.turnActionPromisePhase, 3);
  assert.ok(Object.keys(row).every(key => ['event', 'player', 'asker', 'turn', 'mixed', 'answer', 'fulfilled', 'released'].includes(key)));
  assert.deepEqual(viewGame(game, f.observer).turnActionPromises, []); assert.equal(viewGame(game, f.observer).turnActionGuide, null);
  rejected(game, f.observer, guide.action);
  rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-event' });
  rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 5 });
  const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, packet));
  rejected(game, f.target, packet); assert.equal(promise(game, f.target).fulfilled, true);
  const second = declare(f, game, 1);
  rejected(second.game, f.asker, { type: 'truthAsk', question: { ...f.question, mixed: play(f.source) } }); physical(game, f);
});

void test('all four minimal profiles execute funded native printed Karama guides including a required first bid', () => {
  for (const joint of [false, true]) {
    const f = fixture({ liveOpponent: joint }), mixed = joint ? group('and', bid(f.lot), play(f.source), payment(f.recipient)) : f.mixed;
    const asked = ask(declare(f).game, f.asker, f.target, mixed);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthTurnKaramaStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, difficulty);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 26 && !promise(game, f.target).fulfilled; count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        const guide = view.turnActionGuide;
        if (guide) {
          const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.event);
          assert.ok(action, `${joint}/${difficulty}`); assert.deepEqual(action, guide.action);
          game = act(game, f.target, action, actions);
        } else {
          const next = nativeStep(game); assert.ok(next, `${joint}/${difficulty}`);
          game = act(game, next.actor, next.action, actions);
        }
      }
      assert.equal(promise(game, f.target).fulfilled, true, `${joint}/${difficulty}`);
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'bribe'));
      assert.ok(actions.some(step => step.actor === f.target && (step.action.type === 'card' && step.action.card === f.karama ||
        step.action.type === 'decision' && step.action.karama === true)));
      if (joint) assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'bid'));
      game = settle(game); physical(game, f);
    }
  }
});
