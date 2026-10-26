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

// Original actions select the modules, Start and eligible training. Stateful
// React SSR confirms visible controls without claiming DOM callback execution.
void test('original World Skills controls retain selected modules and Basic/Advanced preview Start with live trained leaders', () => {
  for (const advanced of [false, true]) {
    const f = createMixedPhaseModulesFixture({ factions: ['atreides', 'ecaz', 'ixians'], expansions: ['ix', 'choam', 'ecaz'],
      advanced, homeworlds: true, skills: true, tech: true, strongholds: advanced, independent: advanced,
      training: { atreides: 'warmaster', ecaz: 'spice-banker', ixians: 'mentat' } });
    const render = (game: typeof f.game) => renderToStaticMarkup(createElement(GameTable, {
      game: viewGame(game, game.host), busy: false, send: async () => {}, onExit() {},
    }));
    const html = render(f.lobby);
    const labels = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)];
    for (const text of ['Homeworlds · preview', 'Leader Skills · all fourteen skill cards', 'Tech tokens · optional',
      ...(advanced ? ['Stronghold Cards', 'Ecaz Treachery Cards'] : [])]) {
      const label = labels.find(([, children]) => children.includes(text)); assert.ok(label, text);
      assert.match(label[1], /<input\b[^>]*checked=""/);
    }
    const text = advanced ? 'Begin Advanced preview' : 'Begin game';
    const button = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
      .find(([, , children]) => children.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() === text);
    assert.ok(button); assert.doesNotMatch(button[1], /(?:^|\s)disabled(?:=""|\s|$)/);
    assert.ok(f.actions.some(step => step.actor === f.initial.host && step.action.type === 'moduleOption' &&
      step.action.module === 'leaderSkills' && step.action.enabled === true));
    assert.ok(f.actions.some(step => step.action.type === 'start' && !!step.action.advancedPreview === advanced));
    assert.equal(f.setup.homeworldOccupationPreview, true);
    assert.equal(f.actions.filter(step => step.action.type === 'leaderSkill').length, 3);
    const playing = render(f.game);
    assert.match(playing, /Warmaster/); assert.match(playing, /Spice Banker/); assert.match(playing, /Mentat/);
    if (advanced) assert.match(playing, /Inspect Stronghold Cards/);
  }
});
