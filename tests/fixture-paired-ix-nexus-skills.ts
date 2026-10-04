import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { territory } from '../game/board';
import type { Card } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { pairedNexusLeaderSkillsProfile } from '../game/leader-skill-profile';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { traitorDeck } from '../game/traitors';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type PairedIxNexusSkillsStep = { actor: string; action: Action };
export type PairedIxNexusSkillsOptions = {
  /** Genuine fresh lobby or original turn-one/phase-zero setup with zero assignments.
   * Existing first hands, offers, actor IDs and stock are authoritative. */
  initial?: Game;
  advanced?: boolean;
  program?: 'suboids' | 'faceDance';
  skill?: LeaderSkillId;
  band?: 'normal' | 'skilled';
  dial?: number;
  support?: number;
  secondBattle?: boolean;
};
export type PairedIxNexusSkillsFixture = {
  initial: Game;
  offered: Game;
  afterSetup: Game;
  afterFirstStorm: Game;
  beforeFirstMentat: Game;
  firstMentatStep: PairedIxNexusSkillsStep;
  afterFirstMentat: Game;
  beforeAlliance: Game;
  allianceActions: PairedIxNexusSkillsStep[];
  beforeNexusDraw: Game;
  drawActions: PairedIxNexusSkillsStep[];
  afterNexusDraw: Game;
  beforeBattle: Game;
  battleStep: PairedIxNexusSkillsStep;
  game: Game;
  ixians: string;
  tleilaxu: string;
  opponent: string;
  partners: [string, string];
  trainer: string;
  skill: LeaderSkillId;
  band: 'normal' | 'skilled';
  program: 'suboids' | 'faceDance';
  kind: 'arrakeen' | 'sietch_tabr';
  location: string;
  replacementSource: string;
  secondLocation?: string;
  planActions: PairedIxNexusSkillsStep[];
  actions: PairedIxNexusSkillsStep[];
  staging: string[];
};
export function pairedIxNexusSkillsPlayer(game: Game, actor: string): Player {
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
export function nextPairedIxNexusSkillsStep(game: Game): PairedIxNexusSkillsStep | null {
  if (clean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const phase = game.nexusCards.phase, actor = phase.eligible.find(id => !phase.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor] ?? null, choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.phaseOpening && !game.response) {
    const d = game.decision;
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
export function stepPairedIxNexusSkills(game: Game, step = nextPairedIxNexusSkillsStep(game)): Game {
  assert.ok(step, 'Original human plan or matching-stock Face Dance is required');
  return entropy(() => applyAction(game, step.actor, step.action));
}
export function advancePairedIxNexusSkills(state: Game, until: (game: Game) => boolean,
  actions: PairedIxNexusSkillsStep[] = []): Game {
  let game = structuredClone(state);
  for (let i = 0; i < 2400; i++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextPairedIxNexusSkillsStep(game); assert.ok(step, 'Native explicit human choice before requested boundary');
    actions.push(structuredClone(step)); game = stepPairedIxNexusSkills(game, step);
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
  const p = pairedIxNexusSkillsPlayer(game, actor);
  assert.ok(total >= elite && p.reserves - (p.elites?.reserves ?? 0) >= total - elite && (p.elites?.reserves ?? 0) >= elite);
  p.reserves -= total; p.forces[key] = (p.forces[key] ?? 0) + total;
  if (elite) { p.elites!.reserves -= elite; p.elites!.forces[key] = (p.elites!.forces[key] ?? 0) + elite; }
}
function hold(game: Game, actor: string, kind: Card['kind'], staging: string[]): string {
  const p = pairedIxNexusSkillsPlayer(game, actor), held = p.hand.find(c => c.kind === kind);
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
/** Original 47/14/12 native setup → Storm → real Mentat → conserved worm →
 * real alliance → real closing native draws. Board/card relocation is explicit;
 * wallets, phases, turns, effects, stock and sealed plans are never assigned. */
export function createPairedIxNexusSkillsFixture(options: PairedIxNexusSkillsOptions = {}): PairedIxNexusSkillsFixture {
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const program = options.program ?? 'suboids', band = options.band ?? 'skilled';
  let game = options.initial ? structuredClone(options.initial)
    : createGame('PAIREDIXNEXUSSKILLS', newPlayer('ixians', 'Ixians', 'ixians'), advanced, ['ix']);
  if (!options.initial) for (const faction of ['tleilaxu', 'guild', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['ix']);
  assert.ok(!game.techTokens && !game.strongholdCards && !game.homeworlds);
  assert.ok(game.players.length >= 4 && game.players.length <= 6,
    'Both native Cunning draws require two separate classic alliance partners; use four through six original seats');
  const ixians = game.players.find(p => p.faction === 'ixians')?.id;
  const tleilaxu = game.players.find(p => p.faction === 'tleilaxu')?.id;
  assert.ok(ixians && tleilaxu);
  const classics = game.players.filter(p => p.id !== ixians && p.id !== tleilaxu);
  const opponent = classics.find(p => p.faction === 'guild')?.id ?? classics[0].id;
  const partners: [string, string] = [classics[0].id, classics[1].id];
  const actions: PairedIxNexusSkillsStep[] = [], staging: string[] = [];
  const requested = options.skill ?? 'suk-graduate';
  const passives: LeaderSkillId[] = (['sandmaster', 'smuggler', 'rihani-decipherer', 'prana-bindu-adept', 'killer-medic', 'master-of-assassins'] as LeaderSkillId[])
    .filter(skill => skill !== requested);
  const selected = game.players.map(p => p.id === ixians ? requested : passives.shift()!);
  const supplied = !!options.initial;
  const initial = structuredClone(game);
  if (game.status === 'lobby') {
    assert.ok(!game.leaderSkills, 'Original all14 custody cannot be replaced');
    game.nexusCards ??= { cards: null, phase: null };
    assert.deepEqual(game.nexusCards, { cards: null, phase: null });
    for (const p of game.players) if (!p.ready) {
      const step: PairedIxNexusSkillsStep = { actor: p.id, action: { type: 'ready' } };
      actions.push(step); game = stepPairedIxNexusSkills(game, step);
    }
    game = entropy(() => initializeLeaderSkillsGameForAudit(game), skillRolls(selected));
    staging.push('Scoped original all14 shuffle selects native offers before starting Treachery deals; no offers are replaced');
  }
  assert.ok(pairedNexusLeaderSkillsProfile(game));
  assert.equal(game.status, 'setup'); assert.equal(game.turn, 1); assert.equal(game.phase, 0);
  assert.equal(game.leaderSkills!.assignments.length, 0);
  let offered = structuredClone(game), trainer = '';
  for (let i = 0; game.status === 'setup' && i < 240; i++) {
    let step: PairedIxNexusSkillsStep;
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
      const leader = pairedIxNexusSkillsPlayer(game, actor).leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader);
      if (actor === ixians) trainer = leader.id;
      step = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    } else {
      const native = nextPairedIxNexusSkillsStep(game); assert.ok(native); step = native;
      if (!supplied && game.setupStage === 'traitors' && step.action.type === 'traitor') {
        const choices = pairedIxNexusSkillsPlayer(game, step.actor).traitorChoices;
        const card = choices.find(id => id !== trainer); assert.ok(card); step.action.leader = card;
      }
    }
    actions.push(structuredClone(step));
    if (!supplied && game.setupStage === 'forces') {
      const held = new Set(game.players.flatMap(p => p.traitors));
      const source = traitorDeck(game.players, true).filter(id => !held.has(id));
      assert.ok(source.includes(trainer), 'Original trained Ix identity must remain undealt');
      game = entropy(() => applyAction(game, step.actor, step.action), shuffleRolls(source, [trainer, ...source.filter(id => id !== trainer)]));
    } else game = supplied ? applyAction(game, step.actor, step.action) : stepPairedIxNexusSkills(game, step);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === ixians)!;
  trainer = assignment.leader; const skill = assignment.skill;
  game = advancePairedIxNexusSkills(game, g => g.phase === 1 && clean(g), actions);
  const afterFirstStorm = structuredClone(game);
  orderSpice(game, ['land', 'land'], staging);
  game = advancePairedIxNexusSkills(game, g => g.phase === 5 && clean(g), actions);
  reserveBoard(game); staging.push('After native starting placements: conserved board counters returned to original reserves before first movement completion');
  game = advancePairedIxNexusSkills(game, g => g.phase === 8 && clean(g), actions);
  let beforeFirstMentat!: Game, firstMentatStep!: PairedIxNexusSkillsStep;
  while (game.turn === 1) {
    const step = nextPairedIxNexusSkillsStep(game); assert.ok(step);
    const before = structuredClone(game); actions.push(structuredClone(step)); game = stepPairedIxNexusSkills(game, step);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = step; }
  }
  const afterFirstMentat = structuredClone(game);
  game = advancePairedIxNexusSkills(game, g => g.phase === 1 && clean(g), actions);
  orderSpice(game, ['worm', 'land', 'land'], staging);
  game = advancePairedIxNexusSkills(game, g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && clean(g), actions);
  const beforeAlliance = structuredClone(game);
  const allianceActions: PairedIxNexusSkillsStep[] = partners.map((actor, i) => ({ actor, action: { type: 'alliance', target: partners[1 - i] } }));
  for (const step of allianceActions) { actions.push(step); game = stepPairedIxNexusSkills(game, step); }
  game = advancePairedIxNexusSkills(game, g => g.nexusCards?.phase?.stage === 'drawing', actions);
  const cards = game.nexusCards!.cards!;
  assert.ok(cards.deck.includes('ixians') && cards.deck.includes('tleilaxu'));
  cards.deck = ['ixians', 'tleilaxu', ...cards.deck.filter(c => c !== 'ixians' && c !== 'tleilaxu')];
  staging.push('Order conserved unused Ix/Tleilaxu Nexus singletons; only real closing draws grant the two native hands');
  const beforeNexusDraw = structuredClone(game);
  const drawActions: PairedIxNexusSkillsStep[] = [ixians, tleilaxu].map(actor => ({ actor,
    action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[actor], choice: 'draw', ownRedraws: 0 } }));
  for (const step of drawActions) { actions.push(step); game = stepPairedIxNexusSkills(game, step); }
  game = advancePairedIxNexusSkills(game, g => g.nexusCards?.phase?.stage !== 'drawing', actions);
  const afterNexusDraw = structuredClone(game);
  game = advancePairedIxNexusSkills(game, g => g.phase === 5 && clean(g), actions);
  reserveBoard(game);
  const kind = program === 'faceDance' ? 'sietch_tabr' : 'arrakeen';
  const location = `${kind}:${territory(kind).sectors[0]}`, replacementSource = `arrakeen:${territory('arrakeen').sectors[0]}`;
  place(game, ixians, location, 6, 3); place(game, opponent, location, 6);
  if (program === 'faceDance') place(game, tleilaxu, replacementSource, 3);
  const secondLocation = options.secondBattle ? `carthag:${territory('carthag').sectors[0]}` : undefined;
  if (secondLocation) { place(game, ixians, secondLocation, 3); place(game, opponent, secondLocation, 2); }
  staging.push('Before native movement completion: conserved six Ix counters (three Cyborg/three Suboid), six ordinary opponents and optional physical replacement/second-battle sources; no phase, wallet or stock mutation');
  const ix = pairedIxNexusSkillsPlayer(game, ixians), stock = pairedIxNexusSkillsPlayer(game, tleilaxu).faceDancers!;
  const untrained = (p: Player) => p.leaders.filter(l => !l.dead && !l.usedAt && !l.gholaBy && !l.capturedBy &&
    !game.leaderSkills!.assignments.some(a => a.leader === l.id));
  const leader = band === 'skilled' ? ix.leaders.find(l => l.id === trainer)! : untrained(ix)
    .filter(l => program !== 'faceDance' || stock.some(c => c.leader === l.id && !c.revealed)).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(leader && (program !== 'faceDance' || stock.some(c => c.leader === leader.id && !c.revealed)),
    'Infeasible original stock: this band requires a matching living original Ix disc; no stock is fabricated or exchanged');
  const enemy = untrained(pairedIxNexusSkillsPlayer(game, opponent)).sort((a, b) => a.strength - b.strength)[0]; assert.ok(enemy);
  const weapon = skill === 'warmaster' ? hold(game, ixians, 'worthless', staging)
    : program === 'faceDance' ? hold(game, ixians, 'projectile', staging) : null;
  const defense = program === 'faceDance' ? hold(game, ixians, 'shield', staging) : null;
  game = advancePairedIxNexusSkills(game, g => g.phase === 6 && clean(g), actions);
  const beforeBattle = structuredClone(game), actor = game.active!; assert.ok(actor === ixians || actor === opponent);
  const battleStep: PairedIxNexusSkillsStep = { actor, action: { type: 'chooseBattle', territory: kind, target: actor === ixians ? opponent : ixians } };
  actions.push(battleStep); game = stepPairedIxNexusSkills(game, battleStep);
  const planActions: PairedIxNexusSkillsStep[] = [
    { actor: ixians, action: { type: 'battlePlan', leader: leader.id, dial: options.dial ?? (advanced ? 4 : 6),
      support: advanced ? options.support ?? 1 : 0, weapon, defense } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 0, support: 0, weapon: null, defense: null } },
  ];
  return { initial, offered, afterSetup, afterFirstStorm, beforeFirstMentat, firstMentatStep, afterFirstMentat,
    beforeAlliance, allianceActions, beforeNexusDraw, drawActions, afterNexusDraw, beforeBattle, battleStep,
    game, ixians, tleilaxu, opponent, partners, trainer, skill, band, program, kind, location, replacementSource,
    secondLocation, planActions, actions, staging };
}
export function preparePairedIxNexusSkillsBattle(f: PairedIxNexusSkillsFixture, state = f.game): Game {
  let game = structuredClone(state);
  for (let i = 0; i < 160; i++) {
    const step = nextPairedIxNexusSkillsStep(game);
    if (!step) { assert.ok(game.battle && !game.battle.revealed); return game; }
    if (step.action.type === 'leaderSkillVisibility') step.action.hide = step.actor === f.ixians && f.band === 'skilled';
    game = stepPairedIxNexusSkills(game, step);
  }
  throw Error('Paired E1 native skill posture did not reach private plans');
}
export function beginPairedIxNexusSkillsCunning(f: PairedIxNexusSkillsFixture, state = preparePairedIxNexusSkillsBattle(f)): Game {
  const offer = viewGame(state, f.ixians).nexusSuboids?.offer;
  assert.ok(offer); assert.equal(offer.blocked, null);
  return stepPairedIxNexusSkills(state, { actor: f.ixians, action: { type: 'nexusSuboids', event: offer.event } });
}
export function revealPairedIxNexusSkillsBattle(f: PairedIxNexusSkillsFixture,
  options: { state?: Game; cunning?: boolean; plans?: PairedIxNexusSkillsStep[] } = {}): Game {
  let game = preparePairedIxNexusSkillsBattle(f, options.state ?? f.game);
  if (options.cunning) game = advancePairedIxNexusSkills(beginPairedIxNexusSkillsCunning(f, game), clean);
  for (const step of options.plans ?? f.planActions) {
    game = stepPairedIxNexusSkills(game, step);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') game = stepPairedIxNexusSkills(game);
  }
  assert.ok(game.battle?.revealed); return game;
}
export function finishPairedIxNexusSkillsBattle(state: Game,
  stop: 'losses' | 'rescue' | 'substitution' | 'cards' | 'faceDance' | 'complete' = 'complete'): Game {
  const kinds = { losses: 'battleLosses', rescue: 'sukRescue', substitution: 'ixSubstitution', cards: 'battleCards', faceDance: 'faceDance', complete: '' };
  return advancePairedIxNexusSkills(state, g => g.decision?.kind === kinds[stop] || !g.battle && clean(g) && !g.pendingTreacheryDiscard);
}
export function finishPairedIxNexusSkillsTurn(state: Game): Game {
  return advancePairedIxNexusSkills(state, g => g.turn > state.turn);
}
export function choosePairedIxNexusSkillsSecondBattle(f: PairedIxNexusSkillsFixture, state: Game): Game {
  assert.ok(f.secondLocation);
  let game = advancePairedIxNexusSkills(state, g => g.phase === 6 && clean(g) && !!g.active);
  const actor = game.active!; assert.ok(actor === f.ixians || actor === f.opponent);
  game = stepPairedIxNexusSkills(game, { actor, action: { type: 'chooseBattle', territory: 'carthag', target: actor === f.ixians ? f.opponent : f.ixians } });
  return preparePairedIxNexusSkillsBattle(f, game);
}
export function preparePairedIxNexusSkillsExpiryBattle(f: PairedIxNexusSkillsFixture, state: Game): Game {
  let game = advancePairedIxNexusSkills(state, g => g.phase === 5 && clean(g));
  reserveBoard(game); place(game, f.ixians, f.location, 3); place(game, f.tleilaxu, f.location, 2);
  game = advancePairedIxNexusSkills(game, g => g.phase === 6 && clean(g));
  const actor = game.active!; assert.ok(actor === f.ixians || actor === f.tleilaxu);
  game = stepPairedIxNexusSkills(game, { actor, action: { type: 'chooseBattle', territory: f.kind, target: actor === f.ixians ? f.tleilaxu : f.ixians } });
  return preparePairedIxNexusSkillsBattle(f, game);
}
/** Actual skill posture and actual native Cunning force flags, not inferred cap arithmetic. */
export function quotePairedIxNexusSkillsBattle(game: Game) {
  const battle = game.battle; assert.ok(battle?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const p = pairedIxNexusSkillsPlayer(game, actor), view = viewGame(game, actor).battle!; assert.ok(view.ownForces);
    return { id: actor, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand, plan: battle.plans[actor],
      leader: p.leaders.find(l => l.id === battle.plans[actor].leader), forces: view.ownForces,
      stronghold: view.strongholdEffects[actor], leaderSkills: game.leaderSkills!.assignments.filter(a => a.owner === actor)
        .map(a => ({ skill: a.skill, leader: a.leader, faceUp: !battle.leaderSkillHidden?.[actor], captured: false })) };
  };
  return quoteBattleResolution({ advanced: game.advanced, turn: game.turn, territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor, attacker: side(battle.attacker), defender: side(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map(actor => ({ id: actor,
      beneficiary: [battle.attacker, battle.defender].includes(actor) ? actor : pairedIxNexusSkillsPlayer(game, actor).ally!,
      called: battle.traitorCalls[actor] ?? false, traitors: pairedIxNexusSkillsPlayer(game, actor).traitors })),
    participants: game.players, physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false });
}
