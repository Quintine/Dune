import assert from 'node:assert/strict';
import { applyAction, createGame, initializeHomeworldOccupationGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';

/** Drive original phase/control producers, never synthesize a paid receipt or
 * advance the phase clock by assignment. Tests may stop before any choice. */
export function advanceOriginal(game: Game, stop: (game: Game) => boolean, limit = 600): Game {
  for (let step = 0; (game.phaseOpening || !stop(game)) && step < limit; step++) {
    let choice: { player: string; action: Action } | undefined;
    if (game.phaseOpening) {
      const player = game.players.find(player => !game.phaseOpening!.passed.includes(player.id));
      if (player) choice = { player: player.id, action: { type: 'ready' } };
    } else if (game.response) {
      const player = game.players.find(player => !game.response!.passed.includes(player.id));
      if (player) choice = { player: player.id, action: { type: 'passResponse' } };
    }
    if (!choice) for (const player of game.players) {
      const view = viewGame(game, player.id);
      view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (!action) continue;
      if (action.type === 'stormDial') action.amount = 0;
      choice = { player: player.id, action };
      break;
    }
    assert.ok(choice, 'original source progression must have a legal next action');
    game = applyAction(game, choice.player, choice.action);
  }
  assert.ok(!game.phaseOpening && stop(game), 'original source progression must reach its settled requested boundary');
  return game;
}

export function buyOriginalNormalLot(game: Game, buyer: string, amount: number): Game {
  assert.ok(game.auction && !game.phaseOpening && !game.response && !game.decision);
  const card = game.auction.cards[game.auction.index].id;
  for (let step = 0; game.auction!.active !== buyer && step < game.players.length; step++)
    game = applyAction(game, game.auction!.active, { type: 'passBid' });
  assert.equal(game.auction!.active, buyer);
  game = applyAction(game, buyer, { type: 'bid', amount, allyPayment: 0 });
  for (let step = 0; !game.currentAuctionSale && !game.players.find(player => player.id === buyer)!.hand.some(held => held.id === card) &&
      step < game.players.length + 2; step++) {
    if (game.decision?.kind === 'auctionPayment')
      game = applyAction(game, buyer, { type: 'decision', karama: false });
    else game = applyAction(game, game.auction!.active, { type: 'passBid' });
  }
  assert.ok(game.players.find(player => player.id === buyer)!.hand.some(held => held.id === card),
    'the original purchase producer must deliver its actual physical card');
  return game;
}

export function cash(game: Game): Record<string, number> {
  return Object.fromEntries(game.players.map(player => [player.id, player.spice]));
}

/** Fresh original Collection roster includes Ecaz shared legs and a real
 * Harkonnen occupier; the ordinary setup inventory is never replaced. */
export function freshSouthernProducerGame(): Game {
  let game = createGame('SOUTHERNPRODUCER', newPlayer('native', 'Fremen', 'fremen'), true, ['ecaz']);
  for (const [id, faction] of [['occupier', 'harkonnen'], ['ally', 'guild'], ['ecaz', 'ecaz'], ['atreides', 'atreides']] as const)
    joinGame(game, newPlayer(id, id, faction));
  game = applyAction(game, 'native', { type: 'homeworlds', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeHomeworldOccupationGameForAudit(game);
  return advanceOriginal(game, game => game.status === 'playing');
}

/** Original native Guild payment can coexist with a BG accompaniment choice. */
export function freshGuildAdvisorProducerGame(): Game {
  let game = createGame('GUILDADVISORPRODUCER', newPlayer('native', 'Guild', 'guild'), true);
  for (const [id, faction] of [['occupier', 'atreides'], ['observer', 'beneGesserit'], ['buyer', 'emperor']] as const)
    joinGame(game, newPlayer(id, id, faction));
  game = applyAction(game, 'native', { type: 'homeworlds', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  return advanceOriginal(initializeHomeworldOccupationGameForAudit(game), game => game.status === 'playing');
}
