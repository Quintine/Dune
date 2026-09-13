import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameView } from '../game/engine';
import { botActions } from '../game/bots';
import type { DiscoveryEntryOffer } from '../game/discovery-entry';
import {
  discoveryEntryBotActions,
  discoveryEntryDeclineAction,
  discoveryEntryMoveAction,
} from '../game/discovery-entry-options';
import { DiscoveryEntryDecision } from '../components/discovery-entry';

type EntryView = GameView & { discoveryEntry: DiscoveryEntryOffer | null };

function view(): EntryView {
  return {
    status: 'playing',
    me: 'f',
    decision: {
      kind: 'discoveryEntry',
      player: 'f',
      event: 'entry-round:0',
    },
    discoveryEntry: {
      event: 'entry-round:0',
      token: 'discovery-token-1',
      owner: 'f',
      parent: 'meridian',
      destination: 'jacurutu-sietch',
      sector: 0,
      sources: [
        { source: 'meridian:2', normal: 2, elite: 1 },
        { source: 'meridian:3', normal: 1, elite: 1 },
      ],
      blocked: null,
      arrival: null,
    },
    players: [
      {
        id: 'f',
        name: 'Fremen',
        faction: 'fremen',
        autopilot: null,
      },
    ],
  } as unknown as EntryView;
}

function html(game: EntryView, busy = false) {
  return renderToStaticMarkup(
    createElement(DiscoveryEntryDecision, {
      game,
      busy,
      act() {},
    }),
  );
}

void test('entry actions bind the projected event and exact positive typed source subsets', () => {
  const game = view(), before = structuredClone(game);
  assert.deepEqual(
    discoveryEntryMoveAction(game, [
      { source: 'meridian:3', normal: 1, elite: 0 },
      { source: 'meridian:2', normal: 0, elite: 1 },
    ]),
    {
      type: 'decision',
      event: 'entry-round:0',
      accept: true,
      groups: [
        { source: 'meridian:2', normal: 0, elite: 1 },
        { source: 'meridian:3', normal: 1, elite: 0 },
      ],
    },
  );
  assert.deepEqual(discoveryEntryDeclineAction(game), {
    type: 'decision',
    event: 'entry-round:0',
    accept: false,
  });
  assert.equal(discoveryEntryMoveAction(game, []), null);
  assert.equal(
    discoveryEntryMoveAction(game, [
      { source: 'meridian:2', normal: 3, elite: 0 },
    ]),
    null,
  );
  assert.equal(
    discoveryEntryMoveAction(game, [
      { source: 'meridian:2', normal: 0, elite: 0 },
    ]),
    null,
  );
  assert.equal(
    discoveryEntryMoveAction(game, [
      { source: 'meridian:2', normal: 1, elite: 0 },
      { source: 'meridian:2', normal: 1, elite: 0 },
    ]),
    null,
  );
  assert.deepEqual(game, before);
});

void test('the legal bot path moves every quoted typed force and retains decline second', () => {
  const game = view(), before = structuredClone(game);
  const expected = [
    {
      type: 'decision',
      event: 'entry-round:0',
      accept: true,
      groups: game.discoveryEntry!.sources,
    },
    {
      type: 'decision',
      event: 'entry-round:0',
      accept: false,
    },
  ];
  assert.deepEqual(discoveryEntryBotActions(game), expected);
  assert.deepEqual(botActions(game), expected);
  assert.deepEqual(game, before);

  const blocked = structuredClone(game);
  blocked.discoveryEntry!.blocked = 'The location is full.';
  assert.deepEqual(discoveryEntryBotActions(blocked), []);
  const observer = structuredClone(game);
  observer.me = 'a';
  assert.deepEqual(discoveryEntryBotActions(observer), []);
  const stale = structuredClone(game);
  (stale.decision as { event: string }).event = 'entry-round:3';
  assert.deepEqual(discoveryEntryBotActions(stale), []);
});

void test('the chooser explains free entry and renders all-sector ordinary and elite controls', () => {
  const markup = html(view());
  for (const text of [
    'Enter Jacurutu Sietch',
    'Meridian',
    'before the storm',
    'does not use shipment or movement',
    'sector 2',
    'sector 3',
    'Available: 2 ordinary · 1 Fedaykin',
    'Select all forces',
    'Clear selection',
    'Move 5 forces inside',
    'Leave forces outside',
  ])
    assert.ok(markup.includes(text), text);
  assert.equal((markup.match(/type="number"/g) ?? []).length, 4);
  assert.equal((markup.match(/max="1"/g) ?? []).length, 3);
});

void test('busy and autopilot views disable every action while mismatched controls render nothing', () => {
  const busy = html(view(), true);
  assert.equal(
    (busy.match(/<button[^>]*disabled=""/g) ?? []).length,
    4,
  );
  const autopilot = view();
  autopilot.players[0].autopilot = 'Hard';
  assert.equal(
    (html(autopilot).match(/<button[^>]*disabled=""/g) ?? []).length,
    4,
  );

  const wrongEvent = view();
  wrongEvent.discoveryEntry!.event = 'entry-round:1';
  assert.equal(html(wrongEvent), '');
  const wrongOwner = view();
  wrongOwner.discoveryEntry!.owner = 'a';
  assert.equal(html(wrongOwner), '');
  const noOffer = view();
  noOffer.discoveryEntry = null;
  assert.equal(html(noOffer), '');
});
