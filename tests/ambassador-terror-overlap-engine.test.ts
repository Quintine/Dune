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
import { baseDeck } from '../game/cards';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror } from '../game/moritani-terror';

type Owner = 'ambassador' | 'terror';
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const seat = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const shipment: Action = { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 };
const movement: Action = {
  type: 'move',
  from: 'imperial_basin:10',
  territory: 'arrakeen',
  sector: 10,
  amount: 2,
};

/** Both inventories are physical, legally placed in the same stronghold. No optional module competes for arrival. */
function table(first: Owner, advanced: boolean, cause: 'shipment' | 'movement' = 'shipment') {
  const g = createGame('OVERLAP', newPlayer('ec', 'Ecaz', 'ecaz'), advanced, ['ecaz']);
  g.players.push(newPlayer('m', 'Moritani', 'moritani'), newPlayer('in', 'Entrant', 'harkonnen'));
  Object.assign(g, {
    status: 'playing', phase: 5, turn: 3, storm: 18, active: 'in',
    order: first === 'ambassador' ? ['ec', 'm', 'in'] : ['m', 'ec', 'in'],
    deck: baseDeck(),
  });
  g.movementRemaining = [...g.order];
  for (const player of g.players) {
    Object.assign(player, { hand: [], spice: 20, forces: {}, reserves: 20, shipped: false, moved: 0 });
  }
  if (cause === 'movement') {
    Object.assign(seat(g, 'in'), {
      shipped: true,
      forces: { 'imperial_basin:10': 3 },
      reserves: 17,
    });
  }
  const ambassadors = createAmbassadors(() => 0.2);
  const emperor = ambassadors.tokens.find((token) => token.effect === 'emperor')!;
  ambassadors.cohort = [
    emperor.id,
    ...ambassadors.tokens.filter((token) => token.effect !== 'ecaz' && token.id !== emperor.id)
      .slice(0, 4).map((token) => token.id),
  ];
  for (const token of ambassadors.tokens) {
    token.zone = token.effect === 'ecaz' || ambassadors.cohort.includes(token.id) ? 'supply' : 'pool';
    token.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(ambassadors, emperor.id, {
    turn: 2,
    availableSpice: 20,
    destination: { id: 'arrakeen', stronghold: true, inStorm: false, allowed: true },
  }).state;
  const terror = createTerrorState(() => 0.2);
  const robbery = terror.tokens.find((token) => token.kind === 'robbery')!;
  g.moritaniTerror = placeTerror(terror, robbery.id, 'arrakeen', 2);
  return { g, ambassadorToken: emperor.id, terrorToken: robbery.id };
}
function unchangedRejection(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function overlap(g: Game, first: Owner, active: Owner) {
  const pending = g.pendingArrivalOverlap;
  assert.ok(pending);
  assert.equal(pending.first, first);
  assert.equal(pending.stage, first === active ? 'first' : 'second');
  assert.equal(pending.entrant, 'in');
  assert.equal(pending.territory, 'arrakeen');
  assert.equal(pending.sector, 10);
  assert.equal(pending.amount, 2);
  assert.equal(pending.elite, 0);
  assert.equal(pending.turn, 3);
  assert.equal(pending.phase, 5);
  assert.equal(pending.ecaz, 'ec');
  assert.equal(pending.moritani, 'm');
  assert.ok(pending.signature);
  for (const id of ['ec', 'm', 'in']) {
    const view = viewGame(g, id);
    assert.deepEqual(view.arrivalOverlap, {
      first, active, entrant: 'in', territory: 'arrakeen',
    });
    assert.equal(JSON.stringify(view.arrivalOverlap).includes(pending.signature), false);
    assert.equal('pendingArrivalOverlap' in view, false);
  }
  return pending;
}
function privateTerror(g: Game, token: string) {
  const owner = viewGame(g, 'm');
  const entrant = viewGame(g, 'in');
  const ecaz = viewGame(g, 'ec');
  const ownToken = owner.moritaniTerror!.tokens.find((t) => t.id === token)!;
  const foreignTokens = [entrant, ecaz].map((v) => v.moritaniTerror!.tokens.find((t) => t.id === token)!);
  assert.equal('kind' in ownToken && ownToken.kind, 'robbery');
  for (const foreignToken of foreignTokens) assert.equal('kind' in foreignToken, false);
  for (const view of [entrant, ecaz]) {
    assert.equal('pendingTerrorEntry' in view, false);
    assert.equal(JSON.stringify(view).includes('"kind":"robbery"'), false);
  }
  if (g.pendingTerrorEntry) {
    assert.equal(owner.terrorEntry && 'kind' in owner.terrorEntry && owner.terrorEntry.kind, 'robbery');
    for (const view of [entrant, ecaz]) assert.equal('kind' in (view.terrorEntry ?? {}), false);
  }
}
function decideAmbassador(g: Game, trigger: boolean) {
  return applyAction(g, 'ec', {
    type: 'decision', event: g.pendingAmbassador!.event,
    ...(trigger ? { trigger: true, beneficiary: 'ec' } : { decline: true }),
  });
}
function decideTerror(g: Game, reveal: boolean) {
  return applyAction(g, 'm', { type: 'decision', ...(reveal ? { reveal: true } : { decline: true }) });
}

for (const advanced of [false, true])
  for (const first of ['ambassador', 'terror'] as const)
    for (const cause of ['shipment', 'movement'] as const) {
      void test(`${advanced ? 'Advanced' : 'Basic'} ${cause}: ${first} first, both optional offers and original entry survive JSON`, () => {
        const { g: initial, ambassadorToken, terrorToken } = table(first, advanced, cause);
        const action = cause === 'shipment' ? shipment : movement;
        const offered = applyAction(initial, 'in', action);
        const witness = overlap(offered, first, first);
        assert.equal(witness.cause, cause);
        assert.equal(witness.resume, 'none');
        assert.equal(witness.ambassadorToken, ambassadorToken);
        assert.deepEqual(witness.terrorTokens, [terrorToken]);
        assert.equal(offered.decision?.kind, first === 'ambassador' ? 'ecazAmbassador' : 'moritaniTerror');
        assert.equal(offered.decision?.player, first === 'ambassador' ? 'ec' : 'm');
        assert.equal(offered.pendingAmbassador?.entrant ?? offered.pendingTerrorEntry?.entrant, 'in');
        assert.equal(seat(offered, 'in').forces['arrakeen:10'], 2);
        assert.equal(seat(offered, 'in').reserves, cause === 'shipment' ? 18 : 17);
        assert.equal(seat(offered, 'in').spice, cause === 'shipment' ? 18 : 20);
        if (cause === 'shipment') assert.equal(seat(offered, 'in').shipped, true);
        else {
          assert.equal(seat(offered, 'in').forces['imperial_basin:10'], 1);
          assert.equal(seat(offered, 'in').moved, 1);
        }
        privateTerror(offered, terrorToken);
        unchangedRejection(offered, 'in', { type: 'endMovement' });
        unchangedRejection(offered, first === 'ambassador' ? 'm' : 'ec', {
          type: 'decision', decline: true,
        });
        let second = first === 'ambassador'
          ? decideAmbassador(reload(offered), false)
          : decideTerror(reload(offered), false);
        const next = first === 'ambassador' ? 'terror' : 'ambassador';
        const secondWitness = overlap(second, first, next);
        assert.equal(secondWitness.signature, witness.signature);
        assert.equal(secondWitness.cause, cause);
        assert.equal(secondWitness.entrant, witness.entrant);
        assert.equal(second.decision?.kind, next === 'ambassador' ? 'ecazAmbassador' : 'moritaniTerror');
        assert.equal(second.decision?.player, next === 'ambassador' ? 'ec' : 'm');
        assert.equal(second.pendingAmbassador?.entrant ?? second.pendingTerrorEntry?.entrant, 'in');
        assert.equal(seat(second, 'in').forces['arrakeen:10'], 2);
        privateTerror(second, terrorToken);
        unchangedRejection(second, first === 'ambassador' ? 'ec' : 'm', {
          type: 'decision',
          ...(first === 'ambassador' ? { event: offered.pendingAmbassador!.event } : {}),
          decline: true,
        });
        second = next === 'ambassador'
          ? decideAmbassador(reload(second), false)
          : decideTerror(reload(second), false);
        assert.equal(second.pendingArrivalOverlap ?? null, null);
        assert.equal(second.pendingAmbassador ?? null, null);
        assert.equal(second.pendingTerrorEntry ?? null, null);
        assert.equal(second.decision, null);
        assert.equal(viewGame(second, 'in').arrivalOverlap, null);
        assert.equal(seat(second, 'in').forces['arrakeen:10'], 2);
        assert.equal(seat(second, 'in').spice, cause === 'shipment' ? 18 : 20);
        assert.equal(second.ecazAmbassadors!.tokens.find((t) => t.id === ambassadorToken)!.zone, 'placed');
        assert.equal(second.moritaniTerror!.tokens.find((t) => t.id === terrorToken)!.status, 'placed');
        unchangedRejection(second, 'in', action);
      });
    }

for (const first of ['ambassador', 'terror'] as const) {
  void test(`${first} first: persisted arrival witness rejects changed entry and owner order`, () => {
    const offered = applyAction(table(first, false).g, 'in', shipment);
    for (const change of [
      (g: Game) => { g.pendingArrivalOverlap!.amount = 3; },
      (g: Game) => { g.pendingArrivalOverlap!.entrant = 'ec'; },
      (g: Game) => { g.pendingArrivalOverlap!.terrorTokens = []; },
      (g: Game) => { g.pendingArrivalOverlap!.first = first === 'ambassador' ? 'terror' : 'ambassador'; },
      (g: Game) => { g.order.reverse(); },
    ]) {
      const corrupt = reload(offered);
      change(corrupt);
      unchangedRejection(corrupt, first === 'ambassador' ? 'ec' : 'm', first === 'ambassador'
        ? { type: 'decision', event: corrupt.pendingAmbassador!.event, decline: true }
        : { type: 'decision', decline: true });
    }
  });
}

for (const first of ['ambassador', 'terror'] as const) {
  void test(`${first} first: Emperor and Robbery settle exactly once with original entrant and private token custody`, () => {
    const { g, ambassadorToken, terrorToken } = table(first, true);
    let state = applyAction(g, 'in', shipment);
    const signature = overlap(state, first, first).signature;
    if (first === 'ambassador') {
      const event = state.pendingAmbassador!.event;
      state = decideAmbassador(reload(state), true);
      assert.equal(seat(state, 'ec').spice, 25);
      assert.equal(state.ecazAmbassadors!.tokens.find((t) => t.id === ambassadorToken)!.zone, 'used');
      overlap(state, first, 'terror');
      privateTerror(state, terrorToken);
      unchangedRejection(state, 'ec', { type: 'decision', event, trigger: true, beneficiary: 'ec' });
      state = decideTerror(reload(state), true);
      assert.equal(state.pendingTerrorEntry?.stage, 'robbery');
      assert.equal(state.pendingTerrorEntry?.entrant, 'in');
      assert.equal(state.pendingArrivalOverlap?.signature, signature);
      state = applyAction(reload(state), 'm', { type: 'decision', choice: 'spice' });
    } else {
      state = decideTerror(reload(state), true);
      assert.equal(state.pendingTerrorEntry?.stage, 'robbery');
      assert.equal(state.pendingTerrorEntry?.entrant, 'in');
      assert.equal(state.pendingArrivalOverlap?.signature, signature);
      state = applyAction(reload(state), 'm', { type: 'decision', choice: 'spice' });
      const event = state.pendingAmbassador!.event;
      overlap(state, first, 'ambassador');
      assert.equal(state.pendingAmbassador?.entrant, 'in');
      state = decideAmbassador(reload(state), true);
      unchangedRejection(state, 'ec', { type: 'decision', event, trigger: true, beneficiary: 'ec' });
    }
    assert.equal(state.pendingArrivalOverlap ?? null, null);
    assert.equal(state.decision, null);
    assert.equal(seat(state, 'in').spice, 9);
    assert.equal(seat(state, 'm').spice, 29);
    assert.equal(seat(state, 'ec').spice, 25);
    assert.equal(seat(state, 'in').reserves, 18);
    assert.equal(seat(state, 'in').forces['arrakeen:10'], 2);
    assert.equal(state.ecazAmbassadors!.tokens.find((t) => t.id === ambassadorToken)!.zone, 'used');
    assert.equal(state.moritaniTerror!.tokens.find((t) => t.id === terrorToken)!.status, 'removed');
    assert.equal(state.log.filter((line) => line.automatic?.name === 'Emperor Ambassador').length, 1);
    unchangedRejection(state, 'm', { type: 'decision', choice: 'spice' });
    unchangedRejection(state, 'in', shipment);
    assert.deepEqual(reload(state).players, state.players);
  });
}
