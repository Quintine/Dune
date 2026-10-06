import assert from 'node:assert/strict';
import { applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game, type Player } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { territory } from '../game/board';
import { treacheryDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { quoteNativeReserveWithdrawal } from '../game/homeworld-native-reserves';
import { homeworldCombatLocation } from '../game/homeworld-combat';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type ClassicHomeworldSkillsStep = { actor: string; action: Action };
export type ClassicHomeworldSkillsCase = 'native-bonus' | 'visitor-bonus' | 'native-death' | 'visitor-death' | 'native-suk' | 'visitor-suk' | 'arrakis-suk' | 'smuggler-payment';
export type ClassicHomeworldSkillsSetup = {
  initial: Game;
  offered: Game;
  afterSetup: Game;
  actions: ClassicHomeworldSkillsStep[];
  staging: string[];
};
export type ClassicHomeworldSkillsFixture = ClassicHomeworldSkillsSetup & {
  kind: ClassicHomeworldSkillsCase;
  beforeShipment: Game | null;
  shipment: ClassicHomeworldSkillsStep | null;
  afterShipment: Game | null;
  beforeBattle: Game | null;
  game: Game;
  owner: string;
  opponent: string;
  trainer: string;
  territory: string;
  plans: ClassicHomeworldSkillsStep[];
};
export const classicHomeworldSkillsPlayer = (game: Game, id: string): Player => {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
};
const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

export function assertClassicHomeworldSkillsCustody(game: Game): void {
  homeworldGameIntegrity(game);
  validateLeaderSkills(game.leaderSkills!, game.players);
  const homes = game.homeworlds?.custody ? homeworldForceGroups(homeworldContext(game), game.homeworlds.custody) : [];
  for (const player of game.players) {
    const visitors = homes.filter(home => home.native !== player.id).map(home => home.forces[player.id] ?? { normal: 0, elite: 0 });
    assert.equal(player.reserves + player.tanks + sum(player.forces) + visitors.reduce((n, pool) => n + pool.normal + pool.elite, 0), 20, player.faction);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks + sum(player.elites.forces) + visitors.reduce((n, pool) => n + pool.elite, 0), player.faction === 'emperor' ? 5 : 3, player.faction);
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand), ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(), treacheryDeck([]).map(c => c.id).sort());
}

/** Compute actual Fisher-Yates draws, not an assignment or held-card injection. */
function permutationDraws<T>(source: readonly T[], desired: readonly T[]): number[] {
  const current = [...source], draws: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    draws.push(Math.floor(((j + 0.5) / (i + 1)) * 4294967296));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); return draws;
}
function originalLottery<T>(draws: readonly number[], run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let index = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = draws[index++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function classicHomeworldSkillsBotOffers(game: Game, actor: string, difficulty: Difficulty): Action[] {
  const view = viewGame(game, actor);
  view.players.find(p => p.id === actor)!.bot = difficulty;
  return botActions(view);
}

/** Original all-fourteen setup. Only original skill and Treachery shuffle draws
 * are controlled. Starting hands, wallets, offers and leader custody are dealt
 * by the original initializer and selected with real setup actions. */
export function createClassicHomeworldSkillsSetup(options: {
  advanced?: boolean;
  roster?: readonly FactionId[];
  initial?: Game;
  skill?: LeaderSkillId;
} = {}): ClassicHomeworldSkillsSetup {
  const roster = options.roster ?? ['emperor', 'guild', 'atreides', 'harkonnen'];
  let game = options.initial ? structuredClone(options.initial)
    : createGame('CLASSICHWSKILLS', newPlayer(roster[0], roster[0], roster[0]), options.advanced ?? false);
  if (!options.initial) for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  assert.ok(game.status === 'lobby' || (game.status === 'setup' && game.leaderSkills && game.homeworlds && game.turn === 1 && game.phase === 0),
    'Continue only an original fresh lobby or its existing Homeworld Skills setup.');
  if (game.status === 'lobby') {
    if (!game.homeworlds) game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
    for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
  }
  const initial = structuredClone(game), actions: ClassicHomeworldSkillsStep[] = [];
  const owner = game.players[0].id, skill = options.skill ?? 'mentat';
  const canonical = LEADER_SKILL_CARDS.map(c => c.id), requested: LeaderSkillId[] = [skill];
  for (const p of game.players.slice(1)) {
    const preferred: LeaderSkillId = p.faction === 'atreides' ? 'bureaucrat' :
      p.faction === 'harkonnen' ? 'smuggler' : p.faction === 'guild' ? 'swordmaster-of-ginaz' :
        p.faction === 'fremen' ? 'killer-medic' : 'prana-bindu-adept';
    const selected = requested.includes(preferred)
      ? (['warmaster', 'planetologist', 'diplomat', 'master-of-assassins', 'sandmaster'] as const).find(id => !requested.includes(id))!
      : preferred;
    assert.ok(selected); requested.push(selected);
  }
  const rest = canonical.filter(id => !requested.includes(id));
  const desired = requested.flatMap(id => [id, rest.shift()!]).concat(rest);
  const cards = treacheryDeck([]), prefix: string[] = [];
  for (const [index, player] of game.players.entries()) {
    const kind = index === 0 ? 'worthless' : index === 1 ? 'projectile' : 'snooper';
    const card = cards.find(c => c.kind === kind && !prefix.includes(c.id)) ?? cards.find(c => !prefix.includes(c.id))!;
    prefix.push(card.id);
    if (player.faction === 'harkonnen') prefix.push(cards.find(c => !prefix.includes(c.id))!.id);
  }
  const deckOrder = [...prefix, ...cards.map(c => c.id).filter(id => !prefix.includes(id))];
  if (game.status === 'lobby') game = originalLottery(
    [...permutationDraws(canonical, desired), ...permutationDraws(cards.map(c => c.id), deckOrder)],
    () => initializeLeaderSkillsGameForAudit(game));
  let offered: Game | null = null;
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    let next: ClassicHomeworldSkillsStep;
    if (game.setupStage === 'leaderSkills') {
      offered ??= structuredClone(game);
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const view = viewGame(game, actor).leaderSkills!, offer = view.offer!;
      const selected = requested[game.players.findIndex(p => p.id === actor)];
      assert.ok(offer.cards.includes(selected));
      assert.ok(!view.unavailableSkills?.[selected]);
      const leaders = view.eligibleLeaders.map(l => classicHomeworldSkillsPlayer(game, actor).leaders.find(disc => disc.id === l.id)!)
        .sort((a, b) => b.strength - a.strength);
      assert.ok(leaders[0]);
      next = { actor, action: { type: 'leaderSkill', event: offer.event, skill: selected, leader: leaders[0].id } };
    } else {
      const candidate = nextStrongholdFactionsNativeStep(game); assert.ok(candidate); next = candidate;
    }
    actions.push(structuredClone(next)); game = applyAction(game, next.actor, next.action);
  }
  assert.ok(offered); assert.equal(game.status, 'playing');
  assert.ok(game.leaderSkills!.assignments.some(a => a.owner === owner && a.skill === skill));
  assertClassicHomeworldSkillsCustody(game);
  return { initial, offered, afterSetup: structuredClone(game), actions,
    staging: ['Controlled the original skill/Treachery lottery before any component was dealt; all starting hands and skill assignments are real setup selections.'] };
}

export function nextClassicHomeworldSkillsStep(game: Game, hideOwner?: string): ClassicHomeworldSkillsStep | null {
  const decision = game.decision;
  if (decision?.kind === 'leaderSkillVisibility') return { actor: decision.player, action: {
    type: 'leaderSkillVisibility', event: decision.event, hide: decision.player === hideOwner,
  } };
  if (decision?.kind === 'mentatQuestion') return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
  if (decision?.kind === 'rihani') return { actor: decision.player, action: { type: 'decision', event: decision.event, draw: false } };
  if (decision?.kind === 'bureaucratPayment') return { actor: decision.player, action: { type: 'decision', event: game.bureaucratPaymentEvent, redirect: false } };
  if (decision?.kind === 'sukRescue') return null;
  if (decision?.kind === 'battleLosses' && game.advanced && game.pendingSukRescue) {
    const elite = Math.max(...decision.options.map(option => option.elite));
    return { actor: decision.player, action: { type: 'decision',
      choice: decision.options.findIndex(option => option.elite === elite) } };
  }
  if (decision?.kind === 'homeworldDefense') return { actor: decision.player, action: { type: 'decision', event: decision.event, use: false } };
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceClassicHomeworldSkills(state: Game, until: (game: Game) => boolean,
  actions?: ClassicHomeworldSkillsStep[], hideOwner?: string): Game {
  let game = state;
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    const next = nextClassicHomeworldSkillsStep(game, hideOwner); assert.ok(next, 'A real human Battle Plan or Suk choice is required');
    actions?.push(structuredClone(next)); game = applyAction(game, next.actor, next.action);
  }
  throw Error('Original classic Homeworld Skills programme did not reach its requested boundary');
}

function shipHome(game: Game, actor: string, destination: string, normal: number, elite: number): ClassicHomeworldSkillsStep {
  const player = classicHomeworldSkillsPlayer(game, actor);
  const sources = player.faction === 'emperor' && game.advanced ? {
    'homeworld:emperor': { normal, elite: 0 }, 'homeworld:emperor:salusa': { normal: 0, elite },
  } : { [`homeworld:${player.faction}`]: { normal, elite } };
  return { actor, action: { type: 'homeworldShip', event: viewGame(game, actor).homeworldShipment!.event, destination, sources } };
}
/** Genuine phase sequence and invasion shipment. The Arrakis case alone uses a
 * labeled conserved later board position; it never fabricates a battle window,
 * casualty, death, invoice, skill assignment or held card. */
export function createClassicHomeworldSkillsFixture(options: { kind?: ClassicHomeworldSkillsCase; advanced?: boolean; initial?: Game } = {}): ClassicHomeworldSkillsFixture {
  const kind = options.kind ?? 'native-bonus', advanced = options.advanced ?? false;
  const skill = kind.includes('suk') ? 'suk-graduate' : kind === 'smuggler-payment' ? 'smuggler' : 'mentat';
  const roster: FactionId[] = ['emperor', 'guild', 'atreides', 'harkonnen'];
  const setup = createClassicHomeworldSkillsSetup({ advanced, initial: options.initial, roster, skill });
  let game = advanceClassicHomeworldSkills(setup.afterSetup, g => g.phase === 5 && clean(g), setup.actions);
  const owner = game.players[0].id, opponent = game.players[1].id;
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === owner)!.leader;
  const visitor = kind.startsWith('visitor');
  const location = kind === 'arrakis-suk' ? 'false_wall_south' : kind === 'smuggler-payment' ? 'sietch_tabr' :
    visitor ? 'homeworld:guild' : kind === 'native-suk' && advanced ? 'homeworld:emperor:salusa' : 'homeworld:emperor';
  let beforeShipment: Game | null = null, shipment: ClassicHomeworldSkillsStep | null = null, afterShipment: Game | null = null;
  if (kind === 'arrakis-suk') {
    const count = 8, elite = advanced ? 2 : 0;
    const sources = advanced ? { 'homeworld:emperor': { normal: count - elite, elite: 0 }, 'homeworld:emperor:salusa': { normal: 0, elite } } : undefined;
    const quote = quoteNativeReserveWithdrawal(homeworldContext(game), game.homeworlds!.custody!, owner, { normal: count - elite, elite }, sources);
    game.homeworlds!.custody = quote.state;
    for (const update of quote.players) { const p = classicHomeworldSkillsPlayer(game, update.id); p.reserves = update.reserves; if (p.elites) p.elites.reserves = update.eliteReserves; }
    const key = `${location}:${territory(location).sectors[0]}`;
    classicHomeworldSkillsPlayer(game, owner).forces[key] = count;
    if (elite) classicHomeworldSkillsPlayer(game, owner).elites!.forces[key] = elite;
    const other = classicHomeworldSkillsPlayer(game, opponent);
    const total = sum(other.forces); other.forces = { [key]: total };
    setup.staging.push('Conserved later Arrakis position: eight Emperor counters withdrew from their real native homes; the original Guild board army moved to the same desert. No shipment or battle receipt is claimed for these placements.');
    assertClassicHomeworldSkillsCustody(game);
  } else {
    const actor = kind === 'smuggler-payment' || visitor ? owner : opponent;
    game = advanceClassicHomeworldSkills(game, g => g.phase === 5 && clean(g) && g.active === actor, setup.actions);
    beforeShipment = structuredClone(game);
    shipment = kind === 'smuggler-payment' ? { actor, action: { type: 'ship', territory: location,
      sector: territory(location).sectors[0], amount: 6, elite: advanced ? 2 : 0, smuggler: true,
      homeworldSources: advanced ? { 'homeworld:emperor': { normal: 4, elite: 0 }, 'homeworld:emperor:salusa': { normal: 0, elite: 2 } } : undefined } }
      : shipHome(game, actor, location, visitor ? 4 : 3, visitor && advanced ? 1 : 0);
    setup.actions.push(structuredClone(shipment)); game = applyAction(game, actor, shipment.action);
    if (game.decision?.kind === 'guildShipment') {
      const allow = { actor: game.decision.player, action: { type: 'decision', allow: true } };
      setup.actions.push(allow); game = applyAction(game, allow.actor, allow.action);
    }
    afterShipment = structuredClone(game);
    if (kind === 'smuggler-payment') return { ...setup, kind, beforeShipment, shipment, afterShipment, beforeBattle: null, game, owner, opponent, trainer, territory: location, plans: [] };
    game = advanceClassicHomeworldSkills(game, g => g.phase === 5 && clean(g), setup.actions);
  }
  game = advanceClassicHomeworldSkills(game, g => g.phase === 6 && clean(g), setup.actions);
  const beforeBattle = structuredClone(game), actor = game.active!;
  assert.ok(actor === owner || actor === opponent);
  const choose = { actor, action: { type: 'chooseBattle', territory: location, target: actor === owner ? opponent : owner } };
  setup.actions.push(choose); game = applyAction(game, actor, choose.action);
  game = advanceClassicHomeworldSkills(game, g => !!g.battle && clean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false, setup.actions, owner);
  const enemy = classicHomeworldSkillsPlayer(game, opponent);
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const leader = enemy.leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0]; assert.ok(leader);
  const weapon = kind.endsWith('death') ? enemy.hand.find(c => c.kind === 'projectile')?.id : undefined;
  if (kind.endsWith('death')) assert.ok(weapon, 'Actual original opponent starting hand holds the lethal weapon');
  const dial = kind.endsWith('death') ? 0 : kind === 'native-suk' && advanced ? 6 : 4;
  const plans: ClassicHomeworldSkillsStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: trainer, dial, support: advanced && dial && kind !== 'native-suk' ? 2 : 0 } },
    { actor: opponent, action: { type: 'battlePlan', leader: leader.id, dial: 0, weapon } },
  ];
  assertClassicHomeworldSkillsCustody(game);
  return { ...setup, kind, beforeShipment, shipment, afterShipment, beforeBattle, game, owner, opponent, trainer, territory: location, plans };
}
export function revealClassicHomeworldSkillsBattle(fixture: ClassicHomeworldSkillsFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.plans) {
    game = applyAction(game, step.actor, step.action);
    if (!game.battle?.revealed) game = advanceClassicHomeworldSkills(game, g => clean(g) && !!g.battle && !g.battle.preparation, undefined, fixture.owner);
  }
  assert.ok(game.battle?.revealed); return game;
}
export function settleClassicHomeworldSkillsBattle(state: Game, stop: 'suk' | 'complete' = 'complete'): Game {
  return advanceClassicHomeworldSkills(state, game => stop === 'suk' && game.decision?.kind === 'sukRescue' ||
    !game.battle && clean(game) && !game.pendingTreacheryDiscard);
}
export function quoteClassicHomeworldSkillsBattle(game: Game) {
  const battle = game.battle; assert.ok(battle?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const player = classicHomeworldSkillsPlayer(game, actor), view = viewGame(game, actor);
    return { id: actor, faction: player.faction, spice: player.spice, hand: player.hand,
      plan: battle.plans[actor], leader: player.leaders.find(l => l.id === battle.plans[actor].leader),
      forces: view.battle!.ownForces!, leaderSkills: view.leaderSkills!.assignments.filter(a => a.controller === actor),
      occupiedStrongholds: new Set(Object.keys(player.forces).map(key => key.split(':')[0]).filter(id => territory(id).type === 'stronghold')).size };
  };
  const home = battle.territory.startsWith('homeworld:') ? homeworldCombatLocation({ ...homeworldContext(game), order: game.order }, game.homeworlds!.custody!, battle.territory) : null;
  return quoteBattleResolution({ advanced: game.advanced, typedCasualties: true, turn: game.turn, territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor,
    ...(home ? { homeworld: { native: home.native, card: home.card, side: home.side, nativeForces: home.forces[home.native] } } : {}),
    attacker: side(battle.attacker), defender: side(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map(id => ({ id, beneficiary: id, called: battle.traitorCalls[id] ?? false, traitors: classicHomeworldSkillsPlayer(game, id).traitors })),
    participants: game.players, physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false });
}
