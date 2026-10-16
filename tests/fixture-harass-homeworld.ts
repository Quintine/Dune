import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazTreacheryGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { traitorDeck } from '../game/traitors';
import { combatArmy } from '../game/combat-location';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups, type HomeworldForces } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { finishHarassPreparation, takeHarassCard } from './fixture-harass-withdraw';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export const HARASS_HOMEWORLD_CARD = 'ecaz-harass-withdraw';
export type HarassHomeworldStep = { actor: string; action: Action };
export type HarassHomeworldOptions = {
  advanced?: boolean;
  slot?: 'weapon' | 'defense';
  role?: 'visitor' | 'native';
  /** Salusa is an Advanced own-World rejection case, not a second faction. */
  secondary?: boolean;
  outcome?: 'loss' | 'win' | 'traitor' | 'explosion';
  seatIds?: [string, string, string];
  /** Original undealt classic lobby, e.g. with authenticated smoke seat IDs. */
  initial?: Game;
};
export type HarassHomeworldSetup = {
  initial: Game; initialized: Game; afterSetup: Game;
  owner: string; opponent: string; observer: string;
  nativeSteps: HarassHomeworldStep[];
};
export type HarassHomeworldFixture = HarassHomeworldSetup & {
  options: HarassHomeworldOptions;
  role: 'visitor' | 'native'; location: string; native: string; visitor: string;
  beforeShipment: Game; shipmentStep: HarassHomeworldStep; afterShipment: Game;
  beforeBattle: Game; battleStep: HarassHomeworldStep;
  /** Genuine original prepared battle; no plan has been sealed. */
  game: Game;
  planActions: [HarassHomeworldStep, HarassHomeworldStep];
  returns: Record<string, HomeworldForces>;
  staging: string[];
};
export function harassHomeworldPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
}
export const harassHomeworldClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard;
export function harassHomeworldPool(game: Game, actor: string, location: string): HomeworldForces {
  const home = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!).find(h => h.id === location);
  assert.ok(home); return { ...(home.forces[actor] ?? { normal: 0, elite: 0 }) };
}

/** Includes typed Basic identity and visitor custody outside Player.forces. */
export function assertHarassHomeworldCustody(game: Game): void {
  homeworldGameIntegrity(game);
  const homes = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  for (const p of game.players) {
    const visitors = homes.filter(h => h.native !== p.id).map(h => h.forces[p.id] ?? { normal: 0, elite: 0 });
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0) +
      visitors.reduce((n, f) => n + f.normal + f.elite, 0), 20, p.faction);
    for (const map of [p.forces, p.elites?.forces ?? {}]) {
      for (const [key, value] of Object.entries(map)) {
        assert.ok(!key.includes('undefined') && !key.includes('NaN') && !key.startsWith('homeworld:'), key);
        assert.ok(Number.isSafeInteger(value) && value >= 0, key);
      }
    }
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((a, b) => a + b, 0) + visitors.reduce((n, f) => n + f.elite, 0), 5);
    assert.ok(p.hand.length <= 4, p.faction);
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.equal(cards.length, 36);
  assert.deepEqual(cards.map(c => c.id).sort(), [...treacheryDeck([]), ...ecazTreacheryCards()].map(c => c.id).sort());
  assert.deepEqual([...(game.traitorReserve ?? []), ...game.players.flatMap(p => [...p.traitors, ...p.traitorChoices])].sort(),
    traitorDeck(game.players).sort());
}
export function actHarassHomeworld(game: Game, step: HarassHomeworldStep, actions?: HarassHomeworldStep[]): Game {
  actions?.push(structuredClone(step)); return applyAction(game, step.actor, step.action);
}
/** Never invent a plan, native vote or late-defense permission. */
export function nextHarassHomeworldStep(game: Game): HarassHomeworldStep | null {
  if (!game.response && !game.phaseOpening) {
    const d = game.decision;
    if (d?.kind === 'harassWithdraw') return null;
    if (d?.kind === 'homeworldDefense') return { actor: d.player, action: { type: 'decision', event: d.event, use: false } };
    if (d?.kind === 'homeworldExplosion') return { actor: d.player, action: { type: 'decision', event: d.event, choice: 0 } };
    if (d?.kind === 'homeworldRevivalDeployment' || d?.kind === 'caladanReinforcement')
      return { actor: d.player, action: { type: 'decision', event: d.event, decline: true } };
    if (d?.kind === 'wormProtection') return { actor: d.player, action: { type: 'decision', accept: true } };
    if (d?.kind === 'wormRide') return { actor: d.player, action: { type: 'decision', accept: false } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceHarassHomeworld(game: Game, until: (game: Game) => boolean,
  actions?: HarassHomeworldStep[]): Game {
  for (let n = 0; n < 1600; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextHarassHomeworldStep(game); assert.ok(next, 'Original Homeworld continuation needs a real human plan or allocation');
    game = actHarassHomeworld(game, next, actions);
  }
  throw Error('Original Harass Homeworld programme did not reach its boundary');
}
function initialize(game: Game): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array); new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255); return array;
  };
  try { return initializeEcazTreacheryGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Homeworlds selected before the independent 33+3 physical setup. No expansion
 * roster, other optional module, preselected variant flag or synthetic phase. */
export function createHarassHomeworldSetup(options: HarassHomeworldOptions = {}): HarassHomeworldSetup {
  const ids = options.seatIds ?? ['emperor', 'guild', 'atreides'];
  let game = options.initial ? structuredClone(options.initial)
    : createGame('HARASSHOMEWORLD', newPlayer(ids[0], 'Emperor', 'emperor'), options.advanced ?? false);
  if (!options.initial) {
    joinGame(game, newPlayer(ids[1], 'Guild', 'guild'));
    joinGame(game, newPlayer(ids[2], 'Atreides', 'atreides'));
  }
  assert.equal(game.status, 'lobby'); assert.equal(game.advanced, options.advanced ?? game.advanced);
  assert.deepEqual(game.expansions, []);
  assert.deepEqual(game.players.map(p => p.faction).sort(), ['atreides', 'emperor', 'guild']);
  assert.ok(!game.ecazTreachery && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.discoveries && !game.greatMaker);
  if (!game.homeworlds) game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  assert.deepEqual(game.homeworlds, { custody: null });
  const nativeSteps: HarassHomeworldStep[] = [];
  for (const p of game.players) if (!p.ready)
    game = actHarassHomeworld(game, { actor: p.id, action: { type: 'ready' } }, nativeSteps);
  const initial = structuredClone(game);
  game = initialize(game);
  const initialized = structuredClone(game);
  game = advanceHarassHomeworld(game, g => g.status === 'playing', nativeSteps);
  const owner = game.players.find(p => p.faction === 'emperor')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const observer = game.players.find(p => p.faction === 'atreides')!.id;
  assertHarassHomeworldCustody(game);
  return { initial, initialized, afterSetup: structuredClone(game), owner, opponent, observer, nativeSteps };
}
function conserveTraitor(game: Game, actor: string, identity: string, staging: string[]): void {
  const p = harassHomeworldPlayer(game, actor);
  if (p.traitors.includes(identity)) return;
  const returned = p.traitors[0]; assert.ok(returned);
  const index = game.traitorReserve!.indexOf(identity);
  const donor = game.players.find(other => other.id !== actor && other.traitors.includes(identity));
  assert.ok(index >= 0 || donor, 'Only exchange a real original Traitor identity');
  if (index >= 0) game.traitorReserve!.splice(index, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  p.traitors[0] = identity;
  staging.push(`Conserved Traitor ${identity}: original ${donor?.id ?? 'reserve'} exchanged with ${actor}'s ${returned}.`);
}

/** Actual first-turn typed invasion, chooseBattle and shared preparation. Only
 * unopened Spice order and conserved physical card custody are staged. */
export function createHarassHomeworldFixture(options: HarassHomeworldOptions = {}): HarassHomeworldFixture {
  const setup = createHarassHomeworldSetup(options), role = options.role ?? 'visitor';
  const outcome = options.outcome ?? 'loss', slot = options.slot ?? 'defense';
  assert.ok(!options.secondary || role === 'native' && setup.afterSetup.advanced);
  assert.ok(outcome !== 'explosion' || role === 'visitor');
  assert.ok(outcome !== 'explosion' || slot === 'defense', 'Lasgun uses the actual weapon slot');
  let game = structuredClone(setup.afterSetup);
  const staging: string[] = [];
  for (let i = 0; i < (game.advanced ? 4 : 2); i++) {
    const at = game.spiceDeck.findIndex((c, index) => index >= i && 'territory' in c && !c.discovery);
    assert.ok(at >= 0); game.spiceDeck.splice(i, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  staging.push('Position unopened original non-worm Spice Cards for the first native Spice Blow; no storm/phase/history assignment.');
  const native = role === 'visitor' ? setup.opponent : setup.owner;
  const visitor = role === 'visitor' ? setup.owner : setup.opponent;
  const location = role === 'visitor' ? 'homeworld:guild' : options.secondary ? 'homeworld:emperor:salusa' : 'homeworld:emperor';
  game = advanceHarassHomeworld(game, g => g.phase === 5 && g.active === visitor && harassHomeworldClean(g), setup.nativeSteps);
  const beforeShipment = structuredClone(game);
  const amount = role === 'visitor' ? 7 : 5, elite = role === 'visitor' ? 4 : 0;
  const sources = nativeShipmentSources(viewGame(game, visitor), amount, elite); assert.ok(sources);
  const choice = homeworldShipmentChoice(viewGame(game, visitor), location,
    Object.fromEntries(Object.entries(sources).filter(([, f]) => f.normal + f.elite > 0)));
  assert.ok(choice.action, choice.blocked ?? 'Original typed invasion must be available');
  const shipmentStep = { actor: visitor, action: choice.action };
  game = actHarassHomeworld(game, shipmentStep, setup.nativeSteps);
  game = advanceHarassHomeworld(game, g => !g.pendingHomeworldShipment && !g.pendingShipment && harassHomeworldClean(g), setup.nativeSteps);
  const afterShipment = structuredClone(game);
  assert.deepEqual(combatArmy(game, visitor, location), role === 'visitor' ? { normal: 3, elite: 4 } : { normal: 5, elite: 0 });
  game = advanceHarassHomeworld(game, g => g.phase === 6 && harassHomeworldClean(g) && !!g.active, setup.nativeSteps);
  for (const p of game.players) { game.deck.push(...p.hand); p.hand = []; }
  takeHarassCard(game, setup.owner, HARASS_HOMEWORLD_CARD);
  let laser: string | undefined, shield: string | undefined;
  if (outcome === 'explosion') {
    laser = game.deck.find(c => c.kind === 'lasgun')!.id;
    shield = game.deck.find(c => c.kind === 'shield')!.id;
    takeHarassCard(game, setup.owner, laser); takeHarassCard(game, setup.opponent, shield);
  }
  staging.push('Return original hands to the undealt deck, then conserve the physical Harass and, for explosion only, original Lasgun/Shield to their actual owners; all hands <=4.');
  const living = (actor: string) => harassHomeworldPlayer(game, actor).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id));
  const ownLeader = outcome === 'win' ? living(setup.owner).at(-1)! : living(setup.owner)[0];
  const otherLeader = outcome === 'win' ? living(setup.opponent)[0] : living(setup.opponent).at(-1)!;
  if (outcome === 'traitor') {
    assert.equal(role, 'visitor', 'Only the opposing native, not an invader, calls Traitor');
    conserveTraitor(game, setup.opponent, ownLeader.id, staging);
  }
  const beforeBattle = structuredClone(game);
  const battleChoice = viewGame(game, game.active!).battleChoices.find(c => c.territory === location); assert.ok(battleChoice);
  const battleStep: HarassHomeworldStep = { actor: battleChoice.chooser, action: { type: 'chooseBattle', territory: location,
    target: battleChoice.attacker === battleChoice.chooser ? battleChoice.defender : battleChoice.attacker } };
  game = actHarassHomeworld(game, battleStep, setup.nativeSteps);
  game = advanceHarassHomeworld(game, g => !!g.battle && harassHomeworldClean(g) &&
    !g.battle.preparation && g.battle.preLeader?.closed !== false, setup.nativeSteps);
  assert.equal(Object.keys(game.battle!.plans).length, 0);
  const dial = role === 'native' ? 0 : 2;
  const support = game.advanced && role === 'visitor' ? 1 : 0;
  const planActions: [HarassHomeworldStep, HarassHomeworldStep] = [
    { actor: setup.owner, action: { type: 'battlePlan', dial, support, leader: ownLeader.id,
      weapon: slot === 'weapon' ? HARASS_HOMEWORLD_CARD : laser ?? null,
      defense: slot === 'defense' ? HARASS_HOMEWORLD_CARD : null } },
    { actor: setup.opponent, action: { type: 'battlePlan', dial: role === 'native' || outcome === 'win' || outcome === 'explosion' ? 0 : 3,
      support: game.advanced && role === 'visitor' && outcome !== 'win' && outcome !== 'explosion' ? 3 : 0,
      leader: otherLeader.id, defense: shield ?? null } },
  ];
  const returns = { [location]: { normal: 2, elite: 3 } };
  assertHarassHomeworldCustody(game);
  return { ...setup, options, role, location, native, visitor, beforeShipment, shipmentStep, afterShipment,
    beforeBattle, battleStep, game, planActions, returns, staging };
}
export function sealHarassHomeworldPlan(game: Game, step: HarassHomeworldStep): Game {
  return finishHarassPreparation(applyAction(game, step.actor, step.action));
}
export function revealHarassHomeworldBattle(fixture: HarassHomeworldFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.planActions) game = sealHarassHomeworldPlan(game, step);
  assert.ok(game.battle?.revealed); return game;
}
export function chooseHarassHomeworldReturn(game: Game, returns: Record<string, HomeworldForces>): Game {
  assert.equal(game.decision?.kind, 'harassWithdraw');
  assert.ok(game.decision && 'event' in game.decision);
  return applyAction(game, game.decision.player, { type: 'decision', event: game.decision.event, returns });
}
/** Original native declarations, typed losses, mandatory discard, retention and
 * Caladan aftercare; never fabricate an invader's forbidden Traitor vote. */
export function finishHarassHomeworldBattle(game: Game, options: {
  returns?: Record<string, HomeworldForces>; callers?: string[]; actions?: HarassHomeworldStep[];
} = {}): Game {
  for (let n = 0; n < 240; n++) {
    if (!game.battle && !game.homeworldBattleLoss && harassHomeworldClean(game)) return game;
    let step: HarassHomeworldStep | null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'harassWithdraw') {
      assert.ok(options.returns, 'Use the actual after-reveal typed allocation');
      step = { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, returns: options.returns } };
    } else step = nextHarassHomeworldStep(game);
    assert.ok(step, 'Finish requires both genuine plans');
    if (step.action.type === 'traitorCall') step.action.call = options.callers?.includes(step.actor) ?? false;
    game = actHarassHomeworld(game, step, options.actions);
  }
  throw Error('Original Harass Homeworld battle did not complete');
}
