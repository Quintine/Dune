import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, initializeNexusGameForAudit,
  joinGame, newPlayer, viewGame,
} from '../game/engine';
import type { Action, Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { territory } from '../game/board';
import { treacheryDeck } from '../game/cards';
import type { Card } from '../game/cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { traitorDeck } from '../game/traitors';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { combatArmy, homeworldBattleLocation } from '../game/combat-location';
import { quoteBattleResolution } from '../game/battle-resolution-quote';
import type { BattleResolutionQuote, ResolutionCombatant } from '../game/battle-resolution-quote';
import { DISCOVERY_CARD_PLACEMENTS, validateDiscoveryState } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import {
  nativeHomeworldInventory, nativeHomeworldLeader, nativeHomeworldPlayer, frontNativeHomeworldSpice,
} from './fixture-homeworld-native-e1e2-modules';
import { nextHomeworldSkillsDiscoveryStep } from './fixture-homeworld-skills-discovery';
import { withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken } from './fixture-discovery-classic-nexus';

export type SingleNexusE1Native = 'ixians' | 'tleilaxu';
export type SingleNexusE1Step = { actor: string; action: Action };
export type SingleNexusE1Transition = { before: Game; step: SingleNexusE1Step; after: Game };
export type SingleNexusE1Options = {
  /** Only an original lobby or its unassigned turn-one setup; saved deals are authoritative. */
  initial?: Game;
  native?: SingleNexusE1Native;
  roster?: readonly FactionId[];
  advanced?: boolean;
  skills?: boolean;
  homeworlds?: boolean;
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  startingKinds?: readonly Card['kind'][];
  collectorSkill?: LeaderSkillId;
};
export type SingleNexusE1Setup = {
  initial: Game; setup: Game; offered: Game | null; ixOffer: SingleNexusE1Transition | null;
  afterSetup: Game; owner: string; guild: string; fremen: string; collector: string;
  trainer: string | null; dancerLeader: string; actions: SingleNexusE1Step[];
};
export type SingleNexusE1Programme = SingleNexusE1Setup & {
  game: Game; firstArrival: SingleNexusE1Transition | null;
  reveal: SingleNexusE1Transition | null; entry: SingleNexusE1Transition | null;
  vote: Game | null; ride: SingleNexusE1Transition | null;
  firstMentat: SingleNexusE1Transition; alliance: Game; drawing: Game; draw: SingleNexusE1Transition;
};
export const singleNexusE1Reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
export const singleNexusE1Player = nativeHomeworldPlayer;
export const singleNexusE1Army = combatArmy;
export const singleNexusE1Leader = nativeHomeworldLeader;
export const singleNexusE1Clean = (g: Game): boolean =>
  !g.response && !g.phaseOpening && !g.decision && !g.pendingTreacheryDiscard && !g.truthtrance;

export function singleNexusE1Inventory(g: Game): void {
  if (g.homeworlds) nativeHomeworldInventory(g);
  else {
    for (const p of g.players) {
      assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((n, f) => n + f, 0), 20);
      if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
        Object.values(p.elites.forces).reduce((n, f) => n + f, 0), p.faction === 'ixians' ? 7 : p.faction === 'emperor' ? 5 : 3);
    }
    assert.deepEqual([...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand),
      ...(g.ixSetupCards ?? []), ...(g.auction?.cards.slice(g.auction.index) ?? [])].map(c => c.id).sort(),
    treacheryDeck(g.expansions).map(c => c.id).sort());
    if (g.leaderSkills) validateLeaderSkills(g.leaderSkills, g.players);
    if (g.discoveries) validateDiscoveryState(g.discoveries);
  }
  validateNexusCards(g.nexusCards!.cards!, g.players);
}
function permutation(source: readonly string[], desired: readonly string[]): number[] {
  assert.deepEqual([...source].sort(), [...desired].sort());
  const current = [...source], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); return rolls;
}
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
export function stepSingleNexusE1(g: Game, step: SingleNexusE1Step, actions?: SingleNexusE1Step[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(singleNexusE1Reload(g), step.actor, step.action));
}
function transition(g: Game, step: SingleNexusE1Step, actions: SingleNexusE1Step[]): SingleNexusE1Transition {
  return { before: singleNexusE1Reload(g), step: structuredClone(step), after: stepSingleNexusE1(g, step, actions) };
}
/** Stop at every meaningful owned aftermath; never invent a plan, rescue or replacement. */
export function nextSingleNexusE1Step(g: Game): SingleNexusE1Step | null {
  if (singleNexusE1Clean(g) && g.nexusCards?.phase?.stage === 'drawing') {
    const actor = g.nexusCards.phase.eligible.find(id => !g.nexusCards!.phase!.done.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: g.turn,
      card: g.nexusCards.cards!.hands[actor] ?? null, choice: 'keep', ownRedraws: 0 } };
  }
  if (!g.response && !g.phaseOpening && g.decision) {
    const d = g.decision;
    if (['sukRescue', 'ixSubstitution', 'battleCards', 'faceDance', 'strongholdCopy'].includes(d.kind) ||
      d.kind === 'techToken' && !!g.battle) return null;
    if (d.kind === 'leaderSkillVisibility') return { actor: d.player,
      action: { type: 'leaderSkillVisibility', event: d.event, hide: true } };
    if (d.kind === 'guildShipment' || d.kind === 'homeworldShipmentGuild') return { actor: d.player,
      action: { type: 'decision', allow: true, ...(d.kind === 'homeworldShipmentGuild' ? { event: d.event } : {}) } };
    if (d.kind === 'battleLosses') {
      const elite = Math.max(...d.options.map(o => o.elite));
      return { actor: d.player, action: { type: 'decision', choice: d.options.findIndex(o => o.elite === elite) } };
    }
    if (d.kind === 'techToken') return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
  }
  return nextHomeworldSkillsDiscoveryStep(g);
}
export function advanceSingleNexusE1(g: Game, until: (g: Game) => boolean, actions?: SingleNexusE1Step[]): Game {
  for (let n = 0; n < 3000; n++) {
    if (until(g)) return g;
    assert.notEqual(g.status, 'finished');
    const next = nextSingleNexusE1Step(g);
    assert.ok(next, `Choose the original ${g.decision?.kind ?? 'sealed plan'} at ${g.turn}/${g.phase}.`);
    g = stepSingleNexusE1(g, next, actions);
  }
  throw Error('Original single E1 chronology did not reach its owned boundary.');
}
export function settleSingleNexusE1(g: Game, actions?: SingleNexusE1Step[]): Game {
  return advanceSingleNexusE1(g, s => singleNexusE1Clean(s) && !s.pendingShipment && !s.pendingHomeworldShipment, actions);
}
export function createSingleNexusE1Setup(options: SingleNexusE1Options = {}): SingleNexusE1Setup {
  const native = options.native ?? (options.initial?.players.some(p => p.faction === 'tleilaxu') ? 'tleilaxu' : 'ixians');
  const roster: readonly FactionId[] = options.roster ?? [native, 'guild', 'fremen'];
  let g = options.initial ? singleNexusE1Reload(options.initial)
    : createGame('SINGLENEXUSE1', newPlayer(roster[0], roster[0], roster[0]), options.advanced ?? true, ['ix']);
  if (!options.initial) for (const faction of roster.slice(1)) joinGame(g, newPlayer(faction, faction, faction));
  assert.deepEqual(g.expansions, ['ix']); assert.equal(g.advanced, options.advanced ?? g.advanced);
  assert.equal(g.players.filter(p => p.faction === native).length, 1);
  assert.ok(g.players.every(p => p.faction === native || ['guild', 'fremen', 'emperor', 'atreides', 'harkonnen', 'beneGesserit'].includes(p.faction)));
  assert.ok(g.status === 'lobby' || g.status === 'setup' && g.turn === 1 && g.phase === 0 &&
    (!g.leaderSkills || g.leaderSkills.assignments.length === 0) && g.players.every(p => !p.traitors.length &&
      !p.faceDancers?.length && p.leaders.every(l => !l.dead && !l.usedAt)), 'Never convert a played save.');
  const skills = options.skills ?? !!g.leaderSkills, actions: SingleNexusE1Step[] = [];
  const flags = { homeworlds: options.homeworlds ?? !!g.homeworlds,
    techTokens: options.tech ?? !!g.techTokens, strongholdCards: options.strongholds ?? !!g.strongholdCards };
  const discovery = options.discovery ?? !!g.discoveryEnabled;
  const owner = g.players.find(p => p.faction === native)!.id;
  const guild = g.players.find(p => p.faction === 'guild')?.id ?? '';
  const fremen = g.players.find(p => p.faction === 'fremen')?.id ?? '';
  const collector = native === 'ixians' ? owner : guild;
  const target = nativeHomeworldPlayer(g, guild || owner).leaders.slice().sort((a, b) => b.strength - a.strength)[0].id;
  const selected: LeaderSkillId[] = [];
  for (const p of g.players) {
    const desired: LeaderSkillId = p.id === collector ? options.collectorSkill ?? 'suk-graduate' : 'prana-bindu-adept';
    selected.push(!selected.includes(desired) ? desired :
      (['swordmaster-of-ginaz', 'warmaster', 'killer-medic', 'sandmaster', 'planetologist'] as const).find(s => !selected.includes(s))!);
  }
  if (g.status === 'lobby') {
    for (const [type, enabled] of Object.entries(flags)) if (!!g[type as keyof typeof flags] !== enabled)
      g = stepSingleNexusE1(g, { actor: g.host, action: { type, enabled } }, actions);
    g.discoveryEnabled = discovery; g.nexusCards ??= { cards: null, phase: null };
  } else {
    for (const [type, enabled] of Object.entries(flags)) assert.equal(!!g[type as keyof typeof flags], enabled);
    assert.equal(!!g.discoveryEnabled, discovery); assert.equal(!!g.leaderSkills, skills);
    assert.ok(g.nexusCards?.cards, 'A saved original deal cannot acquire a new Nexus deck.');
  }
  const initial = singleNexusE1Reload(g);
  if (g.status === 'lobby') {
    for (const p of g.players) if (!p.ready) g = stepSingleNexusE1(g, { actor: p.id, action: { type: 'ready' } }, actions);
    const skillSource = LEADER_SKILL_CARDS.map(c => c.id), rest = skillSource.filter(s => !selected.includes(s));
    const skillOrder = selected.flatMap(s => [s, rest.shift()!]).concat(rest);
    const cards = treacheryDeck(g.expansions), remaining = [...cards], prefix: Card[] = [];
    for (const [i, p] of g.players.entries()) for (let j = 0; j < (p.faction === 'harkonnen' ? 2 : 1); j++) {
      const kind = options.startingKinds?.[i] ?? (i < 5 ? 'worthless' : 'shield');
      const at = remaining.findIndex(c => c.kind === kind); assert.ok(at >= 0); prefix.push(remaining.splice(at, 1)[0]);
    }
    const rolls = [...(skills ? permutation(skillSource, skillOrder) : []),
      ...(discovery ? Array<number>(7).fill(0xffffffff) : []), ...Array<number>(NEXUS_FACTIONS.length - 1).fill(0xffffffff),
      ...permutation(cards.map(c => c.id), [...prefix, ...remaining].map(c => c.id))];
    // A supplied lobby's original lottery is not overwritten.
    g = options.initial ? (skills ? initializeLeaderSkillsGameForAudit(g) : initializeNexusGameForAudit(g))
      : originalLottery(rolls, () => skills ? initializeLeaderSkillsGameForAudit(g) : initializeNexusGameForAudit(g));
  }
  const setup = singleNexusE1Reload(g);
  let offered: Game | null = null, ixOffer: SingleNexusE1Transition | null = null, trainer: string | null = null;
  for (let n = 0; g.status === 'setup' && n < 250; n++) {
    let next: SingleNexusE1Step;
    if (g.decision?.kind === 'ixSetup') {
      const actor = g.decision.player, offer = viewGame(g, actor).ixTechnology!.setup!;
      const card = offer.find(c => c.kind === 'worthless') ?? offer[0]; assert.ok(card);
      ixOffer = transition(g, { actor, action: { type: 'decision', card: card.id } }, actions); g = ixOffer.after; continue;
    }
    if (g.setupStage === 'leaderSkills') {
      offered ??= singleNexusE1Reload(g);
      const actor = Object.keys(g.leaderSkills!.offers)[0], view = viewGame(g, actor).leaderSkills!, offer = view.offer!;
      const wanted = selected[g.players.findIndex(p => p.id === actor)];
      const skill = options.initial ? offer.cards.find(s => !view.unavailableSkills?.[s])
        : offer.cards.find(s => s === wanted && !view.unavailableSkills?.[s]); assert.ok(skill);
      const eligible = new Set(view.eligibleLeaders.map(l => l.id));
      const leader = nativeHomeworldPlayer(g, actor).leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0]; assert.ok(leader);
      if (actor === collector) trainer = leader.id;
      next = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    } else {
      const candidate = nextSingleNexusE1Step(g); assert.ok(candidate); next = candidate;
      if (next.action.type === 'traitor') {
        const choices = nativeHomeworldPlayer(g, next.actor).traitorChoices;
        next.action.leader = choices.find(id => id !== (trainer ?? target)) ?? choices[0];
      }
    }
    if (next.action.type === 'fremenSetup') next.action.placements = { sietch_tabr: 0, false_wall_south: 10, false_wall_west: 0 };
    if (!options.initial && native === 'tleilaxu' && g.setupStage === 'forces' && next.action.type === 'fremenSetup') {
      const held = new Set(g.players.flatMap(p => p.traitors));
      const source = traitorDeck(g.players, true).filter(id => !held.has(id)), dancerLeader = trainer ?? target;
      assert.ok(source.includes(dancerLeader)); actions.push(structuredClone(next));
      g = originalLottery(permutation(source, [dancerLeader, ...source.filter(id => id !== dancerLeader)]),
        () => applyAction(singleNexusE1Reload(g), next.actor, next.action));
    } else g = stepSingleNexusE1(g, next, actions);
  }
  assert.equal(g.status, 'playing'); singleNexusE1Inventory(g);
  return { initial, setup, offered, ixOffer, afterSetup: g, owner, guild, fremen, collector,
    trainer, dancerLeader: trainer ?? target, actions };
}
export function shipSingleNexusE1(g: Game, actor: string, destination: string, amount: number, elite = 0,
  actions: SingleNexusE1Step[] = []): SingleNexusE1Transition {
  assert.equal(g.phase, 5); assert.equal(g.active, actor); assert.ok(singleNexusE1Clean(g));
  const sources = g.homeworlds ? nativeShipmentSources(viewGame(g, actor), amount, elite) : undefined;
  if (g.homeworlds) assert.ok(sources);
  let action: Action;
  if (destination.startsWith('homeworld:')) {
    assert.ok(sources);
    const choice = homeworldShipmentChoice(viewGame(g, actor), destination,
      Object.fromEntries(Object.entries(sources).filter(([, f]) => f.normal + f.elite > 0)));
    assert.ok(choice.action, choice.blocked ?? undefined); action = choice.action;
  } else action = { type: 'ship', territory: destination, sector: destination === 'shrine' ? 0 : territory(destination).sectors[0],
    amount, elite, allyPayment: 0, ...(sources ? { homeworldSources: sources } : {}) };
  const result = transition(g, { actor, action }, actions); result.after = settleSingleNexusE1(result.after, actions); return result;
}
/** Original turn-one reveal and free entry, real both-pile blow/Maker, alliance closing and qualified draw. */
export function createSingleNexusE1Programme(options: SingleNexusE1Options = {}): SingleNexusE1Programme {
  const s = createSingleNexusE1Setup(options), actions = s.actions; assert.ok(s.guild && s.fremen);
  let g = singleNexusE1Reload(s.afterSetup);
  const discovery = !!g.discoveries;
  frontNativeHomeworldSpice(g, c => 'territory' in c && (discovery ? c.discovery === 'discovery-hagga-basin' : !c.discovery && c.territory === 'hagga_basin'), 0);
  if (g.advanced) frontNativeHomeworldSpice(g, c => 'territory' in c && !c.discovery && c.territory === 'broken_land', 1);
  const second = g.advanced ? 2 : 1;
  frontNativeHomeworldSpice(g, c => 'worm' in c && (discovery ? !!c.greatMaker : !c.greatMaker && !c.suppressed), second);
  frontNativeHomeworldSpice(g, c => 'territory' in c && !c.discovery && c.territory === 'rock_outcroppings', second + 1);
  if (g.advanced) frontNativeHomeworldSpice(g, c => 'territory' in c && !c.discovery && c.territory === 'oh_gap', second + 2);
  let firstArrival: SingleNexusE1Transition | null = null, reveal: SingleNexusE1Transition | null = null;
  if (discovery) {
    g = advanceSingleNexusE1(g, q => q.phase === 1 && singleNexusE1Clean(q), actions);
    for (let n = 0; !g.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed') && n < 100; n++) {
      const next = nextSingleNexusE1Step(g); assert.ok(next); actions.push(structuredClone(next));
      g = withClassicDiscoveryNexusToken(g, 'shrine', () => applyAction(singleNexusE1Reload(g), next.actor, next.action));
    }
    assert.ok(g.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed'));
    g = advanceSingleNexusE1(g, q => q.phase === 5 && q.active === s.collector && singleNexusE1Clean(q), actions);
    const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
    const sources = g.homeworlds ? nativeShipmentSources(viewGame(g, s.collector), 3, s.collector === s.owner && options.native !== 'tleilaxu' ? 1 : 0) : undefined;
    if (g.homeworlds) assert.ok(sources);
    firstArrival = transition(g, { actor: s.collector, action: { type: 'ship', territory: placement.territory, sector: placement.sector,
      amount: 3, elite: nativeHomeworldPlayer(g, s.collector).faction === 'ixians' ? 1 : 0, allyPayment: 0,
      ...(sources ? { homeworldSources: sources } : {}) } }, actions);
    g = settleSingleNexusE1(firstArrival.after, actions); firstArrival.after = singleNexusE1Reload(g);
    g = advanceSingleNexusE1(g, q => q.phase === 7 && singleNexusE1Clean(q), actions);
    const token = g.discoveries!.tokens.find(t => t.face === 'shrine' && t.status === 'placed')!;
    g = stepSingleNexusE1(g, { actor: s.collector, action: { type: 'discovery', token: token.id, reveal: false } }, actions);
    reveal = transition(g, { actor: s.collector, action: { type: 'discovery', token: token.id, reveal: true } }, actions); g = reveal.after;
  }
  g = advanceSingleNexusE1(g, q => q.phase === 8 && singleNexusE1Clean(q), actions);
  let firstMentat: SingleNexusE1Transition | null = null;
  for (let n = 0; g.turn === 1 && n < 200; n++) {
    const next = nextSingleNexusE1Step(g); assert.ok(next);
    const result = transition(g, next, actions); g = result.after; if (g.turn === 2) firstMentat = result;
  }
  assert.ok(firstMentat);
  let entry: SingleNexusE1Transition | null = null, vote: Game | null = null, ride: SingleNexusE1Transition | null = null;
  if (discovery) {
    g = advanceSingleNexusE1(g, q => q.decision?.kind === 'discoveryEntry' && q.decision.player === s.collector, actions);
    const view = viewGame(g, s.collector), sources = view.discoveryEntry!.sources;
    const action = discoveryEntryMoveAction(view, nativeHomeworldPlayer(g, s.collector).faction === 'ixians'
      ? sources.map(source => ({ ...source, normal: Math.min(source.normal, 1), elite: Math.min(source.elite, 1) })) : sources); assert.ok(action);
    entry = transition(g, { actor: s.collector, action }, actions); g = entry.after;
    g = advanceSingleNexusE1(g, q => q.decision?.kind === 'greatMakerVote', actions); vote = singleNexusE1Reload(g);
    while (g.decision?.kind === 'greatMakerVote') g = stepSingleNexusE1(g,
      { actor: g.decision.player, action: { type: 'decision', event: g.decision.event, yes: true } }, actions);
    assert.ok(g.decision?.kind === 'greatMakerRide' && g.decision.player === s.fremen);
    const actionRide = greatMakerRideAction(viewGame(g, s.fremen), 'polar_sink', 0, 2, g.advanced ? 1 : 0); assert.ok(actionRide);
    ride = transition(g, { actor: s.fremen, action: actionRide }, actions); g = ride.after;
  }
  g = advanceSingleNexusE1(g, q => !!q.nexus && !q.spiceWindow && !q.spiceResolution && singleNexusE1Clean(q), actions);
  for (const [actor, target] of [[s.guild, s.fremen], [s.fremen, s.guild]])
    g = stepSingleNexusE1(g, { actor, action: { type: 'alliance', target } }, actions);
  const alliance = singleNexusE1Reload(g);
  g = advanceSingleNexusE1(g, q => q.nexusCards?.phase?.stage === 'drawing' && singleNexusE1Clean(q), actions);
  const drawing = singleNexusE1Reload(g), cards = g.nexusCards!.cards!, face = nativeHomeworldPlayer(g, s.owner).faction;
  const at = cards.deck.indexOf(face); assert.ok(at >= 0); cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  const draw = transition(g, { actor: s.owner, action: { type: 'nexusCardChoice', turn: g.turn,
    card: cards.hands[s.owner] ?? null, choice: 'draw', ownRedraws: 0 } }, actions); g = draw.after;
  g = advanceSingleNexusE1(g, q => q.phase === 5 && singleNexusE1Clean(q), actions); singleNexusE1Inventory(g);
  return { ...s, game: g, firstArrival, reveal, entry, vote, ride, firstMentat, alliance, drawing, draw };
}
export function openSingleNexusE1Battle(g: Game, first: string, second: string, location: string,
  actions?: SingleNexusE1Step[]): Game {
  g = advanceSingleNexusE1(g, q => q.phase === 6 && singleNexusE1Clean(q) && !!q.active, actions);
  const choice = viewGame(g, g.active!).battleChoices.find(b => b.territory === location &&
    [first, second].includes(b.attacker) && [first, second].includes(b.defender)); assert.ok(choice);
  g = stepSingleNexusE1(g, { actor: choice.chooser, action: { type: 'chooseBattle', territory: location,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } }, actions);
  return advanceSingleNexusE1(g, q => !!q.battle && singleNexusE1Clean(q) && !q.battle.preparation && q.battle.preLeader?.closed !== false, actions);
}
export function revealSingleNexusE1Plans(g: Game, plans: readonly SingleNexusE1Step[], actions?: SingleNexusE1Step[]): Game {
  for (const plan of plans) {
    g = stepSingleNexusE1(g, plan, actions);
    while (g.response || g.phaseOpening || g.decision?.kind === 'fullPlanOffer') {
      const next = nextSingleNexusE1Step(g); assert.ok(next); g = stepSingleNexusE1(g, next, actions);
    }
  }
  assert.ok(g.battle?.revealed); return g;
}
export function finishSingleNexusE1Battle(g: Game, actions?: SingleNexusE1Step[]): Game {
  for (let n = 0; n < 600; n++) {
    if (!g.battle && singleNexusE1Clean(g)) return g;
    let next = nextSingleNexusE1Step(g);
    if (!next && !g.response && !g.phaseOpening) {
      const d = g.decision; assert.ok(d);
      if (d.kind === 'battleCards') next = { actor: d.player, action: { type: 'decision', discard: [] } };
      else if (d.kind === 'techToken') next = { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
      else if (d.kind === 'faceDance') next = { actor: d.player, action: { type: 'decision', reveal: false } };
      else throw Error(`Consume the real ${d.kind} before continuing.`);
    }
    assert.ok(next); g = stepSingleNexusE1(g, next, actions);
  }
  throw Error('Original single E1 battle aftermath did not finish.');
}
/** Same public physical/held inputs as the existing paired quote, with optional training and native rules. */
export function quoteSingleNexusE1Battle(g: Game): BattleResolutionQuote {
  const b = g.battle; assert.ok(b?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const p = nativeHomeworldPlayer(g, actor), view = viewGame(g, actor).battle!; assert.ok(view.ownForces);
    return { id: actor, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand,
      plan: b.plans[actor], leader: p.leaders.find(l => l.id === b.plans[actor].leader), forces: view.ownForces,
      stronghold: view.strongholdEffects[actor], leaderSkills: (g.leaderSkills?.assignments ?? []).filter(a => a.owner === actor).map(a => ({
        skill: a.skill, leader: a.leader, faceUp: !b.leaderSkillHidden?.[actor], captured: false,
      })) };
  };
  const home = homeworldBattleLocation(g, b.territory);
  return quoteBattleResolution({ advanced: g.advanced, typedCasualties: !!g.homeworlds, turn: g.turn, territory: b.territory,
    ...(home ? { homeworld: { native: home.native, card: home.card, side: home.side, nativeForces: { ...home.forces[home.native] } } } : {}),
    aggressor: viewGame(g, g.host).battle!.aggressor, attacker: side(b.attacker), defender: side(b.defender),
    voters: viewGame(g, g.host).battle!.traitorVoters.map(actor => ({ id: actor,
      beneficiary: [b.attacker, b.defender].includes(actor) ? actor : nativeHomeworldPlayer(g, actor).ally!,
      called: b.traitorCalls[actor] ?? false, traitors: nativeHomeworldPlayer(g, actor).traitors })), participants: g.players,
    physicalCards: [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false });
}
