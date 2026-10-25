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

/** Projection overrides isolate real controls and policies. Native direct
 * acquisition/cost settlement belongs to the separate engine producer cases. */
function projected(source: 'karama' | 'specialKarama'): GameView {
  const fixture = createRicheseBetrayalFixture('purchase');
  const game = viewGame(fixture.game, fixture.holder);
  assert.ok(game.richeseBetrayalReaction);
  game.richeseBetrayalReaction.source = source;
  game.richeseBetrayalReaction.price = source === 'karama' ? 0 : 3;
  return game;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(NexusRicheseBetrayal, { game, busy, act() {} }));
}

function click(node: ReactNode, prefix: string): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) continue;
    if (typeof child.props.children === 'string' && child.props.children.startsWith(prefix) && child.props.onClick) {
      child.props.onClick(); return true;
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

void test('proactive ordinary Karama is an intended zero-spice acquisition with an explicit blind commitment', () => {
  const game = projected('karama');
  for (let render = 0; render < 2; render++) {
    const html = markup(game);
    assert.match(html, /before acquisition/);
    assert.match(html, /intends to acquire the concealed ordinary auction lot using ordinary Karama/);
    assert.match(html, /No spice would be paid/);
    assert.doesNotMatch(html, /\bwon\b|for 0 spice|buying its own cache card|concealed Black Market lot/);
    assert.match(html, /Provisional online rule: spend the Richese Nexus before learning whether this purchase can be stopped/);
    assert.match(html, /Otherwise your Nexus remains spent and the original purchase continues/);
    assert.match(html, /Provisional order: Betrayal resolves before Richese spends the costs of this intended acquisition/);
    assert.match(html, /intended card is discarded without acquisition and Richese keeps its unplayed activation Karama/);
    assert.match(html, /Spend Richese Nexus · attempt to stop this purchase/);
    assert.match(html, /Passing lets the declared acquisition continue/);
    assert.doesNotMatch(html, /refund|once-per-game special use remains available/);
  }
});

void test('native special purchase stays private and explains unspent Karama, three spice and once-use', () => {
  const game = projected('specialKarama');
  const html = markup(game);
  assert.match(html, /intends to acquire a privately selected Richese cache card using its native special Karama/);
  assert.match(html, /listed price is 3 spice; the chosen face remains private/);
  assert.match(html, /intended card is discarded without acquisition and Richese keeps its unplayed activation Karama/);
  assert.match(html, /three spice are not paid and its once-per-game special use remains available/);
  assert.match(html, /Use Richese Nexus · stop this private acquisition/);
  assert.doesNotMatch(html, /\bwon\b|Provisional online rule: spend|Otherwise your Nexus remains spent|refund|Emperor Nexus|joint funding/);
  game.richeseBetrayalReaction!.price = 0;
  assert.equal(markup(game), html, 'The public listed-price explanation does not identify a private funding method.');
});

void test('both actual acquisition buttons send the unchanged single Use and Pass callbacks', () => {
  for (const source of ['karama', 'specialKarama'] as const) {
    const game = projected(source), event = game.richeseBetrayalReaction!.event;
    assert.deepEqual(choose(game, source === 'karama' ? 'Spend Richese Nexus' : 'Use Richese Nexus'),
      [{ type: 'richeseBetrayalUse', event }]);
    assert.deepEqual(choose(game, 'Pass'), [{ type: 'richeseBetrayalPass', event }]);
  }
});

void test('busy and private eligibility restrictions prevent spending but preserve Pass and persistent source guidance', () => {
  for (const source of ['karama', 'specialKarama'] as const) {
    const game = projected(source), prefix = source === 'karama' ? 'Spend Richese Nexus' : 'Use Richese Nexus';
    assert.match(markup(game, true), /disabled=""[^>]*>(?:Spend|Use) Richese Nexus/);
    assert.deepEqual(choose(game, prefix, true), []);
    assert.deepEqual(choose(game, 'Pass', true), []);
    game.richeseBetrayalReaction!.blocked = 'Your accepted promise reserves this Nexus.';
    assert.match(markup(game), /accepted promise reserves this Nexus/);
    assert.match(markup(game), /Provisional order/);
    assert.deepEqual(choose(game, prefix), []);
    assert.deepEqual(choose(game, 'Pass'), [{ type: 'richeseBetrayalPass', event: game.richeseBetrayalReaction!.event }]);
    game.richeseBetrayalReaction!.blocked = null;
    game.richeseBetrayalReaction!.canUse = false;
    assert.deepEqual(choose(game, prefix), []);
    game.richeseBetrayalReaction!.hasPassed = true;
    assert.deepEqual(choose(game, 'Pass'), []);
    game.richeseBetrayalReaction!.hasPassed = false;
    game.richeseBetrayalReaction!.canPass = false;
    assert.deepEqual(choose(game, prefix), []);
    game.richeseBetrayalReaction!.canPass = true;
    game.richeseBetrayalReaction!.canUse = true;
    game.status = 'finished';
    assert.deepEqual(choose(game, prefix), []);
  }
});

void test('neither intended source reads an auction face, private cache, wallet or Nexus funding', () => {
  for (const source of ['karama', 'specialKarama'] as const) {
    const game = projected(source);
    Object.defineProperty(game, 'auction', { get() { throw new Error('unentitled ordinary face'); } });
    Object.defineProperty(game, 'richeseAuction', { get() { throw new Error('unrelated public cache lot'); } });
    for (const player of game.players)
      for (const field of ['hand', 'spice', 'richeseCache'])
        Object.defineProperty(player, field, { get() { throw new Error(`unrelated ${field}`); } });
    assert.match(markup(game), /before acquisition/);
    assert.deepEqual(choose(game, source === 'karama' ? 'Spend Richese Nexus' : 'Use Richese Nexus'),
      [{ type: 'richeseBetrayalUse', event: game.richeseBetrayalReaction!.event }]);
  }
});

void test('all profiles pass blind Karama but may use the certain special veto only through private projected eligibility', () => {
  for (const profile of DIFFICULTIES)
    for (const source of ['karama', 'specialKarama'] as const) {
      const game = projected(source), own = game.players.find(player => player.id === game.me)!;
      own.bot = profile;
      const event = game.richeseBetrayalReaction!.event;
      const expected = [{ type: source === 'karama' ? 'richeseBetrayalPass' : 'richeseBetrayalUse', event }];
      assert.deepEqual(botNexusRicheseBetrayalActions(game), expected);
      assert.deepEqual(botActions(game), expected);
      delete own.bot; own.autopilot = profile;
      assert.deepEqual(botNexusRicheseBetrayalActions(game), expected);
      game.richeseBetrayalReaction!.canUse = false;
      assert.deepEqual(botNexusRicheseBetrayalActions(game), [{ type: 'richeseBetrayalPass', event }]);
      game.richeseBetrayalReaction!.hasPassed = true;
      assert.deepEqual(botNexusRicheseBetrayalActions(game), []);
    }
});

aliases.deregister();
