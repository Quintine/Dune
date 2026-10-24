import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { fighterCount, isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createAdvisorBattleFlipFixture as fixture, actAdvisorBattleFlip as act,
  commitAdvisorBattleFlip as commit, finishAdvisorBattleFlip as finish,
  advisorBattleFlipPlayer as player, advisorBattleFlipInventory as inventory,
  advisorBattleFlipTraitors as traitors,
} from './fixture-advisor-battle-flip';

function allow(source: Game) {
  let game = source;
  for (let count = 0; game.response?.automaticAdvisorFlip && count < 30; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = act(game, actor.id, { type: 'passResponse' });
  }
  assert.ok(!game.response?.automaticAdvisorFlip); return game;
}
function rejected(g: Game, actor: string, action: Action) {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}
const physical = (g: Game) => g.players.map(p => ({ id: p.id, forces: p.forces,
  reserves: p.reserves, tanks: p.tanks, battleLosses: p.battleLosses, leaders: p.leaders }));

for (const mutualTraitors of [false, true]) for (const canceled of [false, true]) {
  void test(`native ${mutualTraitors ? 'mutual traitors' : 'winner dial-all'} ${canceled ? 'prevention' : 'allowance'} preserves committed losses and resumes original cleanup once`, () => {
    const f = fixture({ mutualTraitors }), original = structuredClone(f.game);
    const pending = commit(f.game, f).game;
    assert.deepEqual(f.game, original);
    assert.equal(pending.phase, 6); assert.equal(pending.battle, null);
    assert.equal(pending.response?.kind, 'advisorFlip');
    const source = pending.response?.automaticAdvisorFlip; assert.ok(source?.producer === 'battleLosses');
    assert.equal(source.battle.event, f.event);
    assert.equal(source.battle.result, mutualTraitors ? 'mutualTraitors' : 'normal');
    assert.equal(source.battle.winner, mutualTraitors ? null : f.atreides);
    assert.deepEqual(Object.keys(source.battle).sort(), ['combatants', 'event', 'result', 'territory', 'turn', 'winner']);
    assert.equal(pending.pendingTreacheryDiscard == null, true);
    assert.equal(pending.pendingWinnerDiscards == null, true);
    assert.equal(pending.decision, null);
    assert.equal(player(pending, f.atreides).forces[f.location], undefined);
    assert.equal(player(pending, f.harkonnen).forces[f.location], undefined);
    assert.equal(player(pending, f.atreides).tanks, player(original, f.atreides).tanks + 1);
    assert.equal(player(pending, f.harkonnen).tanks, player(original, f.harkonnen).tanks + 1);
    assert.equal(player(pending, f.bg).forces[f.location], 1);
    assert.equal(fighterCount(player(pending, f.bg), f.territory), 0);
    assert.equal(pending.discard.filter(c => c.id === f.shield).length, mutualTraitors ? 1 : 0);
    assert.ok(viewGame(pending, f.holder).responseControls?.cancelCards.includes(f.karama));
    assert.ok(!JSON.stringify(viewGame(pending, f.holder).response).includes('resume'));
    const parent = pending.pendingAutomaticAdvisorBattle!;
    assert.equal(parent.resume?.kind, mutualTraitors ? 'aftermath' : 'winner');
    if (parent.resume?.kind === 'winner') assert.deepEqual(parent.resume.cards, [f.shield]);
    rejected(pending, f.atreides, { type: 'decision', discard: [] });
    for (let read = 0; read < 3; read++) {
      const stable = normalizeAutomaticGame(pending);
      assert.deepEqual(stable.pendingAutomaticAdvisorBattle, parent);
      assert.deepEqual(physical(stable), physical(pending));
      assert.equal(isAdvisor(player(stable, f.bg), f.territory), true);
    }
    const committed = physical(pending), bgSpice = player(pending, f.bg).spice;
    const done = canceled
      ? act(pending, f.holder, { type: 'card', card: f.karama, mode: 'cancel' })
      : allow(pending);
    assert.equal(done.pendingAutomaticAdvisorBattle, undefined);
    assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
    assert.deepEqual(physical(done), committed);
    assert.equal(isAdvisor(player(done, f.bg), f.territory), canceled);
    if (!mutualTraitors) {
      assert.deepEqual(done.decision, { kind: 'battleCards', player: f.atreides,
        territory: f.territory, cards: [f.shield] });
      assert.ok(player(done, f.atreides).hand.some(c => c.id === f.shield));
    }
    const collected = finish(done);
    assert.equal(collected.phase, 7);
    assert.equal(player(collected, f.bg).spice, bgSpice + (canceled ? 0 : 2));
    assert.deepEqual(physical(collected), committed);
    assert.equal(collected.discard.filter(c => c.id === f.shield).length, mutualTraitors ? 1 : 0);
    assert.equal(collected.discard.filter(c => c.id === f.karama).length, canceled ? 1 : 0);
    assert.deepEqual(inventory(collected), f.originalInventory);
    assert.deepEqual(traitors(collected), f.originalTraitors);
    assert.equal(isAdvisor(player(normalizeAutomaticGame(collected), f.bg), f.territory), canceled);
  });
}

void test('changing the original public battle parent or private cleanup cursor rejects before spending Karama', () => {
  const f = fixture(), pending = commit(f.game, f).game;
  for (const kind of ['receipt', 'cursor'] as const) {
    const invalid = structuredClone(pending);
    if (kind === 'receipt') invalid.pendingAutomaticAdvisorBattle!.receipt.event = 'different-battle';
    else invalid.pendingAutomaticAdvisorBattle!.resume = { kind: 'aftermath' };
    rejected(invalid, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
    assert.ok(player(invalid, f.holder).hand.some(c => c.id === f.karama));
    assert.equal(player(invalid, f.atreides).tanks, player(pending, f.atreides).tanks);
  }
});

void test('a native Lasgun Shield explosion destroys the bystanding advisors without inventing a conversion', () => {
  const f = fixture({ explosion: true }), done = commit(f.game, f).game;
  assert.equal(done.lastBattleContext?.result, 'explosion');
  assert.equal(done.lastBattleContext?.winner, null);
  assert.equal(done.pendingAutomaticAdvisorBattle, undefined);
  assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(done.response?.automaticAdvisorFlip, undefined);
  assert.equal(player(done, f.bg).forces[f.location], undefined);
  assert.equal(player(done, f.bg).tanks, player(f.game, f.bg).tanks + 1);
  const collected = finish(done);
  assert.equal(player(collected, f.bg).spice, player(f.game, f.bg).spice);
  assert.ok(player(collected, f.holder).hand.some(c => c.id === f.karama));
  assert.equal(collected.discard.filter(c => c.id === f.shield).length, 1);
  assert.equal(collected.discard.filter(c => c.id === f.extra).length, 1);
  assert.deepEqual(inventory(collected), f.originalInventory);
});

void test('the four existing profiles resolve both committed battle conversion responses legally without replay', () => {
  for (const mutualTraitors of [false, true]) for (const profile of DIFFICULTIES) {
    const f = fixture({ mutualTraitors }), pending = commit(f.game, f).game;
    const own = viewGame(pending, f.holder); own.players.find(p => p.id === f.holder)!.bot = profile;
    const actions = botActions(own); assert.ok(actions.length);
    const done = finish(allow(act(pending, f.holder, actions[0])));
    assert.equal(done.pendingAutomaticAdvisorBattle, undefined);
    assert.equal(done.phase, 7);
    assert.deepEqual(physical(done), physical(pending));
    assert.deepEqual(inventory(done), f.originalInventory);
  }
});
