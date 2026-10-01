import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame } from '../game/engine';
import type { GameView } from '../game/engine';
import { advanceToForecast, createAdvancedSourceFixture, settleAdvancedSourceResponses } from './fixture-advanced-source';
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
// Next/CSS test loading hooks must be registered before this UI dependency is loaded.
const { GameTable } = await import('../components/game-table');

function table(game: GameView, busy = false): string {
  return renderToStaticMarkup(createElement(GameTable, { game, send: async () => {}, busy, onExit() {} }));
}

void test('actual first Storm gives the recorded dialers battle wheels and no public card or private forecast', () => {
  const fixture = createAdvancedSourceFixture({ storm: 'first' });
  for (const player of fixture.game.players) {
    const own = viewGame(fixture.game, player.id);
    const html = table(own);
    if (own.stormDialers.includes(player.id)) {
      assert.match(html, /id="storm-dial"[^>]*min="0"[^>]*max="20"/);
      assert.match(html, />Lock storm dial/);
    } else {
      assert.doesNotMatch(html, /id="storm-dial"/);
    }
    assert.doesNotMatch(html, /aria-label="Inspect Storm Card:/);
    assert.equal(own.stormForecast, null);
  }
});

void test('subsequent Advanced Storm without Fremen offers the public card and existing confirmation, not dials or forecast', () => {
  const fixture = createAdvancedSourceFixture({ storm: 'next', fremen: false });
  for (const player of fixture.game.players) {
    const own = viewGame(fixture.game, player.id);
    const html = table(own);
    assert.match(html, />Confirm storm movement/);
    assert.match(html, /aria-label="Inspect Storm Card: [1-6] sectors? · Public reveal"/);
    assert.doesNotMatch(html, /id="storm-dial"|>Lock storm dial|Waiting for secret storm dials|Your storm forecast:/);
    assert.equal(own.stormForecast, null);
  }
});

void test('later Basic Storm keeps native recorded dial controls and confirms their revealed sum rather than a card', () => {
  const fixture = createAdvancedSourceFixture({ advanced: false, storm: 'next' });
  let game = fixture.game;
  assert.equal(game.stormPending, null);
  assert.equal(game.stormDialers.length, 2);
  for (const dialer of fixture.game.stormDialers) {
    const own = viewGame(game, dialer);
    assert.match(table(own), /id="storm-dial"[^>]*min="1"[^>]*max="3"/);
    game = applyAction(game, dialer, { type: 'stormDial', amount: 2 });
  }
  for (const player of game.players) {
    const html = table(viewGame(game, player.id));
    assert.match(html, />Confirm storm movement/);
    assert.doesNotMatch(html, /id="storm-dial"|aria-label="Inspect Storm Card:/);
  }
});

void test('each ending seat sees only its own public mandatory loss warning; normal end remains available without a second prompt', () => {
  const fixture = createAdvancedSourceFixture({ alliance: 'newThisTurn' });
  const own = viewGame(fixture.game, fixture.actor);
  assert.ok(own.advancedAllySeparation?.territories.length);
  const html = table(own);
  for (const name of own.advancedAllySeparation.territories) assert.ok(html.includes(name));
  assert.match(html, /aria-describedby="advanced-ally-separation"[^>]*>Finish shipment &amp; movement/);
  assert.doesNotMatch(html, />Confirm (?:alliance|force loss)/);
  for (const player of fixture.game.players.filter(player => player.id !== fixture.actor)) {
    const other = viewGame(fixture.game, player.id);
    assert.equal(other.advancedAllySeparation, null);
    assert.doesNotMatch(table(other), /id="advanced-ally-separation"/);
  }
  const finished = applyAction(fixture.game, fixture.actor, { type: 'endMovement' });
  assert.doesNotMatch(table(viewGame(finished, fixture.actor)), /id="advanced-ally-separation"/);
});

void test('room and transport locks keep the existing end button disabled despite mandatory loss being legal', () => {
  const fixture = createAdvancedSourceFixture({ alliance: 'newThisTurn' });
  const own = viewGame(fixture.game, fixture.actor);
  assert.match(table(own, true), /disabled=""[^>]*>Finish shipment &amp; movement/);
  for (const restriction of ['paused', 'closed', 'autopilot'] as const) {
    const restricted: ComponentProps<typeof GameTable>['game'] = structuredClone(own);
    if (restriction === 'autopilot') restricted.players.find(player => player.id === own.me)!.autopilot = 'Easy';
    else restricted.roomControl = { ...DEFAULT_ROOM_CONTROL, [restriction]: true };
    assert.match(table(restricted), /disabled=""[^>]*>Finish shipment &amp; movement/);
  }
});

void test('native forecast response owns the surface and reveals a private face only to Fremen after it settles', () => {
  const fixture = createAdvancedSourceFixture({ storm: 'first', fremen: true, karama: true });
  const pending = advanceToForecast(fixture.game);
  assert.equal(pending.response?.kind, 'stormPeek');
  const counter = pending.players.find(player => player.faction !== 'fremen' && player.hand.some(card => card.effect === 'karama'));
  assert.ok(counter, 'the native deal supplies a genuine counter to pass');
  const card = counter.hand.find(card => card.effect === 'karama')!;
  assert.ok(viewGame(pending, counter.id).responseControls?.cancelCards.includes(card.id));
  for (const player of pending.players) {
    const own = viewGame(pending, player.id);
    const html = table(own);
    assert.equal(own.stormForecast, null);
    assert.doesNotMatch(html, />Confirm storm movement|>Finish shipment &amp; movement|id="advanced-ally-separation"|Your storm forecast:/);
  }
  const settled = settleAdvancedSourceResponses(pending);
  assert.ok(settled.players.find(player => player.id === counter.id)!.hand.some(held => held.id === card.id));
  assert.equal(settled.discard.some(discarded => discarded.id === card.id), false);
  for (const player of settled.players) {
    const own = viewGame(settled, player.id);
    const html = table(own);
    if (player.faction === 'fremen') {
      assert.equal(own.stormForecast, pending.stormCard);
      assert.match(html, /aria-label="Inspect Storm Card: [1-6] sectors? · Private forecast"/);
    } else {
      assert.equal(own.stormForecast, null);
      assert.doesNotMatch(html, /aria-label="Inspect Storm Card: [1-6] sectors? · Private forecast"/);
    }
  }
});

aliases.deregister();
