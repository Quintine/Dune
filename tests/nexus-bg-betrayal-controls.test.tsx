import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { nexusBgBetrayalFixture } from './fixture-nexus-bg-betrayal';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => [match[1], match[1]]));
    return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
  },
});
// Install Next and CSS-module shims before loading the UI components.
const { NexusCards } = await import('../components/nexus-cards');
const { GameTable } = await import('../components/game-table');

function markup(view: GameView, busy = false) {
  return renderToStaticMarkup(createElement(NexusCards, { game: view, act() {}, busy }));
}
function table(view: GameView) {
  return renderToStaticMarkup(createElement(GameTable, {
    game: view, send: async () => {}, onExit() {}, busy: false,
  }));
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

void test('a private Traitor return suspends Voice pass and Karama controls until completion', () => {
  let g = applyAction(nexusBgBetrayalFixture('r', false, 'harkonnen'),
    'p', { type: 'voice', kind: 'poison', must: false });
  const karamaIndex = g.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karamaIndex >= 0);
  const karama = g.deck.splice(karamaIndex, 1)[0];
  g.players.find(player => player.id === 'r')!.hand.push(karama);
  assert.match(table(viewGame(g, 'r')), /Allow this power/);
  assert.match(table(viewGame(g, 'r')), /Cancel with Karama/);
  const offer = viewGame(g, 'q').nexusTraitors!.offer!;
  g = applyAction(g, 'q', { type: 'nexusTraitorDraw', event: offer.event, mode: offer.mode });
  assert.throws(() => applyAction(g, 'r', { type: 'passResponse' }));
  assert.doesNotMatch(table(viewGame(g, 'r')), /Allow this power/);
  assert.doesNotMatch(table(viewGame(g, 'r')), /Cancel with Karama/);
  assert.match(table(viewGame(g, 'r')), /disabled=""[^>]*>Cancel this power<\/button>/);
  const pending = viewGame(g, 'q').nexusTraitors!.pending!;
  g = applyAction(g, 'q', {
    type: 'nexusTraitorReturn', event: pending.event,
    cards: pending.choices.filter(card => card.drawn).map(card => card.id),
  });
  assert.match(table(viewGame(g, 'r')), /Allow this power/);
  assert.match(table(viewGame(g, 'r')), /Cancel with Karama/);
});

aliases.deregister();
