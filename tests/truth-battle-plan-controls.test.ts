import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BattleClaimFields } from '../components/battle-promises';
import { BattleClaimExpressionFields } from '../components/battle-claim-expression-fields';
import { TruthBattlePlanQuestion } from '../components/truth-battle-plan-question';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { battleClaimExpressionError, battleClaimExpressionSize } from '../game/battle-claim-expression';
import type { PlanClaim } from '../game/battle-promises';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import type { TruthQuestion } from '../game/truthtrance';

// Controlled projections supplement the separate earned native battle source.
// Hook-free components are invoked directly; React renders BattleClaimFields
// and its hook. Leaf edits cross the actual controlled onChange boundary.
function projected(): GameView {
  const game = createGame('TRUTHBATTLECONTROLS', newPlayer('a', 'Asker', 'atreides'), false);
  joinGame(game, newPlayer('t', 'Target', 'emperor'));
  joinGame(game, newPlayer('o', 'Observer', 'harkonnen'));
  const view = viewGame(game, 'a');
  view.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'projected-truth' }], passed: [], question: null };
  view.battle = { attacker: 'a', defender: 't', territory: 'arrakeen' } as NonNullable<GameView['battle']>;
  return view;
}
const dial = (value = 0): PlanClaim => ({ kind: 'dial', compare: 'eq', value });
const weapon = (name: string | null = null): PlanClaim => ({ kind: 'weapon', name });
type Question = Extract<TruthQuestion, { kind: 'battlePlan' }>;
const questionFor = (claim: PlanClaim, target = 't', territory = 'arrakeen'): Question => ({ kind: 'battlePlan', target, territory, claim });
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function control(tree: ReactNode, key: string): Element {
  const found = elements(tree).find(element => element.props['data-battle-claim-control'] === key);
  assert.ok(found, `Control ${key} is rendered`); return found;
}
function click(button: Element) { (button.props.onClick as () => void)(); }
function fieldset(tree: ReactNode, path: string): Element {
  const found = elements(tree).find(element => element.props['data-battle-claim-path'] === path);
  assert.ok(found, `Condition or group ${path} is rendered`); return found;
}
function editLeaf(tree: ReactNode, path: string, next: PlanClaim) {
  const field = elements(fieldset(tree, path)).find(element => element.type === BattleClaimFields);
  assert.ok(field, `Plan leaf ${path} is rendered`);
  (field.props.onChange as (claim: PlanClaim) => void)(next);
}
function switchGroup(tree: ReactNode, path: string, kind: string) {
  const select = elements(fieldset(tree, path)).find(element => element.type === 'select');
  assert.ok(select);
  (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: kind } });
}
function editor(initial: PlanClaim, disabled = false) {
  let value = initial, changes = 0;
  const game = projected();
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => BattleClaimExpressionFields({ value, game, disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(BattleClaimExpressionFields, { value, game, disabled, onChange() {} })),
  };
}
function askTree(game: GameView, question: Question, busy = false) {
  const actions: Action[] = [], changes: PlanClaim[] = [];
  const props = { game, question, busy, act(action: Action) { actions.push(action); }, onChange(next: PlanClaim) { changes.push(next); } };
  const tree = TruthBattlePlanQuestion(props);
  const button = elements(tree).find(element => element.props['data-testid'] === 'truth-battle-plan-ask');
  assert.ok(button, 'The actual Ask action is rendered');
  return { tree, button, actions, changes, html: () => renderToStaticMarkup(createElement(TruthBattlePlanQuestion, props)) };
}
function groupsDeep(depth: number): PlanClaim {
  let claim = weapon();
  for (let level = 1; level <= depth; level++) claim = { kind: 'and', terms: [claim, dial(level)] };
  return claim;
}

void test('actual group and leaf callbacks author three through eight plan conditions without losing earlier leaves', () => {
  const e = editor(weapon('Shield'));
  click(control(e.tree(), 'and-1'));
  editLeaf(e.tree(), '1.2', { kind: 'defense', name: null });
  for (let count = 3; count <= 8; count++) {
    const before = structuredClone(e.value);
    click(control(e.tree(), 'add-1'));
    editLeaf(e.tree(), `1.${count}`, dial(count));
    assert.ok(e.value.kind === 'and'); assert.equal(e.value.terms.length, count);
    assert.deepEqual(e.value.terms.slice(0, count - 1), (before as Extract<PlanClaim, { kind: 'and' | 'or' }>).terms);
    assert.deepEqual(e.value.terms[count - 1], dial(count));
  }
  const before = structuredClone(e.value), changes = e.changes;
  assert.equal((e.html().match(/Plan element/g) ?? []).length, 8);
  assert.match(e.html(), /9 \/ 16 total clauses/);
  assert.equal(control(e.tree(), 'add-1').props.disabled, true);
  click(control(e.tree(), 'add-1'));
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
});

void test('nested AND and OR callbacks edit the whole tree, switch meaning and add groups', () => {
  const e = editor(dial(2));
  click(control(e.tree(), 'and-1'));
  editLeaf(e.tree(), '1.2', weapon());
  click(control(e.tree(), 'or-1.2'));
  editLeaf(e.tree(), '1.2.2', { kind: 'kwisatz', use: false });
  click(control(e.tree(), 'add-1.2'));
  editLeaf(e.tree(), '1.2.3', { kind: 'support', compare: 'gte', value: 3 });
  const before = structuredClone(e.value);
  switchGroup(e.tree(), '1.2', 'and');
  assert.deepEqual(e.value, { kind: 'and', terms: [dial(2), { kind: 'and', terms: [
    weapon(), { kind: 'kwisatz', use: false }, { kind: 'support', compare: 'gte', value: 3 },
  ] }] });
  switchGroup(e.tree(), '1.2', 'or'); assert.deepEqual(e.value, before);
  const changes = e.changes;
  switchGroup(e.tree(), '1.2', 'single'); assert.equal(e.changes, changes);
  click(control(e.tree(), 'nested-1.2'));
  assert.ok(e.value.kind === 'and');
  const nested = e.value.terms[1]; assert.ok(nested.kind === 'or');
  assert.equal(nested.terms.length, 4);
  assert.deepEqual(nested.terms[3], { kind: 'and', terms: [dial(), dial()] });
  assert.match(e.html(), /Group 1\.2 · OR/); assert.match(e.html(), /Group 1\.2\.4 · AND/);
});

void test('removal collapses singleton groups and retains every branch of a surviving group', () => {
  const retained: PlanClaim = { kind: 'leader', leader: CHEAP_HERO_TRAITOR };
  const e = editor({ kind: 'or', terms: [weapon(), { kind: 'and', terms: [dial(9), retained] }] });
  click(control(e.tree(), 'remove-1.2.1'));
  assert.deepEqual(e.value, { kind: 'or', terms: [weapon(), retained] });
  click(control(e.tree(), 'remove-1.1')); assert.deepEqual(e.value, retained);
  const survivor: PlanClaim = { kind: 'or', terms: [dial(1), dial(2), dial(3)] };
  const whole = editor({ kind: 'and', terms: [{ kind: 'and', terms: [weapon(), dial()] }, survivor] });
  click(control(whole.tree(), 'remove-1.1')); assert.deepEqual(whole.value, survivor);
  assert.equal(battleClaimExpressionError(whole.value), null);
});

void test('sixteen nodes remain fully editable while add and wrap callbacks enforce the whole-tree budget', () => {
  const full: PlanClaim = { kind: 'and', terms: [
    { kind: 'or', terms: Array.from({ length: 8 }, (_, index) => dial(index)) },
    { kind: 'and', terms: Array.from({ length: 5 }, (_, index) => dial(index + 8)) },
  ] };
  const e = editor(full);
  assert.deepEqual(battleClaimExpressionSize(e.value), { nodes: 16, depth: 2 });
  for (const key of ['add-1', 'nested-1', 'add-1.2', 'and-1.2.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.equal(e.changes, 0); assert.deepEqual(e.value, full);
  assert.equal((e.html().match(/Plan element/g) ?? []).length, 13);
  editLeaf(e.tree(), '1.2.5', weapon('Snooper'));
  assert.equal(e.changes, 1); assert.deepEqual(battleClaimExpressionSize(e.value), { nodes: 16, depth: 2 });
});

void test('four grouping levels permit deepest leaf repair and shallow nesting but reject a fifth level', () => {
  const e = editor(groupsDeep(4));
  assert.deepEqual(battleClaimExpressionSize(e.value), { nodes: 9, depth: 4 });
  for (const key of ['and-1', 'or-1.1.1.1.1', 'nested-1.1.1.1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.equal(e.changes, 0);
  editLeaf(e.tree(), '1.1.1.1.1', weapon('Snooper'));
  click(control(e.tree(), 'add-1.1.1.1'));
  click(control(e.tree(), 'or-1.2'));
  assert.deepEqual(battleClaimExpressionSize(e.value), { nodes: 12, depth: 4 });
});

void test('busy guards direct add, wrap, remove, switch and leaf callbacks as well as native fieldset controls', () => {
  const initial: PlanClaim = { kind: 'and', terms: [weapon(), dial(3)] }, e = editor(initial, true);
  assert.match(e.html(), /<fieldset\b[^>]*disabled=""[^>]*data-testid="truth-battle-plan-expression"/);
  for (const key of ['add-1', 'nested-1', 'and-1.1', 'or-1.1', 'remove-1.2']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  switchGroup(e.tree(), '1', 'or'); editLeaf(e.tree(), '1.2', dial(-1));
  assert.equal(e.changes, 0); assert.deepEqual(e.value, initial);
});

void test('Ask sends exactly the complete three-term, eight-term and nested question with public leader identities', () => {
  const game = projected();
  const claims: PlanClaim[] = [
    { kind: 'and', terms: [dial(), weapon(), { kind: 'defense', name: null }] },
    { kind: 'or', terms: Array.from({ length: 8 }, (_, index) => dial(index)) },
    { kind: 'and', terms: [dial(), { kind: 'or', terms: [weapon(),
      { kind: 'leader', leader: game.allLeaders[0].id }, { kind: 'leader', leader: CHEAP_HERO_TRAITOR }] }] },
  ];
  for (const claim of claims) {
    const question = questionFor(claim), before = structuredClone(question), ask = askTree(game, question);
    assert.equal(ask.button.props.disabled, false); click(ask.button);
    assert.deepEqual(ask.actions, [{ type: 'truthAsk', question }]);
    assert.deepEqual(Object.keys(ask.actions[0]).sort(), ['question', 'type']);
    assert.deepEqual(question, before); assert.match(ask.html(), /data-testid="truth-battle-plan-preview"/);
  }
});

void test('every invalid third or nested leaf blocks Ask despite valid earlier AND or OR clauses', () => {
  const invalid: PlanClaim[] = [dial(-1), dial(0.25), dial(NaN), dial(41),
    { kind: 'support', compare: 'eq', value: 0.5 },
    { kind: 'dial', compare: 'not-a-comparison', value: 1 } as unknown as PlanClaim,
    weapon('Not an original card'), { kind: 'leader', leader: 'not-a-public-leader' },
    { kind: 'kwisatz', use: 'yes' } as unknown as PlanClaim,
  ];
  for (const kind of ['and', 'or'] as const) for (const bad of invalid) {
    for (const leaf of [bad, { kind: 'and', terms: [dial(), bad] } as PlanClaim]) {
      const ask = askTree(projected(), questionFor({ kind, terms: [dial(), weapon(), leaf] }));
      assert.equal(ask.button.props.disabled, true, `${kind}: ${bad.kind}`); click(ask.button);
      assert.deepEqual(ask.actions, []); assert.match(ask.html(), /Resolve the battle-plan fields before asking/);
    }
  }
  const e = editor({ kind: 'and', terms: [dial(), weapon(), dial()] });
  editLeaf(e.tree(), '1.3', dial(-1));
  assert.ok(e.value.kind === 'and'); assert.deepEqual(e.value.terms[2], dial(-1));
  editLeaf(e.tree(), '1.3', dial(0.5));
  assert.deepEqual(e.value.terms[2], dial(0.5), 'Invalid typing remains repairable');
});

void test('over-width, over-node, over-depth and singleton questions cannot Ask and keep all leaves visible', () => {
  const invalid: PlanClaim[] = [
    { kind: 'and', terms: [dial()] },
    { kind: 'or', terms: Array.from({ length: 9 }, (_, index) => dial(index)) },
    { kind: 'and', terms: [
      { kind: 'or', terms: Array.from({ length: 8 }, (_, index) => dial(index)) },
      { kind: 'and', terms: Array.from({ length: 6 }, (_, index) => dial(index)) },
    ] }, groupsDeep(5),
  ];
  const leaves = (claim: PlanClaim): number => claim.kind === 'and' || claim.kind === 'or'
    ? claim.terms.reduce((count, term) => count + leaves(term), 0) : 1;
  for (const claim of invalid) {
    const ask = askTree(projected(), questionFor(claim));
    assert.equal(ask.button.props.disabled, true); click(ask.button); assert.deepEqual(ask.actions, []);
    assert.match(ask.html(), /role="alert"/); assert.equal((ask.html().match(/Plan element/g) ?? []).length, leaves(claim));
  }
});

void test('live queue ownership, target seating, current battle and territory guard Ask and editor callbacks', () => {
  const question = questionFor(dial()), cases: { game: GameView; question?: Question; busy?: boolean }[] = [{ game: projected(), busy: true }];
  for (const stage of ['priority', 'answer', 'unknown'] as const) {
    const game = projected(); game.truthtrance!.stage = stage; cases.push({ game });
  }
  for (const owner of ['t', 'not-seated']) {
    const game = projected(); game.truthtrance!.queue[0].player = owner; cases.push({ game });
  }
  const unseated = projected(); unseated.me = 'not-seated'; unseated.truthtrance!.queue[0].player = 'not-seated'; cases.push({ game: unseated });
  const empty = projected(); empty.truthtrance!.queue = []; cases.push({ game: empty });
  const absent = projected(); absent.truthtrance = null; cases.push({ game: absent });
  const noBattle = projected(); noBattle.battle = null; cases.push({ game: noBattle });
  for (const target of ['a', 'o', 'not-seated']) cases.push({ game: projected(), question: questionFor(dial(), target) });
  cases.push({ game: projected(), question: questionFor(dial(), 't', 'carthag') });
  for (const entry of cases) {
    const ask = askTree(entry.game, entry.question ?? question, entry.busy);
    assert.equal(ask.button.props.disabled, true); click(ask.button);
    const fields = elements(ask.tree).find(element => element.type === BattleClaimExpressionFields);
    if (fields) {
      assert.equal(fields.props.disabled, true); (fields.props.onChange as (claim: PlanClaim) => void)(dial(9));
    }
    assert.deepEqual(ask.actions, []); assert.deepEqual(ask.changes, []); assert.doesNotThrow(ask.html);
  }
  for (const change of [
    (game: GameView) => { game.truthtrance!.stage = 'answer'; },
    (game: GameView) => { game.truthtrance!.queue[0].player = 't'; },
    (game: GameView) => { game.battle!.territory = 'carthag'; },
    (game: GameView) => { game.players = game.players.filter(player => player.id !== question.target); },
  ]) {
    const game = projected(), stale = askTree(game, question); change(game); click(stale.button);
    assert.deepEqual(stale.actions, [], 'An existing callback rechecks current public ownership and battle');
  }
});

void test('authoring does not infer private cards, plans, answer choices or later reveal policy', () => {
  const game = projected();
  game.battle!.revealed = true;
  for (const player of game.players) for (const field of ['hand', 'traitors', 'leaders', 'spice', 'forces'])
    Object.defineProperty(player, field, { get() { throw Error(`Authoring read private ${field}`); } });
  for (const field of ['plans', 'myPlan', 'compliantPlan'])
    Object.defineProperty(game.battle!, field, { get() { throw Error(`Authoring read private ${field}`); } });
  for (const field of ['truthBattleAnswers', 'truthAnswer', 'truthKnowledge'])
    Object.defineProperty(game, field, { get() { throw Error(`Authoring inferred ${field}`); } });
  const claim: PlanClaim = { kind: 'and', terms: [
    { kind: 'leader', leader: game.allLeaders[0].id }, weapon('Shield'),
    { kind: 'or', terms: [{ kind: 'leader', leader: CHEAP_HERO_TRAITOR }, dial(0.5)] },
  ] };
  const question = questionFor(claim), ask = askTree(game, question);
  assert.equal(ask.button.props.disabled, false); assert.doesNotThrow(ask.html); click(ask.button);
  assert.deepEqual(ask.actions, [{ type: 'truthAsk', question }]);
  const html = ask.html();
  assert.match(html, /AND requires all conditions; OR requires at least one/);
  assert.match(html, /No makes the whole expression false, not necessarily every condition/);
  assert.match(html, /App limits: 8 terms per group, 16 total clauses/);
  assert.match(html, /not additional printed rules/); assert.ok(html.includes(game.allLeaders[0].name));
  assert.match(html, /Cheap Hero \/ Heroine/); assert.doesNotMatch(html, /https?:\/\//);
});
