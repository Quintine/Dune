import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RevivalExpressionFields, revivalExpressionInputError } from '../components/revival-expression-fields';
import { RevivalExpressionPromises, RevivalExpressionPromiseGuideButton } from '../components/revival-expression-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { parseRevivalExpression, type RevivalExpression } from '../game/revival-expression-promises';
import { createRicheseAuction, projectRicheseAuction } from '../game/richese-auction';
import { createTechTokens } from '../game/tech-tokens';

type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const leaders = [{ id: 'named-leader', name: 'Named Commander' }, { id: 'kwisatz', name: 'Kwisatz Haderach' }];
const force = (minimum = 1, counter: 'total' | 'normal' | 'elite' = 'total'): RevivalExpression => ({ kind: 'forces', counter, minimum });
const named = (leader = 'named-leader'): RevivalExpression => ({ kind: 'leader', leader });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value); assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-revival-expression-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-revival-expression-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function minimum(tree: ReactNode, path: string, valueAsNumber: number) {
  const input = find(tree, 'id', `truth-revival-expression-${path}-minimum`);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber } });
}
function editor(initial: RevivalExpression, disabled = false, choices = leaders) {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => RevivalExpressionFields({ value, leaders: choices, disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(RevivalExpressionFields, { value, leaders: choices, disabled, onChange() {} })),
  };
}
function nested(depth: number): RevivalExpression {
  let value = force();
  for (let i = 0; i < depth; i++) value = { kind: 'and', terms: [value, named()] };
  return value;
}
function guide(props: Parameters<typeof RevivalExpressionPromiseGuideButton>[0]) {
  const button = RevivalExpressionPromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(RevivalExpressionPromises, { game, busy: false, send() {} }));

/** Controlled personalized expressions and quotes test UI callbacks only.
 * They do not represent source-earned cards, casualties, payments or returns. */
function projected(phase = 4, type = 'revive', advanced = false): GameView {
  const source = createGame('TRUTHREVIVALEXPRESSIONCONTROLS', newPlayer('p', 'Respondent', 'emperor'), advanced);
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.ready = [];
  game.allLeaders = [{ id: 'named-leader', name: 'Named Commander', faction: 'emperor', strength: 3 }];
  game.revivalExpressionPromises = [{ event: 'controlled-revival-expression-event', player: 'p', asker: 'a', turn: 2,
    claim: { kind: 'or', terms: [force(3), { kind: 'and', terms: [named(), force(1, 'elite')] }] },
    answer: type !== 'ready', progress: { total: 1, normal: 1, elite: 0, leaders: [] } }];
  game.revivalOrder = advanced ? { version: 1, turn: 2, original: ['p', 'a'], remaining: ['p', 'a'], completed: [], started: false } : null;
  game.active = advanced ? 'p' : null;
  game.auction = phase === 3 ? { bid: 4, bidder: type === 'decision' ? 'p' : 'a', active: type === 'decision' ? 'a' : 'p',
    remaining: 2, inspectionBlocked: null, card: null } : null;
  game.decision = type === 'decision' ? { kind: 'auctionPayment', player: 'p' } : null;
  if (type === 'acceptLeaderRevival') game.revivalRequests.p = { leader: 'named-leader', price: 3 };
  game.revivalExpressionPromiseGuide = { phase, action: { type, revivalExpressionPromiseEvent: 'controlled-revival-expression-event',
    ...(type === 'revive' ? { amount: 2, elite: 1, freeElite: 0 } : {}),
    ...(type === 'reviveLeader' ? { leader: 'named-leader' } : {}),
    ...(type === 'acceptLeaderRevival' ? { leaderRevivalPrice: 3 } : {}),
    ...(type === 'decision' ? { karama: true, card: 'projected-original-karama' } : {}) } };
  return game;
}
function nativeProjected(method: 'silent' | 'onceAround') {
  const game = projected(3, 'richeseBid');
  const native = createRicheseAuction({ event: 'controlled-expression-auction-event', cardId: 'controlled-card', owner: 'a',
    method, source: 'cache', eligible: ['p', 'a'], order: ['p', 'a'], tieOrder: ['p', 'a'] });
  game.richeseAuction = { ...projectRicheseAuction(native, 'p'), card: null, claim: null,
    ownAllyPayment: 0, ownAvailable: 4, allyAvailable: 0, peekKnown: false, inspectionBlocked: null };
  game.revivalExpressionPromiseGuide = { phase: 3, action: { type: 'richeseBid', event: native.event,
    amount: method === 'silent' ? 0 : null, allyPayment: 0, revivalExpressionPromiseEvent: 'controlled-revival-expression-event' } };
  return game;
}

void test('whole-tree callbacks author sixteen leaves, nested AND or OR, named counters and singleton collapse without truncation', () => {
  const e = editor(force(2)); click(control(e.tree(), 'or-1'));
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-1')); minimum(e.tree(), `1.${count}`, count);
    if (count % 3 === 0) select(e.tree(), `1.${count}`, 'counter', 'elite');
  }
  assert.ok(e.value.kind === 'or'); assert.equal(e.value.terms.length, 16); assert.deepEqual(parseRevivalExpression(e.value), e.value);
  select(e.tree(), '1.2', 'kind', 'leader'); select(e.tree(), '1.2', 'leader', 'kwisatz');
  assert.deepEqual(e.value.terms[1], named('kwisatz')); assert.match(e.html(), /16 \/ 16 conditions/);
  assert.equal((e.html().match(/Revival condition type/g) ?? []).length, 16);
  const before = structuredClone(e.value), changes = e.changes;
  for (const key of ['add-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
  const grouped = editor({ kind: 'and', terms: [force(3), named()] });
  click(control(grouped.tree(), 'or-1.2')); select(grouped.tree(), '1.2', 'meaning', 'and');
  click(control(grouped.tree(), 'nested-or-1')); click(control(grouped.tree(), 'nested-and-1'));
  assert.ok(grouped.value.kind === 'and'); assert.equal(grouped.value.terms.length, 4);
  click(control(grouped.tree(), 'remove-1.2.2')); assert.deepEqual(grouped.value.terms[1], named());
  click(control(grouped.tree(), 'remove-1.4')); click(control(grouped.tree(), 'remove-1.3'));
  click(control(grouped.tree(), 'remove-1.1')); assert.deepEqual(grouped.value, named());
});

void test('depth-four guards and busy callbacks preserve the tree while invalid numeric drafts remain editable and parser-visible', () => {
  const deep = editor(nested(4)); assert.equal(revivalExpressionInputError(deep.value), null);
  assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['and-1', 'or-1.1.1.1.1', 'nested-and-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 0); minimum(deep.tree(), '1.1.1.1.1', 20); assert.equal(deep.changes, 1);
  for (const invalid of [NaN, -1, 0, 0.5, 21, Infinity]) {
    const e = editor(force()); minimum(e.tree(), '1', invalid);
    const draft = e.value; assert.ok(draft.kind === 'forces'); assert.ok(Object.is(draft.minimum, invalid));
    assert.ok(revivalExpressionInputError(e.value)); assert.match(e.html(), /role="alert"/);
    click(control(e.tree(), 'or-1')); const wrapped = e.value; assert.ok(wrapped.kind === 'or');
    assert.deepEqual(wrapped.terms[0], force(invalid));
    minimum(e.tree(), '1.1', 2); assert.equal(revivalExpressionInputError(e.value), null);
  }
  for (const invalid of [nested(5), { kind: 'and', terms: [force()] }, { kind: 'or', terms: Array.from({ length: 17 }, () => force()) },
    { kind: 'forces', counter: 'strength', minimum: 1 }, { kind: 'leader', leader: '' }]) assert.ok(revivalExpressionInputError(invalid));
  const frozen = editor({ kind: 'and', terms: [force(), named()] }, true), before = structuredClone(frozen.value);
  for (const key of ['add-1', 'nested-and-1', 'or-1', 'remove-1.2']) click(control(frozen.tree(), key));
  minimum(frozen.tree(), '1.1', 4); select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.2', 'leader', 'kwisatz');
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
  const empty = editor(force(), false, []); select(empty.tree(), '1', 'kind', 'leader'); assert.equal(empty.changes, 0);
});

void test('own panels show the entire unpinned expression, cumulative typed and named progress, whole-No meaning and waiting', () => {
  const game = projected(); game.revivalExpressionPromiseGuide = null;
  game.revivalExpressionPromises[0].progress = { total: 2, normal: 1, elite: 1, leaders: ['kwisatz'] };
  game.revivalExpressionPromises.push(
    { ...game.revivalExpressionPromises[0], event: 'no-expression', answer: false, claim: { kind: 'and', terms: [force(3), named()] } },
    { ...game.revivalExpressionPromises[0], event: 'fulfilled-expression', fulfilled: true },
    { ...game.revivalExpressionPromises[0], event: 'released-expression', released: true },
    { ...game.revivalExpressionPromises[0], event: 'foreign-expression', player: 'a', claim: named('hidden-foreign-name') },
  );
  const before = structuredClone(game), html = markup(game);
  assert.match(html, /Your Revival expression promises/); assert.match(html, / OR /); assert.match(html, / AND /);
  assert.match(html, /Named Commander/); assert.match(html, /Future ordinary progress: 2 physical forces \(1 normal, 1 elite\)/);
  assert.match(html, /returned leaders: Kwisatz Haderach/);
  assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /Legal alternatives remain available; no fixed branch is selected for you/);
  assert.match(html, /Prior returns, requests alone, Ghola, foreign leaders and special card returns do not count/);
  assert.match(html, /Fulfilled: this commitment is complete/); assert.match(html, /Released: this commitment is no longer possible/);
  assert.match(html, /href="\/rules#truthtrance-revival-expression"/);
  assert.doesNotMatch(html, /hidden-foreign-name|controlled-revival-expression-event/); assert.deepEqual(game, before);
  for (const phase of [0, 1, 2, 3]) { game.phase = phase; assert.match(markup(game), /Your Revival opportunity is still ahead/); }
  game.phase = 4; game.revivalOrder = { version: 1, turn: 2, original: ['a', 'p'], remaining: ['a', 'p'], completed: [], started: false };
  assert.match(markup(game), /while the current actor finishes/);
  assert.equal(RevivalExpressionPromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('actual Basic and ordered Advanced whole-expression return guides preserve every original action field', () => {
  for (const advanced of [false, true]) for (const type of ['revive', 'reviveLeader', 'reviveKwisatz', 'acceptLeaderRevival', 'ready']) {
    const game = projected(4, type, advanced), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.revivalExpressionPromiseGuide!.action]); assert.equal(sent[0], game.revivalExpressionPromiseGuide!.action);
    assert.match(markup(game), /honoring the whole expression/); press(guide({ ...props, busy: true })); assert.equal(sent.length, 1);
    if (type === 'revive') assert.deepEqual(sent[0], { type: 'revive', amount: 2, elite: 1, freeElite: 0, revivalExpressionPromiseEvent: 'controlled-revival-expression-event' });
    if (type === 'acceptLeaderRevival') {
      assert.equal(sent[0].leaderRevivalPrice, 3); game.revivalRequests.p.price = 4; press(button); assert.equal(sent.length, 1);
      game.revivalRequests.p.price = 3; game.revivalRequests.p.declined = true; press(button); assert.equal(sent.length, 1);
    }
  }
});

void test('actual preparation guides preserve Charity, ordinary pass or payment, and owned native silent-zero or pass packets', () => {
  for (const [phase, type] of [[2, 'charity'], [2, 'ready'], [3, 'passBid'], [3, 'decision']] as const) {
    const game = projected(phase, type), sent: Action[] = [];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.deepEqual(sent, [game.revivalExpressionPromiseGuide!.action]);
    if (type === 'decision') {
      assert.equal(sent[0].card, 'projected-original-karama'); assert.equal(sent[0].karama, true);
      assert.doesNotMatch(markup(game), /projected-original-karama/);
      game.decision!.player = 'a'; press(button); assert.equal(sent.length, 1);
    } else if (phase === 2) { game.ready.push('p'); press(button); assert.equal(sent.length, 1); }
    else { game.auction!.active = 'a'; press(button); assert.equal(sent.length, 1); }
  }
  for (const method of ['silent', 'onceAround'] as const) {
    const game = nativeProjected(method), sent: Action[] = [];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.deepEqual(sent, [game.revivalExpressionPromiseGuide!.action]);
    assert.match(markup(game), method === 'silent' ? /Submit zero in this Silent auction/ : /Pass this Richese bid/);
    game.richeseAuction!.event = 'later-event'; press(button); assert.equal(sent.length, 1);
    game.richeseAuction!.event = 'controlled-expression-auction-event';
    if (method === 'silent') game.richeseAuction!.submitted.push('p'); else game.richeseAuction!.active = 'a';
    press(button); assert.equal(sent.length, 1);
  }
});

void test('stale whole-expression callbacks guard current own event, quote, phase, frame and quiet windows using no private eligibility', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 5; }, game => { game.status = 'setup'; },
    game => { game.ready = ['p']; }, game => { game.revivalOrder!.remaining = ['a', 'p']; game.active = 'a'; },
    game => { game.revivalOrder!.turn = 1; }, game => { game.active = null; }, game => { game.revivalOrder = null; },
    game => { game.revivalOrder = { ...game.revivalOrder!, remaining: ['p', 'a'] }; },
    game => { game.revivalExpressionPromiseGuide = { phase: 4, action: { ...game.revivalExpressionPromiseGuide!.action } }; },
    game => { game.revivalExpressionPromiseGuide = null; }, game => { game.revivalExpressionPromiseGuide!.phase = 3; },
    game => { game.revivalExpressionPromiseGuide!.action.amount = 3; },
    game => { game.revivalExpressionPromises[0].event = 'expired'; }, game => { game.revivalExpressionPromises[0].player = 'a'; },
    game => { game.revivalExpressionPromises[0].turn = 1; }, game => { game.revivalExpressionPromises[0].fulfilled = true; },
    game => { game.revivalExpressionPromises[0].released = true; }, game => { game.revivalExpressionPromises = []; },
    game => { game.phaseOpening = { passed: [] }; }, game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
    game => { game.automaticContinuationPending = true; }, game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.techTokens = createTechTokens(); },
  ];
  for (const change of changes) {
    const game = projected(4, 'revive', true), sent: Action[] = [];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } }); change(game); press(button); assert.deepEqual(sent, []);
  }
  const props = { game: projected(), busy: false, send() { assert.fail('A now-busy expression guide cannot dispatch'); } };
  const button = guide(props); props.busy = true; press(button);
  for (const [phase, type] of [[0, 'ready'], [1, 'ready'], [2, 'revive'], [3, 'revive'], [4, 'charity']] as const) {
    const game = projected(phase, type), sent: Action[] = [];
    press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.deepEqual(sent, []);
  }
  for (const type of ['revive', 'reviveLeader', 'reviveKwisatz', 'decision']) {
    const game = projected(type === 'decision' ? 3 : 4, type), sent: Action[] = [];
    for (const seat of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'leaders', 'kwisatz', 'spice', 'reserves', 'tanks', 'elites'])
      Object.defineProperty(seat, key, { get() { throw Error(`No private or unneeded ${key} inspection`); }, configurable: true });
    if (game.auction) Object.defineProperty(game.auction, 'card', { get() { throw Error('No unrevealed lot inspection'); } });
    for (const key of ['spiceDeck', 'deck', 'discard', 'revival']) Object.defineProperty(game, key, {
      get() { throw Error(`No private eligibility or ${key} inspection`); }, configurable: true,
    });
    assert.match(markup(game), /Your Revival expression promises/);
    press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.deepEqual(sent, [game.revivalExpressionPromiseGuide!.action]);
  }
});
