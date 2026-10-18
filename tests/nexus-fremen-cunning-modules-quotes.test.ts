import assert from 'node:assert/strict';
import test from 'node:test';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';
import { clearNewlyRevealed, createDiscoveryState, placeDiscovery, revealDiscoveryToken } from '../game/discoveries';
import type { Game } from '../game/engine';
import { greatMakerSignature } from '../game/great-maker';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  captureFremenCunningOccurrence, fremenCunningDestinationBlock, fremenCunningPublicDestinationBlock,
  quoteFremenCunning, quoteFremenCunningRide, validateFremenCunningSelection,
  type FremenCunningOccurrence, type FremenCunningRideAuthorization, type FremenCunningSelection,
} from '../game/nexus-fremen-cunning';
import { nexusFixture } from './fixture-nexus-cards';

/** Pure quote position. The engine fixture lane owns genuine appearance,
 * card acquisition and paid native arrivals; these tests do not certify setup. */
function position() {
  const game = nexusFixture({ advanced: true });
  game.turn = 2; game.phase = 1; game.storm = 0;
  for (const player of game.players) {
    player.forces = {};
    if (player.elites) player.elites.forces = {};
  }
  const fremen = game.players.find(player => player.faction === 'fremen')!;
  fremen.forces = { 'wind_pass:14': 3, 'wind_pass:15': 2, 'carthag:11': 1, 'polar_sink:0': 1 };
  fremen.elites!.forces = { 'wind_pass:14': 1, 'wind_pass:15': 2 };
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('fremen');
  assert.ok(index >= 0);
  cards.hands[fremen.id] = cards.deck.splice(index, 1)[0];
  return { game, fremen, other: game.players[1], third: game.players[2] };
}
function appearance(game: Game): FremenCunningOccurrence {
  return captureFremenCunningOccurrence(game, {
    event: 'accepted-empty-worm', territory: 'hagga_basin', origin: 'natural', pile: 0,
  });
}
function authorize(game: Game, owner: string, occurrence: FremenCunningOccurrence): FremenCunningRideAuthorization {
  const cards = game.nexusCards!.cards!;
  assert.equal(cards.hands[owner], 'fremen');
  cards.hands[owner] = null; cards.discard.push('fremen');
  return { event: occurrence.event, owner, turn: occurrence.turn };
}
function revealLocation(game: Game) {
  const supply = createDiscoveryState(() => 0.25);
  const hiereg = supply.tokens.filter(token => token.type === 'hiereg');
  const chosen = hiereg.findIndex(token => token.face === 'jacurutu-sietch');
  assert.ok(chosen >= 0);
  const hidden = placeDiscovery(supply, 'discovery-hagga-basin', () => (chosen + 0.25) / hiereg.length);
  const token = hidden.tokens.find(token => token.face === 'jacurutu-sietch')!;
  game.discoveryEnabled = true;
  game.discoveries = clearNewlyRevealed(revealDiscoveryToken(hidden, token.id, game.turn - 1).state);
  return { hidden, token: token.id };
}
const selected: Omit<FremenCunningSelection, 'destination'> = {
  source: 'wind_pass', forces: {
    'wind_pass:14': { normal: 1, elite: 1 }, 'wind_pass:15': { normal: 0, elite: 1 },
  },
};

void test('revealed room-local Discovery accepts the original typed desert subset with World/all14/phase modules', () => {
  const { game, fremen } = position();
  const { hidden } = revealLocation(game);
  game.expansions = ['ix', 'choam', 'ecaz']; game.ecazTreachery = true;
  game.homeworlds = { custody: createHomeworldCustody(homeworldContext(game)) };
  game.leaderSkills = {} as NonNullable<Game['leaderSkills']>;
  game.techTokens = {} as NonNullable<Game['techTokens']>;
  game.strongholdCards = {} as NonNullable<Game['strongholdCards']>;
  fremen.forces['jacurutu-sietch:0'] = 1;
  game.mobileStronghold = { location: 'wind_pass:14' };
  fremen.forces[MOBILE_LOCATION] = 1;
  const occurrence = appearance(game);
  assert.deepEqual(quoteFremenCunning(game, fremen.id, occurrence)!.sources, [{
    territory: 'wind_pass', sectors: {
      'wind_pass:14': { normal: 2, elite: 1 }, 'wind_pass:15': { normal: 0, elite: 2 },
    },
  }], 'Reserves, World custody, rock, strongholds and nested territories are not desert sources.');
  const authorization = authorize(game, fremen.id, occurrence);
  const destination = { territory: 'jacurutu-sietch', sector: 0 };
  assert.equal(fremenCunningPublicDestinationBlock(game, fremen.id, selected.source, destination), null);
  assert.equal(fremenCunningDestinationBlock(game, fremen.id, occurrence, selected.source, destination), null);
  const before = structuredClone(fremen);
  assert.deepEqual(validateFremenCunningSelection(game, fremen.id, occurrence,
    { ...selected, destination }, authorization), { total: 3, elite: 2 });
  assert.deepEqual(fremen, before);
  assert.throws(() => validateFremenCunningSelection(game, fremen.id, occurrence,
    { ...selected, source: 'homeworld:fremen', destination }, authorization), /one occupied desert/);
  assert.match(fremenCunningPublicDestinationBlock(game, fremen.id, selected.source,
    { territory: 'homeworld:atreides', sector: 0 })!, /Arrakis board sector/);
  game.discoveries = hidden;
  assert.match(fremenCunningPublicDestinationBlock(game, fremen.id, selected.source, destination)!, /Arrakis board sector/);
  assert.throws(() => validateFremenCunningSelection(game, fremen.id, occurrence,
    { ...selected, destination }, authorization), /Arrakis board sector/);
});

void test('nested Discovery destinations retain public faction capacity, advisor stance and native Ecaz coalition rules', () => {
  const { game, fremen, other, third } = position();
  revealLocation(game);
  const destination = { territory: 'jacurutu-sietch', sector: 0 };
  other.forces['jacurutu-sietch:0'] = 1; third.forces['jacurutu-sietch:0'] = 1;
  assert.match(fremenCunningPublicDestinationBlock(game, fremen.id, 'wind_pass', destination)!, /three occupying factions/);
  other.faction = 'beneGesserit'; other.advisors = { 'jacurutu-sietch': {} };
  assert.equal(fremenCunningPublicDestinationBlock(game, fremen.id, 'wind_pass', destination), null);
  delete other.advisors;
  assert.match(fremenCunningPublicDestinationBlock(game, fremen.id, 'wind_pass', destination)!, /three occupying factions/,
    'The same BG counters fill a faction slot after changing to fighters.');
  other.faction = 'ecaz'; other.ally = third.id; third.ally = other.id;
  assert.equal(fremenCunningPublicDestinationBlock(game, fremen.id, 'wind_pass', destination), null,
    'Ecaz and its real reciprocal ally share one destination faction.');
  other.ally = null; third.ally = null;
  fremen.ally = other.id; other.ally = fremen.id;
  assert.equal(fremenCunningPublicDestinationBlock(game, fremen.id, 'wind_pass', destination), null,
    'An actual Fremen/Ecaz alliance retains the native shared-occupation exception.');
  other.faction = 'emperor';
  assert.match(fremenCunningPublicDestinationBlock(game, fremen.id, 'wind_pass', destination)!, /occupied by your ally/);
});

void test('HMS entry uses the chosen actual desert source, not the initially empty worm territory', () => {
  const { game, fremen } = position();
  game.mobileStronghold = { location: 'wind_pass:14' };
  const occurrence = appearance(game), authorization = authorize(game, fremen.id, occurrence);
  const destination = { territory: MOBILE_STRONGHOLD, sector: 0 };
  assert.notEqual(occurrence.territory, selected.source);
  assert.equal(fremenCunningPublicDestinationBlock(game, fremen.id, selected.source, destination), null);
  assert.deepEqual(validateFremenCunningSelection(game, fremen.id, occurrence,
    { ...selected, destination }, authorization), { total: 3, elite: 2 });
  game.mobileStronghold.location = 'hagga_basin:12';
  assert.match(fremenCunningPublicDestinationBlock(game, fremen.id, selected.source, destination)!, /territory it points at/);
  assert.throws(() => validateFremenCunningSelection(game, fremen.id, occurrence,
    { ...selected, destination }, authorization), /territory it points at/);
  game.mobileStronghold.location = 'wind_pass:99';
  assert.match(fremenCunningPublicDestinationBlock(game, fremen.id, selected.source, destination)!, /territory it points at/);
  game.mobileStronghold.location = null;
  assert.match(fremenCunningPublicDestinationBlock(game, fremen.id, selected.source, destination)!, /Arrakis board sector/);
});

void test('storm sectors and multi-territory or non-desert source substitutions remain illegal with dynamic destinations', () => {
  const { game, fremen } = position();
  revealLocation(game);
  const occurrence = appearance(game), authorization = authorize(game, fremen.id, occurrence);
  const destination = { territory: 'jacurutu-sietch', sector: 0 };
  game.storm = 14;
  assert.deepEqual(quoteFremenCunningRide(game, fremen.id, occurrence, authorization)!.sources[0].sectors,
    { 'wind_pass:15': { normal: 0, elite: 2 } });
  assert.throws(() => validateFremenCunningSelection(game, fremen.id, occurrence,
    { ...selected, destination }, authorization), /available typed physical forces/);
  game.storm = 11;
  assert.match(fremenCunningPublicDestinationBlock(game, fremen.id, selected.source,
    { territory: 'carthag', sector: 11 })!, /storm/);
  assert.throws(() => validateFremenCunningSelection(game, fremen.id, occurrence,
    { ...selected, forces: { ...selected.forces, 'carthag:11': { normal: 1, elite: 0 } }, destination },
    authorization), /available typed physical forces/);
  assert.match(fremenCunningPublicDestinationBlock(game, fremen.id, selected.source,
    { territory: 'jacurutu-sietch', sector: 1 })!, /Arrakis board sector/);
});

void test('a completed earlier Great Maker does not manufacture or suppress a later ordinary empty occurrence', () => {
  const { game, fremen, other } = position();
  game.greatMaker = { event: 'earlier-maker', turn: game.turn, pile: 0, index: 0,
    territory: 'red_chasm', stage: 'complete', order: [...game.order],
    votes: game.order.map(player => ({ player, yes: false })), ridesBefore: [], arrival: null, signature: '' };
  game.greatMaker.signature = greatMakerSignature(game.greatMaker);
  const empty = appearance(game);
  assert.ok(quoteFremenCunning(game, fremen.id, empty));
  other.forces['hagga_basin:12'] = 1;
  const occupied = captureFremenCunningOccurrence(game, {
    event: 'later-occupied-worm', territory: 'hagga_basin', origin: 'additional', pile: 1,
  });
  delete other.forces['hagga_basin:12'];
  assert.equal(quoteFremenCunning(game, fremen.id, occupied), null,
    'Completed Maker custody does not turn a post-devour empty board into a qualifying occurrence.');
});
