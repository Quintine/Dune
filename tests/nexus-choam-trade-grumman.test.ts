import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame } from '../game/engine';
import { nexusChoamTradeAction } from '../game/nexus-choam-trade-options';
import {
  enterGrummanCollection,
  grummanCollectionFixture,
  grummanPlayer,
  grummanReload,
  holdGrummanCard,
} from './fixture-grumman-collection';

void test('CHOAM Secret Ally trade waits for the queued high-Grumman Collection continuation', () => {
  let g = grummanCollectionFixture({ native: 7, nexus: true });
  const owner = g.players.find((player) => player.faction === 'atreides')!.id;
  const nexus = g.nexusCards!.cards!;
  const previous = nexus.hands[owner];
  const heldBy = g.players.find((player) => nexus.hands[player.id] === 'choam');
  if (heldBy) nexus.hands[heldBy.id] = previous;
  else {
    const deck = nexus.deck.indexOf('choam');
    const discard = nexus.discard.indexOf('choam');
    assert.ok(deck >= 0 || discard >= 0);
    if (deck >= 0) {
      if (previous) nexus.deck[deck] = previous;
      else nexus.deck.splice(deck, 1);
    } else if (previous) nexus.discard[discard] = previous;
    else nexus.discard.splice(discard, 1);
  }
  nexus.hands[owner] = 'choam';
  const worthless = holdGrummanCard(g, owner, 'worthless');

  g = enterGrummanCollection(g);
  assert.equal(g.grummanCollection?.stage, 'waiting');
  assert.equal(g.decision, null);
  const moritani = grummanPlayer(g, g.grummanCollection!.player);
  moritani.reserves++;
  moritani.forces['polar_sink:0']--;

  const view = viewGame(g, owner);
  assert.equal(view.automaticContinuationPending, true);
  assert.match(view.nexusChoamTrade!.blocked!, /current interaction/);
  const action = {
    type: 'nexusChoamTrade',
    event: view.nexusChoamTrade!.event,
    card: worthless.id,
  };
  assert.equal(nexusChoamTradeAction(view, worthless.id), null);
  const before = grummanReload(g);
  assert.throws(() => applyAction(g, owner, action), /current interaction/);
  assert.deepEqual(g, before);

  const opened = normalizeAutomaticGame(grummanReload(g));
  assert.equal(opened.grummanCollection?.stage, 'choice');
  assert.equal(opened.decision?.kind, 'grummanCollection');
  assert.equal(opened.decision?.player, moritani.id);
});
