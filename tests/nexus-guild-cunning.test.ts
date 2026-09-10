import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNexusGuildCunning,
  validateNexusGuildCunning,
  nexusGuildCunningMoves,
  type NexusGuildCunningContext,
  type NexusGuildCunningReceipt,
} from '../game/nexus-guild-cunning';

const context = {
  turn: 3,
  phase: 5,
  active: 'g',
  players: [
    { id: 'a', faction: 'atreides' as const },
    { id: 'g', faction: 'guild' as const },
    { id: 'f', faction: 'fremen' as const },
  ],
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const make = (moved = 0, hajrUsed = false, shipped = false) =>
  createNexusGuildCunning(context, 'g', { shipped, moved, hajrUsed });

void test('Guild Cunning records the ended original combined turn whether its shipment and movement were used or declined', () => {
  for (const shipped of [false, true])
    for (const hajrUsed of [false, true])
      for (let moved = 0; moved <= (hajrUsed ? 2 : 1); moved++) {
        const before = { shipped, moved, hajrUsed },
          original = clone(before);
        const receipt = createNexusGuildCunning(context, 'g', before);
        assert.equal(
          receipt.event,
          JSON.stringify(['nexusGuildCunning', 3, 'g']),
        );
        assert.deepEqual(receipt.before, original);
        assert.deepEqual(before, original);
        assert.notEqual(receipt.before, before);
        assert.equal(receipt.mode, 'cunning');
        validateNexusGuildCunning(context, clone(receipt));
      }
});

void test('second shipment never supplies an ordinary move, including a declined first movement', () => {
  for (const moved of [0, 1]) {
    const receipt = make(moved, false, true);
    assert.equal(nexusGuildCunningMoves(receipt, false), 0);
    assert.throws(() => nexusGuildCunningMoves(receipt, false, 1));
    assert.equal(
      nexusGuildCunningMoves(receipt, true),
      1,
      'later Hajr grants exactly its extra slot',
    );
    assert.equal(nexusGuildCunningMoves(receipt, true, 1), 0);
  }
});

void test('previously played Hajr keeps an unused extra slot after decline, but an already consumed Hajr grants no third move', () => {
  for (const moved of [0, 1]) {
    const receipt = make(moved, true);
    assert.equal(nexusGuildCunningMoves(receipt, true), 1);
    assert.equal(nexusGuildCunningMoves(receipt, true, 1), 0);
    assert.throws(() => nexusGuildCunningMoves(receipt, false));
  }
  const consumed = make(2, true);
  assert.equal(nexusGuildCunningMoves(consumed, true), 0);
  assert.throws(() => nexusGuildCunningMoves(consumed, true, 1));
  for (const count of [-1, 0.5, 2, NaN, Infinity])
    assert.throws(() => nexusGuildCunningMoves(make(1, true), true, count));
});

void test('only native unallied Guild can create the receipt at its own phase-five boundary', () => {
  const before = { shipped: false, moved: 0, hajrUsed: false };
  for (const phase of [0, 4, 6, 8])
    assert.throws(() =>
      createNexusGuildCunning({ ...context, phase }, 'g', before),
    );
  assert.throws(() =>
    createNexusGuildCunning({ ...context, active: 'a' }, 'g', before),
  );
  assert.throws(() =>
    createNexusGuildCunning({ ...context, active: 'a' }, 'a', before),
  );
  assert.throws(() =>
    createNexusGuildCunning(
      {
        ...context,
        players: context.players.map((p) => ({
          ...p,
          ally: p.id === 'g' ? 'a' : null,
        })),
      },
      'g',
      before,
    ),
  );
  for (const bad of [
    { ...before, moved: 2 },
    { ...before, moved: 3, hajrUsed: true },
    { ...before, moved: -1 },
    { ...before, moved: 0.5 },
    { ...before, moved: NaN },
    { ...before, shipped: 0 },
    { ...before, hajrUsed: 1 },
    { ...before, extra: 1 },
  ])
    assert.throws(() =>
      createNexusGuildCunning(context, 'g', bad as typeof before),
    );
});

void test('completed original receipts survive later alliances, turns and resource changes without reading private fields', () => {
  const receipt = make(1, true, true);
  const trap = () => {
    throw new Error('private field was read');
  };
  const later: NexusGuildCunningContext = {
    turn: 7,
    players: context.players.map((p) => ({
      ...p,
      get ally() {
        return trap();
      },
      get hand() {
        return trap();
      },
      get spice() {
        return trap();
      },
      get shipped() {
        return trap();
      },
      get moved() {
        return trap();
      },
      get reserves() {
        return trap();
      },
    })),
  };
  validateNexusGuildCunning(later, receipt);
  assert.equal(nexusGuildCunningMoves(receipt, true), 1);
  assert.throws(() =>
    validateNexusGuildCunning({ ...later, turn: 2 }, receipt),
  );
  assert.throws(() =>
    validateNexusGuildCunning(
      { ...later, players: later.players.slice(0, 2) },
      receipt,
    ),
  );
});

void test('creation reads only public roster, owner alliance, timing and the supplied original allowance', () => {
  const trap = () => {
    throw new Error('private field was read');
  };
  const publicContext = {
    ...context,
    players: context.players.map((p) =>
      Object.freeze({
        ...p,
        ally: null,
        get hand() {
          return trap();
        },
        get spice() {
          return trap();
        },
        get forces() {
          return trap();
        },
      }),
    ),
  };
  Object.freeze(publicContext.players);
  Object.freeze(publicContext);
  const before = Object.freeze({ shipped: true, moved: 1, hajrUsed: true });
  const receipt = createNexusGuildCunning(publicContext, 'g', before);
  assert.deepEqual(Object.keys(receipt).sort(), [
    'before',
    'event',
    'mode',
    'owner',
    'phase',
    'roster',
    'signature',
    'turn',
    'version',
  ]);
  assert.equal(JSON.stringify(receipt).includes('hand'), false);
  assert.equal(nexusGuildCunningMoves(Object.freeze(receipt), true, 1), 0);
});

void test('changed original facts, foreign fields, deleted proofs and malformed roster identities reject immutably', () => {
  const receipt = make(1, true, true);
  const mutations: ((r: NexusGuildCunningReceipt) => void)[] = [
    (r) => {
      r.before.moved = 0;
    },
    (r) => {
      r.before.shipped = false;
    },
    (r) => {
      r.before.hajrUsed = false;
    },
    (r) => {
      r.event = 'stale';
    },
    (r) => {
      r.owner = 'a';
    },
    (r) => {
      r.turn = 2;
    },
    (r) => {
      r.signature = '';
    },
    (r) => {
      r.roster.reverse();
    },
    (r) => {
      r.roster[0].id = 'changed';
    },
    (r) => {
      delete (r as Partial<NexusGuildCunningReceipt>).before;
    },
    (r) => {
      Object.assign(r, { stage: 'secondShipment' });
    },
  ];
  for (const mutate of mutations) {
    const bad = clone(receipt);
    mutate(bad);
    const original = clone(bad);
    assert.throws(() => validateNexusGuildCunning(context, bad));
    assert.deepEqual(bad, original);
  }
  for (const players of [
    [...context.players, context.players[0]],
    context.players.map((p) => ({ ...p, id: 'same' })),
    context.players.map((p) => ({ ...p, faction: 'guild' as const })),
    context.players.map((p) => ({
      ...p,
      id: p.id === 'a' ? '__proto__' : p.id,
    })),
  ])
    assert.throws(() =>
      validateNexusGuildCunning({ ...context, players }, receipt),
    );
});
