import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TravelClaimFields, travelClaimInputError } from '../components/travel-claim-fields';
import { TravelAnswers, TravelPromiseGuideButton, TravelPromises } from '../components/travel-promises';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { TravelActionClaim } from '../game/travel-expression-promises';
import type { TruthFact } from '../game/truthtrance';

type Expression = MixedActionExpression<TravelActionClaim>;
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const fact = (value: TruthFact = { kind: 'hand', name: 'Shield' }): Expression => ({ kind: 'fact', fact: value });
const action = (kind: 'ship' | 'move' = 'ship', minimum = 1, territory = 'carthag'): Expression =>
  ({ kind: 'action', action: { kind, territory, minimum } });
const claim = (): Expression => ({ kind: 'or', terms: [action('ship', 3), { kind: 'and', terms: [fact(), action('move', 4, 'arrakeen')] }] });

function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value);
  assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-travel-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  (find(tree, 'id', `truth-travel-${path}-${field}`).props.onChange as
    (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function minimum(tree: ReactNode, path: string, valueAsNumber: number) {
  (find(tree, 'id', `truth-travel-${path}-minimum`).props.onChange as
    (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber } });
}
function editFact(tree: ReactNode, path: string, value: TruthFact) {
  const scope = find(tree, 'data-travel-fact-path', path);
  const fields = elements(scope).find(element => element.type === TruthFactFields);
  assert.ok(fields);
  (fields.props.onChange as (next: TruthFact) => void)(value);
}

/** Explicitly controlled projections verify UI callbacks. They do not claim
 * native acquisition, force movement or promise fulfillment evidence. */
function projected(next: Action = { type: 'move', forces: { 'arrakeen:10': 3, 'arrakeen:11': 1 },
  eliteForces: { 'arrakeen:10': 1 }, territory: 'carthag', sector: 11 }): GameView {
  const source = createGame('TRUTHTRAVELCONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = 5; game.active = 'p'; game.ready = [];
  game.travelPromises = [{ event: 'controlled-travel-event', player: 'p', asker: 'a', turn: 2,
    mixed: claim(), answer: true, fulfilled: false, released: false }];
  game.travelPromiseGuide = { event: 'controlled-travel-event', action: { ...next,
    travelPromiseEvent: 'controlled-travel-event', travelPromisePhase: game.phase } };
  game.truthTravelAnswers = null;
  return game;
}
function editor(initial: Expression, disabled = false, game = projected()) {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => TravelClaimFields({ value, game, target: 'p', disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(TravelClaimFields, { value, game, target: 'p', disabled, onChange() {} })),
    error: () => travelClaimInputError(value, game, 'p'),
  };
}
function guide(props: Parameters<typeof TravelPromiseGuideButton>[0]) {
  const button = TravelPromiseGuideButton(props); assert.ok(button); return button;
}
const press = (button: ReturnType<typeof guide>) => button.props.onClick();
const markup = (game: GameView) => renderToStaticMarkup(createElement(TravelPromises, { game, busy: false, act() {} }));
function answering(): GameView {
  const game = projected();
  game.truthtrance = { stage: 'answer', queue: [{ player: 'a', card: 'controlled-truth-card' }], passed: [],
    question: { kind: 'travel', target: 'p', turn: 2, mixed: claim() } };
  game.truthTravelAnswers = ['yes', 'no', 'unknown'];
  return game;
}

void test('travel editor accepts action-only expressions and preserves shipment and movement alternatives through edits', () => {
  const e = editor(action('ship', 3)); assert.equal(e.error(), null);
  select(e.tree(), '1', 'action', 'move'); select(e.tree(), '1', 'territory', 'arrakeen'); minimum(e.tree(), '1', 5);
  assert.deepEqual(e.value, action('move', 5, 'arrakeen'));
  select(e.tree(), '1', 'action', 'ship');
  assert.deepEqual(e.value, action('ship', 5, 'arrakeen'));
  click(control(e.tree(), 'or-1')); select(e.tree(), '1.2', 'timing', 'action');
  select(e.tree(), '1.2', 'action', 'move'); minimum(e.tree(), '1.2', 4);
  assert.deepEqual(e.value, { kind: 'or', terms: [action('ship', 5, 'arrakeen'), action('move', 4)] });
  assert.equal(e.error(), null);
  const html = e.html();
  assert.match(html, /Ship from reserves/); assert.match(html, /Make ground movement/);
  assert.match(html, /single future original reserve shipment/); assert.match(html, /smaller moves never add together/);
  assert.match(html, /No makes the whole expression false/); assert.match(html, /Original costs, movement rights/);
  click(control(e.tree(), 'remove-1.1')); assert.deepEqual(e.value, action('move', 4));
  select(e.tree(), '1', 'timing', 'fact'); assert.ok(e.error(), 'A pure-fact tree still needs a future action');
});

void test('travel editor retains sixteen optional-fact clauses and four grouping levels without truncation', () => {
  const e = editor({ kind: 'or', terms: [action('ship', 3), action('move', 4)] });
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-action-1'));
    minimum(e.tree(), `1.${count}`, count);
    if (count % 2) select(e.tree(), `1.${count}`, 'action', 'move');
  }
  assert.equal(e.error(), null); assert.match(e.html(), /16 \/ 16 conditions/);
  const full = structuredClone(e.value), changes = e.changes;
  for (const key of ['add-action-1', 'add-fact-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.deepEqual(e.value, full); assert.equal(e.changes, changes);
  const deep = editor({ kind: 'and', terms: [fact(), action('move')] });
  click(control(deep.tree(), 'or-1.2')); select(deep.tree(), '1.2', 'meaning', 'and');
  click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  assert.equal(control(deep.tree(), 'and-1.2.1.1.1').props.disabled, true);
  editFact(deep.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 3 }); assert.equal(deep.error(), null);
  click(control(deep.tree(), 'remove-1.2.1.1.2'));
  assert.match(deep.html(), /3 \/ 4 levels of grouping/);
});

void test('travel fields preserve invalid numeric drafts and reject disabled callbacks', () => {
  for (const invalid of [NaN, 0, -1, 1.5, 21, Infinity]) {
    const e = editor(action()); minimum(e.tree(), '1', invalid);
    assert.ok(e.error());
    if (Number.isNaN(invalid)) assert.match(e.html(), /value=""/);
    minimum(e.tree(), '1', 20); assert.equal(e.error(), null);
  }
  const malformed = editor(action()); select(malformed.tree(), '1', 'territory', 'invented-place');
  assert.ok(malformed.error()); assert.match(malformed.html(), /aria-invalid="true"/);
  const frozen = editor(claim(), true), original = structuredClone(frozen.value);
  select(frozen.tree(), '1', 'meaning', 'and'); minimum(frozen.tree(), '1.1', 7);
  select(frozen.tree(), '1.1', 'action', 'move'); select(frozen.tree(), '1.1', 'territory', 'arrakeen');
  editFact(frozen.tree(), '1.2.1', { kind: 'spice', compare: 'gte', value: 9 });
  for (const key of ['and-1', 'add-action-1', 'remove-1.1', 'nested-or-1']) click(control(frozen.tree(), key));
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, original);
});

void test('travel inputs use printed destinations and current-fact schema without private eligibility or custody reads', () => {
  const game = projected();
  for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves'])
    Object.defineProperty(player, key, { get() { throw Error(`No ${key} inspection`); }, configurable: true });
  for (const expression of [action('ship', 20, 'arrakeen'), { kind: 'and', terms: [fact({ kind: 'stormForecast', compare: 'gte', value: 3 }), action('move')] } as Expression]) {
    const e = editor(expression, false, game);
    assert.equal(e.error(), null); assert.match(e.html(), /Carthag/); assert.match(e.html(), /Arrakeen/);
    assert.match(e.html(), /Only the aggregate answer is shared/);
  }
});

void test('travel history retains own original whole questions and terminal statuses without compiled branches or foreign history', () => {
  const game = projected(); game.travelPromiseGuide = null;
  game.travelPromises.push(
    { ...game.travelPromises[0], event: 'controlled-no', answer: false },
    { ...game.travelPromises[0], event: 'controlled-complete', turn: 1, fulfilled: true },
    { ...game.travelPromises[0], event: 'controlled-release', released: true },
    { ...game.travelPromises[0], event: 'controlled-foreign', player: 'a', mixed: { kind: 'and', terms: [fact({ kind: 'hand', name: 'Poison Blade' }), action('ship', 19, 'sietch_tabr')] } },
  );
  for (const promise of game.travelPromises) for (const key of ['compiled', 'binding', 'factAnswers', 'residual', 'route'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  assert.match(html, /Turn 1/); assert.match(html, /You answered Yes/); assert.match(html, /You answered No/);
  assert.match(html, /you hold Shield/); assert.match(html, / OR /); assert.match(html, / AND /);
  assert.match(html, /Fulfilled: this whole commitment is complete/); assert.match(html, /Released: this whole commitment is no longer possible/);
  assert.match(html, /No negates the whole expression, not each condition separately/);
  assert.match(html, /maximum physical forces in one actual future move, never the sum/);
  assert.match(html, /Individual fact answers and any reduced future branch remain private/);
  assert.doesNotMatch(html, /Poison Blade|19 physical|controlled-foreign|controlled-complete|factAnswers/);
  assert.equal(TravelPromises({ game: { ...game, me: 'missing' }, busy: false, act() {} }), null);
  game.travelPromises = game.travelPromises.filter(promise => promise.fulfilled || promise.released);
  assert.doesNotMatch(markup(game), /<button|Movement turn is still ahead/);
});

void test('travel guide forwards exact native shipment, movement and preparation packets without rewriting nested forces', () => {
  const actions: Action[] = [
    projected().travelPromiseGuide!.action,
    { type: 'ship', territory: 'arrakeen', sector: 10, amount: 4, elite: 1, allyPayment: 0 },
    { type: 'guildShip', from: 'reserves', territory: 'carthag', sector: 11, amount: 6, elite: 0, allyPayment: 3 },
    { type: 'move', territory: 'carthag', sector: 11, forces: { 'arrakeen:10': 4 }, eliteForces: {},
      movementCard: 'controlled-ornithopter', ornithopter: 'twoGroups', ornithopterEvent: 'controlled-flight' },
    { type: 'card', card: 'controlled-hajr' }, { type: 'prepareAdvisors', territory: 'arrakeen' },
    { type: 'revealNoField', territory: 'arrakeen', sector: 10 }, { type: 'endMovement' },
  ];
  for (const action of actions) {
    const game = projected(action), sent: Action[] = [];
    const button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button);
    assert.deepEqual(sent, [game.travelPromiseGuide!.action]); assert.equal(sent[0], game.travelPromiseGuide!.action);
    assert.match(markup(game), /data-testid="travel-promise-guide"/);
    if (action.type === 'guildShip') assert.match(markup(game), /using Guild transport/);
  }
  const game = projected({ type: 'decision', event: 'controlled-paid-search', card: 'controlled-recovered-card' });
  game.decision = { kind: 'nullentropy', player: 'p' };
  game.nullentropy = { card: { id: 'controlled-box', name: 'Nullentropy Box', kind: 'special', effect: 'nullentropyBox' }, blocked: null,
    search: { event: 'controlled-paid-search', cards: [{ id: 'controlled-recovered-card', name: 'Hajr', kind: 'special', effect: 'hajr' }] } };
  const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
  assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.travelPromiseGuide!.action);
  game.nullentropy.search!.event = 'changed-search'; press(button); assert.equal(sent.length, 1);
});

void test('travel guide rejects stale view, actor, source, turn, phase, native ownership and quiet-window changes', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 4; }, game => { game.status = 'setup'; },
    game => { game.active = 'a'; }, game => { game.travelPromiseGuide = null; },
    game => { game.travelPromiseGuide = { ...game.travelPromiseGuide!, action: { ...game.travelPromiseGuide!.action } }; },
    game => { game.travelPromiseGuide!.event = 'changed'; },
    game => { game.travelPromiseGuide!.action.travelPromiseEvent = 'changed'; },
    game => { game.travelPromiseGuide!.action.travelPromisePhase = 4; },
    game => { (game.travelPromiseGuide!.action.forces as Record<string, number>)['arrakeen:10'] = 2; },
    game => { (game.travelPromiseGuide!.action.eliteForces as Record<string, number>)['arrakeen:10'] = 0; },
    game => { game.travelPromises[0].event = 'expired'; }, game => { game.travelPromises[0].player = 'a'; },
    game => { game.travelPromises[0].turn = 1; }, game => { game.travelPromises[0].fulfilled = true; },
    game => { game.travelPromises[0].released = true; }, game => { game.travelPromises = []; },
    game => { game.phaseOpening = { passed: [] }; }, game => { game.automaticContinuationPending = true; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.truthtrance = answering().truthtrance; },
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
  const replacedButton = guide(replaced); replaced.game = { ...replaced.game }; press(replacedButton);
});

void test('whole travel answers offer only native choices and forward guarded original answer packets', () => {
  const game = answering(), sent: Action[] = [], props = { game, busy: false, act(value: Action) { sent.push(value); } };
  for (const answer of game.truthTravelAnswers!) {
    const tree = TravelAnswers(props); assert.ok(tree);
    click(find(tree, 'data-travel-answer', answer));
  }
  assert.deepEqual(sent, ['yes', 'no', 'unknown'].map(answer => ({ type: 'truthAnswer', answer })));
  const html = renderToStaticMarkup(createElement(TravelAnswers, props));
  assert.match(html, /Answer Yes/); assert.match(html, /Answer No/); assert.match(html, /I don’t know yet/);
  game.truthTravelAnswers = ['no'];
  const restricted = renderToStaticMarkup(createElement(TravelAnswers, { game, busy: false, act() {} }));
  assert.match(restricted, /Answer No/); assert.doesNotMatch(restricted, /Answer Yes|I don’t know yet/);
  assert.equal(TravelAnswers({ game: { ...game, me: 'a' }, busy: false, act() {} }), null);
  assert.equal(TravelAnswers({ game: { ...game, truthTravelAnswers: null }, busy: false, act() {} }), null);
});

void test('travel answer callbacks reject stale source, offered choices, view identity, turn and modal ownership', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn = 3; }, game => { game.phase = 4; }, game => { game.status = 'setup'; },
    game => { game.truthtrance = null; }, game => { game.truthtrance!.stage = 'ask'; },
    game => { game.truthtrance!.question = { ...game.truthtrance!.question! }; },
    game => { game.truthtrance!.question!.target = 'a'; },
    game => { game.truthtrance!.queue[0] = { ...game.truthtrance!.queue[0] }; },
    game => { game.truthtrance!.queue[0].card = 'another-card'; },
    game => { game.truthTravelAnswers = ['yes']; }, game => { game.truthTravelAnswers!.splice(0); },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.phaseOpening = { passed: [] }; }, game => { game.automaticContinuationPending = true; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => { game.players.find(player => player.id === game.me)!.autopilot = 'Easy'; },
    game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
    game => { game.roomControl = { paused: false, closed: true, joinLocked: false, revision: 1, updatedAt: null }; },
  ];
  for (const change of changes) {
    const game = answering(), sent: Action[] = [], tree = TravelAnswers({ game, busy: false, act(value) { sent.push(value); } });
    const button = find(tree, 'data-travel-answer', 'yes'); change(game); click(button); assert.deepEqual(sent, []);
  }
  const busy = { game: answering(), busy: false, act() { assert.fail('Busy answer cannot send'); } };
  const button = find(TravelAnswers(busy), 'data-travel-answer', 'yes'); busy.busy = true; click(button);
  const replaced = { game: answering(), busy: false, act() { assert.fail('Replaced view cannot send'); } };
  const original = find(TravelAnswers(replaced), 'data-travel-answer', 'yes'); replaced.game = { ...replaced.game }; click(original);
});
