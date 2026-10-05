import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game, type Player,
} from '../game/engine';
import { territory } from '../game/board';
import { treacheryDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { DISCOVERY_CARD_PLACEMENTS, validateDiscoveryState } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { traitorDeck } from '../game/traitors';
import type { StrongholdId } from '../game/stronghold-cards';
import {
  nextEcazNexusSkillsModulesStep, ecazNexusSkillsModulesCunningRequest,
} from './fixture-ecaz-nexus-skills-modules';
import {
  nextMoritaniNexusSkillsModulesStep, moritaniNexusSkillsModulesPolicy,
  moritaniNexusSkillsModulesRequest,
} from './fixture-moritani-nexus-skills-modules';
import { revealDiscoveryNativeE3SkillsPlans } from './fixture-discovery-native-e3-skills';
import { orderDiscoveryClassicNexusSkillsSpice } from './fixture-discovery-classic-nexus-skills';
import {
  nextClassicDiscoveryNexusStep, withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken,
} from './fixture-discovery-classic-nexus';

export type DiscoveryStandaloneNexusE3SkillsNative = 'ecaz' | 'moritani';
export type DiscoveryStandaloneNexusE3SkillsStep = { actor: string; action: Action };
export type DiscoveryStandaloneNexusE3SkillsTransition = {
  before: Game; step: DiscoveryStandaloneNexusE3SkillsStep; after: Game;
};
export type DiscoveryStandaloneNexusE3SkillsOptions = {
  /** A fresh lobby or its ORIGINAL unassigned setup. Never a played-save conversion. */
  initial?: Game;
  native?: DiscoveryStandaloneNexusE3SkillsNative;
  rules?: 'basic' | 'advanced';
  factions?: readonly FactionId[];
  seatIds?: readonly string[];
  tech?: boolean;
  strongholds?: boolean;
  /** Explicit requests must be genuinely offered; absent requests accept the human lottery. */
  skill?: LeaderSkillId;
  leader?: string;
};
export type DiscoveryStandaloneNexusE3SkillsFixture = {
  initial: Game; setup: Game; trained: Game; afterFirstStorm: Game; collection: Game;
  firstMentat: DiscoveryStandaloneNexusE3SkillsTransition;
  game: Game; native: DiscoveryStandaloneNexusE3SkillsNative;
  owner: string; opponent: string; fremen: string | null;
  leader: string; skill: LeaderSkillId; target: string | null;
  token: string; source: string; wormSource: string; claim: StrongholdId;
  actions: DiscoveryStandaloneNexusE3SkillsStep[]; staging: string[];
};
export type DiscoveryStandaloneNexusE3SkillsClosing = {
  entered: Game; vote: Game; ride: DiscoveryStandaloneNexusE3SkillsTransition | null;
  alliance: Game; draw: DiscoveryStandaloneNexusE3SkillsTransition; game: Game;
};
export type DiscoveryStandaloneNexusE3SkillsBattle = {
  beforeBattle: Game; leadChoice: DiscoveryStandaloneNexusE3SkillsTransition | null;
  game: Game; plans: DiscoveryStandaloneNexusE3SkillsStep[];
  actor: string; opponent: string; leader: string; enemyLeader: string;
  location: string; card: string; enemyCard?: string; target: string | null;
};
export type DiscoveryStandaloneNexusE3SkillsBoundary = {
  game: Game; kind: 'losses' | 'rescue' | 'assassination' | 'cards' | 'tech' | 'settled';
};
export const discoveryStandaloneNexusE3SkillsPolicy = moritaniNexusSkillsModulesPolicy;
export const discoveryStandaloneNexusE3SkillsClean = (game: Game): boolean =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard && !game.truthtrance;
export function discoveryStandaloneNexusE3SkillsPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
}
const copy = (game: Game): Game => structuredClone(game);

/** Scalar entropy only for ONE physical shuffle; preceding scalar draws, UUIDs and later production stay native. */
function shuffled<T>(source: readonly string[], desired: readonly string[], operation: () => T, precedingDraws = 0): T {
  assert.deepEqual([...source].sort(), [...desired].sort());
  const working = [...source], rolls: number[] = [];
  for (let index = working.length - 1; index > 0; index--) {
    const swap = working.indexOf(desired[index]); assert.ok(swap >= 0 && swap <= index);
    rolls.push(Math.floor((swap + 0.5) * 0x100000000 / (index + 1)));
    [working[index], working[swap]] = [working[swap], working[index]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1 && precedingDraws > 0) {
      precedingDraws--; Reflect.apply(original, crypto, [array]);
    } else if (array instanceof Uint32Array && array.length === 1 && cursor < rolls.length) array[0] = rolls[cursor++];
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function initializeDiscoveryStandaloneNexusE3Skills(options: DiscoveryStandaloneNexusE3SkillsOptions = {}): Game {
  const native = options.native ?? options.initial?.players.find(p => p.faction === 'ecaz' || p.faction === 'moritani')?.faction ?? 'moritani';
  const advanced = options.rules ? options.rules === 'advanced' : options.initial?.advanced ?? true;
  const factions = options.factions ?? [native, 'guild', 'fremen', ...(!advanced && native === 'ecaz' ? ['emperor'] as const : [])];
  let game = options.initial ? copy(options.initial) : createGame('DISCOVERYSTANDALONEE3SKILLS',
    newPlayer(options.seatIds?.[0] ?? factions[0], factions[0], factions[0]), advanced, ['ecaz']);
  if (!options.initial) for (const faction of factions.slice(1))
    joinGame(game, newPlayer(options.seatIds?.[game.players.length] ?? faction, faction, faction));
  const tech = options.tech ?? !!game.techTokens, strongholds = options.strongholds ?? !!game.strongholdCards;
  assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(game.players.length >= (tech ? 3 : 2) && game.players.length <= 6);
  assert.equal(new Set(game.players.map(p => p.faction)).size, game.players.length);
  assert.equal(game.players.filter(p => p.faction === native).length, 1);
  assert.ok(game.players.every(p => p.faction === native || ['atreides', 'guild', 'emperor', 'fremen', 'beneGesserit',
    ...(advanced ? [] : ['harkonnen'])].includes(p.faction)));
  assert.ok(advanced || native !== 'ecaz' || game.players.length % 2 === 0, 'Basic odd-seat Ecaz remains source guarded.');
  assert.ok(!strongholds || advanced);
  assert.ok(!game.homeworlds && !game.ecazTreachery && !game.advancedPreview && !game.semutaPreview &&
    !game.spiceBankerIncomePreview && !game.mentatQuestionPreview);
  if (game.status === 'lobby') {
    if (!!game.techTokens !== tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: tech });
    if (!!game.strongholdCards !== strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: strongholds });
    game.discoveryEnabled = true; game.nexusCards ??= { cards: null, phase: null };
    assert.deepEqual(game.nexusCards, { cards: null, phase: null });
    for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
    if (options.initial) game = initializeLeaderSkillsGameForAudit(game);
    else {
      const skill = options.skill ?? 'warmaster';
      const passive: LeaderSkillId[] = ['suk-graduate', 'sandmaster', 'killer-medic', 'prana-bindu-adept', 'master-of-assassins', 'swordmaster-of-ginaz']
        .filter(s => s !== skill) as LeaderSkillId[];
      const selected = game.players.map(p => p.faction === native ? skill : passive.shift()!);
      const source = LEADER_SKILL_CARDS.map(c => c.id), remainder = source.filter(s => !selected.includes(s));
      const desired = selected.flatMap(s => [s, remainder.shift()!]); desired.push(...remainder);
      game = shuffled(source, desired, () => initializeLeaderSkillsGameForAudit(game));
    }
  }
  assert.ok(game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    ['prediction', 'leaderSkills'].includes(game.setupStage!) && game.leaderSkills?.assignments.length === 0 &&
    game.players.every(p => !p.traitors.length && !p.traitorChoices.length), 'Only original unassigned setup may continue; starting hands stay held.');
  assert.ok(game.discoveryEnabled && game.discoveries && game.nexusCards?.cards);
  assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, strongholds);
  return game;
}
export function nextDiscoveryStandaloneNexusE3SkillsStep(game: Game): DiscoveryStandaloneNexusE3SkillsStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard && game.decision &&
    ['discoveryEntry', 'greatMakerRide', 'greatMakerVote', 'wormRide', 'wormPlacement', 'wormProtection',
      'advisor', 'intrusion', 'discoveryDiscard'].includes(game.decision.kind)) return nextClassicDiscoveryNexusStep(game);
  if (game.decision?.kind === 'ecazBattleLead' && !game.response && !game.phaseOpening) return null;
  if (game.decision?.kind === 'rihani' && !game.response && !game.phaseOpening)
    return { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, draw: false } };
  return game.players.some(p => p.faction === 'ecaz')
    ? nextEcazNexusSkillsModulesStep(game) : nextMoritaniNexusSkillsModulesStep(game);
}
export function stepDiscoveryStandaloneNexusE3Skills(game: Game, step: DiscoveryStandaloneNexusE3SkillsStep,
  actions?: DiscoveryStandaloneNexusE3SkillsStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(game, step.actor, step.action));
}
export function advanceDiscoveryStandaloneNexusE3Skills(game: Game, until: (state: Game) => boolean,
  actions?: DiscoveryStandaloneNexusE3SkillsStep[]): Game {
  for (let count = 0; count < 2400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextDiscoveryStandaloneNexusE3SkillsStep(game); assert.ok(next, 'Actual owner must select the Occupy lead or seal a Battle Plan.');
    if (game.turn === 1 && next.action.type === 'stormDial') next.action.amount = 0;
    game = stepDiscoveryStandaloneNexusE3Skills(game, next, actions);
  }
  throw Error('Original standalone E3 Discovery chronology did not reach its boundary.');
}
export function completeDiscoveryStandaloneNexusE3SkillsSetup(state: Game,
  options: DiscoveryStandaloneNexusE3SkillsOptions = {}, actions?: DiscoveryStandaloneNexusE3SkillsStep[]): Game {
  let game = copy(state);
  const owner = game.players.find(p => p.faction === 'ecaz' || p.faction === 'moritani')!.id;
  for (let count = 0; game.status === 'setup' && count < 240; count++) {
    if (game.setupStage !== 'leaderSkills') {
      const next = nextDiscoveryStandaloneNexusE3SkillsStep(game); assert.ok(next);
      if (game.setupStage === 'traitors' && next.actor === owner) {
        const trained = new Set(game.leaderSkills!.assignments.filter(a => a.owner !== owner).map(a => a.leader));
        const target = discoveryStandaloneNexusE3SkillsPlayer(game, owner).traitorChoices.find(id => trained.has(id));
        if (target) next.action = { type: 'traitor', leader: target };
      }
      game = stepDiscoveryStandaloneNexusE3Skills(game, next, actions); continue;
    }
    const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
    const requested = actor === owner ? options.skill : undefined;
    const legal = own.offer!.cards.filter(s => !own.unavailableSkills?.[s]);
    const skill = requested ?? legal[0]; assert.ok(skill && legal.includes(skill));
    const discs = own.eligibleLeaders;
    const leader = actor === owner && options.leader ? discs.find(l => l.id === options.leader)
      : discoveryStandaloneNexusE3SkillsPlayer(game, actor).faction === 'guild' && skill === 'suk-graduate'
        ? discs.find(l => l.name === 'Master Bewt') : discs[0];
    assert.ok(leader, 'Training uses a genuinely eligible owned native disc, never Duke or a foreign disc.');
    const step: DiscoveryStandaloneNexusE3SkillsStep = { actor, action: { type: 'leaderSkill', event: own.offer!.event, skill, leader: leader.id } };
    if (!options.initial && game.players.some(p => p.faction === 'moritani') && Object.keys(game.leaderSkills!.offers).length === 1) {
      const opponent = (game.players.find(p => p.faction === 'guild') ?? game.players.find(p => p.id !== owner))!.id;
      const target = actor === opponent ? leader.id : game.leaderSkills!.assignments.find(a => a.owner === opponent)?.leader;
      assert.ok(target, 'The original opposing trained disc must exist before the pending Traitor deal.');
      const source = traitorDeck(game.players, false), desired = source.filter(id => id !== target);
      desired.splice(game.players.findIndex(p => p.id === owner) * 4, 0, target);
      actions?.push(structuredClone(step));
      // chooseLeaderSkill first shuffles its rejected card back into the remaining
      // skill deck (old deck length draws); only THEN does advanceSetup deal Traitors.
      game = shuffled(source, desired, () => applyAction(game, actor, step.action), game.leaderSkills!.deck.length);
    } else game = stepDiscoveryStandaloneNexusE3Skills(game, step, actions);
  }
  assert.equal(game.status, 'playing'); return game;
}
function reserveBoard(game: Game, staging: string[]): void {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((sum, count) => sum + count, 0); p.forces = {};
    if (p.elites) { p.elites.reserves += Object.values(p.elites.forces).reduce((sum, count) => sum + count, 0); p.elites.forces = {}; }
    if (p.advisors) p.advisors = {};
  }
  staging.push('Conserved original board counters through OWN typed reserves; no held cards, wallets, earned custody, clocks, deaths or results assigned.');
}
export function positionDiscoveryStandaloneNexusE3Skills(game: Game, actor: string, location: string, normal: number,
  staging: string[]): void {
  const p = discoveryStandaloneNexusE3SkillsPlayer(game, actor);
  assert.ok(Number.isSafeInteger(normal) && normal >= 0 && p.reserves - (p.elites?.reserves ?? 0) >= normal);
  p.reserves -= normal; p.forces[location] = (p.forces[location] ?? 0) + normal;
  staging.push(`Conserved ${normal} original ordinary ${actor} counters: own reserves → ${location}.`);
}
export function assertDiscoveryStandaloneNexusE3SkillsCustody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players); validateDiscoveryState(game.discoveries!);
  validateNexusCards(game.nexusCards!.cards!, game.players);
  assert.deepEqual([...game.leaderSkills!.deck, ...Object.values(game.leaderSkills!.offers).flatMap(o => o.cards),
    ...game.leaderSkills!.assignments.map(a => a.skill)].sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
  const nexus = game.nexusCards!.cards!;
  assert.deepEqual([...nexus.deck, ...nexus.discard, ...Object.values(nexus.hands).filter((c): c is FactionId => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])].map(c => c.id).sort(), treacheryDeck(['ecaz']).map(c => c.id).sort());
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, count) => sum + count, 0), 20);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, count) => sum + count, 0), p.faction === 'emperor' ? 5 : 3);
  }
}
/** Human endpoint: actual reveal then first END Mentat; free entry is before next Storm. */
export function createDiscoveryStandaloneNexusE3SkillsFixture(options: DiscoveryStandaloneNexusE3SkillsOptions = {}): DiscoveryStandaloneNexusE3SkillsFixture {
  const setup = initializeDiscoveryStandaloneNexusE3Skills(options), initial = options.initial ? copy(options.initial) : copy(setup);
  const actions: DiscoveryStandaloneNexusE3SkillsStep[] = [], staging: string[] = [];
  staging.push('Continuation uses the existing explicit scalar fixture lottery for original Storm/Spice outcomes; byte-array UUID entropy remains native. This is controlled source play, not natural random history.');
  if (!options.initial) staging.push('Controlled only the original physical all14 first shuffle; for Moritani, controlled the original pending Traitor shuffle before its real selection. No offered or held card is injected.');
  let game = completeDiscoveryStandaloneNexusE3SkillsSetup(setup, options, actions);
  const trained = copy(game), owner = game.players.find(p => p.faction === 'ecaz' || p.faction === 'moritani')!.id;
  const native = discoveryStandaloneNexusE3SkillsPlayer(game, owner).faction as DiscoveryStandaloneNexusE3SkillsNative;
  const opponent = (game.players.find(p => p.faction === 'guild') ?? game.players.find(p => p.id !== owner))!.id;
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === owner)!;
  const target = discoveryStandaloneNexusE3SkillsPlayer(game, owner).traitors.find(id =>
    game.leaderSkills!.assignments.some(a => a.owner === opponent && a.leader === id)) ?? null;
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.phase === 1 && discoveryStandaloneNexusE3SkillsClean(g), actions);
  const afterFirstStorm = copy(game); orderDiscoveryClassicNexusSkillsSpice(game, false, staging);
  for (let count = 0; !game.discoveries!.tokens.some(t => t.face === 'cistern' && t.status === 'placed') && count < 120; count++) {
    const next = nextDiscoveryStandaloneNexusE3SkillsStep(game); assert.ok(next); actions.push(structuredClone(next));
    game = withClassicDiscoveryNexusToken(game, 'cistern', () => applyAction(game, next.actor, next.action));
  }
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.phase === 5 && discoveryStandaloneNexusE3SkillsClean(g), actions);
  reserveBoard(game, staging);
  const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const source = `${placement.territory}:${placement.sector}`, wormSource = 'hagga_basin:12';
  const claim: StrongholdId = native === 'moritani' ? 'tueks_sietch' : 'arrakeen';
  positionDiscoveryStandaloneNexusE3Skills(game, owner, source, 3, staging);
  positionDiscoveryStandaloneNexusE3Skills(game, owner, wormSource, 6, staging);
  if (game.strongholdCards) positionDiscoveryStandaloneNexusE3Skills(game, owner, `${claim}:${territory(claim).sectors[0]}`, 1, staging);
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.phase === 7 && discoveryStandaloneNexusE3SkillsClean(g), actions);
  const collection = copy(game), token = game.discoveries!.tokens.find(t => t.face === 'cistern')!.id;
  for (const reveal of [false, true]) game = stepDiscoveryStandaloneNexusE3Skills(game, { actor: owner, action: { type: 'discovery', token, reveal } }, actions);
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.phase === 8 && discoveryStandaloneNexusE3SkillsClean(g), actions);
  let firstMentat: DiscoveryStandaloneNexusE3SkillsTransition | undefined;
  while (game.turn === 1) {
    const before = copy(game), step = nextDiscoveryStandaloneNexusE3SkillsStep(game); assert.ok(step);
    game = stepDiscoveryStandaloneNexusE3Skills(game, step, actions);
    if (game.turn === 2) firstMentat = { before, step, after: copy(game) };
  }
  assert.ok(firstMentat); assert.equal(game.decision?.kind, 'discoveryEntry'); assert.equal(game.decision!.player, owner);
  return { initial, setup, trained, afterFirstStorm, collection, firstMentat, game, native, owner, opponent,
    fremen: game.players.find(p => p.faction === 'fremen')?.id ?? null, leader: assignment.leader, skill: assignment.skill,
    target, token, source, wormSource, claim, actions, staging };
}
export function enterDiscoveryStandaloneNexusE3Skills(f: DiscoveryStandaloneNexusE3SkillsFixture, amount = 3): Game {
  const game = copy(f.game), view = viewGame(game, f.owner);
  const source = view.discoveryEntry!.sources.find(s => s.normal >= amount); assert.ok(source);
  const action = discoveryEntryMoveAction(view, [{ source: source.source, normal: amount, elite: 0 }]); assert.ok(action);
  return stepDiscoveryStandaloneNexusE3Skills(game, { actor: f.owner, action }, f.actions);
}
/** Original Maker deaths, all votes, actual typed reserve ride, settled alliance and BOTH piles close before drawing. */
export function closeDiscoveryStandaloneNexusE3Skills(f: DiscoveryStandaloneNexusE3SkillsFixture,
  target: FactionId | undefined = f.native): DiscoveryStandaloneNexusE3SkillsClosing {
  assert.ok(f.game.players.length >= 3, 'A qualified native draw needs two other real alliance seats.');
  let game = enterDiscoveryStandaloneNexusE3Skills(f); const entered = copy(game);
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.phase === 1 && discoveryStandaloneNexusE3SkillsClean(g), f.actions);
  orderDiscoveryClassicNexusSkillsSpice(game, true, f.staging);
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.greatMaker?.stage === 'vote', f.actions);
  const vote = copy(game);
  while (game.decision?.kind === 'greatMakerVote') game = stepDiscoveryStandaloneNexusE3Skills(game,
    { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, yes: true } }, f.actions);
  let ride: DiscoveryStandaloneNexusE3SkillsTransition | null = null;
  if (game.decision?.kind === 'greatMakerRide') {
    const before = copy(game), actor = game.decision.player;
    const action = greatMakerRideAction(viewGame(game, actor), 'polar_sink', 0, 2, game.advanced ? 1 : 0); assert.ok(action);
    const step = { actor, action }; game = stepDiscoveryStandaloneNexusE3Skills(game, step, f.actions);
    ride = { before, step, after: copy(game) };
  }
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.nexus && !g.spiceWindow && !g.spiceResolution && discoveryStandaloneNexusE3SkillsClean(g), f.actions);
  const others = game.players.filter(p => p.id !== f.owner);
  for (const [actor, target] of [[others[0].id, others[1].id], [others[1].id, others[0].id]])
    game = stepDiscoveryStandaloneNexusE3Skills(game, { actor, action: { type: 'alliance', target } }, f.actions);
  const alliance = copy(game);
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.nexusCards?.phase?.stage === 'drawing' && discoveryStandaloneNexusE3SkillsClean(g), f.actions);
  const cards = game.nexusCards!.cards!;
  if (target) {
    const index = cards.deck.indexOf(target); assert.ok(index >= 0);
    cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    f.staging.push(`Conserved UNPLAYED original ${target} Nexus singleton ordered before actual native closing choice; no held-card injection.`);
  }
  const before = copy(game), step: DiscoveryStandaloneNexusE3SkillsStep = { actor: f.owner,
    action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[f.owner], choice: 'draw', ownRedraws: 0 } };
  game = stepDiscoveryStandaloneNexusE3Skills(game, step, f.actions);
  return { entered, vote, ride, alliance, draw: { before, step, after: copy(game) }, game };
}
export function cunningDiscoveryStandaloneNexusE3Skills(f: DiscoveryStandaloneNexusE3SkillsFixture,
  state: Game): DiscoveryStandaloneNexusE3SkillsTransition {
  let game = copy(state);
  if (f.native === 'ecaz') {
    game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.phase === 5 && discoveryStandaloneNexusE3SkillsClean(g), f.actions);
    reserveBoard(game, f.staging);
    if (game.strongholdCards)
      positionDiscoveryStandaloneNexusE3Skills(game, f.owner, `${f.claim}:${territory(f.claim).sectors[0]}`, 1, f.staging);
    // With no physical clash, the original engine skips Battle altogether.
    // Keep a real chooser pending, but do not open a battle before quiet Cunning.
    for (const actor of [f.owner, f.opponent])
      positionDiscoveryStandaloneNexusE3Skills(game, actor, 'cistern:0', 1, f.staging);
  }
  const phase = f.native === 'ecaz' ? 6 : 8;
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.phase === phase &&
    (f.native === 'ecaz' ? discoveryStandaloneNexusE3SkillsClean(g) : g.decision?.kind === 'moritaniPlacement') && !g.battle, f.actions);
  const before = copy(game), step = f.native === 'ecaz' ? ecazNexusSkillsModulesCunningRequest(game, f.owner)
    : { actor: f.owner, action: moritaniNexusSkillsModulesRequest(game, f.owner, 'robbery', 'red_chasm') };
  game = stepDiscoveryStandaloneNexusE3Skills(game, step, f.actions);
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => !g.response && !g.phaseOpening && !g.pendingKarama, f.actions);
  return { before, step, after: game };
}
/** A requested face reaches the hand ONLY through an actual original auction and payment. */
function buyWorthless(f: DiscoveryStandaloneNexusE3SkillsFixture, state: Game, actor: string,
  enemy?: string): { game: Game; card: string; enemyCard?: string } {
  let game = advanceDiscoveryStandaloneNexusE3Skills(state, g => g.phase === 2 && discoveryStandaloneNexusE3SkillsClean(g), f.actions);
  const wanted: { actor: string; card: string }[] = [], front: Game['deck'] = [];
  for (const id of [actor, ...(enemy ? [enemy] : [])]) {
    const held = discoveryStandaloneNexusE3SkillsPlayer(game, id).hand.find(c => c.kind === 'worthless');
    if (held) { wanted.push({ actor: id, card: held.id }); continue; }
    const index = game.deck.findIndex(c => c.kind === 'worthless'); assert.ok(index >= 0);
    const card = game.deck.splice(index, 1)[0]; front.push(card); wanted.push({ actor: id, card: card.id });
    f.staging.push(`Conserved original UNPLAYED Ecaz33 ${card.id} ordered before auction; actual bidder and payment alone acquire it.`);
  }
  game.deck.unshift(...front);
  for (let count = 0; count < 320; count++) {
    if (wanted.every(w => discoveryStandaloneNexusE3SkillsPlayer(game, w.actor).hand.some(c => c.id === w.card)))
      return { game, card: wanted[0].card, enemyCard: wanted[1]?.card };
    const next = nextDiscoveryStandaloneNexusE3SkillsStep(game); assert.ok(next);
    if (game.phase === 3 && !game.response && !game.phaseOpening && !game.decision && game.auction && !game.auction.bid) {
      const buyer = wanted.find(w => w.card === game.auction!.cards[game.auction!.index]?.id && w.actor === game.auction!.active);
      if (buyer) next.action = { type: 'bid', amount: 1 };
    }
    game = stepDiscoveryStandaloneNexusE3Skills(game, next, f.actions);
  }
  throw Error('Actual auction did not deliver its physical requested faces.');
}
/** For Ecaz, occupy requests a later REAL Nexus alliance and returns the mandatory lead choice.
 * No alliance is assigned and no quiet Duke custody is confused with native training. */
export function openDiscoveryStandaloneNexusE3SkillsBattle(f: DiscoveryStandaloneNexusE3SkillsFixture, state: Game,
  options: { occupy?: boolean; lead?: 'native' | 'ally'; normalCall?: boolean } = {}): DiscoveryStandaloneNexusE3SkillsBattle {
  let game = copy(state), ally: string | null = null;
  if (options.occupy) {
    assert.equal(f.native, 'ecaz'); assert.ok(game.advanced && game.players.length >= 3);
    // Quiet Cunning left an actual, unopened clash. Resolve it with original
    // discs and zero-dial sealed plans before the later Occupy Nexus; never
    // erase its chooser or advance a fabricated Battle result.
    if (game.phase === 6 && !game.battle) {
      const chooser = game.active!;
      game = stepDiscoveryStandaloneNexusE3Skills(game, { actor: chooser,
        action: { type: 'chooseBattle', territory: 'cistern', target: chooser === f.owner ? f.opponent : f.owner } }, f.actions);
      for (let count = 0; count < 160; count++) {
        const next = nextDiscoveryStandaloneNexusE3SkillsStep(game);
        if (!next) break;
        game = stepDiscoveryStandaloneNexusE3Skills(game, next, f.actions);
      }
      assert.ok(game.battle && !game.battle.revealed && discoveryStandaloneNexusE3SkillsClean(game));
      const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
      const defender = discoveryStandaloneNexusE3SkillsPlayer(game, f.opponent).leaders
        .filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0];
      assert.ok(defender);
      game = revealDiscoveryNativeE3SkillsPlans(game, [
        { actor: f.owner, action: { type: 'battlePlan', leader: f.leader, dial: 0, support: 0 } },
        { actor: f.opponent, action: { type: 'battlePlan', leader: defender.id, dial: 0, support: 0 } },
      ], f.actions);
      game = finishDiscoveryStandaloneNexusE3SkillsBattle(game, f.actions);
    }
    const turn = game.turn;
    game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.turn > turn && g.phase === 1 && discoveryStandaloneNexusE3SkillsClean(g), f.actions);
    const front: Game['spiceDeck'] = [];
    for (const kind of ['worm', 'land', 'land']) {
      const index = game.spiceDeck.findIndex(c => kind === 'worm' ? 'worm' in c && !c.greatMaker : 'territory' in c && !c.discovery);
      assert.ok(index >= 0); front.push(game.spiceDeck.splice(index, 1)[0]);
    }
    game.spiceDeck.unshift(...front); f.staging.push('Conserved original unplayed ordinary worm and both replacement lands for a later actual Occupy alliance.');
    game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.nexus && !g.spiceWindow && !g.spiceResolution && discoveryStandaloneNexusE3SkillsClean(g), f.actions);
    ally = game.players.find(p => p.id !== f.owner && p.id !== f.opponent)!.id;
    if (discoveryStandaloneNexusE3SkillsPlayer(game, ally).ally)
      game = stepDiscoveryStandaloneNexusE3Skills(game, { actor: ally, action: { type: 'alliance', target: null } }, f.actions);
    for (const [actor, target] of [[f.owner, ally], [ally, f.owner]])
      game = stepDiscoveryStandaloneNexusE3Skills(game, { actor, action: { type: 'alliance', target } }, f.actions);
  }
  const actor = options.lead === 'ally' ? ally! : f.owner;
  const bought = buyWorthless(f, game, actor, f.native === 'moritani' ? f.opponent : undefined); game = bought.game;
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.phase === 5 && discoveryStandaloneNexusE3SkillsClean(g), f.actions);
  reserveBoard(game, f.staging);
  const site = f.native === 'moritani' && game.strongholdCards ? 'tueks_sietch' : 'cistern';
  const location = `${site}:${site === 'cistern' ? 0 : territory(site).sectors[0]}`;
  for (const id of [f.owner, f.opponent, ...(ally ? [ally] : [])])
    positionDiscoveryStandaloneNexusE3Skills(game, id, location, ally && id === f.owner ? 3 : 6, f.staging);
  game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.phase === 6 && discoveryStandaloneNexusE3SkillsClean(g), f.actions);
  if (f.native === 'ecaz' && !ally && viewGame(game, f.owner).nexusEcazDuke?.blocked === null)
    game = stepDiscoveryStandaloneNexusE3Skills(game, ecazNexusSkillsModulesCunningRequest(game, f.owner), f.actions);
  const beforeBattle = copy(game);
  const chooser = game.active!; assert.ok([f.owner, f.opponent, ally].includes(chooser));
  const choice = viewGame(game, chooser).battleChoices.find(c => c.chooser === chooser && c.territory === site &&
    (c.attacker === f.opponent || c.defender === f.opponent));
  assert.ok(choice, 'Choose the actual unresolved physical coalition battle at this site.');
  const target = chooser === f.opponent
    ? choice.attacker === chooser ? choice.defender : choice.attacker
    : f.opponent;
  game = stepDiscoveryStandaloneNexusE3Skills(game, { actor: chooser,
    action: { type: 'chooseBattle', territory: site, target } }, f.actions);
  let leadChoice: DiscoveryStandaloneNexusE3SkillsTransition | null = null;
  if (ally) {
    game = advanceDiscoveryStandaloneNexusE3Skills(game, g => g.decision?.kind === 'ecazBattleLead' && !g.response && !g.phaseOpening, f.actions);
    const decision = game.decision; assert.ok(decision?.kind === 'ecazBattleLead');
    const before = copy(game), step: DiscoveryStandaloneNexusE3SkillsStep = { actor: f.owner,
      action: { type: 'decision', event: decision.event, lead: actor } };
    game = stepDiscoveryStandaloneNexusE3Skills(game, step, f.actions); leadChoice = { before, step, after: copy(game) };
  }
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const own = discoveryStandaloneNexusE3SkillsPlayer(game, actor);
  const enemy = discoveryStandaloneNexusE3SkillsPlayer(game, f.opponent);
  const leader = f.native === 'ecaz' ? game.leaderSkills!.assignments.find(a => a.owner === actor)!.leader
    : own.leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0].id;
  const enemyLeader = options.normalCall ? own.traitors.find(id => enemy.leaders.some(l => l.id === id && !l.dead))
    : enemy.leaders.filter(l => !l.dead && !trained.has(l.id) && l.id !== f.target).sort((a, b) => f.native === 'ecaz' ? a.strength - b.strength : b.strength - a.strength)[0]?.id;
  assert.ok(enemyLeader, 'Normal-call case requires an actually held opposing Traitor, never a transfer.');
  for (let count = 0; count < 160; count++) {
    const next = nextDiscoveryStandaloneNexusE3SkillsStep(game);
    if (!next) break;
    if (next.action.type === 'leaderSkillVisibility') {
      const planned = next.actor === actor ? leader : next.actor === f.opponent ? enemyLeader : null;
      next.action.hide = game.leaderSkills!.assignments.some(a => a.owner === next.actor && a.leader === planned);
    }
    game = stepDiscoveryStandaloneNexusE3Skills(game, next, f.actions);
  }
  assert.ok(game.battle && !game.battle.revealed && discoveryStandaloneNexusE3SkillsClean(game));
  const dial = f.native === 'ecaz' ? 1 : 4;
  const fixedDial = viewGame(game, actor).battle!.ecazOccupy?.profile?.fixedEcazDial ?? 0;
  return { beforeBattle, leadChoice, game, actor, opponent: f.opponent, leader, enemyLeader, location, card: bought.card, enemyCard: bought.enemyCard,
    target: f.target, plans: [
      { actor, action: { type: 'battlePlan', leader, dial: fixedDial + 1,
        support: game.advanced && discoveryStandaloneNexusE3SkillsPlayer(game, ally ?? actor).faction !== 'fremen' ? 1 : 0, weapon: bought.card } },
      { actor: f.opponent, action: { type: 'battlePlan', leader: enemyLeader, dial, support: game.advanced && enemy.faction !== 'fremen' ? dial : 0, weapon: bought.enemyCard } },
    ] };
}
export function revealDiscoveryStandaloneNexusE3SkillsBattle(battle: DiscoveryStandaloneNexusE3SkillsBattle,
  actions?: DiscoveryStandaloneNexusE3SkillsStep[]): Game {
  return revealDiscoveryNativeE3SkillsPlans(copy(battle.game), battle.plans, actions);
}
export function settleDiscoveryStandaloneNexusE3SkillsBattle(state: Game, callers: readonly string[] = [],
  actions?: DiscoveryStandaloneNexusE3SkillsStep[]): DiscoveryStandaloneNexusE3SkillsBoundary {
  let game = copy(state);
  const choices: Partial<Record<NonNullable<Game['decision']>['kind'], DiscoveryStandaloneNexusE3SkillsBoundary['kind']>> = {
    battleLosses: 'losses', sukRescue: 'rescue', moritaniAssassinate: 'assassination', battleCards: 'cards', techToken: 'tech',
  };
  for (let count = 0; count < 240; count++) {
    const kind = game.decision && choices[game.decision.kind];
    if (kind && !game.response && !game.phaseOpening) return { game, kind };
    if (!game.battle && discoveryStandaloneNexusE3SkillsClean(game)) return { game, kind: 'settled' };
    const next = nextDiscoveryStandaloneNexusE3SkillsStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = callers.includes(next.actor);
    game = stepDiscoveryStandaloneNexusE3Skills(game, next, actions);
  }
  throw Error('Original human settlement boundary did not open.');
}
export function finishDiscoveryStandaloneNexusE3SkillsBattle(state: Game,
  actions?: DiscoveryStandaloneNexusE3SkillsStep[]): Game {
  return advanceDiscoveryStandaloneNexusE3Skills(copy(state), g => !g.battle && discoveryStandaloneNexusE3SkillsClean(g), actions);
}
