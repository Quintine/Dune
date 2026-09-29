import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { guildTransportQuote } from '../game/transport-quote';
import { guildShipmentCost } from '../game/shipment-price';

function fixture(fremen = false): Game {
  const g = createGame('GUILDTRANSPORTPRICE', newPlayer('p', 'Shipper', fremen ? 'fremen' : 'guild'), false);
  g.players.push(newPlayer('q', 'Ally', fremen ? 'guild' : 'atreides'));
  Object.assign(g, {
    status: 'playing', phase: 5, turn: 2, active: 'p',
    order: ['p', 'q'], movementRemaining: ['p', 'q'], storm: 18,
  });
  const shipper = g.players[0];
  shipper.ally = 'q';
  g.players[1].ally = 'p';
  shipper.hand = [];
  shipper.spice = 3;
  shipper.forces = fremen ? {} : { 'red_chasm:7': 5 };
  shipper.reserves = fremen ? 20 : 15;
  return g;
}

const cross = (territory: string): Action => ({
  type: 'guildShip', from: 'red_chasm:7', amount: 2,
  territory, sector: territory === 'carthag' ? 11 : 0,
});
const quote = (g: Game, action: Action) => guildTransportQuote(viewGame(g, 'p'), action);
const botTransport = (g: Game) => botActions(viewGame(g, 'p')).filter(a => a.type === 'guildShip');

void test('a canceled Guild rate doubles cross and return quotes, with purchased Karama restoring the half rate', () => {
  const g = fixture();
  const returned = cross('reserves');
  const desertDestination: Action = {
    type: 'guildShip', from: 'red_chasm:7', amount: 2,
    territory: 'imperial_basin', sector: 10,
  };
  assert.equal(quote(g, returned).quote?.cost, 1);
  assert.equal(quote(g, desertDestination).quote?.cost, 2);
  g.guildRateBlocked = { turn: 2, player: 'p' };
  assert.equal(quote(g, returned).quote?.cost, 2);
  assert.deepEqual(quote(g, returned).unavailableReasons, []);
  assert.equal(quote(g, desertDestination).quote?.cost, 4);
  assert.ok(quote(g, desertDestination).unavailableReasons.some(reason => reason.includes('spice')));
  assert.equal(guildShipmentCost('reserves', 2, false), 2);
  assert.equal(guildShipmentCost('other', 2, false), 4);
  g.karamaShipping = { player: 'p', owner: 'q' };
  assert.equal(quote(g, returned).quote?.cost, 1);
  assert.equal(quote(g, desertDestination).quote?.cost, 2);
  assert.deepEqual(quote(g, desertDestination).unavailableReasons, []);
});

void test('after an unaffordable Guild rate cancellation bots omit discounted-only cross and allied southern transports', () => {
  const guild = fixture();
  guild.players[0].bot = 'Medium';
  const discounted = botTransport(guild)[0];
  assert.ok(discounted);
  assert.equal(applyAction(guild, 'p', discounted).players[0].shipped, true);
  guild.guildRateBlocked = { turn: 2, player: 'p' };
  assert.deepEqual(botTransport(guild), []);

  const fremen = fixture(true);
  fremen.players[0].bot = 'Medium';
  fremen.players[0].spice = 2;
  const southern = botTransport(fremen).find(a => a.from === 'reserves');
  assert.ok(southern);
  assert.equal(applyAction(fremen, 'p', southern).players[0].shipped, true);
  fremen.guildRateBlocked = { turn: 2, player: 'p' };
  assert.deepEqual(botTransport(fremen), []);
  fremen.karamaShipping = { player: 'p', owner: 'q' };
  assert.ok(botTransport(fremen).some(a => a.from === 'reserves'));
});
