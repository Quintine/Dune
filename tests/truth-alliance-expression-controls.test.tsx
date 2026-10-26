import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AllianceExpressionFields, allianceExpressionInputError } from '../components/alliance-expression-fields';
import { AllianceExpressionPromises } from '../components/alliance-expression-promises';
import { AlliancePromises, AlliancePromiseGuideButton } from '../components/alliance-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { parseAllianceExpression, type AllianceExpression } from '../game/alliance-expression-promises';
import { createTechTokens } from '../game/tech-tokens';

type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const partners = [{ id: 'r', name: 'Partner' }, { id: 'a', name: 'Asker' }];
const partner = (id = 'r'): AllianceExpression => ({ kind: 'partner', partner: id });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value); assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-alliance-expression-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-alliance-expression-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function editor(initial: AllianceExpression, disabled = false, choices = partners) {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => AllianceExpressionFields({ value, partners: choices, disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(AllianceExpressionFields, { value, partners: choices, disabled, onChange() {} })),
  };
}
function nested(depth: number): AllianceExpression {
  let value = partner();
  for (let i = 0; i < depth; i++) value = { kind: 'and', terms: [value, partner('a')] };
  return value;
}
function guide(props: Parameters<typeof AlliancePromiseGuideButton>[0]) {
  const button = AlliancePromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(AllianceExpressionPromises, { game, busy: false, send() {} }));

/** Controlled own projections prove UI behavior. Native consent, answer
 * feasibility and the actual Nexus closing event have separate engine proof. */
function projected(kind: 'accept' | 'break' | 'ready' = 'accept', advanced = false): GameView {
  const source = createGame('TRUTHALLIANCEEXPRESSIONCONTROLS', newPlayer('p', 'Respondent', 'emperor'), advanced);
  joinGame(source, newPlayer('a', 'Asker', 'harkonnen'));
  joinGame(source, newPlayer('r', 'Partner', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = 1; game.nexus = true; game.spiceWindow = null;
  game.active = 'a'; game.ready = []; game.alliancePromiseNexus = { turn: 2 };
  game.alliancePromises = []; game.mixedAlliancePromises = [];
  game.allianceExpressionPromises = [{ event: 'controlled-pure-alliance', player: 'p', asker: 'a', turn: 2,
    claim: kind === 'break' ? partner() : { kind: 'or', terms: [partner(), partner('a')] }, answer: kind !== 'break' }];
  game.allianceOffers = kind === 'accept' ? { r: 'p' } : {};
  if (kind !== 'accept') {
    game.players.find(player => player.id === 'p')!.ally = 'r';
    game.players.find(player => player.id === 'r')!.ally = 'p';
  }
  game.alliancePromiseGuide = { action: { type: kind === 'ready' ? 'ready' : 'alliance',
    ...(kind === 'ready' ? {} : { target: kind === 'accept' ? 'r' : null }), alliancePromiseEvent: 'controlled-pure-alliance' } };
  return game;
}

void test('all sixteen final partner clauses remain controlled with complete AND/OR branches and singleton collapse', () => {
  const e = editor(partner()); click(control(e.tree(), 'or-1'));
  assert.deepEqual(e.value, { kind: 'or', terms: [partner(), partner('')] });
  assert.ok(allianceExpressionInputError(e.value, partners)); select(e.tree(), '1.2', 'partner', 'a');
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-1')); select(e.tree(), `1.${count}`, 'partner', count % 2 ? 'r' : 'a');
  }
  assert.ok(e.value.kind === 'or'); assert.equal(e.value.terms.length, 16);
  assert.deepEqual(parseAllianceExpression(e.value), e.value); assert.match(e.html(), /16 \/ 16 conditions/);
  assert.equal((e.html().match(/Named alliance partner/g) ?? []).length, 16);
  const ids = [...e.html().matchAll(/ id="([^"]+)"/g)].map(match => match[1]); assert.equal(new Set(ids).size, ids.length);
  const before = structuredClone(e.value), changes = e.changes;
  for (const key of ['add-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
  const grouped = editor({ kind: 'and', terms: [partner(), partner('a')] });
  click(control(grouped.tree(), 'or-1.2')); select(grouped.tree(), '1.2', 'meaning', 'and');
  click(control(grouped.tree(), 'nested-or-1')); click(control(grouped.tree(), 'nested-and-1'));
  assert.ok(grouped.value.kind === 'and'); assert.equal(grouped.value.terms.length, 4);
  click(control(grouped.tree(), 'remove-1.2.2')); assert.deepEqual(grouped.value.terms[1], partner('a'));
  click(control(grouped.tree(), 'remove-1.4')); click(control(grouped.tree(), 'remove-1.3'));
  click(control(grouped.tree(), 'remove-1.1')); assert.deepEqual(grouped.value, partner('a'));
});

void test('four grouping levels and strict envelopes coexist with repairable unnamed or removed partner drafts', () => {
  const deep = editor(nested(4)); assert.equal(allianceExpressionInputError(deep.value, partners), null);
  assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['and-1', 'or-1.1.1.1.1', 'nested-and-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 0); select(deep.tree(), '1.1.1.1.1', 'partner', 'a'); assert.equal(deep.changes, 1);
  const draft = editor(partner('removed')); assert.match(draft.html(), /role="alert"/);
  click(control(draft.tree(), 'or-1')); assert.ok(draft.value.kind === 'or'); assert.deepEqual(draft.value.terms[0], partner('removed'));
  select(draft.tree(), '1.1', 'partner', 'a'); select(draft.tree(), '1.2', 'partner', 'r');
  assert.equal(allianceExpressionInputError(draft.value, partners), null);
  for (const invalid of [nested(5), { kind: 'and', terms: [partner()] }, { kind: 'or', terms: Array.from({ length: 17 }, () => partner()) },
    { kind: 'partner', partner: '' }, { kind: 'partner', partner: ' r ' }, { kind: 'partner', partner: 'r', source: 'hidden' },
    { kind: 'or', terms: [partner(), partner('a')], binding: true }, { kind: 'alliance', partner: 'r' }])
    assert.ok(allianceExpressionInputError(invalid, partners));
  assert.ok(allianceExpressionInputError(partner(), []));
});

void test('disabled callbacks and unlisted partner selections preserve the complete controlled expression', () => {
  const frozen = editor({ kind: 'and', terms: [partner(), partner('a')] }, true), before = structuredClone(frozen.value);
  for (const key of ['add-1', 'nested-and-1', 'or-1', 'remove-1.2']) click(control(frozen.tree(), key));
  select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.2', 'partner', 'r');
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
  const e = editor(partner());
  for (const id of ['unknown', '', ' r ', 'p']) select(e.tree(), '1', 'partner', id);
  assert.equal(e.changes, 0); select(e.tree(), '1', 'partner', 'a'); assert.deepEqual(e.value, partner('a'));
  const empty = editor(partner(), false, []); select(empty.tree(), '1', 'partner', 'r'); assert.equal(empty.changes, 0);
});

void test('own panel retains raw alternatives, whole No and passive settled history without exposing private sources', () => {
  const game = projected(); game.alliancePromiseGuide = null;
  game.allianceExpressionPromises.push(
    { ...game.allianceExpressionPromises[0], event: 'no-event', answer: false, claim: { kind: 'and', terms: [partner(), partner('a')] } },
    { ...game.allianceExpressionPromises[0], event: 'done-event', fulfilled: true },
    { ...game.allianceExpressionPromises[0], event: 'released-event', released: true },
    { ...game.allianceExpressionPromises[0], event: 'foreign-event', player: 'a', claim: partner('foreign-partner') },
  );
  for (const promise of game.allianceExpressionPromises) Object.defineProperty(promise, 'source', {
    get() { throw Error('No private Nexus source'); }, configurable: true,
  });
  const html = markup(game);
  assert.match(html, /You answered Yes/); assert.match(html, /You answered No/); assert.match(html, / OR /); assert.match(html, / AND /);
  assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /Legal alternatives remain available; no fixed branch is selected for you/);
  assert.match(html, /Yes and No settle only at the actual Nexus close/);
  assert.match(html, /Forming an alliance does not fulfill the answer early/); assert.match(html, /Offers alone are not alliances/);
  assert.match(html, /Fulfilled at the Nexus close/); assert.match(html, /Released: this commitment is no longer possible/);
  assert.match(html, /href="\/rules#truthtrance-alliance-expression"/);
  assert.doesNotMatch(html, /foreign-partner|controlled-pure-alliance|foreign-event|data-testid="alliance-promise-guide"/);
  assert.equal(AllianceExpressionPromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('exact canonical guides accept either OR alternative, break as preparation and require visible scalar and pure outcomes', () => {
  for (const advanced of [false, true]) for (const kind of ['accept', 'break', 'ready'] as const) {
    const game = projected(kind, advanced), sent: Action[] = [];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.alliancePromiseGuide!.action);
    assert.notEqual(game.active, game.me);
  }
  const alternative = projected(); alternative.allianceOffers = { a: 'p' }; alternative.alliancePromiseGuide!.action.target = 'a';
  const sent: Action[] = []; press(guide({ game: alternative, busy: false, send(action) { sent.push(action); } }));
  assert.equal(sent[0], alternative.alliancePromiseGuide!.action);
  for (const game of [projected(), projected('ready')]) {
    game.allianceExpressionPromises[0].claim = partner('a');
    assert.equal(guide({ game, busy: false, send() { assert.fail('Visible pure outcome must match'); } }).props.disabled, true);
  }
  const scalar = projected(); scalar.alliancePromises.push({ event: 'earlier-scalar', player: 'p', asker: 'a', turn: 2,
    partner: 'r', answer: false });
  assert.equal(guide({ game: scalar, busy: false, send() {} }).props.disabled, true);
  const preparation = projected('ready'); preparation.alliancePromiseGuide!.action = { type: 'alliance', target: null,
    alliancePromiseEvent: 'controlled-pure-alliance' };
  assert.equal(guide({ game: preparation, busy: false, send() {} }).props.disabled, false);
  const noReady = projected('ready'); noReady.allianceExpressionPromises[0].answer = false;
  assert.equal(guide({ game: noReady, busy: false, send() {} }).props.disabled, true);
});

void test('stale pure callbacks retain exact event, action, public consent context, room and Nexus guards', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 2; }, game => { game.status = 'setup'; },
    game => { game.nexus = false; }, game => { game.ready = ['p']; }, game => { game.alliancePromiseNexus = null; },
    game => { game.alliancePromiseNexus!.turn = 1; }, game => { game.allianceOffers = {}; },
    game => { game.allianceOffers.a = 'p'; }, game => { game.players.find(player => player.id === 'a')!.ally = 'r'; },
    game => { game.alliancePromiseGuide = { action: { ...game.alliancePromiseGuide!.action } }; },
    game => { game.alliancePromiseGuide = null; }, game => { game.alliancePromiseGuide!.action.target = null; },
    game => { game.allianceExpressionPromises[0].event = 'expired'; }, game => { game.allianceExpressionPromises[0].player = 'a'; },
    game => { game.allianceExpressionPromises[0].turn = 1; }, game => { game.allianceExpressionPromises[0].fulfilled = true; },
    game => { game.allianceExpressionPromises[0].released = true; }, game => { game.allianceExpressionPromises = []; },
    game => { game.players = game.players.filter(player => player.id !== 'r'); },
    game => { game.spiceWindow = { territory: 'hagga_basin', sector: 12, amount: 6, harvested: false }; },
    game => { game.phaseOpening = { passed: [] }; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
    game => { game.automaticContinuationPending = true; }, game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.techTokens = createTechTokens(); },
  ];
  for (const change of changes) {
    const game = projected(), sent: Action[] = [], button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); change(game); press(button); assert.deepEqual(sent, []);
  }
  for (const target of ['p', 'missing']) {
    const game = projected(); game.alliancePromiseGuide!.action.target = target;
    assert.equal(guide({ game, busy: false, send() {} }).props.disabled, true);
  }
  for (const event of ['', 'unrelated']) {
    const game = projected(); game.alliancePromiseGuide!.action.alliancePromiseEvent = event;
    const button = guide({ game, busy: false, send() { assert.fail('Unknown event'); } }); assert.equal(button.props.disabled, true); press(button);
  }
  const busy = { game: projected(), busy: false, send() { assert.fail('Busy guide'); } };
  const oldBusy = guide(busy); busy.busy = true; press(oldBusy);
  const replaced = { game: projected(), busy: false, send() { assert.fail('Replaced projection'); } };
  const oldReplaced = guide(replaced); replaced.game = { ...replaced.game }; press(oldReplaced);
});

void test('one live scalar or pure panel owns the shared guide while private card, spice and Nexus sources are untouched', () => {
  const game = projected(), sent: Action[] = [];
  const both = () => renderToStaticMarkup(createElement('div', null,
    createElement(AlliancePromises, { game, busy: false, send() {} }),
    createElement(AllianceExpressionPromises, { game, busy: false, send() {} })));
  const one = () => assert.equal((both().match(/data-testid="alliance-promise-guide"/g) ?? []).length, 1);
  game.alliancePromises.push({ event: 'scalar-history', player: 'p', asker: 'a', turn: 1, partner: 'r', answer: true, fulfilled: true });
  one(); assert.match(markup(game), /data-testid="alliance-promise-guide"/);
  game.alliancePromises.push({ event: 'live-scalar', player: 'p', asker: 'a', turn: 2, partner: 'r', answer: true });
  one(); assert.doesNotMatch(markup(game), /data-testid="alliance-promise-guide"/);
  game.alliancePromises[1].fulfilled = true; one();
  for (const seat of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'bribes', 'reserves', 'tanks'])
    Object.defineProperty(seat, key, { get() { throw Error(`No private ${key}`); }, configurable: true });
  for (const promise of game.allianceExpressionPromises) Object.defineProperty(promise, 'source', { get() { throw Error('No Nexus source'); } });
  assert.match(markup(game), /Accept Partner’s alliance invitation/);
  press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.equal(sent[0], game.alliancePromiseGuide!.action);
  game.allianceExpressionPromises[0].fulfilled = true; assert.doesNotMatch(both(), /data-testid="alliance-promise-guide"/);
});
