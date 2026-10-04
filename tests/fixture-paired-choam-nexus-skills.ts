import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type GameView, type Player,
} from '../game/engine';
import { gameDistance, splitLocation, TERRITORIES, territory } from '../game/board';
import { treacheryDeck, type Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { pairedNexusLeaderSkillsProfile } from '../game/leader-skill-profile';
import { validateLeaderSkills } from '../game/leader-skills';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { richeseCards } from '../game/richese-cards';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { nextNativeSkillsStrongholdStep } from './fixture-native-skills-stronghold';

export type PairedChoamNexusSkillsStep = { actor: string; action: Action };
export type PairedChoamNexusSkillsOptions = {
  /** Original fresh lobby OR initialized turn-one setup; retain hands, offers and IDs. */
  initial?: Game;
  advanced?: boolean;
  /** Fresh-lobby roster only. Setup supports every original two-to-six-seat pair. */
  factions?: readonly FactionId[];
  seatIds?: readonly string[];
  /** Omit on a supplied setup to choose its actual available offer, never replace it. */
  richeseSkill?: LeaderSkillId;
  choamSkill?: LeaderSkillId;
  reserveCap?: number;
};
export type PairedChoamNexusSkillsFixture = {
  initial: Game;
  afterSetup: Game;
  afterFirstStorm: Game;
  firstShipment: { before: Game; step: PairedChoamNexusSkillsStep; after: Game };
  beforeFirstMentat: Game;
  firstMentatStep: PairedChoamNexusSkillsStep;
  afterFirstMentat: Game;
  beforeAlliance: Game;
  allianceActions: PairedChoamNexusSkillsStep[];
  beforeClosingDraw: Game;
  closingDraws: { before: Game; step: PairedChoamNexusSkillsStep; after: Game }[];
  movementStart: Game;
  game: Game;
  richese: string;
  choam: string;
  guild: string;
  observer: string;
  location: string;
  trainers: { richese: string; choam: string };
  actions: PairedChoamNexusSkillsStep[];
  staging: string[];
};
export const pairedSkillsSnapshot = (game: Game): Game => structuredClone(game);
export const pairedSkillsClean = (game: Game): boolean => !game.phaseOpening && !game.response && !game.decision;
export function pairedSkillsPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing original paired E2 skill actor ${actor}`);
  return player;
}

/** Control only the original all14 shuffle before native starting deals. Generic
 * requests use the bound native method and still return the supplied array. */
function setupEntropy<T>(operation: () => T, selected: LeaderSkillId[]): T {
  assert.equal(new Set(selected).size, selected.length);
  const working: LeaderSkillId[] = LEADER_SKILL_CARDS.map(c => c.id);
  const remainder = working.filter(c => !selected.includes(c));
  const desired: LeaderSkillId[] = selected.flatMap(c => [c, remainder.shift()!]);
  desired.push(...remainder);
  const rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
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

export function initializePairedChoamNexusSkills(options: PairedChoamNexusSkillsOptions = {}): Game {
  const factions: readonly FactionId[] = options.factions ?? ['richese', 'choam', 'guild', 'atreides'];
  let game = options.initial ? pairedSkillsSnapshot(options.initial)
    : createGame('PAIREDCHOAMNEXUSSKILLS', newPlayer(options.seatIds?.[0] ?? factions[0], factions[0], factions[0]), options.advanced ?? true, ['choam']);
  if (!options.initial) for (const faction of factions.slice(1))
    joinGame(game, newPlayer(options.seatIds?.[game.players.length] ?? faction, faction, faction));
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.leaderSkills?.assignments.length === 0,
    'Continue only the original lobby or initialized unassigned turn-one skill setup');
  if (game.status === 'lobby' && !game.nexusCards) game.nexusCards = { cards: null, phase: null };
  assert.ok(pairedNexusLeaderSkillsProfile(game));
  assert.deepEqual(game.expansions, ['choam']);
  if (game.status === 'setup') {
    assert.equal(game.setupStage, 'leaderSkills');
    assertPairedChoamSkillsCustody(game);
    return game;
  }
  for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
  const richeseSkill = options.richeseSkill ?? 'suk-graduate';
  const choamSkill = options.choamSkill ?? 'planetologist';
  const passive: LeaderSkillId[] = ['sandmaster', 'warmaster', 'killer-medic', 'prana-bindu-adept', 'master-of-assassins', 'swordmaster-of-ginaz']
    .filter(c => c !== richeseSkill && c !== choamSkill) as LeaderSkillId[];
  const selected: LeaderSkillId[] = game.players.map(p => p.faction === 'richese' ? richeseSkill : p.faction === 'choam' ? choamSkill : passive.shift()!);
  return setupEntropy(() => initializeLeaderSkillsGameForAudit(game), selected);
}

export function nextPairedChoamSkillsStep(game: Game): PairedChoamNexusSkillsStep | null {
  if (game.status === 'setup' && game.setupStage === 'leaderSkills') {
    const actor: string = Object.keys(game.leaderSkills!.offers)[0];
    assert.ok(actor);
    const offer: NonNullable<GameView['leaderSkills']> = viewGame(game, actor).leaderSkills!;
    const skill: LeaderSkillId | undefined = offer.offer!.cards.find(c => !offer.unavailableSkills?.[c]);
    const eligible = new Set(offer.eligibleLeaders.map(l => l.id));
    const leader = pairedSkillsPlayer(game, actor).leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
    assert.ok(skill && leader);
    return { actor, action: { type: 'leaderSkill', event: offer.offer!.event, skill, leader: leader.id } };
  }
  if (pairedSkillsClean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const phase = game.nexusCards.phase;
    const actor: string | undefined = phase.eligible.find(id => !phase.done.includes(id));
    if (actor) return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.phaseOpening && !game.response) {
    const decision = game.decision;
    if (decision?.kind === 'leaderSkillVisibility') return { actor: decision.player,
      action: { type: 'leaderSkillVisibility', event: decision.event, hide: false } };
    if (decision?.kind === 'wormRide') return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'nexusFremenCunningOffer' || decision?.kind === 'nexusFremenCunningRide')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, accept: false } };
    if (decision?.kind === 'nexusChoamInspection')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, inspect: false } };
  }
  return nextNativeSkillsStrongholdStep(game);
}
export function stepPairedChoamSkills(game: Game, next = nextPairedChoamSkillsStep(game), actions?: PairedChoamNexusSkillsStep[]): Game {
  assert.ok(next, 'The original paired skill continuation needs a human plan');
  actions?.push(structuredClone(next));
  return applyAction(game, next.actor, next.action);
}
export function advancePairedChoamSkills(game: Game, until: (state: Game) => boolean, actions?: PairedChoamNexusSkillsStep[]): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = stepPairedChoamSkills(game, undefined, actions);
  }
  throw Error('Original paired E2 Skills continuation did not reach its requested boundary');
}
export function advancePairedChoamSkillsToPhase(game: Game, phase: number, actions?: PairedChoamNexusSkillsStep[]): Game {
  const turn = game.turn;
  return advancePairedChoamSkills(game, state => {
    assert.equal(state.turn, turn, 'Do not chase an auto-skipped phase into the next turn');
    return state.phase >= phase && pairedSkillsClean(state);
  }, actions);
}
export function completePairedChoamSkillsSetup(game: Game, options: PairedChoamNexusSkillsOptions = {}, actions?: PairedChoamNexusSkillsStep[]): Game {
  for (let n = 0; game.status === 'setup' && n < 200; n++) {
    if (game.setupStage === 'leaderSkills') {
      const actor: string = Object.keys(game.leaderSkills!.offers)[0];
      const p = pairedSkillsPlayer(game, actor);
      const requested: LeaderSkillId | undefined = p.faction === 'richese' ? options.richeseSkill : p.faction === 'choam' ? options.choamSkill : undefined;
      const offer: NonNullable<GameView['leaderSkills']> = viewGame(game, actor).leaderSkills!;
      const skill: LeaderSkillId | undefined = requested ?? offer.offer!.cards.find(c => !offer.unavailableSkills?.[c]);
      assert.ok(skill && offer.offer!.cards.includes(skill) && !offer.unavailableSkills?.[skill], 'Requested skill must genuinely exist in the saved original offer');
      const eligible = new Set(offer.eligibleLeaders.map(l => l.id));
      const leader = p.leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader);
      game = stepPairedChoamSkills(game, { actor, action: { type: 'leaderSkill', event: offer.offer!.event, skill, leader: leader.id } }, actions);
    } else game = stepPairedChoamSkills(game, undefined, actions);
  }
  assert.equal(game.status, 'playing');
  return game;
}
export function pairedSkillsPhysicalCards(game: Game): string[] {
  return [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])].map(c => c.id).sort();
}
export function assertPairedChoamSkillsCustody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  const skills = game.leaderSkills!;
  assert.deepEqual([...skills.deck, ...Object.values(skills.offers).flatMap(o => o.cards), ...skills.assignments.map(a => a.skill)].sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
  validateNexusCards(game.nexusCards!.cards!, game.players);
  const cards = game.nexusCards!.cards!;
  assert.deepEqual([...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter((c): c is FactionId => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
  assert.deepEqual(pairedSkillsPhysicalCards(game), [...treacheryDeck(['choam']), ...richeseCards()].map(c => c.id).sort());
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20, p.faction);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, b) => a + b, 0), p.faction === 'fremen' ? 3 : 5);
  }
}
function reserveBoard(game: Game, staging: string[]): void {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((a, b) => a + b, 0); p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((a, b) => a + b, 0); p.elites.forces = {};
    }
    if (p.advisors) p.advisors = {};
  }
  staging.push('Conserved original board counters into their own reserves; wallets, turns, phases, skills and custody receipts are unchanged.');
}
export function placePairedSkillsForce(game: Game, actor: string, key: string, count: number, staging?: string[]): void {
  const p = pairedSkillsPlayer(game, actor);
  assert.ok(Number.isSafeInteger(count) && count >= 0 && p.reserves - (p.elites?.reserves ?? 0) >= count);
  p.reserves -= count;
  if (count) p.forces[key] = (p.forces[key] ?? 0) + count;
  staging?.push(`Conserved ${count} ordinary ${p.faction} counters: native reserves → ${key}; not played movement history.`);
}
function orderUndealtSpice(game: Game, kinds: ('worm' | 'land')[], staging: string[]): void {
  const front = kinds.map(kind => {
    const index = game.spiceDeck.findIndex(c => kind === 'worm' ? 'worm' in c : 'territory' in c);
    assert.ok(index >= 0, 'Only genuine still-undealt Spice Cards can be ordered');
    return game.spiceDeck.splice(index, 1)[0];
  });
  game.spiceDeck.unshift(...front);
  staging.push(`Conserved original undealt Spice order: ${kinds.join(', ')}; played Spice Discards remain untouched.`);
}
export function holdPairedSkillsCard(game: Game, actor: string, matches: (card: Card) => boolean, staging: string[] = []): Card {
  const p = pairedSkillsPlayer(game, actor), held = p.hand.find(matches);
  if (held) return held;
  const index = game.deck.findIndex(matches);
  assert.ok(index >= 0 && p.hand.length < handLimit(p), 'Required original physical card and native hand capacity must exist');
  const card = game.deck.splice(index, 1)[0]; p.hand.push(card);
  staging.push(`Conserved original ${card.id}: unused E2 deck → ${p.faction} hand; not a natural deal.`);
  return card;
}

/** Native starts/first deals → actual Storm → previous zero-marker shipment →
 * actual END Mentat → undealt worm → reciprocal classic alliance → two own
 * closing Cunning draws. No skill effects, marker history or wallets are granted. */
export function createPairedChoamNexusSkillsFixture(options: PairedChoamNexusSkillsOptions = {}): PairedChoamNexusSkillsFixture {
  const actions: PairedChoamNexusSkillsStep[] = [], staging: string[] = [];
  let game = initializePairedChoamNexusSkills(options);
  const initial = pairedSkillsSnapshot(game);
  game = completePairedChoamSkillsSetup(game, options, actions);
  const afterSetup = pairedSkillsSnapshot(game);
  const richese = game.players.find(p => p.faction === 'richese')!.id;
  const choam = game.players.find(p => p.faction === 'choam')!.id;
  const guild = game.players.find(p => p.faction === 'guild')?.id;
  const observer = game.players.find(p => p.faction !== 'richese' && p.faction !== 'choam' && p.faction !== 'guild')?.id;
  assert.ok(guild && observer, 'Both own Cunning deals require two other real alliance seats including native Guild');
  const location = `habbanya_ridge_sietch:${territory('habbanya_ridge_sietch').sectors[0]}`;
  game = advancePairedChoamSkillsToPhase(game, 1, actions);
  const afterFirstStorm = pairedSkillsSnapshot(game);
  orderUndealtSpice(game, ['land', 'land'], staging);
  game = advancePairedChoamSkills(game, g => g.phase === 5 && g.active === richese && pairedSkillsClean(g), actions);
  reserveBoard(game, staging);
  const before = pairedSkillsSnapshot(game), p = pairedSkillsPlayer(game, richese);
  const shipmentStep: PairedChoamNexusSkillsStep = { actor: richese, action: { type: 'ship',
    noField: p.noField!.tokens.find(t => t.value === 0)!.id, event: p.noFieldEvent,
    territory: 'habbanya_ridge_sietch', sector: territory('habbanya_ridge_sietch').sectors[0] } };
  game = stepPairedChoamSkills(game, shipmentStep, actions);
  game = allowPairedChoamSkills(game, actions);
  const firstShipment = { before, step: shipmentStep, after: pairedSkillsSnapshot(game) };
  game = revealPairedSkillsRichese(game, richese, actions);
  game = advancePairedChoamSkillsToPhase(game, 8, actions);
  reserveBoard(game, staging);
  placePairedSkillsForce(game, richese, location, 1, staging);
  placePairedSkillsForce(game, choam, `arrakeen:${territory('arrakeen').sectors[0]}`, 1, staging);
  let beforeFirstMentat: Game | undefined, firstMentatStep: PairedChoamNexusSkillsStep | undefined;
  while (game.turn === 1) {
    const previous: Game = pairedSkillsSnapshot(game);
    const next: PairedChoamNexusSkillsStep | null = nextPairedChoamSkillsStep(game); assert.ok(next);
    game = stepPairedChoamSkills(game, next, actions);
    if (game.turn === 2) { beforeFirstMentat = previous; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  const afterFirstMentat = pairedSkillsSnapshot(game);
  game = advancePairedChoamSkillsToPhase(game, 1, actions);
  orderUndealtSpice(game, ['worm', 'land', 'land'], staging);
  game = advancePairedChoamSkills(game, g => g.nexus === true && !g.spiceWindow && !g.spiceResolution && pairedSkillsClean(g), actions);
  const beforeAlliance = pairedSkillsSnapshot(game), allianceActions: PairedChoamNexusSkillsStep[] = [
    { actor: guild, action: { type: 'alliance', target: observer } },
    { actor: observer, action: { type: 'alliance', target: guild } },
  ];
  for (const next of allianceActions) game = stepPairedChoamSkills(game, next, actions);
  game = advancePairedChoamSkills(game, g => g.nexusCards?.phase?.stage === 'drawing' && pairedSkillsClean(g), actions);
  const beforeClosingDraw = pairedSkillsSnapshot(game), closingDraws: PairedChoamNexusSkillsFixture['closingDraws'] = [];
  for (const [actor, card] of [[richese, 'richese'], [choam, 'choam']] as const) {
    const cards = game.nexusCards!.cards!, index = cards.deck.indexOf(card); assert.ok(index >= 0);
    cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    staging.push(`Conserved original unused ${card} Nexus singleton placed first before its actual closing draw.`);
    const drawBefore = pairedSkillsSnapshot(game);
    const next: PairedChoamNexusSkillsStep = { actor, action: { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } };
    game = stepPairedChoamSkills(game, next, actions);
    closingDraws.push({ before: drawBefore, step: next, after: pairedSkillsSnapshot(game) });
  }
  game = advancePairedChoamSkillsToPhase(game, 5, actions);
  reserveBoard(game, staging);
  const movementStart = pairedSkillsSnapshot(game);
  game = advancePairedChoamSkills(game, g => g.phase === 5 && g.active === richese && pairedSkillsClean(g), actions);
  if (options.reserveCap !== undefined) {
    const p = pairedSkillsPlayer(game, richese);
    assert.ok(Number.isSafeInteger(options.reserveCap) && options.reserveCap >= 0 && options.reserveCap <= p.reserves);
    placePairedSkillsForce(game, richese, 'polar_sink:0', p.reserves - options.reserveCap, staging);
  }
  assertPairedChoamSkillsCustody(game);
  const trainers = { richese: game.leaderSkills!.assignments.find(a => a.owner === richese)!.leader,
    choam: game.leaderSkills!.assignments.find(a => a.owner === choam)!.leader };
  return { initial, afterSetup, afterFirstStorm, firstShipment, beforeFirstMentat, firstMentatStep, afterFirstMentat,
    beforeAlliance, allianceActions, beforeClosingDraw, closingDraws, movementStart, game, richese, choam, guild, observer, location, trainers, actions, staging };
}
/** Exact failure-before API for the parent's real signed-pair validator integration.
 * This is the original action shape, with no fabricated skill proof/companion. */
export function pairedSkillsRicheseCunningRequest(f: PairedChoamNexusSkillsFixture, game = f.game): Action {
  const p = pairedSkillsPlayer(game, f.richese), offer = viewGame(game, f.richese).nexusRicheseCunning;
  assert.ok(offer && !offer.blocked);
  return { type: 'ship', noField: p.noField!.tokens.find(t => t.value === 3)!.id,
    revealedToken: p.noField!.tokens.find(t => t.value === 5)!.id, nexus: offer.event, event: p.noFieldEvent,
    territory: 'habbanya_ridge_sietch', sector: territory('habbanya_ridge_sietch').sectors[0], allyPayment: 0 };
}
export function allowPairedChoamSkills(game: Game, actions?: PairedChoamNexusSkillsStep[]): Game {
  return advancePairedChoamSkills(game, pairedSkillsClean, actions);
}
export function revealPairedSkillsRichese(game: Game, actor: string, actions?: PairedChoamNexusSkillsStep[]): Game {
  const p = pairedSkillsPlayer(game, actor); assert.ok(p.noField!.deployed);
  return stepPairedChoamSkills(game, { actor, action: { type: 'revealNoField', event: p.noFieldEvent, token: p.noField!.deployed.tokenId } }, actions);
}
export function openPairedSkillsBattle(game: Game, owner: string, opponent: string,
  options: { territory?: string; band?: 'normal' | 'skilled'; actions?: PairedChoamNexusSkillsStep[] } = {}): Game {
  const actions = options.actions;
  game = advancePairedChoamSkillsToPhase(game, 6, actions);
  assert.equal(game.phase, 6, 'The genuine battle needs conserved opposing physical forces');
  assert.ok(game.active === owner || game.active === opponent);
  game = stepPairedChoamSkills(game, { actor: game.active!, action: { type: 'chooseBattle',
    territory: options.territory ?? 'habbanya_ridge_sietch', target: game.active === owner ? opponent : owner } }, actions);
  for (let n = 0; n < 100; n++) {
    if (pairedSkillsClean(game) && game.battle && (!game.battle.preLeader || game.battle.preLeader.closed) && !game.battle.preparation) return game;
    const decision = game.decision;
    const next: PairedChoamNexusSkillsStep | null = decision?.kind === 'leaderSkillVisibility'
      ? { actor: decision.player, action: { type: 'leaderSkillVisibility', event: decision.event,
        hide: decision.player === owner && options.band === 'skilled' } }
      : nextPairedChoamSkillsStep(game);
    game = stepPairedChoamSkills(game, next, actions);
  }
  throw Error('The original battle did not reach its actual human plan boundary');
}
export function pairedSkillsBattlePlans(game: Game, owner: string, opponent: string, dial = 2,
  trained = true): PairedChoamNexusSkillsStep[] {
  const p = pairedSkillsPlayer(game, owner), trainedLeader = game.leaderSkills!.assignments.find(a => a.owner === owner)!.leader;
  const leader = trained ? p.leaders.find(l => l.id === trainedLeader && !l.dead)
    : p.leaders.filter(l => !l.dead && l.id !== trainedLeader).sort((a, b) => b.strength - a.strength)[0];
  const targetTrainer = game.leaderSkills!.assignments.find(a => a.owner === opponent)!.leader;
  const target = pairedSkillsPlayer(game, opponent).leaders.filter(l => !l.dead && l.id !== targetTrainer).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(leader && target && leader.strength + dial > target.strength);
  return [
    { actor: owner, action: { type: 'battlePlan', leader: leader.id, dial, support: game.advanced ? dial : 0, weapon: null, defense: null } },
    { actor: opponent, action: { type: 'battlePlan', leader: target.id, dial: 0, support: 0, weapon: null, defense: null } },
  ];
}
export function finishPairedSkillsBattle(game: Game, actions?: PairedChoamNexusSkillsStep[]): Game {
  return advancePairedChoamSkills(game, g => !g.battle && pairedSkillsClean(g) && !g.pendingTreacheryDiscard, actions);
}
/** Original skill posture and native bank/support legs on the real revealed source. */
export function quotePairedSkillsBattle(game: Game) {
  const battle = game.battle; assert.ok(battle?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const p = pairedSkillsPlayer(game, actor), view = viewGame(game, actor).battle!;
    assert.ok(view.ownForces);
    return { id: actor, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand,
      plan: battle.plans[actor], leader: p.leaders.find(l => l.id === battle.plans[actor].leader),
      forces: view.ownForces, stronghold: view.strongholdEffects[actor],
      leaderSkills: game.leaderSkills!.assignments.filter(a => a.owner === actor).map(a => ({
        skill: a.skill, leader: a.leader, faceUp: !battle.leaderSkillHidden?.[actor], captured: false,
      })) };
  };
  return quoteBattleResolution({ advanced: game.advanced, turn: game.turn, territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor, attacker: side(battle.attacker), defender: side(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map(actor => ({ id: actor,
      beneficiary: [battle.attacker, battle.defender].includes(actor) ? actor : pairedSkillsPlayer(game, actor).ally!,
      called: battle.traitorCalls[actor] ?? false, traitors: pairedSkillsPlayer(game, actor).traitors })),
    participants: game.players,
    physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand), ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? [])],
    pendingAuditorPresent: !!game.pendingAuditor, pendingRetentionPresent: false });
}
export function pairedSkillsChoamCunningRequest(game: Game, actor: string, card: string): Action {
  const offer = viewGame(game, actor).choamWorthless!.plays.find(p => p.source === 'nexus' && p.card.id === card && p.effect === 'kulon');
  assert.ok(offer && offer.source === 'nexus' && !offer.blocked);
  return { type: 'card', mode: 'choam', card, effect: 'kulon', nexus: offer.event };
}
/** Ordinary three-territory route, not No-Field or a special movement-card route.
 * Kulon plus the original Planetologist range is tested through native actions. */
export function stagePairedSkillsPlanetologistRoute(game: Game, actor: string, staging?: string[]): { from: string; to: string; action: Action } {
  const keys = TERRITORIES.filter(t => t.type === 'sand').flatMap(t => t.sectors.map(s => `${t.id}:${s}`));
  let to: string | undefined;
  const from = keys.find(origin => {
    if (splitLocation(origin).sector === game.storm) return false;
    to = keys.find(target => splitLocation(target).sector !== game.storm &&
      gameDistance(game, origin, target, key => splitLocation(key).sector === game.storm) === 3);
    return !!to;
  });
  assert.ok(from && to, 'A clear ordinary three-territory Planetologist route must exist');
  placePairedSkillsForce(game, actor, from, 1, staging);
  return { from, to, action: { type: 'move', planetologist: 'range', forces: { [from]: 1 }, ...splitLocation(to) } };
}
