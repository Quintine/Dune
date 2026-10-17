import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { territory } from '../game/board';
import { treacheryDeck, type Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { HARASS_WITHDRAW_CARD, type HarassWithdrawSelection } from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import type { SukRescueOption } from '../game/suk-graduate';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { traitorDeck } from '../game/traitors';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { usesNativeBattleSpecial } from '../game/battle-card-slots';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type IndependentSkillsBattleStep = { actor: string; action: Action };
/** 'same-plan' trains the opposing Warmaster; 'traitor-cancel' adds its real
 * Traitor call; 'suk' trains the owner's Suk Graduate for a real rescue choice. */
export type IndependentSkillsBattleCase = 'same-plan' | 'traitor-cancel' | 'suk';
export type IndependentSkillsBattleSkillSet = {
  owner: LeaderSkillId;
  opponent: LeaderSkillId;
  observer: LeaderSkillId;
};
export type IndependentSkillsBattleOptions = {
  /** Continue only the original fresh classic lobby built by this fixture. */
  initial?: Game;
  advanced?: boolean;
  seatIds?: readonly string[];
  case?: IndependentSkillsBattleCase;
  /** Construction hook: request exact original skill cards for one seat. */
  skills?: Partial<IndependentSkillsBattleSkillSet>;
};
export type IndependentSkillsBattleSetup = {
  initial: Game;
  offered: Game;
  afterSetup: Game;
  owner: string;
  opponent: string;
  observer: string;
  skills: IndependentSkillsBattleSkillSet;
  trainers: Record<'owner' | 'opponent' | 'observer', string>;
  actions: IndependentSkillsBattleStep[];
  staging: string[];
};
export type IndependentSkillsBattleFixture = IndependentSkillsBattleSetup & {
  case: IndependentSkillsBattleCase;
  advanced: boolean;
  location: string;
  first: string;
  second: string;
  beforeShipment: Game;
  shipment: IndependentSkillsBattleStep;
  afterShipment: Game;
  move: IndependentSkillsBattleStep;
  afterMove: Game;
  opponentMove: IndependentSkillsBattleStep;
  beforeBattle: Game;
  battleStep: IndependentSkillsBattleStep;
  /** Revealed window: both original plans sealed, postures committed. */
  game: Game;
  plans: IndependentSkillsBattleStep[];
  returns: HarassWithdrawSelection;
  /** Real posture decision per seat id: true hides the skilled leader behind the shield. */
  hide: Record<string, boolean>;
  /** Attacker leader disc the opposing Traitor matches, for the control case. */
  traitor: string | null;
};

export const independentSkillsBattlePlayer = (game: Game, actor: string): Player => {
  const player = game.players.find((seat) => seat.id === actor);
  assert.ok(player, `Missing original classic seat ${actor}`);
  return player;
};
export const independentSkillsBattleClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard;
const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);

/** Conserved original thirty-six cards, all fourteen skills and ordinary counters. */
export function assertIndependentSkillsBattleCustody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + sum(player.forces), 20, player.faction);
    assert.ok([player.reserves, player.tanks, ...Object.values(player.forces)]
      .every((count) => Number.isSafeInteger(count) && count >= 0), player.faction);
    if (player.elites) assert.equal(
      player.elites.reserves + player.elites.tanks + sum(player.elites.forces),
      player.faction === 'emperor' ? 5 : 3, player.faction);
    assert.ok(player.hand.length <= (player.faction === 'harkonnen' ? 8 : 4), player.faction);
    for (const [key, count] of Object.entries(player.forces)) {
      assert.ok(!key.includes('undefined') && !key.startsWith('homeworld:'), key);
      assert.ok(Number.isInteger(count) && count >= 0, key);
    }
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap((p) => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.equal(cards.length, 36);
  assert.deepEqual(cards.map((card) => card.id).sort(),
    [...treacheryDeck([]), ...ecazTreacheryCards()].map((card) => card.id).sort());
  assert.deepEqual([...(game.traitorReserve ?? []), ...game.players.flatMap((p) => p.traitors)].sort(),
    traitorDeck(game.players).sort());
}

/** Actual Fisher-Yates draws for one desired order; never a held-card injection. */
function permutationDraws<T>(source: readonly T[], desired: readonly T[]): number[] {
  const working = [...source], draws: number[] = [];
  for (let index = working.length - 1; index > 0; index--) {
    const from = working.indexOf(desired[index]);
    assert.ok(from >= 0 && from <= index);
    draws.push(Math.floor(((from + 0.5) / (index + 1)) * 4294967296));
    [working[index], working[from]] = [working[from], working[index]];
  }
  assert.deepEqual(working, desired);
  return draws;
}
/** Only the original skill lottery is solved; later native shuffles keep real draws. */
function skillLottery<T>(draws: readonly number[], run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < draws.length ? draws[cursor++] : 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function defaultSkills(caseKind: IndependentSkillsBattleCase): IndependentSkillsBattleSkillSet {
  return caseKind === 'suk'
    ? { owner: 'suk-graduate', opponent: 'master-of-assassins', observer: 'rihani-decipherer' }
    : { owner: 'prana-bindu-adept', opponent: 'warmaster', observer: 'rihani-decipherer' };
}
/** Private two-card offers are dealt in player order, so the first two positions
 * of the solved deck decide the requesting seat's real choice. */
function skillDeckOrder(skills: IndependentSkillsBattleSkillSet): LeaderSkillId[] {
  const requested = [skills.owner, skills.opponent, skills.observer];
  const rest = LEADER_SKILL_CARDS.map((card) => card.id).filter((id) => !requested.includes(id));
  return requested.flatMap((id) => [id, rest.shift()!]).concat(rest);
}

/** Genuine classic all-fourteen training from a fresh READY lobby whose independent
 * three-card marker is staged only after every ready action. */
export function createIndependentSkillsBattleSetup(
  options: IndependentSkillsBattleOptions = {},
): IndependentSkillsBattleSetup {
  const caseKind = options.case ?? 'same-plan';
  const ids = options.seatIds ?? ['emperor', 'guild', 'harkonnen'];
  assert.equal(ids.length, 3);
  const factions: FactionId[] = ['emperor', 'guild', 'harkonnen'];
  let game = options.initial ? structuredClone(options.initial)
    : createGame('INDEPENDENTSKILLSBATTLE', newPlayer(ids[0], 'Emperor', factions[0]), options.advanced ?? false, []);
  if (!options.initial) for (let index = 1; index < ids.length; index++)
    joinGame(game, newPlayer(ids[index], ids[index], factions[index]));
  assert.equal(game.advanced, options.advanced ?? game.advanced);
  assert.deepEqual(game.expansions, []);
  assert.ok(!game.leaderSkills && !game.homeworlds && !game.nexusCards && !game.discoveryEnabled &&
    !game.techTokens && !game.strongholdCards, 'Only the original classic composition is accepted.');
  assert.equal(game.status, 'lobby', 'Continue only an original fresh classic lobby.');
  const staging: string[] = [];
  const actions: IndependentSkillsBattleStep[] = [];
  const owner = game.players[0].id, opponent = game.players[1].id, observer = game.players[2].id;
  const skills = { ...defaultSkills(caseKind), ...options.skills };
  const deckOrder = skillDeckOrder(skills);
  assert.equal(deckOrder.length, LEADER_SKILL_CARDS.length);
  const initial = structuredClone(game);
  for (const player of game.players) if (!player.ready) {
    const action: Action = { type: 'ready' };
    actions.push({ actor: player.id, action });
    game = applyAction(game, player.id, action);
  }
  game.ecazTreachery = true;
  staging.push('Ready actions precede the independent three-card marker: the original lobby rejects ecazTreachery before every seat is ready.');
  const draws = permutationDraws(LEADER_SKILL_CARDS.map((card) => card.id), deckOrder);
  game = skillLottery(draws, () => initializeLeaderSkillsGameForAudit(game));
  staging.push('Solved the original fourteen-card skill lottery with real Fisher-Yates draws; every later single-word draw in the same initializer kept a fixed maximum value, and larger native requests were forwarded unchanged.');
  assert.equal(game.status, 'setup');
  assert.equal(game.turn, 1);
  assert.equal(game.phase, 0);
  const offered = structuredClone(game);
  const requested: Record<string, LeaderSkillId> = {
    [owner]: skills.owner, [opponent]: skills.opponent, [observer]: skills.observer,
  };
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    let step: IndependentSkillsBattleStep;
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const wanted = requested[actor];
      assert.ok(offer.cards.includes(wanted), 'The requested original skill must be in the real offer');
      assert.ok(!view.unavailableSkills?.[wanted], 'The requested original skill must be selectable');
      const leader = independentSkillsBattlePlayer(game, actor).leaders
        .filter((disc) => view.eligibleLeaders.some((eligible) => eligible.id === disc.id))
        .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
      assert.ok(leader);
      step = { actor, action: { type: 'leaderSkill', event: offer.event, skill: wanted, leader: leader.id } };
    } else {
      const next = nextStrongholdFactionsNativeStep(game);
      assert.ok(next, 'The original setup continuation stopped before training completed');
      step = next;
    }
    actions.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  assertIndependentSkillsBattleCustody(game);
  const trained = (id: string) => game.leaderSkills!.assignments.find((a) => a.owner === id)!.leader;
  for (const [actor, skill] of Object.entries(requested))
    assert.equal(game.leaderSkills!.assignments.find((a) => a.owner === actor)!.skill, skill);
  return { initial, offered, afterSetup: structuredClone(game), owner, opponent, observer, skills,
    trainers: { owner: trained(owner), opponent: trained(opponent), observer: trained(observer) },
    actions, staging };
}

export type IndependentSkillsBattlePolicy = {
  hide?: Record<string, boolean>;
  /** Real Guild choice of the Advanced movement slot: 'last' defers to the end. */
  guildTiming?: 'first' | 'last';
};

/** Only genuine native decisions; a human plan, Traitor call, withdrawal allocation
 * or Suk rescue choice is never invented by this helper. */
export function nextIndependentSkillsBattleStep(
  game: Game,
  policy: IndependentSkillsBattlePolicy = {},
): IndependentSkillsBattleStep | null {
  if (!game.response && !game.phaseOpening) {
    const decision = game.decision;
    if (decision?.kind === 'leaderSkillVisibility') return { actor: decision.player, action: {
      type: 'leaderSkillVisibility', event: decision.event, hide: policy.hide?.[decision.player] ?? false,
    } };
    if (decision?.kind === 'guildTiming')
      return { actor: decision.player, action: { type: 'decision', take: (policy.guildTiming ?? 'last') === 'first' } };
    if (decision?.kind === 'mentatQuestion')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'sukRescue' || decision?.kind === 'harassWithdraw') return null;
    if (decision?.kind === 'rihani')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, draw: false } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceIndependentSkillsBattle(game: Game, until: (state: Game) => boolean,
  actions?: IndependentSkillsBattleStep[], policy: IndependentSkillsBattlePolicy = {}): Game {
  for (let count = 0; count < 1500; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextIndependentSkillsBattleStep(game, policy);
    assert.ok(step, 'Supply the genuine human plan, allocation or rescue choice');
    actions?.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  }
  throw Error('The original classic all-fourteen programme did not reach its boundary');
}
/** Conserved physical card custody: remaining deck or discard → a real hand. */
function hold(game: Game, actor: string, matches: (card: Card) => boolean, staging: string[]): Card {
  const player = independentSkillsBattlePlayer(game, actor);
  const held = player.hand.find(matches);
  if (held) return held;
  const from = game.deck.findIndex(matches);
  assert.ok(from >= 0 || game.discard.some(matches), 'The required original card must remain in deck or discard custody');
  const card = from >= 0 ? game.deck.splice(from, 1)[0] : game.discard.splice(game.discard.findIndex(matches), 1)[0];
  assert.ok(player.hand.length < (player.faction === 'harkonnen' ? 8 : 4));
  player.hand.push(card);
  staging.push(`Conserved original ${card.id}: ${from >= 0 ? 'undealt deck' : 'discard'} → ${actor}'s hand`);
  return card;
}
/** Conserved Traitor identity: only a real reserved or held leader exchanges. */
function conserveTraitor(game: Game, actor: string, identity: string, staging: string[]): void {
  const player = independentSkillsBattlePlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0];
  assert.ok(returned);
  const reserve = game.traitorReserve?.indexOf(identity) ?? -1;
  const donor = game.players.find((seat) => seat.id !== actor && seat.traitors.includes(identity));
  assert.ok(reserve >= 0 || donor, 'The requested Traitor must retain original custody');
  if (reserve >= 0) game.traitorReserve!.splice(reserve, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Conserved Traitor ${identity}: original ${donor?.id ?? 'reserve'} custody exchanged with ${actor}'s ${returned}`);
}
function strongestOther(game: Game, actor: string, excluded: string): string {
  const leader = independentSkillsBattlePlayer(game, actor).leaders
    .filter((disc) => !disc.dead && !disc.usedAt && disc.id !== excluded)
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  assert.ok(leader);
  return leader.id;
}

/** Real training, a paid native shipment, real within-territory movement and both
 * original Battle Plans. Only card and Traitor custody is staged. */
export function createIndependentSkillsBattleFixture(
  options: IndependentSkillsBattleOptions = {},
): IndependentSkillsBattleFixture {
  const caseKind = options.case ?? 'same-plan';
  const setup = createIndependentSkillsBattleSetup(options);
  const advanced = setup.afterSetup.advanced;
  const staging = [...setup.staging];
  const actions = [...setup.actions];
  const { owner, opponent, trainers } = setup;
  const location = 'pasty_mesa', first = 'pasty_mesa:5', second = 'pasty_mesa:6';
  assert.deepEqual(territory(location).sectors, [5, 6, 7, 8]);
  let game = advanceIndependentSkillsBattle(setup.afterSetup,
    (state) => state.phase === 5 && state.active === owner && independentSkillsBattleClean(state), actions);
  const beforeShipment = structuredClone(game);
  assert.equal(independentSkillsBattlePlayer(game, owner).reserves, 20);
  assert.equal(independentSkillsBattlePlayer(game, owner).spice, 10);
  const shipment: IndependentSkillsBattleStep = { actor: owner, action: {
    type: 'ship', territory: location, sector: 5, amount: 4, elite: 0, allyPayment: 0 } };
  actions.push(structuredClone(shipment));
  game = applyAction(game, owner, shipment.action);
  game = advanceIndependentSkillsBattle(game, (state) => independentSkillsBattleClean(state) &&
    !state.pendingShipment && state.phase === 5 && state.active === owner, actions);
  const afterShipment = structuredClone(game);
  assert.equal(independentSkillsBattlePlayer(game, owner).spice, 2);
  assert.equal(independentSkillsBattlePlayer(game, owner).reserves, 16);
  assert.equal(independentSkillsBattlePlayer(game, owner).forces[first], 4);
  assert.equal(independentSkillsBattlePlayer(game, opponent).spice, 5 + 8);
  staging.push('The Emperor paid the original eight-spice desert shipment of four reserves into Pasty Mesa; that payment reached the Guild as printed shipping income.');
  const move: IndependentSkillsBattleStep = { actor: owner, action: {
    type: 'move', from: first, amount: 2, territory: location, sector: 6 } };
  actions.push(structuredClone(move));
  game = applyAction(game, owner, move.action);
  game = advanceIndependentSkillsBattle(game, (state) => independentSkillsBattleClean(state) &&
    state.phase === 5 && state.active === owner, actions);
  assert.deepEqual(independentSkillsBattlePlayer(game, owner).forces, { [first]: 2, [second]: 2 });
  const afterMove = structuredClone(game);
  staging.push('The Emperor then moved two of those four counters from sector 5 to sector 6 in the same movement turn, so the Harass & Withdraw return allocation is genuinely ambiguous between two physical sectors.');
  const endMove: IndependentSkillsBattleStep = { actor: owner, action: { type: 'endMovement' } };
  game = applyAction(game, owner, endMove.action);
  game = advanceIndependentSkillsBattle(game, (state) => independentSkillsBattleClean(state) &&
    state.phase === 5 && state.active === opponent, actions);
  assert.equal(independentSkillsBattlePlayer(game, opponent).forces['tueks_sietch:5'], 5);
  const opponentMove: IndependentSkillsBattleStep = { actor: opponent, action: {
    type: 'move', from: 'tueks_sietch:5', amount: 5, territory: location, sector: 6 } };
  actions.push(structuredClone(opponentMove));
  game = applyAction(game, opponent, opponentMove.action);
  game = advanceIndependentSkillsBattle(game, (state) => independentSkillsBattleClean(state) &&
    state.phase === 5 && state.active === opponent, actions);
  assert.deepEqual(independentSkillsBattlePlayer(game, opponent).forces, { [second]: 5 });
  staging.push('The Guild declined the first Advanced movement slot (a real legal Guild choice) and moved its whole army from Tuek’s Sietch into Pasty Mesa sector 6 during its own movement turn.');
  const endOpponent: IndependentSkillsBattleStep = { actor: opponent, action: { type: 'endMovement' } };
  game = applyAction(game, opponent, endOpponent.action);
  game = advanceIndependentSkillsBattle(game, (state) => state.phase === 6 && independentSkillsBattleClean(state), actions);
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  staging.push('At the real Battle window every original hand returned to the undealt deck before the physical Reinforcements and Harass & Withdraw cards were conserved to the Emperor.');
  hold(game, owner, (card) => card.id === REINFORCEMENTS_CARD, staging);
  hold(game, owner, (card) => card.id === HARASS_WITHDRAW_CARD, staging);
  const worthless = caseKind === 'suk' ? null : hold(game, opponent, (card) => card.kind === 'worthless', staging);
  const hide: Record<string, boolean> = { [owner]: true, [opponent]: caseKind !== 'suk' };
  // The trained leader must be committed (so Warmaster/Suk take effect) exactly
  // when the owner's posture decision hides it behind the shield.
  const ownerLeader = caseKind === 'suk' ? trainers.owner : strongestOther(game, owner, trainers.owner);
  const opponentLeader = caseKind === 'suk' ? strongestOther(game, opponent, trainers.opponent) : trainers.opponent;
  let traitor: string | null = null;
  if (caseKind === 'traitor-cancel') {
    // The opposing Traitor must match the attacker's real committed leader disc.
    conserveTraitor(game, opponent, ownerLeader, staging);
    traitor = ownerLeader;
  }
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find((candidate) => candidate.territory === location);
  assert.ok(choice);
  assert.equal(choice.attacker, owner);
  assert.equal(choice.chooser, owner);
  const battleStep: IndependentSkillsBattleStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: location, target: choice.defender } };
  actions.push(structuredClone(battleStep));
  game = applyAction(game, choice.chooser, battleStep.action);
  game = advanceIndependentSkillsBattle(game,
    (state) => !!state.battle && !state.battle.revealed && independentSkillsBattleClean(state),
    actions, { hide });
  const support = advanced ? 2 : 0;
  const plans: IndependentSkillsBattleStep[] = [
    { actor: owner, action: { type: 'battlePlan', dial: 2, support, leader: ownerLeader,
      weapon: REINFORCEMENTS_CARD, defense: HARASS_WITHDRAW_CARD } },
    { actor: opponent, action: { type: 'battlePlan', dial: 0, support: 0, leader: opponentLeader,
      ...(worthless ? { weapon: worthless.id } : {}) } },
  ];
  for (const plan of plans) {
    actions.push(structuredClone(plan));
    game = applyAction(game, plan.actor, plan.action);
  }
  assert.ok(game.battle?.revealed);
  staging.push(`Both combatants made their real posture decisions before sealing: the Emperor hid its skilled leader behind the shield, the Guild ${caseKind === 'suk' ? 'kept its skilled leader face up and therefore committed another leader' : 'hid its skilled leader so that the committed Warmaster could resolve'}.`);
  const returns: HarassWithdrawSelection = { [first]: { normal: 1, elite: 0 }, [second]: { normal: 1, elite: 0 } };
  const fixture: IndependentSkillsBattleFixture = { ...setup, case: caseKind, advanced, location, first, second,
    beforeShipment, shipment, afterShipment, move, afterMove, opponentMove, beforeBattle, battleStep,
    game, plans, returns, hide, traitor, actions, staging };
  assertIndependentSkillsBattleCustody(game);
  return fixture;
}

/** Quote the real revealed plans, postures and physical custody; Traitor calls and
 * the typed withdrawal allocation are the caller's current human choices. */
export function quoteIndependentSkillsBattle(game: Game,
  options: { callers?: readonly string[]; returns?: HarassWithdrawSelection } = {}) {
  const battle = game.battle;
  assert.ok(battle?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const player = independentSkillsBattlePlayer(game, actor);
    const view = viewGame(game, actor).battle!;
    return { id: actor, faction: player.faction, spice: player.spice, hand: player.hand,
      plan: battle.plans[actor],
      leader: player.leaders.find((leader) => leader.id === battle.plans[actor].leader),
      forces: view.ownForces!,
      leaderSkills: game.leaderSkills!.assignments.filter((assignment) => assignment.owner === actor)
        .map((assignment) => ({ skill: assignment.skill, leader: assignment.leader,
          faceUp: battle.leaderSkillHidden?.[actor] !== true,
          captured: false })),
      ...(view.reinforcements && usesNativeBattleSpecial(battle.plans[actor], REINFORCEMENTS_CARD)
        ? { reinforcementsReserves: { normal: player.reserves - (player.elites?.reserves ?? 0),
          elite: player.elites?.reserves ?? 0 } } : {}),
      ...(view.harassWithdraw && usesNativeBattleSpecial(battle.plans[actor], HARASS_WITHDRAW_CARD) ? { harassWithdraw: { blocked: null,
        forces: view.harassWithdraw.forces, locations: view.harassWithdraw.locations,
        ...(view.harassWithdraw.occupy ? { occupy: view.harassWithdraw.occupy } : {}) },
        ...(options.returns ? { harassSelection: options.returns } : {}) } : {}) };
  };
  return quoteBattleResolution({
    advanced: game.advanced,
    turn: game.turn,
    territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor,
    attacker: side(battle.attacker),
    defender: side(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map((id) => ({ id, beneficiary: id,
      called: options.callers?.includes(id) ?? false,
      traitors: independentSkillsBattlePlayer(game, id).traitors })),
    participants: game.players,
    physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap((player) => player.hand)],
    pendingAuditorPresent: false,
    pendingRetentionPresent: false,
  });
}

/** Resolve the real aftermath: Traitor calls, the typed withdrawal allocation, the
 * Suk rescue choice and mandatory disposal, stopping at the original Collection. */
export function finishIndependentSkillsBattle(game: Game,
  options: { callers?: readonly string[]; return?: HarassWithdrawSelection;
    rescue?: (options: readonly SukRescueOption[]) => number;
    actions?: IndependentSkillsBattleStep[]; until?: (state: Game) => boolean } = {}): Game {
  const until = options.until ?? ((state: Game) =>
    state.phase === 7 && independentSkillsBattleClean(state));
  for (let count = 0; count < 400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    let step: IndependentSkillsBattleStep | null;
    if (game.decision?.kind === 'harassWithdraw') {
      assert.ok(options.return, 'Supply the genuine typed undialed return allocation');
      step = { actor: game.decision.player, action: { type: 'decision', event: game.decision.event,
        returns: options.return } };
    } else if (game.decision?.kind === 'sukRescue') {
      const decision = game.decision;
      const choice = options.rescue ? options.rescue(decision.options)
        : decision.options.findIndex((option) => option.normal + option.elite === 2 && option.kept);
      assert.ok(choice >= 0, 'Choose one real Suk Graduate rescue option');
      step = { actor: decision.player, action: { type: 'decision', event: decision.event, choice } };
    } else {
      const next = nextIndependentSkillsBattleStep(game);
      step = next && next.action.type === 'traitorCall'
        ? { ...next, action: { type: 'traitorCall', call: options.callers?.includes(next.actor) ?? false } }
        : next;
    }
    assert.ok(step, 'Resolve both original plans before their physical aftermath');
    options.actions?.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  }
  throw Error('The original classic battle aftermath did not reach Collection');
}
