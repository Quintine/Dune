import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { windowCardOpportunity } from '../game/window-card-play';
import {
  actTruthTurnKaramaShipment as act, advanceTruthTurnKaramaShipment as advance,
  answerTruthTurnKaramaShipment as answer, askTruthTurnKaramaShipment as ask,
  bindTruthTurnKaramaShipment as bind, closeTruthTurnKaramaShipment as close,
  createTruthTurnKaramaShipmentFixture as fixture, declareTruthTurnKaramaShipment as declare,
  finishTruthTurnKaramaShipment as finish, nextTruthTurnKaramaShipmentNative as nativeStep,
  settleTruthTurnKaramaShipment as settle, truthTurnKaramaShipmentClean as clean,
  truthTurnKaramaShipmentFact as fact, truthTurnKaramaShipmentGroup as group,
  truthTurnKaramaShipmentInventory as inventory, truthTurnKaramaShipmentPayment as payment,
  truthTurnKaramaShipmentPlay as play, truthTurnKaramaShipmentPlayer as player,
  truthTurnKaramaShipmentPromise as promise, truthTurnKaramaShipmentShip as ship,
  truthTurnKaramaShipmentTraitors as traitors,
  type TruthTurnKaramaShipmentFixture, type TruthTurnKaramaShipmentStep,
} from './fixture-truth-turn-karama-shipment';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTurnKaramaShipmentFixture, copies: 1 | 2 = 1) {
  for (const truth of f.truths.slice(0, copies)) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
}
function receipt(game: Game, index = 0) {
  const stage = game.turnActionPromises![index].windowCards?.karamaShipment; assert.ok(stage); return stage;
}
const armies = (game: Game) => game.players.map(candidate => ({ id: candidate.id, forces: candidate.forces,
  reserves: candidate.reserves, tanks: candidate.tanks, elites: candidate.elites }));

void test('shipment-price sources keep original dealt Truths and Karama through actual all-pass and Movement prefixes', () => {
  for (const advanced of [false, true]) for (const beneficiary of ['own', 'foreign'] as const) {
    const f = fixture({ advanced, beneficiary }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.equal(f.setup.deck.length, 33); assert.equal(f.originalCards.length, 33); assert.equal(f.originalTraitors.length, 15);
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
    assert.deepEqual(player(f.game, f.target).hand.map(card => card.id), [f.karama]);
    assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.beneficiary); assert.equal(f.game.advanced, advanced);
    assert.equal(player(f.game, f.target).spice, 10); assert.equal(player(f.game, f.beneficiary).shipped, false);
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceCounts.selected, f.sourceActions.length);
    assert.equal(f.sourceCounts.inherited, f.base.sourceActionCount);
    assert.equal(f.sourceCounts.nativeContinuation, f.sourceActions.length - f.base.sourceActionCount);
    assert.equal(f.sourceCounts.actualAuctionClose, f.auctionClose.steps.length);
    assert.ok(f.sourceActions.some(step => step.actor === f.target && step.action.type === 'passBid'));
    assert.deepEqual(windowCardOpportunity(f.game, 'karamaShipment'), f.opportunity);
    assert.equal(f.source, JSON.stringify(['karamaShipment', 1, f.beneficiary, 'original']));
    const own = viewGame(f.game, f.target); assert.deepEqual(own.karamaShipmentCards, [f.karama]);
    assert.ok(own.karamaShipmentWindows.some(window => window.source === f.source && window.recipient === f.beneficiary));
    assert.deepEqual(viewGame(f.game, f.asker).karamaShipmentCards, []);
    assert.equal(f.game.turnActionPromises?.length ?? 0, 0);
    assert.deepEqual(inventory(f.game), f.originalCards); assert.deepEqual(traitors(f.game), f.originalTraitors);
  }
});

void test('actual self or foreign printed price grant fulfills independently of spice, movement and delivery', () => {
  for (const beneficiary of ['own', 'foreign'] as const) {
    const f = fixture({ beneficiary }); let game = bind(f, 'yes', play(f.source)).game;
    const beforeArmies = structuredClone(armies(game)), purses = game.players.map(candidate => candidate.spice);
    assert.deepEqual(receipt(game), { source: f.source, played: false, closed: false });
    game = settle(act(game, f.target, f.grant));
    assert.equal(game.karamaShipping?.owner, f.target); assert.equal(game.karamaShipping?.player, f.beneficiary);
    assert.equal(game.karamaShipping?.card, f.karama); assert.equal(receipt(game).played, true);
    assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(armies(game), beforeArmies);
    assert.deepEqual(game.players.map(candidate => candidate.spice), purses);
    assert.equal(player(game, f.beneficiary).shipped, false); assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    game = act(game, f.beneficiary, f.endMovement);
    assert.equal(game.karamaShipping, null); assert.deepEqual(armies(game), beforeArmies);
    assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('real own and foreign shipments pay the native half-price bank tariff after the printed cost', () => {
  for (const beneficiary of ['own', 'foreign'] as const) {
    const f = fixture({ beneficiary }); let game = bind(f, 'yes', play(f.source)).game;
    game = settle(act(game, f.target, f.grant)); const purse = player(game, f.beneficiary).spice;
    const reserves = player(game, f.beneficiary).reserves;
    game = settle(act(game, f.beneficiary, f.shipment));
    assert.equal(player(game, f.beneficiary).spice, purse - 1);
    assert.equal(player(game, f.beneficiary).reserves, reserves - 1);
    assert.equal(player(game, f.beneficiary).forces['polar_sink:0'], 1);
    assert.equal(player(game, f.beneficiary).shipped, true); assert.equal(game.karamaShipping, null);
    assert.equal(promise(game, f.target).fulfilled, true); assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    physical(game, f);
  }
});

void test('printed price AND actual shipment AND payment share the exact funded purse while facts freeze before payment', () => {
  const f = fixture(), mixed = group('and', fact(f.spiceFact), play(f.source), ship(), payment(f.recipient, 9));
  let game = bind(f, 'yes', mixed).game;
  game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 9 });
  assert.equal(player(game, f.target).spice, 1); assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  game = settle(act(game, f.target, f.grant)); assert.ok(!promise(game, f.target).fulfilled);
  game = settle(act(game, f.target, f.shipment));
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.recipient).bribes, 9);
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(receipt(game).played, true);
  assert.equal(player(game, f.target).forces['polar_sink:0'], 1); physical(game, f);
});

void test('printed shipment funding reserves the half-price fee from the actual beneficiary rather than a foreign card giver', () => {
  const own = fixture(), unaffordable = group('and', play(own.source), ship(), payment(own.recipient, 10));
  const asked = ask(declare(own).game, own.asker, own.target, unaffordable);
  assert.deepEqual(viewGame(asked, own.target).truthTurnActionAnswers, ['no']);
  rejected(asked, own.target, { type: 'truthAnswer', answer: 'yes' });
  const foreign = fixture({ beneficiary: 'foreign' });
  const mixed = group('and', play(foreign.source), payment(foreign.recipient, 10));
  let game = bind(foreign, 'yes', mixed).game;
  const beneficiaryPurse = player(game, foreign.beneficiary).spice;
  game = act(game, foreign.target, { type: 'bribe', target: foreign.recipient, amount: 10 });
  assert.equal(player(game, foreign.target).spice, 0);
  assert.equal(player(game, foreign.beneficiary).spice, beneficiaryPurse, 'The actual bribe receipt remains deferred');
  game = settle(act(game, foreign.target, foreign.grant));
  assert.equal(promise(game, foreign.target).fulfilled, true); assert.ok(!promise(game, foreign.target).released);
  game = settle(act(game, foreign.beneficiary, foreign.shipment));
  assert.equal(player(game, foreign.target).spice, 0);
  assert.equal(player(game, foreign.beneficiary).spice, beneficiaryPurse - 1);
  assert.equal(player(game, foreign.beneficiary).forces['polar_sink:0'], 1);
  assert.equal(game.discard.filter(card => card.id === foreign.karama).length, 1);
  assert.equal(promise(game, foreign.target).fulfilled, true); assert.ok(!promise(game, foreign.target).released);
  physical(game, foreign);
});

void test('whole price OR payment Yes preserves the manual grant route and payment route for either current beneficiary', () => {
  for (const beneficiary of ['own', 'foreign'] as const) {
    const f = fixture({ beneficiary }), mixed = group('or', play(f.source), payment(f.recipient));
    const bound = bind(f, 'yes', mixed).game;
    const granted = settle(act(bound, f.target, f.grant));
    assert.equal(promise(granted, f.target).fulfilled, true); assert.equal(player(granted, f.recipient).bribes, 0);
    let paid = act(bound, f.target, f.payment); paid = act(paid, f.beneficiary, f.endMovement);
    assert.equal(promise(paid, f.target).fulfilled, true); assert.equal(receipt(paid).played, false);
    assert.ok(player(paid, f.target).hand.some(card => card.id === f.karama)); physical(granted, f); physical(paid, f);
  }
});

void test('whole price AND payment No preserves either earlier action and rejects the real completing grant or payment', () => {
  const f = fixture();
  for (const first of ['payment', 'grant'] as const) {
    let game = bind(f, 'no').game;
    if (first === 'payment') {
      game = act(game, f.target, f.payment); rejected(game, f.target, f.grant);
    } else {
      game = settle(act(game, f.target, f.grant)); rejected(game, f.target, f.payment);
      game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
      rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
    }
    assert.ok(!promise(game, f.target).released); game = finish(game);
    assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('whole price OR payment No keeps the actual cumulative payment cap after the beneficiary closes the source', () => {
  for (const beneficiary of ['own', 'foreign'] as const) {
    const f = fixture({ beneficiary }), mixed = group('or', play(f.source), payment(f.recipient));
    let game = bind(f, 'no', mixed).game; rejected(game, f.target, f.grant); rejected(game, f.target, f.payment);
    game = act(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 }); game = close(game, f);
    assert.deepEqual(receipt(game), { source: f.source, played: false, closed: true });
    rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
    assert.ok(!promise(game, f.target).released); game = finish(game);
    assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('own shipment or Movement end cannot evade a required printed price while the original path remains feasible', () => {
  const f = fixture(); let game = bind(f, 'yes', play(f.source)).game;
  rejected(game, f.target, f.shipment); rejected(game, f.target, f.endMovement);
  assert.equal(player(game, f.target).spice, 10); assert.equal(player(game, f.target).shipped, false);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.karama));
  game = settle(act(game, f.target, f.grant)); game = act(game, f.target, f.endMovement);
  assert.equal(player(game, f.target).forces['polar_sink:0'] ?? 0, 0);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('whole No price AND shipment checks the prospective physical shipment before closing its price source', () => {
  const f = fixture(), mixed = group('and', play(f.source), ship());
  let granted = bind(f, 'no', mixed).game; granted = settle(act(granted, f.target, f.grant));
  rejected(granted, f.target, f.shipment); assert.equal(player(granted, f.target).spice, 10);
  assert.equal(player(granted, f.target).forces['polar_sink:0'] ?? 0, 0);
  granted = act(granted, f.target, f.endMovement); granted = finish(granted);
  assert.equal(promise(granted, f.target).fulfilled, true); assert.equal(receipt(granted).played, true); physical(granted, f);
  let shipped = bind(f, 'no', mixed).game; shipped = settle(act(shipped, f.target, f.shipment));
  assert.equal(player(shipped, f.target).spice, 8); assert.equal(receipt(shipped).played, false);
  assert.ok(player(shipped, f.target).hand.some(card => card.id === f.karama));
  shipped = finish(shipped); assert.equal(promise(shipped, f.target).fulfilled, true); physical(shipped, f);
});

void test('foreign shipment or end stays legal and releases only that source before a second genuine own-beneficiary question', () => {
  const f = fixture({ beneficiary: 'foreign' });
  for (const action of [f.shipment, f.endMovement]) {
    const actions: TruthTurnKaramaShipmentStep[] = [];
    let game = bind(f, 'yes', play(f.source), f.game, 0, actions).game;
    game = settle(act(game, f.beneficiary, action, actions), actions);
    assert.equal(promise(game, f.target).released, true); assert.equal(receipt(game).played, false);
    assert.equal(receipt(game).closed, true); assert.ok(player(game, f.target).hand.some(card => card.id === f.karama));
    const earlier = structuredClone(receipt(game));
    game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), actions, true);
    const own = windowCardOpportunity(game, 'karamaShipment'); assert.ok(own?.effect === 'karamaShipment');
    assert.equal(own.recipient, f.target); assert.notEqual(own.source, f.source);
    game = bind(f, 'yes', play(own.source), game, 1, actions).game;
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
    assert.equal(guide.action.target, f.target); assert.equal(guide.event, game.turnActionPromises![1].event);
    game = settle(act(game, f.target, guide.action, actions), actions);
    assert.equal(game.turnActionPromises![1].fulfilled, true); assert.equal(receipt(game, 1).played, true);
    assert.deepEqual(receipt(game), earlier); assert.equal(game.turnActionPromises![0].released, true);
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1); physical(game, f, 2);
  }
});

void test('a foreign closed price OR remains payable late even after the same actual Karama prices the own shipment instead', () => {
  const f = fixture({ beneficiary: 'foreign' }), mixed = group('or', play(f.source), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game; game = act(game, f.beneficiary, f.endMovement);
  assert.deepEqual(receipt(game), { source: f.source, played: false, closed: true });
  assert.ok(!promise(game, f.target).released); const evidence = structuredClone(receipt(game));
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), [], true);
  game = settle(act(game, f.target, f.ownGrant)); game = settle(act(game, f.target, f.shipment));
  assert.equal(player(game, f.target).spice, 9); assert.deepEqual(receipt(game), evidence);
  assert.ok(!promise(game, f.target).fulfilled); game = advance(game, state => state.phase === 8 && clean(state), [], true);
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, f.payment);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(receipt(game), evidence); physical(game, f);
});

void test('a real prior auction cost never counts as future printed Karama shipment spending', () => {
  const f = fixture({ priorAuctionSpend: true }); assert.ok(f.auctionCost);
  assert.equal(f.sourceCounts.actualPriorAuctionCost, f.auctionCost.steps.length);
  assert.ok(f.auctionCost.steps.some(step => step.actor === f.target && step.action.type === 'card' && step.action.mode === 'purchase'));
  assert.equal(f.game.discard.filter(card => card.id === f.karama).length, 1);
  assert.ok(player(f.game, f.target).hand.some(card => card.id === f.base.lotCard));
  const asked = ask(declare(f).game, f.asker, f.target, play(f.source));
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']); rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'no'); assert.equal(receipt(game).played, false);
  game = close(game, f); assert.equal(receipt(game).played, false); assert.equal(promise(game, f.target).fulfilled, true);
  physical(game, f);
});

void test('printed shipment guides carry exact beneficiary source and event while cards remain viewer-owned', () => {
  for (const beneficiary of ['own', 'foreign'] as const) {
    const f = fixture({ beneficiary }), declared = declare(f);
    for (const source of [JSON.stringify(['karamaShipment', f.game.turn + 1, f.beneficiary, 'original']),
      JSON.stringify(['karamaShipment', f.game.turn, 'absent-beneficiary', 'original']),
      JSON.stringify(['karamaShipment', f.game.turn, f.beneficiary, 'cunning', 'invented-event'])])
      rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, mixed: play(source) } });
    rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, mixed: { kind: 'action', action: {
      kind: 'windowCardPlay', effect: 'karamaShipment', source: f.source, recipient: f.beneficiary,
    } } } });
    let game = bind(f).game; game = act(game, f.target, f.payment);
    const own = viewGame(game, f.target), guide = own.turnActionGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.karama);
    assert.equal(guide.action.mode, 'shipment'); assert.equal(guide.action.target, f.beneficiary);
    assert.equal(guide.event, promise(game, f.target).event); assert.equal(guide.action.turnActionPromiseEvent, guide.event);
    assert.equal(guide.action.turnActionPromisePhase, 5); assert.deepEqual(own.karamaShipmentCards, [f.karama]);
    assert.deepEqual(viewGame(game, f.asker).karamaShipmentCards, []);
    assert.ok(Object.keys(promise(game, f.target)).every(key => ['event', 'player', 'asker', 'turn', 'mixed', 'answer', 'fulfilled', 'released'].includes(key)));
    rejected(game, f.asker, guide.action); rejected(game, f.target, { ...guide.action, target: f.observer });
    rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-price-event' });
    rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 3 });
    const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, packet));
    rejected(game, f.target, packet); assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
  }
});

void test('all four minimal profiles execute native printed shipment-price guides for own and foreign beneficiaries', () => {
  for (const beneficiary of ['own', 'foreign'] as const) {
    const f = fixture({ beneficiary }), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthTurnKaramaShipmentStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, difficulty);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 20 && !promise(game, f.target).fulfilled; count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        const guide = view.turnActionGuide;
        if (guide) {
          const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.event);
          assert.ok(action, `${beneficiary}/${difficulty}`); assert.deepEqual(action, guide.action);
          game = act(game, f.target, action, actions);
        } else {
          const next = nativeStep(game); assert.ok(next, `${beneficiary}/${difficulty}`);
          game = act(game, next.actor, next.action, actions);
        }
      }
      assert.equal(promise(game, f.target).fulfilled, true, `${beneficiary}/${difficulty}`);
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'bribe'));
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === 'card' && step.action.card === f.karama &&
        step.action.mode === 'shipment' && step.action.target === f.beneficiary));
      game = settle(game); physical(game, f);
    }
  }
});
