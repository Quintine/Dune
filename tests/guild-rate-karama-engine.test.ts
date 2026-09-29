import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';

const player = (g: Game, id: string) => g.players.find(seat => seat.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(shipper: 'g' | 'e', advanced = false) {
  const g = createGame('GUILDRATE', newPlayer('g', 'Guild', 'guild'), advanced);
  g.players.push(newPlayer('e', 'Emperor', 'emperor'), newPlayer('a', 'Atreides', 'atreides'));
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.order = ['g', 'e', 'a'];
  g.movementRemaining = [...g.order];
  g.active = shipper;
  g.deck = baseDeck();
  for (const seat of g.players) {
    seat.forces = {};
    seat.reserves = 20;
    seat.spice = 20;
    seat.hand = [];
  }
  if (shipper === 'e') {
    player(g, 'e').ally = 'g';
    player(g, 'g').ally = 'e';
  }
  const index = g.deck.findIndex(card => card.effect === 'karama');
  const karama = g.deck.splice(index, 1)[0];
  player(g, 'a').hand.push(karama);
  return { g, karama };
}
function declare(g: Game, id: 'g' | 'e', amount: number, destination = 'arrakeen'): Game {
  return applyAction(g, id, {
    type: 'ship', territory: destination, sector: destination === 'arrakeen' ? 10 : 7,
    amount, allyPayment: 0,
  });
}
function cancel(g: Game, card: string): Game {
  assert.equal(g.response?.kind, 'guildRate');
  return applyAction(reload(g), 'a', { type: 'card', mode: 'cancel', card });
}
function reject(g: Game, actor: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}

void test('Karama removes Guild own discount before any forces or spice move, then charges full stronghold cost', () => {
  const { g: initial, karama } = fixture('g');
  const offered = declare(initial, 'g', 3);
  assert.equal(offered.response?.kind, 'guildRate');
  assert.equal(offered.pendingShipment?.cost, 2);
  assert.equal(player(offered, 'g').spice, 20);
  assert.equal(player(offered, 'g').reserves, 20);
  assert.equal(player(offered, 'g').shipped, false);
  const ownerView = viewGame(offered, 'g');
  assert.equal(ownerView.response?.kind, 'guildRate');
  assert.equal('spice' in ownerView.players.find(seat => seat.id === 'a')!, false);
  assert.equal(viewGame(offered, 'a').responseControls?.cancelCards.includes(karama.id), true);
  assert.deepEqual(normalizeAutomaticGame(reload(offered)), reload(offered));
  const done = cancel(offered, karama.id);
  assert.equal(done.pendingShipment, null);
  assert.equal(done.guildRateBlocked, undefined);
  assert.equal(player(done, 'g').spice, 17);
  assert.equal(player(done, 'g').reserves, 17);
  assert.equal(player(done, 'g').forces['arrakeen:10'], 3);
  assert.equal(player(done, 'g').shipped, true);
  assert.equal(done.discard.filter(card => card.id === karama.id).length, 1);
  reject(done, 'a', { type: 'card', mode: 'cancel', card: karama.id });
});

void test('the Guild ally can be repriced to full desert tariff without changing the approved payment split', () => {
  const { g: initial, karama } = fixture('e');
  const offered = declare(initial, 'e', 3, 'red_chasm');
  assert.equal(offered.pendingShipment?.cost, 3);
  const done = cancel(offered, karama.id);
  assert.equal(player(done, 'e').spice, 14);
  assert.equal(player(done, 'e').reserves, 17);
  assert.equal(player(done, 'e').forces['red_chasm:7'], 3);
  assert.equal(player(done, 'g').spice, 26);
  assert.equal(done.guildRateBlocked, undefined);
});

void test('unaffordable full price releases the physical declaration, spends Karama, and preserves one full-price replacement', () => {
  const { g: initial, karama } = fixture('e');
  player(initial, 'e').spice = 2;
  const offered = declare(initial, 'e', 4);
  assert.equal(offered.pendingShipment?.cost, 2);
  const withdrawn = cancel(offered, karama.id);
  assert.equal(player(withdrawn, 'e').spice, 2);
  assert.equal(player(withdrawn, 'e').reserves, 20);
  assert.equal(player(withdrawn, 'e').shipped, false);
  assert.equal(withdrawn.pendingShipment, null);
  assert.deepEqual(withdrawn.guildRateBlocked, { turn: 2, player: 'e' });
  assert.equal(viewGame(withdrawn, 'e').guildRateCanceled, true);
  assert.equal(viewGame(withdrawn, 'a').guildRateCanceled, false);
  const botState = reload(withdrawn);
  player(botState, 'e').bot = 'Easy';
  const botShipment = botActions(viewGame(botState, 'e')).find(action => action.type === 'ship');
  assert.ok(botShipment, 'The payer must retain a legal full-price AI shipment.');
  const botCompletion = applyAction(botState, 'e', botShipment);
  assert.equal(player(botCompletion, 'e').shipped, true);
  assert.ok(player(botCompletion, 'e').reserves < 20);
  assert.equal(withdrawn.discard.filter(card => card.id === karama.id).length, 1);
  reject(withdrawn, 'e', { type: 'ship', territory: 'arrakeen', sector: 10, amount: 4 });
  const replacement = declare(reload(withdrawn), 'e', 2);
  assert.equal(replacement.response?.kind === 'guildRate', false);
  assert.equal(player(replacement, 'e').spice, 0);
  assert.equal(player(replacement, 'e').reserves, 18);
  assert.equal(player(replacement, 'e').forces['arrakeen:10'], 2);
  assert.equal(replacement.guildRateBlocked?.player, 'e');
});

void test('a canceled unspent Guild discount expires after a completed turn', () => {
  const { g: initial, karama } = fixture('e');
  player(initial, 'e').spice = 2;
  let g = cancel(declare(initial, 'e', 4), karama.id);
  assert.equal(viewGame(g, 'e').guildRateCanceled, true);
  for (let turn = 0; g.phase === 5 && turn < g.players.length; turn++)
    g = applyAction(g, g.active!, { type: 'endMovement' });
  assert.equal(g.phase, 7);
  for (const phase of [7, 8]) {
    assert.equal(g.phase, phase);
    for (const seat of g.players) g = applyAction(g, seat.id, { type: 'ready' });
  }
  assert.equal(g.turn, 3);
  assert.equal(g.guildRateBlocked, undefined);
  assert.equal(viewGame(g, 'e').guildRateCanceled, false);
});

void test('approved allied contribution stays fixed while full-price Guild shipment routes only that contribution back', () => {
  const { g: initial, karama } = fixture('g');
  player(initial, 'g').ally = 'e';
  player(initial, 'e').ally = 'g';
  const funded = applyAction(initial, 'e', { type: 'pledgeAid', amount: 2 });
  const offered = applyAction(funded, 'g', {
    type: 'ship', territory: 'arrakeen', sector: 10, amount: 3, allyPayment: 1,
  });
  assert.equal(offered.pendingShipment?.cost, 2);
  assert.equal(offered.pendingShipment?.allyPayment, 1);
  const done = cancel(offered, karama.id);
  assert.equal(player(done, 'g').spice, 19);
  assert.equal(player(done, 'e').spice, 18);
  assert.equal(done.aid.e.amount, 1);
  assert.equal(player(done, 'g').forces['arrakeen:10'], 3);
});

void test('unused pledged aid is not silently added to a canceled split; the payer can authorize it on replacement', () => {
  const { g: initial, karama } = fixture('e');
  player(initial, 'e').spice = 2;
  const funded = applyAction(initial, 'g', { type: 'pledgeAid', amount: 2 });
  const offered = declare(funded, 'e', 4);
  assert.equal(offered.pendingShipment?.allyPayment, 0);
  const withdrawn = cancel(offered, karama.id);
  assert.equal(player(withdrawn, 'e').spice, 2);
  assert.equal(withdrawn.aid.g.amount, 2);
  assert.equal(player(withdrawn, 'e').shipped, false);
  const replacement = applyAction(reload(withdrawn), 'e', {
    type: 'ship', territory: 'arrakeen', sector: 10, amount: 4, allyPayment: 2,
  });
  assert.equal(player(replacement, 'e').spice, 0);
  assert.equal(replacement.aid.g.amount, 0);
  assert.equal(player(replacement, 'e').forces['arrakeen:10'], 4);
});

void test('a tampered saved rate opportunity cannot spend Karama, forces or payment', () => {
  const { g: initial, karama } = fixture('e');
  const offered = declare(initial, 'e', 3);
  const corrupt = reload(offered);
  corrupt.response!.guildRateEvent = 'obsolete';
  assert.throws(() => viewGame(corrupt, 'a'));
  reject(corrupt, 'a', { type: 'card', mode: 'cancel', card: karama.id });
});

void test('the Advanced Guild stop decision precedes the separate Karama rate response', () => {
  const { g: initial, karama } = fixture('e', true);
  const declared = declare(initial, 'e', 3);
  assert.equal(declared.decision?.kind, 'guildShipment');
  assert.equal(declared.response, null);
  const offered = applyAction(reload(declared), 'g', { type: 'decision', allow: true });
  assert.equal(offered.decision, null);
  assert.equal(offered.response?.kind, 'guildRate');
  assert.equal(player(offered, 'e').spice, 20);
  const done = cancel(offered, karama.id);
  assert.equal(player(done, 'e').spice, 17);
  assert.equal(player(done, 'e').forces['arrakeen:10'], 3);
});

void test('an unstamped saved Advanced declaration gains a turn stamp before its new rate response', () => {
  const { g: initial, karama } = fixture('e', true);
  const legacy = declare(initial, 'e', 3);
  assert.equal(legacy.decision?.kind, 'guildShipment');
  delete legacy.pendingShipment!.turn;
  const offered = applyAction(reload(legacy), 'g', { type: 'decision', allow: true });
  assert.equal(offered.response?.kind, 'guildRate');
  assert.equal(offered.pendingShipment?.turn, offered.turn);
  assert.equal(player(offered, 'e').spice, 20);
  const done = cancel(offered, karama.id);
  assert.equal(player(done, 'e').spice, 17);
  assert.equal(player(done, 'e').forces['arrakeen:10'], 3);
});

void test('Advanced BG Worthless converts into a saved rate cancellation without losing shipment custody', () => {
  const { g: initial, karama } = fixture('g', true);
  initial.players.push(newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  initial.order.push('b');
  initial.movementRemaining!.push('b');
  player(initial, 'b').spice = 20;
  player(initial, 'b').forces = {};
  player(initial, 'b').reserves = 20;
  const index = initial.deck.findIndex(card => card.kind === 'worthless');
  const worthless = initial.deck.splice(index, 1)[0];
  player(initial, 'b').hand.push(worthless);
  let g = declare(initial, 'g', 3);
  assert.equal(g.decision?.kind, 'guildShipment');
  g = applyAction(g, 'g', { type: 'decision', allow: true });
  assert.equal(g.response?.kind, 'guildRate');
  g = applyAction(reload(g), 'b', { type: 'card', mode: 'cancel', card: worthless.id });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(g.pendingKarama?.use.kind, 'cancel');
  assert.equal(g.pendingShipment?.guildRateEvent, g.pendingKarama?.use.kind === 'cancel'
    ? g.pendingKarama.use.response.guildRateEvent : null);
  assert.equal(viewGame(reload(g), 'a').response?.kind, 'worthlessKarama');
  for (let turn = 0; g.response && turn < 12; turn++) {
    const responder = g.players.find(seat => !g.response!.passed.includes(seat.id))!;
    g = applyAction(reload(g), responder.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  assert.equal(g.pendingShipment, null);
  assert.equal(player(g, 'g').spice, 17);
  assert.equal(player(g, 'g').forces['arrakeen:10'], 3);
  assert.equal(g.discard.filter(card => card.id === worthless.id).length, 1);
  assert.equal(player(g, 'a').hand.some(card => card.id === karama.id), true);
});

void test('all four AI profiles can pass the physical Guild rate response and finish a legal shipment', () => {
  for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const { g: initial } = fixture('g');
    player(initial, 'a').bot = level;
    let g = declare(initial, 'g', 3);
    const action = botActions(viewGame(g, 'a'))[0];
    assert.ok(action, `${level} must answer the Guild rate response`);
    g = applyAction(reload(g), 'a', action);
    assert.equal(player(g, 'g').forces['arrakeen:10'], 3);
    assert.equal(player(g, 'g').spice, 18);
    assert.equal(g.pendingShipment, null);
  }
});
