import assert from 'node:assert/strict';
import { applyAction, createGame, initializeLeaderSkillsGameForAudit, initializePairedNexusGameForAudit,
  joinGame, newPlayer, viewGame } from '../game/engine';
import type { Action, Game, Player } from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { Difficulty } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import { leaders, spiceDeck, treacheryDeck } from '../game/cards';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { traitorDeck } from '../game/traitors';
import { chooseEcazLoyalty } from '../game/ecaz-loyalty';
import { TERROR_KINDS } from '../game/moritani-terror';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import { DISCOVERY_SPICE_CARDS, validateDiscoveryState } from '../game/discoveries';
import { greatMakerRideAction } from '../game/great-maker-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldCombatLocation } from '../game/homeworld-combat';
import { quoteBattleResolution } from '../game/battle-resolution-quote';
import type { BattleResolutionQuote, ResolutionCombatant } from '../game/battle-resolution-quote';
import { nextE3NexusEcazStep } from './fixture-e3-nexus-ecaz';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export interface PairedE3NexusStep { actor: string; action: Action }
export interface PairedE3NexusOptions {
  initial?: Game;
  roster?: readonly FactionId[];
  advanced?: boolean;
  skills?: boolean;
  homeworlds?: boolean;
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  assassinationFaction?: 'guild' | 'ecaz';
}
export interface PairedE3NexusTransition { before: Game; step: PairedE3NexusStep; after: Game }
export interface PairedE3NexusSetup {
  initial: Game; offered: Game; afterSetup: Game;
  ecaz: string; moritani: string; others: string[]; actions: PairedE3NexusStep[];
}
export interface PairedE3NexusProgramme extends PairedE3NexusSetup {
  game: Game; alliance: Game | null; drawing: Game | null;
  draws: PairedE3NexusTransition[]; maker: Game | null;
  claim: PairedE3NexusTransition | null; firstMentat: PairedE3NexusTransition | null;
}
export interface PairedE3NexusBattle {
  game: Game; beforeBattle: Game; location: string; winner: string; loser: string;
  arrivals: PairedE3NexusTransition[]; plans: PairedE3NexusStep[];
}
export const pairedE3NexusReload = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;
export const pairedE3NexusClean = (g: Game): boolean =>
  !g.response && !g.phaseOpening && !g.decision && !g.pendingTreacheryDiscard && !g.truthtrance;
export function pairedE3NexusPlayer(g: Game, actor: string): Player {
  const p = g.players.find(p => p.id === actor); assert.ok(p); return p;
}
export function pairedE3NexusPolicy(g: Game, actor: string, difficulty: Difficulty): Action[] {
  const saved = pairedE3NexusReload(g); pairedE3NexusPlayer(saved, actor).bot = difficulty;
  return botActions(viewGame(pairedE3NexusReload(saved), actor));
}
/** Original response queues precede owned native choices. A human selects the
 * coalition lead, posture, assassination, Terror, physical losses and rewards. */
export function nextPairedE3NexusStep(g: Game): PairedE3NexusStep | null {
  if (!g.response && !g.phaseOpening && !g.pendingTreacheryDiscard && g.setupStage === 'leaderSkills') return null;
  if (!g.response && !g.phaseOpening && !g.pendingTreacheryDiscard && g.decision) {
    if (['ecazBattleLead', 'leaderSkillVisibility', 'moritaniPlacement', 'moritaniAssassinate',
      'moritaniTerror', 'ecazPlacement', 'ecazAmbassador', 'battleLosses', 'battleCards',
      'techToken', 'sukRescue', 'strongholdCopy', 'discoveryEntry', 'greatMakerVote',
      'greatMakerRide', 'homeworldDefense', 'homeworldRevivalDeployment', 'moritaniRetention'].includes(g.decision.kind)) return null;
    if (g.decision.kind === 'moritaniSetup') {
      const action = pairedE3NexusPolicy(g, g.decision.player, 'Easy')[0]; assert.ok(action);
      return { actor: g.decision.player, action };
    }
  }
  return nextE3NexusEcazStep(g);
}
export function stepPairedE3Nexus(g: Game, step: PairedE3NexusStep, actions?: PairedE3NexusStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(pairedE3NexusReload(g), step.actor, step.action));
}
export function advancePairedE3Nexus(g: Game, until: (g: Game) => boolean,
  actions?: PairedE3NexusStep[], choose?: (g: Game) => PairedE3NexusStep | null): Game {
  for (let n = 0; n < 3200; n++) {
    if (until(g)) return g;
    assert.notEqual(g.status, 'finished');
    const next = nextPairedE3NexusStep(g) ?? choose?.(g);
    assert.ok(next, `The owner must choose ${g.decision?.kind ?? 'a sealed plan'} at ${g.turn}/${g.phase}`);
    g = stepPairedE3Nexus(g, next, actions);
  }
  throw Error('Original paired E3 programme did not reach its boundary');
}
/** Explicit quiet programme choices: notably decline Grumman so supply remains
 * available. Battle choices are not supplied by this traversal. */
export function quietPairedE3NexusChoice(g: Game): PairedE3NexusStep | null {
  const d = g.decision; if (!d || g.response || g.phaseOpening) return null;
  if (['moritaniPlacement', 'ecazPlacement', 'ecazAmbassador', 'moritaniAssassinate',
    'homeworldRevivalDeployment'].includes(d.kind))
    return { actor: d.player, action: { type: 'decision', decline: true,
      ...('event' in d ? { event: d.event } : {}) } };
  if (d.kind === 'leaderSkillVisibility')
    return { actor: d.player, action: { type: 'leaderSkillVisibility', event: d.event, hide: false } };
  if (d.kind === 'discoveryEntry' || d.kind === 'greatMakerRide')
    return { actor: d.player, action: { type: 'decision', event: d.event, accept: false } };
  if (d.kind === 'greatMakerVote') return { actor: d.player, action: { type: 'decision', event: d.event, yes: true } };
  if (d.kind === 'homeworldDefense') return { actor: d.player, action: { type: 'decision', event: d.event, use: false } };
  if (d.kind === 'moritaniTerror') return { actor: d.player, action: { type: 'decision', decline: true } };
  return null;
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
function selectedSkills(g: Game): LeaderSkillId[] {
  const preferred: Partial<Record<FactionId, LeaderSkillId>> = { ecaz: 'warmaster', moritani: 'master-of-assassins',
    guild: 'suk-graduate', emperor: 'swordmaster-of-ginaz', atreides: 'bureaucrat',
    fremen: 'killer-medic', beneGesserit: 'prana-bindu-adept', harkonnen: 'smuggler' };
  return g.players.map(p => preferred[p.faction]!);
}
function traitorRolls(g: Game, faction: 'guild' | 'ecaz' = 'guild'): number[] {
  const original = traitorDeck(g.players), loyal = g.advanced ? chooseEcazLoyalty(original, 0xffffffff / 0x100000000) : null;
  const source = original.filter(c => c !== loyal), desired = [...source];
  const target = faction === 'ecaz' ? source.find(card => leaders('ecaz').some(l => l.id === card))
    : leaders('guild').find(l => l.name === 'Master Bewt')?.id;
  if (target && g.players.some(p => p.faction === faction)) {
    const destination = g.players.findIndex(p => p.faction === 'moritani') * 4;
    const at = desired.indexOf(target); [desired[at], desired[destination]] = [desired[destination], desired[at]];
  }
  return [...(g.advanced ? [0xffffffff] : []), ...permutation(source, desired)];
}
/** Determinism selects only original undealt lotteries. Supplied lobby entropy
 * and partially assigned original setup are authoritative and never redealt. */
export function createPairedE3NexusSetup(options: PairedE3NexusOptions = {}): PairedE3NexusSetup {
  const roster = options.roster ?? options.initial?.players.map(p => p.faction) ?? ['ecaz', 'moritani', 'guild', 'emperor'];
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  let g = options.initial ? pairedE3NexusReload(options.initial)
    : createGame('PAIREDE3NEXUS', newPlayer(roster[0], roster[0], roster[0]), advanced, ['ecaz']);
  if (!options.initial) for (const faction of roster.slice(1)) joinGame(g, newPlayer(faction, faction, faction));
  assert.equal(g.advanced, advanced); assert.deepEqual(g.expansions, ['ecaz']);
  assert.deepEqual(g.players.map(p => p.faction), roster);
  assert.ok(g.players.length >= 2 && g.players.length <= 6 && new Set(roster).size === roster.length);
  assert.ok(roster.includes('ecaz') && roster.includes('moritani'));
  assert.ok(roster.every(f => ['ecaz', 'moritani', 'guild', 'emperor', 'atreides', 'fremen', 'beneGesserit',
    ...(advanced ? [] : ['harkonnen'])].includes(f)));
  const skills = options.skills ?? (options.initial ? !!g.leaderSkills : false);
  const discovery = options.discovery ?? !!g.discoveryEnabled;
  const modules = { homeworlds: options.homeworlds ?? !!g.homeworlds,
    techTokens: options.tech ?? !!g.techTokens, strongholdCards: options.strongholds ?? !!g.strongholdCards };
  assert.ok(!modules.techTokens || g.players.length >= 3); assert.ok(!modules.strongholdCards || advanced);
  assert.ok(g.status === 'lobby' || g.status === 'setup' && g.turn === 1 && g.phase === 0,
    'Continue only an original lobby or original first-turn setup');
  assert.ok(!g.ecazTreachery);
  const initial = pairedE3NexusReload(g), actions: PairedE3NexusStep[] = [];
  if (g.status === 'lobby') {
    for (const [type, enabled] of Object.entries(modules)) if (!!g[type as keyof typeof modules] !== enabled)
      g = stepPairedE3Nexus(g, { actor: g.host, action: { type, enabled } }, actions);
    g.discoveryEnabled = discovery; g.nexusCards ??= { cards: null, phase: null };
    for (const p of g.players) if (!p.ready) g = stepPairedE3Nexus(g, { actor: p.id, action: { type: 'ready' } }, actions);
    if (options.initial) g = skills ? initializeLeaderSkillsGameForAudit(g) : initializePairedNexusGameForAudit(g);
    else {
      const sourceSkills = LEADER_SKILL_CARDS.map(c => c.id), selected = selectedSkills(g);
      const rest = sourceSkills.filter(c => !selected.includes(c));
      const skillOrder = selected.flatMap(c => [c, rest.shift()!]).concat(rest);
      const cards = treacheryDeck(['ecaz']), remaining = [...cards];
      const prefix = g.players.flatMap(p => Array.from({ length: p.faction === 'harkonnen' ? 2 : 1 }, () => {
        const worthless = remaining.findIndex(c => c.kind === 'worthless');
        const at = worthless >= 0 ? worthless : remaining.findIndex(c => c.kind === 'shield'); assert.ok(at >= 0);
        return remaining.splice(at, 1)[0].id;
      }));
      const rolls = [...(skills ? permutation(sourceSkills, skillOrder) : []),
        ...(discovery ? Array<number>(7).fill(0xffffffff) : []),
        ...Array<number>(NEXUS_FACTIONS.length - 1).fill(0xffffffff),
        ...permutation(cards.map(c => c.id), [...prefix, ...remaining.map(c => c.id)]),
        ...Array<number>(spiceDeck().length + (discovery ? DISCOVERY_SPICE_CARDS.length + 1 : 0) - 1).fill(0xffffffff),
        ...(!skills && !roster.includes('beneGesserit') ? traitorRolls(g, options.assassinationFaction) : [])];
      g = lottery(rolls, () => skills ? initializeLeaderSkillsGameForAudit(g) : initializePairedNexusGameForAudit(g));
    }
  }
  assert.equal(!!g.leaderSkills, skills); assert.equal(!!g.discoveries, discovery);
  for (const [type, enabled] of Object.entries(modules)) assert.equal(!!g[type as keyof typeof modules], enabled);
  assert.ok(g.nexusCards?.cards);
  const offered = pairedE3NexusReload(g), selected = selectedSkills(g);
  for (let n = 0; g.status === 'setup' && n < 300; n++) {
    let next: PairedE3NexusStep;
    if (g.setupStage === 'leaderSkills') {
      const actor = Object.keys(g.leaderSkills!.offers)[0], own = viewGame(g, actor).leaderSkills!;
      const skill = options.initial ? own.offer!.cards.find(c => !own.unavailableSkills?.[c]) : selected[g.players.findIndex(p => p.id === actor)];
      const eligible = own.eligibleLeaders.map(l => pairedE3NexusPlayer(g, actor).leaders.find(d => d.id === l.id)!);
      const leader = pairedE3NexusPlayer(g, actor).faction === 'guild'
        ? eligible.find(l => l.name === 'Master Bewt') ?? eligible[0] : eligible.sort((a, b) => b.strength - a.strength)[0];
      assert.ok(skill && leader && own.offer!.cards.includes(skill) && !own.unavailableSkills?.[skill]);
      next = { actor, action: { type: 'leaderSkill', event: own.offer!.event, skill, leader: leader.id } };
      if (!options.initial && Object.keys(g.leaderSkills!.offers).length === 1) {
        actions.push(structuredClone(next));
        g = lottery([...Array<number>(g.leaderSkills!.deck.length).fill(0xffffffff), ...traitorRolls(g, options.assassinationFaction)],
          () => applyAction(pairedE3NexusReload(g), next.actor, next.action)); continue;
      }
    } else {
      const proposed = nextPairedE3NexusStep(g) ?? quietPairedE3NexusChoice(g); assert.ok(proposed); next = proposed;
      if (next.action.type === 'traitor' && pairedE3NexusPlayer(g, next.actor).faction === 'moritani') {
        const choices = pairedE3NexusPlayer(g, next.actor).traitorChoices;
        const target = options.assassinationFaction === 'ecaz'
          ? choices.find(card => leaders('ecaz').some(l => l.id === card))
          : leaders('guild').find(l => l.name === 'Master Bewt')!.id;
        next.action.leader = target && choices.includes(target) ? target : choices[0];
      }
      if (next.action.type === 'fremenSetup') next.action.placements = { sietch_tabr: 0, false_wall_south: 10, false_wall_west: 0 };
    }
    if (options.initial) {
      actions.push(structuredClone(next));
      g = applyAction(pairedE3NexusReload(g), next.actor, next.action);
    } else g = stepPairedE3Nexus(g, next, actions);
  }
  assert.equal(g.status, 'playing');
  const ecaz = g.players.find(p => p.faction === 'ecaz')!.id, moritani = g.players.find(p => p.faction === 'moritani')!.id;
  pairedE3NexusInventory(g);
  return { initial, offered, afterSetup: g, ecaz, moritani, others: g.players.filter(p => ![ecaz, moritani].includes(p.id)).map(p => p.id), actions };
}
function frontSpice(g: Game, match: (c: Game['spiceDeck'][number]) => boolean, position: number): void {
  const at = g.spiceDeck.findIndex((c, i) => i >= position && match(c)); assert.ok(at >= position);
  g.spiceDeck.splice(position, 0, g.spiceDeck.splice(at, 1)[0]);
}
/** Both natives stay unallied while two real other seats ally. Two/three-seat
 * programmes return native setup: there cannot be two unallied native draws. */
export function createPairedE3NexusProgramme(options: PairedE3NexusOptions = {}): PairedE3NexusProgramme {
  const f = createPairedE3NexusSetup(options);
  let g = pairedE3NexusReload(f.afterSetup);
  if (f.others.length < 2) return { ...f, game: g, alliance: null, drawing: null, draws: [], maker: null, claim: null, firstMentat: null };
  for (let i = 0; i < (g.advanced ? 2 : 1); i++)
    frontSpice(g, c => 'territory' in c && !c.discovery && !['arrakeen', 'tueks_sietch'].includes(c.territory), i);
  g = advancePairedE3Nexus(g, s => s.phase === 5 && s.active === f.ecaz && pairedE3NexusClean(s), f.actions, quietPairedE3NexusChoice);
  const claim = shipPairedE3Nexus(g, f.ecaz, 'sietch_tabr:14', 1, f.actions); g = claim.after;
  let firstMentat: PairedE3NexusTransition | null = null;
  for (let n = 0; g.turn === 1 && n < 600; n++) {
    const before = pairedE3NexusReload(g), next = nextPairedE3NexusStep(g) ?? quietPairedE3NexusChoice(g); assert.ok(next);
    g = stepPairedE3Nexus(g, next, f.actions);
    if (g.turn === 2) firstMentat = { before, step: next, after: pairedE3NexusReload(g) };
  }
  assert.ok(firstMentat);
  g = advancePairedE3Nexus(g, s => s.turn === 2 && s.phase === 1 && pairedE3NexusClean(s), f.actions, quietPairedE3NexusChoice);
  frontSpice(g, c => 'worm' in c && (g.discoveries ? !!c.greatMaker : !c.greatMaker && !c.suppressed), 0);
  for (let i = 1; i <= (g.advanced ? 2 : 1); i++) frontSpice(g, c => 'territory' in c && !c.discovery, i);
  let maker: Game | null = null;
  g = advancePairedE3Nexus(g, s => !!s.nexus && !s.spiceWindow && !s.spiceResolution && pairedE3NexusClean(s), f.actions, s => {
    if (s.decision?.kind === 'greatMakerVote') maker ??= pairedE3NexusReload(s);
    if (s.decision?.kind === 'greatMakerRide') {
      const action = greatMakerRideAction(viewGame(s, s.decision.player), 'polar_sink', 0, 2, s.advanced ? 1 : 0);
      assert.ok(action); return { actor: s.decision.player, action };
    }
    return quietPairedE3NexusChoice(s);
  });
  for (const [actor, target] of [[f.others[0], f.others[1]], [f.others[1], f.others[0]]])
    g = stepPairedE3Nexus(g, { actor, action: { type: 'alliance', target } }, f.actions);
  const alliance = pairedE3NexusReload(g);
  g = advancePairedE3Nexus(g, s => s.nexusCards?.phase?.stage === 'drawing' && pairedE3NexusClean(s), f.actions, quietPairedE3NexusChoice);
  const cards = g.nexusCards!.cards!;
  cards.deck = ['ecaz', 'moritani', ...cards.deck.filter(c => c !== 'ecaz' && c !== 'moritani')];
  const drawing = pairedE3NexusReload(g), draws: PairedE3NexusTransition[] = [];
  for (const actor of [f.ecaz, f.moritani]) {
    const before = pairedE3NexusReload(g), step: PairedE3NexusStep = { actor,
      action: { type: 'nexusCardChoice', turn: g.turn, card: cards.hands[actor] ?? null, choice: 'draw', ownRedraws: 0 } };
    g = stepPairedE3Nexus(g, step, f.actions); draws.push({ before, step, after: pairedE3NexusReload(g) });
  }
  g = advancePairedE3Nexus(g, s => s.phase === 5 && pairedE3NexusClean(s), f.actions, quietPairedE3NexusChoice);
  pairedE3NexusInventory(g); return { ...f, game: g, alliance, drawing, draws, maker, claim, firstMentat };
}
export function shipPairedE3Nexus(g: Game, actor: string, location: string, amount: number,
  actions?: PairedE3NexusStep[]): PairedE3NexusTransition {
  assert.ok(g.phase === 5 && g.active === actor && pairedE3NexusClean(g));
  const sources = g.homeworlds ? nativeShipmentSources(viewGame(g, actor), amount, 0) : undefined;
  if (g.homeworlds) assert.ok(sources);
  let action: Action;
  if (location.startsWith('homeworld:')) {
    assert.ok(sources); const choice = homeworldShipmentChoice(viewGame(g, actor), location,
      Object.fromEntries(Object.entries(sources).filter(([, f]) => f.normal + f.elite > 0)));
    assert.ok(choice.action, choice.blocked ?? undefined); action = choice.action;
  } else {
    const [site, sector] = location.split(':');
    action = { type: 'ship', territory: site, sector: Number(sector), amount, elite: 0, allyPayment: 0,
      ...(sources ? { homeworldSources: sources } : {}) };
  }
  const before = pairedE3NexusReload(g), step = { actor, action };
  g = stepPairedE3Nexus(g, step, actions);
  g = advancePairedE3Nexus(g, s => pairedE3NexusClean(s) && !s.pendingShipment && !s.pendingHomeworldShipment,
    actions, quietPairedE3NexusChoice);
  return { before, step, after: g };
}
export function openPairedE3NexusBattle(g: Game, location: string, actions?: PairedE3NexusStep[]): Game {
  g = advancePairedE3Nexus(g, s => s.phase === 6 && pairedE3NexusClean(s), actions, quietPairedE3NexusChoice);
  const choice = viewGame(g, g.active!).battleChoices.find(c => c.territory === location); assert.ok(choice);
  return stepPairedE3Nexus(g, { actor: choice.chooser, action: { type: 'chooseBattle', territory: location,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } }, actions);
}
export function revealPairedE3Nexus(g: Game, plans: readonly PairedE3NexusStep[], actions?: PairedE3NexusStep[]): Game {
  g = advancePairedE3Nexus(g, s => !!s.battle && pairedE3NexusClean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false,
    actions, quietPairedE3NexusChoice);
  for (const plan of plans) {
    g = stepPairedE3Nexus(g, plan, actions);
    g = advancePairedE3Nexus(g, s => !s.response && !s.phaseOpening && s.decision?.kind !== 'fullPlanOffer', actions, quietPairedE3NexusChoice);
  }
  assert.ok(g.battle?.revealed); return g;
}
export function quotePairedE3NexusBattle(g: Game): BattleResolutionQuote {
  const b = g.battle!, publicBattle = viewGame(g, g.host).battle!; assert.ok(b?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const p = pairedE3NexusPlayer(g, actor), view = viewGame(g, actor).battle!; assert.ok(view.ownForces);
    return { id: actor, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand, plan: b.plans[actor],
      leader: p.leaders.find(l => l.id === b.plans[actor].leader) ?? (g.dukeVidal?.controller === actor ? g.dukeVidal.leader : undefined),
      forces: view.ownForces, stronghold: view.strongholdEffects[actor],
      leaderSkills: g.leaderSkills?.assignments.filter(a => a.owner === actor).map(a => ({ skill: a.skill, leader: a.leader,
        faceUp: !b.leaderSkillHidden?.[actor], captured: false })) };
  };
  const context = homeworldContext(g), home = b.territory.startsWith('homeworld:')
    ? homeworldCombatLocation({ ...context, players: context.players.map(p => ({ ...p, ally: pairedE3NexusPlayer(g, p.id).ally })), order: g.order }, g.homeworlds!.custody!, b.territory) : null;
  return quoteBattleResolution({ advanced: g.advanced, typedCasualties: !!g.homeworlds, turn: g.turn,
    territory: b.territory, aggressor: publicBattle.aggressor,
    ...(publicBattle.ecazOccupy?.profile ? { ecazOccupy: publicBattle.ecazOccupy.profile } : {}),
    ...(home ? { homeworld: { native: home.native, card: home.card, side: home.side, nativeForces: home.forces[home.native] } } : {}),
    attacker: side(b.attacker), defender: side(b.defender), voters: publicBattle.traitorVoters.map(actor => ({ id: actor,
      beneficiary: [b.attacker, b.defender].includes(actor) ? actor : pairedE3NexusPlayer(g, actor).ally!,
      called: b.traitorCalls[actor] ?? false, traitors: pairedE3NexusPlayer(g, actor).traitors })),
    participants: g.players, physicalCards: [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false, nexusMoritani: true });
}
export function pairedE3NexusInventory(g: Game): void {
  const nx = g.nexusCards!.cards!; validateNexusCards(nx, g.players);
  assert.deepEqual([...nx.deck, ...nx.discard, ...Object.values(nx.hands).filter(c => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
  const auction = g.auction?.cards.slice(g.auction.index + (g.currentAuctionSale ? 1 : 0)) ?? [];
  assert.deepEqual([...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand), ...auction].map(c => c.id).sort(), treacheryDeck(['ecaz']).map(c => c.id).sort());
  assert.equal(g.richeseCache?.length ?? 0, 0);
  if (g.leaderSkills) {
    validateLeaderSkills(g.leaderSkills, g.players);
    assert.deepEqual([...g.leaderSkills.deck, ...Object.values(g.leaderSkills.offers).flatMap(o => o.cards),
      ...g.leaderSkills.assignments.map(a => a.skill)].sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
    assert.ok(g.leaderSkills.assignments.every(a => a.leader !== DUKE_VIDAL_ID));
  }
  if (g.homeworlds) homeworldGameIntegrity(g);
  if (g.discoveries) validateDiscoveryState(g.discoveries);
  const homes = g.homeworlds?.custody ? homeworldForceGroups(homeworldContext(g), g.homeworlds.custody) : [];
  for (const p of g.players) {
    const visitors = homes.filter(h => h.native !== p.id).map(h => h.forces[p.id] ?? { normal: 0, elite: 0 });
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, n) => a + n, 0) + visitors.reduce((a, f) => a + f.normal + f.elite, 0), 20);
    assert.deepEqual(p.leaders.map(l => l.id).sort(), leaders(p.faction).map(l => l.id).sort());
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, n) => a + n, 0) + visitors.reduce((a, f) => a + f.elite, 0), p.faction === 'fremen' ? 3 : 5);
  }
  const retired = g.moritaniAssassinate?.opportunities.filter(r => r.stage === 'replaced').map(r => r.card!) ?? [];
  assert.deepEqual([...g.traitorReserve!, ...g.players.flatMap(p => [...p.traitors, ...p.traitorChoices]), ...retired,
    ...(g.ecazLoyalty?.card ? [g.ecazLoyalty.card] : [])].sort(), traitorDeck(g.players).sort());
  assert.equal(pairedE3NexusPlayer(g, g.players.find(p => p.faction === 'ecaz')!.id).leaders.length, 5);
  assert.equal(g.dukeVidal!.leader.id, DUKE_VIDAL_ID); validateAmbassadors(g.ecazAmbassadors!);
  assert.deepEqual(g.moritaniTerror!.tokens.map(t => t.kind).sort(), [...TERROR_KINDS].sort());
}
