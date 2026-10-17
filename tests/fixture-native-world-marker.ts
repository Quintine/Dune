import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { forceInventory } from '../game/force-inventory';
import type { NativeReserveSelections } from '../game/homeworld-native-reserves';
import {
  createIndependentCardModulesFixture, type IndependentCardModulesStep,
} from './fixture-independent-card-modules';
import {
  createRicheseReinforcementsFixture, RICHESE_HARASS, RICHESE_REINFORCEMENTS,
  type RicheseReinforcementsFixture, type RicheseReinforcementsOptions,
  type RicheseReinforcementsStep,
} from './fixture-richese-reinforcements';

export type NativeWorldMarkerOptions = Omit<RicheseReinforcementsOptions, 'initial' | 'seatIds'> & {
  tech?: boolean;
  strongholds?: boolean;
};
export type NativeWorldMarkerFixture = RicheseReinforcementsFixture & {
  /** Ready but undealt: the original initializer seam for controls/policies. */
  readyLobby: Game;
  readySteps: IndependentCardModulesStep[];
  actors: { owner: string; opponent: string; observer: string };
  source: {
    homeworld: string;
    reservesBeforeReveal: number;
    materializes: number;
    reservesAfterReveal: number;
    feeChoices: NativeReserveSelections[] | undefined;
  };
};

/** Genuine selected-family World programme, with optional all14 training and
 * original Tech/Advanced Strongholds selected before the original initializer.
 * Only that initializer's randomness is scoped. Basic low budgets come from
 * two reveals, real Spice Blow collection and an ordinary paid shipment over
 * four turns. Advanced uses its funded turn-one route, never a staged low budget
 * or frozen later Storm.
 * The inherited staging log explicitly labels conserved physical card moves;
 * none of those moves is represented as a natural purchase. */
export function createNativeWorldMarkerFixture(
  options: NativeWorldMarkerOptions = {},
): NativeWorldMarkerFixture {
  const family = options.family ?? 'choam';
  const selected = createIndependentCardModulesFixture({
    advanced: options.advanced ?? false,
    homeworlds: true,
    tech: options.tech ?? false,
    strongholds: options.strongholds ?? false,
    skills: options.skills,
    training: options.training,
    expansions: family === 'choam' ? ['choam'] : ['ix', 'choam'],
    factions: family === 'choam' ? ['richese', 'guild', 'atreides'] : ['richese', 'ixians', 'atreides'],
  });
  const readyLobby = selected.initial;
  const fixture = createRicheseReinforcementsFixture({ ...options, family, initial: readyLobby });
  const view = viewGame(fixture.game, fixture.richese);
  const homeworld = view.homeworlds?.worlds?.find(home => home.native === fixture.richese && !home.secondary);
  const preview = view.battle!.reinforcements!;
  assert.ok(homeworld && preview.noField);
  return {
    ...fixture,
    readyLobby,
    readySteps: selected.steps.filter(step => step.action.type === 'ready'),
    actors: { owner: fixture.richese, opponent: fixture.opponent, observer: fixture.observer },
    source: {
      homeworld: homeworld.id,
      reservesBeforeReveal: homeworld.forces[fixture.richese].normal,
      materializes: preview.noField.materializes,
      reservesAfterReveal: preview.noField.reservesAfterReveal,
      feeChoices: structuredClone(preview.homeworldSources),
    },
  };
}

/** Original public inventory counts native Worlds within reserves exactly once,
 * keeps foreign visitors separate and preserves Ixian elite identity. */
export function nativeWorldMarkerInventory(game: Game, actor: string) {
  const view = viewGame(game, actor);
  const player = view.players.find(seat => seat.id === actor);
  const worlds = view.homeworlds?.worlds;
  assert.ok(player && worlds);
  const inventory = forceInventory(player, worlds);
  assert.ok(inventory, `Original native force inventory is inconsistent for ${actor}`);
  return inventory;
}

/** Both independent machines may occupy either actual battle-plan slot. For a
 * combined plan slot selects R's slot; H occupies the other. The fee allocation
 * is the owner's real preview quote, never an inferred native source split. */
export function nativeWorldMarkerPlan(fixture: NativeWorldMarkerFixture,
  mode: 'reinforcements' | 'both' | 'harass' | 'plain' = 'reinforcements',
  slot: 'weapon' | 'defense' = 'weapon'): RicheseReinforcementsStep {
  const step = structuredClone(fixture.plans.plain);
  step.action.weapon = null;
  step.action.defense = null;
  if (mode === 'reinforcements' || mode === 'both') {
    step.action[slot] = RICHESE_REINFORCEMENTS;
    const sources = fixture.source.feeChoices?.[0];
    if (sources) step.action.reinforcementsSources = structuredClone(sources);
  }
  if (mode === 'harass') step.action[slot] = RICHESE_HARASS;
  if (mode === 'both') step.action[slot === 'weapon' ? 'defense' : 'weapon'] = RICHESE_HARASS;
  return step;
}
