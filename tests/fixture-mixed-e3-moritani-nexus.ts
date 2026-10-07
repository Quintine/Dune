import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeCombinedNexusGameForAudit, initializeLeaderSkillsGameForAudit,
  initializeNexusGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game, type Player,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { leaders, spiceDeck, treacheryDeck, type Card } from '../game/cards';
import { isDefenseCard, isWeaponCard } from '../game/battle-cards';
import { territory } from '../game/board';
import { CHOAM_AUDITOR_ID } from '../game/choam-auditor';
import { richeseCards } from '../game/richese-cards';
import { chooseEcazLoyalty } from '../game/ecaz-loyalty';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { TERROR_KINDS, type TerrorKind } from '../game/moritani-terror';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { CHEAP_HERO_TRAITOR, traitorDeck } from '../game/traitors';
import { DISCOVERY_SPICE_CARDS, validateDiscoveryState } from '../game/discoveries';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldBattleLocation } from '../game/combat-location';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { quoteBattleResolution, type BattleResolutionQuote, type ResolutionCombatant } from '../game/battle-resolution-quote';
import type { Difficulty } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import {
  frontNativeHomeworldSpice, nativeHomeworldInventory, nativeHomeworldLeader,
} from './fixture-homeworld-native-e1e2-modules';
import { nextMixedNexusStep } from './fixture-mixed-nexus-modules';

/** Original mixed E3 Nexus with native Moritani. The Ecaz family seats Moritani
 * only; a separate native Ecaz programme owns the Ecaz side and the paired
 * rosters. Each selected E1/E2 family seats exactly one of its natives and the
 * ordinary deck stays original: Ix47 when Ix is selected, otherwise CHOAM35,
 * with the ten-card Richese cache separate whenever Richese is seated. */
export type MixedE3MoritaniFamily = 'ix' | 'choam';
export type MixedE3MoritaniEntry = 'nexus' | 'leaderSkills' | 'combined';
export type MixedE3MoritaniStep = { actor: string; action: Action };
export type MixedE3MoritaniTransition = { before: Game; step: MixedE3MoritaniStep; after: Game };
export type MixedE3MoritaniOptions = {
  /** An original fresh lobby or its undealt original first-turn setup; never a played save. */
  initial?: Game;
  rules?: 'basic' | 'advanced';
  families?: readonly MixedE3MoritaniFamily[];
  /** One native per selected family; defaults to Tleilaxu and CHOAM. */
  natives?: Partial<Record<MixedE3MoritaniFamily, FactionId>>;
  /** Explicit full seat order; overrides natives/classics. */
  roster?: readonly FactionId[];
  classics?: readonly FactionId[];
  skills?: boolean;
  homeworlds?: boolean;
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  /** Requested skill for the trained opposing disc of the Advanced loss. */
  opponentSkill?: LeaderSkillId;
  /** Reveal Moritani's own held Traitor normally during the loss battle. */
  normalCall?: boolean;
  seatIds?: readonly string[];
  entry?: MixedE3MoritaniEntry;
};
export type MixedE3MoritaniSetup = {
  initial: Game; offered: Game; afterSetup: Game;
  entry: MixedE3MoritaniEntry; families: readonly MixedE3MoritaniFamily[];
  moritani: string; seats: Partial<Record<FactionId, string>>;
  native: string; nativeFaction: FactionId;
  secondNative: string | null; secondFaction: FactionId | null;
  partner: string | null; classics: string[];
  location: string;
  /** The original held Traitor Card of the winning faction, chosen at setup. */
  target: string; targetSkillOwner: string | null;
  actions: MixedE3MoritaniStep[]; staging: string[];
};
export type MixedE3MoritaniProgramme = MixedE3MoritaniSetup & {
  game: Game; firstStorm: Game; firstMentat: MixedE3MoritaniTransition | null;
  alliance: Game | null; drawing: Game | null; draws: MixedE3MoritaniTransition[];
};
export type MixedE3MoritaniBattle = {
  arrangements: Game; location: string;
  arrival: MixedE3MoritaniTransition | null;
  plans: MixedE3MoritaniStep[]; revealed: Game;
  ownLeader: string; enemyLeader: string; target: string;
  ownCards: string[]; enemyCards: string[];
};
export type MixedE3MoritaniBoundary = {
  game: Game;
  kind: 'losses' | 'rescue' | 'substitution' | 'assassination' | 'cards' | 'tech' | 'faceDance' | 'settled';
};

export const mixedE3MoritaniReload = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;
export const mixedE3MoritaniClean = (g: Game): boolean =>
  !g.response && !g.phaseOpening && !g.decision && !g.pendingTreacheryDiscard && !g.truthtrance;
export function mixedE3MoritaniPlayer(g: Game, actor: string): Player {
  const player = g.players.find(p => p.id === actor); assert.ok(player, `Missing original seat ${actor}`); return player;
}
export const mixedE3MoritaniLeader = nativeHomeworldLeader;
/** Genuine public/own-seat policy; never inspects hidden rival state. */
export function mixedE3MoritaniPolicy(g: Game, actor: string, difficulty: Difficulty): Action[] {
  const view = viewGame(mixedE3MoritaniReload(g), actor); view.players.find(p => p.id === actor)!.bot = difficulty;
  return botActions(view);
}

/** Physical/private aftermath choices always belong to the real owner. */
const MIXED_E3_MORITANI_HUMAN: Readonly<Record<string, true>> = {
  battleLosses: true, sukRescue: true, ixSubstitution: true, battleCards: true, faceDance: true,
  strongholdCopy: true, moritaniAssassinate: true,
};
/** Original response queues take priority; a negative result is a real human
 * boundary (physical casualties, rescue, private cards, assassination, Terror). */
export function nextMixedE3MoritaniStep(g: Game): MixedE3MoritaniStep | null {
  if (!g.response && !g.phaseOpening && !g.pendingTreacheryDiscard && g.decision) {
    const d = g.decision;
    if (MIXED_E3_MORITANI_HUMAN[d.kind]) return null;
    if (d.kind === 'techToken' && !!g.battle) return null;
    if (d.kind === 'moritaniPlacement') return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d.kind === 'leaderSkillVisibility') return { actor: d.player,
      action: { type: 'leaderSkillVisibility', event: d.event, hide: true } };
    if (d.kind === 'moritaniTerror' && ['select', 'offer'].includes(g.pendingTerrorEntry!.stage))
      return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d.kind === 'richeseUnbid')
      return { actor: d.player, action: { type: 'decision', event: g.richeseBidding!.event, keep: false } };
  }
  const next = nextMixedNexusStep(g);
  if (!next && g.phase === 5 && g.active && mixedE3MoritaniClean(g) &&
    !g.pendingShipment && !g.pendingHomeworldShipment)
    return { actor: g.active, action: { type: 'endMovement' } };
  return next;
}
export function stepMixedE3Moritani(g: Game, step: MixedE3MoritaniStep, actions?: MixedE3MoritaniStep[]): Game {
  actions?.push(structuredClone(step));
  return applyAction(mixedE3MoritaniReload(g), step.actor, step.action);
}
export function advanceMixedE3Moritani(g: Game, until: (state: Game) => boolean,
  actions?: MixedE3MoritaniStep[]): Game {
  for (let n = 0; n < 3200; n++) {
    if (until(g)) return g;
    assert.notEqual(g.status, 'finished');
    const next = nextMixedE3MoritaniStep(g);
    assert.ok(next, `Choose the original ${g.decision?.kind ?? 'sealed plan'} at ${g.turn}/${g.phase}.`);
    g = stepMixedE3Moritani(g, next, actions);
  }
  throw Error('Original mixed E3 Moritani chronology did not reach its owned boundary.');
}
export function settleMixedE3Moritani(g: Game, actions?: MixedE3MoritaniStep[]): Game {
  return advanceMixedE3Moritani(g, s => mixedE3MoritaniClean(s) && !s.pendingShipment &&
    !s.pendingHomeworldShipment && !s.pendingChoamWorthless, actions);
}

/** Printed stocks only: the selected ordinary deck, the separate ten-card
 * Richese cache, twelve Nexus cards, fourteen skills, twenty forces per faction,
 * original elite supply and the six original Terror tokens. */
export function mixedE3MoritaniInventory(g: Game): void {
  if (g.homeworlds) nativeHomeworldInventory(g);
  else for (const p of g.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((n, f) => n + f, 0), 20, p.faction);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((n, f) => n + f, 0),
    p.faction === 'ixians' ? 7 : p.faction === 'emperor' ? 5 : 3, p.faction);
  }
  if (g.leaderSkills) validateLeaderSkills(g.leaderSkills, g.players);
  if (g.discoveries) validateDiscoveryState(g.discoveries);
  if (g.ecazAmbassadors) validateAmbassadors(g.ecazAmbassadors);
  const auction = g.auction?.cards.slice(g.auction.index + (g.currentAuctionSale ? 1 : 0)) ?? [];
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand), ...(g.ixSetupCards ?? []), ...auction];
  assert.deepEqual(cards.filter(c => !c.id.startsWith('richese-')).map(c => c.id).sort(),
    treacheryDeck(g.expansions).map(c => c.id).sort());
  if (g.players.some(p => p.faction === 'richese')) {
    const owned = [...(g.richeseCache ?? []), ...(g.richeseRemoved ?? []),
      ...cards.filter(c => c.id.startsWith('richese-'))];
    assert.deepEqual(owned.map(c => c.id).sort(), richeseCards().map(c => c.id).sort());
  }
  validateNexusCards(g.nexusCards!.cards!, g.players);
  const nexus = g.nexusCards!.cards!;
  assert.deepEqual([...nexus.deck, ...nexus.discard, ...Object.values(nexus.hands).filter((c): c is FactionId => c !== null)].sort(),
    [...NEXUS_FACTIONS].sort());
  if (g.moritaniTerror) {
    assert.deepEqual(g.moritaniTerror.tokens.map(t => t.kind).sort(), [...TERROR_KINDS].sort());
    assert.equal(new Set(g.moritaniTerror.tokens.map(t => t.id)).size, TERROR_KINDS.length);
  }
}
/** Physical Traitor custody in every zone, including face-up set-asides. */
export function mixedE3MoritaniTraitorCustody(g: Game): string[] {
  const retired = g.moritaniAssassinate?.opportunities.filter(o => o.stage === 'replaced').map(o => o.card!) ?? [];
  return [...(g.traitorReserve ?? []), ...g.players.flatMap(p =>
    [...p.traitors, ...p.traitorChoices, ...(p.faceDancers ?? []).map(d => d.leader)]),
    ...(g.ecazLoyalty?.card ? [g.ecazLoyalty.card] : []), ...retired].sort();
}
export function assertMixedE3MoritaniPhysical(g: Game): void {
  mixedE3MoritaniInventory(g);
  assert.deepEqual(mixedE3MoritaniTraitorCustody(g), traitorDeck(g.players, g.expansions.includes('ix')).sort());
  if (g.homeworlds) homeworldGameIntegrity(g);
  if (g.dukeVidal) assert.equal(g.dukeVidal.leader.id, DUKE_VIDAL_ID);
}

const MORITANI_START_CANDIDATES = ['habbanya_ridge_sietch', 'sietch_tabr', 'carthag', 'tueks_sietch', 'arrakeen'] as const;
/** Printed starting strongholds of the classic factions. */
const CLASSIC_START_STRONGHOLDS: Readonly<Record<string, readonly string[]>> = {
  atreides: ['arrakeen', 'carthag'], emperor: ['carthag'], harkonnen: ['carthag'],
  fremen: ['sietch_tabr', 'false_wall_south', 'false_wall_west'], guild: ['tueks_sietch'],
};
/** Moritani must start in an unoccupied territory; a printed stronghold keeps
 * the later genuine shipment destination legal. Never a seated faction's own start. */
function moritaniStart(g: Game): string {
  const taken = new Set(g.players.flatMap(player => CLASSIC_START_STRONGHOLDS[player.faction] ?? []));
  const free = MORITANI_START_CANDIDATES.find(id => !taken.has(id) &&
    g.players.every(player => !Object.keys(player.forces).some(key => key.startsWith(`${id}:`)) &&
      !(player.advisors && id in player.advisors)));
  assert.ok(free, 'Moritani needs an unoccupied printed stronghold to start in.');
  return `${free}:${territory(free).sectors[0]}`;
}

function permutation(source: readonly string[], desired: readonly string[]): number[] {
  assert.deepEqual([...source].sort(), [...desired].sort());
  const working = [...source], rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[j]] = [working[j], working[i]];
  }
  return rolls;
}
/** Scalar entropy for named original shuffles only; every other draw is native. */
function lottery<T>(rolls: readonly number[], operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (cursor < rolls.length && array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++];
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
const identity = (count: number): number[] => Array<number>(count).fill(0xffffffff);

/** The original physical Traitor pool as dealt: five printed discs per faction,
 * the Advanced CHOAM Auditor and the Ix cheap-hero identity. */
function traitorPool(g: Game): string[] {
  return [...g.players.flatMap(p => [
    ...leaders(p.faction).map(l => l.id),
    ...(p.faction === 'choam' && g.advanced ? [CHOAM_AUDITOR_ID] : []),
  ]), ...(g.expansions.includes('ix') ? [CHEAP_HERO_TRAITOR] : [])];
}
/** Deal position of a player's four Traitor choices; Tleilaxu receives none. */
function traitorBlockStart(g: Game, actor: string): number {
  let start = 0;
  for (const p of g.players) {
    if (p.id === actor) return start;
    if (p.faction !== 'tleilaxu') start += 4;
  }
  throw Error('The requested Traitor owner is not seated.');
}
/** Only the original Traitor shuffle is scoped, including the pre-deal Ecaz
 * Loyalty draw when Ecaz itself is seated (five/six-native combined roster). */
function traitorRolls(g: Game, target: string, moritani: string): number[] {
  const pool = traitorPool(g);
  const ecazSeated = g.players.some(p => p.faction === 'ecaz');
  const loyal = ecazSeated && g.advanced ? chooseEcazLoyalty(pool, 0xffffffff / 0x100000000) : null;
  const source = pool.filter(c => c !== loyal);
  const desired = [...source];
  const [at, to] = [desired.indexOf(target), traitorBlockStart(g, moritani)];
  assert.ok(at >= 0 && to >= 0); [desired[at], desired[to]] = [desired[to], desired[at]];
  return [...(loyal ? [0xffffffff] : []), ...permutation(source, desired)];
}
/** One requested skill per faction, each genuinely offered; the rest is the
 * original all14 order. The requested card is placed first in its own offer. */
function skillOrderFor(g: Game, requested: Partial<Record<FactionId, LeaderSkillId>>): string[] {
  const source = LEADER_SKILL_CARDS.map(c => c.id);
  const taken = new Set(Object.values(requested));
  const remaining = source.filter(s => !taken.has(s as LeaderSkillId));
  const desired: string[] = [];
  for (const p of g.players) {
    const wanted = requested[p.faction];
    desired.push(wanted ?? remaining.shift()!);
    desired.push(remaining.shift()!);
  }
  desired.push(...remaining);
  assert.equal(desired.length, source.length);
  return desired;
}

export function createMixedE3MoritaniLobby(options: MixedE3MoritaniOptions = {}): Game {
  const families = options.families ?? ['ix', 'choam'];
  assert.ok(families.length >= 1 && families.length <= 2 && new Set(families).size === families.length);
  const natives: Record<MixedE3MoritaniFamily, FactionId> = {
    ix: options.natives?.ix ?? 'tleilaxu', choam: options.natives?.choam ?? 'choam',
  };
  const roster: readonly FactionId[] = options.roster ??
    ['moritani', ...families.map(f => natives[f]), ...(options.classics ?? ['guild', 'emperor'])];
  const advanced = options.rules ? options.rules === 'advanced' : options.initial?.advanced ?? true;
  const expansions = ['ecaz', ...families] as string[];
  let g = options.initial ? mixedE3MoritaniReload(options.initial)
    : createGame('MIXEDE3MORITANI', newPlayer(options.seatIds?.[0] ?? roster[0], roster[0], roster[0]), advanced, expansions);
  if (!options.initial) for (const faction of roster.slice(1))
    joinGame(g, newPlayer(options.seatIds?.[g.players.length] ?? faction, faction, faction));
  assert.equal(g.advanced, advanced);
  assert.deepEqual([...g.expansions].sort(), [...expansions].sort());
  assert.equal(new Set(g.players.map(p => p.faction)).size, g.players.length);
  assert.ok(g.players.length >= 2 && g.players.length <= 6);
  assert.equal(g.players.filter(p => p.faction === 'moritani').length, 1);
  const nativesOnly = g.players.every(p =>
    ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'].includes(p.faction));
  assert.ok(g.players.filter(p => p.faction === 'ecaz').length === 0 ||
    (g.expansions.length === 3 && nativesOnly && g.players.length >= 5),
  'The native Ecaz side belongs to the separate Ecaz programme except in the original combined five/six-native roster.');
  for (const family of families)
    assert.ok(g.players.some(p => p.faction === natives[family] ||
      (family === 'ix' ? ['ixians', 'tleilaxu'] : ['choam', 'richese']).includes(p.faction)),
    `The selected ${family} family must actually seat one of its natives.`);
  const modules = { homeworlds: options.homeworlds ?? !!g.homeworlds,
    techTokens: options.tech ?? !!g.techTokens, strongholdCards: options.strongholds ?? !!g.strongholdCards };
  assert.ok(!modules.strongholdCards || advanced);
  const discovery = options.discovery ?? !!g.discoveryEnabled;
  const skills = options.skills ?? (options.initial?.status === 'setup' ? !!g.leaderSkills : false);
  assert.ok(g.status === 'lobby' || g.status === 'setup' && g.turn === 1 && g.phase === 0,
    'Continue only an original fresh lobby or its undealt first-turn setup.');
  if (g.status === 'lobby') {
    for (const [type, enabled] of Object.entries(modules)) if (!!g[type as keyof typeof modules] !== enabled)
      g = applyAction(g, g.host, { type, enabled });
    g.discoveryEnabled = discovery; g.nexusCards ??= { cards: null, phase: null };
    assert.deepEqual(g.nexusCards, { cards: null, phase: null });
    assert.ok(!g.ecazTreachery && !g.advancedPreview && !g.semutaPreview && !g.leaderSkills);
  } else {
    for (const [type, enabled] of Object.entries(modules)) assert.equal(!!g[type as keyof typeof modules], enabled);
    assert.equal(!!g.discoveryEnabled, discovery);
    assert.equal(!!g.leaderSkills, skills);
    assert.ok(g.nexusCards?.cards, 'A supplied original deal never acquires a new Nexus deck.');
  }
  return g;
}

/** The original combined five/six-native entry stays for the bare all-three-family
 * roster; every other mixed E3 shape uses the original generic Nexus or all14
 * Leader Skills entry. */
function mixedE3MoritaniEntry(options: MixedE3MoritaniOptions, g: Game, skills: boolean): MixedE3MoritaniEntry {
  if (options.entry) return options.entry;
  const nativesOnly = g.players.every(p => ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'].includes(p.faction));
  if (g.expansions.length === 3 && nativesOnly && g.players.length >= 5 && !skills &&
    !g.techTokens && !g.strongholdCards && !g.discoveryEnabled) return 'combined';
  return skills ? 'leaderSkills' : 'nexus';
}

/** Original mixed E3 native Moritani setup. Only undealt physical shuffles are
 * scoped: the fourteen skill cards, the twelve Nexus cards, the selected
 * ordinary deck and the original Traitor dealing. No hand, army, wallet or
 * reward is staged, and a supplied lobby or setup is never redealt. */
export function createMixedE3MoritaniSetup(options: MixedE3MoritaniOptions = {}): MixedE3MoritaniSetup {
  let g = createMixedE3MoritaniLobby(options);
  const actions: MixedE3MoritaniStep[] = [], staging: string[] = [];
  const skills = g.status === 'lobby' ? options.skills ?? false : !!g.leaderSkills;
  const entry = mixedE3MoritaniEntry(options, g, skills);
  const families = (options.families ?? ['ix', 'choam']).filter(f => g.expansions.includes(f));
  const moritani = g.players.find(p => p.faction === 'moritani')!.id;
  const nativeFaction = options.natives?.[families[0]] ?? (families[0] === 'ix' ? 'tleilaxu' : 'choam');
  const native = g.players.find(p => p.faction === nativeFaction);
  assert.ok(native, `The selected ${families[0]} native must be seated.`);
  const secondFaction = families.length > 1
    ? (options.natives?.[families[1]] ?? (families[1] === 'ix' ? 'tleilaxu' : 'choam')) : null;
  const secondNative = secondFaction ? g.players.find(p => p.faction === secondFaction)?.id ?? null : null;
  let location = '';
  const target = leaders(nativeFaction)[0].id;
  const requested: Partial<Record<FactionId, LeaderSkillId>> = {};
  if (skills) {
    requested[nativeFaction] = options.opponentSkill ?? 'suk-graduate';
    const pool: LeaderSkillId[] = ['warmaster', 'sandmaster', 'killer-medic', 'prana-bindu-adept', 'swordmaster-of-ginaz'];
    for (const p of g.players) if (!requested[p.faction] && p.faction !== 'moritani')
      requested[p.faction] = pool.find(s => !Object.values(requested).includes(s))!;
  }
  const initial = mixedE3MoritaniReload(g);
  let ixSeatCard: string | null = null;
  if (g.status === 'lobby') {
    for (const p of g.players) if (!p.ready) g = applyAction(g, p.id, { type: 'ready' });
    const initialize = () => entry === 'combined' ? initializeCombinedNexusGameForAudit(g, !!g.homeworlds)
      : skills ? initializeLeaderSkillsGameForAudit(g) : initializeNexusGameForAudit(g);
    if (options.initial) g = initialize();
    else {
      assert.ok(!g.players.some(p => p.faction === 'beneGesserit'),
        'A fresh crafted deal keeps the original prediction stage out of its named shuffle list; supply a Bene Gesserit lobby as `initial`.');
      const deck = treacheryDeck(g.expansions), remaining = [...deck];
      const take = (kind: Card['kind']) => {
        const at = remaining.findIndex(c => c.kind === kind);
        assert.ok(at >= 0, `The original deck must hold a ${kind}.`);
        return remaining.splice(at, 1)[0].id;
      };
      const ixPlayer = g.players.find(p => p.faction === 'ixians');
      // With Ixians the physical starting row is drawn per seat and the chosen
      // card is kept by Ixians; the remainder is dealt to the others in seat
      // order, so the row is ordered Ixians first. Without Ixians each seat
      // draws its own starting card directly, Harkonnen drawing two.
      const order = ixPlayer ? [ixPlayer, ...g.players.filter(p => p.id !== ixPlayer.id)] : g.players;
      const row: string[] = [];
      for (const p of order) {
        const quantity = ixPlayer ? 1 : p.faction === 'harkonnen' ? 2 : 1;
        for (let i = 0; i < quantity; i++) row.push(p.id === native.id ? take('projectile') : take('worthless'));
      }
      if (ixPlayer && g.players.some(p => p.faction === 'harkonnen')) row.push(take('worthless'));
      if (ixPlayer) ixSeatCard = row[0];
      const rolls: number[] = [];
      if (skills) rolls.push(...permutation(LEADER_SKILL_CARDS.map(c => c.id), skillOrderFor(g, requested)));
      if (g.discoveryEnabled) rolls.push(...identity(7));
      rolls.push(...identity(NEXUS_FACTIONS.length - 1));
      rolls.push(...permutation(deck.map(c => c.id), [...row, ...remaining.map(c => c.id)]));
      const spiceCount = spiceDeck(g.expansions.includes('ix')).length +
        (g.discoveryEnabled ? DISCOVERY_SPICE_CARDS.length + 1 : 0);
      rolls.push(...identity(spiceCount - 1));
      if (!skills) rolls.push(...traitorRolls(g, target, moritani));
      g = lottery(rolls, initialize);
    }
  }
  assert.equal(!!g.leaderSkills, skills);
  const offered = mixedE3MoritaniReload(g);
  for (let n = 0; g.status === 'setup' && n < 400; n++) {
    const decision = g.decision;
    if (decision?.kind === 'ixSetup') {
      const offer = viewGame(g, decision.player).ixTechnology!.setup!;
      const wanted = offer.find(c => c.id === ixSeatCard) ??
        offer.find(c => c.kind === 'projectile') ?? offer[0];
      assert.ok(wanted, 'The original Ix pre-training row must offer a physical card.');
      const rolls = identity(Math.max(g.players.length - 2, 0));
      actions.push({ actor: decision.player, action: { type: 'decision', card: wanted.id } });
      g = lottery(rolls, () => applyAction(mixedE3MoritaniReload(g), decision.player, { type: 'decision', card: wanted.id }));
      continue;
    }
    if (g.setupStage === 'leaderSkills' && !g.decision) {
      const actor = Object.keys(g.leaderSkills!.offers)[0], own = viewGame(g, actor).leaderSkills!;
      const offer = own.offer!;
      const wanted = requested[mixedE3MoritaniPlayer(g, actor).faction];
      const skill = wanted && offer.cards.includes(wanted) && !own.unavailableSkills?.[wanted]
        ? wanted : offer.cards.find(c => !own.unavailableSkills?.[c])!;
      assert.ok(skill);
      const leader = own.eligibleLeaders.find(l => l.id === target) ?? own.eligibleLeaders[0];
      assert.ok(leader);
      const step = { actor, action: { type: 'leaderSkill' as const, event: offer.event, skill, leader: leader.id } };
      if (Object.keys(g.leaderSkills!.offers).length === 1) {
        // Original order: the chosen card returns to the physical deck, then the
        // real Traitor deal (and pre-deal Ecaz Loyalty when Ecaz is seated).
        const rolls = [...identity(g.leaderSkills!.deck.length), ...traitorRolls(g, target, moritani)];
        actions.push(structuredClone(step));
        g = lottery(rolls, () => applyAction(mixedE3MoritaniReload(g), step.actor, step.action));
      } else g = stepMixedE3Moritani(g, step, actions);
      continue;
    }
    if (decision?.kind === 'moritaniSetup') {
      location = moritaniStart(g);
      const [start, sector] = location.split(':');
      g = stepMixedE3Moritani(g, { actor: decision.player,
        action: { type: 'decision', territory: start, sector: Number(sector) } }, actions);
      continue;
    }
    if (g.status === 'setup' && g.setupStage === 'forces' && !g.decision) {
      const fremen = g.players.find(p => p.faction === 'fremen');
      const ecaz = g.players.find(p => p.faction === 'ecaz');
      const bg = g.players.find(p => p.faction === 'beneGesserit');
      if (fremen && fremen.reserves === 20) {
        g = stepMixedE3Moritani(g, { actor: fremen.id,
          action: { type: 'fremenSetup', placements: { sietch_tabr: 0, false_wall_south: 10, false_wall_west: 0 } } }, actions);
        continue;
      }
      if (ecaz && ecaz.reserves === 20) {
        const key = `imperial_basin:${territory('imperial_basin').sectors[0]}`;
        g = stepMixedE3Moritani(g, { actor: ecaz.id,
          action: { type: 'ecazSetup', placements: { [key]: 6 } } }, actions);
        continue;
      }
      if (g.advanced && bg && !bg.advisorSetup) {
        // A printed non-stronghold keeps every stronghold free for Moritani's start.
        g = stepMixedE3Moritani(g, { actor: bg.id,
          action: { type: 'advisorSetup', territory: 'imperial_basin', sector: territory('imperial_basin').sectors[0] } }, actions);
        continue;
      }
    }
    const next = nextMixedE3MoritaniStep(g);
    assert.ok(next, `Original setup requires the owner of ${decision?.kind ?? g.setupStage}.`);
    if (next.action.type === 'traitor') {
      const player = mixedE3MoritaniPlayer(g, next.actor), choices = player.traitorChoices;
      const nativeCard = choices.find(c => leaders(nativeFaction).some(l => l.id === c));
      next.action.leader = player.faction === 'moritani' ? choices.find(c => c === target) ?? nativeCard ?? choices[0]
        : player.faction === nativeFaction ? nativeCard ?? choices[0] : choices[0];
    }
    g = stepMixedE3Moritani(g, next, actions);
  }
  assert.equal(g.status, 'playing', 'Original mixed E3 setup must complete into play.');
  const own = mixedE3MoritaniPlayer(g, moritani);
  assert.equal(own.forces[location], 6, 'Moritani placed its real six starting counters.');
  const held = own.traitors.find(c => leaders(nativeFaction).some(l => l.id === c));
  assert.ok(held, 'The original Traitor deal must place one selected-family card in Moritani\'s hand.');
  const seats: Partial<Record<FactionId, string>> = {};
  for (const p of g.players) seats[p.faction] = p.id;
  mixedE3MoritaniInventory(g);
  return { initial, offered, afterSetup: mixedE3MoritaniReload(g), entry, families, moritani, seats,
    native: native.id, nativeFaction, secondNative, secondFaction,
    partner: g.players.find(p => p.id !== moritani && p.id !== native.id)?.id ?? null,
    classics: g.players.filter(p => p.id !== moritani && p.id !== native.id && p.id !== secondNative).map(p => p.id),
    location, target: held, targetSkillOwner: g.leaderSkills?.assignments.find(a => a.owner === native.id)?.leader ?? null,
    actions, staging };
}

/** Only unplayed original Spice Cards are positioned, never invented. */
export function orderMixedE3MoritaniSpice(g: Game, worm = false): void {
  const kinds = [...(worm ? ['worm'] : []), ...Array<string>(g.advanced ? 2 : 1).fill('land')];
  for (const [position, kind] of kinds.entries())
    frontNativeHomeworldSpice(g, c => kind === 'worm'
      ? 'worm' in c && (g.discoveries ? !!c.greatMaker : !c.greatMaker && !c.suppressed)
      : 'territory' in c && !c.discovery && !['arrakeen', 'tueks_sietch'].includes(c.territory), position);
}

/** Real alliance change by two unallied seats, then Moritani's own genuine
 * closing Nexus draw after both Advanced Spice piles have been dealt. */
export function closeMixedE3Moritani(f: MixedE3MoritaniSetup, state: Game):
{ alliance: Game; drawing: Game; draw: MixedE3MoritaniTransition; game: Game } | null {
  let g = advanceMixedE3Moritani(state, s => !!s.nexus && !s.spiceWindow && !s.spiceResolution && mixedE3MoritaniClean(s), f.actions);
  const others = g.players.filter(p => p.id !== f.moritani && !p.ally); assert.ok(others.length >= 2);
  for (const [actor, ally] of [[others[0].id, others[1].id], [others[1].id, others[0].id]])
    g = stepMixedE3Moritani(g, { actor, action: { type: 'alliance', target: ally } }, f.actions);
  const alliance = mixedE3MoritaniReload(g);
  g = advanceMixedE3Moritani(g, s => s.nexusCards?.phase?.stage === 'drawing' && mixedE3MoritaniClean(s), f.actions);
  if (!g.nexusCards!.phase!.eligible.includes(f.moritani)) return null;
  const cards = g.nexusCards!.cards!, at = cards.deck.indexOf('moritani'); assert.ok(at >= 0);
  cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  f.staging.push('Conserved undealt original Moritani Nexus singleton ordered before its real unallied closing draw.');
  const drawing = mixedE3MoritaniReload(g), step: MixedE3MoritaniStep = { actor: f.moritani,
    action: { type: 'nexusCardChoice', turn: g.turn, card: cards.hands[f.moritani] ?? null, choice: 'draw', ownRedraws: 0 } };
  g = stepMixedE3Moritani(g, step, f.actions);
  return { alliance, drawing, draw: { before: drawing, step: structuredClone(step), after: mixedE3MoritaniReload(g) }, game: g };
}

/** Turn-one storm/collection/Mentat and the turn-two storm, then the original
 * closing deal. Two-seat rosters have no legal unallied closing qualification. */
export function createMixedE3MoritaniProgramme(options: MixedE3MoritaniOptions = {}): MixedE3MoritaniProgramme {
  const f = createMixedE3MoritaniSetup(options);
  const result: MixedE3MoritaniProgramme = { ...f, game: f.afterSetup, firstStorm: f.afterSetup,
    firstMentat: null, alliance: null, drawing: null, draws: [] };
  if (!f.partner) return result;
  let g = mixedE3MoritaniReload(f.afterSetup);
  orderMixedE3MoritaniSpice(g);
  g = advanceMixedE3Moritani(g, s => s.phase === 1 && mixedE3MoritaniClean(s), f.actions);
  result.firstStorm = mixedE3MoritaniReload(g);
  let firstMentat: MixedE3MoritaniTransition | null = null;
  for (let n = 0; g.turn === 1 && n < 700; n++) {
    const before = mixedE3MoritaniReload(g), step = nextMixedE3MoritaniStep(g); assert.ok(step);
    g = stepMixedE3Moritani(g, step, f.actions);
    if (g.turn === 2) firstMentat = { before, step: structuredClone(step), after: mixedE3MoritaniReload(g) };
  }
  assert.ok(firstMentat, 'The original first Mentat must hand over to turn two.');
  result.firstMentat = firstMentat;
  g = advanceMixedE3Moritani(g, s => s.phase === 1 && mixedE3MoritaniClean(s), f.actions);
  orderMixedE3MoritaniSpice(g, true);
  const closed = closeMixedE3Moritani(f, g);
  if (closed) { g = closed.game; result.alliance = closed.alliance; result.drawing = closed.drawing;
    result.draws = [closed.draw]; }
  g = advanceMixedE3Moritani(g, s => s.phase === 5 && mixedE3MoritaniClean(s), f.actions);
  mixedE3MoritaniInventory(g);
  result.game = g; return result;
}

/** A real phase-five shipment, including the original paid Homeworld entry. */
export function shipMixedE3Moritani(g: Game, actor: string, destination: string, amount: number, elite = 0,
  actions?: MixedE3MoritaniStep[]): MixedE3MoritaniTransition & { settled: Game } {
  g = advanceMixedE3Moritani(g, s => s.phase === 5 && s.active === actor && mixedE3MoritaniClean(s), actions);
  const before = mixedE3MoritaniReload(g), view = viewGame(g, actor);
  const sources = g.homeworlds ? nativeShipmentSources(view, amount, elite) : undefined;
  let action: Action;
  if (destination.startsWith('homeworld:')) {
    assert.ok(sources); const quote = homeworldShipmentChoice(view, destination,
      Object.fromEntries(Object.entries(sources).filter(([, f]) => f.normal + f.elite > 0)));
    assert.ok(quote.action, quote.blocked ?? 'Original paid native entry unavailable.'); action = quote.action;
  } else {
    const [site, sector] = destination.split(':');
    action = { type: 'ship', territory: site, sector: Number(sector), amount, elite, allyPayment: 0,
      ...(sources ? { homeworldSources: sources } : {}) };
  }
  const step = { actor, action }; g = stepMixedE3Moritani(g, step, actions);
  const after = mixedE3MoritaniReload(g);
  g = advanceMixedE3Moritani(g, s => !s.pendingHomeworldShipment && !s.pendingShipment && mixedE3MoritaniClean(s), actions);
  return { before, step, after, settled: g };
}

/** Real phase-six battle choice for the pair created by genuine movement. */
export function openMixedE3MoritaniBattle(g: Game, first: string, second: string,
  actions?: MixedE3MoritaniStep[]): Game {
  g = advanceMixedE3Moritani(g, s => s.phase === 6 && mixedE3MoritaniClean(s), actions);
  const choice = viewGame(g, g.active!).battleChoices.find(b => [first, second].includes(b.attacker) &&
    [first, second].includes(b.defender)); assert.ok(choice, 'The real battle pair must be choosable.');
  return stepMixedE3Moritani(g, { actor: choice.chooser, action: { type: 'chooseBattle', territory: choice.territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } }, actions);
}
export function revealMixedE3MoritaniPlans(g: Game, plans: readonly MixedE3MoritaniStep[],
  actions?: MixedE3MoritaniStep[]): Game {
  for (const plan of plans) {
    g = stepMixedE3Moritani(g, plan, actions);
    if (!g.battle?.revealed) g = advanceMixedE3Moritani(g, s => !!s.battle && mixedE3MoritaniClean(s) &&
      !s.battle.preparation && s.battle.preLeader?.closed !== false, actions);
  }
  assert.ok(g.battle?.revealed); return g;
}

/** The genuine Advanced loss: Moritani's real movement position is attacked by
 * the selected native's real shipment, and the winning disc survives. With
 * `disc: 'held'` the native opposes with the very disc Moritani holds, which is
 * the only legal normal own-card Traitor declaration. */
/** Highest- or lowest-strength legal commitment for one combatant, chosen by
 * trying the engine's own plan validator. Never assumes a fixed dial or budget. */
function legalPlan(g: Game, actor: string, leader: string, prefer: 'max' | 'min',
  extra: { weapon?: string; defense?: string } = {}): Action {
  const steps: MixedE3MoritaniStep[] = [];
  let base = g;
  for (let n = 0; n < 6; n++) {
    const decision = base.decision;
    if (decision?.kind === 'moritaniPlacement') {
      const decline: MixedE3MoritaniStep = { actor: decision.player, action: { type: 'decision', decline: true } };
      steps.push(decline); base = stepMixedE3Moritani(base, decline); continue;
    }
    if (decision?.kind !== 'leaderSkillVisibility') break;
    const posture: MixedE3MoritaniStep = { actor: decision.player,
      action: { type: 'leaderSkillVisibility', event: decision.event, hide: decision.player === actor } };
    steps.push(posture); base = stepMixedE3Moritani(base, posture);
  }
  const spice = mixedE3MoritaniPlayer(base, actor).spice;
  const supports = prefer === 'max' ? Array.from({ length: spice + 1 }, (_, i) => spice - i) : [0];
  const dials = prefer === 'max' ? Array.from({ length: 13 }, (_, i) => 12 - i) : [0];
  const reasons = new Set<string>();
  for (const support of supports) for (const dial of dials) {
    for (const card of [extra, {}]) {
      const action: Action = { type: 'battlePlan', leader, dial, support, ...card };
      try { applyAction(mixedE3MoritaniReload(base), actor, action); return action; }
      catch (error) { reasons.add(error instanceof Error ? error.message : String(error)); }
    }
  }
  throw Error(`No legal battle plan for ${actor} (spice ${spice}): ${[...reasons].join(' | ')}`);
}
/** The genuine Advanced loss: Moritani's real movement position is attacked by
 * the selected native's real shipment, and the winning disc survives. With
 * `disc: 'held'` the native opposes with the very disc Moritani holds, which is
 * the only legal normal own-card Traitor declaration. */
export function stageMixedE3MoritaniLoss(f: MixedE3MoritaniSetup, state: Game,
  options: { disc?: 'strongest' | 'held' } = {}): MixedE3MoritaniBattle {
  const arrival = shipMixedE3Moritani(mixedE3MoritaniReload(state), f.native, f.location, 1, 0, f.actions);
  const ready = advanceMixedE3Moritani(arrival.settled, s => !s.decision, f.actions);
  let g = openMixedE3MoritaniBattle(ready, f.moritani, f.native, f.actions);
  // A pending posture declaration is a real private choice; conceal it first so
  // both plans are submitted against the same genuine state.
  for (let n = 0; n < 4 && g.decision?.kind === 'leaderSkillVisibility'; n++) {
    const posture = g.decision;
    g = stepMixedE3Moritani(g, { actor: posture.player,
      action: { type: 'leaderSkillVisibility', event: posture.event, hide: true } }, f.actions);
  }
  const arrangements = mixedE3MoritaniReload(g);
  const trained = new Set((g.leaderSkills?.assignments ?? []).map(a => a.leader));
  const ownLeader = mixedE3MoritaniPlayer(g, f.moritani).leaders.filter(l => !l.dead && !trained.has(l.id))
    .sort((a, b) => a.strength - b.strength)[0];
  const enemyLeader = (options.disc ?? 'strongest') === 'held'
    ? mixedE3MoritaniPlayer(g, f.native).leaders.find(l => l.id === f.target)!
    : mixedE3MoritaniPlayer(g, f.native).leaders
      .filter(l => !l.dead && l.id !== f.target && !trained.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
  const ownCard = mixedE3MoritaniPlayer(g, f.moritani).hand.find(c => isDefenseCard(c));
  const enemyCard = mixedE3MoritaniPlayer(g, f.native).hand.find(c => isWeaponCard(c));
  assert.ok(ownLeader && enemyLeader, 'The original deal must supply the loss discs.');
  const plans: MixedE3MoritaniStep[] = [
    { actor: f.moritani, action: legalPlan(g, f.moritani, ownLeader.id, 'min',
      ownCard ? { defense: ownCard.id } : {}) },
    { actor: f.native, action: legalPlan(g, f.native, enemyLeader.id, 'max',
      enemyCard ? { weapon: enemyCard.id } : {}) },
  ];
  const revealed = revealMixedE3MoritaniPlans(mixedE3MoritaniReload(g), plans, f.actions);
  return { arrangements, location: f.location, arrival, plans, revealed,
    ownLeader: ownLeader.id, enemyLeader: enemyLeader.id, target: f.target,
    ownCards: ownCard ? [ownCard.id] : [], enemyCards: enemyCard ? [enemyCard.id] : [] };
}

/** Resolve to the next real human boundary; never consumes a physical choice.
 * `normalCallOwner` is the only seat allowed to call its own Traitor normally. */
export function settleMixedE3MoritaniBoundary(g: Game, normalCallOwner: string | null = null,
  actions?: MixedE3MoritaniStep[], normalCallCard: string | null = null): MixedE3MoritaniBoundary {
  const kinds: Readonly<Record<string, MixedE3MoritaniBoundary['kind']>> = {
    battleLosses: 'losses', sukRescue: 'rescue', ixSubstitution: 'substitution', moritaniAssassinate: 'assassination',
    battleCards: 'cards', techToken: 'tech', faceDance: 'faceDance',
  };
  for (let n = 0; n < 240; n++) {
    const kind = g.decision && !g.response && !g.phaseOpening ? kinds[g.decision.kind] : undefined;
    if (kind) return { game: g, kind };
    if (!g.battle && mixedE3MoritaniClean(g) && !g.pendingTreacheryDiscard) return { game: g, kind: 'settled' };
    const next = nextMixedE3MoritaniStep(g);
    assert.ok(next, `Original suffix stalled at ${g.decision?.kind ?? g.phase}.`);
    if (next.action.type === 'traitorCall') {
      const battle = g.battle;
      const opposing = battle && (battle.attacker === next.actor || battle.defender === next.actor)
        ? battle.plans[battle.attacker === next.actor ? battle.defender : battle.attacker].leader : null;
      // Only the fixture's own held matching card is a legal normal call.
      next.action.call = next.actor === normalCallOwner && !!normalCallCard && opposing === normalCallCard &&
        mixedE3MoritaniPlayer(g, next.actor).traitors.includes(normalCallCard);
    }
    g = stepMixedE3Moritani(g, next, actions);
  }
  throw Error('Original battle suffix did not reach its next physical boundary.');
}
export function finishMixedE3MoritaniBattle(g: Game, actions?: MixedE3MoritaniStep[]): Game {
  return advanceMixedE3Moritani(g, s => !s.battle && mixedE3MoritaniClean(s) && !s.pendingTreacheryDiscard, actions);
}

/** Same public/held inputs as the sibling Nexus quotes, plus native Moritani. */
export function quoteMixedE3MoritaniBattle(g: Game): BattleResolutionQuote {
  const b = g.battle; assert.ok(b?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const p = mixedE3MoritaniPlayer(g, actor), view = viewGame(g, actor).battle!; assert.ok(view.ownForces);
    return { id: actor, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand,
      plan: b.plans[actor], leader: p.leaders.find(l => l.id === b.plans[actor].leader) ??
        (g.dukeVidal?.controller === actor ? g.dukeVidal.leader : undefined), forces: view.ownForces,
      stronghold: view.strongholdEffects[actor], leaderSkills: (g.leaderSkills?.assignments ?? []).filter(a => a.owner === actor)
        .map(a => ({ skill: a.skill, leader: a.leader, faceUp: !b.leaderSkillHidden?.[actor], captured: false })) };
  };
  const publicBattle = viewGame(g, g.host).battle!;
  const home = homeworldBattleLocation(g, b.territory);
  return quoteBattleResolution({ advanced: g.advanced, typedCasualties: !!g.homeworlds, turn: g.turn, territory: b.territory,
    ...(home ? { homeworld: { native: home.native, card: home.card, side: home.side, nativeForces: { ...home.forces[home.native] } } } : {}),
    aggressor: publicBattle.aggressor, attacker: side(b.attacker), defender: side(b.defender),
    voters: publicBattle.traitorVoters.map(actor => ({ id: actor,
      beneficiary: [b.attacker, b.defender].includes(actor) ? actor : mixedE3MoritaniPlayer(g, actor).ally!,
      called: b.traitorCalls[actor] ?? false, traitors: mixedE3MoritaniPlayer(g, actor).traitors })),
    participants: g.players, physicalCards: [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false, nexusMoritani: true });
}

/** True printed Horror/Extortion/… token identities from the actual supply. */
export function mixedE3MoritaniToken(g: Game, kind: TerrorKind) {
  const token = g.moritaniTerror!.tokens.find(t => t.kind === kind); assert.ok(token); return token;
}
/** Supply-only native Cunning declaration of an actual unplaced token. */
export function mixedE3MoritaniCunningRequest(g: Game, actor: string, kind: TerrorKind = 'robbery',
  site = 'red_chasm'): Action {
  const offer = viewGame(g, actor).nexusMoritani; assert.ok(offer);
  return { type: 'decision', token: mixedE3MoritaniToken(g, kind).id, territory: site, nexus: offer.event };
}
/** Native Terror arrival on a real shipment; the token identity stays private. */
export function mixedE3MoritaniTerrorReveal(g: Game, actor: string): Game {
  return stepMixedE3Moritani(stepMixedE3Moritani(g, { actor, action: { type: 'decision', reveal: true } }),
    { actor, action: { type: 'decision', choice: 'spice' } });
}
export function assertMixedE3MoritaniRejects(g: Game, actor: string, action: Action): void {
  const before = mixedE3MoritaniReload(g);
  assert.throws(() => applyAction(g, actor, action), 'Rejected consumers must not spend original stock.');
  assert.deepEqual(g, before);
}
