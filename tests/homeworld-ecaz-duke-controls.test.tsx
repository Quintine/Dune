import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeworldEcazDuke } from '../components/homeworld-ecaz-duke';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';

// Controlled owner projections isolate this hook-free UI. They do not claim
// native occupation, shared-Duke custody or grant eligibility; those belong to
// the separate helper/native source suite. No played Game state is installed.
function projected(advanced = true): GameView {
  const game = createGame('HOMEWORLDECAZDUKECONTROLS', newPlayer('a', 'Atreides', 'atreides'), advanced, ['ecaz']);
  joinGame(game, newPlayer('e', 'Ecaz', 'ecaz'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  const view = viewGame(game, 'a');
  view.homeworldEcazDuke = {
    event: 'controlled-occupation-duke-event', blocked: null, occupier: 'a',
    recipients: [{ id: 'a', name: 'Atreides' }, { id: 'g', name: 'Guild' }],
  };
  return view;
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(HomeworldEcazDuke, { game, busy, act() {} }));
}
function click(node: ReactNode, recipient: string): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{
      children?: ReactNode; onClick?: () => void; 'data-testid'?: string;
    }>(child)) continue;
    if (child.props['data-testid'] === `homeworld-ecaz-duke-${recipient}` && child.props.onClick) {
      child.props.onClick(); return true;
    }
    if (click(child.props.children, recipient)) return true;
  }
  return false;
}
function grant(game: GameView, recipient = 'a', busy = false): Action[] {
  const actions: Action[] = [];
  click(HomeworldEcazDuke({ game, busy, act(action) { actions.push(action); } }), recipient);
  return actions;
}

void test('the occupied Ecaz controls send one exact event-bound action for each projected recipient', () => {
  for (const advanced of [false, true]) {
    const game = projected(advanced), html = markup(game), event = game.homeworldEcazDuke!.event;
    assert.match(html, /aria-label="Occupied Ecaz Duke grant"/);
    assert.match(html, /Grant Duke Vidal to Atreides/); assert.match(html, /Grant Duke Vidal to Guild/);
    assert.doesNotMatch(html, /disabled=""/);
    assert.deepEqual(grant(game), [{ type: 'homeworldDuke', event, recipient: 'a' }]);
    assert.deepEqual(grant(game, 'g'), [{ type: 'homeworldDuke', event, recipient: 'g' }]);
    assert.deepEqual(grant(game, 'e'), [], 'The control never invents an unoffered recipient');
  }
});

void test('busy controls suppress their actual callback and retain readable provisional guidance', () => {
  const game = projected();
  assert.deepEqual(grant(game, 'a', true), []); assert.deepEqual(grant(game, 'g', true), []);
  const html = markup(game, true);
  assert.equal((html.match(/<button\b[^>]*\sdisabled=""/g) ?? []).length, 2);
  assert.match(html, /Provisional occupation benefit/); assert.match(html, /Only Ecaz may revive him/);
});

void test('authoritative unavailable reasons remain visible across renders and block every grant', () => {
  for (const reason of [
    'Finish the current response before granting Duke Vidal.',
    'Finish the current decision or phase opening first.',
    'The shared Duke is dead and must be revived by Ecaz.',
    'The shared Duke is captured or held as a foreign Ghola.',
  ]) {
    const game = projected(); game.homeworldEcazDuke!.blocked = reason;
    for (let render = 0; render < 3; render++) {
      const html = markup(game);
      assert.ok(html.includes(reason)); assert.match(html, /aria-describedby="homeworld-ecaz-duke-unavailable"/);
      assert.match(html, /Provisional occupation benefit/);
      assert.deepEqual(grant(game), []); assert.deepEqual(grant(game, 'g'), []);
    }
  }
});

void test('an unavailable event or empty recipient projection cannot manufacture a grant', () => {
  const missingEvent = projected(); missingEvent.homeworldEcazDuke!.event = null;
  assert.match(markup(missingEvent), /This Duke grant is not currently available/);
  assert.deepEqual(grant(missingEvent), []);
  const empty = projected(); empty.homeworldEcazDuke!.recipients = [];
  assert.match(markup(empty), /No eligible recipient is currently available/);
  assert.doesNotMatch(markup(empty), /<button\b/); assert.deepEqual(grant(empty), []);
});

void test('the grant panel is restricted to its owner-only occupier descriptor', () => {
  const absent = projected(); absent.homeworldEcazDuke = null;
  assert.equal(markup(absent), ''); assert.deepEqual(grant(absent), []);
  const other = projected(); other.me = 'g';
  assert.equal(markup(other), ''); assert.deepEqual(grant(other), []);
  const noOccupier = projected(); noOccupier.homeworldEcazDuke!.occupier = null;
  assert.equal(markup(noOccupier), ''); assert.deepEqual(grant(noOccupier), []);
});

void test('persistent grant guidance describes the one-battle shared Duke without inventing a new numeric allowance', () => {
  const game = projected();
  for (let render = 0; render < 3; render++) {
    const html = markup(game);
    assert.match(html, /Provisional occupation benefit/);
    assert.match(html, /grant the living shared Duke Vidal to yourself or your reciprocal ally/);
    assert.match(html, /may use him in one battle, following the Duke’s ordinary lifecycle/);
    assert.match(html, /Only Ecaz may revive him/);
    assert.doesNotMatch(html, /once per (?:turn|phase|game)|\d spice|Confirm|Acknowledge/);
  }
});

void test('recipient labels and eligibility come entirely from the projected grant', () => {
  const game = projected();
  Object.defineProperty(game, 'players', { get() { throw Error('The grant control read hidden player state'); } });
  assert.match(markup(game), /Grant Duke Vidal to Guild/);
  assert.deepEqual(grant(game, 'g'), [{
    type: 'homeworldDuke', event: 'controlled-occupation-duke-event', recipient: 'g',
  }]);
});
