import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { actKullPurpose as act, advanceKullPurpose as advance, kullPurposeClean as clean,
  kullPurposePlayer as player, type KullPurposeStep } from './fixture-kull-purpose';
import { publicKullInventory as inventory } from './fixture-public-choam-kull';

export { act, advance, clean, player, inventory };

/** Genuine public Advanced preview entry with an explicit host Kull selection.
 * The original unopened starting-deal and two Spice positions are selected;
 * setup, paid shipment and subsequent decisions remain actual native actions. */
export function createAdvancedKullLobbyFixture() {
  let game = createGame('ADVANCEDKULL', newPlayer('choam', 'CHOAM', 'choam'), true, ['choam', 'ix']);
  for (const faction of ['emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: KullPurposeStep[] = [];
  const send = (actor: string, action: Action) => { game = act(game, actor, action, actions); };
  const reach = (until: (g: Game) => boolean) => { game = advance(game, until, actions); };
  send('choam', { type: 'moduleOption', module: 'kullPreview', enabled: true });
  for (const seat of game.players) send(seat.id, { type: 'ready' });
  const lobby = structuredClone(game);
  send('choam', { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup');
  assert.equal(game.advanced, true);
  assert.equal(game.kullPreview, true);
  assert.ok(game.players.every(seat => seat.hand.length === 0));
  const originalCards = game.deck.map(card => card.id).sort();
  const selected: Game['deck'] = [];
  for (const kind of ['kull', 'karama', 'karama'] as const) {
    const index = game.deck.findIndex(card => kind === 'kull' ? card.id === 'ix-kull-wahad' : card.effect === 'karama');
    assert.ok(index >= 0); selected.push(game.deck.splice(index, 1)[0]);
  }
  game.deck.unshift(...selected);
  const beforeDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  const [kull, karama, counter] = selected.map(card => card.id);
  for (const [seat, card] of [['choam', kull], ['emperor', karama], ['guild', counter]] as const)
    assert.ok(player(game, seat).hand.some(held => held.id === card));
  assert.deepEqual(inventory(game), originalCards);
  const safe: Game['spiceDeck'] = [];
  for (let i = 0; i < 2; i++) {
    const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
    assert.ok(index >= 0); safe.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...safe);
  reach(state => state.phase === 5 && state.active === 'choam' && clean(state));
  send('choam', { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === 'emperor' && clean(state));
  assert.deepEqual(inventory(game), originalCards);
  return { game, lobby, setup, beforeDeal, afterSetup, actions, originalCards,
    kull, karama, counter, actor: 'emperor', reactor: 'choam', counterOwner: 'guild' };
}

export type AdvancedKullLobbyFixture = ReturnType<typeof createAdvancedKullLobbyFixture>;
export const advancedKullAttempt = (f: AdvancedKullLobbyFixture): Action =>
  ({ type: 'card', mode: 'shipment', card: f.karama, target: f.actor });
