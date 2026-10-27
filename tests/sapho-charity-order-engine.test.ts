import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actSaphoCharityOrder as act, advanceSaphoCharityOrder as advance,
  createSaphoCharityOrderFixture as fixture, claimSaphoCharityOrder as claim,
  createSaphoCharitySemutaFixture, reactSaphoCharitySemuta,
  currentSaphoCharityEvent as currentEvent, finishSaphoCharityOrder as finish,
  finishSaphoCharityTurn as finishTurn, nextSaphoCharityOrder as next,
  saphoCharityOrderAction as action, saphoCharityOrderClean as clean,
  saphoCharityOrderInventory as inventory, saphoCharityOrderStocks as stocks,
  saphoCharityOrderPlayer as player, saphoCharityOrderReload as reload,
  unstampedSaphoCharitySupplement as unstamped, type SaphoCharityOrderStep } from './fixture-sapho-charity-order';

function reject(game: Game, actor: string, proposed: Action) {
  const before = reload(game); assert.throws(() => applyAction(game, actor, proposed)); assert.deepEqual(game, before);
}
function expected(game: Game, owner: string, mode: 'first' | 'last') {
  const frame = game.charityOrder; assert.ok(frame);
  const current = frame.remaining[0];
  const locked = current && player(game, current).charityTurn === game.turn ? [current] : [];
  const others = frame.remaining.filter(actor => actor !== owner && !locked.includes(actor));
  return [...locked, ...(mode === 'first' ? [owner, ...others] : [...others, owner])];
}

void test('native cache1 Sapho changes fresh Advanced Charity first or last while retaining physical First Player order', () => {
  const f = fixture();
  assert.equal(f.lobby.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.ok(f.beforeStartingDeal.players.every(seat => !seat.hand.length));
  assert.equal(f.acquisition.bid.actor, f.owner); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.owner).spice - player(f.acquisition.after, f.owner).spice, 1);
  assert.equal(f.sourceCounts.inherited, f.inheritedActions.length);
  assert.equal(f.sourceCounts.acquisition, f.acquisition.steps.length);
  assert.equal(f.sourceCounts.continuation, f.continuation.length);
  assert.equal(f.sourceCounts.source, f.sourceActions.length);
  assert.deepEqual(f.sourceActions, [...f.inheritedActions, ...f.continuation]);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 2); assert.equal(f.game.charityOrder?.version, 1);
  for (const mode of ['first', 'last'] as const) {
    const wanted = expected(f.game, f.owner, mode), physicalOrder = [...f.game.order], before = stocks(f.game);
    const proposed = action(f.game, mode);
    assert.deepEqual(Object.keys(proposed).sort(), ['card', 'event', 'mode', 'scope', 'type']);
    assert.equal(proposed.event, currentEvent(f.game));
    const game = act(reload(f.game), f.owner, proposed);
    assert.equal(game.charityOrder?.version, 2); assert.deepEqual(game.charityOrder?.remaining, wanted);
    assert.deepEqual(game.order, physicalOrder); assert.equal(game.active, wanted[0]);
    assert.deepEqual(game.ready, []); assert.deepEqual(stocks(game), before);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(game, f.owner).hand.some(card => card.id === f.card), false);
    assert.deepEqual(inventory(game), f.originalInventory);
  }
});

void test('an actual accepted current Charity claim stays ahead of both Sapho tails and cannot be claimed twice', () => {
  const f = fixture({ started: true }); assert.ok(f.claim);
  assert.equal(f.claim.paid, player(f.beforeClaim, f.current).spice);
  assert.ok(f.claim.steps.some(step => step.action.type === 'bribe'));
  assert.ok(f.claim.steps.some(step => step.action.type === 'charity'));
  assert.equal(player(f.game, f.current).charityTurn, f.game.turn);
  assert.equal(player(f.game, f.current).spice, 2);
  assert.equal(f.game.charityOrder?.version, 1, 'A claim preserves original v1 bytes; accepted Sapho creates v2');
  assert.deepEqual(f.game.charityOrder, f.beforeClaim.charityOrder);
  for (const mode of ['first', 'last'] as const) {
    const option = viewGame(f.game, f.owner).saphoOptions.find(option => option.scope === 'charity' && option.mode === mode);
    assert.ok(option); assert.equal((option as typeof option & { afterCurrent?: string }).afterCurrent, f.current);
    const wanted = expected(f.game, f.owner, mode), before = stocks(f.game);
    let game = act(reload(f.game), f.owner, action(f.game, mode));
    assert.equal(game.active, f.current); assert.deepEqual(game.charityOrder?.remaining, wanted);
    assert.equal(game.charityOrder?.remaining[0], f.current); assert.deepEqual(stocks(game), before);
    reject(game, f.current, { type: 'charity' });
    game = finishTurn(game);
    assert.equal(game.active, wanted[1]); assert.ok(game.ready.includes(f.current));
    assert.equal(player(game, f.current).spice, 2); assert.equal(player(game, f.current).charityTurn, game.turn);
  }
});

void test('the real Sapho holder can pause its started Charity but cannot choose a no-op position', () => {
  const f = fixture(); let game = advance(reload(f.game), state => clean(state) && state.charityOrder?.remaining[0] === f.owner);
  assert.equal(game.active, f.owner);
  assert.equal(viewGame(game, f.owner).saphoOptions.some(option => option.scope === 'charity' && option.mode === 'first'), false);
  reject(game, f.owner, { type: 'card', card: f.card, scope: 'charity', event: currentEvent(game), mode: 'first' });
  game = claim(game, f.owner).game;
  assert.equal(player(game, f.owner).charityTurn, game.turn);
  reject(game, f.owner, { type: 'card', card: f.card, scope: 'charity', event: currentEvent(game), mode: 'first' });
  const option = viewGame(game, f.owner).saphoOptions.find(option => option.scope === 'charity' && option.mode === 'last');
  assert.ok(option && option.scope === 'charity' && option.resumeOwn);
  const before = player(game, f.owner).spice;
  game = act(game, f.owner, { type: 'card', card: f.card, scope: 'charity', event: option.event, mode: 'last' });
  assert.equal(game.charityOrder?.remaining.at(-1), f.owner);
  assert.equal(player(game, f.owner).spice, before);
  assert.equal(player(game, f.owner).charityTurn, game.turn);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
});

void test('stale, foreign and finished Charity requests reject before cost while an accepted packet disposes Sapho once', () => {
  const f = fixture(), old = action(f.game, 'last');
  reject(f.game, f.owner, { ...old, event: 'old-charity-boundary' });
  reject(f.game, 'atreides', old); reject(f.game, f.owner, { ...old, afterCurrent: f.current });
  let game = finishTurn(reload(f.game));
  assert.notEqual(currentEvent(game), old.event); reject(game, f.owner, old);
  game = act(game, f.owner, action(game, 'first'));
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); reject(game, f.owner, old);
  assert.deepEqual(inventory(game), f.originalInventory);
  let completed = advance(reload(f.game), state => clean(state) && state.charityOrder?.remaining[0] === f.owner);
  const beforeFinish = action(completed, 'last'); completed = finishTurn(completed);
  assert.ok(completed.ready.includes(f.owner));
  assert.deepEqual(viewGame(completed, f.owner).saphoOptions.filter(option => option.scope === 'charity'), []);
  reject(completed, f.owner, beforeFinish);
  assert.ok(player(completed, f.owner).hand.some(card => card.id === f.card));
});

void test('genuine Basic and explicitly frame-only unstamped Advanced controls have no Sapho Charity scope', () => {
  const basic = fixture({ advanced: false });
  assert.equal(basic.game.advanced, false); assert.equal(basic.game.charityOrder ?? null, null);
  assert.deepEqual(viewGame(basic.game, basic.owner).saphoOptions.filter(option => option.scope === 'charity'), []);
  reject(basic.game, basic.owner, { type: 'card', card: basic.card, scope: 'charity', event: 'no-native-charity-frame', mode: 'first' });
  assert.deepEqual(inventory(basic.game), basic.originalInventory);
  const f = fixture(), game = unstamped(f.game), { charityOrder: removed, ...rest } = f.game;
  assert.ok(removed); assert.deepEqual(game, rest, 'This labelled unit supplement removes only the frame');
  assert.deepEqual(viewGame(game, f.owner).saphoOptions.filter(option => option.scope === 'charity'), []);
  reject(game, f.owner, action(f.game, 'first'));
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('all four minimal profiles use native Sapho and finish each remaining current Charity opportunity once', () => {
  const f = fixture({ started: true }), physicalOrder = [...f.game.order];
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
    const view = viewGame(f.game, f.owner); view.players.find(seat => seat.id === f.owner)!.bot = difficulty;
    const proposed = botActions(view).find(action => action.type === 'card' && action.scope === 'charity');
    assert.ok(proposed, `${difficulty} proposes the owned physical Sapho's legal native scope`);
    const actions: SaphoCharityOrderStep[] = [];
    let game = act(reload(f.game), f.owner, proposed, actions);
    const wanted = [...game.charityOrder!.remaining], completions: string[] = [];
    for (let count = 0; game.phase === 2 && count < 50; count++) {
      if (!clean(game)) {
        const step = next(game); assert.ok(step); game = act(game, step.actor, step.action, actions); continue;
      }
      const actor = game.charityOrder?.remaining[0]; assert.ok(actor);
      for (const other of game.players.filter(player => player.id !== actor)) {
        const waiting = viewGame(game, other.id); waiting.players.find(seat => seat.id === other.id)!.bot = difficulty;
        assert.equal(botActions(waiting).some(action => action.type === 'charity' || action.type === 'ready'), false);
      }
      const own = viewGame(game, actor); own.players.find(seat => seat.id === actor)!.bot = difficulty;
      const choice = botActions(own).find(action => action.type === 'charity' || action.type === 'ready');
      assert.ok(choice); if (choice.type === 'ready') completions.push(actor);
      game = act(game, actor, choice, actions);
    }
    game = finish(game, actions);
    assert.equal(game.phase, 3); assert.deepEqual(completions, wanted);
    assert.equal(new Set(completions).size, wanted.length); assert.deepEqual(game.order, physicalOrder);
    assert.equal(player(game, f.current).spice, 2); assert.equal(player(game, f.current).charityTurn, 2);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(inventory(game), f.originalInventory);
  }
});

for (const claimDiscard of [false, true]) {
  void test(`controlled Semuta acquisition supplement ${claimDiscard ? 'claims' : 'passes'} actual Sapho Charity disposal and preserves the reordered opportunity`, () => {
    const f = createSaphoCharitySemutaFixture();
    assert.equal(f.nativeAcquisition, false); assert.ok(f.staging.length > 0);
    assert.equal(f.inherited.game.turn, 2); assert.equal(f.inherited.game.phase, 4);
    assert.equal(f.game.turn, 3); assert.equal(f.game.phase, 2);
    assert.equal(f.sourceCounts.inherited, f.inheritedActions.length);
    assert.equal(f.sourceCounts.continuation, f.continuation.length);
    assert.equal(f.sourceCounts.source, f.sourceActions.length);
    assert.deepEqual(f.sourceActions, [...f.inheritedActions, ...f.continuation]);
    const before = stocks(f.game), physicalOrder = [...f.game.order];
    const paused = act(reload(f.game), f.owner, f.action);
    assert.equal(paused.pendingTreacheryDiscard?.continuation?.kind, 'saphoCharityDiscard');
    assert.equal(paused.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.equal(paused.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(paused, f.owner).hand.some(card => card.id === f.card), false);
    const frame = structuredClone(paused.charityOrder), completed = [...paused.ready], current = paused.active;
    assert.ok(frame); assert.equal(frame.version, 2);
    assert.equal(current, frame.remaining[0]); assert.deepEqual(stocks(paused), before);
    for (const seat of paused.players)
      assert.deepEqual(viewGame(paused, seat.id).saphoOptions.filter(option => option.scope === 'charity'), []);
    let game = reactSaphoCharitySemuta(reload(paused), f.holder, claimDiscard);
    game = advance(game, clean);
    assert.deepEqual(game.charityOrder, frame); assert.deepEqual(game.ready, completed);
    assert.equal(game.active, current); assert.deepEqual(game.order, physicalOrder);
    assert.deepEqual(stocks(game), before); assert.deepEqual(inventory(game), f.originalInventory);
    assert.equal(player(game, f.owner).hand.some(card => card.id === f.card), false);
    if (claimDiscard) {
      assert.ok(player(game, f.holder).hand.some(card => card.id === f.card));
      assert.equal(player(game, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), false);
      assert.equal(game.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
      assert.equal(game.discard.some(card => card.id === f.card), false);
    } else assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    game = finish(game);
    assert.equal(game.phase, 3); assert.deepEqual(game.order, physicalOrder);
    assert.deepEqual(stocks(game), before); assert.deepEqual(inventory(game), f.originalInventory);
    assert.equal(game.discard.filter(card => card.id === (claimDiscard ? SEMUTA_DRUG_ID : f.card)).length, 1);
  });
}
