import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpiceAllocation as create,
  quoteSpiceAllocation as quote,
  SpiceAllocationError,
  type AllocationState,
  type SharedSpiceLot,
  type SpiceAllocationAction,
} from '../game/ecaz-spice-allocation';
const lot = (amount = 7, territory = 'hagga_basin'): SharedSpiceLot => ({
  territory,
  ecaz: 'e',
  ally: 'a',
  amount,
});
const reload = (state: AllocationState): AllocationState =>
  JSON.parse(JSON.stringify(state));
function rejected(
  state: AllocationState,
  actor: string,
  action: SpiceAllocationAction,
) {
  const before = structuredClone(state);
  assert.throws(() => quote(state, actor, action), SpiceAllocationError);
  assert.deepEqual(state, before);
}
void test('creation skips zero lots, preserves positive order and detaches the initial protocol', () => {
  const input = [lot(0, 'the_great_flat'), lot(7), lot(2, 'imperial_basin')];
  const state = create(input)!;
  assert.deepEqual(state, {
    lots: input.slice(1),
    index: 0,
    offer: null,
    player: 'e',
  });
  input[1].amount = 99;
  assert.equal(state.lots[0].amount, 7);
  assert.equal(create([]), null);
  assert.equal(create([lot(0)]), null);
});
void test('a proposal transfers the decision but produces no allocation until the other party accepts', () => {
  const state = create([lot()])!;
  const before = reload(state);
  const proposed = quote(state, 'e', { kind: 'propose', ecazShare: 5 });
  assert.equal(proposed.receipt, null);
  assert.equal(proposed.next!.player, 'a');
  assert.deepEqual(proposed.next!.offer, { by: 'e', ecazShare: 5 });
  assert.deepEqual(state, before);
  assert.deepEqual(quote(reload(proposed.next!), 'a', { kind: 'accept' }), {
    next: null,
    receipt: {
      territory: 'hagga_basin',
      ecaz: 'e',
      ally: 'a',
      ecazAmount: 5,
      allyAmount: 2,
      method: 'agreement',
    },
  });
});
void test('counteroffers alternate parties and agreement uses the latest share', () => {
  let state = create([lot(9)])!;
  state = quote(state, 'e', { kind: 'propose', ecazShare: 8 }).next!;
  state = quote(reload(state), 'a', { kind: 'propose', ecazShare: 2 }).next!;
  assert.equal(state.player, 'e');
  assert.deepEqual(state.offer, { by: 'a', ecazShare: 2 });
  state = quote(state, 'e', { kind: 'propose', ecazShare: 4 }).next!;
  const receipt = quote(reload(state), 'a', { kind: 'accept' }).receipt!;
  assert.equal(receipt.ecazAmount, 4);
  assert.equal(receipt.allyAmount, 5);
});
void test('equal fallback is available on either current turn and sends the odd remainder to the ally', () => {
  for (const amount of [1, 2, 7, 8, Number.MAX_SAFE_INTEGER]) {
    const initial = create([lot(amount)])!;
    const states = [
      initial,
      quote(initial, 'e', { kind: 'propose', ecazShare: 0 }).next!,
    ];
    for (const state of states) {
      const result = quote(state, state.player, { kind: 'equal' });
      assert.equal(result.next, null);
      assert.equal(result.receipt!.method, 'equal');
      assert.equal(result.receipt!.ecazAmount, Math.floor(amount / 2));
      assert.equal(result.receipt!.allyAmount, Math.ceil(amount / 2));
      assert.equal(
        result.receipt!.ecazAmount + result.receipt!.allyAmount,
        amount,
      );
    }
  }
});
void test('agreement permits either endpoint and conserves every spice unit', () => {
  for (const amount of [1, 7, Number.MAX_SAFE_INTEGER])
    for (const share of [0, amount]) {
      const proposed = quote(create([lot(amount)])!, 'e', {
        kind: 'propose',
        ecazShare: share,
      }).next!;
      const receipt = quote(proposed, 'a', { kind: 'accept' }).receipt!;
      assert.equal(receipt.ecazAmount, share);
      assert.equal(receipt.ecazAmount + receipt.allyAmount, amount);
    }
});
void test('multilot JSON recovery settles one lot at a time and restarts the next with Ecaz and no proposal', () => {
  let state = create([lot(3), lot(4, 'imperial_basin')])!;
  state = quote(state, 'e', { kind: 'propose', ecazShare: 3 }).next!;
  const first = quote(reload(state), 'a', { kind: 'accept' });
  assert.equal(first.receipt!.territory, 'hagga_basin');
  assert.equal(first.next!.index, 1);
  assert.equal(first.next!.player, 'e');
  assert.equal(first.next!.offer, null);
  assert.equal(first.next!.lots.length, 2);
  rejected(first.next!, 'a', { kind: 'accept' });
  const last = quote(reload(first.next!), 'e', { kind: 'equal' });
  assert.equal(last.receipt!.territory, 'imperial_basin');
  assert.equal(last.receipt!.ecazAmount, 2);
  assert.equal(last.next, null);
});
void test('self acceptance, acceptance without an offer, and noncurrent actors reject without mutation', () => {
  const state = create([lot()])!;
  rejected(state, 'e', { kind: 'accept' });
  rejected(state, 'a', { kind: 'propose', ecazShare: 2 });
  rejected(state, 'outside', { kind: 'equal' });
  const proposed = quote(state, 'e', { kind: 'propose', ecazShare: 2 }).next!;
  rejected(proposed, 'e', { kind: 'accept' });
  rejected(proposed, 'e', { kind: 'equal' });
});
void test('malformed lots reject including duplicates and different parties in zero lots', () => {
  for (const input of [
    [lot(7), lot(0)],
    [lot(0), { ...lot(4, 'imperial_basin'), ecaz: 'other' }],
    [lot(7), { ...lot(4, 'imperial_basin'), ecaz: 'a', ally: 'e' }],
    [{ ...lot(), ally: 'e' }],
    [{ ...lot(), ecaz: '' }],
    [{ ...lot(), ally: ' ' }],
    [lot(2, 'arrakeen')],
    [lot(2, 'polar_sink')],
    [lot(2, 'hidden_mobile_stronghold')],
    [lot(2, 'unknown')],
    null,
  ])
    assert.throws(
      () => create(input as SharedSpiceLot[]),
      SpiceAllocationError,
    );
  for (const amount of [
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '2',
    null,
  ])
    assert.throws(() => create([lot(amount as number)]), SpiceAllocationError);
});
void test('the entire saved protocol rejects invalid indices, offers, roles and later lot corruption', () => {
  const initial = create([lot(), lot(5, 'imperial_basin')])!;
  const mutations: ((s: AllocationState) => void)[] = [
    (s) => {
      s.index = -1;
    },
    (s) => {
      s.index = 2;
    },
    (s) => {
      s.index = 0.5;
    },
    (s) => {
      s.lots = [];
    },
    (s) => {
      s.player = 'a';
    },
    (s) => {
      s.player = 'unknown';
    },
    (s) => {
      s.lots[1].ally = 'other';
    },
    (s) => {
      s.lots[1].territory = 'hagga_basin';
    },
    (s) => {
      s.lots[1].amount = 0;
    },
    (s) => {
      s.offer = { by: 'e', ecazShare: 2 };
    },
    (s) => {
      s.offer = { by: 'outside', ecazShare: 2 };
    },
    (s) => {
      s.offer = { by: 'a', ecazShare: 8 };
    },
    (s) => {
      s.offer = { by: 'a', ecazShare: NaN };
    },
    (s) => {
      s.offer = undefined as unknown as null;
    },
  ];
  for (const mutate of mutations) {
    const damaged = reload(initial);
    mutate(damaged);
    rejected(damaged, damaged.player, { kind: 'equal' });
  }
  const extra = { ...initial, finished: true };
  rejected(extra, 'e', { kind: 'equal' });
});
void test('invalid action shape and numeric proposals never coerce or emit a receipt', () => {
  const state = create([lot()])!;
  for (const share of [
    -1,
    8,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '2',
    null,
  ])
    rejected(state, 'e', { kind: 'propose', ecazShare: share as number });
  for (const action of [
    { kind: 'accept', ecazShare: 1 },
    { kind: 'equal', extra: true },
    { kind: 'propose' },
    { kind: 'other' },
    null,
  ])
    rejected(state, 'e', action as SpiceAllocationAction);
});
void test('outputs are detached and protocol evaluation cannot consult unrelated resources or randomness', () => {
  const initial = create([lot()])!;
  const before = reload(initial);
  const guarded = new Proxy(initial, {
    get(target, key, receiver) {
      assert.ok(
        ['lots', 'index', 'offer', 'player'].includes(String(key)),
        String(key),
      );
      return Reflect.get(target, key, receiver);
    },
  });
  const random = Math.random;
  try {
    Math.random = () => {
      throw Error('Allocation cannot use randomness');
    };
    const a = quote(guarded, 'e', { kind: 'propose', ecazShare: 2 });
    a.next!.lots[0].amount = 100;
    a.next!.offer!.ecazShare = 99;
    const b = quote(guarded, 'e', { kind: 'propose', ecazShare: 2 });
    assert.equal(b.next!.lots[0].amount, 7);
    assert.equal(b.next!.offer!.ecazShare, 2);
    assert.deepEqual(initial, before);
  } finally {
    Math.random = random;
  }
});
