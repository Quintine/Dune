import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeDiscoveryGameForAudit, initializeLeaderSkillsGameForAudit,
  joinGame, newPlayer, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { leaders, treacheryDeck } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_TOKEN_BY_ID, validateDiscoveryState } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups, type HomeworldForces } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { traitorDeck } from '../game/traitors';
import { nextEcazSkillsModulesStep } from './fixture-ecaz-skills-modules';
import { nextMoritaniSkillsModulesStep, moritaniSkillsModulesPolicy } from './fixture-moritani-skills-modules';

export type NativeE3HomeworldStep = { actor: string; action: Action };
export type NativeE3HomeworldOptions = {
  /** Original undealt lobby: preserve seat IDs and order, without implying HTTP authentication. */
  initial?: Game;
  faction?: 'ecaz' | 'moritani';
  advanced?: boolean;
  roster?: readonly FactionId[];
  skills?: boolean;
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  skill?: LeaderSkillId;
  /** Choose the original Guild offer/Traitor lottery for the after-loss proof. */
  assassination?: boolean;
  lethal?: boolean;
};
export type NativeE3HomeworldSetup = {
  initial: Game; offered: Game; afterSetup: Game;
  owner: string; opponent: string; trainer: string | null;
  actions: NativeE3HomeworldStep[];
};
export type NativeE3HomeworldBattle = NativeE3HomeworldSetup & {
  visitor: boolean; location: string;
  beforeShipment: Game; shipment: NativeE3HomeworldStep; afterShipment: Game;
  beforeBattle: Game; game: Game; plans: NativeE3HomeworldStep[];
};
export type NativeE3HomeworldDeath = {
  before: Game; after: Game; leader: string; weapon: string;
};
export type NativeE3HomeworldRevival = NativeE3HomeworldSetup & {
  deaths: NativeE3HomeworldDeath[]; revivalWindow: Game; revival: NativeE3HomeworldStep; offeredRevival: Game;
};
export type NativeE3HomeworldDiscovery = NativeE3HomeworldSetup & {
  beforeShipment: Game; shipment: NativeE3HomeworldStep; afterShipment: Game;
  beforeReveal: Game; afterReveal: Game; token: string;
  entryWindow: Game; entry: NativeE3HomeworldStep; entered: Game;
};
export const nativeE3HomeworldClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard;
export function nativeE3HomeworldPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
}
export const nativeE3HomeworldPolicy = moritaniSkillsModulesPolicy;
export function nativeE3HomeworldPool(game: Game, actor: string, location: string): HomeworldForces {
  const home = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!).find(h => h.id === location);
  assert.ok(home); return home.forces[actor] ?? { normal: 0, elite: 0 };
}
export function assertNativeE3HomeworldCustody(game: Game): void {
  homeworldGameIntegrity(game);
  if (game.leaderSkills) validateLeaderSkills(game.leaderSkills, game.players);
  if (game.discoveries) validateDiscoveryState(game.discoveries);
  const homes = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  for (const p of game.players) {
    const visitors = homes.filter(h => h.native !== p.id).map(h => h.forces[p.id] ?? { normal: 0, elite: 0 });
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0) +
      visitors.reduce((a, b) => a + b.normal + b.elite, 0), 20, p.faction);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((a, b) => a + b, 0) + visitors.reduce((a, b) => a + b.elite, 0),
    p.faction === 'fremen' ? 3 : 5, p.faction);
    assert.deepEqual(p.leaders.map(l => l.id).sort(), leaders(p.faction).map(l => l.id).sort());
  }
  assert.equal(game.players.find(p => ['ecaz', 'moritani'].includes(p.faction))!.leaders.length, 5);
  assert.equal(game.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  assert.ok(!game.leaderSkills?.assignments.some(a => a.leader === DUKE_VIDAL_ID));
  if (game.ecazAmbassadors) validateAmbassadors(game.ecazAmbassadors);
  const retired = game.moritaniAssassinate?.opportunities.filter(r => r.stage === 'replaced').map(r => r.card!) ?? [];
  const traitors = [...game.traitorReserve!, ...game.players.flatMap(p => [...p.traitors, ...p.traitorChoices]),
    ...retired, ...(game.ecazLoyalty?.card ? [game.ecazLoyalty.card] : [])];
  assert.deepEqual(traitors.sort(), traitorDeck(game.players).sort());
  const physical = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.deepEqual(physical.map(c => c.id).sort(), treacheryDeck(['ecaz']).map(c => c.id).sort());
}

/** Fisher-Yates draw selection affects only components that have not been dealt. */
function permutation<T>(original: readonly T[], desired: readonly T[]): number[] {
  const current = [...original], draws: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    draws.push(Math.floor((j + 0.5) / (i + 1) * 0x100000000));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); return draws;
}
function lottery<T>(draws: readonly number[], operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let index = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1 && index < draws.length) array[0] = draws[index++];
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actNativeE3Homeworld(game: Game, step: NativeE3HomeworldStep,
  actions?: NativeE3HomeworldStep[]): Game {
  actions?.push(structuredClone(step)); return applyAction(game, step.actor, step.action);
}
/** Explicit rescue and sealed plans remain boundaries; optional assassination defaults to decline. */
export function nextNativeE3HomeworldStep(game: Game): NativeE3HomeworldStep | null {
  if (!game.response && !game.phaseOpening) {
    const d = game.decision;
    if (d?.kind === 'sukRescue') return null;
    if (d?.kind === 'moritaniAssassinate')
      return { actor: d.player, action: { type: 'decision', event: d.event, decline: true } };
    if (d?.kind === 'discoveryEntry' || d?.kind === 'greatMakerRide')
      return { actor: d.player, action: { type: 'decision', event: d.event, accept: false } };
    if (d?.kind === 'greatMakerVote') return { actor: d.player, action: { type: 'decision', event: d.event, yes: false } };
    if (d?.kind === 'wormProtection') return { actor: d.player, action: { type: 'decision', accept: true } };
    if (d?.kind === 'wormRide') return { actor: d.player, action: { type: 'decision', accept: false } };
    if (d?.kind === 'homeworldDefense') return { actor: d.player, action: { type: 'decision', event: d.event, use: false } };
    if (d?.kind === 'homeworldRevivalDeployment') return { actor: d.player, action: { type: 'decision', event: d.event, decline: true } };
  }
  const next = game.players.some(p => p.faction === 'ecaz')
    ? nextEcazSkillsModulesStep(game) : nextMoritaniSkillsModulesStep(game);
  if (next?.action.type === 'stormDial') next.action.amount = game.turn === 1 ? 0 : 1;
  return next;
}
export function advanceNativeE3Homeworld(state: Game, until: (game: Game) => boolean,
  actions?: NativeE3HomeworldStep[]): Game {
  let game = state;
  for (let n = 0; n < 2600; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextNativeE3HomeworldStep(game); assert.ok(next, 'An actual human-owned native window needs its owner.');
    game = actNativeE3Homeworld(game, next, actions);
  }
  throw Error('Original native Homeworld programme did not reach its requested window.');
}

/** Reuse the original native initializer; no parallel game configuration or force staging. */
export function createNativeE3HomeworldSetup(options: NativeE3HomeworldOptions = {}): NativeE3HomeworldSetup {
  const faction = options.faction ?? options.initial?.players.find(p => ['ecaz', 'moritani'].includes(p.faction))?.faction ?? 'ecaz';
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const skills = options.skills ?? true, discovery = options.discovery ?? false;
  const roster = options.roster ?? [faction, 'guild', 'emperor'] as FactionId[];
  let game = options.initial ? structuredClone(options.initial)
    : createGame('NATIVEHWE3MODULES', newPlayer(roster[0], roster[0], roster[0]), advanced, ['ecaz']);
  if (!options.initial) for (const f of roster.slice(1)) joinGame(game, newPlayer(f, f, f));
  assert.equal(game.status, 'lobby'); assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['ecaz']);
  assert.equal(game.players.filter(p => ['ecaz', 'moritani'].includes(p.faction)).length, 1);
  assert.ok(game.players.some(p => p.faction === faction));
  assert.ok(game.players.every(p => p.faction === faction || ['guild', 'emperor', 'atreides', 'fremen', 'beneGesserit',
    ...(advanced ? [] : ['harkonnen'])].includes(p.faction)));
  assert.ok(skills || discovery); assert.ok(!game.nexusCards && !game.ecazTreachery);
  if (!game.homeworlds) game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  if (!!game.techTokens !== !!options.tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: !!options.tech });
  if (!!game.strongholdCards !== !!options.strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: !!options.strongholds });
  game.discoveryEnabled = discovery;
  const initial = structuredClone(game), actions: NativeE3HomeworldStep[] = [];
  const owner = game.players.find(p => p.faction === faction)!.id;
  const opponent = game.players.find(p => p.faction === 'guild')?.id ?? game.players.find(p => p.id !== owner)!.id;
  const requested = options.skill ?? 'suk-graduate';
  const preferences: LeaderSkillId[] = game.players.map(p => p.id === owner ? options.assassination ? 'warmaster' : requested
    : p.id === opponent && options.assassination ? 'suk-graduate'
      : p.faction === 'atreides' ? 'bureaucrat' : p.faction === 'fremen' ? 'killer-medic'
        : p.faction === 'beneGesserit' ? 'prana-bindu-adept' : p.faction === 'harkonnen' ? 'smuggler'
          : p.faction === 'guild' ? 'swordmaster-of-ginaz' : 'master-of-assassins');
  const canonical = LEADER_SKILL_CARDS.map(c => c.id), remainder = canonical.filter(s => !preferences.includes(s));
  const desiredSkills = preferences.flatMap(s => [s, remainder.shift()!]).concat(remainder);
  const cards = treacheryDeck(['ecaz']), remaining = [...cards], prefix = game.players.flatMap(p => {
    const kinds = [p.id === opponent && options.lethal ? 'projectile' : 'worthless', ...(p.faction === 'harkonnen' ? ['shield'] : [])];
    return kinds.map(kind => {
      const match = remaining.findIndex(c => c.kind === kind);
      const i = match >= 0 ? match : remaining.findIndex(c => c.kind === 'shield' || c.kind === 'snooper');
      assert.ok(i >= 0); return remaining.splice(i, 1)[0].id;
    });
  });
  for (const p of game.players) if (!p.ready) game = actNativeE3Homeworld(game, { actor: p.id, action: { type: 'ready' } }, actions);
  const draws = [...(skills ? permutation(canonical, desiredSkills) : []), ...(discovery ? Array<number>(7).fill(0xffffffff) : []),
    ...permutation(cards.map(c => c.id), [...prefix, ...remaining.map(c => c.id)])];
  game = lottery(draws, () => skills ? initializeLeaderSkillsGameForAudit(game) : initializeDiscoveryGameForAudit(game));
  const offered = structuredClone(game);
  for (let n = 0; game.status === 'setup' && n < 240; n++) {
    let step: NativeE3HomeworldStep;
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
      const skill = preferences[game.players.findIndex(p => p.id === actor)];
      assert.ok(own.offer!.cards.includes(skill) && !own.unavailableSkills?.[skill]);
      const eligible = own.eligibleLeaders.map(l => nativeE3HomeworldPlayer(game, actor).leaders.find(d => d.id === l.id)!)
        .sort((a, b) => b.strength - a.strength);
      const leader = options.assassination && actor === opponent ? eligible.find(l => l.name === 'Master Bewt') : eligible[0];
      assert.ok(leader);
      step = { actor, action: { type: 'leaderSkill', event: own.offer!.event, skill, leader: leader.id } };
      if (options.assassination && Object.keys(game.leaderSkills!.offers).length === 1) {
        const target = leaders('guild').find(l => l.name === 'Master Bewt')!.id;
        const traitors = traitorDeck(game.players), desired = [target, ...traitors.filter(t => t !== target)];
        const ownerIndex = game.players.findIndex(p => p.id === owner);
        [desired[0], desired[ownerIndex * 4]] = [desired[ownerIndex * 4], desired[0]];
        game = lottery([...Array<number>(game.leaderSkills!.deck.length).fill(0xffffffff),
          ...permutation(traitors, desired)], () => actNativeE3Homeworld(game, step, actions));
        continue;
      }
    } else if (game.setupStage === 'traitors' && options.assassination && nativeE3HomeworldPlayer(game, owner).traitorChoices.length) {
      const target = leaders('guild').find(l => l.name === 'Master Bewt')!.id;
      assert.ok(nativeE3HomeworldPlayer(game, owner).traitorChoices.includes(target));
      step = { actor: owner, action: { type: 'traitor', leader: target } };
    } else { const next = nextNativeE3HomeworldStep(game); assert.ok(next); step = next; }
    game = actNativeE3Homeworld(game, step, actions);
  }
  assert.equal(game.status, 'playing'); assertNativeE3HomeworldCustody(game);
  return { initial, offered, afterSetup: structuredClone(game), owner, opponent,
    trainer: game.leaderSkills?.assignments.find(a => a.owner === owner)?.leader ?? null, actions };
}
function movement(game: Game, actor: string, actions: NativeE3HomeworldStep[]): Game {
  return advanceNativeE3Homeworld(game, g => g.phase === 5 && g.active === actor && nativeE3HomeworldClean(g), actions);
}
function invasion(game: Game, actor: string, destination: string, amount: number): NativeE3HomeworldStep {
  const sources = nativeShipmentSources(viewGame(game, actor), amount, 0); assert.ok(sources);
  const selected = Object.fromEntries(Object.entries(sources).filter(([, group]) => group.normal + group.elite > 0));
  const choice = homeworldShipmentChoice(viewGame(game, actor), destination, selected);
  assert.ok(choice.action, choice.blocked ?? 'Original invasion is unavailable.'); return { actor, action: choice.action };
}
function arrive(game: Game, actions: NativeE3HomeworldStep[]): Game {
  return advanceNativeE3Homeworld(game, g => !g.pendingShipment && !g.pendingHomeworldShipment && nativeE3HomeworldClean(g), actions);
}
export function openNativeE3HomeworldBattle(state: Game, location: string, first: string, second: string,
  actions: NativeE3HomeworldStep[] = [], hide = true): Game {
  let game = advanceNativeE3Homeworld(state, g => g.phase === 6 && nativeE3HomeworldClean(g) && !!g.active, actions);
  assert.ok(game.active === first || game.active === second);
  game = actNativeE3Homeworld(game, { actor: game.active!, action: { type: 'chooseBattle', territory: location,
    target: game.active === first ? second : first } }, actions);
  for (let n = 0; n < 180; n++) {
    if (game.battle && nativeE3HomeworldClean(game) && !game.battle.preparation && game.battle.preLeader?.closed !== false) return game;
    const next = nextNativeE3HomeworldStep(game); assert.ok(next);
    if (next.action.type === 'leaderSkillVisibility') next.action.hide = hide;
    game = actNativeE3Homeworld(game, next, actions);
  }
  throw Error('Original Homeworld Battle Plan window did not open.');
}
export function createNativeE3HomeworldBattle(options: NativeE3HomeworldOptions & { visitor?: boolean; battleTurn?: 1 | 2 } = {}): NativeE3HomeworldBattle {
  const setup = createNativeE3HomeworldSetup(options), visitor = options.visitor ?? false;
  const location = `homeworld:${nativeE3HomeworldPlayer(setup.afterSetup, visitor ? setup.opponent : setup.owner).faction}`;
  const actor = visitor ? setup.owner : setup.opponent;
  let game = structuredClone(setup.afterSetup);
  for (let position = 0; position < (game.advanced ? 4 : 2); position++)
    frontSpice(game, c => 'territory' in c && !c.discovery, position);
  if (options.battleTurn === 2) game = advanceNativeE3Homeworld(game,
    g => g.turn === 2 && g.phase === 0 && nativeE3HomeworldClean(g), setup.actions);
  game = movement(game, actor, setup.actions);
  const beforeShipment = structuredClone(game), shipment = invasion(game, actor, location, 5);
  game = arrive(actNativeE3Homeworld(game, shipment, setup.actions), setup.actions);
  const afterShipment = structuredClone(game);
  game = advanceNativeE3Homeworld(game, g => g.phase === 6 && nativeE3HomeworldClean(g), setup.actions);
  const beforeBattle = structuredClone(game);
  game = openNativeE3HomeworldBattle(game, location, setup.owner, setup.opponent, setup.actions, !options.assassination);
  const trained = new Set(game.leaderSkills?.assignments.map(a => a.leader) ?? []);
  const enemy = nativeE3HomeworldPlayer(game, setup.opponent).leaders.filter(l => !l.dead && !trained.has(l.id))
    .sort((a, b) => options.lethal || options.assassination ? b.strength - a.strength : a.strength - b.strength)[0];
  const ownerLeader = options.assassination ? nativeE3HomeworldPlayer(game, setup.owner).leaders.filter(l => !trained.has(l.id))
    .sort((a, b) => a.strength - b.strength)[0].id : setup.trainer ?? nativeE3HomeworldPlayer(game, setup.owner).leaders[0].id;
  const weapon = options.lethal ? nativeE3HomeworldPlayer(game, setup.opponent).hand.find(c => c.kind === 'projectile')?.id : undefined;
  if (options.lethal) assert.ok(weapon);
  const worthless = nativeE3HomeworldPlayer(game, setup.opponent).hand.find(c => c.kind === 'worthless')?.id;
  const dial = options.lethal || options.assassination ? 0 : 4;
  const plans: NativeE3HomeworldStep[] = [
    { actor: setup.owner, action: { type: 'battlePlan', leader: ownerLeader, dial, support: game.advanced ? dial : 0 } },
    { actor: setup.opponent, action: { type: 'battlePlan', leader: enemy.id, dial: options.assassination ? 3 : 0,
      support: game.advanced && options.assassination ? 3 : 0, weapon: weapon ?? worthless } },
  ];
  return { ...setup, visitor, location, beforeShipment, shipment, afterShipment, beforeBattle, game, plans };
}
export function revealNativeE3HomeworldPlans(state: Game, plans: NativeE3HomeworldStep[],
  actions?: NativeE3HomeworldStep[]): Game {
  let game = structuredClone(state);
  for (const step of plans) {
    game = actNativeE3Homeworld(game, step, actions);
    if (!game.battle?.revealed) game = advanceNativeE3Homeworld(game,
      g => nativeE3HomeworldClean(g) && !!g.battle && !g.battle.preparation && g.battle.preLeader?.closed !== false, actions);
  }
  assert.ok(game.battle?.revealed); return game;
}
export function settleNativeE3HomeworldBattle(state: Game, stop: 'suk' | 'assassination' | 'tech' | 'complete' = 'complete',
  actions?: NativeE3HomeworldStep[]): Game {
  return advanceNativeE3Homeworld(state, g => !g.response && !g.phaseOpening && (
    stop === 'suk' && g.decision?.kind === 'sukRescue' ||
    stop === 'assassination' && g.decision?.kind === 'moritaniAssassinate' ||
    stop === 'tech' && g.decision?.kind === 'techToken' || !g.battle && nativeE3HomeworldClean(g)), actions);
}
export function rescueNativeE3Homeworld(state: Game): Game {
  const d = state.decision; assert.ok(d?.kind === 'sukRescue');
  const maximum = Math.max(...d.options.map(o => o.normal + o.elite));
  const choice = d.options.findIndex(o => o.normal + o.elite === maximum && o.kept?.kind === 'normal');
  assert.ok(choice >= 0); return applyAction(state, d.player, { type: 'decision', event: d.event, choice });
}

/** All five deaths and revival are played. Each later visitor arrives by a new
 * paid invasion; the original native Guild retains its real winning projectile. */
export function createNativeE3HomeworldRevival(options: NativeE3HomeworldOptions = {}): NativeE3HomeworldRevival {
  const setup = createNativeE3HomeworldSetup({ ...options, skills: true, lethal: true, skill: 'mentat' });
  let game = structuredClone(setup.afterSetup);
  for (let position = 0; position < 12; position++)
    frontSpice(game, c => 'territory' in c && !c.discovery, position);
  const location = 'homeworld:guild', deaths: NativeE3HomeworldDeath[] = [];
  const discs = nativeE3HomeworldPlayer(game, setup.owner).leaders.map(l => l.id);
  const weapon = nativeE3HomeworldPlayer(game, setup.opponent).hand.find(c => c.kind === 'projectile')!.id;
  const winner = nativeE3HomeworldPlayer(game, setup.opponent).leaders.filter(l =>
    !game.leaderSkills!.assignments.some(a => a.leader === l.id)).sort((a, b) => b.strength - a.strength)[0].id;
  for (const leader of discs) {
    game = movement(game, setup.owner, setup.actions);
    game = arrive(actNativeE3Homeworld(game, invasion(game, setup.owner, location, 1), setup.actions), setup.actions);
    game = openNativeE3HomeworldBattle(game, location, setup.owner, setup.opponent, setup.actions);
    const before = structuredClone(game);
    game = revealNativeE3HomeworldPlans(game, [
      { actor: setup.owner, action: { type: 'battlePlan', leader, dial: 0, support: 0 } },
      { actor: setup.opponent, action: { type: 'battlePlan', leader: winner, dial: 0, support: 0, weapon } },
    ], setup.actions);
    game = advanceNativeE3Homeworld(game, g => !g.battle && nativeE3HomeworldClean(g) || g.decision?.kind === 'moritaniAssassinate', setup.actions);
    if (game.decision?.kind === 'moritaniAssassinate') {
      game = actNativeE3Homeworld(game, { actor: game.decision.player,
        action: { type: 'decision', event: game.decision.event, decline: true } }, setup.actions);
      game = settleNativeE3HomeworldBattle(game, 'complete', setup.actions);
    }
    deaths.push({ before, after: structuredClone(game), leader, weapon });
    const turn = game.turn;
    game = advanceNativeE3Homeworld(game, g => g.turn === turn + 1 && g.phase === 4 && nativeE3HomeworldClean(g), setup.actions);
  }
  const revivalWindow = structuredClone(game), leader = setup.trainer!;
  const revival: NativeE3HomeworldStep = { actor: setup.owner, action: { type: 'reviveLeader', leader } };
  game = actNativeE3Homeworld(game, revival, setup.actions);
  game = advanceNativeE3Homeworld(game, g => !!g.leaderSkills!.offers[setup.owner], setup.actions);
  return { ...setup, deaths, revivalWindow, revival, offeredRevival: game };
}
function frontSpice(game: Game, predicate: (card: Game['spiceDeck'][number]) => boolean, position: number): void {
  const i = game.spiceDeck.findIndex((c, n) => n >= position && predicate(c)); assert.ok(i >= position);
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(i, 1)[0]);
}
/** Only unplayed Spice order and the original supply lottery are selected.
 * Reveal is followed by next-turn parent entry, not a direct nested placement. */
export function createNativeE3HomeworldDiscovery(options: NativeE3HomeworldOptions = {}): NativeE3HomeworldDiscovery {
  const setup = createNativeE3HomeworldSetup({ ...options, discovery: true });
  let game = structuredClone(setup.afterSetup);
  frontSpice(game, c => 'territory' in c && c.discovery === 'discovery-hagga-basin', 0);
  for (let position = 1; position < (game.advanced ? 4 : 2); position++)
    frontSpice(game, c => 'territory' in c && !c.discovery && c.territory !== 'hagga_basin', position);
  const face = 'cistern', type = DISCOVERY_TOKEN_BY_ID[face].type;
  const pool = game.discoveries!.tokens.filter(t => t.status === 'supply' && t.type === type);
  const index = pool.findIndex(t => t.face === face); assert.ok(index >= 0);
  game = advanceNativeE3Homeworld(game, g => g.phase === 1 && nativeE3HomeworldClean(g), setup.actions);
  game = lottery([Math.floor((index + 0.5) / pool.length * 0x100000000)], () =>
    advanceNativeE3Homeworld(game, g => g.discoveries!.tokens.some(t => t.face === face && t.status === 'placed'), setup.actions));
  game = movement(game, setup.owner, setup.actions);
  const beforeShipment = structuredClone(game), destination = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const sources = nativeShipmentSources(viewGame(game, setup.owner), 2, 0); assert.ok(sources);
  const shipment: NativeE3HomeworldStep = { actor: setup.owner, action: { type: 'ship', territory: destination.territory,
    sector: destination.sector, amount: 2, elite: 0, allyPayment: 0, homeworldSources: sources } };
  game = arrive(actNativeE3Homeworld(game, shipment, setup.actions), setup.actions);
  const afterShipment = structuredClone(game);
  game = advanceNativeE3Homeworld(game, g => g.phase === 7 && nativeE3HomeworldClean(g), setup.actions);
  const beforeReveal = structuredClone(game), token = game.discoveries!.tokens.find(t => t.face === face)!.id;
  if (viewGame(game, setup.owner).discoveries!.canInspect.includes(token))
    game = actNativeE3Homeworld(game, { actor: setup.owner, action: { type: 'discovery', token, reveal: false } }, setup.actions);
  game = actNativeE3Homeworld(game, { actor: setup.owner, action: { type: 'discovery', token, reveal: true } }, setup.actions);
  const afterReveal = structuredClone(game);
  game = advanceNativeE3Homeworld(game, g => g.turn === 2 && !g.response && !g.phaseOpening &&
    g.decision?.kind === 'discoveryEntry' && g.decision.player === setup.owner, setup.actions);
  const entryWindow = structuredClone(game), view = viewGame(game, setup.owner);
  const action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources); assert.ok(action);
  const entry: NativeE3HomeworldStep = { actor: setup.owner, action };
  game = actNativeE3Homeworld(game, entry, setup.actions);
  return { ...setup, beforeShipment, shipment, afterShipment, beforeReveal, afterReveal, token, entryWindow, entry, entered: game };
}

export type NativeE3HomeworldArrival = { before: Game; step: NativeE3HomeworldStep; after: Game };
/** Reusable original human shipment boundary, including noncombatant BG entry. */
export function invadeNativeE3Homeworld(state: Game, actor: string, destination: string,
  amount: number): NativeE3HomeworldArrival {
  const actions: NativeE3HomeworldStep[] = [], before = movement(state, actor, actions);
  const step = invasion(before, actor, destination, amount);
  const after = arrive(actNativeE3Homeworld(before, step, actions), actions);
  return { before, step, after };
}
