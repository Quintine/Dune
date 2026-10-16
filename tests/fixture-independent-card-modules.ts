import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazTreacheryGameForAudit, initializeFactionExpansionsGameForAudit,
  initializeStrongholdFactionsGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type IndependentCardModulesStep = { actor: string; action: Action };
export type IndependentCardModulesOptions = {
  advanced?: boolean;
  factions?: readonly FactionId[];
  expansions?: Game['expansions'];
  tech?: boolean;
  strongholds?: boolean;
  /** False keeps the original native deck for revealed-card comparisons. */
  independent?: boolean;
  homeworlds?: boolean;
};

/** Select original modules and independent cards before the undealt native setup.
 * No armies, wallets, module owners, phase or history are assigned afterward. */
export function createIndependentCardModulesFixture(options: IndependentCardModulesOptions = {}) {
  const factions = options.factions ?? ['emperor', 'atreides', 'guild'];
  const advanced = options.advanced ?? false;
  assert.ok(factions.length >= 2);
  let game = createGame('INDEPENDENTCARDMODULES', newPlayer(factions[0], factions[0], factions[0]),
    advanced, options.expansions ?? []);
  for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  if (options.homeworlds) game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  if (options.tech ?? true) game.techTokens = createTechTokens();
  if (options.strongholds) game.strongholdCards = createStrongholdCards();
  const steps: IndependentCardModulesStep[] = [];
  for (const player of game.players) {
    const step: IndependentCardModulesStep = { actor: player.id, action: { type: 'ready' } };
    steps.push(step); game = applyAction(game, step.actor, step.action);
  }
  const initial = structuredClone(game);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try {
    game = options.independent !== false ? initializeEcazTreacheryGameForAudit(game) :
      options.strongholds ? initializeStrongholdFactionsGameForAudit(game) : initializeFactionExpansionsGameForAudit(game);
  }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
  game = advanceIndependentCardModules(game, state => state.status === 'playing', steps);
  return { initial, game, steps };
}

/** Reuse original native choices, including all phase/module windows. */
export function nextIndependentCardModulesStep(game: Game): IndependentCardModulesStep | null {
  return nextStrongholdFactionsNativeStep(game);
}

export function advanceIndependentCardModules(game: Game, until: (state: Game) => boolean,
  steps: IndependentCardModulesStep[] = []): Game {
  let state = game;
  for (let count = 0; count < 1800; count++) {
    if (until(state)) return state;
    assert.notEqual(state.status, 'finished', 'Programme ended before its requested native boundary');
    const step = nextIndependentCardModulesStep(state);
    assert.ok(step, 'Supply the actual human Battle Plans before continuing');
    steps.push(structuredClone(step)); state = applyAction(state, step.actor, step.action);
  }
  throw Error('Independent module programme did not reach its requested boundary');
}
