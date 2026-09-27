import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { nexusBgBetrayalFixture } from './fixture-nexus-bg-betrayal';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
  },
});
// NexusCards imports next/image; the test-only alias must exist before module loading.
const { NexusCards } = await import('../components/nexus-cards');

function markup(view: GameView, busy = false) {
  return renderToStaticMarkup(createElement(NexusCards, { game: view, act() {}, busy }));
}

void test('private BG holder alone sees an enabled Voice prevention control', () => {
  const initial = nexusBgBetrayalFixture();
  const g = applyAction(initial, 'p', { type: 'voice', kind: 'poison', must: false });
  const holder = markup(viewGame(g, 'r'));
  assert.match(holder, /Bene Gesserit Betrayal · Voice/);
  assert.match(holder, /Prevent Voice with Betrayal/);
  assert.doesNotMatch(markup(viewGame(g, 'p')), /Prevent Voice with Betrayal/);
  assert.doesNotMatch(markup(viewGame(g, 'q')), /Prevent Voice with Betrayal/);
  assert.match(markup(viewGame(g, 'r'), true), /disabled=""[^>]*>Prevent Voice with Betrayal/);
});

aliases.deregister();
