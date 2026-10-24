import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Game } from '../game/engine';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { actTruthMovement as apply, truthMovementClean as clean, truthMovementInventory as inventory,
  truthMovementPlayer as player, type TruthMovementStep } from './fixture-truth-movement';

/** Genuine public native Basic CHOAM, actual dealt Kulon/Truthtrance, actual
 * paid Arrakeen shipment and native allowed Kulon. No movement state is staged. */
export function createTruthMovementChoamFixture() {
  let game = createGame('TRUTHMOVEMENTCHOAM', newPlayer('choam', 'CHOAM', 'choam'), false, ['choam']);
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  const actions: TruthMovementStep[] = [];
  const act = (actor: string, action: TruthMovementStep['action']) => { game = apply(game, actor, action, actions); };
  const reach = (until: (game: Game) => boolean) => {
    for (let count = 0; !until(game) && count < 500; count++) {
      const next = nextStrongholdFactionsNativeStep(game); assert.ok(next); act(next.actor, next.action);
    }
    assert.ok(until(game));
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start' });
  const setup = structuredClone(game), originalCards = inventory(game);
  assert.ok(game.players.every(p => !p.hand.length));
  const kulon = game.deck.find(card => card.name === 'Kulon')!, truth = game.deck.find(card => card.effect === 'truthtrance')!;
  assert.ok(kulon && truth);
  const dealOrder = [kulon, truth].map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  reach(state => state.status === 'playing');
  assert.ok(player(game, 'choam').hand.some(card => card.id === kulon.id));
  assert.ok(player(game, 'emperor').hand.some(card => card.id === truth.id));
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  reach(state => clean(state) && state.phase === 5 && state.active === 'choam');
  const beforeShipment = structuredClone(game);
  act('choam', { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 }); reach(clean);
  assert.equal(player(game, 'choam').spice, player(beforeShipment, 'choam').spice - 1);
  const beforeKulon = structuredClone(game); act('choam', { type: 'card', mode: 'choam', card: kulon.id });
  assert.ok(game.response?.kind === 'choamWorthless' || game.choamMovement?.bonus === 1); reach(clean);
  assert.equal(game.choamMovement?.bonus, 1); assert.equal(player(game, 'choam').forces['arrakeen:10'], 1);
  assert.deepEqual(inventory(game), originalCards);
  return { game, lobby, setup, beforeShipment, beforeKulon, actions, sourceActionCount: actions.length,
    originalCards, dealOrder, spiceOrder, target: 'choam', asker: 'emperor', truth: truth.id, kulon: kulon.id,
    staging: ['Original unopened two-card deal and two ordinary Spice positions plus native scalar lotteries only. Public Basic CHOAM/Emperor setup, actual one-spice Arrakeen shipment and actual allowed/discarded native Kulon. No hand, wallet, force, clock, allowance, bonus or promise is installed.'] };
}
