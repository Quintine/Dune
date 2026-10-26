import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import {
  actTruthTurnCardPlay as act, advanceTruthTurnCardPlay as advance, answerTruthTurnCardPlay as answer,
  askTruthTurnCardPlay as ask, bindTruthTurnCardPlay as bind, createTruthTurnCardPlayFixture as fixture,
  declareTruthTurnCardPlay as declare, finishTruthTurnCardPlay as finish, nextTruthTurnCardPlayNative as nativeStep,
  settleTruthTurnCardPlay as settle, truthTurnCardPlayClean as clean, truthTurnCardPlayFact as fact,
  truthTurnCardPlayForce as force, truthTurnCardPlayGroup as group, truthTurnCardPlayInventory as inventory,
  truthTurnCardPlayPayment as payment, truthTurnCardPlayPlayer as player, truthTurnCardPlayPromise as promise,
  truthTurnCardPlayShip as ship, truthTurnCardPlayUse as use,
  type TruthTurnCardPlayFixture, type TruthTurnCardPlayStep,
} from './fixture-truth-turn-card-play';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTurnCardPlayFixture) {
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
}
const quotas = (game: Game, target: string) => {
  const owner = player(game, target);
  return [owner.revived, owner.freeForcesRevived ?? 0, owner.leaderRevived];
};

void test('native printed-card adapters retain original deals, actual casualties and counted action prefixes', () => {
  for (const options of [
    { source: 'hajr', early: true }, { source: 'hajr' }, { source: 'hajr', advanced: true },
    { source: 'gholaForces' }, { source: 'gholaRevival' }, { source: 'gholaLeader' }, { source: 'hajrReplay' },
  ] as const) {
    const f = fixture(options); assert.equal(f.setup.status, 'setup');
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.ok(player(f.game, f.asker).hand.some(card => card.id === f.truth));
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceActionCount, f.actions.length);
    assert.equal(f.sourceCounts.selected, f.sourceActionCount); assert.equal(f.sourceCounts.inherited, f.sourceActionCount);
    assert.equal(f.game.turnActionPromises?.length ?? 0, 0); assert.deepEqual(inventory(f.game), f.originalCards);
    if (f.sourceKind === 'hajr') {
      assert.ok(player(f.game, f.target).hand.some(card => card.id === f.card));
      assert.equal(f.sourceActionCount, f.early ? 13 : f.advanced ? 23 : 19);
    } else if (f.sourceKind === 'hajrReplay') {
      assert.equal(f.advanced, true); assert.equal(f.game.advanced, true); assert.ok(!f.game.semutaPreview);
      assert.equal(player(f.game, f.target).hajrPlays, 1); assert.equal(player(f.game, f.target).moved, 1);
      assert.equal(player(f.game, f.target).spice, 2); assert.equal(f.game.discard.filter(card => card.id === f.card).length, 1);
      assert.equal(f.hajrReplay!.sourceCounts.inherited + f.hajrReplay!.sourceCounts.nativeContinuation, f.sourceActionCount);
    } else {
      assert.ok(player(f.game, f.target).hand.some(card => card.id === f.card));
      assert.equal(f.game.turn, 2); assert.ok(player(f.game, f.target).tanks > 0);
      if (f.sourceKind === 'gholaLeader') assert.equal(player(f.game, f.target).leaders.find(disc => disc.id === f.leader)!.dead, true);
    }
  }
});

void test('native Basic Hajr AND payment records the actual printed play without requiring use of its extra movement', () => {
  const f = fixture(), mixed = group('and', fact(f.spiceFact), use('hajr'), payment(f.recipient));
  const initial = structuredClone(f.game); let game = bind(f, 'yes', mixed).game;
  assert.deepEqual(f.game, initial); rejected(game, f.target, f.end);
  game = act(game, f.target, f.payment); assert.equal(player(game, f.target).spice, 8);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  assert.equal(game.turnActionPromises![0].cardPlays?.hajr?.played, false);
  game = settle(act(game, f.target, f.cardAction));
  assert.equal(game.turnActionPromises![0].cardPlays?.hajr?.played, true);
  assert.equal(player(game, f.target).hajrPlays, 1); assert.equal(player(game, f.target).moved, 0);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(promise(game, f.target).mixed, mixed);
  const receipt = structuredClone(game.turnActionPromises![0].cardPlays);
  game = settle(act(game, f.target, f.end));
  assert.equal(player(game, f.target).moved, 0); assert.deepEqual(game.turnActionPromises![0].cardPlays, receipt);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); physical(game, f);
});

void test('native Advanced Hajr guide first earns its real completed-move timing and leaves the extra movement optional', () => {
  const f = fixture({ advanced: true }); let game = bind(f).game;
  game = act(game, f.target, f.payment); rejected(game, f.target, f.cardAction);
  assert.equal(player(game, f.target).moved, 0); assert.equal(game.turnActionPromises![0].cardPlays?.hajr?.played, false);
  const preparation = viewGame(game, f.target).turnActionGuide; assert.ok(preparation);
  assert.equal(preparation.action.type, 'move');
  game = settle(act(game, f.target, f.firstMove)); assert.equal(player(game, f.target).moved, 1);
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.card);
  game = settle(act(game, f.target, guide.action)); assert.equal(promise(game, f.target).fulfilled, true);
  game = settle(act(game, f.target, f.end)); assert.equal(player(game, f.target).moved, 1);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); physical(game, f);
});

void test('native whole Hajr AND payment No preserves either component and rejects only actual whole completion atomically', () => {
  const f = fixture();
  for (const first of ['payment', 'card'] as const) {
    let game = bind(f, 'no').game;
    if (first === 'payment') {
      game = act(game, f.target, f.payment); rejected(game, f.target, f.cardAction);
      assert.equal(game.turnActionPromises![0].cardPlays?.hajr?.played, false);
    } else {
      game = settle(act(game, f.target, f.cardAction)); rejected(game, f.target, f.payment);
      game = act(game, f.target, { ...f.payment, amount: 1 });
      rejected(game, f.target, { ...f.payment, amount: 1 });
    }
    game = settle(act(game, f.target, f.end)); assert.ok(!promise(game, f.target).released);
    game = finish(game); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('native Hajr OR payment retains direct play and own-Movement-close then late-payment routes', () => {
  const f = fixture(), mixed = group('or', use('hajr'), payment(f.recipient)), bound = bind(f, 'yes', mixed).game;
  const played = settle(act(bound, f.target, f.cardAction));
  assert.equal(promise(played, f.target).fulfilled, true); assert.equal(player(played, f.recipient).bribes, 0);
  let paid = settle(act(bound, f.target, f.end));
  assert.equal(paid.turnActionPromises![0].cardPlays?.hajr?.closed, true);
  assert.equal(paid.turnActionPromises![0].cardPlays?.hajr?.played, false); assert.ok(!promise(paid, f.target).fulfilled);
  paid = advance(paid, state => state.phase === 8 && clean(state), [], true);
  rejected(paid, f.target, { type: 'ready' }); paid = act(paid, f.target, f.payment);
  assert.equal(promise(paid, f.target).fulfilled, true);
  assert.ok(player(paid, f.target).hand.some(card => card.id === f.card));
  for (const state of [played, paid]) physical(state, f);
});

void test('native held Ghola force play AND payment returns the actual Storm casualty before a separately paid shipment', () => {
  const f = fixture({ source: 'gholaForces' }), mixed = group('and', use('ghola'), payment(f.recipient), ship());
  let game = bind(f, 'yes', mixed).game; const ordinary = quotas(game, f.target);
  assert.equal(player(game, f.target).tanks, 1); assert.equal(player(game, f.target).reserves, 9);
  game = act(game, f.target, f.payment); game = settle(act(game, f.target, f.cardAction));
  assert.equal(player(game, f.target).spice, 8); assert.equal(player(game, f.target).tanks, 0);
  assert.equal(player(game, f.target).reserves, 10); assert.deepEqual(quotas(game, f.target), ordinary);
  assert.equal(game.turnActionPromises![0].cardPlays?.ghola?.played, true); assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, f.end); game = settle(act(game, f.target, f.shipment));
  assert.equal(player(game, f.target).spice, 6); assert.equal(player(game, f.target).reserves, 9);
  assert.equal(player(game, f.target).forces['polar_sink:0'], 1); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); physical(game, f);
});

void test('native Ghola OR payment preserves either actual late Mentat play or payment after own Movement has ended', () => {
  const f = fixture({ source: 'gholaForces' }), mixed = group('or', use('ghola'), payment(f.recipient));
  let late = bind(f, 'yes', mixed).game; late = settle(act(late, f.target, f.end));
  assert.equal(late.turnActionPromises![0].cardPlays?.ghola?.closed, false);
  late = advance(late, state => state.phase === 8 && clean(state), [], true);
  rejected(late, f.target, { type: 'ready' });
  for (const action of [f.cardAction, f.payment]) {
    const game = settle(act(late, f.target, action)); assert.equal(promise(game, f.target).fulfilled, true);
    assert.equal(game.turnActionPromises![0].cardPlays?.ghola?.played, action.type === 'card');
    assert.equal(player(game, f.target).tanks, action.type === 'card' ? 0 : 1); physical(game, f);
  }
});

void test('controlled known Double payment expiry retains the actual late Ghola alternative', () => {
  const f = fixture({ source: 'gholaForces' });
  // Preserve the actual played source, held card and casualty. Only the public
  // token is controlled; this does not assert an original CHOAM source journey.
  const controlled = structuredClone(f.game);
  controlled.inflation = { side: 'cancel', placedTurn: 0, updatedTurn: 0, flipped: false };
  for (const mode of ['or', 'and'] as const) {
    const declared = declare(f, controlled).game;
    const asked = ask(declared, f.asker, f.target, group(mode, use('ghola'), payment(f.recipient)));
    let game = answer(asked, f.target, 'yes');
    game = settle(act(game, f.target, f.end));
    game = advance(game, state => state.phase === 7 && clean(state), [], true);
    assert.equal(game.inflation?.side, 'cancel');
    if (mode === 'and') {
      rejected(game, f.target, { type: 'ready' });
      game = act(game, f.target, f.payment);
    }
    game = act(game, f.target, { type: 'ready' });
    assert.equal(game.turnActionPromises![0].cardPlays?.ghola?.closed, false);
    assert.ok(!promise(game, f.target).fulfilled);
    game = advance(game, state => state.phase === 8 && clean(state), [], true);
    assert.equal(game.inflation?.side, 'double');
    rejected(game, f.target, f.payment);
    rejected(game, f.target, { type: 'ready' });
    game = settle(act(game, f.target, f.cardAction));
    assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('native whole Ghola OR payment No forbids printed use and cumulative payment through actual turn end', () => {
  const f = fixture({ source: 'gholaForces' }), mixed = group('or', use('ghola'), payment(f.recipient));
  let game = bind(f, 'no', mixed).game; rejected(game, f.target, f.cardAction); rejected(game, f.target, f.payment);
  game = act(game, f.target, { ...f.payment, amount: 1 }); game = settle(act(game, f.target, f.end));
  game = advance(game, state => state.phase === 8 && clean(state), [], true);
  rejected(game, f.target, f.cardAction); rejected(game, f.target, { ...f.payment, amount: 1 });
  assert.ok(!promise(game, f.target).fulfilled); game = finish(game);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(game.turnActionPromises![0].cardPlays?.ghola?.played, false);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.card)); physical(game, f);
});

void test('native held Ghola and ordinary returns share the original Tanks and purse without double reservation or event substitution', () => {
  const f = fixture({ source: 'gholaRevival' }); assert.equal(player(f.game, f.target).tanks, 3);
  const overbooked = group('and', use('ghola'), force(3));
  const asked = ask(declare(f).game, f.asker, f.target, overbooked);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const mixed = group('and', use('ghola'), force(2), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game; game = settle(act(game, f.target, f.ordinaryForces));
  assert.equal(player(game, f.target).spice, 2); assert.equal(player(game, f.target).tanks, 1);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.total, 2);
  assert.equal(game.turnActionPromises![0].cardPlays?.ghola?.played, false);
  game = act(game, f.target, f.payment); assert.equal(player(game, f.target).spice, 0);
  assert.ok(!promise(game, f.target).fulfilled); const ordinary = quotas(game, f.target);
  game = settle(act(game, f.target, f.cardAction));
  assert.equal(player(game, f.target).reserves, 20); assert.equal(player(game, f.target).tanks, 0);
  assert.deepEqual(quotas(game, f.target), ordinary);
  assert.equal(game.turnActionPromises![0].preparation?.revival?.total, 2);
  assert.equal(game.turnActionPromises![0].cardPlays?.ghola?.played, true);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  // A separate original branch actually uses all three ordinary returns before
  // asking: an ordinary return never becomes an earlier printed Ghola use.
  const returned = settle(act(f.game, f.target, { type: 'revive', amount: 3, elite: 0 }));
  assert.equal(player(returned, f.target).tanks, 0); assert.equal(player(returned, f.target).spice, 0);
  const unavailable = ask(declare(f, returned).game, f.asker, f.target, use('ghola'));
  assert.deepEqual(viewGame(unavailable, f.target).truthTurnActionAnswers, ['no']);
  assert.ok(player(unavailable, f.target).hand.some(card => card.id === f.card));
});

void test('native personally dead Hidar returns by the actual held Ghola alongside payment without spending ordinary leader revival', () => {
  const f = fixture({ source: 'gholaLeader' }); assert.ok(f.leader);
  let game = bind(f).game; const ordinary = quotas(game, f.target), dead = structuredClone(player(game, f.target).leaders.find(disc => disc.id === f.leader)!);
  assert.equal(dead.dead, true); assert.equal(dead.deaths, 1); game = act(game, f.target, f.payment);
  game = settle(act(game, f.target, f.cardAction));
  const returned = player(game, f.target).leaders.find(disc => disc.id === f.leader)!;
  assert.equal(returned.dead, false); assert.equal(returned.deaths, 1); assert.equal(returned.usedAt, undefined);
  // The original four spice pay two, then native Ghola's allowed Tleilaxu
  // income response pays the printed one spice; it is not ordinary Revival.
  assert.equal(player(game, f.target).spice, 3); assert.deepEqual(quotas(game, f.target), ordinary);
  assert.equal(game.turnActionPromises![0].cardPlays?.ghola?.played, true);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  physical(game, f);
});

void test('native Advanced printed Ghola returns an original Storm-killed Sardaukar while retaining typed ordinary quotas', () => {
  const f = fixture({ source: 'gholaRevival', advanced: true });
  let game = bind(f).game; const ordinary = quotas(game, f.target), reserveElite = player(game, f.target).elites!.reserves;
  assert.equal(player(game, f.target).elites!.tanks, 1);
  game = act(game, f.target, f.payment); game = settle(act(game, f.target, f.cardAction));
  assert.equal(player(game, f.target).elites!.tanks, 0); assert.equal(player(game, f.target).elites!.reserves, reserveElite + 1);
  assert.equal(player(game, f.target).tanks, 2); assert.deepEqual(quotas(game, f.target), ordinary);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native earlier Hajr use does not satisfy a new interval but an owned paid Box can recover and replay the same physical card', () => {
  const f = fixture({ source: 'hajrReplay' }); assert.ok(f.box);
  let game = bind(f).game; assert.equal(player(game, f.target).hajrPlays, 1);
  assert.equal(player(game, f.target).moved, 1); assert.equal(game.advanced, true); assert.ok(!game.semutaPreview);
  assert.equal(game.turnActionPromises![0].cardPlays?.hajr?.played, false); assert.ok(!promise(game, f.target).fulfilled);
  const actions: TruthTurnCardPlayStep[] = [];
  for (let count = 0; count < 6 && !promise(game, f.target).fulfilled; count++) {
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
    if (count === 0) {
      assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.box);
      rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'old-box-guide' });
      rejected(game, f.target, { ...guide.action, selected: f.card });
    }
    const originalPacket = structuredClone(guide.action);
    game = settle(act(game, f.target, guide.action, actions), actions);
    assert.deepEqual(guide.action, originalPacket);
  }
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(player(game, f.target).spice, 0);
  assert.equal(player(game, f.target).moved, 2); assert.equal(player(game, f.target).hajrPlays, 2);
  assert.ok(actions.some(step => step.action.type === 'card' && step.action.card === f.box));
  assert.ok(actions.some(step => step.action.type === 'decision' && step.action.card === f.card));
  const recoveredAt = actions.findIndex(step => step.action.type === 'decision' && step.action.card === f.card);
  const moveAt = actions.findIndex(step => step.action.type === 'move');
  const replayAt = actions.findIndex(step => step.action.type === 'card' && step.action.card === f.card);
  assert.ok(recoveredAt >= 0 && moveAt > recoveredAt && replayAt > moveAt,
    'The actual second move must earn timing after paid recovery and before replay');
  assert.equal(actions.filter(step => step.action.type === 'move').length, 1);
  assert.ok(actions.some(step => step.action.type === 'card' && step.action.card === f.card));
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); physical(game, f);
});

void test('native earlier printed Hajr without a held recovery route leaves only No for another future play', () => {
  const f = fixture(); const played = settle(act(f.game, f.target, f.cardAction));
  assert.equal(player(played, f.target).hajrPlays, 1);
  const asked = ask(declare(f, played).game, f.asker, f.target, use('hajr'));
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'no'); assert.equal(game.turnActionPromises![0].cardPlays?.hajr?.played, false);
  game = settle(act(game, f.target, f.end)); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(game.turnActionPromises![0].cardPlays?.hajr?.played, false); physical(game, f);
});

void test('native printed-card guides retain exact event phase card and Ghola typed packets with only raw own history projected', () => {
  for (const source of ['hajr', 'gholaForces'] as const) {
    const f = fixture({ source }); let game = bind(f).game; game = act(game, f.target, f.payment);
    const row = promise(game, f.target), allowed = ['event', 'player', 'asker', 'turn', 'mixed', 'answer', 'fulfilled', 'released'];
    assert.ok(Object.keys(row).every(key => allowed.includes(key)));
    assert.deepEqual(viewGame(game, f.target).truthHistory.at(-1)?.question, f.question);
    assert.deepEqual(viewGame(game, f.asker).turnActionPromises, []); assert.equal(viewGame(game, f.asker).turnActionGuide, null);
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.card);
    assert.equal(guide.event, row.event); assert.equal(guide.action.turnActionPromiseEvent, row.event);
    assert.equal(guide.action.turnActionPromisePhase, game.phase);
    if (source === 'gholaForces') { assert.equal(guide.action.amount, 1); assert.equal(guide.action.elite, 0); }
    rejected(game, f.asker, guide.action);
    rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-card-play-event' });
    rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 4 });
    rejected(game, f.target, { ...guide.action, card: f.truth });
    const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, wire));
    assert.equal(promise(game, f.target).fulfilled, true); rejected(game, f.target, wire); physical(game, f);
  }
});

void test('all four minimal profiles actually complete early Basic Hajr and native Ghola force or leader guides', () => {
  for (const options of [{ source: 'hajr', early: true }, { source: 'gholaForces' }, { source: 'gholaLeader' }] as const) {
    const f = fixture(options), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthTurnCardPlayStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, difficulty);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 100 && !promise(game, f.target).fulfilled; count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        const guide = view.turnActionGuide;
        if (guide) {
          const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.event);
          assert.ok(action, `${f.sourceKind}/${difficulty}`); assert.deepEqual(action, guide.action);
          game = settle(act(game, f.target, action, actions), actions);
        } else {
          const next = nativeStep(game); assert.ok(next, `${f.sourceKind}/${difficulty}`);
          game = act(game, next.actor, next.action, actions);
        }
      }
      assert.equal(promise(game, f.target).fulfilled, true, `${f.sourceKind}/${difficulty}`);
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'bribe'));
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'card' && step.action.card === f.card));
      assert.equal(game.turnActionPromises![0].cardPlays?.[f.effect]?.played, true); physical(game, f);
    }
  }
});
