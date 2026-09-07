import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixBattleCards, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  battleCardEffects,
  battleWeaponsExplode,
  isWeaponCard,
  validBattleCardPair,
} from '../game/battle-cards';

const cards = [...baseDeck(), ...ixBattleCards(), ...richeseCards()];
const get = (kind: Card['kind']) => cards.find((card) => card.kind === kind)!;
const mirror = richeseCards().find((card) => card.effect === 'mirrorWeapon')!;
const portable = richeseCards().find(
  (card) => card.effect === 'portableSnooper',
)!;
const stone = richeseCards().find((card) => card.effect === 'stoneBurner')!;
const defenses = [
  undefined,
  get('shield'),
  get('snooper'),
  get('shieldSnooper'),
  get('weirdingWay'),
  get('chemistry'),
  portable,
];
// Independent printed defense matrix: undefended, shield, snooper, combined,
// defensive Weirding Way, defensive Chemistry, Portable Snooper.
const attacks: [Card['kind'], boolean[]][] = [
  ['projectile', [true, false, true, false, false, true, true]],
  ['poison', [true, true, false, false, true, false, false]],
  ['poisonBlade', [true, true, true, false, true, true, true]],
  ['weirdingWay', [true, false, true, false, false, true, true]],
  ['chemistry', [true, true, false, false, true, false, false]],
  ['lasgun', [true, true, true, true, true, true, true]],
];

void test('revealed ordinary and copied attacks use the printed defense matrix in either orientation', () => {
  for (const [kind, expected] of attacks) {
    const weapon = get(kind);
    for (const [index, defense] of defenses.entries()) {
      // Chemistry's original owner must supply its complementary defense.
      const originalDefense = kind === 'chemistry' ? get('shield') : undefined;
      const direct = battleCardEffects(
        weapon,
        originalDefense,
        undefined,
        defense,
      );
      assert.equal(direct.defenderDead, expected[index], `${kind}/${index}`);
      const copied = battleCardEffects(
        mirror,
        defense,
        weapon,
        originalDefense,
      );
      assert.equal(
        copied.attackerDead,
        expected[index],
        `original ${kind}/${index}`,
      );
      const reversed = battleCardEffects(
        weapon,
        originalDefense,
        mirror,
        defense,
      );
      assert.equal(
        reversed.defenderDead,
        expected[index],
        `reverse ${kind}/${index}`,
      );
      // The copy attacks the original owner; both attacks remain simultaneous.
      const originalDefenseIndex = kind === 'chemistry' ? 1 : 0;
      assert.equal(copied.defenderDead, expected[originalDefenseIndex]);
      assert.equal(reversed.attackerDead, expected[originalDefenseIndex]);
      assert.equal(copied.stunned, false);
      assert.equal(copied.noBounty, false);
    }
  }
});

void test('copied Poison Tooth activation belongs independently to each player and Chemistry protects either leader', () => {
  for (const mirroredAttacker of [true, false])
    for (const toothA of [false, true])
      for (const toothD of [false, true])
        for (const [index, defense] of defenses.entries()) {
          const effects = battleCardEffects(
            mirroredAttacker ? mirror : get('poisonTooth'),
            defense,
            mirroredAttacker ? get('poisonTooth') : mirror,
            get('chemistry'),
            toothA,
            toothD,
          );
          assert.equal(effects.attackerDead, (toothA || toothD) && index !== 5);
          assert.equal(effects.defenderDead, false);
          assert.equal(effects.stunned, false);
          assert.equal(effects.noBounty, false);
        }
});

void test('copied Artillery attacks both leaders and applies one battle-wide suppression without a bounty', () => {
  for (const mirroredAttacker of [true, false])
    for (const [aIndex, ad] of defenses.entries())
      for (const [dIndex, dd] of defenses.entries()) {
        const effects = battleCardEffects(
          mirroredAttacker ? mirror : get('artillery'),
          ad,
          mirroredAttacker ? get('artillery') : mirror,
          dd,
        );
        assert.deepEqual(effects, {
          attackerDead: aIndex !== 1 && aIndex !== 3,
          defenderDead: dIndex !== 1 && dIndex !== 3,
          stunned: true,
          noBounty: true,
        });
      }
});

void test('copied Lasgun uses the same explosion predicate and only actual shields trigger it', () => {
  for (const mirroredAttacker of [true, false])
    for (const [aIndex, ad] of defenses.entries())
      for (const [dIndex, dd] of defenses.entries())
        assert.equal(
          battleWeaponsExplode(
            mirroredAttacker ? mirror : get('lasgun'),
            ad,
            mirroredAttacker ? get('lasgun') : mirror,
            dd,
          ),
          [aIndex, dIndex].some((index) => index === 1 || index === 3),
        );
  assert.equal(battleWeaponsExplode(get('poison'), get('shield')), false);
  assert.equal(battleWeaponsExplode(get('lasgun'), get('shield')), true);
});

void test('empty and Worthless copies have no attack; Stone remains a separate post-reveal outcome', () => {
  for (const weapon of [undefined, get('worthless'), stone]) {
    const before = structuredClone([mirror, weapon]);
    assert.deepEqual(battleCardEffects(mirror, undefined, weapon), {
      attackerDead: false,
      defenderDead: false,
      stunned: false,
      noBounty: false,
    });
    assert.equal(battleWeaponsExplode(mirror, undefined, weapon), false);
    assert.deepEqual([mirror, weapon], before);
  }
});

void test('effective attack support does not activate Mirror plan admission or invent physical cleanup rules', () => {
  assert.equal(isWeaponCard(mirror), false);
  assert.equal(validBattleCardPair(mirror, get('weirdingWay')), false);
  assert.equal(mirror.id, 'richese-mirror-weapon');
  assert.equal(mirror.kind, 'special');
  assert.throws(() => battleCardEffects(mirror, undefined, mirror));
  assert.throws(() => battleWeaponsExplode(mirror, undefined, mirror));
});
