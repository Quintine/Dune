import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AllianceClaimFields, allianceClaimInputError } from '../components/alliance-claim-fields';
import { AlliancePromises, AlliancePromiseGuideButton } from '../components/alliance-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { AllianceClaim } from '../game/alliance-promises';
import { createTechTokens } from '../game/tech-tokens';
import {
  createTruthAllianceFixture, bindTruthAlliance, actTruthAlliance, settleTruthAlliance,
  closeTruthAllianceNexus, truthAllianceInventory,
} from './fixture-truth-alliance';

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
function partner(props: Parameters<typeof AllianceClaimFields>[0], value: string) {
  const input = elements(AllianceClaimFields(props)).find(element => element.props.id === 'truth-alliance-partner');
  assert.ok(input);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function guide(props: Parameters<typeof AlliancePromiseGuideButton>[0]) {
  const button = AlliancePromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView, busy = false) => renderToStaticMarkup(createElement(AlliancePromises, { game, busy, send() {} }));

/** Controlled personalized Nexus projections exercise UI guards only; the
 * native source below earns its worm, consent, Truthtrance and final close. */
function projected(kind: 'accept' | 'break' | 'ready' = 'accept'): GameView {
  const source = createGame('TRUTHALLIANCECONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'harkonnen'));
  joinGame(source, newPlayer('r', 'Partner', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = 1; game.nexus = true; game.spiceWindow = null;
  game.active = 'a'; game.ready = []; game.alliancePromiseNexus = { turn: 2 };
  game.alliancePromises = [{ event: 'controlled-alliance-event', player: 'p', asker: 'a', turn: 2,
    partner: 'r', answer: kind !== 'break' }];
  game.allianceOffers = kind === 'accept' ? { r: 'p' } : {};
  if (kind !== 'accept') {
    game.players.find(player => player.id === 'p')!.ally = 'r';
    game.players.find(player => player.id === 'r')!.ally = 'p';
  }
  game.alliancePromiseGuide = { action: { type: kind === 'ready' ? 'ready' : 'alliance',
    ...(kind === 'ready' ? {} : { target: kind === 'accept' ? 'r' : null }), alliancePromiseEvent: 'controlled-alliance-event' } };
  return game;
}

void test('alliance claim fields fix this Nexus turn and accept only a current named other partner', () => {
  const value: AllianceClaim = { turn: 2, partner: 'r' }, changes: AllianceClaim[] = [];
  const partners = [{ id: 'r', name: 'Partner' }, { id: 'a', name: 'Asker' }];
  const props = { value, partners, onChange(next: AllianceClaim) { changes.push(next); } };
  const html = renderToStaticMarkup(createElement(AllianceClaimFields, props));
  assert.match(html, /Turn 2 · Current Nexus/); assert.match(html, /Named alliance partner/);
  assert.match(html, /actual membership when this Nexus closes/); assert.match(html, /Offers alone are not alliances/);
  assert.match(html, /cannot promise the other player’s consent/);
  assert.equal(elements(AllianceClaimFields(props)).filter(element => typeof element.props.onChange === 'function').length, 1);
  partner(props, 'a'); assert.deepEqual(changes, [{ turn: 2, partner: 'a' }]);
  for (const invalid of ['missing', '', ' r ']) partner(props, invalid);
  partner({ ...props, disabled: true }, 'a'); partner({ ...props, partners: [] }, 'a');
  partner({ ...props, value: { ...value, turn: 0 } }, 'a'); assert.equal(changes.length, 1);
  assert.ok(allianceClaimInputError(value, []));
  assert.match(renderToStaticMarkup(createElement(AllianceClaimFields, { ...props, partners: [] })), /role="alert"/);
});

void test('own alliance promises describe final membership and remain live after formation until the actual Nexus close', () => {
  const game = projected('ready');
  game.alliancePromises.push(
    { event: 'no-event', player: 'p', asker: 'a', turn: 2, partner: 'a', answer: false },
    { event: 'fulfilled-event', player: 'p', asker: 'a', turn: 1, partner: 'r', answer: true, fulfilled: true },
    { event: 'released-event', player: 'p', asker: 'a', turn: 1, partner: 'a', answer: true, released: true },
    { event: 'foreign-event', player: 'a', asker: 'p', turn: 2, partner: 'r', answer: true },
  );
  const before = structuredClone(game);
  for (let render = 0; render < 2; render++) {
    const html = markup(game);
    assert.match(html, /Your alliance promises/); assert.match(html, /be allied with Partner when this Nexus ends/);
    assert.match(html, /Yes remains live after forming an alliance and settles only at the close/);
    assert.match(html, /a temporary alliance can still be ended before the close/);
    assert.match(html, /Offers alone are not alliances/); assert.match(html, /Neither answer promises another player’s consent/);
    assert.match(html, /Honor any earlier promises first/); assert.match(html, /Fulfilled at the Nexus close/);
    assert.match(html, /href="\/rules#truthtrance-alliance"/);
    assert.doesNotMatch(html, /foreign-event|controlled-alliance-event/);
  }
  assert.deepEqual(game, before);
  assert.equal(AlliancePromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('actual guide callbacks forward reciprocal acceptance, explicit-null break and Ready out of turn', () => {
  for (const kind of ['accept', 'break', 'ready'] as const) {
    const game = projected(kind), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.alliancePromiseGuide!.action]); assert.equal(sent[0], game.alliancePromiseGuide!.action);
    assert.equal(game.active, 'a'); assert.notEqual(game.active, game.me);
    if (kind === 'break') assert.equal(sent[0].target, null);
    press(guide({ ...props, busy: true })); assert.equal(sent.length, 1);
  }
});

void test('stale guides cannot cross Nexus closure, readiness, membership, consent, current event or quiet windows', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 2; },
    game => { game.status = 'setup'; }, game => { game.nexus = false; }, game => { game.ready = ['p']; },
    game => { game.spiceWindow = { territory: 'hagga_basin', sector: 12, amount: 6, harvested: false }; },
    game => { game.alliancePromiseNexus = null; }, game => { game.alliancePromiseNexus!.turn = 1; },
    game => { game.alliancePromiseGuide = { action: { ...game.alliancePromiseGuide!.action } }; },
    game => { game.alliancePromiseGuide = null; }, game => { game.alliancePromiseGuide!.action.target = null; },
    game => { game.alliancePromises[0].event = 'expired'; }, game => { game.alliancePromises[0].player = 'a'; },
    game => { game.alliancePromises[0].fulfilled = true; }, game => { game.alliancePromises[0].released = true; },
    game => { game.alliancePromises = []; }, game => { game.allianceOffers = {}; },
    game => { game.players = game.players.filter(player => player.id !== 'r'); },
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
  const ready = projected('ready');
  ready.players.find(player => player.id === 'p')!.ally = null; ready.players.find(player => player.id === 'r')!.ally = null;
  const sent: Action[] = []; press(guide({ game: ready, busy: false, send(action) { sent.push(action); } })); assert.equal(sent.length, 0);
  const noReady = projected('break'); noReady.alliancePromiseGuide!.action = { type: 'ready', alliancePromiseEvent: 'controlled-alliance-event' };
  press(guide({ game: noReady, busy: false, send(action) { sent.push(action); } })); assert.equal(sent.length, 0);
  const noConsent = projected(); noConsent.allianceOffers = {};
  press(guide({ game: noConsent, busy: false, send(action) { sent.push(action); } })); assert.equal(sent.length, 0);
  for (const target of ['p', 'missing']) {
    const game = projected(); game.alliancePromiseGuide!.action.target = target;
    press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.equal(sent.length, 0);
  }
  const props = { game: projected(), busy: false, send() { assert.fail('A now-busy alliance guide cannot dispatch'); } };
  const button = guide(props); props.busy = true; press(button);
});

void test('alliance guidance uses public membership and offers without inspecting private sources, supplies or card piles', () => {
  const game = projected(), sent: Action[] = [];
  for (const seat of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'bribes', 'reserves', 'tanks'])
    Object.defineProperty(seat, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  for (const key of ['spiceDeck', 'deck', 'discard']) Object.defineProperty(game, key, {
    get() { throw Error(`No private ${key} inspection`); }, configurable: true,
  });
  Object.defineProperty(game.alliancePromises[0], 'source', { get() { throw Error('No private Nexus source inspection'); } });
  assert.match(markup(game), /Accept Partner’s alliance invitation/);
  press(guide({ game, busy: false, send(action) { sent.push(action); } }));
  assert.deepEqual(sent, [game.alliancePromiseGuide!.action]);
});

void test('genuine Basic and Advanced guides accept actual consent and settle Yes only at the original Nexus close', () => {
  for (const advanced of [false, true]) {
    const f = createTruthAllianceFixture({ advanced, consent: 'offered' }), bound = bindTruthAlliance(f, 'yes', f.partner);
    const respondent = viewGame(bound.asked, f.target);
    assert.ok(respondent.truthAllianceAnswers?.includes('yes'));
    assert.equal(viewGame(bound.asked, f.asker).truthAllianceAnswers, null);
    const answers = renderToStaticMarkup(createElement(Truthtrance, { game: respondent, busy: false, act() {} }));
    assert.match(answers, /Answer Yes/); assert.match(answers, /Answer No/);
    let game = bound.game;
    const dispatch = (type: string) => {
      const view = viewGame(game, f.target), sent: Action[] = [], next = view.alliancePromiseGuide; assert.ok(next);
      assert.equal(next.action.type, type);
      press(guide({ game: view, busy: false, send(action) { sent.push(action); } }));
      assert.deepEqual(sent, [next.action]); game = settleTruthAlliance(actTruthAlliance(game, f.target, sent[0]));
    };
    assert.equal(game.allianceOffers[f.partner], f.target);
    assert.equal(game.players.find(player => player.id === f.target)!.ally, null, 'A real offer alone has not formed the alliance.');
    dispatch('alliance');
    assert.equal(game.players.find(player => player.id === f.target)!.ally, f.partner);
    assert.notEqual(game.alliancePromises!.find(promise => promise.player === f.target)!.fulfilled, true);
    assert.match(markup(viewGame(game, f.target)), /This answer stays binding until this Nexus closes/);
    dispatch('ready'); game = closeTruthAllianceNexus(game);
    assert.equal(game.nexus, false);
    assert.equal(game.alliancePromises!.find(promise => promise.player === f.target)!.fulfilled, true);
    assert.deepEqual(truthAllianceInventory(game), f.originalCards);
    assert.match(markup(viewGame(game, f.target)), /Fulfilled at the Nexus close/);
    assert.equal(AlliancePromises({ game: viewGame(game, f.asker), busy: false, send() {} }), null);
  }
});
