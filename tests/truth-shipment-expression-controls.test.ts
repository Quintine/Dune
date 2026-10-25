import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShipmentClauseFields } from '../components/shipment-claim-fields';
import { ShipmentExpressionFields } from '../components/shipment-expression-fields';
import { TruthShipmentQuestion } from '../components/truth-shipment-question';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { parseShipmentExpression, type ShipmentExpression } from '../game/shipment-promises';
import { shipmentExpressionInputError, shipmentExpressionInputSize } from '../game/shipment-expression-input';
import type { TruthQuestion } from '../game/truthtrance';

// Entitled controlled projections supplement the separate original-card source.
// React renders descendants; direct calls reach only hook-free controlled APIs.
function projected(): GameView {
  const source = createGame('SHIPMENTEXPRESSIONCONTROLS', newPlayer('a', 'Asker', 'atreides'), false);
  joinGame(source, newPlayer('t', 'Target', 'emperor'));
  const game = viewGame(source, 'a');
  game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'projected-truth-card' }], passed: [], question: null };
  game.truthShipmentTargets = ['t'];
  return game;
}
const leaf = (territory = 'arrakeen', minimum = 1): ShipmentExpression => ({ territory, minimum });
const question = (claim: ShipmentExpression, target = 't'): Extract<TruthQuestion, { kind: 'shipment' }> => ({ kind: 'shipment', target, claim });
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function control(tree: ReactNode, key: string): Element {
  const found = elements(tree).find(element => element.props['data-shipment-expression-control'] === key);
  assert.ok(found, `Shipment control ${key} is rendered`); return found;
}
const click = (button: Element) => (button.props.onClick as () => void)();
function nodeAt(tree: ReactNode, path: string): Element {
  const found = elements(tree).find(element => element.props['data-shipment-expression-path'] === path);
  assert.ok(found, `Shipment condition or group ${path} is rendered`); return found;
}
function editLeaf(tree: ReactNode, path: string, next: ShipmentExpression) {
  const field = elements(nodeAt(tree, path)).find(element => element.type === ShipmentClauseFields);
  assert.ok(field); (field.props.onChange as (value: ShipmentExpression) => void)(next);
}
function switchGroup(tree: ReactNode, path: string, op: string) {
  const select = elements(nodeAt(tree, path)).find(element => element.type === 'select');
  assert.ok(select);
  (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: op } });
}
function editor(initial: ShipmentExpression, disabled = false, id = 'custom-shipment') {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => ShipmentExpressionFields({ value, id, disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(ShipmentExpressionFields, { value, id, disabled, onChange() {} })),
  };
}
function askTree(game: GameView, value: Extract<TruthQuestion, { kind: 'shipment' }>, busy = false) {
  const actions: Action[] = [], changes: ShipmentExpression[] = [];
  const props = { game, question: value, busy, act(action: Action) { actions.push(action); }, onChange(next: ShipmentExpression) { changes.push(next); } };
  const tree = TruthShipmentQuestion(props);
  const button = elements(tree).find(element => element.props['data-testid'] === 'truth-shipment-ask');
  assert.ok(button);
  return { tree, button, actions, changes, html: () => renderToStaticMarkup(createElement(TruthShipmentQuestion, props)) };
}
function groupsDeep(depth: number): ShipmentExpression {
  let expression = leaf();
  for (let i = 0; i < depth; i++) expression = { op: 'and', terms: [expression, leaf('carthag')] };
  return expression;
}

void test('actual add and leaf callbacks author three through sixteen shipment conditions without truncation', () => {
  const initial = leaf('polar_sink', 3), e = editor(initial);
  click(control(e.tree(), 'or-1'));
  for (let count = 3; count <= 16; count++) {
    const previous = structuredClone(e.value); assert.ok('op' in previous);
    click(control(e.tree(), 'add-1'));
    editLeaf(e.tree(), `1.${count}`, leaf(TERRITORIES[count - 1].id, count));
    assert.ok('op' in e.value); assert.equal(e.value.terms.length, count);
    assert.deepEqual(e.value.terms.slice(0, count - 1), previous.terms);
  }
  assert.ok('op' in e.value); assert.deepEqual(e.value.terms[0], initial);
  assert.deepEqual(shipmentExpressionInputSize(e.value), { leaves: 16, depth: 1 });
  assert.deepEqual(parseShipmentExpression(e.value), e.value);
  const html = e.html();
  assert.equal((html.match(/This-turn shipment destination/g) ?? []).length, 16);
  assert.match(html, /16 \/ 16 shipment conditions/);
  assert.match(html, /id="custom-shipment-1\.16-minimum"/);
  assert.match(html, /for="custom-shipment-1\.16-territory"/);
});

void test('nested AND and OR groups preserve every branch and allow independent group meaning changes', () => {
  const e = editor(leaf());
  click(control(e.tree(), 'and-1')); editLeaf(e.tree(), '1.2', leaf('carthag', 3));
  click(control(e.tree(), 'or-1.2')); editLeaf(e.tree(), '1.2.2', leaf('sietch_tabr', 4));
  click(control(e.tree(), 'add-1.2')); editLeaf(e.tree(), '1.2.3', leaf('polar_sink', 5));
  const original = structuredClone(e.value);
  switchGroup(e.tree(), '1.2', 'and');
  assert.deepEqual(e.value, { op: 'and', terms: [leaf(), { op: 'and', terms: [leaf('carthag', 3), leaf('sietch_tabr', 4), leaf('polar_sink', 5)] }] });
  switchGroup(e.tree(), '1.2', 'or'); assert.deepEqual(e.value, original);
  const changes = e.changes; switchGroup(e.tree(), '1.2', 'single'); assert.equal(e.changes, changes);
  click(control(e.tree(), 'nested-and-1'));
  click(control(e.tree(), 'nested-or-1'));
  assert.ok('op' in e.value);
  assert.deepEqual(e.value.terms.slice(0, 2), 'op' in original ? original.terms : []);
  assert.deepEqual(e.value.terms[2], { op: 'and', terms: [leaf('carthag'), leaf('carthag')] });
  assert.deepEqual(e.value.terms[3], { op: 'or', terms: [leaf('carthag'), leaf('carthag')] });
  assert.match(e.html(), /Shipment group 1\.2 · OR/);
});

void test('remove collapses singleton groups and retains the complete remaining expression', () => {
  const retained = leaf('polar_sink', 5);
  const e = editor({ op: 'or', terms: [leaf(), { op: 'and', terms: [leaf('carthag'), retained] }] });
  click(control(e.tree(), 'remove-1.2.1'));
  assert.deepEqual(e.value, { op: 'or', terms: [leaf(), retained] });
  click(control(e.tree(), 'remove-1.1')); assert.deepEqual(e.value, retained);
  const survivor: ShipmentExpression = { op: 'or', terms: [leaf(), leaf('carthag'), leaf('sietch_tabr')] };
  const grouped = editor({ op: 'and', terms: [{ op: 'and', terms: [leaf(), leaf()] }, survivor] });
  click(control(grouped.tree(), 'remove-1.1')); assert.deepEqual(grouped.value, survivor);
});

void test('sixteen leaves count independently of groups and guard all add and wrap callbacks', () => {
  const full: ShipmentExpression = { op: 'and', terms: [
    { op: 'or', terms: Array.from({ length: 8 }, () => leaf()) },
    { op: 'and', terms: Array.from({ length: 8 }, () => leaf('carthag')) },
  ] };
  const e = editor(full), before = structuredClone(full);
  assert.deepEqual(shipmentExpressionInputSize(full), { leaves: 16, depth: 2 });
  assert.equal(shipmentExpressionInputError(full), null);
  for (const key of ['add-1', 'nested-and-1', 'nested-or-1', 'add-1.2', 'and-1.2.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true, key); click(control(e.tree(), key));
  }
  assert.equal(e.changes, 0); assert.deepEqual(e.value, before);
  editLeaf(e.tree(), '1.2.8', leaf('polar_sink', 20)); assert.equal(e.changes, 1);
  assert.equal((e.html().match(/This-turn shipment destination/g) ?? []).length, 16);
});

void test('depth-four allows deepest leaf edits and shallow nesting while directly invoked fifth-depth controls no-op', () => {
  const e = editor(groupsDeep(4));
  assert.deepEqual(shipmentExpressionInputSize(e.value), { leaves: 5, depth: 4 });
  for (const key of ['and-1', 'or-1.1.1.1.1', 'nested-and-1.1.1.1', 'nested-or-1.1.1.1']) {
    assert.equal(control(e.tree(), key).props.disabled, true, key); click(control(e.tree(), key));
  }
  assert.equal(e.changes, 0);
  editLeaf(e.tree(), '1.1.1.1.1', leaf('arrakeen', 20));
  click(control(e.tree(), 'add-1.1.1.1')); click(control(e.tree(), 'or-1.2'));
  assert.deepEqual(shipmentExpressionInputSize(e.value), { leaves: 7, depth: 4 });
  assert.equal(shipmentExpressionInputError(e.value), null);
});

void test('invalid numeric leaves remain editable and structurally addable while full parser validation blocks Ask', () => {
  for (const minimum of [NaN, -1, 0, 0.5, 21, Infinity]) {
    const e = editor({ op: 'or', terms: [leaf(), leaf('carthag'), leaf('arrakeen', minimum)] });
    assert.equal(shipmentExpressionInputError(e.value), null);
    const ask = askTree(projected(), question(e.value));
    assert.equal(ask.button.props.disabled, true); click(ask.button); assert.deepEqual(ask.actions, []);
    assert.match(ask.html(), /Choose a minimum of one to twenty physical forces/);
    click(control(e.tree(), 'add-1')); assert.ok('op' in e.value); assert.equal(e.value.terms.length, 4);
    editLeaf(e.tree(), '1.3', leaf('arrakeen', 2));
    assert.deepEqual(parseShipmentExpression(e.value), e.value);
  }
});

void test('busy disables the fieldset and guards actual add, wrap, remove, switch and leaf callbacks', () => {
  const initial: ShipmentExpression = { op: 'and', terms: [leaf(), leaf('carthag')] }, e = editor(initial, true);
  assert.match(e.html(), /<fieldset\b[^>]*disabled=""[^>]*data-testid="shipment-expression"/);
  for (const key of ['add-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'or-1.1', 'remove-1.2']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  switchGroup(e.tree(), '1', 'or'); editLeaf(e.tree(), '1.2', leaf('polar_sink', 7));
  assert.equal(e.changes, 0); assert.deepEqual(e.value, initial);
});

void test('Ask forwards the exact full three-, eight-, sixteen-leaf and nested question without adding fields', () => {
  const expressions: ShipmentExpression[] = [
    ...[3, 8, 16].map(count => ({ op: 'or' as const, terms: TERRITORIES.slice(0, count).map(place => leaf(place.id)) })),
    { op: 'and', terms: [leaf(), { op: 'or', terms: [leaf('carthag'), leaf('polar_sink'), leaf('sietch_tabr')] }] }, groupsDeep(4),
  ];
  for (const expression of expressions) {
    const value = question(expression), before = structuredClone(value), ask = askTree(projected(), value);
    assert.equal(ask.button.props.disabled, false); click(ask.button);
    assert.deepEqual(ask.actions, [{ type: 'truthAsk', question: value }]);
    assert.equal((ask.actions[0] as { question: unknown }).question, value);
    assert.deepEqual(value, before); assert.match(ask.html(), /data-testid="truth-shipment-preview"/);
  }
  const legacy: Extract<TruthQuestion, { kind: 'shipment' }> = { kind: 'shipment', target: 't', territory: 'arrakeen', minimum: 3 };
  const ask = askTree(projected(), legacy); click(ask.button);
  assert.deepEqual(ask.actions, [{ type: 'truthAsk', question: legacy }]);
});

void test('constants, malformed late leaves, excessive width or depth and singleton groups block the whole Ask', () => {
  const invalid: ShipmentExpression[] = [
    { op: 'or', terms: [leaf(), leaf('carthag'), { constant: 'yes' }] },
    { op: 'or', terms: [leaf(), { op: 'and', terms: [leaf(), { constant: 'no' }] }] },
    { op: 'or', terms: [leaf(), leaf('carthag'), leaf('not-a-territory')] },
    { op: 'or', terms: Array.from({ length: 17 }, () => leaf()) },
    { op: 'and', terms: [leaf()] }, groupsDeep(5),
  ];
  for (const expression of invalid) {
    const ask = askTree(projected(), question(expression));
    assert.equal(ask.button.props.disabled, true); click(ask.button); assert.deepEqual(ask.actions, []);
    assert.doesNotThrow(ask.html); assert.match(ask.html(), /role="alert"/);
  }
  for (const constant of ['yes', 'no', 'unknown'] as const) {
    const expression: ShipmentExpression = { op: 'or', terms: [leaf(), { constant }] };
    assert.match(shipmentExpressionInputError(expression)!, /reserved for internal/);
  }
});

void test('busy, actual queue owner, target seating and authoritative offered targets guard Ask and editor callbacks', () => {
  const cases: { game: GameView; value?: Extract<TruthQuestion, { kind: 'shipment' }>; busy?: boolean }[] = [{ game: projected(), busy: true }];
  for (const stage of ['priority', 'answer', 'unknown'] as const) {
    const game = projected(); game.truthtrance!.stage = stage; cases.push({ game });
  }
  for (const owner of ['t', 'not-seated']) {
    const game = projected(); game.truthtrance!.queue[0].player = owner; cases.push({ game });
  }
  const unseated = projected(); unseated.me = 'not-seated'; unseated.truthtrance!.queue[0].player = 'not-seated'; cases.push({ game: unseated });
  const empty = projected(); empty.truthtrance!.queue = []; cases.push({ game: empty });
  const absent = projected(); absent.truthtrance = null; cases.push({ game: absent });
  const unsupported = projected(); unsupported.truthShipmentTargets = []; cases.push({ game: unsupported });
  for (const target of ['a', 'not-seated']) cases.push({ game: projected(), value: question(leaf(), target) });
  for (const entry of cases) {
    const ask = askTree(entry.game, entry.value ?? question(leaf()), entry.busy);
    assert.equal(ask.button.props.disabled, true); click(ask.button);
    const fields = elements(ask.tree).find(element => element.type === ShipmentExpressionFields);
    if (fields) {
      assert.equal(fields.props.disabled, true);
      (fields.props.onChange as (next: ShipmentExpression) => void)(leaf('polar_sink'));
    }
    assert.deepEqual(ask.actions, []); assert.deepEqual(ask.changes, []); assert.doesNotThrow(ask.html);
  }
  const game = projected(), stale = askTree(game, question(leaf()));
  const fields = elements(stale.tree).find(element => element.type === ShipmentExpressionFields); assert.ok(fields);
  for (const mutate of [
    () => { game.truthtrance!.stage = 'answer'; },
    () => { game.truthtrance!.stage = 'ask'; game.truthtrance!.queue[0].player = 't'; },
    () => { game.truthtrance!.queue[0].player = 'a'; game.truthShipmentTargets = []; },
    () => { game.truthShipmentTargets = ['t']; game.players = game.players.filter(player => player.id !== 't'); },
  ]) {
    mutate(); click(stale.button); (fields.props.onChange as (next: ShipmentExpression) => void)(leaf('polar_sink'));
  }
  assert.deepEqual(stale.actions, []); assert.deepEqual(stale.changes, []);
});

void test('guidance describes the whole eventual shipment, aggregate No and skip without new consent or private feasibility reads', () => {
  const game = projected();
  for (const player of game.players) for (const field of ['hand', 'traitors', 'spice', 'reserves', 'forces', 'leaders'])
    Object.defineProperty(player, field, { get() { throw Error(`Shipment authoring read private ${field}`); } });
  for (const field of ['truthShipmentAnswers', 'shipmentCompletion', 'truthAnswer', 'truthKnowledge'])
    Object.defineProperty(game, field, { get() { throw Error(`Shipment authoring read private ${field}`); } });
  const ask = askTree(game, question({ op: 'or', terms: [leaf(), leaf('carthag'), leaf('sietch_tabr')] }));
  const html = ask.html();
  assert.match(html, /same eventual shipment from reserves this turn/);
  assert.match(html, /No requires the whole expression to be false/);
  assert.match(html, /Skipping shipment makes every condition false/);
  assert.match(html, /Groups do not count as conditions/); assert.match(html, /not additional printed rules/);
  assert.match(html, /Arrakeen/); assert.match(html, / OR /);
  assert.doesNotMatch(html, /Confirm question|Acknowledge|Current fact type/);
  click(ask.button); assert.equal(ask.actions.length, 1);
});
