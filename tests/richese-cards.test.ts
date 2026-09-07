import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixDeck, treacheryDeck } from '../game/cards';
import {
  RICHESE_CARD_DEFINITIONS,
  RICHESE_COLLECTION,
  richeseCards,
  richeseCardDefinition,
} from '../game/richese-cards';

void test('Richese physical collection contains exactly the ten photographed identities, one each', () => {
  assert.deepEqual(
    richeseCards().map(({ id, name, effect }) => [id, name, effect]),
    [
      ['richese-ornithopter', 'Ornithopter', 'ornithopter'],
      ['richese-residual-poison', 'Residual Poison', 'residualPoison'],
      ['richese-semuta-drug', 'Semuta Drug', 'semutaDrug'],
      ['richese-stone-burner', 'Stone Burner', 'stoneBurner'],
      ['richese-mirror-weapon', 'Mirror Weapon', 'mirrorWeapon'],
      ['richese-portable-snooper', 'Portable Snooper', 'portableSnooper'],
      ['richese-distrans', 'Distrans', 'distrans'],
      ['richese-juice-of-sapho', 'Juice of Sapho', 'juiceOfSapho'],
      ['richese-karama', 'Karama', 'karama'],
      ['richese-nullentropy-box', 'Nullentropy Box', 'nullentropyBox'],
    ],
  );
  assert.equal(
    RICHESE_CARD_DEFINITIONS.reduce((sum, card) => sum + card.quantity, 0),
    10,
  );
  const combined = [...baseDeck(), ...ixDeck(), ...richeseCards()];
  assert.equal(new Set(combined.map((card) => card.id)).size, 57);
});

void test('inventory is fresh and deeply frozen metadata cannot be changed through returned cards', () => {
  const first = richeseCards();
  first[0].name = 'Changed';
  first.pop();
  assert.equal(richeseCards().length, 10);
  assert.equal(richeseCards()[0].name, 'Ornithopter');
  assert.ok(Object.isFrozen(RICHESE_CARD_DEFINITIONS));
  for (const definition of RICHESE_CARD_DEFINITIONS) {
    for (const value of [
      definition,
      definition.card,
      definition.gameplay,
      definition.behavior,
      definition.behavior.contract,
      definition.verification,
      definition.verification.unresolved,
    ])
      assert.ok(Object.isFrozen(value));
  }
});

void test('identity lookup requires matching physical identity rather than a familiar name or effect', () => {
  for (const card of richeseCards()) {
    assert.equal(richeseCardDefinition(card)?.card.name, card.name);
    for (const invalid of [
      { ...card, id: '' },
      { ...card, name: 'Unrelated' },
      { ...card, effect: undefined },
      { ...card, kind: 'worthless' as const },
      { ...card, id: card.id.toUpperCase() },
    ])
      assert.equal(richeseCardDefinition(invalid), undefined);
  }
  assert.equal(
    richeseCardDefinition(baseDeck().find((card) => card.effect === 'karama')!),
    undefined,
  );
});

void test('printed battle categories remain explicit without activating unsupported battle kinds or decks', () => {
  const weapons = RICHESE_CARD_DEFINITIONS.filter(
    (d) => d.behavior.battleCategory === 'weapon',
  );
  assert.deepEqual(
    weapons.map((d) => d.card.name),
    ['Stone Burner', 'Mirror Weapon'],
  );
  assert.deepEqual(
    RICHESE_CARD_DEFINITIONS.filter(
      (d) => d.behavior.battleCategory === 'poison-defense',
    ).map((d) => d.card.name),
    ['Portable Snooper'],
  );
  assert.equal(treacheryDeck().length, 33);
  assert.equal(treacheryDeck(['ix']).length, 47);
  assert.throws(() => treacheryDeck(['richese']), /not implemented/);
  assert.equal(RICHESE_COLLECTION.activation, 'not-implemented');
  assert.equal(RICHESE_COLLECTION.cacheCountsTowardHand, false);
});

void test('normal discard routing and exceptional Box ordering do not replenish the faction cache', () => {
  assert.equal(RICHESE_COLLECTION.discardedDestination, 'normal-discard');
  for (const definition of RICHESE_CARD_DEFINITIONS) {
    assert.equal(
      definition.behavior.spiceCost,
      definition.card.effect === 'nullentropyBox' ? 2 : 0,
    );
    assert.equal(
      definition.behavior.disposal,
      definition.card.effect === 'nullentropyBox'
        ? 'normal-discard-top-after-shuffle'
        : 'normal-discard',
    );
  }
  const box = RICHESE_CARD_DEFINITIONS.find(
    (d) => d.card.effect === 'nullentropyBox',
  )!;
  assert.match(
    box.gameplay.join(' '),
    /Secretly search the Treachery discard pile/,
  );
  assert.doesNotMatch(box.gameplay.join(' '), /next.*deck card/i);
  assert.match(box.gameplay.join(' '), /other than a Nullentropy Box/);
  assert.match(box.gameplay.join(' '), /then discard Nullentropy Box on top/);
});

void test('original guides preserve critical face restrictions and separate verification from runtime', () => {
  const guide = (effect: string) =>
    RICHESE_CARD_DEFINITIONS.find(
      (d) => d.card.effect === effect,
    )!.gameplay.join(' ');
  assert.match(
    guide('stoneBurner'),
    /ignore the strength of leaders who otherwise survive/,
  );
  assert.match(guide('stoneBurner'), /more undialed force tokens/);
  assert.match(guide('mirrorWeapon'), /copied weapon must be used first/);
  assert.match(guide('portableSnooper'), /both a weapon and a Worthless Card/);
  assert.match(guide('portableSnooper'), /Voice prevents/);
  assert.match(
    guide('juiceOfSapho'),
    /Once-Around auction permits using it to bid last/,
  );
  assert.match(guide('distrans'), /other than during a bid/);
  assert.match(guide('semutaDrug'), /another player discards/);
  assert.match(guide('residualPoison'), /No player collects spice/);
  for (const definition of RICHESE_CARD_DEFINITIONS) {
    assert.equal(definition.verification.inventory, 'physical-faces-verified');
    assert.equal(
      definition.verification.runtime,
      [
        'karama',
        'distrans',
        'nullentropyBox',
        'ornithopter',
        'residualPoison',
        'portableSnooper',
        'stoneBurner',
      ].includes(definition.card.effect)
        ? 'partial'
        : 'not-implemented',
    );
    assert.equal(definition.verification.combinedInteractions, 'incomplete');
    assert.ok(definition.verification.unresolved.length > 0);
    assert.ok(definition.gameplay.length >= 2);
    assert.doesNotMatch(definition.gameplay.join(' '), /https?:\/\//);
  }
});
