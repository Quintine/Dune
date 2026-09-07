import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  prepareRicheseGift,
  transferRicheseGift,
  type RicheseGiftParticipant,
} from '../game/richese-gift';

function fixture() {
  const owner: RicheseGiftParticipant = {
    id: 'r',
    faction: 'richese',
    ally: 'a',
    hand: richeseCards(),
  };
  const ally: RicheseGiftParticipant = {
    id: 'a',
    faction: 'atreides',
    ally: 'r',
    hand: baseDeck().slice(0, 2),
  };
  return { owner, ally };
}
void test('each of the ten physical Richese cards can transfer once without altering either input hand', () => {
  for (const card of richeseCards()) {
    const { owner, ally } = fixture();
    const before = structuredClone({ owner, ally });
    const intent = prepareRicheseGift(owner, ally, card.id, 4);
    assert.deepEqual(intent, { owner: 'r', recipient: 'a', cardId: card.id });
    const transferred = transferRicheseGift(owner, ally, intent, 4);
    assert.equal(transferred.ownerHand.length, 9);
    assert.equal(transferred.recipientHand.length, 3);
    assert.deepEqual(transferred.card, card);
    assert.equal(transferred.recipientHand.at(-1)!.id, card.id);
    assert.deepEqual(
      [...transferred.ownerHand, ...transferred.recipientHand]
        .map((c) => c.id)
        .sort(),
      [...owner.hand, ...ally.hand].map((c) => c.id).sort(),
    );
    transferred.recipientHand.at(-1)!.name = 'Mutated output';
    transferred.card.name = 'Independent receipt';
    assert.deepEqual({ owner, ally }, before);
  }
});
void test('standard cards, effect/name impostors, cache-only and duplicate physical IDs are rejected immutably', () => {
  const { owner, ally } = fixture();
  const canonical = richeseCards()[0];
  const candidates: Card[][] = [
    baseDeck()
      .filter((c) => c.effect === 'karama')
      .slice(0, 1),
    [{ ...canonical, id: 'impostor' }],
    [{ ...canonical, name: 'impostor' }],
    [{ ...canonical, kind: 'worthless' }],
    [{ ...canonical, effect: 'karama' }],
    [],
    [canonical, { ...canonical }],
  ];
  for (const hand of candidates) {
    const supplied = { ...owner, hand };
    const before = structuredClone(supplied);
    assert.throws(
      () => prepareRicheseGift(supplied, ally, hand[0]?.id ?? canonical.id, 4),
      /canonical/,
    );
    assert.deepEqual(supplied, before);
  }
  assert.throws(
    () =>
      prepareRicheseGift(
        owner,
        { ...ally, hand: [canonical] },
        canonical.id,
        4,
      ),
    /already/,
  );
});
void test('gift requires the Richese actor and a distinct mutual ally, not faction identity or one-sided membership', () => {
  const { owner, ally } = fixture();
  const card = owner.hand[0].id;
  assert.throws(
    () => prepareRicheseGift({ ...owner, faction: 'harkonnen' }, ally, card, 4),
    /Only Richese/,
  );
  assert.throws(
    () => prepareRicheseGift(owner, { ...ally, id: 'r' }, card, 4),
    /different/,
  );
  for (const changed of [
    { ...owner, ally: null },
    { ...owner, ally: 'someone-else' },
  ])
    assert.throws(
      () => prepareRicheseGift(changed, ally, card, 4),
      /mutual ally/,
    );
  assert.throws(
    () => prepareRicheseGift(owner, { ...ally, ally: null }, card, 4),
    /mutual ally/,
  );
});
void test('current capacity is supplied explicitly and supports ordinary, CHOAM and Harkonnen limits', () => {
  for (const [faction, limit] of [
    ['atreides', 4],
    ['choam', 5],
    ['harkonnen', 8],
  ] as const) {
    const { owner, ally } = fixture();
    const recipient = {
      ...ally,
      faction,
      hand: baseDeck().slice(0, limit - 1),
    };
    const intent = prepareRicheseGift(
      owner,
      recipient,
      owner.hand[0].id,
      limit,
    );
    assert.equal(
      transferRicheseGift(owner, recipient, intent, limit).recipientHand.length,
      limit,
    );
    assert.throws(
      () =>
        prepareRicheseGift(
          owner,
          { ...recipient, hand: baseDeck().slice(0, limit) },
          owner.hand[0].id,
          limit,
        ),
      /full/,
    );
  }
  const { owner, ally } = fixture();
  for (const limit of [NaN, Infinity, -1, 4.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(
      () => prepareRicheseGift(owner, ally, owner.hand[0].id, limit),
      /hand limit/,
    );
});
void test('a JSON-restored intent revalidates identities, alliance, capacity and exact physical custody before execution', () => {
  const { owner, ally } = fixture();
  const intent = JSON.parse(
    JSON.stringify(prepareRicheseGift(owner, ally, owner.hand[0].id, 4)),
  );
  assert.equal(
    transferRicheseGift(owner, ally, intent, 4).recipientHand.length,
    3,
  );
  const staleCases: [RicheseGiftParticipant, RicheseGiftParticipant][] = [
    [{ ...owner, id: 'new-owner' }, ally],
    [owner, { ...ally, id: 'new-recipient' }],
    [{ ...owner, ally: null }, ally],
    [owner, { ...ally, hand: baseDeck().slice(0, 4) }],
    [{ ...owner, hand: owner.hand.slice(1) }, ally],
    [
      {
        ...owner,
        hand: [{ ...owner.hand[0], effect: 'karama' }, ...owner.hand.slice(1)],
      },
      ally,
    ],
  ];
  for (const [donor, recipient] of staleCases) {
    const before = structuredClone({ donor, recipient, intent });
    assert.throws(() => transferRicheseGift(donor, recipient, intent, 4));
    assert.deepEqual({ donor, recipient, intent }, before);
  }
});
void test('replayed transfer fails after custody changes and separate gift declarations have no artificial once-per-turn limit', () => {
  const { owner, ally } = fixture();
  const intent = prepareRicheseGift(owner, ally, owner.hand[0].id, 4);
  const first = transferRicheseGift(owner, ally, intent, 4);
  const donor = { ...owner, hand: first.ownerHand },
    recipient = { ...ally, hand: first.recipientHand };
  assert.throws(
    () => transferRicheseGift(donor, recipient, intent, 4),
    /canonical/,
  );
  const second = transferRicheseGift(
    donor,
    recipient,
    prepareRicheseGift(donor, recipient, donor.hand[0].id, 4),
    4,
  );
  assert.equal(second.recipientHand.length, 4);
  assert.equal(second.ownerHand.length, 8);
});
