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

// Original public actions drive setup. React SSR supplies visible-control
// evidence without claiming that these stateful components received DOM clicks.
void test('World and phase module controls retain their checked state and actual Basic/Advanced Start paths', () => {
  for (const advanced of [false, true]) {
    const f = createMixedPhaseModulesFixture({ factions: ['ixians', 'ecaz', 'moritani'], expansions: ['ix', 'ecaz'],
      advanced, homeworlds: true, tech: true, strongholds: advanced, independent: advanced });
    const render = (game: typeof f.game) => renderToStaticMarkup(createElement(GameTable, {
      game: viewGame(game, game.host), busy: false, send: async () => {}, onExit() {},
    }));
    const html = render(f.lobby);
    const labels = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)];
    for (const text of ['Homeworlds · preview', 'Tech tokens · optional', ...(advanced ? ['Stronghold Cards', 'Ecaz Treachery Cards'] : [])]) {
      const label = labels.find(([, children]) => children.includes(text)); assert.ok(label, text);
      assert.match(label[1], /<input\b[^>]*checked=""/);
    }
    const text = advanced ? 'Begin Advanced preview' : 'Begin game';
    const button = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
      .find(([, , children]) => children.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() === text);
    assert.ok(button); assert.doesNotMatch(button[1], /(?:^|\s)disabled(?:=""|\s|$)/);
    assert.ok(f.actions.some(step => step.actor === f.initial.host && step.action.type === 'homeworlds' && step.action.enabled === true));
    assert.ok(f.actions.some(step => step.action.type === 'start' && !!step.action.advancedPreview === advanced));
    assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.homeworldOccupationPreview, true);
    const playing = render(f.game);
    assert.match(playing, /Heighliners/); assert.match(playing, /Homeworld|Grumman|Tleilax/);
    if (advanced) assert.match(playing, /Inspect Stronghold Cards/);
  }
});
