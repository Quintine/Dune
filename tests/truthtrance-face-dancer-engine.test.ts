import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { truthFactAnswer, truthQuestionText, type TruthFact, type TruthQuestion } from '../game/truthtrance';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import {
  createTruthtranceFaceDancerFixture as fixture,
  actTruthFaceDancer as act,
  truthFaceDancerPlayer as player,
  truthFaceDancerInventory as inventory,
  truthFaceDancerTraitors as traitors,
  truthFaceDancerClean as clean,
  advanceTruthFaceDancer as advance,
  openTruthtranceFaceDancer as open,
  askTruthFaceDancer as ask,
  answerTruthFaceDancer as answer,
  replaceTruthtranceFaceDancer as replace,
} from './fixture-truthtrance-face-dancer';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
const frame = (g: Game) => structuredClone({ phase: g.phase, turn: g.turn, active: g.active,
  ready: g.ready, order: g.order, decision: g.decision, response: g.response,
  phaseOpening: g.phaseOpening, movementRemaining: g.movementRemaining,
  shipmentPromises: g.shipmentPromises, movementPromises: g.movementPromises });

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} native Face Dancer fact answers from the actual deal and resumes the same parent`, () => {
    const f = fixture({ advanced });
    const original = frame(f.game), cards = structuredClone(player(f.game, f.respondent).faceDancers);
    assert.equal(cards?.length, 3);
    assert.ok(cards?.some(card => card.leader === f.held && !card.revealed));
    let g = ask(f.game, f);
    assert.equal(g.truthtrance?.stage, 'answer');
    assert.equal(viewGame(g, f.respondent).truthAnswer, 'yes');
    for (const actor of [f.asker, f.observer]) {
      const view = viewGame(g, actor);
      assert.equal(view.truthAnswer, null);
      assert.equal(view.players.find(p => p.id === f.respondent)!.faceDancers, undefined);
      assert.deepEqual(view.truthHistory, []);
    }
    rejected(g, f.respondent, { type: 'truthAnswer', answer: 'no' });
    rejected(g, f.respondent, { type: 'truthAnswer', answer: 'unknown' });
    rejected(g, f.observer, { type: 'truthAnswer', answer: 'yes' });
    g = answer(g, f, 'yes');
    assert.deepEqual(frame(g), original);
    assert.deepEqual(player(g, f.respondent).faceDancers, cards);
    assert.equal(g.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(g, f.asker).hand.some(card => card.id === f.card), false);
    assert.deepEqual(inventory(g), f.originalInventory);
    assert.deepEqual(traitors(g), f.originalTraitors);
    for (const actor of [f.asker, f.respondent, f.observer]) {
      const history = viewGame(g, actor).truthHistory;
      assert.equal(history.length, 1);
      assert.equal(history[0].answer, 'yes');
      assert.deepEqual(history[0].question, f.action.question);
    }
    rejected(g, f.respondent, { type: 'truthAnswer', answer: 'yes' });
  });
}

void test('a current canonical unheld identity is a definite No, while an ordinary Traitor question stays distinct', () => {
  const f = fixture();
  const g = ask(f.game, f, f.unheld);
  assert.equal(viewGame(g, f.respondent).truthAnswer, 'no');
  rejected(g, f.respondent, { type: 'truthAnswer', answer: 'yes' });
  assert.equal(viewGame(answer(g, f, 'no'), f.observer).truthHistory[0].answer, 'no');
  const ordinary: TruthQuestion = { kind: 'fact', target: f.respondent,
    fact: { kind: 'traitor', leader: f.held } };
  const different = act(open(f.game, f), f.asker, { type: 'truthAsk', question: ordinary });
  assert.equal(viewGame(different, f.respondent).truthAnswer, 'no');
  assert.equal(truthFactAnswer(player(f.game, f.respondent), { kind: 'faceDancer', leader: f.held }), 'yes');
  const hero = ask(f.game, f, f.hero);
  assert.equal(viewGame(hero, f.respondent).truthAnswer, f.cheapHeroHeld ? 'yes' : 'no');
});

void test('nested AND/OR publishes only its aggregate answer without exposing individual Face Dancer matches', () => {
  const f = fixture({ advanced: true });
  const fact: TruthFact = { kind: 'and', terms: [
    { kind: 'or', terms: [{ kind: 'faceDancer', leader: f.unheld }, { kind: 'faceDancer', leader: f.held }] },
    { kind: 'spice', compare: 'gte', value: 0 },
  ] };
  const question: TruthQuestion = { kind: 'fact', target: f.respondent, fact };
  const g = act(open(f.game, f), f.asker, { type: 'truthAsk', question });
  assert.equal(viewGame(g, f.respondent).truthAnswer, 'yes');
  const done = answer(g, f, 'yes');
  for (const actor of [f.asker, f.observer]) {
    const view = viewGame(done, actor);
    assert.deepEqual(view.truthHistory[0].question, question);
    assert.equal(view.truthHistory[0].answer, 'yes');
    assert.equal(view.truthAnswer, null);
    assert.equal(view.players.find(p => p.id === f.respondent)!.faceDancers, undefined);
    assert.deepEqual(Object.keys(view.truthHistory[0]).sort(), ['answer', 'asker', 'phase', 'question', 'turn']);
  }
  const text = truthQuestionText(question, id => viewGame(g, f.asker).allLeaders.find(l => l.id === id)!.name, id => id);
  assert.match(text, /unrevealed Face Dancer/);
  assert.match(text, / OR /);
  assert.match(text, / AND /);
});

void test('an actual Mentat replacement is allowed after Yes and leaves its historical fact unchanged', () => {
  const f = fixture();
  const answered = answer(ask(f.game, f), f, 'yes');
  const history = structuredClone(viewGame(answered, f.observer).truthHistory);
  const replacement = replace(answered, f);
  assert.equal(replacement.old, f.held);
  assert.notEqual(replacement.new, replacement.old);
  assert.equal(truthFactAnswer(player(replacement.game, f.respondent), { kind: 'faceDancer', leader: f.held }), 'no');
  assert.equal(truthFactAnswer(player(replacement.game, f.respondent), { kind: 'faceDancer', leader: replacement.new }), 'yes');
  assert.deepEqual(viewGame(replacement.game, f.observer).truthHistory, history);
  assert.equal(replacement.game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(traitors(replacement.game), f.originalTraitors);
});

void test('the fact does not bypass existing mixed-shipment mode limits and remains usable as a standalone question', () => {
  const f = fixture();
  const source = advance(f.game, g => g.phase === 5 && g.active === f.respondent && clean(g));
  assert.equal(viewGame(source, f.asker).truthShipmentTargets.includes(f.respondent), false);
  const question: TruthQuestion = { kind: 'mixedShipment', target: f.respondent, mixed: {
    kind: 'or', terms: [
      { kind: 'fact', fact: { kind: 'faceDancer', leader: f.held } },
      { kind: 'shipment', territory: 'arrakeen', minimum: 1 },
    ],
  } };
  const ready = open(source, f);
  rejected(ready, f.asker, { type: 'truthAsk', question });
  const pending = ask(ready, f);
  assert.equal(viewGame(pending, f.respondent).truthAnswer, 'yes');
  const done = answer(pending, f, 'yes');
  assert.equal(done.shipmentPromises, undefined);
  assert.equal(done.active, source.active);
});

for (const leader of ['old', 'new'] as const) {
  void test(`a genuine replaced-first ${leader} identity uses current custody at a fresh question`, () => {
    const f = fixture({ advanced: true, replaced: true });
    const identity = f[leader]; assert.ok(identity);
    const g = ask(f.game, f, identity);
    const expected = leader === 'old' ? 'no' : 'yes';
    assert.equal(viewGame(g, f.respondent).truthAnswer, expected);
    const done = answer(g, f, expected);
    assert.equal(viewGame(done, f.asker).truthHistory[0].answer, expected);
    assert.equal(done.phase, 8);
  });
}

void test('invalid or shared Duke identities and extra status fields reject before changing the physical question', () => {
  const f = fixture();
  const ready = open(f.game, f);
  for (const fact of [
    { kind: 'faceDancer', leader: DUKE_VIDAL_ID },
    { kind: 'faceDancer', leader: 'missing-disc' },
    { kind: 'faceDancer', leader: f.held, revealed: false },
  ]) rejected(ready, f.asker, { type: 'truthAsk', question: { kind: 'fact', target: f.respondent, fact } });
  assert.ok(player(ready, f.asker).hand.some(card => card.id === f.card));
  assert.equal(ready.discard.some(card => card.id === f.card), false);
});

for (const profile of DIFFICULTIES) {
  void test(`${profile} answers the same actual current Face Dancer facts without strategy or hidden rival access`, () => {
    for (const advanced of [false, true]) {
      const f = fixture({ advanced });
      for (const [identity, expected] of [[f.held, 'yes'], [f.unheld, 'no']] as const) {
        const g = ask(f.game, f, identity);
        const view = viewGame(g, f.respondent);
        view.players.find(p => p.id === f.respondent)!.bot = profile;
        const proposed = botActions(view);
        assert.deepEqual(proposed, [{ type: 'truthAnswer', answer: expected }]);
        const done = act(g, f.respondent, proposed[0]);
        assert.equal(done.truthtrance, null);
        assert.equal(viewGame(done, f.observer).truthHistory[0].answer, expected);
      }
    }
  });
}
