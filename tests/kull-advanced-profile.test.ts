import assert from 'node:assert/strict';
import test from 'node:test';
import { advancedKullLobbyEligible, advancedKullLobbyProfile } from '../game/kull-advanced-profile';
import { kullDefaultEligible, type KullDefaultProfile } from '../game/kull-default-profile';

const lobby: KullDefaultProfile = {
  status: 'lobby', advanced: true, expansions: ['choam', 'ix'],
  players: [{ faction: 'choam' }, { faction: 'atreides' }],
};

void test('Advanced printed Kull supports native CHOAM plus classic factions with the selected decks', () => {
  assert.deepEqual(advancedKullLobbyProfile(lobby), { eligible: true, reason: null });
  assert.equal(advancedKullLobbyEligible({ ...lobby, players: [{ faction: 'choam' }] }), true,
    'The host can see the preview before another seat joins; the start checks its minimum.');
  for (const faction of ['atreides', 'beneGesserit', 'emperor', 'fremen', 'guild', 'harkonnen'])
    assert.equal(advancedKullLobbyEligible({ ...lobby, players: [{ faction: 'choam' }, { faction }] }), true, faction);
  assert.equal(advancedKullLobbyEligible({ ...lobby, expansions: ['ix', 'choam'] }), true);
});

void test('Advanced profile excludes ongoing games, wrong rules, unsupported decks and native expansion seats', () => {
  for (const profile of [
    { ...lobby, status: 'playing' }, { ...lobby, status: 'setup' }, { ...lobby, advanced: false },
    { ...lobby, players: [{ faction: 'emperor' }, { faction: 'guild' }] },
    { ...lobby, expansions: ['choam'] }, { ...lobby, expansions: ['ix'] },
    { ...lobby, expansions: ['choam', 'ix', 'ecaz'] }, { ...lobby, expansions: ['choam', 'choam'] },
    { ...lobby, players: [] }, { ...lobby, players: [{ faction: 'choam' }, { faction: 'choam' }] },
    ...['richese', 'ixians', 'tleilaxu', 'ecaz', 'moritani', 'unknown'].map(faction =>
      ({ ...lobby, players: [{ faction: 'choam' }, { faction }] })),
    { ...lobby, players: ['choam', 'atreides', 'beneGesserit', 'emperor', 'fremen', 'guild', 'harkonnen']
      .map(faction => ({ faction })) },
  ]) {
    const result = advancedKullLobbyProfile(profile);
    assert.equal(result.eligible, false); assert.ok(result.reason);
  }
});

void test('Advanced lobby profile excludes all optional modules on source and public projection', () => {
  for (const option of [
    { lobbyOptions: { leaderSkills: true } }, { lobbyOptions: { ecazTreachery: true } },
    { lobbyModules: { leaderSkills: true } }, { lobbyModules: { ecazTreachery: true } },
    { lobbyModules: { nexusCards: true } }, { lobbyModules: { discoveries: true } },
    { leaderSkills: {} }, { ecazTreachery: true }, { nexusCards: {} }, { discoveryEnabled: true },
    { discoveries: {} }, { discoveryStash: {} }, { greatMaker: {} },
    { homeworlds: {} }, { techTokens: {} }, { strongholdCards: {} },
  ]) assert.equal(advancedKullLobbyEligible({ ...lobby, ...option }), false);
  assert.equal(advancedKullLobbyEligible({ ...lobby,
    lobbyModules: { leaderSkills: false, ecazTreachery: false, nexusCards: false, discoveries: false },
    lobbyOptions: { leaderSkills: false, ecazTreachery: false } }), true);
});

void test('Advanced eligibility does not alter Basic eligibility or depend on a host opt-out', () => {
  const basic = { ...lobby, advanced: false };
  const selection = { leaderSkills: false, kullOptOut: true };
  assert.equal(kullDefaultEligible(basic), true);
  assert.equal(advancedKullLobbyEligible(basic), false);
  assert.equal(advancedKullLobbyEligible({ ...lobby, lobbyOptions: selection }), true);
});

void test('Advanced eligibility reads only public faction/configuration and never private hands or spice', () => {
  const choam = { faction: 'choam', get hand() { throw Error('private hand read'); },
    get spice() { throw Error('private spice read'); } };
  const rival = { faction: 'beneGesserit', get hand() { throw Error('private rival hand read'); } };
  const game = { ...lobby, players: [choam, rival] };
  assert.equal(advancedKullLobbyEligible(game), true);
  assert.deepEqual(game.expansions, ['choam', 'ix']);
  assert.equal(game.status, 'lobby');
});
