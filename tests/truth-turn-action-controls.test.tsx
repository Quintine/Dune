import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TurnActionFields, turnActionInputError } from '../components/turn-action-fields';
import { TurnActionAnswers, TurnActionGuideButton, TurnActionPromises } from '../components/turn-action-promises';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import { createRevivalOrder } from '../game/revival-order';
import { createRicheseAuction, projectRicheseAuction } from '../game/richese-auction';
import type { TurnActionLeaf } from '../game/turn-action-promises';
import type { TruthFact } from '../game/truthtrance';

type Expression = MixedActionExpression<TurnActionLeaf>;
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
type Props = Parameters<typeof TurnActionGuideButton>[0];
const event = 'controlled-turn-action';
const fact = (value: TruthFact = { kind: 'hand', name: 'Shield' }): Expression => ({ kind: 'fact', fact: value });
const physical = (kind: 'ship' | 'move' = 'ship', minimum = 1, territory = 'carthag'): Expression =>
  ({ kind: 'action', action: { kind, territory, minimum } });
const payment = (minimum = 3, recipient = 'r'): Expression => ({ kind: 'action', action: { kind: 'payment', recipient, minimum } });
const claim = (): Expression => ({ kind: 'or', terms: [payment(), { kind: 'and', terms: [fact(), physical('ship', 3), physical('move', 4, 'arrakeen')] }] });

function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value);
  assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-turn-action-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  (find(tree, 'id', `truth-turn-action-${path}-${field}`).props.onChange as
    (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function minimum(tree: ReactNode, path: string, valueAsNumber: number) {
  (find(tree, 'id', `truth-turn-action-${path}-minimum`).props.onChange as
    (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber } });
}
function editFact(tree: ReactNode, path: string, value: TruthFact) {
  const scope = find(tree, 'data-turn-action-fact-path', path);
  const fields = elements(scope).find(element => element.type === TruthFactFields); assert.ok(fields);
  (fields.props.onChange as (next: TruthFact) => void)(value);
}

/** Controlled projections verify current UI ownership and exact dispatch only;
 * they do not establish native answer feasibility, payment or force receipts. */
function projected(phase = 5, next: Action = { type: 'move', forces: { 'arrakeen:10': 3, 'arrakeen:11': 1 },
  eliteForces: { 'arrakeen:10': 1 }, territory: 'carthag', sector: 11 }): GameView {
  const source = createGame('TURNACTIONCONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  joinGame(source, newPlayer('r', 'Recipient', 'harkonnen'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.active = 'p'; game.ready = [];
  game.bribeOptions = { available: 8, incoming: 0, blocked: null,
    targets: [{ id: 'r', maximum: 6, limitation: null }, { id: 'a', maximum: 8, limitation: null }] };
  game.turnActionPromises = [{ event, player: 'p', asker: 'a', turn: 2, mixed: claim(), answer: true, fulfilled: false, released: false }];
  game.turnActionGuide = { event, action: { ...next, turnActionPromiseEvent: event, turnActionPromisePhase: phase } };
  game.truthTurnActionAnswers = null;
  return game;
}
function auction(next: Action = { type: 'passBid' }): GameView {
  const game = projected(3, next);
  game.auction = { bid: 7, bidder: next.type === 'decision' ? 'p' : 'a', active: 'p', remaining: 2, inspectionBlocked: null, card: null };
  if (next.type === 'decision') { game.auction.active = 'a'; game.decision = { kind: 'auctionPayment', player: 'p' }; }
  return game;
}
function revival(next: Action = { type: 'revive', amount: 3, elite: 1 }): GameView {
  const game = projected(4, next);
  game.revivalOrder = createRevivalOrder({ turn: 2, order: ['p', 'a', 'r'], ready: [] });
  return game;
}
function richese(method: 'silent' | 'onceAround'): GameView {
  const native = createRicheseAuction({ event: 'controlled-native-lot', cardId: 'controlled-native-card', owner: 'a', source: 'cache',
    method, eligible: ['p', 'a', 'r'], order: ['p', 'a', 'r'], tieOrder: ['p', 'a', 'r'] });
  const game = projected(3, { type: 'richeseBid', event: native.event, amount: method === 'silent' ? 0 : null, allyPayment: 0 });
  game.richeseAuction = { ...projectRicheseAuction(native, 'p'), card: null, claim: null,
    ownAllyPayment: 0, ownAvailable: 4, allyAvailable: 0, peekKnown: false, inspectionBlocked: null };
  return game;
}
function editor(initial: Expression, disabled = false, game = projected()) {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => TurnActionFields({ value, game, target: 'p', disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(TurnActionFields, { value, game, target: 'p', disabled, onChange() {} })),
    error: () => turnActionInputError(value, game, 'p'),
  };
}
function guide(props: Props) { const button = TurnActionGuideButton(props); assert.ok(button); return button; }
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(TurnActionPromises, { game, busy: false, act() {} }));
function answering(phase = 5): GameView {
  const game = projected(phase); game.turnActionGuide = null;
  game.truthtrance = { stage: 'answer', queue: [{ player: 'a', card: 'controlled-truth-card' }], passed: [],
    question: { kind: 'turnActions', target: 'p', turn: 2, mixed: claim() } };
  game.truthTurnActionAnswers = ['yes', 'no', 'unknown'];
  return game;
}

void test('turn-action editor keeps all action families and optional facts in the original whole expression', () => {
  const e = editor(physical('ship', 3)); assert.equal(e.error(), null);
  select(e.tree(), '1', 'action', 'move'); select(e.tree(), '1', 'territory', 'arrakeen'); minimum(e.tree(), '1', 5);
  assert.deepEqual(e.value, physical('move', 5, 'arrakeen'));
  select(e.tree(), '1', 'action', 'payment'); assert.ok(e.error()); select(e.tree(), '1', 'recipient', 'r');
  assert.deepEqual(e.value, payment(5));
  click(control(e.tree(), 'or-1')); select(e.tree(), '1.2', 'timing', 'action');
  select(e.tree(), '1.2', 'action', 'move'); minimum(e.tree(), '1.2', 4);
  assert.deepEqual(e.value, { kind: 'or', terms: [payment(5), physical('move', 4)] }); assert.equal(e.error(), null);
  const html = e.html();
  for (const text of [/Make an ordinary payment/, /Ship from reserves/, /Make ground movement/, /sum future real bribes/,
    /single future original reserve shipment/, /smaller moves never add together/, /No makes the whole expression false/,
    /payment conditions last until the actual turn ends/]) assert.match(html, text);
  click(control(e.tree(), 'remove-1.1')); assert.deepEqual(e.value, physical('move', 4));
  select(e.tree(), '1', 'timing', 'fact'); assert.ok(e.error(), 'The expression still requires a future action.');
});

void test('turn-action editor preserves sixteen clauses and four shared grouping levels without truncation', () => {
  const e = editor({ kind: 'or', terms: [payment(), physical('move', 4)] });
  for (let count = 3; count <= 16; count++) { click(control(e.tree(), 'add-action-1')); minimum(e.tree(), `1.${count}`, count); }
  assert.equal(e.error(), null); assert.match(e.html(), /16 \/ 16 conditions/);
  const full = structuredClone(e.value), changes = e.changes;
  for (const key of ['add-action-1', 'add-fact-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.deepEqual(e.value, full); assert.equal(e.changes, changes);
  const deep = editor({ kind: 'and', terms: [fact(), payment()] });
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  assert.equal(control(deep.tree(), 'and-1.2.1.1.1').props.disabled, true);
  editFact(deep.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 3 }); assert.equal(deep.error(), null);
  click(control(deep.tree(), 'remove-1.2.1.1.2')); assert.match(deep.html(), /3 \/ 4 levels of grouping/);
});

void test('turn-action inputs keep invalid drafts repairable and reject disabled callbacks', () => {
  for (const expression of [physical(), payment()]) {
    for (const invalid of [NaN, 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const e = editor(expression); minimum(e.tree(), '1', invalid); assert.ok(e.error());
      if (!Number.isFinite(invalid)) assert.match(e.html(), /value=""/);
      minimum(e.tree(), '1', 20); assert.equal(e.error(), null);
    }
  }
  const e = editor(physical()); minimum(e.tree(), '1', 21); assert.ok(e.error());
  select(e.tree(), '1', 'action', 'payment'); select(e.tree(), '1', 'recipient', 'r'); assert.equal(e.error(), null);
  minimum(e.tree(), '1', Number.MAX_SAFE_INTEGER); assert.equal(e.error(), null);
  select(e.tree(), '1', 'action', 'ship'); assert.ok(e.error()); minimum(e.tree(), '1', 1);
  select(e.tree(), '1', 'territory', 'invented-place'); assert.ok(e.error()); assert.match(e.html(), /aria-invalid="true"/);
  const frozen = editor(claim(), true), original = structuredClone(frozen.value);
  select(frozen.tree(), '1', 'meaning', 'and'); minimum(frozen.tree(), '1.1', 7);
  select(frozen.tree(), '1.1', 'action', 'move'); select(frozen.tree(), '1.1', 'recipient', 'a');
  editFact(frozen.tree(), '1.2.1', { kind: 'spice', compare: 'gte', value: 9 });
  for (const key of ['and-1', 'add-action-1', 'remove-1.1', 'nested-or-1']) click(control(frozen.tree(), key));
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, original);
});

void test('turn-action fields use public recipients and printed destinations without private eligibility reads', () => {
  const game = projected(); game.players.find(player => player.id === 'p')!.ally = 'a';
  for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves'])
    Object.defineProperty(player, key, { get() { throw Error(`No ${key} inspection`); }, configurable: true });
  for (const expression of [payment(), physical('ship', 20, 'arrakeen'), { kind: 'and', terms: [fact({ kind: 'stormForecast', compare: 'gte', value: 3 }), physical('move')] } as Expression]) {
    const e = editor(expression, false, game); assert.equal(e.error(), null);
    assert.match(e.html(), /Only the aggregate answer is shared/);
  }
  const e = editor(payment(), false, game); const choices = find(e.tree(), 'id', 'truth-turn-action-1-recipient');
  assert.deepEqual(elements(choices).filter(element => element.type === 'option').map(element => element.props.value), ['', 'r']);
  select(e.tree(), '1', 'recipient', 'a'); assert.deepEqual(e.value, payment());
  for (const recipient of ['p', 'a', 'missing']) assert.ok(turnActionInputError(payment(3, recipient), game, 'p'));
  assert.match(editor(physical(), false, game).html(), /Carthag/);
});

void test('turn-action history retains original own whole questions and terminal status without private compiled branches', () => {
  const game = projected(); game.turnActionGuide = null;
  game.turnActionPromises.push(
    { ...game.turnActionPromises[0], event: 'controlled-no', answer: false },
    { ...game.turnActionPromises[0], event: 'controlled-complete', turn: 1, fulfilled: true },
    { ...game.turnActionPromises[0], event: 'controlled-release', released: true },
    { ...game.turnActionPromises[0], event: 'controlled-foreign', player: 'a', mixed: { kind: 'and', terms: [fact({ kind: 'hand', name: 'Poison Blade' }), physical('ship', 19, 'sietch_tabr')] } },
  );
  for (const promise of game.turnActionPromises) for (const key of ['compiled', 'binding', 'factAnswers', 'residual', 'route', 'payments', 'progress'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  for (const text of [/Turn 1/, /You answered Yes/, /You answered No/, /you hold Shield/, / OR /, / AND /,
    /Fulfilled: this whole commitment is complete/, /Released: this whole commitment is no longer possible/,
    /No negates the whole expression, not each condition separately/, /Separate No answers each create their own restriction/,
    /maximum physical forces in one actual future move/, /Individual fact answers and any reduced future branch remain private/,
    /ordinary payments remain possible until the actual turn ends/]) assert.match(html, text);
  assert.doesNotMatch(html, /Poison Blade|19 physical|controlled-foreign|controlled-complete|factAnswers/);
  assert.equal(TurnActionPromises({ game: { ...game, me: 'missing' }, busy: false, act() {} }), null);
  game.turnActionPromises = game.turnActionPromises.filter(promise => promise.fulfilled || promise.released);
  assert.doesNotMatch(markup(game), /<button|Your Movement turn is still ahead/);
});

void test('turn-action guide forwards exact shipment, movement, preparation and own movement-end packets', () => {
  const actions: Action[] = [
    projected().turnActionGuide!.action,
    { type: 'ship', territory: 'arrakeen', sector: 10, amount: 4, elite: 1, allyPayment: 0 },
    { type: 'guildShip', from: 'reserves', territory: 'carthag', sector: 11, amount: 6, elite: 0, allyPayment: 3 },
    { type: 'move', territory: 'carthag', sector: 11, forces: { 'arrakeen:10': 4 }, eliteForces: {},
      movementCard: 'controlled-ornithopter', ornithopter: 'twoGroups', ornithopterEvent: 'controlled-flight' },
    { type: 'card', card: 'controlled-hajr' }, { type: 'prepareAdvisors', territory: 'arrakeen' },
    { type: 'revealNoField', territory: 'arrakeen', sector: 10 }, { type: 'endMovement' },
  ];
  for (const action of actions) {
    const game = projected(5, action), sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.turnActionGuide!.action]); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.match(markup(game), /data-testid="turn-action-promise-guide"/);
  }
  const game = projected(5, { type: 'endMovement' });
  game.turnActionPromises[0].mixed = { kind: 'and', terms: [physical('move', 4), payment()] };
  assert.match(markup(game), /Finish movement while preserving any later payment conditions/);
  game.active = 'a'; game.turnActionGuide = { event, action: { type: 'bribe', target: 'r', amount: 3,
    turnActionPromiseEvent: event, turnActionPromisePhase: 5 } };
  assert.doesNotMatch(markup(game), /Your Movement turn is still ahead/);
  const sent: Action[] = []; press(guide({ game, busy: false, act(value) { sent.push(value); } }));
  assert.equal(sent[0], game.turnActionGuide.action);
});

void test('turn-action ordinary-payment guide retains native out-of-turn timing and quiet Mentat readiness', () => {
  for (let phase = 0; phase <= 8; phase++) {
    const game = projected(phase, { type: 'bribe', target: 'r', amount: 3 }); game.active = 'a'; game.ready = ['p'];
    const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.match(markup(game), /Pay 3 spice to Recipient while honoring your whole answer/);
    if (phase === 8) assert.match(markup(game), /Late recipients collect next turn/);
  }
  const game = projected(8, { type: 'ready' }); game.active = null;
  const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
  assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
  assert.match(markup(game), /Ready to end this turn while honoring your whole answer/);
  game.ready.push('p'); press(button); assert.equal(sent.length, 1);
  for (const phase of [1, 7]) {
    const current = projected(phase, { type: 'ready' }); current.nexus = true; current.spiceWindow = null;
    const dispatched: Action[] = [], ready = guide({ game: current, busy: false, act(value) { dispatched.push(value); } });
    assert.equal(ready.props.disabled, false); press(ready); assert.equal(dispatched[0], current.turnActionGuide!.action);
    if (phase === 1) { current.nexus = false; press(ready); assert.equal(dispatched.length, 1); }
  }
  for (const change of [
    (current: GameView) => { current.bribeOptions.blocked = 'Complete the current decision.'; },
    (current: GameView) => { current.bribeOptions.blocked = ''; },
    (current: GameView) => { current.bribeOptions.available = 2; },
    (current: GameView) => { current.bribeOptions.available = NaN; },
    (current: GameView) => { current.bribeOptions.targets[0].maximum = 2; },
    (current: GameView) => { current.bribeOptions.targets = []; },
    (current: GameView) => { current.players.find(player => player.id === 'p')!.ally = 'r'; },
    (current: GameView) => { current.players = current.players.filter(player => player.id !== 'r'); },
  ]) {
    const current = projected(3, { type: 'bribe', target: 'r', amount: 3 }), dispatched: Action[] = [];
    const original = guide({ game: current, busy: false, act(value) { dispatched.push(value); } }); change(current); press(original);
    assert.deepEqual(dispatched, []);
  }
});

void test('turn-action current early native opportunities retain exact preparation, bids and owned cash or Karama invoices', () => {
  const cases: GameView[] = [
    projected(2, { type: 'charity' }), projected(2, { type: 'ready' }), projected(2, { type: 'card', card: 'controlled-preparation', amount: 3 }),
    auction({ type: 'bid', amount: 8, allyPayment: 0 }), auction(),
    auction({ type: 'decision', karama: false }), auction({ type: 'decision', karama: true, card: 'controlled-owned-karama' }),
    revival(), revival({ type: 'ready' }), revival({ type: 'reviveLeader', leader: 'controlled-leader', early: true, allyPayment: 2 }),
    revival({ type: 'acceptLeaderRevival', leaderRevivalPrice: 3 }), revival({ type: 'reviveKwisatz' }),
    revival({ type: 'card', card: 'controlled-ghola' }), richese('silent'), richese('onceAround'),
  ];
  for (const game of cases) {
    const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
  }
  assert.match(markup(auction({ type: 'bid', amount: 8, allyPayment: 0 })), /Place the required bid of 8/);
  assert.match(markup(auction({ type: 'decision', karama: true, card: 'controlled-owned-karama' })), /Use the quoted Karama for the current auction payment/);
});

void test('turn-action current paid Box choices are exact through phases zero to eight without private custody reads', () => {
  for (let phase = 0; phase <= 8; phase++) {
    const game = projected(phase, { type: 'decision', event: 'controlled-paid-search', card: 'controlled-recovered-hajr' });
    game.decision = { kind: 'nullentropy', player: 'p' };
    game.nullentropy = { card: { id: 'controlled-box', name: 'Nullentropy Box', kind: 'special', effect: 'nullentropyBox' }, blocked: null,
      search: { event: 'controlled-paid-search', cards: [{ id: 'controlled-recovered-hajr', name: 'Hajr', kind: 'special', effect: 'hajr' }] } };
    for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves'])
      Object.defineProperty(player, key, { get() { throw Error(`No ${key} inspection`); }, configurable: true });
    const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.match(markup(game), /Complete your paid Box search/);
    game.nullentropy.search = { ...game.nullentropy.search! }; press(button); assert.equal(sent.length, 1);
  }
});

void test('turn-action native guides reject stale auction, invoice, Revival and hidden Richese source changes', () => {
  const cases: [() => GameView, ((game: GameView) => void)[]][] = [
    [() => auction({ type: 'bid', amount: 8, allyPayment: 0 }), [
      game => { game.auction = { ...game.auction! }; }, game => { game.auction!.active = 'a'; },
      game => { game.auction!.bid = 8; }, game => { game.auction!.remaining = 1; },
    ]],
    [() => auction({ type: 'decision', karama: false }), [
      game => { game.decision = { ...game.decision! }; }, game => { game.decision = null; },
      game => { game.decision = { kind: 'auctionPayment', player: 'a' }; },
      game => { game.auction!.bidder = 'a'; }, game => { game.auction!.bid = 8; }, game => { game.auction!.allyPayment = 1; },
    ]],
    [() => revival(), [
      game => { game.revivalOrder = { ...game.revivalOrder! }; }, game => { game.revivalOrder!.turn = 3; },
      game => { game.revivalOrder!.remaining = ['a', 'p']; }, game => { game.active = 'a'; },
      game => { game.revival = { ...game.revival }; }, game => { game.revival.orderBlocked = 'Wait for your turn.'; },
      game => { game.revival.pending = true; }, game => { game.ready.push('p'); },
    ]],
    [() => richese('silent'), [
      game => { game.richeseAuction = { ...game.richeseAuction! }; }, game => { game.richeseAuction!.event = 'another-lot'; },
      game => { game.richeseAuction!.eligible = ['a']; }, game => { game.richeseAuction!.submitted.push('p'); },
      game => { game.richeseAuction!.outcome = { kind: 'unbid' }; },
    ]],
  ];
  for (const [build, changes] of cases) for (const change of changes) {
    const game = build(), sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); change(game); press(button); assert.deepEqual(sent, []);
  }
  for (const method of ['silent', 'onceAround'] as const) {
    const game = richese(method);
    Object.defineProperty(game.richeseAuction!, 'sealed', { get() { throw Error('No hidden bids'); } });
    Object.defineProperty(game.richeseAuction!, 'card', { get() { throw Error('No hidden lot'); } });
    const sent: Action[] = []; press(guide({ game, busy: false, act(value) { sent.push(value); } })); assert.equal(sent.length, 1);
  }
});

void test('turn-action guide rejects stale event, packet identity, current phase, owner and quiet-window changes', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 4; }, game => { game.status = 'setup'; },
    game => { game.active = 'a'; }, game => { game.turnActionGuide = null; },
    game => { game.turnActionGuide = { ...game.turnActionGuide! }; },
    game => { game.turnActionGuide!.action = { ...game.turnActionGuide!.action }; },
    game => { game.turnActionGuide!.event = 'changed'; }, game => { game.turnActionGuide!.action.turnActionPromiseEvent = 'changed'; },
    game => { game.turnActionGuide!.action.turnActionPromisePhase = 4; }, game => { delete game.turnActionGuide!.action.turnActionPromisePhase; },
    game => { (game.turnActionGuide!.action.forces as Record<string, number>)['arrakeen:10'] = 2; },
    game => { (game.turnActionGuide!.action.eliteForces as Record<string, number>)['arrakeen:10'] = 0; },
    game => { game.turnActionPromises[0].event = 'expired'; }, game => { game.turnActionPromises[0].player = 'a'; },
    game => { game.turnActionPromises[0].turn = 1; }, game => { game.turnActionPromises[0].fulfilled = true; },
    game => { game.turnActionPromises[0].released = true; }, game => { game.turnActionPromises = []; },
    game => { game.phaseOpening = { passed: [] }; }, game => { game.automaticContinuationPending = true; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; }, game => { game.truthtrance = answering().truthtrance; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
  ];
  for (const change of changes) {
    const game = projected(), sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    change(game); press(button); assert.deepEqual(sent, []);
  }
  const busy = { game: projected(), busy: false, act() { assert.fail('Busy guide cannot send'); } };
  const busyButton = guide(busy); busy.busy = true; press(busyButton);
  const replaced = { game: projected(), busy: false, act() { assert.fail('Replaced view cannot send'); } };
  const old = guide(replaced); replaced.game = { ...replaced.game }; press(old);
});

void test('turn-action guides reject wrong native opportunities even when a packet is projected', () => {
  const invalid: GameView[] = [];
  for (const phase of [0, 1, 2, 3, 4, 6, 7, 8]) for (const action of [
    { type: 'ship', amount: 3, territory: 'carthag', sector: 11 }, { type: 'move', forces: { 'arrakeen:10': 4 }, territory: 'carthag', sector: 11 },
    { type: 'endMovement' },
  ] satisfies Action[]) invalid.push(projected(phase, action));
  invalid.push(projected(0, { type: 'ready' }), projected(1, { type: 'ready' }), projected(6, { type: 'ready' }), projected(4, { type: 'charity' }),
    projected(2, { type: 'revive', amount: 3 }), projected(3, { type: 'decision', karama: false }), auction({ type: 'decision', karama: true }),
    projected(5, { type: 'guildShip', from: 'arrakeen', territory: 'carthag', amount: 3 }));
  for (const game of invalid) {
    const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, true); press(button); assert.deepEqual(sent, []);
  }
});

void test('turn-action answers offer only the current respondent native choices throughout phases zero through eight', () => {
  for (let phase = 0; phase <= 8; phase++) {
    const game = answering(phase), sent: Action[] = [], props = { game, busy: false, act(value: Action) { sent.push(value); } };
    for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves'])
      Object.defineProperty(player, key, { get() { throw Error(`No ${key} inspection`); }, configurable: true });
    for (const answer of game.truthTurnActionAnswers!) click(find(TurnActionAnswers(props), 'data-turn-action-answer', answer));
    assert.deepEqual(sent, ['yes', 'no', 'unknown'].map(answer => ({ type: 'truthAnswer', answer })));
    game.truthTurnActionAnswers = ['no'];
    const html = renderToStaticMarkup(createElement(TurnActionAnswers, { game, busy: false, act() {} }));
    assert.match(html, /Answer No/); assert.doesNotMatch(html, /Answer Yes|I don’t know yet/);
    assert.equal(TurnActionAnswers({ game: { ...game, me: 'a' }, busy: false, act() {} }), null);
    assert.equal(TurnActionAnswers({ game: { ...game, truthTurnActionAnswers: null }, busy: false, act() {} }), null);
  }
});

void test('turn-action answer callbacks reject stale target, source queue, private choices, phase and modal ownership', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 4; }, game => { game.status = 'setup'; },
    game => { game.truthtrance = null; }, game => { game.truthtrance!.stage = 'ask'; },
    game => { game.truthtrance!.question = { ...game.truthtrance!.question! }; }, game => { game.truthtrance!.question!.target = 'a'; },
    game => { game.truthtrance!.queue[0] = { ...game.truthtrance!.queue[0] }; }, game => { game.truthtrance!.queue[0].card = 'another-card'; },
    game => { game.truthTurnActionAnswers = ['yes']; }, game => { game.truthTurnActionAnswers!.splice(0); },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; }, game => { game.phaseOpening = { passed: [] }; },
    game => { game.automaticContinuationPending = true; }, game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
  ];
  for (const change of changes) {
    const game = answering(), sent: Action[] = [], tree = TurnActionAnswers({ game, busy: false, act(value) { sent.push(value); } });
    const button = find(tree, 'data-turn-action-answer', 'yes'); change(game); click(button); assert.deepEqual(sent, []);
  }
  for (const phase of [-1, 9, 1.5]) {
    const game = answering(phase), sent: Action[] = [], button = find(TurnActionAnswers({ game, busy: false, act(value) { sent.push(value); } }), 'data-turn-action-answer', 'yes');
    assert.equal(button.props.disabled, true); click(button); assert.deepEqual(sent, []);
  }
  const busy = { game: answering(), busy: false, act() { assert.fail('Busy answer cannot send'); } };
  const button = find(TurnActionAnswers(busy), 'data-turn-action-answer', 'yes'); busy.busy = true; click(button);
  const replaced = { game: answering(), busy: false, act() { assert.fail('Replaced view cannot send'); } };
  const old = find(TurnActionAnswers(replaced), 'data-turn-action-answer', 'yes'); replaced.game = { ...replaced.game }; click(old);
});
