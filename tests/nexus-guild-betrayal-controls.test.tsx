import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement } from 'react';
import type { ReactNode, ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame } from '../game/engine';
import type { Action, Game, GameView } from '../game/engine';
import { createGuildBetrayalFixture } from './fixture-nexus-guild-betrayal';
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
// These UI modules require the Node-only Next/CSS loading hooks above;
// static imports would resolve them before the hooks are registered.
const { NexusGuildBetrayal } = await import('../components/nexus-guild-betrayal');
const { GameTable } = await import('../components/game-table');

function markup(game: GameView, busy = false): string {
  return renderToStaticMarkup(createElement(NexusGuildBetrayal, { game, act() {}, busy }));
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

function select(game: GameView, prefix: string, busy = false): Action | undefined {
  let selected: Action | undefined;
  click(NexusGuildBetrayal({ game, busy, act(action) { selected = action; } }), prefix);
  return selected;
}

function allPass(original: Game): Game {
  let game = structuredClone(original);
  for (const player of game.players) {
    const action = select(viewGame(game, player.id), 'Pass');
    if (action) game = applyAction(game, player.id, action);
  }
  return game;
}

void test('private eligibility grants Use and own Guild inspector without revealing a rival face or source', () => {
  const fixture = createGuildBetrayalFixture();
  const own = viewGame(fixture.game, fixture.holder);
  assert.match(markup(own), /<button[^>]*>Use Guild Nexus/);
  assert.match(markup(own), /Inspect Spacing Guild Nexus card/);
  const nonholder = createGuildBetrayalFixture({ nexusFace: 'choam' });
  const neutral = viewGame(nonholder.game, nonholder.holder);
  assert.ok(select(neutral, 'Pass'));
  assert.equal(select(neutral, 'Use Guild Nexus'), undefined);
  assert.doesNotMatch(markup(neutral), /Inspect Spacing Guild Nexus card/);
  const outsider = viewGame(fixture.game, fixture.guild);
  assert.equal(select(outsider, 'Pass'), undefined);
  assert.equal(select(outsider, 'Use Guild Nexus'), undefined);
  assert.doesNotMatch(markup(outsider), /Inspect Spacing Guild Nexus card/);
  // The response itself gets only the fixed private projection, not a quote or
  // an extra entitlement to a shipper's hand, balance, source or route.
  assert.deepEqual(Object.keys(own.guildBetrayalReaction!).sort(), ['blocked', 'canPass', 'canUse', 'event', 'hasPassed', 'shipper']);
});

void test('actual event-only human Use replaces other and own funded reserve payments with identical force delivery', () => {
  for (const payer of ['other', 'holder'] as const) {
    const fixture = createGuildBetrayalFixture({ payer });
    const before = structuredClone(fixture.game);
    const action = select(viewGame(before, fixture.holder), 'Use Guild Nexus');
    assert.deepEqual(action, { type: 'guildBetrayalUse', event: fixture.event });
    assert.ok(action);
    const result = applyAction(before, fixture.holder, action);
    const passed = allPass(fixture.game);
    assert.equal(viewGame(result, fixture.holder).guildBetrayalReaction, null);
    const holderBefore = fixture.game.players.find(player => player.id === fixture.holder)!;
    const holderAfter = result.players.find(player => player.id === fixture.holder)!;
    const shipperBefore = fixture.game.players.find(player => player.id === fixture.shipper)!;
    const shipperAfter = result.players.find(player => player.id === fixture.shipper)!;
    assert.equal(holderAfter.spice, holderBefore.spice + (payer === 'holder' ? 0 : fixture.price));
    assert.equal(shipperAfter.spice, shipperBefore.spice - (payer === 'holder' ? 0 : fixture.price));
    assert.equal(result.players.find(player => player.id === fixture.guild)!.spice,
      fixture.game.players.find(player => player.id === fixture.guild)!.spice);
    assert.equal(shipperAfter.shipped, true);
    assert.equal(shipperAfter.reserves, shipperBefore.reserves - 2);
    assert.deepEqual(result.players.map(player => ({ id: player.id, reserves: player.reserves, forces: player.forces, elites: player.elites })),
      passed.players.map(player => ({ id: player.id, reserves: player.reserves, forces: player.forces, elites: player.elites })));
    assert.equal(result.nexusCards?.cards?.hands[fixture.holder], null);
    assert.ok(result.nexusCards?.cards?.discard.includes('guild'));
    assert.equal(passed.nexusCards?.cards?.hands[fixture.holder], 'guild');
    assert.equal(passed.players.find(player => player.id === fixture.guild)!.spice,
      fixture.game.players.find(player => player.id === fixture.guild)!.spice + fixture.price);
  }
});

void test('busy, stopped, passed, ineligible and privately blocked responses cannot emit Use', () => {
  const fixture = createGuildBetrayalFixture();
  const view = viewGame(fixture.game, fixture.holder);
  assert.equal(select(view, 'Use Guild Nexus', true), undefined);
  assert.equal(select(view, 'Pass', true), undefined);
  view.guildBetrayalReaction!.blocked = 'An existing promise reserves this Nexus card.';
  assert.equal(select(view, 'Use Guild Nexus'), undefined);
  assert.deepEqual(select(view, 'Pass'), { type: 'guildBetrayalPass', event: fixture.event });
  assert.match(markup(view), /Inspect Spacing Guild Nexus card/);
  view.guildBetrayalReaction!.blocked = null;
  view.guildBetrayalReaction!.canUse = false;
  assert.equal(select(view, 'Use Guild Nexus'), undefined);
  view.guildBetrayalReaction!.canUse = true;
  view.guildBetrayalReaction!.hasPassed = true;
  assert.equal(select(view, 'Use Guild Nexus'), undefined);
  assert.equal(select(view, 'Pass'), undefined);
  view.guildBetrayalReaction!.hasPassed = false;
  view.guildBetrayalReaction!.canPass = false;
  assert.equal(select(view, 'Use Guild Nexus'), undefined);
  view.guildBetrayalReaction!.canPass = true;
  view.status = 'finished';
  assert.equal(select(view, 'Use Guild Nexus'), undefined);
  assert.equal(select(view, 'Pass'), undefined);
  view.guildBetrayalReaction = null;
  assert.equal(markup(view), '');
});

void test('saved human actions cannot spend against future, foreign or completed shipment events', () => {
  const fixture = createGuildBetrayalFixture();
  const action = select(viewGame(fixture.game, fixture.holder), 'Use Guild Nexus');
  assert.ok(action);
  for (const event of ['foreign-shipment', `${fixture.event}:future`]) {
    const game = structuredClone(fixture.game);
    const before = JSON.stringify(game);
    assert.throws(() => applyAction(game, fixture.holder, { ...action, event }));
    assert.equal(JSON.stringify(game), before);
  }
  const settled = applyAction(structuredClone(fixture.game), fixture.holder, action);
  const before = JSON.stringify(settled);
  assert.throws(() => applyAction(settled, fixture.holder, action));
  assert.equal(JSON.stringify(settled), before);
});

void test('actual GameTable reserves underlying shipment, voluntary and hand controls and respects room ownership', () => {
  const fixture = createGuildBetrayalFixture({ payer: 'holder' });
  const own = viewGame(fixture.game, fixture.holder);
  const table = (game: ComponentProps<typeof GameTable>['game'], busy = false) => renderToStaticMarkup(createElement(GameTable, {
    game, send: async () => {}, busy, onExit() {},
  }));
  const html = table(own);
  assert.match(html, /aria-label="Guild Nexus Betrayal response"/);
  assert.match(html, /Guild Nexus Betrayal development preview/);
  assert.match(html, /href="\/rules\?topic=nexus-guild-betrayal#nexus-guild-betrayal"/);
  assert.doesNotMatch(html, /<button[^>]*>[^<]*(?:Ship |Confirm shipment|End movement|Play Karama|Make a bribe|Pledge|Search)/i);
  assert.match(table(own, true), /disabled=""[^>]*>Use Guild Nexus/);
  for (const restriction of ['paused', 'closed', 'autopilot'] as const) {
    const restricted: ComponentProps<typeof GameTable>['game'] = structuredClone(own);
    if (restriction === 'autopilot') restricted.players.find(player => player.id === own.me)!.autopilot = 'Easy';
    else restricted.roomControl = { ...DEFAULT_ROOM_CONTROL, [restriction]: true };
    assert.match(table(restricted), /disabled=""[^>]*>Use Guild Nexus/);
    assert.match(table(restricted), /disabled=""[^>]*>Pass/);
  }
  const continued = viewGame(allPass(fixture.game), fixture.holder);
  assert.doesNotMatch(table(continued), /aria-label="Guild Nexus Betrayal response"/);
  assert.equal(continued.players.find(player => player.id === own.me)!.shipped, true);
});

aliases.deregister();
