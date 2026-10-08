import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type GameView } from '../game/engine';
import { NexusEcazDuke } from '../components/nexus-ecaz-duke';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';
import { consumeDuke } from '../game/duke-vidal';
import { nexusEcazDukePosition } from './fixture-nexus-ecaz-duke';

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


void test('private projection and physical card limit the offer without probing a rival hand', () => {
  const game = projected();
  Object.defineProperty(game.players[1], 'hand', {
    get() { throw new Error('Rival private cards must remain unread'); },
  });
  const html = markup(game);
  assert.match(html, /<button\b/);
  assert.doesNotMatch(html, /disabled=""/);
  assert.match(markup(game, true), /<button\b[^>]*disabled=""/);

  const rival = projected({ me: 'moritani', nexusCards: { card: null }, nexusEcazDuke: null });
  assert.equal(markup(rival), '');
  assert.equal(nexusEcazDukeAction(rival), null);
  assert.equal(markup(projected({ nexusCards: { card: null } })), '');
  assert.equal(markup(projected({ nexusEcazDuke: null })), '');
});

void test('actual Tanked Duke gives the native owner an enabled event-bound control, never a rival offer', () => {
  for (const advanced of [false, true]) {
    const { game } = nexusEcazDukePosition(advanced);
    // Explicit conserved Tanks position, not fabricated Nexus custody or a public offer.
    game.dukeVidal = consumeDuke(game.dukeVidal!);
    game.dukeVidal.leader.dead = true;
    game.dukeVidal.leader.deaths = 2;
    game.dukeVidal.leader.usedAt = 'carthag';
    const owner = viewGame(game, 'p');
    assert.match(markup(owner), /<button\b/);
    assert.doesNotMatch(markup(owner), /disabled=""/);
    assert.match(markup(owner, true), /<button\b[^>]*disabled=""/);
    for (const seat of ['q', 'r']) {
      const rival = viewGame(game, seat);
      assert.equal(rival.nexusEcazDuke, null);
      assert.equal(nexusEcazDukeAction(rival), null);
      assert.equal(markup(rival), '');
    }
  }
});

void test('blocked offer remains explanatory but no interrupt, alliance, or started battle can spend it', () => {
  const blocked = projected({ nexusEcazDuke: {
    event, blocked: 'Duke Vidal is captured and cannot be taken.', dukeController: 'moritani',
  } });
  assert.equal(nexusEcazDukeAction(blocked), null);
  assert.match(markup(blocked), /<button\b[^>]*disabled=""/);

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
    assert.match(markup(view), /<button\b[^>]*disabled=""|^$/);
  }
});
