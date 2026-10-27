import assert from 'node:assert/strict';
import test from 'node:test';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  createSemutaArrivalOverlapFixture as fixture, actSemutaArrivalOverlap as act,
  inventory, player, passCurrentSemuta as passSemuta, claimOverlapSemuta as claimSemuta,
  openOverlapTerrorDiscard,
} from './fixture-semuta-arrival-overlap';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before);
}

/** Real public Basic setup, original token placement, paid shipment and
 * Sabotage discard. Only the exceptional intervening hand fill is staged:
 * original unopened physical cards move from the deck to the entrant's hand. */
function source() {
  const f = fixture({ effect: 'choam', first: 'terror', arrival: 'shipment', terror: 'sabotage' });
  let game = act(f.game, f.arrivalStep.actor, f.arrivalStep.action);
  assert.equal(game.pendingTerrorEntry?.stage, 'offer');
  game = openOverlapTerrorDiscard(game, f);
  const originalDiscard = game.pendingTreacheryDiscard!.batch.event;
  game = passSemuta(game);
  assert.equal(game.pendingTerrorEntry?.stage, 'gift');
  assert.equal(game.decision?.kind, 'moritaniTerror');
  assert.equal(game.decision?.player, f.moritani);
  assert.ok(player(game, f.moritani).hand.some(card => card.id === f.gift));
  const beforeFill = structuredClone(game);
  while (player(game, f.entrant).hand.length < handLimit(player(game, f.entrant))) {
    const index = game.deck.findIndex(card => ['projectile', 'poison', 'shield', 'snooper', 'worthless'].includes(card.kind));
    assert.ok(index >= 0);
    player(game, f.entrant).hand.push(game.deck.splice(index, 1)[0]);
  }
  assert.equal(player(game, f.entrant).hand.length, handLimit(player(game, f.entrant)));
  assert.deepEqual(inventory(game), f.originalInventory);
  return { f, game, beforeFill, originalDiscard };
}

function finishArrival(game: Game, f: ReturnType<typeof fixture>) {
  if (game.pendingAmbassador?.stage === 'offer')
    game = act(game, f.owner, { type: 'decision', event: game.pendingAmbassador.event, decline: true });
  assert.equal(game.pendingTerrorEntry, null);
  assert.equal(game.pendingTreacheryDiscard, null);
  assert.equal(game.pendingArrivalOverlap, null);
  assert.equal(game.active, f.entrant);
  assert.equal(player(game, f.entrant).forces[f.location], 1);
  assert.equal(player(game, f.entrant).spice, f.balances[f.entrant] - 1);
  assert.equal(player(game, f.entrant).shipped, true);
  assert.deepEqual(inventory(game), f.originalInventory);
  reject(game, f.entrant, f.arrivalStep.action);
  return game;
}

for (const discard of ['gift', 'existing'] as const) for (const claim of [false, true]) {
  void test(`Sabotage full-hand entrant discards ${discard}; Semuta ${claim ? 'claims' : 'passes'} once`, () => {
    const { f, game: sourceGame, originalDiscard } = source();
    const priorHand = player(sourceGame, f.entrant).hand.map(card => card.id);
    const discardId = discard === 'gift' ? f.gift : priorHand[0];
    let game = act(sourceGame, f.moritani, { type: 'decision', card: f.gift });
    assert.equal(game.pendingTerrorEntry?.stage, 'giftDiscard');
    assert.equal(game.decision?.kind, 'moritaniTerror');
    assert.equal(game.decision?.player, f.entrant);
    assert.equal(player(game, f.entrant).hand.length, handLimit(player(game, f.entrant)) + 1);
    assert.ok(player(game, f.entrant).hand.some(card => card.id === f.gift));
    assert.ok(!player(game, f.moritani).hand.some(card => card.id === f.gift));
    for (const seat of game.players.filter(row => row.id !== f.entrant))
      assert.equal(viewGame(game, seat.id).players.find(row => row.id === f.entrant)?.hand, undefined);
    reject(game, f.moritani, { type: 'decision', card: discardId });
    reject(game, f.entrant, { type: 'decision', card: 'stale-or-foreign-card' });
    reject(game, f.entrant, { type: 'decision', decline: true });
    const bot = viewGame(game, f.entrant);
    bot.players.find(row => row.id === f.entrant)!.bot = 'Easy';
    const botAction = botActions(bot).find(action => action.type === 'decision' &&
      typeof action.card === 'string' && player(game, f.entrant).hand.some(card => card.id === action.card));
    assert.ok(botAction, 'A minimal bot must select its own actual excess card');
    const botResult = act(structuredClone(game), f.entrant, botAction);
    assert.equal(player(botResult, f.entrant).hand.length, handLimit(player(botResult, f.entrant)));
    game = act(game, f.entrant, { type: 'decision', card: discardId });
    const pending = game.pendingTreacheryDiscard; assert.ok(pending);
    assert.equal(pending.batch.cause, 'terror:sabotageGiftOverflow');
    assert.notEqual(pending.batch.event, originalDiscard);
    assert.equal(pending.batch.entries.length, 1);
    assert.equal(pending.batch.entries[0].card.id, discardId);
    assert.equal(pending.batch.entries[0].discardedBy, f.entrant);
    assert.equal(pending.batch.entries[0].publicFace, false);
    assert.equal(player(game, f.entrant).hand.length, handLimit(player(game, f.entrant)));
    assert.deepEqual(inventory(game), f.originalInventory);
    game = claim ? claimSemuta(game, f.claimant, discardId) : passSemuta(game);
    assert.equal(player(game, f.claimant).hand.some(card => card.id === discardId), claim);
    assert.equal(player(game, f.entrant).hand.some(card => card.id === f.gift), discard !== 'gift');
    finishArrival(game, f);
  });
}
