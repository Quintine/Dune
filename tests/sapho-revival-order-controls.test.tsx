import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RevivalTurn, FinishRevivalTurn } from '../components/revival-turn';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { createSaphoRevivalOrderFixture, actSaphoRevivalOrder, saphoRevivalOrderAction } from './fixture-sapho-revival-order';

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
aliases.deregister();
const sapho = richeseCards().find(card => card.effect === 'juiceOfSapho'); assert.ok(sapho);
type Option = NonNullable<GameView['saphoOptions']>[number];

// Controlled public order/entitled-card projections supplement the native
// producer below. They install no authoritative queue, card custody or outcome.
// React renders the stateful panel; only actual hook-free buttons are invoked.
function projected(mode: 'first' | 'last' = 'first', queued = false): GameView {
  const source = createGame('SAPHOREVIVALCONTROLS', newPlayer('holder', 'Sapho holder', 'atreides'), true, ['choam']);
  joinGame(source, newPlayer('active', 'Active Emperor', 'emperor'));
  joinGame(source, newPlayer('early', 'Earlier Richese', 'richese'));
  joinGame(source, newPlayer('late', 'Later Guild', 'guild'));
  const game = viewGame(source, 'holder');
  game.status = 'playing'; game.phase = 4; game.turn = 2; game.active = 'active';
  game.players.find(player => player.id === game.me)!.hand = [{ ...sapho! }];
  const order = ['active', 'early', 'holder', 'late'];
  game.revivalOrder = { version: 1, turn: 2, original: order, remaining: [...order], completed: [], started: queued };
  game.revival.orderBlocked = 'Wait for Active Emperor to finish their Revival turn.';
  game.saphoOptions = [{ scope: 'revival', event: 'controlled-revival-order-event', mode,
    ...(queued ? { afterCurrent: 'active' } : {}) }];
  return game;
}
function panel(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(JuiceOfSapho, { game, busy, act() {} }));
}
function revival(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(RevivalTurn, { game, busy, act() {} }));
}
function press(option: Option, busy = false, card = sapho!.id): Action[] {
  const actions: Action[] = [];
  SaphoOrderButton({ card, option, busy, act(action) { actions.push(action); } }).props.onClick();
  return actions;
}

void test('clean first and last Revival choices use their own labels and preserve completed-turn guidance', () => {
  for (const mode of ['first', 'last'] as const) {
    const game = projected(mode), before = structuredClone(game);
    for (let render = 0; render < 2; render++) {
      const html = panel(game);
      assert.match(html, new RegExp(`Take your Revival turn ${mode} and discard Juice of Sapho`));
      assert.match(html, new RegExp(`Take the ${mode} remaining Revival turn`));
      assert.match(html, /Completed Revival turns stay finished/);
      assert.match(html, /without granting another revival, resetting allowances or returning completed players to the queue/);
      assert.doesNotMatch(html, /Provisional queued Revival order|Take your movement turn (first|last) and discard/);
    }
    assert.deepEqual(game, before);
  }
});

void test('queued first and last persistently name the started actor and label later-tail timing provisional', () => {
  for (const mode of ['first', 'last'] as const) {
    const game = projected(mode, true);
    for (let render = 0; render < 2; render++) {
      const html = panel(game);
      assert.match(html, /aria-label="Provisional queued Revival order"/);
      assert.match(html, /Active Emperor finishes the current Revival turn unchanged/);
      assert.match(html, new RegExp(`Your ${mode} position applies among later unstarted Revival turns`));
      assert.match(html, /Completed turns, returned pieces, payments and revival allowances stay unchanged/);
      assert.doesNotMatch(html, /Provisional queued movement order|combined shipment and movement turn unchanged/);
    }
  }
});

void test('actual clean and queued callbacks send only the original five action fields and busy cannot dispatch', () => {
  for (const queued of [false, true]) for (const mode of ['first', 'last'] as const) {
    const option = projected(mode, queued).saphoOptions[0];
    const expected: Action = { type: 'card', card: sapho!.id, scope: 'revival', event: option.event, mode };
    assert.deepEqual(press(option), [expected]);
    assert.deepEqual(Object.keys(press(option)[0]).sort(), ['card', 'event', 'mode', 'scope', 'type']);
    assert.deepEqual(press(option, true), []);
    assert.match(panel(projected(mode, queued), true), new RegExp(`disabled=""[^>]*>Take your Revival turn ${mode} and discard Juice of Sapho`));
  }
});

void test('Basic unstamped and completed controlled views offer no Revival order button even with stale projected options', () => {
  const basic = projected(); basic.advanced = false; basic.revivalOrder = null;
  const legacy = projected(); legacy.revivalOrder = null;
  const complete = projected(); complete.revivalOrder!.completed = ['holder'];
  complete.revivalOrder!.remaining = ['active', 'early', 'late'];
  for (const game of [basic, legacy, complete]) {
    const html = panel(game);
    assert.doesNotMatch(html, /Take your Revival turn (first|last) and discard/);
    assert.match(html, /existing timing|Completed turns stay finished/);
  }
  assert.equal(revival(basic), ''); assert.equal(revival(legacy), '');
  const absent = projected(); absent.players.find(player => player.id === absent.me)!.hand = [];
  assert.equal(panel(absent), '');
});

void test('unavailable ordered Revival guidance keeps completed turns and the current started actor intact', () => {
  const game = projected(); game.saphoOptions = [];
  const html = panel(game);
  assert.match(html, /only among remaining unstarted Revival turns/);
  assert.match(html, /A player who has started finishes their Revival choices unchanged/);
  assert.match(html, /already-held positions and committed cards are unavailable/);
  assert.match(revival(game), /Juice of Sapho may change the remaining order; completed Revival turns stay finished/);
});

void test('existing movement and auction buttons keep their original scope labels and payloads', () => {
  const game = projected();
  for (const option of [
    { scope: 'movement', event: 'original-movement', mode: 'first' },
    { scope: 'onceAround', event: 'original-auction', mode: 'last' },
  ] as const) {
    game.saphoOptions = [option];
    assert.deepEqual(press(option), [{ type: 'card', card: sapho!.id, ...option }]);
    assert.match(panel(game), option.scope === 'movement'
      ? /Take your movement turn first and discard Juice of Sapho/
      : /Bid last and discard Juice of Sapho/);
  }
});

void test('Revival controls do not inspect raw order history rival hands or private return stocks', () => {
  const game = projected('last', true);
  Object.defineProperty(game.revivalOrder!, 'uses', { get() { throw Error('Controls inspected raw Sapho history'); } });
  for (const player of game.players) {
    const fields = ['traitors', 'faceDancers', 'spice', 'reserves', 'leaders', 'forces', 'tanks', ...(player.id === game.me ? [] : ['hand'])];
    for (const field of fields)
      Object.defineProperty(player, field, { get() { throw Error(`Controls inspected private ${player.id}.${field}`); } });
  }
  assert.match(panel(game), /Provisional queued Revival order/);
  assert.match(revival(game), /Current Revival actor: Active Emperor/);
  assert.deepEqual(press(game.saphoOptions[0]), [{ type: 'card', card: sapho!.id,
    scope: 'revival', event: 'controlled-revival-order-event', mode: 'last' }]);
});

const nativeSources = new Map<boolean, ReturnType<typeof createSaphoRevivalOrderFixture>>();
function native(started: boolean) {
  let source = nativeSources.get(started);
  if (!source) { source = createSaphoRevivalOrderFixture({ started }); nativeSources.set(started, source); }
  return { ...source, game: structuredClone(source.game) };
}

void test('earned native clean and queued first/last options render and their actual button actions apply the same selected scope', () => {
  for (const started of [false, true]) for (const mode of ['first', 'last'] as const) {
    const source = native(started), game = viewGame(source.game, source.owner);
    const card = game.players.find(player => player.id === source.owner)!.hand!.find(candidate => candidate.id === source.card);
    assert.ok(card);
    const option = game.saphoOptions.find(candidate => candidate.scope === 'revival' && candidate.mode === mode);
    assert.ok(option?.scope === 'revival');
    const html = panel(game);
    assert.match(html, new RegExp(`Take your Revival turn ${mode} and discard Juice of Sapho`));
    if (started) {
      assert.equal(option.afterCurrent, source.current);
      const currentName = game.players.find(player => player.id === source.current)!.name;
      assert.ok(html.includes(`${currentName} finishes the current Revival turn unchanged`));
      assert.match(html, /Provisional queued Revival order/);
    } else {
      assert.equal(option.afterCurrent, undefined);
      assert.doesNotMatch(html, /Provisional queued Revival order/);
    }
    const sent = press(option, false, card.id);
    assert.deepEqual(sent, [saphoRevivalOrderAction(source.game, mode, source.owner)]);
    assert.deepEqual(press(option, true, card.id), []);
    const priorCompleted = [...source.game.revivalOrder!.completed];
    const after = actSaphoRevivalOrder(source.game, source.owner, sent[0]);
    assert.equal(after.revivalOrder!.version, 2);
    assert.deepEqual(after.revivalOrder!.completed, priorCompleted);
    if (started) assert.equal(after.active, source.current);
    else if (mode === 'first') assert.equal(after.active, source.owner);
  }
});

void test('actual v2 Revival views preserve remaining/completed display and permit only the current Finish callback', () => {
  for (const started of [false, true]) for (const mode of ['first', 'last'] as const) {
    const source = native(started);
    const after = actSaphoRevivalOrder(source.game, source.owner, saphoRevivalOrderAction(source.game, mode, source.owner));
    const actor = after.revivalOrder!.remaining[0], game = viewGame(after, actor), sent: Action[] = [];
    assert.equal(game.revivalOrder!.version, 2);
    Object.defineProperty(game.revivalOrder!, 'uses', { get() { throw Error('Revival display inspected validated order history'); } });
    const html = revival(game);
    assert.match(html, /Remaining Revival turns:/);
    assert.match(html, /Completed Revival turns:/);
    assert.match(html, /Juice of Sapho may change the remaining order/);
    const leaf = FinishRevivalTurn({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(leaf.props.disabled, false);
    FinishRevivalTurn({ game, busy: true, act(action) { sent.push(action); } }).props.onClick();
    assert.deepEqual(sent, []);
    leaf.props.onClick(); assert.deepEqual(sent, [{ type: 'ready' }]);
    const next = actSaphoRevivalOrder(after, actor, sent[0]);
    assert.ok(next.revivalOrder!.completed.includes(actor));
    const completed = viewGame(next, actor), rejected: Action[] = [];
    const finished = FinishRevivalTurn({ game: completed, busy: false, act(action) { rejected.push(action); } });
    assert.equal(finished.props.disabled, true); finished.props.onClick();
    assert.deepEqual(rejected, []);
    assert.match(revival(completed), /Your Revival turn is finished/);
  }
});
