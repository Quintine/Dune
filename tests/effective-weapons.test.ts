import test from 'node:test';
import assert from 'node:assert/strict';
import {
  baseDeck,
  ixBattleCards,
  ixStandardCards,
  type Card,
} from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import {
  resolveBattleWeapons,
  type BattleWeaponSide,
  type EffectiveBattleWeapon,
} from '../game/effective-weapons';
const mirror = richeseCards().find((c) => c.effect === 'mirrorWeapon')!;
const stone = richeseCards().find((c) => c.effect === 'stoneBurner')!;
const portable = richeseCards().find((c) => c.effect === 'portableSnooper')!;
const cards = [...baseDeck(), ...ixBattleCards(), ...ixStandardCards()];
const card = (kind: Card['kind']) => cards.find((c) => c.kind === kind)!;
const sides = ['attacker', 'defender'] as const;
function copied(
  side: BattleWeaponSide,
  weapon?: Card,
  defense?: Card,
  mirrorDefense?: Card,
) {
  const other: BattleWeaponSide = side === 'attacker' ? 'defender' : 'attacker';
  const input = {
    [side]: { weapon: mirror, defense: mirrorDefense },
    [other]: { weapon, defense },
  } as Parameters<typeof resolveBattleWeapons>[0];
  const snapshot = structuredClone(input);
  const result = resolveBattleWeapons(input);
  assert.deepEqual(input, snapshot);
  assert.equal(result.error, null);
  assert.equal(result[side].physicalId, mirror.id);
  assert.equal(result[other].physicalId, weapon?.id ?? null);
  return { result, other };
}

void test('Mirror copies every ordinary and Ix actual weapon kind in both orientations without changing physical identity', () => {
  const weapons = cards.filter((c) =>
    [
      'projectile',
      'poison',
      'lasgun',
      'poisonBlade',
      'poisonTooth',
      'artillery',
      'weirdingWay',
      'chemistry',
    ].includes(c.kind),
  );
  for (const side of sides)
    for (const weapon of weapons) {
      const { result, other } = copied(
        side,
        weapon,
        weapon.kind === 'chemistry' ? card('shield') : undefined,
      );
      assert.deepEqual(result[side], {
        physicalId: mirror.id,
        copiedFrom: weapon.id,
        kind: weapon.kind,
        choice: weapon.kind === 'poisonTooth' ? 'poisonTooth' : null,
      });
      assert.equal(result[other].kind, weapon.kind);
      assert.equal(result[other].copiedFrom, null);
    }
});

void test('Stone Burner and Poison Tooth copies require separate choices before the original owner in both orientations', () => {
  for (const side of sides)
    for (const weapon of [stone, card('poisonTooth')]) {
      const kind = weapon === stone ? 'stoneBurner' : 'poisonTooth';
      const { result, other } = copied(side, weapon);
      assert.deepEqual(result.choiceOrder, [
        { side, kind },
        { side: other, kind },
      ]);
      assert.equal(result[side].choice, kind);
      assert.equal(result[other].choice, kind);
      assert.equal(result[side].kind, kind);
      assert.notEqual(result[side], result[other]);
      result[side].choice = null;
      assert.equal(result[other].choice, kind);
    }
});

void test('ordinary choices retain input order when no copy dependency exists and Artillery adds no choice', () => {
  const tooth = card('poisonTooth');
  for (const [attacker, defender] of [
    [tooth, stone],
    [stone, tooth],
    [tooth, { ...tooth, id: 'second-tooth' }],
  ] as const) {
    const r = resolveBattleWeapons({
      attacker: { weapon: attacker },
      defender: { weapon: defender },
    });
    assert.deepEqual(r.choiceOrder, [
      {
        side: 'attacker',
        kind: attacker === stone ? 'stoneBurner' : 'poisonTooth',
      },
      {
        side: 'defender',
        kind: defender === stone ? 'stoneBurner' : 'poisonTooth',
      },
    ]);
  }
  for (const side of sides)
    assert.deepEqual(copied(side, card('artillery')).result.choiceOrder, []);
});

void test('empty slots, Worthless and Ecaz stand-ins yield no copied attack and no choice', () => {
  const nonWeapons: (Card | undefined)[] = [
    undefined,
    card('worthless'),
    card('shield'),
    card('snooper'),
    card('hero'),
    portable,
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
    { id: 'unknown-special', name: 'Other', kind: 'special', effect: 'weapon' },
  ];
  for (const side of sides)
    for (const weapon of nonWeapons) {
      const { result, other } = copied(side, weapon);
      assert.deepEqual(result[side], {
        physicalId: mirror.id,
        copiedFrom: null,
        kind: null,
        choice: null,
      });
      assert.equal(result[other].kind, null);
      assert.deepEqual(result.choiceOrder, []);
    }
});

void test('only the selected weapon slot is copied, including Chemistry and Weirding Way defense pairings', () => {
  for (const side of sides)
    for (const defense of [
      card('chemistry'),
      card('weirdingWay'),
      portable,
      stone,
    ]) {
      const weapon = card('projectile');
      const { result } = copied(side, weapon, defense);
      assert.equal(result[side].kind, 'projectile');
      assert.equal(result[side].copiedFrom, weapon.id);
      assert.equal(copied(side, undefined, defense).result[side].kind, null);
    }
});

void test('original Chemistry needs its selected defense but copied Chemistry never needs a defense on Mirror', () => {
  for (const side of sides) {
    assert.equal(copied(side, card('chemistry')).result[side].kind, null);
    assert.equal(
      copied(side, card('chemistry'), card('chemistry')).result[side].kind,
      null,
    );
    assert.equal(
      copied(side, card('chemistry'), card('projectile')).result[side].kind,
      null,
    );
    for (const defense of [
      card('shield'),
      card('worthless'),
      card('weirdingWay'),
      portable,
    ]) {
      assert.equal(
        copied(side, card('chemistry'), defense).result[side].kind,
        'chemistry',
      );
      assert.equal(
        copied(side, card('chemistry'), defense, card('weirdingWay')).result[
          side
        ].kind,
        'chemistry',
      );
    }
  }
});

void test('duplicated Mirror custody is rejected without recursively copying or creating choices', () => {
  for (const input of [
    { attacker: { weapon: mirror }, defender: { weapon: { ...mirror } } },
    {
      attacker: { weapon: mirror, defense: { ...mirror } },
      defender: { weapon: stone },
    },
    { attacker: { defense: mirror }, defender: { weapon: { ...mirror } } },
  ]) {
    const snapshot = structuredClone(input),
      r = resolveBattleWeapons(input);
    assert.match(r.error!, /duplicated custody/);
    assert.equal(r.attacker.kind, null);
    assert.equal(r.defender.kind, null);
    assert.deepEqual(r.choiceOrder, []);
    assert.deepEqual(input, snapshot);
  }
});

void test('forged Mirror IDs, names, kinds or effects cannot acquire a copy or ordinary attack', () => {
  const forgeries: Card[] = [
    { ...mirror, id: 'forged' },
    { ...mirror, name: 'Not Mirror' },
    { ...mirror, kind: 'projectile' },
    { ...mirror, effect: undefined },
    { id: 'base-fake', name: 'Mirror Weapon', kind: 'special' },
    { id: 'base-fake', name: 'Other', kind: 'special', effect: 'mirrorWeapon' },
  ];
  for (const side of sides)
    for (const forged of forgeries)
      for (const slot of ['weapon', 'defense'] as const) {
        const other: BattleWeaponSide =
          side === 'attacker' ? 'defender' : 'attacker';
        const input = {
          [side]: { [slot]: forged },
          [other]: { weapon: stone },
        } as Parameters<typeof resolveBattleWeapons>[0];
        const snapshot = structuredClone(input),
          r = resolveBattleWeapons(input);
        assert.match(r.error!, /canonical physical identity/);
        assert.deepEqual(r.choiceOrder, []);
        assert.equal(r.attacker.kind, null);
        assert.equal(r.defender.kind, null);
        assert.deepEqual(input, snapshot);
      }
});

void test('only canonical Stone Burner creates its effective kind and malformed Richese identities gain no attack', () => {
  for (const side of sides)
    for (const forged of [
      { ...stone, id: 'forged' },
      { ...stone, name: 'Other' },
      { ...stone, effect: 'other' },
      { ...stone, kind: 'projectile' as const },
      { ...portable, kind: 'poison' as const },
    ]) {
      const { result, other } = copied(side, forged);
      assert.equal(result[side].kind, null);
      assert.equal(result[other].kind, null);
      assert.deepEqual(result.choiceOrder, []);
    }
});

void test('resolution accepts frozen physical inputs and returned descriptors never alias them', () => {
  const a = Object.freeze({ ...mirror }),
    d = Object.freeze({ ...stone });
  const input = Object.freeze({
    attacker: Object.freeze({ weapon: a }),
    defender: Object.freeze({ weapon: d }),
  });
  const r = resolveBattleWeapons(input);
  assert.equal(r.error, null);
  r.attacker.kind = 'projectile';
  r.defender.physicalId = 'changed-output';
  assert.equal(a.kind, 'special');
  assert.equal(d.id, stone.id);
  const blank: EffectiveBattleWeapon = {
    physicalId: null,
    copiedFrom: null,
    kind: null,
    choice: null,
  };
  assert.deepEqual(resolveBattleWeapons({ attacker: {}, defender: {} }), {
    attacker: blank,
    defender: blank,
    choiceOrder: [],
    error: null,
  });
});
