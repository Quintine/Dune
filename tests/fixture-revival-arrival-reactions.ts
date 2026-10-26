import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { homeworldGameIntegrity, homeworldTable } from '../game/homeworld-game';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldRevivalDeploymentChoice } from '../game/homeworld-revival-deployment-options';
import {
  actAdvisorPreparation, advisorPreparationInventory, advisorPreparationPlayer,
} from './fixture-advisor-preparation';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type RevivalArrivalReactionsStep = { actor: string; action: Action };
export type RevivalArrivalReactionsTransition = {
  before: Game; steps: RevivalArrivalReactionsStep[]; after: Game;
};
export const actRevivalArrivalReactions = actAdvisorPreparation;
export const revivalArrivalReactionsPlayer = advisorPreparationPlayer;
export const revivalArrivalReactionsInventory = advisorPreparationInventory;
export const revivalArrivalReactionsClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.pendingRevival && !game.truthtrance && !game.pendingTreacheryDiscard;

/** Owned placement, Intrusion and Spiritual choices remain caller controls.
 * Both actual Storms advance through native dials/readiness, never a clock edit. */
export function nextRevivalArrivalReactions(game: Game): RevivalArrivalReactionsStep | null {
  if (game.truthtrance || game.response?.automaticAdvisorFlip ||
      game.response?.kind === 'advisor' || game.response?.kind === 'advisorFlip') return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision && ['homeworldRevivalDeployment', 'advisor', 'intrusion', 'revivalStop'].includes(decision.kind))
      return null;
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'tleilaxu', turn: 10 } };
    if (game.advanced && game.status === 'setup' && game.setupStage === 'forces' &&
        !revivalArrivalReactionsPlayer(game, 'beneGesserit').advisorSetup)
      return { actor: 'beneGesserit', action: { type: 'advisorSetup', territory: 'polar_sink', sector: 0 } };
    if (decision?.kind === 'advisorBattle')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (game.status === 'playing' && game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial', amount: game.turn === 1
        ? game.stormDialers.indexOf(actor) === 0 ? game.advanced ? 11 : 10 : 0
        : 1 } };
    }
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceRevivalArrivalReactions(game: Game, until: (state: Game) => boolean,
  actions: RevivalArrivalReactionsStep[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original revival-arrival source ended before its next control');
    const next = nextRevivalArrivalReactions(game);
    assert.ok(next, `Choose the original arrival/response at ${game.turn}/${game.phase}/${game.decision?.kind}/${game.response?.kind}`);
    game = actRevivalArrivalReactions(game, next.actor, next.action, actions);
  }
  throw Error('The genuine revival-arrival programme did not reach its finite boundary');
}
/** Calling this explicitly allows ordinary responses, including a declared
 * Spiritual shipment/Intrusion flip. A new automatic conversion stays owned. */
export function passRevivalArrivalReactions(game: Game, actions: RevivalArrivalReactionsStep[] = []): Game {
  for (let count = 0; game.response && !game.response.automaticAdvisorFlip && count < 100; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actRevivalArrivalReactions(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response || game.response.automaticAdvisorFlip); return game;
}
/** Earn the original returned-group decision; no destination or BG reaction is chosen. */
export function openRevivalArrivalReactions(game: Game, fixture: { owner: string; revivalAction: Action },
  actions: RevivalArrivalReactionsStep[] = []): Game {
  game = advanceRevivalArrivalReactions(game, state => state.phase === 4 && revivalArrivalReactionsClean(state) &&
    (!state.revivalOrder || state.revivalOrder.remaining[0] === fixture.owner), actions);
  game = actRevivalArrivalReactions(game, fixture.owner, fixture.revivalAction, actions);
  game = advanceRevivalArrivalReactions(game, state =>
    state.decision?.kind === 'homeworldRevivalDeployment' && !state.response && !state.phaseOpening, actions);
  return game;
}
export function commitRevivalArrivalReactions(game: Game,
  fixture: { owner: string; destination: string }, actions: RevivalArrivalReactionsStep[] = []) {
  const before = structuredClone(game), start = actions.length;
  const choice = homeworldRevivalDeploymentChoice(viewGame(game, fixture.owner), fixture.destination);
  assert.equal(choice.blocked, null); assert.ok(choice.action);
  game = actRevivalArrivalReactions(game, fixture.owner, choice.action, actions);
  return { game, before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
}
export function finishRevivalArrivalReactions(game: Game, actions: RevivalArrivalReactionsStep[] = []): Game {
  return advanceRevivalArrivalReactions(game, state => state.homeworldRevivalReturn?.stage === 'complete' &&
    revivalArrivalReactionsClean(state), actions);
}

/** Actual public Basic/Advanced BG/Tleilaxu + Homeworlds/E1. A genuine paid
 * one-counter sand shipment is destroyed by the next native Storm. No phase,
 * force, Tank, card, wallet, stance, population or pending receipt is installed. */
export function createRevivalArrivalReactionsFixture(options: { advanced?: boolean; resident?: boolean } = {}) {
  const advanced = options.advanced ?? true, resident = options.resident ?? false;
  const bg = 'beneGesserit', owner = 'tleilaxu', holder = owner;
  const territory = 'carthag', sector = 11, destination = `${territory}:${sector}`;
  const casualtyTerritory = 'hagga_basin', casualtyLocation = 'hagga_basin:13';
  let game = createGame('REVIVALARRIVALREACTIONS', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), advanced, ['ix']);
  joinGame(game, newPlayer(owner, 'Tleilaxu', 'tleilaxu'));
  const initial = structuredClone(game), actions: RevivalArrivalReactionsStep[] = [];
  const act = (actor: string, action: Action) => { game = actRevivalArrivalReactions(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceRevivalArrivalReactions(game, until, actions); };
  const transition = (run: () => void): RevivalArrivalReactionsTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const homeworlds = transition(() => { act(game.host, { type: 'homeworlds', enabled: true }); });
  for (const seat of game.players) act(seat.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.ok(game.players.every(seat => !seat.hand.length));
  assert.deepEqual(game.expansions, ['ix']); assert.ok(game.homeworlds);
  assert.ok(!game.nexusCards && !game.leaderSkills && !game.strongholdCards && !game.techTokens && !game.discoveryEnabled);
  const originalInventory = revivalArrivalReactionsInventory(game); assert.equal(originalInventory.length, 47);
  const ordinary = game.deck.find(card => card.kind === 'projectile');
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(ordinary && karama);
  const selected = [ordinary, karama];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(seat => seat.hand.map(card => card.id)), selected.map(card => card.id));
  assert.deepEqual(revivalArrivalReactionsPlayer(game, bg).forces, { 'polar_sink:0': 1 });
  assert.equal(revivalArrivalReactionsPlayer(game, bg).reserves, 19);
  assert.equal(revivalArrivalReactionsPlayer(game, owner).reserves, 20);
  assert.equal(revivalArrivalReactionsPlayer(game, owner).faceDancers?.length, 3);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = Array.from({ length: advanced ? 4 : 2 }, (_, position) => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card &&
      !card.discovery && ![territory, casualtyTerritory].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  const firstStorm = transition(() => {
    reach(state => state.turn === 1 && state.phase === 1);
  });
  assert.equal(game.storm, advanced ? 12 : 11);
  assert.deepEqual(firstStorm.steps.filter(step => step.action.type === 'stormDial').map(step => step.action.amount), [advanced ? 11 : 10, 0]);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === bg && revivalArrivalReactionsClean(state));
  let residentShipment: RevivalArrivalReactionsTransition | null = null;
  if (resident) residentShipment = transition(() => {
    const homeworldSources = nativeShipmentSources(viewGame(game, bg), 1, 0); assert.ok(homeworldSources);
    act(bg, { type: 'ship', territory, sector, amount: 1, elite: 0, allyPayment: 0, homeworldSources });
    reach(revivalArrivalReactionsClean);
  });
  act(bg, { type: 'endMovement' });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && revivalArrivalReactionsClean(state));
  const beforeShipment = structuredClone(game);
  const homeworldSources = nativeShipmentSources(viewGame(game, owner), 1, 0); assert.ok(homeworldSources);
  const shipmentStep: RevivalArrivalReactionsStep = { actor: owner, action: {
    type: 'ship', territory: casualtyTerritory, sector: 13, amount: 1, elite: 0, allyPayment: 0, homeworldSources,
  } };
  const shipment = transition(() => {
    act(shipmentStep.actor, shipmentStep.action);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'advisor');
  });
  const originalSpiritualDecline = transition(() => { act(bg, { type: 'decision', accept: false }); });
  assert.equal(revivalArrivalReactionsPlayer(beforeShipment, owner).spice - revivalArrivalReactionsPlayer(game, owner).spice, 2);
  assert.equal(revivalArrivalReactionsPlayer(game, owner).forces[casualtyLocation], 1);
  assert.equal(revivalArrivalReactionsPlayer(game, owner).reserves, 19);
  const beforeNextStorm = structuredClone(game);
  reach(state => state.turn === 2 && state.phase === 0 && !state.phaseOpening && !state.response &&
    state.stormPending === (advanced ? 1 : 2));
  const beforeStormMovement = structuredClone(game), stormSource = structuredClone(game.stormMovementSource);
  const storm = transition(() => { reach(state => state.turn === 2 && state.phase === 1); });
  assert.equal(game.storm, 13);
  assert.equal(revivalArrivalReactionsPlayer(game, owner).forces[casualtyLocation], undefined);
  assert.equal(revivalArrivalReactionsPlayer(game, owner).tanks, 1);
  reach(state => state.turn === 2 && state.phase === 4 && revivalArrivalReactionsClean(state) &&
    (!state.revivalOrder || state.revivalOrder.remaining[0] === owner));
  assert.equal(revivalArrivalReactionsPlayer(game, owner).tanks, 1);
  assert.equal(revivalArrivalReactionsPlayer(game, owner).reserves, 19);
  assert.equal(revivalArrivalReactionsPlayer(game, bg).reserves, resident ? 18 : 19);
  assert.equal(revivalArrivalReactionsPlayer(game, bg).forces[destination] ?? 0, resident ? 1 : 0);
  assert.ok(revivalArrivalReactionsPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.equal(homeworldTable(game)!.find(home => home.native === owner)!.side, 'high');
  assert.equal(homeworldTable(game)!.find(home => home.native === bg)!.side, 'high');
  assert.deepEqual(revivalArrivalReactionsInventory(game), originalInventory); homeworldGameIntegrity(game);
  const source = structuredClone(game), revivalAction: Action = { type: 'revive', amount: 1, elite: 0, freeElite: 0 };
  return {
    game, source, beforeRequest: source, initial, lobby, setup, beforeStartingDeal, afterSetup, homeworlds,
    bg, owner, holder, tleilaxu: owner, target: owner, actor: owner, karama: karama.id,
    advanced, resident, territory, sector, destination, location: destination,
    casualtyTerritory, casualtyLocation, beforeShipment, shipmentStep, shipment, residentShipment,
    originalSpiritualDecline, beforeNextStorm, beforeStormMovement, stormSource, storm, firstStorm,
    revivalAction, action: revivalAction,
    cancelAction: { type: 'card', card: karama.id, mode: 'cancel' } as Action,
    declineAction: { type: 'decision', accept: false } as Action,
    sinkAction: { type: 'decision', accept: true, accompany: false, amount: 1 } as Action,
    highSinkAction: { type: 'decision', accept: true, accompany: false, amount: 2 } as Action,
    accompanyAction: { type: 'decision', accept: true, accompany: true, amount: 1, sector } as Action,
    dealOrder, spiceOrder, originalSpice, originalInventory, originalCards: originalInventory,
    steps: actions, actions, sourceActionCount: actions.length,
    staging: [
      'Public Basic/Advanced Bene Gesserit/Tleilaxu with actual Homeworlds lobby setting and original 47-card E1 deck. Only two original unopened starting-deal positions, unopened ordinary land Spice positions and native scalar shuffle order are selected. BG starts with one actual Polar fighter (Advanced uses its original advisorSetup); Tleilaxu receives its original Karama and original three Face Dancers. Actual first dials end Storm at11 in Basic (10+0) or12 in Advanced (11+0). Tleilaxu pays two spice to ship one native counter into Hagga Basin13; BG really declines that first Spiritual offer. The next native Storm (Basic 1+1 dials; Advanced original six-card shuffle/draw1) ends at13 and destroys the counter. Original phase controls reach the clean second Revival with Tanks1 and High19 native Tleilaxu/BG, finishing preceding Advanced seats through their actual Ready controls until Tleilaxu owns the opportunity. Optional resident branch has BG actually pay to ship one fighter to Carthag11, leaving High18. No played hand, wallet, army, Tank, phase, stance, threshold, placement or reaction is installed. Source stops before ordinary free revive1; caller owns placement and every BG entry reaction.',
    ],
  };
}
export type RevivalArrivalReactionsFixture = ReturnType<typeof createRevivalArrivalReactionsFixture>;
