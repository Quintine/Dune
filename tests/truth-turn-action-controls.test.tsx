import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TurnActionFields, turnActionInputError } from '../components/turn-action-fields';
import { TurnActionAnswers, TurnActionGuideButton, TurnActionPromises } from '../components/turn-action-promises';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { BattleClaimFields } from '../components/battle-promises';
import { baseDeck, ixSpecialCards } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView, type Plan } from '../game/engine';
import type { MixedActionExpression } from '../game/mixed-action-question';
import type { MixedBattleActionClaim } from '../game/mixed-battle-question';
import type { BattlePowerClaim } from '../game/battle-power-question';
import type { WindowCardEffect } from '../game/window-card-play';
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
const printedCard = (effect: 'hajr' | 'ghola' | 'nullentropyBox' | 'distrans' | 'juiceOfSapho' = 'hajr'): Expression => ({ kind: 'action', action: { kind: 'cardPlay', effect } });
const shipmentPriceSource = (recipient = 'p', cunning?: string) => JSON.stringify(['karamaShipment', 2, recipient,
  ...(cunning ? ['cunning', cunning] : ['original'])]);
const windowClaim = (effect: WindowCardEffect = 'weather', source = effect === 'harvester' ? 'controlled-native-blow'
  : effect === 'karamaAuction' ? 'ordinary-auction:2:2' : effect === 'karamaShipment' ? shipmentPriceSource()
    : effect === 'thumper' ? 'first-spice-reveal:2' : effect === 'amal' ? 'phase-opening:2:4' : 'storm:2'): Expression =>
  ({ kind: 'action', action: { kind: 'windowCardPlay', effect, source } });
const planClaim = (claim: MixedBattleActionClaim = { kind: 'dial', compare: 'eq', value: 3 }): Expression =>
  ({ kind: 'action', action: { kind: 'battlePlan', battle: 'controlled-native-battle', territory: 'arrakeen', claim } });
const traitorClaim = (call = true): Expression =>
  ({ kind: 'action', action: { kind: 'traitorCall', battle: 'controlled-native-battle', territory: 'arrakeen', call } });
const powerClaim = (claim: BattlePowerClaim = { kind: 'voice', use: true }): Expression =>
  ({ kind: 'action', action: { kind: 'battlePower', battle: 'controlled-native-battle', territory: 'arrakeen', claim } });
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
  if (next.type === 'charity') {
    const me = game.players.find(player => player.id === 'p')!; me.spice = 0; me.charityClaimed = false;
    game.charity = { ...game.charity, ordinary: 2, homeworld: 0, total: 2, amount: 2, incomePending: false };
  }
  if (next.type === 'card' && typeof next.card === 'string') {
    const cardId = next.card, effect = (['hajr', 'ghola', 'weather', 'atomics', 'harvester', 'thumper', 'amal'] as const)
      .find(effect => cardId.includes(effect)) ?? 'karama';
    const face = [...baseDeck(), ...ixSpecialCards()].find(card => card.effect === effect); assert.ok(face);
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
function auctionKarama(invoice = false): GameView {
  const card = baseDeck().find(card => card.kind === 'special' && card.effect === 'karama'); assert.ok(card);
  const id = 'controlled-printed-karama';
  const game = auction(invoice ? { type: 'decision', karama: true, card: id } : { type: 'card', card: id, mode: 'purchase' });
  const me = game.players.find(player => player.id === 'p')!; me.hand = [{ ...card, id }]; me.handLimit = 4;
  game.karamaAuctionCards = [id];
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [windowClaim('karamaAuction'), payment()] };
  if (!invoice) { game.auction!.active = 'a'; game.active = 'a'; }
  return game;
}
function shipmentKarama(recipient = 'p', cunning?: string): GameView {
  const game = projected(5, { type: 'card', card: 'controlled-printed-karama', mode: 'shipment', target: recipient });
  game.active = recipient; game.movementRemaining = ['p', 'a', 'r']; game.karamaShipping = null;
  game.karamaShipmentWindows = game.movementRemaining.map(player => ({ effect: 'karamaShipment' as const,
    turn: 2, recipient: player, source: shipmentPriceSource(player, player === recipient ? cunning : undefined) }));
  game.karamaShipmentCards = ['controlled-printed-karama'];
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [windowClaim('karamaShipment', shipmentPriceSource(recipient, cunning)), payment()] };
  return game;
}
function firstReveal(next: Action = { type: 'card', card: 'controlled-thumper' }): GameView {
  const game = projected(1, next); game.thumperWindowOpen = true; game.thumperReady = true; game.spiceWindow = null; game.nexus = false;
  game.thumperCards = ['controlled-thumper']; game.active = 'a';
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [windowClaim('thumper'), payment()] };
  return game;
}
function openingAmal(phase = 4, next: Action = { type: 'card', card: 'controlled-amal' }): GameView {
  const game = projected(phase, next); game.amalWindowOpen = true; game.phaseOpening = { passed: [] };
  game.amalCards = ['controlled-amal']; game.amalReady = true; game.active = 'a'; game.ready = ['p'];
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [windowClaim('amal', `phase-opening:2:${phase}`), payment()] };
  return game;
}
function boxPlay(phase = 7): GameView {
  const game = projected(phase, { type: 'card', card: 'controlled-box' });
  const card = { id: 'controlled-box', name: 'Nullentropy Box', kind: 'special' as const, effect: 'nullentropyBox' };
  const me = game.players.find(player => player.id === 'p')!; me.hand = [card]; me.handLimit = 4; me.spice = 3;
  game.active = 'a'; game.nullentropy = { card, blocked: null, search: null };
  game.turnActionPromises[0].mixed = { kind: 'and', terms: [printedCard('nullentropyBox'), payment()] };
  return game;
}
function distransPlay(): GameView {
  const card = richeseCards().find(card => card.effect === 'distrans'), given = baseDeck().find(card => card.name === 'Shield');
  assert.ok(card); assert.ok(given);
  const game = projected(2, { type: 'card', card: card.id, target: 'r', give: given.id });
  const me = game.players.find(player => player.id === 'p')!; me.hand = [card, given]; me.handLimit = 4;
  const recipient = game.players.find(player => player.id === 'r')!; recipient.handCount = 1; recipient.handLimit = 4;
  game.active = 'a'; game.distrans = { card, blocked: null, choices: [{ recipient: 'r', blocked: null, cards: [given], unavailable: [] }] };
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [printedCard('distrans'), payment()] };
  return game;
}
function saphoPlay(phase = 5, option: NonNullable<GameView['saphoOptions']>[number] =
  { scope: 'movement', event: 'controlled-movement-order', mode: 'last', afterCurrent: 'a' }): GameView {
  const card = richeseCards().find(card => card.effect === 'juiceOfSapho'); assert.ok(card);
  const game = projected(phase, { type: 'card', card: card.id, scope: option.scope, event: option.event, mode: option.mode });
  const me = game.players.find(player => player.id === 'p')!; me.hand = [card]; me.handLimit = 4;
  game.active = 'a'; game.saphoOptions = [option];
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [printedCard('juiceOfSapho'), payment()] };
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
function battlePower(power: 'voice' | 'prescience' = 'voice', next?: Action, allied = false): GameView {
  const game = combat(false, next ?? (power === 'voice' ? { type: 'voice', kind: 'poison', must: false } : { type: 'prescience', field: 'weapon' }));
  const me = game.players.find(player => player.id === 'p')!, other = game.players.find(player => player.id === 'a')!;
  me.faction = power === 'voice' ? 'beneGesserit' : 'atreides'; other.faction = 'emperor';
  game.battle!.attacker = allied ? 'a' : 'p'; game.battle!.defender = 'r';
  if (allied) { me.ally = 'a'; other.ally = 'p'; }
  game.battle!.preparation = { kind: power, owner: 'p', beneficiary: allied ? 'a' : 'p' };
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [powerClaim({ kind: power, use: true }), payment()] };
  return game;
}
function windowCard(effect: WindowCardEffect = 'weather', next?: Action): GameView {
  const game = projected(effect === 'harvester' ? 1 : 0, next ?? { type: 'card', card: `controlled-${effect}`,
    ...(effect === 'weather' ? { amount: 4 } : {}) });
  game.stormCardWindowOpen = true; game.shieldWallDestroyed = false; game.stormPending = null;
  game.spiceWindow = effect === 'harvester' ? { event: 'controlled-native-blow', territory: 'carthag', sector: 11,
    amount: 6, harvested: false } : null;
  game.players.find(player => player.id === 'p')!.forces = { 'shield_wall:8': 1 };
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [windowClaim(effect), payment()] };
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

void test('native battle-power editor uses public owned opportunities and repairs all four strict declaration forms', () => {
  const game = battlePower(), e = editor(physical(), false, game);
  for (const player of game.players) for (const key of ['hand', 'leaders', 'traitors', 'spice', 'tanks', 'forces'])
    Object.defineProperty(player, key, { get() { throw Error(`No private ${key} power authoring read`); }, configurable: true });
  for (const key of ['plans', 'prescience', 'voice', 'compliantPlan'])
    Object.defineProperty(game.battle!, key, { get() { throw Error(`No hidden battle ${key} read`); }, configurable: true });
  for (const key of ['combat', 'compiled', 'battlePowers'])
    Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} read`); }, configurable: true });
  select(e.tree(), '1', 'action', 'battlePower'); assert.deepEqual(e.value, powerClaim()); assert.equal(e.error(), null);
  select(e.tree(), '1', 'power-use', 'decline'); assert.deepEqual(e.value, powerClaim({ kind: 'voice', use: false }));
  select(e.tree(), '1', 'power-claim', 'voiceCommand'); select(e.tree(), '1', 'power-card-type', 'shield');
  select(e.tree(), '1', 'power-must', 'must'); assert.deepEqual(e.value, powerClaim({ kind: 'voiceCommand', cardType: 'shield', must: true }));
  select(e.tree(), '1', 'power-card-type', ''); assert.ok(e.error()); assert.match(e.html(), /aria-invalid="true"/);
  select(e.tree(), '1', 'power-card-type', 'projectile'); assert.equal(e.error(), null);
  game.battle!.event = 'new-native-battle'; assert.ok(e.error()); assert.match(e.html(), /Choose an owned native opportunity/);
  select(e.tree(), '1', 'power-battle', 'new-native-battle'); assert.equal(e.error(), null);
  select(e.tree(), '1', 'power-claim', 'prescience'); assert.ok(e.error(), 'Voice ownership grants no Prescience entitlement.');
  game.players.find(player => player.id === 'p')!.faction = 'atreides';
  game.battle!.preparation = { kind: 'prescience', owner: 'p', beneficiary: 'p' };
  select(e.tree(), '1', 'power-battle', 'new-native-battle'); assert.equal(e.error(), null);
  select(e.tree(), '1', 'power-use', 'decline');
  select(e.tree(), '1', 'power-claim', 'prescienceField'); select(e.tree(), '1', 'power-field', 'dial'); assert.equal(e.error(), null);
  assert.match(e.html(), /requested field is not the opponent/);
  for (const claim of [{ kind: 'voice', use: 'yes' }, { kind: 'voiceCommand', cardType: 'invented', must: true },
    { kind: 'prescienceField', field: 'weapon', value: 'private-card' }, { kind: 'prescienceField', field: 'support' }])
    assert.ok(turnActionInputError({ kind: 'action', action: { kind: 'battlePower', battle: 'new-native-battle', territory: 'arrakeen', claim } }, game, 'p'));
});

void test('native power defaults follow actual owned ordering and share the full sixteen-leaf four-level editor budget', () => {
  const game = battlePower('prescience'), e = editor(physical(), false, game);
  select(e.tree(), '1', 'action', 'battlePower'); assert.deepEqual(e.value, powerClaim({ kind: 'prescience', use: true }));
  const full = editor({ kind: 'or', terms: [powerClaim({ kind: 'prescience', use: true }), fact()] }, false, game);
  for (let count = 3; count <= 16; count++) { click(control(full.tree(), 'add-action-1')); select(full.tree(), `1.${count}`, 'action', 'battlePower'); }
  assert.equal(full.error(), null); assert.match(full.html(), /16 \/ 16 conditions/); assert.equal(control(full.tree(), 'add-action-1').props.disabled, true);
  const deep = editor({ kind: 'and', terms: [fact(), powerClaim({ kind: 'prescienceField', field: 'leader' })] }, false, game);
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  const frozen = editor(powerClaim({ kind: 'prescienceField', field: 'leader' }), true, game);
  select(frozen.tree(), '1', 'power-claim', 'voice'); select(frozen.tree(), '1', 'power-field', 'dial');
  select(frozen.tree(), '1', 'power-battle', ''); assert.equal(frozen.changes, 0);
  const future = battlePower('prescience'); future.players.find(player => player.id === 'a')!.faction = 'beneGesserit';
  future.players.find(player => player.id === 'a')!.ally = 'r'; future.players.find(player => player.id === 'r')!.ally = 'a';
  future.battle!.preparation = { kind: 'voice', owner: 'a', beneficiary: 'r' };
  const futureEditor = editor(physical(), false, future); select(futureEditor.tree(), '1', 'action', 'battlePower');
  assert.deepEqual(futureEditor.value, powerClaim({ kind: 'prescience', use: true })); assert.equal(futureEditor.error(), null);
});

void test('native power guides forward exact original allied-owner declarations and explicit declines without inspecting answers', () => {
  for (const power of ['voice', 'prescience'] as const) for (const decline of [false, true]) {
    const game = battlePower(power, decline ? { type: 'declineBattlePower' } : undefined, true), sent: Action[] = [];
    for (const key of ['combat', 'compiled', 'battlePowers'])
      Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} guide read`); }, configurable: true });
    for (const key of ['plans', 'prescience', 'voice', 'insight'])
      Object.defineProperty(game.battle!, key, { get() { throw Error(`No inspected ${key} guide read`); }, configurable: true });
    const button = guide({ game, busy: false, act(action) { sent.push(action); } }); assert.equal(button.props.disabled, false); press(button);
    assert.equal(sent[0], game.turnActionGuide!.action); assert.equal(sent[0].turnActionPromiseEvent, event);
    assert.equal(sent[0].turnActionPromisePhase, 6);
    if (decline) assert.match(renderToStaticMarkup(button), /Explicitly decline native/);
    else if (power === 'voice') { assert.equal(sent[0].kind, 'poison'); assert.equal(sent[0].must, false); }
    else { assert.equal(sent[0].field, 'weapon'); assert.match(renderToStaticMarkup(button), /Request the weapon field/); }
  }
});

void test('saved native power callbacks reject changed battle source, preparation, beneficiary, owner and modal priority', () => {
  for (const power of ['voice', 'prescience'] as const) for (const change of [
    (game: GameView) => { game.battle!.event = 'later-native-battle'; },
    (game: GameView) => { game.battle!.territory = 'carthag'; },
    (game: GameView) => { game.battle!.preparation = { ...game.battle!.preparation! }; },
    (game: GameView) => { game.battle!.preparation!.owner = 'a'; },
    (game: GameView) => { game.battle!.preparation!.beneficiary = 'r'; },
    (game: GameView) => { game.battle!.preparation!.kind = 'prescienceAnswer'; },
    (game: GameView) => { game.players.find(player => player.id === 'p')!.ally = null; },
    (game: GameView) => { game.battle!.defender = 'p'; },
    (game: GameView) => { game.battle!.revealed = true; },
    (game: GameView) => { game.response = { kind: 'voice', owner: 'p', passed: [] }; },
    (game: GameView) => { game.truthtrance = answering(6).truthtrance; },
    (game: GameView) => { game.phase = 5; },
    (game: GameView) => { game.turnActionGuide!.action.field = 'dial'; },
  ]) {
    const game = battlePower(power, undefined, true), button = guide({ game, busy: false, act() { assert.fail('A stale native declaration cannot send'); } });
    assert.equal(button.props.disabled, false); change(game); press(button);
  }
  const game = battlePower(), props: Props = { game, busy: false, act() { assert.fail('A stale callback cannot send'); } };
  const button = guide(props); props.act = () => assert.fail('A replaced action callback cannot send'); press(button);
  const busy = battlePower(), busyProps = { game: busy, busy: false, act() { assert.fail('A busy power cannot send'); } };
  const busyButton = guide(busyProps); busyProps.busy = true; press(busyButton);
});

void test('native power guides refuse future stages, borrowed powers, inspected answers and forged packet fields', () => {
  for (const [power, action, kind] of [
    ['voice', { type: 'voice', kind: 'invented', must: true }, 'voice'],
    ['voice', { type: 'voice', kind: 'poison', must: 'yes' }, 'voice'],
    ['voice', { type: 'voice', kind: 'poison', must: true, value: 'private-answer' }, 'voice'],
    ['voice', { type: 'declineBattlePower', field: 'weapon' }, 'voice'],
    ['voice', { type: 'voice', kind: 'poison', must: true }, 'nexusVoice'],
    ['prescience', { type: 'prescience', field: 'support' }, 'prescience'],
    ['prescience', { type: 'prescience', field: 'weapon', value: 'private-card' }, 'prescience'],
    ['prescience', { type: 'prescience', field: 'weapon' }, 'prescienceAnswer'],
    ['prescience', { type: 'declineBattlePower' }, 'nexusPrescienceAnswer'],
  ] as const) {
    const game = battlePower(power, action); game.battle!.preparation!.kind = kind;
    const button = guide({ game, busy: false, act() { assert.fail('An invalid power packet cannot send'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
  const future = battlePower('prescience'); future.players.find(player => player.id === 'a')!.faction = 'beneGesserit';
  future.players.find(player => player.id === 'a')!.ally = 'r'; future.players.find(player => player.id === 'r')!.ally = 'a';
  future.battle!.preparation = { kind: 'voice', owner: 'a', beneficiary: 'r' };
  const button = guide({ game: future, busy: false, act() { assert.fail('Ordered future Prescience cannot send yet'); } });
  assert.equal(button.props.disabled, true); press(button);
  for (const power of ['voice', 'prescience'] as const) for (const decline of [false, true]) {
    const game = battlePower(power, decline ? { type: 'declineBattlePower' } : undefined), sent: Action[] = [];
    game.battle!.preparation!.blocked = 'Native use is currently blocked; explicit Decline remains available.';
    const button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, !decline); press(button); assert.equal(sent.length, decline ? 1 : 0);
  }
});

void test('native power history keeps raw declarations distinct from effects and inspected values', () => {
  const game = battlePower(); game.turnActionGuide = null; game.battle = null;
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [powerClaim({ kind: 'voiceCommand', cardType: 'shield', must: true }),
    powerClaim({ kind: 'prescienceField', field: 'weapon' }), fact()] };
  for (const key of ['combat', 'compiled', 'battlePowers', 'declarations', 'preparation'])
    Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private history ${key} read`); }, configurable: true });
  const html = markup(game); assert.match(html, /Voice/); assert.match(html, /Prescience/); assert.match(html, /You answered Yes/);
  assert.match(html, /before later Karama prevention/); assert.match(html, /requested field is not the inspected answer or value/);
  assert.match(html, /close at the actual native choice or when its original source expires/);
  assert.doesNotMatch(html, /controlled-native-battle|battlePowers|declarations|private-card/);
});

void test('window-role editor and raw history use original public sources without hidden holdings or eligibility reads', () => {
  const game = windowCard(), e = editor(physical(), false, game);
  for (const player of game.players) for (const key of ['hand', 'spice', 'forces', 'advisors', 'tanks', 'leaders', 'traitors'])
    Object.defineProperty(player, key, { get() { throw Error(`No private window authoring ${key} read`); }, configurable: true });
  for (const key of ['windowCards', 'compiled', 'cardPlays'])
    Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} read`); }, configurable: true });
  select(e.tree(), '1', 'action', 'windowCardPlay'); assert.deepEqual(e.value, windowClaim()); assert.equal(e.error(), null);
  select(e.tree(), '1', 'window-effect', 'atomics'); assert.deepEqual(e.value, windowClaim('atomics')); assert.equal(e.error(), null);
  game.shieldWallDestroyed = true; assert.ok(e.error()); assert.match(e.html(), /no current original open native window/);
  select(e.tree(), '1', 'window-effect', 'weather'); assert.equal(e.error(), null, 'Weather needs no wall or private forces.');
  game.stormCardWindowOpen = false; assert.ok(e.error()); game.stormCardWindowOpen = true;
  select(e.tree(), '1', 'window-effect', 'harvester'); assert.ok(e.error());
  game.phase = 1; game.spiceWindow = { event: 'new-original-blow', territory: 'carthag', sector: 11, amount: 6, harvested: false };
  select(e.tree(), '1', 'window-source', 'new-original-blow'); assert.deepEqual(e.value, windowClaim('harvester', 'new-original-blow'));
  assert.equal(e.error(), null);
  delete game.spiceWindow.event; assert.ok(e.error()); select(e.tree(), '1', 'window-source', 'legacy-spice-blow:2:carthag:11');
  assert.deepEqual(e.value, windowClaim('harvester', 'legacy-spice-blow:2:carthag:11')); assert.equal(e.error(), null);
  game.spiceWindow.harvesterClosed = true; assert.ok(e.error()); game.spiceWindow.harvesterClosed = false;
  game.turnActionGuide = null; game.turnActionPromises[0].mixed = { kind: 'or', terms: [windowClaim(), windowClaim('atomics'), windowClaim('harvester')] };
  const html = markup(game); assert.match(html, /Weather Control/); assert.match(html, /Family Atomics/); assert.match(html, /Harvester/);
  assert.match(html, /recovery alone do not count/); assert.match(html, /original native window closes/);
  assert.match(html, /do not promise a selected storm distance or resulting spice amount/);
  assert.doesNotMatch(html, /windowCards|compiled|controlled-weather/);
});

void test('window-role editor retains strict repairable drafts and the shared sixteen-leaf four-level budget', () => {
  const game = windowCard(), e = editor(windowClaim(), false, game);
  select(e.tree(), '1', 'window-source', ''); assert.ok(e.error()); assert.deepEqual(e.value, windowClaim('weather', ''));
  select(e.tree(), '1', 'window-source', 'storm:2'); assert.equal(e.error(), null);
  for (const action of [{ kind: 'windowCardPlay', effect: 'weather', source: 'storm:2', amount: 4 },
    { kind: 'windowCardPlay', effect: 'ghola', source: 'storm:2' },
    { kind: 'windowCardPlay', effect: 'weather', source: 'storm:1' }])
    assert.ok(turnActionInputError({ kind: 'action', action }, game, 'p'));
  const full = editor({ kind: 'or', terms: [windowClaim(), fact()] }, false, game);
  for (let count = 3; count <= 16; count++) { click(control(full.tree(), 'add-action-1')); select(full.tree(), `1.${count}`, 'action', 'windowCardPlay'); }
  assert.equal(full.error(), null); assert.match(full.html(), /16 \/ 16 conditions/); assert.equal(control(full.tree(), 'add-action-1').props.disabled, true);
  const deep = editor({ kind: 'and', terms: [fact(), windowClaim()] }, false, game);
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
  const frozen = editor(windowClaim(), true, game); select(frozen.tree(), '1', 'window-effect', 'atomics');
  select(frozen.tree(), '1', 'window-source', ''); assert.equal(frozen.changes, 0);
});

void test('printed window guides forward exact owned Weather, Atomics and Harvester native packets out of turn', () => {
  for (const effect of ['weather', 'atomics', 'harvester'] as const) {
    const game = windowCard(effect), sent: Action[] = []; game.active = 'a';
    for (const key of ['windowCards', 'compiled', 'cardPlays'])
      Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} guide read`); }, configurable: true });
    const button = guide({ game, busy: false, act(action) { sent.push(action); } }); assert.equal(button.props.disabled, false); press(button);
    assert.equal(sent[0], game.turnActionGuide!.action); assert.equal(sent[0].turnActionPromiseEvent, event);
    assert.equal(sent[0].turnActionPromisePhase, effect === 'harvester' ? 1 : 0);
    assert.match(renderToStaticMarkup(button), /original native window/);
  }
  for (const amount of [0, 10]) {
    const game = windowCard('weather', { type: 'card', card: 'controlled-weather', amount });
    let sent = 0; const button = guide({ game, busy: false, act() { sent++; } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent, 1);
  }
});

void test('saved window-card callbacks reject source closure, public window mutation, physical card changes and modal handoffs', () => {
  for (const effect of ['weather', 'atomics', 'harvester'] as const) for (const change of [
    (game: GameView) => { if (effect === 'harvester') game.spiceWindow!.event = 'later-blow'; else game.stormCardWindowOpen = false; },
    (game: GameView) => { if (effect === 'harvester') game.spiceWindow!.amount *= 2; else game.stormPending = 7; },
    (game: GameView) => { game.turnActionPromises[0].mixed = windowClaim(effect, 'different-original-source'); },
    (game: GameView) => { game.players.find(player => player.id === 'p')!.hand = []; },
    (game: GameView) => { game.players.find(player => player.id === 'p')!.hand![0].effect = 'ghola'; },
    (game: GameView) => { game.response = { kind: 'voice', owner: 'a', passed: [] }; },
    (game: GameView) => { game.truthtrance = answering(game.phase).truthtrance; },
  ]) {
    const game = windowCard(effect), button = guide({ game, busy: false, act() { assert.fail('A stale window card cannot send'); } });
    assert.equal(button.props.disabled, false); change(game); press(button);
  }
  const game = windowCard('harvester'), button = guide({ game, busy: false, act() { assert.fail('A replaced original blow cannot send'); } });
  game.spiceWindow = { ...game.spiceWindow! }; press(button);
  const atomics = windowCard('atomics'), atomicButton = guide({ game: atomics, busy: false, act() { assert.fail('Changed native Atomics eligibility cannot send'); } });
  atomics.players.find(player => player.id === 'p')!.forces = {}; press(atomicButton);
});

void test('window-role guides reject unsupported packets, missing native eligibility and generic card fallback', () => {
  for (const amount of [undefined, -1, 11, 1.5, NaN, Infinity]) {
    const game = windowCard('weather', { type: 'card', card: 'controlled-weather', amount });
    const button = guide({ game, busy: false, act() { assert.fail('An invalid Weather distance cannot send'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
  for (const effect of ['weather', 'atomics', 'harvester'] as const) {
    for (const extra of [{ mode: 'shipment' }, { leader: 'foreign-leader' }, { forces: { 'shield_wall:8': 1 } },
      ...(effect === 'weather' ? [] : [{ amount: 2 }])]) {
      const game = windowCard(effect); Object.assign(game.turnActionGuide!.action, extra);
      const button = guide({ game, busy: false, act() { assert.fail('An unsupported native window packet cannot send'); } });
      assert.equal(button.props.disabled, true); press(button);
    }
    for (const phase of [2, 4, 5, 6]) {
      const game = windowCard(effect); game.phase = phase; game.turnActionGuide!.action.turnActionPromisePhase = phase;
      const button = guide({ game, busy: false, act() { assert.fail('A window role cannot bypass validation through generic preparation'); } });
      assert.equal(button.props.disabled, true); press(button);
    }
    const wrongSource = windowCard(effect); wrongSource.turnActionPromises[0].mixed = payment();
    assert.equal(guide({ game: wrongSource, busy: false, act() { assert.fail('A printed window guide needs its original raw source'); } }).props.disabled, true);
  }
  const atomics = windowCard('atomics'); atomics.players.find(player => player.id === 'p')!.forces = {};
  assert.equal(guide({ game: atomics, busy: false, act() { assert.fail('Atomics needs actual owned native forces'); } }).props.disabled, true);
});

void test('early owned Box guides require the exact quoted Box and live original global question window', () => {
  for (const effect of ['weather', 'harvester'] as const) {
    const game = windowCard(effect), me = game.players.find(player => player.id === 'p')!;
    me.hand = [{ id: 'controlled-box', name: 'Nullentropy Box', kind: 'special', effect: 'nullentropyBox' }];
    game.nullentropy = { card: me.hand[0], blocked: null, search: null };
    game.turnActionGuide!.action = { type: 'card', card: me.hand[0].id, turnActionPromiseEvent: event, turnActionPromisePhase: game.phase };
    const sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    game.nullentropy.blocked = 'The native Box opening is no longer legal.'; press(button); assert.equal(sent.length, 1);
    game.nullentropy.blocked = null;
    if (effect === 'harvester') game.spiceWindow!.harvesterClosed = true; else game.stormCardWindowOpen = false;
    press(button); assert.equal(sent.length, 1);
    const unrelated = windowCard(effect); unrelated.turnActionPromises[0].mixed = payment();
    unrelated.players.find(player => player.id === 'p')!.hand = me.hand;
    unrelated.nullentropy = { card: me.hand[0], blocked: null, search: null };
    unrelated.turnActionGuide!.action = { ...game.turnActionGuide!.action };
    assert.equal(guide({ game: unrelated, busy: false, act() { assert.fail('An unrelated row cannot create a new early Box control'); } }).props.disabled, true);
  }
});

void test('window Ready guides retain the exact live raw source, known Storm distance and fresh-blow callback ownership', () => {
  const readyWindow = (effect: WindowCardEffect) => {
    const game = windowCard(effect); game.stormPending = effect === 'harvester' ? null : 4;
    game.turnActionGuide!.action = { type: 'ready', turnActionPromiseEvent: event, turnActionPromisePhase: game.phase };
    if (effect === 'harvester') { game.turnActionPromises[0].answer = false; game.turnActionPromises[0].mixed = windowClaim(effect); }
    Object.defineProperty(game.turnActionPromises[0], 'windowCards', { get() { throw Error('Ready must not read private window receipts'); } });
    return game;
  };
  for (const effect of ['weather', 'atomics', 'harvester'] as const) {
    const game = readyWindow(effect), sent: Action[] = [];
    const button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.match(renderToStaticMarkup(button), /Accept this .* window while preserving your whole answer/);
    game.ready.push('p'); press(button); assert.equal(sent.length, 1, 'An accepted window cannot be reopened by the saved Ready callback.');
    for (const change of [
      (game: GameView) => { game.turnActionPromises[0].mixed = windowClaim(effect, 'later-original-source'); },
      (game: GameView) => { if (effect === 'harvester') game.spiceWindow!.event = 'later-blow'; else game.stormCardWindowOpen = false; },
      (game: GameView) => { if (effect === 'harvester') game.spiceWindow!.harvesterClosed = true; else game.stormPending = null; },
    ]) {
      const stale = readyWindow(effect), saved = guide({ game: stale, busy: false, act() { assert.fail('A changed original Ready source cannot send'); } });
      assert.equal(saved.props.disabled, false); change(stale); press(saved);
    }
    const extra = readyWindow(effect); extra.turnActionGuide!.action.amount = 4;
    assert.equal(guide({ game: extra, busy: false, act() { assert.fail('Window Ready accepts no extra native fields'); } }).props.disabled, true);
    const unrelated = readyWindow(effect); unrelated.turnActionPromises[0].mixed = payment();
    assert.equal(guide({ game: unrelated, busy: false, act() { assert.fail('Window Ready needs its own original raw window clause'); } }).props.disabled, true);
  }
  const unknownStorm = readyWindow('weather'); unknownStorm.stormPending = null;
  assert.equal(guide({ game: unknownStorm, busy: false, act() { assert.fail('Storm Ready waits for a known native movement'); } }).props.disabled, true);
  const replaced = readyWindow('harvester'), saved = guide({ game: replaced, busy: false, act() { assert.fail('A replaced fresh blow cannot accept an old Ready callback'); } });
  replaced.spiceWindow = { ...replaced.spiceWindow! }; press(saved);
});

void test('current ordinary-lot Karama picker is public, source-bound and repairable within the shared logical budget', () => {
  const game = auctionKarama(), e = editor(physical(), false, game);
  for (const player of game.players) for (const key of ['hand', 'spice', 'leaders', 'traitors', 'forces'])
    Object.defineProperty(player, key, { get() { throw Error(`No private Karama authoring ${key} read`); }, configurable: true });
  Object.defineProperty(game, 'karamaAuctionCards', { get() { throw Error('The public question must not inspect the owner’s native card quote'); } });
  select(e.tree(), '1', 'action', 'windowCardPlay'); assert.deepEqual(e.value, windowClaim('karamaAuction')); assert.equal(e.error(), null);
  assert.match(e.html(), /Spend a printed Karama for this current ordinary lot/); assert.match(e.html(), /Ordinary lot 2/);
  select(e.tree(), '1', 'window-source', ''); assert.ok(e.error());
  select(e.tree(), '1', 'window-source', 'ordinary-auction:2:2'); assert.equal(e.error(), null);
  game.bidPromiseLot = { turn: 2, lot: 3 }; assert.ok(e.error());
  select(e.tree(), '1', 'window-source', 'ordinary-auction:2:3'); assert.equal(e.error(), null);
  const originalAuction = game.auction;
  game.auction = null; assert.ok(e.error()); assert.match(e.html(), /no current original open native window/); game.auction = originalAuction;
  for (const extra of [{ card: 'private-karama' }, { mode: 'purchase' }, { amount: 0 }])
    assert.ok(turnActionInputError({ kind: 'action', action: { kind: 'windowCardPlay', effect: 'karamaAuction', source: 'ordinary-auction:2:3', ...extra } }, game, 'p'));
  const fullGame = auctionKarama(), full = editor({ kind: 'or', terms: [windowClaim('karamaAuction'), fact()] }, false, fullGame);
  for (let count = 3; count <= 16; count++) { click(control(full.tree(), 'add-action-1')); select(full.tree(), `1.${count}`, 'action', 'windowCardPlay'); }
  assert.equal(full.error(), null); assert.match(full.html(), /16 \/ 16 conditions/);
  const deep = editor({ kind: 'and', terms: [fact(), windowClaim('karamaAuction')] }, false, fullGame);
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
});

void test('printed current-lot Karama guides forward exact purchase and winning-invoice packets using native owner quotes', () => {
  for (const invoice of [false, true]) {
    const game = auctionKarama(invoice), sent: Action[] = [];
    for (const key of ['windowCards', 'compiled', 'cardPlays'])
      Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} Karama guide read`); }, configurable: true });
    const button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.equal(sent[0].card, 'controlled-printed-karama'); assert.equal(sent[0].turnActionPromisePhase, 3);
    assert.equal(sent[0].turnActionPromiseEvent, event);
    if (invoice) assert.match(renderToStaticMarkup(button), /printed Karama on this ordinary-lot winning invoice/);
    else { assert.equal(sent[0].mode, 'purchase'); assert.equal(game.auction!.active, 'a', 'The native purchase remains possible outside the bidder’s turn.'); }
    game.turnActionGuide = null;
    const html = markup(game); assert.match(html, /printed Karama/); assert.match(html, /immediate purchase/);
    assert.match(html, /Worthless conversion and a successful bid alone do not count/); assert.match(html, /closes with the original ordinary lot/);
    assert.doesNotMatch(html, /windowCards|controlled-printed-karama/);
  }
});

void test('saved printed-Karama auction callbacks expire with lot, native quote, physical card, owner and callback changes', () => {
  for (const invoice of [false, true]) for (const change of [
    (game: GameView) => { game.bidPromiseLot = { turn: 2, lot: 3 }; },
    (game: GameView) => { game.auction = { ...game.auction! }; },
    (game: GameView) => { game.auction!.active = 'r'; },
    (game: GameView) => { game.karamaAuctionCards = []; },
    (game: GameView) => { const card = game.players.find(player => player.id === 'p')!.hand?.[0]; assert.ok(card); card.kind = 'worthless'; },
    (game: GameView) => { game.turnActionPromises[0].mixed = windowClaim('karamaAuction', 'ordinary-auction:2:1'); },
    (game: GameView) => { game.me = 'a'; },
  ]) {
    const game = auctionKarama(invoice), button = guide({ game, busy: false, act() { assert.fail('A stale ordinary-lot printed Karama cannot send'); } });
    assert.equal(button.props.disabled, false); change(game); press(button);
  }
  const game = auctionKarama(), props: Props = { game, busy: false, act() { assert.fail('A saved Karama callback cannot send after replacement'); } };
  const saved = guide(props); props.act = () => assert.fail('The replacement callback cannot receive an old purchase'); press(saved);
  const full = auctionKarama(), fullButton = guide({ game: full, busy: false, act() { assert.fail('A newly full hand cannot purchase the lot'); } });
  full.players.find(player => player.id === 'p')!.handLimit = 1; press(fullButton);
  assert.equal(guide({ game: full, busy: false, act() { assert.fail('An initially full hand cannot purchase the lot'); } }).props.disabled, true);
});

void test('printed auction-role guides refuse conversion, unsupported packets and generic purchase fallback while retaining unrelated invoices', () => {
  for (const invoice of [false, true]) for (const extra of [{ amount: 0 }, { target: 'r' }, { leader: 'foreign-leader' },
    ...(invoice ? [{ mode: 'purchase' }] : [{ mode: 'shipment' }])]) {
    const game = auctionKarama(invoice); Object.assign(game.turnActionGuide!.action, extra);
    const button = guide({ game, busy: false, act() { assert.fail('An unsupported auction-role packet cannot send'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
  for (const invoice of [false, true]) {
    const game = auctionKarama(invoice), card = game.players.find(player => player.id === 'p')!.hand?.[0]; assert.ok(card);
    card.kind = 'worthless'; delete card.effect;
    assert.equal(guide({ game, busy: false, act() { assert.fail('Worthless conversion is not printed Karama use'); } }).props.disabled, true);
    const missingQuote = auctionKarama(invoice); missingQuote.karamaAuctionCards = [];
    assert.equal(guide({ game: missingQuote, busy: false, act() { assert.fail('A native card quote is required'); } }).props.disabled, true);
  }
  for (const phase of [2, 4, 5, 6]) {
    const game = auctionKarama(); game.phase = phase; game.turnActionGuide!.action.turnActionPromisePhase = phase;
    assert.equal(guide({ game, busy: false, act() { assert.fail('A purchase cannot become generic preparation'); } }).props.disabled, true);
  }
  const foreign = auctionKarama(true); foreign.decision = { kind: 'auctionPayment', player: 'a' };
  assert.equal(guide({ game: foreign, busy: false, act() { assert.fail('A foreign invoice cannot consume this printed Karama'); } }).props.disabled, true);
  const prior = auctionKarama(true); prior.turnActionPromises[0].mixed = payment(); prior.karamaAuctionCards = [];
  for (const player of prior.players) Object.defineProperty(player, 'hand', { get() { throw Error('Existing unrelated invoice guides keep their original native authority'); } });
  const sent: Action[] = [], oldInvoice = guide({ game: prior, busy: false, act(action) { sent.push(action); } });
  assert.equal(oldInvoice.props.disabled, false); press(oldInvoice); assert.equal(sent[0], prior.turnActionGuide!.action);
  const later = auctionKarama(true); later.bidPromiseLot = { turn: 2, lot: 3 }; later.karamaAuctionCards = [];
  for (const player of later.players) Object.defineProperty(player, 'hand', { get() { throw Error('An older raw window cannot impose printed-role eligibility on an unrelated later invoice'); } });
  const laterSent: Action[] = [], laterInvoice = guide({ game: later, busy: false, act(action) { laterSent.push(action); } });
  assert.equal(laterInvoice.props.disabled, false); press(laterInvoice); assert.equal(laterSent[0], later.turnActionGuide!.action);
});

void test('current ordinary-lot printed-role questions retain quoted owned Box routes before purchase and inside their own invoice', () => {
  for (const invoice of [false, true]) {
    const game = auctionKarama(invoice), me = game.players.find(player => player.id === 'p')!;
    me.hand = [{ id: 'controlled-box', name: 'Nullentropy Box', kind: 'special', effect: 'nullentropyBox' }];
    game.nullentropy = { card: me.hand[0], blocked: null, search: null };
    game.turnActionGuide!.action = { type: 'card', card: me.hand[0].id, turnActionPromiseEvent: event, turnActionPromisePhase: 3 };
    const sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    game.bidPromiseLot = { turn: 2, lot: 3 }; press(button); assert.equal(sent.length, 1);
  }
});

void test('shipment-price picker names the current public beneficiary without reading card or native funding quotes', () => {
  const game = shipmentKarama('a'), e = editor(physical(), false, game);
  for (const player of game.players) for (const key of ['hand', 'spice', 'forces', 'leaders', 'traitors', 'reserves'])
    Object.defineProperty(player, key, { get() { throw Error(`No private shipment-price authoring ${key} read`); }, configurable: true });
  Object.defineProperty(game, 'karamaShipmentCards', { get() { throw Error('The public picker must not inspect the giver’s native card quote'); } });
  select(e.tree(), '1', 'action', 'windowCardPlay'); assert.deepEqual(e.value, windowClaim('karamaShipment', shipmentPriceSource('a')));
  assert.equal(e.error(), null); assert.match(e.html(), /Asker’s current native shipment price/);
  select(e.tree(), '1', 'window-source', ''); assert.ok(e.error());
  select(e.tree(), '1', 'window-source', shipmentPriceSource('p')); assert.ok(e.error(), 'An inactive entitlement is not a new public picker option.');
  select(e.tree(), '1', 'window-source', shipmentPriceSource('a')); assert.equal(e.error(), null);
  game.active = 'p'; assert.ok(e.error()); select(e.tree(), '1', 'window-source', shipmentPriceSource('p')); assert.equal(e.error(), null);
  const cunning = shipmentPriceSource('p', 'controlled-cunning-window');
  game.karamaShipmentWindows = game.karamaShipmentWindows.map(window => window.recipient === 'p' ? { ...window, source: cunning } : window);
  assert.ok(e.error()); select(e.tree(), '1', 'window-source', cunning); assert.equal(e.error(), null);
  assert.ok(turnActionInputError({ kind: 'action', action: { kind: 'windowCardPlay', effect: 'karamaShipment', source: cunning, target: 'p' } }, game, 'p'));
  const fullGame = shipmentKarama(), full = editor({ kind: 'or', terms: [windowClaim('karamaShipment'), fact()] }, false, fullGame);
  for (let count = 3; count <= 16; count++) { click(control(full.tree(), 'add-action-1')); select(full.tree(), `1.${count}`, 'action', 'windowCardPlay'); }
  assert.equal(full.error(), null); assert.match(full.html(), /16 \/ 16 conditions/);
  const deep = editor({ kind: 'and', terms: [fact(), windowClaim('karamaShipment')] }, false, fullGame);
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
});

void test('printed shipment-price guides forward exact own or foreign-giver grants and explain the distinct actual shipment', () => {
  for (const recipient of ['p', 'a']) for (const cunning of [undefined, 'controlled-cunning-window']) {
    const game = shipmentKarama(recipient, cunning), sent: Action[] = [];
    for (const key of ['windowCards', 'compiled', 'preparation'])
      Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} shipment-price read`); }, configurable: true });
    const button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.equal(sent[0].type, 'card'); assert.equal(sent[0].mode, 'shipment'); assert.equal(sent[0].target, recipient);
    assert.equal(sent[0].turnActionPromiseEvent, event); assert.equal(sent[0].turnActionPromisePhase, 5);
    assert.match(renderToStaticMarkup(button), /grant .* this native shipment price/);
    game.turnActionGuide = null;
    const html = markup(game); assert.match(html, /price grant counts separately from an actual force shipment/);
    assert.match(html, /does not require the recipient to ship forces/); assert.match(html, /original shipment-price opportunity ends/);
    assert.doesNotMatch(html, /windowCards|compiled|controlled-printed-karama/);
  }
});

void test('saved shipment-price guides expire with the active source, target, quote, physical card and grant state', () => {
  for (const recipient of ['p', 'a']) for (const change of [
    (game: GameView) => { game.active = recipient === 'p' ? 'a' : 'p'; },
    (game: GameView) => { game.karamaShipmentWindows = game.karamaShipmentWindows.map(window => window.recipient === recipient
      ? { ...window, source: shipmentPriceSource(recipient, 'later-cunning-window') } : window); },
    (game: GameView) => { game.turnActionGuide!.action.target = recipient === 'p' ? 'a' : 'p'; },
    (game: GameView) => { game.karamaShipmentCards = []; },
    (game: GameView) => { const card = game.players.find(player => player.id === 'p')!.hand?.[0]; assert.ok(card); card.kind = 'worthless'; },
    (game: GameView) => { game.karamaShipping = { player: recipient, owner: 'p' }; },
    (game: GameView) => { game.turnActionPromises[0].mixed = windowClaim('karamaShipment', shipmentPriceSource('r')); },
  ]) {
    const game = shipmentKarama(recipient), saved = guide({ game, busy: false, act() { assert.fail('A stale shipment-price grant cannot send'); } });
    assert.equal(saved.props.disabled, false); change(game); press(saved);
  }
  const game = shipmentKarama('a'), props: Props = { game, busy: false, act() { assert.fail('A replaced grant callback cannot send'); } };
  const saved = guide(props); props.act = () => assert.fail('A replaced callback cannot receive an old grant'); press(saved);
});

void test('current printed shipment roles reject forged grants and inactive targets without blocking older native preparation guides', () => {
  for (const extra of [{ target: 'r' }, { target: undefined }, { amount: 3 }, { leader: 'foreign-leader' }, { mode: 'purchase' }]) {
    const game = shipmentKarama(); Object.assign(game.turnActionGuide!.action, extra);
    const button = guide({ game, busy: false, act() { assert.fail('An unsupported shipment-price packet cannot send'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
  const converted = shipmentKarama(), card = converted.players.find(player => player.id === 'p')!.hand?.[0]; assert.ok(card);
  card.kind = 'worthless'; delete card.effect;
  assert.equal(guide({ game: converted, busy: false, act() { assert.fail('Worthless conversion is not printed shipment-role use'); } }).props.disabled, true);
  const unquoted = shipmentKarama(); unquoted.karamaShipmentCards = [];
  assert.equal(guide({ game: unquoted, busy: false, act() { assert.fail('An absent native shipment card quote cannot be bypassed'); } }).props.disabled, true);
  const inactive = shipmentKarama('a'); inactive.active = 'p';
  assert.equal(guide({ game: inactive, busy: false, act() { assert.fail('An inactive beneficiary cannot receive this grant control'); } }).props.disabled, true);
  for (const mixed of [payment(), windowClaim('karamaShipment', shipmentPriceSource('a'))]) {
    const legacy = shipmentKarama(); legacy.turnActionPromises[0].mixed = mixed; legacy.karamaShipmentCards = [];
    const sent: Action[] = [], button = guide({ game: legacy, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], legacy.turnActionGuide!.action);
  }
});

void test('a current shipment-price question retains a quoted Box route for an owned or foreign giver', () => {
  for (const recipient of ['p', 'a']) {
    const game = shipmentKarama(recipient), me = game.players.find(player => player.id === 'p')!;
    const box = { id: 'controlled-box', name: 'Nullentropy Box', kind: 'special' as const, effect: 'nullentropyBox' };
    me.hand = [box]; game.nullentropy = { card: box, blocked: null, search: null };
    game.turnActionGuide!.action = { type: 'card', card: box.id, turnActionPromiseEvent: event, turnActionPromisePhase: 5 };
    const sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    game.nullentropy.blocked = 'The native Box is no longer available.'; press(button); assert.equal(sent.length, 1);
  }
});

void test('Thumper authoring uses the original public first-reveal source and preserves repairable shared logical drafts', () => {
  const game = firstReveal(), e = editor(physical(), false, game);
  for (const player of game.players) for (const key of ['hand', 'spice', 'forces', 'leaders', 'traitors'])
    Object.defineProperty(player, key, { get() { throw Error(`No private Thumper authoring ${key} read`); }, configurable: true });
  for (const key of ['thumperCards', 'spiceSequence', 'spiceResolution'])
    Object.defineProperty(game, key, { get() { throw Error(`No native Thumper authoring ${key} read`); }, configurable: true });
  select(e.tree(), '1', 'action', 'windowCardPlay'); assert.deepEqual(e.value, windowClaim('thumper')); assert.equal(e.error(), null);
  assert.match(e.html(), /Before the original first spice reveal/);
  game.nexus = true; game.response = { kind: 'voice', owner: 'a', passed: [] };
  assert.equal(e.error(), null, 'A temporary native control does not change the original public first-reveal source.');
  game.nexus = false; game.response = null;
  select(e.tree(), '1', 'window-source', ''); assert.ok(e.error());
  select(e.tree(), '1', 'window-source', 'first-spice-reveal:2'); assert.equal(e.error(), null);
  game.thumperWindowOpen = false; assert.ok(e.error()); assert.match(e.html(), /no current original open native window/);
  game.thumperWindowOpen = true;
  for (const extra of [{ amount: 0 }, { mode: 'shipment' }, { target: 'p' }])
    assert.ok(turnActionInputError({ kind: 'action', action: { kind: 'windowCardPlay', effect: 'thumper', source: 'first-spice-reveal:2', ...extra } }, game, 'p'));
  const fullGame = firstReveal(), full = editor({ kind: 'or', terms: [windowClaim('thumper'), fact()] }, false, fullGame);
  for (let count = 3; count <= 16; count++) { click(control(full.tree(), 'add-action-1')); select(full.tree(), `1.${count}`, 'action', 'windowCardPlay'); }
  assert.equal(full.error(), null); assert.match(full.html(), /16 \/ 16 conditions/);
  const deep = editor({ kind: 'and', terms: [fact(), windowClaim('thumper')] }, false, fullGame);
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
});

void test('Thumper play and same-source Ready guides forward exact native packets while first-turn history retains its printed warning', () => {
  const played = firstReveal(), sent: Action[] = [];
  Object.defineProperty(played.turnActionPromises[0], 'windowCards', { get() { throw Error('No private Thumper receipt read'); } });
  const button = guide({ game: played, busy: false, act(action) { sent.push(action); } });
  assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], played.turnActionGuide!.action);
  assert.equal(sent[0].type, 'card'); assert.equal(sent[0].card, 'controlled-thumper'); assert.equal(sent[0].turnActionPromisePhase, 1);
  const alreadyReady = firstReveal(); alreadyReady.ready.push('p'); alreadyReady.thumperReady = false;
  let latePlay = 0; const lateThumper = guide({ game: alreadyReady, busy: false, act() { latePlay++; } });
  assert.equal(lateThumper.props.disabled, false); press(lateThumper); assert.equal(latePlay, 1, 'The native card quote can permit a held Thumper after own readiness.');
  const keeper = firstReveal({ type: 'ready' }), readied: Action[] = [];
  keeper.thumperCards = []; keeper.players.find(player => player.id === 'p')!.hand = [];
  keeper.turnActionPromises[0].answer = false; keeper.turnActionPromises[0].mixed = windowClaim('thumper');
  const ready = guide({ game: keeper, busy: false, act(action) { readied.push(action); } });
  assert.equal(ready.props.disabled, false); press(ready); assert.equal(readied[0], keeper.turnActionGuide!.action);
  assert.match(renderToStaticMarkup(ready), /Ready for the original first spice reveal/);
  keeper.ready.push('p'); press(ready); assert.equal(readied.length, 1);
  const summoned = firstReveal({ type: 'ready' }); summoned.nexus = true; summoned.thumperCards = [];
  Object.defineProperty(summoned, 'summonedBeforeBlow', { get() { throw Error('Use the native public Ready quote, not private summoned timing'); } });
  let summonedReady = 0; const quotedReady = guide({ game: summoned, busy: false, act() { summonedReady++; } });
  assert.equal(quotedReady.props.disabled, false); press(quotedReady); assert.equal(summonedReady, 1);
  const first = firstReveal(); first.turn = 1; first.turnActionGuide = null;
  first.turnActionPromises[0].turn = 1; first.turnActionPromises[0].mixed = windowClaim('thumper', 'first-spice-reveal:1');
  const html = markup(first); assert.match(html, /On turn 1, playing Thumper still discards the card/);
  assert.match(html, /worm encounter is ignored and the normal Spice Card draw continues/);
  assert.match(html, /closes when the actual first spice draw begins/); assert.doesNotMatch(html, /windowCards|controlled-thumper/);
  assert.match(editor(windowClaim('thumper', 'first-spice-reveal:1'), false, first).html(), /On turn 1, playing Thumper still discards the card/);
});

void test('saved Thumper play and Ready callbacks reject original-source expiry and native modal changes', () => {
  for (const action of [{ type: 'card', card: 'controlled-thumper' }, { type: 'ready' }]) for (const change of [
    (game: GameView) => { game.thumperWindowOpen = false; },
    (game: GameView) => { game.thumperReady = false; },
    (game: GameView) => { game.nexus = true; },
    (game: GameView) => { game.spiceWindow = { event: 'later-native-blow', territory: 'carthag', sector: 11, amount: 6, harvested: false }; },
    (game: GameView) => { game.phaseOpening = { passed: [] }; },
    (game: GameView) => { game.response = { kind: 'voice', owner: 'a', passed: [] }; },
    (game: GameView) => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    (game: GameView) => { game.turnActionPromises[0].mixed = windowClaim('thumper', 'first-spice-reveal:1'); },
  ]) {
    const game = firstReveal(action), saved = guide({ game, busy: false, act() { assert.fail('A stale first-reveal native action cannot send'); } });
    assert.equal(saved.props.disabled, false); change(game); press(saved);
  }
  for (const change of [
    (game: GameView) => { game.thumperCards = []; },
    (game: GameView) => { game.players.find(player => player.id === 'p')!.hand = []; },
    (game: GameView) => { const card = game.players.find(player => player.id === 'p')!.hand?.[0]; assert.ok(card); card.effect = 'ghola'; },
  ]) {
    const game = firstReveal(), saved = guide({ game, busy: false, act() { assert.fail('A changed Thumper quote or physical card cannot send'); } });
    assert.equal(saved.props.disabled, false); change(game); press(saved);
  }
});

void test('Thumper guides reject unsupported native packets, unavailable quotes and generic preparation fallback', () => {
  for (const extra of [{ amount: 0 }, { mode: 'shipment' }, { target: 'p' }, { leader: 'foreign-leader' }]) {
    const game = firstReveal(); Object.assign(game.turnActionGuide!.action, extra);
    const button = guide({ game, busy: false, act() { assert.fail('Thumper accepts only its exact native printed-play packet'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
  for (const phase of [0, 2, 4, 5, 6, 8]) {
    const game = firstReveal(); game.phase = phase; game.active = 'p'; game.turnActionGuide!.action.turnActionPromisePhase = phase;
    const button = guide({ game, busy: false, act() { assert.fail('A held Thumper cannot become generic native preparation'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
  const unquoted = firstReveal(); unquoted.thumperCards = [];
  assert.equal(guide({ game: unquoted, busy: false, act() { assert.fail('The root native quote must make Thumper available'); } }).props.disabled, true);
  const unrelated = firstReveal(); unrelated.turnActionPromises[0].mixed = payment();
  assert.equal(guide({ game: unrelated, busy: false, act() { assert.fail('Thumper requires its original own raw first-reveal source'); } }).props.disabled, true);
  const extraReady = firstReveal({ type: 'ready', amount: 0 });
  assert.equal(guide({ game: extraReady, busy: false, act() { assert.fail('First-reveal Ready accepts no extra native fields'); } }).props.disabled, true);
  const unavailableReady = firstReveal({ type: 'ready' }); unavailableReady.thumperReady = false;
  assert.equal(guide({ game: unavailableReady, busy: false, act() { assert.fail('An open source alone cannot invent a native Ready stage'); } }).props.disabled, true);
});

void test('Thumper first-reveal questions retain the quoted phase-one Box route before the actual first draw', () => {
  const game = firstReveal(), me = game.players.find(player => player.id === 'p')!;
  const box = { id: 'controlled-box', name: 'Nullentropy Box', kind: 'special' as const, effect: 'nullentropyBox' };
  me.hand = [box]; game.nullentropy = { card: box, blocked: null, search: null };
  game.turnActionGuide!.action = { type: 'card', card: box.id, turnActionPromiseEvent: event, turnActionPromisePhase: 1 };
  const sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
  assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
  game.thumperWindowOpen = false; press(button); assert.equal(sent.length, 1);
});

void test('Amal editor uses the public original phase opening and preserves repairable sixteen-leaf four-level expressions', () => {
  const game = openingAmal(), e = editor(physical(), false, game);
  for (const player of game.players) for (const key of ['hand', 'spice', 'forces', 'leaders', 'traitors'])
    Object.defineProperty(player, key, { get() { throw Error(`No private Amal authoring ${key} read`); }, configurable: true });
  for (const key of ['amalCards', 'amalReady']) Object.defineProperty(game, key, { get() { throw Error(`No native Amal authoring ${key} quote read`); } });
  select(e.tree(), '1', 'action', 'windowCardPlay'); assert.deepEqual(e.value, windowClaim('amal')); assert.equal(e.error(), null);
  assert.match(e.html(), /Original Revival opening/); assert.match(e.html(), /Amal halves available cash before ordinary payments become legal/);
  game.phaseOpening!.passed.push('p'); assert.equal(e.error(), null, 'The public source is separate from individual native eligibility.');
  game.phaseOpening = null; assert.equal(e.error(), null, 'The explicit original source survives temporary controls.');
  select(e.tree(), '1', 'window-source', ''); assert.ok(e.error()); select(e.tree(), '1', 'window-source', 'phase-opening:2:4'); assert.equal(e.error(), null);
  game.phase = 0; assert.ok(e.error()); select(e.tree(), '1', 'window-source', 'phase-opening:2:0'); assert.equal(e.error(), null);
  game.amalWindowOpen = false; assert.ok(e.error()); assert.match(e.html(), /no current original open native window/);
  const fullGame = openingAmal(), full = editor({ kind: 'or', terms: [windowClaim('amal'), fact()] }, false, fullGame);
  for (let count = 3; count <= 16; count++) { click(control(full.tree(), 'add-action-1')); select(full.tree(), `1.${count}`, 'action', 'windowCardPlay'); }
  assert.equal(full.error(), null); assert.match(full.html(), /16 \/ 16 conditions/);
  const deep = editor({ kind: 'and', terms: [fact(), windowClaim('amal')] }, false, fullGame);
  click(control(deep.tree(), 'or-1.2')); click(control(deep.tree(), 'and-1.2.1')); click(control(deep.tree(), 'or-1.2.1.1'));
  assert.equal(deep.error(), null); assert.match(deep.html(), /4 \/ 4 levels of grouping/);
});

void test('Amal play and Ready guides use exact native packets and opening passes rather than ordinary readiness', () => {
  for (const phase of [0, 4]) for (const ready of [false, true]) {
    const game = openingAmal(phase, ready ? { type: 'ready' } : { type: 'card', card: 'controlled-amal' }), sent: Action[] = [];
    for (const key of ['windowCards', 'compiled', 'preparation'])
      Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private Amal ${key} read`); }, configurable: true });
    if (ready) { game.amalCards = []; game.players.find(player => player.id === 'p')!.hand = []; }
    assert.ok(game.ready.includes('p')); assert.ok(!game.phaseOpening!.passed.includes('p'));
    const button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.equal(sent[0].turnActionPromiseEvent, event); assert.equal(sent[0].turnActionPromisePhase, phase);
    if (ready) assert.match(renderToStaticMarkup(button), /Pass this original phase opening/);
    else assert.equal(sent[0].card, 'controlled-amal');
    game.turnActionGuide = null;
    const html = markup(game); assert.match(html, /condition closes with this opening/);
    assert.match(html, /Amal halves available cash before ordinary payments become legal/); assert.doesNotMatch(html, /windowCards|controlled-amal/);
  }
});

void test('saved Amal callbacks retain opening identity, passed list, original source, owner quotes and physical custody', () => {
  for (const ready of [false, true]) for (const change of [
    (game: GameView) => { game.phaseOpening = { passed: [] }; },
    (game: GameView) => { game.phaseOpening!.passed.push('a'); },
    (game: GameView) => { game.phaseOpening!.passed.push('p'); },
    (game: GameView) => { game.phaseOpening = null; game.ready = []; },
    (game: GameView) => { game.amalWindowOpen = false; },
    (game: GameView) => { game.turnActionPromises[0].mixed = windowClaim('amal', 'phase-opening:2:3'); },
    (game: GameView) => { game.response = { kind: 'voice', owner: 'a', passed: [] }; },
  ]) {
    const game = openingAmal(4, ready ? { type: 'ready' } : { type: 'card', card: 'controlled-amal' });
    const saved = guide({ game, busy: false, act() { assert.fail('An obsolete original-opening action cannot send'); } });
    assert.equal(saved.props.disabled, false); change(game); press(saved);
  }
  const quoted = openingAmal(), saved = guide({ game: quoted, busy: false, act() { assert.fail('A removed physical Amal quote cannot send'); } });
  quoted.amalCards = []; press(saved);
  const cardGame = openingAmal(), cardButton = guide({ game: cardGame, busy: false, act() { assert.fail('A changed physical Amal cannot send'); } });
  const card = cardGame.players.find(player => player.id === 'p')!.hand?.[0]; assert.ok(card); card.effect = 'ghola'; press(cardButton);
  const readyGame = openingAmal(4, { type: 'ready' }), readyButton = guide({ game: readyGame, busy: false, act() { assert.fail('A removed native Amal Ready quote cannot send'); } });
  readyGame.amalReady = false; press(readyButton);
});

void test('Amal opening exception rejects extra fields, unquoted actions, Box and generic card fallback', () => {
  for (const ready of [false, true]) for (const extra of [{ amount: 0 }, { mode: 'shipment' }, { target: 'p' }, { event: 'literal-event' }, { phase: 4 }]) {
    const game = openingAmal(4, ready ? { type: 'ready' } : { type: 'card', card: 'controlled-amal' });
    Object.assign(game.turnActionGuide!.action, extra);
    const button = guide({ game, busy: false, act() { assert.fail('Only the original native Amal packet and existing envelope may send'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
  const unquoted = openingAmal(); unquoted.amalCards = [];
  assert.equal(guide({ game: unquoted, busy: false, act() { assert.fail('The actual Amal card must be natively quoted'); } }).props.disabled, true);
  const unavailableReady = openingAmal(4, { type: 'ready' }); unavailableReady.amalReady = false; unavailableReady.ready = [];
  assert.equal(guide({ game: unavailableReady, busy: false, act() { assert.fail('Ordinary Ready cannot bypass an unavailable opening Ready'); } }).props.disabled, true);
  const outside = openingAmal(); outside.phaseOpening = null;
  assert.equal(guide({ game: outside, busy: false, act() { assert.fail('An explicit source alone does not create a native Amal action'); } }).props.disabled, true);
  const other = openingAmal(5, { type: 'card', card: 'controlled-owned-karama' }); other.ready = []; other.active = 'p';
  assert.equal(guide({ game: other, busy: false, act() { assert.fail('Other native cards keep the phase-opening veto'); } }).props.disabled, true);
  const boxed = openingAmal(0), me = boxed.players.find(player => player.id === 'p')!;
  const box = { id: 'controlled-box', name: 'Nullentropy Box', kind: 'special' as const, effect: 'nullentropyBox' };
  me.hand = [box]; boxed.nullentropy = { card: box, blocked: null, search: null };
  boxed.turnActionGuide!.action = { type: 'card', card: box.id, turnActionPromiseEvent: event, turnActionPromisePhase: 0 };
  assert.equal(guide({ game: boxed, busy: false, act() { assert.fail('A quoted Box cannot bypass the native opening priority'); } }).props.disabled, true);
});

void test('native turn-action answers work in an unchanged quoted opening and reject changed passed or modal sources', () => {
  for (const mixed of [windowClaim('amal'), claim()]) {
    const game = answering(4); game.phaseOpening = { passed: ['a'] }; game.amalWindowOpen = true;
    game.truthtrance!.question = { kind: 'turnActions', target: 'p', turn: 2, mixed };
    const sent: Action[] = [], tree = TurnActionAnswers({ game, busy: false, act(action) { sent.push(action); } });
    const button = find(tree, 'data-turn-action-answer', 'yes'); assert.equal(button.props.disabled, false); click(button);
    assert.deepEqual(sent, [{ type: 'truthAnswer', answer: 'yes' }]);
    game.phaseOpening.passed.push('r'); click(button); assert.equal(sent.length, 1);
  }
  for (const change of [
    (game: GameView) => { game.phaseOpening = { passed: [] }; },
    (game: GameView) => { game.phaseOpening = null; },
    (game: GameView) => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
  ]) {
    const game = answering(4); game.phaseOpening = { passed: [] };
    const button = find(TurnActionAnswers({ game, busy: false, act() { assert.fail('A changed opening answer source cannot send'); } }), 'data-turn-action-answer', 'yes');
    assert.equal(button.props.disabled, false); change(game); click(button);
  }
});

void test('turn-action printed-role editor uses public names without holdings or private stages and retains the shared logical budget', () => {
  const game = projected();
  for (const player of game.players) for (const key of ['hand', 'spice', 'traitors', 'faceDancers', 'tanks', 'leaders', 'hajrAvailable'])
    Object.defineProperty(player, key, { get() { throw Error(`No private ${key} authoring inspection`); }, configurable: true });
  Object.defineProperty(game, 'ghola', { get() { throw Error('No private Ghola authoring inspection'); }, configurable: true });
  Object.defineProperty(game, 'nullentropy', { get() { throw Error('No private Box authoring inspection'); }, configurable: true });
  Object.defineProperty(game, 'distrans', { get() { throw Error('No private Distrans authoring inspection'); }, configurable: true });
  Object.defineProperty(game, 'saphoOptions', { get() { throw Error('No private Sapho authoring inspection'); }, configurable: true });
  Object.defineProperty(game.turnActionPromises[0], 'cardPlays', { get() { throw Error('No private card-play stage'); } });
  const e = editor(physical(), false, game); select(e.tree(), '1', 'action', 'cardPlay');
  assert.deepEqual(e.value, printedCard()); assert.equal(e.error(), null);
  const choices = elements(find(e.tree(), 'id', 'truth-turn-action-1-effect')).filter(element => element.type === 'option');
  assert.deepEqual(choices.map(choice => choice.props.value), ['hajr', 'ghola', 'nullentropyBox', 'distrans', 'juiceOfSapho']);
  select(e.tree(), '1', 'effect', 'ghola'); assert.deepEqual(e.value, printedCard('ghola')); assert.equal(e.error(), null);
  select(e.tree(), '1', 'effect', 'karama'); assert.deepEqual(e.value, printedCard('ghola'));
  select(e.tree(), '1', 'effect', 'nullentropyBox'); assert.deepEqual(e.value, printedCard('nullentropyBox')); assert.equal(e.error(), null);
  for (const effect of ['distrans', 'juiceOfSapho'] as const) {
    select(e.tree(), '1', 'effect', effect); assert.deepEqual(e.value, printedCard(effect)); assert.equal(e.error(), null);
    for (const extra of [{ target: 'r' }, { give: 'private-card' }, { scope: 'movement' }, { event: 'private-source' }, { mode: 'first' }])
      assert.ok(turnActionInputError({ kind: 'action', action: { kind: 'cardPlay', effect, ...extra } }, game, 'p'));
  }
  assert.ok(turnActionInputError({ kind: 'action', action: { kind: 'cardPlay', effect: 'ghola', card: 'private-card-id' } }, game, 'p'));
  assert.ok(turnActionInputError({ kind: 'action', action: { kind: 'cardPlay', effect: 'karama' } }, game, 'p'));
  for (const extra of [{ card: 'private-box-id' }, { selected: 'private-recovery' }, { amount: 2 }])
    assert.ok(turnActionInputError({ kind: 'action', action: { kind: 'cardPlay', effect: 'nullentropyBox', ...extra } }, game, 'p'));
  const draft = editor({ kind: 'action', action: { kind: 'cardPlay', effect: 'unknown-role' } } as unknown as Expression, false, game);
  assert.ok(draft.error()); select(draft.tree(), '1', 'effect', 'nullentropyBox');
  assert.deepEqual(draft.value, printedCard('nullentropyBox')); assert.equal(draft.error(), null);
  const html = e.html(); assert.match(html, /Play Hajr in its printed role after this answer this turn/);
  assert.match(html, /Play Tleilaxu Ghola in its printed role after this answer this turn/);
  assert.match(html, /Activate Nullentropy Box and pay 2 spice after this answer this turn/);
  assert.match(html, /The selected recovered card stays private and is not promised/);
  assert.match(html, /Play Distrans in its printed role after this answer this turn/);
  assert.match(html, /Play Juice of Sapho in its printed role after this answer this turn/);
  assert.match(html, /not a particular recipient, transferred card or order outcome/);
  assert.match(html, /Hajr counts when played even if its extra movement is unused/);
  assert.match(html, /an actual later replay after Box recovery does/); assert.doesNotMatch(html, /private-card-id|controlled-ghola|controlled-hajr/);
  const full = editor({ kind: 'or', terms: [printedCard(), printedCard('nullentropyBox')] }, false, game);
  for (let count = 3; count <= 16; count++) {
    click(control(full.tree(), 'add-action-1')); select(full.tree(), `1.${count}`, 'action', 'cardPlay');
    select(full.tree(), `1.${count}`, 'effect', count % 2 ? 'distrans' : 'juiceOfSapho');
  }
  assert.equal(full.error(), null); assert.match(full.html(), /16 \/ 16 conditions/);
  assert.equal(control(full.tree(), 'add-action-1').props.disabled, true);
  const deep = editor({ kind: 'and', terms: [fact(), printedCard('nullentropyBox')] }, false, game);
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

void test('printed Box guides activate the quoted physical card without inspecting private recovery choices', () => {
  for (const phase of [0, 6, 8]) {
    const game = boxPlay(phase), sent: Action[] = [];
    Object.defineProperty(game, 'discard', { get() { throw Error('The activation guide does not search the discard'); }, configurable: true });
    Object.defineProperty(game.turnActionPromises[0], 'cardPlays', { get() { throw Error('No private Box receipt inspection'); } });
    const button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.deepEqual(sent[0], { type: 'card', card: 'controlled-box', turnActionPromiseEvent: event, turnActionPromisePhase: phase });
    const html = markup(game);
    assert.match(html, /Pay 2 spice to activate Nullentropy Box/);
    assert.match(html, /you activate Nullentropy Box in its printed role and pay its 2-spice search cost/);
    assert.match(html, /The selected recovered card stays private and is not promised/);
    assert.match(html, /complete the paid search with the existing native controls/);
    assert.doesNotMatch(html, /cardPlays|controlled-box|recovered-card-id/);
  }
});

void test('printed Box activation callbacks reject changed native quotes, custody, source and paid-search state', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.nullentropy = null; },
    game => { game.nullentropy = { ...game.nullentropy! }; },
    game => { game.nullentropy!.blocked = 'The printed search cost is not currently available.'; },
    game => { game.nullentropy!.card = { ...game.nullentropy!.card, id: 'different-box' }; },
    game => { game.players.find(player => player.id === 'p')!.hand = []; },
    game => { game.players.find(player => player.id === 'p')!.hand![0].kind = 'worthless'; },
    game => { game.players.find(player => player.id === 'p')!.spice = 2; },
    game => { game.players.find(player => player.id === 'p')!.handLimit = 5; },
    game => { game.turnActionPromises[0].mixed = payment(); },
    game => { game.phase = 8; },
    game => { game.turnActionGuide!.event = 'different-answer'; },
    game => { game.phaseOpening = { passed: [] }; },
    game => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
    game => {
      game.nullentropy!.search = { event: 'now-paid-search', cards: [] };
      Object.defineProperty(game.nullentropy!.search, 'cards', { get() { throw Error('An activation guide cannot inspect paid recovery choices'); } });
    },
  ];
  for (const change of changes) {
    const game = boxPlay(2), sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); change(game); press(button); assert.deepEqual(sent, []);
  }
  for (const change of [
    (game: GameView) => { game.nullentropy = null; },
    (game: GameView) => { game.nullentropy!.blocked = 'No legal search is currently quoted.'; },
    (game: GameView) => { game.nullentropy!.search = { event: 'already-paid', cards: [] }; },
  ]) {
    const game = boxPlay(); change(game);
    const button = guide({ game, busy: false, act() { assert.fail('An unavailable or already paid Box cannot activate'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
});

void test('printed Box activation accepts no private selection or extra native parameters through generic preparation', () => {
  for (const extra of [{ amount: 2 }, { mode: 'shipment' }, { target: 'a' }, { leader: 'private-leader' },
    { selected: 'recovered-card-id' }, { cards: ['recovered-card-id'] }]) {
    const game = boxPlay(2); Object.assign(game.turnActionGuide!.action, extra);
    const button = guide({ game, busy: false, act() { assert.fail('A Box activation must remain the exact quoted card packet'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
  const game = boxPlay(8); game.turnActionPromises[0].mixed = payment();
  assert.equal(guide({ game, busy: false, act() { assert.fail('A turn-end Box activation requires its matching raw role'); } }).props.disabled, true);
});

void test('printed Distrans guide forwards its exact owned transfer quote without inspecting foreign hands', () => {
  const game = distransPlay(), sent: Action[] = [];
  for (const player of game.players.filter(player => player.id !== 'p'))
    Object.defineProperty(player, 'hand', { get() { throw Error('Distrans uses the native capacity quote, not foreign hands'); }, configurable: true });
  Object.defineProperty(game.turnActionPromises[0], 'cardPlays', { get() { throw Error('No private Distrans receipt inspection'); } });
  const button = guide({ game, busy: false, act(action) { sent.push(action); } });
  assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
  assert.deepEqual(sent[0], { type: 'card', card: game.distrans!.card.id, target: 'r', give: game.distrans!.choices[0].cards[0].id,
    turnActionPromiseEvent: event, turnActionPromisePhase: 2 });
  assert.match(markup(game), /Give Shield to Recipient with Distrans/);
});

void test('printed Distrans callbacks reject stale availability, physical cards, capacity and raw source', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.distrans = null; },
    game => { game.distrans = { ...game.distrans! }; },
    game => { game.distrans!.blocked = 'Finish the current native interaction.'; },
    game => { game.distrans!.choices[0].blocked = 'The recipient is full.'; },
    game => { game.distrans!.choices[0].cards = []; },
    game => { game.players.find(player => player.id === 'p')!.hand!.pop(); },
    game => { game.players.find(player => player.id === 'r')!.handCount = 4; },
    game => { game.players.find(player => player.id === 'r')!.handLimit = 3; },
    game => { game.turnActionPromises[0].mixed = payment(); },
    game => { game.phase = 3; },
    game => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    game => { game.turnActionGuide!.action.give = 'different-held-card'; },
  ];
  for (const change of changes) {
    const game = distransPlay(), sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); change(game); press(button); assert.deepEqual(sent, []);
  }
  for (const change of [
    (game: GameView) => { game.turnActionGuide!.action.target = 'p'; },
    (game: GameView) => { game.turnActionGuide!.action.target = 'a'; },
    (game: GameView) => { game.turnActionGuide!.action.give = game.distrans!.card.id; },
    (game: GameView) => { game.turnActionGuide!.action.give = 'unquoted-card'; },
  ]) {
    const game = distransPlay(); change(game);
    const button = guide({ game, busy: false, act() { assert.fail('Distrans must use its current quoted recipient and other held card'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
});

void test('printed Sapho guides forward every quoted native scope and retain display metadata outside the action', () => {
  const options: [number, NonNullable<GameView['saphoOptions']>[number]][] = [
    [3, { scope: 'onceAround', event: 'controlled-once-around', mode: 'first' }],
    [3, { scope: 'cyclicAuction', event: 'controlled-cyclic', mode: 'last' }],
    [4, { scope: 'revival', event: 'controlled-revival', mode: 'last', afterCurrent: 'a' }],
    [5, { scope: 'movement', event: 'controlled-movement', mode: 'first', afterCurrent: 'a' }],
    [6, { scope: 'battleOrder', event: 'controlled-battle-order', mode: 'last' }],
    [6, { scope: 'battleAggressor', event: 'controlled-aggressor', mode: 'aggressor' }],
    [8, { scope: 'extortion', event: 'controlled-extortion-order', mode: 'first' }],
  ];
  for (const [phase, option] of options) {
    const game = saphoPlay(phase, option), sent: Action[] = [];
    if (option.scope === 'extortion') game.decision = { kind: 'moritaniExtortion', player: 'p', event: 'controlled-native-extortion' };
    for (const player of game.players.filter(player => player.id !== 'p'))
      Object.defineProperty(player, 'hand', { get() { throw Error('Sapho uses the native option, not foreign hands'); }, configurable: true });
    Object.defineProperty(game.turnActionPromises[0], 'cardPlays', { get() { throw Error('No private Sapho receipt inspection'); } });
    const button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
    assert.deepEqual(sent[0], { type: 'card', card: 'richese-juice-of-sapho', scope: option.scope, event: option.event, mode: option.mode,
      turnActionPromiseEvent: event, turnActionPromisePhase: phase });
    assert.equal(Object.hasOwn(sent[0], 'afterCurrent'), false);
    assert.match(markup(game), /Play Juice of Sapho:/);
  }
});

void test('printed Sapho callbacks and both role guides reject stale quotes or modified packets without generic fallback', () => {
  for (const change of [
    (game: GameView) => { game.saphoOptions = []; },
    (game: GameView) => { game.saphoOptions = [...game.saphoOptions]; },
    (game: GameView) => { game.saphoOptions[0].event = 'different-native-source'; },
    (game: GameView) => { game.saphoOptions[0].mode = 'first'; },
    (game: GameView) => { game.players.find(player => player.id === 'p')!.hand = []; },
    (game: GameView) => { game.players.find(player => player.id === 'p')!.handLimit = 5; },
    (game: GameView) => { game.turnActionPromises[0].mixed = payment(); },
    (game: GameView) => { game.phaseOpening = { passed: [] }; },
    (game: GameView) => { game.response = { kind: 'guildIncome', owner: 'a', amount: 1, passed: [] }; },
  ]) {
    const game = saphoPlay(), sent: Action[] = [], button = guide({ game, busy: false, act(action) { sent.push(action); } });
    assert.equal(button.props.disabled, false); change(game); press(button); assert.deepEqual(sent, []);
  }
  for (const change of [
    (game: GameView) => {
      const current = game.decision; assert.ok(current?.kind === 'moritaniExtortion');
      game.decision = { ...current, event: 'next-native-extortion' };
    },
    (game: GameView) => { game.decision = null; },
  ]) {
    const game = saphoPlay(8, { scope: 'extortion', event: 'controlled-extortion-order', mode: 'first' });
    game.decision = { kind: 'moritaniExtortion', player: 'p', event: 'controlled-native-extortion' };
    const saved = guide({ game, busy: false, act() { assert.fail('A changed Extortion source cannot submit an earlier Sapho option'); } });
    assert.equal(saved.props.disabled, false); change(game); press(saved);
  }
  for (const create of [distransPlay, () => saphoPlay(4, { scope: 'revival', event: 'controlled-revival', mode: 'last' })]) {
    for (const extra of [{ amount: 1 }, { mode: 'shipment' }, { target: 'a' }, { give: 'unquoted-card' },
      { scope: 'unsupported' }, { event: 'different-source' }, { afterCurrent: 'a' }]) {
      const game = create(); Object.assign(game.turnActionGuide!.action, extra);
      const button = guide({ game, busy: false, act() { assert.fail('Printed-role guides forward only the exact native action fields'); } });
      assert.equal(button.props.disabled, true); press(button);
    }
    const game = create(), sent: Action[] = [], props = { game, busy: false, act(action: Action) { sent.push(action); } }, button = guide(props);
    assert.equal(button.props.disabled, false); props.busy = true; press(button); assert.deepEqual(sent, []);
  }
});

void test('printed-card history retains only raw aggregate conditions and their distinct native deadlines', () => {
  const game = projected(8); game.turnActionGuide = null;
  game.turnActionPromises[0].mixed = { kind: 'or', terms: [printedCard(), { kind: 'and', terms: [fact(), printedCard('ghola'), printedCard('nullentropyBox'), printedCard('distrans'), printedCard('juiceOfSapho')] }] };
  game.turnActionPromises[0].answer = false;
  for (const key of ['cardPlays', 'compiled', 'combat', 'preparation'])
    Object.defineProperty(game.turnActionPromises[0], key, { get() { throw Error(`No private ${key} inspection`); }, configurable: true });
  const html = markup(game);
  assert.match(html, /Hajr/); assert.match(html, /Tleilaxu Ghola/); assert.match(html, /You answered No/);
  assert.match(html, /Hajr counts even if its extra movement is unused/);
  assert.match(html, /Earlier plays, discards, sales, Karama roles and recovery alone do not count/);
  assert.match(html, /actual later Box replay does/); assert.match(html, /Ghola is separate from ordinary Revival/);
  assert.match(html, /you activate Nullentropy Box/); assert.match(html, /Box conditions close at the actual turn end/);
  assert.match(html, /Distrans/); assert.match(html, /Juice of Sapho/);
  assert.match(html, /The deadline is the actual turn end, including for a whole No answer/);
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

void test('whole payment timelines forward an exact positive unused Charity quote without treating it as current cash', () => {
  const game = projected(2, { type: 'charity' }), sent: Action[] = [];
  game.turnActionPromises[0].mixed = payment(3); game.bribeOptions.available = 0; game.bribeOptions.targets = [];
  const button = guide({ game, busy: false, act(action) { sent.push(action); } });
  assert.equal(button.props.disabled, false); press(button); assert.equal(sent[0], game.turnActionGuide!.action);
  assert.deepEqual(sent[0], { type: 'charity', turnActionPromiseEvent: event, turnActionPromisePhase: 2 });
  assert.equal(game.players.find(player => player.id === 'p')!.spice, 0);
  assert.match(markup(game), /Claim 2 Charity spice while preserving your whole answer/);
  assert.match(markup(game), /future claim is not current spendable spice/);
});

void test('whole CHOAM commitments explain pending automatic income while ordinary Charity still waits for its native quote', () => {
  const game = projected(2, { type: 'charity' }); game.players.find(player => player.id === 'p')!.faction = 'choam'; game.expansions = ['choam'];
  game.charity.incomePending = true; game.charity.incomeCanceled = false;
  const html = markup(game); assert.match(html, /data-testid="choam-pending-payment-income"/);
  assert.match(html, /not current spendable cash/); assert.match(html, /ordinary Charity claim is separate/);
  assert.match(html, /Karama or opposing claims can change the funding/); assert.match(html, /may still offer legal prepayments/);
  const sent: Action[] = [], pending = guide({ game, busy: false, act(action) { sent.push(action); } });
  assert.equal(pending.props.disabled, true); press(pending); assert.equal(sent.length, 0);
  game.charity.incomePending = false; game.charity.incomeCanceled = true;
  press(pending); assert.equal(sent.length, 0, 'The old source quote remains stale after automatic income is canceled.');
  assert.doesNotMatch(markup(game), /data-testid="choam-pending-payment-income"/);
  const current = guide({ game, busy: false, act(action) { sent.push(action); } });
  assert.equal(current.props.disabled, false); press(current); assert.equal(sent[0], game.turnActionGuide!.action);
});

void test('whole automatic-income guidance stays private to live CHOAM owners before the Charity opening resolves', () => {
  for (const change of [
    (game: GameView) => { game.players.find(player => player.id === 'p')!.faction = 'emperor'; game.players.find(player => player.id === 'a')!.faction = 'choam'; },
    (game: GameView) => { game.me = 'a'; },
    (game: GameView) => { game.charity.incomePending = false; game.charity.incomeCanceled = true; },
    (game: GameView) => { game.charity.multiplier = 0; },
    (game: GameView) => { game.phase = 3; },
    (game: GameView) => { game.turnActionPromises[0].fulfilled = true; },
    (game: GameView) => { game.turnActionPromises[0].released = true; },
  ]) {
    const game = projected(1); game.players.find(player => player.id === 'p')!.faction = 'choam'; game.expansions = ['choam'];
    game.charity.incomePending = true; game.charity.incomeCanceled = false; game.turnActionGuide = null;
    assert.match(markup(game), /data-testid="choam-pending-payment-income"/); change(game);
    assert.doesNotMatch(markup(game), /data-testid="choam-pending-payment-income"/);
  }
});

void test('whole Charity guides reject claimed, stale, unready native quotes and extra fields without generic fallback', () => {
  for (const change of [
    (game: GameView) => { game.players.find(player => player.id === 'p')!.charityClaimed = true; },
    (game: GameView) => { game.charity.amount = 0; },
    (game: GameView) => { game.charity.incomePending = true; },
    (game: GameView) => { game.charity = { ...game.charity }; },
    (game: GameView) => { game.players.find(player => player.id === 'p')!.spice = 1; },
    (game: GameView) => { game.ready.push('p'); },
    (game: GameView) => { game.phase = 3; },
  ]) {
    const game = projected(2, { type: 'charity' }), saved = guide({ game, busy: false, act() { assert.fail('A stale whole-answer Charity claim cannot send'); } });
    assert.equal(saved.props.disabled, false); change(game); press(saved);
  }
  for (const extra of [{ target: 'r' }, { amount: 2 }, { card: 'private-card' }, { mode: 'shipment' }]) {
    const game = projected(2, { type: 'charity' }); Object.assign(game.turnActionGuide!.action, extra);
    const button = guide({ game, busy: false, act() { assert.fail('Charity accepts no extra native parameters'); } });
    assert.equal(button.props.disabled, true); press(button);
  }
  const pending = projected(2, { type: 'charity' }); pending.charity.incomePending = true;
  assert.equal(guide({ game: pending, busy: false, act() { assert.fail('Pending CHOAM income cannot be counted as an ordinary claim'); } }).props.disabled, true);
  const ready = projected(2, { type: 'charity' }); ready.ready.push('p');
  assert.equal(guide({ game: ready, busy: false, act() { assert.fail('A readied owner cannot open this preparation guide'); } }).props.disabled, true);
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
