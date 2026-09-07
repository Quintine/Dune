import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerExtortion,
  collectExtortion,
  reserveExtortion,
  type ExtortionContext,
  type ExtortionResult,
  type ExtortionState,
} from '../game/moritani-extortion';

const context = (phase = 5): ExtortionContext => ({
  turn: 4,
  phase,
  players: [
    { id: 'm', spice: 1 },
    { id: 'ally', spice: 3 },
    { id: 'entrant', spice: 7 },
    { id: 'poor', spice: 0 },
  ],
});
const reserve = () =>
  reserveExtortion({ owner: 'm', token: 'terror-4', turn: 4 }, context()).state;
const collect = (state = reserve()) =>
  collectExtortion(state, {
    ...context(8),
    stormOrder: ['poor', 'm', 'ally', 'entrant'],
  });
const reload = (state: ExtortionState): ExtortionState =>
  JSON.parse(JSON.stringify(state));
function applyTransfer(
  ctx: ExtortionContext,
  result: ExtortionResult,
): ExtortionContext {
  const next = structuredClone(ctx);
  const transfer = result.transfer;
  if (transfer) {
    next.players.find((p) => p.id === transfer.to)!.spice += transfer.amount;
    if (transfer.from === 'player')
      next.players.find((p) => p.id === transfer.player)!.spice -=
        transfer.amount;
  }
  return next;
}
function rejectWithoutMutation(
  state: ExtortionState,
  ctx: ExtortionContext,
  action: () => unknown,
) {
  const before = structuredClone({ state, ctx });
  assert.throws(action);
  assert.deepEqual({ state, ctx }, before);
}

void test('revelation reserves exactly five bank spice without making it spendable or moving the token', () => {
  const ctx = context();
  const before = structuredClone(ctx);
  const result = reserveExtortion(
    { owner: 'm', token: 'terror-4', turn: 4 },
    ctx,
  );
  assert.deepEqual(result, {
    state: {
      owner: 'm',
      token: 'terror-4',
      turn: 4,
      bank: { reserved: 5, collected: 0 },
      queue: [],
      cursor: 0,
      stage: 'reserved',
      payer: null,
    },
    transfer: null,
    recover: null,
  });
  assert.deepEqual(ctx, before);
  assert.equal(ctx.players[0].spice, 1);
});

void test('Mentat collection credits five once and snapshots storm order including ally and insolvent seats', () => {
  const state = reserve();
  const before = structuredClone(state);
  const result = collect(state);
  assert.deepEqual(result.transfer, {
    from: 'reservedBank',
    to: 'm',
    amount: 5,
  });
  assert.deepEqual(result.state.bank, { reserved: 0, collected: 5 });
  assert.deepEqual(result.state.queue, ['poor', 'ally', 'entrant']);
  assert.equal(result.state.cursor, 0);
  assert.equal(result.state.stage, 'payment');
  assert.equal(result.recover, null);
  assert.deepEqual(state, before);
  const ctx = applyTransfer(context(8), result);
  assert.equal(ctx.players[0].spice, 6);
  rejectWithoutMutation(result.state, ctx, () =>
    collectExtortion(reload(result.state), {
      ...ctx,
      stormOrder: ['entrant', 'm', 'ally', 'poor'],
    }),
  );
});

void test('first exact-three payment settles non-recovery and the owner receives bank five plus payer three', () => {
  const collected = collect();
  let ctx = applyTransfer(context(8), collected);
  const passed = answerExtortion(reload(collected.state), 'poor', false, ctx);
  assert.equal(passed.transfer, null);
  assert.equal(passed.recover, null);
  const paid = answerExtortion(reload(passed.state), 'ally', true, ctx);
  assert.deepEqual(paid.transfer, {
    from: 'player',
    player: 'ally',
    to: 'm',
    amount: 3,
  });
  assert.equal(paid.recover, false);
  assert.equal(paid.state.stage, 'settled');
  assert.equal(paid.state.payer, 'ally');
  ctx = applyTransfer(ctx, paid);
  assert.equal(ctx.players[0].spice, 9);
  assert.equal(ctx.players[1].spice, 0);
  assert.equal(ctx.players[2].spice, 7);
  for (const payer of ['poor', 'ally', 'entrant'])
    rejectWithoutMutation(paid.state, ctx, () =>
      answerExtortion(reload(paid.state), payer, true, ctx),
    );
});

void test('all explicit passes request token recovery exactly at the last payer and preserve the bank award', () => {
  let result = collect();
  const ctx = applyTransfer(context(8), result);
  for (const payer of ['poor', 'ally', 'entrant']) {
    result = answerExtortion(reload(result.state), payer, false, ctx);
    assert.equal(result.transfer, null);
    assert.equal(result.recover, payer === 'entrant' ? true : null);
  }
  assert.equal(result.state.token, 'terror-4');
  assert.equal(result.state.cursor, 3);
  assert.equal(result.state.payer, null);
  assert.equal(ctx.players[0].spice, 6);
  rejectWithoutMutation(result.state, ctx, () =>
    answerExtortion(result.state, 'entrant', false, ctx),
  );
});

void test('insolvent players remain queued, cannot pay early, and may use newly available spice', () => {
  const result = collect();
  const ctx = applyTransfer(context(8), result);
  rejectWithoutMutation(result.state, ctx, () =>
    answerExtortion(result.state, 'poor', true, ctx),
  );
  assert.equal(result.state.queue[result.state.cursor], 'poor');
  ctx.players.find((p) => p.id === 'poor')!.spice = 3;
  const paid = answerExtortion(result.state, 'poor', true, ctx);
  assert.equal(paid.state.payer, 'poor');
  assert.equal(paid.recover, false);
});

void test('payer cursor rejects self-payment, out-of-order seats, stale choices and nonboolean payments', () => {
  const state = collect().state;
  const ctx = context(8);
  for (const payer of ['m', 'ally', 'entrant', 'unknown'])
    rejectWithoutMutation(state, ctx, () =>
      answerExtortion(state, payer, false, ctx),
    );
  rejectWithoutMutation(state, ctx, () =>
    answerExtortion(state, 'poor', 3 as unknown as boolean, ctx),
  );
  const passed = answerExtortion(state, 'poor', false, ctx);
  rejectWithoutMutation(passed.state, ctx, () =>
    answerExtortion(passed.state, 'poor', false, ctx),
  );
});

void test('collection and payment reject wrong phase or turn without inventing Mentat-relative scheduling', () => {
  const reserved = reserve();
  const waiting = collect().state;
  for (const ctx of [{ ...context(8), turn: 5 }, context(5), context(9)]) {
    rejectWithoutMutation(reserved, ctx, () =>
      collectExtortion(reserved, {
        ...ctx,
        stormOrder: ['poor', 'm', 'ally', 'entrant'],
      }),
    );
    rejectWithoutMutation(waiting, ctx, () =>
      answerExtortion(waiting, 'poor', false, ctx),
    );
  }
  assert.throws(() => answerExtortion(reserved, 'poor', false, context(8)));
});

void test('bad queue, player balance and ledger records reject rather than duplicate or lose payment custody', () => {
  for (const stormOrder of [
    ['m', 'ally', 'entrant'],
    ['m', 'ally', 'poor', 'poor'],
    ['m', 'ally', 'poor', 'unknown'],
  ])
    assert.throws(() =>
      collectExtortion(reserve(), { ...context(8), stormOrder }),
    );
  for (const bad of [-1, 0.5, NaN, Infinity]) {
    const ctx = context();
    ctx.players[0].spice = bad;
    assert.throws(() =>
      reserveExtortion({ owner: 'm', token: 'terror-4', turn: 4 }, ctx),
    );
  }
  for (const mutate of [
    (s: ExtortionState) => {
      s.bank.reserved = 5;
    },
    (s: ExtortionState) => {
      s.cursor = 99;
    },
    (s: ExtortionState) => {
      s.queue[0] = 'm';
    },
    (s: ExtortionState) => {
      s.queue[0] = 'ally';
    },
    (s: ExtortionState) => {
      s.owner = 'missing';
    },
    (s: ExtortionState) => {
      s.token = '';
    },
  ]) {
    const state = collect().state;
    mutate(state);
    const ctx = context(8);
    rejectWithoutMutation(state, ctx, () =>
      answerExtortion(state, 'poor', false, ctx),
    );
  }
});

void test('cloned ledger and queue outputs do not alias callers, and an empty other-player queue settles recovery after collection', () => {
  const state = reserve();
  const result = collect(state);
  result.state.queue[0] = 'edited';
  result.state.bank.collected = 0;
  assert.deepEqual(state, reserve());
  const ctx: ExtortionContext = {
    turn: 4,
    phase: 8,
    players: [{ id: 'm', spice: 0 }],
  };
  const reserved = reserveExtortion(
    { owner: 'm', token: 'terror-4', turn: 4 },
    ctx,
  );
  const empty = collectExtortion(reserved.state, { ...ctx, stormOrder: ['m'] });
  assert.equal(empty.recover, true);
  assert.equal(empty.transfer?.amount, 5);
  assert.deepEqual(empty.state.queue, []);
});
