import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BribeExpressionFields, bribeExpressionInputError } from '../components/bribe-expression-fields';
import { BribeExpressionPromises } from '../components/bribe-expression-promises';
import { BribePromises, BribePromiseGuideButton } from '../components/bribe-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { parseBribeExpression, type BribeExpression } from '../game/bribe-expression-promises';
import { createTechTokens } from '../game/tech-tokens';

type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const recipients = [{ id: 'r', name: 'Recipient' }, { id: 'a', name: 'Asker' }];
const payment = (minimum = 1, recipient = 'r'): BribeExpression => ({ kind: 'payment', recipient, minimum });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value); assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-bribe-expression-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-bribe-expression-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function minimum(tree: ReactNode, path: string, valueAsNumber: number) {
  const input = find(tree, 'id', `truth-bribe-expression-${path}-minimum`);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber } });
}
function editor(initial: BribeExpression, disabled = false, choices = recipients) {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => BribeExpressionFields({ value, recipients: choices, disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(BribeExpressionFields, { value, recipients: choices, disabled, onChange() {} })),
  };
}
function nested(depth: number): BribeExpression {
  let value = payment();
  for (let i = 0; i < depth; i++) value = { kind: 'and', terms: [value, payment(2, 'a')] };
  return value;
}
function guide(props: Parameters<typeof BribePromiseGuideButton>[0]) {
  const button = BribePromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView, busy = false) => renderToStaticMarkup(createElement(BribeExpressionPromises, { game, busy, send() {} }));

/** These personalized projections exercise controlled UI behavior. They do not
 * install authoritative promises, cards, funding or ordinary payments. */
function projected(phase = 3, advanced = false): GameView {
  const source = createGame('TRUTHBRIBEEXPRESSIONCONTROLS', newPlayer('p', 'Respondent', 'emperor'), advanced);
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  joinGame(source, newPlayer('r', 'Recipient', 'harkonnen'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.active = 'a';
  game.auction = { bid: 0, bidder: null, active: 'a', remaining: 2, card: null, inspectionBlocked: null };
  game.bribeOptions = { available: 8, incoming: 0, blocked: null,
    targets: [{ id: 'r', maximum: 6, limitation: null }, { id: 'a', maximum: 8, limitation: null }] };
  game.bribeExpressionPromises = [{ event: 'controlled-bribe-expression-event', player: 'p', asker: 'a', turn: 2,
    claim: { kind: 'or', terms: [payment(3), { kind: 'and', terms: [payment(2, 'a'), payment(5)] }] },
    answer: true, progress: [{ recipient: 'r', amount: 1 }] }];
  game.bribePromiseGuide = { action: { type: 'bribe', target: 'r', amount: 2, bribePromiseEvent: 'controlled-bribe-expression-event' } };
  return game;
}

void test('whole-tree callbacks author all sixteen conditions, nested AND or OR, exact recipients and singleton collapse', () => {
  const e = editor(payment(2)); click(control(e.tree(), 'or-1'));
  assert.ok(e.value.kind === 'or'); assert.deepEqual(e.value.terms[1], payment(1, ''));
  assert.ok(bribeExpressionInputError(e.value)); select(e.tree(), '1.2', 'recipient', 'a');
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-1')); minimum(e.tree(), `1.${count}`, count);
    select(e.tree(), `1.${count}`, 'recipient', count % 2 ? 'r' : 'a');
  }
  assert.ok(e.value.kind === 'or'); assert.equal(e.value.terms.length, 16);
  assert.deepEqual(parseBribeExpression(e.value), e.value); assert.match(e.html(), /16 \/ 16 conditions/);
  assert.equal((e.html().match(/Minimum future ordinary bribe payments in spice/g) ?? []).length, 16);
  assert.match(e.html(), /max="9007199254740991"/);
  const before = structuredClone(e.value), changes = e.changes;
  for (const key of ['add-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
  const grouped = editor({ kind: 'and', terms: [payment(3), payment(2, 'a')] });
  click(control(grouped.tree(), 'or-1.2')); select(grouped.tree(), '1.2', 'meaning', 'and');
  click(control(grouped.tree(), 'nested-or-1')); click(control(grouped.tree(), 'nested-and-1'));
  assert.ok(grouped.value.kind === 'and'); assert.equal(grouped.value.terms.length, 4);
  click(control(grouped.tree(), 'remove-1.2.2')); assert.deepEqual(grouped.value.terms[1], payment(2, 'a'));
  click(control(grouped.tree(), 'remove-1.4')); click(control(grouped.tree(), 'remove-1.3'));
  click(control(grouped.tree(), 'remove-1.1')); assert.deepEqual(grouped.value, payment(2, 'a'));
});

void test('four-group depth limits hold while numeric drafts and new empty recipient choices remain repairable', () => {
  const deep = editor(nested(4)); assert.equal(bribeExpressionInputError(deep.value), null);
  assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['and-1', 'or-1.1.1.1.1', 'nested-and-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 0); minimum(deep.tree(), '1.1.1.1.1', Number.MAX_SAFE_INTEGER); assert.equal(deep.changes, 1);
  for (const invalid of [NaN, -1, 0, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
    const e = editor(payment()); minimum(e.tree(), '1', invalid);
    const draft = e.value; assert.ok(draft.kind === 'payment'); assert.ok(Object.is(draft.minimum, invalid));
    assert.ok(bribeExpressionInputError(e.value)); assert.match(e.html(), /role="alert"/);
    click(control(e.tree(), 'or-1')); const wrapped = e.value; assert.ok(wrapped.kind === 'or');
    assert.deepEqual(wrapped.terms[0], payment(invalid));
    minimum(e.tree(), '1.1', 2); select(e.tree(), '1.2', 'recipient', 'a');
    assert.equal(bribeExpressionInputError(e.value), null);
  }
  for (const invalid of [nested(5), { kind: 'and', terms: [payment()] }, { kind: 'or', terms: Array.from({ length: 17 }, () => payment()) },
    { kind: 'payment', recipient: '', minimum: 1 }, { kind: 'payment', recipient: 'r', minimum: 0 },
    { kind: 'gift', recipient: 'r', minimum: 1 }]) assert.ok(bribeExpressionInputError(invalid));
  const empty = editor(payment(1, ''), false, []); minimum(empty.tree(), '1', 2);
  assert.deepEqual(empty.value, payment(2, '')); assert.ok(bribeExpressionInputError(empty.value));
  select(empty.tree(), '1', 'recipient', 'r'); assert.equal(empty.changes, 1);
});

void test('disabled editor callbacks and unknown recipients cannot overwrite the controlled tree', () => {
  const frozen = editor({ kind: 'and', terms: [payment(), payment(2, 'a')] }, true), before = structuredClone(frozen.value);
  for (const key of ['add-1', 'nested-and-1', 'or-1', 'remove-1.2']) click(control(frozen.tree(), key));
  minimum(frozen.tree(), '1.1', 4); select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.2', 'recipient', 'r');
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
  const e = editor(payment()); select(e.tree(), '1', 'recipient', 'unknown'); select(e.tree(), '1', 'recipient', '');
  assert.equal(e.changes, 0); select(e.tree(), '1', 'recipient', 'a'); assert.deepEqual(e.value, payment(1, 'a'));
});

void test('own panels preserve the complete unpinned expression, per-recipient progress, whole No and terminal status', () => {
  const game = projected(); game.bribePromiseGuide = null;
  game.bribeExpressionPromises.push(
    { ...game.bribeExpressionPromises[0], event: 'no-expression', answer: false, claim: { kind: 'and', terms: [payment(3), payment(2, 'a')] } },
    { ...game.bribeExpressionPromises[0], event: 'fulfilled-expression', fulfilled: true },
    { ...game.bribeExpressionPromises[0], event: 'released-expression', released: true },
    { ...game.bribeExpressionPromises[0], event: 'foreign-expression', player: 'a', claim: payment(999, 'private-foreign-recipient') },
  );
  const before = structuredClone(game), html = markup(game);
  assert.match(html, /Your bribe expression promises/); assert.match(html, / OR /); assert.match(html, / AND /);
  assert.match(html, /Recorded future ordinary payments: Recipient: 1 spice; Asker: 0 spice/);
  assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /Legal alternatives remain available; no fixed branch is selected for you/);
  assert.match(html, /Smaller payments to the same recipient add together after the answer/);
  assert.match(html, /Prior payments, gifts and ally aid do not count/);
  assert.match(html, /Fulfilled: this commitment is complete/); assert.match(html, /Released: this commitment is no longer possible/);
  assert.match(html, /href="\/rules#truthtrance-bribe-expression"/);
  assert.doesNotMatch(html, /999|private-foreign-recipient|controlled-bribe-expression-event/); assert.deepEqual(game, before);
  assert.equal(BribeExpressionPromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('panels explain next-opening receipt, late next-turn collection and No lasting beyond opening collection', () => {
  const game = projected();
  for (const phase of [0, 1, 2, 3, 4, 5, 6, 7]) {
    game.phase = phase; const html = markup(game);
    assert.match(html, /Your next Mentat opening is still ahead/);
    assert.match(html, /Accepted payments count now and their recipients collect at that opening/);
    assert.match(html, /No stays binding until the actual turn ends; opening collection does not end it/);
  }
  game.phase = 8; const html = markup(game);
  assert.match(html, /Late payments still honor this turn’s answers; their recipients collect at next turn’s Mentat opening/);
  assert.match(html, /The sender pays immediately/); assert.match(html, /Collection does not count the payment a second time/);
  assert.match(html, /Payments made during Mentat Pause wait until the start of next turn&#x27;s Mentat Pause/);
  game.bribeExpressionPromises[0].fulfilled = true;
  assert.doesNotMatch(markup(game), /No stays binding until the actual turn ends/);
});

void test('one shared guide handles scalar and whole promises without duplicating the payment action', () => {
  const game = projected(); assert.match(markup(game), /data-testid="bribe-promise-guide"/);
  game.bribePromises = [{ event: 'scalar-history', player: 'p', asker: 'a', turn: 1, recipient: 'r', minimum: 1,
    answer: true, progress: 1, fulfilled: true }];
  // Historical scalar records do not own a newly live expression guide.
  assert.match(markup(game), /data-testid="bribe-promise-guide"/);
  const both = renderToStaticMarkup(createElement('div', null,
    createElement(BribePromises, { game, busy: false, send() {} }),
    createElement(BribeExpressionPromises, { game, busy: false, send() {} })));
  assert.equal((both.match(/data-testid="bribe-promise-guide"/g) ?? []).length, 1);
  assert.match(both, /Pay 2 spice to Recipient while honoring your answers/);
  game.bribePromises[0].player = 'a'; assert.match(markup(game), /data-testid="bribe-promise-guide"/);
});

void test('actual shared guide callbacks send the exact whole-expression native payment in every supported phase', () => {
  for (const advanced of [false, true]) for (let phase = 0; phase <= 8; phase++) {
    const game = projected(phase, advanced), sent: Action[] = [];
    game.ready = ['p'];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.bribePromiseGuide!.action]); assert.equal(sent[0], game.bribePromiseGuide!.action);
    press(guide({ ...props, busy: true })); assert.equal(sent.length, 1);
  }
});

void test('stale aggregate-event callbacks retain current ownership, exact phase, funding, room and quiet-window guards', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 8; }, game => { game.status = 'setup'; },
    game => { game.bribePromiseGuide = { action: { ...game.bribePromiseGuide!.action } }; },
    game => { game.bribePromiseGuide = null; }, game => { game.bribePromiseGuide!.action.amount = 3; },
    game => { game.bribeExpressionPromises[0].event = 'expired'; }, game => { game.bribeExpressionPromises[0].player = 'a'; },
    game => { game.bribeExpressionPromises[0].turn = 1; }, game => { game.bribeExpressionPromises[0].fulfilled = true; },
    game => { game.bribeExpressionPromises[0].released = true; }, game => { game.bribeExpressionPromises = []; },
    game => { game.players = game.players.filter(player => player.id !== 'r'); },
    game => { game.players.find(player => player.id === 'p')!.ally = 'r'; },
    game => { game.bribeOptions.blocked = 'Finish a decision first.'; }, game => { game.bribeOptions.blocked = ''; },
    game => { game.bribeOptions.available = 1; }, game => { game.bribeOptions.available = NaN; },
    game => { game.bribeOptions.targets[0].maximum = 1; }, game => { game.bribeOptions.targets[0].maximum = NaN; },
    game => { game.bribeOptions.targets = []; }, game => { game.phaseOpening = { passed: [] }; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
    game => { game.automaticContinuationPending = true; }, game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.techTokens = createTechTokens(); },
  ];
  for (const change of changes) {
    const game = projected(), sent: Action[] = [];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); change(game); press(button); assert.deepEqual(sent, []);
  }
  const props = { game: projected(), busy: false, send() { assert.fail('A now-busy expression guide cannot dispatch.'); } };
  const button = guide(props); props.busy = true; press(button);
  for (const event of ['', 'unrelated-event']) {
    const game = projected(), sent: Action[] = [];
    game.bribePromiseGuide!.action.bribePromiseEvent = event;
    const current = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(current.props.disabled, true); press(current); assert.deepEqual(sent, []);
  }
  const game = projected(), sent: Action[] = [];
  for (const seat of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'bribes', 'reserves', 'tanks'])
    Object.defineProperty(seat, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  Object.defineProperty(game.auction!, 'card', { get() { throw Error('No hidden lot inspection'); } });
  assert.match(markup(game), /Pay 2 spice to Recipient while honoring your answers/);
  press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.deepEqual(sent, [game.bribePromiseGuide!.action]);
});
