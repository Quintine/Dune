import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  completeHajrReplay, createHajrReplayFixture, hajrReplayPlayer,
} from './fixture-hajr-replay';

/** This reaches the native Advanced immediate-after-movement Hajr window via
 * setup, auction, shipment, actual Hajr play, Box recovery and movement. The
 * genuine fixture has spent its spice on those actions; only the payer's spice
 * is explicitly staged so this independent deal payment can be exercised. */
function windowGame() {
  const fixture = createHajrReplayFixture({ advanced: true });
  const game = completeHajrReplay(fixture).beforeSecondHajr;
  const payer = game.players.find(player => player.id === fixture.owner)!;
  const recipient = game.players.find(player => player.id !== payer.id && !player.bot &&
    player.id !== payer.ally && player.ally !== payer.id);
  assert.ok(recipient);
  assert.equal(payer.spice, 0, 'The original purchases, shipment and Box consumed the fixture spice.');
  payer.spice = 4; // Controlled funding only; the native movement/window is not staged.
  assert.ok(payer.hajrWindow);
  assert.equal(available(game, payer.id), true);
  return { fixture, game, payer: payer.id, recipient: recipient.id };
}

function available(game: Game, id: string) {
  return viewGame(game, id).players.find(player => player.id === id)!.hajrAvailable;
}

function offer(game: Game, from: string, to: string, payer: string, recipient: string): Game {
  return applyAction(game, from, {
    type: 'dealOffer', target: to, terms: 'An immediate one-spice bribe.',
    payment: { kind: 'immediateBribe', payer, recipient, amount: 1 },
  });
}

void test('another seat accepting a prior-consented payment preserves the payer’s native Hajr opportunity', () => {
  const { fixture, game: initial, payer, recipient } = windowGame();
  const window = structuredClone(hajrReplayPlayer(initial).hajrWindow);
  const beforeSpice = hajrReplayPlayer(initial).spice;
  const beforeBribes = initial.players.find(player => player.id === recipient)!.bribes;
  const offered = offer(initial, payer, recipient, payer, recipient);
  assert.deepEqual(hajrReplayPlayer(offered).hajrWindow, window);
  const deal = offered.deals!.at(-1)!;
  const paid = applyAction(offered, recipient, { type: 'dealRespond', deal: deal.id, accept: true });
  assert.equal(paid.deals!.at(-1)!.status, 'active');
  assert.equal(hajrReplayPlayer(paid).spice, beforeSpice - 1);
  assert.equal(paid.players.find(player => player.id === recipient)!.bribes, beforeBribes + 1);
  assert.deepEqual(hajrReplayPlayer(paid).hajrWindow, window);
  assert.equal(available(paid, payer), true);
  const played = applyAction(paid, payer, { type: 'card', card: fixture.hajr });
  assert.equal(hajrReplayPlayer(played).hajrPlays, 2);
  assert.equal(hajrReplayPlayer(played).spice, beforeSpice - 1);
  assert.equal(played.players.find(player => player.id === recipient)!.bribes, beforeBribes + 1);
});

void test('the payer’s own voluntary bribe or final acceptance closes the immediate Hajr window', () => {
  const { game: initial, payer, recipient } = windowGame();
  const direct = applyAction(initial, payer, { type: 'bribe', target: recipient, amount: 1 });
  assert.equal(hajrReplayPlayer(direct).hajrWindow, undefined);
  assert.equal(available(direct, payer), false);

  const offered = offer(initial, recipient, payer, payer, recipient);
  assert.equal(available(offered, payer), true);
  const accepted = applyAction(offered, payer, { type: 'dealRespond', deal: offered.deals!.at(-1)!.id, accept: true });
  assert.equal(hajrReplayPlayer(accepted).hajrWindow, undefined);
  assert.equal(available(accepted, payer), false);
  assert.equal(hajrReplayPlayer(accepted).spice, 3);
});
