import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame } from '../game/engine';
import type { Action, GameView } from '../game/engine';
import { tableActionOwner } from '../game/table-turn';
import { DEFAULT_ROOM_CONTROL } from '../lib/room-control';
import { createIxianNexusReplacementFixture, settleIxianReplacementFixture } from './fixture-nexus-ixian-replacement';

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
// UI modules need the Next/CSS test-loader boundary registered above;
// static imports would resolve those modules before their platform shims.
const { NexusIxianReplacement } = await import('../components/nexus-ixian-replacement');
const { GameTable } = await import('../components/game-table');

function click(node: ReactNode, selector: string): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void; 'data-testid'?: string }>(child)) continue;
    if (child.props['data-testid'] === selector && child.props.onClick) {
      child.props.onClick();
      return true;
    }
    if (click(child.props.children, selector)) return true;
  }
  return false;
}
function select(game: GameView, choice: 'use' | 'pass', busy = false): Action | undefined {
  let action: Action | undefined;
  click(NexusIxianReplacement({ game, busy, act(value) { action = value; } }), `nexus-ixian-replacement-${choice}`);
  return action;
}
function markup(game: GameView): string {
  return renderToStaticMarkup(createElement(NexusIxianReplacement, { game, busy: false, act() {} }));
}
function table(game: GameView, busy = false): string {
  return renderToStaticMarkup(createElement(GameTable, { game, busy, send: async () => {}, onExit() {} }));
}

void test('only the buyer sees the purchased face and eligibility; wrong-face buyers can keep without an Ixian inspector', () => {
  const fixture = createIxianNexusReplacementFixture();
  const own = viewGame(fixture.game, fixture.buyer);
  assert.match(markup(own), /aria-label="Your purchased Treachery Card"/);
  assert.match(markup(own), /aria-label="Inspect Ixians Nexus card"/);
  const use = select(own, 'use');
  assert.ok(use);
  const used = applyAction(fixture.game, fixture.buyer, use);
  assert.equal(viewGame(used, fixture.buyer).nexusIxianReplacement, null);
  assert.equal(used.nexusCards?.cards?.hands[fixture.buyer], null);
  assert.equal(used.players.find(player => player.id === fixture.buyer)!.hand.length,
    fixture.game.players.find(player => player.id === fixture.buyer)!.hand.length);
  for (const rival of fixture.game.players.filter(player => player.id !== fixture.buyer)) {
    const view = viewGame(fixture.game, rival.id);
    assert.equal(view.nexusIxianReplacement!.purchased, null);
    assert.equal(view.nexusIxianReplacement!.blocked, null);
    assert.equal(select(view, 'use'), undefined);
    assert.equal(select(view, 'pass'), undefined);
    assert.doesNotMatch(markup(view), /aria-label="Your purchased Treachery Card"/);
    if (view.nexusCards?.card !== 'ixians') assert.doesNotMatch(markup(view), /aria-label="Inspect Ixians Nexus card"/);
    assert.equal(tableActionOwner(view), fixture.buyer);
  }
  const irrelevant = createIxianNexusReplacementFixture({ face: 'richese' });
  const neutral = viewGame(irrelevant.game, irrelevant.buyer);
  assert.equal(select(neutral, 'use'), undefined);
  assert.doesNotMatch(markup(neutral), /aria-label="Inspect Ixians Nexus card"/);
  const keep = select(neutral, 'pass');
  assert.ok(keep);
  const kept = applyAction(irrelevant.game, irrelevant.buyer, keep);
  assert.ok(kept.players.find(player => player.id === irrelevant.buyer)!.hand.some(card => card.id === irrelevant.purchased.id));
  assert.equal(kept.nexusCards?.cards?.hands[irrelevant.buyer], 'richese');
});

void test('paid and printed Karama human choices resume the native sale once; saved events cannot buy or draw again', () => {
  for (const advanced of [false, true]) for (const karama of [false, true]) for (const choice of ['use', 'pass'] as const) {
    const fixture = createIxianNexusReplacementFixture({ advanced, karama, endingAuction: true });
    const action = select(viewGame(fixture.game, fixture.buyer), choice);
    assert.ok(action);
    const result = settleIxianReplacementFixture(applyAction(fixture.game, fixture.buyer, action));
    const pass = select(viewGame(fixture.game, fixture.buyer), 'pass');
    assert.ok(pass);
    const original = settleIxianReplacementFixture(applyAction(fixture.game, fixture.buyer, pass));
    assert.equal(viewGame(result, fixture.buyer).nexusIxianReplacement, null);
    assert.deepEqual(result.players.map(player => ({ id: player.id, spice: player.spice })),
      original.players.map(player => ({ id: player.id, spice: player.spice })));
    assert.equal(result.phase, original.phase);
    assert.equal(result.auction?.index, original.auction?.index);
    assert.equal(result.auction, null);
    if (choice === 'pass') assert.ok(result.players.find(player => player.id === fixture.buyer)!.hand.some(card => card.id === fixture.purchased.id));
    const saved = JSON.parse(JSON.stringify(result));
    const before = JSON.stringify(saved);
    assert.throws(() => applyAction(saved, fixture.buyer, action));
    assert.equal(JSON.stringify(saved), before);
    assert.equal(select(viewGame(saved, fixture.buyer), choice), undefined);
    assert.doesNotMatch(table(viewGame(saved, fixture.buyer)), /data-testid="nexus-ixian-replacement"/);
  }
});

void test('pending purchase reserves actual table controls and respects busy, room and delegation locks', () => {
  const fixture = createIxianNexusReplacementFixture();
  const own: GameView = viewGame(fixture.game, fixture.buyer);
  assert.equal(tableActionOwner(own), fixture.buyer);
  const html = table(own);
  assert.match(html, /data-testid="nexus-ixian-replacement"/);
  assert.doesNotMatch(html, /<button[^>]*>[^<]*(?:Bid |Place bid|Play Karama|Make a bribe|Pledge|Search)/i);
  assert.match(html, /aria-label="Inspect Ixians Nexus card"/);
  for (const restriction of ['paused', 'closed', 'autopilot', 'busy'] as const) {
    const restricted = structuredClone(own);
    if (restriction === 'autopilot') restricted.players.find(player => player.id === own.me)!.autopilot = 'Easy';
    else if (restriction !== 'busy') restricted.roomControl = { ...DEFAULT_ROOM_CONTROL, [restriction]: true };
    for (const choice of ['use', 'pass'] as const) {
      assert.equal(select(restricted, choice, restriction === 'busy'), undefined);
    }
  }
  const blocked = structuredClone(own);
  blocked.nexusIxianReplacement!.blocked = 'The purchased card is no longer reserved.';
  assert.equal(select(blocked, 'use'), undefined);
  assert.ok(select(blocked, 'pass'));
  const stopped = structuredClone(own);
  stopped.status = 'finished';
  assert.equal(select(stopped, 'use'), undefined);
  assert.equal(select(stopped, 'pass'), undefined);
});

aliases.deregister();
