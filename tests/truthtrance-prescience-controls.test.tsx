import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as board from '../game/board';
import * as catalog from '../game/catalog';
import { createGame, joinGame, newPlayer, viewGame } from '../game/engine';
import * as knowledge from '../game/truthtrance-knowledge';
import * as cardNames from '../game/truthtrance-card-names';
import { KnowledgeFactFields } from '../components/truthtrance-knowledge';
import { TruthFactFields, invalidTruthFact } from '../components/mixed-shipment-fields';
import { TruthFactExpressionFields } from '../components/truth-fact-expression-fields';
import type { TruthFact } from '../game/truthtrance';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

void test('single and compound current-fact editors offer named Prescience fields', () => {
  const g = createGame('PRESCIENCEUI', newPlayer('ask', 'Asker', 'emperor'));
  joinGame(g, newPlayer('target', 'Target', 'atreides'));
  const view = viewGame(g, 'ask');
  const fact: TruthFact = { kind: 'presciencePeek', field: 'leader', name: 'Duncan Idaho' };
  const single = renderToStaticMarkup(createElement(TruthFactFields, {
    value: fact, game: view, target: 'target', onChange() {},
  }));
  assert.match(single, /value="presciencePeek" selected/);
  assert.match(single, /value="Duncan Idaho" selected/);
  assert.match(single, /value="weapon"/);
  assert.match(single, /value="defense"/);
  assert.match(single, /value="dial"/);
  assert.match(single, /If that field is unknown or no longer available/);
  assert.match(single, /Only the answer is published/);
  const compound: TruthFact = { kind: 'or', terms: [fact, { kind: 'spice', compare: 'gte', value: 3 }] };
  const grouped = renderToStaticMarkup(createElement(TruthFactExpressionFields, {
    value: compound, game: view, target: 'target', disabled: false, onChange() {},
  }));
  assert.match(grouped, /Inspected battle plan field/);
  assert.match(grouped, /value="Duncan Idaho" selected/);
  assert.equal(invalidTruthFact(fact, view, 'target'), false);
  assert.equal(invalidTruthFact({ kind: 'presciencePeek', field: 'dial', value: -1 }, view, 'target'), true);
});

void test('Prescience field callbacks select printed cards, None and half-strength dial values', () => {
  const exports: { KnowledgeFactFields?: typeof KnowledgeFactFields } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../components/truthtrance-knowledge.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports,
    require(name: string) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return { useId: () => 'prescience-test' };
      if (name === '@/game/catalog') return catalog;
      if (name === '@/game/board') return board;
      if (name === '@/game/truthtrance-knowledge') return knowledge;
      if (name === '@/game/truthtrance-card-names') return cardNames;
      if (name === '@/components/ui/input') return { Input: 'input' };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  assert.ok(exports.KnowledgeFactFields);
  let fact: knowledge.KnowledgeFact = { kind: 'presciencePeek', field: 'leader', name: 'None' };
  const render = () => elements(exports.KnowledgeFactFields!({ value: fact, onChange(value) { fact = value; } }));
  const change = (element: Element, value: string) =>
    (element.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });

  change(render().filter(element => element.type === 'select')[0], 'weapon');
  assert.deepEqual(JSON.parse(JSON.stringify(fact)), { kind: 'presciencePeek', field: 'weapon', name: 'None' });
  change(render().filter(element => element.type === 'select')[1], 'Shield');
  assert.deepEqual(JSON.parse(JSON.stringify(fact)), { kind: 'presciencePeek', field: 'weapon', name: 'Shield' });
  change(render().filter(element => element.type === 'select')[0], 'dial');
  const input = render().find(element => element.type === 'input'); assert.ok(input);
  assert.equal(input.props.step, 0.5);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber: 2.5 } });
  assert.deepEqual(JSON.parse(JSON.stringify(fact)), { kind: 'presciencePeek', field: 'dial', value: 2.5 });
  assert.equal(knowledge.knowledgeFactInputError(fact), null);
});
