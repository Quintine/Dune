import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { Card } from '../game/cards';
import { leaders, treacheryDeck } from '../game/cards';
import { territory } from '../game/board';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { TERROR_KINDS, type TerrorKind } from '../game/moritani-terror';
import { nextNexusSkillsModulesBattleStep } from './fixture-nexus-skills-modules-battles';
import {
  moritaniSkillsModulesClean, moritaniSkillsModulesPlayer, moritaniSkillsModulesPolicy,
  nextMoritaniSkillsModulesStep, revealMoritaniSkillsModulesPlans, stageMoritaniSkillsModulesBattle,
} from './fixture-moritani-skills-modules';
import { holdMoritaniStrongholdsTraitor } from './fixture-moritani-strongholds';
import type { StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type MoritaniNexusSkillsModulesStep = StrongholdFactionsNativeStep;
export type MoritaniNexusSkillsModulesOptions = {
  /** Original lobby or unassigned turn-one skill setup, never a converted save. */
  initial?: Game;
  rules?: 'basic' | 'advanced';
  tech?: boolean;
  strongholds?: boolean;
  factions?: readonly FactionId[];
  seatIds?: readonly string[];
  /** Supplied offers are authoritative; an explicit request must actually be offered. */
  guildSkill?: LeaderSkillId;
  moritaniSkill?: LeaderSkillId;
  holder?: 'moritani' | 'guild';
  normalCall?: boolean;
  stack?: boolean;
};
export type MoritaniNexusSkillsModulesFixture = {
  initial: Game; afterSetup: Game; afterFirstStorm: Game;
  beforeFirstMentat: Game; firstMentatStep: MoritaniNexusSkillsModulesStep; afterFirstMentat: Game;
  beforeAlliance: Game; allianceActions: MoritaniNexusSkillsModulesStep[];
  beforeClosingDraw: Game; closingDrawStep: MoritaniNexusSkillsModulesStep; afterClosingDraw: Game;
  beforeBattle: Game; battleAction: MoritaniNexusSkillsModulesStep;
  plans: Game; planActions: MoritaniNexusSkillsModulesStep[]; revealed: Game; pending: Game; game: Game;
  moritani: string; opponent: string; partner: string; holder: string;
  target: string; moritaniLeader: string; opponentLeader: string;
  moritaniCards: string[]; opponentCards: string[]; karama: string;
  actions: MoritaniNexusSkillsModulesStep[]; staging: string[];
};
export const moritaniNexusSkillsModulesPlayer = moritaniSkillsModulesPlayer;
export const moritaniNexusSkillsModulesPolicy = moritaniSkillsModulesPolicy;
export const moritaniNexusSkillsModulesClean = moritaniSkillsModulesClean;
const snapshot = (game: Game): Game => structuredClone(game);

/** Only the original physical all14 shuffle is controlled, before Traitor deals.
 * The remainder of the native initializer retains its original randomness. */
function originalSkillShuffle<T>(selected: LeaderSkillId[], initialize: () => T): T {
  assert.equal(new Set(selected).size, selected.length);
  const working: LeaderSkillId[] = LEADER_SKILL_CARDS.map(c => c.id);
  const remainder = working.filter(c => !selected.includes(c));
  const desired = selected.flatMap(c => [c, remainder.shift()!]); desired.push(...remainder);
  const rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (cursor < rolls.length && array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++];
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function initializeMoritaniNexusSkillsModulesOffers(options: MoritaniNexusSkillsModulesOptions = {}): Game {
  const advanced = options.rules ? options.rules === 'advanced' : options.initial?.advanced ?? true;
  const tech = options.tech ?? !!options.initial?.techTokens;
  const strongholds = options.strongholds ?? !!options.initial?.strongholdCards;
  const factions: readonly FactionId[] = options.factions ?? ['moritani', 'guild', 'emperor'];
  let game = options.initial ? snapshot(options.initial)
    : createGame('MORITANINEXUSSKILLSMODULES', newPlayer(options.seatIds?.[0] ?? factions[0], factions[0], factions[0]), advanced, ['ecaz']);
  if (!options.initial) for (const faction of factions.slice(1))
    joinGame(game, newPlayer(options.seatIds?.[game.players.length] ?? faction, faction, faction));
  assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(!game.homeworlds && game.players.length >= (tech ? 3 : 2) && game.players.length <= 6);
  assert.equal(game.players.filter(p => p.faction === 'moritani').length, 1);
  assert.equal(game.players.filter(p => p.faction === 'guild').length, 1);
  const allowed: FactionId[] = ['moritani', 'guild', 'emperor', 'atreides', 'fremen', 'beneGesserit', ...(advanced ? [] : ['harkonnen'] as FactionId[])];
  assert.ok(game.players.every(p => allowed.includes(p.faction))); assert.ok(advanced || !strongholds);
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    (game.setupStage === 'prediction' || game.setupStage === 'leaderSkills') && game.leaderSkills?.assignments.length === 0,
  'Only an original lobby or undealt skill-first setup may continue');
  if (game.status === 'setup') {
    assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, strongholds);
    assertMoritaniNexusSkillsModulesCustody(game);
    while (game.setupStage === 'prediction') game = stepMoritaniNexusSkillsModules(game);
    return game;
  }
  if (!!game.techTokens !== tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: tech });
  if (!!game.strongholdCards !== strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: strongholds });
  game.nexusCards ??= { cards: null, phase: null };
  assert.deepEqual(game.nexusCards, { cards: null, phase: null }); assert.ok(!game.leaderSkills);
  for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
  const guildSkill = options.guildSkill ?? 'suk-graduate', moritaniSkill = options.moritaniSkill ?? 'warmaster';
  const passive: LeaderSkillId[] = ['sandmaster', 'killer-medic', 'prana-bindu-adept', 'master-of-assassins', 'swordmaster-of-ginaz', 'planetologist']
    .filter(c => c !== guildSkill && c !== moritaniSkill) as LeaderSkillId[];
  const selected = game.players.map(p => p.faction === 'guild' ? guildSkill : p.faction === 'moritani' ? moritaniSkill : passive.shift()!);
  game = originalSkillShuffle(selected, () => initializeLeaderSkillsGameForAudit(game));
  while (game.setupStage === 'prediction') game = stepMoritaniNexusSkillsModules(game);
  return game;
}
export function nextMoritaniNexusSkillsModulesStep(game: Game): MoritaniNexusSkillsModulesStep | null {
  if (game.response || game.phaseOpening || game.pendingTreacheryDiscard) return nextMoritaniSkillsModulesStep(game);
  const d = game.decision;
  if (d?.kind === 'moritaniPlacement' || d?.kind === 'moritaniAssassinate' || d?.kind === 'moritaniSetup' || d?.kind === 'leaderSkillVisibility')
    return nextMoritaniSkillsModulesStep(game);
  if (d?.kind === 'moritaniTerror' && ['select', 'offer'].includes(game.pendingTerrorEntry!.stage))
    return { actor: d.player, action: { type: 'decision', decline: true } };
  return nextNexusSkillsModulesBattleStep(game);
}
export function stepMoritaniNexusSkillsModules(game: Game, next = nextMoritaniNexusSkillsModulesStep(game), actions?: MoritaniNexusSkillsModulesStep[]): Game {
  assert.ok(next, 'An original human sealed Battle Plan is required'); actions?.push(structuredClone(next));
  return applyAction(game, next.actor, next.action);
}
export function advanceMoritaniNexusSkillsModules(game: Game, until: (state: Game) => boolean, actions?: MoritaniNexusSkillsModulesStep[]): Game {
  for (let n = 0; n < 2000; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished'); game = stepMoritaniNexusSkillsModules(game, undefined, actions);
  }
  throw Error('Original Moritani Skills/Nexus continuation did not reach its requested boundary');
}
export function completeMoritaniNexusSkillsModulesSetup(game: Game, options: MoritaniNexusSkillsModulesOptions = {}, actions?: MoritaniNexusSkillsModulesStep[]): Game {
  for (let n = 0; game.status === 'setup' && n < 240; n++) {
    if (game.setupStage !== 'leaderSkills') { game = stepMoritaniNexusSkillsModules(game, undefined, actions); continue; }
    const actor = Object.keys(game.leaderSkills!.offers)[0], p = moritaniSkillsModulesPlayer(game, actor);
    const own = viewGame(game, actor).leaderSkills!, offer = own.offer!;
    const requested = p.faction === 'guild' ? options.guildSkill : p.faction === 'moritani' ? options.moritaniSkill : undefined;
    const skill = requested ?? offer.cards.find(c => !own.unavailableSkills?.[c]);
    assert.ok(skill && offer.cards.includes(skill) && !own.unavailableSkills?.[skill], 'Requested skill must be genuinely offered');
    const leader = p.faction === 'guild' && skill === 'suk-graduate'
      ? own.eligibleLeaders.find(l => l.name === 'Master Bewt') : own.eligibleLeaders[0];
    assert.ok(leader);
    game = stepMoritaniNexusSkillsModules(game, { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } }, actions);
  }
  assert.equal(game.status, 'playing'); return game;
}
export function assertMoritaniNexusSkillsModulesCustody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players); validateNexusCards(game.nexusCards!.cards!, game.players);
  assert.deepEqual([...game.leaderSkills!.deck, ...Object.values(game.leaderSkills!.offers).flatMap(o => o.cards),
    ...game.leaderSkills!.assignments.map(a => a.skill)].sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
  const nexus = game.nexusCards!.cards!;
  assert.deepEqual([...nexus.deck, ...nexus.discard, ...Object.values(nexus.hands).filter((c): c is FactionId => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])].map(c => c.id).sort(), treacheryDeck(['ecaz']).map(c => c.id).sort());
  for (const p of game.players) {
    assert.deepEqual(p.leaders.map(l => l.id).sort(), leaders(p.faction).map(l => l.id).sort());
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, b) => a + b, 0), p.faction === 'emperor' ? 5 : 3);
      for (const [key, count] of Object.entries(p.elites.forces)) assert.ok(count <= (p.forces[key] ?? 0));
    }
  }
  if (game.moritaniTerror) {
    assert.deepEqual(game.moritaniTerror.tokens.map(t => t.kind).sort(), [...TERROR_KINDS].sort());
    assert.equal(new Set(game.moritaniTerror.tokens.map(t => t.id)).size, 6);
  }
}
function reserveBoard(game: Game, staging: string[]) {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((a, b) => a + b, 0); p.forces = {};
    if (p.elites) { p.elites.reserves += Object.values(p.elites.forces).reduce((a, b) => a + b, 0); p.elites.forces = {}; }
    if (p.advisors) p.advisors = {};
  }
  staging.push('Conserved original board counters through their own reserves; wallets, phase, turn, skill effects and earned module custody unchanged.');
}
function place(game: Game, actor: string, site: string, count: number, staging: string[]) {
  const p = moritaniSkillsModulesPlayer(game, actor); assert.ok(p.reserves - (p.elites?.reserves ?? 0) >= count);
  p.reserves -= count; const key = `${site}:${territory(site).sectors[0]}`; p.forces[key] = (p.forces[key] ?? 0) + count;
  staging.push(`Conserved ${count} original ordinary ${actor} counters: own reserves → ${key}.`);
}
export function holdMoritaniNexusSkillsModulesCard(game: Game, actor: string, kind: Card['kind'] | 'karama', staging: string[] = [], excluded: string[] = []): string {
  const p = moritaniSkillsModulesPlayer(game, actor);
  const matches = (c: Card) => (c.kind === kind || c.effect === kind) && !excluded.includes(c.id);
  const held = p.hand.find(matches); if (held) return held.id;
  const index = game.deck.findIndex(matches);
  const donor = index < 0 ? game.players.find(p => p.id !== actor && p.hand.some(matches)) : undefined;
  assert.ok((index >= 0 || donor) && p.hand.length < handLimit(p));
  const card = index >= 0 ? game.deck.splice(index, 1)[0] : donor!.hand.splice(donor!.hand.findIndex(matches), 1)[0];
  p.hand.push(card);
  staging.push(`Conserved original ecaz33 ${card.id}: ${donor?.id ?? 'unused deck'} → ${actor}'s hand; not a natural deal.`); return card.id;
}
function orderSpice(game: Game, kinds: ('land' | 'worm')[], staging: string[]) {
  const front = kinds.map(kind => {
    const index = game.spiceDeck.findIndex(c => kind === 'land' ? 'territory' in c : 'worm' in c); assert.ok(index >= 0);
    return game.spiceDeck.splice(index, 1)[0];
  });
  game.spiceDeck.unshift(...front); staging.push(`Conserved original undealt Spice order: ${kinds.join(', ')}; original Discards unchanged.`);
}
export function resolveMoritaniNexusSkillsModulesBattle(game: Game, moritani: string, normalCall = false, actions?: MoritaniNexusSkillsModulesStep[]): Game {
  for (let n = 0; n < 160; n++) {
    if (game.decision?.kind === 'sukRescue' || game.decision?.kind === 'moritaniAssassinate' ||
      !game.battle && moritaniSkillsModulesClean(game) && !game.pendingTreacheryDiscard) return game;
    const next = nextMoritaniNexusSkillsModulesStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = normalCall && next.actor === moritani;
    game = stepMoritaniNexusSkillsModules(game, next, actions);
  }
  throw Error('Original battle did not reach rescue, assassination or settled boundary');
}
export type MoritaniNexusSkillsModulesSettlementBoundary = {
  game: Game;
  kind: 'losses' | 'rescue' | 'assassination' | 'cards' | 'tech' | 'settled';
};
/** Human physical casualty/rescue/assassination/cleanup/reward choices are never
 * skipped to manufacture a later boundary. Apply that actual choice, then resume. */
export function settleMoritaniNexusSkillsModulesBoundary(game: Game, moritani: string, normalCall = false,
  actions?: MoritaniNexusSkillsModulesStep[]): MoritaniNexusSkillsModulesSettlementBoundary {
  const choices: Partial<Record<NonNullable<Game['decision']>['kind'], MoritaniNexusSkillsModulesSettlementBoundary['kind']>> = {
    battleLosses: 'losses', sukRescue: 'rescue', moritaniAssassinate: 'assassination', battleCards: 'cards', techToken: 'tech',
  };
  for (let n = 0; n < 160; n++) {
    const kind = game.decision && choices[game.decision.kind];
    if (kind && !game.response && !game.phaseOpening) return { game, kind };
    if (!game.battle && moritaniSkillsModulesClean(game) && !game.pendingTreacheryDiscard) return { game, kind: 'settled' };
    const next = nextMoritaniNexusSkillsModulesStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = normalCall && next.actor === moritani;
    game = stepMoritaniNexusSkillsModules(game, next, actions);
  }
  throw Error('Original battle settlement did not reach its next physical human choice');
}
export function finishMoritaniNexusSkillsModulesBattle(game: Game, actions?: MoritaniNexusSkillsModulesStep[]): Game {
  return advanceMoritaniNexusSkillsModules(game, s => !s.battle && moritaniSkillsModulesClean(s) && !s.pendingTreacheryDiscard, actions);
}
export const revealMoritaniNexusSkillsModulesPlans = revealMoritaniSkillsModulesPlans;
export const stageMoritaniNexusSkillsModulesBattle = stageMoritaniSkillsModulesBattle;
export function moritaniNexusSkillsModulesToken(game: Game, kind: TerrorKind) {
  const token = game.moritaniTerror!.tokens.find(t => t.kind === kind); assert.ok(token); return token;
}
export function moritaniNexusSkillsModulesRequest(game: Game, actor: string, kind: TerrorKind = 'robbery', site = 'red_chasm'): Action {
  const offer = viewGame(game, actor).nexusMoritani; assert.ok(offer);
  return { type: 'decision', token: moritaniNexusSkillsModulesToken(game, kind).id, territory: site, nexus: offer.event };
}
/** Only pass the persisted native response queue, not a guessed policy actor. */
export function allowMoritaniNexusSkillsModules(game: Game, actions?: MoritaniNexusSkillsModulesStep[]): Game {
  for (let n = 0; (game.response || game.phaseOpening || game.pendingKarama) && n < 100; n++)
    game = stepMoritaniNexusSkillsModules(game, undefined, actions);
  assert.ok(!game.response && !game.phaseOpening && !game.pendingKarama); return game;
}
export function cancelMoritaniNexusSkillsModules(game: Game, actor: string, card: string, actions?: MoritaniNexusSkillsModulesStep[]): Game {
  game = stepMoritaniNexusSkillsModules(game, { actor, action: { type: 'card', mode: 'cancel', card } }, actions);
  return allowMoritaniNexusSkillsModules(game, actions);
}
export function rejectMoritaniNexusSkillsModulesAction(game: Game, actor: string, action: Action): void {
  const before = snapshot(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}

/** Source: docs/NEXUS_MORITANI_RULES.md13–32 (publisher face and native rulebook).
 * Genuine first Storm/END Mentat → worm/alliance/closing draw → original battle
 * → actual second Mentat supply opportunity. Enhanced relocation, HMS and
 * Grumman are deliberately NOT interpreted by this continuation. */
export function createMoritaniNexusSkillsModulesFixture(options: MoritaniNexusSkillsModulesOptions = {}): MoritaniNexusSkillsModulesFixture {
  const actions: MoritaniNexusSkillsModulesStep[] = [], staging: string[] = [];
  let game = initializeMoritaniNexusSkillsModulesOffers(options); const initial = snapshot(game);
  game = completeMoritaniNexusSkillsModulesSetup(game, options, actions); const afterSetup = snapshot(game);
  const moritani = game.players.find(p => p.faction === 'moritani')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const partner = game.players.find(p => p.id !== moritani && p.id !== opponent)?.id;
  assert.ok(partner, 'A real unallied closing Nexus draw requires two other original alliance seats; two-seat setup is supported separately.');
  while (game.phase === 0) {
    const next = nextMoritaniNexusSkillsModulesStep(game); assert.ok(next);
    if (next.action.type === 'stormDial') next.action.amount = 4;
    game = stepMoritaniNexusSkillsModules(game, next, actions);
  }
  game = advanceMoritaniNexusSkillsModules(game, s => s.phase === 1 && moritaniSkillsModulesClean(s), actions);
  const afterFirstStorm = snapshot(game); orderSpice(game, ['land', 'land'], staging);
  game = advanceMoritaniNexusSkillsModules(game, s => s.decision?.kind === 'moritaniPlacement', actions);
  if (options.stack) {
    game = stepMoritaniNexusSkillsModules(game, { actor: moritani, action: { type: 'decision', token: moritaniNexusSkillsModulesToken(game, 'sabotage').id, territory: 'arrakeen' } }, actions);
    game = allowMoritaniNexusSkillsModules(game, actions);
  } else game = stepMoritaniNexusSkillsModules(game, undefined, actions);
  reserveBoard(game, staging);
  const holder = options.holder === 'moritani' ? moritani : opponent;
  place(game, holder, 'tueks_sietch', 1, staging); place(game, holder === moritani ? opponent : moritani, 'carthag', 1, staging);
  let beforeFirstMentat: Game | undefined, firstMentatStep: MoritaniNexusSkillsModulesStep | undefined;
  while (game.turn === 1) {
    const before = snapshot(game), next = nextMoritaniNexusSkillsModulesStep(game); assert.ok(next);
    game = stepMoritaniNexusSkillsModules(game, next, actions);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep); const afterFirstMentat = snapshot(game);
  game = advanceMoritaniNexusSkillsModules(game, s => s.phase === 1 && moritaniSkillsModulesClean(s), actions);
  orderSpice(game, ['worm', 'land', 'land'], staging);
  game = advanceMoritaniNexusSkillsModules(game, s => s.nexus === true && !s.spiceWindow && !s.spiceResolution && moritaniSkillsModulesClean(s), actions);
  const beforeAlliance = snapshot(game), allianceActions: MoritaniNexusSkillsModulesStep[] = [
    { actor: opponent, action: { type: 'alliance', target: partner } },
    { actor: partner, action: { type: 'alliance', target: opponent } },
  ];
  for (const next of allianceActions) game = stepMoritaniNexusSkillsModules(game, next, actions);
  game = advanceMoritaniNexusSkillsModules(game, s => s.nexusCards?.phase?.stage === 'drawing' && moritaniSkillsModulesClean(s), actions);
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('moritani'); assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]); staging.push('Conserved undealt original Moritani Nexus singleton ordered before its real unallied closing draw.');
  const beforeClosingDraw = snapshot(game), closingDrawStep: MoritaniNexusSkillsModulesStep = {
    actor: moritani, action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[moritani], choice: 'draw', ownRedraws: 0 },
  };
  game = stepMoritaniNexusSkillsModules(game, closingDrawStep, actions); const afterClosingDraw = snapshot(game);
  game = advanceMoritaniNexusSkillsModules(game, s => s.phase === 5 && moritaniSkillsModulesClean(s), actions);
  stageMoritaniSkillsModulesBattle(game, moritani, opponent, staging);
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const ownLeader = moritaniSkillsModulesPlayer(game, moritani).leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0];
  const enemyLeader = moritaniSkillsModulesPlayer(game, opponent).leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
  const target = game.leaderSkills!.assignments.find(a => a.owner === opponent)!.leader; assert.ok(ownLeader && enemyLeader && enemyLeader.id !== target);
  holdMoritaniStrongholdsTraitor(game, moritani, options.normalCall ? enemyLeader.id : target, staging);
  const moritaniCards = [holdMoritaniNexusSkillsModulesCard(game, moritani, 'worthless', staging)];
  moritaniCards.push(holdMoritaniNexusSkillsModulesCard(game, moritani, 'worthless', staging, moritaniCards));
  const opponentCards = [holdMoritaniNexusSkillsModulesCard(game, opponent, 'worthless', staging)];
  game = advanceMoritaniNexusSkillsModules(game, s => s.phase === 6 && moritaniSkillsModulesClean(s), actions);
  const beforeBattle = snapshot(game), actor = game.active!; assert.ok([moritani, opponent].includes(actor));
  const battleAction: MoritaniNexusSkillsModulesStep = { actor, action: { type: 'chooseBattle', territory: 'tueks_sietch', target: actor === moritani ? opponent : moritani } };
  game = stepMoritaniNexusSkillsModules(game, battleAction, actions);
  game = advanceMoritaniNexusSkillsModules(game, s => !!s.battle && !s.battle.revealed && !nextMoritaniNexusSkillsModulesStep(s), actions);
  const planActions: MoritaniNexusSkillsModulesStep[] = [
    { actor: moritani, action: { type: 'battlePlan', leader: ownLeader.id, dial: 1, ...(game.advanced ? { support: 1 } : {}), weapon: moritaniCards[0], defense: moritaniCards[1] } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemyLeader.id, dial: 3, ...(game.advanced ? { support: 3 } : {}), weapon: opponentCards[0] } },
  ];
  const plans = snapshot(game), revealed = revealMoritaniSkillsModulesPlans(game, planActions, actions);
  const pending = resolveMoritaniNexusSkillsModulesBattle(snapshot(revealed), moritani, options.normalCall, actions);
  game = finishMoritaniNexusSkillsModulesBattle(snapshot(pending), actions);
  game = advanceMoritaniNexusSkillsModules(game, s => s.decision?.kind === 'moritaniPlacement', actions);
  const karama = holdMoritaniNexusSkillsModulesCard(game, opponent, 'karama', staging);
  assertMoritaniNexusSkillsModulesCustody(game);
  return { initial, afterSetup, afterFirstStorm, beforeFirstMentat, firstMentatStep, afterFirstMentat,
    beforeAlliance, allianceActions, beforeClosingDraw, closingDrawStep, afterClosingDraw, beforeBattle,
    battleAction, plans, planActions, revealed, pending, game, moritani, opponent, partner, holder,
    target, moritaniLeader: ownLeader.id, opponentLeader: enemyLeader.id, moritaniCards, opponentCards,
    karama, actions, staging };
}
