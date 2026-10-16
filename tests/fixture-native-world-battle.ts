import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game, type Player } from '../game/engine';
import { isAuditorLeader } from '../game/cards';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups, type HomeworldForces } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { createIndependentCardModulesFixture } from './fixture-independent-card-modules';
import type { NativeReserveSelections } from '../game/homeworld-native-reserves';
import {
  advanceHarassHomeworld, harassHomeworldClean, nextHarassHomeworldStep,
  type HarassHomeworldStep,
} from './fixture-harass-homeworld';

export { REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD };
export type NativeWorldBattleStep = HarassHomeworldStep;
export type NativeWorldBattleOptions = {
  advanced?: boolean;
  route?: 'ix-visitor' | 'ix-native' | 'choam-native';
  /** Actual first-turn export, not a reserve assignment. */
  exportNormal?: number;
  exportElite?: number;
  ownerDial?: number;
  harass?: boolean;
  outcome?: 'win' | 'loss';
  /** Exchange an original unrevealed Face Dancer for the chosen leader. */
  faceDancer?: boolean;
};
export type NativeWorldBattleShipment = { before: Game; step: NativeWorldBattleStep; cost: number; after: Game };
export type NativeWorldBattleFixture = {
  initial: Game; afterSetup: Game; game: Game; options: NativeWorldBattleOptions;
  route: 'ix-visitor' | 'ix-native' | 'choam-native';
  owner: string; opponent: string; native: string; location: string;
  shipments: NativeWorldBattleShipment[];
  snapshots: { afterSetup: Game; beforeBattle: Game; plans: Game };
  beforeBattle: Game; battleStep: NativeWorldBattleStep;
  planActions: [NativeWorldBattleStep, NativeWorldBattleStep];
  sources: NativeReserveSelections; returns: Record<string, HomeworldForces>;
  nativeSteps: NativeWorldBattleStep[]; staging: string[];
};
export const nativeWorldBattlePlayer = (game: Game, actor: string): Player => {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
};
export const nativeWorldBattlePool = (game: Game, actor: string, location: string): HomeworldForces => {
  const world = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!).find(w => w.id === location);
  assert.ok(world); return { ...(world.forces[actor] ?? { normal: 0, elite: 0 }) };
};
const physicalCards = (game: Game) => [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
  ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(c => c.id).sort();
const physicalIdentities = (game: Game) => [...(game.traitorReserve ?? []), ...game.players.flatMap(p =>
  [...p.traitors, ...p.traitorChoices, ...(p.faceDancers ?? []).map(d => d.leader)])].sort();

/** Native reserves already represent the primary World: never count it twice.
 * Ix owns seven Cyborgs in Basic as well as Advanced, not Emperor's five. */
export function assertNativeWorldBattleInventory(game: Game, original: Game): void {
  homeworldGameIntegrity(game);
  const worlds = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  for (const p of game.players) {
    const foreign = worlds.filter(w => w.native !== p.id).map(w => w.forces[p.id] ?? { normal: 0, elite: 0 });
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((n, v) => n + v, 0) +
      foreign.reduce((n, f) => n + f.normal + f.elite, 0), 20, p.faction);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((n, v) => n + v, 0) + foreign.reduce((n, f) => n + f.elite, 0),
    p.faction === 'ixians' ? 7 : p.faction === 'emperor' ? 5 : 3);
  }
  assert.deepEqual(physicalCards(game), physicalCards(original));
  assert.deepEqual(physicalIdentities(game), physicalIdentities(original));
}

function conserveCard(game: Game, actor: string, id: string, staging: string[]): void {
  const owner = nativeWorldBattlePlayer(game, actor);
  if (owner.hand.some(c => c.id === id)) return;
  const at = game.deck.findIndex(c => c.id === id); assert.ok(at >= 0);
  owner.hand.push(game.deck.splice(at, 1)[0]);
  staging.push(`Conserved original ${id}: undealt deck → ${actor}; not a purchase.`);
}
function conserveDancer(game: Game, identity: string, staging: string[]): void {
  const tleilaxu = nativeWorldBattlePlayer(game, 'tleilaxu');
  if (tleilaxu.faceDancers!.some(d => d.leader === identity)) return;
  const dancer = tleilaxu.faceDancers!.find(d => !d.revealed); assert.ok(dancer);
  const returned = dancer.leader;
  const at = game.traitorReserve!.indexOf(identity);
  const donor = game.players.find(p => p.traitors.includes(identity));
  assert.ok(at >= 0 || donor, 'Use an original physical identity, never mint a Face Dancer');
  if (at >= 0) game.traitorReserve!.splice(at, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  dancer.leader = identity;
  staging.push(`Conserved Face Dancer ${identity}: ${donor?.id ?? 'original reserve'} exchanged with Tleilaxu's ${returned}.`);
}

/** Real native setup, paid exports/invasions and original battle preparation.
 * Only unopened Spice order, physical hands and an optional identity exchange
 * are staged. All armies, banks, World faces, phase and receipts stay native. */
export function createNativeWorldBattleFixture(options: NativeWorldBattleOptions = {}): NativeWorldBattleFixture {
  const route = options.route ?? 'ix-visitor';
  const advanced = options.advanced ?? false;
  const setup = createIndependentCardModulesFixture({ advanced, homeworlds: true, tech: false, strongholds: false,
    factions: route === 'choam-native' ? ['choam', 'guild', 'tleilaxu', 'ixians'] : ['ixians', 'tleilaxu', 'guild'],
    expansions: route === 'choam-native' ? ['ix', 'choam'] : ['ix'] });
  let game = setup.game;
  const afterSetup = structuredClone(game), nativeSteps: NativeWorldBattleStep[] = [...setup.steps];
  const staging: string[] = [];
  for (let i = 0; i < (advanced ? 4 : 2); i++) {
    const at = game.spiceDeck.findIndex((c, index) => index >= i && 'territory' in c && !c.discovery);
    assert.ok(at >= i); game.spiceDeck.splice(i, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  staging.push('Position original unopened non-worm Spice Cards for turn one; original Storm and later draws remain untouched.');
  const act = (step: NativeWorldBattleStep) => {
    nativeSteps.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  };
  const reach = (until: (g: Game) => boolean) => { game = advanceHarassHomeworld(game, until, nativeSteps); };
  const shipments: NativeWorldBattleShipment[] = [];
  const ship = (actor: string, destination: string, normal: number, elite: number) => {
    reach(g => g.phase === 5 && g.active === actor && harassHomeworldClean(g));
    const before = structuredClone(game), view = viewGame(game, actor);
    const sources = nativeShipmentSources(view, normal + elite, elite); assert.ok(sources);
    const choice = homeworldShipmentChoice(view, destination,
      Object.fromEntries(Object.entries(sources).filter(([, f]) => f.normal + f.elite > 0)));
    assert.ok(choice.action, choice.blocked ?? 'Original paid native shipment must be available');
    const step = { actor, action: choice.action }; act(step);
    reach(g => !g.pendingHomeworldShipment && !g.pendingShipment && harassHomeworldClean(g));
    shipments.push({ before, step, cost: choice.cost, after: structuredClone(game) });
  };
  const owner = route === 'choam-native' ? 'choam' : 'ixians';
  const opponent = route === 'ix-visitor' ? 'tleilaxu' : 'guild';
  const native = route === 'ix-visitor' ? opponent : owner;
  const location = `homeworld:${native}`;
  // Advanced Guild chooses its real early-shipment window before Ixians.
  if (route === 'ix-native' && advanced) ship('guild', location, 3, 0);
  if (route !== 'choam-native') ship('ixians', route === 'ix-visitor' ? location : 'homeworld:tleilaxu',
    options.exportNormal ?? 9, options.exportElite ?? 0);
  if (route === 'choam-native' || route === 'ix-native' && !advanced) ship('guild', location, 3, 0);
  reach(g => g.phase === 6 && !!g.active && harassHomeworldClean(g));
  // Preserve every original card, including Ix setup draws and CHOAM stock.
  for (const p of game.players) game.deck.push(...p.hand.splice(0));
  staging.push('Return all original hands to unopened stock before conserved card selection; no native stock is omitted.');
  conserveCard(game, owner, REINFORCEMENTS_CARD, staging);
  const harass = options.harass ?? route === 'ix-visitor';
  if (harass || route !== 'ix-visitor') conserveCard(game, owner, HARASS_WITHDRAW_CARD, staging);
  if (route === 'choam-native') {
    const unused = game.deck.find(c => c.id !== REINFORCEMENTS_CARD && c.id !== HARASS_WITHDRAW_CARD);
    assert.ok(unused); conserveCard(game, opponent, unused.id, staging);
  }
  const living = (actor: string) => nativeWorldBattlePlayer(game, actor).leaders.filter(l => !l.dead && !l.usedAt && !isAuditorLeader(l))
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id));
  const win = options.outcome === 'win';
  const ownLeader = route === 'choam-native' && advanced ? nativeWorldBattlePlayer(game, owner).leaders.find(isAuditorLeader)!
    : win ? living(owner).at(-1)! : living(owner)[0];
  const otherLeader = win ? living(opponent)[0] : living(opponent).at(-1)!;
  assert.ok(ownLeader && otherLeader);
  if (options.faceDancer) {
    conserveDancer(game, ownLeader.id, staging);
  }
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(c => c.territory === location); assert.ok(choice);
  const battleStep: NativeWorldBattleStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory: location,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep);
  reach(g => !!g.battle && harassHomeworldClean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false);
  const preview = viewGame(game, owner).battle!.reinforcements; assert.ok(preview && !preview.blocked);
  const positiveSources = preview.homeworldSources?.[0]; assert.ok(positiveSources);
  const dial = options.ownerDial ?? (route === 'choam-native' ? 0 : route === 'ix-native' ? 2 : 1);
  const support = 0;
  const planActions: [NativeWorldBattleStep, NativeWorldBattleStep] = [
    { actor: owner, action: { type: 'battlePlan', dial, support, leader: ownLeader.id,
      weapon: REINFORCEMENTS_CARD, defense: harass ? HARASS_WITHDRAW_CARD : null, reinforcementsSources: positiveSources } },
    { actor: opponent, action: { type: 'battlePlan', dial: win ? 0 : route === 'ix-visitor' ? 3 : 0,
      support: 0, leader: otherLeader.id } },
  ];
  const returns: Record<string, HomeworldForces> = harass
    ? { [location]: { normal: (options.exportNormal ?? 9) - 2, elite: options.exportElite ?? 0 } } : {};
  assertNativeWorldBattleInventory(game, afterSetup);
  return { initial: setup.initial, afterSetup, game, options, route, owner, opponent, native, location,
    shipments, snapshots: { afterSetup, beforeBattle, plans: structuredClone(game) }, beforeBattle, battleStep,
    planActions, sources: positiveSources, returns, nativeSteps, staging };
}

/** Stop at a requested original aftercare decision rather than letting a policy
 * silently decline the native Face Dance, Auditor or Cyborg exchange. */
export function advanceNativeWorldBattle(game: Game, until: (g: Game) => boolean,
  steps: NativeWorldBattleStep[] = [], options: { returns?: Record<string, HomeworldForces>; callers?: string[];
    casualties?: HomeworldForces } = {}): Game {
  for (let n = 0; n < 300; n++) {
    if (until(game)) return game;
    assert.ok(game.battle || game.homeworldBattleLoss || game.decision || game.response || game.phaseOpening,
      'The original battle finished without the requested aftercare decision');
    let step: NativeWorldBattleStep | null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'harassWithdraw') {
      assert.ok(options.returns); step = { actor: game.decision.player,
        action: { type: 'decision', event: game.decision.event, returns: options.returns } };
    } else if (!game.response && !game.phaseOpening && game.decision?.kind === 'battleLosses' && options.casualties) {
      const d = game.decision;
      const choice = d.options.findIndex(f => f.normal === options.casualties!.normal && f.elite === options.casualties!.elite);
      assert.ok(choice >= 0, 'Choose a genuine native typed casualty option');
      step = { actor: d.player, action: { type: 'decision', choice } };
    } else step = nextHarassHomeworldStep(game);
    assert.ok(step, 'Seal actual human plans before continuing');
    if (step.action.type === 'traitorCall') step.action.call = options.callers?.includes(step.actor) ?? false;
    steps.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  throw Error('Native battle programme did not reach the requested aftercare boundary');
}
export function revealNativeWorldBattle(fixture: NativeWorldBattleFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.planActions) {
    game = applyAction(game, step.actor, step.action);
    game = advanceNativeWorldBattle(game, g => harassHomeworldClean(g) && !!g.battle &&
      (!g.battle.preparation && g.battle.preLeader?.closed !== false), [], { returns: fixture.returns });
  }
  assert.ok(game.battle?.revealed); return game;
}
export const nativeWorldBattleFinished = (g: Game) => !g.battle && !g.homeworldBattleLoss && harassHomeworldClean(g);
