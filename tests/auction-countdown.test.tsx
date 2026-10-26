import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement, type ReactNode } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { AuctionCountdown } from '../components/auction-countdown';
import type { AuctionClockView } from '../game/auction-clock';

const frame = (remainingMs = 10_000, running = true, event: string | null = 'ordinary-bid-event'): AuctionClockView =>
  ({ event, player: 'p', remainingMs, running });
const html = (clock: AuctionClockView | null, paused = false, playerName = 'Respondent') =>
  renderToStaticMarkup(createElement(AuctionCountdown, { clock, playerName, paused }));

void test('auction countdown renders public whole-second time and explains the native deadline and compelled-bid convention', () => {
  for (const [remainingMs, label] of [[10_000, '10 seconds'], [9_001, '10 seconds'], [1_001, '2 seconds'], [1_000, '1 second'], [1, '1 second']] as const) {
    const clock = frame(remainingMs), before = structuredClone(clock), markup = html(clock);
    assert.match(markup, new RegExp(`${label} remaining`)); assert.deepEqual(clock, before);
    assert.match(markup, /Respondent may bid or pass/); assert.match(markup, /role="timer" aria-live="off"/);
    assert.match(markup, /each player 10 seconds to bid or pass/); assert.match(markup, /server controls the deadline/);
    assert.match(markup, /Online convention: if passing would violate a binding Truthtrance answer/);
    assert.match(markup, /server submits only the required legal bid/); assert.match(markup, /normal payment is still owed/);
    assert.doesNotMatch(markup, /<button|<form|Continue|onClick/);
  }
  assert.equal(html(null), '');
  assert.match(html(frame(), false, '<script>send pass</script>'), /&lt;script&gt;send pass&lt;\/script&gt;/);
});

void test('auction countdown distinguishes unarmed, interrupted, administrative pause and zero without creating an action control', () => {
  const unarmed = html(frame(10_000, false, null));
  assert.match(unarmed, /Clock starts when ordinary bidding is ready/); assert.match(unarmed, /10 seconds available/);
  const interrupted = html(frame(6_200, false));
  assert.match(interrupted, /held while the current game decision finishes/); assert.match(interrupted, /7 seconds remaining/);
  assert.doesNotMatch(interrupted, /may bid or pass/);
  const paused = html(frame(6_200), true); assert.match(paused, /Auction paused/); assert.match(paused, /7 seconds remaining/);
  for (const running of [false, true]) for (const roomPaused of [false, true]) {
    const expired = html(frame(0, running), roomPaused);
    assert.match(expired, /Awaiting server resolution/); assert.match(expired, /0 seconds remaining/);
    assert.doesNotMatch(expired, /<button|<form|Continue/);
    if (roomPaused) assert.match(expired, /Auction paused/);
  }
});

/** Run the real component effects with a controlled monotonic browser clock.
 * React markup remains real; no DOM package or server action mock is needed. */
function browserDisplay(initial: Parameters<typeof AuctionCountdown>[0]) {
  type Effect = { dependencies: readonly unknown[]; cleanup?: () => void };
  const states: unknown[] = [], effects: Effect[] = [], pending: (() => void)[] = [];
  const intervals = new Map<number, () => void>();
  let stateIndex = 0, effectIndex = 0, now = 0, nextTimer = 0, props = initial;
  const exports: { AuctionCountdown?: typeof AuctionCountdown } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../components/auction-countdown.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports,
    performance: { now: () => now },
    setInterval(callback: () => void, ms: number) { assert.equal(ms, 200); const timer = ++nextTimer; intervals.set(timer, callback); return timer; },
    clearInterval(timer: number) { intervals.delete(timer); },
    require(name: string) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      assert.equal(name, 'react');
      return {
        useState(initialValue: unknown) {
          const index = stateIndex++;
          if (!(index in states)) states[index] = initialValue;
          return [states[index], (next: unknown) => { states[index] = next; }];
        },
        useEffect(callback: () => (() => void) | undefined, dependencies: readonly unknown[]) {
          const index = effectIndex++, previous = effects[index];
          if (previous && dependencies.every((dependency, i) => Object.is(dependency, previous.dependencies[i]))) return;
          pending.push(() => { previous?.cleanup?.(); effects[index] = { dependencies, cleanup: callback() }; });
        },
      };
    },
  });
  assert.ok(exports.AuctionCountdown);
  const render = () => {
    stateIndex = 0; effectIndex = 0;
    const node: ReactNode = exports.AuctionCountdown!(props);
    const markup = renderToStaticMarkup(node);
    while (pending.length) pending.shift()!();
    return markup;
  };
  return {
    render,
    update(next: typeof initial) { props = next; return render(); },
    advance(ms: number) { now += ms; for (const callback of intervals.values()) callback(); return render(); },
    get ticking() { return intervals.size; },
  };
}

void test('local countdown follows elapsed browser time, accepts replacement server frames and stops at server-resolution status', () => {
  const display = browserDisplay({ clock: frame(), playerName: 'Respondent' });
  assert.match(display.render(), /10 seconds remaining/); assert.equal(display.ticking, 1);
  // One delayed callback still accounts for the actual elapsed time.
  assert.match(display.advance(5_401), /5 seconds remaining/);
  assert.match(display.update({ clock: frame(2_000), playerName: 'Respondent' }), /2 seconds remaining/);
  assert.equal(display.ticking, 1); assert.match(display.advance(1_001), /1 second remaining/);
  const expired = display.advance(999); assert.match(expired, /Awaiting server resolution/); assert.equal(display.ticking, 0);
  assert.doesNotMatch(expired, /<button|<form/);
  assert.match(display.update({ clock: { ...frame(), event: 'next-bid-event', player: 'a' }, playerName: 'Next bidder' }), /10 seconds remaining/);
  assert.match(display.render(), /Next bidder may bid or pass/); assert.equal(display.ticking, 1);
  assert.equal(display.update({ clock: null, playerName: 'Next bidder' }), ''); assert.equal(display.ticking, 0);
});

void test('interrupted and room-paused frames retain their balance across local time and resume from the current server frame', () => {
  const display = browserDisplay({ clock: frame(6_200, false), playerName: 'Respondent' });
  assert.match(display.render(), /7 seconds remaining/); assert.equal(display.ticking, 0);
  assert.match(display.advance(20_000), /7 seconds remaining/);
  const paused = { clock: frame(4_500), playerName: 'Respondent', paused: true };
  assert.match(display.update(paused), /Auction paused/); assert.equal(display.ticking, 0);
  assert.match(display.advance(20_000), /5 seconds remaining/);
  assert.match(display.update({ ...paused, paused: false }), /5 seconds remaining/); assert.equal(display.ticking, 1);
  assert.match(display.advance(4_500), /Awaiting server resolution/); assert.equal(display.ticking, 0);
  const unarmed = display.update({ clock: frame(10_000, false, null), playerName: 'Respondent' });
  assert.match(unarmed, /Clock starts when ordinary bidding is ready/); assert.equal(display.ticking, 0);
});
