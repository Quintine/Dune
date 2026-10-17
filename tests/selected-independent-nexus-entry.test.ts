import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedIndependentNexusProfile, nexusCoreProfile } from '../game/faction-module-profile';
import { createTechTokens } from '../game/tech-tokens';
import { createSelectedIndependentEntry, type SelectedIndependentEntryOptions } from './fixture-selected-independent-nexus-entry';

const entries: SelectedIndependentEntryOptions[] = [
  {expansions:['ix'], factions:['ixians','tleilaxu','atreides']},
  {expansions:['choam'], factions:['richese','choam','guild'], advanced:true, skills:true, homeworlds:true, tech:true, strongholds:true},
  {expansions:['ix','choam'], factions:['ixians','richese','harkonnen','atreides'], advanced:true, skills:true, homeworlds:true, tech:true, strongholds:true},
  {expansions:['ix','choam'], factions:['atreides','guild']},
  {expansions:['choam'], factions:['emperor','atreides'], advanced:true, homeworlds:true, strongholds:true},
  {expansions:['ix'], factions:['tleilaxu','guild'], homeworlds:true},
  {expansions:['ecaz'], factions:['ecaz','moritani']},
  {expansions:['ecaz'], factions:['moritani','harkonnen'], advanced:true},
  {expansions:['ecaz'], factions:['ecaz','moritani','guild'], advanced:true, skills:true, homeworlds:true, tech:true, strongholds:true},
  {expansions:['ecaz','ix','choam'], factions:['ecaz','moritani','ixians','tleilaxu','choam','richese'], advanced:true, skills:true, homeworlds:true, tech:true, strongholds:true},
  {expansions:['ecaz','ix','choam'], factions:['atreides','guild']},
  {expansions:['ecaz','choam'], factions:['ecaz','emperor'], advanced:true, skills:true, strongholds:true},
];
for (const options of entries) void test(`normal independent Nexus entry ${options.expansions.join('+')}/${options.factions.join('+')} retains selected components`, () => {
  const {lobby, setup, game} = createSelectedIndependentEntry(options);
  assert.equal(lobby.lobbyOptions?.ecazTreachery, true);
  assert.equal(lobby.nexusCards?.cards, null);
  assert.equal(game.ecazTreachery, true);
  assert.deepEqual(game.expansions, options.expansions);
  assert.equal(nexusCoreProfile(game), true);
  assert.equal(selectedIndependentNexusProfile(game), true);
  assert.equal(!!game.leaderSkills, !!options.skills);
  assert.equal(!!game.homeworlds, !!options.homeworlds);
  assert.equal(!!game.techTokens, !!options.tech);
  assert.equal(!!game.strongholdCards, !!options.strongholds);
  assert.equal(game.phase, 0);
  assert.equal(game.nexusCards!.cards!.deck.length, 12);
  assert.ok(Object.values(game.nexusCards!.cards!.hands).every(card => card === null));
  const ordinary = game.deck.length + game.discard.length + game.players.reduce((sum, player) => sum + player.hand.length, 0);
  assert.equal(ordinary, options.expansions.includes('ix') ? 50 : options.expansions.includes('choam') ? 38 : 36);
  assert.equal(game.richeseCache?.length ?? 0, options.factions.includes('richese') ? 10 : 0);
  assert.equal(!!game.nexusIxianReplacementPreview, !options.factions.includes('ixians'));
  assert.equal(!!game.nexusIxianBetrayalPreview, options.factions.includes('ixians'));
  assert.equal(!!game.nexusHarkonnenBetrayalPreview, options.factions.includes('harkonnen'));
  assert.equal(!!game.guildBetrayalPreview, options.factions.includes('guild'));
  assert.equal(!!game.ecazOccupyPreview, options.factions.includes('ecaz'));
  assert.equal(!!game.moritaniAssassinatePreview, !!options.advanced && options.factions.includes('moritani'));
  assert.equal(!!game.moritaniAssassinate, !!options.advanced && options.factions.includes('moritani'));
  if (options.skills) assert.ok(['skillTreachery','leaderSkills'].includes(setup.setupStage!),
    'The original Ixian starting-card choice may precede skill training');
  if (setup.techTokens) {
    assert.ok(Object.values(lobby.techTokens!).every(token => token.owner === null));
    assert.deepEqual(setup.techTokens, createTechTokens(setup.players),
      'Original setup assigns each seated native its printed Tech token; missing natives wait for Storm');
  }
  if (game.strongholdCards) assert.ok(Object.values(game.strongholdCards.owners).every(owner => owner === null));
});

void test('selected E3 core retains native assassination stamps and the existing trained capture boundary', () => {
  const native = {advanced:true, expansions:['ecaz'], players:[{faction:'moritani'},{faction:'harkonnen'}], nexusCards:true, ecazTreachery:true};
  assert.equal(selectedIndependentNexusProfile(native), true);
  assert.equal(selectedIndependentNexusProfile({...native, moritaniAssassinatePreview:true}), true);
  assert.equal(selectedIndependentNexusProfile({...native, leaderSkills:true}), false);
  assert.equal(selectedIndependentNexusProfile({...native, advanced:false, leaderSkills:true}), true);
  assert.equal(selectedIndependentNexusProfile({...native, advanced:false, moritaniAssassinatePreview:true}), false);
  assert.equal(selectedIndependentNexusProfile({...native, players:[{faction:'ecaz'},{faction:'emperor'}], moritaniAssassinatePreview:true}), false);
  assert.equal(selectedIndependentNexusProfile({...native, expansions:['ix']}), false);
  assert.equal(selectedIndependentNexusProfile({...native, expansions:['ecaz','ix','choam','ecaz']}), false);
  assert.equal(selectedIndependentNexusProfile({...native, expansions:['ecaz','sandtrout']}), false);
});

void test('selected core capability requires real independent cards and selected registered seats', () => {
  const base = {advanced:true, expansions:['ix'], players:[{faction:'ixians'},{faction:'atreides'}], nexusCards:true, ecazTreachery:true};
  assert.equal(selectedIndependentNexusProfile(base), true);
  for (const invalid of [
    {...base, ecazTreachery:false}, {...base, expansions:['ix','ix']},
    {...base, players:[{faction:'ixians'},{faction:'richese'}]},
    {...base, players:[{faction:'ixians'},{faction:'ixians'}]},
    {...base, techTokens:true}, {...base, advanced:false, strongholdCards:true},
    {...base, discoveryEnabled:true}, {...base, semutaPreview:true},
  ]) assert.equal(selectedIndependentNexusProfile(invalid), false);
});
