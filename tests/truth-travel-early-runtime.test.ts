import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer, type TruthFact } from '../game/truthtrance';
import {
  actTruthTravelEarly as act, advanceTruthTravelEarly as advance,
  askTruthTravelEarly as ask, bindTruthTravelEarly as bind,
  completeTruthTravelEarly as complete, createTruthTravelEarlyFixture as fixture,
  declareTruthTravelEarly as declare, finishTruthTravelEarly as finish,
  reachTruthTravelEarlyMovement as reach, settleTruthTravelEarly as settle,
  truthTravelEarlyClean as clean, truthTravelEarlyInventory as inventory,
  truthTravelEarlyPlayer as player, truthTravelEarlyPromise as promise,
  truthTravelFact as fact, truthTravelGroup as group, truthTravelMove as move,
  truthTravelShip as ship, type TruthTravelEarlyStep,
} from './fixture-truth-travel-early';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
const pending = (game: Game, target: string) => game.travelPromises!.find(row => row.player === target)!;
function guide(game: Game, target: string) {
  const next = viewGame(game, target).travelPromiseGuide; assert.ok(next);
  assert.equal(next.event, promise(game, target).event);
  assert.equal(next.action.travelPromiseEvent, next.event);
  assert.equal(next.action.travelPromisePhase, game.phase);
  return next;
}
function finishPaidRoute(f: ReturnType<typeof fixture>, source: Game, actions: TruthTravelEarlyStep[] = []) {
  let game = reach(f, source, actions);
  const spice = player(game, f.target).spice;
  rejected(game, f.target, f.currentEnd);
  game = settle(act(game, f.target, f.shipmentAction, actions), actions);
  assert.equal(player(game, f.target).spice, spice - f.shipmentCost);
  assert.deepEqual(pending(game, f.target).progress, []);
  assert.ok(!promise(game, f.target).fulfilled);
  game = settle(act(game, f.target, f.firstMove, actions), actions);
  assert.equal(promise(game, f.target).fulfilled, true);
  assert.ok(!promise(game, f.target).released);
  game = finish(f, game, actions); assert.deepEqual(inventory(game), f.originalCards);
  return game;
}

void test('native early travel source records only original setup and phase actions with no installed future event', () => {
  for (const source of ['classic', 'hajr', 'native', 'revival'] as const) {
    const f = fixture({ source });
    assert.equal(f.sourceActionCount, f.actions.length);
    assert.equal(f.sourceCounts.selected, f.sourceActions.length);
    assert.equal(f.sourceCounts.priorShipments,
      f.actions.filter(step => step.actor === f.target && step.action.type === 'ship').length);
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.equal(f.game.phase, 2); assert.equal(f.game.truthtrance ?? null, null);
    assert.equal(f.game.travelPromises?.length ?? 0, 0);
    assert.deepEqual(inventory(f.game), f.originalCards);
    if (source === 'hajr') {
      assert.equal(f.sourceActionCount, 13);
      assert.deepEqual(f.sourceActions, f.hajrSource!.sourceActions);
      assert.equal(player(f.game, f.target).hand.find(card => card.id === f.hajr)?.effect, 'hajr');
      assert.deepEqual(player(f.game, f.target).forces, { 'arrakeen:10': 10 });
    }
    if (source === 'classic' || source === 'native') {
      assert.equal(player(f.game, f.target).spice, 10);
      assert.equal(player(f.game, f.target).reserves, 20);
      assert.deepEqual(player(f.game, f.target).forces, {});
    }
    if (source === 'revival') {
      assert.equal(f.sourceCounts.priorShipments, 1);
      assert.equal(player(f.game, f.target).tanks, 3);
      assert.equal(player(f.game, f.target).spice, 4);
      assert.deepEqual(f.revivalSource!.base.shipment.steps[0].action, f.revivalSource!.base.shipmentAction);
    }
  }
});

void test('native Storm Spice Charity Bidding and Revival travel Yes all retain one future paid shipment and distinct ground event', () => {
  for (const phase of [0, 1, 2, 3, 4] as const) {
    const f = fixture({ phase }), actions: TruthTravelEarlyStep[] = [];
    let game = bind(f, 'yes', f.mixed, f.game, actions).game;
    assert.equal(game.phase, phase); assert.equal(pending(game, f.target).shipment.pending, true);
    assert.equal(pending(game, f.target).shipment.event, null);
    assert.deepEqual(pending(game, f.target).progress, []);
    assert.ok(!promise(game, f.target).fulfilled);
    rejected(game, f.target, f.shipmentAction); rejected(game, f.target, f.firstMove);
    const early = viewGame(game, f.target).travelPromiseGuide;
    assert.ok(!early || !['ship', 'move', 'endMovement'].includes(early.action.type));
    game = finishPaidRoute(f, game, actions);
    assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
    assert.ok((phase < 4 ? actions : f.actions).some(step => step.actor === f.target && step.action.type === 'passBid'));
  }
});

void test('native concurrent Charity readiness reopens after either definite whole travel answer', () => {
  const f = fixture();
  const ready = act(f.game, f.target, { type: 'ready' }); assert.ok(ready.ready.includes(f.target));
  for (const answer of ['yes', 'no'] as const) {
    const game = bind(f, answer, f.mixed, ready).game;
    assert.equal(game.ready.includes(f.target), false);
    const next = viewGame(game, f.target).travelPromiseGuide;
    if (next) { assert.equal(guide(game, f.target).action.type, 'ready'); }
    assert.equal(pending(game, f.target).shipment.pending, true);
    assert.ok(!promise(game, f.target).fulfilled);
    assert.ok(act(game, f.target, next?.action ?? { type: 'ready' }).ready.includes(f.target));
  }
});

void test('native current-phase guide has exact event and phase authority through Charity bid invoice and Revival', () => {
  const f = fixture({ source: 'revival', phase: 2, targetKarama: true }); let game = bind(f).game;
  const initialSpice = player(game, f.target).spice;
  const charity = guide(game, f.target); assert.equal(charity.action.type, 'ready');
  rejected(game, f.asker, charity.action);
  rejected(game, f.target, { ...charity.action, travelPromiseEvent: 'stale-travel-answer' });
  rejected(game, f.target, { ...charity.action, travelPromisePhase: 3 });
  game = act(game, f.target, charity.action);
  rejected(game, f.target, charity.action);
  game = advance(game, state => state.phase === 3 && clean(state) && state.auction?.active === f.target);
  const pass = guide(game, f.target); assert.equal(pass.action.type, 'passBid');
  rejected(game, f.target, charity.action);
  game = act(game, f.target, { type: 'bid', amount: 2, allyPayment: 0 });
  const purchased = game.auction!.cards[game.auction!.index].id;
  game = advance(game, state => !state.response && !state.phaseOpening &&
    state.decision?.kind === 'auctionPayment' && state.decision.player === f.target);
  const invoice = guide(game, f.target); assert.equal(invoice.action.type, 'decision');
  assert.equal(invoice.action.karama, false);
  rejected(game, f.target, { ...invoice.action, karama: true });
  game = act(game, f.target, JSON.parse(JSON.stringify(invoice.action)) as Action);
  game = advance(game, state => state.phase === 4 && clean(state));
  assert.equal(player(game, f.target).spice, initialSpice - 2);
  assert.ok(player(game, f.target).hand.some(card => card.id === purchased));
  const revival = guide(game, f.target); assert.equal(revival.action.type, 'ready');
  rejected(game, f.target, invoice.action);
  finishPaidRoute(f, game);
});

void test('native early voluntary bribe and excess bid cannot consume the last original eight-spice paid route', () => {
  const f = fixture(); let game = bind(f).game;
  rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 3 });
  game = advance(game, state => state.phase === 3 && clean(state) && state.auction?.active === f.target);
  rejected(game, f.target, { type: 'bid', amount: 3, allyPayment: 0 });
  game = act(game, f.target, { type: 'bid', amount: 2, allyPayment: 0 });
  game = advance(game, state => state.phase === 4 && clean(state));
  assert.equal(player(game, f.target).spice, 8);
  finishPaidRoute(f, game);
});

void test('native standing bid reserves its unpaid invoice before offering an early travel Yes', () => {
  const f = fixture({ phase: 3 });
  for (const amount of [2, 3]) {
    let game = advance(f.game, state => clean(state) && state.auction?.active === f.target);
    game = act(game, f.target, { type: 'bid', amount, allyPayment: 0 });
    const asked = ask(f, game);
    assert.equal(viewGame(asked.game, f.target).truthTravelAnswers?.includes('yes'), amount === 2);
    assert.equal(player(asked.game, f.target).spice, 10, 'The standing bid has not paid its real invoice');
    if (amount === 3) rejected(asked.game, f.target, { type: 'truthAnswer', answer: 'yes' });
  }
});

void test('native whole No to AND survives all early preparation and the matching shipment until actual own end', () => {
  const f = fixture(); let game = bind(f, 'no').game;
  assert.ok(!promise(game, f.target).fulfilled);
  game = reach(f, game);
  assert.ok(!promise(game, f.target).fulfilled);
  game = settle(act(game, f.target, f.shipmentAction));
  assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, f.firstMove);
  game = finish(f, game); assert.equal(promise(game, f.target).fulfilled, true);
  assert.ok(!promise(game, f.target).released); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native early OR retains both manual routes without choosing a branch at answer time', () => {
  const f = fixture({ source: 'hajr' }), mixed = group('or', ship(), move());
  const bound = bind(f, 'yes', mixed).game;
  for (const action of [f.shipmentAction, f.firstMove]) {
    let game = reach(f, bound); assert.ok(!promise(game, f.target).fulfilled);
    game = settle(act(game, f.target, action));
    assert.equal(promise(game, f.target).fulfilled, true);
    assert.deepEqual(promise(game, f.target).mixed, mixed);
    game = finish(f, game); assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('native early Hajr travel freezes its current spice fact and later performs both original physical ground groups', () => {
  const f = fixture({ source: 'hajr' }), actions: TruthTravelEarlyStep[] = [];
  const spiceFact: TruthFact = { kind: 'spice', compare: 'gte', value: player(f.game, f.target).spice };
  const mixed = group('and', fact(spiceFact), ship(), move(), move('carthag'));
  let game = bind(f, 'yes', mixed, f.game, actions).game;
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 3 }, actions);
  assert.equal(truthFactAnswer(player(game, f.target), spiceFact), 'no');
  game = reach(f, game, actions);
  game = settle(act(game, f.target, f.shipmentAction, actions), actions);
  game = settle(act(game, f.target, f.firstMove, actions), actions);
  assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, f.currentEnd);
  const hajr = guide(game, f.target); assert.equal(hajr.action.type, 'card'); assert.equal(hajr.action.card, f.hajr);
  game = settle(act(game, f.target, hajr.action, actions), actions);
  game = settle(act(game, f.target, f.secondMove, actions), actions);
  assert.equal(player(game, f.target).moved, 2);
  assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(pending(game, f.target).progress,
    [{ territory: 'imperial_basin', maximum: 1 }, { territory: 'carthag', maximum: 1 }]);
  assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  assert.deepEqual(inventory(finish(f, game, actions)), f.originalCards);
});

void test('native early optional current facts settle constants without future receipts and reopen readiness uniformly', () => {
  const f = fixture({ source: 'hajr' });
  const held = f.setup.deck.find(card => card.id === f.hajr); assert.ok(held);
  const heldFact: TruthFact = { kind: 'hand', name: held.name };
  const projectile = f.setup.deck.find(card => card.kind === 'projectile'); assert.ok(projectile);
  const absentFact: TruthFact = { kind: 'hand', name: projectile.name };
  const ready = act(f.game, f.target, { type: 'ready' }); assert.ok(ready.ready.includes(f.target));
  for (const [mixed, answer] of [
    [group('or', fact(heldFact), ship(), move()), 'yes'],
    [group('and', fact(absentFact), ship(), move()), 'no'],
  ] as const) {
    const game = bind(f, answer, mixed, ready).game;
    assert.equal(promise(game, f.target).fulfilled, true);
    assert.equal(pending(game, f.target).shipment.event, null);
    assert.deepEqual(pending(game, f.target).progress, []);
    assert.equal(viewGame(game, f.target).travelPromiseGuide, null);
    assert.ok(!game.ready.includes(f.target));
  }
});

void test('native earned prior-turn shipment is not current travel progress and still leaves the next original shipment pending', () => {
  const f = fixture({ source: 'revival', phase: 1 });
  assert.equal(f.game.turn, 2); assert.equal(f.sourceCounts.priorShipments, 1);
  assert.equal(player(f.game, f.target).shipped, true,
    'This flag is earned by the recorded turn1 paid shipment, never installed');
  const actions: TruthTravelEarlyStep[] = []; let game = bind(f, 'yes', f.mixed, f.game, actions).game;
  assert.equal(pending(game, f.target).shipment.pending, true);
  assert.equal(pending(game, f.target).shipment.event, null);
  assert.deepEqual(pending(game, f.target).progress, []);
  assert.equal(viewGame(game, f.target).travelPromiseGuide, null);
  game = finishPaidRoute(f, game, actions);
  assert.equal(pending(game, f.target).shipment.event?.amount, 2);
  assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'ship'));
});

void test('native Charity poverty uses the original paid bribe and protects the two-spice route against Ready and paid Revival', () => {
  const f = fixture({ source: 'revival', phase: 2, poor: true });
  assert.equal(f.revivalSource!.funding?.steps[0].action.type, 'bribe');
  assert.equal(player(f.game, f.target).spice, 0); assert.equal(player(f.game, f.target).tanks, 3);
  let game = bind(f).game;
  rejected(game, f.target, { type: 'ready' });
  const charity = guide(game, f.target); assert.equal(charity.action.type, 'charity');
  game = act(game, f.target, charity.action); assert.equal(player(game, f.target).spice, 2);
  rejected(game, f.target, { type: 'bribe', target: f.asker, amount: 1 });
  game = advance(game, state => state.phase === 4 && clean(state));
  rejected(game, f.target, { type: 'revive', amount: 2, elite: 0 });
  game = settle(act(game, f.target, { type: 'revive', amount: 1, elite: 0 }));
  assert.equal(player(game, f.target).spice, 2); assert.equal(player(game, f.target).tanks, 2);
  finishPaidRoute(f, game);
});

void test('native Basic Revival readiness reopens while Advanced completed owned turns stay closed', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ source: 'revival', phase: 4, advanced });
    let game = f.game;
    if (advanced) game = advance(game, state => state.phase === 4 && clean(state) &&
      state.revivalOrder?.remaining[0] === f.target);
    game = act(game, f.target, { type: 'ready' });
    if (advanced) {
      assert.ok(!game.revivalOrder?.remaining.includes(f.target));
      const completed = structuredClone(game.revivalOrder);
      game = bind(f, 'yes', f.mixed, game).game;
      assert.deepEqual(game.revivalOrder, completed);
      assert.equal(viewGame(game, f.target).travelPromiseGuide, null);
      rejected(game, f.target, { type: 'revive', amount: 1, elite: 0 });
    } else {
      assert.ok(game.ready.includes(f.target)); game = bind(f, 'yes', f.mixed, game).game;
      assert.equal(game.ready.includes(f.target), false);
      assert.equal(guide(game, f.target).action.type, 'ready');
    }
    finishPaidRoute(f, game);
  }
});

void test('native Richese first and last Once Around or Silent controls keep the exact legal current auction guide', () => {
  for (const position of ['first', 'last'] as const) for (const method of ['onceAround', 'silent'] as const) {
    const f = fixture({ source: 'native' }), auction = { position, method };
    let game = advance(bind(f).game, state => state.phase === 3 && clean(state) && !!state.richeseAuction &&
      !state.richeseAuction.outcome && (method === 'silent'
        ? !Object.hasOwn(state.richeseAuction.sealed, f.target) : state.richeseAuction.active === f.target), [], auction);
    const next = guide(game, f.target);
    assert.equal(next.action.type, 'richeseBid'); assert.equal(next.action.event, game.richeseAuction!.event);
    assert.equal(next.action.amount, method === 'silent' ? 0 : null);
    game = act(game, f.target, next.action);
    assert.ok(!promise(game, f.target).released);
    assert.equal(viewGame(game, f.target).travelPromiseGuide, null);
    game = reach(f, game, [], auction); finishPaidRoute(f, game);
  }
});

void test('native E1 and E3 future travel answers survive their original setup and real independent phase controls', () => {
  for (const roster of ['ixians-tleilaxu', 'ecaz-moritani'] as const) {
    const f = fixture({ source: 'native', roster });
    const game = bind(f).game; assert.equal(guide(game, f.target).action.type, 'ready');
    finishPaidRoute(f, game);
  }
});

void test('controlled alliance-only escrow uses original forces funds and actual Harkonnen Karama then releases only at the foreign outcome', () => {
  for (const canceled of [false, true]) {
    const f = fixture(), source = structuredClone(f.game);
    // Only this alliance relation is controlled. Every card, counter and purse
    // is the source's original native one; no forecast or receipt is installed.
    player(source, f.target).ally = 'harkonnen'; player(source, 'harkonnen').ally = f.target;
    const mixed = group('and', ship('arrakeen', 8), move('imperial_basin', 8));
    let game = bind(f, 'yes', mixed, source).game;
    game = advance(game, state => state.phase === 3 && clean(state) && state.auction?.active === f.target);
    game = act(game, f.target, { type: 'pledgeAid', amount: 8 });
    game = advance(game, state => state.phase === 3 && clean(state) && state.auction?.active === 'harkonnen');
    game = act(game, 'harkonnen', { type: 'bid', amount: 3, allyPayment: 3 });
    assert.ok(!promise(game, f.target).released);
    game = advance(game, state => state.response?.kind === 'emperorIncome');
    assert.ok(!promise(game, f.target).released);
    if (canceled) {
      const karama = player(game, 'harkonnen').hand.find(card => card.effect === 'karama'); assert.ok(karama);
      game = act(game, 'harkonnen', { type: 'card', card: karama.id, mode: 'cancel' });
    }
    game = advance(game, state => state.phase === 4 && clean(state));
    assert.equal(player(game, f.target).spice, canceled ? 7 : 10);
    assert.equal(promise(game, f.target).released, canceled);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('all four minimal profiles answer an original Charity travel question and legally consume exact early and phase5 guides', () => {
  const f = fixture(), asked = ask(f).game;
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked); const actions: TruthTravelEarlyStep[] = [], phases = new Set<number>();
    const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    const answer = botActions(answering).find(action => action.type === 'truthAnswer'); assert.ok(answer, difficulty);
    assert.equal(answer.answer, 'yes'); game = settle(act(game, f.target, answer, actions), actions);
    for (let count = 0; count < 160 && !promise(game, f.target).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const current = view.travelPromiseGuide;
      if (current) {
        assert.equal(current.action.travelPromisePhase, game.phase); phases.add(game.phase);
        const before = structuredClone(view), action = botActions(view)
          .find(action => action.travelPromiseEvent === current.event);
        assert.ok(action, `${difficulty} phase${game.phase}`); assert.deepEqual(action, current.action);
        assert.deepEqual(view, before); game = settle(act(game, f.target, action, actions), actions);
      } else {
        const next = advance(game, state => !!viewGame(state, f.target).travelPromiseGuide ||
          !!promise(state, f.target).fulfilled, actions);
        assert.notEqual(next, game); game = next;
      }
    }
    assert.equal(promise(game, f.target).fulfilled, true, difficulty);
    assert.ok(phases.has(2) && phases.has(3) && phases.has(4) && phases.has(5), difficulty);
    assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'ship'));
    assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'move'));
    assert.deepEqual(inventory(finish(f, game, actions)), f.originalCards);
  }
});

void test('early authoring still rejects a stale turn and a target whose actual phase5 interval ended', () => {
  const f = fixture(), declared = declare(f);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  let game = reach(f, f.game); game = finish(f, game);
  const after = declare(f, game).game;
  assert.ok(!viewGame(after, f.asker).truthTravelTargets.includes(f.target));
  rejected(after, f.asker, f.questionAction);
  assert.ok(player(after, f.asker).hand.some(card => card.id === f.truth));
  assert.deepEqual(inventory(after), f.originalCards);
});

void test('native early exact guide completes through the unchanged original phase5 shipment movement and own-end boundary', () => {
  const f = fixture({ source: 'hajr' }), actions: TruthTravelEarlyStep[] = [];
  let game = bind(f, 'yes', f.mixed, f.game, actions).game;
  game = complete(f, game, actions);
  assert.equal(game.phase, 5); assert.equal(game.active, f.target);
  assert.equal(promise(game, f.target).fulfilled, true);
  const route = actions.filter(step => step.actor === f.target && ['ship', 'move'].includes(step.action.type));
  assert.deepEqual(route.map(step => step.action.type), ['ship', 'move']);
  assert.ok(route.every(step => step.action.travelPromisePhase === 5));
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(finish(f, game, actions)), f.originalCards);
});
