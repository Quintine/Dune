import assert from 'node:assert/strict';
import { applyAction, createGame, initializeHomeworldOccupationGameForAudit, joinGame, newPlayer, type Game } from '../game/engine';
import { FACTIONS, type FactionId } from '../game/catalog';
import { TERRITORIES } from '../game/board';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { observeHomeworldOccupation } from '../game/homeworld-occupation-history';
import { advanceOriginal } from './fixture-homeworld-occupied-producers';

export const ecazSeat = (game: Game, id: string) => game.players.find(player => player.id === id)!;

/** Controlled positions are conserved test placements, NOT naturally achieved
 * games. Setup and source history are original; no synthetic source facts,
 * replacement deck, optional cards or fabricated occupation receipt is used. */
export function conserveEcazPosition(game: Game): void {
  const groups = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  for (const player of game.players) {
    const abroad = groups.filter(home => home.native !== player.id)
      .reduce((n, home) => n + (home.forces[player.id]?.normal ?? 0) + (home.forces[player.id]?.elite ?? 0), 0);
    player.tanks = 20 - player.reserves - abroad - Object.values(player.forces).reduce((a, n) => a + n, 0);
    if (player.elites) {
      const total = player.faction === 'fremen' ? 3 : player.faction === 'ixians' ? 7 : 5;
      const abroadElite = groups.filter(home => home.native !== player.id)
        .reduce((n, home) => n + (home.forces[player.id]?.elite ?? 0), 0);
      player.elites.tanks = total - player.elites.reserves - abroadElite - Object.values(player.elites.forces).reduce((a, n) => a + n, 0);
    }
  }
  homeworldGameIntegrity(game);
}

export function observeEcazPosition(game: Game, event: string, cause: 'change' | 'turnStart' | 'turnEnd' = 'change'): void {
  conserveEcazPosition(game);
  game.homeworldOccupationHistory = observeHomeworldOccupation(game.homeworldOccupationHistory!,
    homeworldContext(game), game.homeworlds!.custody!, game.turn, cause, event);
}

export function ecazHomeworldFixture(advanced = true, ally: FactionId = 'guild', holders: readonly ['ec' | 'al', 'ec' | 'al'] = ['ec', 'al']) {
  const factions = ['ecaz', ally, 'atreides', 'emperor', ...(ally === 'beneGesserit' ? ['guild'] : ['beneGesserit'])] as FactionId[];
  const expansions = [...new Set(factions.map(faction => FACTIONS.find(row => row.id === faction)!.expansion)
    .filter(expansion => expansion !== 'base'))];
  let game = createGame('ECAZHOMEWORLDVICTORY', newPlayer('ec', 'Ecaz', 'ecaz'), advanced, expansions);
  for (const [index, faction] of factions.slice(1).entries())
    joinGame(game, newPlayer(['al', 'at', 'em', 'observer'][index], faction, faction));
  game = applyAction(game, 'ec', { type: 'homeworlds', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeHomeworldOccupationGameForAudit(game);
  game = advanceOriginal(game, current => current.status === 'playing');
  const setup = structuredClone(game);
  game = advanceOriginal(game, current => current.phase === 5 && !current.response && !current.decision);
  const movement = structuredClone(game);
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
  const originalTanks = Object.fromEntries(game.players.map(player => [player.id, {
    normal: player.tanks, elite: player.elites?.tanks ?? 0,
  }]));
  for (const player of game.players) {
    Object.assign(player, { forces: {}, reserves: 20 - player.tanks, ally: null });
    delete player.advisors;
    if (player.elites) Object.assign(player.elites, {
      reserves: (player.faction === 'ixians' ? 7 : player.faction === 'fremen' ? 3 : 5) - player.elites.tanks,
      forces: {},
    });
  }
  const joint = TERRITORIES.find(site => site.type === 'stronghold' && !site.sectors.includes(game.storm))!;
  assert.ok(joint, 'Original Movement must have a non-storm joint stronghold.');
  const jointStronghold = joint.id;
  const jointLocation = `${joint.id}:${joint.sectors[0]}`;
  const custody = game.homeworlds!.custody!;
  custody.visitors = {
    'homeworld:atreides': { [holders[0]]: { normal: 1, elite: 0 } },
    'homeworld:emperor': { [holders[1]]: { normal: 1, elite: 0 } },
  };
  if (advanced) custody.salusa = { normal: 0, elite: 0 };
  ecazSeat(game, 'ec').ally = 'al';
  ecazSeat(game, 'al').ally = 'ec';
  ecazSeat(game, 'ec').forces = { [jointLocation]: 1 };
  ecazSeat(game, 'al').forces = { [jointLocation]: 1 };
  ecazSeat(game, 'ec').reserves = 7;
  ecazSeat(game, 'al').reserves = 20 - originalTanks.al.normal - 1 - holders.filter(holder => holder === 'al').length;
  for (const id of ['at', 'em']) {
    ecazSeat(game, id).reserves = 0;
    if (ecazSeat(game, id).elites) ecazSeat(game, id).elites!.reserves = 0;
  }
  observeEcazPosition(game, 'controlled-conserved-ecaz-two-native-worlds');
  for (const player of game.players) {
    assert.ok(player.tanks >= originalTanks[player.id].normal, 'Controlled position cannot resurrect original Tanks.');
    assert.ok((player.elites?.tanks ?? 0) >= originalTanks[player.id].elite, 'Controlled position cannot resurrect original special Tanks.');
  }
  assert.deepEqual([...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(player => player.hand)].map(card => card.id).sort(), cards);
  return { game, setup, movement, cards, jointStronghold, jointLocation };
}
