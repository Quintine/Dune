import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHOAM_NEXUS_EFFECTS,
  createNexusChoam,
  validateNexusChoam,
  type NexusChoamContext,
  type NexusChoamEffect,
  type NexusChoamReceipt,
} from '../game/nexus-choam';

const context: NexusChoamContext = {
  turn: 3,
  players: [
    { id: 'c', faction: 'choam' },
    { id: 'a', faction: 'atreides' },
    { id: 'h', faction: 'harkonnen' },
  ],
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

void test('CHOAM Nexus records all six printed effects with their distinct phase windows', () => {
  assert.deepEqual(
    Object.values(CHOAM_NEXUS_EFFECTS).sort(),
    [
      'Baliset',
      'Jubba Cloak',
      'Kull Wahad',
      'Kulon',
      'La La La',
      'Trip to Gamont',
    ].sort(),
  );
  for (const [effect, phase] of [
    ['kulon', 5],
    ['laLaLa', 4],
    ['gamont', 8],
    ['baliset', 5],
    ['jubba', 0],
  ] as const) {
    const receipt = createNexusChoam(
      context,
      'c',
      phase,
      'physical-poison-1',
      effect,
    );
    validateNexusChoam(context, clone(receipt));
    for (let wrong = 0; wrong <= 8; wrong++)
      if (wrong !== phase)
        assert.throws(
          () =>
            createNexusChoam(context, 'c', wrong, 'physical-poison-1', effect),
          /timing/,
        );
  }
  for (let phase = 0; phase <= 8; phase++)
    validateNexusChoam(
      context,
      createNexusChoam(context, 'c', phase, 'physical-shield-1', 'kull'),
    );
});

void test('CHOAM historical receipt survives later turns and roster ordering without inspecting private state', () => {
  const receipt = createNexusChoam(
    context,
    'c',
    5,
    'physical-poison-1',
    'kulon',
  );
  const before = clone(receipt);
  const later = {
    turn: 4,
    players: [...context.players].reverse().map((p) =>
      Object.defineProperties(
        { ...p },
        {
          hand: {
            get() {
              throw new Error('private hand read');
            },
          },
          ally: {
            get() {
              throw new Error('historical alliance read');
            },
          },
          spice: {
            get() {
              throw new Error('private balance read');
            },
          },
        },
      ),
    ),
  };
  validateNexusChoam(later, clone(receipt));
  assert.deepEqual(receipt, before);
  const second = createNexusChoam(
    context,
    'c',
    5,
    'physical-shield-1',
    'kulon',
  );
  assert.notEqual(receipt.event, second.event);
  assert.notEqual(
    receipt.event,
    createNexusChoam(context, 'c', 5, receipt.card, 'baliset').event,
  );
});

void test('CHOAM receipt rejects changed target, effect, turn, roster or identity without changing evidence', () => {
  const receipt = createNexusChoam(
    context,
    'c',
    5,
    'physical-poison-1',
    'kulon',
  );
  const edits: ((r: NexusChoamReceipt) => void)[] = [
    (r) => {
      r.card = 'other';
    },
    (r) => {
      r.effect = 'baliset';
    },
    (r) => {
      r.turn++;
    },
    (r) => {
      r.owner = 'a';
    },
    (r) => {
      r.event = 'other';
    },
    (r) => {
      r.phase = 8;
    },
    (r) => {
      r.roster.pop();
    },
    (r) => {
      r.roster[0].faction = 'guild';
    },
    (r) => {
      r.signature = 'changed';
    },
    (r) => {
      delete (r as Partial<NexusChoamReceipt>).card;
    },
    (r) => {
      Object.assign(r, { stage: 'complete' });
    },
  ];
  for (const edit of edits) {
    const bad = clone(receipt);
    edit(bad);
    const before = clone(bad);
    assert.throws(() => validateNexusChoam(context, bad), /CHOAM Nexus/);
    assert.deepEqual(bad, before);
  }
  assert.throws(
    () => validateNexusChoam({ ...context, turn: 2 }, receipt),
    /CHOAM Nexus/,
  );
  assert.throws(
    () =>
      validateNexusChoam(
        {
          ...context,
          players: context.players.map((p) =>
            p.id === 'c' ? { ...p, faction: 'guild' } : p,
          ),
        },
        receipt,
      ),
    /CHOAM Nexus/,
  );
});

void test('CHOAM receipt creation rejects malformed or foreign inputs before producing a grant', () => {
  const before = clone(context);
  for (const owner of ['a', 'missing', '__proto__'])
    assert.throws(
      () => createNexusChoam(context, owner, 5, 'card', 'kulon'),
      /CHOAM Nexus/,
    );
  for (const phase of [-1, 9, 1.5, NaN])
    assert.throws(
      () => createNexusChoam(context, 'c', phase, 'card', 'kull'),
      /CHOAM Nexus/,
    );
  for (const card of ['', ' ', '__proto__'])
    assert.throws(
      () => createNexusChoam(context, 'c', 5, card, 'kulon'),
      /CHOAM Nexus/,
    );
  for (const effect of ['unknown', 'constructor', '__proto__'])
    assert.throws(
      () =>
        createNexusChoam(context, 'c', 5, 'card', effect as NexusChoamEffect),
      /CHOAM Nexus/,
    );
  assert.throws(
    () =>
      createNexusChoam(
        { ...context, players: [...context.players, context.players[0]] },
        'c',
        5,
        'card',
        'kulon',
      ),
    /roster/,
  );
  assert.deepEqual(context, before);
});
