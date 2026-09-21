import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, joinGame, newPlayer, viewGame } from '../game/engine';
import { baseDeck } from '../game/cards';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m => [m[1], m[1]]));
    return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
  },
});
const { HandBrowser } = await import('../components/hand-browser');
const { GameTable } = await import('../components/game-table');
aliases.deregister();

void test('live hand browsing receives only the current seat cards and preserves named inspectors while busy', () => {
  const g = createGame('HANDBROWSE', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  // Projection/render fixture only; starting-game rules are tested separately.
  const cards = baseDeck();
  g.players[0].hand = cards.filter(c => c.name === 'Shield');
  g.players[1].hand = cards.filter(c => c.name === 'Lasgun');
  g.deck = cards.filter(c => !g.players.some(p => p.hand.some(h => h.id === c.id)));
  const before = JSON.stringify(g);
  for (const id of ['a', 'h']) {
    const html = renderToStaticMarkup(createElement(GameTable, {
      game: viewGame(g, id), busy: true, send: async () => { assert.fail('Browsing must not submit a game action.'); }, onExit() {},
    }));
    assert.match(html, /<search aria-label="Browse your private hand">/);
    assert.match(html, /Search your hand/);
    assert.match(html, /Your hand cards/);
    assert.match(html, /tabindex="0"/);
    assert.match(html, id === 'a' ? /Inspect card: Shield/ : /Inspect card: Lasgun/);
    assert.doesNotMatch(html, id === 'a' ? /Inspect card: Lasgun/ : /Inspect card: Shield/);
  }
  assert.equal(JSON.stringify(g), before);
});

void test('empty hand keeps its setup explanation and does not offer useless search controls', () => {
  const html = renderToStaticMarkup(
    <HandBrowser cards={[]} empty={<p>Starting cards remain undealt.</p>}>
      {() => { assert.fail('No card should render.'); }}
    </HandBrowser>,
  );
  assert.match(html, /Starting cards remain undealt/);
  assert.doesNotMatch(html, /<search|No cards match|Show all cards/);
});
