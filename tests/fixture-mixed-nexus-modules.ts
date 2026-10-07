import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, initializeNexusGameForAudit,
  joinGame, newPlayer, viewGame,
} from '../game/engine';
import type { Action, Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { treacheryDeck } from '../game/cards';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { richeseCards } from '../game/richese-cards';
import { territory } from '../game/board';
import { traitorDeck } from '../game/traitors';
import { DISCOVERY_CARD_PLACEMENTS, validateDiscoveryState } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { nextSingleNexusE1Step, shipSingleNexusE1, quoteSingleNexusE1Battle,
  openSingleNexusE1Battle, revealSingleNexusE1Plans } from './fixture-single-nexus-e1';
import { nativeHomeworldInventory, nativeHomeworldPlayer, nativeHomeworldLeader,
  frontNativeHomeworldSpice } from './fixture-homeworld-native-e1e2-modules';
import { withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken } from './fixture-discovery-classic-nexus';

export interface MixedNexusStep { actor: string; action: Action }
export interface MixedNexusTransition { before: Game; step: MixedNexusStep; after: Game }
export interface MixedNexusOptions {
  initial?: Game;
  advanced?: boolean;
  skills?: boolean;
  homeworlds?: boolean;
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  roster?: readonly FactionId[];
  /** Selects only an original undealt offer, never changes a supplied offer. */
  skillOwner?: FactionId;
  skill?: LeaderSkillId;
  fuelKind?: 'special' | 'shield';
}
export interface MixedNexusSetup {
  initial: Game; setup: Game; offered: Game | null; ixOffer: MixedNexusTransition | null;
  afterSetup: Game; trainers: Record<string, string>; dancerLeader: string | null;
  seats: Partial<Record<FactionId, string>>; actions: MixedNexusStep[];
}
export interface MixedNexusProgramme extends MixedNexusSetup {
  game: Game;
  firstArrival: MixedNexusTransition | null;
  firstMarker: MixedNexusTransition | null;
  reveal: MixedNexusTransition | null;
  entry: MixedNexusTransition | null;
  vote: Game | null;
  ride: MixedNexusTransition | null;
  firstMentat: MixedNexusTransition | null;
  alliance: Game | null;
  drawing: Game | null;
  draws: MixedNexusTransition[];
}
export const mixedNexusReload = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;
export const mixedNexusPlayer = nativeHomeworldPlayer;
export const mixedNexusLeader = nativeHomeworldLeader;
export const mixedNexusQuote = quoteSingleNexusE1Battle;
export const mixedNexusShip = shipSingleNexusE1;
export const mixedNexusOpenBattle = openSingleNexusE1Battle;
export const mixedNexusRevealPlans = revealSingleNexusE1Plans;
export const mixedNexusClean = (g: Game): boolean =>
  !g.response && !g.phaseOpening && !g.decision && !g.pendingTreacheryDiscard && !g.truthtrance;

/** Response queues have priority. Physical choices belong to the human, not to
 * this scheduler. In particular a quoted casualty menu is not a default dial. */
export function nextMixedNexusStep(g: Game): MixedNexusStep | null {
  if (!g.response && !g.phaseOpening && g.decision) {
    const d = g.decision;
    if (['battleLosses', 'sukRescue', 'ixSubstitution', 'battleCards', 'faceDance', 'strongholdCopy'].includes(d.kind) ||
      d.kind === 'techToken' && !!g.battle) return null;
    if (d.kind === 'richeseUnbid') return { actor: d.player,
      action: { type: 'decision', event: g.richeseBidding!.event, keep: false } };
  }
  return nextSingleNexusE1Step(g);
}
export function stepMixedNexus(g: Game, step: MixedNexusStep, actions?: MixedNexusStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(mixedNexusReload(g), step.actor, step.action));
}
export function advanceMixedNexus(g: Game, until: (g: Game) => boolean, actions?: MixedNexusStep[]): Game {
  for (let n = 0; n < 3000; n++) {
    if (until(g)) return g;
    assert.notEqual(g.status, 'finished');
    const next = nextMixedNexusStep(g);
    assert.ok(next, `Choose the original ${g.decision?.kind ?? 'sealed plan'} at ${g.turn}/${g.phase}.`);
    g = stepMixedNexus(g, next, actions);
  }
  throw Error('Original mixed E1/E2 chronology did not reach its owned boundary.');
}
export function settleMixedNexus(g: Game, actions?: MixedNexusStep[]): Game {
  return advanceMixedNexus(g, q => mixedNexusClean(q) && !q.pendingShipment &&
    !q.pendingHomeworldShipment && !q.pendingChoamWorthless, actions);
}
function transition(g: Game, step: MixedNexusStep, actions: MixedNexusStep[]): MixedNexusTransition {
  return { before: mixedNexusReload(g), step: structuredClone(step), after: stepMixedNexus(g, step, actions) };
}
function permutation(source: readonly string[], desired: readonly string[]): number[] {
  assert.deepEqual([...source].sort(), [...desired].sort());
  const current = [...source], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  return rolls;
}
function lottery<T>(rolls: readonly number[], operation: () => T): T {
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
export function mixedNexusInventory(g: Game): void {
  if (g.homeworlds) nativeHomeworldInventory(g);
  else for (const p of g.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((n, f) => n + f, 0), 20, p.faction);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((n, f) => n + f, 0), p.faction === 'ixians' ? 7 : p.faction === 'emperor' ? 5 : 3);
  }
  if (g.leaderSkills) validateLeaderSkills(g.leaderSkills, g.players);
  if (g.discoveries) validateDiscoveryState(g.discoveries);
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand), ...(g.ixSetupCards ?? []),
    ...(g.ixAuction?.cards ?? []), ...(g.richeseCache ?? []), ...(g.richeseRemoved ?? []),
    ...(g.auction?.cards.slice(g.auction.index + (g.currentAuctionSale ? 1 : 0)) ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(), [...treacheryDeck(['ix', 'choam']),
    ...(g.players.some(p => p.faction === 'richese') ? richeseCards() : [])].map(c => c.id).sort());
  validateNexusCards(g.nexusCards!.cards!, g.players);
}

/** Original rules sources: Nexus closing, E1/E2 native powers, Homeworlds and
 * Discovery composition; no companion is implied by another seated family.
 * Assigned original training is valid input: pending offers alone continue. */
export function createMixedNexusSetup(options: MixedNexusOptions = {}): MixedNexusSetup {
  const roster: readonly FactionId[] = options.roster ?? ['ixians', 'tleilaxu', 'choam', 'richese', 'guild', 'fremen'];
  let g = options.initial ? mixedNexusReload(options.initial)
    : createGame('MIXEDNEXUS', newPlayer(roster[0], roster[0], roster[0]), options.advanced ?? true, ['ix', 'choam']);
  if (!options.initial) for (const faction of roster.slice(1)) joinGame(g, newPlayer(faction, faction, faction));
  assert.deepEqual([...g.expansions].sort(), ['choam', 'ix']);
  assert.equal(g.advanced, options.advanced ?? g.advanced);
  assert.ok(g.players.length >= 2 && g.players.length <= 6);
  assert.equal(new Set(g.players.map(p => p.faction)).size, g.players.length);
  assert.ok(g.players.some(p => ['ixians', 'tleilaxu'].includes(p.faction)) &&
    g.players.some(p => ['choam', 'richese'].includes(p.faction)));
  assert.ok(g.status === 'lobby' || g.status === 'setup' && g.turn === 1 && g.phase === 0,
    'Continue only an original lobby or its original setup, never a played save.');
  const skills = options.skills ?? (options.initial?.status === 'setup' ? !!g.leaderSkills : true);
  const discovery = options.discovery ?? !!g.discoveryEnabled;
  const modules = { homeworlds: options.homeworlds ?? !!g.homeworlds,
    techTokens: options.tech ?? !!g.techTokens, strongholdCards: options.strongholds ?? !!g.strongholdCards };
  assert.ok(!modules.strongholdCards || g.advanced);
  const actions: MixedNexusStep[] = [], seats: Partial<Record<FactionId, string>> = {};
  for (const p of g.players) seats[p.faction] = p.id;
  const skillOwner = seats[options.skillOwner ?? 'ixians'] ?? g.players[0].id;
  const passives: LeaderSkillId[] = ['warmaster', 'sandmaster', 'killer-medic', 'prana-bindu-adept', 'swordmaster-of-ginaz']
    .filter(s => s !== (options.skill ?? 'suk-graduate')) as LeaderSkillId[];
  const selected = g.players.map(p => p.id === skillOwner ? options.skill ?? 'suk-graduate' : passives.shift()!);
  if (g.status === 'lobby') {
    for (const [type, enabled] of Object.entries(modules)) if (!!g[type as keyof typeof modules] !== enabled)
      g = stepMixedNexus(g, { actor: g.host, action: { type, enabled } }, actions);
    g.discoveryEnabled = discovery; g.nexusCards ??= { cards: null, phase: null };
  } else {
    for (const [type, enabled] of Object.entries(modules)) assert.equal(!!g[type as keyof typeof modules], enabled);
    assert.equal(!!g.discoveryEnabled, discovery); assert.equal(!!g.leaderSkills, skills);
    assert.ok(g.nexusCards?.cards, 'A supplied original deal cannot acquire a new deck.');
  }
  const initial = mixedNexusReload(g);
  if (g.status === 'lobby') {
    for (const p of g.players) if (!p.ready) g = stepMixedNexus(g, { actor: p.id, action: { type: 'ready' } }, actions);
    const source = LEADER_SKILL_CARDS.map(c => c.id), rest = source.filter(s => !selected.includes(s));
    const skillOrder = selected.flatMap(s => [s, rest.shift()!]).concat(rest);
    const deck = treacheryDeck(g.expansions), remaining = [...deck], prefix = [];
    const dealOrder = seats.ixians ? [mixedNexusPlayer(g, seats.ixians), ...g.players.filter(p => p.id !== seats.ixians)] : g.players;
    for (const p of dealOrder) {
      const kind = p.faction === 'choam' ? options.fuelKind ?? 'special' : 'worthless';
      const at = remaining.findIndex(c => c.kind === kind && (kind !== 'special' || c.effect !== 'karama'));
      assert.ok(at >= 0); prefix.push(remaining.splice(at, 1)[0]);
    }
    const rolls = [...(skills ? permutation(source, skillOrder) : []),
      ...(discovery ? Array<number>(7).fill(0xffffffff) : []),
      ...Array<number>(NEXUS_FACTIONS.length - 1).fill(0xffffffff),
      ...permutation(deck.map(c => c.id), [...prefix, ...remaining].map(c => c.id))];
    const initialize = () => skills ? initializeLeaderSkillsGameForAudit(g) : initializeNexusGameForAudit(g);
    g = options.initial ? initialize() : lottery(rolls, initialize);
  }
  const setup = mixedNexusReload(g); let offered: Game | null = null, ixOffer: MixedNexusTransition | null = null;
  const trainers: Record<string, string> = {};
  for (const a of g.leaderSkills?.assignments ?? []) trainers[a.owner] = a.leader;
  const target = seats.ixians ? trainers[seats.ixians] ?? mixedNexusPlayer(g, seats.ixians).leaders.slice()
    .sort((a, b) => b.strength - a.strength)[0].id : null;
  let dancerLeader = target;
  for (let n = 0; g.status === 'setup' && n < 250; n++) {
    let next: MixedNexusStep;
    if (g.decision?.kind === 'ixSetup') {
      const offer = viewGame(g, g.decision.player).ixTechnology!.setup!;
      const card = offer.find(c => c.kind === 'worthless') ?? offer[0]; assert.ok(card);
      ixOffer = transition(g, { actor: g.decision.player, action: { type: 'decision', card: card.id } }, actions);
      g = ixOffer.after; continue;
    }
    if (g.setupStage === 'leaderSkills' && !g.decision) {
      offered ??= mixedNexusReload(g);
      const actor = Object.keys(g.leaderSkills!.offers)[0], view = viewGame(g, actor).leaderSkills!, offer = view.offer!;
      const wanted = selected[g.players.findIndex(p => p.id === actor)];
      const skill = options.initial ? offer.cards.find(s => !view.unavailableSkills?.[s])
        : offer.cards.find(s => s === wanted && !view.unavailableSkills?.[s]); assert.ok(skill);
      const eligible = new Set(view.eligibleLeaders.map(l => l.id));
      const leader = mixedNexusPlayer(g, actor).leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader); trainers[actor] = leader.id;
      if (actor === seats.ixians) dancerLeader = leader.id;
      next = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    } else {
      const candidate = nextMixedNexusStep(g); assert.ok(candidate); next = candidate;
      if (next.action.type === 'traitor') {
        const choices = mixedNexusPlayer(g, next.actor).traitorChoices;
        next.action.leader = choices.find(id => id !== dancerLeader) ?? choices[0];
      }
      if (next.action.type === 'fremenSetup') next.action.placements = { sietch_tabr: 0, false_wall_south: 10, false_wall_west: 0 };
    }
    if (!options.initial && seats.tleilaxu && dancerLeader && g.setupStage === 'forces' && next.action.type === 'fremenSetup') {
      const held = new Set(g.players.flatMap(p => p.traitors)), source = traitorDeck(g.players, true).filter(id => !held.has(id));
      assert.ok(source.includes(dancerLeader)); actions.push(structuredClone(next));
      g = lottery(permutation(source, [dancerLeader, ...source.filter(id => id !== dancerLeader)]),
        () => applyAction(mixedNexusReload(g), next.actor, next.action));
    } else g = stepMixedNexus(g, next, actions);
  }
  assert.equal(g.status, 'playing'); mixedNexusInventory(g);
  return { initial, setup, offered, ixOffer, afterSetup: mixedNexusReload(g), trainers, dancerLeader, seats, actions };
}

/** Only original unplayed source-order permutations and unused lotteries are
 * selected. Every army, invoice, token, alliance and reward is action-produced.
 * Two seats have no legal closing qualification; their endpoint is native setup. */
export function createMixedNexusProgramme(options: MixedNexusOptions = {}): MixedNexusProgramme {
  const s = createMixedNexusSetup(options), actions = s.actions;
  let g = mixedNexusReload(s.afterSetup);
  const result: MixedNexusProgramme = { ...s, game: g, firstArrival: null, firstMarker: null, reveal: null,
    entry: null, vote: null, ride: null, firstMentat: null, alliance: null, drawing: null, draws: [] };
  if (g.players.length === 2) return result;
  const guild = s.seats.guild, fremen = s.seats.fremen;
  const discovery = !!g.discoveries;
  const collector = s.seats.ixians ?? guild ?? g.players[0].id;
  assert.ok(!discovery || guild && fremen, 'Maker programme uses original Guild and Fremen seats.');
  frontNativeHomeworldSpice(g, c => 'territory' in c && (discovery ? c.discovery === 'discovery-hagga-basin' : !c.discovery && c.territory === 'hagga_basin'), 0);
  if (g.advanced) frontNativeHomeworldSpice(g, c => 'territory' in c && !c.discovery && c.territory === 'broken_land', 1);
  const offset = g.advanced ? 2 : 1;
  frontNativeHomeworldSpice(g, c => 'worm' in c && (discovery ? !!c.greatMaker : !c.greatMaker && !c.suppressed), offset);
  frontNativeHomeworldSpice(g, c => 'territory' in c && !c.discovery && c.territory === 'rock_outcroppings', offset + 1);
  if (g.advanced) frontNativeHomeworldSpice(g, c => 'territory' in c && !c.discovery && c.territory === 'oh_gap', offset + 2);
  g = advanceMixedNexus(g, q => q.phase === 1 && mixedNexusClean(q), actions);
  if (discovery) {
    for (let n = 0; !g.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed') && n < 100; n++) {
      const next = nextMixedNexusStep(g); assert.ok(next); actions.push(structuredClone(next));
      g = withClassicDiscoveryNexusToken(g, 'shrine', () => applyAction(mixedNexusReload(g), next.actor, next.action));
    }
    assert.ok(g.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed'));
  }
  const needed = new Set([...(discovery ? [collector] : []), ...(s.seats.richese ? [s.seats.richese] : [])]);
  while (needed.size) {
    g = advanceMixedNexus(g, q => q.phase === 5 && mixedNexusClean(q) && needed.has(q.active!), actions);
    const actor = g.active!;
    if (actor === s.seats.richese) {
      const p = mixedNexusPlayer(g, actor), token = p.noField!.tokens.find(t => t.value === 0)!;
      result.firstMarker = transition(g, { actor, action: { type: 'ship', territory: 'habbanya_ridge_sietch',
        sector: territory('habbanya_ridge_sietch').sectors[0], noField: token.id, event: p.noFieldEvent, allyPayment: 0 } }, actions);
      g = settleMixedNexus(result.firstMarker.after, actions); result.firstMarker.after = mixedNexusReload(g);
      g = stepMixedNexus(g, { actor, action: { type: 'revealNoField', token: token.id, event: mixedNexusPlayer(g, actor).noFieldEvent } }, actions);
    } else {
      const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
      const elite = mixedNexusPlayer(g, actor).faction === 'ixians' ? 1 : 0;
      const sources = g.homeworlds ? nativeShipmentSources(viewGame(g, actor), 3, elite) : undefined;
      if (g.homeworlds) assert.ok(sources);
      result.firstArrival = transition(g, { actor, action: { type: 'ship', territory: placement.territory,
        sector: placement.sector, amount: 3, elite, allyPayment: 0,
        ...(sources ? { homeworldSources: sources } : {}) } }, actions);
      g = settleMixedNexus(result.firstArrival.after, actions); result.firstArrival.after = mixedNexusReload(g);
    }
    needed.delete(actor);
    if (needed.size) g = stepMixedNexus(g, { actor, action: { type: 'endMovement' } }, actions);
  }
  if (discovery) {
    g = advanceMixedNexus(g, q => q.phase === 7 && mixedNexusClean(q), actions);
    const token = g.discoveries!.tokens.find(t => t.face === 'shrine' && t.status === 'placed')!;
    g = stepMixedNexus(g, { actor: collector, action: { type: 'discovery', token: token.id, reveal: false } }, actions);
    result.reveal = transition(g, { actor: collector, action: { type: 'discovery', token: token.id, reveal: true } }, actions); g = result.reveal.after;
  }
  g = advanceMixedNexus(g, q => q.phase === 8 && mixedNexusClean(q), actions);
  while (g.turn === 1) {
    const next = nextMixedNexusStep(g); assert.ok(next); const t = transition(g, next, actions); g = t.after;
    if (g.turn === 2) result.firstMentat = t;
  }
  if (discovery) {
    g = advanceMixedNexus(g, q => q.decision?.kind === 'discoveryEntry' && q.decision.player === collector, actions);
    const view = viewGame(g, collector), sources = view.discoveryEntry!.sources;
    const action = discoveryEntryMoveAction(view, mixedNexusPlayer(g, collector).faction === 'ixians'
      ? sources.map(source => ({ ...source, normal: Math.min(source.normal, 1), elite: Math.min(source.elite, 1) })) : sources); assert.ok(action);
    result.entry = transition(g, { actor: collector, action }, actions); g = result.entry.after;
    g = advanceMixedNexus(g, q => q.decision?.kind === 'greatMakerVote', actions); result.vote = mixedNexusReload(g);
    while (g.decision?.kind === 'greatMakerVote') g = stepMixedNexus(g,
      { actor: g.decision.player, action: { type: 'decision', event: g.decision.event, yes: true } }, actions);
    assert.ok(g.decision?.kind === 'greatMakerRide' && g.decision.player === fremen);
    const actionRide = greatMakerRideAction(viewGame(g, fremen!), 'polar_sink', 0, 2, g.advanced ? 1 : 0); assert.ok(actionRide);
    result.ride = transition(g, { actor: fremen!, action: actionRide }, actions); g = result.ride.after;
  }
  g = advanceMixedNexus(g, q => !!q.nexus && !q.spiceWindow && !q.spiceResolution && mixedNexusClean(q), actions);
  const pair = guild && fremen ? [guild, fremen] : g.players.slice(-2).map(p => p.id);
  for (const [actor, target] of [[pair[0], pair[1]], [pair[1], pair[0]]])
    g = stepMixedNexus(g, { actor, action: { type: 'alliance', target } }, actions);
  result.alliance = mixedNexusReload(g);
  g = advanceMixedNexus(g, q => q.nexusCards?.phase?.stage === 'drawing' && mixedNexusClean(q), actions);
  result.drawing = mixedNexusReload(g);
  for (const actor of g.nexusCards!.phase!.eligible) {
    const face = mixedNexusPlayer(g, actor).faction, cards = g.nexusCards!.cards!;
    const at = cards.deck.indexOf(face); assert.ok(at >= 0); cards.deck.unshift(cards.deck.splice(at, 1)[0]);
    const draw = transition(g, { actor, action: { type: 'nexusCardChoice', turn: g.turn,
      card: cards.hands[actor] ?? null, choice: 'draw', ownRedraws: 0 } }, actions);
    result.draws.push(draw); g = draw.after;
  }
  g = advanceMixedNexus(g, q => q.phase === 5 && mixedNexusClean(q), actions);
  mixedNexusInventory(g); result.game = g; return result;
}
