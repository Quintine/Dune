import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Truthtrance } from '../components/truthtrance';
import { TraitorDecisionAnswers, TraitorDecisionPromises } from '../components/traitor-decision-promises';
import { viewGame, type Action } from '../game/engine';
import { createTruthTraitorDecisionFixture as fixture, actTruthTraitorDecision as act,
  askTruthTraitorDecision as ask } from './fixture-truth-traitor-decision';

function callbacks(node: unknown): (() => void)[] {
  if (Array.isArray(node)) return node.flatMap(callbacks);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const props = (node as ReactElement<{ children?: unknown; onClick?: () => void }>).props;
  return [...(props.onClick ? [props.onClick] : []), ...callbacks(props.children)];
}

void test('actual current-decision answer controls and persistent declaration notice explain later prevention', () => {
  const f = fixture(); let g = ask(f.game, f.asker, f.truth, f.target);
  const html = renderToStaticMarkup(createElement(Truthtrance,
    { game: viewGame(g, f.target), busy: false, act() {} }));
  assert.match(html, /Answer Yes/); assert.match(html, /Answer No/);
  assert.match(html, /later Karama or betrayal response/);
  const actions: Action[] = [], props = { game: viewGame(g, f.target), busy: false, act: (action: Action) => { actions.push(action); } };
  callbacks(TraitorDecisionAnswers(props))[1]();
  assert.deepEqual(actions, [{ type: 'truthAnswer', answer: 'yes' }]);
  callbacks(TraitorDecisionAnswers({ ...props, busy: true }))[1](); assert.equal(actions.length, 1);
  g = act(g, f.target, actions[0]);
  const notice = renderToStaticMarkup(createElement(TraitorDecisionPromises, { game: viewGame(g, f.target) }));
  assert.match(notice, /requires Reveal traitor/);
  assert.match(notice, /original declaration fulfills your answer/);
  assert.equal(TraitorDecisionPromises({ game: viewGame(g, f.asker) }), null);
});

void test('only the current declared battle has the new question authoring choice', () => {
  const f = fixture(); let g = act(f.game, f.asker, { type: 'card', card: f.truth });
  for (const p of g.players) if (!g.truthtrance!.passed.includes(p.id)) g = act(g, p.id, { type: 'truthPass' });
  const html = renderToStaticMarkup(createElement(Truthtrance, { game: viewGame(g, f.asker), busy: false, act() {} }));
  assert.match(html, /Bind this battle’s Traitor declaration/);
  assert.ok(viewGame(g, f.asker).truthTraitorTargets.includes(f.target));
});
