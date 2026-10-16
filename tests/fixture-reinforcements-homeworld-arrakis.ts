import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazTreacheryGameForAudit, joinGame,
  newPlayer, viewGame, type Game,
} from '../game/engine';
import { territory } from '../game/board';
import { type NativeReserveSelections } from '../game/homeworld-native-reserves';
import { nativeShipmentSources } from '../game/homeworld-options';
import { traitorDeck } from '../game/traitors';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD, type HarassWithdrawSelection } from '../game/harass-withdraw';
import {
  advanceHarassHomeworldArrakis, createHarassHomeworldArrakisFixture,
  harassHomeworldArrakisClean, harassHomeworldArrakisPlayer,
  nextHarassHomeworldArrakisStep, type HarassHomeworldArrakisStep,
} from './fixture-harass-homeworld-arrakis';
import { finishHarassPreparation, takeHarassCard } from './fixture-harass-withdraw';
import { assertRecruitsHomeworldInventory } from './fixture-recruits-homeworld';

export type ReinforcementsHomeworldArrakisStep = HarassHomeworldArrakisStep;
export type ReinforcementsHomeworldArrakisOptions = {
  advanced?: boolean;
  slot?: 'weapon' | 'defense';
  /** Emperor ships 3N4E; Fremen free-ship 6N, 7N or 7N1E respectively. */
  reserves?: 'normal' | 'mixed' | 'elite' | 'shortage';
  outcome?: 'winner' | 'loser';
  harass?: boolean;
  traitor?: 'owner' | 'opponent' | 'both';
  explosion?: boolean;
  seatIds?: [string, string];
  /** Fresh undealt classic Emperor/Guild or Fremen/Guild lobby. */
  initial?: Game;
};
export type ReinforcementsHomeworldArrakisFixture = {
  initial: Game;
  afterSetup: Game;
  beforeBattle: Game;
  game: Game;
  owner: string;
  opponent: string;
  territory: string;
  location: string;
  planActions: [ReinforcementsHomeworldArrakisStep, ReinforcementsHomeworldArrakisStep];
  battleStep: ReinforcementsHomeworldArrakisStep;
  shipments: { before: Game; after: Game; step: ReinforcementsHomeworldArrakisStep }[];
  nativeSteps: ReinforcementsHomeworldArrakisStep[];
  staging: string[];
  fee: { normal: number; elite: number };
  sources: NativeReserveSelections;
};
export const reinforcementsHomeworldArrakisPlayer = harassHomeworldArrakisPlayer;
export const reinforcementsHomeworldArrakisClean = harassHomeworldArrakisClean;

/** All counters remain in original native homes, original Arrakis armies or
 * Tanks. This programme has no visitors. Includes the original three Fedaykin
 * (not five invented stars), Sardaukar, physical 36-card deck and Traitor pack. */
export function assertReinforcementsHomeworldArrakisInventory(game: Game): void {
  assertRecruitsHomeworldInventory(game);
  assert.deepEqual(game.homeworlds!.custody!.visitors, {});
  assert.deepEqual([...game.traitorReserve!, ...game.players.flatMap(p => [...p.traitors, ...p.traitorChoices])].sort(),
    traitorDeck(game.players).sort());
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
  const player = reinforcementsHomeworldArrakisPlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0]; assert.ok(returned);
  const index = game.traitorReserve!.indexOf(identity);
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(index >= 0 || donor, 'Only exchange an original physical Traitor');
  if (index >= 0) game.traitorReserve![index] = returned;
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Conserved original Traitor ${identity} exchanged with ${returned} into ${actor}'s hand.`);
}

function freshFremenProgramme(options: ReinforcementsHomeworldArrakisOptions) {
  const ids = options.seatIds ?? ['fremen', 'guild'];
  let game = options.initial ? structuredClone(options.initial) :
    createGame('REINFORCEMENTSWORLDARRAKIS', newPlayer(ids[0], 'Fremen', 'fremen'), options.advanced ?? false);
  if (!options.initial) joinGame(game, newPlayer(ids[1], 'Guild', 'guild'));
  assert.equal(game.status, 'lobby');
  assert.deepEqual(game.expansions, []);
  assert.deepEqual(game.players.map(p => p.faction).sort(), ['fremen', 'guild']);
  assert.equal(game.advanced, options.advanced ?? game.advanced);
  const nativeSteps: ReinforcementsHomeworldArrakisStep[] = [];
  const act = (step: ReinforcementsHomeworldArrakisStep) => {
    nativeSteps.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  };
  if (!game.homeworlds) act({ actor: game.host, action: { type: 'homeworlds', enabled: true } });
  for (const p of game.players) if (!p.ready) act({ actor: p.id, action: { type: 'ready' } });
  const initial = structuredClone(game);
  game = initialize(game);
  for (let n = 0; n < 180 && game.status !== 'playing'; n++) {
    const step = nextHarassHomeworldArrakisStep(game); assert.ok(step);
    if (step.action.type === 'fremenSetup') step.action = { type: 'fremenSetup',
      placements: { [`sietch_tabr:${territory('sietch_tabr').sectors[0]}`]: 10 }, elitePlacements: {} };
    act(step);
  }
  assert.equal(game.status, 'playing', 'Finish every original setup choice');
  const afterSetup = structuredClone(game);
  const owner = game.players.find(p => p.faction === 'fremen')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const staging = ['Original classic Fremen/Guild Homeworld setup; only conserved hands and unopened Spice Cards are positioned. No counters, wallets, phases, history or receipts are assigned.'];
  // Keep turn-one Blow away from unrelated worm-riding decisions by positioning
  // original unopened non-worm Spice Cards, as in the native Recruits programme.
  for (let i = 0; i < (game.advanced ? 4 : 2); i++) {
    const at = game.spiceDeck.findIndex((card, index) => index >= i && 'territory' in card && !card.discovery);
    assert.ok(at >= 0); game.spiceDeck.splice(i, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  staging.push('Position unopened original first-Blow non-worm Spice Cards; no draw, phase or army is fabricated.');
  const locationTerritory = 'sietch_tabr', sector = territory(locationTerritory).sectors[0];
  const location = `${locationTerritory}:${sector}`;
  const shipments: ReinforcementsHomeworldArrakisFixture['shipments'] = [];
  const waiting = new Set([owner, opponent]);
  const until = (predicate: (state: Game) => boolean) => {
    game = advanceHarassHomeworldArrakis(game, predicate, nativeSteps);
  };
  until(g => g.phase === 5 && harassHomeworldArrakisClean(g));
  while (waiting.size) {
    const actor = game.active!; assert.ok(waiting.has(actor));
    const isFremen = actor === owner;
    const amount = isFremen ? options.reserves === 'mixed' ? 6 : options.reserves === 'shortage' ? 8 : 7
      : options.outcome === 'loser' ? 3 : 2;
    const elite = isFremen && options.reserves === 'shortage' ? 1 : 0;
    const sources = nativeShipmentSources(viewGame(game, actor), amount, elite); assert.ok(sources);
    const step: ReinforcementsHomeworldArrakisStep = { actor, action: { type: 'ship',
      territory: locationTerritory, sector, amount, elite, homeworldSources: sources, allyPayment: 0 } };
    const before = structuredClone(game); act(step); until(harassHomeworldArrakisClean);
    shipments.push({ before, after: structuredClone(game), step });
    waiting.delete(actor); act({ actor, action: { type: 'endMovement' } });
    until(g => (g.phase === 5 || g.phase === 6) && harassHomeworldArrakisClean(g));
  }
  until(g => g.phase === 6 && harassHomeworldArrakisClean(g));
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(c => c.territory === locationTerritory); assert.ok(choice);
  const battleStep: ReinforcementsHomeworldArrakisStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: locationTerritory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep); game = finishHarassPreparation(game);
  return { initial, afterSetup, beforeBattle, game, owner, opponent, territory: locationTerritory,
    location, battleStep, shipments, nativeSteps, staging };
}

/** Real turn-one native setup, shipment and battle admission. Emperor uses the
 * existing genuine 3N4E Tuek programme. Fremen free-shipping removes real normal
 * reserves and leaves real Fedaykin in their native World; never assign a pool.
 * All physical hand/Traitor staging is explicit and conserved. */
export function createReinforcementsHomeworldArrakisFixture(
  options: ReinforcementsHomeworldArrakisOptions = {},
): ReinforcementsHomeworldArrakisFixture {
  const base = options.reserves && options.reserves !== 'normal' ? freshFremenProgramme(options) :
    createHarassHomeworldArrakisFixture({ advanced: options.advanced, initial: options.initial,
      seatIds: options.seatIds, outcome: options.outcome, slot: options.slot });
  const { owner, opponent, location } = base;
  const game = base.game;
  const staging = [...base.staging];
  for (const p of game.players) { game.deck.push(...p.hand); p.hand = []; }
  takeHarassCard(game, owner, REINFORCEMENTS_CARD);
  if (options.harass) takeHarassCard(game, owner, HARASS_WITHDRAW_CARD);
  staging.push(`After genuine shipments/battle admission, conserve original hands into the remaining deck and place physical Reinforcements${options.harass ? ' plus Harass & Withdraw' : ''} into ${owner}'s hand.`);
  const own = reinforcementsHomeworldArrakisPlayer(game, owner);
  const other = reinforcementsHomeworldArrakisPlayer(game, opponent);
  const ownLeader = own.leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  const otherLeader = other.leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  if (options.traitor === 'owner' || options.traitor === 'both') exchangeTraitor(game, owner, otherLeader.id, staging);
  if (options.traitor === 'opponent' || options.traitor === 'both') exchangeTraitor(game, opponent, ownLeader.id, staging);
  const normal = Math.min(3, own.reserves - (own.elites?.reserves ?? 0));
  const fee = { normal, elite: 3 - normal };
  const sources: NativeReserveSelections = { [`homeworld:${own.faction}`]: { ...fee } };
  const slot = options.slot ?? 'weapon';
  const planActions: ReinforcementsHomeworldArrakisFixture['planActions'] = [
    { actor: owner, action: { type: 'battlePlan', dial: 2, support: game.advanced && own.faction !== 'fremen' ? 1 : 0,
      leader: ownLeader.id, weapon: slot === 'weapon' ? REINFORCEMENTS_CARD : options.harass ? HARASS_WITHDRAW_CARD : null,
      defense: slot === 'defense' ? REINFORCEMENTS_CARD : options.harass ? HARASS_WITHDRAW_CARD : null,
      reinforcementsSources: sources } },
    { actor: opponent, action: { type: 'battlePlan', dial: options.outcome === 'loser' ? 3 : 0,
      support: options.outcome === 'loser' && game.advanced ? 3 : 0, leader: otherLeader.id } },
  ];
  if (options.explosion) {
    // The opposing side can naturally play its own Lasgun + Shield together,
    // leaving both of the utility user's physical slots available for R + H.
    for (const kind of ['lasgun', 'shield'] as const) {
      const card = game.deck.find(c => c.kind === kind); assert.ok(card);
      takeHarassCard(game, opponent, card.id);
      planActions[1].action[kind === 'lasgun' ? 'weapon' : 'defense'] = card.id;
    }
    staging.push('Conserve the original Lasgun and Shield from remaining deck into the opposing hand for an actual explosion plan.');
  }
  assertReinforcementsHomeworldArrakisInventory(game);
  return { ...base, game, planActions, staging, fee, sources, location };
}

export function sealReinforcementsHomeworldArrakisPlan(game: Game, step: ReinforcementsHomeworldArrakisStep): Game {
  return finishHarassPreparation(applyAction(game, step.actor, step.action));
}
export function revealReinforcementsHomeworldArrakisBattle(fixture: ReinforcementsHomeworldArrakisFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.planActions) game = sealReinforcementsHomeworldArrakisPlan(game, step);
  assert.equal(game.battle?.revealed, true);
  return game;
}

/** Keeps Harass allocation and typed losses explicit human choices; normal
 * native continuation handles actual calls, retention and mandatory disposal. */
export function finishReinforcementsHomeworldArrakisBattle(state: Game,
  options: { callers?: string[]; returns?: HarassWithdrawSelection; losses?: { normal: number; elite: number } } = {},
  actions?: ReinforcementsHomeworldArrakisStep[]): Game {
  let game = state;
  for (let n = 0; n < 200; n++) {
    if (!game.battle && harassHomeworldArrakisClean(game)) return game;
    let step: ReinforcementsHomeworldArrakisStep | null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'harassWithdraw') {
      assert.ok(options.returns, 'Choose actual revealed physical Harass returns');
      step = { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, returns: options.returns } };
    } else if (!game.response && !game.phaseOpening && game.decision?.kind === 'battleLosses' && options.losses) {
      const choice = game.decision.options.findIndex(c => c.normal === options.losses!.normal && c.elite === options.losses!.elite);
      assert.ok(choice >= 0, 'Selected typed casualties must be an actual original commitment');
      step = { actor: game.decision.player, action: { type: 'decision', choice } };
    } else step = nextHarassHomeworldArrakisStep(game);
    assert.ok(step);
    if (step.action.type === 'traitorCall') step.action.call = options.callers?.includes(step.actor) ?? false;
    actions?.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  throw Error('Native Arrakis Reinforcements aftermath did not finish');
}
