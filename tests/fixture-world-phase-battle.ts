import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { combatArmy } from '../game/combat-location';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import type { NativeReserveSelections } from '../game/homeworld-native-reserves';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import {
  actHarassHomeworld, assertHarassHomeworldCustody, createHarassHomeworldSetup,
  harassHomeworldClean, harassHomeworldPlayer, nextHarassHomeworldStep,
  type HarassHomeworldStep,
} from './fixture-harass-homeworld';
import { createIndependentCardModulesFixture } from './fixture-independent-card-modules';
import { takeHarassCard } from './fixture-harass-withdraw';
import {
  createReinforcementsHomeworldFixture, type ReinforcementsHomeworldFixture,
} from './fixture-reinforcements-homeworld';

export type WorldPhaseBattleStep = HarassHomeworldStep;
export type WorldPhaseBattleOptions = {
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  support?: number;
};
export type WorldPhaseBattleFixture = {
  initial: Game;
  afterSetup: Game;
  beforeFirstMentat: Game;
  firstMentatStep: WorldPhaseBattleStep;
  afterFirstMentat: Game;
  shipments: { before: Game; step: WorldPhaseBattleStep; after: Game }[];
  beforeBattle: Game;
  battleStep: WorldPhaseBattleStep;
  game: Game;
  owner: string;
  opponent: string;
  observer: string;
  location: string;
  plans: [WorldPhaseBattleStep, WorldPhaseBattleStep];
  sources: NativeReserveSelections;
  returns: Record<string, { normal: number; elite: number }>;
  actions: WorldPhaseBattleStep[];
  staging: string[];
};
export const worldPhaseBattlePlayer = harassHomeworldPlayer;
export const worldPhaseBattleClean = harassHomeworldClean;
export const assertWorldPhaseBattleInventory = assertHarassHomeworldCustody;

/** Only the actual first Storm's native lottery/dials use fixed entropy. Later
 * Storms keep their original native draws and movement semantics. */
function firstStormAction(game: Game, step: WorldPhaseBattleStep): Game {
  if (game.turn !== 1 || game.phase !== 0) return applyAction(game, step.actor, step.action);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array); new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255); return array;
  };
  try { return applyAction(game, step.actor, step.action); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actWorldPhaseBattle(game: Game, step: WorldPhaseBattleStep,
  actions?: WorldPhaseBattleStep[]): Game {
  actions?.push(structuredClone(step)); return firstStormAction(game, step);
}
export function advanceWorldPhaseBattle(game: Game, until: (state: Game) => boolean,
  actions?: WorldPhaseBattleStep[]): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextHarassHomeworldStep(game);
    assert.ok(step, 'Supply the genuine human plan or physical return allocation');
    game = actWorldPhaseBattle(game, step, actions);
  }
  throw Error('Original World/phase-module programme did not reach its requested boundary');
}

/** Atreides retains its original ten Arrakeen counters through the actual first
 * END Mentat. Turn two: Guild pays for four native invaders, Atreides pays for
 * four Caladan reinforcements, and Emperor pays to invade Junction with one.
 * The latter real conflict keeps Battle open, separating support/Tech economics
 * from later Collection. No force, wallet, phase, module owner or receipt staging.
 * Existing provisional utility/Stronghold timing is inherited, not a new ruling. */
export function createWorldPhaseBattleFixture(options: WorldPhaseBattleOptions = {}): WorldPhaseBattleFixture {
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const base = options.initial ? createHarassHomeworldSetup({ advanced, initial: options.initial }) : null;
  const original = base ? { initial: base.initial, game: base.afterSetup, steps: base.nativeSteps }
    : createIndependentCardModulesFixture({ advanced, homeworlds: true,
      tech: options.tech ?? true, strongholds: options.strongholds ?? advanced,
      factions: ['emperor', 'guild', 'atreides'] });
  let game = structuredClone(original.game);
  const actions = [...original.steps], initial = structuredClone(original.initial);
  assert.ok(game.homeworlds?.custody);
  if (options.tech !== undefined) assert.equal(!!game.techTokens, options.tech);
  if (options.strongholds !== undefined) assert.equal(!!game.strongholdCards, options.strongholds);
  const afterSetup = structuredClone(game);
  const owner = game.players.find(p => p.faction === 'atreides')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const observer = game.players.find(p => p.faction === 'emperor')!.id;
  const location = 'arrakeen:10';
  const staging = [
    'Only original setup and first-Storm entropy are fixed; all later Storm draws and movement remain native.',
    'Position eight original unopened non-worm Spice Cards for the two actual native Spice Blows; no draw, threshold, force or phase assignment.',
  ];
  for (let position = 0; position < 8; position++) {
    const at = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(at >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  const act = (step: WorldPhaseBattleStep): Game => {
    game = actWorldPhaseBattle(game, step, actions); return game;
  };
  const reach = (until: (state: Game) => boolean) => { game = advanceWorldPhaseBattle(game, until, actions); };
  reach(g => g.phase === 8 && harassHomeworldClean(g));
  let beforeFirstMentat: Game | undefined, firstMentatStep: WorldPhaseBattleStep | undefined;
  while (game.turn === 1) {
    const step = nextHarassHomeworldStep(game); assert.ok(step);
    const before = structuredClone(game), after = act(step);
    if (after.turn === 2) { beforeFirstMentat = before; firstMentatStep = step; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  const afterFirstMentat = structuredClone(game);
  reach(g => g.turn === 2 && g.phase === 5 && harassHomeworldClean(g));
  const shipments: WorldPhaseBattleFixture['shipments'] = [];
  while (game.phase === 5) {
    const actor = game.active!;
    if (harassHomeworldClean(game) && !harassHomeworldPlayer(game, actor).shipped) {
      const amount = actor === observer ? 1 : 4;
      const homeworldSources = nativeShipmentSources(viewGame(game, actor), amount, 0);
      assert.ok(homeworldSources, 'Withdraw original typed native reserves, never guessed source pools');
      const before = structuredClone(game);
      const invasion = actor === observer ? homeworldShipmentChoice(viewGame(game, actor), 'homeworld:guild',
        Object.fromEntries(Object.entries(homeworldSources).filter(([, forces]) => forces.normal + forces.elite > 0))) : null;
      if (invasion) assert.ok(invasion.action, invasion.blocked ?? 'Original typed invasion must be available');
      const step: WorldPhaseBattleStep = { actor, action: invasion?.action ?? { type: 'ship',
        territory: 'arrakeen', sector: 10, amount, elite: 0, homeworldSources, allyPayment: 0 } };
      act(step); reach(harassHomeworldClean);
      shipments.push({ before, step, after: structuredClone(game) });
    } else {
      const step = nextHarassHomeworldStep(game); assert.ok(step); act(step);
    }
  }
  reach(g => g.phase === 6 && harassHomeworldClean(g));
  for (const p of game.players) game.deck.push(...p.hand.splice(0));
  takeHarassCard(game, owner, REINFORCEMENTS_CARD);
  takeHarassCard(game, owner, HARASS_WITHDRAW_CARD);
  staging.push('At the real Battle window, conserve all original hands into undealt stock and position the original Reinforcements and Harass & Withdraw in Atreides’ hand. This is explicit physical card staging, not a natural purchase.');
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(c => c.territory === 'arrakeen'); assert.ok(choice);
  const battleStep: WorldPhaseBattleStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory: 'arrakeen',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep);
  reach(g => !!g.battle && harassHomeworldClean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false);
  const living = (actor: string) => harassHomeworldPlayer(game, actor).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id));
  const leader = living(owner).at(-1)!, opponentLeader = living(opponent)[0];
  const support = advanced ? options.support ?? 3 : 0;
  const sources = { 'homeworld:atreides': { normal: 3, elite: 0 } };
  const plans: WorldPhaseBattleFixture['plans'] = [
    { actor: owner, action: { type: 'battlePlan', dial: 3, support, leader: leader.id,
      weapon: REINFORCEMENTS_CARD, defense: HARASS_WITHDRAW_CARD, reinforcementsSources: sources } },
    { actor: opponent, action: { type: 'battlePlan', dial: 0, support: 0, leader: opponentLeader.id } },
  ];
  const army = combatArmy(game, owner, game.battle!.territory);
  assert.deepEqual(army, { normal: 14, elite: 0 });
  const committed = advanced ? 6 - support : 3;
  const returns = { [location]: { normal: army.normal - committed, elite: 0 } };
  assertHarassHomeworldCustody(game);
  return { initial, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, shipments,
    beforeBattle, battleStep, game, owner, opponent, observer, location, plans, sources, returns, actions, staging };
}

/** Exposes exactly the original source-key controls for a genuine own-World
 * battle: ten normal Kaitain reserves move to Salusa; Guild pays to invade
 * Kaitain. The three fee counters may come from either real normal pool. */
export function createWorldPhaseOwnBattleFixture(options: { initial?: Game; tech?: boolean } = {}): ReinforcementsHomeworldFixture {
  const initial = options.initial ?? createIndependentCardModulesFixture({ advanced: true, homeworlds: true,
    tech: options.tech ?? true, strongholds: true, factions: ['emperor', 'guild', 'atreides'] }).initial;
  const fixture = createReinforcementsHomeworldFixture({ advanced: true, initial, role: 'native', outcome: 'win',
    nativeTransfer: 10, sources: { 'homeworld:emperor:salusa': { normal: 3, elite: 0 } }, ownerDial: 2, ownerSupport: 2 });
  takeHarassCard(fixture.game, fixture.owner, HARASS_WITHDRAW_CARD);
  fixture.staging.push('Conserve original Harass & Withdraw from undealt stock into Emperor’s hand solely to exercise the native own-World ban; never seal it in the legal plan.');
  assertHarassHomeworldCustody(fixture.game);
  return fixture;
}

/** Seven original Emperor visitors invade Junction (3N4E), then two normal
 * reserves move Kaitain → Salusa. R pays 1N Kaitain + 2N Salusa before H returns
 * 2N to Kaitain and 3E to Salusa. Both modules start original and unused. */
export function createWorldPhaseVisitorBattleFixture(options: { initial?: Game } = {}): ReinforcementsHomeworldFixture {
  const initial = options.initial ?? createIndependentCardModulesFixture({ advanced: true, homeworlds: true,
    tech: true, strongholds: true, factions: ['emperor', 'guild', 'atreides'] }).initial;
  const fixture = createReinforcementsHomeworldFixture({ advanced: true, initial, role: 'visitor', outcome: 'win',
    slot: 'weapon', nativeTransfer: 2, ownerDial: 2, ownerSupport: 1,
    sources: { 'homeworld:emperor': { normal: 1, elite: 0 }, 'homeworld:emperor:salusa': { normal: 2, elite: 0 } } });
  takeHarassCard(fixture.game, fixture.owner, HARASS_WITHDRAW_CARD);
  fixture.planActions[0].action.defense = HARASS_WITHDRAW_CARD;
  fixture.staging.push('Conserve original Harass & Withdraw from undealt stock into Emperor’s other physical utility slot; exact post-fee returns remain a human typed allocation.');
  assertHarassHomeworldCustody(fixture.game);
  return fixture;
}

export function revealWorldPhaseBattle(fixture: WorldPhaseBattleFixture,
  plans: readonly WorldPhaseBattleStep[] = fixture.plans): Game {
  let game = structuredClone(fixture.game);
  for (const plan of plans) {
    game = actHarassHomeworld(game, plan);
    game = advanceWorldPhaseBattle(game, g => harassHomeworldClean(g) &&
      !g.battle?.preparation && g.battle?.preLeader?.closed !== false);
  }
  assert.ok(game.battle?.revealed); return game;
}

/** No decision is cleared or fabricated. Callers can stop before an actual
 * Caladan/Tech choice using advanceWorldPhaseBattle and consume its event. */
export function finishWorldPhaseBattle(state: Game, fixture: WorldPhaseBattleFixture,
  actions?: WorldPhaseBattleStep[]): Game {
  let game = state;
  for (let n = 0; n < 240; n++) {
    if (!game.battle && !game.homeworldBattleLoss && harassHomeworldClean(game)) return game;
    let step: WorldPhaseBattleStep | null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'harassWithdraw') {
      step = { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, returns: fixture.returns } };
    } else step = nextHarassHomeworldStep(game);
    assert.ok(step, 'Seal both original plans before finishing their physical aftermath');
    game = actHarassHomeworld(game, step, actions);
  }
  throw Error('Original World utility battle did not finish');
}
