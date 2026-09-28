import test from 'node:test';
import assert from 'node:assert/strict';
import { cardPresentation } from '../game/card-presentation';
import type { Card } from '../game/cards';
import { RICHESE_CARD_DEFINITIONS, richeseCards } from '../game/richese-cards';

void test('presentation does not export source-verification metadata or unverified interaction guesses', () => {
  for (const definition of RICHESE_CARD_DEFINITIONS) {
    const presentation = cardPresentation(definition.card);
    assert.deepEqual(Object.keys(presentation).sort(), [
      'availability',
      'category',
      'gameplay',
      'guidance',
      'role',
      'topics',
    ]);
    const serialized = JSON.stringify(presentation);
    for (const note of definition.verification.unresolved)
      assert.equal(serialized.includes(note), false);
    for (const metadata of [
      'physical-faces-verified',
      'original-paraphrase-of-physical-faces',
      'combinedInteractions',
      'https://cdn.anyfinder',
    ])
      assert.equal(serialized.includes(metadata), false);
  }
});

void test('missing, altered and merely similar Richese identities receive no canonical full guide', () => {
  for (const card of richeseCards()) {
    const impostors: Card[] = [
      { ...card, id: 'other-card' },
      { ...card, name: 'Other name' },
      { ...card, kind: 'poison' },
      { ...card, effect: 'unknown-effect' },
      { ...card, effect: undefined },
      { ...card, id: card.id.toUpperCase() },
    ];
    for (const impostor of impostors) {
      const result = cardPresentation(impostor);
      assert.equal(result.gameplay, undefined);
      assert.equal(result.availability, undefined);
      assert.equal(
        result.topics.some((topic) => topic.id === 'richese-cards'),
        false,
      );
    }
  }
});
