import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, RuleError, viewGame } from '../game/engine';
import { createIndependentCardModulesFixture } from './fixture-independent-card-modules';
import {
  createRicheseReinforcementsFixture, finishRicheseReinforcementsBattle,
  prepareRicheseReinforcementsPlan, RICHESE_REINFORCEMENTS,
  richeseReinforcementsPlayer, sealRicheseReinforcementsPlan,
} from './fixture-richese-reinforcements';

function markerFixture(advanced: boolean) {
  const setup = createIndependentCardModulesFixture({ advanced, homeworlds: true,
    tech: true, strongholds: advanced, expansions: ['choam'], factions: ['richese', 'guild', 'atreides'] });
  return createRicheseReinforcementsFixture({ advanced, family: 'choam', marker: 3,
    ...(advanced ? {} : { reserves: 5 }), initial: setup.initial });
}

void test('Basic native World Tech income cannot fund a marker fee from future withdrawal counters', () => {
  const f = markerFixture(false);
  const before = structuredClone(f.game);
  const preview = viewGame(f.game, f.richese).battle!.reinforcements!;
  assert.deepEqual(preview.noField, { materializes: 3, reservesAfterReveal: 2 });
  assert.ok(preview.blocked);
  const raw = { ...f.plans.reinforcements.action };
  delete raw.reinforcementsSources;
  assert.throws(() => applyAction(f.game, f.richese, raw), RuleError);
  assert.deepEqual(f.game, before);
  const first = prepareRicheseReinforcementsPlan(f.game, f.plans.harass);
  const done = finishRicheseReinforcementsBattle(sealRicheseReinforcementsPlan(first, f.plans.opponent));
  const owner = richeseReinforcementsPlayer(done, f.richese);
  assert.equal(owner.reserves, 3);
  assert.equal(owner.tanks, 2);
  assert.ok(owner.hand.some(card => card.id === RICHESE_REINFORCEMENTS));
});

void test('Advanced native World Tech and Strongholds keep marker materialization and the later reserve fee disjoint', () => {
  const f = markerFixture(true);
  const first = prepareRicheseReinforcementsPlan(f.game, f.plans.reinforcements);
  assert.equal(richeseReinforcementsPlayer(first, f.richese).reserves, 20);
  assert.ok(richeseReinforcementsPlayer(first, f.richese).noField!.deployed);
  const revealed = sealRicheseReinforcementsPlan(first, f.plans.opponent);
  assert.equal(richeseReinforcementsPlayer(revealed, f.richese).reserves, 17);
  assert.equal(richeseReinforcementsPlayer(revealed, f.richese).tanks, 0);
  const done = finishRicheseReinforcementsBattle(revealed);
  const owner = richeseReinforcementsPlayer(done, f.richese);
  assert.equal(owner.reserves, 14);
  assert.equal(owner.tanks, 6);
  const home = viewGame(done, f.richese).homeworlds?.worlds?.find(world => world.native === f.richese);
  assert.deepEqual(home?.forces[f.richese], { normal: 14, elite: 0 });
  assert.equal(done.discard.filter(card => card.id === RICHESE_REINFORCEMENTS).length, 1);
});
