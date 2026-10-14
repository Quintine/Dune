import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSpiceBankerIncomeGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { territory } from '../game/board';
import type { FactionId } from '../game/catalog';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import type { OccupiedPercentageReceipt } from '../game/homeworld-occupied-percentage';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { quoteStableHomeworldOccupation } from '../game/homeworld-stable-occupation';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { assertClassicHomeworldSkillsCustody } from './fixture-homeworld-classic-skills';
import { nextSpiceBankerIncomeNativeStep, type SpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type HomeworldBankerStep = SpiceBankerIncomeNativeStep;
export type HomeworldBankerOptions = {
  /** Real Bene Gesserit invasion of the emptied Junction before the invoice. */
  occupied?: boolean;
  /** The odd eleven-spice invoice onto the genuinely vacated Tuek's Sietch. */
  stronghold?: boolean;
  /** Declared primary payer share; the pledged ally funds the remaining invoice. */
  payerShare?: number;
};
export type HomeworldBankerFixture = {
  /** Admitted fresh setup before any setup choice: the original stock census. */
  initial: Game;
  /** Genuine all-fourteen Skills setup completed by real setup selections. */
  setup: Game;
  /** After the real four-spice prep invoice reached the native Guild. */
  prepaid: Game;
  /** After the native Guild's own fifteen-force tariff left Junction empty. */
  junctionEmpty: Game;
  /** After the Guild's real movement vacated Tuek's Sietch. */
  vacated: Game;
  /** After the real foreign invasion of Junction, or null when unoccupied. */
  occupied: Game | null;
  /** After the real reciprocal alliance at the later worm nexus. */
  alliance: Game;
  /** The payer's original Movement turn, before the ally's real pledge. */
  beforePledge: Game;
  /** After the ally's real pledge; the invoice itself is not yet declared. */
  beforeAction: Game;
  game: Game;
  payer: string;
  ally: string;
  payee: string;
  occupier: string | null;
  /** Spice Banker owner and its living native trainer leader. */
  trainer: string;
  leader: string;
  /** Separate Bureaucrat owner. */
  bureaucrat: string;
  prepPayer: string;
  /** Original declared invoice contributions in primary/ally order. */
  contributions: { payer: string; amount: number }[];
  payerShare: number;
  allyShare: number;
  gross: number;
  action: Action;
  target: string;
  sector: number;
  /** Adjacent desert sector the Guild’s real movement used to vacate Tuek’s Sietch. */
  vacateSector: number;
  prepReceipt: OccupiedPercentageReceipt;
  /** Original Karama custody staged for a cancellation path. */
  held: string[];
  physical: string[];
  staging: string[];
  actions: HomeworldBankerStep[];
};

/** Original seats in join order: the player circles follow the storm, so this
 * order decides which faction acts first in each real phase sequence. */
const SEATS: readonly FactionId[] = ['atreides', 'guild', 'beneGesserit', 'emperor', 'harkonnen', 'fremen'];
/** One original skill per real offer; the first is the Banker, the last Bureaucrat. */
const REQUESTED_SKILLS: readonly LeaderSkillId[] = ['spice-banker', 'mentat', 'smuggler',
  'swordmaster-of-ginaz', 'master-of-assassins', 'bureaucrat'];

export const homeworldBankerPlayer = (game: Game, id: string): Player => {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `Missing original seat ${id}`);
  return player;
};
export const homeworldBankerClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.pendingTreacheryDiscard;
export const homeworldBankerWallets = (game: Game) =>
  Object.fromEntries(game.players.map(player => [player.id, player.spice]));
export const homeworldBankerCards = (game: Game) =>
  [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
export const homeworldBankerGroup = (game: Game, actor: string): string => {
  const groups = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  const group = groups.find(candidate => candidate.native === actor && !candidate.secondary);
  assert.ok(group, `No original homeworld custody group for ${actor}`);
  return group.id;
};
export const homeworldBankerSector = (game: Game, target: string): number => {
  const sector = territory(target).sectors.find(candidate => candidate !== game.storm);
  assert.ok(sector !== undefined, `The ${target} shipment needs a printed sector outside the current storm`);
  return sector;
};

/** Genuine ordinary reserve shipment out of a faction's own Homeworld reserves
 * into an empty printed board location. The Banker profile allows only the
 * original native payment fields, so the withdrawal keeps its default own-home
 * allocation and no force, wallet, phase or receipt was assigned. */
export function homeworldBankerShipment(game: Game, actor: string, target: string,
  amount: number, allyPayment = 0): Action {
  assert.ok(game.players.every(player => !Object.keys(player.forces).some(key => key.startsWith(`${target}:`))),
    `The ${target} target must be genuinely empty before the real shipment`);
  assert.ok(homeworldBankerPlayer(game, actor).reserves >= amount,
    `${actor} must hold ${amount} Homeworld reserve counters for this shipment`);
  return { type: 'ship', territory: target, sector: homeworldBankerSector(game, target), amount, elite: 0, allyPayment };
}

function byFactionId(game: Game, faction: FactionId): string {
  const player = game.players.find(candidate => candidate.faction === faction);
  assert.ok(player, `Missing original ${faction} seat`);
  return player.id;
}

/** Only conserved, original unplayed Spice order is controlled. */
function orderSpice(game: Game, kinds: ('land' | 'worm')[]): void {
  for (const [position, kind] of kinds.entries()) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position &&
      (kind === 'worm' ? 'worm' in card : 'territory' in card));
    assert.ok(index >= position, `The original unplayed Spice deck has no ${kind} card left.`);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
}

/** A physical custody swap retains both cards and the original hand size. */
function holdKarama(game: Game, actor: string, staging: string[]): string {
  const player = homeworldBankerPlayer(game, actor);
  const held = player.hand.find(card => card.effect === 'karama');
  if (held) return held.id;
  const index = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0 && player.hand.length, 'A genuine original Karama must remain for this cancellation path.');
  const card = game.deck[index], outgoing = player.hand[0];
  game.deck[index] = outgoing;
  player.hand[0] = card;
  staging.push(`Conserved original Karama custody: ${card.id} from the remaining deck to ${actor}'s hand, ${outgoing.id} to the deck; hand size unchanged.`);
  return card.id;
}

/** Actual Fisher-Yates draws for the original skill deck, not an assignment. */
function permutationDraws<T>(source: readonly T[], desired: readonly T[]): number[] {
  const current = [...source], draws: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    draws.push(Math.floor(((j + 0.5) / (i + 1)) * 4294967296));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired);
  return draws;
}
function originalLottery<T>(draws: readonly number[], run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let index = 0;
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

/** Deterministic original entropy for one fixture programme. The native code
 * still draws and shuffles every component, but the Advanced storm card and the
 * later phase order stay reproducible instead of varying with host entropy. */
export function withHomeworldBankerEntropy<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array) array.fill(0xffffffff);
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Fresh classic Advanced Homeworld admission through the real Banker
 * initializer. Only the original all-fourteen skill shuffle is controlled; the
 * decks, hands, offers, traitors and native custody stay original. */
function admitHomeworldBankerGame(): Game {
  let game = createGame('HOMEWORLDBANKER', newPlayer(SEATS[0], 'Banker', SEATS[0]), true);
  for (const faction of SEATS.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  const canonical = LEADER_SKILL_CARDS.map(card => card.id);
  const rest = canonical.filter(id => !REQUESTED_SKILLS.includes(id));
  const desired = REQUESTED_SKILLS.flatMap(id => [id, rest.shift()!]).concat(rest);
  return originalLottery(permutationDraws(canonical, desired), () => initializeSpiceBankerIncomeGameForAudit(game));
}

/** Genuine setup selections: each requested skill is chosen from its real
 * private offer, and traitors and the Fremen star placement are real actions. */
function completeHomeworldBankerSetup(state: Game, actions: HomeworldBankerStep[]): Game {
  let game = state;
  for (let step = 0; game.status === 'setup' && step < 200; step++) {
    let next: HomeworldBankerStep | null;
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const skill = REQUESTED_SKILLS[game.players.findIndex(player => player.id === actor)];
      assert.ok(skill, `No requested skill is mapped to the real offer seat ${actor}.`);
      assert.ok(offer.cards.includes(skill) && !view.unavailableSkills?.[skill],
        `The original offer for ${actor} must include the requested ${skill}.`);
      const leaders = view.eligibleLeaders
        .map(eligible => homeworldBankerPlayer(game, actor).leaders.find(disc => disc.id === eligible.id)!)
        .sort((a, b) => b.strength - a.strength);
      assert.ok(leaders[0]);
      next = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leaders[0].id } };
    } else if (game.setupStage === 'traitors' && !game.decision) {
      const player = game.players.find(candidate => candidate.traitorChoices.length);
      assert.ok(player);
      next = { actor: player.id, action: { type: 'traitor', leader: player.traitorChoices[0] } };
    } else if (game.setupStage === 'forces' && homeworldBankerPlayer(game, byFactionId(game, 'fremen')).reserves === 20) {
      const sector = territory('sietch_tabr').sectors[0];
      next = { actor: byFactionId(game, 'fremen'),
        action: { type: 'fremenSetup', placements: { [`sietch_tabr:${sector}`]: 10 } } };
    } else next = nextSpiceBankerIncomeNativeStep(game);
    assert.ok(next, `The original setup stalled at ${game.setupStage}/${game.decision?.kind}`);
    actions.push(structuredClone(next));
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.status, 'playing');
  return game;
}

/** The homeworld decisions first, then the shared Banker native stepper; a
 * required human Battle Plan still stops the programme instead of inventing one. */
function nextHomeworldBankerStep(game: Game): HomeworldBankerStep | null {
  const decision = game.decision;
  if (decision?.kind === 'guildTiming')
    return { actor: decision.player, action: { type: 'decision', take: true } };
  if (decision?.kind === 'homeworldShipmentGuild')
    return { actor: decision.player, action: { type: 'decision', event: decision.event, allow: true } };
  if (decision?.kind === 'homeworldOccupiedIncome') {
    const offer = viewGame(game, decision.player).homeworldOccupiedIncome!;
    return { actor: decision.player, action: { type: 'decision', event: decision.event,
      world: decision.world, ownAmount: offer.maxOwnAmount } };
  }
  if (decision?.kind === 'homeworldOccupiedPercentage') {
    const offer = viewGame(game, decision.player).homeworldOccupiedPercentage!;
    return { actor: decision.player, action: { type: 'decision', event: decision.event,
      ownAmount: offer.maxOwnAmount } };
  }
  return nextSpiceBankerIncomeNativeStep(game);
}

export function advanceHomeworldBanker(state: Game, until: (game: Game) => boolean,
  actions?: HomeworldBankerStep[]): Game {
  return withHomeworldBankerEntropy(() => advanceHomeworldBankerUnder(state, until, actions));
}
function advanceHomeworldBankerUnder(state: Game, until: (game: Game) => boolean,
  actions?: HomeworldBankerStep[]): Game {
  let game = state;
  for (let step = 0; !until(game) && step < 2000; step++) {
    assert.notEqual(game.status, 'finished', 'The native Homeworld programme ended early.');
    const next = nextHomeworldBankerStep(game);
    assert.ok(next, `A real human Battle Plan or Suk choice is required at ${game.turn}/${game.phase}`);
    actions?.push(structuredClone(next));
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(until(game), 'The native Homeworld programme did not reach its requested boundary.');
  return game;
}

/** Real classic Homeworld Banker runtime: genuine setup, the native Guild's own
 * emptied Junction, an optional real invasion, a real worm/alliance and one
 * declared foreign invoice. Only the controlled skill shuffle, the original
 * unplayed Spice order and later conserved Karama custody are staged. */
export function createHomeworldBankerFixture(options: HomeworldBankerOptions = {}): HomeworldBankerFixture {
  const occupied = options.occupied ?? false;
  const stronghold = options.stronghold ?? false;
  const gross = stronghold ? 11 : 8;
  const payerShare = options.payerShare ?? 5;
  const allyShare = gross - payerShare;
  assert.ok(payerShare >= 1 && allyShare >= 1, 'The invoice needs a positive primary and pledged share.');
  const staging: string[] = [], actions: HomeworldBankerStep[] = [];
  let game = admitHomeworldBankerGame();
  const initial = structuredClone(game);
  staging.push('Fresh classic Advanced Homeworld lobby admitted once through the real Spice Banker initializer; only the original all-fourteen skill shuffle is controlled.');
  game = completeHomeworldBankerSetup(game, actions);
  const setup = structuredClone(game);
  assertClassicHomeworldSkillsCustody(setup);
  const payee = byFactionId(game, 'guild'), prepPayer = byFactionId(game, 'atreides');
  const payer = byFactionId(game, 'emperor'), ally = byFactionId(game, 'harkonnen');
  const occupier = occupied ? byFactionId(game, 'beneGesserit') : null;
  const banker = setup.leaderSkills!.assignments.find(assignment => assignment.skill === 'spice-banker');
  const bureaucrat = setup.leaderSkills!.assignments.find(assignment => assignment.skill === 'bureaucrat');
  assert.ok(banker && bureaucrat);
  assert.equal(banker.owner, prepPayer, 'The Banker trainer takes the first real offer.');
  assert.equal(bureaucrat.owner, byFactionId(game, 'fremen'), 'A separate nonpayer owns Bureaucrat.');
  // One real four-spice shipment income funds the native Guild's own tariff.
  orderSpice(game, ['land', 'land']);
  game = advanceHomeworldBanker(game, state => state.turn === 1 && state.phase === 5 &&
    state.active === prepPayer && homeworldBankerClean(state), actions);
  const guildOpening = homeworldBankerPlayer(game, payee).spice;
  const prep = homeworldBankerShipment(game, prepPayer, 'polar_sink', 2);
  actions.push({ actor: prepPayer, action: structuredClone(prep) });
  game = advanceHomeworldBanker(applyAction(game, prepPayer, prep), homeworldBankerClean, actions);
  assert.equal(homeworldBankerPlayer(game, payee).spice, guildOpening + 4,
    'One real four-spice shipment invoice reaches the native Guild at high population.');
  const prepaid = structuredClone(game);
  const prepReceipt = prepaid.homeworldOccupiedPercentageLedger!.receipts.at(-1)!;
  assert.equal(prepReceipt.source.kind, 'guild-shipping');
  assert.equal(prepReceipt.source.native, payee);
  assert.equal(prepReceipt.source.amount, 4, 'The prep invoice receipt keeps its original paid amount.');
  assert.equal(prepReceipt.bankRetained, 0, 'A high-population invoice leaves no Bank remainder.');
  // A later real worm opens the nexus, and a real reciprocal alliance funds it.
  game = advanceHomeworldBanker(game, state => state.turn === 2 && state.phase === 1 &&
    homeworldBankerClean(state) && !state.nexus && !state.spiceWindow && !state.spiceResolution, actions);
  orderSpice(game, ['worm', 'land', 'land']);
  game = advanceHomeworldBanker(game, state => !!state.nexus && !state.spiceWindow &&
    !state.spiceResolution && homeworldBankerClean(state), actions);
  for (const [actor, target] of [[payer, ally], [ally, payer]] as const) {
    const alliance: HomeworldBankerStep = { actor, action: { type: 'alliance', target } };
    actions.push(alliance);
    game = applyAction(game, actor, alliance.action);
  }
  assert.equal(homeworldBankerPlayer(game, payer).ally, ally);
  assert.equal(homeworldBankerPlayer(game, ally).ally, payer);
  const alliance = structuredClone(game);
  // The native Guild's own later fifteen-force tariff empties Junction.
  game = advanceHomeworldBanker(game, state => state.turn === 2 && state.phase === 5 &&
    state.active === payee && homeworldBankerClean(state), actions);
  const guildBeforeTariff = homeworldBankerPlayer(game, payee).spice;
  const tariff = homeworldBankerShipment(game, payee, 'habbanya_ridge_sietch', 15);
  actions.push({ actor: payee, action: structuredClone(tariff) });
  game = advanceHomeworldBanker(applyAction(game, payee, tariff), homeworldBankerClean, actions);
  assert.equal(homeworldBankerPlayer(game, payee).spice, guildBeforeTariff - 8, 'The native tariff is paid once.');
  assert.equal(homeworldBankerPlayer(game, payee).reserves, 0, 'Junction is physically empty.');
  const junctionEmpty = structuredClone(game);
  assert.equal(quoteStableHomeworldOccupation(game, 'junction').entitlement, null);
  // Real movement retains the original Tuek's Sietch five in an adjacent desert.
  const tuekKey = `tueks_sietch:${territory('tueks_sietch').sectors[0]}`;
  const tuek = homeworldBankerPlayer(game, payee).forces[tuekKey] ?? 0;
  assert.equal(tuek, 5, 'The classic Guild start keeps five forces at Tuek’s Sietch.');
  const vacateSector = territory('pasty_mesa').sectors.find(sector =>
    territory('tueks_sietch').sectors.includes(sector) && sector !== game.storm);
  assert.ok(vacateSector !== undefined);
  const vacate: Action = { type: 'move', from: tuekKey, amount: tuek, elite: 0,
    territory: 'pasty_mesa', sector: vacateSector };
  actions.push({ actor: payee, action: structuredClone(vacate) });
  game = advanceHomeworldBanker(applyAction(game, payee, vacate), homeworldBankerClean, actions);
  assert.ok(game.players.every(player => !Object.keys(player.forces).some(key => key.startsWith('tueks_sietch'))),
    'The real movement genuinely vacates Tuek’s Sietch.');
  assert.equal(homeworldBankerPlayer(game, payee).forces[`pasty_mesa:${vacateSector}`], tuek);
  const vacated = structuredClone(game);
  // The real foreign homeworld invasion of the emptied Junction.
  let occupiedState: Game | null = null;
  if (occupier) {
    game = advanceHomeworldBanker(game, state => state.turn === 2 && state.phase === 5 &&
      state.active === occupier && homeworldBankerClean(state), actions);
    const invasion = homeworldShipmentChoice(viewGame(game, occupier), 'homeworld:guild',
      { [homeworldBankerGroup(game, occupier)]: { normal: 1, elite: 0 } });
    assert.ok(invasion.action, invasion.blocked ?? undefined);
    actions.push({ actor: occupier, action: structuredClone(invasion.action) });
    game = advanceHomeworldBanker(applyAction(game, occupier, invasion.action), homeworldBankerClean, actions);
    const authority = quoteStableHomeworldOccupation(game, 'junction');
    assert.equal(authority.blocked, null);
    assert.equal(authority.entitlement?.occupier, occupier);
    assert.ok(game.homeworldOccupationHistory!.sources.some(source =>
      source.event === authority.entitlement!.qualification && source.cause !== 'setup'));
    occupiedState = structuredClone(game);
  }
  // The payer's own later Movement turn, in a fresh phase: the ally pledges and
  // then the real invoice, so no earlier Banker grant shares this phase stamp.
  game = advanceHomeworldBanker(game, state => state.turn === 3 && state.phase === 5 &&
    state.active === payer && homeworldBankerClean(state), actions);
  const beforePledge = structuredClone(game);
  const pledge: HomeworldBankerStep = { actor: ally, action: { type: 'pledgeAid', amount: allyShare } };
  actions.push(pledge);
  game = applyAction(game, ally, pledge.action);
  const beforeAction = structuredClone(game);
  const target = stronghold ? 'tueks_sietch' : 'arsunt';
  const sector = homeworldBankerSector(game, target);
  const action = homeworldBankerShipment(game, payer, target, stronghold ? gross : gross / 2, allyShare);
  assertClassicHomeworldSkillsCustody(game);
  return { initial, setup, prepaid, junctionEmpty, vacated, occupied: occupiedState, alliance,
    beforePledge, beforeAction, game, payer, ally, payee, occupier, trainer: banker.owner,
    leader: banker.leader, bureaucrat: bureaucrat.owner, prepPayer,
    contributions: [{ payer, amount: payerShare }, { payer: ally, amount: allyShare }],
    payerShare, allyShare, gross, action, target, sector, vacateSector, prepReceipt, held: [],
    physical: homeworldBankerCards(game), staging, actions };
}

/** The original declaration debits the payer and the pledged ally once. */
export function declareHomeworldBankerInvoice(f: HomeworldBankerFixture, state = f.game): Game {
  let game = applyAction(state, f.payer, f.action);
  if (game.decision?.kind === 'guildShipment')
    game = applyAction(game, game.decision.player, { type: 'decision', allow: true });
  return game;
}
/** Walk only the real persisted pass queue. */
export function allowHomeworldBankerIncome(state: Game): Game {
  let game = state;
  for (let step = 0; game.response && step < 60; step++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id));
    assert.ok(actor, 'The original response queue must keep a legal responder');
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}
export function chooseHomeworldBankerBureaucrat(game: Game, redirect: boolean): Game {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(game, game.decision!.player,
    { type: 'decision', event: game.bureaucratPaymentEvent, redirect });
}
export function allocateHomeworldBankerPercentage(game: Game, ownAmount?: number): Game {
  assert.equal(game.decision?.kind, 'homeworldOccupiedPercentage');
  const offer = viewGame(game, game.decision!.player).homeworldOccupiedPercentage!;
  return allowHomeworldBankerIncome(applyAction(game, game.decision!.player,
    { type: 'decision', event: offer.event, ownAmount: ownAmount ?? offer.maxOwnAmount }));
}
/** Consume the real Bene Gesserit advisor follow-up that an off-planet arrival
 * opens; it is part of the shipment, not of the invoice's own settlement. */
export function resolveHomeworldBankerFollowups(state: Game): Game {
  let game = state;
  for (let step = 0; game.decision?.kind === 'advisor' && step < 8; step++)
    game = advanceHomeworldBanker(game, current => current.decision?.kind !== 'advisor');
  return game;
}
/** Original responses, the optional private Bureaucrat choice and then the real
 * occupied percentage allocation by the occupant. */
export function settleHomeworldBankerInvoice(f: HomeworldBankerFixture,
  state = f.game, redirect = false): Game {
  let game = allowHomeworldBankerIncome(state);
  if (game.decision?.kind === 'bureaucratPayment') game = chooseHomeworldBankerBureaucrat(game, redirect);
  if (game.decision?.kind === 'homeworldOccupiedPercentage') {
    assert.equal(game.decision.player, f.occupier, 'Only the real occupant allocates this percentage.');
    game = allocateHomeworldBankerPercentage(game);
  }
  return resolveHomeworldBankerFollowups(game);
}
/** The original cancellation response, with the Banker owner's Karama held. Any
 * advisor follow-up that the real arrival opened resolves through the stepper. */
export function cancelHomeworldBankerIncome(f: HomeworldBankerFixture, state: Game): Game {
  assert.equal(state.response?.kind, 'guildIncome');
  const card = f.held.at(-1);
  assert.ok(card, 'A conserved original Karama must be held before cancelling.');
  assert.ok(viewGame(state, f.trainer).responseControls?.cancelCards.includes(card));
  const canceled = applyAction(state, f.trainer, { type: 'card', mode: 'cancel', card });
  return canceled.decision?.kind === 'homeworldOccupiedPercentage' ? canceled
    : resolveHomeworldBankerFollowups(canceled);
}
/** Conserved original Karama custody for either cancellation path. */
export function holdHomeworldBankerKarama(f: HomeworldBankerFixture): string {
  const card = holdKarama(f.game, f.trainer, f.staging);
  f.held.push(card);
  assert.deepEqual(homeworldBankerCards(f.game), f.physical);
  assertClassicHomeworldSkillsCustody(f.game);
  return card;
}
