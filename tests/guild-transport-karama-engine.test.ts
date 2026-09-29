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

function fixture(shipper: 'g' | 'e' | 'f' = 'g', advanced = false) {
  const g = createGame('GUILDTRANSPORT', newPlayer('g', 'Guild', 'guild'), advanced);
  g.players.push(newPlayer('e', 'Emperor', 'emperor'), newPlayer('f', 'Fremen', 'fremen'),
    newPlayer('a', 'Atreides', 'atreides'));
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.order = ['g', 'e', 'f', 'a'];
  g.movementRemaining = [...g.order];
  g.active = shipper;
  g.deck = baseDeck();
  for (const seat of g.players) {
    seat.spice = 20;
    seat.reserves = 20;
    seat.forces = {};
    seat.hand = [];
  }
  if (shipper !== 'g') {
    player(g, shipper).ally = 'g';
    player(g, 'g').ally = shipper;
  }
  const karama = g.deck.splice(g.deck.findIndex(card => card.effect === 'karama'), 1)[0];
  player(g, 'a').hand.push(karama);
  return { g, karama };
}

function stationed(g: Game, id: string, sources: Record<string, number>) {
  const seat = player(g, id);
  seat.forces = { ...sources };
  seat.reserves -= Object.values(sources).reduce((sum, n) => sum + n, 0);
}
function declare(g: Game, id: string, sources: Record<string, number> | 'reserves',
  destination: string, sector = 0, allyPayment = 0, eliteForces?: Record<string, number>): Game {
  const selection = sources === 'reserves'
    ? { from: 'reserves', amount: 3 }
    : { forces: sources, ...(eliteForces ? { eliteForces } : {}) };
  return applyAction(g, id, {
    type: 'guildShip', ...selection, territory: destination, sector, allyPayment,
  });
}
function canceled(g: Game, card: string): Game {
  assert.equal(g.response?.kind, 'guildRate');
  return applyAction(reload(g), 'a', { type: 'card', mode: 'cancel', card });
}
function rejectUnchanged(g: Game, actor: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}
function physical(g: Game, id: string) {
  const seat = player(g, id);
  return { spice: seat.spice, reserves: seat.reserves, forces: seat.forces,
    elites: seat.elites, shipped: seat.shipped };
}

void test('multi-sector Guild cross-shipment waits unpaid, then Karama charges full for the exact selected forces', () => {
  const { g: initial, karama } = fixture();
  stationed(initial, 'g', { 'pasty_mesa:5': 2, 'pasty_mesa:6': 3 });
  const before = physical(initial, 'g');
  const offered = declare(initial, 'g', { 'pasty_mesa:5': 1, 'pasty_mesa:6': 2 }, 'carthag', 11);
  assert.equal(offered.response?.kind, 'guildRate');
  assert.equal(offered.pendingGuildTransport?.cost, 2);
  assert.equal(offered.pendingGuildTransport?.amount, 3);
  assert.deepEqual(physical(offered, 'g'), before);
  assert.equal(viewGame(offered, 'a').responseControls?.cancelCards.includes(karama.id), true);
  assert.equal(viewGame(offered, 'a').players.find(seat => seat.id === 'g')?.spice, undefined);
  assert.deepEqual(normalizeAutomaticGame(reload(offered)), reload(offered));
  const done = canceled(offered, karama.id);
  assert.equal(done.pendingGuildTransport, null);
  assert.equal(done.response, null);
  assert.equal(player(done, 'g').spice, 17);
  assert.equal(player(done, 'g').reserves, 15);
  assert.equal(player(done, 'g').forces['pasty_mesa:5'], 1);
  assert.equal(player(done, 'g').forces['pasty_mesa:6'], 1);
  assert.equal(player(done, 'g').forces['carthag:11'], 3);
  assert.equal(player(done, 'g').shipped, true);
  assert.equal(done.discard.filter(card => card.id === karama.id).length, 1);
  rejectUnchanged(done, 'a', { type: 'card', mode: 'cancel', card: karama.id });
});

void test('Guild return to abstract reserves is still a cancelable shipment and restores its exact force group', () => {
  const { g: initial, karama } = fixture();
  stationed(initial, 'g', { 'pasty_mesa:5': 2, 'pasty_mesa:6': 3 });
  const offered = declare(initial, 'g', { 'pasty_mesa:5': 1, 'pasty_mesa:6': 2 }, 'reserves');
  assert.equal(offered.response?.kind, 'guildRate');
  assert.equal(offered.pendingGuildTransport?.cost, 2);
  assert.equal(player(offered, 'g').reserves, 15);
  assert.equal(player(offered, 'g').spice, 20);
  const done = canceled(offered, karama.id);
  assert.equal(player(done, 'g').spice, 17);
  assert.equal(player(done, 'g').reserves, 18);
  assert.equal(player(done, 'g').forces['pasty_mesa:5'], 1);
  assert.equal(player(done, 'g').forces['pasty_mesa:6'], 1);
  assert.equal(player(done, 'g').shipped, true);
});

void test('passing a Guild transport rate response retains the half tariff and its Guild income', () => {
  const { g: initial } = fixture('e');
  stationed(initial, 'e', { 'imperial_basin:10': 2, 'imperial_basin:11': 3 });
  const offered = declare(initial, 'e', { 'imperial_basin:10': 1, 'imperial_basin:11': 2 }, 'red_chasm', 7);
  assert.equal(offered.pendingGuildTransport?.cost, 3);
  assert.equal(player(offered, 'e').spice, 20);
  assert.equal(player(offered, 'g').spice, 20);
  const pendingIncome = applyAction(reload(offered), 'a', { type: 'passResponse' });
  assert.equal(pendingIncome.pendingGuildTransport, null);
  assert.equal(pendingIncome.response?.kind, 'guildIncome');
  assert.equal(player(pendingIncome, 'e').spice, 17);
  assert.equal(player(pendingIncome, 'g').spice, 20);
  const done = applyAction(reload(pendingIncome), 'a', { type: 'passResponse' });
  assert.equal(player(done, 'g').spice, 23);
  assert.equal(player(done, 'e').forces['red_chasm:7'], 3);
  assert.equal(player(done, 'e').shipped, true);
});

void test('the reciprocal Guild ally retains elite selections and original aid split at canceled full desert price', () => {
  const { g: initial, karama } = fixture('e');
  stationed(initial, 'e', { 'imperial_basin:10': 2, 'imperial_basin:11': 3 });
  player(initial, 'e').elites = { reserves: 3, tanks: 0, forces: { 'imperial_basin:10': 1, 'imperial_basin:11': 1 }, revived: 0 };
  player(initial, 'e').spice = 5;
  const funded = applyAction(initial, 'g', { type: 'pledgeAid', amount: 2 });
  const offered = declare(funded, 'e', { 'imperial_basin:10': 1, 'imperial_basin:11': 2 },
    'red_chasm', 7, 1, { 'imperial_basin:10': 1, 'imperial_basin:11': 1 });
  assert.equal(offered.pendingGuildTransport?.cost, 3);
  assert.equal(offered.pendingGuildTransport?.allyPayment, 1);
  assert.equal(player(offered, 'e').spice, 5);
  assert.equal(player(offered, 'e').elites?.forces['imperial_basin:10'], 1);
  const done = canceled(offered, karama.id);
  assert.equal(player(done, 'e').spice, 0);
  assert.equal(done.aid.g.amount, 1);
  assert.equal(player(done, 'e').forces['imperial_basin:10'], 1);
  assert.equal(player(done, 'e').forces['imperial_basin:11'], 1);
  assert.equal(player(done, 'e').forces['red_chasm:7'], 3);
  assert.equal(player(done, 'e').elites?.forces['red_chasm:7'], 2);
  assert.equal(player(done, 'e').elites?.forces['imperial_basin:10'] ?? 0, 0);
  assert.equal(player(done, 'e').elites?.forces['imperial_basin:11'] ?? 0, 0);
  assert.equal(player(done, 'g').spice, 23);
  assert.equal(done.guildRateBlocked, undefined);
});

void test('an unfunded full-price return withdraws intact; its replacement pays full using newly approved aid', () => {
  const { g: initial, karama } = fixture();
  stationed(initial, 'g', { 'pasty_mesa:5': 2, 'pasty_mesa:6': 3 });
  player(initial, 'g').spice = 2;
  player(initial, 'g').ally = 'e';
  player(initial, 'e').ally = 'g';
  const funded = applyAction(initial, 'e', { type: 'pledgeAid', amount: 2 });
  const offered = declare(funded, 'g', { 'pasty_mesa:5': 1, 'pasty_mesa:6': 2 }, 'reserves');
  assert.equal(offered.pendingGuildTransport?.allyPayment, 0);
  const untouched = physical(offered, 'g');
  const withdrawn = canceled(offered, karama.id);
  assert.deepEqual(physical(withdrawn, 'g'), untouched);
  assert.equal(withdrawn.aid.e.amount, 2);
  assert.equal(withdrawn.pendingGuildTransport, null);
  assert.equal(withdrawn.guildRateBlocked?.player, 'g');
  assert.equal(viewGame(withdrawn, 'g').guildRateCanceled, true);
  assert.equal(viewGame(withdrawn, 'e').guildRateCanceled, false);
  assert.equal(withdrawn.discard.filter(card => card.id === karama.id).length, 1);
  rejectUnchanged(withdrawn, 'g', {
    type: 'guildShip', forces: { 'pasty_mesa:5': 1, 'pasty_mesa:6': 2 }, territory: 'reserves', allyPayment: 0,
  });
  const replacement = declare(reload(withdrawn), 'g',
    { 'pasty_mesa:5': 1, 'pasty_mesa:6': 2 }, 'reserves', 0, 1);
  assert.notEqual(replacement.response?.kind, 'guildRate');
  assert.equal(player(replacement, 'g').spice, 1);
  assert.equal(player(replacement, 'g').reserves, 18);
  assert.equal(replacement.aid.e.amount, 1);
  assert.equal(player(replacement, 'g').shipped, true);
});

void test('an allied Fremen southern-reserve cross uses the cancelable Guild rate, not off-planet reserves', () => {
  const { g: initial, karama } = fixture('f');
  const offered = declare(initial, 'f', 'reserves', 'carthag', 11);
  assert.equal(offered.response?.kind, 'guildRate');
  assert.equal(offered.pendingGuildTransport?.cost, 2);
  assert.equal(player(offered, 'f').reserves, 20);
  assert.equal(player(offered, 'f').spice, 20);
  const done = canceled(offered, karama.id);
  assert.equal(player(done, 'f').reserves, 17);
  assert.equal(player(done, 'f').spice, 17);
  assert.equal(player(done, 'f').forces['carthag:11'], 3);
  assert.equal(player(done, 'g').spice, 23);
  assert.equal(player(done, 'f').shipped, true);
});

void test('a withdrawn Fremen southern-reserve declaration preserves its native forces and requires full-price replacement', () => {
  const { g: initial, karama } = fixture('f');
  player(initial, 'f').spice = 2;
  const offered = declare(initial, 'f', 'reserves', 'carthag', 11);
  const withdrawn = canceled(offered, karama.id);
  assert.equal(withdrawn.pendingGuildTransport, null);
  assert.equal(player(withdrawn, 'f').reserves, 20);
  assert.equal(player(withdrawn, 'f').forces['carthag:11'] ?? 0, 0);
  assert.equal(player(withdrawn, 'f').spice, 2);
  assert.equal(player(withdrawn, 'f').shipped, false);
  assert.equal(viewGame(withdrawn, 'f').guildRateCanceled, true);
  rejectUnchanged(withdrawn, 'f', {
    type: 'guildShip', from: 'reserves', amount: 3, territory: 'carthag', sector: 11,
  });
  const replacement = applyAction(reload(withdrawn), 'f', {
    type: 'guildShip', from: 'reserves', amount: 2, territory: 'carthag', sector: 11,
  });
  assert.notEqual(replacement.response?.kind, 'guildRate');
  assert.equal(player(replacement, 'f').spice, 0);
  assert.equal(player(replacement, 'f').reserves, 18);
  assert.equal(player(replacement, 'f').forces['carthag:11'], 2);
});

void test('Advanced cross-transport retains the Guild rate response separately from the reserve shipment stop', () => {
  const { g: initial, karama } = fixture('e', true);
  stationed(initial, 'e', { 'imperial_basin:10': 3 });
  const offered = declare(initial, 'e', { 'imperial_basin:10': 3 }, 'arrakeen', 10);
  assert.equal(offered.decision, null);
  assert.equal(offered.response?.kind, 'guildRate');
  assert.equal(player(offered, 'e').forces['arrakeen:10'] ?? 0, 0);
  const done = canceled(offered, karama.id);
  assert.equal(player(done, 'e').spice, 17);
  assert.equal(player(done, 'e').forces['arrakeen:10'], 3);
  assert.equal(player(done, 'e').shipped, true);
});

void test('independently purchased Karama shipping remains half-price and bank-paid, not Guild-cancelable', () => {
  const { g: initial, karama } = fixture('e');
  player(initial, 'a').hand.splice(player(initial, 'a').hand.indexOf(karama), 1);
  player(initial, 'e').hand.push(karama);
  stationed(initial, 'e', { 'imperial_basin:10': 3 });
  const purchased = applyAction(initial, 'e', { type: 'card', mode: 'shipment', card: karama.id });
  assert.equal(purchased.karamaShipping?.player, 'e');
  const done = declare(purchased, 'e', { 'imperial_basin:10': 3 }, 'arrakeen', 10);
  assert.notEqual(done.response?.kind, 'guildRate');
  assert.equal(player(done, 'e').spice, 18);
  assert.equal(player(done, 'g').spice, 20);
  assert.equal(player(done, 'e').forces['arrakeen:10'], 3);
  assert.equal(done.karamaShipping, null);
});

void test('BG Worthless conversion preserves the signed cross-shipment while its cancellation waits', () => {
  const { g: initial, karama } = fixture('g', true);
  initial.players.push(newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  initial.order.push('b');
  initial.movementRemaining!.push('b');
  const bg = player(initial, 'b');
  bg.spice = 20;
  bg.reserves = 20;
  bg.forces = {};
  const index = initial.deck.findIndex(card => card.kind === 'worthless');
  const worthless = initial.deck.splice(index, 1)[0];
  bg.hand.push(worthless);
  stationed(initial, 'g', { 'pasty_mesa:5': 3 });
  let g = declare(initial, 'g', { 'pasty_mesa:5': 3 }, 'carthag', 11);
  const signature = g.pendingGuildTransport!.signature;
  g = applyAction(reload(g), 'b', { type: 'card', mode: 'cancel', card: worthless.id });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(g.pendingKarama?.use.kind === 'cancel'
    ? g.pendingKarama.use.response.kind : null, 'guildRate');
  assert.equal(g.pendingGuildTransport?.signature, signature);
  assert.equal(viewGame(reload(g), 'a').response?.kind, 'worthlessKarama');
  for (let turn = 0; g.response && turn < 12; turn++) {
    const responder = g.players.find(seat => !g.response!.passed.includes(seat.id))!;
    g = applyAction(reload(g), responder.id, { type: 'passResponse' });
  }
  assert.equal(g.pendingGuildTransport, null);
  assert.equal(g.response, null);
  assert.equal(player(g, 'g').spice, 17);
  assert.equal(player(g, 'g').forces['carthag:11'], 3);
  assert.equal(g.discard.filter(card => card.id === worthless.id).length, 1);
  assert.equal(player(g, 'a').hand.some(card => card.id === karama.id), true);
});

void test('a restored pending cross rejects stale or tampered physical and response data without mutation', () => {
  const { g: initial, karama } = fixture();
  stationed(initial, 'g', { 'pasty_mesa:5': 2, 'pasty_mesa:6': 3 });
  const offered = reload(declare(initial, 'g',
    { 'pasty_mesa:5': 1, 'pasty_mesa:6': 2 }, 'carthag', 11));
  const cancel: Action = { type: 'card', mode: 'cancel', card: karama.id };
  rejectUnchanged(offered, 'g', { type: 'guildShip', from: 'pasty_mesa:5', amount: 1, territory: 'reserves' });
  for (const corrupt of [
    (g: Game) => { g.response!.guildRateEvent = 'stale'; },
    (g: Game) => { g.pendingGuildTransport!.signature = 'stale'; },
    (g: Game) => { g.pendingGuildTransport!.turn = g.turn - 1; },
    (g: Game) => { g.pendingGuildTransport!.group[0][1] = 2; },
    (g: Game) => { g.pendingGuildTransport!.cost = 1; },
  ]) {
    const stale = reload(offered);
    corrupt(stale);
    const before = structuredClone(stale);
    assert.throws(() => viewGame(stale, 'a'));
    assert.throws(() => normalizeAutomaticGame(stale));
    assert.deepEqual(stale, before);
    rejectUnchanged(stale, 'a', cancel);
  }
});

void test('a depleted saved source cannot spend or arrive from the obsolete force group', () => {
  const { g: initial } = fixture();
  stationed(initial, 'g', { 'pasty_mesa:5': 2, 'pasty_mesa:6': 3 });
  const offered = reload(declare(initial, 'g',
    { 'pasty_mesa:5': 1, 'pasty_mesa:6': 2 }, 'carthag', 11));
  player(offered, 'g').forces['pasty_mesa:5'] = 0;
  const spice = player(offered, 'g').spice;
  const remaining = structuredClone(player(offered, 'g').forces);
  const released = applyAction(offered, 'a', { type: 'passResponse' });
  assert.equal(released.pendingGuildTransport, null);
  assert.equal(player(released, 'g').spice, spice);
  assert.deepEqual(player(released, 'g').forces, remaining);
  assert.equal(player(released, 'g').forces['carthag:11'] ?? 0, 0);
  assert.equal(player(released, 'g').shipped, false);
});

void test('all AI profiles pass pending transport and a blocked ally still selects a legal full-price shipment', () => {
  for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const { g: initial } = fixture();
    player(initial, 'a').bot = level;
    stationed(initial, 'g', { 'pasty_mesa:5': 3 });
    const offered = declare(initial, 'g', { 'pasty_mesa:5': 3 }, 'carthag', 11);
    const reply = botActions(viewGame(offered, 'a'))[0];
    assert.ok(reply, `${level} must respond to a legal Guild transport`);
    const completed = applyAction(reload(offered), 'a', reply);
    assert.equal(completed.pendingGuildTransport, null);
    assert.equal(player(completed, 'g').forces['carthag:11'], 3);
    assert.equal(player(completed, 'g').spice, 18);
  }
  const { g: initial, karama } = fixture('e');
  stationed(initial, 'e', { 'imperial_basin:10': 4 });
  player(initial, 'e').spice = 2;
  const withdrawn = canceled(declare(initial, 'e',
    { 'imperial_basin:10': 4 }, 'arrakeen', 10), karama.id);
  player(withdrawn, 'e').bot = 'Easy';
  const candidate = botActions(viewGame(withdrawn, 'e')).find(action =>
    action.type === 'ship' || action.type === 'guildShip');
  assert.ok(candidate, 'A canceled discount leaves the allied bot a legal full-price shipment.');
  const done = applyAction(reload(withdrawn), 'e', candidate);
  assert.equal(player(done, 'e').shipped, true);
  assert.ok(player(done, 'e').spice < 2);
});
