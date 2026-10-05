import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeHomeworldOccupationGameForAudit,
  joinGame, newPlayer, viewGame, type Game,
} from '../game/engine';
import { FACTIONS, type FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { observeHomeworldOccupation } from '../game/homeworld-occupation-history';
import { biddingPhysicalIds } from './fixture-homeworld-occupied-bidding';
import { assertDefenseInventory, clearDefenseNative } from './fixture-homeworld-occupied-defenses';

export const TUPILE_WORLD = 'homeworld:choam';
export const tupilePlayer = (game: Game, id: string) => game.players.find(player => player.id === id)!;

/** Real selected decks/lobby/fresh audit entry and all original setup choices.
 * Later positions are explicitly labelled conserved fixtures, not play traces. */
export function freshTupileFixture(advanced = true, occupierFaction: 'guild' | 'moritani' = 'guild') {
  const roster: [string, FactionId][] = [
    ['native', 'choam'], ['occupier', occupierFaction], ['ally', 'harkonnen'],
    ['observer', 'beneGesserit'], ['fremen', 'fremen'],
  ];
  const expansions = [...new Set(roster.map(([, faction]) =>
    FACTIONS.find(card => card.id === faction)!.expansion))].filter(expansion => expansion !== 'base');
  let game = createGame('OCCUPIEDTUPILE', newPlayer('native', 'native', 'choam'), advanced, expansions);
  for (const [id, faction] of roster.slice(1)) joinGame(game, newPlayer(id, id, faction));
  game = applyAction(game, 'native', { type: 'homeworlds', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeHomeworldOccupationGameForAudit(game);
  for (let step = 0; game.status === 'setup' && step < 100; step++) {
    let progressed = false;
    for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (!action) continue;
      game = applyAction(game, player.id, action);
      progressed = true;
      break;
    }
    assert.ok(progressed, 'original Tupile setup has a legal next choice');
  }
  assert.equal(game.status, 'playing');
  assert.equal(game.homeworldOccupationPreview, true);
  assert.deepEqual(game.homeworldOccupationHistory!.qualifications, []);
  assertDefenseInventory(game);
  assert.equal(game.homeworldTupilePreview, true, 'only the original fresh entry initializes this profile');
  const cards = biddingPhysicalIds(game);
  const setup = structuredClone(game);
  return { game, cards, setup };
}

export function recordTupilePosition(game: Game, label: string, cause: 'change' | 'turnStart' | 'turnEnd' = 'change') {
  game.homeworldOccupationHistory = observeHomeworldOccupation(game.homeworldOccupationHistory!,
    homeworldContext(game), game.homeworlds!.custody!, game.turn, cause,
    `controlled-tupile-${label}-${game.homeworldOccupationHistory!.sources.length}`);
  assertDefenseInventory(game);
  homeworldGameIntegrity(game);
}

/** Typed transfer from the actual normal/starred reserve pools. Reserves is the
 * aggregate pool; starred counters are a subset, not additional armies. */
export function addTupileForces(game: Game, id: string, normal = 1, elite = 0) {
  const player = tupilePlayer(game, id);
  assert.ok(player.reserves - (player.elites?.reserves ?? 0) >= normal);
  assert.ok(elite === 0 || player.elites && player.elites.reserves >= elite);
  player.reserves -= normal + elite;
  if (elite) player.elites!.reserves -= elite;
  const group = (game.homeworlds!.custody!.visitors[TUPILE_WORLD] ??= {})[id] ??= { normal: 0, elite: 0 };
  group.normal += normal;
  group.elite += elite;
  assertDefenseInventory(game);
}

export function removeTupileForces(game: Game, id: string) {
  const group = game.homeworlds!.custody!.visitors[TUPILE_WORLD][id];
  const player = tupilePlayer(game, id);
  player.reserves += group.normal + group.elite;
  if (group.elite) player.elites!.reserves += group.elite;
  delete game.homeworlds!.custody!.visitors[TUPILE_WORLD][id];
  if (!Object.keys(game.homeworlds!.custody!.visitors[TUPILE_WORLD]).length)
    delete game.homeworlds!.custody!.visitors[TUPILE_WORLD];
  assertDefenseInventory(game);
}

export function occupiedTupileFixture(advanced = true, allied = true) {
  const fixture = freshTupileFixture(advanced), game = fixture.game;
  clearDefenseNative(game, TUPILE_WORLD);
  if (allied) {
    tupilePlayer(game, 'occupier').ally = 'ally';
    tupilePlayer(game, 'ally').ally = 'occupier';
  }
  addTupileForces(game, 'occupier');
  recordTupilePosition(game, 'original-native-casualties-and-sole-arrival');
  assert.deepEqual(biddingPhysicalIds(game), fixture.cards);
  return fixture;
}

/** Conserved native repopulation fixture; no counters are created to cross high. */
export function restoreTupileNative(game: Game, amount: number) {
  const native = tupilePlayer(game, 'native');
  assert.ok(native.tanks >= amount);
  native.tanks -= amount;
  native.reserves += amount;
  assertDefenseInventory(game);
}

/** Original-card discard at the caller-owned atomic settlement boundary. The
 * helper itself neither chooses cards nor duplicates the original discard. */
export function discardTupileExcess(game: Game, id: string, limit: number) {
  const before = biddingPhysicalIds(game), player = tupilePlayer(game, id);
  while (player.hand.length > limit) game.discard.push(player.hand.pop()!);
  assert.deepEqual(biddingPhysicalIds(game), before);
}
