import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { windowCardOpportunity } from '../game/window-card-play';
import { createTruthBidFixture, declareTruthBid, actTruthBid as act, advanceTruthBid as advance,
  truthBidClean as clean, truthBidPlayer as player, truthBidInventory as inventory } from './fixture-truth-bid';
import { truthTraitorDecisionTraitors as traitors } from './fixture-truth-traitor-decision';
import { askTruthTurnKaramaShipment as ask, truthTurnKaramaShipmentGroup as group,
  truthTurnKaramaShipmentPlay as play, truthTurnKaramaShipmentPayment as payment } from './fixture-truth-turn-karama-shipment';

/** Original unopened H2/A1/E1/G1 deal, genuine remaining auction/Revival turns,
 * and actual pre-answer bribe. No played purse, response or promise is installed. */
function source(remaining: 2 | 4) {
  const f = createTruthBidFixture({ advanced: true, extraGuild: true, targetKarama: true, window: 'active' });
  const actions = structuredClone(f.sourceActions);
  let game = advance(f.game, state => state.phase === 5 && state.active === f.target && clean(state), actions);
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 10 - remaining }, actions);
  assert.equal(player(game, f.target).spice, remaining);
  assert.equal(traitors(game).length, 20); assert.deepEqual(inventory(game), f.originalCards);
  const window = windowCardOpportunity(game, 'karamaShipment'); assert.ok(window);
  const declared = declareTruthBid(f, game); actions.push(...declared.actions);
  game = ask(declared.game, f.asker, f.target, group('or', play(window.source), payment(f.asker)), actions);
  assert.ok(viewGame(game, f.target).truthTurnActionAnswers?.includes('yes'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' }, actions);
  return { f, game, actions, window };
}

void test('an own shipment cannot spend its remaining payment alternative before a foreign Guild stop decision', () => {
  const { f, game, actions } = source(2), before = structuredClone(game);
  assert.throws(() => act(game, f.target, { type: 'ship', territory: 'polar_sink', sector: 0,
    amount: 1, elite: 0, allyPayment: 0 }, actions), /Truthtrance|completion/);
  assert.deepEqual(game, before);
  let paid = act(game, f.target, { type: 'bribe', target: f.asker, amount: 2 }, actions);
  assert.equal(paid.turnActionPromises![0].fulfilled, true); assert.equal(player(paid, f.target).spice, 0);
  paid = act(paid, f.target, { type: 'endMovement' }, actions);
  assert.equal(paid.discard.filter(card => card.id === f.karama).length, 0);
  assert.deepEqual(inventory(paid), f.originalCards); assert.equal(traitors(paid).length, 20);
});

void test('a funded payment alternative survives actual unpriced delivery and Guild income before being paid', () => {
  const { f, actions, game: initial } = source(4);
  let game = initial;
  game = act(game, f.target, { type: 'ship', territory: 'polar_sink', sector: 0,
    amount: 1, elite: 0, allyPayment: 0 }, actions);
  assert.equal(game.decision?.kind, 'guildShipment');
  assert.equal(game.decision?.player, 'guild'); assert.equal(player(game, f.target).spice, 4);
  game = advance(game, clean, actions);
  assert.equal(player(game, f.target).spice, 2); assert.equal(player(game, f.target).forces['polar_sink:0'], 1);
  assert.equal(game.turnActionPromises![0].released, false);
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 2 }, actions);
  assert.equal(player(game, f.target).spice, 0); assert.equal(game.turnActionPromises![0].fulfilled, true);
  assert.ok(player(game, f.target).hand.some(card => card.id === f.karama));
  assert.deepEqual(inventory(game), f.originalCards); assert.equal(traitors(game).length, 20);
});
