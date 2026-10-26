import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MixedRevivalFields, mixedRevivalInputError } from '../components/mixed-revival-fields';
import { MixedRevivalPromises } from '../components/mixed-revival-promises';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { RevivalExpressionPromiseGuideButton, RevivalExpressionPromises } from '../components/revival-expression-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { RevivalActionClaim } from '../game/mixed-revival-question';
import { createRicheseAuction, projectRicheseAuction } from '../game/richese-auction';
import { createTechTokens } from '../game/tech-tokens';
import type { TruthFact } from '../game/truthtrance';

type Expression = MixedActionExpression<RevivalActionClaim>;
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const fact = (value: TruthFact = { kind: 'hand', name: 'Shield' }): Expression => ({ kind: 'fact', fact: value });
const force = (minimum = 1, counter: 'total' | 'normal' | 'elite' = 'total'): Expression =>
  ({ kind: 'action', action: { kind: 'forces', counter, minimum } });
const named = (leader = 'named-leader'): Expression => ({ kind: 'action', action: { kind: 'leader', leader } });
const claim = (): Expression => ({ kind: 'or', terms: [fact(), { kind: 'and', terms: [force(3), named()] }] });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value);
  assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-mixed-revival-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-mixed-revival-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function minimum(tree: ReactNode, path: string, valueAsNumber: number) {
  const input = find(tree, 'id', `truth-mixed-revival-${path}-minimum`);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber } });
}
function editFact(tree: ReactNode, path: string, next: TruthFact) {
  const scope = find(tree, 'data-mixed-revival-fact-path', path);
  const fields = elements(scope).find(element => element.type === TruthFactFields);
  assert.ok(fields, `Current fact fields ${path}`);
  (fields.props.onChange as (fact: TruthFact) => void)(next);
}

/** Controlled projections prove field and exact callback contracts. Earned
 * cards, actual casualties, quotes and native returns have separate proof. */
function projected(phase = 4, type = 'revive', advanced = false): GameView {
  const source = createGame('TRUTHMIXEDREVIVALCONTROLS', newPlayer('p', 'Respondent', 'emperor'), advanced);
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = phase; game.ready = [];
  game.allLeaders = [
    { id: 'named-leader', name: 'Named Commander', faction: 'emperor', strength: 3 },
    { id: 'second-leader', name: 'Second Commander', faction: 'emperor', strength: 4 },
    { id: 'foreign-leader', name: 'Foreign Commander', faction: 'atreides', strength: 5 },
  ];
  game.revivalExpressionPromises = [];
  game.mixedRevivalPromises = [{ event: 'controlled-mixed-revival-event', player: 'p', asker: 'a', turn: 2,
    mixed: claim(), answer: type !== 'ready', progress: { total: 2, normal: 1, elite: 1, leaders: ['named-leader'] },
    fulfilled: false, released: false }];
  game.revivalOrder = advanced ? { version: 1, turn: 2, original: ['p', 'a'], remaining: ['p', 'a'], completed: [], started: false } : null;
  game.active = advanced ? 'p' : null;
  game.auction = phase === 3 ? { bid: 4, bidder: type === 'decision' ? 'p' : 'a', active: type === 'decision' ? 'a' : 'p',
    remaining: 2, inspectionBlocked: null, card: null } : null;
  game.decision = type === 'decision' ? { kind: 'auctionPayment', player: 'p' } : null;
  if (type === 'acceptLeaderRevival') game.revivalRequests.p = { leader: 'named-leader', price: 3 };
  game.revivalExpressionPromiseGuide = { phase, action: { type, revivalExpressionPromiseEvent: 'controlled-mixed-revival-event',
    ...(type === 'revive' ? { amount: 2, elite: 1, freeElite: 0 } : {}),
    ...(type === 'reviveLeader' ? { leader: 'named-leader' } : {}),
    ...(type === 'acceptLeaderRevival' ? { leaderRevivalPrice: 3 } : {}),
    ...(type === 'decision' ? { karama: true, card: 'controlled-original-karama' } : {}) } };
  return game;
}
function editor(initial: Expression, disabled = false, game = projected(), target = 'p') {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => MixedRevivalFields({ value, game, target, disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(MixedRevivalFields, { value, game, target, disabled, onChange() {} })),
    error: () => mixedRevivalInputError(value, game, target),
  };
}
function guide(props: Parameters<typeof RevivalExpressionPromiseGuideButton>[0]) {
  const button = RevivalExpressionPromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(MixedRevivalPromises, { game, busy: false, send() {} }));
const pureMarkup = (game: GameView) => renderToStaticMarkup(createElement(RevivalExpressionPromises, { game, busy: false, send() {} }));

void test('shared mixed editor keeps sixteen original conditions, typed force counters and unique per-leaf IDs without overflow', () => {
  const e = editor(fact()); click(control(e.tree(), 'or-1'));
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-action-1')); minimum(e.tree(), `1.${count}`, count);
    if (count % 3 === 0) select(e.tree(), `1.${count}`, 'counter', 'elite');
  }
  select(e.tree(), '1.2', 'kind', 'leader'); select(e.tree(), '1.2', 'leader', 'second-leader');
  const full = e.value; assert.ok(full.kind === 'or'); assert.equal(full.terms.length, 16);
  assert.deepEqual(full.terms[0], fact()); assert.deepEqual(full.terms[1], named('second-leader'));
  assert.deepEqual(full.terms[2], force(3, 'elite')); assert.equal(e.error(), null);
  const html = e.html(), ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.match(html, /16 \/ 16 conditions/); assert.equal((html.match(/Revival condition type/g) ?? []).length, 15);
  assert.equal(new Set(ids).size, ids.length);
  const before = structuredClone(full), changes = e.changes;
  for (const key of ['add-fact-1', 'add-action-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'fact-and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true, key); click(control(e.tree(), key));
  }
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
});

void test('mixed and embedded fact groups retain every branch through edits, collapse and the shared depth-four envelope', () => {
  const e = editor({ kind: 'and', terms: [fact(), force(3)] });
  click(control(e.tree(), 'or-1.2')); select(e.tree(), '1.2', 'meaning', 'and');
  click(control(e.tree(), 'nested-or-1')); click(control(e.tree(), 'nested-and-1'));
  assert.ok(e.value.kind === 'and'); assert.equal(e.value.terms.length, 4);
  click(control(e.tree(), 'fact-or-1.1')); editFact(e.tree(), '1.1.2', { kind: 'stormForecast', compare: 'gte', value: 4 });
  select(e.tree(), '1.1', 'fact-meaning', 'and'); click(control(e.tree(), 'fact-add-1.1'));
  editFact(e.tree(), '1.1.3', { kind: 'spice', compare: 'gte', value: 7 });
  assert.match(e.html(), /Current-fact group 1\.1/); assert.equal(e.error(), null);
  click(control(e.tree(), 'fact-remove-1.1.3')); click(control(e.tree(), 'fact-remove-1.1.2'));
  click(control(e.tree(), 'remove-1.2.2')); click(control(e.tree(), 'remove-1.4')); click(control(e.tree(), 'remove-1.3'));
  assert.deepEqual(e.value, { kind: 'and', terms: [fact(), force(3)] });
  select(e.tree(), '1.2', 'timing', 'fact'); assert.ok(e.error());
  select(e.tree(), '1.2', 'timing', 'action'); assert.equal(e.error(), null);
  click(control(e.tree(), 'remove-1.1')); assert.deepEqual(e.value, force()); assert.ok(e.error());
  click(control(e.tree(), 'and-1')); assert.equal(e.error(), null);
  let nested = fact();
  for (let depth = 0; depth < 4; depth++) nested = { kind: 'and', terms: [nested, force()] };
  const deep = editor(nested); assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['and-1', 'or-1.1.1.1.1', 'fact-and-1.1.1.1.1', 'nested-and-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 0);
  assert.ok(mixedRevivalInputError({ kind: 'and', terms: [nested, force()] }, projected(), 'p'));
});

void test('numeric and named drafts stay repairable while exact action leaves reject groups or metadata and busy callbacks preserve the tree', () => {
  for (const invalid of [NaN, -1, 0, 0.5, 21, Infinity]) {
    const e = editor({ kind: 'and', terms: [fact(), force()] });
    minimum(e.tree(), '1.2', invalid); assert.ok(e.error()); click(control(e.tree(), 'or-1.2'));
    const raw = e.value; assert.ok(raw.kind === 'and');
    assert.deepEqual(raw.terms[1], { kind: 'or', terms: [force(invalid), fact()] });
    assert.match(e.html(), /role="alert"/);
    minimum(e.tree(), '1.2.1', 2); assert.equal(e.error(), null);
    select(e.tree(), '1.2.1', 'kind', 'leader'); select(e.tree(), '1.2.1', 'leader', ''); assert.ok(e.error());
    select(e.tree(), '1.2.1', 'leader', 'named-leader'); assert.equal(e.error(), null);
  }
  for (const action of [{ kind: 'and', terms: [{ kind: 'forces', counter: 'total', minimum: 1 }] },
    { kind: 'forces', counter: 'total', minimum: 1, turn: 2 }, { kind: 'leader', leader: 'named-leader', fulfilled: true },
    { kind: 'forces', counter: 'strength', minimum: 1 }, { kind: 'leader', leader: 'foreign-leader' }])
    assert.ok(mixedRevivalInputError({ kind: 'and', terms: [fact(), { kind: 'action', action }] }, projected(), 'p'));
  const frozen = editor({ kind: 'and', terms: [fact(), force()] }, true), before = structuredClone(frozen.value);
  for (const key of ['and-1', 'add-action-1', 'nested-or-1', 'remove-1.2', 'fact-or-1.1']) click(control(frozen.tree(), key));
  minimum(frozen.tree(), '1.2', 3); select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.2', 'kind', 'leader');
  editFact(frozen.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 4 });
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
});

void test('leader choices use public respondent faction and Advanced Atreides identity while current facts inspect no secret eligibility', () => {
  for (const advanced of [false, true]) {
    const game = projected(4, 'revive', advanced);
    for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'leaders', 'kwisatz', 'spice', 'forces', 'reserves', 'tanks', 'elites'])
      Object.defineProperty(player, key, { get() { throw Error(`No ${key} inspection`); }, configurable: true });
    for (const key of ['revival', 'deck', 'spiceDeck', 'discard']) Object.defineProperty(game, key, {
      get() { throw Error(`No private ${key} inspection`); }, configurable: true,
    });
    const own = editor({ kind: 'and', terms: [fact({ kind: 'stormForecast', compare: 'gte', value: 3 }), named()] }, false, game);
    assert.equal(own.error(), null);
    const ownHTML = own.html(); assert.match(ownHTML, /Named Commander/); assert.match(ownHTML, /Second Commander/);
    assert.doesNotMatch(ownHTML, /Foreign Commander|Kwisatz Haderach/);
    assert.match(ownHTML, /Current facts are evaluated when the player answers/);
    assert.match(ownHTML, /unknown current fact can still allow a definite whole answer/);
    assert.match(ownHTML, /conservative future commitment/); assert.match(ownHTML, /If no such value is available, the answer is I don’t know/);
    const other = editor({ kind: 'and', terms: [fact(), named('foreign-leader')] }, false, game, 'a');
    assert.equal(other.error(), null); assert.match(other.html(), /Foreign Commander/); assert.doesNotMatch(other.html(), /Named Commander|Second Commander/);
    if (advanced) assert.match(other.html(), /Kwisatz Haderach/); else assert.doesNotMatch(other.html(), /Kwisatz Haderach/);
    assert.equal(mixedRevivalInputError({ kind: 'and', terms: [fact(), named('kwisatz')] }, game, 'a') === null, advanced);
    editFact(own.tree(), '1.1', { kind: 'spice', compare: 'gte', value: NaN }); assert.ok(own.error());
    editFact(own.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 2 }); assert.equal(own.error(), null);
  }
});

void test('own aggregate-only panel preserves the original question, whole answer and typed cumulative ordinary progress without frozen branches', () => {
  const game = projected(); game.revivalExpressionPromiseGuide = null;
  game.mixedRevivalPromises.push(
    { ...game.mixedRevivalPromises[0], event: 'no-event', answer: false },
    { ...game.mixedRevivalPromises[0], event: 'fulfilled-event', fulfilled: true },
    { ...game.mixedRevivalPromises[0], event: 'released-event', released: true },
    { ...game.mixedRevivalPromises[0], event: 'foreign-event', player: 'a', mixed: { kind: 'or', terms: [fact({ kind: 'hand', name: 'Poison Blade' }), named('foreign-leader')] } },
  );
  for (const promise of game.mixedRevivalPromises) for (const key of ['binding', 'residual', 'factAnswers', 'frozenFacts', 'compiled'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  assert.match(html, /You answered Yes/); assert.match(html, /You answered No/); assert.match(html, /you hold Shield/);
  assert.match(html, / OR /); assert.match(html, / AND /); assert.match(html, /Named Commander/);
  assert.match(html, /Future ordinary progress: 2 physical forces \(1 normal, 1 elite\)/); assert.match(html, /returned leaders: Named Commander/);
  assert.match(html, /Fulfilled: this whole commitment is complete/); assert.match(html, /Released: this whole commitment is no longer possible/);
  assert.match(html, /Individual fact answers and any reduced future branch remain private/);
  assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /cumulative across smaller future ordinary returns/);
  assert.match(html, /Prior returns, requests alone, Ghola, foreign leaders and special card returns do not count/);
  assert.match(html, /Original costs, revival cycles, limits and turn order still apply/);
  assert.doesNotMatch(html, /Poison Blade|Foreign Commander|controlled-mixed-revival-event|fulfilled-event|factAnswers/);
  assert.equal(MixedRevivalPromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('shared Basic and ordered Advanced guides forward the exact mixed return packet and accept only the current leader price', () => {
  for (const advanced of [false, true]) for (const type of ['revive', 'reviveLeader', 'reviveKwisatz', 'acceptLeaderRevival', 'ready']) {
    const game = projected(4, type, advanced), sent: Action[] = [];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.revivalExpressionPromiseGuide!.action]); assert.equal(sent[0], game.revivalExpressionPromiseGuide!.action);
    assert.match(markup(game), /data-testid="revival-expression-promise-guide"/);
    if (type === 'revive') assert.deepEqual(sent[0], { type: 'revive', amount: 2, elite: 1, freeElite: 0,
      revivalExpressionPromiseEvent: 'controlled-mixed-revival-event' });
    if (type === 'acceptLeaderRevival') {
      game.revivalRequests.p.price = 4; press(button); assert.equal(sent.length, 1);
      game.revivalRequests.p.price = 3; game.revivalRequests.p.declined = true; press(button); assert.equal(sent.length, 1);
    }
    if (advanced) { game.revivalOrder!.remaining = ['a', 'p']; game.active = 'a'; press(button); assert.equal(sent.length, 1); }
  }
});

void test('early mixed preparations retain Charity, ordinary auction payment and owned native silent-zero or pass packets', () => {
  for (const [phase, type] of [[2, 'charity'], [2, 'ready'], [3, 'passBid'], [3, 'decision']] as const) {
    const game = projected(phase, type), sent: Action[] = [];
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.revivalExpressionPromiseGuide!.action);
    if (type === 'decision') {
      assert.equal(sent[0].card, 'controlled-original-karama'); assert.equal(sent[0].karama, true);
      assert.doesNotMatch(markup(game), /controlled-original-karama/); game.decision!.player = 'a';
    } else if (phase === 2) game.ready.push('p'); else game.auction!.active = 'a';
    press(button); assert.equal(sent.length, 1);
  }
  for (const method of ['silent', 'onceAround'] as const) {
    const game = projected(3, 'richeseBid'), sent: Action[] = [];
    const native = createRicheseAuction({ event: 'controlled-mixed-revival-auction', cardId: 'controlled-card', owner: 'a',
      method, source: 'cache', eligible: ['p', 'a'], order: ['p', 'a'], tieOrder: ['p', 'a'] });
    game.richeseAuction = { ...projectRicheseAuction(native, 'p'), card: null, claim: null,
      ownAllyPayment: 0, ownAvailable: 4, allyAvailable: 0, peekKnown: false, inspectionBlocked: null };
    game.revivalExpressionPromiseGuide = { phase: 3, action: { type: 'richeseBid', event: native.event,
      amount: method === 'silent' ? 0 : null, allyPayment: 0, revivalExpressionPromiseEvent: 'controlled-mixed-revival-event' } };
    const button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.revivalExpressionPromiseGuide.action);
    game.richeseAuction.event = 'later-auction'; press(button); assert.equal(sent.length, 1);
    game.richeseAuction.event = native.event;
    if (method === 'silent') game.richeseAuction.submitted.push('p'); else game.richeseAuction.active = 'a';
    press(button); assert.equal(sent.length, 1);
  }
});

void test('stale mixed guide callbacks preserve exact event, owner, turn, phase, action counters, order and quiet-window guards without private inspection', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 5; }, game => { game.status = 'setup'; },
    game => { game.ready = ['p']; }, game => { game.revivalOrder!.remaining = ['a', 'p']; game.active = 'a'; },
    game => { game.revivalOrder!.turn = 1; }, game => { game.active = null; }, game => { game.revivalOrder = null; },
    game => { game.revivalOrder = { ...game.revivalOrder!, remaining: ['p', 'a'] }; },
    game => { game.revivalExpressionPromiseGuide = { phase: 4, action: { ...game.revivalExpressionPromiseGuide!.action } }; },
    game => { game.revivalExpressionPromiseGuide = null; }, game => { game.revivalExpressionPromiseGuide!.phase = 3; },
    game => { game.revivalExpressionPromiseGuide!.action.amount = 3; }, game => { game.revivalExpressionPromiseGuide!.action.elite = 0; },
    game => { game.revivalExpressionPromiseGuide!.action.freeElite = 1; },
    game => { game.mixedRevivalPromises[0].event = 'expired'; }, game => { game.mixedRevivalPromises[0].player = 'a'; },
    game => { game.mixedRevivalPromises[0].turn = 1; }, game => { game.mixedRevivalPromises[0].fulfilled = true; },
    game => { game.mixedRevivalPromises[0].released = true; }, game => { game.mixedRevivalPromises = []; },
    game => { game.phaseOpening = { passed: [] }; }, game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
    game => { game.automaticContinuationPending = true; }, game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.techTokens = createTechTokens(); },
  ];
  for (const change of changes) {
    const game = projected(4, 'revive', true), sent: Action[] = [], button = guide({ game, busy: false, send(action) { sent.push(action); } });
    change(game); press(button); assert.deepEqual(sent, []);
  }
  const busy = { game: projected(), busy: false, send() { assert.fail('A busy guide cannot send'); } };
  const button = guide(busy); busy.busy = true; press(button);
  const replaced = { game: projected(), busy: false, send() { assert.fail('A replaced view cannot send'); } };
  const original = guide(replaced); replaced.game = { ...replaced.game }; press(original);
  for (const [phase, type] of [[0, 'ready'], [1, 'ready'], [2, 'revive'], [3, 'revive'], [4, 'charity']] as const) {
    const game = projected(phase, type), sent: Action[] = [];
    press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.deepEqual(sent, []);
  }
  for (const type of ['revive', 'reviveLeader', 'reviveKwisatz', 'decision']) {
    const game = projected(type === 'decision' ? 3 : 4, type), sent: Action[] = [];
    for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'leaders', 'kwisatz', 'spice', 'forces', 'reserves', 'tanks', 'elites'])
      Object.defineProperty(player, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
    for (const key of ['revival', 'deck', 'spiceDeck', 'discard']) Object.defineProperty(game, key, {
      get() { throw Error(`No private ${key} inspection`); }, configurable: true,
    });
    if (game.auction) Object.defineProperty(game.auction, 'card', { get() { throw Error('No hidden auction lot inspection'); } });
    assert.match(markup(game), /Your mixed Revival promises/);
    press(guide({ game, busy: false, send(action) { sent.push(action); } })); assert.deepEqual(sent, [game.revivalExpressionPromiseGuide!.action]);
  }
});

void test('mixed panels wait for the actual Revival actor and share one guide with live pure records while historical panels stay passive', () => {
  for (const phase of [0, 1, 2, 3]) {
    const game = projected(phase); game.revivalExpressionPromiseGuide = null;
    assert.match(markup(game), /Your Revival opportunity is still ahead/); assert.doesNotMatch(markup(game), /<button/);
  }
  const game = projected(4, 'revive', true); game.revivalOrder!.remaining = ['a', 'p']; game.active = 'a';
  game.revivalExpressionPromiseGuide = null; assert.match(markup(game), /while the current actor finishes/);
  game.revivalOrder!.remaining = ['p', 'a']; game.active = 'p'; game.revivalExpressionPromiseGuide = projected().revivalExpressionPromiseGuide;
  assert.match(markup(game), /data-testid="revival-expression-promise-guide"/);
  game.revivalExpressionPromises.push({ event: 'controlled-pure-event', player: 'p', asker: 'a', turn: 2,
    claim: { kind: 'forces', counter: 'total', minimum: 3 }, answer: true, progress: { total: 0, normal: 0, elite: 0, leaders: [] } });
  assert.doesNotMatch(markup(game), /data-testid="revival-expression-promise-guide"/);
  assert.match(pureMarkup(game), /data-testid="revival-expression-promise-guide"/);
  game.revivalExpressionPromises[0].fulfilled = true;
  assert.match(markup(game), /data-testid="revival-expression-promise-guide"/);
  assert.doesNotMatch(pureMarkup(game), /data-testid="revival-expression-promise-guide"/);
  game.revivalExpressionPromises[0].fulfilled = false; game.revivalExpressionPromises[0].turn = 1;
  assert.match(markup(game), /data-testid="revival-expression-promise-guide"/);
  assert.doesNotMatch(pureMarkup(game), /data-testid="revival-expression-promise-guide"/);
  game.mixedRevivalPromises[0].fulfilled = true;
  assert.doesNotMatch(markup(game), /data-testid="revival-expression-promise-guide"|Your Revival opportunity is still ahead/);
  game.mixedRevivalPromises[0].fulfilled = false; game.mixedRevivalPromises[0].turn = 1;
  assert.doesNotMatch(markup(game), /data-testid="revival-expression-promise-guide"|Your Revival opportunity is still ahead/);
});
