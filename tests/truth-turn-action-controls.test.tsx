import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TurnActionFields, turnActionInputError } from '../components/turn-action-fields';
import { TurnActionAnswers, TurnActionGuideButton, TurnActionPromises } from '../components/turn-action-promises';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { BattleClaimFields } from '../components/battle-promises';
import { baseDeck } from '../game/cards';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView, type Plan } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { MixedBattleActionClaim } from '../game/mixed-battle-question';
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
const bid = (minimum = 3, lot = 2): Expression => ({ kind: 'action', action: { kind: 'bid', lot, minimum } });
const forceRevival = (counter: 'total' | 'normal' | 'elite' = 'total', minimum = 1): Expression =>
  ({ kind: 'action', action: { kind: 'forces', counter, minimum } });
const leaderRevival = (leader: string): Expression => ({ kind: 'action', action: { kind: 'leader', leader } });
const finalAlliance = (partner = 'r'): Expression => ({ kind: 'action', action: { kind: 'alliance', partner } });
const printedCard = (effect: 'hajr' | 'ghola' = 'hajr'): Expression => ({ kind: 'action', action: { kind: 'cardPlay', effect } });
const planClaim = (claim: MixedBattleActionClaim = { kind: 'dial', compare: 'eq', value: 3 }): Expression =>
  ({ kind: 'action', action: { kind: 'battlePlan', battle: 'controlled-native-battle', territory: 'arrakeen', claim } });
const traitorClaim = (call = true): Expression =>
  ({ kind: 'action', action: { kind: 'traitorCall', battle: 'controlled-native-battle', territory: 'arrakeen', call } });
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
  if (next.type === 'card' && typeof next.card === 'string') {
    const effect = next.card.includes('hajr') ? 'hajr' : next.card.includes('ghola') ? 'ghola' : 'karama';
    const face = baseDeck().find(card => card.effect === effect); assert.ok(face);
    const me = game.players.find(player => player.id === 'p')!;
    me.hand = [{ ...face, id: next.card }]; me.hajrAvailable = effect === 'hajr';
    if (effect === 'ghola') {
      me.tanks = 5; me.elites = { reserves: 4, tanks: 1, forces: {}, revived: 0 };
      game.ghola = { cards: [next.card], leaders: [{ id: 'controlled-dead-leader', name: 'Returned Commander', strength: 3 }],
        kwisatz: false, maxForces: 5, eliteRemaining: 1, eliteBlock: null, available: true, reason: null };
    }
  }
  return game;
}
function auction(next: Action = { type: 'passBid' }): GameView {
  const game = projected(3, next);
  game.bidPromiseLot = { turn: 2, lot: 2 };
  game.auction = { bid: 7, bidder: next.type === 'decision' ? 'p' : 'a', active: 'p', remaining: 2, inspectionBlocked: null, card: null };
  if (next.type === 'decision') { game.auction.active = 'a'; game.decision = { kind: 'auctionPayment', player: 'p' }; }
  return game;
}
function nexus(next: Action = { type: 'alliance', target: 'r' }): GameView {
  const game = projected(1, next);
  game.nexus = true; game.spiceWindow = null; game.active = 'a';
  game.alliancePromiseNexus = { turn: 2 }; game.truthMixedAllianceTargets = ['p', 'a', 'r'];
  game.allianceOffers = { r: 'p' };
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [finalAlliance(), payment()] };
  return game;
}
function combat(revealed = false, next: Action = { type: 'battlePlan', dial: 3, support: 2, bankerSpice: 1, allyPayment: 1,
  leader: 'controlled-leader', weapon: 'controlled-weapon', defense: 'controlled-defense', kwisatz: true,
  planetologistSpecial: true, reinforcementsSources: { arrakeen: { normal: 1, elite: 0 } } }): GameView {
  const game = projected(6, next);
  game.battle = { event: 'controlled-native-battle', territory: 'arrakeen', attacker: 'p', defender: 'a', revealed,
    submitted: [], traitorVoters: ['p', 'a'], traitorSubmitted: [], plans: {}, truthPromises: [],
  } as unknown as NonNullable<GameView['battle']>;
  game.truthMixedBattleTargets = ['p', 'a']; game.truthMixedTraitorTargets = revealed ? ['p', 'a'] : [];
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [revealed ? traitorClaim() : planClaim(), payment()] };
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
function editPlan(tree: ReactNode, path: string, claim: MixedBattleActionClaim) {
  const fields = elements(find(tree, 'data-turn-action-plan-fields', `truth-turn-action-${path}`))
    .find(element => element.type === BattleClaimFields); assert.ok(fields);
  (fields.props.onChange as (claim: MixedBattleActionClaim) => void)(claim);
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
  const game = auction(), e = editor({ kind: 'or', terms: [payment(), physical('move', 4)] }, false, game);
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-action-1')); minimum(e.tree(), `1.${count}`, count);
    if (count % 4 === 0) select(e.tree(), `1.${count}`, 'action', 'forces');
    if (count % 4 === 1) select(e.tree(), `1.${count}`, 'action', 'leader');
    if (count % 4 === 2) select(e.tree(), `1.${count}`, 'action', 'bid');
  }
  assert.equal(e.error(), null); assert.match(e.html(), /16 \/ 16 conditions/);
  const full = structuredClone(e.value), changes = e.changes;
  for (const key of ['add-action-1', 'add-fact-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.deepEqual(e.value, full); assert.equal(e.changes, changes);
  const deep = editor({ kind: 'and', terms: [fact(), forceRevival()] });
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  assert.equal(control(deep.tree(), 'and-1.2.1.1.1').props.disabled, true);
  editFact(deep.tree(), '1.1', { kind: 'spice', compare: 'gte', value: 3 }); assert.equal(deep.error(), null);
  click(control(deep.tree(), 'remove-1.2.1.1.2')); assert.match(deep.html(), /3 \/ 4 levels of grouping/);
});

void test('turn-action inputs keep invalid drafts repairable and reject disabled callbacks', () => {
  for (const expression of [physical(), payment(), forceRevival()]) {
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

void test('turn-action bid leaves use only the current public ordinary lot and retain repairable drafts', () => {
  const game = auction(), e = editor(payment(), false, game);
  Object.defineProperty(game.auction!, 'card', { get() { throw Error('No hidden lot face inspection'); }, configurable: true });
  select(e.tree(), '1', 'action', 'bid'); assert.deepEqual(e.value, bid()); assert.equal(e.error(), null);
  assert.match(e.html(), /Turn 2 · Ordinary lot 2/);
  for (const invalid of [NaN, 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    minimum(e.tree(), '1', invalid); assert.ok(e.error()); minimum(e.tree(), '1', 3); assert.equal(e.error(), null);
  }
  minimum(e.tree(), '1', Number.MAX_SAFE_INTEGER); assert.equal(e.error(), null);
  select(e.tree(), '1', 'lot', ''); assert.ok(e.error()); assert.deepEqual(e.value, bid(Number.MAX_SAFE_INTEGER, NaN));
  select(e.tree(), '1', 'lot', '999'); assert.deepEqual(e.value, bid(Number.MAX_SAFE_INTEGER, NaN));
  select(e.tree(), '1', 'lot', '2'); assert.equal(e.error(), null);
  game.bidPromiseLot = { turn: 2, lot: 3 }; assert.ok(e.error()); assert.match(e.html(), /aria-invalid="true"/);
  assert.deepEqual(elements(find(e.tree(), 'id', 'truth-turn-action-1-lot')).filter(element => element.type === 'option')
    .map(element => element.props.value), ['', 3]);
  select(e.tree(), '1', 'lot', '3'); assert.equal(e.error(), null);
  game.bidPromiseLot = { turn: 1, lot: 3 }; assert.ok(e.error()); assert.match(e.html(), /No public ordinary lot is currently available/);
  game.bidPromiseLot = null; assert.ok(e.error()); select(e.tree(), '1', 'action', 'forces');
  minimum(e.tree(), '1', 2); assert.equal(e.error(), null);
});

void test('turn-action Revival leaves use public faction names and physical counters without casualties, custody or private preparation', () => {
  const game = auction(); game.advanced = true; game.players.find(player => player.id === 'p')!.faction = 'atreides';
  const ownLeader = game.allLeaders.find(leader => leader.faction === 'atreides'); assert.ok(ownLeader);
  const foreignLeader = game.allLeaders.find(leader => leader.faction === 'emperor'); assert.ok(foreignLeader);
  for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves', 'leaders', 'tanks', 'capturedLeaders'])
    Object.defineProperty(player, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  Object.defineProperty(game, 'revival', { get() { throw Error('No private Revival eligibility inspection'); }, configurable: true });
  const e = editor(forceRevival('total', 20), false, game); assert.equal(e.error(), null);
  select(e.tree(), '1', 'counter', 'normal'); assert.deepEqual(e.value, forceRevival('normal', 20));
  select(e.tree(), '1', 'counter', 'elite'); assert.deepEqual(e.value, forceRevival('elite', 20));
  minimum(e.tree(), '1', 21); assert.ok(e.error()); minimum(e.tree(), '1', 1); assert.equal(e.error(), null);
  select(e.tree(), '1', 'action', 'leader'); assert.deepEqual(e.value, leaderRevival(ownLeader.id));
  const choices = elements(find(e.tree(), 'id', 'truth-turn-action-1-leader')).filter(element => element.type === 'option')
    .map(element => element.props.value);
  assert.ok(choices.includes('kwisatz')); assert.ok(choices.includes(ownLeader.id)); assert.ok(!choices.includes(foreignLeader.id));
  select(e.tree(), '1', 'leader', foreignLeader.id); assert.deepEqual(e.value, leaderRevival(ownLeader.id));
  assert.ok(turnActionInputError(leaderRevival(foreignLeader.id), game, 'p'));
  select(e.tree(), '1', 'leader', ''); assert.ok(e.error()); select(e.tree(), '1', 'leader', 'kwisatz'); assert.equal(e.error(), null);
  assert.match(e.html(), /Kwisatz Haderach/); game.advanced = false; assert.ok(e.error());
  select(e.tree(), '1', 'leader', ownLeader.id); assert.equal(e.error(), null);
  for (const initial of [bid(), forceRevival(), leaderRevival(ownLeader.id)]) {
    const frozen = editor(initial, true, game), original = structuredClone(frozen.value);
    select(frozen.tree(), '1', 'action', 'payment');
    if (initial.kind === 'action' && initial.action.kind === 'bid') { select(frozen.tree(), '1', 'lot', ''); minimum(frozen.tree(), '1', 7); }
    if (initial.kind === 'action' && initial.action.kind === 'forces') { select(frozen.tree(), '1', 'counter', 'elite'); minimum(frozen.tree(), '1', 7); }
    if (initial.kind === 'action' && initial.action.kind === 'leader') select(frozen.tree(), '1', 'leader', '');
    assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, original);
  }
});

void test('turn-action preparation history and guides use original public leaves without reading private stage progress', () => {
  const game = auction({ type: 'bid', amount: 8, allyPayment: 0 }), named = game.allLeaders.find(leader => leader.faction === 'emperor');
  assert.ok(named);
  game.turnActionPromises[0].mixed = { kind: 'and', terms: [bid(8), forceRevival('elite', 2), leaderRevival(named.id), payment(), physical(), fact()] };
  for (const key of ['preparation', 'compiled', 'progress', 'payments'])
    Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  assert.match(html, /ordinary lot 2/); assert.match(html, /8 spice/); assert.match(html, /elite forces/); assert.match(html, new RegExp(named.name));
  assert.match(html, /Bid conditions close with their named ordinary lot/); assert.match(html, /Revival conditions close with your native Revival opportunity/);
  assert.doesNotMatch(html, /compiled|bidProgress|revivalProgress/);
  const sent: Action[] = []; press(guide({ game, busy: false, act(value) { sent.push(value); } }));
  assert.equal(sent[0], game.turnActionGuide!.action);
  const answerGame = answering(3); answerGame.truthtrance!.question = { kind: 'turnActions', target: 'p', turn: 2, mixed: game.turnActionPromises[0].mixed };
  const answerMarkup = renderToStaticMarkup(createElement(TurnActionAnswers, { game: answerGame, busy: false, act() {} }));
  assert.match(answerMarkup, /ordinary force returns add together/); assert.match(answerMarkup, /Bids close with their lot/);
});

void test('turn-action alliance fields offer every public other partner including the current ally only in the open native Nexus', () => {
  const game = nexus(); game.players.find(player => player.id === 'p')!.ally = 'r'; game.players.find(player => player.id === 'r')!.ally = 'p';
  for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves', 'leaders', 'tanks'])
    Object.defineProperty(player, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  Object.defineProperty(game.turnActionPromises[0], 'alliance', { get() { throw Error('No private alliance binding'); } });
  const e = editor(physical(), false, game);
  select(e.tree(), '1', 'action', 'alliance'); assert.deepEqual(e.value, finalAlliance('')); assert.ok(e.error());
  const options = elements(find(e.tree(), 'id', 'truth-turn-action-1-partner')).filter(element => element.type === 'option');
  assert.deepEqual(options.map(option => option.props.value), ['', 'a', 'r']);
  select(e.tree(), '1', 'partner', 'r'); assert.equal(e.error(), null); assert.deepEqual(e.value, finalAlliance());
  select(e.tree(), '1', 'partner', 'p'); select(e.tree(), '1', 'partner', 'missing'); assert.deepEqual(e.value, finalAlliance());
  for (const partner of ['', 'p', 'missing', ' r ']) assert.ok(turnActionInputError(finalAlliance(partner), game, 'p'));
  select(e.tree(), '1', 'partner', ''); assert.ok(e.error()); select(e.tree(), '1', 'partner', 'a'); assert.equal(e.error(), null);
  assert.match(e.html(), /actual final membership when this current Nexus closes/);
  assert.match(e.html(), /No can allow temporary membership followed by a break/);
  const frozen = editor(finalAlliance(), true, game); select(frozen.tree(), '1', 'partner', 'a'); select(frozen.tree(), '1', 'action', 'payment');
  assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, finalAlliance());
  for (const change of [
    (current: GameView) => { current.status = 'setup'; }, (current: GameView) => { current.phase = 2; },
    (current: GameView) => { current.nexus = false; },
    (current: GameView) => { current.spiceWindow = { territory: 'hagga_basin', sector: 12, amount: 6, harvested: false }; },
    (current: GameView) => { current.alliancePromiseNexus = null; }, (current: GameView) => { current.alliancePromiseNexus!.turn = 1; },
    (current: GameView) => { current.truthMixedAllianceTargets = []; },
    (current: GameView) => { current.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    (current: GameView) => { current.decision = { kind: 'auctionPayment', player: 'p' }; },
    (current: GameView) => { current.phaseOpening = { passed: [] }; },
    (current: GameView) => { current.automaticContinuationPending = true; },
  ]) {
    const current = nexus(); change(current); const invalid = editor(finalAlliance(), false, current);
    assert.ok(invalid.error()); assert.match(invalid.html(), /Alliance conditions require the current open Nexus/);
  }
});

void test('turn-action alliance leaves retain the complete sixteen-clause and four-level optional-fact expression', () => {
  const game = nexus(), e = editor({ kind: 'or', terms: [finalAlliance(), fact()] }, false, game);
  for (let count = 3; count <= 16; count++) {
    click(control(e.tree(), 'add-action-1')); select(e.tree(), `1.${count}`, 'action', 'alliance');
    select(e.tree(), `1.${count}`, 'partner', count % 2 ? 'a' : 'r');
  }
  assert.equal(e.error(), null); assert.match(e.html(), /16 \/ 16 conditions/);
  const full = structuredClone(e.value), changes = e.changes;
  for (const key of ['add-action-1', 'add-fact-1', 'nested-and-1', 'nested-or-1', 'and-1.1', 'or-1']) {
    assert.equal(control(e.tree(), key).props.disabled, true); click(control(e.tree(), key));
  }
  assert.deepEqual(e.value, full); assert.equal(e.changes, changes);
  const deep = editor({ kind: 'and', terms: [fact(), finalAlliance()] }, false, game);
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.match(deep.html(), /4 \/ 4 levels of grouping/); assert.equal(deep.error(), null);
  assert.equal(control(deep.tree(), 'and-1.2.1.1.1').props.disabled, true);
});

void test('turn-action Nexus guide forwards only exact breaks, withdrawals, reciprocal acceptances and Ready without private alliance reads', () => {
  for (const advanced of [false, true]) for (const kind of ['accept', 'break', 'withdraw', 'ready'] as const) {
    const game = nexus(kind === 'ready' ? { type: 'ready' } : { type: 'alliance', target: kind === 'accept' ? 'r' : null });
    game.advanced = advanced;
    if (kind === 'break') { game.players.find(player => player.id === 'p')!.ally = 'r'; game.players.find(player => player.id === 'r')!.ally = 'p'; }
    if (kind === 'withdraw') game.allianceOffers = { p: 'r' };
    if (kind === 'ready') {
      game.players.find(player => player.id === 'p')!.ally = 'r'; game.players.find(player => player.id === 'r')!.ally = 'p';
      game.turnActionPromises[0].mixed = { kind: 'and', terms: [finalAlliance(), payment()] }; game.turnActionPromises[0].answer = false;
    }
    for (const key of ['alliance', 'compiled', 'preparation', 'progress', 'payments'])
      Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
    for (const player of game.players) for (const key of ['hand', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves'])
      Object.defineProperty(player, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
    const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.equal(game.turnActionPromises[0].fulfilled, false, 'A guide dispatch does not announce final Nexus fulfillment.');
    const html = markup(game);
    assert.match(html, kind === 'accept' ? /Accept Recipient’s alliance invitation/ : kind === 'break' ? /Break your current alliance/
      : kind === 'withdraw' ? /Withdraw your alliance offer/ : /Confirm Ready for this Nexus/);
    assert.match(html, /forming an alliance does not fulfill it early/);
    assert.doesNotMatch(html, /Fulfilled: this whole commitment is complete/);
  }
  const invalid = [nexus(), nexus(), nexus(), nexus()];
  invalid[0].allianceOffers = {};
  invalid[1].turnActionGuide!.action.target = 'p';
  invalid[2].turnActionGuide!.action.target = 'missing';
  invalid[3].players.find(player => player.id === 'r')!.ally = 'a';
  for (const game of invalid) {
    const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, true); press(button); assert.deepEqual(sent, []);
  }
});

void test('turn-action Nexus callbacks expire with public consent, membership, readiness, source and quiet-window changes', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.nexus = false; }, game => { game.phase = 2; }, game => { game.turn = 3; }, game => { game.me = 'a'; },
    game => { game.spiceWindow = { territory: 'hagga_basin', sector: 12, amount: 6, harvested: false }; },
    game => { game.alliancePromiseNexus = null; }, game => { game.alliancePromiseNexus = { turn: 2 }; },
    game => { game.alliancePromiseNexus!.turn = 1; }, game => { game.allianceOffers = {}; }, game => { game.allianceOffers.a = 'p'; },
    game => { game.ready.push('p'); }, game => { game.ready.push('a'); },
    game => { game.players.find(player => player.id === 'p')!.ally = 'a'; }, game => { game.players.find(player => player.id === 'a')!.ally = 'r'; },
    game => { game.players = game.players.filter(player => player.id !== 'r'); },
    game => { game.turnActionGuide = { ...game.turnActionGuide! }; }, game => { game.turnActionGuide!.action = { ...game.turnActionGuide!.action }; },
    game => { game.turnActionGuide!.action.turnActionPromisePhase = 2; }, game => { game.turnActionGuide!.action.turnActionPromiseEvent = 'stale'; },
    game => { game.turnActionPromises[0].event = 'stale'; }, game => { game.turnActionPromises[0].fulfilled = true; },
    game => { game.truthtrance = answering(1).truthtrance; }, game => { game.phaseOpening = { passed: [] }; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; }, game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.automaticContinuationPending = true; }, game => { game.roomControl = { paused: true, joinLocked: false, revision: 1, updatedAt: null }; },
  ];
  for (const action of [{ type: 'alliance', target: 'r' }, { type: 'ready' }] satisfies Action[]) for (const change of changes) {
    const game = nexus(action), sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
    assert.equal(button.props.disabled, false); change(game); press(button); assert.deepEqual(sent, []);
  }
  const busy = { game: nexus(), busy: false, act() { assert.fail('Busy Nexus guide cannot send'); } };
  const button = guide(busy); busy.busy = true; press(button);
  const replaced = { game: nexus(), busy: false, act() { assert.fail('Replaced Nexus view cannot send'); } };
  const old = guide(replaced); replaced.game = { ...replaced.game }; press(old);
  const source = nexus({ type: 'ready' }); source.nexus = false;
  const retained = guide({ game: source, busy: false, act() { assert.fail('A closed rendered Nexus cannot become a fresh opportunity'); } });
  source.nexus = true; press(retained);
});

void test('turn-action current battle editor reuses atomic plan fields and public declaration sources within the global logical budget', () => {
  const game = combat(), e = editor(physical(), false, game);
  for (const player of game.players) for (const key of ['hand', 'leaders', 'traitors', 'faceDancers', 'spice', 'forces', 'reserves', 'tanks'])
    Object.defineProperty(player, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  for (const key of ['plans', 'cards', 'ownForces', 'compliantPlan', 'compliantPreparation'])
    Object.defineProperty(game.battle!, key, { get() { throw Error(`No private battle ${key} inspection`); }, configurable: true });
  select(e.tree(), '1', 'action', 'battlePlan'); editPlan(e.tree(), '1', { kind: 'dial', compare: 'eq', value: 3 });
  assert.deepEqual(e.value, planClaim()); assert.equal(e.error(), null);
  for (const invalid of [NaN, -1, 0.25, Infinity, 40.5]) {
    editPlan(e.tree(), '1', { kind: 'dial', compare: 'eq', value: invalid }); assert.ok(e.error());
    editPlan(e.tree(), '1', { kind: 'dial', compare: 'gte', value: 0.5 }); assert.equal(e.error(), null);
  }
  const foreign = game.allLeaders.find(leader => leader.faction === 'atreides'); assert.ok(foreign);
  editPlan(e.tree(), '1', { kind: 'leader', leader: foreign.id }); assert.equal(e.error(), null);
  assert.match(e.html(), /Cheap Hero \/ Heroine/);
  editPlan(e.tree(), '1', { kind: 'weapon', name: 'Shield' }); assert.equal(e.error(), null);
  assert.match(e.html(), /already sealed or revealed/);
  game.battle!.event = 'later-native-battle'; assert.ok(e.error()); select(e.tree(), '1', 'battle', 'later-native-battle'); assert.equal(e.error(), null);
  game.battle!.revealed = true; assert.equal(e.error(), null, 'A publicly fixed plan remains a valid question source.');
  select(e.tree(), '1', 'action', 'traitorCall'); assert.ok(e.error()); game.truthMixedTraitorTargets = ['p', 'a'];
  select(e.tree(), '1', 'call', 'decline'); assert.equal(e.error(), null);
  game.battle!.traitorSubmitted.push('p'); assert.ok(e.error());
  const frozen = editor(planClaim(), true, combat()); editPlan(frozen.tree(), '1', { kind: 'support', compare: 'eq', value: 7 });
  select(frozen.tree(), '1', 'battle', ''); assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, planClaim());
  const fullGame = combat(), full = editor({ kind: 'or', terms: [planClaim(), fact()] }, false, fullGame);
  for (let count = 3; count <= 16; count++) { click(control(full.tree(), 'add-action-1')); select(full.tree(), `1.${count}`, 'action', 'battlePlan'); }
  assert.equal(full.error(), null); assert.match(full.html(), /16 \/ 16 conditions/);
  assert.doesNotMatch(full.html(), /truth-battle-plan-expression/);
  assert.equal(control(full.tree(), 'add-action-1').props.disabled, true);
  const deep = editor({ kind: 'and', terms: [fact(), planClaim()] }, false, fullGame);
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
});

void test('turn-action battle-plan guide fills the exact native packet for human review and never seals automatically', () => {
  const game = combat(), filled: Plan[] = [], sent: Action[] = [];
  for (const key of ['combat', 'compiled', 'preparation'])
    Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  for (const key of ['plans', 'ownForces', 'compliantPlan', 'compliantPreparation'])
    Object.defineProperty(game.battle!, key, { get() { throw Error(`No private battle ${key} inspection`); }, configurable: true });
  const props = { game, busy: false, fillPlan(plan: Plan) { filled.push(plan); }, act(action: Action) { sent.push(action); } };
  const button = guide(props); assert.equal(button.props.disabled, false); press(button);
  assert.equal(filled[0], game.turnActionGuide!.action); assert.deepEqual(sent, []);
  assert.equal(filled[0].dial, 3); assert.equal(filled[0].support, 2); assert.equal(filled[0].allyPayment, 1);
  assert.equal(filled[0].bankerSpice, 1); assert.equal(filled[0].weapon, 'controlled-weapon'); assert.equal(filled[0].defense, 'controlled-defense');
  assert.deepEqual(filled[0].reinforcementsSources, { arrakeen: { normal: 1, elite: 0 } });
  assert.equal(filled[0].kwisatz, true); assert.equal(filled[0].planetologistSpecial, true);
  assert.equal((filled[0] as Plan & Action).turnActionPromiseEvent, event);
  assert.match(renderToStaticMarkup(createElement(TurnActionPromises, props)), /Fill the quoted battle plan for review before sealing/);
  const noFill = guide({ game, busy: false, act() { assert.fail('A human plan guide cannot auto seal without a fill callback'); } });
  assert.equal(noFill.props.disabled, true); press(noFill);
  props.fillPlan = () => assert.fail('A replaced fill callback cannot receive a saved plan'); press(button); assert.equal(filled.length, 1);
  const preparation = combat(false, { type: 'card', card: 'controlled-ghola', leader: 'controlled-dead-leader' }), prepared: Action[] = [];
  press(guide({ game: preparation, busy: false, act(action) { prepared.push(action); } }));
  assert.equal(prepared[0], preparation.turnActionGuide!.action);
  const declaration = combat(true, { type: 'traitorCall', call: false }), declared: Action[] = [];
  declaration.battle!.attacker = 'r'; declaration.battle!.traitorVoters = ['p'];
  press(guide({ game: declaration, busy: false, act(action) { declared.push(action); } }));
  assert.equal(declared[0], declaration.turnActionGuide!.action, 'A native allied voter retains their own declaration packet.');
});

void test('turn-action combat callbacks retain current battle ownership and raw history without private stage reconstruction', () => {
  const cases: [() => GameView, ((game: GameView) => void)[]][] = [
    [() => combat(), [game => { game.battle!.submitted.push('p'); }, game => { game.battle!.revealed = true; }, game => { game.battle!.attacker = 'r'; }]],
    [() => combat(true, { type: 'traitorCall', call: true }), [game => { game.battle!.traitorSubmitted.push('p'); },
      game => { game.battle!.revealed = false; }, game => { game.battle!.traitorVoters = ['a']; }]],
  ];
  for (const [build, specific] of cases) for (const change of [...specific,
    (game: GameView) => { game.battle = { ...game.battle! }; }, (game: GameView) => { game.battle!.event = 'later-battle'; },
    (game: GameView) => { game.battle!.territory = 'carthag'; }, (game: GameView) => { game.phase = 5; },
    (game: GameView) => { game.truthtrance = answering(6).truthtrance; },
  ]) {
    const game = build(), button = guide({ game, busy: false, fillPlan() { assert.fail('Stale battle cannot fill'); }, act() { assert.fail('Stale battle cannot send'); } });
    assert.equal(button.props.disabled, false); change(game); press(button);
  }
  const game = combat(); game.turnActionGuide = null; game.battle = null;
  for (const key of ['combat', 'compiled', 'binding', 'preparation'])
    Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  assert.match(html, /sealing your own plan does not finish it/); assert.match(html, /original Reveal or decline declaration/);
  assert.match(html, /You answered Yes/); assert.doesNotMatch(html, /controlled-native-battle|Fill the quoted battle plan|compiled/);
});

void test('turn-action printed-role editor uses public names without holdings or private stages and retains the shared logical budget', () => {
  const game = projected();
  for (const player of game.players) for (const key of ['hand', 'spice', 'traitors', 'faceDancers', 'tanks', 'leaders', 'hajrAvailable'])
    Object.defineProperty(player, key, { get() { throw Error(`No private ${key} authoring inspection`); }, configurable: true });
  Object.defineProperty(game, 'ghola', { get() { throw Error('No private Ghola authoring inspection'); }, configurable: true });
  Object.defineProperty(game.turnActionPromises[0], 'cardPlays', { get() { throw Error('No private card-play stage'); } });
  const e = editor(physical(), false, game); select(e.tree(), '1', 'action', 'cardPlay');
  assert.deepEqual(e.value, printedCard()); assert.equal(e.error(), null);
  const choices = elements(find(e.tree(), 'id', 'truth-turn-action-1-effect')).filter(element => element.type === 'option');
  assert.deepEqual(choices.map(choice => choice.props.value), ['hajr', 'ghola']);
  select(e.tree(), '1', 'effect', 'ghola'); assert.deepEqual(e.value, printedCard('ghola')); assert.equal(e.error(), null);
  select(e.tree(), '1', 'effect', 'karama'); assert.deepEqual(e.value, printedCard('ghola'));
  assert.ok(turnActionInputError({ kind: 'action', action: { kind: 'cardPlay', effect: 'ghola', card: 'private-card-id' } }, game, 'p'));
  assert.ok(turnActionInputError({ kind: 'action', action: { kind: 'cardPlay', effect: 'karama' } }, game, 'p'));
  const html = e.html(); assert.match(html, /Play Hajr in its printed role after this answer this turn/);
  assert.match(html, /Play Tleilaxu Ghola in its printed role after this answer this turn/);
  assert.match(html, /Hajr counts when played even if its extra movement is unused/);
  assert.match(html, /an actual later replay after Box recovery does/); assert.doesNotMatch(html, /private-card-id|controlled-ghola|controlled-hajr/);
  const full = editor({ kind: 'or', terms: [printedCard(), printedCard('ghola')] }, false, game);
  for (let count = 3; count <= 16; count++) { click(control(full.tree(), 'add-action-1')); select(full.tree(), `1.${count}`, 'action', 'cardPlay'); }
  assert.equal(full.error(), null); assert.match(full.html(), /16 \/ 16 conditions/);
  assert.equal(control(full.tree(), 'add-action-1').props.disabled, true);
  const deep = editor({ kind: 'and', terms: [fact(), printedCard('ghola')] }, false, game);
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  const frozen = editor(printedCard(), true, game); select(frozen.tree(), '1', 'effect', 'ghola');
  select(frozen.tree(), '1', 'action', 'payment'); assert.equal(frozen.changes, 0); assert.deepEqual(frozen.value, printedCard());
});

void test('printed Ghola guides forward exact native force, leader and KH choices out of turn and reject unavailable or forged choices', () => {
  for (let phase = 0; phase <= 8; phase++) {
    const game = projected(phase, { type: 'card', card: 'controlled-ghola', amount: 3, elite: 1 }); game.active = 'a'; game.advanced = true;
    game.turnActionPromises[0].mixed = printedCard('ghola');
    Object.defineProperty(game.turnActionPromises[0], 'cardPlays', { get() { throw Error('No private Ghola stage inspection'); } });
    const sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.match(markup(game), /Play Tleilaxu Ghola to return 3 physical forces/);
  }
  for (const leader of ['controlled-dead-leader', 'kwisatz']) {
    const game = projected(7, { type: 'card', card: 'controlled-ghola', leader }); game.active = 'a';
    if (leader === 'kwisatz') { game.advanced = true; game.players.find(player => player.id === 'p')!.faction = 'atreides'; game.ghola.kwisatz = true; }
    const sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.match(markup(game), leader === 'kwisatz' ? /return Kwisatz Haderach/ : /return Returned Commander/);
    if (leader === 'kwisatz') game.ghola.kwisatz = false; else game.ghola.leaders = [];
    press(button); assert.equal(sent.length, 1);
  }
  for (const change of [
    (game: GameView) => { game.ghola = { ...game.ghola }; }, (game: GameView) => { game.ghola.available = false; },
    (game: GameView) => { game.ghola.cards = []; }, (game: GameView) => { game.ghola.maxForces = 0; },
    (game: GameView) => { game.ghola.eliteRemaining = 0; }, (game: GameView) => { game.players.find(player => player.id === 'p')!.hand = []; },
    (game: GameView) => { game.phase = 7; }, (game: GameView) => { game.truthtrance = answering(2).truthtrance; },
  ]) {
    const game = projected(2, { type: 'card', card: 'controlled-ghola', amount: 3, elite: 1 }), sent: Action[] = [];
    const button = guide({ game, busy: false, act(action) { sent.push(action); } }); assert.equal(button.props.disabled, false);
    change(game); press(button); assert.deepEqual(sent, []);
  }
  for (const malformed of [
    { card: 'missing-ghola' }, { amount: 0 }, { amount: 6 }, { amount: 1.5 }, { amount: 3, elite: 2 }, { amount: 3, elite: -1 },
    { amount: 5, elite: 0 }, { leader: 'foreign-living-leader' }, { mode: 'shipment' },
  ]) {
    const game = projected(2, { type: 'card', card: 'controlled-ghola', amount: 3, elite: 1 });
    Object.assign(game.turnActionGuide!.action, malformed);
    const sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, true); press(button); assert.deepEqual(sent, []);
  }
});

void test('printed Hajr guides require the actual held card and current own immediate Movement opportunity', () => {
  for (const advanced of [false, true]) {
    const game = projected(5, { type: 'card', card: 'controlled-hajr' }); game.advanced = advanced;
    game.turnActionPromises[0].mixed = printedCard();
    Object.defineProperty(game.turnActionPromises[0], 'cardPlays', { get() { throw Error('No private Hajr stage inspection'); } });
    const sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.match(markup(game), /Play Hajr in its printed role while honoring your whole answer/);
  }
  for (const change of [
    (game: GameView) => { game.players.find(player => player.id === 'p')!.hajrAvailable = false; },
    (game: GameView) => { const player = game.players.find(player => player.id === 'p')!; player.moved = (player.moved ?? 0) + 1; },
    (game: GameView) => { game.players.find(player => player.id === 'p')!.hajrPlays = 1; },
    (game: GameView) => { game.players.find(player => player.id === 'p')!.hand = []; },
    (game: GameView) => { game.active = 'a'; }, (game: GameView) => { game.phase = 4; },
    (game: GameView) => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
  ]) {
    const game = projected(5, { type: 'card', card: 'controlled-hajr' }), sent: Action[] = [];
    const button = guide({ game, busy: false, act(action) { sent.push(action); } }); assert.equal(button.props.disabled, false);
    change(game); press(button); assert.deepEqual(sent, []);
  }
  for (const phase of [0, 2, 4, 6, 8]) {
    const game = projected(phase, { type: 'card', card: 'controlled-hajr' }), sent: Action[] = [];
    const button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, true); press(button); assert.deepEqual(sent, []);
  }
  const missing = projected(5, { type: 'card', card: 'controlled-hajr' }); missing.turnActionGuide!.action.card = 'missing-hajr';
  assert.equal(guide({ game: missing, busy: false, act() { assert.fail('A missing Hajr cannot dispatch'); } }).props.disabled, true);
});

void test('printed-card history retains only raw aggregate conditions and their distinct native deadlines', () => {
  const game = projected(8); game.turnActionGuide = null;
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [printedCard(), { kind: 'and', terms: [fact(), printedCard('ghola')] }] };
  for (const key of ['cardPlays', 'compiled', 'combat', 'preparation'])
    Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  assert.match(html, /Hajr/); assert.match(html, /Tleilaxu Ghola/); assert.match(html, /You answered Yes/);
  assert.match(html, /Hajr counts even if its extra movement is unused/);
  assert.match(html, /Earlier plays, discards, sales, Karama roles and recovery alone do not count/);
  assert.match(html, /actual later Box replay does/); assert.match(html, /Ghola is separate from ordinary Revival/);
  assert.match(html, /remains open until the actual turn ends/); assert.doesNotMatch(html, /cardPlays|compiled|controlled-hajr|controlled-ghola/);
});

void test('turn-action history retains original own whole questions and terminal status without private compiled branches', () => {
  const game = projected(); game.turnActionGuide = null;
  game.turnActionPromises.push(
    { ...game.turnActionPromises[0], event: 'controlled-no', answer: false },
    { ...game.turnActionPromises[0], event: 'controlled-complete', turn: 1, fulfilled: true },
    { ...game.turnActionPromises[0], event: 'controlled-release', released: true },
    { ...game.turnActionPromises[0], event: 'controlled-foreign', player: 'a', mixed: { kind: 'and', terms: [fact({ kind: 'hand', name: 'Poison Blade' }), physical('ship', 19, 'sietch_tabr')] } },
  );
  for (const promise of game.turnActionPromises) for (const key of ['compiled', 'binding', 'factAnswers', 'residual', 'route', 'payments', 'progress', 'preparation', 'prep', 'bids', 'returns', 'leaders', 'alliance'])
    Object.defineProperty(promise, key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  for (const text of [/Turn 1/, /You answered Yes/, /You answered No/, /you hold Shield/, / OR /, / AND /,
    /Fulfilled: this whole commitment is complete/, /Released: this whole commitment is no longer possible/,
    /No negates the whole expression, not each condition separately/, /Separate No answers each create their own restriction/,
    /maximum physical forces in one actual future move/, /Individual fact answers and any reduced future branch remain private/,
    /highest accepted future declaration/, /cumulative future ordinary returns/, /Revival conditions close with your native Revival opportunity/,
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
    if (phase === 8) assert.match(markup(game), /Late payment recipients collect next turn/);
  }
  const game = projected(8, { type: 'ready' }); game.active = null;
  const sent: Action[] = [], button = guide({ game, busy: false, act(value) { sent.push(value); } });
  assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
  assert.match(markup(game), /Ready to end this turn while honoring your whole answer/);
  game.ready.push('p'); press(button); assert.equal(sent.length, 1);
  for (const phase of [1, 7]) {
    const current = phase === 1 ? nexus({ type: 'ready' }) : projected(phase, { type: 'ready' });
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
    revival({ type: 'card', card: 'controlled-ghola', amount: 1, elite: 0 }), richese('silent'), richese('onceAround'),
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
      game => { game.bidPromiseLot = { turn: 2, lot: 3 }; },
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
