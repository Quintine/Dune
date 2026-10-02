import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixDeck, treacheryDeck, type Card } from '../game/cards';
import { cardPresentation } from '../game/card-presentation';
import { DEFENSE_KINDS, WEAPON_KINDS } from '../game/battle-cards';
import {
  ECAZ_TREACHERY_DEFINITIONS,
  ECAZ_TREACHERY_VARIANT,
  ecazTreacheryCards,
  ecazTreacheryDefinition,
} from '../game/ecaz-cards';

void test('the verified Ecaz variant has one physical special of each identity and does not silently activate', () => {
  const cards = ecazTreacheryCards();
  assert.deepEqual(cards, [
    {
      id: 'ecaz-recruits',
      name: 'Recruits',
      kind: 'special',
      effect: 'recruits',
    },
    {
      id: 'ecaz-reinforcements',
      name: 'Reinforcements',
      kind: 'special',
      effect: 'reinforcements',
    },
    {
      id: 'ecaz-harass-withdraw',
      name: 'Harass & Withdraw',
      kind: 'special',
      effect: 'harassWithdraw',
    },
  ]);
  const combined = [...baseDeck(), ...ixDeck(), ...cards];
  assert.equal(combined.length, 50);
  assert.equal(new Set(combined.map((card) => card.id)).size, 50);
  assert.equal(treacheryDeck().length, 33);
  assert.equal(treacheryDeck(['ix']).length, 47);
  assert.equal(treacheryDeck(['ecaz']).length, 33);
  for (const unsupported of [ECAZ_TREACHERY_VARIANT.id, 'unknown'])
    assert.throws(() => treacheryDeck([unsupported]), /not implemented/);
  assert.equal(ECAZ_TREACHERY_VARIANT.independentOfFactions, true);
  assert.equal(ECAZ_TREACHERY_VARIANT.independentOfOtherVariants, true);
  assert.equal(ECAZ_TREACHERY_VARIANT.activation, 'audit-prototype');
});

void test('Ecaz faction selection preserves each ordinary deck and never includes its separate unfinished variant', () => {
  for (const other of [[], ['ix'], ['choam'], ['ix', 'choam']]) {
    const cards = treacheryDeck([...other, 'ecaz']);
    assert.deepEqual(cards, treacheryDeck(other));
    assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
    assert.equal(
      cards.some((card) => card.id.startsWith('ecaz-')),
      false,
    );
    assert.equal(
      cards.length,
      other.includes('ix') ? 47 : other.includes('choam') ? 35 : 33,
    );
  }
  assert.throws(
    () => treacheryDeck(['ecaz', ECAZ_TREACHERY_VARIANT.id]),
    /not implemented/,
  );
});

void test('factory instances and their mutable cards are independent of canonical definitions', () => {
  const first = ecazTreacheryCards();
  first[0].name = 'Changed';
  first.splice(1, 1);
  const second = ecazTreacheryCards();
  assert.equal(second.length, 3);
  assert.equal(second[0].name, 'Recruits');
  assert.equal(ECAZ_TREACHERY_DEFINITIONS[0].card.name, 'Recruits');
});

void test('slot occupancy never reclassifies the new special cards as weapons or defenses', () => {
  for (const card of ecazTreacheryCards()) {
    const definition = ecazTreacheryDefinition(card)!;
    assert.equal(definition.weaponCategory, false);
    assert.equal(definition.defenseCategory, false);
    assert.equal(WEAPON_KINDS.includes(card.kind), false);
    assert.equal(DEFENSE_KINDS.includes(card.kind), false);
    assert.deepEqual(
      definition.battleSlots,
      card.effect === 'recruits' ? [] : ['weapon', 'defense'],
    );
    assert.equal(definition.discard, 'after-use');
  }
});

void test('presentation lookup requires the canonical physical ID, kind and effect', () => {
  const card = ecazTreacheryCards()[0];
  assert.equal(ecazTreacheryDefinition(card)?.card.name, 'Recruits');
  assert.equal(
    ecazTreacheryDefinition({ ...card, id: 'treachery-0' }),
    undefined,
  );
  assert.equal(
    ecazTreacheryDefinition({ ...card, effect: 'harvester' }),
    undefined,
  );
  assert.equal(
    ecazTreacheryDefinition({ ...card, kind: 'worthless' }),
    undefined,
  );
  assert.equal(ecazTreacheryDefinition(baseDeck()[0]), undefined);
});


void test('missing, mismatched and merely similar Ecaz identities do not receive a canonical gameplay guide', () => {
  for (const card of ecazTreacheryCards()) {
    const bad: Card[] = [
      { ...card, id: '' },
      { ...card, id: 'unrelated-card' },
      { ...card, effect: undefined },
      { ...card, effect: 'unrelated-effect' },
      { ...card, kind: 'worthless' },
      { ...card, name: 'Unrelated name' },
      { ...card, id: card.id.toUpperCase() },
      { ...card, effect: card.effect.toUpperCase() },
    ];
    for (const supplied of bad) {
      const presentation = cardPresentation(supplied);
      assert.equal(presentation.gameplay, undefined);
      assert.notEqual(
        presentation.guidance,
        ecazTreacheryDefinition(card)!.summary,
      );
    }
  }
});

