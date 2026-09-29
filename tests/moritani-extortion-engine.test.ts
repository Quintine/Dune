import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { richeseCards } from '../game/richese-cards';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { homeworldRevivalFixture, holdRevivalCard } from './fixture-homeworld-revival';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const extortionToken = (g: Game) =>
  g.moritaniTerror!.tokens.find((t) => t.kind === 'extortion')!;
const payment = (g: Game, pay: boolean): Action => ({
  type: 'decision',
  event: (g.decision as Extract<NonNullable<Game['decision']>, { kind: 'moritaniExtortion' }>).event,
  pay,
});
function reject(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function fixture(choam = false) {
  const g = createGame('EXTORT01', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('b', 'Harkonnen', 'harkonnen'),
  );
  if (choam) g.players.push(newPlayer('c', 'CHOAM', 'choam'));
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.active = 'e';
  g.order = g.players.map((p) => p.id);
  g.movementRemaining = [...g.order];
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.spice = 12;
    p.hand = [];
  }
  g.moritaniTerror = createTerrorState(() => 0);
  const token = extortionToken(g);
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  return g;
}
function reveal(initial = fixture()) {
  const offered = applyAction(initial, 'e', {
    type: 'ship', territory: 'arrakeen', sector: 10, amount: 2,
  });
  assert.equal(offered.decision?.kind, 'moritaniTerror');
  assert.equal(viewGame(offered, 'm').terrorEntry!.kind, 'extortion');
  assert.equal(viewGame(offered, 'm').terrorEntry!.canReveal, true);
  const before = player(offered, 'm').spice;
  const g = applyAction(offered, 'm', { type: 'decision', reveal: true });
  assert.equal(player(g, 'm').spice, before, 'bank spice remains unspendable until Mentat');
  assert.equal(extortionToken(g).status, 'extortion');
  assert.equal(extortionToken(g).location, null);
  assert.equal(viewGame(g, 'e').extortion.deferred, 5);
  assert.equal(viewGame(g, 'e').extortion.pending, null);
  return g;
}
function mentat(input: Game) {
  const g = structuredClone(input);
  g.phase = 7;
  g.ready = [];
  let next = g;
  for (const p of g.players) next = applyAction(next, p.id, { type: 'ready' });
  if (next.decision?.kind === 'choamMarket')
    next = applyAction(next, 'c', { type: 'decision', done: true });
  assert.equal(next.phase, 8);
  assert.equal(next.decision?.kind, 'moritaniPlacement');
  return next;
}
function collect(g: Game) {
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  const before = player(g, 'm').spice;
  const next = applyAction(g, 'm', { type: 'decision', decline: true });
  assert.equal(player(next, 'm').spice, before + 5);
  assert.equal(viewGame(next, 'e').extortion.deferred, 0);
  assert.equal(next.decision?.kind, 'moritaniExtortion');
  assert.equal(extortionToken(next).status, 'extortion');
  return next;
}

void test('real entry reserves five, then placement precedes one Mentat award and storm-order payer choices', () => {
  const revealed = reveal();
  reject(revealed, 'e', { type: 'decision', event: 'old', pay: true });
  let g = mentat(reload(revealed));
  assert.equal(player(g, 'm').spice, player(revealed, 'm').spice);
  reject(g, 'e', { type: 'decision', event: 'old', pay: true });
  g = collect(g);
  const first = g.decision;
  assert.ok(first?.kind === 'moritaniExtortion');
  assert.equal(first.player, g.order.filter((id) => id !== 'm')[0]);
  assert.equal(viewGame(g, first.player).extortion.pending?.amount, 3);
  assert.equal(viewGame(g, first.player).extortion.pending?.canPay, true);
  assert.equal(viewGame(g, 'm').extortion.pending?.event, first.event);
  for (const observer of g.players.filter(seat => seat.id !== first.player))
    assert.equal(viewGame(g, observer.id).extortion.pending?.canPay, null);
  reject(g, 'm', payment(g, true));
  reject(g, first.player, { type: 'decision', event: 'stale', pay: false });
  const declined = applyAction(g, first.player, payment(g, false));
  assert.equal(player(declined, 'm').spice, player(g, 'm').spice);
  assert.equal(extortionToken(declined).status, 'extortion');
  const second = declined.decision;
  assert.ok(second?.kind === 'moritaniExtortion');
  assert.equal(second.player, g.order.filter((id) => id !== 'm')[1]);
  assert.notEqual(second.event, first.event);
  reject(declined, second.player, { type: 'decision', event: first.event, pay: true });
  const ownerBefore = player(declined, 'm').spice;
  const payerBefore = player(declined, second.player).spice;
  const paid = applyAction(declined, second.player, payment(declined, true));
  assert.equal(player(paid, second.player).spice, payerBefore - 3);
  assert.equal(player(paid, 'm').spice, ownerBefore + 3);
  assert.equal(extortionToken(paid).status, 'removed');
  assert.equal(extortionToken(paid).location, null);
  assert.equal(paid.decision?.kind === 'moritaniExtortion', false);
  assert.equal(viewGame(paid, 'a').extortion.pending, null);
  reject(paid, second.player, payment(declined, true));
  assert.equal(paid.moritaniTerror!.tokens.filter((t) => t.kind === 'extortion').length, 1);
});

void test('a declared placement response settles before deferred Extortion collection, without a second same-turn placement', () => {
  let g = mentat(reveal());
  const before = player(g, 'm').spice;
  const supplyToken = g.moritaniTerror!.tokens.find((t) => t.status === 'available')!;
  player(g, 'a').hand = [baseDeck().find(card => card.effect === 'karama')!];
  g = applyAction(g, 'm', {
    type: 'decision', token: supplyToken.id, territory: 'carthag',
  });
  assert.equal(g.response?.kind, 'moritaniPlacement');
  assert.equal(player(g, 'm').spice, before);
  assert.equal(viewGame(g, 'a').extortion.deferred, 5);
  for (let i = 0; g.response && i < g.players.length; i++) {
    const responder = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(g, responder.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  assert.equal(g.decision?.kind, 'moritaniExtortion');
  assert.equal(player(g, 'm').spice, before + 5);
  assert.equal(g.moritaniTerror!.tokens.find((t) => t.id === supplyToken.id)?.location, 'carthag');
  assert.equal(extortionToken(g).status, 'extortion');
  reject(g, 'm', { type: 'decision', token: supplyToken.id, territory: 'tueks_sietch' });
});

void test('Karama cancellation consumes placement before the reserved award and Extortion choices', () => {
  let g = mentat(reveal());
  const before = player(g, 'm').spice;
  const supplyToken = g.moritaniTerror!.tokens.find(token => token.status === 'available')!;
  const karama = baseDeck().find(card => card.effect === 'karama')!;
  player(g, 'a').hand = [karama];
  g = applyAction(g, 'm', { type: 'decision', token: supplyToken.id, territory: 'carthag' });
  assert.equal(g.response?.kind, 'moritaniPlacement');
  g = applyAction(reload(g), 'a', { type: 'card', mode: 'cancel', card: karama.id });
  assert.equal(g.moritaniTerror!.tokens.find(token => token.id === supplyToken.id)?.status, 'available');
  assert.equal(g.moritaniTerror!.placementTurn, g.turn);
  assert.equal(player(g, 'm').spice, before + 5);
  assert.equal(g.decision?.kind, 'moritaniExtortion');
  assert.equal(viewGame(g, 'e').extortion.pending?.player, 'e');
});

void test('all players including an ally and an insolvent payer get a decline; all pass returns and rotates hidden supply', () => {
  const initial = fixture();
  player(initial, 'm').ally = 'a';
  player(initial, 'a').ally = 'm';
  player(initial, 'b').spice = 0;
  let g = collect(mentat(reveal(initial)));
  const oldSupply = new Set(g.moritaniTerror!.tokens.map((t) => t.id));
  const formerToken = extortionToken(g).id;
  const expected = g.order.filter((id) => id !== 'm');
  for (const id of expected) {
    assert.ok(g.decision?.kind === 'moritaniExtortion');
    assert.equal(g.decision.player, id);
    const projection = viewGame(g, id).extortion.pending!;
    assert.equal(projection.player, id);
    assert.equal(projection.canPay, player(g, id).spice >= 3);
    if (id === 'b') reject(g, id, payment(g, true));
    const before = player(g, 'm').spice;
    g = applyAction(reload(g), id, payment(g, false));
    assert.equal(player(g, 'm').spice, before);
  }
  assert.equal(g.decision?.kind === 'moritaniExtortion', false);
  assert.equal(extortionToken(g).status, 'available');
  assert.equal(extortionToken(g).location, null);
  assert.equal(g.moritaniTerror!.tokens.some((t) => t.id === formerToken), false);
  assert.ok(g.moritaniTerror!.tokens.every((t) => !oldSupply.has(t.id)));
  assert.equal(g.moritaniTerror!.tokens.length, 6);
  assert.equal(viewGame(g, 'e').moritaniTerror!.tokens.length, 0);
  assert.equal(viewGame(g, 'e').extortion.pending, null);
  reject(g, expected.at(-1)!, { type: 'decision', event: 'expired', pay: false });
});

void test('reloaded reveal and payer preserve private identity, event, and exactly one bank collection', () => {
  const revealed = reveal();
  const publicBefore = viewGame(revealed, 'a');
  assert.equal(JSON.stringify(publicBefore).includes(extortionToken(revealed).id), true);
  assert.equal(JSON.stringify(publicBefore).includes('terror-supply-'), false);
  const opened = mentat(reload(revealed));
  reject(opened, 'e', { type: 'decision', event: 'unissued', pay: false });
  const pending = collect(reload(opened));
  const event = pending.decision?.kind === 'moritaniExtortion' ? pending.decision.event : '';
  assert.ok(event);
  const restored = reload(pending);
  assert.ok(restored.decision?.kind === 'moritaniExtortion');
  assert.equal(restored.decision.event, event);
  assert.equal(player(restored, 'm').spice, player(revealed, 'm').spice + 5);
  const next = applyAction(restored, restored.decision.player, payment(restored, false));
  assert.equal(player(next, 'm').spice, player(restored, 'm').spice);
  reject(next, restored.decision.player, payment(restored, true));
});

void test('Extortion choices delay an otherwise won table; CHOAM keeps its later market', () => {
  for (const choam of [false, true]) {
    const initial = fixture(choam);
    player(initial, 'a').forces = {
      'carthag:11': 1, 'sietch_tabr:14': 1, 'tueks_sietch:5': 1,
    };
    player(initial, 'a').reserves = 17;
    let g = collect(mentat(reveal(initial)));
    assert.equal(g.status, 'playing');
    assert.deepEqual(g.winner, []);
    assert.equal(viewGame(g, 'a').mentatVictoryPending, true);
    assert.ok(g.decision?.kind === 'moritaniExtortion');
    g = applyAction(g, g.decision.player, payment(g, true));
    if (choam) {
      assert.equal(g.status, 'playing');
      for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
      assert.equal(g.decision?.kind, 'choamMarket');
    } else {
      assert.equal(g.status, 'finished');
      assert.deepEqual(g.winner, ['a']);
    }
  }
});

void test('bot payers can finish saved Extortion choices without stalling or leaking hidden supply', () => {
  let g = collect(mentat(reveal()));
  const originalId = extortionToken(g).id;
  for (const payer of g.players) if (payer.id !== 'm') payer.bot = 'Easy';
  for (let turn = 0; g.decision?.kind === 'moritaniExtortion' && turn < g.players.length; turn++) {
    const payer = g.decision.player;
    const action = botActions(viewGame(reload(g), payer))[0];
    assert.ok(action, `${payer} must have a legal AI payment decision`);
    g = applyAction(g, payer, action);
  }
  assert.notEqual(g.decision?.kind, 'moritaniExtortion');
  assert.equal(g.moritaniTerror!.tokens.some(token => token.id === originalId), false);
  assert.equal(extortionToken(g).status, 'available');
});

void test('a paid Nullentropy search suspends and restores the payer without losing Extortion or a second bank award', () => {
  const initial = fixture();
  initial.expansions = ['choam'];
  initial.deck = baseDeck();
  initial.discard = initial.deck.splice(0, 3);
  const box = richeseCards().find(card => card.id === 'richese-nullentropy-box')!;
  player(initial, 'e').hand.push(box);
  let g = collect(mentat(reveal(initial)));
  const ownerSpice = player(g, 'm').spice;
  assert.equal(g.decision?.kind, 'moritaniExtortion');
  const event = g.decision.event;
  g = applyAction(g, 'e', { type: 'card', card: box.id });
  assert.equal(g.decision?.kind, 'nullentropy');
  assert.equal(g.pendingNullentropy?.resume.decision?.kind, 'moritaniExtortion');
  assert.equal(viewGame(reload(g), 'e').decision?.kind, 'nullentropy');
  const selected = g.discard[0].id;
  g = applyAction(reload(g), 'e', { type: 'decision', event: g.pendingNullentropy!.event, card: selected });
  assert.equal(g.decision?.kind, 'moritaniExtortion');
  assert.equal(g.decision.event, event);
  g = applyAction(reload(g), 'e', payment(g, false));
  assert.equal(player(g, 'm').spice, ownerSpice);
  assert.equal(g.decision?.kind, 'moritaniExtortion');
});

void test('a Richese gift response suspends its payer and restores the same saved offer', () => {
  const initial = fixture();
  initial.expansions = ['choam'];
  initial.deck = baseDeck();
  initial.players[3] = newPlayer('b', 'Richese', 'richese');
  player(initial, 'b').spice = 12;
  player(initial, 'b').forces = {};
  player(initial, 'b').reserves = 20;
  player(initial, 'a').ally = 'b';
  player(initial, 'b').ally = 'a';
  const gift = richeseCards().find(card => card.id === 'richese-karama')!;
  player(initial, 'b').hand.push(gift);
  initial.richeseCache = richeseCards().filter(card => card.id !== gift.id);
  const karama = initial.deck.splice(initial.deck.findIndex(card => card.effect === 'karama'), 1)[0];
  player(initial, 'e').hand.push(karama);
  let g = collect(mentat(reveal(initial)));
  for (const payer of ['e', 'a']) g = applyAction(g, payer, payment(g, false));
  assert.equal(g.decision?.kind, 'moritaniExtortion');
  assert.equal(g.decision.player, 'b');
  const event = g.decision.event;
  g = applyAction(g, 'b', { type: 'richeseGift', card: gift.id });
  assert.equal(g.response?.kind, 'richeseGift');
  assert.equal(g.pendingRicheseGift?.resume.decision?.kind, 'moritaniExtortion');
  assert.equal(viewGame(reload(g), 'e').response?.kind, 'richeseGift');
  g = applyAction(reload(g), 'e', { type: 'passResponse' });
  assert.equal(g.decision?.kind, 'moritaniExtortion');
  assert.equal(g.decision.event, event);
  g = applyAction(g, 'b', payment(g, true));
  assert.equal(extortionToken(g).status, 'removed');
});

void test('a genuine late Mentat Ambassador entry settles Extortion after placement before the next turn', () => {
  let g = homeworldRevivalFixture({ advanced: true, extraSeats: [
    { id: 'ec', faction: 'ecaz' },
    { id: 'm', faction: 'moritani' },
    { id: 'a', faction: 'atreides' },
  ] });
  g.expansions.push('ecaz');
  g.phase = 8;
  g.ready = [];
  g.phaseOpening = null;
  g.decision = null;
  g.response = null;
  g.moritaniTerror ??= createTerrorState(() => 0);
  const token = extortionToken(g);
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'carthag', 1);
  g.moritaniTerror.placementTurn = g.turn;
  const supply = createAmbassadors(() => 0);
  const guild = supply.tokens.find(candidate => candidate.effect === 'guild')!;
  supply.cohort = [guild.id, ...supply.tokens.filter(candidate =>
    candidate.effect !== 'ecaz' && candidate.id !== guild.id).slice(0, 4).map(candidate => candidate.id)];
  for (const candidate of supply.tokens) {
    candidate.zone = candidate.effect === 'ecaz' || supply.cohort.includes(candidate.id) ? 'supply' : 'pool';
    candidate.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(supply, guild.id, { turn: 1, availableSpice: 20,
    destination: { id: 'arrakeen', stronghold: true, inStorm: false, allowed: true },
  }).state;
  const ghola = holdRevivalCard(g, 'f', 'ghola');
  g = applyAction(g, 'f', { type: 'card', card: ghola, amount: 1, elite: 1 });
  assert.equal(g.decision?.kind, 'homeworldRevivalDeployment');
  g = applyAction(reload(g), 'f', { type: 'decision', event: g.decision.event,
    destination: 'arrakeen:10', amount: 1 });
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  g = applyAction(g, 'ec', { type: 'decision', event: g.pendingAmbassador!.event,
    trigger: true, beneficiary: 'ec' });
  g = applyAction(reload(g), 'ec', { type: 'decision', event: g.pendingAmbassador!.event,
    amount: 2, territory: 'carthag', sector: 11 });
  assert.equal(g.pendingTerrorEntry?.stage, 'offer');
  const before = player(g, 'm').spice;
  g = applyAction(reload(g), 'm', { type: 'decision', reveal: true });
  assert.equal(g.phase, 8);
  assert.equal(g.homeworldRevivalReturn?.stage, 'complete');
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.decision?.kind, 'moritaniExtortion');
  assert.equal(player(g, 'm').spice, before + 5);
  assert.equal(viewGame(g, 'ec').extortion.deferred, 0);
  g = applyAction(reload(g), g.decision.player, payment(g, true));
  assert.equal(extortionToken(g).status, 'removed');
  for (const seat of g.players) g = applyAction(g, seat.id, { type: 'ready' });
  assert.equal(g.turn, 3);
  assert.equal(g.moritaniExtortion, undefined);
});
