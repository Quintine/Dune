import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TERRITORIES } from '../game/board';
import { applyAction, viewGame, type Game } from '../game/engine';
import { presenceAt } from '../game/force-presence';
import {
  nexusAllow, nexusInventory, nexusReady, nexusReload, nexusTurnTwo,
  orderNexusSpice,
} from './fixture-nexus-cards';

const source = 'wind_pass';
const destination = 'polar_sink:0';

function fixture(ordinaryRide = false) {
  // This is the audited three-seat game after a completed first turn, not a
  // synthetic spice pile or duplicate Nexus/Karama card.
  let g = nexusTurnTwo({ advanced: true });
  const cards = g.nexusCards!.cards!;
  const nexusIndex = cards.deck.indexOf('fremen');
  assert.ok(nexusIndex >= 0);
  cards.hands.f = cards.deck.splice(nexusIndex, 1)[0];
  const karamaIndex = g.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karamaIndex >= 0);
  g.players[0].hand.push(g.deck.splice(karamaIndex, 1)[0]);
  const counterKarama = g.deck.findIndex(card => card.effect === 'karama');
  assert.ok(counterKarama >= 0);
  g.players[1].hand.push(g.deck.splice(counterKarama, 1)[0]);
  const previous = g.spiceDiscard[0].findLast(card => 'territory' in card);
  assert.ok(!ordinaryRide || (previous && 'territory' in previous));
  const rideTerritory = ordinaryRide && previous && 'territory' in previous
    ? previous.territory : null;
  // The prior Spice Blow can be rock. Its worm still grants a native ride,
  // but the separate Cunning ride needs a physically occupied desert source.
  const sourceTerritory = rideTerritory &&
    TERRITORIES.find(row => row.id === rideTerritory)?.type === 'sand'
    ? rideTerritory : source;
  const sourceSector = sourceTerritory === source
    ? g.storm === 14 ? 15 : 14
    : TERRITORIES.find(row => row.id === sourceTerritory)!.sectors.find(sector => sector !== g.storm)!;
  const sourceKey = `${sourceTerritory}:${sourceSector}`;
  const rideSector = rideTerritory && rideTerritory !== sourceTerritory
    ? TERRITORIES.find(row => row.id === rideTerritory)!.sectors.find(sector => sector !== g.storm)!
    : null;
  const fremen = g.players[0];
  assert.ok(fremen.reserves >= (rideSector === null ? 2 : 3));
  fremen.reserves -= rideSector === null ? 2 : 3;
  fremen.forces[sourceKey] = (fremen.forces[sourceKey] ?? 0) + 2;
  if (rideSector !== null) {
    const rideKey = `${rideTerritory}:${rideSector}`;
    fremen.forces[rideKey] = (fremen.forces[rideKey] ?? 0) + 1;
  }
  if (ordinaryRide) {
    // The preceding turn left a physical land card in pile zero. A real worm
    // drawn next attacks that land; Fremen there earn an ordinary ride.
    const wormIndex = g.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker);
    assert.ok(wormIndex >= 0);
    g.spiceDeck.unshift(g.spiceDeck.splice(wormIndex, 1)[0]);
    const landIndex = g.spiceDeck.findIndex((card, index) => index > 0 && 'territory' in card);
    assert.ok(landIndex > 0);
    g.spiceDeck.splice(1, 0, g.spiceDeck.splice(landIndex, 1)[0]);
  } else orderNexusSpice(g, ['land', 'land']);
  g = nexusReady(g);
  if (ordinaryRide) {
    g = nexusAllow(g);
    assert.deepEqual(g.wormRides, [rideTerritory]);
  }
  assert.ok(g.spiceWindow && g.spiceSequence);
  const target = TERRITORIES.find(row => row.type === 'sand' &&
    row.id !== sourceTerritory && row.id !== g.spiceWindow!.territory &&
    g.players.every(player => presenceAt(player, row.id) === 0));
  assert.ok(target, 'The audited setup must leave an empty sand territory.');
  assert.equal(g.phase, 1);
  return { g, target: target.id, sourceKey, sourceTerritory, rideTerritory };
}

function summon(g: Game, target: string): Game {
  return applyAction(g, 'f', {
    type: 'card', mode: 'special', card: g.players[0].hand.find(card => card.effect === 'karama')!.id,
    territory: target,
  });
}

function accepted(g: Game) {
  assert.equal(g.decision?.kind, 'nexusFremenCunningOffer');
  const pending = g.nexusFremenCunningOffer!;
  const event = pending.occurrence.event;
  assert.equal(pending.owner, 'f');
  assert.equal(pending.occurrence.origin, 'summoned');
  assert.equal(pending.occurrence.turn, 2);
  assert.equal(pending.occurrence.initiallyEmpty, true);
  const parent = g.summonedWorm?.event;
  assert.ok(parent);
  assert.match(event, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  assert.match(parent, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  assert.equal(pending.occurrence.parent, parent);
  assert.notEqual(event, parent);
  assert.equal(viewGame(g, 'a').nexusCards?.card, null);
  assert.equal(viewGame(g, 'f').nexusCards?.card, 'fremen');
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'a', { type: 'decision', event, accept: true }));
  assert.deepEqual(g, before, 'Other seats cannot spend Fremen Cunning.');
  assert.throws(() => applyAction(g, 'f', {
    type: 'decision', event: 'stale-summon-occurrence', accept: true,
  }), /empty-worm Nexus opportunity/);
  assert.deepEqual(g, before, 'A stale event cannot change the summon or its card.');
  g = applyAction(nexusReload(g), 'f', { type: 'decision', event, accept: true });
  assert.equal(g.response?.kind, 'nexusFremenCunning');
  assert.equal(g.nexusCards!.cards!.hands.f, null);
  assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
  assert.equal(g.nexusFremenCunningRides?.length, 1);
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'pending');
  assert.equal(g.nexusFremenCunningRides?.[0].occurrence.event, event);
  return { g, event };
}

void test('special Karama accepts one real Fremen card, survives a response reload, and restores the Spice Blow and ordinary ride before its remote ride', () => {
  const { g: original, target, sourceKey, sourceTerritory, rideTerritory } = fixture(true);
  const parentSequence = structuredClone(original.spiceSequence);
  const parentWindow = structuredClone(original.spiceWindow);
  const originalSource = original.players[0].forces[sourceKey] ?? 0;
  let g = summon(original, target);
  assert.equal(g.summonedWorm?.territory, target);
  assert.equal(g.nexusFremenCunningOffer?.occurrence.territory, target);
  ({ g } = accepted(nexusReload(g)));
  g = nexusAllow(nexusReload(g));
  assert.equal(g.summonedWorm, null);
  assert.equal(g.nexusFremenCunningOffer, null);
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'queued');
  assert.deepEqual(g.spiceSequence, parentSequence);
  assert.deepEqual(g.spiceWindow, parentWindow);
  assert.deepEqual(g.wormRides, [rideTerritory]);
  assert.equal(g.nexus, true);
  assert.equal(g.players[0].forces[sourceKey], originalSource);
  assert.equal(g.discard.filter(card => card.effect === 'karama').length, 1);
  g = nexusReady(g); // Finish the interrupted blow; then close the summoned Nexus.
  assert.equal(g.nexus, true);
  g = nexusReady(g);
  assert.equal(g.decision?.kind, 'wormRide');
  assert.equal(g.decision?.kind === 'wormRide' && g.decision.territory, rideTerritory);
  g = applyAction(g, 'f', { type: 'decision', accept: false });
  assert.equal(g.decision?.kind, 'nexusFremenCunningRide');
  const event = g.nexusFremenCunningRides![0].occurrence.event;
  assert.equal(g.decision?.kind === 'nexusFremenCunningRide' && g.decision.event, event);
  const before = nexusReload(g);
  assert.throws(() => applyAction(g, 'a', { type: 'decision', event, accept: false }));
  assert.throws(() => applyAction(g, 'f', {
    type: 'decision', event: 'stale-summon-occurrence', accept: false,
  }), /pending Fremen Cunning remote worm ride/);
  assert.deepEqual(g, before);
  g = applyAction(nexusReload(g), 'f', {
    type: 'decision', event, accept: true, source: sourceTerritory,
    forces: { [sourceKey]: { normal: 1, elite: 0 } },
    territory: 'polar_sink', sector: 0,
  });
  assert.equal(g.players[0].forces[sourceKey], originalSource - 1);
  assert.equal(g.players[0].forces[destination],
    (original.players[0].forces[destination] ?? 0) + 1);
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'complete');
  assert.equal(g.nexusFremenCunningRides?.length, 1);
  nexusInventory(g);
});

void test('Karama cancellation stops only the accepted remote ride; declining leaves the card in hand', () => {
  const { g: before, target, sourceKey } = fixture();
  const offered = summon(before, target);
  const event = offered.nexusFremenCunningOffer!.occurrence.event;
  const declined = applyAction(nexusReload(offered), 'f', {
    type: 'decision', event, accept: false,
  });
  assert.equal(declined.nexusCards!.cards!.hands.f, 'fremen');
  assert.equal(declined.nexusFremenCunningRides?.length ?? 0, 0);
  assert.equal(declined.summonedWorm, null);
  assert.ok(declined.spiceWindow);
  const { g: acceptedGame } = accepted(offered);
  const canceled = applyAction(nexusReload(acceptedGame), 'a', {
    type: 'card', mode: 'cancel', card: acceptedGame.players[1].hand[0].id,
  });
  assert.equal(canceled.response, null);
  assert.equal(canceled.nexusFremenCunningRides?.[0].stage, 'complete');
  assert.equal(canceled.nexusCards!.cards!.hands.f, null);
  assert.equal(canceled.players[0].forces[sourceKey], before.players[0].forces[sourceKey]);
  assert.equal(canceled.summonedWorm, null);
  assert.deepEqual(canceled.spiceSequence, before.spiceSequence);
  assert.deepEqual(canceled.spiceWindow, before.spiceWindow);
  assert.ok(canceled.log.some(line => line.text.includes('Shai-Hulud appeared')));
  nexusInventory(canceled);
});

void test('occupied appearance, absent desert source, or alliance has no Cunning offer; the summon still resolves', () => {
  for (const unavailable of ['occupied', 'source', 'allied'] as const) {
    const { g, target, sourceKey } = fixture();
    if (unavailable === 'occupied') {
      const other = g.players[1];
      const sector = TERRITORIES.find(row => row.id === target)!.sectors.find(s => s !== g.storm)!;
      other.reserves--;
      other.forces[`${target}:${sector}`] = (other.forces[`${target}:${sector}`] ?? 0) + 1;
    } else if (unavailable === 'source') {
      g.players[0].reserves += g.players[0].forces[sourceKey];
      delete g.players[0].forces[sourceKey];
      for (const [key, count] of Object.entries(g.players[0].forces)) {
        g.players[0].reserves += count;
        delete g.players[0].forces[key];
      }
    } else {
      g.players[0].ally = 'a';
      g.players[1].ally = 'f';
      g.nexusCards!.cards!.hands.f = null;
      g.nexusCards!.cards!.deck.push('fremen');
    }
    const summoned = summon(g, target);
    assert.notEqual(summoned.decision?.kind, 'nexusFremenCunningOffer', unavailable);
    assert.equal(summoned.nexusFremenCunningOffer ?? null, null);
    assert.equal(summoned.summonedWorm, null);
    assert.deepEqual(summoned.spiceSequence, g.spiceSequence);
    assert.ok(summoned.log.some(line => line.text.includes('Shai-Hulud appeared')));
    nexusInventory(summoned);
  }
});

void test('card-blind empty appearance cannot spend a Fremen card it does not physically hold', () => {
  const { g, target } = fixture();
  g.nexusCards!.cards!.hands.f = null;
  g.nexusCards!.cards!.deck.push('fremen');
  const offered = summon(g, target);
  assert.equal(offered.decision?.kind, 'nexusFremenCunningOffer');
  const event = offered.nexusFremenCunningOffer!.occurrence.event;
  const before = structuredClone(offered);
  assert.throws(() => applyAction(offered, 'f', {
    type: 'decision', event, accept: true,
  }), /Fremen Cunning needs/);
  assert.deepEqual(offered, before);
  const passed = applyAction(offered, 'f', { type: 'decision', event, accept: false });
  assert.equal(passed.nexusFremenCunningOffer, null);
  assert.equal(passed.nexusCards!.cards!.hands.f, null);
  assert.equal(passed.summonedWorm, null);
  nexusInventory(passed);
});

void test('restored summon offer and spent response reject a replaced parent before a card or force change', () => {
  const { g: parent, target } = fixture();
  const offered = summon(parent, target);
  const event = offered.nexusFremenCunningOffer!.occurrence.event;
  const wrongOffer = nexusReload(offered);
  wrongOffer.summonedWorm!.event = 'different-special-karama';
  const savedOffer = structuredClone(wrongOffer);
  assert.throws(() => applyAction(wrongOffer, 'f', {
    type: 'decision', event, accept: true,
  }), /original special Karama parent/);
  assert.deepEqual(wrongOffer, savedOffer);
  const pending = applyAction(offered, 'f', { type: 'decision', event, accept: true });
  assert.equal(pending.response?.kind, 'nexusFremenCunning');
  const wrongResponse = nexusReload(pending);
  wrongResponse.summonedWorm!.event = 'different-special-karama';
  const savedResponse = structuredClone(wrongResponse);
  assert.throws(() => applyAction(wrongResponse, 'a', { type: 'passResponse' }),
    /summoned worm parent/);
  assert.deepEqual(wrongResponse, savedResponse);
  assert.equal(pending.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
  nexusInventory(pending);
});

function naturalOfferWithUnusedSummon(secondFaction: 'atreides' | 'beneGesserit' = 'atreides') {
  let g = nexusTurnTwo({ advanced: true, secondFaction });
  const cards = g.nexusCards!.cards!;
  const cardIndex = cards.deck.indexOf('fremen');
  assert.ok(cardIndex >= 0);
  cards.hands.f = cards.deck.splice(cardIndex, 1)[0];
  for (const seat of [0, 1]) {
    const index = g.deck.findIndex(card => card.effect === 'karama');
    assert.ok(index >= 0);
    g.players[seat].hand.push(g.deck.splice(index, 1)[0]);
  }
  const sourceSector = g.storm === 14 ? 15 : 14;
  g.players[0].reserves -= 2;
  g.players[0].forces[`wind_pass:${sourceSector}`] = 2;
  orderNexusSpice(g, ['worm', 'land']);
  const empty = g.spiceDeck.find((card, index) => index > 1 && 'territory' in card &&
    card.territory !== 'wind_pass' &&
    g.players.every(player => presenceAt(player, card.territory) === 0));
  assert.ok(empty && 'territory' in empty);
  g.spiceDeck.splice(g.spiceDeck.indexOf(empty), 1);
  g.spiceDiscard[0].push(empty);
  g = nexusReady(g);
  assert.equal(g.decision?.kind, 'nexusFremenCunningOffer');
  nexusInventory(g);
  return g;
}

void test('a real special summon suspends and restores an earlier natural Cunning offer across worm survival', () => {
  const original = naturalOfferWithUnusedSummon();
  const event = original.nexusFremenCunningOffer!.occurrence.event;
  const suspended = summon(original, 'wind_pass');
  assert.equal(suspended.response?.kind, 'wormSurvival');
  assert.equal(suspended.summonedWorm?.resume.decision?.kind, 'nexusFremenCunningOffer');
  assert.equal(suspended.nexusFremenCunningOffer?.occurrence.event, event);
  let g = nexusAllow(nexusReload(suspended));
  assert.equal(g.summonedWorm, null);
  assert.equal(g.decision?.kind, 'nexusFremenCunningOffer');
  assert.equal(g.nexusFremenCunningOffer?.occurrence.event, event);
  g = applyAction(g, 'f', { type: 'decision', event, accept: true });
  assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
  nexusInventory(g);
});

void test('a summon during a selected remote ride reopens its Nexus before resuming that ride', () => {
  let g = naturalOfferWithUnusedSummon();
  const event = g.nexusFremenCunningOffer!.occurrence.event;
  g = applyAction(g, 'f', { type: 'decision', event, accept: true });
  g = nexusAllow(g);
  for (let i = 0; g.phase === 1 && !g.decision && i < 6; i++)
    g = g.response ? nexusAllow(g) : nexusReady(g);
  assert.equal(g.decision?.kind, 'nexusFremenCunningRide');
  const target = TERRITORIES.find(row => row.type === 'sand' && row.id !== 'wind_pass' &&
    g.players.every(player => presenceAt(player, row.id) === 0));
  assert.ok(target);
  g = summon(g, target.id);
  assert.equal(g.summonedWorm, null);
  assert.equal(g.nexus, true);
  assert.equal(g.decision, null, 'The new Nexus must precede the interrupted ride.');
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'queued');
  g = nexusReady(g);
  assert.equal(g.decision?.kind, 'nexusFremenCunningRide');
  assert.equal(g.nexusFremenCunningRides?.[0].occurrence.event, event);
  g = applyAction(g, 'f', { type: 'decision', event, accept: false });
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'complete');
  nexusInventory(g);
});

void test('a summoned survival response preserves the earlier pending Cunning Karama response', () => {
  let g = naturalOfferWithUnusedSummon();
  const event = g.nexusFremenCunningOffer!.occurrence.event;
  g = applyAction(g, 'f', { type: 'decision', event, accept: true });
  assert.equal(g.response?.kind, 'nexusFremenCunning');
  g = summon(g, 'wind_pass');
  assert.equal(g.response?.kind, 'wormSurvival');
  assert.equal(g.summonedWorm?.resume.response?.kind, 'nexusFremenCunning');
  g = nexusReload(g);
  for (let i = 0; g.summonedWorm && i < 6; i++) {
    assert.equal(g.response?.kind, 'wormSurvival');
    const id = g.players.find(player => !g.response!.passed.includes(player.id))!.id;
    g = applyAction(g, id, { type: 'passResponse' });
  }
  assert.equal(g.summonedWorm, null);
  assert.equal(g.response?.kind, 'nexusFremenCunning');
  assert.equal(g.response.intent, event);
  g = nexusAllow(g);
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'queued');
  nexusInventory(g);
});

void test('nested BG Karama conversions preserve the suspended Cunning cancellation', () => {
  let g = naturalOfferWithUnusedSummon('beneGesserit');
  const event = g.nexusFremenCunningOffer!.occurrence.event;
  for (let i = 0; i < 2; i++) {
    const index = g.deck.findIndex(card => card.kind === 'worthless');
    assert.ok(index >= 0);
    g.players[1].hand.push(g.deck.splice(index, 1)[0]);
  }
  const counterKarama = g.players[1].hand.findIndex(card => card.effect === 'karama');
  assert.ok(counterKarama >= 0);
  g.players[2].hand.push(g.players[1].hand.splice(counterKarama, 1)[0]);
  g = applyAction(g, 'f', { type: 'decision', event, accept: true });
  assert.equal(g.response?.kind, 'nexusFremenCunning');
  g = applyAction(g, 'a', {
    type: 'card', mode: 'cancel', card: g.players[1].hand.find(card => card.kind === 'worthless')!.id,
  });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(g.pendingKarama?.use.kind, 'cancel');
  g = summon(g, 'wind_pass');
  assert.equal(g.response?.kind, 'wormSurvival');
  assert.equal(g.summonedWorm?.resume.pendingKarama?.use.kind, 'cancel');
  g = applyAction(g, 'a', {
    type: 'card', mode: 'cancel', card: g.players[1].hand.find(card => card.kind === 'worthless')!.id,
  });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(g.pendingKarama?.use.kind, 'cancel');
  assert.equal(g.summonedWorm?.resume.pendingKarama?.use.kind, 'cancel');
  g = applyAction(nexusReload(g), 'h', { type: 'passResponse' });
  assert.equal(g.summonedWorm, null);
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(g.pendingKarama?.use.kind, 'cancel');
  if (g.pendingKarama?.use.kind === 'cancel')
    assert.equal(g.pendingKarama.use.response.kind === 'nexusFremenCunning' &&
      g.pendingKarama.use.response.intent, event);
  g = nexusAllow(g);
  assert.equal(g.nexusFremenCunningRides?.[0].stage, 'complete');
  nexusInventory(g);
});
