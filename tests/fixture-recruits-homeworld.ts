import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazTreacheryGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { nativeShipmentSources } from '../game/homeworld-options';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { nextHarassHomeworldStep } from './fixture-harass-homeworld';
import { finishHarassPreparation, takeHarassCard } from './fixture-harass-withdraw';

export type RecruitsHomeworldStep = { actor: string; action: Action };
export type RecruitsHomeworldFixture = {
  initial: Game;
  afterSetup: Game;
  game: Game;
  nativeSteps: RecruitsHomeworldStep[];
  staging: string[];
};
export const recruitsHomeworldPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
};
export const recruitsHomeworldClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

export function advanceRecruitsHomeworld(game: Game, until: (game: Game) => boolean,
  steps?: RecruitsHomeworldStep[]): Game {
  for (let n = 0; n < 2000; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'Native programme must reach its requested Revival');
    const step = nextHarassHomeworldStep(game);
    assert.ok(step, 'Native continuation requires a real battle plan');
    steps?.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  throw Error('Native World Recruits programme did not reach its boundary');
}

export function assertRecruitsHomeworldInventory(game: Game): void {
  homeworldGameIntegrity(game);
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((a, b) => a + b, 0), 20);
    assert.ok(Object.keys(player.forces).every(key => !key.startsWith('homeworld:')));
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((a, b) => a + b, 0), player.faction === 'fremen' ? 3 : 5);
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(), [...treacheryDeck([]), ...ecazTreacheryCards()].map(c => c.id).sort());
}

/** Fresh classic four-seat setup; no phase, population, wallet, dead-counter or
 * revival receipt assignment. Only original hands/unopened Spice Cards are
 * positioned, then actual shipments and two zero-dial battles create the dead. */
export function createRecruitsHomeworldFixture(options: {
  advanced?: boolean;
  seatIds?: readonly [string, string, string, string];
  initial?: Game;
} = {}): RecruitsHomeworldFixture {
  const ids = options.seatIds ?? ['emperor', 'fremen', 'atreides', 'guild'];
  let game = options.initial ? structuredClone(options.initial) :
    createGame('RECRUITSWORLD', newPlayer(ids[0], 'Emperor', 'emperor'), options.advanced ?? false);
  if (!options.initial) for (const [index, faction] of ['fremen', 'atreides', 'guild'].entries())
    joinGame(game, newPlayer(ids[index + 1], faction, faction as 'fremen' | 'atreides' | 'guild'));
  assert.equal(game.status, 'lobby'); assert.deepEqual(game.expansions, []);
  assert.deepEqual(game.players.map(p => p.faction), ['emperor', 'fremen', 'atreides', 'guild']);
  if (!game.homeworlds) game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  const nativeSteps: RecruitsHomeworldStep[] = [];
  const act = (actor: string, action: Action) => {
    nativeSteps.push({ actor, action: structuredClone(action) }); game = applyAction(game, actor, action);
  };
  for (const p of game.players) if (!p.ready) act(p.id, { type: 'ready' });
  const initial = structuredClone(game);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array); new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255); return array;
  };
  try { game = initializeEcazTreacheryGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
  game = advanceRecruitsHomeworld(game, g => g.status === 'playing', nativeSteps);
  const afterSetup = structuredClone(game);
  const staging = ['Return initial real hands to the unopened deck; no battle weapons, fake counters or wallet assignments.'];
  for (const p of game.players) { game.deck.push(...p.hand); p.hand = []; }
  // Original non-worm cards keep the first Blow away from an unrelated riding
  // decision. This is not a fabricated Spice Card or phase assignment.
  for (let i = 0; i < (game.advanced ? 4 : 2); i++) {
    const at = game.spiceDeck.findIndex((card, index) => index >= i && 'territory' in card && !card.discovery);
    assert.ok(at >= 0); game.spiceDeck.splice(i, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  staging.push('Position unopened original first-Blow non-worm cards; native later decks and history stay.');
  const shipments = new Map<string, { amount: number; elite: number; territory: string; sector: number }>([
    [ids[0], { amount: 3, elite: 0, territory: 'sietch_tabr', sector: 14 }],
    [ids[1], { amount: 8, elite: 3, territory: 'sietch_tabr', sector: 14 }],
    [ids[3], { amount: 3, elite: 0, territory: 'arrakeen', sector: 10 }],
  ]);
  game = advanceRecruitsHomeworld(game, g => g.phase === 5 && recruitsHomeworldClean(g), nativeSteps);
  while (game.phase === 5) {
    const actor = game.active!;
    const request = recruitsHomeworldClean(game) ? shipments.get(actor) : undefined;
    if (request) {
      const sources = nativeShipmentSources(viewGame(game, actor), request.amount, request.elite);
      assert.ok(sources, 'Original typed shipment must have native counters');
      act(actor, { type: 'ship', ...request, homeworldSources: sources });
      shipments.delete(actor);
    } else {
      const step = nextHarassHomeworldStep(game); assert.ok(step); act(step.actor, step.action);
    }
  }
  game = advanceRecruitsHomeworld(game, g => g.phase === 6 && recruitsHomeworldClean(g), nativeSteps);
  while (game.phase === 6) {
    if (recruitsHomeworldClean(game) && !game.battle && game.active) {
      const choice = viewGame(game, game.active).battleChoices[0];
      assert.ok(choice, 'Actual invaded stronghold must expose its battle choice');
      act(choice.chooser, { type: 'chooseBattle', territory: choice.territory,
        target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
    }
    if (game.battle && !game.battle.revealed) {
      game = finishHarassPreparation(game);
      const battle = game.battle!;
      for (const actor of [battle.attacker, battle.defender]) {
        if (game.battle!.plans[actor]) continue;
        const p = recruitsHomeworldPlayer(game, actor);
        const leaders = p.leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => a.strength - b.strength);
        const leader = actor === ids[0] || actor === ids[3] ? leaders.at(-1) : leaders[0]; assert.ok(leader);
        act(actor, { type: 'battlePlan', leader: leader.id, dial: 0, support: 0 });
        game = finishHarassPreparation(game);
      }
    } else {
      const step = nextHarassHomeworldStep(game); assert.ok(step); act(step.actor, step.action);
    }
  }
  game = advanceRecruitsHomeworld(game, g => g.turn === 2 && g.phase === 4 && recruitsHomeworldClean(g), nativeSteps);
  // Conserve the actual independent card after real casualties, not a fabricated
  // draw/auction claim. Its holder is explicit in all smoke/test descriptions.
  takeHarassCard(game, ids[0], RECRUITS_CARD_ID);
  staging.push('Conserve the existing physical Recruits from its original zone to Emperor at quiet second-turn Revival.');
  assert.equal(recruitsHomeworldPlayer(game, ids[1]).reserves, 2);
  assert.equal(recruitsHomeworldPlayer(game, ids[1]).tanks, 18);
  assert.equal(recruitsHomeworldPlayer(game, ids[2]).tanks, 10);
  assertRecruitsHomeworldInventory(game);
  return { initial, afterSetup, game, nativeSteps, staging };
}
