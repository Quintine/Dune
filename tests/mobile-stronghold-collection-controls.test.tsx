import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import * as board from '../game/board';
import { createGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { MobileStronghold } from '../components/mobile-stronghold';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

/** Controlled public projection; the hook harness operates the real component
 * callbacks without claiming browser hydration or server-side validation. */
function fixture() {
  const g = createGame('HMSUI', newPlayer('i', 'Ixians', 'ixians'), false, ['ix']);
  g.players.push(newPlayer('a', 'Atreides', 'atreides'));
  g.status = 'playing'; g.phase = 5; g.turn = 2; g.storm = 18;
  g.active = 'i'; g.order = ['i', 'a']; g.movementRemaining = ['i', 'a'];
  g.mobileStronghold = { location: 'polar_sink:0' };
  g.players[0].forces = { [board.MOBILE_LOCATION]: 6 };
  g.players[0].reserves = 14;
  const next = board.GRAPH['polar_sink:0'].find(key =>
    board.splitLocation(key).sector !== g.storm &&
    board.territory(board.splitLocation(key).territory).type !== 'stronghold');
  assert.ok(next);
  g.spice = { 'polar_sink:0': 3, [next]: 20 };
  return { view: viewGame(g, 'i'), next };
}

function controller(game: GameView, sandmasterPile?: string, card?: string) {
  const states: unknown[] = [], sent: Action[] = [];
  let cursor = 0;
  const exports: { MobileStronghold?: typeof MobileStronghold } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../components/mobile-stronghold.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports,
    require(name: string) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return { useState(initial: unknown) {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (next: unknown) => { states[index] = next; }];
      } };
      if (name === '@/components/ui/button') return { Button: 'button' };
      if (name === '@/components/ui/input') return { Input: 'input' };
      if (name === './help-tip') return { HelpTip: () => null };
      if (name === '@/game/board') return board;
      if (name === '@/game/sandmaster-movement') return { quoteSandmasterStronghold: () => sandmasterPile
        ? { piles: { [board.splitLocation(sandmasterPile).territory]: [sandmasterPile] } } : null };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  assert.ok(exports.MobileStronghold);
  const render = () => { cursor = 0; return elements(exports.MobileStronghold!({ game, busy: false, card, act: action => sent.push(action) })); };
  const chooseNext = (value: string) => {
    const select = render().find(element => element.props['aria-label'] === 'Next route sector'); assert.ok(select);
    (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  };
  const inputs = () => render().filter(element => element.type === 'input' && element.props.type === 'number');
  const edit = (index: number, value: string) => {
    const input = inputs()[index]; assert.ok(input);
    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  };
  const submit = () => {
    const button = render().find(element => element.type === 'button' &&
      (element.props.children === 'Declare stronghold route' || element.props.children === 'Spend Karama and relocate'));
    assert.ok(button); return button;
  };
  return { render, chooseNext, inputs, edit, submit, sent };
}

void test('route controls default to per-sector maximum and submit partial choices', () => {
  const { view, next } = fixture(), ui = controller(view);
  ui.chooseNext(next);
  assert.deepEqual(ui.inputs().map(input => input.props.value), [3, 12]);
  ui.edit(0, '1'); ui.edit(1, '4');
  assert.deepEqual(ui.inputs().map(input => input.props.value), ['1', '4']);
  const button = ui.submit(); assert.equal(button.props.disabled, false);
  (button.props.onClick as () => void)();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent[0])), { type: 'decision', route: ['polar_sink:0', next],
    collect: true, collections: [{ location: 'polar_sink:0', amount: 1 }, { location: next, amount: 4 }] });
  // A forged selection cannot enable a route that repeats a sector.
  ui.chooseNext('polar_sink:0');
  assert.equal(ui.submit().props.disabled, true);
});

void test('invalid collection values disable submission; skipping sends route-ordered zeros', () => {
  const { view, next } = fixture(), ui = controller(view, undefined, 'karama-card');
  ui.chooseNext(next);
  for (const value of ['', '-1', '13', '1.5']) {
    ui.edit(1, value);
    assert.equal(ui.inputs()[1].props['aria-invalid'], true);
    assert.equal(ui.submit().props.disabled, true);
  }
  const checkbox = ui.render().find(element => element.type === 'input' && element.props.type === 'checkbox');
  assert.ok(checkbox);
  (checkbox.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } });
  const button = ui.submit(); assert.equal(button.props.disabled, false);
  (button.props.onClick as () => void)();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent[0])), { type: 'card', mode: 'special', card: 'karama-card',
    route: ['polar_sink:0', next], collect: false,
    collections: [{ location: 'polar_sink:0', amount: 0 }, { location: next, amount: 0 }] });
});

void test('controlled Sandmaster pile is debited before the route input cap', () => {
  const { view, next } = fixture(); view.spice[next] = 3;
  const ui = controller(view, next); ui.chooseNext(next);
  assert.equal(ui.inputs()[1].props.max, 2); assert.equal(ui.inputs()[1].props.value, 2);
  const button = ui.submit(); assert.equal(button.props.disabled, false);
  (button.props.onClick as () => void)();
  const action = JSON.parse(JSON.stringify(ui.sent[0])) as Action;
  assert.deepEqual(action.sandmasterPiles, [next]);
  assert.deepEqual(action.collections, [{ location: 'polar_sink:0', amount: 3 }, { location: next, amount: 2 }]);
});
