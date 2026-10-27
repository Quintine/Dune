import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game, type GameView } from '../game/engine';

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

function lobby(): Game {
  const game = createGame('ADVKULLUI', newPlayer('choam', 'CHOAM', 'choam'), true, ['choam', 'ix']);
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  return game;
}
const table = (game: GameView, busy = false) => renderToStaticMarkup(createElement(GameTable,
  { game, busy, send: async () => {}, onExit() {} }));

/** The precise checkbox's ownership state, rather than any other lobby control. */
function kullLabel(html: string): string {
  const label = html.match(/<label\b[^>]*>(?:(?!<\/label>)[\s\S])*Kull Wahad(?:(?!<\/label>)[\s\S])*<\/label>/)?.[0];
  assert.ok(label, 'The Kull preview choice is present in the lobby');
  return label;
}

void test('Advanced Kull is off until the host selects the preview and displays its scope and limits', () => {
  const fresh = lobby(), host = viewGame(fresh, 'choam');
  assert.equal(host.lobbyModules?.kullPreview, false);
  assert.equal(host.lobbyModules?.kullDefault, false);
  const unchecked = table(host);
  assert.match(kullLabel(unchecked), /type="checkbox"/);
  assert.match(unchecked, /Kull Wahad ·/);
  assert.match(unchecked, /Advanced.*development preview/);
  assert.doesNotMatch(kullLabel(unchecked), /\bchecked=/);
  assert.doesNotMatch(kullLabel(unchecked), /\bdisabled=/);
  assert.match(unchecked, /Printed Kull is inactive in this lobby/);

  const selected = applyAction(fresh, 'choam', { type: 'moduleOption', module: 'kullPreview', enabled: true });
  const selectedView = viewGame(selected, 'choam'), selectedHtml = table(selectedView);
  assert.equal(selectedView.lobbyModules?.kullPreview, true);
  assert.match(kullLabel(selectedHtml), /\bchecked=/);
  assert.match(selectedHtml, /Requires Advanced CHOAM with only classic factions/);
  assert.match(selectedHtml, /prevents the attempted specific Karama effect/);
  assert.match(selectedHtml, /phase duration is provisional/);
  assert.match(selectedHtml, /Structured bid, alliance, Revival, bribe and combined turn-action questions are unavailable/);
  assert.match(selectedHtml, /Unfunded non-CHOAM Karama-dependent bids remain deferred/);
  assert.doesNotMatch(selectedHtml, /Printed Kull is inactive in this lobby/);
});

void test('only the host can change the actual Advanced Kull checkbox', () => {
  const selected = applyAction(lobby(), 'choam', { type: 'moduleOption', module: 'kullPreview', enabled: true });
  const host = kullLabel(table(viewGame(selected, 'choam')));
  const guest = kullLabel(table(viewGame(selected, 'emperor')));
  assert.doesNotMatch(host, /\bdisabled=/);
  assert.match(guest, /\bdisabled=/);
  assert.match(kullLabel(table(viewGame(selected, 'choam'), true)), /\bdisabled=/);
  assert.throws(() => applyAction(selected, 'emperor', { type: 'moduleOption', module: 'kullPreview', enabled: false }));
});

void test('a real Advanced Kull start retains both the Advanced and Kull preview notices', () => {
  let game = applyAction(lobby(), 'choam', { type: 'moduleOption', module: 'kullPreview', enabled: true });
  for (const seat of game.players) game = applyAction(game, seat.id, { type: 'ready' });
  game = applyAction(game, 'choam', { type: 'start', advancedPreview: true });
  assert.equal(game.status, 'setup');
  assert.equal(game.kullPreview, true);
  for (const actor of ['choam', 'emperor']) {
    const html = table(viewGame(game, actor));
    assert.match(html, /Advanced preview/);
    assert.match(html, /Rules and card interactions are still/);
    assert.match(html, /Kull Wahad development preview/);
    assert.match(html, /provisional interception timing/);
    assert.match(html, /not\s+complete CHOAM or certified expansion rules/);
  }
});
