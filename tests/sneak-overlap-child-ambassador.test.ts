import assert from 'node:assert/strict';
import test from 'node:test';
import { act, player, createFremenOverlapFixture } from './fixture-overlap-fremen-native';

void test('Terror-first Sneak waits for its own BG choice and then earns a retained Ambassador', () => {
  const f = createFremenOverlapFixture('terror', false, true);
  const source = structuredClone(f.game);
  // Controlled physical-token selection in the original public fixture: return
  // its staged Robbery token to supply and put the existing Sneak token in the
  // same stronghold. No force, money, pending event or turn is installed.
  const robbery = source.moritaniTerror!.tokens.find(token => token.id === f.terror);
  const sneak = source.moritaniTerror!.tokens.find(token => token.kind === 'sneakAttack');
  assert.ok(robbery && sneak && sneak.status === 'available');
  robbery.status = 'available'; robbery.location = null;
  sneak.status = 'placed'; sneak.location = f.destination;
  const originalSpice = player(source, f.entrant).spice;
  const reserves = player(source, 'moritani').reserves;
  let game = act(source, f.entrant, f.shipment);
  // The first accompaniment belongs to the real original shipment.
  if (game.decision?.kind === 'advisor')
    game = act(game, 'beneGesserit', { type: 'decision', accept: false });
  assert.equal(game.pendingArrivalOverlap?.first, 'terror');
  assert.equal(game.pendingTerrorEntry?.token, sneak.id);
  game = act(game, 'moritani', { type: 'decision', reveal: true });
  assert.equal(game.pendingTerrorEntry?.stage, 'sneakAttack');
  game = act(game, 'moritani', { type: 'decision', amount: 1 });
  assert.equal(player(game, 'moritani').reserves, reserves - 1);
  assert.equal(player(game, 'moritani').forces[`${f.destination}:${f.sector}`], 1);
  assert.equal(game.pendingArrivalOverlap?.stage, 'second');
  const original = game.pendingAmbassador; assert.ok(original);
  assert.equal(original.entrant, f.entrant);
  game = act(game, 'ecaz', { type: 'decision', event: original.event, decline: true });
  assert.equal(game.pendingArrivalOverlap, null);
  // Sneak is its own off-planet arrival: its BG opportunity precedes any
  // additional Ambassador created by that same committed group.
  assert.equal(game.decision?.kind, 'advisor');
  assert.equal(game.decision?.player, 'beneGesserit');
  game = act(game, 'beneGesserit', { type: 'decision', accept: false });
  const later = game.pendingAmbassador; assert.ok(later, 'The same retained Ambassador also responds to the Sneak group');
  assert.equal(later.token, f.fremen);
  assert.equal(later.entrant, 'moritani');
  assert.notEqual(later.event, original.event);
  game = act(game, 'ecaz', { type: 'decision', event: later.event, decline: true });
  assert.equal(game.pendingAmbassador, null);
  assert.equal(game.pendingTerrorEntry, null);
  assert.equal(game.pendingArrivalOverlap, null);
  assert.equal(game.pendingArrivalReaction ?? null, null);
  assert.equal(game.ecazAmbassadors?.tokens.find(token => token.id === f.fremen)?.zone, 'placed');
  assert.equal(player(game, f.entrant).spice, originalSpice - 1);
  assert.equal(player(game, f.entrant).forces[`${f.destination}:${f.sector}`], 1);
  assert.equal(player(game, 'moritani').forces[`${f.destination}:${f.sector}`], 1);
});

void test('a direct Sneak arrival receives BG timing and triggers an eligible Ambassador', () => {
  const f = createFremenOverlapFixture('terror', false, true);
  const source = structuredClone(f.game);
  const inventory = source.ecazAmbassadors!;
  const old = inventory.tokens.find(token => token.id === f.fremen);
  const guild = inventory.tokens.find(token => token.effect === 'guild');
  assert.ok(old && guild && old.zone === 'placed');
  // Controlled custody-preserving token selection: use the original Guild
  // Ambassador in the same cohort and location. The original Guild entrant
  // cannot trigger its own faction's token, while the later Moritani entrant can.
  old.zone = 'supply'; old.location = null;
  if (guild.zone === 'pool') {
    const index = inventory.cohort.indexOf(old.id); assert.ok(index >= 0);
    inventory.cohort[index] = guild.id;
    old.zone = 'pool'; guild.zone = 'supply';
  }
  assert.equal(guild.zone, 'supply');
  guild.zone = 'placed'; guild.location = f.destination;
  const robbery = source.moritaniTerror!.tokens.find(token => token.id === f.terror);
  const sneak = source.moritaniTerror!.tokens.find(token => token.kind === 'sneakAttack');
  assert.ok(robbery && sneak && sneak.status === 'available');
  robbery.status = 'available'; robbery.location = null;
  sneak.status = 'placed'; sneak.location = f.destination;
  const originalSpice = player(source, f.entrant).spice;
  const reserves = player(source, 'moritani').reserves;
  let game = act(source, f.entrant, f.shipment);
  if (game.decision?.kind === 'advisor')
    game = act(game, 'beneGesserit', { type: 'decision', accept: false });
  assert.ok(!game.pendingArrivalOverlap, 'The Guild entrant does not trigger the Guild Ambassador');
  assert.equal(game.pendingTerrorEntry?.token, sneak.id);
  game = act(game, 'moritani', { type: 'decision', reveal: true });
  assert.equal(game.pendingTerrorEntry?.stage, 'sneakAttack');
  game = act(game, 'moritani', { type: 'decision', amount: 1 });
  assert.equal(player(game, 'moritani').reserves, reserves - 1);
  assert.equal(game.decision?.kind, 'advisor');
  assert.equal(game.decision?.player, 'beneGesserit');
  game = act(game, 'beneGesserit', { type: 'decision', accept: false });
  const later = game.pendingAmbassador; assert.ok(later);
  assert.equal(later.token, guild.id);
  assert.equal(later.entrant, 'moritani');
  game = act(game, 'ecaz', { type: 'decision', event: later.event, decline: true });
  assert.equal(game.pendingAmbassador, null);
  assert.equal(game.pendingTerrorEntry, null);
  assert.equal(game.pendingArrivalOverlap ?? null, null);
  assert.equal(game.pendingArrivalReaction ?? null, null);
  assert.equal(player(game, f.entrant).spice, originalSpice - 1);
  assert.equal(player(game, f.entrant).forces[`${f.destination}:${f.sector}`], 1);
  assert.equal(player(game, 'moritani').forces[`${f.destination}:${f.sector}`], 1);
});
