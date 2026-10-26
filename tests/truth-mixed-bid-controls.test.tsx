import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MixedBidFields, mixedBidInputError } from '../components/mixed-bid-fields';
import { MixedBidPromises } from '../components/mixed-bid-promises';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { BidPromiseGuideButton, BidPromises } from '../components/bid-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { BidActionClaim } from '../game/mixed-bid-question';
import { createTechTokens } from '../game/tech-tokens';
import type { TruthFact } from '../game/truthtrance';

type Expression = MixedActionExpression<BidActionClaim>;
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const fact = (value: TruthFact = { kind: 'hand', name: 'Shield' }): Expression => ({ kind: 'fact', fact: value });
const bid = (minimum = 1): Expression => ({ kind: 'action', action: { minimum } });
const claim = (): Expression => ({ kind: 'or', terms: [fact(), { kind: 'and', terms: [bid(3), bid(7)] }] });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value);
  assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-mixed-bid-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-mixed-bid-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function minimum(tree: ReactNode, path: string, valueAsNumber: number) {
  const input = find(tree, 'id', `truth-mixed-bid-${path}-minimum`);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber } });
}
function editFact(tree: ReactNode, path: string, next: TruthFact) {
  const scope = find(tree, 'data-mixed-bid-fact-path', path);
  const fields = elements(scope).find(element => element.type === TruthFactFields);
  assert.ok(fields, `Current fact fields ${path}`);
  (fields.props.onChange as (fact: TruthFact) => void)(next);
}

/** Controlled projections exercise fields and exact callback guards only.
 * Source-earned Truthtrance, declarations and lot close have native proof. */
function projected(type: 'bid' | 'passBid' = 'bid', advanced = false): GameView {
  const source = createGame('TRUTHMIXEDBIDCONTROLS', newPlayer('p', 'Respondent', 'emperor'), advanced);
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.phase = 3; game.turn = 2;
  game.auction = { bid: 1, bidder: 'a', active: 'p', remaining: 2, inspectionBlocked: null, card: null };
  game.bidPromiseLot = { turn: 2, lot: 3 };
  game.bidPromises = [];
  game.mixedBidPromises = [{ event: 'controlled-mixed-bid-event', player: 'p', asker: 'a', turn: 2, lot: 3,
    mixed: claim(), answer: type === 'bid', fulfilled: false, released: false }];
  game.bidPromiseGuide = { action: type === 'bid'
    ? { type, amount: 7, allyPayment: 1, bidPromiseEvent: 'controlled-mixed-bid-event' }
    : { type, bidPromiseEvent: 'controlled-mixed-bid-event' } };
  return game;
}
function editor(initial: Expression, disabled = false, game = projected(), target = 'p') {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => MixedBidFields({ value, game, target, disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(MixedBidFields, { value, game, target, disabled, onChange() {} })),
    error: () => mixedBidInputError(value, game, target),
  };
}
function guide(props: Parameters<typeof BidPromiseGuideButton>[0]) {
  const button = BidPromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(MixedBidPromises, { game, busy: false, send() {} }));
const pureMarkup = (game: GameView) => renderToStaticMarkup(createElement(BidPromises, { game, busy: false, send() {} }));

void test('mixed bid editor retains sixteen original conditions with only per-action minimum fields and fixed public turn and lot', () => {
  const e = editor(fact()); click(control(e.tree(), 'or-1'));
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-action-1')); minimum(e.tree(), `1.${count}`, count);
  }
  minimum(e.tree(), '1.2', Number.MAX_SAFE_INTEGER);
  const full = e.value; assert.ok(full.kind === 'or'); assert.equal(full.terms.length, 16);
  assert.deepEqual(full.terms[0], fact()); assert.deepEqual(full.terms[1], bid(Number.MAX_SAFE_INTEGER));
  assert.deepEqual(full.terms[15], bid(16)); assert.equal(e.error(), null);
  const html = e.html(), ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.match(html, /Turn 2 · Ordinary lot 3/); assert.match(html, /16 \/ 16 conditions/);
  assert.equal((html.match(/Minimum bid in spice/g) ?? []).length, 15);
  assert.match(html, /max="9007199254740991"/); assert.equal(new Set(ids).size, ids.length);
  assert.ok(!elements(e.tree()).some(element => typeof element.props.id === 'string' && /-(turn|lot)$/.test(element.props.id)));
  const before = structuredClone(full), changes = e.changes;
  for (const key of ['add-fact-1', 'add-action-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'fact-and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true, key); click(control(e.tree(), key));
  }
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
});

void test('mixed bid and embedded fact groups preserve all branches through edits, collapse and the shared depth-four envelope', () => {
  const e = editor({ kind: 'and', terms: [fact(), bid(3)] });
  click(control(e.tree(), 'or-1.2')); select(e.tree(), '1.2', 'meaning', 'and');
  click(control(e.tree(), 'nested-or-1')); click(control(e.tree(), 'nested-and-1'));
  assert.ok(e.value.kind === 'and'); assert.equal(e.value.terms.length, 4);
  click(control(e.tree(), 'fact-or-1.1')); editFact(e.tree(), '1.1.2', { kind: 'stormForecast', compare: 'gte', value: 4 });
  select(e.tree(), '1.1', 'fact-meaning', 'and'); click(control(e.tree(), 'fact-add-1.1'));
  editFact(e.tree(), '1.1.3', { kind: 'spice', compare: 'gte', value: 7 });
  assert.match(e.html(), /Current-fact group 1\.1/); assert.equal(e.error(), null);
  click(control(e.tree(), 'fact-remove-1.1.3')); click(control(e.tree(), 'fact-remove-1.1.2'));
  click(control(e.tree(), 'remove-1.2.2')); click(control(e.tree(), 'remove-1.4')); click(control(e.tree(), 'remove-1.3'));
  assert.deepEqual(e.value, { kind: 'and', terms: [fact(), bid(3)] });
  select(e.tree(), '1.2', 'timing', 'fact'); assert.ok(e.error());
  select(e.tree(), '1.2', 'timing', 'action'); assert.equal(e.error(), null);
  click(control(e.tree(), 'remove-1.1')); assert.deepEqual(e.value, bid()); assert.ok(e.error());
  click(control(e.tree(), 'and-1')); assert.equal(e.error(), null);
  let nested = fact();
  for (let depth = 0; depth < 4; depth++) nested = { kind: 'and', terms: [nested, bid()] };
  const deep = editor(nested); assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['and-1', 'or-1.1.1.1.1', 'fact-and-1.1.1.1.1', 'nested-and-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 0);
  assert.ok(mixedBidInputError({ kind: 'and', terms: [nested, bid()] }, projected(), 'p'));
});

void test('mixed bid numeric drafts remain repairable while strict leaves reject metadata and busy callbacks preserve the original tree', () => {
  for (const invalid of [NaN, -1, 0, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const e = editor({ kind: 'and', terms: [fact(), bid()] });
    minimum(e.tree(), '1.2', invalid); assert.ok(e.error()); click(control(e.tree(), 'or-1.2'));
    const raw = e.value; assert.ok(raw.kind === 'and');
    assert.deepEqual(raw.terms[1], { kind: 'or', terms: [bid(invalid), fact()] });
    assert.match(e.html(), /role="alert"/); minimum(e.tree(), '1.2.1', 2); assert.equal(e.error(), null);
  }
  for (const action of [{ minimum: 1, turn: 2 }, { minimum: 1, lot: 3 }, { minimum: 1, source: 'hidden-lot' },
    { minimum: 1, answer: true }, { minimum: 1, fulfilled: true }, { kind: 'or', terms: [{ minimum: 1 }] }, { minimum: '2' }])
    assert.ok(mixedBidInputError({ kind: 'and', terms: [fact(), { kind: 'action', action }] }, projected(), 'p'));
  const frozen = editor({ kind: 'and', terms: [fact(), bid()] }, true), before = structuredClone(frozen.value);
  for (const key of ['and-1', 'add-action-1', 'nested-or-1', 'remove-1.2', 'fact-or-1.1']) click(control(frozen.tree(), key));
  minimum(frozen.tree(), '1.2', 3); select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.2', 'timing', 'fact');
  editFact(frozen.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 4 });
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
});

void test('mixed bid authoring uses public current-lot scope and explains declaration, unknown and original payment semantics without inspecting holdings', () => {
  const game = projected();
  for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'leaders', 'spice', 'forces', 'reserves', 'tanks', 'elites'])
    Object.defineProperty(player, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  Object.defineProperty(game.auction!, 'card', { get() { throw Error('No hidden auction face inspection'); } });
  for (const key of ['deck', 'discard', 'spiceDeck']) Object.defineProperty(game, key, {
    get() { throw Error(`No private ${key} inspection`); }, configurable: true,
  });
  const e = editor({ kind: 'and', terms: [fact({ kind: 'stormForecast', compare: 'gte', value: 3 }), bid(5)] }, false, game);
  assert.equal(e.error(), null);
  const html = e.html(); assert.match(html, /Turn 2 · Ordinary lot 3/);
  assert.match(html, /Smaller bids do not add together/); assert.match(html, /even if another player wins/);
  assert.match(html, /If you win, the original payment rules still apply/);
  assert.match(html, /Existing funding, Karama and prepaid ally aid rules still apply/);
  assert.match(html, /optional modules and native special auctions are excluded/);
  assert.match(html, /conservative future commitment/); assert.match(html, /If no such value is available, the answer is I don’t know/);
  editFact(e.tree(), '1.1', { kind: 'spice', compare: 'gte', value: NaN }); assert.ok(e.error());
  editFact(e.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 2 }); assert.equal(e.error(), null);
});

void test('own mixed bid panel displays the original question and aggregate answer without progress, frozen facts or reduced thresholds', () => {
  const game = projected(); game.bidPromiseGuide = null;
  game.mixedBidPromises.push(
    { ...game.mixedBidPromises[0], event: 'no-event', answer: false },
    { ...game.mixedBidPromises[0], event: 'fulfilled-event', fulfilled: true },
    { ...game.mixedBidPromises[0], event: 'released-event', released: true },
    { ...game.mixedBidPromises[0], event: 'foreign-event', player: 'a', mixed: { kind: 'or', terms: [fact({ kind: 'hand', name: 'Poison Blade' }), bid(99)] } },
  );
  for (const promise of game.mixedBidPromises) for (const key of ['binding', 'residual', 'factAnswers', 'frozenFacts', 'compiled', 'source', 'minimum', 'progress'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  assert.match(html, /Your mixed bid promises/); assert.match(html, /Turn 2, ordinary lot 3/);
  assert.match(html, /You answered Yes/); assert.match(html, /You answered No/); assert.match(html, /you hold Shield/);
  assert.match(html, / OR /); assert.match(html, / AND /); assert.match(html, /at least 3 spice/); assert.match(html, /at least 7 spice/);
  assert.match(html, /Fulfilled: this whole commitment is complete/); assert.match(html, /Released: this whole commitment is no longer possible/);
  assert.match(html, /Individual fact answers and any reduced future threshold remain private/);
  assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /fulfilled immediately by one qualifying native declaration/);
  assert.match(html, /binding No remains in force until this ordinary lot actually closes/);
  assert.doesNotMatch(html, /Poison Blade|99 spice|controlled-mixed-bid-event|fulfilled-event|Future ordinary progress/);
  assert.equal(MixedBidPromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('shared Basic and Advanced guides forward the exact native mixed bid or pass packet including original funding and card fields', () => {
  for (const advanced of [false, true]) for (const type of ['bid', 'passBid'] as const) {
    const game = projected(type, advanced), sent: Action[] = [];
    if (type === 'bid') game.bidPromiseGuide!.action = { ...game.bidPromiseGuide!.action,
      karama: true, card: 'controlled-original-karama' };
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.bidPromiseGuide!.action]); assert.equal(sent[0], game.bidPromiseGuide!.action);
    assert.match(markup(game), /data-testid="bid-promise-guide"/); assert.doesNotMatch(markup(game), /controlled-original-karama/);
    if (type === 'bid') assert.deepEqual(sent[0], { type, amount: 7, allyPayment: 1, bidPromiseEvent: 'controlled-mixed-bid-event',
      karama: true, card: 'controlled-original-karama' });
    else assert.deepEqual(sent[0], { type, bidPromiseEvent: 'controlled-mixed-bid-event' });
  }
});

void test('mixed bid guide callbacks reject busy, stale, changed lot, event, owner, funding and quiet-window changes', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.auction!.active = 'a'; },
    game => { game.turn = 3; }, game => { game.phase = 5; }, game => { game.status = 'setup'; },
    game => { game.bidPromiseLot = { turn: 2, lot: 4 }; }, game => { game.bidPromiseLot = { turn: 1, lot: 3 }; },
    game => { game.bidPromiseLot = null; }, game => { game.auction = null; },
    game => { game.bidPromiseGuide = { action: { ...game.bidPromiseGuide!.action } }; }, game => { game.bidPromiseGuide = null; },
    game => { game.bidPromiseGuide!.action.amount = 8; }, game => { game.bidPromiseGuide!.action.allyPayment = 2; },
    game => { game.bidPromiseGuide!.action.karama = true; }, game => { game.bidPromiseGuide!.action.type = 'ready'; },
    game => { game.bidPromiseGuide!.action.bidPromiseEvent = 'later-event'; },
    game => { game.mixedBidPromises[0].event = 'expired'; }, game => { game.mixedBidPromises[0].player = 'a'; },
    game => { game.mixedBidPromises[0].turn = 1; }, game => { game.mixedBidPromises[0].lot = 4; },
    game => { game.mixedBidPromises[0].fulfilled = true; }, game => { game.mixedBidPromises[0].released = true; },
    game => { game.mixedBidPromises = []; },
    game => { game.phaseOpening = { passed: [] }; }, game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
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
  const busy = { game: projected(), busy: false, send() { assert.fail('A now-busy guide cannot dispatch'); } };
  const button = guide(busy); busy.busy = true; press(button);
  const replaced = { game: projected(), busy: false, send() { assert.fail('A replaced view cannot dispatch'); } };
  const previous = guide(replaced); replaced.game = { ...replaced.game }; press(previous);
});

void test('pure and mixed bid panels share exactly one current-lot guide while historical or foreign rows neither duplicate nor suppress it', () => {
  const game = projected(), assertGuides = (pure: boolean, mixed: boolean) => {
    assert.equal(pureMarkup(game).includes('data-testid="bid-promise-guide"'), pure);
    assert.equal(markup(game).includes('data-testid="bid-promise-guide"'), mixed);
  };
  assertGuides(false, true);
  game.bidPromises.push({ event: 'controlled-pure-event', player: 'p', asker: 'a', turn: 2, lot: 3, minimum: 4, answer: true });
  assertGuides(true, false);
  for (const change of [() => { game.bidPromises[0].fulfilled = true; },
    () => { game.bidPromises[0].fulfilled = false; game.bidPromises[0].released = true; },
    () => { game.bidPromises[0].released = false; game.bidPromises[0].turn = 1; },
    () => { game.bidPromises[0].turn = 2; game.bidPromises[0].lot = 2; },
    () => { game.bidPromises[0].lot = 3; game.bidPromises[0].player = 'a'; }]) {
    change(); assertGuides(false, true);
  }
  game.bidPromises[0].player = 'p'; game.bidPromiseGuide!.action.bidPromiseEvent = 'controlled-pure-event';
  assertGuides(true, false);
  const sent: Action[] = []; press(guide({ game, busy: false, send(action) { sent.push(action); } }));
  assert.deepEqual(sent, [game.bidPromiseGuide!.action]);
  game.bidPromises = []; game.bidPromiseGuide!.action.bidPromiseEvent = 'controlled-mixed-bid-event';
  game.auction!.active = 'a'; assert.match(markup(game), /Your next bid opportunity is still ahead/);
  for (const change of [() => { game.mixedBidPromises[0].fulfilled = true; },
    () => { game.mixedBidPromises[0].fulfilled = false; game.mixedBidPromises[0].released = true; },
    () => { game.mixedBidPromises[0].released = false; game.mixedBidPromises[0].turn = 1; },
    () => { game.mixedBidPromises[0].turn = 2; game.mixedBidPromises[0].lot = 2; }]) {
    change(); assertGuides(false, false); assert.doesNotMatch(markup(game), /Your next bid opportunity is still ahead/);
  }
});

void test('mixed bid panels and shared guide use public lot and own original question without hidden card, source, holdings or reduced-branch inspection', () => {
  const game = projected(), sent: Action[] = [];
  for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'leaders', 'spice', 'forces', 'reserves', 'tanks', 'elites'])
    Object.defineProperty(player, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  Object.defineProperty(game.auction!, 'card', { get() { throw Error('No hidden ordinary-lot face inspection'); } });
  for (const promise of game.mixedBidPromises) for (const key of ['source', 'minimum', 'residual', 'factAnswers', 'frozenFacts', 'compiled', 'progress'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  assert.match(markup(game), /Bid 7 spice while honoring your answers/);
  press(guide({ game, busy: false, send(action) { sent.push(action); } }));
  assert.deepEqual(sent, [game.bidPromiseGuide!.action]);
});
