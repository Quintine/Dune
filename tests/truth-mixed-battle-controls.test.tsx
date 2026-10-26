import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BattlePromises } from '../components/battle-promises';
import { MixedBattleFields, mixedBattleInputError } from '../components/mixed-battle-fields';
import { MixedBattlePromises } from '../components/mixed-battle-promises';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView, type Plan } from '../game/engine';
import { mixedActionExpressionSize, type MixedActionExpression } from '../game/mixed-action-question';
import type { MixedBattleActionClaim } from '../game/mixed-battle-question';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import type { TruthFact } from '../game/truthtrance';
import { TRUTH_CARD_NAMES } from '../game/truthtrance-card-names';

type Expression = MixedActionExpression<MixedBattleActionClaim>;
type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = ReactElement<ElementProps>;
const fact = (value: TruthFact = { kind: 'hand', name: 'Shield' }): Expression => ({ kind: 'fact', fact: value });
const action = (value: MixedBattleActionClaim = { kind: 'dial', compare: 'eq', value: 0 }): Expression => ({ kind: 'action', action: value });
const dial = (value = 0): Expression => action({ kind: 'dial', compare: 'eq', value });
const claim = (): Expression => ({ kind: 'or', terms: [fact(), { kind: 'and', terms: [dial(3), action({ kind: 'leader', leader: 'named-leader' })] }] });
const plan = (): Plan => ({ dial: 3, support: 0, leader: 'named-leader', weapon: null, defense: null, kwisatz: false });
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function find(tree: ReactNode, key: string, value: string): Element {
  const found = elements(tree).find(element => element.props[key] === value);
  assert.ok(found, `${key}=${value}`); return found;
}
const control = (tree: ReactNode, key: string) => find(tree, 'data-mixed-battle-control', key);
const click = (button: Element) => (button.props.onClick as () => void)();
function select(tree: ReactNode, path: string, field: string, value: string) {
  const input = find(tree, 'id', `truth-mixed-battle-${path}-${field}`);
  (input.props.onChange as (event: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
}
function amount(tree: ReactNode, path: string, valueAsNumber: number) {
  const input = find(tree, 'id', `truth-mixed-battle-${path}-amount`);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber } });
}
function editFact(tree: ReactNode, path: string, next: TruthFact) {
  const scope = find(tree, 'data-mixed-battle-fact-path', path);
  const fields = elements(scope).find(element => element.type === TruthFactFields);
  assert.ok(fields, `Current fact fields ${path}`);
  (fields.props.onChange as (fact: TruthFact) => void)(next);
}

/** Controlled projections prove fields, private display and callback guards.
 * Source-earned questions, plan legality and reveal lifecycle have native tests. */
function projected(): GameView {
  const source = createGame('TRUTHMIXEDBATTLECONTROLS', newPlayer('p', 'Respondent', 'emperor'), false);
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.turn = 2; game.phase = 6;
  game.allLeaders = [
    { id: 'named-leader', name: 'Named Commander', faction: 'emperor', strength: 3 },
    { id: 'foreign-leader', name: 'Foreign Commander', faction: 'atreides', strength: 5 },
  ];
  game.mixedBattlePromises = [{ event: 'controlled-mixed-battle-question', player: 'p', asker: 'a', turn: 2,
    battle: 'controlled-native-battle', territory: 'arrakeen', mixed: claim(), answer: true, fulfilled: false, released: false }];
  game.battle = { event: 'controlled-native-battle', territory: 'arrakeen', attacker: 'p', defender: 'a', revealed: false,
    submitted: [], plans: {}, truthPromises: [], compliantPlan: plan(), compliantPreparation: null,
  } as unknown as NonNullable<GameView['battle']>;
  return game;
}
function editor(initial: Expression, disabled = false, game = projected(), target = 'p') {
  let value = initial, changes = 0;
  return {
    get value() { return value; }, get changes() { return changes; },
    tree: () => MixedBattleFields({ value, game, target, disabled, onChange(next) { value = next; changes++; } }),
    html: () => renderToStaticMarkup(createElement(MixedBattleFields, { value, game, target, disabled, onChange() {} })),
    error: () => mixedBattleInputError(value, game, target),
  };
}
function assistance(game = projected(), busy = false) {
  const filled: Plan[] = [], sent: Action[] = [];
  const props = { game, busy, fill(value: Plan) { filled.push(value); }, act(value: Action) { sent.push(value); } };
  return { props, filled, sent, tree: () => BattlePromises(props),
    html: () => renderToStaticMarkup(createElement(BattlePromises, props)) };
}
function nativeButton(tree: ReactNode, text: string) {
  const button = elements(tree).find(element => typeof element.props.onClick === 'function' && element.props.children === text);
  assert.ok(button, text); return button;
}
const markup = (game: GameView) => renderToStaticMarkup(createElement(MixedBattlePromises, { game }));

void test('controlled mixed battle editor shares the raw sixteen-node and eight-term budgets across fact and plan groups', () => {
  const full: Expression = { kind: 'and', terms: [fact({ kind: 'or', terms: Array.from({ length: 8 }, (): TruthFact => ({ kind: 'hand', name: 'Shield' })) }),
    { kind: 'or', terms: Array.from({ length: 5 }, (_, index) => dial(index)) }] };
  const e = editor(full);
  assert.deepEqual(mixedActionExpressionSize(e.value), { leaves: 13, nodes: 16, depth: 2, maxTerms: 8 });
  assert.equal(e.error(), null); assert.match(e.html(), /16 \/ 16 total clauses/);
  assert.match(e.html(), /8 conditions per group/);
  for (const key of ['add-fact-1', 'add-action-1', 'nested-and-1', 'and-1.2.1', 'fact-or-1.1.1', 'fact-add-1.1']) {
    assert.equal(control(e.tree(), key).props.disabled, true, key); click(control(e.tree(), key));
  }
  assert.equal(e.changes, 0); assert.deepEqual(e.value, full);
  amount(e.tree(), '1.2.5', 7.5); assert.equal(e.error(), null);
  const ids = [...e.html().matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const wide = editor({ kind: 'and', terms: [fact(), ...Array.from({ length: 7 }, () => dial())] });
  assert.equal(wide.error(), null); assert.equal(mixedActionExpressionSize(wide.value).nodes, 9);
  for (const key of ['add-fact-1', 'add-action-1', 'nested-or-1']) {
    assert.equal(control(wide.tree(), key).props.disabled, true); click(control(wide.tree(), key));
  }
  assert.equal(wide.changes, 0);
  assert.ok(mixedBattleInputError({ kind: 'and', terms: [fact(), ...Array.from({ length: 8 }, () => dial())] }, projected(), 'p'));
  assert.ok(mixedBattleInputError({ kind: 'and', terms: [full, dial()] }, projected(), 'p'));
});

void test('controlled mixed and embedded fact edits preserve branches, collapse removals and stop a fifth grouping level', () => {
  const e = editor({ kind: 'and', terms: [fact(), dial(3)] });
  click(control(e.tree(), 'fact-or-1.1')); editFact(e.tree(), '1.1.2', { kind: 'spice', compare: 'gte', value: 7 });
  select(e.tree(), '1.1', 'fact-meaning', 'and');
  click(control(e.tree(), 'or-1.2')); select(e.tree(), '1.2', 'meaning', 'and');
  select(e.tree(), '1.2.1', 'kind', 'weapon'); select(e.tree(), '1.2.1', 'card', 'Shield');
  assert.equal(e.error(), null);
  click(control(e.tree(), 'remove-1.2.2')); click(control(e.tree(), 'fact-remove-1.1.2'));
  assert.deepEqual(e.value, { kind: 'and', terms: [fact(), action({ kind: 'weapon', name: 'Shield' })] });
  select(e.tree(), '1.2', 'timing', 'fact'); assert.ok(e.error());
  select(e.tree(), '1.2', 'timing', 'action'); assert.equal(e.error(), null);
  let nested = fact();
  for (let depth = 0; depth < 4; depth++) nested = { kind: 'and', terms: [nested, dial()] };
  const deep = editor(nested); assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  for (const key of ['or-1', 'fact-and-1.1.1.1.1', 'nested-and-1.1.1.1']) {
    assert.equal(control(deep.tree(), key).props.disabled, true); click(control(deep.tree(), key));
  }
  assert.equal(deep.changes, 0);
  editFact(deep.tree(), '1.1.1.1.1', { kind: 'hand', name: 'Poison Blade' }); assert.equal(deep.changes, 1);
  assert.ok(mixedBattleInputError({ kind: 'and', terms: [nested, dial()] }, projected(), 'p'));
});

void test('controlled scalar battle drafts remain repairable and reject metadata, grouped actions and invalid native values', () => {
  for (const invalid of [NaN, -1, 0.25, 40.5, Infinity]) {
    const e = editor({ kind: 'and', terms: [fact(), dial()] });
    amount(e.tree(), '1.2', invalid); assert.ok(e.error()); assert.match(e.html(), /role="alert"/);
    click(control(e.tree(), 'or-1.2'));
    assert.deepEqual(e.value, { kind: 'and', terms: [fact(), { kind: 'or', terms: [dial(invalid), fact()] }] });
    amount(e.tree(), '1.2.1', 0.5); assert.equal(e.error(), null);
    select(e.tree(), '1.2.1', 'kind', 'support'); amount(e.tree(), '1.2.1', 0.5); assert.ok(e.error());
    amount(e.tree(), '1.2.1', 1); assert.equal(e.error(), null);
  }
  for (const invalid of [{ kind: 'and', terms: [{ kind: 'dial', compare: 'eq', value: 1 }] },
    { kind: 'dial', compare: 'eq', value: 1, battle: 'other' }, { kind: 'leader', leader: 'unknown' },
    { kind: 'weapon', name: 'Unknown card' }, { kind: 'kwisatz', use: 'yes' }])
    assert.ok(mixedBattleInputError({ kind: 'and', terms: [fact(), { kind: 'action', action: invalid }] }, projected(), 'p'));
  const frozen = editor({ kind: 'and', terms: [fact(), dial()] }, true), before = structuredClone(frozen.value);
  for (const key of ['and-1', 'nested-or-1', 'remove-1.2', 'fact-or-1.1']) click(control(frozen.tree(), key));
  amount(frozen.tree(), '1.2', 3); select(frozen.tree(), '1', 'meaning', 'or'); select(frozen.tree(), '1.2', 'kind', 'leader');
  editFact(frozen.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 4 });
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, before);
});

void test('controlled plan choices use public names and leaders without consulting either hand, affordability or a fixed plan', () => {
  const game = projected();
  for (const player of game.players) for (const key of ['hand', 'leaders', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves', 'tanks', 'elites', 'kwisatz'])
    Object.defineProperty(player, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  for (const key of ['battle', 'deck', 'discard', 'truthMixedBattleAnswers']) Object.defineProperty(game, key, {
    get() { throw Error(`No ${key} inspection`); }, configurable: true,
  });
  const e = editor({ kind: 'and', terms: [fact(), action({ kind: 'leader', leader: 'foreign-leader' })] }, false, game);
  assert.equal(e.error(), null); const html = e.html();
  assert.match(html, /Named Commander/); assert.match(html, /Foreign Commander/); assert.match(html, /Cheap Hero \/ Heroine/);
  assert.match(html, /No leader or hero/); assert.match(html, /actual plan in this battle/);
  assert.match(html, /already fixed, sealed or revealed/); assert.match(html, /No alternate route is forced/);
  select(e.tree(), '1.2', 'leader', CHEAP_HERO_TRAITOR); assert.equal(e.error(), null);
  select(e.tree(), '1.2', 'leader', ''); assert.equal(e.error(), null);
  select(e.tree(), '1.2', 'kind', 'weapon');
  const card = find(e.tree(), 'id', 'truth-mixed-battle-1.2-card');
  assert.deepEqual(elements(card).filter(element => element.type === 'option').map(element => element.props.children), ['Empty slot', ...TRUTH_CARD_NAMES]);
  select(e.tree(), '1.2', 'card', 'Shield'); assert.equal(e.error(), null);
  select(e.tree(), '1.2', 'kind', 'kwisatz'); select(e.tree(), '1.2', 'kwisatz', 'no');
  assert.deepEqual(e.value, { kind: 'and', terms: [fact(), action({ kind: 'kwisatz', use: false })] });
});

void test('controlled mixed battle history shows only own original aggregate answers and remains after the battle', () => {
  const game = projected();
  game.mixedBattlePromises.push(
    { ...game.mixedBattlePromises[0], event: 'no-question', answer: false },
    { ...game.mixedBattlePromises[0], event: 'complete-question', fulfilled: true },
    { ...game.mixedBattlePromises[0], event: 'released-question', released: true },
    { ...game.mixedBattlePromises[0], event: 'foreign-question', player: 'a', mixed: { kind: 'or', terms: [fact({ kind: 'hand', name: 'Poison Blade' }), dial(40)] } },
  );
  for (const promise of game.mixedBattlePromises) for (const key of ['binding', 'frozen', 'residual', 'factAnswers', 'compiled'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  game.battle = null;
  const html = markup(game);
  assert.match(html, /You answered Yes/); assert.match(html, /You answered No/);
  assert.match(html, /you hold Shield/); assert.match(html, / OR /); assert.match(html, / AND /); assert.match(html, /Named Commander/);
  assert.match(html, /Fulfilled: this whole commitment is complete/); assert.match(html, /Released: this whole commitment is no longer possible/);
  assert.match(html, /Only the aggregate answer is shared/); assert.match(html, /No negates the whole expression/);
  assert.match(html, /An open commitment completes when both plans are revealed/);
  assert.match(html, /sealing your own plan does not finish it/); assert.match(html, /No alternate route is forced/);
  assert.doesNotMatch(html, /Poison Blade|controlled-native-battle|controlled-mixed-battle-question|Fill these plan choices|Complete next preparation/);
  assert.equal(MixedBattlePromises({ game: { ...game, me: 'missing' } }), null);
});

void test('controlled mixed-only immediate completion uses the single native Fill control and keeps pure behavior', () => {
  const guide = assistance(), original = guide.props.game.battle!.compliantPlan!;
  const button = nativeButton(guide.tree(), 'Fill these plan choices'); assert.equal(button.props.disabled, false);
  click(button); assert.equal(guide.filled[0], original); assert.equal(guide.sent.length, 0);
  assert.match(guide.html(), /Review a compliant plan/); assert.doesNotMatch(guide.html(), /you hold Shield/);
  guide.props.game.battle!.preparation = { kind: 'voice', owner: 'a', beneficiary: 'p' };
  click(button); assert.equal(guide.filled.length, 2);
  const pure = assistance(); pure.props.game.mixedBattlePromises = [];
  pure.props.game.battle!.truthPromises = [{ player: 'p', asker: 'a', answer: true, claim: { kind: 'dial', compare: 'gte', value: 3 } }];
  click(nativeButton(pure.tree(), 'Fill these plan choices'));
  assert.equal(pure.filled[0], pure.props.game.battle!.compliantPlan); assert.match(pure.html(), /Truthtrance commitments/);
  const noGuide = projected(); noGuide.battle!.compliantPlan = null;
  assert.equal(BattlePromises({ game: noGuide, busy: false, fill() {}, act() {} }), null);
  for (const state of ['sealed', 'revealed', 'fulfilled'] as const) {
    const current = assistance();
    if (state === 'sealed') current.props.game.battle!.submitted.push('p');
    else if (state === 'revealed') current.props.game.battle!.revealed = true;
    else current.props.game.mixedBattlePromises[0].fulfilled = true;
    assert.doesNotMatch(current.html(), /Fill these plan choices/);
  }
});

void test('controlled saved Fill callbacks reject stale owner, source, battle, turn, status, guide and quiet-window state', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.me = 'a'; }, game => { game.turn++; }, game => { game.phase = 5; }, game => { game.status = 'setup'; },
    game => { game.battle!.event = 'later-battle'; }, game => { game.battle!.territory = 'carthag'; },
    game => { game.battle = { ...game.battle! }; }, game => { game.battle!.revealed = true; },
    game => { game.battle!.submitted.push('p'); }, game => { game.mixedBattlePromises[0].fulfilled = true; },
    game => { game.mixedBattlePromises[0].released = true; }, game => { game.mixedBattlePromises[0].player = 'a'; },
    game => { game.mixedBattlePromises[0].event = 'later-question'; }, game => { game.mixedBattlePromises[0].answer = false; },
    game => { game.mixedBattlePromises[0].asker = 'p'; }, game => { game.mixedBattlePromises[0].mixed = claim(); },
    game => { game.mixedBattlePromises.push({ ...game.mixedBattlePromises[0], event: 'another-question' }); },
    game => { game.mixedBattlePromises[0].battle = 'later-battle'; }, game => { game.mixedBattlePromises = []; },
    game => { game.battle!.compliantPlan = plan(); }, game => { game.battle!.compliantPlan!.dial = 4; },
    game => { game.battle!.compliantPreparation = { plan: plan(), actions: [], waitingForIncome: true }; },
    game => { game.players.find(player => player.id === 'p')!.autopilot = 'Easy'; },
    game => { game.truthtrance = { stage: 'ask', queue: [], passed: [], question: null }; },
    game => { game.response = {} as NonNullable<GameView['response']>; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.phaseOpening = {} as NonNullable<GameView['phaseOpening']>; },
    game => { game.automaticContinuationPending = true; },
    game => { game.roomControl = { paused: true } as NonNullable<GameView['roomControl']>; },
    game => { game.roomControl = { closed: true } as NonNullable<GameView['roomControl']>; },
  ];
  for (const change of changes) {
    const guide = assistance(), button = nativeButton(guide.tree(), 'Fill these plan choices');
    change(guide.props.game); click(button); assert.equal(guide.filled.length, 0, change.toString());
  }
  for (const change of [
    (guide: ReturnType<typeof assistance>) => { guide.props.busy = true; },
    (guide: ReturnType<typeof assistance>) => { guide.props.game = projected(); },
    (guide: ReturnType<typeof assistance>) => { guide.props.fill = () => assert.fail('Do not use a replaced Fill callback'); },
  ]) {
    const guide = assistance(), button = nativeButton(guide.tree(), 'Fill these plan choices');
    change(guide); click(button); assert.equal(guide.filled.length, 0);
  }
});

void test('controlled native preparation forwards the exact first card action and guards current preparation without auto-sealing', () => {
  function preparationGuide() {
    const guide = assistance(), battle = guide.props.game.battle!;
    battle.compliantPlan = null;
    battle.compliantPreparation = { plan: plan(), actions: [{ type: 'card', card: 'controlled-ghola', leader: 'named-leader' }], waitingForIncome: false };
    return guide;
  }
  const guide = preparationGuide(), original = guide.props.game.battle!.compliantPreparation!.actions[0];
  const button = nativeButton(guide.tree(), 'Complete next preparation'); assert.equal(button.props.disabled, false);
  click(button); assert.equal(guide.sent[0], original); assert.equal(guide.filled.length, 0);
  assert.doesNotMatch(guide.html(), /Fill these plan choices/); assert.match(guide.html(), /Play Ghola to revive Named Commander/);
  for (const change of [
    (game: GameView) => { game.battle!.compliantPreparation = { ...game.battle!.compliantPreparation! }; },
    (game: GameView) => { game.battle!.compliantPreparation!.actions[0] = { ...original }; },
    (game: GameView) => { game.battle!.compliantPreparation!.actions[0].card = 'other-card'; },
    (game: GameView) => { game.battle!.submitted.push('p'); },
    (game: GameView) => { game.mixedBattlePromises[0].fulfilled = true; },
  ]) {
    const fresh = preparationGuide(), saved = nativeButton(fresh.tree(), 'Complete next preparation');
    change(fresh.props.game); click(saved); assert.equal(fresh.sent.length, 0);
  }
  const waiting = preparationGuide(); waiting.props.game.battle!.compliantPreparation = { plan: plan(), actions: [], waitingForIncome: true };
  assert.match(waiting.html(), /Revival income must resolve/);
  assert.doesNotMatch(waiting.html(), /Complete next preparation|Fill these plan choices/);
});

void test('controlled original private preparation remains usable without pure or mixed Truthtrance records', () => {
  const game = projected(); game.mixedBattlePromises = [];
  const battle = game.battle!; battle.truthPromises = []; battle.compliantPlan = null;
  const next: Action = { type: 'card', card: 'controlled-original-ghola', leader: 'named-leader' };
  battle.compliantPreparation = { plan: plan(), actions: [next], waitingForIncome: false };
  const guide = assistance(game), button = nativeButton(guide.tree(), 'Complete next preparation');
  assert.equal(button.props.disabled, false); click(button);
  assert.equal(guide.sent[0], next); assert.equal(guide.filled.length, 0);
  assert.match(guide.html(), /Preparation · private/); assert.doesNotMatch(guide.html(), /Fill these plan choices/);
});
