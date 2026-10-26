import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BidClaimFields, bidClaimInputError } from '../components/bid-claim-fields';
import { BidPromises, BidPromiseGuideButton } from '../components/bid-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { BidClaim } from '../game/bid-promises';
import { createTechTokens } from '../game/tech-tokens';
import { createTruthBidFixture, bindTruthBid, actTruthBid, truthBidInventory } from './fixture-truth-bid';

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
const { Truthtrance } = await import('../components/truthtrance');
aliases.deregister();

type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function edit(props: Parameters<typeof BidClaimFields>[0], minimum: number) {
  const input = elements(BidClaimFields(props)).find(element => element.props.id === 'truth-bid-minimum' && typeof element.props.onChange === 'function');
  assert.ok(input);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber: minimum } });
}
function guide(props: Parameters<typeof BidPromiseGuideButton>[0]) {
  const button = BidPromiseGuideButton(props); assert.ok(button);
  return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView, busy = false) => renderToStaticMarkup(createElement(BidPromises, { game, busy, send() {} }));

/** Controlled personalized projections exercise UI guards only. The native
 * producer below supplies earned questions, answers and ordinary lot actions. */
function projected(action: 'bid' | 'passBid' = 'bid'): GameView {
  const source = createGame('TRUTHBIDCONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.phase = 3; game.turn = 2;
  game.auction = { bid: 1, bidder: 'a', active: 'p', remaining: 2, inspectionBlocked: null, card: null };
  game.bidPromiseLot = { turn: 2, lot: 1 };
  game.bidPromises = [{ event: 'controlled-bid-event', player: 'p', asker: 'a', turn: 2, lot: 1,
    minimum: 4, answer: action === 'bid' }];
  game.bidPromiseGuide = { action: action === 'bid'
    ? { type: 'bid', amount: 4, allyPayment: 1, bidPromiseEvent: 'controlled-bid-event' }
    : { type: 'passBid', bidPromiseEvent: 'controlled-bid-event' } };
  return game;
}

void test('bid claim fields keep the displayed turn and lot fixed and accept only parser-valid whole minimum edits', () => {
  const value: BidClaim = { turn: 2, lot: 3, minimum: 4 }, changes: BidClaim[] = [];
  const props = { value, onChange(next: BidClaim) { changes.push(next); } };
  const html = renderToStaticMarkup(createElement(BidClaimFields, props));
  assert.match(html, /Turn 2 · Ordinary lot 3/); assert.match(html, /Minimum bid in spice/);
  assert.match(html, /min="1"/); assert.match(html, /max="9007199254740991"/);
  assert.match(html, /If you win, the original payment rules still apply/);
  assert.match(html, /optional modules and native special auctions are excluded/);
  assert.equal(elements(BidClaimFields(props)).filter(element => typeof element.props.onChange === 'function').length, 1);
  for (const minimum of [1, 7, Number.MAX_SAFE_INTEGER]) edit(props, minimum);
  assert.deepEqual(changes, [1, 7, Number.MAX_SAFE_INTEGER].map(minimum => ({ ...value, minimum })));
  for (const minimum of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.ok(bidClaimInputError({ ...value, minimum })); edit(props, minimum);
  }
  assert.equal(changes.length, 3);
  edit({ ...props, disabled: true }, 8); assert.equal(changes.length, 3);
  edit({ ...props, value: { ...value, lot: 0 } }, 8); assert.equal(changes.length, 3);
  assert.match(renderToStaticMarkup(createElement(BidClaimFields, { ...props, value: { ...value, minimum: 0 } })), /role="alert"/);
});

void test('own bid commitments remain visible with exact Yes/No meaning, completion and release statuses', () => {
  const game = projected();
  game.bidPromises.push(
    { event: 'no-event', player: 'p', asker: 'a', turn: 2, lot: 1, minimum: 8, answer: false },
    { event: 'fulfilled-event', player: 'p', asker: 'a', turn: 2, lot: 1, minimum: 2, answer: true, fulfilled: true },
    { event: 'released-event', player: 'p', asker: 'a', turn: 2, lot: 1, minimum: 12, answer: true, released: true },
    { event: 'foreign-event', player: 'a', asker: 'p', turn: 2, lot: 1, minimum: 99, answer: true },
  );
  game.auction!.active = 'a'; game.bidPromiseGuide = null;
  const before = structuredClone(game);
  for (let render = 0; render < 2; render++) {
    const html = markup(game);
    assert.match(html, /Your bid promises/); assert.match(html, /ordinary lot 1/);
    assert.match(html, /Yes requires one qualifying bid/); assert.match(html, /No forbids every later bid at or above/);
    assert.match(html, /If you win, the original payment rules still apply/);
    assert.match(html, /Fulfilled: this commitment is complete/); assert.match(html, /Released: this commitment is no longer possible/);
    assert.match(html, /Your next bid opportunity is still ahead/);
    assert.doesNotMatch(html, /99 spice|foreign-event|controlled-bid-event/);
  }
  assert.deepEqual(game, before);
  assert.equal(BidPromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('the actual guide callback forwards bid or pass with the authoritative funding and event fields unchanged', () => {
  for (const type of ['bid', 'passBid'] as const) {
    const game = projected(type), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); press(button);
    assert.deepEqual(sent, [game.bidPromiseGuide!.action]); assert.equal(sent[0], game.bidPromiseGuide!.action);
    assert.equal(button.props.disabled, false);
    press(guide({ ...props, busy: true })); assert.equal(sent.length, 1);
  }
});

void test('busy and stale guide callbacks cannot cross current owner, lot, event, stage or continuation boundaries', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.auction!.active = 'a'; },
    game => { game.turn = 3; }, game => { game.phase = 5; }, game => { game.status = 'setup'; },
    game => { game.bidPromiseLot = { turn: 2, lot: 2 }; }, game => { game.bidPromiseLot = null; },
    game => { game.bidPromiseGuide = { action: { ...game.bidPromiseGuide!.action } }; },
    game => { game.bidPromiseGuide = null; }, game => { game.bidPromiseGuide!.action.amount = 5; },
    game => { game.bidPromises[0].event = 'another-event'; }, game => { game.bidPromises[0].player = 'a'; },
    game => { game.bidPromises[0].fulfilled = true; }, game => { game.bidPromises[0].released = true; },
    game => { game.bidPromises = []; }, game => { game.auction = null; },
    game => { game.phaseOpening = { passed: [] }; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.techTokens = createTechTokens(); },
    game => { game.automaticContinuationPending = true; },
    game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
  ];
  for (const change of changes) {
    const game = projected(), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); change(game); press(button); assert.deepEqual(sent, []);
  }
  const props = { game: projected(), busy: false, send() { assert.fail('A now-busy guide cannot dispatch'); } };
  const button = guide(props); props.busy = true; press(button);
});

void test('bid controls use the public lot and own guide without reading card faces, source fingerprints or rival holdings', () => {
  const game = projected(), sent: Action[] = [];
  for (const player of game.players) {
    for (const key of ['hand', 'traitors', 'faceDancers']) Object.defineProperty(player, key, {
      get() { throw Error(`Bid controls cannot inspect ${key}`); }, configurable: true,
    });
  }
  Object.defineProperty(game.auction!, 'card', { get() { throw Error('No ordinary-lot face inspection'); } });
  Object.defineProperty(game.bidPromises[0], 'source', { get() { throw Error('No internal bid source inspection'); } });
  assert.match(markup(game), /Bid 4 spice while honoring your answers/);
  press(guide({ game, busy: false, send(action) { sent.push(action); } }));
  assert.deepEqual(sent, [game.bidPromiseGuide!.action]);
});

void test('source-earned Basic and Advanced current-lot answers connect persistent guidance to the actual qualifying bid callback', () => {
  for (const advanced of [false, true]) {
    const f = createTruthBidFixture({ advanced, window: 'active' }), bound = bindTruthBid(f, 'yes', 4);
    const respondent = viewGame(bound.asked, f.target);
    assert.ok(respondent.truthBidAnswers?.includes('yes'));
    assert.equal(viewGame(bound.asked, f.asker).truthBidAnswers, null);
    const answerHtml = renderToStaticMarkup(createElement(Truthtrance, { game: respondent, busy: false, act() {} }));
    assert.match(answerHtml, /Answer Yes/); assert.match(answerHtml, /Answer No/);
    const game = viewGame(bound.game, f.target), sent: Action[] = [];
    assert.deepEqual(game.bidPromiseLot, { turn: bound.game.turn, lot: 1 });
    assert.match(markup(game), /Your bid promises/); assert.match(markup(game), /Bid 4 spice/);
    const next = game.bidPromiseGuide; assert.ok(next);
    press(guide({ game, busy: false, send(action) { sent.push(action); } }));
    assert.deepEqual(sent, [next.action]);
    const after = actTruthBid(bound.game, f.target, sent[0]);
    const event = next.action.bidPromiseEvent; assert.equal(typeof event, 'string');
    assert.equal(after.bidPromises?.find(promise => promise.event === event)?.fulfilled, true);
    assert.equal(after.players.find(player => player.id === f.target)!.spice, 10,
      'The qualifying bid fulfills Yes before any later winning invoice is paid.');
    assert.deepEqual(truthBidInventory(after), f.originalCards);
    assert.equal(BidPromises({ game: viewGame(after, f.asker), busy: false, send() {} }), null);
  }
});
