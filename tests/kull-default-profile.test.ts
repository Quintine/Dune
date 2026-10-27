import assert from 'node:assert/strict';
import test from 'node:test';
import { kullDefaultEligible, kullDefaultProfile, type KullDefaultProfile } from '../game/kull-default-profile';

const lobby: KullDefaultProfile = {
  status: 'lobby', advanced: false, expansions: ['choam', 'ix'],
  players: [{ faction: 'choam' }, { faction: 'atreides' }],
};

void test('fresh Basic CHOAM with the supported selected decks has native Kull', () => {
  assert.deepEqual(kullDefaultProfile(lobby), { eligible: true, reason: null });
  assert.equal(kullDefaultEligible(lobby), true);
  assert.equal(kullDefaultEligible({ ...lobby, players: [{ faction: 'choam' }] }), true,
    'show the choice before other seats join; the start enforces its own minimum');
  for (const faction of ['atreides', 'beneGesserit', 'emperor', 'fremen', 'guild', 'harkonnen',
    'ixians', 'tleilaxu', 'richese'])
    assert.equal(kullDefaultEligible({ ...lobby, players: [{ faction: 'choam' }, { faction }] }), true, faction);
  for (const faction of ['ecaz', 'moritani']) {
    assert.equal(kullDefaultEligible({ ...lobby, players: [{ faction: 'choam' }, { faction }] }), false, faction);
    assert.equal(kullDefaultEligible({ ...lobby, expansions: ['ix', 'choam', 'ecaz'],
      players: [{ faction: 'choam' }, { faction }] }), true, faction);
  }
});

void test('ongoing games, Advanced rules, absent CHOAM and unsupported deck selections do not qualify', () => {
  for (const profile of [
    { ...lobby, status: 'playing' }, { ...lobby, status: 'setup' }, { ...lobby, advanced: true },
    { ...lobby, players: [{ faction: 'richese' }, { faction: 'atreides' }] },
    { ...lobby, expansions: ['choam'] }, { ...lobby, expansions: ['ix'] },
    { ...lobby, expansions: ['choam', 'ix', 'unknown'] },
    { ...lobby, expansions: ['choam', 'ix', 'ix'] },
    { ...lobby, players: [{ faction: 'choam' }, { faction: 'unknown' }] },
    { ...lobby, players: [] },
    { ...lobby, players: [{ faction: 'choam' }, { faction: 'choam' }] },
    { ...lobby, players: ['choam', 'atreides', 'fremen', 'guild', 'emperor', 'harkonnen', 'ixians']
      .map(faction => ({ faction })) },
  ]) {
    const result = kullDefaultProfile(profile);
    assert.equal(result.eligible, false); assert.ok(result.reason);
  }
});

void test('each optional module blocks automatic entry from both engine and public lobby shapes', () => {
  for (const option of [
    { lobbyOptions: { leaderSkills: true } }, { lobbyOptions: { ecazTreachery: true } },
    { lobbyModules: { leaderSkills: true } }, { lobbyModules: { ecazTreachery: true } },
    { lobbyModules: { nexusCards: true } }, { lobbyModules: { discoveries: true } },
    { leaderSkills: {} }, { ecazTreachery: true }, { nexusCards: {} }, { discoveryEnabled: true },
    { discoveries: {} }, { discoveryStash: {} }, { greatMaker: {} },
    { homeworlds: {} }, { techTokens: {} }, { strongholdCards: {} },
  ]) {
    assert.equal(kullDefaultEligible({ ...lobby, ...option }), false);
  }
  assert.equal(kullDefaultEligible({ ...lobby,
    lobbyModules: { leaderSkills: false, ecazTreachery: false, nexusCards: false, discoveries: false },
    lobbyOptions: { leaderSkills: false, ecazTreachery: false } }), true);
});

void test('public eligibility does not change when the host chooses an opt-out', () => {
  // The profile quote only needs to understand module prerequisites, not the
  // key representing the host's choice. The caller interprets that choice.
  const selection = { leaderSkills: false, kullDisabled: true };
  const selectedOn = { ...selection, kullDisabled: false };
  assert.equal(kullDefaultEligible({ ...lobby, lobbyOptions: selection }), true);
  assert.equal(kullDefaultEligible({ ...lobby, lobbyOptions: selectedOn }), true);
});

void test('profile reads only public faction and configuration data, never hidden hands or spice', () => {
  const player = { faction: 'choam', get hand() { throw Error('private hand read'); },
    get spice() { throw Error('private spice read'); } };
  const rival = { faction: 'ixians', get hand() { throw Error('private rival hand read'); } };
  const profile = { ...lobby, players: [player, rival] };
  assert.equal(kullDefaultEligible(profile), true);
  assert.deepEqual(profile.expansions, ['choam', 'ix']);
  assert.equal(profile.status, 'lobby');
});
