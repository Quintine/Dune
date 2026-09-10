import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS, type FactionId } from '../game/catalog';
import {
  quoteNexusRicheseShipment,
  createNexusRichese,
  validateNexusRichese,
  type NexusRicheseContext,
  type NexusRicheseReceipt,
} from '../game/nexus-richese';
const context: NexusRicheseContext = {
  turn: 3,
  players: [
    { id: 'p', faction: 'atreides' },
    { id: 'q', faction: 'guild' },
    { id: 'r', faction: 'fremen' },
  ],
};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

void test('Richese Secret Ally prices one while retaining one through five actual physical forces for every supported faction and terrain', () => {
  for (const faction of FACTIONS.map((f) => f.id).filter(
    (f) => 'richese' !== f,
  ))
    for (const type of ['stronghold', 'sand', 'rock', 'polar'])
      for (let amount = 1; amount <= 5; amount++) {
        const player = { faction, halfRate: faction === 'guild' },
          before = clone(player);
        const q = quoteNexusRicheseShipment(player, type, amount);
        assert.deepEqual(q, {
          physicalAmount: amount,
          pricedAmount: 1,
          cost:
            faction === 'fremen'
              ? 0
              : faction === 'guild' || type === 'stronghold'
                ? 1
                : 2,
          source: 'nexusRichese',
        });
        assert.deepEqual(player, before);
      }
});
void test('an existing Karama half rate uses the one-force basis; suppressed Guild half rate and native Fremen free transport remain distinct', () => {
  assert.equal(
    quoteNexusRicheseShipment(
      { faction: 'emperor', halfRate: false },
      'sand',
      5,
    ).cost,
    2,
  );
  assert.equal(
    quoteNexusRicheseShipment({ faction: 'emperor', halfRate: true }, 'sand', 5)
      .cost,
    1,
  );
  assert.equal(
    quoteNexusRicheseShipment({ faction: 'guild', halfRate: false }, 'rock', 5)
      .cost,
    2,
  );
  assert.equal(
    quoteNexusRicheseShipment(
      { faction: 'guild', halfRate: true },
      'stronghold',
      5,
    ).cost,
    1,
  );
  for (const halfRate of [false, true])
    assert.equal(
      quoteNexusRicheseShipment({ faction: 'fremen', halfRate }, 'sand', 5)
        .cost,
      0,
    );
});
void test('quote refuses empty, fractional, excess or malformed physical groups and non-Arrakis price domains without mutating inputs', () => {
  const player = Object.freeze({
    faction: 'emperor' as const,
    halfRate: false,
  });
  for (const amount of [
    0,
    -1,
    6,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER,
    '3',
    null,
    undefined,
  ])
    assert.throws(() =>
      quoteNexusRicheseShipment(player, 'sand', amount as number),
    );
  for (const type of ['homeworld', 'reserves', 'unknown', ''])
    assert.throws(() => quoteNexusRicheseShipment(player, type, 3));
  assert.throws(() =>
    quoteNexusRicheseShipment(
      { faction: 'richese', halfRate: false },
      'sand',
      3,
    ),
  );
  assert.throws(() =>
    quoteNexusRicheseShipment(
      { faction: 'unknown' as FactionId, halfRate: false },
      'sand',
      3,
    ),
  );
  assert.throws(() =>
    quoteNexusRicheseShipment(
      { faction: 'emperor', halfRate: 'yes' as unknown as boolean },
      'sand',
      3,
    ),
  );
});
void test('Richese receipt is bound to its real absent-faction owner and turn while canonicalizing public seat order', () => {
  for (const p of context.players) {
    const r = createNexusRichese(context, p.id);
    assert.equal(r.event, JSON.stringify(['nexusRichese', 3, p.id]));
    assert.equal(r.phase, 5);
    assert.equal(r.mode, 'secretAlly');
    validateNexusRichese(context, clone(r));
    assert.deepEqual(
      createNexusRichese(
        { ...context, players: [...context.players].reverse() },
        p.id,
      ),
      r,
    );
    assert.notEqual(
      createNexusRichese({ ...context, turn: 4 }, p.id).event,
      r.event,
    );
  }
  const copied = clone(context),
    r = createNexusRichese(copied, 'p');
  copied.players[0].id = 'changed';
  assert.equal(r.roster[0].id, 'p');
  assert.throws(() => createNexusRichese(context, 'foreign'));
  assert.throws(() =>
    createNexusRichese(
      {
        ...context,
        players: [...context.players, { id: 's', faction: 'richese' }],
      },
      'p',
    ),
  );
});
void test('historical Richese receipt survives later turns and alliances without reading hands, funds, No-Field values or other secrets', () => {
  const r = createNexusRichese(context, 'p'),
    before = clone(r);
  const fail = () => {
    throw new Error('Private field read');
  };
  const players = context.players.map((p) =>
    Object.defineProperties(
      { ...p },
      {
        hand: { enumerable: true, get: fail },
        spice: { enumerable: true, get: fail },
        ally: { enumerable: true, get: fail },
        noField: { enumerable: true, get: fail },
        traitors: { enumerable: true, get: fail },
      },
    ),
  );
  const later = Object.defineProperties(
    { turn: 5, players },
    { nexusCards: { get: fail }, response: { get: fail } },
  );
  validateNexusRichese(later, r);
  createNexusRichese(later, 'q');
  assert.deepEqual(r, before);
  const pricePlayer = Object.defineProperties(
    { faction: 'fremen' as const, halfRate: false },
    { spice: { get: fail }, reserves: { get: fail }, noField: { get: fail } },
  );
  assert.equal(
    quoteNexusRicheseShipment(pricePlayer, 'sand', 5).physicalAmount,
    5,
  );
});
void test('Richese historical validation rejects changed evidence, deleted fields and malformed roster without rewriting it', () => {
  const original = createNexusRichese(context, 'p');
  const edits: ((r: NexusRicheseReceipt) => void)[] = [
    (r) => {
      r.owner = 'q';
    },
    (r) => {
      r.turn++;
    },
    (r) => {
      r.event = 'old';
    },
    (r) => {
      r.phase = 4 as 5;
    },
    (r) => {
      r.mode = 'cunning' as 'secretAlly';
    },
    (r) => {
      r.signature = 'changed';
    },
    (r) => {
      r.roster.reverse();
    },
    (r) => {
      r.roster[0].faction = 'emperor';
    },
    (r) => {
      r.roster[0].id = 'other';
    },
    (r) => {
      r.roster.pop();
    },
    (r) => {
      Object.assign(r, { hiddenHand: [] });
    },
    (r) => {
      Reflect.deleteProperty(r, 'version');
    },
    (r) => {
      Reflect.deleteProperty(r, 'signature');
    },
    (r) => {
      Object.assign(r.roster[0], { extra: true });
    },
  ];
  for (const edit of edits) {
    const r = clone(original);
    edit(r);
    const before = clone(r);
    assert.throws(() => validateNexusRichese(context, r));
    assert.deepEqual(r, before);
  }
  assert.throws(() => validateNexusRichese({ ...context, turn: 2 }, original));
  for (const id of ['__proto__', 'prototype', 'constructor', ''])
    assert.throws(() =>
      createNexusRichese({ turn: 1, players: [{ id, faction: 'guild' }] }, id),
    );
  for (const invalid of [
    { ...context, turn: 0 },
    { ...context, turn: 1.5 },
    { ...context, players: [] },
    { ...context, players: [context.players[0], context.players[0]] },
    {
      ...context,
      players: [
        { id: 'p', faction: 'atreides' },
        { id: 'q', faction: 'atreides' },
      ],
    },
  ] as NexusRicheseContext[])
    assert.throws(() => createNexusRichese(invalid, 'p'));
  const proto = Object.assign(
    Object.create({ extra: true }) as NexusRicheseReceipt,
    original,
  );
  assert.throws(() => validateNexusRichese(context, proto));
});
