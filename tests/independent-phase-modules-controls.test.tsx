import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame } from '../game/engine';
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

// Stateful components render through React SSR. Recorded public actions prove
// authoritative selection/Start; these renders do not claim browser clicks.
void test('original independent-card and phase controls remain selected through Basic and Advanced preview Start', () => {
  for (const advanced of [false, true]) {
    const f = createMixedPhaseModulesFixture({ factions: ['ixians', 'ecaz', 'moritani'], expansions: ['ix', 'ecaz'],
      advanced, tech: true, strongholds: advanced, independent: true });
    const render = (game: typeof f.game) => renderToStaticMarkup(createElement(GameTable, {
      game: viewGame(game, game.host), busy: false, send: async () => {}, onExit() {},
    }));
    const html = render(f.lobby);
    const variant = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)]
      .find(([, children]) => children.includes('Ecaz Treachery Cards'));
    assert.ok(variant, 'The lobby exposes the original optional independent-card control');
    assert.match(variant[1], /<input\b[^>]*checked=""/);
    assert.match(variant[1], /Recruits, Reinforcements, Harass &amp; Withdraw/);
    assert.match(html, /Tech tokens · optional/);
    const label = advanced ? 'Begin Advanced preview' : 'Begin game';
    const begin = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
      .find(([, , children]) => children.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() === label);
    assert.ok(begin, 'The ready host has its original Start control');
    assert.doesNotMatch(begin[1], /(?:^|\s)disabled(?:=""|\s|$)/);
    assert.equal(f.lobby.lobbyOptions?.ecazTreachery, true);
    assert.ok(f.actions.some(step => step.actor === f.initial.host && step.action.type === 'moduleOption' &&
      step.action.module === 'ecazTreachery' && step.action.enabled === true));
    assert.ok(f.actions.some(step => step.action.type === 'start' && !!step.action.advancedPreview === advanced));
    assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.ecazTreachery, true);
    const playing = render(f.game);
    assert.match(playing, /Heighliners/);
    if (advanced) assert.match(playing, /Inspect Stronghold Cards/);
  }
});
