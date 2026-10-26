import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MixedTraitorFields, mixedTraitorInputError } from '../components/mixed-traitor-fields';
import { MixedTraitorPromises } from '../components/mixed-traitor-promises';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { TraitorDecisionAnswers, TraitorDecisionPromises } from '../components/traitor-decision-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { mixedActionExpressionSize, type MixedActionExpression } from '../game/mixed-action-question';
import type { TraitorActionClaim } from '../game/mixed-traitor-question';
import type { TruthFact } from '../game/truthtrance';
import { createTruthTraitorDecisionFixture } from './fixture-truth-traitor-decision';

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
const { GameTable } = await import('../components/game-table');
aliases.deregister();

type Expression = MixedActionExpression<TraitorActionClaim>;
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const fact = (value: TruthFact = { kind: 'hand', name: 'Shield' }): Expression => ({ kind: 'fact', fact: value });
const declaration = (call = true): Expression => ({ kind: 'action', action: { call } });
const claim = (): Expression => ({ kind: 'or', terms: [fact(), { kind: 'and', terms: [declaration(), declaration(false)] }] });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value);
  assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-mixed-traitor-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-mixed-traitor-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function editFact(tree: ReactNode, path: string, next: TruthFact) {
  const scope = find(tree, 'data-mixed-traitor-fact-path', path);
  const fields = elements(scope).find(element => element.type === TruthFactFields);
  assert.ok(fields, `Current fact fields ${path}`);
  (fields.props.onChange as (fact: TruthFact) => void)(next);
}
function textContent(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isValidElement<ElementProps>(node)) return textContent(node.props.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
function answer(tree: ReactNode, label: string): Element {
  const found = elements(tree).find(element => typeof element.props.onClick === 'function' && textContent(element) === `Answer ${label}`);
  assert.ok(found, `Answer ${label}`); return found;
}

/** Controlled views prove original-tree editing, aggregate display and saved
 * callback guards. The native source suite owns actual Truthtrance lifecycle. */
function projected(): GameView {
  const source = createGame('TRUTHMIXEDTRAITORCONTROLS', newPlayer('p', 'Respondent', 'emperor'), false);
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = 6;
  game.truthMixedTraitorTargets = ['p', 'a'];
  game.truthMixedTraitorAnswers = ['yes', 'no', 'unknown'];
  game.mixedTraitorPromises = [{ event: 'controlled-mixed-traitor-question', player: 'p', asker: 'a', turn: 2,
    battle: 'controlled-native-battle', territory: 'arrakeen', mixed: claim(), answer: true, fulfilled: false, released: false }];
  game.battle = { event: 'controlled-native-battle', territory: 'arrakeen', attacker: 'p', defender: 'a', revealed: true,
    submitted: ['p', 'a'], plans: {}, traitorSubmitted: [], traitorVoters: ['p', 'a'], traitorCallChoices: [false, true], ownTraitorPromises: [],
  } as unknown as NonNullable<GameView['battle']>;
  game.truthtrance = { stage: 'answer', queue: [{ player: 'a', card: 'controlled-truth-card' }], passed: [], question: {
    kind: 'mixedTraitorCall', target: 'p', battle: 'controlled-native-battle', territory: 'arrakeen', mixed: claim(),
  } };
  return game;
}
function editor(initial: Expression, disabled = false, game = projected(), target = 'p') {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => MixedTraitorFields({ value, game, target, disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(MixedTraitorFields, { value, game, target, disabled, onChange() {} })),
    error: () => mixedTraitorInputError(value, game, target),
  };
}
const markup = (game: GameView) => renderToStaticMarkup(createElement(MixedTraitorPromises, { game }));
const answerMarkup = (game: GameView) => renderToStaticMarkup(createElement(TraitorDecisionAnswers, { game, busy: false, act() {} }));

void test('mixed Traitor editor preserves sixteen original leaves without plan node or eight-term limits', () => {
  const e = editor(fact()); click(control(e.tree(), 'or-1'));
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-action-1')); select(e.tree(), `1.${count}`, 'call', count % 2 ? 'decline' : 'reveal');
  }
  const full = e.value; assert.ok(full.kind === 'or'); assert.equal(full.terms.length, 16);
  assert.deepEqual(full.terms[0], fact()); assert.deepEqual(full.terms[2], declaration(false));
  assert.deepEqual(full.terms[15], declaration()); assert.equal(e.error(), null);
  assert.deepEqual(mixedActionExpressionSize(full), { leaves: 16, nodes: 17, depth: 1, maxTerms: 16 });
  const html = e.html(), ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.match(html, /16 \/ 16 conditions/); assert.match(html, /Reveal traitor/); assert.match(html, /Decline traitor/);
  assert.equal((html.match(/>Traitor declaration<\/label>/g) ?? []).length, 15);
  assert.equal(new Set(ids).size, ids.length); assert.doesNotMatch(html, /total clauses|8 conditions per group/);
  assert.ok(!elements(e.tree()).some(element => typeof element.props.id === 'string' && /-(battle|territory|leader|beneficiary|target)$/.test(element.props.id)));
  const before = structuredClone(full), changes = e.changes;
  for (const key of ['add-fact-1', 'add-action-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'fact-and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true, key); click(control(e.tree(), key));
  }
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
});

void test('mixed Traitor edits preserve every fact and declaration branch through collapse and depth-four grouping', () => {
  const e = editor({ kind: 'and', terms: [fact(), declaration(false)] });
  click(control(e.tree(), 'fact-or-1.1')); editFact(e.tree(), '1.1.2', { kind: 'stormForecast', compare: 'gte', value: 4 });
  select(e.tree(), '1.1', 'fact-meaning', 'and'); click(control(e.tree(), 'fact-add-1.1'));
  editFact(e.tree(), '1.1.3', { kind: 'spice', compare: 'gte', value: 7 });
  click(control(e.tree(), 'or-1.2')); select(e.tree(), '1.2', 'meaning', 'and');
  click(control(e.tree(), 'nested-or-1')); click(control(e.tree(), 'nested-and-1'));
  assert.ok(e.value.kind === 'and'); assert.equal(e.value.terms.length, 4); assert.equal(e.error(), null);
  assert.match(e.html(), /Current-fact group 1\.1/);
  click(control(e.tree(), 'fact-remove-1.1.3')); click(control(e.tree(), 'fact-remove-1.1.2'));
  click(control(e.tree(), 'remove-1.2.2')); click(control(e.tree(), 'remove-1.4')); click(control(e.tree(), 'remove-1.3'));
  assert.deepEqual(e.value, { kind: 'and', terms: [fact(), declaration(false)] });
  select(e.tree(), '1.2', 'timing', 'fact'); assert.ok(e.error());
  select(e.tree(), '1.2', 'timing', 'action'); assert.equal(e.error(), null);
  select(e.tree(), '1.2', 'call', 'decline'); click(control(e.tree(), 'remove-1.1'));
  assert.deepEqual(e.value, declaration(false)); assert.ok(e.error());
  click(control(e.tree(), 'and-1')); assert.equal(e.error(), null);
  let nested = fact();
  for (let depth = 0; depth < 4; depth++) nested = { kind: 'and', terms: [nested, declaration()] };
  const deep = editor(nested); assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['and-1', 'or-1.1.1.1.1', 'fact-and-1.1.1.1.1', 'nested-and-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 0);
  assert.ok(mixedTraitorInputError({ kind: 'and', terms: [nested, declaration()] }, projected(), 'p'));
});

void test('mixed Traitor fact drafts stay repairable, strict declaration leaves reject metadata, and disabled callbacks cannot edit', () => {
  for (const invalid of [NaN, -1, 0.5, Infinity]) {
    const e = editor({ kind: 'and', terms: [fact(), declaration()] });
    editFact(e.tree(), '1.1', { kind: 'spice', compare: 'gte', value: invalid }); assert.ok(e.error());
    click(control(e.tree(), 'or-1.2')); select(e.tree(), '1.2.1', 'call', 'decline');
    assert.ok(e.value.kind === 'and'); assert.deepEqual(e.value.terms[1], { kind: 'or', terms: [declaration(false), fact()] });
    assert.match(e.html(), /role="alert"/); editFact(e.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 2 }); assert.equal(e.error(), null);
  }
  for (const action of [{ call: 'yes' }, { call: 1 }, {}, { call: true, battle: 'other' }, { call: false, territory: 'carthag' },
    { call: true, leader: 'private' }, { call: false, canReveal: false }, { call: true, answer: true },
    { kind: 'or', terms: [{ call: true }, { call: false }] }])
    assert.ok(mixedTraitorInputError({ kind: 'and', terms: [fact(), { kind: 'action', action }] }, projected(), 'p'));
  const frozen = editor({ kind: 'and', terms: [fact(), declaration()] }, true), before = structuredClone(frozen.value);
  for (const key of ['and-1', 'add-action-1', 'nested-or-1', 'remove-1.2', 'fact-or-1.1']) click(control(frozen.tree(), key));
  select(frozen.tree(), '1.2', 'call', 'decline'); select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.2', 'timing', 'fact');
  editFact(frozen.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 4 });
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
});

void test('mixed Traitor authoring uses only public vocabulary for combatants and remote native Harkonnen voters', () => {
  const game = projected(); game.players[0].faction = 'harkonnen'; game.players[0].ally = 'a';
  for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'leaders', 'spice', 'forces', 'reserves', 'tanks', 'elites'])
    Object.defineProperty(player, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  for (const key of ['plans', 'traitorCallChoices', 'canReveal', 'cards', 'ownTraitorPromises']) Object.defineProperty(game.battle!, key, {
    get() { throw Error(`No native ${key} inspection`); }, configurable: true,
  });
  for (const key of ['deck', 'discard', 'truthMixedTraitorAnswers', 'truthTraitorAnswers']) Object.defineProperty(game, key, {
    get() { throw Error(`No private ${key} inspection`); }, configurable: true,
  });
  const e = editor({ kind: 'and', terms: [fact({ kind: 'stormForecast', compare: 'gte', value: 3 }), declaration(false)] }, false, game);
  assert.equal(e.error(), null); const html = e.html();
  assert.match(html, /native Harkonnen declaration for an ally/); assert.match(html, /Current facts are snapshotted at the answer/);
  assert.match(html, /conservative declaration commitment/); assert.match(html, /constant whole answer needs no declaration commitment/);
  assert.match(html, /original declaration fulfills a remaining commitment before a later Karama or betrayal response/);
  select(e.tree(), '1.2', 'call', 'reveal'); assert.equal(e.error(), null);
});

void test('own mixed Traitor history retains original whole answers and constant, bound and terminal statuses after battle cleanup', () => {
  const game = projected();
  game.mixedTraitorPromises.push(
    { ...game.mixedTraitorPromises[0], event: 'constant-whole-answer', answer: false, fulfilled: true },
    { ...game.mixedTraitorPromises[0], event: 'declared-whole-answer', fulfilled: true },
    { ...game.mixedTraitorPromises[0], event: 'released-whole-answer', released: true },
    { ...game.mixedTraitorPromises[0], event: 'foreign-question', player: 'a', mixed: { kind: 'and', terms: [fact({ kind: 'hand', name: 'Poison Blade' }), declaration(false)] } },
  );
  for (const promise of game.mixedTraitorPromises) for (const key of ['binding', 'requiredCall', 'residual', 'factAnswers', 'frozenFacts', 'compiled', 'canReveal', 'leader', 'beneficiary', 'progress'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  game.battle = null; game.truthtrance = null;
  const html = markup(game);
  assert.match(html, /Your mixed Traitor promises/); assert.match(html, /Turn 2/); assert.match(html, /Arrakeen/);
  assert.match(html, /You answered Yes/); assert.match(html, /You answered No/); assert.match(html, /you hold Shield/);
  assert.match(html, / OR /); assert.match(html, / AND /);
  assert.match(html, /This whole answer is binding/); assert.match(html, /Fulfilled: this whole commitment is complete/);
  assert.match(html, /Released: this whole commitment is no longer possible/);
  assert.match(html, /constant whole answer is complete immediately/i); assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /later Karama or betrayal response can still prevent its effect/);
  assert.doesNotMatch(html, /Poison Blade|controlled-mixed-traitor-question|declared-whole-answer|<button/);
  assert.equal(MixedTraitorPromises({ game: { ...game, me: 'missing' } }), null);
});

void test('aggregate Traitor answer controls forward exactly the offered parent answer and preserve scalar wording', () => {
  for (const [value, label] of [['yes', 'Yes'], ['no', 'No'], ['unknown', 'I don’t know']] as const) {
    const game = projected(), sent: Action[] = [];
    game.truthMixedTraitorAnswers = [value];
    const props = { game, busy: false, act(action: Action) { sent.push(action); } };
    const tree = TraitorDecisionAnswers(props), button = answer(tree, label);
    assert.equal(button.props.disabled, false); click(button);
    assert.deepEqual(sent, [{ type: 'truthAnswer', answer: value }]);
    const html = answerMarkup(game);
    assert.match(html, /Answer the whole mixed claim/); assert.match(html, /Current facts are snapshotted at the answer/);
    assert.match(html, /No makes the whole expression false, not each condition separately/);
    assert.match(html, /later Karama or betrayal response can still prevent its effect/);
  }
  const game = projected();
  game.truthtrance!.question = { kind: 'traitorCall', target: 'p', battle: game.battle!.event!, territory: 'arrakeen' };
  game.truthTraitorAnswers = ['no', 'yes'];
  const html = answerMarkup(game);
  assert.match(html, /Yes binds Reveal for this original Traitor decision; No binds decline/);
  assert.doesNotMatch(html, /Answer the whole mixed claim|I don’t know/);
  assert.equal(TraitorDecisionAnswers({ game: { ...game, me: 'a' }, busy: false, act() {} }), null);
  game.battle!.event = 'later-battle';
  assert.equal(TraitorDecisionAnswers({ game, busy: false, act() {} }), null);
});

void test('saved mixed Traitor answer callbacks reject busy, foreign, changed question and stale current battle sources', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn++; }, game => { game.battle = null; },
    game => { game.battle = { ...game.battle! }; }, game => { game.battle!.event = 'later-battle'; },
    game => { game.battle!.territory = 'carthag'; }, game => { game.battle!.revealed = false; },
    game => { game.battle!.traitorVoters = ['a']; }, game => { game.battle!.traitorSubmitted.push('p'); },
    game => { game.truthtrance = null; }, game => { game.truthtrance = { ...game.truthtrance! }; },
    game => { game.truthtrance!.stage = 'ask'; }, game => { game.truthtrance!.question = { ...game.truthtrance!.question! }; },
    game => { game.truthtrance!.queue[0] = { player: 'a', card: 'later-truth-card' }; },
    game => { game.truthtrance!.queue[0].player = 'p'; },
    game => { game.truthtrance!.question!.target = 'a'; },
    game => { const question = game.truthtrance!.question!; if (question.kind === 'mixedTraitorCall') question.battle = 'later-battle'; },
    game => { const question = game.truthtrance!.question!; if (question.kind === 'mixedTraitorCall') question.mixed = fact(); },
    game => { game.truthMixedTraitorAnswers = ['yes']; }, game => { game.truthMixedTraitorAnswers!.splice(0, 1); },
  ];
  for (const change of changes) {
    const game = projected(), sent: Action[] = [], props = { game, busy: false, act(action: Action) { sent.push(action); } };
    const button = answer(TraitorDecisionAnswers(props), 'Yes'); change(game); click(button); assert.deepEqual(sent, [], change.toString());
  }
  for (const change of [
    (props: Parameters<typeof TraitorDecisionAnswers>[0]) => { props.busy = true; },
    (props: Parameters<typeof TraitorDecisionAnswers>[0]) => { props.game = projected(); },
    (props: Parameters<typeof TraitorDecisionAnswers>[0]) => { props.act = () => assert.fail('Do not use a replaced parent callback'); },
  ]) {
    const sent: Action[] = [], props = { game: projected(), busy: false, act(action: Action) { sent.push(action); } };
    const button = answer(TraitorDecisionAnswers(props), 'Yes'); change(props); click(button); assert.deepEqual(sent, []);
  }
  const busy = { game: projected(), busy: true, act() { assert.fail('A busy answer cannot dispatch'); } };
  const button = answer(TraitorDecisionAnswers(busy), 'Yes'); assert.equal(button.props.disabled, true); click(button);
});

void test('ordinary native Traitor buttons follow the server choice array while mixed status adds no declaration button or scalar notice', () => {
  const f = createTruthTraitorDecisionFixture(), game = viewGame(f.game, f.target);
  game.mixedTraitorPromises = [{ event: 'controlled-native-mixed-question', player: f.target, asker: f.asker, turn: game.turn,
    battle: game.battle!.event!, territory: game.battle!.territory, mixed: claim(), answer: true, fulfilled: false, released: false }];
  game.battle!.ownTraitorPromises = [];
  const render = () => renderToStaticMarkup(createElement(GameTable, { game, busy: false, send: async () => {}, onExit() {} }));
  const disabled = (html: string, label: string) => {
    const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    const button = buttons.find(match => match[2].replace(/<[^>]*>/g, '').trim() === label); assert.ok(button, label);
    return /\bdisabled(?:[\s=>]|$)/.test(button[1]);
  };
  for (const choice of [true, false]) {
    game.battle!.traitorCallChoices = [choice];
    const html = render();
    assert.equal(disabled(html, 'Reveal traitor'), !choice);
    assert.equal(disabled(html, 'No traitor — resolve'), choice);
    if (!choice) {
      assert.match(html, /Your accepted Truthtrance answer requires declining this Traitor declaration/);
      assert.doesNotMatch(html, /You do not hold the opposing leader as a traitor/);
    }
    assert.equal(TraitorDecisionPromises({ game }), null);
    assert.doesNotMatch(markup(game), /<button/);
  }
});
