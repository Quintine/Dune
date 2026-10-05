import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeHomeworldOccupationGameForAudit,
  joinGame, newPlayer, viewGame, type Game,
} from '../game/engine';
import { FACTIONS, type FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { assertDefenseInventory } from './fixture-homeworld-occupied-defenses';

export const biddingPlayer = (game: Game, id: string) => game.players.find(player => player.id === id)!;

/** Original lobby, selected expansion decks and full original setup pipeline.
 * All later conserved positions are labelled controlled fixtures, not gameplay. */
export function freshBiddingGame(native: FactionId, ally: FactionId = 'emperor', advanced = true): Game {
  const roster: [string, FactionId][] = [
    ['native', native], ['occupier', 'guild'], ['ally', ally],
    ['observer', 'beneGesserit'], ['fremen', 'fremen'],
  ];
  const expansions = [...new Set(roster.map(([, faction]) =>
    FACTIONS.find(card => card.id === faction)!.expansion))].filter(expansion => expansion !== 'base');
  let game = createGame('OCCUPIEDBIDDING', newPlayer('native', native, native), advanced, expansions);
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
    assert.ok(progressed, 'original Bidding fixture setup has a legal next choice');
  }
  assert.equal(game.status, 'playing');
  assert.equal(game.homeworldOccupationPreview, true);
  assert.deepEqual(game.homeworldOccupationHistory!.qualifications, []);
  assertDefenseInventory(game);
  assert.equal(new Set(biddingPhysicalIds(game)).size, biddingPhysicalIds(game).length);
  return game;
}

/** Live physical ownership only: original knowledge aliases are not cards. */
export function biddingPhysicalIds(game: Game): string[] {
  return [
    ...game.players.flatMap(player => player.hand), ...game.deck, ...game.discard,
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.ornithopter ? [game.ornithopter.card] : []),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? []),
  ].map(card => card.id).sort();
}

/** Controlled original-card transfers to stage receiver capacity. No fake
 * Treachery card, duplicate or destruction is used to manufacture a full hand. */
export function stageBiddingHandSize(game: Game, id: string, count: number) {
  const original = biddingPhysicalIds(game);
  const player = biddingPlayer(game, id);
  while (player.hand.length > count) game.deck.push(player.hand.pop()!);
  while (player.hand.length < count) {
    const card = game.deck.shift() ?? game.discard.shift();
    assert.ok(card, 'capacity fixture requires an original drawable card');
    player.hand.push(card);
  }
  assert.equal(player.hand.length, count);
  assert.deepEqual(biddingPhysicalIds(game), original, 'controlled hand transfer conserves all original physical IDs');
}

/** Labelled conserved transfer from original stock, including already-dealt
 * cards. Random setup may deal every Karama; never fabricate a replacement. */
export function stageBiddingKarama(game: Game, id: string) {
  const original = biddingPhysicalIds(game), receiver = biddingPlayer(game, id);
  const held = receiver.hand.find(card => card.effect === 'karama');
  if (held) return held;
  const stock = [game.deck, game.discard, ...game.players.filter(player => player.id !== id).map(player => player.hand)];
  for (const source of stock) {
    const index = source.findIndex(card => card.effect === 'karama');
    if (index < 0) continue;
    const card = source.splice(index, 1)[0];
    receiver.hand.push(card);
    assert.deepEqual(biddingPhysicalIds(game), original);
    return card;
  }
  throw new Error('Original unused fixture stock has no Karama.');
}
