import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import * as catalog from '../game/catalog';
import * as publicDeals from '../game/public-deals';
import type { Action, GameView } from '../game/engine';
import type { PublicDeals } from '../components/public-deals';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const base = { status: 'playing', turn: 2, me: 'a', roomControl: null,
  players: [{ id: 'a', name: 'Alice', faction: 'atreides' }, { id: 'b', name: 'Basil', faction: 'harkonnen' }],
  deals: [],
} as unknown as GameView;

/** Render one persistent instance and commit effects when their dependencies change. */
function controller() {
  const states: unknown[] = [], refs: unknown[] = [], dependencies: unknown[][] = [], sent: Action[] = [];
  let cursor = 0, dirty = false, game = base;
  let effects: (() => void)[] = [];
  const exported: { PublicDeals?: typeof PublicDeals } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../components/public-deals.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports: exported,
    require(name: string) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return {
        useState(initial: unknown) {
          const index = cursor++;
          if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
          return [states[index], (next: unknown) => {
            const value = typeof next === 'function' ? next(states[index]) : next;
            if (!Object.is(states[index], value)) { states[index] = value; dirty = true; }
          }];
        },
        useRef(initial: unknown) {
          const index = cursor++;
          if (!(index in refs)) refs[index] = { current: initial };
          return refs[index];
        },
        useEffect(effect: () => void, deps: unknown[]) {
          const index = cursor++, previous = dependencies[index];
          if (!previous || deps.length !== previous.length || deps.some((value, i) => !Object.is(value, previous[i]))) {
            dependencies[index] = [...deps]; effects.push(effect);
          }
        },
      };
      if (name === '@/components/ui/button') return { Button: 'button' };
      if (name === '@/game/catalog') return catalog;
      if (name === '@/game/public-deals') return publicDeals;
      throw new Error(`Unexpected import ${name}`);
    },
  });
  assert.ok(exported.PublicDeals);
  const render = () => {
    let nodes: Element[] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      cursor = 0; dirty = false; effects = [];
      nodes = elements(exported.PublicDeals!({ game, busy: false, act: action => sent.push(action) }));
      effects.forEach(effect => effect());
      if (!dirty) return nodes;
    }
    throw new Error('The form did not settle after its effects.');
  };
  const checkbox = (index: number) => {
    const input = render().filter(node => node.type === 'input' && node.props.type === 'checkbox')[index];
    assert.ok(input);
    (input.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  };
  const select = (index: number, value: string) => {
    const input = render().filter(node => node.type === 'select')[index]; assert.ok(input);
    (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  };
  checkbox(0); checkbox(1); select(0, 'deferredBribe'); select(1, 'a'); select(2, 'b');
  const terms = render().find(node => node.type === 'textarea'); assert.ok(terms);
  (terms.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Terms' } });
  const due = () => {
    const input = render().find(node => node.type === 'input' && node.props.type === 'number' && node.props.min === game.turn);
    assert.ok(input); return input;
  };
  return {
    render, due, sent,
    turn(turn: number) { game = { ...game, turn }; },
    edit(value: string) { (due().props.onChange as (event: { target: { value: string } }) => void)({ target: { value } }); },
    submit() {
      const form = render().find(node => node.type === 'form'); assert.ok(form);
      (form.props.onSubmit as (event: { preventDefault(): void }) => void)({ preventDefault() {} });
    },
  };
}

void test('the mounted deferred form advances an expired default and submits the new current turn', () => {
  const ui = controller();
  assert.equal(ui.due().props.value, '2');
  ui.turn(3);
  assert.equal(ui.due().props.value, '3');
  assert.equal(ui.due().props['aria-invalid'], false);
  ui.submit();
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent[0])), { type: 'dealOffer', target: 'b', terms: 'Terms',
    payment: { kind: 'deferredBribe', payer: 'a', recipient: 'b', amount: 1, dueTurn: 3 } });
});

void test('a chosen future deadline stays until the actual turn passes it', () => {
  const ui = controller();
  ui.edit('5'); ui.turn(3); assert.equal(ui.due().props.value, '5');
  ui.turn(5); assert.equal(ui.due().props.value, '5');
  ui.turn(6); assert.equal(ui.due().props.value, '6');
});

void test('invalid edits remain editable and are not overwritten on ordinary rerenders', () => {
  const ui = controller();
  ui.edit('1');
  assert.equal(ui.due().props.value, '1'); assert.equal(ui.due().props['aria-invalid'], true);
  ui.submit(); assert.equal(ui.sent.length, 0);
  ui.edit(''); ui.turn(3); assert.equal(ui.due().props.value, '');
  ui.edit('3.5'); ui.turn(4); assert.equal(ui.due().props.value, '3.5');
  assert.equal(ui.due().props['aria-invalid'], true);
});
