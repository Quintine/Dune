import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldOccupationGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { observeHomeworldOccupation } from '../game/homeworld-occupation-history';

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
export const defensePlayer = (game: Game, id: string) => game.players.find(p => p.id === id)!;

/** Original lobby and fresh Homeworld setup, completed through original legal
 * bot choices. Controlled positions below are fixtures, not natural play. */
export function freshDefenseGame(native: FactionId, advanced = true): Game {
  const expansion = native === 'tleilaxu' ? ['ix'] : native === 'moritani' ? ['ecaz'] : [];
  let game = createGame('OCCUPIEDDEFENSES', newPlayer('native', native, native), advanced, expansion);
  for (const [id, faction] of [
    ['occupier', 'guild'], ['ally', 'atreides'], ['opponent', 'harkonnen'], ['fremen', 'fremen'],
  ] as const) joinGame(game, newPlayer(id, id, faction));
  game = applyAction(game, 'native', { type: 'homeworlds', enabled: true });
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  game = initializeHomeworldOccupationGameForAudit(game);
  for (let step = 0; game.status === 'setup' && step < 80; step++) {
    let progressed = false;
    for (const p of game.players) {
      const view = viewGame(game, p.id);
      view.players.find(player => player.id === p.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (!action) continue;
      game = applyAction(game, p.id, action);
      progressed = true;
      break;
    }
    assert.ok(progressed, 'original fresh setup must have a legal next choice');
  }
  assert.equal(game.status, 'playing');
  assert.equal(game.homeworldOccupationPreview, true);
  assert.ok(game.homeworldOccupationHistory);
  assert.deepEqual(game.homeworldOccupationHistory.qualifications, []);
  assertDefenseInventory(game);
  return game;
}

export function recordDefensePosition(game: Game, label: string, cause: 'change' | 'turnEnd' = 'change') {
  game.homeworldOccupationHistory = observeHomeworldOccupation(
    game.homeworldOccupationHistory!, homeworldContext(game), game.homeworlds!.custody!,
    game.turn, cause, `controlled-defense-${label}-${game.homeworldOccupationHistory!.sources.length}`,
  );
  assertDefenseInventory(game);
}

/** Conserved native casualties: each physical normal/starred reserve counter
 * moves to its own Tanks pile; other worlds and Arrakis counters are untouched. */
export function clearDefenseNative(game: Game, world: string) {
  const home = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find(home => home.id === world)!;
  const forces = home.forces[home.native];
  const native = defensePlayer(game, home.native);
  native.reserves -= forces.normal + forces.elite;
  native.tanks += forces.normal + forces.elite;
  if (forces.elite) {
    native.elites!.reserves -= forces.elite;
    native.elites!.tanks += forces.elite;
  }
  if (home.secondary) game.homeworlds!.custody!.salusa = { normal: 0, elite: 0 };
}

/** Conserved normal reserve-to-visitor transfer; no qualification is fabricated. */
export function addDefenseVisitor(game: Game, world: string, id = 'occupier') {
  defensePlayer(game, id).reserves--;
  (game.homeworlds!.custody!.visitors[world] ??= {})[id] = { normal: 1, elite: 0 };
}

export function removeDefenseVisitor(game: Game, world: string, id = 'occupier') {
  const visitors = game.homeworlds!.custody!.visitors[world];
  const forces = visitors[id];
  assert.equal(forces.elite, 0);
  defensePlayer(game, id).reserves += forces.normal;
  delete visitors[id];
  if (!Object.keys(visitors).length) delete game.homeworlds!.custody!.visitors[world];
}

export function qualifyDefensePosition(game: Game, world: string) {
  clearDefenseNative(game, world);
  addDefenseVisitor(game, world);
  recordDefensePosition(game, 'conserved-native-casualties-and-sole-arrival');
  const fact = game.homeworldOccupationHistory!.qualifications.find(fact => fact.world === world)!;
  assert.equal(fact.player, 'occupier');
  assert.equal(fact.cause, 'sole');
  assert.equal(fact.turn, game.turn);
}

export function assertDefenseInventory(game: Game) {
  const groups = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  for (const p of game.players) {
    const visitors = groups.filter(home => home.native !== p.id).map(home => home.forces[p.id]);
    const away = visitors.reduce((n, group) => n + (group ? group.normal + group.elite : 0), 0);
    const starredAway = visitors.reduce((n, group) => n + (group?.elite ?? 0), 0);
    assert.equal(p.reserves + p.tanks + sum(p.forces) + away, 20, `${p.id} physical counters`);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + sum(p.elites.forces) + starredAway,
        p.faction === 'emperor' ? 5 : p.faction === 'fremen' ? 3 : 7, `${p.id} starred identity`);
      assert.ok(p.elites.reserves <= p.reserves);
      assert.ok(p.elites.tanks <= p.tanks);
      for (const [key, n] of Object.entries(p.elites.forces)) assert.ok(n <= p.forces[key]);
    }
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)];
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length, 'original Treachery IDs are unique');
}
