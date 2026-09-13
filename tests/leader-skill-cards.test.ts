import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEADER_SKILL_CARDS,
  leaderSkillCard,
  type LeaderSkillId,
} from '../game/leader-skill-cards';

const EXPECTED_IDS: readonly LeaderSkillId[] = [
  'bureaucrat',
  'spice-banker',
  'diplomat',
  'mentat',
  'suk-graduate',
  'rihani-decipherer',
  'sandmaster',
  'smuggler',
  'planetologist',
  'warmaster',
  'master-of-assassins',
  'swordmaster-of-ginaz',
  'killer-medic',
  'prana-bindu-adept',
];

void test('the canonical inventory has exactly fourteen unique physical identities', () => {
  assert.equal(LEADER_SKILL_CARDS.length, 14);
  assert.deepEqual(
    LEADER_SKILL_CARDS.map((card) => card.id),
    EXPECTED_IDS,
  );
  assert.equal(new Set(LEADER_SKILL_CARDS.map((card) => card.id)).size, 14);
  assert.equal(new Set(LEADER_SKILL_CARDS.map((card) => card.name)).size, 14);
  for (const card of LEADER_SKILL_CARDS) {
    assert.deepEqual(Object.keys(card), ['id', 'name', 'normal', 'battle']);
    assert.ok(card.normal.length > 0);
    assert.ok(card.battle.length > 0);
    assert.ok(card.normal.every((line) => line.length > 20));
    assert.ok(card.battle.every((line) => line.length > 20));
    assert.match(card.id, /^[a-z]+(?:-[a-z]+)*$/);
  }
});

void test('lookup is total for canonical IDs and rejects unknown runtime input', () => {
  for (const card of LEADER_SKILL_CARDS)
    assert.equal(leaderSkillCard(card.id), card);
  assert.throws(
    () => leaderSkillCard('not-a-physical-skill' as LeaderSkillId),
    /Unknown Leader Skill Card/,
  );
});

void test('the four weapon and defense disciplines preserve their distinct roles and values', () => {
  const roles = [
    ['master-of-assassins', 'Poison Weapon'],
    ['swordmaster-of-ginaz', 'Projectile Weapon'],
    ['killer-medic', 'Poison Defense'],
    ['prana-bindu-adept', 'Projectile Defense'],
  ] as const;
  for (const [id, role] of roles) {
    const card = leaderSkillCard(id);
    assert.match(card.normal.join(' '), new RegExp(`Add 1.*other.*${role}`));
    assert.match(card.battle.join(' '), new RegExp(`Add 3.*${role}`));
  }
});

void test('named economic, custody and information effects retain their source numbers', () => {
  assert.match(
    leaderSkillCard('bureaucrat').normal.join(' '),
    /per phase.*at least 5.*2.*Spice Bank/,
  );
  assert.match(
    leaderSkillCard('spice-banker').normal.join(' '),
    /per phase.*at least 4.*1 spice.*Mentat Pause/,
  );
  assert.match(
    leaderSkillCard('spice-banker').battle.join(' '),
    /1–3.*separate.*full strength/,
  );
  assert.match(
    leaderSkillCard('rihani-decipherer').battle.join(' '),
    /draw 2 Traitor Cards.*unused Traitor Card.*unkept drawn card/,
  );
  assert.match(
    leaderSkillCard('mentat').normal.join(' '),
    /may name a specific weapon.*privately show.*if held.*choose another Treachery Card/,
  );
  assert.match(
    leaderSkillCard('mentat').normal.join(' '),
    /stays in their hand.*need not be used in battle.*then move.*behind the shield/,
  );
});

void test('movement and battle-loss cards remain materially different', () => {
  assert.match(
    leaderSkillCard('planetologist').normal.join(' '),
    /capped at 3.*two different territories.*one destination/,
  );
  assert.match(
    leaderSkillCard('planetologist').battle.join(' '),
    /green Special.*other than a Cheap Hero.*add 2.*Discard/,
  );
  assert.match(
    leaderSkillCard('smuggler').normal.join(' '),
    /off-planet.*empty territory.*additional force.*free/,
  );
  assert.match(
    leaderSkillCard('sandmaster').normal.join(' '),
    /into or through.*1 spice.*once per territory/,
  );
  assert.match(
    leaderSkillCard('diplomat').battle.join(' '),
    /lose.*undialed forces.*empty adjacent.*not a stronghold/,
  );
  assert.match(
    leaderSkillCard('suk-graduate').normal.join(' '),
    /return 1.*reserves.*instead of the Tleilaxu Tanks/,
  );
  assert.match(
    leaderSkillCard('suk-graduate').battle.join(' '),
    /up to 3.*leave 1.*return the rest/,
  );
});

void test('Warmaster uses one Worthless card for either nonstacking band', () => {
  const warmaster = leaderSkillCard('warmaster');
  assert.match(warmaster.normal.join(' '), /Add 1.*other.*at least one/);
  assert.match(warmaster.battle.join(' '), /Add 3.*at least one/);
  assert.doesNotMatch(JSON.stringify(warmaster), /at least two|Add 4/);
});
