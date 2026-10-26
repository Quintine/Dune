import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { treacheryDeck } from '../game/cards';
import { viewGame, type Action, type Game } from '../game/engine';
import { printedCardPlayCount } from '../game/printed-card-play';
import { richeseCards } from '../game/richese-cards';
import { truthFactAnswer, type TruthQuestion } from '../game/truthtrance';
import {
  actTruthSemutaPlay as act, advanceTruthSemutaPlay as advance, answerTruthSemutaPlay as answer,
  askTruthSemutaPlay as ask, bindTruthSemutaPlay as bind, commitTruthSemutaPlay as commit,
  createTruthSemutaPlayFixture as fixture, createTruthSemutaMultiFixture as multiFixture,
  declareTruthSemutaPlay as declare, finishTruthSemutaPlay as finish, nextTruthSemutaPlayNative as nativeStep,
  openTruthSemutaMultiBatch as multiBatch, passTruthSemutaOffer as passOffer,
  recoverTruthSemutaWithNativeBox as recover, selectTruthSemutaPlay as select, settleTruthSemutaPlay as settle,
  truthSemutaPlayClean as clean, truthSemutaPlayFact as fact, truthSemutaPlayGroup as group,
  truthSemutaPlayInventory as inventory, truthSemutaPlayPayment as payment, truthSemutaPlayPlayer as player,
  truthSemutaPlayPromise as promise, truthSemutaPlaySpice as spice, truthSemutaPlayTraitors as traitors,
  truthSemutaPlayUse as use, type TruthSemutaPlayExpression, type TruthSemutaPlaySource, type TruthSemutaPlayStep,
} from './fixture-truth-semuta-play';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthSemutaPlaySource) {
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(spice(game), f.originalSpice);
  assert.deepEqual(traitors(game), f.originalTraitors);
}
const raw = (f: TruthSemutaPlaySource, mixed: TruthSemutaPlayExpression, turn = f.game.turn): TruthQuestion =>
  ({ kind: 'turnActions', target: f.target, turn, mixed });
const stage = (game: Game, index = 0) => game.turnActionPromises![index].cardPlays?.semutaDrug;
const count = (game: Game, f: TruthSemutaPlaySource) => printedCardPlayCount(game.printedCardPlays, f.target, game.turn, 'semutaDrug');
const pay = (game: Game, f: TruthSemutaPlaySource, amount: number, actions: TruthSemutaPlayStep[] = []) =>
  act(game, f.target, { type: 'bribe', target: f.recipient, amount }, actions);

void test('Semuta sources distinguish genuine cache acquisition from the explicitly conserved multi-card producer supplement', () => {
  for (const firstBid of [false, true]) {
    const f = fixture({ firstBid }); assert.equal(f.nativeAcquisition, true); assert.equal(f.sourceKind, 'nativeSingleton');
    assert.equal(f.setup.status, 'setup'); assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(f.originalCards, [...treacheryDeck(['choam']), ...richeseCards()].map(card => card.id).sort());
    assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.sourceCounts.selected, f.actions.length);
    assert.equal(f.game.auction!.bid, firstBid ? 1 : 0); assert.equal(f.game.semutaPreview, true);
    assert.ok(f.acquisition.steps.some(step => step.actor === f.target && step.action.type === 'richeseBid' && step.action.amount === 1));
    assert.ok(player(f.game, f.target).hand.some(card => card.id === f.semuta)); assert.equal(player(f.game, f.target).spice, 3);
    for (const [index, truth] of f.truths.entries()) assert.ok(player(f.game, f.truthHolders[index]).hand.some(card => card.id === truth));
    assert.equal(count(f.game, f), 0); assert.equal(f.game.turnActionPromises?.length ?? 0, 0); physical(f.game, f);
  }
  const supplement = multiFixture(); assert.equal(supplement.nativeAcquisition, false); assert.equal(supplement.sourceKind, 'controlledMulti');
  assert.match(supplement.sourceDisclosure, /CONTROLLED CONSERVED UNIT SUPPLEMENT/);
  assert.equal(supplement.sourceCounts.inheritedRecordedActions, null); assert.equal(supplement.sourceActionCount, supplement.actions.length);
  assert.ok(!supplement.game.battle && !supplement.game.pendingTreacheryDiscard);
  assert.ok(!supplement.game.homeworlds && !supplement.game.nexusCards && !supplement.game.leaderSkills);
  physical(supplement.game, supplement);
});

void test('genuine Semuta AND frozen fact and current-budget payment uses the actual foreign Truth cost for free before paying', () => {
  for (const firstBid of [false, true]) {
    const f = fixture({ firstBid }), cash = player(f.game, f.target).spice,
      budget = viewGame(f.game, f.target).bribeOptions.available;
    assert.equal(budget, cash - Number(firstBid));
    if (firstBid) {
      const declared = declare(f), unfunded = ask(declared.game, declared.asker,
        raw(f, group('and', fact(f.spiceFact), use(), payment(f.recipient, cash))));
      assert.deepEqual(viewGame(unfunded, f.target).truthTurnActionAnswers, ['no']);
      rejected(unfunded, f.target, { type: 'truthAnswer', answer: 'yes' });
    }
    const mixed = group('and', fact(f.spiceFact), use(), payment(f.recipient, budget));
    let game = bind(f, 'yes', raw(f, mixed)).game;
    const event = game.pendingTreacheryDiscard!.batch.event, lot = structuredClone(game.auction);
    assert.equal(game.pendingTreacheryDiscard!.batch.entries[0].card.id, f.truth);
    assert.equal(stage(game)?.played, false); assert.equal(count(game, f), 0); rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: budget });
    game = commit(game, f.target); assert.ok(!game.pendingTreacheryDiscard);
    assert.equal(player(game, f.target).spice, cash); assert.equal(count(game, f), 1); assert.equal(stage(game)?.played, true);
    assert.ok(player(game, f.target).hand.some(card => card.id === f.truth)); assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
    assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'yes'); assert.deepEqual(game.auction, lot);
    rejected(game, f.target, { type: 'semutaCommit', event }); game = pay(game, f, budget);
    assert.equal(player(game, f.target).spice, cash - budget); assert.equal(player(game, f.recipient).bribes, budget);
    assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no'); assert.equal(promise(game).fulfilled, true);
    assert.deepEqual(promise(game).mixed, mixed); assert.equal(count(game, f), 1); physical(game, f);
  }
});

void test('required Yes cannot voluntarily Pass its only known Semuta trigger while foreign neutral passes retain their native rights', () => {
  const f = fixture(); let game = bind(f, 'yes', raw(f, use())).game;
  const event = game.pendingTreacheryDiscard!.batch.event;
  rejected(game, f.target, { type: 'semutaPass', event });
  assert.ok(viewGame(game, f.target).semutaReaction?.passBlocked);
  for (const actor of game.players.filter(candidate => candidate.id !== f.target).map(candidate => candidate.id))
    game = act(game, actor, { type: 'semutaPass', event });
  assert.equal(game.pendingTreacheryDiscard?.batch.event, event); assert.equal(stage(game)?.played, false);
  rejected(game, f.target, { type: 'semutaPass', event });
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, 'semutaCommit');
  game = act(game, f.target, guide.action); assert.equal(promise(game).fulfilled, true); assert.equal(count(game, f), 1);
  assert.equal(player(game, f.target).spice, 3); physical(game, f);
});

void test('whole OR permits passing Semuta and retaining the physical card for a later actual Mentat payment route', () => {
  const f = fixture(), budget = player(f.game, f.target).spice;
  let game = bind(f, 'yes', raw(f, group('or', use(), payment(f.recipient, budget)))).game;
  const event = game.pendingTreacheryDiscard!.batch.event;
  game = act(game, f.target, { type: 'semutaPass', event }); game = passOffer(game);
  assert.equal(stage(game)?.played, false); assert.equal(count(game, f), 0);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.semuta));
  game = advance(game, state => state.phase === 8 && clean(state));
  assert.ok(!promise(game).fulfilled && !promise(game).released); game = pay(game, f, budget);
  assert.equal(promise(game).fulfilled, true); assert.equal(stage(game)?.played, false); assert.equal(count(game, f), 0);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.semuta)); physical(game, f);
});

void test('whole OR No blocks Semuta commitment before inspection and retains its cumulative payment cap through the turn', () => {
  const f = fixture(); let game = bind(f, 'no', raw(f, group('or', use(), payment(f.recipient, 2)))).game;
  const reaction = viewGame(game, f.target).semutaReaction; assert.ok(reaction);
  assert.equal(reaction.canCommit, false); assert.deepEqual(reaction.candidates, []);
  rejected(game, f.target, { type: 'semutaCommit', event: reaction.event }); assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  game = passOffer(game); game = pay(game, f, 1);
  game = advance(game, state => state.phase === 8 && clean(state));
  rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 }); assert.ok(!promise(game).released);
  game = finish(game); assert.equal(promise(game).fulfilled, true); assert.equal(stage(game)?.played, false); assert.equal(stage(game)?.closed, true);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.semuta)); physical(game, f);
});

void test('whole AND No permits the real Semuta exchange but forbids the later payment that would complete both terms', () => {
  const f = fixture(); let game = bind(f, 'no', raw(f, group('and', use(), payment(f.recipient, 2)))).game;
  game = commit(game, f.target); assert.equal(count(game, f), 1); assert.equal(stage(game)?.played, true);
  game = pay(game, f, 1); rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  assert.ok(!promise(game).released); game = finish(game); assert.equal(promise(game).fulfilled, true);
  assert.equal(stage(game)?.played, true); assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1); physical(game, f);
});

void test('current offer guide packets retain exact native event and phase through JSON and reject stale owner or preselection', () => {
  const f = fixture({ firstBid: true }); let game = bind(f, 'yes', raw(f, use())).game;
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'semutaCommit'); assert.equal(guide.event, promise(game).event);
  assert.equal(guide.action.event, game.pendingTreacheryDiscard!.batch.event);
  assert.equal(guide.action.turnActionPromiseEvent, promise(game).event); assert.equal(guide.action.turnActionPromisePhase, 3);
  rejected(game, f.asker, guide.action); rejected(game, f.target, { ...guide.action, event: 'stale-fresh-semuta-source' });
  rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-whole-answer' });
  rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 4 }); rejected(game, f.target, { ...guide.action, card: f.truth });
  const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, packet);
  assert.equal(promise(game).fulfilled, true); assert.equal(count(game, f), 1); rejected(game, f.target, packet); physical(game, f);
});

void test('controlled native two-card batches count neither commitment nor inspection, and either completed choice or its exact selection guide fulfills', () => {
  const f = multiFixture();
  for (const route of ['first', 'second', 'guide'] as const) {
    const actions: TruthSemutaPlayStep[] = []; let game = bind(f, 'yes', f.question, f.game, 0, actions).game;
    game = multiBatch(f, game, actions); const event = game.pendingTreacheryDiscard!.batch.event;
    assert.deepEqual(viewGame(game, f.target).semutaReaction?.candidates, []); assert.equal(count(game, f), 0);
    game = commit(game, f.target, actions); assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'select');
    assert.equal(count(game, f), 0); assert.equal(stage(game)?.played, false); assert.ok(!promise(game).fulfilled);
    assert.ok(player(game, f.target).hand.some(card => card.id === f.semuta)); assert.equal(game.discard.filter(card => card.id === f.semuta).length, 0);
    const candidates = viewGame(game, f.target).semutaReaction!.candidates; assert.equal(candidates.length, 2);
    assert.deepEqual(candidates.map(card => card.id).sort(), [...f.producer.loserCards].sort());
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, 'semutaSelect');
    assert.equal(guide.action.event, event); assert.equal(guide.action.turnActionPromiseEvent, promise(game).event);
    assert.equal(guide.action.turnActionPromisePhase, 6); assert.ok(candidates.some(card => card.id === guide.action.card));
    rejected(game, f.target, { type: 'semutaPass', event }); rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
    rejected(game, f.asker, guide.action); rejected(game, f.target, { ...guide.action, event: 'stale-multi-source' });
    rejected(game, f.target, { type: 'semutaSelect', event, card: f.truth });
    const chosen = route === 'guide' ? String(guide.action.card) : candidates[route === 'first' ? 0 : 1].id;
    game = route === 'guide' ? act(game, f.target, JSON.parse(JSON.stringify(guide.action)) as Action, actions)
      : select(game, f.target, chosen, actions);
    assert.equal(count(game, f), 1); assert.equal(stage(game)?.played, true); assert.equal(promise(game).fulfilled, true);
    assert.ok(player(game, f.target).hand.some(card => card.id === chosen)); assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
    const receipt = structuredClone(stage(game)); game = settle(game, actions); assert.deepEqual(stage(game), receipt);
    assert.equal(count(game, f), 1); assert.equal(f.nativeAcquisition, false); assert.ok(actions.some(step => step.action.type === 'chooseBattle'));
    assert.ok(actions.filter(step => step.action.type === 'battlePlan').length === 2); physical(game, f);
  }
});

void test('a controlled native multi-card offer still rejects whole No commitment before exposing either fresh choice', () => {
  const f = multiFixture(); let game = bind(f, 'no', raw(f, group('or', use(), payment(f.recipient, 2)))).game;
  game = multiBatch(f, game); const event = game.pendingTreacheryDiscard!.batch.event;
  const view = viewGame(game, f.target); assert.equal(view.semutaReaction?.canCommit, false); assert.deepEqual(view.semutaReaction?.candidates, []);
  rejected(game, f.target, { type: 'semutaCommit', event }); assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(count(game, f), 0); assert.equal(stage(game)?.played, false);
  game = settle(passOffer(game)); assert.ok(player(game, f.target).hand.some(card => card.id === f.semuta)); physical(game, f);
});

void test('an earlier completed physical Semuta use cannot satisfy a second original Truth future-play interval', () => {
  const f = fixture(); let game = bind(f, 'yes', raw(f, use())).game; game = commit(game, f.target);
  assert.equal(promise(game).fulfilled, true); assert.equal(count(game, f), 1);
  const prior = structuredClone(viewGame(game, f.target).turnActionPromises[0]), declared = declare(f, game, 1);
  const asked = ask(declared.game, declared.asker, raw(f, use())); assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' }); game = settle(answer(asked, f.target, 'no'));
  assert.equal(stage(game, 1)?.played, false); assert.equal(count(game, f), 1);
  assert.deepEqual(viewGame(game, f.target).turnActionPromises[0], prior); physical(game, f);
});

void test('real paid Box recovery of the original Semuta is not another play, while a later original Truth cost permits genuine replay', () => {
  const f = fixture(); let game = bind(f, 'yes', raw(f, use())).game; game = commit(game, f.target);
  assert.equal(player(game, f.target).spice, 3); assert.equal(count(game, f), 1);
  const actions: TruthSemutaPlayStep[] = [], recovered = recover(f, game, actions); game = recovered.game;
  assert.equal(game.turn, f.game.turn + 1); assert.equal(player(game, f.target).spice, 0); assert.equal(count(game, f), 0);
  assert.ok(recovered.purchase.steps.some(step => step.actor === f.target && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(recovered.paid.pendingNullentropy); assert.ok(actions.some(step => step.action.type === 'decision' && step.action.card === f.semuta));
  assert.ok(player(game, f.target).hand.some(card => card.id === f.semuta));
  const question = raw(f, use(), game.turn); game = bind(f, 'yes', question, game, 1).game;
  assert.equal(stage(game, 1)?.played, false); assert.equal(count(game, f), 0);
  game = commit(game, f.target); assert.equal(stage(game, 1)?.played, true); assert.equal(promise(game).fulfilled, true);
  assert.equal(count(game, f), 1); assert.equal(player(game, f.target).spice, 0);
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1); physical(game, f);
});

void test('all four minimal profiles execute native Semuta offer and committed selection guides through physical completion', () => {
  const f = fixture(), declared = declare(f), asked = ask(declared.game, declared.asker, f.question);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked); const actions: TruthSemutaPlayStep[] = [];
    const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response); assert.equal(response.answer, 'yes');
    game = act(game, f.target, response, actions);
    for (let step = 0; step < 80 && (!promise(game).fulfilled || !clean(game)); step++) {
      const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      if (view.turnActionGuide) {
        const guide = view.turnActionGuide, action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.action.turnActionPromiseEvent);
        assert.ok(action); assert.deepEqual(action, guide.action); game = act(game, f.target, action, actions);
      } else {
        const next = nativeStep(game); assert.ok(next); game = act(game, next.actor, next.action, actions);
      }
    }
    assert.equal(promise(game).fulfilled, true); assert.ok(clean(game)); assert.equal(count(game, f), 1);
    assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.recipient).bribes, 3); physical(game, f);
  }
  const supplement = multiFixture();
  for (const difficulty of DIFFICULTIES) {
    let game = bind(supplement).game; game = multiBatch(supplement, game); game = commit(game, supplement.target);
    assert.equal(count(game, supplement), 0);
    const view = viewGame(game, supplement.target); view.players.find(candidate => candidate.id === supplement.target)!.bot = difficulty;
    const guide = view.turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, 'semutaSelect');
    const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.action.turnActionPromiseEvent);
    assert.ok(action); assert.deepEqual(action, guide.action); game = settle(act(game, supplement.target, action));
    assert.equal(promise(game).fulfilled, true); assert.equal(count(game, supplement), 1); physical(game, supplement);
  }
});
