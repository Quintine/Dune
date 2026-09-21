import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame } from '../game/engine';
import { nexusOfferGame } from './fixture-nexus-offer';

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
const { DrawPiles } = await import('../components/draw-piles');
const { GameTable } = await import('../components/game-table');
aliases.deregister();

void test('live table connects named draw counts without an action while controls are busy', () => {
  const g = nexusOfferGame();
  const before = JSON.stringify(g);
  const html = renderToStaticMarkup(createElement(GameTable, {
    game: viewGame(g, 'e'), busy: true, send: async () => { assert.fail('Read-only counts must not act.'); }, onExit() {},
  }));
  assert.match(html, /aria-label="Draw piles"/);
  assert.match(html, /Treachery draw pile<\/dt><dd><strong>29<\/strong> cards/);
  assert.match(html, /Spice draw pile<\/dt><dd><strong>19<\/strong> cards/);
  assert.match(html, /href="\/rules\?topic=draw-piles#draw-piles"/);
  assert.equal(JSON.stringify(g), before);
});

void test('empty and single-card piles stay explicit; an uninitialized lobby has no invented counts', () => {
  assert.equal(renderToStaticMarkup(createElement(DrawPiles, { piles: null })), '');
  const html = renderToStaticMarkup(createElement(DrawPiles, { piles: { treachery: 0, spice: 1 } }));
  assert.match(html, /<strong>0<\/strong> cards/);
  assert.match(html, /<strong>1<\/strong> card<\/dd>/);
  assert.match(html, /empty pile may be replenished/);
  assert.doesNotMatch(html, /button|No cards left|out of cards/);
});
