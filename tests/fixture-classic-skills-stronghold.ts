import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeLeaderSkillsGameForAudit,
  initializeSpiceBankerIncomeGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game, type Player,
} from '../game/engine';
import { territory } from '../game/board';
import type { Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { leaderSkillStrongholdCount } from '../game/leader-skill-battle-board';
import { createStrongholdCards, strongholdControllers, type StrongholdId } from '../game/stronghold-cards';
import { createTechTokens } from '../game/tech-tokens';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type ClassicSkillsStrongholdStep = { actor: string; action: Action };
export type ClassicSkillsStrongholdOptions = {
  /** Fresh authenticated Advanced classic lobby; original IDs/order survive. */
  initial?: Game;
  seatIds?: string[];
  optionalTech?: boolean;
  bankerIncome?: boolean;
  kind?: Exclude<StrongholdId, 'hidden_mobile_stronghold'>;
  skill?: LeaderSkillId;
  band?: 'normal' | 'skilled';
  ownerFaction?: FactionId;
  opponentFaction?: FactionId;
  cardHolder?: 'owner' | 'opponent' | 'unclaimed';
  ownerDial?: number;
  support?: number;
  opponentDial?: number;
  opponentSupport?: number;
  ownerLeaderStrength?: number;
  opponentLeaderStrength?: number;
  ownerWeapon?: Card['kind'];
  ownerDefense?: Card['kind'];
  opponentWeapon?: Card['kind'];
  opponentDefense?: Card['kind'];
  traitors?: 'owner' | 'both';
};
export type ClassicSkillsStrongholdFixture = {
  initial: Game;
  afterSetup: Game;
  beforeFirstMentat: Game;
  firstMentatStep: ClassicSkillsStrongholdStep;
  afterFirstMentat: Game;
  beforeBattle: Game;
  battleAction: Action;
  game: Game;
  actor: string;
  owner: string;
  opponent: string;
  banker?: string;
  trainer: string;
  kind: StrongholdId;
  key: string;
  skill: LeaderSkillId;
  band: 'normal' | 'skilled';
  planActions: ClassicSkillsStrongholdStep[];
  staging: string[];
};

export function classicSkillsStrongholdPlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, `Missing original classic seat ${id}`);
  return player;
}

/** Control only the original fourteen-card shuffle, before any native deal. */
function withOffers<T>(selected: LeaderSkillId[], initialize: () => T): T {
  assert.equal(new Set(selected).size, selected.length);
  const working: LeaderSkillId[] = LEADER_SKILL_CARDS.map(card => card.id);
  const remainder = working.filter(skill => !selected.includes(skill));
  const desired = selected.flatMap(skill => [skill, remainder.shift()!]);
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
    if (cursor < rolls.length) {
      assert.ok(array instanceof Uint32Array && array.length === 1);
      array[0] = rolls[cursor++];
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** The existing native policy owns readiness and projected response passes.
 * In particular, a phase opening must close before a response can be passed. */
export function nextClassicSkillsStrongholdStep(game: Game): ClassicSkillsStrongholdStep | null {
  if (!game.phaseOpening && !game.response) {
    const decision = game.decision;
    if (decision?.kind === 'leaderSkillVisibility')
      return { actor: decision.player, action: { type: 'leaderSkillVisibility', event: decision.event, hide: false } };
    if (decision?.kind === 'mentatQuestion')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'techToken')
      return { actor: decision.player, action: { type: 'decision', token: decision.choices[0] } };
    if (decision?.kind === 'sukRescue') {
      const choice = decision.options.map((option, index) => ({ index, saved: option.normal + option.elite, kept: !!option.kept }))
        .sort((a, b) => b.saved - a.saved || Number(b.kept) - Number(a.kept))[0].index;
      return { actor: decision.player, action: { type: 'decision', event: decision.event, choice } };
    }
  }
  return nextStrongholdFactionsNativeStep(game);
}
function step(game: Game): Game {
  const next = nextClassicSkillsStrongholdStep(game);
  assert.ok(next, 'Native continuation stopped at an unsealed human plan');
  return applyAction(game, next.actor, next.action);
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;
function advance(game: Game, predicate: (state: Game) => boolean): Game {
  for (let count = 0; count < 1800; count++) {
    if (predicate(game)) return game;
    assert.equal(game.status, 'playing');
    game = step(game);
  }
  throw Error('Original classic continuation did not reach its requested boundary');
}

function reserveBoard(game: Game): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, count) => sum + count, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
  }
}
function place(game: Game, actor: string, key: string, count: number): void {
  const player = classicSkillsStrongholdPlayer(game, actor);
  assert.ok(player.reserves - (player.elites?.reserves ?? 0) >= count, 'Stage ordinary physical counters, not hidden elite counters');
  player.reserves -= count;
  player.forces[key] = (player.forces[key] ?? 0) + count;
}
function heldCard(game: Game, actor: string, matches: (card: Card) => boolean, staging: string[], used: string[] = []): Card {
  const player = classicSkillsStrongholdPlayer(game, actor);
  const held = player.hand.find(card => matches(card) && !used.includes(card.id));
  if (held) return held;
  const index = game.deck.findIndex(card => matches(card) && !used.includes(card.id));
  const donor = index < 0 ? game.players.find(p => p.id !== actor && p.hand.some(card => matches(card) && !used.includes(card.id))) : undefined;
  assert.ok(index >= 0 || donor, 'Required original card must retain actual deck/hand custody');
  assert.ok(player.hand.length < handLimit(player));
  const card = index >= 0 ? game.deck.splice(index, 1)[0]
    : donor!.hand.splice(donor!.hand.findIndex(card => matches(card) && !used.includes(card.id)), 1)[0];
  player.hand.push(card);
  staging.push(`Conserved ${card.id}: native ${donor?.id ?? 'deck'} custody → ${actor}'s hand`);
  return card;
}
function conserveTraitor(game: Game, actor: string, identity: string, staging: string[]): void {
  const player = classicSkillsStrongholdPlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0];
  const index = game.traitorReserve?.indexOf(identity) ?? -1;
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(returned && (index >= 0 || donor), 'Conserved original traitor must remain in native custody');
  if (index >= 0) game.traitorReserve!.splice(index, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Conserved traitor ${identity}: native ${donor?.id ?? 'reserve'} custody exchanged for ${actor}'s ${returned}`);
}

/** Real original setup and first END Mentat acquisition. Labeled staging only
 * conserves physical board/cards and orders unplayed Spice Cards. No phase,
 * turn, wallet, Stronghold/Tech owner, plan, quote or earned receipt is assigned. */
export function createClassicSkillsStrongholdFixture(options: ClassicSkillsStrongholdOptions = {}): ClassicSkillsStrongholdFixture {
  const skill = options.skill ?? 'suk-graduate';
  const band = options.band ?? 'skilled';
  const kind = options.kind ?? 'arrakeen';
  const staging: string[] = [];
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    const ids = options.seatIds ?? ['emperor', 'guild', 'atreides'];
    assert.ok(ids.length >= 2 && ids.length <= 6 && new Set(ids).size === ids.length);
    const factions: FactionId[] = ['emperor', 'guild', 'atreides', 'fremen', 'harkonnen', 'beneGesserit'];
    game = createGame('CLASSICSKILLSSTRONGHOLD', newPlayer(ids[0], factions[0], factions[0]), true);
    for (let index = 1; index < ids.length; index++) joinGame(game, newPlayer(ids[index], factions[index], factions[index]));
  }
  assert.equal(game.status, 'lobby', 'Only the original fresh authenticated undealt lobby is accepted');
  assert.equal(game.advanced, true);
  assert.deepEqual(game.expansions, []);
  assert.ok(game.players.length >= 2 && game.players.length <= 6);
  const owner = game.players.find(p => p.faction === (options.ownerFaction ?? 'guild'))?.id;
  const opponent = game.players.find(p => p.faction === (options.opponentFaction ?? 'emperor'))?.id;
  assert.ok(owner && opponent && owner !== opponent);
  const banker = options.bankerIncome ? game.players.find(p => p.faction === 'atreides')?.id : undefined;
  if (options.bankerIncome) assert.ok(banker && banker !== owner && banker !== opponent && game.players.length >= 3);
  if (!game.strongholdCards) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  assert.deepEqual(game.strongholdCards, createStrongholdCards());
  if (options.optionalTech) {
    assert.ok(game.players.length >= 3);
    if (!game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  }
  if (game.techTokens) assert.deepEqual(game.techTokens, createTechTokens());
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  const passive: LeaderSkillId[] = (['sandmaster', 'smuggler', 'rihani-decipherer', 'prana-bindu-adept', 'killer-medic', 'master-of-assassins'] as const)
    .filter(candidate => candidate !== skill);
  const selected = game.players.map(player => player.id === owner ? skill : player.id === banker ? 'spice-banker' as const : passive.shift()!);
  game = withOffers(selected, () => options.bankerIncome
    ? initializeSpiceBankerIncomeGameForAudit(game) : initializeLeaderSkillsGameForAudit(game));
  const initial = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const wanted = selected[game.players.findIndex(player => player.id === actor)];
      const view = viewGame(game, actor).leaderSkills!;
      assert.ok(offer.cards.includes(wanted) && !view.unavailableSkills?.[wanted]);
      const eligible = new Set(view.eligibleLeaders.map(leader => leader.id));
      const leader = classicSkillsStrongholdPlayer(game, actor).leaders.filter(leader => eligible.has(leader.id))
        .sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader);
      game = applyAction(game, actor, { type: 'leaderSkill', event: offer.event, skill: wanted, leader: leader.id });
    } else game = step(game);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  // Four conserved unplayed non-worm blows keep the two-turn suffix out of Nexus.
  const blows = game.spiceDeck.filter(card => 'territory' in card).slice(0, 4);
  for (let index = 0; index < blows.length; index++) {
    const from = game.spiceDeck.indexOf(blows[index]);
    game.spiceDeck.splice(index, 0, game.spiceDeck.splice(from, 1)[0]);
  }
  staging.push('Controlled original unplayed Spice Card order: four non-worm blows; not a natural shuffle history');
  game = advance(game, state => state.phase === 8 && clean(state));
  reserveBoard(game);
  const key = `${kind}:${territory(kind).sectors[0]}`;
  const holder = options.cardHolder === 'opponent' ? opponent : options.cardHolder === 'unclaimed' ? undefined : owner;
  if (holder) place(game, holder, key, 1);
  staging.push('Before genuine first END Mentat: conserved board counters through their own reserves; only the labeled card claimant occupies one stronghold');
  let beforeFirstMentat: Game | undefined;
  let firstMentatStep: ClassicSkillsStrongholdStep | undefined;
  for (let count = 0; game.turn === 1 && count < 200; count++) {
    const next = nextClassicSkillsStrongholdStep(game); assert.ok(next);
    const before = structuredClone(game);
    game = applyAction(game, next.actor, next.action);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  assert.equal(game.turn, 2);
  assert.equal(game.strongholdCards!.owners[kind], holder ?? null);
  assert.deepEqual(game.strongholdCards!.owners, strongholdControllers(beforeFirstMentat.players, false));
  const afterFirstMentat = structuredClone(game);
  // Use the actual physical Weather Control card rather than fabricate a storm.
  // It also makes physical attacker/defender deterministic from retained circles.
  const weather = heldCard(game, owner, card => card.effect === 'weather', staging);
  game = advance(game, state => state.phase === 0 && clean(state));
  game = applyAction(game, owner, { type: 'card', card: weather.id, amount: 0 });
  game = advance(game, state => state.phase === 5 && clean(state));
  reserveBoard(game);
  for (const actor of [owner, opponent]) place(game, actor, key, 8);
  staging.push('Before genuine turn-two movement completion: conserve eight ordinary counters per combatant; retained first-Mentat card custody is unchanged');
  assert.ok(!territory(kind).sectors.includes(game.storm), 'Original storm must leave the battle territory available');
  const used: string[] = [];
  const card = (actor: string, face: Card['kind'] | undefined): string | null => {
    if (!face) return null;
    const held = heldCard(game, actor, physical => physical.kind === face, staging, used);
    used.push(held.id);
    return held.id;
  };
  const ownerWeapon = card(owner, options.ownerWeapon);
  const ownerDefense = card(owner, options.ownerDefense);
  const opponentWeapon = card(opponent, options.opponentWeapon);
  const opponentDefense = card(opponent, options.opponentDefense);
  const trainer = game.leaderSkills!.assignments.find(assignment => assignment.owner === owner)!.leader;
  const untrained = (actor: string, strength: number | undefined) => {
    const candidates = classicSkillsStrongholdPlayer(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt &&
      !game.leaderSkills!.assignments.some(assignment => assignment.leader === leader.id));
    const leader = strength === undefined ? candidates.find(leader => leader.strength === 3) ?? candidates[0] : candidates.find(leader => leader.strength === strength);
    assert.ok(leader, 'Requested original untrained printed disc must exist');
    return leader.id;
  };
  const ownerLeader = band === 'skilled' ? trainer : untrained(owner, options.ownerLeaderStrength);
  const opponentLeader = untrained(opponent, options.opponentLeaderStrength);
  if (options.traitors) {
    conserveTraitor(game, owner, opponentLeader, staging);
    if (options.traitors === 'both') conserveTraitor(game, opponent, ownerLeader, staging);
  }
  game = advance(game, state => state.phase === 6 && clean(state));
  const beforeBattle = structuredClone(game);
  const actor = game.active!;
  assert.ok(actor === owner || actor === opponent);
  const battleAction: Action = { type: 'chooseBattle', territory: kind, target: actor === owner ? opponent : owner };
  game = applyAction(game, actor, battleAction);
  const planActions: ClassicSkillsStrongholdStep[] = [
    { actor: owner, action: { type: 'battlePlan', dial: options.ownerDial ?? 0, support: options.support ?? 0, leader: ownerLeader, weapon: ownerWeapon, defense: ownerDefense } },
    { actor: opponent, action: { type: 'battlePlan', dial: options.opponentDial ?? 0, support: options.opponentSupport ?? 0, leader: opponentLeader, weapon: opponentWeapon, defense: opponentDefense } },
  ];
  return { initial, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeBattle, battleAction, game, actor, owner, opponent, banker, trainer, kind, key, skill, band, planActions, staging };
}

/** Human UI can stop at the original pre-plan state; runtime proof deliberately
 * passes native windows and chooses the requested legal normal/skilled band. */
export function prepareClassicSkillsStrongholdBattle(fixture: ClassicSkillsStrongholdFixture, state = fixture.game): Game {
  let game = structuredClone(state);
  for (let count = 0; count < 160; count++) {
    const next = nextClassicSkillsStrongholdStep(game);
    if (!next) { assert.ok(game.battle && !game.battle.revealed); return game; }
    if (next.action.type === 'leaderSkillVisibility') next.action.hide = next.actor === fixture.owner && fixture.band === 'skilled';
    game = applyAction(game, next.actor, next.action);
  }
  throw Error('Original classic plan boundary did not open');
}
export function revealClassicSkillsStrongholdBattle(fixture: ClassicSkillsStrongholdFixture): Game {
  let game = prepareClassicSkillsStrongholdBattle(fixture);
  for (const plan of fixture.planActions) {
    game = applyAction(game, plan.actor, plan.action);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') game = step(game);
  }
  assert.ok(game.battle?.revealed);
  return game;
}
export function finishClassicSkillsStrongholdBattle(state: Game, options: { stop?: 'skill' | 'cleanup' | 'tech'; callers?: string[] } = {}): Game {
  let game = structuredClone(state);
  for (let count = 0; count < 240; count++) {
    if (options.stop === 'skill' && game.decision?.kind === 'sukRescue') return game;
    if (options.stop === 'cleanup' && game.decision?.kind === 'battleCards') return game;
    if (options.stop === 'tech' && game.decision?.kind === 'techToken') return game;
    if (!game.battle && clean(game) && !game.pendingTreacheryDiscard) return game;
    const next = nextClassicSkillsStrongholdStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = options.callers?.includes(next.actor) ?? false;
    game = applyAction(game, next.actor, next.action);
  }
  throw Error('Original classic skill/Stronghold battle suffix did not finish');
}

/** Quote the actual revealed source, with both native physical support and
 * assigned skill bands. Do not use the standalone Stronghold quote adapter,
 * which intentionally has no Leader Skill inputs. */
export function quoteClassicSkillsStrongholdBattle(game: Game) {
  const battle = game.battle; assert.ok(battle?.revealed);
  const combatant = (actor: string): ResolutionCombatant => {
    const player = classicSkillsStrongholdPlayer(game, actor);
    const view = viewGame(game, actor).battle!;
    assert.ok(view.ownForces);
    return {
      id: actor, faction: player.faction, ally: player.ally, spice: player.spice, hand: player.hand,
      plan: battle.plans[actor], leader: player.leaders.find(leader => leader.id === battle.plans[actor].leader),
      forces: view.ownForces, stronghold: view.strongholdEffects[actor],
      poisonTooth: battle.poisonTooth?.[actor], lateDefense: battle.lateDefense?.[actor], stoneMode: battle.stoneBurner?.[actor],
      leaderSkills: game.leaderSkills!.assignments.filter(assignment => assignment.owner === actor)
        .map(assignment => ({ skill: assignment.skill, leader: assignment.leader, faceUp: !battle.leaderSkillHidden?.[actor], captured: false })),
      occupiedStrongholds: leaderSkillStrongholdCount(game, player),
    };
  };
  return quoteBattleResolution({
    advanced: game.advanced, turn: game.turn, territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor,
    attacker: combatant(battle.attacker), defender: combatant(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map(actor => ({ id: actor,
      beneficiary: [battle.attacker, battle.defender].includes(actor) ? actor : classicSkillsStrongholdPlayer(game, actor).ally!,
      called: battle.traitorCalls[actor] ?? false, traitors: classicSkillsStrongholdPlayer(game, actor).traitors })),
    participants: game.players, physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false,
  });
}
