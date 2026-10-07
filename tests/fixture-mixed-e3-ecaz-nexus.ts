import assert from 'node:assert/strict';
import { applyAction, createGame, initializeLeaderSkillsGameForAudit, initializeNexusGameForAudit,
  joinGame, newPlayer, viewGame } from '../game/engine';
import type { Action, Game, Player } from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { Difficulty } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import { spiceDeck, treacheryDeck } from '../game/cards';
import type { SpiceCard } from '../game/cards';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { traitorDeck } from '../game/traitors';
import { richeseCards } from '../game/richese-cards';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_SPICE_CARDS, validateDiscoveryState } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldCombatLocation } from '../game/homeworld-combat';
import { quoteBattleResolution } from '../game/battle-resolution-quote';
import type { BattleResolutionQuote, ResolutionCombatant } from '../game/battle-resolution-quote';
import { nextPairedE3NexusStep, quietPairedE3NexusChoice } from './fixture-paired-e3-nexus-modules';

/** Original E3/native faces and PDF21–23 module independence only. No shared-Duke
 * training, odd Basic Occupy ruling, exceptional Ghola or Sandtrout override. */
export const MIXED_E3_ECAZ_NEXUS_SOURCES = {
  nexus: 'docs/NEXUS_CARD_RULES.md', ecaz: 'docs/NEXUS_ECAZ_RULES.md',
  skills: 'docs/LEADER_SKILLS_RULES.md', homeworlds: 'docs/HOMEWORLD_RULES.md',
  entry: 'docs/MORITANI_ENTRY_TIMING.md', decisions: 'docs/RULE_DECISIONS.md',
} as const;
export interface MixedE3EcazNexusStep { actor: string; action: Action }
export interface MixedE3EcazNexusTransition { before: Game; step: MixedE3EcazNexusStep; after: Game }
export interface MixedE3EcazNexusOptions {
  /** Original undealt lobby or original first-turn setup; supplied entropy is never replaced. */
  initial?: Game;
  families?: readonly ('ix' | 'choam')[];
  roster?: readonly FactionId[];
  advanced?: boolean;
  skills?: boolean;
  homeworlds?: boolean;
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  skill?: LeaderSkillId;
  /** Original matching Face Dancer lottery, before that first hand is dealt. */
  matchingDancer?: boolean;
}
export interface MixedE3EcazNexusSetup {
  initial: Game; offered: Game; afterSetup: Game; owner: string;
  seats: Partial<Record<FactionId, string>>; trainers: Record<string, string>;
  ixOffer: MixedE3EcazNexusTransition | null; actions: MixedE3EcazNexusStep[];
}
export interface MixedE3EcazNexusProgramme extends MixedE3EcazNexusSetup {
  game: Game; claim: MixedE3EcazNexusTransition | null;
  firstArrival: MixedE3EcazNexusTransition | null; reveal: MixedE3EcazNexusTransition | null;
  entry: MixedE3EcazNexusTransition | null; vote: Game | null; votes: MixedE3EcazNexusTransition[];
  ride: MixedE3EcazNexusTransition | null; firstMentat: MixedE3EcazNexusTransition | null;
  alliance: Game | null; drawing: Game | null; draws: MixedE3EcazNexusTransition[];
}
export interface MixedE3EcazNexusBattle extends MixedE3EcazNexusProgramme {
  ally: string; opponent: string; location: string; ecazForces: number;
  arrivals: MixedE3EcazNexusTransition[]; beforeBattle: Game; choice: MixedE3EcazNexusStep;
}
export const mixedE3EcazNexusReload = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;
export const mixedE3EcazNexusClean = (g: Game): boolean =>
  !g.response && !g.phaseOpening && !g.decision && !g.pendingTreacheryDiscard && !g.truthtrance;
export function mixedE3EcazNexusPlayer(g: Game, actor: string): Player {
  const p = g.players.find(p => p.id === actor); assert.ok(p); return p;
}
export function mixedE3EcazNexusPolicy(g: Game, actor: string, difficulty: Difficulty): Action[] {
  const saved = mixedE3EcazNexusReload(g); mixedE3EcazNexusPlayer(saved, actor).bot = difficulty;
  return botActions(viewGame(saved, actor));
}
/** Pure queue controller: owned physical decisions, including posture, are
 * returned to the human. This never installs a plan or silently accepts rescue. */
export function nextMixedE3EcazNexusStep(g: Game): MixedE3EcazNexusStep | null {
  if (!g.response && !g.phaseOpening && !g.pendingTreacheryDiscard) {
    if (g.setupStage === 'leaderSkills') return null;
    if (g.decision && ['ecazBattleLead', 'leaderSkillVisibility', 'moritaniPlacement',
      'moritaniAssassinate', 'moritaniTerror', 'ecazPlacement', 'ecazAmbassador', 'battleLosses',
      'battleCards', 'techToken', 'sukRescue', 'ixSubstitution', 'faceDance', 'strongholdCopy',
      'discoveryEntry', 'greatMakerVote', 'greatMakerRide', 'homeworldDefense',
      'homeworldRevivalDeployment', 'moritaniRetention', 'choamBattleFunding'].includes(g.decision.kind)) return null;
    if (g.decision?.kind === 'richeseUnbid') return { actor: g.decision.player,
      action: { type: 'decision', event: g.richeseBidding!.event, keep: false } };
  }
  // A revealed battle awaits every voter's declaration; declining is a legal,
  // deterministic choice that keeps the physical battle untouched.
  const battle = g.battle;
  const publicBattle = battle?.revealed ? viewGame(g, g.host).battle : null;
  if (!g.response && battle?.revealed && publicBattle) {
    const voter = (publicBattle.traitorVoters ?? []).find(id => battle.traitorCalls[id] === undefined);
    if (voter) return { actor: voter, action: { type: 'traitorCall', call: false } };
  }
  const next = nextPairedE3NexusStep(mixedE3EcazNexusReload(g));
  return next ? structuredClone(next) : null;
}
export function stepMixedE3EcazNexus(g: Game, step: MixedE3EcazNexusStep,
  actions?: MixedE3EcazNexusStep[]): Game {
  const after = applyAction(mixedE3EcazNexusReload(g), step.actor, structuredClone(step.action));
  actions?.push(structuredClone(step)); return after;
}
export function mixedE3EcazNexusTransition(g: Game, step: MixedE3EcazNexusStep,
  actions?: MixedE3EcazNexusStep[]): MixedE3EcazNexusTransition {
  return { before: mixedE3EcazNexusReload(g), step: structuredClone(step), after: stepMixedE3EcazNexus(g, step, actions) };
}
export function quietMixedE3EcazNexusChoice(g: Game): MixedE3EcazNexusStep | null {
  const d = g.decision;
  if (!g.response && !g.phaseOpening && d?.kind === 'choamBattleFunding')
    return { actor: d.player, action: { type: 'decision', amount: 0 } };
  return quietPairedE3NexusChoice(g);
}
export function advanceMixedE3EcazNexus(g: Game, until: (g: Game) => boolean,
  actions?: MixedE3EcazNexusStep[], choose?: (g: Game) => MixedE3EcazNexusStep | null): Game {
  for (let n = 0; n < 3600; n++) {
    if (until(g)) return g;
    assert.notEqual(g.status, 'finished');
    const next = nextMixedE3EcazNexusStep(g) ?? choose?.(g);
    assert.ok(next, `Owner must choose ${g.decision?.kind ?? 'a sealed plan'} at ${g.turn}/${g.phase}`);
    g = stepMixedE3EcazNexus(g, next, actions);
  }
  throw Error('Original mixed E3 Ecaz chronology did not reach its requested boundary');
}
function permutation<T>(source: readonly T[], desired: readonly T[]): number[] {
  assert.equal(source.length, desired.length);
  const current = [...source], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); return rolls;
}
/** Used only before original component deals. UUID/byte-array entropy stays native. */
function originalLottery<T>(rolls: readonly number[], operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function preferences(g: Game, requested: LeaderSkillId): LeaderSkillId[] {
  const fallback: LeaderSkillId[] = ['swordmaster-of-ginaz', 'prana-bindu-adept', 'killer-medic',
    'sandmaster', 'master-of-assassins', 'bureaucrat'];
  const result: LeaderSkillId[] = [];
  for (const p of g.players) {
    const desired = p.faction === 'ecaz' ? requested : fallback.find(s => s !== requested && !result.includes(s));
    assert.ok(desired); result.push(desired);
  }
  return result;
}
/** A conserved original undealt Spice permutation, not a played-phase rewrite.
 * Two actual closing Nexuses are arranged for the later coalition chronology. */
function spiceRolls(g: Game): number[] {
  const source: SpiceCard[] = [...spiceDeck(g.expansions.includes('ix')),
    ...(g.discoveryEnabled ? [...DISCOVERY_SPICE_CARDS, { worm: true as const, greatMaker: true as const }] : [])];
  const rest = [...source], prefix: SpiceCard[] = [];
  const take = (matches: (c: SpiceCard) => boolean) => {
    const at = rest.findIndex(matches); assert.ok(at >= 0); prefix.push(rest.splice(at, 1)[0]);
  };
  take(c => 'territory' in c && (g.discoveryEnabled ? c.discovery === 'discovery-hagga-basin' : !c.discovery && c.territory === 'hagga_basin'));
  if (g.advanced) take(c => 'territory' in c && !c.discovery && c.territory === 'broken_land');
  take(c => 'worm' in c && (g.discoveryEnabled ? !!c.greatMaker : !c.greatMaker));
  take(c => 'territory' in c && !c.discovery && c.territory === 'rock_outcroppings');
  if (g.advanced) take(c => 'territory' in c && !c.discovery && c.territory === 'oh_gap');
  take(c => 'worm' in c && !c.greatMaker);
  take(c => 'territory' in c && !c.discovery && c.territory === 'wind_pass_north');
  if (g.advanced) take(c => 'territory' in c && !c.discovery);
  return permutation(source, [...prefix, ...rest]);
}
export function createMixedE3EcazNexusSetup(options: MixedE3EcazNexusOptions = {}): MixedE3EcazNexusSetup {
  const families = options.families ?? (options.initial
    ? options.initial.expansions.filter((e): e is 'ix' | 'choam' => e === 'ix' || e === 'choam') : ['ix']);
  const roster: readonly FactionId[] = options.roster ?? options.initial?.players.map(p => p.faction) ??
    ['ecaz', ...(families.includes('ix') ? ['ixians' as const] : []),
      ...(families.includes('choam') ? ['choam' as const] : []), 'guild', options.discovery ? 'fremen' : 'emperor'];
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  let g = options.initial ? mixedE3EcazNexusReload(options.initial)
    : createGame('MIXEDE3ECAZNEXUS', newPlayer(roster[0], roster[0], roster[0]), advanced, ['ecaz', ...families]);
  if (!options.initial) for (const f of roster.slice(1)) joinGame(g, newPlayer(f, f, f));
  assert.equal(g.advanced, advanced); assert.deepEqual(g.players.map(p => p.faction), roster);
  assert.ok(roster.length >= 2 && roster.length <= 6 && new Set(roster).size === roster.length);
  assert.ok(roster.includes('ecaz') && families.length >= 1 && families.length <= 2 && new Set(families).size === families.length);
  assert.deepEqual([...g.expansions].sort(), ['ecaz', ...families].sort());
  for (const family of families) assert.ok(roster.some(f => (family === 'ix' ? ['ixians', 'tleilaxu'] : ['choam', 'richese']).includes(f)));
  assert.ok(!g.ecazTreachery);
  assert.ok(g.status === 'lobby' || g.status === 'setup' && g.turn === 1 && g.phase === 0,
    'Continue only original lobby/setup, never convert a played save');
  const skills = options.skills ?? (options.initial ? !!g.leaderSkills : true);
  const flags = { homeworlds: options.homeworlds ?? !!g.homeworlds, techTokens: options.tech ?? !!g.techTokens,
    strongholdCards: options.strongholds ?? !!g.strongholdCards };
  const discovery = options.discovery ?? !!g.discoveryEnabled;
  assert.ok(!flags.techTokens || roster.length >= 3); assert.ok(!flags.strongholdCards || advanced);
  assert.ok(!advanced || !roster.includes('harkonnen') || !skills && !roster.includes('moritani'),
    'Original Advanced E3 capture exclusion is not weakened');
  const actions: MixedE3EcazNexusStep[] = [], seats: Partial<Record<FactionId, string>> = {};
  for (const p of g.players) seats[p.faction] = p.id;
  const owner = seats.ecaz!, wanted = preferences(g, options.skill ?? 'warmaster');
  if (g.status === 'lobby') {
    for (const [type, enabled] of Object.entries(flags)) if (!!g[type as keyof typeof flags] !== enabled)
      g = stepMixedE3EcazNexus(g, { actor: g.host, action: { type, enabled } }, actions);
    g.discoveryEnabled = discovery; g.nexusCards ??= { cards: null, phase: null };
  } else {
    for (const [type, enabled] of Object.entries(flags)) assert.equal(!!g[type as keyof typeof flags], enabled);
    assert.equal(!!g.discoveryEnabled, discovery); assert.equal(!!g.leaderSkills, skills);
    assert.ok(g.nexusCards?.cards, 'An existing deal cannot acquire another Nexus deck');
  }
  const initial = mixedE3EcazNexusReload(g);
  if (g.status === 'lobby') {
    for (const p of g.players) if (!p.ready) g = stepMixedE3EcazNexus(g, { actor: p.id, action: { type: 'ready' } }, actions);
    const skillSource = LEADER_SKILL_CARDS.map(c => c.id), rest = skillSource.filter(c => !wanted.includes(c));
    const skillOrder = wanted.flatMap(c => [c, rest.shift()!]).concat(rest);
    const deck = treacheryDeck(g.expansions), remaining = [...deck], front: string[] = [];
    for (let n = 0; n < g.players.length + (roster.includes('harkonnen') ? 1 : 0); n++) {
      const worthless = remaining.findIndex(c => c.kind === 'worthless');
      const at = worthless >= 0 ? worthless : remaining.findIndex(c => c.kind === 'shield');
      assert.ok(at >= 0); front.push(remaining.splice(at, 1)[0].id);
    }
    const rolls = [...(skills ? permutation(skillSource, skillOrder) : []),
      ...(discovery ? Array<number>(7).fill(0xffffffff) : []),
      ...permutation(NEXUS_FACTIONS, ['ecaz', ...NEXUS_FACTIONS.filter(f => f !== 'ecaz')]),
      ...permutation(deck.map(c => c.id), [...front, ...remaining.map(c => c.id)]), ...spiceRolls(g)];
    const initialize = () => skills ? initializeLeaderSkillsGameForAudit(g) : initializeNexusGameForAudit(g);
    g = options.initial ? initialize() : originalLottery(rolls, initialize);
  }
  const offered = mixedE3EcazNexusReload(g), trainers: Record<string, string> = {};
  for (const a of g.leaderSkills?.assignments ?? []) trainers[a.owner] = a.leader;
  let ixOffer: MixedE3EcazNexusTransition | null = null;
  for (let n = 0; g.status === 'setup' && n < 350; n++) {
    let next: MixedE3EcazNexusStep;
    if (g.decision?.kind === 'ixSetup') {
      const cards = viewGame(g, g.decision.player).ixTechnology!.setup!;
      const card = cards.find(c => c.kind === 'worthless') ?? cards[0]; assert.ok(card);
      next = { actor: g.decision.player, action: { type: 'decision', card: card.id } };
      ixOffer = mixedE3EcazNexusTransition(g, next, actions); g = ixOffer.after; continue;
    }
    if (g.setupStage === 'leaderSkills') {
      const actor = Object.keys(g.leaderSkills!.offers)[0], own = viewGame(g, actor).leaderSkills!;
      const skill = options.initial ? own.offer!.cards.find(c => !own.unavailableSkills?.[c])
        : wanted[g.players.findIndex(p => p.id === actor)];
      const eligible = new Set(own.eligibleLeaders.map(l => l.id));
      const leader = mixedE3EcazNexusPlayer(g, actor).leaders.filter(l => eligible.has(l.id))
        .sort((a, b) => b.strength - a.strength)[0];
      assert.ok(skill && own.offer!.cards.includes(skill) && !own.unavailableSkills?.[skill] && leader);
      assert.notEqual(leader.id, DUKE_VIDAL_ID); trainers[actor] = leader.id;
      next = { actor, action: { type: 'leaderSkill', event: own.offer!.event, skill, leader: leader.id } };
    } else {
      const candidate = nextMixedE3EcazNexusStep(g) ?? quietMixedE3EcazNexusChoice(g); assert.ok(candidate); next = candidate;
      if (next.action.type === 'traitor') {
        const target = trainers[owner] ?? mixedE3EcazNexusPlayer(g, owner).leaders.slice().sort((a, b) => b.strength - a.strength)[0].id;
        next.action.leader = mixedE3EcazNexusPlayer(g, next.actor).traitorChoices.find(id => id !== target) ?? next.action.leader;
      }
      if (next.action.type === 'fremenSetup') next.action.placements = { sietch_tabr: 0, false_wall_south: 10, false_wall_west: 0 };
    }
    // In this original no-Ixian/no-BG/no-Moritani source profile Ecaz placement
    // is the final setup action and deals the first native Face Dancer hand.
    if (!options.initial && options.matchingDancer && seats.tleilaxu && !seats.ixians && !seats.beneGesserit && !seats.moritani && next.action.type === 'ecazSetup') {
      const target = trainers[owner] ?? mixedE3EcazNexusPlayer(g, owner).leaders.slice().sort((a, b) => b.strength - a.strength)[0].id;
      const held = new Set(g.players.flatMap(p => p.traitors));
      const source = traitorDeck(g.players, true).filter(id => !held.has(id) && id !== g.ecazLoyalty?.card);
      assert.ok(source.includes(target), 'Original Loyalty/traitors must leave this native matching disc available');
      g = originalLottery(permutation(source, [target, ...source.filter(id => id !== target)]),
        () => stepMixedE3EcazNexus(g, next, actions));
    } else g = stepMixedE3EcazNexus(g, next, actions);
  }
  assert.equal(g.status, 'playing'); mixedE3EcazNexusInventory(g);
  return { initial, offered, afterSetup: mixedE3EcazNexusReload(g), owner, seats, trainers, ixOffer, actions };
}
export function mixedE3EcazNexusInventory(g: Game): void {
  const nx = g.nexusCards!.cards!; validateNexusCards(nx, g.players);
  assert.deepEqual([...nx.deck, ...nx.discard, ...Object.values(nx.hands).filter(c => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
  if (g.homeworlds) homeworldGameIntegrity(g);
  if (g.discoveries) validateDiscoveryState(g.discoveries);
  if (g.leaderSkills) {
    validateLeaderSkills(g.leaderSkills, g.players);
    assert.ok(g.leaderSkills.assignments.every(a => a.leader !== DUKE_VIDAL_ID));
  }
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand), ...(g.ixSetupCards ?? []),
    ...(g.ixAuction?.cards ?? []), ...(g.richeseCache ?? []), ...(g.richeseRemoved ?? []),
    ...(g.auction?.cards.slice(g.auction.index + (g.currentAuctionSale ? 1 : 0)) ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(), [...treacheryDeck(g.expansions),
    ...(g.players.some(p => p.faction === 'richese') ? richeseCards() : [])].map(c => c.id).sort());
  const homes = g.homeworlds?.custody ? homeworldForceGroups(homeworldContext(g), g.homeworlds.custody) : [];
  for (const p of g.players) {
    const visitors = homes.filter(h => h.native !== p.id).map(h => h.forces[p.id] ?? { normal: 0, elite: 0 });
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, n) => a + n, 0) +
      visitors.reduce((a, f) => a + f.normal + f.elite, 0), 20, p.faction);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, n) => a + n, 0) +
      visitors.reduce((a, f) => a + f.elite, 0), p.faction === 'ixians' ? 7 : p.faction === 'emperor' ? 5 : 3);
    assert.ok(p.leaders.every(l => l.id !== DUKE_VIDAL_ID));
  }
  assert.equal(mixedE3EcazNexusPlayer(g, g.players.find(p => p.faction === 'ecaz')!.id).leaders.length, 5);
  const retired = g.moritaniAssassinate?.opportunities.filter(r => r.stage === 'replaced').map(r => r.card!) ?? [];
  const traitors = [...g.traitorReserve!, ...g.players.flatMap(p => [...p.traitors, ...p.traitorChoices,
    ...(p.faceDancers?.map(c => c.leader) ?? [])]), ...retired, ...(g.ecazLoyalty?.card ? [g.ecazLoyalty.card] : [])];
  assert.deepEqual(traitors.sort(), traitorDeck(g.players, g.expansions.includes('ix')).sort());
}
export function shipMixedE3EcazNexus(g: Game, actor: string, location: string, amount: number,
  actions?: MixedE3EcazNexusStep[], elite = 0): MixedE3EcazNexusTransition {
  assert.ok(g.phase === 5 && g.active === actor && mixedE3EcazNexusClean(g));
  const sources = g.homeworlds ? nativeShipmentSources(viewGame(g, actor), amount, elite) : undefined;
  if (g.homeworlds) assert.ok(sources);
  let action: Action;
  if (location.startsWith('homeworld:')) {
    assert.ok(sources); const quote = homeworldShipmentChoice(viewGame(g, actor), location,
      Object.fromEntries(Object.entries(sources).filter(([, f]) => f.normal + f.elite > 0)));
    assert.ok(quote.action, quote.blocked ?? undefined); action = quote.action;
  } else {
    const [territory, sector] = location.split(':');
    action = { type: 'ship', territory, sector: Number(sector), amount, elite, allyPayment: 0,
      ...(sources ? { homeworldSources: sources } : {}) };
  }
  const t = mixedE3EcazNexusTransition(g, { actor, action }, actions);
  t.after = advanceMixedE3EcazNexus(t.after, s => mixedE3EcazNexusClean(s) && !s.pendingShipment &&
    !s.pendingHomeworldShipment, actions, quietMixedE3EcazNexusChoice); return t;
}
export function createMixedE3EcazNexusProgramme(options: MixedE3EcazNexusOptions = {}): MixedE3EcazNexusProgramme {
  const f = createMixedE3EcazNexusSetup(options), actions = f.actions;
  let g = mixedE3EcazNexusReload(f.afterSetup);
  const result: MixedE3EcazNexusProgramme = { ...f, game: g, claim: null, firstArrival: null, reveal: null,
    entry: null, vote: null, votes: [], ride: null, firstMentat: null, alliance: null, drawing: null, draws: [] };
  if (g.players.length === 2) return result;
  g = advanceMixedE3EcazNexus(g, s => s.phase === 5 && s.active === f.owner && mixedE3EcazNexusClean(s), actions, quietMixedE3EcazNexusChoice);
  const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const destination = g.discoveries ? `${placement.territory}:${placement.sector}` : 'sietch_tabr:14';
  const arrival = shipMixedE3EcazNexus(g, f.owner, destination, g.discoveries ? 2 : 1, actions); g = arrival.after;
  if (g.discoveries) result.firstArrival = arrival; else result.claim = arrival;
  if (g.discoveries) {
    g = advanceMixedE3EcazNexus(g, s => s.phase === 7 && mixedE3EcazNexusClean(s), actions, quietMixedE3EcazNexusChoice);
    const discoveries = g.discoveries;
    assert.ok(discoveries, 'The Discovery module must remain active through the arrival.');
    const token = discoveries.tokens.find(t => t.status === 'placed' && t.territory === placement.territory);
    assert.ok(token, 'Keep the actual random original supply face, never inject a requested Discovery');
    if (viewGame(g, f.owner).discoveries!.canInspect.includes(token.id))
      g = stepMixedE3EcazNexus(g, { actor: f.owner, action: { type: 'discovery', token: token.id, reveal: false } }, actions);
    result.reveal = mixedE3EcazNexusTransition(g, { actor: f.owner,
      action: { type: 'discovery', token: token.id, reveal: true } }, actions); g = result.reveal.after;
  }
  g = advanceMixedE3EcazNexus(g, s => s.phase === 8 && mixedE3EcazNexusClean(s), actions, quietMixedE3EcazNexusChoice);
  for (let n = 0; g.turn === 1 && n < 300; n++) {
    const next = nextMixedE3EcazNexusStep(g) ?? quietMixedE3EcazNexusChoice(g); assert.ok(next);
    const t = mixedE3EcazNexusTransition(g, next, actions); g = t.after;
    if (g.turn === 2) result.firstMentat = t;
  }
  assert.ok(result.firstMentat);
  g = advanceMixedE3EcazNexus(g, s => !!s.nexus && !s.spiceWindow && !s.spiceResolution && mixedE3EcazNexusClean(s), actions, s => {
    const d = s.decision;
    if (d?.kind === 'discoveryEntry' && d.player === f.owner) {
      const view = viewGame(s, f.owner), action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources); assert.ok(action);
      // Record the original typed arrival, without choosing a token face.
      result.entry = { before: mixedE3EcazNexusReload(s), step: { actor: f.owner, action }, after: s };
      return { actor: f.owner, action };
    }
    if (d?.kind === 'greatMakerVote') {
      result.vote ??= mixedE3EcazNexusReload(s);
      return { actor: d.player, action: { type: 'decision', event: d.event, yes: true } };
    }
    if (d?.kind === 'greatMakerRide') {
      const action = greatMakerRideAction(viewGame(s, d.player), 'polar_sink', 0, 2, s.advanced ? 1 : 0); assert.ok(action);
      result.ride = { before: mixedE3EcazNexusReload(s), step: { actor: d.player, action }, after: s };
      return { actor: d.player, action };
    }
    return quietMixedE3EcazNexusChoice(s);
  });
  // Replay only the accepted logged transitions from their own pre-action states
  // to capture exact entry/vote/ride endpoints, not guessed later snapshots.
  if (result.entry) result.entry.after = stepMixedE3EcazNexus(result.entry.before, result.entry.step);
  if (result.ride) result.ride.after = stepMixedE3EcazNexus(result.ride.before, result.ride.step);
  if (result.vote) {
    let state = result.vote;
    while (state.decision?.kind === 'greatMakerVote') {
      const d = state.decision, t = mixedE3EcazNexusTransition(state, { actor: d.player,
        action: { type: 'decision', event: d.event, yes: true } }); result.votes.push(t); state = t.after;
    }
  }
  const others = g.players.filter(p => p.id !== f.owner).map(p => p.id), pair = others.slice(-2);
  for (const [actor, target] of [[pair[0], pair[1]], [pair[1], pair[0]]])
    g = stepMixedE3EcazNexus(g, { actor, action: { type: 'alliance', target } }, actions);
  result.alliance = mixedE3EcazNexusReload(g);
  g = advanceMixedE3EcazNexus(g, s => s.nexusCards?.phase?.stage === 'drawing' && mixedE3EcazNexusClean(s), actions, quietMixedE3EcazNexusChoice);
  result.drawing = mixedE3EcazNexusReload(g);
  assert.ok(g.nexusCards!.phase!.eligible.includes(f.owner));
  // The Ecaz face was selected before original Nexus creation, never reordered here.
  const draw = mixedE3EcazNexusTransition(g, { actor: f.owner, action: { type: 'nexusCardChoice', turn: g.turn,
    card: g.nexusCards!.cards!.hands[f.owner], choice: 'draw', ownRedraws: 0 } }, actions);
  result.draws.push(draw); g = draw.after;
  g = advanceMixedE3EcazNexus(g, s => s.phase === 5 && mixedE3EcazNexusClean(s), actions, quietMixedE3EcazNexusChoice);
  mixedE3EcazNexusInventory(g); result.game = g; return result;
}
/** Original coalition chronology; both native and classic allies are supported.
 * The Basic odd case stops before chooseBattle so its original guard is exercised. */
export function createMixedE3EcazNexusCoalition(options: MixedE3EcazNexusOptions = {},
  allyFaction: FactionId = 'ixians', ecazForces?: number): MixedE3EcazNexusBattle {
  const f = createMixedE3EcazNexusProgramme(options); assert.ok(f.claim, 'Coalition programme uses the paid original Tabr claim');
  const ally = f.seats[allyFaction], opponent = f.seats.guild ?? f.seats.emperor; assert.ok(ally && opponent && ally !== opponent);
  let g = advanceMixedE3EcazNexus(f.game, s => s.turn === 3 && !!s.nexus && !s.spiceWindow &&
    !s.spiceResolution && mixedE3EcazNexusClean(s), f.actions, quietMixedE3EcazNexusChoice);
  if (mixedE3EcazNexusPlayer(g, ally).ally)
    g = stepMixedE3EcazNexus(g, { actor: ally, action: { type: 'alliance', target: null } }, f.actions);
  for (const [actor, target] of [[f.owner, ally], [ally, f.owner]])
    g = stepMixedE3EcazNexus(g, { actor, action: { type: 'alliance', target } }, f.actions);
  const amount = ecazForces ?? (g.advanced ? 5 : 4), location = 'sietch_tabr:14';
  const requested: Record<string, number> = { [f.owner]: amount - 1, [ally]: 4, [opponent]: 8 };
  const needed = new Set(Object.keys(requested)), arrivals: MixedE3EcazNexusTransition[] = [];
  while (needed.size) {
    g = advanceMixedE3EcazNexus(g, s => s.phase === 5 && mixedE3EcazNexusClean(s) && needed.has(s.active!), f.actions, quietMixedE3EcazNexusChoice);
    const actor = g.active!, t = shipMixedE3EcazNexus(g, actor, location, requested[actor], f.actions);
    arrivals.push(t); g = t.after; needed.delete(actor);
    if (needed.size) g = stepMixedE3EcazNexus(g, { actor, action: { type: 'endMovement' } }, f.actions);
  }
  g = advanceMixedE3EcazNexus(g, s => s.phase === 6 && mixedE3EcazNexusClean(s), f.actions, quietMixedE3EcazNexusChoice);
  const beforeBattle = mixedE3EcazNexusReload(g), menu = viewGame(g, g.active!).battleChoices.find(c => c.territory === 'sietch_tabr'); assert.ok(menu);
  const choice: MixedE3EcazNexusStep = { actor: menu.chooser, action: { type: 'chooseBattle', territory: 'sietch_tabr',
    target: menu.attacker === menu.chooser ? menu.defender : menu.attacker } };
  if (g.advanced || amount % 2 === 0) g = stepMixedE3EcazNexus(g, choice, f.actions);
  return { ...f, game: g, ally, opponent, location, ecazForces: amount, arrivals, beforeBattle, choice };
}
export function quoteMixedE3EcazNexusBattle(g: Game): BattleResolutionQuote {
  const b = g.battle!, publicBattle = viewGame(g, g.host).battle!; assert.ok(b?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const p = mixedE3EcazNexusPlayer(g, actor), view = viewGame(g, actor).battle!; assert.ok(view.ownForces);
    return { id: actor, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand, plan: b.plans[actor],
      leader: p.leaders.find(l => l.id === b.plans[actor].leader) ??
        (g.dukeVidal?.controller === actor && b.plans[actor].leader === DUKE_VIDAL_ID ? g.dukeVidal.leader : undefined),
      forces: view.ownForces, stronghold: view.strongholdEffects[actor],
      leaderSkills: g.leaderSkills?.assignments.filter(a => a.owner === actor).map(a => ({ skill: a.skill,
        leader: a.leader, faceUp: !b.leaderSkillHidden?.[actor], captured: false })) };
  };
  const context = homeworldContext(g), home = b.territory.startsWith('homeworld:')
    ? homeworldCombatLocation({ ...context, players: context.players.map(p => ({ ...p,
      ally: mixedE3EcazNexusPlayer(g, p.id).ally })), order: g.order }, g.homeworlds!.custody!, b.territory) : null;
  return quoteBattleResolution({ advanced: g.advanced, typedCasualties: !!g.homeworlds, turn: g.turn,
    territory: b.territory, aggressor: publicBattle.aggressor,
    ...(publicBattle.ecazOccupy?.profile ? { ecazOccupy: publicBattle.ecazOccupy.profile } : {}),
    ...(home ? { homeworld: { native: home.native, card: home.card, side: home.side, nativeForces: home.forces[home.native] } } : {}),
    attacker: side(b.attacker), defender: side(b.defender), participants: g.players,
    voters: publicBattle.traitorVoters.map(actor => ({ id: actor, called: b.traitorCalls[actor] ?? false,
      traitors: mixedE3EcazNexusPlayer(g, actor).traitors,
      beneficiary: [b.attacker, b.defender].includes(actor) ? actor : mixedE3EcazNexusPlayer(g, actor).ally! })),
    physicalCards: [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false, nexusMoritani: !!g.moritaniAssassinate });
}
export function revealMixedE3EcazNexus(g: Game, plans: readonly MixedE3EcazNexusStep[],
  actions?: MixedE3EcazNexusStep[]): Game {
  for (const plan of plans) {
    g = stepMixedE3EcazNexus(g, plan, actions);
    if (!g.battle?.revealed) g = advanceMixedE3EcazNexus(g, s => !!s.battle && mixedE3EcazNexusClean(s) &&
      !s.battle.preparation && s.battle.preLeader?.closed !== false, actions, quietMixedE3EcazNexusChoice);
  }
  assert.ok(g.battle?.revealed); return g;
}
