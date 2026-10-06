import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeDiscoveryGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { treacheryDeck } from '../game/cards';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import {
  createHomeworldClassicDiscoveryFixture, homeworldClassicDiscoveryClean,
  homeworldClassicDiscoveryPlayer, nextHomeworldClassicDiscoveryStep,
  type HomeworldClassicDiscoveryFixture,
} from './fixture-homeworld-classic-discovery';

export type HomeworldOptionalStep = { actor: string; action: Action };
export type HomeworldOptionalOptions = {
  initial?: Game;
  advanced?: boolean;
  seats?: 2 | 3 | 4 | 5 | 6;
  tech?: boolean;
  strongholds?: boolean;
};
export type HomeworldOptionalFixture = HomeworldClassicDiscoveryFixture & {
  beforeFirstStorm: Game;
  afterFirstStorm: Game;
};
export const optionalHomeworldPlayer = homeworldClassicDiscoveryPlayer;
export const optionalHomeworldClean = homeworldClassicDiscoveryClean;

/** Only original undealt card lotteries are chosen. The first seven random
 * draws shuffle the eight opaque Discovery faces; the following shuffle is the
 * original 33-card Treachery deck. Starting cards are dealt by native setup. */
function originalStartingLottery<T>(game: Game, initialize: () => T): T {
  const cards = treacheryDeck(), remaining = [...cards];
  const prefix = game.players.flatMap(player => {
    const kinds = player.faction === 'emperor' ? ['poison'] : player.faction === 'harkonnen'
      ? ['shield', 'worthless'] : player.faction === 'atreides' ? ['shield'] : ['worthless'];
    return kinds.map(kind => {
      const index = remaining.findIndex(card => card.kind === kind); assert.ok(index >= 0);
      return remaining.splice(index, 1)[0];
    });
  });
  const desired = [...prefix, ...remaining], working = [...cards], rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.findIndex(card => card.id === desired[i].id); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) / (i + 1) * 0x100000000));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let draw = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) {
      if (draw < 7) array[0] = 0xffffffff;
      else if (draw < 7 + rolls.length) array[0] = rolls[draw - 7];
      else Reflect.apply(original, crypto, [array]);
      draw++;
    } else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Original fresh no-Skills lobby, optional unused physical components, original
 * Homeworld/Discovery initializer. No owners, balances, forces or held cards are
 * injected; even the optional components are selected by their host controls. */
export function createHomeworldOptionalLobby(options: HomeworldOptionalOptions = {}): Game {
  let game = options.initial ? structuredClone(options.initial)
    : createGame('HWOPTIONAL', newPlayer('emperor', 'Emperor', 'emperor'), options.advanced ?? true);
  if (!options.initial) {
    const roster: FactionId[] = ['fremen', 'guild', 'atreides', 'harkonnen', 'beneGesserit'];
    for (const faction of roster.slice(0, (options.seats ?? 5) - 1)) joinGame(game, newPlayer(faction, faction, faction));
  }
  assert.ok(game.status === 'lobby' || (game.status === 'setup' &&
    (game.setupStage === 'prediction' || game.setupStage === 'traitors') &&
    game.turn === 1 && game.phase === 0 && !game.leaderSkills &&
    game.discoveryEnabled && game.discoveries && game.homeworlds?.custody === null),
  'Continue only an original fresh lobby or its initial Homeworld Discovery setup.');
  if (game.status === 'setup') return game;
  if (!game.homeworlds) game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  if (options.tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  if (options.strongholds && !game.strongholdCards) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  game.discoveryEnabled = true;
  return game;
}
export function initializeHomeworldOptional(options: HomeworldOptionalOptions = {}): Game {
  let game = createHomeworldOptionalLobby(options);
  if (game.status === 'setup') return game;
  for (const seat of game.players) if (!seat.ready) game = applyAction(game, seat.id, { type: 'ready' });
  return originalStartingLottery(game, () => initializeDiscoveryGameForAudit(game));
}
export function nextHomeworldOptionalStep(game: Game): HomeworldOptionalStep {
  if (!game.phaseOpening && !game.response) {
    if (game.decision?.kind === 'battleCards') return { actor: game.decision.player, action: { type: 'decision', discard: [] } };
    if (game.decision?.kind === 'techToken') return { actor: game.decision.player,
      action: { type: 'decision', token: game.decision.choices[0] } };
  }
  return nextHomeworldClassicDiscoveryStep(game);
}
export function actHomeworldOptional(game: Game, step: HomeworldOptionalStep, actions?: HomeworldOptionalStep[]): Game {
  actions?.push(structuredClone(step)); return applyAction(game, step.actor, step.action);
}
export function advanceHomeworldOptional(state: Game, until: (game: Game) => boolean,
  actions?: HomeworldOptionalStep[]): Game {
  let game = state;
  for (let i = 0; !until(game) && i < 1800; i++) {
    assert.notEqual(game.status, 'finished');
    game = actHomeworldOptional(game, nextHomeworldOptionalStep(game), actions);
  }
  assert.ok(until(game), 'The original optional Homeworld action window was not reached.');
  return game;
}
export function createHomeworldOptionalFixture(options: HomeworldOptionalOptions = {}): HomeworldOptionalFixture {
  const setup = initializeHomeworldOptional(options);
  const beforeFirstStorm = advanceHomeworldOptional(setup, game => game.status === 'playing' &&
    game.phase === 0 && optionalHomeworldClean(game));
  const afterFirstStorm = advanceHomeworldOptional(beforeFirstStorm, game => game.phase === 1 && optionalHomeworldClean(game));
  const fixture = createHomeworldClassicDiscoveryFixture({ initial: setup, prepareImperialSplit: true });
  return { ...fixture, beforeFirstStorm, afterFirstStorm };
}
export function optionalHomeworldMovementWindow(state: Game, actor: string, turn = 2): Game {
  return advanceHomeworldOptional(state, game => game.turn === turn && game.phase === 5 &&
    game.active === actor && optionalHomeworldClean(game));
}
export function settleHomeworldOptionalArrival(state: Game): Game {
  return advanceHomeworldOptional(state, game => !game.pendingShipment && !game.pendingHomeworldShipment && optionalHomeworldClean(game));
}
export function shipHomeworldOptional(game: Game, actor: string, territory: string, sector: number,
  amount: number, elite = 0, sources = nativeShipmentSources(viewGame(game, actor), amount, elite)): Game {
  assert.ok(sources);
  return settleHomeworldOptionalArrival(applyAction(game, actor,
    { type: 'ship', territory, sector, amount, elite, allyPayment: 0, homeworldSources: sources }));
}
export function invadeHomeworldOptional(game: Game, actor: string, destination: string, amount: number): Game {
  const native = nativeShipmentSources(viewGame(game, actor), amount, 0); assert.ok(native);
  const sources = Object.fromEntries(Object.entries(native).filter(([, group]) => group.normal + group.elite > 0));
  const choice = homeworldShipmentChoice(viewGame(game, actor), destination, sources); assert.ok(choice.action, choice.blocked ?? undefined);
  return settleHomeworldOptionalArrival(applyAction(game, actor, choice.action));
}
export function openHomeworldOptionalBattle(state: Game, territory: string, first: string, second: string): Game {
  let game = advanceHomeworldOptional(state, game => game.phase === 6 && !!game.active && optionalHomeworldClean(game));
  const actor = game.active!; assert.ok(actor === first || actor === second);
  game = applyAction(game, actor, { type: 'chooseBattle', territory, target: actor === first ? second : first });
  return advanceHomeworldOptional(game, game => !!game.battle && !game.battle.preparation && optionalHomeworldClean(game));
}
export function optionalHomeworldLeader(game: Game, actor: string, strongest: boolean): string {
  const leader = optionalHomeworldPlayer(game, actor).leaders.filter(disc => !disc.dead &&
    (!disc.usedAt || disc.usedAt === game.battle?.territory))
    .sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength)[0];
  assert.ok(leader); return leader.id;
}
export function finishHomeworldOptionalBattle(state: Game): Game {
  const territory = state.battle!.territory;
  return advanceHomeworldOptional(state, game =>
    !game.battle && !game.homeworldBattleLoss && optionalHomeworldClean(game) && game.lastBattleContext?.territory === territory);
}

export type HomeworldOptionalClaim = { before: Game; step: HomeworldOptionalStep; after: Game };
export function claimHomeworldOptional(state: Game): HomeworldOptionalClaim {
  let game = advanceHomeworldOptional(state, game => game.phase === 8 && optionalHomeworldClean(game));
  const turn = game.turn;
  for (let i = 0; i < 100; i++) {
    const before = structuredClone(game), step = nextHomeworldOptionalStep(game);
    game = actHomeworldOptional(game, step);
    if (game.turn !== turn || game.status === 'finished') return { before, step, after: game };
    if (game.strongholdCards?.claimedTurn === turn) return { before, step, after: game };
  }
  throw Error('Original end-Mentat did not settle its Stronghold Cards.');
}
