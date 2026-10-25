import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type GameView } from '../game/engine';
import { botNexusRicheseBetrayalActions } from '../game/bot-nexus-richese-betrayal';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createRicheseBetrayalFixture } from './fixture-richese-betrayal';

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
const { NexusRicheseBetrayal } = await import('../components/nexus-richese-betrayal');

/** A normal-source view override isolates the connected controls and policy
 * consumers. The engine suite supplies the actual ordinary purchase producer. */
function projected(): GameView {
  const fixture = createRicheseBetrayalFixture('purchase');
  const game = viewGame(fixture.game, fixture.holder);
  assert.ok(game.richeseBetrayalReaction);
  game.richeseBetrayalReaction.source = 'normal';
  return game;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(NexusRicheseBetrayal, { game, busy, act() {} }));
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

function choose(game: GameView, prefix: string, busy = false): Action[] {
  const actions: Action[] = [];
  click(NexusRicheseBetrayal({ game, busy, act(action) { actions.push(action); } }), prefix);
  return actions;
}

void test('ordinary concealed purchases explain both outcomes and the provisional spend-first cost persistently', () => {
  const game = projected();
  for (let render = 0; render < 2; render++) {
    const html = markup(game);
    assert.match(html, /concealed ordinary auction lot/);
    assert.match(html, /does not disclose the card’s family or grant inspection before you spend/);
    assert.match(html, /Provisional online rule: spend the Richese Nexus before learning whether this purchase can be stopped/);
    assert.match(html, /If it is a Richese card, that card is discarded without payment or delivery/);
    assert.match(html, /Otherwise your Nexus remains spent and the original purchase continues/);
    assert.match(html, /Spend Richese Nexus · attempt to stop this purchase/);
    assert.match(html, /Pass · allow the original purchase/);
    assert.doesNotMatch(html, /public cache lot|buying its own cache card|concealed Black Market lot/);
  }
});

void test('actual normal-source Spend and Pass callbacks send one unchanged event-bound action', () => {
  const game = projected(), event = game.richeseBetrayalReaction!.event;
  assert.deepEqual(choose(game, 'Spend Richese Nexus'), [{ type: 'richeseBetrayalUse', event }]);
  assert.deepEqual(choose(game, 'Pass'), [{ type: 'richeseBetrayalPass', event }]);
});

void test('busy, blocked, passed and unentitled normal controls cannot commit the blind cost', () => {
  const game = projected(), event = game.richeseBetrayalReaction!.event;
  assert.match(markup(game, true), /disabled=""[^>]*>Spend Richese Nexus/);
  assert.match(markup(game, true), /disabled=""[^>]*>Pass/);
  assert.deepEqual(choose(game, 'Spend Richese Nexus', true), []);
  assert.deepEqual(choose(game, 'Pass', true), []);
  game.richeseBetrayalReaction!.blocked = 'Your accepted promise reserves this Nexus card.';
  assert.match(markup(game), /accepted promise reserves this Nexus card/);
  assert.match(markup(game), /Provisional online rule/);
  assert.deepEqual(choose(game, 'Spend Richese Nexus'), []);
  assert.deepEqual(choose(game, 'Pass'), [{ type: 'richeseBetrayalPass', event }]);
  game.richeseBetrayalReaction!.blocked = null;
  game.richeseBetrayalReaction!.canUse = false;
  assert.deepEqual(choose(game, 'Spend Richese Nexus'), []);
  game.richeseBetrayalReaction!.canUse = true;
  game.richeseBetrayalReaction!.hasPassed = true;
  assert.match(markup(game), /You have passed/);
  assert.deepEqual(choose(game, 'Spend Richese Nexus'), []);
  assert.deepEqual(choose(game, 'Pass'), []);
  game.richeseBetrayalReaction!.hasPassed = false;
  game.richeseBetrayalReaction!.canPass = false;
  assert.deepEqual(choose(game, 'Spend Richese Nexus'), []);
  game.richeseBetrayalReaction!.canPass = true;
  game.status = 'finished';
  assert.deepEqual(choose(game, 'Spend Richese Nexus'), []);
  assert.deepEqual(choose(game, 'Pass'), []);
});

void test('the ordinary response never reads a face or rival resources to infer the hidden card family', () => {
  const game = projected();
  Object.defineProperty(game, 'richeseAuction', { get() { throw new Error('public cache is unrelated to this ordinary purchase'); } });
  Object.defineProperty(game, 'auction', { get() { throw new Error('ordinary face is not response entitlement'); } });
  for (const player of game.players)
    for (const field of ['hand', 'spice'])
      Object.defineProperty(player, field, { get() { throw new Error(`unrelated ${field}`); } });
  assert.match(markup(game), /concealed ordinary auction lot/);
  assert.deepEqual(choose(game, 'Spend Richese Nexus'), [{ type: 'richeseBetrayalUse', event: game.richeseBetrayalReaction!.event }]);
});

void test('every bot profile and autopilot passes a blind ordinary purchase even when Use is offered', () => {
  for (const profile of DIFFICULTIES) {
    const game = projected(), own = game.players.find(player => player.id === game.me)!;
    own.bot = profile;
    assert.equal(game.richeseBetrayalReaction!.canUse, true);
    const expected = [{ type: 'richeseBetrayalPass', event: game.richeseBetrayalReaction!.event }];
    assert.deepEqual(botNexusRicheseBetrayalActions(game), expected);
    assert.deepEqual(botActions(game), expected);
    delete own.bot;
    own.autopilot = profile;
    assert.deepEqual(botNexusRicheseBetrayalActions(game), expected);
  }
});

void test('minimal bot responses still obey current acknowledgement eligibility and preserve old-source Use', () => {
  const game = projected(), own = game.players.find(player => player.id === game.me)!;
  assert.deepEqual(botNexusRicheseBetrayalActions(game), []);
  own.bot = 'Easy';
  game.richeseBetrayalReaction!.hasPassed = true;
  assert.deepEqual(botNexusRicheseBetrayalActions(game), []);
  game.richeseBetrayalReaction!.hasPassed = false;
  game.richeseBetrayalReaction!.canPass = false;
  assert.deepEqual(botNexusRicheseBetrayalActions(game), []);
  for (const kind of ['purchase', 'sale'] as const) {
    const fixture = createRicheseBetrayalFixture(kind);
    const old = viewGame(fixture.game, fixture.holder);
    old.players.find(player => player.id === old.me)!.bot = 'Easy';
    assert.deepEqual(botNexusRicheseBetrayalActions(old), [{ type: 'richeseBetrayalUse', event: old.richeseBetrayalReaction!.event }]);
    assert.match(markup(old), /Use Richese Nexus/);
    assert.doesNotMatch(markup(old), /Provisional online rule: spend the Richese Nexus/);
    assert.match(markup(old), kind === 'purchase' ? /public cache lot/ : /concealed Black Market lot/);
  }
});

aliases.deregister();
