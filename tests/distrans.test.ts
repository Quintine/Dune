import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, type Card } from '../game/cards';
import { FACTIONS } from '../game/catalog';
import { richeseCards } from '../game/richese-cards';
import { transferDistrans, type DistransParticipant } from '../game/distrans';

function fixture() {
  const distrans = richeseCards().find((card) => card.effect === 'distrans')!;
  const [given, retained, held] = baseDeck();
  const owner: DistransParticipant = {
    id: 'owner',
    hand: [distrans, given, retained],
  };
  const recipient: DistransParticipant = { id: 'recipient', hand: [held] };
  return { owner, recipient, distrans, given, retained, held };
}

void test('all twelve donor factions may transfer to an unrelated recipient without an alliance or payment contract', () => {
  assert.equal(FACTIONS.length, 12);
  for (const faction of FACTIONS) {
    const { owner, recipient, distrans, given } = fixture();
    const donor = { ...owner, faction: faction.id, ally: null, spice: 0 };
    const target = { ...recipient, ally: 'someone-else', spice: 0 };
    const before = structuredClone({ donor, target });
    const result = transferDistrans(donor, target, distrans.id, given.id, 4);
    assert.equal(result.ownerHand.length, 1);
    assert.deepEqual(result.recipientHand.at(-1), given);
    assert.deepEqual(result.discarded, distrans);
    assert.deepEqual({ donor, target }, before);
  }
});

void test('ordinary and other Richese cards transfer while only the activating Distrans enters discard', () => {
  const cards = [
    ...baseDeck(),
    ...richeseCards().filter((card) => card.effect !== 'distrans'),
  ];
  for (const given of cards) {
    const { distrans } = fixture();
    const owner = { id: 'owner', hand: [distrans, given] };
    const recipient = { id: 'recipient', hand: [] };
    const result = transferDistrans(owner, recipient, distrans.id, given.id, 1);
    assert.deepEqual(result.ownerHand, []);
    assert.deepEqual(result.recipientHand, [given]);
    assert.deepEqual(result.transferred, given);
    assert.deepEqual(result.discarded, distrans);
    assert.deepEqual(
      [...result.ownerHand, ...result.recipientHand, result.discarded]
        .map((c) => c.id)
        .sort(),
      owner.hand.map((c) => c.id).sort(),
    );
  }
});

void test('current recipient capacity permits the final slot and rejects full, zero and malformed limits immutably', () => {
  for (const limit of [1, 4, 5, 8]) {
    const { owner, distrans, given } = fixture();
    const remaining = baseDeck().filter(
      (card) => !owner.hand.some((held) => held.id === card.id),
    );
    const recipient = { id: 'recipient', hand: remaining.slice(0, limit - 1) };
    assert.equal(
      transferDistrans(owner, recipient, distrans.id, given.id, limit)
        .recipientHand.length,
      limit,
    );
    const full = { ...recipient, hand: remaining.slice(0, limit) };
    const before = structuredClone({ owner, full });
    assert.throws(
      () => transferDistrans(owner, full, distrans.id, given.id, limit),
      /full/,
    );
    assert.deepEqual({ owner, full }, before);
  }
  const { owner, recipient, distrans, given } = fixture();
  assert.throws(
    () =>
      transferDistrans(
        owner,
        { ...recipient, hand: [] },
        distrans.id,
        given.id,
        0,
      ),
    /full/,
  );
  for (const limit of [
    NaN,
    Infinity,
    -Infinity,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws(
      () => transferDistrans(owner, recipient, distrans.id, given.id, limit),
      /hand limit/,
    );
});

void test('activation requires the exact canonical held identity and a distinct separately owned target', () => {
  const { owner, recipient, distrans, given } = fixture();
  for (const activation of [
    { ...distrans, id: 'fake' },
    { ...distrans, name: 'Fake' },
    { ...distrans, kind: 'worthless' as const },
    { ...distrans, effect: 'karama' },
    richeseCards().find((card) => card.effect === 'karama')!,
  ]) {
    const donor = { ...owner, hand: [activation, given] };
    assert.throws(
      () => transferDistrans(donor, recipient, activation.id, given.id, 4),
      /canonical/,
    );
  }
  assert.throws(
    () =>
      transferDistrans(
        { ...owner, hand: [given] },
        recipient,
        distrans.id,
        given.id,
        4,
      ),
    /canonical/,
  );
  assert.throws(
    () => transferDistrans(owner, recipient, distrans.id, distrans.id, 4),
    /itself is unresolved/,
  );
  assert.throws(
    () =>
      transferDistrans(owner, recipient, distrans.id, recipient.hand[0].id, 4),
    /own hand/,
  );
  for (const id of [owner.id, ''])
    assert.throws(
      () =>
        transferDistrans(owner, { ...recipient, id }, distrans.id, given.id, 4),
      /different player/,
    );
});

void test('duplicate, shared and sparse physical custody is rejected before either hand changes', () => {
  const { owner, recipient, distrans, given, retained, held } = fixture();
  const hole: Card[] = [];
  hole.length = 2;
  const emptySlot: Card[] = [];
  emptySlot.length = 1;
  hole[0] = distrans;
  const cases: [DistransParticipant, DistransParticipant][] = [
    [{ ...owner, hand: [...owner.hand, { ...distrans }] }, recipient],
    [{ ...owner, hand: [...owner.hand, { ...retained }] }, recipient],
    [owner, { ...recipient, hand: [held, { ...held }] }],
    [owner, { ...recipient, hand: [given] }],
    [owner, { ...recipient, hand: [distrans] }],
    [owner, { ...recipient, hand: [retained] }],
    [{ ...owner, hand: hole }, recipient],
    [owner, { ...recipient, hand: emptySlot }],
    [{ ...owner, hand: [...owner.hand, { ...held, id: '' }] }, recipient],
  ];
  for (const [donor, target] of cases) {
    const before = structuredClone({ donor, target });
    assert.throws(
      () => transferDistrans(donor, target, distrans.id, given.id, 8),
      /unique physical/,
    );
    assert.deepEqual({ donor, target }, before);
  }
});

void test('JSON restoration conserves exact identities, cloned outputs are independent and replay fails', () => {
  const original = fixture();
  const { owner, recipient, distrans, given } = JSON.parse(
    JSON.stringify(original),
  ) as ReturnType<typeof fixture>;
  const before = structuredClone({ owner, recipient });
  const result = transferDistrans(owner, recipient, distrans.id, given.id, 4);
  const settled = {
    owner: { ...owner, hand: result.ownerHand },
    recipient: { ...recipient, hand: result.recipientHand },
  };
  assert.throws(
    () =>
      transferDistrans(
        settled.owner,
        settled.recipient,
        distrans.id,
        given.id,
        4,
      ),
    /canonical/,
  );
  result.ownerHand[0].name = 'Changed retained output';
  result.recipientHand[0].name = 'Changed recipient output';
  result.transferred.name = 'Changed receipt';
  assert.equal(result.recipientHand.at(-1)!.name, given.name);
  result.discarded.name = 'Changed discard output';
  assert.deepEqual({ owner, recipient }, before);
  assert.deepEqual(original.owner, before.owner);
});
