import assert from 'node:assert/strict';
import test from 'node:test';
import { movementShipmentPreparations } from '../game/movement-shipment-preparation';
import type { Game } from '../game/engine';

/** Structural enumeration fixture only, not a claimed natural gameplay source. */
function source(): Game {
  return { players: [{ id: 'owner', faction: 'ixians', forces: {}, reserves: 3, shipped: false,
    elites: { reserves: 1 }, ally: 'ally' }], aid: { ally: { recipient: 'owner', amount: 3 } },
  expansions: [], advanced: false } as unknown as Game;
}
void test('preparation enumeration retains larger optional pledged shares and distinct physical special-force allocations', () => {
  const game = source(), before = structuredClone(game);
  const choices = [...movementShipmentPreparations(game, 'owner', (state, _actor, action) =>
    action.territory === 'imperial_basin' && action.sector === 9 && action.amount === 2 && action.allyPayment === 3
      ? structuredClone(state) : null)];
  assert.equal(choices.length, 2);
  assert.deepEqual(choices.map(choice => choice.actions[0].elite), [0, 1]);
  assert.deepEqual(choices.map(choice => choice.actions[0].allyPayment), [3, 3]);
  assert.deepEqual(game, before);
});
void test('spent shipment and paid Box decisions cannot start another preparation enumeration', () => {
  const game = source(); game.players[0].shipped = true;
  assert.deepEqual([...movementShipmentPreparations(game, 'owner', () => assert.fail('Shipment is spent'))], []);
  game.players[0].shipped = false; game.pendingNullentropy = { player: 'owner' } as Game['pendingNullentropy'];
  assert.deepEqual([...movementShipmentPreparations(game, 'owner', () => assert.fail('Finish the paid decision'))], []);
});
