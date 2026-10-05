import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeDiscoveryGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_TOKEN_BY_ID, type DiscoveryTokenFace } from '../game/discoveries';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type DiscoveryNativeMarkerStep = { actor: string; action: Action };
export type DiscoveryNativeMarkerFixture = {
  initial: Game;
  setup: Game;
  game: Game;
  actions: DiscoveryNativeMarkerStep[];
  staging: string[];
  collector: string;
  owner: string;
  token: string;
  parent: string;
  parentSector: number;
  face: DiscoveryTokenFace;
};

/** Use the existing native no-spend policy, with explicit physical cache choices. */
export function nextDiscoveryNativeMarkerStep(game: Game): DiscoveryNativeMarkerStep {
  if (!game.response && !game.phaseOpening && game.decision) {
    const decision = game.decision, actor = decision.player, event = game.richeseBidding?.event;
    if (decision.kind === 'richeseBlackMarket') return { actor, action: { type: 'decision', event, decline: true } };
    if (decision.kind === 'richeseDeclaration') return { actor, action: { type: 'decision', event, position: 'first' } };
    if (decision.kind === 'richeseCache') return { actor, action: {
      type: 'decision', event, card: game.richeseCache![0].id, method: 'onceAround', direction: 'counterclockwise',
    } };
    if (decision.kind === 'richeseUnbid') return { actor, action: { type: 'decision', event, keep: false } };
    if (decision.kind === 'discoveryEntry') return { actor, action: { type: 'decision', event: decision.event, accept: false } };
  }
  if (!game.response && !game.phaseOpening && !game.decision && game.richeseAuction && !game.richeseAuction.outcome) {
    const lot = game.richeseAuction;
    const actor = lot.method === 'silent'
      ? lot.order.find(id => lot.eligible.includes(id) && !Object.hasOwn(lot.sealed, id))
      : lot.active;
    assert.ok(actor);
    return { actor, action: { type: 'richeseBid', event: lot.event, amount: lot.method === 'silent' ? 0 : null } };
  }
  const next = nextSpiceBankerIncomeNativeStep(game);
  assert.ok(next);
  return next;
}

export function advanceDiscoveryNativeMarker(
  state: Game,
  until: (game: Game) => boolean,
  actions?: DiscoveryNativeMarkerStep[],
): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1600; n++) {
    assert.equal(game.status === 'finished', false);
    const next = nextDiscoveryNativeMarkerStep(game);
    actions?.push(next);
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(until(game), 'Native Discovery marker policy did not reach its requested original window.');
  return game;
}
export const discoveryNativeMarkerClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision;

/** Control only the actual placement lottery, never token identities or custody. */
function withPlacement<T>(game: Game, face: DiscoveryTokenFace, operation: () => T): T {
  const eligible = game.discoveries!.tokens.filter(token => token.status === 'supply' && token.type === DISCOVERY_TOKEN_BY_ID[face].type);
  const selected = eligible.findIndex(token => token.face === face);
  assert.ok(selected >= 0);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = Math.floor((selected + 0.5) / eligible.length * 0x100000000);
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Fresh E2 admission, original setup/Storm and phase producers. The only staging
 * is the order of four original unplayed Spice Cards and the placement lottery.
 * No clock, wallet, force, marker, Discovery receipt or card is manufactured.
 * Stops at Collection BEFORE inspection/revelation for an authenticated recipe. */
export function createDiscoveryNativeMarkerFixture(options: {
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  face?: DiscoveryTokenFace;
  collector?: 'choam' | 'guild';
} = {}): DiscoveryNativeMarkerFixture {
  const face = options.face ?? 'cistern';
  let game = options.initial ? structuredClone(options.initial)
    : createGame('DISCOVERYE2MARKER', newPlayer('richese', 'Richese', 'richese'), options.advanced ?? false, ['choam']);
  if (!options.initial) {
    joinGame(game, newPlayer('choam', 'CHOAM', 'choam'));
    joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  }
  assert.equal(game.status, 'lobby');
  assert.deepEqual(game.expansions, ['choam']);
  assert.ok(!game.homeworlds && !game.leaderSkills && !game.nexusCards && !game.strongholdCards);
  const owner = game.players.find(player => player.faction === 'richese')!.id;
  const collector = game.players.find(player => player.faction === (options.collector ?? 'guild'))!.id;
  if (options.tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  game.discoveryEnabled = true;
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  const initial = structuredClone(game), actions: DiscoveryNativeMarkerStep[] = [];
  game = initializeDiscoveryGameForAudit(game);
  const setup = structuredClone(game);
  game = advanceDiscoveryNativeMarker(game, g => g.status === 'playing', actions);
  const printed = DISCOVERY_TOKEN_BY_ID[face].type === 'hiereg' ? 'discovery-hagga-basin' : 'discovery-wind-pass-north';
  const index = game.spiceDeck.findIndex(card => 'territory' in card && card.discovery === printed);
  assert.ok(index >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(index, 1)[0]);
  // Keep both real turns' remaining draws ordinary; never mint or replay a card.
  for (let position = 1; position < 4; position++) {
    const ordinary = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card && !card.discovery);
    assert.ok(ordinary >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(ordinary, 1)[0]);
  }
  const staging = ['Reordered four original unplayed Spice Cards; selected the actual Discovery placement lottery.'];
  game = advanceDiscoveryNativeMarker(game, g => g.phase === 1 && discoveryNativeMarkerClean(g), actions);
  game = withPlacement(game, face, () => advanceDiscoveryNativeMarker(game,
    g => g.discoveries!.tokens.some(token => token.face === face && token.status === 'placed'), actions));
  game = advanceDiscoveryNativeMarker(game, g => g.phase === 5 && discoveryNativeMarkerClean(g), actions);
  const token = game.discoveries!.tokens.find(candidate => candidate.face === face)!;
  assert.equal(token.status, 'placed');
  const placement = DISCOVERY_CARD_PLACEMENTS[printed];
  assert.equal(token.territory, placement.territory);
  game = advanceDiscoveryNativeMarker(game, g => g.phase === 5 && g.active === collector && discoveryNativeMarkerClean(g), actions);
  const shipment: DiscoveryNativeMarkerStep = { actor: collector, action: {
    type: 'ship', territory: placement.territory, sector: placement.sector, amount: 1, elite: 0, allyPayment: 0,
  } };
  actions.push(shipment);
  game = applyAction(game, shipment.actor, shipment.action);
  game = advanceDiscoveryNativeMarker(game, g => g.phase === 7 && discoveryNativeMarkerClean(g), actions);
  assert.equal(game.turn, 1);
  assert.ok(viewGame(game, collector).discoveries!.canInspect.includes(token.id));
  return { initial, setup, game, actions, staging, owner, collector, token: token.id, parent: placement.territory, parentSector: placement.sector, face };
}

export function revealDiscoveryNativeMarker(fixture: DiscoveryNativeMarkerFixture): Game {
  const game = applyAction(fixture.game, fixture.collector, { type: 'discovery', token: fixture.token, reveal: false });
  return applyAction(game, fixture.collector, { type: 'discovery', token: fixture.token, reveal: true });
}

export function discoveryNativeMarkerShipmentWindow(fixture: DiscoveryNativeMarkerFixture): Game {
  return advanceDiscoveryNativeMarker(revealDiscoveryNativeMarker(fixture), game =>
    game.turn === 2 && game.phase === 5 && game.active === fixture.owner && discoveryNativeMarkerClean(game));
}

export function settleDiscoveryNativeMarkerShipment(state: Game): Game {
  return advanceDiscoveryNativeMarker(state, game => !game.pendingShipment && discoveryNativeMarkerClean(game));
}
