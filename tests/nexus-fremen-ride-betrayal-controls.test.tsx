import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NexusFremenRideBetrayal } from '../components/nexus-fremen-ride-betrayal';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';

type Source = NonNullable<GameView['nexusFremenRideBetrayal']>['source'];
// Controlled projection fixtures isolate the actual hook-free callbacks. The
// separate native source suite earns and restores the worm/Cunning/Maker ride;
// these controls tests install no played Game custody or pending decision.
function projected(kind: Source['kind'] = 'wormRide'): GameView {
  const game = createGame('NEXUSFREMENRIDECONTROLS', newPlayer('a', 'Atreides', 'atreides'), false);
  joinGame(game, newPlayer('f', 'Fremen', 'fremen'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  const view = viewGame(game, 'a'); view.status = 'playing'; view.phase = 1;
  const source: Source = kind === 'wormRide'
    ? { kind, player: 'f', territory: 'hagga_basin' }
    : { kind, player: 'f', event: 'controlled-original-ride-event' };
  view.nexusFremenRideBetrayal = {
    event: 'controlled-before-ride-event', player: 'a', source, canUse: true, passed: [],
  };
  return view;
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(NexusFremenRideBetrayal, { game, busy, act() {} }));
}
function click(node: ReactNode, choice: 'continue' | 'prevent'): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{
      children?: ReactNode; onClick?: () => void; 'data-testid'?: string;
    }>(child)) continue;
    if (child.props['data-testid'] === `nexus-fremen-ride-${choice}` && child.props.onClick) {
      child.props.onClick(); return true;
    }
    if (click(child.props.children, choice)) return true;
  }
  return false;
}
function choose(game: GameView, choice: 'continue' | 'prevent', busy = false): Action[] {
  const actions: Action[] = [];
  click(NexusFremenRideBetrayal({ game, busy, act(action) { actions.push(action); } }), choice);
  return actions;
}

void test('the current responder sends exact before-ride Continue and prevention actions for all three sources', () => {
  for (const kind of ['wormRide', 'nexusFremenCunningRide', 'greatMakerRide'] as const) {
    const game = projected(kind), event = game.nexusFremenRideBetrayal!.event;
    assert.deepEqual(choose(game, 'continue'), [{ type: 'decision', event, use: false }]);
    assert.deepEqual(choose(game, 'prevent'), [{ type: 'decision', event, use: true }]);
    assert.equal(Object.keys(choose(game, 'prevent')[0]).sort().join(','), 'event,type,use');
    assert.doesNotMatch(markup(game), /controlled-original-ride-event/);
  }
});

void test('the neutral panel names each public ride source without a secret card face', () => {
  assert.match(markup(projected()), /Fremen has a worm ride from Hagga Basin waiting/);
  assert.match(markup(projected('nexusFremenCunningRide')), /Fremen has a Fremen Nexus Cunning ride waiting/);
  assert.match(markup(projected('greatMakerRide')), /Fremen has a Great Maker ride waiting/);
  assert.match(markup(projected()), /aria-label="Fremen Nexus before-ride Betrayal"/);
});

void test('a projected no-Use responder still has the actual Continue callback', () => {
  const game = projected(); game.nexusFremenRideBetrayal!.canUse = false;
  const html = markup(game);
  assert.match(html, /Continue · allow rides/); assert.doesNotMatch(html, /data-testid="nexus-fremen-ride-prevent"/);
  assert.deepEqual(choose(game, 'continue'), [{ type: 'decision', event: 'controlled-before-ride-event', use: false }]);
  assert.deepEqual(choose(game, 'prevent'), []);
  assert.match(html, /without revealing anyone’s secret Nexus identity/);
});

void test('waiting and already-passed viewers retain the public guide without another response button', () => {
  const waiting = projected(); waiting.me = 'g';
  assert.match(markup(waiting), /Waiting for Atreides to respond before the ride/);
  assert.doesNotMatch(markup(waiting), /<button\b/);
  assert.deepEqual(choose(waiting, 'continue'), []); assert.deepEqual(choose(waiting, 'prevent'), []);
  const passed = projected(); passed.nexusFremenRideBetrayal!.passed = ['a'];
  assert.match(markup(passed), /You have continued. Waiting for the remaining ride responses/);
  assert.match(markup(passed), /prevent the remaining rides this turn/);
  assert.doesNotMatch(markup(passed), /<button\b/);
  assert.deepEqual(choose(passed, 'continue'), []); assert.deepEqual(choose(passed, 'prevent'), []);
});

void test('busy and finished views guard both actual callbacks without removing the explanation', () => {
  const game = projected();
  assert.deepEqual(choose(game, 'continue', true), []); assert.deepEqual(choose(game, 'prevent', true), []);
  assert.equal((markup(game, true).match(/<button\b[^>]*\sdisabled=""/g) ?? []).length, 2);
  assert.match(markup(game, true), /The worm, Spice Blow and any Nexus that have already resolved stay resolved/);
  game.status = 'finished';
  assert.deepEqual(choose(game, 'continue'), []); assert.deepEqual(choose(game, 'prevent'), []);
});

void test('the persistent guide preserves completed effects and describes prevention without moving forces or replaying payment', () => {
  const game = projected();
  for (let render = 0; render < 3; render++) {
    const html = markup(game);
    assert.match(html, /Continue to allow the original ride choices/);
    assert.match(html, /prevent the remaining rides this turn/);
    assert.match(html, /The worm, Spice Blow and any Nexus that have already resolved stay resolved/);
    assert.match(html, /Prevention does not move or destroy forces/);
    assert.match(html, /Previous payments and effects are not repeated/);
    assert.doesNotMatch(html, /countdown|automatically continue|seconds remaining|Confirm|Acknowledge/);
  }
});

void test('a missing reaction renders nothing and private hands or wallets cannot determine Use', () => {
  const absent = projected(); absent.nexusFremenRideBetrayal = null;
  assert.equal(markup(absent), ''); assert.deepEqual(choose(absent, 'continue'), []);
  const game = projected();
  Object.defineProperty(game, 'nexusCards', { get() { throw Error('The response control inspected a private Nexus face'); } });
  for (const player of game.players) for (const field of ['hand', 'spice', 'forces', 'elites', 'traitors'])
    Object.defineProperty(player, field, { get() { throw Error(`The response control read ${field}`); } });
  assert.match(markup(game), /Use Fremen Nexus · prevent remaining rides/);
  assert.deepEqual(choose(game, 'prevent'), [{ type: 'decision', event: 'controlled-before-ride-event', use: true }]);
});
