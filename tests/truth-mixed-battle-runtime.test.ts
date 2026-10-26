import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game } from '../game/engine';
import { truthFactAnswer } from '../game/truthtrance';
import { truthKnowledgeOf } from '../game/truthtrance-knowledge';
import {
  actTruthMixedBattle as act, advanceTruthMixedBattle as advance,
  answerTruthMixedBattle as answer, askTruthMixedBattle as ask,
  bindTruthMixedBattle as bind, createTruthMixedBattleFixture as fixture,
  declareTruthMixedBattle as declare, finishTruthMixedBattle as finish,
  revealTruthMixedBattle as reveal, settleTruthMixedBattle as settle,
  truthMixedBattleAction as action, truthMixedBattleClean as clean,
  truthMixedBattleFact as fact, truthMixedBattleGroup as group,
  truthMixedBattleInventory as inventory, truthMixedBattlePlayer as player,
  truthMixedBattlePromise as promise,
} from './fixture-truth-mixed-battle';

function rejected(game: Game, actor: string, candidate: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, candidate)); assert.deepEqual(game, before);
}
function truthOnce(game: Game, truth: string) {
  assert.equal(game.discard.filter(card => card.id === truth).length, 1);
}

void test('native mixed battle uses the exact original base33 paid-shipment prefix and all six native plan conditions', () => {
  const f = fixture(); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.setup.deck.length, 33); assert.ok(f.setup.players.every(seat => seat.hand.length === 0));
  assert.equal(f.game.advanced, false); assert.deepEqual(f.game.expansions, []);
  assert.equal(f.sourceActionCount, f.planSource.sourceActionCount); assert.equal(f.sourceActionCount, f.actions.length);
  assert.equal(f.sourceActionCount, f.planSource.base.sourceActionCount - 2);
  assert.deepEqual(f.game, f.planSource.base.beforePlans); assert.equal(f.game.battle!.event, f.event);
  assert.equal(f.game.battle!.revealed, false); assert.deepEqual(f.game.battle!.plans, {});
  assert.deepEqual(player(f.game, f.target).hand.map(card => card.id), [f.ordinary]);
  assert.deepEqual(player(f.game, f.asker).hand.filter(card => card.effect === 'truthtrance').map(card => card.id), [f.truth]);
  assert.equal(player(f.shipment.before, f.target).spice - player(f.shipment.after, f.target).spice, 1);
  assert.equal(player(f.game, f.target).forces['arrakeen:10'], 1); assert.equal(player(f.game, f.target).reserves, 19);
  assert.equal(truthFactAnswer(player(f.game, f.target), f.heldFact), 'yes');
  const mixed = group('and', fact(f.heldFact), action({ kind: 'dial', compare: 'eq', value: 0 }),
    action({ kind: 'support', compare: 'eq', value: 0 }), action(f.weaponClaim),
    action({ kind: 'defense', name: null }), action({ kind: 'leader', leader: f.base.base.leaders.emperor }),
    action({ kind: 'kwisatz', use: false }));
  const before = structuredClone(f.game), bound = bind(f, 'yes', mixed); let game = bound.game;
  assert.deepEqual(f.game, before); assert.equal(bound.actionCount, 4); assert.ok(clean(game));
  assert.deepEqual(promise(game).mixed, mixed); assert.equal(promise(game).fulfilled, false);
  rejected(game, f.target, f.targetPlan); game = reveal(game, f).game;
  assert.equal(game.battle!.plans[f.target].weapon, f.ordinary); assert.equal(promise(game).fulfilled, true);
  assert.equal(promise(game).released, false); truthOnce(game, f.truth);
  game = finish(game, f); assert.equal(game.battle, null); assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('native true current projectile OR future weapon answers Yes without binding a later unarmed plan', () => {
  const f = fixture(), mixed = group('or', fact(f.heldFact), action(f.weaponClaim));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBattleAnswers, ['yes']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'no' });
  let game = answer(asked, f.target, 'yes'); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.battle!.truthPromises?.length ?? 0, 0); assert.equal(viewGame(game, f.target).battle!.compliantPlan, null);
  game = reveal(game, f, f.targetPlan).game; assert.equal(game.battle!.plans[f.target].weapon, null);
  assert.equal(promise(finish(game, f)).fulfilled, true); truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native false current Shield AND future weapon answers No without forbidding the later real projectile', () => {
  const f = fixture(), mixed = group('and', fact(f.absentFact), action(f.weaponClaim));
  assert.equal(truthFactAnswer(player(f.game, f.target), f.absentFact), 'no');
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBattleAnswers, ['no']);
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  let game = answer(asked, f.target, 'no'); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.battle!.truthPromises?.length ?? 0, 0); game = reveal(game, f).game;
  assert.equal(game.battle!.plans[f.target].weapon, f.ordinary); assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(inventory(finish(game, f)), f.originalCards);
});

void test('native false current Shield OR future weapon Yes still requires the original projectile plan', () => {
  const f = fixture(); let game = bind(f, 'yes', group('or', fact(f.absentFact), action(f.weaponClaim))).game;
  rejected(game, f.target, f.targetPlan); assert.equal(promise(game).fulfilled, false);
  game = reveal(game, f).game; assert.equal(promise(game).fulfilled, true);
  assert.equal(game.battle!.plans[f.target].weapon, f.ordinary); assert.deepEqual(inventory(finish(game, f)), f.originalCards);
});

void test('native true current projectile AND future weapon No forbids only the promised whole result', () => {
  const f = fixture(); let game = bind(f, 'no').game;
  rejected(game, f.target, f.projectilePlan); assert.equal(promise(game).fulfilled, false);
  game = reveal(game, f, f.targetPlan).game; assert.equal(game.battle!.plans[f.target].weapon, null);
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).answer, false);
  assert.deepEqual(inventory(finish(game, f)), f.originalCards);
});

for (const answerValue of ['yes', 'no'] as const) void test(`native unknown non-Fremen forecast requires a conservative whole mixed battle ${answerValue}`, () => {
  const f = fixture(), p = player(f.game, f.target); assert.equal(truthKnowledgeOf(f.game, p).stormForecast, null);
  assert.equal(truthFactAnswer(p, f.forecastFact, truthKnowledgeOf(f.game, p)), 'unknown');
  const mixed = group(answerValue === 'yes' ? 'or' : 'and', fact(f.forecastFact), action(f.weaponClaim));
  const asked = ask(declare(f).game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBattleAnswers, [answerValue]);
  rejected(asked, f.target, { type: 'truthAnswer', answer: answerValue === 'yes' ? 'no' : 'yes' });
  let game = answer(asked, f.target, answerValue); assert.equal(promise(game).fulfilled, false);
  rejected(game, f.target, answerValue === 'yes' ? f.targetPlan : f.projectilePlan);
  game = reveal(game, f, answerValue === 'yes' ? f.projectilePlan : f.targetPlan).game;
  assert.equal(promise(game).fulfilled, true); assert.equal(promise(game).released, false);
  truthOnce(game, f.truth); assert.deepEqual(inventory(finish(game, f)), f.originalCards);
});

void test('native nested whole No preserves both actual alternative plan completions', () => {
  const f = fixture(), mixed = group('and', fact(f.heldFact), group('or',
    group('and', action({ kind: 'dial', compare: 'eq', value: 1 }), action(f.weaponClaim)),
    group('and', action({ kind: 'dial', compare: 'eq', value: 0 }), action({ kind: 'weapon', name: null }))));
  const alternatives: Action[] = [{ ...f.projectilePlan, dial: 0 }, { ...f.targetPlan, dial: 1 }];
  for (const manual of alternatives) {
    let game = bind(f, 'no', mixed).game;
    rejected(game, f.target, f.targetPlan); rejected(game, f.target, { ...f.projectilePlan, dial: 1 });
    game = reveal(game, f, manual).game; assert.equal(promise(game).fulfilled, true);
    assert.equal(game.battle!.plans[f.target].dial, manual.dial); assert.equal(game.battle!.plans[f.target].weapon, manual.weapon);
    assert.deepEqual(promise(game).mixed, mixed); assert.deepEqual(inventory(finish(game, f)), f.originalCards);
  }
});

void test('native solver and Fill previews and the respondents own seal leave a mixed aggregate pending until actual reveal', () => {
  const f = fixture(), bound = bind(f), source = structuredClone(bound.game); let game = bound.game;
  for (let count = 0; count < 3; count++) {
    const own = viewGame(game, f.target), other = viewGame(game, f.asker);
    assert.ok(own.battle!.compliantPlan); assert.equal(other.battle!.compliantPlan, null);
    assert.equal(promise(game).fulfilled, false);
    const filled: Action = { type: 'battlePlan', ...own.battle!.compliantPlan };
    assert.equal(filled.weapon, f.ordinary, 'The private native completion still contains the hidden residual');
  }
  assert.deepEqual(game, source, 'Projection and candidate search never fulfill or otherwise mutate the authoritative game');
  game = act(game, f.target, f.projectilePlan); assert.equal(game.battle!.revealed, false);
  assert.equal(promise(game).fulfilled, false); assert.equal(promise(game).released, false);
  game = act(game, f.asker, f.ownPlan); assert.equal(game.battle!.revealed, true); assert.equal(promise(game).fulfilled, true);
  game = finish(game, f); assert.equal(game.battle, null); assert.equal(promise(game).fulfilled, true);
  assert.equal(promise(game).released, false); truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('native already sealed and already revealed respondents keep their fixed answer without new residual binding', () => {
  const f = fixture();
  for (const revealed of [false, true]) {
    const actions: { actor: string; action: Action }[] = [];
    let source = act(f.game, f.target, f.projectilePlan, actions);
    if (revealed) source = act(source, f.asker, f.ownPlan, actions);
    const declared = declare(f, source); assert.ok(viewGame(declared.game, f.asker).truthMixedBattleTargets.includes(f.target));
    const asked = ask(declared.game, f.asker, f.target, f.mixed);
    assert.deepEqual(viewGame(asked, f.target).truthMixedBattleAnswers, ['yes']);
    rejected(asked, f.target, { type: 'truthAnswer', answer: 'no' }); let game = answer(asked, f.target, 'yes');
    assert.equal(promise(game).fulfilled, true); assert.equal(game.battle!.truthPromises?.length ?? 0, 0);
    assert.equal(game.battle!.plans[f.target].weapon, f.ordinary); assert.equal(game.battle!.revealed, revealed);
    if (!revealed) game = act(game, f.asker, f.ownPlan);
    assert.equal(promise(finish(game, f)).fulfilled, true); truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('native mixed battle Ask retains exact event territory owner answer and original JSON wire boundaries', () => {
  const f = fixture(), declared = declare(f), game = declared.game;
  assert.ok(viewGame(game, f.asker).truthMixedBattleTargets.includes(f.target));
  rejected(game, f.target, f.questionAction);
  for (const replacement of [{ battle: 'other-battle' }, { battle: null }, { territory: 'carthag' },
    { target: 'foreign-seat' }, { binding: { kind: 'constant', value: true } }])
    rejected(game, f.asker, { type: 'truthAsk', question: { ...f.question, ...replacement } });
  const wire: Action = JSON.parse(JSON.stringify(f.questionAction));
  const asked = act(game, f.asker, wire);
  assert.deepEqual(asked.truthtrance!.question, f.question);
  assert.deepEqual(viewGame(asked, f.target).truthMixedBattleAnswers, ['yes', 'no']);
  assert.equal(viewGame(asked, f.asker).truthMixedBattleAnswers, null); assert.equal(viewGame(asked, f.target).truthBattleAnswers, null);
  rejected(asked, f.asker, { type: 'truthAnswer', answer: 'yes' });
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'unknown' });
  const done = act(asked, f.target, JSON.parse(JSON.stringify({ type: 'truthAnswer', answer: 'yes' })) as Action);
  rejected(done, f.target, { type: 'truthAnswer', answer: 'yes' }); truthOnce(done, f.truth);
  let ended = reveal(f.game, f).game; ended = settle(finish(ended, f)); ended = declare(f, ended).game;
  assert.deepEqual(viewGame(ended, f.asker).truthMixedBattleTargets, []); rejected(ended, f.asker, wire);
  assert.deepEqual(inventory(done), f.originalCards);
});

void test('native mixed battle projection retains only the owned raw aggregate and hides residuals from every seat', () => {
  const f = fixture(), game = bind(f).game;
  for (const actor of [f.target, f.asker]) {
    const view = viewGame(game, actor); assert.ok(!('mixedBattleQuestions' in view));
    assert.deepEqual(view.battle!.truthPromises, []); assert.equal(view.truthMixedBattleAnswers, null);
    assert.deepEqual(view.truthHistory.at(-1)?.question, f.question); assert.equal(view.truthHistory.at(-1)?.answer, 'yes');
    if (actor !== f.target) assert.deepEqual(view.mixedBattlePromises, []);
    else {
      const row = promise(game);
      assert.deepEqual(Object.keys(row).sort(), ['answer', 'asker', 'battle', 'event', 'fulfilled', 'mixed', 'player', 'released', 'territory', 'turn']);
      assert.equal(row.player, f.target); assert.equal(row.asker, f.asker); assert.equal(row.turn, 1);
      assert.equal(row.battle, f.event); assert.equal(row.territory, f.territory); assert.equal(row.answer, true);
      assert.deepEqual(row.mixed, f.mixed); assert.equal(row.fulfilled, false); assert.equal(row.released, false);
      assert.ok(view.battle!.compliantPlan); assert.equal(view.battle!.compliantPlan.weapon, f.ordinary);
    }
  }
  assert.equal(game.mixedBattleQuestions?.length, 1); assert.equal(game.battle!.truthPromises?.length, 1);
  assert.equal(game.battle!.truthPromises![0].event, promise(game).event);
  const revealed = reveal(game, f).game;
  for (const actor of [f.target, f.asker]) assert.deepEqual(viewGame(revealed, actor).battle!.truthPromises, []);
});

void test('native earlier mixed Yes constrains the original ordinary Prescience answer before actual sealing', () => {
  const f = fixture({ window: 'preparation' });
  assert.deepEqual(f.game, f.planSource.beforePreparation); assert.equal(f.actions.at(-1)!.action.type, 'chooseBattle');
  assert.equal(f.sourceActionCount, f.sourceCounts.beforePreparation); assert.equal(f.game.battle!.preparation?.kind, 'prescience');
  let game = bind(f).game; assert.equal(promise(game).fulfilled, false);
  game = act(game, f.asker, { type: 'prescience', field: 'weapon' }); game = settle(game);
  assert.equal(game.battle!.preparation?.kind, 'prescienceAnswer');
  rejected(game, f.target, { type: 'prescienceAnswer', value: null });
  game = act(game, f.target, { type: 'prescienceAnswer', value: f.ordinary }); game = settle(game);
  assert.equal(game.battle!.prescience?.value, f.ordinary); assert.equal(promise(game).fulfilled, false);
  game = advance(game, state => clean(state) && !state.battle?.preparation);
  game = reveal(game, f).game; assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(inventory(finish(game, f)), f.originalCards);
});

void test('controlled legacy eventless metadata stays unchanged on read and gains one identity only during the real mixed Ask', () => {
  const f = fixture(), legacy = structuredClone(f.game);
  // Controlled compatibility case: omit only event metadata, never claim this
  // historical eventless representation was emitted by the original source.
  delete legacy.battle!.event;
  const before = structuredClone(legacy);
  for (const actor of [f.target, f.asker]) assert.equal(viewGame(legacy, actor).battle!.event, null);
  assert.deepEqual(legacy, before);
  const declared = declare(f, legacy); assert.equal(declared.game.battle!.event, undefined);
  rejected(declared.game, f.asker, f.questionAction);
  const eventless: Action = { type: 'truthAsk', question: { ...f.question, battle: null } };
  const asked = act(declared.game, f.asker, JSON.parse(JSON.stringify(eventless)) as Action);
  const assigned = asked.battle!.event; assert.equal(typeof assigned, 'string'); assert.ok(assigned);
  assert.deepEqual(asked.truthtrance!.question, { ...f.question, battle: assigned });
  assert.equal(viewGame(asked, f.target).battle!.event, assigned);
  let game = answer(asked, f.target, 'yes'); assert.equal(promise(game).battle, assigned);
  game = reveal(game, f).game; assert.equal(game.battle!.event, assigned); assert.equal(promise(game).fulfilled, true);
  truthOnce(game, f.truth); assert.deepEqual(inventory(game), f.originalCards);
});

void test('all four minimal profiles answer a native mixed battle and reach a legal seal through the private native fallback', () => {
  const f = fixture(), asked = ask(declare(f).game, f.asker, f.target, f.mixed);
  for (const difficulty of DIFFICULTIES) {
    let game = structuredClone(asked); const answering = viewGame(game, f.target);
    answering.players.find(seat => seat.id === f.target)!.bot = difficulty;
    const answerAction = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(answerAction, difficulty);
    assert.ok(answering.truthMixedBattleAnswers?.includes(answerAction.answer as 'yes' | 'no' | 'unknown'));
    game = act(game, f.target, answerAction); const planning = viewGame(game, f.target);
    planning.players.find(seat => seat.id === f.target)!.bot = difficulty;
    assert.deepEqual(planning.battle!.truthPromises, []); assert.ok(planning.battle!.compliantPlan);
    const choices = botActions(planning).filter(candidate => candidate.type === 'battlePlan');
    assert.ok(choices.some(candidate => candidate.weapon === planning.battle!.compliantPlan!.weapon), difficulty);
    let accepted = false;
    for (const candidate of choices) {
      const before = structuredClone(game);
      try { game = act(game, f.target, candidate); accepted = true; break; }
      catch { assert.deepEqual(game, before); }
    }
    assert.equal(accepted, true, `${difficulty} reaches an accepted original battle plan`);
    assert.equal(game.battle!.plans[f.target].weapon, answerAction.answer === 'yes' ? f.ordinary : null);
    assert.equal(promise(game).fulfilled, false); game = act(game, f.asker, f.ownPlan);
    assert.equal(promise(game).fulfilled, true); truthOnce(game, f.truth); assert.deepEqual(inventory(finish(game, f)), f.originalCards);
  }
});
