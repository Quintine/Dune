import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';

/** Genuine original lobby/setup/first Storm; later battle components are staged by conserved moves. */
export function initializeSemutaTechGame(advanced = false): Game {
  let game = createGame('SEMUTATECH', newPlayer('r', 'Richese', 'richese'), advanced, ['choam', 'ix']);
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('e', 'Tleilaxu', 'tleilaxu'));
  game = applyAction(game, 'r', { type: 'techTokens', enabled: true });
  for (const player of game.players) { player.bot = 'Medium'; player.ready = true; }
  game = initializeSemutaGameForAudit(game);
  for (let step = 0; (game.status === 'setup' || Object.values(game.techTokens!).some(token => !token.owner)) && step < 160; step++) {
    let next: Game | undefined;
    for (const player of game.players) {
      const action = botActions(viewGame(game, player.id))[0];
      if (action) { next = applyAction(game, player.id, action); break; }
    }
    assert.ok(next, 'Original setup and first Storm need a legal native continuation.');
    game = next;
  }
  assert.equal(game.status, 'playing');
  assert.ok(Object.values(game.techTokens!).every(token => token.owner));
  assert.equal(game.techTokens!.axlotl.owner, 'e');
  return game;
}

export function semutaTechBattleFixture(advanced = false): { game: Game; semuta: string; weapon: string; defense: string; cards: string[] } {
  const game = initializeSemutaTechGame(advanced);
  game.deck.push(...game.players.flatMap(player => player.hand));
  for (const player of game.players) player.hand = [];
  const take = (id: string) => {
    for (const zone of [game.deck, game.discard, game.richeseCache!]) {
      const index = zone.findIndex(card => card.id === id);
      if (index >= 0) return zone.splice(index, 1)[0];
    }
    throw new Error(`Missing physical ${id}`);
  };
  const semuta = take(SEMUTA_DRUG_ID);
  const weapon = take(game.deck.find(card => card.kind === 'projectile')!.id);
  const defense = take(game.deck.find(card => card.kind === 'snooper')!.id);
  game.players.find(player => player.id === 'r')!.hand.push(semuta);
  game.players.find(player => player.id === 'a')!.hand.push(weapon);
  game.players.find(player => player.id === 'e')!.hand.push(defense);
  for (const player of game.players) {
    Object.assign(player, { forces: player.id === 'r' ? {} : { 'arrakeen:10': 5 }, reserves: player.id === 'r' ? 20 : 15, tanks: 0 });
  }
  // Stage two public tokens with the loser to exercise the original owned choice;
  // all three physical tokens and their existing ledgers remain original.
  game.techTokens!.heighliners.owner = 'e';
  game.techTokens!.production.owner = 'r';
  Object.assign(game, { turn: 2, phase: 6, active: 'a', order: ['a', 'e', 'r'], ready: [],
    response: null, decision: null, phaseOpening: null, movementRemaining: [] });
  const cards = [...game.deck, ...game.discard, ...game.richeseCache!, ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.equal(new Set(cards).size, cards.length);
  return { game, semuta: semuta.id, weapon: weapon.id, defense: defense.id, cards };
}
