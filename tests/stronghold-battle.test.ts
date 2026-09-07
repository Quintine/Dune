import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  strongholdSnooper,
  strongholdBattleEffects,
} from '../game/stronghold-battle';
import { battleCardEffects, battleWeaponsExplode } from '../game/battle-cards';
const cards = [...baseDeck(), ...ixBattleCards(), ...richeseCards()];
const get = (kind: Card['kind']) => cards.find((c) => c.kind === kind)!;
const portable = cards.find((c) => c.effect === 'portableSnooper')!;
void test('Carthag uses the actual poison/projectile roles and requires a real non-poison defense', () => {
  const eligible = [get('shield'), get('weirdingWay')];
  const ineligible = [
    undefined,
    get('worthless'),
    get('snooper'),
    get('shieldSnooper'),
    get('chemistry'),
    portable,
  ];
  for (const weapon of [
    undefined,
    get('projectile'),
    get('weirdingWay'),
    get('worthless'),
    get('artillery'),
  ]) {
    for (const defense of eligible)
      assert.equal(strongholdSnooper('carthag', weapon, defense), true);
    for (const defense of ineligible)
      assert.equal(strongholdSnooper('carthag', weapon, defense), false);
  }
  for (const weapon of [
    get('poison'),
    get('chemistry'),
    get('poisonBlade'),
    get('poisonTooth'),
  ])
    for (const defense of [...eligible, ...ineligible])
      assert.equal(strongholdSnooper('carthag', weapon, defense), false);
  for (const effect of [null, 'arrakeen', 'habbanya_ridge_sietch'] as const)
    assert.equal(strongholdSnooper(effect, undefined, get('shield')), false);
});
void test('Carthag augments either combatant without replacing Shield, Tooth or Artillery behavior', () => {
  for (const [kind, dead] of [
    ['poison', false],
    ['poisonBlade', false],
    ['projectile', false],
    ['poisonTooth', true],
    ['artillery', false],
    ['lasgun', true],
  ] as const) {
    const weapon = get(kind),
      shield = get('shield');
    const left = strongholdBattleEffects(
      undefined,
      shield,
      weapon,
      undefined,
      true,
      true,
      'carthag',
      null,
    );
    const right = strongholdBattleEffects(
      weapon,
      undefined,
      undefined,
      shield,
      true,
      true,
      null,
      'carthag',
    );
    assert.equal(left.attackerDead, dead, kind);
    assert.equal(right.defenderDead, dead, kind);
    assert.equal(left.stunned, right.stunned);
  }
  assert.equal(
    battleWeaponsExplode(undefined, get('shield'), get('lasgun'), undefined),
    true,
  );
  const both = strongholdBattleEffects(
    get('artillery'),
    get('shield'),
    get('poison'),
    undefined,
    true,
    true,
    'carthag',
    null,
  );
  assert.equal(both.attackerDead, false);
  assert.equal(both.defenderDead, true);
  assert.equal(both.stunned, true);
  const tooth = strongholdBattleEffects(
    undefined,
    get('shield'),
    get('poisonTooth'),
    undefined,
    true,
    false,
    'carthag',
    null,
  );
  assert.equal(tooth.attackerDead, false);
});
void test('disabled module composition preserves ordinary results and does not mutate physical card records', () => {
  const before = structuredClone(cards);
  for (const weapon of [
    undefined,
    get('poison'),
    get('projectile'),
    get('chemistry'),
    get('poisonTooth'),
    get('artillery'),
  ])
    for (const defense of [
      undefined,
      get('shield'),
      get('snooper'),
      get('shieldSnooper'),
      get('chemistry'),
      portable,
    ]) {
      assert.deepEqual(
        strongholdBattleEffects(weapon, defense, undefined, get('shield')),
        battleCardEffects(weapon, defense, undefined, get('shield')),
      );
      strongholdBattleEffects(
        weapon,
        defense,
        get('poison'),
        get('shield'),
        true,
        true,
        'carthag',
        null,
      );
    }
  assert.deepEqual(cards, before);
});
