import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazTreacheryGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import type { Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import type { NoFieldValue } from '../game/richese-no-field';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export const RICHESE_REINFORCEMENTS = 'ecaz-reinforcements';
export const RICHESE_HARASS = 'ecaz-harass-withdraw';
export const RICHESE_STONE_BURNER = 'richese-stone-burner';
export const RICHESE_MIRROR_WEAPON = 'richese-mirror-weapon';

/** Independent battle machines a caller may prepare in the machine user's hand. */
export type RicheseMachine = 'reinforcements' | 'harass' | 'stone' | 'mirror';
/** Clean selected native families; classic opponents come from the base set. */
export type RicheseFamily = 'choam' | 'ix+choam';
export type RicheseReinforcementsStep = { actor: string; action: Action };

/**
 * This programme parks its first token on the initializer's opening Spice Blow.
 * Actual collection funds its later tuning shipment without granting bank spice.
 */
export const RICHESE_BLOW = { territory: 'broken_land', sector: 12 } as const;
/** Empty strongholds: cheapest to ship into and free of any starting army. */
export const RICHESE_CITIES = [
  { territory: 'carthag', sector: 11 },
  { territory: 'sietch_tabr', sector: 14 },
  { territory: 'habbanya_ridge_sietch', sector: 17 },
] as const;
/** The untouched starting armies a real attack can meet. */
export const RICHESE_ARMIES = [
  { faction: 'atreides', territory: 'arrakeen', sector: 10 },
  { faction: 'guild', territory: 'tueks_sietch', sector: 5 },
] as const;

export type RicheseReinforcementsOptions = {
  advanced?: boolean;
  family?: RicheseFamily;
  /**
   * Natural multi-turn route. 'tuning' is the deterministic Basic route: two
   * real No-Field reveals plus one real tuning shipment reach a low reserve
   * budget off the first Spice Blow's collection. 'immediate' is the turn-one
   * route used for Advanced, where the original storm card makes later turns
   * nondeterministic: it ships the final token straight from twenty reserves.
   */
  route?: 'tuning' | 'immediate';
  /** The final concealed token shipped into the actual battle. */
  marker?: NoFieldValue;
  /** Own physical reserves the 'tuning' route must leave before that shipment. */
  reserves?: number;
  /** Own counters dialed at the final battle; derived from the physical army. */
  dial?: number;
  opponentDial?: number;
  /** Independent machines positioned in the machine user's hand after shipment. */
  machines?: readonly RicheseMachine[];
  /** Conserve the real Richese Stone Burner into the opponent's hand for Mirror Weapon. */
  opponentStone?: boolean;
  seatIds?: [string, string, string];
  /** Continue one fresh original initializer snapshot; never a redeal. */
  initial?: Game;
};

export type RicheseReinforcementsFixture = {
  initial: Game;
  afterSetup: Game;
  /** Immediately before Richese declares the final concealed No-Field shipment. */
  beforeShipment: Game;
  shipmentStep: RicheseReinforcementsStep;
  afterShipment: Game;
  /** Immediately before the actual ordinary battle admission. */
  beforeBattle: Game;
  battleStep: RicheseReinforcementsStep;
  /** Open original battle: native preparation complete, neither plan sealed. */
  game: Game;
  richese: string;
  opponent: string;
  observer: string;
  family: RicheseFamily;
  advanced: boolean;
  route: 'tuning' | 'immediate';
  /** Stronghold the final concealed token was shipped into. */
  location: string;
  /** Empty stronghold the interleaved reveal/tuning shipments used, if any. */
  city: string | null;
  token: { id: string; value: NoFieldValue };
  /** Capped physical counters the concealed marker materializes on reveal. */
  materializes: number;
  /** Own counters shipped into the empty stronghold on the tuning turn. */
  tuning: number;
  /** Each seat's own physical reserves immediately before the final shipment. */
  reservesBefore: Record<string, number>;
  machines: RicheseMachine[];
  /** Physical machine faces positioned into the machine user's hand. */
  hand: Partial<Record<RicheseMachine, string>>;
  plans: {
    both: RicheseReinforcementsStep;
    reinforcements: RicheseReinforcementsStep;
    harass: RicheseReinforcementsStep;
    plain: RicheseReinforcementsStep;
    opponent: RicheseReinforcementsStep;
  };
  /** Every real native action the programme took, in order. */
  nativeSteps: RicheseReinforcementsStep[];
  /** Every conserved card exchange the programme staged, in order. */
  staging: string[];
};

export function richeseReinforcementsPlayer(game: Game, actor: string) {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing original seat ${actor}`);
  return player;
}

export function richeseReinforcementsSeat(game: Game, faction: FactionId) {
  const player = game.players.find(p => p.faction === faction);
  assert.ok(player, `Missing native ${faction} seat`);
  return player;
}

export const richeseReinforcementsClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision;

/** Only consumes live native windows; a null result with a live battle means a
 * human must seal a plan. The optional Stone mode never invents a decision. */
export function nextRicheseReinforcementsStep(
  game: Game,
  stoneMode: 'kill' | 'ignore' = 'ignore',
): RicheseReinforcementsStep | null {
  const step = nextRicheseStrongholdsNativeStep(game);
  if (step && game.decision?.kind === 'stoneBurner' &&
    step.action.type === 'decision' && step.action.mode !== undefined)
    return { actor: step.actor, action: { ...step.action, mode: stoneMode } };
  return step;
}

/** Determinism is scoped to the original native initializer only. */
function initialize(game: Game): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return initializeEcazTreacheryGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Richese cache faces must never enter the general deck; every other original
 * face may wait there. Keeps a real hand inside its printed limit. */
function makeRoom(game: Game, actor: string, staging: string[],
  protect: readonly string[] = []): void {
  const player = richeseReinforcementsPlayer(game, actor);
  const limit = player.faction === 'harkonnen' ? 8 : 4;
  while (player.hand.length >= limit) {
    const index = player.hand.findIndex(card =>
      !card.id.startsWith('richese-') && !protect.includes(card.id));
    assert.ok(index >= 0, `${actor}'s conserved cache faces leave no deckable hand room`);
    const [card] = player.hand.splice(index, 1);
    game.deck.push(card);
    staging.push(`Conserved ${card.id}: ${actor}'s hand → remaining deck to keep the printed hand limit`);
  }
}

/** Move one conserved physical face from wherever it still lives. No face is
 * ever minted, purchased or duplicated. */
function positionCard(game: Game, actor: string, cardId: string, staging: string[],
  protect: readonly string[] = []): void {
  const player = richeseReinforcementsPlayer(game, actor);
  if (player.hand.some(card => card.id === cardId)) return;
  const zones: { label: string; zone: Card[] }[] = [
    { label: 'remaining deck', zone: game.deck },
    { label: 'Richese cache', zone: game.richeseCache ?? [] },
    { label: 'discard pile', zone: game.discard },
  ];
  for (const { label, zone } of zones) {
    const index = zone.findIndex(card => card.id === cardId);
    if (index < 0) continue;
    makeRoom(game, actor, staging, protect);
    player.hand.push(zone.splice(index, 1)[0]);
    staging.push(`Conserved ${cardId}: ${label} → ${actor}'s hand (no purchase, payment or replacement)`);
    return;
  }
  assert.fail(`Conserved physical ${cardId} is missing for ${actor}`);
}

/** The conserved Stone Burner may be held by the real cache acquisition first. */
function transferCard(game: Game, actor: string, cardId: string, staging: string[],
  protect: readonly string[] = []): void {
  const holder = game.players.find(player => player.hand.some(card => card.id === cardId));
  if (!holder) { positionCard(game, actor, cardId, staging, protect); return; }
  if (holder.id === actor) return;
  const index = holder.hand.findIndex(card => card.id === cardId);
  const [card] = holder.hand.splice(index, 1);
  makeRoom(game, actor, staging, protect);
  richeseReinforcementsPlayer(game, actor).hand.push(card);
  staging.push(`Conserved ${cardId}: ${holder.id}'s hand → ${actor}'s hand (no purchase, payment or replacement)`);
}

function availableLeaders(game: Game, actor: string, battleTerritory: string) {
  return richeseReinforcementsPlayer(game, actor).leaders
    .filter(leader => !leader.dead && (!leader.usedAt || leader.usedAt === battleTerritory))
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
}

export function createRicheseReinforcementsFixture(
  options: RicheseReinforcementsOptions = {},
): RicheseReinforcementsFixture {
  const family = options.family ?? 'choam';
  const advanced = options.advanced ?? false;
  const route = options.route ?? (advanced ? 'immediate' : 'tuning');
  if (route === 'tuning')
    assert.equal(advanced, false,
      'The Advanced storm card makes every turn after the first nondeterministic; use the immediate route');
  assert.ok(route !== 'immediate' || options.reserves === undefined || options.reserves === 20,
    'The immediate native route starts with twenty real reserves; tuning is a separate timeline');
  const staging: string[] = [];
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' ||
      (game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
        game.players.every(player => player.hand.length === 0)),
      'Continue only the original fresh undealt independent-card setup');
    assert.equal(game.advanced, advanced);
    assert.deepEqual([...game.expansions].sort(), family === 'choam' ? ['choam'] : ['choam', 'ix']);
    assert.ok(game.players.some(player => player.faction === 'richese'));
    if (game.status === 'setup') assert.equal(game.ecazTreachery, true);
  } else {
    const roster: FactionId[] = family === 'choam'
      ? ['richese', 'guild', 'atreides'] : ['richese', 'ixians', 'atreides'];
    const ids = options.seatIds ?? roster;
    game = createGame('RICHESEREINFORCEMENTS', newPlayer(ids[0], 'Richese', roster[0]),
      advanced, family === 'choam' ? ['choam'] : ['ix', 'choam']);
    joinGame(game, newPlayer(ids[1], roster[1], roster[1]));
    joinGame(game, newPlayer(ids[2], roster[2], roster[2]));
  }
  if (game.status === 'lobby') {
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
    game = initialize(game);
  }
  const initial = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 300; count++) {
    let next: RicheseReinforcementsStep | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(p => p.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { next = { actor: player.id, action }; break; }
    }
    assert.ok(next, `Original independent-card setup stalled at ${game.setupStage}/${game.decision?.kind}`);
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const richese = richeseReinforcementsSeat(game, 'richese').id;
  const marker = options.marker ?? 3;
  // Order A keeps the zero token for the reuse turn; otherwise the three token
  // is the reuse turn and the final hidden token is zero or five.
  const reuseValue: NoFieldValue = marker === 3 ? 0 : 3;
  const baseline = marker === 3 ? 15 : 12;
  const target = options.reserves ?? (marker === 3 ? 6 : 8);
  const tuning = route === 'tuning' ? baseline - target : 0;
  assert.ok(route === 'immediate' || (target >= 0 && target <= baseline),
    'The tuning route can only leave these reserve budgets');
  assert.ok(tuning <= 10, 'The tuning shipment must stay inside the spice the real route collected');
  const nativeSteps: RicheseReinforcementsStep[] = [];
  const act = (step: RicheseReinforcementsStep) => {
    nativeSteps.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  };
  const rich = () => richeseReinforcementsPlayer(game, richese);
  const tokenOf = (value: NoFieldValue) => rich().noField!.tokens.find(token => token.value === value)!;
  const stormFreeCity = () => {
    const city = RICHESE_CITIES.find(candidate => candidate.sector !== game.storm);
    assert.ok(city, 'The natural route keeps one empty stronghold outside the storm');
    return city;
  };
  const battleTarget = () => {
    for (const army of RICHESE_ARMIES) {
      const seat = game.players.find(player => player.faction === army.faction);
      if (!seat || army.sector === game.storm) continue;
      if ((seat.forces[`${army.territory}:${army.sector}`] ?? 0) > 0) return { ...army, seat: seat.id };
    }
    assert.fail('The timeline needs one untouched starting army outside the storm');
  };
  const done = { shipment: {} as Record<number, boolean>, reveal: {} as Record<number, boolean> };
  let open = false;
  let beforeShipment: Game | undefined;
  let afterShipment: Game | undefined;
  let shipmentStep: RicheseReinforcementsStep | undefined;
  let beforeBattle: Game | undefined;
  let battleStep: RicheseReinforcementsStep | undefined;
  let reservesBefore: Record<string, number> | undefined;
  let city: string | null = null;
  let army: { faction: string; territory: string; sector: number; seat: string } | undefined;
  const clear = () => richeseReinforcementsClean(game);
  // Native actions only: no counter is placed by hand and no wallet is set.
  // Richese's first real concealed shipment parks the token on the one
  // deterministic opening Spice Blow (Broken Land, sector 12). Its real reveal
  // materializes five counters that then collect that blow over two Mentat
  // pauses (5, then the remaining 3). A second real reveal plus one real paid
  // tuning shipment into an empty stronghold leave the requested reserve
  // budget, with a real charity claim when a low budget needs the top-up.
  for (let count = 0; count < 2400 && !open; count++) {
    assert.equal(game.status, 'playing');
    if (done.shipment[4] && !afterShipment && clear()) afterShipment = structuredClone(game);
    const choices = game.phase === 6 && clear()
      ? viewGame(game, richese).battleChoices : [];
    if (!open && choices.some(choice => choice.territory === army?.territory)) {
      const choice = choices.find(candidate => candidate.territory === army!.territory)!;
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
          event: rich().noFieldEvent, territory: RICHESE_BLOW.territory, sector: RICHESE_BLOW.sector } });
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
        const cityChoice = stormFreeCity();
        city = `${cityChoice.territory}:${cityChoice.sector}`;
        act({ actor: richese, action: { type: 'ship', noField: tokenOf(reuseValue).id,
          event: rich().noFieldEvent, territory: cityChoice.territory, sector: cityChoice.sector } });
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
        const cityChoice = stormFreeCity();
        act({ actor: richese, action: { type: 'ship', territory: cityChoice.territory,
          sector: cityChoice.sector, amount: tuning } });
        done.shipment[3] = true;
        continue;
      }
      const finalTurn = route === 'tuning' ? 4 : 1;
      if (turn === finalTurn && !done.shipment[4] && !rich().shipped) {
        army = battleTarget();
        beforeShipment = structuredClone(game);
        reservesBefore = Object.fromEntries(game.players.map(player => [player.id, player.reserves]));
        shipmentStep = { actor: richese, action: { type: 'ship', noField: tokenOf(marker).id,
          event: rich().noFieldEvent, territory: army.territory, sector: army.sector } };
        act(shipmentStep);
        done.shipment[4] = true;
        continue;
      }
      assert.ok(turn <= (route === 'tuning' ? 4 : 1),
        'The natural timeline must reach its battle by the scheduled turn');
    }
    const step = nextRicheseReinforcementsStep(game);
    assert.ok(step, `Native Richese continuation stalled at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    if (game.turn === 1 && step.action.type === 'stormDial') step.action.amount = 0;
    act(step);
  }
  assert.ok(open, 'The final concealed shipment must reach a real ordinary battle');
  assert.ok(beforeShipment && afterShipment && shipmentStep && beforeBattle && battleStep &&
    reservesBefore && army, 'The timeline must record its final shipment, army and battle admission');
  for (let count = 0; count < 120; count++) {
    const step = nextRicheseReinforcementsStep(game);
    if (!step) break;
    act(step);
  }
  assert.ok(game.battle && !game.battle.revealed && clear());
  assert.deepEqual(game.battle.plans, {});
  const opponent = army.seat;
  const observer = game.players.find(player => player.faction !== 'richese' &&
    player.id !== opponent)!.id;
  const machines: RicheseMachine[] = [...(options.machines ?? ['reinforcements', 'harass'])];
  if (options.opponentStone && !machines.includes('mirror')) machines.push('mirror');
  const hand: Partial<Record<RicheseMachine, string>> = {};
  const requested = machines.map(machine => machine === 'reinforcements' ? RICHESE_REINFORCEMENTS
    : machine === 'harass' ? RICHESE_HARASS
      : machine === 'stone' ? RICHESE_STONE_BURNER : RICHESE_MIRROR_WEAPON);
  if (options.opponentStone) transferCard(game, opponent, RICHESE_STONE_BURNER, staging, requested);
  for (const machine of machines) {
    const cardId = machine === 'reinforcements' ? RICHESE_REINFORCEMENTS
      : machine === 'harass' ? RICHESE_HARASS
        : machine === 'stone' ? RICHESE_STONE_BURNER : RICHESE_MIRROR_WEAPON;
    positionCard(game, richese, cardId, staging, requested);
    hand[machine] = cardId;
  }
  const location = `${army.territory}:${army.sector}`;
  const enemyForces = richeseReinforcementsPlayer(game, opponent).forces[location] ?? 0;
  assert.ok(enemyForces > 0, 'The battle army must still hold the stronghold');
  const reserves = reservesBefore[richese];
  if (route === 'tuning')
    assert.equal(reserves, target, 'The tuning route must leave the requested reserve budget');
  const materializes = Math.min(tokenOf(marker).value, reserves);
  const ownLeader = availableLeaders(game, richese, army.territory)[0];
  const otherLeader = availableLeaders(game, opponent, army.territory)[0];
  assert.ok(ownLeader && otherLeader);
  const ownDial = options.dial ?? (advanced ? Math.min(1, Math.floor(materializes / 2))
    : Math.min(2, materializes));
  const enemyDial = options.opponentDial ?? Math.min(5, enemyForces);
  const machineSlot = (machine: RicheseMachine | undefined) =>
    machine === undefined ? null : hand[machine] ?? null;
  const plan = (weapon: RicheseMachine | undefined, defense: RicheseMachine | undefined):
    RicheseReinforcementsStep => ({
      actor: richese,
      action: { type: 'battlePlan', dial: ownDial, support: advanced ? ownDial : 0,
        leader: ownLeader.id, weapon: machineSlot(weapon), defense: machineSlot(defense) },
    });
  const plans = {
    both: plan('reinforcements', 'harass'),
    reinforcements: plan('reinforcements', undefined),
    harass: plan(undefined, 'harass'),
    plain: plan(undefined, undefined),
    opponent: { actor: opponent, action: { type: 'battlePlan', dial: enemyDial,
      support: advanced ? enemyDial : 0, leader: otherLeader.id } },
  } satisfies RicheseReinforcementsFixture['plans'];
  return {
    initial, afterSetup, beforeShipment, shipmentStep, afterShipment, beforeBattle, battleStep,
    game, richese, opponent, observer, family, advanced, route, location, city,
    token: structuredClone(tokenOf(marker)), materializes, tuning, reservesBefore,
    machines, hand, plans, nativeSteps, staging,
  };
}

/** Seal one real plan and consume only its pre-reveal preparation windows; a
 * live post-reveal Stone/withdrawal decision is left for the caller. */
export function prepareRicheseReinforcementsPlan(game: Game, step: RicheseReinforcementsStep): Game {
  let state = applyAction(game, step.actor, step.action);
  for (let count = 0; count < 120; count++) {
    if (state.battle?.revealed) return state;
    const pending = !!state.response || !!state.phaseOpening || !!state.decision ||
      (!!state.battle?.preLeader && !state.battle.preLeader.closed) || !!state.battle?.preparation;
    if (!pending) return state;
    const next = nextRicheseReinforcementsStep(state);
    if (!next) return state;
    state = applyAction(state, next.actor, next.action);
  }
  throw Error('Sealed plan did not finish its pre-reveal preparation');
}

/** Seal one real plan and consume only the native windows it opens. */
export function sealRicheseReinforcementsPlan(game: Game, step: RicheseReinforcementsStep,
  stoneMode: 'kill' | 'ignore' = 'ignore'): Game {
  let state = applyAction(game, step.actor, step.action);
  for (let count = 0; count < 120; count++) {
    if (!state.response && !state.phaseOpening && !state.decision) return state;
    const next = nextRicheseReinforcementsStep(state, stoneMode);
    assert.ok(next, `Sealed plan left an unconsumed native window at ${state.decision?.kind}`);
    state = applyAction(state, next.actor, next.action);
  }
  throw Error('Sealed plan did not finish its native preparation');
}

/** Both real plans sealed; the native reveal and any live decisions remain. */
export function sealRicheseReinforcementsBoth(fixture: RicheseReinforcementsFixture,
  plan: 'both' | 'reinforcements' | 'harass' | 'plain' = 'reinforcements',
  state = fixture.game, stoneMode: 'kill' | 'ignore' = 'ignore'): Game {
  const first = sealRicheseReinforcementsPlan(state, fixture.plans[plan], stoneMode);
  return sealRicheseReinforcementsPlan(first, fixture.plans.opponent, stoneMode);
}

/** Resolve the programme's own reveal and casualties, before any later battle. */
export function finishRicheseReinforcementsBattle(game: Game,
  options: { callers?: string[]; stoneModes?: Record<string, 'kill' | 'ignore'> } = {}): Game {
  const event = game.battle?.event;
  assert.ok(event, 'Finish only a live original battle');
  let state = game;
  for (let count = 0; count < 240; count++) {
    if (!state.battle && state.lastBattleContext?.event === event &&
      richeseReinforcementsClean(state) && !state.pendingTreacheryDiscard) return state;
    let step: RicheseReinforcementsStep | null;
    if (!state.response && !state.phaseOpening && state.decision?.kind === 'stoneBurner') {
      step = { actor: state.decision.player, action: { type: 'decision', event: state.decision.event,
        mode: options.stoneModes?.[state.decision.player] ?? 'ignore' } };
    } else {
      const next = nextRicheseReinforcementsStep(state);
      step = next && next.action.type === 'traitorCall'
        ? { actor: next.actor, action: { ...next.action, call: options.callers?.includes(next.actor) ?? false } }
        : next;
    }
    assert.ok(step, `Native battle continuation stalled at ${state.decision?.kind}`);
    state = applyAction(state, step.actor, step.action);
  }
  throw Error('Native Richese battle did not finish');
}
