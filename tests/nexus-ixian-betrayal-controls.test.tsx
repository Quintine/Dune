import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame } from '../game/engine';
import type { Action, Game, GameView } from '../game/engine';
import { tableActionOwner } from '../game/table-turn';
import { DEFAULT_ROOM_CONTROL } from '../lib/room-control';
import { createIxianNexusBetrayalFixture } from './fixture-nexus-ixian-betrayal';

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
// Static UI imports would resolve before these Node-only Next/CSS hooks are
// installed; these imports intentionally exercise the platform loading boundary.
const { NexusIxianBetrayal } = await import('../components/nexus-ixian-betrayal');
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
  click(NexusIxianBetrayal({ game, busy, act(value) { action = value; } }), `nexus-ixian-betrayal-${choice}`);
  return action;
}
function markup(game: GameView): string {
  return renderToStaticMarkup(createElement(NexusIxianBetrayal, { game, busy: false, act() {} }));
}
function table(game: GameView, busy = false): string {
  return renderToStaticMarkup(createElement(GameTable, { game, busy, send: async () => {}, onExit() {} }));
}
function passAll(original: Game): Game {
  let game = structuredClone(original);
  for (const seat of game.players) {
    const action = select(viewGame(game, seat.id), 'pass');
    if (action) game = applyAction(game, seat.id, action);
  }
  return game;
}
const scenarios = [
  { kind: 'bidding', advanced: false },
  { kind: 'bidding', advanced: true },
  { kind: 'technology', advanced: true },
] as const;

for (const scenario of scenarios) {
  void test(`${scenario.advanced ? 'Advanced' : 'Basic'} ${scenario.kind} human Use closes exactly the native advantage; Pass resumes it`, () => {
    const fixture = createIxianNexusBetrayalFixture(scenario);
    const own = viewGame(fixture.game, fixture.holder);
    const action = select(own, 'use');
    assert.deepEqual(action, { type: 'nexusIxianBetrayalUse', event: fixture.event });
    assert.ok(action);
    const denied = applyAction(fixture.game, fixture.holder, action);
    const allowed = passAll(fixture.game);
    assert.equal(viewGame(denied, fixture.holder).nexusIxianBetrayalReaction, null);
    assert.equal(viewGame(allowed, fixture.holder).nexusIxianBetrayalReaction, null);
    assert.equal(denied.nexusCards!.cards!.hands[fixture.holder], null);
    assert.equal(allowed.nexusCards!.cards!.hands[fixture.holder], 'ixians');
    assert.deepEqual(denied.players.map(seat => ({ id: seat.id, spice: seat.spice, forces: seat.forces, reserves: seat.reserves })),
      allowed.players.map(seat => ({ id: seat.id, spice: seat.spice, forces: seat.forces, reserves: seat.reserves })));
    if (scenario.kind === 'bidding') {
      assert.equal(denied.ixAuction, null);
      assert.equal(denied.auction!.cards.length, fixture.nativeCount);
      assert.equal(allowed.decision?.kind, 'ixAuction');
      assert.equal(allowed.ixAuction!.cards.length, fixture.nativeCount + 1);
    } else {
      assert.ok(fixture.selected);
      const nativeBefore = fixture.game.players.find(seat => seat.id === fixture.provider)!;
      assert.deepEqual(denied.players.find(seat => seat.id === fixture.provider)!.hand, nativeBefore.hand);
      assert.deepEqual(denied.auction!.cards, fixture.game.auction!.cards);
      assert.equal(allowed.players.find(seat => seat.id === fixture.provider)!.hand.some(card => card.id === fixture.selected!.id), false);
      assert.equal(allowed.auction!.cards[allowed.auction!.index].id, fixture.selected.id);
      assert.equal(denied.ixTechnologyTurn, fixture.game.turn);
      assert.equal(allowed.ixTechnologyTurn, fixture.game.turn);
    }
    assert.equal(select(viewGame(denied, fixture.holder), 'use'), undefined);
    assert.doesNotMatch(table(viewGame(denied, fixture.holder)), /data-testid="nexus-ixian-betrayal"/);
    const before = JSON.stringify(denied);
    assert.throws(() => applyAction(denied, fixture.holder, action));
    assert.equal(JSON.stringify(denied), before);
  });
}

void test('irrelevant held faces receive the same public acknowledgement without a private Ixian inspector or rival Use', () => {
  for (const scenario of scenarios) {
    const fixture = createIxianNexusBetrayalFixture(scenario);
    const irrelevant = createIxianNexusBetrayalFixture({ ...scenario, face: 'richese' });
    const own = viewGame(fixture.game, fixture.holder);
    const neutral = viewGame(irrelevant.game, irrelevant.holder);
    assert.match(markup(own), /aria-label="Inspect Ixians Nexus card"/);
    assert.ok(select(own, 'use'));
    assert.ok(select(neutral, 'pass'));
    assert.equal(select(neutral, 'use'), undefined);
    assert.doesNotMatch(markup(neutral), /Inspect Ixians Nexus card|Betrayal timing and preview limits/);
    for (const seat of fixture.game.players.filter(seat => seat.id !== fixture.holder)) {
      const rival = viewGame(fixture.game, seat.id);
      assert.equal(select(rival, 'use'), undefined);
      assert.doesNotMatch(markup(rival), /Inspect Ixians Nexus card/);
      assert.equal(rival.nexusIxianBetrayalReaction!.blocked, null);
    }
    const publicOffer = (view: GameView) => {
      const reaction = view.nexusIxianBetrayalReaction!;
      return { event: reaction.event, kind: reaction.kind, provider: reaction.provider, canPass: reaction.canPass, hasPassed: reaction.hasPassed };
    };
    assert.deepEqual(publicOffer(own), publicOffer(neutral));
    assert.doesNotMatch(markup(own), /Inspect Treachery|Your purchased Treachery|private auction card/);
  }
});

void test('multiple public responders have no owner until only one acknowledgement remains', () => {
  const fixture = createIxianNexusBetrayalFixture({ receiverCount: 2 });
  for (const seat of fixture.game.players) assert.equal(tableActionOwner(viewGame(fixture.game, seat.id)), null);
  const first = fixture.required[0];
  const action = select(viewGame(fixture.game, first), 'pass');
  assert.ok(action);
  const next = applyAction(fixture.game, first, action);
  for (const seat of next.players) assert.equal(tableActionOwner(viewGame(next, seat.id)), fixture.required[1]);
  assert.equal(select(viewGame(next, first), 'pass'), undefined);
  assert.equal(select(viewGame(next, first), 'use'), undefined);
});

void test('actual table reserves bids and voluntary card mutations; transport, room and autopilot locks stop response dispatch', () => {
  for (const scenario of scenarios) {
    const fixture = createIxianNexusBetrayalFixture(scenario);
    const own: GameView = viewGame(fixture.game, fixture.holder);
    const html = table(own);
    assert.match(html, /data-testid="nexus-ixian-betrayal"/);
    assert.doesNotMatch(html, /<button[^>]*>[^<]*(?:Bid |Place bid|Play Karama|Make a bribe|Pledge|Search)/i);
    for (const restriction of ['paused', 'closed', 'autopilot', 'busy'] as const) {
      const blocked = structuredClone(own);
      if (restriction === 'autopilot') blocked.players.find(seat => seat.id === own.me)!.autopilot = 'Easy';
      else if (restriction !== 'busy') blocked.roomControl = { ...DEFAULT_ROOM_CONTROL, [restriction]: true };
      for (const choice of ['use', 'pass'] as const) assert.equal(select(blocked, choice, restriction === 'busy'), undefined);
    }
    const blocked = structuredClone(own);
    blocked.nexusIxianBetrayalReaction!.blocked = 'A committed promise reserves this Nexus card.';
    assert.equal(select(blocked, 'use'), undefined);
    assert.ok(select(blocked, 'pass'));
    const native = viewGame(fixture.beforeNativeCounter, fixture.holder);
    assert.equal(native.nexusIxianBetrayalReaction, null);
    assert.doesNotMatch(table(native), /data-testid="nexus-ixian-betrayal"/);
    assert.match(table(native), /Power response/);
  }
});

void test('every seat can regain independent control while the native acknowledgement remains unchanged', () => {
  const fixture = createIxianNexusBetrayalFixture({ receiverCount: 2 });
  for (const seat of fixture.game.players) {
    const delegated = applyAction(fixture.game, seat.id, { type: 'setAutopilot', difficulty: 'Hard' });
    const view = viewGame(delegated, seat.id);
    const takeBackButton = [...table(view).matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
      .map(match => match[0]).find(button => button.includes('Take back control'));
    assert.ok(takeBackButton);
    assert.doesNotMatch(takeBackButton, /disabled=/);
    const resumed = applyAction(delegated, seat.id, { type: 'setAutopilot', difficulty: null });
    assert.equal(resumed.players.find(player => player.id === seat.id)!.autopilot, undefined);
    assert.deepEqual(resumed.pendingNexusIxianBetrayal, fixture.game.pendingNexusIxianBetrayal);
    assert.deepEqual(resumed.deck, fixture.game.deck);
  }
});

aliases.deregister();
