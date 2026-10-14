import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  type Action, type Game, type Player,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { location, territory, validGameLocation } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { validateNexusCards } from '../game/nexus-cards';
import { tleilaxuSecretAllyEvent, tleilaxuSecretAllyOptions } from '../game/nexus-tleilaxu-revival';
import { shipmentAvailable } from '../game/shipment-opportunity';
import { traitorDeck } from '../game/traitors';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

/** One real native step: the actor is always the seat the engine expects. */
export type NexusTleilaxuSecretAllyStep = { actor: string; action: Action };
export type NexusTleilaxuSecretAllyFixtureOptions = {
  /** Only an original undealt classic lobby, or omit for a fresh Atreides/Guild/Emperor table. */
  initial?: Game;
  advanced?: boolean;
  seatIds?: readonly [string, string, string];
};
export type NexusTleilaxuSecretAllyDeadLeader = { id: string; name: string; deaths: number };
export type NexusTleilaxuSecretAllyFixture = {
  initial: Game;
  afterSetup: Game;
  beforeShipment: Game;
  shipment: NexusTleilaxuSecretAllyStep;
  beforeBattle: Game;
  battleActions: NexusTleilaxuSecretAllyStep[];
  afterBattle: Game;
  beforeBlow: Game;
  beforeDraw: Game;
  draw: NexusTleilaxuSecretAllyStep;
  afterDraw: Game;
  /** Quiet turn-two Revival with the physical Tleilaxu card held by an unallied owner. */
  game: Game;
  owner: string;
  opponent: string;
  partner: string;
  ownerFaction: FactionId;
  deadLeader: NexusTleilaxuSecretAllyDeadLeader;
  nexusEvent: string;
  actions: NexusTleilaxuSecretAllyStep[];
  staging: string[];
  /** Raw JSON-safe scenario facts for the parent's throwaway API and phone smoke. */
  scenario: Record<string, unknown>;
};
export function nexusTleilaxuSecretAllyPlayer(game: Game, id: string): Player {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `Missing classic seat ${id}`);
  return player;
}
export const nexusTleilaxuSecretAllyClean = (game: Game): boolean =>
  !game.phaseOpening && !game.response && !game.decision;

/** Scoped producer entropy: every original shuffle keeps its printed order, so
 * the real deal, real draws and real battle chronology stay reproducible. Only
 * the initializer and genuine actions run inside this window. */
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

/** The closing Nexus draw is a private table choice, so the shared native
 * continuation stops there instead of drawing a card for a seat. */
export function nextNexusTleilaxuSecretAllyNativeStep(
  game: Game,
): NexusTleilaxuSecretAllyStep | null {
  if (game.nexusCards?.phase?.stage === 'drawing' && nexusTleilaxuSecretAllyClean(game)) return null;
  return nextStrongholdFactionsNativeStep(game);
}
export function stepNexusTleilaxuSecretAlly(
  game: Game,
  actions?: NexusTleilaxuSecretAllyStep[],
): Game {
  const next = nextNexusTleilaxuSecretAllyNativeStep(game);
  assert.ok(next, `Original continuation stopped before ${game.status}/${game.turn}/${game.phase}`);
  actions?.push(structuredClone(next));
  return applyAction(game, next.actor, next.action);
}
export function advanceNexusTleilaxuSecretAlly(
  game: Game,
  until: (state: Game) => boolean,
  actions?: NexusTleilaxuSecretAllyStep[],
): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = stepNexusTleilaxuSecretAlly(game, actions);
  }
  throw Error('Original absent-Tleilaxu Nexus chronology did not reach its boundary');
}
/** Turn-pinned phase boundary; a turn change is an error, not a success. */
export function advanceNexusTleilaxuSecretAllyToPhase(
  game: Game,
  phase: number,
  actions?: NexusTleilaxuSecretAllyStep[],
): Game {
  const turn = game.turn;
  const reached = advanceNexusTleilaxuSecretAlly(game,
    state => state.turn === turn && state.phase >= phase && nexusTleilaxuSecretAllyClean(state),
    actions);
  assert.equal(reached.turn, turn, 'The requested phase belongs to the current turn');
  return reached;
}

/** Original undealt Shai-Hulud singleton to the front of the physical Spice Deck;
 * nothing is added, removed or replaced. */
function frontUndealtShaiHulud(game: Game, staging: string[]): void {
  const index = game.spiceDeck.findIndex(card =>
    'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
  assert.ok(index >= 0, 'The original undealt Spice Deck still holds a Shai-Hulud singleton');
  const [card] = game.spiceDeck.splice(index, 1);
  game.spiceDeck.unshift(card);
  staging.push('Ordered one original undealt Shai-Hulud Spice singleton to the front; not a natural shuffle history.');
}

/** Fresh classic Nexus admission only: base seats, no expansions, offline audit seam. */
export function initializeNexusTleilaxuSecretAllySetup(
  options: NexusTleilaxuSecretAllyFixtureOptions = {},
): Game {
  const advanced = options.advanced ?? false;
  if (options.initial) {
    let supplied = structuredClone(options.initial);
    assert.equal(supplied.status, 'lobby');
    assert.equal(supplied.advanced, advanced);
    assert.equal(supplied.turn, 1);
    assert.equal(supplied.phase, 0);
    assert.ok(!supplied.setupStage);
    assert.deepEqual([...supplied.expansions], []);
    assert.equal(supplied.players.length, 3);
    assert.ok(supplied.players.every(player => player.reserves === 20 && player.tanks === 0 &&
      player.spice === 0 && Object.keys(player.forces).length === 0 && player.hand.length === 0),
    'Only a fresh undealt classic lobby may be continued');
    if (!supplied.nexusCards) supplied.nexusCards = { cards: null, phase: null };
    for (const player of supplied.players) if (!player.ready) supplied=applyAction(supplied, player.id, { type: 'ready' });
    return identityRandom(() => initializeNexusGameForAudit(supplied));
  }
  const ids = options.seatIds ?? ['atreides', 'guild', 'emperor'];
  assert.equal(new Set(ids).size, 3);
  let game = createGame('NEXUSTLEILAXUSECRETALLY', newPlayer(ids[0], 'Atreides', 'atreides'), advanced);
  joinGame(game, newPlayer(ids[1], 'Guild', 'guild'));
  joinGame(game, newPlayer(ids[2], 'Emperor', 'emperor'));
  assert.deepEqual(game.expansions, []);
  assert.ok(game.players.every(player => player.faction === 'atreides' || player.faction === 'guild' || player.faction === 'emperor'));
  game.nexusCards ??= { cards: null, phase: null };
  for (const player of game.players) if (!player.ready) game=applyAction(game, player.id, { type: 'ready' });
  return identityRandom(() => initializeNexusGameForAudit(game));
}

/** Physical census of the original pieces; no module owner is assumed. */
export function nexusTleilaxuSecretAllyInventory(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  assert.deepEqual(cards.map(card => card.id).sort(), treacheryDeck(game.expansions).map(card => card.id).sort());
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20, player.faction);
    if (player.elites) {
      assert.equal(player.elites.reserves + player.elites.tanks +
        Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0),
        player.faction === 'emperor' ? 5 : 3, player.faction);
      assert.ok(player.elites.reserves <= player.reserves && player.elites.tanks <= player.tanks);
    }
  }
  assert.deepEqual([...(game.traitorReserve ?? []),
    ...game.players.flatMap(player => [...player.traitors, ...player.traitorChoices])].sort(),
    traitorDeck(game.players, false).sort());
  assert.ok(game.nexusCards?.cards, 'The Nexus inventory must exist');
  validateNexusCards(game.nexusCards.cards, game.players);
}

/** Genuine Basic/Advanced absent-Tleilaxu chronology: one real Emperor shipment
 * into the printed Atreides position, one real battle that kills an own leader and
 * eight own counters, the real turn-two Shai-Hulud Nexus occurrence with its real
 * reciprocal alliance, and the real closing Nexus draw. No hand, wallet, board
 * counter, Tanks, alliance, phase, death or pending frame is written. */
export function createNexusTleilaxuSecretAllyFixture(
  options: NexusTleilaxuSecretAllyFixtureOptions = {},
): NexusTleilaxuSecretAllyFixture {
  const initial = initializeNexusTleilaxuSecretAllySetup(options);
  return identityRandom(() => {
    const advanced = initial.advanced;
    const actions: NexusTleilaxuSecretAllyStep[] = [], staging: string[] = [];
    let game = advanceNexusTleilaxuSecretAlly(initial, state => state.status === 'playing', actions);
    const afterSetup = structuredClone(game);
    assert.ok(game.players.every(player => player.traitors.length > 0 && player.hand.length > 0),
      'The real setup deals traitors and starting Treachery Cards');
    const owner = game.players.find(player => player.faction === 'atreides')!.id;
    const opponent = game.players.find(player => player.faction === 'emperor')!.id;
    const partner = game.players.find(player => player.faction === 'guild')!.id;
    assert.equal(game.players.length, 3, 'One absent-faction holder, one aggressor and one alliance partner');
    assert.ok(!game.players.some(player => player.faction === 'tleilaxu'), 'Secret Ally needs Tleilaxu absent');
    assert.ok(game.players.every(player => player.ally === null));
    const weapon = nexusTleilaxuSecretAllyPlayer(game, opponent).hand
      .find(card => card.kind === 'projectile' || card.kind === 'poison');
    assert.ok(weapon, 'The real Emperor deal must hold one printed leader-killing weapon');
    nexusTleilaxuSecretAllyInventory(game);

    // ---- Turn one, real Movement: the Emperor ships one ordinary counter into Arrakeen.
    game = advanceNexusTleilaxuSecretAllyToPhase(game, 5, actions);
    for (let count = 0; game.active !== opponent; count++) {
      assert.ok(count < 12, 'Every original seat receives one real Movement turn');
      game = stepNexusTleilaxuSecretAlly(game, actions);
    }
    const beforeShipment = structuredClone(game);
    const sector = territory('arrakeen').sectors[0];
    const target = location('arrakeen', sector);
    assert.ok(validGameLocation(game, 'arrakeen', sector));
    assert.ok(shipmentAvailable(game, nexusTleilaxuSecretAllyPlayer(game, opponent)),
      'The Emperor still holds the original turn-one shipment');
    const shipment: NexusTleilaxuSecretAllyStep = { actor: opponent, action: {
      type: 'ship', territory: 'arrakeen', sector, amount: 1, elite: 0, allyPayment: 0 } };
    actions.push(structuredClone(shipment));
    game = applyAction(game, opponent, shipment.action);
    game=advanceNexusTleilaxuSecretAlly(game,nexusTleilaxuSecretAllyClean,actions);
    assert.equal(nexusTleilaxuSecretAllyPlayer(game, opponent).forces[target], 1);
    assert.equal(nexusTleilaxuSecretAllyPlayer(game, owner).forces[target], 10,
      'The printed Atreides position keeps its full real setup army');
    staging.push('The real Emperor seat ships one ordinary reserve counter into the printed Atreides Arrakeen location; no counter, bank or phase is written.');

    // ---- Turn one, real Battle: the Emperor's real weapon kills the defending disc.
    game = advanceNexusTleilaxuSecretAllyToPhase(game, 6, actions);
    const chooser = game.active!;
    assert.ok([owner, opponent].includes(chooser), 'The real battle chooser must be one of the two co-located seats');
    const battleActions: NexusTleilaxuSecretAllyStep[] = [];
    if (!game.battle) {
      const choose: NexusTleilaxuSecretAllyStep = { actor: chooser, action: {
        type: 'chooseBattle', territory: 'arrakeen',
        target: chooser === owner ? opponent : owner } };
      battleActions.push(structuredClone(choose));
      actions.push(structuredClone(choose));
      game = applyAction(game, choose.actor, choose.action);
    }
    game = advanceNexusTleilaxuSecretAlly(game,
      state => nexusTleilaxuSecretAllyClean(state) && !nextNexusTleilaxuSecretAllyNativeStep(state), actions);
    assert.ok(game.battle && !game.battle.revealed, 'Both combatants still seal a private plan');
    const beforeBattle = structuredClone(game);
    const ownLeader = nexusTleilaxuSecretAllyPlayer(game, owner).leaders
      .filter(leader => !leader.dead).sort((a, b) => a.strength - b.strength)[0];
    const otherLeader = nexusTleilaxuSecretAllyPlayer(game, opponent).leaders
      .filter(leader => !leader.dead).sort((a, b) => a.strength - b.strength)[0];
    assert.ok(ownLeader && otherLeader);
    // Basic dials the lost exchange directly; Advanced expresses the same eight
    // committed ordinary counters on its half-step dial with no support spice.
    const plans: NexusTleilaxuSecretAllyStep[] = [
      { actor: owner, action: { type: 'battlePlan', dial: advanced ? 4 : 8, support: 0,
        leader: ownLeader.id, weapon: null, defense: null } },
      { actor: opponent, action: { type: 'battlePlan', dial: 0, support: 0,
        leader: otherLeader.id, weapon: weapon.id, defense: null } },
    ];
    for (const plan of plans) {
      battleActions.push(structuredClone(plan));
      actions.push(structuredClone(plan));
      game = applyAction(game, plan.actor, plan.action);
    }
    assert.ok(game.battle?.revealed, 'Both sealed plans are revealed');
    game = advanceNexusTleilaxuSecretAlly(game, state => state.turn === 2 && state.phase === 1 &&
      nexusTleilaxuSecretAllyClean(state) && !state.spiceSequence && !state.spiceResolution &&
      !state.spiceWindow && !state.nexus && state.ready.length === 0, actions);
    const afterBattle = structuredClone(game);
    const deadLeader = nexusTleilaxuSecretAllyPlayer(game, owner).leaders
      .find(leader => leader.id === ownLeader.id)!;
    assert.equal(deadLeader.dead, true, 'The real opposing weapon killed this own leader disc');
    assert.equal(deadLeader.deaths, 1);
    assert.equal(nexusTleilaxuSecretAllyPlayer(game, owner).tanks, 8,
      'Exactly the eight real dialed ordinary counters reached the Tanks');
    staging.push('Real turn-one battle in the printed Atreides stronghold: the opposing printed weapon killed one own disc and the real exchange sent eight ordinary counters to the Tanks.');

    // ---- Turn two, real Spice Blow and Nexus: one Shai-Hulud occurrence and the real draw.
    const beforeBlow = structuredClone(game);
    frontUndealtShaiHulud(game, staging);
    game = advanceNexusTleilaxuSecretAlly(game,
      state => state.nexus === true && !state.spiceWindow && nexusTleilaxuSecretAllyClean(state), actions);
    assert.equal(game.nexus, true, 'The real Shai-Hulud appearance opened the Nexus');
    const otherSeats = game.players.filter(player => player.id !== owner).map(player => player.id);
    assert.deepEqual([...otherSeats].sort(), [opponent, partner].sort());
    const alliance: NexusTleilaxuSecretAllyStep[] = [
      { actor: otherSeats[0], action: { type: 'alliance', target: otherSeats[1] } },
      { actor: otherSeats[1], action: { type: 'alliance', target: otherSeats[0] } },
    ];
    for (const entry of alliance) {
      actions.push(structuredClone(entry));
      game = applyAction(game, entry.actor, entry.action);
    }
    assert.equal(nexusTleilaxuSecretAllyPlayer(game, opponent).ally, partner);
    assert.equal(nexusTleilaxuSecretAllyPlayer(game, owner).ally, null, 'The holder must stay unallied');
    staging.push('The two non-holder seats form the real reciprocal Nexus alliance the closing window requires; the holder stays unallied.');
    game = advanceNexusTleilaxuSecretAlly(game,
      state => state.nexusCards?.phase?.stage === 'drawing', actions);
    assert.equal(game.turn, 2);
    assert.equal(game.phase, 1);
    const phase = game.nexusCards!.phase!;
    assert.deepEqual(phase.eligible, [owner], 'Only the unallied holder receives the closing opportunity');
    assert.deepEqual(phase.done, []);
    const cards = game.nexusCards!.cards!;
    assert.equal(cards.hands[owner], null, 'No Nexus hand is granted before the real draw');
    const index = cards.deck.indexOf('tleilaxu');
    assert.ok(index >= 0, 'The twelve-card Nexus inventory still holds the physical Tleilaxu singleton');
    cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    staging.push('Ordered the original undealt Tleilaxu Nexus singleton before the real closing draw; no hand is granted.');
    const beforeDraw = structuredClone(game);
    const draw: NexusTleilaxuSecretAllyStep = { actor: owner, action: { type: 'nexusCardChoice',
      turn: game.turn, card: cards.hands[owner], choice: 'draw', ownRedraws: 0 } };
    actions.push(structuredClone(draw));
    game = applyAction(game, owner, draw.action);
    assert.equal(game.nexusCards!.cards!.hands[owner], 'tleilaxu',
      'The real closing draw puts the physical Tleilaxu card in the holder hand');
    assert.equal(game.nexusCards!.phase?.stage, 'complete');
    const afterDraw = structuredClone(game);
    nexusTleilaxuSecretAllyInventory(game);

    // ---- Quiet turn-two Revival with the real held card.
    game = advanceNexusTleilaxuSecretAllyToPhase(game, 4, actions);
    assert.equal(game.turn, 2);
    assert.equal(game.phase, 4);
    assert.ok(nexusTleilaxuSecretAllyClean(game), 'The card needs the quiet Revival window');
    assert.equal(game.nexusCards!.phase?.stage, 'complete');
    const holder = nexusTleilaxuSecretAllyPlayer(game, owner);
    const dead = holder.leaders.find(leader => leader.dead);
    assert.equal(dead?.id, deadLeader.id);
    assert.equal(holder.tanks, 8, 'The real Tanks custody survives Movement, Battle and Collection');
    const offer = tleilaxuSecretAllyOptions(game, holder);
    assert.equal(offer.blocked, null, 'The physical state must support the owner-only offer');
    assert.deepEqual(offer.leaders.map(leader => leader.id), [deadLeader.id]);
    assert.equal(offer.maxForces, 5);
    assert.equal(offer.maxElite, 0, 'This faction owns no typed counters');
    const nexusEvent = tleilaxuSecretAllyEvent(game, holder);
    assert.equal(offer.event, nexusEvent);
    nexusTleilaxuSecretAllyInventory(game);

    const deadLeaderFact: NexusTleilaxuSecretAllyDeadLeader = {
      id: deadLeader.id, name: deadLeader.name, deaths: deadLeader.deaths,
    };
    const scenario = {
      code: game.code,
      advanced: game.advanced,
      turn: game.turn,
      phase: game.phase,
      owner, opponent, partner,
      ownerFaction: holder.faction,
      nexusCard: game.nexusCards!.cards!.hands[owner],
      nexusDeckCount: game.nexusCards!.cards!.deck.length,
      event: nexusEvent,
      deadLeader: { ...deadLeaderFact },
      deadForces: { normal: holder.tanks, elite: holder.elites?.tanks ?? 0 },
      seats: game.players.map(player => ({ id: player.id, faction: player.faction, ally: player.ally,
        spice: player.spice, tanks: player.tanks, reserves: player.reserves, revived: player.revived })),
      offer: { blocked: offer.blocked, maxForces: offer.maxForces, maxElite: offer.maxElite,
        leaders: offer.leaders.map(leader => leader.id) },
      action: { type: 'nexusTleilaxuRevival', event: nexusEvent,
        leader: deadLeader.id, amount: offer.maxForces, elite: 0 },
      staging: [...staging],
    };
    assert.ok(game.spiceDeck.length > 0, 'The real spice deck keeps its remaining undealt cards');
    return { initial, afterSetup, beforeShipment, shipment, beforeBattle, battleActions,
      afterBattle, beforeBlow, beforeDraw, draw, afterDraw, game, owner, opponent, partner,
      ownerFaction: holder.faction, deadLeader: deadLeaderFact, nexusEvent, actions, staging, scenario };
  });
}
