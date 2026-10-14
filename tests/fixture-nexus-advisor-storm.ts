import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  type Action, type Game, type Player,
} from '../game/engine';
import { gameDistance, splitLocation, territory } from '../game/board';
import type { FactionId } from '../game/catalog';
import { validateNexusCards } from '../game/nexus-cards';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { nexusBorrowedVoiceInventory } from './fixture-nexus-borrowed-voice';

export type NexusAdvisorStormStep = { actor: string; action: Action };
export type NexusAdvisorStormFixture = {
  initial: Game;
  afterSetup: Game;
  afterShipment: Game;
  beforeStorm: Game;
  afterStorm: Game;
  game: Game;
  owner: string;
  opponent: string;
  canceler: string;
  cancelerCard: string;
  territory: string;
  storm: number;
  separated: boolean;
  physicalFacts: {
    sectors: number[];
    groups: Record<string, number>;
    opponentGroups: Record<string, number>;
    originalStance: { lockedTurn?: number };
    unblockedDistance: number;
    blockedDistance: number;
    stormSource: Game['stormMovementSource'];
  };
  actions: NexusAdvisorStormStep[];
  staging: string[];
  scenario: Record<string, unknown>;
};

export function nexusAdvisorStormPlayer(game: Game, id: string): Player {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `Missing original storm seat ${id}`);
  return player;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Entropy affects original producers only. No persisted hand, board, wallet,
 * phase, casualty, alliance, response or source receipt is staged. */
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

type Driver = {
  owner: string;
  opponent: string;
  canceler: string;
  territory: string;
  accompanySector: number;
  reinforcementSector: number;
  declinedAdvisorBattle: boolean;
};
function nextStep(game: Game, driver: Driver): NexusAdvisorStormStep | null {
  if (game.status === 'setup' && game.setupStage === 'prediction')
    return { actor: driver.owner, action: { type: 'predict', faction: 'emperor', turn: 10 } };
  if (game.status === 'setup' && game.setupStage === 'forces' &&
    !nexusAdvisorStormPlayer(game, driver.owner).advisorSetup)
    return { actor: driver.owner, action: { type: 'advisorSetup', territory: 'polar_sink', sector: 0 } };
  const decision = game.decision;
  if (decision?.kind === 'advisorBattle') {
    driver.declinedAdvisorBattle = true;
    return { actor: decision.player, action: { type: 'decision', accept: false } };
  }
  if (decision?.kind === 'advisor') {
    const accompany = game.turn === 1 && decision.shipment === driver.opponent;
    return { actor: decision.player, action: accompany
      ? { type: 'decision', accept: true, accompany: true, sector: driver.accompanySector, amount: 1 }
      : { type: 'decision', accept: false } };
  }
  if (decision?.kind === 'guildTiming')
    return { actor: decision.player, action: { type: 'decision', take: false } };
  if (!clean(game)) return nextStrongholdFactionsNativeStep(game);
  if (game.nexusCards?.phase?.stage === 'drawing') {
    const phase = game.nexusCards.phase;
    const actor = phase.eligible.find(id => !phase.done.includes(id));
    if (actor) return { actor, action: { type: 'nexusCardChoice', turn: phase.turn,
      card: game.nexusCards.cards!.hands[actor],
      choice: game.nexusCards.cards!.hands[actor] === null ? 'draw' : 'keep', ownRedraws: 0 } };
  }
  if (game.status === 'playing' && game.phase === 0 && game.stormPending === null) {
    const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
    if (actor) return { actor, action: { type: 'stormDial', amount: 0 } };
  }
  if (game.turn === 1 && game.phase === 3 && game.auction &&
    !nexusAdvisorStormPlayer(game, driver.canceler).hand.some(card => card.effect === 'karama') &&
    game.auction.index === 0 && game.auction.bid === 0 && game.auction.active === driver.canceler)
    return { actor: driver.canceler, action: { type: 'bid', amount: 1 } };
  if (game.turn === 1 && game.phase === 5 && game.active &&
    [driver.owner, driver.opponent].includes(game.active) &&
    !nexusAdvisorStormPlayer(game, game.active).shipped)
    return { actor: game.active, action: { type: 'ship', territory: driver.territory,
      sector: game.active === driver.owner ? driver.reinforcementSector : driver.accompanySector,
      amount: 1, elite: 0, allyPayment: 0,
      ...(game.active === driver.owner ? { advisors: true } : {}) } };
  return nextStrongholdFactionsNativeStep(game);
}
function advance(game: Game, until: (state: Game) => boolean,
  driver: Driver, actions: NexusAdvisorStormStep[]): Game {
  for (let count = 0; count < 2600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original chronology must remain playable');
    const next = nextStep(game, driver);
    assert.ok(next, 'The native storm chronology must not require an invented battle plan');
    actions.push(structuredClone(next));
    game = applyAction(game, next.actor, next.action);
  }
  throw Error('Original advisor storm chronology did not reach its requested boundary');
}
function frontUndealt<T>(deck: T[], matches: (card: T) => boolean): void {
  const index = deck.findIndex(matches);
  assert.ok(index >= 0, 'The requested physical card must remain undealt');
  deck.unshift(deck.splice(index, 1)[0]);
}
function build(separated: boolean): NexusAdvisorStormFixture {
  const owner = 'storm-bene-gesserit', opponent = 'storm-emperor', canceler = 'storm-guild';
  const harkonnen = 'storm-harkonnen';
  const site = separated ? 'false_wall_east' : 'arrakeen';
  const accompanySector = separated ? 5 : 10, reinforcementSector = separated ? 9 : 10;
  const actions: NexusAdvisorStormStep[] = [], staging: string[] = [];
  let lobby = createGame('NEXUSADVISORSTORM', newPlayer(opponent, 'Emperor', 'emperor'), true);
  joinGame(lobby, newPlayer(owner, 'Bene Gesserit', 'beneGesserit'));
  joinGame(lobby, newPlayer(canceler, 'Guild', 'guild'));
  joinGame(lobby, newPlayer(harkonnen, 'Harkonnen', 'harkonnen'));
  lobby.nexusCards ??= { cards: null, phase: null };
  for (const player of lobby.players) if (!player.ready)
    lobby = applyAction(lobby, player.id, { type: 'ready' });
  const initial = structuredClone(lobby);
  let game = initializeNexusGameForAudit(lobby);
  const driver: Driver = { owner, opponent, canceler, territory: site,
    accompanySector, reinforcementSector, declinedAdvisorBattle: false };
  game = advance(game, state => state.status === 'playing', driver, actions);
  const afterSetup = structuredClone(game);
  game = advance(game, state => state.turn === 1 && state.phase === 2 && clean(state), driver, actions);
  frontUndealt(game.deck, card => card.effect === 'karama');
  frontUndealt(game.spiceDeck, card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
  staging.push('Ordered one original undealt Karama for the real first auction and one original undealt Shai-Hulud for the real turn-two Nexus.');
  game = advance(game, state => state.turn === 1 && state.phase === 5 && clean(state) &&
    nexusAdvisorStormPlayer(state, owner).shipped, driver, actions);
  const afterShipment = structuredClone(game);
  assert.equal(nexusAdvisorStormPlayer(game, owner).forces[`${site}:${accompanySector}`], separated ? 1 : 2);
  assert.equal(nexusAdvisorStormPlayer(game, owner).forces[`${site}:${reinforcementSector}`], separated ? 1 : 2);
  assert.deepEqual(nexusAdvisorStormPlayer(game, owner).advisors?.[site], { lockedTurn: 1 });
  const cancelerCard = nexusAdvisorStormPlayer(game, canceler).hand.find(card => card.effect === 'karama');
  assert.ok(cancelerCard, 'The Guild must have bought the original Karama');
  game = advance(game, state => state.turn === 2 && state.nexus && !state.spiceWindow && clean(state), driver, actions);
  assert.equal(game.storm, 2, 'The real turn-two one-sector storm card must move the original storm from one to two');
  for (const entry of [
    { actor: opponent, action: { type: 'alliance', target: canceler } },
    { actor: canceler, action: { type: 'alliance', target: opponent } },
  ] satisfies NexusAdvisorStormStep[]) {
    actions.push(structuredClone(entry));
    game = applyAction(game, entry.actor, entry.action);
  }
  game = advance(game, state => state.nexusCards?.phase?.stage === 'drawing' && clean(state), driver, actions);
  const phase = game.nexusCards!.phase!, cards = game.nexusCards!.cards!;
  assert.deepEqual([...phase.eligible].sort(), [owner, harkonnen].sort());
  const wanted: Record<string, FactionId> = { [owner]: 'beneGesserit', [harkonnen]: 'harkonnen' };
  const front = phase.eligible.map(id => wanted[id]);
  cards.deck = [...front, ...cards.deck.filter(card => !front.includes(card))];
  staging.push('Ordered the conserved undealt Nexus deck for the actual unallied Bene Gesserit and Harkonnen draws; neither hand is assigned.');
  const storm = separated ? 7 : 10;
  game = advance(game, state => state.turn === storm - 1 && state.phase === 8 && clean(state), driver, actions);
  const beforeStorm = structuredClone(game);
  assert.equal(game.nexusCards!.cards!.hands[owner], 'beneGesserit');
  assert.ok(driver.declinedAdvisorBattle, 'The native ordinary advisor battle opportunity must be declined before the storm');
  game = advance(game, state => state.turn === storm && state.phase === 0 && state.stormPending !== null && clean(state), driver, actions);
  const stormSource = structuredClone(game.stormMovementSource);
  assert.ok(stormSource);
  assert.equal(stormSource.kind, 'card');
  assert.equal(stormSource.turn, storm);
  assert.equal(stormSource.distance, 1);
  assert.equal(game.stormPending, 1, 'Identity producer entropy draws the real printed one-sector storm card');
  game = advance(game, state => state.turn === storm && state.phase === 1 && clean(state), driver, actions);
  const afterStorm = structuredClone(game);
  game = advance(game, state => state.turn === storm && state.phase === 5 && state.active === owner && clean(state), driver, actions);
  assert.equal(game.storm, storm, 'Only the original storm producer establishes the blocked geometry');
  assert.deepEqual(nexusAdvisorStormPlayer(game, owner).forces, nexusAdvisorStormPlayer(beforeStorm, owner).forces);
  assert.deepEqual(nexusAdvisorStormPlayer(game, opponent).forces, nexusAdvisorStormPlayer(beforeStorm, opponent).forces);
  assert.equal(nexusAdvisorStormPlayer(game, owner).ally, null);
  assert.equal(game.nexusCards!.cards!.hands[owner], 'beneGesserit');
  assert.equal(nexusAdvisorStormPlayer(game, owner).shipped, false);
  assert.equal(nexusAdvisorStormPlayer(game, owner).moved, 0);
  if (separated) assert.equal(territory(site).type, 'rock');
  else assert.ok(!game.shieldWallDestroyed, 'The intact Shield Wall must shelter Arrakeen from real storm casualties');
  const from = `${site}:${reinforcementSector}`, to = `${site}:${accompanySector}`;
  const blocked = (key: string) => splitLocation(key).sector === storm;
  const physicalFacts = {
    sectors: [...territory(site).sectors],
    groups: structuredClone(nexusAdvisorStormPlayer(game, owner).forces),
    opponentGroups: structuredClone(nexusAdvisorStormPlayer(game, opponent).forces),
    originalStance: structuredClone(nexusAdvisorStormPlayer(game, owner).advisors![site]),
    unblockedDistance: gameDistance(game, from, to),
    blockedDistance: gameDistance(game, from, to, blocked),
    stormSource,
  };
  assert.equal(physicalFacts.unblockedDistance, 0);
  assert.ok(physicalFacts.blockedDistance > 0);
  nexusBorrowedVoiceInventory(game);
  validateNexusCards(game.nexusCards!.cards!, game.players);
  const scenario = { code: game.code, advanced: game.advanced, turn: game.turn, phase: game.phase,
    owner, opponent, canceler, cancelerCard: cancelerCard.id, territory: site, storm, separated,
    physicalFacts, heldNexusCard: game.nexusCards!.cards!.hands[owner], staging: [...staging] };
  return { initial, afterSetup, afterShipment, beforeStorm, afterStorm, game, owner, opponent,
    canceler, cancelerCard: cancelerCard.id, territory: site, storm, separated, physicalFacts,
    actions, staging, scenario };
}

export function createNexusAdvisorStormFixture(options: { separated?: boolean } = {}): NexusAdvisorStormFixture {
  return identityRandom(() => build(options.separated ?? false));
}
