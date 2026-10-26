import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RevivalClaimFields, revivalClaimInputError } from '../components/revival-claim-fields';
import { RevivalPromises, RevivalPromiseGuideButton } from '../components/revival-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { RevivalClaim } from '../game/revival-promises';
import { createTechTokens } from '../game/tech-tokens';
import { createTruthRevivalFixture, bindTruthRevival, actTruthRevival, settleTruthRevival } from './fixture-truth-revival';

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
function field(props: Parameters<typeof RevivalClaimFields>[0], id: string) {
  const found = elements(RevivalClaimFields(props)).find(element => element.props.id === id && typeof element.props.onChange === 'function');
  assert.ok(found); return found;
}
function minimum(props: Parameters<typeof RevivalClaimFields>[0], value: number) {
  (field(props, 'truth-revival-minimum').props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)(
    { currentTarget: { valueAsNumber: value } });
}
function counter(props: Parameters<typeof RevivalClaimFields>[0], value: string) {
  (field(props, 'truth-revival-counter').props.onChange as (event: { currentTarget: { value: string } }) => void)(
    { currentTarget: { value } });
}
function guide(props: Parameters<typeof RevivalPromiseGuideButton>[0]) {
  const button = RevivalPromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView, busy = false) => renderToStaticMarkup(createElement(RevivalPromises, { game, busy, send() {} }));

/** Controlled entitled projections exercise UI guards only. The source-earned
 * producer below supplies actual ordinary returns and cumulative progress. */
function projected(action: 'revive' | 'ready' = 'revive', advanced = false): GameView {
  const source = createGame('TRUTHREVIVALCONTROLS', newPlayer('p', 'Respondent', 'emperor'), advanced);
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.phase = 4; game.turn = 2; game.ready = [];
  game.revivalOrder = advanced ? { version: 1, turn: 2, original: ['p', 'a'], remaining: ['p', 'a'], completed: [], started: false } : null;
  game.active = advanced ? 'p' : null;
  game.revivalPromises = [{ event: 'controlled-revival-event', player: 'p', asker: 'a', turn: 2,
    counter: 'total', minimum: 3, answer: action === 'revive', progress: 1 }];
  game.revivalPromiseGuide = { phase: 4, action: action === 'revive'
    ? { type: 'revive', amount: 2, elite: 0, freeElite: 0, revivalPromiseEvent: 'controlled-revival-event' }
    : { type: 'ready', revivalPromiseEvent: 'controlled-revival-event' } };
  return game;
}

void test('Revival claim fields preserve the turn and author only parser-valid physical counter types and whole minima1 through20', () => {
  const value: RevivalClaim = { turn: 2, counter: 'total', minimum: 3 }, changes: RevivalClaim[] = [];
  const props = { value, onChange(next: RevivalClaim) { changes.push(next); } };
  const html = renderToStaticMarkup(createElement(RevivalClaimFields, props));
  assert.match(html, /Turn 2/); assert.match(html, /min="1"/); assert.match(html, /max="20"/);
  for (const type of ['total', 'normal', 'elite']) assert.match(html, new RegExp(`value="${type}"`));
  assert.match(html, /each physical counter counts once/);
  assert.match(html, /Earlier returns, card effects, Ghola and Emperor extra revivals do not count/);
  minimum(props, 1); minimum(props, 20); counter(props, 'normal'); counter(props, 'elite');
  assert.deepEqual(changes, [{ ...value, minimum: 1 }, { ...value, minimum: 20 },
    { ...value, counter: 'normal' }, { ...value, counter: 'elite' }]);
  for (const next of [0, 21, -1, 1.5, NaN, Infinity]) {
    assert.ok(revivalClaimInputError({ ...value, minimum: next })); minimum(props, next);
  }
  counter(props, 'strength'); counter(props, ''); assert.equal(changes.length, 4);
  minimum({ ...props, disabled: true }, 2); counter({ ...props, disabled: true }, 'normal');
  minimum({ ...props, value: { ...value, turn: 0 } }, 2); assert.equal(changes.length, 4);
  assert.match(renderToStaticMarkup(createElement(RevivalClaimFields, { ...props, value: { ...value, minimum: 0 } })), /role="alert"/);
});

void test('own Revival obligations persist with cumulative typed progress, exclusions and completion/release status', () => {
  const game = projected('revive', true);
  game.revivalPromises.push(
    { event: 'no-event', player: 'p', asker: 'a', turn: 2, counter: 'elite', minimum: 2, answer: false, progress: 1 },
    { event: 'fulfilled-event', player: 'p', asker: 'a', turn: 2, counter: 'normal', minimum: 1, answer: true, progress: 1, fulfilled: true },
    { event: 'released-event', player: 'p', asker: 'a', turn: 2, counter: 'total', minimum: 9, answer: true, progress: 0, released: true },
    { event: 'foreign-event', player: 'a', asker: 'p', turn: 2, counter: 'normal', minimum: 19, answer: true, progress: 0 },
  );
  game.revivalOrder!.remaining = ['a', 'p']; game.active = 'a'; game.revivalPromiseGuide = null;
  const before = structuredClone(game);
  for (let render = 0; render < 2; render++) {
    const html = markup(game);
    assert.match(html, /Your Revival promises/); assert.match(html, /Recorded future ordinary returns: 1 physical force/);
    assert.match(html, /Recorded future ordinary returns: 1 elite force/);
    assert.match(html, /No keeps your cumulative future returns below that minimum, including across smaller split requests/);
    assert.match(html, /Prior returns, card effects, Ghola and Emperor extra revivals do not count/);
    assert.match(html, /Original revival costs, limits and turn order still apply/);
    assert.match(html, /Fulfilled: this commitment is complete/); assert.match(html, /Released: this commitment is no longer possible/);
    assert.match(html, /Your Revival opportunity is still ahead/); assert.match(html, /href="\/rules#truthtrance-revival"/);
    assert.doesNotMatch(html, /at least 19|foreign-event|controlled-revival-event/);
  }
  assert.deepEqual(game, before);
  assert.equal(RevivalPromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('actual Basic and ordered Advanced guide callbacks forward native revive or Ready packets unchanged', () => {
  for (const advanced of [false, true]) for (const action of ['revive', 'ready'] as const) {
    const game = projected(action, advanced), sent: Action[] = [];
    const props = { game, busy: false, send(next: Action) { sent.push(next); } };
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.revivalPromiseGuide!.action]); assert.equal(sent[0], game.revivalPromiseGuide!.action);
    press(guide({ ...props, busy: true })); assert.equal(sent.length, 1);
  }
});

void test('stale Revival guides guard readiness, current ordered actor, event, quote and native action windows', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 5; },
    game => { game.status = 'setup'; }, game => { game.ready = ['p']; },
    game => { game.revivalOrder!.remaining = ['a', 'p']; game.active = 'a'; },
    game => { game.revivalOrder!.turn = 1; }, game => { game.active = null; },
    game => { game.revivalOrder = null; }, game => { game.revivalOrder = { ...game.revivalOrder!, remaining: ['p', 'a'] }; },
    game => { game.revivalPromiseGuide = { phase: 4, action: { ...game.revivalPromiseGuide!.action } }; },
    game => { game.revivalPromiseGuide = null; }, game => { game.revivalPromiseGuide!.action.amount = 3; },
    game => { game.revivalPromises[0].event = 'another-event'; }, game => { game.revivalPromises[0].player = 'a'; },
    game => { game.revivalPromises[0].fulfilled = true; }, game => { game.revivalPromises[0].released = true; },
    game => { game.revivalPromises = []; }, game => { game.phaseOpening = { passed: [] }; },
    game => { game.decision = { kind: 'revivalStop', player: 'a', recipient: 'p', revival: 'forces' }; },
    game => { game.response = { kind: 'revivalIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.automaticContinuationPending = true; },
    game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.techTokens = createTechTokens(); },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
  ];
  for (const change of changes) {
    const game = projected('revive', true), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); change(game); press(button); assert.deepEqual(sent, []);
  }
  const props = { game: projected(), busy: false, send() { assert.fail('A now-busy guide cannot dispatch'); } };
  const button = guide(props); props.busy = true; press(button);
});

void test('Revival guidance never reconstructs eligibility from private hands or rival physical pools', () => {
  const game = projected(), sent: Action[] = [];
  for (const seat of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'reserves', 'tanks', 'elites'])
    Object.defineProperty(seat, key, { get() { throw Error(`No private or unneeded ${key} inspection`); }, configurable: true });
  assert.match(markup(game), /Revive 2 forces while honoring your answers/);
  press(guide({ game, busy: false, send(action) { sent.push(action); } }));
  assert.deepEqual(sent, [game.revivalPromiseGuide!.action]);
});

void test('source-earned Basic and Advanced Revival views connect the actual guide callback to completed ordinary progress', () => {
  for (const advanced of [false, true]) {
    const f = createTruthRevivalFixture({ advanced, window: 'active' });
    const bound = bindTruthRevival(f, 'yes', 3, 'total');
    const respondent = viewGame(bound.asked, f.target);
    assert.ok(respondent.truthRevivalAnswers?.includes('yes'));
    assert.equal(viewGame(bound.asked, f.asker).truthRevivalAnswers, null);
    const answers = renderToStaticMarkup(createElement(Truthtrance, { game: respondent, busy: false, act() {} }));
    assert.match(answers, /Answer Yes/); assert.match(answers, /Answer No/);
    const game = viewGame(bound.game, f.target), sent: Action[] = [];
    if (advanced) assert.equal(game.revivalOrder?.remaining[0], f.target);
    else assert.equal(game.revivalOrder, null);
    assert.match(markup(game), /Your Revival promises/); assert.match(markup(game), /Recorded future ordinary returns: 0 physical forces/);
    const next = game.revivalPromiseGuide; assert.ok(next);
    press(guide({ game, busy: false, send(action) { sent.push(action); } }));
    assert.deepEqual(sent, [next.action]);
    const after = settleTruthRevival(actTruthRevival(bound.game, f.target, sent[0]));
    const promise = after.revivalPromises?.find(promise => promise.event === next.action.revivalPromiseEvent);
    assert.ok(promise); assert.equal(promise.progress, 3); assert.equal(promise.fulfilled, true);
    assert.equal(after.players.find(player => player.id === f.target)!.tanks, 0);
    assert.match(markup(viewGame(after, f.target)), /Fulfilled: this commitment is complete/);
    assert.equal(RevivalPromiseGuideButton({ game: viewGame(after, f.target), busy: false, send() {} }), null);
    assert.equal(RevivalPromises({ game: viewGame(after, f.asker), busy: false, send() {} }), null);
  }
});
