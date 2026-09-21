import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { nexusReady, orderNexusSpice } from './fixture-nexus-cards';

function lobby() {
  const g = createGame('DRAWPILE', newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  return g;
}
function setup() {
  let g = lobby();
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return applyAction(g, 'e', { type: 'start' });
}
function started() {
  let g = setup();
  for (const p of g.players)
    if (p.traitorChoices.length) g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  assert.equal(g.status, 'playing');
  return g;
}
function assertPublic(g: Game, expected: { treachery: number; spice: number } | null) {
  const before = JSON.stringify(g);
  for (const p of g.players) {
    const view = viewGame(g, p.id);
    assert.deepEqual(view.drawPiles, expected);
    assert.equal('deck' in view, false);
    assert.equal('discard' in view, false);
    assert.equal('spiceDeck' in view, false);
    for (const rival of view.players.filter(other => other.id !== p.id))
      assert.equal(rival.hand, undefined);
    assert.deepEqual(viewGame(JSON.parse(before), p.id).drawPiles, expected);
  }
  assert.equal(JSON.stringify(g), before);
}

void test('draw counts appear after genuine setup and exclude dealt hands for every seat', () => {
  assertPublic(lobby(), null);
  const prepared = setup();
  assert.equal(prepared.status, 'setup');
  assertPublic(prepared, { treachery: baseDeck().length, spice: 21 });
  const g = started();
  assert.equal(g.players.reduce((n, p) => n + p.hand.length, 0), 4);
  assertPublic(g, { treachery: baseDeck().length - 4, spice: 21 });
  const oldView = viewGame(g, 'e');
  g.deck.reverse(); g.spiceDeck.reverse();
  assert.deepEqual(viewGame(g, 'e').drawPiles, oldView.drawPiles);
  oldView.drawPiles!.treachery = 999;
  assert.notEqual(viewGame(g, 'e').drawPiles!.treachery, 999);
});

void test('real auction draws and exhausted-pile recycling keep unsold lots separate', () => {
  for (const refill of [false, true]) {
    let g = started();
    // Controlled Charity boundary; retain all physical cards and use real ready/draw actions.
    for (const p of g.players) g.deck.push(...p.hand.splice(0));
    Object.assign(g, { phase: 2, ready: [], phaseOpening: null });
    if (refill) g.discard.push(...g.deck.splice(0));
    assertPublic(g, { treachery: refill ? 0 : baseDeck().length, spice: 21 });
    g = nexusReady(g);
    assert.equal(g.phase, 3);
    assert.ok(g.auction);
    assert.equal(g.auction.cards.length, 3);
    assertPublic(g, { treachery: baseDeck().length - 3, spice: 21 });
    assert.equal(viewGame(g, 'e').auction!.remaining, 3);
    assert.equal(viewGame(g, 'e').auction!.card, null);
    assert.deepEqual([...g.deck, ...g.auction.cards].map(c => c.id).sort(), baseDeck().map(c => c.id).sort());
    assert.equal(g.discard.length, 0);
  }
});

void test('empty Spice pile survives viewing and refills through a real later-turn Spice draw', () => {
  let g = started();
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  Object.assign(g, { turn: 2, storm: 18, phase: 0, ready: [], stormDials: {}, stormPending: null });
  g.spiceDiscard[0].push(...g.spiceDeck.splice(0));
  // A Thumper annotation is not a physical Spice Card and must not refill the pile.
  g.spiceDiscard[0].push({ worm: true, thumper: true });
  assertPublic(g, { treachery: baseDeck().length, spice: 0 });
  for (const id of g.stormDialers) g = applyAction(g, id, { type: 'stormDial', amount: 1 });
  g = nexusReady(g);
  assert.equal(g.phase, 1);
  g = nexusReady(g);
  assert.ok(g.spiceWindow);
  const drawn = g.spiceDiscard.flat();
  assert.ok(drawn.length >= 1 && drawn.length <= 7); // Worms may precede the territory.
  assert.equal(drawn.filter(c => 'territory' in c).length, 1);
  assert.ok([...drawn, ...g.spiceDeck].every(c => !('worm' in c && c.thumper)));
  assertPublic(g, { treachery: baseDeck().length, spice: 21 - drawn.length });
  assert.equal(g.spiceDeck.length + drawn.length, 21);
});

void test('first-turn worms set aside leave the draw count and return after the Spice window', () => {
  let g = started();
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  orderNexusSpice(g, ['worm', 'land']);
  for (const id of g.stormDialers) g = applyAction(g, id, { type: 'stormDial', amount: 0 });
  g = nexusReady(g);
  assert.equal(g.phase, 1);
  g = nexusReady(g);
  assert.ok(g.spiceWindow);
  assert.equal(g.spiceSequence?.skipped.length, 1);
  assertPublic(g, { treachery: baseDeck().length, spice: 19 });
  g = nexusReady(g);
  assert.equal(g.phase, 2);
  assert.equal(g.spiceSequence, null);
  assertPublic(g, { treachery: baseDeck().length, spice: 20 });
});
