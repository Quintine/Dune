import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS } from '../game/catalog';
import {
  createNexusGuildSecretAlly,
  validateNexusGuildSecretAlly,
  quoteNexusGuildSecretShipment,
  type NexusGuildSecretAllyContext,
  type NexusGuildSecretAllyReceipt,
} from '../game/nexus-guild-secret-ally';

const context: NexusGuildSecretAllyContext = {
  turn: 4,
  players: [
    { id: 'a', faction: 'atreides' },
    { id: 'e', faction: 'emperor' },
    { id: 'f', faction: 'fremen' },
  ],
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

void test('Guild Secret Ally quotes all physical groups at Guild rates with one upward rounding and no force-count substitution', () => {
  for (const type of [
    'stronghold',
    'sand',
    'rock',
    'polar',
    'reserves',
    'homeworld',
  ])
    for (let amount = 1; amount <= 20; amount++)
      assert.deepEqual(quoteNexusGuildSecretShipment(type, amount), {
        physicalAmount: amount,
        cost: ['stronghold', 'reserves', 'homeworld'].includes(type)
          ? Math.ceil(amount / 2)
          : amount,
        source: 'nexusGuildSecretAlly',
      });
  assert.equal(quoteNexusGuildSecretShipment('homeworld', 5).cost, 3);
  assert.equal(
    quoteNexusGuildSecretShipment('reserves', 5).cost,
    3,
    'return tariff is final, not halved a second time',
  );
  assert.equal(
    quoteNexusGuildSecretShipment('sand', 5).cost,
    5,
    'paid Fremen cross-route must not inherit free native reinforcement',
  );
});

void test('physical shipment quote rejects zero, fractional, excess, coerced or unknown destinations', () => {
  for (const value of [
    0,
    -1,
    21,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER,
    '5',
    null,
    undefined,
  ])
    assert.throws(() =>
      quoteNexusGuildSecretShipment('stronghold', value as number),
    );
  for (const type of [
    '',
    'arrakeen',
    'homeworld:atreides',
    'space',
    'Stronghold',
    null,
    undefined,
  ])
    assert.throws(() => quoteNexusGuildSecretShipment(type as string, 5));
});

void test('each non-Guild native faction can own a canonically bound absent-Guild receipt without changing the supplied roster', () => {
  for (const faction of FACTIONS.filter((f) => f.id !== 'guild')) {
    const other = FACTIONS.filter(
      (f) => f.id !== 'guild' && f.id !== faction.id,
    ).slice(0, 2);
    const ctx = {
      turn: 2,
      players: [
        { id: 'owner', faction: faction.id },
        ...other.map((f, i) => ({ id: `other${i}`, faction: f.id })),
      ],
    };
    const before = clone(ctx),
      receipt = createNexusGuildSecretAlly(ctx, 'owner');
    assert.equal(
      receipt.event,
      JSON.stringify(['nexusGuildSecretAlly', 2, 'owner']),
    );
    assert.equal(receipt.phase, 5);
    assert.equal(receipt.mode, 'secretAlly');
    assert.deepEqual(ctx, before);
    assert.notEqual(receipt.roster, ctx.players);
    validateNexusGuildSecretAlly(ctx, clone(receipt));
    assert.deepEqual(
      createNexusGuildSecretAlly(
        { ...ctx, players: [...ctx.players].reverse() },
        'owner',
      ),
      receipt,
    );
  }
});

void test('seated Guild, unknown owner, malformed identities and duplicated seats or factions cannot issue receipts', () => {
  const badRosters = [
    [...context.players, { id: 'g', faction: 'guild' as const }],
    [...context.players, context.players[0]],
    context.players.map((p) => ({ ...p, id: 'same' })),
    context.players.map((p) => ({ ...p, faction: 'fremen' as const })),
    context.players.map((p) => ({
      ...p,
      id: p.id === 'a' ? '__proto__' : p.id,
    })),
    [],
  ];
  for (const players of badRosters) {
    const ctx = { ...context, players },
      before = clone(ctx);
    assert.throws(() => createNexusGuildSecretAlly(ctx, 'a'));
    assert.deepEqual(ctx, before);
  }
  assert.throws(() => createNexusGuildSecretAlly(context, 'outsider'));
  for (const turn of [0, -1, 1.5, NaN, Infinity])
    assert.throws(() => createNexusGuildSecretAlly({ ...context, turn }, 'a'));
});

void test('completed historical receipt survives later turns, alliance changes and private custody changes without reading them', () => {
  const receipt = createNexusGuildSecretAlly(context, 'a');
  const trap = () => {
    throw new Error('private state read');
  };
  const historical = {
    turn: 8,
    players: context.players.map((p) =>
      Object.freeze({
        ...p,
        get hand() {
          return trap();
        },
        get spice() {
          return trap();
        },
        get reserves() {
          return trap();
        },
        get forces() {
          return trap();
        },
        get shipped() {
          return trap();
        },
        get ally() {
          return trap();
        },
      }),
    ),
  };
  validateNexusGuildSecretAlly(historical, receipt);
  assert.deepEqual(
    createNexusGuildSecretAlly({ ...historical, turn: 4 }, 'a'),
    receipt,
  );
  assert.throws(() =>
    validateNexusGuildSecretAlly({ ...historical, turn: 3 }, receipt),
  );
  assert.throws(() =>
    validateNexusGuildSecretAlly(
      { ...historical, players: historical.players.slice(0, 2) },
      receipt,
    ),
  );
});

void test('exact owner, event, roster, phase and signature corruption rejects immutably after JSON recovery', () => {
  const receipt = createNexusGuildSecretAlly(context, 'a');
  const changes: ((r: NexusGuildSecretAllyReceipt) => void)[] = [
    (r) => {
      r.owner = 'e';
    },
    (r) => {
      r.turn = 3;
    },
    (r) => {
      r.event = 'old';
    },
    (r) => {
      r.signature = '';
    },
    (r) => {
      Object.assign(r, { phase: 4 });
    },
    (r) => {
      Object.assign(r, { mode: 'cunning' });
    },
    (r) => {
      Object.assign(r, { version: 2 });
    },
    (r) => {
      r.roster.reverse();
    },
    (r) => {
      r.roster[0].id = 'foreign';
    },
    (r) => {
      r.roster[0].faction = 'guild';
    },
    (r) => {
      delete (r as Partial<NexusGuildSecretAllyReceipt>).signature;
    },
    (r) => {
      Object.assign(r, { cost: 0 });
    },
  ];
  for (const change of changes) {
    const bad = clone(receipt);
    change(bad);
    const before = clone(bad);
    assert.throws(() => validateNexusGuildSecretAlly(context, bad));
    assert.deepEqual(bad, before);
  }
  const inherited = Object.assign(
    Object.create({ untrusted: true }),
    receipt,
  ) as NexusGuildSecretAllyReceipt;
  assert.throws(() => validateNexusGuildSecretAlly(context, inherited));
  assert.equal(JSON.stringify(receipt).includes('hand'), false);
  assert.equal(JSON.stringify(receipt).includes('spice'), false);
});
