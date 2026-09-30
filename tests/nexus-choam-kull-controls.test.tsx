import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame } from '../game/engine';
import type { GameView } from '../game/engine';
import { createNexusChoamKullFixture } from './fixture-nexus-choam-kull';
import { takeKullCard } from './fixture-choam-kull';
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
// Static imports would resolve Next and CSS before the Node-only SSR alias hook.
const { ChoamKull } = await import('../components/choam-kull');
const { GameTable } = await import('../components/game-table');

const controls = (game: GameView, busy = false) => renderToStaticMarkup(createElement(ChoamKull, {
  game, act() { assert.fail('Rendering must not play a card.'); }, busy,
}));
const table = (game: ComponentProps<typeof GameTable>['game'], busy = false) => renderToStaticMarkup(createElement(GameTable, {
  game, send: async () => { assert.fail('Rendering must not submit gameplay.'); }, busy, onExit() {},
}));

void test('ordinary Treachery fuel is inspectable as itself only by the entitled CHOAM seat', () => {
  for (const advanced of [false, true]) {
    const fixture = createNexusChoamKullFixture({ advanced, fuel: 'weapon' });
    const own = viewGame(JSON.parse(JSON.stringify(fixture.game)), fixture.choam);
    const fuel = own.kullReaction!.plays.find(play => play.card.id === fixture.fuel)!.card;
    const html = controls(own);
    assert.ok(html.includes(fuel.name));
    assert.ok(html.includes(fuel.id));
    assert.ok(html.includes(`Inspect card: ${fuel.name}`));
    assert.match(html, /aria-label="Inspect CHOAM Nexus card"/);
    assert.match(html, /<button[^>]*>Use Kull Wahad/);
    const rival = viewGame(fixture.game, fixture.actor);
    for (const player of rival.players) {
      if (player.id === rival.me) continue;
      Object.defineProperty(player, 'hand', { get() { throw new Error('Read private rival hand'); } });
    }
    // The component also refuses an overfilled foreign cost projection.
    rival.kullReaction = own.kullReaction;
    const outsider = controls(rival);
    assert.ok(!outsider.includes(fuel.id));
    assert.ok(!outsider.includes(fuel.name));
    assert.doesNotMatch(outsider, /<button|Inspect card/);
  }
});

void test('source and fuel selection shows real printed and any-Treachery costs instead of renaming fuel Kull', () => {
  const fixture = createNexusChoamKullFixture({ fuel: 'weapon' });
  const printed = takeKullCard(fixture.game, 'ix-kull-wahad');
  fixture.game.players.find(player => player.id === fixture.choam)!.hand.push(printed);
  const own = viewGame(fixture.game, fixture.choam);
  const html = controls(own);
  const options = [...html.matchAll(/<option[^>]*>(.*?)<\/option>/g)].map(match => match[1]);
  const fuel = own.kullReaction!.plays.find(play => play.card.id === fixture.fuel)!.card;
  assert.ok(options.some(option => option.includes(fuel.name)));
  assert.ok(options.some(option => option.includes(printed.name)));
  assert.ok(own.kullReaction!.plays.some(play => play.source === 'printed'));
  assert.ok(own.kullReaction!.plays.some(play => play.source === 'nexus' && play.card.kind !== 'worthless'));
});

void test('absent CHOAM Nexus gives decline only without exposing a false cost inspector', () => {
  const fixture = createNexusChoamKullFixture({ nexusFace: 'richese', fuel: 'weapon' });
  const own = viewGame(fixture.game, fixture.choam);
  const html = controls(own);
  assert.match(html, /<button[^>]*>Decline Kull/);
  assert.doesNotMatch(html, />Use Kull Wahad|Inspect card/);
  assert.ok(!html.includes(fixture.fuel));
});

void test('the actual table suspends voluntary panels throughout offer and counter, honoring all control locks', () => {
  const fixture = createNexusChoamKullFixture({ fuel: 'weapon' });
  const own = viewGame(fixture.game, fixture.choam);
  assert.match(table(own), /<button[^>]*>Use Kull Wahad/);
  const declared = applyAction(fixture.game, fixture.choam, {
    type: 'kullDecision', event: fixture.event, source: 'nexus', card: fixture.fuel,
  });
  const counter = viewGame(JSON.parse(JSON.stringify(declared)), fixture.other!);
  assert.match(table(counter), /<button[^>]*>Cancel with Karama/);
  assert.ok(!table(counter).includes(fixture.fuel));
  for (const [view, action] of [[own, 'Use Kull Wahad'], [counter, 'Cancel with Karama']] as const) {
    assert.doesNotMatch(table(view), /<button[^>]*>[^<]*(?:Ship forces|Cash in|Play Karama|End movement|Make a bribe)/i);
    assert.match(table(view, true), new RegExp(`disabled=""[^>]*>${action}`));
    for (const restriction of ['paused', 'closed', 'autopilot'] as const) {
      const locked: ComponentProps<typeof GameTable>['game'] = structuredClone(view);
      if (restriction === 'autopilot') locked.players.find(player => player.id === locked.me)!.autopilot = 'Easy';
      else locked.roomControl = { ...DEFAULT_ROOM_CONTROL, [restriction]: true };
      assert.match(table(locked), new RegExp(`disabled=""[^>]*>${action}`));
    }
  }
});

aliases.deregister();
