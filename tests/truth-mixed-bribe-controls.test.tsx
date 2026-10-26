import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MixedActionFields, type MixedActionConfig } from '../components/mixed-action-fields';
import { MixedBribeFields, mixedBribeInputError } from '../components/mixed-bribe-fields';
import { MixedBribePromises } from '../components/mixed-bribe-promises';
import { MixedMovementFields } from '../components/mixed-movement-fields';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { BribePromises, BribePromiseGuideButton } from '../components/bribe-promises';
import { BribeExpressionPromises } from '../components/bribe-expression-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { BribePaymentClaim } from '../game/mixed-bribe-question';
import type { TruthFact } from '../game/truthtrance';
import { createTechTokens } from '../game/tech-tokens';

type Expression = MixedActionExpression<BribePaymentClaim>;
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const fact = (value: TruthFact = { kind: 'hand', name: 'Shield' }): Expression => ({ kind: 'fact', fact: value });
const payment = (minimum = 1, recipient = 'r'): Expression => ({ kind: 'action', action: { recipient, minimum } });
const claim = (): Expression => ({ kind: 'or', terms: [fact(), { kind: 'and', terms: [payment(3), payment(2, 'a')] }] });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value);
  assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-mixed-bribe-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-mixed-bribe-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function minimum(tree: ReactNode, path: string, valueAsNumber: number) {
  const input = find(tree, 'id', `truth-mixed-bribe-${path}-minimum`);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber } });
}
function editFact(tree: ReactNode, path: string, next: TruthFact) {
  const scope = find(tree, 'data-mixed-bribe-fact-path', path);
  const fields = elements(scope).find(element => element.type === TruthFactFields);
  assert.ok(fields, `Current fact fields ${path}`);
  (fields.props.onChange as (fact: TruthFact) => void)(next);
}

/** Controlled personalized projections exercise UI ownership and callbacks.
 * Native answer-time snapshots, funding and real payments have separate proof. */
function projected(phase = 3, advanced = false): GameView {
  const source = createGame('TRUTHMIXEDBRIBECONTROLS', newPlayer('p', 'Respondent', 'emperor'), advanced);
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  joinGame(source, newPlayer('r', 'Recipient', 'harkonnen'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.active = 'a';
  game.auction = { bid: 0, bidder: null, active: 'a', remaining: 2, card: null, inspectionBlocked: null };
  game.bribeOptions = { available: 8, incoming: 0, blocked: null,
    targets: [{ id: 'r', maximum: 6, limitation: null }, { id: 'a', maximum: 8, limitation: null }] };
  game.bribePromises = []; game.bribeExpressionPromises = [];
  game.mixedBribePromises = [{ event: 'controlled-mixed-bribe-event', player: 'p', asker: 'a', turn: 2,
    mixed: claim(), answer: true, progress: [{ recipient: 'r', amount: 1 }], fulfilled: false, released: false }];
  game.bribePromiseGuide = { action: { type: 'bribe', target: 'r', amount: 2, bribePromiseEvent: 'controlled-mixed-bribe-event' } };
  return game;
}
function editor(initial: Expression, disabled = false, game = projected()) {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => MixedBribeFields({ value, game, target: 'p', disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(MixedBribeFields, { value, game, target: 'p', disabled, onChange() {} })),
    error: () => mixedBribeInputError(value, game, 'p'),
  };
}
function guide(props: Parameters<typeof BribePromiseGuideButton>[0]) {
  const button = BribePromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(MixedBribePromises, { game, busy: false, send() {} }));

void test('shared mixed editor adapts actions and keeps movement wrapper identifiers and fact controls stable', () => {
  type Probe = { token: string };
  let value: MixedActionExpression<Probe> = { kind: 'fact', fact: { kind: 'hand', name: 'Shield' } };
  const game = projected(); let parsed = 0;
  const config: MixedActionConfig<Probe> = {
    prefix: 'mixed-probe', legend: 'Probe claim', actionLabel: 'probe condition', actionTiming: 'Future probe',
    actionHelp: 'Probe mechanics', fallbackError: 'Choose a probe', maxLeaves: 16, maxDepth: 4,
    newAction: () => ({ token: 'exact-token' }),
    parseAction: input => { parsed++; return input as Probe; },
    renderAction: props => <label htmlFor={`${props.id}-token`}>{props.value.token}</label>,
  };
  const tree = () => MixedActionFields({ value, game, target: 'p', disabled: false, config, onChange(next) { value = next; } });
  click(find(tree(), 'data-mixed-probe-control', 'or-1'));
  assert.deepEqual(value, { kind: 'or', terms: [fact(), { kind: 'action', action: { token: 'exact-token' } }] });
  find(tree(), 'htmlFor', 'truth-mixed-probe-1.2-token'); assert.ok(parsed > 0);
  let movementChanges = 0;
  const movement = MixedMovementFields({ value: { kind: 'and', terms: [{ kind: 'fact', fact: { kind: 'hand', name: 'Shield' } },
    { kind: 'action', action: { territory: 'carthag', minimum: 2 } }] }, game, target: 'p', disabled: false,
  onChange() { movementChanges++; } });
  find(movement, 'id', 'truth-mixed-movement-1.2-territory');
  find(movement, 'data-mixed-movement-fact-path', '1.1');
  click(find(movement, 'data-mixed-movement-control', 'nested-or-1')); assert.equal(movementChanges, 1);
});

void test('mixed bribe editor preserves sixteen clauses, public recipients, unique IDs and safe integer minima without a spice cap', () => {
  const e = editor(fact()); click(control(e.tree(), 'or-1')); select(e.tree(), '1.2', 'recipient', 'r');
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-action-1')); minimum(e.tree(), `1.${count}`, count);
    select(e.tree(), `1.${count}`, 'recipient', count % 2 ? 'r' : 'a');
  }
  assert.ok(e.value.kind === 'or'); assert.equal(e.value.terms.length, 16); assert.equal(e.error(), null);
  minimum(e.tree(), '1.16', Number.MAX_SAFE_INTEGER); assert.equal(e.error(), null);
  const html = e.html(), ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length); assert.match(html, /16 \/ 16 conditions/);
  assert.equal((html.match(/Minimum future ordinary bribe payments in spice/g) ?? []).length, 15);
  assert.match(html, /max="9007199254740991"/);
  const before = structuredClone(e.value), changes = e.changes;
  for (const key of ['add-fact-1', 'add-action-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'fact-or-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
  const game = projected(); game.players.find(player => player.id === 'p')!.ally = 'r';
  const allied = editor({ kind: 'and', terms: [fact(), payment()] }, false, game);
  assert.ok(allied.error()); assert.doesNotMatch(allied.html(), /<option value="[pr]">/);
  select(allied.tree(), '1.2', 'recipient', 'a'); assert.equal(allied.error(), null);
  select(allied.tree(), '1.2', 'recipient', 'unlisted'); assert.equal(allied.changes, 1);
});

void test('nested mixed and fact groups share depth four and retain branches through meaning, timing and singleton collapse', () => {
  const e = editor({ kind: 'and', terms: [fact(), payment(3)] });
  click(control(e.tree(), 'or-1.2')); select(e.tree(), '1.2', 'meaning', 'and');
  click(control(e.tree(), 'nested-or-1')); select(e.tree(), '1.3.2', 'recipient', 'a');
  click(control(e.tree(), 'fact-or-1.1')); editFact(e.tree(), '1.1.2', { kind: 'stormForecast', compare: 'gte', value: 4 });
  select(e.tree(), '1.1', 'fact-meaning', 'and'); click(control(e.tree(), 'fact-add-1.1'));
  editFact(e.tree(), '1.1.3', { kind: 'spice', compare: 'gte', value: 7 }); assert.equal(e.error(), null);
  click(control(e.tree(), 'fact-remove-1.1.3')); click(control(e.tree(), 'fact-remove-1.1.2'));
  click(control(e.tree(), 'remove-1.2.2')); click(control(e.tree(), 'remove-1.3'));
  assert.deepEqual(e.value, { kind: 'and', terms: [fact(), payment(3)] });
  select(e.tree(), '1.2', 'timing', 'fact'); assert.ok(e.error());
  select(e.tree(), '1.2', 'timing', 'action'); select(e.tree(), '1.2', 'recipient', 'r'); assert.equal(e.error(), null);
  click(control(e.tree(), 'remove-1.1')); assert.deepEqual(e.value, payment()); assert.ok(e.error());
  let nested = fact();
  for (let depth = 0; depth < 3; depth++) nested = { kind: 'and', terms: [nested, payment()] };
  const deep = editor(nested); click(control(deep.tree(), 'fact-or-1.1.1.1'));
  assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['and-1', 'or-1.1.1.1', 'fact-and-1.1.1.1.1', 'fact-or-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 1);
});

void test('invalid action and fact drafts stay editable and disabled callbacks preserve the original tree', () => {
  for (const invalid of [NaN, -1, 0, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
    const e = editor({ kind: 'and', terms: [fact(), payment()] });
    minimum(e.tree(), '1.2', invalid); select(e.tree(), '1.2', 'recipient', ''); assert.ok(e.error());
    click(control(e.tree(), 'or-1.2')); assert.ok(e.value.kind === 'and');
    assert.deepEqual(e.value.terms[1], { kind: 'or', terms: [payment(invalid, ''), fact()] });
    assert.match(e.html(), /role="alert"/);
    minimum(e.tree(), '1.2.1', 2); select(e.tree(), '1.2.1', 'recipient', 'a'); assert.equal(e.error(), null);
    editFact(e.tree(), '1.1', { kind: 'spice', compare: 'gte', value: NaN }); assert.ok(e.error());
    editFact(e.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 2 }); assert.equal(e.error(), null);
  }
  const frozen = editor({ kind: 'and', terms: [fact(), payment()] }, true), before = structuredClone(frozen.value);
  for (const key of ['and-1', 'add-action-1', 'nested-or-1', 'remove-1.2', 'fact-or-1.1']) click(control(frozen.tree(), key));
  minimum(frozen.tree(), '1.2', 3); select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.1', 'timing', 'action');
  editFact(frozen.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 4 });
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
});

void test('current fact eligibility and aggregate editor guidance never inspect hidden custody or the held auction card', () => {
  const game = projected(), value: Expression = { kind: 'and', terms: [
    fact({ kind: 'stormForecast', compare: 'gte', value: 3 }), payment(2),
  ] };
  for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves', 'bribes'])
    Object.defineProperty(player, key, { get() { throw Error(`No ${key} inspection`); }, configurable: true });
  Object.defineProperty(game.auction!, 'card', { get() { throw Error('No hidden lot inspection'); } });
  const html = renderToStaticMarkup(createElement(MixedBribeFields, { value, game, target: 'p', disabled: false, onChange() {} }));
  assert.match(html, /Current facts are evaluated when the player answers/); assert.match(html, /Only the aggregate answer is shared/);
  assert.match(html, /unknown current fact can still allow a definite whole answer/);
  assert.match(html, /If no such value is available, the answer is I don’t know/);
  assert.equal(mixedBribeInputError(value, game, 'p'), null);
  assert.ok(mixedBribeInputError({ ...value, binding: true }, game, 'p'));
  assert.ok(mixedBribeInputError({ kind: 'and', terms: [fact(), { kind: 'constant', value: true }, payment()] }, game, 'p'));
  const sent: Action[] = []; press(guide({ game, busy: false, send(action) { sent.push(action); } }));
  assert.equal(sent[0], game.bribePromiseGuide!.action);
});

void test('own mixed panel shows raw whole question, aggregate answer and cumulative progress without private compiled fields', () => {
  const game = projected(); game.bribePromiseGuide = null;
  game.mixedBribePromises.push(
    { ...game.mixedBribePromises[0], event: 'no-event', answer: false },
    { ...game.mixedBribePromises[0], event: 'fulfilled-event', fulfilled: true },
    { ...game.mixedBribePromises[0], event: 'released-event', released: true },
    { ...game.mixedBribePromises[0], event: 'foreign-event', player: 'a', mixed: { kind: 'and', terms: [
      fact({ kind: 'hand', name: 'Poison Blade' }), payment(999, 'foreign-recipient'),
    ] } },
  );
  for (const promise of game.mixedBribePromises) for (const key of ['binding', 'bindingflag', 'residual', 'factAnswers', 'compiled', 'frozenFact'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  assert.match(html, /you hold Shield/); assert.match(html, /You answered Yes/); assert.match(html, /You answered No/);
  assert.match(html, / OR /); assert.match(html, / AND /); assert.match(html, /Recorded future ordinary payments: Recipient: 1 spice; Asker: 0 spice/);
  assert.match(html, /Fulfilled: this whole commitment is complete/); assert.match(html, /Released: this whole commitment is no longer possible/);
  assert.match(html, /Individual fact answers and any reduced future branch remain private/);
  assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /Smaller payments to the same recipient add together after the answer/);
  assert.match(html, /Prior payments, gifts and ally aid do not count/);
  assert.doesNotMatch(html, /Poison Blade|999|foreign-recipient|controlled-mixed-bribe-event|fulfilled-event|factAnswers/);
  assert.equal(MixedBribePromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('mixed receipts and exact native payment guide work through phases zero to eight in Basic and Advanced', () => {
  for (const advanced of [false, true]) for (let phase = 0; phase <= 8; phase++) {
    const game = projected(phase, advanced), sent: Action[] = [];
    game.ready = ['p'];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.bribePromiseGuide!.action]); assert.equal(sent[0], game.bribePromiseGuide!.action);
    const html = markup(game); assert.match(html, /data-testid="bribe-promise-guide"/);
    assert.match(html, /No stays binding until the actual turn ends; opening collection does not end it/);
    if (phase === 8) assert.match(html, /Late payments still honor this turn’s answers; their recipients collect at next turn’s Mentat opening/);
    else assert.match(html, /Your next Mentat opening is still ahead. Accepted payments count now and their recipients collect at that opening/);
  }
  const game = projected(8); game.mixedBribePromises[0].fulfilled = true;
  assert.doesNotMatch(markup(game), /No stays binding until the actual turn ends|data-testid="bribe-promise-guide"/);
  assert.match(markup(game), /Payments made during Mentat Pause wait until the start of next turn&#x27;s Mentat Pause/);
  assert.match(markup(game), /Collection does not count the payment a second time/);
});

void test('mixed stale native guide rejects changed event, owner, funding, phase, quiet window and room state', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 8; }, game => { game.status = 'setup'; },
    game => { game.bribePromiseGuide = { action: { ...game.bribePromiseGuide!.action } }; },
    game => { game.bribePromiseGuide = null; }, game => { game.bribePromiseGuide!.action.amount = 3; },
    game => { game.bribePromiseGuide!.action.target = 'a'; }, game => { game.bribePromiseGuide!.action.bribePromiseEvent = 'other'; },
    game => { game.mixedBribePromises[0].event = 'expired'; }, game => { game.mixedBribePromises[0].player = 'a'; },
    game => { game.mixedBribePromises[0].turn = 1; }, game => { game.mixedBribePromises[0].fulfilled = true; },
    game => { game.mixedBribePromises[0].released = true; }, game => { game.mixedBribePromises = []; },
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
    const game = projected(), sent: Action[] = [], button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); change(game); press(button); assert.deepEqual(sent, []);
  }
  const busy = { game: projected(), busy: false, send() { assert.fail('Busy guide cannot send'); } };
  const oldBusy = guide(busy); busy.busy = true; press(oldBusy);
  const replaced = { game: projected(), busy: false, send() { assert.fail('Replaced view cannot send'); } };
  const oldReplaced = guide(replaced); replaced.game = { ...replaced.game }; press(oldReplaced);
  for (const event of ['', 'other-event']) {
    const game = projected(); game.bribePromiseGuide!.action.bribePromiseEvent = event;
    const button = guide({ game, busy: false, send() { assert.fail('Unknown event cannot send'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
});

void test('one live panel owns the common exact guide across scalar, pure, mixed and fulfilled historical records', () => {
  const game = projected();
  const both = () => renderToStaticMarkup(createElement('div', null,
    createElement(BribePromises, { game, busy: false, send() {} }),
    createElement(BribeExpressionPromises, { game, busy: false, send() {} }),
    createElement(MixedBribePromises, { game, busy: false, send() {} })));
  const one = () => assert.equal((both().match(/data-testid="bribe-promise-guide"/g) ?? []).length, 1);
  assert.match(markup(game), /data-testid="bribe-promise-guide"/); one();
  game.bribePromises.push({ event: 'scalar-history', player: 'p', asker: 'a', turn: 1, recipient: 'r', minimum: 1,
    answer: true, progress: 1, fulfilled: true });
  game.bribeExpressionPromises.push({ event: 'pure-history', player: 'p', asker: 'a', turn: 1,
    claim: { kind: 'payment', recipient: 'r', minimum: 1 }, answer: true, progress: [{ recipient: 'r', amount: 1 }], fulfilled: true });
  assert.match(markup(game), /data-testid="bribe-promise-guide"/); one();
  game.bribeExpressionPromises.push({ event: 'live-pure', player: 'p', asker: 'a', turn: 2,
    claim: { kind: 'payment', recipient: 'r', minimum: 3 }, answer: true, progress: [] });
  assert.doesNotMatch(markup(game), /data-testid="bribe-promise-guide"/); one();
  game.bribePromises.push({ event: 'live-scalar', player: 'p', asker: 'a', turn: 2, recipient: 'r', minimum: 3,
    answer: true, progress: 0 });
  assert.doesNotMatch(renderToStaticMarkup(createElement(BribeExpressionPromises, { game, busy: false, send() {} })), /data-testid="bribe-promise-guide"/);
  one(); game.bribePromises[1].fulfilled = true; one();
  game.bribeExpressionPromises[1].fulfilled = true; assert.match(markup(game), /data-testid="bribe-promise-guide"/); one();
  game.mixedBribePromises[0].fulfilled = true;
  assert.doesNotMatch(both(), /data-testid="bribe-promise-guide"/);
});
