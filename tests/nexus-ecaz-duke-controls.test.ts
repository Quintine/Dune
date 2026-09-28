import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameView } from '../game/engine';
import { botActions } from '../game/bots';
import { NexusEcazDuke } from '../components/nexus-ecaz-duke';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';

const event = '["nexusEcazDuke",2,6,"ecaz","moritani",0]';

function projected(overrides: Record<string, unknown> = {}): GameView {
  return {
    status: 'playing', phase: 6, turn: 2, me: 'ecaz', active: 'moritani',
    advanced: false, battle: null, phaseOpening: null, response: null, decision: null,
    truthtrance: null, automaticContinuationPending: false,
    players: [
      { id: 'ecaz', name: 'House Ecaz', faction: 'ecaz', ally: null, bot: 'Easy' },
      { id: 'moritani', name: 'House Moritani', faction: 'moritani', ally: null },
    ],
    dukeVidal: { controller: 'moritani' },
    nexusCards: { card: 'ecaz', waiting: [] },
    nexusEcazInquiry: { offer: null, history: [] },
    nexusEcazDuke: { event, blocked: null, dukeController: 'moritani' },
    ...overrides,
  } as unknown as GameView;
}

function markup(view: GameView, busy = false) {
  return renderToStaticMarkup(createElement(NexusEcazDuke, { game: view, busy, act() {} }));
}

void test('Ecaz chooses the private, event-bound custody action before the ordinary battle decision in Basic and Advanced play', () => {
  for (const advanced of [false, true]) {
    for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const game = projected({ advanced });
      game.players[0].bot = profile;
      const action = { type: 'nexusEcazDuke', event };
      assert.deepEqual(nexusEcazDukeAction(game), action);
      assert.deepEqual(botActions(game)[0], action);
    }
  }
});

void test('private projection and physical card limit the offer without probing a rival hand', () => {
  const game = projected();
  Object.defineProperty(game.players[1], 'hand', {
    get() { throw new Error('Rival private cards must remain unread'); },
  });
  const html = markup(game);
  assert.match(html, /Current public controller: House Moritani/);
  assert.match(html, /living, uncaptured, non-Ghola Duke/);
  assert.match(html, /physical Ecaz Nexus card/);
  assert.match(html, /temporary control expires at turn end/);
  assert.match(html, /using him in battle consumes the shared Duke/);
  assert.match(html, /printed Tanks revival, capture, and Ghola effects are not supported/);
  assert.match(html, />Discard Ecaz Nexus · take Duke this turn/);
  assert.doesNotMatch(html, /disabled=""/);
  assert.match(markup(game, true), /disabled=""[^>]*>Discard Ecaz Nexus/);

  const rival = projected({ me: 'moritani', nexusCards: { card: null }, nexusEcazDuke: null });
  assert.equal(markup(rival), '');
  assert.equal(nexusEcazDukeAction(rival), null);
  assert.equal(markup(projected({ nexusCards: { card: null } })), '');
  assert.equal(markup(projected({ nexusEcazDuke: null })), '');
});

void test('blocked offer remains explanatory but no interrupt, alliance, or started battle can spend it', () => {
  const blocked = projected({ nexusEcazDuke: {
    event, blocked: 'Duke Vidal is captured and cannot be taken.', dukeController: 'moritani',
  } });
  assert.equal(nexusEcazDukeAction(blocked), null);
  assert.match(markup(blocked), /Duke Vidal is captured and cannot be taken/);
  assert.match(markup(blocked), /disabled=""[^>]*>Discard Ecaz Nexus/);

  for (const changes of [
    { status: 'finished' }, { phase: 5 }, { phaseOpening: { passed: [] } },
    { battle: { event: 'battle-already-chosen' } },
    { automaticContinuationPending: true }, { truthtrance: { player: 'ecaz' } },
    { response: { kind: 'karama' } }, { decision: { kind: 'battle' } },
    { nexusCards: { card: 'ecaz', waiting: ['moritani'] } },
    { nexusCards: { card: null, waiting: [] } },
    { roomControl: { paused: true } },
    { players: [
      { id: 'ecaz', faction: 'ecaz', ally: 'moritani' },
      { id: 'moritani', faction: 'moritani', ally: 'ecaz' },
    ] },
  ]) {
    const view = projected(changes);
    assert.equal(nexusEcazDukeAction(view), null);
    assert.match(markup(view), /disabled=""[^>]*>Discard Ecaz Nexus|^$/);
  }
});
