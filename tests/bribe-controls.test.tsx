import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerHooks } from 'node:module';
import { bribeAction } from '../game/bribe-options';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { bureaucratPaymentGame } from './bureaucrat-payment-fixture';

const aliases = registerHooks({ resolve(specifier, context, next) {
  return next(specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
} });
const { Bribes } = await import('../components/bribes');
aliases.deregister();

function game() {
  let g = createGame('BRIBES22', newPlayer('a', 'Atreides payer', 'atreides'));
  joinGame(g, newPlayer('h', 'Harkonnen recipient', 'harkonnen'));
  joinGame(g, newPlayer('e', 'Emperor observer', 'emperor'));
  g.players.forEach(p => { p.ready = true; });
  g = applyAction(g, 'a', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length) g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  assert.equal(g.status, 'playing');
  return g;
}
function options(g: Game, id = 'a') { return viewGame(g, id).bribeOptions; }
function reject(g: Game, actor: string, action: object) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, actor, action as Parameters<typeof applyAction>[2]));
  assert.equal(JSON.stringify(g), before);
}

void test('out-of-turn bribes debit once, stay private as escrow and collect once at Mentat after JSON restoration', () => {
  let g = game();
  g.active = 'e';
  const before = JSON.stringify(g);
  const quote = options(g);
  assert.equal(quote.blocked, null);
  assert.equal(quote.available, 10);
  assert.deepEqual(quote.targets.map(p => p.id), ['h', 'e']);
  assert.equal(JSON.stringify(g), before);
  const action = bribeAction(quote, 'h', 4)!;
  assert.deepEqual(action, { type: 'bribe', target: 'h', amount: 4 });
  g = JSON.parse(JSON.stringify(applyAction(g, 'a', action)));
  assert.equal(g.players[0].spice, 6);
  assert.equal(g.players[1].spice, 10);
  assert.equal(options(g, 'h').incoming, 4);
  assert.equal(options(g, 'h').available, 10);
  assert.equal(options(g, 'e').incoming, 0);
  assert.equal(viewGame(g, 'e').players[1].bribes, undefined);
  assert.match(g.log.at(-1)!.text, /paid a 4-spice bribe/);
  g.phase = 7; // Controlled later collection boundary, not a full-game sample.
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 8);
  assert.equal(g.players[1].spice, 14);
  assert.equal(options(g, 'h').incoming, 0);
  assert.match(options(g).blocked!, /Mentat/);
  assert.deepEqual(options(JSON.parse(JSON.stringify(g)), 'h'), options(g, 'h'));
});

void test('invalid amounts, self/allied recipients and stale client options never authorize a payment', () => {
  const g = game();
  g.players[0].ally = 'h'; g.players[1].ally = 'a';
  const quote = options(g);
  assert.deepEqual(quote.targets.map(p => p.id), ['e']);
  for (const target of ['a', 'h', 'missing']) {
    assert.equal(bribeAction(quote, target, 1), null);
    reject(g, 'a', { type: 'bribe', target, amount: 1 });
  }
  for (const amount of [0, -1, 1.5, 11, NaN, Infinity]) {
    assert.equal(bribeAction(quote, 'e', amount), null);
    reject(g, 'a', { type: 'bribe', target: 'e', amount });
  }
  for (const paused of [
    { phase: 8 },
    { inflation: { side: 'double', turn: 2 } },
    { phaseOpening: { passed: [], initialize: false } },
    { response: { kind: 'emperorGift', owner: 'e', recipient: 'h', amount: 1, passed: [] } },
    { truthtrance: { stage: 'priority', queue: [], passed: [], question: null } },
  ]) {
    const waiting = Object.assign(structuredClone(g), paused) as Game;
    assert.ok(options(waiting).blocked);
    assert.equal(bribeAction(options(waiting), 'e', 1), null);
    reject(waiting, 'a', { type: 'bribe', target: 'e', amount: 1 });
  }
});

void test('own auction commitment limits bribes without revealing a rivals supply', () => {
  const g = game();
  g.phase = 3;
  const card = g.deck.pop()!;
  g.auction = { cards: [card], index: 0, bid: 7, bidder: 'a', allyPayment: 0, active: 'e', opener: 0, passed: [] };
  assert.equal(options(g).available, 3);
  const other = structuredClone(g);
  other.players[1].spice = 999; other.players[1].bribes = 88;
  assert.deepEqual(options(other), options(g));
  assert.equal(options(applyAction(g, 'a', { type: 'bribe', target: 'h', amount: 3 })).available, 0);
  reject(g, 'a', { type: 'bribe', target: 'h', amount: 4 });
});

void test('Bureaucrat eligibility stays recipient-specific and a saved payment offers its existing decision', () => {
  const g = bureaucratPaymentGame();
  const paid = applyAction(g, 'p', bribeAction(options(g, 'p'), 'e', 5)!);
  assert.equal(paid.decision?.kind, 'bureaucratPayment');
  assert.ok(options(paid, 'p').blocked);
  const settled = applyAction(JSON.parse(JSON.stringify(paid)), 'b', {
    type: 'decision', event: paid.bureaucratPaymentEvent, redirect: true,
  });
  assert.equal(options(settled, 'e').incoming, 3);
  assert.equal(options(settled, 'p').available, 25);
  const unsupported = structuredClone(g);
  unsupported.expansions.push('ix');
  assert.equal(options(unsupported, 'p').targets.find(p => p.id === 'e')!.maximum, 4);
  assert.equal(options(unsupported, 'p').targets.find(p => p.id === 'b')!.maximum, 30);
  reject(unsupported, 'p', { type: 'bribe', target: 'e', amount: 5 });
});

void test('bribe controls render recipient choices, private escrow and disabled unselected or busy payment', () => {
  const g = game(); g.players[0].bribes = 4;
  const render = (state: Game, busy = false) => renderToStaticMarkup(createElement(Bribes, { game: viewGame(state, 'a'), busy, act() {} }));
  const html = render(g);
  assert.match(html, /4 spice awaiting Mentat/);
  assert.match(html, /Bribe recipient/);
  assert.match(html, /Harkonnen recipient/);
  assert.match(html, /the next Mentat Pause/);
  assert.match(html, /disabled=""[^>]*>Pay bribe/);
  assert.match(html, /rules\?topic=bribes#bribes/);
  assert.ok((render(g, true).match(/disabled=""/g) ?? []).length >= 3);
  g.phase = 8;
  assert.match(render(g), /Bribes cannot be made during Mentat Pause/);
  g.status = 'lobby';
  assert.equal(render(g), '');
});
