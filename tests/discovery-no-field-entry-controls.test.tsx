import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameView } from '../game/engine';
import type { DiscoveryEntryOffer } from '../game/discovery-entry';
import {
  discoveryEntryBotActions, discoveryEntryDeclineAction, discoveryEntryMoveAction,
} from '../game/discovery-entry-options';
import { DiscoveryEntryDecision } from '../components/discovery-entry';

/** Controlled public projection only. These cases establish rendering and exact
 * action construction; they do not establish a native reveal/entry chronology
 * or claim to execute the stateful chooser's React event handlers. */
function view(physical = 0, marker = true): GameView {
  const offer: DiscoveryEntryOffer = { event: 'entry-round:0', token: 'discovery-token-1', owner: 'r',
    parent: 'meridian', destination: 'jacurutu-sietch', sector: 0,
    sources: physical ? [{ source: 'meridian:2', normal: physical, elite: 0 }] : [],
    ...(marker ? { noField: { tokenId: 'private-marker-id', event: 'private-marker-event', source: 'meridian:2' } } : {}),
    blocked: null, arrival: null };
  return { status: 'playing', phase: 0, turn: 3, me: 'r',
    decision: { kind: 'discoveryEntry', player: 'r', event: offer.event }, discoveryEntry: offer,
    players: [{ id: 'r', name: 'Richese', faction: 'richese', autopilot: null }] } as unknown as GameView;
}
function html(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(DiscoveryEntryDecision, { game, busy, act() {} }));
}

void test('marker-only entry defaults to a selected independent checkbox and explains concealed free relocation without a physical counter', () => {
  const game = view(), markup = html(game);
  assert.match(markup, /type="checkbox"[^>]*checked=""/);
  assert.match(markup, /aria-label="Move concealed No-Field inside"/);
  assert.match(markup, /Selected: 0 physical forces · 1 concealed marker/);
  assert.match(markup, /Move 0 physical forces and 1 concealed marker inside/);
  assert.match(markup, /Provisional concealed No-Field entry/);
  assert.match(markup, /without revealing its value or materializing reserves/);
  assert.match(markup, /existing shipment history stays unchanged/);
  assert.match(markup, /costs no spice and uses no shipment or normal movement/);
  assert.match(markup, /Select all forces and marker/);
  assert.match(markup, /Clear selection/);
  assert.match(markup, /Leave forces and marker outside/);
  assert.doesNotMatch(markup, /type="number"|private-marker-id|private-marker-event/);
});

void test('marker-only and combined adapters bind both current events while legacy physical packets stay unchanged', () => {
  for (const physical of [0, 2]) {
    const game = view(physical), offer = game.discoveryEntry!;
    const expected = { type: 'decision', event: offer.event, accept: true, groups: offer.sources,
      noField: offer.noField!.tokenId, noFieldEvent: offer.noField!.event };
    assert.deepEqual(discoveryEntryMoveAction(game, offer.sources, offer.noField), expected);
    assert.deepEqual(discoveryEntryBotActions(game), [expected,
      { type: 'decision', event: offer.event, accept: false }]);
    assert.match(html(game), new RegExp(`Selected: ${physical} physical forces · 1 concealed marker`));
  }
  const game = view(2), offer = game.discoveryEntry!;
  assert.deepEqual(discoveryEntryMoveAction(game, offer.sources), {
    type: 'decision', event: offer.event, accept: true, groups: offer.sources,
  });
  assert.equal(discoveryEntryMoveAction(game, []), null);
  assert.deepEqual(discoveryEntryDeclineAction(game), { type: 'decision', event: offer.event, accept: false });
  const legacy = html(view(2, false));
  assert.match(legacy, /Move 2 forces inside/);
  assert.match(legacy, /Select all forces/);
  assert.doesNotMatch(legacy, /checkbox|concealed marker|Provisional/);
});

void test('stale token marker-event parent-source and Discovery-event selections cannot construct an entry', () => {
  const game = view(), marker = game.discoveryEntry!.noField!;
  for (const stale of [
    { ...marker, tokenId: 'old-marker' }, { ...marker, event: 'old-marker-event' },
    { ...marker, source: 'meridian:3' }, { ...marker, source: 'imperial_basin:10' },
  ]) assert.equal(discoveryEntryMoveAction(game, [], stale), null);
  const changed = structuredClone(game);
  changed.discoveryEntry!.noField!.event = 'new-marker-event';
  assert.equal(discoveryEntryMoveAction(changed, [], marker), null);
  const wrongDecision = structuredClone(game);
  wrongDecision.discoveryEntry!.event = 'old-entry-round';
  assert.equal(discoveryEntryMoveAction(wrongDecision, [], marker), null);
  assert.equal(html(wrongDecision), '');
  const observer = structuredClone(game); observer.me = 'a';
  assert.equal(discoveryEntryMoveAction(observer, [], marker), null);
  assert.equal(html(observer), '');
});

void test('busy autopilot and blocked marker-only panels cannot offer an enabled move or selection control', () => {
  const busy = html(view(), true);
  assert.equal((busy.match(/<button[^>]*disabled=""/g) ?? []).length, 4);
  assert.match(busy, /<input[^>]*type="checkbox"[^>]*disabled=""/);
  const automatic = view(); automatic.players[0].autopilot = 'Hard';
  assert.equal((html(automatic).match(/<button[^>]*disabled=""/g) ?? []).length, 4);
  const blocked = view(); blocked.discoveryEntry!.blocked = 'The location is full.';
  assert.equal(discoveryEntryMoveAction(blocked, [], blocked.discoveryEntry!.noField), null);
  assert.deepEqual(discoveryEntryBotActions(blocked), []);
  assert.match(html(blocked), /The location is full/);
  assert.equal((html(blocked).match(/<button[^>]*disabled=""/g) ?? []).length, 4);
});
