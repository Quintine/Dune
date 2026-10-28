import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameView } from '../game/engine';
import { NoFieldBoardMarkers } from '../components/richese-no-field';
import { planetologistNoFieldMarker } from '../components/planetologist-movement-action';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image'
      : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));
    return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
  },
});
const { HomeworldTable } = await import('../components/homeworld-table');
aliases.deregister();

function view(location: { homeworld: string } | { territory: string; sector: number }): GameView {
  const publicMarker = { controller: 'r', location, effectiveForces: 1 as const };
  const privateMarker = { tokenId: 'private-token', controller: 'r', location };
  return {
    me: 'r',
    players: [
      { id: 'r', name: 'Richese player', faction: 'richese', noField: { deployed: publicMarker, lastUsed: null } },
      { id: 'e', name: 'Emperor player', faction: 'emperor' },
    ],
    richeseNoField: {
      owner: 'r', event: 'marker-event',
      public: { deployed: publicMarker, lastUsed: null },
      private: { deployed: privateMarker, lastShipped: 'private-token',
        tokens: [{ id: 'private-token', value: 5 }, { id: 'other', value: 3 }, { id: 'zero', value: 0 }] },
    },
    homeworlds: { worlds: [{ id: 'homeworld:emperor', card: 'kaitain', native: 'e',
      side: 'high', population: 6, forces: { e: { normal: 6, elite: 0 } } }] },
  } as unknown as GameView;
}

void test('a Homeworld marker appears separately from physical forces without its hidden value', () => {
  const game = view({ homeworld: 'homeworld:emperor' });
  const html = renderToStaticMarkup(createElement(HomeworldTable, { game }));
  assert.match(html, /Richese player: concealed No-Field/);
  assert.match(html, /counts as one force/);
  assert.match(html, /Native reserves: 6 normal/);
  assert.doesNotMatch(html, /private-token|No-Field 5/);
  assert.equal(renderToStaticMarkup(createElement(NoFieldBoardMarkers, { players: game.players })), '');
  assert.equal(planetologistNoFieldMarker(game), null);
});

void test('an Arrakis marker stays on the board and does not appear at a Homeworld', () => {
  const game = view({ territory: 'arrakeen', sector: 10 });
  const board = renderToStaticMarkup(createElement('svg', null,
    createElement(NoFieldBoardMarkers, { players: game.players })));
  assert.match(board, /concealed No-Field in Arrakeen, sector 10/);
  const world = renderToStaticMarkup(createElement(HomeworldTable, { game }));
  assert.doesNotMatch(world, /concealed No-Field/);
});
