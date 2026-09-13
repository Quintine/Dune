import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { defaultHarassWithdrawAllocation } from '../game/harass-withdraw';
import { harassWithdrawGame, harassCustody } from './fixture-harass-withdraw';

function sealed(advanced = true, sector = false) {
  let g = harassWithdrawGame(
    advanced
      ? { advanced, normal: 3, elite: 1 }
      : { territory: 'imperial_basin', sector: 9 },
  );
  if (sector)
    g.players[0].forces = { 'imperial_basin:9': 2, 'imperial_basin:10': 3 };
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    dial: 2,
    support: advanced ? 1 : 0,
    leader: 'emperor-0',
    defense: 'ecaz-harass-withdraw',
  });
  return g;
}
function reveal(g: Game) {
  return applyAction(g, 'd', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: 'atreides-0',
  });
}
function selection(g: Game, returns: unknown): Action {
  return { type: 'decision', event: g.battle!.harassAllocation!.event, returns };
}
function reject(g: Game, id: string, action: Action, re: RegExp) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, id, action), re);
  assert.equal(JSON.stringify(g), before);
}
function finish(g: Game) {
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  return applyAction(g, 'd', { type: 'traitorCall', call: false });
}

void test('ambiguous Harass stays out of sealed plans and opens only after public reveal', () => {
  const s = sealed();
  assert.equal(s.battle!.harassAllocation, undefined);
  assert.equal(s.decision, null);
  assert.equal(viewGame(s, 'd').battle!.plans.a, undefined);
  assert.equal(viewGame(s, 'a').battle!.harassAllocation, null);
  const g = reveal(s);
  assert.equal(g.decision!.kind, 'harassWithdraw');
  assert.equal(g.battle!.revealed, true);
  assert.equal(viewGame(g, 'd').battle!.harassAllocation, null);
  assert.ok(viewGame(g, 'a').battle!.harassAllocation);
  assert.deepEqual(g.battle!.plans.a, s.battle!.plans.a);
  for (const p of g.players)
    assert.deepEqual(
      viewGame(JSON.parse(JSON.stringify(g)), p.id),
      viewGame(g, p.id),
    );
  reject(
    g,
    'd',
    { type: 'traitorCall', call: false },
    /decision|waiting|choose|resolve|not available/i,
  );
});
void test('every legal Advanced typed choice preserves the selected elite custody through resolution', () => {
  for (const returns of [
    { 'arrakeen:10': { normal: 0, elite: 1 } },
    { 'arrakeen:10': { normal: 2, elite: 0 } },
    { 'arrakeen:10': { normal: 3, elite: 0 } },
  ]) {
    const g = reveal(sealed());
    const chosen = applyAction(g, 'a', selection(g, returns));
    assert.equal(chosen.decision, null);
    assert.deepEqual(chosen.players[0].forces, g.players[0].forces);
    assert.deepEqual(
      viewGame(chosen, 'd').battle!.harassAllocation!.selection,
      returns,
    );
    const done = finish(chosen);
    const total = returns['arrakeen:10'].normal + returns['arrakeen:10'].elite;
    assert.equal(done.players[0].reserves, 16 + total);
    assert.equal(
      done.players[0].elites!.reserves,
      4 + returns['arrakeen:10'].elite,
    );
    harassCustody(done);
    assert.equal(done.players[0].tanks, 4 - total);
    assert.deepEqual(done.players[0].forces, {});
    assert.equal(
      done.discard.filter((c) => c.id === 'ecaz-harass-withdraw').length,
      1,
    );
  }
});
void test('Basic multi-sector selection withdraws the chosen exact locations without forced early allocation', () => {
  const g = reveal(sealed(false, true));
  const returns = {
    'imperial_basin:9': { normal: 1, elite: 0 },
    'imperial_basin:10': { normal: 2, elite: 0 },
  };
  const chosen = applyAction(g, 'a', selection(g, returns));
  assert.deepEqual(chosen.battle!.harassAllocation!.selection, returns);
  const done = finish(chosen);
  assert.equal(done.players[0].reserves, 18);
  assert.equal(done.players[0].tanks, 2);
  harassCustody(done);
});
void test('stale, other-owner, partial, overdrawn and forged choices reject without mutation', () => {
  const g = reveal(sealed());
  const valid = { 'arrakeen:10': { normal: 2, elite: 0 } };
  reject(
    g,
    'd',
    selection(g, valid),
    /decision|waiting|choose|resolve|not available/i,
  );
  reject(g, 'a', { ...selection(g, valid), event: 'stale' }, /exact revealed/);
  for (const returns of [
    null,
    {},
    { 'arrakeen:10': { normal: 1, elite: 0 } },
    { 'arrakeen:10': { normal: 5, elite: 0 } },
    { 'carthag:11': { normal: 2, elite: 0 } },
  ])
    reject(
      g,
      'a',
      selection(g, returns),
      /selection|return|location|undialed|physical|force/i,
    );
  const done = applyAction(g, 'a', selection(g, valid));
  reject(
    done,
    'a',
    selection(g, valid),
    /decision|waiting|choose|resolve|not available/i,
  );
});
void test('corrupt saved pending/selected allocations reject reads, normalization and actions', () => {
  const pending = reveal(sealed());
  const chosen = applyAction(
    pending,
    'a',
    selection(pending, { 'arrakeen:10': { normal: 2, elite: 0 } }),
  );
  for (const [base, edit] of [
    [
      pending,
      (g: Game) => {
        delete g.battle!.harassAllocation;
      },
    ],
    [
      pending,
      (g: Game) => {
        g.decision = null;
      },
    ],
    [
      pending,
      (g: Game) => {
        g.battle!.plans.a.support = 0;
      },
    ],
    [
      pending,
      (g: Game) => {
        g.battle!.harassAllocation!.player = 'd';
      },
    ],
    [
      chosen,
      (g: Game) => {
        g.battle!.harassAllocation!.selection = {};
      },
    ],
    [
      chosen,
      (g: Game) => {
        delete g.battle!.harassAllocationEvent;
      },
    ],
  ] as const) {
    const g = structuredClone(base);
    edit(g);
    const before = JSON.stringify(g);
    for (const p of g.players)
      assert.throws(
        () => viewGame(g, p.id),
        /withdraw|Harass|returned counters/i,
      );
    assert.throws(
      () => normalizeAutomaticGame(g),
      /withdraw|Harass|returned counters/i,
    );
    assert.throws(
      () => applyAction(g, 'a', { type: 'setAutopilot', difficulty: 'Easy' }),
      /withdraw|Harass|returned counters/i,
    );
    assert.equal(JSON.stringify(g), before);
  }
});
void test('four AI profiles select real after-reveal allocations using only the owner projection', () => {
  const g = reveal(sealed());
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const v = viewGame(g, 'a');
    v.players[0].bot = difficulty;
    const before = JSON.stringify(v),
      action = botActions(v)[0];
    assert.equal(action?.type, 'decision');
    const done = applyAction(g, 'a', action);
    assert.equal(done.decision, null);
    assert.equal(JSON.stringify(v), before);
    const offer = v.battle!.harassAllocation!;
    assert.deepEqual(
      action.returns,
      defaultHarassWithdrawAllocation(offer.context, offer.dial, offer.support),
    );
  }
});

void test('opposing traitor cancellation ignores the selected return and loses every original board counter', () => {
  let g = sealed();
  const traitor = g.battle!.plans.a.leader!,
    old = g.players[1].traitors[0];
  let replaced = false;
  for (const p of g.players) {
    const at = p.traitors.indexOf(traitor);
    if (at >= 0) {
      p.traitors[at] = old;
      replaced = true;
    }
    const dancer = p.faceDancers?.find((c) => c.leader === traitor);
    if (dancer) {
      dancer.leader = old;
      replaced = true;
    }
  }
  const at = g.traitorReserve!.indexOf(traitor);
  if (at >= 0) {
    g.traitorReserve![at] = old;
    replaced = true;
  }
  assert.ok(replaced);
  g.players[1].traitors[0] = traitor;
  harassCustody(g);
  g = reveal(g);
  g = applyAction(
    g,
    'a',
    selection(g, { 'arrakeen:10': { normal: 2, elite: 0 } }),
  );
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  g = applyAction(g, 'd', { type: 'traitorCall', call: true });
  assert.equal(g.players[0].reserves, 16);
  assert.equal(g.players[0].tanks, 4);
  assert.equal(g.players[0].elites!.reserves, 4);
  assert.equal(g.players[0].elites!.tanks, 1);
  harassCustody(g);
  assert.equal(
    g.discard.filter((card) => card.id === 'ecaz-harass-withdraw').length,
    1,
  );
  assert.notEqual(g.decision?.kind, 'battleLosses');
  assert.equal(g.players[1].tanks, 0);
  assert.equal(
    g.log.filter((e) => e.text.includes('used Harass & Withdraw to return'))
      .length,
    0,
  );
});
