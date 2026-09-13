import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeEcazTreacheryGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';

function seeded<T>(seed: number, work: () => T): T {
  const original = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  let state = seed >>> 0;
  Object.defineProperty(crypto, 'getRandomValues', {
    configurable: true,
    value: (array: Uint32Array) => {
      for (let i = 0; i < array.length; i++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        array[i] = state;
      }
      return array;
    },
  });
  try {
    return work();
  } finally {
    if (original) Object.defineProperty(crypto, 'getRandomValues', original);
  }
}

/** Genuine faction setup with the independent cards included before shuffling. */
export function recruitsGame(
  advanced = true,
  seed = 3,
  seatIds: readonly [string, string, string, string] = ['at', 'fr', 'tl', 'ch'],
): Game {
  return seeded(seed, () => {
    let g = createGame('RECRUITS', newPlayer(seatIds[0], 'Atreides', 'atreides'), advanced, [
      'ix',
      'choam',
    ]);
    for (const [id, name, faction] of [
      [seatIds[1], 'Fremen', 'fremen'],
      [seatIds[2], 'Tleilaxu', 'tleilaxu'],
      [seatIds[3], 'CHOAM', 'choam'],
    ] as const)
      joinGame(g, newPlayer(id, name, faction));
    for (const player of g.players) g = applyAction(g, player.id, { type: 'ready' });
    g = initializeEcazTreacheryGameForAudit(g);
    for (let step = 0; g.status === 'setup' && step < 80; step++) {
      let next: Game | undefined;
      for (const player of g.players) {
        const view = viewGame(g, player.id);
        view.players.find((candidate) => candidate.id === player.id)!.bot = 'Medium';
        const action = botActions(view)[0];
        if (action) {
          next = applyAction(g, player.id, action);
          break;
        }
      }
      assert.ok(next, 'Genuine setup must provide a legal continuation.');
      g = next;
    }
    assert.equal(g.status, 'playing');
    assert.ok(g.players.some((player) => player.hand.some((card) => card.id === 'ecaz-recruits')),
      'Fixture seed must deal Recruits without restaging card custody.');
    g.turn = 2;
    g.phase = 4;
    g.active = null;
    g.ready = [];
    g.phaseOpening = null;
    g.decision = null;
    g.response = null;
    g.revivalRules = undefined;
    g.freeRevival = [];
    for (const player of g.players) {
      player.bot = undefined;
      player.revived = 0;
      player.freeForcesRevived = 0;
      player.spice = 20;
      player.tanks = Math.min(10, player.reserves - (player.elites?.reserves ?? 0));
      player.reserves -= player.tanks;
    }
    return g;
  });
}
