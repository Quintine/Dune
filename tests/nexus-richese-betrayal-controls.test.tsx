import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement } from 'react';
import type { ReactNode, ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame } from '../game/engine';
import type { Action, Game, GameView } from '../game/engine';
import { createRicheseBetrayalFixture } from './fixture-richese-betrayal';
import { DEFAULT_ROOM_CONTROL } from '../lib/room-control';

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
// Static imports load Next and CSS before these Node-only SSR alias hooks.
const { NexusRicheseBetrayal } = await import('../components/nexus-richese-betrayal');
const { GameTable } = await import('../components/game-table');

function markup(game: GameView, busy = false): string {
  return renderToStaticMarkup(createElement(NexusRicheseBetrayal, { game, act() {}, busy }));
}

function click(node: ReactNode, prefix: string): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) continue;
    if (typeof child.props.children === 'string' && child.props.children.startsWith(prefix) && child.props.onClick) {
      child.props.onClick();
      return true;
    }
    if (click(child.props.children, prefix)) return true;
  }
  return false;
}

void test('only the canonical private holder can use while public possible nonholders acknowledge the same auction', () => {
  const holderFixture = createRicheseBetrayalFixture('purchase');
  const nonholderFixture = createRicheseBetrayalFixture('purchase', { holderNexus: 'choam' });
  const holder = viewGame(JSON.parse(JSON.stringify(holderFixture.game)), holderFixture.holder);
  const nonholder = viewGame(JSON.parse(JSON.stringify(nonholderFixture.game)), nonholderFixture.holder);
  assert.match(markup(holder), /<button[^>]*>Use Richese Nexus/);
  assert.match(markup(holder), /Inspect Richese Nexus card/);
  assert.match(markup(nonholder), /<button[^>]*>Pass/);
  assert.doesNotMatch(markup(nonholder), /<button[^>]*>Use Richese Nexus|Inspect Richese Nexus card/);
  const outsider = viewGame(holderFixture.game, holderFixture.target);
  assert.doesNotMatch(markup(outsider), /<button[^>]*>(?:Pass|Use Richese Nexus)/);
  assert.match(markup(outsider), /Waiting for the required acknowledgements/);
});

void test('concealed Black Market receipt never exposes another hand, spice, or physical sale face', () => {
  const fixture = createRicheseBetrayalFixture('sale');
  const view = viewGame(JSON.parse(JSON.stringify(fixture.game)), fixture.holder);
  const face = fixture.game.players.find(player => player.id === fixture.target)!.hand.find(card => card.id === fixture.card)!;
  for (const rival of view.players) {
    if (rival.id !== view.me) {
      delete rival.hand;
      delete rival.spice;
    }
  }
  const html = markup(view);
  assert.match(html, /concealed Black Market lot/);
  assert.match(html, /same payment to the Spice Bank/);
  assert.doesNotMatch(html, new RegExp(face.id));
  assert.doesNotMatch(html, new RegExp(face.name));
});

void test('busy and blocked reactions cannot spend a cost, but blocked responders may pass', () => {
  const fixture = createRicheseBetrayalFixture('purchase');
  const view = viewGame(fixture.game, fixture.holder);
  const busy = markup(view, true);
  assert.match(busy, /disabled=""[^>]*>Pass/);
  assert.match(busy, /disabled=""[^>]*>Use Richese Nexus/);
  view.richeseBetrayalReaction!.blocked = 'An existing promise reserves this card.';
  assert.doesNotMatch(markup(view), /<button[^>]*>Use Richese Nexus/);
  assert.match(markup(view), /<button[^>]*>Pass/);
});

void test('human event-bound Use and Pass handlers settle real saved purchases and sales, not an underlying bid', () => {
  for (const kind of ['purchase', 'sale'] as const) {
    for (const use of [true, false]) {
      const fixture = createRicheseBetrayalFixture(kind);
      let game: Game = JSON.parse(JSON.stringify(fixture.game));
      const own = viewGame(game, fixture.holder);
      let selected: Action | undefined;
      const tree = NexusRicheseBetrayal({ game: own, act(action) { selected = action; }, busy: false });
      assert.equal(click(tree, use ? 'Use Richese Nexus' : 'Pass'), true);
      assert.ok(selected);
      game = applyAction(game, fixture.holder, selected);
      if (!use) {
        for (const player of game.players) {
          const view = viewGame(game, player.id);
          const offer = view.richeseBetrayalReaction;
          if (offer?.canPass && !offer.hasPassed) {
            game = applyAction(game, player.id, { type: 'richeseBetrayalPass', event: offer.event });
          }
        }
      }
      assert.equal(viewGame(game, fixture.holder).richeseBetrayalReaction, null);
      const buyer = game.players.find(player => player.id === fixture.buyer)!;
      const vetoed = use && kind === 'purchase';
      assert.equal(buyer.hand.some(card => card.id === fixture.card), !vetoed);
      assert.equal(buyer.spice, fixture.game.players.find(player => player.id === fixture.buyer)!.spice - (vetoed ? 0 : own.richeseBetrayalReaction!.price));
      if (kind === 'sale') {
        assert.equal(game.players.find(player => player.id === fixture.target)!.spice,
          fixture.game.players.find(player => player.id === fixture.target)!.spice + (use ? 0 : own.richeseBetrayalReaction!.price));
      }
    }
  }
});

void test('the actual table owns auction and voluntary controls through reservation, pause, transport and autopilot', () => {
  const fixture = createRicheseBetrayalFixture('purchase');
  const own = viewGame(fixture.game, fixture.holder);
  const table = (game: ComponentProps<typeof GameTable>['game'], busy = false) => renderToStaticMarkup(createElement(GameTable, {
    game, send: async () => {}, busy, onExit() {},
  }));
  const html = table(own);
  assert.match(html, /aria-label="Richese Nexus Betrayal response"/);
  assert.match(html, /Richese Nexus Betrayal development preview/);
  assert.match(html, /href="\/rules\?topic=nexus-richese-betrayal#nexus-richese-betrayal"/);
  assert.doesNotMatch(html, /aria-label="Richese auction"|<button[^>]*>[^<]*(?:Submit bid|Bid |Cash in|Play Karama|Make a bribe)/i);
  assert.match(table(own, true), /disabled=""[^>]*>Use Richese Nexus/);
  for (const restriction of ['paused', 'closed', 'autopilot'] as const) {
    const restricted: ComponentProps<typeof GameTable>['game'] = structuredClone(own);
    if (restriction === 'autopilot') restricted.players.find(player => player.id === own.me)!.autopilot = 'Easy';
    else restricted.roomControl = { ...DEFAULT_ROOM_CONTROL, [restriction]: true };
    assert.match(table(restricted), /disabled=""[^>]*>Use Richese Nexus/);
  }
  own.richeseBetrayalReaction = null;
  own.richeseBetrayalPreview = false;
  const ordinary = table(own);
  assert.match(ordinary, /aria-label="Richese auction"/);
  assert.doesNotMatch(ordinary, /Richese Nexus Betrayal development preview|aria-label="Richese Nexus Betrayal response"/);
});

aliases.deregister();
