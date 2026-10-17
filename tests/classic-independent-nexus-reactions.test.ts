import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { createIndependentHarkonnenCall, createIndependentIxianPurchase,
  reactionAction, reactionPlayer } from './fixture-classic-independent-nexus-reactions';
import { advanceClassicIndependentNexus } from './fixture-classic-independent-nexus';
import { classicDiscoveryNexusClean } from './fixture-discovery-classic-nexus';
import { settleHarkonnenBetrayalNativeCounters } from './fixture-nexus-harkonnen-betrayal';

void test('independent Harass survives a canceled native call and Harkonnen draws the actual Mentat replacement', () => {
  const f = createIndependentHarkonnenCall();
  const frame = f.game.pendingNexusHarkonnenBetrayal!;
  assert.equal(reactionPlayer(f.game, 'atreides').leaders.find(leader => leader.id === f.identity)?.dead, false);
  let game = reactionAction(f.game, 'atreides', { type: 'nexusHarkonnenBetrayalUse', event: frame.source.event });
  assert.equal(game.nexusCards!.cards!.hands.atreides, null);
  assert.deepEqual(game.nexusCards!.cards!.discard, ['harkonnen']);
  assert.equal(reactionPlayer(game, 'harkonnen').traitors.includes(f.identity), false);
  assert.equal(reactionPlayer(game, 'harkonnen').traitors.length, 3);
  assert.equal(game.traitorReserve!.includes(f.identity), true);
  assert.equal(reactionPlayer(game, 'atreides').reserves, reactionPlayer(f.beforeShipment, 'atreides').reserves);
  assert.equal(reactionPlayer(game, 'atreides').tanks, 0);
  assert.equal(reactionPlayer(game, 'atreides').leaders.find(leader => leader.id === f.identity)?.dead, false);
  assert.equal(game.discard.filter(card => card.id === HARASS_WITHDRAW_CARD).length, 1);
  const top = game.traitorReserve![0];
  game = advanceClassicIndependentNexus(game, state => state.phase === 8 && classicDiscoveryNexusClean(state));
  assert.equal(game.pendingNexusHarkonnenReplacement, null);
  assert.equal(game.nexusHarkonnenReplacementHistory!.length, 1);
  assert.equal(game.nexusHarkonnenReplacementHistory![0].drawn, top);
  assert.equal(reactionPlayer(game, 'harkonnen').traitors.length, 4);
  assert.equal(reactionPlayer(game, 'harkonnen').traitors.filter(identity => identity === top).length, 1);
});

void test('all14 independent Harkonnen Pass preserves the actual traitor outcome and cancels Harass', () => {
  const f = createIndependentHarkonnenCall({ advanced: true, skills: true });
  const game = reactionAction(f.game, 'atreides', { type: 'nexusHarkonnenBetrayalPass',
    event: f.game.pendingNexusHarkonnenBetrayal!.source.event });
  assert.equal(game.nexusCards!.cards!.hands.atreides, 'harkonnen');
  assert.deepEqual(game.nexusCards!.cards!.discard, []);
  assert.equal(reactionPlayer(game, 'harkonnen').traitors.includes(f.identity), true);
  assert.equal(reactionPlayer(game, 'harkonnen').traitors.length, 4);
  assert.equal(reactionPlayer(game, 'atreides').leaders.find(leader => leader.id === f.identity)?.dead, true);
  assert.equal(reactionPlayer(game, 'atreides').tanks, 1);
  assert.equal(reactionPlayer(game, 'atreides').reserves, reactionPlayer(f.afterShipment, 'atreides').reserves);
  assert.equal(game.discard.filter(card => card.id === HARASS_WITHDRAW_CARD).length, 1);
  assert.equal(game.pendingNexusHarkonnenReplacement, null);
  assert.deepEqual(game.nexusHarkonnenReplacementHistory, []);
});

void test('all14 printed allied counter precedes independent Harkonnen acknowledgement without Nexus spending', () => {
  const f = createIndependentHarkonnenCall({ advanced: true, skills: true, remote: true });
  assert.equal(f.game.response?.kind, 'harkonnenTraitor');
  assert.equal(f.game.pendingNexusHarkonnenBetrayal, null);
  const game = reactionAction(f.game, 'guild', { type: 'card', card: f.counter, mode: 'cancel' });
  assert.equal(game.pendingNexusHarkonnenBetrayal, null);
  assert.equal(game.pendingNexusHarkonnenReplacement, null);
  assert.equal(game.nexusCards!.cards!.hands.atreides, 'harkonnen');
  assert.deepEqual(game.nexusCards!.cards!.discard, []);
  assert.equal(reactionPlayer(game, 'harkonnen').traitors.includes(f.identity), true);
  assert.equal(reactionPlayer(game, 'atreides').leaders.find(leader => leader.id === f.identity)?.dead, false);
  assert.equal(reactionPlayer(game, 'atreides').reserves, reactionPlayer(f.beforeShipment, 'atreides').reserves);
  assert.equal(game.discard.filter(card => card.id === f.counter).length, 1);
  assert.equal(game.discard.filter(card => card.id === HARASS_WITHDRAW_CARD).length, 1);
});

void test('all14 allowed allied call reaches independent Nexus Use before its original battle and Mentat', () => {
  const f = createIndependentHarkonnenCall({ advanced: true, skills: true, remote: true });
  let game = settleHarkonnenBetrayalNativeCounters(f.game);
  const source = game.pendingNexusHarkonnenBetrayal!.source;
  assert.equal(source.declaration.beneficiary, 'guild');
  game = reactionAction(game, 'atreides', { type: 'nexusHarkonnenBetrayalUse', event: source.event });
  assert.equal(reactionPlayer(game, 'atreides').leaders.find(leader => leader.id === f.identity)?.dead, false);
  assert.equal(reactionPlayer(game, 'atreides').tanks, 0);
  assert.equal(reactionPlayer(game, 'atreides').reserves, reactionPlayer(f.beforeShipment, 'atreides').reserves);
  assert.equal(reactionPlayer(game, 'guild').hand.some(card => card.id === f.counter), true);
  const top = game.traitorReserve![0];
  game = advanceClassicIndependentNexus(game, state => state.phase === 8 && classicDiscoveryNexusClean(state));
  assert.equal(game.nexusHarkonnenReplacementHistory!.length, 1);
  assert.equal(game.nexusHarkonnenReplacementHistory![0].drawn, top);
  assert.equal(reactionPlayer(game, 'harkonnen').traitors.length, 4);
});

void test('all14 Ixian replacement discards the delivered independent lot without repeating its paid invoice', () => {
  const f = createIndependentIxianPurchase({ advanced: true, skills: true });
  const paid = reactionPlayer(f.game, 'atreides'), top = f.game.deck[0];
  assert.equal(paid.spice, reactionPlayer(f.beforePayment, 'atreides').spice - 2);
  assert.equal(paid.hand.some(card => card.id === REINFORCEMENTS_CARD), true);
  const game = reactionAction(f.game, 'atreides', { type: 'nexusIxianReplacementUse',
    event: f.game.pendingNexusIxianReplacement!.event });
  assert.equal(reactionPlayer(game, 'atreides').spice, paid.spice);
  assert.equal(reactionPlayer(game, 'atreides').hand.length, paid.hand.length);
  assert.equal(reactionPlayer(game, 'atreides').hand.some(card => card.id === REINFORCEMENTS_CARD), false);
  assert.deepEqual(reactionPlayer(game, 'atreides').hand.find(card => card.id === top.id), top);
  assert.equal(game.discard.filter(card => card.id === REINFORCEMENTS_CARD).length, 1);
  assert.deepEqual(game.nexusCards!.cards!.discard, ['ixians']);
  assert.equal(game.nexusCards!.cards!.hands.atreides, null);
  assert.equal(game.auction?.index, f.game.auction!.index + 1);
});

void test('Harkonnen keeps the independent purchase and gains one native bonus when passing Ixian replacement', () => {
  const f = createIndependentIxianPurchase({ owner: 'harkonnen' });
  const paid = reactionPlayer(f.game, 'harkonnen'), top = f.game.deck[0];
  const game = reactionAction(f.game, 'harkonnen', { type: 'nexusIxianReplacementPass',
    event: f.game.pendingNexusIxianReplacement!.event });
  const buyer = reactionPlayer(game, 'harkonnen');
  assert.equal(buyer.spice, reactionPlayer(f.beforePayment, 'harkonnen').spice - 2);
  assert.equal(buyer.hand.length, paid.hand.length + 1);
  assert.equal(buyer.hand.some(card => card.id === REINFORCEMENTS_CARD), true);
  assert.deepEqual(buyer.hand.find(card => card.id === top.id), top);
  assert.equal(game.discard.some(card => card.id === REINFORCEMENTS_CARD), false);
  assert.equal(game.nexusCards!.cards!.hands.harkonnen, 'ixians');
  assert.deepEqual(game.nexusCards!.cards!.discard, []);
  assert.equal(game.auction?.index, f.game.auction!.index + 1);
});
