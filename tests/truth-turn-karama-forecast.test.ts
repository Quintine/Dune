import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { windowCardOpportunity } from '../game/window-card-play';
import { createTruthBidFixture, declareTruthBid, actTruthBid, truthBidInventory } from './fixture-truth-bid';
import { askTruthTurnKarama, settleTruthTurnKarama, truthTurnKaramaGroup, truthTurnKaramaPlay,
  createTruthTurnKaramaFixture, bindTruthTurnKarama } from './fixture-truth-turn-karama';

void test('an unseen auction Hajr cannot fund a future card promise before its actual Karama acquisition', () => {
  const f = createTruthBidFixture({ targetKarama: true, firstLotEffect: 'hajr', window: 'active' });
  assert.equal(f.game.auction?.cards[0].effect, 'hajr');
  assert.equal(viewGame(f.game, f.target).auction?.card, null);
  const source = windowCardOpportunity(f.game, 'karamaAuction')!;
  const mixed = truthTurnKaramaGroup('and', truthTurnKaramaPlay(source.source),
    { kind: 'action', action: { kind: 'cardPlay', effect: 'hajr' } });
  let game = declareTruthBid(f).game;
  game = askTruthTurnKarama(game, f.asker, f.target, mixed);
  assert.deepEqual(viewGame(game, f.target).truthTurnActionAnswers, ['no']);
  game = actTruthBid(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = settleTruthTurnKarama(actTruthBid(game, f.target, { type: 'card', card: f.karama!, mode: 'purchase' }));
  assert.ok(game.players.find(player => player.id === f.target)!.hand.some(card => card.effect === 'hajr'));
  assert.deepEqual(truthBidInventory(game), f.originalCards);
  // The actual acquisition makes the printed card owned knowledge. A second
  // original Truth can now ask about the known remaining Movement play.
  game = actTruthBid(game, f.asker, { type: 'card', card: f.truths[1] });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id))!;
    game = actTruthBid(game, actor.id, { type: 'truthPass' });
  }
  game = askTruthTurnKarama(game, f.asker, f.target,
    { kind: 'action', action: { kind: 'cardPlay', effect: 'hajr' } });
  // The earlier No still forbids fulfilling the AND by that Hajr. It is the
  // original binding, rather than lack of owned card knowledge, that applies.
  assert.deepEqual(viewGame(game, f.target).truthTurnActionAnswers, ['no']);
  let owned = settleTruthTurnKarama(actTruthBid(f.game, f.target, { type: 'card', card: f.karama!, mode: 'purchase' }));
  owned = declareTruthBid(f, owned).game;
  owned = askTruthTurnKarama(owned, f.asker, f.target,
    { kind: 'action', action: { kind: 'cardPlay', effect: 'hajr' } });
  assert.ok(viewGame(owned, f.target).truthTurnActionAnswers?.includes('yes'),
    'Actual ownership permits the native future play when no earlier answer forbids it');
});

void test('the last native pass cannot close an own unfulfilled printed Karama promise', () => {
  const f = createTruthTurnKaramaFixture();
  const game = bindTruthTurnKarama(f, 'yes', truthTurnKaramaPlay(f.source)).game;
  assert.equal(game.auction?.active, f.target);
  const before = structuredClone(game);
  assert.throws(() => actTruthBid(game, f.target, { type: 'passBid' }), /Karama lot|Truthtrance/);
  assert.deepEqual(game, before);
  const played = settleTruthTurnKarama(actTruthBid(game, f.target, f.purchase));
  assert.equal(played.turnActionPromises![0].fulfilled, true);
});
