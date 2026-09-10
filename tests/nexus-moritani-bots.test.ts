import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { nexusMoritaniBotActions } from '../game/nexus-moritani-options';
import {
  nexusMoritaniFixture,
  nexusMoritaniInventory,
} from './fixture-nexus-moritani';

void test('all four Moritani profiles use Cunning for a public opposing Arrakis group and keep token custody until allowance', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const f = nexusMoritaniFixture();
    // Conserved public target position, staged before the real declaration.
    const target = f.g.players.find((player) => player.id === f.target)!;
    target.reserves -= 3;
    target.forces['red_chasm:7'] = 3;
    const v = viewGame(f.g, f.owner);
    v.players.find((player) => player.id === f.owner)!.bot = profile;
    const before = structuredClone(v);
    const action = botActions(v)[0];
    assert.deepEqual([action], nexusMoritaniBotActions(v));
    assert.equal(action.territory, 'red_chasm');
    assert.equal(action.nexus, v.nexusMoritani!.event);
    const pending = applyAction(f.g, f.owner, action);
    assert.equal(pending.response?.kind, 'moritaniPlacement');
    assert.deepEqual(pending.moritaniTerror, f.g.moritaniTerror);
    nexusMoritaniInventory(pending);
    assert.deepEqual(v, before);
  }
});

void test('Cunning policy reads only public opposing armies, supports an existing stack and retains ordinary fallback', () => {
  const f = nexusMoritaniFixture({ stack: true });
  const target = f.g.players.find((player) => player.id === f.target)!;
  target.reserves -= 2;
  target.forces['arrakeen:10'] = 2;
  const v = viewGame(f.g, f.owner);
  for (const p of v.players.filter((player) => player.id !== f.owner))
    for (const key of ['hand', 'traitors', 'spice'])
      Object.defineProperty(p, key, {
        get() {
          throw new Error('Private opponent data read');
        },
      });
  assert.equal(nexusMoritaniBotActions(v)[0].territory, 'arrakeen');
  v.nexusMoritani!.blocked = 'Not available now';
  assert.deepEqual(nexusMoritaniBotActions(v), []);
  const ordinary = viewGame(f.g, f.owner);
  ordinary.nexusMoritani = null;
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    ordinary.players.find((player) => player.id === f.owner)!.bot = profile;
    const action = botActions(ordinary)[0];
    assert.equal(action.type, 'decision');
    assert.equal(action.nexus, undefined);
    nexusMoritaniInventory(applyAction(f.g, f.owner, action));
  }
});
