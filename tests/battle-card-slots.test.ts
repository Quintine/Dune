import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import {
  battleCardSlotEligible,
  battleCategoryInspectionValue,
  fixedBattleInspectionMatches,
  validBattleSlotPair,
} from '../game/battle-card-slots';

const ecaz = Object.fromEntries(ecazTreacheryCards().map((card) => [card.effect, card]));
const base = baseDeck();
const projectile = base.find((card) => card.kind === 'projectile')!;
const shield = base.find((card) => card.kind === 'shield')!;
const worthless = base.find((card) => card.kind === 'worthless')!;
const hajr = base.find((card) => card.effect === 'hajr')!;

void test('slot specials preserve single-card custody and alternate-role category requirements', () => {
  const cards = treacheryDeck(['ix']);
  const chemistry = cards.find((card) => card.kind === 'chemistry')!;
  const weirding = cards.find((card) => card.kind === 'weirdingWay')!;
  assert.equal(validBattleSlotPair(ecaz.harassWithdraw, shield), true);
  assert.equal(validBattleSlotPair(projectile, ecaz.harassWithdraw), true);
  assert.equal(validBattleSlotPair(ecaz.harassWithdraw, ecaz.harassWithdraw), false);
  assert.equal(validBattleSlotPair(ecaz.recruits, shield), false);
  assert.equal(validBattleSlotPair(ecaz.harassWithdraw, weirding), false);
  assert.equal(validBattleSlotPair(chemistry, ecaz.harassWithdraw), false);
  assert.equal(validBattleSlotPair(weirding, ecaz.harassWithdraw), true);
  assert.equal(validBattleSlotPair(ecaz.harassWithdraw, chemistry), true);
  assert.equal(validBattleSlotPair(chemistry, weirding), true);
  assert.equal(validBattleSlotPair(hajr, shield, true), true);
  assert.equal(validBattleSlotPair(hajr, weirding, true), false);
});

void test('only the two exact canonical Ecaz battle specials occupy either slot', () => {
  for (const effect of ['reinforcements', 'harassWithdraw'] as const) {
    assert.equal(battleCardSlotEligible('weapon', ecaz[effect]), true);
    assert.equal(battleCardSlotEligible('defense', ecaz[effect]), true);
  }
  for (const forged of [
    ecaz.recruits,
    { ...ecaz.reinforcements, name: 'Forged Reinforcements' },
    { ...ecaz.harassWithdraw, extra: true },
    { ...ecaz.reinforcements, id: 'similar-reinforcements' },
  ]) {
    assert.equal(battleCardSlotEligible('weapon', forged), false);
    assert.equal(battleCardSlotEligible('defense', forged), false);
  }
});

void test('ordinary categories and externally validated Planetologist substitution remain unchanged', () => {
  assert.equal(battleCardSlotEligible('weapon', undefined), true);
  assert.equal(battleCardSlotEligible('defense', undefined), true);
  assert.equal(battleCardSlotEligible('weapon', projectile), true);
  assert.equal(battleCardSlotEligible('defense', projectile), false);
  assert.equal(battleCardSlotEligible('weapon', shield), false);
  assert.equal(battleCardSlotEligible('defense', shield), true);
  assert.equal(battleCardSlotEligible('weapon', worthless), true);
  assert.equal(battleCardSlotEligible('defense', worthless), true);
  assert.equal(battleCardSlotEligible('weapon', hajr), false);
  assert.equal(battleCardSlotEligible('weapon', hajr, { planetologistWeapon: true }), true);
  assert.equal(battleCardSlotEligible('defense', hajr, { planetologistWeapon: true }), false);
});

void test('category inspection hides Ecaz slot occupants without changing existing Planetologist or ordinary answers', () => {
  assert.equal(
    battleCategoryInspectionValue('weapon', ecaz.reinforcements.id, ecaz.reinforcements),
    null,
  );
  assert.equal(
    battleCategoryInspectionValue('defense', ecaz.harassWithdraw.id, ecaz.harassWithdraw),
    null,
  );
  assert.equal(battleCategoryInspectionValue('weapon', hajr.id, hajr), hajr.id);
  assert.equal(battleCategoryInspectionValue('defense', worthless.id, worthless), worthless.id);
  assert.equal(battleCategoryInspectionValue('weapon', projectile.id, projectile), projectile.id);
  assert.equal(battleCategoryInspectionValue('weapon', ecaz.recruits.id, ecaz.recruits), ecaz.recruits.id);
});

void test('non-card fields, empty slots and unfinished partial values preserve their exact shape', () => {
  assert.equal(battleCategoryInspectionValue('dial', 2.5), 2.5);
  assert.equal(battleCategoryInspectionValue('leader', 'atreides-0'), 'atreides-0');
  assert.equal(battleCategoryInspectionValue('weapon', null), null);
  assert.equal(battleCategoryInspectionValue('defense', undefined), undefined);
  assert.throws(
    () => battleCategoryInspectionValue('weapon', projectile.id, shield),
    /does not match/,
  );
});

void test('fixed category comparisons keep partial search open and compare resolved category values', () => {
  assert.equal(fixedBattleInspectionMatches('weapon', null, undefined), true);
  assert.equal(
    fixedBattleInspectionMatches('weapon', null, ecaz.reinforcements.id, ecaz.reinforcements),
    true,
  );
  assert.equal(fixedBattleInspectionMatches('weapon', null, projectile.id, projectile), false);
  assert.equal(
    fixedBattleInspectionMatches('defense', worthless.id, worthless.id, worthless),
    true,
  );
  assert.equal(fixedBattleInspectionMatches('dial', 3.5, 3.5), true);
  assert.equal(fixedBattleInspectionMatches('leader', 'atreides-0', null), false);
});
