import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TurnActionFields, turnActionInputError } from '../components/turn-action-fields';
import { createGame, joinGame, newPlayer, viewGame, type GameView } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TurnActionLeaf } from '../game/turn-action-promises';

type Expression = MixedActionExpression<TurnActionLeaf>;
type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
const source = (kind: 'voice' | 'prescience') => JSON.stringify([
  'karamaBattleCancel', 2, 'controlled-battle', 'arrakeen', kind, 'a',
]);

/** A controlled public projection tests the editor, not native battle legality. */
function projection(kind: 'voice' | 'prescience'): GameView {
  const game = createGame('TURNACTIONCANCEL', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(game, newPlayer('a', 'Declarer', kind === 'voice' ? 'beneGesserit' : 'atreides'));
  joinGame(game, newPlayer('r', 'Other', 'harkonnen'));
  const view = viewGame(game, 'p');
  view.status = 'playing'; view.turn = 2; view.phase = 6;
  view.response = { kind, owner: 'a', passed: [] };
  view.battle = { event: 'controlled-battle', territory: 'arrakeen', attacker: 'a', defender: 'p', revealed: false,
    submitted: [], traitorVoters: ['p', 'a'], traitorSubmitted: [], plans: {}, truthPromises: [],
  } as unknown as NonNullable<GameView['battle']>;
  return view;
}
const claim = (kind: 'voice' | 'prescience'): Expression => ({ kind: 'action', action: {
  kind: 'windowCardPlay', effect: 'karamaBattleCancel', source: source(kind),
} });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

for (const kind of ['voice', 'prescience'] as const) {
  void test(`editor binds printed Karama to the current ${kind} response`, () => {
    const game = projection(kind), value = claim(kind);
    assert.equal(turnActionInputError(value, game, 'p'), null);
    const html = renderToStaticMarkup(createElement(TurnActionFields, { game, value, target: 'p', disabled: false, onChange() {} }));
    assert.match(html, /Spend a printed Karama to cancel this Voice or Prescience/);
    assert.match(html, kind === 'voice' ? /Voice declared by Declarer/ : /Prescience declared by Declarer/);
    assert.match(html, /Arrakeen/);
    assert.match(html, /Only spending a physical printed Karama/);
    assert.doesNotMatch(html, /Respondent.s hand|private-card/);
    assert.notEqual(turnActionInputError(value, game, 'a'), null, 'the declaration owner is not a cancellation target');
    game.response = null;
    assert.notEqual(turnActionInputError(value, game, 'p'), null, 'closed original response is no longer selectable');
  });
}

void test('editor defaults to the current battle cancellation and keeps its exact source', () => {
  const game = projection('voice');
  let value: Expression = { kind: 'action', action: { kind: 'ship', territory: 'carthag', minimum: 1 } };
  const tree = TurnActionFields({ game, value, target: 'p', disabled: false, onChange(next) { value = next; } });
  const select = elements(tree).find(element => element.props.id === 'truth-turn-action-1-action');
  assert.ok(select);
  (select.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value: 'windowCardPlay' } });
  assert.deepEqual(value, claim('voice'));
});

void test('response questions reject unrelated future actions even within a mixed expression', () => {
  const game = projection('voice');
  const unrelated: Expression = { kind: 'action', action: { kind: 'ship', territory: 'carthag', minimum: 1 } };
  const mixed: Expression = { kind: 'or', terms: [claim('voice'), unrelated] };
  assert.match(turnActionInputError(unrelated, game, 'p') ?? '', /choose only a printed Karama cancellation/i);
  assert.match(turnActionInputError(mixed, game, 'p') ?? '', /choose only a printed Karama cancellation/i);
  game.response = null;
  assert.equal(turnActionInputError(unrelated, game, 'p'), null, 'ordinary questions retain their existing editor rules');
});
