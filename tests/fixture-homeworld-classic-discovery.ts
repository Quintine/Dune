import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeDiscoveryGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { homeworldDiscoveryProfile } from '../game/discovery-module-profile';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_SPICE_CARDS, DISCOVERY_TOKEN_BY_ID, validateDiscoveryState,
  type DiscoveryLocationId, type DiscoveryOpaqueTokenId } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { nativeShipmentSources } from '../game/homeworld-options';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type HomeworldClassicDiscoveryStep = { actor: string; action: Action };
export type HomeworldClassicDiscoveryOptions = {
  /** Original fresh lobby/staged setup; existing first hands are not redealt. */
  initial?: Game;
  advanced?: boolean;
  seats?: 2 | 3 | 4 | 5 | 6;
  face?: DiscoveryLocationId;
  /** Exercise the previous blow army, distinct from the token's printed parent. */
  shipForMaker?: boolean;
  /** Real turn-one movement supplies a later split ordinary-reserve shipment. */
  prepareImperialSplit?: boolean;
};
export type HomeworldClassicDiscoveryFixture = {
  initial: Game; setup: Game; afterSetup: Game; game: Game;
  actions: HomeworldClassicDiscoveryStep[]; staging: string[];
  collector: string; fremen: string; token: DiscoveryOpaqueTokenId; face: DiscoveryLocationId;
  parent: string; parentSector: number; amount: number; elite: number;
  wormTerritory: string; wormSector: number;
};
export const homeworldClassicDiscoveryClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
export const homeworldClassicDiscoveryPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor);
  assert.ok(player); return player;
};

/** Public owned continuations only. Storm dials use their original legal range;
 * no phase clock, casualty, hand, balance or signed Discovery frame is staged. */
export function nextHomeworldClassicDiscoveryStep(game: Game): HomeworldClassicDiscoveryStep {
  if (!game.phaseOpening && !game.response) {
    const decision = game.decision;
    if (decision?.kind === 'homeworldShipmentGuild')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, allow: true } };
    if (decision?.kind === 'discoveryEntry' || decision?.kind === 'greatMakerRide')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, accept: false } };
    if (decision?.kind === 'greatMakerVote')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, yes: false } };
    if (decision?.kind === 'wormRide')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'wormProtection')
      return { actor: decision.player, action: { type: 'decision', accept: true } };
  }
  const next = nextSpiceBankerIncomeNativeStep(game);
  assert.ok(next, 'Original Homeworld/Discovery continuation needs an owned legal action.');
  return next;
}
export function advanceHomeworldClassicDiscovery(state: Game, until: (game: Game) => boolean,
  actions?: HomeworldClassicDiscoveryStep[]): Game {
  let game = state;
  for (let i = 0; !until(game) && i < 1800; i++) {
    assert.notEqual(game.status, 'finished');
    const next = nextHomeworldClassicDiscoveryStep(game);
    actions?.push(structuredClone(next)); game = applyAction(game, next.actor, next.action);
  }
  assert.ok(until(game), 'Original Homeworld/Discovery programme did not reach its action window.');
  return game;
}
export function homeworldClassicDiscoveryInventory(game: Game): void {
  homeworldGameIntegrity(game);
  validateDiscoveryState(game.discoveries!);
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat(), ...(game.spiceResolution?.skipped ?? []),
    ...(game.spiceSequence?.skipped ?? [])];
  assert.equal(spice.filter(card => 'territory' in card && !!card.discovery).length, 6);
  assert.equal(spice.filter(card => 'worm' in card && card.greatMaker).length, 1);
  assert.equal(game.discoveries!.tokens.length, 8);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)];
  assert.equal(cards.length, 33);
  assert.equal(new Set(cards.map(card => card.id)).size, 33);
  for (const player of game.players) if (player.elites) {
    assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((a, b) => a + b, 0), player.faction === 'fremen' ? 3 : 5);
  }
}
function selectedTokenLottery<T>(game: Game, face: DiscoveryLocationId, operation: () => T): T {
  const pool = game.discoveries!.tokens.filter(token => token.status === 'supply' && token.type === DISCOVERY_TOKEN_BY_ID[face].type);
  const index = pool.findIndex(token => token.face === face); assert.ok(index >= 0);
  const native = crypto.getRandomValues.bind(crypto), descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = Math.floor((index + 0.5) / pool.length * 0x100000000);
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function frontSpice(game: Game, choose: (card: Game['spiceDeck'][number]) => boolean, position: number): void {
  const index = game.spiceDeck.findIndex((card, i) => i >= position && choose(card));
  assert.ok(index >= position, 'The original unplayed physical Spice Card must remain available.');
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
}

/** Root rulebook physical pp.22–23: reserves/Homeworlds, Emperor split sources,
 * seven Spice Cards/eight tokens, actual printed blow and Collection reveal.
 * Only original unplayed Spice order and the original supply lottery are selected. */
export function createHomeworldClassicDiscoveryFixture(options: HomeworldClassicDiscoveryOptions = {}): HomeworldClassicDiscoveryFixture {
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    const factions = ['emperor', 'fremen', 'guild', 'harkonnen', 'atreides', 'beneGesserit'] as const;
    game = createGame('HWCLASSICDISCOVERY', newPlayer('emperor', 'Emperor', 'emperor'), options.advanced ?? false);
    for (const faction of factions.slice(1, options.seats ?? 4)) joinGame(game, newPlayer(faction, faction, faction));
    game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
    game.discoveryEnabled = true;
  }
  assert.ok(game.status === 'lobby' || (game.status === 'setup' && game.turn === 1 && game.phase === 0));
  assert.ok(homeworldDiscoveryProfile(game));
  const collector = game.players.find(player => player.faction === 'emperor')!.id;
  const fremen = game.players.find(player => player.faction === 'fremen')!.id;
  assert.ok(collector && fremen);
  const actions: HomeworldClassicDiscoveryStep[] = [];
  if (game.status === 'lobby') for (const player of game.players) if (!player.ready) {
    const next: HomeworldClassicDiscoveryStep = { actor: player.id, action: { type: 'ready' } };
    actions.push(next); game = applyAction(game, next.actor, next.action);
  }
  const initial = structuredClone(game);
  if (game.status === 'lobby') game = initializeDiscoveryGameForAudit(game);
  const setup = structuredClone(game);
  game = advanceHomeworldClassicDiscovery(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game), face = options.face ?? 'cistern';
  frontSpice(game, card => 'territory' in card && card.discovery === 'discovery-hagga-basin', 0);
  // Advanced consumes two piles; Basic consumes one. The next original Great
  // Maker therefore meets pile zero's original Hagga Basin blow on turn two.
  if (game.advanced) frontSpice(game, card => 'territory' in card && !card.discovery && card.territory !== 'hagga_basin', 1);
  const nextTurnIndex = game.advanced ? 2 : 1;
  frontSpice(game, card => 'worm' in card && !!card.greatMaker, nextTurnIndex);
  for (let position = nextTurnIndex + 1; position < nextTurnIndex + (game.advanced ? 3 : 2); position++)
    frontSpice(game, card => 'territory' in card && !card.discovery && card.territory !== 'hagga_basin', position);
  const staging = ['Reordered conserved original unplayed Spice Cards for the printed Hagga Basin Discovery blow and turn-two Great Maker; original starting hands/Treachery deck untouched.',
    `Selected ${face} through the actual original Hiereg supply-token lottery; no reveal, force position or Discovery continuation injected.`];
  game = advanceHomeworldClassicDiscovery(game, state => state.phase === 1 && homeworldClassicDiscoveryClean(state), actions);
  game = selectedTokenLottery(game, face, () => advanceHomeworldClassicDiscovery(game,
    state => state.discoveries!.tokens.some(token => token.face === face && token.status === 'placed'), actions));
  game = advanceHomeworldClassicDiscovery(game, state => state.phase === 5 && state.active === collector && homeworldClassicDiscoveryClean(state), actions);
  const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const blow = DISCOVERY_SPICE_CARDS.find(card => card.discovery === 'discovery-hagga-basin')!;
  const destination = options.shipForMaker ? blow : placement;
  const amount = game.advanced ? 3 : 2, elite = game.advanced ? 1 : 0;
  const sources = nativeShipmentSources(viewGame(game, collector), amount, elite); assert.ok(sources);
  const shipment: HomeworldClassicDiscoveryStep = { actor: collector, action: { type: 'ship',
    territory: destination.territory, sector: destination.sector, amount, elite, allyPayment: 0, homeworldSources: sources } };
  actions.push(shipment); game = applyAction(game, collector, shipment.action);
  if (game.advanced && options.prepareImperialSplit) {
    game = advanceHomeworldClassicDiscovery(game, state => !state.pendingShipment && homeworldClassicDiscoveryClean(state), actions);
    const movement = viewGame(game, collector).homeworldMove!;
    const transfer: HomeworldClassicDiscoveryStep = { actor: collector, action: {
      type: 'emperorHomeworldMove', event: movement.event, origin: 'homeworld:emperor', normal: 1, elite: 0,
    } };
    actions.push(transfer); game = applyAction(game, collector, transfer.action);
  }
  game = advanceHomeworldClassicDiscovery(game, state => state.phase === 7 && homeworldClassicDiscoveryClean(state), actions);
  const token = game.discoveries!.tokens.find(token => token.face === face)!;
  assert.equal(game.turn, 1); homeworldClassicDiscoveryInventory(game);
  return { initial, setup, afterSetup, game, actions, staging, collector, fremen, token: token.id, face,
    parent: placement.territory, parentSector: placement.sector, amount, elite,
    wormTerritory: blow.territory, wormSector: blow.sector };
}
export function revealHomeworldClassicDiscovery(fixture: HomeworldClassicDiscoveryFixture): Game {
  let game = fixture.game;
  if (viewGame(game, fixture.collector).discoveries!.canInspect.includes(fixture.token))
    game = applyAction(game, fixture.collector, { type: 'discovery', token: fixture.token, reveal: false });
  assert.ok(viewGame(game, fixture.collector).discoveries!.canReveal.includes(fixture.token));
  return applyAction(game, fixture.collector, { type: 'discovery', token: fixture.token, reveal: true });
}
export function homeworldClassicDiscoveryEntryWindow(fixture: HomeworldClassicDiscoveryFixture): Game {
  return advanceHomeworldClassicDiscovery(revealHomeworldClassicDiscovery(fixture), game =>
    game.turn === 2 && game.decision?.kind === 'discoveryEntry' && game.decision.player === fixture.collector);
}
export function enterHomeworldClassicDiscovery(fixture: HomeworldClassicDiscoveryFixture): Game {
  const game = homeworldClassicDiscoveryEntryWindow(fixture), view = viewGame(game, fixture.collector);
  const action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources); assert.ok(action);
  return applyAction(game, fixture.collector, action);
}
export function homeworldClassicDiscoveryShipmentWindow(state: Game, owner: string): Game {
  return advanceHomeworldClassicDiscovery(state, game => game.turn === 2 && game.phase === 5 &&
    game.active === owner && homeworldClassicDiscoveryClean(game));
}
export function settleHomeworldClassicDiscoveryArrival(state: Game): Game {
  return advanceHomeworldClassicDiscovery(state, game => !game.pendingShipment && homeworldClassicDiscoveryClean(game));
}
export function homeworldClassicGreatMakerVoteWindow(fixture: HomeworldClassicDiscoveryFixture): Game {
  return advanceHomeworldClassicDiscovery(fixture.game, game => game.decision?.kind === 'greatMakerVote');
}
