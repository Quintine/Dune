import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  actSaphoRevivalOrder as act, advanceSaphoRevivalOrder as advance,
  createSaphoRevivalOrderFixture as fixture, createSaphoRevivalSemutaFixture,
  finishSaphoRevivalOrder as finish, reactSaphoRevivalSemuta,
  saphoRevivalOrderClean as clean, saphoRevivalOrderInventory as inventory,
  saphoRevivalOrderPlayer as player,
} from './fixture-sapho-revival-order';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Original Advanced setup, real purchased Sapho, Richese shipment, Storm
 * casualty and its free revival. Only the card's owner is controlled: the
 * physical purchased card is moved from Emperor to the current Richese seat. */
function source() {
  const f = fixture({ started: true });
  const game = structuredClone(f.game);
  const donor = player(game, f.owner);
  const index = donor.hand.findIndex(card => card.id === f.card);
  assert.ok(index >= 0);
  player(game, f.current).hand.push(...donor.hand.splice(index, 1));
  assert.equal(game.revivalOrder?.started, true);
  assert.equal(player(game, f.current).revived, 1);
  assert.deepEqual(inventory(game), f.originalInventory);
  return { f, game };
}

function ownLast(game: Game, actor: string, card: string): Action {
  const option = viewGame(game, actor).saphoOptions.find(row => row.scope === 'revival' && row.mode === 'last');
  assert.ok(option && option.scope === 'revival' && option.resumeOwn);
  return { type: 'card', card, scope: 'revival', mode: 'last', event: option.event };
}

function resume(game: Game, actor: string): Game {
  return advance(game, state => state.phase === 4 && clean(state) && state.revivalOrder?.remaining[0] === actor);
}

void test('Advanced own Revival suspension retains an earned free return and resumes once after the remaining players', () => {
  const { f, game: original } = source();
  const before = structuredClone(player(original, f.current));
  const expected = [...original.revivalOrder!.remaining.slice(1), f.current];
  const declaration = ownLast(original, f.current, f.card);
  reject(original, f.current, { ...declaration, event: 'stale-revival-event' });
  let game = act(original, f.current, declaration);
  assert.deepEqual(game.revivalOrder?.remaining, expected);
  assert.equal(game.revivalOrder?.version, 3);
  assert.equal(game.revivalOrder?.started, false);
  assert.deepEqual(game.order, original.order);
  assert.equal(player(game, f.current).reserves, before.reserves);
  assert.equal(player(game, f.current).tanks, before.tanks);
  assert.equal(player(game, f.current).revived, before.revived);
  assert.equal(player(game, f.current).freeForcesRevived, before.freeForcesRevived);
  assert.equal(player(game, f.current).spice, before.spice);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalInventory);
  reject(game, f.current, declaration);
  game = resume(game, f.current);
  assert.equal(game.revivalOrder?.started, true);
  assert.equal(player(game, f.current).revived, before.revived);
  assert.equal(player(game, f.current).freeForcesRevived, before.freeForcesRevived);
  game = act(game, f.current, { type: 'ready' });
  game = finish(game);
  assert.equal(game.phase, 5);
  assert.deepEqual(game.order, original.order);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('Advanced own Revival suspension preserves paid force and leader usage on return', () => {
  const { f, game: original } = source();
  let game = structuredClone(original);
  // Controlled physical supplement: move two Richese reserves to the Tanks,
  // and mark its existing five leader discs dead once to open their native
  // revival cycle. The paid return and leader revival below are real actions.
  const current = player(game, f.current);
  assert.ok(current.reserves >= 2);
  current.reserves -= 2;
  current.tanks += 2;
  for (const leader of current.leaders) { leader.dead = true; leader.deaths = 1; }
  // Richese receives two free force returns; the native source already used
  // one. Complete its remaining free return before making a paid one.
  const beforeFree = structuredClone(current);
  game = advance(act(game, f.current, { type: 'revive', amount: 1, elite: 0 }), clean);
  assert.equal(player(game, f.current).spice, beforeFree.spice);
  assert.equal(player(game, f.current).revived, beforeFree.revived + 1);
  const beforePaid = structuredClone(player(game, f.current));
  game = advance(act(game, f.current, { type: 'revive', amount: 1, elite: 0 }), clean);
  assert.equal(player(game, f.current).spice, beforePaid.spice - 2);
  assert.equal(player(game, f.current).revived, beforePaid.revived + 1);
  assert.equal(player(game, f.current).freeForcesRevived, beforePaid.freeForcesRevived);
  const eligible = viewGame(game, f.current).revival.leaders.find(row => row.affordable);
  assert.ok(eligible);
  game = advance(act(game, f.current, { type: 'reviveLeader', leader: eligible.id }), clean);
  assert.equal(player(game, f.current).leaderRevived, true);
  const used = structuredClone(player(game, f.current));
  const revivalAvailable = viewGame(game, f.current).revival.forcesRemaining;
  game = act(game, f.current, ownLast(game, f.current, f.card));
  game = resume(game, f.current);
  assert.equal(player(game, f.current).spice, used.spice);
  assert.equal(player(game, f.current).reserves, used.reserves);
  assert.equal(player(game, f.current).tanks, used.tanks);
  assert.equal(player(game, f.current).revived, used.revived);
  assert.equal(player(game, f.current).freeForcesRevived, used.freeForcesRevived);
  assert.equal(player(game, f.current).leaderRevived, true);
  assert.equal(viewGame(game, f.current).revival.forcesRemaining, revivalAvailable);
  assert.ok(player(game, f.current).leaders.some(leader => leader.id === eligible.id && !leader.dead));
  reject(game, f.current, { type: 'reviveLeader', leader: eligible.id });
  game = finish(act(game, f.current, { type: 'ready' }));
  assert.equal(game.phase, 5);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('All four minimal bot profiles can select the projected Advanced own Revival suspension', () => {
  const { f, game } = source();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.current);
    view.players.find(seat => seat.id === f.current)!.bot = difficulty;
    const action = botActions(view).find(row => row.type === 'card' && row.card === f.card && row.scope === 'revival');
    assert.ok(action, `${difficulty} proposes the owned Sapho action`);
    const next = act(game, f.current, action);
    assert.equal(next.revivalOrder?.remaining.at(-1), f.current);
    assert.equal(player(next, f.current).revived, player(game, f.current).revived);
    assert.equal(next.discard.filter(card => card.id === f.card).length, 1);
  }
});

void test('Semuta reaction completes before a suspended Advanced Revival continues', () => {
  const f = createSaphoRevivalSemutaFixture();
  assert.equal(f.nativeAcquisition, false);
  // This separate Homeworld/Semuta source uses its documented conserved-card
  // setup. Finish earlier actors only until a non-Semuta owner can start a
  // real Revival with at least one later participant.
  let game = advance(structuredClone(f.game), state => clean(state) && !!state.revivalOrder &&
    state.revivalOrder.remaining.length > 1 && state.revivalOrder.remaining[0] !== f.holder);
  const actor = game.revivalOrder!.remaining[0];
  if (actor !== f.owner) {
    const donor = player(game, f.owner);
    const index = donor.hand.findIndex(card => card.id === f.card);
    assert.ok(index >= 0);
    player(game, actor).hand.push(...donor.hand.splice(index, 1));
  }
  assert.deepEqual(inventory(game), f.originalInventory);
  // Controlled leader deaths open the native revival; the paid action and
  // subsequent discard/reaction/queue are all actual engine transitions.
  for (const leader of player(game, actor).leaders) { leader.dead = true; leader.deaths = 1; }
  const eligible = viewGame(game, actor).revival.leaders.find(row => row.affordable);
  assert.ok(eligible);
  game = advance(act(game, actor, { type: 'reviveLeader', leader: eligible.id }), clean);
  const before = structuredClone(player(game, actor));
  const paused = act(game, actor, ownLast(game, actor, f.card));
  assert.equal(paused.pendingTreacheryDiscard?.continuation?.kind, 'saphoRevivalDiscard');
  assert.ok(paused.pendingTreacheryDiscard?.reaction);
  const queue = structuredClone(paused.revivalOrder);
  reject(paused, paused.revivalOrder!.remaining[0], { type: 'ready' });
  game = reactSaphoRevivalSemuta(paused, f.holder, false);
  game = advance(game, clean);
  assert.deepEqual(game.revivalOrder, queue);
  assert.equal(player(game, actor).leaderRevived, true);
  assert.equal(player(game, actor).spice, before.spice);
  game = resume(game, actor);
  assert.equal(game.revivalOrder?.started, true);
  assert.equal(player(game, actor).leaderRevived, true);
  assert.equal(player(game, actor).spice, before.spice);
  assert.equal(finish(act(game, actor, { type: 'ready' })).phase, 5);
});
