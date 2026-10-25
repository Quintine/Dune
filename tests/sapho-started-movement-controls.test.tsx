import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { richeseCards } from '../game/richese-cards';

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
const { JuiceOfSapho, SaphoOrderButton } = await import('../components/juice-of-sapho');

const foundSapho = richeseCards().find(card => card.effect === 'juiceOfSapho');
assert.ok(foundSapho);
const sapho = foundSapho;
type Option = NonNullable<GameView['saphoOptions']>[number];

/** Controlled owner-view override for component contracts only. The native
 * engine suite owns the started-turn producer, queue and physical card path. */
function projected(mode: 'first' | 'last' = 'first', queued = true, advanced = true): GameView {
  const lobby = createGame('SAPHOCONTROLS', newPlayer('holder', 'Sapho holder', 'atreides'), advanced);
  joinGame(lobby, newPlayer('active', 'Active Emperor', 'emperor'));
  joinGame(lobby, newPlayer('guild', 'Guild', 'guild'));
  const game = viewGame(lobby, 'holder');
  game.status = 'playing';
  game.phase = 5;
  game.active = 'active';
  game.players.find(player => player.id === game.me)!.hand = [{ ...sapho }];
  game.saphoOptions = [{ scope: 'movement', event: 'original-movement-event', mode,
    ...(queued ? { afterCurrent: 'active' } : {}) }];
  return game;
}

const panel = (game: GameView, busy = false) =>
  renderToStaticMarkup(createElement(JuiceOfSapho, { game, busy, act() {} }));

/** Invoke the real hook-free button used by JuiceOfSapho, without replacing
 * React hooks or the component's callback. */
function press(option: Option, busy = false): Action[] {
  const actions: Action[] = [];
  const button = SaphoOrderButton({ card: sapho!.id, option, busy,
    act(action) { actions.push(action); } });
  button.props.onClick();
  return actions;
}

void test('queued first and last keep their button labels and persistent named-player timing guidance', () => {
  for (const mode of ['first', 'last'] as const) {
    const game = projected(mode);
    for (let render = 0; render < 2; render++) {
      const html = panel(game);
      assert.match(html, new RegExp(`Take your movement turn ${mode} and discard Juice of Sapho`));
      assert.match(html, /Provisional queued movement order: Active Emperor finishes the current combined shipment and movement turn unchanged/);
      assert.match(html, new RegExp(`Your ${mode} position applies among later unstarted combined turns`));
      assert.match(html, /Completed turns and actual shipment and movement counters stay unchanged/);
    }
  }
});

void test('actual queued button callbacks submit exactly the existing action fields without display metadata', () => {
  for (const mode of ['first', 'last'] as const) {
    const option = projected(mode).saphoOptions[0];
    const expected: Action = { type: 'card', card: sapho.id, scope: 'movement', event: option.event, mode };
    assert.deepEqual(press(option), [expected]);
    assert.deepEqual(Object.keys(press(option)[0]).sort(), ['card', 'event', 'mode', 'scope', 'type']);
  }
});

void test('busy queued controls retain their explanation, render disabled and cannot dispatch', () => {
  const game = projected('last');
  const html = panel(game, true);
  assert.match(html, /disabled=""[^>]*>Take your movement turn last and discard Juice of Sapho/);
  assert.match(html, /Active Emperor finishes the current combined shipment and movement turn unchanged/);
  assert.deepEqual(press(game.saphoOptions[0], true), []);
});

void test('Advanced Guild timing remains at the next boundary and last remains after the Guild', () => {
  for (const mode of ['first', 'last'] as const) {
    assert.match(panel(projected(mode)), /The Advanced Guild keeps its native timing choice at the next boundary/);
    assert.match(panel(projected(mode)), /A last position still follows the Guild/);
  }
  assert.doesNotMatch(panel(projected('first', true, false)), /The Advanced Guild keeps its native timing choice/);
});

void test('clean movement options keep their existing description and exact action payload', () => {
  for (const mode of ['first', 'last'] as const) {
    const game = projected(mode, false);
    const html = panel(game);
    assert.match(html, new RegExp(`Take the ${mode} remaining combined shipment and movement turn`));
    assert.doesNotMatch(html, /Provisional queued movement order|Active Emperor finishes/);
    assert.deepEqual(press(game.saphoOptions[0]), [{ type: 'card', card: sapho.id,
      scope: 'movement', event: 'original-movement-event', mode }]);
  }
});

void test('unavailable movement guidance covers clean and queued windows without splitting turns or preparations', () => {
  const game = projected();
  game.saphoOptions = [];
  const html = panel(game);
  assert.match(html, /clean combined-turn boundaries and queuing behind a started active turn/);
  assert.match(html, /Finish pending interactions and preparations first/);
  assert.match(html, /Sapho never splits an active combined shipment and movement turn/);
  assert.match(html, /last remains after the Guild/);
  assert.doesNotMatch(html, /Take your movement turn (first|last) and discard/);
  game.players.find(player => player.id === game.me)!.hand = [];
  assert.equal(panel(game), '');
});

aliases.deregister();
