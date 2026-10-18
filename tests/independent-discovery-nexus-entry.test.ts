import test from 'node:test';
import assert from 'node:assert/strict';
import { spiceDeck } from '../game/cards';
import { DISCOVERY_SPICE_CARDS, validateDiscoveryState } from '../game/discoveries';
import { ECAZ_TREACHERY_DEFINITIONS } from '../game/ecaz-cards';
import { independentDiscoveryProfile, independentDiscoveryNexusProfile, independentNexusProfile, nexusCoreProfile } from '../game/faction-module-profile';
import { createTechTokens } from '../game/tech-tokens';
import { createSelectedIndependentEntry, type SelectedIndependentEntryOptions } from './fixture-selected-independent-nexus-entry';

const entries: SelectedIndependentEntryOptions[] = [
  { expansions: [], factions: ['atreides', 'guild'] },
  { expansions: ['ix'], factions: ['ixians', 'tleilaxu'] },
  { expansions: ['choam'], factions: ['choam', 'richese', 'guild'], advanced: true,
    skills: true, homeworlds: true, tech: true, strongholds: true },
  { expansions: ['ecaz'], factions: ['ecaz', 'moritani'] },
  { expansions: ['ecaz', 'ix', 'choam'], factions: ['ecaz', 'moritani', 'ixians', 'tleilaxu', 'choam', 'richese'],
    advanced: true, skills: true, homeworlds: true, tech: true, strongholds: true },
  { expansions: ['ix', 'choam', 'ecaz'], factions: ['emperor', 'atreides'],
    advanced: true, skills: true, strongholds: true },
];

for (const options of [entries[0], entries[4]]) void test(
  `normal independent Discovery keeps Nexus optional for ${options.expansions.join('+') || 'classic'}`,
  () => {
    const { game, actions } = createSelectedIndependentEntry({ ...options, discoveries: true, nexus: false });
    assert.ok(independentDiscoveryProfile(game));
    assert.equal(independentDiscoveryNexusProfile(game), false);
    assert.equal(nexusCoreProfile(game), false);
    assert.equal(game.nexusCards, undefined);
    assert.ok(game.discoveries);
    validateDiscoveryState(game.discoveries);
    assert.equal(game.discoveries.tokens.length, 8);
    assert.ok(!actions.some(step => step.action.type === 'moduleOption' && step.action.module === 'nexusCards'));
    assert.equal(game.nexusIxianReplacementPreview, undefined);
    assert.equal(game.nexusIxianBetrayalPreview, undefined);
    assert.equal(game.guildBetrayalPreview, undefined);
    assert.equal(!!game.leaderSkills, !!options.skills);
    assert.equal(!!game.homeworlds, !!options.homeworlds);
  },
);

for (const options of entries) void test(
  `normal ${options.advanced ? 'Advanced' : 'Basic'} independent Discovery Nexus setup ${options.expansions.join('+') || 'classic'}/${options.factions.join('+')}`,
  () => {
    const { lobby, setup, game, actions } = createSelectedIndependentEntry({ ...options, discoveries: true });
    assert.ok(actions.some(step => step.actor === lobby.host && step.action.type === 'moduleOption' &&
      step.action.module === 'discoveries' && step.action.enabled === true));
    assert.equal(lobby.discoveryEnabled, true);
    assert.equal(lobby.lobbyOptions?.ecazTreachery, true);
    assert.equal(lobby.discoveries, undefined, 'The host selects a module before any token is dealt.');
    assert.equal(game.discoveryEnabled, true);
    assert.equal(game.ecazTreachery, true);
    assert.equal(independentDiscoveryNexusProfile(setup), true);
    assert.equal(independentDiscoveryNexusProfile(game), true);
    assert.equal(independentNexusProfile(game), true);
    assert.equal(nexusCoreProfile(game), true);
    assert.deepEqual(game.expansions, options.expansions);
    assert.equal(game.status, 'playing');
    assert.equal(game.phase, 0);
    assert.equal(!!game.homeworlds, !!options.homeworlds);
    assert.equal(!!game.leaderSkills, !!options.skills);
    assert.equal(!!game.techTokens, !!options.tech);
    assert.equal(!!game.strongholdCards, !!options.strongholds);

    const ordinary = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)];
    assert.equal(ordinary.length, options.expansions.includes('ix') ? 50 : options.expansions.includes('choam') ? 38 : 36);
    for (const definition of ECAZ_TREACHERY_DEFINITIONS)
      assert.equal(ordinary.filter(card => card.id === definition.card.id).length, 1,
        `${definition.card.name} remains one real selected independent card.`);
    assert.equal(game.richeseCache?.length ?? 0, options.factions.includes('richese') ? 10 : 0);
    assert.equal(game.nexusCards!.cards!.deck.length, 12);
    assert.equal(game.nexusCards!.cards!.discard.length, 0);
    assert.ok(Object.values(game.nexusCards!.cards!.hands).every(card => card === null),
      'Fresh module setup does not invent a qualifying closing Nexus draw.');

    assert.ok(game.discoveries);
    validateDiscoveryState(game.discoveries);
    assert.equal(game.discoveries.tokens.length, 8);
    assert.ok(game.discoveries.tokens.every(token => token.status === 'supply' &&
      token.territory === null && token.sector === null && token.revealedTurn === null));
    assert.deepEqual(game.discoveries.newlyRevealed, []);
    assert.equal(game.spiceDeck.length, spiceDeck(options.expansions.includes('ix')).length + 7);
    assert.deepEqual(game.spiceDeck.flatMap(card => 'territory' in card && card.discovery ? [card.discovery] : []).sort(),
      DISCOVERY_SPICE_CARDS.map(card => card.discovery).sort());
    assert.equal(game.spiceDeck.filter(card => 'worm' in card && card.greatMaker).length, 1);
    assert.equal(game.spiceDeck.filter(card => 'sandtrout' in card).length, options.expansions.includes('ix') ? 1 : 0);
    assert.equal(game.greatMaker, undefined, 'No appearance occurs during fresh Storm setup.');

    assert.equal(!!game.nexusIxianBetrayalPreview, options.factions.includes('ixians'));
    assert.equal(!!game.nexusIxianReplacementPreview, !options.factions.includes('ixians'));
    assert.equal(!!game.ecazOccupyPreview, options.factions.includes('ecaz'));
    assert.equal(!!game.moritaniAssassinate, !!options.advanced && options.factions.includes('moritani'));
    if (options.factions.includes('richese'))
      assert.equal(game.players.find(player => player.faction === 'richese')!.noField!.tokens.length, 3);
    if (options.factions.includes('tleilaxu'))
      assert.ok(game.players.find(player => player.faction === 'tleilaxu')!.faceDancers?.length,
        'The original Tleilaxu private setup remains connected.');
    if (options.skills) assert.ok(['skillTreachery', 'leaderSkills'].includes(setup.setupStage!));
    if (setup.techTokens) assert.deepEqual(setup.techTokens, createTechTokens(setup.players));
    if (game.strongholdCards) assert.ok(Object.values(game.strongholdCards.owners).every(owner => owner === null));
  },
);

void test('independent Discovery capability requires explicit cards, Discovery, Nexus and registered selected seats', () => {
  const base = { advanced: true, expansions: [], players: [{ faction: 'atreides' }, { faction: 'guild' }],
    ecazTreachery: true, discoveryEnabled: true, nexusCards: true };
  assert.equal(independentDiscoveryNexusProfile(base), true);
  const invalid = [
    { ...base, ecazTreachery: false }, { ...base, discoveryEnabled: false },
    { ...base, discoveryEnabled: undefined, discoveries: {} }, { ...base, nexusCards: false },
    { ...base, expansions: ['ix', 'ix'] }, { ...base, expansions: ['ecaz', 'ix', 'choam', 'ecaz'] },
    { ...base, expansions: ['sandtrout'] }, { ...base, players: [{ faction: 'atreides' }] },
    { ...base, players: [{ faction: 'atreides' }, { faction: 'atreides' }] },
    { ...base, players: [{ faction: 'atreides' }, { faction: 'richese' }] },
    { ...base, players: [{ faction: 'atreides' }, { faction: 'unknown' }] },
    { ...base, expansions: ['ix'], players: [{ faction: 'ixians' }, { faction: 'richese' }] },
    { ...base, techTokens: true }, { ...base, advanced: false, strongholdCards: true },
    { ...base, semutaPreview: true }, { ...base, advancedPreview: true },
    { ...base, kullPreview: true }, { ...base, nexusKullPreview: true },
    { ...base, richeseBetrayalPreview: true },
  ];
  for (const configuration of invalid)
    assert.equal(independentDiscoveryNexusProfile(configuration), false, JSON.stringify(configuration));
});

void test('live independent Discovery retains native stamps and transient encounters while preserving trained E3 capture boundary', () => {
  const native = { advanced: true, expansions: ['ecaz'],
    players: [{ faction: 'moritani' }, { faction: 'harkonnen' }],
    ecazTreachery: true, discoveryEnabled: true, nexusCards: true };
  assert.equal(independentDiscoveryNexusProfile({ ...native, moritaniAssassinatePreview: true }), true);
  assert.equal(independentDiscoveryNexusProfile({ ...native, leaderSkills: true }), false);
  assert.equal(independentDiscoveryNexusProfile({ ...native, advanced: false, leaderSkills: true }), true);
  assert.equal(independentDiscoveryNexusProfile({ ...native, advanced: false, moritaniAssassinatePreview: true }), false);
  assert.equal(independentDiscoveryNexusProfile({ ...native, leaderSkills: true,
    players: [{ faction: 'atreides' }, { faction: 'harkonnen' }] }), true,
  'Selecting an unused E3 deck does not add native trained capture.');

  const encounter = { ...native, expansions: ['ecaz', 'ix'],
    players: [{ faction: 'moritani' }, { faction: 'ixians' }, { faction: 'guild' }],
    nexusIxianBetrayalPreview: true, moritaniAssassinatePreview: true,
    discoveries: {}, discoveryStash: {}, greatMaker: {}, sandtrout: {},
    homeworlds: true, leaderSkills: true, techTokens: true, strongholdCards: true };
  assert.equal(independentDiscoveryNexusProfile(encounter), true,
    'The public runtime envelope does not reject a legal initialized module because an encounter exists.');
  assert.equal(nexusCoreProfile(encounter), true);
  assert.equal(independentNexusProfile(encounter), true);
  assert.equal(independentDiscoveryNexusProfile({ ...encounter,
    players: [{ faction: 'moritani' }, { faction: 'tleilaxu' }, { faction: 'guild' }] }), false,
  'An Ixian-specific native stamp requires the actual seated Ixian.');
});
