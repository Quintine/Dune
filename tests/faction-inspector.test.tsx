import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FACTIONS } from '../game/catalog';
import { FACTION_RULES } from '../game/faction-reference';
import { RULE_TOPICS } from '../game/reference';
import { createGame, joinGame, newPlayer, viewGame } from '../game/engine';

const aliases = registerHooks({
  resolve(specifier, context, next) { return next(specifier === 'next/link' ? 'vinext/shims/link' : specifier === 'next/image' ? 'vinext/shims/image' : specifier, context); },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m => [m[1], m[1]]));
    return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
  },
});
const { FactionSheet, FactionSheetGallery } = await import('../components/faction-inspector');
const { GameTable } = await import('../components/game-table');
aliases.deregister();

void test('all twelve faction sheets share reference text, distinct identities, bundled art and valid internal links', () => {
  assert.deepEqual(Object.keys(FACTION_RULES).sort(), FACTIONS.map(f => f.id).sort());
  for (const house of FACTIONS) {
    const basic = RULE_TOPICS.find(t => t.id === `faction-${house.id}`)!;
    const advanced = RULE_TOPICS.find(t => t.id === `advanced-${house.id}`)!;
    assert.equal(basic.steps, FACTION_RULES[house.id].basic);
    assert.equal(advanced.steps, FACTION_RULES[house.id].advanced);
    assert.ok(basic.steps.length > 1 && advanced.steps.length > 0);
    const html = renderToStaticMarkup(createElement(FactionSheet, { factionId: house.id, advanced: true }));
    assert.ok(html.includes(`aria-label="${house.name} faction sheet"`));
    assert.ok(html.includes(`href="/rules?topic=faction-${house.id}#faction-${house.id}"`));
    assert.ok(html.includes(`href="/rules?topic=advanced-${house.id}#advanced-${house.id}"`));
    const art = html.match(/src="(\/art\/homeworlds\/[^" ]+)"/)?.[1];
    assert.ok(art && existsSync(new URL(`../public${art}`, import.meta.url)));
    assert.doesNotMatch(html, /https?:\/\//);
  }
});

void test('Basic sheets omit Advanced rules; Advanced sheets retain the underlying Basic powers', () => {
  const basic = renderToStaticMarkup(createElement(FactionSheet, { factionId: 'harkonnen', advanced: false }));
  const advanced = renderToStaticMarkup(createElement(FactionSheet, { factionId: 'harkonnen', advanced: true }));
  assert.match(basic, /Harkonnen Basic powers and alliances/);
  assert.doesNotMatch(basic, /aria-label="Harkonnen Advanced powers"|Advanced Harkonnen reference/);
  assert.match(advanced, /Harkonnen Basic powers and alliances/);
  assert.match(advanced, /aria-label="Harkonnen Advanced powers"/);
  assert.match(advanced, /The rules and game are still being completed/);
});

void test('the reference gallery includes every faction and starts in Basic without a saved-table mode claim', () => {
  const html = renderToStaticMarkup(createElement(FactionSheetGallery));
  for (const house of FACTIONS) assert.ok(html.includes(`value="${house.id}"`));
  assert.match(html, /Atreides faction sheet/);
  assert.match(html, /Include Advanced powers/);
  assert.doesNotMatch(html, /This table uses|Atreides Advanced powers/);
});

void test('every occupied player has a public inspector for either viewer even while actions are busy', () => {
  const game = createGame('SHEETUI', newPlayer('a', 'Own name', 'atreides'));
  joinGame(game, newPlayer('h', 'Other name', 'harkonnen'));
  const before = JSON.stringify(game);
  for (const id of ['a', 'h']) {
    const html = renderToStaticMarkup(createElement(GameTable, { game: viewGame(game, id), busy: true, send: async () => { assert.fail('Inspection must not act.'); }, onExit() {} }));
    for (const name of ['Atreides', 'Harkonnen']) {
      const button = html.match(new RegExp(`<button[^>]*aria-label="Inspect faction: ${name}"[^>]*>`))?.[0];
      assert.ok(button);assert.doesNotMatch(button, /\s(?:disabled(?:=|[ >])|aria-disabled="true")/);
    }
    assert.equal((html.match(/>Inspect faction</g) ?? []).length, 2);
  }
  assert.equal(JSON.stringify(game), before);
});
