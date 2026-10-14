import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  type Action, type Game, type Player,
} from '../game/engine';
import { location, splitLocation, territory, validGameLocation } from '../game/board';
import { spiceDeck, treacheryDeck, type SpiceCard } from '../game/cards';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { DISCOVERY_SPICE_CARDS } from '../game/discoveries';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

/** One real native step: the actor is always the seat the engine expects. */
export type NexusFremenProtectionStep = { actor: string; action: Action };
export type NexusFremenProtectionFixture = {
  /** Fresh classic lobby and its genuine initialized, undealt setup. */
  initial: Game;
  afterSetup: Game;
  /** Turn-two Shai-Hulud Nexus before the real reciprocal alliance. */
  beforeNexus: Game;
  /** Real closing private-card opportunity for the two unallied seats. */
  beforeClosingDraw: Game;
  afterClosingDraw: Game;
  /** Turn-two Shipment and Movement turn of the unallied Nexus holder. */
  beforeShipment: Game;
  afterShipment: Game;
  /** Exact state before the native action that opens the boundary. */
  beforeWorm: Game;
  producer: NexusFremenProtectionStep;
  /** Genuine pre-destruction boundary: the frame is open, nothing is devoured. */
  game: Game;
  advanced: boolean;
  /** Unallied seat that really drew the physical Fremen Nexus card. */
  holder: string;
  /** Unallied seat that holds an irrelevant Nexus face. */
  neutral: string;
  /** The two seats that formed the real reciprocal alliance. */
  allies: [string, string];
  territory: string;
  sector: number;
  /** Where the holder's paid reserve force (and any advisor) stands. */
  location: string;
  /** The undealt land card the original worm draws after devouring. */
  replacement: string;
  actions: NexusFremenProtectionStep[];
  staging: string[];
  /** Raw JSON-safe facts for the parent's API and phone proof. */
  scenario: Record<string, unknown>;
};

export function nexusFremenProtectionPlayer(game: Game, id: string): Player {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `Missing original classic seat ${id}`);
  return player;
}
export const nexusFremenProtectionClean = (game: Game): boolean =>
  !game.phaseOpening && !game.response && !game.decision && !game.truthtrance &&
  !game.pendingTreacheryDiscard;

/** Scalar shuffle lotteries preserve printed order; UUID entropy stays native. */
function producerEntropy<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Original engine priority is settled before this fixture's own table choices:
 * responses, private decisions, sealed battle plans and the Nexus card
 * opportunity all run first. The fixture adds only two deterministic policies:
 * the acknowledgement answer, and declining a free intrusion or advisor battle
 * so no seat ever needs an invented sealed plan. */
export function nextNexusFremenProtectionNativeStep(game: Game): NexusFremenProtectionStep | null {
  if (game.status === 'finished') return null;
  if (game.phaseOpening || game.response || game.truthtrance || game.pendingTreacheryDiscard)
    return nextStrongholdFactionsNativeStep(game);
  const decision = game.decision;
  if (decision?.kind === 'nexusFremenProtection')
    return { actor: decision.player, action: {
      type: 'nexusFremenProtection', event: decision.event, use: false } };
  if (decision?.kind === 'advisor' || decision?.kind === 'intrusion' ||
    decision?.kind === 'advisorBattle')
    return { actor: decision.player, action: { type: 'decision', accept: false } };
  if (decision) return nextStrongholdFactionsNativeStep(game);
  const phase = game.nexusCards?.phase;
  if (phase?.stage === 'drawing') {
    const actor = phase.eligible.find(id => !phase.done.includes(id));
    assert.ok(actor, 'The Nexus draw window must retain an unfinished recipient');
    const held = game.nexusCards!.cards!.hands[actor];
    return { actor, action: { type: 'nexusCardChoice', turn: phase.turn, card: held,
      choice: held ? 'keep' : 'draw', ownRedraws: 0 } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function applyNexusFremenProtectionStep(game: Game, step: NexusFremenProtectionStep,
  actions?: NexusFremenProtectionStep[]): Game {
  actions?.push(structuredClone(step));
  return producerEntropy(() => applyAction(game, step.actor, step.action));
}
export function advanceNexusFremenProtection(game: Game, until: (game: Game) => boolean,
  actions?: NexusFremenProtectionStep[]): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original chronology ended early');
    const step = nextNexusFremenProtectionNativeStep(game);
    assert.ok(step, `The original continuation needs a sealed plan at ${game.status}/${game.turn}/${game.phase}`);
    game = applyNexusFremenProtectionStep(game, step, actions);
  }
  throw new Error('The original absent-Fremen chronology did not reach its boundary');
}

/** Physical census only: every original Treachery, Spice and Nexus card plus all
 * twenty physical force counters per seat; no module owner or face is assumed. */
export function nexusFremenProtectionInventory(game: Game): void {
  const treachery = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  assert.deepEqual(treachery.map(card => card.id).sort(),
    treacheryDeck(game.expansions).map(card => card.id).sort());
  assert.equal(new Set(treachery.map(card => card.id)).size, treachery.length);
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat(),
    ...(game.spiceSequence?.skipped ?? [])];
  const printedSpice = [...spiceDeck(), ...(game.discoveryEnabled
    ? [...DISCOVERY_SPICE_CARDS, { worm: true, greatMaker: true }] : [])];
  assert.deepEqual(spice.map(card => JSON.stringify(card)).sort(),
    printedSpice.map(card => JSON.stringify(card)).sort());
  assert.ok(game.nexusCards?.cards);
  validateNexusCards(game.nexusCards.cards, game.players);
  assert.deepEqual([...game.nexusCards.cards.deck, ...game.nexusCards.cards.discard,
    ...Object.values(game.nexusCards.cards.hands).filter(card => card !== null)].sort(),
  [...NEXUS_FACTIONS].sort());
  for (const player of game.players)
    assert.equal(player.reserves + player.tanks +
      Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
}
/** Public territory presence, including a concealed marker; physical groups stay in forces. */
export function nexusFremenProtectionPresence(game: Game, id: string, site: string): number {
  return Object.entries(nexusFremenProtectionPlayer(game, id).forces)
    .filter(([key]) => splitLocation(key).territory === site)
    .reduce((sum, [, amount]) => sum + amount, 0);
}

/** Only an original undealt physical Spice Card is moved to the front of the
 * physical deck; the census and the remaining printed order are untouched. */
function orderUndealtSpice(game: Game, front: readonly string[]): void {
  const take = (matches: (card: SpiceCard) => boolean): SpiceCard => {
    const index = game.spiceDeck.findIndex(matches);
    assert.ok(index >= 0, 'Only an original undealt physical Spice Card may be positioned');
    return game.spiceDeck.splice(index, 1)[0];
  };
  game.spiceDeck.unshift(...front.map(entry => entry === 'worm' || entry === 'greatMaker'
    ? take(card => 'worm' in card && !!card.greatMaker === (entry === 'greatMaker') &&
      !card.thumper && !card.suppressed)
    : take(card => 'territory' in card && card.territory === entry && !card.discovery)));
}
/** Only the original undealt Nexus deck is reordered; no hand is ever granted. */
function orderUndealtNexusCards(game: Game): void {
  const cards = game.nexusCards!.cards!;
  const front = ['fremen', 'beneGesserit'] as const;
  cards.deck = [...front, ...cards.deck.filter(card => !front.some(face => face === card))];
}

/** One fixed genuine Basic/Advanced absent-Fremen chronology with no candidate
 * retries: real setup, a real empty turn-two worm, the real reciprocal alliance
 * and closing draw that put the physical Fremen Nexus card into the unallied
 * holder's hand, a real paid reserve shipment into a real sand source, and the
 * next accepted real natural worm threatening exactly that group. Advanced adds
 * the native free accompanied Bene Gesserit advisor at the same sector. */
export function createNexusFremenProtectionFixture(
  options: { advanced?: boolean; greatMaker?: boolean } = {},
): NexusFremenProtectionFixture {
  const advanced = options.advanced ?? false;
  const holder = 'protection-emperor', neutral = 'protection-neutral';
  const allies: [string, string] = ['protection-guild', 'protection-atreides'];
  const target = 'hagga_basin', sector = 12, replacement = 'sihaya_ridge';
  const destination = location(target, sector);
  const actions: NexusFremenProtectionStep[] = [];
  const staging = [
    'Original scalar producer lotteries keep every printed shuffle order; native UUID entropy is untouched.',
    'Only the undealt physical Spice Deck is ordered: turn-one land, the real empty turn-two worm, the turn-two sand blow the group ships into, the next accepted real worm, then the replacement draw.',
    'Only the undealt physical Nexus Deck is ordered so the real closing draws give the unallied holder the physical Fremen card and the other unallied seat the physical Bene Gesserit card; no hand is assigned.',
    advanced
      ? 'Advanced retains the original storm-card producer after the first Storm; no card distance, storm sector or phase is assigned.'
      : 'Basic storm dialers choose the native minimum: zero on turn one and one on later turns. No storm sector or phase is assigned.',
    advanced
      ? 'The physically dealt Bene Gesserit seat documents the absent-Fremen case: it holds an irrelevant Nexus face and accepts the native free accompanied advisor arrival at the same sector.'
      : 'No Bene Gesserit is seated; the fourth seat is Harkonnen and holds an irrelevant Nexus face at no other location.',
  ];
  let game = createGame('NEXUSFREMENPROTECTION', newPlayer(holder, 'Emperor', 'emperor'), advanced);
  joinGame(game, newPlayer(allies[0], 'Guild', 'guild'));
  joinGame(game, newPlayer(allies[1], 'Atreides', 'atreides'));
  joinGame(game, newPlayer(neutral, advanced ? 'Bene Gesserit' : 'Harkonnen',
    advanced ? 'beneGesserit' : 'harkonnen'));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game.nexusCards = { cards: null, phase: null };
  if (options.greatMaker) game.discoveryEnabled = true;
  game = producerEntropy(() => initializeNexusGameForAudit(game));
  const threat = options.greatMaker ? 'greatMaker' : 'worm';
  orderUndealtSpice(game, advanced
    ? ['broken_land', 'rock_outcroppings', 'worm', target, 'south_mesa', threat, replacement, 'habbanya_erg']
    : ['broken_land', 'worm', target, threat, replacement]);
  orderUndealtNexusCards(game);
  const initial = structuredClone(game);
  game = advanceNexusFremenProtection(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  assert.ok(game.players.every(player => player.hand.length > 0 && player.traitors.length > 0),
    'The real setup must deal traitors and starting Treachery Cards');
  assert.ok(!game.players.some(player => player.faction === 'fremen'),
    'The native advantage must stay absent for this protection path');
  nexusFremenProtectionInventory(game);

  // Real turn-two Shai-Hulud appearance: an accepted natural worm opens the Nexus.
  game = advanceNexusFremenProtection(game, state => state.turn === 2 && state.phase === 1 &&
    state.nexus === true && !state.spiceWindow && nexusFremenProtectionClean(state), actions);
  const beforeNexus = structuredClone(game);
  assert.equal(game.nexusCards?.phase?.turn, 2);
  for (const [actor, partner] of [[allies[0], allies[1]], [allies[1], allies[0]]] as const)
    game = applyNexusFremenProtectionStep(game,
      { actor, action: { type: 'alliance', target: partner } }, actions);
  assert.equal(nexusFremenProtectionPlayer(game, allies[0]).ally, allies[1]);
  assert.equal(nexusFremenProtectionPlayer(game, allies[1]).ally, allies[0]);
  assert.equal(nexusFremenProtectionPlayer(game, holder).ally, null);
  assert.equal(nexusFremenProtectionPlayer(game, neutral).ally, null);

  // Real closing opportunity: both unallied seats choose from their own position.
  game = advanceNexusFremenProtection(game, state =>
    state.nexusCards?.phase?.stage === 'drawing' && nexusFremenProtectionClean(state), actions);
  const beforeClosingDraw = structuredClone(game);
  assert.deepEqual([...game.nexusCards!.phase!.eligible].sort(), [holder, neutral].sort());
  assert.ok(nexusFremenProtectionPlayer(game, holder).hand.length > 0,
    'The real setup must deal the holder a starting Treachery Card');
  game = advanceNexusFremenProtection(game,
    state => state.nexusCards?.phase?.stage === 'complete', actions);
  const afterClosingDraw = structuredClone(game);
  assert.equal(game.nexusCards!.cards!.hands[holder], 'fremen',
    'The real closing draw put the physical Fremen Nexus card into the unallied holder hand');
  assert.equal(game.nexusCards!.cards!.hands[neutral], 'beneGesserit');
  assert.ok(!game.nexusCards!.cards!.discard.includes('fremen'));

  // Real paid reserve shipment of one force into the sand source, followed in
  // Advanced by the native free accompanied advisor arrival (never a battle).
  game = advanceNexusFremenProtection(game, state => state.turn === 2 && state.phase === 5 &&
    state.active === holder && nexusFremenProtectionClean(state), actions);
  const beforeShipment = structuredClone(game);
  assert.equal(territory(target).type, 'sand');
  assert.ok(validGameLocation(game, target, sector));
  game = applyNexusFremenProtectionStep(game, { actor: holder, action: {
    type: 'ship', territory: target, sector, amount: 1, elite: 0, allyPayment: 0 } }, actions);
  if (advanced) {
    game = advanceNexusFremenProtection(game, state => !state.phaseOpening && !state.response &&
      state.decision?.kind === 'advisor' && state.decision.player === neutral &&
      state.decision.destination === destination, actions);
    game = applyNexusFremenProtectionStep(game, { actor: neutral, action: {
      type: 'decision', accept: true, accompany: true, sector, amount: 1 } }, actions);
  }
  game = advanceNexusFremenProtection(game, nexusFremenProtectionClean, actions);
  const afterShipment = structuredClone(game);
  const shipped = nexusFremenProtectionPlayer(game, holder);
  assert.equal(shipped.forces[destination], 1, 'The paid force must leave reserves for the sand source');
  assert.equal(shipped.reserves,
    nexusFremenProtectionPlayer(beforeShipment, holder).reserves - 1);
  assert.ok(shipped.spice < nexusFremenProtectionPlayer(beforeShipment, holder).spice,
    'The reserve shipment must be really paid from the holder’s own spice');
  assert.equal(nexusFremenProtectionPlayer(game, holder).ally, null);
  if (advanced) {
    const advisor = nexusFremenProtectionPlayer(game, neutral);
    assert.equal(advisor.forces[destination], 1);
    assert.ok(advisor.advisors?.[target], 'The native arrival is an advisor, not a fighter');
    assert.equal(advisor.reserves,
      nexusFremenProtectionPlayer(beforeShipment, neutral).reserves - 1);
    assert.equal(advisor.spice, nexusFremenProtectionPlayer(beforeShipment, neutral).spice);
  }

  // Retain the exact native action that opens the new pre-destruction window.
  let beforeWorm: Game | undefined, producer: NexusFremenProtectionStep | undefined;
  for (let count = 0; count < 1800 && !beforeWorm; count++) {
    const next = nextNexusFremenProtectionNativeStep(game);
    assert.ok(next, `The next accepted natural worm needs a native continuation at ${game.turn}/${game.phase}`);
    const before = structuredClone(game);
    game = applyNexusFremenProtectionStep(game, next, actions);
    if (game.decision?.kind === 'nexusFremenProtection') { beforeWorm = before; producer = next; }
    else assert.ok(game.turn <= 3, 'The next accepted natural worm must open the protection window');
  }
  assert.ok(beforeWorm && producer);
  const boundary = game.decision, frame = game.nexusFremenProtection;
  assert.ok(boundary?.kind === 'nexusFremenProtection', 'The real worm must open its protection decision');
  assert.ok(frame, 'The real worm must open its protection frame');
  assert.equal(game.turn, 3);
  assert.equal(game.phase, 1);
  if (options.greatMaker) assert.equal(game.greatMaker?.stage, 'worm');
  else assert.equal(game.nexus, true, 'The accepted natural worm keeps its actual Nexus occurrence');
  assert.equal(frame.territory, target);
  assert.equal(frame.origin, 'natural');
  assert.equal(frame.pile, 0);
  assert.equal(frame.protected, null);
  assert.equal(nexusFremenProtectionPlayer(game, holder).forces[destination], 1);
  assert.ok((game.spice[destination] ?? 0) > 0, 'Real collection must leave spice for the real worm to clear');
  assert.deepEqual(game.wormRides, []);
  assert.ok(!game.nexusFremenCunningOffer);
  nexusFremenProtectionInventory(game);
  const scenario = {
    code: game.code, advanced, turn: game.turn, phase: game.phase,
    event: boundary.event, territory: target, sector, location: destination,
    holder, neutral, allies,
    currentActor: boundary.player,
    queue: [...frame.order],
    nexusCard: 'fremen', neutralNexusCard: 'beneGesserit',
    origin: 'natural', pile: frame.pile,
    producer: structuredClone(producer),
    paid: nexusFremenProtectionPlayer(beforeShipment, holder).spice -
      nexusFremenProtectionPlayer(afterShipment, holder).spice,
    holdings: game.players.map(player => ({ id: player.id, faction: player.faction,
      ally: player.ally, spice: player.spice, reserves: player.reserves, tanks: player.tanks,
      forces: structuredClone(player.forces),
      advisors: structuredClone(player.advisors ?? {}),
      hand: player.hand.map(card => card.id) })),
    staging: [...staging],
    limitations: 'Fresh classic audit initializer plus an explicitly staged order of undealt physical cards and two native scalar lotteries; this is not a naturally shuffled or recovered played game, and every force, wallet, phase and alliance below arises from the real engine. The printed independent protection is provisional; no publisher answer is claimed.',
  };
  return { initial, afterSetup, beforeNexus, beforeClosingDraw, afterClosingDraw,
    beforeShipment, afterShipment, beforeWorm, producer, game, advanced, holder, neutral, allies,
    territory: target, sector, location: destination, replacement, actions, staging, scenario };
}
