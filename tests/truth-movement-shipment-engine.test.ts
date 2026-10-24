import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { actTruthMovement as act } from './fixture-truth-movement';
import { createTruthMovementShipmentFixture as classic, createTruthMovementShipmentChoamFixture as choam,
  createTruthMovementShipmentEmperorFixture as emperor, createTruthMovementShipmentGuildFixture as guild,
  truthMovementShipmentInventory as inventory } from './fixture-truth-movement-shipment';

function ask(game: Game, asker: string, card: string, question: Record<string, unknown>) {
  game = act(game, asker, { type: 'card', card });
  for (const p of game.players) if (!game.truthtrance!.passed.includes(p.id)) game = act(game, p.id, { type: 'truthPass' });
  return act(game, asker, { type: 'truthAsk', question });
}
void test('a genuine active pre-shipment turn can promise an eleven-force movement using actual reserve shipment', () => {
  const f = classic({ hajr: false });
  const game = ask(f.game, f.asker, f.truth, f.claim);
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
});
function pass(game: Game): Game {
  if (game.pendingTreacheryDiscard?.reaction) {
    const event = game.pendingTreacheryDiscard.batch.event;
    for (const p of game.players) game = act(game, p.id, { type: 'semutaPass', event });
  }
  while (game.response) {
    const p = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(p);
    game = act(game, p.id, { type: 'passResponse' });
  }
  return game;
}
function bindClassic(answer = 'yes') {
  const f = classic({ hajr: false });
  let game = ask(f.game, f.asker, f.truth, f.claim);
  game = pass(act(game, f.target, { type: 'truthAnswer', answer }));
  return { f, game };
}
void test('real city reinforcement pays once, leaves the ground promise pending and moves the combined eleven forces', () => {
  const { f, game: bound } = bindClassic(), before = structuredClone(bound);
  const first = viewGame(bound, f.target).movementPromisePolicy![0];
  assert.equal(first.type, 'ship'); assert.equal(first.territory, 'arrakeen'); assert.equal(first.amount, 1);
  assert.deepEqual(bound, before);
  let game = pass(act(bound, f.target, first));
  const owner = game.players.find(p => p.id === f.target)!;
  assert.equal(owner.spice, f.balances[f.target] - 1); assert.equal(owner.reserves, 9);
  assert.equal(owner.forces['arrakeen:10'], 11); assert.equal(game.movementPromises![0].fulfilled, undefined);
  game = act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]);
  assert.equal(game.movementPromises![0].fulfilled, true);
  game = act(game, f.target, { type: 'endMovement' });
  assert.deepEqual(inventory(game), f.originalCards);
});
void test('voluntary shipment away from the only reinforcing origin cannot erase the accepted eleven-force route', () => {
  const { f, game } = bindClassic(), before = structuredClone(game);
  assert.throws(() => act(game, f.target, { ...f.shipment, territory: 'carthag', sector: 11 }));
  assert.deepEqual(game, before);
  assert.throws(() => act(game, f.target, { type: 'endMovement' }));
});
void test('No allows a matching-destination shipment but still forbids the subsequent qualifying ground movement', () => {
  const f = classic({ hajr: false });
  let game = ask(f.game, f.asker, f.truth, { ...f.claim, minimum: 1 });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = pass(act(game, f.target, { ...f.shipment, territory: 'carthag', sector: 11 }));
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  assert.throws(() => act(game, f.target, { ...f.move, amount: 1 }));
  game = act(game, f.target, { type: 'endMovement' }); assert.equal(game.movementPromises![0].fulfilled, true);
});
void test('genuine zero-board native Emperor and CHOAM sources can promise movement before their actual shipment', () => {
  for (const f of [emperor(), choam()]) {
    let game = ask(f.game, f.asker, f.truth, f.claim);
    assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
    game = pass(act(game, f.target, { type: 'truthAnswer', answer: 'yes' }));
    assert.equal(viewGame(game, f.target).movementPromisePolicy![0].type, 'ship');
    game = pass(act(game, f.target, f.shipment));
    assert.equal(game.movementPromises![0].fulfilled, undefined);
    if ('kulon' in f) game = pass(act(game, f.target, { type: 'card', mode: 'choam', card: f.kulon }));
    game = pass(act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]));
    assert.equal(game.movementPromises![0].fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
  }
});
void test('the voluntary bribe quote retains the one-spice reinforcement needed by the eleven-force route', () => {
  const { f, game } = bindClassic(), before = structuredClone(game);
  const maximum = viewGame(game, f.target).bribeOptions.targets.find(p => p.id === f.asker)!.maximum;
  assert.equal(maximum, f.balances[f.target] - 1);
  assert.throws(() => act(game, f.target, { type: 'bribe', target: f.asker, amount: maximum + 1 }));
  assert.deepEqual(game, before);
  const after = act(game, f.target, { type: 'bribe', target: f.asker, amount: maximum });
  assert.equal(viewGame(after, f.target).movementPromisePolicy![0].type, 'ship');
});
void test('a controlled conserved second Truth answer keeps shipment Yes ahead of movement No and never suggests illegal End', () => {
  const f = classic({ hajr: false }), source = structuredClone(f.game);
  const extra = source.deck.splice(source.deck.findIndex(card => card.effect === 'truthtrance'), 1)[0]; assert.ok(extra);
  source.players.find(p => p.id === f.asker)!.hand.push(extra);
  let game = ask(source, f.asker, f.truth, { kind: 'shipment', target: f.target, territory: 'arrakeen', minimum: 1 });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = ask(game, f.asker, extra.id, f.claim); game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  const first = viewGame(game, f.target).movementPromisePolicy![0]; assert.equal(first.type, 'ship');
  game = pass(act(game, f.target, first));
  assert.equal(game.shipmentPromises![0].fulfilled, true); assert.equal(game.movementPromises![0].fulfilled, undefined);
  assert.deepEqual(viewGame(game, f.target).movementPromisePolicy, [{ type: 'endMovement' }]);
  game = act(game, f.target, { type: 'endMovement' }); assert.equal(game.movementPromises![0].fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});
function counterSource() {
  const f = guild(), source = structuredClone(f.game);
  const counter = source.deck.splice(source.deck.findIndex(card => card.effect === 'karama'), 1)[0]; assert.ok(counter);
  source.players.find(p => p.id === f.asker)!.hand.push(counter);
  return { f, source, counter };
}
void test('a controlled acquired counter holds the real Guild-rate declaration until its original allowed shipment', () => {
  const { f, source } = counterSource(); let game = ask(source, f.asker, f.truth, f.claim);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = act(game, f.target, f.discountedShipment);
  assert.equal(game.response?.kind, 'guildRate'); assert.equal(game.pendingShipment?.amount, 2);
  const before = structuredClone(game); viewGame(game, f.target); viewGame(game, f.asker); assert.deepEqual(game, before);
  assert.equal(game.movementPromises![0].fulfilled, undefined); assert.equal(game.movementPromises![0].released, undefined);
  game = pass(game);
  assert.equal(game.players.find(p => p.id === f.target)!.spice, 4);
  assert.equal(game.players.find(p => p.id === f.target)!.forces['arrakeen:10'], 2);
  game = act(game, f.target, f.move); assert.equal(game.movementPromises![0].fulfilled, true);
  assert.deepEqual(inventory(game), f.originalCards);
});
void test('a controlled acquired counter raises the real Guild price and releases an impossible seven-force promise', () => {
  const { f, source, counter } = counterSource();
  let game = ask(source, f.asker, f.truth, { ...f.claim, territory: 'south_mesa', minimum: 7 });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = act(game, f.target, { type: 'bribe', target: f.asker, amount: 4 });
  game = act(game, f.target, { ...f.discountedShipment, territory: 'tueks_sietch', sector: 5 });
  assert.equal(game.response?.kind, 'guildRate');
  game = act(game, f.asker, { type: 'card', card: counter.id, mode: 'cancel' });
  const own = game.players.find(p => p.id === f.target)!;
  assert.equal(own.spice, 1); assert.equal(own.reserves, 15); assert.equal(own.shipped, false);
  assert.deepEqual(own.forces, { 'tueks_sietch:5': 5 });
  assert.equal(game.movementPromises![0].released, true); assert.deepEqual(inventory(game), f.originalCards);
});
void test('controlled acquired-counter Guild cross-shipment preserves the exact permission and rate frames before ground fulfillment', () => {
  const { f, source } = counterSource(); let game = ask(source, f.asker, f.truth, f.claim);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = act(game, f.target, f.crossShipment);
  assert.ok(game.pendingGuildTransport); const before = structuredClone(game);
  viewGame(game, f.target); assert.deepEqual(game, before);
  game = pass(game);
  const own = game.players.find(p => p.id === f.target)!;
  assert.equal(own.reserves, 15); assert.equal(own.spice, 4); assert.equal(own.forces['arrakeen:10'], 2);
  game = act(game, f.target, f.move); assert.equal(game.movementPromises![0].fulfilled, true);
});
void test('controlled acquired-counter Guild return cannot split away the only five-force ground group', () => {
  const { f, source } = counterSource();
  let game = ask(source, f.asker, f.truth, { ...f.claim, territory: 'south_mesa', minimum: 5 });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' }); const before = structuredClone(game);
  assert.throws(() => act(game, f.target, f.returnShipment)); assert.deepEqual(game, before);
});
void test('all four minimal profiles reinforce the original ten-force group and finish its promised movement', () => {
  const f = classic({ hajr: false }), asked = ask(f.game, f.asker, f.truth, f.claim);
  for (const difficulty of DIFFICULTIES) {
    let game = asked, count = 0;
    while (game.phase === 5 && game.active === f.target && count++ < 12) {
      const view = viewGame(game, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
      const action = botActions(view)[0]; assert.ok(action); game = pass(act(game, f.target, action));
    }
    assert.ok(count < 12); assert.equal(game.movementPromises![0].fulfilled, true);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});
