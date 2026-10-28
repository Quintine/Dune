import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame } from '../game/engine';
import { createTruthtranceRichesePromisesFixture, actTruthtranceRichesePromises as act,
  advanceTruthtranceRichesePromises as advance, askTruthtranceRichesePromises } from './fixture-truthtrance-richese-promises';

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
const { EarlyRicheseBidFields, Truthtrance } = await import('../components/truthtrance');
aliases.deregister();

type ElementProps = { children?: ReactNode; [key: string]: unknown };
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

void test('early Richese threshold controls describe the undecided first cache lot and reject invalid edits', () => {
  const changes: number[] = [];
  const props = { minimum: 3, disabled: false, onMinimum(value: number) { changes.push(value); } };
  const html = renderToStaticMarkup(createElement(EarlyRicheseBidFields, props));
  assert.match(html, /first Richese cache auction this turn/i);
  assert.match(html, /card and method have not yet been decided/);
  assert.match(html, /does not promise a win/);
  const edit = (value: number, disabled = false) => {
    const input = elements(EarlyRicheseBidFields({ ...props, disabled })).find(element =>
      element.props.id === 'truth-early-richese-minimum' && typeof element.props.onChange === 'function');
    assert.ok(input);
    (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber: value } });
  };
  edit(4); for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) edit(value);
  edit(7, true);
  assert.deepEqual(changes, [4]);
});

void test('native Basic Truthtrance exposes the early selector and target-only answer controls', () => {
  const f = createTruthtranceRichesePromisesFixture({ advanced: false });
  let declared = act(f.earlySource, f.asker, f.declarationStep.action);
  declared = advance(declared, state => state.truthtrance?.stage === 'ask');
  const askerView = viewGame(declared, f.asker);
  assert.ok(askerView.truthEarlyRicheseBidTargets.includes(f.emperor));
  const asking = renderToStaticMarkup(createElement(Truthtrance, { game: askerView, busy: false, act() {} }));
  assert.match(asking, /<option value="earlyRicheseBid">Bind a bid in the first Richese cache auction<\/option>/);
  const asked = askTruthtranceRichesePromises(f.earlySource, f, {
    kind: 'earlyRicheseBid', target: f.emperor, turn: f.earlySource.turn, minimum: 1,
  });
  const respondent = viewGame(asked, f.emperor);
  assert.ok(respondent.truthEarlyRicheseBidAnswers?.length);
  assert.equal(viewGame(asked, f.asker).truthEarlyRicheseBidAnswers, null);
  const answer = renderToStaticMarkup(createElement(Truthtrance, { game: respondent, busy: false, act() {} }));
  assert.match(answer, /first Richese cache auction this turn/i);
  assert.match(answer, /Its card and method are not yet decided/);
  assert.match(answer, /Answer (Yes|No)|I don’t know/);
});
