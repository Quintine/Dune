import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaladanReinforcement } from '../components/caladan-reinforcement';
import {
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type GameView,
} from '../game/engine';
import {
  caladanReinforcementActions,
  caladanReinforcementCanAct,
  caladanReinforcementChoice,
} from '../game/caladan-reinforcement-options';

/** Projected choices isolate client policy; actual battle/force custody belongs
 * to the engine and production recovery suites. */
function fixture(): GameView {
  const g = createGame(
    'CALADANCONTROLS',
    newPlayer('a', 'Atreides', 'atreides'),
    true,
    [],
  );
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    active: 'e',
    order: ['a', 'e'],
    storm: 18,
  });
  g.players[0].forces = { 'hagga_basin:12': 2 };
  const view = viewGame(g, 'a');
  view.decision = {
    kind: 'caladanReinforcement',
    player: 'a',
    event: 'battle-1',
  };
  view.caladanReinforcement = {
    event: 'battle-1',
    player: 'a',
    territory: 'hagga_basin',
    amount: 1,
    blocked: null,
    destinations: [
      {
        id: 'hagga_basin:13',
        name: 'Hagga Basin · sector 13',
        sector: 13,
        blocked: null,
      },
      {
        id: 'hagga_basin:12',
        name: 'Hagga Basin · sector 12',
        sector: 12,
        blocked: null,
      },
      {
        id: 'hagga_basin:10',
        name: 'Hagga Basin · sector 10',
        sector: 10,
        blocked: 'Storm entry awaits a ruling.',
      },
    ],
  };
  return view;
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(
    createElement(CaladanReinforcement, { game, busy, act() {} }),
  );
}

void test('Caladan controls offer one fixed force and preserve the current event without mutating the projected battle', () => {
  const view = fixture();
  const before = structuredClone(view);
  assert.deepEqual(caladanReinforcementChoice(view, 'hagga_basin:12'), {
    blocked: null,
    action: {
      type: 'decision',
      event: 'battle-1',
      destination: 'hagga_basin:12',
      amount: 1,
    },
  });
  const html = markup(view);
  assert.match(html, /aria-label="Caladan reinforcement"/);
  assert.match(html, /Add one reserve force/);
  assert.match(html, /Leave in reserves/);
  assert.doesNotMatch(html, /type="number"|type="range"/);
  assert.deepEqual(view, before);
});

void test('stale or blocked destinations cannot place a force while a current blocked offer remains declinable', () => {
  const view = fixture();
  assert.equal(
    caladanReinforcementChoice(view, 'foreign-destination').action,
    null,
  );
  assert.match(
    caladanReinforcementChoice(view, 'hagga_basin:10').blocked!,
    /Storm entry/,
  );
  view.caladanReinforcement!.destinations[1].blocked =
    'No surviving force remains.';
  assert.equal(caladanReinforcementChoice(view, 'hagga_basin:12').action, null);
  view.caladanReinforcement!.blocked =
    'The current destination needs a ruling.';
  assert.deepEqual(caladanReinforcementActions(view), [
    { type: 'decision', event: 'battle-1', decline: true },
  ]);
  const html = markup(view);
  assert.match(html, /The current destination needs a ruling/);
  assert.match(
    html,
    /<button[^>]* disabled=""[^>]*>Add one reserve force<\/button>/,
  );
  assert.match(
    html,
    /<button(?![^>]* disabled="")[^>]*>Leave in reserves<\/button>/,
  );
  view.caladanReinforcement!.blocked = null;
  view.caladanReinforcement!.destinations = [];
  assert.equal(caladanReinforcementActions(view)[0].decline, true);
  assert.match(markup(view), /No legal reinforcement destination/);
});

void test('reinforcement policy uses only own occupied sectors for every profile and falls back to a legal Homeworld destination', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = fixture();
    view.players[0].bot = profile;
    for (const key of ['hand', 'spice', 'traitors', 'forces'])
      Object.defineProperty(view.players[1], key, {
        get() {
          throw new Error(`Read opponent ${key}`);
        },
      });
    const offer = structuredClone(view.caladanReinforcement);
    assert.deepEqual(caladanReinforcementActions(view), [
      {
        type: 'decision',
        event: 'battle-1',
        destination: 'hagga_basin:12',
        amount: 1,
      },
    ]);
    assert.deepEqual(view.caladanReinforcement, offer);
    view.caladanReinforcement!.destinations[1].blocked = 'Entry unavailable.';
    assert.equal(
      caladanReinforcementActions(view)[0].destination,
      'hagga_basin:13',
    );
    view.caladanReinforcement!.territory = 'homeworld:emperor';
    view.caladanReinforcement!.destinations = [
      { id: 'homeworld:emperor', name: 'Kaitain', blocked: null },
    ];
    assert.equal(
      caladanReinforcementActions(view)[0].destination,
      'homeworld:emperor',
    );
  }
});

void test('owner and battle-event fences plus interruption gates prevent stale actions and hide observer controls', () => {
  const view = fixture();
  assert.equal(caladanReinforcementCanAct(view), true);
  for (const patch of [
    { me: 'e' },
    { status: 'finished' },
    { decision: null },
    {
      decision: {
        kind: 'caladanReinforcement',
        player: 'e',
        event: 'battle-1',
      },
    },
    {
      decision: {
        kind: 'caladanReinforcement',
        player: 'a',
        event: 'old-battle',
      },
    },
    { decision: { kind: 'battleCards', player: 'a' } },
    { response: { kind: 'capture', owner: 'e', passed: [] } },
    { truthtrance: { stage: 'answer' } },
    { phaseOpening: { kind: 'ix' } },
    { automaticContinuationPending: true },
  ]) {
    const blocked = { ...view, ...patch } as GameView;
    assert.equal(caladanReinforcementCanAct(blocked), false);
    assert.deepEqual(caladanReinforcementActions(blocked), []);
    assert.equal(
      caladanReinforcementChoice(blocked, 'hagga_basin:12').action,
      null,
    );
  }
  assert.equal(markup({ ...view, me: 'e' }), '');
  assert.equal(markup({ ...view, caladanReinforcement: null }), '');
  assert.equal(markup({ ...view, decision: null }), '');
  const html = markup(view, true);
  assert.equal((html.match(/<button[^>]* disabled=""/g) ?? []).length, 2);
  assert.match(html, /<select[^>]*disabled/);
});
