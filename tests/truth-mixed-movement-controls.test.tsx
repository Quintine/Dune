import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MixedMovementFields, mixedMovementInputError } from '../components/mixed-movement-fields';
import { MixedMovementPromises } from '../components/mixed-movement-promises';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { MovementExpressionPromiseGuideButton, MovementExpressionPromises } from '../components/movement-expression-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { MovementClaim } from '../game/movement-promises';
import type { TruthFact } from '../game/truthtrance';

type Expression = MixedActionExpression<MovementClaim>;
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const fact = (value: TruthFact = { kind: 'hand', name: 'Shield' }): Expression => ({ kind: 'fact', fact: value });
const move = (minimum = 1, territory = 'carthag'): Expression => ({ kind: 'action', action: { territory, minimum } });
const claim = (): Expression => ({ kind: 'or', terms: [fact(), { kind: 'and', terms: [move(4), move(2, 'arrakeen')] }] });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value);
  assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-mixed-movement-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-mixed-movement-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function minimum(tree: ReactNode, path: string, valueAsNumber: number) {
  const input = find(tree, 'id', `truth-mixed-movement-${path}-minimum`);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber } });
}
function editFact(tree: ReactNode, path: string, next: TruthFact) {
  const scope = find(tree, 'data-mixed-movement-fact-path', path);
  const fields = elements(scope).find(element => element.type === TruthFactFields);
  assert.ok(fields, `Current fact fields ${path}`);
  (fields.props.onChange as (fact: TruthFact) => void)(next);
}

/** Controlled personalized views test UI contracts and callbacks. Native earned
 * cards, route feasibility and actual physical events have separate proof. */
function projected(phase = 5, action: Action = { type: 'move', forces: { 'arrakeen:10': 3, 'arrakeen:11': 1 },
  eliteForces: { 'arrakeen:10': 1 }, territory: 'carthag', sector: 11 }): GameView {
  const source = createGame('TRUTHMIXEDMOVEMENTCONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.active = phase === 5 ? 'p' : null; game.ready = [];
  game.movementPromises = []; game.movementExpressionPromises = [];
  game.mixedMovementPromises = [{ event: 'controlled-mixed-event', player: 'p', asker: 'a', turn: 2,
    mixed: claim(), answer: true, progress: [{ territory: 'carthag', maximum: 2 }, { territory: 'arrakeen', maximum: 1 }],
    fulfilled: false, released: false }];
  game.movementExpressionPromiseGuide = { phase, action: { ...action, movementExpressionPromiseEvent: 'controlled-mixed-event' } };
  game.auction = phase === 3 ? { bid: 4, bidder: 'a', active: 'p', remaining: 2, inspectionBlocked: null, card: null } : null;
  return game;
}
function editor(initial: Expression, disabled = false) {
  let value = initial, changes = 0;
  const game = projected();
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => MixedMovementFields({ value, game, target: 'p', disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(MixedMovementFields, { value, game, target: 'p', disabled, onChange() {} })),
    error: () => mixedMovementInputError(value, game, 'p'),
  };
}
function guide(props: Parameters<typeof MovementExpressionPromiseGuideButton>[0]) {
  const button = MovementExpressionPromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(MixedMovementPromises, { game, busy: false, send() {} }));

void test('mixed editor keeps sixteen original clauses and blocks structural overflow without truncation', () => {
  const e = editor(fact()); click(control(e.tree(), 'or-1'));
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-action-1')); minimum(e.tree(), `1.${count}`, count);
    if (count % 2) select(e.tree(), `1.${count}`, 'territory', 'arrakeen');
  }
  const full = e.value; assert.ok(full.kind === 'or'); assert.equal(full.terms.length, 16);
  assert.deepEqual(full.terms[0], fact()); assert.equal(e.error(), null);
  assert.match(e.html(), /16 \/ 16 conditions/);
  assert.equal((e.html().match(/Ground-movement destination/g) ?? []).length, 15);
  const before = structuredClone(full), changes = e.changes;
  for (const key of ['add-fact-1', 'add-action-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'fact-and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true, key); click(control(e.tree(), key));
  }
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
});

void test('mixed and embedded fact groups preserve all branches through add, meaning, switch and singleton collapse', () => {
  const e = editor({ kind: 'and', terms: [fact(), move(3)] });
  click(control(e.tree(), 'or-1.2')); select(e.tree(), '1.2', 'meaning', 'and');
  click(control(e.tree(), 'nested-or-1')); click(control(e.tree(), 'nested-and-1'));
  const value = e.value; assert.ok(value.kind === 'and'); assert.equal(value.terms.length, 4);
  click(control(e.tree(), 'fact-or-1.1'));
  editFact(e.tree(), '1.1.2', { kind: 'stormForecast', compare: 'gte', value: 4 });
  select(e.tree(), '1.1', 'fact-meaning', 'and');
  click(control(e.tree(), 'fact-add-1.1'));
  editFact(e.tree(), '1.1.3', { kind: 'spice', compare: 'gte', value: 7 });
  assert.match(e.html(), /Current-fact group 1\.1/); assert.equal(e.error(), null);
  click(control(e.tree(), 'fact-remove-1.1.3')); click(control(e.tree(), 'fact-remove-1.1.2'));
  click(control(e.tree(), 'remove-1.2.2')); click(control(e.tree(), 'remove-1.4')); click(control(e.tree(), 'remove-1.3'));
  assert.deepEqual(e.value, { kind: 'and', terms: [fact(), move(3)] });
  select(e.tree(), '1.2', 'timing', 'fact'); assert.ok(e.error());
  select(e.tree(), '1.2', 'timing', 'action'); assert.equal(e.error(), null);
  click(control(e.tree(), 'remove-1.1')); assert.deepEqual(e.value, move()); assert.ok(e.error());
  click(control(e.tree(), 'and-1')); assert.equal(e.error(), null);
});

void test('four-level envelope counts fact subgroups and keeps invalid numbers and destinations repairable', () => {
  let nested = fact();
  for (let depth = 0; depth < 4; depth++) nested = { kind: 'and', terms: [nested, move()] };
  const deep = editor(nested); assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['and-1', 'or-1.1.1.1.1', 'fact-and-1.1.1.1.1', 'nested-and-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 0);
  for (const invalid of [NaN, -1, 0, 0.5, 21, Infinity]) {
    const e = editor({ kind: 'and', terms: [fact(), move()] });
    minimum(e.tree(), '1.2', invalid); assert.ok(e.error());
    select(e.tree(), '1.2', 'territory', ''); click(control(e.tree(), 'or-1.2'));
    const raw = e.value; assert.ok(raw.kind === 'and');
    assert.deepEqual(raw.terms[1], { kind: 'or', terms: [move(invalid, ''), fact()] });
    assert.match(e.html(), /role="alert"/);
    minimum(e.tree(), '1.2.1', 2); select(e.tree(), '1.2.1', 'territory', 'arrakeen'); assert.equal(e.error(), null);
    editFact(e.tree(), '1.1', { kind: 'spice', compare: 'gte', value: NaN }); assert.ok(e.error());
    editFact(e.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 2 }); assert.equal(e.error(), null);
  }
  const frozen = editor({ kind: 'and', terms: [fact(), move()] }, true), before = structuredClone(frozen.value);
  for (const key of ['and-1', 'add-action-1', 'nested-or-1', 'remove-1.2', 'fact-or-1.1']) click(control(frozen.tree(), key));
  minimum(frozen.tree(), '1.2', 3); select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.1', 'timing', 'action');
  editFact(frozen.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 4 });
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
});

void test('known and unknown current facts use existing fields and aggregate guidance without inspecting secret custody', () => {
  const game = projected(), value: Expression = { kind: 'and', terms: [
    fact({ kind: 'stormForecast', compare: 'gte', value: 3 }), move(2),
  ] };
  for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves'])
    Object.defineProperty(player, key, { get() { throw Error(`No ${key} inspection`); }, configurable: true });
  const html = renderToStaticMarkup(createElement(MixedMovementFields, { value, game, target: 'p', disabled: false, onChange() {} }));
  assert.match(html, /Current facts are evaluated when the player answers/);
  assert.match(html, /unknown current fact can still allow a definite whole answer/);
  assert.match(html, /If no such value is available, the answer is I don’t know/);
  assert.match(html, /Only the aggregate answer is shared/); assert.match(html, /grants no extra movement opportunity/);
  assert.equal(mixedMovementInputError(value, game, 'p'), null);
  assert.ok(mixedMovementInputError({ kind: 'and', terms: [fact({ kind: 'stormForecast', compare: 'gte', value: NaN }), move()] }, game, 'p'));
});

void test('own mixed panel retains the full original question, aggregate status and maximum progress without revealing frozen branches', () => {
  const game = projected(); game.movementExpressionPromiseGuide = null;
  game.mixedMovementPromises.push(
    { ...game.mixedMovementPromises[0], event: 'no-event', answer: false },
    { ...game.mixedMovementPromises[0], event: 'fulfilled-event', fulfilled: true },
    { ...game.mixedMovementPromises[0], event: 'released-event', released: true },
    { ...game.mixedMovementPromises[0], event: 'foreign-event', player: 'a', mixed: { kind: 'or', terms: [fact({ kind: 'hand', name: 'Poison Blade' }), move(19, 'sietch_tabr')] } },
  );
  for (const promise of game.mixedMovementPromises) for (const key of ['binding', 'residual', 'factAnswers', 'compiled'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  assert.match(html, /You answered Yes/); assert.match(html, /You answered No/); assert.match(html, /you hold Shield/);
  assert.match(html, / OR /); assert.match(html, / AND /);
  assert.match(html, /Carthag: 2 physical forces; Arrakeen: 1 physical forces/);
  assert.match(html, /Fulfilled: this whole commitment is complete/); assert.match(html, /Released: this whole commitment is no longer possible/);
  assert.match(html, /Individual fact answers and any reduced future branch remain private/);
  assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /never the sum of smaller moves/); assert.match(html, /Prior moves and shipments do not count/);
  assert.doesNotMatch(html, /Poison Blade|19 physical|controlled-mixed-event|fulfilled-event|factAnswers/);
  assert.equal(MixedMovementPromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('shared native guide forwards exact mixed event, nested force records and paid preparation packets', () => {
  const actions: [number, Action][] = [
    [5, projected().movementExpressionPromiseGuide!.action],
    [5, { type: 'move', forces: { 'arrakeen:10': 4 }, eliteForces: {}, territory: 'carthag', sector: 11,
      movementCard: 'controlled-ornithopter', ornithopter: 'twoGroups', ornithopterEvent: 'controlled-flight' }],
    [5, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 4, elite: 1, allyPayment: 0 }],
    [5, { type: 'card', card: 'controlled-hajr' }], [5, { type: 'endMovement' }],
    [2, { type: 'charity' }], [4, { type: 'revive', amount: 3, elite: 1 }], [3, { type: 'passBid' }],
    [3, { type: 'decision', karama: false }],
  ];
  for (const [phase, action] of actions) {
    const game = projected(phase, action), sent: Action[] = [];
    if (action.type === 'decision') game.decision = { kind: 'auctionPayment', player: 'p' };
    const button = guide({ game, busy: false, send(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button);
    assert.equal(sent[0], game.movementExpressionPromiseGuide!.action); assert.deepEqual(sent, [game.movementExpressionPromiseGuide!.action]);
    assert.match(markup(game), /data-testid="movement-expression-promise-guide"/);
  }
  const box = projected(2, { type: 'decision', event: 'controlled-paid-search', card: 'controlled-recovered-hajr' });
  box.decision = { kind: 'nullentropy', player: 'p' };
  box.nullentropy = { card: { id: 'controlled-box', name: 'Nullentropy Box', kind: 'special', effect: 'nullentropyBox' }, blocked: null,
    search: { event: 'controlled-paid-search', cards: [{ id: 'controlled-recovered-hajr', name: 'Hajr', kind: 'special', effect: 'hajr' }] } };
  assert.match(markup(box), /Choose Hajr in your paid Box search/);
  const sent: Action[] = [], button = guide({ game: box, busy: false, send(action) { sent.push(action); } });
  press(button); assert.equal(sent[0], box.movementExpressionPromiseGuide!.action);
  box.nullentropy.search!.event = 'different-search'; press(button); assert.equal(sent.length, 1);
});

void test('stale mixed guides reject event, owner, turn, status, phase and nested quoted action changes', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 4; }, game => { game.status = 'setup'; },
    game => { game.active = 'a'; }, game => { game.movementExpressionPromiseGuide = null; },
    game => { game.movementExpressionPromiseGuide = { phase: 5, action: { ...game.movementExpressionPromiseGuide!.action } }; },
    game => { (game.movementExpressionPromiseGuide!.action.forces as Record<string, number>)['arrakeen:10'] = 2; },
    game => { (game.movementExpressionPromiseGuide!.action.eliteForces as Record<string, number>)['arrakeen:10'] = 0; },
    game => { game.mixedMovementPromises[0].event = 'expired'; }, game => { game.mixedMovementPromises[0].player = 'a'; },
    game => { game.mixedMovementPromises[0].turn = 1; }, game => { game.mixedMovementPromises[0].fulfilled = true; },
    game => { game.mixedMovementPromises[0].released = true; }, game => { game.mixedMovementPromises = []; },
    game => { game.phaseOpening = { passed: [] }; }, game => { game.automaticContinuationPending = true; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
  ];
  for (const change of changes) {
    const game = projected(), sent: Action[] = [], button = guide({ game, busy: false, send(action) { sent.push(action); } });
    change(game); press(button); assert.deepEqual(sent, []);
  }
  const busy = { game: projected(), busy: false, send() { assert.fail('A busy guide cannot send'); } };
  const button = guide(busy); busy.busy = true; press(button);
  const replaced = { game: projected(), busy: false, send() { assert.fail('A replaced view cannot send'); } };
  const original = guide(replaced); replaced.game = { ...replaced.game }; press(original);
});

void test('mixed panel waits for the native turn and shares one guide with live scalar or pure panels', () => {
  for (const phase of [0, 1, 2, 3, 4]) {
    const game = projected(phase); game.movementExpressionPromiseGuide = null;
    assert.match(markup(game), /Your Movement turn is still ahead/); assert.doesNotMatch(markup(game), /<button/);
  }
  const game = projected(); game.active = 'a'; game.movementExpressionPromiseGuide = null;
  assert.match(markup(game), /Your Movement turn is still ahead/);
  game.active = 'p'; game.movementExpressionPromiseGuide = projected().movementExpressionPromiseGuide;
  assert.match(markup(game), /data-testid="movement-expression-promise-guide"/);
  game.movementPromises.push({ player: 'p', asker: 'a', turn: 2, territory: 'carthag', minimum: 4, answer: true });
  assert.doesNotMatch(markup(game), /data-testid="movement-expression-promise-guide"/);
  game.movementPromises[0].fulfilled = true;
  game.movementExpressionPromises.push({ event: 'controlled-pure-event', player: 'p', asker: 'a', turn: 2,
    claim: { kind: 'move', territory: 'carthag', minimum: 4 }, answer: true, progress: [] });
  assert.doesNotMatch(markup(game), /data-testid="movement-expression-promise-guide"/);
  const pureHtml = renderToStaticMarkup(createElement(MovementExpressionPromises, { game, busy: false, send() {} }));
  assert.match(pureHtml, /data-testid="movement-expression-promise-guide"/);
  game.movementExpressionPromises[0].fulfilled = true; assert.match(markup(game), /data-testid="movement-expression-promise-guide"/);
  const historicalPureHtml = renderToStaticMarkup(createElement(MovementExpressionPromises, { game, busy: false, send() {} }));
  assert.doesNotMatch(historicalPureHtml, /data-testid="movement-expression-promise-guide"/);
  game.mixedMovementPromises[0].fulfilled = true;
  assert.doesNotMatch(markup(game), /data-testid="movement-expression-promise-guide"|Your Movement turn is still ahead/);
});
