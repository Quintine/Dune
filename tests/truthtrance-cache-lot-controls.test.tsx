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

void test('single and compound current facts expose the public cache auction selector', () => {
  const game = createGame('CACHELOTUI', newPlayer('ask', 'Asker', 'emperor'), false, ['choam']);
  joinGame(game, newPlayer('target', 'Target', 'richese'));
  const view = viewGame(game, 'ask');
  const fact: TruthFact = { kind: 'cacheLot', name: 'Shield' };
  const single = renderToStaticMarkup(createElement(TruthFactFields, {
    value: fact, game: view, target: 'target', onChange() {},
  }));
  assert.match(single, /value="cacheLot" selected/);
  assert.match(single, /Public Basic Richese cache auction card/);
  assert.match(single, /value="Shield" selected/);
  assert.match(single, /If that auction is unavailable/);
  const compound: TruthFact = { kind: 'or', terms: [fact, { kind: 'spice', compare: 'gte', value: 3 }] };
  const grouped = renderToStaticMarkup(createElement(TruthFactExpressionFields, {
    value: compound, game: view, target: 'target', disabled: false, onChange() {},
  }));
  assert.match(grouped, /value="cacheLot" selected/);
  assert.match(grouped, /Public Basic Richese cache auction card/);
  assert.match(grouped, /value="Shield" selected/);
  assert.equal(invalidTruthFact(fact, view, 'target'), false);
  assert.equal(invalidTruthFact({ kind: 'cacheLot', name: 'not a printed card' }, view, 'target'), true);
});

void test('cache card control returns a selected printed name without altering the fact kind', () => {
  const exports: { KnowledgeFactFields?: typeof KnowledgeFactFields } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../components/truthtrance-knowledge.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports,
    require(name: string) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return { useId: () => 'cache-lot-test' };
      if (name === '@/game/catalog') return catalog;
      if (name === '@/game/board') return board;
      if (name === '@/game/truthtrance-knowledge') return knowledge;
      if (name === '@/game/truthtrance-card-names') return cardNames;
      if (name === '@/components/ui/input') return { Input: 'input' };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  assert.ok(exports.KnowledgeFactFields);
  let fact: knowledge.KnowledgeFact = { kind: 'cacheLot', name: 'Shield' };
  const render = () => elements(exports.KnowledgeFactFields!({ value: fact, onChange(value) { fact = value; } }));
  const select = render().find(element => element.type === 'select');
  assert.ok(select);
  const next = cardNames.TRUTH_CARD_NAMES.find(name => name !== 'Shield'); assert.ok(next);
  (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: next } });
  assert.deepEqual(JSON.parse(JSON.stringify(fact)), { kind: 'cacheLot', name: next });
  assert.equal(knowledge.knowledgeFactInputError(fact), null);
});
