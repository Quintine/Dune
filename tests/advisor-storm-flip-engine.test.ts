import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor, fighterCount } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createAdvisorStormFlipFixture as fixture, actAdvisorStormFlip as act,
  commitAdvisorStormFlip as commit, finishAdvisorStormFlip as finish,
  advisorStormFlipPlayer as player, advisorStormFlipInventory as inventory,
} from './fixture-advisor-storm-flip';

function allow(g: Game) {
  for (let count = 0; g.response?.automaticAdvisorFlip && count < 30; count++) {
    const actor = g.players.find(p => !g.response!.passed.includes(p.id)); assert.ok(actor);
    g = act(g, actor.id, { type: 'passResponse' });
  }
  assert.ok(!g.response?.automaticAdvisorFlip); return g;
}
function rejected(g: Game, actor: string, action: Action) {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action)); assert.deepEqual(g, before);
}
const physical = (g: Game) => g.players.map(p => ({ id: p.id, forces: p.forces,
  reserves: p.reserves, tanks: p.tanks, spice: p.spice }));

for (const continues of [false, true]) for (const canceled of [false, true]) {
  void test(`native ${continues ? 'continuing' : 'ending'} storm ${canceled ? 'prevention' : 'allowance'} preserves current losses and resumes only remaining sectors`, () => {
    const f = fixture({ continues }), before = structuredClone(f.game), pending = commit(f.game, f).game;
    assert.deepEqual(f.game, before);
    assert.equal(pending.phase, 0); assert.equal(pending.storm, f.from);
    assert.equal(pending.stormResolution?.traversed, 3); assert.deepEqual(pending.stormResolution?.pending, []);
    assert.equal(pending.decision, null);
    const source = pending.response?.automaticAdvisorFlip; assert.ok(source?.producer === 'storm');
    assert.equal(source.storm.from, f.from); assert.equal(source.storm.distance, f.distance);
    assert.equal(source.storm.traversed, 3); assert.equal(source.storm.sector, 9);
    assert.deepEqual(Object.keys(source.storm).sort(), ['distance', 'event', 'from', 'sector', 'traversed']);
    assert.deepEqual(pending.stormMovementSource, f.stormSource);
    assert.equal(player(pending, f.holder).forces[f.outsiderLocation], undefined);
    assert.equal(player(pending, f.holder).tanks, player(before, f.holder).tanks + 1);
    assert.equal(player(pending, f.bg).forces[f.location], 1);
    assert.equal(fighterCount(player(pending, f.bg), f.territory), 0);
    assert.equal(pending.pendingAutomaticAdvisorStorm?.ready, true);
    assert.ok(viewGame(pending, f.holder).responseControls?.cancelCards.includes(f.karama));
    assert.ok(!JSON.stringify(viewGame(pending, f.holder).response).includes('cursor'));
    const committed = physical(pending);
    for (let read = 0; read < 3; read++) {
      const stable = normalizeAutomaticGame(pending);
      assert.deepEqual(stable.stormResolution, pending.stormResolution);
      assert.deepEqual(physical(stable), committed);
      assert.equal(fighterCount(player(stable, f.bg), f.territory), 0);
    }
    let done = canceled
      ? act(pending, f.holder, { type: 'card', card: f.karama, mode: 'cancel' }) : allow(pending);
    assert.equal(done.pendingAutomaticAdvisorStorm, undefined); assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
    done = finish(done);
    assert.equal(done.phase, 1); assert.equal(done.storm, continues ? 10 : 9);
    assert.equal(done.stormResolution, null); assert.equal(done.stormMovementSource, undefined);
    assert.equal(player(done, f.holder).tanks, player(before, f.holder).tanks + 1);
    assert.equal(player(done, f.holder).forces[f.outsiderLocation], undefined);
    assert.equal(player(done, f.bg).forces[f.location] ?? 0, continues ? 0 : 1);
    assert.equal(player(done, f.bg).tanks, player(before, f.bg).tanks + (continues ? 1 : 0));
    assert.equal(isAdvisor(player(done, f.bg), f.territory), !continues && canceled);
    assert.equal(done.log.filter(entry => entry.text === `Storm moved ${f.distance} sectors to sector ${continues ? 10 : 9}.`).length, 1);
    assert.equal(done.discard.filter(c => c.id === f.karama).length, canceled ? 1 : 0);
    assert.deepEqual(inventory(done), f.originalInventory);
  });
}

void test('a native same-sector storm destroys both counters without manufacturing a conversion', () => {
  const f = fixture({ sameSector: true }), done = finish(commit(f.game, f).game);
  assert.equal(done.pendingAutomaticAdvisorStorm, undefined); assert.equal(done.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(done.response?.automaticAdvisorFlip, undefined);
  assert.equal(player(done, f.bg).forces[f.location], undefined);
  assert.equal(player(done, f.bg).tanks, player(f.game, f.bg).tanks + 1);
  assert.equal(player(done, f.holder).tanks, player(f.game, f.holder).tanks + 1);
  assert.ok(player(done, f.holder).hand.some(c => c.id === f.karama));
  assert.equal(done.phase, 1); assert.equal(done.storm, 9);
  assert.deepEqual(inventory(done), f.originalInventory);
});

void test('a changed private storm cursor rejects before a conversion counter spends its card', () => {
  const f = fixture(), pending = commit(f.game, f).game;
  pending.pendingAutomaticAdvisorStorm!.cursor = 'different-original-sector';
  rejected(pending, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
  assert.ok(player(pending, f.holder).hand.some(c => c.id === f.karama));
  assert.equal(player(pending, f.holder).tanks, player(f.game, f.holder).tanks + 1);
});

void test('all four existing profiles resolve ending and continuing storm conversions legally', () => {
  for (const continues of [false, true]) for (const profile of DIFFICULTIES) {
    const f = fixture({ continues }), pending = commit(f.game, f).game, own = viewGame(pending, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = profile;
    const actions = botActions(own); assert.ok(actions.length);
    const done = finish(allow(act(pending, f.holder, actions[0])));
    assert.equal(done.pendingAutomaticAdvisorStorm, undefined);
    assert.equal(done.phase, 1); assert.equal(done.storm, continues ? 10 : 9);
    assert.equal(player(done, f.holder).tanks, player(pending, f.holder).tanks);
    assert.deepEqual(inventory(done), f.originalInventory);
  }
});
