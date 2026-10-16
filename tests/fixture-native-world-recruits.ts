import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { combatArmy } from '../game/combat-location';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { forceRevivalQuote } from '../game/revival';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { createIndependentCardModulesFixture } from './fixture-independent-card-modules';
import { nextHarassHomeworldStep } from './fixture-harass-homeworld';
import { takeHarassCard } from './fixture-harass-withdraw';

export type NativeWorldRecruitsFaction = 'ixians' | 'tleilaxu' | 'choam' | 'richese';
export type NativeWorldRecruitsStep = { actor: string; action: Action };
export type NativeWorldRecruitsFixture = {
  initial: Game;
  afterSetup: Game;
  beforeShipment: Game;
  shipmentStep: NativeWorldRecruitsStep;
  shipmentPrice: number;
  afterShipment: Game;
  beforeBattle: Game;
  battleStep: NativeWorldRecruitsStep;
  planSteps: NativeWorldRecruitsStep[];
  afterBattle: Game;
  /** Quiet original second-turn Revival, with the conserved card in owner's hand. */
  game: Game;
  owner: string;
  native: string;
  visitor: string;
  location: string;
  steps: NativeWorldRecruitsStep[];
  staging: string[];
};

export function nativeWorldRecruitsPlayer(game: Game, actor: string) {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing native seat ${actor}`);
  return player;
}
export const nativeWorldRecruitsClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard;

/** Original native choices, never a population, wallet, phase or saved receipt edit.
 * An unrequested Face Dancer is declined; every other window keeps its original
 * continuation and the whole remaining programme is driven by it. */
export function nextNativeWorldRecruitsStep(game: Game): NativeWorldRecruitsStep | null {
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'faceDance')
    return { actor: game.decision.player, action: { type: 'decision', reveal: false } };
  return nextHarassHomeworldStep(game);
}

export function advanceNativeWorldRecruits(game: Game, until: (state: Game) => boolean,
  steps: NativeWorldRecruitsStep[] = []): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'Native revival programme must reach its requested boundary');
    const step = nextNativeWorldRecruitsStep(game);
    assert.ok(step, 'Supply actual human battle plans before continuing');
    steps.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  }
  throw Error('Native World Recruits programme did not reach its boundary');
}

/** Native World stock is already included in aggregate reserves; foreign World
 * visitors are separate. Ix has seven physical cyborgs, not Emperor's five. */
export function assertNativeWorldRecruitsInventory(game: Game): void {
  homeworldGameIntegrity(game);
  const homes = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  for (const player of game.players) {
    const visitors = homes.filter(home => home.native !== player.id)
      .map(home => home.forces[player.id] ?? { normal: 0, elite: 0 });
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((a, b) => a + b, 0) +
      visitors.reduce((sum, group) => sum + group.normal + group.elite, 0), 20, player.faction);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((a, b) => a + b, 0) +
      visitors.reduce((sum, group) => sum + group.elite, 0), player.faction === 'ixians' ? 7 : 5);
  }
}

/** An Emperor pays to invade the actual native World. Unarmed original leaders
 * let the defender lose its whole home army without shipping it or spending its
 * wallet. The optional all-Sardaukar dial creates two real Imperial casualties
 * for the ordinary elite cap. No stock is fabricated/reset. */
export function createNativeWorldRecruitsFixture(options: {
  advanced?: boolean;
  faction?: NativeWorldRecruitsFaction;
  imperialCasualties?: boolean;
} = {}): NativeWorldRecruitsFixture {
  const native = options.faction ?? 'ixians';
  const setup = createIndependentCardModulesFixture({ advanced: options.advanced ?? false,
    homeworlds: true, tech: false, strongholds: false, factions: ['emperor', native, 'guild'],
    expansions: native === 'ixians' || native === 'tleilaxu' ? ['ix'] : ['choam'] });
  let game = setup.game;
  const afterSetup = structuredClone(game), steps = [...setup.steps];
  assert.equal(setup.initial.status, 'lobby');
  assert.ok(setup.initial.homeworlds, 'The undealt ready lobby must have Homeworlds selected');
  assert.deepEqual(game.expansions, native === 'ixians' || native === 'tleilaxu' ? ['ix'] : ['choam']);
  assert.equal(game.status, 'playing');
  for (const [name, value] of [['Tech Tokens', game.techTokens], ['Stronghold Cards', game.strongholdCards],
    ['Nexus Cards', game.nexusCards], ['Leader Skills', game.leaderSkills],
    ['Discovery', game.discoveryEnabled]] as const)
    assert.equal(value, undefined, `${name} must stay outside a native World Recruits programme`);
  const visitor = 'emperor', owner = visitor;
  const worlds = viewGame(game, native).homeworlds?.worlds;
  assert.ok(worlds, 'A native World programme needs its projected custody view');
  const home = worlds.find(w => w.native === native && !w.secondary);
  assert.ok(home);
  const location = home.id;
  const staging = ['Return original setup hands to the unopened Treachery deck; no weapon or defense is used.'];
  for (const player of game.players) { game.deck.push(...player.hand); player.hand = []; }
  for (let i = 0; i < (game.advanced ? 4 : 2); i++) {
    const at = game.spiceDeck.findIndex((card, index) => index >= i && 'territory' in card && !card.discovery);
    assert.ok(at >= 0);
    game.spiceDeck.splice(i, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  staging.push('Position original unopened first-Blow non-worm cards; later Storm and all counters remain native.');
  const act = (actor: string, action: Action) => {
    steps.push({ actor, action: structuredClone(action) });
    game = applyAction(game, actor, action);
  };
  game = advanceNativeWorldRecruits(game,
    g => g.phase === 5 && g.active === visitor && nativeWorldRecruitsClean(g), steps);
  const beforeShipment = structuredClone(game);
  const amount = options.imperialCasualties ? 2 : 1;
  const sources = nativeShipmentSources(viewGame(game, visitor), amount, options.imperialCasualties ? 2 : 0);
  assert.ok(sources);
  const choice = homeworldShipmentChoice(viewGame(game, visitor), location,
    Object.fromEntries(Object.entries(sources).filter(([, group]) => group.normal + group.elite > 0)));
  assert.ok(choice.action, choice.blocked ?? 'Original typed invasion must be legal');
  assert.equal(choice.cost, amount);
  const shipmentStep = { actor: visitor, action: choice.action };
  act(shipmentStep.actor, shipmentStep.action);
  game = advanceNativeWorldRecruits(game,
    g => !g.pendingHomeworldShipment && !g.pendingShipment && nativeWorldRecruitsClean(g), steps);
  const afterShipment = structuredClone(game);
  game = advanceNativeWorldRecruits(game, g => g.phase === 6 && nativeWorldRecruitsClean(g) && !!g.active, steps);
  const beforeBattle = structuredClone(game);
  const battleChoice = viewGame(game, game.active!).battleChoices.find(c => c.territory === location);
  assert.ok(battleChoice);
  const battleStep: NativeWorldRecruitsStep = { actor: battleChoice.chooser,
    action: { type: 'chooseBattle', territory: location,
      target: battleChoice.attacker === battleChoice.chooser ? battleChoice.defender : battleChoice.attacker } };
  act(battleStep.actor, battleStep.action);
  const planSteps: NativeWorldRecruitsStep[] = [];
  for (const actor of [visitor, native]) {
    game = advanceNativeWorldRecruits(game, g => !!g.battle && nativeWorldRecruitsClean(g) &&
      !g.battle.preparation && g.battle.preLeader?.closed !== false, steps);
    const leaders = nativeWorldRecruitsPlayer(game, actor).leaders.filter(l => !l.dead && !l.usedAt)
      .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id));
    const leader = actor === visitor ? leaders.at(-1) : leaders[0];
    assert.ok(leader);
    const step: NativeWorldRecruitsStep = { actor,
      action: { type: 'battlePlan', leader: leader.id,
        dial: actor === visitor && options.imperialCasualties ? (game.advanced ? 4 : 2) : 0, support: 0 } };
    planSteps.push(step); act(step.actor, step.action);
  }
  game = advanceNativeWorldRecruits(game,
    g => !g.battle && !g.homeworldBattleLoss && nativeWorldRecruitsClean(g), steps);
  const afterBattle = structuredClone(game);
  assert.equal(nativeWorldRecruitsPlayer(game, native).tanks, native === 'ixians' ? 14 : 20);
  game = advanceNativeWorldRecruits(game,
    g => g.turn === 2 && g.phase === 4 && nativeWorldRecruitsClean(g), steps);
  takeHarassCard(game, owner, RECRUITS_CARD_ID);
  staging.push(`Conserve the existing physical Recruits to ${owner} at the real second Revival; this is not a purchase.`);
  assertNativeWorldRecruitsInventory(game);
  return { initial: setup.initial, afterSetup, beforeShipment, shipmentStep, shipmentPrice: choice.cost,
    afterShipment, beforeBattle, battleStep, planSteps, afterBattle, game, owner, native, visitor,
    location, steps, staging };
}

/** Capture the quote, accepted request, response/deployment choices and physical
 * deposit. Keep invoice price separate from Tleilaxu's own free-return income. */
export function requestNativeWorldRecruits(game: Game, actor: string, amount: number, elite = 0,
  freeElite?: number) {
  const before = structuredClone(game);
  const player = nativeWorldRecruitsPlayer(before, actor);
  const quote = forceRevivalQuote(before, player, amount, elite, freeElite);
  const step: NativeWorldRecruitsStep = { actor,
    action: { type: 'revive', amount, elite, ...(freeElite === undefined ? {} : { freeElite }) } };
  const nativeBefore = combatArmy(before, actor, `homeworld:${player.faction}`);
  const requested = applyAction(game, actor, step.action);
  const continuations: NativeWorldRecruitsStep[] = [];
  game = advanceNativeWorldRecruits(requested, nativeWorldRecruitsClean, continuations);
  const after = nativeWorldRecruitsPlayer(game, actor);
  return { before, requested, game, step, continuations, quote,
    rate: viewGame(before, actor).revival,
    price: quote.cost, walletDelta: player.spice - after.spice,
    free: (after.freeForcesRevived ?? 0) - (player.freeForcesRevived ?? 0),
    nativeBefore, nativeAfter: combatArmy(game, actor, `homeworld:${player.faction}`) };
}
