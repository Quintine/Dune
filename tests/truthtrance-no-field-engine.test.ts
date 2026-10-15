import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { NoFieldValue } from '../game/richese-no-field';
import type { TruthFact } from '../game/truthtrance';
import {
  applyNoFieldFullPlanStep, finishNoFieldFullPlanBattle,
} from './fixture-no-field-full-plan';
import { noFieldFullPlanOccupyFixture } from './fixture-no-field-full-plan-occupy';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import {
  askNoFieldTruth, createTruthtranceNoFieldFixture, declareNoFieldTruthtrance,
  finishNoFieldTruth, noFieldTruthFact, noFieldTruthObservation, passNoFieldTruthPriority,
  rejectNoFieldTruthAction, stageNoFieldTruthtrance, truthtranceNoFieldCards,
  truthtranceNoFieldPlayer,
} from './fixture-truthtrance-no-field';

const VALUES: NoFieldValue[] = [0, 3, 5];

for (const advanced of [false, true]) {
  for (const marker of VALUES) {
    void test(`${advanced ? 'Advanced' : 'Basic'} native Truthtrance reads deployed printed ${marker} without touching its token or forces`, () => {
      const fixture = createTruthtranceNoFieldFixture({ advanced, marker });
      const { game, owner, asker, token } = fixture;
      const original = truthtranceNoFieldPlayer(game, owner);
      assert.equal(original.noField!.deployed!.tokenId, token.id);
      for (const value of VALUES) {
        const waiting = askNoFieldTruth(game, asker, owner, noFieldTruthFact(value));
        const expected = marker === value ? 'yes' : 'no';
        assert.deepEqual(noFieldTruthObservation(waiting), noFieldTruthObservation(game));
        for (const actor of game.players.map(player => player.id)) {
          const view = viewGame(waiting, actor);
          assert.equal(view.truthAnswer, actor === owner ? expected : null);
          if (actor !== owner) {
            assert.equal(view.richeseNoField!.private, null);
            assert.deepEqual(view.richeseNoField!.public, viewGame(game, actor).richeseNoField!.public);
            assert.equal(view.players.find(player => player.id === owner)!.hand, undefined);
          }
        }
        const done = finishNoFieldTruth(waiting, expected);
        assert.equal(done.discard.filter(card => card.id === fixture.truthCard.id).length, 1);
        for (const actor of done.players.map(player => player.id)) {
          assert.deepEqual(viewGame(done, actor).truthHistory.at(-1), done.truthHistory!.at(-1));
          assert.equal(viewGame(done, actor).truthAnswer, null);
        }
      }
    });
  }

  for (const reserves of [2, 0]) {
    void test(`${advanced ? 'Advanced' : 'Basic'} printed five remains five with ${reserves} physical reserves`, () => {
      const fixture = createTruthtranceNoFieldFixture({ advanced, marker: 5, reserves });
      const { game, asker, owner } = fixture;
      assert.equal(truthtranceNoFieldPlayer(game, owner).reserves, reserves);
      for (const value of [5, 0] as const) {
        const waiting = askNoFieldTruth(game, asker, owner, noFieldTruthFact(value));
        finishNoFieldTruth(waiting, value === 5 ? 'yes' : 'no');
      }
      const observed = finishNoFieldTruth(askNoFieldTruth(game, asker, owner, noFieldTruthFact(5)), 'yes');
      const history = structuredClone(observed.truthHistory);
      const before = truthtranceNoFieldPlayer(observed, owner);
      const exposed = applyAction(observed, owner, {
        type: 'revealNoField', event: before.noFieldEvent, token: fixture.token.id,
      });
      const after = truthtranceNoFieldPlayer(exposed, owner);
      assert.equal(after.noField!.deployed, null);
      assert.equal(after.noField!.lastShipped, fixture.token.id);
      assert.deepEqual(after.noField!.tokens, before.noField!.tokens);
      assert.notEqual(after.noFieldEvent, before.noFieldEvent);
      assert.equal(after.reserves, 0);
      assert.equal(after.forces[fixture.harass!.location] ?? 0, reserves);
      assert.deepEqual(exposed.truthHistory, history);
      assert.equal(viewGame(exposed, asker).richeseNoField!.public.lastUsed, 5);
      assert.deepEqual(truthtranceNoFieldCards(exposed), truthtranceNoFieldCards(observed));
    });
  }

  void test(`${advanced ? 'Advanced' : 'Basic'} absent, never-shipped and already-revealed markers answer No, not zero or Unknown`, () => {
    const fixture = createTruthtranceNoFieldFixture({ advanced, marker: 3, boundary: 'beforeShipment' });
    const { game, asker, owner, opponent } = fixture;
    assert.equal(truthtranceNoFieldPlayer(game, owner).noField!.deployed, null);
    assert.equal(truthtranceNoFieldPlayer(game, owner).noField!.lastShipped, null);
    assert.equal(truthtranceNoFieldPlayer(game, opponent).noField, undefined);
    for (const target of [owner, opponent])
      for (const value of VALUES)
        finishNoFieldTruth(askNoFieldTruth(game, asker, target, noFieldTruthFact(value)), 'no');

    // The original planned shipment remains executable, with its original token/event.
    const done = finishNoFieldTruth(askNoFieldTruth(game, asker, owner, noFieldTruthFact(3)), 'no');
    const shipment = fixture.harass!.shipmentStep;
    let shipped = applyAction(done, shipment.actor, shipment.action);
    // Advanced still owns its original Guild interception before physical deployment.
    for (let count = 0; (shipped.response || shipped.phaseOpening || shipped.decision) && count < 40; count++) {
      const step = nextRicheseStrongholdsNativeStep(shipped);
      assert.ok(step);
      shipped = applyAction(shipped, step.actor, step.action);
    }
    assert.equal(shipped.decision, null);
    assert.equal(truthtranceNoFieldPlayer(shipped, owner).noField!.deployed!.tokenId, fixture.token.id);
    assert.equal(shipped.response, null);
    const concealed = truthtranceNoFieldPlayer(shipped, owner);
    const revealed = applyAction(shipped, owner, {
      type: 'revealNoField', event: concealed.noFieldEvent, token: fixture.token.id,
    });
    assert.equal(truthtranceNoFieldPlayer(revealed, owner).noField!.deployed, null);
    assert.equal(truthtranceNoFieldPlayer(revealed, owner).noField!.lastShipped, fixture.token.id);
    assert.equal(viewGame(revealed, asker).richeseNoField!.public.lastUsed, 3);
    stageNoFieldTruthtrance(revealed, asker, fixture.staging);
    for (const value of VALUES)
      finishNoFieldTruth(askNoFieldTruth(revealed, asker, owner, noFieldTruthFact(value)), 'no');
  });
}

void test('a nonowner respondent cannot borrow the concealed token from their Richese ally', () => {
  const fixture = noFieldFullPlanOccupyFixture({ lead: 'ecaz', marker: 5, richeseReserves: 2 });
  const { game, richese: owner, ecaz: ally, atreides: asker } = fixture;
  assert.equal(truthtranceNoFieldPlayer(game, owner).ally, ally);
  assert.equal(truthtranceNoFieldPlayer(game, ally).ally, owner);
  stageNoFieldTruthtrance(game, asker, fixture.staging);
  assert.equal(truthtranceNoFieldPlayer(game, ally).noField, undefined);
  for (const value of [0, 5] as const) {
    const waiting = askNoFieldTruth(game, asker, ally, noFieldTruthFact(value));
    assert.equal(viewGame(waiting, ally).truthAnswer, 'no');
    finishNoFieldTruth(waiting, 'no');
  }
  finishNoFieldTruth(askNoFieldTruth(game, asker, owner, noFieldTruthFact(5)), 'yes');
});

void test('dishonest and Unknown answers retain the original current fact and parent opportunity until the truthful public answer', () => {
  for (const boundary of ['beforeShipment', 'afterShipment'] as const) {
    const fixture = createTruthtranceNoFieldFixture({ marker: 0, boundary });
    const { game, owner, asker } = fixture;
    const waiting = askNoFieldTruth(game, asker, owner, noFieldTruthFact(0));
    const expected = boundary === 'beforeShipment' ? 'no' : 'yes';
    rejectNoFieldTruthAction(waiting, owner, { type: 'truthAnswer', answer: expected === 'yes' ? 'no' : 'yes' });
    rejectNoFieldTruthAction(waiting, owner, { type: 'truthAnswer', answer: 'unknown' });
    rejectNoFieldTruthAction(waiting, owner, { type: 'truthSave' });
    const native = fixture.harass!;
    rejectNoFieldTruthAction(waiting, native.shipmentStep.actor, native.shipmentStep.action);
    assert.equal(waiting.truthtrance!.stage, 'answer');
    assert.equal(waiting.truthHistory?.length ?? 0, 0);
    assert.ok(truthtranceNoFieldPlayer(waiting, asker).hand.some(card => card.id === fixture.truthCard.id));
    const done = finishNoFieldTruth(waiting, expected);
    if (boundary === 'beforeShipment') {
      const shipped = applyAction(done, native.shipmentStep.actor, native.shipmentStep.action);
      assert.equal(truthtranceNoFieldPlayer(shipped, owner).noField!.deployed!.tokenId, fixture.token.id);
    } else {
      const player = truthtranceNoFieldPlayer(done, owner);
      const revealed = applyAction(done, owner, { type: 'revealNoField', event: player.noFieldEvent, token: fixture.token.id });
      assert.equal(truthtranceNoFieldPlayer(revealed, owner).noField!.deployed, null);
    }
  }
});

void test('invalid denomination and extra private selection fields cannot replace the live asking opportunity', () => {
  const fixture = createTruthtranceNoFieldFixture({ marker: 3 });
  const waiting = passNoFieldTruthPriority(declareNoFieldTruthtrance(fixture.game, fixture.asker));
  for (const fact of [
    { kind: 'noFieldValue', value: '3' },
    { kind: 'noFieldValue', value: 1 },
    { kind: 'noFieldValue', value: 3, token: fixture.token.id },
  ]) {
    rejectNoFieldTruthAction(waiting, fixture.asker, {
      type: 'truthAsk', question: { kind: 'fact', target: fixture.owner, fact },
    });
  }
  finishNoFieldTruth(askNoFieldTruth(waiting, fixture.asker, fixture.owner, noFieldTruthFact(3)), 'yes');
});

void test('AND/OR publish only the aggregate answer, never matching leaves or physical No-Field identity', () => {
  const fixture = createTruthtranceNoFieldFixture({ advanced: true, marker: 5, reserves: 0 });
  const { game, owner, asker } = fixture;
  const rows: { fact: TruthFact; answer: 'yes' | 'no' }[] = [
    { fact: { kind: 'or', terms: [noFieldTruthFact(0), noFieldTruthFact(3)] }, answer: 'no' },
    { fact: { kind: 'or', terms: [noFieldTruthFact(3), noFieldTruthFact(5)] }, answer: 'yes' },
    { fact: { kind: 'and', terms: [noFieldTruthFact(5), { kind: 'spice', compare: 'gte', value: 0 }] }, answer: 'yes' },
    { fact: { kind: 'and', terms: [noFieldTruthFact(5), noFieldTruthFact(0)] }, answer: 'no' },
  ];
  for (const { fact, answer } of rows) {
    const waiting = askNoFieldTruth(game, asker, owner, fact);
    assert.equal(viewGame(waiting, owner).truthAnswer, answer);
    for (const other of game.players.filter(player => player.id !== owner)) {
      const view = viewGame(waiting, other.id);
      assert.equal(view.truthAnswer, null);
      assert.deepEqual(view.truthHistory, []);
      assert.equal(view.richeseNoField!.private, null);
      assert.deepEqual(view.richeseNoField!.public, viewGame(game, other.id).richeseNoField!.public);
      assert.equal(view.players.find(player => player.id === owner)!.hand, undefined);
    }
    const done = finishNoFieldTruth(waiting, answer);
    const receipt = done.truthHistory!.at(-1)!;
    assert.deepEqual(receipt.question, { kind: 'fact', target: owner, fact });
    assert.equal(JSON.stringify(receipt).includes(fixture.token.id), false);
    for (const actor of done.players.map(player => player.id)) {
      assert.deepEqual(viewGame(done, actor).truthHistory, [receipt]);
      if (actor !== owner) {
        assert.equal(viewGame(done, actor).richeseNoField!.private, null);
        assert.deepEqual(viewGame(done, actor).richeseNoField!.public, viewGame(game, actor).richeseNoField!.public);
      }
    }
  }
});

void test('a native full-plan offer survives the fact interrupt and later genuine battle changes custody without rewriting the answer', () => {
  const fixture = createTruthtranceNoFieldFixture({ advanced: true, marker: 5, reserves: 2, boundary: 'fullPlanOffer' });
  const native = fixture.fullPlan!;
  const { game, owner, asker } = fixture;
  assert.equal(game.decision?.kind, 'fullPlanOffer');
  assert.equal(truthtranceNoFieldPlayer(game, asker).hand.length, 4);
  const waiting = askNoFieldTruth(game, asker, owner, noFieldTruthFact(5));
  rejectNoFieldTruthAction(waiting, native.declineStep.actor, native.declineStep.action);
  const answered = finishNoFieldTruth(waiting, 'yes');
  assert.deepEqual(answered.decision, game.decision);
  assert.deepEqual(answered.battle, game.battle);
  const history = structuredClone(answered.truthHistory);
  let continued = applyNoFieldFullPlanStep(answered, native.declineStep);
  assert.equal(continued.decision, null);
  for (const step of native.planActions) continued = applyNoFieldFullPlanStep(continued, step);
  assert.equal(continued.battle!.revealed, true);
  const exposed = truthtranceNoFieldPlayer(continued, owner);
  const original = truthtranceNoFieldPlayer(game, owner);
  assert.equal(exposed.noField!.deployed, null);
  assert.equal(exposed.noField!.lastShipped, fixture.token.id);
  assert.deepEqual(exposed.noField!.tokens, original.noField!.tokens);
  assert.notEqual(exposed.noFieldEvent, original.noFieldEvent);
  assert.equal(exposed.reserves, 0);
  assert.equal(exposed.forces[native.location], 2);
  assert.deepEqual(continued.truthHistory, history);
  const done = finishNoFieldFullPlanBattle(continued);
  assert.equal(done.battle, null);
  assert.deepEqual(done.truthHistory, history);
  assert.equal(truthtranceNoFieldPlayer(done, owner).noField!.deployed, null);
  assert.deepEqual(truthtranceNoFieldCards(done), truthtranceNoFieldCards(game));
  assert.equal(done.discard.filter(card => card.id === fixture.truthCard.id).length, 1);
});

void test('all four bot profiles pass real priority and reply legally using only their private aggregate truthAnswer', () => {
  const fixture = createTruthtranceNoFieldFixture({ advanced: true, marker: 5, reserves: 0 });
  const { game, owner, asker, opponent } = fixture;
  for (const difficulty of DIFFICULTIES) {
    let current = declareNoFieldTruthtrance(game, asker);
    const priorityView = viewGame(current, owner);
    priorityView.players.find(player => player.id === owner)!.bot = difficulty;
    const priority = botActions(priorityView).find(action => action.type === 'truthPass');
    assert.ok(priority);
    current = applyAction(current, owner, priority);
    current = passNoFieldTruthPriority(current);
    for (const value of [5, 0] as const) {
      const pending = askNoFieldTruth(current, asker, owner, noFieldTruthFact(value));
      const view = viewGame(pending, owner);
      view.players.find(player => player.id === owner)!.bot = difficulty;
      const replies = botActions(view);
      assert.equal(view.truthAnswer, value === 5 ? 'yes' : 'no');
      const reply = replies.find(action => action.type === 'truthAnswer');
      assert.ok(reply);
      const otherView = viewGame(pending, opponent);
      otherView.players.find(player => player.id === opponent)!.bot = difficulty;
      assert.ok(botActions(otherView).every(action => action.type !== 'truthAnswer'));
      const replied = applyAction(pending, owner, reply);
      assert.equal(replied.truthHistory?.at(-1)?.answer, value === 5 ? 'yes' : 'no');
      assert.equal(replied.truthtrance, null);
      assert.deepEqual(noFieldTruthObservation(replied), noFieldTruthObservation(game));
      assert.deepEqual(truthtranceNoFieldCards(replied), truthtranceNoFieldCards(game));
      assert.equal(replied.discard.filter(card => card.id === fixture.truthCard.id).length, 1);
    }
  }
});
