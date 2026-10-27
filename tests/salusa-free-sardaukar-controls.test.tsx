import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  holdRevivalCard, homeworldRevivalFixture, revivalInventory, revivalPlayer,
} from './fixture-homeworld-revival';
import { reachAdvancedRevivalOrderActor } from './fixture-advanced-revival-order';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' :
      specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
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

/** Actual Advanced Homeworld setup, then real ordered Charity/Bidding/Revival.
 * Controlled supplement: move 4 original Sardaukar and 2 normal reserves to
 * Tanks, leaving one on Salusa; transfer real Ghola/Karama cards from the deck
 * and stage one native leader dead. No casualty or card purchase is claimed. */
function source() {
  let game = homeworldRevivalFixture({ advanced: true });
  const p = revivalPlayer(game, 'e');
  assert.equal(p.reserves, 20);
  assert.equal(p.elites!.reserves, 5);
  p.reserves -= 6; p.tanks += 6;
  p.elites!.reserves -= 4; p.elites!.tanks += 4;
  game.homeworlds!.custody!.salusa!.elite = 1;
  const leader = p.leaders[0]; leader.dead = true; leader.deaths = 1;
  const ghola = holdRevivalCard(game, 'e', 'ghola');
  const karama = holdRevivalCard(game, 'e', 'karama');
  revivalInventory(game);
  game = reachAdvancedRevivalOrderActor(game, 'e');
  const view = viewGame(game, 'e');
  assert.ok(view.revival.sardaukarFreeBlock);
  assert.equal(view.ghola.eliteRemaining, 0);
  return { game, view, ghola, karama, leader };
}
const props = (game: GameView) => ({ game, busy: false, send: async () => {}, onExit() {} });
const markup = (view: GameView) => renderToStaticMarkup(createElement(GameTable, props(view)));
const words = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

/** Render the real GameTable with the two existing numeric useState selections
 * controlled for SSR. React's server dispatcher is restored immediately;
 * this exercises rendered values, not a browser or hydration interaction. */
function selectedMarkup(view: GameView, amount: number, elite: number): string {
  function SelectedTable() {
    const internals = React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
      H: { useState: (initial: unknown) => [unknown, unknown] };
    } };
    const dispatcher = internals.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H;
    const old = dispatcher.useState;
    let index = 0;
    dispatcher.useState = (initial: unknown) => {
      const pair = old(initial);
      index++;
      if (index === 6) return [amount, pair[1]];
      if (index === 10) return [elite, pair[1]];
      return pair;
    };
    try { return GameTable(props(view)); }
    finally { dispatcher.useState = old; }
  }
  return renderToStaticMarkup(createElement(SelectedTable));
}

void test('actual Low Salusa table shows special-Karama force bounds, reason and native leader alternative', () => {
  const { game, view, karama, leader } = source();
  const html = markup(view), start = html.indexOf('Once per game: revive up to three forces');
  assert.ok(start >= 0);
  const section = html.slice(start, html.indexOf('</article>', start));
  assert.ok(section.includes(view.revival.sardaukarFreeBlock!));
  assert.match(section, new RegExp(`id="special-revive-${karama}"[^>]*max="2"`));
  assert.match(section, /Sardaukar to revive\s*<input\b[^>]*max="0"/);
  assert.match(section, /Use special Karama · forces/);
  assert.ok(words(section).includes(`Revive ${leader.name} with special Karama`));
  const continued = applyAction(game, 'e', { type: 'card', mode: 'special', card: karama, leader: leader.id });
  assert.equal(revivalPlayer(continued, 'e').leaders[0].dead, false);
});

void test('actual SSR selected ordinary revival inputs quote solo normal, solo star and mixed groups correctly', () => {
  const { view } = source();
  for (const [amount, elite, cost] of [[1, 0, 0], [1, 1, 2], [2, 1, 2]] as const) {
    const html = selectedMarkup(view, amount, elite), text = words(html);
    assert.match(html, new RegExp(`id="forces"[^>]*value="${amount}"`));
    assert.match(html, new RegExp(`Elite forces\\s*<input\\b[^>]*value="${elite}"`));
    assert.ok(text.includes(`Selected force revival costs ${cost} spice`),
      `The actual ${amount}/${elite} selector must display ${cost} spice`);
  }
});

void test('actual Ghola inspector explains Low star exclusion while retaining normal and leader targets', () => {
  const { game, view, ghola, leader } = source();
  const html = markup(view), start = html.indexOf('<h3>Tleilaxu Ghola</h3>');
  assert.ok(start >= 0);
  const section = html.slice(start, html.indexOf('</article>', start));
  assert.ok(view.ghola.eliteBlock && section.includes(view.ghola.eliteBlock));
  assert.match(section, new RegExp(`id="ghola-${ghola}"[^>]*max="2"`));
  assert.match(section, /Elite forces to revive\s*<input\b[^>]*max="0"/);
  assert.ok(section.includes(leader.name));
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, 'e', { type: 'card', card: ghola, amount: 1, elite: 1 }));
  assert.deepEqual(game, before);
  const normal = applyAction(game, 'e', { type: 'card', card: ghola, amount: 1, elite: 0 });
  assert.equal(revivalPlayer(normal, 'e').tanks, revivalPlayer(game, 'e').tanks - 1);
});

void test('four own-view bots keep legal Low Salusa force and card participation', () => {
  const { game, karama, ghola } = source();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'e');
    view.players.find(player => player.id === 'e')!.bot = difficulty;
    const actions = botActions(view);
    assert.ok(actions.length, `${difficulty} needs a legal continuation`);
    for (const action of actions) {
      if (action.type === 'card' && (action.card === karama && action.mode === 'special' || action.card === ghola) && !action.leader)
        assert.equal(action.elite ?? 0, 0, `${difficulty} cannot freely revive a star`);
      assert.doesNotThrow(() => applyAction(game, 'e', action), `${difficulty}: ${JSON.stringify(action)}`);
    }
  }
});
