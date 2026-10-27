import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_TOKEN_BY_ID, type DiscoveryTokenFace } from '../game/discoveries';
import type { NoFieldValue } from '../game/richese-no-field';
import { discoveryNoFieldBlowPlayer, discoveryNoFieldBlowReload, discoveryNoFieldBlowInventory,
  discoveryNoFieldBlowClean, nextDiscoveryNoFieldBlow, type DiscoveryNoFieldBlowStep } from './fixture-discovery-no-field-blow';

export type DiscoveryNoFieldEntryStep = DiscoveryNoFieldBlowStep;
export const discoveryNoFieldEntryPlayer = discoveryNoFieldBlowPlayer;
export const discoveryNoFieldEntryReload = discoveryNoFieldBlowReload;
export const discoveryNoFieldEntryInventory = discoveryNoFieldBlowInventory;
export const discoveryNoFieldEntryClean = discoveryNoFieldBlowClean;
export const nextDiscoveryNoFieldEntry = nextDiscoveryNoFieldBlow;

/** Only original scalar lotteries are chosen. UUIDs and non-scalar native byte
 * entropy remain untouched. A selected Discovery face is sampled from its real
 * current supply at the actual printed Spice draw, never installed afterward.
 */
function originalLottery<T>(game: Game, face: DiscoveryTokenFace | undefined, operation: () => T): T {
  let scalar = 0xffffffff;
  if (face) {
    const eligible = game.discoveries!.tokens.filter(token => token.status === 'supply' && token.type === DISCOVERY_TOKEN_BY_ID[face].type);
    const index = eligible.findIndex(token => token.face === face); assert.ok(index >= 0);
    scalar = Math.floor((index + 0.5) / eligible.length * 0x100000000);
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues'), native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = scalar;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actDiscoveryNoFieldEntry(game: Game, actor: string, action: Action,
  actions: DiscoveryNoFieldEntryStep[] = [], face?: DiscoveryTokenFace): Game {
  const next = originalLottery(game, face, () => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
export function advanceDiscoveryNoFieldEntry(game: Game, until: (state: Game) => boolean,
  actions: DiscoveryNoFieldEntryStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Discovery entry chronology ended before its requested boundary');
    const next = nextDiscoveryNoFieldEntry(game); assert.ok(next, 'Complete the actual native pending control');
    game = actDiscoveryNoFieldEntry(game, next.actor, next.action, actions);
  }
  throw Error('The original Discovery/No-Field entry chronology did not reach its finite boundary');
}
export function settleDiscoveryNoFieldEntry(game: Game, actions: DiscoveryNoFieldEntryStep[] = []): Game {
  return advanceDiscoveryNoFieldEntry(game, discoveryNoFieldEntryClean, actions);
}
export function finishDiscoveryNoFieldEntry(game: Game, actions: DiscoveryNoFieldEntryStep[] = []): Game {
  return advanceDiscoveryNoFieldEntry(game, state => !state.discoveryEntry && discoveryNoFieldEntryClean(state), actions);
}
function selectLand(game: Game, position: number, parent: string) {
  const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card &&
    !card.discovery && card.territory !== parent && card.sector !== game.storm);
  assert.ok(from >= position); const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
  return { position, from, card: structuredClone(card) };
}

/** First original Discovery blow, native supply placement, paid parent shipment
 * and actual Collection inspection/reveal. Mixed physical1 is paid a full turn
 * before its marker. Both then enter the original NEXT-turn free-entry offer.
 * No audit initializer or played component/state installation is used.
 */
export function createDiscoveryNoFieldEntryFixture(options: {
  advanced?: boolean; value?: NoFieldValue; companions?: boolean; face?: 'cistern' | 'shrine';
} = {}) {
  const advanced = options.advanced ?? true, value = options.value ?? 0, companions = options.companions ?? false;
  const face = options.face ?? 'cistern', owner = 'richese', observer = 'atreides', other = 'emperor';
  const printed = 'discovery-hagga-basin', parent = DISCOVERY_CARD_PLACEMENTS[printed];
  let game = createGame('DISCOVERYNFENTRY', newPlayer(owner, 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer(observer, 'Atreides', 'atreides')); joinGame(game, newPlayer(other, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: DiscoveryNoFieldEntryStep[] = [];
  const act = (actor: string, action: Action, lotteryFace?: DiscoveryTokenFace) => {
    game = actDiscoveryNoFieldEntry(game, actor, action, actions, lotteryFace);
  };
  const reach = (until: (state: Game) => boolean) => { game = advanceDiscoveryNoFieldEntry(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  act(game.host, { type: 'moduleOption', module: 'discoveries', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => !player.hand.length));
  const ordinary = ['projectile', 'shield', 'snooper'].map(kind => game.deck.find(card => card.kind === kind));
  const dealOrder = ordinary.map((card, position) => {
    assert.ok(card); const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), setupActions = structuredClone(actions);
  const original = discoveryNoFieldEntryInventory(game);
  const from = game.spiceDeck.findIndex(card => 'territory' in card && card.discovery === printed); assert.ok(from >= 0);
  const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.unshift(card);
  const blowSelection = { position: 0, from, card: structuredClone(card) };
  const followingSpiceOrder = advanced ? [selectLand(game, 1, parent.territory)] : [];
  reach(state => state.phase === 1 && discoveryNoFieldEntryClean(state) && !state.spiceWindow && !state.spiceSequence && !state.spiceResolution);
  const placement = transition(() => {
    assert.deepEqual(game.ready, []);
    for (const player of game.players.slice(0, -1)) act(player.id, { type: 'ready' });
    act(game.players.at(-1)!.id, { type: 'ready' }, face);
  });
  const discovery = game.discoveries!.tokens.find(token => token.face === face && token.status === 'placed'); assert.ok(discovery);
  assert.equal(discovery.territory, parent.territory); assert.equal(discovery.sector, parent.sector);
  const discoveryToken = discovery.id;
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && discoveryNoFieldEntryClean(state));
  let markerShipment: { before: Game; steps: DiscoveryNoFieldEntryStep[]; after: Game } | null = null;
  let physicalShipment: { before: Game; steps: DiscoveryNoFieldEntryStep[]; after: Game } | null = null;
  let markerToken = '';
  const shipMarker = () => {
    const own = discoveryNoFieldEntryPlayer(game, owner), selected = own.noField!.tokens.find(token => token.value === value);
    assert.ok(selected && own.noFieldEvent); markerToken = selected.id;
    markerShipment = transition(() => {
      act(owner, { type: 'ship', noField: markerToken, event: own.noFieldEvent, territory: parent.territory, sector: parent.sector });
      reach(discoveryNoFieldEntryClean);
    });
    assert.equal(discoveryNoFieldEntryPlayer(markerShipment.before, owner).spice - discoveryNoFieldEntryPlayer(game, owner).spice, 2);
    assert.equal(discoveryNoFieldEntryPlayer(markerShipment.before, owner).reserves, discoveryNoFieldEntryPlayer(game, owner).reserves);
  };
  let secondSpiceOrder: ReturnType<typeof selectLand>[] = [];
  if (companions) {
    physicalShipment = transition(() => {
      act(owner, { type: 'ship', territory: parent.territory, sector: parent.sector, amount: 1, elite: 0, allyPayment: 0 });
      reach(discoveryNoFieldEntryClean);
    });
    reach(state => state.turn === 2 && state.phase === 0 && discoveryNoFieldEntryClean(state));
    secondSpiceOrder = [selectLand(game, 0, parent.territory), ...(advanced ? [selectLand(game, 1, parent.territory)] : [])];
    reach(state => state.turn === 2 && state.phase === 5 && state.active === owner && discoveryNoFieldEntryClean(state));
  }
  shipMarker(); assert.ok(markerShipment);
  const shipment = markerShipment as { before: Game; steps: DiscoveryNoFieldEntryStep[]; after: Game };
  reach(state => state.phase === 7 && discoveryNoFieldEntryClean(state));
  const beforeReveal = structuredClone(game), beforeRevealActions = structuredClone(actions);
  assert.ok(viewGame(game, owner).discoveries!.canInspect.includes(discoveryToken));
  const revelation = transition(() => {
    act(owner, { type: 'discovery', token: discoveryToken, reveal: false });
    assert.ok(viewGame(game, owner).discoveries!.canReveal.includes(discoveryToken));
    act(owner, { type: 'discovery', token: discoveryToken, reveal: true });
  });
  const revealTurn = game.turn;
  reach(state => state.turn === revealTurn + 1 && state.phase === 0 &&
    state.decision?.kind === 'discoveryEntry' && state.decision.player === owner && !state.response && !state.phaseOpening);
  const own = discoveryNoFieldEntryPlayer(game, owner), noFieldEvent = own.noFieldEvent; assert.ok(noFieldEvent);
  assert.equal(noFieldEvent, discoveryNoFieldEntryPlayer(shipment.after, owner).noFieldEvent);
  assert.equal(own.noField!.deployed!.tokenId, markerToken);
  assert.deepEqual(own.noField!.deployed!.location, { territory: parent.territory, sector: parent.sector });
  const offer = viewGame(game, owner).discoveryEntry; assert.ok(offer && !offer.blocked);
  assert.equal(offer.token, discoveryToken); assert.equal(offer.destination, face);
  const groups = companions ? [{ source: `${parent.territory}:${parent.sector}`, normal: 1, elite: 0 }] : [];
  const action: Action = { type: 'decision', event: offer.event, accept: true, groups,
    noField: markerToken, noFieldEvent };
  const decline: Action = { type: 'decision', event: offer.event, accept: false };
  assert.deepEqual(discoveryNoFieldEntryInventory(game), original);
  return { game, sourceGame: structuredClone(game), initial, lobby, setup, afterSetup, advanced, value, companions,
    owner, actor: owner, observer, other, face, parent: parent.territory, parentSector: parent.sector,
    source: `${parent.territory}:${parent.sector}`, destination: face, discoveryToken, markerToken,
    event: offer.event, noFieldEvent, marker: structuredClone(own.noField), offer: structuredClone(offer), action, decline,
    placement, markerShipment: shipment, physicalShipment, beforeReveal, beforeRevealActions, revelation,
    original, dealOrder, blowSelection, followingSpiceOrder, secondSpiceOrder, setupActions, actions,
    sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { setup: setupActions.length, placement: placement.steps.length, markerShipment: shipment.steps.length,
      physicalShipment: physicalShipment?.steps.length ?? 0, beforeReveal: beforeRevealActions.length,
      revelation: revelation.steps.length, source: actions.length },
    sourceDisclosure: `Actual public ${advanced ? 'Advanced preview' : 'Basic'} Richese/Atreides/Emperor +CHOAM deck and public Discovery opt-in before readiness/start. ` +
      'No audit initializer or other optional module. Select only original unopened starting/Spice positions and scalar lotteries; the actual first Discovery Hagga Basin draw samples the original supply location at GaraKulon8. ' +
      (companions ? 'Richese actually ships physical1parent on turn1, keeps the location hidden through Collection1, then pays2 for its original marker there on turn2. '
        : 'Richese actually pays2 for its original marker at the parent on turn1. ') +
      'Actual Collection inspection/reveal, Mentat, turn end and next-turn original entry round produce this offer. No hand, purse, army, phase, marker, event, token, reveal receipt or free-entry frame is installed. Counts derive from recorded arrays. Native BG arrival reactions are outside this three-seat source.' };
}
export type DiscoveryNoFieldEntryFixture = ReturnType<typeof createDiscoveryNoFieldEntryFixture>;
