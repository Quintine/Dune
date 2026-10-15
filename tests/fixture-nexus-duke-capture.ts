import assert from 'node:assert/strict';
import {
  applyAction, captureCandidates, createGame, handLimit, initializeNexusGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { leaders, treacheryDeck, type Card, type Leader } from '../game/cards';
import {
  DUKE_VIDAL_ID, dukeController, type DukeReleasedCaptureWitness, type DukeState,
} from '../game/duke-vidal';
import { traitorDeck } from '../game/traitors';
import { TERRITORIES, territory } from '../game/board';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import { e3NexusEcazClean, e3NexusEcazReload, nextE3NexusEcazStep, orderE3NexusEcazSpice } from './fixture-e3-nexus-ecaz';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

/**
 * Genuine standalone original Advanced Ecaz/Harkonnen Nexus tables (roster
 * Ecaz + Harkonnen + Guild + Fremen, no Skills, no optional modules) for the
 * shared Duke's real capture, liberation and death custody.
 *
 * Every action is issued by a live owner: the paid Ecaz Ambassador placement,
 * the other seat's real arrival, the real Battle declaration and sealed plans,
 * the real capture response, the closing Nexus draw and real card actions.
 * Nothing is staged: no hand, wallet, force, played card, controller, captive
 * marker or clock is assigned. The single scoped exception is the capture
 * lottery, which selects entropy for the ORIGINAL shuffle over this case's
 * actual emitted candidate pool (the engine's own `captureCandidates`).
 */

export type NexusDukeStep = { actor: string; action: Action };
export type NexusDukeTransition = { before: Game; step: NexusDukeStep; after: Game };
export type NexusDukeResolution = { before: Game; after: Game };
export type NexusDukeCaptureDeclaration = { player: string; loser: string; territory: string };

/** Exactly the fields this fixture's driver consumes, plus its own progress. */
export type NexusDukePlan = {
  owner: string;
  captor: string;
  entrant: string;
  others: string[];
  /** The reusable physical Ecaz Ambassador token and where Ecaz really places it. */
  token: string;
  destination: string;
  /** True only until the first placement commits; the token then returns to supply. */
  place: boolean;
  /** Answer to a real capture offer and to the real retained/executed choice. */
  capture: 'accept' | 'decline';
  mode: 'keep' | 'execute';
  /** Exact next real shipments this plan issues, keyed by the acting seat. */
  ship: Record<string, { territory: string; amount: number }>;
  /** One real shipment per seat per turn. */
  shipped: Record<string, string>;
  /** How many real Bidding lots this plan bids one spice for. */
  bid: number;
  /** The turn whose Bidding window this plan already bid in. */
  lastBid: string;
};

/** A driver plan that issues no optional action; used before Ecaz's supply exists. */
export function emptyNexusDukePlan(): NexusDukePlan {
  return { owner: '', captor: '', entrant: '', others: [], token: '', destination: '',
    place: false, capture: 'accept', mode: 'keep', ship: {}, shipped: {}, bid: 0, lastBid: '' };
}

export const nexusDukeClean = (game: Game): boolean => e3NexusEcazClean(game);
export const nexusDukeReload = (game: Game): Game => e3NexusEcazReload(game);

export function nexusDukePlayer(game: Game, id: string): Player {
  const player = game.players.find((candidate) => candidate.id === id);
  assert.ok(player, `Missing original Nexus Duke seat ${id}`);
  return player;
}
export function nexusDukeSeat(game: Game, faction: FactionId): Player {
  const player = game.players.find((candidate) => candidate.faction === faction);
  assert.ok(player, `Missing original ${faction} seat`);
  return player;
}

/** Original undealt Treachery slot selection: which physical card each private
 * setup deal receives. A matcher never invents a card; it only chooses among
 * the undealt originals. */
export type NexusDukeDeal = (faction: FactionId) => readonly (string | ((card: Card) => boolean))[];

const slot = (spec: string | ((card: Card) => boolean) | undefined) => {
  if (typeof spec === 'function') return spec;
  const wanted = spec ?? 'worthless';
  return (card: Card) => card.kind === wanted || card.effect === wanted;
};
const isWeapon = (card: Card | undefined): card is Card =>
  !!card && (card.kind === 'projectile' || card.kind === 'poison');
const defaultDeal: NexusDukeDeal = (faction) =>
  faction === 'harkonnen' ? ['worthless', 'shield'] : ['worthless'];
const poisonDeal: NexusDukeDeal = (faction) =>
  faction === 'harkonnen' ? ['worthless', 'poison'] : ['worthless'];

function permutation<T>(original: readonly T[], desired: readonly T[]): number[] {
  const current = [...original], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i, 'The selected permutation must stay inside its original array.');
    rolls.push(Math.floor((j + 0.5) / (i + 1) * 0x100000000));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired);
  return rolls;
}
function lottery<T>(rolls: readonly number[], operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let index = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1 && index < rolls.length)
      array[0] = rolls[index++];
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
/** Exact Fisher-Yates entropy that makes the engine's own `shuffle` emit `first`
 * in position zero of the supplied physical candidate array. */
function shuffleRolls<T extends { id: string }>(source: readonly T[], first: string): number[] {
  const found = source.find((candidate) => candidate.id === first);
  assert.ok(found, 'The shared Duke disc must be in the emitted candidate pool.');
  return permutation(source, [found, ...source.filter((candidate) => candidate.id !== first)]);
}

/** Reorder only the original undealt Spice Cards for the opening land blows. */
export function primeNexusDukeSpice(game: Game): void {
  orderE3NexusEcazSpice(game);
}

export type NexusDukeSetup = {
  initial: Game; offered: Game; afterSetup: Game; game: Game;
  owner: string; captor: string; entrant: string; others: string[];
  token: string; destination: string;
  actions: NexusDukeStep[];
};
export type NexusDukeSetupOptions = {
  roster?: readonly FactionId[];
  deal?: NexusDukeDeal;
};

function dealt(game: Game, deal: NexusDukeDeal): Game {
  const cards = treacheryDeck(['ecaz']), remaining = [...cards], front: string[] = [];
  for (const player of game.players)
    for (let n = 0; n < (player.faction === 'harkonnen' ? 2 : 1); n++) {
      const matcher = slot([...deal(player.faction)][n]);
      const index = remaining.findIndex((card) => matcher(card));
      assert.ok(index >= 0, `The original ${player.faction} deal needs an undealt physical Treachery card.`);
      front.push(remaining.splice(index, 1)[0].id);
    }
  // Auction order keeps the original weapon cards first; every card is conserved.
  const rest = [...remaining.filter(isWeapon), ...remaining.filter((card) => !isWeapon(card))];
  const rolls = [
    ...permutation(NEXUS_FACTIONS, ['ecaz', ...NEXUS_FACTIONS.filter((faction) => faction !== 'ecaz')]),
    ...permutation(cards.map((card) => card.id), [...front, ...rest.map((card) => card.id)]),
  ];
  return lottery(rolls, () => initializeNexusGameForAudit(game));
}

/** Genuine completed standalone original setup. Stable seam for other suites. */
export function createNexusDukeCaptureSetup(options: NexusDukeSetupOptions = {}): NexusDukeSetup {
  const roster = options.roster ?? (['ecaz', 'harkonnen', 'guild', 'fremen'] as FactionId[]);
  let game = createGame('NEXUSDUKECAPTURE', newPlayer(roster[0], roster[0], roster[0]), true, ['ecaz']);
  for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  assert.equal(game.status, 'lobby');
  assert.equal(game.advanced, true);
  assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(!game.leaderSkills && !game.ecazTreachery && !game.homeworlds);
  assert.ok(roster.includes('ecaz') && roster.includes('harkonnen') && roster.length >= 3);
  const actions: NexusDukeStep[] = [], blank = emptyNexusDukePlan();
  const host = game.host;
  for (const [type, enabled] of [['techTokens', false], ['strongholdCards', false], ['homeworlds', false]] as const)
    if (!!game[type] !== enabled)
      game = stepNexusDuke(game, blank, { actor: host, action: { type, enabled } }, actions);
  game.discoveryEnabled = false;
  game.nexusCards ??= { cards: null, phase: null };
  const initial = nexusDukeReload(game);
  for (const player of game.players)
    if (!player.ready)
      game = stepNexusDuke(game, blank, { actor: player.id, action: { type: 'ready' } }, actions);
  game = dealt(game, options.deal ?? defaultDeal);
  const offered = nexusDukeReload(game);
  for (let n = 0; game.status === 'setup' && n < 240; n++) {
    const next = nextE3NexusEcazStep(game);
    assert.ok(next, 'The original setup needs its actual current owner.');
    game = stepNexusDuke(game, blank, next, actions);
  }
  assert.equal(game.status, 'playing');
  const owner = nexusDukeSeat(game, 'ecaz').id, captor = nexusDukeSeat(game, 'harkonnen').id;
  const others = game.players.filter((player) => player.id !== owner).map((player) => player.id);
  const guild = game.players.find((player) => player.faction === 'guild');
  const entrant = (guild && guild.id !== owner ? guild.id : others.find((id) => id !== owner))!;
  assert.notEqual(entrant, owner);
  return { initial, offered, afterSetup: nexusDukeReload(game), game: nexusDukeReload(game),
    owner, captor, entrant, others, token: reusableToken(game), destination: ambientStronghold(game), actions };
}
function reusableToken(game: Game): string {
  const token = game.ecazAmbassadors?.tokens.find((candidate) => candidate.effect === 'ecaz');
  assert.ok(token, 'The reusable Ecaz Ambassador token must be in the original supply.');
  return token.id;
}
/** An empty, storm-free stronghold that no faction occupies yet. */
function ambientStronghold(game: Game): string {
  const occupied = new Set<string>();
  for (const player of game.players)
    for (const key of Object.keys(player.forces)) occupied.add(key.split(':')[0]);
  const found = TERRITORIES.find((candidate) => candidate.type === 'stronghold' &&
    !candidate.sectors.includes(game.storm) && !occupied.has(candidate.id));
  assert.ok(found, 'The original strongholds must leave one empty placement stronghold.');
  return found.id;
}
function shipmentSector(game: Game, id: string): number {
  const sectors = territory(id).sectors;
  return sectors.find((sector) => sector !== game.storm) ?? sectors[0];
}

/** A plan for a settled table: no optional action unless the caller asks. */
export function quietPlan(game: Game, overrides: Partial<NexusDukePlan> = {}): NexusDukePlan {
  const owner = nexusDukeSeat(game, 'ecaz').id;
  const captor = game.players.find((player) => player.faction === 'harkonnen')?.id ??
    game.players.find((player) => player.id !== owner)!.id;
  const others = game.players.filter((player) => player.id !== owner).map((player) => player.id);
  return {
    owner, captor, entrant: others.find((id) => id !== captor)!, others,
    token: reusableToken(game), destination: ambientStronghold(game),
    place: false, capture: 'accept', mode: 'keep', ship: {}, shipped: {}, bid: 0, lastBid: '',
    ...overrides,
  };
}

/** The exact next action of the original chronology. A null result means a real
 * owner must still make a private choice (or seal a private Battle Plan). */
export function nextNexusDukeStep(game: Game, plan: NexusDukePlan): NexusDukeStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'captureOffer')
      return { actor: decision.player, action: { type: 'decision', accept: plan.capture === 'accept' } };
    if (decision?.kind === 'capturedLeader')
      return { actor: decision.player, action: { type: 'decision', mode: plan.mode } };
    if (decision?.kind === 'battleLosses')
      return { actor: decision.player, action: { type: 'decision', choice: 0 } };
    if (decision?.kind === 'battleCards')
      return { actor: decision.player, action: { type: 'decision', discard: [] } };
    if (decision?.kind === 'techToken')
      return { actor: decision.player, action: { type: 'decision', token: decision.choices[0] } };
    if (decision?.kind === 'ecazPlacement') {
      const token = game.ecazAmbassadors?.tokens.find((candidate) => candidate.id === plan.token);
      return plan.place && token?.zone === 'supply'
        ? { actor: decision.player, action: { type: 'decision', token: plan.token, territory: plan.destination } }
        : { actor: decision.player, action: { type: 'decision', decline: true } };
    }
    if (decision?.kind === 'ecazAmbassador') {
      const entry = game.pendingAmbassador;
      if (entry?.token === plan.token && entry.stage === 'offer' && entry.owner === plan.owner)
        return { actor: decision.player, action: { type: 'decision', event: entry.event,
          trigger: true, beneficiary: plan.owner, choice: 'duke' } };
    }
    if (game.phase === 3 && game.auction && plan.bid > 0 && game.auction.active === plan.owner &&
      plan.lastBid !== String(game.turn) && !game.auction.bidder &&
      isWeapon(game.auction.cards[game.auction.index]) &&
      nexusDukePlayer(game, plan.owner).hand.length < handLimit(nexusDukePlayer(game, plan.owner))) {
      plan.lastBid = String(game.turn);
      return { actor: plan.owner, action: { type: 'bid', amount: 1 } };
    }
    const order = game.phase === 5 && game.active ? plan.ship[game.active] : undefined;
    if (order && nexusDukeClean(game) && plan.shipped[game.active!] !== String(game.turn))
      return { actor: game.active!, action: { type: 'ship', territory: order.territory,
        sector: shipmentSector(game, order.territory), amount: order.amount, elite: 0, allyPayment: 0 } };
  }
  return nextE3NexusEcazStep(game);
}

export function stepNexusDuke(game: Game, plan: NexusDukePlan, step: NexusDukeStep,
  actions?: NexusDukeStep[]): Game {
  actions?.push(structuredClone(step));
  if (step.action.type === 'ship') plan.shipped[step.actor] = String(game.turn);
  const state = nexusDukeReload(game);
  if (state.pendingCapture && (state.response?.kind === 'capture' ||
    state.decision?.kind === 'captureOffer' && step.action.type === 'decision' && step.action.accept === true)) {
    const rolls = shuffleRolls(emittedCandidates(state), DUKE_VIDAL_ID);
    return lottery(rolls, () => applyAction(state, step.actor, step.action));
  }
  return withClassicDiscoveryNexusLottery(() => applyAction(state, step.actor, step.action));
}

/** The case's own candidate pool, read from the engine's original admission.
 * The released-battle witness the capture itself published is validated here. */
function emittedCandidates(game: Game): Leader[] {
  const pending = game.pendingCapture;
  assert.ok(pending, 'The original capture declaration must still be current.');
  return captureCandidates(game, pending.loser, pending.territory, releasedWitness(game));
}
function releasedWitness(game: Game): DukeReleasedCaptureWitness | undefined {
  const pending = game.pendingCapture;
  if (!pending || !('duke' in pending)) return undefined;
  const candidate: unknown = pending.duke;
  if (candidate === undefined) return undefined;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate))
    throw new Error('The original capture lost its physical released-battle witness.');
  const deaths = 'deaths' in candidate ? candidate.deaths : undefined;
  const usedAt = 'usedAt' in candidate ? candidate.usedAt : undefined;
  if (typeof deaths !== 'number' || !Number.isSafeInteger(deaths) ||
    typeof usedAt !== 'string' || !usedAt)
    throw new Error('The original capture lost its physical released-battle witness.');
  return { deaths, usedAt };
}

export function advanceNexusDuke(state: Game, until: (game: Game) => boolean, plan: NexusDukePlan,
  actions?: NexusDukeStep[]): Game {
  let game = state;
  for (let n = 0; n < 2600; n++) {
    if (until(game)) return game;
    assert.equal(game.status, 'playing');
    const next = nextNexusDukeStep(game, plan);
    assert.ok(next, `The original chronology needs its real owner at ${game.turn}/${game.phase}/${game.decision?.kind ?? 'open'}.`);
    game = stepNexusDuke(game, plan, next, actions);
  }
  throw Error('The original Nexus Duke chronology did not reach its requested window.');
}

function living(game: Game, id: string): Leader[] {
  return nexusDukePlayer(game, id).leaders.filter((leader) => !leader.dead);
}
function strongest(list: readonly Leader[]): Leader {
  const sorted = [...list].sort((a, b) => b.strength - a.strength)[0];
  assert.ok(sorted, 'The original roster must still own a living leader.');
  return sorted;
}
function weakest(list: readonly Leader[]): Leader {
  const sorted = [...list].sort((a, b) => a.strength - b.strength)[0];
  assert.ok(sorted, 'The original roster must still own a living leader.');
  return sorted;
}

/** The real paid Ecaz Ambassador placement, then another seat's real arrival. */
function ambassadorAcquisition(state: Game, plan: NexusDukePlan, actions: NexusDukeStep[]): {
  placement: NexusDukeTransition; arrival: NexusDukeTransition & { duke: DukeState }; game: Game;
} {
  let game = advanceNexusDuke(state, (candidate) => candidate.decision?.kind === 'ecazPlacement', plan, actions);
  const placementBefore = nexusDukeReload(game);
  const placementStep: NexusDukeStep = { actor: plan.owner, action: {
    type: 'decision', token: plan.token, territory: plan.destination } };
  game = stepNexusDuke(game, plan, placementStep, actions);
  game = advanceNexusDuke(game, (candidate) =>
    candidate.ecazAmbassadors!.tokens.find((token) => token.id === plan.token)!.zone === 'placed', plan, actions);
  const placement: NexusDukeTransition = { before: placementBefore, step: placementStep, after: nexusDukeReload(game) };
  plan.place = false;
  plan.ship = {
    [plan.entrant]: { territory: plan.destination, amount: 1 },
    [plan.owner]: { territory: 'carthag', amount: 1 },
  };
  game = advanceNexusDuke(game, (candidate) => candidate.decision?.kind === 'ecazAmbassador' &&
    candidate.pendingAmbassador?.token === plan.token &&
    candidate.pendingAmbassador.stage === 'offer', plan, actions);
  const arrivalBefore = nexusDukeReload(game);
  const arrivalStep: NexusDukeStep = { actor: plan.owner, action: { type: 'decision',
    event: game.pendingAmbassador!.event, trigger: true, beneficiary: plan.owner, choice: 'duke' } };
  game = stepNexusDuke(game, plan, arrivalStep, actions);
  assert.equal(game.dukeVidal?.controller, plan.owner, 'The real Ecaz Ambassador must acquire the shared disc.');
  assert.equal(game.dukeVidal?.source, 'ecaz');
  const arrival = { before: arrivalBefore, step: arrivalStep, after: nexusDukeReload(game),
    duke: structuredClone(game.dukeVidal!) };
  plan.ship = {};
  return { placement, arrival, game };
}

/** Real Battle declaration; both private Battle Plans still need their owners. */
export function openNexusDukeBattle(state: Game, plan: NexusDukePlan, actions: NexusDukeStep[],
  where: { territory: string; first: string; second: string }): NexusDukeTransition & { game: Game } {
  let game = advanceNexusDuke(state, (candidate) =>
    candidate.phase === 6 && nexusDukeClean(candidate) && !!candidate.active, plan, actions);
  const choice = viewGame(game, game.active!).battleChoices.find((candidate) =>
    candidate.territory === where.territory &&
    [where.first, where.second].includes(candidate.attacker) &&
    [where.first, where.second].includes(candidate.defender));
  assert.ok(choice, `The real ${where.territory} Battle between the original seats must be offered.`);
  const step: NexusDukeStep = { actor: choice.chooser, action: { type: 'chooseBattle',
    territory: where.territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  const before = nexusDukeReload(game);
  game = stepNexusDuke(game, plan, step, actions);
  game = advanceNexusDuke(game, (candidate) => !!candidate.battle && nexusDukeClean(candidate) &&
    !candidate.battle.preparation && candidate.battle.preLeader?.closed !== false, plan, actions);
  return { before, step, after: nexusDukeReload(game), game };
}
export type NexusDukeSeatPlan = {
  actor: string; leader: string | null; dial: number; support?: number;
  weapon?: string; defense?: string;
};
export function sealNexusDukeBattle(state: Game, plan: NexusDukePlan, actions: NexusDukeStep[],
  plans: readonly NexusDukeSeatPlan[]): Game {
  let game = state;
  for (const entry of plans) {
    const step: NexusDukeStep = { actor: entry.actor, action: { type: 'battlePlan',
      leader: entry.leader, dial: entry.dial, support: entry.support ?? 0,
      ...(entry.weapon ? { weapon: entry.weapon } : {}),
      ...(entry.defense ? { defense: entry.defense } : {}) } };
    game = stepNexusDuke(game, plan, step, actions);
    if (!game.battle?.revealed)
      game = advanceNexusDuke(game, (candidate) => !!candidate.battle && nexusDukeClean(candidate) &&
        !candidate.battle.preparation && candidate.battle.preLeader?.closed !== false, plan, actions);
  }
  assert.ok(game.battle?.revealed, 'The original sealed plans must reveal this Battle.');
  return game;
}

export type NexusDukeClosing = {
  alliance: Game; before: Game; step: NexusDukeStep; after: Game; game: Game;
};
/** The genuine closing Nexus: two other seats pact, the real Spice Blow/Nexus
 * runs, and unallied Ecaz spends that phase's real Nexus choice on its own card. */
export function closeNexusDukeDraw(state: Game, plan: NexusDukePlan, actions: NexusDukeStep[]): NexusDukeClosing {
  assert.ok(plan.others.length >= 2, 'The original pact needs two other real seats.');
  let game = advanceNexusDuke(state, (candidate) =>
    candidate.turn === 2 && candidate.phase === 1 && nexusDukeClean(candidate), plan, actions);
  orderE3NexusEcazSpice(game, true);
  game = advanceNexusDuke(game, (candidate) =>
    candidate.nexus && !candidate.spiceWindow && !candidate.spiceResolution && nexusDukeClean(candidate), plan, actions);
  for (const [actor, target] of [[plan.others[0], plan.others[1]], [plan.others[1], plan.others[0]]])
    game = stepNexusDuke(game, plan, { actor, action: { type: 'alliance', target } }, actions);
  const alliance = nexusDukeReload(game);
  assert.equal(nexusDukePlayer(game, plan.owner).ally, null, 'Ecaz must stay unallied for the closing draw.');
  game = advanceNexusDuke(game, (candidate) =>
    candidate.nexusCards?.phase?.stage === 'drawing' && nexusDukeClean(candidate), plan, actions);
  assert.ok(game.nexusCards!.phase!.eligible.includes(plan.owner));
  const before = nexusDukeReload(game);
  const step: NexusDukeStep = { actor: plan.owner, action: { type: 'nexusCardChoice',
    turn: game.turn, card: game.nexusCards!.cards!.hands[plan.owner], choice: 'draw', ownRedraws: 0 } };
  game = stepNexusDuke(game, plan, step, actions);
  game = advanceNexusDuke(game, (candidate) => candidate.nexusCards?.phase?.stage === 'complete', plan, actions);
  assert.equal(game.nexusCards!.cards!.hands[plan.owner], 'ecaz',
    'The real closing draw must leave Ecaz holding the physical Ecaz Nexus card.');
  return { alliance, before, step, after: nexusDukeReload(game), game };
}

export type NexusDukeWindow = { game: Game; action: Action; event: string; plan: NexusDukePlan };
/** The first quiet Battle boundary where native Ecaz physically holds its own
 * Nexus card and stays unallied. Real owners keep every other choice. */
export function quietNexusDukeWindow(state: Game, options: Partial<NexusDukePlan> = {},
  actions: NexusDukeStep[] = []): NexusDukeWindow {
  const plan = quietPlan(state, options);
  // An empty Battle phase closes automatically. Keep a real pending battle
  // through a legal native shipment rather than installing an artificial pause.
  if (!Object.keys(plan.ship).length)
    plan.ship = { [plan.owner]: { territory: 'carthag', amount: 1 } };
  let game = state;
  if (game.nexusCards?.cards?.hands[plan.owner] !== 'ecaz')
    game = closeNexusDukeDraw(game, plan, actions).game;
  game = advanceNexusDuke(game, (candidate) => candidate.phase === 6 && nexusDukeClean(candidate) &&
    !candidate.battle && candidate.nexusCards?.cards?.hands[plan.owner] === 'ecaz', plan, actions);
  const action = nexusEcazDukeAction(viewGame(game, plan.owner));
  assert.ok(action, 'The quiet Ecaz Nexus Cunning window must be available.');
  assert.ok(typeof action.event === 'string');
  return { game, action, event: action.event, plan };
}

export type NexusDukeCaptureVariant = 'unused' | 'used';
export type NexusDukeCaptureOptions = {
  variant?: NexusDukeCaptureVariant;
  mode?: 'keep' | 'execute';
  roster?: readonly FactionId[];
  deal?: NexusDukeDeal;
};

export type NexusDukeCaptureFixture = {
  initial: Game; offered: Game; afterSetup: Game;
  owner: string; captor: string; entrant: string; others: string[];
  token: string; destination: string;
  placement: NexusDukeTransition;
  arrival: NexusDukeTransition & { duke: DukeState };
  battle: NexusDukeTransition & { territory: string };
  event: string;
  sealed: Game;
  declared: NexusDukeCaptureDeclaration | null;
  offer: NexusDukeTransition | null;
  candidates: Leader[];
  resolved: NexusDukeResolution | null;
  decision: NexusDukeTransition | null;
  duke: DukeState;
  plan: NexusDukePlan;
  game: Game;
  actions: NexusDukeStep[];
};

type InternalCaptureOptions = NexusDukeCaptureOptions & {
  leadDuke: boolean; poison: boolean; capture: 'accept' | 'decline';
};

function captureChronology(options: InternalCaptureOptions): NexusDukeCaptureFixture {
  const setup = createNexusDukeCaptureSetup({ roster: options.roster,
    deal: options.deal ?? (options.poison ? poisonDeal : defaultDeal) });
  const actions = setup.actions;
  const plan: NexusDukePlan = {
    ...quietPlan(setup.afterSetup), place: true,
    capture: options.capture, mode: options.mode ?? 'keep',
  };
  primeNexusDukeSpice(setup.afterSetup);
  let game = nexusDukeReload(setup.afterSetup);
  const acquisition = ambassadorAcquisition(game, plan, actions);
  game = acquisition.game;
  plan.ship = { [plan.owner]: { territory: 'carthag', amount: 1 } };
  game = advanceNexusDuke(game, (candidate) =>
    candidate.phase === 6 && nexusDukeClean(candidate) && !!candidate.active, plan, actions);
  plan.ship = {};
  const battle = openNexusDukeBattle(game, plan, actions,
    { territory: 'carthag', first: plan.owner, second: plan.captor });
  game = battle.game;
  const weapon = options.poison
    ? nexusDukePlayer(game, plan.captor).hand.find((card) => card.kind === 'poison')
    : undefined;
  if (options.poison) assert.ok(weapon, 'The real setup deal must leave Harkonnen holding the physical poison.');
  game = sealNexusDukeBattle(game, plan, actions, [
    { actor: plan.owner, leader: options.leadDuke ? DUKE_VIDAL_ID : weakest(living(game, plan.owner)).id,
      dial: 0, support: 0 },
    { actor: plan.captor, leader: strongest(living(game, plan.captor)).id, dial: 2, support: 0,
      ...(weapon ? { weapon: weapon.id } : {}) },
  ]);
  const sealed = nexusDukeReload(game);
  const battleEvent = sealed.battle?.event ?? '';
  game = advanceNexusDuke(game, (candidate) =>
    candidate.decision?.kind === 'captureOffer' || (!candidate.battle && nexusDukeClean(candidate)), plan, actions);
  let declared: NexusDukeCaptureDeclaration | null = null, offer: NexusDukeTransition | null = null;
  let resolved: NexusDukeResolution | null = null, decision: NexusDukeTransition | null = null;
  let candidates: Leader[] = [];
  if (game.decision?.kind === 'captureOffer' && options.capture === 'decline') {
    game = stepNexusDuke(game, plan,
      { actor: game.decision.player, action: { type: 'decision', accept: false } }, actions);
  } else if (game.decision?.kind === 'captureOffer') {
    const pending = game.pendingCapture!;
    declared = { player: pending.player, loser: pending.loser, territory: pending.territory };
    candidates = emittedCandidates(game);
    const acceptStep: NexusDukeStep = { actor: game.decision.player, action: { type: 'decision', accept: true } };
    const offerBefore = nexusDukeReload(game);
    game = stepNexusDuke(game, plan, acceptStep, actions);
    offer = { before: offerBefore, step: acceptStep, after: nexusDukeReload(game) };
    const resolveBefore = nexusDukeReload(game);
    game = advanceNexusDuke(game, (candidate) =>
      candidate.decision?.kind === 'capturedLeader' || (!candidate.battle && nexusDukeClean(candidate)), plan, actions);
    assert.ok(game.decision?.kind === 'capturedLeader', 'The original capture response must select the shared disc.');
    assert.equal(game.decision.leader, DUKE_VIDAL_ID);
    resolved = { before: resolveBefore, after: nexusDukeReload(game) };
    const modeStep: NexusDukeStep = { actor: game.decision!.player, action: { type: 'decision', mode: plan.mode } };
    const modeBefore = nexusDukeReload(game);
    game = stepNexusDuke(game, plan, modeStep, actions);
    decision = { before: modeBefore, step: modeStep, after: nexusDukeReload(game) };
  }
  game = advanceNexusDuke(game, (candidate) =>
    !candidate.battle && !candidate.pendingCapture && nexusDukeClean(candidate), plan, actions);
  return {
    initial: setup.initial, offered: setup.offered, afterSetup: setup.afterSetup,
    owner: plan.owner, captor: plan.captor, entrant: plan.entrant, others: plan.others,
    token: plan.token, destination: plan.destination,
    placement: acquisition.placement, arrival: acquisition.arrival,
    battle: { ...battle, territory: 'carthag' }, event: battleEvent, sealed,
    declared, offer, candidates, resolved, decision,
    duke: structuredClone(game.dukeVidal!), plan, game: nexusDukeReload(game), actions,
  };
}

/** Real Harkonnen capture of the shared disc: unused, or just used in the very
 * Battle that captures it. */
export function createNexusDukeCaptureFixture(options: NexusDukeCaptureOptions = {}): NexusDukeCaptureFixture {
  const variant = options.variant ?? 'unused';
  return captureChronology({ ...options, leadDuke: variant === 'used', poison: false, capture: 'accept' });
}

export type NexusDukeDeathFixture = {
  fixture: NexusDukeCaptureFixture;
  /** Settled turn-1 aftermath with the real death applied. */
  game: Game;
  /** The real closing draw, then the quiet Battle boundary where Ecaz holds its card. */
  window: Game;
  action: Action;
  owner: string; captor: string; entrant: string;
  deaths: number; duke: DukeState; plan: NexusDukePlan; actions: NexusDukeStep[];
};

/** Real Battle death of the shared disc: Ecaz commits the Duke, loses, and the
 * winning Harkonnen plan's real poison card kills it into the Tanks. */
export function createNexusDukeDeathFixture(options: NexusDukeCaptureOptions = {}): NexusDukeDeathFixture {
  const fixture = captureChronology({ ...options, leadDuke: true, poison: true, capture: 'decline' });
  assert.equal(fixture.game.dukeVidal!.leader.dead, true, 'The real poison must kill the shared disc.');
  const quiet = quietNexusDukeWindow(fixture.game, fixture.plan, fixture.actions);
  return { fixture, game: fixture.game, window: quiet.game, action: quiet.action,
    owner: fixture.owner, captor: fixture.captor, entrant: fixture.entrant,
    deaths: fixture.game.dukeVidal!.leader.deaths, duke: structuredClone(fixture.game.dukeVidal!),
    plan: fixture.plan, actions: fixture.actions };
}

export type NexusDukeReclaim = {
  closing: NexusDukeClosing; window: Game; before: Game; step: NexusDukeStep; after: Game; duke: DukeState;
};
/** Genuine Ecaz Nexus Cunning liberation of the actual captured shared disc,
 * reached through the real closing draw. */
export function reclaimCapturedNexusDuke(state: Game, plan: NexusDukePlan,
  actions: NexusDukeStep[] = [], options: { battle?: boolean } = {}): NexusDukeReclaim {
  assert.ok(state.dukeVidal?.leader.capturedBy, 'Ecaz Nexus Cunning must liberate a real captive.');
  assert.equal(dukeController(state.dukeVidal!), plan.captor);
  const closing = closeNexusDukeDraw(state, plan, actions);
  if (options.battle) plan.ship = { [plan.owner]: { territory: 'carthag', amount: 1 } };
  const quiet = quietNexusDukeWindow(closing.game, plan, actions);
  plan.ship = {};
  plan.place = false;
  const step: NexusDukeStep = { actor: plan.owner, action: quiet.action };
  const before = nexusDukeReload(quiet.game);
  const game = stepNexusDuke(quiet.game, plan, step, actions);
  assert.equal(dukeController(game.dukeVidal!), plan.owner);
  assert.equal(game.dukeVidal!.leader.capturedBy, undefined);
  return { closing, window: quiet.game, before, step, after: nexusDukeReload(game),
    duke: structuredClone(game.dukeVidal!) };
}

export type NexusDukeUseRelease = {
  closing: Game; battle: NexusDukeTransition; game: Game; duke: DukeState;
};
/** The captor really uses the retained captive in one later Battle; the original
 * aftermath then releases and sets the same disc aside. */
export function releaseCapturedNexusDukeByUse(state: Game, plan: NexusDukePlan,
  options: { territory?: string; captorForces?: number } = {},
  actions: NexusDukeStep[] = []): NexusDukeUseRelease {
  const territoryId = options.territory ?? 'imperial_basin', captorForces = options.captorForces ?? 5;
  assert.equal(dukeController(state.dukeVidal!), plan.captor);
  plan.capture = 'decline';
  const closing = closeNexusDukeDraw(state, plan, actions).game;
  plan.ship = { [plan.captor]: { territory: territoryId, amount: captorForces } };
  let game = advanceNexusDuke(closing, (candidate) =>
    candidate.phase === 6 && nexusDukeClean(candidate) && !!candidate.active, plan, actions);
  plan.ship = {};
  const battle = openNexusDukeBattle(game, plan, actions,
    { territory: territoryId, first: plan.captor, second: plan.owner });
  game = sealNexusDukeBattle(battle.game, plan, actions, [
    { actor: plan.captor, leader: DUKE_VIDAL_ID, dial: 0, support: 0 },
    { actor: plan.owner, leader: weakest(living(game, plan.owner)).id, dial: 0, support: 0 },
  ]);
  game = advanceNexusDuke(game, (candidate) =>
    !candidate.battle && !candidate.decision && nexusDukeClean(candidate), plan, actions);
  assert.equal(game.dukeVidal!.leader.capturedBy, undefined);
  return { closing, battle, game, duke: structuredClone(game.dukeVidal!) };
}

export type NexusDukeLeaderDeath = { leader: string; weapon: string; turn: number };
export type NexusDukeReturn = {
  game: Game; deaths: NexusDukeLeaderDeath[]; returned: Game; duke: DukeState;
};
function carthagForces(game: Game, id: string): number {
  return Object.entries(nexusDukePlayer(game, id).forces)
    .filter(([key]) => key.startsWith('carthag:'))
    .reduce((sum, [, count]) => sum + count, 0);
}
/** Real route to the all-native-Harkonnen-dead return: every living Harkonnen
 * leader dies in a real Battle Ecaz wins with a real auctioned weapon, and the
 * aftermath that kills the last one returns the captive shared disc. */
export function releaseCapturedNexusDukeByAllHarkDead(state: Game, plan: NexusDukePlan,
  actions: NexusDukeStep[] = []): NexusDukeReturn {
  assert.equal(dukeController(state.dukeVidal!), plan.captor);
  let game = closeNexusDukeDraw(state, plan, actions).game;
  const deaths: NexusDukeLeaderDeath[] = [];
  for (const target of [...nexusDukePlayer(game, plan.captor).leaders]
    .sort((a, b) => a.strength - b.strength)) {
    const turn = game.turn;
    plan.bid = nexusDukePlayer(game, plan.owner).hand.some(isWeapon) ? 0 : 1;
    plan.capture = 'decline';
    plan.ship = {
      ...(carthagForces(game, plan.owner) ? {} : { [plan.owner]: { territory: 'carthag', amount: 1 } }),
      ...(carthagForces(game, plan.captor) ? {} : { [plan.captor]: { territory: 'carthag', amount: 1 } }),
    };
    game = advanceNexusDuke(game, (candidate) =>
      candidate.phase === 6 && nexusDukeClean(candidate) && !!candidate.active, plan, actions);
    plan.ship = {};
    plan.bid = 0;
    const weapon = nexusDukePlayer(game, plan.owner).hand.find(isWeapon);
    assert.ok(weapon, 'The real Bidding win must leave Ecaz holding a physical weapon.');
    assert.ok(carthagForces(game, plan.owner) > 0 && carthagForces(game, plan.captor) > 0,
      'Both original armies must really be present in the Battle territory.');
    const battle = openNexusDukeBattle(game, plan, actions,
      { territory: 'carthag', first: plan.owner, second: plan.captor });
    game = sealNexusDukeBattle(battle.game, plan, actions, [
      { actor: plan.owner, leader: strongest(living(game, plan.owner)).id, dial: 0, support: 0,
        weapon: weapon.id },
      { actor: plan.captor, leader: target.id, dial: 0, support: 0 },
    ]);
    game = advanceNexusDuke(game, (candidate) =>
      !candidate.battle && !candidate.decision && nexusDukeClean(candidate), plan, actions);
    assert.equal(nexusDukePlayer(game, plan.captor).leaders
      .find((leader) => leader.id === target.id)!.dead, true,
    `The real ${weapon.name} must kill the committed Harkonnen leader.`);
    deaths.push({ leader: target.id, weapon: weapon.id, turn });
    if (deaths.length < nexusDukePlayer(game, plan.captor).leaders.length) {
      game = advanceNexusDuke(game, (candidate) => candidate.turn > turn && candidate.phase === 1 &&
        nexusDukeClean(candidate), plan, actions);
      orderE3NexusEcazSpice(game);
    }
  }
  assert.deepEqual(living(game, plan.captor), [], 'Every native Harkonnen leader must really be dead.');
  assert.equal(game.dukeVidal!.leader.capturedBy, undefined,
    'The aftermath that killed the last native leader must return the captive.');
  return { game, deaths, returned: game, duke: structuredClone(game.dukeVidal!) };
}

/** Shared custody invariants: one shared disc, no fabricated roster/traitor
 * membership, conserved physical cards and forces. */
export function assertNexusDukeCustody(game: Game): void {
  for (const player of game.players) {
    assert.deepEqual(player.leaders.map((leader) => leader.id).sort(),
      leaders(player.faction).map((leader) => leader.id).sort(), `${player.faction} roster`);
    assert.ok(!player.leaders.some((leader) => leader.id === DUKE_VIDAL_ID),
      'The shared disc never joins a native roster.');
    assert.equal(player.reserves + player.tanks +
      Object.values(player.forces).reduce((sum, count) => sum + count, 0), 20, player.faction);
  }
  const traitors = [...(game.traitorReserve ?? []),
    ...game.players.flatMap((player) => [...player.traitors, ...player.traitorChoices]),
    ...(game.ecazLoyalty?.card ? [game.ecazLoyalty.card] : [])];
  assert.deepEqual(traitors.sort(), traitorDeck(game.players).sort());
  assert.ok(!traitors.includes(DUKE_VIDAL_ID), 'The shared disc has no Traitor identity.');
  const physical = [...game.deck, ...game.discard, ...game.players.flatMap((player) => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  assert.deepEqual(physical.map((card) => card.id).sort(), treacheryDeck(['ecaz']).map((card) => card.id).sort());
  assert.equal(game.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  assert.equal(game.dukeVidal!.leader.strength, 6);
  assert.equal(game.dukeVidal!.leader.faction, 'ecaz');
  assert.ok(!game.players.some((player) => player.leaders.some((leader) => leader.id === DUKE_VIDAL_ID)));
  if (game.ecazAmbassadors) validateAmbassadors(game.ecazAmbassadors);
}
