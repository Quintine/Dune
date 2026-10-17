import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  type Action, type Game, type Player,
} from '../game/engine';
import { territory, validGameLocation } from '../game/board';
import { defaultVoiceMatch, VOICE_KINDS } from '../game/battle-cards';
import { treacheryDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { validateNexusCards } from '../game/nexus-cards';
import { shipmentAvailable } from '../game/shipment-opportunity';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

/** One real native step: the actor is always the seat the engine expects. */
export type NexusBorrowedVoiceStep = { actor: string; action: Action };
export type NexusBorrowedVoiceFixtureOptions = {
  /** Genuine Basic (default) or Advanced classic rules envelope. */
  advanced?: boolean;
  seatIds?: readonly [string, string, string, string];
};
export type NexusBorrowedVoiceFixture = {
  /** Fresh undealt classic lobby. */
  initial: Game;
  /** Genuine original Basic/Advanced setup with real deals and traitors. */
  afterSetup: Game;
  /** Turn-two Battle Phase before the chooser commits the real battle. */
  beforeBattle: Game;
  /** The real battle with the absent-Bene-Gesserit Nexus holder queued. */
  game: Game;
  advanced: boolean;
  /** Physical battle order: the neutral attacker is asked first, the holder second. */
  attackOrder: [string, string];
  /** Seated Atreides seat: the neutral aggressor and native Prescience owner. */
  atreides: string;
  /** Unallied combatant that drew the physical Bene Gesserit Nexus card. */
  holder: string;
  /** Allied seat that bought the real Karama card at the first auction. */
  canceler: string;
  /** The canceler's reciprocal Nexus alliance partner. */
  partner: string;
  cancelerCard: string;
  /** Physical card the holder drew from the Nexus deck. */
  nexusCard: FactionId;
  /** The command target for the holder's declaration: the other combatant. */
  target: string;
  /** A canonical category (not require-blocked by a module) the target's real hand cannot supply. */
  absentKind: string;
  /** The target's real printed card, used only to exercise original compliance. */
  targetCard: string;
  targetKind: string;
  actions: NexusBorrowedVoiceStep[];
  staging: string[];
  /** Raw JSON-safe scenario facts for the parent's throwaway API and phone smoke. */
  scenario: Record<string, unknown>;
};

export function nexusBorrowedVoicePlayer(game: Game, id: string): Player {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `Missing classic seat ${id}`);
  return player;
}
export const nexusBorrowedVoiceClean = (game: Game): boolean =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingGuildBetrayal;


/** Physical census of the original pieces; no module owner is assumed. */
export function nexusBorrowedVoiceInventory(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  assert.deepEqual(cards.map(card => card.id).sort(),
    treacheryDeck(game.expansions).map(card => card.id).sort(),
    'Only original Treachery cards may exist');
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  assert.ok(game.nexusCards?.cards, 'The Nexus inventory must exist');
  validateNexusCards(game.nexusCards.cards, game.players);
}

/** Scoped producer entropy: every original shuffle keeps its printed order, so
 * the real deal, real auction, real Nexus draw and real battle chronology stay
 * reproducible. Only genuine initializers and actions run inside this window. */
function identityRandom<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
const FACTION_NAMES: Partial<Record<FactionId, string>> = {
  atreides: 'Atreides', harkonnen: 'Harkonnen', guild: 'Guild', emperor: 'Emperor',
};

type Driver = {
  atreides: string;
  canceler: string;
  holder: string | null;
  territory: string;
  boughtKarama: boolean;
};

/** Original continuation plus the three table choices this fixture must make:
 * the first-auction bid, the closing Nexus draws and the battle chooser. */
function nextStep(game: Game, driver: Driver): NexusBorrowedVoiceStep | null {
  if (game.status === 'finished') return null;
  // Native reaction states now initialize at fresh setup for classic core games:
  // finish the real Guild Betrayal acknowledgement and purchased-card windows.
  const betrayal = game.pendingGuildBetrayal;
  if (betrayal) {
    const seat = betrayal.required.find(id => !betrayal.passed.includes(id));
    assert.ok(seat, 'The pending Guild Betrayal window must retain an unfinished responder');
    return { actor: seat, action: { type: 'guildBetrayalPass', event: betrayal.invoice.event } };
  }
  if (game.decision?.kind === 'nexusIxianReplacement')
    return { actor: game.decision.player,
      action: { type: 'nexusIxianReplacementPass', event: game.decision.event } };
  if (!nexusBorrowedVoiceClean(game)) return nextStrongholdFactionsNativeStep(game);
  // The closing Nexus card choice is private; the fixture draws the staged physical card.
  if (nexusBorrowedVoiceClean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const phase = game.nexusCards.phase, cards = game.nexusCards.cards!;
    const actor = phase.eligible.find(id => !phase.done.includes(id));
    if (actor) return { actor, action: {
      type: 'nexusCardChoice', turn: phase.turn, card: cards.hands[actor], choice: 'draw', ownRedraws: 0 } };
  }
  const auction = game.auction;
  if (game.turn === 1 && game.phase === 3 && auction && !driver.boughtKarama &&
    auction.index === 0 && auction.bid === 0 && auction.active === driver.canceler)
    return { actor: driver.canceler, action: { type: 'bid', amount: 1 } };
  if (game.turn === 2) {
    const holder = driver.holder, active = game.active;
    if (game.phase === 5 && !game.battle && holder && active &&
      [driver.atreides, holder].includes(active) &&
      shipmentAvailable(game, nexusBorrowedVoicePlayer(game, active))) {
      const sector = territory(driver.territory).sectors.find(candidate => candidate !== game.storm);
      assert.notEqual(sector, undefined, 'The battle territory must keep one non-storm sector');
      assert.ok(validGameLocation(game, driver.territory, sector!));
      return { actor: active, action: { type: 'ship', territory: driver.territory,
        sector: sector!, amount: 1, elite: 0, allyPayment: 0 } };
    }
    if (game.phase === 6 && !game.battle && holder && active === driver.atreides)
      return { actor: active, action: { type: 'chooseBattle',
        territory: driver.territory, target: holder } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
function step(game: Game, driver: Driver, actions?: NexusBorrowedVoiceStep[]): Game {
  const next = nextStep(game, driver);
  assert.ok(next, `Original continuation stopped before ${game.status}/${game.turn}/${game.phase}`);
  actions?.push(structuredClone(next));
  const after = applyAction(game, next.actor, next.action);
  if (!driver.boughtKarama)
    driver.boughtKarama = nexusBorrowedVoicePlayer(after, driver.canceler).hand
      .some(card => card.effect === 'karama');
  return after;
}
function advanceNexusBorrowedVoice(game: Game, until: (state: Game) => boolean,
  actions: NexusBorrowedVoiceStep[], driver: Driver): Game {
  for (let count = 0; count < 2600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = step(game, driver, actions);
  }
  throw Error('Original absent-Bene-Gesserit Nexus chronology did not reach its boundary');
}
/** Turn-pinned phase boundary; a turn change is an error, not a success. */
function advanceToPhase(game: Game, phase: number, driver: Driver,
  actions: NexusBorrowedVoiceStep[]): Game {
  const turn = game.turn;
  const reached = advanceNexusBorrowedVoice(game,
    state => state.turn === turn && state.phase >= phase && nexusBorrowedVoiceClean(state),
    actions, driver);
  assert.equal(reached.turn, turn, 'The requested phase belongs to the current turn');
  return reached;
}

/** One original undealt Karama singleton to the front of the physical Treachery
 * Deck; nothing is added, removed or replaced. */
function frontUndealtKarama(game: Game, staging: string[]): void {
  const index = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0, 'The original undealt Treachery Deck still holds a Karama singleton');
  const [card] = game.deck.splice(index, 1);
  game.deck.unshift(card);
  staging.push('Ordered one original undealt Treachery Karama singleton to the front of the first auction pool; it is bought for real spice, not assigned to a hand.');
}
/** Original undealt Shai-Hulud singleton to the front of the physical Spice
 * Deck; the real turn-two occurrence then opens the Nexus. */
function frontUndealtShaiHulud(game: Game, staging: string[]): void {
  const index = game.spiceDeck.findIndex(card =>
    'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
  assert.ok(index >= 0, 'The original undealt Spice Deck still holds a Shai-Hulud singleton');
  const [card] = game.spiceDeck.splice(index, 1);
  game.spiceDeck.unshift(card);
  staging.push('Ordered one original undealt Shai-Hulud Spice singleton to the front; the real turn-two occurrence opens the Nexus. Not a natural shuffle history.');
}

/** Genuine Basic/Advanced classic setup with Bene Gesserit absent from the table:
 * four seated base factions, online audit seam, offline determinism. */
function initialize(options: NexusBorrowedVoiceFixtureOptions, rotation: number): Game {
  const advanced = options.advanced ?? false;
  const ids = options.seatIds ?? ['nexus-atreides', 'nexus-holder', 'nexus-canceler', 'nexus-partner'];
  assert.equal(new Set(ids).size, 4, 'Four distinct seats are required');
  const factions: FactionId[] = ['atreides', 'harkonnen', 'guild', 'emperor'];
  const rotated = [...factions.slice(rotation), ...factions.slice(0, rotation)];
  let game = createGame('NEXUSBORROWEDVOICE', newPlayer(ids[0], FACTION_NAMES[rotated[0]]!, rotated[0]), advanced);
  for (let index = 1; index < 4; index++)
    joinGame(game, newPlayer(ids[index], FACTION_NAMES[rotated[index]]!, rotated[index]));
  assert.deepEqual(game.expansions, [], 'Only base Treachery and Nexus cards are admitted');
  assert.ok(game.players.every(player => player.faction !== 'beneGesserit'), 'Absent Bene Gesserit needs no seated Sisterhood');
  game.nexusCards ??= { cards: null, phase: null };
  for (const player of game.players) if (!player.ready)
    game = applyAction(game, player.id, { type: 'ready' });
  return game;
}

/** One original chronology with a fixed initial seat order. */
function buildNativeFixture(options: NexusBorrowedVoiceFixtureOptions, rotation: number): NexusBorrowedVoiceFixture {
  const actions: NexusBorrowedVoiceStep[] = [], staging: string[] = [];
  const lobby = initialize(options, rotation);
  const initial = structuredClone(lobby);
  let game = initializeNexusGameForAudit(lobby);
  const advanced = game.advanced;
  const atreides = game.players.find(player => player.faction === 'atreides')!.id;
  const canceler = game.players.find(player => player.faction !== 'atreides')!.id;
  const driver: Driver = { atreides, canceler, holder: null, territory: 'arrakeen', boughtKarama: false };

  // ---- Real setup: traitors, starting Treachery Cards and force placement.
  game = advanceNexusBorrowedVoice(game, state => state.status === 'playing', actions, driver);
  const afterSetup = structuredClone(game);
  assert.ok(game.players.every(player => player.traitors.length > 0 && player.hand.length > 0),
    'The real setup deals traitors and starting Treachery Cards');
  assert.equal(game.players.length, 4);
  nexusBorrowedVoiceInventory(game);

  // ---- Turn one, real Bidding: the canceler wins one real Karama for real spice.
  game = advanceToPhase(game, 2, driver, actions);
  frontUndealtKarama(game, staging);
  frontUndealtShaiHulud(game, staging);
  game = advanceNexusBorrowedVoice(game, state => nexusBorrowedVoiceClean(state) &&
    nexusBorrowedVoicePlayer(state, canceler).hand.some(card => card.effect === 'karama'), actions, driver);
  driver.boughtKarama = true;
  const cancelerCard = nexusBorrowedVoicePlayer(game, canceler).hand
    .find(card => card.effect === 'karama')!.id;
  staging.push('The real first auction sold that Karama to the allied seat for real spice; no hand, wallet or lot was written.');

  // ---- Turn one stays otherwise quiet, then the real turn-two Shai-Hulud Nexus.
  game = advanceToPhase(game, 8, driver, actions);
  game = advanceNexusBorrowedVoice(game,
    state => state.turn === 2 && state.nexus === true && !state.spiceWindow && nexusBorrowedVoiceClean(state),
    actions, driver);
  assert.equal(game.nexus, true, 'The real Shai-Hulud appearance opened the Nexus');

  // The turn-two physical order already includes the phase-zero storm move.
  const order = game.order;
  const later = order.filter(id => order.indexOf(id) > order.indexOf(atreides) && id !== canceler);
  assert.ok(later.length, 'The initial seat order must leave a later opposing combatant');
  const holder = later[0];
  const partner = game.players.map(player => player.id)
    .find(id => id !== atreides && id !== holder && id !== canceler)!;
  driver.holder = holder;
  assert.ok(!game.players.some(player => player.faction === 'beneGesserit'), 'The Sisterhood stays absent');
  const alliance: NexusBorrowedVoiceStep[] = [
    { actor: canceler, action: { type: 'alliance', target: partner } },
    { actor: partner, action: { type: 'alliance', target: canceler } },
  ];
  for (const entry of alliance) {
    actions.push(structuredClone(entry));
    game = applyAction(game, entry.actor, entry.action);
  }
  assert.equal(nexusBorrowedVoicePlayer(game, canceler).ally, partner);
  assert.equal(nexusBorrowedVoicePlayer(game, partner).ally, canceler);
  assert.equal(nexusBorrowedVoicePlayer(game, atreides).ally, null,
    'The native Atreides aggressor must stay unallied to draw');
  assert.equal(nexusBorrowedVoicePlayer(game, holder).ally, null,
    'The borrowed-Voice holder must stay unallied');
  staging.push('The two non-combatant seats formed the real reciprocal Nexus alliance; the two combatants stay unallied and the Sisterhood stays absent.');

  // ---- Real closing Nexus draw: both unallied combatants draw one physical card.
  game = advanceNexusBorrowedVoice(game,
    state => state.nexusCards?.phase?.stage === 'drawing' && nexusBorrowedVoiceClean(state),
    actions, driver);
  assert.equal(game.turn, 2);
  assert.equal(game.phase, 1);
  const phase = game.nexusCards!.phase!;
  assert.deepEqual([...phase.eligible].sort(), [atreides, holder].sort(),
    'Only the two unallied combatants may draw');
  assert.deepEqual(phase.done, []);
  const cards = game.nexusCards!.cards!;
  assert.equal(cards.hands[atreides], null, 'No Nexus hand is granted before the real draw');
  assert.equal(cards.hands[holder], null, 'No Nexus hand is granted before the real draw');
  const wanted: Record<string, FactionId> = { [atreides]: 'atreides', [holder]: 'beneGesserit' };
  const front = phase.eligible.map(id => wanted[id]);
  assert.equal(new Set(front).size, front.length);
  cards.deck = [...front, ...cards.deck.filter(card => !front.includes(card))];
  staging.push('Ordered the original undealt Nexus deck so the seated Atreides seat draws its own faction and the unallied combatant draws the physical Bene Gesserit card; conserved cards, no hand is granted.');
  game = advanceNexusBorrowedVoice(game,
    state => state.nexusCards?.phase?.stage === 'complete', actions, driver);
  assert.equal(game.nexusCards!.cards!.hands[atreides], 'atreides');
  assert.equal(game.nexusCards!.cards!.hands[holder], 'beneGesserit',
    'The real closing draw put the physical Bene Gesserit card in the unallied combatant hand');

  // ---- Turn-two Movement: both combatants pay for a real reserve shipment into Arrakeen.
  game = advanceNexusBorrowedVoice(game,
    state => state.turn === 2 && state.phase === 6 && !state.battle &&
      state.active === atreides && nexusBorrowedVoiceClean(state), actions, driver);
  const beforeBattle = structuredClone(game);
  const chooserAction: Action = { type: 'chooseBattle', territory: driver.territory, target: holder };
  actions.push({ actor: atreides, action: structuredClone(chooserAction) });
  game = applyAction(game, atreides, chooserAction);
  game = advanceNexusBorrowedVoice(game, nexusBorrowedVoiceClean, actions, driver);
  const battle = game.battle!;
  assert.equal(battle.attacker, atreides, 'The neutral Atreides seat stays the aggressor');
  assert.equal(battle.defender, holder);
  assert.equal(battle.territory, driver.territory);
  assert.ok(battle.prepared && !battle.revealed);
  assert.equal(battle.plans[atreides], undefined);
  assert.equal(battle.plans[holder], undefined);
  assert.equal(battle.voice, undefined, 'No Voice exists before the queue settles');

  const frame = game.battle?.nexusBorrowedVoice;
  assert.ok(frame, 'The battle must carry the absent-Bene-Gesserit borrowed-Voice queue');
  const target = nexusBorrowedVoicePlayer(game, atreides);
  const targetCard = target.hand.find(card => VOICE_KINDS.includes(card.kind) &&
    defaultVoiceMatch(card, card.kind));
  assert.ok(targetCard, 'The real Atreides deal must hold one canonical commandable card');
  const absentKind = VOICE_KINDS.find(kind => !['stoneBurner', 'mirrorWeapon'].includes(kind) &&
    !target.hand.some(card => defaultVoiceMatch(card, kind)));
  assert.ok(absentKind, 'A canonical category outside the target hand must remain declarable');

  const scenario = {
    code: game.code,
    advanced,
    turn: game.turn,
    phase: game.phase,
    event: battle.event,
    territory: battle.territory,
    attacker: battle.attacker,
    defender: battle.defender,
    queueEvent: frame.event,
    stage: frame.stage,
    order: frame.order,
    heldNexusCard: cards.hands[holder],
    nexusCard: 'beneGesserit',
    nexusDiscard: [...cards.discard],
    holder, atreides, canceler, partner,
    holderFaction: nexusBorrowedVoicePlayer(game, holder).faction,
    atreidesFaction: target.faction,
    cancelerCard,
    cancelerAllies: nexusBorrowedVoicePlayer(game, canceler).ally,
    command: { kind: targetCard.kind, must: true },
    commandCard: targetCard.id,
    impossibleKind: absentKind,
    forceCensus: game.players.map(player => ({ id: player.id, faction: player.faction,
      spice: player.spice, reserves: player.reserves, tanks: player.tanks,
      forces: player.forces, hand: player.hand.map(card => card.id) })),
    staging: [...staging],
  };
  assert.equal(game.nexusCards!.cards!.hands[holder], 'beneGesserit',
    'The Nexus card stays in hand until a real declaration spends it');
  nexusBorrowedVoiceInventory(game);
  return {
    initial, afterSetup, beforeBattle, game, advanced,
    attackOrder: [battle.attacker, battle.defender],
    atreides, holder, canceler, partner, cancelerCard,
    nexusCard: 'beneGesserit', target: atreides, absentKind,
    targetCard: targetCard.id, targetKind: targetCard.kind,
    actions, staging, scenario,
  };
}

/** Genuine Basic/Advanced absent-Bene-Gesserit chronology: four real base
 * seats, a real first-auction Karama purchase, the real turn-two Shai-Hulud
 * Nexus with its real reciprocal alliance and closing draws, two real paid
 * reserve shipments, and the real battle chooser. No hand, wallet, board
 * counter, phase, plan, frame or death is written by the fixture. */
export function createNexusBorrowedVoiceFixture(
  options: NexusBorrowedVoiceFixtureOptions = {},
): NexusBorrowedVoiceFixture {
  return identityRandom(() => buildNativeFixture(options, 2));
}
