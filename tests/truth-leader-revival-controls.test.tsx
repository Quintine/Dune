import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeaderRevivalClaimFields, leaderRevivalClaimInputError } from '../components/leader-revival-claim-fields';
import { LeaderRevivalPromises, LeaderRevivalPromiseGuideButton } from '../components/leader-revival-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { LeaderRevivalClaim } from '../game/leader-revival-promises';
import { createRicheseAuction, projectRicheseAuction } from '../game/richese-auction';
import { createTechTokens } from '../game/tech-tokens';

type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
type Props = Parameters<typeof LeaderRevivalPromiseGuideButton>[0];
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function choose(props: Parameters<typeof LeaderRevivalClaimFields>[0], value: string) {
  const select = elements(LeaderRevivalClaimFields(props)).find(element => element.props.id === 'truth-leader-revival-leader');
  assert.ok(select);
  (select.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function guide(props: Props) { const button = LeaderRevivalPromiseGuideButton(props); assert.ok(button); return button; }
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(LeaderRevivalPromises, { game, busy: false, send() {} }));

/** Controlled personalized projections test UI guards and exact callbacks.
 * These are not native acquisition, casualty, eligibility or payment evidence. */
function projected(phase = 4, type = 'reviveLeader', advanced = false): GameView {
  const source = createGame('TRUTHLEADERREVIVALCONTROLS', newPlayer('p', 'Respondent', 'emperor'), advanced);
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.ready = [];
  game.allLeaders = [{ id: 'named-leader', name: 'Named Commander', faction: 'emperor', strength: 3 }];
  game.leaderRevivalPromises = [{ event: 'controlled-leader-revival-event', player: 'p', asker: 'a',
    turn: 2, leader: type === 'reviveKwisatz' ? 'kwisatz' : 'named-leader', answer: type !== 'ready' }];
  game.revivalOrder = advanced ? { version: 1, turn: 2, original: ['p', 'a'], remaining: ['p', 'a'], completed: [], started: false } : null;
  game.active = advanced ? 'p' : null;
  game.auction = phase === 3 ? { bid: 4, bidder: type === 'decision' ? 'p' : 'a', active: type === 'decision' ? 'a' : 'p',
    remaining: 2, inspectionBlocked: null, card: null } : null;
  game.decision = type === 'decision' ? { kind: 'auctionPayment', player: 'p' } : null;
  if (type === 'acceptLeaderRevival') game.revivalRequests.p = { leader: 'named-leader', price: 3 };
  game.leaderRevivalPromiseGuide = { phase, action: { type, leaderRevivalPromiseEvent: 'controlled-leader-revival-event',
    ...(type === 'reviveLeader' ? { leader: 'named-leader' } : {}),
    ...(type === 'revive' ? { amount: 1, elite: 0, freeElite: 0 } : {}),
    ...(type === 'acceptLeaderRevival' ? { leaderRevivalPrice: game.revivalRequests.p.price } : {}),
    ...(type === 'decision' ? { karama: true, card: 'projected-original-karama' } : {}) } };
  return game;
}
function nativeProjected(method: 'silent' | 'onceAround') {
  const game = projected(3, 'richeseBid');
  const native = createRicheseAuction({ event: 'controlled-native-auction-event', cardId: 'controlled-card', owner: 'a',
    method, source: 'cache', eligible: ['p', 'a'], order: ['p', 'a'], tieOrder: ['p', 'a'] });
  game.richeseAuction = { ...projectRicheseAuction(native, 'p'), card: null, claim: null,
    ownAllyPayment: 0, ownAvailable: 4, allyAvailable: 0, peekKnown: false, inspectionBlocked: null };
  game.leaderRevivalPromiseGuide = { phase: 3, action: { type: 'richeseBid', event: native.event,
    amount: method === 'silent' ? 0 : null, allyPayment: 0, leaderRevivalPromiseEvent: 'controlled-leader-revival-event' } };
  return game;
}

void test('named-leader fields preserve the fixed turn and emit only parser-valid current name choices', () => {
  const value: LeaderRevivalClaim = { turn: 2, leader: 'named-leader' }, changes: LeaderRevivalClaim[] = [];
  const leaders = [{ id: 'named-leader', name: 'Named Commander' }, { id: 'kwisatz', name: 'Kwisatz Haderach' }];
  const props = { value, leaders, onChange(next: LeaderRevivalClaim) { changes.push(next); } };
  const html = renderToStaticMarkup(createElement(LeaderRevivalClaimFields, props));
  assert.match(html, /Turn 2/); assert.match(html, /Named Commander/); assert.match(html, /Kwisatz Haderach/);
  assert.match(html, /A request alone is not a return/); assert.match(html, /Native revival cycles, costs and turn order still apply/);
  assert.equal(elements(LeaderRevivalClaimFields(props)).filter(element => typeof element.props.onChange === 'function').length, 1);
  choose(props, 'kwisatz'); assert.deepEqual(changes, [{ turn: 2, leader: 'kwisatz' }]);
  for (const value of ['', 'missing', ' named-leader ']) choose(props, value);
  choose({ ...props, disabled: true }, 'kwisatz'); choose({ ...props, leaders: [] }, 'kwisatz');
  choose({ ...props, value: { ...props.value, turn: 0 } }, 'kwisatz'); assert.equal(changes.length, 1);
  for (const value of [null, {}, { turn: 0, leader: 'named-leader' }, { turn: 2, leader: '' }]) assert.ok(leaderRevivalClaimInputError(value));
  assert.ok(leaderRevivalClaimInputError(value, []));
  assert.match(renderToStaticMarkup(createElement(LeaderRevivalClaimFields, { ...props, leaders: [] })), /role="alert"/);
});

void test('own leader promises persist with public names, actual-return meaning, statuses and earlier-phase waiting', () => {
  const game = projected(); game.leaderRevivalPromiseGuide = null;
  game.leaderRevivalPromises.push(
    { event: 'no-event', player: 'p', asker: 'a', turn: 2, leader: 'kwisatz', answer: false },
    { event: 'completed-event', player: 'p', asker: 'a', turn: 1, leader: 'named-leader', answer: true, fulfilled: true },
    { event: 'released-event', player: 'p', asker: 'a', turn: 2, leader: 'missing', answer: true, released: true },
    { event: 'foreign-event', player: 'a', asker: 'p', turn: 2, leader: 'foreign-hidden-leader-id', answer: true },
  );
  const before = structuredClone(game);
  for (let render = 0; render < 2; render++) {
    const html = markup(game);
    assert.match(html, /Your leader Revival promises/); assert.match(html, /Named Commander/); assert.match(html, /Kwisatz Haderach/);
    assert.match(html, /Yes requires the named leader’s future actual ordinary native return/);
    assert.match(html, /No forbids that named ordinary return until your Revival opportunity ends this turn/);
    assert.match(html, /A request alone is not a return/); assert.match(html, /Prior returns, Ghola, foreign leaders and special card returns do not count/);
    assert.match(html, /Original revival cycles, costs, limits and turn order still apply/);
    assert.match(html, /accept an existing, current Tleilaxu quote/); assert.match(html, /does not arrange a new agreement or promise future consent/);
    assert.match(html, /Fulfilled: this commitment is complete/); assert.match(html, /Released: this commitment is no longer possible/);
    assert.match(html, /href="\/rules#truthtrance-leader-revival"/);
    assert.doesNotMatch(html, /foreign-hidden-leader-id|controlled-leader-revival-event|released-event/);
  }
  assert.deepEqual(game, before);
  for (const phase of [0, 1, 2, 3]) {
    game.phase = phase;
    assert.match(markup(game), /Your leader Revival opportunity is still ahead/);
    assert.equal(LeaderRevivalPromiseGuideButton({ game, busy: false, send() {} }), null);
  }
  game.phase = 4; game.revivalOrder = { version: 1, turn: 2, original: ['a', 'p'], remaining: ['a', 'p'], completed: [], started: false };
  assert.match(markup(game), /this promise remains visible while the current actor finishes/);
  assert.equal(LeaderRevivalPromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('actual Basic and ordered Advanced guide callbacks preserve named leader, KH, priced negotiation, joint-force and Ready packets', () => {
  for (const advanced of [false, true]) for (const type of ['reviveLeader', 'reviveKwisatz', 'acceptLeaderRevival', 'revive', 'ready']) {
    const game = projected(4, type, advanced), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.leaderRevivalPromiseGuide!.action]); assert.equal(sent[0], game.leaderRevivalPromiseGuide!.action);
    assert.match(markup(game), type === 'reviveLeader' ? /Revive Named Commander while honoring your answers/
      : type === 'reviveKwisatz' ? /Revive Kwisatz Haderach while honoring your answers/
      : type === 'acceptLeaderRevival' ? /Accept the current quoted leader revival while honoring your answers/
      : type === 'revive' ? /Revive 1 force to prepare your leader Revival/ : /Finish Revival while honoring your named-leader answers/);
    press(guide({ ...props, busy: true })); assert.equal(sent.length, 1);
    if (type === 'acceptLeaderRevival') {
      assert.deepEqual(sent[0], { type: 'acceptLeaderRevival', leaderRevivalPromiseEvent: 'controlled-leader-revival-event', leaderRevivalPrice: 3 });
      game.revivalRequests.p.price = 4; press(button); assert.equal(sent.length, 1);
      game.revivalRequests.p.price = 3; game.revivalRequests.p.declined = true; press(button); assert.equal(sent.length, 1);
      delete game.revivalRequests.p; press(button); assert.equal(sent.length, 1);
    }
  }
});

void test('actual preparation callbacks preserve Charity, owned ordinary payment, and current Richese zero or pass packets', () => {
  for (const [phase, type] of [[2, 'charity'], [2, 'ready'], [3, 'passBid'], [3, 'decision']] as const) {
    const game = projected(phase, type), sent: Action[] = [];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.deepEqual(sent, [game.leaderRevivalPromiseGuide!.action]);
    if (type === 'decision') {
      assert.equal(game.auction!.active, 'a'); assert.equal(sent[0].card, 'projected-original-karama'); assert.equal(sent[0].karama, true);
      assert.match(markup(game), /Use the quoted Karama auction payment for your later leader Revival/);
      assert.doesNotMatch(markup(game), /projected-original-karama/);
      game.decision!.player = 'a'; press(button); assert.equal(sent.length, 1);
    } else if (phase === 2) { game.ready.push('p'); press(button); assert.equal(sent.length, 1); }
    else { game.auction!.active = 'a'; press(button); assert.equal(sent.length, 1); }
  }
  for (const method of ['silent', 'onceAround'] as const) {
    const game = nativeProjected(method), sent: Action[] = [];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.deepEqual(sent, [game.leaderRevivalPromiseGuide!.action]);
    assert.match(markup(game), method === 'silent' ? /Submit zero in this Silent auction/ : /Pass this Richese bid/);
    game.richeseAuction!.event = 'later-event'; press(button); assert.equal(sent.length, 1);
    game.richeseAuction!.event = 'controlled-native-auction-event';
    if (method === 'silent') game.richeseAuction!.submitted.push('p'); else game.richeseAuction!.active = 'a';
    press(button); assert.equal(sent.length, 1);
  }
});

void test('leader guide callbacks reject stale actor, event, guide, order and interrupted windows without changing native actions', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 5; },
    game => { game.status = 'setup'; }, game => { game.ready = ['p']; },
    game => { game.revivalOrder!.remaining = ['a', 'p']; game.active = 'a'; },
    game => { game.revivalOrder!.turn = 1; }, game => { game.active = null; },
    game => { game.revivalOrder = null; }, game => { game.revivalOrder = { ...game.revivalOrder!, remaining: ['p', 'a'] }; },
    game => { game.leaderRevivalPromiseGuide = { phase: 4, action: { ...game.leaderRevivalPromiseGuide!.action } }; },
    game => { game.leaderRevivalPromiseGuide = null; }, game => { game.leaderRevivalPromiseGuide!.phase = 3; },
    game => { game.leaderRevivalPromiseGuide!.action.leader = 'kwisatz'; },
    game => { game.leaderRevivalPromises[0].event = 'expired'; }, game => { game.leaderRevivalPromises[0].player = 'a'; },
    game => { game.leaderRevivalPromises[0].turn = 1; }, game => { game.leaderRevivalPromises[0].fulfilled = true; },
    game => { game.leaderRevivalPromises[0].released = true; }, game => { game.leaderRevivalPromises = []; },
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
    const game = projected(4, 'reviveLeader', true), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = guide(props); change(game); press(button); assert.deepEqual(sent, []);
  }
  const props = { game: projected(), busy: false, send() { assert.fail('A now-busy leader guide cannot dispatch'); } };
  const button = guide(props); props.busy = true; press(button);
  for (const [phase, type] of [[0, 'ready'], [1, 'ready'], [2, 'reviveLeader'], [3, 'reviveLeader'], [4, 'charity']] as const) {
    const game = projected(phase, type), sent: Action[] = [];
    press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.deepEqual(sent, []);
  }
});

void test('named-leader guidance uses only public names and the projected guide without private eligibility inspection', () => {
  for (const type of ['reviveLeader', 'reviveKwisatz', 'decision']) {
    const game = projected(type === 'decision' ? 3 : 4, type), sent: Action[] = [];
    for (const seat of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'leaders', 'kwisatz', 'spice', 'reserves', 'tanks', 'elites'])
      Object.defineProperty(seat, key, { get() { throw Error(`No private or unneeded ${key} inspection`); }, configurable: true });
    if (game.auction) Object.defineProperty(game.auction, 'card', { get() { throw Error('No unrevealed lot inspection'); } });
    for (const key of ['spiceDeck', 'deck', 'discard', 'revival']) Object.defineProperty(game, key, {
      get() { throw Error(`No private eligibility or ${key} inspection`); }, configurable: true,
    });
    assert.match(markup(game), /Your leader Revival promises/);
    press(guide({ game, busy: false, send(action) { sent.push(action); } }));
    assert.deepEqual(sent, [game.leaderRevivalPromiseGuide!.action]);
  }
});
