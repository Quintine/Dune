import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { fighterCount, isAdvisor } from '../game/advisors';
import { quoteBattleBoard, quoteSpiceCollection } from '../game/board-resolution-quote';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createAdvisorAutomaticFlipFixture as fixture,
  actAdvisorAutomaticFlip as act,
  advisorAutomaticFlipPlayer as player,
  advisorAutomaticFlipInventory as inventory,
  passAdvisorAutomaticFlip as pass,
  finishAdvisorAutomaticFlip as finish,
  advanceAdvisorAutomaticFlip as advance,
  advisorAutomaticFlipClean as clean,
} from './fixture-advisor-automatic-flip';

const cancel = (g: Game, f: ReturnType<typeof fixture>) => act(g, f.holder,
  { type: 'card', card: f.card, mode: 'cancel' });
function rejected(g: Game, actor: string, action: Action) {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}

for (const kind of ['arrival', 'departure'] as const) {
  void test(`native ${kind} commits physical ground movement before its mandatory conversion response`, () => {
    const f = fixture({ kind }), before = structuredClone(f.game);
    const pending = act(f.game, f.actor, f.action);
    assert.deepEqual(f.game, before);
    assert.equal(pending.response?.kind, 'advisorFlip');
    assert.equal(pending.response?.automaticAdvisorFlip?.territory, f.territory);
    assert.equal(pending.response?.automaticAdvisorFlip?.mover, f.actor);
    assert.equal(player(pending, f.actor).moved, player(before, f.actor).moved + 1);
    assert.equal(player(pending, f.actor).forces[f.from], undefined);
    assert.equal(player(pending, f.actor).forces[f.to], f.amount);
    assert.equal(isAdvisor(player(pending, f.bg), f.territory), true);
    assert.equal(fighterCount(player(pending, f.bg), f.territory), 0);
    assert.ok(player(pending, f.holder).hand.some(c => c.id === f.card));
    const allowed = pass(pending);
    assert.equal(isAdvisor(player(allowed, f.bg), f.territory), false);
    assert.equal(fighterCount(player(allowed, f.bg), f.territory), 1);
    assert.equal(allowed.pendingAutomaticAdvisorFlips, undefined);
    assert.equal(player(allowed, f.actor).moved, player(pending, f.actor).moved);
    assert.deepEqual(inventory(allowed), f.originalInventory);
    assert.ok(finish(allowed).phase >= 6);
  });

  void test(`native ${kind} cancellation preserves advisors and the original committed movement through phase continuation`, () => {
    const f = fixture({ kind }), pending = act(f.game, f.actor, f.action);
    const stopped = cancel(pending, f), hold = player(stopped, f.bg).advisors?.[f.territory]?.aloneFlipHold;
    assert.ok(hold);
    assert.equal(stopped.response, null);
    assert.equal(stopped.pendingAutomaticAdvisorFlips, undefined);
    assert.equal(player(stopped, f.actor).moved, 1);
    assert.equal(player(stopped, f.actor).forces[f.to], f.amount);
    assert.equal(stopped.discard.filter(c => c.id === f.card).length, 1);
    for (let read = 0; read < 3; read++) {
      const normalized = normalizeAutomaticGame(stopped);
      assert.equal(isAdvisor(player(normalized, f.bg), f.territory), true);
      const own = viewGame(normalized, f.bg).players.find(p => p.id === f.bg)!;
      assert.equal(isAdvisor(own, f.territory), true);
      assert.ok(!quoteBattleBoard(normalized).released.some(r => r.player === f.bg && r.territory === f.territory));
      const collection = quoteSpiceCollection(normalized).receipts.find(r => r.player === f.bg)!;
      assert.equal(collection.strongholds, 0);
      assert.equal(collection.collected, 0);
    }
    const continued = finish(stopped);
    assert.ok(continued.phase >= 6);
    assert.equal(player(continued, f.bg).advisors?.[f.territory]?.aloneFlipHold, hold);
    assert.equal(fighterCount(player(continued, f.bg), f.territory), 0);
    assert.deepEqual(inventory(continued), f.originalInventory);
    rejected(stopped, f.holder, { type: 'card', card: f.card, mode: 'cancel' });
  });
}

void test('an actual outsider return ends the continuously-alone suppression without changing advisor stance', () => {
  const f = fixture({ kind: 'arrival' });
  let g = cancel(act(f.game, f.actor, f.action), f);
  assert.ok(player(g, f.bg).advisors?.[f.territory]?.aloneFlipHold);
  g = advance(g, state => state.phase === 5 && state.active === f.holder && clean(state));
  g = act(g, f.holder, { ...f.action, amount: 10 });
  assert.equal(player(g, f.holder).forces[f.to], 10);
  assert.equal(isAdvisor(player(g, f.bg), f.territory), true);
  assert.equal(player(g, f.bg).advisors?.[f.territory]?.aloneFlipHold, undefined);
  assert.equal(g.pendingAutomaticAdvisorFlips, undefined);
  assert.deepEqual(inventory(g), f.originalInventory);
});

void test('a changed mandatory source rejects before Karama disposal or a second movement', () => {
  const f = fixture(), pending = act(f.game, f.actor, f.action);
  const changed = structuredClone(pending);
  changed.response!.automaticAdvisorFlip = { ...changed.response!.automaticAdvisorFlip!, territory: 'arrakeen' };
  rejected(changed, f.holder, { type: 'card', card: f.card, mode: 'cancel' });
  assert.ok(player(changed, f.holder).hand.some(c => c.id === f.card));
  assert.equal(player(changed, f.actor).moved, 1);
});

void test('four existing profiles can resolve both native mandatory conversions legally', () => {
  for (const kind of ['arrival', 'departure'] as const) for (const profile of DIFFICULTIES) {
    const f = fixture({ kind }), pending = act(f.game, f.actor, f.action);
    const own = viewGame(pending, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = profile;
    const action = botActions(own)[0]; assert.ok(action);
    const settled = pass(act(pending, f.holder, action));
    assert.equal(settled.pendingAutomaticAdvisorFlips, undefined);
    assert.equal(player(settled, f.actor).moved, 1);
    assert.deepEqual(inventory(settled), f.originalInventory);
    assert.ok(finish(settled).phase >= 6);
  }
});
