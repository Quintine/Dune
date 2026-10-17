import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { type SpiceCard } from '../game/cards';
import { validateNexusCards } from '../game/nexus-cards';
import { nextStrongholdFactionsNativeStep, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type NexusAdvisorFreshFixture = {
  initial: Game;
  afterSetup: Game;
  game: Game;
  owner: string;
  foreign: string;
  canceler: string;
  card: string;
  territory: string;
  location: string;
  event: string;
  declaration: Action;
  batchDeclaration: Action;
  ordinaryAction: Action;
  actions: StrongholdFactionsNativeStep[];
  beforeForeignShipment: Game;
  afterForeignShipment: Game;
  beforeAccompaniment: Game;
  afterAccompaniment: Game;
  beforeReinforcement: Game;
  scenario: {
    turn: number;
    storm: number;
    lockedTurn: number;
    advisors: number;
    opposingFighters: number;
    alliance: [string, string];
    ordinaryTarget: string;
    undealtOrder: string[];
  };
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.pendingGuildBetrayal;
export function nexusAdvisorFreshPlayer(game: Game, actor: string) {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing original advisor seat ${actor}`);
  return player;
}
function entropy<T>(producer: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return producer(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function nativeStep(game: Game): StrongholdFactionsNativeStep {
  // Native reaction states now initialize at fresh setup for classic core games:
  // finish the real Guild Betrayal acknowledgement and purchased-card windows.
  const betrayal = game.pendingGuildBetrayal;
  if (betrayal) {
    const seat = betrayal.required.find(id => !betrayal.passed.includes(id));
    assert.ok(seat, 'The pending Guild Betrayal window must retain an unfinished responder');
    return { actor: seat, action: { type: 'guildBetrayalPass', event: betrayal.invoice.event } };
  }
  if (!game.phaseOpening && !game.response) {
    const decision = game.decision;
    if (decision?.kind === 'nexusIxianReplacement')
      return { actor: decision.player, action: { type: 'nexusIxianReplacementPass', event: decision.event } };
    if (decision?.kind === 'guildTiming')
      return { actor: decision.player, action: { type: 'decision', take: game.turn === 2 } };
    // Preserve original advisors through the earlier mandatory declaration.
    if (decision?.kind === 'advisorBattle' || decision?.kind === 'advisor' || decision?.kind === 'intrusion')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'bg', action: { type: 'predict', faction: 'emperor', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'forces' && !nexusAdvisorFreshPlayer(game, 'bg').advisorSetup)
      return { actor: 'bg', action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
  }
  const step = nextStrongholdFactionsNativeStep(game);
  assert.ok(step, 'The genuine advisor fixture reached an unexpected private battle plan');
  return step;
}
function run(game: Game, step: StrongholdFactionsNativeStep, actions: StrongholdFactionsNativeStep[]): Game {
  actions.push(structuredClone(step));
  return entropy(() => applyAction(game, step.actor, step.action));
}
function advance(game: Game, until: (state: Game) => boolean, actions: StrongholdFactionsNativeStep[]): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = run(game, nativeStep(game), actions);
  }
  throw Error('Native advisor progression did not reach its requested boundary');
}
/** Finish only original acknowledgement/decision windows, never another movement turn. */
export function settleNexusAdvisorFresh(game: Game): Game {
  return advance(game, clean, []);
}
/** Reorder undealt Spice only. Previously blown cards retain their discard custody. */
function orderSpice(game: Game, kinds: ('land' | 'worm')[], order: string[]): void {
  const front: SpiceCard[] = [];
  for (const kind of kinds) {
    const index = game.spiceDeck.findIndex(card => kind === 'worm' ? 'worm' in card :
      'territory' in card && !['imperial_basin', 'arrakeen', 'tueks_sietch'].includes(card.territory));
    assert.ok(index >= 0, `Missing original undealt ${kind}`);
    const card = game.spiceDeck.splice(index, 1)[0];
    front.push(card);
    order.push('territory' in card ? card.territory : 'worm');
  }
  game.spiceDeck.unshift(...front);
}

/** Every force, payment, lock, alliance, card deal and continuation is native.
 * The only staged values are physical undealt deck order and producer entropy. */
export function createNexusAdvisorFreshFixture(): NexusAdvisorFreshFixture {
  const owner = 'bg', foreign = 'guild', canceler = foreign;
  const territory = 'shield_wall', location = 'shield_wall:9';
  const actions: StrongholdFactionsNativeStep[] = [], undealtOrder: string[] = [];
  let game = createGame('NEXUSADVISORFRESH', newPlayer(owner, 'Bene Gesserit', 'beneGesserit'), true, []);
  joinGame(game, newPlayer(foreign, 'Guild', 'guild'));
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('atreides', 'Atreides', 'atreides'));
  game.nexusCards = { cards: null, phase: null };
  for (const player of game.players) game = run(game, { actor: player.id, action: { type: 'ready' } }, actions);
  game = entropy(() => initializeNexusGameForAudit(game));
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(p => p.hand.length === 0));
  // The original starting deal consumes one card per seat, in roster order.
  const karamaIndex = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karamaIndex >= 0);
  const card = game.deck[karamaIndex].id;
  [game.deck[1], game.deck[karamaIndex]] = [game.deck[karamaIndex], game.deck[1]];
  undealtOrder.push(`Starting deal ${card} to ${canceler}`);
  const initial = structuredClone(game);
  game = advance(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  assert.ok(nexusAdvisorFreshPlayer(game, canceler).hand.some(held => held.id === card));
  game = advance(game, state => state.phase === 1 && clean(state), actions);
  orderSpice(game, ['land', 'land'], undealtOrder);
  game = advance(game, state => state.phase === 5 && state.active === 'atreides' && clean(state), actions);
  // A genuine nearby occupied destination makes the later ordinary flip action
  // geometrically legal; only its fresh advisor stance disallows fighter entry.
  game = run(game, { actor: 'atreides', action: { type: 'ship', territory: 'imperial_basin', sector: 10, amount: 1 } }, actions);
  game = advance(game, clean, actions);
  game = advance(game, state => state.turn === 2 && state.phase === 1 && clean(state), actions);
  orderSpice(game, ['worm', 'land', 'land'], undealtOrder);
  game = advance(game, state => state.nexus === true && !state.spiceWindow, actions);
  game = run(game, { actor: 'emperor', action: { type: 'alliance', target: 'atreides' } }, actions);
  game = run(game, { actor: 'atreides', action: { type: 'alliance', target: 'emperor' } }, actions);
  game = advance(game, state => state.nexusCards?.phase?.stage === 'drawing', actions);
  for (const [actor, face] of [[owner, 'beneGesserit'], [foreign, 'guild']] as const) {
    const cards = game.nexusCards!.cards!;
    const index = cards.deck.indexOf(face);
    assert.ok(index >= 0);
    cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    undealtOrder.push(`Closing Nexus ${face} to ${actor}`);
    game = run(game, { actor, action: { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } }, actions);
  }
  game = advance(game, state => state.phase === 5 && state.active === foreign && clean(state), actions);
  const beforeForeignShipment = structuredClone(game);
  game = run(game, { actor: foreign, action: { type: 'ship', territory, sector: 9, amount: 1 } }, actions);
  game = advance(game, state => state.decision?.kind === 'advisor' && !state.response && !state.phaseOpening, actions);
  const afterForeignShipment = structuredClone(game), beforeAccompaniment = structuredClone(game);
  game = run(game, { actor: owner, action: { type: 'decision', accept: true, accompany: true, amount: 1 } }, actions);
  game = advance(game, clean, actions);
  const afterAccompaniment = structuredClone(game);
  game = run(game, { actor: foreign, action: { type: 'endMovement' } }, actions);
  game = advance(game, state => state.phase === 5 && state.active === owner && clean(state), actions);
  const beforeReinforcement = structuredClone(game);
  game = run(game, { actor: owner, action: { type: 'ship', territory, sector: 9, amount: 1 } }, actions);
  game = advance(game, clean, actions);
  const player = nexusAdvisorFreshPlayer(game, owner);
  assert.equal(player.advisors?.[territory]?.lockedTurn, game.turn);
  assert.equal(player.forces[location], 2);
  assert.equal(game.nexusCards!.cards!.hands[owner], 'beneGesserit');
  assert.equal(player.ally, null);
  validateNexusCards(game.nexusCards!.cards!, game.players);
  const event = viewGame(game, owner).nexusAdvisors!.offer!.event;
  return {
    initial, afterSetup, game, owner, foreign, canceler, card, territory, location, event,
    declaration: { type: 'nexusAdvisors', event, territories: [territory] },
    batchDeclaration: { type: 'nexusAdvisors', event, territories: ['arrakeen', territory] },
    ordinaryAction: { type: 'move', from: location, territory: 'imperial_basin', sector: 10, amount: 1, fighters: true },
    actions, beforeForeignShipment, afterForeignShipment, beforeAccompaniment, afterAccompaniment, beforeReinforcement,
    scenario: { turn: game.turn, storm: game.storm, lockedTurn: player.advisors![territory].lockedTurn!,
      advisors: player.forces[location], opposingFighters: nexusAdvisorFreshPlayer(game, foreign).forces[location],
      alliance: ['emperor', 'atreides'], ordinaryTarget: 'imperial_basin:10', undealtOrder },
  };
}
