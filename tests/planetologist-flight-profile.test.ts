import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { planetologistMovementModeSupported } from '../game/planetologist-movement';
import { createDiscoveryNativeE2SkillsFixture } from './fixture-discovery-native-e2-skills';

void test('native Discovery skill projections retain the existing enabled module for movement eligibility', () => {
  for (const advanced of [false, true]) {
    const f = createDiscoveryNativeE2SkillsFixture({ advanced });
    assert.equal(f.game.discoveryEnabled, true);
    assert.equal(planetologistMovementModeSupported(f.game), true);
    for (const actor of [f.richese, f.choam, f.guild]) {
      const projected = viewGame(f.game, actor);
      assert.equal(projected.lobbyModules, null);
      assert.equal(planetologistMovementModeSupported(projected), true);
    }
  }
});
