import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actTruthAlliance as act, answerTruthAlliance as answer, askTruthAlliance as ask, bindTruthAlliance as bind,
  closeTruthAllianceNexus as close, createTruthAllianceFixture as fixture, declareTruthAlliance as declare,
  finishTruthAlliance as finish, truthAllianceInventory as inventory, truthAllianceNexus as nexus, truthAlliancePlayer as player,
} from './fixture-truth-alliance';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
const promise = (game: Game, target: string) => game.alliancePromises!.find(promise => promise.player === target)!;

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} current Nexus Yes accepts real consent and fulfills only at actual alliance closure`, () => {
  const f = fixture({ advanced }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.game.turn, 2); assert.ok(nexus(f.game)); assert.equal(f.originalCards.length, 33);
  assert.deepEqual(f.staging, []); assert.equal(f.sourceActionCount, f.sourceActions.length);
  assert.equal(f.offer!.steps[0].actor, f.partner); assert.equal(f.game.allianceOffers[f.partner], f.target);
  assert.equal(player(f.game, f.target).ally, null);
  const before = structuredClone(f.game), bound = bind(f); assert.deepEqual(f.game, before);
  assert.equal(bound.game.discard.filter(card => card.id === f.truth).length, 1);
  assert.ok(!promise(bound.game, f.target).fulfilled); rejected(bound.game, f.target, { type: 'ready' });
  const guide = viewGame(bound.game, f.target).alliancePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'alliance'); assert.equal(guide.action.target, f.partner);
  let game = act(bound.game, f.target, guide.action);
  assert.equal(player(game, f.target).ally, f.partner); assert.equal(player(game, f.partner).ally, f.target);
  assert.ok(!promise(game, f.target).fulfilled, 'Actual acceptance is still provisional until this Nexus closes');
  game = close(game);
  assert.equal(game.nexus, false); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(player(game, f.target).ally, f.partner);
  assert.equal(viewGame(game, f.target).alliancePromiseNexus, null);
  game = finish(game); assert.equal(game.phase, 2); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native No for an existing reciprocal alliance breaks it before owned readiness and waits for closure', () => {
  const f = fixture({ consent: 'allied' }); let game = bind(f, 'no').game;
  assert.equal(player(game, f.target).ally, f.partner); rejected(game, f.target, { type: 'ready' });
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'alliance'); assert.equal(guide.action.target, null);
  game = act(game, f.target, guide.action);
  assert.equal(player(game, f.target).ally, null); assert.equal(player(game, f.partner).ally, null);
  assert.ok(!promise(game, f.target).fulfilled);
  game = close(game); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native final No permits an interim newly formed alliance but requires its own break before Ready', () => {
  const f = fixture({ consent: 'none' }); let game = bind(f, 'no').game;
  game = act(game, f.partner, { type: 'alliance', target: f.target });
  game = act(game, f.target, { type: 'alliance', target: f.partner });
  assert.equal(player(game, f.target).ally, f.partner); assert.ok(!promise(game, f.target).fulfilled);
  rejected(game, f.target, { type: 'ready' });
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide); game = act(game, f.target, guide.action);
  assert.equal(player(game, f.target).ally, null); game = close(game);
  assert.equal(promise(game, f.target).fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native absent foreign consent offers No or unknown without inventing an alliance and preserves the saved card', () => {
  const f = fixture({ consent: 'none' }), declared = declare(f);
  let game = ask(declared.game, f.asker, f.target, f.partner);
  assert.deepEqual(viewGame(game, f.target).truthAllianceAnswers, ['no', 'unknown']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(game, f.target, 'unknown'); assert.equal(game.truthtrance!.stage, 'unknown');
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 0);
  game = act(game, f.asker, { type: 'truthSave' });
  assert.equal(game.truthtrance, null); assert.equal(player(game, f.asker).hand.filter(card => card.effect === 'truthtrance').length, 2);
  assert.equal(game.alliancePromises?.length ?? 0, 0);
  game = act(game, f.partner, { type: 'alliance', target: f.target });
  game = bind(f, 'yes', f.partner, game).game; game = close(game);
  assert.equal(player(game, f.target).ally, f.partner); assert.equal(promise(game, f.target).fulfilled, true);
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native binding reopens the respondent own readiness and cannot finish with unmatched membership', () => {
  const f = fixture(); let game = act(f.game, f.target, { type: 'ready' });
  assert.ok(game.ready.includes(f.target)); game = bind(f, 'yes', f.partner, game).game;
  assert.ok(!game.ready.includes(f.target)); rejected(game, f.target, { type: 'ready' });
  game = close(game); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two physical Truth copies constrain the same final partner without settling at proposal or acceptance', () => {
  const f = fixture(), declared = declare(f, f.game, { copies: 2 });
  let game = ask(declared.game, f.asker, f.target, f.partner); game = answer(game, f.target, 'yes');
  game = ask(game, f.asker, f.target, f.partner);
  assert.deepEqual(viewGame(game, f.target).truthAllianceAnswers, ['yes']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'no' }); game = answer(game, f.target, 'yes');
  assert.equal(game.alliancePromises!.length, 2); assert.ok(game.alliancePromises!.every(promise => !promise.fulfilled));
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide); game = act(game, f.target, guide.action);
  assert.ok(game.alliancePromises!.every(promise => !promise.fulfilled)); game = close(game);
  assert.ok(game.alliancePromises!.every(promise => promise.fulfilled));
  for (const card of f.truths) assert.equal(game.discard.filter(held => held.id === card).length, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('two actual foreign offers cannot answer Yes to two different final partners in one Nexus', () => {
  const f = fixture(); let game = act(f.game, f.asker, { type: 'alliance', target: f.target });
  assert.equal(game.allianceOffers[f.partner], f.target); assert.equal(game.allianceOffers[f.asker], f.target);
  game = declare(f, game, { copies: 2 }).game;
  game = ask(game, f.asker, f.target, f.partner); game = answer(game, f.target, 'yes');
  game = ask(game, f.asker, f.target, f.asker);
  assert.deepEqual(viewGame(game, f.target).truthAllianceAnswers, ['no']);
  rejected(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'no');
  game = close(game); assert.equal(player(game, f.target).ally, f.partner);
  assert.ok(game.alliancePromises!.every(promise => promise.fulfilled)); assert.deepEqual(inventory(game), f.originalCards);
});

for (const consent of ['offered', 'allied'] as const) void test(`native opposing ${consent === 'offered' ? 'offer withdrawal' : 'alliance break'} releases a Yes with no owned acceptance left`, () => {
  const f = fixture({ consent }); let game = bind(f).game;
  game = act(game, f.partner, { type: 'alliance', target: null });
  assert.equal(player(game, f.target).ally, null); assert.equal(game.allianceOffers[f.partner], undefined);
  assert.equal(promise(game, f.target).released, true); assert.ok(!promise(game, f.target).fulfilled);
  game = close(game); assert.equal(player(game, f.target).ally, null);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native respondent cannot erase the only final Yes witness by its own actual alliance break', () => {
  const f = fixture({ consent: 'allied' }), game = bind(f).game;
  rejected(game, f.target, { type: 'alliance', target: null });
  assert.equal(player(game, f.target).ally, f.partner); assert.ok(!promise(game, f.target).released);
  const closed = close(game); assert.equal(promise(closed, f.target).fulfilled, true);
});

void test('native current Nexus question ownership and exact guide event reject foreign and stale callbacks', () => {
  const f = fixture(), declared = declare(f);
  rejected(declared.game, f.opponent, f.questionAction);
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, turn: f.game.turn + 1 } });
  rejected(declared.game, f.asker, { type: 'truthAsk', question: { ...f.question, partner: f.target } });
  let game = ask(declared.game, f.asker, f.target, f.partner);
  assert.ok(viewGame(game, f.target).truthAllianceAnswers!.includes('yes'));
  assert.equal(viewGame(game, f.asker).truthAllianceAnswers, null);
  rejected(game, f.asker, { type: 'truthAnswer', answer: 'yes' }); game = answer(game, f.target, 'yes');
  const guide = viewGame(game, f.target).alliancePromiseGuide; assert.ok(guide); assert.ok(guide.action.alliancePromiseEvent);
  assert.ok(viewGame(game, f.target).alliancePromises.every(promise => !Object.hasOwn(promise, 'source')));
  rejected(game, f.asker, guide.action);
  rejected(game, f.target, { ...guide.action, alliancePromiseEvent: 'stale-owned-event' });
  game = act(game, f.partner, { type: 'alliance', target: null });
  assert.equal(promise(game, f.target).released, true);
  game = act(game, f.partner, { type: 'alliance', target: f.target });
  rejected(game, f.target, guide.action);
  game = act(game, f.target, { type: 'alliance', target: f.partner });
  assert.equal(player(game, f.target).ally, f.partner); assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal policies answer and accept a real current foreign Nexus offer legally', () => {
  const f = fixture(), declared = declare(f), asked = ask(declared.game, f.asker, f.target, f.partner);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(asked, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'truthAnswer'); assert.ok(action, difficulty);
    assert.ok(view.truthAllianceAnswers!.some(answer => answer === action.answer));
    const answered = act(structuredClone(asked), f.target, action);
    assert.equal(answered.discard.filter(card => card.id === f.truth).length, action.answer === 'unknown' ? 0 : 1);
    assert.deepEqual(inventory(answered), f.originalCards);
  }
  const bound = bind(f).game;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(bound, f.target); view.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'alliance' && action.target === f.partner); assert.ok(action, difficulty);
    const accepted = act(structuredClone(bound), f.target, action);
    assert.equal(player(accepted, f.target).ally, f.partner); assert.ok(!promise(accepted, f.target).fulfilled);
    assert.deepEqual(inventory(close(accepted)), f.originalCards);
  }
});
