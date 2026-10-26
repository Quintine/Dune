import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actTruthTurnPreparation as act, advanceTruthTurnPreparation as advance, answerTruthTurnPreparation as answer,
  askTruthTurnPreparation as ask, bindTruthTurnPreparation as bind, createTruthTurnPreparationFixture as fixture,
  declareTruthTurnPreparation as declare, finishTruthTurnPreparation as finish,
  nextTruthTurnPreparationNative as nativeStep, settleTruthTurnPreparation as settle,
  truthTurnPreparationBid as bid, truthTurnPreparationClean as clean, truthTurnPreparationForce as force,
  truthTurnPreparationGroup as group, truthTurnPreparationInventory as inventory, truthTurnPreparationLeader as leader,
  truthTurnPreparationPayment as payment, truthTurnPreparationPlayer as player, truthTurnPreparationPromise as promise,
  type TruthTurnPreparationFixture, type TruthTurnPreparationStep,
} from './fixture-truth-turn-preparation';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTurnPreparationFixture) {
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.truths[1]));
  assert.deepEqual(inventory(game), f.originalCards);
}
function closeLot(game: Game, lot: number, actions: TruthTurnPreparationStep[] = []) {
  return advance(game, state => state.phase !== 3 || !state.auction || state.auction.index + 1 !== lot, actions, true);
}

void test('native preparation adapters retain original two-Truth deals and programmatic source prefixes', () => {
  for (const source of ['bid', 'forces', 'leader'] as const) {
    const f = fixture({ source });
    assert.equal(f.setup.status, 'setup'); assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.equal(f.setup.deck.filter(card => card.effect === 'truthtrance').length, 2);
    assert.deepEqual(player(f.afterSetup, f.asker).hand.map(card => card.id), f.truths);
    assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceActionCount, f.actions.length);
    assert.equal(f.sourceCounts.selected, f.sourceActionCount);
    assert.equal(f.sourceCounts.inherited + f.sourceCounts.nativeContinuation, f.sourceActionCount);
    assert.equal(f.game.turnActionPromises?.length ?? 0, 0); assert.equal(f.game.truthHistory?.length ?? 0, 0);
    assert.deepEqual(inventory(f.game), f.originalCards);
    if (source === 'bid') {
      assert.equal(f.sourceActionCount, 22); assert.equal(f.sourceCounts.nativeContinuation, 2);
      assert.equal(f.game.phase, 3); assert.equal(player(f.game, f.target).spice, 10);
      assert.equal(f.game.auction?.bidder, f.asker); assert.equal(f.game.auction?.active, f.target);
    } else {
      assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 4); assert.equal(player(f.game, f.target).spice, 4);
      assert.equal(player(f.game, f.target).tanks, source === 'forces' ? 3 : 1);
      if (source === 'leader') {
        assert.equal(f.sourceActionCount, 102); assert.equal(f.originalCards.length, 47);
        assert.equal(player(f.game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, true);
      }
    }
  }
});

void test('native AND declares a real bid before its invoice and shares current cash with payment and later shipment', () => {
  const f = fixture(), actions: TruthTurnPreparationStep[] = [];
  let game = bind(f, 'yes', f.mixed, f.game, 0, actions).game;
  rejected(game, f.target, { type: 'passBid' });
  game = act(game, f.target, f.payment, actions); assert.equal(player(game, f.target).spice, 8);
  game = act(game, f.target, f.bid, actions);
  assert.equal(player(game, f.target).spice, 8, 'Actual declaration records a bid without paying the later invoice');
  assert.equal(game.auction?.active, f.asker); assert.equal(game.auction?.bidder, f.target);
  assert.equal(game.turnActionPromises![0].preparation?.bid?.maximum, 3);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target).released);
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), actions);
  assert.equal(player(game, f.target).spice, 5); assert.equal(player(game, f.target).reserves, 20);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.bidSource!.lotCard));
  rejected(game, f.target, { type: 'endMovement' });
  game = settle(act(game, f.target, f.shipment, actions), actions);
  assert.equal(player(game, f.target).spice, 3); assert.equal(player(game, f.target).reserves, 19);
  assert.equal(player(game, f.target).forces['polar_sink:0'], 1); assert.equal(player(game, f.recipient).bribes, 2);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  assert.ok(actions.some(step => step.action.type === 'bid'));
  // This original winner holds no Karama choice: the cash-only invoice
  // settles automatically. The real card and three-spice debit above prove it.
});

void test('native bid OR payment Yes preserves both manual routes and bid declarations are independent of an eventual invoice', () => {
  const f = fixture(), mixed = group('or', bid(f.lot!), payment(f.recipient)), bound = bind(f, 'yes', mixed).game;
  for (const action of [f.bid, f.payment]) {
    const game = act(bound, f.target, action);
    assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(promise(game, f.target).mixed, mixed);
    assert.equal(game.turnActionPromises![0].preparation?.bid?.maximum, action.type === 'bid' ? 3 : 0);
    assert.equal(player(game, f.target).spice, action.type === 'bid' ? 10 : 8);
    assert.equal(player(game, f.recipient).bribes, action.type === 'bribe' ? 2 : 0); physical(game, f);
  }
});

void test('native pass and actual lot close fold a missing bid false while the ordinary payment OR survives', () => {
  const f = fixture(), mixed = group('or', bid(f.lot!), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game;
  game = act(game, f.target, { type: 'passBid' }); game = closeLot(game, f.lot!);
  assert.equal(game.turnActionPromises![0].preparation?.bid?.closed, true);
  assert.equal(game.turnActionPromises![0].preparation?.bid?.maximum, 0);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target).released);
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'bribe'); assert.equal(guide.action.turnActionPromisePhase, game.phase);
  game = act(game, f.target, f.payment); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

for (const first of ['bid', 'payment'] as const)
  void test(`native whole AND No permits its ${first} event and rejects only completion of the whole bid/payment tree`, () => {
    const f = fixture(), mixed = group('and', bid(f.lot!), payment(f.recipient));
    let game = bind(f, 'no', mixed).game;
    game = act(game, f.target, first === 'bid' ? f.bid : f.payment);
    assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target).released);
    rejected(game, f.target, first === 'bid' ? f.payment : f.bid);
    if (first === 'payment') game = act(game, f.target, { type: 'passBid' });
    game = closeLot(game, f.lot!); assert.ok(!promise(game, f.target).released);
    if (first === 'bid') {
      game = act(game, f.target, { ...f.payment, amount: 1 });
      rejected(game, f.target, { ...f.payment, amount: 1 });
    }
    game = finish(game); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  });

void test('native repeated ordinary declarations retain the largest bid rather than adding bid amounts', () => {
  const f = fixture(), mixed = group('and', bid(f.lot!, 5), payment(f.recipient));
  let game = bind(f, 'no', mixed).game;
  game = act(game, f.target, f.payment);
  game = act(game, f.target, { ...f.bid, amount: 2 });
  game = act(game, f.asker, { type: 'bid', amount: 3, allyPayment: 0 });
  assert.equal(game.auction?.active, f.bidSource!.opponent);
  game = act(game, f.bidSource!.opponent, { type: 'passBid' });
  game = act(game, f.target, { ...f.bid, amount: 4 });
  assert.equal(game.turnActionPromises![0].preparation?.bid?.maximum, 4);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target).released);
  game = closeLot(game, f.lot!); game = finish(game);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native bid No survives a pass reset and reentry until the same physical lot closes', () => {
  const f = fixture(); let game = bind(f, 'no', bid(f.lot!, 5)).game;
  game = act(game, f.target, { ...f.bid, amount: 2 });
  game = act(game, f.asker, { type: 'passBid' });
  game = act(game, f.observer, { type: 'bid', amount: 3, allyPayment: 0 });
  assert.equal(game.auction?.active, f.target);
  game = act(game, f.target, { type: 'passBid' });
  assert.equal(game.turnActionPromises![0].preparation?.bid?.closed, false);
  assert.ok(!promise(game, f.target).fulfilled);
  game = act(game, f.asker, { type: 'bid', amount: 4, allyPayment: 0 });
  game = act(game, f.observer, { type: 'passBid' });
  assert.equal(game.auction?.active, f.target); assert.ok(!game.auction?.passed.includes(f.target));
  rejected(game, f.target, { ...f.bid, amount: 5 });
  game = closeLot(game, f.lot!);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native one question jointly funds its original bid force return and ordinary payment', () => {
  const f = fixture({ source: 'forces', beforeRevival: true }), actions: TruthTurnPreparationStep[] = [];
  assert.equal(f.game.phase, 3); assert.equal(player(f.game, f.target).spice, 4);
  const mixed = group('and', bid(f.lot!, 1), force(2), payment(f.recipient, 1));
  let game = bind(f, 'yes', mixed, f.game, 0, actions).game;
  game = advance(game, state => promise(state, f.target).fulfilled, actions);
  assert.equal(player(game, f.target).spice, 0);
  assert.equal(player(game, f.recipient).bribes, 1);
  assert.equal(game.turnActionPromises![0].preparation?.bid?.maximum, 1);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.total, 2);
  assert.equal(player(game, f.target).reserves, 19); physical(game, f);
});

void test('native Revival Karama invoice guide waits for the actual owned payment decision', () => {
  const f = fixture({ source: 'forces', beforeRevival: true, targetKarama: true }), actions: TruthTurnPreparationStep[] = [];
  let game = advance(f.game, state => state.auction?.active === f.asker, actions, true);
  game = act(game, f.asker, { type: 'bid', amount: 1, allyPayment: 0 }, actions);
  assert.equal(game.auction?.active, f.observer);
  game = act(game, f.observer, { type: 'passBid' }, actions);
  assert.equal(game.auction?.active, f.target);
  const karama = player(game, f.target).hand.find(card => card.effect === 'karama')!; assert.ok(karama);
  game = bind(f, 'yes', force(3), game, 0, actions).game;
  game = act(game, f.target, { type: 'bid', amount: 2, allyPayment: 0 }, actions);
  assert.equal(game.auction?.active, f.asker); assert.equal(game.decision, null);
  assert.equal(viewGame(game, f.target).turnActionGuide, null);
  game = advance(game, state => state.decision?.kind === 'auctionPayment' && state.decision.player === f.target, actions, true);
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'decision'); assert.equal(guide.action.karama, true); assert.equal(guide.action.card, karama.id);
  game = act(game, f.target, guide.action, actions);
  assert.equal(player(game, f.target).spice, 4); assert.ok(game.discard.some(card => card.id === karama.id));
  game = advance(game, state => promise(state, f.target).fulfilled, actions);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).reserves, 20);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.total, 3); physical(game, f);
});

void test('native owned Karama overbid preserves original cash for its required future ordinary Revival', () => {
  const f = fixture({ source: 'forces', beforeRevival: true, targetKarama: true }), actions: TruthTurnPreparationStep[] = [];
  let game = advance(f.game, state => state.auction?.active === f.asker, actions, true);
  game = act(game, f.asker, { type: 'bid', amount: 1, allyPayment: 0 }, actions);
  game = act(game, f.observer, { type: 'passBid' }, actions);
  assert.equal(player(game, f.target).spice, 4);
  const karama = player(game, f.target).hand.find(card => card.effect === 'karama')!; assert.ok(karama);
  game = bind(f, 'yes', group('and', bid(f.lot!, 10), force(3)), game, 0, actions).game;
  game = act(game, f.target, { type: 'bid', amount: 10, allyPayment: 0 }, actions);
  assert.equal(game.turnActionPromises![0].preparation?.bid?.maximum, 10);
  assert.equal(player(game, f.target).spice, 4); assert.ok(!promise(game, f.target).fulfilled);
  game = advance(game, state => promise(state, f.target).fulfilled, actions);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).reserves, 20);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.total, 3);
  assert.equal(game.discard.filter(card => card.id === karama.id).length, 1);
  assert.ok(actions.some(step => step.action.type === 'decision' && step.action.karama === true));
  physical(game, f);
});

void test('native cumulative typed force returns and payment share one original four-spice purse before own Revival Ready', () => {
  const f = fixture({ source: 'forces' }); let game = bind(f).game;
  rejected(game, f.target, { type: 'ready' });
  game = settle(act(game, f.target, f.forceAction));
  assert.equal(player(game, f.target).spice, 4); assert.equal(player(game, f.target).reserves, 18);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.total, 1);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.normal, 1);
  game = act(game, f.target, f.payment); assert.equal(player(game, f.target).spice, 2);
  rejected(game, f.target, { type: 'ready' }); game = settle(act(game, f.target, f.forceAction));
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).reserves, 19);
  assert.equal(player(game, f.target).tanks, 1);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.total, 2);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.normal, 2);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native force OR payment Yes may finish its actual Revival opportunity and pay in late Mentat', () => {
  const f = fixture({ source: 'forces' }), mixed = group('or', force(), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game;
  game = act(game, f.target, { type: 'ready' }); assert.ok(game.ready.includes(f.target));
  // Basic No retains its cap until phase close if a later Truth reopens Ready.
  // The actual Ready flag currently prevents another ordinary return.
  assert.equal(game.turnActionPromises![0].preparation?.revival?.closed, false);
  assert.equal(player(game, f.target).revived, 0); assert.ok(!promise(game, f.target).fulfilled);
  game = advance(game, state => state.phase === 8 && clean(state), [], true);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.closed, true);
  assert.ok(!promise(game, f.target).released); rejected(game, f.target, { type: 'ready' });
  game = act(game, f.target, f.payment); assert.equal(promise(game, f.target).fulfilled, true);
  game = act(game, f.target, { type: 'ready' }); assert.ok(game.ready.includes(f.target)); physical(game, f);
});

void test('native Advanced ordered Revival finish closes only its own preparation stage before a later payment', () => {
  const f = fixture({ source: 'forces', advanced: true }), mixed = group('or', force(2), payment(f.recipient));
  assert.ok(f.game.advanced); assert.ok(f.game.revivalOrder); assert.equal(f.game.active, f.target);
  let game = bind(f, 'yes', mixed).game;
  game = act(game, f.target, { type: 'ready' });
  assert.equal(game.turnActionPromises![0].preparation?.revival?.closed, true);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!game.revivalOrder?.remaining.includes(f.target));
  game = act(game, f.target, f.payment);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(player(game, f.target).spice, 2);
  physical(game, f);
});

void test('native personal leader and free force returns retain actual income and costs alongside an ordinary payment', () => {
  const f = fixture({ source: 'leader' }); assert.ok(f.leader && f.leaderAction);
  const mixed = group('and', leader(f.leader), force(1), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game;
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, f.payment);
  assert.equal(player(game, f.target).spice, 2); game = settle(act(game, f.target, f.forceAction));
  assert.equal(player(game, f.target).spice, 3); assert.equal(player(game, f.target).tanks, 0);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.total, 1);
  rejected(game, f.target, { type: 'ready' }); game = settle(act(game, f.target, f.leaderAction));
  assert.equal(player(game, f.target).spice, 1);
  assert.equal(player(game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, false);
  assert.deepEqual(game.turnActionPromises![0].preparation?.revival?.leaders, [f.leader]);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native ordinary force returns before answering do not count toward the new preparation interval', () => {
  const f = fixture({ source: 'leader' }); assert.ok(f.leader && f.leaderAction);
  let game = settle(act(f.game, f.target, f.forceAction));
  assert.equal(player(game, f.target).revived, 1); assert.equal(player(game, f.target).tanks, 0);
  assert.equal(player(game, f.target).spice, 5);
  const mixed = group('and', group('or', force(1), leader(f.leader)), payment(f.recipient));
  game = bind(f, 'yes', mixed, game).game;
  assert.equal(game.turnActionPromises![0].preparation?.revival?.total, 0);
  assert.deepEqual(game.turnActionPromises![0].preparation?.revival?.leaders, []);
  game = act(game, f.target, f.payment); assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, { type: 'ready' }); game = settle(act(game, f.target, f.leaderAction));
  assert.equal(game.turnActionPromises![0].preparation?.revival?.total, 0);
  assert.deepEqual(game.turnActionPromises![0].preparation?.revival?.leaders, [f.leader]);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native preparation guides keep exact phase/event packets and raw own history without private preparation progress', () => {
  const f = fixture({ source: 'forces' }), declared = declare(f);
  let game = answer(ask(declared.game, f.asker, f.target, f.mixed), f.target, 'yes');
  const row = promise(game, f.target), allowed = ['event', 'player', 'asker', 'turn', 'mixed', 'answer', 'fulfilled', 'released'];
  assert.ok(Object.keys(row).every(key => allowed.includes(key)));
  assert.deepEqual(row.mixed, f.mixed); assert.deepEqual(viewGame(game, f.target).truthHistory.at(-1)?.question, f.question);
  for (const actor of [f.asker, f.observer]) {
    assert.deepEqual(viewGame(game, actor).turnActionPromises, []); assert.equal(viewGame(game, actor).turnActionGuide, null);
  }
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.event, row.event); assert.equal(guide.action.turnActionPromiseEvent, row.event);
  assert.equal(guide.action.turnActionPromisePhase, 4);
  rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-preparation-event' });
  rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 3 });
  rejected(game, f.target, { ...guide.action, amount: Number(guide.action.amount) + 1 });
  const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, wire));
  rejected(game, f.target, wire);
  game = advance(game, state => promise(state, f.target).fulfilled === true);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('all four minimal profiles actually submit current native bid and Revival preparation guides through fulfillment', () => {
  for (const source of ['bid', 'forces'] as const) {
    const f = fixture({ source }), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthTurnPreparationStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const action = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(action, difficulty);
      assert.equal(action.answer, 'yes'); game = act(game, f.target, action, actions);
      let guided = 0;
      for (let count = 0; count < 100 && !promise(game, f.target).fulfilled; count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        const guide = view.turnActionGuide;
        if (guide) {
          const next = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.event);
          assert.ok(next, `${source}/${difficulty}`); assert.deepEqual(next, guide.action);
          game = settle(act(game, f.target, next, actions), actions); guided++;
        } else {
          const next = nativeStep(game); assert.ok(next, `${source}/${difficulty}`);
          game = act(game, next.actor, next.action, actions);
        }
      }
      assert.equal(promise(game, f.target).fulfilled, true, `${source}/${difficulty}`); assert.ok(guided > 0);
      assert.ok(actions.some(step => step.action.type === (source === 'bid' ? 'bid' : 'revive')));
      assert.ok(actions.some(step => step.action.type === 'bribe'));
      if (source === 'bid') assert.ok(actions.some(step => step.action.type === 'ship'));
      physical(game, f);
    }
  }
});
