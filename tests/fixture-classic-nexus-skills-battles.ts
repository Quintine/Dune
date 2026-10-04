import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeLeaderSkillsGameForAudit,
  joinGame, newPlayer, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { territory } from '../game/board';
import type { Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type ClassicNexusSkillsBattleStep = { actor: string; action: Action };
export type ClassicNexusSkillsBattleOptions = {
  /** Original undealt authenticated CLI setup, or fresh classic lobby. Never redealt. */
  initial?: Game;
  advanced?: boolean;
  seatIds?: string[];
  skill?: LeaderSkillId;
  band?: 'normal' | 'skilled';
  ownerDial?: number;
  support?: number;
  opponentDial?: number;
  opponentSupport?: number;
  ownerWeapon?: Card['kind'];
  ownerDefense?: Card['kind'];
  opponentWeapon?: Card['kind'];
  opponentDefense?: Card['kind'];
  traitors?: 'owner' | 'opponent' | 'both';
  counter?: boolean;
  secondBattle?: boolean;
};
export type ClassicNexusSkillsBattleFixture = {
  initial: Game;
  afterSetup: Game;
  beforeFirstMentat: Game;
  firstMentatStep: ClassicNexusSkillsBattleStep;
  afterFirstMentat: Game;
  beforeAlliance: Game;
  allianceActions: ClassicNexusSkillsBattleStep[];
  beforeDraw: Game;
  drawAction: ClassicNexusSkillsBattleStep;
  afterDraw: Game;
  beforeBattle: Game;
  battleAction: ClassicNexusSkillsBattleStep;
  game: Game;
  owner: string;
  opponent: string;
  observer: string;
  partner: string;
  trainer: string;
  skill: LeaderSkillId;
  band: 'normal' | 'skilled';
  key: string;
  secondKey?: string;
  counter?: string;
  planActions: ClassicNexusSkillsBattleStep[];
  actions: ClassicNexusSkillsBattleStep[];
  staging: string[];
};
export function classicNexusSkillsBattlePlayer(game: Game, actor: string): Player {
  const player = game.players.find(seat => seat.id === actor);
  assert.ok(player, `Missing original classic seat ${actor}`);
  return player;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Scoped original shuffle/action entropy; generic non-word requests retain native forwarding. */
function entropy<T>(operation: () => T, rolls: number[] = []): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array) {
      for (let index = 0; index < array.length; index++) array[index] = rolls[cursor++] ?? 0xffffffff;
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function offerRolls(selected: LeaderSkillId[]): number[] {
  const working = LEADER_SKILL_CARDS.map(card => card.id);
  const remainder = working.filter(skill => !selected.includes(skill));
  const desired = selected.flatMap(skill => [skill, remainder.shift()!]);
  desired.push(...remainder);
  const rolls: number[] = [];
  for (let index = working.length - 1; index > 0; index--) {
    const from = working.indexOf(desired[index]);
    assert.ok(from >= 0 && from <= index);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (index + 1)));
    [working[index], working[from]] = [working[from], working[index]];
  }
  return rolls;
}
export function nextClassicNexusSkillsBattleStep(game: Game): ClassicNexusSkillsBattleStep | null {
  if (clean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const phase = game.nexusCards.phase;
    const actor = phase.eligible.find(id => !phase.done.includes(id));
    if (actor) return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.phaseOpening && !game.response) {
    const decision = game.decision;
    if (decision?.kind === 'leaderSkillVisibility')
      return { actor: decision.player, action: { type: 'leaderSkillVisibility', event: decision.event, hide: false } };
    if (decision?.kind === 'mentatQuestion')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'wormRide')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'nexusFremenCunningOffer' || decision?.kind === 'nexusFremenCunningRide')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, accept: false } };
    if (decision?.kind === 'sukRescue') {
      const choice = decision.options.map((option, index) => ({ index, saved: option.normal + option.elite, kept: !!option.kept }))
        .sort((a, b) => b.saved - a.saved || Number(b.kept) - Number(a.kept))[0].index;
      return { actor: decision.player, action: { type: 'decision', event: decision.event, choice } };
    }
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function stepClassicNexusSkillsBattle(game: Game, next = nextClassicNexusSkillsBattleStep(game)): Game {
  assert.ok(next, 'Original private plan requires a human action');
  return entropy(() => applyAction(game, next.actor, next.action));
}
export function advanceClassicNexusSkillsBattle(game: Game, until: (state: Game) => boolean,
  actions: ClassicNexusSkillsBattleStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextClassicNexusSkillsBattleStep(game); assert.ok(next, 'Human plan boundary before requested state');
    actions.push(structuredClone(next));
    game = stepClassicNexusSkillsBattle(game, next);
  }
  throw Error('Original Skills/Nexus continuation did not reach its boundary');
}
/** Reorder undealt singleton Spice Cards only. Discards keep their original history. */
function orderSpice(game: Game, kinds: ('land' | 'worm')[], staging: string[]): void {
  const remainder = [...game.spiceDeck];
  const front = kinds.map(kind => {
    const index = remainder.findIndex(card => kind === 'land' ? 'territory' in card : 'worm' in card);
    assert.ok(index >= 0, `Original undealt ${kind} must still exist`);
    return remainder.splice(index, 1)[0];
  });
  game.spiceDeck = [...front, ...remainder];
  staging.push(`Controlled conserved original undealt Spice order: ${kinds.join(', ')}; not natural shuffle history`);
}
function reserveBoard(game: Game): void {
  for (const seat of game.players) {
    seat.reserves += Object.values(seat.forces).reduce((sum, count) => sum + count, 0);
    seat.forces = {};
    if (seat.elites) {
      seat.elites.reserves += Object.values(seat.elites.forces).reduce((sum, count) => sum + count, 0);
      seat.elites.forces = {};
    }
    if (seat.advisors) seat.advisors = {};
  }
}
function place(game: Game, actor: string, key: string, count: number): void {
  const seat = classicNexusSkillsBattlePlayer(game, actor);
  assert.ok(seat.reserves - (seat.elites?.reserves ?? 0) >= count);
  seat.reserves -= count;
  seat.forces[key] = (seat.forces[key] ?? 0) + count;
}
function hold(game: Game, actor: string, matches: (card: Card) => boolean, staging: string[], used: string[]): string {
  const seat = classicNexusSkillsBattlePlayer(game, actor);
  let card = seat.hand.find(card => matches(card) && !used.includes(card.id));
  if (!card) {
    const from = game.deck.findIndex(card => matches(card) && !used.includes(card.id));
    const donor = from < 0 ? game.players.find(seat => seat.hand.some(card => matches(card) && !used.includes(card.id))) : undefined;
    assert.ok(from >= 0 || donor, 'Required original card must remain in deck/hand custody');
    assert.ok(seat.hand.length < handLimit(seat));
    card = from >= 0 ? game.deck.splice(from, 1)[0]
      : donor!.hand.splice(donor!.hand.findIndex(card => matches(card) && !used.includes(card.id)), 1)[0];
    seat.hand.push(card);
    staging.push(`Conserved physical ${card.id}: ${donor?.id ?? 'original deck'} → ${actor} hand`);
  }
  used.push(card.id);
  return card.id;
}
function traitor(game: Game, actor: string, identity: string, staging: string[]): void {
  const seat = classicNexusSkillsBattlePlayer(game, actor);
  if (seat.traitors.includes(identity)) return;
  const returned = seat.traitors[0];
  const from = game.traitorReserve?.indexOf(identity) ?? -1;
  const donor = game.players.find(seat => seat.traitors.includes(identity));
  assert.ok(returned && (from >= 0 || donor));
  if (from >= 0) game.traitorReserve!.splice(from, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  seat.traitors[0] = identity;
  staging.push(`Conserved original traitor ${identity}: ${donor?.id ?? 'reserve'} exchanged for ${actor}'s ${returned}`);
}

/** Genuine original all14/base33/all12 setup → Storm → END Mentat → worm →
 * reciprocal alliance → closing Emperor draw → movement → human battle plans.
 * Only labeled conserved physical sources are relocated; no wallets, phases,
 * turn, skill effects, module owners, earned receipts or outcomes are assigned. */
export function createClassicNexusSkillsBattleFixture(options: ClassicNexusSkillsBattleOptions = {}): ClassicNexusSkillsBattleFixture {
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const band = options.band ?? 'skilled';
  const actions: ClassicNexusSkillsBattleStep[] = [], staging: string[] = [];
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    const ids = options.seatIds ?? ['emperor', 'guild', 'atreides', 'fremen'];
    assert.ok(ids.length >= 3 && ids.length <= 6 && new Set(ids).size === ids.length);
    const factions: FactionId[] = ['emperor', 'guild', 'atreides', 'fremen', 'harkonnen', 'beneGesserit'];
    game = createGame('CLASSICNEXUSSKILLSBATTLE', newPlayer(ids[0], factions[0], factions[0]), advanced, []);
    for (let index = 1; index < ids.length; index++) joinGame(game, newPlayer(ids[index], factions[index], factions[index]));
  }
  assert.equal(game.advanced, advanced);
  assert.deepEqual(game.expansions, []);
  assert.ok(!game.techTokens && !game.strongholdCards && !game.homeworlds);
  assert.ok(game.players.length >= 3 && game.players.length <= 6);
  const owner = game.players.find(seat => seat.faction === 'emperor')?.id;
  const opponent = game.players.find(seat => seat.faction === 'guild')?.id;
  const observer = game.players.find(seat => seat.faction === 'atreides')?.id;
  assert.ok(owner && opponent && observer);
  const partner = game.players.find(seat => ![owner, opponent, observer].includes(seat.id))?.id ?? opponent;
  const desiredSkill = options.skill ?? 'warmaster';
  const passive: LeaderSkillId[] = ['sandmaster', 'smuggler', 'rihani-decipherer', 'prana-bindu-adept', 'killer-medic', 'master-of-assassins']
    .filter(skill => skill !== desiredSkill) as LeaderSkillId[];
  const selected = game.players.map(seat => seat.id === owner ? desiredSkill : passive.shift()!);
  if (game.status === 'lobby') {
    assert.ok(!game.leaderSkills, 'Never replace existing original skill custody');
    game.nexusCards ??= { cards: null, phase: null };
    assert.deepEqual(game.nexusCards, { cards: null, phase: null });
    for (const seat of game.players) if (!seat.ready) game = stepClassicNexusSkillsBattle(game, { actor: seat.id, action: { type: 'ready' } });
    game = entropy(() => initializeLeaderSkillsGameForAudit(game), offerRolls(selected));
  }
  assert.equal(game.status, 'setup', 'Only original fresh undealt setup/lobby is accepted');
  assert.equal(game.turn, 1); assert.equal(game.phase, 0);
  assert.ok(game.leaderSkills && game.nexusCards?.cards);
  assert.equal(game.leaderSkills.assignments.length, 0);
  const initial = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 240; count++) {
    if (game.setupStage === 'leaderSkills') {
      const actor: string = Object.keys(game.leaderSkills!.offers)[0];
      const offer: NonNullable<Game['leaderSkills']>['offers'][string] = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const requested: LeaderSkillId = selected[game.players.findIndex(seat => seat.id === actor)];
      const legal: LeaderSkillId[] = offer.cards.filter(skill => !view.unavailableSkills?.[skill]);
      const skill: LeaderSkillId | undefined = legal.includes(requested) ? requested : legal[0];
      assert.ok(skill, 'Existing saved offer has no legal original skill; it cannot be redealt');
      if (actor === owner && options.skill) assert.equal(skill, options.skill, 'Requested skill must be in the original saved offer');
      const eligible = new Set(view.eligibleLeaders.map(leader => leader.id));
      const leader = classicNexusSkillsBattlePlayer(game, actor).leaders.filter(leader => eligible.has(leader.id))
        .sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader);
      const next: ClassicNexusSkillsBattleStep = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
      actions.push(next); game = stepClassicNexusSkillsBattle(game, next);
    } else {
      const next = nextClassicNexusSkillsBattleStep(game); assert.ok(next);
      actions.push(next); game = stepClassicNexusSkillsBattle(game, next);
    }
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const assignment = game.leaderSkills!.assignments.find(skill => skill.owner === owner)!;
  const skill = assignment.skill, trainer = assignment.leader;
  game = advanceClassicNexusSkillsBattle(game, state => state.phase === 1 && clean(state), actions);
  orderSpice(game, ['land', 'land'], staging);
  game = advanceClassicNexusSkillsBattle(game, state => state.phase === 5 && clean(state), actions);
  reserveBoard(game);
  staging.push('After actual setup, conserve all board counters through their own reserves before first movement completion');
  game = advanceClassicNexusSkillsBattle(game, state => state.phase === 8 && clean(state), actions);
  let beforeFirstMentat!: Game, firstMentatStep!: ClassicNexusSkillsBattleStep;
  while (game.turn === 1) {
    const next = nextClassicNexusSkillsBattleStep(game); assert.ok(next);
    const before = structuredClone(game);
    actions.push(next); game = stepClassicNexusSkillsBattle(game, next);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  const afterFirstMentat = structuredClone(game);
  game = advanceClassicNexusSkillsBattle(game, state => state.phase === 1 && clean(state), actions);
  orderSpice(game, ['worm', 'land', 'land'], staging);
  game = advanceClassicNexusSkillsBattle(game, state => state.nexus === true && !state.spiceWindow && clean(state), actions);
  const beforeAlliance = structuredClone(game);
  const allianceActions: ClassicNexusSkillsBattleStep[] = [
    { actor: observer, action: { type: 'alliance', target: partner } },
    { actor: partner, action: { type: 'alliance', target: observer } },
  ];
  for (const next of allianceActions) { actions.push(next); game = stepClassicNexusSkillsBattle(game, next); }
  game = advanceClassicNexusSkillsBattle(game, state => state.nexusCards?.phase?.stage === 'drawing', actions);
  const cards = game.nexusCards!.cards!;
  const from = cards.deck.indexOf('emperor'); assert.ok(from >= 0);
  cards.deck.unshift(cards.deck.splice(from, 1)[0]);
  staging.push('Conserved undealt Emperor Nexus singleton ordered first after genuine alliance; only actual closing draw changes hand custody');
  const beforeDraw = structuredClone(game);
  const drawAction: ClassicNexusSkillsBattleStep = { actor: owner, action: {
    type: 'nexusCardChoice', turn: game.turn, card: cards.hands[owner], choice: 'draw', ownRedraws: 0,
  } };
  actions.push(drawAction); game = stepClassicNexusSkillsBattle(game, drawAction);
  const afterDraw = structuredClone(game);
  assert.equal(game.nexusCards!.cards!.hands[owner], 'emperor');
  game = advanceClassicNexusSkillsBattle(game, state => state.phase === 5 && clean(state), actions);
  reserveBoard(game);
  const key = `arrakeen:${territory('arrakeen').sectors[0]}`;
  assert.ok(!territory('arrakeen').sectors.includes(game.storm));
  for (const actor of [owner, opponent]) place(game, actor, key, 7);
  const secondKey = options.secondBattle ? `carthag:${territory('carthag').sectors[0]}` : undefined;
  if (secondKey) {
    assert.ok(!territory('carthag').sectors.includes(game.storm));
    for (const actor of [owner, opponent]) place(game, actor, secondKey, 1);
  }
  staging.push('Before actual turn-two movement completion, conserved seven ordinary counters per combatant at Arrakeen; native elite pools unchanged');
  if (secondKey) staging.push('Conserved one further ordinary counter per combatant at Carthag for genuine same-turn expiry battle');
  const used: string[] = [];
  const card = (actor: string, kind: Card['kind'] | undefined) => kind ? hold(game, actor, card => card.kind === kind, staging, used) : null;
  const ownerWeapon = card(owner, options.ownerWeapon ?? (skill === 'warmaster' ? 'worthless' : undefined));
  const ownerDefense = card(owner, options.ownerDefense);
  const opponentWeapon = card(opponent, options.opponentWeapon);
  const opponentDefense = card(opponent, options.opponentDefense);
  const counter = options.counter ? hold(game, opponent, card => card.effect === 'karama', staging, used) : undefined;
  const untrained = (actor: string) => {
    const leaders = classicNexusSkillsBattlePlayer(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt &&
      !game.leaderSkills!.assignments.some(assignment => assignment.leader === leader.id));
    const leader = leaders.find(leader => leader.strength === 3) ?? leaders[0]; assert.ok(leader);
    return leader.id;
  };
  const ownerLeader = band === 'skilled' ? trainer : untrained(owner);
  const opponentLeader = untrained(opponent);
  if (options.traitors === 'owner' || options.traitors === 'both') traitor(game, owner, opponentLeader, staging);
  if (options.traitors === 'opponent' || options.traitors === 'both') traitor(game, opponent, ownerLeader, staging);
  game = advanceClassicNexusSkillsBattle(game, state => state.phase === 6 && clean(state), actions);
  const beforeBattle = structuredClone(game);
  const actor = game.active!; assert.ok([owner, opponent].includes(actor));
  const battleAction: ClassicNexusSkillsBattleStep = { actor, action: { type: 'chooseBattle', territory: 'arrakeen', target: actor === owner ? opponent : owner } };
  actions.push(battleAction); game = stepClassicNexusSkillsBattle(game, battleAction);
  const planActions: ClassicNexusSkillsBattleStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: ownerLeader, dial: options.ownerDial ?? 6,
      support: advanced ? options.support ?? 3 : 0, weapon: ownerWeapon, defense: ownerDefense } },
    { actor: opponent, action: { type: 'battlePlan', leader: opponentLeader, dial: options.opponentDial ?? 0,
      support: advanced ? options.opponentSupport ?? 0 : 0, weapon: opponentWeapon, defense: opponentDefense } },
  ];
  return { initial, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeAlliance, allianceActions,
    beforeDraw, drawAction, afterDraw, beforeBattle, battleAction, game, owner, opponent, observer, partner,
    trainer, skill, band, key, secondKey, counter, planActions, actions, staging };
}
export function prepareClassicNexusSkillsBattle(fixture: ClassicNexusSkillsBattleFixture, state = fixture.game): Game {
  let game = structuredClone(state);
  for (let count = 0; count < 160; count++) {
    const next = nextClassicNexusSkillsBattleStep(game);
    if (!next) { assert.ok(game.battle && !game.battle.revealed); return game; }
    if (next.action.type === 'leaderSkillVisibility') next.action.hide = next.actor === fixture.owner && fixture.band === 'skilled';
    game = stepClassicNexusSkillsBattle(game, next);
  }
  throw Error('Original skill posture/private plan boundary did not open');
}
export function beginClassicNexusSkillsCunning(fixture: ClassicNexusSkillsBattleFixture, state = prepareClassicNexusSkillsBattle(fixture)): Game {
  const offer = viewGame(state, fixture.owner).nexusSardaukar?.offer;
  assert.ok(offer); assert.equal(offer.blocked, null);
  return stepClassicNexusSkillsBattle(state, { actor: fixture.owner, action: { type: 'nexusSardaukar', event: offer.event } });
}
export function revealClassicNexusSkillsBattle(fixture: ClassicNexusSkillsBattleFixture,
  options: { state?: Game; cunning?: boolean } = {}): Game {
  let game = prepareClassicNexusSkillsBattle(fixture, options.state ?? fixture.game);
  if (options.cunning) game = advanceClassicNexusSkillsBattle(beginClassicNexusSkillsCunning(fixture, game), clean);
  for (const plan of fixture.planActions) {
    game = stepClassicNexusSkillsBattle(game, plan);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') game = stepClassicNexusSkillsBattle(game);
  }
  assert.ok(game.battle?.revealed);
  return game;
}
export function finishClassicNexusSkillsBattle(state: Game,
  options: { stop?: 'losses' | 'rescue' | 'cleanup'; callers?: string[] } = {}): Game {
  let game = structuredClone(state);
  for (let count = 0; count < 240; count++) {
    if (options.stop === 'losses' && game.decision?.kind === 'battleLosses') return game;
    if (options.stop === 'rescue' && game.decision?.kind === 'sukRescue') return game;
    if (options.stop === 'cleanup' && game.decision?.kind === 'battleCards') return game;
    if (!game.battle && clean(game) && !game.pendingTreacheryDiscard) return game;
    const next = nextClassicNexusSkillsBattleStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = options.callers?.includes(next.actor) ?? false;
    game = stepClassicNexusSkillsBattle(game, next);
  }
  throw Error('Original Skills/Nexus battle aftermath did not finish');
}
/** Quote the actual native source, including physical temporary roles and skill posture. */
export function quoteClassicNexusSkillsBattle(game: Game) {
  const battle = game.battle; assert.ok(battle?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const seat = classicNexusSkillsBattlePlayer(game, actor), view = viewGame(game, actor).battle!;
    assert.ok(view.ownForces);
    return { id: actor, faction: seat.faction, ally: seat.ally, spice: seat.spice, hand: seat.hand,
      plan: battle.plans[actor], leader: seat.leaders.find(leader => leader.id === battle.plans[actor].leader),
      forces: view.ownForces, stronghold: view.strongholdEffects[actor],
      leaderSkills: game.leaderSkills!.assignments.filter(assignment => assignment.owner === actor)
        .map(assignment => ({ skill: assignment.skill, leader: assignment.leader,
          faceUp: !battle.leaderSkillHidden?.[actor], captured: false })) };
  };
  return quoteBattleResolution({ advanced: game.advanced, turn: game.turn, territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor, attacker: side(battle.attacker), defender: side(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map(actor => ({ id: actor,
      beneficiary: [battle.attacker, battle.defender].includes(actor) ? actor : classicNexusSkillsBattlePlayer(game, actor).ally!,
      called: battle.traitorCalls[actor] ?? false, traitors: classicNexusSkillsBattlePlayer(game, actor).traitors })),
    participants: game.players, physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(seat => seat.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false });
}
