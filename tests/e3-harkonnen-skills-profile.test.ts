import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advancedMoritaniLeaderSkillsProfile,
  homeworldLeaderSkillsProfile,
  independentTreacheryLeaderSkillsProfile,
  nativeEcazLeaderSkillsProfile,
  nativeExpansionLeaderSkillsProfile,
  nativeTechLeaderSkillsProfile,
  ordinaryLeaderSkillModeSupported,
  selectedDeckLeaderSkillsProfile,
  type LeaderSkillProfile,
} from '../game/leader-skill-profile';

function profile(factions: readonly string[], extra: Partial<LeaderSkillProfile> = {}): LeaderSkillProfile {
  return { advanced: true, expansions: ['ecaz'], players: factions.map(faction => ({ faction })), ...extra };
}
const classics = ['atreides', 'emperor', 'guild', 'fremen'] as const;

void test('bare Advanced Harkonnen and either native E3 faction admit ordinary all14 at two through six seats', () => {
  for (const native of ['ecaz', 'moritani'] as const) {
    for (let count = 2; count <= 6; count++) {
      for (const spiceBankerIncomePreview of [undefined, true]) {
        const game = profile(['harkonnen', native, ...classics.slice(0, count - 2)], { spiceBankerIncomePreview });
        const before = structuredClone(game);
        Object.freeze(game.players);
        Object.freeze(game);
        assert.equal(selectedDeckLeaderSkillsProfile(game), true, `${native}/${count}`);
        assert.equal(nativeExpansionLeaderSkillsProfile(game), true);
        assert.equal(ordinaryLeaderSkillModeSupported(game), true);
        assert.equal(native === 'ecaz' ? nativeEcazLeaderSkillsProfile(game) : advancedMoritaniLeaderSkillsProfile(game), true);
        assert.deepEqual(game, before);
      }
    }
  }
});

void test('both E3 natives share the same bare Harkonnen admission and native Moritani state', () => {
  for (let count = 3; count <= 6; count++) {
    for (const moritaniAssassinatePreview of [undefined, true]) {
      const game = profile(['harkonnen', 'ecaz', 'moritani', ...classics.slice(0, count - 3)], {
        moritaniAssassinatePreview, spiceBankerIncomePreview: true,
      });
      assert.equal(selectedDeckLeaderSkillsProfile(game), true);
      assert.equal(nativeEcazLeaderSkillsProfile(game), true);
      assert.equal(advancedMoritaniLeaderSkillsProfile(game), true);
      assert.equal(ordinaryLeaderSkillModeSupported(game), true);
    }
  }
  assert.equal(selectedDeckLeaderSkillsProfile(profile(['harkonnen', 'ecaz'], { moritaniAssassinatePreview: true })), false);
  assert.equal(selectedDeckLeaderSkillsProfile(profile(['harkonnen', 'moritani'], { moritaniAssassinatePreview: true })), true);
});

void test('the new capture envelope does not admit optional modules or unrelated effect previews', () => {
  const base = profile(['harkonnen', 'ecaz', 'moritani']);
  for (const field of [
    'homeworlds', 'nexusCards', 'discoveries', 'discoveryEnabled', 'discoveryStash', 'greatMaker',
    'ecazTreachery', 'techTokens', 'strongholdCards', 'semutaPreview', 'advancedPreview',
    'kullPreview', 'nexusKullPreview', 'guildBetrayalPreview', 'richeseBetrayalPreview',
    'nexusIxianReplacementPreview', 'nexusIxianBetrayalPreview', 'nexusHarkonnenBetrayalPreview',
  ] as const) {
    const game = { ...base, [field]: true };
    assert.equal(selectedDeckLeaderSkillsProfile(game), false, field);
    assert.equal(nativeExpansionLeaderSkillsProfile(game), false, field);
    assert.equal(ordinaryLeaderSkillModeSupported(game), false, field);
  }
  assert.equal(homeworldLeaderSkillsProfile({ ...base, homeworlds: true }), false);
  assert.equal(nativeTechLeaderSkillsProfile({ ...base, techTokens: true }), false);
  assert.equal(independentTreacheryLeaderSkillsProfile({ ...base, ecazTreachery: true }), false);
});

void test('capture admission keeps the sole selected E3 deck and registered distinct two-to-six seat boundary', () => {
  const base = profile(['harkonnen', 'ecaz']);
  for (const expansions of [[], ['ix'], ['choam'], ['ecaz', 'ix'], ['ecaz', 'choam'], ['ecaz', 'ecaz'], ['unknown']]) {
    assert.equal(selectedDeckLeaderSkillsProfile({ ...base, expansions }), false, JSON.stringify(expansions));
  }
  for (const factions of [
    ['harkonnen'],
    ['harkonnen', 'ecaz', 'moritani', ...classics],
    ['harkonnen', 'ecaz', 'ecaz'],
    ['harkonnen', 'ecaz', 'ixians'],
    ['harkonnen', 'moritani', 'richese'],
    ['harkonnen', 'ecaz', 'unknown'],
  ]) assert.equal(selectedDeckLeaderSkillsProfile(profile(factions)), false, factions.join('/'));
  assert.equal(selectedDeckLeaderSkillsProfile({ ...base, players: undefined }), false);
  assert.equal(selectedDeckLeaderSkillsProfile({ ...base, advanced: undefined }), false);
});

void test('Basic native Harkonnen Skills and existing module admission remain unchanged', () => {
  for (const natives of [['ecaz'], ['moritani'], ['ecaz', 'moritani']]) {
    const game = profile(['harkonnen', ...natives, 'atreides'], { advanced: false });
    assert.equal(selectedDeckLeaderSkillsProfile(game), true);
    assert.equal(nativeExpansionLeaderSkillsProfile(game), true);
    assert.equal(ordinaryLeaderSkillModeSupported(game), true);
    assert.equal(selectedDeckLeaderSkillsProfile({ ...game, homeworlds: true }), true);
    assert.equal(selectedDeckLeaderSkillsProfile({ ...game, techTokens: true }), true);
    assert.equal(selectedDeckLeaderSkillsProfile({ ...game, moritaniAssassinatePreview: true }), false);
  }
});
