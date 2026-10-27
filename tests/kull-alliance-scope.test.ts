import assert from 'node:assert/strict';
import test from 'node:test';
import { alliancePromiseModeSupported as supported } from '../game/alliance-promises';

const basic = { advanced: false, expansions: ['choam', 'ix'],
  players: [{ faction: 'choam' }, { faction: 'emperor' }, { faction: 'guild' }], kullPreview: true };

void test('printed Kull admission reuses the supported Basic CHOAM envelope', () => {
  assert.equal(supported(basic), true);
  assert.equal(supported({ ...basic, players: [...basic.players, { faction: 'ixians' }] }), true);
  assert.equal(supported({ ...basic, players: [...basic.players, { faction: 'tleilaxu' }] }), true);
  assert.equal(supported({ ...basic, expansions: ['choam', 'ix', 'ecaz'],
    players: [...basic.players, { faction: 'moritani' }] }), true);
  assert.equal(supported({ ...basic, advanced: true }), false);
  assert.equal(supported({ ...basic, expansions: ['choam'] }), false);
  assert.equal(supported({ ...basic, players: [{ faction: 'emperor' }, { faction: 'guild' }] }), false);
  assert.equal(supported({ ...basic, players: [...basic.players, { faction: 'guild' }] }), false);
  assert.equal(supported({ ...basic, kullPreview: false }), true);
  for (const flag of ['semutaPreview', 'nexusKullPreview', 'richeseBetrayalPreview',
    'guildBetrayalPreview', 'nexusIxianReplacementPreview', 'nexusIxianBetrayalPreview',
    'nexusHarkonnenBetrayalPreview', 'moritaniAssassinatePreview', 'nexusCards', 'homeworlds',
    'leaderSkills', 'techTokens', 'strongholdCards', 'discoveryEnabled', 'ecazTreachery']) {
    assert.equal(supported({ ...basic, [flag]: true }), false, flag);
  }
});
