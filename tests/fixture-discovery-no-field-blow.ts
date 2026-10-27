import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_SPICE_CARDS, validateDiscoveryState } from '../game/discoveries';
import type { NoFieldValue } from '../game/richese-no-field';
import { actFamilyAtomicsNoField, familyAtomicsNoFieldPlayer, familyAtomicsNoFieldReload,
  familyAtomicsNoFieldInventory, familyAtomicsNoFieldClean, nextFamilyAtomicsNoFieldStep,
  type FamilyAtomicsNoFieldStep } from './fixture-family-atomics-no-field';

export type DiscoveryNoFieldBlowStep = FamilyAtomicsNoFieldStep;
export const actDiscoveryNoFieldBlow = actFamilyAtomicsNoField;
export const discoveryNoFieldBlowPlayer = familyAtomicsNoFieldPlayer;
export const discoveryNoFieldBlowReload = familyAtomicsNoFieldReload;
export const discoveryNoFieldBlowClean = familyAtomicsNoFieldClean;
export function discoveryNoFieldBlowInventory(game: Game) {
  const original = familyAtomicsNoFieldInventory(game); validateDiscoveryState(game.discoveries!); return original;
}
export function nextDiscoveryNoFieldBlow(game: Game): DiscoveryNoFieldBlowStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const d = game.decision;
    if (d?.kind === 'guildTiming') return { actor: d.player, action: { type: 'decision', take: false } };
    if (d?.kind === 'richeseAllyOpportunity') return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d?.kind === 'discoveryEntry' || d?.kind === 'greatMakerRide')
      return { actor: d.player, action: { type: 'decision', event: d.event, accept: false } };
  }
  // The inherited native phase5 branch explicitly ends the current turn before
  // optional policy actions, including newly supported No-Field transport.
  return nextFamilyAtomicsNoFieldStep(game);
}
export function advanceDiscoveryNoFieldBlow(game: Game, until: (state: Game) => boolean,
  actions: DiscoveryNoFieldBlowStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Discovery chronology ended before its requested boundary');
    const next = nextDiscoveryNoFieldBlow(game); assert.ok(next, 'Complete the actual native pending control');
    game = actDiscoveryNoFieldBlow(game, next.actor, next.action, actions);
  }
  throw Error('The original Discovery/No-Field chronology did not reach its finite boundary');
}
export function settleDiscoveryNoFieldBlow(game: Game, actions: DiscoveryNoFieldBlowStep[] = []): Game {
  return advanceDiscoveryNoFieldBlow(game, discoveryNoFieldBlowClean, actions);
}
export function finishDiscoveryNoFieldBlowPhase(game: Game, actions: DiscoveryNoFieldBlowStep[] = []): Game {
  return advanceDiscoveryNoFieldBlow(game, state => state.phase !== 1 && discoveryNoFieldBlowClean(state), actions);
}

const printed = DISCOVERY_SPICE_CARDS.find(card => card.discovery === 'discovery-wind-pass-north')!;
function selectLand(game: Game, position: number) {
  const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
    card.territory !== printed.territory && card.sector !== game.storm);
  assert.ok(from >= position); const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
  return { position, from, card: structuredClone(card) };
}

/** Public opt-in and actual shipments only. Marker-only sources use turn1
 * shipment and turn2 original blow; mixed sources first ship physical1, then
 * the marker on turn2, and wait for the actual turn3 blow. No audit initializer
 * or installed hand, wallet, army, phase, token, event or receipt is used.
 */
export function createDiscoveryNoFieldBlowFixture(options: {
  advanced?: boolean; value?: NoFieldValue; companions?: boolean;
} = {}) {
  const advanced = options.advanced ?? true, value = options.value ?? 0, companions = options.companions ?? false;
  const owner = 'richese', other = 'emperor', observer = 'atreides';
  let game = createGame('DISCOVERYNFBLOW', newPlayer(owner, 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer(observer, 'Atreides', 'atreides')); joinGame(game, newPlayer(other, 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: DiscoveryNoFieldBlowStep[] = [];
  const act = (actor: string, action: Action) => { game = actDiscoveryNoFieldBlow(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceDiscoveryNoFieldBlow(game, until, actions); };
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
  assert.equal(game.discoveryEnabled, true); assert.ok(game.discoveries);
  assert.deepEqual(discoveryNoFieldBlowPlayer(game, owner).forces, {});
  const original = discoveryNoFieldBlowInventory(game), originalDiscovery = structuredClone(game.discoveries);
  const firstSpiceOrder = [selectLand(game, 0), ...(advanced ? [selectLand(game, 1)] : [])];
  reach(state => state.turn === 1 && state.phase === 5 && discoveryNoFieldBlowClean(state));
  let markerShipment: { before: Game; steps: DiscoveryNoFieldBlowStep[]; after: Game } | null = null;
  let physicalShipment: { before: Game; steps: DiscoveryNoFieldBlowStep[]; after: Game } | null = null;
  let otherShipment: { before: Game; steps: DiscoveryNoFieldBlowStep[]; after: Game } | null = null;
  let token = '';
  const shipMarker = () => {
    const own = discoveryNoFieldBlowPlayer(game, owner), selected = own.noField!.tokens.find(token => token.value === value);
    assert.ok(selected && own.noFieldEvent); token = selected.id;
    markerShipment = transition(() => {
      act(owner, { type: 'ship', noField: token, event: own.noFieldEvent, territory: printed.territory, sector: printed.sector });
      reach(discoveryNoFieldBlowClean);
    });
    assert.equal(discoveryNoFieldBlowPlayer(markerShipment.before, owner).spice - discoveryNoFieldBlowPlayer(game, owner).spice, 2);
    assert.equal(discoveryNoFieldBlowPlayer(markerShipment.before, owner).reserves, discoveryNoFieldBlowPlayer(game, owner).reserves);
  };
  for (let count = 0; game.phase === 5 && count < 80; count++) {
    if (discoveryNoFieldBlowClean(game) && game.active === owner && !discoveryNoFieldBlowPlayer(game, owner).shipped) {
      if (companions) physicalShipment = transition(() => {
        act(owner, { type: 'ship', territory: printed.territory, sector: printed.sector, amount: 1, elite: 0, allyPayment: 0 });
        reach(discoveryNoFieldBlowClean);
      });
      else shipMarker();
      continue;
    }
    if (discoveryNoFieldBlowClean(game) && game.active === other && !discoveryNoFieldBlowPlayer(game, other).shipped) {
      otherShipment = transition(() => {
        act(other, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 });
        reach(discoveryNoFieldBlowClean);
      });
      continue;
    }
    const next = nextDiscoveryNoFieldBlow(game); assert.ok(next); act(next.actor, next.action);
  }
  assert.ok(otherShipment); assert.ok(!companions || physicalShipment);
  reach(state => state.turn === 2 && state.phase === 0 && discoveryNoFieldBlowClean(state));
  let secondSpiceOrder: ReturnType<typeof selectLand>[] = [];
  if (companions) {
    secondSpiceOrder = [selectLand(game, 0), ...(advanced ? [selectLand(game, 1)] : [])];
    reach(state => state.turn === 2 && state.phase === 5 && state.active === owner && discoveryNoFieldBlowClean(state));
    shipMarker();
    reach(state => state.turn === 3 && state.phase === 0 && discoveryNoFieldBlowClean(state));
  }
  assert.ok(markerShipment);
  const shipment = markerShipment as { before: Game; steps: DiscoveryNoFieldBlowStep[]; after: Game };
  const beforeTargetStorm = structuredClone(game);
  const from = game.spiceDeck.findIndex(card => 'territory' in card && card.discovery === printed.discovery); assert.ok(from >= 0);
  const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.unshift(card);
  const blowSelection = { position: 0, from, card: structuredClone(card) };
  const followingSpiceOrder = advanced ? [selectLand(game, 1)] : [];
  const turn = companions ? 3 : 2;
  reach(state => state.turn === turn && state.phase === 1 && discoveryNoFieldBlowClean(state) &&
    !state.spiceWindow && !state.spiceSequence && !state.spiceResolution);
  const opening = structuredClone(game), readyFrom = actions.length;
  assert.equal(game.ready.length, 0);
  for (const player of game.players.slice(0, -1)) act(player.id, { type: 'ready' });
  const readyPrefix = structuredClone(actions.slice(readyFrom));
  const drawer = game.players.at(-1)!.id, drawAction: Action = { type: 'ready' };
  assert.equal(game.spiceWindow ?? null, null); assert.equal(game.thumperWindowOpen, true);
  assert.deepEqual(game.spiceDeck[0], printed);
  assert.equal(game.ready.length, game.players.length - 1); assert.equal(game.ready.includes(drawer), false);
  const own = discoveryNoFieldBlowPlayer(game, owner), event = own.noFieldEvent; assert.ok(event);
  assert.equal(own.noField!.deployed!.tokenId, token);
  assert.equal(event, discoveryNoFieldBlowPlayer(shipment.after, owner).noFieldEvent);
  assert.equal(own.forces[`${printed.territory}:${printed.sector}`] ?? 0, companions ? 1 : 0);
  assert.equal(own.tanks, 0); assert.equal(discoveryNoFieldBlowPlayer(game, other).forces['polar_sink:0'], 1);
  assert.deepEqual(discoveryNoFieldBlowInventory(game), original); assert.deepEqual(game.discoveries, originalDiscovery);
  return { game, beforeBlow: structuredClone(game), opening, initial, lobby, setup, afterSetup,
    advanced, value, companions, owner, actor: drawer, drawer, other, observer, token, event,
    marker: structuredClone(own.noField), printed, target: printed.territory, location: `${printed.territory}:${printed.sector}`,
    placement: DISCOVERY_CARD_PLACEMENTS[printed.discovery], drawAction, drawStep: { actor: drawer, action: drawAction },
    markerShipment: shipment, physicalShipment, otherShipment, beforeTargetStorm, original, originalDiscovery,
    dealOrder, firstSpiceOrder, secondSpiceOrder, blowSelection, followingSpiceOrder, readyPrefix,
    setupActions, actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { setup: setupActions.length, markerShipment: shipment.steps.length,
      physicalShipment: physicalShipment?.steps.length ?? 0, otherShipment: otherShipment.steps.length,
      readyPrefix: readyPrefix.length, source: actions.length },
    sourceDisclosure: `Actual public ${advanced ? 'Advanced preview' : 'Basic'} Richese/Atreides/Emperor +CHOAM deck, public Discovery moduleOption before readiness/start, no audit initializer or other optional module. ` +
      'Only original unopened Treachery/Spice positions and scalar lotteries are selected. Richese pays two spice for its original concealed0/3/5 token; physical reserves remain untouched. Emperor separately pays2 for one original Polar counter. ' +
      (companions ? 'Richese first actually ships physical1 to WindPassNorth17 on turn1, then its marker there on turn2, and reaches the original turn3 Discovery blow. '
        : 'Richese actually ships the marker to WindPassNorth17 on turn1 and reaches the original turn2 Discovery blow. ') +
      'Native dials/Storm, quiet auctions, ordered Advanced Charity/Revival and actual turn ends preserve the same deployed event. Two actual Ready controls prime the original first-reveal window; the exposed final Ready performs the printed draw. No hand, purse, force, phase, token, marker event, spice, discovery placement or casualty is installed.' };
}
export type DiscoveryNoFieldBlowFixture = ReturnType<typeof createDiscoveryNoFieldBlowFixture>;
