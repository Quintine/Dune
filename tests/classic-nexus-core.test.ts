import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame } from '../game/engine';
import { createIndependentHarkonnenCall, createIndependentIxianPurchase,
  reactionAction, reactionPlayer } from './fixture-classic-independent-nexus-reactions';
import { advanceClassicIndependentNexus } from './fixture-classic-independent-nexus';
import { classicDiscoveryNexusClean } from './fixture-discovery-classic-nexus';
import { createClassicNexusGuildPayment, createClassicNexusCunning,
  submitClassicNexusSecondShipment } from './fixture-classic-nexus-core';

void test('ordinary base33 all14 supports the native declared-Traitor cancellation and real Mentat draw', () => {
  const f = createIndependentHarkonnenCall({ independent: false, advanced: true, skills: true });
  assert.equal(f.game.deck.length + f.game.discard.length + f.game.players.reduce((sum, player) => sum + player.hand.length, 0), 33);
  let game = reactionAction(f.game, 'atreides', { type: 'nexusHarkonnenBetrayalUse',
    event: f.game.pendingNexusHarkonnenBetrayal!.source.event });
  assert.equal(reactionPlayer(game, 'atreides').leaders.find(leader => leader.id === f.identity)?.dead, false);
  assert.equal(reactionPlayer(game, 'atreides').tanks, 1, 'Without Harass, the actual losing board counter is lost normally.');
  assert.equal(reactionPlayer(game, 'harkonnen').traitors.includes(f.identity), false);
  const top = game.traitorReserve![0];
  game = advanceClassicIndependentNexus(game, state => state.phase === 8 && classicDiscoveryNexusClean(state));
  assert.equal(game.nexusHarkonnenReplacementHistory!.length, 1);
  assert.equal(game.nexusHarkonnenReplacementHistory![0].drawn, top);
  assert.equal(reactionPlayer(game, 'harkonnen').traitors.length, 4);
  assert.deepEqual(game.nexusCards!.cards!.discard, ['harkonnen']);
});

void test('ordinary base33 all14 replaces the actual paid lot without introducing independent cards', () => {
  const f = createIndependentIxianPurchase({ independent: false, advanced: true, skills: true });
  const purchased = f.game.pendingNexusIxianReplacement!.card, top = f.game.deck[0];
  const paid = reactionPlayer(f.game, 'atreides').spice;
  const game = reactionAction(f.game, 'atreides', { type: 'nexusIxianReplacementUse',
    event: f.game.pendingNexusIxianReplacement!.event });
  assert.equal(reactionPlayer(game, 'atreides').spice, paid);
  assert.equal(paid, reactionPlayer(f.beforePayment, 'atreides').spice - 2);
  assert.equal(reactionPlayer(game, 'atreides').hand.some(card => card.id === purchased.id), false);
  assert.deepEqual(reactionPlayer(game, 'atreides').hand.find(card => card.id === top.id), top);
  assert.equal(game.discard.filter(card => card.id === purchased.id).length, 1);
  assert.equal(game.auction?.index, f.game.auction!.index + 1);
  assert.deepEqual(game.nexusCards!.cards!.discard, ['ixians']);
});

void test('Richese Secret Ally five-force price and a distinct Guild fee claim retain both original singleton costs', () => {
  const f = createClassicNexusGuildPayment({ advanced: true, skills: true });
  assert.equal(f.game.pendingGuildBetrayal!.invoice.price, 1);
  assert.equal(reactionPlayer(f.game, 'atreides').reserves, reactionPlayer(f.beforeShipment, 'atreides').reserves);
  assert.equal(f.game.nexusRicheseHistory!.at(-1)!.stage, 'pending');
  assert.deepEqual(f.game.nexusCards!.cards!.discard, ['richese']);
  const game = reactionAction(f.game, 'emperor', { type: 'guildBetrayalUse',
    event: f.game.pendingGuildBetrayal!.invoice.event });
  assert.equal(reactionPlayer(game, 'atreides').spice, reactionPlayer(f.beforeShipment, 'atreides').spice - 1);
  assert.equal(reactionPlayer(game, 'emperor').spice, reactionPlayer(f.beforeShipment, 'emperor').spice + 1);
  assert.equal(reactionPlayer(game, 'guild').spice, reactionPlayer(f.beforeShipment, 'guild').spice);
  assert.equal(reactionPlayer(game, 'atreides').reserves, reactionPlayer(f.beforeShipment, 'atreides').reserves - 5);
  assert.equal(reactionPlayer(game, 'atreides').forces[f.key], 5);
  assert.equal(game.nexusRicheseHistory!.at(-1)!.stage, 'shipped');
  assert.deepEqual(game.nexusCards!.cards!.discard, ['richese', 'guild']);
});

void test('passing the discounted shipment keeps Guild Nexus and pays only the original one-spice Guild receipt', () => {
  const f = createClassicNexusGuildPayment({ independent: true });
  const game = reactionAction(f.game, 'emperor', { type: 'guildBetrayalPass',
    event: f.game.pendingGuildBetrayal!.invoice.event });
  assert.equal(reactionPlayer(game, 'atreides').spice, reactionPlayer(f.beforeShipment, 'atreides').spice - 1);
  assert.equal(reactionPlayer(game, 'guild').spice, reactionPlayer(f.beforeShipment, 'guild').spice + 1);
  assert.equal(reactionPlayer(game, 'emperor').spice, reactionPlayer(f.beforeShipment, 'emperor').spice);
  assert.equal(reactionPlayer(game, 'atreides').forces[f.key], 5);
  assert.equal(game.nexusCards!.cards!.hands.emperor, 'guild');
  assert.deepEqual(game.nexusCards!.cards!.discard, ['richese']);
});

void test('the paying Bureaucrat cannot divert its own five-spice Guild Nexus payment', () => {
  const f = createClassicNexusGuildPayment({ advanced: true, skills: true, discounted: false });
  const game = reactionAction(f.game, 'emperor', { type: 'guildBetrayalUse',
    event: f.game.pendingGuildBetrayal!.invoice.event });
  assert.notEqual(game.decision?.kind, 'bureaucratPayment');
  assert.equal(reactionPlayer(game, 'atreides').spice, reactionPlayer(f.beforeShipment, 'atreides').spice - 5);
  assert.equal(reactionPlayer(game, 'emperor').spice, reactionPlayer(f.beforeShipment, 'emperor').spice + 5);
  assert.equal(reactionPlayer(game, 'atreides').forces[f.key], 5);
});

void test('a genuine third-party Bureaucrat redirects two from the actual Guild Nexus recipient without repeating delivery', () => {
  const f = createClassicNexusGuildPayment({ advanced: true, skills: true, discounted: false,
    training: { atreides: 'diplomat', guild: 'mentat', harkonnen: 'bureaucrat', emperor: 'sandmaster' } });
  let game = reactionAction(f.game, 'emperor', { type: 'guildBetrayalUse',
    event: f.game.pendingGuildBetrayal!.invoice.event });
  const offer = viewGame(game, 'harkonnen').bureaucrat!.pending!;
  assert.equal(offer.payee, 'emperor');
  assert.equal(offer.amount, 5);
  game = reactionAction(game, 'harkonnen', { type: 'decision', event: offer.event, redirect: true });
  assert.equal(reactionPlayer(game, 'atreides').spice, reactionPlayer(f.beforeShipment, 'atreides').spice - 5);
  assert.equal(reactionPlayer(game, 'emperor').spice, reactionPlayer(f.beforeShipment, 'emperor').spice + 3);
  assert.equal(reactionPlayer(game, 'harkonnen').spice, reactionPlayer(f.beforeShipment, 'harkonnen').spice);
  assert.equal(reactionPlayer(game, 'guild').spice, reactionPlayer(f.beforeShipment, 'guild').spice);
  assert.equal(reactionPlayer(game, 'atreides').forces[f.key], 5);
  assert.equal(reactionPlayer(game, 'atreides').reserves, reactionPlayer(f.beforeShipment, 'atreides').reserves - 5);
  assert.deepEqual(game.nexusCards!.cards!.discard, ['guild']);
});

for (const kind of ['reserve', 'cross', 'return'] as const) {
  void test(`native Guild Cunning ${kind} shipment survives the neutral fee gate with one real paid group`, () => {
    const f = submitClassicNexusSecondShipment(createClassicNexusCunning({ advanced: true, skills: true }), kind);
    const offer = viewGame(f.game, 'emperor').guildBetrayalReaction!;
    assert.equal(offer.canUse, false, 'The actual Guild singleton was already spent for Cunning.');
    assert.equal(f.game.pendingGuildBetrayal!.invoice.price, 1);
    const before = reactionPlayer(f.beforeSecond, 'guild');
    let game = reactionAction(f.game, 'emperor', { type: 'guildBetrayalPass', event: offer.event });
    const guild = reactionPlayer(game, 'guild'), destination = `${f.second}:${f.secondSector}`;
    assert.equal(guild.spice, before.spice - 1);
    assert.equal(reactionPlayer(game, 'emperor').spice, reactionPlayer(f.beforeSecond, 'emperor').spice);
    assert.equal(guild.reserves, before.reserves + (kind === 'reserve' ? -1 : kind === 'return' ? 1 : 0));
    assert.equal(guild.forces[f.origin] ?? 0, kind === 'reserve' ? 1 : 0);
    assert.equal(guild.forces[destination] ?? 0, kind === 'return' ? 0 : 1);
    assert.deepEqual(game.nexusCards!.cards!.discard, ['guild']);
    assert.equal(game.nexusCards!.cards!.hands.emperor, 'harkonnen');
    assert.equal(viewGame(game, 'guild').nexusGuildCunning!.active!.movesLeft, 0);
    const settledForces = structuredClone(guild.forces);
    game = reactionAction(game, 'guild', { type: 'endMovement' });
    assert.deepEqual(reactionPlayer(game, 'guild').forces, settledForces);
    assert.equal(game.nexusGuildCunningHistory!.at(-1)!.stage, 'completed');
  });
}

void test('native Karama cancels only Cunning and retains the completed first shipment and its price', () => {
  const f = createClassicNexusCunning({ advanced: true, skills: true });
  const game = reactionAction(f.game, 'atreides', { type: 'card', card: f.counter, mode: 'cancel' });
  assert.deepEqual(reactionPlayer(game, 'guild').forces, reactionPlayer(f.beforeCunning, 'guild').forces);
  assert.equal(reactionPlayer(game, 'guild').reserves, reactionPlayer(f.beforeCunning, 'guild').reserves);
  assert.equal(reactionPlayer(game, 'guild').spice, reactionPlayer(f.beforeCunning, 'guild').spice);
  assert.equal(game.discard.filter(card => card.id === f.counter).length, 1);
  assert.deepEqual(game.nexusCards!.cards!.discard, ['guild']);
  assert.equal(game.nexusGuildCunningHistory!.at(-1)!.stage, 'canceled');
  assert.notEqual(game.active, 'guild');
});
