import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { windowCardOpportunity, type WindowCardEffect } from '../game/window-card-play';
import {
  actTruthTurnWindowCard as act, advanceTruthTurnWindowCard as advance,
  askTruthTurnWindowCard as ask, bindTruthTurnWindowCard as bind, closeTruthTurnWindowCard as close,
  createTruthTurnWindowCardFixture as fixture, declareTruthTurnWindowCard as declare,
  finishTruthTurnWindowCard as finish, nextTruthTurnWindowCardNative as nativeStep,
  settleTruthTurnWindowCard as settle, truthTurnWindowCardClean as clean,
  truthTurnWindowCardFact as fact, truthTurnWindowCardGroup as group,
  truthTurnWindowCardInventory as inventory, truthTurnWindowCardPayment as payment,
  truthTurnWindowCardPlay as play, truthTurnWindowCardPlayer as player,
  truthTurnWindowCardPromise as promise, truthTurnWindowCardTraitors as traitors,
  type TruthTurnWindowCardExpression, type TruthTurnWindowCardFixture, type TruthTurnWindowCardStep,
} from './fixture-truth-turn-window-card';

const effects: WindowCardEffect[] = ['weather', 'atomics', 'harvester'];
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTurnWindowCardFixture) {
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
}
function receipt(game: Game, f: TruthTurnWindowCardFixture) {
  const stage = game.turnActionPromises![0].windowCards?.[f.effect]; assert.ok(stage); return stage;
}

void test('window-card sources use original native Harkonnen deals, earned Wall casualties and fresh blow identities', () => {
  for (const effect of effects) {
    const f = fixture({ effect }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.equal(f.setup.deck.length, 33); assert.equal(f.originalCards.length, 33); assert.equal(f.originalTraitors.length, 15);
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(player(f.afterSetup, f.target).hand.map(card => card.id), [f.card, f.filler]);
    assert.ok(player(f.game, f.asker).hand.some(card => card.id === f.truth));
    assert.ok(player(f.game, f.target).hand.some(card => card.id === f.card));
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceCounts.selected, f.actions.length);
    assert.equal(f.sourceCounts.beforeDials, f.beforeDialsActions.length);
    assert.deepEqual(windowCardOpportunity(f.game, effect), f.opportunity);
    assert.equal(f.game.advanced, false); assert.deepEqual(f.game.expansions, []);
    assert.ok(!f.game.nexusCards && !f.game.homeworlds && !f.game.leaderSkills && !f.game.strongholdCards);
    assert.equal(f.game.turnActionPromises?.length ?? 0, 0);
    if (effect === 'atomics') {
      assert.ok(f.wallShipment); assert.equal(f.game.turn, 2);
      assert.equal(f.sourceCounts.actualWallShipment, f.wallShipment.steps.length);
      assert.ok(f.wallShipment.steps.some(step => step.actor === f.target && step.action.type === 'ship' && step.action.amount === 2));
      assert.equal(player(f.game, f.target).spice, 6); assert.equal(player(f.game, f.target).forces['shield_wall:9'], 2);
    } else if (effect === 'harvester') {
      assert.ok(f.originalBlow?.event); assert.equal(f.source, f.originalBlow.event);
      assert.equal(f.originalBlow.harvested, false); assert.ok(f.beforeBlow);
    } else {
      assert.equal(f.source, 'storm:1'); assert.equal(f.game.stormPending, null); assert.equal(f.game.stormCardWindowOpen, true);
    }
    assert.deepEqual(inventory(f.game), f.originalCards); assert.deepEqual(traitors(f.game), f.originalTraitors);
  }
});

void test('each named original-window role AND payment freezes the fact and one actual play satisfies repeated correlated leaves', () => {
  for (const effect of effects) {
    const f = fixture({ effect }), role = play(effect, f.source);
    const mixed = group('and', fact(f.spiceFact), role, role, payment(f.recipient));
    let game = bind(f, 'yes', mixed).game;
    assert.deepEqual(receipt(game, f), { source: f.source, played: false, closed: false });
    game = act(game, f.target, f.payment);
    assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
    const beforePlay = structuredClone(game); game = settle(act(game, f.target, f.nativeAction));
    assert.equal(receipt(game, f).played, true); assert.equal(promise(game, f.target).fulfilled, true);
    assert.deepEqual(promise(game, f.target).mixed, mixed); assert.equal(player(game, f.recipient).bribes, 2);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(beforePlay, f.target).spice, player(game, f.target).spice, 'The printed role adds no invented spice fee');
    if (effect === 'weather') assert.equal(game.stormPending, 0);
    if (effect === 'atomics') {
      assert.equal(game.shieldWallDestroyed, true); assert.equal(player(game, f.target).forces['shield_wall:9'] ?? 0, 0);
      assert.equal(player(game, f.target).tanks - player(beforePlay, f.target).tanks, 2);
      assert.equal(player(game, f.target).reserves, player(beforePlay, f.target).reserves);
      assert.equal(player(game, f.target).forces['carthag:11'], 10);
    }
    if (effect === 'harvester') {
      const blow = f.originalBlow!; const key = `${blow.territory}:${blow.sector}`;
      assert.equal(game.spiceWindow?.event, f.source); assert.equal(game.spiceWindow?.amount, blow.amount * 2);
      assert.equal(game.spice[key] - (beforePlay.spice[key] ?? 0), blow.amount);
    }
    physical(game, f);
  }
});

void test('Weather Control promises preserve manual typed distances zero through ten before dials and after real reveal', () => {
  for (const window of ['beforeDials', 'afterReveal'] as const) {
    const f = fixture({ effect: 'weather', window });
    assert.equal(f.game.stormPending === null, window === 'beforeDials');
    const bound = bind(f).game;
    for (const amount of [-1, 11, 1.5, '5', null])
      rejected(bound, f.target, { type: 'card', card: f.card, amount });
    for (const amount of [0, 5, 10]) {
      let game = act(bound, f.target, { type: 'card', card: f.card, amount });
      assert.equal(game.stormPending, amount); assert.equal(game.stormMovementSource?.kind, 'weather');
      assert.equal(receipt(game, f).played, true); assert.ok(!promise(game, f.target).fulfilled);
      game = settle(game); game = act(game, f.target, f.payment);
      assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
    }
  }
});

void test('whole printed-role AND payment No preserves either order and rejects only the actual completed predicate', () => {
  for (const effect of effects) {
    const f = fixture({ effect });
    for (const first of ['payment', 'card'] as const) {
      let game = bind(f, 'no').game;
      if (first === 'payment') {
        game = act(game, f.target, f.payment); rejected(game, f.target, f.nativeAction);
      } else {
        game = settle(act(game, f.target, f.nativeAction)); rejected(game, f.target, f.payment);
        game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
        assert.equal(player(game, f.recipient).bribes, 1);
      }
      assert.ok(!promise(game, f.target).released); game = finish(close(game, f));
      assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
    }
  }
});

void test('whole printed-role OR payment No caps both real actions until the original window and turn actually close', () => {
  for (const effect of effects) {
    const f = fixture({ effect }), mixed = group('or', play(effect, f.source), payment(f.recipient));
    let game = bind(f, 'no', mixed).game;
    rejected(game, f.target, f.nativeAction); rejected(game, f.target, f.payment);
    game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
    game = close(game, f); assert.equal(receipt(game, f).closed, true); assert.equal(receipt(game, f).played, false);
    rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
    assert.ok(!promise(game, f.target).fulfilled); game = finish(game);
    assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('a skipped printed window leaves its manual payment OR alive through actual late Mentat', () => {
  for (const effect of effects) {
    const f = fixture({ effect }), mixed = group('or', play(effect, f.source), payment(f.recipient));
    const bound = bind(f, 'yes', mixed).game;
    const played = settle(act(bound, f.target, f.nativeAction));
    assert.equal(promise(played, f.target).fulfilled, true); assert.equal(player(played, f.recipient).bribes, 0); physical(played, f);
    let game = close(bound, f);
    assert.deepEqual(receipt(game, f), { source: f.source, played: false, closed: true });
    assert.ok(player(game, f.target).hand.some(card => card.id === f.card));
    assert.ok(!promise(game, f.target).fulfilled); const evidence = structuredClone(receipt(game, f));
    game = advance(game, state => state.phase === 8 && clean(state), [], true);
    rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, f.payment);
    assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(receipt(game, f), evidence); physical(game, f);
  }
});

void test('definite window answers reopen actual own Ready including constants and cannot skip a required printed play', () => {
  for (const effect of effects) {
    const f = fixture({ effect, window: 'afterReveal' });
    const ready = act(f.game, f.target, { type: 'ready' }); assert.ok(ready.ready.includes(f.target));
    let game = bind(f, 'yes', f.mixed, ready).game;
    assert.equal(game.ready.includes(f.target), false); rejected(game, f.target, { type: 'ready' });
    game = act(game, f.target, f.payment); rejected(game, f.target, { type: 'ready' });
    game = settle(act(game, f.target, f.nativeAction)); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
    const constantYes = group('or', fact(f.spiceFact), play(effect, f.source));
    const constantNo = group('and', fact({ kind: 'spice', compare: 'gte', value: 100 }), play(effect, f.source));
    for (const [selected, mixed] of [['yes', constantYes], ['no', constantNo]] as const) {
      const answered = bind(f, selected, mixed, ready).game;
      assert.equal(answered.ready.includes(f.target), false, `${effect}/${selected} must reopen the concurrent original Ready`);
      physical(answered, f);
    }
  }
});

void test('a real earlier Weather or Harvester play never pre-fills a newly answered future printed-play receipt', () => {
  for (const effect of ['weather', 'harvester'] as const) {
    const f = fixture({ effect }); let game = settle(act(f.game, f.target, f.nativeAction));
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(windowCardOpportunity(game, effect)?.source, f.source);
    const mixed = play(effect, f.source), asked = ask(declare(f, game).game, f.asker, f.target, mixed);
    assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
    rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
    game = act(asked, f.target, { type: 'truthAnswer', answer: 'no' });
    assert.equal(receipt(game, f).played, false); game = close(game, f);
    assert.equal(promise(game, f.target).fulfilled, true); assert.equal(receipt(game, f).played, false); physical(game, f);
  }
});

void test('foreign original Weather and foreign Ready remain legal while another seat owes native Atomics', () => {
  const f = fixture({ effect: 'atomics', window: 'afterReveal' }); let game = bind(f).game;
  game = act(game, f.target, f.payment);
  game = settle(act(game, f.observer, { type: 'card', card: f.foreignCard, amount: 0 }));
  assert.equal(game.stormPending, 0); assert.equal(windowCardOpportunity(game, 'atomics')?.source, f.source);
  assert.deepEqual(receipt(game, f), { source: f.source, played: false, closed: false });
  assert.equal(game.discard.filter(card => card.id === f.foreignCard).length, 1);
  game = act(game, f.asker, { type: 'ready' }); game = act(game, f.observer, { type: 'ready' });
  assert.ok(game.ready.includes(f.asker) && game.ready.includes(f.observer));
  rejected(game, f.target, { type: 'ready' }); game = settle(act(game, f.target, f.nativeAction));
  assert.equal(game.shieldWallDestroyed, true); assert.equal(player(game, f.target).tanks, 2);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('an original first-blow No cannot forbid or count the actual held Harvester in the second Advanced blow', () => {
  const f = fixture({ effect: 'harvester', advanced: true });
  assert.equal(f.game.advanced, true); assert.equal(f.spiceOrder.length, 2);
  let game = bind(f, 'no', play('harvester', f.source)).game; rejected(game, f.target, f.nativeAction);
  game = close(game, f); const second = windowCardOpportunity(game, 'harvester'); assert.ok(second);
  assert.equal(game.phase, 1); assert.equal(game.turn, f.game.turn); assert.notEqual(second.source, f.source);
  assert.ok(game.spiceWindow?.event); assert.equal(second.source, game.spiceWindow.event);
  assert.equal(promise(game, f.target).fulfilled, true);
  const evidence = structuredClone(receipt(game, f)), amount = game.spiceWindow.amount;
  game = settle(act(game, f.target, f.nativeAction));
  assert.equal(game.spiceWindow?.amount, amount * 2); assert.equal(game.spiceWindow?.event, second.source);
  assert.deepEqual(receipt(game, f), evidence); assert.equal(receipt(game, f).played, false);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); physical(game, f);
});

void test('exact window-card guides retain native card packets and reject wrong raw sources, actors and stale events', () => {
  for (const effect of effects) {
    const f = fixture({ effect }), declared = declare(f);
    rejected(declared.game, f.asker, { type: 'truthAsk', question: { kind: 'turnActions', target: f.target,
      turn: f.game.turn, mixed: play(effect, `${f.source}:stale`) } });
    rejected(declared.game, f.observer, { type: 'truthAsk', question: f.question });
    let game = bind(f).game; game = act(game, f.target, f.payment);
    const row = promise(game, f.target), guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.card);
    if (effect === 'weather') assert.ok(Number.isSafeInteger(guide.action.amount) && Number(guide.action.amount) >= 0 && Number(guide.action.amount) <= 10);
    assert.equal(guide.event, row.event); assert.equal(guide.action.turnActionPromiseEvent, row.event);
    assert.equal(guide.action.turnActionPromisePhase, effect === 'harvester' ? 1 : 0);
    assert.ok(Object.keys(row).every(key => ['event', 'player', 'asker', 'turn', 'mixed', 'answer', 'fulfilled', 'released'].includes(key)));
    assert.deepEqual(viewGame(game, f.asker).turnActionPromises, []); assert.equal(viewGame(game, f.asker).turnActionGuide, null);
    rejected(game, f.observer, guide.action);
    rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-promise' });
    rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 5 });
    const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, packet));
    rejected(game, f.target, packet); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('an actually closed Storm or blow cannot be reused by a held printed card or raw old-source question', () => {
  for (const effect of effects) {
    const f = fixture({ effect }); let game = close(f.game, f);
    assert.ok(player(game, f.target).hand.some(card => card.id === f.card)); rejected(game, f.target, f.nativeAction);
    game = declare(f, game).game;
    rejected(game, f.asker, { type: 'truthAsk', question: f.question });
  }
});

void test('two genuine questions tag the Weather guide with its matching row while an earlier Hajr promise remains live', () => {
  const f = fixture({ effect: 'weather', pairedTruthAndHajr: true }); assert.ok(f.hajr);
  assert.deepEqual(player(f.afterSetup, f.asker).hand.map(card => card.id), [f.truth]);
  assert.deepEqual(player(f.afterSetup, f.target).hand.map(card => card.id), [f.card, f.hajr]);
  assert.deepEqual(player(f.afterSetup, f.observer).hand.map(card => card.id), [f.foreignCard]);
  assert.notEqual(f.truth, f.foreignCard); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.equal(f.sourceCounts.selected, f.sourceActions.length);
  const actions: TruthTurnWindowCardStep[] = structuredClone(f.sourceActions);
  const hajr: TruthTurnWindowCardExpression = { kind: 'action', action: { kind: 'cardPlay', effect: 'hajr' } };
  const firstMixed = group('and', hajr, payment(f.asker));
  let game = bind(f, 'yes', firstMixed, f.game, actions).game;
  const firstEvent = game.turnActionPromises![0].event;
  const secondFixture = { ...f, asker: f.observer, truth: f.foreignCard };
  const weather = play('weather', f.source);
  game = bind(secondFixture, 'yes', weather, game, actions).game;
  assert.equal(game.turnActionPromises!.length, 2);
  const secondEvent = game.turnActionPromises![1].event; assert.notEqual(firstEvent, secondEvent);
  const paying = viewGame(game, f.target).turnActionGuide; assert.ok(paying);
  assert.equal(paying.event, firstEvent); assert.equal(paying.action.type, 'bribe');
  assert.equal(paying.action.target, f.asker); assert.equal(paying.action.amount, 2);
  game = act(game, f.target, paying.action, actions);
  assert.equal(player(game, f.asker).bribes, 2);
  assert.ok(!game.turnActionPromises![0].fulfilled); assert.equal(game.turnActionPromises![0].cardPlays?.hajr?.played, false);
  const view = viewGame(game, f.target), guide = view.turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.card);
  assert.equal(guide.event, secondEvent); assert.equal(guide.action.turnActionPromiseEvent, secondEvent);
  assert.equal(guide.action.turnActionPromisePhase, 0);
  const matching = view.turnActionPromises.find(row => row.event === guide.event); assert.ok(matching);
  assert.deepEqual(matching.mixed, weather);
  assert.deepEqual(view.turnActionPromises.find(row => row.event === firstEvent)?.mixed, firstMixed);
  const packet: Action = JSON.parse(JSON.stringify(guide.action));
  game = settle(act(game, f.target, packet, actions), actions);
  assert.equal(game.turnActionPromises![1].fulfilled, true); assert.equal(game.turnActionPromises![1].windowCards?.weather?.played, true);
  assert.ok(!game.turnActionPromises![0].fulfilled);
  game = advance(game, state => state.turnActionPromises!.every(row => row.fulfilled), actions);
  assert.equal(game.phase, 5); assert.equal(game.active, f.target);
  assert.equal(game.turnActionPromises![0].cardPlays?.hajr?.played, true);
  assert.ok(game.turnActionPromises!.every(row => row.fulfilled));
  assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'card' && step.action.card === f.hajr));
  assert.equal(game.discard.filter(card => card.id === f.foreignCard).length, 1);
  assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  assert.ok(actions.length > f.sourceActionCount); physical(game, f);
});

void test('minimal profiles honor No Harvester with native Ready and do not reopen an accepted blow', () => {
  const f = fixture({ effect: 'harvester' });
  for (const difficulty of DIFFICULTIES) {
    const game = bind(f, 'no', play(f.effect, f.source)).game;
    const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    const guide = view.turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, 'ready');
    const action = botActions(view)[0]; assert.deepEqual(action, guide.action);
    const ready = act(game, f.target, action); assert.ok(ready.ready.includes(f.target));
    assert.equal(receipt(ready, f).played, false);
    // Controlled public bot view only: move one of its original counters to
    // the fresh territory so ordinary automatic Harvester would be tempting.
    // The real played Game and its original army remain unchanged.
    const accepted = viewGame(ready, f.target), me = accepted.players.find(candidate => candidate.id === f.target)!;
    me.bot = difficulty; me.forces = { ...me.forces, 'carthag:11': me.forces['carthag:11'] - 1,
      [`${f.originalBlow!.territory}:${f.originalBlow!.sector}`]: 1 };
    assert.ok(!botActions(accepted).some(candidate => candidate.type === 'card' && candidate.card === f.card));
    const completed = close(ready, f); assert.equal(promise(completed, f.target).fulfilled, true); physical(completed, f);
  }
});

void test('all four minimal profiles answer and execute actual named-window printed guides through payment fulfillment', () => {
  for (const effect of effects) {
    const f = fixture({ effect }), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthTurnWindowCardStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, difficulty);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 28 && !promise(game, f.target).fulfilled; count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        const guide = view.turnActionGuide;
        if (guide) {
          const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.event);
          assert.ok(action, `${effect}/${difficulty}`); assert.deepEqual(action, guide.action);
          game = act(game, f.target, action, actions);
        } else {
          const next = nativeStep(game); assert.ok(next, `${effect}/${difficulty}`);
          game = act(game, next.actor, next.action, actions);
        }
      }
      assert.equal(promise(game, f.target).fulfilled, true, `${effect}/${difficulty}`);
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'card' && step.action.card === f.card));
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'bribe')); physical(game, f);
    }
  }
});
