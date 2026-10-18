import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import {
  actSaphoExtortion, completeSaphoExtortion, createSaphoExtortionFixture,
  saphoExtortionAnswer, saphoExtortionPending, saphoExtortionPlayer as player,
  type SaphoExtortionFixture,
} from './fixture-sapho-extortion';

function source(f: SaphoExtortionFixture) {
  assert.equal(f.game.advanced, f.advanced);
  assert.ok(f.actions.some(step => step.actor === f.game.host && step.action.type === 'start'));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(player(f.acquired).hand.some(card => card.id === f.card));
  assert.equal(player(f.afterSetup, f.moritani).forces['carthag:11'], 6);
  assert.equal(f.beforePlacement.turn, 1);
  assert.equal(f.beforePlacement.decision?.kind, 'moritaniPlacement');
  assert.equal(f.placed.moritaniTerror!.tokens.find(token => token.id === f.token)?.location, 'habbanya_ridge_sietch');
  assert.equal(player(f.beforeEntry).spice - player(f.revealed).spice, 1);
  assert.equal(player(f.beforeEntry).reserves - player(f.revealed).reserves, 1);
  assert.equal(player(f.revealed).forces['habbanya_ridge_sietch:17'], 1);
  assert.equal(f.offered.decision?.kind, 'moritaniTerror');
  assert.equal(viewGame(f.offered, f.moritani).terrorEntry!.kind, 'extortion');
  assert.equal(player(f.offered, f.moritani).spice, player(f.revealed, f.moritani).spice);
  assert.deepEqual(f.revealed.moritaniExtortion!.bank, { reserved: 5, collected: 0 });
  assert.equal(viewGame(f.revealed, f.owner).extortion.deferred, 5);
  assert.equal(f.beforeMentatPlacement.decision?.kind, 'moritaniPlacement');
  assert.equal(f.beforeMentatPlacement.phase, 8);
  assert.deepEqual(f.beforeMentatPlacement.moritaniExtortion!.bank, { reserved: 5, collected: 0 });
  assert.equal(f.collected.moritaniTerror!.tokens.find(token => token.id === f.laterToken)?.location, 'sietch_tabr');
  assert.equal(player(f.collected, f.moritani).spice - player(f.beforeMentatPlacement, f.moritani).spice, 5);
  assert.deepEqual(f.collected.moritaniExtortion!.bank, { reserved: 0, collected: 5 });
  assert.deepEqual(f.collected.moritaniExtortion!.queue, f.collected.order.filter(actor => actor !== f.moritani));
  assert.equal(f.declines.length, 1);
  assert.equal(f.declines[0].step.actor, 'atreides');
  assert.equal(f.declines[0].step.action.pay, false);
  assert.ok(saphoExtortionPending(f.game));
  assert.equal(f.game.moritaniExtortion!.cursor, 1);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function reordered(f: SaphoExtortionFixture, result: ReturnType<typeof completeSaphoExtortion>) {
  const before = f.game.moritaniExtortion!, after = result.ordered.moritaniExtortion!;
  const rest = before.queue.slice(before.cursor).filter(actor => actor !== f.owner);
  assert.equal(result.action.scope, 'extortion');
  assert.deepEqual(after.queue, [...before.queue.slice(0, before.cursor),
    ...(result.mode === 'first' ? [f.owner, ...rest] : [...rest, f.owner])]);
  assert.equal(after.cursor, before.cursor);
  assert.deepEqual(after.bank, before.bank);
  assert.equal(after.token, f.token);
  assert.equal(after.payer, null);
  assert.ok(after.saphoOrder);
  assert.deepEqual(result.ordered.order, f.game.order);
  assert.equal(result.ordered.moritaniTerror!.placementTurn, f.game.moritaniTerror!.placementTurn);
  assert.equal(result.ordered.moritaniTerror!.tokens.find(token => token.id === f.token)?.status, 'extortion');
  assert.equal(player(result.ordered, f.moritani).spice, player(f.game, f.moritani).spice);
  assert.equal(result.ordered.discard.filter(card => card.id === f.card).length, 1);
  assert.ok(result.ordered.decision?.kind === 'moritaniExtortion');
  assert.notEqual(result.ordered.decision.event, result.previous.action.event);
  assert.throws(() => actSaphoExtortion(result.ordered, result.previous.actor, result.previous.action),
    /Extortion|event|turn|expired|current|decision/i);
  assert.equal(result.answers.some(answer => answer.step.actor === 'atreides'), false, 'The completed real decline is not asked again');
  for (const answer of result.answers) {
    assert.equal(answer.step.actor, answer.before.moritaniExtortion!.queue[answer.before.moritaniExtortion!.cursor]);
    if (answer.after.moritaniExtortion) assert.deepEqual(answer.after.moritaniExtortion.saphoOrder, after.saphoOrder,
      'The original ledger answer clone retains the applied local order');
  }
  assert.equal(result.game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(result.game.moritaniExtortion, undefined);
  assert.equal(result.game.decision?.kind === 'moritaniExtortion', false);
}

for (const advanced of [false, true]) {
  const rules = advanced ? 'Advanced' : 'Basic';
  void test(`genuine ${rules} paid Sapho first preserves a real earlier Extortion decline and ends offers with one payment3`, () => {
    const f = createSaphoExtortionFixture({ advanced }); source(f);
    const result = completeSaphoExtortion(f, 'first', true); reordered(f, result);
    assert.equal(result.answers.length, 1);
    assert.equal(result.answers[0].step.actor, f.owner);
    assert.equal(result.answers[0].step.action.pay, true);
    assert.equal(player(result.game).spice, player(f.game).spice - 3);
    assert.equal(player(result.game, f.moritani).spice, player(f.game, f.moritani).spice + 3);
    assert.equal(player(result.game, f.moritani).spice - player(f.beforeMentatPlacement, f.moritani).spice, 8);
    assert.equal(result.game.moritaniTerror!.tokens.find(token => token.id === f.token)?.status, 'removed');
    assert.equal(viewGame(result.game, f.owner).extortion.pending, null);
    assert.throws(() => actSaphoExtortion(result.game, f.owner, result.answers[0].step.action));
  });
  void test(`genuine ${rules} Sapho last preserves its completed payer prefix and all declines rotate the recovered Terror supply`, () => {
    const f = createSaphoExtortionFixture({ advanced }); source(f);
    const result = completeSaphoExtortion(f, 'last'); reordered(f, result);
    const native = f.game.moritaniExtortion!;
    assert.deepEqual(result.answers.map(answer => answer.step.actor),
      [...native.queue.slice(native.cursor).filter(actor => actor !== f.owner), f.owner]);
    assert.ok(result.answers.every(answer => answer.step.action.pay === false));
    assert.equal(player(result.game, f.moritani).spice, player(f.game, f.moritani).spice);
    for (const actor of native.queue) assert.equal(player(result.game, actor).spice, player(f.game, actor).spice);
    assert.equal(result.game.moritaniTerror!.tokens.length, 6);
    assert.equal(result.game.moritaniTerror!.tokens.some(token => token.id === f.token), false);
    const recovered = result.game.moritaniTerror!.tokens.find(token => token.kind === 'extortion'); assert.ok(recovered);
    assert.equal(recovered.status, 'available');
    assert.equal(recovered.location, null);
    assert.equal(result.game.moritaniTerror!.tokens.find(token => token.id === f.laterToken)?.location, 'sietch_tabr');
  });
}

void test('all four minimal policies use actual Sapho Extortion options and answer the resulting native payer control legally', () => {
  const f = createSaphoExtortionFixture({ advanced: true });
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const holder = viewGame(f.game, f.owner);
    holder.players.find(player => player.id === f.owner)!.bot = difficulty;
    const action = botActions(holder).find(action => action.type === 'card' && action.card === f.card && action.scope === 'extortion');
    assert.ok(action, `${difficulty} retains the real owned Sapho choice during the native payer decision`);
    const ordered = actSaphoExtortion(structuredClone(f.game), f.owner, action);
    assert.ok(saphoExtortionPending(ordered));
    const payer = ordered.decision!.player, view = viewGame(ordered, payer);
    view.players.find(player => player.id === payer)!.bot = difficulty;
    const answer = botActions(view).find(action => action.type === 'decision' && typeof action.pay === 'boolean');
    assert.ok(answer, `${difficulty} answers the actual native payer event`);
    const next = actSaphoExtortion(ordered, payer, answer);
    assert.equal(next.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(next.order, f.game.order);
    if (next.moritaniExtortion) {
      assert.equal(next.moritaniExtortion.cursor, ordered.moritaniExtortion!.cursor + 1);
      assert.equal(next.decision?.kind, 'moritaniExtortion');
      const actual = saphoExtortionAnswer(next, false);
      assert.equal(actual.actor, next.moritaniExtortion.queue[next.moritaniExtortion.cursor]);
    } else assert.equal(answer.pay, true);
  }
});
