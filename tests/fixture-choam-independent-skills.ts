import assert from 'node:assert/strict';
import {
  applyAction, createGame, joinGame, nativeHandLimit, newPlayer, viewGame,
  type Action, type Game, type Player,
} from '../game/engine';
import { botActions } from '../game/bots';
import { MOBILE_STRONGHOLD, territory } from '../game/board';
import type { Card } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { HARASS_WITHDRAW_CARD, type HarassWithdrawSelection } from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import type { NoFieldValue } from '../game/richese-no-field';
import { nextRicheseReinforcementsStep } from './fixture-richese-reinforcements';

export type ChoamIndependentSkillsStep = { actor: string; action: Action };
/**
 * 'immediate' ships the final concealed marker straight from twenty reserves on
 * turn one (the only deterministic Advanced timeline: later turns depend on the
 * original storm card). 'tuning' is the Basic route whose two real reveals plus
 * one real paid tuning shipment leave an exact reserve budget off the one
 * deterministic opening Spice Blow.
 */
export type ChoamIndependentSkillsRoute = 'tuning' | 'immediate';
export type ChoamIndependentSkillsPolicy = {
  /** Real posture decision per seat: hide the trained leader behind the shield. */
  hide?: Record<string, boolean>;
  stone?: 'kill' | 'ignore';
  guildTiming?: 'first' | 'last';
};
export type ChoamIndependentSkillsOptions = {
  /** Continue only the original fresh undealt lobby or its own post-start setup. */
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  route?: ChoamIndependentSkillsRoute;
  marker?: NoFieldValue;
  /** Own physical reserves the Basic 'tuning' route must leave before shipping. */
  reserves?: number;
  /** Stop at the live pre-plan battle window so the caller seals the plans. */
  stopBeforePlans?: boolean;
  seatIds?: [string, string, string];
};
export type ChoamIndependentSkillsSetup = {
  /** The original fresh undealt lobby before any staged module selection. */
  initial: Game;
  /** Immediately after the host's real module-selected start: skill offers dealt. */
  offered: Game;
  afterSetup: Game;
  richese: string;
  choam: string;
  classic: string;
  /** Requested and actually assigned skill per seat id. */
  skills: Record<string, LeaderSkillId>;
  /** The leader disc each seat attached its skill to. */
  trainers: Record<string, string>;
  actions: ChoamIndependentSkillsStep[];
  staging: string[];
};
export type ChoamIndependentSkillsFixture = ChoamIndependentSkillsSetup & {
  advanced: boolean;
  route: ChoamIndependentSkillsRoute;
  /** Real battle stronghold the concealed marker was shipped into. */
  location: string;
  opponent: string;
  beforeShipment: Game;
  shipmentStep: ChoamIndependentSkillsStep;
  afterShipment: Game;
  beforeBattle: Game;
  battleStep: ChoamIndependentSkillsStep;
  /** Live plan window: battle chosen, Mentat question and postures resolved. */
  beforePlans: Game;
  /** Revealed battle: both original plans sealed, postures committed. With
   * stopBeforePlans this is instead the live pre-plan window awaiting a seal. */
  game: Game;
  /** Exact undialed complement of the commitment, for the caller's preview quote. */
  returns: HarassWithdrawSelection;
  token: { id: string; value: NoFieldValue };
  /** Capped physical counters the concealed marker materializes on reveal. */
  materializes: number;
  tuning: number;
  reservesBefore: Record<string, number>;
  plans: {
    both: ChoamIndependentSkillsStep;
    reinforcements: ChoamIndependentSkillsStep;
    harass: ChoamIndependentSkillsStep;
    plain: ChoamIndependentSkillsStep;
    opponent: ChoamIndependentSkillsStep;
  };
  hide: Record<string, boolean>;
  /** Every real native action the programme took, in order. */
  nativeSteps: ChoamIndependentSkillsStep[];
};

/** The one deterministic opening Spice Blow of the original initializer. */
export const CHOAM_INDEPENDENT_SKILLS_BLOW = { territory: 'broken_land', sector: 12 } as const;
/** Empty strongholds: cheapest to ship into and free of any starting army. */
export const CHOAM_INDEPENDENT_SKILLS_CITIES = [
  { territory: 'carthag', sector: 11 },
  { territory: 'sietch_tabr', sector: 14 },
  { territory: 'habbanya_ridge_sietch', sector: 17 },
] as const;
/** The ordinary deck of the selected E2 expansion plus the independent three. */
export const CHOAM_INDEPENDENT_SKILLS_EXPANSIONS = ['choam'] as const;

export function choamIndependentSkillsPlayer(game: Game, actor: string): Player {
  const player = game.players.find((seat) => seat.id === actor);
  assert.ok(player, `Missing original seat ${actor}`);
  return player;
}
export function choamIndependentSkillsSeat(game: Game, faction: string): Player {
  const player = game.players.find((seat) => seat.faction === faction);
  assert.ok(player, `Missing native ${faction} seat`);
  return player;
}
export const choamIndependentSkillsClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

/** Conserved original cards, pools and the printed hand limit for every seat.
 * The dealt card multiset is fixed from the original start onward; each seat's
 * counter total is fixed from the completed setup onward. */
export function assertChoamIndependentSkillsCustody(
  fixture: { offered: Game; afterSetup: Game },
  game: Game,
): void {
  assert.ok(game.leaderSkills);
  validateLeaderSkills(game.leaderSkills, game.players);
  const cards = (state: Game) => [...state.deck, ...state.discard, ...(state.richeseCache ?? []),
    ...(state.richeseRemoved ?? []), ...state.players.flatMap((player) => player.hand)]
    .map((card) => card.id).sort();
  assert.deepEqual(cards(game), cards(fixture.offered),
    'Every original deck, cache, discard and hand face keeps physical custody.');
  const pools = (state: Game) => state.players.map((player) => [player.id,
    player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0),
    player.elites
      ? player.elites.reserves + player.elites.tanks +
        Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0)
      : 0]);
  assert.deepEqual(pools(game), pools(fixture.afterSetup),
    'Every physical counter stays inside its own native pool.');
  for (const player of game.players)
    assert.ok(player.hand.length <= nativeHandLimit(player),
      `${player.faction} stays inside its printed hand limit.`);
}
/** Private two-card offers are dealt in seat order, so the first positions of
 * the solved all-fourteen deck decide the requesting seat's real choice. */
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
/** Solve only the original fourteen-card skill lottery. Every later native
 * shuffle keeps the same fixed maximum fill the tuned opening timeline uses. */
function skillDraws<T>(draws: readonly number[], run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < draws.length ? draws[cursor++] : 0xffffffff;
    else if (array) new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Move one conserved physical face from wherever it still lives. No face is
 * ever minted, purchased or duplicated. */
function positionCard(game: Game, actor: string, cardId: string, staging: string[]): void {
  const player = choamIndependentSkillsPlayer(game, actor);
  if (player.hand.some((card) => card.id === cardId)) return;
  const zones: { label: string; zone: Card[] }[] = [
    { label: 'remaining deck', zone: game.deck },
    { label: 'Richese cache', zone: game.richeseCache ?? [] },
    { label: 'discard pile', zone: game.discard },
  ];
  for (const { label, zone } of zones) {
    const index = zone.findIndex((card) => card.id === cardId);
    if (index < 0) continue;
    assert.ok(player.hand.length < nativeHandLimit(player),
      `${actor}'s printed hand limit leaves room for ${cardId}`);
    player.hand.push(zone.splice(index, 1)[0]);
    staging.push(`Conserved ${cardId}: ${label} → ${actor}'s hand (no purchase, payment or replacement)`);
    return;
  }
  assert.fail(`Conserved physical ${cardId} is missing for ${actor}`);
}
function availableLeaders(game: Game, actor: string, location: string) {
  return choamIndependentSkillsPlayer(game, actor).leaders
    .filter((leader) => !leader.dead && (!leader.usedAt || leader.usedAt === location))
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
}

/** Requested skill per native seat: only Richese's Mentat changes battle
 * strength. The other two need a projectile weapon or snooper defense that the
 * special slots hold, so they stay inert and need no extra card custody. */
function requestedSkills(richese: string, choam: string, classic: string): Record<string, LeaderSkillId> {
  return {
    [richese]: 'mentat',
    [choam]: 'swordmaster-of-ginaz',
    [classic]: 'killer-medic',
  };
}
function skillDeckOrder(skills: Record<string, LeaderSkillId>, seats: readonly string[]): LeaderSkillId[] {
  const requested = seats.map((seat) => skills[seat]);
  const rest = LEADER_SKILL_CARDS.map((card) => card.id).filter((id) => !requested.includes(id));
  return requested.flatMap((id) => [id, rest.shift()!]).concat(rest);
}

/** Genuine fresh CHOAM/Richese plus one classic seat: the original ordinary E2
 * deck with Richese's separate ten-card cache, all fourteen Leader Skills and
 * the independent three-card Treachery marker. The initial skill lottery and
 * opening native shuffles are controlled; later actions keep real entropy. */
export function createChoamIndependentSkillsSetup(
  options: ChoamIndependentSkillsOptions = {},
): ChoamIndependentSkillsSetup {
  const advanced = options.initial ? options.initial.advanced : options.advanced ?? false;
  const ids = options.seatIds ?? ['richese', 'choam', 'atreides'];
  const factions = ['richese', 'choam', 'atreides'] as const;
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' ||
      (game.status === 'setup' && !!game.leaderSkills && game.turn === 1 && game.phase === 0),
    'Continue only the original fresh undealt independent-card setup.');
    assert.equal(game.advanced, advanced);
    assert.deepEqual([...game.expansions].sort(), [...CHOAM_INDEPENDENT_SKILLS_EXPANSIONS]);
    assert.ok(game.players.some((player) => player.faction === 'richese'));
  } else {
    game = createGame('CHOAMINDEPENDENTSKILLS', newPlayer(ids[0], 'Richese', factions[0]), advanced,
      [...CHOAM_INDEPENDENT_SKILLS_EXPANSIONS]);
    joinGame(game, newPlayer(ids[1], 'CHOAM', factions[1]));
    joinGame(game, newPlayer(ids[2], 'Atreides', factions[2]));
  }
  const richese = choamIndependentSkillsSeat(game, 'richese').id;
  const choam = choamIndependentSkillsSeat(game, 'choam').id;
  const classic = choamIndependentSkillsSeat(game, 'atreides').id;
  const skills = requestedSkills(richese, choam, classic);
  const staging: string[] = [];
  const actions: ChoamIndependentSkillsStep[] = [];
  const initial = structuredClone(game);
  if (game.status === 'lobby') {
    assert.ok(!game.lobbyOptions && !game.deck.length && !game.richeseCache &&
      game.players.every((player) => !player.hand.length),
    'Only the original fresh undealt lobby accepts the two module selections.');
    for (const [type, enabled] of [
      ['techTokens', options.tech ?? false], ['strongholdCards', options.strongholds ?? false],
    ] as const) if (enabled) {
      const action: Action = { type, enabled };
      actions.push({ actor: game.host, action });
      game = applyAction(game, game.host, action);
    }
    for (const option of ['leaderSkills', 'ecazTreachery'] as const) {
      const action: Action = { type: 'moduleOption', module: option, enabled: true };
      actions.push({ actor: game.host, action });
      game = applyAction(game, game.host, action);
    }
    staging.push('The host selected the Leader Skills and independent Ecaz Treachery module options in the original lobby before any seat was ready.');
    for (const player of game.players) if (!player.ready) {
      const action: Action = { type: 'ready' };
      actions.push({ actor: player.id, action });
      game = applyAction(game, player.id, action);
    }
    const order = skillDeckOrder(skills, [richese, choam, classic]);
    assert.equal(order.length, LEADER_SKILL_CARDS.length);
    const action: Action = advanced ? { type: 'start', advancedPreview: true } : { type: 'start' };
    actions.push({ actor: game.host, action });
    game = skillDraws(permutationDraws(LEADER_SKILL_CARDS.map((card) => card.id), order),
      () => applyAction(game, game.host, action));
    staging.push('Solved the original fourteen-card skill lottery with real Fisher-Yates draws so each seat is offered its requested skill; the same start kept the tuned fixed-maximum fill for every later shuffle.');
  }
  assert.equal(game.status, 'setup');
  assert.equal(game.ecazTreachery, true);
  assert.equal(game.turn, 1);
  assert.equal(game.phase, 0);
  assert.ok(game.leaderSkills);
  assert.equal(game.richeseCache?.length, 10, 'The separate ten-card Richese cache is dealt.');
  const offered = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 400; count++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const wanted = skills[actor];
      assert.ok(offer.cards.includes(wanted) && !view.unavailableSkills?.[wanted],
        `The requested original ${wanted} skill must be offered to ${actor}`);
      const leader = choamIndependentSkillsPlayer(game, actor).leaders
        .filter((disc) => view.eligibleLeaders.some((eligible) => eligible.id === disc.id))
        .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
      assert.ok(leader);
      const action: Action = { type: 'leaderSkill', event: offer.event, skill: wanted, leader: leader.id };
      actions.push({ actor, action });
      game = applyAction(game, actor, action);
      continue;
    }
    let next: ChoamIndependentSkillsStep | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find((seat) => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { next = { actor: player.id, action }; break; }
    }
    assert.ok(next, `Original independent-card setup stalled at ${game.setupStage}/${game.decision?.kind}`);
    actions.push(structuredClone(next));
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.status, 'playing');
  // The undealt start is the reference for both the dealt card multiset and the
  // untouched physical counter pools the setup redistributes.
  assertChoamIndependentSkillsCustody({ offered, afterSetup: offered }, game);
  const assigned = (seat: string) => game.leaderSkills!.assignments
    .find((assignment) => assignment.owner === seat)!;
  for (const seat of [richese, choam, classic])
    assert.equal(assigned(seat).skill, skills[seat]);
  return {
    initial, offered, afterSetup: structuredClone(game), richese, choam, classic, skills,
    trainers: { [richese]: assigned(richese).leader, [choam]: assigned(choam).leader,
      [classic]: assigned(classic).leader },
    actions, staging,
  };
}

/** Only genuine native windows; a null result with a live battle means a human
 * must seal a plan, and a typed withdrawal allocation is the caller's choice. */
export function nextChoamIndependentSkillsStep(
  game: Game,
  policy: ChoamIndependentSkillsPolicy = {},
): ChoamIndependentSkillsStep | null {
  if (!game.response && !game.phaseOpening && game.decision) {
    const decision = game.decision;
    if (decision.kind === 'techToken')
      return { actor: decision.player, action: { type: 'decision', token: decision.choices[0] } };
    if (decision.kind === 'leaderSkillVisibility')
      return { actor: decision.player, action: { type: 'leaderSkillVisibility', event: decision.event,
        hide: policy.hide?.[decision.player] ?? false } };
    if (decision.kind === 'mentatQuestion')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision.kind === 'guildTiming')
      return { actor: decision.player, action: { type: 'decision',
        take: (policy.guildTiming ?? 'last') === 'first' } };
    if (decision.kind === 'rihani')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, draw: false } };
    // The typed withdrawal allocation and the Suk rescue choice stay the
    // caller's; a winner's legal casualty pick continues through the shared
    // native continuation policy.
    if (decision.kind === 'harassWithdraw' || decision.kind === 'sukRescue') return null;
  }
  return nextRicheseReinforcementsStep(game, policy.stone ?? 'ignore');
}

/** Real native hidden-marker shipments, real ordinary movement and both
 * original plans. Only conserved card faces are staged, and the trained leader
 * is the physical disc the programme commits so its skill can resolve. */
export function createChoamIndependentSkillsFixture(
  options: ChoamIndependentSkillsOptions = {},
): ChoamIndependentSkillsFixture {
  const setup = createChoamIndependentSkillsSetup(options);
  const advanced = setup.afterSetup.advanced;
  const route: ChoamIndependentSkillsRoute = options.route ?? (advanced ? 'immediate' : 'tuning');
  if (route === 'tuning')
    assert.equal(advanced, false,
      'The Advanced storm card makes every turn after the first nondeterministic; use the immediate route');
  assert.ok(route !== 'immediate' || options.reserves === undefined || options.reserves === 20,
    'The immediate native route starts with twenty real reserves; tuning is a separate timeline');
  const staging = [...setup.staging];
  let game = setup.afterSetup;
  const { richese } = setup;
  const marker: NoFieldValue = options.marker ?? 3;
  const reuseValue: NoFieldValue = marker === 3 ? 0 : 3;
  const baseline = marker === 3 ? 15 : 12;
  const target = options.reserves ?? (marker === 3 ? 6 : 8);
  const tuning = route === 'tuning' ? baseline - target : 0;
  assert.ok(route === 'immediate' || (target >= 0 && target <= baseline),
    'The tuning route can only leave these reserve budgets');
  assert.ok(tuning <= 10, 'The tuning shipment must stay inside the spice the real route collected');
  const nativeSteps: ChoamIndependentSkillsStep[] = [];
  const act = (step: ChoamIndependentSkillsStep) => {
    nativeSteps.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  };
  const rich = () => choamIndependentSkillsPlayer(game, richese);
  const tokenOf = (value: NoFieldValue) => rich().noField!.tokens.find((token) => token.value === value)!;
  const stormFreeCity = () => {
    const city = CHOAM_INDEPENDENT_SKILLS_CITIES.find((candidate) => candidate.sector !== game.storm);
    assert.ok(city, 'The natural route keeps one empty stronghold outside the storm');
    return city;
  };
  /** One untouched ordinary army holding a real stronghold outside the storm. */
  const battleTarget = () => {
    for (const player of game.players) {
      if (player.id === richese) continue;
      for (const [key, count] of Object.entries(player.forces)) {
        if (count <= 0) continue;
        const [stronghold, sector] = key.split(':');
        if (!territory(stronghold) || territory(stronghold).type !== 'stronghold') continue;
        if (stronghold === MOBILE_STRONGHOLD || Number(sector) === game.storm) continue;
        return { seat: player.id, faction: player.faction, territory: stronghold, sector: Number(sector) };
      }
    }
    assert.fail('The timeline needs one untouched starting army outside the storm');
  };
  const done = { shipment: {} as Record<number, boolean>, reveal: {} as Record<number, boolean> };
  let open = false;
  let beforeShipment: Game | undefined;
  let afterShipment: Game | undefined;
  let shipmentStep: ChoamIndependentSkillsStep | undefined;
  let beforeBattle: Game | undefined;
  let battleStep: ChoamIndependentSkillsStep | undefined;
  let reservesBefore: Record<string, number> | undefined;
  let army: { seat: string; faction: string; territory: string; sector: number } | undefined;
  /** Both combatants hide their trained leader behind the shield. */
  const hide: Record<string, boolean> = { [richese]: true };
  const clear = () => choamIndependentSkillsClean(game);
  // Native actions only: no counter is placed by hand and no wallet is set.
  for (let count = 0; count < 2400 && !open; count++) {
    assert.equal(game.status, 'playing');
    if (done.shipment[4] && !afterShipment && clear()) afterShipment = structuredClone(game);
    const choices = game.phase === 6 && clear()
      ? viewGame(game, richese).battleChoices ?? [] : [];
    if (!open && choices.some((choice) => choice.territory === army?.territory)) {
      const choice = choices.find((candidate) => candidate.territory === army!.territory)!;
      positionCard(game, richese, REINFORCEMENTS_CARD, staging);
      positionCard(game, richese, HARASS_WITHDRAW_CARD, staging);
      beforeBattle = structuredClone(game);
      battleStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory: army!.territory,
        target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
      act(battleStep);
      open = true;
      break;
    }
    if (game.phase === 2 && game.turn === 4 && clear() &&
      rich().charityTurn !== game.turn && rich().spice < 2) {
      act({ actor: richese, action: { type: 'charity' } });
      continue;
    }
    if (game.phase === 5 && game.active === richese && clear()) {
      const turn = game.turn;
      if (route === 'tuning' && turn === 1 && !done.shipment[1]) {
        act({ actor: richese, action: { type: 'ship', noField: tokenOf(5).id,
          event: rich().noFieldEvent, territory: CHOAM_INDEPENDENT_SKILLS_BLOW.territory,
          sector: CHOAM_INDEPENDENT_SKILLS_BLOW.sector } });
        done.shipment[1] = true;
        continue;
      }
      if (route === 'tuning' && turn === 2 && rich().noField!.deployed && !done.reveal[2]) {
        act({ actor: richese, action: { type: 'revealNoField', event: rich().noFieldEvent,
          token: rich().noField!.deployed!.tokenId } });
        done.reveal[2] = true;
        continue;
      }
      if (route === 'tuning' && turn === 2 && !done.shipment[2] && !rich().shipped) {
        const city = stormFreeCity();
        act({ actor: richese, action: { type: 'ship', noField: tokenOf(reuseValue).id,
          event: rich().noFieldEvent, territory: city.territory, sector: city.sector } });
        done.shipment[2] = true;
        continue;
      }
      if (route === 'tuning' && turn === 3 && rich().noField!.deployed && !done.reveal[3]) {
        assert.equal(rich().noField!.deployed!.tokenId, tokenOf(reuseValue).id,
          'The reuse token must still be the concealed one this timeline reveals');
        act({ actor: richese, action: { type: 'revealNoField', event: rich().noFieldEvent,
          token: rich().noField!.deployed!.tokenId } });
        done.reveal[3] = true;
        continue;
      }
      if (route === 'tuning' && turn === 3 && !done.shipment[3] && !rich().shipped) {
        const city = stormFreeCity();
        act({ actor: richese, action: { type: 'ship', territory: city.territory,
          sector: city.sector, amount: tuning } });
        done.shipment[3] = true;
        continue;
      }
      const finalTurn = route === 'tuning' ? 4 : 1;
      if (turn === finalTurn && !done.shipment[4] && !rich().shipped) {
        army = battleTarget();
        hide[army.seat] = true;
        beforeShipment = structuredClone(game);
        reservesBefore = Object.fromEntries(game.players.map((player) => [player.id, player.reserves]));
        shipmentStep = { actor: richese, action: { type: 'ship', noField: tokenOf(marker).id,
          event: rich().noFieldEvent, territory: army.territory, sector: army.sector } };
        act(shipmentStep);
        done.shipment[4] = true;
        continue;
      }
      assert.ok(turn <= (route === 'tuning' ? 4 : 1),
        'The natural timeline must reach its battle by the scheduled turn');
    }
    const step = nextChoamIndependentSkillsStep(game, { hide, stone: 'ignore' });
    assert.ok(step, `Native Richese continuation stalled at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    if (game.turn === 1 && step.action.type === 'stormDial') step.action.amount = 0;
    act(step);
  }
  assert.ok(open, 'The final concealed shipment must reach a real ordinary battle');
  assert.ok(beforeShipment && afterShipment && shipmentStep && beforeBattle && battleStep && army && reservesBefore,
    'The timeline must record its final shipment, army and battle admission');
  for (let count = 0; count < 120; count++) {
    const step = nextChoamIndependentSkillsStep(game, { hide, stone: 'ignore' });
    if (!step) break;
    act(step);
  }
  assert.ok(game.battle && !game.battle.revealed && clear());
  assert.deepEqual(game.battle.plans, {});
  const opponent = army.seat;
  const location = `${army.territory}:${army.sector}`;
  const enemyForces = choamIndependentSkillsPlayer(game, opponent).forces[location] ?? 0;
  assert.ok(enemyForces > 0, 'The battle army must still hold the stronghold');
  const reserves = reservesBefore[richese];
  if (route === 'tuning')
    assert.equal(reserves, target, 'The tuning route must leave the requested reserve budget');
  const materializes = Math.min(tokenOf(marker).value, reserves);
  const ownLeader = setup.trainers[richese];
  assert.ok(availableLeaders(game, richese, army.territory).some((disc) => disc.id === ownLeader),
    'The trained Mentat disc must still be an available battle leader');
  const ownDial = advanced ? Math.min(1, Math.floor(materializes / 2)) : 2;
  assert.ok(ownDial <= materializes, 'The plan may not dial counters the marker cannot materialize');
  const undialed = materializes - ownDial;
  assert.ok(undialed >= 1, 'Harass & Withdraw needs a real undialed counter to return');
  // The announced dial is the battle number in both rules sets; the opposing
  // army is tuned so the trained Mentat bonus is exactly decisive: the same
  // physical plan loses by one without those two strength.
  const defenderLeaders = availableLeaders(game, opponent, army.territory);
  const ownStrength = choamIndependentSkillsPlayer(game, richese)
    .leaders.find((disc) => disc.id === ownLeader)!.strength;
  const attackerWith = ownDial + 2 + ownStrength + 2;
  const boundary = defenderLeaders.flatMap((leader) => {
    const dial = attackerWith - 1 - leader.strength;
    return dial >= 0 && dial <= enemyForces ? [{ dial, leader: leader.id }] : [];
  })[0];
  assert.ok(boundary, 'The real opposing roster must hold the decisive skill boundary dial');
  const otherLeader = boundary.leader;
  const enemyDial = boundary.dial;
  const plan = (weapon: string | null, defense: string | null): ChoamIndependentSkillsStep => ({
    actor: richese,
    action: { type: 'battlePlan', dial: ownDial, support: advanced ? ownDial : 0,
      leader: ownLeader, weapon, defense },
  });
  const plans = {
    both: plan(REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD),
    reinforcements: plan(REINFORCEMENTS_CARD, null),
    harass: plan(null, HARASS_WITHDRAW_CARD),
    plain: plan(null, null),
    opponent: { actor: opponent, action: { type: 'battlePlan', dial: enemyDial,
      support: advanced ? enemyDial : 0, leader: otherLeader } },
  } satisfies ChoamIndependentSkillsFixture['plans'];
  const returns: HarassWithdrawSelection = { [location]: { normal: undialed, elite: 0 } };
  const beforePlans = game;
  if (options.stopBeforePlans)
    return {
      ...setup, advanced, route, location, opponent, beforeShipment, shipmentStep, afterShipment,
      beforeBattle, battleStep, beforePlans, game: beforePlans, returns,
      token: structuredClone(tokenOf(marker)), materializes, tuning, reservesBefore, plans, hide, nativeSteps,
    };
  const before = applyAction(applyAction(game, richese, plans.both.action), opponent, plans.opponent.action);
  assert.ok(before.battle?.revealed, 'Both original plans must reveal the marker and the machine');
  assert.ok(!before.decision && !before.response && !before.phaseOpening,
    `The whole undialed army is in one sector, so the native return needs no typed allocation (saw ${before.decision?.kind}).`);
  return {
    ...setup, advanced, route, location, opponent, beforeShipment, shipmentStep, afterShipment,
    beforeBattle, battleStep, beforePlans, game: before, returns, token: structuredClone(tokenOf(marker)),
    materializes, tuning, reservesBefore, plans, hide, nativeSteps,
  };
}

/** From the recorded pre-battle snapshot, choose the battle and consume only its
 * native windows, stopping at the live window where a human seals a plan. */
export function openChoamIndependentSkillsBattle(
  fixture: ChoamIndependentSkillsFixture, policy: ChoamIndependentSkillsPolicy = {},
): Game {
  let state = applyAction(fixture.beforeBattle, fixture.battleStep.actor, fixture.battleStep.action);
  for (let count = 0; count < 120; count++) {
    const step = nextChoamIndependentSkillsStep(state, { ...policy, hide: policy.hide ?? fixture.hide });
    if (!step) break;
    state = applyAction(state, step.actor, step.action);
  }
  assert.ok(state.battle && !state.battle.revealed, 'The battle must open at its live plan window');
  return state;
}

/** Seal the machine plan and the opposing plan from one real pre-plan window. */
export function sealChoamIndependentSkillsBoth(
  fixture: ChoamIndependentSkillsFixture,
  plan: 'both' | 'reinforcements' | 'harass' | 'plain' = 'both',
  state: Game = fixture.beforePlans,
  policy: ChoamIndependentSkillsPolicy = { hide: fixture.hide },
): Game {
  const first = sealChoamIndependentSkillsPlan(state, fixture.plans[plan], policy);
  return sealChoamIndependentSkillsPlan(first, fixture.plans.opponent, policy);
}

/** Seal one real plan and consume only the native windows it opens. */
export function sealChoamIndependentSkillsPlan(
  game: Game, step: ChoamIndependentSkillsStep, policy: ChoamIndependentSkillsPolicy = {},
): Game {
  let state = applyAction(game, step.actor, step.action);
  for (let count = 0; count < 200; count++) {
    if (!state.response && !state.phaseOpening && !state.decision) return state;
    const next = nextChoamIndependentSkillsStep(state, policy);
    assert.ok(next, `Sealed plan left an unconsumed native window at ${state.decision?.kind}`);
    state = applyAction(state, next.actor, next.action);
  }
  throw Error('Sealed plan did not finish its native preparation');
}

/** Resolve the real aftermath: Traitor calls, an optional typed withdrawal
 * allocation, the winner's legal casualty pick and mandatory disposal, stopping
 * at the original clean Collection boundary. */
export function finishChoamIndependentSkillsBattle(
  game: Game,
  options: { callers?: readonly string[]; return?: HarassWithdrawSelection;
    actions?: ChoamIndependentSkillsStep[]; until?: (state: Game) => boolean } = {},
): Game {
  const until = options.until ?? ((state: Game) => state.phase === 7 && choamIndependentSkillsClean(state));
  for (let count = 0; count < 400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    let step: ChoamIndependentSkillsStep | null;
    if (game.decision?.kind === 'harassWithdraw') {
      assert.ok(options.return, 'Supply the genuine typed undialed return allocation');
      step = { actor: game.decision.player, action: { type: 'decision', event: game.decision.event,
        returns: options.return } };
    } else {
      const next = nextChoamIndependentSkillsStep(game);
      step = next && next.action.type === 'traitorCall'
        ? { ...next, action: { type: 'traitorCall', call: options.callers?.includes(next.actor) ?? false } }
        : next;
    }
    assert.ok(step, 'Resolve both original plans before their physical aftermath');
    options.actions?.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  }
  throw Error('The original independent-card battle aftermath did not reach Collection');
}

/**
 * Keep the original turn-one machine winner's two undialed forces in Arrakeen,
 * earn its card at the first real Mentat, then ship a different native marker
 * into that held city before the original Atreides seat pays to return there.
 * No owner, army, wallet, marker or phase receipt is assigned.
 */
export function createChoamIndependentSkillsHeldSupportFixture(
  options: Pick<ChoamIndependentSkillsOptions, 'tech' | 'strongholds'> = {},
) {
  assert.equal(options.strongholds, true, 'The held-support programme needs original Stronghold Cards');
  const first = createChoamIndependentSkillsFixture({
    ...options, advanced: true, route: 'immediate', stopBeforePlans: true,
  });
  assert.equal(first.location, 'arrakeen:10');
  const actions: ChoamIndependentSkillsStep[] = [];
  const firstAfterBattle = finishChoamIndependentSkillsBattle(
    sealChoamIndependentSkillsBoth(first, 'reinforcements'), { actions });
  let game = firstAfterBattle;
  const act = (step: ChoamIndependentSkillsStep) => {
    actions.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  };
  const advance = (until: (state: Game) => boolean) => {
    for (let count = 0; count < 1600; count++) {
      if (until(game)) return;
      const step = nextChoamIndependentSkillsStep(game, { hide: first.hide });
      assert.ok(step, 'A real native continuation must reach the next held-city action');
      act(step);
    }
    throw Error('Held Arrakeen programme did not reach its next native action');
  };
  advance(state => state.turn === 2 && state.phase === 0 && choamIndependentSkillsClean(state));
  const afterFirstMentat = structuredClone(game);
  let beforeMarkerShipment: Game | undefined, afterMarkerShipment: Game | undefined;
  let beforeEnemyShipment: Game | undefined, markerShipment: ChoamIndependentSkillsStep | undefined;
  const enemyShipment: ChoamIndependentSkillsStep = { actor: first.opponent, action: {
    type: 'ship', territory: 'arrakeen', sector: 10, amount: 4,
  } };
  const waiting = new Set([first.richese, first.opponent]);
  while (waiting.size) {
    advance(state => state.turn === 2 && state.phase === 5 && !!state.active &&
      waiting.has(state.active) && choamIndependentSkillsClean(state));
    const actor = game.active!;
    if (actor === first.richese) {
      beforeMarkerShipment = structuredClone(game);
      const richese = choamIndependentSkillsPlayer(game, actor);
      const marker = richese.noField!.tokens.find(token => token.value === 5)!;
      markerShipment = { actor, action: { type: 'ship', noField: marker.id,
        event: richese.noFieldEvent, territory: 'arrakeen', sector: 10 } };
      act(markerShipment);
    } else {
      beforeEnemyShipment = structuredClone(game);
      act(enemyShipment);
    }
    advance(state => state.active === actor && choamIndependentSkillsClean(state) && !state.pendingShipment);
    if (actor === first.richese) afterMarkerShipment = structuredClone(game);
    act({ actor, action: { type: 'endMovement' } });
    waiting.delete(actor);
  }
  assert.ok(beforeMarkerShipment && afterMarkerShipment && beforeEnemyShipment && markerShipment);
  advance(state => state.turn === 2 && state.phase === 6 && choamIndependentSkillsClean(state));
  const staging = [...first.staging];
  positionCard(game, first.richese, REINFORCEMENTS_CARD, staging);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, first.richese).battleChoices.find(candidate => candidate.territory === 'arrakeen');
  assert.ok(choice);
  const battleStep: ChoamIndependentSkillsStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: 'arrakeen',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker,
  } };
  act(battleStep);
  advance(state => !!state.battle && !state.battle.revealed && choamIndependentSkillsClean(state) &&
    !!state.battle.preLeader?.closed && !state.battle.preparation);
  const beforePlans = structuredClone(game);
  const plans: ChoamIndependentSkillsStep[] = [
    { actor: first.richese, action: { type: 'battlePlan', dial: 2, support: 2,
      leader: first.trainers[first.richese], weapon: REINFORCEMENTS_CARD, defense: HARASS_WITHDRAW_CARD } },
    { actor: first.opponent, action: { type: 'battlePlan', dial: 0, support: 0,
      leader: availableLeaders(game, first.opponent, 'arrakeen')[0].id } },
  ];
  for (const plan of plans) {
    actions.push(structuredClone(plan));
    game = sealChoamIndependentSkillsPlan(game, plan, { hide: first.hide });
  }
  const revealed = structuredClone(game);
  const returns: HarassWithdrawSelection = { [first.location]: { normal: 5, elite: 0 } };
  const afterBattle = finishChoamIndependentSkillsBattle(game, { return: returns, actions });
  return { first, firstAfterBattle, afterFirstMentat, beforeMarkerShipment, markerShipment,
    afterMarkerShipment, beforeEnemyShipment, enemyShipment, beforeBattle, battleStep, beforePlans,
    plans, revealed, returns, afterBattle, actions, staging };
}
