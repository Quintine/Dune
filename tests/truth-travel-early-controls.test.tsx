import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TravelAnswers, TravelPromiseGuideButton, TravelPromises } from '../components/travel-promises';
import { baseDeck } from '../game/cards';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { createRevivalOrder } from '../game/revival-order';
import { createRicheseAuction, projectRicheseAuction } from '../game/richese-auction';

type Props = Parameters<typeof TravelPromiseGuideButton>[0];
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const event = 'controlled-early-travel';

/** Controlled personalized quotes test current UI ownership and dispatch only.
 * They do not establish native acquisition, answer feasibility or progress. */
function projected(phase: number, next: Action = { type: 'ready' }): GameView {
  const source = createGame('EARLYTRAVELCONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.active = 'a'; game.ready = [];
  game.travelPromises = [{ event, player: 'p', asker: 'a', turn: 2,
    mixed: { kind: 'or', terms: [
      { kind: 'action', action: { kind: 'ship', territory: 'carthag', minimum: 3 } },
      { kind: 'action', action: { kind: 'move', territory: 'arrakeen', minimum: 4 } },
    ] }, answer: true, fulfilled: false, released: false }];
  game.travelPromiseGuide = { event, action: { ...next, travelPromiseEvent: event, travelPromisePhase: phase } };
  game.truthTravelAnswers = null;
  return game;
}
function auction(next: Action = { type: 'passBid' }): GameView {
  const game = projected(3, next);
  game.auction = { bid: 7, bidder: next.type === 'decision' ? 'p' : 'a', active: 'p',
    remaining: 2, inspectionBlocked: null, card: null };
  if (next.type === 'decision') {
    game.auction.active = 'a';
    game.decision = { kind: 'auctionPayment', player: 'p' };
  }
  return game;
}
function revival(next: Action = { type: 'revive', amount: 3, elite: 1 }): GameView {
  const game = projected(4, next);
  game.active = 'p';
  game.revivalOrder = createRevivalOrder({ turn: 2, order: ['p', 'a'], ready: [] });
  return game;
}
function richese(method: 'silent' | 'onceAround'): GameView {
  const native = createRicheseAuction({ event: 'controlled-native-lot', cardId: 'controlled-native-card',
    owner: 'a', source: 'cache', method, eligible: ['p', 'a'], order: ['p', 'a'], tieOrder: ['p', 'a'] });
  const game = projected(3, { type: 'richeseBid', event: native.event, amount: method === 'silent' ? 0 : null, allyPayment: 0 });
  game.richeseAuction = { ...projectRicheseAuction(native, 'p'), card: null, claim: null,
    ownAllyPayment: 0, ownAvailable: 4, allyAvailable: 0, peekKnown: false, inspectionBlocked: null };
  return game;
}
function guide(props: Props) { const button = TravelPromiseGuideButton(props); assert.ok(button); return button; }
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(TravelPromises, { game, busy: false, act() {} }));
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function answer(game: GameView, send: (action: Action) => void) {
  const tree = TravelAnswers({ game, busy: false, act: send });
  const button = elements(tree).find(element => element.props['data-travel-answer'] === 'yes');
  assert.ok(button); return button;
}
const click = (button: Element) => (button.props.onClick as () => void)();
function answering(phase: number): GameView {
  const game = projected(phase); game.travelPromiseGuide = null;
  game.truthtrance = { stage: 'answer', queue: [{ player: 'a', card: 'controlled-truth' }], passed: [],
    question: { kind: 'travel', target: 'p', turn: 2, mixed: game.travelPromises[0].mixed } };
  game.truthTravelAnswers = ['yes', 'no'];
  return game;
}

void test('early travel guide forwards a required native bid and rejects a changed ordinary opportunity', () => {
  const game = auction({ type: 'bid', amount: 8, allyPayment: 0 }), sent: Action[] = [];
  const button = guide({ game, busy: false, act(action) { sent.push(action); } });
  assert.equal(button.props.disabled, false); press(button);
  assert.deepEqual(sent, [game.travelPromiseGuide!.action]);
  assert.match(markup(game), /Place the required bid of 8/);
  game.auction!.active = 'a'; press(button); assert.equal(sent.length, 1);
});

void test('early whole-travel history stays readable before Movement and forwards only current Charity, Ready or card preparation', () => {
  for (const [phase, action, label] of [
    [2, { type: 'charity' }, /Claim Charity for your later shipment and movement/],
    [2, { type: 'ready' }, /Finish this preparation phase while preserving your whole answer/],
    [4, { type: 'ready' }, /Finish this preparation phase while preserving your whole answer/],
    [2, { type: 'card', card: 'controlled-preparation', amount: 3 }, /Use the offered native card preparation/],
    [4, { type: 'card', card: 'controlled-preparation', amount: 3 }, /Use the offered native card preparation/],
  ] satisfies [number, Action, RegExp][]) {
    const game = projected(phase, action), sent: Action[] = [];
    const props = { game, busy: false, act(value: Action) { sent.push(value); } };
    const html = markup(game);
    assert.match(html, /Your Movement turn is still ahead/);
    assert.match(html, /Complete any offered current preparation below before confirming readiness/);
    assert.match(html, label); assert.doesNotMatch(html, />Ship \d|>Move \d/);
    const button = guide(props); assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.travelPromiseGuide!.action]); assert.equal(sent[0], game.travelPromiseGuide!.action);
    props.busy = true; press(button); assert.equal(sent.length, 1);
    props.busy = false; game.ready.push('p'); press(button); assert.equal(sent.length, 1);
  }
  for (const phase of [0, 1]) {
    const game = projected(phase); game.travelPromiseGuide = null;
    assert.match(markup(game), /Your Movement turn is still ahead/); assert.doesNotMatch(markup(game), /<button/);
  }
});

void test('early native ordinary force, leader and Kwisatz revival packets retain the projected current Revival opportunity', () => {
  for (const [action, label] of [
    [{ type: 'revive', amount: 3, elite: 1, allyPayment: 2 }, /Revive 3 forces/],
    [{ type: 'reviveLeader', leader: 'controlled-leader', early: true, allyPayment: 2 }, /Revive the quoted leader/],
    [{ type: 'acceptLeaderRevival', leaderRevivalPrice: 3 }, /Accept the quoted leader revival/],
    [{ type: 'reviveKwisatz' }, /Revive your Kwisatz Haderach/],
  ] satisfies [Action, RegExp][]) {
    const game = revival(action), sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); assert.match(markup(game), label);
    press(button); assert.equal(sent[0], game.travelPromiseGuide!.action);
    assert.deepEqual(sent[0], { ...action, travelPromiseEvent: event, travelPromisePhase: 4 });
  }
});

void test('current normal-auction pass and owned cash or physical Karama invoices preserve their exact native packets', () => {
  const card = baseDeck().find(card => card.effect === 'karama'); assert.ok(card);
  for (const next of [{ type: 'passBid' }, { type: 'decision', karama: false },
    { type: 'decision', karama: true, card: card.id }] satisfies Action[]) {
    const game = auction(next), sent: Action[] = [];
    game.players.find(player => player.id === 'p')!.hand = [card];
    const button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button);
    assert.equal(sent[0], game.travelPromiseGuide!.action);
    assert.match(markup(game), next.type === 'passBid'
      ? /Pass this bid and preserve later shipment and movement/
      : next.karama ? /Use Karama for the current auction payment/ : /Pay the current auction price while preserving your whole answer/);
    if (next.type === 'decision') assert.equal(game.auction!.active, 'a', 'The owned invoice may belong to a different player than the next bid.');
  }
});

void test('an already-paid owned Box search forwards its exact native card choice in phases zero through five', () => {
  for (const phase of [0, 1, 2, 3, 4, 5]) {
    const game = projected(phase, { type: 'decision', event: 'controlled-paid-search', card: 'controlled-recovered-hajr' });
    game.decision = { kind: 'nullentropy', player: 'p' };
    game.nullentropy = { card: { id: 'controlled-box', name: 'Nullentropy Box', kind: 'special', effect: 'nullentropyBox' }, blocked: null,
      search: { event: 'controlled-paid-search', cards: [{ id: 'controlled-recovered-hajr', name: 'Hajr', kind: 'special', effect: 'hajr' }] } };
    const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.travelPromiseGuide!.action);
    assert.match(markup(game), /Complete your paid Box search for your whole answer/);
    game.nullentropy.search = { ...game.nullentropy.search! }; press(button); assert.equal(sent.length, 1);
    const current = guide({ game, busy: false, act(value) { sent.push(value); } });
    game.decision = { kind: 'nullentropy', player: 'a' }; press(current); assert.equal(sent.length, 1);
  }
});

void test('current Richese Silent zero and Once Around pass guides retain their native lot without reading hidden bids', () => {
  for (const method of ['silent', 'onceAround'] as const) {
    const game = richese(method), sent: Action[] = [];
    Object.defineProperty(game.richeseAuction!, 'sealed', { get() { throw Error('No hidden bid access'); } });
    Object.defineProperty(game.richeseAuction!, 'card', { get() { throw Error('No hidden lot face access'); } });
    const button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.travelPromiseGuide!.action);
    assert.match(markup(game), method === 'silent' ? /Submit zero in this Silent auction/ : /Pass this Richese bid/);
    if (method === 'silent') game.richeseAuction!.submitted.push('p'); else game.richeseAuction!.active = 'a';
    press(button); assert.equal(sent.length, 1);
  }
});

void test('early guides refuse stale phase metadata, current source identity and changed native invoice or Revival ownership', () => {
  const cases: [() => GameView, ((game: GameView) => void)[]][] = [
    [() => projected(2), [
      game => { game.phase = 4; }, game => { game.travelPromiseGuide!.action.travelPromisePhase = 4; },
      game => { delete game.travelPromiseGuide!.action.travelPromisePhase; },
      game => { game.travelPromiseGuide = { ...game.travelPromiseGuide! }; },
      game => { game.travelPromiseGuide!.action = { ...game.travelPromiseGuide!.action }; },
      game => { game.travelPromises[0].event = 'another-answer'; }, game => { game.me = 'a'; }, game => { game.turn = 3; },
    ]],
    [() => auction(), [
      game => { game.auction = { ...game.auction! }; }, game => { game.auction!.active = 'a'; },
      game => { game.auction!.bid = 8; }, game => { game.auction!.remaining = 1; },
    ]],
    [() => auction({ type: 'decision', karama: false }), [
      game => { game.decision = { ...game.decision! }; }, game => { game.decision = null; },
      game => { game.decision = { kind: 'auctionPayment', player: 'a' }; },
      game => { game.auction!.bidder = 'a'; }, game => { game.auction!.bid = 8; },
      game => { game.auction!.allyPayment = 1; },
      game => { game.travelPromiseGuide!.action.karama = true; },
    ]],
    [() => richese('silent'), [
      game => { game.richeseAuction = { ...game.richeseAuction! }; }, game => { game.richeseAuction!.event = 'another-lot'; },
      game => { game.richeseAuction!.eligible = ['a']; }, game => { game.richeseAuction!.outcome = { kind: 'unbid' }; },
      game => { game.travelPromiseGuide!.action.amount = 1; }, game => { game.travelPromiseGuide!.action.allyPayment = 1; },
    ]],
    [() => revival(), [
      game => { game.revivalOrder = { ...game.revivalOrder! }; }, game => { game.revivalOrder!.turn = 3; },
      game => { game.revivalOrder!.remaining = ['a', 'p']; }, game => { game.active = 'a'; },
      game => { game.revival = { ...game.revival }; }, game => { game.revival.orderBlocked = 'Wait for your Revival opportunity.'; },
      game => { game.revival.pending = true; }, game => { game.ready.push('p'); },
    ]],
  ];
  for (const [build, changes] of cases) for (const change of changes) {
    const game = build(), sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); change(game); press(button); assert.deepEqual(sent, []);
  }
  const props = { game: projected(2), busy: false, act() { assert.fail('A replaced view cannot dispatch'); } };
  const button = guide(props); props.game = { ...props.game }; press(button);
  const retained = projected(2); retained.phase = 4;
  const refreshed = guide({ game: retained, busy: false, act() { assert.fail('An old Charity Ready packet cannot become a Revival Ready packet'); } });
  assert.equal(refreshed.props.disabled, true); press(refreshed);
});

void test('early whole-travel guides refuse foreign or absent invoices, foreign Revival turns, wrong phases and intervening modals', () => {
  const invalid: GameView[] = [];
  for (const phase of [0, 1, 2, 3, 4, 6]) {
    for (const next of [{ type: 'ship', amount: 3, territory: 'carthag', sector: 11 },
      { type: 'move', forces: { 'arrakeen:10': 4 }, territory: 'carthag', sector: 11 }, { type: 'endMovement' }] satisfies Action[])
      invalid.push(projected(phase, next));
  }
  for (const phase of [0, 1, 3]) invalid.push(projected(phase, { type: 'ready' }));
  invalid.push(projected(2, { type: 'revive', amount: 3 }), projected(4, { type: 'charity' }),
    projected(3, { type: 'decision', karama: false }), auction({ type: 'decision', karama: true }));
  const foreignInvoice = auction({ type: 'decision', karama: false }); foreignInvoice.decision = { kind: 'auctionPayment', player: 'a' };
  const foreignRevival = revival(); foreignRevival.revivalOrder!.remaining = ['a', 'p']; foreignRevival.active = 'a';
  const blockedRevival = revival({ type: 'ready' }); blockedRevival.revival.orderBlocked = 'Wait for your Revival opportunity.';
  invalid.push(foreignInvoice, foreignRevival, blockedRevival);
  for (const game of invalid) {
    const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, true); press(button); assert.deepEqual(sent, []);
  }
  for (const change of [
    (game: GameView) => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    (game: GameView) => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    (game: GameView) => { game.truthtrance = answering(2).truthtrance; },
    (game: GameView) => { game.phaseOpening = { passed: [] }; },
    (game: GameView) => { game.automaticContinuationPending = true; },
    (game: GameView) => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
  ]) {
    const game = projected(2), sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    change(game); press(button); assert.deepEqual(sent, []);
  }
});

void test('whole travel answers accept only the exact current phase-zero-through-five answer window without opening private eligibility', () => {
  for (const phase of [0, 1, 2, 3, 4, 5]) {
    const game = answering(phase), sent: Action[] = [];
    for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves'])
      Object.defineProperty(player, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
    const button = answer(game, value => sent.push(value)); assert.equal(button.props.disabled, false); click(button);
    assert.deepEqual(sent, [{ type: 'truthAnswer', answer: 'yes' }]);
    game.phase = phase === 5 ? 4 : phase + 1; click(button); assert.equal(sent.length, 1);
  }
  for (const phase of [-1, 6, 1.5]) {
    const game = answering(phase), sent: Action[] = [], button = answer(game, value => sent.push(value));
    assert.equal(button.props.disabled, true); click(button); assert.deepEqual(sent, []);
  }
});

void test('early answer callbacks retain target, source, phase and modal ownership after rendering', () => {
  for (const change of [
    (game: GameView) => { game.truthtrance!.queue[0] = { ...game.truthtrance!.queue[0] }; },
    (game: GameView) => { game.truthtrance!.queue[0].card = 'another-truth'; },
    (game: GameView) => { game.truthtrance!.question!.target = 'a'; },
    (game: GameView) => { game.truthtrance!.question = { ...game.truthtrance!.question! }; },
    (game: GameView) => { game.truthTravelAnswers = ['yes']; },
    (game: GameView) => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    (game: GameView) => { game.phaseOpening = { passed: [] }; },
    (game: GameView) => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
  ]) {
    const game = answering(2), sent: Action[] = [], button = answer(game, value => sent.push(value));
    change(game); click(button); assert.deepEqual(sent, []);
  }
});
