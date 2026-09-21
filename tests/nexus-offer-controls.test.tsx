import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type Game } from '../game/engine';
import { nexusOfferGame } from './fixture-nexus-offer';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

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
function markup(g: Game, id = 'a', busy = false) {
  return renderToStaticMarkup(createElement(GameTable, { game: viewGame(g, id), busy, send: async () => {}, onExit() {} }));
}

void test('live outgoing offer is named and withdrawable only by its sender, separately from an incoming invitation', () => {
  const g = applyAction(nexusOfferGame(), 'a', { type: 'alliance', target: 'e' });
  const html = markup(g);
  assert.match(html, /Your alliance offer is to Emperor recipient/);
  assert.match(html, /Withdraw your alliance offer/);
  assert.doesNotMatch(html, />Break alliance</);
  assert.doesNotMatch(markup(g, 'e'), /Withdraw your alliance offer/);
  assert.match(markup(g, 'e'), /Atreides offerer · Invited you/);
  assert.doesNotMatch(markup(g, 'h'), /Withdraw your alliance offer/);
  assert.match(markup(g, 'a', true), /disabled=""[^>]*>Withdraw your alliance offer/);
  const changed = applyAction(g, 'a', { type: 'alliance', target: 'h' });
  assert.match(markup(changed), /Your alliance offer is to Harkonnen observer/);
});

void test('saved withdrawal clears its own offer, resets readiness, preserves custody and records the named change', () => {
  let g = nexusOfferGame();
  g = applyAction(g, 'h', { type: 'alliance', target: 'a' });
  g = applyAction(g, 'a', { type: 'alliance', target: 'e' });
  assert.match(g.log.at(-1)!.text, /offered an alliance to Emperor recipient/);
  g.ready = ['h'];
  const before = JSON.stringify(g);
  const withdrawn = applyAction(JSON.parse(before), 'a', { type: 'alliance' });
  assert.equal(JSON.stringify(g), before);
  assert.deepEqual(withdrawn.allianceOffers, { h: 'a' });
  assert.deepEqual(withdrawn.players, g.players);
  assert.deepEqual(withdrawn.ready, []);
  assert.match(withdrawn.log.at(-1)!.text, /withdrew the alliance offer to Emperor recipient/);
  assert.doesNotMatch(markup(withdrawn), /Withdraw your alliance offer/);
  assert.match(markup(withdrawn), /Harkonnen observer · Invited you/);
  const next = applyAction(withdrawn, 'a', { type: 'alliance', target: 'h' });
  assert.equal(next.players[0].ally, 'h');
  assert.match(markup(next), />Break alliance</);
  assert.doesNotMatch(markup(next), /Withdraw your alliance offer/);
  const broken = applyAction(next, 'a', { type: 'alliance' });
  assert.match(broken.log.at(-1)!.text, /broke the alliance with Harkonnen observer/);
  assert.ok(broken.players.every(p => p.ally === null));
});

void test('closing the Nexus or opening Truthtrance never exposes a usable stale withdrawal', () => {
  const g = applyAction(nexusOfferGame(), 'a', { type: 'alliance', target: 'e' });
  const closed = { ...g, nexus: false };
  assert.doesNotMatch(markup(closed), /Withdraw your alliance offer/);
  const before = JSON.stringify(closed);
  assert.throws(() => applyAction(closed, 'a', { type: 'alliance' }), /Nexus/);
  assert.equal(JSON.stringify(closed), before);
  const paused = structuredClone(g);
  paused.truthtrance = { stage: 'priority', queue: [], passed: [], question: null };
  const html = markup(paused);
  if (html.includes('Withdraw your alliance offer'))
    assert.match(html, /disabled=""[^>]*>Withdraw your alliance offer/);
  assert.throws(() => applyAction(paused, 'a', { type: 'alliance' }));
});

void test('every existing AI profile has legal participation after a human withdraws an offer', () => {
  let g = applyAction(nexusOfferGame(), 'a', { type: 'alliance', target: 'e' });
  g = applyAction(g, 'a', { type: 'alliance' });
  for (const level of DIFFICULTIES) {
    const view = viewGame(g, 'e');
    view.players.find(p => p.id === 'e')!.bot = level;
    const action = botActions(view)[0];
    assert.ok(action);
    const before = JSON.stringify(g);
    assert.ok(applyAction(g, 'e', action));
    assert.equal(JSON.stringify(g), before);
  }
});
