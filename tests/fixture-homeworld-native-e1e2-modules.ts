import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeDiscoveryGameForAudit, initializeLeaderSkillsGameForAudit,
  joinGame, newPlayer, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { treacheryDeck, type Card, type SpiceCard } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_TOKEN_BY_ID, validateDiscoveryState,
  type DiscoveryLocationId, type DiscoveryOpaqueTokenId } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { nextDiscoveryNativeE2SkillsStep } from './fixture-discovery-native-e2-skills';
import { nextHomeworldSkillsDiscoveryStep } from './fixture-homeworld-skills-discovery';

export type NativeHomeworldModuleStep = { actor: string; action: Action };
export type NativeHomeworldModuleOptions = {
  advanced?: boolean;
  expansions?: readonly string[];
  roster?: readonly FactionId[];
  skills?: boolean;
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  skill?: LeaderSkillId;
  /** Select original undealt deck faces, never a held hand or physical owner. */
  startingKinds?: readonly Card['kind'][];
};
export type NativeHomeworldModuleSetup = {
  initial: Game;
  offered: Game | null;
  afterSetup: Game;
  actions: NativeHomeworldModuleStep[];
};
export type NativeHomeworldSukProgramme = NativeHomeworldModuleSetup & {
  game: Game;
  beforeShipment: Game;
  afterShipment: Game;
  owner: string;
  opponent: string;
  trainer: string;
  territory: string;
  band: 'normal' | 'skilled';
  plans: NativeHomeworldModuleStep[];
};
export type NativeHomeworldDiscoveryProgramme = NativeHomeworldModuleSetup & {
  game: Game;
  owner: string;
  token: DiscoveryOpaqueTokenId;
  face: DiscoveryLocationId;
  parent: string;
  parentSector: number;
  beforeShipment: Game;
  afterShipment: Game;
};
export const nativeHomeworldClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;
export function nativeHomeworldPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
}
export function nativeHomeworldArmy(game: Game, actor: string, location: string) {
  const home = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!).find(h => h.id === location);
  assert.ok(home); return home.forces[actor] ?? { normal: 0, elite: 0 };
}
export function nativeHomeworldInventory(game: Game): void {
  homeworldGameIntegrity(game);
  if (game.leaderSkills) validateLeaderSkills(game.leaderSkills, game.players);
  if (game.discoveries) validateDiscoveryState(game.discoveries);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  const ordinary = cards.filter(c => !c.id.startsWith('richese-'));
  assert.deepEqual(ordinary.map(c => c.id).sort(), treacheryDeck(game.expansions).map(c => c.id).sort());
  const homes = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  for (const p of game.players) {
    const visitors = homes.filter(h => h.native !== p.id).map(h => h.forces[p.id] ?? { normal: 0, elite: 0 });
    const board = Object.values(p.forces).reduce((n, count) => n + count, 0);
    const visitorCount = visitors.reduce((n, group) => n + group.normal + group.elite, 0);
    assert.equal(p.reserves + p.tanks + board + visitorCount, 20, p.faction);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((n, count) => n + count, 0) + visitors.reduce((n, g) => n + g.elite, 0),
    p.faction === 'ixians' ? 7 : p.faction === 'emperor' ? 5 : 3, p.faction);
  }
}
function permutationDraws<T>(source: readonly T[], desired: readonly T[]): number[] {
  const current = [...source], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) / (i + 1) * 0x100000000));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); return rolls;
}
/** Entropy selection is confined to original setup or an unused supply lottery.
 * Every offer, hand, traitor, Face Dancer and native inventory is engine-created. */
function originalLottery<T>(rolls: readonly number[], operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let draw = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[draw++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function nextNativeHomeworldModuleStep(game: Game, hideOwner = 'ixians'): NativeHomeworldModuleStep {
  if (!game.response && !game.phaseOpening && game.decision) {
    const d = game.decision;
    if (d.kind === 'discoveryEntry' || d.kind === 'greatMakerRide')
      return { actor: d.player, action: { type: 'decision', event: d.event, accept: false } };
    if (d.kind === 'greatMakerVote')
      return { actor: d.player, action: { type: 'decision', event: d.event, yes: false } };
    if (d.kind === 'leaderSkillVisibility') return { actor: d.player, action: {
      type: 'leaderSkillVisibility', event: d.event, hide: d.player === hideOwner,
    } };
    if (d.kind === 'faceDance') return { actor: d.player, action: { type: 'decision', reveal: false } };
    if (d.kind === 'ixSubstitution') return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d.kind === 'sukRescue') throw Error('Choose the original physical Suk rescue explicitly.');
    if (d.kind === 'battleLosses' && game.pendingSukRescue) {
      const maximum = Math.max(...d.options.map(o => o.elite));
      return { actor: d.player, action: { type: 'decision', choice: d.options.findIndex(o => o.elite === maximum) } };
    }
    if (d.kind === 'techToken') return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
  }
  if (game.players.some(p => p.faction === 'richese')) return nextDiscoveryNativeE2SkillsStep(game, true);
  const next = nextHomeworldSkillsDiscoveryStep(game); assert.ok(next, 'Original sealed plans are explicit.'); return next;
}
export function actNativeHomeworld(game: Game, actor: string, action: Action, actions?: NativeHomeworldModuleStep[]): Game {
  actions?.push({ actor, action: structuredClone(action) }); return applyAction(game, actor, action);
}
export function advanceNativeHomeworld(state: Game, until: (game: Game) => boolean,
  actions?: NativeHomeworldModuleStep[], hideOwner = 'ixians'): Game {
  let game = state;
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextNativeHomeworldModuleStep(game, hideOwner); game = actNativeHomeworld(game, step.actor, step.action, actions);
  }
  throw Error('Original native Homeworld programme did not reach its requested window.');
}
export function createNativeHomeworldModuleSetup(options: NativeHomeworldModuleOptions = {}): NativeHomeworldModuleSetup {
  const roster = options.roster ?? ['ixians', 'tleilaxu', 'guild', 'fremen'];
  const skills = options.skills ?? true, discovery = options.discovery ?? true;
  assert.ok(skills || discovery);
  let game = createGame('NATIVEHWMODULES', newPlayer(roster[0], roster[0], roster[0]), options.advanced ?? false,
    [...(options.expansions ?? ['ix'])]);
  for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  if (options.tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  if (options.strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  if (discovery) game.discoveryEnabled = true;
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  const initial = structuredClone(game), actions: NativeHomeworldModuleStep[] = [];
  const selected: LeaderSkillId[] = [options.skill ?? 'suk-graduate'];
  const passive: LeaderSkillId[] = ['prana-bindu-adept', 'swordmaster-of-ginaz', 'killer-medic', 'warmaster', 'sandmaster'];
  for (let i = 1; i < roster.length; i++) selected.push(passive.find(id => !selected.includes(id))!);
  const canonical = LEADER_SKILL_CARDS.map(c => c.id), rest = canonical.filter(id => !selected.includes(id));
  const desired = selected.flatMap(id => [id, rest.shift()!]).concat(rest);
  const cards = treacheryDeck(game.expansions), remaining = [...cards];
  const prefix = (options.startingKinds ?? roster.map((_, i) => i < 5 ? 'worthless' as const : 'shield' as const)).map(kind => {
    const index = remaining.findIndex(c => c.kind === kind); assert.ok(index >= 0); return remaining.splice(index, 1)[0];
  });
  const rolls = [...(skills ? permutationDraws(canonical, desired) : []),
    ...(discovery ? Array.from({ length: 7 }, () => 0xffffffff) : []),
    ...permutationDraws(cards.map(c => c.id), [...prefix, ...remaining].map(c => c.id))];
  game = originalLottery(rolls, () => skills ? initializeLeaderSkillsGameForAudit(game) : initializeDiscoveryGameForAudit(game));
  let offered: Game | null = null;
  for (let count = 0; game.status === 'setup' && count < 250; count++) {
    let step: NativeHomeworldModuleStep;
    if (game.setupStage === 'leaderSkills' && !game.decision) {
      offered ??= structuredClone(game);
      const actor = Object.keys(game.leaderSkills!.offers)[0], view = viewGame(game, actor).leaderSkills!;
      const skill = selected[game.players.findIndex(p => p.id === actor)], offer = view.offer!;
      assert.ok(offer.cards.includes(skill) && !view.unavailableSkills?.[skill]);
      const eligible = new Set(view.eligibleLeaders.map(l => l.id));
      const leader = nativeHomeworldPlayer(game, actor).leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader); step = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    } else if (game.decision?.kind === 'ixSetup') {
      const actor = game.decision.player, card = viewGame(game, actor).ixTechnology!.setup!.find(c => c.kind === 'worthless') ?? viewGame(game, actor).ixTechnology!.setup![0];
      step = { actor, action: { type: 'decision', card: card.id } };
    } else if (game.setupStage === 'traitors' && game.players.some(p => p.traitorChoices.length)) {
      const p = game.players.find(p => p.traitorChoices.length)!;
      const leader = p.traitorChoices.find(id => !['ixians-0', 'ixians-1', 'ixians-2'].includes(id)) ?? p.traitorChoices[0];
      step = { actor: p.id, action: { type: 'traitor', leader } };
    } else step = nextNativeHomeworldModuleStep(game);
    game = originalLottery([], () => actNativeHomeworld(game, step.actor, step.action, actions));
  }
  assert.equal(game.status, 'playing'); nativeHomeworldInventory(game);
  return { initial, offered, afterSetup: structuredClone(game), actions };
}
export function nativeHomeworldMovement(state: Game, actor: string, turn = 1): Game {
  return advanceNativeHomeworld(state, game => game.turn === turn && game.phase === 5 && game.active === actor && nativeHomeworldClean(game));
}
export function settleNativeHomeworldArrival(state: Game): Game {
  return advanceNativeHomeworld(state, game => nativeHomeworldClean(game) && !game.pendingShipment && !game.pendingHomeworldShipment);
}
export function invadeNativeHomeworld(game: Game, actor: string, destination: string, normal: number, elite = 0): Game {
  const sources = nativeShipmentSources(viewGame(game, actor), normal + elite, elite); assert.ok(sources);
  const choice = homeworldShipmentChoice(viewGame(game, actor), destination,
    Object.fromEntries(Object.entries(sources).filter(([, g]) => g.normal + g.elite > 0)));
  assert.ok(choice.action, choice.blocked ?? undefined);
  return settleNativeHomeworldArrival(applyAction(game, actor, choice.action));
}
export function openNativeHomeworldBattle(state: Game, first: string, second: string, territory: string, hideOwner = 'ixians'): Game {
  let game = advanceNativeHomeworld(state, g => g.phase === 6 && nativeHomeworldClean(g) && !!g.active, undefined, hideOwner);
  const actor = game.active!; assert.ok(actor === first || actor === second);
  game = applyAction(game, actor, { type: 'chooseBattle', territory, target: actor === first ? second : first });
  return advanceNativeHomeworld(game, g => !!g.battle && nativeHomeworldClean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false, undefined, hideOwner);
}
export function nativeHomeworldLeader(game: Game, actor: string, strongest = false): string {
  const trained = new Set(game.leaderSkills?.assignments.map(a => a.leader));
  const leader = nativeHomeworldPlayer(game, actor).leaders.filter(l => !l.dead && !trained.has(l.id) && !l.usedAt)
    .sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength)[0]; assert.ok(leader); return leader.id;
}
export function createNativeHomeworldSukProgramme(options: NativeHomeworldModuleOptions & {
  visitor?: boolean; band?: 'normal' | 'skilled';
} = {}): NativeHomeworldSukProgramme {
  const setup = createNativeHomeworldModuleSetup({ ...options, skill: 'suk-graduate' });
  const owner = 'ixians', opponent = 'guild', band = options.band ?? 'skilled';
  const territory = options.visitor ? 'homeworld:guild' : 'homeworld:ixians';
  const actor = options.visitor ? owner : opponent;
  let game = nativeHomeworldMovement(setup.afterSetup, actor);
  const beforeShipment = structuredClone(game);
  game = invadeNativeHomeworld(game, actor, territory, options.visitor ? 4 : 3, options.visitor ? 3 : 0);
  const afterShipment = structuredClone(game);
  game = openNativeHomeworldBattle(game, owner, opponent, territory, band === 'skilled' ? owner : '');
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === owner)!.leader;
  // The real visibility choice must be completed before either sealed plan.
  if (game.battle!.leaderSkillHidden?.[owner] !== (band === 'skilled')) {
    throw Error('Native continuation must select the requested Suk visibility before plans.');
  }
  return { ...setup, game, beforeShipment, afterShipment, owner, opponent, trainer, territory, band,
    plans: [{ actor: owner, action: { type: 'battlePlan', leader: band === 'skilled' ? trainer : nativeHomeworldLeader(game, owner, true),
      dial: game.advanced ? 3 : 6, support: 0, weapon: nativeHomeworldPlayer(game, owner).hand.find(c => c.kind === 'worthless')!.id } },
    { actor: opponent, action: { type: 'battlePlan', leader: nativeHomeworldLeader(game, opponent), dial: 0, support: 0 } }] };
}
export function revealNativeHomeworldPlans(state: Game, plans: NativeHomeworldModuleStep[]): Game {
  let game = state;
  for (const plan of plans) {
    game = applyAction(game, plan.actor, plan.action);
    if (!game.battle?.revealed) game = advanceNativeHomeworld(game, g => !!g.battle && nativeHomeworldClean(g) && !g.battle.preparation);
  }
  assert.ok(game.battle?.revealed); return game;
}
export function frontNativeHomeworldSpice(game: Game, choose: (card: SpiceCard) => boolean, position: number): void {
  const index = game.spiceDeck.findIndex((c, i) => i >= position && choose(c)); assert.ok(index >= position);
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
}
export function createNativeHomeworldDiscoveryProgramme(options: NativeHomeworldModuleOptions & {
  face?: DiscoveryLocationId; collector?: string; maker?: boolean;
} = {}): NativeHomeworldDiscoveryProgramme {
  const setup = createNativeHomeworldModuleSetup({ ...options, discovery: true });
  let game = structuredClone(setup.afterSetup);
  const owner = options.collector ?? game.players[0].id, face = options.face ?? 'cistern';
  const card = DISCOVERY_TOKEN_BY_ID[face].type === 'hiereg' ? 'discovery-hagga-basin' : 'discovery-wind-pass-north';
  const placement = DISCOVERY_CARD_PLACEMENTS[card];
  frontNativeHomeworldSpice(game, c => 'territory' in c && c.discovery === card, 0);
  const index = game.advanced ? 2 : 1;
  if (game.advanced) frontNativeHomeworldSpice(game, c => 'territory' in c && !c.discovery, 1);
  if (options.maker) frontNativeHomeworldSpice(game, c => 'worm' in c && !!c.greatMaker, index);
  for (let i = index + (options.maker ? 1 : 0); i < index + 3; i++)
    frontNativeHomeworldSpice(game, c => 'territory' in c && !c.discovery, i);
  game = advanceNativeHomeworld(game, g => g.phase === 1 && nativeHomeworldClean(g), setup.actions);
  const pool = game.discoveries!.tokens.filter(t => t.status === 'supply' && t.type === DISCOVERY_TOKEN_BY_ID[face].type);
  const selected = pool.findIndex(t => t.face === face); assert.ok(selected >= 0);
  game = originalLottery([Math.floor((selected + 0.5) / pool.length * 0x100000000)], () =>
    advanceNativeHomeworld(game, g => g.discoveries!.tokens.some(t => t.face === face && t.status === 'placed'), setup.actions));
  game = nativeHomeworldMovement(game, owner);
  const beforeShipment = structuredClone(game), sources = nativeShipmentSources(viewGame(game, owner), 2, owner === 'ixians' ? 1 : 0); assert.ok(sources);
  game = settleNativeHomeworldArrival(applyAction(game, owner, { type: 'ship', territory: placement.territory,
    sector: placement.sector, amount: 2, elite: owner === 'ixians' ? 1 : 0, homeworldSources: sources, allyPayment: 0 }));
  const afterShipment = structuredClone(game);
  game = advanceNativeHomeworld(game, g => g.phase === 7 && nativeHomeworldClean(g));
  const token = game.discoveries!.tokens.find(t => t.face === face && t.status === 'placed')!; assert.ok(token);
  return { ...setup, game, owner, token: token.id, face, parent: placement.territory, parentSector: placement.sector, beforeShipment, afterShipment };
}
export function revealNativeHomeworldDiscovery(f: NativeHomeworldDiscoveryProgramme): Game {
  let game = structuredClone(f.game);
  if (viewGame(game, f.owner).discoveries!.canInspect.includes(f.token))
    game = applyAction(game, f.owner, { type: 'discovery', token: f.token, reveal: false });
  return applyAction(game, f.owner, { type: 'discovery', token: f.token, reveal: true });
}
export function enterNativeHomeworldDiscovery(f: NativeHomeworldDiscoveryProgramme): Game {
  const game = advanceNativeHomeworld(revealNativeHomeworldDiscovery(f), g =>
    g.turn === 2 && g.decision?.kind === 'discoveryEntry' && g.decision.player === f.owner);
  const view = viewGame(game, f.owner), action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources); assert.ok(action);
  return applyAction(game, f.owner, action);
}
