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
  for (const unsupported of ['ecaz', ECAZ_TREACHERY_VARIANT.id])
    assert.throws(() => treacheryDeck([unsupported]), /not implemented/);
  assert.equal(ECAZ_TREACHERY_VARIANT.independentOfFactions, true);
  assert.equal(ECAZ_TREACHERY_VARIANT.independentOfOtherVariants, true);
  assert.equal(ECAZ_TREACHERY_VARIANT.activation, 'not-implemented');
});

void test('factory instances and their mutable cards are independent of canonical definitions', () => {
  const first = ecazTreacheryCards();
  first[0].name = 'Changed';
  first.splice(1, 1);
  const second = ecazTreacheryCards();
  assert.equal(second.length, 3);
  assert.equal(second[0].name, 'Recruits');
  assert.equal(ECAZ_TREACHERY_DEFINITIONS[0].card.name, 'Recruits');
  assert.ok(Object.isFrozen(ECAZ_TREACHERY_DEFINITIONS));
  for (const definition of ECAZ_TREACHERY_DEFINITIONS) {
    assert.ok(Object.isFrozen(definition));
    assert.ok(Object.isFrozen(definition.card));
    assert.ok(Object.isFrozen(definition.gameplay));
    assert.ok(Object.isFrozen(definition.battleSlots));
    assert.ok(Object.isFrozen(definition.verification.unresolved));
  }
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

void test('verified inventory and source rules remain distinct from unimplemented runtime and unresolved interactions', () => {
  for (const definition of ECAZ_TREACHERY_DEFINITIONS) {
    assert.equal(definition.quantity, 1);
    assert.equal(definition.verification.inventory, 'verified');
    assert.equal(definition.verification.sourceRules, 'verified');
    assert.equal(definition.verification.runtime, 'not-implemented');
    assert.equal(definition.verification.combinedInteractions, 'incomplete');
    assert.ok(definition.verification.unresolved.length > 0);
    assert.ok(definition.summary.length > 20);
    assert.ok(definition.gameplay.length >= 4);
    assert.ok(definition.gameplay.every((paragraph) => paragraph.length > 15));
  }
});

void test('every canonical Ecaz face receives its full original gameplay guide and a concise normal-card summary', () => {
  for (const card of ecazTreacheryCards()) {
    const definition = ecazTreacheryDefinition(card)!;
    const presentation = cardPresentation(card);
    assert.equal(presentation.guidance, definition.summary);
    assert.deepEqual(presentation.gameplay, definition.gameplay);
    assert.equal(presentation.category, 'Special treachery');
    assert.equal(presentation.role, 'utility');
    assert.deepEqual(Object.keys(presentation).sort(), [
      'category',
      'gameplay',
      'guidance',
      'role',
      'topics',
    ]);
    const serialized = JSON.stringify(presentation);
    for (const note of definition.verification.unresolved)
      assert.equal(serialized.includes(note), false);
    assert.equal(serialized.includes('sourceRules'), false);
    assert.equal(serialized.includes('not-implemented'), false);
    assert.deepEqual(presentation.topics, []);
  }
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

void test('base and Ix card guides retain their role, summary and reference topics without Ecaz enrichment', () => {
  for (const card of [...baseDeck(), ...ixDeck()]) {
    const presentation = cardPresentation(card);
    assert.equal(presentation.gameplay, undefined);
    assert.ok(presentation.guidance.length > 20);
  }
  const weapon = cardPresentation(baseDeck()[0]);
  assert.equal(weapon.role, 'weapon');
  assert.equal(
    weapon.guidance,
    'Play in the weapon slot of your battle plan. A projectile weapon kills an opposing leader who has no projectile defense.',
  );
  assert.ok(weapon.topics.some((topic) => topic.id === 'battle-cards'));
  const poisonTooth = cardPresentation(
    ixDeck().find((card) => card.kind === 'poisonTooth')!,
  );
  assert.equal(poisonTooth.role, 'weapon');
  assert.ok(
    poisonTooth.topics.some((topic) => topic.id === 'card-poison-tooth'),
  );
  const hero = cardPresentation(
    baseDeck().find((card) => card.kind === 'hero')!,
  );
  assert.equal(hero.role, 'leader');
  assert.ok(hero.topics.some((topic) => topic.id === 'cheap-hero-traitor'));
  assert.equal(treacheryDeck().length, 33);
  assert.equal(treacheryDeck(['ix']).length, 47);
});
