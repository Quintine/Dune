import assert from 'node:assert/strict';
import test from 'node:test';
import { createHomeworldCustody, type HomeworldCustodyContext } from '../game/homeworld-custody';
import { homeworldAllianceBlock } from '../game/homeworld-alliance';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { applyAction, viewGame } from '../game/engine';
import { createRicheseHomeworldShipmentFixture, passRicheseHomeworldShipment } from './fixture-richese-homeworld-shipment';

function fixture() {
  const context: HomeworldCustodyContext = { advanced: false, players: [
    { id: 'r-seat', faction: 'richese', reserves: 10, eliteReserves: 0 },
    { id: 'c-seat', faction: 'choam', reserves: 6, eliteReserves: 0 },
    { id: 'e-seat', faction: 'ecaz', reserves: 6, eliteReserves: 0 },
  ] };
  const custody = createHomeworldCustody(context);
  return { context, custody, marker: { homeworld: 'homeworld:choam', controller: 'r-seat' } };
}

void test('marker-only presence forbids the native and Richese alliance in either order', () => {
  const { context, custody, marker } = fixture(), before = structuredClone(custody);
  assert.equal(homeworldAllianceBlock(context, custody, 'r-seat', 'c-seat'), null);
  assert.match(homeworldAllianceBlock(context, custody, 'r-seat', 'c-seat', marker)!, /cannot form/);
  assert.match(homeworldAllianceBlock(context, custody, 'c-seat', 'r-seat', marker)!, /cannot form/);
  assert.equal(homeworldAllianceBlock(context, custody, 'r-seat', 'e-seat', marker), null);
  assert.equal(homeworldAllianceBlock(context, custody, 'c-seat', 'e-seat', marker), null);
  assert.deepEqual(custody, before);
});

void test('physical visitors retain their original rule and marker adds no physical counter', () => {
  const { context, custody, marker } = fixture();
  custody.visitors['homeworld:ecaz'] = { 'c-seat': { normal: 1, elite: 0 } };
  const before = structuredClone(custody);
  assert.match(homeworldAllianceBlock(context, custody, 'c-seat', 'e-seat')!, /cannot form/);
  assert.match(homeworldAllianceBlock(context, custody, 'c-seat', 'e-seat', marker)!, /cannot form/);
  assert.deepEqual(custody, before);
});

void test('only a seated Richese controller on an active foreign World is accepted', () => {
  const { context, custody, marker } = fixture();
  assert.throws(() => homeworldAllianceBlock(context, custody, 'r-seat', 'c-seat',
    { ...marker, controller: 'e-seat' }), /Richese controller/);
  assert.throws(() => homeworldAllianceBlock(context, custody, 'r-seat', 'c-seat',
    { ...marker, homeworld: 'homeworld:richese' }), /foreign world/);
  assert.throws(() => homeworldAllianceBlock(context, custody, 'r-seat', 'c-seat',
    { ...marker, homeworld: 'homeworld:atreides' }), /active foreign world/);
});

void test('server Homeworld integrity rejects an alliance across an actual marker-only arrival', () => {
  const fixture = createRicheseHomeworldShipmentFixture({ companions: 1, advanced: false });
  let game = fixture.game;
  const view = viewGame(game, fixture.owner), option = view.homeworldShipment;
  assert.ok(option && view.richeseNoField?.private);
  game = applyAction(game, fixture.owner, { type: 'homeworldShip', event: option.event,
    destination: 'homeworld:emperor', sources: {}, noField: fixture.token,
    noFieldEvent: view.richeseNoField.event, allyPayment: 0 });
  game = passRicheseHomeworldShipment(game);
  assert.deepEqual(game.players.find(player => player.id === fixture.owner)!.noField!.deployed!.location,
    { homeworld: 'homeworld:emperor' });
  assert.equal(game.homeworlds!.custody!.visitors['homeworld:emperor']?.[fixture.owner], undefined);
  assert.doesNotThrow(() => homeworldGameIntegrity(game));
  const illegal = structuredClone(game);
  const richese = illegal.players.find(player => player.id === fixture.owner)!;
  const emperor = illegal.players.find(player => player.id === fixture.holder)!;
  richese.ally = emperor.id; emperor.ally = richese.id;
  assert.throws(() => homeworldGameIntegrity(illegal), /alliance cannot form/);
});
