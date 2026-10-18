import test from 'node:test';
import assert from 'node:assert/strict';
import type { Game } from '../game/engine';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';
import { createDiscoveryState, placeDiscovery, revealDiscoveryToken } from '../game/discoveries';
import { createHomeworldCustody, quoteHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { reorderOrderedOpportunity } from '../game/ordered-opportunity';
import {
  ecazBetrayalModeSupported, ecazBetrayalOffer, quoteEcazBetrayal, validateEcazBetrayalSnapshot,
  type EcazBetrayalSnapshot,
} from '../game/nexus-ecaz-betrayal';
import { createRicheseNoField, deployRicheseNoField, type NoFieldValue } from '../game/richese-no-field';
import { nexusFixture, nexusReload } from './fixture-nexus-cards';

/** Ordinary printed-board occupation; no other expansion or optional modules. */
function position() {
  const g = nexusFixture({ hostFaction: 'ecaz', advanced: true });
  const ecaz = g.players.find(p => p.faction === 'ecaz')!;
  const ally = g.players.find(p => p.faction === 'atreides')!;
  const holder = g.players.find(p => p.faction === 'harkonnen')!;
  // The fixture seats only three factions. Model the supported Emperor's
  // advanced Sardaukar as a genuinely typed physical ally group.
  ally.faction = 'emperor';
  ally.forces = { 'wind_pass:14': 3, 'wind_pass:15': 2, 'carthag:11': 1 };
  ally.reserves = 14;
  ally.elites = { reserves: 2, tanks: 0, forces: {
    'wind_pass:14': 1, 'wind_pass:15': 1, 'carthag:11': 1,
  }, revived: 0 };
  ecaz.forces = { 'wind_pass:14': 2, 'carthag:11': 1 };
  ecaz.reserves = 17;
  ecaz.ally = ally.id;
  ally.ally = ecaz.id;
  const cards = g.nexusCards!.cards!;
  const cardIndex = cards.deck.indexOf('ecaz');
  assert.ok(cardIndex >= 0);
  cards.hands[holder.id] = cards.deck.splice(cardIndex, 1)[0];
  g.phase = 5;
  g.order = [ecaz.id, holder.id, ally.id];
  g.active = g.order[0];
  g.movementRemaining = [...g.order];
  g.response = null;
  g.decision = null;
  g.phaseOpening = null;
  g.nexusCards!.phase = null;
  for (const player of g.players) {
    player.shipped = false;
    player.moved = 0;
  }
  return { g, ecaz: ecaz.id, ally: ally.id, holder: holder.id };
}
function editGame(g: Game, change: (copy: Game) => void) {
  const copy = nexusReload(g);
  change(copy);
  return copy;
}

void test('Ecaz Betrayal quotes one selected public territory with every typed sector and no opponent data', () => {
  const { g, ecaz, ally, holder } = position();
  const offer = ecazBetrayalOffer(g, holder)!;
  assert.equal(offer.blocked, null);
  assert.equal(offer.ally, ally);
  assert.deepEqual(offer.territories.map(row => row.territory), ['wind_pass', 'carthag']);
  assert.deepEqual(offer.territories[0], { territory: 'wind_pass', sectors: {
    'wind_pass:14': { normal: 2, elite: 1 },
    'wind_pass:15': { normal: 1, elite: 1 },
  }, total: { normal: 3, elite: 2 } });
  assert.deepEqual(offer.territories[1], { territory: 'carthag', sectors: {
    'carthag:11': { normal: 0, elite: 1 },
  }, total: { normal: 0, elite: 1 } });
  const quote = quoteEcazBetrayal(g, holder, offer.event, 'wind_pass');
  assert.deepEqual(quote, { event: offer.event, owner: holder, ally, turn: g.turn,
    discardIndex: g.nexusCards!.cards!.discard.length, ...offer.territories[0] });
  assert.doesNotThrow(() => validateEcazBetrayalSnapshot(g, quote));
  assert.equal(ecazBetrayalOffer(g, ecaz), null);
  assert.equal(ecazBetrayalOffer(g, ally), null);
  assert.equal(ecazBetrayalOffer(g, 'not-seated'), null);
  const alteredPrivateAndOpponent = editGame(g, copy => {
    copy.players.find(p => p.id === ecaz)!.traitors = ['private Ecaz traitor'];
    copy.players.find(p => p.id === holder)!.traitors = ['private holder traitor'];
    copy.players.find(p => p.id === holder)!.forces['carthag:11'] += 2;
  });
  assert.deepEqual(ecazBetrayalOffer(alteredPrivateAndOpponent, holder), offer);
});

void test('Ecaz Betrayal needs reciprocal native alliance, cooccupation, proper card custody and a supported profile', () => {
  const { g, ecaz, ally, holder } = position();
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === ally)!.ally = null; }), holder)!.blocked!, /reciprocal/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === ecaz)!.ally = null; }), holder)!.blocked!, /reciprocal/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === holder)!.ally = ally; }), holder)!.blocked!, /allied player/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === ecaz)!.forces = {}; }), holder)!.blocked!, /share no territory/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === ally)!.forces = {}; copy.players.find(p => p.id === ally)!.elites!.forces = {}; }), holder)!.blocked!, /share no territory/);
  assert.equal(ecazBetrayalOffer(editGame(g, copy => { copy.nexusCards!.cards!.hands[holder] = null; }), holder), null);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === holder)!.faction = 'richese'; }), holder)!.blocked!, /combination is unavailable/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.expansions.push('ix'); }), holder)!.blocked!, /combination is unavailable/);
});

void test('canonical E3 and selected-independent profiles admit original optional modules without global presence exclusions', () => {
  const { g, holder, ally } = position();
  g.expansions = ['ecaz'];
  g.homeworlds = { custody: null };
  g.techTokens = {} as NonNullable<Game['techTokens']>;
  g.strongholdCards = {} as NonNullable<Game['strongholdCards']>;
  assert.equal(ecazBetrayalModeSupported(g), true);
  assert.equal(ecazBetrayalOffer(g, holder)!.blocked, null);

  // This is a pure quote admission fixture, not a module initializer/runtime
  // certificate. The original-action lane proves native physical module play.
  const selected = editGame(g, copy => {
    copy.expansions = ['ecaz', 'ix', 'choam'];
    copy.ecazTreachery = true;
    copy.players.find(p => p.id === holder)!.faction = 'choam';
    copy.leaderSkills = {} as NonNullable<Game['leaderSkills']>;
  });
  assert.equal(ecazBetrayalModeSupported(selected), true,
    'Selected decks need not seat one native from each selected family.');
  assert.equal(ecazBetrayalOffer(selected, holder)!.blocked, null);
  assert.equal(ecazBetrayalModeSupported(editGame(selected, copy => {
    copy.players.find(p => p.id === holder)!.faction = 'harkonnen';
  })), false, 'The existing Advanced actual-E3/Harkonnen/Skills boundary stays.');

  const skills = editGame(g, copy => {
    copy.players.find(p => p.id === holder)!.faction = 'guild';
    copy.leaderSkills = {} as NonNullable<Game['leaderSkills']>;
    const bg = copy.players.find(p => p.id === ally)!;
    bg.faction = 'beneGesserit';
    delete bg.elites;
    bg.advisors = { wind_pass: { lockedTurn: copy.turn }, carthag: {} };
  });
  const offer = ecazBetrayalOffer(skills, holder)!;
  assert.equal(offer.blocked, null);
  assert.deepEqual(offer.territories[0].total, { normal: 5, elite: 0 },
    'Advisor stance is public physical custody, not a reason to suppress a whole module.');
});

function markerPosition(value: NoFieldValue, onlyMarker = false) {
  const fixture = position();
  const { g, ally } = fixture;
  g.expansions = ['ecaz', 'choam'];
  g.ecazTreachery = true;
  const richese = g.players.find(p => p.id === ally)!;
  richese.faction = 'richese';
  delete richese.elites;
  if (onlyMarker) richese.forces = {};
  const inventory = createRicheseNoField(['opaque-one', 'opaque-two', 'opaque-three']);
  const token = inventory.tokens.find(t => t.value === value)!;
  richese.noField = deployRicheseNoField(inventory, {
    tokenId: token.id, controller: ally, location: { territory: 'wind_pass', sector: 14 },
  });
  richese.noFieldEvent = 'private-marker-generation';
  return { ...fixture, token };
}

void test('marker-only and mixed public quotes are independent of hidden denomination and reserves', () => {
  for (const onlyMarker of [false, true]) {
    let baseline: ReturnType<typeof ecazBetrayalOffer> | undefined;
    for (const value of [0, 3, 5] as const) {
      const { g, ally, holder, token } = markerPosition(value, onlyMarker);
      g.players.find(p => p.id === ally)!.reserves = value;
      const offer = ecazBetrayalOffer(g, holder)!;
      assert.equal(offer.blocked, null);
      assert.equal(offer.territories[0].concealed, true);
      assert.deepEqual(offer.territories[0].total, { normal: onlyMarker ? 0 : 5, elite: 0 });
      if (onlyMarker) assert.deepEqual(offer.territories[0].sectors, {});
      if (baseline) assert.deepEqual(offer, baseline);
      baseline = offer;
      const snapshot = quoteEcazBetrayal(g, holder, offer.event, 'wind_pass');
      assert.deepEqual(snapshot.noField, { supplier: ally, event: 'private-marker-generation', tokenId: token.id,
        location: { territory: 'wind_pass', sector: 14 } });
      assert.equal(Object.hasOwn(snapshot, 'concealed'), false);
      assert.equal(Object.hasOwn(snapshot.noField!, 'value'), false);
      assert.equal(Object.hasOwn(snapshot.noField!, 'reserves'), false);
      assert.doesNotThrow(() => validateEcazBetrayalSnapshot(g, snapshot));
      assert.equal(JSON.stringify(offer).includes(token.id), false);
      assert.equal(JSON.stringify(offer).includes('private-marker-generation'), false);
    }
  }
});

void test('pending marker recall binds exact private source while leaving denomination outside the quote', () => {
  const { g, holder, ally, token } = markerPosition(5, true);
  const snapshot = quoteEcazBetrayal(g, holder, ecazBetrayalOffer(g, holder)!.event, 'wind_pass');
  const pending = editGame(g, copy => {
    copy.nexusCards!.cards!.hands[holder] = null;
    copy.nexusCards!.cards!.discard.push('ecaz');
  });
  assert.doesNotThrow(() => validateEcazBetrayalSnapshot(pending, snapshot, true));
  const mutations: Array<(copy: Game) => void> = [
    copy => { copy.players.find(p => p.id === ally)!.noFieldEvent = 'new-event'; },
    copy => { copy.players.find(p => p.id === ally)!.noField!.deployed = null; },
    copy => { copy.players.find(p => p.id === ally)!.noField!.deployed!.location.sector = 15; },
    copy => { copy.players.find(p => p.id === ally)!.noField!.deployed!.controller = holder; },
    copy => {
      const state = copy.players.find(p => p.id === ally)!.noField!;
      state.deployed!.tokenId = state.tokens.find(t => t.id !== token.id)!.id;
      state.lastShipped = state.deployed!.tokenId;
    },
  ];
  for (const mutate of mutations)
    assert.throws(() => validateEcazBetrayalSnapshot(editGame(pending, mutate), snapshot, true));
  assert.throws(() => validateEcazBetrayalSnapshot(pending, { ...snapshot,
    noField: { ...snapshot.noField!, supplier: holder } }, true));
  const { noField: omitted, ...missingMarker } = snapshot;
  assert.ok(omitted);
  assert.throws(() => validateEcazBetrayalSnapshot(pending, missingMarker, true));
  const unrelatedReserves = editGame(pending, copy => { copy.players.find(p => p.id === ally)!.reserves = 0; });
  assert.doesNotThrow(() => validateEcazBetrayalSnapshot(unrelatedReserves, snapshot, true));
});

void test('only the target ally marker joins a quote and Ecaz still needs ordinary physical co-presence', () => {
  const { g, ecaz, holder, ally } = markerPosition(3, true);
  const noEcazCounters = editGame(g, copy => { copy.players.find(p => p.id === ecaz)!.forces = {}; });
  assert.match(ecazBetrayalOffer(noEcazCounters, holder)!.blocked!, /share no territory/);
  const unrelated = editGame(g, copy => {
    copy.players.find(p => p.id === ally)!.noField!.deployed!.controller = holder;
  });
  assert.match(ecazBetrayalOffer(unrelated, holder)!.blocked!, /share no territory/);
});

void test('current mobile and revealed Discovery territories quote complete groups without treating Homeworlds as territories', () => {
  const { g, ecaz, ally, holder } = position();
  g.expansions = ['ecaz', 'ix'];
  g.players.find(p => p.id === holder)!.faction = 'ixians';
  g.mobileStronghold = { location: 'arrakeen:9' };
  g.players.find(p => p.id === ecaz)!.forces[MOBILE_LOCATION] = 1;
  g.players.find(p => p.id === ally)!.forces[MOBILE_LOCATION] = 2;
  const mobileOffer = ecazBetrayalOffer(g, holder)!;
  assert.equal(mobileOffer.blocked, null);
  assert.deepEqual(mobileOffer.territories.find(row => row.territory === MOBILE_STRONGHOLD), {
    territory: MOBILE_STRONGHOLD, sectors: { [MOBILE_LOCATION]: { normal: 2, elite: 0 } },
    total: { normal: 2, elite: 0 },
  });
  const mobileSnapshot = quoteEcazBetrayal(g, holder, mobileOffer.event, MOBILE_STRONGHOLD);
  assert.doesNotThrow(() => validateEcazBetrayalSnapshot(g, mobileSnapshot));

  // Build a real pure Discovery placement/reveal; this is a quote boundary,
  // not a claim that a synthetic game has played the intervening spice blow.
  g.discoveryEnabled = true;
  const supply = createDiscoveryState(() => 0.25);
  const hiereg = supply.tokens.filter(token => token.type === 'hiereg');
  const chosen = hiereg.findIndex(token => token.face === 'jacurutu-sietch');
  assert.ok(chosen >= 0);
  const placed = placeDiscovery(supply, 'discovery-hagga-basin', () => (chosen + 0.25) / hiereg.length);
  const hidden = placed.tokens.find(token => token.face === 'jacurutu-sietch')!;
  g.discoveries = revealDiscoveryToken(placed, hidden.id, g.turn).state;
  g.players.find(p => p.id === ecaz)!.forces['jacurutu-sietch:0'] = 1;
  g.players.find(p => p.id === ally)!.forces['jacurutu-sietch:0'] = 3;
  const discoveryOffer = ecazBetrayalOffer(g, holder)!;
  assert.equal(discoveryOffer.blocked, null);
  assert.deepEqual(discoveryOffer.territories.find(row => row.territory === 'jacurutu-sietch')!.total,
    { normal: 3, elite: 0 });
  const discoverySnapshot = quoteEcazBetrayal(g, holder, discoveryOffer.event, 'jacurutu-sietch');
  assert.doesNotThrow(() => validateEcazBetrayalSnapshot(g, discoverySnapshot));
  assert.throws(() => ecazBetrayalOffer(editGame(g, copy => {
    copy.discoveries!.tokens.find(token => token.face === 'jacurutu-sietch')!.revealedTurn = null;
  }), holder), /board custody/, 'Unrevealed Discovery faces cannot supply a board location.');

  const context = homeworldContext(g);
  g.homeworlds = { custody: quoteHomeworldCustody(context, createHomeworldCustody(context), [
    { homeworld: 'homeworld:ixians', player: ecaz, withdraw: { normal: 0, elite: 0 }, deposit: { normal: 1, elite: 0 } },
  ]).state };
  assert.equal(ecazBetrayalOffer(g, holder)!.blocked, null,
    'Unrelated valid Homeworld custody does not disable an Arrakis quote.');
  assert.throws(() => quoteEcazBetrayal(g, holder, ecazBetrayalOffer(g, holder)!.event, 'homeworld:ixians'), /shared territory/);
});

void test('opening ends with any shipment, movement, first-seat pass, pending decision or automatic continuation', () => {
  const { g, holder } = position();
  const blocked = (change: (copy: Game) => void) => {
    const reason = ecazBetrayalOffer(editGame(g, change), holder)!.blocked;
    assert.ok(reason, 'The opening action must be unavailable.');
    return reason;
  };
  assert.match(blocked(copy => { copy.players[0].shipped = true; }), /before the first/);
  assert.match(blocked(copy => { copy.players[1].moved = 1; }), /before the first/);
  assert.match(blocked(copy => { copy.movementRemaining!.shift(); copy.active = copy.order[1]; }), /before the first/);
  assert.match(blocked(copy => { copy.movementRemaining!.shift(); copy.active = copy.order[0]; }), /before the first/);
  assert.match(blocked(copy => { copy.movementRemaining = []; }), /before the first/);
  assert.match(blocked(copy => { copy.movementRemaining![1] = copy.movementRemaining![0]; }), /before the first/);
  assert.match(blocked(copy => { copy.movementRemaining![1] = 'not-seated'; }), /before the first/);
  assert.match(blocked(copy => { copy.active = copy.order[1]; }), /before the first/);
  assert.match(blocked(copy => { copy.active = null; }), /before the first/);
  assert.match(blocked(copy => { copy.phase = 4; }), /before the first/);
  assert.match(blocked(copy => { copy.phaseOpening = { passed: [], initialize: true }; }), /current interaction/);
  assert.match(blocked(copy => { copy.decision = { kind: 'guildTiming', player: holder, next: g.order[0], following: g.order[1] }; }), /current interaction/);
  assert.match(ecazBetrayalOffer(g, holder, true)!.blocked!, /current interaction/);
});

void test('quiet Guild first or wait keeps the pre-action Betrayal opening without changing physical Storm order', () => {
  const { g, holder, ecaz, ally } = position();
  g.expansions = ['ecaz'];
  g.players.find(p => p.id === holder)!.faction = 'guild';
  g.guildTimingGranted = true;
  g.guildTimingLocked = false;
  // Native chooseGuildTiming(take=true) grants the whole turn without
  // rewriting movementRemaining. The original-action module fixture exercises
  // the real decision/response; this test isolates its resulting quote facts.
  g.active = holder;
  const physicalOrder = [...g.order];
  assert.deepEqual(g.movementRemaining, [ecaz, holder, ally]);
  const first = ecazBetrayalOffer(g, holder)!;
  assert.equal(first.blocked, null);
  assert.doesNotThrow(() => validateEcazBetrayalSnapshot(g,
    quoteEcazBetrayal(g, holder, first.event, 'wind_pass')));

  // Native wait places Guild at the back of the remaining queue; nobody has
  // taken a Shipment/Movement turn merely because this timing choice settled.
  const waiting = editGame(g, copy => {
    copy.movementRemaining = [ecaz, ally, holder];
    copy.active = ecaz;
  });
  assert.equal(ecazBetrayalOffer(waiting, holder)!.blocked, null);
  assert.deepEqual(waiting.order, physicalOrder);

  for (const change of [
    (copy: Game) => { copy.guildTimingGranted = false; },
    (copy: Game) => { copy.guildTimingLocked = true; },
    (copy: Game) => { copy.advanced = false; },
    (copy: Game) => { copy.active = ally; },
    (copy: Game) => { copy.movementRemaining = [ecaz, ally]; },
  ]) assert.match(ecazBetrayalOffer(editGame(g, change), holder)!.blocked!, /before the first/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => {
    copy.decision = { kind: 'guildTiming', player: holder, next: ecaz, following: ally };
  }), holder)!.blocked!, /current interaction/);
});

void test('an unspent Sapho-reordered first turn and its pending return keep the complete opening queue', () => {
  const { g, holder, ally } = position();
  const physicalOrder = [...g.order];
  const event = `movement:${g.turn}`;
  const reordered = reorderOrderedOpportunity({ event, eligible: g.order,
    remaining: g.movementRemaining!, completed: [], current: g.active, currentStarted: false },
  { event, player: ally, position: 'first' });
  g.movementRemaining = [...reordered.remaining];
  g.active = reordered.current;
  assert.notEqual(g.active, g.order[0]);
  assert.deepEqual(g.order, physicalOrder);
  assert.ok(g.players.every(p => !p.shipped && p.moved === 0));
  const offer = ecazBetrayalOffer(g, holder)!;
  assert.equal(offer.blocked, null);
  const snapshot = quoteEcazBetrayal(g, holder, offer.event, 'wind_pass');
  const pending = editGame(g, copy => {
    copy.nexusCards!.cards!.hands[holder] = null;
    copy.nexusCards!.cards!.discard.push('ecaz');
  });
  assert.doesNotThrow(() => validateEcazBetrayalSnapshot(pending, snapshot, true));
  assert.throws(() => validateEcazBetrayalSnapshot(editGame(pending, copy => {
    copy.movementRemaining!.shift();
    copy.active = copy.movementRemaining![0];
  }), snapshot, true), /pending card or alliance/);
});

void test('accepted quote rejects foreign territory, stale event and changing typed board custody', () => {
  const { g, ecaz, ally, holder } = position();
  const event = ecazBetrayalOffer(g, holder)!.event;
  assert.throws(() => quoteEcazBetrayal(g, ecaz, event, 'wind_pass'));
  assert.throws(() => quoteEcazBetrayal(g, holder, 'stale', 'wind_pass'), /stale/);
  assert.throws(() => quoteEcazBetrayal(g, holder, event, 'polar_sink'), /shared territory/);
  const quote = quoteEcazBetrayal(g, holder, event, 'wind_pass');
  assert.throws(() => validateEcazBetrayalSnapshot(editGame(g, copy => { copy.players.find(p => p.id === ally)!.forces['wind_pass:15']--; }), quote), /original physical ally group/);
  assert.throws(() => validateEcazBetrayalSnapshot(editGame(g, copy => { copy.turn++; }), quote));
  assert.throws(() => validateEcazBetrayalSnapshot(editGame(g, copy => { copy.nexusCards!.cards!.discard.push('guild'); }), quote));
  assert.throws(() => validateEcazBetrayalSnapshot(g, { ...quote, ally: holder }), /original physical ally group/);
  assert.throws(() => validateEcazBetrayalSnapshot(g, { ...quote, territory: 'carthag' }), /invalid saved sector group/);
  assert.throws(() => validateEcazBetrayalSnapshot(g, { ...quote, total: { normal: 4, elite: 2 } }), /original physical ally group/);
});

void test('malformed sector groups, inherited keys and invalid physical counts cannot become historical snapshots', () => {
  const { g, holder, ally } = position();
  const event = ecazBetrayalOffer(g, holder)!.event;
  const quote = quoteEcazBetrayal(g, holder, event, 'wind_pass');
  const bad = (patch: Partial<EcazBetrayalSnapshot>) =>
    assert.throws(() => validateEcazBetrayalSnapshot(g, { ...quote, ...patch }));
  bad({ sectors: Object.assign(Object.create({ 'wind_pass:15': { normal: 1, elite: 1 } }), {
    'wind_pass:14': { normal: 2, elite: 1 },
  }) });
  bad({ sectors: { 'wind_pass:14': { normal: 2, elite: 1 },
    'carthag:11': { normal: 1, elite: 1 } } });
  bad({ sectors: { 'wind_pass:14': { normal: -1, elite: 4 },
    'wind_pass:15': { normal: 1, elite: 1 } } });
  bad({ sectors: { 'wind_pass:14': { normal: 2.5, elite: 1 },
    'wind_pass:15': { normal: 1, elite: 1 } } });
  bad({ sectors: { 'wind_pass:14': { normal: 2, elite: 1, secret: 7 } as never,
    'wind_pass:15': { normal: 1, elite: 1 } } });
  const inherited = nexusReload(g);
  const inheritedAlly = inherited.players.find(p => p.id === ally)!;
  inheritedAlly.forces = Object.assign(Object.create({ 'wind_pass:13': 1 }), inheritedAlly.forces);
  assert.throws(() => ecazBetrayalOffer(inherited, holder), /plain physical/);
  assert.throws(() => ecazBetrayalOffer(editGame(g, copy => {
    copy.players.find(p => p.id === ally)!.elites!.forces['wind_pass:14'] = 9;
  }), holder), /typed force/);
  assert.throws(() => ecazBetrayalOffer(editGame(g, copy => {
    copy.players.find(p => p.id === ally)!.forces['wind_pass:15'] = NaN;
  }), holder), /board custody/);
});

void test('pending response validates the exact captured group after physical card discard without rereading a now-empty hand', () => {
  const { g, holder, ally } = position();
  const event = ecazBetrayalOffer(g, holder)!.event;
  const snapshot = quoteEcazBetrayal(g, holder, event, 'wind_pass');
  const pending = editGame(g, copy => {
    copy.nexusCards!.cards!.hands[holder] = null;
    copy.nexusCards!.cards!.discard.push('ecaz');
  });
  assert.doesNotThrow(() => validateEcazBetrayalSnapshot(pending, snapshot, true));
  const anotherSpentCard = editGame(pending, copy => {
    const cards = copy.nexusCards!.cards!;
    const index = cards.deck.indexOf('guild');
    assert.ok(index >= 0);
    cards.discard.push(cards.deck.splice(index, 1)[0]);
  });
  assert.doesNotThrow(() => validateEcazBetrayalSnapshot(anotherSpentCard, snapshot, true),
    'A separately spent Nexus card cannot invalidate this pending Ecaz return.');
  assert.throws(() => validateEcazBetrayalSnapshot(pending, snapshot));
  assert.throws(() => validateEcazBetrayalSnapshot(editGame(pending, copy => {
    copy.players.find(p => p.id === ally)!.elites!.forces['wind_pass:14'] = 0;
  }), snapshot, true), /original physical ally group/);
  assert.throws(() => validateEcazBetrayalSnapshot(editGame(pending, copy => {
    copy.nexusCards!.cards!.discard.push('guild');
  }), snapshot, true), /Nexus/);
  assert.throws(() => validateEcazBetrayalSnapshot(pending,
    { ...snapshot, discardIndex: snapshot.discardIndex + 1 }, true), /pending card/);
  assert.throws(() => validateEcazBetrayalSnapshot(pending, { ...snapshot, event: 'forged' }, true), /pending card/);
});
