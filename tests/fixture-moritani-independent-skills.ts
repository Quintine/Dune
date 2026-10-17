import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, joinGame, newPlayer, viewGame,
  type Action, type Game, type Player,
} from '../game/engine';
import { treacheryDeck, type Card } from '../game/cards';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { withoutEcazLoyalty } from '../game/ecaz-loyalty';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { traitorDeck } from '../game/traitors';
import {
  HARASS_WITHDRAW_CARD, defaultHarassWithdrawAllocation,
  type HarassWithdrawContext, type HarassWithdrawSelection,
} from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { quoteIndependentSkillsBattle } from './fixture-independent-skills-battle';
import { holdMoritaniStrongholdsTraitor } from './fixture-moritani-strongholds';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type MoritaniIndependentSkillsStep = { actor: string; action: Action };
/** 'guild' keeps the classic Heighliner opponent; 'harkonnen' is the native
 * no-Skills Advanced roster and exercises its real capture offer. */
export type MoritaniIndependentSkillsOpponent = 'guild' | 'harkonnen';
export type MoritaniIndependentSkillsOptions = {
  /** Original rules mode of the fresh lobby built here; never a preview marker. */
  rules?: 'basic' | 'advanced';
  /** All fourteen physical Leader Skill cards, dealt by the real initializer. */
  skills?: boolean;
  /** The independent three-card Ecaz Treachery variant of printed p. 18. */
  cards?: boolean;
  opponent?: MoritaniIndependentSkillsOpponent;
  /** Native Ecaz replaces the classic opponent; both factions keep printed setup.
   * `opponent` remains the standalone-only Guild/Harkonnen selector. */
  paired?: boolean;
  /** Conserved Traitor identity Moritani really holds: the unused target disc
   * (default) or the winning committed disc, for a real normal Traitor call. */
  traitor?: 'target' | 'winner';
  /** Continue only the fresh classic/E3 lobby this fixture itself built. */
  initial?: Game;
};
/** Real human controls only: the loss owner's typed withdrawal, every Traitor
 * call, the winner's cleanup discard, the Harkonnen capture offer and the
 * Assassinate choice are never invented by a fallback. */
export type MoritaniIndependentSkillsPolicy = {
  placement?: { territory: string; sector: number };
  harassReturns?: HarassWithdrawSelection | ((context: HarassWithdrawContext) => HarassWithdrawSelection);
  traitorCalls?: readonly string[];
  /** Played cards the winner really discards during the original cleanup. */
  winnerDiscard?: 'played' | 'none';
  /** Real Harkonnen Advanced choice: decline by default, or capture and then
   * keep or execute the captive through the original offer and response. */
  capture?: { accept: boolean; captured?: 'keep' | 'execute' };
  hide?: Readonly<Record<string, boolean>>;
};
export type MoritaniIndependentSkillsFixture = {
  initial: Game;
  offered: Game;
  afterSetup: Game;
  beforeSplit: Game;
  split: MoritaniIndependentSkillsStep;
  afterSplit: Game;
  entry: MoritaniIndependentSkillsStep;
  afterEntry: Game;
  beforeBattle: Game;
  battleStep: MoritaniIndependentSkillsStep;
  /** Phase-six window with the real battle chosen and both plans unsealed. */
  game: Game;
  plans: MoritaniIndependentSkillsStep[];
  revealed: Game;
  /** The real typed undialed return of the loser's revealed Harass plan. */
  returns: HarassWithdrawSelection | null;
  returnsContext: HarassWithdrawContext | null;
  /** Real post-loss state: the owner's Assassinate choice (Advanced), the
   * Harkonnen capture offer, or the clean continuation (Basic). */
  pending: Game;
  moritani: string;
  opponent: string;
  third: string;
  territory: string;
  first: string;
  second: string;
  /** The opposing leader disc that was really committed and won. */
  winnerLeader: string;
  /** The losing Moritani disc that was really committed. */
  loserLeader: string;
  /** Conserved physical Traitor identity held by Moritani for this battle. */
  traitorTarget: string;
  /** The identity Moritani really holds, which may be the winning disc. */
  heldTraitor: string;
  chosen: Record<string, LeaderSkillId>;
  cards: { reinforcements: string | null; harass: string | null; winnerWeapon: string };
  actions: MoritaniIndependentSkillsStep[];
  staging: string[];
};
export const moritaniIndependentSkillsPlayer = (game: Game, actor: string): Player => {
  const player = game.players.find((seat) => seat.id === actor);
  assert.ok(player, `Missing original seat ${actor}`);
  return player;
};
export const moritaniIndependentSkillsClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard;
/** Scoped real shuffle entropy, restored even when a native action rejects. */
function entropy<T>(run: () => T, rolls: readonly number[] = []): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array)
      for (let index = 0; index < array.length; index++) array[index] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
/** Only the original fourteen-card lottery is solved; later native draws keep
 * a fixed maximum value, and every roll is restored afterwards. */
function skillRolls(chosen: readonly LeaderSkillId[]): number[] {
  const source = LEADER_SKILL_CARDS.map((card) => card.id);
  const rest = source.filter((id) => !chosen.includes(id));
  const desired = chosen.flatMap((id) => [id, rest.shift()!]).concat(rest);
  const work = [...source], rolls: number[] = [];
  for (let index = work.length - 1; index > 0; index--) {
    const from = work.indexOf(desired[index]);
    assert.ok(from >= 0 && from <= index);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (index + 1)));
    [work[index], work[from]] = [work[from], work[index]];
  }
  return rolls;
}
export function stepMoritaniIndependentSkills(game: Game, step: MoritaniIndependentSkillsStep): Game {
  return entropy(() => applyAction(game, step.actor, step.action));
}
/** Real private projection and bot policy; never alters a human lobby seat. */
export function moritaniIndependentSkillsPolicy(
  game: Game, actor: string, difficulty: Difficulty = 'Easy',
): Action[] {
  const view = viewGame(game, actor);
  view.players.find((player) => player.id === actor)!.bot = difficulty;
  return entropy(() => botActions(view));
}
/** Only genuine native decisions; a human plan, Traitor call, typed return,
 * capture response or Assassinate choice is never invented here. */
export function nextMoritaniIndependentSkillsStep(
  game: Game, policy: MoritaniIndependentSkillsPolicy = {},
): MoritaniIndependentSkillsStep | null {
  if (!game.response && !game.phaseOpening) {
    const decision = game.decision;
    if (decision?.kind === 'guildTiming')
      return { actor: decision.player, action: { type: 'decision', take: false } };
    if (decision?.kind === 'moritaniSetup') {
      const placement = policy.placement;
      assert.ok(placement, 'Supply the real unoccupied Moritani starting territory');
      return { actor: decision.player, action: { type: 'decision',
        territory: placement.territory, sector: placement.sector } };
    }
    if (decision?.kind === 'leaderSkillVisibility')
      return { actor: decision.player, action: { type: 'leaderSkillVisibility',
        event: decision.event, hide: policy.hide?.[decision.player] ?? false } };
    if (decision?.kind === 'mentatQuestion')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'rihani')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, draw: false } };
    if (decision?.kind === 'battleLosses')
      return { actor: decision.player, action: { type: 'decision', choice: 0 } };
    if (decision?.kind === 'battleCards')
      return { actor: decision.player, action: { type: 'decision',
        discard: policy.winnerDiscard === 'none' ? [] : [...decision.cards] } };
    if (decision?.kind === 'captureOffer')
      return { actor: decision.player,
        action: { type: 'decision', accept: policy.capture?.accept ?? false } };
    if (decision?.kind === 'capturedLeader')
      return { actor: decision.player,
        action: { type: 'decision', mode: policy.capture?.captured ?? 'keep' } };
    if (decision?.kind === 'moritaniPlacement' || decision?.kind === 'ecazPlacement')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision?.kind === 'moritaniSpecialKarama')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'moritaniAssassinate' || decision?.kind === 'harassWithdraw' ||
      decision?.kind === 'sukRescue' || decision?.kind === 'handExchange') return null;
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceMoritaniIndependentSkills(
  state: Game, until: (game: Game) => boolean,
  actions: MoritaniIndependentSkillsStep[] = [], policy: MoritaniIndependentSkillsPolicy = {},
): Game {
  let game = structuredClone(state);
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextMoritaniIndependentSkillsStep(game, policy);
    assert.ok(step, `Supply the original human choice at ${game.phase}/${game.decision?.kind}`);
    actions.push(structuredClone(step));
    game = stepMoritaniIndependentSkills(game, step);
  }
  throw Error('The standalone Moritani programme did not reach its requested boundary');
}
const counterTotal = (forces: Record<string, number>) =>
  Object.values(forces).reduce((sum, count) => sum + count, 0);
/** Conserved physical custody: counters, the real 33/36-card inventory, all
 * fourteen skills and every Traitor identity, including Assassinate removal. */
export function assertMoritaniIndependentSkillsCustody(game: Game): void {
  if (game.leaderSkills) validateLeaderSkills(game.leaderSkills, game.players);
  const removed = (game.moritaniAssassinate?.opportunities ?? [])
    .filter((receipt) => receipt.stage === 'replaced').map((receipt) => receipt.card!);
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + counterTotal(player.forces), 20, player.faction);
    assert.ok([player.reserves, player.tanks, ...Object.values(player.forces)]
      .every((count) => Number.isSafeInteger(count) && count >= 0), player.faction);
    if (player.elites) assert.equal(
      player.elites.reserves + player.elites.tanks + counterTotal(player.elites.forces),
      player.faction === 'emperor' ? 5 : 3, player.faction);
    assert.ok(player.hand.length <= handLimit(player), player.faction);
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap((player) => player.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.deepEqual(cards.map((card) => card.id).sort(),
    [...treacheryDeck(game.expansions), ...(game.ecazTreachery ? ecazTreacheryCards() : [])]
      .map((card) => card.id).sort(),
    'Every physical Treachery Card must stay in one known zone.');
  assert.deepEqual([...(game.traitorReserve ?? []), ...game.players.flatMap((player) => player.traitors), ...removed].sort(),
    withoutEcazLoyalty(traitorDeck(game.players), game.ecazLoyalty).sort(),
    'Every circulating or assassinated Traitor stays physical; Loyalty remains outside the deck.');
}
/** Conserved physical card custody; no purchase, adoption or minted identity. */
function conserveCard(game: Game, actor: string, match: (card: Card) => boolean, staging: string[]): Card {
  const player = moritaniIndependentSkillsPlayer(game, actor);
  const held = player.hand.find(match);
  if (held) return held;
  const zones = [{ label: 'remaining original deck', cards: game.deck },
    { label: 'original discard', cards: game.discard },
    ...game.players.filter((other) => other.id !== actor).map((other) => ({ label: other.id, cards: other.hand }))];
  const source = zones.find((zone) => zone.cards.some(match));
  assert.ok(source, 'The required physical card must stay in deck, discard or hand custody');
  if (player.hand.length >= handLimit(player)) {
    const returned = player.hand.shift()!;
    game.deck.push(returned);
    staging.push(`Conserved ${returned.id}: ${actor} hand → undealt deck for printed hand capacity`);
  }
  const card = source.cards.splice(source.cards.findIndex(match), 1)[0];
  player.hand.push(card);
  staging.push(`Conserved original ${card.id}: ${source.label} → ${actor} hand; not a purchase or native deal`);
  return card;
}
function board(opponent: MoritaniIndependentSkillsOpponent | 'ecaz') {
  if (opponent === 'ecaz')
    return { battle: 'false_wall_east', from: 'imperial_basin:9', amount: 6, sectors: [8, 9] };
  return opponent === 'guild'
    ? { battle: 'pasty_mesa', from: 'tueks_sietch:5', amount: 5, sectors: [5, 6] }
    : { battle: 'imperial_basin', from: 'carthag:11', amount: 10, sectors: [11, 10] };
}
/** Genuine normal lobby start (no audit profile seam) for a standalone or native
 * paired E3/classic composition with optional all-fourteen skills and cards. */
export function createMoritaniIndependentSkillsFixture(
  options: MoritaniIndependentSkillsOptions = {},
): MoritaniIndependentSkillsFixture {
  const advanced = (options.rules ?? 'advanced') === 'advanced';
  const skills = options.skills ?? false;
  const cards = options.cards ?? false;
  const opponentFaction = options.paired ? 'ecaz' : (options.opponent ?? 'guild');
  assert.ok(!skills || opponentFaction !== 'harkonnen',
    'Leader Skills keep the Harkonnen native roster out of this composition.');
  const plan = board(opponentFaction);
  const target = `${opponentFaction}-1`;
  const winner = `${opponentFaction}-0`;
  const loser = 'moritani-4';
  const heldIdentity = (options.traitor ?? 'target') === 'winner' ? winner : target;
  const chosen: Record<string, LeaderSkillId> = {
    moritani: 'warmaster', [opponentFaction]: 'killer-medic', emperor: 'master-of-assassins',
  };
  const trainedLeader: Record<string, string> = {
    moritani: 'moritani-0', [opponentFaction]: target, emperor: 'emperor-0',
  };
  let game: Game = options.initial ? structuredClone(options.initial)
    : createGame('MORITANIINDEPENDENTSKILLS', newPlayer('moritani', 'Moritani', 'moritani'), advanced, ['ecaz']);
  if (!options.initial) {
    joinGame(game, newPlayer(opponentFaction, opponentFaction, opponentFaction));
    joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  }
  assert.equal(game.advanced, advanced);
  assert.deepEqual(game.expansions, ['ecaz']);
  assert.equal(game.status, 'lobby', 'Continue only a fresh lobby of this exact composition.');
  assert.ok(!game.homeworlds && !game.nexusCards && !game.discoveryEnabled &&
    !game.techTokens && !game.strongholdCards,
    'Only the standalone E3/classic composition without other modules is accepted.');
  const actions: MoritaniIndependentSkillsStep[] = [], staging: string[] = [];
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action: structuredClone(action) });
    game = stepMoritaniIndependentSkills(game, { actor, action });
    return game;
  };
  const initial = structuredClone(game);
  if (skills) act('moritani', { type: 'moduleOption', module: 'leaderSkills', enabled: true });
  if (cards) act('moritani', { type: 'moduleOption', module: 'ecazTreachery', enabled: true });
  for (const player of game.players) if (!player.ready) act(player.id, { type: 'ready' });
  const start: MoritaniIndependentSkillsStep = { actor: 'moritani',
    action: { type: 'start', ...(advanced ? { advancedPreview: true as const } : {}) } };
  actions.push(structuredClone(start));
  game = entropy(() => applyAction(game, start.actor, start.action),
    skills ? skillRolls([chosen.moritani, chosen[opponentFaction], chosen.emperor]) : []);
  staging.push('Normal lobby start through the real module options; the Advanced opt-in is the ordinary lobby action, never a development profile.');
  if (skills) staging.push('Solved only the original fourteen-card Leader Skill lottery with real Fisher-Yates draws; offers, deck and later native shuffles are untouched.');
  const offered = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const leader = moritaniIndependentSkillsPlayer(game, actor).leaders
        .filter((disc) => disc.id === trainedLeader[actor] &&
          view.eligibleLeaders.some((eligible) => eligible.id === disc.id))[0];
      assert.ok(leader, 'The requested original leader must be eligible for this offer');
      assert.ok(offer.cards.includes(chosen[actor]), 'The requested original skill must be in the real offer');
      act(actor, { type: 'leaderSkill', event: offer.event, skill: chosen[actor], leader: leader.id });
      continue;
    }
    if (game.setupStage === 'forces' && opponentFaction === 'ecaz' &&
      viewGame(game, 'ecaz').setupPending.includes('ecaz')) {
      act('ecaz', { type: 'ecazSetup', placements: { [plan.from]: 6 } });
      continue;
    }
    if (game.setupStage === 'traitors' || game.players.some((player) => player.traitorChoices.length)) {
      const player = game.players.find((seat) => seat.traitorChoices.length)!;
      const keep = player.id === 'moritani'
        ? (player.traitorChoices.find((id) => id.startsWith(`${opponentFaction}-`)) ?? player.traitorChoices[0])
        : player.traitorChoices[0];
      act(player.id, { type: 'traitor', leader: keep });
      continue;
    }
    if (game.decision?.kind === 'moritaniSetup') {
      assert.notEqual(game.storm, plan.sectors[0], 'Moritani’s first setup sector must not open inside the storm.');
      act(game.decision.player, { type: 'decision', territory: plan.battle, sector: plan.sectors[0] });
      continue;
    }
    const step = nextStrongholdFactionsNativeStep(game);
    assert.ok(step, `The original setup continuation stopped at ${game.setupStage ?? game.decision?.kind}`);
    act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  const moritani = 'moritani';
  const opponent = game.players.find((seat) => seat.faction === opponentFaction)!.id;
  const third = game.players.find((seat) => seat.faction === 'emperor')!.id;
  assert.equal(moritaniIndependentSkillsPlayer(game, moritani).reserves, 14);
  assert.equal(!!game.moritaniAssassinate, advanced,
    'The printed Advanced assassination producer follows the real rules mode alone.');
  if (skills) assert.equal(game.leaderSkills!.assignments.find((entry) => entry.owner === opponent)!.leader, target);
  if (opponentFaction === 'ecaz') {
    const ecaz = moritaniIndependentSkillsPlayer(game, opponent);
    assert.equal(ecaz.reserves, 14);
    assert.deepEqual(ecaz.forces, { [plan.from]: 6 });
    assert.notEqual(game.ecazLoyalty?.card, target,
      'The trained unused native target must have a circulating physical Traitor.');
    assert.notEqual(game.ecazLoyalty?.card, heldIdentity,
      'Never exchange the face-up Loyalty card into a hand.');
  }
  holdMoritaniStrongholdsTraitor(game, moritani, heldIdentity, staging);
  const afterSetup = structuredClone(game);
  game = advanceMoritaniIndependentSkills(game,
    (state) => state.phase === 5 && state.active === moritani && moritaniIndependentSkillsClean(state), actions);
  const beforeSplit = structuredClone(game);
  assert.equal(moritaniIndependentSkillsPlayer(game, moritani).forces[`${plan.battle}:${plan.sectors[0]}`], 6);
  const split: MoritaniIndependentSkillsStep = { actor: moritani, action: {
    type: 'move', from: `${plan.battle}:${plan.sectors[0]}`, amount: 2,
    territory: plan.battle, sector: plan.sectors[1] } };
  assert.notEqual(game.storm, plan.sectors[1], 'The real within-territory move must not enter the storm sector.');
  game = stepMoritaniIndependentSkills(game, split);
  actions.push(structuredClone(split));
  game = advanceMoritaniIndependentSkills(game,
    (state) => state.phase === 5 && state.active === moritani && moritaniIndependentSkillsClean(state), actions);
  assert.deepEqual(moritaniIndependentSkillsPlayer(game, moritani).forces,
    { [`${plan.battle}:${plan.sectors[0]}`]: 4, [`${plan.battle}:${plan.sectors[1]}`]: 2 });
  staging.push('Moritani split two real counters into a second sector of the same territory, so the printed Harass & Withdraw return is physically ambiguous.');
  const afterSplit = structuredClone(game);
  game = advanceMoritaniIndependentSkills(game,
    (state) => state.phase === 5 && state.active === opponent && moritaniIndependentSkillsClean(state), actions);
  const entrySector = plan.sectors[1];
  assert.notEqual(game.storm, entrySector, 'The real opponent entry must not enter the storm sector.');
  const entry: MoritaniIndependentSkillsStep = { actor: opponent, action: {
    type: 'move', from: plan.from, amount: plan.amount, territory: plan.battle, sector: entrySector } };
  game = stepMoritaniIndependentSkills(game, entry);
  actions.push(structuredClone(entry));
  const afterEntry = structuredClone(game);
  game = advanceMoritaniIndependentSkills(game,
    (state) => state.phase === 6 && !state.battle && moritaniIndependentSkillsClean(state), actions);
  const beforeBattle = structuredClone(game);
  const offeredBattle = viewGame(game, game.active!).battleChoices
    .find((choice) => choice.territory === plan.battle);
  assert.ok(offeredBattle, 'The real co-occupation must produce a native battle choice');
  const battleStep: MoritaniIndependentSkillsStep = { actor: offeredBattle.chooser, action: {
    type: 'chooseBattle', territory: plan.battle,
    target: offeredBattle.attacker === offeredBattle.chooser ? offeredBattle.defender : offeredBattle.attacker } };
  game = stepMoritaniIndependentSkills(game, battleStep);
  actions.push(structuredClone(battleStep));
  game = advanceMoritaniIndependentSkills(game,
    (state) => !!state.battle && !state.battle.revealed && moritaniIndependentSkillsClean(state), actions);
  const reinforcements = cards
    ? conserveCard(game, moritani, (card) => card.id === REINFORCEMENTS_CARD, staging) : null;
  const harass = cards
    ? conserveCard(game, moritani, (card) => card.id === HARASS_WITHDRAW_CARD, staging) : null;
  const winnerWeapon = conserveCard(game, opponent, (card) => card.kind === 'worthless', staging);
  const plans: MoritaniIndependentSkillsStep[] = [
    { actor: moritani, action: { type: 'battlePlan', dial: 2, support: 0, leader: loser,
      ...(reinforcements && harass ? { weapon: REINFORCEMENTS_CARD, defense: HARASS_WITHDRAW_CARD } : {}) } },
    { actor: opponent, action: { type: 'battlePlan',
      dial: options.paired ? (cards ? 4 : 2) : (cards ? 1 : 0),
      support: options.paired && advanced ? (cards ? 4 : 2) : 0,
      leader: winner, weapon: winnerWeapon.id } },
  ];
  const window = structuredClone(game);
  let revealed = structuredClone(game);
  for (const plan of plans) {
    revealed = stepMoritaniIndependentSkills(revealed, plan);
    actions.push(structuredClone(plan));
  }
  assert.ok(revealed.battle?.revealed);
  const footer = (viewGame(revealed, moritani).battle as {
    harassAllocation?: { context: HarassWithdrawContext; dial: number; support: number };
  } | null)?.harassAllocation ?? null;
  assert.ok(!cards || footer, 'The committed Reinforcements fee plus Harass return must be a real physical choice');
  const returns = footer ? defaultHarassWithdrawAllocation(footer.context, footer.dial, footer.support) : null;
  const fixture: MoritaniIndependentSkillsFixture = {
    initial, offered, afterSetup, beforeSplit, split, afterSplit, entry, afterEntry, beforeBattle,
    battleStep, game: window, plans, revealed, returns, returnsContext: footer?.context ?? null,
    pending: structuredClone(revealed), moritani, opponent, third, territory: plan.battle,
    first: `${plan.battle}:${plan.sectors[0]}`, second: `${plan.battle}:${plan.sectors[1]}`,
    winnerLeader: winner, loserLeader: loser, traitorTarget: target, heldTraitor: heldIdentity, chosen,
    cards: { reinforcements: reinforcements?.id ?? null, harass: harass?.id ?? null, winnerWeapon: winnerWeapon.id },
    actions, staging,
  };
  return { ...fixture, pending: resolveMoritaniIndependentSkillsBattle(fixture, revealed) };
}
/** The real revealed quote of both sealed plans and the typed return. The
 * shared quote helper needs the all-fourteen skills composition. */
export function quoteMoritaniIndependentSkillsBattle(
  fixture: MoritaniIndependentSkillsFixture, state = fixture.revealed,
) {
  assert.ok(state.leaderSkills,
    'The shared revealed-battle quote needs the all-fourteen Leader Skills composition.');
  return quoteIndependentSkillsBattle(state, fixture.returns ? { returns: fixture.returns } : {});
}
/** Resolve the real aftermath up to the owner's Assassinate choice (Advanced)
 * or the clean post-battle continuation (Basic), never past a human choice. */
export function resolveMoritaniIndependentSkillsBattle(
  fixture: MoritaniIndependentSkillsFixture, state = fixture.pending,
  policy: MoritaniIndependentSkillsPolicy = {},
): Game {
  const context = fixture.returnsContext;
  const chosenReturns = (typeof policy.harassReturns === 'function' && context
    ? policy.harassReturns(context)
    : policy.harassReturns as HarassWithdrawSelection | undefined) ?? fixture.returns;
  let game = structuredClone(state);
  for (let count = 0; count < 500; count++) {
    if (game.decision?.kind === 'moritaniAssassinate' || game.decision?.kind === 'handExchange') return game;
    if ((game.decision?.kind === 'captureOffer' || game.decision?.kind === 'capturedLeader') && !policy.capture)
      return game;
    if (!game.battle && moritaniIndependentSkillsClean(game) &&
      (game.phase === 7 || game.phase === 8)) return game;
    assert.notEqual(game.status, 'finished');
    let step: MoritaniIndependentSkillsStep | null;
    if (game.decision?.kind === 'harassWithdraw') {
      assert.ok(chosenReturns, 'Supply the loser’s real typed undialed return');
      step = { actor: game.decision.player,
        action: { type: 'decision', event: game.decision.event, returns: chosenReturns } };
    } else if (game.battle?.revealed && (viewGame(game, game.host).battle?.traitorVoters ?? [])
      .some((voter) => game.battle!.traitorCalls[voter] === undefined)) {
      const voter = viewGame(game, game.host).battle!.traitorVoters
        .find((id) => game.battle!.traitorCalls[id] === undefined)!;
      step = { actor: voter,
        action: { type: 'traitorCall', call: policy.traitorCalls?.includes(voter) ?? false } };
    } else step = nextMoritaniIndependentSkillsStep(game, policy);
    assert.ok(step, 'Resolve the real inherited decisions before the owner’s choice');
    game = stepMoritaniIndependentSkills(game, step);
  }
  throw Error('The original standalone battle aftermath did not settle');
}
/** Apply the real owner choice: one held eligible Traitor Card, or null. */
export function chooseMoritaniIndependentSkillsAssassination(state: Game, card: string | null): Game {
  const decision = state.decision;
  assert.equal(decision?.kind, 'moritaniAssassinate');
  if (decision?.kind !== 'moritaniAssassinate') throw new Error('Expected the original Assassinate choice.');
  return stepMoritaniIndependentSkills(state, { actor: decision.player, action: {
    type: 'decision', event: decision.event,
    ...(card === null ? { decline: true } : { card }),
  } });
}
/** Continue the settled fight through the real Mentat replacement window. */
export function finishMoritaniIndependentSkillsBattle(
  state: Game, policy: MoritaniIndependentSkillsPolicy = {},
  until: (game: Game) => boolean = (game) => game.phase === 8 && moritaniIndependentSkillsClean(game),
): Game {
  return advanceMoritaniIndependentSkills(state, until, [], policy);
}
