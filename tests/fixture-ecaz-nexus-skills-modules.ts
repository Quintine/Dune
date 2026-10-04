import assert from 'node:assert/strict';
import { applyAction, createGame, handLimit, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { territory } from '../game/board';
import type { FactionId } from '../game/catalog';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { strongholdControllers, type StrongholdId } from '../game/stronghold-cards';
import { ownedTech } from '../game/tech-tokens';
import type { Card } from '../game/cards';
import { initializeAdvancedNativeSkillsSetup } from './fixture-advanced-native-skills';
import {
  assertEcazSkillsModulesCustody, ecazSkillsModulesAction, ecazSkillsModulesPlayer,
  ecazSkillsModulesTrainer, nextEcazSkillsModulesStep, reloadEcazSkillsModules,
} from './fixture-ecaz-skills-modules';
import type { StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

/** Existing source composition, not an exceptional-Duke or allied-Occupy ruling.
 * GF9 E3 pp.3/8/11/16 and publisher Ecaz Nexus face: docs/NEXUS_ECAZ_RULES.md.
 * All14 normal/selected-disc effects: docs/LEADER_SKILLS_RULES.md.
 * Original held-card effects/lifecycle: docs/STRONGHOLD_CARDS.md.
 * The quiet living/unclaimed Duke window is the existing product boundary;
 * printed dead/captured/Ghola recovery and shared-Duke training remain pending.
 */
export const ECAZ_NEXUS_SKILLS_MODULES_SOURCES = {
  nexus: 'docs/NEXUS_ECAZ_RULES.md#bounded-native-cunning-duke-vidal',
  skills: 'docs/LEADER_SKILLS_RULES.md',
  modules: 'docs/STRONGHOLD_CARDS.md',
  publisher: 'https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf',
  face: 'https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani',
} as const;
export type EcazNexusSkillsModulesStep = StrongholdFactionsNativeStep;
export type EcazNexusSkillsModulesOptions = {
  /** Only the actual undealt lobby or original unassigned skill-first setup. */
  initial?: Game;
  rules?: 'basic' | 'advanced';
  tech?: boolean;
  stronghold?: boolean;
  skill?: LeaderSkillId;
  /** A genuine eligible native disc; never the separate Duke. */
  leader?: string;
  kind?: 'duke' | 'suk';
  band?: 'normal' | 'skilled';
  strongholdKind?: Exclude<StrongholdId, 'hidden_mobile_stronghold'>;
  poison?: boolean;
  defense?: boolean;
  ownerDial?: number;
  opponentDial?: number;
};
export type EcazNexusSkillsModulesTransition = {
  before: Game; step: EcazNexusSkillsModulesStep; after: Game;
};
export type EcazNexusSkillsModulesFixture = {
  initial: Game; offered: Game; afterSetup: Game; afterFirstStorm: Game;
  beforeFirstMentat: Game; firstMentatStep: EcazNexusSkillsModulesStep; afterFirstMentat: Game;
  beforeAlliance: Game; allianceActions: EcazNexusSkillsModulesStep[];
  closingDraw: EcazNexusSkillsModulesTransition;
  beforeCunning: Game; cunning: EcazNexusSkillsModulesTransition;
  beforeBattle: Game; posture: Game; game: Game;
  owner: string; opponent: string; observer: string; trainer: string;
  territory: Exclude<StrongholdId, 'hidden_mobile_stronghold'>; location: string;
  plans: EcazNexusSkillsModulesStep[]; actions: EcazNexusSkillsModulesStep[]; staging: string[];
};
export {
  ecazSkillsModulesAction as ecazNexusSkillsModulesAction,
  ecazSkillsModulesPlayer as ecazNexusSkillsModulesPlayer,
  ecazSkillsModulesTrainer as ecazNexusSkillsModulesTrainer,
  reloadEcazSkillsModules as reloadEcazNexusSkillsModules,
};
export const ecazNexusSkillsModulesClean = (g: Game): boolean => !g.response && !g.phaseOpening && !g.decision;

export function assertEcazNexusSkillsModulesCustody(game: Game): void {
  assertEcazSkillsModulesCustody(game);
  const skills = game.leaderSkills!;
  assert.deepEqual([...skills.deck, ...Object.values(skills.offers).flatMap(o => o.cards),
    ...skills.assignments.map(a => a.skill)].sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
  validateNexusCards(game.nexusCards!.cards!, game.players);
  const cards = game.nexusCards!.cards!;
  assert.deepEqual([...cards.deck, ...cards.discard,
    ...Object.values(cards.hands).filter((c): c is FactionId => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
}

export function nextEcazNexusSkillsModulesStep(game: Game): EcazNexusSkillsModulesStep | null {
  if (ecazNexusSkillsModulesClean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const phase = game.nexusCards.phase, actor = phase.eligible.find(id => !phase.done.includes(id));
    if (actor) return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'wormRide')
    return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  return nextEcazSkillsModulesStep(game);
}
export function stepEcazNexusSkillsModules(game: Game, next: EcazNexusSkillsModulesStep,
  actions?: EcazNexusSkillsModulesStep[]): Game {
  actions?.push(structuredClone(next));
  return ecazSkillsModulesAction(game, next.actor, next.action);
}
export function advanceEcazNexusSkillsModules(state: Game, until: (g: Game) => boolean,
  actions?: EcazNexusSkillsModulesStep[], firstDial = 0): Game {
  let game = reloadEcazSkillsModules(state);
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.equal(game.status, 'playing');
    const next = nextEcazNexusSkillsModulesStep(game);
    assert.ok(next, 'An actual private battle plan must be supplied by its owner.');
    if (game.turn === 1 && next.action.type === 'stormDial') next.action.amount = firstDial;
    game = stepEcazNexusSkillsModules(game, next, actions);
  }
  throw Error('Original Ecaz Nexus/Skills chronology did not reach its declared boundary.');
}

const CLASSIC_OPPONENTS: Partial<Record<FactionId, true>> = {
  atreides: true, emperor: true, guild: true, fremen: true, beneGesserit: true, harkonnen: true,
};
function lobby(options: EcazNexusSkillsModulesOptions): Game {
  const rules = options.rules ?? (options.initial?.advanced === false ? 'basic' : 'advanced');
  let game = options.initial ? reloadEcazSkillsModules(options.initial)
    : createGame('ECAZNEXUSSKILLSMODULES', newPlayer('ecaz', 'Ecaz', 'ecaz'), rules === 'advanced', ['ecaz']);
  if (!options.initial) for (const faction of ['emperor', 'atreides'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const tech = options.tech ?? (options.initial ? !!game.techTokens : true);
  const stronghold = options.stronghold ?? (options.initial ? !!game.strongholdCards : rules === 'advanced');
  assert.equal(game.advanced, rules === 'advanced');
  assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(game.players.length >= (tech ? 3 : 2) && game.players.length <= 6);
  assert.ok(!stronghold || game.advanced);
  assert.equal(game.players.filter(p => p.faction === 'ecaz').length, 1);
  assert.ok(game.players.every(p => p.faction === 'ecaz' ||
    CLASSIC_OPPONENTS[p.faction] === true && (!game.advanced || p.faction !== 'harkonnen')));
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    game.setupStage === 'leaderSkills' && game.leaderSkills?.assignments.length === 0,
  'Continue only an original undealt lobby or unassigned skill-first setup.');
  if (game.status === 'lobby') {
    if (!!game.techTokens !== tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: tech });
    if (!!game.strongholdCards !== stronghold) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: stronghold });
    // Same unused lobby-module declaration as the original Nexus/Skills fixtures.
    if (!game.nexusCards) game.nexusCards = { cards: null, phase: null };
  } else {
    assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, stronghold);
    assert.ok(game.nexusCards, 'Do not convert a dealt setup into a Nexus game.');
  }
  return game;
}
export function initializeEcazNexusSkillsModules(options: EcazNexusSkillsModulesOptions = {}): Game {
  const game = lobby(options);
  return initializeAdvancedNativeSkillsSetup({ family: 'ecaz', initial: game,
    rules: game.advanced ? 'advanced' : 'basic', requestedSkill: options.skill ?? (options.kind === 'suk' ? 'suk-graduate' : 'warmaster') });
}
/** Original own-seat offers/IDs are authoritative; a requested missing skill is
 * an error, never a redeal, a fallback assignment or a forged selected effect. */
export function completeEcazNexusSkillsModulesSetup(state: Game, options: EcazNexusSkillsModulesOptions = {},
  actions?: EcazNexusSkillsModulesStep[]): Game {
  let game = reloadEcazSkillsModules(state);
  const owner = game.players.find(p => p.faction === 'ecaz')!.id;
  const requested = options.skill ?? (options.kind === 'suk' ? 'suk-graduate' : 'warmaster');
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
      const offer = game.leaderSkills!.offers[actor];
      const skill = actor === owner ? requested : offer.cards.find(c => !own.unavailableSkills?.[c]);
      const eligible = new Set(own.eligibleLeaders.map(l => l.id));
      const discs = ecazSkillsModulesPlayer(game, actor).leaders.filter(l => eligible.has(l.id));
      const leader = actor === owner && options.leader ? discs.find(l => l.id === options.leader)
        : discs.sort((a, b) => b.strength - a.strength)[0];
      assert.ok(skill && offer.cards.includes(skill) && !own.unavailableSkills?.[skill] && leader);
      game = stepEcazNexusSkillsModules(game, { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } }, actions);
    } else {
      const next = nextEcazNexusSkillsModulesStep(game); assert.ok(next);
      game = stepEcazNexusSkillsModules(game, next, actions);
    }
  }
  assert.equal(game.status, 'playing');
  assertEcazNexusSkillsModulesCustody(game);
  return game;
}
function reserveBoard(game: Game, staging: string[]): void {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0); p.forces = {};
    if (p.elites) { p.elites.reserves += Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0); p.elites.forces = {}; }
    if (p.advisors) p.advisors = {};
  }
  staging.push('Conserve all native board counters into their own reserves; no wallet, phase, turn, module owner, skill, receipt or Duke custody is assigned.');
}
export function placeEcazNexusSkillsModulesForce(game: Game, actor: string, location: string, amount: number, staging: string[]): void {
  const p = ecazSkillsModulesPlayer(game, actor);
  assert.ok(Number.isSafeInteger(amount) && amount >= 0 && p.reserves >= amount);
  p.reserves -= amount; p.forces[location] = (p.forces[location] ?? 0) + amount;
  staging.push(`Conserved ${amount} ordinary ${actor} counters from their own reserves to ${location}.`);
}
function orderSpice(game: Game, kinds: ('worm' | 'land')[], staging: string[]): void {
  const front = kinds.map(kind => {
    const index = game.spiceDeck.findIndex(c => kind === 'worm' ? 'worm' in c : 'territory' in c); assert.ok(index >= 0);
    return game.spiceDeck.splice(index, 1)[0];
  });
  game.spiceDeck.unshift(...front);
  staging.push(`Order only existing unplayed original Spice Cards: ${kinds.join(', ')}; played discards remain unchanged.`);
}
export function holdEcazNexusSkillsModulesCard(game: Game, actor: string, predicate: (c: Card) => boolean, staging: string[]): Card {
  const p = ecazSkillsModulesPlayer(game, actor), held = p.hand.find(predicate);
  if (held) return held;
  const index = game.deck.findIndex(predicate); assert.ok(index >= 0 && p.hand.length < handLimit(p));
  const card = game.deck.splice(index, 1)[0]; p.hand.push(card);
  staging.push(`Conserved original Ecaz33 ${card.id} from the remaining physical deck to ${actor}'s hand.`);
  return card;
}
export function ecazNexusSkillsModulesCunningRequest(game: Game, owner: string): EcazNexusSkillsModulesStep {
  const offer = viewGame(game, owner).nexusEcazDuke; assert.ok(offer && offer.blocked === null);
  return { actor: owner, action: { type: 'nexusEcazDuke', event: offer.event } };
}
/** Stop before the actual human posture choice, never manufacture visibility. */
export function openEcazNexusSkillsModulesPosture(game: Game, owner: string, opponent: string,
  stronghold: string, actions?: EcazNexusSkillsModulesStep[]): Game {
  assert.ok(game.phase === 6 && ecazNexusSkillsModulesClean(game) && !game.battle);
  assert.ok(game.active === owner || game.active === opponent);
  const opened = stepEcazNexusSkillsModules(game, { actor: game.active!, action: {
    type: 'chooseBattle', territory: stronghold, target: game.active === owner ? opponent : owner } }, actions);
  return advanceEcazNexusSkillsModules(opened, g => g.decision?.kind === 'leaderSkillVisibility', actions);
}
export function advanceEcazNexusSkillsModulesToPlans(game: Game, actions?: EcazNexusSkillsModulesStep[]): Game {
  return advanceEcazNexusSkillsModules(game, g => !!g.battle && ecazNexusSkillsModulesClean(g) &&
    !g.battle.preparation && g.battle.preLeader?.closed !== false, actions);
}
export function revealEcazNexusSkillsModulesBattle(game: Game, plans: readonly EcazNexusSkillsModulesStep[],
  actions?: EcazNexusSkillsModulesStep[]): Game {
  let state = reloadEcazSkillsModules(game);
  for (const plan of plans) {
    state = stepEcazNexusSkillsModules(state, plan, actions);
    if (!state.battle?.revealed) state = advanceEcazNexusSkillsModulesToPlans(state, actions);
  }
  assert.ok(state.battle?.revealed);
  return state;
}
export function settleEcazNexusSkillsModulesBattle(game: Game,
  stop: 'suk' | 'cards' | 'tech' | 'complete' = 'complete', actions?: EcazNexusSkillsModulesStep[]): Game {
  return advanceEcazNexusSkillsModules(game, g =>
    stop === 'suk' && g.decision?.kind === 'sukRescue' ||
    stop === 'cards' && g.decision?.kind === 'battleCards' ||
    stop === 'tech' && g.decision?.kind === 'techToken' ||
    !g.battle && ecazNexusSkillsModulesClean(g) && !g.pendingTreacheryDiscard, actions);
}
/** Native immutable source facts: no computed/fabricated matching stock. */
export function ecazNexusSkillsModulesSourceFacts(game: Game, owner: string, opponent: string) {
  const p = ecazSkillsModulesPlayer(game, owner), enemy = ecazSkillsModulesPlayer(game, opponent);
  return structuredClone({
    turn: game.turn, phase: game.phase, advanced: game.advanced,
    duke: game.dukeVidal, assignment: ecazSkillsModulesTrainer(game, owner),
    nativeLeaders: p.leaders, ownWallet: p.spice, enemyWallet: enemy.spice,
    ownForces: p.forces, enemyForces: enemy.forces, ownReserves: p.reserves,
    ownTanks: p.tanks, enemyTanks: enemy.tanks, ownHand: p.hand, enemyHand: enemy.hand,
    heldCards: game.strongholdCards?.owners, controls: strongholdControllers(game.players, false),
    enemyTech: ownedTech(game.techTokens, opponent), plans: game.battle?.plans,
    losses: game.pendingSukRescue?.losses, battle: game.lastBattleContext,
  });
}
export const ecazNexusSkillsModulesCurrentControl = (game: Game) => strongholdControllers(game.players, false);
/** Genuine turn-end readiness, including ordinary set-aside clearing and unused
 * Nexus tenure expiry. No phase/turn or custody jump is permitted. */
export function expireEcazNexusSkillsModulesDuke(game: Game, actions?: EcazNexusSkillsModulesStep[]): Game {
  const turn = game.turn;
  return advanceEcazNexusSkillsModules(game, g => g.turn > turn, actions);
}

/** Native setup -> first Storm -> actual END Mentat -> actual worm/alliance ->
 * closing Ecaz draw -> quiet Battle -> living/unclaimed Cunning. Conserved
 * staging is labeled below, not claimed to be natural random play history.
 * Three seats are needed for a real alliance plus one unallied draw; two-seat
 * original setup is supported by initialize/complete, never by a forged draw. */
export function createEcazNexusSkillsModulesFixture(options: EcazNexusSkillsModulesOptions = {}): EcazNexusSkillsModulesFixture {
  const actions: EcazNexusSkillsModulesStep[] = [], staging: string[] = [];
  const initial = lobby(options), offered = initializeEcazNexusSkillsModules({ ...options, initial });
  let game = completeEcazNexusSkillsModulesSetup(offered, options, actions);
  const afterSetup = reloadEcazSkillsModules(game);
  const owner = game.players.find(p => p.faction === 'ecaz')!.id;
  const opponents = game.players.filter(p => p.id !== owner);
  const opponent = (opponents.find(p => p.faction === 'emperor') ?? opponents[0]).id;
  const observer = opponents.find(p => p.id !== opponent)?.id;
  assert.ok(observer, 'A genuine alliance and unallied Ecaz closing draw require three real seats.');
  const trainer = ecazSkillsModulesTrainer(game, owner).leader;
  const strongholdKind = options.strongholdKind ?? 'arrakeen';
  const location = `${strongholdKind}:${territory(strongholdKind).sectors[0]}`;
  const firstDial = ['tueks_sietch', 'habbanya_ridge_sietch'].includes(strongholdKind) ? 4 : 0;
  reserveBoard(game, staging);
  game = advanceEcazNexusSkillsModules(game, g => g.phase === 1 && ecazNexusSkillsModulesClean(g), actions, firstDial);
  const afterFirstStorm = reloadEcazSkillsModules(game);
  orderSpice(game, ['land', 'land'], staging);
  game = advanceEcazNexusSkillsModules(game, g => g.phase === 8 && ecazNexusSkillsModulesClean(g), actions);
  reserveBoard(game, staging); placeEcazNexusSkillsModulesForce(game, owner, location, 1, staging);
  let beforeFirstMentat: Game | undefined, firstMentatStep: EcazNexusSkillsModulesStep | undefined;
  for (let count = 0; game.turn === 1 && count < 200; count++) {
    const before = reloadEcazSkillsModules(game), next = nextEcazNexusSkillsModulesStep(game); assert.ok(next);
    game = stepEcazNexusSkillsModules(game, next, actions);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  if (game.strongholdCards) assert.equal(game.strongholdCards.owners[strongholdKind], owner);
  const afterFirstMentat = reloadEcazSkillsModules(game);
  game = advanceEcazNexusSkillsModules(game, g => g.phase === 1 && ecazNexusSkillsModulesClean(g), actions);
  orderSpice(game, ['worm', 'land', 'land'], staging);
  game = advanceEcazNexusSkillsModules(game, g => g.nexus === true && !g.spiceWindow && !g.spiceResolution && ecazNexusSkillsModulesClean(g), actions);
  const beforeAlliance = reloadEcazSkillsModules(game), allianceActions: EcazNexusSkillsModulesStep[] = [
    { actor: opponent, action: { type: 'alliance', target: observer } },
    { actor: observer, action: { type: 'alliance', target: opponent } },
  ];
  for (const next of allianceActions) game = stepEcazNexusSkillsModules(game, next, actions);
  game = advanceEcazNexusSkillsModules(game, g => g.nexusCards?.phase?.stage === 'drawing' && ecazNexusSkillsModulesClean(g), actions);
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('ecaz'); assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  staging.push('Order the unused original Ecaz Nexus singleton first immediately before its genuine closing draw; no Nexus hand is assigned.');
  const drawBefore = reloadEcazSkillsModules(game), drawStep: EcazNexusSkillsModulesStep = { actor: owner,
    action: { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } };
  game = stepEcazNexusSkillsModules(game, drawStep, actions);
  const closingDraw = { before: drawBefore, step: drawStep, after: reloadEcazSkillsModules(game) };
  game = advanceEcazNexusSkillsModules(game, g => g.phase === 5 && ecazNexusSkillsModulesClean(g), actions);
  reserveBoard(game, staging);
  for (const actor of [owner, opponent]) placeEcazNexusSkillsModulesForce(game, actor, location, 8, staging);
  // Only controlled battle positions move native cards; fresh CLI deals and
  // own-seat offers above remain authoritative and are exported unchanged.
  for (const p of game.players) { game.deck.push(...p.hand); p.hand = []; }
  staging.push('Before the real Movement closes, return original hands to the same Ecaz33 physical deck, then transfer only the requested native battle cards.');
  const worthless = holdEcazNexusSkillsModulesCard(game, owner, c => c.kind === 'worthless', staging);
  const shield = options.defense ? holdEcazNexusSkillsModulesCard(game, owner, c => c.kind === 'shield', staging) : undefined;
  const poison = options.poison ? holdEcazNexusSkillsModulesCard(game, opponent, c => c.kind === 'poison', staging) : undefined;
  game = advanceEcazNexusSkillsModules(game, g => g.phase === 6 && ecazNexusSkillsModulesClean(g), actions);
  const beforeCunning = reloadEcazSkillsModules(game), cunningStep = ecazNexusSkillsModulesCunningRequest(game, owner);
  assert.equal(game.dukeVidal!.controller, null);
  game = stepEcazNexusSkillsModules(game, cunningStep, actions);
  const cunning = { before: beforeCunning, step: cunningStep, after: reloadEcazSkillsModules(game) };
  const beforeBattle = reloadEcazSkillsModules(game);
  game = openEcazNexusSkillsModulesPosture(game, owner, opponent, strongholdKind, actions);
  const posture = reloadEcazSkillsModules(game), band = options.band ?? (options.kind === 'suk' ? 'skilled' : 'normal');
  for (let count = 0; count < 200; count++) {
    if (game.battle && ecazNexusSkillsModulesClean(game) && !game.battle.preparation && game.battle.preLeader?.closed !== false) break;
    const next = nextEcazNexusSkillsModulesStep(game); assert.ok(next);
    if (next.action.type === 'leaderSkillVisibility' && next.actor === owner) next.action.hide = band === 'skilled';
    game = stepEcazNexusSkillsModules(game, next, actions);
  }
  assert.ok(game.battle && ecazNexusSkillsModulesClean(game) && !game.battle.preparation && game.battle.preLeader?.closed !== false);
  const enemy = ecazSkillsModulesPlayer(game, opponent), enemyTrainer = ecazSkillsModulesTrainer(game, opponent).leader;
  const defender = enemy.leaders.filter(l => !l.dead && l.id !== enemyTrainer).sort((a, b) =>
    options.kind === 'suk' ? a.strength - b.strength : b.strength - a.strength)[0]; assert.ok(defender);
  const ownLeader = options.kind === 'suk' ? band === 'skilled' ? trainer
    : ecazSkillsModulesPlayer(game, owner).leaders.find(l => l.strength === 4 && l.id !== trainer)!.id : DUKE_VIDAL_ID;
  const ownerDial = options.ownerDial ?? (options.kind === 'suk' ? 5 : 0);
  const opponentDial = options.opponentDial ?? (options.kind === 'suk' ? 0 : game.battle.attacker === owner ? 2 : 1);
  const plans: EcazNexusSkillsModulesStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: ownLeader, dial: ownerDial,
      support: game.advanced ? ownerDial : 0, weapon: worthless.id, defense: shield?.id } },
    { actor: opponent, action: { type: 'battlePlan', leader: defender.id, dial: opponentDial,
      support: game.advanced ? opponentDial : 0, weapon: poison?.id } },
  ];
  assertEcazNexusSkillsModulesCustody(game);
  return { initial, offered, afterSetup, afterFirstStorm, beforeFirstMentat, firstMentatStep, afterFirstMentat,
    beforeAlliance, allianceActions, closingDraw, beforeCunning, cunning, beforeBattle, posture, game,
    owner, opponent, observer, trainer, territory: strongholdKind, location, plans, actions, staging };
}
