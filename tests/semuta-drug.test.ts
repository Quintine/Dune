import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  SEMUTA_DRUG_ID,
  committedSemutaCandidates,
  resolveSemutaDrug,
  type SemutaContext,
  type SemutaCommitment,
} from '../game/semuta-drug';
const semuta = () => richeseCards().find((c) => c.id === SEMUTA_DRUG_ID)!;
function fixture(): SemutaContext {
  const cards = baseDeck();
  const old = cards[0],
    fresh = cards[1],
    own = cards[2],
    other = cards[3];
  return {
    owner: 'holder',
    ownerHand: [semuta(), cards[4]],
    discard: [old, fresh, own, other],
    event: 'fresh-1',
    turn: 2,
    phase: 3,
    semutaId: SEMUTA_DRUG_ID,
    handLimit: 4,
    incomingReservedSlots: 0,
    capacityPolicy: 'freeSlot',
    reservedTargetIds: [],
    batch: {
      event: 'fresh-1',
      turn: 2,
      phase: 3,
      cause: 'simultaneous',
      entries: [
        {
          card: structuredClone(fresh),
          discardedBy: 'victim-a',
          publicFace: false,
        },
        { card: structuredClone(own), discardedBy: 'holder', publicFace: true },
        {
          card: structuredClone(other),
          discardedBy: 'victim-b',
          publicFace: true,
        },
      ],
    },
  };
}
const commitment = (c: SemutaContext): SemutaCommitment => ({
  event: c.event,
  player: c.owner,
  semutaId: SEMUTA_DRUG_ID,
});
const target = (c: SemutaContext) => c.batch.entries[0].card.id;
function rejected(c: SemutaContext, selected = target(c)) {
  const before = structuredClone(c);
  assert.throws(() => resolveSemutaDrug(c, selected));
  assert.deepEqual(c, before);
}

void test('Semuta claims exactly one other-player fresh card, preserves pile order, and discards itself last without mutating inputs', () => {
  const c = fixture(),
    before = structuredClone(c),
    ids = [...c.ownerHand, ...c.discard].map((card) => card.id).sort();
  const r = resolveSemutaDrug(c, target(c));
  assert.deepEqual(c, before);
  assert.deepEqual(
    r.ownerHand.map((card) => card.id),
    [c.ownerHand[1].id, target(c)],
  );
  assert.deepEqual(
    r.discard.map((card) => card.id),
    [c.discard[0].id, c.discard[2].id, c.discard[3].id, SEMUTA_DRUG_ID],
  );
  assert.deepEqual(
    [...r.ownerHand, ...r.discard].map((card) => card.id).sort(),
    ids,
  );
  assert.equal(r.usedCard.id, SEMUTA_DRUG_ID);
  assert.equal(r.claimedCard.id, target(c));
  r.claimedCard.name = 'Changed receipt';
  r.usedCard.name = 'Changed receipt';
  assert.equal(r.ownerHand.at(-1)!.name, c.batch.entries[0].card.name);
  assert.equal(r.discard.at(-1)!.name, 'Semuta Drug');
  r.ownerHand[0].name = 'Changed output';
  assert.deepEqual(c, before);
});
void test('private candidate inspection requires an exact caller commitment and excludes own and explicitly reserved targets', () => {
  const c = fixture(),
    before = structuredClone(c);
  const cards = committedSemutaCandidates(c, commitment(c));
  assert.deepEqual(
    cards.map((card) => card.id),
    [target(c), c.batch.entries[2].card.id],
  );
  cards[0].name = 'Changed authorized snapshot';
  assert.deepEqual(c, before);
  for (const supplied of [
    undefined,
    {},
    { ...commitment(c), event: 'old' },
    { ...commitment(c), player: 'observer' },
    { ...commitment(c), semutaId: 'other' },
  ])
    assert.throws(() =>
      committedSemutaCandidates(c, supplied as SemutaCommitment),
    );
  c.reservedTargetIds = [target(c)];
  assert.deepEqual(
    committedSemutaCandidates(c, commitment(c)).map((card) => card.id),
    [c.batch.entries[2].card.id],
  );
  rejected(c, target(c));
  rejected(c, c.batch.entries[1].card.id);
  c.reservedTargetIds = [...c.reservedTargetIds, c.batch.entries[2].card.id];
  assert.throws(() => committedSemutaCandidates(c, commitment(c)));
});
void test('old, expired, missing and replayed physical targets are rejected atomically', () => {
  const c = fixture();
  rejected(c, c.discard[0].id);
  rejected(c, 'guess');
  for (const field of ['event', 'turn', 'phase'] as const) {
    const changed = structuredClone(c);
    if (field === 'event') changed.event = 'later';
    else changed[field]++;
    rejected(changed);
  }
  const absent = structuredClone(c);
  absent.discard = absent.discard.filter((card) => card.id !== target(c));
  rejected(absent);
  const r = resolveSemutaDrug(c, target(c));
  rejected({ ...c, ownerHand: r.ownerHand, discard: r.discard });
});
void test('canonical Semuta identity is required and every supplied physical zone and batch rejects duplicates', () => {
  const start = fixture();
  for (const patch of [
    { id: 'forged' },
    { name: 'Other name' },
    { kind: 'poison' },
    { effect: 'other' },
    { effect: undefined },
  ]) {
    const c = structuredClone(start);
    c.ownerHand = [
      { ...c.ownerHand[0], ...patch } as Card,
      ...c.ownerHand.slice(1),
    ];
    c.semutaId = c.ownerHand[0].id;
    rejected(c);
  }
  for (const corrupt of [
    (c: SemutaContext) => {
      c.ownerHand = [...c.ownerHand, c.ownerHand[0]];
    },
    (c: SemutaContext) => {
      c.discard = [...c.discard, c.ownerHand[0]];
    },
    (c: SemutaContext) => {
      c.discard = [...c.discard, c.discard[0]];
    },
    (c: SemutaContext) => {
      c.batch.entries = [...c.batch.entries, c.batch.entries[0]];
    },
    (c: SemutaContext) => {
      c.batch.entries[0].card.name = 'Changed snapshot';
    },
  ]) {
    const c = structuredClone(start);
    corrupt(c);
    rejected(c);
  }
});
void test('both explicit capacity policies account for incoming reservations without selecting a default ruling', () => {
  for (const capacityPolicy of ['exchange', 'freeSlot'] as const)
    for (let held = 1; held <= 5; held++)
      for (let reserved = 0; reserved <= 3; reserved++) {
        const c = fixture();
        c.ownerHand = [semuta(), ...baseDeck().slice(10, 10 + held - 1)];
        c.capacityPolicy = capacityPolicy;
        c.incomingReservedSlots = reserved;
        const legal =
          held + reserved + (capacityPolicy === 'freeSlot' ? 1 : 0) <=
          c.handLimit;
        if (legal) {
          const result = resolveSemutaDrug(c, target(c));
          assert.equal(result.ownerHand.length, held);
        } else rejected(c);
      }
  for (const capacityPolicy of [undefined, null, 'automatic', ''])
    rejected({ ...fixture(), capacityPolicy } as SemutaContext);
  for (const n of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    rejected({ ...fixture(), handLimit: n });
    rejected({ ...fixture(), incomingReservedSlots: n });
  }
});
void test('fresh Box, Cheap Hero, Worthless, weapons and Karama are valid Treachery targets in every phase', () => {
  const catalog = [...baseDeck(), ...ixDeck(), ...richeseCards()];
  const targets = [
    catalog.find((c) => c.effect === 'nullentropyBox')!,
    catalog.find((c) => c.kind === 'hero')!,
    catalog.find((c) => c.kind === 'worthless')!,
    catalog.find((c) => c.kind === 'projectile')!,
    catalog.find((c) => c.kind === 'poisonTooth')!,
    catalog.find((c) => c.effect === 'karama')!,
  ];
  for (const card of targets)
    for (let phase = 0; phase <= 8; phase++) {
      const c = fixture();
      c.ownerHand = [semuta()];
      c.discard = [card];
      c.phase = phase;
      c.batch = {
        ...c.batch,
        phase,
        entries: [
          {
            card: structuredClone(card),
            discardedBy: 'other',
            publicFace: false,
          },
        ],
      };
      assert.equal(committedSemutaCandidates(c, commitment(c)).length, 1);
      assert.deepEqual(resolveSemutaDrug(c, card.id).ownerHand, [card]);
    }
});
void test('non-Treachery entries, malformed ownership/visibility and sparse restored arrays cannot become candidates', () => {
  for (const patch of [
    { kind: 'leader' },
    { kind: 'traitor' },
    { kind: 'force' },
    { id: '' },
  ]) {
    const c = fixture(),
      bad = { ...c.discard[1], ...patch } as Card;
    c.discard = [bad];
    c.batch.entries = [{ card: bad, discardedBy: 'other', publicFace: false }];
    rejected(c, bad.id);
  }
  for (const corrupt of [
    (c: SemutaContext) => {
      c.batch.entries[0].discardedBy = '';
    },
    (c: SemutaContext) => {
      c.batch.entries[0].publicFace = undefined as unknown as boolean;
    },
    (c: SemutaContext) => {
      c.batch.entries = [];
      (c.batch.entries as unknown[]).length = 1;
    },
    (c: SemutaContext) => {
      c.ownerHand = [];
      (c.ownerHand as unknown[]).length = 2;
    },
    (c: SemutaContext) => {
      c.discard = [];
      (c.discard as unknown[]).length = 2;
    },
    (c: SemutaContext) => {
      c.batch.cause = '';
    },
    (c: SemutaContext) => {
      c.reservedTargetIds = ['', 'x'];
    },
  ]) {
    const c = fixture();
    corrupt(c);
    const before = structuredClone(c);
    assert.throws(() => resolveSemutaDrug(c, 'target'));
    assert.deepEqual(c, before);
  }
});
void test('own-only batches have no claim and private-face labels do not grant broader inspection', () => {
  const c = fixture();
  c.batch.entries = c.batch.entries.map((entry) => ({
    ...entry,
    discardedBy: c.owner,
  }));
  assert.throws(() => committedSemutaCandidates(c, commitment(c)));
  rejected(c);
  const mixed = fixture(),
    other = structuredClone(mixed);
  other.batch.entries = other.batch.entries.map((entry) => ({
    ...entry,
    publicFace: !entry.publicFace,
  }));
  assert.deepEqual(
    committedSemutaCandidates(mixed, commitment(mixed)),
    committedSemutaCandidates(other, commitment(other)),
  );
  assert.deepEqual(
    resolveSemutaDrug(mixed, target(mixed)),
    resolveSemutaDrug(other, target(other)),
  );
});
