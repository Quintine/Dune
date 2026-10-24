import test from 'node:test';
import assert from 'node:assert/strict';
import { viewGame } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import {
  createAdvisorPreparationFixture as fixture,
  actAdvisorPreparation as act,
  passAdvisorPreparationResponses as pass,
  advisorPreparationPlayer as player,
  advisorPreparationInventory as inventory,
  shipAdvisorPreparation as ship,
} from './fixture-advisor-preparation';

for (const phase of [2, 3, 4] as const) {
  void test(`native phase${phase} advisor preparation preserves the original phase and controls after allowance`, () => {
    const f = fixture({ phase }), before = structuredClone(f.game);
    assert.equal(isAdvisor(player(f.game, f.bg), 'arrakeen'), true);
    assert.ok(viewGame(f.game, f.bg).advisorPreparation?.territories.includes('arrakeen'));
    let g = act(f.game, f.bg, f.preparation);
    assert.equal(g.response?.kind, 'advisorFlip');
    assert.equal(g.response?.advisorResume, 'preparation');
    assert.equal(isAdvisor(player(g, f.bg), 'arrakeen'), true);
    assert.ok(viewGame(g, f.observer).responseControls?.cancelCards.includes(f.karama));
    g = pass(g);
    assert.equal(g.phase, phase);
    assert.equal(g.active, before.active);
    assert.deepEqual(g.auction, before.auction);
    assert.deepEqual(g.ready, before.ready);
    assert.deepEqual(g.movementRemaining, before.movementRemaining);
    assert.deepEqual(g.players.map(p => [p.id, p.forces, p.reserves, p.spice, p.shipped, p.moved]),
      before.players.map(p => [p.id, p.forces, p.reserves, p.spice, p.shipped, p.moved]));
    assert.equal(isAdvisor(player(g, f.bg), 'arrakeen'), false);
    assert.deepEqual(inventory(g), f.originalInventory);
    assert.deepEqual(f.game, before);
  });
  void test(`native phase${phase} Karama prevents only that preparation without moving the interrupted phase`, () => {
    const f = fixture({ phase });
    let g = act(f.game, f.bg, f.preparation);
    g = act(g, f.observer, { type: 'card', card: f.karama, mode: 'cancel' });
    assert.ok(!g.response);
    assert.equal(g.phase, phase);
    assert.equal(isAdvisor(player(g, f.bg), 'arrakeen'), true);
    assert.deepEqual(g.advisorPreparation?.deniedTerritories, ['arrakeen']);
    assert.deepEqual(g.auction, f.game.auction);
    assert.deepEqual(g.ready, f.game.ready);
    assert.equal(g.discard.filter(c => c.id === f.karama).length, 1);
    const before = structuredClone(g);
    assert.throws(() => act(g, f.bg, f.preparation), /eligible|prevent/i);
    assert.deepEqual(g, before);
    assert.match(viewGame(g, f.bg).advisorPreparation?.blocked ?? '', /Karama/);
    assert.deepEqual(inventory(g), f.originalInventory);
  });
}
void test('declining the native phase5 chooser leaves the printed window open for a later declaration', () => {
  const f = fixture({ phase: 5, declineOffer: true });
  assert.equal(f.game.decision, null);
  const active = f.game.active;
  assert.ok(active);
  const g = pass(act(f.game, f.bg, f.preparation));
  assert.equal(g.phase, 5);
  assert.equal(g.active, active);
  assert.equal(isAdvisor(player(g, f.bg), 'arrakeen'), false);
  assert.equal(g.advisorPreparation?.firstShipment, null);
  assert.deepEqual(g.movementRemaining, f.game.movementRemaining);
});
void test('the first actual native shipment closes preparation before its arrival followups', () => {
  const f = fixture({ phase: 5, declineOffer: true });
  const shipped = ship(f.game), g = shipped.after;
  assert.deepEqual(g.advisorPreparation?.firstShipment, { player: f.game.active, producer: 'ordinary' });
  assert.equal(isAdvisor(player(g, f.bg), 'arrakeen'), true);
  const before = structuredClone(g);
  assert.throws(() => act(g, f.bg, f.preparation), /first shipment/);
  assert.deepEqual(g, before);
  assert.deepEqual(inventory(g), f.originalInventory);
});
void test('native canceled phase5 preparation cannot be bypassed through the new manual control', () => {
  const f = fixture({ phase: 5 });
  let g = act(f.game, f.bg, { type: 'decision', accept: true, territory: 'arrakeen' });
  assert.ok(g.response?.advisorPreparationSource);
  g = act(g, f.observer, { type: 'card', card: f.karama, mode: 'cancel' });
  assert.ok(!g.response);
  assert.equal(g.phase, 5);
  assert.equal(isAdvisor(player(g, f.bg), 'arrakeen'), true);
  assert.deepEqual(g.advisorPreparation?.deniedTerritories, ['arrakeen']);
  assert.throws(() => act(g, f.bg, f.preparation), /eligible|prevent/i);
});
void test('ending an unshipped native turn leaves the printed preparation window open', () => {
  const f = fixture({ phase: 5, declineOffer: true });
  assert.ok(f.game.active);
  let g = act(f.game, f.game.active, { type: 'endMovement' });
  assert.equal(g.phase, 5);
  assert.equal(g.movementRemaining!.includes(f.game.active), false);
  assert.equal(g.advisorPreparation?.firstShipment, null);
  const active = g.active;
  g = pass(act(g, f.bg, f.preparation));
  assert.equal(g.active, active);
  assert.equal(isAdvisor(player(g, f.bg), 'arrakeen'), false);
});
void test('a changed preparation source rejects before a real Karama is spent', () => {
  const f = fixture();
  for (const change of ['turn', 'territory', 'stance']) {
    const g = act(f.game, f.bg, f.preparation);
    assert.ok(g.response?.advisorPreparationSource);
    if (change === 'turn') g.response.advisorPreparationSource.turn++;
    if (change === 'territory') g.response.advisorPreparationSource.territory = 'carthag';
    if (change === 'stance') g.response.advisors = true;
    const before = structuredClone(g);
    assert.throws(() => act(g, f.observer, { type: 'card', card: f.karama, mode: 'cancel' }), /source|owner|territory/);
    assert.deepEqual(g, before);
    assert.ok(player(g, f.observer).hand.some(c => c.id === f.karama));
    assert.equal(g.discard.some(c => c.id === f.karama), false);
  }
});
