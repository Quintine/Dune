import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { combatArmy } from '../game/combat-location';
import { nativeShipmentSources } from '../game/homeworld-options';
import type { NativeReserveSelections } from '../game/homeworld-native-reserves';
import type { HomeworldForces } from '../game/homeworld-custody';
import { createIndependentCardModulesFixture, type IndependentCardModulesOptions } from './fixture-independent-card-modules';
import { actWorldPhaseBattle, advanceWorldPhaseBattle } from './fixture-world-phase-battle';
import { harassHomeworldClean, nextHarassHomeworldStep } from './fixture-harass-homeworld';
import { takeHarassCard } from './fixture-harass-withdraw';
import {
  advanceNativeWorldBattle, assertNativeWorldBattleInventory, conserveDancer, createNativeWorldBattleFixture,
  HARASS_WITHDRAW_CARD, nativeWorldBattleFinished, nativeWorldBattlePlayer,
  REINFORCEMENTS_CARD, type NativeWorldBattleFixture, type NativeWorldBattleStep,
} from './fixture-native-world-battle';

export type NativeWorldPhaseBattleOptions = {
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  skills?: boolean;
  training?: IndependentCardModulesOptions['training'];
  skilled?: boolean;
  harass?: boolean;
  /** Actual Cyborg support, never support for Reinforcements' score-only +2. */
  support?: 0 | 1 | 3;
};
export type NativeWorldPhaseBattleFixture = {
  initial: Game;
  afterSetup: Game;
  beforeFirstMentat: Game;
  firstMentatStep: NativeWorldBattleStep;
  afterFirstMentat: Game;
  shipments: { before: Game; step: NativeWorldBattleStep; after: Game }[];
  beforeBattle: Game;
  battleStep: NativeWorldBattleStep;
  /** Original prepared battle, no sealed plans. */
  game: Game;
  owner: string;
  opponent: string;
  observer: string;
  location: string;
  planActions: [NativeWorldBattleStep, NativeWorldBattleStep];
  sources: NativeReserveSelections;
  returns: Record<string, HomeworldForces>;
  nativeSteps: NativeWorldBattleStep[];
  staging: string[];
};

/** Arrakeen's held card applies only in Arrakeen, never on a foreign World.
 * Ix therefore really pays to place 3 Suboids + 3 Cyborgs there on turn one,
 * earns the card at original END Mentat, then meets a paid Guild attack on
 * turn two. The three-force R fee still comes from original native Ix custody.
 * A conserved matching Face Dancer offers its original optional continuation,
 * exposing the settled support invoice before Collection. No army/wallet/phase/
 * owner or module receipt is assigned.
 */
export function createNativeWorldPhaseBattleFixture(
  options: NativeWorldPhaseBattleOptions = {},
): NativeWorldPhaseBattleFixture {
  const advanced = options.advanced ?? true;
  const setup = createIndependentCardModulesFixture({ advanced, homeworlds: true,
    tech: options.tech ?? true, strongholds: options.strongholds ?? advanced,
    skills: options.skills, training: options.training,
    factions: ['ixians', 'tleilaxu', 'guild'], expansions: ['ix'] });
  let game = setup.game;
  const afterSetup = structuredClone(game), nativeSteps = [...setup.steps];
  const owner = 'ixians', opponent = 'guild', observer = 'tleilaxu', location = 'arrakeen:10';
  const staging = [
    'Original setup and first-Storm entropy only are fixed; later Storm Cards and movement stay original.',
    'Position eight original unopened non-worm Spice Cards for the first two native Spice Blows; no replacement face or phase assignment.',
  ];
  for (let position = 0; position < 8; position++) {
    const at = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(at >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  const act = (step: NativeWorldBattleStep) => {
    game = actWorldPhaseBattle(game, step, nativeSteps); return game;
  };
  const reach = (until: (g: Game) => boolean) => { game = advanceWorldPhaseBattle(game, until, nativeSteps); };
  const shipments: NativeWorldPhaseBattleFixture['shipments'] = [];
  const ship = (actor: string, amount: number, elite: number) => {
    const before = structuredClone(game), view = viewGame(game, actor);
    const sources = nativeShipmentSources(view, amount, elite); assert.ok(sources);
    const step: NativeWorldBattleStep = { actor, action: {
      type: 'ship', territory: 'arrakeen', sector: 10, amount, elite, homeworldSources: sources, allyPayment: 0,
    } };
    act(step);
    reach(g => harassHomeworldClean(g) && !g.pendingShipment && !g.pendingHomeworldShipment);
    shipments.push({ before, step, after: structuredClone(game) });
  };
  reach(g => g.turn === 1 && g.phase === 5 && g.active === owner && harassHomeworldClean(g));
  ship(owner, 6, 3);
  assert.deepEqual(combatArmy(game, owner, 'arrakeen'), { normal: 3, elite: 3 });
  reach(g => g.turn === 1 && g.phase === 8 && harassHomeworldClean(g));
  let beforeFirstMentat: Game | undefined, firstMentatStep: NativeWorldBattleStep | undefined;
  while (game.turn === 1) {
    const step = nextHarassHomeworldStep(game); assert.ok(step);
    const before = structuredClone(game), after = act(step);
    if (after.turn === 2) { beforeFirstMentat = before; firstMentatStep = step; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  const afterFirstMentat = structuredClone(game);
  reach(g => g.turn === 2 && g.phase === 5 && harassHomeworldClean(g));
  while (game.phase === 5) {
    const actor = game.active!;
    if (harassHomeworldClean(game) && !nativeWorldBattlePlayer(game, actor).shipped && actor === opponent)
      ship(actor, 3, 0);
    else {
      const step = nextHarassHomeworldStep(game); assert.ok(step); act(step);
    }
  }
  reach(g => g.phase === 6 && !!g.active && harassHomeworldClean(g));
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  takeHarassCard(game, owner, REINFORCEMENTS_CARD);
  if (options.harass ?? true) takeHarassCard(game, owner, HARASS_WITHDRAW_CARD);
  staging.push('Return all original hands, including Ix setup stock, to undealt stock; conserve original R and optional H into Ix’s real slots. This is not a purchase.');
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(c => c.territory === 'arrakeen'); assert.ok(choice);
  const battleStep: NativeWorldBattleStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory: 'arrakeen',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep);
  game = advanceNativeWorldBattle(game, g => !!g.battle && harassHomeworldClean(g) &&
    !g.battle.preparation && g.battle.preLeader?.closed !== false, nativeSteps,
    { skilled: options.skilled ? [owner] : [] });
  const living = (actor: string) => nativeWorldBattlePlayer(game, actor).leaders.filter(l => !l.dead && !l.usedAt &&
    (!game.leaderSkills?.assignments.some(a => a.owner === actor && a.leader === l.id) || actor === owner && options.skilled))
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id));
  const trainer = options.skilled ? game.leaderSkills?.assignments.find(a => a.owner === owner) : null;
  assert.ok(!options.skilled || trainer, 'Select Skills before native setup to use its real trainer');
  const ownLeader = trainer ? living(owner).find(l => l.id === trainer.leader)! : living(owner).at(-1)!;
  const otherLeader = living(opponent)[0];
  assert.ok(ownLeader && otherLeader);
  conserveDancer(game, ownLeader.id, staging);
  const support = advanced ? options.support ?? 3 : 0;
  const sources = { 'homeworld:ixians': { normal: 3, elite: 0 } };
  // Exactly three Cyborgs are committed in every programme. At half support
  // they dial three; each actually supported Cyborg adds one, not another token.
  const planActions: NativeWorldPhaseBattleFixture['planActions'] = [
    { actor: owner, action: { type: 'battlePlan', dial: advanced ? 3 + support : 6, support,
      leader: ownLeader.id, weapon: REINFORCEMENTS_CARD, defense: (options.harass ?? true) ? HARASS_WITHDRAW_CARD : null,
      reinforcementsSources: sources } },
    { actor: opponent, action: { type: 'battlePlan', dial: 0, support: 0, leader: otherLeader.id } },
  ];
  const returns = { [location]: { normal: 3, elite: 0 } };
  assert.deepEqual(game.battle!.plans, {});
  assertNativeWorldBattleInventory(game, afterSetup);
  return { initial: setup.initial, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, shipments,
    beforeBattle, battleStep, game, owner, opponent, observer, location, planActions, sources, returns, nativeSteps, staging };
}

export function revealNativeWorldPhaseBattle(fixture: NativeWorldPhaseBattleFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.planActions) {
    game = applyAction(game, step.actor, step.action);
    game = advanceNativeWorldBattle(game, g => !!g.battle && harassHomeworldClean(g) &&
      !g.battle.preparation && g.battle.preLeader?.closed !== false, [], { returns: fixture.returns });
  }
  assert.ok(game.battle?.revealed); return game;
}
export function settleNativeWorldPhaseBattle(game: Game, fixture: NativeWorldPhaseBattleFixture): Game {
  return advanceNativeWorldBattle(game, g => g.decision?.kind === 'faceDance', [],
    { returns: fixture.returns, casualties: { normal: 0, elite: 3 } });
}
export function finishNativeWorldPhaseBattle(game: Game, fixture: NativeWorldPhaseBattleFixture,
  steps: NativeWorldBattleStep[] = []): Game {
  if (game.decision?.kind === 'faceDance' && !game.response && !game.phaseOpening) {
    const step: NativeWorldBattleStep = { actor: game.decision.player, action: { type: 'decision', reveal: false } };
    steps.push(step); game = applyAction(game, step.actor, step.action);
  }
  return advanceNativeWorldBattle(game, nativeWorldBattleFinished, steps,
    { returns: fixture.returns, casualties: { normal: 0, elite: 3 } });
}

/** Original native programmes with unused modules, not invented module benefits.
 * The visitor variant retains exact mixed fee custody and optional native
 * Cyborg/Face Dance aftercare; own Ix retains its original H prohibition.
 */
export function createNativeWorldPhaseForeignBattleFixture(options: {
  advanced?: boolean; typedAftercare?: boolean; skills?: boolean;
  training?: IndependentCardModulesOptions['training']; skilled?: boolean;
} = {}): NativeWorldBattleFixture {
  const advanced = options.advanced ?? true;
  return createNativeWorldBattleFixture({ advanced, tech: true, strongholds: advanced,
    skills: options.skills, training: options.training, skilled: options.skilled,
    ...(options.typedAftercare ? { exportNormal: 9, exportElite: 1, ownerDial: advanced ? 1 : 2,
      harass: false, outcome: 'win' as const, faceDancer: true } : {}) });
}
export function createNativeWorldPhaseOwnBattleFixture(advanced = true,
  options: Pick<NativeWorldPhaseBattleOptions, 'skills' | 'training' | 'skilled'> = {}): NativeWorldBattleFixture {
  return createNativeWorldBattleFixture({ advanced, tech: true, strongholds: advanced, route: 'ix-native', ...options });
}
