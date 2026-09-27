import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type GameView } from '../game/engine';
import { nexusSardaukarFixture } from './fixture-nexus-sardaukar';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
  },
});
// NexusCards imports next/image; register the test-only Vinext alias before loading it.
const { NexusCards } = await import('../components/nexus-cards');

function markup(view: GameView, busy = false) {
  return renderToStaticMarkup(createElement(NexusCards, { game: view, act() {}, busy }));
}

void test('only the private Emperor Betrayal holder can see its active battle control', () => {
  const g = nexusSardaukarFixture({ starred: 2, normal: 3, emperorCardHolder: 'r' });
  const holder = markup(viewGame(g, 'r'));
  assert.match(holder, /Emperor Betrayal · Sardaukar/);
  assert.match(holder, /Suppress Sardaukar with Betrayal/);
  assert.doesNotMatch(markup(viewGame(g, 'p')), /Suppress Sardaukar with Betrayal/);
  assert.doesNotMatch(markup(viewGame(g, 'q')), /Suppress Sardaukar with Betrayal/);
  assert.match(markup(viewGame(g, 'r'), true), /disabled=""[^>]*>Suppress Sardaukar with Betrayal/);
});

aliases.deregister();
