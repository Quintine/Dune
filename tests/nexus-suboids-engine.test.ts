import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { casualtyOptions } from '../game/combat';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { suboidFixture, boostSuboids } from './fixture-nexus-cunning';
import { nexusAllow, nexusReload, nexusReject } from './fixture-nexus-cards';
function prepare(g: Game) {
  while (g.battle!.preparation) g = applyAction(g, g.battle!.preparation.owner, { type: 'declineBattlePower' });
  if (g.decision?.kind === 'fullPlanOffer') g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}
void test('Ixian Cunning supplies full free Suboid strength in Basic and Advanced without altering Cyborgs or custody', () => {
  for (const advanced of [false, true]) {
    let g = suboidFixture(advanced);
    const before = structuredClone(g.players);
    const ordinary = viewGame(g, 'p').battle!.ownForces!;
    assert.equal(ordinary.normalFixedHalf, true);
    g = boostSuboids(g);
    const boosted = viewGame(g, 'p').battle!.ownForces!;
    assert.equal(boosted.normalFixedHalf, false);
    assert.equal(boosted.normalFreeSupport, true);
    assert.equal(boosted.eliteStrength, ordinary.eliteStrength);
    assert.equal(boosted.freeSupport, ordinary.freeSupport);
    assert.deepEqual(g.players, before);
    assert.ok(casualtyOptions(boosted, 3, 0).some(c => c.normal === 3 && c.elite === 0));
    if (advanced) {
      assert.equal(casualtyOptions(boosted, 7, 0).length, 0);
      assert.ok(casualtyOptions(boosted, 7, 2).length);
      assert.equal(casualtyOptions(boosted, 7, 3).length, 0);
    }
    for (const p of g.players) assert.equal(viewGame(g, p.id).nexusSuboids!.active, true);
    assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), nexusReload(g));
  }
});
void test('Ixian Cunning keeps disclosed half-dial commitments binding and rejects impossible activation without spending the card', () => {
  let g = suboidFixture(true, true);
  g = applyAction(g, 'q', { type: 'prescience', field: 'dial' });
  g = nexusAllow(g);
  g = applyAction(g, 'p', { type: 'prescienceAnswer', value: 0.5 });
  const offer = viewGame(g, 'p').nexusSuboids!.offer!;
  assert.match(offer.blocked!, /commitment/);
  nexusReject(g, 'p', { type: 'nexusSuboids', event: offer.event }, /commitment/);
  assert.equal(g.nexusCards!.cards!.hands.p, 'ixians');
});
void test('Cunning is allowed after compatible Prescience and before own plan even when the opposing plan is sealed', () => {
  let g = suboidFixture(true, true);
  g = applyAction(g, 'q', { type: 'prescience', field: 'dial' }); g = nexusAllow(g);
  g = applyAction(g, 'p', { type: 'prescienceAnswer', value: 1 });
  g = prepare(g);
  g = applyAction(g, 'q', { type: 'battlePlan', dial: 0, leader: g.players[1].leaders[0].id });
  const sealed = structuredClone(g.battle!.plans.q);
  g = boostSuboids(g);
  assert.deepEqual(g.battle!.plans.q, sealed);
  assert.equal(g.battle!.prescience!.value, 1);
  g = applyAction(g, 'p', { type: 'battlePlan', dial: 1, support: 0, leader: g.players[0].leaders[0].id });
  assert.equal(g.battle!.revealed, true);
});
void test('Suboid effect survives a second battle in the same turn and expires without discarding history next turn', () => {
  let g = prepare(boostSuboids(suboidFixture()));
  const first = g.battle!.event;
  for (const id of ['p', 'q']) g = applyAction(g, id, { type: 'battlePlan', dial: 0, leader: g.players.find(p => p.id === id)!.leaders[0].id });
  for (const id of ['p', 'q']) g = applyAction(g, id, { type: 'traitorCall', call: false });
  for (let i = 0; g.battle && i < 25; i++) {
    let acted = false;
    for (const p of g.players) {
      const view = viewGame(g, p.id); view.players.find(x => x.id === p.id)!.bot = 'Easy';
      const action = botActions(view)[0]; if (action) { g = applyAction(g, p.id, action); acted = true; break; }
    }
    assert.ok(acted, `Battle stalled at ${g.decision?.kind}/${g.response?.kind}`);
  }
  assert.equal(g.battle, null);
  g = applyAction(g, 'p', { type: 'chooseBattle', territory: 'hagga_basin', target: 'q' });
  assert.notEqual(g.battle!.event, first);
  assert.equal(viewGame(g, 'p').battle!.ownForces!.normalFreeSupport, true);
  // Advancing only the public turn tests the receipt's lifetime independently
  // of this staged second battle; no result or previous casualty is recomputed.
  g.turn++;
  assert.equal(viewGame(nexusReload(g), 'p').nexusSuboids!.active, false);
  assert.equal(viewGame(g, 'p').battle!.ownForces!.normalFixedHalf, true);
  assert.equal(g.nexusSuboidHistory!.length, 1);
});
void test('stale, foreign, repeated and post-submission Cunning attempts reject unchanged', () => {
  const initial = suboidFixture(), offer = viewGame(initial, 'p').nexusSuboids!.offer!;
  nexusReject(initial, 'q', { type: 'nexusSuboids', event: offer.event }, /Cunning/);
  nexusReject(initial, 'p', { type: 'nexusSuboids', event: 'old' }, /Cunning/);
  nexusReject(initial, 'p', { type: 'nexusSuboids', event: offer.event, support: 0 }, /Cunning/);
  const played = boostSuboids(initial);
  nexusReject(played, 'p', { type: 'nexusSuboids', event: offer.event }, /Cunning/);
  let sealed = prepare(initial);
  sealed = applyAction(sealed, 'p', { type: 'battlePlan', dial: 0, leader: sealed.players[0].leaders[0].id });
  nexusReject(sealed, 'p', { type: 'nexusSuboids', event: offer.event }, /submitted/);
});
void test('edited Suboid receipts reject reads, normalization and actions without changing the saved game', () => {
  const original = boostSuboids(suboidFixture());
  for (const mutate of [
    (g: Game) => { delete g.nexusSuboidHistory; },
    (g: Game) => { delete g.nexusSuboidLast; },
    (g: Game) => { g.nexusSuboidHistory![0].turn++; },
    (g: Game) => { g.nexusSuboidHistory![0].owner = 'q'; },
    (g: Game) => { g.nexusSuboidHistory![0].battle = 'other'; },
    (g: Game) => { g.nexusSuboidHistory!.push(structuredClone(g.nexusSuboidHistory![0])); },
  ]) {
    const bad = nexusReload(original); mutate(bad); const before = JSON.stringify(bad);
    assert.throws(() => viewGame(bad, 'p')); assert.throws(() => normalizeAutomaticGame(bad));
    assert.throws(() => applyAction(bad, 'p', { type: 'advanceBots' })); assert.equal(JSON.stringify(bad), before);
  }
});
void test('all four bot profiles use the actual Cunning offer and submit legal boosted plans', () => {
  for (const level of DIFFICULTIES) {
    let g = prepare(suboidFixture());
    for (let i = 0; !g.battle!.plans.p && i < 8; i++) {
      const v = viewGame(g, 'p'); v.players[0].bot = level;
      const action = botActions(v)[0]; assert.ok(action); g = applyAction(g, 'p', action);
    }
    assert.equal(g.nexusSuboidHistory!.length, 1);
    assert.ok(g.battle!.plans.p);
  }
});
