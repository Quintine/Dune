import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game, type Player } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { withoutEcazLoyalty } from '../game/ecaz-loyalty';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { traitorDeck } from '../game/traitors';
import {
  defaultHarassWithdrawAllocation, HARASS_WITHDRAW_CARD,
  type HarassWithdrawSelection,
} from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import type { SukRescueOption } from '../game/suk-graduate';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { chooseEcazOccupyLead, finishEcazOccupySetup, stageEcazOccupyCard } from './fixture-ecaz-occupy';
import { createHomeworldEcazOccupyFixture } from './fixture-homeworld-ecaz-occupy';

/** Printed E3 shared rule (docs/ECAZ_TREACHERY_RULES.md): the three-card variant
 * is independent of faction selection and other variants, so standalone Ecaz
 * and the native Ecaz/Moritani pair keep it; all14 Leader Skills is the separate
 * optional module documented in docs/LEADER_SKILLS_RULES.md. Card timings and the
 * fee-before-return order stay provisional as recorded there, not new rulings. */
export type EcazIndependentSkillsStep = { actor: string; action: Action };
export type EcazIndependentSkillsCard = 'reinforcements' | 'harass';
export type EcazIndependentSkillsOptions = {
  advanced?: boolean;
  /** Native Ecaz/Moritani seats; the default keeps the standalone Emperor ally. */
  paired?: boolean;
  /** All14 skills; Basic and Advanced are both genuine native bands. */
  skills?: boolean;
  /** The independent physical three-card variant; `false` is the printed no-card control. */
  independent?: boolean;
  /** Original optional modules, both off by default; Strongholds require Advanced. */
  tech?: boolean;
  strongholds?: boolean;
  /** Real native Battle Plan cards in the lead's own plan. */
  cards?: readonly EcazIndependentSkillsCard[];
  lead?: 'ecaz' | 'ally';
  /** Trained posture: hide the Ecaz skill for the skilled band, reveal for normal. */
  hide?: boolean;
  /** The opponent holds the real Traitor matching the committed lead disc and calls it. */
  traitor?: boolean;
};
export type EcazIndependentSkillsPolicy = { hide?: Record<string, boolean> };

export const ECAZ_INDEPENDENT_SKILLS_CARD_IDS = {
  reinforcements: REINFORCEMENTS_CARD, harass: HARASS_WITHDRAW_CARD,
} as const;
/** Reinforcements occupies the weapon slot, Harass & Withdraw the defense slot. */
export const ECAZ_INDEPENDENT_SKILLS_SLOTS = {
  reinforcements: 'weapon', harass: 'defense',
} as const;

export const ecazIndependentSkillsPlayer = (game: Game, actor: string): Player => {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing original seat ${actor}`);
  return player;
};
export const ecazIndependentSkillsClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard;

/** Scoped deterministic entropy for this bounded programme, following the
 * existing independent-skills fixtures: the fourteen-card lottery is solved with
 * real Fisher-Yates draws, later single-word draws in the same creation keep the
 * fixed maximum value, larger native requests are forwarded, and the patch is
 * restored even when a native action rejects. */
function entropy<T>(run: () => T, rolls: readonly number[]): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < rolls.length ? rolls[cursor++] : 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
/** Actual Fisher-Yates draws for one desired fourteen-card order. */
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
export function stepEcazIndependentSkills(game: Game, step: EcazIndependentSkillsStep): Game {
  return applyAction(game, step.actor, step.action);
}
/** Real native decisions only; a human plan, withdrawal allocation or rescue
 * choice is never invented by this helper. */
export function nextEcazIndependentSkillsStep(game: Game,
  policy: EcazIndependentSkillsPolicy = {}): EcazIndependentSkillsStep | null {
  if (!game.response && !game.phaseOpening) {
    const decision = game.decision;
    if (decision?.kind === 'leaderSkillVisibility')
      return { actor: decision.player, action: { type: 'leaderSkillVisibility', event: decision.event,
        hide: policy.hide?.[decision.player] ?? true } };
    if (decision?.kind === 'guildTiming')
      return { actor: decision.player, action: { type: 'decision', take: false } };
    if (decision?.kind === 'mentatQuestion')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'rihani')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, draw: false } };
    if (decision?.kind === 'faceDance')
      return { actor: decision.player, action: { type: 'decision', reveal: false } };
    if (decision?.kind === 'techToken')
      return { actor: decision.player, action: { type: 'decision', token: decision.choices[0] } };
    if (['sukRescue', 'harassWithdraw', 'battleLosses'].includes(decision?.kind ?? '')) return null;
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceEcazIndependentSkills(state: Game, until: (game: Game) => boolean,
  actions: EcazIndependentSkillsStep[] = [], policy: EcazIndependentSkillsPolicy = {}): Game {
  let game = state;
  for (let count = 0; count < 1500; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextEcazIndependentSkillsStep(game, policy);
    assert.ok(step, 'Supply the genuine private plan, typed return or rescue choice');
    actions.push(structuredClone(step));
    game = stepEcazIndependentSkills(game, step);
  }
  throw Error('The native Ecaz independent programme did not reach its boundary');
}
/** Only conserved physical card custody moves; no stock, forces or wallet. */
export function stageEcazIndependentSkillsCard(game: Game, actor: string,
  id: string, staging: string[]): string {
  const staged = stageEcazOccupyCard(game, actor, card => card.id === id);
  staging.push(`Conserved ${staged}: original deck/discard/hand → ${actor} hand; not a purchase, native deal or a new physical card`);
  return staged;
}
/** The admitted original card source (thirty-six with the independent variant),
 * all14 skills and ordinary counters. */
export function assertEcazIndependentSkillsCustody(game: Game): void {
  if (game.leaderSkills) validateLeaderSkills(game.leaderSkills, game.players);
  const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + sum(player.forces), 20, player.faction);
    assert.ok([player.reserves, player.tanks, ...Object.values(player.forces)]
      .every(count => Number.isSafeInteger(count) && count >= 0), player.faction);
    if (player.elites) {
      assert.equal(player.elites.reserves + player.elites.tanks + sum(player.elites.forces),
        player.faction === 'emperor' ? 5 : 3, player.faction);
      assert.ok([player.elites.reserves, player.elites.tanks, ...Object.values(player.elites.forces)]
        .every(count => Number.isSafeInteger(count) && count >= 0), player.faction);
      assert.ok(player.elites.reserves <= player.reserves && player.elites.tanks <= player.tanks);
      for (const [key, count] of Object.entries(player.elites.forces))
        assert.ok(count <= (player.forces[key] ?? 0));
    }
    assert.ok(player.hand.length <= handLimit(player), player.faction);
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.deepEqual(cards.map(card => card.id).sort(), [...treacheryDeck(game.expansions),
    ...(game.ecazTreachery ? ecazTreacheryCards() : [])].map(card => card.id).sort());
  assert.deepEqual([...(game.traitorReserve ?? []), ...game.players.flatMap(p => p.traitors),
    ...game.players.flatMap(p => (p.faceDancers ?? []).map(dancer => dancer.leader))].sort(),
  withoutEcazLoyalty(traitorDeck(game.players, game.expansions.includes('ix')), game.ecazLoyalty).sort());
}

export type EcazIndependentSkillsFixture = {
  /** Original fresh lobby/setup snapshots taken by the shared genuine programme. */
  initial: Game; afterSetup: Game;
  /** Real turn-one Mentat acquisition, before the worm alliance and battle. */
  afterFirstMentat?: Game; strongholdTerritory?: string;
  /** Original before-lead window and the recorded native lead choice. */
  beforeLead: Game; leadStep: EcazIndependentSkillsStep; afterLead: Game;
  /** Clean before-plan window (both plans still unsealed) and the real plans. */
  beforePlans: Game; plans: EcazIndependentSkillsStep[];
  /** Revealed window: both original plans sealed, postures committed. */
  game: Game;
  /** Typed physical allocation derived from the real projected offer. */
  returns: HarassWithdrawSelection;
  ecaz: string; ally: string; opponent: string; territory: string; location: string;
  fixedEcazDial: number; planDial: number; support: number;
  cardUser: string; cardIds: string[]; cardKinds: EcazIndependentSkillsCard[];
  /** Ecaz's real trained disc; null when the no-Skills control is used. */
  trainer: string | null;
  /** Conserved opposing Traitor identity and its actual caller seats. */
  traitor: string | null; callers: string[];
  advanced: boolean; skills: boolean; independent: boolean; hide: boolean;
  actions: EcazIndependentSkillsStep[]; staging: string[];
};

/** Original offered card and eligible disc for every seat; Ecaz requests its
 * trained Suk Graduate. The captured `initial` snapshot stays untouched. */
function trainEcazSeat(initial: Game, steps: EcazIndependentSkillsStep[]): Game {
  let game = initial;
  while (game.status === 'setup' && game.setupStage === 'leaderSkills') {
    const actor = Object.keys(game.leaderSkills!.offers)[0];
    const offer = game.leaderSkills!.offers[actor];
    const view = viewGame(game, actor).leaderSkills!;
    const skill: LeaderSkillId = actor === 'ecaz' ? 'suk-graduate'
      : offer.cards.find(card => !view.unavailableSkills?.[card])!;
    assert.ok(offer.cards.includes(skill), 'The requested original skill must be in the real offer');
    assert.ok(!view.unavailableSkills?.[skill], 'The requested original skill must be selectable');
    const eligible = new Set(view.eligibleLeaders.map(leader => leader.id));
    const leader = ecazIndependentSkillsPlayer(game, actor).leaders
      .filter(disc => eligible.has(disc.id)).sort((a, b) => b.strength - a.strength)[0];
    assert.ok(leader, 'The real eligible leaders must supply this seat’s choice');
    const step: EcazIndependentSkillsStep = { actor,
      action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    steps.push(structuredClone(step));
    game = stepEcazIndependentSkills(game, step);
  }
  return finishEcazOccupySetup(game);
}

/** Conserved original Traitor identity: one real held card exchanges with the
 * opponent's reserve copy so the printed call has genuine custody. */
function conserveTraitor(game: Game, actor: string, identity: string, staging: string[]): void {
  const player = ecazIndependentSkillsPlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0];
  assert.ok(returned, 'The opponent needs an original Traitor Card to exchange');
  const reserve = game.traitorReserve?.indexOf(identity) ?? -1;
  const donor = game.players.find(seat => seat.id !== actor && seat.traitors.includes(identity));
  assert.ok(reserve >= 0 || donor, 'The requested Traitor must retain original custody');
  if (reserve >= 0) game.traitorReserve!.splice(reserve, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Conserved Traitor ${identity}: original ${donor?.id ?? 'reserve'} custody exchanged with ${actor}'s ${returned}; no new Traitor Card`);
}

/** Real living disc for a sealed plan; a revealed skilled leader has to stay
 * behind the shield, so it is never offered here. */
function battleLeader(game: Game, seat: string, exclude: string | null, strongest: boolean): string {
  const discs = ecazIndependentSkillsPlayer(game, seat).leaders
    .filter(disc => !disc.dead && !disc.usedAt && disc.id !== exclude);
  assert.ok(discs.length, `The ${seat} roster must supply a legal living leader`);
  return discs.sort((a, b) => (strongest ? b.strength - a.strength : a.strength - b.strength) ||
    a.id.localeCompare(b.id))[0].id;
}

/** Genuine native setup, a real worm Nexus alliance, paid Arrakis shipments and
 * the original lead/plan windows. With skills the all14 lottery is solved with
 * real Fisher-Yates draws so Ecaz’s own offer holds its Suk Graduate, while the
 * remaining single-word draws in this one creation keep the fixed maximum value
 * and larger native requests are forwarded unchanged. */
export function createEcazIndependentSkillsFixture(
  options: EcazIndependentSkillsOptions = {},
): EcazIndependentSkillsFixture {
  const advanced = options.advanced ?? true;
  const skills = options.skills ?? true;
  const independent = options.independent ?? true;
  const hide = options.hide ?? true;
  const lead = options.lead ?? 'ecaz';
  const cardKinds = [...(options.cards ?? ['reinforcements', 'harass'] as const)];
  const picks: EcazIndependentSkillsStep[] = [];
  const staging: string[] = [];
  const order = ['suk-graduate' as LeaderSkillId,
    ...LEADER_SKILL_CARDS.map(card => card.id).filter(id => id !== 'suk-graduate')];
  const draws = skills ? permutationDraws(LEADER_SKILL_CARDS.map(card => card.id), order) : [];
  const shared = entropy(() => createHomeworldEcazOccupyFixture({
    advanced, skills, independent, homeworlds: false,
    tech: options.tech ?? false, strongholds: options.strongholds ?? false,
    ...(options.paired ? { allyFaction: 'moritani' as const } : {}),
    ...(skills ? { finishSetup: (initial: Game) => trainEcazSeat(initial, picks) } : {}),
  }), draws);
  if (skills) {
    staging.push('Solved the original fourteen-card lottery with real Fisher-Yates draws for Ecaz’s own offer; later single-word draws in this creation kept the fixed maximum value and larger native requests were forwarded unchanged.');
    assert.equal(shared.initial.leaderSkills !== undefined, true);
    const ecazAssignment = shared.afterSetup.leaderSkills!.assignments.find(a => a.owner === shared.ecaz);
    assert.equal(ecazAssignment?.skill, 'suk-graduate',
      'The requested original skill must be the real assignment of that seat');
  } else {
    assert.equal(shared.initial.leaderSkills, undefined);
    assert.equal(shared.afterSetup.leaderSkills, undefined);
  }
  assert.equal(shared.initial.ecazTreachery === true, independent,
    'The independent three-card variant must be an original lobby selection');
  const trainer = skills ? shared.afterSetup.leaderSkills!.assignments.find(a => a.owner === shared.ecaz)!.leader : null;
  const beforeLead = structuredClone(shared.game);
  assert.equal(beforeLead.decision?.kind, 'ecazBattleLead',
    'The printed Ecaz Occupy lead choice must be the genuine pending decision');
  const leadStep: EcazIndependentSkillsStep = { actor: shared.ecaz, action: { type: 'decision',
    event: beforeLead.decision!.event, lead: lead === 'ecaz' ? shared.ecaz : shared.ally } };
  const actions: EcazIndependentSkillsStep[] = [...shared.actions, ...picks];
  let game = chooseEcazOccupyLead({ ...shared, game: beforeLead }, lead);
  actions.push(structuredClone(leadStep));
  const policy: EcazIndependentSkillsPolicy = { hide: {
    [shared.ecaz]: hide, [shared.ally]: true, [shared.opponent]: true } };
  game = advanceEcazIndependentSkills(game,
    state => !!state.battle && ecazIndependentSkillsClean(state) && !state.battle.preparation &&
      state.battle.preLeader?.closed !== false, actions, policy);
  const afterLead = structuredClone(game);
  const beforePlans = structuredClone(game);
  const cardUser = lead === 'ecaz' ? shared.ecaz : shared.ally;
  const cardIds = cardKinds.map(kind => stageEcazIndependentSkillsCard(game, cardUser,
    ECAZ_INDEPENDENT_SKILLS_CARD_IDS[kind], staging));
  const profile = viewGame(game, cardUser).battle?.ecazOccupy?.profile;
  assert.ok(profile, 'The selected coalition must quote its real Occupy profile');
  assert.equal(profile.lead, cardUser);
  const own: { weapon?: string; defense?: string } = {};
  for (const [index, kind] of cardKinds.entries())
    own[ECAZ_INDEPENDENT_SKILLS_SLOTS[kind]] = cardIds[index];
  const variable = 2;
  const support = variable;
  const allyTrainer = game.leaderSkills?.assignments.find(a => a.owner === shared.ally)?.leader;
  const planLeader = cardUser === shared.ecaz
    ? (skills && hide ? trainer! : battleLeader(game, shared.ecaz, trainer, true))
    : battleLeader(game, shared.ally, allyTrainer ?? null, true);
  const defender = battleLeader(game, shared.opponent, null, false);
  const traitor = options.traitor ? planLeader : null;
  const callers: string[] = [];
  if (traitor) {
    conserveTraitor(game, shared.opponent, traitor, staging);
    callers.push(shared.opponent);
  }
  const plans: EcazIndependentSkillsStep[] = [
    { actor: cardUser, action: { type: 'battlePlan', dial: profile.fixedEcazDial + variable,
      support, allyPayment: 0, leader: planLeader, ...own } },
    { actor: shared.opponent, action: { type: 'battlePlan', dial: 0, support: 0,
      leader: defender, weapon: null, defense: null } },
  ];
  for (const plan of plans) {
    actions.push(structuredClone(plan));
    game = stepEcazIndependentSkills(game, plan);
  }
  assert.ok(game.battle?.revealed, 'Both original plans must be revealed');
  // A sole legal allocation is applied by the engine; otherwise the card user
  // still holds a genuine typed sector choice, derived from the real offer.
  let returns: HarassWithdrawSelection = {};
  if (game.decision?.kind === 'harassWithdraw') {
    const offer = viewGame(game, game.decision.player).battle?.harassAllocation;
    assert.ok(offer, 'Use only the actual revealed physical allocation offer');
    returns = defaultHarassWithdrawAllocation(offer.context, offer.dial, offer.support);
  }
  const fixture: EcazIndependentSkillsFixture = {
    initial: shared.initial, afterSetup: shared.afterSetup,
    afterFirstMentat: shared.afterFirstMentat, strongholdTerritory: shared.strongholdTerritory,
    beforeLead, leadStep, afterLead,
    beforePlans, plans, game, returns, ecaz: shared.ecaz, ally: shared.ally, opponent: shared.opponent,
    territory: shared.territory, location: shared.location, fixedEcazDial: profile.fixedEcazDial,
    planDial: profile.fixedEcazDial + variable, support, cardUser, cardIds, cardKinds, trainer,
    traitor, callers, advanced, skills, independent, hide, actions, staging,
  };
  assertEcazIndependentSkillsCustody(game);
  return fixture;
}

/** Real revealed quote: the card user's own reserve fee, the coalition scores
 * and the typed own-army withdrawal groups, never a merged army. */
export function quoteEcazIndependentSkillsBattle(f: EcazIndependentSkillsFixture, state?: Game) {
  const game = state ?? f.game;
  const battle = game.battle;
  assert.ok(battle?.revealed, 'Quote only the genuinely revealed original battle');
  const view = viewGame(game, f.cardUser).battle!;
  const seat = (actor: string): ResolutionCombatant => {
    const player = ecazIndependentSkillsPlayer(game, actor);
    const own = viewGame(game, actor).battle!;
    const plan = battle.plans[actor];
    assert.ok(plan, `The ${actor} plan must be sealed`);
    return { id: actor, faction: player.faction, spice: player.spice, hand: player.hand, plan,
      leader: player.leaders.find(leader => leader.id === plan.leader),
      forces: own.ownForces!,
      stronghold: own.strongholdEffects[actor],
      leaderSkills: (game.leaderSkills?.assignments ?? []).filter(a => a.owner === actor)
        .map(a => ({ skill: a.skill, leader: a.leader,
          faceUp: battle.leaderSkillHidden?.[actor] !== true, captured: false })),
      ...(own.reinforcements ? { reinforcementsReserves: {
        normal: player.reserves - (player.elites?.reserves ?? 0), elite: player.elites?.reserves ?? 0 } } : {}),
      ...(own.harassWithdraw ? { harassWithdraw: { blocked: null, forces: own.harassWithdraw.forces,
        locations: own.harassWithdraw.locations,
        ...(own.harassWithdraw.occupy ? { occupy: own.harassWithdraw.occupy } : {}) },
        ...(Object.keys(f.returns).length ? { harassSelection: f.returns } : {}) } : {}) };
  };
  assert.ok(view.ecazOccupy?.profile, 'Quote the actual selected native coalition');
  return quoteBattleResolution({
    advanced: game.advanced,
    turn: game.turn,
    territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor,
    ecazOccupy: view.ecazOccupy.profile,
    attacker: seat(battle.attacker),
    defender: seat(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map(id => ({ id,
      beneficiary: battle.ecazOccupy?.lead && [f.ecaz, f.ally].includes(id)
        ? battle.ecazOccupy.lead : id,
      called: false, traitors: ecazIndependentSkillsPlayer(game, id).traitors })),
    participants: game.players,
    physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)],
    pendingAuditorPresent: false,
    pendingRetentionPresent: false,
  });
}

/** Real lead choice for a custom programme; the recorded step stays legal. */
export function chooseEcazIndependentSkillsLead(game: Game, lead: 'ecaz' | 'ally',
  ecaz: string, ally: string): EcazIndependentSkillsStep {
  const decision = game.decision;
  assert.ok(decision?.kind === 'ecazBattleLead', 'Only the native Ecaz lead choice may select this plan owner');
  return { actor: ecaz, action: { type: 'decision', event: decision.event, lead: lead === 'ecaz' ? ecaz : ally } };
}

/** Resolve the original aftermath: Traitor calls, the typed withdrawal
 * allocation, the real casualty choices, the Suk rescue and mandatory disposal,
 * stopping at native Spice Collection. */
export function settleEcazIndependentSkillsBattle(f: EcazIndependentSkillsFixture,
  options: { state?: Game; returns?: HarassWithdrawSelection;
    rescue?: (options: readonly SukRescueOption[]) => number;
    stop?: 'rescue' | 'returns' | 'collection' } = {}): Game {
  let game = structuredClone(options.state ?? f.game);
  for (let count = 0; count < 400; count++) {
    if (options.stop === 'rescue' && game.decision?.kind === 'sukRescue') return game;
    if (options.stop === 'returns' && game.decision?.kind === 'harassWithdraw') return game;
    if (game.phase === 7 && ecazIndependentSkillsClean(game)) return game;
    assert.notEqual(game.status, 'finished');
    let step: EcazIndependentSkillsStep | null;
    const decision = game.decision;
    if (decision?.kind === 'harassWithdraw') {
      const returns = options.returns ?? f.returns;
      const offer = viewGame(game, decision.player).battle?.harassAllocation;
      assert.ok(offer, 'Use only the actual revealed physical allocation offer');
      step = { actor: decision.player, action: { type: 'decision', event: decision.event, returns } };
    } else if (decision?.kind === 'battleLosses') {
      const index = decision.options.findIndex(option => option.normal === f.planDial - f.fixedEcazDial &&
        option.elite === 0);
      step = { actor: decision.player, action: { type: 'decision',
        choice: index >= 0 ? index : 0 } };
    } else if (decision?.kind === 'sukRescue') {
      const choice = options.rescue ? options.rescue(decision.options)
        : decision.options.findIndex(option => option.normal === f.fixedEcazDial && option.elite === 0 && option.kept);
      assert.ok(choice >= 0, 'Choose one real Suk Graduate rescue option');
      step = { actor: decision.player, action: { type: 'decision', event: decision.event, choice } };
    } else {
      const next = nextEcazIndependentSkillsStep(game);
      step = next && next.action.type === 'traitorCall'
        ? { ...next, action: { type: 'traitorCall', call: f.callers.includes(next.actor) } } : next;
    }
    assert.ok(step, 'Resolve both original plans before their physical aftermath');
    game = stepEcazIndependentSkills(game, step);
  }
  throw Error('The native Ecaz independent battle did not reach Collection');
}
