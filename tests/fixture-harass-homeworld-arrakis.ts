import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazTreacheryGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { territory } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { traitorDeck } from '../game/traitors';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups, type HomeworldForces } from '../game/homeworld-custody';
import { harassWithdrawCommitments, type HarassWithdrawSelection } from '../game/harass-withdraw';
import { finishHarassPreparation, takeHarassCard } from './fixture-harass-withdraw';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type HarassHomeworldArrakisStep = { actor: string; action: Action };
export type HarassHomeworldArrakisOptions = {
  advanced?: boolean;
  outcome?: 'winner' | 'loser';
  traitor?: 'owner' | 'opponent' | 'both';
  slot?: 'weapon' | 'defense';
  seatIds?: [string, string];
  /** An original undealt classic Emperor/Guild lobby, preserving live seat IDs. */
  initial?: Game;
};
export type HarassHomeworldArrakisFixture = {
  initial: Game;
  afterSetup: Game;
  beforeBattle: Game;
  game: Game;
  owner: string;
  opponent: string;
  territory: string;
  location: string;
  planActions: [HarassHomeworldArrakisStep, HarassHomeworldArrakisStep];
  battleStep: HarassHomeworldArrakisStep;
  shipments: { before: Game; after: Game; step: HarassHomeworldArrakisStep }[];
  nativeSteps: HarassHomeworldArrakisStep[];
  staging: string[];
};
export function harassHomeworldArrakisPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player); return player;
}
export const harassHomeworldArrakisClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard;

export function harassHomeworldArrakisPool(game: Game, actor: string, location: string): HomeworldForces {
  const home = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!).find(h => h.id === location);
  assert.ok(home); return home.forces[actor] ?? { normal: 0, elite: 0 };
}
export function assertHarassHomeworldArrakisCustody(game: Game): void {
  homeworldGameIntegrity(game);
  const homes = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  const sum = (values: Record<string, number>) => Object.values(values).reduce((a, b) => a + b, 0);
  for (const p of game.players) {
    const visitors = homes.filter(h => h.native !== p.id).map(h => h.forces[p.id] ?? { normal: 0, elite: 0 });
    assert.equal(p.reserves + p.tanks + sum(p.forces) + visitors.reduce((n, pool) => n + pool.normal + pool.elite, 0), 20, p.faction);
    assert.ok(p.hand.length <= 4);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + sum(p.elites.forces) + visitors.reduce((n, pool) => n + pool.elite, 0), 5);
      assert.ok(p.elites.reserves <= p.reserves && p.elites.tanks <= p.tanks);
      for (const [key, amount] of Object.entries(p.elites.forces)) assert.ok(amount <= (p.forces[key] ?? 0));
    }
    const native = homes.filter(h => h.native === p.id).map(h => h.forces[p.id]);
    assert.equal(native.reduce((n, pool) => n + pool.normal + pool.elite, 0), p.reserves);
    assert.equal(native.reduce((n, pool) => n + pool.elite, 0), p.elites?.reserves ?? 0);
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.equal(cards.length, 36);
  assert.deepEqual(cards.map(c => c.id).sort(), [...treacheryDeck([]), ...ecazTreacheryCards()].map(c => c.id).sort());
  assert.deepEqual([...game.traitorReserve!, ...game.players.flatMap(p => [...p.traitors, ...p.traitorChoices])].sort(), traitorDeck(game.players).sort());
}

/** Follow entitled original controls only; never invent a phase or a plan. */
export function nextHarassHomeworldArrakisStep(game: Game): HarassHomeworldArrakisStep | null {
  if (!game.response && !game.phaseOpening) {
    const d = game.decision;
    if (d?.kind === 'harassWithdraw') return null;
    if (d?.kind === 'homeworldDefense') return { actor: d.player, action: { type: 'decision', event: d.event, use: false } };
    if (d?.kind === 'homeworldRevivalDeployment' || d?.kind === 'caladanReinforcement')
      return { actor: d.player, action: { type: 'decision', event: d.event, decline: true } };
    if (!d && game.biddingEnd) {
      const actor = game.biddingEnd.owners.find(id => !game.biddingEnd!.ready.includes(id));
      if (actor) return { actor, action: { type: 'biddingEnd', event: game.biddingEnd.event, mode: 'ready' } };
    }
  }
  const step = nextStrongholdFactionsNativeStep(game);
  if (step?.action.type === 'stormDial' && game.turn === 1) step.action.amount = 0;
  return step;
}
export function advanceHarassHomeworldArrakis(state: Game, until: (game: Game) => boolean,
  actions?: HarassHomeworldArrakisStep[]): Game {
  let game = state;
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    const step = nextHarassHomeworldArrakisStep(game);
    assert.ok(step, 'The original native boundary requires a real plan or allocation');
    actions?.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  throw Error('Original Homeworld Harass programme did not reach its boundary');
}
function initialize(game: Game): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array); new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255); return array;
  };
  try { return initializeEcazTreacheryGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function exchangeTraitor(game: Game, actor: string, identity: string, staging: string[]): void {
  const player = harassHomeworldArrakisPlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const old = player.traitors[0]; assert.ok(old);
  const index = game.traitorReserve!.indexOf(identity);
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(index >= 0 || donor, 'Exchange an original physical Traitor, never manufacture one');
  if (index >= 0) game.traitorReserve![index] = old;
  else donor!.traitors[donor!.traitors.indexOf(identity)] = old;
  player.traitors[0] = identity;
  staging.push(`Conserved original Traitor ${identity} exchanged with ${old} into ${actor}'s hand.`);
}

/** Original classic two-seat setup, original board armies and wallets, native
 * turn-one shipments and battle admission. Only conserved card/Traitor custody
 * is staged. Basic retains five physical Sardaukar without Advanced strength. */
export function createHarassHomeworldArrakisFixture(options: HarassHomeworldArrakisOptions = {}): HarassHomeworldArrakisFixture {
  const ids = options.seatIds ?? ['emperor', 'guild'];
  let game = options.initial ? structuredClone(options.initial)
    : createGame('HARASSHWARRAKIS', newPlayer(ids[0], 'Emperor', 'emperor'), options.advanced ?? false);
  if (!options.initial) joinGame(game, newPlayer(ids[1], 'Guild', 'guild'));
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    game.ecazTreachery === true && game.homeworlds && game.players.every(p => p.hand.length === 0),
  'Continue an undealt lobby or its original fresh Homeworld independent-card setup');
  assert.deepEqual(game.players.map(p => p.faction).sort(), ['emperor', 'guild']);
  assert.deepEqual(game.expansions, []);
  assert.equal(game.advanced, options.advanced ?? game.advanced);
  if (game.status === 'lobby') {
    assert.ok(!game.ecazTreachery, 'Select independent cards through the initializer, not a redeal');
    game.homeworlds = { custody: null };
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
    game = initialize(game);
  }
  const initial = structuredClone(game), nativeSteps: HarassHomeworldArrakisStep[] = [];
  game = advanceHarassHomeworldArrakis(game, g => g.status === 'playing', nativeSteps);
  assertHarassHomeworldArrakisCustody(game);
  const afterSetup = structuredClone(game);
  const owner = game.players.find(p => p.faction === 'emperor')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const locationTerritory = 'tueks_sietch', sector = territory(locationTerritory).sectors[0];
  const location = `${locationTerritory}:${sector}`;
  const shipments: HarassHomeworldArrakisFixture['shipments'] = [];
  const act = (step: HarassHomeworldArrakisStep) => {
    nativeSteps.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  };
  const until = (predicate: (state: Game) => boolean) => { game = advanceHarassHomeworldArrakis(game, predicate, nativeSteps); };
  // Follow actual turn order (including the Guild's genuine timing choice).
  const waiting = new Set([owner, opponent]);
  until(g => g.phase === 5 && harassHomeworldArrakisClean(g));
  while (waiting.size) {
    const actor = game.active!;
    assert.ok(waiting.has(actor), 'Each original shipment turn is consumed once');
    const imperial = actor === owner;
    const sources = imperial ? game.advanced
      ? { 'homeworld:emperor': { normal: 3, elite: 0 }, 'homeworld:emperor:salusa': { normal: 0, elite: 4 } }
      : { 'homeworld:emperor': { normal: 3, elite: 4 } }
      : { 'homeworld:guild': { normal: 2, elite: 0 } };
    const step: HarassHomeworldArrakisStep = { actor, action: { type: 'ship', territory: locationTerritory,
      sector, amount: imperial ? 7 : 2, elite: imperial ? 4 : 0, homeworldSources: sources, allyPayment: 0 } };
    const before = structuredClone(game); act(step); until(harassHomeworldArrakisClean);
    shipments.push({ before, after: structuredClone(game), step });
    waiting.delete(actor); act({ actor, action: { type: 'endMovement' } });
    until(g => (g.phase === 5 || g.phase === 6) && harassHomeworldArrakisClean(g));
  }
  until(g => g.phase === 6 && harassHomeworldArrakisClean(g));
  for (const player of game.players) { game.deck.push(...player.hand); player.hand = []; }
  takeHarassCard(game, owner, 'ecaz-harass-withdraw');
  const staging = ['After genuine setup and native shipments: return unselected original hands to the remaining deck and conserve the physical Harass & Withdraw into the Emperor hand. No forces, wallets, phases or histories are staged.'];
  const winner = options.outcome === 'winner';
  const ownLeaders = harassHomeworldArrakisPlayer(game, owner).leaders.filter(l => !l.dead)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id));
  const otherLeaders = harassHomeworldArrakisPlayer(game, opponent).leaders.filter(l => !l.dead)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id));
  const own = winner ? ownLeaders.at(-1)! : ownLeaders[0];
  const other = winner ? otherLeaders[0] : otherLeaders.at(-1)!;
  if (options.traitor === 'owner' || options.traitor === 'both') exchangeTraitor(game, owner, other.id, staging);
  if (options.traitor === 'opponent' || options.traitor === 'both') exchangeTraitor(game, opponent, own.id, staging);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(c => c.territory === locationTerritory);
  assert.ok(choice);
  const battleStep: HarassHomeworldArrakisStep = { actor: choice.chooser, action: { type: 'chooseBattle',
    territory: locationTerritory, target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep); game = finishHarassPreparation(game);
  assert.ok(game.battle && !game.battle.revealed && harassHomeworldArrakisClean(game));
  assert.equal(Object.keys(game.battle.plans).length, 0);
  const slot = options.slot ?? 'defense';
  const planActions: HarassHomeworldArrakisFixture['planActions'] = [
    { actor: owner, action: { type: 'battlePlan', dial: 2, support: game.advanced ? 1 : 0,
      leader: own.id, weapon: slot === 'weapon' ? 'ecaz-harass-withdraw' : null,
      defense: slot === 'defense' ? 'ecaz-harass-withdraw' : null } },
    { actor: opponent, action: { type: 'battlePlan', dial: winner ? 0 : 3,
      support: game.advanced && !winner ? 3 : 0, leader: other.id } },
  ];
  assertHarassHomeworldArrakisCustody(game);
  return { initial, afterSetup, beforeBattle, game, owner, opponent, territory: locationTerritory,
    location, planActions, battleStep, shipments, nativeSteps, staging };
}
export function sealHarassHomeworldArrakisPlan(game: Game, step: HarassHomeworldArrakisStep): Game {
  return finishHarassPreparation(applyAction(game, step.actor, step.action));
}
export function revealHarassHomeworldArrakisBattle(fixture: HarassHomeworldArrakisFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.planActions) game = sealHarassHomeworldArrakisPlan(game, step);
  assert.equal(game.battle?.revealed, true);
  assert.equal(game.decision?.kind, 'harassWithdraw');
  return game;
}
/** Enumerate actual current legal complete allocations, not guessed dials. */
export function pendingHarassHomeworldArrakisAllocations(game: Game, actor: string): HarassWithdrawSelection[] {
  const offer = viewGame(game, actor).battle?.harassAllocation;
  assert.ok(offer && !offer.selection && game.decision?.kind === 'harassWithdraw');
  assert.equal(Object.keys(offer.context.locations).length, 1);
  const [location, pool] = Object.entries(offer.context.locations)[0];
  return harassWithdrawCommitments(offer.context, offer.dial, offer.support).map(committed => ({
    [location]: { normal: pool.normal - committed.normal, elite: pool.elite - committed.elite },
  }));
}
export function chooseHarassHomeworldArrakisAllocation(game: Game, actor: string, returns: HarassWithdrawSelection): Game {
  assert.equal(game.decision?.kind, 'harassWithdraw');
  return applyAction(game, actor, { type: 'decision', event: game.decision.event, returns });
}
/** Native Traitor declarations, losses, card retention and cleanup. Allocation
 * remains an explicit after-reveal human boundary unless supplied by the caller. */
export function finishHarassHomeworldArrakisBattle(state: Game,
  options: { callers?: string[]; returns?: HarassWithdrawSelection } = {},
  actions?: HarassHomeworldArrakisStep[]): Game {
  let game = state;
  for (let n = 0; n < 200; n++) {
    if (!game.battle && harassHomeworldArrakisClean(game)) return game;
    let step: HarassHomeworldArrakisStep | null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'harassWithdraw') {
      assert.ok(options.returns, 'Choose actual revealed typed returns');
      step = { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, returns: options.returns } };
    } else step = nextHarassHomeworldArrakisStep(game);
    assert.ok(step);
    if (step.action.type === 'traitorCall') step.action.call = options.callers?.includes(step.actor) ?? false;
    actions?.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  throw Error('Original Homeworld Harass aftermath did not finish');
}
