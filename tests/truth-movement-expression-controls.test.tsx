import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementExpressionFields, movementExpressionInputError } from '../components/movement-expression-fields';
import { MovementExpressionPromises, MovementExpressionPromiseGuideButton } from '../components/movement-expression-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { parseMovementExpression, type MovementExpression } from '../game/movement-expression-promises';
import { createRicheseAuction, projectRicheseAuction } from '../game/richese-auction';
import { createTechTokens } from '../game/tech-tokens';

type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const territories = [{ id: 'carthag', name: 'Carthag' }, { id: 'arrakeen', name: 'Arrakeen' }, { id: 'sietch_tabr', name: 'Sietch Tabr' }];
const move = (minimum = 1, territory = 'carthag'): MovementExpression => ({ kind: 'move', territory, minimum });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value); assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-movement-expression-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-movement-expression-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function minimum(tree: ReactNode, path: string, valueAsNumber: number) {
  const input = find(tree, 'id', `truth-movement-expression-${path}-minimum`);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber } });
}
function editor(initial: MovementExpression, disabled = false) {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => MovementExpressionFields({ value, territories, disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(MovementExpressionFields, { value, territories, disabled, onChange() {} })),
  };
}
function nested(depth: number): MovementExpression {
  let value = move();
  for (let i = 0; i < depth; i++) value = { kind: 'and', terms: [value, move(2, 'arrakeen')] };
  return value;
}
function guide(props: Parameters<typeof MovementExpressionPromiseGuideButton>[0]) {
  const button = MovementExpressionPromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(MovementExpressionPromises, { game, busy: false, send() {} }));
const event = 'controlled-movement-expression-event';

/** These controlled personalized projections test callbacks and labels only.
 * They do not claim source-earned cards, physical movement or feasibility. */
function projected(phase = 5, action: Action = { type: 'move', forces: { 'arrakeen:10': 3, 'arrakeen:11': 1 },
  eliteForces: { 'arrakeen:10': 1 }, territory: 'carthag', sector: 11 }): GameView {
  const source = createGame('TRUTHMOVEMENTEXPRESSIONCONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.ready = []; game.active = phase === 5 ? 'p' : null;
  game.movementExpressionPromises = [{ event, player: 'p', asker: 'a', turn: 2,
    claim: { kind: 'or', terms: [move(4), { kind: 'and', terms: [move(2, 'arrakeen'), move(3)] }] },
    answer: true, progress: [{ territory: 'carthag', maximum: 2 }, { territory: 'arrakeen', maximum: 1 }] }];
  game.movementExpressionPromiseGuide = { phase, action: { ...action, movementExpressionPromiseEvent: event } };
  game.movementPromises = [];
  game.auction = phase === 3 ? { bid: 4, bidder: 'a', active: 'p', remaining: 2, inspectionBlocked: null, card: null } : null;
  return game;
}
function nativeProjected(method: 'silent' | 'onceAround') {
  const game = projected(3, { type: 'richeseBid' });
  const native = createRicheseAuction({ event: 'controlled-native-auction', cardId: 'controlled-card', owner: 'a',
    method, source: 'cache', eligible: ['p', 'a'], order: ['p', 'a'], tieOrder: ['p', 'a'] });
  game.richeseAuction = { ...projectRicheseAuction(native, 'p'), card: null, claim: null,
    ownAllyPayment: 0, ownAvailable: 4, allyAvailable: 0, peekKnown: false, inspectionBlocked: null };
  game.movementExpressionPromiseGuide!.action = { type: 'richeseBid', event: native.event,
    amount: method === 'silent' ? 0 : null, allyPayment: 0, movementExpressionPromiseEvent: event };
  return game;
}
function paidBox(phase = 5) {
  const game = projected(phase, { type: 'decision', event: 'controlled-paid-box', card: 'controlled-hajr' });
  game.decision = { kind: 'nullentropy', player: 'p' };
  game.nullentropy = { card: { id: 'controlled-box', name: 'Nullentropy Box', kind: 'special', effect: 'nullentropyBox' },
    blocked: null, search: { event: 'controlled-paid-box', cards: [{ id: 'controlled-hajr', name: 'Hajr', kind: 'special', effect: 'hajr' }] } };
  return game;
}

void test('controlled movement editor retains sixteen exact leaves, arbitrary nested groups and singleton collapse', () => {
  const e = editor(move(2)); click(control(e.tree(), 'or-1'));
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-1')); minimum(e.tree(), `1.${count}`, count);
    if (count % 3 === 0) select(e.tree(), `1.${count}`, 'territory', 'arrakeen');
  }
  const full = e.value; assert.ok(full.kind !== 'move'); assert.equal(full.terms.length, 16);
  assert.deepEqual(parseMovementExpression(full), full); assert.match(e.html(), /16 \/ 16 conditions/);
  assert.equal((e.html().match(/Ground-movement destination/g) ?? []).length, 16);
  const before = structuredClone(full), changes = e.changes;
  for (const key of ['add-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
  const grouped = editor({ kind: 'and', terms: [move(3), move(2, 'arrakeen')] });
  click(control(grouped.tree(), 'or-1.2')); select(grouped.tree(), '1.2', 'meaning', 'and');
  click(control(grouped.tree(), 'nested-or-1')); click(control(grouped.tree(), 'nested-and-1'));
  const groupedValue = grouped.value; assert.ok(groupedValue.kind !== 'move'); assert.equal(groupedValue.terms.length, 4);
  click(control(grouped.tree(), 'remove-1.2.2')); assert.deepEqual((grouped.value as typeof groupedValue).terms[1], move(2, 'arrakeen'));
  click(control(grouped.tree(), 'remove-1.4')); click(control(grouped.tree(), 'remove-1.3'));
  click(control(grouped.tree(), 'remove-1.1')); assert.deepEqual(grouped.value, move(2, 'arrakeen'));
});

void test('depth-four limits and busy controls preserve structure while numeric and destination drafts stay repairable', () => {
  const deep = editor(nested(4)); assert.equal(movementExpressionInputError(deep.value), null);
  assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['and-1', 'or-1.1.1.1.1', 'nested-and-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 0); minimum(deep.tree(), '1.1.1.1.1', 20); assert.equal(deep.changes, 1);
  for (const invalid of [NaN, -1, 0, 0.5, 21, Infinity]) {
    const e = editor(move()); minimum(e.tree(), '1', invalid);
    const draft = e.value; assert.ok(draft.kind === 'move'); assert.ok(Object.is(draft.minimum, invalid));
    assert.ok(movementExpressionInputError(e.value)); assert.match(e.html(), /role="alert"/);
    select(e.tree(), '1', 'territory', ''); click(control(e.tree(), 'or-1'));
    const wrapped = e.value; assert.ok(wrapped.kind !== 'move'); assert.deepEqual(wrapped.terms[0], move(invalid, ''));
    minimum(e.tree(), '1.1', 2); assert.ok(movementExpressionInputError(e.value));
    select(e.tree(), '1.1', 'territory', 'arrakeen'); assert.equal(movementExpressionInputError(e.value), null);
  }
  for (const invalid of [nested(5), { kind: 'and', terms: [move()] }, { kind: 'or', terms: Array.from({ length: 17 }, () => move()) },
    move(1, 'homeworld:emperor'), move(1, 'hidden_mobile_stronghold')]) assert.ok(movementExpressionInputError(invalid));
  const frozen = editor({ kind: 'and', terms: [move(), move(2, 'arrakeen')] }, true), before = structuredClone(frozen.value);
  for (const key of ['add-1', 'nested-and-1', 'or-1', 'remove-1.2']) click(control(frozen.tree(), key));
  minimum(frozen.tree(), '1.1', 4); select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.2', 'territory', 'carthag');
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
});

void test('persistent whole-No panel shows the full unpinned tree and destination maxima without summing smaller moves', () => {
  const game = projected(); game.movementExpressionPromiseGuide = null;
  game.movementExpressionPromises.push(
    { ...game.movementExpressionPromises[0], event: 'no-expression', answer: false, claim: { kind: 'and', terms: [move(4), move(2, 'arrakeen')] } },
    { ...game.movementExpressionPromises[0], event: 'fulfilled-expression', fulfilled: true },
    { ...game.movementExpressionPromises[0], event: 'released-expression', released: true },
    { ...game.movementExpressionPromises[0], event: 'foreign-expression', player: 'a', claim: move(19, 'sietch_tabr') },
  );
  const before = structuredClone(game), html = markup(game);
  assert.match(html, /Your movement expression promises/); assert.match(html, / OR /); assert.match(html, / AND /);
  assert.match(html, /Carthag: 2 physical forces; Arrakeen: 1 physical forces/);
  assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /Legal alternatives remain available; no fixed branch is selected for you/);
  assert.match(html, /Smaller moves never add together; progress records the maximum in one move/);
  assert.match(html, /Prior moves and shipments do not count/); assert.match(html, /before your Movement turn ends this round/);
  assert.match(html, /No remains binding through every later Hajr or Ornithopter move/);
  assert.match(html, /Fulfilled: this commitment is complete/); assert.match(html, /Released: this commitment is no longer possible/);
  assert.match(html, /href="\/rules#truthtrance-movement-expression"/);
  assert.doesNotMatch(html, /19 physical|controlled-movement-expression-event/); assert.deepEqual(game, before);
  for (const phase of [0, 1, 2, 3, 4]) { game.phase = phase; assert.match(markup(game), /Your Movement turn is still ahead/); }
  game.phase = 5; game.active = 'a'; assert.match(markup(game), /Your Movement turn is still ahead/);
  assert.equal(MovementExpressionPromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('native movement, shipment, reveal, Hajr and Ornithopter guides forward every quoted field exactly', () => {
  const actions: Action[] = [
    projected().movementExpressionPromiseGuide!.action,
    { type: 'move', forces: { 'arrakeen:10': 4 }, eliteForces: {}, territory: 'carthag', sector: 11,
      movementCard: 'controlled-ornithopter', ornithopter: 'twoGroups', ornithopterEvent: 'original-flight' },
    { type: 'move', forces: {}, eliteForces: {}, noField: 'controlled-token', event: 'original-token-event', territory: 'carthag', sector: 11 },
    { type: 'ship', territory: 'arrakeen', sector: 10, amount: 4, elite: 1, allyPayment: 0, noField: 'controlled-token' },
    { type: 'revealNoField', event: 'original-token-event' }, { type: 'prepareAdvisors', territory: 'arrakeen', event: 'original-advisor-event' },
    { type: 'card', card: 'controlled-hajr' }, { type: 'endMovement' },
  ];
  for (const action of actions) {
    const game = projected(5, action), sent: Action[] = [], props = { game, busy: false, send(value: Action) { sent.push(value); } };
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.equal(sent[0], game.movementExpressionPromiseGuide!.action); assert.deepEqual(sent, [game.movementExpressionPromiseGuide!.action]);
    press(guide({ ...props, busy: true })); assert.equal(sent.length, 1);
  }
  assert.match(markup(projected()), /Move 4 forces to Carthag, sector 11/);
  assert.match(markup(projected(5, actions[1])), /Use Ornithopter and move 4 forces/);
  assert.match(markup(projected(5, actions[2])), /Move your concealed No-Field/);
  assert.match(markup(projected(5, actions[3])), /Ship a concealed No-Field/);
  assert.match(markup(projected(5, actions[4])), /Reveal your No-Field/);
  assert.match(markup(projected(5, actions[5])), /Prepare advisors in Arrakeen/);
  assert.match(markup(projected(5, actions[6])), /Play Hajr/);
});

void test('owned current preparation guides preserve Charity, Revival, native auction and paid Box packets', () => {
  for (const [phase, action] of [[2, { type: 'charity' }], [2, { type: 'ready' }], [4, { type: 'revive', amount: 3, elite: 1 }],
    [4, { type: 'ready' }], [3, { type: 'passBid' }], [3, { type: 'decision', karama: false }]] satisfies [number, Action][]) {
    const game = projected(phase, action), sent: Action[] = [];
    if (action.type === 'decision') game.decision = { kind: 'auctionPayment', player: 'p' };
    const button = guide({ game, busy: false, send(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.movementExpressionPromiseGuide!.action);
    if (action.type === 'decision') game.decision!.player = 'a';
    else if (phase === 3) game.auction!.active = 'a'; else game.ready.push('p');
    press(button); assert.equal(sent.length, 1);
  }
  for (const method of ['silent', 'onceAround'] as const) {
    const game = nativeProjected(method), sent: Action[] = [];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.movementExpressionPromiseGuide!.action);
    assert.match(markup(game), method === 'silent' ? /Submit zero in this Silent auction/ : /Pass this Richese bid/);
    game.richeseAuction!.event = 'later-event'; press(button); assert.equal(sent.length, 1);
  }
  for (const phase of [0, 2, 3, 4, 5]) {
    const game = paidBox(phase), sent: Action[] = []; game.active = 'a';
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.movementExpressionPromiseGuide!.action);
    assert.match(markup(game), /Choose Hajr in your paid Box search/); assert.match(markup(game), /fee is paid only once/);
    game.nullentropy!.search!.event = 'later-paid-search'; press(button); assert.equal(sent.length, 1);
  }
});

void test('stale callbacks reject changed phase, own event, busy windows and nested physical move mutation', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 4; }, game => { game.status = 'setup'; },
    game => { game.active = 'a'; }, game => { game.movementExpressionPromiseGuide = null; },
    game => { game.movementExpressionPromiseGuide = { phase: 5, action: { ...game.movementExpressionPromiseGuide!.action } }; },
    game => { game.movementExpressionPromiseGuide!.phase = 4; }, game => { game.movementExpressionPromiseGuide!.action.territory = 'arrakeen'; },
    game => { (game.movementExpressionPromiseGuide!.action.forces as Record<string, number>)['arrakeen:10'] = 2; },
    game => { (game.movementExpressionPromiseGuide!.action.eliteForces as Record<string, number>)['arrakeen:10'] = 0; },
    game => { game.movementExpressionPromises[0].event = 'expired'; }, game => { game.movementExpressionPromises[0].player = 'a'; },
    game => { game.movementExpressionPromises[0].turn = 1; }, game => { game.movementExpressionPromises[0].fulfilled = true; },
    game => { game.movementExpressionPromises[0].released = true; }, game => { game.movementExpressionPromises = []; },
    game => { game.phaseOpening = { passed: [] }; }, game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
    game => { game.automaticContinuationPending = true; }, game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.techTokens = createTechTokens(); },
  ];
  for (const change of changes) {
    const game = projected(), sent: Action[] = [], button = guide({ game, busy: false, send(action) { sent.push(action); } });
    change(game); press(button); assert.deepEqual(sent, []);
  }
  const props = { game: projected(), busy: false, send() { assert.fail('A now-busy guide cannot dispatch'); } };
  const button = guide(props); props.busy = true; press(button);
  const replaced = { game: projected(), busy: false, send() { assert.fail('A replaced view cannot dispatch'); } };
  const original = guide(replaced); replaced.game = { ...replaced.game }; press(original);
});

void test('waiting and wrong-phase quotes cannot expose premature movement and scalar promises suppress a duplicate visible guide', () => {
  for (const [phase, action] of [[0, { type: 'ready' }], [1, { type: 'move' }], [2, { type: 'revive' }], [3, { type: 'ready' }],
    [4, { type: 'charity' }], [4, { type: 'ship' }], [5, { type: 'revive' }], [6, { type: 'move' }]] satisfies [number, Action][]) {
    const game = projected(phase, action), sent: Action[] = [];
    const button = guide({ game, busy: false, send(value) { sent.push(value); } });
    assert.equal(button.props.disabled, true); press(button); assert.deepEqual(sent, []);
  }
  const game = projected(); game.active = 'a'; game.movementExpressionPromiseGuide = null;
  assert.match(markup(game), /Your Movement turn is still ahead/); assert.doesNotMatch(markup(game), /<button/);
  game.active = 'p'; game.movementExpressionPromiseGuide = projected().movementExpressionPromiseGuide;
  assert.match(markup(game), /data-testid="movement-expression-promise-guide"/);
  game.movementPromises.push({ player: 'p', asker: 'a', turn: 2, territory: 'carthag', minimum: 4, answer: true });
  assert.doesNotMatch(markup(game), /data-testid="movement-expression-promise-guide"/);
  game.movementPromises[0].fulfilled = true;
  assert.match(markup(game), /data-testid="movement-expression-promise-guide"/);
});

void test('projected own card names label preparation while eligibility never examines unrelated secret or physical resources', () => {
  const cards = [
    { id: 'controlled-ghola', name: 'Tleilaxu Ghola', kind: 'special' as const, effect: 'ghola' },
    { id: 'controlled-box', name: 'Nullentropy Box', kind: 'special' as const, effect: 'nullentropyBox' },
    { id: 'controlled-karama', name: 'Karama', kind: 'special' as const, effect: 'karama' },
  ];
  const ghola = projected(5, { type: 'card', card: cards[0].id, amount: 2 });
  ghola.players.find(player => player.id === ghola.me)!.hand = cards;
  assert.match(markup(ghola), /Play Ghola to return 2 forces to reserves/);
  const box = projected(5, { type: 'card', card: cards[1].id }); box.players.find(player => player.id === box.me)!.hand = cards;
  assert.match(markup(box), /Pay 2 spice and search with Nullentropy Box/);
  const payment = projected(3, { type: 'decision', karama: true, card: cards[2].id });
  payment.decision = { kind: 'auctionPayment', player: 'p' }; payment.players.find(player => player.id === payment.me)!.hand = cards;
  assert.match(markup(payment), /Use Karama for the current auction payment/);
  for (const game of [projected(), ghola, box, payment, paidBox()]) {
    const sent: Action[] = [];
    for (const seat of game.players) for (const key of ['traitors', 'faceDancers', 'leaders', 'kwisatz', 'spice', 'reserves', 'tanks', 'elites', 'forces',
      ...(seat.id !== game.me ? ['hand'] : [])]) Object.defineProperty(seat, key, {
      get() { throw Error(`No unrelated ${key} inspection`); }, configurable: true,
    });
    if (game.auction) Object.defineProperty(game.auction, 'card', { get() { throw Error('No unrevealed lot inspection'); } });
    for (const key of ['spiceDeck', 'deck', 'discard']) Object.defineProperty(game, key, {
      get() { throw Error(`No private ${key} inspection`); }, configurable: true,
    });
    assert.match(markup(game), /Your movement expression promises/);
    press(guide({ game, busy: false, send(action) { sent.push(action); } }));
    assert.equal(sent[0], game.movementExpressionPromiseGuide!.action);
  }
});
