import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type Game } from '../game/engine';
import { moritaniBetrayalAction, moritaniBetrayalBotActions } from '../game/nexus-moritani-betrayal-options';
import { NexusMoritaniBetrayal } from '../components/nexus-moritani-betrayal';
import { grummanCollectionSignature } from '../game/grumman-collection-return';
import { nexusMoritaniFixture, nexusMoritaniInventory, nexusMoritaniReload } from './fixture-nexus-moritani';

function position() {
  const f = nexusMoritaniFixture({ stack: true, karama: false, cardOwner: 'q' });
  const g = applyAction(f.g, f.owner, { type: 'decision', decline: true });
  return { ...f, g };
}
function reject(g: Game, owner: string, action: { type: string; [key: string]: unknown }) {
  const before = nexusMoritaniReload(g);
  assert.throws(() => applyAction(g, owner, action));
  assert.deepEqual(g, before);
}

void test('Moritani Betrayal returns one actual placed token without disclosing its face or replaying Mentat placement', () => {
  const { g: initial, owner, target, observer } = position();
  const offer = viewGame(initial, target).nexusMoritaniBetrayal!;
  assert.equal(offer.blocked, null);
  assert.equal(offer.tokens.length, 1);
  const token = offer.tokens[0];
  const before = nexusMoritaniReload(initial);
  const action = moritaniBetrayalAction(viewGame(initial, target), token.id)!;
  assert.equal(moritaniBetrayalBotActions(viewGame(initial, target))[0].token, token.id);
  const g = applyAction(initial, target, action);
  nexusMoritaniInventory(g);
  assert.equal(g.nexusCards!.cards!.hands[target], null);
  assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'moritani').length, 1);
  assert.equal(g.moritaniTerror!.tokens.some(t => t.id === token.id), false);
  assert.equal(g.moritaniTerror!.tokens.filter(t => t.status === 'available').length,
    before.moritaniTerror!.tokens.filter(t => t.status === 'available').length + 1);
  assert.equal(g.moritaniTerror!.placementTurn, before.moritaniTerror!.placementTurn);
  assert.deepEqual(g.players.map(p => [p.forces, p.reserves, p.spice]), before.players.map(p => [p.forces, p.reserves, p.spice]));
  assert.deepEqual(g.nexusMoritaniLocations, before.nexusMoritaniLocations);
  assert.equal(viewGame(g, observer).nexusMoritaniBetrayal, null);
  assert.equal(viewGame(g, owner).nexusMoritaniBetrayal, null);
  assert.ok(g.log.at(-1)?.text.includes('without revealing'));
  reject(g, target, action);
  assert.deepEqual(viewGame(nexusMoritaniReload(g), target), viewGame(g, target));
});

void test('Moritani Betrayal rejects foreign, stale, pending and nonexistent token choices before spending either physical component', () => {
  const { g, owner, target, observer } = position();
  const offer = viewGame(g, target).nexusMoritaniBetrayal!;
  const action = moritaniBetrayalAction(viewGame(g, target), offer.tokens[0].id)!;
  reject(g, observer, action);
  reject(g, owner, action);
  reject(g, target, { ...action, event: 'old' });
  reject(g, target, { ...action, token: 'unknown' });
  const pending = nexusMoritaniReload(g);
  pending.decision = { kind: 'moritaniPlacement', player: owner };
  reject(pending, target, action);
  assert.equal(g.nexusCards!.cards!.hands[target], 'moritani');
});

void test('Betrayal offer and result depend on public token positions, not Moritani hidden faces', () => {
  const { g, target, observer } = position();
  const shuffled = nexusMoritaniReload(g);
  const placed = shuffled.moritaniTerror!.tokens.find(t => t.status === 'placed')!;
  const available = shuffled.moritaniTerror!.tokens.find(t => t.status === 'available')!;
  [placed.kind, available.kind] = [available.kind, placed.kind];
  assert.deepEqual(viewGame(g, target), viewGame(shuffled, target));
  assert.deepEqual(viewGame(g, observer), viewGame(shuffled, observer));
});

void test('Betrayal controls name the chosen public token and disable during a request', () => {
  const { g, target, observer } = position();
  const view = viewGame(g, target);
  const html = renderToStaticMarkup(createElement(NexusMoritaniBetrayal, { game: view, act() {}, busy: false }));
  assert.match(html, /Moritani Nexus · Betrayal/);
  assert.match(html, /Arrakeen/);
  assert.match(html, /Return hidden Terror token/);
  assert.doesNotMatch(html, /Sabotage/);
  assert.match(renderToStaticMarkup(createElement(NexusMoritaniBetrayal, { game: view, act() {}, busy: true })), /disabled=""/);
  assert.equal(renderToStaticMarkup(createElement(NexusMoritaniBetrayal, { game: viewGame(g, observer), act() {}, busy: false })), '');
});

void test('queued high-Grumman Collection resolves before a rival spends Moritani Betrayal', () => {
  const f = nexusMoritaniFixture({ stack: true, karama: false, cardOwner: 'q', homeworlds: true, native: 8 });
  const g = nexusMoritaniReload(f.g);
  // Reconstruct the saved automatic boundary just before opening the Grumman
  // choice; opening that choice only changes this frame and its decision.
  g.phase = 7;
  g.decision = null;
  g.grummanCollection!.stage = 'waiting';
  delete g.grummanCollection!.outcome;
  g.grummanCollection!.signature = grummanCollectionSignature(g.grummanCollection!);
  const view = viewGame(g, f.target);
  assert.equal(view.automaticContinuationPending, true);
  assert.match(view.nexusMoritaniBetrayal!.blocked!, /automatic phase continuation/);
  reject(g, f.target, { type: 'nexusMoritaniBetrayal',
    event: view.nexusMoritaniBetrayal!.event, token: view.nexusMoritaniBetrayal!.tokens[0].id });
});
