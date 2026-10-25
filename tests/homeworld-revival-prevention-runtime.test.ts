import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { freeRevivalRate } from '../game/revival';
import {
  createHomeworldRevivalPreventionFixture as fixture,
  actHomeworldRevivalPrevention as act,
  requestHomeworldRevivalPrevention as request,
  allowHomeworldRevivalPrevention as allow,
  advanceHomeworldRevivalPrevention as advance,
  finishHomeworldRevivalPrevention as finish,
  homeworldRevivalPreventionPlayer as player,
  homeworldRevivalPreventionClean as clean,
  homeworldRevivalPreventionInventory as inventory,
  homeworldRevivalPreventionPopulation as population,
} from './fixture-homeworld-revival-prevention';

function reject(game: Game, actor: string, action: Action, reason?: RegExp) {
  const before = structuredClone(game);
  if (reason) assert.throws(() => applyAction(game, actor, action), reason);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('native LOW Fremen stays an eligible quiet special-Karama target and retains the printed four-free rate', () => {
  const f = fixture(), before = structuredClone(player(f.game, f.target)), owner = structuredClone(player(f.game, f.owner));
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 4);
  assert.equal(population(f.game).population, 0); assert.equal(population(f.game).side, 'low');
  assert.equal(before.tanks, 5); assert.equal(before.elites?.tanks, 0);
  assert.deepEqual(before.elites?.forces, { 'sietch_tabr:14': 3 });
  assert.equal(f.stormProtection.response?.kind, 'stormProtection');
  assert.equal(f.stormProtection.response?.amount, 10);
  assert.equal(player(f.afterLoss, f.target).forces[f.location], 5);
  const view = viewGame(f.game, f.owner), offer = view.tleilaxuSpecialKarama;
  assert.equal(offer?.blocked, null); assert.equal(offer?.pending, false);
  assert.deepEqual(offer?.cards, [f.karama]);
  assert.equal(offer?.targets.find(choice => choice.player === f.target)?.blocked, null);
  assert.equal(viewGame(f.game, f.target).revival.specialKaramaBlock, null);
  assert.equal(freeRevivalRate(f.game, before), 4);
  const stopped = act(f.game, f.owner, f.special), after = player(stopped, f.target);
  assert.deepEqual(after, before, 'Preventing the event returns neither the ordinary three nor the independent low increment');
  assert.equal(player(stopped, f.owner).spice, owner.spice);
  assert.equal(player(stopped, f.owner).specialKaramaUsed, true);
  assert.equal(player(stopped, f.owner).hand.some(card => card.id === f.karama), false);
  assert.equal(stopped.discard.filter(card => card.id === f.karama).length, 1);
  assert.deepEqual(stopped.revivalPrevention, { player: f.target, turn: stopped.turn });
  assert.equal(stopped.pendingRevival ?? null, null);
  assert.deepEqual(stopped.homeworldRevivalReturn, f.game.homeworldRevivalReturn);
  assert.notEqual(stopped.revivalFreeIncome?.[f.target], stopped.turn);
  assert.equal(freeRevivalRate(stopped, after), 4);
  assert.equal(viewGame(stopped, f.target).revival.homeworldBonus, 1);
  assert.equal(viewGame(stopped, f.target).revival.prevented, true);
  reject(stopped, f.target, f.request, /prevented/);
  reject(stopped, f.owner, f.special);
  assert.deepEqual(inventory(stopped), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
});

void test('the original reactive revivalStop may prevent all four requested free counters before any return, quota or income', () => {
  const f = fixture(), before = structuredClone(player(f.game, f.target)), ownerSpice = player(f.game, f.owner).spice;
  const pending = request(f.game, f).game;
  assert.equal(pending.decision?.kind, 'revivalStop'); assert.equal(pending.decision?.player, f.owner);
  assert.equal(pending.pendingRevival?.player, f.target);
  assert.equal(pending.pendingRevival?.amount, 4); assert.equal(pending.pendingRevival?.free, 4);
  assert.equal(pending.pendingRevival?.cost, 0);
  assert.deepEqual(player(pending, f.target), before);
  const offer = viewGame(pending, f.owner).tleilaxuSpecialKarama;
  assert.equal(offer?.blocked, null); assert.equal(offer?.pending, true);
  assert.deepEqual(offer?.targets, [{ player: f.target, blocked: null }]);
  const stopped = act(pending, f.owner, f.special);
  assert.equal(stopped.pendingRevival ?? null, null); assert.equal(stopped.decision, null);
  assert.deepEqual(player(stopped, f.target), before);
  assert.equal(player(stopped, f.owner).spice, ownerSpice);
  assert.equal(player(stopped, f.owner).specialKaramaUsed, true);
  assert.equal(stopped.discard.filter(card => card.id === f.karama).length, 1);
  assert.deepEqual(stopped.homeworldRevivalReturn, f.game.homeworldRevivalReturn);
  assert.notEqual(stopped.revivalFreeIncome?.[f.target], stopped.turn);
  assert.equal(freeRevivalRate(stopped, player(stopped, f.target)), 4);
  reject(stopped, f.target, f.request, /prevented/);
  assert.deepEqual(inventory(stopped), f.originalInventory);
});

void test('declining that original counter really returns four free normals and pays the separate native free-revival income', () => {
  const f = fixture(), before = structuredClone(player(f.game, f.target)), ownerSpice = player(f.game, f.owner).spice;
  const pending = request(f.game, f).game;
  const allowed = allow(pending, f), after = player(allowed.game, f.target);
  assert.equal(after.reserves, 4); assert.equal(after.tanks, 1);
  assert.equal(after.spice, before.spice); assert.equal(after.revived, 4); assert.equal(after.freeForcesRevived, 4);
  assert.deepEqual(after.forces, before.forces); assert.deepEqual(after.elites, before.elites);
  assert.equal(population(allowed.game).side, 'high');
  assert.equal(player(allowed.game, f.owner).spice, ownerSpice + 1);
  assert.ok(!player(allowed.game, f.owner).specialKaramaUsed);
  assert.ok(player(allowed.game, f.owner).hand.some(card => card.id === f.karama));
  assert.equal(allowed.game.pendingRevival, null); assert.ok(clean(allowed.game));
  assert.equal(allowed.game.revivalFreeIncome?.[f.target], allowed.game.turn);
  assert.deepEqual(inventory(allowed.game), f.originalInventory);
});

void test('original Ghola stays blocked during the prevented Revival but works through real readiness after phase4', () => {
  const f = fixture(); assert.ok(f.ghola && f.gholaAction);
  const stopped = act(f.game, f.owner, f.special), before = structuredClone(player(stopped, f.target));
  assert.ok(before.hand.some(card => card.id === f.ghola));
  reject(stopped, f.target, f.gholaAction, /prevented.*Ghola/);
  assert.equal(viewGame(stopped, f.target).ghola?.available, false);
  assert.ok(player(stopped, f.target).hand.some(card => card.id === f.ghola));
  const movement = finish(stopped);
  assert.equal(movement.turn, 2); assert.equal(movement.phase, 5);
  assert.equal(player(movement, f.target).reserves, 0); assert.equal(player(movement, f.target).tanks, 5);
  const requested = act(movement, f.target, f.gholaAction);
  const completed = advance(requested, clean), after = player(completed, f.target);
  assert.equal(after.reserves, 5); assert.equal(after.tanks, 0);
  assert.equal(after.spice, before.spice); assert.equal(after.revived, before.revived);
  assert.equal(after.freeForcesRevived, before.freeForcesRevived);
  assert.deepEqual(after.forces, before.forces); assert.deepEqual(after.elites, before.elites);
  assert.equal(after.hand.some(card => card.id === f.ghola), false);
  assert.equal(completed.discard.filter(card => card.id === f.ghola).length, 1);
  assert.deepEqual(inventory(completed), f.originalInventory);
});

void test('all four existing profiles legally answer the genuine five-Tank reactive stop without changing their thresholds', () => {
  const f = fixture(), pending = request(f.game, f).game;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(pending, f.owner); view.players.find(player => player.id === f.owner)!.bot = difficulty;
    const action = botActions(view)[0]; assert.ok(action);
    const answered = act(structuredClone(pending), f.owner, action);
    const completed = advance(answered, clean), after = player(completed, f.target);
    if (action.type === 'card') {
      assert.equal(after.reserves, 0); assert.equal(after.tanks, 5); assert.equal(after.revived, 0);
      assert.equal(freeRevivalRate(completed, after), 4);
      assert.equal(player(completed, f.owner).specialKaramaUsed, true);
    } else {
      assert.equal(action.type, 'decision'); assert.equal(action.decline, true);
      assert.equal(after.reserves, 4); assert.equal(after.tanks, 1); assert.equal(after.revived, 4);
      assert.ok(player(completed, f.owner).hand.some(card => card.id === f.karama));
    }
    assert.deepEqual(inventory(completed), f.originalInventory);
    assert.equal(finish(completed).phase, 5);
  }
});
