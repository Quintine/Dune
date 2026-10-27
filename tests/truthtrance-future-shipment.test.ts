import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, createGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { shipmentPromiseModeSupported, shipmentPromiseTurnAvailable } from '../game/shipment-promises';
import { ShipmentPromises } from '../components/shipment-promises';
import { botActions } from '../game/bots';

const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
// Controlled timing/funding probes; the separate fixture earns its source.
function fixture(spice = 6, advanced = false) {
  const g = createGame('FUTURESHIPPROBE', newPlayer('a', 'Current', 'atreides'), advanced);
  g.players.push(newPlayer('p', 'Waiting Emperor', 'emperor'), newPlayer('o', 'Other', advanced ? 'guild' : 'harkonnen'));
  Object.assign(g, { status: 'playing', phase: 5, turn: 2, storm: 18, active: 'a',
    order: ['a', 'p', 'o'], movementRemaining: ['a', 'p', 'o'], deck: baseDeck() });
  for (const p of g.players) { p.hand = []; p.forces = {}; p.reserves = 20; p.spice = 12; }
  player(g, 'p').spice = spice;
  return g;
}
function hold(g: Game, actor: string, effect: string) {
  const index = g.deck.findIndex(c => c.effect === effect); assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0]; player(g, actor).hand.push(card); return card.id;
}
function bind(state: Game, minimum = 6) {
  const g = structuredClone(state), card = hold(g, 'a', 'truthtrance');
  let game = applyAction(g, 'a', { type: 'card', card });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(p => !game.truthtrance!.passed.includes(p.id))!;
    game = applyAction(game, actor.id, { type: 'truthPass' });
  }
  assert.ok(viewGame(game, 'a').truthShipmentTargets.includes('p'));
  game = applyAction(game, 'a', { type: 'truthAsk', question: { kind: 'shipment', target: 'p', territory: 'carthag', minimum } });
  assert.ok(viewGame(game, 'p').truthShipmentAnswers!.includes('yes'));
  return applyAction(game, 'p', { type: 'truthAnswer', answer: 'yes' });
}
function pass(state: Game) {
  let g = state;
  for (let n = 0; g.response && n < 30; n++) {
    const actor = g.players.find(p => !g.response!.passed.includes(p.id))!;
    g = applyAction(g, actor.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null); return g;
}
function startTarget(state: Game) {
  let g = applyAction(state, 'a', { type: 'endMovement' });
  if (g.decision?.kind === 'guildTiming')
    g = pass(applyAction(g, g.decision.player, { type: 'decision', take: false }));
  assert.equal(g.active, 'p'); return g;
}
function complete(state: Game) {
  let g = state;
  for (let n = 0; !player(g, 'p').shipped && n < 20; n++) {
    if (g.response) g = pass(g);
    else if (g.decision?.kind === 'guildShipment')
      g = applyAction(g, g.decision.player, { type: 'decision', allow: true });
    else {
      const action = viewGame(g, 'p').shipmentCompletion?.actions[0]; assert.ok(action);
      g = applyAction(g, 'p', action);
    }
  }
  g = pass(g); assert.equal(player(g, 'p').shipped, true); return g;
}
function reject(g: Game, actor: string, action: Action) {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action)); assert.deepEqual(g, before);
}

void test('current-turn target timing distinguishes earlier phases from unused movement turns and admits native Richese', () => {
  const g = fixture();
  assert.equal(shipmentPromiseTurnAvailable(g, 'a', true), true);
  assert.equal(shipmentPromiseTurnAvailable(g, 'p', true), true);
  assert.equal(shipmentPromiseTurnAvailable(g, 'p', false), false);
  assert.equal(shipmentPromiseTurnAvailable({ ...g, movementRemaining: ['a'] }, 'p', true), false);
  assert.equal(shipmentPromiseTurnAvailable({ ...g, phase: 4 }, 'p', true), true);
  assert.equal(shipmentPromiseTurnAvailable({ ...g, phase: 2 }, 'p', false), true,
    'A prior-turn shipped flag does not consume the future current-turn opportunity');
  assert.equal(shipmentPromiseModeSupported({ ...g, phase: 4 }, 'p'), true);
  assert.equal(shipmentPromiseModeSupported({ ...g, phase: 4, advanced: true }, 'p'), true);
  assert.equal(shipmentPromiseModeSupported({ ...g, phase: 4, advanced: true, homeworlds: {} }, 'p'), false);
  assert.equal(shipmentPromiseModeSupported({ ...g, phase: 2, techTokens: {} }, 'p'), false);
  const mode = { ...g, advanced: true, active: 'r', expansions: ['choam'], semutaPreview: true,
    players: [{ id: 'r', faction: 'richese' }, { id: 'p', faction: 'emperor' }] };
  assert.equal(shipmentPromiseModeSupported(mode, 'p'), true);
  assert.equal(shipmentPromiseModeSupported(mode, 'r'), true);
});

void test('a waiting promise supplies no early executable action, survives the intervening turn and fulfills only actual later delivery', () => {
  const bound = bind(fixture());
  assert.equal(bound.active, 'a'); assert.equal(viewGame(bound, 'p').shipmentCompletion, null);
  const html = renderToStaticMarkup(createElement(ShipmentPromises, { game: viewGame(bound, 'p'), busy: false, act() { assert.fail('Render cannot act'); } }));
  assert.match(html, /Your shipment turn is still ahead/); assert.doesNotMatch(html, /Suggested next step/);
  reject(bound, 'p', { type: 'ship', territory: 'carthag', sector: 11, amount: 6 });
  reject(bound, 'p', { type: 'endMovement' });
  const active = startTarget(bound); assert.equal(active.shipmentPromises![0].released, undefined);
  assert.ok(viewGame(active, 'p').shipmentCompletion);
  const done = complete(active);
  assert.equal(done.shipmentPromises![0].fulfilled, true);
  assert.equal(player(done, 'p').forces['carthag:11'], 6); assert.equal(player(done, 'p').spice, 0);
});

void test('a foreign temporary price does not hide the waiting respondent’s owned Karama completion', () => {
  const g = fixture(3), own = hold(g, 'p', 'karama'), foreign = hold(g, 'a', 'karama');
  const bound = bind(g), priced = pass(applyAction(bound, 'a', { type: 'card', card: foreign, mode: 'shipment', target: 'a' }));
  assert.equal(priced.karamaShipping?.player, 'a');
  assert.equal(priced.shipmentPromises![0].released, undefined);
  assert.equal(viewGame(priced, 'p').shipmentCompletion, null);
  const active = startTarget(priced);
  assert.equal(viewGame(active, 'p').shipmentCompletion?.actions[0].card, own);
  const done = complete(active);
  assert.equal(done.shipmentPromises![0].fulfilled, true);
  assert.equal(player(done, 'p').spice, 0); assert.equal(player(done, 'p').forces['carthag:11'], 6);
  assert.equal(done.discard.filter(c => c.id === own).length, 1);
});

void test('a waiting Emperor cannot declare a gift that removes the last completion, while an affordable gift remains legal', () => {
  for (const spice of [6, 7]) {
    const g = fixture(spice); player(g, 'p').ally = 'a'; player(g, 'a').ally = 'p';
    const bound = bind(g), gift = { type: 'emperorGift', amount: 1 };
    if (spice === 6) reject(bound, 'p', gift);
    else {
      const gifted = pass(applyAction(bound, 'p', gift));
      assert.equal(player(gifted, 'p').spice, 6); assert.equal(gifted.shipmentPromises![0].released, undefined);
      assert.equal(complete(startTarget(gifted)).shipmentPromises![0].fulfilled, true);
    }
  }
});

void test('a waiting Bene Gesserit can accompany only while retaining a legal promised reserve shipment', () => {
  for (const reserves of [1, 2]) {
    const g = fixture(6);
    player(g, 'p').faction = 'beneGesserit';
    player(g, 'p').name = 'Waiting Bene Gesserit';
    player(g, 'p').reserves = reserves;
    player(g, 'p').forces = { 'polar_sink:0': 20 - reserves };
    const bound = bind(g, 1);
    const shipped = pass(applyAction(bound, 'a', {
      type: 'ship', territory: 'carthag', sector: 11, amount: 1,
    }));
    assert.equal(shipped.decision?.kind, 'advisor');
    assert.equal(shipped.shipmentPromises![0].released, undefined);
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(shipped, 'p');
      view.players.find(p => p.id === 'p')!.bot = difficulty;
      const choices = botActions(view);
      assert.deepEqual(choices, [{ type: 'decision', accept: false }]);
      assert.equal(applyAction(shipped, 'p', choices[0]).decision, null);
    }
    if (reserves === 1) reject(shipped, 'p', { type: 'decision', accept: true });
    const choice = pass(applyAction(shipped, 'p', { type: 'decision', accept: reserves === 2 }));
    assert.equal(player(choice, 'p').reserves, 1);
    const done = complete(startTarget(choice));
    assert.equal(done.shipmentPromises![0].fulfilled, true);
    assert.equal(player(done, 'p').forces['carthag:11'], 1);
  }
});

for (const stop of [false, true]) void test(
  `a foreign approved shipment locks outgoing funding until ${stop ? 'stop refunds it for the waiting completion' : 'delivery spends it and releases the impossible answer'}`, () => {
    const g = fixture(6, true); player(g, 'p').ally = 'a'; player(g, 'a').ally = 'p';
    const karama = hold(g, 'o', 'karama');
    const pledged = applyAction(g, 'p', { type: 'pledgeAid', amount: 2 });
    const bound = bind(pledged), pending = applyAction(bound, 'a', {
      type: 'ship', territory: 'carthag', sector: 11, amount: 2, allyPayment: 2,
    });
    assert.equal(pending.decision?.kind, 'guildShipment');
    assert.equal(pending.shipmentPromises![0].released, undefined);
    reject(pending, 'p', { type: 'pledgeAid', amount: 0 });
    const settled = pass(applyAction(pending, 'o', stop
      ? { type: 'card', mode: 'special', card: karama }
      : { type: 'decision', allow: true }));
    assert.equal(settled.shipmentPromises![0].released === true, !stop);
    assert.equal(settled.aid.p.amount, stop ? 2 : 0);
    if (stop) {
      const done = complete(startTarget(settled));
      assert.equal(done.shipmentPromises![0].fulfilled, true);
      assert.equal(player(done, 'p').forces['carthag:11'], 6);
    }
  });
