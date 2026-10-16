import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { combatArmy } from '../game/combat-location';
import type { NativeReserveSelections } from '../game/homeworld-native-reserves';
import type { HomeworldForces } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { takeHarassCard } from './fixture-harass-withdraw';
import {
  actHarassHomeworld, advanceHarassHomeworld, assertHarassHomeworldCustody,
  createHarassHomeworldSetup, harassHomeworldClean, harassHomeworldPlayer,
  harassHomeworldPool, nextHarassHomeworldStep, sealHarassHomeworldPlan,
  type HarassHomeworldSetup, type HarassHomeworldStep,
} from './fixture-harass-homeworld';

export { REINFORCEMENTS_CARD };
export const REINFORCEMENTS_KAITAIN = 'homeworld:emperor';
export const REINFORCEMENTS_SALUSA = 'homeworld:emperor:salusa';
export type ReinforcementsHomeworldStep = HarassHomeworldStep;
export type ReinforcementsHomeworldOptions = {
  advanced?: boolean;
  initial?: Game;
  seatIds?: [string, string, string];
  role?: 'visitor' | 'native';
  secondary?: boolean;
  slot?: 'weapon' | 'defense';
  outcome?: 'win' | 'loss' | 'traitor' | 'explosion';
  /** Real first-turn Kaitain → Salusa movement, never force staging. */
  nativeTransfer?: number;
  sources?: NativeReserveSelections;
  ownerDial?: number;
  ownerSupport?: number;
};
export type ReinforcementsHomeworldFixture = HarassHomeworldSetup & {
  options: ReinforcementsHomeworldOptions;
  role: 'visitor' | 'native';
  location: string;
  native: string;
  visitor: string;
  beforeNativeMove: Game;
  nativeMove: ReinforcementsHomeworldStep | null;
  afterNativeMove: Game;
  beforeShipment: Game;
  shipmentStep: ReinforcementsHomeworldStep;
  afterShipment: Game;
  beforeBattle: Game;
  battleStep: ReinforcementsHomeworldStep;
  game: Game;
  planActions: [ReinforcementsHomeworldStep, ReinforcementsHomeworldStep];
  sources: NativeReserveSelections;
  staging: string[];
};
export const reinforcementsHomeworldPlayer = harassHomeworldPlayer;
export const reinforcementsHomeworldPool = harassHomeworldPool;
export const assertReinforcementsHomeworldCustody = assertHarassHomeworldCustody;
export const advanceReinforcementsHomeworld = advanceHarassHomeworld;
export const reinforcementsHomeworldClean = harassHomeworldClean;
export const sealReinforcementsHomeworldPlan = sealHarassHomeworldPlan;

/** Explicit normal-only fee alternatives; source keys are full native World IDs. */
export function reinforcementsHomeworldSources(salusaNormal = 0): NativeReserveSelections {
  assert.ok(Number.isSafeInteger(salusaNormal) && salusaNormal >= 0 && salusaNormal <= 3);
  return {
    ...(salusaNormal < 3 ? { [REINFORCEMENTS_KAITAIN]: { normal: 3 - salusaNormal, elite: 0 } } : {}),
    ...(salusaNormal > 0 ? { [REINFORCEMENTS_SALUSA]: { normal: salusaNormal, elite: 0 } } : {}),
  };
}
function conserveTraitor(game: Game, actor: string, identity: string, staging: string[]): void {
  const player = harassHomeworldPlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0]; assert.ok(returned);
  const reserveIndex = game.traitorReserve!.indexOf(identity);
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(reserveIndex >= 0 || donor, 'The original Traitor identity must have actual custody');
  if (reserveIndex >= 0) game.traitorReserve!.splice(reserveIndex, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Conserved original Traitor ${identity}: ${donor?.id ?? 'undealt reserve'} exchanged for ${returned}.`);
}

/** Original independent 36-card classic setup, native movement, paid typed
 * invasion and actual chooseBattle/preparation. Only conserved original hands,
 * Traitor identities and unopened Spice order are positioned and labeled.
 * No forces, wallet, phase, history, battle receipt or World face is assigned.
 * Fresh authenticated lobby/seat IDs are accepted for mobile and policy runs. */
export function createReinforcementsHomeworldFixture(
  options: ReinforcementsHomeworldOptions = {},
): ReinforcementsHomeworldFixture {
  const setup = createHarassHomeworldSetup(options);
  const role = options.role ?? 'visitor', outcome = options.outcome ?? 'loss';
  assert.ok(!options.secondary || role === 'native' && setup.afterSetup.advanced);
  assert.ok(outcome !== 'explosion' || options.slot !== 'weapon', 'Lasgun occupies the weapon slot');
  let game = structuredClone(setup.afterSetup);
  const staging: string[] = [];
  for (let i = 0; i < (game.advanced ? 4 : 2); i++) {
    const at = game.spiceDeck.findIndex((c, index) => index >= i && 'territory' in c && !c.discovery);
    assert.ok(at >= i); game.spiceDeck.splice(i, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  staging.push('Position unopened original non-worm Spice Cards for the first native Spice Blow; no phase or storm assignment.');
  const act = (step: ReinforcementsHomeworldStep) => {
    game = actHarassHomeworld(game, step, setup.nativeSteps);
  };
  const reach = (until: (g: Game) => boolean) => {
    game = advanceHarassHomeworld(game, until, setup.nativeSteps);
  };
  reach(g => g.phase === 5 && g.active === setup.owner && harassHomeworldClean(g));
  let beforeNativeMove = structuredClone(game), afterNativeMove = structuredClone(game);
  let nativeMove: ReinforcementsHomeworldStep | null = null;
  const moveNative = () => {
    beforeNativeMove = structuredClone(game);
    if (game.advanced) {
      const normal = options.nativeTransfer ?? (role === 'visitor' || options.secondary ? 2 : 10);
      const movement = viewGame(game, setup.owner).homeworldMove; assert.ok(movement && !movement.blocked);
      nativeMove = { actor: setup.owner, action: { type: 'emperorHomeworldMove', event: movement.event,
        origin: REINFORCEMENTS_KAITAIN, normal, elite: 0 } };
      act(nativeMove);
    } else assert.equal(options.nativeTransfer ?? 0, 0, 'Basic has no inter-World movement');
    afterNativeMove = structuredClone(game);
  };
  // Moving begins movement and consumes the unused shipment opportunity.
  // A visiting Emperor must therefore invade first, then move his reserves.
  if (role === 'native') moveNative();
  const native = role === 'visitor' ? setup.opponent : setup.owner;
  const visitor = role === 'visitor' ? setup.owner : setup.opponent;
  const location = role === 'visitor' ? 'homeworld:guild'
    : options.secondary ? REINFORCEMENTS_SALUSA : REINFORCEMENTS_KAITAIN;
  reach(g => g.phase === 5 && g.active === visitor && harassHomeworldClean(g));
  const beforeShipment = structuredClone(game);
  const amount = role === 'visitor' ? 7 : 5, elite = role === 'visitor' ? 4 : 0;
  const shipmentSources = nativeShipmentSources(viewGame(game, visitor), amount, elite); assert.ok(shipmentSources);
  const choice = homeworldShipmentChoice(viewGame(game, visitor), location,
    Object.fromEntries(Object.entries(shipmentSources).filter(([, f]) => f.normal + f.elite > 0)));
  assert.ok(choice.action, choice.blocked ?? 'The original typed invasion is available');
  const shipmentStep = { actor: visitor, action: choice.action }; act(shipmentStep);
  reach(g => !g.pendingHomeworldShipment && !g.pendingShipment && harassHomeworldClean(g));
  const afterShipment = structuredClone(game);
  assert.deepEqual(combatArmy(game, visitor, location), role === 'visitor'
    ? { normal: 3, elite: 4 } : { normal: 5, elite: 0 });
  if (role === 'visitor') moveNative();
  reach(g => g.phase === 6 && harassHomeworldClean(g) && !!g.active);
  for (const p of game.players) game.deck.push(...p.hand.splice(0));
  takeHarassCard(game, setup.owner, REINFORCEMENTS_CARD);
  let laser: string | undefined, shield: string | undefined;
  if (outcome === 'explosion') {
    laser = game.deck.find(c => c.kind === 'lasgun')!.id;
    shield = game.deck.find(c => c.kind === 'shield')!.id;
    takeHarassCard(game, setup.owner, laser); takeHarassCard(game, setup.opponent, shield);
  }
  staging.push('Return original hands to undealt stock, then conserve the physical Reinforcements and (explosion only) Lasgun/Shield into their owners’ hands; no card is manufactured.');
  const living = (actor: string) => harassHomeworldPlayer(game, actor).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id));
  const ownLeader = outcome === 'win' ? living(setup.owner).at(-1)! : living(setup.owner)[0];
  const otherLeader = outcome === 'win' ? living(setup.opponent)[0] : living(setup.opponent).at(-1)!;
  if (outcome === 'traitor') conserveTraitor(game, native,
    native === setup.owner ? otherLeader.id : ownLeader.id, staging);
  const beforeBattle = structuredClone(game);
  const battleChoice = viewGame(game, game.active!).battleChoices.find(c => c.territory === location);
  assert.ok(battleChoice);
  const battleStep: ReinforcementsHomeworldStep = { actor: battleChoice.chooser,
    action: { type: 'chooseBattle', territory: location,
      target: battleChoice.attacker === battleChoice.chooser ? battleChoice.defender : battleChoice.attacker } };
  act(battleStep);
  reach(g => !!g.battle && harassHomeworldClean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false);
  assert.equal(Object.keys(game.battle!.plans).length, 0);
  const sources = structuredClone(options.sources ?? reinforcementsHomeworldSources());
  const dial = options.ownerDial ?? (role === 'visitor' || outcome === 'win' ? 2 : 0);
  const support = options.ownerSupport ?? (game.advanced ? dial : 0);
  const slot = options.slot ?? 'defense';
  const opponentSupport = game.advanced && outcome !== 'win' && outcome !== 'explosion'
    ? Math.min(role === 'visitor' ? 3 : 5, harassHomeworldPlayer(game, setup.opponent).spice) : 0;
  const opponentDial = outcome === 'win' || outcome === 'explosion' ? 0 : role === 'visitor' ? 3
    : game.advanced ? (5 + opponentSupport) / 2 : 5;
  const planActions: ReinforcementsHomeworldFixture['planActions'] = [
    { actor: setup.owner, action: { type: 'battlePlan', dial, support, leader: ownLeader.id,
      weapon: slot === 'weapon' ? REINFORCEMENTS_CARD : laser ?? null,
      defense: slot === 'defense' ? REINFORCEMENTS_CARD : null,
      reinforcementsSources: sources } },
    { actor: setup.opponent, action: { type: 'battlePlan',
      dial: opponentDial, support: opponentSupport,
      leader: otherLeader.id, defense: shield ?? null } },
  ];
  assertHarassHomeworldCustody(game);
  return { ...setup, options, role, location, native, visitor, beforeNativeMove, nativeMove, afterNativeMove,
    beforeShipment, shipmentStep, afterShipment, beforeBattle, battleStep, game, planActions, sources, staging };
}
export function revealReinforcementsHomeworldBattle(fixture: ReinforcementsHomeworldFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.planActions) game = sealHarassHomeworldPlan(game, step);
  assert.ok(game.battle?.revealed); return game;
}
/** Human-owned native Traitor/explosion choices remain explicit. Real mandatory
 * discard, typed winner casualties and legal aftercare use existing controls. */
export function finishReinforcementsHomeworldBattle(game: Game, options: {
  callers?: string[];
  explosionLosses?: HomeworldForces;
  actions?: ReinforcementsHomeworldStep[];
} = {}): Game {
  for (let n = 0; n < 240; n++) {
    if (!game.battle && !game.homeworldBattleLoss && harassHomeworldClean(game)) return game;
    let step: ReinforcementsHomeworldStep | null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'homeworldExplosion' && options.explosionLosses) {
      const d = game.decision;
      const choice = d.options.findIndex(f => f.normal === options.explosionLosses!.normal && f.elite === options.explosionLosses!.elite);
      assert.ok(choice >= 0, 'Choose a real native typed explosion option');
      step = { actor: d.player, action: { type: 'decision', event: d.event, choice } };
    } else step = nextHarassHomeworldStep(game);
    assert.ok(step, 'Both genuine plans must already be sealed');
    if (step.action.type === 'traitorCall') step.action.call = options.callers?.includes(step.actor) ?? false;
    game = actHarassHomeworld(game, step, options.actions);
  }
  throw Error('Original Reinforcements Homeworld battle did not complete');
}
