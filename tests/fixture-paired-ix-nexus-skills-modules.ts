import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, territory } from '../game/board';
import type { Card } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { pairedNexusLeaderSkillsProfile } from '../game/leader-skill-profile';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { ownedTech } from '../game/tech-tokens';
import { strongholdControllers, type StrongholdId } from '../game/stronghold-cards';
import { traitorDeck } from '../game/traitors';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type PairedIxNexusSkillsModulesStep = { actor: string; action: Action };
export type PairedIxNexusSkillsModulesOptions = {
  /** Genuine fresh lobby or original turn-one/phase-zero setup with zero assignments.
   * Existing first hands, offers, actor IDs and stock are authoritative. */
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  mobileBattle?: boolean;
  program?: 'suboids' | 'faceDance';
  skill?: LeaderSkillId;
  band?: 'normal' | 'skilled';
  dial?: number;
  support?: number;
};
export type PairedIxNexusSkillsModulesSourceFacts = {
  sources: readonly string[];
  staging: string[];
  turn: number;
  phase: number;
  cardOwners: Record<StrongholdId, string | null> | null;
  controllers: Record<StrongholdId, string | null>;
  tech: Game['techTokens'] | null;
  stock: { player: string; faceDancers: NonNullable<Player['faceDancers']> }[];
  physicalForces: { player: string; reserves: number; tanks: number; forces: Record<string, number>; elites: Player['elites'] }[];
};
export type PairedIxNexusSkillsModulesFixture = {
  initial: Game;
  offered: Game;
  afterSetup: Game;
  afterFirstStorm: Game;
  beforeFirstMentat: Game;
  firstMentatStep: PairedIxNexusSkillsModulesStep;
  afterFirstMentat: Game;
  beforeAlliance: Game;
  allianceActions: PairedIxNexusSkillsModulesStep[];
  beforeNexusDraw: Game;
  drawActions: PairedIxNexusSkillsModulesStep[];
  afterNexusDraw: Game;
  beforeBattle: Game;
  battleStep: PairedIxNexusSkillsModulesStep;
  game: Game;
  ixians: string;
  tleilaxu: string;
  opponent: string;
  partners: [string, string];
  trainer: string;
  skill: LeaderSkillId;
  band: 'normal' | 'skilled';
  program: 'suboids' | 'faceDance';
  kind: 'arrakeen' | 'sietch_tabr' | typeof MOBILE_STRONGHOLD;
  sourceFacts: PairedIxNexusSkillsModulesSourceFacts;
  location: string;
  replacementSource: string;
  planActions: PairedIxNexusSkillsModulesStep[];
  actions: PairedIxNexusSkillsModulesStep[];
  staging: string[];
};
export function pairedIxNexusSkillsModulesPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing original E1 seat ${actor}`);
  return player;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Control native shuffles only, never fabricate dealt cards. Non-word entropy
 * forwards through the bound original method and always returns its input array. */
function entropy<T>(operation: () => T, rolls: number[] = []): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array) {
      for (let i = 0; i < array.length; i++) array[i] = rolls[cursor++] ?? 0xffffffff;
    } else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function shuffleRolls(source: string[], desired: string[]): number[] {
  const working = [...source], rolls: number[] = [];
  assert.deepEqual([...source].sort(), [...desired].sort());
  for (let i = working.length - 1; i > 0; i--) {
    const from = working.indexOf(desired[i]); assert.ok(from >= 0 && from <= i);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[from]] = [working[from], working[i]];
  }
  return rolls;
}
function skillRolls(selected: LeaderSkillId[]): number[] {
  const source = LEADER_SKILL_CARDS.map(c => c.id);
  const remainder = source.filter(c => !selected.includes(c));
  const desired = selected.flatMap(c => [c, remainder.shift()!]);
  return shuffleRolls(source, [...desired, ...remainder]);
}
/** Original default continuation declines native Face Dance; callers can stop
 * at its real window before choosing a matching-stock reveal. Private plans remain explicit. */
export function nextPairedIxNexusSkillsModulesStep(game: Game): PairedIxNexusSkillsModulesStep | null {
  if (clean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const phase = game.nexusCards.phase, actor = phase.eligible.find(id => !phase.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor] ?? null, choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.phaseOpening && !game.response) {
    const d = game.decision;
    if (d?.kind === 'techToken') return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
    if (d?.kind === 'strongholdCopy') return null;
    if (d?.kind === 'faceDance') return { actor: d.player, action: { type: 'decision', reveal: false } };
    if (d?.kind === 'leaderSkillVisibility') return { actor: d.player,
      action: { type: 'leaderSkillVisibility', event: d.event, hide: false } };
    if (d?.kind === 'mentatQuestion') return { actor: d.player,
      action: { type: 'decision', event: d.event, decline: true } };
    if (d?.kind === 'rihani') return { actor: d.player,
      action: { type: 'decision', event: d.event, draw: false } };
    if (d?.kind === 'sukRescue') {
      const best = d.options.map((o, choice) => ({ choice, count: o.normal + o.elite, kept: !!o.kept }))
        .sort((a, b) => b.count - a.count || Number(b.kept) - Number(a.kept))[0];
      return { actor: d.player, action: { type: 'decision', event: d.event, choice: best.choice } };
    }
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function stepPairedIxNexusSkillsModules(game: Game, step = nextPairedIxNexusSkillsModulesStep(game)): Game {
  assert.ok(step, 'Original human plan or matching-stock Face Dance is required');
  return entropy(() => applyAction(game, step.actor, step.action));
}
export function advancePairedIxNexusSkillsModules(state: Game, until: (game: Game) => boolean,
  actions: PairedIxNexusSkillsModulesStep[] = []): Game {
  let game = structuredClone(state);
  for (let i = 0; i < 2400; i++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextPairedIxNexusSkillsModulesStep(game); assert.ok(step, 'Native explicit human choice before requested boundary');
    actions.push(structuredClone(step)); game = stepPairedIxNexusSkillsModules(game, step);
  }
  throw Error('Paired E1 Nexus/Skills continuation did not reach its native boundary');
}
function reserveBoard(game: Game): void {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0); p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0); p.elites.forces = {};
    }
    if (p.advisors) p.advisors = {};
  }
}
function place(game: Game, actor: string, key: string, total: number, elite = 0): void {
  const p = pairedIxNexusSkillsModulesPlayer(game, actor);
  assert.ok(total >= elite && p.reserves - (p.elites?.reserves ?? 0) >= total - elite && (p.elites?.reserves ?? 0) >= elite);
  p.reserves -= total; p.forces[key] = (p.forces[key] ?? 0) + total;
  if (elite) { p.elites!.reserves -= elite; p.elites!.forces[key] = (p.elites!.forces[key] ?? 0) + elite; }
}
function hold(game: Game, actor: string, kind: Card['kind'], staging: string[]): string {
  const p = pairedIxNexusSkillsModulesPlayer(game, actor), held = p.hand.find(c => c.kind === kind);
  if (held) return held.id;
  const index = game.deck.findIndex(c => c.kind === kind);
  const donor = index < 0 ? game.players.find(other => other.id !== actor && other.hand.some(c => c.kind === kind)) : undefined;
  assert.ok(index >= 0 || donor, 'Required original physical card has a deck/hand custodian');
  assert.ok(p.hand.length < handLimit(p), 'Preserve actual starting hands and require real capacity');
  const card = index >= 0 ? game.deck.splice(index, 1)[0] : donor!.hand.splice(donor!.hand.findIndex(c => c.kind === kind), 1)[0];
  p.hand.push(card); staging.push(`Conserved ${card.id}: ${donor?.id ?? 'original remaining deck'} → ${actor} hand after native deals`);
  return card.id;
}
function orderSpice(game: Game, kinds: ('land' | 'worm')[], staging: string[]): void {
  const remaining = [...game.spiceDeck];
  const ordered = kinds.map(kind => {
    const at = remaining.findIndex(c => kind === 'land' ? 'territory' in c : 'worm' in c && !c.greatMaker && !c.suppressed);
    assert.ok(at >= 0); return remaining.splice(at, 1)[0];
  });
  game.spiceDeck = [...ordered, ...remaining];
  staging.push(`Conserved original undealt Spice order: ${kinds.join(', ')}; not natural shuffle history`);
}
/** Printed composition sources: docs/NEXUS_CARD_RULES.md, paired E1/E2
 * Skills and Tech/Stronghold sections; docs/LEADER_SKILLS_RUNTIME.md, paired
 * Nexus, Advanced Stronghold and native Tech sections. This adds no revival ruling. */
export const PAIRED_IX_NEXUS_SKILLS_MODULES_SOURCES = [
  'docs/NEXUS_CARD_RULES.md#paired-e1e2-nexus-and-leader-skills-composition--4-october-2026',
  'docs/NEXUS_CARD_RULES.md#paired-e1e2-tech-and-stronghold-composition--4-october-2026',
  'docs/LEADER_SKILLS_RUNTIME.md#advanced-stronghold-composition--4-october-2026',
  'docs/LEADER_SKILLS_RUNTIME.md#native-e1e2-tech-tokens-composition--4-october-2026',
] as const;
/** Two-seat Stronghold-only native setup is legal, but cannot manufacture an
 * unallied closing draw. The battle program below separately requires classics. */
export function initializePairedIxNexusSkillsModulesSetup(options: PairedIxNexusSkillsModulesOptions = {}) {
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const tech = options.tech ?? (options.initial ? !!options.initial.techTokens : true);
  const strongholds = options.strongholds ?? (options.initial ? !!options.initial.strongholdCards : advanced);
  assert.ok(tech || strongholds); assert.ok(!strongholds || advanced);
  let game = options.initial ? structuredClone(options.initial)
    : createGame('PAIREDIXNEXUSSKILLSMODULES', newPlayer('ixians', 'Ixians', 'ixians'), advanced, ['ix']);
  if (!options.initial) for (const faction of ['tleilaxu', 'guild', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['ix']);
  assert.ok(!game.homeworlds);
  assert.ok(game.players.length >= (tech ? 3 : 2) && game.players.length <= 6);
  const ixians = game.players.find(p => p.faction === 'ixians')?.id;
  const tleilaxu = game.players.find(p => p.faction === 'tleilaxu')?.id;
  assert.ok(ixians && tleilaxu);
  const classics = game.players.filter(p => p.id !== ixians && p.id !== tleilaxu);
  assert.ok(classics.every(p => ['atreides', 'harkonnen', 'emperor', 'guild', 'fremen', 'beneGesserit'].includes(p.faction)));
  const actions: PairedIxNexusSkillsModulesStep[] = [], staging: string[] = [];
  const requested = options.skill ?? 'suk-graduate';
  const passives: LeaderSkillId[] = (['sandmaster', 'smuggler', 'rihani-decipherer', 'prana-bindu-adept', 'killer-medic', 'master-of-assassins'] as LeaderSkillId[])
    .filter(skill => skill !== requested);
  const selected = game.players.map(p => p.id === ixians ? requested : passives.shift()!);
  const supplied = !!options.initial;
  const initial = structuredClone(game);
  if (game.status === 'lobby') {
    assert.ok(!game.leaderSkills, 'Original all14 custody cannot be replaced');
    for (const [type, enabled, selectedModule] of [
      ['techTokens', tech, !!game.techTokens], ['strongholdCards', strongholds, !!game.strongholdCards],
    ] as const) if (enabled !== selectedModule) {
      const step: PairedIxNexusSkillsModulesStep = { actor: game.host, action: { type, enabled } };
      actions.push(step); game = stepPairedIxNexusSkillsModules(game, step);
    }
    game.nexusCards ??= { cards: null, phase: null };
    assert.deepEqual(game.nexusCards, { cards: null, phase: null });
    for (const p of game.players) if (!p.ready) {
      const step: PairedIxNexusSkillsModulesStep = { actor: p.id, action: { type: 'ready' } };
      actions.push(step); game = stepPairedIxNexusSkillsModules(game, step);
    }
    game = entropy(() => initializeLeaderSkillsGameForAudit(game), skillRolls(selected));
    staging.push('Scoped original all14 shuffle selects native offers before starting Treachery deals; no offers are replaced');
  }
  assert.ok(pairedNexusLeaderSkillsProfile(game));
  assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, strongholds);
  assert.equal(game.status, 'setup'); assert.equal(game.turn, 1); assert.equal(game.phase, 0);
  assert.equal(game.leaderSkills!.assignments.length, 0);
  let offered = structuredClone(game), trainer = '';
  for (let i = 0; game.status === 'setup' && i < 240; i++) {
    let step: PairedIxNexusSkillsModulesStep;
    if (game.setupStage === 'leaderSkills') {
      offered = trainer ? offered : structuredClone(game);
      const actor: string = Object.keys(game.leaderSkills!.offers)[0];
      const offer: NonNullable<Game['leaderSkills']>['offers'][string] = game.leaderSkills!.offers[actor];
      const projection = viewGame(game, actor).leaderSkills!;
      const legal: LeaderSkillId[] = offer.cards.filter(c => !projection.unavailableSkills?.[c]);
      const desired: LeaderSkillId = selected[game.players.findIndex(p => p.id === actor)];
      const skill: LeaderSkillId | undefined = actor === ixians && options.skill ? legal.find(c => c === options.skill)
        : !supplied && legal.includes(desired) ? desired : legal[0];
      assert.ok(skill, 'Explicit requested skill must genuinely exist in the original saved offer');
      const eligible = new Set(projection.eligibleLeaders.map(l => l.id));
      const leader = pairedIxNexusSkillsModulesPlayer(game, actor).leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader);
      if (actor === ixians) trainer = leader.id;
      step = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    } else {
      const native = nextPairedIxNexusSkillsModulesStep(game); assert.ok(native); step = native;
      if (!supplied && game.setupStage === 'traitors' && step.action.type === 'traitor') {
        const choices = pairedIxNexusSkillsModulesPlayer(game, step.actor).traitorChoices;
        const card = choices.find(id => id !== trainer); assert.ok(card); step.action.leader = card;
      }
    }
    actions.push(structuredClone(step));
    if (!supplied && game.setupStage === 'forces') {
      const held = new Set(game.players.flatMap(p => p.traitors));
      const source = traitorDeck(game.players, true).filter(id => !held.has(id));
      assert.ok(source.includes(trainer), 'Original trained Ix identity must remain undealt');
      staging.push('Scoped original remaining Traitor shuffle orders the undealt trainer before the actual native Face Dancer draw; no matching stock is manufactured or exchanged');
      game = entropy(() => applyAction(game, step.actor, step.action), shuffleRolls(source, [trainer, ...source.filter(id => id !== trainer)]));
    } else game = supplied ? applyAction(game, step.actor, step.action) : stepPairedIxNexusSkillsModules(game, step);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === ixians)!;
  trainer = assignment.leader; const skill = assignment.skill;
  return { initial, offered, afterSetup, game, ixians, tleilaxu, trainer, skill, actions, staging };
}
/** Actual initializer → original skill/Traitor/faction setup → Storm → END
 * Mentat → qualifying alliance → closing draw. Only conserved order/counters/
 * cards are staged; no wallet, ownership, hand face or earned receipt is assigned. */
export function createPairedIxNexusSkillsModulesFixture(options: PairedIxNexusSkillsModulesOptions = {}): PairedIxNexusSkillsModulesFixture {
  const setup = initializePairedIxNexusSkillsModulesSetup(options);
  const { initial, offered, afterSetup, ixians, tleilaxu, trainer, skill, actions, staging } = setup;
  let game = setup.game;
  const advanced = game.advanced, program = options.program ?? 'suboids', band = options.band ?? 'skilled';
  const classics = game.players.filter(p => p.id !== ixians && p.id !== tleilaxu);
  assert.ok(classics.length >= 2, 'Two classics must form a real alliance; two-seat setup does not authorize a fabricated closing draw');
  const partners: [string, string] = [classics[0].id, classics[1].id];
  game = advancePairedIxNexusSkillsModules(game, g => g.phase === 1 && clean(g), actions);
  const afterFirstStorm = structuredClone(game);
  orderSpice(game, ['land', 'land'], staging);
  game = advancePairedIxNexusSkillsModules(game, g => g.phase === 5 && clean(g), actions);
  reserveBoard(game); staging.push('After native starting placements: conserved board counters returned to original reserves before first movement completion');
  game = advancePairedIxNexusSkillsModules(game, g => g.phase === 8 && clean(g), actions);
  if (game.strongholdCards) {
    reserveBoard(game);
    place(game, ixians, `arrakeen:${territory('arrakeen').sectors[0]}`, 1);
    place(game, ixians, program === 'faceDance' ? `sietch_tabr:${territory('sietch_tabr').sectors[0]}` : MOBILE_LOCATION, 1);
    staging.push('Before actual END Mentat: conserved Ix counters control only Arrakeen and Tabr/HMS; held Cards must be earned, not assigned');
  }
  let beforeFirstMentat!: Game, firstMentatStep!: PairedIxNexusSkillsModulesStep;
  while (game.turn === 1) {
    const step = nextPairedIxNexusSkillsModulesStep(game); assert.ok(step);
    const before = structuredClone(game); actions.push(structuredClone(step)); game = stepPairedIxNexusSkillsModules(game, step);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = step; }
  }
  const afterFirstMentat = structuredClone(game);
  game = advancePairedIxNexusSkillsModules(game, g => g.phase === 1 && clean(g), actions);
  orderSpice(game, ['worm', 'land', 'land'], staging);
  game = advancePairedIxNexusSkillsModules(game, g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && clean(g), actions);
  const beforeAlliance = structuredClone(game);
  const allianceActions: PairedIxNexusSkillsModulesStep[] = partners.map((actor, i) => ({ actor, action: { type: 'alliance', target: partners[1 - i] } }));
  for (const step of allianceActions) { actions.push(step); game = stepPairedIxNexusSkillsModules(game, step); }
  game = advancePairedIxNexusSkillsModules(game, g => g.nexusCards?.phase?.stage === 'drawing', actions);
  const cards = game.nexusCards!.cards!;
  assert.ok(cards.deck.includes('ixians') && cards.deck.includes('tleilaxu'));
  cards.deck = ['ixians', 'tleilaxu', ...cards.deck.filter(c => c !== 'ixians' && c !== 'tleilaxu')];
  staging.push('Order conserved unused Ix/Tleilaxu Nexus singletons; only real closing draws grant the two native hands');
  const beforeNexusDraw = structuredClone(game);
  const drawActions: PairedIxNexusSkillsModulesStep[] = [ixians, tleilaxu].map(actor => ({ actor,
    action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[actor], choice: 'draw', ownRedraws: 0 } }));
  for (const step of drawActions) { actions.push(step); game = stepPairedIxNexusSkillsModules(game, step); }
  game = advancePairedIxNexusSkillsModules(game, g => g.nexusCards?.phase?.stage !== 'drawing', actions);
  const afterNexusDraw = structuredClone(game);
  game = advancePairedIxNexusSkillsModules(game, g => g.phase === 5 && clean(g), actions);
  reserveBoard(game);
  const opponent = game.techTokens ? classics.find(p => ownedTech(game.techTokens, p.id).length)?.id
    : classics.find(p => p.faction === 'guild')?.id ?? classics[0].id;
  assert.ok(opponent, 'The real first Storm must allocate a classic opponent token');
  assert.ok(!options.mobileBattle || game.strongholdCards && program === 'suboids');
  const kind = options.mobileBattle ? MOBILE_STRONGHOLD : program === 'faceDance' ? 'sietch_tabr' : 'arrakeen';
  const location = kind === MOBILE_STRONGHOLD ? MOBILE_LOCATION : `${kind}:${territory(kind).sectors[0]}`;
  const replacementSource = `arrakeen:${territory('arrakeen').sectors[0]}`;
  place(game, ixians, location, 6, 3); place(game, opponent, location, 6);
  if (program === 'faceDance') place(game, tleilaxu, replacementSource, 3);
  if (options.mobileBattle) {
    place(game, ixians, replacementSource, 1);
    place(game, ixians, `sietch_tabr:${territory('sietch_tabr').sectors[0]}`, 1);
    staging.push('Turn-two controlled HMS copy sources: Arrakeen and Tabr counters after actual two-hold Mentat; no later three-hold Mentat victory is suppressed');
  }
  staging.push('Before native movement completion: conserved six Ix counters (three Cyborg/three Suboid), six ordinary opponents and optional physical replacement sources; no phase, wallet or stock mutation');
  const ix = pairedIxNexusSkillsModulesPlayer(game, ixians), stock = pairedIxNexusSkillsModulesPlayer(game, tleilaxu).faceDancers!;
  const untrained = (p: Player) => p.leaders.filter(l => !l.dead && !l.usedAt && !l.gholaBy && !l.capturedBy &&
    !game.leaderSkills!.assignments.some(a => a.leader === l.id));
  const leader = band === 'skilled' ? ix.leaders.find(l => l.id === trainer)! : untrained(ix)
    .filter(l => program !== 'faceDance' || stock.some(c => c.leader === l.id && !c.revealed)).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(leader && (program !== 'faceDance' || stock.some(c => c.leader === leader.id && !c.revealed)),
    'Infeasible original stock: this band requires a matching living original Ix disc; no stock is fabricated or exchanged');
  const enemy = untrained(pairedIxNexusSkillsModulesPlayer(game, opponent)).sort((a, b) => a.strength - b.strength)[0]; assert.ok(enemy);
  const weapon = skill === 'warmaster' ? hold(game, ixians, 'worthless', staging)
    : program === 'faceDance' ? hold(game, ixians, 'projectile', staging) : null;
  const defense = program === 'faceDance' ? hold(game, ixians, 'shield', staging) : null;
  game = advancePairedIxNexusSkillsModules(game, g => g.phase === 6 && clean(g), actions);
  const beforeBattle = structuredClone(game), actor = game.active!; assert.ok(actor === ixians || actor === opponent);
  const battleStep: PairedIxNexusSkillsModulesStep = { actor, action: { type: 'chooseBattle', territory: kind, target: actor === ixians ? opponent : ixians } };
  actions.push(battleStep); game = stepPairedIxNexusSkillsModules(game, battleStep);
  const planActions: PairedIxNexusSkillsModulesStep[] = [
    { actor: ixians, action: { type: 'battlePlan', leader: leader.id, dial: options.dial ?? (advanced ? 4 : 6),
      support: advanced ? options.support ?? 1 : 0, weapon, defense } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 0, support: 0, weapon: null, defense: null } },
  ];
  return { initial, offered, afterSetup, afterFirstStorm, beforeFirstMentat, firstMentatStep, afterFirstMentat,
    beforeAlliance, allianceActions, beforeNexusDraw, drawActions, afterNexusDraw, beforeBattle, battleStep,
    game, ixians, tleilaxu, opponent, partners, trainer, skill, band, program, kind, location, replacementSource,
    planActions, actions, staging, sourceFacts: pairedIxNexusSkillsModulesSourceFacts(game, staging) };
}
export function preparePairedIxNexusSkillsModulesBattle(f: PairedIxNexusSkillsModulesFixture, state = f.game): Game {
  let game = structuredClone(state);
  for (let i = 0; i < 160; i++) {
    const step = nextPairedIxNexusSkillsModulesStep(game);
    if (!step) {
      if (game.decision?.kind === 'strongholdCopy') {
        assert.ok(game.decision.choices.includes('arrakeen'));
        game = stepPairedIxNexusSkillsModules(game, { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, stronghold: 'arrakeen' } });
        continue;
      }
      assert.ok(game.battle && !game.battle.revealed); return game;
    }
    if (step.action.type === 'leaderSkillVisibility') step.action.hide = step.actor === f.ixians && f.band === 'skilled';
    game = stepPairedIxNexusSkillsModules(game, step);
  }
  throw Error('Paired E1 native skill posture did not reach private plans');
}
export function beginPairedIxNexusSkillsModulesCunning(f: PairedIxNexusSkillsModulesFixture, state = preparePairedIxNexusSkillsModulesBattle(f)): Game {
  const offer = viewGame(state, f.ixians).nexusSuboids?.offer;
  assert.ok(offer); assert.equal(offer.blocked, null);
  return stepPairedIxNexusSkillsModules(state, { actor: f.ixians, action: { type: 'nexusSuboids', event: offer.event } });
}
export function revealPairedIxNexusSkillsModulesBattle(f: PairedIxNexusSkillsModulesFixture,
  options: { state?: Game; cunning?: boolean; plans?: PairedIxNexusSkillsModulesStep[] } = {}): Game {
  let game = preparePairedIxNexusSkillsModulesBattle(f, options.state ?? f.game);
  if (options.cunning) game = advancePairedIxNexusSkillsModules(beginPairedIxNexusSkillsModulesCunning(f, game), clean);
  for (const step of options.plans ?? f.planActions) {
    game = stepPairedIxNexusSkillsModules(game, step);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') game = stepPairedIxNexusSkillsModules(game);
  }
  assert.ok(game.battle?.revealed); return game;
}
export type PairedIxNexusSkillsModulesBoundary = 'losses' | 'rescue' | 'substitution' | 'cards' | 'tech' | 'faceDance' | 'complete';
/** `tech` stops at a real mandatory chooser if one exists. A singleton reward
 * transfers automatically, so its observable boundary is the following actual
 * Face Dance (or completed aftermath), never a manufactured extra decision. */
export function finishPairedIxNexusSkillsModulesBattle(state: Game,
  stop: PairedIxNexusSkillsModulesBoundary = 'complete'): Game {
  const kinds: Record<PairedIxNexusSkillsModulesBoundary, string> = {
    losses: 'battleLosses', rescue: 'sukRescue', substitution: 'ixSubstitution',
    cards: 'battleCards', tech: 'techToken', faceDance: 'faceDance', complete: '',
  };
  return advancePairedIxNexusSkillsModules(state, g =>
    g.decision?.kind === kinds[stop] ||
    stop === 'tech' && g.decision?.kind === 'faceDance' && !g.pendingTech ||
    !g.battle && clean(g) && !g.pendingTreacheryDiscard);
}
export function finishPairedIxNexusSkillsModulesTurn(state: Game): Game {
  return advancePairedIxNexusSkillsModules(state, g => g.turn > state.turn);
}
/** Actual skill posture and actual native Cunning force flags, not inferred cap arithmetic. */
export function quotePairedIxNexusSkillsModulesBattle(game: Game) {
  const battle = game.battle; assert.ok(battle?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const p = pairedIxNexusSkillsModulesPlayer(game, actor), view = viewGame(game, actor).battle!; assert.ok(view.ownForces);
    return { id: actor, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand, plan: battle.plans[actor],
      leader: p.leaders.find(l => l.id === battle.plans[actor].leader), forces: view.ownForces,
      stronghold: view.strongholdEffects[actor], leaderSkills: game.leaderSkills!.assignments.filter(a => a.owner === actor)
        .map(a => ({ skill: a.skill, leader: a.leader, faceUp: !battle.leaderSkillHidden?.[actor], captured: false })) };
  };
  return quoteBattleResolution({ advanced: game.advanced, turn: game.turn, territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor, attacker: side(battle.attacker), defender: side(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map(actor => ({ id: actor,
      beneficiary: [battle.attacker, battle.defender].includes(actor) ? actor : pairedIxNexusSkillsModulesPlayer(game, actor).ally!,
      called: battle.traitorCalls[actor] ?? false, traitors: pairedIxNexusSkillsModulesPlayer(game, actor).traitors })),
    participants: game.players, physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false });
}

/** Source facts are observations, never prescribed ownership/effects. */
export function pairedIxNexusSkillsModulesSourceFacts(game: Game, staging: string[] = []): PairedIxNexusSkillsModulesSourceFacts {
  return {
    sources: PAIRED_IX_NEXUS_SKILLS_MODULES_SOURCES,
    staging: [...staging], turn: game.turn, phase: game.phase,
    cardOwners: game.strongholdCards ? { ...game.strongholdCards.owners } : null,
    controllers: strongholdControllers(game.players, !!game.mobileStronghold?.location),
    tech: game.techTokens ? structuredClone(game.techTokens) : null,
    stock: game.players.map(p => ({ player: p.id, faceDancers: structuredClone(p.faceDancers ?? []) })),
    physicalForces: game.players.map(p => ({ player: p.id, reserves: p.reserves, tanks: p.tanks,
      forces: { ...p.forces }, elites: structuredClone(p.elites) })),
  };
}
