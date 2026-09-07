import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  eligibleNullentropyCards,
  resolveNullentropyBox,
} from '../game/nullentropy-box';

function fixture() {
  const box = richeseCards().find((card) => card.effect === 'nullentropyBox')!;
  const [held, selected, first, second] = baseDeck();
  return {
    box,
    selected,
    ownerHand: [held, box],
    discard: [first, selected, second],
  };
}

void test('eligibility excludes every Box identity by name or effect and returns independent faces', () => {
  const { box, selected } = fixture();
  const pile = [
    selected,
    box,
    { ...box, id: 'other-box' },
    { ...box, id: 'name-only', effect: 'unknown' },
    { ...box, id: 'effect-only', name: 'Alternate Box' },
  ];
  const before = structuredClone(pile);
  const cards = eligibleNullentropyCards(pile);
  assert.deepEqual(cards, [selected]);
  cards[0].name = 'Mutated output';
  assert.deepEqual(pile, before);
  assert.deepEqual(eligibleNullentropyCards([]), []);
});

void test('selected card goes to hand, exact supplied remainder order is preserved and played Box is top', () => {
  const { box, selected, ownerHand, discard } = fixture();
  const order = discard
    .filter((card) => card.id !== selected.id)
    .map((card) => card.id)
    .reverse();
  const before = structuredClone({ ownerHand, discard, order });
  const result = resolveNullentropyBox(
    ownerHand,
    box.id,
    discard,
    selected.id,
    order,
    4,
  );
  assert.deepEqual(result.ownerHand, [ownerHand[0], selected]);
  assert.deepEqual(
    result.discard.map((card) => card.id),
    [...order, box.id],
  );
  assert.deepEqual(result.selected, selected);
  assert.deepEqual(
    [...result.ownerHand, ...result.discard].map((card) => card.id).sort(),
    [...ownerHand, ...discard].map((card) => card.id).sort(),
  );
  assert.deepEqual({ ownerHand, discard, order }, before);
  const single = resolveNullentropyBox(
    ownerHand,
    box.id,
    [selected],
    selected.id,
    [],
    4,
  );
  assert.deepEqual(single.discard, [box]);
  const alternate = { ...box, id: 'another-physical-box' };
  const retained = resolveNullentropyBox(
    ownerHand,
    box.id,
    [alternate, selected],
    selected.id,
    [alternate.id],
    4,
  );
  assert.deepEqual(retained.discard, [alternate, box]);
});

void test('current capacity allows ordinary, CHOAM and Harkonnen spare slots but explicitly guards full hands', () => {
  const { box } = fixture();
  for (const limit of [4, 5, 8]) {
    const deck = baseDeck(),
      hand = [box, ...deck.slice(0, limit - 2)],
      selected = deck[limit];
    assert.equal(
      resolveNullentropyBox(hand, box.id, [selected], selected.id, [], limit)
        .ownerHand.length,
      limit - 1,
    );
    const full = [...hand, deck[limit - 1]],
      before = structuredClone(full);
    assert.throws(
      () =>
        resolveNullentropyBox(full, box.id, [selected], selected.id, [], limit),
      /Full-hand.*unresolved.*guard/,
    );
    assert.deepEqual(full, before);
  }
  const { ownerHand, selected, discard } = fixture();
  for (const limit of [
    NaN,
    Infinity,
    -Infinity,
    -1,
    4.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws(
      () =>
        resolveNullentropyBox(
          ownerHand,
          box.id,
          discard,
          selected.id,
          [],
          limit,
        ),
      /hand limit/,
    );
});

void test('canonical held activation and a real non-Box discard selection are required', () => {
  const { box, ownerHand, selected, discard } = fixture();
  const order = discard
    .filter((card) => card.id !== selected.id)
    .map((card) => card.id);
  for (const forged of [
    { ...box, id: 'forged' },
    { ...box, name: 'Forged' },
    { ...box, effect: 'karama' },
    { ...box, kind: 'worthless' as const },
  ])
    assert.throws(
      () =>
        resolveNullentropyBox(
          [forged],
          forged.id,
          discard,
          selected.id,
          order,
          4,
        ),
      /canonical/,
    );
  assert.throws(
    () => resolveNullentropyBox([], box.id, discard, selected.id, order, 4),
    /canonical/,
  );
  for (const pile of [
    [],
    [{ ...box, id: 'another-box' }],
    [{ ...box, id: 'name-only', effect: undefined }],
    [{ ...box, id: 'effect-only', name: 'Other' }],
  ])
    assert.throws(
      () =>
        resolveNullentropyBox(
          ownerHand,
          box.id,
          pile,
          pile[0]?.id ?? 'absent',
          [],
          4,
        ),
      /other than any/,
    );
  assert.throws(
    () =>
      resolveNullentropyBox(
        ownerHand,
        box.id,
        discard,
        ownerHand[0].id,
        order,
        4,
      ),
    /discard card/,
  );
});

void test('remaining order rejects missing, extra, duplicate, selected, held and sparse IDs immutably', () => {
  const { box, ownerHand, selected, discard } = fixture();
  const [a, b] = discard
    .filter((card) => card.id !== selected.id)
    .map((card) => card.id);
  const sparse: string[] = [];
  sparse.length = 2;
  sparse[0] = a;
  for (const order of [
    [],
    [a],
    [a, b, 'extra'],
    [a, a],
    [a, selected.id],
    [a, box.id],
    sparse,
  ]) {
    const before = structuredClone({ ownerHand, discard, order });
    assert.throws(
      () =>
        resolveNullentropyBox(
          ownerHand,
          box.id,
          discard,
          selected.id,
          order,
          4,
        ),
      /exact permutation/,
    );
    assert.deepEqual({ ownerHand, discard, order }, before);
  }
});

void test('duplicate, shared, missing-slot and empty physical identities cannot create a copy', () => {
  const { box, ownerHand, selected, discard } = fixture();
  const hole: Card[] = [];
  hole.length = 1;
  for (const [hand, pile] of [
    [[box, box], discard],
    [ownerHand, [...discard, selected]],
    [ownerHand, [...discard, box]],
    [[...ownerHand, selected], discard],
    [[box, ...hole], discard],
    [ownerHand, hole],
    [ownerHand, [{ ...selected, id: '' }]],
  ])
    assert.throws(
      () => resolveNullentropyBox(hand, box.id, pile, selected.id, [], 8),
      /unique physical/,
    );
  assert.throws(() => eligibleNullentropyCards(hole), /unique physical/);
  assert.throws(
    () => eligibleNullentropyCards([selected, selected]),
    /unique physical/,
  );
});

void test('JSON replay fails after custody changes and output receipts do not alias hands, pile or inputs', () => {
  const f = JSON.parse(JSON.stringify(fixture())) as ReturnType<typeof fixture>;
  const before = structuredClone(f);
  const order = f.discard
    .filter((card) => card.id !== f.selected.id)
    .map((card) => card.id);
  const result = resolveNullentropyBox(
    f.ownerHand,
    f.box.id,
    f.discard,
    f.selected.id,
    order,
    4,
  );
  assert.throws(
    () =>
      resolveNullentropyBox(
        result.ownerHand,
        f.box.id,
        result.discard,
        f.selected.id,
        order,
        4,
      ),
    /canonical/,
  );
  result.selected.name = 'Changed receipt';
  assert.equal(result.ownerHand.at(-1)!.name, f.selected.name);
  result.ownerHand[0].name = 'Changed hand';
  result.discard[0].name = 'Changed pile';
  result.discard.at(-1)!.name = 'Changed Box';
  assert.deepEqual(f, before);
});
