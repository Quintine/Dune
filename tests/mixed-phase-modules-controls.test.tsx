import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { createMixedPhaseModulesFixture } from './fixture-mixed-phase-modules';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));
    return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
  },
});
const { GameTable } = await import('../components/game-table');
aliases.deregister();
const render = (game: Game, actor = game.host) => renderToStaticMarkup(createElement(GameTable, {
  game: viewGame(game, actor), busy: false, send: async () => {}, onExit() {},
}));

// These are stateful React SSR renders and real public actions. They make no
// browser/DOM click claim; authoritative Start is exercised through applyAction.
void test('Basic paired E3 lobby exposes selected Tech and a usable original Begin game path', () => {
  const f = createMixedPhaseModulesFixture({ factions: ['ecaz', 'moritani', 'guild'], expansions: ['ecaz'], tech: true });
  const html = render(f.lobby);
  assert.match(html, /Tech tokens · optional, 3\+ players/); assert.match(html, /Begin game/);
  assert.match(html, /Stronghold Cards · Advanced rules required/);
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, false);
  assert.ok(f.actions.some(step => step.action.type === 'techTokens' && step.action.enabled === true));
  assert.ok(f.actions.some(step => step.action.type === 'start' && step.action.advancedPreview === undefined));
  assert.match(render(f.game), /Heighliners|Axlotl Tanks|Spice Production/);
});

void test('Advanced mixed selected decks retain public module controls, preview Start and the live Stronghold inspector', () => {
  const f = createMixedPhaseModulesFixture({ factions: ['ixians', 'ecaz', 'moritani'], expansions: ['ix', 'ecaz'],
    advanced: true, tech: true, strongholds: true });
  const html = render(f.lobby);
  assert.match(html, /Tech tokens · optional/); assert.match(html, /Stronghold Cards · Advanced rules required/);
  assert.match(html, /Begin Advanced preview/);
  assert.ok(f.actions.some(step => step.action.type === 'strongholdCards' && step.action.enabled === true));
  assert.ok(f.actions.some(step => step.action.type === 'start' && step.action.advancedPreview === true));
  const playing = render(f.game);
  assert.match(playing, /Inspect Stronghold Cards/); assert.match(playing, /Heighliners/);
  assert.match(playing, /Carthag|Sietch Tabr/);
});

void test('public module changes clear readiness and the two-player Tech lobby keeps Begin disabled', () => {
  let game = createGame('MIXEDPHASELOBBYCONTROLS', newPlayer('ecaz', 'Ecaz', 'ecaz'), false, ['ecaz']);
  joinGame(game, newPlayer('moritani', 'Moritani', 'moritani'));
  for (const seat of game.players) game = applyAction(game, seat.id, { type: 'ready' });
  game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  assert.ok(game.players.every(seat => !seat.ready));
  for (const seat of game.players) game = applyAction(game, seat.id, { type: 'ready' });
  const html = render(game);
  const begin = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .filter(([, , children]) => children.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() === 'Begin game');
  assert.equal(begin.length, 1, 'The lobby exposes one Begin game button, including its decorative children');
  assert.match(begin[0][1], /(?:^|\s)disabled=""(?:\s|$)/);
  assert.throws(() => applyAction(game, game.host, { type: 'start' }));
});
