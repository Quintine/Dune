import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MixedAllianceFields, mixedAllianceInputError } from '../components/mixed-alliance-fields';
import { MixedAlliancePromises } from '../components/mixed-alliance-promises';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { AlliancePromises, AlliancePromiseGuideButton } from '../components/alliance-promises';
import { AllianceExpressionPromises } from '../components/alliance-expression-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { AllianceActionClaim } from '../game/mixed-alliance-question';
import type { TruthFact } from '../game/truthtrance';
import { createTechTokens } from '../game/tech-tokens';

type Expression = MixedActionExpression<AllianceActionClaim>;
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const fact = (value: TruthFact = { kind: 'hand', name: 'Shield' }): Expression => ({ kind: 'fact', fact: value });
const partner = (id = 'r'): Expression => ({ kind: 'action', action: { partner: id } });
const claim = (): Expression => ({ kind: 'or', terms: [fact(), { kind: 'and', terms: [partner(), partner('a')] }] });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value); assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-mixed-alliance-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-mixed-alliance-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function editFact(tree: ReactNode, path: string, next: TruthFact) {
  const scope = find(tree, 'data-mixed-alliance-fact-path', path);
  const fields = elements(scope).find(element => element.type === TruthFactFields); assert.ok(fields, `Current fact fields ${path}`);
  (fields.props.onChange as (fact: TruthFact) => void)(next);
}

/** These personalized projections exercise controlled UI and canonical guide
 * ownership, without claiming native answer-time snapshots or consent. */
function projected(kind: 'accept' | 'break' | 'ready' = 'accept', advanced = false): GameView {
  const source = createGame('TRUTHMIXEDALLIANCECONTROLS', newPlayer('p', 'Respondent', 'emperor'), advanced);
  joinGame(source, newPlayer('a', 'Asker', 'harkonnen'));
  joinGame(source, newPlayer('r', 'Partner', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = 1; game.nexus = true; game.spiceWindow = null;
  game.active = 'a'; game.ready = []; game.alliancePromiseNexus = { turn: 2 };
  game.alliancePromises = []; game.allianceExpressionPromises = [];
  game.mixedAlliancePromises = [{ event: 'controlled-mixed-alliance', player: 'p', asker: 'a', turn: 2,
    mixed: claim(), answer: kind !== 'break', fulfilled: false, released: false }];
  game.allianceOffers = kind === 'accept' ? { r: 'p' } : {};
  if (kind !== 'accept') {
    game.players.find(player => player.id === 'p')!.ally = 'r';
    game.players.find(player => player.id === 'r')!.ally = 'p';
  }
  game.alliancePromiseGuide = { action: { type: kind === 'ready' ? 'ready' : 'alliance',
    ...(kind === 'ready' ? {} : { target: kind === 'accept' ? 'r' : null }), alliancePromiseEvent: 'controlled-mixed-alliance' } };
  return game;
}
function editor(initial: Expression, disabled = false, game = projected()) {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => MixedAllianceFields({ value, game, target: 'p', disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(MixedAllianceFields, { value, game, target: 'p', disabled, onChange() {} })),
    error: () => mixedAllianceInputError(value, game, 'p'),
  };
}
function guide(props: Parameters<typeof AlliancePromiseGuideButton>[0]) {
  const button = AlliancePromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(MixedAlliancePromises, { game, busy: false, send() {} }));

void test('shared mixed editor preserves sixteen clauses and offers every public other partner without predicting consent', () => {
  const e = editor(fact()); click(control(e.tree(), 'or-1')); select(e.tree(), '1.2', 'partner', 'r');
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-action-1')); select(e.tree(), `1.${count}`, 'partner', count % 2 ? 'r' : 'a');
  }
  assert.ok(e.value.kind === 'or'); assert.equal(e.value.terms.length, 16); assert.equal(e.error(), null);
  const html = e.html(), ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length); assert.match(html, /16 \/ 16 conditions/);
  assert.equal((html.match(/Named alliance partner/g) ?? []).length, 15);
  const before = structuredClone(e.value), changes = e.changes;
  for (const key of ['add-fact-1', 'add-action-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'fact-or-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.equal(e.changes, changes); assert.deepEqual(e.value, before);
  const game = projected(); game.allianceOffers = {};
  game.players.find(player => player.id === 'a')!.ally = 'r'; game.players.find(player => player.id === 'r')!.ally = 'a';
  const allied = editor({ kind: 'and', terms: [fact(), partner()] }, false, game);
  assert.equal(allied.error(), null); assert.match(allied.html(), /<option value="r"/); assert.match(allied.html(), /<option value="a"/);
  assert.doesNotMatch(allied.html(), /<option value="p"/);
  select(allied.tree(), '1.2', 'partner', 'a'); assert.equal(allied.error(), null);
  select(allied.tree(), '1.2', 'partner', 'unlisted'); assert.equal(allied.changes, 1);
});

void test('mixed and current-fact groups share depth four and preserve branches through meaning, timing and singleton collapse', () => {
  const e = editor({ kind: 'and', terms: [fact(), partner()] });
  click(control(e.tree(), 'or-1.2')); select(e.tree(), '1.2', 'meaning', 'and');
  click(control(e.tree(), 'nested-or-1')); select(e.tree(), '1.3.2', 'partner', 'a');
  click(control(e.tree(), 'fact-or-1.1')); editFact(e.tree(), '1.1.2', { kind: 'stormForecast', compare: 'gte', value: 4 });
  select(e.tree(), '1.1', 'fact-meaning', 'and'); click(control(e.tree(), 'fact-add-1.1'));
  editFact(e.tree(), '1.1.3', { kind: 'spice', compare: 'gte', value: 7 }); assert.equal(e.error(), null);
  click(control(e.tree(), 'fact-remove-1.1.3')); click(control(e.tree(), 'fact-remove-1.1.2'));
  click(control(e.tree(), 'remove-1.2.2')); click(control(e.tree(), 'remove-1.3'));
  assert.deepEqual(e.value, { kind: 'and', terms: [fact(), partner()] });
  select(e.tree(), '1.2', 'timing', 'fact'); assert.ok(e.error());
  select(e.tree(), '1.2', 'timing', 'action'); select(e.tree(), '1.2', 'partner', 'r'); assert.equal(e.error(), null);
  click(control(e.tree(), 'remove-1.1')); assert.deepEqual(e.value, partner('r')); assert.ok(e.error());
  let nested = fact();
  for (let depth = 0; depth < 3; depth++) nested = { kind: 'and', terms: [nested, partner()] };
  const deep = editor(nested); click(control(deep.tree(), 'fact-or-1.1.1.1'));
  assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['and-1', 'or-1.1.1.1', 'fact-and-1.1.1.1.1', 'fact-or-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 1);
});

void test('incomplete partner and fact drafts remain editable while strict envelopes and disabled callbacks are enforced', () => {
  const e = editor({ kind: 'and', terms: [fact(), partner()] });
  select(e.tree(), '1.2', 'partner', ''); assert.ok(e.error()); click(control(e.tree(), 'or-1.2'));
  assert.ok(e.value.kind === 'and'); assert.deepEqual(e.value.terms[1], { kind: 'or', terms: [partner(''), fact()] });
  assert.match(e.html(), /role="alert"/); select(e.tree(), '1.2.1', 'partner', 'a'); assert.equal(e.error(), null);
  for (const invalid of [NaN, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
    editFact(e.tree(), '1.1', { kind: 'spice', compare: 'gte', value: invalid }); assert.ok(e.error());
    editFact(e.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 0 }); assert.equal(e.error(), null);
  }
  const game = projected();
  for (const invalid of [fact(), partner(), { ...claim(), binding: true },
    { kind: 'and', terms: [fact(), { kind: 'constant', value: true }, partner()] },
    { kind: 'and', terms: [fact(), { kind: 'action', action: { partner: 'p' } }] },
    { kind: 'and', terms: [fact(), { kind: 'action', action: { partner: 'r', source: 'hidden' } }] },
    { kind: 'and', terms: [fact(), { kind: 'action', action: { partner: ' r ' } }] }])
    assert.ok(mixedAllianceInputError(invalid, game, 'p'));
  const frozen = editor({ kind: 'and', terms: [fact(), partner()] }, true), before = structuredClone(frozen.value);
  for (const key of ['and-1', 'add-action-1', 'nested-or-1', 'remove-1.2', 'fact-or-1.1']) click(control(frozen.tree(), key));
  select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.1', 'timing', 'action');
  select(frozen.tree(), '1.2', 'partner', 'a'); editFact(frozen.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 4 });
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
});

void test('editor and shared guide use public choices without private custody, balances, sources or compiled mixed facts', () => {
  const game = projected(), value: Expression = { kind: 'and', terms: [fact({ kind: 'stormForecast', compare: 'gte', value: 3 }), partner()] };
  for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves', 'bribes'])
    Object.defineProperty(player, key, { get() { throw Error(`No ${key} inspection`); }, configurable: true });
  for (const promise of game.mixedAlliancePromises) for (const key of ['source', 'binding', 'residual', 'factAnswers', 'compiled', 'frozenFact'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key}`); }, configurable: true });
  const html = renderToStaticMarkup(createElement(MixedAllianceFields, { value, game, target: 'p', disabled: false, onChange() {} }));
  assert.match(html, /Current facts are evaluated when the player answers/); assert.match(html, /Only the aggregate answer is shared/);
  assert.match(html, /unknown current fact can still allow a definite whole answer/); assert.match(html, /Offers alone are not alliances/);
  assert.equal(mixedAllianceInputError(value, game, 'p'), null);
  const sent: Action[] = []; press(guide({ game, busy: false, send(action) { sent.push(action); } }));
  assert.equal(sent[0], game.alliancePromiseGuide!.action);
});

void test('own mixed panel retains only raw questions, aggregate outcomes and passive constant or terminal records', () => {
  const game = projected(); game.alliancePromiseGuide = null;
  game.mixedAlliancePromises.push(
    { ...game.mixedAlliancePromises[0], event: 'no-event', answer: false },
    { ...game.mixedAlliancePromises[0], event: 'constant-event', fulfilled: true },
    { ...game.mixedAlliancePromises[0], event: 'released-event', released: true },
    { ...game.mixedAlliancePromises[0], event: 'foreign-event', player: 'a', mixed: { kind: 'and', terms: [
      fact({ kind: 'hand', name: 'Poison Blade' }), partner('foreign-partner'),
    ] } },
  );
  for (const promise of game.mixedAlliancePromises) for (const key of ['source', 'binding', 'residual', 'factAnswers', 'compiled', 'frozenFact'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key}`); }, configurable: true });
  const html = markup(game);
  assert.match(html, /you hold Shield/); assert.match(html, /You answered Yes/); assert.match(html, /You answered No/);
  assert.match(html, / OR /); assert.match(html, / AND /); assert.match(html, /Individual fact answers and any reduced future branch remain private/);
  assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /A remaining alliance obligation settles only at the actual Nexus close/);
  assert.match(html, /forming an alliance does not fulfill it early/); assert.match(html, /Offers alone are not alliances/);
  assert.match(html, /constant whole answer can already be complete without an alliance obligation/);
  assert.match(html, /Fulfilled: this whole commitment is complete/); assert.match(html, /Released: this whole commitment is no longer possible/);
  assert.match(html, /href="\/rules#truthtrance-mixed-alliance"/);
  assert.doesNotMatch(html, /Poison Blade|foreign-partner|controlled-mixed-alliance|constant-event|factAnswers|data-testid="alliance-promise-guide"/);
  assert.equal(MixedAlliancePromises({ game: { ...game, me: 'missing' }, busy: false, send() {} }), null);
});

void test('exact mixed guide forwards owned reciprocal acceptance, preparation and Ready without inferring raw mixed residuals', () => {
  for (const advanced of [false, true]) for (const kind of ['accept', 'break', 'ready'] as const) {
    const game = projected(kind, advanced), sent: Action[] = [], button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.alliancePromiseGuide!.action);
    assert.notEqual(game.active, game.me);
  }
  // The same raw OR question can have a private constant-true or an owned
  // alliance residual. The client forwards the canonical server-owned guide.
  const game = projected('ready'); game.players.find(player => player.id === 'p')!.ally = null;
  game.players.find(player => player.id === 'r')!.ally = null;
  game.mixedAlliancePromises[0].mixed = { kind: 'or', terms: [fact({ kind: 'spice', compare: 'gte', value: 9 }), partner()] };
  Object.defineProperty(game.players.find(player => player.id === 'p')!, 'spice', { get() { throw Error('No current-fact reevaluation'); } });
  const sent: Action[] = []; const button = guide({ game, busy: false, send(action) { sent.push(action); } });
  assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.alliancePromiseGuide!.action);
  const noConsent = projected(); noConsent.allianceOffers = {};
  assert.equal(guide({ game: noConsent, busy: false, send() {} }).props.disabled, true);
  const scalar = projected(); scalar.alliancePromises.push({ event: 'earlier-scalar', player: 'p', asker: 'a', turn: 2,
    partner: 'r', answer: false }); assert.equal(guide({ game: scalar, busy: false, send() {} }).props.disabled, true);
});

void test('stale mixed callbacks preserve exact owner, event, public context, Nexus, quiet-window and room guards', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 2; }, game => { game.status = 'setup'; },
    game => { game.nexus = false; }, game => { game.ready = ['p']; }, game => { game.alliancePromiseNexus = null; },
    game => { game.alliancePromiseNexus!.turn = 1; }, game => { game.allianceOffers = {}; }, game => { game.allianceOffers.a = 'p'; },
    game => { game.alliancePromiseGuide = { action: { ...game.alliancePromiseGuide!.action } }; },
    game => { game.alliancePromiseGuide = null; }, game => { game.alliancePromiseGuide!.action.target = null; },
    game => { game.alliancePromiseGuide!.action.alliancePromiseEvent = 'other'; },
    game => { game.mixedAlliancePromises[0].event = 'expired'; }, game => { game.mixedAlliancePromises[0].player = 'a'; },
    game => { game.mixedAlliancePromises[0].turn = 1; }, game => { game.mixedAlliancePromises[0].fulfilled = true; },
    game => { game.mixedAlliancePromises[0].released = true; }, game => { game.mixedAlliancePromises = []; },
    game => { game.players.find(player => player.id === 'a')!.ally = 'r'; },
    game => { game.players = game.players.filter(player => player.id !== 'r'); },
    game => { game.spiceWindow = { territory: 'hagga_basin', sector: 12, amount: 6, harvested: false }; },
    game => { game.phaseOpening = { passed: [] }; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.truthtrance = { stage: 'ask', queue: [{ player: 'a', card: 'controlled-card' }], passed: [], question: null }; },
    game => { game.automaticContinuationPending = true; }, game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.techTokens = createTechTokens(); },
  ];
  for (const change of changes) {
    const game = projected(), sent: Action[] = [], button = guide({ game, busy: false, send(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); change(game); press(button); assert.deepEqual(sent, []);
  }
  const busy = { game: projected(), busy: false, send() { assert.fail('Busy guide'); } };
  const oldBusy = guide(busy); busy.busy = true; press(oldBusy);
  const replaced = { game: projected(), busy: false, send() { assert.fail('Replaced projection'); } };
  const oldReplaced = guide(replaced); replaced.game = { ...replaced.game }; press(oldReplaced);
  for (const event of ['', 'unrelated']) {
    const game = projected(); game.alliancePromiseGuide!.action.alliancePromiseEvent = event;
    const button = guide({ game, busy: false, send() { assert.fail('Unknown event'); } }); assert.equal(button.props.disabled, true); press(button);
  }
});

void test('one live scalar, pure or mixed panel owns the common guide while settled histories remain passive', () => {
  const game = projected();
  const all = () => renderToStaticMarkup(createElement('div', null,
    createElement(AlliancePromises, { game, busy: false, send() {} }),
    createElement(AllianceExpressionPromises, { game, busy: false, send() {} }),
    createElement(MixedAlliancePromises, { game, busy: false, send() {} })));
  const one = () => assert.equal((all().match(/data-testid="alliance-promise-guide"/g) ?? []).length, 1);
  assert.match(markup(game), /data-testid="alliance-promise-guide"/); one();
  game.alliancePromises.push({ event: 'scalar-history', player: 'p', asker: 'a', turn: 1, partner: 'r', answer: true, fulfilled: true });
  game.allianceExpressionPromises.push({ event: 'pure-history', player: 'p', asker: 'a', turn: 1,
    claim: { kind: 'partner', partner: 'r' }, answer: true, fulfilled: true });
  assert.match(markup(game), /data-testid="alliance-promise-guide"/); one();
  game.allianceExpressionPromises.push({ event: 'live-pure', player: 'p', asker: 'a', turn: 2,
    claim: { kind: 'partner', partner: 'r' }, answer: true });
  assert.doesNotMatch(markup(game), /data-testid="alliance-promise-guide"/); one();
  game.alliancePromises.push({ event: 'live-scalar', player: 'p', asker: 'a', turn: 2, partner: 'r', answer: true });
  assert.doesNotMatch(renderToStaticMarkup(createElement(AllianceExpressionPromises, { game, busy: false, send() {} })), /data-testid="alliance-promise-guide"/);
  one(); game.alliancePromises[1].fulfilled = true; one();
  game.allianceExpressionPromises[1].fulfilled = true; assert.match(markup(game), /data-testid="alliance-promise-guide"/); one();
  game.mixedAlliancePromises[0].fulfilled = true; assert.doesNotMatch(all(), /data-testid="alliance-promise-guide"/);
});
