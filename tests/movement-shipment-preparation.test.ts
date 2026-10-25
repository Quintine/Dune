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

void test('owned No-Field shipment candidates preserve marker identity, one-force tariff shares and last-use restrictions', () => {
  const game = source(), owner = game.players[0]; owner.faction = 'richese';
  owner.noField = { tokens: [{ id: 'zero', value: 0 }, { id: 'three', value: 3 }, { id: 'five', value: 5 }],
    lastShipped: 'three', deployed: null }; owner.noFieldEvent = 'current';
  const choices = [...movementShipmentPreparations(game, owner.id, (state, _actor, action) =>
    action.noField && action.territory === 'imperial_basin' && action.sector === 9 && action.allyPayment === 2
      ? structuredClone(state) : null)].map(choice => choice.actions[0]);
  assert.deepEqual(choices.map(choice => choice.noField), ['zero', 'five']);
  assert.ok(choices.every(choice => choice.amount === 1 && choice.elite === 0 && choice.event === 'current'));
});
