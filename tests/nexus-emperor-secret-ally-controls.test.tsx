import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NexusEmperorSecretAlly } from '../components/nexus-emperor-secret-ally';
import type { GameView } from '../game/engine';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
  },
});

function view(overrides: Record<string, unknown> = {}) {
  return {
    me: 'a',
    players: [
      { id: 'a', name: 'House A', faction: 'atreides', ally: null },
      { id: 'b', name: 'House B', faction: 'harkonnen', ally: null },
    ],
    status: 'playing',
    phase: 4,
    response: null,
    truthtrance: null,
    phaseOpening: null,
    automaticContinuationPending: false,
    nexusCards: { card: 'emperor', waiting: [] },
    nexusTraitors: { pending: null },
    nexusEmperorSecretAlly: {
      event: 'emperor-1',
      revival: { blocked: null, eliteOptions: [0, 1] },
      purchase: null,
    },
    ...overrides,
  } as unknown as GameView;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(NexusEmperorSecretAlly, { game, act() {}, busy }));
}

void test('eligible private Emperor card shows revival explanation and legal elite selector', () => {
  const html = markup(view());
  assert.match(html, /revive 3 additional forces for free/);
  assert.match(html, /Elite forces to revive/);
  assert.match(html, /value="0"/);
  assert.match(html, /value="1"/);
  assert.match(html, /Revive 3 additional forces/);
});

void test('stale, nonowner, blocked and busy states stay guarded', () => {
  assert.equal(markup(view({ phase: 5 })), '');
  assert.equal(markup(view({ me: 'b', nexusEmperorSecretAlly: null })), '');
  assert.equal(markup(view({ nexusCards: { card: 'emperor', waiting: ['b'] } })), '');
  const blocked = markup(view({ nexusEmperorSecretAlly: {
    event: 'emperor-1', revival: { blocked: 'Elite revival is unavailable.', eliteOptions: [] }, purchase: null,
  } }));
  assert.match(blocked, /Elite revival is unavailable/);
  assert.match(blocked, /disabled=""/);
  assert.match(markup(view({ nexusEmperorSecretAlly: {
    event: 'emperor-1', revival: { blocked: null, eliteOptions: [1] }, purchase: null,
  } }), true), /disabled=""/);
});

aliases.deregister();
