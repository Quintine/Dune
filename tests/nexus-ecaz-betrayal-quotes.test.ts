import test from 'node:test';
import assert from 'node:assert/strict';
import type { Game } from '../game/engine';
import {
  ecazBetrayalOffer, quoteEcazBetrayal, validateEcazBetrayalSnapshot,
  type EcazBetrayalSnapshot,
} from '../game/nexus-ecaz-betrayal';
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

void test('Ecaz Betrayal needs reciprocal native alliance, cooccupation, proper card custody and simple roster', () => {
  const { g, ecaz, ally, holder } = position();
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === ally)!.ally = null; }), holder)!.blocked!, /reciprocal/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === ecaz)!.ally = null; }), holder)!.blocked!, /reciprocal/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === holder)!.ally = ally; }), holder)!.blocked!, /allied player/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === ecaz)!.forces = {}; }), holder)!.blocked!, /share no territory/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === ally)!.forces = {}; copy.players.find(p => p.id === ally)!.elites!.forces = {}; }), holder)!.blocked!, /share no territory/);
  assert.equal(ecazBetrayalOffer(editGame(g, copy => { copy.nexusCards!.cards!.hands[holder] = null; }), holder), null);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === holder)!.faction = 'richese'; }), holder)!.blocked!, /Combined modules/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.homeworlds = { custody: null }; }), holder)!.blocked!, /Combined modules/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.players.find(p => p.id === ally)!.advisors = { wind_pass: {} }; }), holder)!.blocked!, /advisor/);
  assert.match(ecazBetrayalOffer(editGame(g, copy => { copy.expansions.push('ix'); }), holder)!.blocked!, /Combined modules/);
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
  assert.match(blocked(copy => { copy.active = null; }), /before the first/);
  assert.match(blocked(copy => { copy.phase = 4; }), /before the first/);
  assert.match(blocked(copy => { copy.phaseOpening = { passed: [], initialize: true }; }), /current interaction/);
  assert.match(blocked(copy => { copy.decision = { kind: 'guildTiming', player: holder, next: g.order[0], following: g.order[1] }; }), /current interaction/);
  assert.match(ecazBetrayalOffer(g, holder, true)!.blocked!, /current interaction/);
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
