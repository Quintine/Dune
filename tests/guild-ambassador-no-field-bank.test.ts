import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actGuildAmbassadorNoField as act, advanceGuildAmbassadorNoField as advance,
  createGuildAmbassadorNoFieldFixture as fixture, guildAmbassadorNoFieldClean as clean,
  guildAmbassadorNoFieldInventory as inventory, guildAmbassadorNoFieldPlayer as player,
  passGuildAmbassadorNoFieldResponses as passResponses,
} from './fixture-guild-ambassador-no-field';

void test('genuine three-seat allied Guild Ambassador shipment pays its fixed stronghold fee to the bank when Guild is absent', () => {
  const f = fixture({ beneficiary: 'allied', includeGuild: false, karama: true });
  const before = structuredClone(f.game), totalSpice = before.players.reduce((sum, p) => sum + p.spice, 0);
  const beforeAllowances = { active: before.active, remaining: before.movementRemaining,
    players: before.players.map(p => ({ id: p.id, shipped: p.shipped, moved: p.moved })) };
  assert.equal(f.includeGuild, false); assert.equal(before.players.length, 3);
  assert.ok(before.players.every(p => p.faction !== 'guild'));
  assert.deepEqual(before.players.map(p => p.faction), ['ecaz', 'richese', 'harkonnen']);
  assert.deepEqual(before.order, [f.ownerEcaz, f.richese, f.entrantHark]);
  assert.deepEqual(f.staging, []);
  assert.equal(f.dealOrder.length, 4, 'The original three-seat deal gives Harkonnen its actual second card');
  let game = act(f.game, f.beneficiaryID, { type: 'decision', event: f.event, requestNoField: true,
    territory: f.territory, sector: f.sector });
  assert.equal(game.decision?.player, f.richese);
  game = act(game, f.richese, { type: 'decision', event: f.event,
    offerNoField: f.tokens.find(token => token.value === 3)!.id,
    noFieldEvent: player(game, f.richese).noFieldEvent, payer: f.richese, elite: 0 });
  assert.equal(game.decision?.player, f.beneficiaryID);
  game = act(game, f.beneficiaryID, { type: 'decision', event: f.event, acceptNoField: true });
  assert.equal(game.response?.kind, 'richeseNoField');
  for (const p of game.players) {
    assert.equal(p.spice, player(before, p.id).spice);
    assert.equal(p.reserves, player(before, p.id).reserves);
    assert.deepEqual(p.forces, player(before, p.id).forces);
  }
  game = passResponses(game); game = advance(game, clean);
  assert.equal(player(game, f.beneficiaryID).forces[`${f.territory}:${f.sector}`], 3);
  assert.equal(player(game, f.beneficiaryID).reserves, player(before, f.beneficiaryID).reserves - 3);
  assert.equal(player(game, f.richese).noField!.deployed, null);
  assert.equal(player(game, f.richese).noField!.lastShipped, f.tokens.find(token => token.value === 3)!.id);
  assert.equal(player(game, f.richese).spice, player(before, f.richese).spice - 1);
  assert.equal(player(game, f.beneficiaryID).spice, player(before, f.beneficiaryID).spice);
  assert.equal(player(game, f.entrantHark).spice, player(before, f.entrantHark).spice);
  assert.equal(game.players.reduce((sum, p) => sum + p.spice, 0), totalSpice - 1);
  assert.deepEqual({ active: game.active, remaining: game.movementRemaining,
    players: game.players.map(p => ({ id: p.id, shipped: p.shipped, moved: p.moved })) }, beforeAllowances);
  assert.equal(game.pendingAmbassador, null);
  game = act(game, f.entrantHark, { type: 'move', from: 'habbanya_ridge_sietch:17', amount: 1,
    territory: f.desert, sector: f.desertSector });
  game = advance(game, clean);
  assert.equal(player(game, f.entrantHark).forces[`${f.desert}:${f.desertSector}`], 1);
  game = act(game, f.entrantHark, { type: 'endMovement' });
  assert.ok(!game.movementRemaining?.includes(f.entrantHark));
  assert.deepEqual(inventory(game), f.originalInventory);
});
