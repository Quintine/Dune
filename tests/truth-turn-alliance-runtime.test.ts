import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actTruthTurnAlliance as act, advanceTruthTurnAlliance as advance, answerTruthTurnAlliance as answer,
  askTruthTurnAlliance as ask, bindTruthTurnAlliance as bind, closeTruthTurnAllianceNexus as close,
  createTruthTurnAllianceFixture as fixture, declareTruthTurnAlliance as declare,
  finishTruthTurnAlliance as finish, nextTruthTurnAllianceNative as nativeStep,
  settleTruthTurnAlliance as settle, truthTurnAllianceClean as clean, truthTurnAllianceFact as fact,
  truthTurnAllianceGroup as group, truthTurnAllianceInventory as inventory, truthTurnAllianceNexus as nexus,
  truthTurnAlliancePartner as partner, truthTurnAlliancePayment as payment, truthTurnAlliancePlayer as player,
  truthTurnAlliancePromise as promise, truthTurnAllianceShip as ship, type TruthTurnAllianceFixture, type TruthTurnAllianceStep,
} from './fixture-truth-turn-alliance';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthTurnAllianceFixture) {
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.truths[1]));
  assert.deepEqual(inventory(game), f.originalCards);
}

void test('native combined alliance sources retain the original Worm, actual invitations and two physically dealt Truths', () => {
  for (const secondOffer of [false, true]) {
    const f = fixture({ secondOffer }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.equal(f.setup.deck.filter(card => card.effect === 'truthtrance').length, 2);
    assert.deepEqual(player(f.afterSetup, f.asker).hand.map(card => card.id), f.truths);
    assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
    assert.ok(nexus(f.game)); assert.equal(f.game.turn, 2); assert.deepEqual(f.staging, []);
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceActionCount, f.actions.length);
    assert.equal(f.sourceCounts.selected, f.sourceActionCount);
    assert.equal(f.sourceCounts.inherited + Number(secondOffer), f.sourceActionCount);
    assert.equal(f.game.allianceOffers[f.partner], f.target);
    if (secondOffer) assert.equal(f.game.allianceOffers[f.asker], f.target);
    assert.equal(player(f.game, f.target).ally, null); assert.equal(player(f.game, f.target).spice, 10);
    assert.equal(f.target, 'emperor'); assert.equal(f.partner, 'atreides'); assert.equal(f.recipient, 'harkonnen');
    assert.equal(player(f.game, f.target).reserves, 20); assert.deepEqual(player(f.game, f.target).forces, {});
    assert.equal(f.game.turnActionPromises?.length ?? 0, 0); assert.deepEqual(inventory(f.game), f.originalCards);
  }
});

void test('native AND combines final original Nexus membership, a real third-seat payment and later paid reserve shipment', () => {
  const f = fixture(), actions: TruthTurnAllianceStep[] = [];
  let game = bind(f, 'yes', f.mixed, f.game, 0, actions).game;
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, f.payment, actions);
  assert.equal(player(game, f.target).spice, 8); assert.equal(player(game, f.recipient).bribes, 2);
  game = act(game, f.target, f.allianceAction, actions);
  assert.equal(player(game, f.target).ally, f.partner); assert.equal(player(game, f.partner).ally, f.target);
  assert.equal(game.turnActionPromises![0].alliance?.closed, false);
  assert.equal(game.turnActionPromises![0].alliance?.partner, null);
  assert.ok(!promise(game, f.target).fulfilled);
  game = act(game, f.target, { type: 'ready' }, actions); assert.ok(game.ready.includes(f.target));
  assert.equal(game.turnActionPromises![0].alliance?.closed, false, 'Own Ready is not the original Nexus closing event');
  game = close(game, actions);
  assert.equal(game.turnActionPromises![0].alliance?.closed, true);
  assert.equal(game.turnActionPromises![0].alliance?.partner, f.partner);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target).released);
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), actions);
  rejected(game, f.target, { type: 'endMovement' });
  game = settle(act(game, f.target, f.shipment, actions), actions);
  assert.equal(player(game, f.target).spice, 6); assert.equal(player(game, f.target).reserves, 19);
  assert.equal(player(game, f.target).forces['polar_sink:0'], 1);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native final-partner OR payment retains both manual routes without counting temporary membership', () => {
  const f = fixture(), mixed = group('or', partner(f.partner), payment(f.recipient)), bound = bind(f, 'yes', mixed).game;
  let allied = act(bound, f.target, f.allianceAction);
  assert.ok(!promise(allied, f.target).fulfilled); assert.equal(gameAlliance(allied), null);
  allied = close(allied); assert.equal(promise(allied, f.target).fulfilled, true);
  assert.equal(player(allied, f.target).ally, f.partner); assert.equal(player(allied, f.recipient).bribes, 0);
  let paid = act(bound, f.target, f.payment);
  assert.equal(promise(paid, f.target).fulfilled, true); assert.equal(player(paid, f.target).ally, null);
  paid = close(paid); assert.equal(player(paid, f.target).ally, null);
  for (const state of [allied, paid]) { assert.deepEqual(promise(state, f.target).mixed, mixed); physical(state, f); }
});
function gameAlliance(game: Game) { return game.turnActionPromises![0].alliance?.partner; }

void test('native whole AND No permits an actually paid temporary pair and its later break before final closure', () => {
  const f = fixture(), mixed = group('and', partner(f.partner), payment(f.recipient));
  let game = bind(f, 'no', mixed).game;
  game = act(game, f.target, f.payment); game = act(game, f.target, f.allianceAction);
  assert.equal(player(game, f.target).ally, f.partner); assert.ok(!promise(game, f.target).fulfilled);
  assert.equal(game.turnActionPromises![0].alliance?.closed, false); rejected(game, f.target, { type: 'ready' });
  game = act(game, f.target, f.breakAction); game = close(game);
  assert.equal(game.turnActionPromises![0].alliance?.closed, true);
  assert.equal(game.turnActionPromises![0].alliance?.partner, null); assert.ok(!promise(game, f.target).released);
  game = advance(game, state => state.phase === 8 && clean(state), [], true);
  game = act(game, f.target, { ...f.payment, amount: 3 });
  assert.ok(!promise(game, f.target).released); game = finish(game);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

void test('native final unpaired Nexus outcome leaves a payment OR available through actual late Mentat', () => {
  const f = fixture(), mixed = group('or', partner(f.partner), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game; game = close(game, [], true);
  assert.equal(player(game, f.target).ally, null);
  assert.equal(game.turnActionPromises![0].alliance?.closed, true);
  assert.equal(game.turnActionPromises![0].alliance?.partner, null);
  assert.ok(!promise(game, f.target).fulfilled); assert.ok(!promise(game, f.target).released);
  game = advance(game, state => state.phase === 8 && clean(state), [], true);
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, f.payment);
  assert.equal(promise(game, f.target).fulfilled, true); physical(game, f);
});

for (const consent of ['offered', 'allied'] as const)
  void test(`native foreign ${consent === 'offered' ? 'invitation withdrawal' : 'actual departure'} releases a required final partnership without inventing renewed consent`, () => {
    const f = fixture({ consent }); let game = bind(f).game;
    game = act(game, f.partner, { type: 'alliance', target: null });
    assert.equal(player(game, f.target).ally, null); assert.equal(promise(game, f.target).released, true);
    assert.ok(!promise(game, f.target).fulfilled);
    const released = structuredClone(game.turnActionPromises![0]);
    game = act(game, f.partner, { type: 'alliance', target: f.target });
    assert.equal(promise(game, f.target).released, true); assert.deepEqual(game.turnActionPromises![0], released);
    game = act(game, f.target, f.allianceAction); game = close(game);
    assert.equal(promise(game, f.target).released, true); assert.ok(!promise(game, f.target).fulfilled); physical(game, f);
  });

void test('native foreign invitation withdrawal preserves a funded payment OR and never supplies an assumed alliance', () => {
  const f = fixture(), mixed = group('or', partner(f.partner), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game;
  game = act(game, f.partner, { type: 'alliance', target: null });
  assert.equal(player(game, f.target).ally, null); assert.ok(!promise(game, f.target).released);
  game = act(game, f.target, f.payment); assert.equal(promise(game, f.target).fulfilled, true);
  game = close(game); assert.equal(player(game, f.target).ally, null); physical(game, f);
});

void test('native missing reciprocal consent never permits a definite combined final-partner Yes or consumes the card at rejected answer', () => {
  const f = fixture({ consent: 'none' }), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no', 'unknown']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.deepEqual(asked.allianceOffers, {}); assert.equal(player(asked, f.target).ally, null);
  assert.equal(asked.turnActionPromises?.length ?? 0, 0);
  assert.equal(asked.discard.filter(card => card.id === f.truth).length, 0);
  assert.deepEqual(player(asked, f.asker).hand.map(card => card.id), f.truths);
  assert.deepEqual(inventory(asked), f.originalCards);
  let game = answer(asked, f.target, 'unknown'); assert.equal(game.truthtrance?.stage, 'unknown');
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 0);
  game = act(game, f.asker, { type: 'truthSave' }); assert.equal(game.truthtrance, null);
  assert.deepEqual(player(game, f.asker).hand.map(card => card.id), f.truths);
  assert.equal(game.turnActionPromises?.length ?? 0, 0); assert.equal(player(game, f.target).ally, null);
  assert.deepEqual(game.allianceOffers, {}); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native known unaffordable payment with existing real consent offers No rather than treating finance as unknown consent', () => {
  const f = fixture(), mixed = group('and', partner(f.partner), payment(f.recipient, 11));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.equal(asked.allianceOffers[f.partner], f.target); assert.equal(player(asked, f.target).spice, 10);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const game = answer(asked, f.target, 'no'); assert.equal(promise(game, f.target).answer, false); physical(game, f);
});

void test('native missing consent cannot conceal a known unaffordable whole payment branch as Unknown', () => {
  const f = fixture({ consent: 'none' }), mixed = group('and', partner(f.partner), payment(f.recipient, 11));
  const game = ask(declare(f).game, f.asker, f.target, mixed);
  assert.equal(player(game, f.target).spice, 10);
  assert.deepEqual(viewGame(game, f.target).truthTurnActionAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'unknown' });
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.ok(player(game, f.asker).hand.some(card => card.id === f.truth));
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native payment after own Nexus Ready uniformly reopens readiness and preserves a required later break', () => {
  const f = fixture({ consent: 'allied' }), mixed = group('and', partner(f.partner), payment(f.recipient));
  let game = bind(f, 'no', mixed).game;
  game = act(game, f.target, { type: 'ready' }); assert.ok(game.ready.includes(f.target));
  game = act(game, f.target, f.payment);
  assert.ok(!game.ready.includes(f.target)); assert.ok(!promise(game, f.target).released);
  rejected(game, f.target, { type: 'ready' });
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'alliance'); assert.equal(guide.action.target, null);
  game = act(game, f.target, guide.action); game = close(game);
  assert.equal(game.turnActionPromises![0].alliance?.closed, true);
  assert.equal(game.turnActionPromises![0].alliance?.partner, null); physical(game, f);
});

void test('native prospective alliance proposal preserves a still-owed ordinary payment before forming with its recipient', () => {
  const f = fixture({ consent: 'none' }), mixed = group('and', payment(f.partner), ship());
  let game = bind(f, 'yes', mixed).game;
  rejected(game, f.target, f.allianceAction);
  game = act(game, f.target, { ...f.payment, target: f.partner });
  assert.equal(player(game, f.target).spice, 8); assert.equal(player(game, f.partner).bribes, 2);
  game = act(game, f.target, f.allianceAction);
  game = act(game, f.partner, { type: 'alliance', target: f.target });
  assert.equal(player(game, f.target).ally, f.partner); assert.ok(!promise(game, f.target).released);
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state));
  game = settle(act(game, f.target, f.shipment));
  assert.equal(promise(game, f.target).fulfilled, true); assert.equal(player(game, f.target).spice, 6); physical(game, f);
});

for (const response of ['yes', 'no'] as const)
  void test(`native ${response} frozen-constant alliance history also reopens own Ready after an ordinary payment`, () => {
    const f = fixture(), mixed = response === 'yes'
      ? group('or', fact(f.spiceFact), partner(f.partner)) : group('and', fact(f.falseSpiceFact), partner(f.partner));
    let game = bind(f, response, mixed).game;
    assert.equal(promise(game, f.target).fulfilled, true);
    const receipt = structuredClone(game.turnActionPromises![0]);
    game = act(game, f.target, { type: 'ready' }); assert.ok(game.ready.includes(f.target));
    game = act(game, f.target, f.payment);
    assert.ok(!game.ready.includes(f.target)); assert.deepEqual(game.turnActionPromises![0], receipt);
    physical(game, f);
  });

void test('native definite final-alliance answers uniformly reopen only respondent Ready even for folded current-fact constants', () => {
  const f = fixture();
  for (const response of ['yes', 'no'] as const) {
    const mixed = response === 'yes' ? group('or', fact(f.spiceFact), partner(f.partner))
      : group('and', fact(f.falseSpiceFact), partner(f.partner));
    let game = act(f.game, f.target, { type: 'ready' }); game = act(game, f.partner, { type: 'ready' });
    assert.ok(game.ready.includes(f.target)); assert.ok(game.ready.includes(f.partner));
    game = bind(f, response, mixed, game).game;
    assert.ok(!game.ready.includes(f.target)); assert.ok(game.ready.includes(f.partner));
    assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(promise(game, f.target).mixed, mixed);
    physical(game, f);
  }
});

void test('native exact alliance and Ready guides retain current source phase owner and raw private history through actual closure', () => {
  const f = fixture(), mixed = group('and', partner(f.partner), payment(f.recipient));
  let game = bind(f, 'yes', mixed).game; game = act(game, f.target, f.payment);
  const row = promise(game, f.target), allowed = ['event', 'player', 'asker', 'turn', 'mixed', 'answer', 'fulfilled', 'released'];
  assert.ok(Object.keys(row).every(key => allowed.includes(key)));
  assert.deepEqual(viewGame(game, f.target).truthHistory.at(-1)?.question, { ...f.question, mixed });
  for (const actor of [f.asker, f.partner]) {
    assert.deepEqual(viewGame(game, actor).turnActionPromises, []); assert.equal(viewGame(game, actor).turnActionGuide, null);
  }
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'alliance'); assert.equal(guide.action.target, f.partner);
  assert.equal(guide.event, row.event); assert.equal(guide.action.turnActionPromiseEvent, row.event);
  assert.equal(guide.action.turnActionPromisePhase, 1);
  rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-combined-alliance-event' });
  rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 2 });
  rejected(game, f.target, { ...guide.action, target: f.asker });
  const wire: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, wire);
  assert.ok(!promise(game, f.target).fulfilled); rejected(game, f.target, wire);
  const ready = viewGame(game, f.target).turnActionGuide; assert.ok(ready);
  assert.equal(ready.action.type, 'ready'); assert.equal(ready.action.turnActionPromisePhase, 1);
  game = act(game, f.target, JSON.parse(JSON.stringify(ready.action)));
  assert.equal(game.turnActionPromises![0].alliance?.closed, false); assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, ready.action); game = close(game);
  assert.equal(promise(game, f.target).fulfilled, true); rejected(game, f.target, wire); physical(game, f);
});

void test('all four minimal profiles actually answer and complete combined original alliance payment Ready and later shipment guides', () => {
  const f = fixture(), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked); const actions: TruthTurnAllianceStep[] = [];
    const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
    const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, difficulty);
    assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
    for (let count = 0; count < 160 && !promise(game, f.target).fulfilled; count++) {
      const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const guide = view.turnActionGuide;
      if (guide) {
        const action = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.event);
        assert.ok(action, difficulty); assert.deepEqual(action, guide.action);
        game = settle(act(game, f.target, action, actions), actions);
      } else {
        const next = nativeStep(game); assert.ok(next, difficulty); game = act(game, next.actor, next.action, actions);
      }
    }
    assert.equal(promise(game, f.target).fulfilled, true, difficulty);
    assert.equal(player(game, f.target).ally, f.partner); assert.equal(player(game, f.target).spice, 6);
    for (const type of ['alliance', 'bribe', 'ready', 'ship'])
      assert.ok(actions.some(step => step.actor === f.target && step.action.type === type), `${difficulty}: ${type}`);
    physical(game, f);
  }
});
