import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../game/engine';
import {
  advanceBankerOverlayToMentat, advanceBankerOverlayToPhase, bankerOverlayDeferred,
  bankerOverlayInventory, bankerOverlayLedger, bankerOverlayPlayer, bankerOverlayWallets,
  claimBankerOverlaySemuta, createBankerOverlayFixture, openBankerOverlayHajr,
  passBankerOverlaySemuta, shipBankerOverlayIncome, type BankerOverlayOptions,
} from './fixture-banker-overlay-default';

const profiles: BankerOverlayOptions[] = [
  { advanced: false, tech: false, strongholds: false },
  { advanced: true, tech: false, strongholds: false },
  { advanced: true, tech: true, strongholds: false },
  { advanced: true, tech: true, strongholds: true },
];

for (const profile of profiles) {
  const label = `${profile.advanced ? 'Advanced' : 'Basic'}${profile.tech ? ' Tech' : ''}${profile.strongholds ? ' Strongholds' : ''}`;
  void test(`${label} Semuta + Skills: the ordinary Richese Banker keeps its printed income for a real Guild self-shipment paid to the Bank until the native Mentat Pause`, () => {
    const fixture = createBankerOverlayFixture(profile);
    const before = bankerOverlayWallets(fixture.game);
    const payer = before.find(row => row.id === fixture.payer)!;
    const owner = before.find(row => row.id === fixture.owner)!;
    assert.equal(fixture.kind, 'bank');
    assert.equal(fixture.amount, 4);
    assert.equal(fixture.cost, 4, 'Four normal forces into empty sand cost four spice at the Guild half rate');
    assert.equal(fixture.payee, 'bank');
    assert.equal(fixture.grant, true);
    assert.equal(fixture.game.semutaPreview, true);
    assert.equal(fixture.game.spiceBankerIncomePreview, true);
    assert.equal(bankerOverlayLedger(fixture.game, fixture.owner).preview, true);
    assert.deepEqual(bankerOverlayLedger(fixture.game, fixture.owner).deferred, [],
      'No income exists before the real payment');
    assert.equal(payer.shipped, false);
    assert.equal(fixture.game.active, fixture.payer);

    const paid = shipBankerOverlayIncome(fixture);
    const ledger = bankerOverlayLedger(paid, fixture.owner);
    const receipt = paid.spiceBankerIncome!.sources.at(-1)!;
    assert.equal(paid.spiceBankerIncome!.sources.length, 1, 'Only the one real Bank payment is recorded');
    assert.equal(paid.spiceBankerIncome!.collections.length, 0);
    assert.equal(receipt.source.kind, 'shipment');
    assert.equal(receipt.source.turn, 1);
    assert.equal(receipt.source.phase, 5);
    assert.deepEqual(receipt.source.bankLegs, [{ payer: fixture.payer, amount: fixture.cost }],
      'The deferred invoice keeps the exact real Bank leg of this payment');
    assert.equal(receipt.grant!.owner, fixture.owner, 'Another payer paid the Bank, so the printed grant is Richese’s');
    assert.equal(receipt.grant!.amount, 1);
    assert.deepEqual(receipt.source.trainer!.assignment,
      { skill: 'spice-banker', leader: fixture.trainer, owner: fixture.owner });
    assert.equal(receipt.source.trainer!.faceUp, true, 'The actual Banker trainer must be face up');
    assert.equal(receipt.source.trainer!.survived, true);
    assert.deepEqual(ledger.deferred, [{ owner: fixture.owner, amount: 1 }],
      'The printed spice sits in front of the shield, unavailable until the Mentat Pause');
    assert.deepEqual(ledger.usedThisPhase, [fixture.owner]);
    assert.equal(bankerOverlayDeferred(paid, fixture.owner), 1);

    // The original payment itself is unchanged and already spent this phase.
    const after = bankerOverlayWallets(paid);
    assert.equal(after.find(row => row.id === fixture.payer)!.spice, payer.spice - 4);
    assert.equal(after.find(row => row.id === fixture.payer)!.reserves, payer.reserves - 4);
    assert.equal(after.find(row => row.id === fixture.payer)!.shipped, true);
    assert.equal(after.find(row => row.id === fixture.payer)!.moved, payer.moved);
    assert.equal(after.find(row => row.id === fixture.owner)!.spice, owner.spice,
      'Deferred income is not spendable and must not change the Banker’s wallet');
    assert.equal(bankerOverlayPlayer(paid, fixture.payer).forces[fixture.key], fixture.amount);
    assert.equal(paid.response, null, 'The Guild’s own shipment owes no Guild income response');
    assert.throws(() => applyAction(paid, fixture.payer, fixture.shipment),
      'The same native shipment cannot repeat its payment or income');

    // The printed overlay continuation runs on a real fresh discard, then the
    // original ordinary-card continuation resumes with the same income untouched.
    const paused = openBankerOverlayHajr(paid, fixture);
    const beforeOverlay = bankerOverlayLedger(paused, fixture.owner);
    const claimed = claimBankerOverlaySemuta(paused, fixture);
    assert.deepEqual(bankerOverlayLedger(claimed, fixture.owner), beforeOverlay,
      'Claiming through the original Semuta overlay must not create, move or duplicate Banker income');
    assert.deepEqual(claimed.spiceBankerIncome, paused.spiceBankerIncome);

    const collection = advanceBankerOverlayToPhase(claimed, 7, fixture.plan);
    assert.deepEqual(bankerOverlayLedger(collection, fixture.owner).deferred, [{ owner: fixture.owner, amount: 1 }],
      'The printed spice must still be deferred through the ordinary Collection phase');
    const balance = bankerOverlayPlayer(collection, fixture.owner).spice;
    const mentat = advanceBankerOverlayToMentat(collection, fixture.plan);
    const mentatLedger = bankerOverlayLedger(mentat, fixture.owner);
    assert.deepEqual(mentatLedger.deferred, [], 'The actual Mentat Pause collects the deferred spice');
    assert.deepEqual(mentatLedger.usedThisPhase, []);
    assert.equal(bankerOverlayPlayer(mentat, fixture.owner).spice, balance + 1,
      'The Mentat Pause credits exactly the one printed spice');
    assert.equal(mentat.spiceBankerIncome!.collections.length, 1);
    assert.deepEqual(mentat.spiceBankerIncome!.collections[0].credits, [{ owner: fixture.owner, amount: 1 }]);
    assert.deepEqual(mentat.spiceBankerIncome!.collections[0].grants, [receipt.cursor]);
    assert.equal(mentat.spiceBankerIncome!.sources.length, 1);
    assert.equal(mentat.pendingTreacheryDiscard, null);
    assert.equal(mentat.response, null);
    assert.equal(mentat.decision, null);
    assert.equal(mentat.status, 'playing');
    // Original overlay and card custody complete: the claimed card stays claimed.
    assert.equal(bankerOverlayPlayer(mentat, fixture.owner).hand.filter(card => card.id === fixture.hajr).length, 1);
    assert.equal(mentat.discard.filter(card => card.id === fixture.semuta).length, 1);
    assert.deepEqual(bankerOverlayInventory(mentat), bankerOverlayInventory(fixture.game));
  });
}

void test('Basic Semuta + Skills: the same real Guild self-shipment below the printed band records no grant', () => {
  const fixture = createBankerOverlayFixture({ kind: 'below', semuta: 'pass' });
  assert.equal(fixture.amount, 3);
  assert.equal(fixture.cost, 3);
  assert.equal(fixture.payee, 'bank');
  assert.equal(fixture.grant, false);
  const before = bankerOverlayWallets(fixture.game);
  const payer = before.find(row => row.id === fixture.payer)!;
  const owner = before.find(row => row.id === fixture.owner)!;
  const paid = shipBankerOverlayIncome(fixture);
  assert.equal(paid.spiceBankerIncome!.sources.length, 1,
    'The real Bank payment is still recorded, without the printed grant');
  assert.equal(paid.spiceBankerIncome!.sources[0].grant, null);
  assert.deepEqual(paid.spiceBankerIncome!.sources[0].source.bankLegs, [{ payer: fixture.payer, amount: 3 }]);
  assert.deepEqual(bankerOverlayLedger(paid, fixture.owner).deferred, []);
  assert.deepEqual(bankerOverlayLedger(paid, fixture.owner).usedThisPhase, []);
  assert.equal(bankerOverlayPlayer(paid, fixture.payer).spice, payer.spice - 3);

  const paused = openBankerOverlayHajr(paid, fixture);
  const passed = passBankerOverlaySemuta(paused, fixture);
  assert.deepEqual(passed.spiceBankerIncome, paid.spiceBankerIncome,
    'Declining the printed overlay must not create Banker income');
  const collection = advanceBankerOverlayToPhase(passed, 7, fixture.plan);
  const balance = bankerOverlayPlayer(collection, fixture.owner).spice;
  assert.equal(balance, owner.spice,
    'This Richese holds no board forces, so ordinary Collection does not change its wallet');
  const mentat = advanceBankerOverlayToMentat(collection, fixture.plan);
  assert.equal(bankerOverlayPlayer(mentat, fixture.owner).spice, balance,
    'The Mentat Pause credits nothing without a printed grant');
  assert.equal(mentat.spiceBankerIncome!.collections.length, 1);
  assert.deepEqual(mentat.spiceBankerIncome!.collections[0].credits, []);
  assert.deepEqual(mentat.spiceBankerIncome!.collections[0].grants, []);
  assert.equal(mentat.discard.filter(card => card.id === fixture.hajr).length, 1);
  assert.equal(bankerOverlayPlayer(mentat, fixture.owner).hand.filter(card => card.id === fixture.semuta).length, 1);
  assert.deepEqual(bankerOverlayInventory(mentat), bankerOverlayInventory(fixture.game));
});

void test('Basic Semuta + Skills: another payer’s real four-spice shipment to the seated Guild player is not a Bank payment', () => {
  const fixture = createBankerOverlayFixture({ kind: 'player' });
  assert.equal(fixture.payer, 'a');
  assert.equal(fixture.payerFaction, 'atreides');
  assert.equal(fixture.amount, 2);
  assert.equal(fixture.cost, 4, 'Two normal forces at the full desert price still pay four spice');
  assert.equal(fixture.payee, 'guild');
  assert.equal(fixture.grant, false);
  const before = bankerOverlayWallets(fixture.game);
  const atreides = before.find(row => row.id === 'a')!;
  const guild = before.find(row => row.id === 'g')!;
  const paid = shipBankerOverlayIncome(fixture);
  assert.equal(paid.spiceBankerIncome!.sources.length, 0,
    'A price paid to a player is not a Bank payment, so no invoice is recorded');
  assert.equal(paid.spiceBankerIncome!.collections.length, 0);
  assert.deepEqual(bankerOverlayLedger(paid, fixture.owner).deferred, []);
  assert.equal(bankerOverlayPlayer(paid, 'a').spice, atreides.spice - 4);
  assert.equal(bankerOverlayPlayer(paid, 'g').spice, guild.spice + 4,
    'The seated Guild still receives its ordinary shipment income');
  assert.equal(bankerOverlayPlayer(paid, 'a').shipped, true);
  assert.equal(bankerOverlayPlayer(paid, 'a').forces[fixture.key], 2);

  const paused = openBankerOverlayHajr(paid, fixture);
  const claimed = claimBankerOverlaySemuta(paused, fixture);
  assert.equal(claimed.spiceBankerIncome!.sources.length, 0);
  const collection = advanceBankerOverlayToPhase(claimed, 7, fixture.plan);
  const balance = bankerOverlayPlayer(collection, fixture.owner).spice;
  const mentat = advanceBankerOverlayToMentat(collection, fixture.plan);
  assert.equal(bankerOverlayPlayer(mentat, fixture.owner).spice, balance);
  assert.deepEqual(mentat.spiceBankerIncome!.collections[0].credits, []);
  assert.equal(mentat.spiceBankerIncome!.collections.length, 1);
});

void test('Basic Semuta + Skills: supplied Banker authority on the ordinary native shipment is rejected without change', () => {
  const fixture = createBankerOverlayFixture({ semuta: 'pass' });
  const before = structuredClone(fixture.game);
  for (const key of ['actor', 'bankerIncome', 'paymentSource', 'spiceBankerIncome', 'bankLegs', 'trainer']) {
    assert.throws(() => applyAction(fixture.game, fixture.payer,
      { ...fixture.shipment, [key]: 'supplied' }));
    assert.deepEqual(fixture.game, before);
  }
  const paid = shipBankerOverlayIncome(fixture);
  assert.deepEqual(paid.spiceBankerIncome!.sources.at(-1)!.source.bankLegs,
    [{ payer: fixture.payer, amount: fixture.cost }],
    'Only the original native transaction can supply the deferred Bank legs');
  assert.throws(() => applyAction(paid, fixture.payer, fixture.shipment));
  assert.equal(paid.spiceBankerIncome!.sources.length, 1);
});
