import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeHomeworldOccupationGameForAudit,
  joinGame, newPlayer, type Game,
} from '../game/engine';
import { FACTIONS, type FactionId } from '../game/catalog';
import {
  assertDefenseInventory, qualifyDefensePosition,
} from './fixture-homeworld-occupied-defenses';
import { biddingPhysicalIds, biddingPlayer, stageBiddingKarama } from './fixture-homeworld-occupied-bidding';
import { advanceOriginal } from './fixture-homeworld-occupied-producers';

export const privateLotPlayer = biddingPlayer;
export const privateLotPhysicalIds = biddingPhysicalIds;
export const privateLotReload = (game: Game): Game => JSON.parse(JSON.stringify(game));

/** Real fresh audit setup with the originally selected faction decks. Only the
 * subsequent conserved qualification/card positions are controlled fixtures. */
export function freshPrivateLotGame(excludeCardId?: string) {
  const roster: [string, FactionId][] = [
    ['nativeRichese', 'richese'], ['nativeAt', 'atreides'], ['occupier', 'guild'],
    ['ally', 'emperor'], ['rival', 'beneGesserit'], ['fremen', 'fremen'],
  ];
  const expansions = [...new Set(roster.map(([, faction]) =>
    FACTIONS.find(card => card.id === faction)!.expansion))].filter(expansion => expansion !== 'base');
  let game = createGame('OCCUPIEDPRIVATELOTS', newPlayer('nativeRichese', 'Richese', 'richese'), true, expansions);
  for (const [id, faction] of roster.slice(1)) joinGame(game, newPlayer(id, id, faction));
  game = applyAction(game, 'nativeRichese', { type: 'homeworlds', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = initializeHomeworldOccupationGameForAudit(game);
  game = advanceOriginal(game, game => game.status === 'playing');
  assert.equal(game.homeworldOccupationPreview, true);
  assert.deepEqual(game.homeworldOccupationHistory!.qualifications, []);
  assertDefenseInventory(game);
  const original = privateLotPhysicalIds(game);
  assert.equal(new Set(original).size, original.length);

  // Controlled source-helper qualification: original native counters go to
  // their own Tanks and one original Guild reserve becomes the sole visitor.
  qualifyDefensePosition(game, 'homeworld:atreides');
  privateLotPlayer(game, 'occupier').ally = 'ally';
  privateLotPlayer(game, 'ally').ally = 'occupier';

  // Original unused physical stock, not a manufactured face or cache alias.
  const cardAt = game.deck.findIndex(card => card.effect !== 'karama' && card.id !== excludeCardId);
  assert.ok(cardAt >= 0);
  const card = game.deck.splice(cardAt, 1)[0];
  privateLotPlayer(game, 'nativeRichese').hand.push(card);
  const karama = stageBiddingKarama(game, 'rival');
  assert.deepEqual(privateLotPhysicalIds(game), original);
  assertDefenseInventory(game);

  game = advanceOriginal(game, game => game.decision?.kind === 'richeseBlackMarket');
  assert.equal(game.decision!.player, 'nativeRichese');
  game = applyAction(game, 'nativeRichese', {
    type: 'decision', event: game.richeseBidding!.event,
    card: card.id, method: 'silent',
  });
  assert.equal(game.richeseAuction!.source, 'blackMarket');
  assert.equal(game.richeseAuction!.owner, 'nativeRichese');
  assert.equal(game.response?.kind, 'richeseBlackMarket');
  assert.deepEqual(privateLotPhysicalIds(game), original);
  return { game, card, karama, original };
}

/** Complete only the actual source response, without bot decisions/bids or
 * phase-clock mutation. Every original eligible seat passes once. */
export function passPrivateLotWindow(game: Game, kind: 'richeseBlackMarket' | 'richeseAuction' | 'atreidesAuction'): Game {
  assert.equal(game.response?.kind, kind);
  for (let step = 0; game.response?.kind === kind && step < game.players.length; step++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id));
    assert.ok(actor);
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.notEqual(game.response?.kind, kind);
  return game;
}

/** Pay the original funded Silent invoice: native Richese cannot self-bid;
 * the Guild buyer pays its own real spice, every other eligible seat bids zero. */
export function sellPrivateBlackMarketLot(game: Game, amount = 2): Game {
  assert.equal(game.response, null);
  assert.equal(game.richeseAuction!.source, 'blackMarket');
  assert.equal(game.richeseAuction!.method, 'silent');
  const event = game.richeseAuction!.event;
  const eligible = [...game.richeseAuction!.eligible];
  assert.ok(eligible.includes('occupier'));
  assert.ok(privateLotPlayer(game, 'occupier').spice >= amount);
  for (const actor of eligible) game = applyAction(game, actor, {
    type: 'richeseBid', event, amount: actor === 'occupier' ? amount : 0, allyPayment: 0,
  });
  assert.equal(game.decision?.kind, 'richeseDeclaration');
  assert.equal(game.richeseBidding!.blackMarketSold, true);
  assert.equal(game.currentAuctionSale, null);
  assert.equal(game.richeseAuction, null);
  return game;
}

/** Controlled conserved recycle position, NOT a claim that a game effect
 * returns Black Market purchases. The next pool/lot is produced by the actual
 * native declaration, original draw and original inspection handler. */
export function recyclePrivatePurchaseIntoOriginalNormalLot(game: Game, cardId: string): Game {
  assert.equal(game.decision?.kind, 'richeseDeclaration');
  const original = privateLotPhysicalIds(game);
  const buyer = privateLotPlayer(game, 'occupier');
  const at = buyer.hand.findIndex(card => card.id === cardId);
  assert.ok(at >= 0);
  game.deck.unshift(buyer.hand.splice(at, 1)[0]);
  assert.deepEqual(privateLotPhysicalIds(game), original);
  game = applyAction(game, 'nativeRichese', {
    type: 'decision', event: game.richeseBidding!.event, position: 'last',
  });
  game = passPrivateLotWindow(game, 'richeseAuction');
  assert.equal(game.response?.kind, 'atreidesAuction');
  assert.equal(game.auction!.cards[game.auction!.index].id, cardId);
  assert.equal(game.auction!.peekKnown, false);
  assert.deepEqual(privateLotPhysicalIds(game), original);
  return game;
}
