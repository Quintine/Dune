import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GrummanCollection } from '../components/grumman-collection';
import { MoritaniEntry } from '../components/moritani-terror';
import { TerrorBoardMarkers } from '../components/terror-board-markers';
import {
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type GameView,
} from '../game/engine';
import {
  grummanCollectionActions,
  grummanCollectionCanAct,
  grummanCollectionChoice,
} from '../game/grumman-collection-options';

/** Private projected choices isolate client behavior. Engine and recovery suites
 * cover actual collection entry, token custody and paid receipts. */
function fixture(): GameView {
  const g = createGame(
    'GRUMMANCONTROLS',
    newPlayer('m', 'Moritani', 'moritani'),
  );
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  Object.assign(g, {
    status: 'playing',
    phase: 7,
    active: 'a',
    order: ['m', 'a'],
    storm: 18,
  });
  const view = viewGame(g, 'm');
  view.decision = {
    kind: 'grummanCollection',
    player: 'm',
    event: 'collection-1',
  };
  view.grummanCollection = {
    event: 'collection-1',
    player: 'm',
    blocked: null,
    removeBlocked: 'Removing a token awaits a custody ruling.',
    tokens: [
      { id: 'terror-1', kind: 'robbery' },
      { id: 'terror-2', kind: 'sabotage' },
    ],
    destinations: [
      { id: 'arrakeen', name: 'Arrakeen' },
      { id: 'carthag', name: 'Carthag' },
    ],
  };
  return view;
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(
    createElement(GrummanCollection, { game, busy, act() {} }),
  );
}
function entryMarkup(game: GameView, busy = false) {
  return renderToStaticMarkup(
    createElement(MoritaniEntry, { game, busy, act() {} }),
  );
}

void test('public map markers group hidden Terror stacks without reading token faces', () => {
  const tokens = [
    { status: 'placed', location: 'arrakeen' },
    { status: 'placed', location: 'arrakeen' },
    { status: 'placed', location: 'carthag' },
    { status: 'available', location: null },
    { status: 'removed', location: null },
  ];
  for (const token of tokens)
    Object.defineProperty(token, 'kind', {
      get() {
        throw new Error('Map read a hidden Terror face');
      },
    });
  const html = renderToStaticMarkup(
    createElement('svg', null, createElement(TerrorBoardMarkers, { tokens })),
  );
  assert.equal(
    (html.match(/aria-label="2 hidden Terror tokens in Arrakeen"/g) ?? [])
      .length,
    1,
  );
  assert.equal(
    (html.match(/aria-label="1 hidden Terror token in Carthag"/g) ?? []).length,
    1,
  );
  assert.equal((html.match(/<g /g) ?? []).length, 2);
  assert.match(html, />T2<\/text>/);
  assert.match(html, />T<\/text>/);
  assert.doesNotMatch(html, /available|removed/);
});

void test('Grumman controls require an explicit available-token addition before the four-spice reward', () => {
  const view = fixture();
  const before = structuredClone(view);
  assert.deepEqual(grummanCollectionChoice(view, 'terror-2', 'carthag'), {
    blocked: null,
    action: {
      type: 'decision',
      event: 'collection-1',
      mode: 'add',
      token: 'terror-2',
      territory: 'carthag',
    },
  });
  const html = markup(view);
  assert.match(html, /Your Terror token/);
  assert.match(html, /Robbery/);
  assert.match(html, /Sabotage/);
  assert.match(html, /only after the addition resolves/);
  assert.match(html, /Add token and collect 4 spice/);
  assert.match(
    html,
    /Removal unavailable: Removing a token awaits a custody ruling/,
  );
  assert.doesNotMatch(html, /<button[^>]*>Remove/);
  assert.deepEqual(view, before);
});

void test('stale tokens or destinations cannot add; blocked or exhausted collection can still be declined', () => {
  const view = fixture();
  assert.equal(
    grummanCollectionChoice(view, 'used-token', 'arrakeen').action,
    null,
  );
  assert.equal(
    grummanCollectionChoice(view, 'terror-1', 'polar_sink').action,
    null,
  );
  for (const patch of [
    { blocked: 'Grumman is now low.' },
    { tokens: [] },
    { destinations: [] },
  ]) {
    const blocked = {
      ...view,
      grummanCollection: { ...view.grummanCollection!, ...patch },
    };
    assert.deepEqual(grummanCollectionActions(blocked), [
      { type: 'decision', event: 'collection-1', decline: true },
    ]);
    const html = markup(blocked);
    assert.match(
      html,
      /<button[^>]* disabled=""[^>]*>Add token and collect 4 spice<\/button>/,
    );
    assert.match(
      html,
      /<button(?![^>]* disabled="")[^>]*>Pass Grumman collection<\/button>/,
    );
  }
});

void test('Grumman policy follows only the current private offer across profiles and never reads another player', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = fixture();
    view.players[0].bot = profile;
    Object.defineProperty(view, 'players', {
      get() {
        throw new Error('Policy read player data');
      },
    });
    assert.deepEqual(grummanCollectionActions(view), [
      {
        type: 'decision',
        event: 'collection-1',
        mode: 'add',
        token: 'terror-1',
        territory: 'arrakeen',
      },
    ]);
  }
});

void test('collection ownership, event and interruption fences prevent stale or observer controls', () => {
  const view = fixture();
  assert.equal(grummanCollectionCanAct(view), true);
  for (const patch of [
    { me: 'a' },
    { status: 'finished' },
    { decision: null },
    {
      decision: {
        kind: 'grummanCollection',
        player: 'a',
        event: 'collection-1',
      },
    },
    {
      decision: { kind: 'grummanCollection', player: 'm', event: 'old-event' },
    },
    { decision: { kind: 'moritaniPlacement', player: 'm' } },
    { response: { kind: 'capture', owner: 'a', passed: [] } },
    { truthtrance: { stage: 'answer' } },
    { phaseOpening: { kind: 'ix' } },
    { automaticContinuationPending: true },
  ]) {
    const blocked = { ...view, ...patch } as GameView;
    assert.equal(grummanCollectionCanAct(blocked), false);
    assert.deepEqual(grummanCollectionActions(blocked), []);
    assert.equal(
      grummanCollectionChoice(blocked, 'terror-1', 'arrakeen').action,
      null,
    );
  }
  assert.equal(markup({ ...view, me: 'a' }), '');
  assert.equal(markup({ ...view, grummanCollection: null }), '');
  assert.equal(
    (markup(view, true).match(/<button[^>]* disabled=""/g) ?? []).length,
    2,
  );
});

void test('stacked entry requires a private token selection before reaction and never consults a selected kind or outsider candidates', () => {
  const view = fixture();
  view.decision = {
    kind: 'moritaniTerror',
    player: 'm',
    entrant: 'a',
    territory: 'arrakeen',
  };
  view.terrorEntry = {
    entrant: 'a',
    territory: 'arrakeen',
    sector: 10,
    cause: 'shipment',
    stage: 'select',
    candidates: [
      {
        token: 'terror-1',
        kind: 'robbery',
        canReveal: true,
        canOfferAlliance: true,
        revealBlocked: undefined,
      },
      {
        token: 'terror-2',
        kind: 'atomics',
        canReveal: false,
        canOfferAlliance: false,
        revealBlocked: 'Atomics awaits implementation.',
      },
    ],
  };
  Object.defineProperty(view.terrorEntry, 'kind', {
    get() {
      throw new Error('Selected kind is unavailable');
    },
  });
  const html = entryMarkup(view);
  assert.match(html, /Select Robbery/);
  assert.match(html, /Select Atomics/);
  assert.match(html, /Selecting a token keeps its face private/);
  assert.match(html, /Atomics awaits implementation/);
  assert.match(html, /Leave all tokens hidden/);
  assert.doesNotMatch(html, /Reveal Robbery|Take half their spice/);
  for (const patch of [
    {},
    { automaticContinuationPending: true },
    { phaseOpening: { kind: 'ix' } },
    { response: { kind: 'capture' } },
  ]) {
    const blocked = { ...view, ...patch } as GameView;
    assert.equal(
      (
        entryMarkup(blocked, !Object.keys(patch).length).match(
          /<button[^>]* disabled=""/g,
        ) ?? []
      ).length,
      3,
    );
  }
  const outsider = {
    ...view,
    me: 'a',
    decision: { kind: 'moritaniTerror', player: 'a' },
  } as GameView;
  Object.defineProperty(outsider.terrorEntry!, 'candidates', {
    get() {
      throw new Error('Read hidden candidates');
    },
  });
  assert.equal(entryMarkup(outsider), '');
  assert.equal(
    entryMarkup({
      ...outsider,
      decision: {
        kind: 'moritaniTerror',
        player: 'm',
        entrant: 'a',
        territory: 'arrakeen',
      },
    }),
    '',
  );
});
