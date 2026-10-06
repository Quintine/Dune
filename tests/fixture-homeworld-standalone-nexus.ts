import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { leaders, treacheryDeck } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { validateDiscoveryState, DISCOVERY_CARD_PLACEMENTS } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { traitorDeck } from '../game/traitors';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import {
  nativeE3HomeworldPlayer as standaloneHomeworldNexusPlayer,
  nativeE3HomeworldPool as standaloneHomeworldNexusPool,
  nativeE3HomeworldPolicy as standaloneHomeworldNexusPolicy,
  type NativeE3HomeworldOptions,
} from './fixture-homeworld-native-e3-modules';
import {
  completeDiscoveryStandaloneNexusE3SkillsSetup, nextDiscoveryStandaloneNexusE3SkillsStep,
  type DiscoveryStandaloneNexusE3SkillsBoundary,
} from './fixture-discovery-standalone-nexus-e3-skills';
import { ecazNexusSkillsModulesCunningRequest } from './fixture-ecaz-nexus-skills-modules';
import { withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken } from './fixture-discovery-classic-nexus';

export { standaloneHomeworldNexusPlayer, standaloneHomeworldNexusPool, standaloneHomeworldNexusPolicy };
export type StandaloneHomeworldNexusOptions = Omit<NativeE3HomeworldOptions, 'skills' | 'assassination' | 'lethal'>;
export type StandaloneHomeworldNexusStep = { actor: string; action: Action };
export type StandaloneHomeworldNexusTransition = { before: Game; step: StandaloneHomeworldNexusStep; after: Game };
export type StandaloneHomeworldNexusSetup = {
  initial: Game; offered: Game; afterSetup: Game; owner: string; opponent: string; trainer: string;
  actions: StandaloneHomeworldNexusStep[];
};
export type StandaloneHomeworldNexusClosing = StandaloneHomeworldNexusSetup & {
  firstStorm: Game; firstMentat: StandaloneHomeworldNexusTransition; alliance: Game;
  draw: StandaloneHomeworldNexusTransition; game: Game;
};
export type StandaloneHomeworldNexusBattle = {
  arrival: StandaloneHomeworldNexusTransition; settledArrival: Game; beforeBattle: Game;
  game: Game; plans: StandaloneHomeworldNexusStep[]; location: string;
};
export const standaloneHomeworldNexusClean = (g: Game) =>
  !g.response && !g.phaseOpening && !g.decision && !g.pendingTreacheryDiscard && !g.truthtrance;
export const reloadStandaloneHomeworldNexus = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;

/** The programme owns no alternate profile or producer. This is the same private
 * undealt module declaration and host actions used by the original HW fixtures.
 * Supplied seat IDs, already-ready seats and genuinely dealt setup offers survive. */
export function createStandaloneHomeworldNexusLobby(options: StandaloneHomeworldNexusOptions = {}): Game {
  const faction = options.faction ?? options.initial?.players.find(p => ['ecaz', 'moritani'].includes(p.faction))?.faction ?? 'ecaz';
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const roster = options.roster ?? [faction, 'guild', 'emperor'] as FactionId[];
  let g = options.initial ? reloadStandaloneHomeworldNexus(options.initial)
    : createGame('STANDALONEHOMENEXUS', newPlayer(roster[0], roster[0], roster[0]), advanced, ['ecaz']);
  if (!options.initial) for (const f of roster.slice(1)) joinGame(g, newPlayer(f, f, f));
  assert.equal(g.status, 'lobby'); assert.equal(g.advanced, advanced);
  assert.deepEqual(g.expansions, ['ecaz']);
  assert.equal(g.players.filter(p => p.faction === 'ecaz' || p.faction === 'moritani').length, 1);
  assert.equal(new Set(g.players.map(p => p.faction)).size, g.players.length);
  assert.ok(g.players.every(p => p.faction === faction || ['guild', 'emperor', 'atreides', 'fremen', 'beneGesserit',
    ...(!advanced ? ['harkonnen'] : [])].includes(p.faction)));
  const tech = options.tech ?? !!g.techTokens, strongholds = options.strongholds ?? !!g.strongholdCards;
  assert.ok(g.players.length >= (tech ? 3 : 2) && g.players.length <= 6);
  assert.ok(!strongholds || advanced); assert.ok(!g.leaderSkills && !g.ecazTreachery);
  if (!g.homeworlds) g = applyAction(g, g.host, { type: 'homeworlds', enabled: true });
  if (!!g.techTokens !== tech) g = applyAction(g, g.host, { type: 'techTokens', enabled: tech });
  if (!!g.strongholdCards !== strongholds) g = applyAction(g, g.host, { type: 'strongholdCards', enabled: strongholds });
  g.discoveryEnabled = options.discovery ?? !!g.discoveryEnabled;
  g.nexusCards ??= { cards: null, phase: null };
  assert.ok(g.homeworlds?.custody === null && g.nexusCards.cards === null && g.nexusCards.phase === null);
  return g;
}

/** Select only an original, not-yet-dealt shuffle. UUID entropy is untouched. */
function permutation(source: readonly string[], desired: readonly string[]): number[] {
  const working = [...source], rolls: number[] = [];
  assert.deepEqual([...source].sort(), [...desired].sort());
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[j]] = [working[j], working[i]];
  }
  return rolls;
}
function lottery<T>(rolls: readonly number[], operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1 && cursor < rolls.length) array[0] = rolls[cursor++];
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function stepStandaloneHomeworldNexus(g: Game, step: StandaloneHomeworldNexusStep,
  actions?: StandaloneHomeworldNexusStep[]): Game {
  actions?.push(structuredClone(step));
  // Actual JSON save continuation is the changed-path programme, not an input-copy assertion.
  return withClassicDiscoveryNexusLottery(() => applyAction(reloadStandaloneHomeworldNexus(g), step.actor, step.action));
}
export function nextStandaloneHomeworldNexusStep(g: Game): StandaloneHomeworldNexusStep | null {
  if (!g.response && !g.phaseOpening && !g.pendingTreacheryDiscard) {
    const d = g.decision;
    if (d?.kind === 'guildShipment') return { actor: d.player, action: { type: 'decision', allow: true } };
    if (d?.kind === 'homeworldShipmentGuild') return { actor: d.player, action: { type: 'decision', event: d.event, allow: true } };
    if (d?.kind === 'homeworldDefense') return { actor: d.player, action: { type: 'decision', event: d.event, use: false } };
    if (d?.kind === 'homeworldRevivalDeployment') return { actor: d.player, action: { type: 'decision', event: d.event, decline: true } };
    if (d && ['sukRescue', 'moritaniAssassinate', 'techToken', 'ecazBattleLead'].includes(d.kind)) return null;
  }
  const next = nextDiscoveryStandaloneNexusE3SkillsStep(g);
  if (next?.action.type === 'stormDial') next.action.amount = g.turn === 1 ? 0 : 1;
  return next;
}
export function advanceStandaloneHomeworldNexus(g: Game, until: (g: Game) => boolean,
  actions?: StandaloneHomeworldNexusStep[]): Game {
  for (let n = 0; n < 3000; n++) {
    if (until(g)) return g;
    assert.notEqual(g.status, 'finished');
    const next = nextStandaloneHomeworldNexusStep(g);
    assert.ok(next, 'Original owner must supply the sealed plan, physical rescue, assassination, coalition lead or winner Tech choice.');
    g = stepStandaloneHomeworldNexus(g, next, actions);
  }
  throw Error('Original standalone HW/Nexus chronology did not reach its owned boundary.');
}
export function assertStandaloneHomeworldNexusCustody(g: Game): void {
  homeworldGameIntegrity(g); validateLeaderSkills(g.leaderSkills!, g.players);
  validateNexusCards(g.nexusCards!.cards!, g.players);
  if (g.discoveries) validateDiscoveryState(g.discoveries);
  const skills = g.leaderSkills!, nx = g.nexusCards!.cards!;
  assert.deepEqual([...skills.deck, ...Object.values(skills.offers).flatMap(o => o.cards), ...skills.assignments.map(a => a.skill)].sort(),
    LEADER_SKILL_CARDS.map(c => c.id).sort());
  assert.deepEqual([...nx.deck, ...nx.discard, ...Object.values(nx.hands).filter((c): c is FactionId => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
  const auction = g.auction?.cards.slice(g.auction.index + (g.currentAuctionSale ? 1 : 0)) ?? [];
  assert.deepEqual([...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand), ...auction].map(c => c.id).sort(),
    treacheryDeck(['ecaz']).map(c => c.id).sort());
  if (g.traitorReserve) {
    const retired = g.moritaniAssassinate?.opportunities.filter(o => o.stage === 'replaced').map(o => o.card!) ?? [];
    assert.deepEqual([...g.traitorReserve, ...g.players.flatMap(p => [...p.traitors, ...p.traitorChoices]), ...retired,
      ...(g.ecazLoyalty?.card ? [g.ecazLoyalty.card] : [])].sort(), traitorDeck(g.players).sort());
  }
  // Physical native reserves and the separate Duke are produced only AFTER
  // original Traitor selection; unassigned setup has no home custody to count.
  if (!g.homeworlds?.custody) return;
  if (g.ecazAmbassadors) validateAmbassadors(g.ecazAmbassadors);
  const homes = homeworldForceGroups(homeworldContext(g), g.homeworlds!.custody!);
  for (const p of g.players) {
    const visitors = homes.filter(h => h.native !== p.id).map(h => h.forces[p.id] ?? { normal: 0, elite: 0 });
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0) +
      visitors.reduce((n, f) => n + f.normal + f.elite, 0), 20, p.faction);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, b) => a + b, 0) +
      visitors.reduce((n, f) => n + f.elite, 0), p.faction === 'fremen' ? 3 : 5);
    assert.deepEqual(p.leaders.map(l => l.id).sort(), leaders(p.faction).map(l => l.id).sort());
  }
  assert.equal(g.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  assert.ok(!skills.assignments.some(a => a.leader === DUKE_VIDAL_ID));
}
export function createStandaloneHomeworldNexusSetup(options: StandaloneHomeworldNexusOptions = {}): StandaloneHomeworldNexusSetup {
  const actions: StandaloneHomeworldNexusStep[] = [];
  const suppliedSetup = options.initial?.status === 'setup';
  let g = suppliedSetup ? reloadStandaloneHomeworldNexus(options.initial!) : createStandaloneHomeworldNexusLobby(options);
  const initial = reloadStandaloneHomeworldNexus(g);
  const owner = g.players.find(p => p.faction === 'ecaz' || p.faction === 'moritani')!.id;
  const opponent = g.players.find(p => p.faction === 'guild')?.id ?? g.players.find(p => p.id !== owner)!.id;
  if (!suppliedSetup) {
    for (const p of g.players) if (!p.ready) g = stepStandaloneHomeworldNexus(g, { actor: p.id, action: { type: 'ready' } }, actions);
    if (options.initial) g = initializeLeaderSkillsGameForAudit(g);
    else {
      const requested = options.skill ?? 'warmaster';
      const opposing: LeaderSkillId = requested === 'suk-graduate' ? 'swordmaster-of-ginaz' : 'suk-graduate';
      const passive: LeaderSkillId[] = ['master-of-assassins', 'killer-medic', 'prana-bindu-adept', 'swordmaster-of-ginaz', 'planetologist']
        .filter(s => s !== requested && s !== opposing) as LeaderSkillId[];
      const selected: LeaderSkillId[] = g.players.map(p => p.id === owner ? requested
        : p.id === opponent ? opposing : passive.shift()!);
      const source = LEADER_SKILL_CARDS.map(c => c.id), rest = source.filter(c => !selected.includes(c));
      assert.equal(new Set(selected).size, selected.length, 'A generated programme needs distinct requested physical skills.');
      const desired = selected.flatMap(c => [c, rest.shift()!]).concat(rest);
      const cards = treacheryDeck(['ecaz']), remaining = [...cards];
      const front = g.players.flatMap(p => {
        const kinds = [p.id === opponent && g.players.some(s => s.faction === 'moritani') ? 'projectile' : 'worthless',
          ...(p.faction === 'harkonnen' ? ['shield'] : [])];
        return kinds.map(kind => {
          const selectedKind = kind === 'worthless' && !remaining.some(c => c.kind === 'worthless') ? 'shield' : kind;
          const index = remaining.findIndex(c => c.kind === selectedKind); assert.ok(index >= 0);
          return remaining.splice(index, 1)[0].id;
        });
      });
      const native = standaloneHomeworldNexusPlayer(g, owner).faction;
      const rolls = [...permutation(source, desired), ...(g.discoveryEnabled ? Array<number>(7).fill(0xffffffff) : []),
        ...permutation(NEXUS_FACTIONS, [native, ...NEXUS_FACTIONS.filter(c => c !== native)]),
        ...permutation(cards.map(c => c.id), [...front, ...remaining.map(c => c.id)])];
      g = lottery(rolls, () => initializeLeaderSkillsGameForAudit(g));
    }
  }
  assert.ok(g.status === 'setup' && g.turn === 1 && g.phase === 0 && ['prediction', 'leaderSkills'].includes(g.setupStage!) &&
    g.leaderSkills?.assignments.length === 0 && g.homeworlds && g.nexusCards?.cards,
  'Continue only ORIGINAL unassigned skill-first setup; never convert a played save.');
  const offered = reloadStandaloneHomeworldNexus(g);
  g = completeDiscoveryStandaloneNexusE3SkillsSetup(g, { initial: options.initial,
    skill: options.skill ?? (!options.initial ? 'warmaster' : undefined) }, actions);
  assertStandaloneHomeworldNexusCustody(g);
  const trainer = g.leaderSkills!.assignments.find(a => a.owner === owner)!.leader;
  return { initial, offered, afterSetup: g, owner, opponent, trainer, actions };
}

/** Only ORIGINAL unplayed Spice Cards are reordered, never cards in either played pile. */
export function orderStandaloneHomeworldNexusSpice(g: Game, worm = false): void {
  const kinds = [...(worm ? ['worm'] : []), ...Array<string>(g.advanced ? 2 : 1).fill('land')];
  for (const [position, kind] of kinds.entries()) {
    const index = g.spiceDeck.findIndex((c, i) => i >= position && (kind === 'worm'
      ? 'worm' in c && !c.greatMaker : 'territory' in c && !c.discovery));
    assert.ok(index >= position); g.spiceDeck.splice(position, 0, g.spiceDeck.splice(index, 1)[0]);
  }
}
export function createStandaloneHomeworldNexusClosing(options: StandaloneHomeworldNexusOptions = {}): StandaloneHomeworldNexusClosing {
  const f = createStandaloneHomeworldNexusSetup(options);
  assert.ok(f.afterSetup.players.length >= 3, 'A qualifying native closing draw needs two other real alliance seats.');
  let g = reloadStandaloneHomeworldNexus(f.afterSetup);
  orderStandaloneHomeworldNexusSpice(g);
  g = advanceStandaloneHomeworldNexus(g, s => s.phase === 1 && standaloneHomeworldNexusClean(s), f.actions);
  const firstStorm = reloadStandaloneHomeworldNexus(g);
  g = advanceStandaloneHomeworldNexus(g, s => s.phase === 8 && standaloneHomeworldNexusClean(s), f.actions);
  let firstMentat: StandaloneHomeworldNexusTransition | undefined;
  while (g.turn === 1) {
    const before = reloadStandaloneHomeworldNexus(g), step = nextStandaloneHomeworldNexusStep(g); assert.ok(step);
    g = stepStandaloneHomeworldNexus(g, step, f.actions);
    if (g.turn === 2) firstMentat = { before, step, after: reloadStandaloneHomeworldNexus(g) };
  }
  assert.ok(firstMentat);
  g = advanceStandaloneHomeworldNexus(g, s => s.phase === 1 && standaloneHomeworldNexusClean(s), f.actions);
  orderStandaloneHomeworldNexusSpice(g, true);
  g = advanceStandaloneHomeworldNexus(g, s => s.nexus && !s.spiceWindow && !s.spiceResolution && standaloneHomeworldNexusClean(s), f.actions);
  const others = g.players.filter(p => p.id !== f.owner);
  for (const [actor, target] of [[others[0].id, others[1].id], [others[1].id, others[0].id]])
    g = stepStandaloneHomeworldNexus(g, { actor, action: { type: 'alliance', target } }, f.actions);
  const alliance = reloadStandaloneHomeworldNexus(g);
  g = advanceStandaloneHomeworldNexus(g, s => s.nexusCards?.phase?.stage === 'drawing' && standaloneHomeworldNexusClean(s), f.actions);
  assert.ok(g.nexusCards!.phase!.eligible.includes(f.owner));
  const before = reloadStandaloneHomeworldNexus(g), step: StandaloneHomeworldNexusStep = { actor: f.owner,
    action: { type: 'nexusCardChoice', turn: g.turn, card: g.nexusCards!.cards!.hands[f.owner], choice: 'draw', ownRedraws: 0 } };
  g = stepStandaloneHomeworldNexus(g, step, f.actions);
  return { ...f, firstStorm, firstMentat, alliance, draw: { before, step, after: reloadStandaloneHomeworldNexus(g) }, game: g };
}
/** The ORIGINAL undealt Treachery supply selects these two auction faces; only
 * real one-spice winning bids and native payment put them into Moritani's hand. */
export function buyStandaloneHomeworldMoritaniArmament(f: StandaloneHomeworldNexusClosing, state: Game) {
  let g = advanceStandaloneHomeworldNexus(state, s => s.phase === 2 && standaloneHomeworldNexusClean(s), f.actions);
  const before = reloadStandaloneHomeworldNexus(g), cards: string[] = [], front: Game['deck'] = [];
  for (const kind of ['projectile', 'shield']) {
    const held = standaloneHomeworldNexusPlayer(g, f.owner).hand.find(c => c.kind === kind);
    if (held) { cards.push(held.id); continue; }
    const index = g.deck.findIndex(c => c.kind === kind); assert.ok(index >= 0);
    const card = g.deck.splice(index, 1)[0]; cards.push(card.id); front.push(card);
  }
  g.deck.unshift(...front);
  for (let n = 0; n < 320; n++) {
    if (cards.every(id => standaloneHomeworldNexusPlayer(g, f.owner).hand.some(c => c.id === id)))
      return { before, game: g, weapon: cards[0], defense: cards[1], bought: front.map(c => c.id) };
    const owned = nextStandaloneHomeworldNexusStep(g); assert.ok(owned);
    if (g.phase === 3 && standaloneHomeworldNexusClean(g) && g.auction && !g.auction.bid &&
      g.auction.active === f.owner && cards.includes(g.auction.cards[g.auction.index]?.id))
      owned.action = { type: 'bid', amount: 1 };
    g = stepStandaloneHomeworldNexus(g, owned, f.actions);
  }
  throw Error('The original paid auction did not deliver Moritani armament.');
}

export function invadeStandaloneHomeworldNexus(g: Game, actor: string, destination: string, amount: number,
  actions?: StandaloneHomeworldNexusStep[]): StandaloneHomeworldNexusTransition & { settled: Game } {
  g = advanceStandaloneHomeworldNexus(g, s => s.phase === 5 && s.active === actor && standaloneHomeworldNexusClean(s), actions);
  const before = reloadStandaloneHomeworldNexus(g), view = viewGame(g, actor);
  const sources = nativeShipmentSources(view, amount, 0); assert.ok(sources);
  const selected = Object.fromEntries(Object.entries(sources).filter(([, f]) => f.normal + f.elite > 0));
  const choice = homeworldShipmentChoice(view, destination, selected); assert.ok(choice.action, choice.blocked ?? 'Original invasion unavailable.');
  const step = { actor, action: choice.action };
  g = stepStandaloneHomeworldNexus(g, step, actions);
  const after = reloadStandaloneHomeworldNexus(g);
  g = advanceStandaloneHomeworldNexus(g, s => !s.pendingHomeworldShipment && !s.pendingShipment && standaloneHomeworldNexusClean(s), actions);
  return { before, step, after, settled: g };
}
export function openStandaloneHomeworldNexusBattle(g: Game, location: string, first: string, second: string,
  actions?: StandaloneHomeworldNexusStep[]): Game {
  g = advanceStandaloneHomeworldNexus(g, s => s.phase === 6 && standaloneHomeworldNexusClean(s) && !!s.active, actions);
  assert.ok(g.active === first || g.active === second);
  g = stepStandaloneHomeworldNexus(g, { actor: g.active!, action: { type: 'chooseBattle', territory: location,
    target: g.active === first ? second : first } }, actions);
  return advanceStandaloneHomeworldNexus(g, s => !!s.battle && standaloneHomeworldNexusClean(s) &&
    !s.battle.preparation && s.battle.preLeader?.closed !== false, actions);
}
export function revealStandaloneHomeworldNexusPlans(g: Game, plans: StandaloneHomeworldNexusStep[],
  actions?: StandaloneHomeworldNexusStep[]): Game {
  for (const step of plans) {
    g = stepStandaloneHomeworldNexus(g, step, actions);
    if (!g.battle?.revealed) g = advanceStandaloneHomeworldNexus(g, s => !!s.battle && standaloneHomeworldNexusClean(s) &&
      !s.battle.preparation && s.battle.preLeader?.closed !== false, actions);
  }
  assert.ok(g.battle?.revealed); return g;
}
export function settleStandaloneHomeworldNexus(g: Game, actions?: StandaloneHomeworldNexusStep[]): DiscoveryStandaloneNexusE3SkillsBoundary {
  const choices: Partial<Record<NonNullable<Game['decision']>['kind'], DiscoveryStandaloneNexusE3SkillsBoundary['kind']>> = {
    battleLosses: 'losses', sukRescue: 'rescue', moritaniAssassinate: 'assassination', battleCards: 'cards', techToken: 'tech',
  };
  g = advanceStandaloneHomeworldNexus(g, s => !s.response && !s.phaseOpening &&
    (!!(s.decision && choices[s.decision.kind]) || !s.battle && standaloneHomeworldNexusClean(s)), actions);
  return { game: g, kind: g.decision && choices[g.decision.kind] || 'settled' };
}
export function createStandaloneHomeworldEcazCunning(options: StandaloneHomeworldNexusOptions = {}) {
  const f = createStandaloneHomeworldNexusClosing({ ...options, faction: 'ecaz', advanced: true,
    roster: ['ecaz', 'guild', 'beneGesserit'], tech: options.tech ?? true, strongholds: options.strongholds ?? true });
  const opponent = f.afterSetup.players.find(p => p.faction === 'beneGesserit')!.id;
  const arrival = invadeStandaloneHomeworldNexus(f.game, f.owner, 'homeworld:beneGesserit', 1, f.actions);
  let g = advanceStandaloneHomeworldNexus(arrival.settled, s => s.phase === 6 && standaloneHomeworldNexusClean(s) && !s.battle, f.actions);
  const before = reloadStandaloneHomeworldNexus(g), step = ecazNexusSkillsModulesCunningRequest(g, f.owner);
  g = stepStandaloneHomeworldNexus(g, step, f.actions);
  const cunning = { before, step, after: reloadStandaloneHomeworldNexus(g) };
  g = openStandaloneHomeworldNexusBattle(g, 'homeworld:beneGesserit', f.owner, opponent, f.actions);
  const trained = new Set(g.leaderSkills!.assignments.map(a => a.leader));
  const own = standaloneHomeworldNexusPlayer(g, f.owner).leaders.filter(l => !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0];
  const enemy = standaloneHomeworldNexusPlayer(g, opponent).leaders.filter(l => !trained.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(own && enemy);
  const plans: StandaloneHomeworldNexusStep[] = [
    { actor: f.owner, action: { type: 'battlePlan', leader: own.id, dial: 0, support: 0 } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 3, support: 3 } },
  ];
  return { ...f, opponent, arrival, cunning, game: g, plans, location: 'homeworld:beneGesserit' };
}

/** First original loss: the unused living Guild trainer remains eligible for
 * native private assassination only AFTER its real same-home normal Suk rescue. */
export function openStandaloneHomeworldMoritaniDeath(f: StandaloneHomeworldNexusClosing, state: Game, leader: string,
  first = false): StandaloneHomeworldNexusBattle {
  const arrival = invadeStandaloneHomeworldNexus(state, f.owner, 'homeworld:guild', 1, f.actions);
  const beforeBattle = advanceStandaloneHomeworldNexus(arrival.settled,
    s => s.phase === 6 && standaloneHomeworldNexusClean(s), f.actions);
  const g = openStandaloneHomeworldNexusBattle(beforeBattle, 'homeworld:guild', f.owner, f.opponent, f.actions);
  const trained = new Set(g.leaderSkills!.assignments.map(a => a.leader));
  const winner = standaloneHomeworldNexusPlayer(g, f.opponent).leaders.filter(l => !l.dead && !trained.has(l.id))
    .sort((a, b) => b.strength - a.strength)[0];
  const weapon = standaloneHomeworldNexusPlayer(g, f.opponent).hand.find(c => c.kind === 'projectile');
  assert.ok(winner && weapon, 'The genuine Guild starting deal must provide its living winner and retained projectile.');
  const worthless = first ? standaloneHomeworldNexusPlayer(g, f.owner).hand.find(c => c.kind === 'worthless')?.id : undefined;
  return { arrival, settledArrival: arrival.settled, beforeBattle, game: g, location: 'homeworld:guild', plans: [
    { actor: f.owner, action: { type: 'battlePlan', leader, dial: 0, support: 0, weapon: worthless } },
    { actor: f.opponent, action: { type: 'battlePlan', leader: winner.id, dial: first ? 1 : 0,
      support: g.advanced && first ? 1 : 0, weapon: weapon.id } },
  ] };
}

/** Four later Guild discs die by actual paid invasions, against an actually
 * auctioned native projectile and Shield. The assassinated fifth disc is never
 * restaged; the Guild must establish all-five deaths to revive its OWN trainer. */
export function openStandaloneHomeworldGuildDeath(f: StandaloneHomeworldNexusClosing, state: Game, leader: string,
  weapon: string, defense: string): StandaloneHomeworldNexusBattle {
  const arrival = invadeStandaloneHomeworldNexus(state, f.opponent, 'homeworld:moritani', 1, f.actions);
  const beforeBattle = advanceStandaloneHomeworldNexus(arrival.settled,
    s => s.phase === 6 && standaloneHomeworldNexusClean(s), f.actions);
  const g = openStandaloneHomeworldNexusBattle(beforeBattle, 'homeworld:moritani', f.owner, f.opponent, f.actions);
  const own = standaloneHomeworldNexusPlayer(g, f.owner);
  assert.ok(own.hand.some(c => c.id === weapon) && own.hand.some(c => c.id === defense));
  const winner = own.leaders.filter(l => !l.dead &&
    !g.leaderSkills!.assignments.some(a => a.owner === f.owner && a.leader === l.id))
    .sort((a, b) => b.strength - a.strength)[0]; assert.ok(winner);
  const enemyWeapon = standaloneHomeworldNexusPlayer(g, f.opponent).hand.find(c => c.kind === 'projectile');
  return { arrival, settledArrival: arrival.settled, beforeBattle, game: g, location: 'homeworld:moritani', plans: [
    { actor: f.owner, action: { type: 'battlePlan', leader: winner.id, dial: 1, support: g.advanced ? 1 : 0, weapon, defense } },
    { actor: f.opponent, action: { type: 'battlePlan', leader, dial: 0, support: 0, weapon: enemyWeapon?.id } },
  ] };
}

/** Optional nested entry uses the original supply lottery, paid parent shipment,
 * real inspection/reveal and next-turn free move; native reserves never move at entry. */
export function createStandaloneHomeworldNexusDiscovery(options: StandaloneHomeworldNexusOptions = {}) {
  const f = createStandaloneHomeworldNexusSetup({ ...options, discovery: true });
  let g = reloadStandaloneHomeworldNexus(f.afterSetup);
  const index = g.spiceDeck.findIndex(c => 'territory' in c && c.discovery === 'discovery-hagga-basin'); assert.ok(index >= 0);
  g.spiceDeck.unshift(g.spiceDeck.splice(index, 1)[0]);
  const position = g.spiceDeck.findIndex((c, i) => i > 0 && 'territory' in c && !c.discovery && c.territory !== 'hagga_basin');
  assert.ok(position > 0); g.spiceDeck.splice(1, 0, g.spiceDeck.splice(position, 1)[0]);
  g = advanceStandaloneHomeworldNexus(g, s => s.phase === 1 && standaloneHomeworldNexusClean(s), f.actions);
  for (let n = 0; !g.discoveries!.tokens.some(t => t.face === 'cistern' && t.status === 'placed') && n < 160; n++) {
    const step = nextStandaloneHomeworldNexusStep(g); assert.ok(step); f.actions.push(structuredClone(step));
    g = withClassicDiscoveryNexusToken(g, 'cistern', () => applyAction(reloadStandaloneHomeworldNexus(g), step.actor, step.action));
  }
  g = advanceStandaloneHomeworldNexus(g, s => s.phase === 5 && s.active === f.owner && standaloneHomeworldNexusClean(s), f.actions);
  const beforeShipment = reloadStandaloneHomeworldNexus(g), destination = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const sources = nativeShipmentSources(viewGame(g, f.owner), 2, 0); assert.ok(sources);
  const shipment: StandaloneHomeworldNexusStep = { actor: f.owner, action: { type: 'ship', territory: destination.territory,
    sector: destination.sector, amount: 2, elite: 0, allyPayment: 0, homeworldSources: sources } };
  g = stepStandaloneHomeworldNexus(g, shipment, f.actions);
  g = advanceStandaloneHomeworldNexus(g, s => !s.pendingShipment && standaloneHomeworldNexusClean(s), f.actions);
  const afterShipment = reloadStandaloneHomeworldNexus(g);
  g = advanceStandaloneHomeworldNexus(g, s => s.phase === 7 && standaloneHomeworldNexusClean(s), f.actions);
  const token = g.discoveries!.tokens.find(t => t.face === 'cistern' && t.status === 'placed')!.id;
  if (viewGame(g, f.owner).discoveries!.canInspect.includes(token))
    g = stepStandaloneHomeworldNexus(g, { actor: f.owner, action: { type: 'discovery', token, reveal: false } }, f.actions);
  g = stepStandaloneHomeworldNexus(g, { actor: f.owner, action: { type: 'discovery', token, reveal: true } }, f.actions);
  const revealed = reloadStandaloneHomeworldNexus(g);
  g = advanceStandaloneHomeworldNexus(g, s => s.turn === 2 && !s.response && !s.phaseOpening &&
    s.decision?.kind === 'discoveryEntry' && s.decision.player === f.owner, f.actions);
  const before = reloadStandaloneHomeworldNexus(g), view = viewGame(g, f.owner);
  const action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources); assert.ok(action);
  const step = { actor: f.owner, action }; g = stepStandaloneHomeworldNexus(g, step, f.actions);
  return { ...f, beforeShipment, shipment, afterShipment, revealed, token, entry: { before, step, after: g }, game: g };
}
