import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeHomeworldGameForAudit, initializeNexusGameForAudit,
  joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { territory } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { TERROR_KINDS } from '../game/moritani-terror';
import { nextNativeE3HomeworldStep } from './fixture-homeworld-native-e3-modules';

export type RuledGrummanStep = { actor: string; action: Action };
export type RuledGrummanFixture = {
  game: Game;
  owner: string;
  placed: string;
  placedTerritory: string;
  initial: Game;
  afterSetup: Game;
  beforePlacement: Game;
  afterPlacement: Game;
  previousCollection: Game;
  beforeCollection: Game;
  drawing: Game | null;
  afterDraw: Game | null;
  census: { treachery: string[]; terror: string[]; nexus: string[] };
  actions: RuledGrummanStep[];
};

/** Select only the original undealt lotteries, retaining all native stock. */
function initialize(game: Game, nexus: boolean): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return nexus ? initializeNexusGameForAudit(game) : initializeHomeworldGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Move only still-unplayed Spice cards; never empty or redeal the discard. */
function frontSpice(game: Game, kinds: ('land' | 'worm')[]): void {
  for (const [position, kind] of kinds.entries()) {
    const index = game.spiceDeck.findIndex((card, at) => at >= position &&
      (kind === 'land' ? 'territory' in card : 'worm' in card));
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
}

export function assertRuledGrummanInventory(game: Game): void {
  homeworldGameIntegrity(game);
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((a, b) => a + b, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((a, b) => a + b, 0), 5);
  }
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(c => c.id).sort(),
  treacheryDeck(game.expansions).map(c => c.id).sort());
  assert.deepEqual(game.moritaniTerror!.tokens.map(t => t.kind).sort(), [...TERROR_KINDS].sort());
  assert.equal(new Set(game.moritaniTerror!.tokens.map(t => t.id)).size, 6);
  if (game.nexusCards) validateNexusCards(game.nexusCards.cards!, game.players);
}

/** Genuine setup → first Collection → Mentat placement → next Collection.
 * No force, population, phase, turn, wallet, hand or earned receipt is staged.
 * The Nexus variant plays an actual second-turn worm and original card draw. */
export function createRuledGrummanFixture(options: { advanced?: boolean; nexus?: boolean } = {}): RuledGrummanFixture {
  const owner = 'moritani', placedTerritory = 'arrakeen';
  let game = createGame('RULEDGRUMMAN', newPlayer(owner, 'Moritani', 'moritani'), options.advanced ?? false, options.nexus ? ['ecaz'] : []);
  joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  game = applyAction(game, owner, { type: 'homeworlds', enabled: true });
  if (options.nexus) game.nexusCards = { cards: null, phase: null };
  const initial = structuredClone(game), actions: RuledGrummanStep[] = [];
  function act(step: RuledGrummanStep): void {
    actions.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  }
  for (const player of game.players) act({ actor: player.id, action: { type: 'ready' } });
  game = initialize(game, !!options.nexus);
  let afterSetup: Game | undefined, previousCollection: Game | undefined;
  let beforePlacement: Game | undefined, afterPlacement: Game | undefined, beforeCollection: Game | undefined;
  let drawing: Game | null = null, afterDraw: Game | null = null, placed: string | undefined;
  let spiceTurn = 0;
  for (let count = 0; count < 500; count++) {
    if (game.status === 'playing' && !afterSetup) {
      afterSetup = structuredClone(game);
      if (options.nexus) {
        const deck = game.nexusCards!.cards!.deck;
        const at = deck.indexOf('moritani'); assert.ok(at >= 0);
        deck.unshift(deck.splice(at, 1)[0]);
      }
    }
    if (game.status === 'playing' && game.phase === 0 && spiceTurn !== game.turn) {
      frontSpice(game, options.nexus && game.turn === 2 ? ['worm', 'land', 'land'] : ['land', 'land']);
      spiceTurn = game.turn;
    }
    if (options.nexus && game.nexus && !game.spiceWindow && !game.spiceResolution &&
      !game.response && !game.phaseOpening && !game.decision && !game.players.find(p => p.id === 'guild')!.ally) {
      act({ actor: 'guild', action: { type: 'alliance', target: 'emperor' } });
      act({ actor: 'emperor', action: { type: 'alliance', target: 'guild' } });
    }
    if (game.turn === 2 && game.decision?.kind === 'grummanCollection' && !game.response && !game.phaseOpening) break;
    if (game.turn === 2 && game.phase === 5) beforeCollection = structuredClone(game);
    const decision = game.decision;
    let step: RuledGrummanStep | null;
    if (!game.response && !game.phaseOpening && decision?.kind === 'moritaniSetup') {
      step = { actor: owner, action: { type: 'decision', territory: 'habbanya_ridge_sietch', sector: territory('habbanya_ridge_sietch').sectors[0] } };
    } else if (!game.response && !game.phaseOpening && decision?.kind === 'grummanCollection') {
      previousCollection = structuredClone(game);
      step = { actor: owner, action: { type: 'decision', event: game.grummanCollection!.event, decline: true } };
    } else if (!game.response && !game.phaseOpening && decision?.kind === 'moritaniPlacement' && game.turn === 1) {
      beforePlacement = structuredClone(game);
      placed = game.moritaniTerror!.tokens.find(t => t.kind === 'robbery')!.id;
      step = { actor: owner, action: { type: 'decision', token: placed, territory: placedTerritory } };
    } else if (!game.response && !game.phaseOpening && !decision && game.nexusCards?.phase?.stage === 'drawing') {
      const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id)); assert.ok(actor);
      if (actor === owner) drawing = structuredClone(game);
      step = { actor, action: { type: 'nexusCardChoice', turn: game.turn, card: game.nexusCards.cards!.hands[actor] ?? null,
        choice: actor === owner ? 'draw' : 'keep', ownRedraws: 0 } };
    } else step = nextNativeE3HomeworldStep(game);
    assert.ok(step, `Native Grumman programme stalled at ${game.status}/${game.turn}/${game.phase}/${decision?.kind}`);
    act(step);
    if (beforePlacement && !afterPlacement && game.moritaniTerror!.tokens.some(t => t.id === placed && t.status === 'placed'))
      afterPlacement = structuredClone(game);
    if (drawing && !afterDraw && game.nexusCards!.cards!.hands[owner] === 'moritani') afterDraw = structuredClone(game);
  }
  assert.equal(game.turn, 2); assert.equal(game.phase, 7); assert.equal(game.decision?.kind, 'grummanCollection');
  assert.ok(afterSetup && previousCollection && beforePlacement && afterPlacement && beforeCollection && placed);
  assert.equal(game.players.find(p => p.id === owner)!.reserves, 14);
  assert.ok(!game.players.find(p => p.id === owner)!.ally);
  assert.equal(game.moritaniTerror!.placementTurn, 1);
  assert.equal(game.moritaniTerror!.tokens.find(t => t.id === placed)!.location, placedTerritory);
  assert.ok(game.moritaniTerror!.tokens.some(t => t.status === 'available'));
  if (options.nexus) {
    assert.ok(drawing && afterDraw, `Native Nexus draw missing: ${JSON.stringify({ phase: game.nexusCards?.phase, discards: game.spiceDiscard, actions: actions.filter(s => s.action.type === 'nexusCardChoice') })}`);
    assert.equal(game.nexusCards!.cards!.hands[owner], 'moritani');
  }
  assertRuledGrummanInventory(game);
  return { game, owner, placed, placedTerritory, initial, afterSetup, previousCollection, beforePlacement, afterPlacement,
    beforeCollection, drawing, afterDraw, actions,
    census: { treachery: treacheryDeck(game.expansions).map(c => c.id).sort(), terror: [...TERROR_KINDS].sort(),
      nexus: options.nexus ? [...NEXUS_FACTIONS].sort() : [] } };
}
