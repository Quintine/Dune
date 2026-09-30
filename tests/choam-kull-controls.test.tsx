import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame } from '../game/engine';
import type { GameView } from '../game/engine';
import { choamKullGame, kullShipmentAttempt } from './fixture-choam-kull';

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
// Static component imports would resolve Next modules before the Node alias hook.
const { ChoamKull } = await import('../components/choam-kull');
const { GameTable } = await import('../components/game-table');

function offerView(owner = 'c'): GameView {
  const game = choamKullGame();
  const offer = applyAction(game, 'e', kullShipmentAttempt(game));
  return viewGame(JSON.parse(JSON.stringify(offer)), owner);
}

function markup(game: GameView, busy = false): string {
  return renderToStaticMarkup(createElement(ChoamKull, { game, act() {}, busy }));
}

void test('only the reactor receives physical Kull cost controls; outsiders cannot inspect offer cards', () => {
  const holder = offerView();
  const rival = offerView('h');
  for (const player of rival.players) {
    if (player.id === rival.me) continue;
    Object.defineProperty(player, 'hand', {
      get() { throw new Error('Opponent private hand read'); },
    });
  }
  const html = markup(holder);
  assert.match(html, /<button[^>]*>Decline Kull/);
  assert.match(html, /<button[^>]*>Use Kull Wahad[^<]*ix-kull-wahad/);
  assert.match(html, /Inspect card/);
  const outsider = markup(rival);
  assert.doesNotMatch(outsider, /<button|ix-kull-wahad|Inspect card/);
  // Even an accidentally overfilled foreign projection must not create controls.
  rival.kullReaction = holder.kullReaction;
  assert.doesNotMatch(markup(rival), /<button|ix-kull-wahad|Inspect card/);
});

void test('busy and blocked offers cannot expose an enabled use action, but an unavailable cost can be declined', () => {
  const holder = offerView();
  const busy = markup(holder, true);
  assert.match(busy, /disabled=""[^>]*>Decline Kull/);
  assert.match(busy, /disabled=""[^>]*>Use Kull Wahad/);
  holder.kullReaction!.blocked = 'The physical cost is reserved.';
  assert.doesNotMatch(markup(holder), />Use Kull Wahad/);
  assert.match(markup(holder), /<button[^>]*>Decline Kull/);
  holder.kullReaction!.blocked = null;
  holder.kullReaction!.plays = [];
  assert.doesNotMatch(markup(holder), />Use Kull Wahad/);
  assert.match(markup(holder), /<button[^>]*>Decline Kull/);
  holder.kullReaction!.canDecline = false;
  assert.doesNotMatch(markup(holder), /<button/);
});

void test('the real saved table mounts the offer instead of shipment and voluntary hand powers', () => {
  const holder = offerView();
  const html = renderToStaticMarkup(createElement(GameTable, {
    game: holder, send: async () => {}, busy: false, onExit() {},
  }));
  assert.match(html, /aria-label="Kull Wahad response"/);
  assert.match(html, /<button[^>]*>Use Kull Wahad/);
  assert.doesNotMatch(html, /<button[^>]*>[^<]*(?:Ship forces|Cash in|Play Karama|End movement)/i);
  const disabled = renderToStaticMarkup(createElement(GameTable, {
    game: holder, send: async () => {}, busy: true, onExit() {},
  }));
  assert.match(disabled, /disabled=""[^>]*>Use Kull Wahad/);
});

void test('a successful phase ban removes the retained Karama shipment-rate control', () => {
  const initial = choamKullGame();
  let g = applyAction(initial, 'e', kullShipmentAttempt(initial));
  g = applyAction(g, 'c', {
    type: 'kullDecision', event: g.pendingKull!.event, source: 'printed', card: 'ix-kull-wahad',
  });
  for (let step = 0; g.pendingKull && step < 12; step++) {
    const actor = g.players.find(p => {
      const controls = viewGame(g, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    assert.ok(actor);
    g = applyAction(g, actor.id, { type: 'passResponse' });
  }
  assert.equal(g.pendingKull, null);
  const blocked = viewGame(g, 'e');
  const render = (game: GameView) => renderToStaticMarkup(createElement(GameTable, {
    game, send: async () => { assert.fail('Rendering must not submit gameplay.'); }, busy: false, onExit() {},
  }));
  assert.ok(blocked.karamaBlocked);
  assert.doesNotMatch(render(blocked), />Guild rates for/);
  const available = { ...blocked, karamaBlocked: null };
  assert.match(render(available), />Guild rates for/);
});

aliases.deregister();
