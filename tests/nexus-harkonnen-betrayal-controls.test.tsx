import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type Action, type GameView } from '../game/engine';
import { tableActionOwner } from '../game/table-turn';
import { DEFAULT_ROOM_CONTROL } from '../lib/room-control';
import { createHarkonnenNexusBetrayalFixture } from './fixture-nexus-harkonnen-betrayal';

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
// Next/CSS loading hooks must precede the UI imports.
const { NexusHarkonnenBetrayal } = await import('../components/nexus-harkonnen-betrayal');
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
  click(NexusHarkonnenBetrayal({ game, busy, act(value) { action = value; } }), `nexus-harkonnen-betrayal-${choice}`);
  return action;
}
function markup(game: GameView): string {
  return renderToStaticMarkup(createElement(NexusHarkonnenBetrayal, { game, busy: false, act() {} }));
}
function table(game: GameView): string {
  return renderToStaticMarkup(createElement(GameTable, { game, busy: false, send: async () => {}, onExit() {} }));
}
const scenarios = [
  { advanced: false, remote: false },
  { advanced: true, remote: false },
  { advanced: false, remote: true },
  { advanced: true, remote: true },
] as const;

for (const scenario of scenarios) {
  void test(`${scenario.advanced ? 'Advanced' : 'Basic'} ${scenario.remote ? 'allied' : 'personal'} human controls cancel the actual declared card or preserve it with Pass`, () => {
    const f = createHarkonnenNexusBetrayalFixture(scenario);
    const own = viewGame(f.game, f.holder);
    const use = select(own, 'use');
    assert.ok(use);
    assert.deepEqual(use, { type: 'nexusHarkonnenBetrayalUse', event: f.event });
    const denied = applyAction(f.game, f.holder, use);
    assert.equal(viewGame(denied, f.holder).nexusHarkonnenBetrayalReaction, null);
    assert.equal(denied.players.find(p => p.id === f.provider)!.traitors.includes(f.identity), false);
    assert.equal(denied.nexusCards!.cards!.hands[f.holder], null);
    assert.equal(denied.pendingNexusHarkonnenReplacement!.identity, f.identity);
    assert.equal(select(viewGame(denied, f.holder), 'use'), undefined);
    assert.throws(() => applyAction(denied, f.holder, use));

    let allowed = f.game;
    for (const id of f.required) {
      const pass = select(viewGame(allowed, id), 'pass');
      assert.ok(pass);
      assert.deepEqual(pass, { type: 'nexusHarkonnenBetrayalPass', event: f.event });
      allowed = applyAction(allowed, id, pass);
    }
    assert.equal(viewGame(allowed, f.holder).nexusHarkonnenBetrayalReaction, null);
    assert.equal(allowed.players.find(p => p.id === f.provider)!.traitors.includes(f.identity), true);
    assert.equal(allowed.nexusCards!.cards!.hands[f.holder], 'harkonnen');
    assert.equal(allowed.pendingNexusHarkonnenReplacement ?? null, null);
  });
}

void test('the public declaration names only the actual card and roles; inspectors remain private to their own held face', () => {
  for (const scenario of scenarios) {
    const f = createHarkonnenNexusBetrayalFixture(scenario);
    const traitorName = viewGame(f.game, f.holder).allLeaders.find(l => l.id === f.identity)!.name;
    for (const seat of f.game.players) {
      const own = viewGame(f.game, seat.id);
      const html = markup(own);
      for (const id of [f.provider, f.beneficiary, f.target]) assert.ok(html.includes(f.game.players.find(p => p.id === id)!.name));
      assert.ok(html.includes(traitorName));
      if (own.nexusCards?.card === 'harkonnen') assert.ok(html.includes('Inspect Harkonnen Nexus card'));
      else assert.equal(html.includes('Inspect Harkonnen Nexus card'), false);
      if (seat.id !== f.provider) {
        for (const hidden of f.game.players.find(p => p.id === f.provider)!.traitors.filter(id => id !== f.identity)) {
          const hiddenName = own.allLeaders.find(l => l.id === hidden)!.name;
          assert.equal(html.includes(hiddenName), false);
        }
      }
      if (!f.required.includes(seat.id)) {
        assert.equal(select(own, 'use'), undefined);
        assert.equal(select(own, 'pass'), undefined);
        assert.equal(own.nexusHarkonnenBetrayalReaction!.blocked, null);
      }
    }
    const wrong = createHarkonnenNexusBetrayalFixture({ ...scenario, face: 'richese' });
    const ownWrong = viewGame(wrong.game, wrong.holder);
    assert.equal(ownWrong.nexusHarkonnenBetrayalReaction!.canPass, true);
    assert.equal(ownWrong.nexusHarkonnenBetrayalReaction!.blocked, null);
    assert.equal(select(ownWrong, 'use'), undefined);
    assert.ok(select(ownWrong, 'pass'));
    assert.equal(markup(ownWrong).includes('Inspect Harkonnen Nexus card'), false);
    assert.ok(markup(ownWrong).includes('Inspect Richese Nexus card'));
  }
});

void test('partial acknowledgements use the sole public unfinished seat, not the provider or private face', () => {
  const f = createHarkonnenNexusBetrayalFixture({ receiverCount: 2 });
  for (const seat of f.game.players) assert.equal(tableActionOwner(viewGame(f.game, seat.id)), null);
  const first = f.required[0];
  const pass = select(viewGame(f.game, first), 'pass');
  assert.ok(pass);
  const next = applyAction(f.game, first, pass);
  for (const seat of next.players) assert.equal(tableActionOwner(viewGame(next, seat.id)), f.required[1]);
  const refreshed = viewGame(structuredClone(next), first);
  assert.equal(select(refreshed, 'pass'), undefined);
  assert.equal(select(refreshed, 'use'), undefined);
  assert.equal(select(viewGame(next, f.provider), 'use'), undefined);
});

void test('table reserves the source and dispatch honors own response, room, transport and autopilot locks', () => {
  for (const scenario of scenarios) {
    const f = createHarkonnenNexusBetrayalFixture(scenario);
    const own: GameView = viewGame(f.game, f.holder);
    const html = table(own);
    assert.ok(html.includes('Declared Harkonnen traitor acknowledgement'));
    assert.equal(html.includes('Reveal traitor'), false);
    assert.equal(html.includes('No traitor'), false);
    assert.equal(html.includes('Make a bribe'), false);
    for (const restriction of ['paused', 'closed', 'autopilot', 'busy', 'automatic'] as const) {
      const blocked = structuredClone(own);
      if (restriction === 'autopilot') blocked.players.find(p => p.id === own.me)!.autopilot = 'Easy';
      else if (restriction === 'automatic') blocked.automaticContinuationPending = true;
      else if (restriction !== 'busy') blocked.roomControl = { ...DEFAULT_ROOM_CONTROL, [restriction]: true };
      for (const choice of ['use', 'pass'] as const) assert.equal(select(blocked, choice, restriction === 'busy'), undefined);
    }
    const blocked = structuredClone(own);
    blocked.nexusHarkonnenBetrayalReaction!.blocked = 'A committed promise reserves this Nexus card.';
    assert.equal(select(blocked, 'use'), undefined);
    assert.ok(select(blocked, 'pass'));
    if (scenario.remote) {
      const native = viewGame(f.beforeNativeCounter, f.holder);
      assert.ok(native.response);
      assert.equal(native.nexusHarkonnenBetrayalReaction, null);
      assert.equal(select(native, 'use'), undefined);
    }
  }
});

void test('every seat independently delegates and takes back control without changing declaration or custody', () => {
  const f = createHarkonnenNexusBetrayalFixture({ receiverCount: 2 });
  for (const seat of f.game.players) {
    const delegated = applyAction(f.game, seat.id, { type: 'setAutopilot', difficulty: 'Hard' });
    const own = viewGame(delegated, seat.id);
    assert.ok(table(own).includes('Take back control'));
    assert.equal(select(own, 'use'), undefined);
    assert.equal(select(own, 'pass'), undefined);
    const resumed = applyAction(delegated, seat.id, { type: 'setAutopilot', difficulty: null });
    assert.equal(resumed.players.find(p => p.id === seat.id)!.autopilot, undefined);
    assert.deepEqual(resumed.pendingNexusHarkonnenBetrayal, f.game.pendingNexusHarkonnenBetrayal);
    assert.deepEqual(resumed.traitorReserve, f.game.traitorReserve);
    assert.deepEqual(resumed.players.map(p => p.traitors), f.game.players.map(p => p.traitors));
  }
});

aliases.deregister();
