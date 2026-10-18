import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { independentDiscoveryNexusProfile } from '../game/faction-module-profile';
import { validateDiscoveryState } from '../game/discoveries';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import {
  createIndependentDiscoveryCardsFixture, completeIndependentDiscoveryCards,
  completeIndependentDiscoverySandtrout, independentDiscoveryCardsPlayer as player,
} from './fixture-independent-discovery-cards';

function originalModules(game: Game): void {
  assert.ok(independentDiscoveryNexusProfile(game));
  assert.ok(game.ecazTreachery && game.discoveryEnabled && game.discoveries && game.nexusCards?.cards);
  validateDiscoveryState(game.discoveries);
  assert.equal(game.discoveries.tokens.length, 8);
  const cards = game.nexusCards.cards;
  assert.deepEqual([...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(card => card !== null)].sort(), [...NEXUS_FACTIONS].sort());
}
for (const modules of [false, true]) void test(`${modules ? 'Advanced six seats across three families with World/all14/phase' : 'Basic classic independent'} original Discovery reveal and next-turn entry precede native Fremen Cunning into its revealed nested location`, () => {
  const fixture = createIndependentDiscoveryCardsFixture({ advanced: modules,
    expansions: modules ? ['ix', 'choam', 'ecaz'] : [],
    factions: modules ? ['fremen', 'guild', 'emperor', 'ixians', 'choam', 'ecaz'] : ['fremen', 'guild', 'emperor'],
    skills: modules, homeworlds: modules, tech: modules, strongholds: modules });
  originalModules(fixture.afterSetup);
  assert.equal(!!fixture.afterSetup.homeworlds, modules);
  assert.equal(!!fixture.afterSetup.leaderSkills, modules);
  assert.equal(!!fixture.afterSetup.techTokens, modules);
  assert.equal(!!fixture.afterSetup.strongholdCards, modules);
  assert.equal(viewGame(fixture.beforeInspection, 'guild').discoveries!.tokens.find(token => token.id === fixture.token)!.face, null);
  assert.equal(viewGame(fixture.inspected, 'guild').discoveries!.tokens.find(token => token.id === fixture.token)!.face, 'cistern');
  assert.equal(viewGame(fixture.inspected, 'emperor').discoveries!.tokens.find(token => token.id === fixture.token)!.face, null);
  assert.equal(viewGame(fixture.beforeInspection, 'fremen').discoveries!.tokens.find(token => token.id === fixture.token)!.face, 'cistern',
    'Native Fremen already knows the Hiereg face.');
  assert.equal(viewGame(fixture.revealed, 'fremen').discoveries!.tokens.find(token => token.id === fixture.token)!.face, 'cistern');
  assert.equal(fixture.revealed.discoveries!.tokens.find(token => token.id === fixture.token)!.revealedTurn, 1);
  assert.equal(fixture.game.turn, 2);
  assert.equal(fixture.game.phase, 0);
  assert.equal(fixture.game.decision?.kind, 'discoveryEntry');
  const guild = fixture.shipments.find(shipment => shipment.actor === 'guild'); assert.ok(guild);
  assert.equal(player(guild.after, 'guild').reserves, player(guild.before, 'guild').reserves - 3);
  assert.equal(player(guild.after, 'guild').spice, player(guild.before, 'guild').spice - 3);
  const done = completeIndependentDiscoveryCards(fixture);
  assert.equal(player(done.entered, 'guild').forces['cistern:0'], 1);
  assert.equal(player(done.entered, 'guild').forces[`${fixture.parent}:${fixture.parentSector}`], player(done.entryBefore, 'guild').forces[`${fixture.parent}:${fixture.parentSector}`] - 1);
  assert.equal(player(done.entered, 'guild').spice, player(done.entryBefore, 'guild').spice);
  assert.equal(player(done.entered, 'guild').moved, player(done.entryBefore, 'guild').moved);
  assert.equal(player(done.entered, 'guild').shipped, player(done.entryBefore, 'guild').shipped);
  assert.equal(done.drawn.nexusCards!.cards!.hands.fremen, 'fremen');
  assert.equal(player(done.drawn, 'guild').ally, 'emperor');
  assert.equal(player(done.drawn, 'fremen').ally, null);
  assert.equal(done.occurrence.initiallyEmpty, true);
  assert.equal(done.occurrence.territory, 'red_chasm');
  assert.equal(done.occurrence.origin, 'natural');
  assert.equal(done.beforeSpend.spice['red_chasm:7'], 8);
  assert.equal(done.spent.nexusCards!.cards!.hands.fremen, null);
  assert.equal(done.spent.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
  assert.equal(done.beforeRide.spice['red_chasm:7'] ?? 0, 0);
  assert.equal(done.beforeRide.decision?.kind, 'nexusFremenCunningRide');
  assert.equal(player(done.afterRide, 'fremen').forces['cistern:0'], 3);
  assert.equal(player(done.afterRide, 'fremen').elites?.forces['cistern:0'] ?? 0, modules ? 2 : 0);
  assert.equal(player(done.afterRide, 'fremen').forces[fixture.sourceKey] ?? 0, player(done.beforeRide, 'fremen').forces[fixture.sourceKey] - 3);
  assert.deepEqual(player(done.afterRide, 'guild').forces, player(done.beforeRide, 'guild').forces);
  assert.equal(player(done.afterRide, 'fremen').reserves, player(done.beforeRide, 'fremen').reserves);
  assert.equal(player(done.afterRide, 'fremen').moved, player(done.beforeRide, 'fremen').moved);
  assert.equal(player(done.afterRide, 'fremen').shipped, player(done.beforeRide, 'fremen').shipped);
  assert.equal(player(done.afterRide, 'fremen').spice, player(done.beforeRide, 'fremen').spice);
  assert.equal(done.afterRide.nexusFremenCunningRides!.find(ride => ride.occurrence.event === done.occurrence.event)!.stage, 'complete');
  originalModules(done.game);
});

void test('actual selected Ix Sandtrout breaks the earned alliance and suppresses its next worm without losing independent Discovery or native Fremen card custody', () => {
  const fixture = createIndependentDiscoveryCardsFixture({ expansions: ['ix'], factions: ['fremen', 'guild', 'emperor'] });
  const done = completeIndependentDiscoverySandtrout(fixture);
  assert.equal(player(done.before, 'guild').ally, 'emperor');
  assert.equal(player(done.before, 'emperor').ally, 'guild');
  assert.equal(done.before.nexusCards!.cards!.hands.fremen, 'fremen');
  assert.ok(done.doubled.players.every(player => player.ally === null));
  assert.equal(done.doubled.sandtrout, false);
  assert.equal(done.doubled.nexus, false);
  assert.equal(done.doubled.nexusFremenCunningOffer ?? null, null);
  assert.equal(done.doubled.nexusFremenCunningRides?.length ?? 0, done.before.nexusFremenCunningRides?.length ?? 0);
  assert.equal(done.doubled.spiceWindow!.amount, 12);
  assert.deepEqual(done.doubled.spiceDiscard[0].slice(-3), [
    { sandtrout: true }, { worm: true, suppressed: true }, { territory: 'sihaya_ridge', amount: 6, sector: 9 },
  ]);
  assert.equal(done.doubled.nexusCards!.cards!.hands.fremen, 'fremen');
  assert.equal(done.doubled.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 0);
  assert.deepEqual(player(done.doubled, 'fremen').forces, player(done.before, 'fremen').forces);
  assert.equal(player(done.doubled, 'fremen').tanks, player(done.before, 'fremen').tanks);
  assert.equal(done.doubled.spice['red_chasm:7'], done.before.spice['red_chasm:7']);
  assert.equal(done.game.phase, 2);
  assert.equal(done.game.nexusCards!.phase!.occurred, false);
  assert.equal(done.game.spice['sihaya_ridge:9'], 12);
  originalModules(done.game);
});
