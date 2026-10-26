import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BribeClaimFields, bribeClaimInputError } from '../components/bribe-claim-fields';
import { BribePromises, BribePromiseGuideButton } from '../components/bribe-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { BribeClaim } from '../game/bribe-promises';
import { createTechTokens } from '../game/tech-tokens';
import { createTruthBribeFixture, bindTruthBribe, actTruthBribe, settleTruthBribe, truthBribeInventory } from './fixture-truth-bribe';

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
function field(props: Parameters<typeof BribeClaimFields>[0], id: string) {
  const found = elements(BribeClaimFields(props)).find(element => element.props.id === id && typeof element.props.onChange === 'function');
  assert.ok(found); return found;
}
function minimum(props: Parameters<typeof BribeClaimFields>[0], value: number) {
  (field(props, 'truth-bribe-minimum').props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)(
    { currentTarget: { valueAsNumber: value } });
}
function recipient(props: Parameters<typeof BribeClaimFields>[0], value: string) {
  (field(props, 'truth-bribe-recipient').props.onChange as (event: { currentTarget: { value: string } }) => void)(
    { currentTarget: { value } });
}
function guide(props: Parameters<typeof BribePromiseGuideButton>[0]) {
  const button = BribePromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView, busy = false) => renderToStaticMarkup(createElement(BribePromises, { game, busy, send() {} }));

/** Controlled personalized quotes supplement the native producer below. They
 * are UI projections, rather than installed authoritative payments or promises. */
function projected(phase = 3): GameView {
  const source = createGame('TRUTHBRIBECONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  joinGame(source, newPlayer('r', 'Recipient', 'harkonnen'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.active = 'a';
  game.auction = { bid: 0, bidder: null, active: 'a', remaining: 2, card: null, inspectionBlocked: null };
  game.bribeOptions = { available: 8, incoming: 0, blocked: null,
    targets: [{ id: 'r', maximum: 6, limitation: null }, { id: 'a', maximum: 8, limitation: null }] };
  game.bribePromises = [{ event: 'controlled-bribe-event', player: 'p', asker: 'a', turn: 2,
    recipient: 'r', minimum: 3, answer: true, progress: 1 }];
  game.bribePromiseGuide = { action: { type: 'bribe', target: 'r', amount: 2, bribePromiseEvent: 'controlled-bribe-event' } };
  return game;
}

void test('bribe claim fields keep the turn fixed and accept only current recipients and positive safe whole minima', () => {
  const value: BribeClaim = { turn: 2, recipient: 'r', minimum: 3 }, changes: BribeClaim[] = [];
  const recipients = [{ id: 'r', name: 'Recipient' }, { id: 'a', name: 'Asker' }];
  const props = { value, recipients, onChange(next: BribeClaim) { changes.push(next); } };
  const html = renderToStaticMarkup(createElement(BribeClaimFields, props));
  assert.match(html, /Turn 2/); assert.match(html, /Recipient/); assert.match(html, /min="1"/);
  assert.match(html, /max="9007199254740991"/); assert.match(html, /smaller payments add together/);
  assert.match(html, /Earlier payments, gifts and ally aid do not count/);
  assert.match(html, /recipient collects the payment at the start of Mentat Pause/);
  assert.match(html, /Payments made during Mentat Pause wait until the start of next turn&#x27;s Mentat Pause/);
  minimum(props, 1); minimum(props, Number.MAX_SAFE_INTEGER); recipient(props, 'a');
  assert.deepEqual(changes, [{ ...value, minimum: 1 }, { ...value, minimum: Number.MAX_SAFE_INTEGER }, { ...value, recipient: 'a' }]);
  for (const next of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.ok(bribeClaimInputError({ ...value, minimum: next }, recipients)); minimum(props, next);
  }
  recipient(props, 'missing'); recipient(props, ''); assert.equal(changes.length, 3);
  minimum({ ...props, disabled: true }, 2); recipient({ ...props, disabled: true }, 'a');
  minimum({ ...props, recipients: [] }, 2); assert.equal(changes.length, 3);
  assert.ok(bribeClaimInputError(value, []));
  assert.match(renderToStaticMarkup(createElement(BribeClaimFields, { ...props, recipients: [] })), /role="alert"/);
});

void test('own bribe promises persist with named cumulative progress, delayed spending and complete/released status', () => {
  const game = projected();
  game.bribePromises.push(
    { event: 'no-event', player: 'p', asker: 'a', turn: 2, recipient: 'r', minimum: 5, answer: false, progress: 1 },
    { event: 'fulfilled-event', player: 'p', asker: 'a', turn: 2, recipient: 'r', minimum: 1, answer: true, progress: 1, fulfilled: true },
    { event: 'released-event', player: 'p', asker: 'a', turn: 2, recipient: 'a', minimum: 9, answer: true, progress: 0, released: true },
    { event: 'foreign-event', player: 'a', asker: 'p', turn: 2, recipient: 'r', minimum: 99, answer: true, progress: 0 },
  );
  const before = structuredClone(game);
  for (let render = 0; render < 2; render++) {
    const html = markup(game);
    assert.match(html, /Your bribe promises/); assert.match(html, /Recorded future ordinary payments to Recipient: 1 spice/);
    assert.match(html, /No forbids reaching that minimum during the rest of this turn/);
    assert.match(html, /Smaller payments to the named recipient add together/);
    assert.match(html, /Prior payments, gifts and ally aid do not count/);
    assert.match(html, /The sender pays immediately/); assert.match(html, /recipient collects the payment at the start of Mentat Pause/);
    assert.match(html, /Payments made during Mentat Pause wait until the start of next turn&#x27;s Mentat Pause/);
    assert.match(html, /Fulfilled: this commitment is complete/); assert.match(html, /Released: this commitment is no longer possible/);
    assert.match(html, /href="\/rules#truthtrance-bribe"/);
    assert.doesNotMatch(html, /at least 99|foreign-event|controlled-bribe-event/);
  }
  assert.deepEqual(game, before);
  assert.equal(BribePromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('actual guide callbacks forward exact ordinary bribes out of turn throughout their supported phases', () => {
  for (const phase of [0, 3, 4, 7]) {
    const game = projected(phase), sent: Action[] = [];
    if (phase === 4) {
      game.advanced = true;
      game.ready = ['p'];
      game.revivalOrder = { version: 1, turn: 2, original: ['a', 'p', 'r'], remaining: ['a', 'r'], completed: ['p'], started: false };
    }
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.bribePromiseGuide!.action]); assert.equal(sent[0], game.bribePromiseGuide!.action);
    assert.equal(game.active, 'a'); assert.equal(game.auction!.active, 'a');
    press(guide({ ...props, busy: true })); assert.equal(sent.length, 1);
  }
});

void test('controlled quiet Mentat guide forwards the exact payment for an already-ready payer and explains next-turn collection', () => {
  const game = projected(8), sent: Action[] = [];
  game.auction = null; game.active = null; game.ready = ['p'];
  const before = structuredClone(game);
  const button = guide({ game, busy: false, send(action) { sent.push(action); } });
  assert.equal(button.props.disabled, false);
  press(button);
  assert.deepEqual(sent, [game.bribePromiseGuide!.action]);
  assert.equal(sent[0], game.bribePromiseGuide!.action);
  assert.deepEqual(game, before);
  assert.match(markup(game), /Payments made during Mentat Pause wait until the start of next turn&#x27;s Mentat Pause/);
});

void test('controlled bribe callbacks expire when their original phase changes between otherwise supported windows', () => {
  for (const [original, current] of [[3, 8], [8, 7], [7, 8]]) {
    const game = projected(original), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props);
    assert.equal(button.props.disabled, false);
    game.phase = current;
    press(button);
    assert.deepEqual(sent, []);
    const currentButton = guide(props);
    assert.equal(currentButton.props.disabled, false);
    press(currentButton);
    assert.deepEqual(sent, [game.bribePromiseGuide!.action]);
  }
});

void test('the shared bribe guide honors its exact live scalar or whole-expression event when both ledgers exist', () => {
  for (const source of ['scalar', 'expression'] as const) {
    const game = projected(), sent: Action[] = [];
    game.bribeExpressionPromises = [{ event: 'controlled-whole-bribe-event', player: 'p', asker: 'a', turn: 2,
      claim: { kind: 'or', terms: [{ kind: 'payment', recipient: 'r', minimum: 3 }, { kind: 'payment', recipient: 'a', minimum: 2 }] },
      answer: true, progress: [] }];
    game.bribePromiseGuide!.action.bribePromiseEvent = source === 'scalar' ? game.bribePromises[0].event : game.bribeExpressionPromises[0].event;
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button);
    assert.equal(sent[0], game.bribePromiseGuide!.action);
    if (source === 'scalar') game.bribePromises[0].fulfilled = true;
    else game.bribeExpressionPromises[0].released = true;
    press(button); assert.equal(sent.length, 1, 'A different live event does not preserve the old callback.');
    game.bribePromiseGuide = { action: { ...game.bribePromiseGuide!.action,
      bribePromiseEvent: source === 'scalar' ? game.bribeExpressionPromises[0].event : game.bribePromises[0].event } };
    const current = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(current.props.disabled, false); press(current); assert.equal(sent.length, 2);
  }
});

void test('stale bribe guides respect current scope, exact recipient, strictly clear timing and projected payment bounds', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.status = 'setup'; },
    game => { game.phase = 9; }, game => { game.phase = -1; },
    game => { game.bribePromiseGuide = { action: { ...game.bribePromiseGuide!.action } }; },
    game => { game.bribePromiseGuide = null; }, game => { game.bribePromiseGuide!.action.amount = 3; },
    game => { game.bribePromises[0].event = 'expired'; }, game => { game.bribePromises[0].player = 'a'; },
    game => { game.bribePromises[0].fulfilled = true; }, game => { game.bribePromises[0].released = true; },
    game => { game.bribePromises = []; }, game => { game.players = game.players.filter(player => player.id !== 'r'); },
    game => { game.players.find(player => player.id === 'p')!.ally = 'r'; },
    game => { game.bribeOptions.blocked = 'Finish a decision first.'; }, game => { game.bribeOptions.blocked = ''; },
    game => { game.bribeOptions.available = 1; }, game => { game.bribeOptions.available = NaN; },
    game => { game.bribeOptions.targets[0].maximum = 1; }, game => { game.bribeOptions.targets[0].maximum = NaN; },
    game => { game.bribeOptions.targets = game.bribeOptions.targets.filter(target => target.id !== 'r'); },
    game => { game.phaseOpening = { passed: [] }; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
    game => { game.automaticContinuationPending = true; },
    game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.techTokens = createTechTokens(); },
  ];
  for (const change of changes) {
    const game = projected(), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); change(game); press(button); assert.deepEqual(sent, []);
  }
  for (const amount of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const game = projected(); game.bribePromiseGuide!.action.amount = amount;
    const sent: Action[] = []; press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.deepEqual(sent, []);
  }
  for (const target of ['p', 'missing']) {
    const game = projected(); game.bribePromiseGuide!.action.target = target;
    game.bribeOptions.targets.push({ id: target, maximum: 8, limitation: null });
    const sent: Action[] = []; press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.deepEqual(sent, []);
  }
  const props = { game: projected(), busy: false, send() { assert.fail('A now-busy bribe guide cannot dispatch'); } };
  const button = guide(props); props.busy = true; press(button);
});

void test('promise guidance uses projected payment bounds without inspecting private supplies, hands or auction faces', () => {
  const game = projected(), sent: Action[] = [];
  for (const seat of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'bribes', 'tanks', 'reserves'])
    Object.defineProperty(seat, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  Object.defineProperty(game.auction!, 'card', { get() { throw Error('No hidden lot inspection'); } });
  assert.match(markup(game), /Pay 2 spice to Recipient while honoring your answers/);
  press(guide({ game, busy: false, send(action) { sent.push(action); } }));
  assert.deepEqual(sent, [game.bribePromiseGuide!.action]);
});

void test('genuine Basic and Advanced out-of-turn bribe callbacks record future payment before the recipient can spend it', () => {
  for (const advanced of [false, true]) {
    const f = createTruthBribeFixture({ advanced, window: 'waiting' }), bound = bindTruthBribe(f, 'yes', 3);
    const respondent = viewGame(bound.asked, f.target);
    assert.ok(respondent.truthBribeAnswers?.includes('yes'));
    assert.equal(viewGame(bound.asked, f.asker).truthBribeAnswers, null);
    const answers = renderToStaticMarkup(createElement(Truthtrance, { game: respondent, busy: false, act() {} }));
    assert.match(answers, /Answer Yes/); assert.match(answers, /Answer No/);
    const game = viewGame(bound.game, f.target), sent: Action[] = [], next = game.bribePromiseGuide;
    assert.ok(next); assert.equal(game.auction?.active, f.asker); assert.notEqual(game.auction?.active, f.target);
    assert.match(markup(game), /Pay 3 spice to/);
    press(guide({ game, busy: false, send(action) { sent.push(action); } }));
    assert.deepEqual(sent, [next.action]);
    assert.ok(next.action.type === 'bribe' && typeof next.action.amount === 'number');
    const amount = next.action.amount;
    const sender = bound.game.players.find(player => player.id === f.target); assert.ok(sender);
    const recipient = bound.game.players.find(player => player.id === next.action.target); assert.ok(recipient);
    const after = settleTruthBribe(actTruthBribe(bound.game, f.target, sent[0]));
    assert.equal(after.players.find(player => player.id === sender.id)!.spice, sender.spice - amount);
    assert.equal(after.players.find(player => player.id === recipient.id)!.spice, recipient.spice);
    assert.equal(after.players.find(player => player.id === recipient.id)!.bribes, recipient.bribes + amount);
    const promise = after.bribePromises!.find(promise => promise.event === next.action.bribePromiseEvent);
    assert.ok(promise); assert.equal(promise.progress, 3); assert.equal(promise.fulfilled, true);
    assert.deepEqual(truthBribeInventory(after), f.originalCards);
    assert.match(markup(viewGame(after, f.target)), /Fulfilled: this commitment is complete/);
    assert.equal(BribePromises({ game: viewGame(after, f.asker), busy: false, send() {} }), null);
  }
});
