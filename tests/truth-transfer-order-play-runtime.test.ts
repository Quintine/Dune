import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { treacheryDeck } from '../game/cards';
import { viewGame, type Action, type Game } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { truthFactAnswer, type TruthQuestion } from '../game/truthtrance';
import {
  actTruthTransferOrderPlay as act, advanceTruthTransferOrderPlay as advance,
  answerTruthTransferOrderPlay as answer, askTruthTransferOrderPlay as ask, bindTruthTransferOrderPlay as bind,
  createTruthTransferOrderPlayFixture as fixture, createTruthSemutaPrebidFixture as semutaFixture,
  createTruthEarlySaphoFixture as earlySaphoFixture, declareTruthTransferOrderPlay as declare,
  finishTruthTransferOrderPlay as finish, nextTruthTransferOrderPlayNative as nativeStep,
  settleTruthTransferOrderPlay as settle, truthTransferOrderDistransAction as transfer,
  truthTransferOrderSaphoAction as order, truthTransferOrderPlayClean as clean,
  truthTransferOrderPlayFact as fact, truthTransferOrderPlayGroup as group,
  truthTransferOrderPlayInventory as inventory, truthTransferOrderPlayPayment as payment,
  truthTransferOrderPlayPlayer as player, truthTransferOrderPlayPromise as promise,
  truthTransferOrderPlayShip as ship, truthTransferOrderPlaySpice as spice,
  truthTransferOrderPlayTraitors as traitors, truthTransferOrderPlayUse as use,
  type TruthTransferOrderExpression, type TruthTransferOrderPlayFixture, type TruthTransferOrderStep,
} from './fixture-truth-transfer-order-play';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTransferOrderPlayFixture) {
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(spice(game), f.originalSpice);
  assert.deepEqual(traitors(game), f.originalTraitors);
}
const raw = (f: TruthTransferOrderPlayFixture, mixed: TruthTransferOrderExpression): TruthQuestion =>
  ({ kind: 'turnActions', target: f.target, turn: f.game.turn, mixed });
const pay = (game: Game, f: TruthTransferOrderPlayFixture, amount: number, actions: TruthTransferOrderStep[] = []) =>
  act(game, f.target, { type: 'bribe', target: f.recipient, amount }, actions);
const stage = (game: Game, f: TruthTransferOrderPlayFixture, index = 0) => game.turnActionPromises![index].cardPlays?.[f.effect];
const nativeCard = (game: Game, f: TruthTransferOrderPlayFixture): Action => f.effect === 'distrans'
  ? transfer(game, f) : order(game, f, 'first');

void test('transfer and order sources retain actual cache purchases, unopened Truth deals and all original native inventories', () => {
  for (const source of ['distrans', 'sapho'] as const) for (const advanced of [false, true]) {
    const f = fixture({ source, advanced }); assert.equal(f.setup.status, 'setup');
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(f.originalCards, [...treacheryDeck(['choam']), ...richeseCards()].map(card => card.id).sort());
    assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.sourceCounts.selected, f.actions.length);
    assert.equal(f.sourceCounts.inherited + f.sourceCounts.nativeContinuation, f.actions.length); assert.equal(f.sourceCounts.nativeCacheBids, 1);
    assert.equal(!!f.game.semutaPreview, !advanced); assert.equal(player(f.game, f.target).spice, source === 'distrans' ? 4 : 9);
    for (const [index, truth] of f.truths.entries()) assert.ok(player(f.game, f.truthHolders[index]).hand.some(card => card.id === truth));
    assert.ok(player(f.game, f.target).hand.some(card => card.id === f.card)); assert.equal(f.game.turnActionPromises?.length ?? 0, 0);
    if (f.sapho) {
      assert.equal(f.game.active, f.sapho.current); assert.equal(player(f.game, f.sapho.current).shipped, true);
      assert.equal(player(f.game, f.sapho.current).moved, 0); assert.equal(player(f.game, f.target).shipped, false);
      assert.ok(player(f.game, f.sapho.canceler).hand.some(card => card.id === f.sapho!.counter));
    }
    physical(f.game, f);
  }
});

void test('Basic Distrans AND frozen fact and payment spends no transfer fee and preserves the original untouched ordinary lot', () => {
  const f = fixture(), actions: TruthTransferOrderStep[] = [];
  let game = bind(f, 'yes', raw(f, group('and', fact(f.spiceFact), use(f.effect), payment(f.recipient, 4))), f.game, 0, actions).game;
  game = settle(game, actions); assert.ok(actions.some(step => step.action.type === 'semutaPass'));
  const lot = structuredClone(game.auction), donorForces = structuredClone(player(game, f.target).forces);
  game = pay(game, f, 4, actions); assert.equal(player(game, f.target).spice, 0);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  const action = transfer(game, f); game = settle(act(game, f.target, action, actions), actions);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.recipient).bribes, 4);
  assert.ok(player(game, f.recipient).hand.some(card => card.id === f.give));
  assert.ok(!player(game, f.target).hand.some(card => card.id === f.give || card.id === f.card));
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); assert.deepEqual(game.auction, lot);
  assert.deepEqual(player(game, f.target).forces, donorForces); assert.equal(stage(game, f)?.played, true);
  assert.equal(promise(game).fulfilled, true); assert.equal(game.semutaPreview, true); physical(game, f);
});

void test('Distrans printed use names no recipient and can choose another public-capacity route when the original target is genuinely full', () => {
  const f = fixture({ capacity: 'recipientFull' }); assert.ok(f.distrans);
  const fullRecipient = f.distrans.recipient, fullHandCount = player(f.game, fullRecipient).hand.length;
  const copy = f.truthHolders.findIndex(holder => holder !== fullRecipient); assert.ok(copy === 0 || copy === 1);
  let game = settle(bind(f, 'yes', raw(f, use(f.effect)), f.game, copy).game);
  const quoted = viewGame(game, f.target).distrans; assert.ok(quoted);
  assert.ok(quoted.choices.find(choice => choice.recipient === fullRecipient)?.blocked);
  rejected(game, f.target, { type: 'card', card: f.card, target: fullRecipient, give: f.give! });
  rejected(game, f.target, { type: 'card', card: f.card, target: f.asker, give: f.card });
  const alternative = quoted.choices.find(choice => !choice.blocked && choice.cards.some(card => card.id === f.give)); assert.ok(alternative);
  const cash = player(game, f.target).spice;
  game = settle(act(game, f.target, transfer(game, f, alternative.recipient)));
  assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.target).spice, cash);
  assert.equal(player(game, fullRecipient).hand.length, fullHandCount);
  assert.ok(player(game, alternative.recipient).hand.some(card => card.id === f.give)); assert.ok(clean(game)); physical(game, f);
});

void test('free Distrans, a later Guild shipment and payments share the same four owned spice', () => {
  const f = fixture({ advanced: true });
  const unfunded = raw(f, group('and', use(f.effect), payment(f.recipient, 4), ship()));
  const asked = ask(declare(f).game, f.asker, unfunded);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']); rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const funded = raw(f, group('and', use(f.effect), payment(f.recipient, 3), ship()));
  let game = settle(bind(f, 'yes', funded).game); game = pay(game, f, 3);
  game = settle(act(game, f.target, transfer(game, f))); assert.equal(stage(game, f)?.played, true);
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), [], true);
  game = settle(act(game, f.target, f.shipment)); assert.equal(player(game, f.target).spice, 0);
  assert.equal(player(game, f.target).forces['polar_sink:0'], 1); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.recipient).bribes, 3); assert.equal(player(game, f.target).spice, 0); physical(game, f);
});

void test('Sapho AND frozen fact and payment accepts either real queued mode while preserving the current completed shipment and unsplit turn', () => {
  const cases = [{ advanced: false, guildTake: false, mode: 'first' }, { advanced: false, guildTake: false, mode: 'last' },
    { advanced: true, guildTake: false, mode: 'first' }, { advanced: true, guildTake: false, mode: 'last' },
    { advanced: true, guildTake: true, mode: 'first' }] as const;
  for (const { advanced, guildTake, mode } of cases) {
    const f = fixture({ source: 'sapho', advanced, guildTake }); assert.ok(f.sapho);
    const actions: TruthTransferOrderStep[] = [];
    let game = settle(bind(f, 'yes', raw(f, group('and', fact(f.spiceFact), use(f.effect), payment(f.recipient))), f.game, 0, actions).game, actions);
    game = pay(game, f, 2, actions); assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
    const current = f.sapho.current, beforeCurrent = structuredClone(player(game, current)), nativeOrder = [...game.order];
    const native = viewGame(game, f.target).saphoOptions.find(option => option.scope === 'movement' && option.mode === mode); assert.ok(native);
    assert.equal((native as typeof native & { afterCurrent?: string }).afterCurrent, current);
    if (guildTake) {
      assert.equal(current, f.sapho.guild);
      assert.equal(viewGame(game, f.target).saphoOptions.some(option => option.scope === 'movement' && option.mode === 'last'), false);
      rejected(game, f.target, { ...order(game, f, 'first'), mode: 'last' });
      assert.deepEqual(player(game, current), beforeCurrent); assert.equal(stage(game, f)?.played, false);
    }
    game = settle(act(game, f.target, order(game, f, mode), actions), actions);
    assert.equal(game.active, current); assert.deepEqual(player(game, current), beforeCurrent);
    assert.deepEqual(game.order, nativeOrder); assert.equal(player(game, f.target).spice, 7);
    assert.equal(stage(game, f)?.played, true); assert.equal(promise(game).fulfilled, true);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    const from = actions.length; game = advance(game, state => state.phase !== 5, actions, true);
    const ended = actions.slice(from).filter(step => step.action.type === 'endMovement').map(step => step.actor);
    assert.equal(ended[0], current); assert.equal(ended.filter(actor => actor === f.target).length, 1);
    assert.equal(new Set(ended).size, ended.length); assert.equal(stage(game, f)?.played, true); physical(game, f);
  }
});

void test('a genuinely purchased Semuta claims the original Truth cost before or after the first normal bid without changing its standing auction', () => {
  for (const firstBid of [false, true]) {
    const f = semutaFixture({ firstBid });
    assert.ok(f.acquisition.steps.some(step => step.actor === f.target && step.action.type === 'richeseBid' && step.action.amount === 1));
    assert.ok(player(f.game, f.target).hand.some(card => card.id === f.semuta));
    assert.equal(f.game.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(f.game.auction!.bid, firstBid ? 1 : 0);
    const position = (game: Game) => structuredClone({ status: game.status, turn: game.turn, phase: game.phase,
      active: game.active, order: game.order, ready: game.ready, auction: game.auction,
      richeseAuction: game.richeseAuction, richeseBidding: game.richeseBidding, richeseFunding: game.richeseFunding,
      currentAuctionSale: game.currentAuctionSale, deck: game.deck,
      players: game.players.map(candidate => ({ ...candidate, hand: undefined })) });
    const standing = position(f.game), declared = declare(f), asked = ask(declared.game, declared.asker, f.question);
    assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
    let game = answer(asked, f.target, 'no');
    const pending = game.pendingTreacheryDiscard; assert.ok(pending); assert.equal(pending.reaction?.stage, 'offer');
    assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, discardedBy: entry.discardedBy })),
      [{ card: f.truth, discardedBy: f.asker }]);
    assert.equal(viewGame(game, f.target).semutaReaction?.canCommit, true); assert.deepEqual(position(game), standing);
    const event = pending.batch.event; game = act(game, f.target, { type: 'semutaCommit', event });
    assert.ok(!game.pendingTreacheryDiscard); assert.deepEqual(position(game), standing);
    assert.ok(player(game, f.target).hand.some(card => card.id === f.truth));
    assert.ok(!player(game, f.target).hand.some(card => card.id === f.semuta));
    assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1); assert.equal(game.discard.filter(card => card.id === f.truth).length, 0);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1); assert.equal(stage(game, f)?.played, false);
    assert.equal(game.resolvedTreacheryDiscardSequence, pending.sequence); assert.equal(promise(game).answer, false);
    rejected(game, f.target, { type: 'semutaCommit', event }); physical(game, f);
  }
});

void test('genuine early Basic Sapho can promise its free upcoming native movement play after paying all current cash', () => {
  const f = earlySaphoFixture(); assert.equal(f.game.phase, 4); assert.equal(f.game.advanced, false);
  assert.ok(!f.actions.some(step => step.action.type === 'ship')); assert.equal(f.sourceCounts.selected, f.actions.length);
  assert.equal(f.sourceCounts.inherited + f.sourceCounts.nativeContinuation, f.actions.length);
  const cash = player(f.game, f.target).spice;
  const question = raw(f, group('and', fact(f.spiceFact), use(f.effect), payment(f.recipient, cash)));
  const declared = declare(f), asked = ask(declared.game, declared.asker, question);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['yes', 'no']);
  let game = settle(answer(asked, f.target, 'yes')); game = pay(game, f, cash);
  assert.equal(player(game, f.target).spice, 0); assert.equal(stage(game, f)?.played, false);
  assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  const earlyGuide = viewGame(game, f.target).turnActionGuide;
  assert.ok(!earlyGuide || earlyGuide.action.type !== 'card' || earlyGuide.action.card !== f.card,
    'The future movement option is not a currently executable Basic Revival card packet');
  game = advance(game, state => state.phase === 5 && clean(state) && viewGame(state, f.target).saphoOptions.some(option => option.scope === 'movement'), [], true);
  const before = game.players.map(candidate => ({ id: candidate.id, spice: candidate.spice, forces: structuredClone(candidate.forces),
    reserves: candidate.reserves, tanks: candidate.tanks, shipped: candidate.shipped, moved: candidate.moved }));
  const view = viewGame(game, f.target), guide = view.turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.card);
  assert.ok(view.saphoOptions.some(option => option.scope === guide.action.scope && option.event === guide.action.event && option.mode === guide.action.mode));
  game = settle(act(game, f.target, guide.action));
  assert.deepEqual(game.players.map(candidate => ({ id: candidate.id, spice: candidate.spice, forces: candidate.forces,
    reserves: candidate.reserves, tanks: candidate.tanks, shipped: candidate.shipped, moved: candidate.moved })), before);
  assert.equal(stage(game, f)?.played, true); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.recipient).bribes, cash); physical(game, f);
});

void test('whole OR keeps both manual printed use and late ordinary payment routes for transfer and order', () => {
  for (const source of ['distrans', 'sapho'] as const) {
    const f = fixture({ source, advanced: true }), question = raw(f, group('or', use(f.effect), payment(f.recipient)));
    const bound = settle(bind(f, 'yes', question).game);
    const played = settle(act(bound, f.target, nativeCard(bound, f)));
    assert.equal(promise(played).fulfilled, true); assert.equal(player(played, f.recipient).bribes, 0);
    let paid = advance(bound, state => state.phase === 8 && clean(state), [], true);
    assert.equal(stage(paid, f)?.played, false); assert.ok(!promise(paid).released && !promise(paid).fulfilled);
    paid = pay(paid, f, 2); assert.equal(promise(paid).fulfilled, true);
    assert.ok(player(paid, f.target).hand.some(card => card.id === f.card)); physical(played, f); physical(paid, f);
  }
});

void test('whole AND No allows one printed branch or its payment but cannot complete both conditions', () => {
  for (const source of ['distrans', 'sapho'] as const) {
    const f = fixture({ source, advanced: true }), bound = settle(bind(f, 'no').game), packet = nativeCard(bound, f);
    let played = settle(act(bound, f.target, packet)); assert.equal(stage(played, f)?.played, true);
    played = pay(played, f, 1); rejected(played, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
    let paid = pay(bound, f, 2); rejected(paid, f.target, packet); assert.equal(stage(paid, f)?.played, false);
    played = finish(played); paid = finish(paid); assert.equal(promise(played).fulfilled, true); assert.equal(promise(paid).fulfilled, true);
    assert.ok(!promise(played).released && !promise(paid).released); physical(played, f); physical(paid, f);
  }
});

void test('whole OR No preserves cumulative caps and rejects both printed roles until the actual turn end', () => {
  for (const source of ['distrans', 'sapho'] as const) {
    const f = fixture({ source, advanced: true }), originalPacket = nativeCard(f.game, f);
    let game = settle(bind(f, 'no', raw(f, group('or', use(f.effect), payment(f.recipient)))).game);
    const forbidden = viewGame(game, f.target);
    if (source === 'distrans') assert.match(forbidden.distrans?.blocked ?? '', /Truthtrance/);
    else assert.deepEqual(forbidden.saphoOptions, []);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game, f.target); view.players.find(player => player.id === f.target)!.bot = difficulty;
      assert.ok(!botActions(view).some(action => action.type === 'card' && action.card === f.card));
    }
    rejected(game, f.target, originalPacket); game = pay(game, f, 1);
    game = advance(game, state => state.phase === 8 && clean(state), [], true);
    rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
    assert.ok(!promise(game).released); game = finish(game);
    assert.equal(promise(game).fulfilled, true); assert.equal(stage(game, f)?.played, false); assert.equal(stage(game, f)?.closed, true);
    assert.ok(player(game, f.target).hand.some(card => card.id === f.card)); physical(game, f);
  }
});

void test('earlier native Distrans and Sapho use without an owned recovery route leaves only No for a new future interval', () => {
  for (const source of ['distrans', 'sapho'] as const) {
    const f = fixture({ source, advanced: true }); const earlier = settle(act(f.game, f.target, nativeCard(f.game, f)));
    assert.equal(earlier.discard.filter(card => card.id === f.card).length, 1);
    const declared = declare(f, earlier), asked = ask(declared.game, declared.asker, raw(f, use(f.effect)));
    assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']); rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
    const game = settle(answer(asked, f.target, 'no')); assert.equal(stage(game, f)?.played, false); physical(game, f);
  }
});

void test('an actual turn2 Box recovery alone is not a Distrans play but a later native replay with an earned outgoing card fulfills', () => {
  const f = fixture({ recoveredDistrans: true }); assert.ok(f.recovery);
  assert.equal(f.game.turn, f.recovery.before.turn + 1);
  assert.ok(player(f.recovery.afterRecovery, f.target).hand.some(card => card.id === f.card));
  assert.equal(f.recovery.afterRecovery.discard.filter(card => card.id === f.recovery!.box).length, 1);
  assert.ok(f.recovery.acquisition.some(step => step.actor === f.target && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(f.recovery.outgoingPurchase.card, f.give); assert.equal(f.recovery.outgoingPurchase.amount, 1);
  const cash = player(f.game, f.target).spice; let game = settle(bind(f, 'yes', raw(f, use(f.effect))).game);
  assert.equal(stage(game, f)?.played, false); assert.ok(!promise(game).fulfilled);
  game = settle(act(game, f.target, transfer(game, f)));
  assert.equal(stage(game, f)?.played, true); assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).spice, cash); assert.ok(player(game, f.recipient).hand.some(card => card.id === f.give));
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); physical(game, f);
});

void test('exact transfer/order guide packets preserve native choices and reject stale owner, promise and Sapho event through JSON', () => {
  for (const source of ['distrans', 'sapho'] as const) {
    const f = fixture({ source, advanced: true }); let game = settle(bind(f, 'yes', raw(f, use(f.effect))).game);
    const view = viewGame(game, f.target), guide = view.turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, 'card');
    assert.equal(guide.action.card, f.card); assert.equal(guide.event, promise(game).event);
    assert.equal(guide.action.turnActionPromiseEvent, promise(game).event); assert.equal(guide.action.turnActionPromisePhase, game.phase);
    if (source === 'distrans') {
      const native = view.distrans?.choices.find(choice => choice.recipient === guide.action.target && !choice.blocked); assert.ok(native);
      assert.ok(native.cards.some(card => card.id === guide.action.give)); assert.notEqual(guide.action.give, f.card);
    } else {
      assert.ok(view.saphoOptions.some(option => option.scope === guide.action.scope && option.event === guide.action.event && option.mode === guide.action.mode));
      rejected(game, f.target, { ...guide.action, event: 'stale-native-sapho-event' });
    }
    rejected(game, f.asker, guide.action); rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-printed-role-event' });
    rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 8 });
    const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, packet));
    assert.equal(promise(game).fulfilled, true); assert.equal(stage(game, f)?.played, true); rejected(game, f.target, packet); physical(game, f);
  }
});

void test('all four minimal profiles use real transfer/order guides and native Basic Semuta continuation without extra costs', () => {
  for (const source of ['distrans', 'sapho'] as const) for (const advanced of [false, true]) {
    const f = fixture({ source, advanced }), declared = declare(f), asked = ask(declared.game, declared.asker, f.question);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthTransferOrderStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, `${source}/${advanced}/${difficulty}`);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 100 && (!promise(game).fulfilled || !clean(game)); count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        if (view.turnActionGuide) {
          const guide = view.turnActionGuide;
          const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.action.turnActionPromiseEvent);
          assert.ok(action, `${source}/${advanced}/${difficulty}`); assert.deepEqual(action, guide.action);
          game = act(game, f.target, action, actions);
        } else {
          const step = nativeStep(game); assert.ok(step); game = act(game, step.actor, step.action, actions);
        }
      }
      assert.equal(promise(game).fulfilled, true); assert.ok(clean(game)); assert.equal(stage(game, f)?.played, true);
      assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'card' && step.action.card === f.card).length, 1);
      assert.equal(player(game, f.target).spice, player(f.game, f.target).spice - 2); assert.equal(player(game, f.recipient).bribes, 2);
      if (!advanced) assert.ok(actions.some(step => step.action.type === 'semutaPass'));
      assert.equal(game.discard.filter(card => card.id === f.card).length, 1); physical(game, f);
    }
  }
});
