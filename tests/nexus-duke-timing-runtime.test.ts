import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { DUKE_VIDAL_ID, dukeController } from '../game/duke-vidal';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';
import { quoteNexusEcazDuke } from '../game/nexus-ecaz-duke';
import {
  advanceNexusDuke, assertNexusDukeCustody, closeNexusDukeDraw,
  createNexusDukeCaptureFixture, nexusDukeClean, nexusDukePlayer,
  openNexusDukeBattle, sealNexusDukeBattle, stepNexusDuke,
} from './fixture-nexus-duke-capture';

void test('quiet Revival Cunning liberates the original captive before native shipment and one battle', () => {
  const f = createNexusDukeCaptureFixture({ variant: 'unused' });
  const closing = closeNexusDukeDraw(f.game, f.plan, f.actions);
  const before = advanceNexusDuke(closing.game,
    g => g.phase === 4 && nexusDukeClean(g), f.plan, f.actions);
  assert.equal(before.nexusCards!.cards!.hands[f.owner], 'ecaz');
  assert.equal(dukeController(before.dukeVidal!), f.captor);
  const action = nexusEcazDukeAction(viewGame(before, f.owner));
  assert.ok(action, 'Printed Cunning is not restricted to the Battle phase.');
  const owner = nexusDukePlayer(before, f.owner);
  const reclaimed = stepNexusDuke(before, f.plan, { actor: f.owner, action }, f.actions);
  assert.equal(reclaimed.phase, before.phase);
  assert.equal(reclaimed.active, before.active, 'The original Revival chooser keeps the turn.');
  assert.equal(dukeController(reclaimed.dukeVidal!), f.owner);
  assert.equal(reclaimed.dukeVidal!.leader.capturedBy, undefined);
  assert.equal(nexusDukePlayer(reclaimed, f.owner).spice, owner.spice);
  assert.equal(nexusDukePlayer(reclaimed, f.owner).leaderRevived, owner.leaderRevived);
  assert.deepEqual(nexusDukePlayer(reclaimed, f.owner).forces, owner.forces);
  assert.equal(reclaimed.nexusCards!.cards!.hands[f.owner], null);
  f.plan.ship = { [f.owner]: { territory: 'carthag', amount: 1 } };
  const b = openNexusDukeBattle(reclaimed, f.plan, f.actions,
    { territory: 'carthag', first: f.owner, second: f.captor });
  const enemy = nexusDukePlayer(b.game, f.captor).leaders
    .filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(enemy);
  const sealed = sealNexusDukeBattle(b.game, f.plan, f.actions, [
    { actor: f.owner, leader: DUKE_VIDAL_ID, dial: 0, support: 0 },
    { actor: f.captor, leader: enemy.id, dial: 0, support: 0 },
  ]);
  const after = advanceNexusDuke(sealed,
    g => !g.battle && nexusDukeClean(g), f.plan, f.actions);
  assert.equal(dukeController(after.dukeVidal!), null);
  assert.equal(after.dukeVidal!.leader.dead, false);
  assert.equal(after.dukeVidal!.leader.usedAt, 'carthag');
  assert.equal(after.dukeVidal!.leader.deaths, before.dukeVidal!.leader.deaths);
  assertNexusDukeCustody(after);
});

void test('early Cunning respects real Ambassador placement and rejects a token carried across phases', () => {
  const f = createNexusDukeCaptureFixture({ variant: 'unused' });
  const closing = closeNexusDukeDraw(f.game, f.plan, f.actions);
  const revival = advanceNexusDuke(closing.game,
    g => g.phase === 4 && nexusDukeClean(g), f.plan, f.actions);
  const stale = nexusEcazDukeAction(viewGame(revival, f.owner));
  assert.ok(stale);
  const placement = advanceNexusDuke(revival,
    g => g.decision?.kind === 'ecazPlacement', f.plan, f.actions);
  const blocked = quoteNexusEcazDuke(placement, f.owner)!;
  assert.ok(blocked.blocked);
  const snapshot = structuredClone(placement);
  assert.throws(() => applyAction(placement, f.owner,
    { type: 'nexusEcazDuke', event: blocked.event }));
  assert.deepEqual(placement, snapshot);
  const quiet = advanceNexusDuke(placement,
    g => g.phase === 5 && nexusDukeClean(g), f.plan, f.actions);
  const before = structuredClone(quiet);
  assert.throws(() => applyAction(quiet, f.owner, stale));
  assert.deepEqual(quiet, before);
  const current = nexusEcazDukeAction(viewGame(quiet, f.owner));
  assert.ok(current);
  const after = stepNexusDuke(quiet, f.plan, { actor: f.owner, action: current }, f.actions);
  assert.equal(after.phase, 5);
  assert.equal(after.active, quiet.active);
  assert.equal(dukeController(after.dukeVidal!), f.owner);
  assert.equal(after.nexusCards!.cards!.discard.filter(c => c === 'ecaz').length, 1);
  assert.equal(after.nexusCards!.cards!.hands[f.owner], null);
  assertNexusDukeCustody(after);
});

void test('unused early Cunning ends at native turn expiry without restoring the former captor', () => {
  const f = createNexusDukeCaptureFixture({ variant: 'unused' });
  const closing = closeNexusDukeDraw(f.game, f.plan, f.actions);
  const before = advanceNexusDuke(closing.game,
    g => g.phase === 4 && nexusDukeClean(g), f.plan, f.actions);
  const action = nexusEcazDukeAction(viewGame(before, f.owner));
  assert.ok(action);
  const reclaimed = stepNexusDuke(before, f.plan, { actor: f.owner, action }, f.actions);
  const after = advanceNexusDuke(reclaimed,
    g => g.turn > reclaimed.turn, f.plan, f.actions);
  assert.equal(dukeController(after.dukeVidal!), null);
  assert.equal(after.dukeVidal!.leader.capturedBy, undefined);
  assert.equal(after.dukeVidal!.leader.dead, false);
  assert.equal(after.dukeVidal!.leader.deaths, before.dukeVidal!.leader.deaths);
  assertNexusDukeCustody(after);
});
