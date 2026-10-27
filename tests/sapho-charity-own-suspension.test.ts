import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actSaphoCharityOrder as act, advanceSaphoCharityOrder as advance,
  createSaphoCharityOrderFixture as fixture, claimSaphoCharityOrder as claim,
  finishSaphoCharityOrder as finish, saphoCharityOrderClean as clean,
  saphoCharityOrderInventory as inventory, saphoCharityOrderPlayer as player,
} from './fixture-sapho-charity-order';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** The original Advanced setup and paid cache purchase lead to an actual
 * bribe and Charity claim. Only the already purchased Sapho changes hands:
 * the conserved physical card is transferred from Emperor to current Richese. */
function source() {
  const f = fixture({ started: true });
  const game = structuredClone(f.game);
  const donor = player(game, f.owner);
  const index = donor.hand.findIndex(card => card.id === f.card);
  assert.ok(index >= 0);
  player(game, f.current).hand.push(...donor.hand.splice(index, 1));
  assert.ok(f.claim?.steps.some(step => step.action.type === 'bribe'));
  assert.ok(f.claim?.steps.some(step => step.action.type === 'charity'));
  assert.equal(player(game, f.current).charityTurn, game.turn);
  assert.equal(player(game, f.current).spice, 2);
  assert.deepEqual(inventory(game), f.originalInventory);
  return { f, game };
}

function ownLast(game: Game, actor: string, card: string): Action {
  const option = viewGame(game, actor).saphoOptions.find(row => row.scope === 'charity' && row.mode === 'last');
  assert.ok(option && option.scope === 'charity' && option.resumeOwn);
  return { type: 'card', card, scope: 'charity', mode: 'last', event: option.event };
}

void test('Advanced own Charity suspension retains the earned claim and resumes once after the remaining players', () => {
  const { f, game: original } = source();
  const before = structuredClone(player(original, f.current));
  const expected = [...original.charityOrder!.remaining.slice(1), f.current];
  const declaration = ownLast(original, f.current, f.card);
  assert.deepEqual(Object.keys(declaration).sort(), ['card', 'event', 'mode', 'scope', 'type']);
  reject(original, f.current, { ...declaration, event: 'stale-charity-event' });
  reject(original, f.current, { ...declaration, mode: 'first' });
  let game = act(original, f.current, declaration);
  assert.equal(game.charityOrder?.version, 3);
  assert.deepEqual(game.charityOrder?.remaining, expected);
  assert.ok(game.charityOrder?.version === 3);
  assert.deepEqual(game.charityOrder.paused, [f.current]);
  assert.equal(game.charityOrder.started, false);
  assert.deepEqual(game.order, original.order);
  assert.equal(player(game, f.current).spice, before.spice);
  assert.equal(player(game, f.current).charityTurn, before.charityTurn);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalInventory);
  reject(game, f.current, declaration);
  game = advance(game, state => state.phase === 2 && clean(state) && state.charityOrder?.remaining[0] === f.current);
  assert.ok(game.charityOrder?.version === 3);
  assert.equal(game.charityOrder.started, true);
  assert.equal(player(game, f.current).spice, before.spice);
  assert.equal(player(game, f.current).charityTurn, game.turn);
  reject(game, f.current, { type: 'charity' });
  game = act(game, f.current, { type: 'ready' });
  game = finish(game);
  assert.equal(game.phase, 3);
  assert.deepEqual(game.order, original.order);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('the actual Sapho purchaser can pause its own genuinely claimed Charity turn', () => {
  const f = fixture();
  let game = advance(structuredClone(f.game), state => state.phase === 2 && clean(state) &&
    state.charityOrder?.remaining[0] === f.owner);
  assert.ok(game.charityOrder && game.charityOrder.remaining.length > 1);
  assert.ok(player(game, f.owner).hand.some(card => card.id === f.card));
  const result = claim(game, f.owner);
  assert.ok(result.steps.some(step => step.action.type === 'bribe'));
  assert.ok(result.steps.some(step => step.action.type === 'charity'));
  game = result.game;
  const before = structuredClone(player(game, f.owner));
  game = act(game, f.owner, ownLast(game, f.owner, f.card));
  assert.equal(game.charityOrder?.remaining.at(-1), f.owner);
  assert.equal(player(game, f.owner).spice, before.spice);
  assert.equal(player(game, f.owner).charityTurn, game.turn);
  game = advance(game, state => state.phase === 2 && clean(state) && state.charityOrder?.remaining[0] === f.owner);
  reject(game, f.owner, { type: 'charity' });
  game = finish(act(game, f.owner, { type: 'ready' }));
  assert.equal(game.phase, 3);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('all four minimal bot profiles can use a projected Advanced own Charity suspension', () => {
  const { f, game } = source();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.current);
    view.players.find(seat => seat.id === f.current)!.bot = difficulty;
    const proposed = botActions(view).find(row => row.type === 'card' && row.card === f.card && row.scope === 'charity');
    assert.ok(proposed, `${difficulty} proposes the physical owned Sapho`);
    assert.equal('afterCurrent' in proposed, false);
    assert.equal('resumeOwn' in proposed, false);
    const next = act(game, f.current, proposed);
    assert.equal(next.charityOrder?.remaining.at(-1), f.current);
    assert.equal(player(next, f.current).spice, player(game, f.current).spice);
    assert.equal(player(next, f.current).charityTurn, game.turn);
    assert.equal(next.discard.filter(card => card.id === f.card).length, 1);
  }
});
