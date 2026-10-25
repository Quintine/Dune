import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { greatMakerRideAction } from '../game/great-maker-options';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { actFremenBetrayalModules, fremenBetrayalModulesClean,
  type FremenBetrayalModulesStep } from './fixture-fremen-betrayal-modules';
import { nextE3IndependentDukeStep } from './fixture-e3-independent-nexus-duke';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type NexusFremenReactiveBetrayalStep = FremenBetrayalModulesStep;
export type NexusFremenReactiveBetrayalOptions = {
  advanced?: boolean;
  kind?: 'ordinary' | 'greatMaker';
};
export const actNexusFremenReactiveBetrayal = actFremenBetrayalModules;
export const nexusFremenReactiveBetrayalClean = fremenBetrayalModulesClean;
export function nexusFremenReactiveBetrayalPlayer(game: Game, id: string) {
  const player = game.players.find(player => player.id === id);
  assert.ok(player, `The original ${id} seat must remain present`);
  return player;
}
export function nexusFremenReactiveBetrayalPhysical(game: Game) {
  return game.players.map(player => ({ id: player.id, forces: structuredClone(player.forces),
    reserves: player.reserves, tanks: player.tanks, spice: player.spice,
    elites: structuredClone(player.elites), shipped: player.shipped, moved: player.moved }));
}
export function nexusFremenReactiveBetrayalInventory(game: Game) {
  assert.ok(game.nexusCards?.cards);
  validateNexusCards(game.nexusCards.cards, game.players);
  const nexus = [...game.nexusCards.cards.deck, ...game.nexusCards.cards.discard,
    ...Object.values(game.nexusCards.cards.hands).filter(card => card !== null)].sort();
  assert.deepEqual(nexus, [...NEXUS_FACTIONS].sort());
  const treachery = [...game.deck, ...game.discard, ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.deepEqual(treachery, baseDeck().map(card => card.id).sort());
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0), player.faction === 'emperor' ? 5 : 3);
  }
  return { nexus, treachery };
}

/** Only live native choices are answered. Great Maker votes deliberately earn
 * its reserve ride; a later unused ride is declined by the ordinary driver. */
export function nextNexusFremenReactiveBetrayalStep(game: Game): NexusFremenReactiveBetrayalStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'nexusFremenRideBetrayal') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, use: false } };
    if (decision?.kind === 'greatMakerVote') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, yes: true } };
    if (decision?.kind === 'nexusFremenCunningOffer') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, accept: false } };
  }
  return nextE3IndependentDukeStep(game);
}
export function advanceNexusFremenReactiveBetrayal(game: Game, until: (state: Game) => boolean,
  actions: NexusFremenReactiveBetrayalStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The native reactive-worm source ended before its boundary');
    const step = nextNexusFremenReactiveBetrayalStep(game);
    assert.ok(step, `The actual ${game.turn}/${game.phase}/${game.decision?.kind} needs an owned native action`);
    game = actNexusFremenReactiveBetrayal(game, step.actor, step.action, actions);
  }
  throw Error('The native reactive-worm source did not reach its finite boundary');
}

/** Select only still-unopened physical Spice Cards, as in the original native
 * Fremen modules programme. No discard, encounter or force is installed. */
function orderSpice(game: Game, names: readonly string[]) {
  const cards = names.map(name => {
    const at = game.spiceDeck.findIndex(card => name === 'worm'
      ? 'worm' in card && !card.greatMaker && !card.thumper && !card.suppressed
      : name === 'maker' ? 'worm' in card && !!card.greatMaker
      : 'territory' in card && !card.discovery && card.territory === name);
    assert.ok(at >= 0, `The original ${name} card must still be unopened`);
    return game.spiceDeck.splice(at, 1)[0];
  });
  game.spiceDeck.unshift(...cards);
}

/** Genuine classic Nexus setup, real turn-two alliance/draw, real free Fremen
 * reinforcement, and the following natural worm. The Discovery variant uses
 * the already-approved Advanced Great Maker programme; neither mode is opened
 * by altering a played game. Only unopened deck/scalar positions are selected. */
export function createNexusFremenReactiveBetrayalFixture(options: NexusFremenReactiveBetrayalOptions = {}) {
  const kind = options.kind ?? 'ordinary', advanced = options.advanced ?? kind === 'greatMaker';
  assert.ok(kind !== 'greatMaker' || advanced, 'This original Great Maker source uses its approved Advanced Discovery start');
  let game = withClassicDiscoveryNexusLottery(() => createGame('REACTIVEFREMENBETRAYAL',
    newPlayer('fremen', 'Fremen', 'fremen'), advanced, []));
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  const actions: NexusFremenReactiveBetrayalStep[] = [];
  const act = (actor: string, action: Action) => {
    game = actNexusFremenReactiveBetrayal(game, actor, action, actions);
  };
  const reach = (until: (state: Game) => boolean) => {
    game = advanceNexusFremenReactiveBetrayal(game, until, actions);
  };
  act(game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true });
  if (kind === 'greatMaker') act(game.host, { type: 'moduleOption', module: 'discoveries', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const initial = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 120; count++) {
    let step: NexusFremenReactiveBetrayalStep | undefined;
    if (game.setupStage === 'forces' && nexusFremenReactiveBetrayalPlayer(game, 'fremen').reserves === 20)
      step = { actor: 'fremen', action: { type: 'fremenSetup', placements: { 'sietch_tabr:14': 10 },
        ...(advanced ? { elitePlacements: { 'sietch_tabr:14': 1 } } : {}) } };
    else for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { step = { actor: player.id, action }; break; }
    }
    assert.ok(step, 'Original private setup must expose a legal native next action');
    act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game), originalInventory = nexusFremenReactiveBetrayalInventory(game);
  orderSpice(game, ['broken_land', ...(advanced ? ['south_mesa'] : [])]);
  reach(state => state.turn === 2 && state.phase === 1 && nexusFremenReactiveBetrayalClean(state));
  const afterFirstTurn = structuredClone(game);
  orderSpice(game, ['worm', 'hagga_basin', ...(advanced ? ['red_chasm'] : [])]);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && nexusFremenReactiveBetrayalClean(state));
  const beforeAlliance = structuredClone(game);
  act('fremen', { type: 'alliance', target: 'emperor' });
  act('emperor', { type: 'alliance', target: 'fremen' });
  reach(state => state.nexusCards?.phase?.stage === 'drawing' && nexusFremenReactiveBetrayalClean(state));
  const cards = game.nexusCards!.cards!, at = cards.deck.indexOf('fremen');
  assert.ok(at >= 0, 'The Fremen Nexus singleton must remain in the original undrawn deck');
  cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  const beforeDraw = structuredClone(game), draw: NexusFremenReactiveBetrayalStep = { actor: 'guild',
    action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands.guild, choice: 'draw', ownRedraws: 0 } };
  act(draw.actor, draw.action);
  const afterDraw = structuredClone(game);
  assert.equal(afterDraw.nexusCards!.cards!.hands.guild, 'fremen');
  reach(state => state.turn === 2 && state.phase === 5 && state.active === 'fremen' && nexusFremenReactiveBetrayalClean(state));
  const beforeShipment = structuredClone(game), shipment: NexusFremenReactiveBetrayalStep = { actor: 'fremen',
    action: { type: 'ship', territory: 'hagga_basin', sector: 12, amount: 2, elite: advanced ? 1 : 0, allyPayment: 0 } };
  act(shipment.actor, shipment.action);
  reach(nexusFremenReactiveBetrayalClean);
  const afterShipment = structuredClone(game);
  reach(state => state.turn === 3 && state.phase === 1 && nexusFremenReactiveBetrayalClean(state));
  const beforeAppearance = structuredClone(game);
  orderSpice(game, [kind === 'greatMaker' ? 'maker' : 'worm', 'habbanya_erg', ...(advanced ? ['oh_gap'] : [])]);
  reach(state => state.decision?.kind === 'nexusFremenRideBetrayal');
  const frame = game.nexusFremenRideBetrayal;
  assert.ok(frame && game.decision?.kind === 'nexusFremenRideBetrayal');
  assert.equal(game.decision.player, 'guild');
  assert.equal(frame.source.kind, kind === 'greatMaker' ? 'greatMakerRide' : 'wormRide');
  assert.equal(nexusFremenReactiveBetrayalPlayer(game, 'guild').ally, null);
  assert.equal(nexusFremenReactiveBetrayalPlayer(game, 'fremen').forces['hagga_basin:12'], 2);
  const action: Action = { type: 'decision', event: game.decision.event, use: true };
  return { game, kind, advanced, holder: 'guild', rider: 'fremen', action,
    initial, setup, afterSetup, afterFirstTurn, beforeAlliance, beforeDraw, draw, afterDraw,
    beforeShipment, shipment, afterShipment, beforeAppearance,
    originalFrame: structuredClone(frame), originalDecision: structuredClone(frame.source),
    originalPhysical: nexusFremenReactiveBetrayalPhysical(game), originalInventory,
    actions, sourceActionCount: actions.length,
    staging: ['Only original unopened Spice/Nexus positions and scalar setup lotteries are selected. All setup, alliance, draw, reinforcement, worm, Nexus and Great Maker votes are native actions.'] };
}
export type NexusFremenReactiveBetrayalFixture = ReturnType<typeof createNexusFremenReactiveBetrayalFixture>;

export function passNexusFremenReactiveBetrayal(game: Game,
  actions: NexusFremenReactiveBetrayalStep[] = []): Game {
  for (let count = 0; game.decision?.kind === 'nexusFremenRideBetrayal' && count < 7; count++) {
    const decision = game.decision;
    game = actNexusFremenReactiveBetrayal(game, decision.player,
      { type: 'decision', event: decision.event, use: false }, actions);
  }
  assert.notEqual(game.decision?.kind, 'nexusFremenRideBetrayal');
  return game;
}
export function useNexusFremenReactiveBetrayal(fixture: NexusFremenReactiveBetrayalFixture,
  game = structuredClone(fixture.game), actions: NexusFremenReactiveBetrayalStep[] = []) {
  return actNexusFremenReactiveBetrayal(game, fixture.holder, fixture.action, actions);
}
export function rideNexusFremenReactiveBetrayal(fixture: NexusFremenReactiveBetrayalFixture,
  game: Game, actions: NexusFremenReactiveBetrayalStep[] = []) {
  let action: Action;
  if (fixture.kind === 'greatMaker') {
    const native = greatMakerRideAction(viewGame(game, fixture.rider), 'polar_sink', 0, 1, 1);
    assert.ok(native, 'The restored native Great Maker control must supply its original typed reserve ride');
    action = native;
  } else {
    assert.equal(game.decision?.kind, 'wormRide');
    action = { type: 'decision', accept: true, territory: 'polar_sink', sector: 0,
      forces: { 'hagga_basin:12': 2 }, ...(fixture.advanced ? { eliteForces: { 'hagga_basin:12': 1 } } : {}) };
  }
  const before = structuredClone(game);
  game = actNexusFremenReactiveBetrayal(game, fixture.rider, action, actions);
  return { game, before, action, after: structuredClone(game) };
}
export function finishNexusFremenReactiveBetrayal(fixture: NexusFremenReactiveBetrayalFixture,
  game: Game, actions: NexusFremenReactiveBetrayalStep[] = []) {
  return advanceNexusFremenReactiveBetrayal(game, state => state.turn === fixture.game.turn &&
    state.phase === 2 && nexusFremenReactiveBetrayalClean(state), actions);
}
