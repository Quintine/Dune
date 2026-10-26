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

// React SSR confirms the original controls. Recorded public actions exercise
// authoritative Start/training; no DOM callback execution is claimed here.
void test('original World Nexus and Discovery controls retain real public Start and native trained leaders', () => {
  for (const advanced of [false, true]) {
    const f = createMixedPhaseModulesFixture({ factions: ['atreides', 'emperor', 'fremen'], expansions: [],
      advanced, homeworlds: true, nexus: true, discoveries: advanced, skills: advanced,
      tech: true, strongholds: advanced,
      ...(advanced ? { training: { atreides: 'warmaster', emperor: 'mentat', fremen: 'swordmaster-of-ginaz' } as const } : {}) });
    const render = (game: typeof f.game) => renderToStaticMarkup(createElement(GameTable, {
      game: viewGame(game, game.host), busy: false, send: async () => {}, onExit() {},
    }));
    const html = render(f.lobby), labels = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)];
    for (const text of ['Homeworlds · preview', 'Nexus Cards', 'Tech tokens · optional',
      ...(advanced ? ['Discoveries', 'Leader Skills · all fourteen skill cards', 'Stronghold Cards'] : [])]) {
      const label = labels.find(([, children]) => children.includes(text)); assert.ok(label, text);
      assert.match(label[1], /<input\b[^>]*checked=""/);
    }
    const text = advanced ? 'Begin Advanced preview' : 'Begin game';
    const button = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
      .find(([, , children]) => children.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() === text);
    assert.ok(button); assert.doesNotMatch(button[1], /(?:^|\s)disabled(?:=""|\s|$)/);
    assert.ok(f.actions.some(step => step.action.type === 'start' && !!step.action.advancedPreview === advanced));
    assert.equal(f.setup.homeworldOccupationPreview, true);
    if (advanced) {
      const assignment = f.afterSetup.leaderSkills!.assignments.find(assignment => assignment.owner === f.game.host); assert.ok(assignment);
      const native = f.afterSetup.players.find(player => player.id === assignment.owner)!.leaders.find(leader => leader.id === assignment.leader); assert.ok(native);
      const playing = render(f.game);
      assert.match(playing, /Public Leader Skill assignments/); assert.match(playing, /Warmaster/);
      assert.ok(playing.includes(native.name)); assert.match(playing, /Inspect Stronghold Cards/);
    }
  }
});
