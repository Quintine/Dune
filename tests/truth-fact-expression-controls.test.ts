import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { TruthFactExpressionFields } from '../components/truth-fact-expression-fields';
import { TruthFactQuestion } from '../components/truth-fact-question';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { truthFactExpressionError, truthFactExpressionSize } from '../game/truth-fact-expression';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import type { TruthFact, TruthQuestion } from '../game/truthtrance';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
  },
});
const { Truthtrance } = await import('../components/truthtrance');
aliases.deregister();

// Controlled entitled projections supplement the separate native card journeys.
// No authoritative hand, question result or continuation is installed in a Game.
// Only hook-free components are invoked directly. React renders TruthFactFields
// and its stateful descendants; leaf edits cross its actual onChange boundary.
function projected(): GameView {
  const game = createGame('TRUTHFACTCONTROLS', newPlayer('a', 'Asker', 'atreides'), false);
  joinGame(game, newPlayer('t', 'Target', 'emperor'));
  joinGame(game, newPlayer('o', 'Observer', 'harkonnen'));
  const view = viewGame(game, 'a');
  view.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'projected-truth-card' }], passed: [], question: null };
  return view;
}
const hand = (name = 'Shield'): TruthFact => ({ kind: 'hand', name });
const spice = (value: number): TruthFact => ({ kind: 'spice', compare: 'gte', value });
const factQuestion = (fact: TruthFact, target = 't'): Extract<TruthQuestion, { kind: 'fact' }> => ({ kind: 'fact', target, fact });
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function control(tree: ReactNode, key: string): Element {
  const found = elements(tree).find(element => element.props['data-truth-fact-control'] === key);
  assert.ok(found, `Control ${key} is rendered`);
  return found;
}
function click(button: Element) { (button.props.onClick as () => void)(); }
function fieldset(tree: ReactNode, path: string): Element {
  const found = elements(tree).find(element => element.props['data-truth-fact-path'] === path);
  assert.ok(found, `Fact or group ${path} is rendered`);
  return found;
}
function editLeaf(tree: ReactNode, path: string, next: TruthFact) {
  const field = elements(fieldset(tree, path)).find(element => element.type === TruthFactFields);
  assert.ok(field, `Current fact fields for ${path} are rendered`);
  (field.props.onChange as (fact: TruthFact) => void)(next);
}
function switchGroup(tree: ReactNode, path: string, kind: string) {
  const select = elements(fieldset(tree, path)).find(element => element.type === 'select');
  assert.ok(select, `Group meaning selector ${path} is rendered`);
  (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: kind } });
}
function editor(initial: TruthFact, game = projected(), disabled = false) {
  let value = initial;
  let changes = 0;
  return {
    get value() { return value; },
    get changes() { return changes; },
    tree: () => TruthFactExpressionFields({ value, game, target: 't', disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(TruthFactExpressionFields, {
      value, game, target: 't', disabled, onChange() {},
    })),
  };
}
function askTree(game: GameView, question: Extract<TruthQuestion, { kind: 'fact' }>, busy = false) {
  const actions: Action[] = [];
  const changes: TruthFact[] = [];
  const props = { game, question, busy, act(action: Action) { actions.push(action); }, onChange(next: TruthFact) { changes.push(next); } };
  const tree = TruthFactQuestion(props);
  const button = elements(tree).find(element => element.props['data-testid'] === 'truth-fact-ask');
  assert.ok(button, 'The actual Ask action is rendered');
  return { tree, button, actions, changes, html: () => renderToStaticMarkup(createElement(TruthFactQuestion, props)) };
}
function groupsDeep(depth: number): TruthFact {
  let fact = hand();
  for (let level = 1; level <= depth; level++) fact = { kind: 'and', terms: [fact, spice(level)] };
  return fact;
}

void test('actual add and leaf-edit callbacks author three through eight terms without losing prior facts', () => {
  const first: TruthFact = { kind: 'handCount', name: 'Shield', compare: 'eq', value: 2 };
  const e = editor(first);
  click(control(e.tree(), 'and-1'));
  editLeaf(e.tree(), '1.2', { kind: 'traitor', leader: CHEAP_HERO_TRAITOR });
  for (let count = 3; count <= 8; count++) {
    const before = structuredClone(e.value);
    click(control(e.tree(), 'add-1'));
    editLeaf(e.tree(), `1.${count}`, spice(count));
    assert.ok(e.value.kind === 'and');
    assert.equal(e.value.terms.length, count);
    assert.deepEqual(e.value.terms.slice(0, count - 1), (before as Extract<TruthFact, { kind: 'and' | 'or' }>).terms);
    assert.deepEqual(e.value.terms[count - 1], spice(count));
  }
  assert.ok(e.value.kind === 'and');
  assert.deepEqual(e.value.terms[0], first);
  const html = e.html();
  assert.equal((html.match(/Current fact type/g) ?? []).length, 8);
  assert.match(html, /9 \/ 16 total clauses/);
  const before = structuredClone(e.value), changes = e.changes;
  assert.equal(control(e.tree(), 'add-1').props.disabled, true);
  click(control(e.tree(), 'add-1'));
  assert.equal(e.changes, changes);
  assert.deepEqual(e.value, before);
});

void test('nested AND and OR callbacks preserve every branch while switching group meaning', () => {
  const e = editor(hand('Snooper'));
  click(control(e.tree(), 'and-1'));
  editLeaf(e.tree(), '1.2', spice(7));
  click(control(e.tree(), 'or-1.2'));
  editLeaf(e.tree(), '1.2.2', { kind: 'handInventory', category: 'defense', compare: 'lte', value: 3 });
  click(control(e.tree(), 'add-1.2'));
  editLeaf(e.tree(), '1.2.3', { kind: 'stormForecast', compare: 'gte', value: 2 });
  const before = structuredClone(e.value);
  assert.ok(before.kind === 'and');
  const originalNested = before.terms[1];
  assert.ok(originalNested.kind === 'or');
  switchGroup(e.tree(), '1.2', 'and');
  assert.deepEqual(e.value, { kind: 'and', terms: [hand('Snooper'), {
    kind: 'and', terms: [spice(7), { kind: 'handInventory', category: 'defense', compare: 'lte', value: 3 }, { kind: 'stormForecast', compare: 'gte', value: 2 }],
  }] });
  switchGroup(e.tree(), '1.2', 'or');
  assert.deepEqual(e.value, before);
  const changes = e.changes;
  switchGroup(e.tree(), '1.2', 'single');
  assert.equal(e.changes, changes);
  click(control(e.tree(), 'nested-1.2'));
  assert.ok(e.value.kind === 'and');
  const nested = e.value.terms[1];
  assert.ok(nested.kind === 'or');
  assert.deepEqual(nested.terms.slice(0, 3), originalNested.terms);
  assert.deepEqual(nested.terms[3], { kind: 'and', terms: [hand(), hand()] });
  assert.match(e.html(), /Group 1\.2 · OR/);
  assert.match(e.html(), /Group 1\.2\.4 · AND/);
});

void test('removing a fact collapses a singleton group and removing a group keeps the full survivor', () => {
  const retained: TruthFact = { kind: 'forceCount', zone: { kind: 'location', territory: 'carthag', sector: 10 }, counter: 'total', compare: 'eq', value: 4 };
  const e = editor({ kind: 'or', terms: [hand(), { kind: 'and', terms: [spice(9), retained] }] });
  click(control(e.tree(), 'remove-1.2.1'));
  assert.deepEqual(e.value, { kind: 'or', terms: [hand(), retained] });
  assert.equal(truthFactExpressionError(e.value), null);
  click(control(e.tree(), 'remove-1.1'));
  assert.deepEqual(e.value, retained);
  assert.equal(truthFactExpressionError(e.value), null);
  const nestedSurvivor: TruthFact = { kind: 'or', terms: [spice(1), spice(2), spice(3)] };
  const whole = editor({ kind: 'and', terms: [{ kind: 'and', terms: [hand(), hand('Snooper')] }, nestedSurvivor] });
  click(control(whole.tree(), 'remove-1.1'));
  assert.deepEqual(whole.value, nestedSurvivor);
});

void test('the sixteen-node envelope guards add and wrap callbacks without truncating the maximum expression', () => {
  const full: TruthFact = { kind: 'and', terms: [
    { kind: 'or', terms: Array.from({ length: 8 }, (_, index) => spice(index)) },
    { kind: 'and', terms: Array.from({ length: 5 }, (_, index) => spice(index + 8)) },
  ] };
  assert.deepEqual(truthFactExpressionSize(full), { nodes: 16, depth: 2 });
  const e = editor(full), before = structuredClone(full);
  for (const key of ['add-1', 'nested-1', 'add-1.2', 'and-1.2.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true, key);
    click(control(e.tree(), key));
  }
  assert.equal(e.changes, 0);
  assert.deepEqual(e.value, before);
  assert.equal((e.html().match(/Current fact type/g) ?? []).length, 13);
  editLeaf(e.tree(), '1.2.5', { kind: 'handCount', name: 'Snooper', compare: 'eq', value: 4 });
  assert.equal(e.changes, 1, 'Editing an existing leaf is still available at the maximum');
  assert.deepEqual(truthFactExpressionSize(e.value), { nodes: 16, depth: 2 });
});

void test('four levels allow shallow nesting and deepest leaf edits while rejecting a fifth level in actual callbacks', () => {
  const e = editor(groupsDeep(4));
  assert.deepEqual(truthFactExpressionSize(e.value), { nodes: 9, depth: 4 });
  for (const key of ['and-1', 'or-1.1.1.1.1', 'nested-1.1.1.1']) {
    assert.equal(control(e.tree(), key).props.disabled, true, key);
    click(control(e.tree(), key));
  }
  assert.equal(e.changes, 0);
  editLeaf(e.tree(), '1.1.1.1.1', hand('Snooper'));
  click(control(e.tree(), 'add-1.1.1.1'));
  assert.deepEqual(truthFactExpressionSize(e.value), { nodes: 10, depth: 4 });
  assert.equal(control(e.tree(), 'or-1.2').props.disabled, false);
  click(control(e.tree(), 'or-1.2'));
  assert.deepEqual(truthFactExpressionSize(e.value), { nodes: 12, depth: 4 });
  assert.equal(truthFactExpressionError(e.value), null);
});

void test('busy disables the outer fieldset and guards directly invoked add, wrap, remove, switch and leaf callbacks', () => {
  const initial: TruthFact = { kind: 'and', terms: [hand(), spice(3)] };
  const e = editor(initial, projected(), true);
  assert.match(e.html(), /<fieldset\b[^>]*disabled=""[^>]*data-testid="truth-fact-expression"/);
  for (const key of ['add-1', 'nested-1', 'and-1.1', 'or-1.1', 'remove-1.2']) {
    assert.equal(control(e.tree(), key).props.disabled, true, key);
    click(control(e.tree(), key));
  }
  switchGroup(e.tree(), '1', 'or');
  editLeaf(e.tree(), '1.2', spice(999));
  assert.equal(e.changes, 0);
  assert.deepEqual(e.value, initial);
});

void test('Ask sends the exact complete three-term, eight-term and nested question payload', () => {
  const facts: TruthFact[] = [
    { kind: 'and', terms: [hand('Shield'), hand('Snooper'), spice(6)] },
    { kind: 'or', terms: Array.from({ length: 8 }, (_, index) => spice(index)) },
    { kind: 'and', terms: [hand(), { kind: 'or', terms: [spice(5), hand('Snooper'), { kind: 'traitor', leader: CHEAP_HERO_TRAITOR }] }] },
  ];
  for (const fact of facts) {
    const game = projected(), question = factQuestion(fact), before = structuredClone(question);
    const ask = askTree(game, question);
    assert.equal(ask.button.props.disabled, false);
    click(ask.button);
    assert.deepEqual(ask.actions, [{ type: 'truthAsk', question }]);
    assert.deepEqual(Object.keys(ask.actions[0]).sort(), ['question', 'type']);
    assert.deepEqual(question, before);
    assert.match(ask.html(), /data-testid="truth-fact-preview"/);
  }
});

void test('the stateful parent renders the default Shield expression with one public Ask action', () => {
  for (const busy of [false, true]) {
    const game = projected();
    const html = renderToStaticMarkup(createElement(Truthtrance, { game, busy, act() {} }));
    assert.match(html, /Verified current facts/);
    assert.match(html, /data-testid="truth-fact-expression"/);
    assert.match(html, /Is it true that you hold Shield\?/);
    assert.equal((html.match(/Current fact type/g) ?? []).length, 1);
    assert.equal((html.match(/Ask publicly/g) ?? []).length, 1);
    const button = html.match(/<button\b(?=[^>]*data-testid="truth-fact-ask")[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(button);
    assert.equal(/\sdisabled=/.test(button), busy);
    assert.doesNotMatch(html, /Both · AND|Either · OR|Combine conditions/);
  }
});

void test('a malformed third leaf blocks the whole AND or OR despite valid earlier clauses', () => {
  const invalid: TruthFact[] = [
    spice(-1), { kind: 'handCount', name: 'Shield', compare: 'eq', value: 0.5 },
    { kind: 'handInventory', category: 'all', compare: 'gte', value: NaN },
    { kind: 'prediction', field: 'turn', compare: 'eq', value: 0 },
    { kind: 'stormDial', compare: 'gte', value: 21 }, { kind: 'stormForecast', compare: 'lte', value: 0 },
    { kind: 'noFieldValue', value: 7 } as unknown as TruthFact,
    { kind: 'faceDancer', leader: 'not-a-leader' },
    { kind: 'forceCount', zone: { kind: 'reserves' }, counter: 'total', compare: 'gte', value: -1 },
  ];
  for (const kind of ['and', 'or'] as const) for (const fact of invalid) {
    const ask = askTree(projected(), factQuestion({ kind, terms: [hand(), spice(0), fact] }));
    assert.equal(ask.button.props.disabled, true, `${kind}: ${fact.kind}`);
    click(ask.button);
    assert.deepEqual(ask.actions, []);
    assert.match(ask.html(), /Resolve the marked current-fact fields before asking/);
  }
});

void test('over-width, over-node, over-depth and singleton expressions cannot reach Ask and remain fully rendered', () => {
  const invalid: TruthFact[] = [
    { kind: 'and', terms: [hand()] },
    { kind: 'or', terms: Array.from({ length: 9 }, (_, index) => spice(index)) },
    { kind: 'and', terms: [
      { kind: 'or', terms: Array.from({ length: 8 }, (_, index) => spice(index)) },
      { kind: 'and', terms: Array.from({ length: 6 }, (_, index) => spice(index + 8)) },
    ] },
    groupsDeep(5),
  ];
  for (const fact of invalid) {
    const ask = askTree(projected(), factQuestion(fact));
    assert.equal(ask.button.props.disabled, true);
    click(ask.button);
    assert.deepEqual(ask.actions, []);
    const html = ask.html();
    assert.match(html, /role="alert"/);
    const leafCount = (value: TruthFact): number => value.kind === 'and' || value.kind === 'or'
      ? value.terms.reduce((count, term) => count + leafCount(term), 0) : 1;
    assert.equal((html.match(/Current fact type/g) ?? []).length, leafCount(fact));
  }
});

void test('busy, wrong owner, absent windows and invalid targets guard Ask and the editor change callback', () => {
  const question = factQuestion(hand());
  const cases: { game: GameView; question?: typeof question; busy?: boolean }[] = [{ game: projected(), busy: true }];
  for (const stage of ['priority', 'answer', 'unknown'] as const) {
    const game = projected(); game.truthtrance!.stage = stage; cases.push({ game });
  }
  for (const owner of ['t', 'not-seated']) {
    const game = projected(); game.truthtrance!.queue[0].player = owner; cases.push({ game });
  }
  const unseated = projected(); unseated.me = 'not-seated'; unseated.truthtrance!.queue[0].player = 'not-seated'; cases.push({ game: unseated });
  const empty = projected(); empty.truthtrance!.queue = []; cases.push({ game: empty });
  const absent = projected(); absent.truthtrance = null; cases.push({ game: absent });
  for (const target of ['a', 'not-seated']) cases.push({ game: projected(), question: factQuestion({
    kind: 'forceCount', zone: { kind: 'reserves' }, counter: 'total', compare: 'gte', value: 1,
  }, target) });
  for (const entry of cases) {
    const ask = askTree(entry.game, entry.question ?? question, entry.busy);
    assert.equal(ask.button.props.disabled, true);
    click(ask.button);
    const fields = elements(ask.tree).find(element => element.type === TruthFactExpressionFields);
    if (fields) {
      assert.equal(fields.props.disabled, true);
      (fields.props.onChange as (next: TruthFact) => void)(spice(9));
    }
    assert.deepEqual(ask.actions, []);
    assert.deepEqual(ask.changes, []);
    assert.doesNotThrow(ask.html);
  }
  const game = projected(), stale = askTree(game, question);
  game.truthtrance!.stage = 'answer';
  click(stale.button);
  assert.deepEqual(stale.actions, [], 'The existing callback rechecks the live ask stage');
  game.truthtrance!.stage = 'ask'; game.truthtrance!.queue[0].player = 't';
  click(stale.button);
  assert.deepEqual(stale.actions, [], 'The existing callback rechecks the live queue owner');
  game.truthtrance!.queue[0].player = 'a';
  game.players = game.players.filter(player => player.id !== question.target);
  click(stale.button);
  assert.deepEqual(stale.actions, [], 'The existing callback rechecks the live target seat');
});

void test('meaning, current custody, app limits and public leader labels persist with the editor and preview', () => {
  const game = projected(), leader = game.allLeaders[0];
  const ask = askTree(game, factQuestion({ kind: 'and', terms: [
    { kind: 'traitor', leader: leader.id },
    { kind: 'or', terms: [hand(), { kind: 'traitor', leader: CHEAP_HERO_TRAITOR }] },
  ] }));
  for (let render = 0; render < 3; render++) {
    const html = ask.html();
    assert.match(html, /AND requires all conditions; OR requires at least one/);
    assert.match(html, /one aggregate answer/);
    assert.match(html, /No makes the whole expression false, not necessarily every condition/);
    assert.match(html, /Current facts are evaluated when the player answers/);
    assert.match(html, /no promise to keep cards, spice or forces afterward/);
    assert.match(html, /App limits: 8 terms per group, 16 total clauses/);
    assert.match(html, /not additional printed rules/);
    assert.ok(html.includes(`${leader.name} is your traitor`));
    assert.match(html, /Cheap Hero \/ Heroine is your traitor/);
    assert.doesNotMatch(html, /Confirm question|Acknowledge/);
  }
});

void test('all current-fact controls and actual Ask callbacks avoid opponent private holdings or expected answers', () => {
  const game = projected();
  for (const player of game.players) for (const field of [
    'hand', 'traitors', 'faceDancers', 'spice', 'leaders', 'forces', 'handLimit', 'prediction', 'noField',
  ]) Object.defineProperty(player, field, { get() { throw Error(`Current fact controls read private ${field}`); } });
  for (const field of ['truthAnswer', 'truthKnowledge', 'truthHistory'])
    Object.defineProperty(game, field, { get() { throw Error(`Current fact controls read ${field}`); } });
  const facts: TruthFact[] = [
    hand(), spice(5), { kind: 'handCount', name: 'Snooper', compare: 'eq', value: 1 },
    { kind: 'handInventory', category: 'weapon', compare: 'gte', value: 2 },
    { kind: 'traitor', leader: game.allLeaders[0].id }, { kind: 'faceDancer', leader: CHEAP_HERO_TRAITOR },
    { kind: 'prediction', field: 'faction', faction: 'atreides' },
    { kind: 'prediction', field: 'turn', compare: 'eq', value: 2 },
    { kind: 'stormDial', compare: 'lte', value: 20 }, { kind: 'stormForecast', compare: 'gte', value: 1 },
    { kind: 'noFieldValue', value: 3 },
    { kind: 'forceCount', zone: { kind: 'reserves' }, counter: 'total', compare: 'eq', value: 4 },
  ];
  for (const fact of facts) {
    const question = factQuestion(fact), ask = askTree(game, question);
    assert.equal(ask.button.props.disabled, false, fact.kind);
    assert.doesNotThrow(ask.html);
    click(ask.button);
    assert.deepEqual(ask.actions, [{ type: 'truthAsk', question }]);
  }
});
