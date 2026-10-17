import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { reactionAction, reactionPlayer } from './fixture-classic-independent-nexus-reactions';
import {
  createWorldNexusBorrowedPayment,
  createWorldNexusCunningPayment,
  worldNexusPaymentGates,
} from './fixture-nexus-core-world-payments';

const custody = (game: Game, id: string) => {
  const seat = reactionPlayer(game, id);
  return { forces: seat.forces, reserves: seat.reserves, elites: seat.elites ?? null, tanks: seat.tanks };
};
const worldForces = (game: Game, actor: string, id: string) => {
  const world = (viewGame(game, actor).homeworlds?.worlds ?? []).find(entry => entry.id === id);
  assert.ok(world);
  return world.forces;
};
const guildCounterTotal = (game: Game) => {
  const guild = reactionPlayer(game, 'guild');
  const visitors = (viewGame(game, 'guild').homeworlds?.worlds ?? [])
    .filter(world => world.native !== 'guild');
  return guild.reserves + Object.values(guild.forces).reduce((sum, n) => sum + n, 0) +
    visitors.reduce((sum, world) => sum + (world.forces.guild?.normal ?? 0) + (world.forces.guild?.elite ?? 0), 0);
};

void test('Basic base33 World Cunning return passes native permission, native rate and the funded Guild fee gate', () => {
  const f = createWorldNexusCunningPayment();
  assert.equal(f.game.phase, 5);
  assert.equal(f.game.active, 'guild');
  assert.equal(reactionPlayer(f.game, 'guild').shipped, true, 'The first Junction departure already used the shipment.');
  assert.equal(f.firstQuote.cost, 2);
  assert.equal(f.quote.cost, 2);
  assert.equal(f.quote.amount, 3);
  assert.equal(f.quote.ownPayment, 2);
  assert.equal(f.action.type, 'homeworldShip');
  assert.equal(f.action.destination, 'homeworld:guild');
  assert.deepEqual(f.action.sources, { 'homeworld:harkonnen': { normal: 3, elite: 0 } });
  assert.equal(f.game.nexusGuildCunningHistory!.at(-1)!.stage, 'secondShipment');
  assert.equal(viewGame(f.game, 'guild').nexusGuildCunning!.active!.movesLeft, 0,
    'The granted Cunning move is reserved for this second shipment, not normal movement.');
  const unrelated = ['atreides', 'harkonnen', 'emperor'].map(id => [id, custody(f.game, id)] as const);

  const gates = worldNexusPaymentGates(f.game, 'guild', f.action);
  assert.deepEqual(gates.kinds, ['guildTransportPermission', 'guildRate'],
    'The return route opens both native gates before any fee.');
  const invoice = gates.game.pendingGuildBetrayal!.invoice;
  assert.equal(invoice.price, 2);
  assert.equal(invoice.ownSpice, 3, 'No escrow is taken before the fee acknowledgement.');
  assert.deepEqual(gates.game.pendingGuildBetrayal!.required, ['emperor']);
  assert.equal(reactionPlayer(gates.game, 'guild').reserves, 12);
  assert.deepEqual(worldForces(gates.game, 'guild', 'homeworld:harkonnen').guild, { normal: 3, elite: 0 });
  assert.equal(viewGame(gates.game, 'emperor').guildBetrayalReaction!.canUse, false,
    'The original Guild singleton was already spent on Cunning itself.');
  assert.throws(() => reactionAction(gates.game, 'emperor',
    { type: 'guildBetrayalUse', event: invoice.event }), /cannot take this shipment payment/);

  let game = reactionAction(gates.game, 'emperor', { type: 'guildBetrayalPass', event: invoice.event });
  const guild = reactionPlayer(game, 'guild');
  assert.equal(worldForces(game, 'guild', 'homeworld:harkonnen').guild, undefined,
    'The actual visitor pool leaves Giedi Prime.');
  assert.deepEqual(worldForces(game, 'guild', 'homeworld:guild').guild, { normal: 15, elite: 0 });
  assert.equal(guild.reserves, 15);
  assert.equal(guildCounterTotal(game), guildCounterTotal(gates.game), 'No physical Guild counter is created or lost.');
  assert.deepEqual(game.nexusCards!.cards!.discard, ['guild']);
  assert.equal(game.nexusCards!.cards!.hands.emperor, 'harkonnen');
  for (const [id, before] of unrelated) assert.deepEqual(custody(game, id), before);

  game = reactionAction(game, 'guild', { type: 'endMovement' });
  assert.equal(game.nexusGuildCunningHistory!.at(-1)!.stage, 'completed');
  assert.equal(viewGame(game, 'guild').nexusGuildCunning ?? null, null);
  assert.notEqual(game.active, 'guild');
  assert.throws(() => reactionAction(game, 'guild', f.action), /unused shipment/,
    'The once-only card, payment and physical continuation cannot repeat.');
});

void test('Advanced all14 Richese borrowed Caladan shipment pays the distinct Guild holder its one-spice fee', () => {
  const f = createWorldNexusBorrowedPayment();
  assert.equal(f.source, 'homeworld:atreides');
  assert.deepEqual(f.sources, { 'homeworld:atreides': { normal: 5, elite: 0 } });
  assert.equal(f.action.type, 'ship');
  assert.equal(typeof f.action.nexus, 'string');
  assert.deepEqual(worldForces(f.game, 'atreides', 'homeworld:atreides').atreides, { normal: 10, elite: 0 });
  const unrelated = ['guild', 'harkonnen', 'emperor'].map(id => [id, custody(f.game, id)] as const);

  const gates = worldNexusPaymentGates(f.game, 'atreides', f.action);
  assert.deepEqual(gates.kinds, ['guildShipment']);
  const invoice = gates.game.pendingGuildBetrayal!.invoice;
  assert.equal(invoice.price, 1);
  assert.equal(invoice.originalReceiver, 'guild');
  assert.deepEqual(gates.game.pendingGuildBetrayal!.required, ['emperor']);
  assert.equal(reactionPlayer(gates.game, 'atreides').reserves, 10, 'Typed custody waits for the fee.');
  assert.equal(reactionPlayer(gates.game, 'atreides').forces[f.key] ?? 0, 0);
  assert.equal(viewGame(gates.game, 'emperor').guildBetrayalReaction!.canUse, true,
    'The distinct actual holder may still claim this fee.');

  const game = reactionAction(gates.game, 'emperor', { type: 'guildBetrayalUse', event: invoice.event });
  assert.equal(reactionPlayer(game, 'atreides').spice, reactionPlayer(gates.game, 'atreides').spice - 1);
  assert.equal(reactionPlayer(game, 'emperor').spice, reactionPlayer(gates.game, 'emperor').spice + 1);
  assert.equal(reactionPlayer(game, 'guild').spice, reactionPlayer(gates.game, 'guild').spice);
  assert.equal(reactionPlayer(game, 'atreides').forces[f.key], 5);
  assert.equal(reactionPlayer(game, 'atreides').reserves, 5);
  assert.deepEqual(worldForces(game, 'atreides', 'homeworld:atreides').atreides, { normal: 5, elite: 0 });
  assert.deepEqual(game.nexusCards!.cards!.discard, ['richese', 'guild']);
  assert.equal(game.nexusRicheseHistory!.at(-1)!.stage, 'shipped');
  for (const [id, before] of unrelated) assert.deepEqual(custody(game, id), before);
});

void test('the ordinary Advanced all14 Caladan shipment pays its full five-spice fee to the distinct Guild holder', () => {
  const f = createWorldNexusBorrowedPayment({ discounted: false });
  assert.equal(f.action.nexus, undefined);
  const gates = worldNexusPaymentGates(f.game, 'atreides', f.action);
  assert.deepEqual(gates.kinds, ['guildShipment']);
  const invoice = gates.game.pendingGuildBetrayal!.invoice;
  assert.equal(invoice.price, 5);
  assert.deepEqual(gates.game.pendingGuildBetrayal!.required, ['atreides', 'emperor']);
  assert.equal(viewGame(gates.game, 'emperor').guildBetrayalReaction!.canUse, true);

  const game = reactionAction(gates.game, 'emperor', { type: 'guildBetrayalUse', event: invoice.event });
  assert.equal(reactionPlayer(game, 'atreides').spice, reactionPlayer(gates.game, 'atreides').spice - 5);
  assert.equal(reactionPlayer(game, 'emperor').spice, reactionPlayer(gates.game, 'emperor').spice + 5);
  assert.equal(reactionPlayer(game, 'guild').spice, reactionPlayer(gates.game, 'guild').spice);
  assert.equal(reactionPlayer(game, 'atreides').forces[f.key], 5);
  assert.equal(reactionPlayer(game, 'atreides').reserves, 5);
  assert.deepEqual(game.nexusCards!.cards!.discard, ['guild']);
  assert.equal(game.nexusCards!.cards!.hands.emperor, null,
    'The used Guild singleton leaves its holder once; no duplicate exists.');
  assert.equal(game.nexusCards!.cards!.hands.atreides, 'harkonnen',
    'The rival Harkonnen face stays held by its own drawing seat.');
});
