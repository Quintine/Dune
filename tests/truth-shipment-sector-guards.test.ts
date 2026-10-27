import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { bindSectorGuildGuard as bind, createSectorGuildGuardFixture as fixture } from './fixture-truth-shipment-sector-guards';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function promise(game: Game, player: string) {
  const row = game.turnActionPromises?.find(item => item.player === player); assert.ok(row); return row;
}

void test('an exact-sector Yes guards actual Fremen allied Guild reserve transport before commitment', () => {
  const f = fixture(); let game = bind(f);
  rejected(game, f.target, f.ship('imperial_basin', 10));
  rejected(game, f.target, f.ship('carthag', 11));
  assert.equal(game.players.find(player => player.id === f.target)?.reserves, 19);
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'guildShip'); assert.equal(guide.action.from, 'reserves');
  assert.equal(guide.action.territory, 'imperial_basin'); assert.equal(guide.action.sector, 9);
  const beforeSpice = game.players.find(player => player.id === f.target)!.spice;
  game = applyAction(game, f.target, guide.action);
  assert.equal(game.players.find(player => player.id === f.target)?.forces['imperial_basin:9'], 1);
  assert.equal(game.players.find(player => player.id === f.target)?.reserves, 18);
  assert.equal(game.players.find(player => player.id === f.target)?.spice, beforeSpice - 1);
  assert.equal(promise(game, f.target).shipment.event?.sector, 9); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(f.inventory(game), f.original);
});

void test('starting movement cannot forfeit an exact-sector Yes shipment', () => {
  const f = fixture(); let game = bind(f);
  rejected(game, f.target, f.movement);
  rejected(game, f.target, f.ship('imperial_basin', 10));
  game = applyAction(game, f.target, f.ship('imperial_basin', 9));
  assert.equal(promise(game, f.target).shipment.event?.sector, 9); assert.equal(promise(game, f.target).fulfilled, true);
  assert.deepEqual(f.inventory(game), f.original);
});

void test('a valid movement OR fulfills the answer while forfeiting the unused shipment', () => {
  const f = fixture();
  const mixed = { kind: 'or', terms: [f.claim, { kind: 'action', action: { kind: 'move', territory: 'oh_gap', minimum: 1 } }] };
  let game = bind(f, mixed);
  game = applyAction(game, f.target, f.movement);
  assert.equal(promise(game, f.target).fulfilled, true);
  rejected(game, f.target, f.ship('imperial_basin', 10));
  assert.equal(game.players.find(player => player.id === f.target)?.forces['oh_gap:9'], 1);
  assert.deepEqual(f.inventory(game), f.original);
});
