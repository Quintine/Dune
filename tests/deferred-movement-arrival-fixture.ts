import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeFactionExpansionsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { TERRITORIES, distance, location, splitLocation } from '../game/board';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import type { FactionId } from '../game/catalog';

export const arrivalPlayer = (g: Game, id: string) =>
  g.players.find((p) => p.id === id)!;
export const arrivalReload = (g: Game): Game => JSON.parse(JSON.stringify(g));
export function arrivalArmy(g: Game, id: string, key: string, amount: number) {
  const p = arrivalPlayer(g, id);
  p.forces = { [key]: amount };
  p.reserves = 20 - amount;
}
export function addArrivalAmbassador(
  g: Game,
  effect: 'fremen' | 'atreides' = 'fremen',
) {
  const state = createAmbassadors(() => 0.2);
  const token = state.tokens.find((t) => t.effect === effect)!;
  state.cohort = [
    token.id,
    ...state.tokens
      .filter((t) => t.effect !== 'ecaz' && t.id !== token.id)
      .slice(0, 4)
      .map((t) => t.id),
  ];
  for (const t of state.tokens) {
    t.zone =
      t.effect === 'ecaz' || state.cohort.includes(t.id) ? 'supply' : 'pool';
    t.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(state, token.id, {
    turn: 2,
    availableSpice: 20,
    destination: {
      id: 'carthag',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
}
export function addArrivalTerror(g: Game) {
  const state = createTerrorState(() => 0.2);
  g.moritaniTerror = placeTerror(
    state,
    state.tokens.find((t) => t.kind === 'atomics')!.id,
    'carthag',
    2,
  );
}
export function holdArrivalCard(g: Game, id: string, name: string) {
  const pile = name === 'Ornithopter' ? g.richeseCache! : g.deck;
  const index = pile.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const card = pile.splice(index, 1)[0];
  arrivalPlayer(g, id).hand.push(card);
  return card.id;
}
/** Real expansion setup inventories, then the saved failure's focused movement topology. */
export function movementArrivalGame(
  mover: FactionId = 'tleilaxu',
  tokens: 'both' | 'ambassador' | 'terror' | 'none' = 'both',
) {
  let g = createGame('DEFERRED', newPlayer('ecaz', 'Ecaz', 'ecaz'), true, [
    'ix',
    'choam',
    'ecaz',
  ]);
  for (const faction of [mover, 'choam', 'moritani', 'richese'] as FactionId[])
    joinGame(g, newPlayer(faction, faction, faction));
  if (mover !== 'ixians') joinGame(g, newPlayer('ixians', 'Ixians', 'ixians'));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeFactionExpansionsGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 30; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((p) => p.id === view.me)!.bot = 'Medium';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, p.id, action);
        break;
      }
    }
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  Object.assign(g, {
    turn: 3,
    phase: 5,
    active: mover,
    storm: 18,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
    stormPending: null,
    movementRemaining: g.players.map((p) => p.id),
  });
  for (const p of g.players) {
    g.deck.push(...p.hand);
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.spice = 20;
    p.shipped = true;
    p.moved = 0;
    if (p.elites) {
      p.elites.forces = {};
      p.elites.reserves = p.faction === 'ixians' ? 7 : 3;
      p.elites.tanks = 0;
    }
  }
  arrivalArmy(g, mover, 'arrakeen:10', 3);
  arrivalArmy(g, 'choam', 'carthag:11', 1);
  g.ecazAmbassadors = createAmbassadors(() => 0.2);
  g.moritaniTerror = createTerrorState(() => 0.2);
  if (tokens === 'both' || tokens === 'ambassador') addArrivalAmbassador(g);
  if (tokens === 'both' || tokens === 'terror') addArrivalTerror(g);
  return g;
}
export function arrivalMove(g: Game): Action {
  const p = arrivalPlayer(g, g.active!);
  return {
    type: 'move',
    forces: { ...p.forces },
    territory: 'carthag',
    sector: 11,
    ...(p.faction === 'ixians' ? { eliteForces: { ...p.elites!.forces } } : {}),
  };
}
export function nativeArrivalSource(g: Game) {
  const source = TERRITORIES.filter((t) => t.type === 'sand')
    .flatMap((t) => t.sectors.map((s) => location(t.id, s)))
    .find(
      (key) =>
        splitLocation(key).sector !== 18 &&
        distance(
          key,
          'carthag:11',
          (key) => splitLocation(key).sector === 18,
        ) === 2,
    )!;
  assert.ok(source);
  arrivalArmy(g, g.active!, source, 3);
  if (g.active === 'ixians') {
    const p = arrivalPlayer(g, 'ixians');
    p.elites!.forces = { [source]: 1 };
    p.elites!.reserves = 6;
  }
  return source;
}
export function arrivalResources(g: Game) {
  return {
    players: g.players,
    deck: g.deck,
    discard: g.discard,
    spice: g.spice,
    cache: g.richeseCache,
    ambassadors: g.ecazAmbassadors,
    terror: g.moritaniTerror,
    ornithopter: g.ornithopter,
    movementRemaining: g.movementRemaining,
    phase: g.phase,
    turn: g.turn,
    active: g.active,
  };
}
