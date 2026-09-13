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
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import {
  arrivalPlayer,
  arrivalReload,
} from './deferred-movement-arrival-fixture';

export const shipmentArrivalAction: Action = {
  type: 'ship',
  territory: 'carthag',
  sector: 11,
  amount: 4,
  elite: 0,
  allyPayment: 0,
};

export const shipmentArrivalReload = arrivalReload;
export const shipmentArrivalPlayer = arrivalPlayer;

export function addShipmentArrivalAmbassador(g: Game) {
  const state = createAmbassadors(() => 0.2);
  const token = state.tokens.find((candidate) => candidate.effect === 'emperor');
  assert.ok(token);
  state.cohort = [
    token.id,
    ...state.tokens
      .filter((candidate) => candidate.effect !== 'ecaz' && candidate.id !== token.id)
      .slice(0, 4)
      .map((candidate) => candidate.id),
  ];
  for (const candidate of state.tokens) {
    candidate.zone =
      candidate.effect === 'ecaz' || state.cohort.includes(candidate.id)
        ? 'supply'
        : 'pool';
    candidate.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(state, token.id, {
    turn: g.turn,
    availableSpice: 20,
    destination: {
      id: 'carthag',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
}

/**
 * Real expansion inventories reduced to the saved Advanced Guild arrival case.
 * `legacyGuildArrival` adds the second arrival reaction only after the ordinary
 * Guild decision has been persisted, matching the preflight-free save shape.
 */
export function shipmentArrivalGame(): Game {
  let g = createGame('SHIPARRY', newPlayer('ecaz', 'Ecaz', 'ecaz'), true, [
    'ecaz',
    'choam',
  ]);
  for (const [id, name, faction] of [
    ['guild', 'Guild', 'guild'],
    ['bg', 'Bene Gesserit', 'beneGesserit'],
    ['moritani', 'Moritani', 'moritani'],
    ['richese', 'Richese', 'richese'],
  ] as const)
    joinGame(g, newPlayer(id, name, faction));
  for (const player of g.players) g = applyAction(g, player.id, { type: 'ready' });
  g = initializeFactionExpansionsGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 30; step++) {
    let next: Game | undefined;
    for (const player of g.players) {
      const view = viewGame(g, player.id);
      view.players.find((candidate) => candidate.id === view.me)!.bot = 'Medium';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, player.id, action);
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
    active: 'guild',
    storm: 18,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
    stormPending: null,
  });
  for (const player of g.players) {
    g.deck.push(...player.hand);
    player.hand = [];
    player.forces = {};
    player.reserves = 20;
    player.tanks = 0;
    player.spice = 20;
    player.shipped = player.id !== 'guild';
    player.moved = 0;
    player.bot = undefined;
    if (player.elites) {
      player.elites.forces = {};
      player.elites.reserves = 3;
      player.elites.tanks = 0;
    }
  }
  const bg = arrivalPlayer(g, 'bg');
  bg.advisors = {};
  const guild = arrivalPlayer(g, 'guild');
  g.active = guild.id;
  g.order = g.players.map((player) => player.id);
  g.movementRemaining = [...g.order];
  g.decision = null;
  g.response = null;
  g.pendingShipment = null;
  return g;
}

export function legacyGuildArrival(): Game {
  let g = shipmentArrivalGame();
  g = applyAction(g, 'guild', shipmentArrivalAction);
  assert.equal(g.decision?.kind, 'guildShipment');
  assert.ok(g.pendingShipment);
  addShipmentArrivalAmbassador(g);
  return shipmentArrivalReload(g);
}

export function richeseNoFieldArrivalAction(g: Game): Action {
  const richese = arrivalPlayer(g, 'richese');
  assert.ok(richese.noField);
  return {
    type: 'ship',
    noField: richese.noField.tokens[0].id,
    event: richese.noFieldEvent,
    territory: 'carthag',
    sector: 11,
  };
}

export function shipmentArrivalResources(g: Game) {
  return {
    players: g.players,
    deck: g.deck,
    discard: g.discard,
    spice: g.spice,
    cache: g.richeseCache,
    ambassadors: g.ecazAmbassadors,
    terror: g.moritaniTerror,
    phase: g.phase,
    turn: g.turn,
    active: g.active,
  };
}
