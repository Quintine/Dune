import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  isDefenseCard,
  isPortableSnooper,
  defenseTypes,
  defaultVoiceMatch,
  playedVoiceMatch,
  validBattleCardPair,
  weaponKills,
} from '../game/battle-cards';
import { portableSnooperPlanBlock } from '../game/portable-snooper';
import { parsePlanClaim } from '../game/battle-promises';
import { TRUTH_CARD_NAMES } from '../game/truthtrance';
import type { Plan } from '../game/engine';

const portable = richeseCards().find((c) => c.effect === 'portableSnooper')!;
const cards = [...baseDeck(), ...ixBattleCards()];
const get = (kind: Card['kind']) => cards.find((c) => c.kind === kind)!;
const plan: Plan = {
  leader: 'leader',
  dial: 1,
  support: 0,
  weapon: null,
  defense: null,
};

void test('only the canonical persisted Portable identity gains the poison-defense role', () => {
  assert.equal(portable.kind, 'special');
  assert.ok(isPortableSnooper(portable));
  assert.ok(isDefenseCard(portable));
  for (const c of [
    { ...portable, id: 'forged' },
    { ...portable, name: 'Snooper' },
    { ...portable, effect: 'other' },
    ...richeseCards().filter((c) => c.id !== portable.id),
  ])
    assert.equal(isPortableSnooper(c), false);
  assert.deepEqual(defenseTypes(portable), ['snooper']);
  assert.ok(validBattleCardPair(get('projectile'), portable));
  assert.equal(validBattleCardPair(portable), false);
  assert.ok(defaultVoiceMatch(portable, 'snooper'));
  assert.ok(playedVoiceMatch(portable, 'defense', 'snooper'));
  assert.equal(playedVoiceMatch(portable, 'weapon', 'snooper'), false);
});
void test('Portable stops ordinary poison and weapon Chemistry but no Tooth, Lasgun, projectile or Artillery', () => {
  for (const kind of ['poison', 'chemistry'] as const)
    assert.equal(weaponKills(get(kind), portable), false);
  for (const kind of [
    'projectile',
    'poisonBlade',
    'poisonTooth',
    'lasgun',
    'artillery',
  ] as const)
    assert.equal(weaponKills(get(kind), portable), true);
});
void test('a late defense uses a spare slot, allowing lone Worthless in either original slot', () => {
  const worthless = get('worthless'),
    weapon = get('projectile'),
    hand = [portable, worthless, weapon];
  for (const p of [
    plan,
    { ...plan, weapon: weapon.id },
    { ...plan, weapon: worthless.id },
    { ...plan, defense: worthless.id },
  ])
    assert.equal(portableSnooperPlanBlock(p, hand, portable), null);
  for (const p of [
    { ...plan, weapon: weapon.id, defense: worthless.id },
    { ...plan, leader: null },
    { ...plan, defense: 'missing' },
  ])
    assert.ok(portableSnooperPlanBlock(p, hand, portable));
  assert.ok(
    portableSnooperPlanBlock(
      { ...plan, defense: get('snooper').id },
      [...hand, get('snooper')],
      portable,
    ),
  );
  const two = baseDeck()
    .filter((c) => c.kind === 'worthless')
    .slice(0, 2);
  assert.ok(
    portableSnooperPlanBlock(
      { ...plan, weapon: two[0].id, defense: two[1].id },
      [portable, ...two],
      portable,
    ),
  );
});
void test('late eligibility obeys forbidden poison defense while preserving unrelated Voice commands', () => {
  assert.match(
    portableSnooperPlanBlock(plan, [portable], portable, {
      target: 'p',
      kind: 'snooper',
      must: false,
    })!,
    /Voice/,
  );
  assert.equal(
    portableSnooperPlanBlock(plan, [portable], portable, {
      target: 'p',
      kind: 'shield',
      must: false,
    }),
    null,
  );
});
void test('structured Truthtrance and plan questions include canonical Richese card identities', () => {
  assert.ok(TRUTH_CARD_NAMES.includes(portable.name));
  assert.deepEqual(
    parsePlanClaim({ kind: 'defense', name: portable.name }, []),
    { kind: 'defense', name: portable.name },
  );
  assert.throws(() =>
    parsePlanClaim({ kind: 'defense', name: 'Invented Snooper' }, []),
  );
});
