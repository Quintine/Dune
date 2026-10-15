import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazTreacheryGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import type { NoFieldValue } from '../game/richese-no-field';
import { finishHarassPreparation, takeHarassCard } from './fixture-harass-withdraw';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type HarassNoFieldStep = { actor: string; action: Action };
export type HarassNoFieldOptions = {
  advanced?: boolean;
  marker?: NoFieldValue;
  /** Physical own reserves immediately before the actual marker shipment. */
  reserves?: number;
  ordinaryAtMarker?: number;
  ordinaryOtherSector?: number;
  slot?: 'weapon' | 'defense';
  dial?: number;
  support?: number;
  traitor?: 'owner' | 'opponent' | 'both';
  seatIds?: [string, string, string];
  /** Continue the original fresh independent-variant initializer, without redealing. */
  initial?: Game;
};
export type HarassNoFieldFixture = {
  initial: Game;
  afterSetup: Game;
  beforeShipment: Game;
  shipmentStep: HarassNoFieldStep;
  afterShipment: Game;
  beforeBattle: Game;
  battleStep: HarassNoFieldStep;
  /** Open original battle, all native preparation completed, neither plan sealed. */
  game: Game;
  owner: string;
  opponent: string;
  observer: string;
  territory: string;
  location: string;
  otherLocation: string;
  token: { id: string; value: NoFieldValue };
  materializes: number;
  planActions: [HarassNoFieldStep, HarassNoFieldStep];
  nativeSteps: HarassNoFieldStep[];
  staging: string[];
};
export function harassNoFieldPlayer(game: Game, actor: string) {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing original seat ${actor}`);
  return player;
}
const clean = (game: Game) => !game.response && !game.decision && !game.phaseOpening;

function initialize(game: Game): Game {
  // Only the original initializer is deterministic; live token IDs/events remain native.
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return initializeEcazTreacheryGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function place(game: Game, actor: string, location: string, amount: number) {
  const player = harassNoFieldPlayer(game, actor);
  assert.ok(Number.isSafeInteger(amount) && amount >= 0 && amount <= player.reserves);
  player.reserves -= amount;
  if (amount) player.forces[location] = (player.forces[location] ?? 0) + amount;
}
function giveTraitor(game: Game, actor: string, identity: string, staging: string[]) {
  const player = harassNoFieldPlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0];
  assert.ok(returned);
  const at = game.traitorReserve?.indexOf(identity) ?? -1;
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(at >= 0 || donor, 'Exchange an original physical traitor, never fabricate one');
  if (at >= 0) game.traitorReserve!.splice(at, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Conserved original traitor ${identity} exchanged for ${returned} into ${actor}'s hand.`);
}

/** Genuine Basic/Advanced ordinary Richese/classic setup: CHOAM's selected
 * thirty-five-card deck plus the three independent cards, with the original
 * separate Richese cache. Only labeled physical board/card/bank staging follows
 * setup. No status, phase, marker, token, response or sealed plan is fabricated. */
export function createHarassNoFieldFixture(options: HarassNoFieldOptions = {}): HarassNoFieldFixture {
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => p.hand.length === 0));
    assert.equal(game.advanced, options.advanced ?? game.advanced);
    assert.deepEqual(game.expansions, ['choam']);
    assert.deepEqual(game.players.map(p => p.faction).sort(), ['atreides', 'guild', 'richese']);
    if (game.status === 'setup') assert.equal(game.ecazTreachery, true);
  } else {
    const ids = options.seatIds ?? ['richese', 'guild', 'atreides'];
    game = createGame('HARASSNOFIELD', newPlayer(ids[0], 'Richese', 'richese'), options.advanced ?? false, ['choam']);
    joinGame(game, newPlayer(ids[1], 'Guild', 'guild'));
    joinGame(game, newPlayer(ids[2], 'Atreides', 'atreides'));
  }
  if (game.status === 'lobby') {
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
    game = initialize(game);
  }
  const initial = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    let step: HarassNoFieldStep | undefined;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(p => p.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) { step = { actor: player.id, action }; break; }
    }
    assert.ok(step, `Original setup stalled at ${game.setupStage}`);
    game = applyAction(game, step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const owner = game.players.find(p => p.faction === 'richese')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const observer = game.players.find(p => p.faction === 'atreides')!.id;
  const territory = 'imperial_basin', sector = 9;
  const location = `${territory}:${sector}`, otherLocation = `${territory}:10`;
  const staging: string[] = [];
  const nativeSteps: HarassNoFieldStep[] = [];
  const act = (step: HarassNoFieldStep) => {
    nativeSteps.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  };
  const advance = (predicate: (state: Game) => boolean) => {
    for (let count = 0; count < 1600; count++) {
      if (predicate(game)) return;
      const step = nextRicheseStrongholdsNativeStep(game);
      assert.ok(step, 'Native continuation cannot invent an unsealed battle plan');
      if (game.turn === 1 && step.action.type === 'stormDial') step.action.amount = 0;
      act(step);
    }
    throw Error('Native Harass/No-Field continuation did not reach its boundary');
  };
  // Clear original starting positions before native phases, so no incidental battle is introduced.
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
    player.forces = {};
    player.spice = 30;
  }
  staging.push('After actual faction setup: return each original board counter to its own reserves and stage thirty-spice bank balances.');
  advance(g => g.phase === 5 && g.active === owner && clean(g));
  const mixed = (options.ordinaryAtMarker ?? 0) + (options.ordinaryOtherSector ?? 0);
  const reserves = options.reserves ?? 20 - mixed;
  assert.ok(Number.isSafeInteger(reserves) && reserves >= 0 && reserves + mixed <= 20);
  place(game, owner, location, options.ordinaryAtMarker ?? 0);
  place(game, owner, otherLocation, options.ordinaryOtherSector ?? 0);
  place(game, owner, 'polar_sink:0', 20 - reserves - mixed);
  place(game, opponent, location, 5);
  staging.push(`Before actual shipment: conserve ${mixed} ordinary Richese battle counters, ${reserves} Richese reserves, the remainder in Polar Sink, and five opposing ordinary counters at ${location}.`);
  const beforeShipment = structuredClone(game);
  const token = structuredClone(harassNoFieldPlayer(game, owner).noField!.tokens.find(t => t.value === (options.marker ?? 3))!);
  assert.ok(token);
  const shipmentStep: HarassNoFieldStep = { actor: owner, action: {
    type: 'ship', territory, sector, noField: token.id,
    event: harassNoFieldPlayer(game, owner).noFieldEvent,
  } };
  act(shipmentStep);
  advance(clean);
  const afterShipment = structuredClone(game);
  advance(g => g.phase === 6 && clean(g));
  // Return unselected real hands before selecting H, keeping every hand below its printed limit.
  for (const player of game.players) { game.deck.push(...player.hand); player.hand = []; }
  takeHarassCard(game, owner, 'ecaz-harass-withdraw');
  staging.push('Before native battle admission: return every unselected original hand to the remaining deck, then move the one physical Harass & Withdraw into the Richese hand. Original cache custody remains untouched.');
  const ownLeader = harassNoFieldPlayer(game, owner).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  const otherLeader = harassNoFieldPlayer(game, opponent).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  assert.ok(ownLeader && otherLeader);
  if (options.traitor === 'owner' || options.traitor === 'both') giveTraitor(game, owner, otherLeader.id, staging);
  if (options.traitor === 'opponent' || options.traitor === 'both') giveTraitor(game, opponent, ownLeader.id, staging);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === territory);
  assert.ok(choice, 'Even a concealed zero must enter an actual ordinary battle');
  const battleStep: HarassNoFieldStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker,
  } };
  act(battleStep);
  for (let count = 0; count < 120; count++) {
    const step = nextRicheseStrongholdsNativeStep(game);
    if (!step) break;
    act(step);
  }
  assert.ok(game.battle && !game.battle.revealed && clean(game));
  assert.equal(Object.keys(game.battle.plans).length, 0);
  const materializes = Math.min(token.value, reserves);
  const dial = options.dial ?? Math.min(2, mixed + materializes);
  const support = options.support ?? (game.advanced ? dial : 0);
  const slot = options.slot ?? 'defense';
  const planActions: [HarassNoFieldStep, HarassNoFieldStep] = [
    { actor: owner, action: { type: 'battlePlan', dial, support, leader: ownLeader.id,
      weapon: slot === 'weapon' ? 'ecaz-harass-withdraw' : null,
      defense: slot === 'defense' ? 'ecaz-harass-withdraw' : null } },
    { actor: opponent, action: { type: 'battlePlan', dial: 5, support: game.advanced ? 5 : 0, leader: otherLeader.id } },
  ];
  return { initial, afterSetup, beforeShipment, shipmentStep, afterShipment,
    beforeBattle, battleStep, game, owner, opponent, observer, territory, location,
    otherLocation, token, materializes, planActions, nativeSteps, staging };
}

/** Seal a real plan and consume only the native response/preparation windows it opens. */
export function sealHarassNoFieldPlan(game: Game, step: HarassNoFieldStep): Game {
  return finishHarassPreparation(applyAction(game, step.actor, step.action));
}
export function revealHarassNoFieldBattle(fixture: HarassNoFieldFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.planActions) game = sealHarassNoFieldPlan(game, step);
  assert.ok(game.battle?.revealed);
  return game;
}
/** Resolve original allocation, Traitor declarations, losses and cleanup without inventing plans. */
export function finishHarassNoFieldBattle(
  game: Game,
  options: { callers?: string[]; returns?: Record<string, { normal: number; elite: number }> } = {},
): Game {
  for (let count = 0; count < 160; count++) {
    if (!game.battle && clean(game) && !game.pendingTreacheryDiscard) return game;
    let step: HarassNoFieldStep | null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'harassWithdraw') {
      assert.ok(options.returns, 'Choose actual after-reveal physical return locations');
      step = { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, returns: options.returns } };
    } else step = nextRicheseStrongholdsNativeStep(game);
    assert.ok(step, 'Native battle continuation requires both real plans');
    if (step.action.type === 'traitorCall') step.action.call = options.callers?.includes(step.actor) ?? false;
    game = applyAction(game, step.actor, step.action);
  }
  throw Error('Native Harass/No-Field battle did not finish');
}
